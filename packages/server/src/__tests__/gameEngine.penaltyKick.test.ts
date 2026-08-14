import { describe, it, expect } from 'vitest';
import {
  triggerPenaltyKick,
  computePenaltyKickEligibleIds,
  applyPenaltyKickReposition,
  applyPenaltyKickWindowEnd,
  applyPenaltyKickTaker,
  applyPenaltyKickDuel,
} from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';
import {
  PENALTY_SPOT,
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
  it('sets phase to PENALTY_KICK_SETUP_ATTACKING', () => {
    const result = triggerPenaltyKick(baseState, 'home');
    expect(result.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
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

  it('allows the defending goalkeeper to move inside the defending penalty area', () => {
    const to = hexNeighbors(awayGK.position).find(
      (h) => isPitchHex(h) && isInRegion(h, 'awayPenaltyArea'),
    );
    expect(to).toBeDefined();
    const result = applyPenaltyKickReposition(baseDefendingState, awayGK.id, to!);
    expect(result.ok).toBe(true);
  });

  it('allows the chosen penalty taker to move inside the defending penalty area (taker exemption)', () => {
    // homeTaker sits at {q:10,r:13}, far from awayPenaltyArea (q>=31) — construct a
    // taker adjacent to the box instead, mirroring the awayDef fixture's position.
    // Reposition windows precede taker selection in the real sequence; this state is
    // hand-crafted (penaltyKickTakerId pre-set) purely to exercise the taker-exemption
    // guard in applyPenaltyKickReposition in isolation, per the plan's explicit contract
    // ("neither the defending goalkeeper ... nor state.penaltyKickTakerId").
    const takerNearBox: PlayerPiece = {
      ...homeTaker,
      id: 'home-taker-nearbox',
      position: { q: 30, r: 15 }, // distinct from awayDef's {q:30,r:13}; adjacent to awayPenaltyArea
    };
    const nearBoxTo = hexNeighbors(takerNearBox.position).find(
      (h) => isPitchHex(h) && isInRegion(h, 'awayPenaltyArea'),
    )!;
    // Stays in the ATTACKING window (activeTeam already 'home' in baseAttackingState) so
    // the piece-team/window-team relationship remains realistic; only penaltyKickTakerId
    // is hand-set ahead of its normal assignment time to exercise the exemption branch.
    const state: GameState = {
      ...baseAttackingState,
      penaltyKickTakerId: takerNearBox.id,
      pieces: [...baseAttackingState.pieces, takerNearBox],
      penaltyKickEligibleIds: {
        attacking: [homeTaker.id, homeGK.id, homeMid.id, takerNearBox.id],
        defending: [awayGK.id, awayDef.id],
      },
    };
    const result = applyPenaltyKickReposition(state, takerNearBox.id, nearBoxTo);
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

  it('advances PENALTY_KICK_SETUP_DEFENDING to PENALTY_KICK_TAKER_SELECT, activeTeam back to penaltyKickTeam, appends PENALTY_KICK_WINDOW_ADVANCE(from: DEFENDING)', () => {
    const result = applyPenaltyKickWindowEnd(baseDefendingState, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PENALTY_KICK_TAKER_SELECT');
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

  it('on success moves the taker onto penaltyKickSpot, sets penaltyKickTakerId, sets ball.carrierId, appends PENALTY_KICK_TAKER_PLACED, transitions to PENALTY_KICK', () => {
    const result = applyPenaltyKickTaker(baseTakerSelectState, homeTaker.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = result.state.pieces.find((p) => p.id === homeTaker.id)!;
    expect(moved.position).toEqual(PENALTY_SPOT.away);
    expect(result.state.penaltyKickTakerId).toBe(homeTaker.id);
    expect(result.state.ball.carrierId).toBe(homeTaker.id);
    expect(result.state.ball.position).toEqual(PENALTY_SPOT.away);
    expect(result.state.phase).toBe('PENALTY_KICK');
    const placedEvent = result.state.eventLog.find((e) => e.type === 'PENALTY_KICK_TAKER_PLACED');
    expect(placedEvent).toBeDefined();
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
