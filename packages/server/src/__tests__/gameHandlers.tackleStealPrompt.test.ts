/**
 * Handler-level socket tests for GAME_TACKLE_STEAL_CHOICE (Phase 43 Plan 05), proving the
 * only reachable path into applyTackleStealChoice (43-04) end to end over a real Socket.io
 * server + socket.io-client. Structure mirrors gameHandlers.boxEntry.test.ts (server
 * lifecycle, createClient/oncePromise/waitForConnect/setupRoom; room seeded directly via
 * getRoom for phase/state manipulation rather than driving a real STEAL_ATTEMPT/
 * TACKLE_ATTEMPT through applyMove, since 43-04's gameEngine.tackleStealPrompt.test.ts
 * already covers the interception itself in isolation).
 *
 * Coverage (numbered to match the plan's <behavior> list):
 * 1. room.gameState === null -> WRONG_PHASE, mutates nothing.
 * 2. phase !== TACKLE_STEAL_PROMPT -> WRONG_PHASE.
 * 3. non-boolean payload -> INVALID_TARGET, mutates nothing.
 * 4. socket whose team !== tackleStealPromptTeam -> WRONG_TEAM, mutates nothing (including
 *    the ball carrier's own manager).
 * 5. a valid decline advances/resumes the sequence and broadcasts to both sockets.
 * 6. a valid attempt resolves the duel with dice generated in the handler.
 * 7. rollDice() is invoked exactly 5 times per handler call — two attempts in the same
 *    sequence never reuse the same die values (T-43-18).
 * 8. a second submission while room.isProcessing is true is silently dropped (SC-5).
 *
 * T-43-18's per-call-dice-generation test needs distinguishable-but-controllable dice, so
 * `../diceUtils.js` is mocked with a self-incrementing cycling implementation (1..6, never
 * reading crypto) rather than a single fixed value — every other test that needs a
 * deterministic outcome (e.g. a guaranteed STEAL success) overrides one call with
 * `mockReturnValueOnce`, which takes precedence over the cycling base implementation for
 * that single call only.
 */

// vi.mock is hoisted by vitest — must appear before other imports (mirrors
// gkDiveAtFeet.integration.test.ts / shotGkRange.test.ts).
import { vi } from 'vitest';
vi.mock('../diceUtils.js', () => {
  let n = 0;
  return {
    rollDice: vi.fn(() => {
      n += 1;
      return (n % 6) + 1;
    }),
  };
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import { rollDice } from '../diceUtils.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors gameHandlers.boxEntry.test.ts verbatim)
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
  vi.mocked(rollDice).mockClear();
});

// ---------------------------------------------------------------------------
// Helpers (mirrors gameHandlers.boxEntry.test.ts verbatim)
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

/**
 * Seeds room.gameState directly into TACKLE_STEAL_PROMPT (mirrors
 * gameHandlers.boxEntry.test.ts's seedPassIntoAwayBox/seedBoxEntryMove direct-mutation
 * convention) — the interception itself (applyMove -> TACKLE_STEAL_PROMPT) is already
 * covered by gameEngine.tackleStealPrompt.test.ts; this file's job is the socket handler.
 *
 * decidingTeam is the DEFENDING team (the team that owns tackleStealPromptDefenderId and
 * must respond); the carrier is always drawn from the opposing team.
 */
function seedTackleStealPrompt(
  roomCode: string,
  opts: { kind: 'STEAL' | 'TACKLE'; decidingTeam: 'home' | 'away'; queueCount?: number },
): { carrierId: string; defenderId: string; queueIds: string[] } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const carrierTeam: 'home' | 'away' = opts.decidingTeam === 'home' ? 'away' : 'home';
  const carrier = room.gameState.pieces.find((p) => p.teamId === carrierTeam && p.role !== 'GK')!;
  const defenders = room.gameState.pieces.filter(
    (p) => p.teamId === opts.decidingTeam && p.role !== 'GK',
  );
  const defender = defenders[0]!;
  const queueCount = opts.queueCount ?? 0;
  const queueIds = defenders.slice(1, 1 + queueCount).map((p) => p.id);

  room.gameState = {
    ...room.gameState,
    phase: 'TACKLE_STEAL_PROMPT',
    activeTeam: carrierTeam,
    attackingTeam: carrierTeam,
    movementSlot: 'ATTACKER_4',
    ball: { position: carrier.position, carrierId: carrier.id, lastTouchedBy: null },
    tackleStealPromptTeam: opts.decidingTeam,
    tackleStealPromptKind: opts.kind,
    tackleStealPromptDefenderId: defender.id,
    tackleStealPromptCarrierId: carrier.id,
    tackleStealPromptQueue: queueIds,
    tackleStealPromptResume: {
      phase: 'MOVE',
      activeTeam: carrierTeam,
      movementSlot: 'ATTACKER_4',
    },
  };
  room.lastBroadcastBallPosition = carrier.position;

  return { carrierId: carrier.id, defenderId: defender.id, queueIds };
}

// ---------------------------------------------------------------------------
// 1. Null-state guard
// ---------------------------------------------------------------------------

describe('GAME_TACKLE_STEAL_CHOICE — null-state guard', () => {
  it('a choice submitted while room.gameState is null emits WRONG_PHASE and mutates nothing', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode)!;
    room.gameState = null;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, true);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
    expect(getRoom(roomCode)!.gameState).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Phase guard
// ---------------------------------------------------------------------------

describe('GAME_TACKLE_STEAL_CHOICE — phase guard', () => {
  it('a choice submitted while the phase is not TACKLE_STEAL_PROMPT emits WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const phaseBefore = getRoom(roomCode)!.gameState!.phase;
    expect(phaseBefore).not.toBe('TACKLE_STEAL_PROMPT');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, true);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe(phaseBefore);
  });
});

