import { describe, it, expect } from 'vitest';
import {
  PITCH_HEXES,
  PITCH_REGIONS,
  DIFFICULT_ANGLE_HEXES,
  isInRegion,
  isDifficultAngle,
  isPitchHex,
  computeBallZone,
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
  it('DIFFICULT_ANGLE_HEXES contains exactly 64 hexes (16 per corner × 4)', () => {
    expect(DIFFICULT_ANGLE_HEXES.size).toBe(64);
  });

  it('isDifficultAngle returns false for the kick-off hex', () => {
    expect(isDifficultAngle({ q: 18, r: 13 })).toBe(false);
  });

  it('isDifficultAngle returns false for r=0 sideline row (not in zone)', () => {
    expect(isDifficultAngle({ q: 0, r: 0 })).toBe(false);
    expect(isDifficultAngle({ q: 36, r: 0 })).toBe(false);
  });

  it('isDifficultAngle returns true for top-left corner zone hexes', () => {
    expect(isDifficultAngle({ q: 0, r: 1 })).toBe(true); // top of sideline row
    expect(isDifficultAngle({ q: 4, r: 1 })).toBe(true); // far end of r=1 row
    expect(isDifficultAngle({ q: 0, r: 7 })).toBe(true); // bottom of goal-line strip
    expect(isDifficultAngle({ q: 2, r: 3 })).toBe(true); // outermost remaining r=3 hex
  });

  it('isDifficultAngle returns true for bottom-left corner zone hexes', () => {
    expect(isDifficultAngle({ q: 0, r: 25 })).toBe(true);
    expect(isDifficultAngle({ q: 4, r: 25 })).toBe(true);
    expect(isDifficultAngle({ q: 0, r: 19 })).toBe(true);
    expect(isDifficultAngle({ q: 2, r: 23 })).toBe(true);
  });

  it('isDifficultAngle returns true for top-right corner zone hexes', () => {
    expect(isDifficultAngle({ q: 36, r: 1 })).toBe(true);
    expect(isDifficultAngle({ q: 32, r: 1 })).toBe(true);
    expect(isDifficultAngle({ q: 36, r: 7 })).toBe(true);
    expect(isDifficultAngle({ q: 34, r: 3 })).toBe(true); // outermost remaining r=3 hex
  });

  it('isDifficultAngle returns true for bottom-right corner zone hexes', () => {
    expect(isDifficultAngle({ q: 36, r: 25 })).toBe(true);
    expect(isDifficultAngle({ q: 32, r: 25 })).toBe(true);
    expect(isDifficultAngle({ q: 36, r: 19 })).toBe(true);
    expect(isDifficultAngle({ q: 34, r: 23 })).toBe(true);
  });

  it('isDifficultAngle returns false for midfield and non-corner boundary hexes', () => {
    expect(isDifficultAngle({ q: 3, r: 7 })).toBe(false); // old penalty-corner hex
    expect(isDifficultAngle({ q: 5, r: 1 })).toBe(false); // just outside top-left r=1 range
    expect(isDifficultAngle({ q: 0, r: 8 })).toBe(false); // just below goal-line strip
    expect(isDifficultAngle({ q: 3, r: 3 })).toBe(false); // removed outermost r=3 hex
    expect(isDifficultAngle({ q: 0, r: 18 })).toBe(false); // bottom-left shifted away from r=18
  });
});

describe('computeBallZone (Phase 17 MOVE-06, corrected design D-33)', () => {
  it('returns "home" for q<=10 (homeThird boundary)', () => {
    expect(computeBallZone({ q: 0, r: 0 })).toBe('home');
    expect(computeBallZone({ q: 10, r: 12 })).toBe('home');
  });

  it('returns "middle" for q in [11,25] (middleThird boundary)', () => {
    expect(computeBallZone({ q: 11, r: 12 })).toBe('middle');
    expect(computeBallZone({ q: 18, r: 13 })).toBe('middle'); // kick-off hex
    expect(computeBallZone({ q: 25, r: 12 })).toBe('middle');
  });

  it('returns "away" for q>=26 (awayThird boundary)', () => {
    expect(computeBallZone({ q: 26, r: 12 })).toBe('away');
    expect(computeBallZone({ q: 36, r: 0 })).toBe('away');
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
