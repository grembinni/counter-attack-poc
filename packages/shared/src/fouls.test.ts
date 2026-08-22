import { describe, it, expect } from 'vitest';
import {
  FOUL_TRIGGER_DIE,
  FOUL_TRIGGER_DIE_FROM_BEHIND,
  isInjured,
  applyInjuryDegradation,
  rollsInjury,
  rollsBooking,
  resolveBooking,
  isProfessionalFoul,
  GOAL_PATH_R_MIN,
  GOAL_PATH_R_MAX,
  clampGoalPathRow,
  attackerGoalPath,
  hexesBehindAttacker,
  isTackleFromBehind,
  foulTriggerThreshold,
} from './fouls.js';
import { hexDistance } from './hex.js';
import type { GameState, PlayerPiece } from './types.js';

/**
 * RESEARCH.md Pitfall 2: injury/booking rolls are an INVERTED convention versus every
 * other duel in this codebase — a bare `die >= attribute` comparison, never routed
 * through `computeCombinedScore`. Higher attribute is BETTER for its owner here (higher
 * resilience/leniency makes the roll LESS likely to trigger an injury/card), which is
 * the opposite relationship of a combined-score duel. Do NOT "correct" this inversion
 * in a future refactor — it is the documented, intentional rulebook behaviour.
 */

function makePiece(overrides: Partial<PlayerPiece> = {}): PlayerPiece {
  return {
    id: 'p1',
    teamId: 'home',
    position: { q: 10, r: 10 },
    pace: 5,
    shooting: 5,
    tackling: 5,
    dribbling: 5,
    saving: 5,
    handling: 5,
    resilience: 5,
    aerialAbility: 5,
    highPass: 5,
    firstName: 'Test',
    lastName: 'Player',
    number: 9,
    nationality: 'USA',
    role: 'MID',
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'TEST',
    phase: 'MOVE',
    activeTeam: 'home',
    pieces: [],
    ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 3 },
    attackingTeam: 'home',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: 'ATTACKER_4',
    ballZone: 'middle',
    addedTime: null,
    lastActionType: null,
    kickOffTeam: 'home',
    kickOffActive: false,
    selectedTeams: { home: 'city', away: 'crew' },
    selectedUniformStyles: { home: 'pinstripes-horizontal', away: 'pinstripes-horizontal' },
    gameSpeed: 'standard',
    ...overrides,
  };
}

describe('FOUL_TRIGGER_DIE', () => {
  it('is 1', () => {
    expect(FOUL_TRIGGER_DIE).toBe(1);
  });
});

describe('rollsInjury', () => {
  // Pitfall 2: bare `die >= resilience` — asserted directly, never via computeCombinedScore.
  it('die === resilience (6, 6) is true', () => {
    expect(rollsInjury(6, 6)).toBe(true);
  });

  it('die > resilience is true (5 vs resilience 4)', () => {
    expect(rollsInjury(5, 4)).toBe(true);
  });

  it('die < resilience (5, 6) is false', () => {
    expect(rollsInjury(5, 6)).toBe(false);
  });

  it('die === resilience (1, 1) is true', () => {
    expect(rollsInjury(1, 1)).toBe(true);
  });

  it('die < resilience (3, 5) is false', () => {
    expect(rollsInjury(3, 5)).toBe(false);
  });
});

describe('rollsBooking', () => {
  // Pitfall 2: identical bare `die >= leniency` shape as rollsInjury — asserted directly.
  it('die === leniency (4, 4) is true', () => {
    expect(rollsBooking(4, 4)).toBe(true);
  });

  it('die < leniency (3, 4) is false', () => {
    expect(rollsBooking(3, 4)).toBe(false);
  });

  it('die > leniency (6, 1) is true', () => {
    expect(rollsBooking(6, 1)).toBe(true);
  });
});

describe('isInjured', () => {
  it('is false when injuryCount is undefined', () => {
    const piece = makePiece();
    expect(isInjured(piece)).toBe(false);
  });

  it('is false when injuryCount is 0', () => {
    const piece = makePiece({ injuryCount: 0 });
    expect(isInjured(piece)).toBe(false);
  });

  it('is true when injuryCount is greater than 0', () => {
    const piece = makePiece({ injuryCount: 1 });
    expect(isInjured(piece)).toBe(true);
  });
});

