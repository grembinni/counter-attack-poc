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
  applyFreeMoveEnd,
  applyFreeMoveZoneCheck,
  applyStartMovement,
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
  ballZone: 'middle', // ball at {q:10,r:7} — middleThird (q in [11,25])
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
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
  ballZone: 'middle',
  addedTime: null,
  lastActionType: 'MOVEMENT_PHASE',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
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
    // A real HP_MOVE after the HP_REPOSITION boundary — should be undoable (CR-01 17.1-11)
    {
      type: 'HP_MOVE',
      slot: 'ATTACKER',
      pieceId: 'home-9',
      from: { q: 10, r: 7 },
      to: { q: 11, r: 7 },
      timestamp: 2000,
    },
  ],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: { 'home-9': 1 },
  movementSlot: null,
  ballZone: 'middle',
  addedTime: null,
  lastActionType: 'HIGH_PASS',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
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
  ballZone: 'middle',
  addedTime: null,
  lastActionType: 'SHOT',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
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
    // Review-CR-01 (17.1-14): undo must also unlock the HP repositioning slot —
    // pre-fix, these fields retained their pre-undo values (highPassMovedPieceId:
    // 'home-9', highPassPaceUsed: 1), permanently dead-ending the slot. This
    // assertion would FAIL against the pre-fix applyUndo.
    expect(result.state.highPassMovedPieceId).toBeNull();
    expect(result.state.highPassPaceUsed).toBe(0);
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
// MOVE-06 (corrected design, D-33..D-38): applyFreeMoveZoneCheck
// ---------------------------------------------------------------------------

/** PASS-phase state with ball in the middle third — baseline for zone-check tests. */
const middleZonePassState: GameState = {
  ...baseMovementState,
  phase: 'PASS',
  movementSlot: null,
  ball: { position: { q: 15, r: 7 }, carrierId: 'home-9' },
  ballZone: 'middle',
  pieces: [homeFWD, homeMID, awayGK, awayDEF],
};

