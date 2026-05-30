/**
 * Socket.io event handlers for game action management.
 *
 * Wires GAME_START_MOVEMENT, GAME_MOVE, GAME_END_TURN, and GAME_UNDO onto a socket.
 * Called from createServer.ts io.on('connection') alongside registerRoomHandlers.
 *
 * ARCH-01: server is the sole authority for all FSM transitions and state mutations.
 * ARCH-04: broadcastState is the single entry point for all state updates — never io.to().emit.
 * SC-5: isProcessing mutex guards every handler; duplicate actions are silently dropped.
 * T-4-01: wrong-team game:move and game:end-turn rejected with GAME_ERROR 'WRONG_TEAM'.
 * T-4-02: isProcessing mutex prevents double-action race (concurrent identical actions).
 * T-4-03: pieceId lookup in applyMove uses server-side piece.position — client from-coord ignored.
 * T-4-04: wrong-team game:end-turn rejected before calling applyEndTurn.
 * T-4-05: game:start-movement restricted to the attacking team's socket.
 *
 * Anti-pattern rationale (RESEARCH.md):
 * - Reads socket.data.playerSlot/roomCode, NEVER socket.rooms (Pitfall 2).
 * - isProcessing released in finally — never conditionally (Pitfall 5).
 * - Player slot 1 controls 'home'; slot 2 controls 'away'.
 *   attackingTeam (coin flip) determines who acts first, not slot→team mapping.
 */

import type {
  ClientToServerEvents,
  HexCoord,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';
import type { Server, Socket } from 'socket.io';
import { broadcastState, getRoom } from './roomStore.js';
import { applyEndTurn, applyMove, applyStartMovement, applyUndo } from './gameEngine.js';
import type { Room } from './roomStore.js';
import type { GameState } from '@counter-attack/shared';

/** Typed Socket alias for the project's four generic parameters. */
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/** Typed Server alias for the project's four generic parameters. */
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Maps the socket's player slot to its controlled team.
 * Slot 1 = 'home'; slot 2 = 'away'. Convention is fixed regardless of coin-flip result.
 */
function socketTeam(socket: AppSocket): 'home' | 'away' {
  return socket.data.playerSlot === 1 ? 'home' : 'away';
}

/**
 * Returns the team allowed to act in the current movement slot.
 * ATTACKER_4 and ATTACKER_2 → attackingTeam; DEFENDER_5 → non-attacking team.
 */
function actingTeam(state: GameState): 'home' | 'away' {
  if (state.movementSlot === 'DEFENDER_5') {
    return state.attackingTeam === 'home' ? 'away' : 'home';
  }
  return state.attackingTeam;
}

/**
 * Returns true when the socket's controlled team is the team currently allowed to act.
 * T-4-01 / T-4-04: gates game:move and game:end-turn.
 */
function isActivePlayer(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null) return false;
  return socketTeam(socket) === actingTeam(room.gameState);
}

/**
 * Returns true when the socket's controlled team is the attacking team.
 * T-4-05: gates game:start-movement (only the attacking team may start the Movement Phase).
 */
function controlsAttackingTeam(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null) return false;
  return socketTeam(socket) === room.gameState.attackingTeam;
}

/**
 * Registers game action event handlers on a socket.
 *
 * Called from createServer.ts for both fresh and reconnected sockets so
 * mid-game reconnects can continue sending actions.
 *
 * @param io     - Socket.io Server instance (for broadcastState)
 * @param socket - The socket to register handlers on
 */
export function registerGameHandlers(io: AppServer, socket: AppSocket): void {
  // -------------------------------------------------------------------------
  // GAME_START_MOVEMENT — transitions KICK_OFF → MOVEMENT/ATTACKER_4
  // T-4-05: only the attacking team's socket may start the Movement Phase
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_START_MOVEMENT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'KICK_OFF') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // D-06: snap-back
        return;
      }
      if (!controlsAttackingTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM'); // T-4-05
        broadcastState(io, room);
        return;
      }
      const result = applyStartMovement(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_MOVE — applies a piece movement
  // T-4-01: non-acting player is rejected; T-4-03: from-coord is server-derived
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_MOVE, (pieceId: string, to: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5

    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'MOVEMENT') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM'); // T-4-01
        broadcastState(io, room);
        return;
      }
      const result = applyMove(room.gameState, pieceId, to);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // D-06: snap-back on rejection
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_END_TURN — advances the movement slot (D-03) or transitions to PASS (D-04)
  // T-4-04: non-acting player is rejected
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_END_TURN, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5

    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'MOVEMENT') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM'); // T-4-04
        broadcastState(io, room);
        return;
      }
      const result = applyEndTurn(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_UNDO — reverses the last move in the current slot (D-09, D-10)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_UNDO, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5

    room.isProcessing = true;
    try {
      if (room.gameState === null) {
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyUndo(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false;
    }
  });
}
