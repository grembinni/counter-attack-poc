import { describe, it, expect } from 'vitest';
import { validateMove } from './moveValidator.js';
import type { GameState, PlayerPiece } from './types.js';

const basePiece: PlayerPiece = {
  id: 'p1',
  teamId: 'home',
  position: { q: 5, r: 5 },
  pace: 4,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  heading: 5,
  saving: 1,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
};

const baseState: GameState = {
  roomCode: 'TEST',
  phase: 'MOVEMENT',
  activeTeam: 'home',
  pieces: [basePiece],
  ball: { position: { q: 0, r: 0 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
};

describe('validateMove', () => {
  it('rejects when movementSlot is null (WRONG_SLOT)', () => {
    const state: GameState = { ...baseState, movementSlot: null };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_SLOT');
  });

  it('rejects multi-hex moves with OUT_OF_RANGE (distance 2)', () => {
    const result = validateMove(baseState, basePiece, { q: 7, r: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('OUT_OF_RANGE');
  });

  it('rejects move to occupied hex (OCCUPIED)', () => {
    const blocker: PlayerPiece = { ...basePiece, id: 'p2', position: { q: 6, r: 5 } };
    const state: GameState = { ...baseState, pieces: [basePiece, blocker] };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('OCCUPIED');
  });

  it('rejects ATTACKER_4 move when paceUsed + 1 > piece.pace (PACE_EXCEEDED)', () => {
    const state: GameState = {
      ...baseState,
      paceUsedByPieceId: { p1: 4 }, // pace is 4, so 4 + 1 = 5 > 4
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('PACE_EXCEEDED');
  });

  it('accepts ATTACKER_4 move within pace', () => {
    const state: GameState = {
      ...baseState,
      paceUsedByPieceId: { p1: 1 }, // 1 + 1 = 2 <= 4
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(true);
  });

  it('rejects DEFENDER_5 move when paceUsed + 1 > piece.pace (PACE_EXCEEDED)', () => {
    const state: GameState = {
      ...baseState,
      movementSlot: 'DEFENDER_5',
      paceUsedByPieceId: { p1: 4 }, // 4 + 1 = 5 > 4
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('PACE_EXCEEDED');
  });

  it('enforces flat 2-hex cap for ATTACKER_2 regardless of piece.pace', () => {
    // piece.pace = 4, but ATTACKER_2 cap is 2; paceUsed=2 means 2+1=3 > 2
    const fastPiece: PlayerPiece = { ...basePiece, pace: 5 };
    const state: GameState = {
      ...baseState,
      movementSlot: 'ATTACKER_2',
      pieces: [fastPiece],
      paceUsedByPieceId: { p1: 2 }, // 2 + 1 = 3 > flat cap of 2
    };
    const result = validateMove(state, fastPiece, { q: 6, r: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('PACE_EXCEEDED');
  });

  it('rejects ATTACKER_2 move for piece already in movedPieceIds (ALREADY_MOVED_IN_ATTACKER4)', () => {
    const state: GameState = {
      ...baseState,
      movementSlot: 'ATTACKER_2',
      movedPieceIds: ['p1'],
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ALREADY_MOVED_IN_ATTACKER4');
  });

  it('returns STEAL_ATTEMPT when ball-carrier moves adjacent to an opponent', () => {
    const opponent: PlayerPiece = {
      ...basePiece,
      id: 'opp1',
      teamId: 'away',
      position: { q: 7, r: 5 }, // adjacent to destination {q:6,r:5}
    };
    const state: GameState = {
      ...baseState,
      pieces: [basePiece, opponent],
      ball: { position: { q: 5, r: 5 }, carrierId: 'p1' },
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('STEAL_ATTEMPT');
        expect(result.effect.defenders).toHaveLength(1);
        expect(result.effect.defenders[0]?.id).toBe('opp1');
      }
    }
  });

  it('does NOT return STEAL_ATTEMPT when a non-ball-carrier moves adjacent to opponents', () => {
    const opponent: PlayerPiece = {
      ...basePiece,
      id: 'opp1',
      teamId: 'away',
      position: { q: 7, r: 5 },
    };
    const state: GameState = {
      ...baseState,
      pieces: [basePiece, opponent],
      ball: { position: { q: 0, r: 0 }, carrierId: null }, // p1 is NOT the ball carrier
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) expect('effect' in result).toBe(false);
  });

  it('accepts ball-carrier move when destination has no adjacent opponents', () => {
    const state: GameState = {
      ...baseState,
      pieces: [basePiece],
      ball: { position: { q: 5, r: 5 }, carrierId: 'p1' },
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) expect('effect' in result).toBe(false);
  });

  it('checks WRONG_SLOT before OUT_OF_RANGE (null slot + distance 2 → WRONG_SLOT)', () => {
    const state: GameState = { ...baseState, movementSlot: null };
    const result = validateMove(state, basePiece, { q: 7, r: 5 }); // distance 2
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_SLOT');
  });
});
