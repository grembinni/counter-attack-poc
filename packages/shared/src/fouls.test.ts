import { describe, it, expect } from 'vitest';
import {
  FOUL_TRIGGER_DIE,
  isInjured,
  applyInjuryDegradation,
  rollsInjury,
  rollsBooking,
  resolveBooking,
  isProfessionalFoul,
} from './fouls.js';
import type { GameState, PlayerPiece } from './types.js';

/**
 * RESEARCH.md Pitfall 2: injury/booking rolls are an INVERTED convention versus every
 * other duel in this codebase — a bare `die >= attribute` comparison, never routed
 * through `computeCombinedScore`. Higher attribute is BETTER for its owner here (higher
 * resilience/leniency makes the roll LESS likely to trigger an injury/card), which is
 * the opposite relationship of a combined-score duel. Do NOT "correct" this inversion
 * in a future refactor — it is the documented, intentional rulebook behaviour.
 */

function makePiece(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'p1',
    teamId: 'home',
    position: { q: 10, r: 10 },
    pace: 5,
    shooting: 5,
    tackling: 5,
    dribbling: 5,
    saving: 5,
    handling: 5,
    resilience: 5,
    aerialAbility: 5,
    highPass: 5,
    firstName: 'Test',
    lastName: 'Player',
    number: 9,
    nationality: 'USA',
    role: 'MID',
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'TEST',
    phase: 'MOVE',
    activeTeam: 'home',
    pieces: [],
    ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 3 },
    attackingTeam: 'home',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: 'ATTACKER_4',
    ballZone: 'middle',
    addedTime: null,
    lastActionType: null,
    kickOffTeam: 'home',
    kickOffActive: false,
    selectedTeams: { home: 'city', away: 'crew' },
    selectedUniformStyles: { home: 'pinstripes-horizontal', away: 'pinstripes-horizontal' },
    gameSpeed: 'standard',
    ...overrides,
  };
}

describe('FOUL_TRIGGER_DIE', () => {
  it('is 1', () => {
    expect(FOUL_TRIGGER_DIE).toBe(1);
  });
});

describe('rollsInjury', () => {
  // Pitfall 2: bare `die >= resilience` — asserted directly, never via computeCombinedScore.
  it('die === resilience (6, 6) is true', () => {
    expect(rollsInjury(6, 6)).toBe(true);
  });

  it('die > resilience is true (5 vs resilience 4)', () => {
    expect(rollsInjury(5, 4)).toBe(true);
  });

  it('die < resilience (5, 6) is false', () => {
    expect(rollsInjury(5, 6)).toBe(false);
  });

  it('die === resilience (1, 1) is true', () => {
    expect(rollsInjury(1, 1)).toBe(true);
  });

  it('die < resilience (3, 5) is false', () => {
    expect(rollsInjury(3, 5)).toBe(false);
  });
});

describe('rollsBooking', () => {
  // Pitfall 2: identical bare `die >= leniency` shape as rollsInjury — asserted directly.
  it('die === leniency (4, 4) is true', () => {
    expect(rollsBooking(4, 4)).toBe(true);
  });

  it('die < leniency (3, 4) is false', () => {
    expect(rollsBooking(3, 4)).toBe(false);
  });

  it('die > leniency (6, 1) is true', () => {
    expect(rollsBooking(6, 1)).toBe(true);
  });
});

describe('isInjured', () => {
  it('is false when injuryCount is undefined', () => {
    const piece = makePiece();
    expect(isInjured(piece)).toBe(false);
  });

  it('is false when injuryCount is 0', () => {
    const piece = makePiece({ injuryCount: 0 });
    expect(isInjured(piece)).toBe(false);
  });

  it('is true when injuryCount is greater than 0', () => {
    const piece = makePiece({ injuryCount: 1 });
    expect(isInjured(piece)).toBe(true);
  });
});

