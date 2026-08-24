// Phase 44 — REFEREE-01/02/03/04 engine-level Leniency override tests.

import { describe, it, expect } from 'vitest';
import { buildInitialGameState } from '../gameEngine.js';
import type { UniformStyleId } from '@counter-attack/shared';

const DEFAULT_TEAMS = { home: 'city', away: 'crew' } as const;
const DEFAULT_STYLES: { home: UniformStyleId; away: UniformStyleId } = {
  home: 'pinstripes-vertical',
  away: 'bar-diagonal',
};

/**
 * Single call-through helper for `buildInitialGameState` — every test in this file routes
 * through this one function so the positional argument list (14 params deep, override params
 * are 13th/14th) appears exactly once and a future param append breaks in one place, not
 * fifteen. All preceding positional args use the library's own defaults (formation/jersey/
 * orders/toggles/benches) matching gameEngine.test.ts's minimal-fixture convention.
 */
function buildWithOverride(roomCode: string, enabled: boolean, value?: number) {
  return buildInitialGameState(
    roomCode,
    DEFAULT_TEAMS,
    'standard',
    DEFAULT_STYLES,
    undefined, // selectedFormation (default)
    undefined, // selectedJerseyTypes (default)
    undefined, // confirmedHomeOrder (default)
    undefined, // confirmedAwayOrder (default)
    undefined, // outOfBoundsEnabled (default)
    undefined, // foulsEnabled (default)
    undefined, // bookingEnabled (default)
    undefined, // injuryEnabled (default)
    undefined, // tackleStealDeclineEnabled (default)
    undefined, // homeBench (default)
    undefined, // awayBench (default)
    enabled,
    value,
  );
}

describe('buildInitialGameState — Referee Leniency override (REFEREE-01/02/03/04)', () => {
  it.each([2, 3, 4, 5])(
    'override ON with value %d yields refereeCard.leniency === %d exactly, across repeated builds',
    (value) => {
      for (let i = 0; i < 5; i++) {
        const state = buildWithOverride(`OVR-${value}-${i}`, true, value);
        expect(state.refereeCard.leniency).toBe(value);
      }
    },
  );

  it('override OFF (the default path every legacy caller takes): leniency is an integer in 2..5 across 50 builds (REFEREE-03 regression pin)', () => {
    // enabled=false with no value is functionally identical to the trailing params being
    // omitted entirely (both default to false/undefined) — the legacy no-override call shape.
    for (let i = 0; i < 50; i++) {
      const state = buildWithOverride(`OFF-${i}`, false);
      const { leniency } = state.refereeCard;
      expect(Number.isInteger(leniency)).toBe(true);
      expect(leniency).toBeGreaterThanOrEqual(2);
      expect(leniency).toBeLessThanOrEqual(5);
    }
  });

  it('override OFF: at least 2 distinct Leniency values across 20 builds (random branch still live, not frozen)', () => {
    const values = new Set<number>();
    for (let i = 0; i < 20; i++) {
      values.add(buildWithOverride(`OFF-RAND-${i}`, false).refereeCard.leniency);
    }
    expect(values.size).toBeGreaterThanOrEqual(2);
  });

  it('override flag true but value undefined: falls back to the random 2..5 roll rather than undefined/NaN', () => {
    for (let i = 0; i < 20; i++) {
      const state = buildWithOverride(`FLAG-NO-VALUE-${i}`, true, undefined);
      const { leniency } = state.refereeCard;
      expect(Number.isInteger(leniency)).toBe(true);
      expect(leniency).toBeGreaterThanOrEqual(2);
      expect(leniency).toBeLessThanOrEqual(5);
    }
  });

  it('override flag false with a value supplied: the supplied value is ignored and the roll is used (flag gates, not value presence)', () => {
    // A value far outside the 2..5 range makes any accidental use of it trivially detectable.
    for (let i = 0; i < 20; i++) {
      const state = buildWithOverride(`FLAG-FALSE-WITH-VALUE-${i}`, false, 99);
      const { leniency } = state.refereeCard;
      expect(leniency).not.toBe(99);
      expect(leniency).toBeGreaterThanOrEqual(2);
      expect(leniency).toBeLessThanOrEqual(5);
    }
  });

  it('REFEREE-04 coupling: refereeCard.leniency is the single field both booking and added-time read — GameState exposes no sibling override field', () => {
    // With the override pinned to a known value, booking (gameEngine.ts ~978/~986) and
    // added time (gameEngine.ts ~3065) both read state.refereeCard.leniency directly — see
    // substitution.integration.test.ts line ~710 for the existing end-to-end proof that added
    // time reads this same field. Structural assertion: no second Leniency field exists to
    // diverge from it.
    const state = buildWithOverride('COUPLING', true, 3);
    expect(state.refereeCard.leniency).toBe(3);
    expect('refereeLeniencyValue' in state).toBe(false);
    expect('refereeLeniencyOverrideEnabled' in state).toBe(false);
  });
});
