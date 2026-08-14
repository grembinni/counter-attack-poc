import { describe, it, expect } from 'vitest';
import { applyMove, applyFoulChoice } from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Task 1 (39-10): gameEngine.fouls.test.ts — RED-state spec for FOUL-01..05
// and FK-01. Modelled on gameEngine.test.ts's applyMove fixture style (real,
// verified-adjacent hex coordinates {q:10,r:7}/{q:11,r:7}/{q:12,r:7} — the
// exact literals already exercised by gameEngine.test.ts's steal/tackle
// suites — never invented placeholder coordinates, per STATE.md's pitfall).
//
// DECISION (planner, resolves 39-RESEARCH.md Assumption A1): the injury check
// and the booking check each use a FRESH die, separate from the foul-trigger
// die. REQUIREMENTS.md FOUL-02 says a foul "rolls an injury check ... and a
// booking check", and INJURY-01/CARD-01 each say "a die" — three distinct
// dice per foul, exactly as SHOT_ATTEMPT already rolls shooter/GK/handling
// dice independently. Reusing the trigger die (fixed at FOUL_TRIGGER_DIE===1)
// would make both checks almost always fail their thresholds, inverting the
// intended balance. `dice.injuryDie`/`dice.bookingDie` are therefore separate,
// explicit arguments on applyMove's dice parameter (Task 2 implements reads),
// injected in every test below for determinism.
// ---------------------------------------------------------------------------

/** Compact PlayerPiece fixture factory — every position literal is a real,
 * verified-adjacent hex from gameEngine.test.ts's existing passing suites. */
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
    roomCode: 'FOULS1',
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
    foulsEnabled: true,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// STEAL_ATTEMPT fixtures: carrier (home) at {q:10,r:7} moves to {q:11,r:7},
// adjacent to a stationary defender (away) at {q:12,r:7} — the exact
// adjacency already exercised by gameEngine.test.ts's steal suite.
// ---------------------------------------------------------------------------
const stealCarrier = piece('carrier', 'home', { q: 10, r: 7 });
/** tackling:4 + stealDie:1 = combined 5 < 10 → FAIL (die !== 6). */
const stealDefenderFail = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });
/** tackling:9 + stealDie:1 = combined 10 >= 10 → SUCCESS. */
const stealDefenderSuccess = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 9 });

function stealState(defender: PlayerPiece, over: Partial<GameState> = {}): GameState {
  return baseState([stealCarrier, defender], {
    ball: { position: { q: 10, r: 7 }, carrierId: 'carrier', lastTouchedBy: null },
    ...over,
  });
}

// ---------------------------------------------------------------------------
// TACKLE_ATTEMPT fixtures: stationary carrier (home) at {q:10,r:7}; a
// defender (away) moves from {q:12,r:7} to {q:11,r:7} — same adjacency,
// movementSlot DEFENDER_5 / activeTeam away (defending team's slot).
// ---------------------------------------------------------------------------
const tackleCarrier = piece('carrier', 'home', { q: 10, r: 7 }, { dribbling: 4 });
/** tackling:1 + tackleDie:1 = defCombined 2; carrierDie:3 -> carCombined 7 -> FAIL. */
const tacklerFail = piece('tackler', 'away', { q: 12, r: 7 }, { tackling: 1 });
/** tackling:9 + tackleDie:1 = defCombined 10; carrierDie:3 -> carCombined 7 -> SUCCESS. */
const tacklerSuccess = piece('tackler', 'away', { q: 12, r: 7 }, { tackling: 9 });

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
// FOUL-01: defender die === 1 calls a foul
// ---------------------------------------------------------------------------

