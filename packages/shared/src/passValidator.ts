/**
 * Passing validators for the Counter Attack game engine.
 *
 * PASS-01: Standard Pass — max 11 hexes; blocked by opponents in the path.
 * PASS-02: First-time Pass — max 6 hexes; signals FIRST_TIME_PLAYER_MOVES effect.
 * PASS-03: High Pass — max 15 hexes; accuracy check required (highPass vs threshold 8).
 * PASS-04: Long Pass — no distance cap; LANDING_RESTRICTED when target is within 5 hexes of own
 *          teammate (excluding passer) or adjacent (≤1 hex) to any opponent; accuracy check (dribbling,
 *          threshold 9 same-third / 10 cross-third).
 * PASS-05: Inaccurate High/Long pass triggers Loose Ball (triggerLooseBall: true in AccuracyResult).
 *
 * Attribute mapping (D-04, D-14 Phase 5 verified):
 * - High Pass accuracy uses piece.highPass
 * - Long Pass accuracy uses piece.dribbling
 */

import type { GameState, PlayerPiece, HexCoord } from './types.js';
import { hexDistance, hexLine, getZoIDefenders } from './hex.js';
import { computeCombinedScore } from './scoreUtils.js';

/**
 * Discriminated union result for validatePass.
 *
 * Reject: RANGE_EXCEEDED (distance cap or zero), PATH_BLOCKED (Standard only), LANDING_RESTRICTED (LONG only).
 * Accept: ok:true with interceptors (possibly empty) and optional FIRST_TIME_PLAYER_MOVES effect.
 */
export type PassResult =
  | { ok: false; reason: 'RANGE_EXCEEDED' | 'PATH_BLOCKED' | 'LANDING_RESTRICTED' }
  | { ok: true; interceptors: PlayerPiece[] }
  | { ok: true; interceptors: PlayerPiece[]; effect: { type: 'FIRST_TIME_PLAYER_MOVES' } };

/**
 * Discriminated union result for validatePassAccuracy.
 * Inaccurate result always carries triggerLooseBall:true (PASS-05).
 */
export type AccuracyResult = { accurate: true } | { accurate: false; triggerLooseBall: true };

/**
 * Validates a pass attempt for range, path legality, PASS-04 landing constraints, and interception.
 *
 * Guard precedence:
 * 1. distance === 0 → RANGE_EXCEEDED (all types)
 * 2. Per-type distance cap → RANGE_EXCEEDED (STANDARD ≤11, FIRST_TIME ≤6, HIGH ≤15; LONG: unlimited)
 * 3. STANDARD only: path blocking via hexLine slice(1,-1) → PATH_BLOCKED
 * 4. LONG only: PASS-04 landing constraints → LANDING_RESTRICTED
 * 5. Interception list collection (all except LONG)
 * 6. Success with optional effect
 *
 * @param state - Current game state
 * @param piece - The passing piece
 * @param from - Origin hex coordinate
 * @param to - Destination hex coordinate
 * @param passType - Pass type determining rules
 */
export function validatePass(
  state: GameState,
  piece: PlayerPiece,
  from: HexCoord,
  to: HexCoord,
  passType: 'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG',
): PassResult {
  const dist = hexDistance(from, to);

  // 1. Cannot pass to own hex
  if (dist === 0) return { ok: false, reason: 'RANGE_EXCEEDED' };

  // 2. Per-type distance cap (LONG has no cap, only the === 0 guard above)
  if (passType === 'STANDARD' && dist > 11) return { ok: false, reason: 'RANGE_EXCEEDED' };
  if (passType === 'FIRST_TIME' && dist > 6) return { ok: false, reason: 'RANGE_EXCEEDED' };
  if (passType === 'HIGH' && dist > 15) return { ok: false, reason: 'RANGE_EXCEEDED' };

  // 3. STANDARD only: path blocking (PASS-01)
  // slice(1, -1) skips passer's hex and destination — only intermediate hexes can block
  // Any piece (own team or opponent) on an intermediate hex blocks the pass.
  if (passType === 'STANDARD') {
    const intermediateHexes = hexLine(from, to).slice(1, -1);
    const blocked = intermediateHexes.some((hex) =>
      state.pieces.some((p) => p.position.q === hex.q && p.position.r === hex.r),
    );
    if (blocked) return { ok: false, reason: 'PATH_BLOCKED' };
  }

  // 4. LONG only: PASS-04 landing constraints
  // Own-piece exclusion: cannot land within 5 hexes of any teammate (excluding the passer)
  // Opponent adjacency exclusion: cannot land adjacent (≤1 hex) to any opponent
  if (passType === 'LONG') {
    const ownTeammates = state.pieces.filter((p) => p.teamId === piece.teamId && p.id !== piece.id);
    if (ownTeammates.some((p) => hexDistance(to, p.position) <= 5)) {
      return { ok: false, reason: 'LANDING_RESTRICTED' };
    }
    const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
    if (opponents.some((p) => hexDistance(to, p.position) <= 1)) {
      return { ok: false, reason: 'LANDING_RESTRICTED' };
    }
  }

  // 5. Interception list — opponents within 1 hex of any travel-path hex (D-05)
  // LONG cannot be intercepted in flight; returns empty interceptors.
  const interceptors: PlayerPiece[] = [];
  if (passType !== 'LONG') {
    const travelPath = hexLine(from, to).slice(1, -1); // exclude passer's hex and destination
    const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
    for (const hex of travelPath) {
      for (const defender of getZoIDefenders(hex, opponents)) {
        if (!interceptors.some((d) => d.id === defender.id)) {
          interceptors.push(defender);
        }
      }
    }
  }

  // 6. Success — FIRST_TIME carries its effect
  if (passType === 'FIRST_TIME') {
    return { ok: true, interceptors, effect: { type: 'FIRST_TIME_PLAYER_MOVES' } };
  }
  return { ok: true, interceptors };
}

/**
 * Validates pass accuracy for High and Long pass types.
 *
 * Thresholds (PASS-03/PASS-04): HIGH = 8, LONG_SAME_THIRD = 9, LONG_CROSS_THIRD = 10.
 *
 * Attribute mapping (D-04, D-14 Phase 5 verified):
 * - High Pass accuracy uses piece.highPass
 * - Long Pass accuracy uses piece.dribbling
 *
 * PASS-05: An inaccurate result carries triggerLooseBall:true to signal the Loose Ball sequence.
 *
 * @param piece - The passing piece
 * @param passType - HIGH, LONG_SAME_THIRD, or LONG_CROSS_THIRD
 * @param diceValue - Injected dice value (never generated here)
 * @param penalties - Array of penalty modifiers; DICE-04 -2 cap applied via computeCombinedScore
 */
export function validatePassAccuracy(
  piece: PlayerPiece,
  passType: 'HIGH' | 'LONG_SAME_THIRD' | 'LONG_CROSS_THIRD',
  diceValue: number,
  penalties: number[],
): AccuracyResult {
  const threshold = passType === 'HIGH' ? 8 : passType === 'LONG_SAME_THIRD' ? 9 : 10;
  // D-14 (Phase 5): HIGH pass uses highPass attribute, not aerialAbility.
  const attribute = passType === 'HIGH' ? piece.highPass : piece.dribbling;
  const score = computeCombinedScore(attribute, diceValue, penalties);
  return score >= threshold ? { accurate: true } : { accurate: false, triggerLooseBall: true };
}
