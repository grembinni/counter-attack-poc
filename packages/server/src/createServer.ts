/**
 * Express + Socket.io server factory for Counter Attack.
 *
 * Pattern 1 from RESEARCH.md: Express app wrapped in http.createServer so Socket.io
 * can attach to the same HTTP server. app.listen() cannot be used here — it creates
 * an independent HTTP server that Socket.io cannot intercept.
 *
 * SC-5: GET /health returns 200 { status: 'ok', timestamp: <ISO> } for AWS ALB health checks.
 * T-03-16: CORS_ORIGIN env var must be set in production; default '*' is dev-only.
 * Pitfall 6: Client MUST also set transports: ['websocket'] — see Phase 6 client integration.
 *
 * Does NOT call httpServer.listen() — that belongs exclusively in main.ts.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@counter-attack/shared';
import cors from 'cors';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerGameHandlers } from './gameHandlers.js';
import { sessionMiddleware } from './sessionMiddleware.js';
import { getRoom } from './roomStore.js';
import { ServerEvents } from '@counter-attack/shared';

/**
 * Builds the Express + Socket.io server without binding to a port.
 *
 * Returns { app, httpServer, io } so tests can import the factory and listen on port 0
 * without side effects. The caller (main.ts) is responsible for httpServer.listen().
 *
 * ARCH-01: server-authoritative state — all slot assignment and identity resolution
 *           happens inside this factory's connection handler, never from client claims.
 * CONN-01..04: room lifecycle wired via registerRoomHandlers inside the connection handler.
 * SC-3: reconnect path cancels the 90s grace timer and re-emits game:state to the socket.
 */
export function buildServer(): {
  app: express.Express;
  httpServer: ReturnType<typeof createServer>;
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
} {
  const app = express();

  // CORS for HTTP routes (e.g. GET /health). Independent of Socket.io's cors option —
  // both must be configured (RESEARCH.md Pitfall 1).
  app.use(cors());

  /**
   * GET /health — SC-5, AWS ALB health check endpoint.
   * Returns { status: 'ok', timestamp: <ISO> } with HTTP 200.
   * No user-controlled input is echoed (T-03-14: no tampering surface).
   */
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);

  // STATE.md decision: websocket-only transport (no polling).
  // Eliminates sticky-session requirement on AWS ALB for single-instance POC.
  // CORS_ORIGIN env var MUST be set in production (T-03-16 Phase 9 hardening).
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: process.env['CORS_ORIGIN'] ?? '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket'],
    },
  );

  // Run session middleware on every connection BEFORE the 'connection' event fires.
  // Guarantees socket.data.sessionToken/playerSlot/roomCode are populated for reconnects
  // when the connection handler executes (Pattern 3 from RESEARCH.md).
  io.use(sessionMiddleware);

  io.on('connection', (socket) => {
    // Reconnect path: middleware has populated socket.data.sessionToken, roomCode, playerSlot.
    // RESEARCH.md Pitfall 3: check sessionToken FIRST to avoid re-running fresh-join logic
    // on reconnect (which would overwrite the existing token and emit a duplicate ROOM_JOINED).
    // Only treat as a reconnect when the game is in-progress (status === 'playing').
    // A 'waiting' room has no game state to restore — fall through to fresh connection so
    // the socket can freely create or join another room.
    if (
      socket.data.sessionToken !== undefined &&
      socket.data.roomCode !== undefined &&
      socket.data.playerSlot !== undefined
    ) {
      const room = getRoom(socket.data.roomCode);
      if (room && room.status === 'playing') {
        const slotIndex = socket.data.playerSlot - 1;

        // SC-3: cancel the grace timer so the room is not deleted.
        const existingTimer = room.disconnectTimers[slotIndex];
        if (existingTimer !== null) {
          clearTimeout(existingTimer);
          room.disconnectTimers[slotIndex] = null;
        }

        // Update the socket ID — the reconnected socket has a new socket.id.
        // RESEARCH.md Anti-Pattern: never use socket.id as stable identity.
        const player = room.players[slotIndex];
        if (player) {
          player.socketId = socket.id;
        }

        // Rejoin Socket.io room — reconnected socket is NOT automatically in the room.
        // RESEARCH.md Anti-Pattern: forgetting socket.join on reconnect silently breaks broadcasts.
        void socket.join(room.roomCode);

        // Re-emit ROOM_JOINED so the client can restore playerSlot and roomCode after a
        // page refresh (store resets to null on reload; server is the source of truth).
        socket.emit(
          ServerEvents.ROOM_JOINED,
          socket.data.roomCode,
          socket.data.playerSlot,
          socket.data.sessionToken,
        );

        // Re-emit game state directly to the reconnecting socket (SC-3).
        // Also notify the other player via socket.to so their disconnect banner dismisses
        // (their onGameState calls setDisconnectWarning(false)). socket.to excludes the
        // sender, so the other player receives it without needing a broadcastState call
        // (which would race against the async socket.join above).
        if (room.gameState !== null) {
          socket.emit(ServerEvents.GAME_STATE, room.gameState);
          socket.to(room.roomCode).emit(ServerEvents.GAME_STATE, room.gameState);
        }

        // Re-register disconnect handler so the reconnected socket can disconnect again.
        registerRoomHandlers(io, socket, true);
        // Re-register game handlers so reconnected sockets can continue mid-game actions.
        registerGameHandlers(io, socket);
      }
      return;
    }

    // Stale token: client has a token but it's not in the room store (server restart).
    // Tell the client so it can clear its session and return to the lobby.
    const clientToken = socket.handshake.auth['sessionToken'] as string | undefined;
    if (clientToken && socket.data.sessionToken === undefined) {
      socket.emit(ServerEvents.ROOM_ERROR, 'SESSION_EXPIRED');
    }

    // Fresh connection path: no session token in handshake.auth.
    registerRoomHandlers(io, socket, false);
    registerGameHandlers(io, socket);
  });

  return { app, httpServer, io };
}
