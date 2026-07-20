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
  ClientToServerEvents,
  DraftPoolId,
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
import { buildInitialGameState, computeAutoAssignment } from './gameEngine.js';
import { broadcastState, createRoom, deleteRoom, getRoom, joinRoom } from './roomStore.js';

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
        );
        // CONN-03 (Phase 16 D-10): emit TEAM_SELECTION_START to all room members.
        // GameState is NOT built yet — it is created only after both teams are picked via TEAM_PICK.
        // Do NOT call broadcastState here; room.gameState is null at this point.
        io.to(normalizedCode).emit(ServerEvents.TEAM_SELECTION_START);
      }
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
    // -----------------------------------------------------------------------
    socket.on(ClientEvents.TEAM_SPEED_SET, (speed: GameSpeed) => {
      const roomCode = socket.data.roomCode;
      if (roomCode === undefined) return;

      const room = getRoom(roomCode);
      if (!room) return;

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
      }: {
        speed: GameSpeed;
        teamType: TeamType;
        draftPools: DraftPoolId[];
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

        // T-27-04: draft-pool requirement only applies in draft mode.
        // T-27-02/Pitfall 3: validate against SELECTABLE_DRAFT_POOLS (3 values), NOT the
        // full 5-value DraftPoolId type — Legends/Icons are disabled client-side only (D-04).
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
        }

        // Store settings and lock.
        room.gameSpeed = speed;
        room.teamType = teamType;
        room.draftPools = teamType === 'draft' ? draftPools : [];
        room.settingsConfirmed = true;

        io.to(roomCode).emit(
          ServerEvents.ROOM_SETTINGS_CONFIRMED,
          room.gameSpeed,
          room.teamType,
          room.draftPools,
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

            // Phase 23 D-12 / Phase 24 contract: BOTH_FORMATIONS_CONFIRMED broadcast FIRST
            // so clients set myFormationId before LINEUP_ASSIGNMENT_READY routes them to the
            // lineup screen (ordering fix — emitting READY first caused a null formationId crash).
            io.to(roomCode).emit(
              ServerEvents.BOTH_FORMATIONS_CONFIRMED,
              room.homePickedFormation!,
              formationId,
            );

            // Phase 24 D-07 / D-12: emit LINEUP_ASSIGNMENT_READY to each socket individually.
            // Never io.to(roomCode).emit — assignment data is private per player (D-12).
            const homeSocket = io.sockets.sockets.get(room.players[0]!.socketId);
            const awaySocket = io.sockets.sockets.get(room.players[1]!.socketId);
            homeSocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.homeAssignment);
            awaySocket?.emit(ServerEvents.LINEUP_ASSIGNMENT_READY, room.awayAssignment);
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
        // WRONG_PHASE guard: assignments not yet computed.
        if (!room.homeAssignment || !room.awayAssignment) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
          return;
        }

        const playerSlot = socket.data.playerSlot;

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

        // D-11: resolve stored PlayerId[] → PoolPlayer[] in assignment order.
        // Server ignores client's confirmedOrder — uses room.*Assignment (ASVS V5).
        const confirmedHomeOrder = room.homeAssignment.map(
          (id) => PLAYER_POOL.find((p) => p.id === id)!,
        );
        const confirmedAwayOrder = room.awayAssignment.map(
          (id) => PLAYER_POOL.find((p) => p.id === id)!,
        );

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
