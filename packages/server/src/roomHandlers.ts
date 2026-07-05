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
  GameSpeed,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
  TeamId,
} from '@counter-attack/shared';
import type { UniformStyleId } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';
import type { Server, Socket } from 'socket.io';
import { buildInitialGameState } from './gameEngine.js';
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

      // CONN-03 (Phase 16 D-10): emit TEAM_SELECTION_START to all room members.
      // GameState is NOT built yet — it is created only after both teams are picked via TEAM_PICK.
      // Do NOT call broadcastState here; room.gameState is null at this point.
      io.to(normalizedCode).emit(ServerEvents.TEAM_SELECTION_START);
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
          // Both teams chosen — build game state and start the game.
          const selectedTeams = { home: room.homePickedTeam, away: teamId };
          // UX-07 (Phase 18.4): use the speed the home player set (or 'standard' if unset).
          // CR-03: wrap in try/catch — a throw from buildInitialGameState (e.g. bad playerIds)
          // would propagate uncaught inside the Socket.io handler and crash the Node process.
          let gameState: import('@counter-attack/shared').GameState;
          // Phase 22 D-17: selectedUniformStyles will be sourced from room.homePickedUniformStyle
          // / room.awayPickedUniformStyle after UNIFORM_CONFIRM flow is added in plan 22-02.
          // Using defaults here to satisfy the required 4th parameter until that flow exists.
          const selectedUniformStyles: { home: UniformStyleId; away: UniformStyleId } = {
            home: 'pinstripes-vertical',
            away: 'bar-diagonal',
          };
          try {
            gameState = buildInitialGameState(
              roomCode,
              selectedTeams,
              room.gameSpeed ?? 'standard',
              selectedUniformStyles,
            );
          } catch (err) {
            console.error('buildInitialGameState failed:', err);
            socket.emit(ServerEvents.GAME_ERROR, 'SERVER_ERROR');
            return;
          }
          room.gameState = gameState;
          broadcastState(io, room);
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
