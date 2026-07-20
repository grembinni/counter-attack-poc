/**
 * Integration tests for the Socket.io room lifecycle layer.
 *
 * Each test spins up a real Socket.io server on port 0 (OS-assigned),
 * connects typed socket.io-client instances, and exercises the live event wire.
 *
 * Requirements covered:
 * - CONN-01 (wire level): room:create → ROOM_JOINED slot=1 + sessionToken
 * - CONN-02 + CONN-03 + ARCH-04: room:join → ROOM_JOINED slot=2 broadcast to both players + game:state LOBBY
 * - CONN-04 (first clause): join unknown code → ROOM_ERROR NOT_FOUND
 * - CONN-04 (second clause): join in-progress room → ROOM_ERROR NOT_WAITING
 * - SC-5: GET /health → 200 { status: 'ok' }
 * - SC-3 (partial): reconnect with sessionToken → game:state re-emitted, timer cancelled
 *
 * Per VALIDATION.md: total runtime budget < 10 seconds.
 * Per PATTERNS.md: forceNew: true on every client, transports: ['websocket'] required (Pitfall 6).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms } from '../roomStore.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';
import http from 'http';

// ---------------------------------------------------------------------------
// Server lifecycle
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
  // Disconnect all tracked clients first so no events fire during server close.
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

/**
 * Creates a typed socket.io-client connected to the test server.
 * forceNew: true prevents cross-test socket reuse (PATTERNS.md requirement).
 * transports: ['websocket'] must match server config (RESEARCH.md Pitfall 6).
 */
function createClient(opts?: {
  auth?: { sessionToken?: string };
}): Socket<ServerToClientEvents, ClientToServerEvents> {
  // ioClient returns Socket; cast to the typed variant for compile-time event checking.
  const client = ioClient(address, {
    transports: ['websocket'],
    forceNew: true,
    auth: opts?.auth ?? {},
  }) as Socket<ServerToClientEvents, ClientToServerEvents>;
  connectedClients.push(client);
  return client;
}

/**
 * Wraps socket.once in a Promise with a timeout.
 * Rejects if the event does not arrive within timeoutMs.
 *
 * @param socket    - The socket to listen on
 * @param event     - The event name to wait for
 * @param timeoutMs - Rejection timeout in milliseconds (default 1000)
 */
