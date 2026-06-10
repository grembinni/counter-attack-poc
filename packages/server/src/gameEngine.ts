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
  LastActionType,
} from '@counter-attack/shared';
import {
  HOME_SQUAD,
  AWAY_SQUAD,
  PITCH_REGIONS,
  isInRegion,
  isPitchHex,
  validateMove,
  computeCombinedScore,
  computeLooseBall,
  validatePass,
  validatePassAccuracy,
  validateShotDuel,
  validateHandlingCheck,
  validateGKDive,
  validateHeading,
  hexDistance,
  hexLine,
} from '@counter-attack/shared';
import { ELIGIBLE_NEXT_ACTIONS } from '@counter-attack/shared';

// No socket.io imports — pure functions only (ARCH-01, established Phase 2/3 pattern).

/** 4-5-2 Movement Phase slot sequence. Used by advanceMovementSlot. D-03/D-04. */
const SLOT_SEQUENCE: readonly MovementSlot[] = ['ATTACKER_4', 'DEFENDER_5', 'ATTACKER_2'];

/** TESTING ONLY — set to null to use real piece pace values. Remove before ship. */
const TESTING_PACE_OVERRIDE: number | null = 15;

/**
 * D-20 (IN-01): hoisted to module-level const — avoids reallocating the Set on every
 * applySnapshot call. Used in the SNAP-01 trigger (b) guard in applySnapshot.
 *
 * D-16 (WR-01): 'HIGH_PASS' intentionally excluded — after a HIGH_PASS, the phase
 * transitions to HEADER, never directly to PASS, so `phase === 'PASS'` with
 * `lastActionType === 'HIGH_PASS'` is impossible at runtime. Keeping it would be dead
 * code and could mask a regression if the FSM is changed.
 */
