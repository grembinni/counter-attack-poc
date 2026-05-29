/**
 * Socket.io io.use() middleware for session-token identity restoration.
 *
 * Pattern 3 from RESEARCH.md: runs on every socket connection (new and reconnect).
 * If the client sends a sessionToken in socket.handshake.auth, the server looks it up
 * and re-attaches the player to their room context before the 'connection' event fires.
 *
 * ARCH-01: server-authoritative identity; client cannot self-assign slot.
 * CONN-01: reconnect path complements room creation — token is looked up, never trusted by itself.
 *
 * NEVER calls next(error) — identity restoration is best-effort (graceful fall-through).
 * Brand-new sockets with no token fall through to the connection handler as fresh connects.
 *
 * Source: socket.io/docs/v4/middlewares/ + socket.io/get-started/private-messaging-part-2/
 */

import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@counter-attack/shared';
import type { Socket } from 'socket.io';
import { findPlayerByToken } from './roomStore.js';

/** Typed Socket alias with the project's SocketData generics. */
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Restores session identity from socket.handshake.auth.sessionToken.
 *
 * On a known token: populates socket.data.sessionToken, socket.data.playerSlot,
 * socket.data.roomCode — the Plan 03 connection handler reads these to distinguish
 * reconnects from fresh connects and cancel any pending grace timer.
 *
 * On an unknown/absent token: does NOT mutate socket.data; falls through.
 *
 * Always calls next() with no argument — no connection is ever rejected here.
 *
 * @param socket - The connecting socket
 * @param next - Socket.io middleware next function
 */
export function sessionMiddleware(socket: AppSocket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth['sessionToken'] as string | undefined;

  if (token) {
    const found = findPlayerByToken(token);
    if (found) {
      // Restore slot context for the reconnection path in the connection handler.
      // The connection handler checks socket.data.sessionToken to detect reconnects.
      socket.data.sessionToken = token;
      socket.data.playerSlot = found.slot;
      socket.data.roomCode = found.room.roomCode;
    }
  }

  // Always proceed — new connections have no token; unknown tokens fall through gracefully.
  next();
}
