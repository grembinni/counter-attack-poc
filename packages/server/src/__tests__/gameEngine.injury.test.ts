import { describe, it, expect } from 'vitest';
import { applyMove } from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Task 1 (39-10): gameEngine.injury.test.ts — RED-state spec for INJURY-01..03.
// Fixture style mirrors gameEngine.fouls.test.ts's STEAL_ATTEMPT fixtures
// (real, verified-adjacent hex coordinates). No vi.mock('../diceUtils.js').
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
    roomCode: 'INJ1',
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
    injuryEnabled: true,
    ...over,
  };
}

// STEAL_ATTEMPT fixture — carrier(home) at {q:10,r:7} moves to {q:11,r:7},
// adjacent to a stationary defender(away) at {q:12,r:7}. The carrier is the
// FOUL VICTIM (INJURY-01's fouled player) in this scenario.
const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4 });

function foulState(
  carrierOver: Partial<PlayerPiece> = {},
  stateOver: Partial<GameState> = {},
): GameState {
  const carrier = piece('carrier', 'home', { q: 10, r: 7 }, { resilience: 4, ...carrierOver });
  return baseState([carrier, defender], {
    ball: { position: { q: 10, r: 7 }, carrierId: 'carrier', lastTouchedBy: null },
    ...stateOver,
  });
}

// ---------------------------------------------------------------------------
// INJURY-01/02: die >= resilience injures; -1 all attributes, floored at 1
// ---------------------------------------------------------------------------