const SNAPSHOT_ELIGIBLE_PASS_TYPES: ReadonlySet<LastActionType> = new Set([
  'STANDARD_PASS',
  'FIRST_TIME_PASS',
  // HIGH_PASS intentionally omitted (D-16): HIGH_PASS → HEADER, never → PASS directly
  'LONG_BALL',
  'HEADER',
  'DEFLECTION',
  'SUCCESSFUL_TACKLE',
  'MOVEMENT_PHASE',
]);

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

  // Build mutable piece array so ST positions can be set based on who kicks off.
  const pieces = [...HOME_SQUAD, ...AWAY_SQUAD].map((p) => ({ ...p }));
  const homeST = pieces.find((p) => p.teamId === 'home' && p.role === 'ST');
  const awayST = pieces.find((p) => p.teamId === 'away' && p.role === 'ST');
  if (homeST && awayST) {
    if (attackingTeam === 'home') {
      homeST.position = { ...PITCH_REGIONS.kickOffHex }; // centre dot
      awayST.position = { q: 22, r: 13 }; // away-side, just outside centre circle
    } else {
      awayST.position = { ...PITCH_REGIONS.kickOffHex }; // centre dot
      homeST.position = { q: 14, r: 13 }; // home-side, just outside centre circle
    }
  }

  return {
    roomCode,
    phase: 'KICK_OFF_SETUP', // D-23: both teams reposition before kick-off; ready confirms advance
    activeTeam: attackingTeam,
    attackingTeam,
    pieces, // TEAM-01: all 22 loaded at match start; ST positioned by coin flip
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
  if (state.phase !== 'KICK_OFF' && state.phase !== 'PASS' && state.phase !== 'LOOSE_BALL') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // From KICK_OFF: find the piece standing on the ball's position (the kicker) and assign them
  // the ball so the carrier is set before movement begins.
  // From PASS (after steal/tackle): ball.carrierId is already correct — leave ball state as-is.
  // From LOOSE_BALL: ball.carrierId is null — leave as-is; pickup happens in applyMove.
  let newBall = state.ball;
  if (state.phase === 'KICK_OFF') {
    const kicker = state.pieces.find(
      (p) => p.position.q === state.ball.position.q && p.position.r === state.ball.position.r,
    );
    if (kicker) newBall = { ...state.ball, carrierId: kicker.id };
  }

  return {
    ok: true,
    state: {
      ...state,
      phase: 'MOVEMENT',
      movementSlot: 'ATTACKER_4',
      activeTeam: state.attackingTeam,
      ball: newBall,
      eventLog: state.eventLog,
      // D-21 / HEAD-05: clear contestedPieceIds after one Movement Phase so the exclusion
      // applies to exactly one movement sequence. applyMove checks contestedPieceIds to
      // reject contested pieces at move-time (Pitfall 6 — cleared here, not in HEADER branch).
      contestedPieceIds: [],
      stealAttemptedByIds: [], // D-29: reset per-phase steal tracking at Movement Phase start
      tackleAttemptedByIds: [], // D-29: reset per-phase tackle tracking at Movement Phase start
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

  // 2.5. HEAD-05 / D-21: reject contested pieces from the Movement Phase following a header.
  // contestedPieceIds is cleared in applyStartMovement after one Movement Phase,
  // but may be injected on state by tests or carried from a non-standard path.
  if ((state.contestedPieceIds ?? []).includes(pieceId)) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'CONTESTED_PIECE' };
  }

  // 3. Team guard (T-4-01) — use state.activeTeam (authoritative after D-30 pickup mid-slot)
  if (piece.teamId !== state.activeTeam) {
    return { ok: false, reason: 'WRONG_TEAM' };
  }

  // 4. Delegate to validator
  const result = validateMove(state, piece, to);
  if (!result.ok) {
    return { ok: false, reason: 'MOVE_INVALID', detail: result.reason };
  }

  // 5. Build new state via spread (immutable — never mutate readonly arrays, RESEARCH Pitfall 1)
  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));

  // movedPieceIds tracking: a piece is "spent" when its pace is exhausted after this step.
  // When a NEW activation starts (paceUsed was 0), any other mid-activation piece is abandoned
  // and also added to movedPieceIds (the player chose to stop them early).
  const currentPaceUsed = state.paceUsedByPieceId[pieceId] ?? 0;
  const newPaceForPiece = currentPaceUsed + 1;
  const isNewActivation = currentPaceUsed === 0;
  // ATTACKER_2 enforces the same artificial cap of 2 hexes used by moveValidator.
  const rawPace = TESTING_PACE_OVERRIDE ?? piece.pace;
  const effectivePace = state.movementSlot === 'ATTACKER_2' ? Math.min(rawPace, 2) : rawPace;
  const paceExhausted = newPaceForPiece >= effectivePace;
  const abandonedIds = isNewActivation
    ? Object.keys(state.paceUsedByPieceId).filter(
        (id) => id !== pieceId && !state.movedPieceIds.includes(id),
      )
    : [];
  const computeMovedPieceIds = (forceIncludeSelf = false): string[] => {
    const ids = new Set(state.movedPieceIds);
    for (const id of abandonedIds) ids.add(id);
    if (paceExhausted || forceIncludeSelf) ids.add(pieceId);
    return [...ids];
  };

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

  // Loose ball pickup: piece steps onto the hex where the ball is loose (no carrier).
  // D-30: grants possession to the moving piece WITHOUT ending the movement action.
  // The piece retains its remaining pace; paceUsedByPieceId is updated for this step only.
  // Phase stays MOVEMENT so the piece can continue moving (action is not ended).
  // attackingTeam updates to the picking-up piece's team immediately (possession change).
  if (
    state.ball.carrierId === null &&
    to.q === state.ball.position.q &&
    to.r === state.ball.position.r
  ) {
    const newPickupAttackingTeam = piece.teamId;
    return {
      ok: true,
      state: {
        ...state,
        pieces: newPieces,
        ball: { position: to, carrierId: pieceId },
        attackingTeam: newPickupAttackingTeam,
        activeTeam: newPickupAttackingTeam,
        // D-30: stay in MOVEMENT — do NOT transition to PASS or reset pace/slots
        phase: 'MOVEMENT',
        movementSlot: state.movementSlot,
        movedPieceIds: computeMovedPieceIds(), // spent only if pace exhausted after this step
        paceUsedByPieceId: {
          ...state.paceUsedByPieceId,
          [pieceId]: newPaceForPiece,
        },
        eventLog: newEventLog,
        pendingFreeMove: state.pendingFreeMove ?? null,
        lastActionType: state.lastActionType, // preserve; pickup mid-movement doesn't change action type
      },
    };
  }

  // D-29: track per-attempt ids for steal/tackle — updated in the relevant branches
  // and threaded through all ok:true return paths.
  let newStealAttemptedByIds: readonly string[] = state.stealAttemptedByIds ?? [];
  let newTackleAttemptedByIds: readonly string[] = state.tackleAttemptedByIds ?? [];

  // Handle STEAL_ATTEMPT effect (D-06/D-07/D-08)
  let stealSuccess = false;
  let stealDefenderId: string | undefined;
  if ('effect' in result && result.effect.type === 'STEAL_ATTEMPT') {
    // D-29: reject if this piece already attempted a steal this movement phase
    if (newStealAttemptedByIds.includes(pieceId)) {
      return { ok: false, reason: 'MOVE_INVALID', detail: 'ALREADY_ATTEMPTED' };
    }

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
    // D-29: record that this piece has now attempted a steal this phase (success or fail)
    newStealAttemptedByIds = [...newStealAttemptedByIds, pieceId];
  }

  // Handle TACKLE_ATTEMPT effect (D-11/D-12)
  // Fires when a defender (different team than carrier) moves adjacent to the carrier.
  let tackleSuccess = false;
  if ('effect' in result && result.effect.type === 'TACKLE_ATTEMPT') {
    // D-29: reject if this piece already attempted a tackle this movement phase
    if (newTackleAttemptedByIds.includes(pieceId)) {
      return { ok: false, reason: 'MOVE_INVALID', detail: 'ALREADY_ATTEMPTED' };
    }

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
      // D-29: record that this piece has now attempted a tackle this phase (success or fail)
      newTackleAttemptedByIds = [...newTackleAttemptedByIds, pieceId];

      if (tackleSuccess) {
        // D-11: on SUCCESS, defender moves to `to`, ball possession transferred to defender.
        // Phase ends immediately — new attacking team chooses next action from PASS phase
        // (ELIGIBLE_NEXT_ACTIONS['SUCCESSFUL_TACKLE']: MOVEMENT, STANDARD_PASS, HIGH_PASS, LONG_BALL, SNAPSHOT).
        const tackleSuccessBall = { ...state.ball, position: to, carrierId: pieceId };
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            pieces: newPieces,
            attackingTeam: piece.teamId,
            activeTeam: piece.teamId,
            movementSlot: null,
            movedPieceIds: [],
            paceUsedByPieceId: {},
            ball: tackleSuccessBall,
            eventLog: newEventLog,
            pendingFreeMove: state.pendingFreeMove ?? null,
            lastActionType: 'SUCCESSFUL_TACKLE',
            actionCount: state.actionCount + 3,
            tackleAttemptedByIds: newTackleAttemptedByIds, // D-29
          },
        };
      }
      // FAIL: defender moves to `to` (newPieces already reflects this), carrier keeps ball
      return {
        ok: true,
        state: {
          ...state,
          pieces: newPieces,
          movedPieceIds: computeMovedPieceIds(), // spent only if pace exhausted
          paceUsedByPieceId: {
            ...state.paceUsedByPieceId,
            [pieceId]: newPaceForPiece,
          },
          ball: state.ball,
          eventLog: newEventLog,
          pendingFreeMove: state.pendingFreeMove ?? null,
          tackleAttemptedByIds: newTackleAttemptedByIds, // D-29
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
    if ((fromInHomeThird && toInAwayThird) || (fromInAwayThird && toInHomeThird)) {
      pendingFreeMove = { team: piece.teamId, hexesAllowed: 6 };
    }
  }

  if (stealSuccess) {
    // Phase ends immediately — new attacking team chooses next action from PASS phase
    // (ELIGIBLE_NEXT_ACTIONS['SUCCESSFUL_TACKLE']: MOVEMENT, STANDARD_PASS, HIGH_PASS, LONG_BALL, SNAPSHOT).
    const stealSuccessBall = { ...state.ball, position: to, carrierId: stealDefenderId! };
    const newOwnerTeam =
      state.pieces.find((p) => p.id === stealDefenderId)?.teamId ?? state.activeTeam;
    return {
      ok: true,
      state: {
        ...state,
        phase: 'PASS',
        pieces: newPieces,
        attackingTeam: newOwnerTeam,
        activeTeam: newOwnerTeam,
        movementSlot: null,
        movedPieceIds: [],
        paceUsedByPieceId: {},
        ball: stealSuccessBall,
        eventLog: newEventLog,
        pendingFreeMove,
        lastActionType: 'SUCCESSFUL_TACKLE',
        actionCount: state.actionCount + 3,
        stealAttemptedByIds: newStealAttemptedByIds, // D-29
      },
    };
  }

  // Normal move (includes steal FAIL fall-through)
  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      movedPieceIds: computeMovedPieceIds(), // spent only when pace fully exhausted
      paceUsedByPieceId: {
        ...state.paceUsedByPieceId,
        [pieceId]: newPaceForPiece,
      },
      ball: newBall,
      eventLog: newEventLog,
      pendingFreeMove,
      stealAttemptedByIds: newStealAttemptedByIds, // D-29: propagate (may have been updated)
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

  // Phase 8 clock hook (D-04/MATCH-01): at ATTACKER_2→null transition, +3 min per cycle.
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
  //
  // Any piece with paceUsed > 0 that was not yet exhausted (not in movedPieceIds) is
  // locked in now — ending the slot consumes the activation whether or not max pace was used.
  const lockedOnEndSlot = Object.keys(state.paceUsedByPieceId).filter(
    (id) => !state.movedPieceIds.includes(id),
  );
  return {
    ok: true,
    state: {
      ...state,
      phase: nextPhase,
      movementSlot: nextSlot,
      activeTeam: nextActiveTeam,
      eventLog: [...state.eventLog, slotAdvanceEvent],
      movedPieceIds: [...state.movedPieceIds, ...lockedOnEndSlot],
      paceUsedByPieceId: {}, // reset — new slot counts activations from zero
      lastActionType: 'MOVEMENT_PHASE', // D-17 (WR-02): reset for intermediate slot transitions
    },
  };
}

