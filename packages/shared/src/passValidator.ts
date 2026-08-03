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
 * Attribute mapping (D-04, Phase 8.2 correction):
 * - High Pass accuracy uses piece.highPass
 * - Long Pass accuracy uses piece.highPass (D-04, Phase 8.2 correction; previously incorrectly used piece.dribbling)
 */

import type { GameState, PlayerPiece, HexCoord } from './types.js';
import { hexDistance, hexLine, getZoIDefenders } from './hex.js';
import { computeCombinedScore } from './scoreUtils.js';

/**
 * Discriminated union result for validatePass.
 *
 * Reject: RANGE_EXCEEDED (distance cap or zero), PATH_BLOCKED (Standard only — intermediate hex), LANDING_RESTRICTED (LONG only).
 * Accept: ok:true with autoIntercepts (case 1: destination defender, no roll) and rollIntercepts (case 3: ZoI defenders,
 *   die===6 || combined>=10 threshold) and optional FIRST_TIME_PLAYER_MOVES effect.
 *
 * D-10 three cases:
 *   Case 1: destination hex IS a defender's hex → autoIntercepts (no roll, immediate interception)
 *   Case 2: path passes THROUGH a defender's hex (beyond them) → PATH_BLOCKED (unchanged)
 *   Case 3: defender within 1 hex of path, not on path → rollIntercepts (die===6 || combined>=10)
 */
export type PassResult =
  | { ok: false; reason: 'RANGE_EXCEEDED' | 'PATH_BLOCKED' | 'LANDING_RESTRICTED' }
  | { ok: true; autoIntercepts: PlayerPiece[]; rollIntercepts: PlayerPiece[] }
  | {
      ok: true;
      autoIntercepts: PlayerPiece[];
      rollIntercepts: PlayerPiece[];
      effect: { type: 'FIRST_TIME_PLAYER_MOVES' };
    };

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
 * @param options - THROWIN-04 (Phase 37): optional `maxDistance` override. When present,
 *   it REPLACES the per-type distance cap below (e.g. the 6-hex throw-in cap) instead of
 *   the normal STANDARD/FIRST_TIME/HIGH type-specific caps. When absent, existing per-type
 *   behaviour is byte-for-byte unchanged. Keeps range logic single-sourced in this shared
 *   validator rather than duplicated in the handler layer (RESEARCH.md §4.1 recommendation
 *   1). Deliberately does NOT add an `isPitchHex` check here (RESEARCH.md Assumption A4).
 */
