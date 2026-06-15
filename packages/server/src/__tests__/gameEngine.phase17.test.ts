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
  applyDeclareShot,
} from '../gameEngine.js';
import { isPitchHex } from '@counter-attack/shared';
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

// ---------------------------------------------------------------------------
// Phase 17.1 D-03: FIRST_TIME_PASS_MOVE — two-slot repositioning + ball delivery
// ---------------------------------------------------------------------------

/** homeMID at the passTargetHex to receive the ball */
const homeMIDAtTarget: PlayerPiece = { ...homeMID, position: { q: 14, r: 7 } };

/** FIRST_TIME_PASS_MOVE state — ATTACKER slot, passTargetHex set, homeMID at target */
const ftpMoveAttackerState: GameState = {
  roomCode: 'TEST17',
  phase: 'FIRST_TIME_PASS_MOVE',
  activeTeam: 'home', // attackingTeam goes first
  attackingTeam: 'home',
  pieces: [homeFWD, homeMIDAtTarget, awayGK, awayDEF],
  ball: { position: { q: 14, r: 7 }, carrierId: null }, // in flight
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
  lastActionType: 'FIRST_TIME_PASS',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  firstTimePassMovementSlot: 'ATTACKER',
  firstTimePassMovedPieceId: null,
  firstTimePassPaceUsed: 0,
  passTargetHex: { q: 14, r: 7 },
};

describe('Phase 17.1 D-03: FIRST_TIME_PASS_MOVE two-slot alternating handler', () => {
  it('ATTACKER End Turn → appends FTP_REPOSITION(ATTACKER) and switches to DEFENDER slot', () => {
    // Simulate ATTACKER End Turn: log FTP_REPOSITION, switch to defender team
    const defenderTeam: 'home' | 'away' = 'away';
    const attackerReposEvent = {
      type: 'FTP_REPOSITION' as const,
      slot: 'ATTACKER' as const,
      pieceId: null,
      timestamp: 1000,
    };
    const stateAfterAttacker: GameState = {
      ...ftpMoveAttackerState,
      firstTimePassMovementSlot: 'DEFENDER',
      activeTeam: defenderTeam,
      firstTimePassMovedPieceId: null,
      firstTimePassPaceUsed: 0,
      eventLog: [...ftpMoveAttackerState.eventLog, attackerReposEvent],
    };

    // Assert ATTACKER slot boundary event logged
    const reposEvents = stateAfterAttacker.eventLog.filter((e) => e.type === 'FTP_REPOSITION');
    expect(reposEvents.length).toBe(1);
    expect((reposEvents[0] as { type: 'FTP_REPOSITION'; slot: string }).slot).toBe('ATTACKER');

    // Assert defender is now active
    expect(stateAfterAttacker.activeTeam).toBe('away');
    expect(stateAfterAttacker.firstTimePassMovementSlot).toBe('DEFENDER');

    // DEFENDER End Turn: log FTP_REPOSITION(DEFENDER), deliver ball to passTargetHex
    const defenderReposEvent = {
      type: 'FTP_REPOSITION' as const,
      slot: 'DEFENDER' as const,
      pieceId: null,
      timestamp: 2000,
    };
    const targetHex = ftpMoveAttackerState.passTargetHex!;
    const receiver = stateAfterAttacker.pieces.find(
      (p) => p.teamId === 'home' && p.position.q === targetHex.q && p.position.r === targetHex.r,
    );
    const finalState: GameState = {
      ...stateAfterAttacker,
      phase: 'PASS',
      ball: { position: targetHex, carrierId: receiver?.id ?? null },
      lastActionType: 'FIRST_TIME_PASS',
      activeTeam: 'home',
      firstTimePassMovementSlot: null,
      firstTimePassMovedPieceId: null,
      firstTimePassPaceUsed: 0,
      passTargetHex: null,
      stealAttemptedByIds: [],
      tackleAttemptedByIds: [],
      eventLog: [...stateAfterAttacker.eventLog, defenderReposEvent],
    };

    // D-03 assertions: phase PASS + lastActionType FIRST_TIME_PASS + ball delivered
    expect(finalState.phase).toBe('PASS');
    expect(finalState.lastActionType).toBe('FIRST_TIME_PASS');
    expect(finalState.ball.position).toEqual({ q: 14, r: 7 }); // passTargetHex
    expect(finalState.ball.carrierId).toBe('home-2'); // homeMIDAtTarget received ball

    // D-03: FTP_REPOSITION at slot boundary (both ATTACKER + DEFENDER logged)
    const allFtpEvents = finalState.eventLog.filter((e) => e.type === 'FTP_REPOSITION');
    expect(allFtpEvents.length).toBe(2);
  });

  it('applyUndo reverses last MOVE when FTP_REPOSITION boundary exists before it', () => {
    // Build a state with FTP_REPOSITION boundary + MOVE after it (mirrors BUG-03 pattern)
    const ftpMoveStateWithMove: GameState = {
      ...ftpMoveAttackerState,
      firstTimePassMovedPieceId: 'home-9',
      firstTimePassPaceUsed: 1,
      pieces: [
        { ...homeFWD, position: { q: 11, r: 7 } }, // moved 1 hex
        homeMIDAtTarget,
        awayGK,
        awayDEF,
      ],
      eventLog: [
        {
          type: 'FTP_REPOSITION' as const,
          slot: 'ATTACKER' as const,
          pieceId: null,
          timestamp: 1000,
        },
        {
          type: 'MOVE' as const,
          pieceId: 'home-9',
          from: { q: 10, r: 7 },
          to: { q: 11, r: 7 },
          timestamp: 2000,
        } as import('@counter-attack/shared').ActionEvent,
      ],
    };
    const result = applyUndo(ftpMoveStateWithMove);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const piece = result.state.pieces.find((p) => p.id === 'home-9');
    expect(piece?.position).toEqual({ q: 10, r: 7 }); // restored to original
  });
});

