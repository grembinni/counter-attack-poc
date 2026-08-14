/**
 * Wave 7 socket-level integration tests for the box-entry GK response (Phase 39 Plan 15,
 * D-10/D-11), proving it end to end over a real Socket.io server + socket.io-client — no
 * mocking of the server itself. Structure mirrors gkDiveAtFeet.integration.test.ts /
 * foulFreeKick.integration.test.ts (server lifecycle, createClient/oncePromise/
 * waitForConnect/setupRoom).
 *
 * Coverage (numbered to match the plan's Task 3 action list):
 * 1. A pass that lands the ball inside the defending penalty area produces a broadcast
 *    with phase GK_BOX_ENTRY_PROMPT and gkBoxEntryTeam set to the area's owner.
 * 2. The attacking manager emitting GAME_GK_BOX_ENTRY_RESPONSE receives WRONG_TEAM.
 * 3. accept:false restores the interrupted phase and sets the cap, so a second entry in
 *    the same cycle does not re-offer.
 * 4. accept:true moves to GK_BOX_ENTRY_MOVE; a non-adjacent move is rejected; an
 *    adjacent unoccupied on-pitch move succeeds, appends GK_BOX_ENTRY_MOVE, and
 *    restores the interrupted phase.
 * 5. A malformed hex payload receives INVALID_TARGET and mutates nothing.
 * 6. D-11 independence over the wire: after using the box-entry response, a qualifying
 *    carrier move still produces a GK_DIVE_AT_FEET_PROMPT.
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
// Server lifecycle (mirrors gkDiveAtFeet.integration.test.ts verbatim)
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
// Helpers (mirrors gkDiveAtFeet.integration.test.ts verbatim)
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

// ---------------------------------------------------------------------------
// Seed helpers — direct room.gameState mutation, always setting
// room.lastBroadcastBallPosition to the seeded ball position (D-10 39-15 Task 1
// convention — see gkDiveAtFeet.integration.test.ts's identical rationale).
// ---------------------------------------------------------------------------

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: 18, r: idx % 25 } },
  );
}

/**
 * PASS-based scenario (item 1): a home carrier, well outside the away penalty area,
 * passes a STANDARD_PASS into an empty hex INSIDE awayPenaltyArea. No accuracy roll
 * required (STANDARD_PASS, distance 7 <=11), no interceptors (all other pieces parked).
 */
const PASS_CARRIER_HEX: HexCoord = { q: 25, r: 13 }; // middleThird, well outside the box
const PASS_TARGET_HEX: HexCoord = { q: 32, r: 13 }; // inside awayPenaltyArea (q>=31)

function seedPassIntoAwayBox(roomCode: string): { carrierId: string; awayGkId: string } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const carrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
  const awayGk = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK')!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === carrier.id) return { ...p, position: PASS_CARRIER_HEX };
    if (p.id === awayGk.id) return { ...p, position: { q: 36, r: 13 } };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([carrier.id, awayGk.id]));

  room.gameState = {
    ...room.gameState,
    phase: 'PASS',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: null,
    ball: { position: PASS_CARRIER_HEX, carrierId: carrier.id, lastTouchedBy: null },
    ballZone: 'middle',
    gkBoxEntryUsedByTeam: null,
    pieces,
  };
  room.lastBroadcastBallPosition = PASS_CARRIER_HEX;

  return { carrierId: carrier.id, awayGkId: awayGk.id };
}

async function drivePassIntoBox(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>,
): Promise<GameState> {
  const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
  const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
  clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', PASS_TARGET_HEX);
  const [[stateA], [stateB]] = await Promise.all([statePromiseA, statePromiseB]);
  void stateB;
  return stateA;
}

/**
 * MOVE-based scenario (items 3/6): an away carrier walks in and out of the home
 * penalty area (q<=5) one hex at a time — used to prove the once-per-cycle cap on a
 * genuine SECOND fresh entry, and D-11 independence against the dive-at-feet cap.
 * Mirrors gkDiveAtFeet.integration.test.ts's own MOVE-based fixture geometry (home GK
 * on its goal hex, away attacking).
 */
const HOME_GK_HEX: HexCoord = { q: 0, r: 13 };
const OUTSIDE_BOX_HEX: HexCoord = { q: 6, r: 13 }; // just outside homePenaltyArea (q<=5)
const INSIDE_BOX_HEX: HexCoord = { q: 5, r: 13 }; // just inside — distance 5 from GK, outside GKDIVE-02 range

