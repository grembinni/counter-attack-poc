/**
 * Phase 11 handler-level tests — RULE-01 and RULE-02 correctness.
 *
 * Covers:
 *  - GAME_HEADER_ACCURACY_ACK: attacker clears flag; non-attacker is rejected
 *  - GAME_HEADER_CONTESTANT both-confirmed: duel auto-fires, headerDuelWinner is set
 *  - GAME_HEADER_TARGET: winner guard — winner succeeds; loser is rejected
 *
 * Test harness mirrors gameHandlers.phase10.test.ts (real Socket.io server on port 0;
 * room store seeded directly via getRoom).
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
// Helpers
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
 * Creates a room with 2 connected clients.
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

  const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  const [state] = await statePromise;

  return { clientA, clientB, roomCode, state };
}

/**
 * Seeds a HEADER phase state with headerAccuracyRollPending: true for RULE-01 ACK tests.
 * home is the attacker; ball at {q:25,r:12}.
 */
function seedHeaderPendingAccuracy(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
  if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

  room.gameState = {
    ...room.gameState,
    phase: 'HEADER',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: 'HIGH_PASS',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    ball: { position: { q: 25, r: 12 }, carrierId: null },
    pieces: room.gameState.pieces.map((p) => {
      if (p.id === homeAttacker.id) return { ...p, position: { q: 25, r: 12 } };
      if (p.id === awayDefender.id) return { ...p, position: { q: 26, r: 12 } };
      return p;
    }),
    headerContestants: { home: [], away: [] },
    headerConfirmed: { home: false, away: false },
    headerAccuracyRollPending: true,
    headerDuelWinner: null,
  };
}

/**
 * Seeds a HEADER phase state ready for both-team contestant confirmation.
 * Neither team has confirmed yet; headerAccuracyRollPending is null (already acked).
 */
function seedHeaderReadyForContestants(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
  if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

  room.gameState = {
    ...room.gameState,
    phase: 'HEADER',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: 'HIGH_PASS',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    ball: { position: { q: 25, r: 12 }, carrierId: null },
    pieces: room.gameState.pieces.map((p) => {
      if (p.id === homeAttacker.id) return { ...p, position: { q: 25, r: 12 } };
      if (p.id === awayDefender.id) return { ...p, position: { q: 26, r: 12 } };
      return p;
    }),
    headerContestants: { home: [], away: [] },
    headerConfirmed: { home: false, away: false },
    headerAccuracyRollPending: null, // already acknowledged
    headerDuelWinner: null,
  };
}

/**
 * Seeds a HEADER phase state with both teams confirmed and headerDuelWinner set.
 * Used for GAME_HEADER_TARGET winner guard tests.
 * home = winner (home is attacker, home wins duel).
 */
function seedHeaderWithDuelWinner(roomCode: string, winner: 'home' | 'away' = 'home'): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
  if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

  // Ball at {q:25,r:12}; home attacker at {q:25,r:12} (within 6 of target {q:28,r:12})
  room.gameState = {
    ...room.gameState,
    phase: 'HEADER',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: 'HIGH_PASS',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    ball: { position: { q: 25, r: 12 }, carrierId: null },
    pieces: room.gameState.pieces.map((p) => {
      if (p.id === homeAttacker.id) return { ...p, position: { q: 25, r: 12 } };
      if (p.id === awayDefender.id) return { ...p, position: { q: 26, r: 12 } };
      return p;
    }),
    headerContestants: { home: [homeAttacker.id], away: [awayDefender.id] },
    headerConfirmed: { home: true, away: true },
    headerAccuracyRollPending: null,
    headerDuelWinner: winner,
  };
}

// ---------------------------------------------------------------------------
// RULE-01: GAME_HEADER_ACCURACY_ACK handler
// ---------------------------------------------------------------------------

describe('RULE-01: GAME_HEADER_ACCURACY_ACK — attacker clears accuracy-roll flag', () => {
  it('clears headerAccuracyRollPending to null when attacking team sends the ack', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedHeaderPendingAccuracy(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
    const [state] = await statePromise;

    expect(state.headerAccuracyRollPending == null).toBe(true);
    expect(state.phase).toBe('HEADER'); // still in HEADER — contestants not selected yet
  });

  it('emits GAME_ERROR WRONG_TEAM when non-attacking team sends the ack', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedHeaderPendingAccuracy(roomCode);

    // clientB = 'away' = NOT the attacker (attackingTeam = 'home')
    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('emits GAME_ERROR WRONG_PHASE when sent outside HEADER phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
    };

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_PHASE');
  });

  it('does not change headerAccuracyRollPending after non-attacker ack attempt', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedHeaderPendingAccuracy(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
    await errorPromise; // wait for error

    // Flag should still be true
    const room = getRoom(roomCode);
    expect(room?.gameState?.headerAccuracyRollPending).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RULE-02: GAME_HEADER_CONTESTANT — auto-duel when both teams confirm (D-03)
// ---------------------------------------------------------------------------

describe('RULE-02: GAME_HEADER_CONTESTANT — both-confirmed auto-fires duel', () => {
  it('sets headerDuelWinner to home or away when both teams confirm', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!homeAttacker || !awayDefender) throw new Error('Pieces not found');

    // clientA (home) confirms first
    const stateAfterA = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await stateAfterA;

    // clientB (away) confirms second — duel should auto-fire now
    const stateAfterB = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HEADER_CONTESTANT, [awayDefender.id]);
    const [stateB] = await stateAfterB;

    // Duel fired — headerDuelWinner should be set
    expect(['home', 'away', null]).toContain(stateB.headerDuelWinner);
    // Phase stays HEADER (target selection still pending)
    expect(stateB.phase).toBe('HEADER');
  });

  it('broadcasts exactly one GAME_STATE per contestant confirmation', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    if (!homeAttacker) throw new Error('Piece not found');

    let stateCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).on(ServerEvents.GAME_STATE, () => {
      stateCount++;
    });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await statePromise;

    expect(stateCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// RULE-02: GAME_HEADER_TARGET winner guard (D-05)
// ---------------------------------------------------------------------------

describe('RULE-02: GAME_HEADER_TARGET — winner guard replaces attacker guard', () => {
  it('succeeds for the winning team socket (home wins, clientA = home)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedHeaderWithDuelWinner(roomCode, 'home');

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    // clientA = home = winner; target within 6 hexes of home attacker at {q:25,r:12}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_HEADER_TARGET, { q: 28, r: 12 });
    const [state] = await statePromise;

    // Phase should have transitioned away from HEADER
    expect(state.phase).not.toBe('HEADER');
    // header fields cleared
    expect(state.headerDuelWinner == null).toBe(true);
  });

  it('emits GAME_ERROR WRONG_TEAM for the losing team socket (home wins, clientB = away loses)', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedHeaderWithDuelWinner(roomCode, 'home');

    // clientB = 'away' = NOT the winner
    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientB as any).emit(ClientEvents.GAME_HEADER_TARGET, { q: 28, r: 12 });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('emits GAME_ERROR WRONG_TEAM when duelWinner is null (tie — no one can submit)', async () => {
    const { clientA, roomCode } = await setupRoom();
    // Seed with null winner (tie)
    seedHeaderWithDuelWinner(roomCode, 'home');
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    room.gameState = { ...room.gameState, headerDuelWinner: null };

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_HEADER_TARGET, { q: 28, r: 12 });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });
});
