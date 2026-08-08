/**
 * Handler-level socket integration tests for Phase 38's Corner Kick socket surface
 * (Plan 38-05). Structure mirrors throwIn.integration.test.ts / goalKick.integration.test.ts
 * (real Socket.io server + socket.io-client, no mocking; room store seeded directly via
 * getRoom for phase/state manipulation).
 *
 * Task 1 coverage (CORNER-01/CORNER-02):
 * - GAME_CORNER_KICK_GK_PLACE: malformed payload, WRONG_TEAM, WRONG_PHASE, success,
 *   double-emit mutex idempotency, finally-release on a rejected action.
 * - GAME_CORNER_KICK_TAKER: WRONG_TEAM, WRONG_PHASE, malformed payload, success,
 *   double-emit mutex idempotency, finally-release on a rejected action.
 * - GAME_END_TURN wiring for the two GK-setup windows (applyCornerKickGkWindowEnd).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import type {
  ClientToServerEvents,
  GameState,
  HexCoord,
  PlayerPiece,
  ServerToClientEvents,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors throwIn.integration.test.ts / goalKick.integration.test.ts)
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

/**
 * Waits for `n` GAME_STATE broadcasts on `client` and resolves with all of them in
 * arrival order. Used for double-emit mutex-idempotency tests, where a second emit
 * still produces a (no-op) snap-back broadcast that a single oncePromise would miss.
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
// Seed helpers — direct room.gameState mutation (mirrors goalKick.integration.test.ts)
// ---------------------------------------------------------------------------

const CORNER_KICK_TEAM: 'home' | 'away' = 'home';
const CORNER_HEX: HexCoord = { q: 0, r: 1 };

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 12 : 13, r: idx % 25 } },
  );
}

/**
 * Seeds one of the two corner-kick GK reposition windows. `phase` selects
 * CORNER_KICK_GK_SETUP_ATTACKING (activeTeam = cornerKickTeam) or
 * CORNER_KICK_GK_SETUP_DEFENDING (activeTeam = the opposing team) — mirrors
 * triggerOutOfBoundsRestart's/applyCornerKickGkWindowEnd's own activeTeam assignment.
 */
function seedCornerKickGkSetup(
  roomCode: string,
  phase: 'CORNER_KICK_GK_SETUP_ATTACKING' | 'CORNER_KICK_GK_SETUP_DEFENDING',
): { homeGk: PlayerPiece; awayGk: PlayerPiece } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const awayGk = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK')!;
  const activeTeam: 'home' | 'away' =
    phase === 'CORNER_KICK_GK_SETUP_ATTACKING'
      ? CORNER_KICK_TEAM
      : CORNER_KICK_TEAM === 'home'
        ? 'away'
        : 'home';

  const pieces = parkBackgroundPieces(room.gameState.pieces, new Set([homeGk.id, awayGk.id]));

  room.gameState = {
    ...room.gameState,
    phase,
    outOfBoundsEnabled: true,
    pieces,
    cornerKickTeam: CORNER_KICK_TEAM,
    cornerKickHex: CORNER_HEX,
    cornerKickTakerId: null,
    cornerKickEligibleIds: null,
    cornerKickStageIndex: null,
    cornerKickStagePlacedIds: null,
    cornerKickUsedPace: null,
    cornerKickMoveSlot: null,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    attackingTeam: CORNER_KICK_TEAM,
    activeTeam,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: CORNER_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: awayGk.id, teamId: 'away' },
    },
  };

  return { homeGk, awayGk };
}

/** Seeds CORNER_KICK_TAKER_SELECT with cornerKickTeam='home' and cornerKickHex fixed. */
function seedCornerKickTakerSelect(roomCode: string): {
  homeOutfield: PlayerPiece;
  awayOutfield: PlayerPiece;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeOutfield = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
  const awayOutfield = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;

  const pieces = parkBackgroundPieces(
    room.gameState.pieces,
    new Set([homeOutfield.id, awayOutfield.id]),
  );

  room.gameState = {
    ...room.gameState,
    phase: 'CORNER_KICK_TAKER_SELECT',
    outOfBoundsEnabled: true,
    pieces,
    cornerKickTeam: CORNER_KICK_TEAM,
    cornerKickHex: CORNER_HEX,
    cornerKickTakerId: null,
    cornerKickEligibleIds: null,
    cornerKickStageIndex: null,
    cornerKickStagePlacedIds: null,
    cornerKickUsedPace: null,
    cornerKickMoveSlot: null,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    attackingTeam: CORNER_KICK_TEAM,
    activeTeam: CORNER_KICK_TEAM,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: CORNER_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: awayOutfield.id, teamId: 'away' },
    },
  };

  return { homeOutfield, awayOutfield };
}

// ---------------------------------------------------------------------------
// CORNER-01: GAME_CORNER_KICK_GK_PLACE
// ---------------------------------------------------------------------------

