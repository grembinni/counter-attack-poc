/**
 * Pure-function game engine for Counter Attack.
 *
 * Provides all FSM transitions and state mutations as socket.io-free functions.
 * The server is the sole authority for all game logic — no client can influence
 * state transitions except by sending events that are re-validated here.
 *
 * ARCH-01: server-authoritative state — all transitions validated server-side.
 * D-12: buildInitialGameState called from roomStore.joinRoom when the second player joins.
 * D-13: attackingTeam assigned via coin flip using crypto.randomInt (never client-supplied).
 * D-14: FSM starts at KICK_OFF; applyStartMovement transitions to MOVEMENT.
 * TEAM-03: refereeCard assigned randomly at match start via crypto.randomInt(1, 7).
 */

import { randomInt } from 'crypto';
import type {
  GameState,
  GamePhase,
  MovementSlot,
  ActionEvent,
  HexCoord,
} from '@counter-attack/shared';
import {
  HOME_SQUAD,
  AWAY_SQUAD,
  PITCH_REGIONS,
  isInRegion,
  validateMove,
} from '@counter-attack/shared';

// No socket.io imports — pure functions only (ARCH-01, established Phase 2/3 pattern).

// TODO Phase 5: replace with crypto.randomInt(1, 7)
function stubDice(): number {
  return 3;
}

/** 4-5-2 Movement Phase slot sequence. Used by advanceMovementSlot. D-03/D-04. */
const SLOT_SEQUENCE: readonly MovementSlot[] = ['ATTACKER_4', 'DEFENDER_5', 'ATTACKER_2'];

/**
 * Returns the team that is allowed to act in the current movement slot.
 * ATTACKER_4 and ATTACKER_2 slots belong to the attacking team;
 * DEFENDER_5 slot belongs to the defending (non-attacking) team.
 * RESEARCH Pitfall 2 — attacker vs moving team.
 */
function activeTeamForSlot(state: GameState): 'home' | 'away' {
  if (state.movementSlot === 'DEFENDER_5') {
    return state.attackingTeam === 'home' ? 'away' : 'home';
  }
  return state.attackingTeam;
}

// ---------------------------------------------------------------------------
// buildInitialGameState
// ---------------------------------------------------------------------------

/**
 * Builds the real initial GameState when the second player joins a room.
 *
 * D-12: called from roomStore.joinRoom() immediately on second-player join.
 * D-13: attackingTeam determined by server-side coin flip — never client-supplied.
 * D-14: phase starts at 'KICK_OFF'; no player event needed to reach this state.
 * TEAM-01: all 22 players (HOME_SQUAD + AWAY_SQUAD) placed at starting positions.
 * TEAM-03: refereeCard.leniency is randomly assigned in range 1–6 at match start.
 */
export function buildInitialGameState(roomCode: string): GameState {
  const attackingTeam: 'home' | 'away' = randomInt(0, 2) === 0 ? 'home' : 'away'; // D-13 coin flip

  return {
    roomCode,
    phase: 'KICK_OFF', // D-14
    activeTeam: attackingTeam,
    attackingTeam,
    pieces: [...HOME_SQUAD, ...AWAY_SQUAD], // TEAM-01: all 22 loaded at match start
    ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: randomInt(1, 7) }, // TEAM-03: random 1–6
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    pendingFreeMove: null,
  };
}

// ---------------------------------------------------------------------------
// advanceMovementSlot
// ---------------------------------------------------------------------------

/**
 * Computes the next slot and phase when the current slot ends.
 *
 * D-03: slot sequence is ATTACKER_4 → DEFENDER_5 → ATTACKER_2.
 * D-04: after ATTACKER_2, the phase transitions to PASS automatically.
 *
 * Uses the explicit SLOT_SEQUENCE array — no if/else slot chains (STATE.md locked decision).
 */
export function advanceMovementSlot(state: GameState): {
  nextSlot: MovementSlot | null;
  nextPhase: GamePhase;
} {
  const idx = SLOT_SEQUENCE.indexOf(state.movementSlot!);
  if (idx === SLOT_SEQUENCE.length - 1) {
    return { nextSlot: null, nextPhase: 'PASS' }; // D-04: ATTACKER_2 → PASS
  }
  return { nextSlot: SLOT_SEQUENCE[idx + 1]!, nextPhase: 'MOVEMENT' }; // D-03
}

// ---------------------------------------------------------------------------
// applyStartMovement
// ---------------------------------------------------------------------------

/** Discriminated union result for applyStartMovement. */
export type ApplyStartMovementResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | { ok: true; state: GameState };

/**
 * Transitions the FSM from KICK_OFF → MOVEMENT/ATTACKER_4.
 *
 * D-14: the wire path that makes the Movement Phase reachable.
 * T-4-05: the handler (Wave 3) restricts this event to the attacking team's socket;
 *         the engine rejects it outside KICK_OFF phase.
 *
 * Appends a KICK_OFF ActionEvent to mark the kick-off→movement edge.
 */
