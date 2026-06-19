import { describe, it, expect } from 'vitest';
import { computeCombinedScore, computeLooseBall } from './scoreUtils.js';
import { hexDistance } from './hex.js';
import type { HexCoord } from './types.js';

describe('computeCombinedScore', () => {
  it('returns attribute + diceValue when no penalties', () => {
    expect(computeCombinedScore(5, 4, [])).toBe(9);
  });

  it('applies a single -1 penalty', () => {
    expect(computeCombinedScore(5, 4, [-1])).toBe(8);
  });

  it('applies exact -2 penalty (cap reached exactly)', () => {
    expect(computeCombinedScore(5, 4, [-1, -1])).toBe(7);
  });

  it('caps cumulative penalty at -2 even when sum is -3 (DICE-04)', () => {
    expect(computeCombinedScore(5, 4, [-1, -1, -1])).toBe(7);
  });

  it('caps cumulative penalty at -2 regardless of individual magnitudes', () => {
    expect(computeCombinedScore(5, 4, [-2, -2])).toBe(7);
  });

  it('returns 0 when attribute and diceValue are both 0 with no penalties', () => {
    expect(computeCombinedScore(0, 0, [])).toBe(0);
  });
});

describe('computeLooseBall', () => {
  it('direction 1 (E) at distance 1 from origin returns {q:1,r:0}', () => {
    expect(computeLooseBall({ q: 0, r: 0 }, 1, 1)).toEqual({ q: 1, r: 0 });
  });

  it('direction 2 (NE) at distance 1 from origin returns {q:1,r:-1}', () => {
    expect(computeLooseBall({ q: 0, r: 0 }, 2, 1)).toEqual({ q: 1, r: -1 });
  });

  it('direction 3 (NW) at distance 1 from origin returns {q:0,r:-1}', () => {
    expect(computeLooseBall({ q: 0, r: 0 }, 3, 1)).toEqual({ q: 0, r: -1 });
  });

  it('direction 4 (W) at distance 1 from origin returns {q:-1,r:0}', () => {
    expect(computeLooseBall({ q: 0, r: 0 }, 4, 1)).toEqual({ q: -1, r: 0 });
  });

  it('direction 5 (SW) at distance 1 from origin returns {q:-1,r:-1} (true ODD-Q neighbor; the old {q:-1,r:1} expectation was itself buggy — it was never a true single-step SW neighbor from an even-q hex, per hexNeighbors({q:0,r:0}))', () => {
    const from = { q: 0, r: 0 };
    const result = computeLooseBall(from, 5, 1);
    expect(result).toEqual({ q: -1, r: -1 });
    expect(hexDistance(from, result)).toBe(1);
  });

  it('direction 6 (SE) at distance 1 from origin returns {q:0,r:1}', () => {
    expect(computeLooseBall({ q: 0, r: 0 }, 6, 1)).toEqual({ q: 0, r: 1 });
  });

  it('direction 1 (E) at distance 6 from origin lands at the geometrically correct hex {q:6,r:3} (a true straight "due east" line on the ODD-Q offset pixel grid is NOT r=0 constant — axialToPixel shows odd columns are shifted down by half a row, so {q:6,r:0} is a zig-zag path, not a straight line; hexLine confirms {q:6,r:3} is the true straight-line endpoint)', () => {
    const from = { q: 0, r: 0 };
    const result = computeLooseBall(from, 1, 6);
    expect(result).toEqual({ q: 6, r: 3 });
    expect(hexDistance(from, result)).toBe(6);
  });

  it('direction 2 (NE) at distance 3 from non-origin {q:5,r:-3} returns the geometrically correct hex (true hexDistance 3, not the previous buggy {q:8,r:-6} which had true hexDistance 5)', () => {
    const from = { q: 5, r: -3 };
    const result = computeLooseBall(from, 2, 3);
    // Geometrically correct landing hex for a true single-direction NE walk of 3 hexes.
    expect(result).toEqual({ q: 8, r: -4 });
    expect(hexDistance(from, result)).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Regression: computeLooseBall must always produce a TRUE single-direction,
  // single-distance straight line on the real ODD-Q offset pitch grid, for all
  // 6 directions, both column parities, and all 6 distance values.
  // See .planning/debug/loose-ball-scatter-rolls.md for the root cause this
  // guards against (fixed axial-style deltas applied to ODD-Q offset coords,
  // which overshoot true hex distance for NE/SW on every multi-step scatter).
  // -------------------------------------------------------------------------
  describe('computeLooseBall — parity/direction/distance regression (72 cases)', () => {
    const directions: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6];
    const distances: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6];
    // Even-q and odd-q starting hexes, away from any board edge.
    const startingHexes: HexCoord[] = [
      { q: 20, r: 10 }, // even q
      { q: 21, r: 10 }, // odd q
    ];

    for (const from of startingHexes) {
      for (const direction of directions) {
        for (const distance of distances) {
          it(`direction=${direction}, distance=${distance}, from q=${from.q} (${from.q % 2 === 0 ? 'even' : 'odd'}-q) lands exactly ${distance} true hexes away`, () => {
            const result = computeLooseBall(from, direction, distance);
            expect(hexDistance(from, result)).toBe(distance);
          });
        }
      }
    }
  });
});
