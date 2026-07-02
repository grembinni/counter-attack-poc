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
  applyGKKickTarget,
} from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const homePiece: PlayerPiece = {
  id: 'home-9',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'FWD 2',
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
  highPass: 5, // D-04: FWD has meaningful highPass; aerialAbility: 0 per D-05
};

const awayPiece: PlayerPiece = {
  id: 'away-9',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'FWD 2',
  number: 10,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 14, r: 7 },
  pace: 9,
  shooting: 9,
  tackling: 1,
  dribbling: 8,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 6,
  highPass: 5, // D-04: FWD has meaningful highPass; aerialAbility: 0 per D-05
};

/** Minimal MOVEMENT-phase fixture for testing engine mutations. */
const baseMovementState: GameState = {
  roomCode: 'TEST1',
  phase: 'MOVE',
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
  ballZone: 'middle', // ball at {q:12,r:7} — middleThird (q in [11,25])
  // Phase 8 fields (D-06)
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  // Phase 16 field (D-15)
  selectedTeams: { home: 'cosmos', away: 'xolos' },
  // UX-07 (Phase 18.4): game speed — default 'standard' in tests
  gameSpeed: 'standard',
};

// ---------------------------------------------------------------------------
// buildInitialGameState
// ---------------------------------------------------------------------------

// Default selectedTeams for existing buildInitialGameState tests (Phase 16 repair).
const DEFAULT_TEAMS = { home: 'cosmos', away: 'xolos' } as const;

