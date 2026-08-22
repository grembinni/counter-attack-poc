/**
 * Phase 42 Plan 06 Task 3 (SUB-08): socket-level integration spec for the
 * `GAME_ROSTER_REPOSITION` handler. Structure mirrors gameHandlers.substitution.test.ts
 * (real Socket.io server + socket.io-client, no mocking; room store seeded directly via
 * getRoom for phase/state manipulation).
 *
 * Coverage:
 * - Happy path during a stoppage: state mutates and a snapshot is broadcast to the room.
 * - Outside a stoppage: GAME_ERROR 'WRONG_PHASE', state unchanged.
 * - Malformed payloads (null, non-object, missing field, empty string, non-string):
 *   GAME_ERROR 'INVALID_REPOSITION', no throw, state unchanged.
 * - Opponent-owned piece id: GAME_ERROR 'WRONG_TEAM', state unchanged.
 * - Non-active team during a stoppage still succeeds (proving socketTeam not isActivePlayer).
 * - isProcessing mutex: a second event while isProcessing === true is a no-op.
 * - GK slot rejection reaches the client as 'GK_SLOT_LOCKED' verbatim from the engine.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { buildKickOffPieces } from '../gameEngine.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import type {
  ClientToServerEvents,
  GamePhase,
  GameState,
  PlayerPiece,
  ServerToClientEvents,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents, getSquadPlayers } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors gameHandlers.substitution.test.ts)
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

const HOME_TEAM_ID = 'city' as const;
const AWAY_TEAM_ID = 'crew' as const;
const homeXI = getSquadPlayers(HOME_TEAM_ID);
const awayXI = getSquadPlayers(AWAY_TEAM_ID);

/** Seeds `room.gameState.pieces`/`phase` directly for a reposition scenario. */
function seedRepoState(
  roomCode: string,
  phase: GamePhase,
  opts?: { activeTeam?: 'home' | 'away'; ballCarrierId?: string },
): {
  homeOutfieldA: PlayerPiece;
  homeOutfieldB: PlayerPiece;
  homeGK: PlayerPiece;
  awayOutfieldA: PlayerPiece;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const basePieces = buildKickOffPieces(
    'home',
    room.gameState.selectedTeams,
    room.gameState.selectedFormation,
  );
  const pieces: PlayerPiece[] = basePieces.map((piece, idx) => {
    const isHome = piece.teamId === 'home';
    const squad = isHome ? homeXI : awayXI;
    const squadIdx = isHome ? idx : idx - 11;
    return { ...piece, playerId: squad[squadIdx]!.id };
  });

  room.gameState = {
    ...room.gameState,
    phase,
    pieces,
    activeTeam: opts?.activeTeam ?? room.gameState.activeTeam,
    ball: {
      ...room.gameState.ball,
      carrierId: opts?.ballCarrierId ?? null,
    },
  };

  const homeOutfield = pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const homeGK = pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;

  return {
    homeOutfieldA: homeOutfield[0]!,
    homeOutfieldB: homeOutfield[1]!,
    homeGK,
    awayOutfieldA: awayOutfield[0]!,
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('GAME_ROSTER_REPOSITION: happy path during a stoppage', () => {
  it('swaps two same-team on-field pieces and broadcasts the new state', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { homeOutfieldA, homeOutfieldB } = seedRepoState(roomCode, 'HALF_TIME', {
      activeTeam: 'home',
    });

    const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROSTER_REPOSITION, {
      pieceIdA: homeOutfieldA.id,
      pieceIdB: homeOutfieldB.id,
    });
    const [[stateA], [stateB]] = await Promise.all([statePromiseA, statePromiseB]);

    expect(stateA.pieces.find((p) => p.id === homeOutfieldA.id)!.playerId).toBe(
      homeOutfieldB.playerId,
    );
    expect(stateB.pieces.find((p) => p.id === homeOutfieldB.id)!.playerId).toBe(
      homeOutfieldA.playerId,
    );
    const repoEvents = stateA.eventLog.filter((e) => e.type === 'ROSTER_REPOSITION');
    expect(repoEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// WRONG_PHASE
// ---------------------------------------------------------------------------

describe('GAME_ROSTER_REPOSITION: outside a stoppage', () => {
  it('rejects with WRONG_PHASE and leaves state unchanged', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfieldA, homeOutfieldB } = seedRepoState(roomCode, 'MOVE', {
      activeTeam: 'home',
    });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROSTER_REPOSITION, {
      pieceIdA: homeOutfieldA.id,
      pieceIdB: homeOutfieldB.id,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
    const stateAfter = getRoom(roomCode)!.gameState!;
    expect(stateAfter.pieces.find((p) => p.id === homeOutfieldA.id)!.playerId).toBe(
      homeOutfieldA.playerId,
    );
  });
});

// ---------------------------------------------------------------------------
// Malformed payloads
// ---------------------------------------------------------------------------

describe('GAME_ROSTER_REPOSITION: malformed payloads', () => {
  const cases: Array<{ label: string; payload: unknown }> = [
    { label: 'null payload', payload: null },
    { label: 'non-object payload', payload: 'not-an-object' },
    { label: 'missing pieceIdB', payload: { pieceIdA: 'home-1' } },
    { label: 'empty pieceIdA', payload: { pieceIdA: '', pieceIdB: 'home-2' } },
    { label: 'non-string pieceIdB', payload: { pieceIdA: 'home-1', pieceIdB: 42 } },
  ];

  it.each(cases)(
    '$label is rejected with INVALID_REPOSITION, no throw, state unchanged',
    async ({ payload }) => {
      const { clientA, roomCode } = await setupRoom();
      const { homeOutfieldA } = seedRepoState(roomCode, 'HALF_TIME', { activeTeam: 'home' });
      const beforePlayerId = homeOutfieldA.playerId;

      const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (clientA as any).emit(ClientEvents.GAME_ROSTER_REPOSITION, payload);
      const [reason] = await errorPromise;

      expect(reason).toBe('INVALID_REPOSITION');
      const stateAfter = getRoom(roomCode)!.gameState!;
      expect(stateAfter.pieces.find((p) => p.id === homeOutfieldA.id)!.playerId).toBe(
        beforePlayerId,
      );
      expect(getRoom(roomCode)!.isProcessing).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// WRONG_TEAM
// ---------------------------------------------------------------------------

describe('GAME_ROSTER_REPOSITION: opponent-owned piece id', () => {
  it('rejects with WRONG_TEAM and leaves state unchanged', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfieldA, awayOutfieldA } = seedRepoState(roomCode, 'HALF_TIME', {
      activeTeam: 'home',
    });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROSTER_REPOSITION, {
      pieceIdA: homeOutfieldA.id,
      pieceIdB: awayOutfieldA.id,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    const stateAfter = getRoom(roomCode)!.gameState!;
    expect(stateAfter.pieces.find((p) => p.id === awayOutfieldA.id)!.playerId).toBe(
      awayOutfieldA.playerId,
    );
  });
});

// ---------------------------------------------------------------------------
// Non-active team still succeeds (socketTeam, not isActivePlayer)
// ---------------------------------------------------------------------------

describe('GAME_ROSTER_REPOSITION: either manager may reposition at a stoppage', () => {
  it('the socket whose team is NOT activeTeam still succeeds', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { awayOutfieldA } = seedRepoState(roomCode, 'HALF_TIME', { activeTeam: 'home' });
    const secondAway = getRoom(roomCode)!.gameState!.pieces.filter(
      (p) => p.teamId === 'away' && p.role !== 'GK' && p.id !== awayOutfieldA.id,
    )[0]!;

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_ROSTER_REPOSITION, {
      pieceIdA: awayOutfieldA.id,
      pieceIdB: secondAway.id,
    });
    const [state] = await statePromise;

    expect(state.pieces.find((p) => p.id === awayOutfieldA.id)!.playerId).toBe(secondAway.playerId);
  });
});

// ---------------------------------------------------------------------------
// isProcessing mutex
// ---------------------------------------------------------------------------

describe('GAME_ROSTER_REPOSITION: isProcessing mutex', () => {
  it('a second event while isProcessing is true is a no-op', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfieldA, homeOutfieldB } = seedRepoState(roomCode, 'HALF_TIME', {
      activeTeam: 'home',
    });

    const room = getRoom(roomCode)!;
    room.isProcessing = true;

    // No listener should fire — the handler returns immediately without broadcasting.
    let receivedState = false;
    clientA.once(ServerEvents.GAME_STATE, () => {
      receivedState = true;
    });
    clientA.emit(ClientEvents.GAME_ROSTER_REPOSITION, {
      pieceIdA: homeOutfieldA.id,
      pieceIdB: homeOutfieldB.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(receivedState).toBe(false);
    expect(
      getRoom(roomCode)!.gameState!.pieces.find((p) => p.id === homeOutfieldA.id)!.playerId,
    ).toBe(homeOutfieldA.playerId);

    room.isProcessing = false;
  });
});

// ---------------------------------------------------------------------------
// GK_SLOT_LOCKED verbatim
// ---------------------------------------------------------------------------

describe('GAME_ROSTER_REPOSITION: GK slot rejection', () => {
  it('a swap involving the GK slot is rejected with GK_SLOT_LOCKED verbatim', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGK, homeOutfieldA } = seedRepoState(roomCode, 'HALF_TIME', {
      activeTeam: 'home',
    });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROSTER_REPOSITION, {
      pieceIdA: homeGK.id,
      pieceIdB: homeOutfieldA.id,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('GK_SLOT_LOCKED');
  });
});
