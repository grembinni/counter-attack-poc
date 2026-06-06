import { describe, it, expect } from 'vitest';
import { validatePass, validatePassAccuracy } from './passValidator.js';
import type { GameState, PlayerPiece } from './types.js';

const basePiece: PlayerPiece = {
  id: 'p1',
  teamId: 'home',
  position: { q: 0, r: 0 },
  pace: 4,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  heading: 5,
  saving: 1,
  handling: 5,
  resilience: 5,
  aerialAbility: 0, // D-05: outfielders aerialAbility=0
  highPass: 3,
  name: 'Test Player',
  role: 'MID',
};

const makeOpponent = (id: string, q: number, r: number): PlayerPiece => ({
  ...basePiece,
  id,
  teamId: 'away',
  position: { q, r },
});

const makeTeammate = (id: string, q: number, r: number): PlayerPiece => ({
  ...basePiece,
  id,
  teamId: 'home',
  position: { q, r },
});

const baseState: GameState = {
  roomCode: 'TEST',
  phase: 'PASS',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [basePiece],
  ball: { position: { q: 0, r: 0 }, carrierId: 'p1' },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
};

describe('validatePass', () => {
  it('rejects STANDARD pass at distance 12 with RANGE_EXCEEDED', () => {
    const result = validatePass(baseState, basePiece, { q: 0, r: 0 }, { q: 12, r: 0 }, 'STANDARD');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('RANGE_EXCEEDED');
  });

  it('accepts STANDARD pass at distance 11', () => {
    const state: GameState = { ...baseState, pieces: [basePiece] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 11, r: 0 }, 'STANDARD');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.interceptors).toEqual([]);
  });

  it('rejects FIRST_TIME pass at distance 7 with RANGE_EXCEEDED', () => {
    const result = validatePass(baseState, basePiece, { q: 0, r: 0 }, { q: 7, r: 0 }, 'FIRST_TIME');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('RANGE_EXCEEDED');
  });

  it('accepts HIGH pass at distance 15', () => {
    const result = validatePass(baseState, basePiece, { q: 0, r: 0 }, { q: 15, r: 0 }, 'HIGH');
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.interceptors)).toBe(true);
  });

  it('accepts LONG pass at distance 30 when target is far from all pieces', () => {
    const result = validatePass(baseState, basePiece, { q: 0, r: 0 }, { q: 30, r: 0 }, 'LONG');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.interceptors).toEqual([]);
  });

  it('rejects STANDARD pass with PATH_BLOCKED when teammate occupies intermediate hex', () => {
    const blocker = makeTeammate('p2', 5, 0); // intermediate hex on line from {0,0} to {10,0}
    const state: GameState = { ...baseState, pieces: [basePiece, blocker] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 10, r: 0 }, 'STANDARD');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('PATH_BLOCKED');
  });

  it('rejects STANDARD pass with PATH_BLOCKED when opponent occupies intermediate hex', () => {
    const blocker = makeOpponent('opp1', 5, 0); // intermediate hex on line from {0,0} to {10,0}
    const state: GameState = { ...baseState, pieces: [basePiece, blocker] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 10, r: 0 }, 'STANDARD');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('PATH_BLOCKED');
  });

  it('does NOT block a HIGH pass over an opponent in the travel path', () => {
    const blocker = makeOpponent('opp1', 5, 0); // intermediate hex
    const state: GameState = { ...baseState, pieces: [basePiece, blocker] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 10, r: 0 }, 'HIGH');
    // HIGH passes are not blocked by intermediate opponents
    expect(result.ok).toBe(true);
  });

  it('does NOT count an opponent adjacent only to the destination as an interceptor', () => {
    // from {0,0} to {5,0}; opp at {6,0} is distance 1 from destination only — not flight path
    const opp = makeOpponent('opp1', 6, 0);
    const state: GameState = { ...baseState, pieces: [basePiece, opp] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 5, r: 0 }, 'STANDARD');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.interceptors).toHaveLength(0);
  });

  it('returns interceptors[] containing every distance-1 opponent with no duplicates', () => {
    // Opponent at {4,1} is adjacent to path hex {4,0} on line from {0,0} to {8,0}
    const opp = makeOpponent('opp1', 4, 1);
    const state: GameState = { ...baseState, pieces: [basePiece, opp] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 8, r: 0 }, 'STANDARD');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.interceptors).toHaveLength(1);
      expect(result.interceptors[0]?.id).toBe('opp1');
    }
  });

  it('returns FIRST_TIME_PLAYER_MOVES effect on a successful FIRST_TIME pass', () => {
    const result = validatePass(baseState, basePiece, { q: 0, r: 0 }, { q: 5, r: 0 }, 'FIRST_TIME');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('effect' in result).toBe(true);
      if ('effect' in result) expect(result.effect.type).toBe('FIRST_TIME_PLAYER_MOVES');
    }
  });

  it('returns empty interceptors[] for a LONG pass even when opponents are adjacent to the line', () => {
    const opp = makeOpponent('opp1', 10, 1); // adjacent to path hex {10,0}
    const state: GameState = { ...baseState, pieces: [basePiece, opp] };
    // target far enough from all pieces for landing check to pass
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 30, r: 0 }, 'LONG');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.interceptors).toEqual([]);
  });

  it('rejects LONG pass with LANDING_RESTRICTED when target is within 5 hexes of own teammate', () => {
    // passer at {0,0}, teammate at {6,5} which is distance < 6 from target {10,5}
    const teammate = makeTeammate('p2', 6, 5); // hexDistance({10,5},{6,5}) = 4 <= 5 → restricted
    const state: GameState = { ...baseState, pieces: [basePiece, teammate] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 10, r: 5 }, 'LONG');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('LANDING_RESTRICTED');
  });

  it('rejects LONG pass with LANDING_RESTRICTED when target is adjacent to an opponent', () => {
    // opponent at {11,5} is distance 1 from target {10,5}
    const opp = makeOpponent('opp1', 11, 5);
    const state: GameState = { ...baseState, pieces: [basePiece, opp] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 10, r: 5 }, 'LONG');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('LANDING_RESTRICTED');
  });

  it('accepts LONG pass when target is exactly 6 hexes from nearest own teammate and ≥2 from opponents', () => {
    // teammate at {4,5} → hexDistance({10,5},{4,5}) = 6 > 5 → passes own-piece check
    const teammate = makeTeammate('p2', 4, 5);
    // opponent at {12,5} → hexDistance({10,5},{12,5}) = 2 > 1 → passes opponent check
    const opp = makeOpponent('opp1', 12, 5);
    const state: GameState = { ...baseState, pieces: [basePiece, teammate, opp] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 10, r: 5 }, 'LONG');
    expect(result.ok).toBe(true);
  });

  it('LONG landing check does NOT count the passer as a blocking teammate (self-exclusion)', () => {
    // passer at {0,0}, target at {3,0}: hexDistance({3,0},{0,0}) = 3 <= 5
    // but passer is excluded via id !== piece.id, so this must NOT trigger LANDING_RESTRICTED
    const state: GameState = { ...baseState, pieces: [basePiece] };
    const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 3, r: 0 }, 'LONG');
    // No other pieces → should pass landing checks
    expect(result.ok).toBe(true);
  });

  it('rejects pass to own hex (distance 0) with RANGE_EXCEEDED for all types', () => {
    for (const passType of ['STANDARD', 'FIRST_TIME', 'HIGH', 'LONG'] as const) {
      const result = validatePass(baseState, basePiece, { q: 0, r: 0 }, { q: 0, r: 0 }, passType);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('RANGE_EXCEEDED');
    }
  });
});

