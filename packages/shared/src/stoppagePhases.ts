import type { GamePhase, PlayerPiece } from './types.js';

/**
 * Phase 40 (SUB-01/04/06): substitution *eligibility* rules.
 *
 * This module owns three independent things:
 *  - the stoppage-phase allow-list (`STOPPAGE_PHASES`/`isStoppagePhase`), answering
 *    SUB-01's "any stoppage" question — the planner's explicit resolution of
 *    RESEARCH.md Open Question 1 / Assumption A1;
 *  - the whole-match substitution cap constant (`MAX_SUBS_PER_TEAM`, SUB-04);
 *  - the red-card headcount cap (`maxOnPitchFor`, SUB-06/D-08).
 *
 * Mirrors the `validUndoPhases` flat-allow-list idiom (`gameHandlers.ts`), but is
 * promoted to `packages/shared` so both the server (handler guard) and the client
 * (button enablement) import the identical list — see the threat-model note in
 * 40-01-PLAN.md (T-40-02): the server never re-declares a local copy, so a
 * client-side edit can never widen the server's gate.
 */

/**
 * A phase is a stoppage when the ball is dead and a manager is placing/choosing —
 * i.e. the setup/reposition/taker-select stages of each of SUB-01's seven named
 * restarts (kick-off, half-time, free kick, throw-in, goal kick, corner kick,
 * penalty kick). Exactly 15 values; do not add or remove entries without
 * re-confirming against RESEARCH.md Open Question 1 / Assumption A1. TACKLE_STEAL_PROMPT
 * (Phase 43) is deliberately NOT one of these 15 — see the exclusion list below.
 */
export const STOPPAGE_PHASES: readonly GamePhase[] = [
  'KICK_OFF_SETUP',
  'HALF_TIME',
  'FREE_KICK_SETUP',
  'THROW_IN_SETUP',
  'GOAL_KICK_SETUP_GK',
  'GOAL_KICK_SETUP_OPPONENT',
  'GOAL_KICK_CHOICE',
  'CORNER_KICK_GK_SETUP_ATTACKING',
  'CORNER_KICK_GK_SETUP_DEFENDING',
  'CORNER_KICK_TAKER_SELECT',
  'CORNER_KICK_REPOSITION',
  'CORNER_KICK_FINAL_SETUP',
  'PENALTY_KICK_SETUP_ATTACKING',
  'PENALTY_KICK_SETUP_DEFENDING',
  'PENALTY_KICK_TAKER_SELECT',
] as const;

// Deliberately EXCLUDED, each for a distinct reason (mirrors validUndoPhases'
// per-entry commenting discipline):
//  - 'KICK_OFF' — the kick itself, not the setup/placement stage.
//  - 'GOAL_KICK_TARGET' / 'GOAL_KICK_MOVE' / 'PENALTY_KICK' — ball in flight or a
//    duel actively resolving, not a dead-ball placement window.
//  - 'GK_RESTART' / 'GK_QUICK_THROW' / 'GK_KICK_TARGET' / 'GK_KICK_MOVE' — a GK
//    catch/save restart is not one of SUB-01's seven named stoppages; GOALKICK-01
//    already established this chain as structurally separate from Goal Kick.
//  - 'FOUL_CHOICE' / 'GK_DIVE_AT_FEET_PROMPT' / 'GK_DIVE_AT_FEET_TARGET' /
//    'GK_BOX_ENTRY_PROMPT' / 'GK_BOX_ENTRY_MOVE' / 'TACKLE_STEAL_PROMPT' (Phase 43) —
//    mid-duel decision prompts, not restarts. A substitution can never be started
//    mid-prompt.
//  - 'LOBBY' / 'FULL_TIME' / 'REPLAY' — no live match in progress.

/** SUB-01: returns true iff `phase` is one of the 15 allow-listed stoppage phases. */
export function isStoppagePhase(phase: GamePhase): boolean {
  return STOPPAGE_PHASES.includes(phase);
}

/** SUB-04: whole-match substitution cap per team. Never resets at half-time. */
export const MAX_SUBS_PER_TEAM = 3;

/**
 * SUB-06/D-08: `maxOnPitch = 11 - redCardCount` for the given team, DERIVED from
 * `pieces` per RESEARCH.md Assumption A3 — never a stored counter field.
 *
 * D-13 note: a red-carded player also appears on the bench for display purposes,
 * but this derivation deliberately does NOT change — the red-carded piece REMAINS
 * in `state.pieces` (with `redCarded: true`), so this count is unaffected by the
 * bench mirror entry.
 */
export function maxOnPitchFor(pieces: readonly PlayerPiece[], teamId: 'home' | 'away'): number {
  const redCardCount = pieces.filter((p) => p.teamId === teamId && p.redCarded === true).length;
  return 11 - redCardCount;
}

/**
 * BUG-38 (Phase 42, D-09): the single shared exclude-by-flag check for "is this piece
 * eligible for gameplay computations" — eligibility/occupancy/ZoI/interceptor lists,
 * anywhere in `packages/shared`, must be built through this predicate rather than a
 * hand-written inline clause.
 *
 * D-08's constraint: a red-carded piece's `position` is never nulled and the piece is
 * never spliced out of `state.pieces` (see `PlayerPiece.onPitch`'s own field comment in
 * types.ts and gameEngine.ts's CARD-02/CARD-04 applyMove comment) — so every consumer
 * that walks `state.pieces` must exclude a sent-off/benched piece by flag, not by
 * absence from the array.
 *
 * Both `redCarded` and `onPitch` are checked, not either alone: gameEngine.ts's
 * booking-resolution red-card branch sets `redCarded: true` and `onPitch: false`
 * atomically in the same `pieces.map()` spread, so either clause alone is sufficient
 * TODAY — but `onPitch` is documented as an independently-settable client-rendering
 * signal, and checking both makes this predicate correct for any future caller that
 * sets only one of the two. Do NOT collapse this to a single clause.
 *
 * Hand-writing `p.redCarded !== true` inline at a call site is the exact bug class
 * BUG-38 exists to close — it happened at 3+ sites in the codebase and 2 were missed
 * by the original red-card audit (the whole of `packages/shared` was structurally
 * un-scanned, see PITFALLS.md Pitfall 7). New eligibility/occupancy/defender-list
 * sites must call this helper rather than re-deriving the same check.
 */
export function isActivePiece(piece: PlayerPiece): boolean {
  return piece.redCarded !== true && piece.onPitch !== false;
}
