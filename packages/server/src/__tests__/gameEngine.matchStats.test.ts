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
//
// The S1/S2 (applyRoll/applyPenaltyKickDuel) tests above call the pure engine functions
// directly with explicit dice arguments — they never touch `rollDice()` and are therefore
// unaffected by the module-level dice mock below, which only exists for the S3-S7
// handler-level describe block (those sites call `rollDice()` internally via the socket
// handlers in gameHandlers.ts). Mirrors the shotGkRange.test.ts convention.
import { vi } from 'vitest';
vi.mock('../diceUtils.js', () => ({ rollDice: () => 3 }));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { applyRoll, applyPenaltyKickDuel } from '../gameEngine.js';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import type {
  GameState,
  PlayerPiece,
  MatchStats,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@counter-attack/shared';
import {
  computeShotXg,
  PENALTY_SPOT,
  ClientEvents,
  ServerEvents,
  computeBallZone,
} from '@counter-attack/shared';

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

// ---------------------------------------------------------------------------
// Handler-level sites S3-S7 (gameHandlers.ts) — full Socket.io integration harness,
// mirroring shotGkRange.test.ts's server lifecycle / setupRoom / dice-mock conventions.
// These sites live inside socket event handler closures, not exported pure functions,
// so a real client/server round-trip is the only way to exercise them.
// ---------------------------------------------------------------------------

let httpServer: ReturnType<typeof buildServer>['httpServer'];
let address: string;
const connectedClients: Socket[] = [];

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  const addr = httpServer.address() as { port: number };
  address = `http://localhost:${addr.port}`;
});

afterEach(async () => {
  for (const client of connectedClients) {
    if (client.connected) client.disconnect();
  }
  connectedClients.length = 0;
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
  clearAllRooms();
});

function createClient(): Socket<ServerToClientEvents, ClientToServerEvents> {
  const client = ioClient(address, {
    transports: ['websocket'],
    forceNew: true,
  }) as Socket<ServerToClientEvents, ClientToServerEvents>;
  connectedClients.push(client);
  return client;
}

