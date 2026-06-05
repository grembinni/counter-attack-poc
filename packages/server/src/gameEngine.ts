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
  PlayerPiece,
  LastActionType,
} from '@counter-attack/shared';
import {
  HOME_SQUAD,
  AWAY_SQUAD,
  PITCH_REGIONS,
  isInRegion,
  validateMove,
  computeCombinedScore,
  computeLooseBall,
  validatePassAccuracy,
  validateShotDuel,
  validateHandlingCheck,
  validateGKDive,
  validateHeading,
  hexDistance,
} from '@counter-attack/shared';
import { ELIGIBLE_NEXT_ACTIONS } from '@counter-attack/shared';

// No socket.io imports — pure functions only (ARCH-01, established Phase 2/3 pattern).

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
    phase: 'KICK_OFF_SETUP', // D-23: both teams reposition before kick-off; ready confirms advance
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
    // Phase 8 additions (D-06)
    addedTime: null, // null until actionCount first crosses 45
    lastActionType: null, // null at match start; updated after every action
    kickOffTeam: attackingTeam, // coin-flip winner kicks off (D-06, D-26)
    kickOffActive: false,
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

  // Assign ball.carrierId to the piece standing on the kick-off hex (the kicker).
  const kicker = state.pieces.find(
    (p) => p.position.q === state.ball.position.q && p.position.r === state.ball.position.r,
  );

  return {
    ok: true,
    state: {
      ...state,
      phase: 'MOVEMENT',
      movementSlot: 'ATTACKER_4',
      activeTeam: state.attackingTeam,
      ball: kicker ? { ...state.ball, carrierId: kicker.id } : state.ball,
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
 *
 * @param state  - Current game state (phase must be MOVEMENT)
 * @param pieceId - ID of the piece to move
 * @param to     - Destination hex coordinate
 * @param dice   - Optional pre-generated dice (injected for determinism — D-08/D-12).
 *                 stealDie: used for STEAL_ATTEMPT resolution.
 *                 tackleDie: used for TACKLE_ATTEMPT defender roll.
 *                 carrierDie: used for TACKLE_ATTEMPT carrier roll.
 *                 Defaults to 3 (mid-range) when omitted — backward-compatible fallback.
 */
export function applyMove(
  state: GameState,
  pieceId: string,
  to: HexCoord,
  dice?: { stealDie: number; tackleDie: number; carrierDie: number },
): ApplyMoveResult {
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

  // D-13/D-14 ball position fix: if the moving piece is the carrier, track ball to `to`.
  // Computed here for all non-contest paths; overridden on contest success paths below.
  const newBall = state.ball.carrierId === pieceId ? { ...state.ball, position: to } : state.ball;

  // Handle STEAL_ATTEMPT effect (D-06/D-07/D-08)
  let stealSuccess = false;
  let stealDefenderId: string | undefined;
  if ('effect' in result && result.effect.type === 'STEAL_ATTEMPT') {
    // Dice injection: stealDie from caller; fallback 3 for backward compat (D-08)
    const die = dice?.stealDie ?? 3;
    const defender = result.effect.defenders[0];
    // D-06: combined score >= 10 threshold; die===6 is always SUCCESS regardless of combined (D-06)
    const combined = computeCombinedScore(defender!.tackling, die, []);
    const stealResult: 'SUCCESS' | 'FAIL' = die === 6 || combined >= 10 ? 'SUCCESS' : 'FAIL';
    stealSuccess = stealResult === 'SUCCESS';
    stealDefenderId = defender!.id;
    const stealEvent: ActionEvent = {
      type: 'STEAL_ATTEMPT',
      defenderId: defender!.id,
      result: stealResult,
      defenderDie: die,
      defenderCombined: combined,
      timestamp: Date.now(),
    };
    newEventLog = [...newEventLog, stealEvent];
  }

  // Handle TACKLE_ATTEMPT effect (D-11/D-12)
  // Fires when a defender (different team than carrier) moves adjacent to the carrier.
  let tackleSuccess = false;
  if ('effect' in result && result.effect.type === 'TACKLE_ATTEMPT') {
    const defDie = dice?.tackleDie ?? 3;
    const carDie = dice?.carrierDie ?? 3;
    const carrierId = result.effect.carrierId;
    const carrier = state.pieces.find((p) => p.id === carrierId);
    // Defensive: carrier must exist (moveValidator already verified, but belt-and-suspenders)
    if (carrier !== undefined) {
      const defCombined = computeCombinedScore(piece.tackling, defDie, []);
      const carCombined = computeCombinedScore(carrier.dribbling, carDie, []);
      // D-09: defender wins on tie (defCombined >= carCombined → SUCCESS)
      const tackleResult: 'SUCCESS' | 'FAIL' = defCombined >= carCombined ? 'SUCCESS' : 'FAIL';
      tackleSuccess = tackleResult === 'SUCCESS';
      const tackleEvent: ActionEvent = {
        type: 'TACKLE_ATTEMPT',
        defenderId: pieceId,
        carrierId,
        defenderDie: defDie,
        carrierDie: carDie,
        defenderCombined: defCombined,
        carrierCombined: carCombined,
        result: tackleResult,
        timestamp: Date.now(),
      };
      newEventLog = [...newEventLog, tackleEvent];

      if (tackleSuccess) {
        // D-11: on SUCCESS, defender moves to `to`, ball possession transferred to defender
        const tackleSuccessBall = { ...state.ball, position: to, carrierId: pieceId };
        return {
          ok: true,
          state: {
            ...state,
            pieces: newPieces,
            movedPieceIds: state.movedPieceIds.includes(pieceId)
              ? state.movedPieceIds
              : [...state.movedPieceIds, pieceId],
            paceUsedByPieceId: {
              ...state.paceUsedByPieceId,
              [pieceId]: piece.pace, // full pace consumed on activation (one move per player)
            },
            ball: tackleSuccessBall,
            eventLog: newEventLog,
            pendingFreeMove: state.pendingFreeMove ?? null,
            // D-11: tackle success ends movement phase; same as steal success
            lastActionType: 'SUCCESSFUL_TACKLE',
            actionCount: state.actionCount + 3,
          },
        };
      }
      // FAIL: defender moves to `to` (newPieces already reflects this), carrier keeps ball
      // ball.position stays with the carrier (which hasn't moved) — use state.ball unchanged
      return {
        ok: true,
        state: {
          ...state,
          pieces: newPieces,
          movedPieceIds: state.movedPieceIds.includes(pieceId)
            ? state.movedPieceIds
            : [...state.movedPieceIds, pieceId],
          paceUsedByPieceId: {
            ...state.paceUsedByPieceId,
            [pieceId]: (state.paceUsedByPieceId[pieceId] ?? 0) + 1,
          },
          ball: state.ball, // carrier unchanged; ball stays with carrier
          eventLog: newEventLog,
          pendingFreeMove: state.pendingFreeMove ?? null,
        },
      };
    }
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

  // D-14/MATCH-01: successful steal ends the Movement Phase early; costs 3 min and sets SUCCESSFUL_TACKLE
  if (stealSuccess) {
    // On steal SUCCESS: ball transferred to defender (stealDefenderId) at `to` (carrier moved there)
    const stealSuccessBall = { ...state.ball, position: to, carrierId: stealDefenderId! };
    return {
      ok: true,
      state: {
        ...state,
        pieces: newPieces,
        movedPieceIds: state.movedPieceIds.includes(pieceId)
          ? state.movedPieceIds
          : [...state.movedPieceIds, pieceId],
        paceUsedByPieceId: {
          ...state.paceUsedByPieceId,
          [pieceId]: (state.paceUsedByPieceId[pieceId] ?? 0) + 1,
        },
        ball: stealSuccessBall,
        eventLog: newEventLog,
        pendingFreeMove,
        // Phase 8 fields
        lastActionType: 'SUCCESSFUL_TACKLE',
        actionCount: state.actionCount + 3, // D-14: full movement phase cost even on early end
      },
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      // CR-01: append pieceId to movedPieceIds so ATTACKER_2 ALREADY_MOVED guard works
      movedPieceIds: state.movedPieceIds.includes(pieceId)
        ? state.movedPieceIds
        : [...state.movedPieceIds, pieceId],
      paceUsedByPieceId: {
        ...state.paceUsedByPieceId,
        [pieceId]: (state.paceUsedByPieceId[pieceId] ?? 0) + 1,
      },
      ball: newBall, // D-13/D-14: ball tracks carrier; unchanged for non-carrier moves
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
 * D-04/MATCH-01: at ATTACKER_2→null, clock increments by 3 minutes.
 * D-05/MATCH-02: when actionCount first reaches 45, addedTime is set inline (injected roll).
 * Pitfall 5: half===1 → HALF_TIME; half===2 → FULL_TIME at threshold.
 * Pitfall 1: addedTimeRoll is injected by the caller — never call randomInt here.
 *
 * Resets movedPieceIds and paceUsedByPieceId for the new slot.
 * Appends a SLOT_ADVANCE ActionEvent.
 *
 * @param state          - Current game state (phase must be MOVEMENT)
 * @param options        - Optional injection: addedTimeRoll (pre-rolled d6 for added time at half 45)
 */
export function applyEndTurn(
  state: GameState,
  options?: { addedTimeRoll?: number },
): ApplyEndTurnResult {
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

  // Phase 8 clock hook (D-04/MATCH-01): at ATTACKER_2→null transition, apply +3 min
  if (nextSlot === null) {
    const newActionCount = state.actionCount + 3;

    // D-05/MATCH-02: roll added time inline when actionCount first reaches 45
    // Guard: only set addedTime once per half (Pitfall 3 — prevents re-roll)
    let newAddedTime = state.addedTime;
    if (newActionCount >= 45 && state.addedTime === null) {
      // Injected roll (Pitfall 1 — never call randomInt here; caller injects via options)
      const roll = options?.addedTimeRoll ?? 3; // default 3 for backward compatibility
      newAddedTime = roll + state.refereeCard.leniency;
    }

    // Pitfall 5: check HALF_TIME vs FULL_TIME by half
    const halfEnd = 45 + (newAddedTime ?? 0);
    if (newActionCount >= halfEnd) {
      const endPhase: GamePhase = state.half === 1 ? 'HALF_TIME' : 'FULL_TIME';
      return {
        ok: true,
        state: {
          ...state,
          phase: endPhase,
          movementSlot: null,
          activeTeam: nextActiveTeam,
          eventLog: [...state.eventLog, slotAdvanceEvent],
          movedPieceIds: [],
          paceUsedByPieceId: {},
          actionCount: newActionCount,
          addedTime: newAddedTime,
          lastActionType: 'MOVEMENT_PHASE',
        },
      };
    }

    // Normal ATTACKER_2→PASS transition with clock updates
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
        actionCount: newActionCount,
        addedTime: newAddedTime,
        lastActionType: 'MOVEMENT_PHASE',
      },
    };
  }

  // Non-ATTACKER_2 slot transition (ATTACKER_4→DEFENDER_5 or DEFENDER_5→ATTACKER_2)
  // movedPieceIds is preserved across intermediate slot boundaries so players
  // moved in ATTACKER_4 cannot be reused in ATTACKER_2 (D-12).
  // paceUsedByPieceId is reset so the new slot can track its own activations.
  return {
    ok: true,
    state: {
      ...state,
      phase: nextPhase,
      movementSlot: nextSlot,
      activeTeam: nextActiveTeam,
      eventLog: [...state.eventLog, slotAdvanceEvent],
      movedPieceIds: state.movedPieceIds, // preserved — no player can move twice in a phase
      paceUsedByPieceId: {}, // reset — new slot counts activations from zero
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

  // Remove piece from movedPieceIds when all its moves are undone (paceUsed → 0).
  // This restores selectability on the client and clears the ATTACKER_2 restriction.
  const paceAfterUndo = newPaceUsed[moveToUndo.pieceId] ?? 0;
  const newMovedPieceIds =
    paceAfterUndo === 0
      ? state.movedPieceIds.filter((id) => id !== moveToUndo.pieceId)
      : state.movedPieceIds;

  // Remove the MOVE event from eventLog (D-10)
  const absoluteMoveIdx = lastSlotAdvanceIdx + 1 + lastMoveRelIdx;
  const newEventLog = [
    ...state.eventLog.slice(0, absoluteMoveIdx),
    ...state.eventLog.slice(absoluteMoveIdx + 1),
  ];

  // CR-03: clear pendingFreeMove when the undone piece is the ball carrier —
  // the final-third crossing that set it never happened once the move is reversed.
  const undoPendingFreeMove =
    state.ball.carrierId === moveToUndo.pieceId ? null : (state.pendingFreeMove ?? null);

  // Move ball back with the carrier when undoing their move
  const newBallAfterUndo =
    state.ball.carrierId === moveToUndo.pieceId
      ? { ...state.ball, position: moveToUndo.from }
      : state.ball;

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      paceUsedByPieceId: newPaceUsed,
      movedPieceIds: newMovedPieceIds,
      eventLog: newEventLog,
      pendingFreeMove: undoPendingFreeMove,
      ball: newBallAfterUndo,
    },
  };
}

// ---------------------------------------------------------------------------
// applyRoll
// ---------------------------------------------------------------------------

/** Discriminated union result for applyRoll. */
export type ApplyRollResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'WRONG_TEAM' }
  | { ok: true; state: GameState };

/**
 * Applies a dice roll to the current state, dispatching by phase to the correct
 * resolution branch: PASS → accuracy check; SHOT → duel; HEADER → heading duel;
 * LOOSE_BALL → direction + distance.
 *
 * ARCH-01: applyRoll is pure — it does NOT call rollDice() itself. All dice must
 * be pre-generated by the caller (Task 3 handler) and passed in as ...dice.
 * This keeps the engine deterministic for unit tests.
 *
 * D-10: Single broadcast after every resolution; lastDiceRoll embedded on every ok:true return.
 * D-13: Shot and heading ties produce LOOSE_BALL.
 * D-19/D-20: Loose Ball uses two dice (direction + distance).
 * D-27/D-28: Heading duel — attacker vs nearest defender; GK aerial challenge on attacker win.
 *
 * @param state - Current game state (phase must be PASS | SHOT | HEADER | LOOSE_BALL)
 * @param dice - Pre-generated dice values (up to 3; different branches consume different counts)
 */
export function applyRoll(state: GameState, ...dice: number[]): ApplyRollResult {
  const [d1 = 3, d2 = 3, d3 = 3] = dice;

  switch (state.phase) {
    // -------------------------------------------------------------------------
    // PASS: accuracy check → action-choice on accurate; LOOSE_BALL on inaccurate (D-12, D-09)
    //
    // D-09/Pitfall 8: accurate STANDARD pass MUST NOT transition to SHOT.
    // After an accurate pass, the phase returns to a neutral action-choice state (PASS)
    // so the ball carrier's team can choose their next action. Shot is only reachable
    // via game:shot (from MOVEMENT) or applySnapshot.
    //
    // Time cost: +1 min for STANDARD/HIGH/LONG pass; +0 for FIRST_TIME pass.
    // The pass type was stored in GameState (lastActionType) at decision time (plan 08-04 handlers).
    // In this pure-engine roll, we infer time cost from lastActionType if already set,
    // otherwise default to +1 (the common case for STANDARD/HIGH/LONG passes).
    // -------------------------------------------------------------------------
    case 'PASS': {
      const carrier = state.pieces.find((p) => p.id === state.ball.carrierId);
      if (!carrier) return { ok: false, reason: 'WRONG_PHASE' };

      // Determine time cost based on lastActionType (if set by handler before applyRoll call)
      // FIRST_TIME_PASS costs +0; all other pass types cost +1 (D-03 table)
      // If lastActionType is not a pass type yet, handler hasn't set it — default to +1
      const passTimeCost: number = state.lastActionType === 'FIRST_TIME_PASS' ? 0 : 1;

      // Use HIGH pass accuracy check (carrier.highPass attribute).
      // Per D-12: accuracy determines pass result; exact type is stored in lastActionType by handler.
      const accuracyResult = validatePassAccuracy(carrier, 'HIGH', d1, []);

      if (accuracyResult.accurate) {
        // D-09/Pitfall 8: accurate pass returns to NEUTRAL ACTION-CHOICE state (NOT SHOT).
        // Determine the lastActionType for this pass:
        // - If already set by the handler (plan 08-04), use it as-is (handler sets before calling)
        // - If null/unset, default to 'STANDARD_PASS' (most common pass type in current code)
        const newLastActionType: LastActionType =
          state.lastActionType !== null &&
          ['STANDARD_PASS', 'HIGH_PASS', 'LONG_BALL', 'FIRST_TIME_PASS'].includes(
            state.lastActionType,
          )
            ? state.lastActionType
            : 'STANDARD_PASS';

        // After HIGH_PASS, phase should be HEADER (next mandatory action); others → PASS (action choice)
        const newPhase: GamePhase = newLastActionType === 'HIGH_PASS' ? 'HEADER' : 'PASS';

        return {
          ok: true,
          state: {
            ...state,
            phase: newPhase,
            lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
            lastActionType: newLastActionType,
            actionCount: state.actionCount + passTimeCost,
          },
        };
      } else {
        // Inaccurate → LOOSE_BALL phase; landing resolved on the next game:roll with fresh dice (D-15, D-19)
        // Ball stays at incident hex; do NOT compute landing here (accuracy die d1 is biased)
        // Only the accuracy die (d1) is consumed here; d2 is reserved for the fresh LOOSE_BALL roll
        // Note: DEFLECTION is set when LOOSE_BALL resolves (next roll), not here
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
            actionCount: state.actionCount + passTimeCost,
            // lastActionType stays as-is until LOOSE_BALL resolves to DEFLECTION
          },
        };
      }
    }

    // -------------------------------------------------------------------------
    // SHOT: shooter vs GK duel (SHOT-01/D-13/D-17); GOAL/LOOSE_BALL/SAVE/MISS
    // -------------------------------------------------------------------------
    case 'SHOT': {
      const shooter = state.pieces.find((p) => p.id === state.ball.carrierId);
      if (!shooter) return { ok: false, reason: 'WRONG_PHASE' };

      // Find the opposing GK (role:'GK' on the non-attacking team)
      const opposingTeam = state.attackingTeam === 'home' ? 'away' : 'home';
      const gk = state.pieces.find((p) => p.teamId === opposingTeam && p.role === 'GK');
      if (!gk) return { ok: false, reason: 'WRONG_PHASE' };

      // Pre-generate all dice upfront (Pitfall 4): shooterDice, gkDice, handlingDice
      const shooterDice = d1;
      const gkDice = d2;
      const handlingDice = d3;

      // SHOT-04: GK dive penalty based on distance from GK to shooter
      const distance = hexDistance(gk.position, shooter.position);
      const diveResult = validateGKDive(gk, distance);
      const gkPenalties = diveResult.saveable ? [diveResult.savingPenalty] : [];

      // D-19: shot costs +0 min; actionCount unchanged throughout SHOT branch
      // Apply -1 penalty if state.snapshotPenalty is set (SNAP-02)
      const shooterPenalties: number[] = state.snapshotPenalty ? [-1] : [];
      const shotResultWithPenalty = validateShotDuel(
        shooter,
        gk,
        shooterDice,
        gkDice,
        shooterPenalties,
        gkPenalties,
      );

      if (shotResultWithPenalty.outcome === 'GOAL') {
        // Increment score; transition to KICK_OFF_SETUP for repositioning (D-23)
        const newScore = {
          ...state.score,
          [state.attackingTeam]: state.score[state.attackingTeam] + 1,
        };
        return {
          ok: true,
          state: {
            ...state,
            phase: 'KICK_OFF_SETUP',
            score: newScore,
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
            lastActionType: null, // D-19: GOAL resets the sequence
            snapshotPenalty: false, // clear snapshot penalty after shot resolves
          },
        };
      }

      if (shotResultWithPenalty.outcome === 'LOOSE_BALL') {
        // Tie → LOOSE_BALL phase; landing resolved on the next game:roll with fresh dice (D-13, D-19)
        // Ball stays at incident hex; do NOT compute landing here (biased dice reuse avoided)
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
            snapshotPenalty: false,
          },
        };
      }

      if (shotResultWithPenalty.outcome === 'MISS') {
        // AUTO_MISS (dice===1) → MOVEMENT; no possession change
        return {
          ok: true,
          state: {
            ...state,
            phase: 'MOVEMENT',
            movementSlot: 'ATTACKER_4',
            movedPieceIds: [],
            paceUsedByPieceId: {},
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
            snapshotPenalty: false,
          },
        };
      }

      // SAVE: run handling check (shotResult.outcome === 'SAVE', needsHandlingCheck: true)
      if (shotResultWithPenalty.outcome === 'SAVE') {
        const handling = validateHandlingCheck(gk, handlingDice);
        if (handling.caught) {
          // GK caught — ball now held by GK; transition to GK_RESTART
          return {
            ok: true,
            state: {
              ...state,
              phase: 'GK_RESTART',
              ball: { position: gk.position, carrierId: gk.id },
              lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
              snapshotPenalty: false,
            },
          };
        } else {
          // Spill → LOOSE_BALL phase; landing deferred to a fresh game:roll with independent dice.
          // Mirrors the SHOT tie path (D-13/D-19) — avoids biased reuse of shot-duel dice (T-08-23).
          // The LOOSE_BALL case (~line 912) will call computeLooseBall on a new d1/d2 pair.
          return {
            ok: true,
            state: {
              ...state,
              phase: 'LOOSE_BALL',
              ball: { position: gk.position, carrierId: null },
              lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
              snapshotPenalty: false,
            },
          };
        }
      }

      // Exhaustive guard — TypeScript should narrow this to never; belt-and-suspenders
      return { ok: false, reason: 'WRONG_PHASE' };
    }

    // -------------------------------------------------------------------------
    // HEADER: attacker vs nearest defender; GK aerial on attacker win (D-27/D-28)
    // -------------------------------------------------------------------------
    case 'HEADER': {
      // The ball carrier is the attacker initiating the header
      const attacker = state.pieces.find((p) => p.id === state.ball.carrierId);
      if (!attacker) return { ok: false, reason: 'WRONG_PHASE' };

      // Find the opposing GK for aerial challenge (D-28)
      const opposingTeam = state.attackingTeam === 'home' ? 'away' : 'home';
      const gk = state.pieces.find((p) => p.teamId === opposingTeam && p.role === 'GK');
      if (!gk) return { ok: false, reason: 'WRONG_PHASE' };

      // Find the nearest defending outfielder (nearest to ball position, excluding the GK)
      const defenders = state.pieces.filter((p) => p.teamId === opposingTeam && p.role !== 'GK');
      let nearestDefender: PlayerPiece | undefined;
      let nearestDist = Infinity;
      for (const def of defenders) {
        const dist = hexDistance(def.position, state.ball.position);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestDefender = def;
        }
      }

      // Pre-generate all dice upfront (Pitfall 4)
      const attackerDice = d1;
      const defenderDice = d2;
      const gkDice = d3;

      if (!nearestDefender || nearestDist > 2) {
        // Uncontested — attacker wins automatically (HEAD-02)
        // Lock the attacker's combined score; GK rolls aerial challenge (D-28)
        const attackerScore = computeCombinedScore(attacker.heading, attackerDice, []);
        const gkScore = computeCombinedScore(gk.aerialAbility, gkDice, []);

        if (gkScore >= attackerScore) {
          // GK wins aerial → GK catches, transition to GK_RESTART
          return {
            ok: true,
            state: {
              ...state,
              phase: 'GK_RESTART',
              ball: { position: gk.position, carrierId: gk.id },
              lastDiceRoll: {
                rolls: [attackerDice, defenderDice, gkDice],
                context: 'HEADING_DUEL',
              },
              lastActionType: 'HEADER', // D-17: header costs +0 min
            },
          };
        } else {
          // Attacker wins heading duel vs GK → GOAL; transition to KICK_OFF_SETUP (D-23)
          const newScore = {
            ...state.score,
            [state.attackingTeam]: state.score[state.attackingTeam] + 1,
          };
          return {
            ok: true,
            state: {
              ...state,
              phase: 'KICK_OFF_SETUP',
              score: newScore,
              ball: { position: state.ball.position, carrierId: null },
              lastDiceRoll: {
                rolls: [attackerDice, defenderDice, gkDice],
                context: 'HEADING_DUEL',
              },
              lastActionType: null, // GOAL resets sequence (D-19)
            },
          };
        }
      }

      // Contested: call validateHeading to get penaltyModifier (HEAD-01)
      const headResult = validateHeading(state, attacker, state.ball.position, {
        previousActionWasHeadedPass: false,
        otherChallengerIds: [nearestDefender.id],
      });

      if (!headResult.ok) {
        // validateHeading rejected (OUT_OF_RANGE or CONSECUTIVE_HEADER) → MOVEMENT
        return {
          ok: true,
          state: {
            ...state,
            phase: 'MOVEMENT',
            movementSlot: 'ATTACKER_4',
            movedPieceIds: [],
            paceUsedByPieceId: {},
            lastDiceRoll: { rolls: [attackerDice, defenderDice, gkDice], context: 'HEADING_DUEL' },
            lastActionType: 'HEADER', // D-17: header resolved (even if rejected by validator)
          },
        };
      }

      // Compute contested heading scores
      const penaltyMod = headResult.contested ? headResult.penaltyModifier : 0;
      const attackerScore = computeCombinedScore(attacker.heading, attackerDice, [penaltyMod]);
      const defenderScore = computeCombinedScore(nearestDefender.heading, defenderDice, []);

      if (attackerScore > defenderScore) {
        // Attacker wins outfield duel — now GK aerial challenge (D-28)
        const lockedScore = attackerScore;
        const gkScore = computeCombinedScore(gk.aerialAbility, gkDice, []);

        if (gkScore >= lockedScore) {
          // GK wins aerial → GK catches
          return {
            ok: true,
            state: {
              ...state,
              phase: 'GK_RESTART',
              ball: { position: gk.position, carrierId: gk.id },
              lastDiceRoll: {
                rolls: [attackerDice, defenderDice, gkDice],
                context: 'HEADING_DUEL',
              },
              lastActionType: 'HEADER', // D-17
            },
          };
        } else {
          // Attacker beats GK → GOAL; transition to KICK_OFF_SETUP (D-23)
          const newScore = {
            ...state.score,
            [state.attackingTeam]: state.score[state.attackingTeam] + 1,
          };
          return {
            ok: true,
            state: {
              ...state,
              phase: 'KICK_OFF_SETUP',
              score: newScore,
              ball: { position: state.ball.position, carrierId: null },
              lastDiceRoll: {
                rolls: [attackerDice, defenderDice, gkDice],
                context: 'HEADING_DUEL',
              },
              lastActionType: null, // GOAL resets sequence
            },
          };
        }
      } else if (attackerScore < defenderScore) {
        // Defender wins → MOVEMENT
        return {
          ok: true,
          state: {
            ...state,
            phase: 'MOVEMENT',
            movementSlot: 'ATTACKER_4',
            movedPieceIds: [],
            paceUsedByPieceId: {},
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: [attackerDice, defenderDice, gkDice], context: 'HEADING_DUEL' },
            lastActionType: 'HEADER', // D-17
          },
        };
      } else {
        // Tie → LOOSE_BALL phase; landing resolved on the next game:roll with fresh dice (D-13, D-19)
        // Ball stays at incident hex; do NOT compute landing here (duel dice are biased)
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: [attackerDice, defenderDice, gkDice], context: 'HEADING_DUEL' },
            lastActionType: 'HEADER', // D-17
          },
        };
      }
    }

    // -------------------------------------------------------------------------
    // LOOSE_BALL: direction + distance dice → compute landing hex (D-19/D-20/D-21)
    // D-20: sets lastActionType 'DEFLECTION' once landing is computed; actionCount += 0
    // -------------------------------------------------------------------------
    case 'LOOSE_BALL': {
      const landing = computeLooseBall(
        state.ball.position,
        d1 as 1 | 2 | 3 | 4 | 5 | 6,
        d2 as 1 | 2 | 3 | 4 | 5 | 6,
      );
      return {
        ok: true,
        state: {
          ...state,
          phase: 'MOVEMENT',
          movementSlot: 'ATTACKER_4',
          movedPieceIds: [],
          paceUsedByPieceId: {},
          ball: { position: landing, carrierId: null },
          attackingTeam: state.attackingTeam, // unchanged
          lastDiceRoll: { rolls: [d1, d2], context: 'LOOSE_BALL' },
          lastActionType: 'DEFLECTION', // D-20: LOOSE_BALL resolves → DEFLECTION
          // actionCount unchanged (+0 for Deflection per D-03 table)
        },
      };
    }

    // -------------------------------------------------------------------------
    // Default: reject any other phase (Pitfall 8 — explicit, no silent no-op)
    // -------------------------------------------------------------------------
    default:
      return { ok: false, reason: 'WRONG_PHASE' };
  }
}

