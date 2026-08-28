import { describe, it, expect } from 'vitest';
import { foldMatchStats, COUNTED_ACCURATE_PASS_TYPES } from '../matchStatsReducer.js';
import type { ActionEvent, MatchStats, PlayerPiece } from '@counter-attack/shared';
import { EMPTY_MATCH_STATS } from '@counter-attack/shared';

/**
 * Phase 45 Plan 03 (STATS-04/05/06/09): unit coverage for the pure `foldMatchStats`
 * reducer. One named test per `<behavior>` bullet in 45-03-PLAN.md, plus the two
 * mandatory named tests called out in the plan's acceptance criteria (D-07 decline
 * exclusion, Pitfall 5 pre-action possession attribution).
 *
 * Fixtures are minimal local literals, not imported squad data (plan instruction) —
 * mirrors the `makePiece` pattern in roomStore.test.ts.
 */

function makePiece(overrides: Partial<PlayerPiece>): PlayerPiece {
  return {
    id: 'home-1',
    teamId: 'home',
    firstName: 'Test',
    lastName: 'Player',
    number: 2,
    nationality: 'Test',
    role: 'DEF',
    position: { q: 0, r: 0 },
    pace: 5,
    shooting: 3,
    tackling: 5,
    dribbling: 3,
    saving: 1,
    handling: 1,
    resilience: 5,
    aerialAbility: 4,
    highPass: 4,
    ...overrides,
  };
}

const HOME = makePiece({ id: 'home-1', teamId: 'home' });
const AWAY = makePiece({ id: 'away-1', teamId: 'away' });
const PIECES: readonly PlayerPiece[] = [HOME, AWAY];

const BALL_AFTER = { position: { q: 18, r: 13 }, carrierId: null };

describe('COUNTED_ACCURATE_PASS_TYPES', () => {
  it('PD-08: lists exactly the accurate-flag pass types the reducer treats as completed-pass candidates', () => {
    expect(COUNTED_ACCURATE_PASS_TYPES).toEqual(['STANDARD_PASS', 'FIRST_TIME_PASS', 'LONG_BALL']);
  });
});

