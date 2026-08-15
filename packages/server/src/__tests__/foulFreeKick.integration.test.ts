/**
 * Wave 5 socket-level integration tests for the foul chain (Phase 39 Plan 13), proving
 * FOUL-01/02/03/05, CARD-01, INJURY-01, and FK-01 end to end over a real Socket.io
 * server + socket.io-client — no mocking of the server itself. Structure mirrors
 * penaltyKick.integration.test.ts / gameHandlers.phase17-06.test.ts (server lifecycle,
 * createClient/oncePromise/waitForConnect/waitForNStates/setupRoom).
 *
 * Because the die-of-1 foul trigger is not independently reachable through the normal
 * client-driven flow, the deterministic parts of the chain are seeded by calling the
 * real, unmocked `applyMove` engine function directly with an injected `stealDie: 1` /
 * `tackleDie: 1` (exactly the "seed via engine, then drive over sockets" pattern PEN-03
 * already established in penaltyKick.integration.test.ts) — the socket layer then takes
 * over for every access-control, ordering, and transport assertion. The one exception is
 * the T-39-13-01 die-provenance suite at the bottom of this file, which mocks
 * `../diceUtils.js` (mirrors gameHandlers.rule11.test.ts's `rollDice()` mock) so that a
 * REAL `GAME_MOVE` emission deterministically reaches the foul chain without relying on
 * a 1-in-6 random trigger.
 *
 * Coverage (numbered to match the plan's Task 2 action list):
 * 1. FOUL-02 event ordering within a single broadcastState snapshot (duel -> FOUL_CALLED
 *    -> INJURY_CHECK -> BOOKING_CHECK).
 * 2. GAME_FOUL_CHOICE from the FOULING manager -> WRONG_TEAM, no phase change.
 * 3. GAME_FOUL_CHOICE with a forged choice value -> INVALID_CHOICE, no mutation.
 * 4. GAME_FOUL_CHOICE from a phase other than FOUL_CHOICE -> WRONG_PHASE.
 * 5. GAME_FOUL_CHOICE('continue') restores foulResume and appends FOUL_CHOICE_MADE.
 * 6. GAME_FOUL_CHOICE('restart') with foulSource 'TACKLE' -> FREE_KICK_SETUP (FK-01).
 * 7. The untouched FREE_KICK_SETUP flow still works: a real GAME_FREE_KICK_MOVE and
 *    GAME_FREE_KICK_READY after the FK-01 transition.
 * 8. A double-emitted GAME_FOUL_CHOICE produces exactly one FOUL_CHOICE_MADE (mutex).
 * 9. foulsEnabled: false -> a GAME_MOVE that would otherwise duel never produces
 *    FOUL_CALLED (FOUL-05 over the wire).
 * 10. GAME_MOVE dice are always server-rolled (T-39-13-01): forged extra dice fields on
 *     the payload are ignored; INJURY_CHECK/BOOKING_CHECK die values are always the
 *     server-mocked value, never the forged one.
 */

// vi.mock is hoisted by vitest — must appear before other imports (mirrors
// gameHandlers.rule11.test.ts). Forces every rollDice() call made by the real socket
// handler to return 1 — exactly FOUL_TRIGGER_DIE — so a real GAME_MOVE that reaches a
// STEAL_ATTEMPT/TACKLE_ATTEMPT deterministically fires the foul chain, without relying
// on a 1-in-6 random roll. Only exercised by the T-39-13-01 suite at the bottom of this
// file; every other test seeds its FOUL_CHOICE state via a direct `applyMove` call with
// explicit injected dice, which never reads this mock.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../diceUtils.js', () => ({ rollDice: () => 1 }));

import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { broadcastState, clearAllRooms, getRoom } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import { applyMove, applyFreeKickMove, applyFoulChoice } from '../gameEngine.js';
import type {
  ClientToServerEvents,
  GameState,
  HexCoord,
  PlayerPiece,
  ServerToClientEvents,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents, hexNeighbors, isPitchHex } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors penaltyKick.integration.test.ts verbatim)
