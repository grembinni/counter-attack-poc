import { describe, it, expect } from 'vitest';
import {
  triggerPenaltyKick,
  computePenaltyKickEligibleIds,
  applyPenaltyKickReposition,
  applyPenaltyKickWindowEnd,
  applyPenaltyKickTaker,
  applyPenaltyKickDuel,
  applyFoulChoice,
  relocateOutsidePenaltyArea,
  applyUndo,
} from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';
import {
  PENALTY_SPOT,
  PENALTY_GOAL_LINE_CENTRE,
  PITCH_REGIONS,
  isInRegion,
  isPitchHex,
  hexNeighbors,
  computeCombinedScore,
} from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Task 1 (39-07): gameEngine.penaltyKick.test.ts — full RED-state spec for
// PEN-01/02/03. Modelled on gameEngine.cornerKick.test.ts's fixture shape and
// gameEngine.outOfBounds.test.ts's applyGoalKickReposition boundary-fixture
// conventions. Every hex literal below is either PENALTY_SPOT, a PITCH_REGIONS
// member, or a computed hexNeighbors() step of one of those — never an
// invented coordinate (STATE.md's placeholder-coordinate pitfall).
// ---------------------------------------------------------------------------

const homeTaker: PlayerPiece = {
  id: 'home-taker',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'TAKER',
  number: 9,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 10, r: 13 }, // homeThird (q<=10)
  pace: 6,
  shooting: 5,
  tackling: 1,
  dribbling: 6,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 5,
  highPass: 5,
};

const homeGK: PlayerPiece = {
  id: 'home-gk',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 3, r: 13 }, // homeThird
  pace: 4,
  shooting: 1,
  tackling: 2,
  dribbling: 2,
  saving: 6,
  handling: 8,
  resilience: 6,
  aerialAbility: 5,
  highPass: 0,
};

/** Middle-third home piece — proves PEN-02's full-squad "no third-of-pitch filter". */
const homeMid: PlayerPiece = {
  id: 'home-mid',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'MID',
  number: 8,
  nationality: 'Test',
  role: 'MID',
  position: PITCH_REGIONS.kickOffHex, // {q:18,r:13} — middleThird
  pace: 7,
  shooting: 4,
  tackling: 4,
  dribbling: 5,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 5,
  highPass: 6,
};

/** Defending GK — positioned adjacent to PENALTY_SPOT.away so box-entry reposition tests are single-hex moves. */
const awayGKPosition: HexCoord = hexNeighbors(PENALTY_SPOT.away).find((h) => isPitchHex(h))!;
const awayGK: PlayerPiece = {
  id: 'away-gk',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: awayGKPosition,
  pace: 4,
  shooting: 1,
  tackling: 2,
  dribbling: 2,
  saving: 5,
  handling: 8,
  resilience: 6,
  aerialAbility: 5,
  highPass: 0,
};

/** Defending outfield piece standing just outside awayPenaltyArea (q<31), awayThird. */
const awayDef: PlayerPiece = {
  id: 'away-def',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'DEF',
  number: 4,
  nationality: 'Test',
  role: 'DEF',
  position: { q: 30, r: 13 }, // awayThird (q>=26), outside but adjacent to awayPenaltyArea (q>=31)
  pace: 6,
  shooting: 2,
  tackling: 6,
  dribbling: 4,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 5,
  highPass: 3,
};

/** Red-carded away piece — excluded from eligibility regardless of position (middle third, no filter otherwise). */
const awayRed: PlayerPiece = {
  id: 'away-red',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'RED',
  number: 5,
  nationality: 'Test',
  role: 'MID',
  position: { q: 20, r: 13 }, // middleThird
  redCarded: true,
  pace: 6,
  shooting: 3,
  tackling: 5,
  dribbling: 4,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 5,
  highPass: 4,
};

/** Minimal base fixture, mirrors gameEngine.cornerKick.test.ts's baseLooseBallState. */
const baseState: GameState = {
  roomCode: 'PEN1',
  phase: 'LOOSE_BALL',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeTaker, homeGK, homeMid, awayGK, awayDef, awayRed],
  ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
  score: { home: 0, away: 0 },
  actionCount: 10,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  ballZone: 'middle',
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' },
  selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
  gameSpeed: 'standard',
};

// ---------------------------------------------------------------------------
// triggerPenaltyKick
// ---------------------------------------------------------------------------

