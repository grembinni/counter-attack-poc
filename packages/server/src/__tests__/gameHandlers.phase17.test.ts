/**
 * Phase 17 Wave-0 handler integration tests — RED state.
 *
 * Covers:
 *  - BUG-02: game:cancel_movement handler — reverts MOVEMENT → PASS when no pieces moved
 *  - BUG-02: game:cancel_movement handler — emits GAME_ERROR when pieces already moved
 *  - PASS-02: SNAP_DEFLECT end-turn with lastActionType='FIRST_TIME_PASS' resolves as pass
 *
 * Test harness mirrors gameHandlers.test.ts and gameHandlers.phase10.test.ts:
 * real Socket.io server on port 0; room store seeded directly via getRoom.
 *
 * Wave 0 RED: All tests in this file are expected to FAIL until downstream plans implement:
 *  - Plan 02: applyCancelMovement + GAME_CANCEL_MOVEMENT socket handler
 *  - Plan 05: SNAP_DEFLECT PASS-02 discriminant in end-turn handler
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
// Helpers (mirrors gameHandlers.test.ts pattern exactly)
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

/**
 * Seeds a room into MOVEMENT phase (ATTACKER_4 slot) with home team active
 * and NO pieces moved yet (paceUsedByPieceId = {}).
 */
function seedMovementPhaseEmpty(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  room.gameState = {
    ...room.gameState,
    phase: 'MOVEMENT',
    attackingTeam: 'home',
    activeTeam: 'home',
    ball: { position: room.gameState.ball.position, carrierId: null },
    lastActionType: 'MOVEMENT_PHASE',
    kickOffActive: false,
    movedPieceIds: [],
    paceUsedByPieceId: {}, // empty — no piece has moved yet
    movementSlot: 'ATTACKER_4',
  };
}

/**
 * Seeds a room into MOVEMENT phase with a home piece having used 1 pace.
 * Simulates the state AFTER one piece has moved.
 */
function seedMovementPhaseWithMove(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  // Find a home outfielder to mark as having moved
  const homeOutfielder = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
  if (!homeOutfielder) throw new Error('No home outfielder found');

  room.gameState = {
    ...room.gameState,
    phase: 'MOVEMENT',
    attackingTeam: 'home',
    activeTeam: 'home',
    ball: { position: room.gameState.ball.position, carrierId: null },
    lastActionType: 'MOVEMENT_PHASE',
    kickOffActive: false,
    movedPieceIds: [],
    // A piece has used 1 hex of pace — cancel should be blocked
    paceUsedByPieceId: { [homeOutfielder.id]: 1 },
    movementSlot: 'ATTACKER_4',
  };
}

/**
 * Seeds a room into SNAP_DEFLECT phase simulating a First-time Pass in flight.
 * The room's lastActionType is 'FIRST_TIME_PASS' to trigger PASS-02 resolution.
 *
 * firstTimePassPath contains the hex path from passer to target.
 * A defending piece is placed ON the path so deflection should trigger.
 */
function seedSnapDeflectFirstTimePass(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homePasser = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
  const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
  if (!homePasser || !awayDefender || !awayGK) throw new Error('Required pieces not found');

  // Pass from passer at q:10 to target at q:14 — path goes through q:12
  const passerPos = { q: 10, r: 13 };
  const targetPos = { q: 14, r: 13 };
  const pathHex = { q: 12, r: 13 };

  // Place away defender ON the pass path to trigger deflection
  const awayGKPos = { q: 36, r: 13 };

  room.gameState = {
    ...room.gameState,
    phase: 'SNAP_DEFLECT',
    attackingTeam: 'home',
    activeTeam: 'away', // defender's turn in SNAP_DEFLECT
    ball: { position: passerPos, carrierId: null }, // ball in flight
    lastActionType: 'FIRST_TIME_PASS',
    kickOffActive: false,
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    snapDeflectMovedPieceId: null,
    snapDeflectPaceUsed: 0,
    passTargetHex: targetPos,
    firstTimePassPath: [passerPos, pathHex, targetPos], // passer → intermediate → target
    firstTimePassStep: null, // attacker step already done
    passerId: homePasser.id,
    pieces: room.gameState.pieces.map((p) => {
      if (p.id === homePasser.id) return { ...p, position: passerPos };
      // Defender positioned ON the pass path hex
      if (p.id === awayDefender.id) return { ...p, position: pathHex };
      if (p.id === awayGK.id) return { ...p, position: awayGKPos };
      return p;
    }),
  };
}

// ---------------------------------------------------------------------------
// BUG-02: GAME_CANCEL_MOVEMENT handler
// Wave 0 RED — handler not yet registered in gameHandlers.ts
// ---------------------------------------------------------------------------

describe('Phase 17 BUG-02: game:cancel_movement handler', () => {
  it('reverts MOVEMENT to PASS when no piece has moved (paceUsedByPieceId empty)', async () => {
    // Wave 0 RED — GAME_CANCEL_MOVEMENT event not handled by server yet
    const { clientA, roomCode } = await setupRoom();
    seedMovementPhaseEmpty(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_CANCEL_MOVEMENT);
    const [newState] = await statePromise;

    expect(newState.phase).toBe('PASS');
    expect(newState.movementSlot).toBeNull();
    expect(newState.movedPieceIds).toEqual([]);
    expect(newState.paceUsedByPieceId).toEqual({});
  });

  it('emits GAME_ERROR and leaves phase MOVEMENT when a piece has already moved', async () => {
    // Wave 0 RED — GAME_CANCEL_MOVEMENT event not handled by server yet
    const { clientA, roomCode } = await setupRoom();
    seedMovementPhaseWithMove(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_CANCEL_MOVEMENT);
    const [reason] = await errorPromise;

    expect(reason).toBe('PIECES_ALREADY_MOVED');
    // Phase should still be MOVEMENT
    const room = getRoom(roomCode);
    expect(room?.gameState?.phase).toBe('MOVEMENT');
  });
});

// ---------------------------------------------------------------------------
// PASS-02: SNAP_DEFLECT with lastActionType='FIRST_TIME_PASS'
// Wave 0 RED — SNAP_DEFLECT end-turn does not yet branch on lastActionType
// ---------------------------------------------------------------------------

describe('Phase 17 PASS-02: SNAP_DEFLECT end-turn resolves as pass when lastActionType=FIRST_TIME_PASS', () => {
  it('defender on pass path → LOOSE_BALL at deflector hex (not a shot duel outcome)', async () => {
    // Wave 0 RED — currently SNAP_DEFLECT end-turn runs shot-path logic regardless of lastActionType
    const { clientB, roomCode } = await setupRoom();
    seedSnapDeflectFirstTimePass(roomCode);

    // clientB is 'away' team; SNAP_DEFLECT activeTeam is 'away'
    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [newState] = await statePromise;

    // PASS-02 resolution: defender on path → LOOSE_BALL
    // The resulting phase should be LOOSE_BALL (ball deflected), not a shot-duel phase
    expect(['LOOSE_BALL', 'PASS']).toContain(newState.phase);
    // firstTimePassStep and firstTimePassPath should be cleared after resolution
    expect(newState.firstTimePassStep ?? null).toBeNull();
    // The outcome should NOT be a shot duel phase (GK_DIVING, SHOT, SHOT_DECLARED)
    expect(['GK_DIVING', 'SHOT', 'SHOT_DECLARED']).not.toContain(newState.phase);
  });
});
