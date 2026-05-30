import { describe, it, expect } from 'vitest';
import { rollDice } from '../diceUtils.js';

describe('rollDice', () => {
  it('returns an integer between 1 and 6 inclusive', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDice();
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it('produces at least 3 distinct values across 20 rolls (statistical non-flaky)', () => {
    const values = new Set<number>();
    for (let i = 0; i < 20; i++) values.add(rollDice());
    expect(values.size).toBeGreaterThanOrEqual(3);
  });
});
