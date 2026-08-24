/**
 * Integration tests for mid-draft reconnect resend (D-13, closes RESEARCH.md Pitfall 3:
 * the pre-existing reconnect handler only re-emits GAME_STATE, which is null throughout
 * the entire pre-game draft flow).
 *
 * Spins up a real Socket.io server + clients (mirrors lineupAssignment.integration.test.ts's
 * harness — copied verbatim per the per-file self-contained convention).
 *
 * Rewritten Phase 30 Plan 05 for the round model: `cycle` -> `round` throughout (D-12..D-16).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';

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
// Helpers (copied verbatim from lineupAssignment.integration.test.ts)
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
  timeoutMs = 1500,
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
// D-13 / Pitfall 3: mid-draft reconnect resends the private draft view
// ---------------------------------------------------------------------------

describe('Mid-draft reconnect resends DRAFT_STATE_UPDATED', () => {
  it('a mid-draft reconnect receives its own private DRAFT_STATE_UPDATED with round/subStep preserved and the CORRECT (own, not opponent) pack (D-13)', async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    // Create room + draft settings.
    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode, , sessionTokenA] = await createJoinedPromise;

    const settingsConfirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'draft',
      draftPools: ['original'],
      outOfBounds: false,
      fouls: false,
      booking: false,
      injury: false,
      tackleStealDecline: false,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
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

    const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED, 2000);
    clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
    await homeConfirmedPromise;

    const draftAPromise = oncePromise(clientA, ServerEvents.DRAFT_STATE_UPDATED, 2000);
    const draftBPromise = oncePromise(clientB, ServerEvents.DRAFT_STATE_UPDATED, 2000);
    clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');
    const [initialViewA] = await draftAPromise;
    await draftBPromise;

    // Drive one pick from home before disconnecting — proves the reconnect view reflects
    // the IN-PROGRESS state (the pick already made), not a freshly re-bootstrapped one.
    const pickedCardId = initialViewA.currentPack[0]!.id;
    const afterPickPromise = oncePromise(clientA, ServerEvents.DRAFT_STATE_UPDATED, 2000);
    clientA.emit(ClientEvents.DRAFT_PICK, { cardId: pickedCardId, destination: { type: 'bench' } });
    const [afterPickViewA] = await afterPickPromise;
    expect(afterPickViewA.benchIds).toContain(pickedCardId);
    expect(afterPickViewA.picksRemaining).toBe(0);

    // Client A disconnects — server stores a 90s grace timer (does NOT delete the room yet).
    clientA.disconnect();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    // Client A reconnects with its sessionToken. Register the DRAFT_STATE_UPDATED listener
    // BEFORE waitForConnect — the server emits it synchronously inside the connection handler.
    const clientAReconnected = createClient({ auth: { sessionToken: sessionTokenA } });
    const reconnectDraftPromise = oncePromise(
      clientAReconnected,
      ServerEvents.DRAFT_STATE_UPDATED,
      2000,
    );

    let receivedError: string | undefined;
    clientAReconnected.once(ServerEvents.ROOM_ERROR, (reason) => {
      receivedError = reason;
    });

    await waitForConnect(clientAReconnected);

    const [reconnectView] = await reconnectDraftPromise;

    // D-13: round/subStep preserved, and the already-made pick is still reflected.
    expect(reconnectView.round).toBe(afterPickViewA.round);
    expect(reconnectView.subStep).toBe(afterPickViewA.subStep);
    expect(reconnectView.benchIds).toContain(pickedCardId);
    expect(reconnectView.picksRemaining).toBe(afterPickViewA.picksRemaining);

    // Privacy (T-29-05): the reconnecting socket's view is its OWN — currentPack matches
    // what it held pre-disconnect (minus the drafted card), NOT the opponent's pack.
    expect(new Set(reconnectView.currentPack.map((c) => c.id))).toEqual(
      new Set(afterPickViewA.currentPack.map((c) => c.id)),
    );

    expect(receivedError).toBeUndefined();
  }, 8000);

  it('the reconnect draft re-emit targets only the reconnecting socket, never the room (grep-level guard via behavior)', async () => {
    // Behavioral proof: the opponent (clientB, who never disconnected) must NOT receive an
    // extra DRAFT_STATE_UPDATED as a side effect of clientA's reconnect.
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode, , sessionTokenA] = await createJoinedPromise;

    const settingsConfirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'draft',
      draftPools: ['original'],
      outOfBounds: false,
      fouls: false,
      booking: false,
      injury: false,
      tackleStealDecline: false,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
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

    const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED, 2000);
    clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
    await homeConfirmedPromise;

    const draftAPromise = oncePromise(clientA, ServerEvents.DRAFT_STATE_UPDATED, 2000);
    const draftBPromise = oncePromise(clientB, ServerEvents.DRAFT_STATE_UPDATED, 2000);
    clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');
    await draftAPromise;
    await draftBPromise;

    clientA.disconnect();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    let clientBReceivedExtraUpdate = false;
    clientB.once(ServerEvents.DRAFT_STATE_UPDATED, () => {
      clientBReceivedExtraUpdate = true;
    });

    const clientAReconnected = createClient({ auth: { sessionToken: sessionTokenA } });
    const reconnectDraftPromise = oncePromise(
      clientAReconnected,
      ServerEvents.DRAFT_STATE_UPDATED,
      2000,
    );
    await waitForConnect(clientAReconnected);
    await reconnectDraftPromise;

    // Give any rogue broadcast a brief window to arrive.
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect(clientBReceivedExtraUpdate).toBe(false);
  }, 8000);
});

// ---------------------------------------------------------------------------
// Phase 29 Plan 11 — CR-03 reconnect re-sync in post-complete window
// ---------------------------------------------------------------------------

describe('Phase 29 Plan 11 — CR-03 reconnect re-sync in post-complete window', () => {
  it('a reconnect with draftComplete=true and gameState=null still receives DRAFT_STATE_UPDATED (previously silence), and no GAME_STATE arrives', async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode, , sessionTokenA] = await createJoinedPromise;

    const settingsConfirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED);
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'draft',
      draftPools: ['original'],
      outOfBounds: false,
      fouls: false,
      booking: false,
      injury: false,
      tackleStealDecline: false,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
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

    const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED, 2000);
    clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
    await homeConfirmedPromise;

    const draftAPromise = oncePromise(clientA, ServerEvents.DRAFT_STATE_UPDATED, 2000);
    const draftBPromise = oncePromise(clientB, ServerEvents.DRAFT_STATE_UPDATED, 2000);
    clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');
    await draftAPromise;
    await draftBPromise;

    // Simulate the post-complete/pre-confirm window directly: flip draftComplete true while
    // leaving room.gameState null (benchNumbers default to {}, so buildDraftView is safe).
    const room = getRoom(roomCode)!;
    room.draftSession = { ...room.draftSession!, draftComplete: true };
    expect(room.gameState).toBeNull();

    clientA.disconnect();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    let gameStateReceived = false;
    const clientAReconnected = createClient({ auth: { sessionToken: sessionTokenA } });
    clientAReconnected.once(ServerEvents.GAME_STATE, () => {
      gameStateReceived = true;
    });

    // Register the DRAFT_STATE_UPDATED listener BEFORE waitForConnect — the server emits it
    // synchronously inside the connection handler.
    const reconnectDraftPromise = oncePromise(
      clientAReconnected,
      ServerEvents.DRAFT_STATE_UPDATED,
      2000,
    );

    let clientBReceivedExtraUpdate = false;
    clientB.once(ServerEvents.DRAFT_STATE_UPDATED, () => {
      clientBReceivedExtraUpdate = true;
    });

    await waitForConnect(clientAReconnected);

    const [reconnectView] = await reconnectDraftPromise;
    expect(reconnectView.draftComplete).toBe(true);

    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect(gameStateReceived).toBe(false);
    expect(clientBReceivedExtraUpdate).toBe(false);
  }, 8000);
});
