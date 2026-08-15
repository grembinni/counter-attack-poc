/**
 * Phase 39 Plan 17, Task 2 — cross-cutting Undo/Replay registration audit.
 *
 * STATE.md v1.6 pitfall (already shipped twice as BUG-30/31 and BUG-37): "new dice-roll
 * event types are invisible to Undo/Replay unless registered in every relevant list
 * (isBoundary server + client mirror, REPLAY_ELIGIBLE_TYPES)." Phase 39 adds eleven new
 * ActionEventType members across eight new phases — the largest single batch of the
 * milestone. This suite turns every "must register X" rule from those bugs into an
 * executable invariant instead of a comment, so the defect class cannot silently
 * reappear on the next new dice-roll event type.
 *
 * The eleven new types (packages/shared/src/types.ts, Phase 39, 39-01):
 *   FOUL_CALLED, INJURY_CHECK, BOOKING_CHECK, FOUL_CHOICE_MADE, GK_DIVE_AT_FEET,
 *   GK_DIVE_AT_FEET_DECLINED, GK_BOX_ENTRY_MOVE, PENALTY_KICK_WINDOW_ADVANCE,
 *   PENALTY_KICK_TAKER_PLACED, PENALTY_KICK, SECOND_HALF_CONFIRM.
 *
 * No `vi.mock('../diceUtils.js')` anywhere in this file — every die is an explicit,
 * injected argument, mirroring gameEngine.fouls.test.ts's Assumption A1 decision comment.
 */

import { describe, it, expect } from 'vitest';
import {
  applyUndo,
  buildReplayFrames,
  resolveFoulChain,
  applyGkDiveAtFeetResponse,
  applyFoulChoice,
  applyPenaltyKickWindowEnd,
  applyPenaltyKickTaker,
  applyPenaltyKickDuel,
  REPLAY_ELIGIBLE_TYPES,
} from '../gameEngine.js';
import type {
  ActionEvent,
  ActionEventType,
  GameState,
  HexCoord,
  PlayerPiece,
} from '@counter-attack/shared';
import { FOUL_TRIGGER_DIE } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Shared fixtures — compact piece/state factories, mirroring
// gameEngine.gkDiveAtFeet.test.ts's `piece()`/`baseState()` pattern.
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
    roomCode: 'UNDOREPLAY39',
    phase: 'MOVE',
    activeTeam: 'home',
    attackingTeam: 'home',
    pieces,
    ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 10,
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
    foulsEnabled: true,
    injuryEnabled: true,
    bookingEnabled: true,
    ...over,
  };
}

const homeGk = piece('home-gk', 'home', { q: 0, r: 13 }, { role: 'GK', saving: 5 });
const awayCarrier = piece('away-carrier', 'away', { q: 1, r: 13 }, { dribbling: 4 });
const homeMover = piece('home-mover', 'home', { q: 14, r: 13 });
const awayDefender = piece('away-defender', 'away', { q: 15, r: 13 }, { tackling: 5 });

// ---------------------------------------------------------------------------
// Task item 1: enumerate all eleven new ActionEventType members and assert
// exactly one of two things holds for each — REPLAY_ELIGIBLE_TYPES membership,
// or no `ballAfter` field on the event variant. Expected classification:
// GK_DIVE_AT_FEET and PENALTY_KICK are eligible; the other nine are not.
// ---------------------------------------------------------------------------

const PHASE_39_NEW_EVENT_TYPES: ActionEventType[] = [
  'FOUL_CALLED',
  'INJURY_CHECK',
  'BOOKING_CHECK',
  'FOUL_CHOICE_MADE',
  'GK_DIVE_AT_FEET',
  'GK_DIVE_AT_FEET_DECLINED',
  'GK_BOX_ENTRY_MOVE',
  'PENALTY_KICK_WINDOW_ADVANCE',
  'PENALTY_KICK_TAKER_PLACED',
  'PENALTY_KICK',
  'SECOND_HALF_CONFIRM',
];

