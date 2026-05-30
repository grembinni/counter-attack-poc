/**
 * Integration tests for the game action wire layer.
 *
 * Mirrors room.integration.test.ts: real Socket.io server on port 0,
 * typed clients, oncePromise/waitForConnect helpers copied verbatim.
 *
 * Wave 2 establishes the lifecycle harness and setupRoom helper.
 * Wave 3 (04-03) fills the it.todo scenario placeholders once
 * game:start-movement provides the wire path into MOVEMENT phase.
 *
 * Requirements covered (once Wave 3 fills scenarios):
 * - MOVE-01: WRONG_PHASE rejection before MOVEMENT starts
 * - T-4-05: game:start-movement restricted to attacking team
 * - FSM: ATTACKER_4→DEFENDER_5→ATTACKER_2→PASS over the wire
 * - T-4-01 / T-4-04: WRONG_TEAM rejection for non-acting player
 * - D-09 / D-10: undo locked after SLOT_ADVANCE; reversal within slot
 * - SC-5: isProcessing duplicate-action drop
 */

import { afterEach, beforeEach, describe, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms } from '../roomStore.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (copied verbatim from room.integration.test.ts)
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
// Helpers (copied verbatim from room.integration.test.ts)
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
// setupRoom helper
// ---------------------------------------------------------------------------

/**
 * Creates a room with 2 connected players and waits for the initial GAME_STATE
 * broadcast. Returns both clients, the room code, and the initial state.
 *
 * Wave 3 wires buildInitialGameState into joinRoom, so state.phase will be
 * 'KICK_OFF' after that change. Until then it returns the stub 'LOBBY' state.
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

  const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  const [state] = await statePromise;

  return { clientA, clientB, roomCode, state };
}

// ---------------------------------------------------------------------------
// Smoke test (filled by Wave 3 when buildInitialGameState is wired)
// ---------------------------------------------------------------------------

describe('game integration — lifecycle', () => {
  it.todo(
    'setupRoom returns a KICK_OFF state with 22 pieces after Wave 3 wires buildInitialGameState (D-12, D-14, TEAM-01)',
  );
});

// ---------------------------------------------------------------------------
// Scenario placeholders (filled by Wave 3 — 04-03/T3)
// ---------------------------------------------------------------------------

describe('game integration — Movement Phase scenarios', () => {
  it.todo('MOVE-01: game:move before MOVEMENT (KICK_OFF) returns game:error WRONG_PHASE');

  it.todo(
    'T-4-05 start-movement guard: non-attacking client receives WRONG_TEAM; attacking client advances to MOVEMENT/ATTACKER_4',
  );

  it.todo(
    'FSM sequencing: game:end-turn three times advances ATTACKER_4→DEFENDER_5→ATTACKER_2→PASS (D-03/D-04 over the wire)',
  );

  it.todo(
    'T-4-01 WRONG_TEAM: game:move from non-acting client returns WRONG_TEAM after start-movement',
  );

  it.todo('D-10 undo reverses last move within slot; D-09 UNDO_LOCKED after a slot advance');

  it.todo(
    'SC-5 isProcessing: two rapid game:end-turn actions — second is silently dropped while first is processing',
  );

  it.todo(
    'MOVE-06 free-move — engine-covered in gameEngine.test.ts; full wire exercise lands with the free-move handler in Phase 5',
  );
});

// Export setupRoom so Wave 3 can import it without rewriting
export { setupRoom, createClient, oncePromise, waitForConnect };
