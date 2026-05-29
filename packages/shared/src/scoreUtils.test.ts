import { describe, it, expect } from 'vitest';
import { computeCombinedScore, computeLooseBall } from './scoreUtils.js';

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

  it('direction 5 (SW) at distance 1 from origin returns {q:-1,r:1}', () => {
    expect(computeLooseBall({ q: 0, r: 0 }, 5, 1)).toEqual({ q: -1, r: 1 });
  });

  it('direction 6 (SE) at distance 1 from origin returns {q:0,r:1}', () => {
    expect(computeLooseBall({ q: 0, r: 0 }, 6, 1)).toEqual({ q: 0, r: 1 });
  });

  it('direction 1 (E) at distance 6 scales linearly to {q:6,r:0}', () => {
    expect(computeLooseBall({ q: 0, r: 0 }, 1, 6)).toEqual({ q: 6, r: 0 });
  });

  it('direction 2 (NE) at distance 3 from non-origin {q:5,r:-3} returns {q:8,r:-6}', () => {
    expect(computeLooseBall({ q: 5, r: -3 }, 2, 3)).toEqual({ q: 8, r: -6 });
  });
});