describe('buildInitialGameState', () => {
  it('returns phase KICK_OFF_SETUP with 22 pieces (TEAM-01, D-23)', () => {
    const state = buildInitialGameState('ROOM1', DEFAULT_TEAMS);
    expect(state.phase).toBe('KICK_OFF_SETUP');
    expect(state.pieces).toHaveLength(22);
    expect(state.roomCode).toBe('ROOM1');
  });

  it('attackingTeam is home or away (D-13 coin flip)', () => {
    const state = buildInitialGameState('ROOM2', DEFAULT_TEAMS);
    expect(['home', 'away']).toContain(state.attackingTeam);
  });

  it('ball.position equals the kick-off hex { q:18, r:13 } (D-04/D-05 37×26 grid)', () => {
    const state = buildInitialGameState('ROOM3', DEFAULT_TEAMS);
    expect(state.ball.position).toEqual({ q: 18, r: 13 });
  });

  it('eventLog is empty at start', () => {
    const state = buildInitialGameState('ROOM4', DEFAULT_TEAMS);
    expect(state.eventLog).toHaveLength(0);
  });

  it('refereeCard.leniency is an integer in 1..6 (TEAM-03)', () => {
    const state = buildInitialGameState('ROOM5', DEFAULT_TEAMS);
    const { leniency } = state.refereeCard;
    expect(Number.isInteger(leniency)).toBe(true);
    expect(leniency).toBeGreaterThanOrEqual(1);
    expect(leniency).toBeLessThanOrEqual(6);
  });

  it('refereeCard.leniency is random — at least 2 distinct values across 10 builds (TEAM-03)', () => {
    const values = new Set<number>();
    for (let i = 0; i < 10; i++) {
      values.add(buildInitialGameState(`ROOM-${i}`, DEFAULT_TEAMS).refereeCard.leniency);
    }
    expect(values.size).toBeGreaterThanOrEqual(2);
  });

  it('movementSlot is null at KICK_OFF', () => {
    const state = buildInitialGameState('ROOM6', DEFAULT_TEAMS);
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
    expect(nextPhase).toBe('MOVE');
  });

  it('DEFENDER_5 → ATTACKER_2 / MOVEMENT (D-03)', () => {
    const state: GameState = { ...baseMovementState, movementSlot: 'DEFENDER_5' };
    const { nextSlot, nextPhase } = advanceMovementSlot(state);
    expect(nextSlot).toBe('ATTACKER_2');
    expect(nextPhase).toBe('MOVE');
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
      expect(result.state.phase).toBe('MOVE');
      expect(result.state.movementSlot).toBe('ATTACKER_4');
      // KICK_OFF event is now logged in the GAME_READY handler (not applyStartMovement)
      expect(result.state.eventLog).toHaveLength(0);
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
    // Attempt a non-adjacent 2-hex jump — OUT_OF_RANGE (single-step only)
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

  it('applyMove no longer performs its own free-move zone detection (MOVE-06, corrected design)', () => {
    // Corrected design (D-33..D-38, 2026-06-20 rulebook correction): the ball-zone-triggered
    // free-move check moved entirely out of applyMove and into the centralized
    // applyFreeMoveZoneCheck (invoked from broadcastState after every resolved action).
    // applyMove simply propagates state.ballZone unchanged via spread — it does not read
    // or write it directly.
    const stateWithBall: GameState = {
      ...baseMovementState,
      ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
      ballZone: 'middle',
    };
    const result = applyMove(stateWithBall, 'home-9', { q: 11, r: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.ballZone).toBe('middle');
    }
  });

  it('ball.position follows the carrier on a normal move (D-13/D-14)', () => {
    // home-9 is the carrier at {q:10, r:7}; moves to {q:11, r:7}; ball should track
    const stateWithBall: GameState = {
      ...baseMovementState,
      ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
    };
    const result = applyMove(stateWithBall, 'home-9', { q: 11, r: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.ball.position).toEqual({ q: 11, r: 7 });
      expect(result.state.ball.carrierId).toBe('home-9');
    }
  });

  it('stealDie===6 → steal SUCCESS regardless of tackling+die < 10 (auto-steal, D-06)', () => {
    // defender: tackling=1; stealDie=6 → 1+6=7 < 10 but die===6 → SUCCESS
    const defender: PlayerPiece = {
      ...awayPiece,
      id: 'away-def',
      position: { q: 12, r: 7 }, // adjacent to destination {q:11,r:7}
      tackling: 1, // low tackling ensures 1+6=7 < 10 normally
    };
    const stateWithCarrier: GameState = {
      ...baseMovementState,
      pieces: [homePiece, defender],
      ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
    };
    // home-9 moves to {q:11,r:7} which is adjacent to defender at {q:12,r:7} → STEAL_ATTEMPT
    const result = applyMove(
      stateWithCarrier,
      'home-9',
      { q: 11, r: 7 },
      { stealDie: 6, tackleDie: 3, carrierDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // auto-steal: ball possession transferred to defender
      expect(result.state.ball.carrierId).toBe('away-def');
      expect(result.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    }
  });

  it('steal success when tackling+stealDie >= 10 (D-06)', () => {
    // defender: tackling=5; stealDie=5 → 5+5=10 >= 10 → SUCCESS
    const defender: PlayerPiece = {
      ...awayPiece,
      id: 'away-def2',
      position: { q: 12, r: 7 },
      tackling: 5,
    };
    const stateWithCarrier: GameState = {
      ...baseMovementState,
      pieces: [homePiece, defender],
      ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
    };
    const result = applyMove(
      stateWithCarrier,
      'home-9',
      { q: 11, r: 7 },
      { stealDie: 5, tackleDie: 3, carrierDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.ball.carrierId).toBe('away-def2');
      expect(result.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    }
  });

  it('tackle duel: defenderCombined >= carrierCombined → SUCCESS, possession+ball transferred to defender (D-09)', () => {
    // defender 'away-9' (tackling=1) at {q:14,r:7}; carrier 'home-9' (dribbling=8) at {q:10,r:7}
    // defender moves to {q:11,r:7} which is adjacent to carrier at {q:10,r:7}
    // tackleDie=6: defCombined=1+6=7; carrierDie=1: carCombined=8+1=9? Wait... need defCombined >= carCombined
    // Use tackling=5, tackleDie=6 → defCombined=11; carrier dribbling=8, carrierDie=1 → carCombined=9
    const defenderPiece: PlayerPiece = {
      ...awayPiece,
      id: 'away-9',
      position: { q: 14, r: 7 },
      tackling: 5,
    };
    const stateWithCarrier: GameState = {
      ...baseMovementState,
      // active team for ATTACKER_4 is 'home' (attackingTeam); but we need away to move → DEFENDER_5 slot
      movementSlot: 'DEFENDER_5',
      activeTeam: 'away',
      pieces: [homePiece, defenderPiece],
      ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
    };
    // away-9 moves from {q:14,r:7} to {q:11,r:7}: too far (3 hexes). Use {q:13,r:7} → {q:11,r:7} not 1 step.
    // Instead place defender at {q:12,r:7} and move to {q:11,r:7} which is adjacent to carrier at {q:10,r:7}
    const defenderAdjacentState: GameState = {
      ...stateWithCarrier,
      pieces: [homePiece, { ...defenderPiece, position: { q: 12, r: 7 } }],
    };
    const result = applyMove(
      defenderAdjacentState,
      'away-9',
      { q: 11, r: 7 },
      { stealDie: 3, tackleDie: 6, carrierDie: 1 },
    );
    // defCombined = 5+6=11; carCombined = 8+1=9; 11>=9 → SUCCESS
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.ball.carrierId).toBe('away-9');
      expect(result.state.ball.position).toEqual({ q: 11, r: 7 }); // defender's new position
      expect(result.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    }
  });

  it('tackle duel: carrierCombined > defenderCombined → FAIL, defender moves but carrier keeps ball (D-09)', () => {
    // tackleDie=1, carrierDie=6: defCombined=5+1=6; carCombined=8+6=14; 6<14 → FAIL
    const defenderPiece: PlayerPiece = {
      ...awayPiece,
      id: 'away-9',
      position: { q: 12, r: 7 },
      tackling: 5,
    };
    const stateWithCarrier: GameState = {
      ...baseMovementState,
      movementSlot: 'DEFENDER_5',
      activeTeam: 'away',
      pieces: [homePiece, defenderPiece],
      ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
    };
    const result = applyMove(
      stateWithCarrier,
      'away-9',
      { q: 11, r: 7 },
      { stealDie: 3, tackleDie: 1, carrierDie: 6 },
    );
    // defCombined = 5+1=6; carCombined = 8+6=14; 6<14 → FAIL
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.ball.carrierId).toBe('home-9'); // carrier keeps ball
      expect(result.state.lastActionType).not.toBe('SUCCESSFUL_TACKLE'); // not ended
      // defender still moved to destination
      const defender = result.state.pieces.find((p) => p.id === 'away-9');
      expect(defender?.position).toEqual({ q: 11, r: 7 });
    }
  });

  // BUG-13: when a defender moves adjacent to a carrier that already has a SECOND defender
  // adjacent (stationary), both defenders must each get a TACKLE_ATTEMPT before the move
  // resolves. Currently only one TACKLE_ATTEMPT fires (the moving defender's).
  // This test is RED until Task 2 (the inline multi-tackle sequencing loop) ships.
  it(
    'tackle sequencing: two defenders adjacent to carrier after first move — ' +
      'both get a TACKLE_ATTEMPT when first tackle FAILs (BUG-13)',
    () => {
      // Carrier home-9 at {q:10,r:7}.
      // away-def1 MOVES from {q:12,r:7} to {q:11,r:7} (adjacent to carrier) → first TACKLE.
      // away-def2 is ALREADY at {q:9,r:7} (also adjacent to carrier, stationary).
      // Dice: tackleDie=1 (low), carrierDie=6 (high) → first tackle FAILS.
      // Expected after fix: TWO TACKLE_ATTEMPT events; both defender ids in tackleAttemptedByIds.
      const carrier: PlayerPiece = { ...homePiece, id: 'home-9', position: { q: 10, r: 7 } };
      const def1: PlayerPiece = {
        ...awayPiece,
        id: 'away-def1',
        position: { q: 12, r: 7 },
        tackling: 1,
        dribbling: 1,
      };
      const def2: PlayerPiece = {
        ...awayPiece,
        id: 'away-def2',
        position: { q: 9, r: 7 }, // already adjacent to carrier — stationary second tackler
        tackling: 1,
        dribbling: 1,
      };
      const stateWithTwoDefenders: GameState = {
        ...baseMovementState,
        movementSlot: 'DEFENDER_5',
        activeTeam: 'away',
        attackingTeam: 'home',
        pieces: [carrier, def1, def2],
        ball: { position: { q: 10, r: 7 }, carrierId: 'home-9' },
      };
      // away-def1 moves from {q:12,r:7} to {q:11,r:7}, triggering a TACKLE vs carrier.
      // tackleDie=1, carrierDie=6 → defCombined=1+1=2 vs carCombined=8+6=14 → FAIL.
      const result = applyMove(
        stateWithTwoDefenders,
        'away-def1',
        { q: 11, r: 7 },
        {
          stealDie: 3,
          tackleDie: 1,
          carrierDie: 6,
        },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Both defenders must appear in tackleAttemptedByIds after resolution.
        expect(result.state.tackleAttemptedByIds).toContain('away-def1');
        expect(result.state.tackleAttemptedByIds).toContain('away-def2');
        // Exactly two TACKLE_ATTEMPT events must be in the event log.
        const tackleEvents = result.state.eventLog.filter((e) => e.type === 'TACKLE_ATTEMPT');
        expect(tackleEvents).toHaveLength(2);
        const defenderIds = tackleEvents.map((e) =>
          e.type === 'TACKLE_ATTEMPT' ? e.defenderId : null,
        );
        expect(defenderIds).toContain('away-def1');
        expect(defenderIds).toContain('away-def2');
        // Carrier keeps the ball (both tackles failed).
        expect(result.state.ball.carrierId).toBe('home-9');
      }
    },
  );
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
      expect(result.state.phase).toBe('MOVE');
      const lastEvent = result.state.eventLog[result.state.eventLog.length - 1];
      expect(lastEvent?.type).toBe('SLOT_ADVANCE');
      if (lastEvent?.type === 'SLOT_ADVANCE') {
        expect(lastEvent.from).toBe('ATTACKER_4');
        expect(lastEvent.to).toBe('DEFENDER_5');
      }
    }
  });

  it('preserves movedPieceIds across slot advance, resets paceUsedByPieceId', () => {
    // movedPieceIds persists across slot boundaries so players cannot move twice in a phase.
    // paceUsedByPieceId resets so the new slot tracks its own activations from zero.
    const stateWithPace: GameState = {
      ...baseMovementState,
      movedPieceIds: ['home-9'],
      paceUsedByPieceId: { 'home-9': 3 },
    };
    const result = applyEndTurn(stateWithPace);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.movedPieceIds).toContain('home-9'); // preserved — cannot move again
      expect(result.state.paceUsedByPieceId).toEqual({}); // reset — new slot starts fresh
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
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 23, r: 7 },
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
  lastName: 'DEF 1',
  number: 2,
  nationality: 'Test',
  role: 'DEF',
  position: { q: 15, r: 7 }, // near ball for header tests
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
  ballZone: 'middle',
  // Phase 8 fields
  addedTime: null,
  lastActionType: 'MOVEMENT_PHASE', // PASS phase is reached after a movement
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' }, // Phase 16 D-15
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
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
  ballZone: 'middle',
  // Phase 8 fields
  addedTime: null,
  lastActionType: 'MOVEMENT_PHASE',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' }, // Phase 16 D-15
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
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
  ballZone: 'middle',
  // Phase 8 fields
  addedTime: null,
  lastActionType: 'HIGH_PASS',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' }, // Phase 16 D-15
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
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
  ballZone: 'middle',
  // Phase 8 fields
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' }, // Phase 16 D-15
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
};

