import { describe, it, expect } from 'vitest';
import {
  classifyExit,
  classifyOutOfBounds,
  bylineOwner,
  resolveThrowInHex,
  GOAL_KICK_RESTART_HEX,
  CORNER_KICK_HEX,
  CORNER_EXCLUSION_RADIUS,
  isWithinCornerExclusionZone,
  cornerClearOutGoalHex,
  cornerClearOutDestination,
  isSpillCornerDirection,
} from './outOfBounds.js';
import { isPitchHex, GOAL_R_VALUES } from './pitch.js';
import { FORMATIONS } from './formations.js';
import { hexesInRange, hexDistance, hexLine } from './hex.js';
import { looseBallDirectionQStep } from './scoreUtils.js';
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

describe('CORNER_KICK_HEX', () => {
  it('home.top equals { q: 0, r: 1 } and home.bottom equals { q: 0, r: 25 }', () => {
    expect(CORNER_KICK_HEX.home.top).toEqual({ q: 0, r: 1 });
    expect(CORNER_KICK_HEX.home.bottom).toEqual({ q: 0, r: 25 });
  });

  it('away.top equals { q: 36, r: 1 } and away.bottom equals { q: 36, r: 25 }', () => {
    expect(CORNER_KICK_HEX.away.top).toEqual({ q: 36, r: 1 });
    expect(CORNER_KICK_HEX.away.bottom).toEqual({ q: 36, r: 25 });
  });

  it('is mirror-symmetric for both top and bottom: home.q + away.q === 36 and home.r === away.r', () => {
    for (const row of ['top', 'bottom'] as const) {
      expect(CORNER_KICK_HEX.home[row].q + CORNER_KICK_HEX.away[row].q).toBe(36);
      expect(CORNER_KICK_HEX.home[row].r).toBe(CORNER_KICK_HEX.away[row].r);
    }
  });

  it('all four hexes satisfy isPitchHex', () => {
    for (const owner of ['home', 'away'] as const) {
      for (const row of ['top', 'bottom'] as const) {
        expect(isPitchHex(CORNER_KICK_HEX[owner][row])).toBe(true);
      }
    }
  });

  it('all four hexes are pairwise distinct', () => {
    const hexes: HexCoord[] = [
      CORNER_KICK_HEX.home.top,
      CORNER_KICK_HEX.home.bottom,
      CORNER_KICK_HEX.away.top,
      CORNER_KICK_HEX.away.bottom,
    ];
    const keys = hexes.map((h) => `${h.q},${h.r}`);
    expect(new Set(keys).size).toBe(hexes.length);
  });
});

describe('isWithinCornerExclusionZone (38-16, 38-15 defect 3)', () => {
  const cornerHexes: HexCoord[] = [
    CORNER_KICK_HEX.home.top,
    CORNER_KICK_HEX.home.bottom,
    CORNER_KICK_HEX.away.top,
    CORNER_KICK_HEX.away.bottom,
  ];

  for (const cornerHex of cornerHexes) {
    describe(`corner hex {q:${cornerHex.q},r:${cornerHex.r}}`, () => {
      it('returns true for every probe hex at distance 0..CORNER_EXCLUSION_RADIUS', () => {
        const withinRadius = hexesInRange(cornerHex, CORNER_EXCLUSION_RADIUS);
        for (const probe of withinRadius) {
          expect(isWithinCornerExclusionZone(probe, cornerHex)).toBe(true);
        }
      });

      it('returns false for every probe hex at distance CORNER_EXCLUSION_RADIUS + 1', () => {
        const wideRing = hexesInRange(cornerHex, CORNER_EXCLUSION_RADIUS + 1);
        const withinRadius = hexesInRange(cornerHex, CORNER_EXCLUSION_RADIUS);
        const withinRadiusKeys = new Set(withinRadius.map((h) => `${h.q},${h.r}`));
        const outerRing = wideRing.filter((h) => !withinRadiusKeys.has(`${h.q},${h.r}`));
        expect(outerRing.length).toBeGreaterThan(0);
        for (const probe of outerRing) {
          expect(hexDistance(probe, cornerHex)).toBe(CORNER_EXCLUSION_RADIUS + 1);
          expect(isWithinCornerExclusionZone(probe, cornerHex)).toBe(false);
        }
      });
    });
  }
});