describe('validatePassAccuracy', () => {
  it('HIGH pass: highPass 3 + dice 5 = 8 → accurate (threshold 8, D-14)', () => {
    const result = validatePassAccuracy(basePiece, 'HIGH', 5, []);
    expect(result.accurate).toBe(true);
  });

  it('HIGH pass: highPass 3 + dice 4 = 7 → inaccurate with triggerLooseBall (D-14)', () => {
    const result = validatePassAccuracy(basePiece, 'HIGH', 4, []);
    expect(result.accurate).toBe(false);
    if (!result.accurate) expect(result.triggerLooseBall).toBe(true);
  });

  it('LONG_CROSS_THIRD: highPass 3 + dice 6 = 9 < 10 → inaccurate; dice 7 would be accurate (uses highPass, not dribbling per D-04)', () => {
    // basePiece: highPass=3, dribbling=5
    // D-04 correction (Phase 8.2): Long Pass uses highPass, not dribbling
    const inaccurate = validatePassAccuracy(basePiece, 'LONG_CROSS_THIRD', 6, []);
    expect(inaccurate.accurate).toBe(false); // highPass(3)+dice(6)=9 < 10
  });

  it('D-04: LONG_SAME_THIRD uses highPass (not dribbling) — piece with highPass=5, dribbling=1, die=4 → combined 9 → accurate (threshold 9)', () => {
    // Proves Long Pass uses highPass: 5+4=9 >= 9 → accurate
    // If it used dribbling instead: 1+4=5 < 9 → inaccurate (would fail this test)
    const piece: PlayerPiece = { ...basePiece, highPass: 5, dribbling: 1 };
    const result = validatePassAccuracy(piece, 'LONG_SAME_THIRD', 4, []);
    expect(result.accurate).toBe(true);
  });

  it('D-04: LONG_SAME_THIRD dribbling irrelevant — piece with highPass=2, dribbling=6, die=4 → combined 6 < 9 → inaccurate (proves dribbling NOT used)', () => {
    // highPass(2)+die(4)=6 < 9 → inaccurate
    // If dribbling were used: 6+4=10 >= 9 → accurate (would fail this test)
    const piece: PlayerPiece = { ...basePiece, highPass: 2, dribbling: 6 };
    const result = validatePassAccuracy(piece, 'LONG_SAME_THIRD', 4, []);
    expect(result.accurate).toBe(false);
    if (!result.accurate) expect(result.triggerLooseBall).toBe(true);
  });

  it('HIGH pass accuracy behavior unchanged — still uses highPass (D-04)', () => {
    // basePiece: highPass=3, die=5 → 3+5=8 >= 8 → accurate
    const result = validatePassAccuracy(basePiece, 'HIGH', 5, []);
    expect(result.accurate).toBe(true);
  });

  it('applies DICE-04 -2 cap: highPass 4, dice 6, penalties [-1,-1,-1] → 4+6-2=8 < 9 → inaccurate (LONG_SAME_THIRD)', () => {
    const piece: PlayerPiece = { ...basePiece, highPass: 4 };
    const result = validatePassAccuracy(piece, 'LONG_SAME_THIRD', 6, [-1, -1, -1]);
    // 4 + 6 + clamp(-3, -2, 0) = 4 + 6 - 2 = 8 < 9
    expect(result.accurate).toBe(false);
    if (!result.accurate) expect(result.triggerLooseBall).toBe(true);
  });
});
