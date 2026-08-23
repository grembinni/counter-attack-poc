import { describe, it, expect } from 'vitest';
import {
  STOPPAGE_PHASES,
  isStoppagePhase,
  MAX_SUBS_PER_TEAM,
  maxOnPitchFor,
  isActivePiece,
} from './stoppagePhases.js';
import type { GamePhase, PlayerPiece } from './types.js';

// Full-GamePhase-union coverage (Phase 40 / SUB-01, extended Phase 43): every one of the
// 45 GamePhase values must be explicitly classified as stoppage (true) or not (false). This
// is a regression guard — a future phase adding a GamePhase must consciously classify it
// here, not silently inherit `false` from `.includes()`.

const STOPPAGE_VALUES: GamePhase[] = [
  'KICK_OFF_SETUP',
  'HALF_TIME',
  'FREE_KICK_SETUP',
  'THROW_IN_SETUP',
  'GOAL_KICK_SETUP_GK',
  'GOAL_KICK_SETUP_OPPONENT',
  'GOAL_KICK_CHOICE',
  'CORNER_KICK_GK_SETUP_ATTACKING',
  'CORNER_KICK_GK_SETUP_DEFENDING',
  'CORNER_KICK_TAKER_SELECT',
  'CORNER_KICK_REPOSITION',
  'CORNER_KICK_FINAL_SETUP',
  'PENALTY_KICK_SETUP_ATTACKING',
  'PENALTY_KICK_SETUP_DEFENDING',
  'PENALTY_KICK_TAKER_SELECT',
];

const NON_STOPPAGE_VALUES: GamePhase[] = [
  'LOBBY',
  'KICK_OFF',
  'MOVE',
  'PASS',
  'SNAPSHOT_TARGET',
  'GK_DIVE',
  'SNAPSHOT_DEFLECT',
  'SHOT',
  'HEADER',
  'SNAPSHOT',
  'LOOSE_BALL',
  'HIGH_PASS_MOVE',
  'GK_RESTART',
  'GK_QUICK_THROW',
  'GK_KICK_TARGET',
  'GK_KICK_MOVE',
  'FREE_MOVE_ATTACK',
  'FREE_MOVE_DEFENSE',
  'FIRST_TIME_PASS_MOVE',
  'GOAL_KICK_TARGET',
  'GOAL_KICK_MOVE',
  'FOUL_CHOICE',
  'GK_DIVE_AT_FEET_PROMPT',
  'GK_DIVE_AT_FEET_TARGET',
  'GK_BOX_ENTRY_PROMPT',
  'GK_BOX_ENTRY_MOVE',
  'TACKLE_STEAL_PROMPT',
  'PENALTY_KICK',
  'FULL_TIME',
  'REPLAY',
];

describe('STOPPAGE_PHASES', () => {
  it('contains exactly 15 values', () => {
    expect(STOPPAGE_PHASES.length).toBe(15);
  });

  it('covers exactly 45 GamePhase values combined with the non-stoppage set', () => {
    expect(STOPPAGE_VALUES.length + NON_STOPPAGE_VALUES.length).toBe(45);
  });
});

describe('isStoppagePhase', () => {
  it.each(STOPPAGE_VALUES)('returns true for stoppage phase %s', (phase) => {
    expect(isStoppagePhase(phase)).toBe(true);
  });

  it.each(NON_STOPPAGE_VALUES)('returns false for non-stoppage phase %s', (phase) => {
    expect(isStoppagePhase(phase)).toBe(false);
  });

  it('returns false for GK_RESTART', () => {
    expect(isStoppagePhase('GK_RESTART')).toBe(false);
  });

  it('returns false for PENALTY_KICK', () => {
    expect(isStoppagePhase('PENALTY_KICK')).toBe(false);
  });

  it('returns false for KICK_OFF', () => {
    expect(isStoppagePhase('KICK_OFF')).toBe(false);
  });

  it('returns false for MOVE', () => {
    expect(isStoppagePhase('MOVE')).toBe(false);
  });

  it('returns false for TACKLE_STEAL_PROMPT (Phase 43: mid-duel decision prompt, not a stoppage)', () => {
    expect(isStoppagePhase('TACKLE_STEAL_PROMPT')).toBe(false);
  });

  it('STOPPAGE_PHASES still has exactly 15 members after Phase 43', () => {
    expect(STOPPAGE_PHASES.length).toBe(15);
  });
});

