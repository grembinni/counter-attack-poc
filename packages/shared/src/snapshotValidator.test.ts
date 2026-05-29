import { describe, it, expect } from 'vitest';
import { validateSnapshot } from './snapshotValidator.js';
import type { GameState, PlayerPiece } from './types.js';

const basePiece: PlayerPiece = {
  id: 'p1',
  teamId: 'home',
  position: { q: 5, r: 5 },
  pace: 4,
  shooting: 7,
  tackling: 5,
  dribbling: 5,
  heading: 5,
  saving: 1,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
};

const makeState = (phase: GameState['phase']): GameState => ({
  roomCode: 'TEST',
  phase,
  activeTeam: 'home',
  pieces: [basePiece],
  ball: { position: { q: 5, r: 5 }, carrierId: 'p1' },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
});

describe('validateSnapshot', () => {
  it('returns WRONG_PHASE outside MOVEMENT/PASS/SNAPSHOT (SNAP-01)', () => {
    const result = validateSnapshot(makeState('SHOT'), basePiece);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  it('accepts in MOVEMENT phase with shootingPenalty -1 and deflectionEffect maxHexes 2 (SNAP-02)', () => {
    const result = validateSnapshot(makeState('MOVEMENT'), basePiece);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shootingPenalty).toBe(-1);
      expect(result.deflectionEffect.type).toBe('OPPONENT_MOVES');
      expect(result.deflectionEffect.maxHexes).toBe(2);
    }
  });

  it('accepts in PASS phase (SNAP-01 post-pass trigger)', () => {
    const result = validateSnapshot(makeState('PASS'), basePiece);
    expect(result.ok).toBe(true);
  });

  it('accepts in SNAPSHOT phase (composability — already snapshotting)', () => {
    const result = validateSnapshot(makeState('SNAPSHOT'), basePiece);
    expect(result.ok).toBe(true);
  });
});
