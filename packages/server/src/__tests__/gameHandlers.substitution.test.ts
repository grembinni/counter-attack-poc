/**
 * Phase 40 Plan 05 Task 1 (Wave 0, RED state): socket-level integration spec for the
 * `GAME_SUBSTITUTION` handler (SUB-01..07, SETTINGS-04, D-12, D-13). Structure mirrors
 * gameHandlers.cornerKick.test.ts (real Socket.io server + socket.io-client, no mocking;
 * room store seeded directly via getRoom for phase/state manipulation).
 *
 * This suite is EXPECTED to FAIL at this commit — no `GAME_SUBSTITUTION` handler is
 * registered yet, so every emit below times out waiting for its response event. That is
 * the intended RED state (Task 2 implements the handler; Task 3 wires the three
 * handler-side goal-reset roster-continuity sites), not a fixture/type error.
 *
 * Coverage:
 * - SUB-01: success in all 15 STOPPAGE_PHASES (imported from @counter-attack/shared, not
 *   hand-copied), WRONG_PHASE rejection in 5 representative non-stoppage phases.
 * - SUB-01: either manager may act at a stoppage (non-activeTeam socket still succeeds).
 * - T-40-15/D-13: WRONG_TEAM for an opponent-owned outPieceId.
 * - T-40-17: malformed payloads rejected without throwing/mutating (INVALID_SUBSTITUTE).
 * - Every SubstitutionRejection reason (gameEngine.ts `applySubstitution`) surfaces
 *   verbatim as GAME_ERROR: SUB_CAP_REACHED, ALREADY_SUBBED, CANNOT_SUB_RED_CARD,
 *   CANNOT_SUB_IN_RED_CARDED, INVALID_SUBSTITUTE, GK_SLOT_REQUIRES_GK, NON_GK_SLOT_REJECTS_GK.
 * - D-12: an empty bench rejects with INVALID_SUBSTITUTE, never auto-fills.
 * - T-40-16: double-emit mutex increments subsUsed by exactly 1.
 * - SC-5: room.isProcessing is released (finally) after a rejected substitution.
 * - Broadcast GameState eventLog tail is the SUBSTITUTION event for both sockets.
 * - SETTINGS-04: the same success case passes with all four toggles off and all four on.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { buildKickOffPieces } from '../gameEngine.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import type {
  BenchEntry,
  BenchEntryStatus,
  ClientToServerEvents,
  GamePhase,
  GameState,
  PlayerPiece,
  ServerToClientEvents,
} from '@counter-attack/shared';
import {
  ClientEvents,
  ServerEvents,
  STOPPAGE_PHASES,
  MAX_SUBS_PER_TEAM,
  getSquadPlayers,
  PLAYER_POOL,
} from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors gameHandlers.cornerKick.test.ts)
// ---------------------------------------------------------------------------

let httpServer: ReturnType<typeof buildServer>['httpServer'];
let address: string;
const connectedClients: Socket[] = [];

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      resolve();
    });
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
    httpServer.close(() => {
      resolve();
    });
  });
  clearAllRooms();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      reject(new Error(`Timed out waiting for event "${String(event)}" after ${timeoutMs}ms`));
    }, timeoutMs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).once(event, (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args as Parameters<ServerToClientEvents[E]>);
    });
  });
}

/**
 * Waits for `n` GAME_STATE broadcasts on `client` and resolves with all of them in
 * arrival order. Used for the double-emit mutex test, where a second (rejected) emit
 * still produces a broadcast that a single oncePromise would miss.
 */
