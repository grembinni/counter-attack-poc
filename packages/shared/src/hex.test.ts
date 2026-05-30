import { describe, it, expect } from 'vitest';
import {
  hexDistance,
  hexNeighbors,
  hexesInRange,
  isUnderZoI,
  hexLine,
  getZoIDefenders,
} from './hex.js';
import type { HexCoord, PlayerPiece } from './types.js';

describe('hexDistance', () => {
  it('returns 0 for the same hex', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
  });

  it('returns 3 for {q:0,r:0} to {q:3,r:0}', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
  });

  it('returns 2 for {q:0,r:0} to {q:2,r:-2} (diagonal axis)', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -2 })).toBe(2);
  });

  it('returns 6 for {q:1,r:2} to {q:-2,r:-1} (non-origin pair)', () => {
    // Cube coordinates: a=(1,2,-3), b=(-2,-1,3); max(|dq|,|dr|,|ds|) = max(3,3,6) = 6
    expect(hexDistance({ q: 1, r: 2 }, { q: -2, r: -1 })).toBe(6);
  });
});

describe('hexNeighbors', () => {
  it('returns exactly 6 neighbors for {q:0,r:0}', () => {
    expect(hexNeighbors({ q: 0, r: 0 })).toHaveLength(6);
  });

  it('contains {q:1,r:0} (E direction) among neighbors of {q:0,r:0}', () => {
    const neighbors = hexNeighbors({ q: 0, r: 0 });
    expect(neighbors).toContainEqual({ q: 1, r: 0 });
  });

  it('contains {q:0,r:-1} (NW direction) among neighbors of {q:0,r:0}', () => {
    const neighbors = hexNeighbors({ q: 0, r: 0 });
    expect(neighbors).toContainEqual({ q: 0, r: -1 });
  });

  it('every neighbor of {q:0,r:0} has hexDistance === 1', () => {
    const center: HexCoord = { q: 0, r: 0 };
    const neighbors = hexNeighbors(center);
    for (const neighbor of neighbors) {
      expect(hexDistance(center, neighbor)).toBe(1);
    }
  });
});

describe('hexesInRange', () => {
  it('returns 1 hex for range 0 (center only)', () => {
    const result = hexesInRange({ q: 0, r: 0 }, 0);
    expect(result).toHaveLength(1);
    expect(result).toContainEqual({ q: 0, r: 0 });
  });

  it('returns 7 hexes for range 1 (center + 6 neighbors)', () => {
    expect(hexesInRange({ q: 0, r: 0 }, 1)).toHaveLength(7);
  });

  it('returns 19 hexes for range 2 (canonical hex ring count: 1+6+12)', () => {
    expect(hexesInRange({ q: 0, r: 0 }, 2)).toHaveLength(19);
  });
});

describe('isUnderZoI', () => {
  it('returns true when an opponent is adjacent (distance 1)', () => {
    expect(isUnderZoI({ q: 0, r: 0 }, [{ q: 1, r: 0 }])).toBe(true);
  });

  it('returns false when opponent is distant (distance 3)', () => {
    expect(isUnderZoI({ q: 0, r: 0 }, [{ q: 3, r: 0 }])).toBe(false);
  });

  it('returns false when opponent list is empty', () => {
    expect(isUnderZoI({ q: 0, r: 0 }, [])).toBe(false);
  });
});

describe('hexLine', () => {
  it('returns [from] when from === to (zero distance)', () => {
    const result = hexLine({ q: 0, r: 0 }, { q: 0, r: 0 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ q: 0, r: 0 });
  });

  it('returns 4 hexes for distance-3 line with correct endpoints', () => {
    const result = hexLine({ q: 0, r: 0 }, { q: 3, r: 0 });
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ q: 0, r: 0 });
    expect(result[3]).toEqual({ q: 3, r: 0 });
  });

  it('every consecutive pair in the line has hexDistance === 1', () => {
    const result = hexLine({ q: 0, r: 0 }, { q: 3, r: 0 });
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i];
      const b = result[i + 1];
      expect(hexDistance(a, b)).toBe(1);
    }
  });

  it('returns a correct 3-hex path on the diagonal axis ({q:0,r:0} → {q:2,r:-2})', () => {
    const result = hexLine({ q: 0, r: 0 }, { q: 2, r: -2 });
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ q: 0, r: 0 });
    expect(result[2]).toEqual({ q: 2, r: -2 });
    // middle hex must be adjacent to both endpoints
    const mid = result[1];
    expect(hexDistance({ q: 0, r: 0 }, mid)).toBe(1);
    expect(hexDistance({ q: 2, r: -2 }, mid)).toBe(1);
  });

  it('length equals hexDistance(from, to) + 1 for a non-trivial path', () => {
    const from: HexCoord = { q: 1, r: 2 };
    const to: HexCoord = { q: 4, r: -1 };
    const result = hexLine(from, to);
    expect(result).toHaveLength(hexDistance(from, to) + 1);
  });
});

describe('getZoIDefenders', () => {
  /** Helper to build a minimal PlayerPiece fixture */
  function makePiece(
    id: string,
    q: number,
    r: number,
    teamId: 'home' | 'away' = 'away',
  ): PlayerPiece {
    return {
      id,
      teamId,
      position: { q, r },
      pace: 5,
      shooting: 5,
      tackling: 5,
      dribbling: 5,
      heading: 5,
      saving: 1,
      handling: 1,
      resilience: 5,
      aerialAbility: 5,
      name: 'Test',
      role: 'MID',
    };
  }

  it('returns the adjacent opponent when one is at distance 1', () => {
    const defenders = [makePiece('d1', 1, 0)];
    const result = getZoIDefenders({ q: 0, r: 0 }, defenders);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(defenders[0]);
  });

  it('excludes opponent at distance 2 (not adjacent)', () => {
    const defenders = [makePiece('d1', 2, 0)];
    const result = getZoIDefenders({ q: 0, r: 0 }, defenders);
    expect(result).toHaveLength(0);
  });

  it('returns [] when no opponents are adjacent', () => {
    const result = getZoIDefenders({ q: 0, r: 0 }, []);
    expect(result).toHaveLength(0);
  });

  it('returns only adjacent opponents from a mixed-distance list', () => {
    const adjacent = makePiece('d1', 1, 0);
    const distant = makePiece('d2', 3, 0);
    const sameHex = makePiece('d3', 0, 0);
    const result = getZoIDefenders({ q: 0, r: 0 }, [adjacent, distant, sameHex]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(adjacent);
  });
});
