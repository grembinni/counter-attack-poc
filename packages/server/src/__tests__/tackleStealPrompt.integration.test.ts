/**
 * Phase 43 Plan 06 (final wave): the ONE integration test file proving the whole
 * sequential tackle/steal decline/attempt flow works over REAL sockets, in both
 * toggle states. 43-04's gameEngine.tackleStealPrompt.test.ts covers applyMove's
 * interception and applyTackleStealChoice's state machine at the pure-function level;
 * 43-05's gameHandlers.tackleStealPrompt.test.ts covers the socket handler's guards by
 * seeding TACKLE_STEAL_PROMPT directly. Neither proves that a REAL `GAME_MOVE` emitted
 * by a connected client actually reaches TACKLE_STEAL_PROMPT and that the whole
 * decline/attempt/wrong-team/toggle-off round trip holds over the wire — that gap is
 * this file's job.
 *
 * Structure mirrors substitution.integration.test.ts / foulFreeKick.integration.test.ts
 * (server lifecycle, createClient/oncePromise/waitForConnect, direct room.gameState
 * seeding for board setup, then REAL socket emits for the behavior under test).
 *
 * Because the shared `confirmDefaultRoomSettings` helper (testHelpers.ts) always emits
 * `tackleStealDecline: false`, this file defines its own `confirmRoomSettings` that
 * takes the toggle value, so the same suite can drive both the toggle-on and
 * toggle-off scenarios without touching the shared helper (43-06-PLAN.md Task 2).
 *
 * Coverage (numbered to match the plan's <behavior> list):
 * 1. Toggle ON: a real GAME_MOVE into a two-defender ZoI produces a TACKLE_STEAL_PROMPT
 *    broadcast naming the HIGHER-tackling defender first — asserted against the
 *    defender's id, not array position (D-02).
 * 2. A decline advances the queue to the second (lower-tackling) defender and appends a
 *    TACKLE_STEAL_DECLINED event.
 * 3. An attempt on the second defender leaves TACKLE_STEAL_PROMPT and appends a
 *    STEAL_ATTEMPT event, regardless of the (unmocked) dice outcome.
 * 4. Declining both defenders in sequence returns the state to MOVE with the pre-move
 *    activeTeam/movementSlot restored, stealAttemptedByIds still empty, and the carrier
 *    standing on its new hex.
 * 5. T-43-21: the carrier's OWN manager submitting a choice receives GAME_ERROR
 *    'WRONG_TEAM' and the shared state does not advance.
 * 6. Toggle OFF: the identical GAME_MOVE never produces TACKLE_STEAL_PROMPT and the
 *    resulting log contains a STEAL_ATTEMPT event immediately (TACKLE-04).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import type {
  ClientToServerEvents,
  GameState,
  HexCoord,
  PlayerPiece,
  ServerToClientEvents,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents, hexNeighbors, isPitchHex } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors substitution.integration.test.ts / foulFreeKick.integration.test.ts)
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
 * Local settings-confirm helper (Task 2 action item): the shared `confirmDefaultRoomSettings`
 * (testHelpers.ts) always emits `tackleStealDecline: false`, so this file defines its own to
 * drive both toggle states without touching the shared helper.
 */
function confirmRoomSettings(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  tackleStealDecline: boolean,
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
      tackleStealDecline,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });
}

/**
 * Creates a room with 2 connected clients and completes team selection.
 * clientA = slot 1 = 'home'; clientB = slot 2 = 'away' (project-wide convention).
 */
