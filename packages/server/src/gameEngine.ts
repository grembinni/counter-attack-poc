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
import { rollDice } from './diceUtils.js';

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
    const dice = rollDice();
    const defender = result.effect.defenders[0];
    // MOVE-04: combined score >= 10 threshold using computeCombinedScore (via rollDice).
    const combined = computeCombinedScore(defender!.tackling, dice, []);
    const stealResult: 'SUCCESS' | 'FAIL' = combined >= 10 ? 'SUCCESS' : 'FAIL';
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
      // CR-01: append pieceId to movedPieceIds so ATTACKER_2 ALREADY_MOVED guard works
      movedPieceIds: [...state.movedPieceIds, pieceId],
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

  // CR-03: clear pendingFreeMove when the undone piece is the ball carrier —
  // the final-third crossing that set it never happened once the move is reversed.
  const undoPendingFreeMove =
    state.ball.carrierId === moveToUndo.pieceId ? null : (state.pendingFreeMove ?? null);

  return {
    ok: true,
    state: {
      ...state,
      pieces: newPieces,
      paceUsedByPieceId: newPaceUsed,
      eventLog: newEventLog,
      pendingFreeMove: undoPendingFreeMove,
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
    // PASS: accuracy check → SHOT on accurate; LOOSE_BALL on inaccurate (D-14, D-15)
    // -------------------------------------------------------------------------
    case 'PASS': {
      const carrier = state.pieces.find((p) => p.id === state.ball.carrierId);
      if (!carrier) return { ok: false, reason: 'WRONG_PHASE' };

      // Use HIGH pass type (both High Pass and Long Ball use the accuracy check here).
      // The pass type distinction was resolved at pass-selection time (not stored in GameState v1).
      // Per D-14: use 'HIGH' pass type which maps to carrier.highPass attribute.
      const accuracyResult = validatePassAccuracy(carrier, 'HIGH', d1, []);

      if (accuracyResult.accurate) {
        // Accurate → transition to SHOT phase; ball position stays at carrier
        return {
          ok: true,
          state: {
            ...state,
            phase: 'SHOT',
            lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
          },
        };
      } else {
        // Inaccurate → LOOSE_BALL phase; landing resolved on the next game:roll with fresh dice (D-15, D-19)
        // Ball stays at incident hex; do NOT compute landing here (accuracy die d1 is biased)
        // Only the accuracy die (d1) is consumed here; d2 is reserved for the fresh LOOSE_BALL roll
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
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

      const shotResult = validateShotDuel(shooter, gk, shooterDice, gkDice, [], gkPenalties);

      if (shotResult.outcome === 'GOAL') {
        // Increment score for the attacking team; transition to KICK_OFF
        const newScore = {
          ...state.score,
          [state.attackingTeam]: state.score[state.attackingTeam] + 1,
        };
        return {
          ok: true,
          state: {
            ...state,
            phase: 'KICK_OFF',
            score: newScore,
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
          },
        };
      }

      if (shotResult.outcome === 'LOOSE_BALL') {
        // Tie → LOOSE_BALL phase; landing resolved on the next game:roll with fresh dice (D-13, D-19)
        // Ball stays at incident hex; do NOT compute landing here (biased dice reuse avoided)
        return {
          ok: true,
          state: {
            ...state,
            phase: 'LOOSE_BALL',
            ball: { position: state.ball.position, carrierId: null },
            lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
          },
        };
      }

      if (shotResult.outcome === 'MISS') {
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
          },
        };
      }

      // SAVE: run handling check (shotResult.outcome === 'SAVE', needsHandlingCheck: true)
      if (shotResult.outcome === 'SAVE') {
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
            },
          };
        } else {
          // Spill → Loose Ball from GK position
          const landing = computeLooseBall(
            gk.position,
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
              lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
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
            },
          };
        } else {
          // Attacker wins heading duel vs GK → GOAL
          const newScore = {
            ...state.score,
            [state.attackingTeam]: state.score[state.attackingTeam] + 1,
          };
          return {
            ok: true,
            state: {
              ...state,
              phase: 'KICK_OFF',
              score: newScore,
              ball: { position: state.ball.position, carrierId: null },
              lastDiceRoll: {
                rolls: [attackerDice, defenderDice, gkDice],
                context: 'HEADING_DUEL',
              },
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
            },
          };
        } else {
          // Attacker beats GK → GOAL
          const newScore = {
            ...state.score,
            [state.attackingTeam]: state.score[state.attackingTeam] + 1,
          };
          return {
            ok: true,
            state: {
              ...state,
              phase: 'KICK_OFF',
              score: newScore,
              ball: { position: state.ball.position, carrierId: null },
              lastDiceRoll: {
                rolls: [attackerDice, defenderDice, gkDice],
                context: 'HEADING_DUEL',
              },
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
          },
        };
      }
    }

    // -------------------------------------------------------------------------
    // LOOSE_BALL: direction + distance dice → compute landing hex (D-19/D-20/D-21)
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
      },
    };
  }

  // ---- 'throw' branch (D-25) ----
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
      },
    };
  }

  // ---- 'kick' branch (D-24) ----
  // GK kick = High Pass accuracy check using GK's highPass attribute + injected dice roll.
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
      },
    };
  }
}
