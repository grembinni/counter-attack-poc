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
import {
  ClientEvents,
  ELIGIBLE_NEXT_ACTIONS,
  PITCH_HEXES,
  PITCH_REGIONS,
  ServerEvents,
  hexDistance,
  hexLine,
  validatePass,
} from '@counter-attack/shared';
import type { Server, Socket } from 'socket.io';
import { broadcastState, getRoom } from './roomStore.js';
import {
  applyCancelMovement,
  applyDeclareShot,
  applyEndTurn,
  applyGKDive,
  applyGKKickTarget,
  applyGKRestart,
  applyHalfTimeStart,
  applyKickOffReady,
  applyMove,
  applyQuickThrow,
  applyResolveHeaderTarget,
  applyRestartMovement,
  applyRoll,
  applySnapshot,
  applyStartMovement,
  applyUndo,
  buildKickOffPieces,
  buildReplayFrames,
  computeHeaderDuelWinner,
  computeShotPathDeflection,
} from './gameEngine.js';
import type { DefenderDeflectionInput } from './gameEngine.js';
import { rollDice } from './diceUtils.js';
import type { Room } from './roomStore.js';
import type { ActionEvent, GamePhase, GameState } from '@counter-attack/shared';

/** Typed Socket alias for the project's four generic parameters. */
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Phases that require a dice roll from the active player.
 * GK_RESTART is handled by the separate game:gk-restart handler (Plan 03, D-12/D-22).
 */
const DICE_PHASES = new Set<string>(['KICK_OFF', 'PASS', 'HEADER', 'LOOSE_BALL']);

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
 * Returns the team allowed to act. state.activeTeam is always authoritative —
 * it is correct for D-30 (loose ball pickup mid-slot) and HIGH_PASS_MOVEMENT.
 */