async function setupRoom(tackleStealDecline: boolean): Promise<{
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

  await confirmRoomSettings(clientA, tackleStealDecline);

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
// Board seed: a carrier at CENTER with TWO active away outfielders within ZoI of MID_HEX,
// carrying DIFFERENT tackling values (mirrors foulFreeKick.integration.test.ts's verified
// CENTER/MID_HEX real-hexNeighbors fixture, extended to two ZoI defenders).
// ---------------------------------------------------------------------------

const CENTER: HexCoord = { q: 18, r: 13 };
const MID_HEX: HexCoord = hexNeighbors(CENTER).find((h) => isPitchHex(h))!;
// Two distinct pitch hexes adjacent to MID_HEX (ZoI range 1), excluding CENTER itself.
const ZOI_HEXES: HexCoord[] = hexNeighbors(MID_HEX).filter(
  (h) => isPitchHex(h) && !(h.q === CENTER.q && h.r === CENTER.r),
);
const DEFENDER_HEX_LOW = ZOI_HEXES[0]!;
const DEFENDER_HEX_HIGH = ZOI_HEXES[1]!;

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 2 : 34, r: idx % 25 } },
  );
}

/**
 * Seeds a fresh MOVE phase with a home carrier at CENTER and two away outfielders within
 * ZoI of MID_HEX (the carrier's next legal step), one hex apart. The LOW-tackling defender
 * is placed FIRST in the pieces array (awayOutfield[0]) and the HIGH-tackling defender
 * SECOND (awayOutfield[1]) — deliberately inverted from prompt order, so a test asserting
 * "the higher-tackling defender is prompted first" only passes if the ordering is genuinely
 * keyed on `tackling`, not on array position (D-02).
 */
function seedTwoDefenderZoI(
  roomCode: string,
  tackleStealDeclineEnabled: boolean,
): { carrier: PlayerPiece; lowDefender: PlayerPiece; highDefender: PlayerPiece } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const carrierBase = homeOutfield[0]!;
  const lowDefenderBase = awayOutfield[0]!;
  const highDefenderBase = awayOutfield[1]!;

  const carrier: PlayerPiece = { ...carrierBase, position: CENTER };
  const lowDefender: PlayerPiece = { ...lowDefenderBase, tackling: 1, position: DEFENDER_HEX_LOW };
  const highDefender: PlayerPiece = {
    ...highDefenderBase,
    tackling: 6,
    position: DEFENDER_HEX_HIGH,
  };

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === carrier.id) return carrier;
    if (p.id === lowDefender.id) return lowDefender;
    if (p.id === highDefender.id) return highDefender;
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([carrier.id, lowDefender.id, highDefender.id]));

  room.gameState = {
    ...room.gameState,
    pieces,
    phase: 'MOVE',
    attackingTeam: 'home',
    activeTeam: 'home',
    movementSlot: 'ATTACKER_4',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    stealAttemptedByIds: [],
    tackleAttemptedByIds: [],
    ball: { position: CENTER, carrierId: carrier.id, lastTouchedBy: null },
    ballZone: 'middle',
    foulsEnabled: false,
    bookingEnabled: false,
    injuryEnabled: false,
    outOfBoundsEnabled: false,
    tackleStealDeclineEnabled,
  };
  room.lastBroadcastBallPosition = CENTER;

  return { carrier, lowDefender, highDefender };
}

// ---------------------------------------------------------------------------
// 1. Toggle ON: a real GAME_MOVE into a two-defender ZoI produces TACKLE_STEAL_PROMPT
//    naming the HIGHER-tackling defender first (not array position, D-02).
// ---------------------------------------------------------------------------

describe('Toggle ON: a real GAME_MOVE into a two-defender ZoI enters TACKLE_STEAL_PROMPT', () => {
  it('both clients receive a TACKLE_STEAL_PROMPT state naming the higher-tackling defender, even though it is SECOND in the pieces array', async () => {
    const { clientA, clientB, roomCode } = await setupRoom(true);
    const { carrier, lowDefender, highDefender } = seedTwoDefenderZoI(roomCode, true);

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, carrier.id, MID_HEX);
    const [[stateA], [stateB]] = await Promise.all([stateAPromise, stateBPromise]);

    for (const state of [stateA, stateB]) {
      expect(state.phase).toBe('TACKLE_STEAL_PROMPT');
      expect(state.tackleStealPromptKind).toBe('STEAL');
      expect(state.tackleStealPromptDefenderId).toBe(highDefender.id);
      expect(state.tackleStealPromptTeam).toBe('away');
      // The lower-tackling defender is queued behind the current (higher-tackling) one.
      expect(state.tackleStealPromptQueue).toEqual([lowDefender.id]);
    }
  }, 30000);
});