/** One concrete, fully-valid fixture per new event type — used for the ballAfter check. */
const eventFixtures: Partial<Record<ActionEventType, ActionEvent>> = {
  FOUL_CALLED: {
    type: 'FOUL_CALLED',
    defenderId: 'd',
    victimId: 'v',
    hex: { q: 1, r: 1 },
    source: 'TACKLE',
    defenderDie: 1,
    professional: false,
    timestamp: 0,
  },
  INJURY_CHECK: {
    type: 'INJURY_CHECK',
    victimId: 'v',
    die: 3,
    resilience: 3,
    injured: true,
    injuryCount: 1,
    timestamp: 0,
  },
  BOOKING_CHECK: {
    type: 'BOOKING_CHECK',
    defenderId: 'd',
    die: 5,
    leniency: 4,
    card: 'yellow',
    secondYellow: false,
    professional: false,
    timestamp: 0,
  },
  FOUL_CHOICE_MADE: {
    type: 'FOUL_CHOICE_MADE',
    team: 'home',
    choice: 'continue',
    restart: null,
    timestamp: 0,
  },
  GK_DIVE_AT_FEET: {
    type: 'GK_DIVE_AT_FEET',
    gkId: 'gk',
    carrierId: 'c',
    gkDie: 4,
    carrierDie: 2,
    gkCombined: 8,
    carrierCombined: 6,
    distance: 1,
    savingPenalty: 0,
    result: 'SUCCESS',
    timestamp: 0,
    ballAfter: { position: { q: 1, r: 13 }, carrierId: 'gk' },
  },
  GK_DIVE_AT_FEET_DECLINED: {
    type: 'GK_DIVE_AT_FEET_DECLINED',
    gkId: 'gk',
    carrierId: 'c',
    timestamp: 0,
  },
  GK_BOX_ENTRY_MOVE: {
    type: 'GK_BOX_ENTRY_MOVE',
    gkId: 'gk',
    from: { q: 1, r: 13 },
    to: { q: 2, r: 13 },
    timestamp: 0,
  },
  PENALTY_KICK_WINDOW_ADVANCE: {
    type: 'PENALTY_KICK_WINDOW_ADVANCE',
    from: 'ATTACKING',
    timestamp: 0,
  },
  PENALTY_KICK_TAKER_PLACED: {
    type: 'PENALTY_KICK_TAKER_PLACED',
    pieceId: 'p',
    hex: { q: 18, r: 4 },
    timestamp: 0,
  },
  PENALTY_KICK: {
    type: 'PENALTY_KICK',
    takerId: 't',
    gkId: 'gk',
    takerDie: 4,
    gkDie: 2,
    takerCombined: 8,
    gkCombined: 4,
    result: 'GOAL',
    timestamp: 0,
    ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
  },
  SECOND_HALF_CONFIRM: {
    type: 'SECOND_HALF_CONFIRM',
    team: 'home',
    bothConfirmed: false,
    timestamp: 0,
  },
};

const EXPECTED_REPLAY_ELIGIBLE = new Set<string>(['GK_DIVE_AT_FEET', 'PENALTY_KICK']);

