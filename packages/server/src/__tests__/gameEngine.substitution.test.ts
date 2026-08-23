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
  applyMove,
  relocateRedCardedToBench,
  buildKickOffPieces,
  buildInitialGameState,
} from '../gameEngine.js';
import type {
  GameState,
  PlayerPiece,
  BenchEntry,
  BenchEntryStatus,
  HexCoord,
} from '@counter-attack/shared';
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

  it("ICON-03: the outgoing player's yellowCards/injuryCount land on their subbedOut bench entry while the incoming piece stays clean", () => {
    const dirtyOutPiece: PlayerPiece = {
      ...homeOutfieldPiece(),
      yellowCards: 1,
      injuryCount: 2,
    };
    const state = makeSubState({
      pieces: BASE_PIECES.map((p) => (p.id === dirtyOutPiece.id ? dirtyOutPiece : p)),
    });
    const inPlayerId = homeBenchBase[0]!.playerId;

    const result = applySubstitution(state, 'home', dirtyOutPiece.id, inPlayerId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const subbedOutEntry = result.state.bench!.home.find(
      (e) => e.playerId === dirtyOutPiece.playerId,
    )!;
    expect(subbedOutEntry.status).toBe('subbedOut');
    expect(subbedOutEntry.yellowCards).toBe(1);
    expect(subbedOutEntry.injuryCount).toBe(2);

    // The incoming substitute's PlayerPiece still arrives clean (SUB-03 unchanged by this plan).
    const newPiece = result.state.pieces.find((p) => p.id === dirtyOutPiece.id)!;
    expect(newPiece.redCarded).toBeFalsy();
    expect(newPiece.yellowCards ?? 0).toBe(0);
    expect(newPiece.injuryCount ?? 0).toBe(0);
  });

  it('ICON-03: bench array length is unchanged by a substitution, and any other redCarded entry is copied through untouched', () => {
    const state = makeSubState(undefined, { team: 'home', index: 1, status: 'redCarded' });
    const outPiece = homeOutfieldPiece();
    const inPlayerId = homeBenchBase[0]!.playerId;

    const result = applySubstitution(state, 'home', outPiece.id, inPlayerId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.bench!.home.length).toBe(state.bench!.home.length);
    const untouchedRedCardEntry = result.state.bench!.home.find(
      (e) => e.playerId === homeBenchBase[1]!.playerId,
    )!;
    expect(untouchedRedCardEntry.status).toBe('redCarded');
    expect(untouchedRedCardEntry).toEqual(state.bench!.home[1]);
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

// ---------------------------------------------------------------------------
// Task 4 (D-13): relocateRedCardedToBench — pure-function unit tests
// ---------------------------------------------------------------------------

describe('D-13: red-carded player relocation to the bench', () => {
  const redPiece: PlayerPiece = { ...homeOutfieldPiece(), redCarded: true };

  it('returns a bench whose team array has ONE more entry, with playerId/jerseyNumber/status: redCarded', () => {
    const bench = { home: [...homeBenchBase], away: [...awayBenchBase] };
    const result = relocateRedCardedToBench(bench, redPiece);
    expect(result.home.length).toBe(bench.home.length + 1);
    const newEntry = result.home[result.home.length - 1]!;
    expect(newEntry.playerId).toBe(redPiece.playerId);
    expect(newEntry.jerseyNumber).toBe(redPiece.number);
    expect(newEntry.status).toBe('redCarded');
  });

  it("appends to the sent-off player's OWN team array and leaves the opposing team's array referentially unchanged", () => {
    const bench = { home: [...homeBenchBase], away: [...awayBenchBase] };
    const result = relocateRedCardedToBench(bench, redPiece);
    expect(result.away).toBe(bench.away);
  });

  it('is idempotent: calling it twice with the same piece does not produce a duplicate entry', () => {
    const bench = { home: [...homeBenchBase], away: [...awayBenchBase] };
    const once = relocateRedCardedToBench(bench, redPiece);
    const twice = relocateRedCardedToBench(once, redPiece);
    expect(twice.home.length).toBe(once.home.length);
  });

  it('returns the bench unchanged when piece.playerId is undefined (defensive — a piece built before Task 1 stamping)', () => {
    const bench = { home: [...homeBenchBase], away: [...awayBenchBase] };
    // exactOptionalPropertyTypes: omit the key entirely rather than assign `undefined`.
    const { playerId: _omit, ...withoutPlayerId } = redPiece;
    const noPlayerIdPiece: PlayerPiece = withoutPlayerId;
    const result = relocateRedCardedToBench(bench, noPlayerIdPiece);
    expect(result).toEqual(bench);
  });

  it('never mutates the input bench object or either team array', () => {
    const bench = { home: [...homeBenchBase], away: [...awayBenchBase] };
    const homeRef = bench.home;
    const awayRef = bench.away;
    relocateRedCardedToBench(bench, redPiece);
    expect(bench.home).toBe(homeRef);
    expect(bench.away).toBe(awayRef);
    expect(bench.home.length).toBe(homeBenchBase.length);
  });

  it('produces a well-formed { home, away } bench containing exactly the one new entry when bench is undefined', () => {
    const result = relocateRedCardedToBench(undefined, redPiece);
    expect(result.home).toEqual([
      {
        playerId: redPiece.playerId,
        jerseyNumber: redPiece.number,
        status: 'redCarded',
        yellowCards: 0,
        injuryCount: 0,
      },
    ]);
    expect(result.away).toEqual([]);
  });

  it("ICON-03: carries the piece's yellowCards/injuryCount onto the redCarded bench entry", () => {
    const bench = { home: [...homeBenchBase], away: [...awayBenchBase] };
    const dirtyRedPiece: PlayerPiece = { ...redPiece, yellowCards: 2, injuryCount: 1 };
    const result = relocateRedCardedToBench(bench, dirtyRedPiece);
    const newEntry = result.home[result.home.length - 1]!;
    expect(newEntry.status).toBe('redCarded');
    expect(newEntry.yellowCards).toBe(2);
    expect(newEntry.injuryCount).toBe(1);
  });

  it('ICON-03: coalesces a piece with neither yellowCards nor injuryCount set to 0/0 on the bench entry, never undefined', () => {
    const bench = { home: [...homeBenchBase], away: [...awayBenchBase] };
    // exactOptionalPropertyTypes: omit the keys entirely rather than assign `undefined`.
    const { yellowCards: _y, injuryCount: _i, ...cleanRedPieceRest } = redPiece;
    const cleanRedPiece: PlayerPiece = cleanRedPieceRest;
    const result = relocateRedCardedToBench(bench, cleanRedPiece);
    const newEntry = result.home[result.home.length - 1]!;
    expect(newEntry.yellowCards).toBe(0);
    expect(newEntry.injuryCount).toBe(0);
  });

  it('ICON-03: relocateRedCardedToBench remains idempotent for card/injury fields — a second call does not overwrite the entry', () => {
    const bench = { home: [...homeBenchBase], away: [...awayBenchBase] };
    const dirtyRedPiece: PlayerPiece = { ...redPiece, yellowCards: 2, injuryCount: 1 };
    const once = relocateRedCardedToBench(bench, dirtyRedPiece);
    // A second call for the same playerId — even with different live card/injury values on
    // the piece — must not append a duplicate or mutate the already-recorded entry.
    const evenDirtierPiece: PlayerPiece = { ...dirtyRedPiece, yellowCards: 2, injuryCount: 5 };
    const twice = relocateRedCardedToBench(once, evenDirtierPiece);
    expect(twice.home.length).toBe(once.home.length);
    const entry = twice.home[twice.home.length - 1]!;
    expect(entry.yellowCards).toBe(2);
    expect(entry.injuryCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Task 4 (D-13): resolveFoulChain integration via applyMove
// ---------------------------------------------------------------------------

describe('D-13 integration: a red card relocates through resolveFoulChain/applyMove', () => {
  function foulPiece(
    id: string,
    teamId: 'home' | 'away',
    position: HexCoord,
    over: Partial<PlayerPiece> = {},
  ): PlayerPiece {
    return {
      id,
      teamId,
      position,
      playerId: `${id}-player`,
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

  const d13Carrier = foulPiece('d13-carrier', 'home', { q: 10, r: 7 });
  const d13Cover = foulPiece('d13-defender-cover', 'away', { q: 13, r: 7 }, { pace: 6 });

  function foulState(
    defenderOver: Partial<PlayerPiece> = {},
    stateOver: Partial<GameState> = {},
  ): GameState {
    const defender = foulPiece(
      'd13-defender',
      'away',
      { q: 12, r: 7 },
      { tackling: 4, ...defenderOver },
    );
    return {
      roomCode: 'D13-TEST',
      phase: 'MOVE',
      activeTeam: 'home',
      attackingTeam: 'home',
      pieces: [d13Carrier, defender, d13Cover],
      ball: { position: { q: 10, r: 7 }, carrierId: 'd13-carrier', lastTouchedBy: null },
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
      selectedTeams: { home: HOME_TEAM, away: AWAY_TEAM },
      selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
      gameSpeed: 'standard' as const,
      foulsEnabled: true,
      bookingEnabled: true,
      bench: { home: [], away: [] },
      subsUsed: { home: 0, away: 0 },
      addedTimeBonus: 0,
      ...stateOver,
    };
  }

  /** Drives a foul that produces a straight red via the second-yellow branch (CARD-02 fixture shape). */
  function runRedCardFoul(stateOver: Partial<GameState> = {}) {
    return applyMove(
      foulState({ yellowCards: 1 }, stateOver),
      'd13-carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 4 },
    );
  }

  /**
   * exactOptionalPropertyTypes forbids assigning `bench: undefined` via Partial<GameState>
   * overrides — the key must be absent entirely, not present-and-undefined. Builds the same
   * red-card fixture with the `bench` key omitted from the object altogether.
   */
  function runRedCardFoulWithoutBench() {
    const full = foulState({ yellowCards: 1 });
    const { bench: _omit, ...withoutBench } = full;
    return applyMove(
      withoutBench,
      'd13-carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 4 },
    );
  }

  it("a red-card foul's foulFields.bench (and result.state.bench) contains the new redCarded entry for the fouler's team", () => {
    const result = runRedCardFoul();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fouler = result.state.pieces.find((p) => p.id === 'd13-defender')!;
    expect(fouler.redCarded).toBe(true);
    const benchEntry = result.state.bench?.away.find((e) => e.status === 'redCarded');
    expect(benchEntry).toBeDefined();
    expect(benchEntry?.playerId).toBe(fouler.playerId);
  });

  it('the same call still leaves the fouler in pieces with redCarded:true and onPitch:false (unchanged Phase 39 behaviour)', () => {
    const result = runRedCardFoul();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fouler = result.state.pieces.find((p) => p.id === 'd13-defender')!;
    expect(fouler.redCarded).toBe(true);
    expect(fouler.onPitch).toBe(false);
  });

  it('maxOnPitchFor reports 10 after one red card and 9 after two (D-08 cap math untouched by D-13)', () => {
    const result = runRedCardFoul();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(maxOnPitchFor(result.state.pieces, 'away')).toBe(10);

    const piecesWithSecondRedCard = result.state.pieces.map((p) =>
      p.id === 'd13-defender-cover' ? { ...p, redCarded: true } : p,
    );
    expect(maxOnPitchFor(piecesWithSecondRedCard, 'away')).toBe(9);
  });

  it('a YELLOW-card outcome adds NO bench entry', () => {
    const result = applyMove(
      foulState(),
      'd13-carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 4 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bookingEvent = result.state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
    expect(bookingEvent?.type === 'BOOKING_CHECK' && bookingEvent.card).toBe('yellow');
    expect(result.state.bench?.away.length ?? 0).toBe(0);
  });

  it('a second yellow that becomes a red DOES add the bench entry — keyed on the red outcome, not straight-red-only', () => {
    const result = runRedCardFoul();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bookingEvent = result.state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
    expect(bookingEvent?.type === 'BOOKING_CHECK' && bookingEvent.secondYellow).toBe(true);
    expect(result.state.bench?.away.some((e) => e.status === 'redCarded')).toBe(true);
  });

  it('a foul with bookingEnabled:false adds no bench entry', () => {
    const result = applyMove(
      foulState({ yellowCards: 1 }, { bookingEnabled: false }),
      'd13-carrier',
      { q: 11, r: 7 },
      { stealDie: 1, tackleDie: 3, carrierDie: 3, injuryDie: 3, bookingDie: 4 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bench?.away.length ?? 0).toBe(0);
  });

  it('a red card issued when state.bench is undefined produces a well-formed bench containing exactly the one new entry', () => {
    const result = runRedCardFoulWithoutBench();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bench?.home).toEqual([]);
    expect(result.state.bench?.away.length).toBe(1);
    expect(result.state.bench?.away[0]?.status).toBe('redCarded');
  });

  it('the red-carded bench entry is rejected by applySubstitution with CANNOT_SUB_IN_RED_CARDED (end-to-end tie-in with 40-02 guard 7)', () => {
    const result = runRedCardFoul();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const subState: GameState = { ...result.state, phase: 'KICK_OFF_SETUP' };
    const redEntry = subState.bench!.away.find((e) => e.status === 'redCarded')!;
    const subResult = applySubstitution(subState, 'away', 'd13-defender-cover', redEntry.playerId);
    expect(subResult).toEqual({ ok: false, reason: 'CANNOT_SUB_IN_RED_CARDED' });
  });
});
