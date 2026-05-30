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
  it('contains exactly 400 hexes (PITCH-01)', () => {
    expect(PITCH_HEXES).toHaveLength(400);
  });
});

describe('PITCH_REGIONS', () => {
  it('kickOffHex is { q: 12, r: 7 }', () => {
    expect(PITCH_REGIONS.kickOffHex).toEqual({ q: 12, r: 7 });
  });

  describe('isInRegion (PITCH-02)', () => {
    it('returns true for a hex in the homeThird (q <= 7)', () => {
      expect(isInRegion({ q: 3, r: 7 }, 'homeThird')).toBe(true);
      expect(isInRegion({ q: 0, r: 0 }, 'homeThird')).toBe(true);
      expect(isInRegion({ q: 7, r: 7 }, 'homeThird')).toBe(true);
    });

    it('returns false for a midfield hex in homeThird (PITCH-02)', () => {
      expect(isInRegion({ q: 12, r: 7 }, 'homeThird')).toBe(false);
      expect(isInRegion({ q: 17, r: 7 }, 'homeThird')).toBe(false);
    });

    it('returns true for a hex in the awayThird (q >= 17)', () => {
      expect(isInRegion({ q: 17, r: 7 }, 'awayThird')).toBe(true);
      expect(isInRegion({ q: 24, r: 0 }, 'awayThird')).toBe(true);
    });

    it('returns false for a midfield hex in awayThird', () => {
      expect(isInRegion({ q: 12, r: 7 }, 'awayThird')).toBe(false);
      expect(isInRegion({ q: 7, r: 7 }, 'awayThird')).toBe(false);
    });

    it('returns true for a hex inside the homePenaltyArea (PITCH-02)', () => {
      expect(isInRegion({ q: 1, r: 7 }, 'homePenaltyArea')).toBe(true);
      expect(isInRegion({ q: 3, r: 6 }, 'homePenaltyArea')).toBe(true);
    });

    it('returns false for a midfield hex in homePenaltyArea', () => {
      expect(isInRegion({ q: 12, r: 7 }, 'homePenaltyArea')).toBe(false);
    });

    it('returns true for a hex inside the awayPenaltyArea', () => {
      expect(isInRegion({ q: 22, r: 7 }, 'awayPenaltyArea')).toBe(true);
    });

    it('centreCircle contains the kick-off hex', () => {
      expect(isInRegion({ q: 12, r: 7 }, 'centreCircle')).toBe(true);
    });
  });
});

describe('DIFFICULT_ANGLE_HEXES', () => {
  it('isDifficultAngle returns true for an encoded dot-marked hex (PITCH-03)', () => {
    expect(isDifficultAngle({ q: 2, r: 3 })).toBe(true);
    expect(isDifficultAngle({ q: 22, r: 11 })).toBe(true);
  });

  it('isDifficultAngle returns false for the kick-off hex (PITCH-03)', () => {
    expect(isDifficultAngle({ q: 12, r: 7 })).toBe(false);
  });

  it('DIFFICULT_ANGLE_HEXES contains exactly 16 encoded hexes', () => {
    expect(DIFFICULT_ANGLE_HEXES.size).toBe(16);
  });
});

describe('isPitchHex', () => {
  it('returns true for a valid in-grid hex', () => {
    expect(isPitchHex({ q: 0, r: 0 })).toBe(true);
    expect(isPitchHex({ q: 12, r: 7 })).toBe(true);
    expect(isPitchHex({ q: 24, r: 15 })).toBe(true);
  });

  it('returns false for an out-of-grid hex', () => {
    expect(isPitchHex({ q: 99, r: 99 })).toBe(false);
    expect(isPitchHex({ q: 25, r: 0 })).toBe(false);
    expect(isPitchHex({ q: 0, r: 16 })).toBe(false);
  });
});