describe('MAX_SUBS_PER_TEAM', () => {
  it('is 3', () => {
    expect(MAX_SUBS_PER_TEAM).toBe(3);
  });
});

describe('maxOnPitchFor', () => {
  function piece(overrides: Partial<PlayerPiece>): PlayerPiece {
    return {
      id: 'home-1',
      teamId: 'home',
      position: { q: 0, r: 0 },
      pace: 1,
      shooting: 1,
      tackling: 1,
      dribbling: 1,
      saving: 1,
      handling: 1,
      resilience: 1,
      aerialAbility: 1,
      highPass: 1,
      firstName: 'A',
      lastName: 'B',
      number: 1,
      nationality: 'X',
      role: 'DEF',
      ...overrides,
    };
  }

  it('returns 11 with no red cards', () => {
    const pieces = [
      piece({ id: 'home-1', teamId: 'home' }),
      piece({ id: 'away-1', teamId: 'away' }),
    ];
    expect(maxOnPitchFor(pieces, 'home')).toBe(11);
  });

  it('returns 10 with one red-carded piece on that team', () => {
    const pieces = [
      piece({ id: 'home-1', teamId: 'home', redCarded: true }),
      piece({ id: 'home-2', teamId: 'home' }),
    ];
    expect(maxOnPitchFor(pieces, 'home')).toBe(10);
  });

  it('returns 9 with two red-carded pieces on that team', () => {
    const pieces = [
      piece({ id: 'home-1', teamId: 'home', redCarded: true }),
      piece({ id: 'home-2', teamId: 'home', redCarded: true }),
      piece({ id: 'home-3', teamId: 'home' }),
    ];
    expect(maxOnPitchFor(pieces, 'home')).toBe(9);
  });

  it('ignores the opponent team red cards', () => {
    const pieces = [
      piece({ id: 'home-1', teamId: 'home' }),
      piece({ id: 'away-1', teamId: 'away', redCarded: true }),
      piece({ id: 'away-2', teamId: 'away', redCarded: true }),
    ];
    expect(maxOnPitchFor(pieces, 'home')).toBe(11);
    expect(maxOnPitchFor(pieces, 'away')).toBe(9);
  });
});

describe('isActivePiece', () => {
  function piece(overrides: Partial<PlayerPiece>): PlayerPiece {
    return {
      id: 'home-1',
      teamId: 'home',
      position: { q: 0, r: 0 },
      pace: 1,
      shooting: 1,
      tackling: 1,
      dribbling: 1,
      saving: 1,
      handling: 1,
      resilience: 1,
      aerialAbility: 1,
      highPass: 1,
      firstName: 'A',
      lastName: 'B',
      number: 1,
      nationality: 'X',
      role: 'DEF',
      ...overrides,
    };
  }

  it('returns true for a plain piece with no card/onPitch flags set', () => {
    expect(isActivePiece(piece({}))).toBe(true);
  });

  it('returns false when redCarded is true', () => {
    expect(isActivePiece(piece({ redCarded: true }))).toBe(false);
  });

  it('returns false when onPitch is false', () => {
    expect(isActivePiece(piece({ onPitch: false }))).toBe(false);
  });

  it('returns false when both redCarded and onPitch are set', () => {
    expect(isActivePiece(piece({ redCarded: true, onPitch: false }))).toBe(false);
  });

  it('returns true when explicitly redCarded: false and onPitch: true', () => {
    expect(isActivePiece(piece({ redCarded: false, onPitch: true }))).toBe(true);
  });

  it('returns true for a booked-but-not-sent-off piece (yellowCards: 1)', () => {
    expect(isActivePiece(piece({ yellowCards: 1 }))).toBe(true);
  });
});