// ---------------------------------------------------------------------------
// applyGKRestart
// ---------------------------------------------------------------------------

/** Discriminated union result for applyGKRestart. */
export type ApplyGKRestartResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'WRONG_TEAM' | 'INVALID_CHOICE' }
  | { ok: true; state: GameState };

/**
 * Applies a GK restart choice after the goalkeeper catches the ball (SHOT-05).
 *
 * The GK's team chooses one of three options when `GameState.phase === 'GK_RESTART'`:
 * - 'kick': High Pass accuracy check (GK's highPass attribute); accurate → MOVEMENT with
 *   ball held by GK; inaccurate → Loose Ball from GK position, MOVEMENT.
 * - 'throw': uninterceptable delivery; v1 = movement-phase start with ball held by GK.
 *   targetHex delivery (D-25 full intent) deferred to Phase 7. Intentionally equivalent
 *   to 'movement' in engine state today — kept distinct for Phase 7 extension point.
 * - 'movement': GK's team starts a Movement Phase immediately (no dice needed, D-26).
 *
 * ARCH-01: applyGKRestart is pure — it does NOT call rollDice() itself. The rollDie
 * function is injected by the caller (handler passes rollDice) so the engine stays
 * deterministic for unit tests.
 *
 * D-22: triggered by the game:gk-restart Socket.io event.
 * D-23: team guard is the handler's responsibility (controlsGKTeam); engine trusts
 *       the GK piece is correct via ball.carrierId lookup.
 * D-24: kick uses validatePassAccuracy(gk, 'HIGH', rollDie(), []) — GK's highPass
 *       attribute means kicks are almost always inaccurate, making throw/movement
 *       meaningful alternatives. Range restriction (no kick into opposite final third)
 *       is deferred per CONTEXT.md Deferred Ideas.
 * D-25: throw sets ball.carrierId = gk.id (no separate accuracy roll; no targetHex in v1).
 * D-26: movement transitions phase to MOVEMENT with attackingTeam = GK's team.
 *
 * @param state   - Current game state (phase must be GK_RESTART)
 * @param choice  - One of 'kick' | 'throw' | 'movement'
 * @param rollDie - Injected d6 function; called 1 time for kick accuracy + 2 more on inaccurate
 */