function oncePromise<E extends keyof ServerToClientEvents>(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  event: E,
  timeoutMs = 2000,
): Promise<Parameters<ServerToClientEvents[E]>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for "${String(event)}"`));
    }, timeoutMs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).once(event, (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args as Parameters<ServerToClientEvents[E]>);
    });
  });
}

function waitForConnect(client: Socket<ServerToClientEvents, ClientToServerEvents>): Promise<void> {
  if (client.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('connect_error', (err) => reject(err));
  });
}

async function setupRoom(): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  roomCode: string;
  state: GameState;
}> {
  const clientA = createClient();
  const clientB = createClient();
  await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

  const createPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
  clientA.emit(ClientEvents.ROOM_CREATE);
  const [roomCode] = await createPromise;

  await confirmDefaultRoomSettings(clientA);

  const selectionStartPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  await selectionStartPromise;

  const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED);
  clientA.emit(ClientEvents.TEAM_PICK, 'city');
  await homePickedPromise;
  const uniformStartPromise = oncePromise(clientA, ServerEvents.UNIFORM_SELECTION_START);
  clientB.emit(ClientEvents.TEAM_PICK, 'crew');
  await uniformStartPromise;
  const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED);
  clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
  await homeConfirmedPromise;
  const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
  const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
  const readyAPromise = oncePromise(clientA, ServerEvents.LINEUP_ASSIGNMENT_READY);
  const readyBPromise = oncePromise(clientB, ServerEvents.LINEUP_ASSIGNMENT_READY);
  clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');
  const [homeAssignment] = await readyAPromise;
  await readyBPromise;
  clientA.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: homeAssignment });
  clientB.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: homeAssignment });
  const [[state]] = await Promise.all([statePromiseA, statePromiseB]);

  return { clientA, clientB, roomCode, state };
}

describe('Handler-level shot/xG capture (S3-S7, STATS-07/08)', () => {
  it('S3 — snapshot deflected by a defender: shots[home] += 1, xg[home] += computeShotXg(pre-shot pieces)', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const carrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    const otherAway = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!carrier || !awayGK || otherAway.length === 0) throw new Error('Required pieces not found');

    // Snapshot's own range gate (applyDeclareShot) caps the shot at 6 hexes from goal, so
    // the shooter is necessarily inside/at the edge of awayPenaltyArea (q>=31) — the
    // deflected ball landing there can legitimately trigger a downstream GK_BOX_ENTRY_PROMPT
    // interrupt (Phase 39), which is expected production behavior, not a test artifact. The
    // phase assertion below therefore accepts either terminal phase; matchStats survives the
    // interrupt regardless since it's already on the state object before that check runs.
    const carrierPos = { q: 30, r: 13 };
    // On the straight q-line path from carrierPos to the goal target — band 'A' (on path).
    // tackling=10 with the mocked die=3 guarantees deflection (3+10=13 >= 10).
    const blockerPos = { q: 33, r: 13 };
    const blocker = otherAway[0]!;

    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: null,
      ball: { position: carrierPos, carrierId: carrier.id, lastTouchedBy: null },
      ballZone: computeBallZone(carrierPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === carrier.id) return { ...p, position: carrierPos };
        if (p.id === blocker.id) return { ...p, position: blockerPos, tackling: 10 };
        if (p.id === awayGK.id) return { ...p, position: { q: 5, r: 0 } };
        return p;
      }),
    };
    room.lastBroadcastBallPosition = carrierPos;

    // Snapshot flow: GAME_SHOT from SNAPSHOT_TARGET -> SNAPSHOT_DEFLECT, then
    // GAME_END_TURN by the defending team runs the deflection check (S3).
    room.gameState = { ...room.gameState, phase: 'SNAPSHOT_TARGET', lastActionType: 'SNAPSHOT' };
    const prePieces = room.gameState.pieces;

    const declarePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declarePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [[declaredState]] = await Promise.all([declarePromiseA, declarePromiseB]);
    expect(declaredState.phase).toBe('SNAPSHOT_DEFLECT');
    // Confirm the shot has NOT been counted yet at declare time (only the end-turn
    // deflection check below records it) — guards against a future double-count regression.
    expect(declaredState.matchStats?.shots.home).toBe(0);

    const endTurnPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [state] = await endTurnPromise;

    // Deflection always leaves the ball loose (carrierId null); the terminal phase is
    // LOOSE_BALL unless the landing hex triggers a GK_BOX_ENTRY_PROMPT interrupt (both
    // are legitimate outcomes of a deflection this close to goal — see comment above).
    expect(['LOOSE_BALL', 'GK_BOX_ENTRY_PROMPT']).toContain(state.phase);
    expect(state.ball.carrierId).toBeNull();
    const expectedXg = computeShotXg(
      carrierPos,
      'home',
      prePieces.filter((p) => p.teamId === 'away'),
    );
    expect(state.matchStats?.shots.home).toBe(1);
    expect(state.matchStats?.shots.away).toBe(0);
    expect(state.matchStats?.xg.home).toBeCloseTo(expectedXg, 10);
  });

  it('S4 — snapshot GK out of range auto-goal: shots[home] += 1, xg[home] += computeShotXg(pre-reset pieces)', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const carrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    const otherAway = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!carrier || !awayGK) throw new Error('Required pieces not found');

    const carrierPos = { q: 33, r: 13 };
    const gkPos = { q: 5, r: 0 }; // far from goal-line path — GK out of range

    room.gameState = {
      ...room.gameState,
      phase: 'SNAPSHOT_TARGET',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: 'SNAPSHOT',
      ball: { position: carrierPos, carrierId: carrier.id, lastTouchedBy: null },
      ballZone: computeBallZone(carrierPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === carrier.id) return { ...p, position: carrierPos };
        if (p.id === awayGK.id) return { ...p, position: gkPos };
        if (otherAway.some((d) => d.id === p.id)) return { ...p, position: { q: 4, r: 0 } };
        return p;
      }),
    };
    room.lastBroadcastBallPosition = carrierPos;
    const prePieces = room.gameState.pieces;

    const declarePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declarePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [[declaredState]] = await Promise.all([declarePromiseA, declarePromiseB]);
    expect(declaredState.phase).toBe('SNAPSHOT_DEFLECT');

    const endTurnPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [state] = await endTurnPromise;

    expect(state.phase).toBe('KICK_OFF_SETUP');
    expect(state.score.home).toBe(1);
    const expectedXg = computeShotXg(
      carrierPos,
      'home',
      prePieces.filter((p) => p.teamId === 'away'),
    );
    expect(state.matchStats?.shots.home).toBe(1);
    expect(state.matchStats?.xg.home).toBeCloseTo(expectedXg, 10);
  });

  it('S5 — declared shot deflected by a defender: shots[home] += 1, xg[home] += computeShotXg(pre-shot pieces)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const carrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    const otherAway = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!carrier || !awayGK || otherAway.length === 0) throw new Error('Required pieces not found');

    // Regular declared shots have an 11-hex range gate (vs. snapshot's 6-hex gate), so
    // unlike S3 above, both the shooter and the on-path defender can stay well outside
    // awayPenaltyArea (q>=31) here — the deflection landing hex never enters the box, so
    // no downstream GK_BOX_ENTRY_PROMPT interrupt fires and the terminal phase is
    // deterministically LOOSE_BALL.
    const carrierPos = { q: 25, r: 13 }; // distance to goal (36,13) = 11, within range
    const blockerPos = { q: 28, r: 13 }; // on the q-line path, band 'A', still outside the box
    const blocker = otherAway[0]!;

    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: null,
      ball: { position: carrierPos, carrierId: carrier.id, lastTouchedBy: null },
      ballZone: computeBallZone(carrierPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === carrier.id) return { ...p, position: carrierPos };
        if (p.id === blocker.id) return { ...p, position: blockerPos, tackling: 10 };
        if (p.id === awayGK.id) return { ...p, position: { q: 5, r: 0 } };
        return p;
      }),
    };
    room.lastBroadcastBallPosition = carrierPos;
    const prePieces = room.gameState.pieces;

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [state] = await statePromise;

    // The DEFLECTED branch always leaves the ball loose (carrierId null) before any
    // further downstream routing (e.g. an incidental offside-relocation interrupt) — the
    // capture point under test is that single state write, not the eventual terminal
    // phase, so this test asserts on carrierId rather than a specific phase string.
    expect(state.phase).not.toBe('PASS');
    expect(state.ball.carrierId).toBeNull();
    const expectedXg = computeShotXg(
      carrierPos,
      'home',
      prePieces.filter((p) => p.teamId === 'away'),
    );
    expect(state.matchStats?.shots.home).toBe(1);
    expect(state.matchStats?.shots.away).toBe(0);
    expect(state.matchStats?.xg.home).toBeCloseTo(expectedXg, 10);
  });

  it('S6 — declared shot GK out of range auto-goal: shots[home] += 1, xg[home] += computeShotXg(pre-reset pieces)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const homeCarrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    if (!homeCarrier || !awayGK) throw new Error('Required pieces not found');

    const carrierPos = { q: 30, r: 13 };
    const gkPos = { q: 5, r: 0 }; // far away — >3 hexes from any hex on the q=36 path

    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: null,
      ball: { position: carrierPos, carrierId: homeCarrier.id, lastTouchedBy: null },
      ballZone: computeBallZone(carrierPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeCarrier.id) return { ...p, position: carrierPos };
        if (p.id === awayGK.id) return { ...p, position: gkPos };
        return p;
      }),
    };
    room.lastBroadcastBallPosition = carrierPos;
    const prePieces = room.gameState.pieces;

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [state] = await statePromise;

    expect(state.phase).toBe('KICK_OFF_SETUP');
    expect(state.score.home).toBe(1);
    const expectedXg = computeShotXg(
      carrierPos,
      'home',
      prePieces.filter((p) => p.teamId === 'away'),
    );
    expect(state.matchStats?.shots.home).toBe(1);
    expect(state.matchStats?.xg.home).toBeCloseTo(expectedXg, 10);
  });

  it('S7 — headed shot GK out of range auto-goal: shots[home] += 1, xg[home] += computeShotXg(pre-reset pieces)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    if (!homeAttacker || !awayGK) throw new Error('Required pieces not found');

    const attackerPos = { q: 33, r: 13 };
    const gkPos = { q: 5, r: 0 };

    room.gameState = {
      ...room.gameState,
      phase: 'HEADER',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: 'HIGH_PASS',
      ball: { position: attackerPos, carrierId: null, lastTouchedBy: null },
      ballZone: computeBallZone(attackerPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeAttacker.id) return { ...p, position: attackerPos };
        if (p.id === awayGK.id) return { ...p, position: gkPos };
        return p;
      }),
      headerContestants: { home: [homeAttacker.id], away: [] },
      headerConfirmed: { home: true, away: true },
      headerAccuracyRollPending: null,
      headerDuelWinner: 'home',
    };
    room.lastBroadcastBallPosition = attackerPos;
    const prePieces = room.gameState.pieces;

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_TARGET, { q: 36, r: 13 });
    const [state] = await statePromise;

    expect(state.phase).toBe('KICK_OFF_SETUP');
    expect(state.score.home).toBe(1);
    const expectedXg = computeShotXg(
      attackerPos,
      'home',
      prePieces.filter((p) => p.teamId === 'away'),
    );
    expect(state.matchStats?.shots.home).toBe(1);
    expect(state.matchStats?.xg.home).toBeCloseTo(expectedXg, 10);
  });

  it('no-double-count: a shot that survives deflection and resolves through the GK duel (S1) increments shots by exactly 1, not 2', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const homeCarrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    if (!homeCarrier || !awayGK) throw new Error('Required pieces not found');

    const carrierPos = { q: 30, r: 13 };
    const gkPos = { q: 36, r: 13 }; // on the declared goal hex — distance 0, in range, no deflectors

    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: null,
      ball: { position: carrierPos, carrierId: homeCarrier.id, lastTouchedBy: null },
      ballZone: computeBallZone(carrierPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeCarrier.id) return { ...p, position: carrierPos, shooting: 1 };
        if (p.id === awayGK.id) return { ...p, position: gkPos, saving: 10, handling: 10 };
        // Move every other away piece far from the path so no deflection can fire (S5 stays silent).
        if (p.teamId === 'away') return { ...p, position: { q: 4, r: 0 } };
        return p;
      }),
    };
    room.lastBroadcastBallPosition = carrierPos;

    const declarePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declarePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [[declaredState]] = await Promise.all([declarePromiseA, declarePromiseB]);
    expect(declaredState.phase).toBe('GK_DIVE');
    // Not yet counted — declaring/surviving deflection never increments; only the S1
    // duel resolution (after GAME_GK_DIVE) does.
    expect(declaredState.matchStats?.shots.home).toBe(0);

    const divePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_GK_DIVE, { q: 36, r: 13 });
    const [finalState] = await divePromise;

    // Deterministic dice (3) + gk.saving=10 vs shooter.shooting=1 -> SAVE; handling
    // die(3) < gk.handling(10) -> caught -> GK_RESTART. The exact outcome doesn't matter
    // for this test — only that the total increment across the whole flow is exactly 1.
    expect(finalState.phase).toBe('GK_RESTART');
    expect(finalState.matchStats?.shots.home).toBe(1);
    expect(finalState.matchStats?.shots.away).toBe(0);
  });
});