function seedBoxEntryMove(roomCode: string): { homeGkId: string; carrierId: string } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const carrier = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === homeGk.id) return { ...p, position: HOME_GK_HEX };
    if (p.id === carrier.id) return { ...p, position: OUTSIDE_BOX_HEX, pace: 6 };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([homeGk.id, carrier.id]));

  room.gameState = {
    ...room.gameState,
    phase: 'MOVE',
    attackingTeam: 'away',
    activeTeam: 'away',
    movementSlot: 'ATTACKER_4',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    stealAttemptedByIds: [],
    tackleAttemptedByIds: [],
    ball: { position: OUTSIDE_BOX_HEX, carrierId: carrier.id, lastTouchedBy: null },
    ballZone: 'home',
    foulsEnabled: true,
    injuryEnabled: true,
    bookingEnabled: true,
    gkBoxEntryUsedByTeam: null,
    gkDiveAtFeetUsedByTeam: null,
    pieces,
  };
  room.lastBroadcastBallPosition = OUTSIDE_BOX_HEX;

  return { homeGkId: homeGk.id, carrierId: carrier.id };
}

/** Mirrors gkDiveAtFeet.integration.test.ts's driveIntoRange — waits for BOTH clients. */
async function driveMove(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>,
  carrierId: string,
  to: HexCoord,
): Promise<GameState> {
  const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
  const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
  clientB.emit(ClientEvents.GAME_MOVE, carrierId, to);
  const [[stateA], [stateB]] = await Promise.all([statePromiseA, statePromiseB]);
  void stateB;
  return stateA;
}

// ---------------------------------------------------------------------------
// 1. Automatic offer on a pass landing inside the box
// ---------------------------------------------------------------------------

describe('D-10: automatic offer on a pass landing inside the penalty area', () => {
  it('a pass that lands the ball inside the defending penalty area produces GK_BOX_ENTRY_PROMPT with gkBoxEntryTeam set to the area owner', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedPassIntoAwayBox(roomCode);

    const state = await drivePassIntoBox(clientA, clientB);

    expect(state.phase).toBe('GK_BOX_ENTRY_PROMPT');
    expect(state.gkBoxEntryTeam).toBe('away');
  });
});

// ---------------------------------------------------------------------------
// 2. Access control
// ---------------------------------------------------------------------------

describe('T-39-15-01: GAME_GK_BOX_ENTRY_RESPONSE access control', () => {
  it('the attacking manager emitting GAME_GK_BOX_ENTRY_RESPONSE receives WRONG_TEAM', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedPassIntoAwayBox(roomCode);
    await drivePassIntoBox(clientA, clientB);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_GK_BOX_ENTRY_RESPONSE, true);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('GK_BOX_ENTRY_PROMPT');
  });
});

// ---------------------------------------------------------------------------
// 3. Decline consumes the cap — a genuine second entry in the same cycle does not re-offer
// ---------------------------------------------------------------------------

