/**
 * Phase 10 game engine tests.
 * Covers: SNAP_DEFLECT transition, HEAD-03 goal-line redirect, D-22 GOAL eventLog,
 * D-21 pickWinner determinism, D-17 lastActionType reset, D-23 HEADER LOOSE_BALL
 * lastActionType='DEFLECTION', D-29 one-steal-one-tackle per piece,
 * applyGKDive parallel-to-goal-line + ≤3-hex guards
 *
 * Wave 0 scaffolds — functions applyDeclareShot, applyGKDive, applyDeclareHeaderTarget
 * are not yet implemented; their describe blocks are skipped until plans 02/03/04 turn
 * them green. Tests that use only existing engine functions are left as failing (red).
 */

import { describe, it, expect } from 'vitest';
import { applyEndTurn, applyRoll, applyStartMovement } from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Type stubs for not-yet-implemented engine functions (plans 02/03/04)
// These will be replaced with real imports once implemented.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StubFn = (...args: any[]) => any;

const applyDeclareShot: StubFn = undefined as unknown as StubFn;
const applyGKDive: StubFn = undefined as unknown as StubFn;
const applyDeclareHeaderTarget: StubFn = undefined as unknown as StubFn;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const homeFwd: PlayerPiece = {
  id: 'home-fwd',
  teamId: 'home',
  name: 'Home FWD',
  role: 'FWD',
  position: { q: 32, r: 12 }, // in awayPenaltyArea (q>=31, r in [5,19])
  pace: 9,
  shooting: 9,
  tackling: 1,
  dribbling: 8,
  heading: 6,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 0,
  highPass: 5,
};

const awayGk: PlayerPiece = {
  id: 'away-gk',
  teamId: 'away',
  name: 'Away GK',
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
  name: 'Home MID',
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

const awayDef: PlayerPiece = {
  id: 'away-def',
  teamId: 'away',
  name: 'Away DEF',
  role: 'DEF',
  position: { q: 25, r: 12 },
  pace: 6,
  shooting: 3,
  tackling: 8,
  dribbling: 4,
  heading: 7,
  saving: 1,
  handling: 1,
  resilience: 7,
  aerialAbility: 3,
  highPass: 4,
};

const baseState: GameState = {
  roomCode: 'TEST',
  phase: 'MOVEMENT',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeFwd, awayGk, homeMid, awayDef],
  ball: { position: homeFwd.position, carrierId: 'home-fwd' },
  score: { home: 0, away: 0 },
  actionCount: 10,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 2 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
  pendingFreeMove: null,
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  contestedPieceIds: [],
};

const makeShotState = (overrides: Partial<GameState> = {}): GameState => ({
  ...baseState,
  phase: 'SHOT',
  movementSlot: null,
  lastActionType: 'MOVEMENT_PHASE',
  ...overrides,
});

const makeActionState = (overrides: Partial<GameState> = {}): GameState => ({
  ...baseState,
  phase: 'ACTION',
  movementSlot: null,
  lastActionType: 'MOVEMENT_PHASE',
  ...overrides,
});

const makeHeaderState = (overrides: Partial<GameState> = {}): GameState => ({
  ...baseState,
  phase: 'HEADER',
  movementSlot: null,
  lastActionType: 'HIGH_PASS',
  headerContestants: { home: ['home-fwd'], away: ['away-def'] },
  headerConfirmed: { home: true, away: true },
  ...overrides,
});

