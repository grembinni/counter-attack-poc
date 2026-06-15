import { describe, it, expect } from 'vitest';
import { validateSnapshot } from './snapshotValidator.js';
import type { GameState } from './types.js';

const makeState = (phase: GameState['phase']): GameState => ({
  roomCode: 'TEST',
  phase,
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [],
  ball: { position: { q: 5, r: 5 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
});

describe('validateSnapshot', () => {
  it('returns WRONG_PHASE outside MOVEMENT/PASS/SNAPSHOT (SNAP-01)', () => {
    const result = validateSnapshot(makeState('SHOT'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  it('accepts in MOVE phase with shootingPenalty -1 and deflectionEffect maxHexes 2 (SNAP-02)', () => {
    const result = validateSnapshot(makeState('MOVE'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shootingPenalty).toBe(-1);
      expect(result.deflectionEffect.type).toBe('OPPONENT_MOVES');
      expect(result.deflectionEffect.maxHexes).toBe(2);
    }
  });

  it('accepts in PASS phase (SNAP-01 post-pass trigger)', () => {
    const result = validateSnapshot(makeState('PASS'));
    expect(result.ok).toBe(true);
  });

  it('accepts in SNAPSHOT phase (composability — already snapshotting)', () => {
    const result = validateSnapshot(makeState('SNAPSHOT'));
    expect(result.ok).toBe(true);
  });
});
