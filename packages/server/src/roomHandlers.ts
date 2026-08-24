/**
 * Socket.io event handlers for room lifecycle management.
 *
 * Wires ROOM_CREATE, ROOM_JOIN, TEAM_PICK, and the disconnect handler onto a socket.
 * Called from createServer.ts io.on('connection') for fresh connections,
 * and also (disconnect-only) for reconnected sockets.
 *
 * CONN-01: ROOM_CREATE emits ROOM_JOINED(roomCode, slot=1, sessionToken) to the creator.
 * CONN-02: ROOM_JOIN on success emits ROOM_JOINED(roomCode, slot=2, sessionToken) to joining socket only; notifies existing player(s) without token.
 * CONN-03: Slot-2 join emits TEAM_SELECTION_START to all room members (Phase 16 D-10).
 * CONN-04: ROOM_JOIN guards NOT_FOUND and NOT_WAITING with distinct ROOM_ERROR reason strings.
 * ARCH-01: Server assigns slots deterministically; client never supplies a slot value.
 * ARCH-04: broadcastState emits the full GameState snapshot after every state change.
 * TEAM-01: Home (slot 1) picks first; away (slot 2) picks from remaining three teams.
 * TEAM-02: isProcessing mutex prevents concurrent team:pick processing (SC-5 pattern).
 *
 * Anti-pattern rationale (RESEARCH.md):
 * - Uses socket.to(roomCode).emit for disconnect-warning, NOT io.to(roomCode).emit.
 *   socket.to excludes the disconnecting sender. The disconnected socket cannot receive anyway,
 *   but using socket.to matches the Socket.io documented exclude-sender pattern and avoids
 *   the io.to anti-pattern called out in RESEARCH.md.
 * - Reads socket.data.roomCode/playerSlot in disconnect handler, NEVER socket.rooms
 *   (RESEARCH.md Pitfall 2: socket.rooms may be async-emptied before handler runs).
 */

import type {
  BenchEntry,
  ClientToServerEvents,
  DraftPickPayload,
  DraftPoolId,
  DraftRearrangePayload,
  FormationId,
  GameSpeed,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
  TeamId,
  TeamType,
  UniformStyleId,
} from '@counter-attack/shared';
import {
  ClientEvents,
  ServerEvents,
  UNIFORM_STYLE_META,
  FORMATIONS,
  PLAYER_POOL,
  SELECTABLE_DRAFT_POOLS,
  getSquadPlayers,
} from '@counter-attack/shared';
import type { Server, Socket } from 'socket.io';
import { randomInt } from 'crypto';
import { buildInitialGameState, computeAutoAssignment } from './gameEngine.js';
import { broadcastState, createRoom, deleteRoom, getRoom, joinRoom } from './roomStore.js';
import type { Room } from './roomStore.js';
import { generateMatchPacks } from './draftPacks.js';
import {
  createDraftSession,
  openNextRound,
  applyPick,
  applyRearrange,
  advanceSubStep,
  assignBenchNumbers,
  buildDraftView,
} from './draftSession.js';
import type { DraftSide } from './draftSession.js';

/** Valid team IDs — allow-list for team:pick validation (ASVS V5, T-21-01: extended to 12 teams in Phase 21). */
const VALID_TEAM_IDS: readonly TeamId[] = [
  'city',
  'crew',
  'la',
  'miami',
  'nashville',
  'seattle',
  'canada',
  'england',
  'france',
  'mexico',
  'spain',
  'us',
] as const;

/** Valid game speed values — allow-list for team:speed-set validation (ASVS V5, T-18.4.1-01). */
const VALID_GAME_SPEEDS: readonly GameSpeed[] = ['slow', 'standard', 'fast'] as const;

/** Valid team type values — allow-list for ROOM_SETTINGS_CONFIRM validation (DRAFT-01/T-27-04, ASVS V5). */
const VALID_TEAM_TYPES: readonly TeamType[] = ['standard', 'draft'] as const;

/** Valid uniform style IDs — allow-list for UNIFORM_CONFIRM validation (T-22-03). */
const VALID_UNIFORM_STYLE_IDS: readonly UniformStyleId[] = Object.keys(
  UNIFORM_STYLE_META,
) as UniformStyleId[];

/** Valid formation IDs — allow-list for UNIFORM_CONFIRM formationId validation (T-23-03 / ASVS V5). */
const VALID_FORMATION_IDS: readonly FormationId[] = ['4-4-2', '5-3-2', '4-3-3', '3-4-3'] as const;

/** Valid jersey type values — allow-list for UNIFORM_CONFIRM jerseyType validation. */
const VALID_JERSEY_TYPES: readonly string[] = ['home', 'away'] as const;

/** 90-second grace period before disconnected player's room is deleted. */
const GRACE_PERIOD_MS = 90_000;

/** Typed Socket alias for the project's four generic parameters. */
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/** Typed Server alias for the project's four generic parameters. */
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * T-29-05/D-14: unicasts each player's own privacy-scoped DraftClientView. NEVER
 * `io.to(roomCode).emit` — a player's pack contents must never reach the opponent's socket.
 * No-op if the room has no draftSession (defensive — callers only invoke this when one exists).
 */
function emitDraftViews(io: AppServer, room: Room): void {
  if (!room.draftSession) return;
  const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
  const awaySocket = io.sockets.sockets.get(room.players[1]!.socketId);
  homeSocket?.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room.draftSession, 'home'));
  awaySocket?.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room.draftSession, 'away'));
}

/**
 * Registers room lifecycle event handlers on a socket.
 *
 * @param io          - The Socket.io Server instance (for room-wide broadcasts)
 * @param socket      - The connecting/reconnecting socket
 * @param reconnectOnly - When true, only the disconnect handler is registered (reconnect path).
 *                        ROOM_CREATE and ROOM_JOIN are skipped — they must not fire on a
 *                        reconnect because the player is already in a room (RESEARCH.md Pitfall 3).
 *
 * CONN-01: ROOM_CREATE path — creates room, assigns slot 1, emits ROOM_JOINED with sessionToken.
 * CONN-02: ROOM_JOIN path — joins room, assigns slot 2, emits ROOM_JOINED+token to joiner only; notifies others without token.
 * CONN-03: After slot-2 join, emits TEAM_SELECTION_START to whole room (Phase 16 D-10).
 * CONN-04: Error paths emit distinct ROOM_ERROR reasons (NOT_FOUND vs NOT_WAITING).
 * ARCH-01: Slot assigned server-side only; client never specifies or confirms slot.
 * ARCH-04: broadcastState always sends the full GameState snapshot (no differential patching).
 * SC-3:    Disconnect handler stores timer; reconnect path in createServer.ts cancels it.
 * TEAM-01: TEAM_PICK handler enforces home-first turn order and allow-list validation.
 * TEAM-02: isProcessing mutex prevents concurrent TEAM_PICK processing.
 */
