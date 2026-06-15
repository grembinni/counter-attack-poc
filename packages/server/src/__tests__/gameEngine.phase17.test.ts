/**
 * Phase 17 Wave-0 unit tests — RED state.
 *
 * Each describe block tests a Phase 17 fix that is NOT YET IMPLEMENTED.
 * These tests FAIL NOW and go GREEN when the corresponding downstream plan lands.
 *
 * Requirements covered: BUG-02, BUG-03, BUG-04, BUG-05, MOVE-06, PASS-02
 *
 * Fixture style: mirrors gameEngine.test.ts — re-use the same piece/state literals
 * rather than importing helpers that don't exist.
 */

import { describe, it, expect } from 'vitest';
import {
  applyEndTurn,
  applyUndo,
  applyRoll,
  applyMove,
  applyCancelMovement,
} from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Shared fixtures (re-used across describe blocks)
// ---------------------------------------------------------------------------

const homeFWD: PlayerPiece = {
  id: 'home-9',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'FWD',
  number: 10,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 10, r: 7 },
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

const homeMID: PlayerPiece = {
  id: 'home-2',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'MID',
  number: 6,
  nationality: 'Test',
  role: 'MID',
  // Positioned in away third (q >= 26) for MOVE-06 eligibility tests
  position: { q: 27, r: 7 },
  pace: 7,
  shooting: 5,
  tackling: 4,
  dribbling: 5,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 5,
  highPass: 5,
};

const awayGK: PlayerPiece = {
  id: 'away-0',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  // GK at q:29 near goal (away goal is right side, q ~36)
  position: { q: 29, r: 7 },
  pace: 2,
  shooting: 1,
  tackling: 4,
  dribbling: 3,
  saving: 9,
  handling: 8,
  resilience: 7,
  aerialAbility: 8,
  highPass: 0,
};

const awayDEF: PlayerPiece = {
  id: 'away-1',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'DEF',
  number: 2,
  nationality: 'Test',
  role: 'DEF',
  position: { q: 15, r: 7 },
  pace: 5,
  shooting: 3,
  tackling: 7,
  dribbling: 4,
  saving: 1,
  handling: 0,
  resilience: 7,
  aerialAbility: 6,
  highPass: 4,
};

/** Base MOVEMENT-phase state with ATTACKER_4 slot active and no moves yet. */
const baseMovementState: GameState = {
  roomCode: 'TEST17',
  phase: 'MOVE',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeFWD, awayGK, awayDEF],
  ball: { position: { q: 10, r: 7 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
  pendingFreeMove: null,
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
};

/** MOVEMENT state at ATTACKER_2 slot with pendingFreeMove set and homeMID in away third. */
const attacker2StateWithFreeMove: GameState = {
  ...baseMovementState,
  movementSlot: 'ATTACKER_2',
  pieces: [homeFWD, homeMID, awayGK, awayDEF],
  pendingFreeMove: { team: 'home', hexesAllowed: 6 },
};

/** MOVEMENT state at ATTACKER_2 slot with pendingFreeMove but NO eligible pieces in away third. */
const attacker2StateNoEligible: GameState = {
  ...baseMovementState,
  movementSlot: 'ATTACKER_2',
  // homeFWD at q:10, homeMID repositioned to mid-pitch (NOT in away third q>=26)
  pieces: [homeFWD, { ...homeMID, position: { q: 15, r: 7 } }, awayGK, awayDEF],
  pendingFreeMove: { team: 'home', hexesAllowed: 6 },
};

/** Base PASS-phase state for pass delivery tests. */
const passState: GameState = {
  roomCode: 'TEST17',
  phase: 'PASS',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeFWD, homeMID, awayGK, awayDEF],
  ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  pendingFreeMove: null,
  addedTime: null,
  lastActionType: 'MOVEMENT_PHASE',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
};

/** PASS state for FIRST_TIME_PASS: homeMID at q:17 (within standard pass range). */
const firstTimePassState: GameState = {
  ...passState,
  pieces: [homeFWD, { ...homeMID, position: { q: 17, r: 7 } }, awayGK, awayDEF],
  lastActionType: 'FIRST_TIME_PASS',
  passTargetHex: { q: 17, r: 7 },
};