describe('INJURY-01/02: injury roll and attribute degradation', () => {
  it('injuryDie===resilience appends INJURY_CHECK injured:true, degrades all 9 attributes by 1 (floored at 1), injuryCount:1', () => {
    const result = applyMove(
      foulState({
        pace: 6,
        shooting: 4,
        tackling: 4,
        dribbling: 4,
        saving: 1,
        handling: 1,
        resilience: 4,
        aerialAbility: 4,
        highPass: 4,
      }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 4, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const injuryEvent = result.state.eventLog.find((e) => e.type === 'INJURY_CHECK');
    expect(injuryEvent).toBeDefined();
    if (injuryEvent?.type === 'INJURY_CHECK') {
      expect(injuryEvent.injured).toBe(true);
      expect(injuryEvent.die).toBe(4);
      expect(injuryEvent.resilience).toBe(4);
      expect(injuryEvent.injuryCount).toBe(1);
    }
    const victim = result.state.pieces.find((p) => p.id === 'carrier');
    expect(victim?.pace).toBe(5);
    expect(victim?.shooting).toBe(3);
    expect(victim?.tackling).toBe(3);
    expect(victim?.dribbling).toBe(3);
    // saving:1 -> floored at 1 (already at floor)
    expect(victim?.saving).toBe(1);
    expect(victim?.handling).toBe(1);
    expect(victim?.resilience).toBe(3);
    expect(victim?.aerialAbility).toBe(3);
    expect(victim?.highPass).toBe(3);
    expect(victim?.injuryCount).toBe(1);
  });

  it('a GK victim with highPass:0 is left at 0 rather than being raised to 1', () => {
    const result = applyMove(
      foulState({ role: 'GK', highPass: 0, saving: 6, handling: 8, resilience: 4 }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 4, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const victim = result.state.pieces.find((p) => p.id === 'carrier');
    expect(victim?.highPass).toBe(0);
    expect(victim?.saving).toBe(5);
    expect(victim?.handling).toBe(7);
  });

  it('injuryDie < resilience appends INJURY_CHECK injured:false and leaves every attribute unchanged', () => {
    const result = applyMove(
      foulState({ resilience: 4 }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const injuryEvent = result.state.eventLog.find((e) => e.type === 'INJURY_CHECK');
    expect(injuryEvent?.type === 'INJURY_CHECK' && injuryEvent.injured).toBe(false);
    const victim = result.state.pieces.find((p) => p.id === 'carrier');
    expect(victim?.pace).toBe(6);
    expect(victim?.resilience).toBe(4);
    expect(victim?.injuryCount ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INJURY-03/D-06: second injury -> injuryCount:2, further -1, stays on pitch
// ---------------------------------------------------------------------------

describe('INJURY-03: second injury on the same player', () => {
  it('injuryCount becomes 2, every attribute drops another 1 (from its already-degraded baseline), and the player REMAINS on the pitch', () => {
    // Pre-injured victim: as if a first injury already happened (pace 6->5, resilience 4->3, etc).
    const alreadyInjuredCarrier: Partial<PlayerPiece> = {
      pace: 5,
      shooting: 3,
      tackling: 3,
      dribbling: 3,
      saving: 1, // was already at floor
      handling: 1,
      resilience: 3,
      aerialAbility: 3,
      highPass: 3,
      injuryCount: 1,
    };
    const result = applyMove(
      foulState(alreadyInjuredCarrier),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 }, // injuryDie(3) >= resilience(3)
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const injuryEvent = result.state.eventLog.find((e) => e.type === 'INJURY_CHECK');
    if (injuryEvent?.type === 'INJURY_CHECK') {
      expect(injuryEvent.injured).toBe(true);
      expect(injuryEvent.injuryCount).toBe(2);
    }
    const victim = result.state.pieces.find((p) => p.id === 'carrier');
    expect(victim).toBeDefined();
    expect(victim?.pace).toBe(4);
    expect(victim?.resilience).toBe(2);
    expect(victim?.injuryCount).toBe(2);
    // D-06: Phase 39 always takes the no-substitute branch — the piece is still present.
    expect(result.state.pieces.some((p) => p.id === 'carrier')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SETTINGS-03: Injury has no effect unless Fouls also enabled / independent toggle
// ---------------------------------------------------------------------------

describe('injuryEnabled: false, foulsEnabled: true', () => {
  it('no INJURY_CHECK is appended and attributes are unchanged', () => {
    const result = applyMove(
      foulState({ resilience: 4 }, { injuryEnabled: false }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 6, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'INJURY_CHECK')).toBe(false);
    const victim = result.state.pieces.find((p) => p.id === 'carrier');
    expect(victim?.pace).toBe(6);
    expect(victim?.resilience).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// The injury die is separate from the foul-trigger die (Assumption A1)
// ---------------------------------------------------------------------------

describe('INJURY-01: injury event carries the victimId, not the fouler', () => {
  it('INJURY_CHECK.victimId matches the FOUL_CALLED.victimId (the fouled carrier)', () => {
    const result = applyMove(
      foulState({ resilience: 4 }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 4, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const injuryEvent = result.state.eventLog.find((e) => e.type === 'INJURY_CHECK');
    expect(injuryEvent?.type === 'INJURY_CHECK' && injuryEvent.victimId).toBe('carrier');
  });
});

describe('foulsEnabled: false, injuryEnabled: true', () => {
  it('the Fouls toggle gates Injury entirely — no INJURY_CHECK when Fouls is off, regardless of the Injury toggle', () => {
    const result = applyMove(
      foulState({ resilience: 4 }, { foulsEnabled: false }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 6, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'INJURY_CHECK')).toBe(false);
  });
});

describe('injury die independence', () => {
  it('a foul triggered by stealDie:1 still uses the injected injuryDie for the injury check, not the trigger die', () => {
    // injuryDie:6 >= resilience:4 -> injured, even though the foul-trigger die was 1.
    const result = applyMove(
      foulState({ resilience: 4 }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 6, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const injuryEvent = result.state.eventLog.find((e) => e.type === 'INJURY_CHECK');
    if (injuryEvent?.type === 'INJURY_CHECK') {
      expect(injuryEvent.die).toBe(6);
      expect(injuryEvent.injured).toBe(true);
    }
  });
});