describe('CORNER-01: GAME_CORNER_KICK_GK_PLACE', () => {
  it('a malformed payload (missing pieceId) is rejected and does not mutate the phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, 12345, { q: 1, r: 1 });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('a malformed `to` (non-object) is rejected and does not mutate the phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeGk.id, null);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('the non-acting team is rejected with WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { awayGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, awayGk.id, { q: 5, r: 5 });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('outside the two GK-setup phases the event is rejected with WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeOutfield.id, { q: 5, r: 5 });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_TAKER_SELECT');
  });

  it('a valid placement during the attacking GK window repositions the GK and broadcasts to both sockets', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { homeGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeGk.id, { q: 6, r: 6 });
    const [[stateA], [stateB]] = await Promise.all([stateAPromise, stateBPromise]);

    expect(stateA.pieces.find((p) => p.id === homeGk.id)!.position).toEqual({ q: 6, r: 6 });
    expect(stateB.pieces.find((p) => p.id === homeGk.id)!.position).toEqual({ q: 6, r: 6 });
    expect(stateA.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('the defending GK window accepts a placement from the defending team', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { awayGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_DEFENDING');

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, awayGk.id, { q: 30, r: 6 });
    const [state] = await statePromise;

    expect(state.pieces.find((p) => p.id === awayGk.id)!.position).toEqual({ q: 30, r: 6 });
  });

  it('two rapid successive emissions are each serialized through the isProcessing mutex and both land cleanly', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    // applyCornerKickGkPlace explicitly allows re-placing the same GK within the same
    // window (no lock/budget tracking, per its own doc comment) — so unlike
    // GAME_CORNER_KICK_TAKER (which transitions phase and blocks a second attempt),
    // GK_PLACE's mutex-serialization proof is that BOTH synchronous, back-to-back
    // emits complete cleanly (no corrupted/interleaved state) and the room is left
    // unlocked, with the final broadcast state reflecting the LAST accepted placement.
    const statesPromise = waitForNStates(clientA, 2);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeGk.id, { q: 6, r: 6 });
    clientA.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeGk.id, { q: 7, r: 6 });
    const states = await statesPromise;

    const placeEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'CORNER_KICK_GK_PLACE',
    );
    expect(placeEvents).toHaveLength(2);
    expect(states[states.length - 1]!.pieces.find((p) => p.id === homeGk.id)!.position).toEqual({
      q: 7,
      r: 6,
    });
    expect(getRoom(roomCode)!.isProcessing).toBe(false);
  });

  it('a rejected placement leaves room.isProcessing false (finally-release)', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { awayGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, awayGk.id, { q: 5, r: 5 });
    await errorPromise;

    expect(getRoom(roomCode)!.isProcessing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CORNER-02: GAME_CORNER_KICK_TAKER
// ---------------------------------------------------------------------------

describe('CORNER-02: GAME_CORNER_KICK_TAKER', () => {
  it('a piece belonging to the other team is rejected with WRONG_TEAM', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { awayOutfield } = seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, awayOutfield.id);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_TAKER_SELECT');
  });

  it('a non-kicking-team socket is rejected with WRONG_TEAM even for a valid own-team-of-the-kicker piece id', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { homeOutfield } = seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeOutfield.id);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
  });

  it('outside CORNER_KICK_TAKER_SELECT the event is rejected with WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeGk.id);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('a non-string payload is rejected and does not mutate the phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_CORNER_KICK_TAKER, 12345);
    await errorPromise;

    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_TAKER_SELECT');
  });

  it('a valid selection places the taker and the ball and transitions to CORNER_KICK_REPOSITION', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedCornerKickTakerSelect(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeOutfield.id);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_REPOSITION');
    expect(state.cornerKickTakerId).toBe(homeOutfield.id);
    expect(state.ball.carrierId).toBe(homeOutfield.id);
    expect(state.pieces.find((p) => p.id === homeOutfield.id)!.position).toEqual(CORNER_HEX);
  });

  it('two rapid successive emissions leave exactly one CORNER_KICK_TAKER_PLACED event in the log', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedCornerKickTakerSelect(roomCode);

    const statesPromise = waitForNStates(clientA, 1);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeOutfield.id);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeOutfield.id);
    await statesPromise;

    const placeEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'CORNER_KICK_TAKER_PLACED',
    );
    expect(placeEvents).toHaveLength(1);
  });

  it('a rejected selection leaves room.isProcessing false (finally-release)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { awayOutfield } = seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, awayOutfield.id);
    await errorPromise;

    expect(getRoom(roomCode)!.isProcessing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CORNER-01: GAME_END_TURN wiring for the two GK-setup windows
// ---------------------------------------------------------------------------

describe('CORNER-01: GAME_END_TURN wiring for CORNER_KICK_GK_SETUP_ATTACKING/_DEFENDING', () => {
  it('ending the attacking GK window with zero placements hands off to the defending window (D-06)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_GK_SETUP_DEFENDING');
    expect(state.activeTeam).toBe('away');
  });

  it('ending the defending GK window transitions to CORNER_KICK_TAKER_SELECT', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_DEFENDING');

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_TAKER_SELECT');
    expect(state.activeTeam).toBe('home');
  });

  it('the non-acting team ending the attacking GK window is rejected with WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });
});
