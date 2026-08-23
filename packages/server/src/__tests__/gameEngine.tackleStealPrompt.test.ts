import { describe, it, expect } from 'vitest';
import { applyMove, applyTackleStealChoice, applyFoulChoice } from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Phase 43 Plan 04: gameEngine.tackleStealPrompt.test.ts
//
// Task 1: applyMove's toggle-on interception into TACKLE_STEAL_PROMPT.
// Task 2: applyTackleStealChoice's decline/attempt/sequential-queue resolution
// (D-01/D-02/D-03).
// Task 3: the foul interaction — continue returns to the next queued prompt,
// restart clears the prompt cluster (D-03, 43-RESEARCH.md Pitfall 4).
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

// ---------------------------------------------------------------------------
// Task 2: applyTackleStealChoice — decline, attempt, sequential queue
// ---------------------------------------------------------------------------

describe('applyTackleStealChoice — decline/attempt/queue (Task 2)', () => {
  function promptStateSteal(defenders: PlayerPiece[], over: Partial<GameState> = {}): GameState {
    const [head, ...rest] = defenders;
    return stealState(defenders, {
      phase: 'TACKLE_STEAL_PROMPT',
      activeTeam: 'away',
      tackleStealDeclineEnabled: true,
      tackleStealPromptTeam: 'away',
      tackleStealPromptKind: 'STEAL',
      tackleStealPromptDefenderId: head!.id,
      tackleStealPromptCarrierId: 'carrier',
      tackleStealPromptQueue: rest.map((d) => d.id),
      tackleStealPromptResume: { phase: 'MOVE', activeTeam: 'home', movementSlot: 'ATTACKER_4' },
      eventLog: [],
      ...over,
    });
  }

  function promptStateTackle(tackler: PlayerPiece, over: Partial<GameState> = {}): GameState {
    return tackleState(tackler, {
      phase: 'TACKLE_STEAL_PROMPT',
      activeTeam: 'away',
      tackleStealDeclineEnabled: true,
      tackleStealPromptTeam: 'away',
      tackleStealPromptKind: 'TACKLE',
      tackleStealPromptDefenderId: tackler.id,
      tackleStealPromptCarrierId: 'carrier',
      tackleStealPromptQueue: [],
      tackleStealPromptResume: {
        phase: 'MOVE',
        activeTeam: 'away',
        movementSlot: 'DEFENDER_5',
      },
      eventLog: [],
      ...over,
    });
  }

  it('decline-empty-queue resume: restores MOVE, clears all six fields, appends TACKLE_STEAL_DECLINED, arrays unchanged', () => {
    const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });
    const state = promptStateSteal([defender]);
    const result = applyTackleStealChoice(state, false, {
      stealDie: 3,
      tackleDie: 3,
      carrierDie: 3,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('MOVE');
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.movementSlot).toBe('ATTACKER_4');
    expect(result.state.tackleStealPromptTeam).toBeNull();
    expect(result.state.tackleStealPromptKind).toBeNull();
    expect(result.state.tackleStealPromptDefenderId).toBeNull();
    expect(result.state.tackleStealPromptCarrierId).toBeNull();
    expect(result.state.tackleStealPromptQueue).toEqual([]);
    expect(result.state.tackleStealPromptResume).toBeNull();
    const declineEvents = result.state.eventLog.filter((e) => e.type === 'TACKLE_STEAL_DECLINED');
    expect(declineEvents).toHaveLength(1);
    expect(result.state.stealAttemptedByIds ?? []).not.toContain('defender');
    expect(result.state.tackleAttemptedByIds ?? []).toEqual([]);
  });

  it('decline-advances-queue: stays TACKLE_STEAL_PROMPT, defenderId becomes queue head, queue shrinks by one', () => {
    const d7 = piece('def7', 'away', { q: 12, r: 7 }, { tackling: 7 });
    const d5 = piece('def5', 'away', { q: 12, r: 8 }, { tackling: 5 });
    const state = promptStateSteal([d7, d5]);
    const result = applyTackleStealChoice(state, false, NEUTRAL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(result.state.tackleStealPromptDefenderId).toBe('def5');
    expect(result.state.tackleStealPromptQueue).toEqual([]);
  });

  it('decline-then-remove-and-reprompt (TACKLE-03): resumed state re-triggers a fresh prompt for the same defender', () => {
    const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });
    const state = promptStateSteal([defender]);
    const declineResult = applyTackleStealChoice(state, false, NEUTRAL_DICE);
    expect(declineResult.ok).toBe(true);
    if (!declineResult.ok) return;
    // Resumed to MOVE with the carrier at {q:11,r:7}. Simulate a second movement
    // step landing back adjacent to the still-eligible defender at {q:12,r:7}.
    const resumedState: GameState = {
      ...declineResult.state,
      pieces: declineResult.state.pieces.map((p) =>
        p.id === 'carrier' ? { ...p, position: { q: 11, r: 8 } } : p,
      ),
      ball: { position: { q: 11, r: 8 }, carrierId: 'carrier', lastTouchedBy: null },
    };
    const secondMove = applyMove(resumedState, 'carrier', { q: 11, r: 7 }, NEUTRAL_DICE);
    expect(secondMove.ok).toBe(true);
    if (!secondMove.ok) return;
    expect(secondMove.state.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(secondMove.state.tackleStealPromptDefenderId).toBe('defender');
  });

  it('steal-success-ends-sequence: possession transfers, phase PASS, arrays reset, queue discarded even if non-empty', () => {
    const d9 = piece('def9', 'away', { q: 12, r: 7 }, { tackling: 9 });
    const d5 = piece('def5', 'away', { q: 12, r: 8 }, { tackling: 5 });
    const state = promptStateSteal([d9, d5]);
    const result = applyTackleStealChoice(state, true, { ...NEUTRAL_DICE, stealDie: 6 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball.carrierId).toBe('def9');
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    expect(result.state.stealAttemptedByIds).toEqual([]);
    expect(result.state.tackleAttemptedByIds).toEqual([]);
    expect(result.state.tackleStealPromptQueue).toEqual([]);
    expect(result.state.tackleStealPromptDefenderId).toBeNull();
  });

  it('steal-fail-advances-queue: STEAL_ATTEMPT FAIL event appended, defender added to stealAttemptedByIds, next queued defender current', () => {
    const dFail = piece('defFail', 'away', { q: 12, r: 7 }, { tackling: 1 });
    const dNext = piece('defNext', 'away', { q: 12, r: 8 }, { tackling: 1 });
    const state = promptStateSteal([dFail, dNext]);
    const result = applyTackleStealChoice(state, true, { ...NEUTRAL_DICE, stealDie: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('TACKLE_STEAL_PROMPT');
    const stealEvents = result.state.eventLog.filter((e) => e.type === 'STEAL_ATTEMPT');
    expect(stealEvents).toHaveLength(1);
    expect(stealEvents[0]).toMatchObject({ result: 'FAIL' });
    expect(result.state.stealAttemptedByIds).toContain('defFail');
    expect(result.state.tackleStealPromptDefenderId).toBe('defNext');
    expect(result.state.tackleStealPromptQueue).toEqual([]);
  });

  it('steal-fail-empty-queue-resumes: play resumes from the snapshot', () => {
    const dFail = piece('defFail', 'away', { q: 12, r: 7 }, { tackling: 1 });
    const state = promptStateSteal([dFail]);
    const result = applyTackleStealChoice(state, true, { ...NEUTRAL_DICE, stealDie: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('MOVE');
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.movementSlot).toBe('ATTACKER_4');
    expect(result.state.tackleStealPromptDefenderId).toBeNull();
  });

  it('tackle-success mirrors applyMove toggle-off outcome for identical dice/positions', () => {
    const tackler = piece('tackler', 'away', { q: 12, r: 7 }, { tackling: 9 });
    const promptState = promptStateTackle(tackler);
    const result = applyTackleStealChoice(promptState, true, { ...NEUTRAL_DICE, tackleDie: 6 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball.carrierId).toBe('tackler');
    expect(result.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    expect(result.state.phase).toBe('PASS');

    // Compare against the toggle-off applyMove path with identical dice/positions.
    const toggleOffState = tackleState(tackler, { tackleStealDeclineEnabled: false });
    const toggleOffResult = applyMove(
      toggleOffState,
      'tackler',
      { q: 11, r: 7 },
      {
        ...NEUTRAL_DICE,
        tackleDie: 6,
      },
    );
    expect(toggleOffResult.ok).toBe(true);
    if (!toggleOffResult.ok) return;
    expect(result.state.phase).toBe(toggleOffResult.state.phase);
    expect(result.state.attackingTeam).toBe(toggleOffResult.state.attackingTeam);
    expect(result.state.ball.carrierId).toBe(toggleOffResult.state.ball.carrierId);
    expect(result.state.lastActionType).toBe(toggleOffResult.state.lastActionType);
    expect(result.state.actionCount).toBe(toggleOffResult.state.actionCount);
  });

  it('tackle-fail: carrier keeps ball, sequence resumes (empty queue)', () => {
    const tackler = piece('tackler', 'away', { q: 12, r: 7 }, { tackling: 1 });
    const promptState = promptStateTackle(tackler);
    const result = applyTackleStealChoice(promptState, true, {
      ...NEUTRAL_DICE,
      tackleDie: 3,
      carrierDie: 6,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball.carrierId).toBe('carrier');
    expect(result.state.phase).toBe('MOVE');
    expect(result.state.tackleAttemptedByIds).toContain('tackler');
  });

  it('wrong-phase rejection: state.phase !== TACKLE_STEAL_PROMPT', () => {
    const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });
    const state = stealState([defender]); // phase: MOVE
    const result = applyTackleStealChoice(state, true, NEUTRAL_DICE);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('null-field rejection: tackleStealPromptDefenderId null while phase is TACKLE_STEAL_PROMPT', () => {
    const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });
    const state = promptStateSteal([defender], { tackleStealPromptDefenderId: null });
    const result = applyTackleStealChoice(state, true, NEUTRAL_DICE);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('sequence-termination: responding N times to a sequence seeded with N-1 queued defenders always exits TACKLE_STEAL_PROMPT', () => {
    const d1 = piece('d1', 'away', { q: 12, r: 7 }, { tackling: 1 });
    const d2 = piece('d2', 'away', { q: 12, r: 8 }, { tackling: 1 });
    const d3 = piece('d3', 'away', { q: 11, r: 8 }, { tackling: 1 });
    let state: GameState = promptStateSteal([d1, d2, d3]);
    // 3 total defenders (2 queued) — decline all 3 in turn.
    for (let i = 0; i < 3; i++) {
      const result = applyTackleStealChoice(state, false, NEUTRAL_DICE);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }
    expect(state.phase).not.toBe('TACKLE_STEAL_PROMPT');
  });

  it('applyTackleStealChoice body contains no dice-generation reference (source check)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../gameEngine.ts'), 'utf-8');
    const start = source.indexOf('export function applyTackleStealChoice');
    expect(start).toBeGreaterThan(-1);
    const nextSectionMarker = source.indexOf(
      '\n// ---------------------------------------------------------------------------\n// enterGkDiveOrSkip',
      start,
    );
    expect(nextSectionMarker).toBeGreaterThan(start);
    const fnBody = source.slice(start, nextSectionMarker);
    expect(fnBody).not.toMatch(/Math\.random/);
    expect(fnBody).not.toMatch(/crypto/);
    expect(fnBody).not.toMatch(/randomInt/);
    expect(fnBody).not.toMatch(/rollDice/);
  });
});

// ---------------------------------------------------------------------------
// Task 3: Foul interaction
// ---------------------------------------------------------------------------

describe('applyTackleStealChoice / applyFoulChoice — foul interaction (Task 3)', () => {
  function promptStateStealForFoul(
    defenders: PlayerPiece[],
    over: Partial<GameState> = {},
  ): GameState {
    const [head, ...rest] = defenders;
    return stealState(defenders, {
      phase: 'TACKLE_STEAL_PROMPT',
      activeTeam: 'away',
      tackleStealDeclineEnabled: true,
      foulsEnabled: true,
      tackleStealPromptTeam: 'away',
      tackleStealPromptKind: 'STEAL',
      tackleStealPromptDefenderId: head!.id,
      tackleStealPromptCarrierId: 'carrier',
      tackleStealPromptQueue: rest.map((d) => d.id),
      tackleStealPromptResume: { phase: 'MOVE', activeTeam: 'home', movementSlot: 'ATTACKER_4' },
      eventLog: [],
      ...over,
    });
  }

  it('foul-fail-with-queue routes to FOUL_CHOICE with foulResume.phase === TACKLE_STEAL_PROMPT (already advanced to B)', () => {
    const dA = piece('defA', 'away', { q: 12, r: 7 }, { tackling: 1 });
    const dB = piece('defB', 'away', { q: 12, r: 8 }, { tackling: 1 });
    const state = promptStateStealForFoul([dA, dB]);
    // stealDie: 1 → FAIL (tackling 1 + die 1 = 2 < 10) AND triggers a foul (die===1===FOUL_TRIGGER_DIE).
    const result = applyTackleStealChoice(state, true, { ...NEUTRAL_DICE, stealDie: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('FOUL_CHOICE');
    expect(result.state.foulDuelSucceeded).toBe(false);
    expect(result.state.foulResume?.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(result.state.tackleStealPromptDefenderId).toBe('defB');
    expect(result.state.tackleStealPromptQueue).toEqual([]);
  });

  it('continue-resumes-next-prompt: applyFoulChoice(state, "continue") returns to TACKLE_STEAL_PROMPT for B', () => {
    const dA = piece('defA', 'away', { q: 12, r: 7 }, { tackling: 1 });
    const dB = piece('defB', 'away', { q: 12, r: 8 }, { tackling: 1 });
    const state = promptStateStealForFoul([dA, dB]);
    const foulResult = applyTackleStealChoice(state, true, { ...NEUTRAL_DICE, stealDie: 1 });
    expect(foulResult.ok).toBe(true);
    if (!foulResult.ok) return;
    const continueResult = applyFoulChoice(foulResult.state, 'continue');
    expect(continueResult.ok).toBe(true);
    if (!continueResult.ok) return;
    expect(continueResult.state.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(continueResult.state.tackleStealPromptDefenderId).toBe('defB');
  });

  it('restart-clears-cluster: applyFoulChoice(state, "restart") clears all six tackleStealPrompt* fields', () => {
    const dA = piece('defA', 'away', { q: 12, r: 7 }, { tackling: 1 });
    const dB = piece('defB', 'away', { q: 12, r: 8 }, { tackling: 1 });
    const state = promptStateStealForFoul([dA, dB]);
    const foulResult = applyTackleStealChoice(state, true, { ...NEUTRAL_DICE, stealDie: 1 });
    expect(foulResult.ok).toBe(true);
    if (!foulResult.ok) return;
    const restartResult = applyFoulChoice(foulResult.state, 'restart');
    expect(restartResult.ok).toBe(true);
    if (!restartResult.ok) return;
    expect(restartResult.state.tackleStealPromptTeam).toBeNull();
    expect(restartResult.state.tackleStealPromptKind).toBeNull();
    expect(restartResult.state.tackleStealPromptDefenderId).toBeNull();
    expect(restartResult.state.tackleStealPromptCarrierId).toBeNull();
    expect(restartResult.state.tackleStealPromptQueue).toEqual([]);
    expect(restartResult.state.tackleStealPromptResume).toBeNull();
  });

  it('foul-success rejects continue: SUCCESS duel that also fouls sets foulDuelSucceeded true; continue is rejected', () => {
    // High tackling + low die → SUCCESS (tackling 9 + die 1 = combined 10 >= 10), and
    // die===1 triggers the foul simultaneously (FOUL_TRIGGER_DIE===1).
    const dA = piece('defA', 'away', { q: 12, r: 7 }, { tackling: 9 });
    const state = promptStateStealForFoul([dA]);
    const result = applyTackleStealChoice(state, true, { ...NEUTRAL_DICE, stealDie: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('FOUL_CHOICE');
    expect(result.state.foulDuelSucceeded).toBe(true);
    const continueResult = applyFoulChoice(result.state, 'continue');
    expect(continueResult).toEqual({ ok: false, reason: 'CONTINUE_NOT_ALLOWED' });
  });

  it('foul-fail-empty-queue resumes to MOVE on continue', () => {
    const dA = piece('defA', 'away', { q: 12, r: 7 }, { tackling: 1 });
    const state = promptStateStealForFoul([dA]);
    const result = applyTackleStealChoice(state, true, { ...NEUTRAL_DICE, stealDie: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('FOUL_CHOICE');
    expect(result.state.foulResume?.phase).toBe('MOVE');
    const continueResult = applyFoulChoice(result.state, 'continue');
    expect(continueResult.ok).toBe(true);
    if (!continueResult.ok) return;
    expect(continueResult.state.phase).toBe('MOVE');
  });
});
