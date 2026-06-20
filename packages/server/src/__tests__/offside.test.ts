import { describe, it, expect } from 'vitest';
import {
  attackingDirection,
  isPastHalfway,
  isAheadOf,
  opposingPiecesEqualOrAhead,
  isOffsideNow,
  isClearedNow,
  evaluateOffside,
  OFFSIDE_HALFWAY_Q,
} from '@counter-attack/shared';
import type { GameState, PlayerPiece } from '@counter-attack/shared';
import { applyEndTurn } from '../gameEngine.js';

// ---------------------------------------------------------------------------
// Test fixtures (mirrors gameEngine.test.ts fixture conventions)
// ---------------------------------------------------------------------------

function makePiece(
  overrides: Partial<PlayerPiece> & {
    id: string;
    teamId: 'home' | 'away';
    position: { q: number; r: number };
  },
): PlayerPiece {
  return {
    firstName: 'Test',
    lastName: 'Player',
    number: 9,
    nationality: 'Test',
    role: 'FWD',
    pace: 5,
    shooting: 5,
    tackling: 5,
    dribbling: 5,
    saving: 5,
    handling: 5,
    resilience: 5,
    aerialAbility: 5,
    highPass: 5,
    ...overrides,
  };
}

/** Minimal GameState fixture — only fields offside.ts reads are meaningful. */
function makeState(overrides: Partial<GameState> & { pieces: PlayerPiece[] }): GameState {
  return {
    roomCode: 'TEST1',
    phase: 'MOVE',
    activeTeam: 'home',
    attackingTeam: 'home',
    ball: { position: { q: 18, r: 13 }, carrierId: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 3 },
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: 'ATTACKER_4',
    ballZone: 'middle',
    addedTime: null,
    lastActionType: null,
    kickOffTeam: 'home',
    kickOffActive: false,
    selectedTeams: { home: 'cosmos', away: 'xolos' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// attackingDirection
// ---------------------------------------------------------------------------

describe('attackingDirection', () => {
  it("returns 1 for 'home'", () => {
    expect(attackingDirection('home')).toBe(1);
  });

  it("returns -1 for 'away'", () => {
    expect(attackingDirection('away')).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// isPastHalfway
// ---------------------------------------------------------------------------

describe('isPastHalfway', () => {
  it('home: true when q > 18 (strictly past)', () => {
    const piece = makePiece({ id: 'home-1', teamId: 'home', position: { q: 19, r: 13 } });
    expect(isPastHalfway(piece, 'home')).toBe(true);
  });

  it('home: false when exactly on halfway (q === 18)', () => {
    const piece = makePiece({
      id: 'home-1',
      teamId: 'home',
      position: { q: OFFSIDE_HALFWAY_Q, r: 13 },
    });
    expect(isPastHalfway(piece, 'home')).toBe(false);
  });

  it('home: false when q < 18 (own half)', () => {
    const piece = makePiece({ id: 'home-1', teamId: 'home', position: { q: 17, r: 13 } });
    expect(isPastHalfway(piece, 'home')).toBe(false);
  });

  it('away: true when q < 18 (strictly past)', () => {
    const piece = makePiece({ id: 'away-1', teamId: 'away', position: { q: 17, r: 13 } });
    expect(isPastHalfway(piece, 'away')).toBe(true);
  });

  it('away: false when exactly on halfway (q === 18)', () => {
    const piece = makePiece({
      id: 'away-1',
      teamId: 'away',
      position: { q: OFFSIDE_HALFWAY_Q, r: 13 },
    });
    expect(isPastHalfway(piece, 'away')).toBe(false);
  });

  it('away: false when q > 18 (own half)', () => {
    const piece = makePiece({ id: 'away-1', teamId: 'away', position: { q: 19, r: 13 } });
    expect(isPastHalfway(piece, 'away')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAheadOf
// ---------------------------------------------------------------------------

describe('isAheadOf', () => {
  it('home: true when aheadQ > refQ', () => {
    expect(isAheadOf(20, 18, 'home')).toBe(true);
  });

  it('home: false when aheadQ === refQ (level is not ahead)', () => {
    expect(isAheadOf(18, 18, 'home')).toBe(false);
  });

  it('home: false when aheadQ < refQ', () => {
    expect(isAheadOf(16, 18, 'home')).toBe(false);
  });

  it('away: true when aheadQ < refQ', () => {
    expect(isAheadOf(16, 18, 'away')).toBe(true);
  });

  it('away: false when aheadQ === refQ (level is not ahead)', () => {
    expect(isAheadOf(18, 18, 'away')).toBe(false);
  });

  it('away: false when aheadQ > refQ', () => {
    expect(isAheadOf(20, 18, 'away')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// opposingPiecesEqualOrAhead
// ---------------------------------------------------------------------------

describe('opposingPiecesEqualOrAhead', () => {
  it('home piece: counts away pieces with q >= piece.q (any role, GK included)', () => {
    const homeFwd = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const awayLevel = makePiece({ id: 'away-1', teamId: 'away', position: { q: 25, r: 13 } }); // equal — counts
    const awayAhead = makePiece({ id: 'away-2', teamId: 'away', position: { q: 30, r: 13 } }); // ahead — counts
    const awayBehind = makePiece({ id: 'away-3', teamId: 'away', position: { q: 20, r: 13 } }); // behind — doesn't count
    const awayGK = makePiece({
      id: 'away-0',
      teamId: 'away',
      role: 'GK',
      position: { q: 36, r: 13 },
    }); // GK included
    const homeTeammate = makePiece({ id: 'home-2', teamId: 'home', position: { q: 28, r: 13 } }); // same team — excluded
    const state = makeState({
      pieces: [homeFwd, awayLevel, awayAhead, awayBehind, awayGK, homeTeammate],
    });
    expect(opposingPiecesEqualOrAhead(state, homeFwd)).toBe(3); // awayLevel, awayAhead, awayGK
  });

  it('away piece: counts home pieces with q <= piece.q', () => {
    const awayFwd = makePiece({ id: 'away-1', teamId: 'away', position: { q: 10, r: 13 } });
    const homeLevel = makePiece({ id: 'home-1', teamId: 'home', position: { q: 10, r: 13 } }); // equal — counts
    const homeAhead = makePiece({ id: 'home-2', teamId: 'home', position: { q: 5, r: 13 } }); // ahead (lower q) — counts
    const homeBehind = makePiece({ id: 'home-3', teamId: 'home', position: { q: 15, r: 13 } }); // behind — doesn't count
    const state = makeState({ pieces: [awayFwd, homeLevel, homeAhead, homeBehind] });
    expect(opposingPiecesEqualOrAhead(state, awayFwd)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isOffsideNow — boundary conditions for all three D-21 conditions
// ---------------------------------------------------------------------------

describe('isOffsideNow', () => {
  it('true: past halfway, ahead of ball, exactly 1 opposing piece equal-or-ahead', () => {
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null };
    const oneDefender = makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 13 } });
    const state = makeState({ pieces: [attacker, oneDefender], ball });
    expect(isOffsideNow(state, attacker)).toBe(true);
  });

  it('false: exactly on halfway (not past)', () => {
    const attacker = makePiece({
      id: 'home-1',
      teamId: 'home',
      position: { q: OFFSIDE_HALFWAY_Q, r: 13 },
    });
    const ball = { position: { q: 12, r: 13 }, carrierId: null };
    const state = makeState({ pieces: [attacker], ball });
    expect(isOffsideNow(state, attacker)).toBe(false);
  });

  it('false: exactly level with ball (not strictly ahead)', () => {
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const ball = { position: { q: 25, r: 13 }, carrierId: null };
    const state = makeState({ pieces: [attacker], ball });
    expect(isOffsideNow(state, attacker)).toBe(false);
  });

  it('false: exactly 2 opposing pieces equal-or-ahead (not <=1)', () => {
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null };
    const defenderOne = makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 13 } });
    const defenderTwo = makePiece({ id: 'away-2', teamId: 'away', position: { q: 26, r: 13 } });
    const state = makeState({ pieces: [attacker, defenderOne, defenderTwo], ball });
    expect(isOffsideNow(state, attacker)).toBe(false);
  });

  it('false: zero opposing pieces equal-or-ahead still counts as <=1 (true)', () => {
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null };
    const state = makeState({ pieces: [attacker], ball });
    expect(isOffsideNow(state, attacker)).toBe(true);
  });

  it('D-24: a defending-team piece is flagged when it pushes past the ball with <=1 opponent equal-or-ahead (team-relative)', () => {
    // "Defender" relative to the away team's attacking direction is a home piece.
    const awayDefenderPushingUp = makePiece({
      id: 'away-1',
      teamId: 'away',
      position: { q: 10, r: 13 },
    });
    const ball = { position: { q: 15, r: 13 }, carrierId: null };
    const oneHomeOpponent = makePiece({ id: 'home-1', teamId: 'home', position: { q: 5, r: 13 } });
    const state = makeState({ pieces: [awayDefenderPushingUp, oneHomeOpponent], ball });
    expect(isOffsideNow(state, awayDefenderPushingUp)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isClearedNow — D-22 logical complement
// ---------------------------------------------------------------------------

describe('isClearedNow', () => {
  it('true: equal-or-behind the ball', () => {
    const piece = makePiece({ id: 'home-1', teamId: 'home', position: { q: 20, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null }; // equal
    const state = makeState({ pieces: [piece], ball });
    expect(isClearedNow(state, piece)).toBe(true);
  });

  it('true: strictly behind the ball', () => {
    const piece = makePiece({ id: 'home-1', teamId: 'home', position: { q: 15, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null };
    const state = makeState({ pieces: [piece], ball });
    expect(isClearedNow(state, piece)).toBe(true);
  });

  it('true: ahead of ball but >=2 opposing pieces equal-or-ahead', () => {
    const piece = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null };
    const defenderOne = makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 13 } });
    const defenderTwo = makePiece({ id: 'away-2', teamId: 'away', position: { q: 26, r: 13 } });
    const state = makeState({ pieces: [piece, defenderOne, defenderTwo], ball });
    expect(isClearedNow(state, piece)).toBe(true);
  });

  it('false: ahead of ball AND <=1 opposing pieces equal-or-ahead', () => {
    const piece = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null };
    const oneDefender = makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 13 } });
    const state = makeState({ pieces: [piece, oneDefender], ball });
    expect(isClearedNow(state, piece)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateOffside — sticky carry-forward (D-23) and both clear conditions (D-22)
// ---------------------------------------------------------------------------

describe('evaluateOffside', () => {
  it('flags a newly-offside piece not previously in offsidePieceIds', () => {
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null };
    const oneDefender = makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 13 } });
    const state = makeState({ pieces: [attacker, oneDefender], ball, offsidePieceIds: [] });
    expect(evaluateOffside(state)).toEqual(['home-1']);
  });

  it('sticky: a flagged id that is neither cleared nor currently-offside stays flagged', () => {
    // Piece is already flagged from a prior phase-end. It has NOT moved since (still
    // ahead of ball, still <=1 opposing equal-or-ahead) — isOffsideNow is also true here,
    // but the key assertion is the id persists via the sticky set regardless.
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null };
    const oneDefender = makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 13 } });
    const state = makeState({
      pieces: [attacker, oneDefender],
      ball,
      offsidePieceIds: ['home-1'],
    });
    expect(evaluateOffside(state)).toEqual(['home-1']);
  });

  it('clear (a): a flagged id that becomes equal-or-behind the ball is dropped', () => {
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 18, r: 13 } }); // dropped back
    const ball = { position: { q: 20, r: 13 }, carrierId: null }; // now behind ball
    const state = makeState({
      pieces: [attacker],
      ball,
      offsidePieceIds: ['home-1'],
    });
    expect(evaluateOffside(state)).toEqual([]);
  });

  it('clear (b): a flagged id with >=2 opponents equal-or-ahead is dropped', () => {
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null }; // still ahead of ball
    const defenderOne = makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 13 } });
    const defenderTwo = makePiece({ id: 'away-2', teamId: 'away', position: { q: 26, r: 13 } });
    const state = makeState({
      pieces: [attacker, defenderOne, defenderTwo],
      ball,
      offsidePieceIds: ['home-1'],
    });
    expect(evaluateOffside(state)).toEqual([]);
  });

  it('D-24: flags a defending-team piece team-relatively (defender pushed forward)', () => {
    const awayDefenderPushingUp = makePiece({
      id: 'away-1',
      teamId: 'away',
      position: { q: 10, r: 13 },
    });
    const ball = { position: { q: 15, r: 13 }, carrierId: null };
    const oneHomeOpponent = makePiece({ id: 'home-1', teamId: 'home', position: { q: 5, r: 13 } });
    const state = makeState({
      pieces: [awayDefenderPushingUp, oneHomeOpponent],
      ball,
      offsidePieceIds: [],
    });
    expect(evaluateOffside(state)).toEqual(['away-1']);
  });

  it('defaults to [] when offsidePieceIds is absent on state', () => {
    const piece = makePiece({ id: 'home-1', teamId: 'home', position: { q: 12, r: 13 } });
    const ball = { position: { q: 20, r: 13 }, carrierId: null };
    const state = makeState({ pieces: [piece], ball });
    delete (state as { offsidePieceIds?: readonly string[] }).offsidePieceIds;
    expect(evaluateOffside(state)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyEndTurn — sticky offsidePieceIds wiring (Task 2)
// ---------------------------------------------------------------------------

describe('applyEndTurn — offsidePieceIds wiring (OFFSIDE-01 D-23)', () => {
  it('flags a piece past halfway / ahead of ball / <=1 opponent ahead on ATTACKER_2 end, then clears it once dropped behind the ball', () => {
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const oneDefender = makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 13 } });
    const state = makeState({
      pieces: [attacker, oneDefender],
      ball: { position: { q: 20, r: 13 }, carrierId: null }, // attacker ahead of ball
      movementSlot: 'ATTACKER_2',
      offsidePieceIds: [],
    });

    const firstResult = applyEndTurn(state);
    expect(firstResult.ok).toBe(true);
    if (!firstResult.ok) return;
    expect(firstResult.state.phase).toBe('PASS');
    expect(firstResult.state.offsidePieceIds).toContain('home-1');

    // Follow-up: attacker drops equal-or-behind the ball; re-run applyEndTurn from a fresh
    // ATTACKER_2 slot on top of the now-flagged state — id must be cleared (sticky -> cleared).
    const droppedBack = firstResult.state.pieces.map((p) =>
      p.id === 'home-1' ? { ...p, position: { q: 18, r: 13 } } : p,
    );
    const secondState: GameState = {
      ...firstResult.state,
      pieces: droppedBack,
      ball: { position: { q: 20, r: 13 }, carrierId: null }, // attacker now behind ball (q18 < q20)
      phase: 'MOVE',
      movementSlot: 'ATTACKER_2',
    };
    const secondResult = applyEndTurn(secondState);
    expect(secondResult.ok).toBe(true);
    if (!secondResult.ok) return;
    expect(secondResult.state.offsidePieceIds).not.toContain('home-1');
  });

  it('re-evaluates offsidePieceIds on intermediate slot transitions (ATTACKER_4 -> DEFENDER_5)', () => {
    const attacker = makePiece({ id: 'home-1', teamId: 'home', position: { q: 25, r: 13 } });
    const oneDefender = makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 13 } });
    const state = makeState({
      pieces: [attacker, oneDefender],
      ball: { position: { q: 20, r: 13 }, carrierId: null },
      movementSlot: 'ATTACKER_4',
      offsidePieceIds: [],
    });
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.movementSlot).toBe('DEFENDER_5');
    expect(result.state.offsidePieceIds).toContain('home-1');
  });
});