export function applyStartMovement(state: GameState): ApplyStartMovementResult {
  if (state.phase !== 'KICK_OFF') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const event: ActionEvent = { type: 'KICK_OFF', timestamp: Date.now() };

  return {
    ok: true,
    state: {
      ...state,
      phase: 'MOVEMENT',
      movementSlot: 'ATTACKER_4',
      activeTeam: state.attackingTeam,
      eventLog: [...state.eventLog, event],
    },
  };
}

// ---------------------------------------------------------------------------
// applyMove
// ---------------------------------------------------------------------------

/** Discriminated union result for applyMove. */
export type ApplyMoveResult =
  | {
      ok: false;
      reason: 'WRONG_SLOT' | 'WRONG_TEAM' | 'PIECE_NOT_FOUND' | 'MOVE_INVALID';
      detail?: string;
    }
  | { ok: true; state: GameState };

/**
 * Applies a piece movement action.
 *
 * Guard precedence (T-4-01, D-01, D-06):
 * 1. WRONG_SLOT — phase must be MOVEMENT and movementSlot must be set
 * 2. PIECE_NOT_FOUND — pieceId must match a piece in state.pieces
 * 3. WRONG_TEAM — piece must belong to the team that acts in the current slot
 * 4. MOVE_INVALID — validateMove must accept the move
 *
 * On success: repositions the piece, increments paceUsedByPieceId, appends MOVE event.
 * MOVE-06: sets pendingFreeMove when the ball carrier crosses between final thirds (D-15).
 * T-4-03: MOVE event records server-derived from-coord — never the client's claimed position.
 * D-01: movementSlot is NOT auto-advanced on move success; applyEndTurn advances it.
 */
export function applyMove(state: GameState, pieceId: string, to: HexCoord): ApplyMoveResult {
  // 1. Phase guard
  if (state.phase !== 'MOVEMENT' || state.movementSlot === null) {
    return { ok: false, reason: 'WRONG_SLOT' };
  }

  // 2. Piece lookup
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, reason: 'PIECE_NOT_FOUND' };

  // 3. Team guard (T-4-01)
  if (piece.teamId !== activeTeamForSlot(state)) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  // 4. Delegate to validator
  const result = validateMove(state, piece, to);
  if (!result.ok) {
    return { ok: false, reason: 'MOVE_INVALID', detail: result.reason };
  }

  // 5. Build new state via spread (immutable — never mutate readonly arrays, RESEARCH Pitfall 1)
  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));

  const moveEvent: ActionEvent = {
    type: 'MOVE',
    pieceId,
    from: piece.position, // server-derived — T-4-03; client from-coord is never trusted
    to,
    slot: state.movementSlot,
    timestamp: Date.now(),
  };

  let newEventLog: readonly ActionEvent[] = [...state.eventLog, moveEvent];

  // Handle STEAL_ATTEMPT effect
  if ('effect' in result && result.effect.type === 'STEAL_ATTEMPT') {
    const dice = stubDice(); // TODO Phase 5: replace with crypto.randomInt(1, 7)
    const defender = result.effect.defenders[0];
    // Phase 4 deterministic: stubDice()==3, so combined < threshold => FAIL.
    // Phase 5 will use live dice and real thresholds.
    const stealResult: 'SUCCESS' | 'FAIL' = dice >= 4 ? 'SUCCESS' : 'FAIL';
    const stealEvent: ActionEvent = {
      type: 'STEAL_ATTEMPT',
      defenderId: defender!.id,
      result: stealResult,
      timestamp: Date.now(),
    };
    newEventLog = [...newEventLog, stealEvent];
  }

  // MOVE-06 / D-15: detect ball carrier crossing between final thirds
  let pendingFreeMove = state.pendingFreeMove ?? null;
  if (state.ball.carrierId === pieceId) {
    const fromInHomeThird = isInRegion(piece.position, 'homeThird');
    const fromInAwayThird = isInRegion(piece.position, 'awayThird');
    const toInHomeThird = isInRegion(to, 'homeThird');
    const toInAwayThird = isInRegion(to, 'awayThird');
    // Cross: must move from one final third directly into the other (not via middle third)
    if ((fromInHomeThird && toInAwayThird) || (fromInAwayThird && toInHomeThird)) {
      pendingFreeMove = { team: piece.teamId, hexesAllowed: 6 };
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      paceUsedByPieceId: {
        ...state.paceUsedByPieceId,
        [pieceId]: (state.paceUsedByPieceId[pieceId] ?? 0) + 1,
      },
      eventLog: newEventLog,
      pendingFreeMove,
    },
  };
}

// ---------------------------------------------------------------------------
// applyEndTurn
// ---------------------------------------------------------------------------