describe('foldMatchStats', () => {
  it('returns a new MatchStats and never mutates its input; undefined current seeds from EMPTY_MATCH_STATS', () => {
    const result = foldMatchStats(undefined, [], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result).toEqual(EMPTY_MATCH_STATS);
    expect(result).not.toBe(EMPTY_MATCH_STATS);
  });

  it('does not mutate the current MatchStats object passed in', () => {
    const current: MatchStats = {
      ...EMPTY_MATCH_STATS,
      passesCompleted: { home: 2, away: 1 },
    };
    const frozenCopy = JSON.parse(JSON.stringify(current));
    foldMatchStats(
      current,
      [
        {
          type: 'STANDARD_PASS',
          passerId: 'home-1',
          from: { q: 0, r: 0 },
          to: { q: 1, r: 0 },
          accurate: true,
          timestamp: 1,
          ballAfter: BALL_AFTER,
        },
      ],
      PIECES,
      { team: 'home', actionCountDelta: 0 },
    );
    expect(current).toEqual(frozenCopy);
  });

  it('passes shots and xg through byte-identically — the reducer never reads or writes either', () => {
    const current: MatchStats = {
      ...EMPTY_MATCH_STATS,
      shots: { home: 3, away: 5 },
      xg: { home: 1.23, away: 0.87 },
    };
    const result = foldMatchStats(current, [], PIECES, { team: 'home', actionCountDelta: 0 });
    expect(result.shots).toEqual({ home: 3, away: 5 });
    expect(result.xg).toEqual({ home: 1.23, away: 0.87 });
  });

  it('possession: an actionCountDelta of 5 with pre-action attacking team home adds exactly 5 to home and 0 to away', () => {
    const result = foldMatchStats(undefined, [], PIECES, {
      team: 'home',
      actionCountDelta: 5,
    });
    expect(result.possessionActionCount).toEqual({ home: 5, away: 0 });
  });

  it('possession: a delta of 0 changes nothing', () => {
    const current: MatchStats = {
      ...EMPTY_MATCH_STATS,
      possessionActionCount: { home: 10, away: 20 },
    };
    const result = foldMatchStats(current, [], PIECES, { team: 'home', actionCountDelta: 0 });
    expect(result.possessionActionCount).toEqual({ home: 10, away: 20 });
  });

  it('possession: a negative delta is treated as 0', () => {
    const current: MatchStats = {
      ...EMPTY_MATCH_STATS,
      possessionActionCount: { home: 10, away: 20 },
    };
    const result = foldMatchStats(current, [], PIECES, { team: 'away', actionCountDelta: -3 });
    expect(result.possessionActionCount).toEqual({ home: 10, away: 20 });
  });

  it('Pitfall 5 / STATS-04: possession is credited to the PRE-action attacking team, not the post-action winner, when a successful steal flips attackingTeam', () => {
    // Reproduces the exact combination the plan calls out: a successful steal both
    // advances the clock (actionCountDelta > 0) AND flips attackingTeam. The caller is
    // contractually responsible for passing the PRE-action team — this test proves the
    // reducer credits whatever it is given and never re-derives it from an event.
    const stealEvent: ActionEvent = {
      type: 'STEAL_ATTEMPT',
      defenderId: 'away-1',
      result: 'SUCCESS',
      defenderDie: 6,
      defenderCombined: 11,
      timestamp: 1,
      ballAfter: { position: { q: 10, r: 10 }, carrierId: 'away-1' },
    };
    // Pre-action attacking team was 'home' (about to lose the ball); caller passes 'home'.
    const result = foldMatchStats(undefined, [stealEvent], PIECES, {
      team: 'home',
      actionCountDelta: 3,
    });
    expect(result.possessionActionCount).toEqual({ home: 3, away: 0 });
    // Would fail under post-action attribution: home would get 0, away would get 3.
  });

  it('STANDARD_PASS/FIRST_TIME_PASS/LONG_BALL each add 1 to the passer team only when accurate === true', () => {
    const events: ActionEvent[] = [
      {
        type: 'STANDARD_PASS',
        passerId: 'home-1',
        from: { q: 0, r: 0 },
        to: { q: 1, r: 0 },
        accurate: true,
        timestamp: 1,
        ballAfter: BALL_AFTER,
      },
      {
        type: 'FIRST_TIME_PASS',
        passerId: 'home-1',
        from: { q: 0, r: 0 },
        to: { q: 1, r: 0 },
        accurate: true,
        timestamp: 2,
        ballAfter: BALL_AFTER,
      },
      {
        type: 'LONG_BALL',
        from: { q: 0, r: 0 },
        to: { q: 5, r: 0 },
        accurate: true,
        timestamp: 3,
        ballAfter: { position: { q: 5, r: 0 }, carrierId: 'home-1' },
      },
    ];
    const result = foldMatchStats(undefined, events, PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.passesCompleted).toEqual({ home: 3, away: 0 });
  });

  it('STANDARD_PASS/FIRST_TIME_PASS/LONG_BALL add nothing when accurate === false', () => {
    const events: ActionEvent[] = [
      {
        type: 'STANDARD_PASS',
        passerId: 'home-1',
        from: { q: 0, r: 0 },
        to: { q: 1, r: 0 },
        accurate: false,
        timestamp: 1,
        ballAfter: BALL_AFTER,
      },
      {
        type: 'FIRST_TIME_PASS',
        passerId: 'home-1',
        from: { q: 0, r: 0 },
        to: { q: 1, r: 0 },
        accurate: false,
        timestamp: 2,
        ballAfter: BALL_AFTER,
      },
      {
        type: 'LONG_BALL',
        from: { q: 0, r: 0 },
        to: { q: 5, r: 0 },
        accurate: false,
        timestamp: 3,
        ballAfter: { position: { q: 5, r: 0 }, carrierId: 'home-1' },
      },
    ];
    const result = foldMatchStats(undefined, events, PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.passesCompleted).toEqual({ home: 0, away: 0 });
  });

  it('HP_ACCURACY with accurate === true adds 1; with accurate === false adds nothing', () => {
    const accurate: ActionEvent = {
      type: 'HP_ACCURACY',
      passerId: 'away-1',
      accurate: true,
      timestamp: 1,
    };
    const inaccurate: ActionEvent = {
      type: 'HP_ACCURACY',
      passerId: 'away-1',
      accurate: false,
      timestamp: 2,
    };
    const resultAccurate = foldMatchStats(undefined, [accurate], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(resultAccurate.passesCompleted).toEqual({ home: 0, away: 1 });

    const resultInaccurate = foldMatchStats(undefined, [inaccurate], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(resultInaccurate.passesCompleted).toEqual({ home: 0, away: 0 });
  });

  it('a HIGH_PASS declare event followed by its HP_ACCURACY completion counts exactly 1 completed pass, not 2', () => {
    const events: ActionEvent[] = [
      {
        type: 'HIGH_PASS',
        passerId: 'home-1',
        from: { q: 0, r: 0 },
        to: { q: 10, r: 10 },
        accurate: null,
        timestamp: 1,
        ballAfter: BALL_AFTER,
      },
      { type: 'HP_ACCURACY', passerId: 'home-1', accurate: true, timestamp: 2 },
    ];
    const result = foldMatchStats(undefined, events, PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.passesCompleted).toEqual({ home: 1, away: 0 });
  });

  it('HEADED_PASS adds 1 when ballAfter.carrierId resolves to a piece on the passer team', () => {
    const event: ActionEvent = {
      type: 'HEADED_PASS',
      passerId: 'home-1',
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 },
      timestamp: 1,
      ballAfter: { position: { q: 1, r: 0 }, carrierId: 'home-1' },
    };
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.passesCompleted).toEqual({ home: 1, away: 0 });
  });

  it('HEADED_PASS adds nothing when ballAfter.carrierId is null', () => {
    const event: ActionEvent = {
      type: 'HEADED_PASS',
      passerId: 'home-1',
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 },
      timestamp: 1,
      ballAfter: { position: { q: 1, r: 0 }, carrierId: null },
    };
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.passesCompleted).toEqual({ home: 0, away: 0 });
  });

  it('HEADED_PASS adds nothing when ballAfter.carrierId resolves to an opponent', () => {
    const event: ActionEvent = {
      type: 'HEADED_PASS',
      passerId: 'home-1',
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 },
      timestamp: 1,
      ballAfter: { position: { q: 1, r: 0 }, carrierId: 'away-1' },
    };
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.passesCompleted).toEqual({ home: 0, away: 0 });
  });

  it('a pass event whose passer cannot be resolved in pieces is skipped without throwing and without crediting either team', () => {
    const event: ActionEvent = {
      type: 'STANDARD_PASS',
      passerId: 'ghost-99',
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 },
      accurate: true,
      timestamp: 1,
      ballAfter: BALL_AFTER,
    };
    expect(() =>
      foldMatchStats(undefined, [event], PIECES, { team: 'home', actionCountDelta: 0 }),
    ).not.toThrow();
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.passesCompleted).toEqual({ home: 0, away: 0 });
  });

  it('TACKLE_ATTEMPT and STEAL_ATTEMPT each add 1 to tackleStealAttempts for the defender team, plus 1 to tackleStealSuccesses on SUCCESS', () => {
    const events: ActionEvent[] = [
      {
        type: 'TACKLE_ATTEMPT',
        defenderId: 'away-1',
        carrierId: 'home-1',
        defenderDie: 6,
        carrierDie: 1,
        defenderCombined: 11,
        carrierCombined: 6,
        result: 'SUCCESS',
        timestamp: 1,
        ballAfter: { position: { q: 5, r: 5 }, carrierId: 'away-1' },
      },
      {
        type: 'STEAL_ATTEMPT',
        defenderId: 'away-1',
        result: 'FAIL',
        defenderDie: 1,
        defenderCombined: 6,
        timestamp: 2,
        ballAfter: { position: { q: 5, r: 5 }, carrierId: 'home-1' },
      },
    ];
    const result = foldMatchStats(undefined, events, PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.tackleStealAttempts).toEqual({ home: 0, away: 2 });
    expect(result.tackleStealSuccesses).toEqual({ home: 0, away: 1 });
  });

  it('D-07: TACKLE_STEAL_DECLINED adds nothing to attempts, successes, or any other counter', () => {
    const event: ActionEvent = {
      type: 'TACKLE_STEAL_DECLINED',
      defenderId: 'away-1',
      carrierId: 'home-1',
      timestamp: 1,
      kind: 'TACKLE',
    };
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result).toEqual(EMPTY_MATCH_STATS);
  });

  it('FOUL_CALLED adds 1 to fouls for the offending defender team', () => {
    const event: ActionEvent = {
      type: 'FOUL_CALLED',
      defenderId: 'away-1',
      victimId: 'home-1',
      hex: { q: 5, r: 5 },
      source: 'TACKLE',
      defenderDie: 1,
      professional: false,
      fromBehind: false,
      timestamp: 1,
    };
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.fouls).toEqual({ home: 0, away: 1 });
  });

  it("cards: BOOKING_CHECK with card: 'yellow' adds 1 yellow", () => {
    const event: ActionEvent = {
      type: 'BOOKING_CHECK',
      defenderId: 'away-1',
      die: 5,
      leniency: 3,
      card: 'yellow',
      secondYellow: false,
      professional: false,
      timestamp: 1,
    };
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.yellowCards).toEqual({ home: 0, away: 1 });
    expect(result.redCards).toEqual({ home: 0, away: 0 });
  });

  it("cards: BOOKING_CHECK with card: 'red', secondYellow: false adds 1 red and 0 yellows", () => {
    const event: ActionEvent = {
      type: 'BOOKING_CHECK',
      defenderId: 'away-1',
      die: 6,
      leniency: 3,
      card: 'red',
      secondYellow: false,
      professional: true,
      timestamp: 1,
    };
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.yellowCards).toEqual({ home: 0, away: 0 });
    expect(result.redCards).toEqual({ home: 0, away: 1 });
  });

  it("PD-10: cards: BOOKING_CHECK with card: 'red', secondYellow: true adds 1 red AND 1 yellow", () => {
    const event: ActionEvent = {
      type: 'BOOKING_CHECK',
      defenderId: 'away-1',
      die: 5,
      leniency: 3,
      card: 'red',
      secondYellow: true,
      professional: false,
      timestamp: 1,
    };
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result.yellowCards).toEqual({ home: 0, away: 1 });
    expect(result.redCards).toEqual({ home: 0, away: 1 });
  });

  it("cards: BOOKING_CHECK with card: 'none' adds nothing", () => {
    const event: ActionEvent = {
      type: 'BOOKING_CHECK',
      defenderId: 'away-1',
      die: 1,
      leniency: 3,
      card: 'none',
      secondYellow: false,
      professional: false,
      timestamp: 1,
    };
    const result = foldMatchStats(undefined, [event], PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result).toEqual(EMPTY_MATCH_STATS);
  });

  it('event types outside the handled set change nothing', () => {
    const events: ActionEvent[] = [
      {
        type: 'MOVE',
        pieceId: 'home-1',
        from: { q: 0, r: 0 },
        to: { q: 1, r: 0 },
        slot: 'ATTACKER_4',
        timestamp: 1,
        ballAfter: BALL_AFTER,
      },
      { type: 'SLOT_ADVANCE', from: 'ATTACKER_4', to: 'ATTACKER_2', timestamp: 2 },
      { type: 'DICE_ROLL', result: 4, timestamp: 3, ballAfter: BALL_AFTER },
      {
        type: 'GOAL',
        scoringTeam: 'home',
        scorerId: 'home-1',
        timestamp: 4,
        ballAfter: BALL_AFTER,
      },
    ];
    const result = foldMatchStats(undefined, events, PIECES, {
      team: 'home',
      actionCountDelta: 0,
    });
    expect(result).toEqual(EMPTY_MATCH_STATS);
  });

  it('an empty event slice with a zero possession delta returns a value deep-equal to the input', () => {
    const current: MatchStats = {
      possessionActionCount: { home: 7, away: 3 },
      passesCompleted: { home: 4, away: 2 },
      tackleStealAttempts: { home: 1, away: 1 },
      tackleStealSuccesses: { home: 0, away: 1 },
      shots: { home: 2, away: 1 },
      xg: { home: 0.5, away: 0.2 },
      fouls: { home: 1, away: 0 },
      yellowCards: { home: 0, away: 1 },
      redCards: { home: 0, away: 0 },
    };
    const result = foldMatchStats(current, [], PIECES, { team: 'home', actionCountDelta: 0 });
    expect(result).toEqual(current);
  });
});
