/**
 * Phase 40 Plan 02 Task 1 (Wave 0, RED state): full engine-level spec for
 * `applySubstitution` (SUB-02..07, SETTINGS-04, D-12, D-13) and `applyRosterContinuity`.
 * Both exports are implemented in Task 2/3 of this plan — until then, every test below
 * is EXPECTED to fail because `applySubstitution`/`applyRosterContinuity` do not exist
 * yet (imported as `undefined`, calling them throws a TypeError). This is the intended
 * RED state, not a fixture/type error.
 *
 * Fixture conventions (per gameEngine.penaltyKick.test.ts / gameEngine.phase8.test.ts):
 *  - Every hex literal comes from `PITCH_REGIONS` or `buildKickOffPieces`'s own
 *    formation-derived output — never an invented coordinate.
 *  - Real `PLAYER_POOL` ids via `getSquadPlayers('city'|'crew')` for the starting XI
 *    and real free-agent `PLAYER_POOL` ids (not part of either XI) for the bench.
 */
import { describe, it, expect } from 'vitest';
import {
  applySubstitution,
  applyRosterContinuity,
  applyEndTurn,
  applyRoll,
  applyHalfTimeStart,
  buildKickOffPieces,
  buildInitialGameState,
} from '../gameEngine.js';
import type { GameState, PlayerPiece, BenchEntry, BenchEntryStatus } from '@counter-attack/shared';
import {
  PITCH_REGIONS,
  getSquadPlayers,
  PLAYER_POOL,
  MAX_SUBS_PER_TEAM,
  maxOnPitchFor,
} from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Fixture data — real pool ids, real formation-derived hexes, no invented coords.
// ---------------------------------------------------------------------------

const HOME_TEAM = 'city' as const;
const AWAY_TEAM = 'crew' as const;

/** getSquadPlayers order matches buildSquadPieces' index-based mapping (GK first). */
const homePoolPlayers = getSquadPlayers(HOME_TEAM);
const awayPoolPlayers = getSquadPlayers(AWAY_TEAM);

/** Real 22-piece squad at real formation-derived hexes — never a hand-invented coordinate. */
const baseKickOffPieces = buildKickOffPieces(
  'home',
  { home: HOME_TEAM, away: AWAY_TEAM },
  { home: '4-4-2', away: '4-4-2' },
);

/**
 * `buildKickOffPieces`/`buildSquadPieces` do not yet stamp `playerId` onto each piece
 * (that wiring is plan 40-04's job) — this fixture stamps it locally so `applySubstitution`
 * has pool identity to read, matching the ordering `buildSquadPieces` itself uses
 * (home pieces 0..10 from `homePoolPlayers`, away pieces 0..10 from `awayPoolPlayers`).
 */
const homeXIIds = new Set(homePoolPlayers.map((p) => p.id));
const awayXIIds = new Set(awayPoolPlayers.map((p) => p.id));
const BASE_PIECES: PlayerPiece[] = baseKickOffPieces.map((piece, idx) => {
  const isHome = piece.teamId === 'home';
  const squad = isHome ? homePoolPlayers : awayPoolPlayers;
  const squadIdx = isHome ? idx : idx - 11;
  return { ...piece, playerId: squad[squadIdx]!.id };
});

/** Real free-agent pool players, disjoint from both starting XIs — bench source. */
const freeAgents = PLAYER_POOL.filter(
  (p) => p.sourceTeamId === 'free-agent' && !homeXIIds.has(p.id) && !awayXIIds.has(p.id),
);
const benchGK = freeAgents.find((p) => p.role === 'GK')!;
const benchOutfielders = freeAgents.filter((p) => p.role !== 'GK');

const homeBenchBase: BenchEntry[] = [
  { playerId: benchOutfielders[0]!.id, jerseyNumber: 20, status: 'available' },
  { playerId: benchOutfielders[1]!.id, jerseyNumber: 21, status: 'available' },
  { playerId: benchGK.id, jerseyNumber: 22, status: 'available' },
];
const awayBenchBase: BenchEntry[] = [
  { playerId: benchOutfielders[2]!.id, jerseyNumber: 20, status: 'available' },
  { playerId: benchOutfielders[3]!.id, jerseyNumber: 21, status: 'available' },
  { playerId: benchOutfielders[4]!.id, jerseyNumber: 22, status: 'available' },
];