describe('Registration audit — all 11 new ActionEventType members classified (REPLAY_ELIGIBLE_TYPES vs. no-ballAfter)', () => {
  it('enumerates exactly 11 new types', () => {
    expect(PHASE_39_NEW_EVENT_TYPES).toHaveLength(11);
    expect(new Set(PHASE_39_NEW_EVENT_TYPES).size).toBe(11);
  });

  it('every fixture above covers every enumerated type (no typo/drift between the two lists)', () => {
    for (const type of PHASE_39_NEW_EVENT_TYPES) {
      expect(eventFixtures[type], `missing fixture for ${type}`).toBeDefined();
    }
  });

  for (const type of PHASE_39_NEW_EVENT_TYPES) {
    it(`${type}: exactly one of {registered in REPLAY_ELIGIBLE_TYPES, carries no ballAfter} holds`, () => {
      const fixture = eventFixtures[type]!;
      const isEligible = REPLAY_ELIGIBLE_TYPES.has(type);
      const hasBallAfter = 'ballAfter' in fixture;
      const expectedEligible = EXPECTED_REPLAY_ELIGIBLE.has(type);

      expect(isEligible).toBe(expectedEligible);
      // The invariant: eligible <=> carries ballAfter. Never both false, never both true.
      expect(hasBallAfter).toBe(expectedEligible);
      expect(isEligible === hasBallAfter).toBe(true);
    });
  }

  it('GK_DIVE_AT_FEET and PENALTY_KICK are the only two eligible new types (matches 39-17-PLAN.md expected classification)', () => {
    const eligibleNewTypes = PHASE_39_NEW_EVENT_TYPES.filter((t) => REPLAY_ELIGIBLE_TYPES.has(t));
    expect([...eligibleNewTypes].sort()).toEqual(['GK_DIVE_AT_FEET', 'PENALTY_KICK']);
  });
});

// ---------------------------------------------------------------------------
// Task item 2: buildReplayFrames must not throw on a synthetic eventLog
// containing all eleven new types interleaved with MOVE and GOAL — the direct
// guard against the CORNER_KICK_CLEAR_OUT_MOVE crash class (a missing switch
// case crashing the render loop).
// ---------------------------------------------------------------------------

