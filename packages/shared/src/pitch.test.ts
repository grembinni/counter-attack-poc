import { describe, it, expect } from 'vitest';
import {
  PITCH_HEXES,
  PITCH_REGIONS,
  DIFFICULT_ANGLE_HEXES,
  isInRegion,
  isDifficultAngle,
  isPitchHex,
} from './pitch.js';

describe('PITCH_HEXES', () => {
  it('contains exactly 962 hexes (37×26 grid, PITCH-01 / D-04)', () => {
    expect(PITCH_HEXES).toHaveLength(962);
  });
});

describe('PITCH_REGIONS', () => {
  it('kickOffHex is { q: 18, r: 13 } (D-05)', () => {
    expect(PITCH_REGIONS.kickOffHex).toEqual({ q: 18, r: 13 });
  });

  describe('isInRegion (PITCH-02)', () => {
    it('returns true for a hex in the homeThird (q <= 10)', () => {
      expect(isInRegion({ q: 5, r: 12 }, 'homeThird')).toBe(true);
      expect(isInRegion({ q: 0, r: 0 }, 'homeThird')).toBe(true);
      expect(isInRegion({ q: 10, r: 12 }, 'homeThird')).toBe(true);
    });

    it('returns false for q=11 in homeThird (boundary — middleThird starts at q=11)', () => {
      expect(isInRegion({ q: 11, r: 12 }, 'homeThird')).toBe(false);
      expect(isInRegion({ q: 18, r: 13 }, 'homeThird')).toBe(false);
    });

    it('returns true for a hex in the awayThird (q >= 26)', () => {
      expect(isInRegion({ q: 30, r: 12 }, 'awayThird')).toBe(true);
      expect(isInRegion({ q: 36, r: 0 }, 'awayThird')).toBe(true);
    });

    it('returns false for q=25 in awayThird (boundary — middleThird ends at q=25)', () => {
      expect(isInRegion({ q: 25, r: 12 }, 'awayThird')).toBe(false);
      expect(isInRegion({ q: 18, r: 13 }, 'awayThird')).toBe(false);
    });

    it('returns true for a hex inside the homePenaltyArea (q∈[0,5] r∈[5,19])', () => {
      expect(isInRegion({ q: 3, r: 10 }, 'homePenaltyArea')).toBe(true);
      expect(isInRegion({ q: 0, r: 5 }, 'homePenaltyArea')).toBe(true);
      expect(isInRegion({ q: 5, r: 19 }, 'homePenaltyArea')).toBe(true);
    });

    it('returns false for a midfield hex in homePenaltyArea', () => {
      expect(isInRegion({ q: 18, r: 13 }, 'homePenaltyArea')).toBe(false);
    });

    it('returns true for a hex inside the awayPenaltyArea (q∈[31,36] r∈[5,19])', () => {
      expect(isInRegion({ q: 33, r: 10 }, 'awayPenaltyArea')).toBe(true);
      expect(isInRegion({ q: 36, r: 5 }, 'awayPenaltyArea')).toBe(true);
    });

    it('centreCircle contains the kick-off hex', () => {
      expect(isInRegion({ q: 18, r: 13 }, 'centreCircle')).toBe(true);
    });

    it('homeGoal contains q=0 r=13 (q=0 r∈[10,16])', () => {
      expect(isInRegion({ q: 0, r: 13 }, 'homeGoal')).toBe(true);
      expect(isInRegion({ q: 0, r: 10 }, 'homeGoal')).toBe(true);
      expect(isInRegion({ q: 0, r: 16 }, 'homeGoal')).toBe(true);
    });

    it('homeGoal does not contain q=1 r=12 (must be q=0)', () => {
      expect(isInRegion({ q: 1, r: 12 }, 'homeGoal')).toBe(false);
    });

    it('awayGoal contains q=36 r=13 (q=36 r∈[10,16])', () => {
      expect(isInRegion({ q: 36, r: 13 }, 'awayGoal')).toBe(true);
      expect(isInRegion({ q: 36, r: 10 }, 'awayGoal')).toBe(true);
      expect(isInRegion({ q: 36, r: 16 }, 'awayGoal')).toBe(true);
    });

    it('awayGoal does not contain q=35 r=12 (must be q=36)', () => {
      expect(isInRegion({ q: 35, r: 12 }, 'awayGoal')).toBe(false);
    });
  });
});

describe('DIFFICULT_ANGLE_HEXES', () => {
  it('isDifficultAngle returns true for a known difficult-angle hex near home end (PITCH-03)', () => {
    expect(isDifficultAngle({ q: 3, r: 7 })).toBe(true);
  });

  it('isDifficultAngle returns false for the kick-off hex (PITCH-03)', () => {
    expect(isDifficultAngle({ q: 18, r: 13 })).toBe(false);
  });

  it('DIFFICULT_ANGLE_HEXES contains exactly 16 encoded hexes', () => {
    expect(DIFFICULT_ANGLE_HEXES.size).toBe(16);
  });
});

describe('isPitchHex', () => {
  it('returns true for valid in-grid hexes on the 37×26 grid', () => {
    expect(isPitchHex({ q: 0, r: 0 })).toBe(true);
    expect(isPitchHex({ q: 18, r: 13 })).toBe(true);
    expect(isPitchHex({ q: 36, r: 25 })).toBe(true);
  });

  it('returns false for out-of-grid hexes (37×26 boundaries)', () => {
    expect(isPitchHex({ q: 37, r: 0 })).toBe(false);
    expect(isPitchHex({ q: 0, r: 26 })).toBe(false);
    expect(isPitchHex({ q: 99, r: 99 })).toBe(false);
  });
});