describe('applyRoll', () => {
  // ---- WRONG_PHASE guard ----

  it('returns WRONG_PHASE when called in MOVEMENT phase', () => {
    const result = applyRoll(baseMovementState, 3, 3, 3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  // ---- PASS branch ----

  it('PASS accurate (highPass+dice >= 8) → phase returns to action-choice (NOT SHOT) per D-09/Pitfall8', () => {
    // Uses standardPassState (lastActionType:'STANDARD_PASS', passTargetHex set) so ball delivery works.
    // STANDARD_PASS skips accuracy check (D-01); die=1 still results in successful delivery.
    // D-09/Pitfall 8: accurate pass MUST NOT transition to SHOT.
    // Phase stays PASS (neutral action-choice) so the ball carrier's team can choose next action.
    // (standardPassState defined below after the per-type tests fixtures)
    const tempPassState: GameState = {
      ...passState,
      lastActionType: 'STANDARD_PASS',
      passTargetHex: { q: 20, r: 7 }, // empty hex — ball delivered with carrierId null
    };
    const result = applyRoll(tempPassState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).not.toBe('SHOT'); // SHOT is NOT the result of accurate pass
      expect(result.state.lastDiceRoll).toBeDefined();
      expect(result.state.lastDiceRoll?.context).toBe('PASS_ACCURACY');
      expect(result.state.lastDiceRoll?.rolls).toContain(4);
      // lastActionType should be STANDARD_PASS
      expect(result.state.lastActionType).toBe('STANDARD_PASS');
      // actionCount should increase by 1 (STANDARD pass costs +1 min per D-03)
      expect(result.state.actionCount).toBe(1);
    }
  });

  it('PASS inaccurate HIGH_PASS (highPass+dice < 8) → LOOSE_BALL; ball.carrierId null; ball.position unchanged', () => {
    // Uses HIGH_PASS lastActionType so accuracy check fires. homePiece.highPass=5; dice=1 → 5+1=6 < 8 → inaccurate
    const tempHighPassState: GameState = {
      ...passState,
      lastActionType: 'HIGH_PASS',
      passTargetHex: { q: 20, r: 7 },
    };
    const result = applyRoll(tempHighPassState, 1, 2, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('LOOSE_BALL');
      expect(result.state.ball.carrierId).toBeNull();
      // Ball stays at incident hex — no inline landing computed (eliminates double-bounce bug)
      expect(result.state.ball.position).toEqual(passState.ball.position);
      expect(result.state.lastDiceRoll?.context).toBe('PASS_ACCURACY');
      // Only the failed accuracy die (d1=1) is included; d2 is not consumed here
      expect(result.state.lastDiceRoll?.rolls).toEqual([1]);
    }
  });

  // ---- PASS branch — per-type accuracy, ball delivery, interception (PASS-01/02/03) ----

  /** homeTeammate placed at the target hex so delivery can set carrierId */
  const homeTeammate: PlayerPiece = {
    id: 'home-2',
    teamId: 'home',
    firstName: 'Home',
    lastName: 'MID',
    number: 6,
    nationality: 'Test',
    role: 'MID',
    position: { q: 17, r: 7 },
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

  /** A defending piece adjacent to the pass path (for interception tests).
   *  Placed at {q:13, r:8} — adjacent to path hex {q:13, r:7} but NOT on the path itself
   *  (STANDARD path blocking only fires on pieces ON intermediate hexes, not adjacent ones).
   *  validatePass ZoI check picks up defenders within 1 hex of travel-path hexes. */
  const interceptorPiece: PlayerPiece = {
    id: 'away-int',
    teamId: 'away',
    firstName: 'Away',
    lastName: 'Interceptor',
    number: 3,
    nationality: 'Test',
    role: 'MID',
    position: { q: 13, r: 8 }, // adjacent (ZoI) to path hex {q:13, r:7}, not blocking the path
    pace: 7,
    shooting: 4,
    tackling: 6,
    dribbling: 4,
    saving: 1,
    handling: 1,
    resilience: 5,
    aerialAbility: 4,
    highPass: 4,
  };

  /** STANDARD_PASS state: handler sets lastActionType before calling applyRoll */
  const standardPassState: GameState = {
    ...passState,
    pieces: [homePiece, homeTeammate, awayGK],
    lastActionType: 'STANDARD_PASS',
    passTargetHex: { q: 17, r: 7 }, // homeTeammate is at q:17
  };

  /** FIRST_TIME_PASS state */
  const firstTimePassState: GameState = {
    ...passState,
    pieces: [homePiece, homeTeammate, awayGK],
    lastActionType: 'FIRST_TIME_PASS',
    passTargetHex: { q: 17, r: 7 },
  };

  /** HIGH_PASS state: homePiece.highPass=5 */
  const highPassState: GameState = {
    ...passState,
    pieces: [homePiece, homeTeammate, awayGK],
    lastActionType: 'HIGH_PASS',
    passTargetHex: { q: 17, r: 7 },
  };

  /** LONG_BALL state: homePiece.highPass=5 */
  const longBallState: GameState = {
    ...passState,
    pieces: [homePiece, homeTeammate, awayGK],
    lastActionType: 'LONG_BALL',
    passTargetHex: { q: 17, r: 7 },
  };

  /** Interception state: interceptorPiece is adjacent to pass path (PASS-01) */
  const interceptionPassState: GameState = {
    ...passState,
    pieces: [homePiece, homeTeammate, awayGK, interceptorPiece],
    lastActionType: 'STANDARD_PASS',
    passTargetHex: { q: 17, r: 7 },
    preGeneratedInterceptionDice: [6], // die=6 → interception success
  };

  /** Interception state where defender fails to intercept */
  const noInterceptionPassState: GameState = {
    ...passState,
    pieces: [homePiece, homeTeammate, awayGK, interceptorPiece],
    lastActionType: 'STANDARD_PASS',
    passTargetHex: { q: 17, r: 7 },
    preGeneratedInterceptionDice: [2], // die=2, tackling=6: 2+6=8 < 10, not 6 → fail
  };

  it('STANDARD_PASS (PASS-02): ball delivered to passTargetHex; no accuracy check; passTargetHex cleared', () => {
    // homePiece.highPass=5; even die=1 would make 5+1=6 < 8 for HIGH accuracy check
    // But STANDARD_PASS skips accuracy check entirely (D-01)
    const result = applyRoll(standardPassState, 1, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ball delivered to target hex
    expect(result.state.ball.position).toEqual({ q: 17, r: 7 });
    // Ball carrier set to homeTeammate at target
    expect(result.state.ball.carrierId).toBe('home-2');
    // Phase stays PASS (neutral action choice)
    expect(result.state.phase).toBe('PASS');
    // lastActionType set to STANDARD_PASS
    expect(result.state.lastActionType).toBe('STANDARD_PASS');
    // actionCount +1 (standard pass costs 1 minute)
    expect(result.state.actionCount).toBe(1);
    // passTargetHex cleared to null
    expect(result.state.passTargetHex).toBeNull();
  });

  it('FIRST_TIME_PASS (PASS-02) occupied target: BUG-12 toggle off → delivers directly to teammate (no FIRST_TIME_PASS_MOVE); passTimeCost 0', () => {
    // firstTimePassState.passTargetHex equals homeTeammate.position {q:17,r:7}.
    // With FTP_MOVE_ENABLED=false (BUG-12 default), ball is delivered directly and phase
    // transitions to PASS instead of entering the two-slot FIRST_TIME_PASS_MOVE sub-phase.
    // The interception bypass (isFirstTimePass guard) still applies — this is not an intercept.
    const result = applyRoll(firstTimePassState, 1, 3, 3); // die=1 would fail HIGH accuracy
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // BUG-12 toggle off: direct delivery to PASS, skipping FIRST_TIME_PASS_MOVE
    expect(result.state.phase).toBe('PASS');
    // homeTeammate picks up the ball at target hex
    expect(result.state.ball.carrierId).toBe('home-2');
    expect(result.state.ball.position).toEqual({ q: 17, r: 7 });
    expect(result.state.lastActionType).toBe('FIRST_TIME_PASS');
    // passTargetHex cleared (no repositioning phase needed)
    expect(result.state.passTargetHex).toBeNull();
    // FIRST_TIME_PASS costs 0 minutes (passTimeCost=0 unchanged)
    expect(result.state.actionCount).toBe(0);
  });

  it('FIRST_TIME_PASS (PASS-02) empty target: BUG-12 toggle off → delivers to empty hex (no FIRST_TIME_PASS_MOVE)', () => {
    // passTargetHex points at an EMPTY hex — ball delivered with no carrier.
    const emptyTargetFirstTimePassState: GameState = {
      ...firstTimePassState,
      pieces: firstTimePassState.pieces.filter((p) => p.id !== homeTeammate.id),
      passTargetHex: { q: 20, r: 7 },
    };
    const result = applyRoll(emptyTargetFirstTimePassState, 1, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // BUG-12 toggle off: direct delivery to PASS, skipping FIRST_TIME_PASS_MOVE
    expect(result.state.phase).toBe('PASS');
    expect(result.state.ball.carrierId).toBeNull();
    expect(result.state.ball.position).toEqual({ q: 20, r: 7 });
    expect(result.state.lastActionType).toBe('FIRST_TIME_PASS');
    expect(result.state.passTargetHex).toBeNull();
    expect(result.state.actionCount).toBe(0);
  });

  it('HIGH_PASS accurate (PASS-03): highPass=5, die=4 (combined 9 >= 8) → ball delivered; phase HEADER; headerContestants initialized', () => {
    // homePiece.highPass=5; die=4: 5+4=9 >= 8 → accurate
    const result = applyRoll(highPassState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball.position).toEqual({ q: 17, r: 7 });
    expect(result.state.ball.carrierId).toBeNull(); // ball in air during header contest
    expect(result.state.phase).toBe('HEADER');
    expect(result.state.lastActionType).toBe('HIGH_PASS');
    // headerContestants initialized; away auto-confirmed (no away piece within 2 hexes of target)
    expect(result.state.headerContestants).toEqual({ home: [], away: [] });
    expect(result.state.headerConfirmed).toEqual({ home: false, away: true });
    expect(result.state.actionCount).toBe(1); // +1 for HIGH_PASS
    expect(result.state.passTargetHex).toBeNull();
  });

  it('HIGH_PASS inaccurate (PASS-03): highPass=5, die=2 (combined 7 < 8) → LOOSE_BALL; ball stays at carrier', () => {
    // homePiece.highPass=5; die=2: 5+2=7 < 8 → inaccurate
    const result = applyRoll(highPassState, 2, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.ball.carrierId).toBeNull();
    // Ball stays at carrier position
    expect(result.state.ball.position).toEqual({ q: 10, r: 7 });
    expect(result.state.actionCount).toBe(1);
    expect(result.state.passTargetHex).toBeNull();
  });

  it('LONG_BALL accurate (PASS-03): highPass=5, die=4 (combined 9 >= 9 LONG_SAME_THIRD) → ball delivered; phase PASS; lastActionType LONG_BALL', () => {
    // homePiece.highPass=5; die=4: 5+4=9 >= 9 → accurate (LONG_SAME_THIRD threshold)
    const result = applyRoll(longBallState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball.position).toEqual({ q: 17, r: 7 });
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('LONG_BALL');
    expect(result.state.actionCount).toBe(1);
    expect(result.state.passTargetHex).toBeNull();
  });

  it('PASS-01 interception: die=6 → interceptor takes possession; lastActionType SUCCESSFUL_TACKLE', () => {
    // preGeneratedInterceptionDice=[6]; die===6 → interception success
    const result = applyRoll(interceptionPassState, 4, 3, 3); // d1=4 → accurate STANDARD (skips check anyway)
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Interceptor gets ball
    expect(result.state.ball.carrierId).toBe('away-int');
    expect(result.state.ball.position).toEqual(interceptorPiece.position);
    // Possession flips to interceptor's team
    expect(result.state.attackingTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    expect(result.state.phase).toBe('PASS');
    expect(result.state.passTargetHex).toBeNull();
  });

  it('PASS-01 no interception: die=2, tackling=6: combined 8 < 10 → ball delivered normally', () => {
    // preGeneratedInterceptionDice=[2]; 6+2=8 < 10, not 6 → no interception
    const result = applyRoll(noInterceptionPassState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Ball delivered to target
    expect(result.state.ball.position).toEqual({ q: 17, r: 7 });
    expect(result.state.ball.carrierId).toBe('home-2'); // homeTeammate
    expect(result.state.attackingTeam).toBe('home'); // no flip
    expect(result.state.lastActionType).toBe('STANDARD_PASS');
  });

  it('PASS with passTargetHex=null → WRONG_PHASE (D-10 T-08.2-03)', () => {
    const state: GameState = {
      ...standardPassState,
      passTargetHex: null,
    };
    const result = applyRoll(state, 4, 3, 3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
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
      expect(result.state.phase).toBe('KICK_OFF_SETUP'); // D-23: goal → KICK_OFF_SETUP for repositioning
      expect(result.state.score.home).toBe(1); // home is attacking team
      expect(result.state.lastDiceRoll?.context).toBe('SHOT_DUEL');
      expect(result.state.lastDiceRoll?.rolls).toHaveLength(3);
    }
  });

  it('die=1 participates in duel — no auto-miss rule', () => {
    // shooter at q:10 (outside awayPenaltyArea) → -1 outside-area penalty
    // shooter: 9+1-1=9; GK (dist=0, no penalty): 9+3=12 → GK wins → handling die=3 < handling=8 → caught
    const result = applyRoll(shotState, 1, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('GK_RESTART'); // GK wins, catches (handling die 3 < gk.handling 8)
      expect(result.state.score.home).toBe(0); // no goal
      expect(result.state.lastDiceRoll?.context).toBe('SHOT_DUEL');
    }
  });

  it('SHOT tie (shooterScore === gkScore) → LOOSE_BALL (D-13), ball.carrierId null, ball.position unchanged', () => {
    // shooter at q:10 (outside awayPenaltyArea) → -1 outside-area penalty
    // shooterScore = 9+4-1=12; gkScore (dist=0, no penalty) = 9+3=12 → tie → LOOSE_BALL
    const result = applyRoll(shotState, 4, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('LOOSE_BALL');
      expect(result.state.ball.carrierId).toBeNull();
      // Ball stays at incident hex — landing resolved on next game:roll with fresh dice
      expect(result.state.ball.position).toEqual(shotState.ball.position);
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
  // Updated in 08.2-03: HEADER now reads headerContestants (D-17).
  // GK aerial challenge deferred to 8.3 (D-22); attacker wins → PASS phase.

  it('HEADER uncontested (defender did not select) — attacker auto-wins → PASS, no dice needed (HEAD-02)', () => {
    // headerContestants: home selected, away null → uncontested auto-win
    // HEAD-02: result must not depend on dice values; phase → PASS with attacker holding ball
    const stateWithContestant: GameState = {
      ...headerState,
      headerContestants: { home: ['home-9'], away: [] },
      headerConfirmed: { home: true, away: false },
    };
    const result = applyRoll(stateWithContestant, 1, 1, 1); // worst dice — auto-win must not rely on them
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('PASS'); // D-22: attacker wins → PASS (GK aerial deferred to 8.3)
      expect(result.state.ball.carrierId).toBe('home-9');
      expect(result.state.lastDiceRoll?.context).toBe('HEADING_DUEL');
      // HEAD-02: no defender die involvement; uncontested
      expect(result.state.headerContestants ?? null).toBeNull();
    }
  });

  it('HEADER neither selected — both contestants null → LOOSE_BALL from ball.position (D-19)', () => {
    // Neither team selected a contestant (headerContestants absent/null)
    const result = applyRoll(headerState, 1, 3, 3); // headerState has no headerContestants
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('LOOSE_BALL'); // D-19: neither selected → LOOSE_BALL
      expect(result.state.ball.carrierId).toBeNull();
      expect(result.state.lastDiceRoll?.context).toBe('HEADING_DUEL');
    }
  });

  it('HEADER contested — defender wins → phase PASS with defending team now attacking', () => {
    // headerStateContested: awayDEF at q:11 (1 hex from ball at q:10) → contested
    // attacker.heading=6; attackerDice=1 → 6+1=7
    // awayDEF.heading=6; defenderDice=5 → 6+5=11 → defender wins
    const stateWithContestants: GameState = {
      ...headerStateContested,
      headerContestants: { home: ['home-9'], away: ['away-1'] },
      headerConfirmed: { home: true, away: true },
    };
    const result = applyRoll(stateWithContestants, 1, 5, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('PASS');
      expect(result.state.lastDiceRoll?.context).toBe('HEADING_DUEL');
      // D-21: contestedPieceIds set to both participants
      expect(result.state.contestedPieceIds).toContain('home-9');
      expect(result.state.contestedPieceIds).toContain('away-1');
    }
  });

  it('HEADER tie (attackerScore === defenderScore) → LOOSE_BALL (D-13), ball.position unchanged, carrierId null', () => {
    // headerStateContested: awayDEF at q:11 (1 hex from ball at q:10) → contested
    // attacker.heading=6; attackerDice=3 → 6+3=9; awayDEF.heading=6; defenderDice=3 → 6+3=9 → tie
    const result = applyRoll(headerStateContested, 3, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('LOOSE_BALL');
      expect(result.state.ball.carrierId).toBeNull();
      // Ball stays at incident hex — landing resolved on next game:roll with fresh dice
      expect(result.state.ball.position).toEqual(headerStateContested.ball.position);
      expect(result.state.lastDiceRoll?.context).toBe('HEADING_DUEL');
    }
  });

  // ---- LOOSE_BALL branch ----

  it('LOOSE_BALL → ball.position moves to computed landing; carrierId null; phase PASS (D-23/D-24)', () => {
    // D-23/D-24: LOOSE_BALL resolves to PASS (not MOVEMENT); movement restriction enforced by
    // ELIGIBLE_NEXT_ACTIONS['DEFLECTION']. dice: direction=1 (E: +q), distance=3 → landing near ball.
    // looseBallState has no pieces on trajectory → D-24 empty-landing case.
    const result = applyRoll(looseBallState, 1, 3, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('PASS'); // D-23/D-24: LOOSE_BALL resolves to PASS
      expect(result.state.ball.carrierId).toBeNull();
      expect(result.state.lastDiceRoll?.context).toBe('LOOSE_BALL');
      expect(result.state.lastDiceRoll?.rolls).toHaveLength(2);
      expect(result.state.lastActionType).toBe('DEFLECTION'); // D-20: LOOSE_BALL resolves → DEFLECTION
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
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 23, r: 7 },
  pace: 2,
  shooting: 1,
  tackling: 4,
  dribbling: 3,
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
  ballZone: 'middle',
  // Phase 8 fields
  addedTime: null,
  lastActionType: 'SHOT',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'cosmos', away: 'xolos' }, // Phase 16 D-15
  gameSpeed: 'standard', // UX-07 (Phase 18.4)
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
      expect(result.state.phase).toBe('MOVE');
      expect(result.state.attackingTeam).toBe('away'); // GK team
      expect(result.state.ball.carrierId).toBe('away-0'); // still GK
      expect(result.state.lastDiceRoll).toBeNull();
      // Gap 1 fix: MOVEMENT phase must be playable
      expect(result.state.movementSlot).toBe('ATTACKER_4');
      expect(result.state.movedPieceIds).toEqual([]);
      expect(result.state.paceUsedByPieceId).toEqual({});
    }
  });

  // ---- throw branch ----

  it("'throw' → phase QUICK_THROW, attackingTeam = GK's team, ball stays with GK, lastDiceRoll null (D-25)", () => {
    const result = applyGKRestart(gkRestartState, 'throw', () => 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('GK_QUICK_THROW');
      expect(result.state.attackingTeam).toBe('away'); // GK team
      expect(result.state.ball.carrierId).toBe('away-0'); // ball still with GK
      expect(result.state.lastDiceRoll).toBeNull();
    }
  });

  // ---- kick branch: target selection phase ----

  it("'kick' → phase GK_KICK_TARGET, attackingTeam = GK team, ball still with GK, no dice rolled yet", () => {
    // New behavior: kick now transitions to GK_KICK_TARGET for target selection.
    // Accuracy check + repositioning happen in GK_KICK_MOVEMENT after target is selected.
    const result = applyGKRestart(gkRestartState, 'kick', () => 6);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('GK_KICK_TARGET');
      expect(result.state.attackingTeam).toBe('away'); // GK team
      expect(result.state.activeTeam).toBe('away');
      expect(result.state.ball.carrierId).toBe('away-0'); // ball still with GK (target not selected yet)
      expect(result.state.lastDiceRoll).toBeNull(); // no dice rolled at this stage
      expect(result.state.lastActionType).toBeNull();
    }
  });

  it("'kick' with high-highPass GK → same GK_KICK_TARGET transition (dice deferred to applyGKKickTarget)", () => {
    // rollDie injected but not called — accuracy is deferred until GK_KICK_MOVEMENT ends
    let callCount = 0;
    const mockDie = (): number => {
      callCount++;
      return 6;
    };
    const result = applyGKRestart(gkRestartHighPassState, 'kick', mockDie);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('GK_KICK_TARGET');
      expect(callCount).toBe(0); // rollDie never called in the new kick branch
    }
  });

  it('regression: applyMove on post-GK-restart state is not rejected with WRONG_SLOT', () => {
    // Regression guard for Gap 1: after applyGKRestart('movement'), the returned
    // MOVEMENT state must be accepted by applyMove (not rejected with WRONG_SLOT).
    // gkRestartState: pieces = [homePiece (home-9), gkPiece (away-0)]
    // After movement restart, attackingTeam = 'away' = GK team; movementSlot = 'ATTACKER_4'
    // The GK piece (away-0) belongs to the attackingTeam ('away') and can move
    const restartResult = applyGKRestart(gkRestartState, 'movement', () => 3);
    expect(restartResult.ok).toBe(true);
    if (!restartResult.ok) return;

    const postRestartState = restartResult.state;
    // GK is at { q: 23, r: 7 }; try to move one hex to { q: 24, r: 7 }
    const moveResult = applyMove(postRestartState, 'away-0', { q: 24, r: 7 });
    // The move may fail for game logic reasons (ZoI, pace, etc.) but must NOT be WRONG_SLOT
    if (!moveResult.ok) {
      expect(moveResult.reason).not.toBe('WRONG_SLOT');
    }
  });
});

// ---------------------------------------------------------------------------
// applyGKKickTarget (Quick-task 260621-b8f, finding #4: GK_PUNT event emission)
// ---------------------------------------------------------------------------

/** GK_KICK_TARGET state: away GK holds the ball and selects a punt destination. */
const gkKickTargetState: GameState = {
  ...gkRestartState,
  phase: 'GK_KICK_TARGET',
  ball: { position: gkPiece.position, carrierId: 'away-0' },
};

describe('applyGKKickTarget', () => {
  it('appends exactly one GK_PUNT event with correct passerId/from/to and null ballAfter carrier', () => {
    const targetHex = { q: 23, r: 12 }; // middleThird — not home GK's restricted homeThird, not own hex
    const result = applyGKKickTarget(gkKickTargetState, targetHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const puntEvents = result.state.eventLog.filter((e) => e.type === 'GK_PUNT');
    expect(puntEvents).toHaveLength(1);
    const puntEvent = puntEvents[0];
    expect(puntEvent).toBeDefined();
    if (puntEvent?.type !== 'GK_PUNT') return;
    expect(puntEvent.passerId).toBe('away-0');
    expect(puntEvent.from).toEqual(gkPiece.position);
    expect(puntEvent.to).toEqual(targetHex);
    expect(puntEvent.ballAfter).toEqual({ position: targetHex, carrierId: null });
  });

  it('transitions to GK_KICK_MOVE with ball at targetHex, carrierId null', () => {
    const targetHex = { q: 23, r: 12 };
    const result = applyGKKickTarget(gkKickTargetState, targetHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_KICK_MOVE');
    expect(result.state.ball).toEqual({ position: targetHex, carrierId: null });
  });
});