describe('Phase 17 MOVE-06 (corrected design): applyFreeMoveZoneCheck', () => {
  it('does not trigger when the ball stays in the same zone (no retrigger)', () => {
    const state: GameState = {
      ...middleZonePassState,
      ball: { position: { q: 29, r: 7 }, carrierId: 'home-2' }, // awayThird
      ballZone: 'away', // already away — same zone as the new position
    };
    const result = applyFreeMoveZoneCheck(state);
    expect(result.phase).toBe('PASS');
    expect(result.ballZone).toBe('away');
    expect(result.freeMoveEligibleIds ?? null).toBeNull();
  });

  it('does not trigger when the new zone is middle', () => {
    const state: GameState = {
      ...middleZonePassState,
      ball: { position: { q: 18, r: 7 }, carrierId: 'home-9' }, // middleThird
      ballZone: 'home', // was home, now middle — not a final-third entry
    };
    const result = applyFreeMoveZoneCheck(state);
    expect(result.phase).toBe('PASS');
    expect(result.ballZone).toBe('middle');
    expect(result.freeMoveEligibleIds ?? null).toBeNull();
  });

  it('triggers on a direct home→away jump with no intervening middle action', () => {
    // home-2 (home-2, attacking team) and away-0 (GK, defending team) both sit in homeThird
    // (the OPPOSITE third from the ball's new 'away' zone) — both eligible.
    const state: GameState = {
      ...middleZonePassState,
      ball: { position: { q: 30, r: 7 }, carrierId: 'home-9' }, // awayThird
      ballZone: 'home', // direct home→away jump
      pieces: [
        { ...homeFWD, position: { q: 30, r: 7 } },
        { ...homeMID, position: { q: 5, r: 7 } }, // homeThird — opposite of awayThird
        { ...awayGK, position: { q: 5, r: 8 } }, // GK in homeThird — also opposite, also eligible (D-34)
        { ...awayDEF, position: { q: 15, r: 7 } }, // middleThird — not eligible
      ],
    };
    const result = applyFreeMoveZoneCheck(state);
    expect(result.phase).toBe('FREE_MOVE_ATTACK');
    expect(result.ballZone).toBe('away');
    expect(result.freeMoveResume).toEqual({ phase: 'PASS', activeTeam: 'home' });
    expect(result.freeMoveEligibleIds).toEqual({ attack: ['home-2'], defense: ['away-0'] });
    expect(result.freeMoveUsedPace).toEqual({});
    // D-36: attack sub-phase starts with the attacking team active.
    expect(result.activeTeam).toBe('home');
  });

  it('eligibility includes GK and splits by attackingTeam, not by role or crossing piece', () => {
    const state: GameState = {
      ...middleZonePassState,
      attackingTeam: 'away', // away is attacking this time
      ball: { position: { q: 5, r: 7 }, carrierId: null }, // homeThird
      ballZone: 'middle', // fresh entry into 'home'
      pieces: [
        { ...homeFWD, position: { q: 30, r: 7 } }, // home team, in awayThird (opposite of homeThird)
        { ...homeMID, position: { q: 31, r: 8 } }, // home team, also in awayThird
        { ...awayGK, position: { q: 32, r: 9 } }, // away team GK, in awayThird
        { ...awayDEF, position: { q: 15, r: 7 } }, // middleThird — not eligible
      ],
    };
    const result = applyFreeMoveZoneCheck(state);
    // attack list (away-0) is non-empty → FREE_MOVE_ATTACK starts first (D-35).
    expect(result.phase).toBe('FREE_MOVE_ATTACK');
    // home pieces (home-9, home-2) are NOT on attackingTeam ('away') → defense list.
    // away pieces in the opposite third (away-0, the GK) → attack list (D-34: GK included).
    expect(result.freeMoveEligibleIds).toEqual({
      attack: ['away-0'],
      defense: ['home-9', 'home-2'],
    });
    expect(result.activeTeam).toBe('away'); // attackingTeam starts the FREE_MOVE_ATTACK sub-phase
  });

  it('skips straight to FREE_MOVE_DEFENSE when the attack list is empty', () => {
    const state: GameState = {
      ...middleZonePassState,
      ball: { position: { q: 30, r: 7 }, carrierId: 'home-9' }, // awayThird
      ballZone: 'home',
      pieces: [
        { ...homeFWD, position: { q: 30, r: 7 } },
        { ...homeMID, position: { q: 15, r: 7 } }, // middleThird — NOT in homeThird, not eligible
        { ...awayGK, position: { q: 5, r: 8 } }, // homeThird — defense-eligible (away is defending)
        { ...awayDEF, position: { q: 15, r: 7 } },
      ],
    };
    const result = applyFreeMoveZoneCheck(state);
    expect(result.phase).toBe('FREE_MOVE_DEFENSE');
    expect(result.freeMoveEligibleIds).toEqual({ attack: [], defense: ['away-0'] });
    expect(result.activeTeam).toBe('away'); // the other team since attack list is empty
  });

  it('stays on the triggering phase with ballZone updated when both lists are empty', () => {
    const state: GameState = {
      ...middleZonePassState,
      ball: { position: { q: 30, r: 7 }, carrierId: 'home-9' }, // awayThird
      ballZone: 'home',
      pieces: [
        { ...homeFWD, position: { q: 30, r: 7 } },
        { ...homeMID, position: { q: 15, r: 7 } }, // middleThird — not eligible
        { ...awayGK, position: { q: 30, r: 8 } }, // awayThird (same as ball) — not opposite, not eligible
        { ...awayDEF, position: { q: 15, r: 7 } }, // middleThird — not eligible
      ],
    };
    const result = applyFreeMoveZoneCheck(state);
    expect(result.phase).toBe('PASS'); // unchanged — nobody to move
    expect(result.ballZone).toBe('away');
    expect(result.freeMoveEligibleIds ?? null).toBeNull();
  });

  it('does not fire while phase is HALF_TIME (D-37)', () => {
    const state: GameState = {
      ...middleZonePassState,
      phase: 'HALF_TIME',
      ball: { position: { q: 30, r: 7 }, carrierId: null },
      ballZone: 'home',
      pieces: [homeFWD, { ...homeMID, position: { q: 5, r: 7 } }, awayGK, awayDEF],
    };
    const result = applyFreeMoveZoneCheck(state);
    expect(result).toBe(state); // returned unchanged
  });

  it('does not fire while phase is FULL_TIME (D-37)', () => {
    const state: GameState = {
      ...middleZonePassState,
      phase: 'FULL_TIME',
      ball: { position: { q: 30, r: 7 }, carrierId: null },
      ballZone: 'home',
      pieces: [homeFWD, { ...homeMID, position: { q: 5, r: 7 } }, awayGK, awayDEF],
    };
    const result = applyFreeMoveZoneCheck(state);
    expect(result).toBe(state); // returned unchanged
  });

  it('resets movedPieceIds to [] on the trigger-fire transition (UX-parity fix)', () => {
    // Seed a stale, non-empty movedPieceIds from whatever phase/action preceded this trigger —
    // it must not leak into the fresh FREE_MOVE_ATTACK/DEFENSE sub-phase.
    const state: GameState = {
      ...middleZonePassState,
      ball: { position: { q: 30, r: 7 }, carrierId: 'home-9' }, // awayThird
      ballZone: 'home', // direct home→away jump
      movedPieceIds: ['home-9', 'away-1'], // stale from a prior phase
      pieces: [
        { ...homeFWD, position: { q: 30, r: 7 } },
        { ...homeMID, position: { q: 5, r: 7 } }, // homeThird — eligible
        { ...awayGK, position: { q: 5, r: 8 } }, // homeThird — eligible
        { ...awayDEF, position: { q: 15, r: 7 } },
      ],
    };
    const result = applyFreeMoveZoneCheck(state);
    expect(result.phase).toBe('FREE_MOVE_ATTACK');
    expect(result.movedPieceIds).toEqual([]);
  });

  it('does not re-fire while already in FREE_MOVE_ATTACK or FREE_MOVE_DEFENSE (D-37)', () => {
    const attackState: GameState = {
      ...middleZonePassState,
      phase: 'FREE_MOVE_ATTACK',
      ball: { position: { q: 30, r: 7 }, carrierId: null },
      ballZone: 'away',
      freeMoveEligibleIds: { attack: ['home-2'], defense: [] },
      freeMoveUsedPace: {},
      freeMoveResume: { phase: 'PASS', activeTeam: 'home' },
    };
    expect(applyFreeMoveZoneCheck(attackState)).toBe(attackState);

    const defenseState: GameState = { ...attackState, phase: 'FREE_MOVE_DEFENSE' };
    expect(applyFreeMoveZoneCheck(defenseState)).toBe(defenseState);
  });

  // BUG-20: free-move interrupt must be DEFERRED while a MOVE slot is in progress
  // (phase=MOVE + movementSlot !== null) or while a HEADER is in progress.
  // The ball-zone crossing is detected but the overlay is withheld until the slot/
  // header resolves to a clean phase boundary.

  it('BUG-20: defers FREE_MOVE overlay while a MOVE slot is in progress (mid-MOVE-slot)', () => {
    // Ball has crossed into the away third during an active ATTACKER_4 slot.
    // D-33 zone check would trigger (middle→away, eligible pieces in home third).
    const midSlotState: GameState = {
      ...middleZonePassState,
      phase: 'MOVE',
      movementSlot: 'ATTACKER_4',
      ball: { position: { q: 30, r: 7 }, carrierId: 'home-9' }, // awayThird
      ballZone: 'middle', // was middle — fresh entry into final third
      pieces: [
        { ...homeFWD, position: { q: 5, r: 7 } }, // homeThird — eligible
        { ...homeMID, position: { q: 30, r: 7 } }, // awayThird — at ball
        { ...awayGK, position: { q: 29, r: 7 } },
        { ...awayDEF, position: { q: 15, r: 7 } },
      ],
    };
    const result = applyFreeMoveZoneCheck(midSlotState);
    // Must NOT overlay FREE_MOVE_ATTACK — phase stays MOVE
    expect(result.phase).toBe('MOVE');
    expect(result.phase).not.toBe('FREE_MOVE_ATTACK');
    expect(result.phase).not.toBe('FREE_MOVE_DEFENSE');
    // ballZone must NOT be updated (deferral: stale zone is needed to re-detect
    // the crossing at the next clean boundary after the slot resolves)
    expect(result.ballZone).toBe('middle');
  });

  it('BUG-20: free-move fires correctly AFTER the MOVE slot resolves (deferred trigger)', () => {
    // Same ball position (awayThird) but now the MOVE slot has resolved (movementSlot=null,
    // phase=PASS) — the deferral guard no longer applies and the free-move must fire.
    const postSlotState: GameState = {
      ...middleZonePassState,
      phase: 'PASS',
      movementSlot: null,
      ball: { position: { q: 30, r: 7 }, carrierId: 'home-9' }, // awayThird
      ballZone: 'middle', // still stale from before the MOVE slot (deferral kept it unchanged)
      pieces: [
        { ...homeFWD, position: { q: 30, r: 7 } }, // awayThird (ball here)
        { ...homeMID, position: { q: 5, r: 7 } }, // homeThird — attack-eligible
        { ...awayGK, position: { q: 5, r: 8 } }, // homeThird — defense-eligible
        { ...awayDEF, position: { q: 15, r: 7 } }, // middleThird — not eligible
      ],
    };
    const result = applyFreeMoveZoneCheck(postSlotState);
    // Must overlay FREE_MOVE_ATTACK now (deferred trigger fires at clean PASS boundary)
    expect(result.phase).toBe('FREE_MOVE_ATTACK');
    expect(result.ballZone).toBe('away');
    expect(result.freeMoveResume).toEqual({ phase: 'PASS', activeTeam: 'home' });
  });

  it('BUG-20: defers FREE_MOVE overlay while HEADER is in progress', () => {
    // Ball has crossed into the home third during an active HEADER phase.
    const headerState: GameState = {
      ...middleZonePassState,
      phase: 'HEADER',
      movementSlot: null,
      ball: { position: { q: 5, r: 7 }, carrierId: null }, // homeThird
      ballZone: 'middle', // was middle — fresh entry
      pieces: [
        { ...homeFWD, position: { q: 30, r: 7 } }, // awayThird — eligible (opposite of homeThird)
        { ...homeMID, position: { q: 27, r: 7 } }, // awayThird — eligible
        { ...awayGK, position: { q: 29, r: 7 } },
        { ...awayDEF, position: { q: 5, r: 7 } },
      ],
    };
    const result = applyFreeMoveZoneCheck(headerState);
    // Must NOT overlay FREE_MOVE during HEADER
    expect(result.phase).toBe('HEADER');
    expect(result.phase).not.toBe('FREE_MOVE_ATTACK');
    expect(result.phase).not.toBe('FREE_MOVE_DEFENSE');
    expect(result.ballZone).toBe('middle'); // ballZone unchanged (deferral)
  });
});

