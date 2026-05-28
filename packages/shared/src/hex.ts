import type { HexCoord } from './types.js';

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
