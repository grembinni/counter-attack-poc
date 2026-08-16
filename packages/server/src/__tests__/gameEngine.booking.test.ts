import { describe, it, expect } from 'vitest';
import { applyMove } from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Task 1 (39-10): gameEngine.booking.test.ts — RED-state spec for CARD-01..03.
// Fixture style mirrors gameEngine.fouls.test.ts's STEAL_ATTEMPT fixtures
// (real, verified-adjacent hex coordinates). No vi.mock('../diceUtils.js') —
// the engine layer stays dice-free; dice are injected explicit arguments.
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
    roomCode: 'BOOK1',
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
    bookingEnabled: true,
    ...over,
  };
}

// STEAL_ATTEMPT fixtures — carrier(home) at {q:10,r:7} moves to {q:11,r:7},
// adjacent to a stationary defender(away) at {q:12,r:7}.
const carrier = piece('carrier', 'home', { q: 10, r: 7 });
// A reachable teammate of the defender — forces isProfessionalFoul: false, so the
// CARD-01/CARD-02 tests below exercise the NORMAL (non-professional) booking roll.
const defenderCover = piece('defender-cover', 'away', { q: 13, r: 7 }, { pace: 6 });

/** Normal (non-professional) foul fixture: includes a reachable defender teammate. */
function foulState(
  defenderOver: Partial<PlayerPiece> = {},
  stateOver: Partial<GameState> = {},
): GameState {
  const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4, ...defenderOver });
  return baseState([carrier, defender, defenderCover], {
    ball: { position: { q: 10, r: 7 }, carrierId: 'carrier', lastTouchedBy: null },
    ...stateOver,
  });
}

/** Professional-foul fixture (CARD-03): no other away piece — isProfessionalFoul: true. */
function professionalFoulState(
  defenderOver: Partial<PlayerPiece> = {},
  stateOver: Partial<GameState> = {},
): GameState {
  const defender = piece('defender', 'away', { q: 12, r: 7 }, { tackling: 4, ...defenderOver });
  return baseState([carrier, defender], {
    ball: { position: { q: 10, r: 7 }, carrierId: 'carrier', lastTouchedBy: null },
    ...stateOver,
  });
}

// ---------------------------------------------------------------------------
// CARD-01: die >= leniency issues yellow; below leniency issues none
// ---------------------------------------------------------------------------

