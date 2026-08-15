import { describe, it, expect } from 'vitest';
import {
  applyGoalKickMoveEnd,
  applyCornerKickFinalSetupEnd,
  applyFreeKickReady,
  applyPenaltyKickDuel,
} from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';
import { computeCombinedScore } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Task 3 (39-18): gameEngine.restartTimeCost.test.ts — 39-UAT gap 9. Corner kick,
// free kick and penalty kick each now charge the same flat +1 minute clock cost
// applyGoalKickMoveEnd's teardown already charges for goal kicks (the pre-existing
// precedent all three are matched to). Every hex literal below is either
// {q:10,r:7}/{q:11,r:7}/{q:12,r:7} — the exact adjacency already exercised by
// gameEngine.fouls.test.ts/gameEngine.test.ts's steal/tackle suites — or a bare
// pace/dice value, never an invented placeholder coordinate (STATE.md's pitfall).
// ---------------------------------------------------------------------------

/** Compact PlayerPiece fixture factory, mirroring gameEngine.fouls.test.ts's shape. */
function piece(
  id: string,
  teamId: 'home' | 'away',
  position: HexCoord,
  over: Partial<PlayerPiece> = {},
): PlayerPiece {
  return {
    id,
    teamId,
    position,
    firstName: teamId === 'home' ? 'Home' : 'Away',
    lastName: id.toUpperCase(),
    number: 9,
    nationality: 'Test',
    role: 'FWD',
    pace: 6,
    shooting: 5,
    tackling: 4,
    dribbling: 4,
    saving: 5,
    handling: 1,
    resilience: 4,
    aerialAbility: 4,
    highPass: 1,
    ...over,
  };
}

