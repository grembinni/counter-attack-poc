import type { HexCoord, PlayerPiece } from './types.js';

// ODD-Q flat-top offset layout.
// Stored (q, r) coordinates are offset (col, row): q=column (0..36), r=row (0..25).
// Odd columns are shifted down by half a hex relative to even columns.
//
// Neighbour sets depend on column parity — see hexNeighbors.
// Distance and line-draw use cube coordinate conversion internally.
// Source: redblobgames.com/grids/hexagons/ §Offset coordinates

// ODD-Q offset neighbour offsets per column parity.
const ODD_Q_NEIGHBORS: readonly [readonly HexCoord[], readonly HexCoord[]] = [
  // Even q
  [
    { q: 1, r: -1 },
    { q: 1, r: 0 },
    { q: 0, r: -1 },
    { q: 0, r: 1 },
    { q: -1, r: -1 },
    { q: -1, r: 0 },
  ],
  // Odd q
  [
    { q: 1, r: 0 },
    { q: 1, r: 1 },
    { q: 0, r: -1 },
    { q: 0, r: 1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
  ],
];

/** Convert ODD-Q offset (q, r) → cube (x, y, z). */
function toCube(h: HexCoord): { x: number; y: number; z: number } {
  const x = h.q;
  // q & 1 works for negative q in JS two's-complement (odd-column flag)
  const z = h.r - (h.q - (h.q & 1)) / 2;
  return { x, y: -x - z, z };
}

/** Convert cube (x, y, z) → ODD-Q offset (q, r). */
function fromCube(x: number, y: number, z: number): HexCoord {
  const q = x;
  const r = z + (q - (q & 1)) / 2;
  return { q, r };
}

/**
 * Returns the distance between two hexes in the ODD-Q offset grid.
 * Converts to cube coordinates, then uses the max-component formula.
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ca = toCube(a);
  const cb = toCube(b);
  return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y), Math.abs(ca.z - cb.z));
}

/**
 * Returns the 6 ODD-Q offset neighbours of the given hex.
 * Neighbour set depends on column parity (even vs odd q).
 */
export function hexNeighbors(hex: HexCoord): HexCoord[] {
  const dirs = ODD_Q_NEIGHBORS[hex.q & 1];
  return dirs.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

/**
 * Returns all hexes within `range` steps of `center`.
 * Count: 3*range^2 + 3*range + 1 (same for any hex grid).
 * Uses cube-coordinate range loop + cube→ODD-Q conversion.
 */
export function hexesInRange(center: HexCoord, range: number): HexCoord[] {
  const cc = toCube(center);
  const results: HexCoord[] = [];
  for (let dx = -range; dx <= range; dx++) {
    for (let dy = Math.max(-range, -dx - range); dy <= Math.min(range, -dx + range); dy++) {
      const dz = -dx - dy;
      results.push(fromCube(cc.x + dx, cc.y + dy, cc.z + dz));
    }
  }
  return results;
}

/**
 * Returns true if `position` is within Zone of Influence of any opponent piece.
 * ZoI = adjacent hex (distance 1).
 */
export function isUnderZoI(position: HexCoord, opponentPieces: readonly HexCoord[]): boolean {
  return opponentPieces.some((opponent) => hexDistance(position, opponent) === 1);
}

/**
 * Returns the sequence of hex coordinates forming a straight line from `from` to `to`,
 * inclusive. Length = hexDistance(from, to) + 1.
 * Uses cube-coordinate linear interpolation with cube_round tiebreak.
 */
export function hexLine(from: HexCoord, to: HexCoord): HexCoord[] {
  const n = hexDistance(from, to);
  if (n === 0) return [from];
  const cf = toCube(from);
  const ct = toCube(to);
  const results: HexCoord[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const fx = cf.x + (ct.x - cf.x) * t;
    const fy = cf.y + (ct.y - cf.y) * t;
    const fz = cf.z + (ct.z - cf.z) * t;
    let rx = Math.round(fx);
    let ry = Math.round(fy);
    const rz = Math.round(fz);
    const ddx = Math.abs(rx - fx);
    const ddy = Math.abs(ry - fy);
    const ddz = Math.abs(rz - fz);
    if (ddx > ddy && ddx > ddz) {
      rx = -ry - rz;
    } else if (ddy > ddz) {
      ry = -rx - rz;
    }
    results.push(fromCube(rx, ry, rz));
  }
  return results;
}

/**
 * Returns the subset of `opponentPieces` within Zone of Influence of `position`
 * (i.e., exactly 1 hex away). Used by validators to attach the defender list.
 */
export function getZoIDefenders(
  position: HexCoord,
  opponentPieces: readonly PlayerPiece[],
): PlayerPiece[] {
  return opponentPieces.filter((p) => hexDistance(position, p.position) === 1);
}