describe('applyInjuryDegradation', () => {
  it('returns a NEW piece object (immutable — does not mutate the input)', () => {
    const piece = makePiece();
    const result = applyInjuryDegradation(piece);
    expect(result).not.toBe(piece);
    expect(piece.pace).toBe(5); // input untouched
  });

  it('decrements an attribute at 5 to 4', () => {
    const piece = makePiece({ pace: 5 });
    const result = applyInjuryDegradation(piece);
    expect(result.pace).toBe(4);
  });

  it('floors an attribute already at 1 to stay at 1 (never below 1)', () => {
    const piece = makePiece({ shooting: 1 });
    const result = applyInjuryDegradation(piece);
    expect(result.shooting).toBe(1);
  });

  it('leaves highPass at 0 unchanged (GK legitimately carries 0 — not raised to 1)', () => {
    const piece = makePiece({ highPass: 0, role: 'GK' });
    const result = applyInjuryDegradation(piece);
    expect(result.highPass).toBe(0);
  });

  it('decrements every one of the nine numeric attributes by 1', () => {
    const piece = makePiece({
      pace: 5,
      shooting: 5,
      tackling: 5,
      dribbling: 5,
      saving: 5,
      handling: 5,
      resilience: 5,
      aerialAbility: 5,
      highPass: 5,
    });
    const result = applyInjuryDegradation(piece);
    expect(result.pace).toBe(4);
    expect(result.shooting).toBe(4);
    expect(result.tackling).toBe(4);
    expect(result.dribbling).toBe(4);
    expect(result.saving).toBe(4);
    expect(result.handling).toBe(4);
    expect(result.resilience).toBe(4);
    expect(result.aerialAbility).toBe(4);
    expect(result.highPass).toBe(4);
  });

  it('increments injuryCount from undefined to 1', () => {
    const piece = makePiece();
    const result = applyInjuryDegradation(piece);
    expect(result.injuryCount).toBe(1);
  });

  it('leaves identity fields (id/teamId/position/name/number/nationality/role) untouched', () => {
    const piece = makePiece({
      id: 'p42',
      teamId: 'away',
      position: { q: 3, r: 4 },
      firstName: 'Alex',
      lastName: 'Morgan',
      number: 13,
      nationality: 'ENG',
      role: 'FWD',
    });
    const result = applyInjuryDegradation(piece);
    expect(result.id).toBe('p42');
    expect(result.teamId).toBe('away');
    expect(result.position).toEqual({ q: 3, r: 4 });
    expect(result.firstName).toBe('Alex');
    expect(result.lastName).toBe('Morgan');
    expect(result.number).toBe(13);
    expect(result.nationality).toBe('ENG');
    expect(result.role).toBe('FWD');
  });

  it('applied twice yields injuryCount 2 and a second -1 on every attribute (INJURY-03, D-06)', () => {
    const piece = makePiece({ pace: 5 });
    const once = applyInjuryDegradation(piece);
    const twice = applyInjuryDegradation(once);
    expect(twice.injuryCount).toBe(2);
    expect(twice.pace).toBe(3);
  });

  it('applied twice still floors an attribute that reaches 1 after the first application', () => {
    const piece = makePiece({ shooting: 2 });
    const once = applyInjuryDegradation(piece);
    expect(once.shooting).toBe(1);
    const twice = applyInjuryDegradation(once);
    expect(twice.shooting).toBe(1);
  });
});