// ---------------------------------------------------------------------------
// applyRestartMovement
// ---------------------------------------------------------------------------

/** Resets the movement phase back to ATTACKER_4, clearing movedPieceIds and pace tracking.
 *  Used for "Start New Movement Phase" — allows the attacking team to replay the full
 *  4-5-2 movement sequence from scratch within the same turn. */
export function applyRestartMovement(
  state: GameState,
): { ok: false; reason: 'WRONG_PHASE' } | { ok: true; state: GameState } {
  if (state.phase !== 'MOVEMENT') return { ok: false, reason: 'WRONG_PHASE' };
  return {
    ok: true,
    state: {
      ...state,
      movementSlot: 'ATTACKER_4',
      activeTeam: state.attackingTeam,
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
 * D-09: undo is locked if a SLOT_ADVANCE or DICE_ROLL exists since the last slot boundary.
 * D-10: reverses the last MOVE — restores piece position and decrements paceUsedByPieceId.
 *
 * Slot boundaries: SLOT_ADVANCE (normal end-of-slot) OR KICK_OFF (applyStartMovement marker,
 * used after steal/tackle so undo cannot cross into the pre-possession-change move history).
 */
export function applyUndo(state: GameState): ApplyUndoResult {
  // Find the index of the last slot boundary (SLOT_ADVANCE or KICK_OFF)
  const lastSlotAdvanceIdx = state.eventLog.reduce<number>((acc, evt, idx) => {
    return evt.type === 'SLOT_ADVANCE' || evt.type === 'KICK_OFF' ? idx : acc;
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

  // Always remove the piece from movedPieceIds when any of its moves is undone.
  // Previously only removed when paceUsed reached 0, which left the X marker on pieces
  // that were exhausted (e.g. 2/2 ATTACKER_2) even after one step was reversed.
  // The piece will be re-added to movedPieceIds if it reaches pace exhaustion again.
  const newMovedPieceIds = state.movedPieceIds.filter((id) => id !== moveToUndo.pieceId);

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
    // PASS: per-type accuracy → ball delivery → interception loop → LOOSE_BALL on inaccurate
    //
    // D-05: per-type accuracy gate — HIGH_PASS and LONG_BALL require validatePassAccuracy;
    //       STANDARD_PASS and FIRST_TIME_PASS skip accuracy and always deliver the ball (D-01/D-02).
    // D-14: accurate pass delivers ball to passTargetHex; sets ball.carrierId to teammate or null.
    // D-11/D-12: adjacent defenders auto-roll for interception before delivery (PASS-01).
    // D-09/Pitfall 8: accurate STANDARD pass MUST NOT transition to SHOT; phase returns to PASS.
    // Time cost: +0 for FIRST_TIME_PASS; +1 for all other types.
    //
    // The handler (plan 08.2-04) is responsible for setting passTargetHex + lastActionType on
    // state BEFORE calling applyRoll. Engine returns WRONG_PHASE if passTargetHex is absent.
    // -------------------------------------------------------------------------
    case 'PASS': {
      const carrier = state.pieces.find((p) => p.id === state.ball.carrierId);
      if (!carrier) return { ok: false, reason: 'WRONG_PHASE' };

      // T-08.2-03: passTargetHex must be set by the handler before this branch runs.
      const targetHex = state.passTargetHex;
      if (targetHex == null) return { ok: false, reason: 'WRONG_PHASE' };

      // FIRST_TIME_PASS costs 0 min; all other pass types cost +1 min.
      const passTimeCost = state.lastActionType === 'FIRST_TIME_PASS' ? 0 : 1;

      // D-05: accuracy gate — HIGH_PASS and LONG_BALL require an accuracy check.
      const requiresAccuracyCheck =
        state.lastActionType === 'HIGH_PASS' || state.lastActionType === 'LONG_BALL';

      let accurate = true;
      if (requiresAccuracyCheck) {
        let accuracyType: 'HIGH' | 'LONG_SAME_THIRD' | 'LONG_CROSS_THIRD' = 'HIGH';
        if (state.lastActionType === 'LONG_BALL') {
          const crossThird =
            (isInRegion(carrier.position, 'homeThird') && isInRegion(targetHex, 'awayThird')) ||
            (isInRegion(carrier.position, 'awayThird') && isInRegion(targetHex, 'homeThird'));
          accuracyType = crossThird ? 'LONG_CROSS_THIRD' : 'LONG_SAME_THIRD';
        }
        const accuracyResult = validatePassAccuracy(carrier, accuracyType, d1, []);
        accurate = accuracyResult.accurate;
      }

      if (!accurate) {
        // D-05/PASS-05: inaccurate → LOOSE_BALL; ball stays at carrier position.
        // HIGH_PASS: event was already logged at target selection (accurate: null); don't re-log.
        const inaccuratePassType = state.lastActionType as 'HIGH_PASS' | 'LONG_BALL';
        const inaccurateLog: readonly ActionEvent[] =
          inaccuratePassType === 'HIGH_PASS'
            ? [
                ...state.eventLog,
                {
                  type: 'HP_ACCURACY' as const,
                  passerId: state.highPassCarrierId ?? '',
                  accurate: false,
                  timestamp: Date.now(),
                },
              ]
            : [
                ...state.eventLog,
                {
                  type: inaccuratePassType,
                  from: carrier.position,
                  to: targetHex,
                  accurate: false,
                  timestamp: Date.now(),
                },
              ];
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            // HIGH_PASS: ball already at target (moved during repositioning); use state.ball.position.
            // LONG_BALL: ball stays at carrier until accuracy check — scatter from targetHex.
            ball: {
              position: inaccuratePassType === 'LONG_BALL' ? targetHex : state.ball.position,
              carrierId: null,
            },
            lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
            lastActionType: 'DEFLECTION',
            actionCount: state.actionCount + passTimeCost,
            passTargetHex: null,
            eventLog: inaccurateLog,
          },
        };
      }

      // Accurate path: run the interception loop before delivery (D-11/D-12 / PASS-01).
      // Map lastActionType → validatePass passType.
      const passTypeMap: Record<string, 'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG'> = {
        STANDARD_PASS: 'STANDARD',
        FIRST_TIME_PASS: 'FIRST_TIME',
        HIGH_PASS: 'HIGH',
        LONG_BALL: 'LONG',
      };
      const validatePassType: 'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG' =
        (state.lastActionType && passTypeMap[state.lastActionType]) ?? 'STANDARD';

      const passResult = validatePass(
        state,
        carrier,
        carrier.position,
        targetHex,
        validatePassType,
      );
      const interceptors = passResult.ok ? passResult.interceptors : [];

      // Resolve pass type before the interception loop so early returns can use it.
      const newLastActionType: LastActionType =
        state.lastActionType !== null &&
        (['STANDARD_PASS', 'HIGH_PASS', 'LONG_BALL', 'FIRST_TIME_PASS'] as string[]).includes(
          state.lastActionType,
        )
          ? state.lastActionType
          : 'STANDARD_PASS';

      // Log the pass attempt — HIGH_PASS was already logged at target selection (handler), skip it.
      const deliveredPassType = newLastActionType as
        | 'STANDARD_PASS'
        | 'HIGH_PASS'
        | 'LONG_BALL'
        | 'FIRST_TIME_PASS';
      let newEventLog: readonly ActionEvent[];
      if (deliveredPassType === 'HIGH_PASS') {
        newEventLog = [
          ...state.eventLog,
          {
            type: 'HP_ACCURACY' as const,
            passerId: state.highPassCarrierId ?? '',
            accurate: true,
            timestamp: Date.now(),
          },
        ];
      } else {
        const passAttemptEvent: ActionEvent = {
          type: deliveredPassType,
          // D-27: include passer ID for team-colour prefix in ActionLog
          passerId: carrier.id,
          from: carrier.position,
          to: targetHex,
          accurate: true,
          timestamp: Date.now(),
        };
        newEventLog = [...state.eventLog, passAttemptEvent];
      }

      for (let i = 0; i < interceptors.length; i++) {
        const interceptor = interceptors[i]!;
        const die = state.preGeneratedInterceptionDice?.[i] ?? 3;
        const combined = computeCombinedScore(interceptor.tackling, die, []);
        const intercepted = die === 6 || combined >= 10;
        const interceptionEvent: ActionEvent = {
          type: 'STEAL_ATTEMPT',
          defenderId: interceptor.id,
          result: intercepted ? 'SUCCESS' : 'FAIL',
          defenderDie: die,
          defenderCombined: combined,
          timestamp: Date.now(),
        };
        newEventLog = [...newEventLog, interceptionEvent];
        if (intercepted) {
          // D-11/D-12: interception — first success wins; transfer possession.
          return {
            ok: true,
            state: {
              ...state,
              phase: 'PASS',
              ball: { position: interceptor.position, carrierId: interceptor.id },
              attackingTeam: interceptor.teamId,
              activeTeam: interceptor.teamId,
              lastActionType: 'SUCCESSFUL_TACKLE',
              actionCount: state.actionCount + passTimeCost,
              passTargetHex: null,
              preGeneratedInterceptionDice: [],
              lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
              eventLog: newEventLog,
            },
          };
        }
      }

      // No interception: deliver ball to target hex.
      // Find teammate at target (same teamId, matching q/r).
      const teammate = state.pieces.find(
        (p) =>
          p.teamId === carrier.teamId &&
          p.position.q === targetHex.q &&
          p.position.r === targetHex.r,
      );

      // After HIGH_PASS, transition to HEADER (or LOOSE_BALL if no eligible players).
      // All other pass types → PASS (neutral action choice).
      if (newLastActionType === 'HIGH_PASS') {
        // 5.1: check if any player from either team is within 2 hexes of the target
        const homeEligible = state.pieces.some(
          (p) => p.teamId === 'home' && hexDistance(p.position, targetHex) <= 2,
        );
        const awayEligible = state.pieces.some(
          (p) => p.teamId === 'away' && hexDistance(p.position, targetHex) <= 2,
        );

        if (!homeEligible && !awayEligible) {
          // No eligible players → ball falls loose at target (no header contest)
          return {
            ok: true,
            state: {
              ...state,
              phase: 'LOOSE_BALL',
              ball: { position: targetHex, carrierId: null },
              lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
              lastActionType: 'DEFLECTION',
              actionCount: state.actionCount + passTimeCost,
              passTargetHex: null,
              preGeneratedInterceptionDice: [],
              eventLog: newEventLog,
            },
          };
        }

        // 5.2: auto-confirm teams with no eligible players (they automatically decline)
        return {
          ok: true,
          state: {
            ...state,
            phase: 'HEADER',
            ball: { position: targetHex, carrierId: null },
            lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
            lastActionType: newLastActionType,
            actionCount: state.actionCount + passTimeCost,
            passTargetHex: null,
            preGeneratedInterceptionDice: [],
            eventLog: newEventLog,
            headerContestants: { home: [] as string[], away: [] as string[] },
            headerConfirmed: { home: !homeEligible, away: !awayEligible },
          },
        };
      }

      // TODO: FIRST_TIME_PLAYER_MOVES (PASS-02) deferred to Phase 8.3
      // The FIRST_TIME_PASS effect (mid-pass player movement) would be handled here.

      return {
        ok: true,
        state: {
          ...state,
          phase: 'PASS',
          ball: { position: targetHex, carrierId: teammate?.id ?? null },
          lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
          lastActionType: newLastActionType,
          actionCount: state.actionCount + passTimeCost,
          passTargetHex: null,
          preGeneratedInterceptionDice: [],
          eventLog: newEventLog,
        },
      };
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
            // D-22: append GOAL event so replays can reconstruct the scoreline correctly
            eventLog: [
              ...state.eventLog,
              { type: 'GOAL' as const, scoringTeam: state.attackingTeam, timestamp: Date.now() },
            ],
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
            lastActionType: 'DEFLECTION',
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
              lastActionType: 'DEFLECTION',
              snapshotPenalty: false,
            },
          };
        }
      }

      // Exhaustive guard — TypeScript should narrow this to never; belt-and-suspenders
      return { ok: false, reason: 'WRONG_PHASE' };
    }

    // -------------------------------------------------------------------------
    // HEADER: reads per-team selected contestants from state.headerContestants (D-17)
    // Each contestant rolls their own die; team winner = highest (die + heading).
    // Intra-team tie: pick randomly. Cross-team tie: LOOSE_BALL.
    // GK aerial challenge deferred to 8.3 (D-22); attacker wins → PASS phase.
    // dice[] layout: [atk_0, atk_1, ..., def_0, def_1, ...]
    // -------------------------------------------------------------------------
    case 'HEADER': {
      const defenderTeam = state.attackingTeam === 'home' ? 'away' : 'home';

      const attackerContestantIds: string[] =
        state.attackingTeam === 'home'
          ? (state.headerContestants?.home ?? [])
          : (state.headerContestants?.away ?? []);
      const defenderContestantIds: string[] =
        defenderTeam === 'home'
          ? (state.headerContestants?.home ?? [])
          : (state.headerContestants?.away ?? []);

      const headerCleared = { headerContestants: null, headerConfirmed: null };

      // Build per-contestant results: each rolls their die from the pre-generated dice array.
      // dice[0..attackerCount-1] = attacker dice; dice[attackerCount..] = defender dice.
      type CR = { piece: (typeof state.pieces)[number]; die: number; raw: number };

      const buildResults = (ids: string[], offset: number): CR[] =>
        ids
          .map((id, i) => {
            const piece = state.pieces.find((p) => p.id === id);
            if (!piece) return null;
            const die = dice[offset + i] ?? 3;
            return { piece, die, raw: piece.heading + die };
          })
          .filter((r): r is CR => r !== null);

      // Pick team winner: highest combined score; deterministic tiebreak using injected die (D-21).
      // tieBreakerDie: a pre-generated die value passed by the handler for determinism (ARCH-01).
      // Index into tied[] by (tieBreakerDie - 1) % tied.length — pure, no Math.random.
      const pickWinner = (results: CR[], tieBreakerDie: number): CR | undefined => {
        if (results.length === 0) return undefined;
        const max = Math.max(...results.map((r) => r.raw));
        const tied = results.filter((r) => r.raw === max);
        return tied[(tieBreakerDie - 1) % tied.length];
      };

      const atkCount = attackerContestantIds.length;
      const attackerResults = buildResults(attackerContestantIds, 0);
      const defenderResults = buildResults(defenderContestantIds, atkCount);

      // D-21: tie-break dice follow all contestant dice in the ...dice spread.
      // atkTieDie is used when multiple attackers tie; defTieDie when multiple defenders tie.
      const atkTieDie = dice[atkCount + defenderContestantIds.length] ?? 1;
      const defTieDie = dice[atkCount + defenderContestantIds.length + 1] ?? 1;

      const attackerWinner = pickWinner(attackerResults, atkTieDie);
      const defenderWinner = pickWinner(defenderResults, defTieDie);

      // If attacker declined, fall back to ball carrier (they hold possession uncontested)
      const attackerFallback = state.pieces.find((p) => p.id === state.ball.carrierId);
      const attackerPiece =
        attackerWinner?.piece ?? (atkCount === 0 ? attackerFallback : undefined);
      const defenderPiece = defenderWinner?.piece;

      const fallbackRolls = [dice[0] ?? 3, dice[1] ?? 3];
      const allRolls = [...attackerResults, ...defenderResults].map((r) => r.die);
      const duelRolls = allRolls.length > 0 ? allRolls : fallbackRolls;

      // (c) Neither team selected → LOOSE_BALL from ball.position (D-19)
      if (atkCount === 0 && defenderContestantIds.length === 0) {
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: fallbackRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            ...headerCleared,
          },
        };
      }

      // (b-def) Defender selected, attacker declined → defender wins uncontested
      if (atkCount === 0 && defenderPiece !== undefined) {
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            attackingTeam: defenderTeam,
            activeTeam: defenderTeam,
            ball: { position: defenderPiece.position, carrierId: defenderPiece.id },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            contestedPieceIds: defenderContestantIds,
            eventLog: [
              ...state.eventLog,
              {
                type: 'HEADER' as const,
                attackerId: null,
                defenderId: defenderPiece.id,
                result: 'DEFENDER_WIN' as const,
                attackerDie: null,
                attackerHeading: null,
                attackerCombined: null,
                defenderDie: null,
                defenderHeading: null,
                defenderCombined: null,
                timestamp: Date.now(),
              },
            ],
            ...headerCleared,
          },
        };
      }

      // (b) Attacker selected, defender declined → attacker wins uncontested (HEAD-02, no dice roll)
      if (defenderContestantIds.length === 0 || defenderPiece === undefined) {
        const winnerId = attackerPiece?.id ?? '';
        const winnerPiece = attackerPiece;
        const tgtHexB = state.headerTargetHex ?? null;
        const goalQB = state.attackingTeam === 'home' ? 36 : 0;
        const isGoalLineTargetB =
          tgtHexB !== null && tgtHexB.q === goalQB && tgtHexB.r >= 10 && tgtHexB.r <= 16;

        const headerEventB = {
          type: 'HEADER' as const,
          attackerId: winnerId,
          defenderId: null,
          result: 'ATTACKER_WIN' as const,
          attackerDie: null,
          attackerHeading: null,
          attackerCombined: null,
          defenderDie: null,
          defenderHeading: null,
          defenderCombined: null,
          timestamp: Date.now(),
        };

        if (isGoalLineTargetB) {
          const defendingTeamForGkB: 'home' | 'away' =
            state.attackingTeam === 'home' ? 'away' : 'home';
          const gkB = state.pieces.find((p) => p.teamId === defendingTeamForGkB && p.role === 'GK');
          return {
            ok: true,
            state: {
              ...state,
              phase: 'GK_DIVING',
              lastActionType: 'SHOT',
              shotTargetHex: tgtHexB,
              gkDivePosition: gkB?.position ?? state.ball.position,
              contestedPieceIds: attackerContestantIds,
              lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
              eventLog: [...state.eventLog, headerEventB],
              ...headerCleared,
              headerTargetHex: null,
            },
          };
        }

        const ballPositionB = tgtHexB ?? winnerPiece?.position ?? state.ball.position;
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            ball: { position: ballPositionB, carrierId: winnerId },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            contestedPieceIds: attackerContestantIds,
            eventLog: [...state.eventLog, headerEventB],
            ...headerCleared,
            headerTargetHex: null,
          },
        };
      }

      // (a) Both selected — contested duel between each team's winner (D-17)
      if (!attackerPiece) return { ok: false, reason: 'WRONG_PHASE' };

      // Apply HEAD-01 distance penalty to the attacker winner
      const headResult = validateHeading(state, attackerPiece, state.ball.position, {
        previousActionWasHeadedPass: false,
        otherChallengerIds: [defenderPiece.id],
      });
      const penaltyMod = headResult.ok && headResult.contested ? headResult.penaltyModifier : 0;

      const attackerDie = attackerWinner!.die;
      const defenderDie = defenderWinner!.die;
      const attackerScore = computeCombinedScore(attackerPiece.heading, attackerDie, [penaltyMod]);
      const defenderScore = computeCombinedScore(defenderPiece.heading, defenderDie, []);

      const contestedIds = [...attackerContestantIds, ...defenderContestantIds];

      if (attackerScore > defenderScore) {
        // HEAD-03 (D-11/D-12): check if the header target is a goal-line hex for the attacker.
        // Goal-line: q=36 for home attack / q=0 for away attack, r∈[10..16] (A1 assumption).
        // If so → route to GK_DIVING (no outfield deflection — D-13 applies).
        // If not → headed pass to the target hex (if set) or attacker's position (fallback).
        const tgtHex = state.headerTargetHex ?? null;
        const goalQ = state.attackingTeam === 'home' ? 36 : 0;
        const isGoalLineTarget =
          tgtHex !== null && tgtHex.q === goalQ && tgtHex.r >= 10 && tgtHex.r <= 16;

        const headerEventEntry = {
          type: 'HEADER' as const,
          attackerId: attackerPiece.id,
          defenderId: defenderPiece.id,
          result: 'ATTACKER_WIN' as const,
          attackerDie,
          attackerHeading: attackerPiece.heading,
          attackerCombined: attackerScore,
          defenderDie,
          defenderHeading: defenderPiece.heading,
          defenderCombined: defenderScore,
          timestamp: Date.now(),
        };

        if (isGoalLineTarget) {
          // HEAD-03: goal-line header → GK_DIVING (same as declared shot flow).
          // D-13: no outfield path-deflection — only GK contests.
          const defendingTeamForGk: 'home' | 'away' =
            state.attackingTeam === 'home' ? 'away' : 'home';
          const gk = state.pieces.find((p) => p.teamId === defendingTeamForGk && p.role === 'GK');
          return {
            ok: true,
            state: {
              ...state,
              phase: 'GK_DIVING',
              lastActionType: 'SHOT',
              shotTargetHex: tgtHex,
              gkDivePosition: gk?.position ?? state.ball.position,
              contestedPieceIds: contestedIds,
              lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
              eventLog: [...state.eventLog, headerEventEntry],
              ...headerCleared,
              headerTargetHex: null, // clear after routing
            },
          };
        }

        // Not goal-line (or no target set): headed pass.
        // Ball goes to headerTargetHex if set; otherwise to attacker's position.
        const ballPosition = tgtHex ?? attackerPiece.position;
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            ball: { position: ballPosition, carrierId: attackerPiece.id },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            contestedPieceIds: contestedIds,
            eventLog: [...state.eventLog, headerEventEntry],
            ...headerCleared,
            headerTargetHex: null,
          },
        };
      } else if (attackerScore === defenderScore) {
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'DEFLECTION', // D-23 (WR-03): HEADER tie → LOOSE_BALL = DEFLECTION
            contestedPieceIds: contestedIds,
            eventLog: [
              ...state.eventLog,
              {
                type: 'HEADER' as const,
                attackerId: attackerPiece.id,
                defenderId: defenderPiece.id,
                result: 'TIE' as const,
                attackerDie,
                attackerHeading: attackerPiece.heading,
                attackerCombined: attackerScore,
                defenderDie,
                defenderHeading: defenderPiece.heading,
                defenderCombined: defenderScore,
                timestamp: Date.now(),
              },
            ],
            ...headerCleared,
          },
        };
      } else {
        return {
          ok: true,
          state: {
            ...state,
            phase: 'PASS',
            attackingTeam: defenderTeam,
            activeTeam: defenderTeam,
            ball: { position: defenderPiece.position, carrierId: defenderPiece.id },
            lastDiceRoll: { rolls: duelRolls, context: 'HEADING_DUEL' },
            lastActionType: 'HEADER',
            contestedPieceIds: contestedIds,
            eventLog: [
              ...state.eventLog,
              {
                type: 'HEADER' as const,
                attackerId: attackerPiece.id,
                defenderId: defenderPiece.id,
                result: 'DEFENDER_WIN' as const,
                attackerDie,
                attackerHeading: attackerPiece.heading,
                attackerCombined: attackerScore,
                defenderDie,
                defenderHeading: defenderPiece.heading,
                defenderCombined: defenderScore,
                timestamp: Date.now(),
              },
            ],
            ...headerCleared,
          },
        };
      }
    }

    // -------------------------------------------------------------------------
    // LOOSE_BALL: direction + distance dice → trajectory walk → first occupied hex (D-19/D-20/D-21)
    //
    // D-23: if a piece occupies an intermediate trajectory hex, ball stops there.
    //        phase → 'PASS', lastActionType → 'DEFLECTION', attackingTeam unchanged.
    // D-24: if no piece on trajectory, ball lands at the computed landing hex with carrierId null.
    //        phase → 'PASS', lastActionType → 'DEFLECTION'.
    //
    // Note: ELIGIBLE_NEXT_ACTIONS['DEFLECTION'] enforces the movement restriction for the D-24
    // empty-landing case; we do NOT force phase='MOVEMENT' here (locked decision D-23/D-24).
    // -------------------------------------------------------------------------
    case 'LOOSE_BALL': {
      const landing = computeLooseBall(
        state.ball.position,
        d1 as 1 | 2 | 3 | 4 | 5 | 6,
        d2 as 1 | 2 | 3 | 4 | 5 | 6,
      );

      // D-23/D-24: walk from ball position toward landing, stopping at first occupied hex.
      // hexLine returns [start, ..., end]; slice(1) drops the start (ball is there, no carrier).
      const trajectory = hexLine(state.ball.position, landing).slice(1);

      let finalPosition = state.ball.position;
      let finalCarrierId: string | null = null;

      for (const hex of trajectory) {
        // Stop immediately when the trajectory exits the pitch boundary
        if (!isPitchHex(hex)) break;
        finalPosition = hex;
        const occupant = state.pieces.find((p) => p.position.q === hex.q && p.position.r === hex.r);
        if (occupant) {
          finalCarrierId = occupant.id;
          break;
        }
      }

      const looseBallLandEvent: ActionEvent = {
        type: 'LOOSE_BALL_LAND',
        from: state.ball.position,
        to: finalPosition,
        timestamp: Date.now(),
      };

      // If ball lands on a piece, that piece's team becomes the attacking team
      const looseBallCarrier = finalCarrierId
        ? state.pieces.find((p) => p.id === finalCarrierId)
        : null;
      const newAttackingTeam = looseBallCarrier ? looseBallCarrier.teamId : state.attackingTeam;

      return {
        ok: true,
        state: {
          ...state,
          phase: 'PASS', // D-23/D-24: LOOSE_BALL resolves to PASS (not MOVEMENT)
          ball: { position: finalPosition, carrierId: finalCarrierId },
          attackingTeam: newAttackingTeam,
          activeTeam: newAttackingTeam,
          lastDiceRoll: { rolls: [d1, d2], context: 'LOOSE_BALL' },
          lastActionType: 'DEFLECTION', // D-20/D-23/D-24: LOOSE_BALL resolves → DEFLECTION
          // actionCount unchanged (+0 for Deflection per D-03 table)
          eventLog: [...state.eventLog, looseBallLandEvent],
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
        actionCount: state.actionCount + 1,
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
        actionCount: state.actionCount + 1,
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

  // Pass types eligible for immediately-post-pass SNAP-01 trigger (D-16/D-20: module-level const)
  const passTypes = SNAPSHOT_ELIGIBLE_PASS_TYPES;

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

    // Valid MOVEMENT snapshot — attacker must declare goal hex (SHOT_DECLARED), then opponent deflects
    return {
      ok: true,
      state: {
        ...state,
        phase: 'SHOT_DECLARED',
        lastActionType: 'SNAPSHOT', // D-18
        snapshotPenalty: true, // SNAP-02: -1 dice penalty applied when shot resolves
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
          phase: 'SHOT_DECLARED',
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
// applyDeclareHeaderTarget
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyDeclareHeaderTarget.
 * T-10-05: target hex validated server-side against attackingTeam's goal direction.
 */
export type ApplyDeclareHeaderTargetResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'NOT_CONFIRMED' | 'INVALID_TARGET' }
  | { ok: true; state: GameState };

/**
 * Records the target hex for the header during the HEADER phase (HEAD-03).
 *
 * D-11/D-12: The attacker clicks a target hex after both teams confirm contestants.
 * If the target is a goal-line hex for the attacking team → GK_DIVING redirect after duel.
 * If not goal-line → the winning attacker's ball goes to that hex (headed pass).
 *
 * Validation does NOT trigger the duel — it only sets headerTargetHex and stays in HEADER.
 * The duel is triggered by the subsequent ROLL event (applyRoll HEADER branch).
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be 'HEADER'
 * 2. NOT_CONFIRMED — both headerConfirmed.home and headerConfirmed.away must be true
 * 3. INVALID_TARGET — targetHex must be a valid pitch hex (isPitchHex)
 *    Goal-line hex check is permissive here: the goal-line routing happens in applyRoll.
 *    T-10-05: if client claims a goal-line hex, applyRoll re-validates the direction.
 *
 * @param state     - Current game state (phase must be 'HEADER')
 * @param targetHex - The hex the attacker is aiming for
 */
export function applyDeclareHeaderTarget(
  state: GameState,
  targetHex: HexCoord,
): ApplyDeclareHeaderTargetResult {
  // 1. Phase guard
  if (state.phase !== 'HEADER') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // 2. Both-teams-confirmed guard (D-12: target only set after both confirm)
  if (!state.headerConfirmed?.home || !state.headerConfirmed?.away) {
    return { ok: false, reason: 'NOT_CONFIRMED' };
  }

  // 3. Pitch boundary guard (T-10-05/T-10-06)
  if (!isPitchHex(targetHex)) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  // Set headerTargetHex; stay in HEADER for the duel
  return {
    ok: true,
    state: {
      ...state,
      headerTargetHex: targetHex,
    },
  };
}

// ---------------------------------------------------------------------------
// computeShotPathDeflection (D-03 pure helper)
// ---------------------------------------------------------------------------

/**
 * Defender-set types for shot path deflection (D-03).
 * Set A = defenders on the shot path (hexLine); Set B = defenders within 1 hex of path but not on it.
 */
export type DefenderDeflectionInput = {
  /** Piece ID of the deflecting defender. */
  defenderId: string;
  /** Position of the defending piece. */
  defenderPosition: HexCoord;
  /** Pre-generated die value for this defender's deflection attempt. */
  die: number;
  /** Tackling attribute of the defending piece. */
  tackling: number;
  /** Whether this defender is in-path (Set A) or adjacent-to-path (Set B). */
  band: 'A' | 'B';
};

/**
 * Result of the shot path deflection step.
 * If a deflection occurs, returns the deflecting defender's position for Loose Ball.
 * If no deflection, returns null — caller proceeds to shooter-vs-GK duel.
 */
export type ShotPathDeflectionResult =
  | { deflected: true; deflectorPosition: HexCoord; deflectorId: string }
  | { deflected: false };

/**
 * Computes the shot path deflection step for regular shot resolution (D-03).
 *
 * Evaluates each defender in input order; first deflection wins.
 *
 * Deflection thresholds (D-03):
 * - Set A (in-path):            die === 5 || die === 6 || (die + tackling >= 10)
 * - Set B (within 1 hex path):  die === 6             || (die + tackling >= 10)
 *
 * T-10-07: Dice are injected — this function does NOT call rollDice/Math.random.
 *
 * D-13 (HEAD-03): Headed goal attempts skip this step entirely — only GK contests.
 *
 * @param defenders - Ordered list of defenders with pre-generated dice (handler provides)
 */
export function computeShotPathDeflection(
  defenders: DefenderDeflectionInput[],
): ShotPathDeflectionResult {
  for (const def of defenders) {
    const deflects =
      def.band === 'A'
        ? def.die === 5 || def.die === 6 || def.die + def.tackling >= 10
        : def.die === 6 || def.die + def.tackling >= 10;

    if (deflects) {
      return {
        deflected: true,
        deflectorPosition: def.defenderPosition,
        deflectorId: def.defenderId,
      };
    }
  }
  return { deflected: false };
}

// ---------------------------------------------------------------------------
// applyDeclareShot
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyDeclareShot.
 * T-10-05/T-10-06: goal hex is server-re-validated; never trust client coordinates.
 */
export type ApplyDeclareShotResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'INVALID_SEQUENCE' | 'INVALID_TARGET' }
  | { ok: true; state: GameState };

/**
 * Transitions the FSM from PASS → GK_DIVING after the shooter declares a goal hex.
 *
 * D-01/D-02: Two-step shot flow: shooter clicks goal hex → server validates and
 * enters GK_DIVING so the GK's team can reposition before auto-resolution.
 * D-05: shotTargetHex recorded for event log; not consumed by dice resolution.
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be 'PASS'
 * 2. INVALID_SEQUENCE — SHOT must be in ELIGIBLE_NEXT_ACTIONS[lastActionType]
 * 3. INVALID_TARGET — goalHex must be a goal-line hex for attackingTeam
 *    (q=36, r∈[10..16] for home; q=0, r∈[10..16] for away) — A1 assumption
 *
 * T-10-06: PITCH_HEXES membership and goal-line bounds checked server-side.
 *
 * @param state    - Current game state (phase must be 'PASS')
 * @param goalHex  - The goal hex the shooter is targeting
 */
export function applyDeclareShot(state: GameState, goalHex: HexCoord): ApplyDeclareShotResult {
  // 1. Phase guard
  if (state.phase !== 'PASS' && state.phase !== 'SHOT_DECLARED') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // Goal-line hex validation (T-10-05 / A1 assumption: r∈[10..16] at goal q)
  // Home attacks toward away goal (q=36); away attacks toward home goal (q=0).
  const goalQ = state.attackingTeam === 'home' ? 36 : 0;
  if (goalHex.q !== goalQ || goalHex.r < 10 || goalHex.r > 16) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  const defendingTeam: 'home' | 'away' = state.attackingTeam === 'home' ? 'away' : 'home';

  // SHOT_DECLARED from snapshot context: set target then give defender deflection move
  if (state.phase === 'SHOT_DECLARED') {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'SNAP_DEFLECT',
        shotTargetHex: goalHex,
        activeTeam: defendingTeam, // defender's turn to deflect
        snapDeflectMovedPieceId: null,
        snapDeflectPaceUsed: 0,
      },
    };
  }

  // 2. Sequence guard: SHOT must be eligible from the current lastActionType (PASS phase only)
  if (state.lastActionType !== null) {
    const eligible = ELIGIBLE_NEXT_ACTIONS[state.lastActionType];
    if (!eligible.has('SHOT')) {
      return { ok: false, reason: 'INVALID_SEQUENCE' };
    }
  }

  // Find the defending GK (role:'GK' on the non-attacking team)
  const gk = state.pieces.find((p) => p.teamId === defendingTeam && p.role === 'GK');
  if (!gk) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }

  // D-02: Transition directly to GK_DIVING (single hop rather than SHOT_DECLARED + GK_DIVING).
  // Records shotTargetHex and seeds gkDivePosition from GK's current position.
  return {
    ok: true,
    state: {
      ...state,
      phase: 'GK_DIVING',
      lastActionType: 'SHOT', // marks that a shot was declared
      shotTargetHex: goalHex,
      gkDivePosition: gk.position, // GK's starting position — used as cumulative dive reference
    },
  };
}