function oncePromise<E extends keyof ServerToClientEvents>(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  event: E,
  timeoutMs = 1000,
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
 * Wait for a client to fully connect (socket.connected === true).
 */
function waitForConnect(
  client: Socket<ServerToClientEvents, ClientToServerEvents>,
  timeoutMs = 1000,
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
 * Asserts that a given event is NOT emitted to the socket within windowMs.
 * Resolves once the window elapses without the event firing; rejects immediately
 * if the event fires during the window.
 *
 * Used for the race-gate negative assertion (T-27-05 / Pitfall 1): proving
 * TEAM_SELECTION_START is deferred, not just eventually correct.
 */
function assertEventNotEmitted<E extends keyof ServerToClientEvents>(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  event: E,
  windowMs = 250,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (...args: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off(event, handler);
      clearTimeout(timer);
      reject(new Error(`Unexpected event "${String(event)}" was emitted: ${JSON.stringify(args)}`));
    };
    const timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off(event, handler);
      resolve();
    }, windowMs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).once(event, handler);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Room integration tests', () => {
  /**
   * Test 1 — CONN-01 (wire level):
   * room:create returns ROOM_JOINED with slot=1 and a sessionToken.
   */
  it('room:create returns ROOM_JOINED with slot=1 and a sessionToken (CONN-01)', async () => {
    const client = createClient();
    await waitForConnect(client);

    const joinedPromise = oncePromise(client, ServerEvents.ROOM_JOINED);
    client.emit(ClientEvents.ROOM_CREATE);
    const [roomCode, playerSlot, sessionToken] = await joinedPromise;

    expect(playerSlot).toBe(1);
    expect(roomCode).toHaveLength(5);
    // Crockford alphabet: uppercase letters and digits, no 0/O/1/I
    expect(roomCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    // sessionToken must be UUID v4
    expect(sessionToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  /**
   * Test 2 — CONN-02 + CONN-03 (wire level, Phase 16 update):
   * room:join succeeds for second client and BOTH receive ROOM_JOINED slot=2 plus team:selection-start.
   * Phase 16 D-10: game:state is no longer emitted on join — emitted only after both teams picked.
   */
  it('room:join — both clients receive ROOM_JOINED slot=2 and team:selection-start (CONN-02 + CONN-03)', async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    // Client A creates the room.
    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode] = await createJoinedPromise;

    // Phase 27 D-01/T-27-05: TEAM_SELECTION_START is now gated on settings-confirmed
    // AND slot-2-joined — host confirms settings before the joiner arrives so this test's
    // existing join-then-team-selection-start flow still holds.
    const settingsConfirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
    });
    await settingsConfirmedPromise;

    // Register listeners BEFORE emitting join, so we don't miss the event.
    const joinedAPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
    const selectionStartAPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START);
    const selectionStartBPromise = oncePromise(clientB, ServerEvents.TEAM_SELECTION_START);

    clientB.emit(ClientEvents.ROOM_JOIN, roomCode);

    // Both clients receive ROOM_JOINED with slot=2 (broadcast).
    const [, slotA] = await joinedAPromise;
    const [, slotB] = await joinedBPromise;
    expect(slotA).toBe(2);
    expect(slotB).toBe(2);

    // Phase 16 D-10: both clients receive team:selection-start instead of game:state.
    // game:state is only emitted after both teams are picked via team:pick.
    await selectionStartAPromise;
    await selectionStartBPromise;
    // Verify assertions pass: the promises resolved (no timeout = team:selection-start was emitted).
  });

  /**
   * Test 3 — CONN-04 (first clause):
   * room:join with unknown code returns ROOM_ERROR NOT_FOUND.
   */
  it('room:join with unknown code returns ROOM_ERROR NOT_FOUND (CONN-04 first clause)', async () => {
    const client = createClient();
    await waitForConnect(client);

    const errorPromise = oncePromise(client, ServerEvents.ROOM_ERROR);
    client.emit(ClientEvents.ROOM_JOIN, 'XXXXX');
    const [reason] = await errorPromise;

    expect(reason).toBe('NOT_FOUND');
  });

  /**
   * Test 4 — CONN-04 (second clause — distinct from NOT_FOUND):
   * room:join on an in-progress room returns ROOM_ERROR NOT_WAITING.
   */
  it('room:join on in-progress room returns ROOM_ERROR NOT_WAITING (CONN-04 second clause)', async () => {
    const clientA = createClient();
    const clientB = createClient();
    const clientC = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB), waitForConnect(clientC)]);

    // Client A creates the room.
    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode] = await createJoinedPromise;

    // Client B joins (room transitions to 'playing').
    const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
    clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
    await joinedBPromise; // wait for join to complete

    // Client C attempts to join the same room — must get NOT_WAITING, not NOT_FOUND.
    const errorPromise = oncePromise(clientC, ServerEvents.ROOM_ERROR);
    clientC.emit(ClientEvents.ROOM_JOIN, roomCode);
    const [reason] = await errorPromise;

    expect(reason).toBe('NOT_WAITING');
    expect(reason).not.toBe('NOT_FOUND');
  });

  /**
   * Test 5 — SC-5:
   * GET /health returns 200 with { status: 'ok' }.
   */
  it('GET /health returns 200 with { status: ok } (SC-5)', async () => {
    await new Promise<void>((resolve, reject) => {
      http.get(`${address}/health`, (res) => {
        expect(res.statusCode).toBe(200);
        let body = '';
        res.on('data', (chunk: string) => {
          body += chunk;
        });
        res.on('end', () => {
          const json = JSON.parse(body) as { status: string; timestamp: string };
          expect(json.status).toBe('ok');
          expect(typeof json.timestamp).toBe('string');
          resolve();
        });
        res.on('error', reject);
      });
    });
  });

  /**
   * Test 6 — SC-3 (partial — 90s timer expiry not tested to keep test fast):
   * reconnect with sessionToken receives game:state from server; timer cancelled; no ROOM_ERROR.
   *
   * The 90s expiry is acknowledged in code review, not tested at wall-clock latency
   * (VALIDATION.md budget ~5s total runtime — RESEARCH.md A3 confirms 90s is the requirement).
   *
   * Phase 16 D-10: game:state is only populated after team:pick flow completes.
   * This test drives the full selection before disconnecting.
   */
  it('reconnect with sessionToken receives game:state, no ROOM_ERROR (SC-3)', async () => {
    // Set up the room with two players.
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode, , sessionTokenA] = await createJoinedPromise;

    // Phase 27 D-01/T-27-05: confirm settings before the joiner arrives so the existing
    // join-then-team-selection-start flow still holds under the new both-conditions gate.
    const settingsConfirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
    });
    await settingsConfirmedPromise;

    // Client B joins — both receive team:selection-start (Phase 16 D-10).
    const selectionStartPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START, 2000);
    const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
    clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
    await joinedBPromise;
    await selectionStartPromise;

    // Drive team selection then uniform confirmation (Phase 22 D-13/D-14/D-15).
    const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED, 2000);
    clientA.emit(ClientEvents.TEAM_PICK, 'city');
    await homePickedPromise;
    const uniformStartPromise = oncePromise(clientA, ServerEvents.UNIFORM_SELECTION_START, 2000);
    clientB.emit(ClientEvents.TEAM_PICK, 'crew');
    await uniformStartPromise;
    const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED, 2000);
    clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
    await homeConfirmedPromise;
    // Phase 24: away confirm emits LINEUP_ASSIGNMENT_READY; both players confirm to start game.
    const stateOnPickPromiseA = oncePromise(clientA, ServerEvents.GAME_STATE, 2000);
    const stateOnPickPromiseB = oncePromise(clientB, ServerEvents.GAME_STATE, 2000);
    const readyAPromise = oncePromise(clientA, ServerEvents.LINEUP_ASSIGNMENT_READY, 2000);
    const readyBPromise = oncePromise(clientB, ServerEvents.LINEUP_ASSIGNMENT_READY, 2000);
    clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');
    const [homeAssignment] = await readyAPromise;
    await readyBPromise;
    clientA.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: homeAssignment });
    clientB.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: homeAssignment });

    // Wait for game:state to be delivered to BOTH clients before disconnecting.
    await Promise.all([stateOnPickPromiseA, stateOnPickPromiseB]);

    // Client A disconnects — server stores a 90s grace timer.
    clientA.disconnect();
    // Allow the server disconnect handler to fire and store the timer.
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    // Client A reconnects with its sessionToken.
    // IMPORTANT: register the game:state listener BEFORE waitForConnect because the server
    // emits game:state immediately in the connection handler — before the client 'connect'
    // event resolves on this side.
    const clientAReconnected = createClient({ auth: { sessionToken: sessionTokenA } });
    const statePromise = oncePromise(clientAReconnected, ServerEvents.GAME_STATE, 2000);

    // Client A must NOT receive ROOM_ERROR.
    let receivedError: string | undefined;
    clientAReconnected.once(ServerEvents.ROOM_ERROR, (reason) => {
      receivedError = reason;
    });

    await waitForConnect(clientAReconnected);

    const [state] = await statePromise;
    expect(state.phase).toBe('KICK_OFF_SETUP'); // D-23: game starts at KICK_OFF_SETUP; reconnect rebroadcasts it
    expect(state.roomCode).toBe(roomCode);
    expect(receivedError).toBeUndefined();
  }, 5000);
});

