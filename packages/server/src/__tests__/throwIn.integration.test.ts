/**
 * Wave 0 socket-level integration tests for the full throw-in sequence (Phase 37 Plan 06).
 *
 * Covers THROWIN-01 through THROWIN-05 (T-37-01) end to end over a real Socket.io
 * server + socket.io-client — no mocking. Structure mirrors kickoffSetup.integration.test.ts
 * (server lifecycle, createClient/oncePromise/waitForConnect) and seeds restart phases the
 * same way gameHandlers.phase17-06.test.ts's seedFreeKickSetup does: drive to a room, then
 * mutate getRoom(code)!.gameState directly, then emit over the wire.
 *
 * Coverage:
 * - Placement (THROWIN-02, T-37-17/T-37-18): ownership/turn guards, payload validation,
 *   double-click idempotency.
 * - Movement-phase sequencing (THROWIN-03, D-09, T-37-19/T-37-20): mandatory Movement
 *   Phase 1, the three-way choice after it, the hard cap on a third Movement Phase.
 * - The throw (THROWIN-04): 6-hex cap (context-scoped, not a global regression of the
 *   11-hex Standard Pass range), off-pitch guard, context teardown on commit.
 * - Reclassification (THROWIN-05, D-04): an overthrown throw is reclassified by the same
 *   out-of-bounds detection system with no special-casing.
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
// Helpers (mirrors kickoffSetup.integration.test.ts / gameHandlers.phase17-06.test.ts)
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

/**
 * Waits for `n` GAME_STATE broadcasts on `client` and resolves with all of them in
 * arrival order. Used for the double-click idempotency test (Test 5), where a second
 * emit still produces a (no-op) snap-back broadcast that a single oncePromise would miss.
 */