// ---------------------------------------------------------------------------
// applyGKDive
// ---------------------------------------------------------------------------

/**
 * Discriminated union result for applyGKDive.
 * T-10-06: all GK dive coordinates are re-validated server-side.
 */
export type ApplyGKDiveResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'NOT_PARALLEL' | 'TOO_FAR' | 'OFF_PITCH' }
  | { ok: true; state: GameState };

/**
 * Repositions the GK during the GK_DIVING interactive phase.
 *
 * D-04 / SHOT-04: GK may move up to 3 hexes parallel to the goal line (constant q).
 * Cumulative distance from GK's starting position (piece.position in state.pieces) to `to` must be ≤ 3.
 * At 3rd hex: -1 Saving penalty applied at resolution time via validateGKDive (Pitfall 2).
 * Shot origin 4+ hexes from gkDivePosition at resolution = unsaveable.
 *
 * The -1 Saving penalty and unsaveability are NOT computed here — they are derived
 * at resolution time from hexDistance(gkDivePosition, shooterPos) via validateGKDive.
 *
 * Guard sequence (fail-fast):
 * 1. WRONG_PHASE — phase must be 'GK_DIVING'
 * 2. NOT_PARALLEL — to.q must equal gk.position.q (parallel to goal line, Pitfall 1)
 * 3. TOO_FAR — hexDistance from GK's initial position to `to` must be ≤ 3
 * 4. OFF_PITCH — `to` must be a valid pitch hex (isPitchHex)
 *
 * @param state - Current game state (phase must be 'GK_DIVING')
 * @param to    - Target hex for the GK dive
 */
