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
import { applyEndTurn, applyUndo, applyRoll, applyMove } from '../gameEngine.js';
// Wave 0 RED — applyCancelMovement implemented in Plan 02
// @ts-expect-error — function does not exist yet; import will fail at runtime (RED gate)
import { applyCancelMovement } from '../gameEngine.js';
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
  heading: 6,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 0,
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
  heading: 5,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 0,
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
  heading: 5,
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
  heading: 6,
  saving: 1,
  handling: 0,
  resilience: 7,
  aerialAbility: 0,
  highPass: 4,
};

/** Base MOVEMENT-phase state with ATTACKER_4 slot active and no moves yet. */
const baseMovementState: GameState = {
  roomCode: 'TEST17',
  phase: 'MOVEMENT',
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

/** PASS state for BUG-04b: teammate is at the target hex. */
const passToTeammateState: GameState = {
  ...passState,
  pieces: [
    homeFWD,
    { ...homeMID, position: { q: 14, r: 7 } }, // teammate at target
    awayGK,
    awayDEF,
  ],
  lastActionType: 'STANDARD_PASS',
  passTargetHex: { q: 14, r: 7 }, // same as homeMID position
};

/** HIGH_PASS_MOVEMENT state with one HP_REPOSITION event in the log. */
const highPassMovementStateWithMove: GameState = {
  roomCode: 'TEST17',
  phase: 'HIGH_PASS_MOVEMENT',
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
    // Wave 0 RED — currently applyRoll sets carrierId to null on occupied hex
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
});

// ---------------------------------------------------------------------------
// BUG-05: Loose ball spawns at GK hex after save
// ---------------------------------------------------------------------------

describe('Phase 17 BUG-05: save dropped → LOOSE_BALL at GK position', () => {
  it('handling die >= handling stat (dropped) → LOOSE_BALL; ball.position equals GK hex', () => {
    // GK at {q:11, r:7}; shooter at {q:10, r:7}; distance 1 → saveable (no penalty)
    // shooterDice=2: 9+2=11; gkDice=6: 9+6=15; GK wins SAVE
    // handlingDice=9: 9 >= handling=8 → DROPPED → LOOSE_BALL
    // Wave 0 RED — currently ball.position is set to shot origin, not gkEffectivePos
    const result = applyRoll(shotStateNearGK, 2, 6, 9);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.ball.carrierId).toBeNull();
    // BUG-05 fix: ball must spawn at GK's position {q:11, r:7}, not shooter's {q:10, r:7}
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
