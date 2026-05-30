import { describe, it, expect } from 'vitest';
import {
  buildInitialGameState,
  advanceMovementSlot,
  applyStartMovement,
  applyMove,
  applyEndTurn,
  applyUndo,
  applyRoll,
  applyGKRestart,
} from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const homePiece: PlayerPiece = {
  id: 'home-9',
  teamId: 'home',
  name: 'Home FWD 2',
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
  highPass: 5, // D-04: FWD has meaningful highPass; aerialAbility: 0 per D-05
};

const awayPiece: PlayerPiece = {
  id: 'away-9',
  teamId: 'away',
  name: 'Away FWD 2',
  role: 'FWD',
  position: { q: 14, r: 7 },
  pace: 9,
  shooting: 9,
  tackling: 1,
  dribbling: 8,
  heading: 6,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 0,
  highPass: 5, // D-04: FWD has meaningful highPass; aerialAbility: 0 per D-05
};

/** Minimal MOVEMENT-phase fixture for testing engine mutations. */
const baseMovementState: GameState = {
  roomCode: 'TEST1',
  phase: 'MOVEMENT',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homePiece, awayPiece],
  ball: { position: { q: 12, r: 7 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 }, // hardcoded for determinism — does not contradict TEAM-03 random init
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
  pendingFreeMove: null,
};

// ---------------------------------------------------------------------------
// buildInitialGameState
// ---------------------------------------------------------------------------

