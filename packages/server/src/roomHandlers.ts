/**
 * Socket.io event handlers for room lifecycle management.
 *
 * Wires ROOM_CREATE, ROOM_JOIN, and the disconnect handler onto a socket.
 * Called from createServer.ts io.on('connection') for fresh connections,
 * and also (disconnect-only) for reconnected sockets.
 *
 * CONN-01: ROOM_CREATE emits ROOM_JOINED(roomCode, slot=1, sessionToken) to the creator.
 * CONN-02: ROOM_JOIN on success emits ROOM_JOINED(roomCode, slot=2, sessionToken) to both players.
 * CONN-03: Slot-2 join immediately calls broadcastState(io, room) — game starts automatically.
 * CONN-04: ROOM_JOIN guards NOT_FOUND and NOT_WAITING with distinct ROOM_ERROR reason strings.
 * ARCH-01: Server assigns slots deterministically; client never supplies a slot value.
 * ARCH-04: broadcastState emits the full GameState snapshot after every state change.
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
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';
import type { Server, Socket } from 'socket.io';
import { broadcastState, createRoom, deleteRoom, getRoom, joinRoom } from './roomStore.js';

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
 * CONN-02: ROOM_JOIN path — joins room, assigns slot 2, broadcasts ROOM_JOINED to both players.
 * CONN-03: After slot-2 join, broadcastState emits LOBBY GameState — game starts automatically.
 * CONN-04: Error paths emit distinct ROOM_ERROR reasons (NOT_FOUND vs NOT_WAITING).
 * ARCH-01: Slot assigned server-side only; client never specifies or confirms slot.
 * ARCH-04: broadcastState always sends the full GameState snapshot (no differential patching).
 * SC-3:    Disconnect handler stores timer; reconnect path in createServer.ts cancels it.
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
      const { roomCode, sessionToken } = createRoom(socket.id);

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

      const result = joinRoom(roomCode, socket.id);

      if (!result.ok) {
        // CONN-04: emit distinct reason strings so the client can show different messages.
        // NOT_FOUND → room code unknown; NOT_WAITING → room already in-progress or ended.
        socket.emit(ServerEvents.ROOM_ERROR, result.reason);
        return;
      }

      // Success path: slot 2 assigned by server (ARCH-01).
      socket.data.roomCode = roomCode;
      socket.data.playerSlot = 2;
      socket.data.sessionToken = result.sessionToken;

      void socket.join(roomCode);

      // CONN-02: broadcast ROOM_JOINED to the entire room so BOTH players hear it.
      // This is the "both players are now in the room" signal for the client.
      io.to(roomCode).emit(ServerEvents.ROOM_JOINED, roomCode, 2, result.sessionToken);

      // CONN-03 + ARCH-04: broadcast stub LOBBY GameState to both players immediately.
      // Game starts automatically when both players have joined.
      const room = getRoom(roomCode);
      if (room) {
        broadcastState(io, room);
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

    // Warn the remaining player.
    // RESEARCH.md Anti-Pattern: use socket.to (excludes sender) NOT io.to.
    // The disconnected socket cannot receive anyway, but socket.to is the
    // documented exclude-sender pattern and avoids the io.to anti-pattern.
    socket.to(roomCode).emit(ServerEvents.GAME_DISCONNECT_WARNING);
  });
}
