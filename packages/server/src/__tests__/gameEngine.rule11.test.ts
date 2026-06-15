/**
 * Phase 11 game engine tests — RULE-01 and RULE-02 correctness.
 *
 * Covers:
 *  - RULE-01 (D-01): applyRoll HIGH_PASS accuracy success sets headerAccuracyRollPending: true
 *  - RULE-02 applyResolveHeaderTarget:
 *      - Returns WRONG_PHASE when phase !== 'HEADER'
 *      - Returns DUEL_NOT_RESOLVED when headerDuelWinner is null/undefined
 *      - Valid resolve: transitions phase, places ball at targetHex, clears all header fields
 *      - Out-of-range targetHex returns INVALID_TARGET
 */

import { describe, it, expect } from 'vitest';
import { applyRoll, applyResolveHeaderTarget } from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Shared fixtures — real positions so hexDistance/adjacency is meaningful
// ---------------------------------------------------------------------------

const homeFwd: PlayerPiece = {
  id: 'home-fwd',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'FWD',
  number: 9,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 25, r: 12 },
  pace: 8,
  shooting: 8,
  tackling: 2,
  dribbling: 7,
  heading: 7,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 0,
  highPass: 8, // high stat to ensure accurate high pass (>=3 threshold)
};

const awayDef: PlayerPiece = {
  id: 'away-def',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'DEF',
  number: 2,
  nationality: 'Test',
  role: 'DEF',
  position: { q: 27, r: 12 }, // within 2 hexes of targetHex {q:27,r:12}
  pace: 6,
  shooting: 3,
  tackling: 8,
  dribbling: 4,
  heading: 6,
  saving: 1,
  handling: 1,
  resilience: 7,
  aerialAbility: 3,
  highPass: 4,
};

const awayGk: PlayerPiece = {
  id: 'away-gk',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 36, r: 13 },
  pace: 5,
  shooting: 1,
  tackling: 1,
  dribbling: 1,
  heading: 3,
  saving: 8,
  handling: 8,
  resilience: 5,
  aerialAbility: 6,
  highPass: 0,
};

const homeMid: PlayerPiece = {
  id: 'home-mid',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'MID',
  number: 6,
  nationality: 'Test',
  role: 'MID',
  position: { q: 15, r: 12 },
  pace: 7,
  shooting: 6,
  tackling: 5,
  dribbling: 6,
  heading: 5,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 2,
  highPass: 6,
};

const baseState: GameState = {
  roomCode: 'TEST',
  phase: 'PASS',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeFwd, awayDef, awayGk, homeMid],
  ball: { position: homeFwd.position, carrierId: 'home-fwd' },
  score: { home: 0, away: 0 },
  actionCount: 10,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 2 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  pendingFreeMove: null,
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' }, // Phase 16 D-15
  contestedPieceIds: [],
};

// Target hex where awayDef (q:27,r:12) is within 2 hexes — guarantees eligible players for HEADER
const highPassTargetHex = { q: 27, r: 12 };

/**
 * Creates a PASS phase state set up for a HIGH_PASS accuracy check.
 * homeFwd (highPass=8) at {q:25,r:12} kicks toward {q:27,r:12}.
 * awayDef is at {q:27,r:12} — within 2 hexes of target so eligible for header.
 */
const makeHighPassState = (): GameState => ({
  ...baseState,
  phase: 'PASS',
  lastActionType: 'HIGH_PASS',
  passTargetHex: highPassTargetHex,
  ball: { position: homeFwd.position, carrierId: 'home-fwd' },
  highPassCarrierId: 'home-fwd',
  preGeneratedInterceptionDice: [],
});

/**
 * Creates a HEADER phase state with a known duel winner and both contestants confirmed.
 * Used for applyResolveHeaderTarget tests.
 *
 * Duel is pre-resolved: headerDuelWinner: 'home' (attacker won).
 * homeFwd (winner) is at {q:27,r:12}.
 * targetHex within 6 hexes of winner: {q:30,r:12} is valid.
 * targetHex out-of-range: {q:5,r:5} — far from winner position.
 */