describe('D-10/D-11: declining the box-entry response consumes the once-per-cycle cap', () => {
  it('accept:false restores the interrupted phase and a second fresh entry in the same movement cycle does not re-offer', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId } = seedBoxEntryMove(roomCode);

    // First entry: OUTSIDE_BOX_HEX -> INSIDE_BOX_HEX offers.
    const firstOffer = await driveMove(clientA, clientB, carrierId, INSIDE_BOX_HEX);
    expect(firstOffer.phase).toBe('GK_BOX_ENTRY_PROMPT');
    expect(firstOffer.gkBoxEntryTeam).toBe('home');

    const declinePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declinePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GK_BOX_ENTRY_RESPONSE, false);
    const [[declinedState]] = await Promise.all([declinePromiseA, declinePromiseB]);

    expect(declinedState.phase).toBe('MOVE');
    expect(declinedState.gkBoxEntryTeam).toBeNull();
    expect(declinedState.gkBoxEntryUsedByTeam?.home).toBe(true);

    // Exit the box, then re-enter — a genuine SECOND fresh entry this same cycle.
    const exitedState = await driveMove(clientA, clientB, carrierId, OUTSIDE_BOX_HEX);
    expect(exitedState.phase).toBe('MOVE');
    expect(exitedState.gkBoxEntryTeam).toBeFalsy();

    const secondEntryState = await driveMove(clientA, clientB, carrierId, INSIDE_BOX_HEX);
    expect(secondEntryState.phase).toBe('MOVE');
    expect(secondEntryState.gkBoxEntryTeam).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// 4. Accept -> GK_BOX_ENTRY_MOVE -> reposition
// ---------------------------------------------------------------------------

describe('D-10: accepting the box-entry response enters GK_BOX_ENTRY_MOVE', () => {
  it('accept:true enters GK_BOX_ENTRY_MOVE; a non-adjacent move is rejected; an adjacent unoccupied move succeeds and restores the interrupted phase', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { awayGkId } = seedPassIntoAwayBox(roomCode);
    await drivePassIntoBox(clientA, clientB);

    const acceptPromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const acceptPromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_GK_BOX_ENTRY_RESPONSE, true);
    const [[acceptedState]] = await Promise.all([acceptPromiseA, acceptPromiseB]);

    expect(acceptedState.phase).toBe('GK_BOX_ENTRY_MOVE');
    expect(acceptedState.activeTeam).toBe('away');

    // Non-adjacent target (distance > 1 from the GK's current hex {q:36,r:13}) -> MOVE_INVALID.
    const rejectPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_GK_BOX_ENTRY_MOVE, { q: 34, r: 13 });
    const [rejectReason] = await rejectPromise;
    expect(rejectReason).toBe('MOVE_INVALID');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('GK_BOX_ENTRY_MOVE');

    // Adjacent, on-pitch, unoccupied target -> succeeds.
    const movePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_GK_BOX_ENTRY_MOVE, { q: 35, r: 13 });
    const [movedState] = await movePromise;

    expect(movedState.phase).toBe('PASS');
    const moveEvent = movedState.eventLog.find((e) => e.type === 'GK_BOX_ENTRY_MOVE');
    expect(moveEvent).toBeDefined();
    const gkPiece = movedState.pieces.find((p) => p.id === awayGkId);
    expect(gkPiece?.position).toEqual({ q: 35, r: 13 });
    expect(movedState.gkBoxEntryUsedByTeam?.away).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Malformed hex payload
// ---------------------------------------------------------------------------

describe('T-39-15-04: GAME_GK_BOX_ENTRY_MOVE payload validation', () => {
  it('a malformed hex payload receives INVALID_TARGET and mutates nothing', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedPassIntoAwayBox(roomCode);
    await drivePassIntoBox(clientA, clientB);

    const acceptPromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const acceptPromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_GK_BOX_ENTRY_RESPONSE, true);
    await Promise.all([acceptPromiseA, acceptPromiseB]);

    const beforePieces = getRoom(roomCode)!.gameState!.pieces;

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    // Intentionally malformed payload (attacker-controlled) — q/r must be numbers.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientB as any).emit(ClientEvents.GAME_GK_BOX_ENTRY_MOVE, { q: 'x', r: 2 });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    const afterState = getRoom(roomCode)!.gameState!;
    expect(afterState.phase).toBe('GK_BOX_ENTRY_MOVE');
    expect(afterState.pieces).toEqual(beforePieces);
  });
});

// ---------------------------------------------------------------------------
// 6. D-11 independence over the wire
// ---------------------------------------------------------------------------

describe('D-11: box-entry and dive-at-feet caps are independent over the wire', () => {
  it('after using the box-entry response, a qualifying carrier move still produces a GK_DIVE_AT_FEET_PROMPT', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId } = seedBoxEntryMove(roomCode);

    // Use the box-entry response (decline) — consumes gkBoxEntryUsedByTeam.home only.
    const firstOffer = await driveMove(clientA, clientB, carrierId, INSIDE_BOX_HEX);
    expect(firstOffer.phase).toBe('GK_BOX_ENTRY_PROMPT');

    const declinePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declinePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GK_BOX_ENTRY_RESPONSE, false);
    const [[declinedState]] = await Promise.all([declinePromiseA, declinePromiseB]);
    expect(declinedState.gkBoxEntryUsedByTeam?.home).toBe(true);
    expect(declinedState.gkDiveAtFeetUsedByTeam?.home).not.toBe(true);

    // Two further real single-hex moves bringing the SAME carrier within GKDIVE-02
    // range (<=3 from the GK at HOME_GK_HEX) must still offer the dive-at-feet duel —
    // the box-entry cap must never gate it. The intermediate hex (distance 4, still
    // inside the SAME penalty area as the decline above) offers neither mechanic.
    const intermediateState = await driveMove(clientA, clientB, carrierId, { q: 4, r: 13 });
    expect(intermediateState.phase).toBe('MOVE');

    const diveOfferState = await driveMove(clientA, clientB, carrierId, { q: 3, r: 13 });

    expect(diveOfferState.phase).toBe('GK_DIVE_AT_FEET_PROMPT');
    expect(diveOfferState.gkDiveAtFeetTeam).toBe('home');
  });
});