function waitForNStates(
  client: Socket<ServerToClientEvents, ClientToServerEvents>,
  n: number,
  timeoutMs = 2000,
): Promise<GameState[]> {
  return new Promise((resolve, reject) => {
    const states: GameState[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${n} GAME_STATE broadcasts after ${timeoutMs}ms`));
    }, timeoutMs);
    const handler = (state: GameState): void => {
      states.push(state);
      if (states.length >= n) {
        clearTimeout(timer);
        client.off(ServerEvents.GAME_STATE, handler);
        resolve(states);
      }
    };
    client.on(ServerEvents.GAME_STATE, handler);
  });
}

function waitForConnect(
  client: Socket<ServerToClientEvents, ClientToServerEvents>,
  timeoutMs = 2000,
): Promise<void> {
  if (client.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Client did not connect within timeout')),
      timeoutMs,
    );
    client.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    client.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Creates a room with 2 connected clients and completes team selection through
 * LINEUP_CONFIRM. clientA = slot 1 = 'home' = 'city'; clientB = slot 2 = 'away' = 'crew'
 * (project-wide convention). `toggles` defaults to all four v1.6 game-creation toggles
 * OFF (confirmDefaultRoomSettings); pass `{ on: true }` for the SETTINGS-04 all-on case.
 */
async function setupRoom(opts?: { toggles?: 'off' | 'on' }): Promise<{
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

  if (opts?.toggles === 'on') {
    const confirmedPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ROOM_SETTINGS_CONFIRMED timeout')), 1000);
      clientA.once(ServerEvents.ROOM_SETTINGS_CONFIRMED, () => {
        clearTimeout(timer);
        resolve();
      });
    });
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
    });
    await confirmedPromise;
  } else {
    await confirmDefaultRoomSettings(clientA);
  }

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

// ---------------------------------------------------------------------------
// Substitution fixture data — real pool ids, mirrors gameEngine.substitution.test.ts's
// BASE_PIECES/bench construction so this file needs no reliance on plan 40-04's
// (parallel, wave-3) LINEUP_CONFIRM bench-seeding work.
// ---------------------------------------------------------------------------

const HOME_TEAM_ID = 'city' as const;
const AWAY_TEAM_ID = 'crew' as const;

const homeXI = getSquadPlayers(HOME_TEAM_ID);
const awayXI = getSquadPlayers(AWAY_TEAM_ID);
const homeXIIds = new Set(homeXI.map((p) => p.id));
const awayXIIds = new Set(awayXI.map((p) => p.id));
const freeAgents = PLAYER_POOL.filter(
  (p) => p.sourceTeamId === 'free-agent' && !homeXIIds.has(p.id) && !awayXIIds.has(p.id),
);
const freeAgentGKs = freeAgents.filter((p) => p.role === 'GK');
const freeAgentOutfielders = freeAgents.filter((p) => p.role !== 'GK');

const HOME_BENCH_BASE: readonly BenchEntry[] = [
  { playerId: freeAgentOutfielders[0]!.id, jerseyNumber: 20, status: 'available' },
  { playerId: freeAgentOutfielders[1]!.id, jerseyNumber: 21, status: 'available' },
  { playerId: freeAgentGKs[0]!.id, jerseyNumber: 22, status: 'available' },
];
const AWAY_BENCH_BASE: readonly BenchEntry[] = [
  { playerId: freeAgentOutfielders[2]!.id, jerseyNumber: 20, status: 'available' },
  { playerId: freeAgentOutfielders[3]!.id, jerseyNumber: 21, status: 'available' },
  { playerId: freeAgentGKs[1]!.id, jerseyNumber: 22, status: 'available' },
];

type BenchStatusOverride = { team: 'home' | 'away'; index: 0 | 1 | 2; status: BenchEntryStatus };

/**
 * Seeds `room.gameState` directly for a substitution scenario: real 22 pieces (stamped
 * with `playerId`, matching gameEngine.substitution.test.ts's BASE_PIECES approach since
 * `buildKickOffPieces` itself does not yet stamp `playerId` — that wiring is plan 40-04),
 * a 3-entry bench per team, and the given `phase`/`subsUsed`/`activeTeam`.
 */
function seedSubState(
  roomCode: string,
  phase: GamePhase,
  opts?: {
    activeTeam?: 'home' | 'away';
    subsUsed?: { home: number; away: number };
    benchOverride?: BenchStatusOverride;
    emptyBenchTeam?: 'home' | 'away';
    redCardOutgoingTeam?: 'home' | 'away';
  },
): {
  homeOutfield: PlayerPiece;
  homeGK: PlayerPiece;
  awayOutfield: PlayerPiece;
  awayGK: PlayerPiece;
  homeBench: BenchEntry[];
  awayBench: BenchEntry[];
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const basePieces = buildKickOffPieces(
    'home',
    room.gameState.selectedTeams,
    room.gameState.selectedFormation,
  );
  let pieces: PlayerPiece[] = basePieces.map((piece, idx) => {
    const isHome = piece.teamId === 'home';
    const squad = isHome ? homeXI : awayXI;
    const squadIdx = isHome ? idx : idx - 11;
    return { ...piece, playerId: squad[squadIdx]!.id };
  });

  if (opts?.redCardOutgoingTeam) {
    const team = opts.redCardOutgoingTeam;
    let marked = false;
    pieces = pieces.map((p) => {
      if (!marked && p.teamId === team && p.role !== 'GK') {
        marked = true;
        return { ...p, redCarded: true };
      }
      return p;
    });
  }

  let homeBench: BenchEntry[] = HOME_BENCH_BASE.map((e) => ({ ...e }));
  let awayBench: BenchEntry[] = AWAY_BENCH_BASE.map((e) => ({ ...e }));
  if (opts?.benchOverride) {
    const { team, index, status } = opts.benchOverride;
    if (team === 'home') homeBench[index] = { ...homeBench[index]!, status };
    else awayBench[index] = { ...awayBench[index]!, status };
  }
  if (opts?.emptyBenchTeam === 'home') homeBench = [];
  if (opts?.emptyBenchTeam === 'away') awayBench = [];

  room.gameState = {
    ...room.gameState,
    phase,
    pieces,
    bench: { home: homeBench, away: awayBench },
    subsUsed: opts?.subsUsed ?? { home: 0, away: 0 },
    addedTimeBonus: 0,
    addedTime: null,
    activeTeam: opts?.activeTeam ?? room.gameState.activeTeam,
  };

  const homeOutfield = pieces.find(
    (p) => p.teamId === 'home' && p.role !== 'GK' && p.redCarded !== true,
  )!;
  const homeGK = pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const awayOutfield = pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;
  const awayGK = pieces.find((p) => p.teamId === 'away' && p.role === 'GK')!;

  return { homeOutfield, homeGK, awayOutfield, awayGK, homeBench, awayBench };
}

// ---------------------------------------------------------------------------
// SUB-01: stoppage-phase gate
// ---------------------------------------------------------------------------

describe('SUB-01: GAME_SUBSTITUTION succeeds in every STOPPAGE_PHASES entry', () => {
  it.each(STOPPAGE_PHASES)('succeeds during %s', async (phase) => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, phase, { activeTeam: 'home' });

    const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [[stateA], [stateB]] = await Promise.all([statePromiseA, statePromiseB]);

    expect(stateA.subsUsed?.home).toBe(1);
    expect(stateB.subsUsed?.home).toBe(1);
    expect(stateA.phase).toBe(phase);
    expect(stateA.pieces.find((p) => p.id === homeOutfield.id)!.playerId).toBe(
      HOME_BENCH_BASE[0]!.playerId,
    );
  });
});

describe('SUB-01: GAME_SUBSTITUTION rejects WRONG_PHASE outside every stoppage', () => {
  const NON_STOPPAGE_PHASES: GamePhase[] = [
    'MOVE',
    'PASS',
    'GK_RESTART',
    'PENALTY_KICK',
    'FOUL_CHOICE',
  ];

  it.each(NON_STOPPAGE_PHASES)('rejects with WRONG_PHASE during %s', async (phase) => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield, homeBench } = seedSubState(roomCode, phase, { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe(phase);
    expect(getRoom(roomCode)!.gameState!.bench).toEqual({
      home: homeBench,
      away: expect.any(Array),
    });
    expect(getRoom(roomCode)!.gameState!.subsUsed).toEqual({ home: 0, away: 0 });
  });
});

describe('SUB-01: either manager may substitute at a stoppage', () => {
  it('the socket whose team is NOT activeTeam still succeeds', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { awayOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: awayOutfield.id,
      inPlayerId: AWAY_BENCH_BASE[0]!.playerId,
    });
    const [state] = await statePromise;

    expect(state.subsUsed?.away).toBe(1);
    expect(state.pieces.find((p) => p.id === awayOutfield.id)!.playerId).toBe(
      AWAY_BENCH_BASE[0]!.playerId,
    );
  });
});

// ---------------------------------------------------------------------------
// T-40-15: ownership guard
// ---------------------------------------------------------------------------

describe('T-40-15: WRONG_TEAM for an opponent-owned outPieceId', () => {
  it('a socket emitting with an outPieceId belonging to the opponent receives WRONG_TEAM', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { awayOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: awayOutfield.id,
      inPlayerId: AWAY_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.subsUsed).toEqual({ home: 0, away: 0 });
  });
});

// ---------------------------------------------------------------------------
// T-40-17: malformed payloads
// ---------------------------------------------------------------------------

describe('T-40-17: malformed payloads are rejected without throwing or mutating state', () => {
  it('missing outPieceId is rejected with INVALID_SUBSTITUTE', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_SUBSTITUTION, {
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SUBSTITUTE');
    expect(getRoom(roomCode)!.gameState!.subsUsed).toEqual({ home: 0, away: 0 });
  });

  it('empty outPieceId is rejected with INVALID_SUBSTITUTE', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: '',
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SUBSTITUTE');
  });

  it('wrong-typed outPieceId (number) is rejected with INVALID_SUBSTITUTE', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: 12345,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SUBSTITUTE');
  });

  it('missing inPlayerId is rejected with INVALID_SUBSTITUTE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_SUBSTITUTION, { outPieceId: homeOutfield.id });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SUBSTITUTE');
  });

  it('empty inPlayerId is rejected with INVALID_SUBSTITUTE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, { outPieceId: homeOutfield.id, inPlayerId: '' });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SUBSTITUTE');
  });

  it('wrong-typed inPlayerId (object) is rejected with INVALID_SUBSTITUTE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: { bad: true },
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SUBSTITUTE');
  });

  it('a non-object payload is rejected with INVALID_SUBSTITUTE and does not throw', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_SUBSTITUTION, null);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SUBSTITUTE');
  });
});

// ---------------------------------------------------------------------------
// Engine rejection reasons surface verbatim
// ---------------------------------------------------------------------------

describe('Engine SubstitutionRejection reasons reach the client verbatim', () => {
  it('SUB_CAP_REACHED when subsUsed[team] is already at MAX_SUBS_PER_TEAM', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', {
      activeTeam: 'home',
      subsUsed: { home: MAX_SUBS_PER_TEAM, away: 0 },
    });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('SUB_CAP_REACHED');
  });

  it('ALREADY_SUBBED when the bench entry is already subbedOut (SUB-07)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', {
      activeTeam: 'home',
      benchOverride: { team: 'home', index: 0, status: 'subbedOut' },
    });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('ALREADY_SUBBED');
  });

  it('CANNOT_SUB_RED_CARD when the OUTGOING on-pitch piece has been sent off (SUB-06/D-09)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedSubState(roomCode, 'HALF_TIME', {
      activeTeam: 'home',
      redCardOutgoingTeam: 'home',
    });
    const redCardedPiece = getRoom(roomCode)!.gameState!.pieces.find(
      (p) => p.teamId === 'home' && p.redCarded === true,
    )!;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: redCardedPiece.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('CANNOT_SUB_RED_CARD');
  });

  it('CANNOT_SUB_IN_RED_CARDED when the INCOMING bench entry is a sent-off player (D-13)', async () => {
    // D-13: seed the bench entry's status directly rather than driving a real foul chain —
    // this file's job is proving the reason string reaches the client verbatim.
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', {
      activeTeam: 'home',
      benchOverride: { team: 'home', index: 0, status: 'redCarded' },
    });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('CANNOT_SUB_IN_RED_CARDED');
  });

  it('INVALID_SUBSTITUTE when inPlayerId is not found on the bench', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: 'p999-not-on-bench',
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SUBSTITUTE');
  });

  it('GK_SLOT_REQUIRES_GK when subbing a non-GK into the GK slot', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGK } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeGK.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId, // an outfield free agent
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('GK_SLOT_REQUIRES_GK');
  });

  it('NON_GK_SLOT_REJECTS_GK when subbing a GK into a non-GK slot', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[2]!.playerId, // the seeded bench GK
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('NON_GK_SLOT_REJECTS_GK');
  });
});

// ---------------------------------------------------------------------------
// D-12: empty bench never auto-fills
// ---------------------------------------------------------------------------

describe('D-12: an EMPTY bench[team] rejects every substitution attempt', () => {
  it('rejects with INVALID_SUBSTITUTE and neither throws nor generates a substitute', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', {
      activeTeam: 'home',
      emptyBenchTeam: 'home',
    });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SUBSTITUTE');
    expect(getRoom(roomCode)!.gameState!.bench!.home).toEqual([]);
    expect(
      getRoom(roomCode)!.gameState!.pieces.find((p) => p.id === homeOutfield.id)!.playerId,
    ).toBe(homeOutfield.playerId);
  });
});

// ---------------------------------------------------------------------------
// T-40-16: double-emit mutex
// ---------------------------------------------------------------------------

describe('T-40-16: double-emit mutex — a double-clicked substitution is applied exactly once', () => {
  it('two back-to-back identical emits increment subsUsed by exactly 1 for that team', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const statesPromise = waitForNStates(clientA, 2);
    const payload = { outPieceId: homeOutfield.id, inPlayerId: HOME_BENCH_BASE[0]!.playerId };
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, payload);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, payload);
    const states = await statesPromise;

    expect(states[states.length - 1]!.subsUsed?.home).toBe(1);
    expect(getRoom(roomCode)!.gameState!.subsUsed?.home).toBe(1);
    expect(getRoom(roomCode)!.isProcessing).toBe(false);

    const subEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'SUBSTITUTION',
    );
    expect(subEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// SC-5: isProcessing released after a rejected substitution
// ---------------------------------------------------------------------------

describe('SC-5: room.isProcessing is released after a REJECTED substitution', () => {
  it('a subsequent legal substitution still works after a rejected attempt', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'MOVE', { activeTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    await errorPromise;

    expect(getRoom(roomCode)!.isProcessing).toBe(false);

    // Move the room into a legal stoppage and confirm the mutex was truly released.
    const room = getRoom(roomCode)!;
    room.gameState = { ...room.gameState!, phase: 'HALF_TIME' };

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [state] = await statePromise;

    expect(state.subsUsed?.home).toBe(1);
    expect(getRoom(roomCode)!.isProcessing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Broadcast shape
// ---------------------------------------------------------------------------

describe('Broadcast GameState carries the SUBSTITUTION event on both sockets', () => {
  it('both clients receive a broadcast GameState whose eventLog tail is SUBSTITUTION', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });

    const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [[stateA], [stateB]] = await Promise.all([statePromiseA, statePromiseB]);

    expect(stateA.eventLog[stateA.eventLog.length - 1]!.type).toBe('SUBSTITUTION');
    expect(stateB.eventLog[stateB.eventLog.length - 1]!.type).toBe('SUBSTITUTION');
  });
});

// ---------------------------------------------------------------------------
// SETTINGS-04: substitution reads none of the four v1.6 toggles
// ---------------------------------------------------------------------------

describe('SETTINGS-04: substitution succeeds regardless of the four v1.6 toggle states', () => {
  it('succeeds with all four toggles OFF', async () => {
    const { clientA, roomCode } = await setupRoom({ toggles: 'off' });
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });
    expect(getRoom(roomCode)!.gameState!.foulsEnabled).toBe(false);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [state] = await statePromise;

    expect(state.subsUsed?.home).toBe(1);
  });

  it('succeeds with all four toggles ON', async () => {
    const { clientA, roomCode } = await setupRoom({ toggles: 'on' });
    const { homeOutfield } = seedSubState(roomCode, 'HALF_TIME', { activeTeam: 'home' });
    expect(getRoom(roomCode)!.gameState!.foulsEnabled).toBe(true);
    expect(getRoom(roomCode)!.gameState!.bookingEnabled).toBe(true);
    expect(getRoom(roomCode)!.gameState!.injuryEnabled).toBe(true);
    expect(getRoom(roomCode)!.gameState!.outOfBoundsEnabled).toBe(true);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: homeOutfield.id,
      inPlayerId: HOME_BENCH_BASE[0]!.playerId,
    });
    const [state] = await statePromise;

    expect(state.subsUsed?.home).toBe(1);
  });
});
