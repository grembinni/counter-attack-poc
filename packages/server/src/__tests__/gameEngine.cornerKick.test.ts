import { describe, it, expect } from 'vitest';
import { triggerOutOfBoundsRestart } from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';
import { isPitchHex, CORNER_KICK_HEX, GOAL_KICK_RESTART_HEX } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Test fixtures — mirrors gameEngine.outOfBounds.test.ts's fixture shapes
// (same piece attribute set, same baseLooseBallState skeleton) so both files
// stay consistent without importing across test files.
// ---------------------------------------------------------------------------

const homePiece: PlayerPiece = {
  id: 'home-9',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'FWD',
  number: 10,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 20, r: 10 },
  pace: 9,
  shooting: 9,
  tackling: 1,
  dribbling: 8,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 6,
  highPass: 5,
};

const awayPiece: PlayerPiece = {
  id: 'away-9',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'FWD',
  number: 10,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 16, r: 16 },
  pace: 9,
  shooting: 9,
  tackling: 1,
  dribbling: 8,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 6,
  highPass: 5,
};

const homeGK: PlayerPiece = {
  id: 'home-gk',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 3, r: 5 },
  pace: 4,
  shooting: 1,
  tackling: 2,
  dribbling: 2,
  saving: 8,
  handling: 8,
  resilience: 6,
  aerialAbility: 5,
  highPass: 0,
};

const awayGK: PlayerPiece = {
  id: 'away-gk',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 33, r: 5 },
  pace: 4,
  shooting: 1,
  tackling: 2,
  dribbling: 2,
  saving: 8,
  handling: 8,
  resilience: 6,
  aerialAbility: 5,
  highPass: 0,
};

/** Minimal LOOSE_BALL-phase fixture, modelled on gameEngine.outOfBounds.test.ts's baseLooseBallState. */
const baseLooseBallState: GameState = {
  roomCode: 'CK01',
  phase: 'LOOSE_BALL',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homePiece, awayPiece, homeGK, awayGK],
  ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
  score: { home: 0, away: 0 },
  actionCount: 10,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  ballZone: 'middle',
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' },
  selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
  gameSpeed: 'standard',
};

// ---------------------------------------------------------------------------
// Task 1: triggerOutOfBoundsRestart CORNER_KICK branch (OOB-03)
// ---------------------------------------------------------------------------