export function registerRoomHandlers(
  io: AppServer,
  socket: AppSocket,
  reconnectOnly: boolean,
): void {
  if (!reconnectOnly) {
    // -----------------------------------------------------------------------
    // ROOM_CREATE
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.ROOM_CREATE, () => {
      // WR-02: idempotency guard — prevent a client from creating multiple rooms per socket.
      // Without this, each extra ROOM_CREATE call would write a new room to the store and
      // overwrite socket.data.roomCode, leaving the previous room orphaned indefinitely.
      if (socket.data.roomCode !== undefined) {
        socket.emit(ServerEvents.ROOM_ERROR, 'ALREADY_IN_ROOM');
        return;
      }

      // CR-02: createRoom throws if it cannot generate a unique code after 5 attempts.
      // Socket.io does not catch synchronous throws in event handlers — an uncaught
      // error here would crash the Node process. Catch and surface to the client instead.
      let roomCode: string;
      let sessionToken: string;
      try {
        ({ roomCode, sessionToken } = createRoom(socket.id));
      } catch {
        socket.emit(ServerEvents.ROOM_ERROR, 'SERVER_ERROR');
        return;
      }

      // Persist room context on the socket so the disconnect handler can find
      // the room without reading socket.rooms (RESEARCH.md Pitfall 2).
      socket.data.roomCode = roomCode;
      socket.data.playerSlot = 1;
      socket.data.sessionToken = sessionToken;

      void socket.join(roomCode);

      // CONN-01: emit ROOM_JOINED to this socket with slot=1 and sessionToken.
      // Third parameter (sessionToken) is the Plan 03-03 widening — client stores
      // it in localStorage for reconnect via socket.handshake.auth.sessionToken.
      socket.emit(ServerEvents.ROOM_JOINED, roomCode, 1, sessionToken);
    });

    // -----------------------------------------------------------------------
    // ROOM_JOIN
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.ROOM_JOIN, (roomCode: string) => {
      // T-03-08: defensive validation — client-supplied roomCode must be a non-empty string.
      if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
        socket.emit(ServerEvents.ROOM_ERROR, 'INVALID_CODE');
        return;
      }

      // WR-01: normalize to uppercase so mixed-case input ("abcde") finds room "ABCDE".
      // All generated codes use the Crockford uppercase alphabet; case-sensitive lookup
      // silently fails for clients without a text-transform constraint on the input field.
      const normalizedCode = roomCode.trim().toUpperCase();

      const result = joinRoom(normalizedCode, socket.id);

      if (!result.ok) {
        // CONN-04: emit distinct reason strings so the client can show different messages.
        // NOT_FOUND → room code unknown; NOT_WAITING → room already in-progress or ended.
        socket.emit(ServerEvents.ROOM_ERROR, result.reason);
        return;
      }

      // Success path: slot 2 assigned by server (ARCH-01).
      socket.data.roomCode = normalizedCode;
      socket.data.playerSlot = 2;
      socket.data.sessionToken = result.sessionToken;

      void socket.join(normalizedCode);

      // CONN-02: send ROOM_JOINED to the joining socket (slot 2) with their credential.
      // Do NOT use io.to(roomCode).emit — that would broadcast result.sessionToken to
      // player 1's socket as well, allowing impersonation via reconnect (CR-01 fix).
      socket.emit(ServerEvents.ROOM_JOINED, normalizedCode, 2, result.sessionToken);

      // Notify the existing player(s) that slot 2 has joined without exposing the token.
      // Empty string satisfies the typed event signature; client ignores the token field
      // on this "room is full / game starting" notification.
      socket.to(normalizedCode).emit(ServerEvents.ROOM_JOINED, normalizedCode, 2, '');

      // DRAFT-01/D-01/D-02/T-27-05 (Phase 27): TEAM_SELECTION_START is gated on BOTH
      // "host has confirmed settings" AND "slot 2 has joined" (this join). If the host
      // has not confirmed settings yet, do nothing further here — the ROOM_SETTINGS_CONFIRM
      // handler below fires TEAM_SELECTION_START once the host confirms, since room.players[1]
      // is already non-null by then (Pitfall 1: without this gate, a fast-joining client
      // would reach team selection with unset settings).
      const joinedRoom = getRoom(normalizedCode);
      if (joinedRoom?.settingsConfirmed) {
        // D-02: deliver the host's already-confirmed settings to the late-joining player.
        socket.emit(
          ServerEvents.ROOM_SETTINGS_CONFIRMED,
          joinedRoom.gameSpeed!,
          joinedRoom.teamType!,
          joinedRoom.draftPools ?? [],
          joinedRoom.outOfBoundsEnabled ?? false,
          // Phase 39: Fouls/Booking/Injury toggles. undefined (not yet confirmed) is
          // treated as false (disabled), mirroring outOfBoundsEnabled's fallback above.
          joinedRoom.foulsEnabled ?? false,
          joinedRoom.bookingEnabled ?? false,
          joinedRoom.injuryEnabled ?? false,
          // TACKLE-01 (Phase 43): Tackle/Steal decline-prompt toggle. undefined (not yet
          // confirmed) is treated as false (disabled), mirroring the toggles above.
          joinedRoom.tackleStealDeclineEnabled ?? false,
          // REFEREE-01/02 (Phase 44): Referee Leniency override flag/value. undefined (not
          // yet confirmed) is treated as false/4, mirroring the toggles above (T-44-14).
          joinedRoom.refereeLeniencyOverrideEnabled ?? false,
          joinedRoom.refereeLeniencyValue ?? 4,
        );
        // CONN-03 (Phase 16 D-10): emit TEAM_SELECTION_START to all room members.
        // GameState is NOT built yet — it is created only after both teams are picked via TEAM_PICK.
        // Do NOT call broadcastState here; room.gameState is null at this point.
        io.to(normalizedCode).emit(ServerEvents.TEAM_SELECTION_START);
      }
    });

    // -----------------------------------------------------------------------
    // LEAVE_ROOM
    // BUG-33 (Phase 36) / D-01..D-05: host abandons the pre-game settings screen.
    // Terminal action — deletes the room immediately server-side instead of relying on
    // the 90s disconnect grace timer (D-03/Pitfall 6). No payload: the room code to
    // delete is read only from socket.data.roomCode, so a client can never supply
    // (and therefore never spoof) an arbitrary room code to delete (T-36-01, ASVS V3/V4).
    // No isProcessing mutex: this is terminal, nothing is left to race against, and a
    // repeated deleteRoom on an already-removed key is a safe no-op (T-36-04).
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.LEAVE_ROOM, () => {
      const roomCode = socket.data.roomCode;
      if (roomCode === undefined) return;

      // CR-02 (Phase 36 review): mirror the room.gameState !== null guard every other
      // room-mutating handler in this file applies (see TEAM_SPEED_SET, ROOM_SETTINGS_CONFIRM
      // above) — LEAVE_ROOM is documented as "host abandons the pre-game settings screen" but
      // previously had no guard verifying that, letting any connected socket (home or away, at
      // any point including mid-match) delete an active match's room out from under the
      // opponent. If the room is already gone, or has an in-progress match, do nothing further.
      const room = getRoom(roomCode);
      if (room && room.gameState !== null) return;

      // CR-01 (Phase 36 review): notify any other room member before the room disappears
      // out from under them — deleteRoom below never emits anything on its own, and without
      // this the other socket is left stranded on its current screen with a roomCode that
      // now points at nothing (every handler's `getRoom` guard silently drops their events).
      if (room) socket.to(roomCode).emit(ServerEvents.ROOM_ERROR, 'ROOM_CLOSED');

      deleteRoom(roomCode);
      void socket.leave(roomCode);

      // exactOptionalPropertyTypes: assigning `undefined` to an optional field is a type
      // error distinct from the field being absent — use `delete` to fully clear it.
      delete socket.data.roomCode;
      delete socket.data.playerSlot;
      delete socket.data.sessionToken;
    });

    // -----------------------------------------------------------------------
    // TEAM_PICK
    // Phase 16 TEAM-01/TEAM-02: enforces home-first turn order, allow-list
    // validation, isProcessing mutex, and builds game state after both picks.
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.TEAM_PICK, (teamId: TeamId) => {
      const roomCode = socket.data.roomCode;
      if (roomCode === undefined) return;

      const room = getRoom(roomCode);
      if (!room) return;

      // SC-5 / TEAM-02: isProcessing mutex — drop concurrent TEAM_PICK events.
      if (room.isProcessing) return;
      room.isProcessing = true;
      try {
        // ASVS V5: allow-list validation — reject unknown or forged team IDs.
        if (!(VALID_TEAM_IDS as readonly string[]).includes(teamId)) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TEAM');
          return;
        }

        const playerSlot = socket.data.playerSlot;

        if (room.homePickedTeam === undefined) {
          // Home picks first — only slot 1 may act now (TEAM-01).
          if (playerSlot !== 1) {
            socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
            return;
          }
          // Record home pick, broadcast to all so away sees which team was taken.
          room.homePickedTeam = teamId;
          io.to(roomCode).emit(ServerEvents.TEAM_HOME_PICKED, teamId);
        } else {
          // Away picks second — only slot 2 may act now (TEAM-01).
          if (playerSlot !== 2) {
            socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
            return;
          }
          // Away cannot pick the same team home already picked.
          if (teamId === room.homePickedTeam) {
            socket.emit(ServerEvents.GAME_ERROR, 'TEAM_ALREADY_PICKED');
            return;
          }
          // Phase 22 D-13: defer game state build — store away's team and broadcast
          // UNIFORM_SELECTION_START. Game state is built after both players confirm
          // team + uniform style via UNIFORM_CONFIRM (plan 22-02 UNIFORM_CONFIRM handler).
          room.awayPickedTeam = teamId;
          io.to(roomCode).emit(ServerEvents.UNIFORM_SELECTION_START);
        }
      } finally {
        room.isProcessing = false;
      }
    });

    // -----------------------------------------------------------------------
    // TEAM_SPEED_SET
    // UX-07 (Phase 18.4): home player sets the game speed before match start.
    // T-18.4.1-01: allow-list validates against ['slow','standard','fast'].
    // T-18.4.1-02: only the home player (slot 1) may set speed — mirrors home-first
    //              turn-order enforcement in TEAM_PICK.
    // WR-01 (Phase 27 review): no current client build emits this event anymore —
    // ROOM_SETTINGS_CONFIRM (below) is the only UI path to setting game speed, and it
    // locks speed + team type + draft pools together atomically via
    // room.settingsConfirmed (D-03). This handler is kept wired (rather than removed,
    // see WR-02) as a defensive fallback for a stale client build that could still emit
    // the raw socket event; the settingsConfirmed guard below ensures it can never
    // bypass the atomic lock even if reached.
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.TEAM_SPEED_SET, (speed: GameSpeed) => {
      const roomCode = socket.data.roomCode;
      if (roomCode === undefined) return;

      const room = getRoom(roomCode);
      if (!room) return;

      // WR-01: reject once settings have been locked via ROOM_SETTINGS_CONFIRM —
      // otherwise this legacy handler could silently bypass the D-03 atomic lock.
      if (room.settingsConfirmed) {
        socket.emit(ServerEvents.GAME_ERROR, 'SETTINGS_ALREADY_CONFIRMED');
        return;
      }

      // T-18.4.1-01: allow-list validation — reject unknown or forged speed values.
      if (!(VALID_GAME_SPEEDS as readonly string[]).includes(speed)) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SPEED');
        return;
      }

      // T-18.4.1-02: only home player (slot 1) may set speed.
      if (socket.data.playerSlot !== 1) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
        return;
      }

      // Guard: speed can only be set before the game starts. Once gameState is built
      // (both teams picked), gameState.gameSpeed is frozen in the engine — updating
      // room.gameSpeed after that would diverge the UI from the actual running speed.
      if (room.gameState !== null) {
        socket.emit(ServerEvents.GAME_ERROR, 'GAME_ALREADY_STARTED');
        return;
      }

      // Record the speed on the room — consumed by TEAM_PICK away-pick.
      room.gameSpeed = speed;
      // Broadcast to both players so the visitor's display updates live.
      io.to(roomCode).emit(ServerEvents.TEAM_SPEED_CHANGED, speed);
    });

    // -----------------------------------------------------------------------
    // ROOM_SETTINGS_CONFIRM
    // DRAFT-01/D-01/D-02/D-03 (Phase 27): host confirms speed + team type + draft pools
    // atomically on the pre-game settings screen. Host-only, one-shot lock, allow-list
    // validated (T-27-01..T-27-05). On success, gates TEAM_SELECTION_START on
    // "slot 2 has joined" — mirrors the ROOM_JOIN-side gate on "settings confirmed"
    // (see ROOM_JOIN above) to close the settings-confirmed/joiner-present race (Pitfall 1).
    // -----------------------------------------------------------------------
    socket.on(
      ClientEvents.ROOM_SETTINGS_CONFIRM,
      ({
        speed,
        teamType,
        draftPools,
        outOfBounds,
        fouls,
        booking,
        injury,
        tackleStealDecline,
        refereeLeniencyOverride,
        refereeLeniencyValue,
      }: {
        speed: GameSpeed;
        teamType: TeamType;
        draftPools: DraftPoolId[];
        outOfBounds: boolean;
        /** SETTINGS-01 (Phase 39): Fouls system game-creation toggle. */
        fouls: boolean;
        /** SETTINGS-02 (Phase 39): Booking (cards) game-creation toggle. */
        booking: boolean;
        /** SETTINGS-03 (Phase 39): Injury system game-creation toggle. */
        injury: boolean;
        /** TACKLE-01 (Phase 43): Tackle/Steal decline-prompt game-creation toggle. */
        tackleStealDecline: boolean;
        /** REFEREE-01 (Phase 44): manual Referee Leniency override game-creation toggle. */
        refereeLeniencyOverride: boolean;
        /** REFEREE-02 (Phase 44): host-selected Leniency value, integer 2-5. */
        refereeLeniencyValue: number;
      }) => {
        const roomCode = socket.data.roomCode;
        if (roomCode === undefined) return;

        const room = getRoom(roomCode);
        if (!room) return;

        // D-03/T-27-03: settings lock after the first confirm — reject before any mutation.
        if (room.settingsConfirmed) {
          socket.emit(ServerEvents.GAME_ERROR, 'SETTINGS_ALREADY_CONFIRMED');
          return;
        }

        // T-27-01: only the host (slot 1) may confirm settings.
        if (socket.data.playerSlot !== 1) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
          return;
        }

        // Guard: settings can only be confirmed before the game starts.
        if (room.gameState !== null) {
          socket.emit(ServerEvents.GAME_ERROR, 'GAME_ALREADY_STARTED');
          return;
        }

        // ASVS V5: allow-list validation — reject unknown or forged speed/teamType values.
        if (!(VALID_GAME_SPEEDS as readonly string[]).includes(speed)) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SPEED');
          return;
        }
        if (!(VALID_TEAM_TYPES as readonly string[]).includes(teamType)) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TEAM_TYPE');
          return;
        }

        // T-37-08 (Phase 37): ASVS V5 allow-list guard — reject a forged non-boolean
        // outOfBounds payload before any room mutation.
        if (typeof outOfBounds !== 'boolean') {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_OUT_OF_BOUNDS');
          return;
        }

        // T-39-03-01 (Phase 39): ASVS V5 allow-list guards — reject a forged non-boolean
        // fouls/booking/injury payload before any room mutation. Three separate guards
        // with distinct error codes (mirroring INVALID_SPEED/INVALID_TEAM_TYPE/
        // INVALID_OUT_OF_BOUNDS above) so the client error surface names the offending
        // field, rather than one combined check.
        if (typeof fouls !== 'boolean') {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_FOULS');
          return;
        }
        if (typeof booking !== 'boolean') {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_BOOKING');
          return;
        }
        if (typeof injury !== 'boolean') {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_INJURY');
          return;
        }

        // T-43-07 (Phase 43): ASVS V5 allow-list guard — reject a forged non-boolean
        // tackleStealDecline payload before any room mutation, mirroring the guards above.
        if (typeof tackleStealDecline !== 'boolean') {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TACKLE_STEAL_DECLINE');
          return;
        }

        // T-44-04 (Phase 44): ASVS V5 allow-list guard — reject a forged non-boolean
        // refereeLeniencyOverride payload before any room mutation, mirroring the guards above.
        if (typeof refereeLeniencyOverride !== 'boolean') {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_REFEREE_LENIENCY_OVERRIDE');
          return;
        }

        // T-44-05 (Phase 44): ASVS V5 allow-list guard — reject a forged out-of-range,
        // non-integer, or non-numeric refereeLeniencyValue. Number.isInteger already
        // returns false for non-numbers, NaN, and Infinity, so it subsumes a separate
        // typeof check. Validated UNCONDITIONALLY — not only when refereeLeniencyOverride
        // is true — deliberately diverging from the conditional shape sketched in
        // PATTERNS.md: the client always sends a value (the stepper never unmounts, D-04),
        // so no legitimate client can trip an unconditional guard, while a conditional
        // guard would let a forged payload persist an arbitrary number on the Room that a
        // later code path could activate.
        if (
          !Number.isInteger(refereeLeniencyValue) ||
          refereeLeniencyValue < 2 ||
          refereeLeniencyValue > 5
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_REFEREE_LENIENCY_VALUE');
          return;
        }

        // T-27-04: draft-pool requirement only applies in draft mode.
        // T-30-01/D-08: validate against SELECTABLE_DRAFT_POOLS (now 5 values — legends/icons
        // admitted per Phase 30 D-08) rather than any hardcoded pool-name literal. This is the
        // single source of truth shared with the client's checkbox gating.
        if (teamType === 'draft') {
          if (!Array.isArray(draftPools) || draftPools.length < 1) {
            socket.emit(ServerEvents.GAME_ERROR, 'DRAFT_POOL_REQUIRED');
            return;
          }
          if (
            !draftPools.every((pool) =>
              (SELECTABLE_DRAFT_POOLS as readonly string[]).includes(pool),
            )
          ) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_DRAFT_POOL');
            return;
          }
          // IN-03 (Phase 27 review): reject duplicate entries — the checkbox UI can
          // never produce them, but a hand-crafted socket payload
          // (draftPools: ['original', 'original']) would otherwise pass the allow-list
          // check above and get stored/broadcast as-is.
          if (new Set(draftPools).size !== draftPools.length) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_DRAFT_POOL');
            return;
          }
        }

        // DRAFT-07/D-04 (Phase 29): bootstrap a DraftSession the moment draft mode is
        // locked in. generateMatchPacks produces the 8 packs; createDraftSession performs
        // its OWN independent crypto.randomInt pack-to-player index shuffle internally
        // (D-04/Pitfall 5) — never slice packs[0-3]/[4-7] here.
        //
        // T-36-07 (Phase 36): generateMatchPacks can throw D-11's loud "insufficient
        // tiered supply" error — a shortfall surviving both the D-08 same-pool cascade
        // and D-09's common-only cross-pool fallback is genuinely reachable from a
        // client-selected pool combination (BUG-35 sharpens this risk by removing the
        // old unrestricted cross-pool safety valve). Socket.io does not catch synchronous
        // throws inside an event handler (CR-02 precedent, ROOM_CREATE above) — an
        // uncaught throw here would crash the whole Node process, killing every other
        // room on the server, not just this one. Computing the draft session BEFORE any
        // room-state mutation means a throw here leaves room.settingsConfirmed/
        // draftSession/teamType/draftPools entirely untouched, so the room stays in its
        // pre-confirm state and the host can retry with a different pool selection.
        let draftSession: ReturnType<typeof createDraftSession> | undefined;
        if (teamType === 'draft') {
          try {
            const { packs } = generateMatchPacks(draftPools);
            draftSession = createDraftSession(packs, randomInt);
          } catch {
            socket.emit(ServerEvents.GAME_ERROR, 'DRAFT_SUPPLY_EXHAUSTED');
            return;
          }
        }

        // Store settings and lock.
        room.gameSpeed = speed;
        room.teamType = teamType;
        room.draftPools = teamType === 'draft' ? draftPools : [];
        room.outOfBoundsEnabled = outOfBounds;
        room.foulsEnabled = fouls;
        // SETTINGS-02/03 (T-39-03-03): server-side normalisation — Booking/Injury have no
        // effect unless Fouls is enabled. The client already normalises this in
        // handleConfirm, but the server must not trust it; a modified client sending
        // fouls:false, booking:true must still land bookingEnabled:false here.
        room.bookingEnabled = fouls && booking;
        room.injuryEnabled = fouls && injury;
        // TACKLE-01: no parent-toggle dependency (unlike Booking/Injury above) — stored as-is.
        room.tackleStealDeclineEnabled = tackleStealDecline;
        // REFEREE-01/02: unlike Booking/Injury, Referee Leniency has no dependency on any
        // other toggle — no parent-toggle normalisation applies; both are stored as validated.
        room.refereeLeniencyOverrideEnabled = refereeLeniencyOverride;
        room.refereeLeniencyValue = refereeLeniencyValue;
        room.settingsConfirmed = true;
        if (draftSession !== undefined) {
          room.draftSession = draftSession;
        }

        io.to(roomCode).emit(
          ServerEvents.ROOM_SETTINGS_CONFIRMED,
          room.gameSpeed,
          room.teamType,
          room.draftPools,
          room.outOfBoundsEnabled,
          room.foulsEnabled,
          room.bookingEnabled,
          room.injuryEnabled,
          room.tackleStealDeclineEnabled,
          room.refereeLeniencyOverrideEnabled,
          // ?? 4 satisfies the required `number` positional type; only reachable if the
          // field were somehow unset, in which case the flag is also false and the value
          // is inert.
          room.refereeLeniencyValue ?? 4,
        );

        // T-27-05/Pitfall 1: both-conditions gate — only fire TEAM_SELECTION_START once
        // slot 2 has also joined. If not, the ROOM_JOIN handler's settingsConfirmed gate
        // fires it later when the joiner arrives.
        if (room.players[1] !== null) {
          io.to(roomCode).emit(ServerEvents.TEAM_SELECTION_START);
        }
      },
    );

    // -----------------------------------------------------------------------
    // UNIFORM_CONFIRM
    // Phase 22 D-14/D-15, extended Phase 23 D-12: enforces home-first confirm order,
    // allow-list validation, isProcessing mutex. Home confirm stores homePickedUniformStyle
    // and homePickedFormation, broadcasts UNIFORM_HOME_CONFIRMED. Away confirm builds
    // formation-driven game state (selectedFormation on GameState), broadcasts GAME_STATE,
    // and ALSO emits BOTH_FORMATIONS_CONFIRMED (Phase 24 listens to this for auto-assignment).
    // Threat mitigations: T-22-03/T-23-03 (allow-lists), T-22-04 (home-first),
    // T-22-05 (mutex), T-22-06 (buildInitialGameState error guard).
    // -----------------------------------------------------------------------
    socket.on(
      ClientEvents.UNIFORM_CONFIRM,
      (
        teamId: TeamId,
        uniformStyle: UniformStyleId,
        formationId: FormationId,
        jerseyType: 'home' | 'away',
      ) => {
        const roomCode = socket.data.roomCode;
        if (roomCode === undefined) return;

        const room = getRoom(roomCode);
        if (!room) return;

        // T-22-05: isProcessing mutex — drop concurrent UNIFORM_CONFIRM events.
        if (room.isProcessing) return;
        room.isProcessing = true;
        try {
          // T-22-03: allow-list validation — reject unknown or forged teamId/uniformStyle.
          if (!(VALID_TEAM_IDS as readonly string[]).includes(teamId)) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TEAM');
            return;
          }
          if (!(VALID_UNIFORM_STYLE_IDS as readonly string[]).includes(uniformStyle)) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_STYLE');
            return;
          }
          // T-23-03: allow-list validation — reject unknown or forged formationId (ASVS V5).
          if (!(VALID_FORMATION_IDS as readonly string[]).includes(formationId)) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_FORMATION');
            return;
          }
          // allow-list validation — reject unknown or forged jerseyType.
          const safeJerseyType: 'home' | 'away' = VALID_JERSEY_TYPES.includes(jerseyType)
            ? jerseyType
            : 'home';

          const playerSlot = socket.data.playerSlot;

          if (room.homePickedUniformStyle === undefined) {
            // T-22-04: Home confirms first — only slot 1 may act now.
            if (playerSlot !== 1) {
              socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
              return;
            }
            // Phase 22 D-15: store home's confirmed style and team; broadcast to both players.
            // homePickedTeam is also set here so UNIFORM_CONFIRM works without a prior TEAM_PICK.
            room.homePickedTeam = teamId;
            room.homePickedUniformStyle = uniformStyle;
            room.homePickedFormation = formationId;
            room.homePickedJerseyType = safeJerseyType;
            io.to(roomCode).emit(
              ServerEvents.UNIFORM_HOME_CONFIRMED,
              teamId,
              uniformStyle,
              formationId,
            );
          } else {
            // T-22-04: Away confirms second — only slot 2 may act now.
            if (playerSlot !== 2) {
              socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
              return;
            }
            // Reject if away picks the same team as home.
            if (teamId === room.homePickedTeam) {
              socket.emit(ServerEvents.GAME_ERROR, 'TEAM_ALREADY_PICKED');
              return;
            }
            // Phase 23 D-12 / Phase 24 D-07: store away's team, formation, and uniform
            // style (Phase 24 addition — previously not needed because buildInitialGameState
            // was called immediately; now deferred to LINEUP_CONFIRM).
            // buildInitialGameState is NOT called here — game deferred to LINEUP_CONFIRM.
            room.awayPickedTeam = teamId;
            room.awayPickedFormation = formationId;
            room.awayPickedUniformStyle = uniformStyle;
            room.awayPickedJerseyType = safeJerseyType;

            // Phase 23 D-12 / Phase 24 contract: BOTH_FORMATIONS_CONFIRMED broadcast FIRST
            // so clients set myFormationId before LINEUP_ASSIGNMENT_READY/DRAFT_STATE_UPDATED
            // routes them to the next screen (ordering fix — emitting READY first caused a
            // null formationId crash). Identical for both team types.
            io.to(roomCode).emit(
              ServerEvents.BOTH_FORMATIONS_CONFIRMED,
              room.homePickedFormation!,
              formationId,
            );

            const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
            const awaySocket = io.sockets.sockets.get(room.players[1]!.socketId);

            // Pitfall 2 (RESEARCH.md): Draft-mode rooms must NOT run Standard-mode's
            // computeAutoAssignment (that would pre-fill an 11-player lineup from the
            // real team squad, not the drafted-pool cards, before the draft even starts).
            if (room.teamType === 'draft') {
              // D-11: empty formation shell — LINEUP_CONFIRM still references these arrays
              // once the draft completes and slots are filled in by DRAFT_PICK/DRAFT_REARRANGE.
              room.homeAssignment = Array(11).fill(null) as string[];
              room.awayAssignment = Array(11).fill(null) as string[];

              // Open round-1 (GK) packs for both players now that both formations are locked in.
              room.draftSession = openNextRound(room.draftSession!);

              // D-14/Pitfall privacy: unicast each player's own view — never io.to(roomCode).emit.
              // Do NOT emit LINEUP_ASSIGNMENT_READY here — the client routes to the draft
              // screen off DRAFT_STATE_UPDATED instead (coordinated with Plan 05).
              homeSocket?.emit(
                ServerEvents.DRAFT_STATE_UPDATED,
                buildDraftView(room.draftSession, 'home'),
              );
              awaySocket?.emit(
                ServerEvents.DRAFT_STATE_UPDATED,
                buildDraftView(room.draftSession, 'away'),
              );
            } else {
              // Phase 24 ASSIGN-01: compute auto-assignment for each team.
              // PlayerId[] of 11 entries; assignment[i] maps to FORMATIONS[formationId].slots[i].
              const homeSquad = getSquadPlayers(room.homePickedTeam!);
              const awaySquad = getSquadPlayers(teamId);
              room.homeAssignment = computeAutoAssignment(
                homeSquad,
                FORMATIONS[room.homePickedFormation!].slots,
              ).map((p) => p.id);
              room.awayAssignment = computeAutoAssignment(
                awaySquad,
                FORMATIONS[formationId].slots,
              ).map((p) => p.id);

              // Phase 24 D-07 / D-12: emit LINEUP_ASSIGNMENT_READY to each socket individually.
              // Never io.to(roomCode).emit — assignment data is private per player (D-12).
              homeSocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.homeAssignment);
              awaySocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.awayAssignment);
            }
          }
        } finally {
          room.isProcessing = false;
        }
      },
    );

    // -----------------------------------------------------------------------
    // LINEUP_SWAP
    // Phase 24 D-08/D-09/ASSIGN-03/04: swap two outfield slot entries in the
    // emitter's team assignment. GK slot (index 0) is immovable (T-24-01).
    // Validates: both indices in [0,10], neither is 0, assignment exists (phase guard).
    // Emits LINEUP_ASSIGNMENT_UPDATED to requester socket only (D-12 privacy).
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.LINEUP_SWAP, (payload: { slotIndexA: number; slotIndexB: number }) => {
      const roomCode = socket.data.roomCode;
      if (roomCode === undefined) return;

      const room = getRoom(roomCode);
      if (!room) return;

      // SC-5 / mutex: drop concurrent events.
      if (room.isProcessing) return;
      room.isProcessing = true;
      try {
        const { slotIndexA, slotIndexB } = payload;

        // Determine which assignment array this player may mutate (T-24-03 spoofing guard).
        const playerSlot = socket.data.playerSlot;
        const assignment = playerSlot === 1 ? room.homeAssignment : room.awayAssignment;

        // WRONG_PHASE guard: assignments not yet computed.
        if (!assignment) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
          return;
        }

        // T-24-02: INVALID_SLOT_INDEX — both indices must be integers in [0, 10].
        if (
          !Number.isInteger(slotIndexA) ||
          !Number.isInteger(slotIndexB) ||
          slotIndexA < 0 ||
          slotIndexA > 10 ||
          slotIndexB < 0 ||
          slotIndexB > 10
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SLOT_INDEX');
          return;
        }

        // T-24-01: GK_SLOT_LOCKED — GK slot (index 0) is immovable (D-09).
        if (slotIndexA === 0 || slotIndexB === 0) {
          socket.emit(ServerEvents.GAME_ERROR, 'GK_SLOT_LOCKED');
          return;
        }

        // Perform the swap in place.
        const tmp = assignment[slotIndexA]!;
        assignment[slotIndexA] = assignment[slotIndexB]!;
        assignment[slotIndexB] = tmp;

        // Emit updated assignment to the requesting socket only (D-12 privacy).
        socket.emit(ServerEvents.LINEUP_ASSIGNMENT_UPDATED, assignment);
      } finally {
        room.isProcessing = false;
      }
    });

    // -----------------------------------------------------------------------
    // LINEUP_CONFIRM
    // Phase 24 D-10/ASSIGN-05/D-11: mark this player's lineup as confirmed.
    // Ignores the client's confirmedOrder payload — uses server-stored assignment
    // (ASVS V5 tamper-prevention, T-24-04). Does NOT use a home-first sequential
    // gate — either player may confirm first (D-25 corrected).
    // When BOTH flags are true: resolve PlayerId[] → PoolPlayer[], call
    // buildInitialGameState with confirmed-order params (D-11), broadcastState.
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.LINEUP_CONFIRM, (_payload: { confirmedOrder: string[] }) => {
      const roomCode = socket.data.roomCode;
      if (roomCode === undefined) return;

      const room = getRoom(roomCode);
      if (!room) return;

      // SC-5 / mutex: drop concurrent events.
      if (room.isProcessing) return;
      room.isProcessing = true;
      try {
        const isDraftRoom = room.teamType === 'draft' && room.draftSession != null;

        // WRONG_PHASE guard: assignments not yet computed (Standard mode only — draft mode
        // sources its starting order from draftSession.*LineupSlots instead, checked below).
        if (!isDraftRoom && (!room.homeAssignment || !room.awayAssignment)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
          return;
        }

        const playerSlot = socket.data.playerSlot;

        // Gap-closure Plan 07 (T-29-07-03): for draft rooms, resolve the confirming side's
        // starting order from the server-held draftSession — never from room.*Assignment
        // (which stays an Array(11).fill(null) shell for the lifetime of a draft room) and
        // never from the client's confirmedOrder payload (T-29-07-02/ASVS V5). Reject BEFORE
        // setting the confirmed flag if the confirming side's resolved starting order has any
        // unfilled slot or any id that fails to resolve against PLAYER_POOL — this prevents an
        // undefined player from ever reaching buildInitialGameState. Both sides pass this same
        // check independently (each on its own LINEUP_CONFIRM), so by the time both
        // homeLineupConfirmed/awayLineupConfirmed are true, both starting orders are known-complete.
        const resolveDraftOrder = (
          lineupSlots: (string | null)[],
        ): import('@counter-attack/shared').PoolPlayer[] | null => {
          const resolved: import('@counter-attack/shared').PoolPlayer[] = [];
          for (const id of lineupSlots) {
            if (id === null) return null;
            const player = PLAYER_POOL.find((p) => p.id === id);
            if (!player) return null;
            resolved.push(player);
          }
          return resolved;
        };

        if (isDraftRoom) {
          const session = room.draftSession!;

          // Phase 29 Plan 11 (CR-01): a draft is only mechanically complete once
          // draftSession.draftComplete flips (round 6 / 17 cards) — all 11 lineup slots
          // can fill before the final round completes while bench picks are still pending.
          // Reject BEFORE the slot-completeness check and BEFORE setting the confirmed
          // flag, or a full-but-incomplete draft could start a match a round early.
          if (!session.draftComplete) {
            socket.emit(ServerEvents.GAME_ERROR, 'DRAFT_NOT_COMPLETE');
            return;
          }

          const side = playerSlot === 1 ? 'home' : 'away';
          const slotsToCheck = side === 'home' ? session.homeLineupSlots : session.awayLineupSlots;
          if (resolveDraftOrder(slotsToCheck) === null) {
            socket.emit(ServerEvents.GAME_ERROR, 'LINEUP_INCOMPLETE');
            return;
          }
        }

        // Set the confirming player's flag (idempotent — setting true twice is fine).
        if (playerSlot === 1) {
          room.homeLineupConfirmed = true;
        } else {
          room.awayLineupConfirmed = true;
        }

        // Both-confirm gate (Pitfall 4): only start game when BOTH flags are true.
        if (!room.homeLineupConfirmed || !room.awayLineupConfirmed) {
          return; // still waiting for the other player
        }

        let confirmedHomeOrder: import('@counter-attack/shared').PoolPlayer[];
        let confirmedAwayOrder: import('@counter-attack/shared').PoolPlayer[];

        if (isDraftRoom) {
          const session = room.draftSession!;
          // Both sides already passed the per-side completeness check above (on their own
          // confirm) before their flag was set — resolveDraftOrder cannot return null here.
          confirmedHomeOrder = resolveDraftOrder(session.homeLineupSlots)!;
          confirmedAwayOrder = resolveDraftOrder(session.awayLineupSlots)!;
        } else {
          // D-11: resolve stored PlayerId[] → PoolPlayer[] in assignment order.
          // Server ignores client's confirmedOrder — uses room.*Assignment (ASVS V5).
          confirmedHomeOrder = room.homeAssignment!.map(
            (id) => PLAYER_POOL.find((p) => p.id === id)!,
          );
          confirmedAwayOrder = room.awayAssignment!.map(
            (id) => PLAYER_POOL.find((p) => p.id === id)!,
          );
        }

        // Phase 40 (SUB-02/07, D-01/D-02): compute each team's bench — the roster minus the
        // starting 11 — for hand-off into live GameState. Server-authoritative source only:
        // draft rooms read the drafted-but-unplaced session bench ids; standard rooms read
        // the full squad filtered against the confirmed starting assignment. Never sourced
        // from the client's confirmedOrder payload (T-40-11, mirrors the starting-XI stance
        // already documented above).
        let confirmedHomeBench: BenchEntry[];
        let confirmedAwayBench: BenchEntry[];

        if (isDraftRoom) {
          const session = room.draftSession!;
          confirmedHomeBench = session.homeBenchIds.map((id) => ({
            playerId: id,
            jerseyNumber: session.homeBenchNumbers[id] ?? 0,
            status: 'available' as const,
          }));
          confirmedAwayBench = session.awayBenchIds.map((id) => ({
            playerId: id,
            jerseyNumber: session.awayBenchNumbers[id] ?? 0,
            status: 'available' as const,
          }));
        } else {
          // Every non-draft squad in PLAYER_POOL holds exactly 11 players today, so this list
          // comes out EMPTY for standard rooms. Per D-12 the empty case is deliberately NOT
          // special-cased anywhere: no pool is consulted, no substitute is generated — the
          // substitution screen simply shows "no available substitutes" until a future phase
          // expands rosters. This is expected behavior, not a gap.
          const homeAssignedIds = new Set(room.homeAssignment ?? []);
          const awayAssignedIds = new Set(room.awayAssignment ?? []);
          confirmedHomeBench = getSquadPlayers(room.homePickedTeam!)
            .filter((p) => !homeAssignedIds.has(p.id))
            .map((p) => ({ playerId: p.id, jerseyNumber: p.number, status: 'available' as const }));
          confirmedAwayBench = getSquadPlayers(room.awayPickedTeam!)
            .filter((p) => !awayAssignedIds.has(p.id))
            .map((p) => ({ playerId: p.id, jerseyNumber: p.number, status: 'available' as const }));
        }

        // D-11: build game state from the confirmed player orderings.
        // All required fields were stored on room during UNIFORM_CONFIRM.
        let gameState: import('@counter-attack/shared').GameState;
        try {
          gameState = buildInitialGameState(
            roomCode,
            { home: room.homePickedTeam!, away: room.awayPickedTeam! },
            room.gameSpeed ?? 'standard',
            { home: room.homePickedUniformStyle!, away: room.awayPickedUniformStyle! },
            { home: room.homePickedFormation!, away: room.awayPickedFormation! },
            {
              home: room.homePickedJerseyType ?? 'home',
              away: room.awayPickedJerseyType ?? 'away',
            },
            confirmedHomeOrder,
            confirmedAwayOrder,
            room.outOfBoundsEnabled ?? false,
            room.foulsEnabled ?? false,
            room.bookingEnabled ?? false,
            room.injuryEnabled ?? false,
            room.tackleStealDeclineEnabled ?? false,
            confirmedHomeBench,
            confirmedAwayBench,
            room.refereeLeniencyOverrideEnabled ?? false,
            // Passed raw (no `??`): the engine param is `?: number` and treats `undefined`
            // as "no override", which is the correct fail-closed meaning.
            room.refereeLeniencyValue,
          );
        } catch (err) {
          console.error('buildInitialGameState failed in LINEUP_CONFIRM:', err);
          socket.emit(ServerEvents.GAME_ERROR, 'SERVER_ERROR');
          return;
        }
        room.gameState = gameState;
        broadcastState(io, room);
      } finally {
        room.isProcessing = false;
      }
    });

    // -----------------------------------------------------------------------
    // DRAFT_PICK
    // Phase 29 DRAFT-06/07/08 (T-29-01..T-29-06): drafts `cardId` out of the sender's
    // server-stored current pack and places it at `destination` in one motion. Server is
    // the sole authority on legality — validates card membership, GK-slot role in both
    // directions, and slot-index range before ever delegating to the pure applyPick.
    // Mirrors LINEUP_SWAP's mutex/spoofing-guard/private-emit skeleton exactly.
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.DRAFT_PICK, (payload: DraftPickPayload) => {
      const roomCode = socket.data.roomCode;
      if (roomCode === undefined) return;

      const room = getRoom(roomCode);
      if (!room) return;

      // T-29-04 / SC-5: isProcessing mutex — drop concurrent/replayed DRAFT_PICK events.
      if (room.isProcessing) return;
      room.isProcessing = true;
      try {
        // NOT_DRAFTING guard: no session yet, or already complete.
        if (!room.draftSession || room.draftSession.draftComplete) {
          socket.emit(ServerEvents.GAME_ERROR, 'NOT_DRAFTING');
          return;
        }

        // T-29-02: resolve side from socket.data ONLY — never from any client payload field.
        const side: DraftSide = socket.data.playerSlot === 1 ? 'home' : 'away';

        // Phase 29 Plan 11 (CR-02): mirror DRAFT_REARRANGE's lifecycle guard — once the
        // requesting side has confirmed its lineup, or the match has already started
        // (room.gameState set), a DRAFT_PICK is tampering, not a legal in-progress pick.
        // Without this guard, a post-kickoff DRAFT_PICK could mutate draftSession and yank
        // both clients back to the draft screen via emitDraftViews below.
        const requesterConfirmed =
          side === 'home' ? room.homeLineupConfirmed : room.awayLineupConfirmed;
        if (requesterConfirmed || room.gameState !== null) {
          socket.emit(ServerEvents.GAME_ERROR, 'LINEUP_ALREADY_CONFIRMED');
          return;
        }

        const { cardId, destination } = payload;

        // T-29-06: allow-list slotIndex range before touching any state.
        if (
          destination.type === 'slot' &&
          (!Number.isInteger(destination.slotIndex) ||
            destination.slotIndex < 0 ||
            destination.slotIndex > 10)
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SLOT_INDEX');
          return;
        }

        // T-29-01: card must resolve against the server's own pool — never trust a
        // client-echoed card shape. applyPick below separately enforces that the card is
        // actually present in the SENDER's own current pack (INVALID_CARD).
        const card = PLAYER_POOL.find((p) => p.id === cardId);
        if (!card) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_CARD');
          return;
        }

        // D-09/Pitfall 4: GK-slot role rule enforced in BOTH directions.
        if (destination.type === 'slot') {
          const formationId = side === 'home' ? room.homePickedFormation : room.awayPickedFormation;
          // CR-01: room.draftSession exists as soon as ROOM_SETTINGS_CONFIRM locks in draft
          // mode — well before either side's UNIFORM_CONFIRM sets a formation. Without this
          // guard, FORMATIONS[undefined] throws synchronously and crashes the whole process
          // (single-instance server — every in-progress match goes down, not just this room).
          if (!formationId) {
            socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
            return;
          }
          const slotRole = FORMATIONS[formationId].slots[destination.slotIndex]!.slotRole;
          if (slotRole === 'GK' && card.role !== 'GK') {
            socket.emit(ServerEvents.GAME_ERROR, 'GK_SLOT_REQUIRES_GK');
            return;
          }
          if (slotRole !== 'GK' && card.role === 'GK') {
            socket.emit(ServerEvents.GAME_ERROR, 'NON_GK_SLOT_REJECTS_GK');
            return;
          }
        }

        const result = applyPick(room.draftSession, side, cardId, destination);
        if (!result.ok) {
          socket.emit(ServerEvents.GAME_ERROR, result.error ?? 'INVALID_CARD');
          return;
        }
        room.draftSession = result.session;

        room.draftSession = advanceSubStep(room.draftSession);

        // D-15/D-16/D-23: on the transition into draftComplete, assign bench numbers once.
        if (room.draftSession.draftComplete) {
          room.draftSession = {
            ...room.draftSession,
            homeBenchNumbers: assignBenchNumbers(room.draftSession.homeBenchIds, randomInt),
            awayBenchNumbers: assignBenchNumbers(room.draftSession.awayBenchIds, randomInt),
          };
        }

        // D-14: both players' views may have changed (packs may have swapped) — unicast both.
        emitDraftViews(io, room);
      } finally {
        room.isProcessing = false;
      }
    });

    // -----------------------------------------------------------------------
    // DRAFT_REARRANGE
    // Phase 29 D-08/D-10: moves an ALREADY-DRAFTED card between lineup slot(s) and/or the
    // bench. Never touches cycle/subStep/picksRemaining (D-10) — carries NO move logic of
    // its own, mirroring how DRAFT_PICK delegates placement to applyPick.
    // Gap-closure Plan 07 (T-29-07-01): rearrangement remains legal AFTER draftComplete —
    // the whole point of D-08/D-15 is that a player can freely arrange lineup/bench once
    // the draft ends and before they confirm. Only reject when there is no session at all,
    // or when the REQUESTING side has already locked in (confirmed lineup) or the match has
    // already started (room.gameState set) — resolved from socket.data.playerSlot, never a
    // client-supplied field (T-29-02).
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.DRAFT_REARRANGE, (payload: DraftRearrangePayload) => {
      const roomCode = socket.data.roomCode;
      if (roomCode === undefined) return;

      const room = getRoom(roomCode);
      if (!room) return;

      if (room.isProcessing) return;
      room.isProcessing = true;
      try {
        if (!room.draftSession) {
          socket.emit(ServerEvents.GAME_ERROR, 'NOT_DRAFTING');
          return;
        }

        // T-29-02: resolve side from socket.data ONLY.
        const side: DraftSide = socket.data.playerSlot === 1 ? 'home' : 'away';

        // T-29-07-01: lifecycle guard — once the requesting side has confirmed its lineup,
        // or the match has started, rearrangement is tampering, not a legal pre-confirm move.
        const requesterConfirmed =
          side === 'home' ? room.homeLineupConfirmed : room.awayLineupConfirmed;
        if (requesterConfirmed || room.gameState !== null) {
          socket.emit(ServerEvents.GAME_ERROR, 'LINEUP_ALREADY_CONFIRMED');
          return;
        }

        const { from, to } = payload;

        // T-29-06: allow-list slot indices on both ends before touching any state.
        const refs = [from, to];
        for (const ref of refs) {
          if (
            ref.type === 'slot' &&
            (!Number.isInteger(ref.slotIndex) || ref.slotIndex < 0 || ref.slotIndex > 10)
          ) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SLOT_INDEX');
            return;
          }
        }

        // D-09: enforce the GK-slot role rule in both directions when the destination is a
        // lineup slot. Resolve the moving card's identity from whichever side it currently
        // occupies (slot or bench) before delegating to applyRearrange.
        if (to.type === 'slot') {
          const session = room.draftSession;
          const lineupSlots = side === 'home' ? session.homeLineupSlots : session.awayLineupSlots;
          const benchIds = side === 'home' ? session.homeBenchIds : session.awayBenchIds;
          const movingCardId =
            from.type === 'slot' ? lineupSlots[from.slotIndex] : benchIds[from.benchIndex];
          const movingCard = movingCardId
            ? PLAYER_POOL.find((p) => p.id === movingCardId)
            : undefined;
          if (movingCard) {
            const formationId =
              side === 'home' ? room.homePickedFormation : room.awayPickedFormation;
            // WR-01: same guard as CR-01's DRAFT_PICK fix — today this branch is only reached
            // once a card already sits in lineupSlots/benchIds, which coincidentally can't
            // happen before a formation exists, but that invariant is incidental, not
            // structural. Guard explicitly rather than relying on it holding forever.
            if (!formationId) {
              socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
              return;
            }
            const slotRole = FORMATIONS[formationId].slots[to.slotIndex]!.slotRole;
            if (slotRole === 'GK' && movingCard.role !== 'GK') {
              socket.emit(ServerEvents.GAME_ERROR, 'GK_SLOT_REQUIRES_GK');
              return;
            }
            if (slotRole !== 'GK' && movingCard.role === 'GK') {
              socket.emit(ServerEvents.GAME_ERROR, 'NON_GK_SLOT_REJECTS_GK');
              return;
            }
          }
        }

        const result = applyRearrange(room.draftSession, side, from, to);
        if (!result.ok) {
          socket.emit(ServerEvents.GAME_ERROR, result.error ?? 'INVALID_REARRANGE');
          return;
        }
        room.draftSession = result.session;

        // Requester-private emit only — mirrors LINEUP_SWAP (D-12/D-14 privacy).
        socket.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room.draftSession, side));
      } finally {
        room.isProcessing = false;
      }
    });
  }

  // -----------------------------------------------------------------------
  // disconnect
  // (registered for both fresh connections and reconnects)
  // -----------------------------------------------------------------------
  socket.on('disconnect', () => {
    // RESEARCH.md Pitfall 2: read from socket.data, NEVER from socket.rooms —
    // socket.rooms may be async-emptied by the time this handler runs.
    const { roomCode, playerSlot } = socket.data;

    if (roomCode === undefined || playerSlot === undefined) {
      // Socket never joined a room — no cleanup needed.
      return;
    }

    const room = getRoom(roomCode);
    if (!room) {
      // Room already cleaned up (e.g., both players disconnected sequentially).
      return;
    }

    const slotIndex = playerSlot - 1;

    // SC-3: start the 90-second grace timer. If the player reconnects within 90s,
    // createServer.ts connection handler will cancel this timer via clearTimeout.
    const timer = setTimeout(() => {
      deleteRoom(roomCode);
    }, GRACE_PERIOD_MS);

    room.disconnectTimers[slotIndex] = timer;

    // T-08-15 / Pitfall 4: clear the replay timer on disconnect to prevent
    // post-disconnect frame emission (deleteRoom also clears it, but the
    // 90s grace period means the room may still exist for a while after disconnect).
    if (room.replayTimer) {
      clearInterval(room.replayTimer);
      room.replayTimer = null;
    }

    // Warn the remaining player.
    // RESEARCH.md Anti-Pattern: use socket.to (excludes sender) NOT io.to.
    // The disconnected socket cannot receive anyway, but socket.to is the
    // documented exclude-sender pattern and avoids the io.to anti-pattern.
    socket.to(roomCode).emit(ServerEvents.GAME_DISCONNECT_WARNING);
  });
}