// ---------------------------------------------------------------------------
// UNIFORM_CONFIRM guard tests (Phase 22 D-13/D-14/D-15)
// ---------------------------------------------------------------------------

describe('UNIFORM_CONFIRM — guard: away before home', () => {
  it('away emitting UNIFORM_CONFIRM before home receives GAME_ERROR WRONG_TURN', async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode] = await createJoinedPromise;

    // Phase 27 D-01/T-27-05: confirm settings before the joiner arrives so the existing
    // join-then-team-selection-start flow still holds under the new both-conditions gate.
    const settingsConfirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
    });
    await settingsConfirmedPromise;

    const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
    const selectionStartPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START, 2000);
    clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
    await joinedBPromise;
    await selectionStartPromise;

    // Home picks their team — away picks theirs, triggering UNIFORM_SELECTION_START
    const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED, 2000);
    clientA.emit(ClientEvents.TEAM_PICK, 'city');
    await homePickedPromise;
    const uniformStartPromise = oncePromise(clientA, ServerEvents.UNIFORM_SELECTION_START, 2000);
    clientB.emit(ClientEvents.TEAM_PICK, 'crew');
    await uniformStartPromise;

    // Away emits UNIFORM_CONFIRM before home — should receive WRONG_TURN
    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR, 2000);
    clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TURN');
  }, 5000);
});