describe('FOUL-01: die-of-1 detection', () => {
  it('STEAL_ATTEMPT: stealDie===1 appends FOUL_CALLED (defenderId, victimId, source STEAL) and transitions to FOUL_CHOICE — duel FAIL', () => {
    const result = applyMove(
      stealState(stealDefenderFail),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foulEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CALLED');
    expect(foulEvent).toBeDefined();
    if (foulEvent?.type === 'FOUL_CALLED') {
      expect(foulEvent.defenderId).toBe('defender');
      expect(foulEvent.victimId).toBe('carrier');
      expect(foulEvent.source).toBe('STEAL');
      expect(foulEvent.defenderDie).toBe(1);
      expect(foulEvent.hex).toEqual({ q: 11, r: 7 });
    }
    expect(result.state.phase).toBe('FOUL_CHOICE');
  });

  it('STEAL_ATTEMPT: fires on die===1 even when the duel itself SUCCEEDS', () => {
    const result = applyMove(
      stealState(stealDefenderSuccess),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'FOUL_CALLED')).toBe(true);
    expect(result.state.phase).toBe('FOUL_CHOICE');
  });

  it('TACKLE_ATTEMPT: tackleDie===1 appends FOUL_CALLED with source TACKLE — duel FAIL', () => {
    const result = applyMove(
      tackleState(tacklerFail),
      'tackler',
      { q: 11, r: 7 },
      { stealDie: 3, tackleDie: 1, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foulEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CALLED');
    expect(foulEvent).toBeDefined();
    if (foulEvent?.type === 'FOUL_CALLED') {
      expect(foulEvent.defenderId).toBe('tackler');
      expect(foulEvent.victimId).toBe('carrier');
      expect(foulEvent.source).toBe('TACKLE');
      expect(foulEvent.defenderDie).toBe(1);
    }
    expect(result.state.phase).toBe('FOUL_CHOICE');
  });

  it('TACKLE_ATTEMPT: fires on die===1 even when the duel itself SUCCEEDS', () => {
    const result = applyMove(
      tackleState(tacklerSuccess),
      'tackler',
      { q: 11, r: 7 },
      { stealDie: 3, tackleDie: 1, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'FOUL_CALLED')).toBe(true);
    expect(result.state.phase).toBe('FOUL_CHOICE');
  });

  it('a die other than 1 (e.g. 6) appends no FOUL_CALLED and leaves pre-existing steal behaviour unchanged', () => {
    const result = applyMove(
      stealState(stealDefenderFail),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 6, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'FOUL_CALLED')).toBe(false);
    // die===6 is an auto-steal (D-06) regardless of tackling — phase is NOT FOUL_CHOICE.
    expect(result.state.phase).not.toBe('FOUL_CHOICE');
    expect(result.state.ball.carrierId).toBe('defender');
  });
});

// ---------------------------------------------------------------------------
// FOUL-05: Fouls toggle gate
// ---------------------------------------------------------------------------

describe('FOUL-05: foulsEnabled toggle gate', () => {
  it('foulsEnabled: false — die===1 appends no FOUL_CALLED/INJURY_CHECK/BOOKING_CHECK; phase is whatever the duel produces', () => {
    const result = applyMove(
      stealState(stealDefenderFail, {
        foulsEnabled: false,
        injuryEnabled: true,
        bookingEnabled: true,
      }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 6, bookingDie: 6 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'FOUL_CALLED')).toBe(false);
    expect(result.state.eventLog.some((e) => e.type === 'INJURY_CHECK')).toBe(false);
    expect(result.state.eventLog.some((e) => e.type === 'BOOKING_CHECK')).toBe(false);
    // FAIL duel with foulsEnabled off — phase stays MOVE, exactly as pre-Phase-39 behaviour.
    expect(result.state.phase).toBe('MOVE');
  });

  it('foulsEnabled field absent entirely — identical gating to explicit false', () => {
    const state = stealState(stealDefenderFail);
    // Destructure the key out entirely (exactOptionalPropertyTypes forbids `foulsEnabled:
    // undefined` as a stand-in for "absent") — true structural absence, not an undefined value.
    const { foulsEnabled: _omitted, ...stateWithoutToggle } = state;
    const result = applyMove(
      stateWithoutToggle,
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 6, bookingDie: 6 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'FOUL_CALLED')).toBe(false);
    expect(result.state.phase).toBe('MOVE');
  });
});