// ---------------------------------------------------------------------------

let httpServer: ReturnType<typeof buildServer>['httpServer'];
let io: ReturnType<typeof buildServer>['io'];
let address: string;
const connectedClients: Socket[] = [];

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  io = server.io;
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
// Helpers (mirrors penaltyKick.integration.test.ts verbatim)
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
 * arrival order. Used for the double-emit mutex-proof test (item 8), where a second
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
// Seed helpers — direct room.gameState mutation (mirrors penaltyKick.integration.test.ts's
// seed-helper family) plus a real, unmocked `applyMove` call to reach FOUL_CHOICE
// deterministically. A single shared verified-adjacent triangle of real pitch hexes
// (CENTER / MID_HEX / DEFENDER_HEX) supports both STEAL_ATTEMPT (carrier moves
// CENTER -> MID_HEX) and TACKLE_ATTEMPT (defender moves DEFENDER_HEX -> MID_HEX)
// triggers, mirroring gameEngine.fouls.test.ts's {q:10,r:7}/{q:11,r:7}/{q:12,r:7}
// fixture pattern but computed from the real hexNeighbors() utility (never invented
// literals) and kept well inside middleThird (q in [11,25]) so a real GAME_MOVE never
// crosses a third and triggers the unrelated MOVE-06 zone-check overlay.
// ---------------------------------------------------------------------------

const CENTER: HexCoord = { q: 18, r: 13 };
const MID_HEX: HexCoord = hexNeighbors(CENTER).find((h) => isPitchHex(h))!;
const DEFENDER_HEX: HexCoord = hexNeighbors(MID_HEX).find(
  (h) => isPitchHex(h) && !(h.q === CENTER.q && h.r === CENTER.r),
)!;

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 2 : 34, r: idx % 25 } },
  );
}

/**
 * Positions a real home carrier at CENTER (holding the ball) and a real away defender at
 * DEFENDER_HEX, parks every other piece off in the corners, and seeds a fresh MOVE phase
 * with movementSlot/activeTeam set for whichever duel type the caller wants
 * (ATTACKER_4/home for STEAL_ATTEMPT, DEFENDER_5/away for TACKLE_ATTEMPT).
 */
function seedMoveState(
  roomCode: string,
  opts: {
    movementSlot: 'ATTACKER_4' | 'DEFENDER_5';
    activeTeam: 'home' | 'away';
    foulsEnabled?: boolean;
    injuryEnabled?: boolean;
    bookingEnabled?: boolean;
  },
): { carrier: PlayerPiece; defender: PlayerPiece } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const carrier = homeOutfield[0]!;
  const defender = awayOutfield[0]!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === carrier.id) return { ...p, position: CENTER };
    if (p.id === defender.id) return { ...p, position: DEFENDER_HEX };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([carrier.id, defender.id]));

  room.gameState = {
    ...room.gameState,
    pieces,
    phase: 'MOVE',
    attackingTeam: 'home',
    activeTeam: opts.activeTeam,
    movementSlot: opts.movementSlot,
    movedPieceIds: [],
    paceUsedByPieceId: {},
    stealAttemptedByIds: [],
    tackleAttemptedByIds: [],
    ball: { position: CENTER, carrierId: carrier.id, lastTouchedBy: null },
    ballZone: 'middle',
    foulsEnabled: opts.foulsEnabled ?? true,
    injuryEnabled: opts.injuryEnabled ?? true,
    bookingEnabled: opts.bookingEnabled ?? true,
  };

  return { carrier, defender };
}

