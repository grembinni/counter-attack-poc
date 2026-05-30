import { describe, it, expect } from 'vitest';
import { validateHeading } from './headingValidator.js';
import type { GameState, PlayerPiece } from './types.js';

const basePiece: PlayerPiece = {
  id: 'p1',
  teamId: 'home',
  position: { q: 5, r: 5 },
  pace: 4,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  heading: 6,
  saving: 1,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
  name: 'Test Player',
  role: 'MID',
};

const baseState: GameState = {
  roomCode: 'TEST',
  phase: 'HEADER',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [basePiece],
  ball: { position: { q: 5, r: 5 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
};

const ballAt = { q: 5, r: 5 }; // distance 0 from basePiece

describe('validateHeading', () => {
  it('rejects when previousActionWasHeadedPass is true (CONSECUTIVE_HEADER) even at distance 1', () => {
    const result = validateHeading(
      baseState,
      basePiece,
      { q: 6, r: 5 },
      {
        previousActionWasHeadedPass: true,
        otherChallengerIds: [],
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('CONSECUTIVE_HEADER');
  });

  it('rejects when challenger distance > 2 (OUT_OF_RANGE)', () => {
    // challenger at {5,5}, ball at {8,5} → distance 3
    const result = validateHeading(
      baseState,
      basePiece,
      { q: 8, r: 5 },
      {
        previousActionWasHeadedPass: false,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('OUT_OF_RANGE');
  });

  it('returns contested:false (uncontested auto-win) when otherChallengerIds is empty', () => {
    // challenger at {5,5}, ball at {5,5} → distance 0 (within range)
    const result = validateHeading(baseState, basePiece, ballAt, {
      previousActionWasHeadedPass: false,
      otherChallengerIds: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contested).toBe(false);
  });

  it('returns penaltyModifier 0 at distance 1 with challengers (HEAD-01)', () => {
    // challenger at {5,5}, ball at {6,5} → distance 1
    const result = validateHeading(
      baseState,
      basePiece,
      { q: 6, r: 5 },
      {
        previousActionWasHeadedPass: false,
        otherChallengerIds: ['opp1'],
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.contested) expect(result.penaltyModifier).toBe(0);
  });

  it('returns penaltyModifier -1 at distance 2 with challengers (HEAD-01)', () => {
    // challenger at {5,5}, ball at {7,5} → distance 2
    const result = validateHeading(
      baseState,
      basePiece,
      { q: 7, r: 5 },
      {
        previousActionWasHeadedPass: false,
        otherChallengerIds: ['opp1'],
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.contested) expect(result.penaltyModifier).toBe(-1);
  });

  it('excludedPieceIds includes both the challenger and all otherChallengerIds (HEAD-05)', () => {
    const result = validateHeading(
      baseState,
      basePiece,
      { q: 6, r: 5 },
      {
        previousActionWasHeadedPass: false,
        otherChallengerIds: ['opp1', 'opp2'],
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.contested) {
      expect(result.excludedPieceIds).toContain('p1');
      expect(result.excludedPieceIds).toContain('opp1');
      expect(result.excludedPieceIds).toContain('opp2');
    }
  });

  it('returns contested:false (uncontested) at distance 2 with no challengers (HEAD-02)', () => {
    // challenger at {5,5}, ball at {7,5} → distance 2; penaltyModifier irrelevant for uncontested
    const result = validateHeading(
      baseState,
      basePiece,
      { q: 7, r: 5 },
      {
        previousActionWasHeadedPass: false,
        otherChallengerIds: [],
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contested).toBe(false);
  });

  it('CONSECUTIVE_HEADER takes precedence over OUT_OF_RANGE (HEAD-04 checked first)', () => {
    // both conditions true: consecutive header AND distance > 2
    const result = validateHeading(
      baseState,
      basePiece,
      { q: 9, r: 5 },
      {
        previousActionWasHeadedPass: true,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('CONSECUTIVE_HEADER');
  });
});