/** PASS state for BUG-04: defender piece is at the target hex. */
const passToDefenderState: GameState = {
  ...passState,
  // awayDEF is at the target hex (q:14, r:7) — defender picks up ball on delivery
  pieces: [
    homeFWD,
    { ...homeMID, position: { q: 20, r: 7 } },
    awayGK,
    { ...awayDEF, position: { q: 14, r: 7 } },
  ],
  lastActionType: 'STANDARD_PASS',
  passTargetHex: { q: 14, r: 7 }, // same as awayDEF position
};

/** PASS state for BUG-04b: teammate is at the target hex.
 *  awayDEF is placed at {q:20, r:7} — far from the pass path — so no interception occurs.
 *  The occupant check (BUG-04) should set carrierId to homeMID without possession change.
 */
const passToTeammateState: GameState = {
  ...passState,
  pieces: [
    homeFWD,
    { ...homeMID, position: { q: 14, r: 7 } }, // teammate at target
    awayGK,
    { ...awayDEF, position: { q: 20, r: 7 } }, // far from pass path — no interception
  ],
  lastActionType: 'STANDARD_PASS',
  passTargetHex: { q: 14, r: 7 }, // same as homeMID position
};

/** HIGH_PASS_MOVEMENT state with one HP_REPOSITION event in the log. */
const highPassMovementStateWithMove: GameState = {
  roomCode: 'TEST17',
  phase: 'HIGH_PASS_MOVE',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeFWD, awayGK, awayDEF],
  ball: { position: { q: 10, r: 7 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [
    // HP_REPOSITION is the slot boundary in HIGH_PASS_MOVEMENT
    {
      type: 'HP_REPOSITION',
      slot: 'ATTACKER',
      timestamp: 1000,
    } as import('@counter-attack/shared').ActionEvent,
    // A MOVE after the HP_REPOSITION boundary — should be undoable
    {
      type: 'MOVE',
      pieceId: 'home-9',
      from: { q: 10, r: 7 },
      to: { q: 11, r: 7 },
      timestamp: 2000,
    } as import('@counter-attack/shared').ActionEvent,
  ],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: { 'home-9': 1 },
  movementSlot: null,
  pendingFreeMove: null,
  addedTime: null,
  lastActionType: 'HIGH_PASS',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  highPassMovementSlot: 'ATTACKER',
  highPassMovedPieceId: 'home-9',
  highPassPaceUsed: 1,
  highPassCarrierId: 'home-9',
};

/** HIGH_PASS_MOVEMENT state with no MOVE events after the HP_REPOSITION boundary. */
const highPassMovementStateNoMove: GameState = {
  ...highPassMovementStateWithMove,
  eventLog: [
    {
      type: 'HP_REPOSITION',
      slot: 'ATTACKER',
      timestamp: 1000,
    } as import('@counter-attack/shared').ActionEvent,
    // No MOVE after the boundary — undo should return NOTHING_TO_UNDO
  ],
  paceUsedByPieceId: {},
};

/** SHOT state: GK adjacent to shooter for the save → LOOSE_BALL scenario (BUG-05). */
const shotStateNearGK: GameState = {
  roomCode: 'TEST17',
  phase: 'SHOT',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [
    { ...homeFWD, position: { q: 10, r: 7 } },
    { ...awayGK, position: { q: 11, r: 7 } }, // GK 1 hex from shooter → saveable
  ],
  ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  pendingFreeMove: null,
  addedTime: null,
  lastActionType: 'SHOT',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  shotTargetHex: { q: 32, r: 13 }, // away goal hex
  gkDivePosition: { q: 11, r: 7 },
};

// ---------------------------------------------------------------------------
// BUG-01 fixture: PASS state with lastActionType='HEADER' (won header, doing pass)
// ---------------------------------------------------------------------------

/**
 * PASS state simulating the result of a won header: lastActionType='HEADER'.
 * awayDEF at {q:12, r:8} is exactly 1 hex from {q:12, r:7} on the pass line
 * (homeFWD→homeMID: q:10→q:14, all at r:7), placing it in ZoI and making it
 * a valid interceptor. With die=6, it would auto-intercept in a normal pass.
 * With BUG-01 fix, the interception loop is skipped entirely for header passes.
 */
const headerPassState: GameState = {
  ...passState,
  pieces: [
    homeFWD,
    { ...homeMID, position: { q: 14, r: 7 } }, // target
    awayGK,
    { ...awayDEF, position: { q: 12, r: 8 } }, // 1 hex from pass line path — true interceptor
  ],
  lastActionType: 'HEADER', // won a header — pass is unblockable
  passTargetHex: { q: 14, r: 7 },
  preGeneratedInterceptionDice: [6], // die=6 would normally auto-intercept
};

// ---------------------------------------------------------------------------
// BUG-01: header pass is unblockable (interception loop skipped)
// ---------------------------------------------------------------------------

describe('Phase 17 BUG-01: header pass skips interception loop', () => {
  it('PASS with lastActionType=HEADER: ball delivers to target despite interceptor with die=6', () => {
    // awayDEF at {q:12, r:7} would intercept with die=6 (auto-intercept) in normal flow
    // BUG-01 fix: interception loop is skipped when lastActionType=HEADER
    const result = applyRoll(headerPassState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ball must be delivered to the homeMID (target-hex teammate)
    expect(result.state.ball.carrierId).toBe('home-2');
    expect(result.state.ball.position).toEqual({ q: 14, r: 7 });
    // Possession unchanged — still home team
    expect(result.state.attackingTeam).toBe('home');
  });

  it('non-header PASS: interception still fires (die=6 → interceptor gets ball)', () => {
    // Regression guard: non-header passes must still be interceptable
    const normalPassState: GameState = {
      ...headerPassState,
      lastActionType: 'STANDARD_PASS', // NOT a header pass — interception runs
      // awayDEF at {q:12,r:8} is 1 hex from path; die=6 triggers auto-interception
    };
    const result = applyRoll(normalPassState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // With die=6 and STANDARD_PASS, awayDEF (away-1) should intercept
    // (they are in ZoI of the pass path from homeFWD to homeMID)
    expect(result.state.ball.carrierId).toBe('away-1');
    expect(result.state.attackingTeam).toBe('away');
  });
});

// ---------------------------------------------------------------------------
// BUG-02: applyCancelMovement
// ---------------------------------------------------------------------------

describe('Phase 17 BUG-02: applyCancelMovement', () => {
  it('returns {ok:true, state.phase="PASS"} when paceUsedByPieceId is empty', () => {
    // Wave 0 RED — applyCancelMovement not yet exported from gameEngine
    const result = applyCancelMovement(baseMovementState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.movementSlot).toBeNull();
    expect(result.state.movedPieceIds).toEqual([]);
    expect(result.state.paceUsedByPieceId).toEqual({});
  });

  it('returns {ok:false, reason:"PIECES_ALREADY_MOVED"} when a piece has partial pace', () => {
    const stateWithMove: GameState = {
      ...baseMovementState,
      paceUsedByPieceId: { 'home-9': 2 },
    };
    const result = applyCancelMovement(stateWithMove);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('PIECES_ALREADY_MOVED');
  });

  it('returns {ok:false, reason:"WRONG_PHASE"} when phase is not MOVEMENT', () => {
    const passPhaseState: GameState = { ...baseMovementState, phase: 'PASS', movementSlot: null };
    const result = applyCancelMovement(passPhaseState);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('WRONG_PHASE');
  });
});

// ---------------------------------------------------------------------------
// BUG-03: applyUndo in HIGH_PASS_MOVEMENT phase
// ---------------------------------------------------------------------------

describe('Phase 17 BUG-03: applyUndo in HIGH_PASS_MOVEMENT', () => {
  it('reverses last MOVE when HP_REPOSITION boundary exists before it', () => {
    // Wave 0 RED — applyUndo currently returns WRONG_PHASE for HIGH_PASS_MOVEMENT
    const result = applyUndo(highPassMovementStateWithMove);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const piece = result.state.pieces.find((p) => p.id === 'home-9');
    expect(piece?.position).toEqual({ q: 10, r: 7 }); // restored to original
  });

  it('returns NOTHING_TO_UNDO when no MOVE exists after HP_REPOSITION boundary', () => {
    // Wave 0 RED — applyUndo currently returns WRONG_PHASE for HIGH_PASS_MOVEMENT
    const result = applyUndo(highPassMovementStateNoMove);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('NOTHING_TO_UNDO');
  });
});

// ---------------------------------------------------------------------------
// BUG-04: Pass delivery to occupied hex
// ---------------------------------------------------------------------------

describe('Phase 17 BUG-04: pass to occupied hex → ball pickup', () => {
  it('pass landing on defender hex: carrierId = defender id, possession flips to away', () => {
    // Wave 0 RED — currently applyRoll delivers to empty target, ignoring occupant
    const result = applyRoll(passToDefenderState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Defender (away-1) at q:14 picks up ball
    expect(result.state.ball.carrierId).toBe('away-1');
    expect(result.state.ball.position).toEqual({ q: 14, r: 7 });
    // Possession transfers to defending team
    expect(result.state.attackingTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.phase).toBe('PASS');
  });

  it('pass landing on teammate hex: carrierId = teammate id, possession unchanged', () => {
    // awayDEF at {q:20,r:7} — far from pass path; no interception occurs
    // Existing teammate lookup already finds homeMID at target; possession unchanged
    const result = applyRoll(passToTeammateState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Teammate (home-2) at q:14 picks up ball
    expect(result.state.ball.carrierId).toBe('home-2');
    expect(result.state.ball.position).toEqual({ q: 14, r: 7 });
    // Possession unchanged — still home team
    expect(result.state.attackingTeam).toBe('home');
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.phase).toBe('PASS');
  });

  it('BUG-04 occupant check: 1-hex pass, defender at target outside ZoI → defender picks up, possession flips', () => {
    // 1-hex STANDARD_PASS: from {q:10,r:7} to {q:11,r:7}.
    // travelPath = [{q:11,r:7}]. awayDEF at {q:11,r:7} has distance=0 from target path hex,
    // so distance !== 1 → NOT in ZoI → interceptors = []. Ball would deliver to carrierId=null
    // (no teammate at target) without the BUG-04 fix.
    // BUG-04 fix: occupant lookup finds awayDEF → carrierId=awayDEF.id, possession flips.
    const shortPassToDefenderState: GameState = {
      ...passState,
      pieces: [
        homeFWD, // carrier at {q:10, r:7}
        { ...homeMID, position: { q: 20, r: 7 } }, // teammate far away
        awayGK, // GK at {q:29, r:7}
        { ...awayDEF, position: { q: 11, r: 7 } }, // defender AT target, NOT in ZoI
      ],
      lastActionType: 'STANDARD_PASS',
      passTargetHex: { q: 11, r: 7 }, // 1 hex from carrier → travelPath=[{q:11}]; awayDEF dist=0
    };
    // Wave 0 RED — without BUG-04, ball.carrierId is null (no teammate lookup finds awayDEF)
    const result = applyRoll(shortPassToDefenderState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // BUG-04 occupant check: awayDEF picks up ball; possession flips to away
    expect(result.state.ball.carrierId).toBe('away-1');
    expect(result.state.ball.position).toEqual({ q: 11, r: 7 });
    expect(result.state.attackingTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.phase).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// BUG-05: After D-07 (Phase 17.1), save spill routes to GK_RESTART (not LOOSE_BALL)
// ---------------------------------------------------------------------------

describe('Phase 17 BUG-05: save dropped → GK_RESTART with GK holding ball at GK position (D-07)', () => {
  it('handling die >= handling stat (dropped) → GK_RESTART; GK holds ball at GK hex', () => {
    // GK at {q:11, r:7}; shooter at {q:10, r:7}; distance 1 → saveable (no penalty)
    // shooterDice=2: 9+2=11; gkDice=6: 9+6=15; GK wins SAVE
    // handlingDice=9: 9 >= handling=8 → DROPPED → D-07: GK_RESTART (not LOOSE_BALL)
    const result = applyRoll(shotStateNearGK, 2, 6, 9);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // D-07 fix: spill routes to GK_RESTART with GK holding the ball
    expect(result.state.phase).toBe('GK_RESTART');
    expect(result.state.ball.carrierId).toBe('away-0'); // GK holds ball
    // Ball must spawn at GK's position {q:11, r:7}, not shooter's {q:10, r:7}
    expect(result.state.ball.position).toEqual({ q: 11, r: 7 }); // GK hex
    expect(result.state.ball.position).not.toEqual({ q: 10, r: 7 }); // NOT shot origin
  });
});

// ---------------------------------------------------------------------------
// MOVE-06: FREE_MOVE phase transition in applyEndTurn
// ---------------------------------------------------------------------------

describe('Phase 17 MOVE-06: applyEndTurn FREE_MOVE transition', () => {
  it('ATTACKER_2 end with pendingFreeMove set and eligible pieces → phase FREE_MOVE', () => {
    // homeMID is at q:27 (away third, q>=26) → eligible for free move
    // Wave 0 RED — applyEndTurn currently transitions to PASS regardless of pendingFreeMove
    const result = applyEndTurn(attacker2StateWithFreeMove);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('FREE_MOVE');
    expect(result.state.freeMoveEligibleIds).toBeDefined();
    expect(result.state.freeMoveEligibleIds).not.toBeNull();
    expect(result.state.freeMoveEligibleIds).toContain('home-2');
    expect(result.state.pendingFreeMove).toBeNull();
  });

  it('ATTACKER_2 end with pendingFreeMove set but no eligible pieces → phase PASS (skip FREE_MOVE)', () => {
    // All home outfielders are NOT in the away third (q>=26)
    // Wave 0 RED — once FREE_MOVE is added, this path should short-circuit to PASS
    const result = applyEndTurn(attacker2StateNoEligible);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.pendingFreeMove).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PASS-02: applyRoll FIRST_TIME_PASS → attacker repositioning sub-state
// ---------------------------------------------------------------------------

describe('Phase 17 PASS-02: FIRST_TIME_PASS delivery enters attacker repositioning step', () => {
  it('accurate FIRST_TIME_PASS → stays phase PASS with firstTimePassStep="ATTACKER" and firstTimePassPath populated', () => {
    // homeFWD (highPass:5) at q:10; homeMID at q:17 is target
    // STANDARD/FIRST_TIME_PASS: no accuracy check — any die succeeds
    // Wave 0 RED — currently FIRST_TIME_PASS delivers ball directly (no intermediate step)
    const result = applyRoll(firstTimePassState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // PASS-02: ball stays in flight; phase stays PASS; firstTimePassStep enters ATTACKER
    expect(result.state.phase).toBe('PASS');
    expect(result.state.firstTimePassStep).toBe('ATTACKER');
    // firstTimePassPath should be populated (path from passer q:10 to target q:17)
    expect(result.state.firstTimePassPath).toBeDefined();
    expect(result.state.firstTimePassPath).not.toBeNull();
    expect((result.state.firstTimePassPath ?? []).length).toBeGreaterThan(0);
    // Ball in flight — carrierId should be null at this intermediate step
    expect(result.state.ball.carrierId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Smoke test: existing applyMove still works (prevents regression from imports above)
// ---------------------------------------------------------------------------

describe('Phase 17 smoke: applyMove regression guard', () => {
  it('applyMove still works correctly in MOVEMENT phase (import sanity check)', () => {
    const result = applyMove(baseMovementState, 'home-9', { q: 11, r: 7 });
    expect(result.ok).toBe(true);
  });
});