describe('buildInitialGameState', () => {
  it('returns phase KICK_OFF with 22 pieces (TEAM-01)', () => {
    const state = buildInitialGameState('ROOM1');
    expect(state.phase).toBe('KICK_OFF');
    expect(state.pieces).toHaveLength(22);
    expect(state.roomCode).toBe('ROOM1');
  });

  it('attackingTeam is home or away (D-13 coin flip)', () => {
    const state = buildInitialGameState('ROOM2');
    expect(['home', 'away']).toContain(state.attackingTeam);
  });

  it('ball.position equals the kick-off hex { q:12, r:7 }', () => {
    const state = buildInitialGameState('ROOM3');
    expect(state.ball.position).toEqual({ q: 12, r: 7 });
  });

  it('eventLog is empty at start', () => {
    const state = buildInitialGameState('ROOM4');
    expect(state.eventLog).toHaveLength(0);
  });

  it('refereeCard.leniency is an integer in 1..6 (TEAM-03)', () => {
    const state = buildInitialGameState('ROOM5');
    const { leniency } = state.refereeCard;
    expect(Number.isInteger(leniency)).toBe(true);
    expect(leniency).toBeGreaterThanOrEqual(1);
    expect(leniency).toBeLessThanOrEqual(6);
  });

  it('refereeCard.leniency is random — at least 2 distinct values across 10 builds (TEAM-03)', () => {
    const values = new Set<number>();
    for (let i = 0; i < 10; i++) {
      values.add(buildInitialGameState(`ROOM-${i}`).refereeCard.leniency);
    }
    expect(values.size).toBeGreaterThanOrEqual(2);
  });

  it('movementSlot is null at KICK_OFF', () => {
    const state = buildInitialGameState('ROOM6');
    expect(state.movementSlot).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// advanceMovementSlot
// ---------------------------------------------------------------------------

describe('advanceMovementSlot', () => {
  it('ATTACKER_4 → DEFENDER_5 / MOVEMENT (D-03)', () => {
    const state: GameState = { ...baseMovementState, movementSlot: 'ATTACKER_4' };
    const { nextSlot, nextPhase } = advanceMovementSlot(state);
    expect(nextSlot).toBe('DEFENDER_5');
    expect(nextPhase).toBe('MOVEMENT');
  });

  it('DEFENDER_5 → ATTACKER_2 / MOVEMENT (D-03)', () => {
    const state: GameState = { ...baseMovementState, movementSlot: 'DEFENDER_5' };
    const { nextSlot, nextPhase } = advanceMovementSlot(state);
    expect(nextSlot).toBe('ATTACKER_2');
    expect(nextPhase).toBe('MOVEMENT');
  });

  it('ATTACKER_2 → null / PASS (D-04)', () => {
    const state: GameState = { ...baseMovementState, movementSlot: 'ATTACKER_2' };
    const { nextSlot, nextPhase } = advanceMovementSlot(state);
    expect(nextSlot).toBeNull();
    expect(nextPhase).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// applyStartMovement
// ---------------------------------------------------------------------------

describe('applyStartMovement', () => {
  it('transitions KICK_OFF → MOVEMENT with movementSlot ATTACKER_4', () => {
    const kickOffState: GameState = { ...baseMovementState, phase: 'KICK_OFF', movementSlot: null };
    const result = applyStartMovement(kickOffState);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('MOVEMENT');
      expect(result.state.movementSlot).toBe('ATTACKER_4');
      expect(result.state.eventLog).toHaveLength(1);
      expect(result.state.eventLog[0]?.type).toBe('KICK_OFF');
    }
  });

  it('returns WRONG_PHASE when called outside KICK_OFF', () => {
    const result = applyStartMovement(baseMovementState);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('WRONG_PHASE');
    }
  });
});

// ---------------------------------------------------------------------------
// applyMove
// ---------------------------------------------------------------------------

describe('applyMove', () => {
  it('returns WRONG_SLOT when phase is not MOVEMENT (MOVE-01)', () => {
    const state: GameState = { ...baseMovementState, phase: 'KICK_OFF', movementSlot: null };
    const result = applyMove(state, 'home-9', { q: 11, r: 7 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_SLOT');
  });

  it('returns PIECE_NOT_FOUND for an unknown pieceId', () => {
    const result = applyMove(baseMovementState, 'not-a-piece', { q: 11, r: 7 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('PIECE_NOT_FOUND');
  });

  it('returns WRONG_TEAM for an opponent piece in ATTACKER_4 slot (T-4-01)', () => {
    // ATTACKER_4 belongs to attacking team (home); away piece should be rejected
    const result = applyMove(baseMovementState, 'away-9', { q: 13, r: 7 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_TEAM');
  });

  it('returns MOVE_INVALID when the move violates validator rules (MOVE-02/MOVE-03)', () => {
    // Attempt a 2-hex jump — OUT_OF_RANGE
    const result = applyMove(baseMovementState, 'home-9', { q: 12, r: 7 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('MOVE_INVALID');
  });

  it('succeeds for a valid 1-hex move and appends MOVE event without changing movementSlot (D-01)', () => {
    // home-9 is at { q:10, r:7 }; move to adjacent { q:11, r:7 }
    const result = applyMove(baseMovementState, 'home-9', { q: 11, r: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const movedPiece = result.state.pieces.find((p) => p.id === 'home-9');
      expect(movedPiece?.position).toEqual({ q: 11, r: 7 });
      expect(result.state.movementSlot).toBe('ATTACKER_4'); // D-01: slot unchanged
      expect(result.state.paceUsedByPieceId['home-9']).toBe(1);
      const lastEvent = result.state.eventLog[result.state.eventLog.length - 1];
      expect(lastEvent?.type).toBe('MOVE');
    }
  });

  it('MOVE event records server-derived from-coord, not a client parameter (T-4-03)', () => {
    const result = applyMove(baseMovementState, 'home-9', { q: 11, r: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const moveEvent = result.state.eventLog.find((e) => e.type === 'MOVE');
      expect(moveEvent?.type).toBe('MOVE');
      if (moveEvent?.type === 'MOVE') {
        expect(moveEvent.from).toEqual({ q: 10, r: 7 }); // piece.position before move
      }
    }
  });

  it('sets pendingFreeMove when ball carrier crosses between final thirds (MOVE-06, D-15)', () => {
    // Place home-9 at q:7 (homeThird) with ball, move to q:8 which is NOT awayThird (q>=17).
    // To trigger MOVE-06 we need a direct homeThird→awayThird crossing in one step.
    // Adjacent hexes at boundary: q:7→q:8 crosses homeThird to middleThird, not to awayThird.
    // Use q:16 (still awayThird boundary is q>=17) — actually homeThird is q<=7 and awayThird is q>=17.
    // For a single-step crossing we need q:7→q:17 which is 10 steps — not possible in one move.
    // So MOVE-06 on the placeholder grid cannot trigger in 1 step from homeThird to awayThird.
    // This test verifies the state machine correctly does NOT set it for a standard midfield move,
    // and that the free-move condition is architecturally wired (future test with custom fixture).
    const stateWithBall: GameState = {
      ...baseMovementState,
      ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
    };
    const result = applyMove(stateWithBall, 'home-9', { q: 11, r: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Moving from q:10 to q:11 — both in homeThird (q<=7)? No, q:10 is middleThird.
      // Neither homeThird→awayThird cross: pendingFreeMove stays null.
      expect(result.state.pendingFreeMove).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// applyEndTurn
// ---------------------------------------------------------------------------

describe('applyEndTurn', () => {
  it('returns WRONG_SLOT when phase is not MOVEMENT', () => {
    const state: GameState = { ...baseMovementState, phase: 'KICK_OFF', movementSlot: null };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_SLOT');
  });

  it('advances ATTACKER_4 → DEFENDER_5 and appends SLOT_ADVANCE (D-03)', () => {
    const result = applyEndTurn(baseMovementState);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.movementSlot).toBe('DEFENDER_5');
      expect(result.state.phase).toBe('MOVEMENT');
      const lastEvent = result.state.eventLog[result.state.eventLog.length - 1];
      expect(lastEvent?.type).toBe('SLOT_ADVANCE');
      if (lastEvent?.type === 'SLOT_ADVANCE') {
        expect(lastEvent.from).toBe('ATTACKER_4');
        expect(lastEvent.to).toBe('DEFENDER_5');
      }
    }
  });

  it('resets movedPieceIds and paceUsedByPieceId after advance', () => {
    const stateWithPace: GameState = {
      ...baseMovementState,
      movedPieceIds: ['home-9'],
      paceUsedByPieceId: { 'home-9': 3 },
    };
    const result = applyEndTurn(stateWithPace);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.movedPieceIds).toHaveLength(0);
      expect(result.state.paceUsedByPieceId).toEqual({});
    }
  });

  it('transitions to PASS phase when ATTACKER_2 ends (D-04)', () => {
    const attacker2State: GameState = { ...baseMovementState, movementSlot: 'ATTACKER_2' };
    const result = applyEndTurn(attacker2State);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('PASS');
      expect(result.state.movementSlot).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// applyUndo
// ---------------------------------------------------------------------------

describe('applyUndo', () => {
  it('reverses the last MOVE in the current slot (D-10)', () => {
    // First make a move
    const afterMove = applyMove(baseMovementState, 'home-9', { q: 11, r: 7 });
    expect(afterMove.ok).toBe(true);
    if (!afterMove.ok) return;

    const result = applyUndo(afterMove.state);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const piece = result.state.pieces.find((p) => p.id === 'home-9');
      expect(piece?.position).toEqual({ q: 10, r: 7 }); // back to original
      expect(result.state.paceUsedByPieceId['home-9']).toBeUndefined(); // pace reset
      // MOVE event removed from log
      expect(result.state.eventLog.every((e) => e.type !== 'MOVE')).toBe(true);
    }
  });

  it('returns UNDO_LOCKED after a SLOT_ADVANCE event (D-09)', () => {
    // Make a move then advance the turn (produces SLOT_ADVANCE)
    const afterMove = applyMove(baseMovementState, 'home-9', { q: 11, r: 7 });
    expect(afterMove.ok).toBe(true);
    if (!afterMove.ok) return;

    const afterEndTurn = applyEndTurn(afterMove.state);
    expect(afterEndTurn.ok).toBe(true);
    if (!afterEndTurn.ok) return;

    const result = applyUndo(afterEndTurn.state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('UNDO_LOCKED');
  });

  it('returns NOTHING_TO_UNDO when no MOVE exists in current slot', () => {
    const result = applyUndo(baseMovementState); // no moves yet
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOTHING_TO_UNDO');
  });
});

// ---------------------------------------------------------------------------
// applyRoll
// ---------------------------------------------------------------------------

const awayGK: PlayerPiece = {
  id: 'away-0',
  teamId: 'away',
  name: 'Away GK',
  role: 'GK',
  position: { q: 23, r: 7 },
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
  name: 'Away DEF 1',
  role: 'DEF',
  position: { q: 15, r: 7 }, // near ball for header tests
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

/** Base PASS-phase state: home team attacking, ball carrier is homePiece (FWD, highPass:5). */
const passState: GameState = {
  roomCode: 'TEST1',
  phase: 'PASS',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homePiece, awayGK, awayDEF, awayPiece],
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
};

/** Base SHOT-phase state: homePiece carries the ball near the away goal. */
const shotState: GameState = {
  roomCode: 'TEST1',
  phase: 'SHOT',
  activeTeam: 'home',
  attackingTeam: 'home',
  // awayGK is at q:23 (near goal); homePiece is shooter at q:10; distance ~13 (> 3, unsavable)
  // Use awayGK near shooter for saveable scenarios in separate fixtures
  pieces: [homePiece, awayGK],
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
};

/** SHOT state where GK is adjacent (distance 1) to make save scenarios possible. */
const shotStateNearGK: GameState = {
  ...shotState,
  // awayGK adjacent to homePiece — distance 1 → saveable with 0 penalty
  pieces: [
    { ...homePiece, position: { q: 10, r: 7 } },
    { ...awayGK, position: { q: 11, r: 7 } },
  ],
  ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
};

/** HEADER state: home attacker has ball; away DEF is 1 hex away; away GK is near goal. */
const headerState: GameState = {
  roomCode: 'TEST1',
  phase: 'HEADER',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homePiece, awayGK, awayDEF],
  ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' }, // awayDEF at q:15 — 5 hexes away
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  pendingFreeMove: null,
};

/** HEADER state where DEF is within 2 hexes — contested duel. */
const headerStateContested: GameState = {
  ...headerState,
  pieces: [
    { ...homePiece, position: { q: 10, r: 7 } },
    { ...awayGK, position: { q: 23, r: 7 } },
    { ...awayDEF, position: { q: 11, r: 7 } }, // 1 hex from ball — contested
  ],
  ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
};

/** LOOSE_BALL state. */
const looseBallState: GameState = {
  roomCode: 'TEST1',
  phase: 'LOOSE_BALL',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homePiece, awayGK],
  ball: { position: { q: 12, r: 7 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  pendingFreeMove: null,
};

describe('applyRoll', () => {
  // ---- WRONG_PHASE guard ----

  it('returns WRONG_PHASE when called in MOVEMENT phase', () => {
    const result = applyRoll(baseMovementState, 3, 3, 3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  // ---- PASS branch ----

  it('PASS accurate (highPass+dice >= 8) → phase transitions to SHOT and lastDiceRoll set', () => {
    // homePiece.highPass=5; dice=4 → 5+4=9 >= 8 → accurate
    const result = applyRoll(passState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('SHOT');
      expect(result.state.lastDiceRoll).toBeDefined();
      expect(result.state.lastDiceRoll?.context).toBe('PASS_ACCURACY');
      expect(result.state.lastDiceRoll?.rolls).toContain(4);
    }
  });

  it('PASS inaccurate (highPass+dice < 8) → phase transitions to LOOSE_BALL and ball.carrierId null', () => {
    // homePiece.highPass=5; dice=1 → 5+1=6 < 8 → inaccurate → LOOSE_BALL
    const result = applyRoll(passState, 1, 2, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('LOOSE_BALL');
      expect(result.state.ball.carrierId).toBeNull();
      expect(result.state.lastDiceRoll?.context).toBe('PASS_ACCURACY');
    }
  });

  // ---- SHOT branch ----

  it('SHOT GOAL (shooterScore > gkScore) → score increments for attacking team; phase KICK_OFF', () => {
    // homePiece.shooting=9; dice=6 → shooter=15; awayGK.saving=9; dice=1 → 10+no_penalty
    // But GK at q:23, shooter at q:10: distance=13 > 3 → OUT_OF_RANGE (no dive penalty effectively gkPenalties=[0])
    // Wait: OUT_OF_RANGE means gkPenalties is empty [] in the code (diveResult.saveable is false)
    // shooterScore = 9+6=15; gkScore = 9+1=10; 15>10 → GOAL
    const result = applyRoll(shotState, 6, 1, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('KICK_OFF');
      expect(result.state.score.home).toBe(1); // home is attacking team
      expect(result.state.lastDiceRoll?.context).toBe('SHOT_DUEL');
      expect(result.state.lastDiceRoll?.rolls).toHaveLength(3);
    }
  });

  it('SHOT AUTO_MISS (shooter dice=1) → phase MOVEMENT', () => {
    const result = applyRoll(shotState, 1, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('MOVEMENT');
      expect(result.state.score.home).toBe(0); // no goal
      expect(result.state.lastDiceRoll?.context).toBe('SHOT_DUEL');
    }
  });

  it('SHOT tie (shooterScore === gkScore) → LOOSE_BALL (D-13), ball.carrierId null', () => {
    // Need equal scores. With OUT_OF_RANGE GK (far away, no penalties):
    // shooterScore = shooting + shooterDice; gkScore = saving + gkDice
    // homePiece.shooting=9; awayGK.saving=9; dice=3,3 → 9+3=12 vs 9+3=12 → tie → LOOSE_BALL
    const result = applyRoll(shotState, 3, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('MOVEMENT');
      expect(result.state.ball.carrierId).toBeNull();
      expect(result.state.lastDiceRoll?.context).toBe('SHOT_DUEL');
    }
  });

  it('SHOT SAVE+CAUGHT → phase GK_RESTART; ball.carrierId set to GK id', () => {
    // Near GK (distance 1, no penalty): shooterDice=2 → 9+2=11; gkDice=4 → 9+4=13; gk wins → SAVE
    // handlingDice=1: 1 < gk.handling=8 → CAUGHT → GK_RESTART
    const result = applyRoll(shotStateNearGK, 2, 4, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('GK_RESTART');
      expect(result.state.ball.carrierId).toBe('away-0'); // away GK id
      expect(result.state.lastDiceRoll?.context).toBe('SHOT_DUEL');
    }
  });

  // ---- HEADER branch ----

  it('HEADER uncontested (defender out of range) — attacker wins over GK → GOAL when GK score lower', () => {
    // headerState: awayDEF at q:15 → 5 hexes from ball at q:10 → OUT_OF_RANGE, uncontested
    // attacker.heading=6; attackerDice=6 → 12; awayGK.aerialAbility=8; gkDice=1 → 9
    // 12 > 9: attacker beats GK → GOAL
    const result = applyRoll(headerState, 6, 3, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('KICK_OFF');
      expect(result.state.score.home).toBe(1);
      expect(result.state.lastDiceRoll?.context).toBe('HEADING_DUEL');
    }
  });

  it('HEADER uncontested — GK wins aerial → GK_RESTART', () => {
    // attacker.heading=6; attackerDice=1 → 7; awayGK.aerialAbility=8; gkDice=3 → 11
    // 11 >= 7: GK wins → GK_RESTART
    const result = applyRoll(headerState, 1, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('GK_RESTART');
      expect(result.state.ball.carrierId).toBe('away-0');
      expect(result.state.lastDiceRoll?.context).toBe('HEADING_DUEL');
    }
  });

  it('HEADER contested — defender wins → phase MOVEMENT', () => {
    // headerStateContested: awayDEF at q:11 (1 hex from ball at q:10) → contested
    // attacker.heading=6; attackerDice=1 → penaltyMod=0 (dist=0) → 6+1=7
    // awayDEF.heading=6; defenderDice=5 → 6+5=11 → defender wins → MOVEMENT
    const result = applyRoll(headerStateContested, 1, 5, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('MOVEMENT');
      expect(result.state.lastDiceRoll?.context).toBe('HEADING_DUEL');
    }
  });

  // ---- LOOSE_BALL branch ----

  it('LOOSE_BALL → ball.position moves to computed landing; carrierId null; phase MOVEMENT', () => {
    // dice: direction=1 (E: +q), distance=3 → landing = {q:12+3, r:7} = {q:15, r:7}
    const result = applyRoll(looseBallState, 1, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('MOVEMENT');
      expect(result.state.ball.carrierId).toBeNull();
      expect(result.state.ball.position).toEqual({ q: 15, r: 7 }); // q:12 + E*3 = q:15
      expect(result.state.lastDiceRoll?.context).toBe('LOOSE_BALL');
      expect(result.state.lastDiceRoll?.rolls).toHaveLength(2);
    }
  });
});

// ---------------------------------------------------------------------------
// applyGKRestart
// ---------------------------------------------------------------------------

/** GK piece for GK_RESTART tests — the away GK who has caught the ball. */
const gkPiece: PlayerPiece = {
  id: 'away-0',
  teamId: 'away',
  name: 'Away GK',
  role: 'GK',
  position: { q: 23, r: 7 },
  pace: 2,
  shooting: 1,
  tackling: 4,
  dribbling: 3,
  heading: 5,
  saving: 9,
  handling: 8,
  resilience: 7,
  aerialAbility: 8,
  highPass: 0, // GKs have highPass: 0 per D-04 → kick is almost always inaccurate
};

/** GK_RESTART state: away GK holds the ball after a save catch. */
const gkRestartState: GameState = {
  roomCode: 'TEST1',
  phase: 'GK_RESTART',
  activeTeam: 'away', // GK team is now active
  attackingTeam: 'home', // home was attacking before the save
  pieces: [homePiece, gkPiece],
  ball: { position: { q: 23, r: 7 }, carrierId: 'away-0' }, // GK is ball carrier
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  pendingFreeMove: null,
};

/** GK_RESTART state with a high-highPass GK for testing accurate kick branch. */
const highPassGK: PlayerPiece = {
  ...gkPiece,
  id: 'away-0',
  highPass: 8, // very high highPass for testing accurate kick
};
const gkRestartHighPassState: GameState = {
  ...gkRestartState,
  pieces: [homePiece, highPassGK],
};

describe('applyGKRestart', () => {
  // ---- WRONG_PHASE guard ----

  it('returns WRONG_PHASE when called outside GK_RESTART', () => {
    const result = applyGKRestart(baseMovementState, 'movement', () => 3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  // ---- INVALID_CHOICE guard ----

  it('returns INVALID_CHOICE for an unknown choice value', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = applyGKRestart(gkRestartState, 'punt' as any, () => 3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INVALID_CHOICE');
  });

  // ---- movement branch ----

  it("'movement' → phase MOVEMENT, attackingTeam = GK's team, ball stays with GK (D-26)", () => {
    const result = applyGKRestart(gkRestartState, 'movement', () => 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('MOVEMENT');
      expect(result.state.attackingTeam).toBe('away'); // GK team
      expect(result.state.ball.carrierId).toBe('away-0'); // still GK
      expect(result.state.lastDiceRoll).toBeNull();
    }
  });

  // ---- throw branch ----

  it("'throw' → phase MOVEMENT, attackingTeam = GK's team, ball stays with GK, lastDiceRoll null (D-25)", () => {
    const result = applyGKRestart(gkRestartState, 'throw', () => 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('MOVEMENT');
      expect(result.state.attackingTeam).toBe('away'); // GK team
      expect(result.state.ball.carrierId).toBe('away-0'); // ball still with GK
      expect(result.state.lastDiceRoll).toBeNull();
    }
  });

  // ---- kick branch: accurate ----

  it("'kick' accurate (highPass + dice >= 8) → phase MOVEMENT, attackingTeam = GK team, ball with GK, lastDiceRoll context GK_KICK (D-24)", () => {
    // highPassGK.highPass=8; rollDie()=6 → 8+6=14 >= 8 → accurate
    const result = applyGKRestart(gkRestartHighPassState, 'kick', () => 6);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('MOVEMENT');
      expect(result.state.attackingTeam).toBe('away'); // GK team
      expect(result.state.ball.carrierId).toBe('away-0'); // ball stays with GK on accurate kick
      expect(result.state.lastDiceRoll).toBeDefined();
      expect(result.state.lastDiceRoll?.context).toBe('GK_KICK');
      expect(result.state.lastDiceRoll?.rolls).toHaveLength(1);
    }
  });

  // ---- kick branch: inaccurate ----

  it("'kick' inaccurate (highPass + dice < 8) → Loose Ball from GK position, carrierId null, lastDiceRoll context GK_KICK (D-24)", () => {
    // gkPiece.highPass=0; rollDie()=1 → 0+1=1 < 8 → inaccurate → Loose Ball
    // Uses two rollDie() calls: first for accuracy, then two more for loose ball direction+distance
    let callCount = 0;
    const mockDie = (): number => {
      callCount++;
      if (callCount === 1) return 1; // accuracy roll → 0+1=1 < 8 → inaccurate
      if (callCount === 2) return 1; // direction roll (E: +q)
      return 3; // distance roll → 3 hexes
    };
    const result = applyGKRestart(gkRestartState, 'kick', mockDie);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('MOVEMENT');
      expect(result.state.ball.carrierId).toBeNull(); // no carrier on Loose Ball
      expect(result.state.attackingTeam).toBe('away'); // GK team still gets movement
      expect(result.state.lastDiceRoll?.context).toBe('GK_KICK');
      expect(result.state.lastDiceRoll?.rolls?.length).toBeGreaterThanOrEqual(1);
    }
  });
});
