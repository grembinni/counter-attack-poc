import { describe, it, expect } from 'vitest';
import {
  computeBoxEntryOffer,
  applyBoxEntryResponse,
  applyBoxEntryMove,
  computeGkDiveAtFeetOffer,
  applyStartMovement,
  applyRestartMovement,
  applyThrowInPlace,
  applyGKRestart,
  applyEndTurn,
} from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';
import { hexNeighbors, isPitchHex } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Task 1 (39-14): gameEngine.boxEntry.test.ts — RED-state spec for D-10/D-11's
// box-entry goalkeeper response move.
//
// D-10: the FIRST time the ball enters a penalty area during a movement
// cycle, by ANY means (pass, shot, move, or loose ball), the defending
// manager is offered a one-hex goalkeeper reposition. This is NOT the
// existing shot-declared GK_DIVE phase.
// D-11: this response has its OWN independent once-per-movement-cycle cap,
// separate from D-09's shared dive-at-feet/shot-block-dive cap.
//
// All coordinates below are drawn from real `PITCH_REGIONS.homePenaltyArea`/
// `awayPenaltyArea` members (`q<=5`/`q>=31`, `r` in `[5,19]`) and real
// non-member hexes — never invented coordinates.
// ---------------------------------------------------------------------------

/** Compact PlayerPiece fixture factory — mirrors gameEngine.gkDiveAtFeet.test.ts's `piece()`. */
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
    roomCode: 'BOXENTRY',
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
// Shared fixtures — home GK sits ON a real homePenaltyArea member hex
// ({q:0,r:13}: q<=5, r in [5,19]); away GK on a real awayPenaltyArea member
// hex ({q:36,r:13}: q>=31, r in [5,19]). {q:10,r:13} and {q:26,r:13} are real
// NON-members of either penalty area (homeThird/awayThird respectively, but
// outside the narrower q<=5/q>=31 penalty-area bands).
// ---------------------------------------------------------------------------
const homeGk = piece('home-gk', 'home', { q: 0, r: 13 }, { role: 'GK', saving: 5 });
const awayGk = piece('away-gk', 'away', { q: 36, r: 13 }, { role: 'GK', saving: 5 });

const OUTSIDE_HOME_AREA: HexCoord = { q: 10, r: 13 };
const INSIDE_HOME_AREA: HexCoord = { q: 3, r: 13 };
const INSIDE_HOME_AREA_2: HexCoord = { q: 2, r: 13 };
const OUTSIDE_AWAY_AREA: HexCoord = { q: 26, r: 13 };
const INSIDE_AWAY_AREA: HexCoord = { q: 33, r: 13 };

// ---------------------------------------------------------------------------
// computeBoxEntryOffer (D-10) — fires on any means of entry
// ---------------------------------------------------------------------------

describe('computeBoxEntryOffer (D-10) — fires on any means of entry', () => {
  it('offers the home team when the ball enters homePenaltyArea via a PASS reception', () => {
    const carrier = piece('carrier', 'away', INSIDE_HOME_AREA, { dribbling: 4 });
    const state = baseState([homeGk, carrier], {
      lastActionType: 'STANDARD_PASS',
      ball: { position: INSIDE_HOME_AREA, carrierId: 'carrier', lastTouchedBy: null },
    });
    const offer = computeBoxEntryOffer(OUTSIDE_HOME_AREA, state);
    expect(offer).toEqual({ team: 'home', gkId: 'home-gk' });
  });

  it('offers the home team when the ball enters homePenaltyArea via a SHOT travelling into it', () => {
    const state = baseState([homeGk], {
      lastActionType: 'SHOT',
      // A shot in flight is loose (no carrier) as it crosses into the box.
      ball: { position: INSIDE_HOME_AREA, carrierId: null, lastTouchedBy: null },
    });
    const offer = computeBoxEntryOffer(OUTSIDE_HOME_AREA, state);
    expect(offer).toEqual({ team: 'home', gkId: 'home-gk' });
  });

  it('offers the home team when a carrier MOVEs into homePenaltyArea', () => {
    const carrier = piece('carrier', 'away', INSIDE_HOME_AREA, { dribbling: 4 });
    const state = baseState([homeGk, carrier], {
      lastActionType: 'MOVEMENT_PHASE',
      ball: { position: INSIDE_HOME_AREA, carrierId: 'carrier', lastTouchedBy: null },
    });
    const offer = computeBoxEntryOffer(OUTSIDE_HOME_AREA, state);
    expect(offer).toEqual({ team: 'home', gkId: 'home-gk' });
  });

  it('offers the home team when a LOOSE BALL lands inside homePenaltyArea', () => {
    const state = baseState([homeGk], {
      lastActionType: null,
      ball: { position: INSIDE_HOME_AREA, carrierId: null, lastTouchedBy: null },
    });
    const offer = computeBoxEntryOffer(OUTSIDE_HOME_AREA, state);
    expect(offer).toEqual({ team: 'home', gkId: 'home-gk' });
  });

  it('offers the AWAY team when the ball enters awayPenaltyArea (entered region owner responds)', () => {
    const state = baseState([awayGk], {
      ball: { position: INSIDE_AWAY_AREA, carrierId: null, lastTouchedBy: null },
    });
    const offer = computeBoxEntryOffer(OUTSIDE_AWAY_AREA, state);
    expect(offer).toEqual({ team: 'away', gkId: 'away-gk' });
  });
});