/** Discriminated union result for applyEndTurn. */
export type ApplyEndTurnResult =
  | { ok: false; reason: 'WRONG_SLOT' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

/**
 * Advances the 4-5-2 FSM to the next movement slot (or transitions to PASS).
 *
 * D-03: advances ATTACKER_4 → DEFENDER_5 → ATTACKER_2 in order.
 * D-04: ATTACKER_2 → transitions phase to 'PASS' with movementSlot null.
 *
 * Resets movedPieceIds and paceUsedByPieceId for the new slot.
 * Appends a SLOT_ADVANCE ActionEvent.
 */
export function applyEndTurn(state: GameState): ApplyEndTurnResult {
  if (state.phase !== 'MOVEMENT' || state.movementSlot === null) {
    return { ok: false, reason: 'WRONG_SLOT' };
  }

  const { nextSlot, nextPhase } = advanceMovementSlot(state);

  const slotAdvanceEvent: ActionEvent = {
    type: 'SLOT_ADVANCE',
    from: state.movementSlot,
    to: nextSlot,
    timestamp: Date.now(),
  };

  const nextActiveTeam: 'home' | 'away' =
    nextSlot === null
      ? state.activeTeam // PASS phase — keep current activeTeam until handler sets it
      : nextSlot === 'DEFENDER_5'
        ? state.attackingTeam === 'home'
          ? 'away'
          : 'home'
        : state.attackingTeam;

  return {
    ok: true,
    state: {
      ...state,
      phase: nextPhase,
      movementSlot: nextSlot,
      activeTeam: nextActiveTeam,
      eventLog: [...state.eventLog, slotAdvanceEvent],
      movedPieceIds: [],
      paceUsedByPieceId: {},
    },
  };
}

// ---------------------------------------------------------------------------
// applyUndo
// ---------------------------------------------------------------------------

/** Discriminated union result for applyUndo. */
export type ApplyUndoResult =
  | { ok: false; reason: 'UNDO_LOCKED' | 'NOTHING_TO_UNDO' }
  | { ok: true; state: GameState };

/**
 * Reverses the last MOVE event in the current movement slot.
 *
 * D-09: undo is locked if a SLOT_ADVANCE or DICE_ROLL exists since the last SLOT_ADVANCE.
 * D-10: reverses the last MOVE — restores piece position and decrements paceUsedByPieceId.
 *
 * Only looks within the current slot (events since the last SLOT_ADVANCE).
 */
export function applyUndo(state: GameState): ApplyUndoResult {
  // Find the index of the last SLOT_ADVANCE in the event log
  const lastSlotAdvanceIdx = state.eventLog.reduce<number>((acc, evt, idx) => {
    return evt.type === 'SLOT_ADVANCE' ? idx : acc;
  }, -1);

  const currentSlotEvents = state.eventLog.slice(lastSlotAdvanceIdx + 1);

  // D-09: locked if any SLOT_ADVANCE or DICE_ROLL in the current slot's events
  if (currentSlotEvents.some((e) => e.type === 'SLOT_ADVANCE' || e.type === 'DICE_ROLL')) {
    return { ok: false, reason: 'UNDO_LOCKED' };
  }

  // Find the last MOVE in the current slot
  const lastMoveRelIdx = currentSlotEvents.reduce<number>((acc, evt, idx) => {
    return evt.type === 'MOVE' ? idx : acc;
  }, -1);

  if (lastMoveRelIdx === -1) {
    // No MOVE in current slot — check if prior-slot moves are locked (slot boundary crossed)
    const hasPriorMoves = state.eventLog
      .slice(0, lastSlotAdvanceIdx + 1)
      .some((e) => e.type === 'MOVE');
    if (hasPriorMoves) {
      return { ok: false, reason: 'UNDO_LOCKED' }; // D-09: moves exist but crossed a slot boundary
    }
    return { ok: false, reason: 'NOTHING_TO_UNDO' };
  }

  const moveToUndo = currentSlotEvents[lastMoveRelIdx] as Extract<ActionEvent, { type: 'MOVE' }>;

  // Reverse piece position (D-10)
  const newPieces = state.pieces.map((p) =>
    p.id === moveToUndo.pieceId ? { ...p, position: moveToUndo.from } : p,
  );

  // Decrement pace used for this piece
  const currentPace = state.paceUsedByPieceId[moveToUndo.pieceId] ?? 0;
  const newPaceUsed = { ...state.paceUsedByPieceId };
  if (currentPace > 1) {
    newPaceUsed[moveToUndo.pieceId] = currentPace - 1;
  } else {
    delete newPaceUsed[moveToUndo.pieceId];
  }

  // Remove the MOVE event from eventLog (D-10)
  const absoluteMoveIdx = lastSlotAdvanceIdx + 1 + lastMoveRelIdx;
  const newEventLog = [
    ...state.eventLog.slice(0, absoluteMoveIdx),
    ...state.eventLog.slice(absoluteMoveIdx + 1),
  ];

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      paceUsedByPieceId: newPaceUsed,
      eventLog: newEventLog,
    },
  };
}