export function applyGKRestart(
  state: GameState,
  choice: 'kick' | 'throw' | 'movement',
  rollDie: () => number,
): ApplyGKRestartResult {
  // 1. Phase guard (D-23)
  if (state.phase !== 'GK_RESTART') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // 2. Validate choice (ASVS V5 — never trust client input; validated here and in handler)
  if (choice !== 'kick' && choice !== 'throw' && choice !== 'movement') {
    return { ok: false, reason: 'INVALID_CHOICE' };
  }

  // 3. Look up the GK piece via ball.carrierId (Open Question 3 resolution: derive GK team
  //    from ball ownership rather than storing a separate gkTeam field)
  const gk = state.pieces.find((p) => p.id === state.ball.carrierId);
  if (!gk) {
    // Defensive: GK_RESTART requires a ball carrier; malformed state
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const gkTeam = gk.teamId;

  // ---- 'movement' branch (D-26) ----
  // D-21: GK movement = +0 min; lastActionType = null (fresh sequence)
  if (choice === 'movement') {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'MOVEMENT',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        paceUsedByPieceId: {},
        attackingTeam: gkTeam,
        activeTeam: gkTeam,
        // Ball stays with GK (carrierId unchanged)
        lastDiceRoll: null,
        lastActionType: null, // D-21: GK movement = fresh sequence
        // actionCount unchanged (+0 per D-03 table)
      },
    };
  }

  // ---- 'throw' branch (D-25) ----
  // D-21: Quick Throw = +0 min; lastActionType = 'STANDARD_PASS'
  // v1 SCOPE CONSTRAINT (deliberate): throw = movement-phase start with ball held by GK.
  // targetHex delivery is deferred to Phase 7 (click-to-target UI). 'throw' and 'movement'
  // produce identical engine state today; they are kept distinct so Phase 7 only has to
  // extend the 'throw' branch (add targetHex parameter), not reintroduce it.
  if (choice === 'throw') {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'MOVEMENT',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        paceUsedByPieceId: {},
        attackingTeam: gkTeam,
        activeTeam: gkTeam,
        // Ball stays with GK; uninterceptable (D-25), no accuracy roll
        lastDiceRoll: null,
        lastActionType: 'STANDARD_PASS', // D-21: throw treated as standard pass for sequence
        // actionCount unchanged (+0 per D-03 table)
      },
    };
  }

  // ---- 'kick' branch (D-24) ----
  // GK kick = High Pass accuracy check using GK's highPass attribute + injected dice roll.
  // D-21: GK kick = +1 min; accurate → MOVEMENT_PHASE; inaccurate → DEFLECTION
  const kickDice = rollDie();
  const accuracyResult = validatePassAccuracy(gk, 'HIGH', kickDice, []);

  if (accuracyResult.accurate) {
    // Accurate kick: ball stays with GK (v1 — intended target delivery is implicit in
    // the subsequent movement/pass phase). Phase → MOVEMENT; attackingTeam = GK team.
    return {
      ok: true,
      state: {
        ...state,
        phase: 'MOVEMENT',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        paceUsedByPieceId: {},
        attackingTeam: gkTeam,
        activeTeam: gkTeam,
        // Ball stays with GK for the movement phase (similar to accurate throw delivery)
        lastDiceRoll: { rolls: [kickDice], context: 'GK_KICK' },
        lastActionType: 'MOVEMENT_PHASE', // D-21: accurate kick = MOVEMENT_PHASE
        actionCount: state.actionCount + 1, // D-21: GK kick = +1 min
      },
    };
  } else {
    // Inaccurate kick: Loose Ball from GK's current position (D-24, D-15 same as inaccurate High Pass)
    const directionDice = rollDie();
    const distanceDice = rollDie();
    const landing = computeLooseBall(
      gk.position,
      directionDice as 1 | 2 | 3 | 4 | 5 | 6,
      distanceDice as 1 | 2 | 3 | 4 | 5 | 6,
    );
    return {
      ok: true,
      state: {
        ...state,
        phase: 'MOVEMENT',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        paceUsedByPieceId: {},
        attackingTeam: gkTeam,
        activeTeam: gkTeam,
        ball: { position: landing, carrierId: null },
        lastDiceRoll: { rolls: [kickDice, directionDice, distanceDice], context: 'GK_KICK' },
        lastActionType: 'DEFLECTION', // D-21: inaccurate kick = DEFLECTION
        actionCount: state.actionCount + 1, // D-21: GK kick = +1 min (even when inaccurate)
      },
    };
  }
}