function baseState(pieces: PlayerPiece[], over: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'CLOCK1',
    phase: 'MOVE',
    activeTeam: 'home',
    attackingTeam: 'home',
    pieces,
    ball: { position: { q: 10, r: 7 }, carrierId: null, lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 10,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 4 },
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
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Goal kick (characterisation — locks in the PRE-EXISTING behaviour the other
// three restarts are matched to; this plan does not modify applyGoalKickMoveEnd).
// ---------------------------------------------------------------------------

describe('Goal kick: actionCount +1 (characterisation of pre-existing behaviour)', () => {
  it('OPP-slot inaccurate kick (LOOSE_BALL) charges +1 minute via the shared teardown', () => {
    const gk = piece('gk-away', 'away', { q: 12, r: 7 }, { role: 'GK', highPass: 1 });
    const state = baseState([gk], {
      phase: 'GOAL_KICK_MOVE',
      goalKickMoveSlot: 'OPP',
      goalKickTeam: 'away',
      goalKickGkId: gk.id,
      goalKickTargetHex: { q: 11, r: 7 },
      activeTeam: 'home',
    });
    // gk.highPass=1, kickDie=1 -> combined 2, well below the GOALKICK-03 threshold of 8.
    const result = applyGoalKickMoveEnd(state, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.actionCount).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// Corner kick: only the DEFENDER-slot terminal return charges +1; the ATTACKER-slot
// handoff must stay at +0 (otherwise a corner would cost 2 minutes).
// ---------------------------------------------------------------------------

describe('Corner kick: actionCount +1 only at the DEFENDER-slot terminal return', () => {
  it('ATTACKER-slot handoff leaves actionCount UNCHANGED', () => {
    const state = baseState([], {
      phase: 'CORNER_KICK_FINAL_SETUP',
      cornerKickTeam: 'away',
      cornerKickMoveSlot: 'ATTACKER',
      cornerKickMovedPieceId: null,
      cornerKickPaceUsed: 0,
      activeTeam: 'away',
    });
    const result = applyCornerKickFinalSetupEnd(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.cornerKickMoveSlot).toBe('DEFENDER');
    expect(result.state.actionCount).toBe(10); // unchanged
  });

  it('DEFENDER-slot terminal return (transition to PASS) charges +1', () => {
    const state = baseState([], {
      phase: 'CORNER_KICK_FINAL_SETUP',
      cornerKickTeam: 'away',
      cornerKickMoveSlot: 'DEFENDER',
      cornerKickMovedPieceId: null,
      cornerKickPaceUsed: 0,
      activeTeam: 'home',
    });
    const result = applyCornerKickFinalSetupEnd(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('CORNER_KICK_RESTART');
    expect(result.state.actionCount).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// Free kick: only the stageIndex===3 terminal return charges +1; the three
// stageIndex<3 stage-advance returns must stay at +0.
// ---------------------------------------------------------------------------

describe('Free kick: actionCount +1 only at the stageIndex===3 terminal return', () => {
  it('a stageIndex<3 stage-advance leaves actionCount UNCHANGED', () => {
    const state = baseState([], {
      phase: 'FREE_KICK_SETUP',
      freeKickHex: { q: 10, r: 7 },
      freeKickAttackingTeam: 'home',
      freeKickStageIndex: 0,
      freeKickPlacedPieceIds: [],
      activeTeam: 'home',
    });
    // Stage 0 is 'kicking' -> active team is freeKickAttackingTeam ('home').
    const result = applyFreeKickReady(state, 'home');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.freeKickStageIndex).toBe(1);
    expect(result.state.actionCount).toBe(10); // unchanged
  });

  it('the stageIndex===3 terminal return (transition to PASS) charges +1', () => {
    const state = baseState([], {
      phase: 'FREE_KICK_SETUP',
      freeKickHex: { q: 10, r: 7 },
      freeKickAttackingTeam: 'home',
      freeKickStageIndex: 3,
      freeKickPlacedPieceIds: [],
      activeTeam: 'away', // stage 3 is 'defending' -> opposite of freeKickAttackingTeam
    });
    // Stage 3 is 'defending' -> active team is the opposite of freeKickAttackingTeam ('away').
    const result = applyFreeKickReady(state, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('FREE_KICK_RESTART');
    expect(result.state.actionCount).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// Penalty kick: all three terminal branches (GOAL, SAVED, TIE) charge +1,
// regardless of outcome.
// ---------------------------------------------------------------------------

describe('Penalty kick: actionCount +1 on all three terminal outcomes', () => {
  const taker = piece('pk-taker', 'home', { q: 10, r: 7 }, { shooting: 5 });
  const gk = piece('pk-gk', 'away', { q: 12, r: 7 }, { role: 'GK', saving: 5 });

  function penaltyState(over: Partial<GameState> = {}): GameState {
    return baseState([taker, gk], {
      phase: 'PENALTY_KICK',
      penaltyKickTeam: 'home',
      penaltyKickSpot: { q: 12, r: 7 },
      penaltyKickEligibleIds: null,
      penaltyKickUsedPace: {},
      penaltyKickTakerId: taker.id,
      attackingTeam: 'home',
      activeTeam: 'home',
      ball: { position: { q: 12, r: 7 }, carrierId: taker.id, lastTouchedBy: null },
      ...over,
    });
  }

  it('GOAL: taker combined > gk combined charges +1 (transition to KICK_OFF_SETUP)', () => {
    const takerDie = 6;
    const gkDie = 6;
    expect(computeCombinedScore(taker.shooting, takerDie, [])).toBeGreaterThan(
      computeCombinedScore(gk.saving, gkDie, [-2]),
    );
    const result = applyPenaltyKickDuel(penaltyState(), takerDie, gkDie);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('KICK_OFF_SETUP');
    expect(result.state.actionCount).toBe(11);
  });

  it('SAVED: gk combined > taker combined charges +1 (transition to GK_RESTART)', () => {
    const takerDie = 1;
    const gkDie = 6;
    expect(computeCombinedScore(gk.saving, gkDie, [-2])).toBeGreaterThan(
      computeCombinedScore(taker.shooting, takerDie, []),
    );
    const result = applyPenaltyKickDuel(penaltyState(), takerDie, gkDie);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_RESTART');
    expect(result.state.actionCount).toBe(11);
  });

  it('TIE: equal combined scores charges +1 (transition to LOOSE_BALL)', () => {
    const takerDie = 3;
    const gkDie = 5;
    expect(computeCombinedScore(taker.shooting, takerDie, [])).toBe(
      computeCombinedScore(gk.saving, gkDie, [-2]),
    );
    const result = applyPenaltyKickDuel(penaltyState(), takerDie, gkDie);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.actionCount).toBe(11);
  });
});