function waitForNStates(
  client: Socket<ServerToClientEvents, ClientToServerEvents>,
  n: number,
  timeoutMs = 2000,
): Promise<GameState[]> {
  return new Promise((resolve, reject) => {
    const states: GameState[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${n} GAME_STATE broadcasts after ${timeoutMs}ms`));
    }, timeoutMs);
    const handler = (state: GameState): void => {
      states.push(state);
      if (states.length >= n) {
        clearTimeout(timer);
        client.off(ServerEvents.GAME_STATE, handler);
        resolve(states);
      }
    };
    client.on(ServerEvents.GAME_STATE, handler);
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

// ---------------------------------------------------------------------------
// Seed helpers — direct room.gameState mutation (mirrors seedFreeKickSetup)
// ---------------------------------------------------------------------------

/** A hex on the north touchline, well clear of both bylines (q stays in [17,19] on exit). */
const TOUCHLINE_HEX = { q: 18, r: 0 };
/** A pitch-centre hex used as the ball-carrier position for the "throw" test group. */
const CARRIER_HEX = { q: 18, r: 13 };
/** Exactly 6 hexes from CARRIER_HEX along the same row (verified via toCube/fromCube). */
const SIX_HEX_TARGET = { q: 24, r: 13 };
/** Exactly 7 hexes from CARRIER_HEX along the same row (verified via toCube/fromCube). */
const SEVEN_HEX_TARGET = { q: 25, r: 13 };
/** Off-pitch (q > 36) — triggers the throw-in-only OFF_PITCH guard regardless of distance. */
const OFF_PITCH_TARGET = { q: 40, r: 13 };

/**
 * Seeds THROW_IN_SETUP with the throwing team fixed to 'home' (clientA) for
 * determinism, a touchline-adjacent throwInHex, and the opposing team recorded as
 * the ball's last toucher (mirrors the real triggerOutOfBoundsRestart output shape).
 */
function seedThrowInSetup(roomCode: string): { throwInHex: typeof TOUCHLINE_HEX } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const throwInTeam: 'home' | 'away' = 'home';
  const otherTeam: 'home' | 'away' = 'away';
  const opponentThrower = room.gameState.pieces.find((p) => p.teamId === otherTeam)!;

  room.gameState = {
    ...room.gameState,
    phase: 'THROW_IN_SETUP',
    outOfBoundsEnabled: true,
    throwInHex: TOUCHLINE_HEX,
    throwInTeam,
    throwInPhasesTaken: 0,
    attackingTeam: throwInTeam,
    activeTeam: throwInTeam,
    kickOffActive: false,
    lastActionType: null,
    ball: {
      position: TOUCHLINE_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: opponentThrower.id, teamId: otherTeam },
    },
    // Defensive: guarantee no default-formation piece sits on the throw-in hex itself.
    pieces: room.gameState.pieces.map((p) =>
      p.position.q === TOUCHLINE_HEX.q && p.position.r === TOUCHLINE_HEX.r
        ? { ...p, position: { q: p.teamId === 'home' ? 2 : 34, r: 20 } }
        : p,
    ),
  };

  return { throwInHex: TOUCHLINE_HEX };
}

/**
 * Seeds a PASS-phase state with `lastActionType` set directly to one of the
 * THROW_IN_MOVEMENT_* rows (or 'MOVEMENT_PHASE' for the non-throw-in regression check),
 * a ball carrier at CARRIER_HEX, and every other piece scattered far from the
 * CARRIER_HEX -> {SIX,SEVEN}_HEX_TARGET corridor so interception/path-blocking never
 * fires for these distance-cap assertions.
 */
function seedThrowContextState(
  roomCode: string,
  lastActionType: 'THROW_IN_MOVEMENT_1' | 'THROW_IN_MOVEMENT_2' | 'MOVEMENT_PHASE',
): { carrierId: string; throwInTeam: 'home' | 'away' } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const throwInTeam: 'home' | 'away' = 'home';
  const carrier = room.gameState.pieces.find((p) => p.teamId === throwInTeam && p.role !== 'GK')!;
  const isThrowIn = lastActionType !== 'MOVEMENT_PHASE';

  const pieces = room.gameState.pieces.map((p, idx) =>
    p.id === carrier.id
      ? { ...p, position: CARRIER_HEX }
      : { ...p, position: { q: p.teamId === 'home' ? 2 : 34, r: idx % 25 } },
  );

  room.gameState = {
    ...room.gameState,
    phase: 'PASS',
    pieces,
    attackingTeam: throwInTeam,
    activeTeam: throwInTeam,
    lastActionType,
    kickOffActive: false,
    passTargetHex: null,
    ball: {
      position: CARRIER_HEX,
      carrierId: carrier.id,
      lastTouchedBy: { pieceId: carrier.id, teamId: throwInTeam },
    },
    throwInHex: isThrowIn ? TOUCHLINE_HEX : null,
    throwInTeam: isThrowIn ? throwInTeam : null,
    throwInPhasesTaken: isThrowIn ? (lastActionType === 'THROW_IN_MOVEMENT_1' ? 1 : 2) : null,
  };

  return { carrierId: carrier.id, throwInTeam };
}

/**
 * Seeds LOOSE_BALL at a hex directly on the north touchline row (r:0), with
 * outOfBoundsEnabled true and lastTouchedBy recording the throwing team's thrower —
 * the exact state an overthrown throw produces (THROWIN-05/D-04). direction die
 * values 2 (NE), 3 (NW), and 5 (SW) each exit the pitch at step 1 regardless of the
 * distance die (verified against computeLooseBall/toCube/fromCube — see gameEngine
 * .outOfBounds.test.ts's baseLooseBallState fixture family for the same underlying
 * geometry at a neighbouring row); the other 3 directions never exit within 1-6 hexes
 * from this position. The reclassification test below retries until one of the
 * exiting directions is rolled.
 */
function seedLooseBallForReclassification(roomCode: string): {
  throwingTeam: 'home' | 'away';
  otherTeam: 'home' | 'away';
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const throwingTeam: 'home' | 'away' = 'home';
  const otherTeam: 'home' | 'away' = 'away';
  const thrower = room.gameState.pieces.find((p) => p.teamId === throwingTeam && p.role !== 'GK')!;

  room.gameState = {
    ...room.gameState,
    phase: 'LOOSE_BALL',
    outOfBoundsEnabled: true,
    attackingTeam: throwingTeam,
    activeTeam: throwingTeam,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: TOUCHLINE_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: thrower.id, teamId: throwingTeam },
    },
    throwInHex: null,
    throwInTeam: null,
    throwInPhasesTaken: null,
    pieces: room.gameState.pieces.map((p) =>
      p.position.q === TOUCHLINE_HEX.q && p.position.r === TOUCHLINE_HEX.r
        ? { ...p, position: { q: p.teamId === 'home' ? 2 : 34, r: 20 } }
        : p,
    ),
  };

  return { throwingTeam, otherTeam };
}

/**
 * Drives the 4-5-2 sequence (ATTACKER_4 -> DEFENDER_5 -> ATTACKER_2) to completion via
 * three GAME_END_TURN calls with no piece movement (permitted — no handler enforces a
 * minimum-move requirement). Observes on `attackingClient` throughout (always clientA
 * in these tests, matching kickoffSetup.integration.test.ts's stale-buffer guidance).
 */
async function driveMovementPhaseToEnd(
  attackingClient: Socket<ServerToClientEvents, ClientToServerEvents>,
  defendingClient: Socket<ServerToClientEvents, ClientToServerEvents>,
): Promise<GameState> {
  const p1 = oncePromise(attackingClient, ServerEvents.GAME_STATE);
  attackingClient.emit(ClientEvents.GAME_END_TURN);
  await p1;

  const p2 = oncePromise(attackingClient, ServerEvents.GAME_STATE);
  defendingClient.emit(ClientEvents.GAME_END_TURN);
  await p2;

  const p3 = oncePromise(attackingClient, ServerEvents.GAME_STATE);
  attackingClient.emit(ClientEvents.GAME_END_TURN);
  const [finalState] = await p3;
  return finalState;
}

// ---------------------------------------------------------------------------
// Placement (THROWIN-02, T-37-17/T-37-18)
// ---------------------------------------------------------------------------

describe('THROWIN-02: GAME_THROW_IN_PLACE placement', () => {
  it('the throwing team placing their own piece transitions to a real Movement Phase 1', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowInSetup(roomCode);
    const room = getRoom(roomCode)!;
    const homeThrower = room.gameState!.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_THROW_IN_PLACE, homeThrower.id);
    const [state] = await statePromise;

    expect(state.phase).toBe('MOVE');
    expect(state.movementSlot).toBe('ATTACKER_4');
    const placedPiece = state.pieces.find((p) => p.id === homeThrower.id)!;
    expect(placedPiece.position).toEqual(TOUCHLINE_HEX);
    expect(state.ball.carrierId).toBe(homeThrower.id);
    expect(state.activeTeam).toBe('home');
  });

  it('T-37-17: the opposing team attempting placement receives GAME_ERROR and the phase stays THROW_IN_SETUP', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedThrowInSetup(roomCode);
    const room = getRoom(roomCode)!;
    const awayPiece = room.gameState!.pieces.find((p) => p.teamId === 'away')!;

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_THROW_IN_PLACE, awayPiece.id);
    await errorPromise;

    expect(getRoom(roomCode)!.gameState!.phase).toBe('THROW_IN_SETUP');
  });

  it('T-37-18: the throwing team attempting to place an opponent piece receives NOT_YOUR_PIECE', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowInSetup(roomCode);
    const room = getRoom(roomCode)!;
    const awayPiece = room.gameState!.pieces.find((p) => p.teamId === 'away')!;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_THROW_IN_PLACE, awayPiece.id);
    const [reason] = await errorPromise;

    expect(reason).toBe('NOT_YOUR_PIECE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('THROW_IN_SETUP');
  });

  it('a non-string payload is rejected and does not mutate the phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowInSetup(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_THROW_IN_PLACE, 12345);
    await errorPromise;

    expect(getRoom(roomCode)!.gameState!.phase).toBe('THROW_IN_SETUP');
  });

  it('two placements fired back to back leaves exactly one THROW_IN_PLACE event in the log', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowInSetup(roomCode);
    const room = getRoom(roomCode)!;
    const homeThrower = room.gameState!.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;

    const statesPromise = waitForNStates(clientA, 2);
    clientA.emit(ClientEvents.GAME_THROW_IN_PLACE, homeThrower.id);
    clientA.emit(ClientEvents.GAME_THROW_IN_PLACE, homeThrower.id);
    await statesPromise;

    const placeEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'THROW_IN_PLACE',
    );
    expect(placeEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Movement-phase sequencing (THROWIN-03, D-09, T-37-19/T-37-20)
// ---------------------------------------------------------------------------

describe('THROWIN-03/D-09: mandatory Movement Phase 1 and the per-step choice model', () => {
  it('T-37-19: Movement Phase 1 completes into lastActionType THROW_IN_MOVEMENT_1 with the counter at 1', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedThrowInSetup(roomCode);
    const room = getRoom(roomCode)!;
    const homeThrower = room.gameState!.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;

    const placePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_THROW_IN_PLACE, homeThrower.id);
    await placePromise;

    const finalState = await driveMovementPhaseToEnd(clientA, clientB);

    expect(finalState.phase).toBe('PASS');
    expect(finalState.lastActionType).toBe('THROW_IN_MOVEMENT_1');
    expect(finalState.throwInPhasesTaken).toBe(1);
  });

  it('T-37-20: GAME_START_MOVEMENT is accepted after Movement Phase 1 and Movement Phase 2 yields THROW_IN_MOVEMENT_2', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedThrowInSetup(roomCode);
    const room = getRoom(roomCode)!;
    const homeThrower = room.gameState!.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;

    const placePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_THROW_IN_PLACE, homeThrower.id);
    await placePromise;
    await driveMovementPhaseToEnd(clientA, clientB);

    const startPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_START_MOVEMENT);
    const [startedState] = await startPromise;
    expect(startedState.phase).toBe('MOVE');
    expect(startedState.movementSlot).toBe('ATTACKER_4');

    const finalState = await driveMovementPhaseToEnd(clientA, clientB);

    expect(finalState.phase).toBe('PASS');
    expect(finalState.lastActionType).toBe('THROW_IN_MOVEMENT_2');
    expect(finalState.throwInPhasesTaken).toBe(2);
  });

  it('T-37-20: GAME_START_MOVEMENT from THROW_IN_MOVEMENT_2 is rejected — no third Movement Phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowContextState(roomCode, 'THROW_IN_MOVEMENT_2');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_START_MOVEMENT);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SEQUENCE');
    expect(getRoom(roomCode)!.gameState!.phase).not.toBe('MOVE');
  });

  it('D-09: GAME_ROLL from THROW_IN_SETUP directly is rejected — Movement Phase 1 cannot be skipped', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowInSetup(roomCode);
    const eventLogBefore = getRoom(roomCode)!.gameState!.eventLog.length;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', { q: 19, r: 0 });
    await errorPromise;

    expect(getRoom(roomCode)!.gameState!.phase).toBe('THROW_IN_SETUP');
    expect(getRoom(roomCode)!.gameState!.eventLog.length).toBe(eventLogBefore);
  });
});

// ---------------------------------------------------------------------------
// The throw (THROWIN-04)
// ---------------------------------------------------------------------------

describe('THROWIN-04: the 6-hex Low/High throw', () => {
  it('a 6-hex Standard Pass throw is accepted', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowContextState(roomCode, 'THROW_IN_MOVEMENT_1');

    let errorReceived: string | null = null;
    const errorListener = (err: string): void => {
      errorReceived = err;
    };
    clientA.on(ServerEvents.GAME_ERROR, errorListener);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', SIX_HEX_TARGET);
    await statePromise;
    clientA.off(ServerEvents.GAME_ERROR, errorListener);

    expect(errorReceived).toBeNull();
    const passEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'STANDARD_PASS',
    );
    expect(passEvents).toHaveLength(1);
  });

  it('T-37-23: a 7-hex throw is rejected with INVALID_TARGET and no pass is committed', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowContextState(roomCode, 'THROW_IN_MOVEMENT_1');
    const eventLogBefore = getRoom(roomCode)!.gameState!.eventLog.length;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', SEVEN_HEX_TARGET);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.eventLog.length).toBe(eventLogBefore);
    const passEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'STANDARD_PASS',
    );
    expect(passEvents).toHaveLength(0);
  });

  it('the same 7-hex target IS accepted outside a throw-in context (MOVEMENT_PHASE) — the cap is context-scoped', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowContextState(roomCode, 'MOVEMENT_PHASE');

    let errorReceived: string | null = null;
    const errorListener = (err: string): void => {
      errorReceived = err;
    };
    clientA.on(ServerEvents.GAME_ERROR, errorListener);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', SEVEN_HEX_TARGET);
    await statePromise;
    clientA.off(ServerEvents.GAME_ERROR, errorListener);

    expect(errorReceived).not.toBe('INVALID_TARGET');
    const passEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'STANDARD_PASS',
    );
    expect(passEvents).toHaveLength(1);
  });

  it('T-37-26: a 6-hex High throw transitions to HIGH_PASS_MOVE and tears down the throw-in context', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowContextState(roomCode, 'THROW_IN_MOVEMENT_1');

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', SIX_HEX_TARGET);
    const [state] = await statePromise;

    expect(state.phase).toBe('HIGH_PASS_MOVE');
    expect(state.throwInHex).toBeNull();
    expect(state.throwInTeam).toBeNull();
    expect(state.throwInPhasesTaken).toBeNull();
  });

  it('T-37-24: an off-pitch target from a throw-in context receives OFF_PITCH', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedThrowContextState(roomCode, 'THROW_IN_MOVEMENT_1');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', OFF_PITCH_TARGET);
    const [reason] = await errorPromise;

    expect(reason).toBe('OFF_PITCH');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// Reclassification (THROWIN-05, D-04)
// ---------------------------------------------------------------------------

describe('THROWIN-05/D-04: an overthrown throw is reclassified by the same out-of-bounds system', () => {
  it('an overthrown throw exits the pitch and awards the throw-in to the other team, with no special-casing', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { otherTeam } = seedLooseBallForReclassification(roomCode);

    // Direction die is real crypto randomness (no dice mocking permitted here) — 3 of the 6
    // directions exit the pitch immediately from this position regardless of the
    // distance die (see seedLooseBallForReclassification's doc comment), so retry until
    // one of them is rolled. Failure probability after 60 attempts is ~2^-60.
    let finalState: GameState | undefined;
    const MAX_ATTEMPTS = 60;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      seedLooseBallForReclassification(roomCode);
      const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      clientA.emit(ClientEvents.GAME_ROLL);
      const [state] = await statePromise;
      if (state.phase === 'THROW_IN_SETUP') {
        finalState = state;
        break;
      }
    }

    expect(finalState).toBeDefined();
    expect(finalState!.phase).toBe('THROW_IN_SETUP');
    expect(finalState!.throwInTeam).toBe(otherTeam);
    const oobEvent = finalState!.eventLog.find((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvent).toBeDefined();
    if (oobEvent?.type === 'OUT_OF_BOUNDS') {
      expect(oobEvent.restart).toBe('THROW_IN');
      expect(oobEvent.kind).toBe('SIDELINE');
    }
  });
});
