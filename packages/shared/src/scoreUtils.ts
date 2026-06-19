/**
 * Shared scoring utilities for the Counter Attack validator layer.
 *
 * DICE-03: Combined score = attribute + dice result (+ clamped penalties)
 * DICE-04: Maximum cumulative dice penalty is -2, regardless of the number or magnitude of individual penalties
 * DICE-05: Loose Ball destination is computed from a direction die (1-6) and a distance die (1-6)
 * D-06: computeLooseBall receives dice values as parameters — no random number generation here
 * D-07: Direction mapping is hard-coded per Counter Attack rulebook v1.4.1 deflection ruler
 */

import type { HexCoord } from './types.js';
import { toCube, fromCube } from './hex.js';

/**
 * Computes the combined score for a dice resolution.
 *
 * Combined score = attribute + diceValue + clamp(sum(penalties), -2, 0)
 *
 * DICE-04: The cumulative penalty is capped at -2 regardless of the number or
 * magnitude of individual penalty values. This is the single source of truth for
 * the -2 cap — all validators must use this function rather than inline math.
 *
 * @param attribute - The relevant PlayerPiece attribute (e.g. shooting, saving)
 * @param diceValue - The injected dice roll value (1-6)
 * @param penalties - Array of penalty modifiers (negative numbers, e.g. [-1, -1])
 * @returns Combined score with DICE-04 cap applied
 */
export function computeCombinedScore(
  attribute: number,
  diceValue: number,
  penalties: number[],
): number {
  const totalPenalty = penalties.reduce((sum, p) => sum + p, 0);
  // DICE-04: cap cumulative penalty at -2 (penalties are negative, so we use Math.max)
  const clampedPenalty = Math.max(totalPenalty, -2);
  return attribute + diceValue + clampedPenalty;
}

/**
 * Loose Ball direction unit vectors, indexed 0-5 corresponding to dice values 1-6.
 *
 * Source: Counter Attack rulebook v1.4.1 deflection ruler
 * Order: 1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE
 *
 * These are CUBE-coordinate unit vectors, not ODD-Q offset deltas. Cube coordinates
 * have no column-parity concept, so a single fixed cube delta per compass direction
 * is valid for every starting hex regardless of column parity — unlike a fixed
 * offset-coordinate delta, which only traces a true straight line for the parity it
 * was derived from (the bug this table replaces; see
 * .planning/debug/loose-ball-scatter-rolls.md).
 *
 * Each direction's cube delta was derived from `hexNeighbors({q:0,r:0})` (an even-q
 * hex) by converting both the hex and its neighbour to cube via `toCube` and taking
 * the difference (neighbor_cube - hex_cube) — the same offset-to-cube conversion
 * `hexLine`/`hexesInRange` already use, applied here to find the 6 canonical
 * direction vectors once.
 */
const LOOSE_BALL_CUBE_DIRECTIONS: readonly { x: number; y: number; z: number }[] = [
  { x: 1, y: -1, z: 0 }, // 1 = E
  { x: 1, y: 0, z: -1 }, // 2 = NE
  { x: 0, y: 1, z: -1 }, // 3 = NW
  { x: -1, y: 0, z: 1 }, // 4 = W
  { x: -1, y: 1, z: 0 }, // 5 = SW
  { x: 0, y: -1, z: 1 }, // 6 = SE
];

/**
 * Computes the raw Loose Ball destination from an incident hex, a direction die,
 * and a distance die. No boundary checking — returns the raw HexCoord.
 *
 * Boundary validation (is the result a valid pitch hex?) is deferred to Phase 4
 * when PITCH_HEXES contains real coordinates (per D-06 and CONTEXT.md Deferred Ideas).
 *
 * Implementation: converts `from` to cube via `toCube`, adds the direction's cube
 * unit vector scaled by `distance`, then converts back to ODD-Q offset via
 * `fromCube`. This produces a true single-direction, single-distance straight line
 * on the actual ODD-Q offset pitch grid for all 6 directions and both column
 * parities — matching the same offset-to-cube-and-back pattern `hexLine` uses,
 * rather than repeatedly applying a fixed offset delta (which only stays straight
 * for parity-independent axis-aligned directions).
 *
 * @param from - The incident hex where the Loose Ball originates
 * @param direction - Direction die value (1-6); 1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE
 * @param distance - Distance die value (1-6); number of hexes to travel
 * @returns Raw destination HexCoord (no pitch boundary enforcement)
 */
export function computeLooseBall(
  from: HexCoord,
  direction: 1 | 2 | 3 | 4 | 5 | 6,
  distance: 1 | 2 | 3 | 4 | 5 | 6,
): HexCoord {
  // Non-null assertion required by noUncheckedIndexedAccess.
  // Safe by construction: the literal union 1|2|3|4|5|6 maps to indices 0-5 exactly.
  const dir = LOOSE_BALL_CUBE_DIRECTIONS[direction - 1]!;
  const cube = toCube(from);
  return fromCube(cube.x + dir.x * distance, cube.y + dir.y * distance, cube.z + dir.z * distance);
}