// ---------------------------------------------------------------------------
// applySnapshot
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applySnapshot.
 * SNAP-01: rejects if conditions are not met.
 * SNAP-02: on success, transitions to SHOT with -1 penalty marker.
 */
export type ApplySnapshotResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'NOT_IN_PENALTY_AREA' | 'INVALID_SEQUENCE' }
  | { ok: true; state: GameState };

/**
 * Declares a Snapshot shot from the current game state.
 *
 * SNAP-01: Valid when:
 *   (a) phase === 'MOVEMENT' AND ball-carrier is in the opponent's penalty area, OR
 *   (b) immediately after an accurate pass (lastActionType is a pass type) AND phase === 'PASS'
 *
 * SNAP-02: On success, transitions to phase 'SHOT' with snapshotPenalty: true.
 *   The SHOT branch in applyRoll applies the -1 dice penalty (T-08-04: server-authoritative).
 *
 * SNAP-03: All standard shot rules apply — handled entirely in applyRoll SHOT branch.
 *
 * D-18: Snapshot costs +0 min; actionCount unchanged.
 *
 * T-08-04 (Tampering): The snapshot penalty marker is set server-side and consumed
 *   server-side — the client cannot omit or bypass it.
 *
 * Validation order (fail-fast):
 * 1. Sequence guard (INVALID_SEQUENCE) — check ELIGIBLE_NEXT_ACTIONS
 * 2. Phase/position guard (WRONG_PHASE | NOT_IN_PENALTY_AREA)
 */