/** Seeds FOUL_CHOICE via a real STEAL_ATTEMPT (carrier moves CENTER -> MID_HEX, injected stealDie: 1). */
function seedFoulChoiceViaSteal(
  roomCode: string,
  diceOverrides: { injuryDie?: number; bookingDie?: number } = {},
): { carrier: PlayerPiece; defender: PlayerPiece; foulHex: HexCoord } {
  const { carrier, defender } = seedMoveState(roomCode, {
    movementSlot: 'ATTACKER_4',
    activeTeam: 'home',
  });
  const room = getRoom(roomCode)!;
  const result = applyMove(room.gameState!, carrier.id, MID_HEX, {
    stealDie: 1,
    tackleDie: 3,
    carrierDie: 3,
    injuryDie: diceOverrides.injuryDie ?? 3,
    bookingDie: diceOverrides.bookingDie ?? 3,
  });
  if (!result.ok) throw new Error(`Seed applyMove (steal) failed: ${result.reason}`);
  room.gameState = result.state;
  return { carrier, defender, foulHex: MID_HEX };
}

/**
 * Seeds FOUL_CHOICE via a real TACKLE_ATTEMPT (defender moves DEFENDER_HEX -> MID_HEX,
 * injected tackleDie: 1).
 *
 * 39-18 (UAT gap 2): the returned `foulHex` is the stationary carrier's own hex (CENTER),
 * NOT the fouling defender's destination hex (MID_HEX) — the tackling defender moves to
 * `to` unconditionally, win or lose the duel, so `to`/MID_HEX is the FOULER's hex, while
 * the restart belongs where the ball was, i.e. the carrier's hex.
 */
function seedFoulChoiceViaTackle(
  roomCode: string,
  diceOverrides: { injuryDie?: number; bookingDie?: number } = {},
): { carrier: PlayerPiece; defender: PlayerPiece; foulHex: HexCoord } {
  const { carrier, defender } = seedMoveState(roomCode, {
    movementSlot: 'DEFENDER_5',
    activeTeam: 'away',
  });
  const room = getRoom(roomCode)!;
  const result = applyMove(room.gameState!, defender.id, MID_HEX, {
    stealDie: 3,
    tackleDie: 1,
    carrierDie: 3,
    injuryDie: diceOverrides.injuryDie ?? 3,
    bookingDie: diceOverrides.bookingDie ?? 3,
  });
  if (!result.ok) throw new Error(`Seed applyMove (tackle) failed: ${result.reason}`);
  room.gameState = result.state;
  return { carrier, defender, foulHex: CENTER };
}

// ---------------------------------------------------------------------------
// 1. FOUL-02: event ordering within a single broadcastState snapshot
// ---------------------------------------------------------------------------

