import { describe, it, expect } from 'vitest';
import {
  classifyExit,
  classifyOutOfBounds,
  bylineOwner,
  resolveThrowInHex,
  GOAL_KICK_RESTART_HEX,
} from './outOfBounds.js';
import { isPitchHex, GOAL_R_VALUES } from './pitch.js';
import { FORMATIONS } from './formations.js';
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

  describe('37-14 gap-closure: even-q r=0 exclusion is parity-aware', () => {
    it("returns 'SIDELINE' for an even-q r=0 hex (excluded from PITCH_HEXES — 0% visibility under the current client clip)", () => {
      expect(classifyExit({ q: 20, r: 0 })).toBe('SIDELINE');
    });

    it('returns null for an odd-q r=0 hex (kept on-pitch, unchanged)', () => {
      expect(classifyExit({ q: 21, r: 0 })).toBeNull();
    });

    it('returns null for an even-q r=25 hex (kept on-pitch — no r=25 exclusion under the redefined scope)', () => {
      expect(classifyExit({ q: 20, r: 25 })).toBeNull();
    });

    it('returns null for an odd-q r=25 hex (kept on-pitch, unchanged)', () => {
      expect(classifyExit({ q: 21, r: 25 })).toBeNull();
    });
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

describe('GOAL_KICK_RESTART_HEX', () => {
  it('home equals { q: 2, r: 13 } and away equals { q: 34, r: 13 }', () => {
    expect(GOAL_KICK_RESTART_HEX.home).toEqual({ q: 2, r: 13 });
    expect(GOAL_KICK_RESTART_HEX.away).toEqual({ q: 34, r: 13 });
  });

  it('is mirror-symmetric: home.q + away.q === 36 and home.r === away.r', () => {
    expect(GOAL_KICK_RESTART_HEX.home.q + GOAL_KICK_RESTART_HEX.away.q).toBe(36);
    expect(GOAL_KICK_RESTART_HEX.home.r).toBe(GOAL_KICK_RESTART_HEX.away.r);
  });

  it('both entries satisfy isPitchHex', () => {
    expect(isPitchHex(GOAL_KICK_RESTART_HEX.home)).toBe(true);
    expect(isPitchHex(GOAL_KICK_RESTART_HEX.away)).toBe(true);
  });

  it("home matches every formation's GK slot-0 position, and away matches its 36-q mirror (derived from FORMATIONS, not a restated literal)", () => {
    for (const formationId of Object.keys(FORMATIONS) as (keyof typeof FORMATIONS)[]) {
      const gkSlot = FORMATIONS[formationId].slots[0];
      expect(gkSlot.slotRole).toBe('GK');
      expect(gkSlot.position).toEqual(GOAL_KICK_RESTART_HEX.home);
      expect({ q: 36 - gkSlot.position.q, r: gkSlot.position.r }).toEqual(
        GOAL_KICK_RESTART_HEX.away,
      );
    }
  });

  it('both entries sit on the byline-centre row: r equals the midpoint of GOAL_R_VALUES', () => {
    const midpoint = GOAL_R_VALUES[Math.floor(GOAL_R_VALUES.length / 2)];
    expect(GOAL_KICK_RESTART_HEX.home.r).toBe(midpoint);
    expect(GOAL_KICK_RESTART_HEX.away.r).toBe(midpoint);
  });

  it('resolveThrowInHex(GOAL_KICK_RESTART_HEX.home, []) returns the restart hex unchanged', () => {
    expect(resolveThrowInHex(GOAL_KICK_RESTART_HEX.home, [])).toEqual(GOAL_KICK_RESTART_HEX.home);
  });

  it('resolveThrowInHex returns a different, on-pitch, unoccupied hex when the restart hex is occupied', () => {
    const pieces = [{ position: GOAL_KICK_RESTART_HEX.home }];
    const result = resolveThrowInHex(GOAL_KICK_RESTART_HEX.home, pieces);
    expect(result).not.toEqual(GOAL_KICK_RESTART_HEX.home);
    expect(isPitchHex(result)).toBe(true);
    expect(pieces.some((p) => p.position.q === result.q && p.position.r === result.r)).toBe(false);
  });
});