describe('triggerPenaltyKick', () => {
  // 39-22 (gap closure, UAT gap 5): the award now routes straight to taker-select
  // (kicker chosen BEFORE either reposition window opens), not SETUP_ATTACKING.
  it('sets phase to PENALTY_KICK_TAKER_SELECT (39-22 reordered chain)', () => {
    const result = triggerPenaltyKick(baseState, 'home');
    expect(result.phase).toBe('PENALTY_KICK_TAKER_SELECT');
  });

  it('places the defending goalkeeper on PENALTY_GOAL_LINE_CENTRE[defendingTeam] (home kicks -> away GK to (36,13))', () => {
    const result = triggerPenaltyKick(baseState, 'home');
    const gk = result.pieces.find((p) => p.id === awayGK.id)!;
    expect(gk.position).toEqual(PENALTY_GOAL_LINE_CENTRE.away);
  });

  it('places the defending goalkeeper on PENALTY_GOAL_LINE_CENTRE.home when away kicks (mirror)', () => {
    const result = triggerPenaltyKick(baseState, 'away');
    const gk = result.pieces.find((p) => p.id === homeGK.id)!;
    expect(gk.position).toEqual(PENALTY_GOAL_LINE_CENTRE.home);
  });

  it('clears every non-GK piece out of the defending penalty area, leaving only the GK inside it', () => {
    // Pack three away pieces inside the away box (defending side when home kicks).
    const boxed1: PlayerPiece = { ...awayDef, id: 'away-boxed-1', position: { q: 33, r: 10 } };
    const boxed2: PlayerPiece = { ...awayDef, id: 'away-boxed-2', position: { q: 34, r: 12 } };
    const boxed3: PlayerPiece = { ...awayDef, id: 'away-boxed-3', position: { q: 35, r: 15 } };
    const state: GameState = {
      ...baseState,
      pieces: [...baseState.pieces, boxed1, boxed2, boxed3],
    };
    const result = triggerPenaltyKick(state, 'home');
    const insideBox = result.pieces.filter((p) => isInRegion(p.position, 'awayPenaltyArea'));
    expect(insideBox).toHaveLength(1);
    expect(insideBox[0]!.id).toBe(awayGK.id);
  });

  it('no two pieces share a hex after the award-time box setup', () => {
    const boxed1: PlayerPiece = { ...awayDef, id: 'away-boxed-1', position: { q: 33, r: 10 } };
    const boxed2: PlayerPiece = { ...awayDef, id: 'away-boxed-2', position: { q: 34, r: 12 } };
    const state: GameState = { ...baseState, pieces: [...baseState.pieces, boxed1, boxed2] };
    const result = triggerPenaltyKick(state, 'home');
    const keys = result.pieces.map((p) => `${p.position.q},${p.position.r}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('running the same trigger twice on the same input yields identical clear-out positions (deterministic)', () => {
    const boxed1: PlayerPiece = { ...awayDef, id: 'away-boxed-1', position: { q: 33, r: 10 } };
    const boxed2: PlayerPiece = { ...awayDef, id: 'away-boxed-2', position: { q: 34, r: 12 } };
    const state: GameState = { ...baseState, pieces: [...baseState.pieces, boxed1, boxed2] };
    const first = triggerPenaltyKick(state, 'home');
    const second = triggerPenaltyKick(state, 'home');
    expect(first.pieces.map((p) => p.position)).toEqual(second.pieces.map((p) => p.position));
  });

  it('appends one PENALTY_KICK_CLEAR_OUT_MOVE event per relocated piece', () => {
    const boxed1: PlayerPiece = { ...awayDef, id: 'away-boxed-1', position: { q: 33, r: 10 } };
    const state: GameState = { ...baseState, pieces: [...baseState.pieces, boxed1] };
    const result = triggerPenaltyKick(state, 'home');
    const clearOutEvents = result.eventLog.filter((e) => e.type === 'PENALTY_KICK_CLEAR_OUT_MOVE');
    expect(clearOutEvents.length).toBeGreaterThanOrEqual(1);
    expect(
      clearOutEvents.some(
        (e) => e.type === 'PENALTY_KICK_CLEAR_OUT_MOVE' && e.pieceId === boxed1.id,
      ),
    ).toBe(true);
  });

  it('sets penaltyKickTeam to the kicking team', () => {
    const result = triggerPenaltyKick(baseState, 'home');
    expect(result.penaltyKickTeam).toBe('home');
  });

  it("sets penaltyKickSpot to PENALTY_SPOT keyed by the DEFENDING team (home kicks -> away's spot)", () => {
    const result = triggerPenaltyKick(baseState, 'home');
    expect(result.penaltyKickSpot).toEqual(PENALTY_SPOT.away);
  });

  it('sets penaltyKickSpot to PENALTY_SPOT.home when away kicks (mirror case)', () => {
    const result = triggerPenaltyKick(baseState, 'away');
    expect(result.penaltyKickSpot).toEqual(PENALTY_SPOT.home);
  });

  it('sets ball.position to the spot with carrierId null and carries lastTouchedBy through unchanged', () => {
    const stateWithToucher: GameState = {
      ...baseState,
      ball: {
        position: { q: 18, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayDef.id, teamId: 'away' },
      },
    };
    const result = triggerPenaltyKick(stateWithToucher, 'home');
    expect(result.ball).toEqual({
      position: PENALTY_SPOT.away,
      carrierId: null,
      lastTouchedBy: { pieceId: awayDef.id, teamId: 'away' },
    });
  });

  it('sets attackingTeam and activeTeam both to the kicking team', () => {
    const result = triggerPenaltyKick(baseState, 'home');
    expect(result.attackingTeam).toBe('home');
    expect(result.activeTeam).toBe('home');
  });

  it('populates penaltyKickEligibleIds', () => {
    const result = triggerPenaltyKick(baseState, 'home');
    expect(result.penaltyKickEligibleIds).not.toBeNull();
    expect(result.penaltyKickEligibleIds?.attacking.length).toBeGreaterThan(0);
    expect(result.penaltyKickEligibleIds?.defending.length).toBeGreaterThan(0);
  });

  it('sets penaltyKickUsedPace to {}, penaltyKickTakerId to null, movedPieceIds to [], lastDiceRoll to null', () => {
    const result = triggerPenaltyKick(baseState, 'home');
    expect(result.penaltyKickUsedPace).toEqual({});
    expect(result.penaltyKickTakerId).toBeNull();
    expect(result.movedPieceIds).toEqual([]);
    expect(result.lastDiceRoll).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computePenaltyKickEligibleIds
// ---------------------------------------------------------------------------

describe('computePenaltyKickEligibleIds', () => {
  const pieces = [homeTaker, homeGK, homeMid, awayGK, awayDef, awayRed];

  it('returns every on-pitch piece of each team, split attacking/defending, with NO third-of-pitch filter', () => {
    const result = computePenaltyKickEligibleIds(pieces, 'home');
    // homeMid stands in the middle third yet must still be eligible (contrast with goal kick).
    expect(result.attacking).toContain(homeMid.id);
    expect([...result.attacking].sort()).toEqual([homeGK.id, homeMid.id, homeTaker.id].sort());
  });

  it('excludes any redCarded piece from the defending list', () => {
    const result = computePenaltyKickEligibleIds(pieces, 'home');
    expect(result.defending).not.toContain(awayRed.id);
    expect([...result.defending].sort()).toEqual([awayDef.id, awayGK.id].sort());
  });

  it('partitions by team when the kicking team is away (mirror)', () => {
    const result = computePenaltyKickEligibleIds(pieces, 'away');
    expect([...result.attacking].sort()).toEqual([awayDef.id, awayGK.id].sort());
    expect([...result.defending].sort()).toEqual([homeGK.id, homeMid.id, homeTaker.id].sort());
  });
});

// ---------------------------------------------------------------------------
// applyPenaltyKickReposition
// ---------------------------------------------------------------------------

/** ATTACKING-window fixture: home is taking the penalty. */
const baseAttackingState: GameState = {
  ...baseState,
  phase: 'PENALTY_KICK_SETUP_ATTACKING',
  penaltyKickTeam: 'home',
  penaltyKickSpot: PENALTY_SPOT.away,
  penaltyKickEligibleIds: {
    attacking: [homeTaker.id, homeGK.id, homeMid.id],
    defending: [awayGK.id, awayDef.id],
  },
  penaltyKickUsedPace: {},
  penaltyKickTakerId: null,
  attackingTeam: 'home',
  activeTeam: 'home',
  movedPieceIds: [],
  ball: { position: PENALTY_SPOT.away, carrierId: null, lastTouchedBy: null },
};

/** DEFENDING-window fixture: away repositions next. */
const baseDefendingState: GameState = {
  ...baseAttackingState,
  phase: 'PENALTY_KICK_SETUP_DEFENDING',
  activeTeam: 'away',
};

describe('applyPenaltyKickReposition', () => {
  it('rejects WRONG_PHASE outside the two penalty reposition phases', () => {
    const state: GameState = { ...baseAttackingState, phase: 'PENALTY_KICK_TAKER_SELECT' };
    const to = hexNeighbors(homeTaker.position).find((h) => isPitchHex(h))!;
    const result = applyPenaltyKickReposition(state, homeTaker.id, to);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects WRONG_TEAM for a piece whose teamId !== state.activeTeam', () => {
    const to = hexNeighbors(awayDef.position).find((h) => isPitchHex(h))!;
    const result = applyPenaltyKickReposition(baseAttackingState, awayDef.id, to);
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('rejects MOVE_INVALID/NOT_ELIGIBLE for a piece not in the active window eligible list', () => {
    // A home piece present on the pitch but not part of this window's eligible list
    // (e.g. it entered play after eligibility was computed at trigger time).
    const homeExtra: PlayerPiece = { ...homeMid, id: 'home-extra', position: { q: 12, r: 13 } };
    const state: GameState = {
      ...baseAttackingState,
      pieces: [...baseAttackingState.pieces, homeExtra],
    };
    const to = hexNeighbors(homeExtra.position).find((h) => isPitchHex(h))!;
    const result = applyPenaltyKickReposition(state, homeExtra.id, to);
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'NOT_ELIGIBLE' });
  });

  it('rejects MOVE_INVALID/OUT_OF_RANGE for a non-adjacent destination', () => {
    const result = applyPenaltyKickReposition(baseAttackingState, homeTaker.id, {
      q: homeTaker.position.q + 3,
      r: homeTaker.position.r,
    });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OUT_OF_RANGE' });
  });

  it('rejects MOVE_INVALID/OFF_PITCH for an adjacent but off-pitch destination', () => {
    // homeGK sits at q=3 (homeThird); step it to the byline (q=0) so its neighbour set
    // includes an off-grid q=-1 hex (mirrors gameEngine.outOfBounds.test.ts's edge fixtures).
    const edgePiece: PlayerPiece = { ...homeGK, position: { q: 0, r: 5 } };
    const state: GameState = {
      ...baseAttackingState,
      pieces: baseAttackingState.pieces.map((p) => (p.id === homeGK.id ? edgePiece : p)),
    };
    const offPitchNeighbor = hexNeighbors(edgePiece.position).find((h) => !isPitchHex(h))!;
    const result = applyPenaltyKickReposition(state, homeGK.id, offPitchNeighbor);
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('rejects MOVE_INVALID/OCCUPIED for a destination occupied by another piece', () => {
    const to = hexNeighbors(homeTaker.position).find((h) => isPitchHex(h))!;
    const occupant: PlayerPiece = { ...homeMid, id: 'home-occupant', position: to };
    const state: GameState = {
      ...baseAttackingState,
      pieces: [...baseAttackingState.pieces, occupant],
    };
    const result = applyPenaltyKickReposition(state, homeTaker.id, to);
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OCCUPIED' });
  });

  it('rejects MOVE_INVALID/PENALTY_AREA_RESTRICTED for a non-GK/non-taker piece entering the defending penalty area', () => {
    const to = hexNeighbors(awayDef.position).find(
      (h) => isPitchHex(h) && isInRegion(h, 'awayPenaltyArea'),
    )!;
    const state: GameState = { ...baseDefendingState };
    const result = applyPenaltyKickReposition(state, awayDef.id, to);
    expect(result).toEqual({
      ok: false,
      reason: 'MOVE_INVALID',
      detail: 'PENALTY_AREA_RESTRICTED',
    });
  });

  // 39-22 (gap closure, UAT gap 5): taker-select now precedes both reposition
  // windows, so the defending goalkeeper and the chosen taker are BOTH known here —
  // and BOTH are now unconditionally immovable (the former GK/taker exemptions from
  // the PENALTY_AREA_RESTRICTED guard are removed entirely; see T-39-22-02).
  it('rejects the defending goalkeeper with PENALTY_KICK_PIECE_IMMOVABLE, even for a legal destination', () => {
    const to = hexNeighbors(awayGK.position).find((h) => isPitchHex(h))!;
    const state: GameState = { ...baseDefendingState, penaltyKickTakerId: homeTaker.id };
    const result = applyPenaltyKickReposition(state, awayGK.id, to);
    expect(result).toEqual({
      ok: false,
      reason: 'MOVE_INVALID',
      detail: 'PENALTY_KICK_PIECE_IMMOVABLE',
    });
  });

  it('rejects the chosen penalty taker with PENALTY_KICK_PIECE_IMMOVABLE, even for a legal destination', () => {
    // homeTaker is both eligible (per baseAttackingState's list) and the chosen taker
    // here — the immovability guard fires before the eligible-list/adjacency checks.
    const to = hexNeighbors(homeTaker.position).find((h) => isPitchHex(h))!;
    const state: GameState = { ...baseAttackingState, penaltyKickTakerId: homeTaker.id };
    const result = applyPenaltyKickReposition(state, homeTaker.id, to);
    expect(result).toEqual({
      ok: false,
      reason: 'MOVE_INVALID',
      detail: 'PENALTY_KICK_PIECE_IMMOVABLE',
    });
  });

  it('rejects ANY eligible piece (attacking or defending) moving into the defending penalty area — no exemptions remain', () => {
    // awayDef is neither the taker nor the defending GK — under the OLD rules this
    // was already rejected; the point of this test is that there is now NO piece
    // (other than the two immovable ones above, which never reach this guard at
    // all) that can ever legally enter the box.
    const to = hexNeighbors(awayDef.position).find(
      (h) => isPitchHex(h) && isInRegion(h, 'awayPenaltyArea'),
    )!;
    const state: GameState = { ...baseDefendingState, penaltyKickTakerId: homeTaker.id };
    const result = applyPenaltyKickReposition(state, awayDef.id, to);
    expect(result).toEqual({
      ok: false,
      reason: 'MOVE_INVALID',
      detail: 'PENALTY_AREA_RESTRICTED',
    });
  });

  it('allows an eligible, non-immovable piece to reposition to a legal hex outside the box', () => {
    const to = hexNeighbors(homeMid.position).find((h) => isPitchHex(h))!;
    const state: GameState = { ...baseAttackingState, penaltyKickTakerId: homeTaker.id };
    const result = applyPenaltyKickReposition(state, homeMid.id, to);
    expect(result.ok).toBe(true);
  });

  it('accepts an unlimited number of single-step moves for the same piece — no budget rejection at any step count (PEN-02 unbudgeted)', () => {
    let state: GameState = baseAttackingState;
    let current = homeMid.position;
    for (let i = 0; i < 8; i++) {
      const to = hexNeighbors(current).find(
        (h) =>
          isPitchHex(h) && !state.pieces.some((p) => p.position.q === h.q && p.position.r === h.r),
      )!;
      const result = applyPenaltyKickReposition(state, homeMid.id, to);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      current = to;
    }
    expect(state.penaltyKickUsedPace?.[homeMid.id]).toBeGreaterThan(6);
  });

  it('activates (locks) an in-progress unfinished activation on a DIFFERENT piece when a new piece starts moving (abandonment sweep)', () => {
    const firstTo = hexNeighbors(homeTaker.position).find((h) => isPitchHex(h))!;
    const first = applyPenaltyKickReposition(baseAttackingState, homeTaker.id, firstTo);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // homeTaker now has an in-progress activation (used pace > 0, not yet in movedPieceIds).
    expect(first.state.movedPieceIds).not.toContain(homeTaker.id);

    const secondTo = hexNeighbors(homeMid.position).find((h) => isPitchHex(h))!;
    const second = applyPenaltyKickReposition(first.state, homeMid.id, secondTo);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    // Starting a fresh activation on homeMid locks homeTaker's abandoned in-progress move.
    expect(second.state.movedPieceIds).toContain(homeTaker.id);
  });
});

// ---------------------------------------------------------------------------
// applyPenaltyKickWindowEnd
// ---------------------------------------------------------------------------

describe('applyPenaltyKickWindowEnd', () => {
  it('hands off PENALTY_KICK_SETUP_ATTACKING to PENALTY_KICK_SETUP_DEFENDING, flips activeTeam, resets movedPieceIds/penaltyKickUsedPace, appends PENALTY_KICK_WINDOW_ADVANCE(from: ATTACKING)', () => {
    const state: GameState = {
      ...baseAttackingState,
      movedPieceIds: [homeTaker.id],
      penaltyKickUsedPace: { [homeTaker.id]: 3 },
    };
    const result = applyPenaltyKickWindowEnd(state, 'home');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PENALTY_KICK_SETUP_DEFENDING');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.movedPieceIds).toEqual([]);
    expect(result.state.penaltyKickUsedPace).toEqual({});
    const advanceEvent = result.state.eventLog.find(
      (e) => e.type === 'PENALTY_KICK_WINDOW_ADVANCE',
    );
    expect(advanceEvent).toBeDefined();
    if (advanceEvent?.type === 'PENALTY_KICK_WINDOW_ADVANCE') {
      expect(advanceEvent.from).toBe('ATTACKING');
    }
  });

  // 39-22 (gap closure, UAT gap 5): taker-select now precedes both windows, so the
  // DEFENDING terminal goes straight to PENALTY_KICK (the duel), not TAKER_SELECT.
  it('advances PENALTY_KICK_SETUP_DEFENDING to PENALTY_KICK, activeTeam back to penaltyKickTeam, appends PENALTY_KICK_WINDOW_ADVANCE(from: DEFENDING)', () => {
    const result = applyPenaltyKickWindowEnd(baseDefendingState, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PENALTY_KICK');
    expect(result.state.activeTeam).toBe('home');
    const advanceEvent = result.state.eventLog.find(
      (e) => e.type === 'PENALTY_KICK_WINDOW_ADVANCE',
    );
    expect(advanceEvent).toBeDefined();
    if (advanceEvent?.type === 'PENALTY_KICK_WINDOW_ADVANCE') {
      expect(advanceEvent.from).toBe('DEFENDING');
    }
  });

  it('rejects WRONG_TEAM when the wrong team confirms', () => {
    const result = applyPenaltyKickWindowEnd(baseAttackingState, 'away');
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });
});

// ---------------------------------------------------------------------------
// applyPenaltyKickTaker
// ---------------------------------------------------------------------------

const baseTakerSelectState: GameState = {
  ...baseAttackingState,
  phase: 'PENALTY_KICK_TAKER_SELECT',
  activeTeam: 'home',
  movedPieceIds: [],
  penaltyKickUsedPace: {},
};

describe('applyPenaltyKickTaker', () => {
  it('rejects a goalkeeper (TAKER_INVALID)', () => {
    const result = applyPenaltyKickTaker(baseTakerSelectState, homeGK.id);
    expect(result).toEqual({ ok: false, reason: 'TAKER_INVALID' });
  });

  it('rejects a defending-team piece (WRONG_TEAM)', () => {
    const result = applyPenaltyKickTaker(baseTakerSelectState, awayDef.id);
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('rejects a redCarded piece (TAKER_INVALID)', () => {
    const redTaker: PlayerPiece = { ...homeMid, id: 'home-red', redCarded: true };
    const state: GameState = {
      ...baseTakerSelectState,
      pieces: [...baseTakerSelectState.pieces, redTaker],
    };
    const result = applyPenaltyKickTaker(state, redTaker.id);
    expect(result).toEqual({ ok: false, reason: 'TAKER_INVALID' });
  });

  it('rejects an unknown piece id (PIECE_NOT_FOUND)', () => {
    const result = applyPenaltyKickTaker(baseTakerSelectState, 'ghost-piece');
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  // 39-22 (gap closure, UAT gap 5): taker-select now precedes both reposition
  // windows — success transitions to PENALTY_KICK_SETUP_ATTACKING, not PENALTY_KICK.
  it('on success moves the taker onto penaltyKickSpot, sets penaltyKickTakerId, sets ball.carrierId, appends PENALTY_KICK_TAKER_PLACED, transitions to PENALTY_KICK_SETUP_ATTACKING', () => {
    const result = applyPenaltyKickTaker(baseTakerSelectState, homeTaker.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = result.state.pieces.find((p) => p.id === homeTaker.id)!;
    expect(moved.position).toEqual(PENALTY_SPOT.away);
    expect(result.state.penaltyKickTakerId).toBe(homeTaker.id);
    expect(result.state.ball.carrierId).toBe(homeTaker.id);
    expect(result.state.ball.position).toEqual(PENALTY_SPOT.away);
    expect(result.state.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
    expect(result.state.activeTeam).toBe('home');
    const placedEvent = result.state.eventLog.find((e) => e.type === 'PENALTY_KICK_TAKER_PLACED');
    expect(placedEvent).toBeDefined();
  });

  it('recomputes penaltyKickEligibleIds excluding the chosen taker and the defending goalkeeper from BOTH lists', () => {
    const result = applyPenaltyKickTaker(baseTakerSelectState, homeTaker.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.penaltyKickEligibleIds?.attacking).not.toContain(homeTaker.id);
    expect(result.state.penaltyKickEligibleIds?.attacking).not.toContain(awayGK.id);
    expect(result.state.penaltyKickEligibleIds?.defending).not.toContain(homeTaker.id);
    expect(result.state.penaltyKickEligibleIds?.defending).not.toContain(awayGK.id);
    // Non-immovable pieces of both teams remain eligible.
    expect(result.state.penaltyKickEligibleIds?.attacking).toContain(homeMid.id);
    expect(result.state.penaltyKickEligibleIds?.defending).toContain(awayDef.id);
  });

  it('displaces an occupant of the penalty spot to the nearest unoccupied on-pitch hex outside the penalty area before placing the taker', () => {
    const occupant: PlayerPiece = {
      ...awayDef,
      id: 'away-spot-occupant',
      position: PENALTY_SPOT.away,
    };
    const state: GameState = {
      ...baseTakerSelectState,
      pieces: [...baseTakerSelectState.pieces, occupant],
    };
    const result = applyPenaltyKickTaker(state, homeTaker.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const displaced = result.state.pieces.find((p) => p.id === occupant.id)!;
    expect(displaced.position).not.toEqual(PENALTY_SPOT.away);
    expect(isPitchHex(displaced.position)).toBe(true);
    expect(isInRegion(displaced.position, 'awayPenaltyArea')).toBe(false);
    // No two pieces share a coordinate after displacement.
    const taker = result.state.pieces.find((p) => p.id === homeTaker.id)!;
    expect(taker.position).toEqual(PENALTY_SPOT.away);
    expect(displaced.position).not.toEqual(taker.position);
  });
});

// ---------------------------------------------------------------------------
// applyPenaltyKickDuel
// ---------------------------------------------------------------------------

const baseDuelState: GameState = {
  ...baseState,
  phase: 'PENALTY_KICK',
  penaltyKickTeam: 'home',
  penaltyKickSpot: PENALTY_SPOT.away,
  penaltyKickEligibleIds: null,
  penaltyKickUsedPace: {},
  penaltyKickTakerId: homeTaker.id,
  attackingTeam: 'home',
  activeTeam: 'home',
  score: { home: 0, away: 0 },
  ball: {
    position: PENALTY_SPOT.away,
    carrierId: homeTaker.id,
    lastTouchedBy: { pieceId: homeTaker.id, teamId: 'home' },
  },
};

describe('applyPenaltyKickDuel', () => {
  it('rejects WRONG_PHASE outside PENALTY_KICK', () => {
    const state: GameState = { ...baseDuelState, phase: 'LOOSE_BALL' };
    const result = applyPenaltyKickDuel(state, 5, 5);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects PIECE_NOT_FOUND when penaltyKickTakerId does not resolve to a piece', () => {
    const state: GameState = { ...baseDuelState, penaltyKickTakerId: 'ghost-taker' };
    const result = applyPenaltyKickDuel(state, 5, 5);
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('rejects PIECE_NOT_FOUND when the defending goalkeeper cannot be resolved', () => {
    const state: GameState = {
      ...baseDuelState,
      pieces: baseDuelState.pieces.filter((p) => p.id !== awayGK.id),
    };
    const result = applyPenaltyKickDuel(state, 5, 5);
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('GOAL: taker combined strictly greater than GK combined (with -2 GK penalty applied) increments score, appends GOAL after PENALTY_KICK, resets to kick-off', () => {
    // homeTaker.shooting=5, takerDie=6 -> 11. awayGK.saving=5, gkDie=6, penalty -2 -> 9.
    const takerDie = 6;
    const gkDie = 6;
    const expectedTaker = computeCombinedScore(homeTaker.shooting, takerDie, []);
    const expectedGk = computeCombinedScore(awayGK.saving, gkDie, [-2]);
    expect(expectedTaker).toBeGreaterThan(expectedGk);

    const result = applyPenaltyKickDuel(baseDuelState, takerDie, gkDie);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.score.home).toBe(1);
    expect(result.state.phase).toBe('KICK_OFF_SETUP');
    const penEvent = result.state.eventLog.find((e) => e.type === 'PENALTY_KICK');
    const goalEvent = result.state.eventLog.find((e) => e.type === 'GOAL');
    expect(penEvent).toBeDefined();
    expect(goalEvent).toBeDefined();
    if (penEvent?.type === 'PENALTY_KICK') {
      expect(penEvent.result).toBe('GOAL');
      expect(penEvent.takerCombined).toBe(expectedTaker);
      expect(penEvent.gkCombined).toBe(expectedGk);
    }
  });

  it('SAVED: GK combined strictly greater than taker combined sends the ball to the goalkeeper and restarts at GK_RESTART', () => {
    // homeTaker.shooting=5, takerDie=1 -> 6. awayGK.saving=5, gkDie=6, penalty -2 -> 9.
    const takerDie = 1;
    const gkDie = 6;
    const expectedTaker = computeCombinedScore(homeTaker.shooting, takerDie, []);
    const expectedGk = computeCombinedScore(awayGK.saving, gkDie, [-2]);
    expect(expectedGk).toBeGreaterThan(expectedTaker);

    const result = applyPenaltyKickDuel(baseDuelState, takerDie, gkDie);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_RESTART');
    expect(result.state.ball.carrierId).toBe(awayGK.id);
    expect(result.state.ball.position).toEqual(awayGK.position);
    const penEvent = result.state.eventLog.find((e) => e.type === 'PENALTY_KICK');
    if (penEvent?.type === 'PENALTY_KICK') {
      expect(penEvent.result).toBe('SAVED');
    }
  });

  it('TIE: exactly equal combined scores route to LOOSE_BALL with the ball at penaltyKickSpot, carrierId null (PEN-03)', () => {
    // homeTaker.shooting=5, takerDie=3 -> 8. awayGK.saving=5, gkDie=5, penalty clamped -2 -> 8.
    const takerDie = 3;
    const gkDie = 5;
    const expectedTaker = computeCombinedScore(homeTaker.shooting, takerDie, []);
    const expectedGk = computeCombinedScore(awayGK.saving, gkDie, [-2]);
    expect(expectedTaker).toBe(expectedGk);

    const result = applyPenaltyKickDuel(baseDuelState, takerDie, gkDie);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.ball.position).toEqual(PENALTY_SPOT.away);
    expect(result.state.ball.carrierId).toBeNull();
    const penEvent = result.state.eventLog.find((e) => e.type === 'PENALTY_KICK');
    if (penEvent?.type === 'PENALTY_KICK') {
      expect(penEvent.result).toBe('TIE');
    }
  });

  it('the -2 goalkeeper penalty is applied via computeCombinedScore, not a bare subtraction — a high-saving GK is still clamped at -2', () => {
    const highSavingGk: PlayerPiece = { ...awayGK, id: 'away-gk-high', saving: 8 };
    const state: GameState = {
      ...baseDuelState,
      pieces: baseDuelState.pieces.map((p) => (p.id === awayGK.id ? highSavingGk : p)),
    };
    const gkDie = 1;
    const expectedGk = computeCombinedScore(highSavingGk.saving, gkDie, [-2]);
    expect(expectedGk).toBe(highSavingGk.saving + gkDie - 2);
    const result = applyPenaltyKickDuel(state, 1, gkDie);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const penEvent = result.state.eventLog.find((e) => e.type === 'PENALTY_KICK');
    if (penEvent?.type === 'PENALTY_KICK') {
      expect(penEvent.gkCombined).toBe(expectedGk);
    }
  });

  it('every terminal branch clears the penaltyKick* cluster (GOAL branch)', () => {
    const result = applyPenaltyKickDuel(baseDuelState, 6, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.penaltyKickTeam).toBeNull();
    expect(result.state.penaltyKickEligibleIds).toBeNull();
    expect(result.state.penaltyKickUsedPace).toEqual({});
    expect(result.state.penaltyKickTakerId).toBeNull();
  });

  it('every terminal branch clears the penaltyKick* cluster (SAVED branch)', () => {
    const result = applyPenaltyKickDuel(baseDuelState, 1, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.penaltyKickTeam).toBeNull();
    expect(result.state.penaltyKickEligibleIds).toBeNull();
    expect(result.state.penaltyKickUsedPace).toEqual({});
    expect(result.state.penaltyKickTakerId).toBeNull();
  });

  it('every terminal branch clears the penaltyKick* cluster (TIE branch)', () => {
    const result = applyPenaltyKickDuel(baseDuelState, 3, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.penaltyKickTeam).toBeNull();
    expect(result.state.penaltyKickEligibleIds).toBeNull();
    expect(result.state.penaltyKickUsedPace).toEqual({});
    expect(result.state.penaltyKickTakerId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// relocateOutsidePenaltyArea (39-22, gap closure — UAT gap 5)
// ---------------------------------------------------------------------------

describe('relocateOutsidePenaltyArea', () => {
  it('relocates a piece inside the given area to the nearest legal hex outside it', () => {
    const boxed: PlayerPiece = { ...awayDef, id: 'away-boxed', position: { q: 33, r: 13 } };
    const pieces = [...baseState.pieces, boxed];
    const result = relocateOutsidePenaltyArea(pieces, [boxed.id], 'awayPenaltyArea');
    const relocated = result.pieces.find((p) => p.id === boxed.id)!;
    expect(isInRegion(relocated.position, 'awayPenaltyArea')).toBe(false);
    expect(isPitchHex(relocated.position)).toBe(true);
  });

  it('is fully deterministic — running twice on identical input yields identical output (never calls randomInt)', () => {
    const boxed1: PlayerPiece = { ...awayDef, id: 'away-boxed-1', position: { q: 33, r: 10 } };
    const boxed2: PlayerPiece = { ...awayDef, id: 'away-boxed-2', position: { q: 34, r: 12 } };
    const pieces = [...baseState.pieces, boxed1, boxed2];
    const first = relocateOutsidePenaltyArea(pieces, [boxed1.id, boxed2.id], 'awayPenaltyArea');
    const second = relocateOutsidePenaltyArea(pieces, [boxed1.id, boxed2.id], 'awayPenaltyArea');
    expect(first.pieces.map((p) => p.position)).toEqual(second.pieces.map((p) => p.position));
  });

  it('never places two relocated pieces on the same hex', () => {
    const boxed1: PlayerPiece = { ...awayDef, id: 'away-boxed-1', position: { q: 33, r: 10 } };
    const boxed2: PlayerPiece = { ...awayDef, id: 'away-boxed-2', position: { q: 33, r: 11 } };
    const pieces = [...baseState.pieces, boxed1, boxed2];
    const result = relocateOutsidePenaltyArea(pieces, [boxed1.id, boxed2.id], 'awayPenaltyArea');
    const p1 = result.pieces.find((p) => p.id === boxed1.id)!;
    const p2 = result.pieces.find((p) => p.id === boxed2.id)!;
    expect(p1.position).not.toEqual(p2.position);
  });

  it('leaves pieces untouched and emits no events when the id list is empty', () => {
    const result = relocateOutsidePenaltyArea(baseState.pieces, [], 'awayPenaltyArea');
    expect(result.pieces).toEqual(baseState.pieces);
    expect(result.events).toEqual([]);
  });

  it('emits one PENALTY_KICK_CLEAR_OUT_MOVE event with correct from/to for each relocated piece', () => {
    const boxed: PlayerPiece = { ...awayDef, id: 'away-boxed', position: { q: 33, r: 13 } };
    const pieces = [...baseState.pieces, boxed];
    const result = relocateOutsidePenaltyArea(pieces, [boxed.id], 'awayPenaltyArea');
    expect(result.events).toHaveLength(1);
    const event = result.events[0]!;
    expect(event.type).toBe('PENALTY_KICK_CLEAR_OUT_MOVE');
    if (event.type === 'PENALTY_KICK_CLEAR_OUT_MOVE') {
      expect(event.pieceId).toBe(boxed.id);
      expect(event.from).toEqual({ q: 33, r: 13 });
      expect(isInRegion(event.to, 'awayPenaltyArea')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// applyFoulChoice: box-location routing (39-22, gap closure — UAT gap 5)
// ---------------------------------------------------------------------------

/** FOUL_CHOICE fixture: away defender fouled the home attacker; home is the fouled/attacking team. */
const foulFixtureState: GameState = {
  ...baseState,
  phase: 'FOUL_CHOICE',
  attackingTeam: 'home',
  activeTeam: 'home',
  foulDefenderId: awayDef.id,
  foulVictimId: homeTaker.id,
  foulSource: 'TACKLE',
  foulResume: null,
  foulDuelSucceeded: false,
};

describe('applyFoulChoice: box-location routing (39-22, UAT gap 5)', () => {
  it('awards a PENALTY when a TACKLE-sourced foul hex is inside the fouling (away) team penalty area', () => {
    const state: GameState = { ...foulFixtureState, foulHex: { q: 33, r: 13 } };
    const result = applyFoulChoice(state, 'restart');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PENALTY_KICK_TAKER_SELECT');
    const choiceEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CHOICE_MADE');
    expect(choiceEvent).toBeDefined();
    if (choiceEvent?.type === 'FOUL_CHOICE_MADE') {
      expect(choiceEvent.restart).toBe('PENALTY');
    }
  });

  it('awards a FREE_KICK when the same TACKLE-sourced foul hex is outside every penalty area', () => {
    const state: GameState = { ...foulFixtureState, foulHex: { q: 18, r: 13 } };
    const result = applyFoulChoice(state, 'restart');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('FREE_KICK_SETUP');
    const choiceEvent = result.state.eventLog.find((e) => e.type === 'FOUL_CHOICE_MADE');
    expect(choiceEvent).toBeDefined();
    if (choiceEvent?.type === 'FOUL_CHOICE_MADE') {
      expect(choiceEvent.restart).toBe('FREE_KICK');
    }
  });

  it('a GK_DIVE_AT_FEET-sourced foul is STILL a penalty even when foulHex is outside every penalty area (GKDIVE-03 preserved)', () => {
    const state: GameState = {
      ...foulFixtureState,
      foulSource: 'GK_DIVE_AT_FEET',
      foulDefenderId: awayGK.id,
      foulHex: { q: 18, r: 13 },
    };
    const result = applyFoulChoice(state, 'restart');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PENALTY_KICK_TAKER_SELECT');
  });

  it('an in-box STEAL-sourced foul also yields a penalty', () => {
    const state: GameState = {
      ...foulFixtureState,
      foulSource: 'STEAL',
      foulHex: { q: 34, r: 10 },
    };
    const result = applyFoulChoice(state, 'restart');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PENALTY_KICK_TAKER_SELECT');
  });

  it('after the award, the defending goalkeeper stands exactly on PENALTY_GOAL_LINE_CENTRE[defendingTeam]', () => {
    const state: GameState = { ...foulFixtureState, foulHex: { q: 33, r: 13 } };
    const result = applyFoulChoice(state, 'restart');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const gk = result.state.pieces.find((p) => p.id === awayGK.id)!;
    expect(gk.position).toEqual(PENALTY_GOAL_LINE_CENTRE.away);
  });
});

// ---------------------------------------------------------------------------
// Task 2 (39-22, gap closure — UAT gap 5): the reordered chain runs end-to-end
// through the real engine functions: TAKER_SELECT -> SETUP_ATTACKING ->
// SETUP_DEFENDING -> PENALTY_KICK.
// ---------------------------------------------------------------------------

describe('reordered penalty chain (39-22): TAKER_SELECT -> SETUP_ATTACKING -> SETUP_DEFENDING -> PENALTY_KICK', () => {
  it('runs the full chain end-to-end via the real engine functions', () => {
    const awarded = triggerPenaltyKick(baseState, 'home');
    expect(awarded.phase).toBe('PENALTY_KICK_TAKER_SELECT');

    const takerResult = applyPenaltyKickTaker(awarded, homeTaker.id);
    expect(takerResult.ok).toBe(true);
    if (!takerResult.ok) return;
    expect(takerResult.state.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');

    const window1 = applyPenaltyKickWindowEnd(takerResult.state, 'home');
    expect(window1.ok).toBe(true);
    if (!window1.ok) return;
    expect(window1.state.phase).toBe('PENALTY_KICK_SETUP_DEFENDING');

    const window2 = applyPenaltyKickWindowEnd(window1.state, 'away');
    expect(window2.ok).toBe(true);
    if (!window2.ok) return;
    expect(window2.state.phase).toBe('PENALTY_KICK');

    const duelResult = applyPenaltyKickDuel(window2.state, 4, 2);
    expect(duelResult.ok).toBe(true);
    if (!duelResult.ok) return;
    expect(['KICK_OFF_SETUP', 'GK_RESTART', 'LOOSE_BALL']).toContain(duelResult.state.phase);
  });

  it('the taker stands on penaltyKickSpot, carries the ball, and appears in NEITHER eligible list throughout the windows', () => {
    const awarded = triggerPenaltyKick(baseState, 'home');
    const takerResult = applyPenaltyKickTaker(awarded, homeTaker.id);
    expect(takerResult.ok).toBe(true);
    if (!takerResult.ok) return;
    expect(takerResult.state.penaltyKickEligibleIds?.attacking).not.toContain(homeTaker.id);
    expect(takerResult.state.penaltyKickEligibleIds?.defending).not.toContain(homeTaker.id);
    const taker = takerResult.state.pieces.find((p) => p.id === homeTaker.id)!;
    expect(taker.position).toEqual(takerResult.state.penaltyKickSpot);
    expect(takerResult.state.ball.carrierId).toBe(homeTaker.id);
  });

  it('the defending goalkeeper also appears in neither eligible list', () => {
    const awarded = triggerPenaltyKick(baseState, 'home');
    const takerResult = applyPenaltyKickTaker(awarded, homeTaker.id);
    expect(takerResult.ok).toBe(true);
    if (!takerResult.ok) return;
    expect(takerResult.state.penaltyKickEligibleIds?.attacking).not.toContain(awayGK.id);
    expect(takerResult.state.penaltyKickEligibleIds?.defending).not.toContain(awayGK.id);
  });
});

// ---------------------------------------------------------------------------
// Task 2 item 5: applyUndo's penalty-kick boundary terms remain correct under
// the 39-22 reordering — confirmed by test, not by assumption.
// ---------------------------------------------------------------------------

describe('applyUndo: penalty-kick boundary terms (39-22 reordering)', () => {
  it('cannot cross PENALTY_KICK_WINDOW_ADVANCE back into a completed reposition window during PENALTY_KICK_SETUP_DEFENDING', () => {
    const advanceEvent = {
      type: 'PENALTY_KICK_WINDOW_ADVANCE' as const,
      from: 'ATTACKING' as const,
      timestamp: Date.now(),
    };
    const state: GameState = {
      ...baseDefendingState,
      eventLog: [advanceEvent],
    };
    const result = applyUndo(state);
    // Slice after the boundary is empty -> nothing to undo within this window yet.
    expect(result).toEqual({ ok: false, reason: 'NOTHING_TO_UNDO' });
  });

  it('PENALTY_KICK_TAKER_PLACED still bounds PENALTY_KICK_TAKER_SELECT (the phase the placement event fires FROM)', () => {
    const placedEvent = {
      type: 'PENALTY_KICK_TAKER_PLACED' as const,
      pieceId: homeTaker.id,
      hex: PENALTY_SPOT.away,
      timestamp: Date.now(),
    };
    const state: GameState = {
      ...baseTakerSelectState,
      eventLog: [placedEvent],
    };
    const result = applyUndo(state);
    expect(result).toEqual({ ok: false, reason: 'NOTHING_TO_UNDO' });
  });

  it('a MOVE event AFTER the PENALTY_KICK_WINDOW_ADVANCE boundary IS undoable (positive control)', () => {
    const advanceEvent = {
      type: 'PENALTY_KICK_WINDOW_ADVANCE' as const,
      from: 'ATTACKING' as const,
      timestamp: Date.now(),
    };
    const moved = baseDefendingState.pieces.find((p) => p.id === awayDef.id)!;
    const to = hexNeighbors(moved.position).find((h) => isPitchHex(h))!;
    const moveEvent = {
      type: 'MOVE' as const,
      pieceId: awayDef.id,
      from: moved.position,
      to,
      slot: 'ATTACKER_2' as const,
      timestamp: Date.now(),
      ballAfter: { position: baseDefendingState.ball.position, carrierId: null },
    };
    const state: GameState = {
      ...baseDefendingState,
      pieces: baseDefendingState.pieces.map((p) =>
        p.id === awayDef.id ? { ...p, position: to } : p,
      ),
      eventLog: [advanceEvent, moveEvent],
    };
    const result = applyUndo(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reverted = result.state.pieces.find((p) => p.id === awayDef.id)!;
    expect(reverted.position).toEqual(moved.position);
  });

  it('PENALTY_KICK_WINDOW_ADVANCE is NOT a boundary outside the two setup phases (negative control — term is phase-specific)', () => {
    const advanceEvent = {
      type: 'PENALTY_KICK_WINDOW_ADVANCE' as const,
      from: 'ATTACKING' as const,
      timestamp: Date.now(),
    };
    const moveEvent = {
      type: 'MOVE' as const,
      pieceId: homeMid.id,
      from: { q: 17, r: 13 },
      to: PITCH_REGIONS.kickOffHex,
      slot: 'ATTACKER_4' as const,
      timestamp: Date.now(),
      ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
    };
    // Outside PENALTY_KICK_SETUP_ATTACKING/DEFENDING, the term does not fire — a MOVE
    // event before it in the log stays reachable via the generic MOVE-search path.
    const state: GameState = {
      ...baseState,
      phase: 'MOVE',
      movementSlot: 'ATTACKER_4',
      eventLog: [advanceEvent, moveEvent],
    };
    const result = applyUndo(state);
    expect(result.ok).toBe(true);
  });
});