export function applyGKDive(state: GameState, to: HexCoord): ApplyGKDiveResult {
  // 1. Phase guard
  if (state.phase !== 'GK_DIVING') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // Find the defending GK
  const defendingTeam: 'home' | 'away' = state.attackingTeam === 'home' ? 'away' : 'home';
  const gk = state.pieces.find((p) => p.teamId === defendingTeam && p.role === 'GK');
  if (!gk) {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // 2. Parallel-to-goal-line guard (Pitfall 1: constant q = parallel to goal line)
  if (to.q !== gk.position.q) {
    return { ok: false, reason: 'NOT_PARALLEL' };
  }

  // 3. Cumulative distance guard: from GK's initial position (piece position in pieces array)
  // to the target hex must be ≤ 3 (Pitfall 2: use post-dive position for resolution,
  // but use piece.position as the cumulative reference here — see spec action §3).
  const cumulativeDistance = hexDistance(gk.position, to);
  if (cumulativeDistance > 3) {
    return { ok: false, reason: 'TOO_FAR' };
  }

  // 4. Pitch boundary guard (T-10-06)
  if (!isPitchHex(to)) {
    return { ok: false, reason: 'OFF_PITCH' };
  }

  // Update gkDivePosition to the new position
  return {
    ok: true,
    state: {
      ...state,
      gkDivePosition: to,
    },
  };
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
      ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null }, // reset ball to centre hex
      lastDiceRoll: null,
      pendingFreeMove: null,
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