export function applySnapshot(state: GameState): ApplySnapshotResult {
  // 1. Sequence guard: if lastActionType is set, verify SNAPSHOT is eligible
  if (state.lastActionType !== null) {
    const eligible = ELIGIBLE_NEXT_ACTIONS[state.lastActionType];
    if (!eligible.has('SNAPSHOT')) {
      return { ok: false, reason: 'INVALID_SEQUENCE' };
    }
  }

  // Pass types eligible for immediately-post-pass SNAP-01 trigger
  const passTypes: ReadonlySet<LastActionType> = new Set([
    'STANDARD_PASS',
    'FIRST_TIME_PASS',
    'HIGH_PASS',
    'LONG_BALL',
    'HEADER',
    'DEFLECTION',
    'SUCCESSFUL_TACKLE',
    'MOVEMENT_PHASE',
  ]);

  // 2. Phase/position guard
  if (state.phase === 'MOVEMENT') {
    // SNAP-01 trigger (a): ball-carrier must be in the opponent's penalty area
    const carrier = state.pieces.find((p) => p.id === state.ball.carrierId);
    if (!carrier) {
      return { ok: false, reason: 'WRONG_PHASE' };
    }

    // Determine opponent's penalty area based on attacking team
    const penaltyRegion = state.attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';

    if (!isInRegion(carrier.position, penaltyRegion)) {
      return { ok: false, reason: 'NOT_IN_PENALTY_AREA' };
    }

    // Valid MOVEMENT snapshot
    return {
      ok: true,
      state: {
        ...state,
        phase: 'SHOT',
        lastActionType: 'SNAPSHOT', // D-18
        snapshotPenalty: true, // SNAP-02: -1 dice penalty in applyRoll SHOT branch
        // actionCount unchanged (+0 per D-18)
      },
    };
  }

  if (state.phase === 'PASS') {
    // SNAP-01 trigger (b): immediately after an accurate pass (PASS phase = accurate pass resolved)
    if (state.lastActionType !== null && passTypes.has(state.lastActionType)) {
      return {
        ok: true,
        state: {
          ...state,
          phase: 'SHOT',
          lastActionType: 'SNAPSHOT', // D-18
          snapshotPenalty: true, // SNAP-02
          // actionCount unchanged
        },
      };
    }
    // In PASS phase but lastActionType not a pass type → invalid
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // Any other phase is not valid for a snapshot
  return { ok: false, reason: 'WRONG_PHASE' };
}

// ---------------------------------------------------------------------------
// applyKickOffReady
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyKickOffReady.
 * MATCH-03: validates kick-off setup placement rules for one team.
 */
export type ApplyKickOffReadyResult =
  | {
      ok: false;
      reason: 'WRONG_PHASE' | 'CENTRE_HEX_EMPTY' | 'OUT_OF_ZONE' | 'IN_CENTRE_CIRCLE';
    }
  | { ok: true; state: GameState };

/**
 * Validates a team's kick-off setup placement and records them as ready.
 *
 * MATCH-03 / D-23 / D-24 / D-25: Server-side placement rule enforcement.
 * Returns ok:true with state unchanged — the both-ready → KICK_OFF transition
 * is owned by the handler (via Room.readyPlayers per Pattern 4 in PATTERNS.md).
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be 'KICK_OFF_SETUP'
 * 2. OUT_OF_ZONE — all of team's pieces must be in team's own half
 * 3. CENTRE_HEX_EMPTY — attacking team must have exactly one piece on kickOffHex {q:18,r:13}
 * 4. IN_CENTRE_CIRCLE — defending team must have no piece inside the centre circle
 *
 * Half boundaries (D-23):
 *   home (attackingTeam='home'): own half = q <= 18 (kickOffHex.q)
 *   away (attackingTeam='away'): own half = q >= 18 (kickOffHex.q)
 *
 * T-08-06 (Tampering): All placement checks are server-side; client zone tinting is UX-only.
 *
 * @param state - Current game state (phase must be KICK_OFF_SETUP)
 * @param team  - Which team's placement to validate ('home' | 'away')
 */
export function applyKickOffReady(
  state: GameState,
  team: 'home' | 'away',
): ApplyKickOffReadyResult {
  // 1. Phase guard
  if (state.phase !== 'KICK_OFF_SETUP') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  const kickOffHex = PITCH_REGIONS.kickOffHex; // {q:18, r:13}
  const teamPieces = state.pieces.filter((p) => p.teamId === team);
  const isAttacking = team === state.attackingTeam;

  // 2. OUT_OF_ZONE: pieces must be in their own half.
  // Attacking team: can occupy up to and including q=18 (kickOffHex boundary).
  // Defending team: must be strictly behind the line (q < 18 for home, q > 18 for away).
  for (const piece of teamPieces) {
    if (team === 'home') {
      const limit = isAttacking ? kickOffHex.q : kickOffHex.q - 1;
      if (piece.position.q > limit) return { ok: false, reason: 'OUT_OF_ZONE' };
    } else {
      const limit = isAttacking ? kickOffHex.q : kickOffHex.q + 1;
      if (piece.position.q < limit) return { ok: false, reason: 'OUT_OF_ZONE' };
    }
  }

  if (isAttacking) {
    // 3. CENTRE_HEX_EMPTY: attacking team must have exactly one piece on kickOffHex (D-25)
    const onCentreHex = teamPieces.some(
      (p) => p.position.q === kickOffHex.q && p.position.r === kickOffHex.r,
    );
    if (!onCentreHex) {
      return { ok: false, reason: 'CENTRE_HEX_EMPTY' };
    }
  } else {
    // 4. IN_CENTRE_CIRCLE: defending team must have no piece inside the centre circle (D-23)
    for (const piece of teamPieces) {
      if (isInRegion(piece.position, 'centreCircle')) {
        return { ok: false, reason: 'IN_CENTRE_CIRCLE' };
      }
    }
  }

  // All placement rules satisfied — return ok:true with state unchanged.
  // The handler (08-04) tracks both-ready via Room.readyPlayers and triggers KICK_OFF transition.
  return { ok: true, state };
}

// ---------------------------------------------------------------------------
// applyHalfTimeStart
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyHalfTimeStart.
 * MATCH-04: second-half transition from HALF_TIME.
 */
export type ApplyHalfTimeStartResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | { ok: true; state: GameState };

/**
 * Transitions the FSM from HALF_TIME to KICK_OFF_SETUP for the second half.
 *
 * MATCH-04 / D-26 / D-28 / D-29: Second-half start procedure.
 *
 * Resets applied:
 * - attackingTeam = opposite of kickOffTeam (D-26: opposing team kicks off second half)
 * - half = 2 (D-29)
 * - actionCount = 0 (D-29)
 * - addedTime = null (D-29)
 * - phase = 'KICK_OFF_SETUP' (D-10: begins repositioning before second-half kick-off)
 * - lastActionType = null (D-10: fresh action sequence at kick-off)
 * - pieces = 4-5-2 default starting positions from teams.ts (Pitfall 6 reset)
 *
 * The handler (08-04) enforces that only the non-kick-off team can trigger this.
 *
 * @param state - Current game state (phase must be HALF_TIME)
 */
export function applyHalfTimeStart(state: GameState): ApplyHalfTimeStartResult {
  // Phase guard
  if (state.phase !== 'HALF_TIME') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // D-26: second half kick-off by the team that did NOT kick off in the first half
  const newAttackingTeam: 'home' | 'away' = state.kickOffTeam === 'home' ? 'away' : 'home';

  // Reset pieces to 4-5-2 default positions from teams.ts (Pitfall 6)
  const resetPieces = [...HOME_SQUAD, ...AWAY_SQUAD];

  return {
    ok: true,
    state: {
      ...state,
      phase: 'KICK_OFF_SETUP', // D-10: setup before second-half kick-off
      attackingTeam: newAttackingTeam, // D-26
      activeTeam: newAttackingTeam,
      half: 2, // D-29
      actionCount: 0, // D-29
      addedTime: null, // D-29
      lastActionType: null, // D-10: fresh sequence
      kickOffActive: false,
      movedPieceIds: [],
      paceUsedByPieceId: {},
      movementSlot: null,
      pieces: resetPieces, // Pitfall 6: reset to 4-5-2 formation starting positions
    },
  };
}

// ---------------------------------------------------------------------------
// buildReplayFrames
// ---------------------------------------------------------------------------

/** Non-SLOT_ADVANCE event types that produce replay frames (D-32). */
const REPLAY_ELIGIBLE_TYPES = new Set<string>([
  'MOVE',
  'DICE_ROLL',
  'STEAL_ATTEMPT',
  'GOAL',
  'KICK_OFF',
  'HIGH_PASS',
  'LONG_BALL',
  'STANDARD_PASS',
  'FIRST_TIME_PASS',
  'SHOT_ATTEMPT',
  'SNAPSHOT',
  'HALF_TIME',
  'FULL_TIME',
]);

/**
 * Reconstructs a sequence of GameState frames from the event log for replay.
 *
 * REPLAY-02 / REPLAY-03 / D-31 / D-32: Deterministic state reconstruction.
 *
 * - Starts from buildInitialGameState seeded with finalState.kickOffTeam and roomCode.
 * - Iterates finalState.eventLog.
 * - Emits a snapshot GameState frame (with phase='REPLAY') for each replay-eligible event.
 * - Skips SLOT_ADVANCE events — they produce no board change and no frame (D-32).
 * - Pure function: no setInterval here — the handler (08-04) owns timing.
 * - Deterministic: same eventLog always yields identical frame sequence (REPLAY-03).
 *
 * Implementation note (A2 from RESEARCH.md):
 * Rather than re-running full engine transitions (which would require injecting dice
 * from the eventLog — complex and fragile), we reconstruct the visible board state
 * incrementally by applying MOVE events (repositioning pieces) and resetting on GOAL/KICK_OFF.
 * DICE_ROLL, STEAL_ATTEMPT, and other events carry their result in the eventLog for display.
 * This matches the replay goal: showing board state changes, not re-simulating dice.
 *
 * @param finalState - The final (FULL_TIME or later) game state containing the complete eventLog.
 * @returns Array of GameState frames — one per replay-eligible event, all tagged phase='REPLAY'.
 */
export function buildReplayFrames(finalState: GameState): GameState[] {
  const frames: GameState[] = [];

  // Seed the reconstruction from the initial game state using the same kickOffTeam assignment.
  // We override the coin-flip by using a deterministic seed approach:
  // buildInitialGameState uses randomInt for attackingTeam, so we cannot call it directly
  // and expect determinism. Instead, we build a seeded initial state manually.
  // A2 (RESEARCH.md): kickOffTeam is recorded in finalState; use it to seed the initial attackingTeam.
  let current: GameState = {
    roomCode: finalState.roomCode,
    phase: 'KICK_OFF',
    activeTeam: finalState.kickOffTeam,
    attackingTeam: finalState.kickOffTeam,
    pieces: [...HOME_SQUAD, ...AWAY_SQUAD],
    ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: finalState.refereeCard,
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    pendingFreeMove: null,
    addedTime: null,
    lastActionType: null,
    kickOffTeam: finalState.kickOffTeam,
    kickOffActive: false,
  };

  for (const event of finalState.eventLog) {
    // SLOT_ADVANCE events produce no board change — skip (D-32)
    if (event.type === 'SLOT_ADVANCE') {
      continue;
    }

    // Apply board mutations for replay-eligible events
    if (event.type === 'MOVE') {
      // Reposition the piece in the current reconstructed state
      const moveEvent = event;
      const newPieces = current.pieces.map((p) =>
        p.id === moveEvent.pieceId ? { ...p, position: moveEvent.to } : p,
      );
      current = { ...current, pieces: newPieces };
    } else if (event.type === 'GOAL') {
      // Score increment and reset ball to kickOffHex
      const goalEvent = event;
      const newScore = {
        ...current.score,
        [goalEvent.scoringTeam]: current.score[goalEvent.scoringTeam] + 1,
      };
      current = {
        ...current,
        score: newScore,
        ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
      };
    } else if (event.type === 'KICK_OFF') {
      // Kick-off: pieces stay, ball at centre (already there), transition to MOVEMENT
      current = {
        ...current,
        movementSlot: 'ATTACKER_4',
      };
    }
    // For DICE_ROLL, STEAL_ATTEMPT, HIGH_PASS, LONG_BALL, STANDARD_PASS, FIRST_TIME_PASS,
    // SHOT_ATTEMPT, SNAPSHOT, HALF_TIME, FULL_TIME: produce a frame but no board mutation
    // (these are information events for replay display; board shows them at their timestamp)

    // Check if this event type is replay-eligible and emit a frame
    if (REPLAY_ELIGIBLE_TYPES.has(event.type)) {
      frames.push({
        ...current,
        phase: 'REPLAY', // D-31: tag every frame as REPLAY for client routing
        score: { ...current.score }, // preserve persistent final score
      });
    }
  }

  return frames;
}