type BenchOverride = { team: 'home' | 'away'; index: number; status: BenchEntryStatus };

/**
 * Wave 0 fixture factory (per plan spec): a `KICK_OFF_SETUP` GameState with 22 real
 * pieces (real pool `playerId`s, formation-derived positions), a 3-entry bench per team,
 * `subsUsed: {home:0, away:0}`, `addedTimeBonus: 0`, `addedTime: null`. Accepts an
 * options bag so a single bench entry's status can be overridden to 'subbedOut' or
 * 'redCarded' without hand-rolling a second fixture.
 */
function makeSubState(
  overrides: Partial<GameState> = {},
  benchOverride?: BenchOverride,
): GameState {
  const homeBench = homeBenchBase.map((entry, i) =>
    benchOverride?.team === 'home' && benchOverride.index === i
      ? { ...entry, status: benchOverride.status }
      : entry,
  );
  const awayBench = awayBenchBase.map((entry, i) =>
    benchOverride?.team === 'away' && benchOverride.index === i
      ? { ...entry, status: benchOverride.status }
      : entry,
  );

  return {
    roomCode: 'TEST-SUB',
    phase: 'KICK_OFF_SETUP',
    activeTeam: 'home',
    attackingTeam: 'home',
    pieces: BASE_PIECES,
    ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 2 },
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    ballZone: 'middle',
    addedTime: null,
    lastActionType: null,
    kickOffTeam: 'home',
    kickOffActive: false,
    selectedTeams: { home: HOME_TEAM, away: AWAY_TEAM },
    selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
    selectedFormation: { home: '4-4-2', away: '4-4-2' },
    gameSpeed: 'standard' as const,
    foulsEnabled: false,
    bookingEnabled: false,
    injuryEnabled: false,
    outOfBoundsEnabled: false,
    bench: { home: homeBench, away: awayBench },
    subsUsed: { home: 0, away: 0 },
    addedTimeBonus: 0,
    ...overrides,
  };
}

const homeOutfieldPiece = () => BASE_PIECES.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
const homeGKPiece = () => BASE_PIECES.find((p) => p.teamId === 'home' && p.role === 'GK')!;
const awayOutfieldPiece = () => BASE_PIECES.find((p) => p.teamId === 'away' && p.role !== 'GK')!;

// ---------------------------------------------------------------------------
// applySubstitution
// ---------------------------------------------------------------------------

