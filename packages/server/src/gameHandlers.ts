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
import {
  applyEndTurn,
  applyGKRestart,
  applyMove,
  applyRoll,
  applyStartMovement,
  applyUndo,
} from './gameEngine.js';
import { rollDice } from './diceUtils.js';
import type { Room } from './roomStore.js';
import type { GameState } from '@counter-attack/shared';

/** Typed Socket alias for the project's four generic parameters. */
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Phases that require a dice roll from the active player.
 * GK_RESTART is handled by the separate game:gk-restart handler (Plan 03, D-12/D-22).
 */
const DICE_PHASES = new Set<string>(['PASS', 'SHOT', 'HEADER', 'LOOSE_BALL']);

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
 * Returns true when the socket's controlled team is the GK's team.
 *
 * The GK team is derived from ball.carrierId — in GK_RESTART the ball carrier is the GK.
 * This avoids reading socket.rooms (Pitfall 2) and avoids a separate gkTeam state field.
 * T-05-07: gates game:gk-restart (only the GK's team may restart).
 *
 * Open Question 3 resolution: GK team derived from ball ownership, not a stored field.
 */
function controlsGKTeam(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null || room.gameState.ball.carrierId === null) return false;
  const gkPiece = room.gameState.pieces.find((p) => p.id === room.gameState!.ball.carrierId);
  if (!gkPiece) return false;
  return socketTeam(socket) === gkPiece.teamId;
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
      // CR-02: undo is only valid during the MOVEMENT phase; guard symmetrically with other handlers
      if (room.gameState === null || room.gameState.phase !== 'MOVEMENT') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
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

  // -------------------------------------------------------------------------
  // GAME_ROLL — rolls dice and resolves the current stochastic phase
  // T-05-03: WRONG_TEAM guard rejects non-active sockets before dice are generated
  // T-05-04: WRONG_PHASE guard limits resolution to DICE_PHASES (PASS/SHOT/HEADER/LOOSE_BALL)
  // T-05-05: isProcessing mutex prevents double-click race (SC-5)
  // D-10: single broadcastState after each resolution (ARCH-04)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_ROLL, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard — must be in a dice-requiring phase (T-05-04)
      if (room.gameState === null || !DICE_PHASES.has(room.gameState.phase)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Team guard — must be the active player (T-05-03)
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // Pre-generate all dice the branch may need (Pitfall 4 — upfront, before any validator call)
      const d1 = rollDice();
      const d2 = rollDice();
      const d3 = rollDice();
      const result = applyRoll(room.gameState, d1, d2, d3);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04: single broadcast entry point
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_SHOT — records the shooter's chosen target hex (D-06)
  //
  // D-06: game:shot records the shooter's target hex for UX/broadcast.
  // Dice resolution is unchanged — applyRoll resolves shooter-vs-GK from dice
  // only and does not consume shotTarget. This handler records intent; the Roll
  // button's game:roll handler performs (and broadcasts) the resolution.
  //
  // T-07-11: phase + team guards prevent out-of-phase / wrong-team target recording
  // T-07-12: HexCoord shape validation rejects malformed payloads (ASVS V5)
  // T-07-13: shotTarget is UX/broadcast bookkeeping only — never fed into dice resolution
  // SC-5: isProcessing mutex prevents double-click race
  // NOTE: intentionally does NOT call broadcastState — recording shot intent is
  //       server-side UX bookkeeping and should not trigger a full state snapshot.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_SHOT, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard (T-07-11): must be in SHOT phase
      if (room.gameState === null || room.gameState.phase !== 'SHOT') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        return; // NOTE: no broadcastState — this handler never broadcasts (D-06 revision)
      }
      // Team guard (T-07-11): must be the active (shooting) player
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        return; // NOTE: no broadcastState
      }
      // Payload validation (T-07-12): never trust client input (ASVS V5)
      // Mirrors GAME_GK_RESTART INVALID_CHOICE validation style
      if (
        typeof targetHex !== 'object' ||
        targetHex === null ||
        typeof targetHex.q !== 'number' ||
        typeof targetHex.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        return; // NOTE: no broadcastState
      }
      // Record the shooter's target hex for UX/broadcast (T-07-13: no game advantage possible)
      room.shotTarget = { q: targetHex.q, r: targetHex.r };
      // Intentionally no broadcastState call — see handler header (D-06 revision)
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_GK_RESTART — GK team chooses kick/throw/movement after a save catch
  // T-05-07: controlsGKTeam guard — only the GK's team may restart
  // T-05-08: choice payload validated against allowed values before dispatch (ASVS V5)
  // T-05-09: phase guard requires GK_RESTART (D-23)
  // T-05-10: isProcessing mutex prevents double-click race (SC-5)
  // D-10: single broadcastState after each resolution (ARCH-04)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_GK_RESTART, (choice: 'kick' | 'throw' | 'movement') => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard (T-05-09): must be in GK_RESTART (D-23)
      if (room.gameState === null || room.gameState.phase !== 'GK_RESTART') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Team guard (T-05-07): must be the GK's team — derived from ball.carrierId (Open Q3)
      if (!controlsGKTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // Payload validation (T-05-08): never trust client input (ASVS V5)
      if (!['kick', 'throw', 'movement'].includes(choice)) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_CHOICE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Dispatch: pass rollDice as the injected die function (pure engine, deterministic tests)
      const result = applyGKRestart(room.gameState, choice, rollDice);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04: single broadcast entry point
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });
}
