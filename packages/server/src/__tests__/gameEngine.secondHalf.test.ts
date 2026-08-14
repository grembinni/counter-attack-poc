import { describe, it, expect } from 'vitest';
import { applySecondHalfConfirm } from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Task 1 (39-14): gameEngine.secondHalf.test.ts — RED-state spec for D-16's
// second-half mutual-confirm gate.
//
// RESEARCH.md Pitfall 4 rules out copying LINEUP_CONFIRM's storage pattern:
// LINEUP_CONFIRM's "either player may confirm first" flags live on the
// pre-match `Room` object because `GameState` does not exist yet at that
// point in the flow. Half-time is mid-match — `GameState` already exists —
// so there is no clean path to plumb a new `Room` field into
// `broadcastState` the way `LINEUP_CONFIRM` does. `GameState.headerConfirmed`
// (`{ home: boolean; away: boolean } | null`) is the correct GameState-scoped
// analog: it already reaches both clients through the existing full-snapshot
// `broadcastState` call with zero new plumbing, and `secondHalfConfirmed`
// (added in Plan 39-01) deliberately copies its exact shape.
// ---------------------------------------------------------------------------

const homeFwd: PlayerPiece = {
  id: 'home-fwd',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'FWD',
  number: 9,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 15, r: 12 },
  pace: 6,
  shooting: 5,
  tackling: 3,
  dribbling: 5,
  saving: 1,
  handling: 1,
  resilience: 4,
  aerialAbility: 4,
  highPass: 4,
};

const awayMid: PlayerPiece = {
  id: 'away-mid',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'MID',
  number: 6,
  nationality: 'Test',
  role: 'MID',
  position: { q: 20, r: 13 },
  pace: 6,
  shooting: 4,
  tackling: 5,
  dribbling: 5,
  saving: 1,
  handling: 1,
  resilience: 4,
  aerialAbility: 3,
  highPass: 5,
};

/** HALF_TIME state fixture — mirrors gameEngine.phase8.test.ts's makeHalfTimeState. */
const makeHalfTimeState = (overrides: Partial<GameState> = {}): GameState => ({
  roomCode: 'SECONDHALF',
  phase: 'HALF_TIME',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeFwd, awayMid],
  ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
  score: { home: 1, away: 0 },
  actionCount: 48,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 2 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  ballZone: 'middle',
  addedTime: 3,
  lastActionType: 'MOVEMENT_PHASE',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' },
  selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
  gameSpeed: 'standard' as const,
  secondHalfConfirmed: null,
  ...overrides,
});

describe('applySecondHalfConfirm (D-16)', () => {
  it('rejects with WRONG_PHASE when phase is not HALF_TIME', () => {
    const state = makeHalfTimeState({ phase: 'MOVE' });
    const result = applySecondHalfConfirm(state, 'home');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('WRONG_PHASE');
  });

  it('a single home confirm stays in HALF_TIME with secondHalfConfirmed: {home:true, away:false}', () => {
    const state = makeHalfTimeState({ secondHalfConfirmed: null });
    const result = applySecondHalfConfirm(state, 'home');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('HALF_TIME');
    expect(result.state.secondHalfConfirmed).toEqual({ home: true, away: false });
  });

  it('a single home confirm appends SECOND_HALF_CONFIRM with team:home, bothConfirmed:false', () => {
    const state = makeHalfTimeState({ secondHalfConfirmed: null });
    const result = applySecondHalfConfirm(state, 'home');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const evt = result.state.eventLog.find((e) => e.type === 'SECOND_HALF_CONFIRM');
    expect(evt).toBeDefined();
    if (evt?.type === 'SECOND_HALF_CONFIRM') {
      expect(evt.team).toBe('home');
      expect(evt.bothConfirmed).toBe(false);
    }
  });

  it('a second call with away sets both flags and appends bothConfirmed:true', () => {
    const state = makeHalfTimeState({ secondHalfConfirmed: { home: true, away: false } });
    const result = applySecondHalfConfirm(state, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const evt = [...result.state.eventLog].reverse().find((e) => e.type === 'SECOND_HALF_CONFIRM');
    expect(evt).toBeDefined();
    if (evt?.type === 'SECOND_HALF_CONFIRM') {
      expect(evt.team).toBe('away');
      expect(evt.bothConfirmed).toBe(true);
    }
  });

  it('a second call with away only THEN performs the existing applyHalfTimeStart transition to KICK_OFF_SETUP', () => {
    const state = makeHalfTimeState({ secondHalfConfirmed: { home: true, away: false } });
    const result = applySecondHalfConfirm(state, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('KICK_OFF_SETUP');
    expect(result.state.half).toBe(2);
    // attackingTeam flips to the opposite of kickOffTeam (D-26), exactly as
    // applyHalfTimeStart already does on its own.
    expect(result.state.attackingTeam).toBe('away');
  });

  it('either team may confirm first — away-then-home produces the identical end state as home-then-away', () => {
    const homeFirst = (() => {
      const r1 = applySecondHalfConfirm(makeHalfTimeState({ secondHalfConfirmed: null }), 'home');
      if (!r1.ok) throw new Error('unexpected');
      const r2 = applySecondHalfConfirm(r1.state, 'away');
      if (!r2.ok) throw new Error('unexpected');
      return r2.state;
    })();

    const awayFirst = (() => {
      const r1 = applySecondHalfConfirm(makeHalfTimeState({ secondHalfConfirmed: null }), 'away');
      if (!r1.ok) throw new Error('unexpected');
      const r2 = applySecondHalfConfirm(r1.state, 'home');
      if (!r2.ok) throw new Error('unexpected');
      return r2.state;
    })();

    expect(homeFirst.phase).toBe(awayFirst.phase);
    expect(homeFirst.half).toBe(awayFirst.half);
    expect(homeFirst.attackingTeam).toBe(awayFirst.attackingTeam);
    expect(homeFirst.secondHalfConfirmed).toEqual(awayFirst.secondHalfConfirmed);
  });

  it('a repeated confirm from the SAME team is idempotent: no duplicate event, no transition', () => {
    const state = makeHalfTimeState({ secondHalfConfirmed: { home: true, away: false } });
    const result = applySecondHalfConfirm(state, 'home');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('HALF_TIME');
    expect(result.state.secondHalfConfirmed).toEqual({ home: true, away: false });
    const confirmEvents = result.state.eventLog.filter((e) => e.type === 'SECOND_HALF_CONFIRM');
    expect(confirmEvents).toHaveLength(0);
    // The state must be referentially the SAME object — no spurious eventLog growth either.
    expect(result.state.eventLog).toBe(state.eventLog);
  });

  it('secondHalfConfirmed is cleared back to null once the half has started', () => {
    const state = makeHalfTimeState({ secondHalfConfirmed: { home: true, away: false } });
    const result = applySecondHalfConfirm(state, 'away');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.secondHalfConfirmed).toBeNull();
  });
});