// ---------------------------------------------------------------------------
// 2. A decline advances the queue to the second (lower-tackling) defender.
// ---------------------------------------------------------------------------

describe('A decline advances the sequence to the next queued defender', () => {
  it('both clients see the SECOND (lower-tackling) defender current, and a TACKLE_STEAL_DECLINED event for the first', async () => {
    const { clientA, clientB, roomCode } = await setupRoom(true);
    const { carrier, lowDefender, highDefender } = seedTwoDefenderZoI(roomCode, true);

    const promptAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const promptBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, carrier.id, MID_HEX);
    await Promise.all([promptAPromise, promptBPromise]);

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, false);
    const [[stateA], [stateB]] = await Promise.all([stateAPromise, stateBPromise]);

    for (const state of [stateA, stateB]) {
      expect(state.phase).toBe('TACKLE_STEAL_PROMPT');
      expect(state.tackleStealPromptDefenderId).toBe(lowDefender.id);
      expect(state.tackleStealPromptQueue).toEqual([]);
      const declineEvent = state.eventLog.find(
        (e) => e.type === 'TACKLE_STEAL_DECLINED' && e.defenderId === highDefender.id,
      );
      expect(declineEvent).toBeDefined();
    }
  }, 30000);
});

// ---------------------------------------------------------------------------
// 3. An attempt leaves TACKLE_STEAL_PROMPT and appends a STEAL_ATTEMPT event, regardless
//    of the (unmocked) dice outcome.
// ---------------------------------------------------------------------------

describe('An attempt resolves the duel and leaves TACKLE_STEAL_PROMPT', () => {
  it('both clients see a state that has left TACKLE_STEAL_PROMPT and contains a STEAL_ATTEMPT event for the attempted defender', async () => {
    const { clientA, clientB, roomCode } = await setupRoom(true);
    const { carrier, lowDefender } = seedTwoDefenderZoI(roomCode, true);

    clientA.emit(ClientEvents.GAME_MOVE, carrier.id, MID_HEX);
    await Promise.all([
      oncePromise(clientA, ServerEvents.GAME_STATE),
      oncePromise(clientB, ServerEvents.GAME_STATE),
    ]);

    const declinePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declinePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, false);
    await Promise.all([declinePromiseA, declinePromiseB]);

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, true);
    const [[stateA], [stateB]] = await Promise.all([stateAPromise, stateBPromise]);

    for (const state of [stateA, stateB]) {
      expect(state.phase).not.toBe('TACKLE_STEAL_PROMPT');
      const stealEvent = state.eventLog.find(
        (e) => e.type === 'STEAL_ATTEMPT' && e.defenderId === lowDefender.id,
      );
      expect(stealEvent).toBeDefined();
      // Do not attempt to control the server's dice (plan action item): assert only the
      // structural fact that holds regardless of the roll — a FAIL keeps the defender
      // recorded in stealAttemptedByIds; a SUCCESS ends the movement phase and resets the
      // attempted-arrays entirely (mirrors the pre-toggle immediate-resolution behavior).
      if (stealEvent!.type === 'STEAL_ATTEMPT' && stealEvent.result === 'FAIL') {
        expect(state.stealAttemptedByIds).toContain(lowDefender.id);
      } else {
        expect(state.stealAttemptedByIds ?? []).toEqual([]);
      }
    }
  }, 30000);
});

// ---------------------------------------------------------------------------
// 4. Declining both defenders returns to MOVE with the pre-move activeTeam/movementSlot
//    restored, stealAttemptedByIds still empty, and the carrier standing on its new hex.
// ---------------------------------------------------------------------------

