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
  name: 'Test Player',
  role: 'MID',
};

const baseState: GameState = {
  roomCode: 'TEST',
  phase: 'MOVEMENT',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [basePiece],
  ball: { position: { q: 0, r: 0 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
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

  it('enforces piece.pace cap for ATTACKER_2 (no flat 2-hex cap — each activation uses own pace)', () => {
    // ATTACKER_2 now uses piece.pace, not a flat 2-hex cap; paceUsed=pace means exhausted
    const fastPiece: PlayerPiece = { ...basePiece, pace: 3 };
    const state: GameState = {
      ...baseState,
      movementSlot: 'ATTACKER_2',
      pieces: [fastPiece],
      paceUsedByPieceId: { p1: 3 }, // paceUsed=pace → 3+1 > 3 → PACE_EXCEEDED
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

  // D-10: TACKLE_ATTEMPT fires when a defender (opposing team) moves adjacent to the ball carrier
  it('returns TACKLE_ATTEMPT when a defender (different team) moves adjacent to the carrier (D-10)', () => {
    // carrier is 'away' piece at {q:7, r:5}; basePiece is 'home' at {q:5, r:5}
    // basePiece moves to {q:6, r:5} which is adjacent to the carrier at {q:7, r:5}
    const carrier: PlayerPiece = {
      ...basePiece,
      id: 'carrier1',
      teamId: 'away',
      position: { q: 7, r: 5 },
    };
    const state: GameState = {
      ...baseState,
      pieces: [basePiece, carrier],
      ball: { position: { q: 7, r: 5 }, carrierId: 'carrier1' },
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('effect' in result).toBe(true);
      if ('effect' in result) {
        expect(result.effect.type).toBe('TACKLE_ATTEMPT');
        if (result.effect.type === 'TACKLE_ATTEMPT') {
          expect(result.effect.carrierId).toBe('carrier1');
        }
      }
    }
  });

  it("does NOT return TACKLE_ATTEMPT when the moving piece is on the carrier's own team (Pitfall 4)", () => {
    // teammate moves adjacent to a carrier on the same team — no tackle
    const carrier: PlayerPiece = {
      ...basePiece,
      id: 'carrier2',
      teamId: 'home', // same team as basePiece
      position: { q: 7, r: 5 },
    };
    const state: GameState = {
      ...baseState,
      pieces: [basePiece, carrier],
      ball: { position: { q: 7, r: 5 }, carrierId: 'carrier2' },
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // No TACKLE_ATTEMPT effect for same-team movement
      if ('effect' in result) {
        expect(result.effect.type).not.toBe('TACKLE_ATTEMPT');
      }
    }
  });

  it('does NOT return TACKLE_ATTEMPT when ball.carrierId is null', () => {
    // No carrier — no tackle trigger
    const opponent: PlayerPiece = {
      ...basePiece,
      id: 'opp2',
      teamId: 'away',
      position: { q: 7, r: 5 },
    };
    const state: GameState = {
      ...baseState,
      pieces: [basePiece, opponent],
      ball: { position: { q: 0, r: 0 }, carrierId: null }, // no carrier
    };
    const result = validateMove(state, basePiece, { q: 6, r: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      if ('effect' in result) {
        expect(result.effect.type).not.toBe('TACKLE_ATTEMPT');
      }
    }
  });
});