function actingTeam(state: GameState): 'home' | 'away' {
  return state.activeTeam;
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
 * In GK_DIVING phase: the GK's team is the defending team (non-attacking team).
 * In GK_RESTART phase: derived from ball.carrierId (the GK holds the ball after a save).
 * This avoids reading socket.rooms (Pitfall 2) and avoids a separate gkTeam state field.
 * T-05-07: gates game:gk-restart (only the GK's team may restart).
 * T-10-08: gates GAME_GK_DIVE (only the defending/GK team may dive).
 *
 * Open Question 3 resolution: GK team derived from ball ownership for GK_RESTART;
 * derived from attackingTeam for GK_DIVING (ball carrier is the shooter, not the GK).
 */
function controlsGKTeam(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null) return false;
  // In GK_DIVE the ball carrier is the shooter; derive GK team from attackingTeam instead
  if (room.gameState.phase === 'GK_DIVE') {
    const defendingTeam: 'home' | 'away' =
      room.gameState.attackingTeam === 'home' ? 'away' : 'home';
    return socketTeam(socket) === defendingTeam;
  }
  // GK_RESTART: GK holds the ball — derive from ball.carrierId
  if (room.gameState.ball.carrierId === null) return false;
  const gkPiece = room.gameState.pieces.find((p) => p.id === room.gameState!.ball.carrierId);
  if (!gkPiece) return false;
  return socketTeam(socket) === gkPiece.teamId;
}

/**
 * Starts the post-game replay stream after FULL_TIME.
 *
 * D-30 / D-31 / D-32 / REPLAY-01: After a ~3s FULL_TIME display, streams one
 * GameState frame per second via setInterval. Each frame carries phase='REPLAY',
 * replayIndex (1-based), and replayTotal so the client can show progress.
 *
 * T-08-15: The interval handle is stored on room.replayTimer so it can be
 * cleared on disconnect (roomHandlers.ts) and on room deletion (deleteRoom).
 *
 * D-15 (CR-01 BLOCKER): The setTimeout callback re-fetches the live room via
 * getRoom(room.roomCode) to avoid holding a stale reference to a room that may
 * have been deleted during the 3s hold (e.g. both players disconnected). If the
 * room is gone or its gameState is null when the callback fires, the interval is
 * never created and the callback exits silently.
 *
 * @param io   - Socket.io Server instance (for room-wide emit)
 * @param room - The room that just reached FULL_TIME
 */
function startReplayStream(io: AppServer, room: Room): void {
  if (room.gameState === null) return;

  // ~3s delay so the FULL_TIME screen displays before replay begins (Open Question 3)
  // D-15 CR-01: frames are built inside the callback so we work with the live room,
  // not a stale closure reference.
  setTimeout(() => {
    // D-15 CR-01: re-fetch the live room — if deleted during the 3s hold, bail out.
    const liveRoom = getRoom(room.roomCode);
    if (!liveRoom || liveRoom.gameState === null) return;

    const frames = buildReplayFrames(liveRoom.gameState);
    const replayTotal = frames.length;
    let idx = 0;
    liveRoom.replayTimer = setInterval(() => {
      if (idx >= frames.length) {
        clearInterval(liveRoom.replayTimer!);
        liveRoom.replayTimer = null;
        return;
      }
      const frame = frames[idx++]!;
      // D-32: emit REPLAY-phase frame with position metadata (D-31, D-33)
      // Cast needed because exactOptionalPropertyTypes treats spread as losing required guarantees
      const replayFrame: import('@counter-attack/shared').GameState = {
        ...frame,
        replayIndex: idx, // 1-based (idx already incremented)
        replayTotal,
      };
      io.to(liveRoom.roomCode).emit(ServerEvents.GAME_STATE, replayFrame);
    }, 500);
  }, 3000);
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
  // GAME_START_MOVEMENT — transitions KICK_OFF or PASS → MOVEMENT/ATTACKER_4
  // T-4-05: only the attacking team's socket may start the Movement Phase
  // From KICK_OFF: sets kickOffActive=true (first pass must come from centre hex).
  // From PASS: starts a new 4-5-2 movement sequence without kickoff constraints.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_START_MOVEMENT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      if (
        room.gameState === null ||
        (room.gameState.phase !== 'KICK_OFF' &&
          room.gameState.phase !== 'PASS' &&
          room.gameState.phase !== 'LOOSE_BALL')
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // D-06: snap-back
        return;
      }
      if (!controlsAttackingTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM'); // T-4-05
        broadcastState(io, room);
        return;
      }
      // D-07 / T-08-12: sequence guard — MOVEMENT is invalid after HIGH_PASS (D-11)
      if (
        room.gameState.lastActionType !== null &&
        !ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('MOVEMENT')
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
        broadcastState(io, room);
        return;
      }
      const result = applyStartMovement(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      // D-27 / MATCH-03: kickOffActive only applies on the KICK_OFF → MOVEMENT transition.
      // From PASS, movement restarts without forcing the first pass from the centre hex.
      const kickOffActive = room.gameState.phase === 'KICK_OFF';
      room.gameState = { ...result.state, kickOffActive };
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
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }

      // HIGH_PASS_MOVE: simple piece repositioning — 1 piece per team, max 3 hexes, no ball movement.
      if (room.gameState.phase === 'HIGH_PASS_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const hpState = room.gameState;
        const piece = hpState.pieces.find((p) => p.id === pieceId);
        if (!piece || piece.teamId !== hpState.activeTeam) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // Only one piece per slot: lock to the first piece moved
        const lockedId = hpState.highPassMovedPieceId ?? null;
        if (lockedId !== null && lockedId !== pieceId) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PIECE');
          broadcastState(io, room);
          return;
        }
        const paceUsed = hpState.highPassPaceUsed ?? 0;
        if (paceUsed >= 3) {
          socket.emit(ServerEvents.GAME_ERROR, 'PACE_EXCEEDED');
          broadcastState(io, room);
          return;
        }
        if (hexDistance(piece.position, to) !== 1) {
          socket.emit(ServerEvents.GAME_ERROR, 'NOT_ADJACENT');
          broadcastState(io, room);
          return;
        }
        if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) {
          socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
          broadcastState(io, room);
          return;
        }
        if (
          hpState.pieces.some(
            (p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r,
          )
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'OCCUPIED');
          broadcastState(io, room);
          return;
        }
        const hpMoveEvent: ActionEvent = {
          type: 'HP_MOVE',
          slot: hpState.highPassMovementSlot === 'ATTACKER' ? 'ATTACKER' : 'DEFENDER',
          pieceId,
          from: piece.position,
          to,
          timestamp: Date.now(),
        };
        room.gameState = {
          ...hpState,
          pieces: hpState.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p)),
          highPassMovedPieceId: pieceId,
          highPassPaceUsed: paceUsed + 1,
          eventLog: [...hpState.eventLog, hpMoveEvent],
        };
        broadcastState(io, room);
        return;
      }

      // SNAPSHOT_DEFLECT: defending team moves 1 player up to 2 hexes before snapshot resolves.
      // 1 piece per team, max 2-hex total budget, pitch boundary, no occupied hex.
      // Active team = defending team (opponent of attackingTeam). D-08 / SNAP-02.
      // BUGFIX (snapshot-shot-flow-mismatch): previously required strict adjacency
      // (1 hex per click), forcing hex-by-hex movement unlike GK_DIVE's single-click
      // targeting for regular/headed shots. Now accepts a single click to any hex within
      // the remaining 2-hex budget, consuming the full distance moved in one step — matching
      // GK_DIVE's "click a spot directly" UX while preserving the 2-hex total budget.
      if (room.gameState.phase === 'SNAPSHOT_DEFLECT') {
        const sdState = room.gameState;
        const defendingTeam: 'home' | 'away' = sdState.attackingTeam === 'home' ? 'away' : 'home';
        // Guard: only the defending team may deflect
        if (socketTeam(socket) !== defendingTeam) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const sdPiece = sdState.pieces.find((p) => p.id === pieceId);
        if (!sdPiece || sdPiece.teamId !== defendingTeam) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // Lock to the first piece moved this phase
        const lockedId = sdState.snapDeflectMovedPieceId ?? null;
        if (lockedId !== null && lockedId !== pieceId) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PIECE');
          broadcastState(io, room);
          return;
        }
        // Max 2 hexes total — a single click may use any remaining budget at once.
        const paceUsed = sdState.snapDeflectPaceUsed ?? 0;
        const paceRemaining = 2 - paceUsed;
        if (paceRemaining <= 0) {
          socket.emit(ServerEvents.GAME_ERROR, 'PACE_EXCEEDED');
          broadcastState(io, room);
          return;
        }
        // Distance check: click distance must be within remaining budget (1 or 2 hexes).
        const clickDistance = hexDistance(sdPiece.position, to);
        if (clickDistance < 1 || clickDistance > paceRemaining) {
          socket.emit(ServerEvents.GAME_ERROR, 'NOT_ADJACENT');
          broadcastState(io, room);
          return;
        }
        // Pitch boundary
        if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) {
          socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
          broadcastState(io, room);
          return;
        }
        // No occupied hex
        if (
          sdState.pieces.some(
            (p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r,
          )
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'OCCUPIED');
          broadcastState(io, room);
          return;
        }
        // SNAP-02: if the GK is being moved, recompute the snapshot GK penalty from new position.
        let snapshotGkPenalty = sdState.snapshotGkPenalty ?? 0;
        if (sdPiece.role === 'GK' && sdState.shotTargetHex) {
          const dist = hexDistance(to, sdState.shotTargetHex);
          snapshotGkPenalty = dist <= 1 ? 0 : dist === 2 ? -1 : dist === 3 ? -2 : 0;
        }
        room.gameState = {
          ...sdState,
          pieces: sdState.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p)),
          snapDeflectMovedPieceId: pieceId,
          snapDeflectPaceUsed: paceUsed + clickDistance,
          snapshotGkPenalty,
        };
        broadcastState(io, room);
        return;
      }

      // GK_KICK_MOVE: both teams reposition 1 piece ≤3 hexes while kick is in air.
      // Mirrors HIGH_PASS_MOVE block: adjacency, pitch boundary, occupancy, 1-piece lock.
      if (room.gameState.phase === 'GK_KICK_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const gkMoveState = room.gameState;
        const piece = gkMoveState.pieces.find((p) => p.id === pieceId);
        if (!piece || piece.teamId !== gkMoveState.activeTeam) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const lockedId = gkMoveState.gkKickMovedPieceId ?? null;
        if (lockedId !== null && lockedId !== pieceId) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PIECE');
          broadcastState(io, room);
          return;
        }
        const paceUsed = gkMoveState.gkKickPaceUsed ?? 0;
        if (paceUsed >= 3) {
          socket.emit(ServerEvents.GAME_ERROR, 'PACE_EXCEEDED');
          broadcastState(io, room);
          return;
        }
        if (hexDistance(piece.position, to) !== 1) {
          socket.emit(ServerEvents.GAME_ERROR, 'NOT_ADJACENT');
          broadcastState(io, room);
          return;
        }
        if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) {
          socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
          broadcastState(io, room);
          return;
        }
        if (
          gkMoveState.pieces.some(
            (p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r,
          )
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'OCCUPIED');
          broadcastState(io, room);
          return;
        }
        const gkKickMoveEvent: ActionEvent = {
          type: 'GK_KICK_MOVE',
          slot: gkMoveState.gkKickMovementSlot === 'KICKER' ? 'KICKER' : 'OPP',
          pieceId,
          from: piece.position,
          to,
          timestamp: Date.now(),
        };
        room.gameState = {
          ...gkMoveState,
          pieces: gkMoveState.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p)),
          gkKickMovedPieceId: pieceId,
          gkKickPaceUsed: paceUsed + 1,
          eventLog: [...gkMoveState.eventLog, gkKickMoveEvent],
        };
        broadcastState(io, room);
        return;
      }

      // FIRST_TIME_PASS_MOVE: both teams reposition 1 piece ≤1 hex while ball is in flight.
      // Mirrors HIGH_PASS_MOVE block: 1 piece per team, max 1 hex, adjacency,
      // pitch boundary, no occupied hex. Active team alternates ATTACKER→DEFENDER.
      // D-03 (Phase 17.1).
      if (room.gameState.phase === 'FIRST_TIME_PASS_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const ftpState = room.gameState;
        const piece = ftpState.pieces.find((p) => p.id === pieceId);
        if (!piece || piece.teamId !== ftpState.activeTeam) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // Cycle-4 self-pass-reclaim finding (D-03, Phase 17.1-16): the original passer may
        // not reposition their own piece during FTP repositioning — doing so would let them
        // move onto the (empty) passTargetHex and have the delivery lookup hand the ball
        // straight back to them. Mirrors how highPassCarrierId identifies the kicker; this is
        // the authoritative server-side guard (the client selectPiece mirror is defense-in-depth).
        if (pieceId === ftpState.firstTimePassCarrierId) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PIECE');
          broadcastState(io, room);
          return;
        }
        // Only one piece per slot: lock to the first piece moved
        const lockedId = ftpState.firstTimePassMovedPieceId ?? null;
        if (lockedId !== null && lockedId !== pieceId) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PIECE');
          broadcastState(io, room);
          return;
        }
        const paceUsed = ftpState.firstTimePassPaceUsed ?? 0;
        if (paceUsed >= 1) {
          socket.emit(ServerEvents.GAME_ERROR, 'PACE_EXCEEDED');
          broadcastState(io, room);
          return;
        }
        if (hexDistance(piece.position, to) !== 1) {
          socket.emit(ServerEvents.GAME_ERROR, 'NOT_ADJACENT');
          broadcastState(io, room);
          return;
        }
        if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) {
          socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
          broadcastState(io, room);
          return;
        }
        if (
          ftpState.pieces.some(
            (p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r,
          )
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'OCCUPIED');
          broadcastState(io, room);
          return;
        }
        const ftpMoveEvent: ActionEvent = {
          type: 'FTP_MOVE',
          slot: ftpState.firstTimePassMovementSlot === 'ATTACKER' ? 'ATTACKER' : 'DEFENDER',
          pieceId,
          from: piece.position,
          to,
          timestamp: Date.now(),
        };
        room.gameState = {
          ...ftpState,
          pieces: ftpState.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p)),
          firstTimePassMovedPieceId: pieceId,
          firstTimePassPaceUsed: paceUsed + 1,
          eventLog: [...ftpState.eventLog, ftpMoveEvent],
        };
        broadcastState(io, room);
        return;
      }

      if (room.gameState.phase !== 'MOVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM'); // T-4-01
        broadcastState(io, room);
        return;
      }
      // D-08/D-12: pre-generate all dice that may be consumed by applyMove.
      // Generated here (in the I/O layer) so the pure engine stays deterministic for tests.
      const stealDie = rollDice();
      const tackleDie = rollDice();
      const carrierDie = rollDice();
      const result = applyMove(room.gameState, pieceId, to, { stealDie, tackleDie, carrierDie });
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
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }

      // GK_DIVE: shot now resolves via GAME_GK_DIVE (single-click dive + auto-resolve).
      // End-turn in this phase is a no-op — just snap back so the client stays in sync.
      if (room.gameState.phase === 'GK_DIVE') {
        broadcastState(io, room);
        return;
      }

      // HIGH_PASS_MOVE: slot transitions + auto accuracy roll after defender slot.
      if (room.gameState.phase === 'HIGH_PASS_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const hpState = room.gameState;
        if (hpState.highPassMovementSlot === 'ATTACKER') {
          // Log attacker repositioning then switch to defender's turn
          const attackerReposEvent: ActionEvent = {
            type: 'HP_REPOSITION',
            slot: 'ATTACKER',
            pieceId: hpState.highPassMovedPieceId ?? null,
            timestamp: Date.now(),
          };
          const defenderTeam: 'home' | 'away' = hpState.attackingTeam === 'home' ? 'away' : 'home';
          room.gameState = {
            ...hpState,
            highPassMovementSlot: 'DEFENDER',
            activeTeam: defenderTeam,
            highPassMovedPieceId: null,
            highPassPaceUsed: 0,
            eventLog: [...hpState.eventLog, attackerReposEvent],
          };
          broadcastState(io, room);
        } else {
          // Log defender repositioning then roll accuracy.
          // Restore ball.carrierId from highPassCarrierId so applyRoll can find the kicker's stat.
          const defenderReposEvent: ActionEvent = {
            type: 'HP_REPOSITION',
            slot: 'DEFENDER',
            pieceId: hpState.highPassMovedPieceId ?? null,
            timestamp: Date.now(),
          };
          const d1 = rollDice();
          const d2 = rollDice();
          const d3 = rollDice();
          const stateForRoll: typeof hpState = {
            ...hpState,
            phase: 'PASS',
            ball: { ...hpState.ball, carrierId: hpState.highPassCarrierId ?? null },
            activeTeam: hpState.attackingTeam,
            highPassMovementSlot: null,
            highPassMovedPieceId: null,
            highPassPaceUsed: 0,
            highPassCarrierId: null,
            eventLog: [...hpState.eventLog, defenderReposEvent],
          };
          const result = applyRoll(stateForRoll, d1, d2, d3);
          if (!result.ok) {
            socket.emit(ServerEvents.GAME_ERROR, result.reason);
            broadcastState(io, room);
            return;
          }
          room.gameState = result.state;
          broadcastState(io, room);
          if (result.state.phase === 'FULL_TIME') {
            startReplayStream(io, room);
          }
        }
        return;
      }

      // FIRST_TIME_PASS_MOVE: slot transitions + ball delivery after defender slot.
      // Mirrors HIGH_PASS_MOVE: ATTACKER slot → DEFENDER slot → deliver ball to passTargetHex.
      // No accuracy roll on delivery (D-03: no interception check). D-03 (Phase 17.1).
      if (room.gameState.phase === 'FIRST_TIME_PASS_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const ftpEndState = room.gameState;
        if (ftpEndState.firstTimePassMovementSlot === 'ATTACKER') {
          // Log attacker repositioning then switch to defender's turn
          const attackerReposEvent: ActionEvent = {
            type: 'FTP_REPOSITION',
            slot: 'ATTACKER',
            pieceId: ftpEndState.firstTimePassMovedPieceId ?? null,
            timestamp: Date.now(),
          };
          const defenderTeam: 'home' | 'away' =
            ftpEndState.attackingTeam === 'home' ? 'away' : 'home';
          room.gameState = {
            ...ftpEndState,
            firstTimePassMovementSlot: 'DEFENDER',
            activeTeam: defenderTeam,
            firstTimePassMovedPieceId: null,
            firstTimePassPaceUsed: 0,
            eventLog: [...ftpEndState.eventLog, attackerReposEvent],
          };
          broadcastState(io, room);
        } else {
          // DEFENDER slot done: log defender repositioning, deliver ball to passTargetHex.
          // D-03: no interception check on delivery — ball goes straight to target.
          const defenderReposEvent: ActionEvent = {
            type: 'FTP_REPOSITION',
            slot: 'DEFENDER',
            pieceId: ftpEndState.firstTimePassMovedPieceId ?? null,
            timestamp: Date.now(),
          };
          const targetHex = ftpEndState.passTargetHex!;
          // Review-CR-02 / BUG-04 (D-08/D-09) parity: team-agnostic occupant search —
          // find ANY piece at targetHex (no teamId filter), mirroring gameEngine.ts
          // BUG-04 (1272-1297) used for STANDARD_PASS/LONG_BALL occupant delivery.
          // A defending-team occupant must receive the ball (possession transfers);
          // an attacking-team occupant keeps possession unchanged (happy path);
          // no occupant delivers to the empty hex with carrierId:null (unchanged).
          // Cycle-4 self-pass-reclaim finding (D-03, Phase 17.1-16): exclude the original
          // passer (firstTimePassCarrierId) — defense in depth behind the GAME_MOVE rejection
          // above; even if the passer were somehow standing on passTargetHex, the ball must
          // not be handed back to them.
          const occupant = ftpEndState.pieces.find(
            (p) =>
              p.position.q === targetHex.q &&
              p.position.r === targetHex.r &&
              p.id !== ftpEndState.firstTimePassCarrierId,
          );
          const possessionChanges = occupant
            ? occupant.teamId !== ftpEndState.attackingTeam
            : false;
          const deliveryTeam = possessionChanges ? occupant!.teamId : ftpEndState.attackingTeam;
          room.gameState = {
            ...ftpEndState,
            phase: 'PASS',
            ball: occupant
              ? { position: occupant.position, carrierId: occupant.id }
              : { position: targetHex, carrierId: null },
            lastActionType: 'FIRST_TIME_PASS',
            attackingTeam: deliveryTeam,
            activeTeam: deliveryTeam,
            firstTimePassMovementSlot: null,
            firstTimePassMovedPieceId: null,
            firstTimePassPaceUsed: 0,
            // Carrier id is only cleared once the ball is delivered — mirrors the
            // HIGH_PASS clear of highPassCarrierId:null (Phase 17.1-16).
            firstTimePassCarrierId: null,
            passTargetHex: null,
            stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
            tackleAttemptedByIds: [], // D-02
            eventLog: [...ftpEndState.eventLog, defenderReposEvent],
          };
          broadcastState(io, room);
          if (room.gameState.phase === 'FULL_TIME') {
            startReplayStream(io, room);
          }
        }
        return;
      }

      // GK_KICK_MOVE: slot transitions + accuracy check after OPP slot.
      if (room.gameState.phase === 'GK_KICK_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const gkEndState = room.gameState;
        if (gkEndState.gkKickMovementSlot === 'KICKER') {
          // KICKER slot done: switch to opponent's repositioning turn
          const oppTeam: 'home' | 'away' = gkEndState.attackingTeam === 'home' ? 'away' : 'home';
          room.gameState = {
            ...gkEndState,
            gkKickMovementSlot: 'OPP',
            activeTeam: oppTeam,
            gkKickMovedPieceId: null,
            gkKickPaceUsed: 0,
          };
          broadcastState(io, room);
        } else {
          // OPP slot done: roll accuracy and deliver ball (or loose ball)
          const kickDie = rollDice();
          const gk = gkEndState.pieces.find((p) => p.id === gkEndState.gkKickGkId);
          const kickScore = kickDie + (gk?.highPass ?? 0);
          const accurate = kickScore >= 8;
          const targetHex = gkEndState.gkKickTargetHex!;
          const gkTeam = gkEndState.attackingTeam; // attackingTeam = GK's team throughout GK kick phases

          const kickEvent: ActionEvent = {
            type: 'GK_KICK',
            gkId: gkEndState.gkKickGkId ?? '',
            targetHex,
            accurate,
            kickDie,
            kickScore,
            timestamp: Date.now(),
          };

          if (accurate) {
            const receiver = gkEndState.pieces.find(
              (p) =>
                p.teamId === gkTeam && p.position.q === targetHex.q && p.position.r === targetHex.r,
            );
            room.gameState = {
              ...gkEndState,
              phase: 'PASS',
              ball: { position: targetHex, carrierId: receiver?.id ?? null },
              attackingTeam: gkTeam,
              activeTeam: gkTeam,
              lastDiceRoll: { rolls: [kickDie], context: 'GK_KICK' },
              lastActionType: 'MOVEMENT_PHASE',
              lastShotPath: null,
              actionCount: gkEndState.actionCount + 1,
              gkKickTargetHex: null,
              gkKickGkId: null,
              gkKickMovementSlot: null,
              gkKickMovedPieceId: null,
              gkKickPaceUsed: 0,
              eventLog: [...gkEndState.eventLog, kickEvent],
            };
          } else {
            // Inaccurate: loose ball at the target hex (ball went wide of its destination)
            room.gameState = {
              ...gkEndState,
              phase: 'LOOSE_BALL',
              ball: { position: targetHex, carrierId: null },
              attackingTeam: gkTeam,
              activeTeam: gkTeam,
              lastDiceRoll: { rolls: [kickDie], context: 'GK_KICK' },
              lastActionType: 'DEFLECTION',
              lastShotPath: null,
              actionCount: gkEndState.actionCount + 1,
              gkKickTargetHex: null,
              gkKickGkId: null,
              gkKickMovementSlot: null,
              gkKickMovedPieceId: null,
              gkKickPaceUsed: 0,
              eventLog: [...gkEndState.eventLog, kickEvent],
            };
          }
          broadcastState(io, room);
        }
        return;
      }

      // SNAPSHOT_DEFLECT: defending team ends their deflection turn.
      // Flow mirrors GAME_SHOT: deflection check → GK range check → GK_DIVE (or auto-GOAL).
      if (room.gameState.phase === 'SNAPSHOT_DEFLECT') {
        const sdState = room.gameState;
        const defendingTeam: 'home' | 'away' = sdState.attackingTeam === 'home' ? 'away' : 'home';
        if (socketTeam(socket) !== defendingTeam) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // Strip snap-deflect tracking fields from base state

        const {
          snapDeflectMovedPieceId: _smpi,
          snapDeflectPaceUsed: _sppu,
          ...baseSnapState
        } = sdState;

        // Deflection check (same pattern as GAME_SHOT)
        const snapShooter = baseSnapState.pieces.find((p) => p.id === baseSnapState.ball.carrierId);
        const snapTarget = baseSnapState.shotTargetHex;
        const snapDefInputs: DefenderDeflectionInput[] = [];
        if (snapShooter && snapTarget) {
          const pathHexes = hexLine(snapShooter.position, snapTarget);
          const pathSet = new Set(pathHexes.map((h) => `${h.q},${h.r}`));
          for (const defender of baseSnapState.pieces.filter(
            (p) => p.teamId === defendingTeam && p.role !== 'GK',
          )) {
            const onPath = pathSet.has(`${defender.position.q},${defender.position.r}`);
            let nearPath = false;
            if (!onPath) {
              for (const ph of pathHexes) {
                if (hexDistance(defender.position, ph) === 1) {
                  nearPath = true;
                  break;
                }
              }
            }
            if (onPath || nearPath) {
              snapDefInputs.push({
                defenderId: defender.id,
                defenderPosition: defender.position,
                tackling: defender.tackling,
                die: rollDice(),
                band: onPath ? 'A' : 'B',
              });
            }
          }
        }

        const deflectEvents: ActionEvent[] = [];
        for (const def of snapDefInputs) {
          const didDeflect =
            def.band === 'A'
              ? def.die === 5 || def.die === 6 || def.die + def.tackling >= 10
              : def.die === 6 || def.die + def.tackling >= 10;
          deflectEvents.push({
            type: 'DEFLECT_ATTEMPT',
            defenderId: def.defenderId,
            band: def.band,
            die: def.die,
            tackling: def.tackling,
            result: didDeflect ? 'DEFLECTED' : 'NO_DEFLECT',
            timestamp: Date.now(),
          });
          if (didDeflect) break;
        }

        const snapDeflectResult = computeShotPathDeflection(snapDefInputs);
        if (snapDeflectResult.deflected && snapDeflectResult.deflectorPosition) {
          room.gameState = {
            ...baseSnapState,
            phase: 'LOOSE_BALL',
            ball: { position: snapDeflectResult.deflectorPosition, carrierId: null },
            lastActionType: 'DEFLECTION',
            shotTargetHex: null,
            gkDivePosition: null,
            lastShotPath: null,
            snapshotGkPenalty: null,
            eventLog: [...baseSnapState.eventLog, ...deflectEvents],
          };
          broadcastState(io, room);
          return;
        }

        // GK range check: auto-GOAL if no path hex within 3 hexes of GK
        const snapGk = baseSnapState.pieces.find(
          (p) => p.teamId === defendingTeam && p.role === 'GK',
        );
        const reachableSnapPath =
          snapShooter && snapTarget ? hexLine(snapShooter.position, snapTarget) : [];
        const snapGkHasReachable =
          snapGk !== undefined &&
          reachableSnapPath.some((h) => hexDistance(snapGk.position, h) <= 3);

        if (!snapGkHasReachable) {
          const scoringTeam = baseSnapState.attackingTeam;
          const newKickOffTeam = defendingTeam;
          const outDie1 = rollDice();
          const outDie2 = rollDice();
          const outOfRangeEvent: ActionEvent = {
            type: 'SHOT_ATTEMPT',
            shooterId: baseSnapState.ball.carrierId ?? '',
            targetHex: snapTarget ?? { q: 0, r: 0 },
            outcome: 'GOAL',
            shooterDie: outDie1,
            shooterScore: null,
            gkDie: outDie2,
            gkScore: null,
            handlingDie: null,
            gkHandling: null,
            shooterPenaltyTotal: 0,
            gkPenaltyTotal: 0,
            timestamp: Date.now(),
            ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
          };
          const newScore = {
            ...baseSnapState.score,
            [scoringTeam]: baseSnapState.score[scoringTeam] + 1,
          };
          room.gameState = {
            ...baseSnapState,
            pieces: buildKickOffPieces(newKickOffTeam, baseSnapState.selectedTeams),
            phase: 'KICK_OFF_SETUP',
            score: newScore,
            attackingTeam: newKickOffTeam,
            activeTeam: newKickOffTeam,
            ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
            lastDiceRoll: { rolls: [outDie1, outDie2], context: 'SHOT_DUEL' },
            lastActionType: null,
            lastShotPath: null,
            gkDivePosition: null,
            shotTargetHex: null,
            snapshotGkPenalty: null,
            eventLog: [
              ...baseSnapState.eventLog,
              ...deflectEvents,
              outOfRangeEvent,
              {
                type: 'GOAL' as const,
                scoringTeam,
                timestamp: Date.now(),
                ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
              },
            ],
          };
          broadcastState(io, room);
          return;
        }

        // GK in range: transition to GK_DIVE so GK can choose a dive hex
        room.gameState = {
          ...baseSnapState,
          phase: 'GK_DIVE',
          lastActionType: 'SHOT',
          gkDivePosition: snapGk.position,
          snapshotGkPenalty: null,
          eventLog: [...baseSnapState.eventLog, ...deflectEvents],
        };
        broadcastState(io, room);
        return;
      }

      if (room.gameState.phase !== 'MOVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM'); // T-4-04
        broadcastState(io, room);
        return;
      }
      // D-05 / MATCH-02: pre-generate added-time roll; consumed by applyEndTurn only when
      // actionCount crosses 45 and addedTime is null. crypto.randomInt-backed (Pitfall 1).
      const addedTimeRoll = rollDice();
      const result = applyEndTurn(room.gameState, { addedTimeRoll });
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
      // D-30 / D-31 / REPLAY-01: when FULL_TIME is reached, broadcast the FULL_TIME state
      // first (already done above), then schedule the replay stream after ~3s (Open Question 3).
      if (result.state.phase === 'FULL_TIME') {
        startReplayStream(io, room);
      }
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
      // BUG-03 (Phase 17 D-06): undo is valid in MOVE and HIGH_PASS_MOVE phases
      // D-03 (Phase 17.1): also valid in FIRST_TIME_PASS_MOVE
      const validUndoPhases: GamePhase[] = ['MOVE', 'HIGH_PASS_MOVE', 'FIRST_TIME_PASS_MOVE'];
      if (room.gameState === null || !validUndoPhases.includes(room.gameState.phase)) {
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
  // GAME_RESTART_MOVEMENT — resets movement phase to ATTACKER_4 (house-rule repeat)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_RESTART_MOVEMENT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return;
    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'MOVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // D-24: snap-back so client re-syncs
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // D-24: snap-back so client re-syncs
        return;
      }
      const result = applyRestartMovement(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // D-24: snap-back so client re-syncs
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room);
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_CANCEL_MOVEMENT — reverts MOVEMENT phase back to PASS before any piece has moved
  // BUG-02 (Phase 17 D-03/D-04/D-05): cancel is only available when paceUsedByPieceId is empty.
  // No movement slot is consumed on cancel.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_CANCEL_MOVEMENT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return;
    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'MOVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyCancelMovement(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room);
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
  //
  // passType (optional): when phase===PASS, client sends the chosen pass type.
  // Server validates it is eligible for the current lastActionType and sets
  // lastActionType=passType before calling applyRoll so the engine records the
  // correct action and computes the correct time cost.
  //
  // D-10 (Phase 8.2): targetHex carries the destination hex for High/Long pass
  // accuracy resolution. Server authoritatively re-runs validatePass before
  // committing passTargetHex to state (ASVS V5).
  // -------------------------------------------------------------------------
  socket.on(
    ClientEvents.GAME_ROLL,
    (
      passType?: 'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL',
      targetHex?: HexCoord,
    ) => {
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

        if (room.gameState.phase === 'PASS' || room.gameState.phase === 'KICK_OFF') {
          // Pass phase requires a passType from the client (choose-phase flow).
          const PASS_TYPES = [
            'STANDARD_PASS',
            'FIRST_TIME_PASS',
            'HIGH_PASS',
            'LONG_BALL',
          ] as const;
          if (!passType || !(PASS_TYPES as readonly string[]).includes(passType)) {
            socket.emit(ServerEvents.GAME_ERROR, 'MISSING_PASS_TYPE');
            broadcastState(io, room);
            return;
          }
          // Validate the chosen passType against the current lastActionType.
          // null lastActionType (kick-off start) is treated as MOVEMENT_PHASE eligibility.
          const effectiveLastAction = room.gameState.lastActionType ?? 'MOVEMENT_PHASE';
          if (!ELIGIBLE_NEXT_ACTIONS[effectiveLastAction].has(passType)) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
            broadcastState(io, room);
            return;
          }
          // MATCH-07: during KICK_OFF phase, only a Standard Pass may open play.
          if (room.gameState.phase === 'KICK_OFF' && passType !== 'STANDARD_PASS') {
            socket.emit(ServerEvents.GAME_ERROR, 'KICKOFF_STANDARD_PASS_ONLY');
            broadcastState(io, room);
            return;
          }
          // D-10 (Phase 8.2): targetHex validation and authoritative validatePass gate.
          // Require targetHex for all pass types — engine needs it for accuracy resolution.
          if (!targetHex) {
            socket.emit(ServerEvents.GAME_ERROR, 'MISSING_TARGET');
            broadcastState(io, room);
            return;
          }
          // ASVS V5: shape validation — reject non-number q/r (mirror GAME_SHOT T-07-12)
          if (
            typeof targetHex !== 'object' ||
            targetHex === null ||
            typeof targetHex.q !== 'number' ||
            typeof targetHex.r !== 'number'
          ) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
            broadcastState(io, room);
            return;
          }
          // Look up the ball carrier (must exist in PASS phase)
          const carrier = room.gameState.pieces.find(
            (p) => p.id === room.gameState!.ball.carrierId,
          );
          if (!carrier) {
            socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
            broadcastState(io, room);
            return;
          }
          // Map client passType to validatePass type parameter
          const passTypeMap: Record<
            'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL',
            'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG'
          > = {
            STANDARD_PASS: 'STANDARD',
            FIRST_TIME_PASS: 'FIRST_TIME',
            HIGH_PASS: 'HIGH',
            LONG_BALL: 'LONG',
          };
          const vpType = passTypeMap[passType];
          // Authoritative server-side validatePass (D-10) — re-runs before committing
          const passResult = validatePass(
            room.gameState,
            carrier,
            carrier.position,
            targetHex,
            vpType,
          );
          if (!passResult.ok) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
            broadcastState(io, room);
            return;
          }
          // Commit passTargetHex to state — consumed by applyRoll PASS branch
          room.gameState = { ...room.gameState, passTargetHex: targetHex };
          // D-11 (Phase 8.2): Pre-generate interception dice before applyRoll (Pitfall 4)
          // Header-win pass is non-interceptable — skip regardless of validatePass result.
          // D-10: autoIntercepts need no dice; only pre-generate for rollIntercepts.
          const isHeaderPass = room.gameState.lastActionType === 'HEADER';
          if (!isHeaderPass && passResult.rollIntercepts.length > 0) {
            const interceptionDice = passResult.rollIntercepts.map(() => rollDice());
            room.gameState = { ...room.gameState, preGeneratedInterceptionDice: interceptionDice };
          }

          // Commit the chosen pass type — applyRoll reads lastActionType to determine time cost.
          room.gameState = { ...room.gameState, lastActionType: passType };

          // HIGH_PASS: log the pass attempt immediately then enter repositioning phase.
          // Ball moves to target (visible to both clients); carrierId cleared so kicker loses possession.
          // highPassCarrierId preserves the kicker ID for the accuracy stat lookup in applyRoll.
          if (passType === 'HIGH_PASS') {
            const kickerId = room.gameState.ball.carrierId;
            const kickerPiece = room.gameState.pieces.find((p) => p.id === kickerId);
            const highPassEvent: ActionEvent = {
              type: 'HIGH_PASS',
              passerId: kickerId ?? '',
              from: kickerPiece?.position ?? targetHex,
              to: targetHex,
              accurate: null,
              timestamp: Date.now(),
              ballAfter: { position: targetHex, carrierId: null },
            };
            room.gameState = {
              ...room.gameState,
              phase: 'HIGH_PASS_MOVE',
              ball: { position: targetHex, carrierId: null },
              highPassCarrierId: kickerId,
              highPassMovementSlot: 'ATTACKER',
              highPassMovedPieceId: null,
              highPassPaceUsed: 0,
              activeTeam: room.gameState.attackingTeam,
              eventLog: [...room.gameState.eventLog, highPassEvent],
            };
            broadcastState(io, room);
            return;
          }
        } else {
          // D-07 / T-08-12: sequence guards for non-PASS dice phases.
          if (room.gameState.phase === 'HEADER' && room.gameState.lastActionType !== null) {
            if (!ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('HEADER')) {
              socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
              broadcastState(io, room);
              return;
            }
          }
          // Pitfall 5 (Phase 8.2): HEADER roll requires both teams to confirm their contestant.
          if (room.gameState.phase === 'HEADER') {
            if (!room.gameState.headerConfirmed?.home || !room.gameState.headerConfirmed?.away) {
              socket.emit(ServerEvents.GAME_ERROR, 'HEADER_NOT_CONFIRMED');
              broadcastState(io, room);
              return;
            }
          }
          // RULE-02 guard: duel already resolved in GAME_HEADER_CONTESTANT — do not re-fire.
          // An attacker who lost could otherwise send GAME_ROLL to overwrite headerDuelWinner.
          if (room.gameState.phase === 'HEADER' && room.gameState.headerDuelWinner !== undefined) {
            socket.emit(ServerEvents.GAME_ERROR, 'DUEL_ALREADY_RESOLVED');
            broadcastState(io, room);
            return;
          }
        }

        // Pre-generate all dice the branch may need (Pitfall 4 — upfront, before any validator call)
        const d1 = rollDice();
        const d2 = rollDice();
        const d3 = rollDice();
        // applyRoll's PASS branch only triggers on phase === 'PASS'; normalise KICK_OFF → PASS
        // so the engine's pass logic runs without duplicating it (kickOffActive enforces centre-hex rule above).
        const stateForRoll =
          room.gameState.phase === 'KICK_OFF'
            ? { ...room.gameState, phase: 'PASS' as const }
            : room.gameState;
        const result = applyRoll(stateForRoll, d1, d2, d3);
        if (!result.ok) {
          socket.emit(ServerEvents.GAME_ERROR, result.reason);
          broadcastState(io, room); // snap-back
          return;
        }
        // D-27 / MATCH-03: clear kickOffActive after a successful kick-off pass from centre hex.
        if (room.gameState.kickOffActive) {
          room.gameState = { ...result.state, kickOffActive: false };
        } else {
          room.gameState = result.state;
        }
        broadcastState(io, room); // ARCH-04: single broadcast entry point
        // WR-04: guard against the (currently unreachable) case where applyRoll transitions to
        // FULL_TIME — mirrors the startReplayStream call in GAME_END_TURN / HIGH_PASS_MOVEMENT.
        if (room.gameState.phase === 'FULL_TIME') {
          startReplayStream(io, room);
        }
      } finally {
        room.isProcessing = false; // MUST be in finally — Pitfall 5
      }
    },
  );

  // -------------------------------------------------------------------------
  // GAME_SHOT — declares a shot: PASS → GK_DIVING (D-02 rework)
  //
  // D-02: reworked from a metadata-only recorder to a state-transitioning
  // declaration handler. Phase guard changed from SHOT → PASS (shooter is in
  // the ACTION/PASS phase when they click "Shoot"). Calls applyDeclareShot which
  // transitions to GK_DIVING and records shotTargetHex. Broadcasts new state.
  //
  // T-07-11: phase (PASS) + team guard (controlsAttackingTeam) prevent wrong-phase
  //          / wrong-team declarations
  // T-07-12: HexCoord shape validation rejects malformed payloads (ASVS V5, T-10-09)
  // T-10-10: server declares goal hex; dice pre-generated server-side (no client dice)
  // T-10-11: isProcessing mutex prevents double-click race (SC-5)
  // ARCH-04: broadcastState is mandatory — this handler now transitions state.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_SHOT, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // 1. Null-state guard
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // 2. Phase guard: must be in PASS or SNAPSHOT_TARGET (snapshot target selection)
      if (room.gameState.phase !== 'PASS' && room.gameState.phase !== 'SNAPSHOT_TARGET') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // 3. Team guard: only the attacking team may declare a shot
      if (!controlsAttackingTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // 4. Payload validation (ASVS V5, T-07-12, T-10-09)
      if (
        typeof targetHex !== 'object' ||
        targetHex === null ||
        typeof targetHex.q !== 'number' ||
        typeof targetHex.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room); // snap-back
        return;
      }
      // 5. Engine call: validates goal hex and seeds GK_DIVING state
      const result = applyDeclareShot(room.gameState, targetHex);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      const declaredState = result.state;

      // BUGFIX (snapshot-shot-flow-mismatch): when applyDeclareShot is called from
      // SNAPSHOT_TARGET it transitions to 'SNAPSHOT_DEFLECT' (defending team gets a
      // 2-hex repositioning turn) rather than 'GK_DIVE'. Steps 6/7 below resolve
      // deflection and GK-range using CURRENT (pre-repositioning) positions, which is
      // only correct for the regular PASS → GK_DIVE flow. For the snapshot flow, the
      // equivalent checks already run — correctly, with POST-repositioning positions —
      // in the SNAPSHOT_DEFLECT end-of-turn handler (GAME_END_TURN). Running them again
      // here would resolve (or even score) the snapshot before the defending team gets
      // their repositioning turn. Skip straight to broadcasting the SNAPSHOT_DEFLECT state.
      if (declaredState.phase === 'SNAPSHOT_DEFLECT') {
        room.gameState = declaredState;
        broadcastState(io, room);
        return;
      }

      // 6. Deflection check (before GK dives — defenders on/near path act first)
      const shotShooter = declaredState.pieces.find((p) => p.id === declaredState.ball.carrierId);
      const shotPathTarget = declaredState.shotTargetHex;
      const defInputs: DefenderDeflectionInput[] = [];
      if (shotShooter && shotPathTarget) {
        const pathHexes = hexLine(shotShooter.position, shotPathTarget);
        const pathSet = new Set(pathHexes.map((h) => `${h.q},${h.r}`));
        const defTeam: 'home' | 'away' = declaredState.attackingTeam === 'home' ? 'away' : 'home';
        for (const defender of declaredState.pieces.filter(
          (p) => p.teamId === defTeam && p.role !== 'GK',
        )) {
          const onPath = pathSet.has(`${defender.position.q},${defender.position.r}`);
          let nearPath = false;
          if (!onPath) {
            for (const ph of pathHexes) {
              if (hexDistance(defender.position, ph) === 1) {
                nearPath = true;
                break;
              }
            }
          }
          if (onPath || nearPath) {
            defInputs.push({
              defenderId: defender.id,
              defenderPosition: defender.position,
              tackling: defender.tackling,
              die: rollDice(),
              band: onPath ? 'A' : 'B',
            });
          }
        }
      }

      const deflectEventsShot: ActionEvent[] = [];
      for (const def of defInputs) {
        const didDeflect =
          def.band === 'A'
            ? def.die === 5 || def.die === 6 || def.die + def.tackling >= 10
            : def.die === 6 || def.die + def.tackling >= 10;
        deflectEventsShot.push({
          type: 'DEFLECT_ATTEMPT',
          defenderId: def.defenderId,
          band: def.band,
          die: def.die,
          tackling: def.tackling,
          result: didDeflect ? 'DEFLECTED' : 'NO_DEFLECT',
          timestamp: Date.now(),
        });
        if (didDeflect) break;
      }

      const shotDeflectionResult = computeShotPathDeflection(defInputs);
      if (shotDeflectionResult.deflected && shotDeflectionResult.deflectorPosition) {
        room.gameState = {
          ...declaredState,
          phase: 'LOOSE_BALL',
          ball: { position: shotDeflectionResult.deflectorPosition, carrierId: null },
          lastActionType: 'DEFLECTION',
          shotTargetHex: null,
          gkDivePosition: null,
          lastShotPath: null,
          eventLog: [...declaredState.eventLog, ...deflectEventsShot],
        };
        broadcastState(io, room);
        return;
      }

      // 7. GK range check: if no path hex is reachable (≤3 hexes) auto-GOAL
      const shotDefTeam: 'home' | 'away' = declaredState.attackingTeam === 'home' ? 'away' : 'home';
      const gkForRange = declaredState.pieces.find(
        (p) => p.teamId === shotDefTeam && p.role === 'GK',
      );
      const reachablePathHexes =
        shotShooter && shotPathTarget ? hexLine(shotShooter.position, shotPathTarget) : [];
      const hasReachableHex =
        gkForRange !== undefined &&
        reachablePathHexes.some((h) => hexDistance(gkForRange.position, h) <= 3);

      if (!hasReachableHex) {
        const scoringTeam = declaredState.attackingTeam;
        const newKickOffTeam = shotDefTeam;
        const outDie1 = rollDice();
        const outDie2 = rollDice();
        const outOfRangeEvent: ActionEvent = {
          type: 'SHOT_ATTEMPT',
          shooterId: declaredState.ball.carrierId ?? '',
          targetHex: shotPathTarget ?? { q: 0, r: 0 },
          outcome: 'GOAL',
          shooterDie: outDie1,
          shooterScore: null,
          gkDie: outDie2,
          gkScore: null,
          handlingDie: null,
          gkHandling: null,
          shooterPenaltyTotal: 0,
          gkPenaltyTotal: 0,
          timestamp: Date.now(),
          ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
        };
        const newScore = {
          ...declaredState.score,
          [scoringTeam]: declaredState.score[scoringTeam] + 1,
        };
        room.gameState = {
          ...declaredState,
          pieces: buildKickOffPieces(newKickOffTeam, declaredState.selectedTeams),
          phase: 'KICK_OFF_SETUP',
          score: newScore,
          attackingTeam: newKickOffTeam,
          activeTeam: newKickOffTeam,
          ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
          lastDiceRoll: { rolls: [outDie1, outDie2], context: 'SHOT_DUEL' },
          lastActionType: null,
          lastShotPath: null,
          gkDivePosition: null,
          shotTargetHex: null,
          snapshotGkPenalty: null,
          eventLog: [
            ...declaredState.eventLog,
            ...deflectEventsShot,
            outOfRangeEvent,
            {
              type: 'GOAL' as const,
              scoringTeam,
              timestamp: Date.now(),
              ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
            },
          ],
        };
        broadcastState(io, room);
        return;
      }

      // GK in range: enter GK_DIVING with any deflect events appended
      room.gameState = {
        ...declaredState,
        eventLog: [...declaredState.eventLog, ...deflectEventsShot],
      };
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_KICK_OFF_MOVE — free piece repositioning during KICK_OFF_SETUP phase
  // T-08-09: piece must belong to the requesting socket's team (T-08-09 Tampering)
  // T-08-14: isProcessing mutex guards against double-process (SC-5)
  // D-23: no pace limits, no ZoI enforcement — this is pre-kick-off positioning
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_KICK_OFF_MOVE, (pieceId: string, to: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be KICK_OFF_SETUP
      if (room.gameState === null || room.gameState.phase !== 'KICK_OFF_SETUP') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // T-08-09: validate HexCoord payload (V5 input validation)
      if (
        typeof to !== 'object' ||
        to === null ||
        typeof to.q !== 'number' ||
        typeof to.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // Piece lookup
      const piece = room.gameState.pieces.find((p) => p.id === pieceId);
      if (!piece) {
        socket.emit(ServerEvents.GAME_ERROR, 'PIECE_NOT_FOUND');
        broadcastState(io, room);
        return;
      }
      // T-08-09: only the owning team may reposition their pieces
      const team = socketTeam(socket);
      if (piece.teamId !== team) {
        socket.emit(ServerEvents.GAME_ERROR, 'NOT_YOUR_PIECE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Boundary guard: reject off-pitch destinations (D-23)
      if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) {
        socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
        broadcastState(io, room);
        return;
      }
      // Occupancy guard: reject if any other piece already occupies that hex
      if (
        room.gameState.pieces.some(
          (p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r,
        )
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'OCCUPIED');
        broadcastState(io, room);
        return;
      }
      // Apply free repositioning (no pace/ZoI checks — D-23)
      const newPieces = room.gameState.pieces.map((p) =>
        p.id === pieceId ? { ...p, position: { q: to.q, r: to.r } } : p,
      );
      room.gameState = { ...room.gameState, pieces: newPieces };
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_READY — KICK_OFF_SETUP confirmation ("Ready" button)
  // T-08-10: applyKickOffReady validates placement server-side; snap-back on rejection
  // T-08-08: handler tracks each socket's own slot only; never sets both ready at once
  // D-24: transitions to KICK_OFF only when both teams have confirmed ready
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_READY, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be KICK_OFF_SETUP
      if (room.gameState === null || room.gameState.phase !== 'KICK_OFF_SETUP') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Validate placement rules for this socket's team (T-08-10)
      const team = socketTeam(socket);
      const result = applyKickOffReady(room.gameState, team);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      // Mark this socket's player slot as ready (T-08-08: only the confirming socket's own slot)
      const slot = socket.data.playerSlot;
      if (slot === undefined) return;
      if (!room.readyPlayers) {
        room.readyPlayers = new Set<1 | 2>();
      }
      room.readyPlayers.add(slot);
      // D-24: transition to KICK_OFF only when both teams have confirmed ready.
      // applyKickOffReady already validated that the attacking team has exactly one
      // piece on the centre hex — assign that piece as ball carrier so possession
      // is reflected in state and graphics immediately.
      if (room.readyPlayers.size === 2) {
        const kickOffHex = PITCH_REGIONS.kickOffHex;
        // CR-03: filter by attackingTeam first so a defending piece that happens to be on
        // the kick-off hex (e.g. due to a stale placement guard) cannot be assigned possession.
        const kicker = room.gameState.pieces.find(
          (p) =>
            p.teamId === room.gameState!.attackingTeam &&
            p.position.q === kickOffHex.q &&
            p.position.r === kickOffHex.r,
        );
        room.gameState = {
          ...room.gameState,
          phase: 'KICK_OFF',
          ball: kicker ? { position: kickOffHex, carrierId: kicker.id } : room.gameState.ball,
          attackingTeam: kicker ? kicker.teamId : room.gameState.attackingTeam,
          activeTeam: kicker ? kicker.teamId : room.gameState.activeTeam,
          lastActionType: null, // D-10: fresh sequence at kick-off
          eventLog: [
            ...room.gameState.eventLog,
            {
              type: 'KICK_OFF' as const,
              timestamp: Date.now(),
              ballAfter: kicker
                ? { position: kickOffHex, carrierId: kicker.id }
                : room.gameState.ball,
            },
          ],
        };
        room.readyPlayers = null; // clear for next use
      }
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_HALF_TIME_START — trigger 2nd half from HALF_TIME phase
  // T-08-11: only the non-kick-off team may start the second half (D-26/D-28)
  // T-08-14: isProcessing mutex guards against double-process (SC-5)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_HALF_TIME_START, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be HALF_TIME
      if (room.gameState === null || room.gameState.phase !== 'HALF_TIME') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // T-08-11: only the team that did NOT kick off in the 1st half may start the 2nd half
      // The 2nd-half kick-off team is the opposite of kickOffTeam (D-26)
      const team = socketTeam(socket);
      const secondHalfKickOffTeam: 'home' | 'away' =
        room.gameState.kickOffTeam === 'home' ? 'away' : 'home';
      if (team !== secondHalfKickOffTeam) {
        socket.emit(ServerEvents.GAME_ERROR, 'NOT_KICK_OFF_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // Transition to KICK_OFF_SETUP for 2nd half (D-28)
      const result = applyHalfTimeStart(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
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

  // -------------------------------------------------------------------------
  // GAME_QUICK_THROW — GK delivers to a target hex (unblocked, uninterceptable)
  // Only the GK's team may throw; target validated server-side (range ≤ 11, on pitch).
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_QUICK_THROW, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return;

    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'GK_QUICK_THROW') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!controlsGKTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyQuickThrow(room.gameState, targetHex);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room);
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_GK_KICK_TARGET — GK's team selects kick destination during GK_KICK_TARGET phase.
  // Only the GK's team may send this; target validated by applyGKKickTarget (on pitch,
  // not in opponent's final third, not GK's own hex).
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_GK_KICK_TARGET, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return;

    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'GK_KICK_TARGET') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // controlsGKTeam derives GK team from ball.carrierId (still set in GK_KICK_TARGET)
      if (!controlsGKTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyGKKickTarget(room.gameState, targetHex);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room);
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_SNAPSHOT — declares a Snapshot (CR-01 server end)
  //
  // T-08-21: gates on isActivePlayer (attacking team) + applySnapshot internal
  //   phase/sequence/position validation (NOT_IN_PENALTY_AREA / INVALID_SEQUENCE).
  //
  // applySnapshot transitions MOVEMENT or PASS → SHOT and sets snapshotGkPenalty.
  // No dice pre-generation here — the shot duel is resolved by the subsequent
  // game:roll (GAME_ROLL handles phase='SHOT' via DICE_PHASES).
  //
  // ARCH-04: broadcastState is the single broadcast entry point.
  // SC-5: isProcessing mutex guards against double-click race.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_SNAPSHOT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Null-state guard (belt-and-suspenders; applySnapshot also validates internally)
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back — ARCH-04
        return;
      }
      // T-08-21: only the active (attacking) player may declare a Snapshot
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      const result = applySnapshot(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_GK_DIVE — GK repositions during GK_DIVING phase (D-04, SHOT-04)
  //
  // T-10-08: controlsGKTeam guard — only the GK's team may send dive hexes.
  // T-10-09: HexCoord shape validation rejects malformed payloads (ASVS V5).
  // T-10-11: isProcessing mutex prevents double-click race (SC-5).
  // applyGKDive validates: parallel-to-goal-line, ≤3 hexes, on-pitch.
  // ARCH-04: broadcastState after success and on all error paths.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_GK_DIVE, (to: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // 1. Null-state guard
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // 2. Phase guard
      if (room.gameState.phase !== 'GK_DIVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // 3. HexCoord payload validation (ASVS V5, T-10-09)
      if (
        typeof to !== 'object' ||
        to === null ||
        typeof to.q !== 'number' ||
        typeof to.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // 4. Team guard: only the GK's team may reposition (T-10-08)
      if (!controlsGKTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      // 5. Engine call: validates path membership, ≤3 hexes, on-pitch
      const result = applyGKDive(room.gameState, to);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }

      // 6. Auto-resolve shot immediately after dive (no end-turn needed)
      const afterDiveState = result.state;
      const diveShotDie = rollDice();
      const diveGkDie = rollDice();
      const diveHandlingDie = rollDice();
      const stateForShot: typeof afterDiveState = {
        ...afterDiveState,
        phase: 'SHOT',
        lastActionType: 'SHOT',
      };
      const diveShotResult = applyRoll(stateForShot, diveShotDie, diveGkDie, diveHandlingDie);
      if (!diveShotResult.ok) {
        socket.emit(ServerEvents.GAME_ERROR, diveShotResult.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = { ...diveShotResult.state, gkDivePosition: null };
      broadcastState(io, room); // ARCH-04
      if (diveShotResult.state.phase === 'FULL_TIME') {
        startReplayStream(io, room);
      }
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // GAME_HEADER_ACCURACY_ACK — attacker acknowledges the high-pass accuracy roll (RULE-01)
  //
  // D-01 (Phase 11): The attacking team must acknowledge the accuracy roll result before
  // contestant selection UI is revealed. This handler clears headerAccuracyRollPending.
  //
  // T-11-02: Only the attacking team can clear the flag (ASVS V4 Spoofing mitigation).
  // SC-5: isProcessing mutex prevents double-click race.
  // ARCH-04: broadcastState after flag clear.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_HEADER_ACCURACY_ACK, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard
      if (room.gameState === null || room.gameState.phase !== 'HEADER') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Team guard: only the attacking team can acknowledge (T-11-02)
      if (!controlsAttackingTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // Idempotency guard: flag already cleared — snap-back without state mutation
      if (!room.gameState.headerAccuracyRollPending) {
        broadcastState(io, room);
        return;
      }
      // Clear the pending flag
      room.gameState = { ...room.gameState, headerAccuracyRollPending: null };
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // GAME_HEADER_TARGET — winning team selects target hex after duel resolves (RULE-02, D-05)
  //
  // RULE-02 (Phase 11): winner guard replaces the prior attacker-only guard (T-11-01).
  // The duel was already fired in GAME_HEADER_CONTESTANT when both teams confirmed.
  // headerDuelWinner records which team won; only that team may submit a target hex.
  // applyResolveHeaderTarget validates range against the winning contestant's position (D-06)
  // and transitions to PASS or GK_DIVING without re-rolling dice (Pitfall 4 prevention).
  //
  // T-10-09: HexCoord shape validation (ASVS V5).
  // SC-5: isProcessing mutex.
  // ARCH-04: broadcastState after success and on all error paths.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_HEADER_TARGET, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // 1. Null-state guard
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // 2. Phase guard
      if (room.gameState.phase !== 'HEADER') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // 3. Both-teams-confirmed guard: target hex only accepted after both teams confirm contestants
      if (!room.gameState.headerConfirmed?.home || !room.gameState.headerConfirmed?.away) {
        socket.emit(ServerEvents.GAME_ERROR, 'HEADER_NOT_CONFIRMED');
        broadcastState(io, room);
        return;
      }
      // 4. HexCoord payload validation (ASVS V5, T-10-09)
      if (
        typeof targetHex !== 'object' ||
        targetHex === null ||
        typeof targetHex.q !== 'number' ||
        typeof targetHex.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // 5. Winner guard (RULE-02, D-05, T-11-01): only the duel winner may select the target hex
      const duelWinner = room.gameState.headerDuelWinner;
      if (!duelWinner || socketTeam(socket) !== duelWinner) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // 6. Engine call: validates range against winning contestant's position (D-06), transitions
      //    to PASS or GK_DIVING without re-rolling dice (Pitfall 4 — duel fires exactly once)
      const result = applyResolveHeaderTarget(room.gameState, targetHex);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      const headerTargetState = result.state;

      // BUGFIX (snapshot-shot-flow-mismatch continuation): applyResolveHeaderTarget routes a
      // goal-line target straight to GK_DIVE with no GK-range gate — unlike GAME_SHOT (step 7)
      // and the SNAPSHOT_DEFLECT end-of-turn handler, which both auto-resolve to GOAL when no
      // shot-path hex is within 3 hexes of the defending GK. Without this gate, a header-at-goal
      // against an out-of-range GK enters GK_DIVE with zero clickable dive hexes (the client's
      // gkDiveTargetSet is correctly empty) and the defending team gets permanently stuck with no
      // available action — perceived as "the path is shown but it's out of range and unselectable."
      // Mirror the same auto-GOAL fallback here for consistency across all three GK_DIVE entry
      // points (regular shot / snapshot / header).
      if (headerTargetState.phase === 'GK_DIVE') {
        const headerShooter = headerTargetState.pieces.find(
          (p) => p.id === headerTargetState.ball.carrierId,
        );
        const headerShotTarget = headerTargetState.shotTargetHex;
        const headerDefTeam: 'home' | 'away' =
          headerTargetState.attackingTeam === 'home' ? 'away' : 'home';
        const headerGk = headerTargetState.pieces.find(
          (p) => p.teamId === headerDefTeam && p.role === 'GK',
        );
        const headerReachablePath =
          headerShooter && headerShotTarget
            ? hexLine(headerShooter.position, headerShotTarget)
            : [];
        const headerGkHasReachable =
          headerGk !== undefined &&
          headerReachablePath.some((h) => hexDistance(headerGk.position, h) <= 3);

        if (!headerGkHasReachable) {
          const scoringTeam = headerTargetState.attackingTeam;
          const newKickOffTeam = headerDefTeam;
          const outDie1 = rollDice();
          const outDie2 = rollDice();
          const outOfRangeEvent: ActionEvent = {
            type: 'SHOT_ATTEMPT',
            shooterId: headerTargetState.ball.carrierId ?? '',
            targetHex: headerShotTarget ?? { q: 0, r: 0 },
            outcome: 'GOAL',
            shooterDie: outDie1,
            shooterScore: null,
            gkDie: outDie2,
            gkScore: null,
            handlingDie: null,
            gkHandling: null,
            shooterPenaltyTotal: 0,
            gkPenaltyTotal: 0,
            timestamp: Date.now(),
            ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
          };
          const newScore = {
            ...headerTargetState.score,
            [scoringTeam]: headerTargetState.score[scoringTeam] + 1,
          };
          room.gameState = {
            ...headerTargetState,
            pieces: buildKickOffPieces(newKickOffTeam, headerTargetState.selectedTeams),
            phase: 'KICK_OFF_SETUP',
            score: newScore,
            attackingTeam: newKickOffTeam,
            activeTeam: newKickOffTeam,
            ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
            lastDiceRoll: { rolls: [outDie1, outDie2], context: 'SHOT_DUEL' },
            lastActionType: null,
            lastShotPath: null,
            gkDivePosition: null,
            shotTargetHex: null,
            snapshotGkPenalty: null,
            eventLog: [
              ...headerTargetState.eventLog,
              outOfRangeEvent,
              {
                type: 'GOAL' as const,
                scoringTeam,
                timestamp: Date.now(),
                ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
              },
            ],
          };
          broadcastState(io, room);
          return;
        }
      }

      room.gameState = headerTargetState;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_HEADER_CONTESTANT — per-team header contestant selection (D-17, ASVS V4)
  //
  // Both teams select their contestant piece during HEADER phase before GAME_ROLL
  // can resolve the heading duel.  Both teams may act (HEADER is two-sided), so
  // isActivePlayer is NOT used here — the ownership check binds selection to the
  // socket's own team slot instead (ASVS V4 Tampering mitigation T-08.2-08).
  //
  // SC-5: isProcessing mutex prevents double-click race.
  // ARCH-04: broadcastState after selection so both clients see opponent's confirm flag.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_HEADER_CONTESTANT, (pieceIds: string[] | null) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be HEADER
      if (room.gameState === null || room.gameState.phase !== 'HEADER') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Determine which team slot this socket controls
      const teamSlot = socket.data.playerSlot === 1 ? 'home' : 'away';

      const ids = pieceIds ?? [];

      // ASVS V4: validate piece ownership — reject any opponent piece
      for (const pieceId of ids) {
        const piece = room.gameState.pieces.find((p) => p.id === pieceId);
        if (!piece || piece.teamId !== teamSlot) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_CONTESTANT');
          broadcastState(io, room); // snap-back
          return;
        }
      }

      // Record the contestant selection and mark this team as confirmed
      const existingContestants = room.gameState.headerContestants ?? {
        home: [],
        away: [],
      };
      const existingConfirmed = room.gameState.headerConfirmed ?? {
        home: false,
        away: false,
      };

      const updatedContestants = { ...existingContestants, [teamSlot]: ids };
      const updatedConfirmed = { ...existingConfirmed, [teamSlot]: true };

      room.gameState = {
        ...room.gameState,
        headerContestants: updatedContestants,
        headerConfirmed: updatedConfirmed,
      };

      // RULE-02 (Phase 11): when both teams have confirmed, fire the heading duel via
      // computeHeaderDuelWinner (pure function — no phase transition) and store the result
      // as headerDuelWinner, staying in HEADER. This re-enables the two-step flow:
      // the winning team then selects a target hex via GAME_HEADER_TARGET, which routes
      // to GK_DIVE (goal-line target) or PASS (any other target) without re-rolling dice.
      // A tie (computeHeaderDuelWinner returns null) has no winner to select a target, so
      // applyRoll is used for that case only, to resolve directly to LOOSE_BALL.
      const bothConfirmed = updatedConfirmed.home === true && updatedConfirmed.away === true;
      if (bothConfirmed) {
        const atkTeam = room.gameState.attackingTeam;
        const atkCount = updatedContestants[atkTeam]?.length ?? 0;
        const defTeam: 'home' | 'away' = atkTeam === 'home' ? 'away' : 'home';
        const defCount = updatedContestants[defTeam]?.length ?? 0;
        // dice layout: [atk_0..atkN, def_0..defN, atkTieDie, defTieDie]
        const numDice = Math.max(atkCount + defCount + 2, 2);
        const diceArr = Array.from({ length: numDice }, () => rollDice());
        const winner = computeHeaderDuelWinner(room.gameState, diceArr);
        if (winner === null) {
          // Tie: no winner to choose a target hex — resolve directly via applyRoll (LOOSE_BALL).
          const result = applyRoll(room.gameState, ...diceArr);
          if (result.ok) {
            room.gameState = result.state;
          }
          // applyRoll !ok is not expected here (phase is HEADER, contestants are set);
          // if it somehow fails, state is left in HEADER with contestants confirmed so the
          // client can retry via GAME_ROLL (existing fallback path).
        } else {
          // Winner determined: stay in HEADER, store headerDuelWinner so the winning team
          // can select a target hex (GAME_HEADER_TARGET -> applyResolveHeaderTarget).
          room.gameState = {
            ...room.gameState,
            headerDuelWinner: winner,
          };
        }
      }

      // Single broadcastState per handler path (Pitfall 1 — no double-broadcast)
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });
}