describe('UNIFORM_CONFIRM — guard: invalid inputs', () => {
  async function setupUniformPhase() {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode] = await createJoinedPromise;

    // Phase 27 D-01/T-27-05: confirm settings before the joiner arrives so the existing
    // join-then-team-selection-start flow still holds under the new both-conditions gate.
    const settingsConfirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
    });
    await settingsConfirmedPromise;

    const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
    const selectionStartPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START, 2000);
    clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
    await joinedBPromise;
    await selectionStartPromise;

    const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED, 2000);
    clientA.emit(ClientEvents.TEAM_PICK, 'city');
    await homePickedPromise;
    const uniformStartPromise = oncePromise(clientA, ServerEvents.UNIFORM_SELECTION_START, 2000);
    clientB.emit(ClientEvents.TEAM_PICK, 'crew');
    await uniformStartPromise;

    return { clientA, clientB };
  }

  it('home emitting unknown style ID receives GAME_ERROR INVALID_STYLE', async () => {
    const { clientA } = await setupUniformPhase();
    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR, 2000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'not-a-style' as any, '4-4-2', 'home');
    const [reason] = await errorPromise;
    expect(reason).toBe('INVALID_STYLE');
  }, 5000);

  it("away emitting home's team after home confirms receives GAME_ERROR TEAM_ALREADY_PICKED", async () => {
    const { clientA, clientB } = await setupUniformPhase();

    // Home confirms first
    const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED, 2000);
    clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
    await homeConfirmedPromise;

    // Away tries to pick home's team
    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR, 2000);
    clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'bar-diagonal', '4-4-2', 'away');
    const [reason] = await errorPromise;
    expect(reason).toBe('TEAM_ALREADY_PICKED');
  }, 5000);
});

// ---------------------------------------------------------------------------
// ROOM_SETTINGS_CONFIRM (Phase 27, DRAFT-01/D-01/D-02/D-03)
//
// Covers: host-only guard (T-27-01), draft-pool allow-list (T-27-02),
// re-confirm-after-lock guard (T-27-03), conditional pool-required validation
// (T-27-04), and the settings-confirmed / joiner-present race gate (T-27-05,
// Pitfall 1). RED at plan 27-02 task 1 — ROOM_SETTINGS_CONFIRM handler does
// not exist yet, so every case below fails because no response is ever
// emitted (oncePromise times out), not because of an assertion mismatch.
// ---------------------------------------------------------------------------