describe('applyInjuryDegradation', () => {
  it('returns a NEW piece object (immutable — does not mutate the input)', () => {
    const piece = makePiece();
    const result = applyInjuryDegradation(piece);
    expect(result).not.toBe(piece);
    expect(piece.pace).toBe(5); // input untouched
  });

  it('decrements an attribute at 5 to 4', () => {
    const piece = makePiece({ pace: 5 });
    const result = applyInjuryDegradation(piece);
    expect(result.pace).toBe(4);
  });

  it('floors an attribute already at 1 to stay at 1 (never below 1)', () => {
    const piece = makePiece({ shooting: 1 });
    const result = applyInjuryDegradation(piece);
    expect(result.shooting).toBe(1);
  });

  it('leaves highPass at 0 unchanged (GK legitimately carries 0 — not raised to 1)', () => {
    const piece = makePiece({ highPass: 0, role: 'GK' });
    const result = applyInjuryDegradation(piece);
    expect(result.highPass).toBe(0);
  });

  it('decrements every one of the nine numeric attributes by 1', () => {
    const piece = makePiece({
      pace: 5,
      shooting: 5,
      tackling: 5,
      dribbling: 5,
      saving: 5,
      handling: 5,
      resilience: 5,
      aerialAbility: 5,
      highPass: 5,
    });
    const result = applyInjuryDegradation(piece);
    expect(result.pace).toBe(4);
    expect(result.shooting).toBe(4);
    expect(result.tackling).toBe(4);
    expect(result.dribbling).toBe(4);
    expect(result.saving).toBe(4);
    expect(result.handling).toBe(4);
    expect(result.resilience).toBe(4);
    expect(result.aerialAbility).toBe(4);
    expect(result.highPass).toBe(4);
  });

  it('increments injuryCount from undefined to 1', () => {
    const piece = makePiece();
    const result = applyInjuryDegradation(piece);
    expect(result.injuryCount).toBe(1);
  });

  it('leaves identity fields (id/teamId/position/name/number/nationality/role) untouched', () => {
    const piece = makePiece({
      id: 'p42',
      teamId: 'away',
      position: { q: 3, r: 4 },
      firstName: 'Alex',
      lastName: 'Morgan',
      number: 13,
      nationality: 'ENG',
      role: 'FWD',
    });
    const result = applyInjuryDegradation(piece);
    expect(result.id).toBe('p42');
    expect(result.teamId).toBe('away');
    expect(result.position).toEqual({ q: 3, r: 4 });
    expect(result.firstName).toBe('Alex');
    expect(result.lastName).toBe('Morgan');
    expect(result.number).toBe(13);
    expect(result.nationality).toBe('ENG');
    expect(result.role).toBe('FWD');
  });

  it('applied twice yields injuryCount 2 and a second -1 on every attribute (INJURY-03, D-06)', () => {
    const piece = makePiece({ pace: 5 });
    const once = applyInjuryDegradation(piece);
    const twice = applyInjuryDegradation(once);
    expect(twice.injuryCount).toBe(2);
    expect(twice.pace).toBe(3);
  });

  it('applied twice still floors an attribute that reaches 1 after the first application', () => {
    const piece = makePiece({ shooting: 2 });
    const once = applyInjuryDegradation(piece);
    expect(once.shooting).toBe(1);
    const twice = applyInjuryDegradation(once);
    expect(twice.shooting).toBe(1);
  });
});

describe('resolveBooking', () => {
  it('normal foul, die < leniency, 0 priors -> none, not second yellow', () => {
    const result = resolveBooking({ die: 3, leniency: 4, priorYellows: 0, professional: false });
    expect(result).toEqual({ card: 'none', secondYellow: false });
  });

  it('normal foul, die >= leniency, 0 priors -> yellow, not second yellow (CARD-01)', () => {
    const result = resolveBooking({ die: 4, leniency: 4, priorYellows: 0, professional: false });
    expect(result).toEqual({ card: 'yellow', secondYellow: false });
  });

  it('normal foul, die >= leniency, 1 prior yellow -> red, second yellow (CARD-02)', () => {
    const result = resolveBooking({ die: 5, leniency: 4, priorYellows: 1, professional: false });
    expect(result).toEqual({ card: 'red', secondYellow: true });
  });

  it('professional foul, die >= leniency -> straight red, not second yellow (CARD-03)', () => {
    const result = resolveBooking({ die: 5, leniency: 4, priorYellows: 0, professional: true });
    expect(result).toEqual({ card: 'red', secondYellow: false });
  });

  it('professional foul, die < leniency -> yellow, not second yellow (CARD-03 otherwise-yellow)', () => {
    const result = resolveBooking({ die: 2, leniency: 4, priorYellows: 0, professional: true });
    expect(result).toEqual({ card: 'yellow', secondYellow: false });
  });

  it('professional foul, die < leniency, 1 prior yellow -> red, second yellow (upgrade still applies)', () => {
    const result = resolveBooking({ die: 2, leniency: 4, priorYellows: 1, professional: true });
    expect(result).toEqual({ card: 'red', secondYellow: true });
  });
});

describe('isProfessionalFoul', () => {
  // RESEARCH.md Pitfall 5: straight-line "as the crow flies" reachability — no path-walk,
  // no occupancy simulation. hexDistance(other.position, foulHex) <= other.pace - paceUsed.
  const foulHex = { q: 10, r: 10 };

  it('a reachable teammate (2 hexes away, pace 5, 0 pace used) means NOT a professional foul', () => {
    const fouler = makePiece({ id: 'fouler', teamId: 'home', position: { q: 20, r: 20 } });
    const teammate = makePiece({
      id: 'teammate',
      teamId: 'home',
      position: { q: 12, r: 10 },
      pace: 5,
    });
    const state = makeState({ pieces: [fouler, teammate], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', foulHex)).toBe(false);
  });

  it('the same teammate with 4 of 5 pace already used (only 1 hex of budget left) IS a professional foul', () => {
    const fouler = makePiece({ id: 'fouler', teamId: 'home', position: { q: 20, r: 20 } });
    const teammate = makePiece({
      id: 'teammate',
      teamId: 'home',
      position: { q: 12, r: 10 },
      pace: 5,
    });
    const state = makeState({
      pieces: [fouler, teammate],
      paceUsedByPieceId: { teammate: 4 },
    });
    expect(isProfessionalFoul(state, 'fouler', foulHex)).toBe(true);
  });

  it('only the fouler on the team IS a professional foul', () => {
    const fouler = makePiece({ id: 'fouler', teamId: 'home', position: { q: 20, r: 20 } });
    const state = makeState({ pieces: [fouler], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', foulHex)).toBe(true);
  });

  it('a teammate in range but redCarded IS a professional foul (dismissed pieces cannot cover)', () => {
    const fouler = makePiece({ id: 'fouler', teamId: 'home', position: { q: 20, r: 20 } });
    const teammate = makePiece({
      id: 'teammate',
      teamId: 'home',
      position: { q: 12, r: 10 },
      pace: 5,
      redCarded: true,
    });
    const state = makeState({ pieces: [fouler, teammate], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', foulHex)).toBe(true);
  });
});