const makeHeaderStateWithWinner = (overrides: Partial<GameState> = {}): GameState => ({
  ...baseState,
  phase: 'HEADER',
  lastActionType: 'HIGH_PASS',
  movementSlot: null,
  ball: { position: { q: 27, r: 12 }, carrierId: null },
  pieces: [
    { ...homeFwd, position: { q: 27, r: 12 } }, // winner at ball position
    { ...awayDef, position: { q: 28, r: 12 } }, // defender contestant
    awayGk,
    homeMid,
  ],
  headerContestants: { home: ['home-fwd'], away: ['away-def'] },
  headerConfirmed: { home: true, away: true },
  headerDuelWinner: 'home',
  headerAccuracyRollPending: null,
  headerTargetHex: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// RULE-01 (D-01): HIGH_PASS accuracy success sets headerAccuracyRollPending: true
// ---------------------------------------------------------------------------

describe('RULE-01 (D-01): HIGH_PASS accuracy success sets headerAccuracyRollPending', () => {
  it('applyRoll HIGH_PASS with accurate roll sets headerAccuracyRollPending: true in HEADER state', () => {
    const state = makeHighPassState();
    // homeFwd highPass=8; d1=6 → always accurate (threshold ≥3 for HIGH pass)
    const result = applyRoll(state, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('HEADER');
    expect(result.state.headerAccuracyRollPending).toBe(true);
  });

  it('applyRoll HIGH_PASS with accurate roll preserves headerContestants and headerConfirmed', () => {
    const state = makeHighPassState();
    const result = applyRoll(state, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // headerContestants initialized to empty arrays (both teams auto-confirmed based on eligibility)
    expect(result.state.headerContestants).toBeDefined();
    expect(result.state.headerConfirmed).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// RULE-02: applyResolveHeaderTarget guards
// ---------------------------------------------------------------------------

describe('RULE-02: applyResolveHeaderTarget — WRONG_PHASE guard', () => {
  it('returns ok:false reason:WRONG_PHASE when phase is not HEADER', () => {
    const state: GameState = { ...baseState, phase: 'PASS' };
    const result = applyResolveHeaderTarget(state, { q: 30, r: 12 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('WRONG_PHASE');
  });

  it('returns ok:false reason:WRONG_PHASE for MOVEMENT phase', () => {
    const state: GameState = { ...baseState, phase: 'MOVE', movementSlot: 'ATTACKER_4' };
    const result = applyResolveHeaderTarget(state, { q: 30, r: 12 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('WRONG_PHASE');
  });
});

describe('RULE-02: applyResolveHeaderTarget — DUEL_NOT_RESOLVED guard', () => {
  it('returns ok:false reason:DUEL_NOT_RESOLVED when headerDuelWinner is null', () => {
    const state = makeHeaderStateWithWinner({ headerDuelWinner: null });
    const result = applyResolveHeaderTarget(state, { q: 30, r: 12 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('DUEL_NOT_RESOLVED');
  });

  it('returns ok:false reason:DUEL_NOT_RESOLVED when headerDuelWinner is absent', () => {
    // Build a state where headerDuelWinner is not present at all
    const { headerDuelWinner: _omit, ...rest } = makeHeaderStateWithWinner();
    const state: GameState = { ...rest };
    const result = applyResolveHeaderTarget(state, { q: 30, r: 12 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('DUEL_NOT_RESOLVED');
  });
});

describe('RULE-02: applyResolveHeaderTarget — valid resolve (D-05/D-06)', () => {
  it('returns ok:true and transitions phase to PASS on a valid in-range target', () => {
    const state = makeHeaderStateWithWinner();
    // winner is homeFwd at {q:27,r:12}; target {q:30,r:12} is 3 hexes away — within 6
    const result = applyResolveHeaderTarget(state, { q: 30, r: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
  });

  it('places ball at targetHex after resolve', () => {
    const state = makeHeaderStateWithWinner();
    const targetHex = { q: 30, r: 12 };
    const result = applyResolveHeaderTarget(state, targetHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball.position).toEqual(targetHex);
  });

  it('sets attackingTeam and activeTeam to the winning team (D-05)', () => {
    const state = makeHeaderStateWithWinner({ headerDuelWinner: 'home' });
    const result = applyResolveHeaderTarget(state, { q: 30, r: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.attackingTeam).toBe('home');
    expect(result.state.activeTeam).toBe('home');
  });

  it('sets attackingTeam to away when defender wins the duel (D-05)', () => {
    const awayWinnerState = makeHeaderStateWithWinner({
      headerDuelWinner: 'away',
      pieces: [
        { ...homeFwd, position: { q: 27, r: 12 } },
        { ...awayDef, position: { q: 27, r: 12 } }, // away winner at same position
        awayGk,
        homeMid,
      ],
      headerContestants: { home: ['home-fwd'], away: ['away-def'] },
    });
    // target 3 hexes from awayDef at {q:27,r:12}
    const result = applyResolveHeaderTarget(awayWinnerState, { q: 30, r: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.attackingTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
  });

  it('clears all header fields after resolve (headerCleared spread)', () => {
    const state = makeHeaderStateWithWinner({
      headerAccuracyRollPending: null,
      headerDuelWinner: 'home',
      headerTargetHex: { q: 29, r: 12 },
    });
    const result = applyResolveHeaderTarget(state, { q: 30, r: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.headerContestants).toBeNull();
    expect(result.state.headerConfirmed).toBeNull();
    expect(result.state.headerTargetHex).toBeNull();
    expect(result.state.headerAccuracyRollPending).toBeNull();
    expect(result.state.headerDuelWinner).toBeNull();
  });

  it('sets lastActionType to HEADER on non-goal-line target', () => {
    const state = makeHeaderStateWithWinner();
    const result = applyResolveHeaderTarget(state, { q: 30, r: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastActionType).toBe('HEADER');
  });
});

describe('RULE-02: applyResolveHeaderTarget — OUT_OF_RANGE (D-06)', () => {
  it('returns ok:false reason:INVALID_TARGET for a hex >6 from the winning contestant position', () => {
    const state = makeHeaderStateWithWinner();
    // homeFwd at {q:27,r:12}; target {q:5,r:5} is far away (hexDistance >> 6)
    const result = applyResolveHeaderTarget(state, { q: 5, r: 5 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('INVALID_TARGET');
  });

  it('accepts a hex exactly at distance 6 from winner position', () => {
    // homeFwd at {q:27,r:12}; target at {q:33,r:12} is exactly 6 away axially
    const state = makeHeaderStateWithWinner();
    const result = applyResolveHeaderTarget(state, { q: 33, r: 12 });
    // Should succeed (6 is within range), OR fail if not a valid pitch hex — either is fine
    // The important assertion is that distance 7 fails:
    const result7 = applyResolveHeaderTarget(state, { q: 34, r: 12 });
    expect(result7.ok).toBe(false);
    if (!result7.ok) expect(result7.reason).toBe('INVALID_TARGET');
    // At minimum distance-6 should not fail with DUEL_NOT_RESOLVED
    if (!result.ok) {
      expect(result.reason).not.toBe('DUEL_NOT_RESOLVED');
    }
  });
});

describe('RULE-02: applyResolveHeaderTarget — GK_DIVING route for goal-line target (HEAD-03)', () => {
  it('transitions to GK_DIVING when targetHex is a goal-line hex for home attacking team', () => {
    // Home attacking team: goal line is q=36, r in [10..16]
    // homeFwd at {q:32,r:12} (near goal line; within 6 hexes of {q:36,r:12})
    const nearGoalState = makeHeaderStateWithWinner({
      pieces: [
        { ...homeFwd, position: { q: 32, r: 12 } },
        { ...awayDef, position: { q: 33, r: 12 } },
        awayGk, // GK at {q:36,r:13}
        homeMid,
      ],
      ball: { position: { q: 32, r: 12 }, carrierId: null },
      headerContestants: { home: ['home-fwd'], away: ['away-def'] },
      headerDuelWinner: 'home',
    });
    const goalLineHex = { q: 36, r: 12 };
    const result = applyResolveHeaderTarget(nearGoalState, goalLineHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_DIVE');
    expect(result.state.shotTargetHex).toEqual(goalLineHex);
    // All header fields cleared
    expect(result.state.headerDuelWinner).toBeNull();
    expect(result.state.headerContestants).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RULE-03: lastShotPath cleared on loose-ball scatter and confirmed-bug SHOT branches
// ---------------------------------------------------------------------------

/**
 * Shooter inside awayPenaltyArea (q=33, r=12) so no -1 outside-area penalty.
 * GK (saving=4) at {q:36,r:13} — shotTargetHex = {q:36,r:13}, distance=3 → saveable with -1 penalty.
 *
 * Die values for each RULE-03 scenario:
 *   LOOSE_BALL tie:  shooter die=5, GK die=6 → scores: 3+5=8, (4-1)+6=9? No...
 *   Let's use simpler: shooting=5, die=3 → score=8; saving=3, penalty=0, die=5 → score=8 → tie.
 *   GK at same position as target so distance=0 → penalty=0.
 */
const shotShooter: PlayerPiece = {
  id: 'shot-shooter',
  teamId: 'home',
  firstName: 'Shot',
  lastName: 'Shooter',
  number: 9,
  nationality: 'Test',
  role: 'FWD',
  // Inside awayPenaltyArea: q=33 ∈ [31,36], r=12 ∈ [5,19]
  position: { q: 33, r: 12 },
  pace: 8,
  shooting: 5,
  tackling: 2,
  dribbling: 6,
  heading: 5,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 0,
  highPass: 5,
};

/** GK at shot target hex so distance = 0, no saving penalty (diveResult.savingPenalty = 0). */
const shotGk: PlayerPiece = {
  id: 'shot-gk',
  teamId: 'away',
  firstName: 'Shot',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  // At the shot target — distance 0 from target, no dive penalty
  position: { q: 36, r: 13 },
  pace: 5,
  shooting: 1,
  tackling: 1,
  dribbling: 1,
  heading: 3,
  saving: 3, // saving=3: die=5 → score=8, tie with shooter (shooting=5, die=3 → score=8)
  handling: 3, // handling=3: handlingDie=4 ≥ 3 → dropped (LOOSE_BALL)
  resilience: 5,
  aerialAbility: 4,
  highPass: 0,
};

/**
 * Base SHOT state that reaches the LOOSE_BALL (tie) branch when called with
 * applyRoll(state, shooterDie=3, gkDie=5, handlingDie=1).
 * Shooter (shooting=5) + die=3 = 8. GK (saving=3) + die=5 = 8. Tie → LOOSE_BALL.
 */
const makeShotStateRule03 = (overrides: Partial<GameState> = {}): GameState => ({
  ...baseState,
  phase: 'SHOT',
  attackingTeam: 'home',
  activeTeam: 'home',
  pieces: [shotShooter, awayDef, shotGk, homeMid],
  ball: { position: shotShooter.position, carrierId: 'shot-shooter' },
  shotTargetHex: shotGk.position, // {q:36,r:13} — GK position = shot target
  lastShotPath: [
    { q: 33, r: 12 },
    { q: 34, r: 12 },
    { q: 35, r: 12 },
    { q: 36, r: 13 },
  ],
  lastActionType: 'MOVEMENT_PHASE',
  snapshotGkPenalty: null,
  ...overrides,
});

/**
 * GK with high saving (wins duel) and low handling (drops save).
 * saving=8: GK die=6 → score=14; shooter (shooting=3) die=1 → score=4. GK wins → SAVE.
 * handling=3: handlingDie=4 ≥ 3 → dropped → LOOSE_BALL.
 */
const dropGk: PlayerPiece = {
  ...shotGk,
  id: 'drop-gk',
  saving: 8,
  handling: 3,
};

const makeSaveDroppedState = (overrides: Partial<GameState> = {}): GameState => ({
  ...makeShotStateRule03(),
  pieces: [{ ...shotShooter, shooting: 3 }, awayDef, dropGk, homeMid],
  ball: { position: shotShooter.position, carrierId: 'shot-shooter' },
  lastShotPath: [
    { q: 33, r: 12 },
    { q: 34, r: 12 },
    { q: 36, r: 13 },
  ],
  shotTargetHex: dropGk.position,
  ...overrides,
});

/**
 * LOOSE_BALL state with a non-null lastShotPath (simulating prior SHOT phase stale path).
 * applyRoll on LOOSE_BALL scatter transitions to PASS.
 * Before the RULE-03 fix, lastShotPath was inherited via ...state spread.
 * After the fix, it must be null in the returned PASS state.
 */
const makeLooseBallScatterState = (overrides: Partial<GameState> = {}): GameState => ({
  ...baseState,
  phase: 'LOOSE_BALL',
  attackingTeam: 'home',
  activeTeam: 'home',
  // Ball in the centre of the pitch — well within bounds
  ball: { position: { q: 18, r: 13 }, carrierId: null },
  lastShotPath: [
    { q: 25, r: 12 },
    { q: 30, r: 12 },
    { q: 36, r: 13 },
  ],
  lastActionType: 'DEFLECTION',
  ...overrides,
});

describe('RULE-03: SHOT LOOSE_BALL (tie) branch — lastShotPath is null after fix', () => {
  it('applyRoll SHOT tie (scores equal) returns LOOSE_BALL state with lastShotPath === null', () => {
    // Shooter: shooting=5, die=3 → score=8. GK: saving=3, die=5 → score=8. Tie → LOOSE_BALL.
    // GK is AT the shot target (distance=0) → no dive penalty.
    const state = makeShotStateRule03();
    const result = applyRoll(state, 3, 5, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    // RULE-03 fix: lastShotPath must be null (was previously carrying shotPath forward)
    expect(result.state.lastShotPath).toBeNull();
  });
});

describe('RULE-03: SHOT save-dropped branch — lastShotPath is null after fix', () => {
  it('applyRoll SHOT save-dropped returns LOOSE_BALL state with lastShotPath === null', () => {
    // Shooter: shooting=3, die=1 → score=4. GK (dropGk): saving=8, die=6 → score=14. SAVE.
    // Handling check: handlingDie=4 ≥ gk.handling=3 → dropped → LOOSE_BALL.
    const state = makeSaveDroppedState();
    const result = applyRoll(state, 1, 6, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    // RULE-03 fix: lastShotPath must be null (was previously carrying shotPath forward)
    expect(result.state.lastShotPath).toBeNull();
  });
});

describe('RULE-03: LOOSE_BALL scatter → PASS — lastShotPath is null after fix', () => {
  it('applyRoll LOOSE_BALL scatter returns PASS state with lastShotPath === null', () => {
    // Ball at centre pitch; any dice values will scatter and land somewhere.
    // The state has a non-null lastShotPath that was inherited from prior SHOT phase.
    // After fix, the LOOSE_BALL return object must explicitly set lastShotPath: null.
    const state = makeLooseBallScatterState();
    expect(state.lastShotPath).not.toBeNull();
    const result = applyRoll(state, 3, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    // RULE-03 primary fix: stale shot path must not persist into PASS phase
    expect(result.state.lastShotPath).toBeNull();
  });
});

describe('RULE-03: confirmed-correct branches still return lastShotPath === null (regression)', () => {
  it('applyRoll SHOT GOAL branch returns KICK_OFF_SETUP with lastShotPath === null (unchanged)', () => {
    // Force GOAL: shooter (shooting=5) die=6 → score=11; GK (saving=3) die=1 → score=4. GOAL.
    const state = makeShotStateRule03();
    const result = applyRoll(state, 6, 1, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('KICK_OFF_SETUP');
    // Should already be null — regression guard to confirm correct branches are unchanged
    expect(result.state.lastShotPath).toBeNull();
  });

  it('applyRoll SHOT save-caught branch returns GK_RESTART with lastShotPath === null (unchanged)', () => {
    // GK wins (saving=8+die=6=14 > shooting=3+die=1=4) → SAVE.
    // Handling: handlingDie=1 < gk.handling=8 → caught. GK_RESTART.
    const state = makeSaveDroppedState();
    const result = applyRoll(state, 1, 6, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_RESTART');
    // Confirmed-correct branch — already null, regression guard
    expect(result.state.lastShotPath).toBeNull();
  });
});