describe('resolveBooking', () => {
  it('normal foul, die < leniency, 0 priors -> none, not second yellow', () => {
    const result = resolveBooking({ die: 3, leniency: 4, priorYellows: 0, professional: false });
    expect(result).toEqual({ card: 'none', secondYellow: false });
  });

  it('normal foul, die >= leniency, 0 priors -> yellow, not second yellow (CARD-01)', () => {
    const result = resolveBooking({ die: 4, leniency: 4, priorYellows: 0, professional: false });
    expect(result).toEqual({ card: 'yellow', secondYellow: false });
  });

  it('normal foul, die >= leniency, 1 prior yellow -> red, second yellow (CARD-02)', () => {
    const result = resolveBooking({ die: 5, leniency: 4, priorYellows: 1, professional: false });
    expect(result).toEqual({ card: 'red', secondYellow: true });
  });

  it('professional foul, die >= leniency -> straight red, not second yellow (CARD-03)', () => {
    const result = resolveBooking({ die: 5, leniency: 4, priorYellows: 0, professional: true });
    expect(result).toEqual({ card: 'red', secondYellow: false });
  });

  it('professional foul, die < leniency -> yellow, not second yellow (CARD-03 otherwise-yellow)', () => {
    const result = resolveBooking({ die: 2, leniency: 4, priorYellows: 0, professional: true });
    expect(result).toEqual({ card: 'yellow', secondYellow: false });
  });

  it('professional foul, die < leniency, 1 prior yellow -> red, second yellow (upgrade still applies)', () => {
    const result = resolveBooking({ die: 2, leniency: 4, priorYellows: 1, professional: true });
    expect(result).toEqual({ card: 'red', secondYellow: true });
  });
});

