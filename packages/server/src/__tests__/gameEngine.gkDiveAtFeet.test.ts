import { describe, it, expect } from 'vitest';
import {
  applyRoll,
  applyDeclareShot,
  applyResolveHeaderTarget,
  applyStartMovement,
  applyRestartMovement,
  applyThrowInPlace,
  applyGKRestart,
  applyEndTurn,
  computeGkDiveAtFeetOffer,
  computeGkDiveDisplacement,
  applyGkDiveAtFeetResponse,
  enterGkDiveOrSkip,
} from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord, BallState } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Task 1 (39-12): gameEngine.gkDiveAtFeet.test.ts — RED-state spec for
// GKDIVE-01..05 and D-09 (shared once-per-movement-cycle cap with the
// existing shot-blocking GK_DIVE reposition window).
//
// No `vi.mock('../diceUtils.js')` anywhere in this file — every die is an
// explicit, injected argument, mirroring gameEngine.fouls.test.ts's Assumption
// A1 decision comment.
//
// All goalkeeper/carrier coordinates below are DERIVED from real geometry:
// `PITCH_REGIONS.homeGoal` is q===0, r∈GOAL_R_VALUES=[10..16] (pitch.ts). The
// home goalkeeper is positioned ON the home goal hex {q:0,r:13} (r=13 is the
// exact centre of GOAL_R_VALUES) — the same convention gameEngine.rule11.test.ts
// and gameEngine.phase10.test.ts already use for their own GK fixtures
// (`awayGk` at {q:36,r:13}, the mirrored awayGoal hex). Every carrier/occupant
// hex below was independently verified against the real hexDistance/hexLine/
// toCube/fromCube implementation (packages/shared/src/hex.ts) before being
// hardcoded here — never an invented placeholder literal.
// ---------------------------------------------------------------------------

/** Compact PlayerPiece fixture factory — mirrors gameEngine.fouls.test.ts's `piece()`. */
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
    roomCode: 'GKDIVE1',
    phase: 'MOVE',
    activeTeam: 'away',
    attackingTeam: 'away',
    pieces,
    ball: { position: { q: 1, r: 13 }, carrierId: 'carrier', lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 4 },
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: 'ATTACKER_4',
    ballZone: 'home',
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

// ---------------------------------------------------------------------------
// Shared GK/carrier fixtures — home GK defends the home goal ({q:0,r:13},
// on GOAL_R_VALUES's centre row); the away team attacks it (attackingTeam:
// 'away'). hexDistance(homeGk.position, X) for X at q=1,2,3,4 (same r=13) was
// independently verified to be exactly 1,2,3,4 respectively.
// ---------------------------------------------------------------------------
const homeGk = piece('home-gk', 'home', { q: 0, r: 13 }, { role: 'GK', saving: 5 });
const carrierAt = (q: number, over: Partial<PlayerPiece> = {}): PlayerPiece =>
  piece('carrier', 'away', { q, r: 13 }, { dribbling: 4, ...over });

// ---------------------------------------------------------------------------
// computeGkDiveAtFeetOffer (GKDIVE-02, GKDIVE-05)
// ---------------------------------------------------------------------------

