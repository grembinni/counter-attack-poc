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
  PITCH_REGIONS,
  ServerEvents,
} from '@counter-attack/shared';
import type { Server, Socket } from 'socket.io';
import { broadcastState, getRoom } from './roomStore.js';
import {
  applyEndTurn,
  applyGKRestart,
  applyHalfTimeStart,
  applyKickOffReady,
  applyMove,
  applyRestartMovement,
  applyRoll,
  applySnapshot,
  applyStartMovement,
  applyUndo,
  buildReplayFrames,
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
 * Starts the post-game replay stream after FULL_TIME.
 *
 * D-30 / D-31 / D-32 / REPLAY-01: After a ~3s FULL_TIME display, streams one
 * GameState frame per second via setInterval. Each frame carries phase='REPLAY',
 * replayIndex (1-based), and replayTotal so the client can show progress.
 *
 * T-08-15: The interval handle is stored on room.replayTimer so it can be
 * cleared on disconnect (roomHandlers.ts) and on room deletion (deleteRoom).
 *
 * The ~3s setTimeout is not stored because it fires exactly once and its only
 * action is setting room.replayTimer. If the room is deleted during the 3s hold,
 * the interval will never start (room won't exist). Minor cleanup edge-case:
 * the setTimeout callback is a no-op when the room is gone.
 *
 * @param io   - Socket.io Server instance (for room-wide emit)
 * @param room - The room that just reached FULL_TIME
 */
function startReplayStream(io: AppServer, room: Room): void {
  if (room.gameState === null) return;
  const frames = buildReplayFrames(room.gameState);
  const replayTotal = frames.length;

  // ~3s delay so the FULL_TIME screen displays before replay begins (Open Question 3)
  setTimeout(() => {
    let idx = 0;
    room.replayTimer = setInterval(() => {
      if (idx >= frames.length) {
        clearInterval(room.replayTimer!);
        room.replayTimer = null;
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
      io.to(room.roomCode).emit(ServerEvents.GAME_STATE, replayFrame);
    }, 1000);
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
        (room.gameState.phase !== 'KICK_OFF' && room.gameState.phase !== 'PASS')
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
  // GAME_RESTART_MOVEMENT — resets movement phase to ATTACKER_4 (house-rule repeat)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_RESTART_MOVEMENT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return;
    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'MOVEMENT') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        return;
      }
      const result = applyRestartMovement(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
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
  // -------------------------------------------------------------------------
  socket.on(
    ClientEvents.GAME_ROLL,
    (passType?: 'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL') => {
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

        if (room.gameState.phase === 'PASS') {
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
          // D-27 / MATCH-03 / T-08-16: kick-off first-pass enforcement.
          // While kickOffActive, the ball carrier must be on the centre hex.
          if (room.gameState.kickOffActive) {
            const carrier = room.gameState.pieces.find(
              (p) => p.id === room.gameState!.ball.carrierId,
            );
            const kickOffHex = PITCH_REGIONS.kickOffHex;
            const onCentreHex =
              carrier !== undefined &&
              carrier.position.q === kickOffHex.q &&
              carrier.position.r === kickOffHex.r;
            if (!onCentreHex) {
              socket.emit(ServerEvents.GAME_ERROR, 'INVALID_KICK_OFF_PASS');
              broadcastState(io, room);
              return;
            }
          }
          // Commit the chosen pass type — applyRoll reads lastActionType to determine time cost.
          room.gameState = { ...room.gameState, lastActionType: passType };
        } else {
          // D-07 / T-08-12: sequence guards for non-PASS dice phases.
          if (room.gameState.phase === 'SHOT' && room.gameState.lastActionType !== null) {
            if (!ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('SHOT')) {
              socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
              broadcastState(io, room);
              return;
            }
          }
          if (room.gameState.phase === 'HEADER' && room.gameState.lastActionType !== null) {
            if (!ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('HEADER')) {
              socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
              broadcastState(io, room);
              return;
            }
          }
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
        // D-27 / MATCH-03: clear kickOffActive after a successful kick-off pass from centre hex.
        if (room.gameState.phase === 'PASS' && room.gameState.kickOffActive) {
          room.gameState = { ...result.state, kickOffActive: false };
        } else {
          room.gameState = result.state;
        }
        broadcastState(io, room); // ARCH-04: single broadcast entry point
      } finally {
        room.isProcessing = false; // MUST be in finally — Pitfall 5
      }
    },
  );

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
        const kicker = room.gameState.pieces.find(
          (p) => p.position.q === kickOffHex.q && p.position.r === kickOffHex.r,
        );
        room.gameState = {
          ...room.gameState,
          phase: 'KICK_OFF',
          ball: kicker ? { position: kickOffHex, carrierId: kicker.id } : room.gameState.ball,
          attackingTeam: kicker ? kicker.teamId : room.gameState.attackingTeam,
          activeTeam: kicker ? kicker.teamId : room.gameState.activeTeam,
          lastActionType: null, // D-10: fresh sequence at kick-off
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
  // GAME_SNAPSHOT — declares a Snapshot (CR-01 server end)
  //
  // T-08-21: gates on isActivePlayer (attacking team) + applySnapshot internal
  //   phase/sequence/position validation (NOT_IN_PENALTY_AREA / INVALID_SEQUENCE).
  //
  // applySnapshot transitions MOVEMENT or PASS → SHOT and sets snapshotPenalty.
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
  // GAME_HEADER — resolves the HEADER duel (CR-02)
  //
  // T-08-22: phase === 'HEADER' guard; isActivePlayer team guard; HEADER
  //   sequence guard (same guard the GAME_ROLL handler already performs for HEADER).
  //
  // Rationale (recorded per plan requirement): GAME_ROLL already covers HEADER
  // via DICE_PHASES, so GAME_HEADER is a dedicated alias that delegates to the
  // identical applyRoll resolution. Registering it (rather than removing it from
  // ClientEvents) is the lower-risk fix because the client's emitHeader and the
  // events.ts contract already exist and are shipped.
  //
  // ARCH-04: broadcastState is the single broadcast entry point.
  // SC-5: isProcessing mutex guards against double-click race.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_HEADER, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard (T-08-22): must be in HEADER phase
      if (room.gameState === null || room.gameState.phase !== 'HEADER') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Team guard (T-08-22): must be the active player
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // D-07 / T-08-12: sequence guard — HEADER is only valid after HIGH_PASS or LONG_BALL (D-17)
      if (
        room.gameState.lastActionType !== null &&
        !ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('HEADER')
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Pre-generate all three dice upfront (Pitfall 4 — mirrors GAME_ROLL pattern)
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
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });
}