// ---------------------------------------------------------------------------
// 3. Payload validation
// ---------------------------------------------------------------------------

describe('GAME_TACKLE_STEAL_CHOICE — non-boolean payload validation (ASVS V5)', () => {
  it('a non-boolean payload emits INVALID_TARGET and mutates nothing', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedTackleStealPrompt(roomCode, { kind: 'STEAL', decidingTeam: 'home' });
    const beforePieces = getRoom(roomCode)!.gameState!.pieces;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // Intentionally malformed payload (attacker-controlled) — must be a boolean.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, 'yes');
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    const afterState = getRoom(roomCode)!.gameState!;
    expect(afterState.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(afterState.pieces).toEqual(beforePieces);
  });
});

// ---------------------------------------------------------------------------
// 4. Team guard (T-43-16)
// ---------------------------------------------------------------------------

describe('T-43-16: GAME_TACKLE_STEAL_CHOICE access control', () => {
  it("a socket whose team is not tackleStealPromptTeam receives WRONG_TEAM and mutates nothing — including the ball carrier's own manager", async () => {
    const { clientA, roomCode } = await setupRoom();
    // decidingTeam is 'away' (clientB) — the carrier belongs to 'home' (clientA).
    // clientA is the CARRIER's manager, not the decider: still must be rejected.
    seedTackleStealPrompt(roomCode, { kind: 'STEAL', decidingTeam: 'away' });
    const beforePieces = getRoom(roomCode)!.gameState!.pieces;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, true);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    const afterState = getRoom(roomCode)!.gameState!;
    expect(afterState.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(afterState.pieces).toEqual(beforePieces);
  });
});

// ---------------------------------------------------------------------------
// 5. Valid decline
// ---------------------------------------------------------------------------

describe('GAME_TACKLE_STEAL_CHOICE — valid decline', () => {
  it('a valid decline advances/resumes the sequence and broadcasts to both sockets', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedTackleStealPrompt(roomCode, { kind: 'STEAL', decidingTeam: 'home' });

    const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, false);
    const [[stateA], [stateB]] = await Promise.all([statePromiseA, statePromiseB]);

    // Queue was empty -> the whole prompt cluster clears and play resumes.
    expect(stateA.phase).toBe('MOVE');
    expect(stateA.tackleStealPromptTeam).toBeNull();
    expect(stateB.phase).toBe('MOVE');
  });
});

// ---------------------------------------------------------------------------
// 6. Valid attempt
// ---------------------------------------------------------------------------

describe('GAME_TACKLE_STEAL_CHOICE — valid attempt', () => {
  it('a valid attempt resolves the duel with dice generated in the handler', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { defenderId } = seedTackleStealPrompt(roomCode, {
      kind: 'STEAL',
      decidingTeam: 'home',
    });
    // stealDie is the FIRST of the five dice rolled by the handler — die === 6 is an
    // unconditional STEAL success regardless of tackling/combined score.
    vi.mocked(rollDice).mockReturnValueOnce(6);

    const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, true);
    const [[stateA], [stateB]] = await Promise.all([statePromiseA, statePromiseB]);

    expect(stateA.phase).not.toBe('TACKLE_STEAL_PROMPT');
    expect(stateA.ball.carrierId).toBe(defenderId);
    expect(stateB.ball.carrierId).toBe(defenderId);
    const lastEvent = stateA.eventLog[stateA.eventLog.length - 1];
    expect(lastEvent?.type).toBe('STEAL_ATTEMPT');
  });
});

// ---------------------------------------------------------------------------
// 7. Per-call dice generation (T-43-18)
// ---------------------------------------------------------------------------

describe('T-43-18: dice are generated fresh per handler call', () => {
  it('rollDice() is invoked exactly 5 times per submission; two attempts in the same sequence do not reuse the same die values', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedTackleStealPrompt(roomCode, { kind: 'STEAL', decidingTeam: 'home', queueCount: 1 });
    vi.mocked(rollDice).mockClear();

    const firstStatePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, false);
    await firstStatePromise;
    expect(rollDice).toHaveBeenCalledTimes(5);
    const firstDice = vi.mocked(rollDice).mock.results.map((r) => r.value as number);

    // A second defender is now current (the queue had one entry) — same deciding team.
    const secondStatePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, false);
    await secondStatePromise;
    expect(rollDice).toHaveBeenCalledTimes(10);
    const secondDice = vi
      .mocked(rollDice)
      .mock.results.slice(5)
      .map((r) => r.value as number);

    expect(secondDice).not.toEqual(firstDice);
  });
});

// ---------------------------------------------------------------------------
// 8. isProcessing mutex (SC-5)
// ---------------------------------------------------------------------------

describe('SC-5: GAME_TACKLE_STEAL_CHOICE isProcessing mutex', () => {
  it('a second submission arriving while room.isProcessing is true is silently dropped', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedTackleStealPrompt(roomCode, { kind: 'STEAL', decidingTeam: 'home' });
    const room = getRoom(roomCode)!;
    room.isProcessing = true;

    clientA.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, true);
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(room.gameState!.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(room.isProcessing).toBe(true); // handler returned before the try block
  });
});
