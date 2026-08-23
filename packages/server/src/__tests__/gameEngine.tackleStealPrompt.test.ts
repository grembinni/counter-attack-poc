import { describe, it, expect } from 'vitest';
import { applyMove } from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Phase 43 Plan 04: gameEngine.tackleStealPrompt.test.ts
//
// Task 1: applyMove's toggle-on interception into TACKLE_STEAL_PROMPT. Task 2
// (applyTackleStealChoice) and Task 3 (foul interaction) extend this file in
// their own commits.
//
// Fixture style mirrors gameEngine.fouls.test.ts's compact `piece`/`baseState`
// factories — every hex literal below is a real, verified-adjacent coordinate
// from the existing gameEngine.test.ts/gameEngine.fouls.test.ts suites, never an
// invented placeholder (STATE.md pitfall).
// ---------------------------------------------------------------------------

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
    shooting: 4,
    tackling: 4,
    dribbling: 4,
    saving: 1,
    handling: 1,
    resilience: 4,
    aerialAbility: 4,
    highPass: 4,
    ...over,
  };
}

function baseState(pieces: PlayerPiece[], over: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'TSP1',
    phase: 'MOVE',
    activeTeam: 'home',
    attackingTeam: 'home',
    pieces,
    ball: { position: { q: 10, r: 7 }, carrierId: 'carrier', lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 4 },
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: 'ATTACKER_4',
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

const NEUTRAL_DICE = { stealDie: 3, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 };

// ---------------------------------------------------------------------------
// STEAL_ATTEMPT fixtures. Destination {q:11,r:7} has 6 neighbours:
// (12,7) (12,8) (11,6) (11,8) (10,7) (10,8) — carrier starts at (10,7) and
// vacates it on the move, so up to 5 other neighbours are free for defenders.
// ---------------------------------------------------------------------------
const stealCarrier = piece('carrier', 'home', { q: 10, r: 7 });

function stealState(defenders: PlayerPiece[], over: Partial<GameState> = {}): GameState {
  return baseState([stealCarrier, ...defenders], {
    ball: { position: { q: 10, r: 7 }, carrierId: 'carrier', lastTouchedBy: null },
    ...over,
  });
}

// ---------------------------------------------------------------------------
// TACKLE_ATTEMPT fixtures: stationary carrier (home) at {q:10,r:7}; a mover
// (away) moves from {q:12,r:7} to {q:11,r:7} (adjacent to the carrier).
// ---------------------------------------------------------------------------
const tackleCarrier = piece('carrier', 'home', { q: 10, r: 7 }, { dribbling: 4 });

function tackleState(tackler: PlayerPiece, over: Partial<GameState> = {}): GameState {
  return baseState([tackleCarrier, tackler], {
    movementSlot: 'DEFENDER_5',
    activeTeam: 'away',
    attackingTeam: 'home',
    ball: { position: { q: 10, r: 7 }, carrierId: 'carrier', lastTouchedBy: null },
    ...over,
  });
}

// ---------------------------------------------------------------------------
// Task 1: applyMove toggle-on interception
// ---------------------------------------------------------------------------

describe('applyMove — TACKLE_STEAL_PROMPT interception (Task 1)', () => {
  it('STEAL single defender: enters TACKLE_STEAL_PROMPT with the exact field set', () => {
    const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });
    const state = stealState([defender], { tackleStealDeclineEnabled: true });
    const result = applyMove(state, 'carrier', { q: 11, r: 7 }, NEUTRAL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(result.state.tackleStealPromptKind).toBe('STEAL');
    expect(result.state.tackleStealPromptDefenderId).toBe('defender');
    expect(result.state.tackleStealPromptCarrierId).toBe('carrier');
    expect(result.state.tackleStealPromptQueue).toEqual([]);
    expect(result.state.tackleStealPromptTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.tackleStealPromptResume).toEqual({
      phase: 'MOVE',
      activeTeam: 'home',
      movementSlot: 'ATTACKER_4',
    });
  });

  it('STEAL three-defender ordering: tackling 7/5/3 → head is tackling-7, queue is [5,3] in order', () => {
    const d7 = piece('def7', 'away', { q: 12, r: 7 }, { tackling: 7 });
    const d5 = piece('def5', 'away', { q: 12, r: 8 }, { tackling: 5 });
    const d3 = piece('def3', 'away', { q: 11, r: 8 }, { tackling: 3 });
    const state = stealState([d7, d5, d3], { tackleStealDeclineEnabled: true });
    const result = applyMove(state, 'carrier', { q: 11, r: 7 }, NEUTRAL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.tackleStealPromptDefenderId).toBe('def7');
    expect(result.state.tackleStealPromptQueue).toEqual(['def5', 'def3']);
  });

  it('TACKLE: non-carrier mover adjacent to opposing carrier → kind TACKLE, empty queue', () => {
    const tackler = piece('tackler', 'away', { q: 12, r: 7 }, { tackling: 5 });
    const state = tackleState(tackler, { tackleStealDeclineEnabled: true });
    const result = applyMove(state, 'tackler', { q: 11, r: 7 }, NEUTRAL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(result.state.tackleStealPromptKind).toBe('TACKLE');
    expect(result.state.tackleStealPromptDefenderId).toBe('tackler');
    expect(result.state.tackleStealPromptCarrierId).toBe('carrier');
    expect(result.state.tackleStealPromptTeam).toBe('away');
    expect(result.state.tackleStealPromptQueue).toEqual([]);
  });

  it('toggle ON: eventLog gains exactly one event (MOVE) — no duel/foul events at move time', () => {
    const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });
    const state = stealState([defender], {
      tackleStealDeclineEnabled: true,
      foulsEnabled: true,
      injuryEnabled: true,
      bookingEnabled: true,
    });
    const result = applyMove(
      state,
      'carrier',
      { q: 11, r: 7 },
      {
        ...NEUTRAL_DICE,
        stealDie: 1,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog).toHaveLength(1);
    expect(result.state.eventLog[0]?.type).toBe('MOVE');
    for (const forbidden of [
      'STEAL_ATTEMPT',
      'TACKLE_ATTEMPT',
      'FOUL_CALLED',
      'INJURY_CHECK',
      'BOOKING_CHECK',
    ]) {
      expect(result.state.eventLog.some((e) => e.type === forbidden)).toBe(false);
    }
  });

  it('toggle ON: stealAttemptedByIds/tackleAttemptedByIds are byte-identical to pre-move values', () => {
    const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });
    const state = stealState([defender], {
      tackleStealDeclineEnabled: true,
      stealAttemptedByIds: ['someone-else'],
      tackleAttemptedByIds: ['another'],
    });
    const result = applyMove(state, 'carrier', { q: 11, r: 7 }, NEUTRAL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.stealAttemptedByIds).toEqual(['someone-else']);
    expect(result.state.tackleAttemptedByIds).toEqual(['another']);
  });

  it('toggle ON: piece position/paceUsedByPieceId/movedPieceIds match a plain non-duel move', () => {
    const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });
    const state = stealState([defender], { tackleStealDeclineEnabled: true });
    const result = applyMove(state, 'carrier', { q: 11, r: 7 }, NEUTRAL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const movedCarrier = result.state.pieces.find((p) => p.id === 'carrier');
    expect(movedCarrier?.position).toEqual({ q: 11, r: 7 });
    expect(result.state.paceUsedByPieceId['carrier']).toBe(1);
    expect(result.state.movedPieceIds).toEqual([]);
  });

  it('red-card exclusion: one red-carded opponent + 2 active ZoI defenders → queue is exactly the 2 active', () => {
    const active1 = piece('active1', 'away', { q: 12, r: 7 }, { tackling: 6 });
    const active2 = piece('active2', 'away', { q: 12, r: 8 }, { tackling: 4 });
    const redCarded = piece(
      'redcarded',
      'away',
      { q: 11, r: 8 },
      {
        tackling: 9,
        redCarded: true,
        onPitch: false,
      },
    );
    const state = stealState([active1, active2, redCarded], { tackleStealDeclineEnabled: true });
    const result = applyMove(state, 'carrier', { q: 11, r: 7 }, NEUTRAL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.tackleStealPromptDefenderId).toBe('active1');
    expect(result.state.tackleStealPromptQueue).toEqual(['active2']);
  });

  it('toggle OFF (absent): STEAL multi-defender move still resolves only defenders[0] (baseline pin)', () => {
    const d7 = piece('def7', 'away', { q: 12, r: 7 }, { tackling: 7 });
    const d5 = piece('def5', 'away', { q: 12, r: 8 }, { tackling: 5 });
    const state = stealState([d7, d5]); // tackleStealDeclineEnabled absent
    const result = applyMove(
      state,
      'carrier',
      { q: 11, r: 7 },
      {
        ...NEUTRAL_DICE,
        stealDie: 6, // die===6 auto-SUCCESS (D-06)
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).not.toBe('TACKLE_STEAL_PROMPT');
    const stealEvents = result.state.eventLog.filter((e) => e.type === 'STEAL_ATTEMPT');
    expect(stealEvents).toHaveLength(1);
    expect(result.state.ball.carrierId).toBe('def7'); // highest-tackling (defenders[0])
  });

  it('toggle OFF (explicit false): TACKLE resolves immediately exactly as today', () => {
    const tackler = piece('tackler', 'away', { q: 12, r: 7 }, { tackling: 9 });
    const state = tackleState(tackler, { tackleStealDeclineEnabled: false });
    const result = applyMove(state, 'tackler', { q: 11, r: 7 }, { ...NEUTRAL_DICE, tackleDie: 6 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).not.toBe('TACKLE_STEAL_PROMPT');
    const tackleEvents = result.state.eventLog.filter((e) => e.type === 'TACKLE_ATTEMPT');
    expect(tackleEvents).toHaveLength(1);
  });
});
