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
 * re-confirming against RESEARCH.md Open Question 1 / Assumption A1.
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
//    'GK_BOX_ENTRY_PROMPT' / 'GK_BOX_ENTRY_MOVE' — mid-duel decision prompts, not
//    restarts.
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
