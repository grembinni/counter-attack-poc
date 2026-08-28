// Phase 45 (45-02) — STATS-07/STATS-08 shot/xG capture at every logical shot-resolution
// site. Task 45-02-02 covers S1 (applyRoll `case 'SHOT'`) and S2 (applyPenaltyKickDuel).
// Task 45-02-03 extends this file with a `describe` block for the five handler-level
// sites (S3-S7, gameHandlers.ts) plus the explicit no-double-count regression.
//
// Fixture convention: home always attacks toward q=36 (PD-02), so every shooter/taker
// fixture below sits near the AWAY goal (awaySixYardBox: q>=35,r 8-17; awayPenaltyArea:
// q>=31,r 5-19), mirroring 45-01's matchStats.test.ts orientation. Expected xG values are
// computed by calling the already-unit-tested `computeShotXg` directly on the same
// pre-shot fixture data, rather than hardcoded magic numbers — this keeps the test
// resilient to formula tuning while still proving the ENGINE wires the pre-reset pieces
// through correctly (the actual regression surface this file exists to cover).

import { describe, it, expect } from 'vitest';
import { applyRoll, applyPenaltyKickDuel } from '../gameEngine.js';
import type { GameState, PlayerPiece, MatchStats } from '@counter-attack/shared';
import { computeShotXg, PENALTY_SPOT } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Shared fixtures — applyRoll SHOT case (S1)
// ---------------------------------------------------------------------------

const homeShooter: PlayerPiece = {
  id: 'home-shooter',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'SHOOTER',
  number: 9,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 34, r: 13 }, // inside awayPenaltyArea (q>=31), NOT awaySixYardBox (q>=35)
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

const awayGK: PlayerPiece = {
  id: 'away-gk',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 36, r: 13 }, // inside awaySixYardBox
  pace: 4,
  shooting: 1,
  tackling: 2,
  dribbling: 2,
  saving: 5,
  handling: 3, // low on purpose — lets a single test toggle caught/spilled via handlingDice alone
  resilience: 6,
  aerialAbility: 5,
  highPass: 0,
};

/** Minimal SHOT-phase base fixture: home shooter carries the ball, away GK defends. */
const baseShotState: GameState = {
  roomCode: 'MSTAT-SHOT',
  phase: 'SHOT',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeShooter, awayGK],
  ball: { position: homeShooter.position, carrierId: homeShooter.id, lastTouchedBy: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  ballZone: 'away',
  addedTime: null,
  lastActionType: 'MOVEMENT_PHASE',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' },
  selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
  gameSpeed: 'standard',
};

/** Expected xG for the sparse baseShotState defender layout ([awayGK] only). */
const baseExpectedXg = computeShotXg(homeShooter.position, 'home', [awayGK]);

