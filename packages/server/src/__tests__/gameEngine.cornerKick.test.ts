import { describe, it, expect } from 'vitest';
import {
  triggerOutOfBoundsRestart,
  applyCornerKickGkPlace,
  applyCornerKickGkWindowEnd,
  applyCornerKickTakerSelect,
  computeCornerKickEligibleIds,
  applyCornerKickReposition,
  applyCornerKickStageEnd,
  applyCornerKickFinalMove,
  applyCornerKickFinalSetupEnd,
  applyRoll,
} from '../gameEngine.js';
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

// ---------------------------------------------------------------------------
// Task 2: turn-based goalkeeper reposition pair (CORNER-01, D-03/D-04)
// ---------------------------------------------------------------------------

/** Corner-kick GK reposition fixture: away is the awarded (attacking) team. */
const baseCornerGkState: GameState = {
  ...baseLooseBallState,
  phase: 'CORNER_KICK_GK_SETUP_ATTACKING',
  cornerKickTeam: 'away',
  cornerKickHex: CORNER_KICK_HEX.home.top,
  cornerKickTakerId: null,
  cornerKickEligibleIds: null,
  cornerKickStageIndex: null,
  cornerKickStagePlacedIds: null,
  cornerKickUsedPace: null,
  cornerKickMoveSlot: null,
  cornerKickMovedPieceId: null,
  cornerKickPaceUsed: 0,
  attackingTeam: 'away',
  activeTeam: 'away',
  ball: {
    position: CORNER_KICK_HEX.home.top,
    carrierId: null,
    lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
  },
};