describe('ROOM_SETTINGS_CONFIRM', () => {
  it('non-host (slot 2) ROOM_SETTINGS_CONFIRM is rejected with WRONG_TURN and does not fire TEAM_SELECTION_START (T-27-01)', async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode] = await createJoinedPromise;

    const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
    clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
    await joinedBPromise;

    // Joiner (slot 2) is not the host — must be rejected, and the rejected
    // attempt itself must not cause a (new) TEAM_SELECTION_START emission.
    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR, 2000);
    const noStartPromise = assertEventNotEmitted(clientB, ServerEvents.TEAM_SELECTION_START);
    clientB.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'fast',
      teamType: 'standard',
      draftPools: [],
    });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TURN');
    await noStartPromise;
  }, 5000);

  it('draft mode with an empty draftPools array is rejected with DRAFT_POOL_REQUIRED (T-27-04)', async () => {
    const clientA = createClient();
    await waitForConnect(clientA);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    await createJoinedPromise;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR, 2000);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'draft',
      draftPools: [],
    });
    const [reason] = await errorPromise;
    expect(reason).toBe('DRAFT_POOL_REQUIRED');
  }, 5000);

  it('standard mode with an empty draftPools array succeeds; re-confirm after lock is rejected with SETTINGS_ALREADY_CONFIRMED (T-27-03)', async () => {
    const clientA = createClient();
    await waitForConnect(clientA);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    await createJoinedPromise;

    const confirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED, 2000);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
    });
    const [speed, teamType, draftPools] = await confirmedPromise;
    expect(speed).toBe('standard');
    expect(teamType).toBe('standard');
    expect(draftPools).toEqual([]);
    // No DRAFT_POOL_REQUIRED should fire for standard mode's empty pool array.

    // D-03: settings are locked after the first confirm — a second confirm attempt
    // (even with different values) must be rejected and must not mutate the room.
    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR, 2000);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'fast',
      teamType: 'draft',
      draftPools: ['original'],
    });
    const [reason] = await errorPromise;
    expect(reason).toBe('SETTINGS_ALREADY_CONFIRMED');
  }, 5000);

  it("draftPools allow-list rejects 'legends' even though it is a valid DraftPoolId (T-27-02)", async () => {
    const clientA = createClient();
    await waitForConnect(clientA);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    await createJoinedPromise;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR, 2000);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'draft',
      draftPools: ['legends'],
    });
    const [reason] = await errorPromise;
    expect(reason).toBe('INVALID_DRAFT_POOL');
  }, 5000);

  it('TEAM_SELECTION_START fires only once both host-confirmed and slot-2-joined are true, regardless of order (T-27-05 / Pitfall 1)', async () => {
    // --- Ordering 1: host confirms settings BEFORE the joiner joins. ---
    const clientA = createClient();
    await waitForConnect(clientA);

    const createJoinedPromiseA = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCodeA] = await createJoinedPromiseA;

    const noStartPromiseA = assertEventNotEmitted(clientA, ServerEvents.TEAM_SELECTION_START);
    const confirmedPromiseA = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED, 2000);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
    });
    await confirmedPromiseA;
    // Host must NOT prematurely receive TEAM_SELECTION_START before a joiner exists (D-01).
    await noStartPromiseA;

    const clientB = createClient();
    await waitForConnect(clientB);

    const selectionStartAPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START, 2000);
    const selectionStartBPromise = oncePromise(clientB, ServerEvents.TEAM_SELECTION_START, 2000);
    const joinerSettingsPromise = oncePromise(clientB, ServerEvents.ROOM_SETTINGS_CONFIRMED, 2000);
    const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
    clientB.emit(ClientEvents.ROOM_JOIN, roomCodeA);
    await joinedBPromise;

    // Both clients receive TEAM_SELECTION_START once the joiner arrives (settings already confirmed).
    await selectionStartAPromise;
    await selectionStartBPromise;
    // D-02: the joiner receives the host's stored settings at join time.
    const [joinerSpeed, joinerTeamType, joinerPools] = await joinerSettingsPromise;
    expect(joinerSpeed).toBe('standard');
    expect(joinerTeamType).toBe('standard');
    expect(joinerPools).toEqual([]);

    // --- Ordering 2 (reverse): the joiner joins BEFORE the host confirms settings. ---
    const clientC = createClient();
    const clientD = createClient();
    await Promise.all([waitForConnect(clientC), waitForConnect(clientD)]);

    const createJoinedPromiseC = oncePromise(clientC, ServerEvents.ROOM_JOINED);
    clientC.emit(ClientEvents.ROOM_CREATE);
    const [roomCodeC] = await createJoinedPromiseC;

    const noStartPromiseC = assertEventNotEmitted(clientC, ServerEvents.TEAM_SELECTION_START);
    const noStartPromiseD = assertEventNotEmitted(clientD, ServerEvents.TEAM_SELECTION_START);
    const joinedDPromise = oncePromise(clientD, ServerEvents.ROOM_JOINED);
    clientD.emit(ClientEvents.ROOM_JOIN, roomCodeC);
    await joinedDPromise;
    // Joiner arrived first — settings not yet confirmed, so TEAM_SELECTION_START must be deferred.
    await noStartPromiseC;
    await noStartPromiseD;

    const selectionStartCPromise = oncePromise(clientC, ServerEvents.TEAM_SELECTION_START, 2000);
    const selectionStartDPromise = oncePromise(clientD, ServerEvents.TEAM_SELECTION_START, 2000);
    clientC.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
    });
    // Host confirm is the "second" condition here — must fire TEAM_SELECTION_START for both.
    await selectionStartCPromise;
    await selectionStartDPromise;
  }, 8000);
});