export function validatePass(
  state: GameState,
  piece: PlayerPiece,
  from: HexCoord,
  to: HexCoord,
  passType: 'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG',
  options?: { maxDistance?: number },
): PassResult {
  const dist = hexDistance(from, to);

  // 1. Cannot pass to own hex
  if (dist === 0) return { ok: false, reason: 'RANGE_EXCEEDED' };

  // 2. Distance cap: an explicit maxDistance override REPLACES the per-type cap entirely
  // (THROWIN-04); otherwise the existing per-type caps apply unchanged (LONG has no cap,
  // only the === 0 guard above).
  if (options?.maxDistance !== undefined) {
    if (dist > options.maxDistance) return { ok: false, reason: 'RANGE_EXCEEDED' };
  } else {
    if (passType === 'STANDARD' && dist > 11) return { ok: false, reason: 'RANGE_EXCEEDED' };
    if (passType === 'FIRST_TIME' && dist > 6) return { ok: false, reason: 'RANGE_EXCEEDED' };
    if (passType === 'HIGH' && dist > 15) return { ok: false, reason: 'RANGE_EXCEEDED' };
  }

  // 3. Path blocking:
  // STANDARD: any opponent on an intermediate hex blocks the pass.
  // HIGH and LONG: only an opponent immediately adjacent to the kicker (on the path) blocks.
  // FIRST_TIME: no path blocking (short snap-pass).
  if (passType === 'STANDARD') {
    const opponentPieces = state.pieces.filter((p) => p.teamId !== piece.teamId);
    const intermediateHexes = hexLine(from, to).slice(1, -1);
    const blocked = intermediateHexes.some((hex) =>
      opponentPieces.some((p) => p.position.q === hex.q && p.position.r === hex.r),
    );
    if (blocked) return { ok: false, reason: 'PATH_BLOCKED' };
  } else if (passType === 'HIGH' || passType === 'LONG') {
    const opponentPieces = state.pieces.filter((p) => p.teamId !== piece.teamId);
    const adjacentOnPath = hexLine(from, to)[1]; // hex directly next to kicker on the target line
    if (
      adjacentOnPath &&
      opponentPieces.some(
        (p) => p.position.q === adjacentOnPath.q && p.position.r === adjacentOnPath.r,
      )
    ) {
      return { ok: false, reason: 'PATH_BLOCKED' };
    }
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

  // 5. Interception lists — D-10 three-case split:
  //   Case 1: destination hex is occupied by a defender → autoIntercepts (no roll, immediate interception)
  //   Case 3: ZoI defenders adjacent to path/destination → rollIntercepts (die===6 || combined>=10)
  //   HIGH and LONG passes skip interception (fly over defenders).

  // D-10 case 1: destination hex occupied by a defender → auto-intercept, no roll needed.
  // Only applies to STANDARD pass (FIRST_TIME has no path blocking; HIGH/LONG skip interception).
  // Note: the case-2 PATH_BLOCKED guard above already returned for intermediate hexes, so if we
  // reach here for STANDARD, the destination is the first defender-occupied hex on the line.
  const destDefender =
    passType === 'STANDARD'
      ? (state.pieces.find(
          (p) => p.teamId !== piece.teamId && p.position.q === to.q && p.position.r === to.r,
        ) ?? null)
      : null;

  // D-10: populate autoIntercepts (case 1) and rollIntercepts (case 3) separately.
  const autoIntercepts: PlayerPiece[] = destDefender ? [destDefender] : [];
  const rollIntercepts: PlayerPiece[] = [];
  if (passType !== 'LONG' && passType !== 'HIGH') {
    // Travel path excluding passer's hex; slice(1, -1) excludes destination (handled by destDefender above)
    const travelPath = hexLine(from, to).slice(1, -1);
    const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
    for (const hex of travelPath) {
      for (const defender of getZoIDefenders(hex, opponents)) {
        if (
          !rollIntercepts.some((d) => d.id === defender.id) &&
          !autoIntercepts.some((d) => d.id === defender.id)
        ) {
          rollIntercepts.push(defender);
        }
      }
    }
    // ZoI at destination hex (excluding destDefender already in autoIntercepts)
    for (const defender of getZoIDefenders(to, opponents)) {
      if (
        !rollIntercepts.some((d) => d.id === defender.id) &&
        !autoIntercepts.some((d) => d.id === defender.id)
      ) {
        rollIntercepts.push(defender);
      }
    }
  }

  // 6. Success — FIRST_TIME carries its effect
  if (passType === 'FIRST_TIME') {
    return {
      ok: true,
      autoIntercepts,
      rollIntercepts,
      effect: { type: 'FIRST_TIME_PLAYER_MOVES' },
    };
  }
  return { ok: true, autoIntercepts, rollIntercepts };
}

/**
 * Validates pass accuracy for High and Long pass types.
 *
 * Thresholds (PASS-03/PASS-04): HIGH = 8, LONG_SAME_THIRD = 9, LONG_CROSS_THIRD = 10.
 *
 * Attribute mapping (D-04, Phase 8.2 correction):
 * - High Pass accuracy uses piece.highPass
 * - Long Pass accuracy uses piece.highPass (D-04, Phase 8.2 correction; was incorrectly using piece.dribbling)
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
  // D-04 (Phase 8.2 correction): HIGH, LONG_SAME_THIRD, and LONG_CROSS_THIRD all use piece.highPass.
  // Prior code incorrectly used piece.dribbling for Long Pass types.
  const attribute = piece.highPass;
  const score = computeCombinedScore(attribute, diceValue, penalties);
  return score >= threshold ? { accurate: true } : { accurate: false, triggerLooseBall: true };
}
