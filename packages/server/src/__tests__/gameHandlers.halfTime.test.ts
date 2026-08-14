/**
 * Wave 7 socket-level integration tests for the mutual second-half confirm gate
 * (Phase 39 Plan 15, D-16), proving GAME_HALF_TIME_START's reworked behavior end to end
 * over a real Socket.io server + socket.io-client — no mocking of the server itself.
 * Structure mirrors gkDiveAtFeet.integration.test.ts / foulFreeKick.integration.test.ts
 * (server lifecycle, createClient/oncePromise/waitForConnect/setupRoom).
 *
 * D-16 REPLACES the prior single-team `NOT_KICK_OFF_TEAM` gate entirely — no test in
 * this file (or anywhere in the repository, per a repo-wide grep) asserts that error
 * code. `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-15-PLAN.md`'s Task 3
 * item 6 calls for updating/deleting any pre-existing `NOT_KICK_OFF_TEAM` assertion —
 * none exist (the pre-D-16 handler had no dedicated socket-level test suite), so this
 * file is the FIRST socket-level coverage `GAME_HALF_TIME_START` has ever had.
 *
 * Coverage (numbered to match the plan's Task 3 action list):
 * 1. From HALF_TIME, GAME_HALF_TIME_START from EITHER manager is accepted (no
 *    NOT_KICK_OFF_TEAM) and leaves the phase at HALF_TIME with secondHalfConfirmed
 *    showing one side true.
 * 2. The second manager's confirm transitions to KICK_OFF_SETUP and clears
 *    secondHalfConfirmed.
 * 3. The away-then-home order produces the identical end state as home-then-away.
 * 4. A repeated confirm from the same manager does not start the half and appends no
 *    duplicate SECOND_HALF_CONFIRM.
 * 5. GAME_HALF_TIME_START outside HALF_TIME still returns WRONG_PHASE.
 * 6. No test in the repository still asserts NOT_KICK_OFF_TEAM (see note above).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors gkDiveAtFeet.integration.test.ts verbatim)
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
// Helpers (mirrors gkDiveAtFeet.integration.test.ts verbatim)
// ---------------------------------------------------------------------------

function createClient(opts?: {
  auth?: { sessionToken?: string };
}): Socket<ServerToClientEvents, ClientToServerEvents> {
  const client = ioClient(address, {
    transports: ['websocket'],
    forceNew: true,
    auth: opts?.auth ?? {},
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

/**
 * Creates a room with 2 connected clients and completes team selection.
 * clientA = slot 1 = 'home'; clientB = slot 2 = 'away' (project-wide convention).
 */
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

/**
 * Seeds a fresh HALF_TIME state (pinned kickOffTeam so the D-26 second-half attacking
 * team is deterministic across the home-then-away / away-then-home symmetry test).
 */
function seedHalfTime(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  room.gameState = {
    ...room.gameState,
    phase: 'HALF_TIME',
    kickOffTeam: 'home',
    half: 1,
    secondHalfConfirmed: null,
  };
}

// ---------------------------------------------------------------------------
// 1/2. Mutual confirm — either order transitions once both have confirmed
// ---------------------------------------------------------------------------

describe('D-16: mutual second-half confirm gate', () => {
  it('either manager may confirm first; the phase stays HALF_TIME with secondHalfConfirmed showing one side true', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedHalfTime(roomCode);

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HALF_TIME_START);
    const [state] = await statePromise;

    expect(state.phase).toBe('HALF_TIME');
    expect(state.secondHalfConfirmed).toEqual({ home: false, away: true });
  });

  it('the second manager confirming transitions to KICK_OFF_SETUP and clears secondHalfConfirmed', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHalfTime(roomCode);

    const firstPromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const firstPromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HALF_TIME_START);
    await Promise.all([firstPromiseA, firstPromiseB]);

    const secondPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HALF_TIME_START);
    const [finalState] = await secondPromise;

    expect(finalState.phase).toBe('KICK_OFF_SETUP');
    expect(finalState.secondHalfConfirmed).toBeNull();
    // D-26: kickOffTeam was 'home', so the second half is kicked off by 'away'.
    expect(finalState.attackingTeam).toBe('away');
    expect(finalState.half).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Order symmetry
// ---------------------------------------------------------------------------

describe('D-16: confirm order symmetry', () => {
  it('away-then-home produces the identical end state as home-then-away', async () => {
    // Room 1: away confirms first, then home.
    const roomA = await setupRoom();
    seedHalfTime(roomA.roomCode);
    const a1PromiseA = oncePromise(roomA.clientA, ServerEvents.GAME_STATE);
    const a1PromiseB = oncePromise(roomA.clientB, ServerEvents.GAME_STATE);
    roomA.clientB.emit(ClientEvents.GAME_HALF_TIME_START);
    await Promise.all([a1PromiseA, a1PromiseB]);
    const a2Promise = oncePromise(roomA.clientA, ServerEvents.GAME_STATE);
    roomA.clientA.emit(ClientEvents.GAME_HALF_TIME_START);
    const [awayThenHomeState] = await a2Promise;

    // Room 2: home confirms first, then away.
    const roomB = await setupRoom();
    seedHalfTime(roomB.roomCode);
    const b1PromiseA = oncePromise(roomB.clientA, ServerEvents.GAME_STATE);
    const b1PromiseB = oncePromise(roomB.clientB, ServerEvents.GAME_STATE);
    roomB.clientA.emit(ClientEvents.GAME_HALF_TIME_START);
    await Promise.all([b1PromiseA, b1PromiseB]);
    const b2Promise = oncePromise(roomB.clientB, ServerEvents.GAME_STATE);
    roomB.clientB.emit(ClientEvents.GAME_HALF_TIME_START);
    const [homeThenAwayState] = await b2Promise;

    expect(awayThenHomeState.phase).toBe(homeThenAwayState.phase);
    expect(awayThenHomeState.attackingTeam).toBe(homeThenAwayState.attackingTeam);
    expect(awayThenHomeState.activeTeam).toBe(homeThenAwayState.activeTeam);
    expect(awayThenHomeState.half).toBe(homeThenAwayState.half);
    expect(awayThenHomeState.secondHalfConfirmed).toEqual(homeThenAwayState.secondHalfConfirmed);
    expect(awayThenHomeState.ball).toEqual(homeThenAwayState.ball);
    expect(awayThenHomeState.pieces).toEqual(homeThenAwayState.pieces);
  });
});

// ---------------------------------------------------------------------------
// 4. Repeated confirm from the same manager is a no-op
// ---------------------------------------------------------------------------

describe('D-16: idempotent same-team re-confirm', () => {
  it('a repeated confirm from the same manager does not start the half and appends no duplicate SECOND_HALF_CONFIRM', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedHalfTime(roomCode);

    const firstPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HALF_TIME_START);
    await firstPromise;

    const secondPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HALF_TIME_START);
    const [repeatState] = await secondPromise;

    expect(repeatState.phase).toBe('HALF_TIME');
    expect(repeatState.secondHalfConfirmed).toEqual({ home: false, away: true });
    const confirmEvents = repeatState.eventLog.filter((e) => e.type === 'SECOND_HALF_CONFIRM');
    expect(confirmEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Phase guard
// ---------------------------------------------------------------------------

describe('D-16: phase guard', () => {
  it('GAME_HALF_TIME_START outside HALF_TIME returns WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    // Room is already past HALF_TIME (fresh match, KICK_OFF_SETUP) — no seed needed.
    expect(getRoom(roomCode)!.gameState!.phase).not.toBe('HALF_TIME');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_HALF_TIME_START);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
  });
});