// ---------------------------------------------------------------------------
// computeBoxEntryOffer — null-return preconditions
// ---------------------------------------------------------------------------

describe('computeBoxEntryOffer — returns null on failed preconditions', () => {
  it('returns null when the ball was already inside the SAME area before the action (only first entry offers)', () => {
    const state = baseState([homeGk], {
      ball: { position: INSIDE_HOME_AREA, carrierId: null, lastTouchedBy: null },
    });
    expect(computeBoxEntryOffer(INSIDE_HOME_AREA_2, state)).toBeNull();
  });

  it('returns null when the ball never entered any penalty area', () => {
    const state = baseState([homeGk], {
      ball: { position: { q: 11, r: 13 }, carrierId: null, lastTouchedBy: null },
    });
    expect(computeBoxEntryOffer(OUTSIDE_HOME_AREA, state)).toBeNull();
  });

  it('returns null when the cap flag is already set for the defending team (D-11)', () => {
    const state = baseState([homeGk], {
      gkBoxEntryUsedByTeam: { home: true, away: false },
      ball: { position: INSIDE_HOME_AREA, carrierId: null, lastTouchedBy: null },
    });
    expect(computeBoxEntryOffer(OUTSIDE_HOME_AREA, state)).toBeNull();
  });

  it('returns null when the defending team has no GK piece', () => {
    const state = baseState([], {
      ball: { position: INSIDE_HOME_AREA, carrierId: null, lastTouchedBy: null },
    });
    expect(computeBoxEntryOffer(OUTSIDE_HOME_AREA, state)).toBeNull();
  });

  it('returns null when the defending GK is red-carded', () => {
    const dismissedGk = { ...homeGk, redCarded: true };
    const state = baseState([dismissedGk], {
      ball: { position: INSIDE_HOME_AREA, carrierId: null, lastTouchedBy: null },
    });
    expect(computeBoxEntryOffer(OUTSIDE_HOME_AREA, state)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyBoxEntryResponse — GK_BOX_ENTRY_PROMPT phase state fixture
// ---------------------------------------------------------------------------

function promptState(over: Partial<GameState> = {}): GameState {
  const carrier = piece('carrier', 'away', INSIDE_HOME_AREA, { dribbling: 4 });
  return baseState([homeGk, carrier], {
    phase: 'GK_BOX_ENTRY_PROMPT',
    ball: { position: INSIDE_HOME_AREA, carrierId: 'carrier', lastTouchedBy: null },
    gkBoxEntryTeam: 'home',
    gkBoxEntryResume: { phase: 'MOVE', activeTeam: 'away', movementSlot: 'ATTACKER_4' },
    gkBoxEntryUsedByTeam: { home: false, away: false },
    ...over,
  });
}

describe('applyBoxEntryResponse — decline (D-11: declining still consumes the cap)', () => {
  it('restores phase/activeTeam/movementSlot from gkBoxEntryResume', () => {
    const state = promptState();
    const result = applyBoxEntryResponse(state, false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('MOVE');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.movementSlot).toBe('ATTACKER_4');
  });

  it('clears gkBoxEntryTeam/gkBoxEntryResume', () => {
    const state = promptState();
    const result = applyBoxEntryResponse(state, false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkBoxEntryTeam).toBeNull();
    expect(result.state.gkBoxEntryResume).toBeNull();
  });

  it('sets gkBoxEntryUsedByTeam[team] = true even though the response was a decline', () => {
    const state = promptState();
    const result = applyBoxEntryResponse(state, false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkBoxEntryUsedByTeam?.home).toBe(true);
  });
});

describe('applyBoxEntryResponse — accept', () => {
  it('transitions to GK_BOX_ENTRY_MOVE with activeTeam set to the responding team', () => {
    const state = promptState();
    const result = applyBoxEntryResponse(state, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_BOX_ENTRY_MOVE');
    expect(result.state.activeTeam).toBe('home');
  });

  it('leaves gkBoxEntryResume intact for the post-move restore', () => {
    const state = promptState();
    const result = applyBoxEntryResponse(state, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkBoxEntryResume).toEqual({
      phase: 'MOVE',
      activeTeam: 'away',
      movementSlot: 'ATTACKER_4',
    });
  });
});

describe('applyBoxEntryResponse — guards', () => {
  it('rejects when phase is not GK_BOX_ENTRY_PROMPT', () => {
    const state = promptState({ phase: 'MOVE' });
    const result = applyBoxEntryResponse(state, true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });
});

// ---------------------------------------------------------------------------
// applyBoxEntryMove — GK_BOX_ENTRY_MOVE phase state fixture
// ---------------------------------------------------------------------------

function moveState(over: Partial<GameState> = {}): GameState {
  const carrier = piece('carrier', 'away', INSIDE_HOME_AREA, { dribbling: 4 });
  return baseState([homeGk, carrier], {
    phase: 'GK_BOX_ENTRY_MOVE',
    activeTeam: 'home',
    ball: { position: INSIDE_HOME_AREA, carrierId: 'carrier', lastTouchedBy: null },
    gkBoxEntryTeam: 'home',
    gkBoxEntryResume: { phase: 'MOVE', activeTeam: 'away', movementSlot: 'ATTACKER_4' },
    gkBoxEntryUsedByTeam: { home: false, away: false },
    ...over,
  });
}

describe('applyBoxEntryMove', () => {
  it('rejects when phase is not GK_BOX_ENTRY_MOVE', () => {
    const state = moveState({ phase: 'MOVE' });
    const result = applyBoxEntryMove(state, { q: 1, r: 13 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PHASE');
  });

  it('rejects a non-adjacent destination (OUT_OF_RANGE)', () => {
    const state = moveState();
    const result = applyBoxEntryMove(state, {
      q: homeGk.position.q + 3,
      r: homeGk.position.r,
    });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OUT_OF_RANGE' });
  });

  it('rejects an adjacent but off-pitch destination (OFF_PITCH)', () => {
    // homeGK sits at q=0 (the byline column); step it to r=5 (mirrors
    // gameEngine.penaltyKick.test.ts's edge fixture) so its neighbour set
    // includes a genuine off-grid q=-1 hex, discovered dynamically rather
    // than hardcoded.
    const edgeGk = { ...homeGk, position: { q: 0, r: 5 } };
    const state = moveState({ pieces: [edgeGk, moveState().pieces[1]!] });
    const offPitchNeighbor = hexNeighbors(edgeGk.position).find((h) => !isPitchHex(h))!;
    const result = applyBoxEntryMove(state, offPitchNeighbor);
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('rejects a destination occupied by another piece (OCCUPIED)', () => {
    const to = hexNeighbors(homeGk.position).find((h) => isPitchHex(h))!;
    const occupant = piece('occupant', 'away', to);
    const state = moveState();
    const stateWithOccupant: GameState = { ...state, pieces: [...state.pieces, occupant] };
    const result = applyBoxEntryMove(stateWithOccupant, to);
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OCCUPIED' });
  });

  it('on success: moves the GK exactly one hex, appends GK_BOX_ENTRY_MOVE, sets the cap, restores phase, clears context', () => {
    const to = hexNeighbors(homeGk.position).find((h) => isPitchHex(h))!;
    const state = moveState();
    const result = applyBoxEntryMove(state, to);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const gkPiece = result.state.pieces.find((p) => p.id === 'home-gk');
    expect(gkPiece?.position).toEqual(to);

    const evt = result.state.eventLog.find((e) => e.type === 'GK_BOX_ENTRY_MOVE');
    expect(evt).toBeDefined();
    if (evt?.type === 'GK_BOX_ENTRY_MOVE') {
      expect(evt.gkId).toBe('home-gk');
      expect(evt.from).toEqual(homeGk.position);
      expect(evt.to).toEqual(to);
    }

    expect(result.state.gkBoxEntryUsedByTeam?.home).toBe(true);
    expect(result.state.phase).toBe('MOVE');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.movementSlot).toBe('ATTACKER_4');
    expect(result.state.gkBoxEntryTeam).toBeNull();
    expect(result.state.gkBoxEntryResume).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D-11 independence: gkBoxEntryUsedByTeam and gkDiveAtFeetUsedByTeam are two
// separate caps — using one must not consume the other, in EITHER direction.
// ---------------------------------------------------------------------------

describe('D-11 independence — box-entry cap vs. dive-at-feet cap', () => {
  it('using the box-entry response does NOT block a dive-at-feet offer', () => {
    const carrier = piece('carrier', 'away', { q: 1, r: 13 }, { dribbling: 4 });
    const state = baseState([homeGk, carrier], {
      ball: { position: { q: 1, r: 13 }, carrierId: 'carrier', lastTouchedBy: null },
      gkBoxEntryUsedByTeam: { home: true, away: false },
      gkDiveAtFeetUsedByTeam: { home: false, away: false },
    });
    expect(computeGkDiveAtFeetOffer(state)).not.toBeNull();
  });

  it('using dive-at-feet does NOT block a box-entry offer', () => {
    const state = baseState([homeGk], {
      ball: { position: INSIDE_HOME_AREA, carrierId: null, lastTouchedBy: null },
      gkDiveAtFeetUsedByTeam: { home: true, away: false },
      gkBoxEntryUsedByTeam: { home: false, away: false },
    });
    expect(computeBoxEntryOffer(OUTSIDE_HOME_AREA, state)).toEqual({
      team: 'home',
      gkId: 'home-gk',
    });
  });
});

// ---------------------------------------------------------------------------
// gkBoxEntryUsedByTeam movement-cycle reset scope: resets at every point that
// begins a fresh 4-5-2 movement cycle, NOT at a mid-cycle slot advance —
// mirrors GKDIVE-05's reset-scope tests in gameEngine.gkDiveAtFeet.test.ts.
// ---------------------------------------------------------------------------

describe('gkBoxEntryUsedByTeam movement-cycle reset scope', () => {
  const usedFlag = { home: true, away: true };

  it('applyStartMovement (CHOOSE_ACTION -> MOVEMENT) resets the cap', () => {
    const state = baseState([homeGk], {
      phase: 'PASS',
      movementSlot: null,
      gkBoxEntryUsedByTeam: usedFlag,
    });
    const result = applyStartMovement(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkBoxEntryUsedByTeam).toEqual({ home: false, away: false });
  });

  it('applyRestartMovement ("Start New Movement Phase") resets the cap', () => {
    const state = baseState([homeGk], {
      phase: 'MOVE',
      movementSlot: 'ATTACKER_2',
      gkBoxEntryUsedByTeam: usedFlag,
    });
    const result = applyRestartMovement(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkBoxEntryUsedByTeam).toEqual({ home: false, away: false });
  });

  it('applyThrowInPlace (starts a fresh Movement Phase 1) resets the cap', () => {
    const thrower = piece('thrower', 'home', { q: 5, r: 5 });
    const state = baseState([homeGk, thrower], {
      phase: 'THROW_IN_SETUP',
      throwInHex: { q: 6, r: 5 },
      throwInTeam: 'home',
      gkBoxEntryUsedByTeam: usedFlag,
    });
    const result = applyThrowInPlace(state, 'thrower');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkBoxEntryUsedByTeam).toEqual({ home: false, away: false });
  });

  it('applyGKRestart("movement") resets the cap', () => {
    const gk = piece('gk', 'home', { q: 2, r: 13 }, { role: 'GK' });
    const state = baseState([gk], {
      phase: 'GK_RESTART',
      ball: { position: gk.position, carrierId: 'gk', lastTouchedBy: null },
      gkBoxEntryUsedByTeam: usedFlag,
    });
    const result = applyGKRestart(state, 'movement', () => 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gkBoxEntryUsedByTeam).toEqual({ home: false, away: false });
  });

  it('a mid-cycle slot advance (applyEndTurn ATTACKER_4 -> DEFENDER_5) does NOT clear the cap', () => {
    const state = baseState([homeGk], {
      phase: 'MOVE',
      movementSlot: 'ATTACKER_4',
      gkBoxEntryUsedByTeam: usedFlag,
    });
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.movementSlot).toBe('DEFENDER_5');
    expect(result.state.gkBoxEntryUsedByTeam).toEqual(usedFlag);
  });
});