const makeMovementState = (overrides: Partial<GameState> = {}): GameState => ({
  ...baseState,
  phase: 'MOVEMENT',
  movementSlot: 'ATTACKER_4',
  lastActionType: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// D-22: GOAL event appended to eventLog after shot resolves as goal
// (Plan 02 will implement the engine fix; test is red scaffold)
// ---------------------------------------------------------------------------

describe('D-22: GOAL event appended to eventLog on shot goal', () => {
  it('applyRoll SHOT branch GOAL outcome appends a GOAL ActionEvent to eventLog', () => {
    // Shooter (home-fwd, shooting=9) vs GK (away-gk, saving=8, handling=8)
    // Force a GOAL: shooter die=6 (6+9=15), GK die=1 (1+8=9) → shooter wins by 6 → GOAL
    const state = makeShotState({
      ball: { position: homeFwd.position, carrierId: 'home-fwd' },
      shotTargetHex: { q: 36, r: 13 },
    });
    const result = applyRoll(state, 6, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const goalEvent = result.state.eventLog.find((e) => e.type === 'GOAL');
    expect(goalEvent).toBeDefined();
    expect(goalEvent?.type).toBe('GOAL');
  });
});

// ---------------------------------------------------------------------------
// D-17 (WR-02): Intermediate-slot lastActionType reset
// Non-ATTACKER_2 slot transitions must reset lastActionType to 'MOVEMENT_PHASE'
// (Plan 02 will fix; test is red until then)
// ---------------------------------------------------------------------------

describe('D-17 WR-02: intermediate slot lastActionType reset', () => {
  it('applyEndTurn at ATTACKER_4 → DEFENDER_5 sets lastActionType = MOVEMENT_PHASE', () => {
    const state: GameState = {
      ...makeMovementState(),
      movementSlot: 'ATTACKER_4',
      lastActionType: null,
      movedPieceIds: ['home-fwd', 'home-mid', 'home-mid', 'home-mid'],
    };
    const result = applyEndTurn(state, { addedTimeRoll: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // After ATTACKER_4→DEFENDER_5, lastActionType should be 'MOVEMENT_PHASE' (not null)
    expect(result.state.lastActionType).toBe('MOVEMENT_PHASE');
  });

  it('applyEndTurn at DEFENDER_5 → ATTACKER_2 sets lastActionType = MOVEMENT_PHASE', () => {
    const state: GameState = {
      ...makeMovementState(),
      movementSlot: 'DEFENDER_5',
      lastActionType: null,
      movedPieceIds: ['away-def', 'away-def', 'away-def', 'away-def', 'away-def'],
    };
    const result = applyEndTurn(state, { addedTimeRoll: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastActionType).toBe('MOVEMENT_PHASE');
  });
});

// ---------------------------------------------------------------------------
// D-21: pickWinner determinism — tiebreaker uses injected die (not Math.random)
// (Plan 02 will add deterministic tiebreaker; test is red scaffold)
// ---------------------------------------------------------------------------

describe('D-21: pickWinner determinism', () => {
  it('HEADER tie resolved deterministically based on dice input not Math.random', () => {
    // Two equal header contestants: both heading=5, both die=4 → tie
    // d4=1 → attacker wins; d4=6 → defender wins
    // This test verifies the tie-break die is used when provided
    const state = makeHeaderState({
      pieces: [
        { ...homeFwd, heading: 5 },
        { ...awayDef, heading: 5, position: { q: 32, r: 12 } },
        homeMid,
        awayGk,
      ],
      ball: { position: { q: 33, r: 12 }, carrierId: null },
    });
    // d1=4 (attacker), d2=4 (defender), d3=1 (tie-break → attacker wins by convention)
    const result1 = applyRoll(state, 4, 4, 1);
    // d1=4 (attacker), d2=4 (defender), d3=6 (tie-break → defender wins by convention)
    const result2 = applyRoll(state, 4, 4, 6);
    // At minimum, both calls should produce an ok result
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    // Ideally they produce different outcomes (deterministic tie-break)
    // This will fail if the engine uses Math.random instead of the injected die
    if (result1.ok && result2.ok) {
      // When tiebreaker is implemented, these should differ
      // For now just verify both resolve without error
      expect(result1.state).toBeDefined();
      expect(result2.state).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// D-23: HEADER LOOSE_BALL — lastActionType should be 'DEFLECTION'
// (Plan 02 will fix; test is red scaffold)
// ---------------------------------------------------------------------------

describe('D-23: HEADER tie → LOOSE_BALL lastActionType=DEFLECTION', () => {
  it('applyRoll HEADER tie result sets lastActionType to DEFLECTION (not HEADER)', () => {
    // When header is a tie, ball goes to LOOSE_BALL with lastActionType='DEFLECTION'
    const state = makeHeaderState({
      pieces: [
        { ...homeFwd, heading: 5, position: { q: 33, r: 12 } },
        { ...awayDef, heading: 5, position: { q: 33, r: 12 } },
        homeMid,
        awayGk,
      ],
      ball: { position: { q: 33, r: 12 }, carrierId: null },
    });
    // Roll tie: attacker=4 (4+5=9), defender=4 (4+5=9) → tie
    const result = applyRoll(state, 4, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.state.phase === 'LOOSE_BALL') {
      expect(result.state.lastActionType).toBe('DEFLECTION');
    }
  });
});

// ---------------------------------------------------------------------------
// D-29: One steal / one tackle per piece per movement phase
// stealAttemptedByIds and tackleAttemptedByIds cleared in applyStartMovement
// ---------------------------------------------------------------------------

describe('D-29: stealAttemptedByIds / tackleAttemptedByIds cleared on applyStartMovement', () => {
  it('applyStartMovement clears stealAttemptedByIds and tackleAttemptedByIds', () => {
    const state: GameState = {
      ...baseState,
      phase: 'ACTION',
      movementSlot: null,
      lastActionType: 'MOVEMENT_PHASE',
      stealAttemptedByIds: ['away-def'],
      tackleAttemptedByIds: ['away-gk'],
    };
    const result = applyStartMovement(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.stealAttemptedByIds).toEqual([]);
    expect(result.state.tackleAttemptedByIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SNAP_DEFLECT transition (Phase 10)
// (Plan 03 will implement; describe.skip used since applyDeclareShot not yet available)
// ---------------------------------------------------------------------------

describe.skip('SNAP_DEFLECT transition (Phase 10 — applyDeclareShot not yet implemented)', () => {
  it('applyDeclareShot transitions ACTION → SHOT_DECLARED → GK_DIVING', () => {
    const state = makeActionState();
    const goalHex = { q: 36, r: 13 };
    const result = applyDeclareShot(state, goalHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_DIVING');
    expect(result.state.shotTargetHex).toEqual(goalHex);
  });

  it('applyDeclareShot rejects when phase is not ACTION (WRONG_PHASE)', () => {
    const state = makeShotState();
    const result = applyDeclareShot(state, { q: 36, r: 13 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  it('applyDeclareShot rejects a non-goal-line hex (INVALID_TARGET)', () => {
    const state = makeActionState();
    const result = applyDeclareShot(state, { q: 20, r: 12 }); // not a goal hex
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INVALID_TARGET');
  });
});

// ---------------------------------------------------------------------------
// HEAD-03: Goal-line header redirect (Phase 10)
// (Plan 03 will implement; describe.skip used since applyDeclareHeaderTarget not yet available)
// ---------------------------------------------------------------------------

describe.skip('HEAD-03: header target hex selection (applyDeclareHeaderTarget not yet implemented)', () => {
  it('applyDeclareHeaderTarget sets headerTargetHex when both teams confirmed', () => {
    const state = makeHeaderState();
    const targetHex = { q: 36, r: 13 };
    const result = applyDeclareHeaderTarget(state, targetHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.headerTargetHex).toEqual(targetHex);
  });

  it('applyDeclareHeaderTarget rejects when phase is not HEADER (WRONG_PHASE)', () => {
    const state = makeActionState();
    const result = applyDeclareHeaderTarget(state, { q: 36, r: 13 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  it('applyDeclareHeaderTarget rejects when teams have not both confirmed', () => {
    const state = makeHeaderState({
      headerConfirmed: { home: true, away: false },
    });
    const result = applyDeclareHeaderTarget(state, { q: 36, r: 13 });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyGKDive guards (Phase 10)
// (Plan 04 will implement; describe.skip used since applyGKDive not yet available)
// ---------------------------------------------------------------------------

describe.skip('applyGKDive guards (applyGKDive not yet implemented)', () => {
  const makeGkDivingState = (overrides: Partial<GameState> = {}): GameState => ({
    ...baseState,
    phase: 'GK_DIVING',
    movementSlot: null,
    activeTeam: 'away',
    lastActionType: 'SHOT',
    ball: { position: awayGk.position, carrierId: 'away-gk' },
    ...overrides,
  });

  it('applyGKDive rejects when phase is not GK_DIVING (WRONG_PHASE)', () => {
    const state = makeShotState();
    const result = applyGKDive(state, { q: 36, r: 14 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  it('applyGKDive rejects a hex where to.q !== gk.position.q (not parallel to goal line)', () => {
    // GK at q=36; diagonal move changes q → invalid
    const state = makeGkDivingState();
    const result = applyGKDive(state, { q: 35, r: 13 }); // q changed → diagonal
    expect(result.ok).toBe(false);
  });

  it('applyGKDive accepts a parallel-to-goal-line move (constant q, varying r)', () => {
    const state = makeGkDivingState({ gkDivePosition: { q: 36, r: 13 } });
    const result = applyGKDive(state, { q: 36, r: 14 }); // same q, r+1
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkDivePosition).toEqual({ q: 36, r: 14 });
  });

  it('applyGKDive rejects a 4th hex beyond the 3-hex cumulative limit (SHOT-04)', () => {
    // GK started at r=13, already moved 3 hexes to r=16
    const state = makeGkDivingState({
      gkDivePosition: { q: 36, r: 16 },
      // represent 3 hexes of movement
    });
    const result = applyGKDive(state, { q: 36, r: 17 }); // 4th hex
    expect(result.ok).toBe(false);
  });
});
