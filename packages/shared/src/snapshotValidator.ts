/**
 * Snapshot trigger validator for the Counter Attack game engine.
 *
 * SNAP-01: A snapshot is available only when game phase is MOVEMENT, PASS, or SNAPSHOT.
 *          Penalty-area boundary detection is deferred to Phase 4 — the Phase 4 FSM will
 *          gate validateSnapshot calls behind a ball-in-penalty-area check once pitch regions
 *          are encoded (CONTEXT.md Deferred Ideas).
 *
 * SNAP-02: A successful snapshot always incurs a -1 shooting penalty, and the opponent
 *          gets a 2-hex deflection move before the shot is resolved.
 *
 * SNAP-03: Snapshot follows standard shooting rules. Composition: the Phase 4 FSM calls
 *          validateSnapshot → if ok, calls validateShotDuel with shootingPenalty applied.
 *          This composition pattern is resolved (Open Question 2 in 02-RESEARCH.md is now RESOLVED:
 *          validateSnapshot is called by the FSM after any pass; Phase 2 only validates
 *          legality given current state).
 *
 * The `piece` parameter is accepted for type discipline and future identity-based checks.
 * Phase 2 does not gate the result on piece identity beyond what the FSM provides.
 */

import type { GameState } from './types.js';

/**
 * Discriminated union result for validateSnapshot.
 *
 * Reject: WRONG_PHASE — snapshot is not available outside MOVEMENT, PASS, SNAPSHOT phases.
 * Accept: ok:true with shootingPenalty:-1 and deflectionEffect (SNAP-02).
 */
export type SnapshotResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | {
      ok: true;
      shootingPenalty: -1;
      deflectionEffect: { type: 'OPPONENT_MOVES'; maxHexes: 2 };
    };

/**
 * Validates whether a snapshot attempt is mechanically available.
 *
 * SNAP-01: Rejects if phase is not MOVEMENT, PASS, or SNAPSHOT.
 * SNAP-02: On success, returns -1 shooting penalty + 2-hex opponent deflection signal.
 *
 * Penalty-area boundary check is NOT performed here — deferred to Phase 4 FSM.
 *
 * @param state - Game state
 */
export function validateSnapshot(state: GameState): SnapshotResult {
  // SNAP-01: snapshot only available in these three phases
  if (state.phase !== 'MOVE' && state.phase !== 'PASS' && state.phase !== 'SNAPSHOT') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }

  // SNAP-02: always -1 shooting penalty + opponent 2-hex deflection move
  return {
    ok: true,
    shootingPenalty: -1,
    deflectionEffect: { type: 'OPPONENT_MOVES', maxHexes: 2 },
  };
}
