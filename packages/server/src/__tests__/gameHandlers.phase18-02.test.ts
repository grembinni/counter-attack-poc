/**
 * Phase 18.2 Plan 01 (BUG-11) handler-level tests.
 *
 * Closes the parity gap where FIRST_TIME_PASS_MOVE excludes its passer
 * (firstTimePassCarrierId) from repositioning (Phase 17.1-16) but the
 * structurally-identical HIGH_PASS_MOVE never consumed its already-existing
 * highPassCarrierId field as a GAME_MOVE exclusion. The original high-pass
 * kicker could select and reposition their own piece during the
 * HIGH_PASS_MOVE repositioning slot — an Elevation-of-Privilege defect
 * identical in class to the FTP self-pass-reclaim exploit.
 *
 * Test harness mirrors gameHandlers.phase17-06.test.ts: real Socket.io server
 * on port 0; room state seeded directly via getRoom after team selection.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
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
// Helpers (mirrors gameHandlers.phase17-06.test.ts pattern exactly)
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
 * clientA = slot 1 = 'home'; clientB = slot 2 = 'away'.
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

  const selectionStartPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  await selectionStartPromise;

  const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
  const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
  const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED);
  clientA.emit(ClientEvents.TEAM_PICK, 'cosmos');
  await homePickedPromise;
  clientB.emit(ClientEvents.TEAM_PICK, 'xolos');
  const [[state]] = await Promise.all([statePromiseA, statePromiseB]);

  return { clientA, clientB, roomCode, state };
}

// ---------------------------------------------------------------------------
// BUG-11: HIGH_PASS_MOVE carrier-exclusion guard (touch point 1: server GAME_MOVE)
// ---------------------------------------------------------------------------

describe('BUG-11 (Phase 18.2): GAME_MOVE rejects the high-pass carrier during HIGH_PASS_MOVE', () => {
  it('rejects a GAME_MOVE for the carrier piece with WRONG_PIECE and leaves its position unchanged', async () => {
    const { clientA, roomCode, state } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    const carrierId = 'home-9';
    const carrier = state.pieces.find((p) => p.id === carrierId);
    if (!carrier) throw new Error(`Piece ${carrierId} not found in state`);
    const origPos = carrier.position;
    const destHex = { q: origPos.q + 1, r: origPos.r };

    room.gameState = {
      ...room.gameState,
      // Clear any other piece off destHex so OCCUPIED would not otherwise fire.
      pieces: room.gameState.pieces.map((p) =>
        p.id !== carrierId && p.position.q === destHex.q && p.position.r === destHex.r
          ? { ...p, position: { q: p.position.q, r: p.position.r + 1 } }
          : p,
      ),
      phase: 'HIGH_PASS_MOVE',
      attackingTeam: 'home',
      activeTeam: 'home',
      highPassMovementSlot: 'ATTACKER',
      highPassMovedPieceId: null,
      highPassPaceUsed: 0,
      highPassCarrierId: carrierId,
    };

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, carrierId, destHex);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_PIECE');

    const afterRoom = getRoom(roomCode);
    const afterCarrier = afterRoom?.gameState?.pieces.find((p) => p.id === carrierId);
    expect(afterCarrier?.position).toEqual(origPos);
    expect(afterRoom?.gameState?.highPassMovedPieceId ?? null).toBeNull();
  });

  it('regression: a non-carrier own-team piece still moves successfully in HIGH_PASS_MOVE', async () => {
    const { clientA, roomCode, state } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    const carrierId = 'home-9';
    const moverId = 'home-7';
    const mover = state.pieces.find((p) => p.id === moverId);
    if (!mover) throw new Error(`Piece ${moverId} not found in state`);
    const destHex = { q: mover.position.q + 1, r: mover.position.r };

    room.gameState = {
      ...room.gameState,
      // Clear any other piece off destHex so OCCUPIED would not otherwise fire.
      pieces: room.gameState.pieces.map((p) =>
        p.id !== moverId && p.position.q === destHex.q && p.position.r === destHex.r
          ? { ...p, position: { q: p.position.q, r: p.position.r + 1 } }
          : p,
      ),
      phase: 'HIGH_PASS_MOVE',
      attackingTeam: 'home',
      activeTeam: 'home',
      highPassMovementSlot: 'ATTACKER',
      highPassMovedPieceId: null,
      highPassPaceUsed: 0,
      highPassCarrierId: carrierId,
    };

    const afterMovePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, moverId, destHex);
    const [afterMove] = await afterMovePromise;

    expect(afterMove.pieces.find((p) => p.id === moverId)?.position).toEqual(destHex);
    expect(afterMove.highPassMovedPieceId).toBe(moverId);
  });
});