describe('cornerClearOutGoalHex (38-16, 38-15 defect 3)', () => {
  it('is mirror-symmetric: home.q + away.q === 36 and home.r === away.r', () => {
    const home = cornerClearOutGoalHex('home');
    const away = cornerClearOutGoalHex('away');
    expect(home.q + away.q).toBe(36);
    expect(home.r).toBe(away.r);
  });

  it('r equals the middle element of GOAL_R_VALUES for both teams', () => {
    const midpoint = GOAL_R_VALUES[Math.floor(GOAL_R_VALUES.length / 2)];
    expect(cornerClearOutGoalHex('home').r).toBe(midpoint);
    expect(cornerClearOutGoalHex('away').r).toBe(midpoint);
  });

  it("home.q is 0 and away.q is 36 (this module's byline convention)", () => {
    expect(cornerClearOutGoalHex('home').q).toBe(0);
    expect(cornerClearOutGoalHex('away').q).toBe(36);
  });
});

describe('cornerClearOutDestination (gap-closure round 3, 38-25)', () => {
  const cornerHex = CORNER_KICK_HEX.home.top;
  const goalHex = cornerClearOutGoalHex('home');

  it('a piece already outside the exclusion zone returns its own hex unchanged', () => {
    const outside = hexesInRange(cornerHex, CORNER_EXCLUSION_RADIUS + 2).find(
      (h) => isPitchHex(h) && hexDistance(h, cornerHex) === CORNER_EXCLUSION_RADIUS + 2,
    );
    expect(outside).toBeDefined();
    expect(cornerClearOutDestination(outside, cornerHex, goalHex, [])).toEqual(outside);
  });

  it('a piece on a zone hex lands strictly outside the zone', () => {
    const result = cornerClearOutDestination(cornerHex, cornerHex, goalHex, []);
    expect(isWithinCornerExclusionZone(result, cornerHex)).toBe(false);
  });

  it('the landing hex is always on-pitch', () => {
    const result = cornerClearOutDestination(cornerHex, cornerHex, goalHex, []);
    expect(isPitchHex(result)).toBe(true);
  });

  it('an occupied first candidate is skipped and a later line hex is returned', () => {
    const line = hexLine(cornerHex, goalHex);
    const firstCandidate = line[1];
    const result = cornerClearOutDestination(cornerHex, cornerHex, goalHex, [firstCandidate]);
    expect(result).not.toEqual(firstCandidate);
    expect(isWithinCornerExclusionZone(result, cornerHex)).toBe(false);
    expect(isPitchHex(result)).toBe(true);
  });

  for (const owner of ['home', 'away'] as const) {
    for (const row of ['top', 'bottom'] as const) {
      const corner = CORNER_KICK_HEX[owner][row];
      const goal = cornerClearOutGoalHex(owner);

      it(`corner ${owner}/${row}: destination is never inside the exclusion zone for every zone hex`, () => {
        const zoneHexes = hexesInRange(corner, CORNER_EXCLUSION_RADIUS).filter((h) =>
          isPitchHex(h),
        );
        for (const from of zoneHexes) {
          const result = cornerClearOutDestination(from, corner, goal, []);
          expect(isWithinCornerExclusionZone(result, corner)).toBe(false);
        }
      });
    }
  }
});

describe('isSpillCornerDirection (D-GAP-02, 38-16)', () => {
  const directions: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6];

  for (const keeperTeamId of ['home', 'away'] as const) {
    describe(`keeperTeamId = ${keeperTeamId}`, () => {
      const ownBylineStep = keeperTeamId === 'home' ? -1 : 1;
      const oppositeBylineStep = keeperTeamId === 'home' ? 1 : -1;

      const cornerDirections = directions.filter((d) => isSpillCornerDirection(d, keeperTeamId));
      const noCornerDirections = directions.filter((d) => !isSpillCornerDirection(d, keeperTeamId));

      it('awards a corner for exactly 4 of the 6 directions', () => {
        expect(cornerDirections.length).toBe(4);
      });

      it('the 4 corner-awarding directions are exactly those with qStep 0 or the own-byline step', () => {
        for (const d of cornerDirections) {
          const qStep = looseBallDirectionQStep(d);
          expect(qStep === 0 || qStep === ownBylineStep).toBe(true);
        }
      });

      it('the 2 non-corner directions are exactly those pointing toward the opposite byline', () => {
        expect(noCornerDirections.length).toBe(2);
        for (const d of noCornerDirections) {
          expect(looseBallDirectionQStep(d)).toBe(oppositeBylineStep);
        }
      });
    });
  }
});
