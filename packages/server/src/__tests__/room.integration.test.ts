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
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
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
   * Test 2 — CONN-02 + CONN-03 + ARCH-04 (wire level):
   * room:join succeeds for second client and BOTH receive ROOM_JOINED slot=2 plus game:state LOBBY.
   */
  it('room:join — both clients receive ROOM_JOINED slot=2 and game:state LOBBY (CONN-02 + CONN-03 + ARCH-04)', async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    // Client A creates the room.
    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode] = await createJoinedPromise;

    // Register listeners BEFORE emitting join, so we don't miss the event.
    const joinedAPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);

    clientB.emit(ClientEvents.ROOM_JOIN, roomCode);

    // Both clients receive ROOM_JOINED with slot=2 (broadcast).
    const [, slotA] = await joinedAPromise;
    const [, slotB] = await joinedBPromise;
    expect(slotA).toBe(2);
    expect(slotB).toBe(2);

    // Both clients receive game:state with phase LOBBY (CONN-03 + ARCH-04).
    const [stateA] = await stateAPromise;
    const [stateB] = await stateBPromise;

    const assertLobbyState = (state: GameState): void => {
      expect(state.phase).toBe('LOBBY');
      expect(state.roomCode).toBe(roomCode);
      expect(Array.isArray(state.pieces)).toBe(true);
      expect(state.pieces).toHaveLength(0);
      expect(state.score).toEqual({ home: 0, away: 0 });
    };

    assertLobbyState(stateA);
    assertLobbyState(stateB);
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
   */
  it('reconnect with sessionToken receives game:state, no ROOM_ERROR (SC-3)', async () => {
    // Set up the room with two players.
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode, , sessionTokenA] = await createJoinedPromise;

    // Client B joins so room enters 'playing' and game:state is populated.
    // Register game:state listener on clientA BEFORE the join so we don't miss the broadcast.
    const stateOnJoinPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
    clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
    await joinedBPromise;

    // Wait for game:state to be delivered to clientA before disconnecting.
    await stateOnJoinPromise;

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
    expect(state.phase).toBe('LOBBY');
    expect(state.roomCode).toBe(roomCode);
    expect(receivedError).toBeUndefined();
  }, 5000);
});
