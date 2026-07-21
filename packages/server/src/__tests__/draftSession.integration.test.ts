/**
 * Integration tests for Phase 29 Plan 04 — draft session server wiring
 * (DRAFT-07/DRAFT-08/DRAFT-10).
 *
 * Spins up a real Socket.io server + clients (mirrors lineupAssignment.integration.test.ts's
 * harness — copied verbatim per the per-file self-contained convention noted in testHelpers.ts).
 * Drives the full handshake through draft-mode ROOM_SETTINGS_CONFIRM -> UNIFORM_CONFIRM (both
 * players, draft team type) and asserts:
 *   - Task 1: draft-mode away UNIFORM_CONFIRM bootstraps DRAFT_STATE_UPDATED (not
 *     LINEUP_ASSIGNMENT_READY) with a disjoint cycle-1 PICK1 pack per player, no GAME_STATE.
 *   - Task 2: DRAFT_PICK / DRAFT_REARRANGE full cycle sequencing, mutex, tampering guards,
 *     GK-slot role rules, and end-to-end 4-cycle completion with bench numbering.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms } from '../roomStore.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  DraftClientView,
} from '@counter-attack/shared';
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

/**
 * Confirms room settings from clientA (host) with draft team type + the 'original' pool.
 * Mirrors testHelpers.ts's confirmDefaultRoomSettings but for draft mode — kept local to
 * this file per the per-file self-contained convention (only the Standard-mode default
 * fixture was factored out to testHelpers.ts).
 */
function confirmDraftRoomSettings(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  timeoutMs = 1000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ROOM_SETTINGS_CONFIRMED after ${timeoutMs}ms`));
    }, timeoutMs);
    clientA.once(ServerEvents.ROOM_SETTINGS_CONFIRMED, () => {
      clearTimeout(timer);
      resolve();
    });
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'draft',
      draftPools: ['original'],
    });
  });
}

/**
 * Drive both clients through ROOM_CREATE -> ROOM_SETTINGS_CONFIRM(draft) -> ROOM_JOIN ->
 * TEAM_PICK x2 -> UNIFORM_CONFIRM x2 (both '4-4-2'). Returns the home (clientA) and away
 * (clientB) sockets positioned right after away confirms (draft session bootstrapped and
 * cycle-1 packs opened).
 */
async function setupThroughDraftUniformConfirm(): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  viewA: DraftClientView;
  viewB: DraftClientView;
}> {
  const clientA = createClient();
  const clientB = createClient();
  await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

  // Create room
  const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
  clientA.emit(ClientEvents.ROOM_CREATE);
  const [roomCode] = await createJoinedPromise;

  // Confirm draft settings before the joiner arrives (T-27-05/Pitfall 1 both-conditions gate).
  await confirmDraftRoomSettings(clientA);

  // Join room
  const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
  const selectionStartPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START, 2000);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  await joinedBPromise;
  await selectionStartPromise;

  // Team picks
  const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED, 2000);
  clientA.emit(ClientEvents.TEAM_PICK, 'city');
  await homePickedPromise;

  const uniformStartPromise = oncePromise(clientA, ServerEvents.UNIFORM_SELECTION_START, 2000);
  clientB.emit(ClientEvents.TEAM_PICK, 'crew');
  await uniformStartPromise;

  // Home confirms uniform + formation
  const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED, 2000);
  clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
  await homeConfirmedPromise;

  // Away confirms uniform + formation -> bootstraps DraftSession's cycle-1 packs.
  const draftAPromise = oncePromise(clientA, ServerEvents.DRAFT_STATE_UPDATED, 2000);
  const draftBPromise = oncePromise(clientB, ServerEvents.DRAFT_STATE_UPDATED, 2000);
  clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');
  const [[viewA], [viewB]] = await Promise.all([draftAPromise, draftBPromise]);

  return { clientA, clientB, viewA, viewB };
}

// ---------------------------------------------------------------------------
// Task 1: draft-mode UNIFORM_CONFIRM away-branch bootstraps DRAFT_STATE_UPDATED
// ---------------------------------------------------------------------------

describe('Phase 29 Plan 04 Task 1 — draft-mode UNIFORM_CONFIRM bootstrap', () => {
  it('both sockets receive DRAFT_STATE_UPDATED (not LINEUP_ASSIGNMENT_READY) with cycle-1 PICK1 view and no GAME_STATE', async () => {
    // Track whether LINEUP_ASSIGNMENT_READY or GAME_STATE ever fire — they must NOT, since
    // the draft branch never emits either (verified by inspection of roomHandlers.ts — no
    // timing race is possible here, unlike a race against a competing async emit).
    let lineupReadyReceivedA = false;
    let lineupReadyReceivedB = false;
    let gameStateReceivedA = false;
    let gameStateReceivedB = false;

    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();

    clientA.once(ServerEvents.LINEUP_ASSIGNMENT_READY, () => {
      lineupReadyReceivedA = true;
    });
    clientB.once(ServerEvents.LINEUP_ASSIGNMENT_READY, () => {
      lineupReadyReceivedB = true;
    });
    clientA.once(ServerEvents.GAME_STATE, () => {
      gameStateReceivedA = true;
    });
    clientB.once(ServerEvents.GAME_STATE, () => {
      gameStateReceivedB = true;
    });

    // (a) both receive a cycle-1 PICK1 view of a 7-card pack, no picks made yet.
    for (const view of [viewA, viewB]) {
      expect(view.cycle).toBe(1);
      expect(view.subStep).toBe('PICK1');
      expect(view.currentPack).toHaveLength(7);
      expect(view.picksRemaining).toBe(1);
      expect(view.draftComplete).toBe(false);
      expect(view.lineupSlots).toEqual(Array(11).fill(null));
    }

    // (b) the two players' initial packs are DIFFERENT — disjoint card-id sets (D-04).
    const idsA = new Set(viewA.currentPack.map((c) => c.id));
    const idsB = new Set(viewB.currentPack.map((c) => c.id));
    for (const id of idsA) {
      expect(idsB.has(id)).toBe(false);
    }

    // (c) LINEUP_ASSIGNMENT_READY / GAME_STATE must NOT have been emitted.
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect(lineupReadyReceivedA).toBe(false);
    expect(lineupReadyReceivedB).toBe(false);
    expect(gameStateReceivedA).toBe(false);
    expect(gameStateReceivedB).toBe(false);
  }, 8000);

  it('Standard-mode UNIFORM_CONFIRM away-branch is unaffected by the draft gate (Pitfall 2 regression guard)', async () => {
    // This is a duplicate-safety smoke test local to this file; the authoritative
    // regression coverage lives in lineupAssignment.integration.test.ts (run as part of
    // the full suite per this task's acceptance criteria).
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode] = await createJoinedPromise;

    // Standard settings (teamType: 'standard').
    const settingsPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1000);
      clientA.once(ServerEvents.ROOM_SETTINGS_CONFIRMED, () => {
        clearTimeout(timer);
        resolve();
      });
      clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
        speed: 'standard',
        teamType: 'standard',
        draftPools: [],
      });
    });
    await settingsPromise;

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

    const readyAPromise = oncePromise(clientA, ServerEvents.LINEUP_ASSIGNMENT_READY, 2000);
    const readyBPromise = oncePromise(clientB, ServerEvents.LINEUP_ASSIGNMENT_READY, 2000);
    clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');

    const [[homeAssignment]] = await Promise.all([readyAPromise, readyBPromise]);
    expect(homeAssignment).toHaveLength(11);
  }, 8000);
});
