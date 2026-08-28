import type { HexCoord, MatchStats, PlayerPiece } from './types.js';
import { isInRegion } from './pitch.js';
import { isActivePiece } from './stoppagePhases.js';

/**
 * Phase 45 (Game Summary Popup): pure, dependency-light match-statistics helpers.
 *
 * Implements the user's verbatim D-01 xG formula (per-shot expected goals), D-02's
 * coordinate mapping (`X` = depth along the q-axis from the attacked goal line, `Y` =
 * raw axial `r`), D-04's reuse of `pitch.ts`'s existing goal-box/penalty-box region
 * geometry rather than re-deriving new zone boundaries, PD-01's "shot hex is the
 * SHOOTER's own hex, not the target hex" definition, PD-02's goal-orientation/region
 * derivation from `attackingTeam`, and PD-03's per-factor clamping that keeps every
 * result inside `[0, 1]` even for adversarial inputs.
 *
 * No classes, no I/O, no throw paths — every export below is a pure function or a
 * frozen constant, safely importable and callable from both server (authoritative) and
 * client (display-only) code (see T-45-01 in 45-01-PLAN.md's threat model).
 */

/**
 * STATS-04..09: the empty/zeroed seed for every whole-match Game Summary counter.
 * Consumed by `buildInitialGameState` (plan 45-02) to initialize `GameState.matchStats`
 * and as the fallback base inside `recordShotInStats` when no stats exist yet.
 */
export const EMPTY_MATCH_STATS: MatchStats = Object.freeze({
  possessionActionCount: Object.freeze({ home: 0, away: 0 }),
  passesCompleted: Object.freeze({ home: 0, away: 0 }),
  tackleStealAttempts: Object.freeze({ home: 0, away: 0 }),
  tackleStealSuccesses: Object.freeze({ home: 0, away: 0 }),
  shots: Object.freeze({ home: 0, away: 0 }),
  xg: Object.freeze({ home: 0, away: 0 }),
  fouls: Object.freeze({ home: 0, away: 0 }),
  yellowCards: Object.freeze({ home: 0, away: 0 }),
  redCards: Object.freeze({ home: 0, away: 0 }),
});

/**
 * STATS-08: computes the D-01 per-shot xG value.
 *
 * D-01 (verbatim user formula):
 * ```
 * xg = 1
 *    * (1 - (D * 0.13))
 *    * (1 - (C * 0.10))
 *    * (1 - (ABS(Y-13) > 3 ? ABS(Y-13) * 0.07 : ABS(Y-13) * 0.04))
 *    * (1 - (X > 3 ? X * 0.07 : X * 0.04))
 * ```
 *
 * Where:
 * - `D` — count of ACTIVE defending pieces standing inside the attacked six-yard box.
 * - `C` — count of ACTIVE defending pieces standing inside the attacked penalty area
 *   but OUTSIDE the six-yard box. A piece inside the six-yard box is counted in `D`
 *   only, never double-counted here (D-04).
 * - `X` — `Math.abs(shotHex.q - goalQ)`: depth from the attacked goal line along the
 *   q-axis. Per PD-02, `goalQ` is 36 (the away goal column) when `attackingTeam` is
 *   `'home'`, and 0 (the home goal column) when `attackingTeam` is `'away'` — a team
 *   attacks the OPPOSITE goal from the one it defends.
 * - `Y` — the shot hex's raw axial `r`. The formula's own `-13` term centres it, since
 *   `r = 13` is the board's vertical centre row (D-02).
 *
 * `shotHex` must be the SHOOTER's own hex at the moment of the shot (PD-01), never the
 * target hex — for a penalty kick this is the kicker's position at `PENALTY_SPOT`.
 *
 * PD-03: each of the four factors above is individually clamped with `Math.max(0, ...)`
 * BEFORE multiplication. Every factor is structurally `<= 1` but can go negative for
 * extreme inputs (e.g. 8+ defenders crammed in the six-yard box, or a shot 20+ hexes
 * from goal) — multiplying two negative factors back together would silently produce a
 * nonsensical POSITIVE xG, so each factor is floored at 0 independently rather than
 * trusting the sign of the final product. This guarantees the return value is always
 * within `[0, 1]`.
 *
 * `defendingPieces` is filtered through `isActivePiece` (the shared BUG-38 helper,
 * `stoppagePhases.ts`) before counting, so a red-carded or benched piece never
 * contributes to `D`/`C`. Region membership uses `isInRegion` (`pitch.ts`) for both
 * checks — box geometry is never re-derived from pixel coordinates here.
 */
export function computeShotXg(
  shotHex: HexCoord,
  attackingTeam: 'home' | 'away',
  defendingPieces: readonly PlayerPiece[],
): number {
  const goalQ = attackingTeam === 'home' ? 36 : 0;
  const sixYardBoxRegion = attackingTeam === 'home' ? 'awaySixYardBox' : 'homeSixYardBox';
  const penaltyAreaRegion = attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';

  const activeDefenders = defendingPieces.filter(isActivePiece);
  const D = activeDefenders.filter((p) => isInRegion(p.position, sixYardBoxRegion)).length;
  const C = activeDefenders.filter(
    (p) => isInRegion(p.position, penaltyAreaRegion) && !isInRegion(p.position, sixYardBoxRegion),
  ).length;

  const X = Math.abs(shotHex.q - goalQ);
  const rowOffset = Math.abs(shotHex.r - 13);
  const rowWeight = rowOffset > 3 ? 0.07 : 0.04;
  const depthWeight = X > 3 ? 0.07 : 0.04;

  // PD-03: clamp each factor individually — see the sign-flip hazard explained in this
  // function's own doc comment above. Without this, two negative factors (e.g. a
  // crowded six-yard box AND a very deep shot) could multiply back into a positive
  // number instead of correctly bottoming out at 0.
  const defenderFactor = Math.max(0, 1 - D * 0.13);
  const penaltyAreaFactor = Math.max(0, 1 - C * 0.1);
  const rowFactor = Math.max(0, 1 - rowOffset * rowWeight);
  const depthFactor = Math.max(0, 1 - X * depthWeight);

  return defenderFactor * penaltyAreaFactor * rowFactor * depthFactor;
}

/**
 * STATS-07/STATS-08: returns a NEW `MatchStats` with `team`'s `shots` incremented by 1
 * and `xg` increased by `xg`. Never mutates `stats` or any of its nested objects; falls
 * back to `EMPTY_MATCH_STATS` when `stats` is `undefined` (the match's first shot).
 *
 * Performs no xG computation itself — callers pass an already-computed value (from
 * `computeShotXg`) so each server shot-resolution call site derives xG exactly once
 * from its own in-scope, pre-reset pieces.
 */
export function recordShotInStats(
  stats: MatchStats | undefined,
  team: 'home' | 'away',
  xg: number,
): MatchStats {
  const base = stats ?? EMPTY_MATCH_STATS;
  return {
    ...base,
    shots: { ...base.shots, [team]: base.shots[team] + 1 },
    xg: { ...base.xg, [team]: base.xg[team] + xg },
  };
}