describe('buildReplayFrames — survives all 11 new event types interleaved with MOVE and GOAL', () => {
  it('completes without throwing and produces at least one frame', () => {
    const p1 = piece('p1', 'home', { q: 14, r: 13 });
    const p2 = piece('p2', 'away', { q: 20, r: 13 });
    const finalState = baseState([p1, p2], {
      selectedTeams: { home: 'city', away: 'crew' },
      kickOffTeam: 'home',
      eventLog: [
        {
          type: 'MOVE',
          pieceId: 'p1',
          from: { q: 13, r: 13 },
          to: { q: 14, r: 13 },
          slot: 'ATTACKER_4',
          timestamp: 0,
          ballAfter: { position: { q: 14, r: 13 }, carrierId: 'p1' },
        },
        eventFixtures.FOUL_CALLED!,
        eventFixtures.INJURY_CHECK!,
        eventFixtures.BOOKING_CHECK!,
        eventFixtures.FOUL_CHOICE_MADE!,
        eventFixtures.GK_DIVE_AT_FEET!,
        eventFixtures.GK_DIVE_AT_FEET_DECLINED!,
        eventFixtures.GK_BOX_ENTRY_MOVE!,
        eventFixtures.PENALTY_KICK_WINDOW_ADVANCE!,
        eventFixtures.PENALTY_KICK_TAKER_PLACED!,
        eventFixtures.PENALTY_KICK!,
        eventFixtures.SECOND_HALF_CONFIRM!,
        {
          type: 'GOAL',
          scoringTeam: 'home',
          scorerId: 'p1',
          timestamp: 100,
          ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
        },
      ] as ActionEvent[],
    });

    expect(() => buildReplayFrames(finalState)).not.toThrow();
    const frames = buildReplayFrames(finalState);
    expect(frames.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Task item 3: applyUndo must be locked whenever the current slot's events
// include a committed Phase 39 dice outcome (FOUL_CALLED, INJURY_CHECK,
// BOOKING_CHECK, GK_DIVE_AT_FEET, PENALTY_KICK) — mirrors the existing
// gameEngine.phase26-undo.test.ts / BUG-37 TACKLE_ATTEMPT/STEAL_ATTEMPT pattern.
// ---------------------------------------------------------------------------

const priorMoveEvent: ActionEvent = {
  type: 'MOVE',
  pieceId: homeMover.id,
  from: { q: 13, r: 13 },
  to: { q: 14, r: 13 },
  slot: 'ATTACKER_4',
  timestamp: 0,
  ballAfter: { position: { q: 13, r: 13 }, carrierId: null },
};

const tackleBoundaryEvent: ActionEvent = {
  type: 'TACKLE_ATTEMPT',
  defenderId: awayDefender.id,
  carrierId: homeMover.id,
  defenderDie: FOUL_TRIGGER_DIE,
  carrierDie: 5,
  defenderCombined: FOUL_TRIGGER_DIE + awayDefender.tackling,
  carrierCombined: 5 + homeMover.dribbling,
  result: 'FAIL',
  timestamp: 1,
  ballAfter: { position: { q: 14, r: 13 }, carrierId: homeMover.id },
};

describe('applyUndo — locked when the current slot includes a committed Phase 39 dice outcome', () => {
  it('locked when the eventLog ends in FOUL_CALLED (downstream of the unconditional TACKLE_ATTEMPT boundary)', () => {
    const state = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [priorMoveEvent, tackleBoundaryEvent, eventFixtures.FOUL_CALLED!],
    });
    const result = applyUndo(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('UNDO_LOCKED');
  });

  it('locked when the eventLog ends in INJURY_CHECK', () => {
    const state = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [
        priorMoveEvent,
        tackleBoundaryEvent,
        eventFixtures.FOUL_CALLED!,
        eventFixtures.INJURY_CHECK!,
      ],
    });
    const result = applyUndo(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('UNDO_LOCKED');
  });

  it('locked when the eventLog ends in BOOKING_CHECK', () => {
    const state = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [
        priorMoveEvent,
        tackleBoundaryEvent,
        eventFixtures.FOUL_CALLED!,
        eventFixtures.INJURY_CHECK!,
        eventFixtures.BOOKING_CHECK!,
      ],
    });
    const result = applyUndo(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('UNDO_LOCKED');
  });

  it('locked when the eventLog ends in a resolved GK_DIVE_AT_FEET (unconditional boundary, server-side)', () => {
    const state = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [priorMoveEvent, eventFixtures.GK_DIVE_AT_FEET!],
    });
    const result = applyUndo(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('UNDO_LOCKED');
  });

  it('locked when the eventLog ends in PENALTY_KICK (transitively protected by the antecedent GK_DIVE_AT_FEET boundary)', () => {
    const state = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [
        priorMoveEvent,
        eventFixtures.GK_DIVE_AT_FEET!,
        eventFixtures.FOUL_CALLED!,
        eventFixtures.INJURY_CHECK!,
        eventFixtures.BOOKING_CHECK!,
        eventFixtures.FOUL_CHOICE_MADE!,
        eventFixtures.PENALTY_KICK_WINDOW_ADVANCE!,
        eventFixtures.PENALTY_KICK_TAKER_PLACED!,
        eventFixtures.PENALTY_KICK!,
      ],
    });
    const result = applyUndo(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('UNDO_LOCKED');
  });
});

// ---------------------------------------------------------------------------
// Task item 4: no Phase 39 code path ever emits the generic DICE_ROLL type.
// Drives three distinct Phase 39 flows through the real engine functions
// (never hand-constructed events) and asserts zero DICE_ROLL events in each
// resulting eventLog.
// ---------------------------------------------------------------------------