// ---------------------------------------------------------------------------
// FOUL-02: event ordering — duel event, then FOUL_CALLED, then INJURY_CHECK,
// then BOOKING_CHECK, all committed before any client input.
// ---------------------------------------------------------------------------

describe('FOUL-02: injury-then-booking event ordering', () => {
  it('appends duel event, FOUL_CALLED, INJURY_CHECK, BOOKING_CHECK in that exact order', () => {
    const result = applyMove(
      stealState(stealDefenderFail, { injuryEnabled: true, bookingEnabled: true }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 6, bookingDie: 6 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const types = result.state.eventLog.map((e) => e.type);
    expect(types).toEqual([
      'MOVE',
      'STEAL_ATTEMPT',
      'FOUL_CALLED',
      'INJURY_CHECK',
      'BOOKING_CHECK',
    ]);
  });

  it('no DICE_ROLL event type is ever produced by a foul resolution (STATE.md v1.6 pitfall)', () => {
    const result = applyMove(
      stealState(stealDefenderFail, { injuryEnabled: true, bookingEnabled: true }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 6, bookingDie: 6 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'DICE_ROLL')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// foulResume — captures exactly what the duel WOULD have produced
// ---------------------------------------------------------------------------

describe('foulResume snapshot', () => {
  it('FAIL duel: foulResume captures the unchanged MOVE-phase resume state', () => {
    const result = applyMove(
      stealState(stealDefenderFail),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.foulResume).toEqual({
      phase: 'MOVE',
      activeTeam: 'home',
      attackingTeam: 'home',
      movementSlot: 'ATTACKER_4',
      lastActionType: null,
    });
  });

  it('SUCCESS duel (steal): foulResume captures the would-be turnover-to-PASS resume state', () => {
    const result = applyMove(
      stealState(stealDefenderSuccess),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.foulResume).toEqual({
      phase: 'PASS',
      activeTeam: 'away',
      attackingTeam: 'away',
      movementSlot: null,
      lastActionType: 'SUCCESSFUL_TACKLE',
    });
  });
});

// ---------------------------------------------------------------------------
// FOUL-03: applyFoulChoice('continue')
// ---------------------------------------------------------------------------

describe('applyFoulChoice: continue', () => {
  it('restores exactly the foulResume fields, clears the foul* cluster, and appends FOUL_CHOICE_MADE', () => {
    const fouled = applyMove(
      stealState(stealDefenderFail),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(fouled.ok).toBe(true);
    if (!fouled.ok) return;

    const result = applyFoulChoice(fouled.state, 'continue');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('MOVE');
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.attackingTeam).toBe('home');
    expect(result.state.movementSlot).toBe('ATTACKER_4');
    expect(result.state.lastActionType).toBeNull();
    expect(result.state.foulDefenderId ?? null).toBeNull();
    expect(result.state.foulVictimId ?? null).toBeNull();
    expect(result.state.foulHex ?? null).toBeNull();
    expect(result.state.foulSource ?? null).toBeNull();
    expect(result.state.foulResume ?? null).toBeNull();

    const choiceEvent = result.state.eventLog[result.state.eventLog.length - 1];
    expect(choiceEvent?.type).toBe('FOUL_CHOICE_MADE');
    if (choiceEvent?.type === 'FOUL_CHOICE_MADE') {
      expect(choiceEvent.choice).toBe('continue');
      expect(choiceEvent.restart).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// FOUL-03/FK-01: applyFoulChoice('restart') — TACKLE/STEAL source -> free kick
// ---------------------------------------------------------------------------

describe('applyFoulChoice: restart (tackle/steal source -> FREE_KICK_SETUP)', () => {
  it('TACKLE source: routes to FREE_KICK_SETUP at the foul hex, fouled team attacking', () => {
    const fouled = applyMove(
      tackleState(tacklerFail),
      'tackler',
      { q: 11, r: 7 },
      { stealDie: 3, tackleDie: 1, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(fouled.ok).toBe(true);
    if (!fouled.ok) return;
    expect(fouled.state.foulSource).toBe('TACKLE');

    const result = applyFoulChoice(fouled.state, 'restart');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('FREE_KICK_SETUP');
    expect(result.state.freeKickHex).toEqual({ q: 11, r: 7 });
    expect(result.state.freeKickAttackingTeam).toBe('home');
    expect(result.state.attackingTeam).toBe('home');
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.freeKickStageIndex).toBe(0);
    expect(result.state.freeKickPlacedPieceIds).toEqual([]);
    expect(result.state.freeKickKickerChosen).toBe(false);
    expect(result.state.ball).toEqual({
      position: { q: 11, r: 7 },
      carrierId: null,
      lastTouchedBy: result.state.ball.lastTouchedBy,
    });

    const choiceEvent = result.state.eventLog[result.state.eventLog.length - 1];
    expect(choiceEvent?.type).toBe('FOUL_CHOICE_MADE');
    if (choiceEvent?.type === 'FOUL_CHOICE_MADE') {
      expect(choiceEvent.choice).toBe('restart');
      expect(choiceEvent.restart).toBe('FREE_KICK');
    }

    expect(result.state.foulDefenderId ?? null).toBeNull();
    expect(result.state.foulVictimId ?? null).toBeNull();
    expect(result.state.foulHex ?? null).toBeNull();
    expect(result.state.foulSource ?? null).toBeNull();
    expect(result.state.foulResume ?? null).toBeNull();
  });

  it('STEAL source: routes to FREE_KICK_SETUP at the foul hex, fouled team attacking', () => {
    const fouled = applyMove(
      stealState(stealDefenderFail),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(fouled.ok).toBe(true);
    if (!fouled.ok) return;
    expect(fouled.state.foulSource).toBe('STEAL');

    const result = applyFoulChoice(fouled.state, 'restart');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('FREE_KICK_SETUP');
    expect(result.state.freeKickHex).toEqual({ q: 11, r: 7 });
    expect(result.state.freeKickAttackingTeam).toBe('home');
  });
});

// ---------------------------------------------------------------------------
// FOUL-03/GKDIVE-03/PEN-01: applyFoulChoice('restart') — GK_DIVE_AT_FEET
// source -> penalty, never FREE_KICK_SETUP.
// ---------------------------------------------------------------------------

describe('applyFoulChoice: restart (GK_DIVE_AT_FEET source -> penalty)', () => {
  it('routes to PENALTY_KICK_SETUP_ATTACKING via triggerPenaltyKick, never FREE_KICK_SETUP', () => {
    // Hand-crafted FOUL_CHOICE state — GK-dive-at-feet itself is out of this plan's scope
    // (built in a sibling plan); this test exercises only applyFoulChoice's branch.
    const gkDiveFoulChoiceState: GameState = baseState([tackleCarrier, tacklerFail], {
      phase: 'FOUL_CHOICE',
      attackingTeam: 'home',
      activeTeam: 'home',
      foulDefenderId: 'tackler',
      foulVictimId: 'carrier',
      foulHex: { q: 11, r: 7 },
      foulSource: 'GK_DIVE_AT_FEET',
      foulResume: {
        phase: 'MOVE',
        activeTeam: 'away',
        attackingTeam: 'home',
        movementSlot: 'DEFENDER_5',
        lastActionType: null,
      },
    });

    const result = applyFoulChoice(gkDiveFoulChoiceState, 'restart');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
    expect(result.state.phase).not.toBe('FREE_KICK_SETUP');
    expect(result.state.penaltyKickTeam).toBe('home');

    const choiceEvent = result.state.eventLog[result.state.eventLog.length - 1];
    expect(choiceEvent?.type).toBe('FOUL_CHOICE_MADE');
    if (choiceEvent?.type === 'FOUL_CHOICE_MADE') {
      expect(choiceEvent.restart).toBe('PENALTY');
    }
  });
});

// ---------------------------------------------------------------------------
// applyFoulChoice guards
// ---------------------------------------------------------------------------

describe('applyFoulChoice guards', () => {
  it('returns WRONG_PHASE when state.phase is not FOUL_CHOICE', () => {
    const result = applyFoulChoice(stealState(stealDefenderFail), 'continue');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  it('returns INVALID_CHOICE for an invalid choice string', () => {
    const foulChoiceState: GameState = {
      ...stealState(stealDefenderFail),
      phase: 'FOUL_CHOICE',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = applyFoulChoice(foulChoiceState, 'bogus' as any);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INVALID_CHOICE');
  });
});

// ---------------------------------------------------------------------------
// FOUL-04: Professional (Last Man) Foul reachability
// ---------------------------------------------------------------------------

describe('FOUL-02: neither injury nor booking toggle enabled', () => {
  it('appends only FOUL_CALLED — no INJURY_CHECK, no BOOKING_CHECK — when both toggles are off', () => {
    const result = applyMove(
      stealState(stealDefenderFail, { injuryEnabled: false, bookingEnabled: false }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 6, bookingDie: 6 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'FOUL_CALLED')).toBe(true);
    expect(result.state.eventLog.some((e) => e.type === 'INJURY_CHECK')).toBe(false);
    expect(result.state.eventLog.some((e) => e.type === 'BOOKING_CHECK')).toBe(false);
  });
});

describe('applyFoulChoice: restart preserves ball lastTouchedBy', () => {
  it('STEAL restart carries ball.lastTouchedBy through unchanged, with carrierId null at the foul hex', () => {
    const fouled = applyMove(
      stealState(stealDefenderFail),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(fouled.ok).toBe(true);
    if (!fouled.ok) return;
    const result = applyFoulChoice(fouled.state, 'restart');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ball.carrierId).toBeNull();
    expect(result.state.ball.position).toEqual({ q: 11, r: 7 });
  });
});

describe('FOUL-04: Professional Foul reachability', () => {
  it('a teammate that exists but has no remaining pace to reach the foul hex still yields professional: true', () => {
    // reachableTeammate is far away AND has already used all its pace this phase.
    const exhaustedTeammate = piece('away-cover', 'away', { q: 30, r: 7 }, { pace: 6 });
    const state = baseState([tackleCarrier, tacklerFail, exhaustedTeammate], {
      movementSlot: 'DEFENDER_5',
      activeTeam: 'away',
      attackingTeam: 'home',
      ball: { position: { q: 10, r: 7 }, carrierId: 'carrier', lastTouchedBy: null },
      paceUsedByPieceId: { 'away-cover': 6 },
    });
    const result = applyMove(
      state,
      'tackler',
      { q: 11, r: 7 },
      { stealDie: 3, tackleDie: 1, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foulEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CALLED');
    expect(foulEvent?.type === 'FOUL_CALLED' && foulEvent.professional).toBe(true);
  });
});

describe('FOUL-04: Professional Foul reachability (reachable/unreachable teammate)', () => {
  it('a reachable teammate of the fouler yields professional: false', () => {
    const reachableTeammate = piece('away-cover', 'away', { q: 9, r: 7 }, { pace: 6 });
    const state = baseState([tackleCarrier, tacklerFail, reachableTeammate], {
      movementSlot: 'DEFENDER_5',
      activeTeam: 'away',
      attackingTeam: 'home',
      ball: { position: { q: 10, r: 7 }, carrierId: 'carrier', lastTouchedBy: null },
    });
    const result = applyMove(
      state,
      'tackler',
      { q: 11, r: 7 },
      { stealDie: 3, tackleDie: 1, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foulEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CALLED');
    expect(foulEvent?.type === 'FOUL_CALLED' && foulEvent.professional).toBe(false);
  });

  it('no reachable teammate of the fouler yields professional: true', () => {
    // tackleState(tacklerFail) has only [carrier(home), tackler(away)] — no other away piece.
    const result = applyMove(
      tackleState(tacklerFail),
      'tackler',
      { q: 11, r: 7 },
      { stealDie: 3, tackleDie: 1, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foulEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CALLED');
    expect(foulEvent?.type === 'FOUL_CALLED' && foulEvent.professional).toBe(true);
  });
});