describe('triggerOutOfBoundsRestart CORNER_KICK branch (OOB-03)', () => {
  it('awards a corner to AWAY when a HOME byline exit follows a HOME (defending) touch — team inversion', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' }, // home is the byline owner at q<0
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.cornerKickTeam).toBe('away');
    expect(result!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('awards a corner to HOME when an AWAY byline exit follows an AWAY (defending) touch — mirror case', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 35, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' }, // away is the byline owner at q>36
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: 37, r: 13 }, { q: 36, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.cornerKickTeam).toBe('home');
    expect(result!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('sets attackingTeam and activeTeam to cornerKickTeam', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.attackingTeam).toBe('away');
    expect(result!.activeTeam).toBe('away');
  });

  it('resolves cornerKickHex to the nearer of top/bottom corners by lastInBoundsHex distance (bottom nearer)', () => {
    // lastInBoundsHex (0,24) is nearer CORNER_KICK_HEX.home.bottom {q:0,r:25} than .top {q:0,r:1}.
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 24 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 24 }, { q: 0, r: 24 });
    expect(result).not.toBeNull();
    expect(result!.cornerKickHex).toEqual(CORNER_KICK_HEX.home.bottom);
  });

  it('resolves cornerKickHex to the nearer top corner when lastInBoundsHex is nearer the top', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 3 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 3 }, { q: 0, r: 3 });
    expect(result).not.toBeNull();
    expect(result!.cornerKickHex).toEqual(CORNER_KICK_HEX.home.top);
  });

  it('resolves an exact-tie distance to the top corner (deterministic default)', () => {
    // Midpoint between r=1 and r=25 is r=13 — equidistant from both corners.
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.cornerKickHex).toEqual(CORNER_KICK_HEX.home.top);
  });

  it('relocates cornerKickHex to the nearest free on-pitch hex when the preferred corner is occupied — no two pieces share a coordinate', () => {
    const state: GameState = {
      ...baseLooseBallState,
      pieces: baseLooseBallState.pieces.map((p) =>
        p.id === awayPiece.id ? { ...p, position: CORNER_KICK_HEX.home.top } : p,
      ),
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.cornerKickHex).not.toEqual(CORNER_KICK_HEX.home.top);
    expect(isPitchHex(result!.cornerKickHex!)).toBe(true);
    const occupied = result!.pieces.map((p) => `${p.position.q},${p.position.r}`);
    expect(new Set(occupied).size).toBe(occupied.length);
  });

  it('sets ball.position to the resolved corner hex, ball.carrierId to null, and preserves ball.lastTouchedBy', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.ball.position).toEqual(result!.cornerKickHex);
    expect(result!.ball.carrierId).toBeNull();
    expect(result!.ball.lastTouchedBy).toEqual({ pieceId: homePiece.id, teamId: 'home' });
  });

  it('appends an OUT_OF_BOUNDS event with restart CORNER_KICK and awardedTo cornerKickTeam', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    const oobEvent = result!.eventLog.find((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvent).toMatchObject({
      type: 'OUT_OF_BOUNDS',
      restart: 'CORNER_KICK',
      awardedTo: 'away',
      kind: 'BYLINE',
    });
  });

  it('initializes every cornerKick* field (no stale value from a prior corner survives)', () => {
    const state: GameState = {
      ...baseLooseBallState,
      // Simulate stale leftovers from a prior corner kick.
      cornerKickTeam: 'home',
      cornerKickHex: { q: 99, r: 99 },
      cornerKickTakerId: 'stale-piece',
      cornerKickEligibleIds: { attacking: ['x'], defending: ['y'] },
      cornerKickStageIndex: 3,
      cornerKickStagePlacedIds: ['stale'],
      cornerKickUsedPace: { stale: 4 },
      cornerKickMoveSlot: 'DEFENDER',
      cornerKickMovedPieceId: 'stale-mover',
      cornerKickPaceUsed: 2,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.cornerKickTakerId).toBeNull();
    expect(result!.cornerKickEligibleIds).toBeNull();
    expect(result!.cornerKickStageIndex).toBeNull();
    expect(result!.cornerKickStagePlacedIds).toBeNull();
    expect(result!.cornerKickUsedPace).toBeNull();
    expect(result!.cornerKickMoveSlot).toBeNull();
    expect(result!.cornerKickMovedPieceId).toBeNull();
    expect(result!.cornerKickPaceUsed).toBe(0);
  });

  it('clears movement/dice/shot-path bookkeeping (commonReset) on a corner-kick restart', () => {
    const state: GameState = {
      ...baseLooseBallState,
      phase: 'MOVE',
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
      movedPieceIds: [homePiece.id],
      paceUsedByPieceId: { [homePiece.id]: 2 },
      movementSlot: 'ATTACKER_4',
      stealAttemptedByIds: [homePiece.id],
      tackleAttemptedByIds: [awayPiece.id],
      lastShotPath: [{ q: 1, r: 1 }],
      lastActionType: 'DEFLECTION',
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.movementSlot).toBeNull();
    expect(result!.movedPieceIds).toEqual([]);
    expect(result!.paceUsedByPieceId).toEqual({});
    expect(result!.stealAttemptedByIds).toEqual([]);
    expect(result!.tackleAttemptedByIds).toEqual([]);
    expect(result!.lastShotPath).toBeNull();
    expect(result!.lastActionType).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Regression: sideline/goal-kick paths must be byte-for-byte unaffected
  // -------------------------------------------------------------------------

  it('regression: a SIDELINE exit still produces THROW_IN_SETUP', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 18, r: 1 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: 18, r: -1 }, { q: 18, r: 0 });
    expect(result).not.toBeNull();
    expect(result!.phase).toBe('THROW_IN_SETUP');
  });

  it('regression: a byline exit after an ATTACKING touch still produces GOAL_KICK_SETUP_GK', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' }, // away attacked into home's byline
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.phase).toBe('GOAL_KICK_SETUP_GK');
    expect(result!.goalKickTeam).toBe('home');
    expect(result!.ball.position).toEqual(GOAL_KICK_RESTART_HEX.home);
  });
});