describe('No Phase 39 engine path ever emits the generic DICE_ROLL event type', () => {
  it('a TACKLE-sourced foul chain (resolveFoulChain) emits zero DICE_ROLL events', () => {
    const state = baseState([homeMover, awayDefender]);
    const result = resolveFoulChain({
      state,
      pieces: state.pieces,
      eventLog: [],
      defenderId: awayDefender.id,
      victimId: homeMover.id,
      foulHex: homeMover.position,
      source: 'TACKLE',
      defenderDie: FOUL_TRIGGER_DIE,
      injuryDie: 3,
      bookingDie: 1,
    });
    expect(result.fouled).toBe(true);
    expect(result.eventLog.some((e) => e.type === 'DICE_ROLL')).toBe(false);
  });

  it('a STEAL-sourced foul chain (resolveFoulChain) emits zero DICE_ROLL events', () => {
    const state = baseState([homeMover, awayDefender]);
    const result = resolveFoulChain({
      state,
      pieces: state.pieces,
      eventLog: [],
      defenderId: awayDefender.id,
      victimId: homeMover.id,
      foulHex: homeMover.position,
      source: 'STEAL',
      defenderDie: FOUL_TRIGGER_DIE,
      injuryDie: 2,
      bookingDie: 6,
    });
    expect(result.fouled).toBe(true);
    expect(result.eventLog.some((e) => e.type === 'DICE_ROLL')).toBe(false);
  });

  it('a full GK-dive-at-feet -> foul -> penalty-kick chain, driven through the real engine functions, emits zero DICE_ROLL events', () => {
    const promptState = baseState([homeGk, awayCarrier], {
      phase: 'GK_DIVE_AT_FEET_PROMPT',
      attackingTeam: 'away',
      activeTeam: 'away',
      ball: { position: awayCarrier.position, carrierId: awayCarrier.id, lastTouchedBy: null },
      gkDiveAtFeetTeam: 'home',
      gkDiveAtFeetGkId: homeGk.id,
      gkDiveAtFeetCarrierId: awayCarrier.id,
      gkDiveAtFeetDistance: 1,
      gkDiveAtFeetResume: { phase: 'MOVE', activeTeam: 'away', movementSlot: 'ATTACKER_4' },
    });

    // Step 1: the GK's die is the FOUL_TRIGGER_DIE — GKDIVE-03 fires a foul on the dive duel.
    const diveResult = applyGkDiveAtFeetResponse(promptState, true, {
      gkDie: FOUL_TRIGGER_DIE,
      carrierDie: 6,
      injuryDie: 3,
      bookingDie: 1,
    });
    expect(diveResult.ok).toBe(true);
    if (!diveResult.ok) return;
    expect(diveResult.state.phase).toBe('FOUL_CHOICE');
    expect(diveResult.state.foulSource).toBe('GK_DIVE_AT_FEET');

    // Step 2: the fouled (carrier's) team takes the restart -> GKDIVE-03/PEN-01 routes a
    // GK-dive-sourced foul straight to a penalty kick, never a free kick.
    const choiceResult = applyFoulChoice(diveResult.state, 'restart');
    expect(choiceResult.ok).toBe(true);
    if (!choiceResult.ok) return;
    expect(choiceResult.state.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
    expect(choiceResult.state.penaltyKickTeam).toBe('away');

    // Step 3/4: advance both reposition windows (no repositioning needed for this test).
    const window1 = applyPenaltyKickWindowEnd(choiceResult.state, choiceResult.state.activeTeam);
    expect(window1.ok).toBe(true);
    if (!window1.ok) return;
    expect(window1.state.phase).toBe('PENALTY_KICK_SETUP_DEFENDING');

    const window2 = applyPenaltyKickWindowEnd(window1.state, window1.state.activeTeam);
    expect(window2.ok).toBe(true);
    if (!window2.ok) return;
    expect(window2.state.phase).toBe('PENALTY_KICK_TAKER_SELECT');

    // Step 5: the away carrier (an eligible outfield piece) is chosen as the taker.
    const takerResult = applyPenaltyKickTaker(window2.state, awayCarrier.id);
    expect(takerResult.ok).toBe(true);
    if (!takerResult.ok) return;
    expect(takerResult.state.phase).toBe('PENALTY_KICK');

    // Step 6: resolve the duel.
    const duelResult = applyPenaltyKickDuel(takerResult.state, 4, 2);
    expect(duelResult.ok).toBe(true);
    if (!duelResult.ok) return;

    const finalEventLog = duelResult.state.eventLog;
    expect(finalEventLog.some((e) => e.type === 'DICE_ROLL')).toBe(false);

    // Sanity: the full chain really did fire every step (not a silent no-op short-circuit).
    const seenTypes = new Set(finalEventLog.map((e) => e.type));
    expect(seenTypes.has('GK_DIVE_AT_FEET')).toBe(true);
    expect(seenTypes.has('FOUL_CALLED')).toBe(true);
    expect(seenTypes.has('INJURY_CHECK')).toBe(true);
    expect(seenTypes.has('BOOKING_CHECK')).toBe(true);
    expect(seenTypes.has('FOUL_CHOICE_MADE')).toBe(true);
    expect(seenTypes.has('PENALTY_KICK_WINDOW_ADVANCE')).toBe(true);
    expect(seenTypes.has('PENALTY_KICK_TAKER_PLACED')).toBe(true);
    expect(seenTypes.has('PENALTY_KICK')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task item 5: applyUndo's boundary reduce recognises each new phase-guarded
// boundary term — constructing a state in the guarding phase with that event
// as the last entry (so the resulting post-boundary slice is empty), AND a
// negative control showing the same event does NOT act as a boundary outside
// its guarding phase (proving the term is phase-SPECIFIC, not accidentally
// unconditional).
// ---------------------------------------------------------------------------

describe('applyUndo — each new phase-guarded boundary term is recognised (slice-after-boundary is empty)', () => {
  it('FOUL_CHOICE_MADE is a boundary only when phase === FOUL_CHOICE', () => {
    const guardedState = baseState([homeMover, awayDefender], {
      phase: 'FOUL_CHOICE',
      eventLog: [priorMoveEvent, eventFixtures.FOUL_CHOICE_MADE!],
    });
    const guarded = applyUndo(guardedState);
    expect(guarded.ok).toBe(false); // slice after the boundary is empty -> UNDO_LOCKED

    const unguardedState = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [priorMoveEvent, eventFixtures.FOUL_CHOICE_MADE!],
    });
    const unguarded = applyUndo(unguardedState);
    expect(unguarded.ok).toBe(true); // outside FOUL_CHOICE, the term does not fire
  });

  it('PENALTY_KICK_WINDOW_ADVANCE is a boundary only in PENALTY_KICK_SETUP_ATTACKING/DEFENDING', () => {
    const guardedState = baseState([homeMover, awayDefender], {
      phase: 'PENALTY_KICK_SETUP_DEFENDING',
      eventLog: [priorMoveEvent, eventFixtures.PENALTY_KICK_WINDOW_ADVANCE!],
    });
    const guarded = applyUndo(guardedState);
    expect(guarded.ok).toBe(false);

    const unguardedState = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [priorMoveEvent, eventFixtures.PENALTY_KICK_WINDOW_ADVANCE!],
    });
    const unguarded = applyUndo(unguardedState);
    expect(unguarded.ok).toBe(true);
  });

  it('PENALTY_KICK_TAKER_PLACED is a boundary only when phase === PENALTY_KICK_TAKER_SELECT', () => {
    const guardedState = baseState([homeMover, awayDefender], {
      phase: 'PENALTY_KICK_TAKER_SELECT',
      eventLog: [priorMoveEvent, eventFixtures.PENALTY_KICK_TAKER_PLACED!],
    });
    const guarded = applyUndo(guardedState);
    expect(guarded.ok).toBe(false);

    const unguardedState = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [priorMoveEvent, eventFixtures.PENALTY_KICK_TAKER_PLACED!],
    });
    const unguarded = applyUndo(unguardedState);
    expect(unguarded.ok).toBe(true);
  });

  it('GK_BOX_ENTRY_MOVE is a boundary only when phase === GK_BOX_ENTRY_MOVE', () => {
    const guardedState = baseState([homeMover, awayDefender], {
      phase: 'GK_BOX_ENTRY_MOVE',
      eventLog: [priorMoveEvent, eventFixtures.GK_BOX_ENTRY_MOVE!],
    });
    const guarded = applyUndo(guardedState);
    expect(guarded.ok).toBe(false);

    const unguardedState = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [priorMoveEvent, eventFixtures.GK_BOX_ENTRY_MOVE!],
    });
    const unguarded = applyUndo(unguardedState);
    expect(unguarded.ok).toBe(true);
  });

  it('SECOND_HALF_CONFIRM is a boundary only when phase === HALF_TIME', () => {
    const guardedState = baseState([homeMover, awayDefender], {
      phase: 'HALF_TIME',
      eventLog: [priorMoveEvent, eventFixtures.SECOND_HALF_CONFIRM!],
    });
    const guarded = applyUndo(guardedState);
    expect(guarded.ok).toBe(false);

    const unguardedState = baseState([homeMover, awayDefender], {
      phase: 'MOVE',
      eventLog: [priorMoveEvent, eventFixtures.SECOND_HALF_CONFIRM!],
    });
    const unguarded = applyUndo(unguardedState);
    expect(unguarded.ok).toBe(true);
  });

  it('GK_DIVE_AT_FEET is a boundary UNCONDITIONALLY (no phase guard) — contrast case', () => {
    // Confirms the "unconditional" classification is real: it fires even in a phase
    // completely unrelated to the dive-at-feet family.
    const state = baseState([homeMover, awayDefender], {
      phase: 'HIGH_PASS_MOVE',
      eventLog: [priorMoveEvent, eventFixtures.GK_DIVE_AT_FEET!],
    });
    const result = applyUndo(state);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task item 6: an injury's stored attribute degradation must survive an Undo
// of a subsequent action — the property that makes stored mutation (rather
// than a penalty array) safe from Undo, per resolveFoulChain's design comment.
// ---------------------------------------------------------------------------

describe('An injury degradation survives Undo of a later action', () => {
  it('degraded resilience/injuryCount are unchanged after undoing a fresh MOVE that came after the injury', () => {
    const victim = piece('victim', 'home', { q: 14, r: 13 }, { resilience: 3 });
    const defender = piece('defender', 'away', { q: 15, r: 13 }, { tackling: 5 });
    const preInjuryState = baseState([victim, defender], {
      foulsEnabled: true,
      injuryEnabled: true,
    });

    const foulResult = resolveFoulChain({
      state: preInjuryState,
      pieces: preInjuryState.pieces,
      eventLog: [],
      defenderId: defender.id,
      victimId: victim.id,
      foulHex: victim.position,
      source: 'TACKLE',
      defenderDie: FOUL_TRIGGER_DIE,
      injuryDie: 3, // rollsInjury(3, resilience=3) -> die >= resilience -> injured
      bookingDie: 1,
    });
    expect(foulResult.fouled).toBe(true);
    const degradedVictim = foulResult.pieces.find((p) => p.id === victim.id)!;
    expect(degradedVictim.injuryCount).toBe(1);
    expect(degradedVictim.resilience).toBe(2); // 3 - 1, floored at 1

    // A fresh move happens after the foul resolves and play resumes.
    const freshTo: HexCoord = { q: 16, r: 13 };
    const freshMoveEvent: ActionEvent = {
      type: 'MOVE',
      pieceId: victim.id,
      from: victim.position,
      to: freshTo,
      slot: 'ATTACKER_4',
      timestamp: 1000,
      ballAfter: { position: freshTo, carrierId: victim.id },
    };

    const stateAfterResume = baseState(
      foulResult.pieces.map((p) => (p.id === victim.id ? { ...p, position: freshTo } : p)),
      {
        phase: 'MOVE',
        eventLog: [
          priorMoveEvent,
          tackleBoundaryEvent,
          ...foulResult.eventLog,
          eventFixtures.FOUL_CHOICE_MADE!,
          freshMoveEvent,
        ],
      },
    );

    const undoResult = applyUndo(stateAfterResume);
    expect(undoResult.ok).toBe(true);
    if (!undoResult.ok) return;

    const undonePiece = undoResult.state.pieces.find((p) => p.id === victim.id)!;
    // The fresh MOVE was reverted (position restored to victim's pre-move hex)...
    expect(undonePiece.position).toEqual(victim.position);
    // ...but the injury degradation is NOT reversible by Undo — it survives unchanged.
    expect(undonePiece.injuryCount).toBe(1);
    expect(undonePiece.resilience).toBe(2);
  });
});
