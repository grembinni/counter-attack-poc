import { describe, it, expect } from 'vitest';
import {
  classifyExit,
  classifyOutOfBounds,
  bylineOwner,
  resolveThrowInHex,
} from './outOfBounds.js';
import type { HexCoord } from './types.js';

describe('classifyExit', () => {
  it('returns BYLINE for a negative-q hex (left of home byline)', () => {
    expect(classifyExit({ q: -1, r: 5 })).toBe('BYLINE');
  });

  it('returns BYLINE for a q > 36 hex (right of away byline)', () => {
    expect(classifyExit({ q: 37, r: 5 })).toBe('BYLINE');
  });

  it('returns SIDELINE for a negative-r hex (above top sideline)', () => {
    expect(classifyExit({ q: 5, r: -1 })).toBe('SIDELINE');
  });

  it('returns SIDELINE for an r > 25 hex (below bottom sideline)', () => {
    expect(classifyExit({ q: 5, r: 26 })).toBe('SIDELINE');
  });

  it('returns BYLINE for an ambiguous double-boundary corner exit (D-05: q checked first)', () => {
    expect(classifyExit({ q: -1, r: -2 })).toBe('BYLINE');
  });

  it('returns null for a hex still on the pitch (defensive branch)', () => {
    expect(classifyExit({ q: 18, r: 13 })).toBeNull();
  });
});

describe('bylineOwner', () => {
  it("returns 'home' for a negative-q hex (home's own goal line)", () => {
    expect(bylineOwner({ q: -1, r: 5 })).toBe('home');
  });

  it("returns 'away' for a q > 36 hex (away's own goal line)", () => {
    expect(bylineOwner({ q: 37, r: 5 })).toBe('away');
  });

  it('returns null for a sideline (non-byline) exit', () => {
    expect(bylineOwner({ q: 5, r: -1 })).toBeNull();
  });
});

describe('classifyOutOfBounds', () => {
  it("returns 'THROW_IN' for a SIDELINE exit regardless of last toucher (caller inverts to award the other team)", () => {
    expect(classifyOutOfBounds('SIDELINE', 'home', null)).toBe('THROW_IN');
  });

  it("returns 'CORNER_KICK' for a BYLINE exit when the last toucher defends that byline", () => {
    expect(classifyOutOfBounds('BYLINE', 'home', 'home')).toBe('CORNER_KICK');
  });

  it("returns 'GOAL_KICK' for a BYLINE exit when the attacker touched last", () => {
    expect(classifyOutOfBounds('BYLINE', 'away', 'home')).toBe('GOAL_KICK');
  });

  it("returns 'GOAL_KICK' for a BYLINE exit when the ball was never touched (OOB-04)", () => {
    expect(classifyOutOfBounds('BYLINE', null, 'home')).toBe('GOAL_KICK');
  });
});

describe('resolveThrowInHex', () => {
  it('returns the preferred hex unchanged when unoccupied', () => {
    expect(resolveThrowInHex({ q: 0, r: 0 }, [])).toEqual({ q: 0, r: 0 });
  });

  it('returns an on-pitch, unoccupied hex near the preferred hex when it is occupied', () => {
    const preferred: HexCoord = { q: 18, r: 13 };
    const pieces = [{ position: preferred }];
    const result = resolveThrowInHex(preferred, pieces);

    expect(result).not.toEqual(preferred);
    // Must not coincide with the occupied hex.
    expect(pieces.some((p) => p.position.q === result.q && p.position.r === result.r)).toBe(false);
    // Must be on the pitch.
    expect(result.q).toBeGreaterThanOrEqual(0);
    expect(result.q).toBeLessThanOrEqual(36);
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.r).toBeLessThanOrEqual(25);
  });

  it('is deterministic: two consecutive calls with identical inputs return the identical coordinate', () => {
    const preferred: HexCoord = { q: 18, r: 13 };
    const pieces = [{ position: preferred }];
    const first = resolveThrowInHex(preferred, pieces);
    const second = resolveThrowInHex(preferred, pieces);
    expect(first).toEqual(second);
  });
});
