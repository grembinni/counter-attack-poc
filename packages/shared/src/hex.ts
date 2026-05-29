import type { HexCoord, PlayerPiece } from './types.js';

// Axial direction vectors for the 6 hex neighbors (E, NE, NW, W, SW, SE)
// Source: redblobgames.com/grids/hexagons/
const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 }, // E
  { q: 1, r: -1 }, // NE
  { q: 0, r: -1 }, // NW
  { q: -1, r: 0 }, // W
  { q: -1, r: 1 }, // SW
  { q: 0, r: 1 }, // SE
];

/**
 * Returns the axial distance between two hex coordinates.
 * Formula: (|dq| + |dq+dr| + |dr|) / 2
 * Source: redblobgames.com/grids/hexagons/
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/**
 * Returns the 6 axial neighbors of the given hex.
 * Source: redblobgames.com/grids/hexagons/
 */
export function hexNeighbors(hex: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map((dir) => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
  }));
}

/**
 * Returns all hexes within `range` steps of `center`.
 * Count: 1 + 6 + 12 + ... = 3*range^2 + 3*range + 1 for range >= 0.
 * Source: redblobgames.com/grids/hexagons/
 */
export function hexesInRange(center: HexCoord, range: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -range; q <= range; q++) {
    for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

/**
 * Returns true if `position` is within Zone of Influence of any opponent piece.
 * ZoI = adjacent hex (distance 1). Phase 2 will refine semantics if needed.
 */
export function isUnderZoI(position: HexCoord, opponentPieces: readonly HexCoord[]): boolean {
  return opponentPieces.some((opponent) => hexDistance(position, opponent) === 1);
}

/**
 * Returns the sequence of hex coordinates forming a straight line from `from` to `to`,
 * inclusive of both endpoints. Length = hexDistance(from, to) + 1.
 *
 * Algorithm: linear interpolation in cube coordinates with cube_round tiebreak.
 * When `from === to` (distance 0), returns `[from]`.
 *
 * Source: redblobgames.com/grids/hexagons/#line-drawing
 */
export function hexLine(from: HexCoord, to: HexCoord): HexCoord[] {
  const n = hexDistance(from, to);
  if (n === 0) return [from];
  const results: HexCoord[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const fq = from.q + (to.q - from.q) * t;
    const fr = from.r + (to.r - from.r) * t;
    // Derive cube s coordinate for tiebreak rounding
    const fs = -fq - fr;
    let rq = Math.round(fq);
    let rr = Math.round(fr);
    const rs = Math.round(fs);
    const dq = Math.abs(rq - fq);
    const dr = Math.abs(rr - fr);
    const ds = Math.abs(rs - fs);
    if (dq > dr && dq > ds) {
      rq = -rr - rs;
    } else if (dr > ds) {
      rr = -rq - rs;
    }
    // rs reset omitted — only q,r are needed for HexCoord
    results.push({ q: rq, r: rr });
  }
  return results;
}

/**
 * Returns the subset of `opponentPieces` that are within Zone of Influence of
 * `position` (i.e., exactly 1 hex away). Typed variant of `isUnderZoI` that
 * returns the full `PlayerPiece[]` consequence data needed by validators (D-03/D-04).
 *
 * The boolean `isUnderZoI` is retained for backward-compat. Use `getZoIDefenders`
 * when a validator needs to attach the defender list to a discriminated union result.
 */
export function getZoIDefenders(
  position: HexCoord,
  opponentPieces: readonly PlayerPiece[],
): PlayerPiece[] {
  return opponentPieces.filter((p) => hexDistance(position, p.position) === 1);
}