describe('applyCornerKickGkPlace', () => {
  it('rejects WRONG_PHASE outside CORNER_KICK_GK_SETUP_ATTACKING/DEFENDING', () => {
    const state: GameState = { ...baseCornerGkState, phase: 'CORNER_KICK_TAKER_SELECT' };
    const result = applyCornerKickGkPlace(state, awayGK.id, { q: 20, r: 20 });
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects PIECE_NOT_FOUND for an unknown piece id', () => {
    const result = applyCornerKickGkPlace(baseCornerGkState, 'ghost-piece', { q: 20, r: 20 });
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('rejects NOT_GOALKEEPER for a piece whose role is not GK', () => {
    const result = applyCornerKickGkPlace(baseCornerGkState, awayPiece.id, { q: 20, r: 20 });
    expect(result).toEqual({ ok: false, reason: 'NOT_GOALKEEPER' });
  });

  it('rejects WRONG_TEAM when the piece is not the acting window team (attacking window, defending GK selected)', () => {
    const result = applyCornerKickGkPlace(baseCornerGkState, homeGK.id, { q: 20, r: 20 });
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('rejects WRONG_TEAM when the piece is not the acting window team (defending window, attacking GK selected)', () => {
    const state: GameState = { ...baseCornerGkState, phase: 'CORNER_KICK_GK_SETUP_DEFENDING' };
    const result = applyCornerKickGkPlace(state, awayGK.id, { q: 20, r: 20 });
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('accepts the defending GK during the defending window', () => {
    const state: GameState = { ...baseCornerGkState, phase: 'CORNER_KICK_GK_SETUP_DEFENDING' };
    const result = applyCornerKickGkPlace(state, homeGK.id, { q: 20, r: 20 });
    expect(result.ok).toBe(true);
  });

  it('rejects INVALID_TARGET for an off-pitch hex', () => {
    const result = applyCornerKickGkPlace(baseCornerGkState, awayGK.id, { q: -5, r: 5 });
    expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
  });

  it('rejects INVALID_TARGET for a hex occupied by another piece', () => {
    const result = applyCornerKickGkPlace(baseCornerGkState, awayGK.id, homePiece.position);
    expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
  });

  it('succeeds with an uncapped-distance placement regardless of how far the target is', () => {
    // awayGK starts at {q:33,r:5}; target is far across the pitch — no distance cap applies.
    const target = { q: 5, r: 20 };
    const result = applyCornerKickGkPlace(baseCornerGkState, awayGK.id, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = result.state.pieces.find((p) => p.id === awayGK.id)!;
    expect(moved.position).toEqual(target);
  });

  it('appends a CORNER_KICK_GK_PLACE event with side ATTACKING during the attacking window', () => {
    const target = { q: 5, r: 20 };
    const result = applyCornerKickGkPlace(baseCornerGkState, awayGK.id, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.state.eventLog.find((e) => e.type === 'CORNER_KICK_GK_PLACE');
    expect(event).toMatchObject({
      type: 'CORNER_KICK_GK_PLACE',
      pieceId: awayGK.id,
      side: 'ATTACKING',
      to: target,
    });
  });

  it('appends a CORNER_KICK_GK_PLACE event with side DEFENDING during the defending window', () => {
    const state: GameState = { ...baseCornerGkState, phase: 'CORNER_KICK_GK_SETUP_DEFENDING' };
    const target = { q: 30, r: 20 };
    const result = applyCornerKickGkPlace(state, homeGK.id, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.state.eventLog.find((e) => e.type === 'CORNER_KICK_GK_PLACE');
    expect(event).toMatchObject({
      type: 'CORNER_KICK_GK_PLACE',
      pieceId: homeGK.id,
      side: 'DEFENDING',
    });
  });

  it('allows re-placing the same goalkeeper again within the same window, overwriting its previous position', () => {
    const firstTarget = { q: 5, r: 20 };
    const first = applyCornerKickGkPlace(baseCornerGkState, awayGK.id, firstTarget);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const secondTarget = { q: 10, r: 10 };
    const second = applyCornerKickGkPlace(first.state, awayGK.id, secondTarget);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const moved = second.state.pieces.find((p) => p.id === awayGK.id)!;
    expect(moved.position).toEqual(secondTarget);
  });

  it('leaves ball.position, ball.carrierId and cornerKickHex unchanged', () => {
    const target = { q: 5, r: 20 };
    const result = applyCornerKickGkPlace(baseCornerGkState, awayGK.id, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball).toEqual(baseCornerGkState.ball);
    expect(result.state.cornerKickHex).toEqual(baseCornerGkState.cornerKickHex);
  });
});

describe('applyCornerKickGkWindowEnd', () => {
  it('rejects WRONG_PHASE outside the two GK setup phases', () => {
    const state: GameState = { ...baseCornerGkState, phase: 'CORNER_KICK_TAKER_SELECT' };
    const result = applyCornerKickGkWindowEnd(state);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('advances CORNER_KICK_GK_SETUP_ATTACKING to CORNER_KICK_GK_SETUP_DEFENDING, flipping activeTeam to the defending team', () => {
    const result = applyCornerKickGkWindowEnd(baseCornerGkState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('CORNER_KICK_GK_SETUP_DEFENDING');
    expect(result.state.activeTeam).toBe('home'); // opposite of cornerKickTeam ('away')
  });

  it('advances CORNER_KICK_GK_SETUP_DEFENDING to CORNER_KICK_TAKER_SELECT, setting activeTeam back to cornerKickTeam', () => {
    const state: GameState = {
      ...baseCornerGkState,
      phase: 'CORNER_KICK_GK_SETUP_DEFENDING',
      activeTeam: 'home',
    };
    const result = applyCornerKickGkWindowEnd(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('CORNER_KICK_TAKER_SELECT');
    expect(result.state.activeTeam).toBe('away'); // cornerKickTeam
  });

  it('confirming with zero placements made is legal in both windows (D-06)', () => {
    const attackingResult = applyCornerKickGkWindowEnd(baseCornerGkState);
    expect(attackingResult.ok).toBe(true);

    const defendingState: GameState = {
      ...baseCornerGkState,
      phase: 'CORNER_KICK_GK_SETUP_DEFENDING',
    };
    const defendingResult = applyCornerKickGkWindowEnd(defendingState);
    expect(defendingResult.ok).toBe(true);
  });

  it('leaves ball.position, ball.carrierId and cornerKickHex unchanged', () => {
    const result = applyCornerKickGkWindowEnd(baseCornerGkState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball).toEqual(baseCornerGkState.ball);
    expect(result.state.cornerKickHex).toEqual(baseCornerGkState.cornerKickHex);
  });
});

// ---------------------------------------------------------------------------
// Task 3: corner-taker selection and placement at the fixed hex (CORNER-02, D-01)
// ---------------------------------------------------------------------------

/** Corner-kick taker-select fixture: away is the awarded (attacking) team. */
const baseCornerTakerSelectState: GameState = {
  ...baseLooseBallState,
  phase: 'CORNER_KICK_TAKER_SELECT',
  cornerKickTeam: 'away',
  cornerKickHex: CORNER_KICK_HEX.home.top,
  cornerKickTakerId: null,
  cornerKickEligibleIds: null,
  cornerKickStageIndex: null,
  cornerKickStagePlacedIds: null,
  cornerKickUsedPace: null,
  cornerKickMoveSlot: null,
  cornerKickMovedPieceId: null,
  cornerKickPaceUsed: 0,
  attackingTeam: 'away',
  activeTeam: 'away',
  ball: {
    position: CORNER_KICK_HEX.home.top,
    carrierId: null,
    lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
  },
};

describe('applyCornerKickTakerSelect', () => {
  it('rejects WRONG_PHASE outside CORNER_KICK_TAKER_SELECT', () => {
    const state: GameState = { ...baseCornerTakerSelectState, phase: 'CORNER_KICK_REPOSITION' };
    const result = applyCornerKickTakerSelect(state, awayPiece.id);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects PIECE_NOT_FOUND for an unknown piece id', () => {
    const result = applyCornerKickTakerSelect(baseCornerTakerSelectState, 'ghost-piece');
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('rejects WRONG_TEAM when the chosen piece does not belong to cornerKickTeam', () => {
    const result = applyCornerKickTakerSelect(baseCornerTakerSelectState, homePiece.id);
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('allows selecting the goalkeeper as corner-taker', () => {
    const result = applyCornerKickTakerSelect(baseCornerTakerSelectState, awayGK.id);
    expect(result.ok).toBe(true);
  });

  it("on success the chosen piece's position becomes the resolved cornerKickHex", () => {
    const result = applyCornerKickTakerSelect(baseCornerTakerSelectState, awayPiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const taker = result.state.pieces.find((p) => p.id === awayPiece.id)!;
    expect(taker.position).toEqual(result.state.cornerKickHex);
  });

  it('sets ball.position/carrierId/lastTouchedBy to the taker on success', () => {
    const result = applyCornerKickTakerSelect(baseCornerTakerSelectState, awayPiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball.carrierId).toBe(awayPiece.id);
    expect(result.state.ball.position).toEqual(result.state.cornerKickHex);
    expect(result.state.ball.lastTouchedBy).toEqual({ pieceId: awayPiece.id, teamId: 'away' });
  });

  it('sets cornerKickTakerId and transitions to CORNER_KICK_REPOSITION at stage 0', () => {
    const result = applyCornerKickTakerSelect(baseCornerTakerSelectState, awayPiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.cornerKickTakerId).toBe(awayPiece.id);
    expect(result.state.phase).toBe('CORNER_KICK_REPOSITION');
    expect(result.state.cornerKickStageIndex).toBe(0);
    expect(result.state.cornerKickStagePlacedIds).toEqual([]);
    expect(result.state.cornerKickUsedPace).toEqual({});
    expect(result.state.activeTeam).toBe('away'); // stage 0 is the attacking side
  });

  it('appends a CORNER_KICK_TAKER_PLACED event with from/to/ballAfter', () => {
    const result = applyCornerKickTakerSelect(baseCornerTakerSelectState, awayPiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.state.eventLog.find((e) => e.type === 'CORNER_KICK_TAKER_PLACED');
    expect(event).toMatchObject({
      type: 'CORNER_KICK_TAKER_PLACED',
      pieceId: awayPiece.id,
      from: awayPiece.position,
      to: result.state.cornerKickHex,
      ballAfter: { position: result.state.cornerKickHex, carrierId: awayPiece.id },
    });
  });

  it('the ball and taker never disagree: pieces.find(carrierId).position deep-equals ball.position', () => {
    const result = applyCornerKickTakerSelect(baseCornerTakerSelectState, awayPiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const carrierPiece = result.state.pieces.find((p) => p.id === result.state.ball.carrierId)!;
    expect(carrierPiece.position).toEqual(result.state.ball.position);
  });

  it('re-resolves cornerKickHex against pieces EXCLUDING the taker: a goalkeeper repositioned onto the corner hex during CORNER-01 can still be selected and lands exactly on it', () => {
    // Simulate CORNER-01: awayGK was repositioned onto the corner hex.
    const state: GameState = {
      ...baseCornerTakerSelectState,
      pieces: baseCornerTakerSelectState.pieces.map((p) =>
        p.id === awayGK.id ? { ...p, position: CORNER_KICK_HEX.home.top } : p,
      ),
    };
    const result = applyCornerKickTakerSelect(state, awayGK.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The taker's own prior position (== cornerKickHex) must not block its own destination.
    expect(result.state.cornerKickHex).toEqual(CORNER_KICK_HEX.home.top);
    const taker = result.state.pieces.find((p) => p.id === awayGK.id)!;
    expect(taker.position).toEqual(CORNER_KICK_HEX.home.top);
  });

  it('relocates to the nearest free hex when the corner hex is occupied by a DIFFERENT piece', () => {
    const state: GameState = {
      ...baseCornerTakerSelectState,
      pieces: baseCornerTakerSelectState.pieces.map((p) =>
        p.id === homeGK.id ? { ...p, position: CORNER_KICK_HEX.home.top } : p,
      ),
    };
    const result = applyCornerKickTakerSelect(state, awayPiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.cornerKickHex).not.toEqual(CORNER_KICK_HEX.home.top);
    expect(isPitchHex(result.state.cornerKickHex!)).toBe(true);
    const occupied = result.state.pieces.map((p) => `${p.position.q},${p.position.r}`);
    expect(new Set(occupied).size).toBe(occupied.length);
  });

  it('wires computeCornerKickEligibleIds into the result (38-03): eligible lists exclude GKs and the taker', () => {
    const result = applyCornerKickTakerSelect(baseCornerTakerSelectState, awayPiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.cornerKickEligibleIds).not.toBeNull();
    expect(result.state.cornerKickEligibleIds!.attacking).not.toContain(awayGK.id);
    expect(result.state.cornerKickEligibleIds!.attacking).not.toContain(awayPiece.id); // taker excluded
    expect(result.state.cornerKickEligibleIds!.defending).not.toContain(homeGK.id);
    expect(result.state.cornerKickEligibleIds!.defending).toContain(homePiece.id);
  });
});

// ---------------------------------------------------------------------------
// Task 1 (38-03): computeCornerKickEligibleIds + applyCornerKickReposition
// ---------------------------------------------------------------------------

const awayPiece2: PlayerPiece = { ...awayPiece, id: 'away-8', position: { q: 10, r: 16 } };
const awayPiece3: PlayerPiece = { ...awayPiece, id: 'away-7', position: { q: 8, r: 16 } };
const awayEdge: PlayerPiece = { ...awayPiece, id: 'away-edge', position: { q: 0, r: 13 } };
const awayTaker: PlayerPiece = {
  ...awayPiece,
  id: 'away-taker',
  position: CORNER_KICK_HEX.home.top,
};
const homePiece2: PlayerPiece = { ...homePiece, id: 'home-8', position: { q: 24, r: 10 } };

describe('computeCornerKickEligibleIds', () => {
  const pieces = [
    homePiece,
    homePiece2,
    awayPiece,
    awayPiece2,
    awayPiece3,
    awayEdge,
    awayTaker,
    homeGK,
    awayGK,
  ];

  it('excludes goalkeepers and the corner-taker; partitions the rest by team', () => {
    const result = computeCornerKickEligibleIds(pieces, 'away', awayTaker.id);
    expect([...result.attacking].sort()).toEqual(
      [awayPiece.id, awayPiece2.id, awayPiece3.id, awayEdge.id].sort(),
    );
    expect([...result.defending].sort()).toEqual([homePiece.id, homePiece2.id].sort());
  });

  it('returns empty lists when every piece is a goalkeeper', () => {
    const result = computeCornerKickEligibleIds([homeGK, awayGK], 'away', null);
    expect(result.attacking).toEqual([]);
    expect(result.defending).toEqual([]);
  });
});

/** CORNER_KICK_REPOSITION fixture: away is the awarded (attacking) team, stage 0. */
const baseCornerRepositionState: GameState = {
  ...baseLooseBallState,
  phase: 'CORNER_KICK_REPOSITION',
  pieces: [
    homePiece,
    homePiece2,
    awayPiece,
    awayPiece2,
    awayPiece3,
    awayEdge,
    awayTaker,
    homeGK,
    awayGK,
  ],
  cornerKickTeam: 'away',
  cornerKickHex: CORNER_KICK_HEX.home.top,
  cornerKickTakerId: awayTaker.id,
  cornerKickEligibleIds: {
    attacking: [awayPiece.id, awayPiece2.id, awayPiece3.id, awayEdge.id],
    defending: [homePiece.id, homePiece2.id],
  },
  cornerKickStageIndex: 0,
  cornerKickStagePlacedIds: [],
  cornerKickUsedPace: {},
  cornerKickMoveSlot: null,
  cornerKickMovedPieceId: null,
  cornerKickPaceUsed: 0,
  attackingTeam: 'away',
  activeTeam: 'away', // stage 0 is the attacking side
  ball: {
    position: CORNER_KICK_HEX.home.top,
    carrierId: awayTaker.id,
    lastTouchedBy: { pieceId: awayTaker.id, teamId: 'away' },
  },
};

describe('applyCornerKickReposition', () => {
  it('rejects WRONG_PHASE outside CORNER_KICK_REPOSITION', () => {
    const state: GameState = { ...baseCornerRepositionState, phase: 'CORNER_KICK_FINAL_SETUP' };
    const result = applyCornerKickReposition(state, awayPiece.id, { q: 17, r: 16 });
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects PIECE_NOT_FOUND for an unknown piece id', () => {
    const result = applyCornerKickReposition(baseCornerRepositionState, 'ghost-piece', {
      q: 17,
      r: 16,
    });
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('rejects WRONG_TEAM when the piece does not belong to the current stage team (stage 0 is attacking/away)', () => {
    const result = applyCornerKickReposition(baseCornerRepositionState, homePiece.id, {
      q: 21,
      r: 10,
    });
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('rejects NOT_ELIGIBLE for a goalkeeper even though its team matches the acting stage', () => {
    const result = applyCornerKickReposition(baseCornerRepositionState, awayGK.id, {
      q: 34,
      r: 5,
    });
    expect(result).toEqual({ ok: false, reason: 'NOT_ELIGIBLE' });
  });

  it('rejects NOT_ELIGIBLE for the corner-taker even though its team matches the acting stage', () => {
    const result = applyCornerKickReposition(baseCornerRepositionState, awayTaker.id, {
      q: 1,
      r: 1,
    });
    expect(result).toEqual({ ok: false, reason: 'NOT_ELIGIBLE' });
  });

  it('rejects NOT_ADJACENT when hexDistance(piece.position, to) !== 1', () => {
    const result = applyCornerKickReposition(baseCornerRepositionState, awayPiece.id, {
      q: 20,
      r: 20,
    });
    expect(result).toEqual({ ok: false, reason: 'NOT_ADJACENT' });
  });

  it('rejects INVALID_TARGET for an off-pitch hex', () => {
    const result = applyCornerKickReposition(baseCornerRepositionState, awayEdge.id, {
      q: -1,
      r: 13,
    });
    expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
  });

  it('rejects INVALID_TARGET for a hex occupied by another piece', () => {
    const occupiedHex = { q: 17, r: 16 }; // adjacent to awayPiece {16,16}
    const state: GameState = {
      ...baseCornerRepositionState,
      pieces: baseCornerRepositionState.pieces.map((p) =>
        p.id === homePiece2.id ? { ...p, position: occupiedHex } : p,
      ),
    };
    const result = applyCornerKickReposition(state, awayPiece.id, occupiedHex);
    expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
  });

  it('on success moves the piece, increments cornerKickUsedPace by 1, and adds pieceId to cornerKickStagePlacedIds', () => {
    const result = applyCornerKickReposition(baseCornerRepositionState, awayPiece.id, {
      q: 17,
      r: 16,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = result.state.pieces.find((p) => p.id === awayPiece.id)!;
    expect(moved.position).toEqual({ q: 17, r: 16 });
    expect(result.state.cornerKickUsedPace).toEqual({ [awayPiece.id]: 1 });
    expect(result.state.cornerKickStagePlacedIds).toEqual([awayPiece.id]);
  });

  it('leaves phase, cornerKickStageIndex, ball, and cornerKickTakerId unchanged on a successful move', () => {
    const result = applyCornerKickReposition(baseCornerRepositionState, awayPiece.id, {
      q: 17,
      r: 16,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('CORNER_KICK_REPOSITION');
    expect(result.state.cornerKickStageIndex).toBe(0);
    expect(result.state.ball).toEqual(baseCornerRepositionState.ball);
    expect(result.state.cornerKickTakerId).toBe(awayTaker.id);
  });

  it('accepts a defending-team move during a defending stage', () => {
    const state: GameState = {
      ...baseCornerRepositionState,
      cornerKickStageIndex: 1,
      activeTeam: 'home',
    };
    const result = applyCornerKickReposition(state, homePiece.id, { q: 21, r: 10 });
    expect(result.ok).toBe(true);
  });

  it('six successive successful single-hex moves of the same piece leave cornerKickUsedPace at 6, and a seventh returns PACE_EXHAUSTED', () => {
    let state = baseCornerRepositionState;
    let pos = awayPiece.position;
    for (let i = 0; i < 6; i++) {
      const to = { q: pos.q + 1, r: pos.r };
      const result = applyCornerKickReposition(state, awayPiece.id, to);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      pos = to;
    }
    expect(state.cornerKickUsedPace?.[awayPiece.id]).toBe(6);

    const seventh = applyCornerKickReposition(state, awayPiece.id, { q: pos.q + 1, r: pos.r });
    expect(seventh).toEqual({ ok: false, reason: 'PACE_EXHAUSTED' });
  });

  it('rejects STAGE_LIMIT_REACHED for a third distinct piece in the same stage; re-moving one of the first two succeeds without growing the placed-id set', () => {
    let state = baseCornerRepositionState;

    const first = applyCornerKickReposition(state, awayPiece.id, { q: 17, r: 16 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;

    const second = applyCornerKickReposition(state, awayPiece2.id, { q: 11, r: 16 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    state = second.state;

    const third = applyCornerKickReposition(state, awayPiece3.id, { q: 9, r: 16 });
    expect(third).toEqual({ ok: false, reason: 'STAGE_LIMIT_REACHED' });

    const reMove = applyCornerKickReposition(state, awayPiece.id, { q: 18, r: 16 });
    expect(reMove.ok).toBe(true);
    if (!reMove.ok) return;
    expect(reMove.state.cornerKickStagePlacedIds).toEqual(
      expect.arrayContaining([awayPiece.id, awayPiece2.id]),
    );
    expect(reMove.state.cornerKickStagePlacedIds?.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Task 2 (38-03): applyCornerKickStageEnd
// ---------------------------------------------------------------------------

describe('applyCornerKickStageEnd', () => {
  it('rejects WRONG_PHASE outside CORNER_KICK_REPOSITION', () => {
    const state: GameState = { ...baseCornerRepositionState, phase: 'CORNER_KICK_FINAL_SETUP' };
    const result = applyCornerKickStageEnd(state, 'away');
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects WRONG_TEAM when the confirming team is not the current stage team', () => {
    const result = applyCornerKickStageEnd(baseCornerRepositionState, 'home'); // stage 0 is away
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('confirming at stage 0 advances to stage 1 and flips activeTeam to the defending team', () => {
    const result = applyCornerKickStageEnd(baseCornerRepositionState, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.cornerKickStageIndex).toBe(1);
    expect(result.state.activeTeam).toBe('home');
  });

  it('resets cornerKickStagePlacedIds to [] on every stage advance', () => {
    const state: GameState = {
      ...baseCornerRepositionState,
      cornerKickStagePlacedIds: [awayPiece.id, awayPiece2.id],
    };
    const result = applyCornerKickStageEnd(state, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.cornerKickStagePlacedIds).toEqual([]);
  });

  it('appends a CORNER_KICK_STAGE_ADVANCE event with fromStageIndex on every advance', () => {
    const result = applyCornerKickStageEnd(baseCornerRepositionState, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.state.eventLog.find((e) => e.type === 'CORNER_KICK_STAGE_ADVANCE');
    expect(event).toMatchObject({ type: 'CORNER_KICK_STAGE_ADVANCE', fromStageIndex: 0 });
  });

  it('confirming with zero pieces moved this stage is legal (D-06)', () => {
    const result = applyCornerKickStageEnd(baseCornerRepositionState, 'away');
    expect(result.ok).toBe(true);
  });

  it('does not add any piece to movedPieceIds on a stage advance', () => {
    const result = applyCornerKickStageEnd(baseCornerRepositionState, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.movedPieceIds).toEqual(baseCornerRepositionState.movedPieceIds);
  });

  it('confirming at stage index 5 transitions to CORNER_KICK_FINAL_SETUP with the pre-kick window initialized', () => {
    const state: GameState = {
      ...baseCornerRepositionState,
      cornerKickStageIndex: 5,
      activeTeam: 'home',
    };
    const result = applyCornerKickStageEnd(state, 'home');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('CORNER_KICK_FINAL_SETUP');
    expect(result.state.cornerKickStageIndex).toBeNull();
    expect(result.state.cornerKickStagePlacedIds).toBeNull();
    expect(result.state.cornerKickMoveSlot).toBe('ATTACKER');
    expect(result.state.cornerKickMovedPieceId).toBeNull();
    expect(result.state.cornerKickPaceUsed).toBe(0);
    expect(result.state.activeTeam).toBe('away'); // cornerKickTeam
  });

  it('appends CORNER_KICK_STAGE_ADVANCE on the terminal (stage 5) advance too', () => {
    const state: GameState = {
      ...baseCornerRepositionState,
      cornerKickStageIndex: 5,
      activeTeam: 'home',
    };
    const result = applyCornerKickStageEnd(state, 'home');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.state.eventLog.find((e) => e.type === 'CORNER_KICK_STAGE_ADVANCE');
    expect(event).toMatchObject({ type: 'CORNER_KICK_STAGE_ADVANCE', fromStageIndex: 5 });
  });

  it('Pitfall 4: cornerKickUsedPace persists across stage advances — 2 hexes in stage 0 + 1 hex in stage 2 => 3 total', () => {
    let state = baseCornerRepositionState;

    const move1 = applyCornerKickReposition(state, awayPiece.id, { q: 17, r: 16 });
    expect(move1.ok).toBe(true);
    if (!move1.ok) return;
    state = move1.state;

    const move2 = applyCornerKickReposition(state, awayPiece.id, { q: 18, r: 16 });
    expect(move2.ok).toBe(true);
    if (!move2.ok) return;
    state = move2.state;
    expect(state.cornerKickUsedPace?.[awayPiece.id]).toBe(2);

    const advance1 = applyCornerKickStageEnd(state, 'away');
    expect(advance1.ok).toBe(true);
    if (!advance1.ok) return;
    state = advance1.state;
    expect(state.cornerKickStageIndex).toBe(1);
    expect(state.cornerKickUsedPace?.[awayPiece.id]).toBe(2); // carried forward, not reset

    const advance2 = applyCornerKickStageEnd(state, 'home');
    expect(advance2.ok).toBe(true);
    if (!advance2.ok) return;
    state = advance2.state;
    expect(state.cornerKickStageIndex).toBe(2);
    expect(state.activeTeam).toBe('away'); // stage 2 is attacking again
    expect(state.cornerKickUsedPace?.[awayPiece.id]).toBe(2); // still carried forward

    const move3 = applyCornerKickReposition(state, awayPiece.id, { q: 19, r: 16 });
    expect(move3.ok).toBe(true);
    if (!move3.ok) return;
    expect(move3.state.cornerKickUsedPace?.[awayPiece.id]).toBe(3);
  });

  it('walks the full 6-stage sequence: attacking, defending, attacking, defending, attacking, defending', () => {
    let state = baseCornerRepositionState;
    const expectedTeams: Array<'home' | 'away'> = ['away', 'home', 'away', 'home', 'away', 'home'];
    for (let i = 0; i < 6; i++) {
      const team = expectedTeams[i]!;
      expect(state.cornerKickStageIndex).toBe(i);
      expect(state.activeTeam).toBe(team);
      const result = applyCornerKickStageEnd(state, team);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }
    expect(state.phase).toBe('CORNER_KICK_FINAL_SETUP');
  });
});

// ---------------------------------------------------------------------------
// Task 3 (38-03): applyCornerKickFinalMove + applyCornerKickFinalSetupEnd
// ---------------------------------------------------------------------------

/** CORNER_KICK_FINAL_SETUP fixture: ATTACKER slot (away, cornerKickTeam), zero moves made. */
const baseCornerFinalSetupState: GameState = {
  ...baseCornerRepositionState,
  phase: 'CORNER_KICK_FINAL_SETUP',
  cornerKickStageIndex: null,
  cornerKickStagePlacedIds: null,
  cornerKickMoveSlot: 'ATTACKER',
  cornerKickMovedPieceId: null,
  cornerKickPaceUsed: 0,
  activeTeam: 'away', // ATTACKER slot's team is cornerKickTeam
};

describe('applyCornerKickFinalMove', () => {
  it('rejects WRONG_PHASE outside CORNER_KICK_FINAL_SETUP', () => {
    const state: GameState = { ...baseCornerFinalSetupState, phase: 'CORNER_KICK_REPOSITION' };
    const result = applyCornerKickFinalMove(state, awayPiece.id, { q: 17, r: 16 });
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects PIECE_NOT_FOUND for an unknown piece id', () => {
    const result = applyCornerKickFinalMove(baseCornerFinalSetupState, 'ghost-piece', {
      q: 17,
      r: 16,
    });
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('rejects WRONG_TEAM when the piece is not the ATTACKER slot team', () => {
    const result = applyCornerKickFinalMove(baseCornerFinalSetupState, homePiece.id, {
      q: 21,
      r: 10,
    });
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('rejects WRONG_TEAM when the piece is not the DEFENDER slot team', () => {
    const state: GameState = {
      ...baseCornerFinalSetupState,
      cornerKickMoveSlot: 'DEFENDER',
      activeTeam: 'home',
    };
    const result = applyCornerKickFinalMove(state, awayPiece.id, { q: 17, r: 16 });
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('accepts a DEFENDER-slot move from the defending team', () => {
    const state: GameState = {
      ...baseCornerFinalSetupState,
      cornerKickMoveSlot: 'DEFENDER',
      activeTeam: 'home',
    };
    const result = applyCornerKickFinalMove(state, homePiece.id, { q: 21, r: 10 });
    expect(result.ok).toBe(true);
  });

  it('rejects NOT_ELIGIBLE for a goalkeeper', () => {
    const result = applyCornerKickFinalMove(baseCornerFinalSetupState, awayGK.id, {
      q: 34,
      r: 5,
    });
    expect(result).toEqual({ ok: false, reason: 'NOT_ELIGIBLE' });
  });

  it('rejects NOT_ELIGIBLE for the corner-taker', () => {
    const result = applyCornerKickFinalMove(baseCornerFinalSetupState, awayTaker.id, {
      q: 1,
      r: 1,
    });
    expect(result).toEqual({ ok: false, reason: 'NOT_ELIGIBLE' });
  });

  it('rejects PIECE_LOCKED when a different piece already moved this slot', () => {
    const state: GameState = {
      ...baseCornerFinalSetupState,
      cornerKickMovedPieceId: awayPiece2.id,
    };
    const result = applyCornerKickFinalMove(state, awayPiece.id, { q: 17, r: 16 });
    expect(result).toEqual({ ok: false, reason: 'PIECE_LOCKED' });
  });

  it('allows re-moving the already-locked piece', () => {
    const state: GameState = {
      ...baseCornerFinalSetupState,
      cornerKickMovedPieceId: awayPiece.id,
      cornerKickPaceUsed: 1,
    };
    const result = applyCornerKickFinalMove(state, awayPiece.id, { q: 17, r: 16 });
    expect(result.ok).toBe(true);
  });

  it('rejects NOT_ADJACENT when hexDistance(piece.position, to) !== 1', () => {
    const result = applyCornerKickFinalMove(baseCornerFinalSetupState, awayPiece.id, {
      q: 20,
      r: 20,
    });
    expect(result).toEqual({ ok: false, reason: 'NOT_ADJACENT' });
  });

  it('rejects INVALID_TARGET for an off-pitch hex', () => {
    const result = applyCornerKickFinalMove(baseCornerFinalSetupState, awayEdge.id, {
      q: -1,
      r: 13,
    });
    expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
  });

  it('rejects INVALID_TARGET for a hex occupied by another piece', () => {
    const occupiedHex = { q: 17, r: 16 };
    const state: GameState = {
      ...baseCornerFinalSetupState,
      pieces: baseCornerFinalSetupState.pieces.map((p) =>
        p.id === homePiece2.id ? { ...p, position: occupiedHex } : p,
      ),
    };
    const result = applyCornerKickFinalMove(state, awayPiece.id, occupiedHex);
    expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
  });

  it('rejects PACE_EXHAUSTED when cornerKickPaceUsed is already 3', () => {
    const state: GameState = {
      ...baseCornerFinalSetupState,
      cornerKickMovedPieceId: awayPiece.id,
      cornerKickPaceUsed: 3,
    };
    const result = applyCornerKickFinalMove(state, awayPiece.id, { q: 17, r: 16 });
    expect(result).toEqual({ ok: false, reason: 'PACE_EXHAUSTED' });
  });

  it('on success moves the piece, locks cornerKickMovedPieceId, and increments cornerKickPaceUsed', () => {
    const result = applyCornerKickFinalMove(baseCornerFinalSetupState, awayPiece.id, {
      q: 17,
      r: 16,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = result.state.pieces.find((p) => p.id === awayPiece.id)!;
    expect(moved.position).toEqual({ q: 17, r: 16 });
    expect(result.state.cornerKickMovedPieceId).toBe(awayPiece.id);
    expect(result.state.cornerKickPaceUsed).toBe(1);
  });

  it('appends a CORNER_KICK_MOVE event with the correct slot', () => {
    const result = applyCornerKickFinalMove(baseCornerFinalSetupState, awayPiece.id, {
      q: 17,
      r: 16,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.state.eventLog.find((e) => e.type === 'CORNER_KICK_MOVE');
    expect(event).toMatchObject({
      type: 'CORNER_KICK_MOVE',
      slot: 'ATTACKER',
      pieceId: awayPiece.id,
      to: { q: 17, r: 16 },
    });
  });

  it('three successive moves of the same piece leave cornerKickPaceUsed at 3, and a fourth returns PACE_EXHAUSTED', () => {
    let state = baseCornerFinalSetupState;
    let pos = awayPiece.position;
    for (let i = 0; i < 3; i++) {
      const to = { q: pos.q + 1, r: pos.r };
      const result = applyCornerKickFinalMove(state, awayPiece.id, to);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      pos = to;
    }
    expect(state.cornerKickPaceUsed).toBe(3);

    const fourth = applyCornerKickFinalMove(state, awayPiece.id, { q: pos.q + 1, r: pos.r });
    expect(fourth).toEqual({ ok: false, reason: 'PACE_EXHAUSTED' });
  });
});

describe('applyCornerKickFinalSetupEnd', () => {
  it('rejects WRONG_PHASE outside CORNER_KICK_FINAL_SETUP', () => {
    const state: GameState = { ...baseCornerFinalSetupState, phase: 'CORNER_KICK_REPOSITION' };
    const result = applyCornerKickFinalSetupEnd(state);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('confirming with zero moves made is legal (D-06)', () => {
    const result = applyCornerKickFinalSetupEnd(baseCornerFinalSetupState);
    expect(result.ok).toBe(true);
  });

  it('ATTACKER slot end flips to DEFENDER, resets cornerKickMovedPieceId and cornerKickPaceUsed, and sets activeTeam to the defending team', () => {
    const state: GameState = {
      ...baseCornerFinalSetupState,
      cornerKickMovedPieceId: awayPiece.id,
      cornerKickPaceUsed: 2,
    };
    const result = applyCornerKickFinalSetupEnd(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('CORNER_KICK_FINAL_SETUP');
    expect(result.state.cornerKickMoveSlot).toBe('DEFENDER');
    expect(result.state.cornerKickMovedPieceId).toBeNull();
    expect(result.state.cornerKickPaceUsed).toBe(0);
    expect(result.state.activeTeam).toBe('home');
  });

  it('DEFENDER slot end transitions to PASS with lastActionType CORNER_KICK_RESTART and cornerKickTeam preserved', () => {
    const state: GameState = {
      ...baseCornerFinalSetupState,
      cornerKickMoveSlot: 'DEFENDER',
      activeTeam: 'home',
    };
    const result = applyCornerKickFinalSetupEnd(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('CORNER_KICK_RESTART');
    expect(result.state.cornerKickTeam).not.toBeNull();
    expect(result.state.cornerKickTeam).toBe('away');
    expect(result.state.attackingTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.cornerKickMoveSlot).toBeNull();
    expect(result.state.cornerKickMovedPieceId).toBeNull();
    expect(result.state.cornerKickPaceUsed).toBe(0);
  });

  it("ball.carrierId is still the corner-taker after the DEFENDER slot's end", () => {
    const state: GameState = {
      ...baseCornerFinalSetupState,
      cornerKickMoveSlot: 'DEFENDER',
      activeTeam: 'home',
    };
    const result = applyCornerKickFinalSetupEnd(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball.carrierId).toBe(awayTaker.id);
  });

  it('preserves cornerKickHex and cornerKickTakerId across the DEFENDER slot end (Pitfall 3)', () => {
    const state: GameState = {
      ...baseCornerFinalSetupState,
      cornerKickMoveSlot: 'DEFENDER',
      activeTeam: 'home',
    };
    const result = applyCornerKickFinalSetupEnd(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.cornerKickHex).toEqual(baseCornerFinalSetupState.cornerKickHex);
    expect(result.state.cornerKickTakerId).toBe(awayTaker.id);
  });
});

// ---------------------------------------------------------------------------
// Task 1 (38-04): applyRoll PASS-case corner accuracy gate (CORNER-04/CORNER-05)
// ---------------------------------------------------------------------------

/**
 * PASS-phase fixture immediately after applyCornerKickFinalSetupEnd's DEFENDER-slot
 * terminal return (see the 'applyCornerKickFinalSetupEnd' describe block above) —
 * cornerKickTeam is preserved and every other cornerKick* field is torn down, matching
 * that function's actual terminal-return shape. `lastActionType` here represents whatever
 * the GAME_ROLL handler set (the client's chosen passType) BEFORE calling applyRoll —
 * gameHandlers.ts overwrites lastActionType with the client's choice, which is exactly why
 * the persistent `cornerKickTeam` field (not `lastActionType`) has to be the corner signal.
 */
const baseCornerPassState: GameState = {
  ...baseLooseBallState,
  phase: 'PASS',
  pieces: [
    homePiece,
    homePiece2,
    awayPiece,
    awayPiece2,
    awayPiece3,
    awayEdge,
    awayTaker,
    homeGK,
    awayGK,
  ],
  cornerKickTeam: 'away',
  cornerKickHex: CORNER_KICK_HEX.home.top,
  cornerKickTakerId: awayTaker.id,
  cornerKickEligibleIds: null,
  cornerKickStageIndex: null,
  cornerKickStagePlacedIds: null,
  cornerKickUsedPace: null,
  cornerKickMoveSlot: null,
  cornerKickMovedPieceId: null,
  cornerKickPaceUsed: 0,
  attackingTeam: 'away',
  activeTeam: 'away',
  ball: {
    position: awayTaker.position,
    carrierId: awayTaker.id,
    lastTouchedBy: { pieceId: awayTaker.id, teamId: 'away' },
  },
  // Empty hex — no piece occupies {q:5,r:13} in the fixture piece list above.
  passTargetHex: { q: 5, r: 13 },
};

/** Low corner: lastActionType is STANDARD_PASS (the client's chosen passType), cornerKickTeam set. */
const cornerLowState: GameState = {
  ...baseCornerPassState,
  lastActionType: 'STANDARD_PASS',
};

/** High corner: targetHex is homePiece2's own hex — guarantees an eligible header contestant
 * (home, distance 0) so the accurate branch reaches HEADER rather than the no-eligible LOOSE_BALL
 * fallback. */
const cornerHighState: GameState = {
  ...baseCornerPassState,
  lastActionType: 'HIGH_PASS',
  passTargetHex: homePiece2.position,
};

/** Ordinary Standard Pass — cornerKickTeam unset — the D-01/D-02 baseline behaviour that must
 * survive this plan's accuracy-gate extension untouched. */
const ordinaryStandardPassState: GameState = {
  ...baseCornerPassState,
  cornerKickTeam: null,
  lastActionType: 'STANDARD_PASS',
};

describe('applyRoll PASS-case corner accuracy gate (CORNER-04/CORNER-05, 38-04 Task 1)', () => {
  it('CORNER-04: Low corner (STANDARD_PASS + cornerKickTeam set) is accuracy-gated — die=2 (score 7 < 8) → inaccurate → LOOSE_BALL', () => {
    const result = applyRoll(cornerLowState, 2, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.lastActionType).toBe('DEFLECTION');
  });

  it('CORNER-04: Low corner die=3 (score 8 >= 8, HIGH threshold) → accurate → ball delivered; phase stays PASS (not HEADER)', () => {
    const result = applyRoll(cornerLowState, 3, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.ball.position).toEqual({ q: 5, r: 13 });
  });

  it('regression: an ordinary STANDARD_PASS with cornerKickTeam unset still always delivers, regardless of the die', () => {
    // die=1 would fail an 8+ accuracy check if this pass were (incorrectly) gated.
    const result = applyRoll(ordinaryStandardPassState, 1, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.ball.position).toEqual({ q: 5, r: 13 });
  });

  it('CORNER-05: High corner (HIGH_PASS + cornerKickTeam set) die=3 (score 8>=8) → accurate → phase HEADER via the existing unmodified transition', () => {
    const result = applyRoll(cornerHighState, 3, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('HEADER');
  });

  it('High corner die=2 (score 7 < 8) → inaccurate → LOOSE_BALL', () => {
    const result = applyRoll(cornerHighState, 2, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
  });

  it("LONG_BALL accuracy behaviour is unchanged: the corner gate doesn't leak into the LONG_BALL accuracyType branch", () => {
    const longBallState: GameState = {
      ...baseCornerPassState,
      cornerKickTeam: null,
      lastActionType: 'LONG_BALL',
      passTargetHex: { q: 30, r: 13 },
    };
    // homePiece2.highPass=5 is not the carrier here; awayTaker.highPass=5, die=3 → score 8,
    // which is < 9 (LONG_SAME_THIRD threshold) — must be inaccurate, proving LONG's own
    // threshold (not HIGH's 8) still governs when cornerKickTeam is unset.
    const result = applyRoll(longBallState, 3, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
  });

  it('inaccurate Low corner appends a CORNER_KICK_ACCURACY event (passType LOW, accurate:false) — not a malformed STANDARD_PASS event', () => {
    const result = applyRoll(cornerLowState, 2, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.filter((e) => e.type === 'STANDARD_PASS')).toHaveLength(0);
    const cornerEvent = result.state.eventLog.find((e) => e.type === 'CORNER_KICK_ACCURACY');
    expect(cornerEvent).toMatchObject({
      type: 'CORNER_KICK_ACCURACY',
      passType: 'LOW',
      accurate: false,
      takerId: awayTaker.id,
    });
  });

  it('accurate Low corner appends a CORNER_KICK_ACCURACY event (passType LOW, accurate:true) before the normal STANDARD_PASS delivery event', () => {
    const result = applyRoll(cornerLowState, 3, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const accuracyIdx = result.state.eventLog.findIndex((e) => e.type === 'CORNER_KICK_ACCURACY');
    const deliveryIdx = result.state.eventLog.findIndex((e) => e.type === 'STANDARD_PASS');
    expect(accuracyIdx).toBeGreaterThanOrEqual(0);
    expect(deliveryIdx).toBeGreaterThan(accuracyIdx);
    expect(result.state.eventLog[accuracyIdx]).toMatchObject({ passType: 'LOW', accurate: true });
  });

  it('accurate High corner appends a CORNER_KICK_ACCURACY event (passType HIGH) alongside the existing HP_ACCURACY event, without suppressing it', () => {
    const result = applyRoll(cornerHighState, 3, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cornerEvent = result.state.eventLog.find((e) => e.type === 'CORNER_KICK_ACCURACY');
    const hpEvent = result.state.eventLog.find((e) => e.type === 'HP_ACCURACY');
    expect(cornerEvent).toMatchObject({ passType: 'HIGH', accurate: true, takerId: awayTaker.id });
    expect(hpEvent).toMatchObject({ accurate: true });
  });

  it('inaccurate High corner appends both CORNER_KICK_ACCURACY (passType HIGH, false) and HP_ACCURACY (false)', () => {
    const result = applyRoll(cornerHighState, 2, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cornerEvent = result.state.eventLog.find((e) => e.type === 'CORNER_KICK_ACCURACY');
    const hpEvent = result.state.eventLog.find((e) => e.type === 'HP_ACCURACY');
    expect(cornerEvent).toMatchObject({ passType: 'HIGH', accurate: false });
    expect(hpEvent).toMatchObject({ accurate: false });
  });

  it('accurate Low corner skips the interception loop: no STEAL_ATTEMPT event even with a defender standing exactly on the target hex', () => {
    // homePiece's own hex as the target would normally be an auto-intercept (case 1, no roll)
    // for an ordinary Standard Pass — the corner bypass must skip the loop entirely so no
    // STEAL_ATTEMPT event is ever appended (Assumption A2).
    const interceptTargetState: GameState = {
      ...cornerLowState,
      passTargetHex: homePiece.position,
    };
    const result = applyRoll(interceptTargetState, 3, 3, 3); // die=3 → accurate (score 8)
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.filter((e) => e.type === 'STEAL_ATTEMPT')).toHaveLength(0);
  });
});
