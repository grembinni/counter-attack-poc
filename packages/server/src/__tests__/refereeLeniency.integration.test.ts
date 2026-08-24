/**
 * Phase 44 -- REFEREE-01/02/03/04 end-to-end Leniency override integration tests.
 * Covers the full six-hop chain: ROOM_SETTINGS_CONFIRM payload -> allow-list validation
 * -> Room -> LINEUP_CONFIRM -> buildInitialGameState -> broadcast GameState.refereeCard.leniency.
 *
 * Plans 44-01 through 44-04 each verified their own hop in isolation (engine conditional,
 * disclosure layout, stepper row, validate/store/broadcast plumbing). Nothing until now has
 * asserted that a host clicking a number in a browser produces a match with that Leniency --
 * this file closes that gap at the socket layer.
 *
 * Structure mirrors tackleStealPrompt.integration.test.ts (server lifecycle,
 * createClient/oncePromise/waitForConnect, a local setupX helper that drives
 * create -> confirm settings -> join -> team pick -> uniform confirm -> LINEUP_CONFIRM and
 * returns the first broadcast GameState). Deliberately copied verbatim per the
 * per-file-self-contained convention documented in testHelpers.ts (lines 4-12) rather than
 * imported.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (copied verbatim per the per-file self-contained convention)
// ---------------------------------------------------------------------------

let httpServer: ReturnType<typeof buildServer>['httpServer'];
const connectedClients: Socket[] = [];
let address: string;

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
// Transport helpers (copied verbatim per the per-file self-contained convention)
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

/**
 * Local settings-confirm helper parametrised on the two Referee Leniency fields (mirrors
 * tackleStealPrompt.integration.test.ts's confirmRoomSettings, parametrised on its own
 * toggle instead). Every other field is pinned to the same defaults setupRoom uses so
 * Leniency is the only variable.
 */
function confirmRoomSettings(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  refereeLeniencyOverride: boolean,
  refereeLeniencyValue: number,
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
      teamType: 'standard',
      draftPools: [],
      outOfBounds: false,
      fouls: false,
      booking: false,
      injury: false,
      tackleStealDecline: false,
      refereeLeniencyOverride,
      refereeLeniencyValue,
    });
  });
}

/**
 * Creates a room with 2 connected clients, confirms settings with the given Referee
 * Leniency override, and completes team/uniform/lineup confirmation. Returns the first
 * broadcast GameState after both LINEUP_CONFIRM emits (modelled on setupRoom in
 * tackleStealPrompt.integration.test.ts). clientA = slot 1 = 'home'; clientB = slot 2 =
 * 'away' (project-wide convention).
 */
async function setupMatchWithLeniency(
  refereeLeniencyOverride: boolean,
  refereeLeniencyValue: number,
): Promise<{
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

  await confirmRoomSettings(clientA, refereeLeniencyOverride, refereeLeniencyValue);

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
// Tests
// ---------------------------------------------------------------------------

describe('Referee Leniency end-to-end socket integration (REFEREE-01/02/03/04, T-44-14/T-44-15)', () => {
  it.each([2, 5])(
    'override ON with value %i: the first broadcast GameState has refereeCard.leniency exactly equal to the confirmed value (REFEREE-01/02)',
    async (value) => {
      // Run 3 passes at this range end -- a single pass could coincidentally match a
      // random roll; 3 passes at both range ends make that effectively impossible.
      for (let pass = 0; pass < 3; pass++) {
        const { clientA, clientB, state } = await setupMatchWithLeniency(true, value);
        expect(state.refereeCard.leniency).toBe(value);
        clientA.disconnect();
        clientB.disconnect();
      }
    },
    5000,
  );

  it('override OFF: refereeCard.leniency is a random integer 2..5, proving the already-shipped random path survives the new plumbing (REFEREE-03)', async () => {
    for (let pass = 0; pass < 5; pass++) {
      const { clientA, clientB, state } = await setupMatchWithLeniency(false, 4);
      expect(Number.isInteger(state.refereeCard.leniency)).toBe(true);
      expect(state.refereeCard.leniency).toBeGreaterThanOrEqual(2);
      expect(state.refereeCard.leniency).toBeLessThanOrEqual(5);
      clientA.disconnect();
      clientB.disconnect();
    }
  }, 5000);

  it('override ON with value 3: Room storage and broadcast GameState agree (refereeLeniencyOverrideEnabled/refereeLeniencyValue on Room match refereeCard.leniency on the broadcast state)', async () => {
    const { clientA, clientB, roomCode, state } = await setupMatchWithLeniency(true, 3);
    const room = getRoom(roomCode);
    expect(room).toBeDefined();
    expect(room!.refereeLeniencyOverrideEnabled).toBe(true);
    expect(room!.refereeLeniencyValue).toBe(3);
    expect(state.refereeCard.leniency).toBe(3);
    clientA.disconnect();
    clientB.disconnect();
  }, 5000);

  it('late joiner: after the host confirms with the override on, a second client joining receives ROOM_SETTINGS_CONFIRMED whose 9th and 10th positional args are the confirmed flag and value (T-44-14, the ROOM_JOIN replay emit site -- the ONLY automated coverage of this emit site; do not delete as redundant with room.integration.test.ts, which only covers the confirm-time emit)', async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode] = await createPromise;

    await confirmRoomSettings(clientA, true, 5);

    // Register the ROOM_SETTINGS_CONFIRMED listener on clientB BEFORE emitting
    // ROOM_JOIN -- this is the replay-on-join emit site, distinct from the
    // confirm-time echo to clientA above.
    const replayPromise = oncePromise(clientB, ServerEvents.ROOM_SETTINGS_CONFIRMED);
    clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
    const replayArgs = await replayPromise;

    // Positional order (packages/shared/src/events.ts ServerEvents.ROOM_SETTINGS_CONFIRMED):
    // 0 speed, 1 teamType, 2 draftPools, 3 outOfBounds, 4 fouls, 5 booking, 6 injury,
    // 7 tackleStealDecline, 8 refereeLeniencyOverride, 9 refereeLeniencyValue.
    const refereeLeniencyOverride = replayArgs[8];
    const refereeLeniencyValue = replayArgs[9];
    expect(refereeLeniencyOverride).toBe(true);
    expect(refereeLeniencyValue).toBe(5);

    clientA.disconnect();
    clientB.disconnect();
  }, 5000);

  it('REFEREE-04 single-source coupling: with the override pinned to a known value, the broadcast GameState exposes that number only at refereeCard.leniency -- no sibling refereeLeniency* key exists on the broadcast state, so booking and added time cannot read divergent values', async () => {
    const { clientA, clientB, state } = await setupMatchWithLeniency(true, 2);
    expect(state.refereeCard.leniency).toBe(2);
    const topLevelKeys = Object.keys(state);
    const strayLeniencyKeys = topLevelKeys.filter((key) => /^refereeLeniency/i.test(key));
    expect(strayLeniencyKeys).toEqual([]);
    // Also confirm no sibling key was smuggled onto refereeCard itself.
    const refereeCardKeys = Object.keys(state.refereeCard);
    expect(refereeCardKeys).toEqual(['leniency']);
    clientA.disconnect();
    clientB.disconnect();
  }, 5000);
});