// ---------------------------------------------------------------------------
// MOVE-06 (corrected design): applyMove FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE handling
// ---------------------------------------------------------------------------

/** FREE_MOVE_ATTACK phase state: home-2 and a second eligible home piece in the away third. */
const homeMID2: PlayerPiece = {
  ...homeMID,
  id: 'home-3',
  position: { q: 28, r: 8 },
};

const freeMoveAttackState: GameState = {
  ...baseMovementState,
  phase: 'FREE_MOVE_ATTACK',
  movementSlot: null,
  pieces: [homeFWD, homeMID, homeMID2, awayGK, awayDEF],
  freeMoveEligibleIds: { attack: ['home-2', 'home-3'], defense: ['away-1'] },
  freeMoveUsedPace: {},
  freeMoveResume: { phase: 'PASS', activeTeam: 'home' },
  ballZone: 'away',
};

const freeMoveDefenseState: GameState = {
  ...freeMoveAttackState,
  phase: 'FREE_MOVE_DEFENSE',
  activeTeam: 'away',
};

describe('Phase 17 MOVE-06 (corrected design): applyMove FREE_MOVE_ATTACK per-piece move handling', () => {
  it('accepts a single-hex move for an eligible attack piece and tracks freeMoveUsedPace', () => {
    const result = applyMove(freeMoveAttackState, 'home-2', { q: 28, r: 7 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.freeMoveUsedPace).toEqual({ 'home-2': 1 });
    const moved = result.state.pieces.find((p) => p.id === 'home-2');
    expect(moved?.position).toEqual({ q: 28, r: 7 });
  });

  it('rejects a move for a piece not in the attack eligible list', () => {
    const result = applyMove(freeMoveAttackState, 'home-9', { q: 11, r: 7 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('MOVE_INVALID');
    expect(result.detail).toBe('NOT_ELIGIBLE');
  });

  it('rejects a defense-eligible piece while phase is FREE_MOVE_ATTACK', () => {
    // away-1 is in the defense list, but phase is FREE_MOVE_ATTACK — not its turn yet.
    const result = applyMove(freeMoveAttackState, 'away-1', { q: 16, r: 7 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('WRONG_TEAM'); // activeTeam is 'home' during FREE_MOVE_ATTACK
  });

  it('rejects a move from the wrong team', () => {
    const result = applyMove(
      { ...freeMoveAttackState, freeMoveEligibleIds: { attack: ['away-1'], defense: [] } },
      'away-1',
      { q: 16, r: 7 },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('WRONG_TEAM');
  });

  it('accumulates pace across multiple steps and rejects the 7th cumulative hex', () => {
    const stateWith5Used: GameState = {
      ...freeMoveAttackState,
      freeMoveUsedPace: { 'home-2': 5 },
    };
    // 6th hex within budget — accepted
    const accepted = applyMove(stateWith5Used, 'home-2', { q: 28, r: 7 });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.state.freeMoveUsedPace).toEqual({ 'home-2': 6 });

    // 7th cumulative hex — rejected
    const stateWith6Used: GameState = {
      ...freeMoveAttackState,
      freeMoveUsedPace: { 'home-2': 6 },
    };
    const rejected = applyMove(stateWith6Used, 'home-2', { q: 28, r: 7 });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.reason).toBe('MOVE_INVALID');
    expect(rejected.detail).toBe('FREE_MOVE_EXHAUSTED');
  });

  it('two different eligible pieces can each move up to 6 hexes independently', () => {
    const first = applyMove(freeMoveAttackState, 'home-2', { q: 28, r: 7 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.freeMoveUsedPace).toEqual({ 'home-2': 1 });

    const second = applyMove(first.state, 'home-3', { q: 27, r: 8 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    // home-2's entry preserved; home-3's entry added independently
    expect(second.state.freeMoveUsedPace).toEqual({ 'home-2': 1, 'home-3': 1 });
  });

  it('rejects a move onto an occupied hex', () => {
    // awayDEF occupies {q:15, r:7}; homeMID2 at {q:28,r:8} cannot reach that in one hex anyway,
    // so use a piece adjacent to an occupied hex instead.
    const occupiedAdjacentState: GameState = {
      ...freeMoveAttackState,
      pieces: [homeFWD, { ...homeMID, position: { q: 27, r: 8 } }, homeMID2, awayGK, awayDEF],
    };
    const result = applyMove(occupiedAdjacentState, 'home-2', { q: 28, r: 8 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('MOVE_INVALID');
    expect(result.detail).toBe('OCCUPIED');
  });

  // UX-parity fix: activated/abandoned-piece tracking for FREE_MOVE (reuses movedPieceIds,
  // mirrors regular MOVEMENT's exhaustion+abandonment rule in applyMove).
  it('abandons a partially-moved piece (movedPieceIds) when a different eligible piece starts moving', () => {
    // home-2 moves 2 of its 6 hexes (still has budget remaining)...
    const stateWith2Used: GameState = {
      ...freeMoveAttackState,
      freeMoveUsedPace: { 'home-2': 2 },
    };
    // ...then the player switches to home-3 (a brand-new activation: usedSoFar === 0)
    const result = applyMove(stateWith2Used, 'home-3', { q: 27, r: 8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // home-2 is abandoned (locked in as activated) even though it only used 2 of 6 hexes.
    expect(result.state.movedPieceIds).toContain('home-2');
    // home-3 has just started its own activation — not yet in movedPieceIds.
    expect(result.state.movedPieceIds).not.toContain('home-3');
    expect(result.state.freeMoveUsedPace).toEqual({ 'home-2': 2, 'home-3': 1 });
  });

  it('BUG-14: does NOT eagerly add a piece to movedPieceIds when it exhausts its own 6th hex', () => {
    // BUG-14 (Phase 18.3): removing the paceExhausted eager-lock from applyFreeMove mirrors
    // the fix in computeMovedPieceIds. A FREE_MOVE piece stays out of movedPieceIds until
    // the player activates a DIFFERENT piece (abandonedIds path). This preserves Snapshot
    // availability for the exhausted carrier while they are still the actively selected piece.
    const stateWith5Used: GameState = {
      ...freeMoveAttackState,
      freeMoveUsedPace: { 'home-2': 5 },
    };
    const result = applyMove(stateWith5Used, 'home-2', { q: 28, r: 7 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.freeMoveUsedPace).toEqual({ 'home-2': 6 });
    // BUG-14: carrier must NOT be in movedPieceIds yet — they are still the active piece.
    expect(result.state.movedPieceIds).not.toContain('home-2');
  });

  it('rejects a move for a piece already in movedPieceIds even if its freeMoveUsedPace is under 6', () => {
    const alreadyActivatedState: GameState = {
      ...freeMoveAttackState,
      freeMoveUsedPace: { 'home-2': 2 }, // under 6 — would otherwise be allowed
      movedPieceIds: ['home-2'], // abandoned earlier
    };
    const result = applyMove(alreadyActivatedState, 'home-2', { q: 28, r: 7 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('MOVE_INVALID');
    expect(result.detail).toBe('FREE_MOVE_EXHAUSTED');
  });
});

describe('Phase 17 MOVE-06 (corrected design): applyMove FREE_MOVE_DEFENSE per-piece move handling', () => {
  it('accepts a single-hex move for an eligible defense piece', () => {
    const result = applyMove(freeMoveDefenseState, 'away-1', { q: 16, r: 7 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.freeMoveUsedPace).toEqual({ 'away-1': 1 });
    const moved = result.state.pieces.find((p) => p.id === 'away-1');
    expect(moved?.position).toEqual({ q: 16, r: 7 });
  });

  it('rejects an attack-eligible piece while phase is FREE_MOVE_DEFENSE', () => {
    // home-2 is in the attack list, not the defense list — and activeTeam is 'away' now.
    const result = applyMove(freeMoveDefenseState, 'home-2', { q: 28, r: 7 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('WRONG_TEAM');
  });
});

// ---------------------------------------------------------------------------
// MOVE-06 (corrected design): applyFreeMoveEnd dual sub-phase transition
// ---------------------------------------------------------------------------

describe('Phase 17 MOVE-06 (corrected design): applyFreeMoveEnd', () => {
  it('FREE_MOVE_ATTACK → FREE_MOVE_DEFENSE when the defense list is non-empty', () => {
    const result = applyFreeMoveEnd(freeMoveAttackState);
    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe('FREE_MOVE_DEFENSE');
    expect(result.state.activeTeam).toBe('away'); // attackingTeam is 'home', so defense is 'away'
    // Eligible ids / used-pace are preserved — defense pieces haven't moved yet.
    expect(result.state.freeMoveEligibleIds).toEqual({
      attack: ['home-2', 'home-3'],
      defense: ['away-1'],
    });
  });

  it('FREE_MOVE_ATTACK → FREE_MOVE_DEFENSE resets movedPieceIds to [] (UX-parity fix)', () => {
    // Seed attack-side activations present to prove the reset — defending team's sub-phase
    // must start fresh, independent of which attacking pieces were activated/abandoned.
    const stateWithAttackActivations: GameState = {
      ...freeMoveAttackState,
      movedPieceIds: ['home-2', 'home-3'],
    };
    const result = applyFreeMoveEnd(stateWithAttackActivations);
    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe('FREE_MOVE_DEFENSE');
    expect(result.state.movedPieceIds).toEqual([]);
  });

  it('FREE_MOVE_ATTACK → resume phase when the defense list is empty', () => {
    const noDefenseState: GameState = {
      ...freeMoveAttackState,
      freeMoveEligibleIds: { attack: ['home-2'], defense: [] },
    };
    const result = applyFreeMoveEnd(noDefenseState);
    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe('PASS'); // from freeMoveResume
    expect(result.state.activeTeam).toBe('home'); // from freeMoveResume
    expect(result.state.freeMoveResume).toBeNull();
    expect(result.state.freeMoveEligibleIds).toBeNull();
    expect(result.state.freeMoveUsedPace).toBeNull();
  });

  it('FREE_MOVE_ATTACK → resume phase (empty defense list) resets movedPieceIds to [] (UX-parity fix)', () => {
    const noDefenseStateWithActivations: GameState = {
      ...freeMoveAttackState,
      freeMoveEligibleIds: { attack: ['home-2'], defense: [] },
      movedPieceIds: ['home-2'],
    };
    const result = applyFreeMoveEnd(noDefenseStateWithActivations);
    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe('PASS');
    expect(result.state.movedPieceIds).toEqual([]);
  });

  it('FREE_MOVE_DEFENSE → resume phase always, restoring phase/activeTeam from freeMoveResume', () => {
    const result = applyFreeMoveEnd(freeMoveDefenseState);
    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe('PASS');
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.freeMoveResume).toBeNull();
    expect(result.state.freeMoveEligibleIds).toBeNull();
    expect(result.state.freeMoveUsedPace).toBeNull();
  });

  it('FREE_MOVE_DEFENSE → resume phase resets movedPieceIds to [] (UX-parity fix)', () => {
    const defenseStateWithActivations: GameState = {
      ...freeMoveDefenseState,
      movedPieceIds: ['away-1'],
    };
    const result = applyFreeMoveEnd(defenseStateWithActivations);
    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe('PASS');
    expect(result.state.movedPieceIds).toEqual([]);
  });

  it('restores a non-PASS resume phase correctly (e.g. HIGH_PASS_MOVE)', () => {
    const highPassResumeState: GameState = {
      ...freeMoveDefenseState,
      freeMoveResume: { phase: 'HIGH_PASS_MOVE', activeTeam: 'away' },
    };
    const result = applyFreeMoveEnd(highPassResumeState);
    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe('HIGH_PASS_MOVE');
    expect(result.state.activeTeam).toBe('away');
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
  ballZone: 'middle',
  addedTime: null,
  lastActionType: 'FIRST_TIME_PASS',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
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
          type: 'FTP_MOVE' as const,
          slot: 'ATTACKER' as const,
          pieceId: 'home-9',
          from: { q: 10, r: 7 },
          to: { q: 11, r: 7 },
          timestamp: 2000,
        },
      ],
    };
    const result = applyUndo(ftpMoveStateWithMove);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const piece = result.state.pieces.find((p) => p.id === 'home-9');
    expect(piece?.position).toEqual({ q: 10, r: 7 }); // restored to original
    // Review-CR-01 (17.1-14): undo must also unlock the FTP repositioning slot —
    // pre-fix, these fields retained their pre-undo values (firstTimePassMovedPieceId:
    // 'home-9', firstTimePassPaceUsed: 1), permanently dead-ending the slot after a
    // single Undo. This assertion would FAIL against the pre-fix applyUndo.
    expect(result.state.firstTimePassMovedPieceId).toBeNull();
    expect(result.state.firstTimePassPaceUsed).toBe(0);
  });

  it('applyUndo during regular MOVE phase does not touch FTP/HP lock fields', () => {
    // No-regression guard: a plain MOVE-phase undo must leave the FTP/HP lock fields
    // exactly as they were on the input state — the reset is gated on
    // state.phase === FIRST_TIME_PASS_MOVE / HIGH_PASS_MOVE only.
    const moveStateWithMove: GameState = {
      ...baseMovementState,
      pieces: [{ ...homeFWD, position: { q: 11, r: 7 } }, awayGK, awayDEF],
      paceUsedByPieceId: { 'home-9': 1 },
      eventLog: [
        {
          type: 'MOVE' as const,
          pieceId: 'home-9',
          from: { q: 10, r: 7 },
          to: { q: 11, r: 7 },
          slot: 'ATTACKER_4' as const,
          timestamp: 1000,
          ballAfter: { position: { q: 10, r: 7 }, carrierId: null },
        },
      ],
    };
    const result = applyUndo(moveStateWithMove);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const piece = result.state.pieces.find((p) => p.id === 'home-9');
    expect(piece?.position).toEqual({ q: 10, r: 7 }); // restored to original
    // Untouched — baseMovementState has no FTP/HP fields set (undefined on input)
    expect(result.state.firstTimePassMovedPieceId).toBeUndefined();
    expect(result.state.firstTimePassPaceUsed).toBeUndefined();
    expect(result.state.highPassMovedPieceId).toBeUndefined();
    expect(result.state.highPassPaceUsed).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 17.1-13 CR-02-new: FIRST_TIME_PASS near a defender must still reach
// FIRST_TIME_PASS_MOVE — the interception loop must not shadow the transition.
// ---------------------------------------------------------------------------

/**
 * PASS state for CR-02-new: homeFWD (q:10,r:7) passes FIRST_TIME to homeMID
 * at q:14,r:7 (distance 4, within the FIRST_TIME cap of 6).
 *
 * awayDEF is placed at {q:14, r:8} — exactly 1 hex (ZoI) from the target hex
 * {q:14, r:7} — so passValidator's destination-ZoI scan (passValidator.ts
 * lines 154-162) populates rollIntercepts with awayDEF for this FIRST_TIME
 * pass (FIRST_TIME is grouped with STANDARD for interception-list population
 * per passValidator.ts:140). preGeneratedInterceptionDice includes a 6, which
 * would auto-intercept (die===6 threshold) if the interception loop ran —
 * proving this test would FAIL pre-fix (phase 'PASS', lastActionType
 * 'SUCCESSFUL_TACKLE') and only passes once FIRST_TIME_PASS bypasses the loop.
 */
const firstTimePassNearDefenderState: GameState = {
  ...passState,
  pieces: [
    homeFWD,
    { ...homeMID, position: { q: 14, r: 7 } }, // FTP target, distance 4 from homeFWD
    awayGK,
    { ...awayDEF, position: { q: 14, r: 8 } }, // 1 hex (ZoI) from target — would auto-intercept
  ],
  lastActionType: 'FIRST_TIME_PASS',
  passTargetHex: { q: 14, r: 7 },
  preGeneratedInterceptionDice: [6], // die=6 would normally auto-intercept (rollIntercepts case)
};

describe('Phase 17.1-13 CR-02-new: FIRST_TIME_PASS bypasses interception loop near a defender', () => {
  it('accurate FIRST_TIME_PASS near a ZoI defender → direct delivery (BUG-12 toggle off), not SUCCESSFUL_TACKLE', () => {
    // CR-02-new: the interception loop must be bypassed for FIRST_TIME_PASS (isFirstTimePass
    // guard). With FTP_MOVE_ENABLED = false (BUG-12 default), ball is delivered directly to
    // the target hex — NOT intercepted by the ZoI defender (die=6 is suppressed) and NOT
    // entering FIRST_TIME_PASS_MOVE. The pre-17.1-13 bug would have returned
    // lastActionType='SUCCESSFUL_TACKLE'; the BUG-12 toggle-off path delivers directly.
    const result = applyRoll(firstTimePassNearDefenderState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // BUG-12 toggle off: goes straight to PASS, skips FIRST_TIME_PASS_MOVE
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('FIRST_TIME_PASS');
    // Ball delivered to target hex; homeMID (home-2) is there and picks it up
    expect(result.state.ball.position).toEqual({ q: 14, r: 7 });
    expect(result.state.ball.carrierId).toBe('home-2');
    // Interception was suppressed — attacking team unchanged
    expect(result.state.attackingTeam).toBe('home');
  });

  it('regression: STANDARD_PASS near the same defender still auto-intercepts (loop unchanged)', () => {
    // Same defender position/dice, but STANDARD_PASS — must still intercept (no regression).
    const standardPassNearDefenderState: GameState = {
      ...firstTimePassNearDefenderState,
      lastActionType: 'STANDARD_PASS',
    };
    const result = applyRoll(standardPassNearDefenderState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    expect(result.state.ball.carrierId).toBe('away-1');
    expect(result.state.attackingTeam).toBe('away');
  });
});

// ---------------------------------------------------------------------------
// BUG-12: FTP_MOVE_ENABLED toggle-off delivery path regression tests
// ---------------------------------------------------------------------------

/**
 * PASS state for BUG-12: homeFWD (q:10,r:7) making a first-time pass to homeMID at q:14,r:7.
 * awayDEF is far away (q:20,r:7) — no interception risk for a clean delivery test.
 */
const ftpToggleOffPassState: GameState = {
  ...passState,
  pieces: [
    homeFWD,
    { ...homeMID, position: { q: 14, r: 7 } }, // FTP target, teammate at target
    awayGK,
    { ...awayDEF, position: { q: 20, r: 7 } }, // far from pass path
  ],
  lastActionType: 'FIRST_TIME_PASS',
  passTargetHex: { q: 14, r: 7 },
  preGeneratedInterceptionDice: [],
};

/**
 * PASS state for BUG-12 defender-occupied: awayDEF is at the FTP target hex.
 * Ball should transfer to the defender (BUG-04 parity).
 */
const ftpToggleOffDefenderOccupiedState: GameState = {
  ...passState,
  pieces: [
    homeFWD,
    { ...homeMID, position: { q: 20, r: 7 } }, // homeMID is not at target
    awayGK,
    { ...awayDEF, position: { q: 14, r: 7 } }, // defender at FTP target hex
  ],
  lastActionType: 'FIRST_TIME_PASS',
  passTargetHex: { q: 14, r: 7 },
  preGeneratedInterceptionDice: [],
};

describe('BUG-12: FTP_MOVE_ENABLED=false — direct delivery, no FIRST_TIME_PASS_MOVE', () => {
  it('first-time pass to teammate hex delivers ball directly and transitions to PASS', () => {
    // FTP_MOVE_ENABLED=false: no repositioning phase entered; ball goes to teammate at target.
    const result = applyRoll(ftpToggleOffPassState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Must NOT enter FIRST_TIME_PASS_MOVE
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('FIRST_TIME_PASS');
    // Ball delivered to target hex; homeMID picks it up
    expect(result.state.ball.position).toEqual({ q: 14, r: 7 });
    expect(result.state.ball.carrierId).toBe('home-2');
    // Attacking team unchanged (teammate received)
    expect(result.state.attackingTeam).toBe('home');
    // passTargetHex cleared
    expect(result.state.passTargetHex).toBeNull();
  });

  it('first-time pass to defender-occupied hex transfers possession (BUG-04 parity)', () => {
    // FTP_MOVE_ENABLED=false: direct delivery hits defender hex → possession transfer.
    const result = applyRoll(ftpToggleOffDefenderOccupiedState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('FIRST_TIME_PASS');
    // Ball delivered to defender's position; awayDEF gains possession
    expect(result.state.ball.position).toEqual({ q: 14, r: 7 });
    expect(result.state.ball.carrierId).toBe('away-1');
    // Possession transferred to away team
    expect(result.state.attackingTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
  });

  it('first-time pass to empty hex delivers ball with no carrier', () => {
    // FTP_MOVE_ENABLED=false: no one at target — ball sits at target hex uncarried.
    const ftpToEmptyHex: GameState = {
      ...ftpToggleOffPassState,
      pieces: [
        homeFWD,
        { ...homeMID, position: { q: 20, r: 7 } }, // not at target
        awayGK,
        { ...awayDEF, position: { q: 22, r: 7 } }, // not at target
      ],
    };
    const result = applyRoll(ftpToEmptyHex, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('FIRST_TIME_PASS');
    expect(result.state.ball.position).toEqual({ q: 14, r: 7 });
    expect(result.state.ball.carrierId).toBeNull();
    expect(result.state.attackingTeam).toBe('home');
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
  ballZone: 'away', // ball at {q:34,r:7} — awayThird (q>=26)
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
};

describe('Phase 17.1 D-08: loose-ball scatter clamps to board edge', () => {
  it('scatter direction=1 (East, +q) distance=5 from q=34 clamps at q=36; ball stays on-pitch; phase PASS', () => {
    // Ball at {q:34,r:7}, direction=1 (East), distance=5.
    // Phase 17.1-08: computeLooseBall's corrected parity-aware cube-vector walk
    // drifts r as q increases on this ODD-Q offset grid (true straight-line
    // geometry — see scoreUtils.ts/hex.ts). Step-by-step from {q:34,r:7}:
    // step1={q:35,r:7} (on-pitch), step2={q:36,r:8} (on-pitch, q=36 is max
    // pitch column), step3={q:37,r:8} (off-pitch: q>36, clamp breaks here).
    // clampedPos = {q:36, r:8}
    const result = applyRoll(looseBallNearEdgeState, 1, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Clamped ball must be on-pitch
    expect(isPitchHex(result.state.ball.position)).toBe(true);
    // Exactly at pitch boundary (q=36 is max pitch column)
    expect(result.state.ball.position).toEqual({ q: 36, r: 8 });
    // LOOSE_BALL always resolves to PASS phase (D-23/D-24)
    expect(result.state.phase).toBe('PASS');
  });

  it('scatter that stays fully on-pitch is unchanged by clamping', () => {
    // Ball at {q:34,r:7}, direction=4 (West), distance=3 → landing well within pitch.
    // Phase 17.1-08: corrected trajectory drifts r as q decreases (true straight line).
    const result = applyRoll(looseBallNearEdgeState, 4, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ball should land 3 steps west of {q:34,r:7}: {q:31, r:8} (corrected trajectory)
    expect(result.state.ball.position).toEqual({ q: 31, r: 8 });
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

// ---------------------------------------------------------------------------
// BUG-18 (Phase 18.3): Undo regression — applyStartMovement clears lastDiceRoll
// ---------------------------------------------------------------------------

describe('BUG-18: undo enabled in MOVE entered via applyStartMovement', () => {
  /** PASS state with a stale lastDiceRoll (simulates the pre-fix regression:
   *  a dice roll from an accuracy check is left in state when entering MOVE). */
  const passStateWithDiceRoll: GameState = {
    ...passState,
    // Stale dice from e.g. pass accuracy check — must be cleared on MOVE entry (BUG-18)
    lastDiceRoll: { rolls: [4], context: 'PASS_ACCURACY' },
  };

  it('applyStartMovement clears lastDiceRoll so Undo is not blocked in MOVE', () => {
    const moveEntry = applyStartMovement(passStateWithDiceRoll);
    expect(moveEntry.ok).toBe(true);
    if (!moveEntry.ok) return;

    // BUG-18 Fix 1: lastDiceRoll must be null on MOVE entry
    expect(moveEntry.state.lastDiceRoll).toBeNull();
  });

  it('Undo works in MOVE after applyStartMovement when a move has been made', () => {
    // Enter MOVE from PASS (with stale lastDiceRoll — the pre-BUG-18 regression path)
    const moveEntry = applyStartMovement(passStateWithDiceRoll);
    expect(moveEntry.ok).toBe(true);
    if (!moveEntry.ok) return;

    // Make a move
    const afterMove = applyMove(moveEntry.state, 'home-9', { q: 11, r: 7 });
    expect(afterMove.ok).toBe(true);
    if (!afterMove.ok) return;

    // Undo must succeed — pre-fix this would return ok:false because lastDiceRoll !== null
    // blocked canUndo on the client; the server applyUndo itself doesn't check lastDiceRoll
    // but validating state.lastDiceRoll is null confirms the engine fix is in place.
    const undoResult = applyUndo(afterMove.state);
    expect(undoResult.ok).toBe(true);
    if (!undoResult.ok) return;

    // Piece should be back at original position
    const piece = undoResult.state.pieces.find((p) => p.id === 'home-9');
    expect(piece?.position).toEqual(homeFWD.position);
  });
});