describe('applySubstitution', () => {
  it('SUB-02/D-04: 1-for-1 swap — pieces.length unchanged, exactly one piece differs', () => {
    const state = makeSubState();
    const outPiece = homeOutfieldPiece();
    const inPlayerId = homeBenchBase[0]!.playerId;

    const result = applySubstitution(state, 'home', outPiece.id, inPlayerId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pieces.length).toBe(state.pieces.length);
    expect(result.state.pieces.length).toBe(22);
    const diffCount = result.state.pieces.filter((p, i) => p !== state.pieces[i]).length;
    expect(diffCount).toBe(1);
  });

  it('SUB-03: substitute inherits id/number/position; playerId/name/attributes come from incoming player', () => {
    const state = makeSubState();
    const outPiece = homeOutfieldPiece();
    const inPoolPlayer = benchOutfielders[0]!;
    const inPlayerId = homeBenchBase[0]!.playerId;
    expect(inPlayerId).toBe(inPoolPlayer.id);

    const result = applySubstitution(state, 'home', outPiece.id, inPlayerId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const newPiece = result.state.pieces.find((p) => p.id === outPiece.id)!;
    expect(newPiece.id).toBe(outPiece.id);
    expect(newPiece.number).toBe(outPiece.number);
    expect(newPiece.position).toEqual(outPiece.position);
    expect(newPiece.playerId).toBe(inPoolPlayer.id);
    expect(newPiece.playerId).not.toBe(outPiece.playerId);
    expect(newPiece.firstName).toBe(inPoolPlayer.firstName);
    expect(newPiece.lastName).toBe(inPoolPlayer.lastName);
    expect(newPiece.pace).toBe(inPoolPlayer.pace);
  });

  it('SUB-03: incoming piece has no inherited redCarded/yellowCards/injuryCount from the outgoing piece', () => {
    const dirtyOutPiece: PlayerPiece = {
      ...homeOutfieldPiece(),
      yellowCards: 1,
      injuryCount: 1,
    };
    const state = makeSubState({
      pieces: BASE_PIECES.map((p) => (p.id === dirtyOutPiece.id ? dirtyOutPiece : p)),
    });
    const inPlayerId = homeBenchBase[0]!.playerId;

    const result = applySubstitution(state, 'home', dirtyOutPiece.id, inPlayerId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const newPiece = result.state.pieces.find((p) => p.id === dirtyOutPiece.id)!;
    expect(newPiece.redCarded).toBeFalsy();
    expect(newPiece.yellowCards ?? 0).toBe(0);
    expect(newPiece.injuryCount ?? 0).toBe(0);
  });

  it('SUB-04: three successful substitutions succeed; the 4th is SUB_CAP_REACHED; other team untouched', () => {
    let state = makeSubState();
    const outfielders = BASE_PIECES.filter((p) => p.teamId === 'home' && p.role !== 'GK');

    // Three DISTINCT bench entries consumed in turn (homeBenchBase has exactly 3 slots);
    // the third is the bench GK, so it substitutes the home GK slot to satisfy GK parity.
    const subs: Array<{ outId: string; inPlayerId: string }> = [
      { outId: outfielders[0]!.id, inPlayerId: homeBenchBase[0]!.playerId },
      { outId: outfielders[1]!.id, inPlayerId: homeBenchBase[1]!.playerId },
      { outId: homeGKPiece().id, inPlayerId: homeBenchBase[2]!.playerId },
    ];
    expect(subs.length).toBe(MAX_SUBS_PER_TEAM);

    for (const sub of subs) {
      const result = applySubstitution(state, 'home', sub.outId, sub.inPlayerId);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.subsUsed?.home).toBe(MAX_SUBS_PER_TEAM);

    const fourth = applySubstitution(state, 'home', outfielders[2]!.id, homeBenchBase[0]!.playerId);
    expect(fourth).toEqual({ ok: false, reason: 'SUB_CAP_REACHED' });
    expect(state.subsUsed?.away ?? 0).toBe(0);
  });

  it('SUB-04: subsUsed survives an applyEndTurn HALF_TIME transition unchanged', () => {
    const subState = makeSubState({
      subsUsed: { home: 2, away: 1 },
      refereeCard: { leniency: 0 },
    });
    const outPiece = homeOutfieldPiece();
    const subResult = applySubstitution(subState, 'home', outPiece.id, homeBenchBase[0]!.playerId);
    expect(subResult.ok).toBe(true);
    if (!subResult.ok) return;

    // actionCount=45+2(standard speed)=47; leniency=0, roll=1, bonus=1(from the sub above)
    // => halfEnd=45+2=47 <= newActionCount(47) => HALF_TIME reached.
    const attacker2State: GameState = {
      ...subResult.state,
      phase: 'MOVE',
      movementSlot: 'ATTACKER_2',
      actionCount: 45,
    };
    const endTurnResult = applyEndTurn(attacker2State, { addedTimeRoll: 1 });
    expect(endTurnResult.ok).toBe(true);
    if (!endTurnResult.ok) return;
    expect(endTurnResult.state.phase).toBe('HALF_TIME');
    expect(endTurnResult.state.subsUsed).toEqual(subResult.state.subsUsed);
  });

  it('SUB-05: each successful substitution increments addedTimeBonus by 1 (and addedTime by 1 when already set)', () => {
    const state = makeSubState({ addedTimeBonus: 0, addedTime: null });
    const result = applySubstitution(
      state,
      'home',
      homeOutfieldPiece().id,
      homeBenchBase[0]!.playerId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.addedTimeBonus).toBe(1);
    expect(result.state.addedTime).toBeNull();

    const secondOutfielder = BASE_PIECES.filter((p) => p.teamId === 'home' && p.role !== 'GK')[1]!;
    const midMatchState = makeSubState({ addedTimeBonus: 2, addedTime: 5 });
    const secondResult = applySubstitution(
      midMatchState,
      'home',
      secondOutfielder.id,
      homeBenchBase[1]!.playerId,
    );
    expect(secondResult.ok).toBe(true);
    if (!secondResult.ok) return;
    expect(secondResult.state.addedTimeBonus).toBe(3);
    expect(secondResult.state.addedTime).toBe(6);
  });

  it('SUB-06: outgoing piece redCarded===true returns CANNOT_SUB_RED_CARD; maxOnPitchFor reports 10 afterwards', () => {
    const redOutfielder = homeOutfieldPiece();
    const state = makeSubState({
      pieces: BASE_PIECES.map((p) => (p.id === redOutfielder.id ? { ...p, redCarded: true } : p)),
    });

    const result = applySubstitution(state, 'home', redOutfielder.id, homeBenchBase[0]!.playerId);
    expect(result).toEqual({ ok: false, reason: 'CANNOT_SUB_RED_CARD' });
    expect(maxOnPitchFor(state.pieces, 'home')).toBe(10);
  });

  it('SUB-07: substituting a player back in after they were subbed off returns ALREADY_SUBBED', () => {
    const state = makeSubState(undefined, { team: 'home', index: 0, status: 'subbedOut' });
    const result = applySubstitution(
      state,
      'home',
      homeOutfieldPiece().id,
      homeBenchBase[0]!.playerId,
    );
    expect(result).toEqual({ ok: false, reason: 'ALREADY_SUBBED' });
  });

  it("D-13: a bench entry with status 'redCarded' returns CANNOT_SUB_IN_RED_CARDED, distinct from ALREADY_SUBBED/CANNOT_SUB_RED_CARD", () => {
    const state = makeSubState(undefined, { team: 'home', index: 0, status: 'redCarded' });
    const result = applySubstitution(
      state,
      'home',
      homeOutfieldPiece().id,
      homeBenchBase[0]!.playerId,
    );
    expect(result).toEqual({ ok: false, reason: 'CANNOT_SUB_IN_RED_CARDED' });
    expect(result).not.toEqual({ ok: false, reason: 'ALREADY_SUBBED' });
    expect(result).not.toEqual({ ok: false, reason: 'CANNOT_SUB_RED_CARD' });
  });

  it('D-13: after a redCarded-bench-entry rejection, pieces/bench/subsUsed are structurally unchanged', () => {
    const state = makeSubState(undefined, { team: 'home', index: 0, status: 'redCarded' });
    applySubstitution(state, 'home', homeOutfieldPiece().id, homeBenchBase[0]!.playerId);
    // The rejected call must never have mutated the input state object itself.
    expect(state.pieces).toEqual(BASE_PIECES);
    expect(state.bench?.home[0]!.status).toBe('redCarded');
    expect(state.subsUsed).toEqual({ home: 0, away: 0 });
  });

  it('D-12: an empty bench for the team returns INVALID_SUBSTITUTE for any inPlayerId — no substitute is fabricated', () => {
    const state = makeSubState({ bench: { home: [], away: awayBenchBase } });
    const result = applySubstitution(state, 'home', homeOutfieldPiece().id, 'p999-nonexistent');
    expect(result).toEqual({ ok: false, reason: 'INVALID_SUBSTITUTE' });
  });

  it('SUB-01 defence-in-depth: a non-stoppage phase (MOVE) returns WRONG_PHASE', () => {
    const state = makeSubState({ phase: 'MOVE' });
    const result = applySubstitution(
      state,
      'home',
      homeOutfieldPiece().id,
      homeBenchBase[0]!.playerId,
    );
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('Ownership: an outPieceId belonging to the opposing team returns INVALID_SUBSTITUTE', () => {
    const state = makeSubState();
    const result = applySubstitution(
      state,
      'home',
      awayOutfieldPiece().id,
      homeBenchBase[0]!.playerId,
    );
    expect(result).toEqual({ ok: false, reason: 'INVALID_SUBSTITUTE' });
  });

  it('Ownership: an inPlayerId absent from bench[team] returns INVALID_SUBSTITUTE', () => {
    const state = makeSubState();
    const result = applySubstitution(state, 'home', homeOutfieldPiece().id, 'p999-nonexistent');
    expect(result).toEqual({ ok: false, reason: 'INVALID_SUBSTITUTE' });
  });

  it('GK parity: a non-GK bench player onto the GK slot returns GK_SLOT_REQUIRES_GK', () => {
    const state = makeSubState();
    const result = applySubstitution(state, 'home', homeGKPiece().id, homeBenchBase[0]!.playerId);
    expect(result).toEqual({ ok: false, reason: 'GK_SLOT_REQUIRES_GK' });
  });

  it('GK parity: a GK bench player onto an outfield slot returns NON_GK_SLOT_REJECTS_GK', () => {
    const state = makeSubState();
    const result = applySubstitution(
      state,
      'home',
      homeOutfieldPiece().id,
      homeBenchBase[2]!.playerId,
    );
    expect(result).toEqual({ ok: false, reason: 'NON_GK_SLOT_REJECTS_GK' });
  });

  it('SETTINGS-04: substitution succeeds under all 16 combinations of the four game-creation toggles', () => {
    const outfielders = BASE_PIECES.filter((p) => p.teamId === 'home' && p.role !== 'GK');
    let combo = 0;
    for (const foulsEnabled of [false, true]) {
      for (const bookingEnabled of [false, true]) {
        for (const injuryEnabled of [false, true]) {
          for (const outOfBoundsEnabled of [false, true]) {
            const state = makeSubState({
              foulsEnabled,
              bookingEnabled,
              injuryEnabled,
              outOfBoundsEnabled,
            });
            const outPiece = outfielders[combo % outfielders.length]!;
            const result = applySubstitution(
              state,
              'home',
              outPiece.id,
              homeBenchBase[0]!.playerId,
            );
            expect(result.ok).toBe(true);
            combo++;
          }
        }
      }
    }
    expect(combo).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// applyEndTurn — SUB-05 added-time fold-in
// ---------------------------------------------------------------------------

describe('applyEndTurn SUB-05 added-time fold-in', () => {
  it('folds addedTimeBonus into the roll: addedTime === roll + leniency + addedTimeBonus', () => {
    const state = makeSubState({
      phase: 'MOVE',
      movementSlot: 'ATTACKER_2',
      actionCount: 44,
      addedTime: null,
      addedTimeBonus: 2,
      refereeCard: { leniency: 3 },
    });
    const result = applyEndTurn(state, { addedTimeRoll: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.addedTime).toBe(4 + 3 + 2);
  });

  it('SUB-05/D-07: the HALF_TIME/FULL_TIME return resets addedTimeBonus to 0 while leaving subsUsed unchanged', () => {
    // actionCount=45+2(standard speed)=47; leniency=0, roll=1, bonus=1 => newAddedTime=2
    // (post fold-in) => halfEnd=45+2=47 <= newActionCount(47) => HALF_TIME reached.
    const state = makeSubState({
      phase: 'MOVE',
      movementSlot: 'ATTACKER_2',
      actionCount: 45,
      addedTime: null,
      addedTimeBonus: 1,
      subsUsed: { home: 1, away: 0 },
      refereeCard: { leniency: 0 },
    });
    const result = applyEndTurn(state, { addedTimeRoll: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('HALF_TIME');
    expect(result.state.addedTimeBonus).toBe(0);
    expect(result.state.subsUsed).toEqual({ home: 1, away: 0 });
  });
});

// ---------------------------------------------------------------------------
// applyRosterContinuity
// ---------------------------------------------------------------------------

describe('applyRosterContinuity', () => {
  it('overlays reset positions onto live identity/match state, matched by piece id', () => {
    const currentPieces: PlayerPiece[] = BASE_PIECES.map((p) =>
      p.id === homeOutfieldPiece().id
        ? { ...p, redCarded: true, onPitch: false, yellowCards: 1 as const, injuryCount: 1 }
        : p,
    );
    // resetPieces mimics buildKickOffPieces' fresh formation output — different positions,
    // but the SAME piece ids/order (home-0..home-10/away-0..away-10).
    const resetPieces = buildKickOffPieces(
      'away',
      { home: HOME_TEAM, away: AWAY_TEAM },
      { home: '4-4-2', away: '4-4-2' },
    );

    const merged = applyRosterContinuity(resetPieces, currentPieces);

    expect(merged.length).toBe(resetPieces.length);
    for (let i = 0; i < merged.length; i++) {
      expect(merged[i]!.position).toEqual(resetPieces[i]!.position);
      expect(merged[i]!.id).toBe(currentPieces[i]!.id);
    }
    const mergedRedCarded = merged.find((p) => p.id === homeOutfieldPiece().id)!;
    expect(mergedRedCarded.redCarded).toBe(true);
    expect(mergedRedCarded.onPitch).toBe(false);
    expect(mergedRedCarded.yellowCards).toBe(1);
    expect(mergedRedCarded.injuryCount).toBe(1);
    // Position comes from the reset array, NOT the live (possibly stale) position.
    expect(mergedRedCarded.position).not.toEqual(
      currentPieces.find((p) => p.id === homeOutfieldPiece().id)!.position,
    );
  });
});

// ---------------------------------------------------------------------------
// buildInitialGameState — Phase 40 Plan 04 Task 1: playerId stamping +
// bench/subsUsed/addedTimeBonus seeding
// ---------------------------------------------------------------------------

describe('buildInitialGameState: playerId stamping + bench/subsUsed/addedTimeBonus seeding', () => {
  const DEFAULT_STYLES_P40: { home: 'pinstripes-vertical'; away: 'bar-diagonal' } = {
    home: 'pinstripes-vertical',
    away: 'bar-diagonal',
  };

  it('every piece has a non-empty playerId, and all 22 playerId values are distinct', () => {
    const state = buildInitialGameState(
      'ROOM-P40-01',
      { home: HOME_TEAM, away: AWAY_TEAM },
      'standard',
      DEFAULT_STYLES_P40,
    );
    expect(state.pieces.length).toBe(22);
    for (const piece of state.pieces) {
      expect(piece.playerId).toBeTruthy();
    }
    const distinctPlayerIds = new Set(state.pieces.map((p) => p.playerId));
    expect(distinctPlayerIds.size).toBe(22);
  });

  it('a NON-empty homeBench is returned verbatim on bench.home — same length/ids/order, all available', () => {
    const state = buildInitialGameState(
      'ROOM-P40-02',
      { home: HOME_TEAM, away: AWAY_TEAM },
      'standard',
      DEFAULT_STYLES_P40,
      { home: '4-4-2', away: '4-4-2' },
      { home: 'home', away: 'away' },
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      homeBenchBase,
      awayBenchBase,
    );
    expect(state.bench?.home).toEqual(homeBenchBase);
    expect(state.bench?.away).toEqual(awayBenchBase);
    expect(state.bench?.home.length).toBe(homeBenchBase.length);
    for (const entry of state.bench?.home ?? []) {
      expect(entry.status).toBe('available');
    }
  });

  it('D-12: EMPTY homeBench/awayBench returns bench.home.length===0 and bench.away.length===0 — nothing generated', () => {
    const state = buildInitialGameState(
      'ROOM-P40-03',
      { home: HOME_TEAM, away: AWAY_TEAM },
      'standard',
      DEFAULT_STYLES_P40,
      { home: '4-4-2', away: '4-4-2' },
      { home: 'home', away: 'away' },
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      [],
      [],
    );
    expect(state.bench?.home.length).toBe(0);
    expect(state.bench?.away.length).toBe(0);
  });

  it('subsUsed is {home:0, away:0} and addedTimeBonus is 0 on a freshly built state', () => {
    const state = buildInitialGameState(
      'ROOM-P40-04',
      { home: HOME_TEAM, away: AWAY_TEAM },
      'standard',
      DEFAULT_STYLES_P40,
    );
    expect(state.subsUsed).toEqual({ home: 0, away: 0 });
    expect(state.addedTimeBonus).toBe(0);
  });

  it('omitting the two new trailing arguments (pre-Phase-40 call shape) still compiles and returns an empty bench', () => {
    const state = buildInitialGameState(
      'ROOM-P40-05',
      { home: HOME_TEAM, away: AWAY_TEAM },
      'standard',
      DEFAULT_STYLES_P40,
    );
    expect(state.bench?.home.length).toBe(0);
    expect(state.bench?.away.length).toBe(0);
    expect(state.subsUsed).toEqual({ home: 0, away: 0 });
    expect(state.addedTimeBonus).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 3: roster continuity wired into the four in-engine kick-off resets
// ---------------------------------------------------------------------------

describe('Phase 40 Plan 04 Task 3: roster continuity at goal + half-time resets', () => {
  const awayGKPiece = () => BASE_PIECES.find((p) => p.teamId === 'away' && p.role === 'GK')!;

  /**
   * Builds a live in-match state with one home substitution already applied (SUB-03) and a
   * different away outfield piece carrying a red card + yellow card + injury (D-08/D-13's
   * bench mirror entry is added directly here — Task 4's relocateRedCardedToBench wiring is
   * this same plan's next task, but only the resulting bench SHAPE matters for this test).
   */
  function buildLiveState(): GameState {
    const base = makeSubState();
    const outPiece = homeOutfieldPiece();
    const subResult = applySubstitution(base, 'home', outPiece.id, homeBenchBase[0]!.playerId);
    if (!subResult.ok) throw new Error('fixture setup: substitution unexpectedly rejected');

    const cardedPiece = awayOutfieldPiece();
    const piecesWithCard = subResult.state.pieces.map((p) =>
      p.id === cardedPiece.id
        ? { ...p, redCarded: true, onPitch: false, yellowCards: 1 as const, injuryCount: 1 }
        : p,
    );
    const awayBenchWithRedCard: BenchEntry[] = [
      ...subResult.state.bench!.away,
      { playerId: cardedPiece.playerId!, jerseyNumber: cardedPiece.number, status: 'redCarded' },
    ];

    return {
      ...subResult.state,
      pieces: piecesWithCard,
      bench: { home: subResult.state.bench!.home, away: awayBenchWithRedCard },
    };
  }

  function assertContinuity(resultState: GameState, liveState: GameState): void {
    const subbedSlotId = homeOutfieldPiece().id;
    const subbedInPiece = resultState.pieces.find((p) => p.id === subbedSlotId)!;
    expect(subbedInPiece.playerId).toBe(homeBenchBase[0]!.playerId);
    expect(subbedInPiece.playerId).not.toBe(homeOutfieldPiece().playerId);

    // The substituted-out starter never reappears anywhere in pieces after the reset.
    const originalStarterPlayerId = homeOutfieldPiece().playerId!;
    expect(resultState.pieces.some((p) => p.playerId === originalStarterPlayerId)).toBe(false);
    expect(
      resultState.bench?.home.find((e) => e.playerId === originalStarterPlayerId)?.status,
    ).toBe('subbedOut');
    expect(resultState.subsUsed).toEqual(liveState.subsUsed);

    const cardedPiece = awayOutfieldPiece();
    const resultCarded = resultState.pieces.find((p) => p.id === cardedPiece.id)!;
    expect(resultCarded.redCarded).toBe(true);
    expect(resultCarded.onPitch).toBe(false);
    expect(resultCarded.yellowCards).toBe(1);
    expect(resultCarded.injuryCount).toBe(1);
    // Position comes from the fresh formation reset, not the live (pre-reset) piece's position.
    const livePosition = liveState.pieces.find((p) => p.id === cardedPiece.id)!.position;
    expect(resultCarded.position).not.toEqual(livePosition);

    const redCardBenchEntry = resultState.bench?.away.find((e) => e.status === 'redCarded');
    expect(redCardBenchEntry).toBeDefined();
    expect(redCardBenchEntry?.playerId).toBe(cardedPiece.playerId);
  }

  it('a goal reset (unsaveable-shot GOAL branch) preserves substitution + red card state', () => {
    const liveState = buildLiveState();
    const shooter = BASE_PIECES.find(
      (p) => p.teamId === 'home' && p.id !== homeOutfieldPiece().id && p.role !== 'GK',
    )!;
    const shotState: GameState = {
      ...liveState,
      phase: 'SHOT',
      ball: { position: shooter.position, carrierId: shooter.id, lastTouchedBy: null },
      // Far enough from the away GK to force the unsaveable (>3 hexes) GOAL branch.
      gkDivePosition: { q: 0, r: awayGKPiece().position.r },
    };
    const result = applyRoll(shotState, 6, 1, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('KICK_OFF_SETUP');
    assertContinuity(result.state, liveState);
  });

  it('applyHalfTimeStart preserves substitution + red card state', () => {
    const liveState = buildLiveState();
    const halfTimeState: GameState = { ...liveState, phase: 'HALF_TIME' };
    const result = applyHalfTimeStart(halfTimeState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('KICK_OFF_SETUP');
    assertContinuity(result.state, liveState);
  });

  it('state.bench is never rebuilt by a reset — bench identity is referentially the same object', () => {
    const liveState = buildLiveState();
    const halfTimeState: GameState = { ...liveState, phase: 'HALF_TIME' };
    const result = applyHalfTimeStart(halfTimeState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bench).toBe(liveState.bench);
  });
});