describe('Declining every queued defender returns play to MOVE', () => {
  it('the final state is MOVE with the pre-move activeTeam/movementSlot restored, stealAttemptedByIds empty, and the carrier on its new hex', async () => {
    const { clientA, clientB, roomCode } = await setupRoom(true);
    const { carrier } = seedTwoDefenderZoI(roomCode, true);

    clientA.emit(ClientEvents.GAME_MOVE, carrier.id, MID_HEX);
    await Promise.all([
      oncePromise(clientA, ServerEvents.GAME_STATE),
      oncePromise(clientB, ServerEvents.GAME_STATE),
    ]);

    const firstDeclinePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const firstDeclinePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, false);
    await Promise.all([firstDeclinePromiseA, firstDeclinePromiseB]);

    const secondDeclinePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const secondDeclinePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, false);
    const [[stateA], [stateB]] = await Promise.all([secondDeclinePromiseA, secondDeclinePromiseB]);

    for (const state of [stateA, stateB]) {
      expect(state.phase).toBe('MOVE');
      expect(state.activeTeam).toBe('home');
      expect(state.movementSlot).toBe('ATTACKER_4');
      expect(state.stealAttemptedByIds ?? []).toEqual([]);
      expect(state.tackleStealPromptTeam).toBeNull();
      const carrierPiece = state.pieces.find((p) => p.id === carrier.id)!;
      expect(carrierPiece.position).toEqual(MID_HEX);
    }
  }, 30000);
});

// ---------------------------------------------------------------------------
// 5. T-43-21: the carrier's OWN manager submitting a choice is rejected WRONG_TEAM and
//    the shared state does not advance.
// ---------------------------------------------------------------------------

describe("T-43-21: the carrier's own manager cannot answer the prompt", () => {
  it("the carrier's manager (home) receives GAME_ERROR 'WRONG_TEAM' and the prompt's current defender is unchanged", async () => {
    const { clientA, clientB, roomCode } = await setupRoom(true);
    const { carrier, highDefender } = seedTwoDefenderZoI(roomCode, true);

    clientA.emit(ClientEvents.GAME_MOVE, carrier.id, MID_HEX);
    await Promise.all([
      oncePromise(clientA, ServerEvents.GAME_STATE),
      oncePromise(clientB, ServerEvents.GAME_STATE),
    ]);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, true);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    const afterState = getRoom(roomCode)!.gameState!;
    expect(afterState.phase).toBe('TACKLE_STEAL_PROMPT');
    expect(afterState.tackleStealPromptDefenderId).toBe(highDefender.id);
  }, 30000);
});

// ---------------------------------------------------------------------------
// 6. Toggle OFF: the identical GAME_MOVE never produces TACKLE_STEAL_PROMPT and the
//    resulting log contains a STEAL_ATTEMPT event immediately (TACKLE-04).
// ---------------------------------------------------------------------------

describe('Toggle OFF: the identical GAME_MOVE resolves the duel immediately with no prompt', () => {
  it('the broadcast state never visits TACKLE_STEAL_PROMPT and its log already contains a STEAL_ATTEMPT event', async () => {
    const { clientA, clientB, roomCode } = await setupRoom(false);
    const { carrier, highDefender } = seedTwoDefenderZoI(roomCode, false);

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, carrier.id, MID_HEX);
    const [[stateA], [stateB]] = await Promise.all([stateAPromise, stateBPromise]);

    for (const state of [stateA, stateB]) {
      expect(state.phase).not.toBe('TACKLE_STEAL_PROMPT');
      expect(state.tackleStealPromptTeam ?? null).toBeNull();
      const stealEvent = state.eventLog.find(
        (e) => e.type === 'STEAL_ATTEMPT' && e.defenderId === highDefender.id,
      );
      expect(stealEvent).toBeDefined();
    }
  }, 30000);
});