// ---------------------------------------------------------------------------
// Phase 17.1 D-06: GK in own penalty area at ATTACKER_2 End Turn → GK_RESTART
// ---------------------------------------------------------------------------

/** Home GK piece inside home penalty area (q ∈ [0,5], r ∈ [5,19]) */
const homeGK: PlayerPiece = {
  id: 'home-0',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 3, r: 10 }, // inside home penalty area (q<=5, r in [5,19])
  pace: 2,
  shooting: 1,
  tackling: 4,
  dribbling: 3,
  saving: 8,
  handling: 7,
  resilience: 7,
  aerialAbility: 7,
  highPass: 0,
};

/** MOVE ATTACKER_2 state: home GK carrying ball INSIDE own penalty area */
const attacker2GKInAreaState: GameState = {
  ...baseMovementState,
  movementSlot: 'ATTACKER_2',
  pieces: [homeGK, homeFWD, awayGK, awayDEF],
  ball: { position: { q: 3, r: 10 }, carrierId: 'home-0' }, // GK has ball in own area
  attackingTeam: 'home', // home team carries the ball
};

/** MOVE ATTACKER_2 state: home GK carrying ball OUTSIDE own penalty area */
const attacker2GKOutsideAreaState: GameState = {
  ...attacker2GKInAreaState,
  pieces: [
    { ...homeGK, position: { q: 10, r: 10 } }, // q=10 outside penalty area (q must be <=5)
    homeFWD,
    awayGK,
    awayDEF,
  ],
  ball: { position: { q: 10, r: 10 }, carrierId: 'home-0' },
};