describe('isProfessionalFoul', () => {
  // Plan 39-19 (closes 39-UAT gap 8): goal-side + goal-path reachability replaces the
  // old omnidirectional "could any teammate anywhere reach the foul hex" test.
  // RESEARCH.md Pitfall 5 still applies: straight-line ("as the crow flies")
  // reachability — no path-walk, no occupancy simulation.

  it(
    '39-UAT test 8 worked example (verbatim, NOT DOGSO): home attacker fouled on ' +
      '{q:21,r:15}, away defender on {q:29,r:12} with pace 4 reaches the goal path at ' +
      '{q:29,r:15}',
    () => {
      // The user's worked example reads "Defender at (29,12) with move 4 is within range
      // of (29,25)". (29,25) is a transcription slip for (29,15): hexDistance(29,12 ->
      // 29,25) is 13 (unreachable with pace 4), whereas hexDistance(29,12 -> 29,15) is 3
      // (reachable with pace 4), and hexLine(21,15 -> 36,15) provably contains
      // {q:29,r:15}. Do NOT "fix" these coordinates back to (29,25) — see PLAN.md.
      const attackerHex = { q: 21, r: 15 };
      const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 5 } });
      const coveringDefender = makePiece({
        id: 'defender',
        teamId: 'away',
        role: 'DEF',
        position: { q: 29, r: 12 },
        pace: 4,
      });
      const state = makeState({
        pieces: [fouler, coveringDefender],
        paceUsedByPieceId: {},
      });
      expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(false);
    },
  );

  it('same worked example, covering defender one hex further away (pace 2, DOGSO)', () => {
    const attackerHex = { q: 21, r: 15 };
    const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 5 } });
    const farDefender = makePiece({
      id: 'defender',
      teamId: 'away',
      role: 'DEF',
      position: { q: 29, r: 12 },
      pace: 2, // hexDistance({q:29,r:12},{q:29,r:15}) === 3 exceeds a pace-2 budget
    });
    const state = makeState({ pieces: [fouler, farDefender], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(true);
  });

  it('same worked example, covering defender has already used pace this Movement Phase (DOGSO)', () => {
    const attackerHex = { q: 21, r: 15 };
    const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 5 } });
    const defender = makePiece({
      id: 'defender',
      teamId: 'away',
      role: 'DEF',
      position: { q: 29, r: 12 },
      pace: 4,
    });
    const state = makeState({
      pieces: [fouler, defender],
      paceUsedByPieceId: { defender: 2 }, // budget 2 is short of the required 3
    });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(true);
  });

  it('a defender BEHIND the attacker never suppresses DOGSO, even with huge pace', () => {
    // Home attacker at q=21 attacking q=36 — q=10 is further from goal than the attacker.
    const attackerHex = { q: 21, r: 15 };
    const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 5 } });
    const behindDefender = makePiece({
      id: 'defender',
      teamId: 'away',
      role: 'DEF',
      position: { q: 10, r: 15 },
      pace: 20,
    });
    const state = makeState({ pieces: [fouler, behindDefender], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(true);
  });

  it('a defender LEVEL with the attacker (same q, not strictly closer to goal) is not goal-side (DOGSO)', () => {
    const attackerHex = { q: 21, r: 15 };
    const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 5 } });
    const levelDefender = makePiece({
      id: 'defender',
      teamId: 'away',
      role: 'DEF',
      position: { q: 21, r: 18 },
      pace: 20,
    });
    const state = makeState({ pieces: [fouler, levelDefender], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(true);
  });

  it('a goalkeeper is excluded from the covering-defender set (DOGSO)', () => {
    const attackerHex = { q: 21, r: 15 };
    const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 5 } });
    const gk = makePiece({
      id: 'gk',
      teamId: 'away',
      role: 'GK',
      position: { q: 29, r: 12 },
      pace: 4,
    });
    const state = makeState({ pieces: [fouler, gk], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(true);
  });

  it('a red-carded piece is excluded from the covering-defender set (DOGSO)', () => {
    const attackerHex = { q: 21, r: 15 };
    const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 5 } });
    const dismissed = makePiece({
      id: 'dismissed',
      teamId: 'away',
      role: 'DEF',
      position: { q: 29, r: 12 },
      pace: 4,
      redCarded: true,
    });
    const state = makeState({ pieces: [fouler, dismissed], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(true);
  });

  // BUG-38 (Phase 42): isProfessionalFoul now uses isActivePiece (was a hand-written
  // `redCarded !== true` clause that did not check onPitch).
  it('an onPitch: false piece (without redCarded) is also excluded from the covering-defender set, proving the two-clause predicate (DOGSO)', () => {
    const attackerHex = { q: 21, r: 15 };
    const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 5 } });
    const benched = makePiece({
      id: 'benched',
      teamId: 'away',
      role: 'DEF',
      position: { q: 29, r: 12 },
      pace: 4,
      onPitch: false,
    });
    const state = makeState({ pieces: [fouler, benched], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(true);
  });

  it('away-attacking mirror: a home defender goal-side (lower q) and in range is NOT DOGSO', () => {
    // Away attacker at {q:15,r:15} attacks q=0 — proves the direction term is not
    // hardcoded to home.
    const attackerHex = { q: 15, r: 15 };
    const fouler = makePiece({ id: 'fouler', teamId: 'home', position: { q: 30, r: 5 } });
    const coveringDefender = makePiece({
      id: 'defender',
      teamId: 'home',
      role: 'DEF',
      position: { q: 10, r: 15 }, // on the away attacker's clamped goal path
      pace: 1,
    });
    const state = makeState({ pieces: [fouler, coveringDefender], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(false);
  });

  it('away-attacking mirror: the same defender at HIGHER q (not goal-side) IS DOGSO', () => {
    const attackerHex = { q: 15, r: 15 };
    const fouler = makePiece({ id: 'fouler', teamId: 'home', position: { q: 30, r: 5 } });
    const behindDefender = makePiece({
      id: 'defender',
      teamId: 'home',
      role: 'DEF',
      position: { q: 20, r: 15 },
      pace: 20,
    });
    const state = makeState({ pieces: [fouler, behindDefender], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(true);
  });

  it('row clamping (r > 20): a defender intercepting the r=20 clamped path (not the raw r=24 line) proves the clamp is applied (NOT DOGSO)', () => {
    const attackerHex = { q: 21, r: 24 };
    const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 5 } });
    const defender = makePiece({
      id: 'defender',
      teamId: 'away',
      role: 'DEF',
      position: { q: 29, r: 20 }, // on the CLAMPED path; hexDistance to {q:29,r:24} is 4
      pace: 1,
    });
    const state = makeState({ pieces: [fouler, defender], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(false);
  });

  it('row clamping (r < 5): a defender intercepting the r=5 clamped path (not the raw r=1 line) proves the clamp is applied (NOT DOGSO)', () => {
    const attackerHex = { q: 21, r: 1 };
    const fouler = makePiece({ id: 'fouler', teamId: 'away', position: { q: 5, r: 20 } });
    const defender = makePiece({
      id: 'defender',
      teamId: 'away',
      role: 'DEF',
      position: { q: 29, r: 5 }, // on the CLAMPED path; hexDistance to {q:29,r:1} is 4
      pace: 1,
    });
    const state = makeState({ pieces: [fouler, defender], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(false);
  });

  it('the fouler itself is excluded from the covering-defender set, even if goal-side and in range (DOGSO)', () => {
    const attackerHex = { q: 21, r: 15 };
    const fouler = makePiece({
      id: 'fouler',
      teamId: 'away',
      role: 'DEF',
      position: { q: 29, r: 15 }, // on the attacker's own goal path
      pace: 10,
    });
    const state = makeState({ pieces: [fouler], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'fouler', attackerHex)).toBe(true);
  });

  it('returns true (DOGSO) when the fouler cannot be found on state.pieces', () => {
    const attackerHex = { q: 21, r: 15 };
    const state = makeState({ pieces: [], paceUsedByPieceId: {} });
    expect(isProfessionalFoul(state, 'missing-fouler', attackerHex)).toBe(true);
  });
});

describe('clampGoalPathRow / attackerGoalPath', () => {
  it('GOAL_PATH_R_MIN is 5 and GOAL_PATH_R_MAX is 20', () => {
    expect(GOAL_PATH_R_MIN).toBe(5);
    expect(GOAL_PATH_R_MAX).toBe(20);
  });

  it('clamps a row below the band up to GOAL_PATH_R_MIN', () => {
    expect(clampGoalPathRow(4)).toBe(5);
    expect(clampGoalPathRow(0)).toBe(5);
  });

  it('leaves GOAL_PATH_R_MIN unchanged', () => {
    expect(clampGoalPathRow(5)).toBe(5);
  });

  it('leaves a row inside the band unchanged', () => {
    expect(clampGoalPathRow(15)).toBe(15);
  });

  it('leaves GOAL_PATH_R_MAX unchanged', () => {
    expect(clampGoalPathRow(20)).toBe(20);
  });

  it('clamps a row above the band down to GOAL_PATH_R_MAX', () => {
    expect(clampGoalPathRow(21)).toBe(20);
    expect(clampGoalPathRow(25)).toBe(20);
  });

  it('home attackerGoalPath runs from the attacker hex to q=36 at the clamped row and contains {q:29,r:15}', () => {
    const path = attackerGoalPath({ q: 21, r: 15 }, 'home');
    expect(path[0]).toEqual({ q: 21, r: 15 });
    expect(path[path.length - 1]).toEqual({ q: 36, r: 15 });
    expect(path).toContainEqual({ q: 29, r: 15 });
  });

  it('away attackerGoalPath runs from the attacker hex to q=0 at the clamped row', () => {
    const path = attackerGoalPath({ q: 15, r: 15 }, 'away');
    expect(path[0]).toEqual({ q: 15, r: 15 });
    expect(path[path.length - 1]).toEqual({ q: 0, r: 15 });
  });

  it('draws the path at the clamped row (20), not the raw row (24), for an out-of-band attacker', () => {
    const path = attackerGoalPath({ q: 21, r: 24 }, 'home');
    expect(path.every((h) => h.r === 20)).toBe(true);
  });

  it('draws the path at the clamped row (5), not the raw row (1), for an out-of-band attacker', () => {
    const path = attackerGoalPath({ q: 21, r: 1 }, 'home');
    expect(path.every((h) => h.r === 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FOUL-01 (Plan 39-24, closes 39-UAT gap 7): tackle-from-behind geometry and
// the widened trigger threshold.
// ---------------------------------------------------------------------------

describe('hexesBehindAttacker', () => {
  it('EVEN q (20): home carrier -> exactly 2 hexes, both q===19', () => {
    const result = hexesBehindAttacker({ q: 20, r: 13 }, 'home');
    expect(result).toHaveLength(2);
    expect(result.every((h) => h.q === 19)).toBe(true);
  });

  it('EVEN q (20): away carrier -> exactly 2 hexes, both q===21', () => {
    const result = hexesBehindAttacker({ q: 20, r: 13 }, 'away');
    expect(result).toHaveLength(2);
    expect(result.every((h) => h.q === 21)).toBe(true);
  });

  it('ODD q (21): home carrier -> exactly 2 hexes, both q===20, r values differ from the even-q case (parity-correct)', () => {
    const result = hexesBehindAttacker({ q: 21, r: 13 }, 'home');
    expect(result).toHaveLength(2);
    expect(result.every((h) => h.q === 20)).toBe(true);
    const evenCaseRs = hexesBehindAttacker({ q: 20, r: 13 }, 'home')
      .map((h) => h.r)
      .sort();
    const oddCaseRs = result.map((h) => h.r).sort();
    expect(oddCaseRs).not.toEqual(evenCaseRs);
  });

  it('ODD q (21): away carrier -> exactly 2 hexes, both q===22', () => {
    const result = hexesBehindAttacker({ q: 21, r: 13 }, 'away');
    expect(result).toHaveLength(2);
    expect(result.every((h) => h.q === 22)).toBe(true);
  });

  it('every returned hex is at hexDistance 1 from the attacker (even and odd q)', () => {
    for (const attackerHex of [
      { q: 20, r: 13 },
      { q: 21, r: 13 },
    ]) {
      for (const team of ['home', 'away'] as const) {
        for (const h of hexesBehindAttacker(attackerHex, team)) {
          expect(hexDistance(attackerHex, h)).toBe(1);
        }
      }
    }
  });
});

describe('isTackleFromBehind', () => {
  const attackerHex = { q: 20, r: 13 };

  it('true for both behind hexes (home)', () => {
    for (const behindHex of hexesBehindAttacker(attackerHex, 'home')) {
      expect(isTackleFromBehind(attackerHex, behindHex, 'home')).toBe(true);
    }
  });

  it('false for both lateral (Δq===0) neighbours', () => {
    // Even q=20 neighbours: {21,12} front, {21,13} front, {20,12} lateral, {20,14}
    // lateral, {19,12} behind, {19,13} behind (ODD_Q_NEIGHBORS[0] applied to {20,13}).
    expect(isTackleFromBehind(attackerHex, { q: 20, r: 12 }, 'home')).toBe(false);
    expect(isTackleFromBehind(attackerHex, { q: 20, r: 14 }, 'home')).toBe(false);
  });

  it('false for both in-front (Δq===+1 for home) neighbours', () => {
    expect(isTackleFromBehind(attackerHex, { q: 21, r: 12 }, 'home')).toBe(false);
    expect(isTackleFromBehind(attackerHex, { q: 21, r: 13 }, 'home')).toBe(false);
  });

  it('false for a non-adjacent hex', () => {
    expect(isTackleFromBehind(attackerHex, { q: 0, r: 0 }, 'home')).toBe(false);
  });

  it('mirrors correctly for away: front neighbours (Δq===-1) are false, behind (Δq===+1) are true', () => {
    for (const behindHex of hexesBehindAttacker(attackerHex, 'away')) {
      expect(isTackleFromBehind(attackerHex, behindHex, 'away')).toBe(true);
    }
    expect(isTackleFromBehind(attackerHex, { q: 19, r: 12 }, 'away')).toBe(false);
  });
});

describe('foulTriggerThreshold', () => {
  it('foulTriggerThreshold(true) === FOUL_TRIGGER_DIE_FROM_BEHIND (2)', () => {
    expect(foulTriggerThreshold(true)).toBe(2);
    expect(foulTriggerThreshold(true)).toBe(FOUL_TRIGGER_DIE_FROM_BEHIND);
  });

  it('foulTriggerThreshold(false) === FOUL_TRIGGER_DIE (1)', () => {
    expect(foulTriggerThreshold(false)).toBe(1);
    expect(foulTriggerThreshold(false)).toBe(FOUL_TRIGGER_DIE);
  });
});