describe('FOUL-02: event ordering within a single broadcast', () => {
  it('a single broadcast after a die-of-1 STEAL_ATTEMPT contains, in order, the duel event, FOUL_CALLED, INJURY_CHECK and BOOKING_CHECK', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedFoulChoiceViaSteal(roomCode);
    const room = getRoom(roomCode)!;

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    broadcastState(io, room);
    const [[stateA], [stateB]] = await Promise.all([stateAPromise, stateBPromise]);

    expect(stateA.phase).toBe('FOUL_CHOICE');
    for (const state of [stateA, stateB]) {
      const duelIdx = state.eventLog.findIndex((e) => e.type === 'STEAL_ATTEMPT');
      const foulIdx = state.eventLog.findIndex((e) => e.type === 'FOUL_CALLED');
      const injuryIdx = state.eventLog.findIndex((e) => e.type === 'INJURY_CHECK');
      const bookingIdx = state.eventLog.findIndex((e) => e.type === 'BOOKING_CHECK');
      expect(duelIdx).toBeGreaterThanOrEqual(0);
      expect(foulIdx).toBeGreaterThan(duelIdx);
      expect(injuryIdx).toBeGreaterThan(foulIdx);
      expect(bookingIdx).toBeGreaterThan(injuryIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// 2-5, 8. GAME_FOUL_CHOICE access control and resolution
// ---------------------------------------------------------------------------

describe('GAME_FOUL_CHOICE', () => {
  it('the FOULING manager (away) submitting a choice receives WRONG_TEAM and the phase stays FOUL_CHOICE', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedFoulChoiceViaSteal(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_FOUL_CHOICE, 'continue');
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('FOUL_CHOICE');
  });

  it('a forged choice value ("penalty") receives INVALID_CHOICE and mutates nothing', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedFoulChoiceViaSteal(roomCode);
    const before = getRoom(roomCode)!.gameState!;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // Intentionally malformed payload (attacker-controlled) — must be rejected before
    // any mutation, per T-39-13-03's explicit two-value allow-list.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_FOUL_CHOICE, 'penalty');
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_CHOICE');
    const after = getRoom(roomCode)!.gameState!;
    expect(after.phase).toBe('FOUL_CHOICE');
    expect(after.eventLog.length).toBe(before.eventLog.length);
  });

  it('a phase other than FOUL_CHOICE returns WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    expect(getRoom(roomCode)!.gameState!.phase).not.toBe('FOUL_CHOICE');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_FOUL_CHOICE, 'continue');
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
  });

  it("'continue' from the fouled manager restores foulResume's phase/activeTeam/attackingTeam/movementSlot and appends FOUL_CHOICE_MADE with restart: null", async () => {
    const { clientA, roomCode } = await setupRoom();
    seedFoulChoiceViaSteal(roomCode);
    const seeded = getRoom(roomCode)!.gameState!;
    const expectedResume = seeded.foulResume!;
    expect(expectedResume).toBeDefined();

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FOUL_CHOICE, 'continue');
    const [state] = await statePromise;

    expect(state.phase).toBe(expectedResume.phase);
    expect(state.activeTeam).toBe(expectedResume.activeTeam);
    expect(state.attackingTeam).toBe(expectedResume.attackingTeam);
    expect(state.movementSlot).toBe(expectedResume.movementSlot);
    expect(state.foulDefenderId).toBeNull();
    expect(state.foulVictimId).toBeNull();
    expect(state.foulHex).toBeNull();
    expect(state.foulSource).toBeNull();
    expect(state.foulResume).toBeNull();

    const madeEvent = state.eventLog.find((e) => e.type === 'FOUL_CHOICE_MADE');
    expect(madeEvent).toBeDefined();
    if (madeEvent?.type === 'FOUL_CHOICE_MADE') {
      expect(madeEvent.choice).toBe('continue');
      expect(madeEvent.restart).toBeNull();
      expect(madeEvent.team).toBe('home');
    }
  });

  it('a double-emitted GAME_FOUL_CHOICE results in exactly one FOUL_CHOICE_MADE event (isProcessing mutex)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedFoulChoiceViaSteal(roomCode);

    const statesPromise = waitForNStates(clientA, 2);
    clientA.emit(ClientEvents.GAME_FOUL_CHOICE, 'continue');
    clientA.emit(ClientEvents.GAME_FOUL_CHOICE, 'continue');
    await statesPromise;

    const finalState = getRoom(roomCode)!.gameState!;
    const madeEvents = finalState.eventLog.filter((e) => e.type === 'FOUL_CHOICE_MADE');
    expect(madeEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 6-7. FK-01: 'restart' with foulSource 'TACKLE' reaches the untouched FREE_KICK_SETUP flow
// ---------------------------------------------------------------------------

describe('FK-01: restart routes a TACKLE-sourced foul into the untouched FREE_KICK_SETUP flow', () => {
  it("'restart' from the fouled manager with foulSource 'TACKLE' transitions to FREE_KICK_SETUP with freeKickHex at the foul hex, freeKickAttackingTeam the fouled team, freeKickStageIndex 0, freeKickPlacedPieceIds [] and freeKickKickerChosen false — and the existing FREE_KICK_SETUP flow (GAME_FREE_KICK_MOVE + GAME_FREE_KICK_READY) still works unchanged", async () => {
    const { clientA, roomCode } = await setupRoom();
    seedFoulChoiceViaTackle(roomCode);
    const seeded = getRoom(roomCode)!.gameState!;
    expect(seeded.foulSource).toBe('TACKLE');
    const foulHex = seeded.foulHex!;
    const fouledTeam = seeded.attackingTeam; // 'home' — the carrier's team

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FOUL_CHOICE, 'restart');
    const [state] = await statePromise;

    expect(state.phase).toBe('FREE_KICK_SETUP');
    expect(state.freeKickHex).toEqual(foulHex);
    expect(state.freeKickAttackingTeam).toBe(fouledTeam);
    expect(state.freeKickStageIndex).toBe(0);
    expect(state.freeKickPlacedPieceIds).toEqual([]);
    expect(state.freeKickKickerChosen).toBe(false);
    const madeEvent = state.eventLog.find((e) => e.type === 'FOUL_CHOICE_MADE');
    if (madeEvent?.type === 'FOUL_CHOICE_MADE') {
      expect(madeEvent.choice).toBe('restart');
      expect(madeEvent.restart).toBe('FREE_KICK');
    }

    // 39-18 (UAT gap 2): foulHex is now the CARRIER's hex (the ball's hex), not the
    // fouling defender's landing hex — so the fouled team's own carrier (kicking team,
    // 'home') is EXPECTED to remain standing exactly on freeKickHex; it is the CONCEDING
    // team ('away', which includes the tackling defender who landed adjacent to the
    // carrier at MID_HEX) that relocateTrappedFreeKickPieces must have cleared away from
    // freeKickHex, or the kicking team's mandatory kicker-first placement below would be
    // permanently stuck behind OCCUPIED (the same class of bug D-59 already fixed for
    // OFFSIDE-02).
    const concedingTeam: 'home' | 'away' = fouledTeam === 'home' ? 'away' : 'home';
    expect(
      state.pieces.some(
        (p) =>
          p.teamId === concedingTeam && p.position.q === foulHex.q && p.position.r === foulHex.r,
      ),
    ).toBe(false);
    // The kicking team's own carrier legitimately still stands exactly on freeKickHex —
    // this is the T-39-18-05 threat-register condition Task 3's next assertion proves is
    // still playable, not a bug.
    expect(
      state.pieces.some(
        (p) => p.teamId === fouledTeam && p.position.q === foulHex.q && p.position.r === foulHex.r,
      ),
    ).toBe(true);

    // FK-01: the kicking team (fouledTeam, 'home') places their kicker on freeKickHex —
    // a real GAME_FREE_KICK_MOVE through the untouched, pre-existing handler.
    const kicker = state.pieces.find((p) => p.teamId === fouledTeam && p.role !== 'GK')!;
    const moveStatePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FREE_KICK_MOVE, kicker.id, state.freeKickHex!);
    const [afterMove] = await moveStatePromise;
    expect(afterMove.pieces.find((p) => p.id === kicker.id)!.position).toEqual(state.freeKickHex);
    expect(afterMove.freeKickKickerChosen).toBe(true);

    // GAME_FREE_KICK_READY (stage 0 -> 1) advances the stage — the untouched sibling handler.
    const readyStatePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FREE_KICK_READY);
    const [afterReady] = await readyStatePromise;
    expect(afterReady.freeKickStageIndex).toBe(1);
  });

  it('39-18 (integration risk proof): the fouled carrier now standing exactly on freeKickHex can still complete the mandatory kicker-first placement via applyFreeKickMove', async () => {
    const { roomCode } = await setupRoom();
    const { carrier } = seedFoulChoiceViaTackle(roomCode);
    const seeded = getRoom(roomCode)!.gameState!;
    expect(seeded.foulSource).toBe('TACKLE');

    // applyFoulChoice('restart') — direct engine call, exercising the exact same path
    // GAME_FOUL_CHOICE drives, to keep this a pure engine-level proof.
    const restarted = applyFoulChoice(seeded, 'restart');
    expect(restarted.ok).toBe(true);
    if (!restarted.ok) return;
    const state = restarted.state;
    expect(state.phase).toBe('FREE_KICK_SETUP');
    expect(state.freeKickKickerChosen).toBe(false);

    // 39-18/Task 1: the carrier is the fouled team's own piece — relocateTrappedFreeKickPieces
    // only relocates the CONCEDING team, so the carrier is left standing exactly on
    // freeKickHex (the ball's hex at the moment of the foul).
    const carrierAfter = state.pieces.find((p) => p.id === carrier.id)!;
    expect(carrierAfter.position).toEqual(state.freeKickHex);

    const moveResult = applyFreeKickMove(state, carrier.id, state.freeKickHex!);
    expect(moveResult.ok).toBe(true);
    if (!moveResult.ok) return;
    expect(moveResult.state.freeKickKickerChosen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. FOUL-05: foulsEnabled toggle gate, over the wire
// ---------------------------------------------------------------------------

describe('FOUL-05: foulsEnabled: false gates the whole chain over the wire', () => {
  it('with foulsEnabled: false, a real GAME_MOVE that would otherwise trigger a duel never produces a FOUL_CALLED event', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { carrier } = seedMoveState(roomCode, {
      movementSlot: 'ATTACKER_4',
      activeTeam: 'home',
      foulsEnabled: false,
    });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, carrier.id, MID_HEX);
    const [state] = await statePromise;

    // rollDice() is mocked to 1 (module-wide, see top of file) — the trigger die IS 1,
    // proving this is the toggle gate itself, not a lucky non-1 roll.
    expect(state.eventLog.some((e) => e.type === 'STEAL_ATTEMPT')).toBe(true);
    expect(state.eventLog.some((e) => e.type === 'FOUL_CALLED')).toBe(false);
    expect(state.eventLog.some((e) => e.type === 'INJURY_CHECK')).toBe(false);
    expect(state.eventLog.some((e) => e.type === 'BOOKING_CHECK')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. T-39-13-01: GAME_MOVE dice are always server-rolled, never client-supplied
// ---------------------------------------------------------------------------

describe('T-39-13-01: GAME_MOVE dice are always server-rolled, never client-supplied', () => {
  it('across several real GAME_MOVE emissions carrying forged extra dice fields on the payload, the server-rolled die (mocked to 1) always wins — the forged values are ignored', async () => {
    const { clientA, roomCode } = await setupRoom();

    for (let i = 0; i < 3; i++) {
      const { carrier } = seedMoveState(roomCode, {
        movementSlot: 'ATTACKER_4',
        activeTeam: 'home',
        foulsEnabled: true,
        injuryEnabled: true,
        bookingEnabled: true,
      });

      const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      // Forged extra dice fields on the payload (attacker-controlled `to` object). The
      // handler builds its ENTIRE dice object from rollDice() and never spreads the
      // client payload into it (T-39-13-01) — these forged values must be ignored.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (clientA as any).emit(ClientEvents.GAME_MOVE, carrier.id, {
        ...MID_HEX,
        stealDie: 6,
        tackleDie: 6,
        carrierDie: 6,
        injuryDie: 6,
        bookingDie: 6,
      });
      const [state] = await statePromise;

      const foulEvent = state.eventLog.find((e) => e.type === 'FOUL_CALLED');
      expect(foulEvent).toBeDefined();
      if (foulEvent?.type === 'FOUL_CALLED') {
        // Mocked rollDice()=1 forces the trigger die to 1 (never the forged 6).
        expect(foulEvent.defenderDie).toBe(1);
      }

      const injuryEvent = state.eventLog.find((e) => e.type === 'INJURY_CHECK');
      const bookingEvent = state.eventLog.find((e) => e.type === 'BOOKING_CHECK');
      expect(injuryEvent).toBeDefined();
      expect(bookingEvent).toBeDefined();
      if (injuryEvent?.type === 'INJURY_CHECK') {
        expect(injuryEvent.die).toBeGreaterThanOrEqual(1);
        expect(injuryEvent.die).toBeLessThanOrEqual(6);
        expect(injuryEvent.die).toBe(1); // server-rolled (mocked), never the forged 6
      }
      if (bookingEvent?.type === 'BOOKING_CHECK') {
        expect(bookingEvent.die).toBeGreaterThanOrEqual(1);
        expect(bookingEvent.die).toBeLessThanOrEqual(6);
        expect(bookingEvent.die).toBe(1); // server-rolled (mocked), never the forged 6
      }
    }
  });
});