describe('CARD-01: booking roll vs. leniency', () => {
  it('bookingDie===leniency appends BOOKING_CHECK card:"yellow" and sets fouler.yellowCards to 1', () => {
    const result = applyMove(
      foulState(),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 4 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bookingEvent = result.state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
    expect(bookingEvent).toBeDefined();
    if (bookingEvent?.type === 'BOOKING_CHECK') {
      expect(bookingEvent.card).toBe('yellow');
      expect(bookingEvent.die).toBe(4);
      expect(bookingEvent.leniency).toBe(4);
    }
    const fouler = result.state.pieces.find((p) => p.id === 'defender');
    expect(fouler?.yellowCards).toBe(1);
  });

  it('bookingDie < leniency appends BOOKING_CHECK card:"none" and leaves yellowCards at 0', () => {
    const result = applyMove(
      foulState(),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bookingEvent = result.state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
    expect(bookingEvent?.type === 'BOOKING_CHECK' && bookingEvent.card).toBe('none');
    const fouler = result.state.pieces.find((p) => p.id === 'defender');
    expect(fouler?.yellowCards ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CARD-02: second yellow becomes a red card
// ---------------------------------------------------------------------------

describe('CARD-02: second yellow -> red', () => {
  it('a fouler who already has yellowCards:1 and rolls a yellow gets card:"red", secondYellow:true, redCarded:true, yellowCards:2', () => {
    const result = applyMove(
      foulState({ yellowCards: 1 }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 4 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bookingEvent = result.state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
    if (bookingEvent?.type === 'BOOKING_CHECK') {
      expect(bookingEvent.card).toBe('red');
      expect(bookingEvent.secondYellow).toBe(true);
    }
    const fouler = result.state.pieces.find((p) => p.id === 'defender');
    expect(fouler?.redCarded).toBe(true);
    expect(fouler?.yellowCards).toBe(2);
    // Debug red-card-bench-removal-scope (Part 1): the piece is dismissed from the client's
    // pitch rendering (onPitch: false) but `position` itself is untouched — see the onPitch
    // doc comment on PlayerPiece.
    expect(fouler?.onPitch).toBe(false);
    expect(fouler?.position).toEqual({ q: 12, r: 7 });
  });

  it('a red-carded piece is rejected from a subsequent MOVE attempt with detail RED_CARDED', () => {
    const dismissed = piece(
      'defender',
      'away',
      { q: 12, r: 7 },
      { redCarded: true, yellowCards: 2 },
    );
    const state = baseState([carrier, dismissed], {
      phase: 'MOVE',
      movementSlot: 'DEFENDER_5',
      activeTeam: 'away',
      attackingTeam: 'home',
    });
    const result = applyMove(state, 'defender', { q: 13, r: 7 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('MOVE_INVALID');
    expect(result.detail).toBe('RED_CARDED');
  });
});

// ---------------------------------------------------------------------------
// CARD-03: Professional Foul rolls red-vs-yellow instead of the normal roll
// ---------------------------------------------------------------------------

describe('CARD-03: Professional Foul booking', () => {
  it('professional:true foul with die >= leniency yields card:"red", secondYellow:false, professional:true on the very first booking', () => {
    // professionalFoulState() has no other away piece -> isProfessionalFoul is true.
    const result = applyMove(
      professionalFoulState(),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 4 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foulEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CALLED');
    expect(foulEvent?.type === 'FOUL_CALLED' && foulEvent.professional).toBe(true);
    const bookingEvent = result.state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
    if (bookingEvent?.type === 'BOOKING_CHECK') {
      expect(bookingEvent.card).toBe('red');
      expect(bookingEvent.secondYellow).toBe(false);
      expect(bookingEvent.professional).toBe(true);
    }
    const fouler = result.state.pieces.find((p) => p.id === 'defender');
    expect(fouler?.redCarded).toBe(true);
  });

  it('professional:true foul with die < leniency yields card:"yellow"', () => {
    const result = applyMove(
      professionalFoulState(),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 3 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bookingEvent = result.state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
    if (bookingEvent?.type === 'BOOKING_CHECK') {
      expect(bookingEvent.card).toBe('yellow');
      expect(bookingEvent.professional).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// SETTINGS-02: Booking has no effect unless Fouls also enabled / independent toggle
// ---------------------------------------------------------------------------

describe('bookingEnabled: false, foulsEnabled: true', () => {
  it('a die-of-1 foul appends FOUL_CALLED and (if injury enabled) INJURY_CHECK but NO BOOKING_CHECK; yellowCards unchanged', () => {
    const result = applyMove(
      foulState({}, { bookingEnabled: false, injuryEnabled: true }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 6, bookingDie: 6 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'FOUL_CALLED')).toBe(true);
    expect(result.state.eventLog.some((e) => e.type === 'INJURY_CHECK')).toBe(true);
    expect(result.state.eventLog.some((e) => e.type === 'BOOKING_CHECK')).toBe(false);
    const fouler = result.state.pieces.find((p) => p.id === 'defender');
    expect(fouler?.yellowCards ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The booking die is separate from the foul-trigger die
// ---------------------------------------------------------------------------

describe('CARD-01: booking event carries the defenderId (fouler), not the victim', () => {
  it('BOOKING_CHECK.defenderId matches the FOUL_CALLED.defenderId (the fouler)', () => {
    const result = applyMove(
      foulState(),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 4 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bookingEvent = result.state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
    expect(bookingEvent?.type === 'BOOKING_CHECK' && bookingEvent.defenderId).toBe('defender');
  });
});

describe('foulsEnabled: false, bookingEnabled: true', () => {
  it('the Fouls toggle gates Booking entirely — no BOOKING_CHECK when Fouls is off, regardless of the Booking toggle', () => {
    const result = applyMove(
      foulState({}, { foulsEnabled: false }),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 6 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.eventLog.some((e) => e.type === 'BOOKING_CHECK')).toBe(false);
  });
});

describe('booking die independence', () => {
  it('a foul triggered by stealDie:1 still produces a booking outcome driven by the injected bookingDie, not by 1', () => {
    // bookingDie:6 >= leniency:4 -> yellow, even though the foul-trigger die was 1.
    const result = applyMove(
      foulState(),
      'carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 6 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bookingEvent = result.state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
    if (bookingEvent?.type === 'BOOKING_CHECK') {
      expect(bookingEvent.die).toBe(6);
      expect(bookingEvent.card).toBe('yellow');
    }
  });
});