describe('applyRoll SHOT case — shot/xG capture (S1, STATS-07/08)', () => {
  it('unsaveable auto-goal branch (GK dive distance > 3): shots[home] += 1, xg[home] += computeShotXg pre-reset value', () => {
    // gkDivePosition far from gk.position forces diveResult.saveable = false (dead-code
    // path in production, but directly testable here) — routes to the unsaveable
    // auto-goal branch regardless of dice.
    const state: GameState = { ...baseShotState, gkDivePosition: { q: 10, r: 13 } };
    const result = applyRoll(state, 3, 3, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('KICK_OFF_SETUP');
    expect(result.state.score.home).toBe(1);
    expect(result.state.matchStats?.shots.home).toBe(1);
    expect(result.state.matchStats?.shots.away).toBe(0);
    expect(result.state.matchStats?.xg.home).toBeCloseTo(baseExpectedXg, 10);
  });

  it('duel GOAL branch (shooterScore > gkScore): shots[home] += 1, xg[home] += computeShotXg pre-reset value', () => {
    // shooter 5+6=11 vs gk 5+1=6 → GOAL
    const result = applyRoll(baseShotState, 6, 1, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('KICK_OFF_SETUP');
    expect(result.state.score.home).toBe(1);
    expect(result.state.matchStats?.shots.home).toBe(1);
    expect(result.state.matchStats?.xg.home).toBeCloseTo(baseExpectedXg, 10);
  });

  it('duel LOOSE_BALL branch (tie): shots[home] += 1, xg[home] += computeShotXg pre-reset value', () => {
    // shooter 5+4=9 vs gk 5+4=9 → tie
    const result = applyRoll(baseShotState, 4, 4, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.matchStats?.shots.home).toBe(1);
    expect(result.state.matchStats?.xg.home).toBeCloseTo(baseExpectedXg, 10);
  });

  describe('duel SAVE branch', () => {
    it('caught sub-branch (handlingDice < gk.handling): shots[home] += 1, xg[home] += computeShotXg pre-reset value', () => {
      // shooter 5+1=6 vs gk 5+6=11 → gk wins (SAVE); handling 1 < gk.handling 3 → caught
      const result = applyRoll(baseShotState, 1, 6, 1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.phase).toBe('GK_RESTART');
      expect(result.state.matchStats?.shots.home).toBe(1);
      expect(result.state.matchStats?.xg.home).toBeCloseTo(baseExpectedXg, 10);
    });

    it('spilled sub-branch (handlingDice >= gk.handling): shots[home] += 1, xg[home] += computeShotXg pre-reset value', () => {
      // shooter 5+1=6 vs gk 5+6=11 → gk wins (SAVE); handling 6 >= gk.handling 3 → spilled
      const result = applyRoll(baseShotState, 1, 6, 6);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.phase).toBe('LOOSE_BALL');
      expect(result.state.matchStats?.shots.home).toBe(1);
      expect(result.state.matchStats?.xg.home).toBeCloseTo(baseExpectedXg, 10);
    });
  });

  it('the defending team shot count is unchanged after a home shot', () => {
    const result = applyRoll(baseShotState, 6, 1, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.matchStats?.shots.away).toBe(0);
  });

  it('matchStats from the incoming state is preserved and added to, never replaced', () => {
    const seededStats: MatchStats = {
      possessionActionCount: { home: 0, away: 0 },
      passesCompleted: { home: 0, away: 0 },
      tackleStealAttempts: { home: 0, away: 0 },
      tackleStealSuccesses: { home: 0, away: 0 },
      shots: { home: 3, away: 1 },
      xg: { home: 1.2, away: 0.5 },
      fouls: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 },
    };
    const state: GameState = { ...baseShotState, matchStats: seededStats };
    const result = applyRoll(state, 6, 1, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.matchStats?.shots).toEqual({ home: 4, away: 1 });
    expect(result.state.matchStats?.xg.away).toBe(0.5);
    expect(result.state.matchStats?.xg.home).toBeCloseTo(1.2 + baseExpectedXg, 10);
  });

  it('a state entering with matchStats undefined does not throw; treated as all-zero', () => {
    const { matchStats: _omit, ...rest } = baseShotState as GameState & {
      matchStats?: MatchStats;
    };
    const state = rest as GameState;
    expect(() => applyRoll(state, 6, 1, 3)).not.toThrow();
    const result = applyRoll(state, 6, 1, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.matchStats?.shots.home).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Pitfall 2 regression: a crowded six-yard box must yield a materially LOWER xG
  // than the same shot against a sparse (kickoff-like) layout, and the GOAL branch
  // must record the CROWDED (pre-reset) value, not a post-reset kickoff-formation one.
  // ---------------------------------------------------------------------------
  it('Pitfall 2 regression: GOAL branch records xG from the crowded PRE-shot layout, not a sparse/kickoff-like one', () => {
    const crowded1: PlayerPiece = {
      ...awayGK,
      id: 'away-crowd-1',
      role: 'DEF',
      position: { q: 36, r: 9 },
    };
    const crowded2: PlayerPiece = {
      ...awayGK,
      id: 'away-crowd-2',
      role: 'DEF',
      position: { q: 35, r: 11 },
    };
    const crowded3: PlayerPiece = {
      ...awayGK,
      id: 'away-crowd-3',
      role: 'DEF',
      position: { q: 36, r: 15 },
    };
    const crowdedDefenders = [awayGK, crowded1, crowded2, crowded3]; // D >= 3 inside awaySixYardBox
    const crowdedState: GameState = {
      ...baseShotState,
      pieces: [homeShooter, ...crowdedDefenders],
    };

    const crowdedXg = computeShotXg(homeShooter.position, 'home', crowdedDefenders);
    // Sparse/kickoff-like comparison: GK alone in the box (D=1), no outfield defenders present.
    const sparseXg = computeShotXg(homeShooter.position, 'home', [awayGK]);
    expect(crowdedXg).toBeLessThan(sparseXg); // materially lower — proves the fixture is valid

    // shooter 5+6=11 vs gk 5+1=6 → GOAL
    const result = applyRoll(crowdedState, 6, 1, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('KICK_OFF_SETUP'); // confirms pieces WERE reset for this branch
    expect(result.state.matchStats?.xg.home).toBeCloseTo(crowdedXg, 10);
    expect(result.state.matchStats?.xg.home).not.toBeCloseTo(sparseXg, 10);
  });
});

// ---------------------------------------------------------------------------
// Shared fixtures — applyPenaltyKickDuel (S2)
// ---------------------------------------------------------------------------

const homeTaker: PlayerPiece = {
  id: 'home-taker',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'TAKER',
  number: 9,
  nationality: 'Test',
  role: 'FWD',
  position: PENALTY_SPOT.away, // {q:32, r:13} — inside awayPenaltyArea, not awaySixYardBox
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

const penaltyAwayGK: PlayerPiece = {
  id: 'pen-away-gk',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 36, r: 13 }, // on the goal line, inside awaySixYardBox
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

const baseDuelState: GameState = {
  roomCode: 'MSTAT-PEN',
  phase: 'PENALTY_KICK',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeTaker, penaltyAwayGK],
  ball: {
    position: PENALTY_SPOT.away,
    carrierId: homeTaker.id,
    lastTouchedBy: { pieceId: homeTaker.id, teamId: 'home' },
  },
  score: { home: 0, away: 0 },
  actionCount: 10,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  ballZone: 'away',
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' },
  selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
  gameSpeed: 'standard',
  penaltyKickTeam: 'home',
  penaltyKickSpot: PENALTY_SPOT.away,
  penaltyKickEligibleIds: null,
  penaltyKickUsedPace: {},
  penaltyKickTakerId: homeTaker.id,
};

const penaltyExpectedXg = computeShotXg(homeTaker.position, 'home', [penaltyAwayGK]);

describe('applyPenaltyKickDuel — shot/xG capture (S2, STATS-07/08)', () => {
  it('GOAL branch (takerCombined > gkCombined): shots[home] += 1, xg[home] += computeShotXg pre-reset value', () => {
    // taker 5+6=11 vs gk 5+6-2=9 → GOAL
    const result = applyPenaltyKickDuel(baseDuelState, 6, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.score.home).toBe(1);
    expect(result.state.matchStats?.shots.home).toBe(1);
    expect(result.state.matchStats?.xg.home).toBeCloseTo(penaltyExpectedXg, 10);
  });

  it('SAVE branch (gkCombined > takerCombined): shots[home] += 1, xg[home] += computeShotXg pre-reset value', () => {
    // taker 5+1=6 vs gk 5+6-2=9 → SAVED
    const result = applyPenaltyKickDuel(baseDuelState, 1, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_RESTART');
    expect(result.state.matchStats?.shots.home).toBe(1);
    expect(result.state.matchStats?.xg.home).toBeCloseTo(penaltyExpectedXg, 10);
  });

  it('TIE branch (equal combined scores): shots[home] += 1, xg[home] += computeShotXg pre-reset value', () => {
    // taker 5+3=8 vs gk 5+5-2=8 → TIE
    const result = applyPenaltyKickDuel(baseDuelState, 3, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.matchStats?.shots.home).toBe(1);
    expect(result.state.matchStats?.xg.home).toBeCloseTo(penaltyExpectedXg, 10);
  });

  it('the defending team shot count is unchanged after a home penalty', () => {
    const result = applyPenaltyKickDuel(baseDuelState, 6, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.matchStats?.shots.away).toBe(0);
  });

  it('matchStats from the incoming state is preserved and added to, never replaced', () => {
    const seededStats: MatchStats = {
      possessionActionCount: { home: 0, away: 0 },
      passesCompleted: { home: 0, away: 0 },
      tackleStealAttempts: { home: 0, away: 0 },
      tackleStealSuccesses: { home: 0, away: 0 },
      shots: { home: 2, away: 4 },
      xg: { home: 0.4, away: 1.1 },
      fouls: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 },
    };
    const state: GameState = { ...baseDuelState, matchStats: seededStats };
    const result = applyPenaltyKickDuel(state, 6, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.matchStats?.shots).toEqual({ home: 3, away: 4 });
    expect(result.state.matchStats?.xg.away).toBe(1.1);
    expect(result.state.matchStats?.xg.home).toBeCloseTo(0.4 + penaltyExpectedXg, 10);
  });

  it('a state entering with matchStats undefined does not throw; treated as all-zero', () => {
    const { matchStats: _omit, ...rest } = baseDuelState as GameState & {
      matchStats?: MatchStats;
    };
    const state = rest as GameState;
    expect(() => applyPenaltyKickDuel(state, 6, 6)).not.toThrow();
    const result = applyPenaltyKickDuel(state, 6, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.matchStats?.shots.home).toBe(1);
  });
});