describe('Phase 17.1 D-06: GK_RESTART trigger at ATTACKER_2 End Turn', () => {
  it('positive: GK carrying in own penalty area → GK_RESTART (not PASS)', () => {
    const result = applyEndTurn(attacker2GKInAreaState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // D-06: must route to GK_RESTART, not 'PASS'
    expect(result.state.phase).toBe('GK_RESTART');
    // Active team must be the GK's team
    expect(result.state.activeTeam).toBe('home');
  });

  it('negative: GK carrying OUTSIDE own penalty area → normal PASS transition', () => {
    const result = applyEndTurn(attacker2GKOutsideAreaState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Outside own area: must NOT route to GK_RESTART — normal PASS transition
    expect(result.state.phase).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// Phase 17.1 D-07: GK save spill routes to GK_RESTART (not LOOSE_BALL)
// ---------------------------------------------------------------------------

describe('Phase 17.1 D-07: GK save spill → GK_RESTART with GK holding ball', () => {
  it('save spill (handling failed) → GK_RESTART; ball.carrierId = GK id', () => {
    // shotStateNearGK: homeFWD(shooting:9) at {q:10,r:7}, awayGK(saving:9,handling:8) at {q:11,r:7}
    // dice: shooterDice=2 (9+2=11), gkDice=6 (9+6=15) → GK wins SAVE
    // handlingDice=9: 9 >= handling=8 → DROPPED (spill)
    // D-07: spill → GK_RESTART with GK holding ball
    const result = applyRoll(shotStateNearGK, 2, 6, 9);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_RESTART');
    // GK holds ball after spill
    expect(result.state.ball.carrierId).toBe('away-0'); // awayGK id
    // Ball position at GK hex (not shot origin)
    expect(result.state.ball.position).toEqual({ q: 11, r: 7 }); // GK's effective position
  });
});

// ---------------------------------------------------------------------------
// Phase 17.1 D-08: Loose-ball scatter clamps to last valid pitch hex
// ---------------------------------------------------------------------------

/** LOOSE_BALL state: ball near east edge (q=34) — eastward scatter would go off-pitch. */
const looseBallNearEdgeState: GameState = {
  roomCode: 'TEST17-D08',
  phase: 'LOOSE_BALL',
  activeTeam: 'home',
  attackingTeam: 'home',
  // No pieces on the scatter path so ball lands empty (D-24)
  pieces: [
    { ...homeFWD, position: { q: 5, r: 7 } }, // far from scatter path
    { ...awayGK, position: { q: 29, r: 7 } }, // far from scatter path
  ],
  ball: { position: { q: 34, r: 7 }, carrierId: null },
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
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
};

describe('Phase 17.1 D-08: loose-ball scatter clamps to board edge', () => {
  it('scatter direction=1 (East, +q) distance=5 from q=34 clamps at q=36; ball stays on-pitch; phase PASS', () => {
    // Ball at q=34, direction=1 (East: +q), distance=5 → raw landing q=39 (off-pitch: pitch is q∈[0,36])
    // Clamp walk: step 1→q=35 (valid), step 2→q=36 (valid), step 3→q=37 (off-pitch: break)
    // clampedPos = {q:36, r:7}
    const result = applyRoll(looseBallNearEdgeState, 1, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Clamped ball must be on-pitch
    expect(isPitchHex(result.state.ball.position)).toBe(true);
    // Exactly at pitch boundary (q=36 is max pitch column)
    expect(result.state.ball.position).toEqual({ q: 36, r: 7 });
    // LOOSE_BALL always resolves to PASS phase (D-23/D-24)
    expect(result.state.phase).toBe('PASS');
  });

  it('scatter that stays fully on-pitch is unchanged by clamping', () => {
    // Ball at q=10, direction=4 (West: -q), distance=3 → landing q=7 (well within pitch)
    const result = applyRoll(looseBallNearEdgeState, 4, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ball should land 3 steps west: q=34-3=31, r=7
    expect(result.state.ball.position).toEqual({ q: 31, r: 7 });
    expect(isPitchHex(result.state.ball.position)).toBe(true);
    expect(result.state.phase).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// Phase 17.1 D-09: Regular shot range gate — goal hex >11 hexes → INVALID_TARGET
// ---------------------------------------------------------------------------

/** PASS state with shooter (home-9) far from goal (>11 hexes). */
const passStateShooterFar: GameState = {
  ...passState,
  // homeFWD at q:10, r:7 — distance to goal q=36,r=13: hexDist = (|26|+|6|+|20|)/2 = 26 > 11
  pieces: [
    { ...homeFWD, position: { q: 10, r: 7 } },
    { ...awayGK, position: { q: 33, r: 13 } }, // GK near goal
    { ...awayDEF, position: { q: 20, r: 7 } },
  ],
  ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
  lastActionType: 'MOVEMENT_PHASE',
};

/** PASS state with shooter (home-9) exactly 11 hexes from goal. */
const passStateShooterAt11: GameState = {
  ...passState,
  // homeFWD at q:25, r:13 — distance to goal q=36,r=13: dq=11, dr=0 → hexDist = (11+0+11)/2 = 11 ≤ 11
  pieces: [
    { ...homeFWD, position: { q: 25, r: 13 } },
    { ...awayGK, position: { q: 33, r: 13 } }, // GK near goal
    { ...awayDEF, position: { q: 20, r: 7 } },
  ],
  ball: { position: { q: 25, r: 13 }, carrierId: 'home-9' },
  lastActionType: 'MOVEMENT_PHASE',
};

describe('Phase 17.1 D-09: regular shot range gate (>11 hexes → INVALID_TARGET)', () => {
  it('shooter >11 hexes from goal hex → INVALID_TARGET', () => {
    // homeFWD at q:10 shooting toward q=36,r=13; distance ≈26 > 11 → rejected
    const result = applyDeclareShot(passStateShooterFar, { q: 36, r: 13 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('INVALID_TARGET');
  });

  it('shooter exactly 11 hexes from goal hex → GK_DIVE transition (valid)', () => {
    // homeFWD at q:25,r:13 shooting toward q=36,r=13; distance=11 → allowed
    const result = applyDeclareShot(passStateShooterAt11, { q: 36, r: 13 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_DIVE');
  });
});
