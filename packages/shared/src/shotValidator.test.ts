import { describe, it, expect } from 'vitest';
import { validateShotDuel, validateGKDive, validateHandlingCheck } from './shotValidator.js';
import type { PlayerPiece } from './types.js';

const shooter: PlayerPiece = {
  id: 'p1',
  teamId: 'home',
  position: { q: 5, r: 5 },
  pace: 4,
  shooting: 7,
  tackling: 5,
  dribbling: 5,
  heading: 5,
  saving: 1,
  handling: 0, // D-06: outfielders handling=0
  resilience: 5,
  aerialAbility: 0, // D-05: outfielders aerialAbility=0
  highPass: 5, // D-04: FWD range 4–6
  name: 'Test Shooter',
  role: 'FWD',
};

const goalkeeper: PlayerPiece = {
  id: 'gk1',
  teamId: 'away',
  position: { q: 8, r: 5 },
  pace: 3,
  shooting: 1,
  tackling: 5,
  dribbling: 3,
  heading: 5,
  saving: 7,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
  highPass: 0, // D-04: GKs highPass=0
  name: 'Test GK',
  role: 'GK',
};

describe('validateShotDuel', () => {
  it('die=1 participates in the normal duel — no auto-miss rule', () => {
    // shooter: 7+1=8 vs low-saving GK: 1+1=2 → shooter wins despite rolling 1
    const weakGK: PlayerPiece = { ...goalkeeper, saving: 1 };
    const result = validateShotDuel(shooter, weakGK, 1, 1, [], []);
    expect(result.outcome).toBe('GOAL');
  });

  it('returns GOAL when shooterScore > gkScore', () => {
    // shooter: 7+6=13 vs gk: 7+1=8 → GOAL
    const result = validateShotDuel(shooter, goalkeeper, 6, 1, [], []);
    expect(result.outcome).toBe('GOAL');
  });

  it('returns SAVE with needsHandlingCheck when gkScore strictly exceeds shooterScore', () => {
    // shooter: 7+2=9 vs gk: 7+3=10 → gk strictly greater → SAVE
    const result = validateShotDuel(shooter, goalkeeper, 2, 3, [], []);
    expect(result.outcome).toBe('SAVE');
    if (result.outcome === 'SAVE') expect(result.needsHandlingCheck).toBe(true);
  });

  it('equal scores produce LOOSE_BALL (D-13) — tie no longer goes to GK', () => {
    // shooter: 7+3=10 vs gk: 7+3=10 → tie → LOOSE_BALL per D-13
    const result = validateShotDuel(shooter, goalkeeper, 3, 3, [], []);
    expect(result.outcome).toBe('LOOSE_BALL');
  });

  it('applies DICE-04 -2 cap to shooter penalties', () => {
    // shooter: 7+6+clamp(-3,-2)=11 vs gk: 7+6=13 → SAVE still
    const result = validateShotDuel(shooter, goalkeeper, 6, 6, [-1, -1, -1], []);
    // 7+6-2=11 vs 7+6=13 → SAVE
    expect(result.outcome).toBe('SAVE');
  });
});

describe('validateGKDive', () => {
  it('returns saveable:false with OUT_OF_RANGE at distance 4 (SHOT-04)', () => {
    const result = validateGKDive(goalkeeper, 4);
    expect(result.saveable).toBe(false);
    if (!result.saveable) expect(result.reason).toBe('OUT_OF_RANGE');
  });

  it('returns savingPenalty -1 at distance 3 (SHOT-04 3rd-hex penalty)', () => {
    const result = validateGKDive(goalkeeper, 3);
    expect(result.saveable).toBe(true);
    if (result.saveable) expect(result.savingPenalty).toBe(-1);
  });

  it('returns savingPenalty 0 at distance 1', () => {
    const result = validateGKDive(goalkeeper, 1);
    expect(result.saveable).toBe(true);
    if (result.saveable) expect(result.savingPenalty).toBe(0);
  });

  it('returns savingPenalty 0 at distance 2', () => {
    const result = validateGKDive(goalkeeper, 2);
    expect(result.saveable).toBe(true);
    if (result.saveable) expect(result.savingPenalty).toBe(0);
  });

  it('returns savingPenalty 0 at distance 0 (GK stays put)', () => {
    const result = validateGKDive(goalkeeper, 0);
    expect(result.saveable).toBe(true);
    if (result.saveable) expect(result.savingPenalty).toBe(0);
  });
});

describe('validateHandlingCheck', () => {
  it('returns caught:false triggerLooseBall when dice equals handling exactly (SHOT-06: >= triggers spill)', () => {
    const gk: PlayerPiece = { ...goalkeeper, handling: 4 };
    const result = validateHandlingCheck(gk, 4);
    expect(result.caught).toBe(false);
    if (!result.caught) expect(result.triggerLooseBall).toBe(true);
  });

  it('returns caught:false triggerLooseBall when dice > handling', () => {
    const gk: PlayerPiece = { ...goalkeeper, handling: 3 };
    const result = validateHandlingCheck(gk, 5);
    expect(result.caught).toBe(false);
    if (!result.caught) expect(result.triggerLooseBall).toBe(true);
  });

  it('returns caught:true when dice < handling', () => {
    const gk: PlayerPiece = { ...goalkeeper, handling: 5 };
    const result = validateHandlingCheck(gk, 3);
    expect(result.caught).toBe(true);
  });
});