describe('computeGkDiveAtFeetOffer (GKDIVE-02/05)', () => {
  it('returns null when the ball has no carrier', () => {
    const state = baseState([homeGk, carrierAt(2)], {
      ball: { position: { q: 2, r: 13 }, carrierId: null, lastTouchedBy: null },
    });
    expect(computeGkDiveAtFeetOffer(state)).toBeNull();
  });

  it('returns null when the defending team has no GK piece', () => {
    const state = baseState([carrierAt(2)]);
    expect(computeGkDiveAtFeetOffer(state)).toBeNull();
  });

  it('returns null when the defending GK is red-carded', () => {
    const dismissedGk = { ...homeGk, redCarded: true };
    const state = baseState([dismissedGk, carrierAt(2)]);
    expect(computeGkDiveAtFeetOffer(state)).toBeNull();
  });

  it('boundary: distance exactly 3 offers the dive (GKDIVE-02)', () => {
    const state = baseState([homeGk, carrierAt(3)]);
    const offer = computeGkDiveAtFeetOffer(state);
    expect(offer).toEqual({ gkId: 'home-gk', carrierId: 'carrier', distance: 3, team: 'home' });
  });

  it('boundary: distance 4 does NOT offer the dive', () => {
    const state = baseState([homeGk, carrierAt(4)]);
    expect(computeGkDiveAtFeetOffer(state)).toBeNull();
  });

  it('offers at distance 0-2 with the correct distance value', () => {
    const state = baseState([homeGk, carrierAt(1)]);
    const offer = computeGkDiveAtFeetOffer(state);
    expect(offer).toEqual({ gkId: 'home-gk', carrierId: 'carrier', distance: 1, team: 'home' });
  });

  it('returns null when the defending team already used its dive-at-feet this cycle (GKDIVE-05)', () => {
    const state = baseState([homeGk, carrierAt(2)], {
      gkDiveAtFeetUsedByTeam: { home: true, away: false },
    });
    expect(computeGkDiveAtFeetOffer(state)).toBeNull();
  });

  it('is unaffected by the AWAY team having already used its dive-at-feet (per-team cap)', () => {
    const state = baseState([homeGk, carrierAt(2)], {
      gkDiveAtFeetUsedByTeam: { home: false, away: true },
    });
    expect(computeGkDiveAtFeetOffer(state)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyGkDiveAtFeetResponse — GK_DIVE_AT_FEET_PROMPT phase state fixture
// ---------------------------------------------------------------------------

function promptState(
  over: Partial<GameState> = {},
  gkOver: Partial<PlayerPiece> = {},
  carrierOver: Partial<PlayerPiece> = {},
): GameState {
  const gk = { ...homeGk, ...gkOver };
  const carrier = carrierAt(1, carrierOver); // distance 1 -> savingPenalty 0 by default
  return baseState([gk, carrier], {
    phase: 'GK_DIVE_AT_FEET_PROMPT',
    ball: { position: carrier.position, carrierId: carrier.id, lastTouchedBy: null },
    gkDiveAtFeetTeam: 'home',
    gkDiveAtFeetGkId: gk.id,
    gkDiveAtFeetCarrierId: carrier.id,
    gkDiveAtFeetDistance: 1,
    gkDiveAtFeetResume: { phase: 'MOVE', activeTeam: 'away', movementSlot: 'ATTACKER_4' },
    ...over,
  });
}

// ---------------------------------------------------------------------------
// applyGkDiveAtFeetResponse — decline (GKDIVE-02/D-07)
// ---------------------------------------------------------------------------

describe('applyGkDiveAtFeetResponse — decline', () => {
  it('appends GK_DIVE_AT_FEET_DECLINED and restores phase/activeTeam/movementSlot from gkDiveAtFeetResume', () => {
    const state = promptState();
    const result = applyGkDiveAtFeetResponse(state, false, {
      gkDie: 3,
      carrierDie: 3,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const declineEvent = result.state.eventLog.find((e) => e.type === 'GK_DIVE_AT_FEET_DECLINED');
    expect(declineEvent).toBeDefined();
    expect(result.state.phase).toBe('MOVE');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.movementSlot).toBe('ATTACKER_4');
  });

  it('does NOT set gkDiveAtFeetUsedByTeam on decline (does not consume the cap)', () => {
    const state = promptState();
    const result = applyGkDiveAtFeetResponse(state, false, {
      gkDie: 3,
      carrierDie: 3,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkDiveAtFeetUsedByTeam?.home).not.toBe(true);
  });

  it('clears the gkDiveAtFeet* context cluster on decline', () => {
    const state = promptState();
    const result = applyGkDiveAtFeetResponse(state, false, {
      gkDie: 3,
      carrierDie: 3,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkDiveAtFeetTeam).toBeNull();
    expect(result.state.gkDiveAtFeetGkId).toBeNull();
    expect(result.state.gkDiveAtFeetCarrierId).toBeNull();
    expect(result.state.gkDiveAtFeetResume).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyGkDiveAtFeetResponse — WRONG_PHASE guard
// ---------------------------------------------------------------------------

describe('applyGkDiveAtFeetResponse — guards', () => {
  it('rejects when phase is not GK_DIVE_AT_FEET_PROMPT', () => {
    const state = promptState({ phase: 'MOVE' });
    const result = applyGkDiveAtFeetResponse(state, true, {
      gkDie: 3,
      carrierDie: 3,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });
});

// ---------------------------------------------------------------------------
// applyGkDiveAtFeetResponse — GKDIVE-01 duel reuse + GKDIVE-02 distance penalty
// ---------------------------------------------------------------------------

describe('applyGkDiveAtFeetResponse — accept (GKDIVE-01/02)', () => {
  it('SUCCESS at distance 1 (no penalty): GK moves onto the carrier hex, ball transfers, team turns over', () => {
    // saving:5 + gkDie:5 = 10 (no penalty at distance 1); dribbling:4 + carrierDie:3 = 7 -> SUCCESS
    const state = promptState({}, { saving: 5 }, { dribbling: 4 });
    const result = applyGkDiveAtFeetResponse(state, true, {
      gkDie: 5,
      carrierDie: 3,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const duelEvent = result.state.eventLog.find((e) => e.type === 'GK_DIVE_AT_FEET');
    expect(duelEvent).toBeDefined();
    if (duelEvent?.type === 'GK_DIVE_AT_FEET') {
      expect(duelEvent.result).toBe('SUCCESS');
      expect(duelEvent.savingPenalty).toBe(0);
      expect(duelEvent.distance).toBe(1);
    }
    const gkPiece = result.state.pieces.find((p) => p.id === 'home-gk');
    expect(gkPiece?.position).toEqual({ q: 1, r: 13 });
    expect(result.state.ball.carrierId).toBe('home-gk');
    expect(result.state.attackingTeam).toBe('home');
  });

  it('FAIL: ball and positions unchanged; gkDiveAtFeetUsedByTeam still set; resumes gkDiveAtFeetResume', () => {
    // saving:1 + gkDie:1 = 2 (distance 1, no penalty); dribbling:8 + carrierDie:6 = 14 -> FAIL
    const state = promptState({}, { saving: 1 }, { dribbling: 8 });
    const result = applyGkDiveAtFeetResponse(state, true, {
      gkDie: 3,
      carrierDie: 6,
      injuryDie: 3,
      bookingDie: 3,
    });
    // Use gkDie:3 (not the FOUL_TRIGGER_DIE) so this test isolates FAIL from GKDIVE-03.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const duelEvent = result.state.eventLog.find((e) => e.type === 'GK_DIVE_AT_FEET');
    if (duelEvent?.type === 'GK_DIVE_AT_FEET') {
      expect(duelEvent.result).toBe('FAIL');
    }
    const gkPiece = result.state.pieces.find((p) => p.id === 'home-gk');
    expect(gkPiece?.position).toEqual({ q: 0, r: 13 });
    expect(result.state.ball.carrierId).toBe('carrier');
    expect(result.state.phase).toBe('MOVE');
    expect(result.state.gkDiveAtFeetUsedByTeam?.home).toBe(true);
  });

  it('accepting always sets gkDiveAtFeetUsedByTeam[team]=true on SUCCESS', () => {
    const state = promptState({}, { saving: 5 }, { dribbling: 4 });
    const result = applyGkDiveAtFeetResponse(state, true, {
      gkDie: 5,
      carrierDie: 3,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkDiveAtFeetUsedByTeam?.home).toBe(true);
  });

  it('GKDIVE-02: the -1 saving penalty applies only at exactly distance 3 and can flip SUCCESS to FAIL', () => {
    // At distance 3: saving:5 + gkDie:5 = 10, penalty -1 -> 9. dribbling:5 + carrierDie:5 = 10.
    // Without the penalty this would be a 10-10 tie (defender wins ties -> SUCCESS);
    // with the -1 penalty it is 9 < 10 -> FAIL.
    const state = promptState({ gkDiveAtFeetDistance: 3 }, { saving: 5 }, { dribbling: 5 });
    const result = applyGkDiveAtFeetResponse(state, true, {
      gkDie: 5,
      carrierDie: 5,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const duelEvent = result.state.eventLog.find((e) => e.type === 'GK_DIVE_AT_FEET');
    if (duelEvent?.type === 'GK_DIVE_AT_FEET') {
      expect(duelEvent.savingPenalty).toBe(-1);
      expect(duelEvent.result).toBe('FAIL');
    }
  });

  it('rejects (WRONG_PHASE) when gkDiveAtFeetDistance is stale/out-of-range (>3)', () => {
    const state = promptState({ gkDiveAtFeetDistance: 5 });
    const result = applyGkDiveAtFeetResponse(state, true, {
      gkDie: 5,
      carrierDie: 3,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });
});

// ---------------------------------------------------------------------------
// applyGkDiveAtFeetResponse — GKDIVE-03: GK die of 1 fouls regardless of outcome
// ---------------------------------------------------------------------------

describe('applyGkDiveAtFeetResponse — GKDIVE-03 foul on gkDie===1', () => {
  it('fires on gkDie===1 when the duel SUCCEEDS', () => {
    // saving:8 + gkDie:1 = 9; dribbling:1 + carrierDie:1 = 2 -> SUCCESS
    const state = promptState({}, { saving: 8 }, { dribbling: 1 });
    const result = applyGkDiveAtFeetResponse(state, true, {
      gkDie: 1,
      carrierDie: 1,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foulEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CALLED');
    expect(foulEvent).toBeDefined();
    if (foulEvent?.type === 'FOUL_CALLED') {
      expect(foulEvent.source).toBe('GK_DIVE_AT_FEET');
      expect(foulEvent.defenderId).toBe('home-gk');
      expect(foulEvent.victimId).toBe('carrier');
    }
    expect(result.state.phase).toBe('FOUL_CHOICE');
    expect(result.state.foulSource).toBe('GK_DIVE_AT_FEET');
  });

  it('fires on gkDie===1 when the duel FAILS', () => {
    // saving:1 + gkDie:1 = 2; dribbling:8 + carrierDie:6 = 14 -> FAIL
    const state = promptState({}, { saving: 1 }, { dribbling: 8 });
    const result = applyGkDiveAtFeetResponse(state, true, {
      gkDie: 1,
      carrierDie: 6,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foulEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CALLED');
    expect(foulEvent).toBeDefined();
    expect(result.state.phase).toBe('FOUL_CHOICE');
    expect(result.state.foulSource).toBe('GK_DIVE_AT_FEET');
  });

  it('does NOT fire a foul when gkDie !== 1', () => {
    const state = promptState({}, { saving: 5 }, { dribbling: 4 });
    const result = applyGkDiveAtFeetResponse(state, true, {
      gkDie: 5,
      carrierDie: 3,
      injuryDie: 3,
      bookingDie: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const foulEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CALLED');
    expect(foulEvent).toBeUndefined();
    expect(result.state.phase).not.toBe('FOUL_CHOICE');
  });
});

// ---------------------------------------------------------------------------
// computeGkDiveDisplacement (GKDIVE-04)
// ---------------------------------------------------------------------------

describe('computeGkDiveDisplacement (GKDIVE-04)', () => {
  // from={q:0,r:13} -> to={q:3,r:13}: independently verified pushed hex = {q:4,r:14}
  // (real hexLine + toCube/fromCube round trip on the actual 37x26 grid — NOT a fixed
  // ODD-Q offset delta, see Phase 17.1-08 lesson cited in scoreUtils.ts).
  const from: HexCoord = { q: 0, r: 13 };
  const to: HexCoord = { q: 3, r: 13 };
  const pushedOnce: HexCoord = { q: 4, r: 14 };
  const pushedTwice: HexCoord = { q: 5, r: 14 };

  const ballAt = (pos: HexCoord, carrierId: string | null = null): BallState => ({
    position: pos,
    carrierId,
    lastTouchedBy: null,
  });

  it('pushes a single occupant one hex further along the dive direction', () => {
    const occupant = piece('occ1', 'away', to);
    const result = computeGkDiveDisplacement([occupant], ballAt({ q: 99, r: 99 }), from, to);
    const moved = result.pieces.find((p) => p.id === 'occ1');
    expect(moved?.position).toEqual(pushedOnce);
  });

  it('cascades: an occupant pushed into another occupied hex pushes that occupant too', () => {
    const occ1 = piece('occ1', 'away', to);
    const occ2 = piece('occ2', 'home', pushedOnce);
    const result = computeGkDiveDisplacement([occ1, occ2], ballAt({ q: 99, r: 99 }), from, to);
    expect(result.pieces.find((p) => p.id === 'occ1')?.position).toEqual(pushedOnce);
    expect(result.pieces.find((p) => p.id === 'occ2')?.position).toEqual(pushedTwice);
  });

  it('an occupant that would be pushed off-pitch stays put and the dive resolves without throwing', () => {
    // from={q:33,r:13} -> to={q:36,r:13}: independently verified pushed hex = {q:37,r:12},
    // which is off the 37x26 pitch grid (q>36).
    const offFrom: HexCoord = { q: 33, r: 13 };
    const offTo: HexCoord = { q: 36, r: 13 };
    const occupant = piece('occ1', 'away', offTo);
    expect(() =>
      computeGkDiveDisplacement([occupant], ballAt({ q: 99, r: 99 }), offFrom, offTo),
    ).not.toThrow();
    const result = computeGkDiveDisplacement([occupant], ballAt({ q: 99, r: 99 }), offFrom, offTo);
    expect(result.pieces.find((p) => p.id === 'occ1')?.position).toEqual(offTo);
  });

  it('displaces a loose ball sitting on the landing hex one hex further', () => {
    const result = computeGkDiveDisplacement([], ballAt(to, null), from, to);
    expect(result.ball.position).toEqual(pushedOnce);
  });

  it('does NOT displace the ball when it is carried (carrierId set)', () => {
    const carrierPiece = piece('carrier', 'away', to);
    const result = computeGkDiveDisplacement([carrierPiece], ballAt(to, 'carrier'), from, to);
    expect(result.ball.position).toEqual(to);
  });

  it('is a no-op (never throws, returns input unchanged) when `to` has no occupants and no loose ball', () => {
    const result = computeGkDiveDisplacement([], ballAt({ q: 99, r: 99 }), from, to);
    expect(result.pieces).toHaveLength(0);
    expect(result.ball.position).toEqual({ q: 99, r: 99 });
  });
});

// ---------------------------------------------------------------------------
// enterGkDiveOrSkip (D-09)
// ---------------------------------------------------------------------------

describe('enterGkDiveOrSkip (D-09)', () => {
  it('enters GK_DIVE normally when the cap is unused', () => {
    const state = baseState([homeGk], { gkDiveAtFeetUsedByTeam: { home: false, away: false } });
    const result = enterGkDiveOrSkip(state, 'home', homeGk.position);
    expect(result).toEqual({ phase: 'GK_DIVE', gkDivePosition: homeGk.position });
  });

  it('skips straight to SHOT (no reposition) when the team already used its dive-at-feet', () => {
    const state = baseState([homeGk], { gkDiveAtFeetUsedByTeam: { home: true, away: false } });
    const result = enterGkDiveOrSkip(state, 'home', homeGk.position);
    expect(result).toEqual({ phase: 'SHOT', gkDivePosition: homeGk.position });
  });

  it('is per-team: the away team using its dive does not disable the home team GK_DIVE', () => {
    const state = baseState([homeGk], { gkDiveAtFeetUsedByTeam: { home: false, away: true } });
    const result = enterGkDiveOrSkip(state, 'home', homeGk.position);
    expect(result.phase).toBe('GK_DIVE');
  });
});

// ---------------------------------------------------------------------------
// D-09 shared cap — all four GK_DIVE entry points
// ---------------------------------------------------------------------------

describe('D-09 shared cap — all four GK_DIVE entry points', () => {
  // Fixture squad for applyDeclareShot (site 4): mirrors gameEngine.phase10.test.ts's
  // makeActionState/homeFwd/awayGk fixture almost verbatim (verified-adjacent, real
  // awayPenaltyArea/awayGoal coordinates).
  const shotHomeFwd = piece('home-fwd', 'home', { q: 32, r: 12 }, { shooting: 9, dribbling: 8 });
  const shotAwayGk = piece('away-gk', 'away', { q: 36, r: 13 }, { role: 'GK', saving: 8 });

  const declareShotState = (over: Partial<GameState> = {}): GameState =>
    baseState([shotHomeFwd, shotAwayGk], {
      phase: 'PASS',
      activeTeam: 'home',
      attackingTeam: 'home',
      movementSlot: null,
      lastActionType: 'MOVEMENT_PHASE',
      ball: { position: shotHomeFwd.position, carrierId: 'home-fwd', lastTouchedBy: null },
      ...over,
    });

  it('(1) applyDeclareShot: enters GK_DIVE when the cap is unused', () => {
    const state = declareShotState({ gkDiveAtFeetUsedByTeam: { home: false, away: false } });
    const result = applyDeclareShot(state, { q: 36, r: 13 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_DIVE');
  });

  it('(1) applyDeclareShot: skips to SHOT when the defending (away) team already used its dive-at-feet', () => {
    const state = declareShotState({ gkDiveAtFeetUsedByTeam: { home: false, away: true } });
    const result = applyDeclareShot(state, { q: 36, r: 13 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('SHOT');
    expect(result.state.gkDivePosition).toEqual(shotAwayGk.position);
  });

  // Header fixtures for sites 2/3 (uncontested-attacker-win goal-line branch of
  // applyRoll('HEADER', ...) and the contested-duel-win goal-line branch) — mirror
  // gameEngine.rule11.test.ts's makeHeaderStateWithWinner-style fixture almost
  // verbatim (real awayGoal-adjacent coordinates, home attacking toward q=36).
  const headerAtkFwd = piece('home-fwd', 'home', { q: 32, r: 12 }, { aerialAbility: 8 });
  const headerAtkFwd2 = piece('home-fwd2', 'home', { q: 31, r: 12 }, { aerialAbility: 2 });
  const headerDefGk = piece(
    'away-gk',
    'away',
    { q: 36, r: 13 },
    { role: 'GK', saving: 5, aerialAbility: 2 },
  );
  const headerGoalHex = { q: 36, r: 12 };

  const uncontestedHeaderState = (over: Partial<GameState> = {}): GameState =>
    baseState([headerAtkFwd, headerDefGk], {
      phase: 'HEADER',
      activeTeam: 'home',
      attackingTeam: 'home',
      movementSlot: null,
      lastActionType: 'HIGH_PASS',
      ball: { position: headerAtkFwd.position, carrierId: null, lastTouchedBy: null },
      headerContestants: { home: ['home-fwd'], away: [] },
      headerConfirmed: { home: true, away: true },
      headerTargetHex: headerGoalHex,
      ...over,
    });

  it('(2) applyRoll HEADER uncontested-attacker-win goal-line route: enters GK_DIVE when the cap is unused', () => {
    const state = uncontestedHeaderState({ gkDiveAtFeetUsedByTeam: { home: false, away: false } });
    const result = applyRoll(state, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_DIVE');
  });

  it('(2) applyRoll HEADER uncontested-attacker-win goal-line route: skips to SHOT when the defending team already used its dive-at-feet', () => {
    const state = uncontestedHeaderState({ gkDiveAtFeetUsedByTeam: { home: false, away: true } });
    const result = applyRoll(state, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('SHOT');
  });

  const contestedHeaderState = (over: Partial<GameState> = {}): GameState =>
    baseState([headerAtkFwd, headerAtkFwd2, headerDefGk], {
      phase: 'HEADER',
      activeTeam: 'home',
      attackingTeam: 'home',
      movementSlot: null,
      lastActionType: 'HIGH_PASS',
      ball: { position: headerAtkFwd.position, carrierId: null, lastTouchedBy: null },
      // Contested: an attacker AND a defender both selected. The defending GK (aerialAbility:2)
      // contests against headerAtkFwd (aerialAbility:8) — attacker wins comfortably on any die pair.
      headerContestants: { home: ['home-fwd'], away: ['away-gk'] },
      headerConfirmed: { home: true, away: true },
      headerTargetHex: headerGoalHex,
      ...over,
    });

  it('(3) applyRoll HEADER contested-duel-win goal-line route: enters GK_DIVE when the cap is unused', () => {
    const state = contestedHeaderState({ gkDiveAtFeetUsedByTeam: { home: false, away: false } });
    const result = applyRoll(state, 6, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_DIVE');
  });

  it('(3) applyRoll HEADER contested-duel-win goal-line route: skips to SHOT when the defending team already used its dive-at-feet', () => {
    const state = contestedHeaderState({ gkDiveAtFeetUsedByTeam: { home: false, away: true } });
    const result = applyRoll(state, 6, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('SHOT');
  });

  // applyResolveHeaderTarget (site 3... i.e. the 4th distinct code site, "applyResolveHeaderTarget's
  // goal-line route") — mirrors gameEngine.rule11.test.ts's makeHeaderStateWithWinner fixture.
  const resolveTargetState = (over: Partial<GameState> = {}): GameState =>
    baseState([{ ...headerAtkFwd, position: { q: 32, r: 12 } }, { ...headerDefGk }], {
      phase: 'HEADER',
      activeTeam: 'home',
      attackingTeam: 'home',
      movementSlot: null,
      lastActionType: 'HIGH_PASS',
      ball: { position: { q: 32, r: 12 }, carrierId: null, lastTouchedBy: null },
      headerContestants: { home: ['home-fwd'], away: [] },
      headerConfirmed: { home: true, away: true },
      headerDuelWinner: 'home',
      headerAccuracyRollPending: null,
      headerTargetHex: null,
      ...over,
    });

  it('(4) applyResolveHeaderTarget goal-line route: enters GK_DIVE when the cap is unused', () => {
    const state = resolveTargetState({ gkDiveAtFeetUsedByTeam: { home: false, away: false } });
    const result = applyResolveHeaderTarget(state, headerGoalHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_DIVE');
  });

  it('(4) applyResolveHeaderTarget goal-line route: skips to SHOT when the defending team already used its dive-at-feet', () => {
    const state = resolveTargetState({ gkDiveAtFeetUsedByTeam: { home: false, away: true } });
    const result = applyResolveHeaderTarget(state, headerGoalHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('SHOT');
  });
});

// ---------------------------------------------------------------------------
// GKDIVE-05 movement-cycle reset scope: gkDiveAtFeetUsedByTeam resets at every
// point that begins a fresh 4-5-2 movement cycle, but is NOT cleared by a
// mid-cycle slot advance (ATTACKER_4 -> DEFENDER_5 -> ATTACKER_2).
// ---------------------------------------------------------------------------

describe('GKDIVE-05: gkDiveAtFeetUsedByTeam movement-cycle reset scope', () => {
  const usedFlag = { home: true, away: true };

  it('applyStartMovement (CHOOSE_ACTION -> MOVEMENT) resets the cap', () => {
    const state = baseState([homeGk], {
      phase: 'PASS',
      movementSlot: null,
      gkDiveAtFeetUsedByTeam: usedFlag,
    });
    const result = applyStartMovement(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkDiveAtFeetUsedByTeam).toEqual({ home: false, away: false });
  });

  it('applyRestartMovement ("Start New Movement Phase") resets the cap', () => {
    const state = baseState([homeGk], {
      phase: 'MOVE',
      movementSlot: 'ATTACKER_2',
      gkDiveAtFeetUsedByTeam: usedFlag,
    });
    const result = applyRestartMovement(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkDiveAtFeetUsedByTeam).toEqual({ home: false, away: false });
  });

  it('applyThrowInPlace (starts a fresh Movement Phase 1) resets the cap', () => {
    const thrower = piece('thrower', 'home', { q: 5, r: 5 });
    const state = baseState([homeGk, thrower], {
      phase: 'THROW_IN_SETUP',
      throwInHex: { q: 6, r: 5 },
      throwInTeam: 'home',
      gkDiveAtFeetUsedByTeam: usedFlag,
    });
    const result = applyThrowInPlace(state, 'thrower');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkDiveAtFeetUsedByTeam).toEqual({ home: false, away: false });
  });

  it('applyGKRestart("movement") resets the cap', () => {
    const gk = piece('gk', 'home', { q: 2, r: 13 }, { role: 'GK' });
    const state = baseState([gk], {
      phase: 'GK_RESTART',
      ball: { position: gk.position, carrierId: 'gk', lastTouchedBy: null },
      gkDiveAtFeetUsedByTeam: usedFlag,
    });
    const result = applyGKRestart(state, 'movement', () => 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkDiveAtFeetUsedByTeam).toEqual({ home: false, away: false });
  });

  it('a mid-cycle slot advance (applyEndTurn ATTACKER_4 -> DEFENDER_5) does NOT clear the cap', () => {
    const state = baseState([homeGk], {
      phase: 'MOVE',
      movementSlot: 'ATTACKER_4',
      gkDiveAtFeetUsedByTeam: usedFlag,
    });
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.movementSlot).toBe('DEFENDER_5');
    expect(result.state.gkDiveAtFeetUsedByTeam).toEqual(usedFlag);
  });
});
