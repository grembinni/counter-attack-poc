/**
 * Phase 17 Plan 06 (OFFSIDE-02) handler-level tests.
 *
 * Covers Task 2 (triggerOffsideFoul wiring + FREE_KICK_SETUP handlers) and the
 * D-41 addendum (foul also fires when a flagged-offside defender deflects a shot
 * without gaining clean possession — the ball ends up loose).
 *
 * Test harness mirrors gameHandlers.phase17.test.ts / gameHandlers.phase10.test.ts:
 * real Socket.io server on port 0; room store seeded directly via getRoom.
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
// Helpers (mirrors gameHandlers.phase17.test.ts pattern exactly)
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

  // Drive team selection then uniform confirmation (Phase 22 D-13/D-14/D-15).
  const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED);
  clientA.emit(ClientEvents.TEAM_PICK, 'city');
  await homePickedPromise;
  const uniformStartPromise = oncePromise(clientA, ServerEvents.UNIFORM_SELECTION_START);
  clientB.emit(ClientEvents.TEAM_PICK, 'crew');
  await uniformStartPromise;
  const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED);
  clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
  await homeConfirmedPromise;
  // Phase 24: away confirm emits LINEUP_ASSIGNMENT_READY; both players confirm to start game.
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
// Task 2: triggerOffsideFoul wiring at the GAME_MOVE possession-gain point
// ---------------------------------------------------------------------------

describe('OFFSIDE-02 Task 2: GAME_MOVE loose-ball pickup triggers the foul', () => {
  it('a flagged-offside piece picking up a loose ball immediately enters FREE_KICK_SETUP', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    const homeOutfielder = room.gameState.pieces.find(
      (p) => p.teamId === 'home' && p.role !== 'GK',
    );
    if (!homeOutfielder) throw new Error('No home outfielder found');

    // Loose ball sits one hex away; the flagged piece is the sole mover this slot.
    const ballPos = { q: 20, r: 13 };
    const startPos = { q: 19, r: 13 };
    room.gameState = {
      ...room.gameState,
      phase: 'MOVE',
      attackingTeam: 'home',
      activeTeam: 'home',
      movementSlot: 'ATTACKER_4',
      movedPieceIds: [],
      paceUsedByPieceId: {},
      ball: { position: ballPos, carrierId: null },
      offsidePieceIds: [homeOutfielder.id],
      pieces: room.gameState.pieces.map((p) =>
        p.id === homeOutfielder.id ? { ...p, position: startPos } : p,
      ),
    };

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, homeOutfielder.id, ballPos);
    const [newState] = await statePromise;

    expect(newState.phase).toBe('FREE_KICK_SETUP');
    expect(newState.freeKickHex).toEqual(ballPos);
    expect(newState.freeKickAttackingTeam).toBe('away');
    expect(newState.ball.carrierId).toBeNull();
    expect(newState.offsidePieceIds).not.toContain(homeOutfielder.id);
  });

  it('an UNFLAGGED piece picking up a loose ball does NOT trigger a free kick', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    const homeOutfielder = room.gameState.pieces.find(
      (p) => p.teamId === 'home' && p.role !== 'GK',
    );
    if (!homeOutfielder) throw new Error('No home outfielder found');

    const ballPos = { q: 20, r: 13 };
    const startPos = { q: 19, r: 13 };
    room.gameState = {
      ...room.gameState,
      phase: 'MOVE',
      attackingTeam: 'home',
      activeTeam: 'home',
      movementSlot: 'ATTACKER_4',
      movedPieceIds: [],
      paceUsedByPieceId: {},
      ball: { position: ballPos, carrierId: null },
      offsidePieceIds: [],
      pieces: room.gameState.pieces.map((p) =>
        p.id === homeOutfielder.id ? { ...p, position: startPos } : p,
      ),
    };

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, homeOutfielder.id, ballPos);
    const [newState] = await statePromise;

    expect(newState.phase).not.toBe('FREE_KICK_SETUP');
    expect(newState.ball.carrierId).toBe(homeOutfielder.id);
  });
});

// ---------------------------------------------------------------------------
// D-49 staged rework: GAME_FREE_KICK_MOVE / GAME_FREE_KICK_READY handlers
// Replaces the prior simultaneous-both-teams-then-dual-Ready model. Sequence:
// stage 0 kicking(away)<=5 -> stage 1 defending(home)<=5 -> stage 2 kicking(away)<=3
// -> stage 3 defending(home)<=2 -> finalize (PASS).
// ---------------------------------------------------------------------------

/**
 * Seeds a room directly into FREE_KICK_SETUP stage 0 — as if triggerOffsideFoul had
 * already fired — with the away team awarded the kick.
 *
 * D-54: `kickerPlaced` controls whether an away piece starts ALREADY on `freeKickHex`
 * (and pre-locked into `movedPieceIds`), simulating the post-kicker-placement state —
 * most stage-0 budget/cap tests need this so they aren't blocked by the new mandatory
 * KICKER_NOT_YET_PLACED gate, which is tested separately and explicitly.
 */
function seedFreeKickSetup(
  roomCode: string,
  opts: { kickerPlaced?: boolean } = {},
): { freeKickHex: { q: number; r: number }; kickerId: string | null } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const freeKickHex = { q: 25, r: 13 };
  const kickerPlaced = opts.kickerPlaced ?? false;
  const awayPiece = room.gameState.pieces.find((p) => p.teamId === 'away');
  const kickerId = kickerPlaced ? (awayPiece?.id ?? null) : null;

  room.gameState = {
    ...room.gameState,
    phase: 'FREE_KICK_SETUP',
    freeKickHex,
    freeKickAttackingTeam: 'away',
    freeKickStageIndex: 0,
    freeKickPlacedPieceIds: [],
    movedPieceIds: kickerId ? [kickerId] : [],
    attackingTeam: 'away',
    activeTeam: 'away',
    ball: { position: freeKickHex, carrierId: null },
    offsidePieceIds: [],
    pieces: kickerId
      ? room.gameState.pieces.map((p) => (p.id === kickerId ? { ...p, position: freeKickHex } : p))
      : room.gameState.pieces,
  };
  return { freeKickHex, kickerId };
}

describe('OFFSIDE-02 D-49/D-54: GAME_FREE_KICK_MOVE handler (staged, turn-gated, mandatory kicker-first)', () => {
  it('D-54: stage 0, no kicker on freeKickHex yet — moving a DIFFERENT piece to a non-freeKickHex destination is rejected (KICKER_NOT_YET_PLACED)', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedFreeKickSetup(roomCode); // kickerPlaced defaults to false
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const awayPieces = room.gameState.pieces.filter((p) => p.teamId === 'away');
    if (awayPieces.length < 2) throw new Error('Need at least 2 away pieces');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_FREE_KICK_MOVE, awayPieces[1]!.id, { q: 2, r: 2 });
    const [reason] = await errorPromise;
    expect(reason).toBe('KICKER_NOT_YET_PLACED');
  });

  it('D-54: stage 0, moving a piece ONTO freeKickHex when none is there yet locks it into movedPieceIds (kicker placement) — does not consume the budget', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { freeKickHex } = seedFreeKickSetup(roomCode);
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const awayPiece = room.gameState.pieces.find((p) => p.teamId === 'away');
    if (!awayPiece) throw new Error('No away piece found');

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_FREE_KICK_MOVE, awayPiece.id, freeKickHex);
    const [newState] = await statePromise;

    const moved = newState.pieces.find((p) => p.id === awayPiece.id);
    expect(moved?.position).toEqual(freeKickHex);
    expect(newState.phase).toBe('FREE_KICK_SETUP');
    expect(newState.movedPieceIds).toContain(awayPiece.id);
    expect(newState.freeKickPlacedPieceIds).not.toContain(awayPiece.id);
  });

  it('D-54: once the kicker is placed, OTHER away pieces may be moved and counted toward the stage-0 budget', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedFreeKickSetup(roomCode, { kickerPlaced: true });
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const otherAwayPiece = room.gameState.pieces.find(
      (p) => p.teamId === 'away' && !room.gameState!.movedPieceIds.includes(p.id),
    );
    if (!otherAwayPiece) throw new Error('No other away piece found');

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_FREE_KICK_MOVE, otherAwayPiece.id, { q: 2, r: 2 });
    const [newState] = await statePromise;

    const moved = newState.pieces.find((p) => p.id === otherAwayPiece.id);
    expect(moved?.position).toEqual({ q: 2, r: 2 });
    expect(newState.phase).toBe('FREE_KICK_SETUP');
    expect(newState.freeKickPlacedPieceIds).toContain(otherAwayPiece.id);
  });

  it('D-54: the locked kicker cannot be moved again (PIECE_LOCKED)', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { kickerId } = seedFreeKickSetup(roomCode, { kickerPlaced: true });
    if (!kickerId) throw new Error('No kicker seeded');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_FREE_KICK_MOVE, kickerId, { q: 5, r: 5 });
    const [reason] = await errorPromise;
    expect(reason).toBe('PIECE_LOCKED');
  });

  it('rejects repositioning a piece not owned by the requesting socket (NOT_YOUR_PIECE)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { freeKickHex } = seedFreeKickSetup(roomCode);
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const awayPiece = room.gameState.pieces.find((p) => p.teamId === 'away');
    if (!awayPiece) throw new Error('No away piece found');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_FREE_KICK_MOVE, awayPiece.id, freeKickHex);
    const [reason] = await errorPromise;
    expect(reason).toBe('NOT_YOUR_PIECE');
  });

  it('stage 0: rejects the INACTIVE team (home) attempting to move during the kicking stage (WRONG_TEAM)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedFreeKickSetup(roomCode, { kickerPlaced: true });
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homePiece = room.gameState.pieces.find((p) => p.teamId === 'home');
    if (!homePiece) throw new Error('No home piece found');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_FREE_KICK_MOVE, homePiece.id, { q: 2, r: 2 });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('stage 0: rejects placing a SIXTH distinct away piece once the 5-piece cap is reached (PLACEMENT_LIMIT_REACHED)', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedFreeKickSetup(roomCode, { kickerPlaced: true });
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const awayPieces = room.gameState.pieces.filter(
      (p) => p.teamId === 'away' && !room.gameState!.movedPieceIds.includes(p.id),
    );
    if (awayPieces.length < 6)
      throw new Error('Need at least 6 unlocked away pieces for this test');

    room.gameState = {
      ...room.gameState,
      freeKickPlacedPieceIds: awayPieces.slice(0, 5).map((p) => p.id),
    };

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_FREE_KICK_MOVE, awayPieces[5]!.id, { q: 2, r: 2 });
    const [reason] = await errorPromise;
    expect(reason).toBe('PLACEMENT_LIMIT_REACHED');
  });

  it('stage 0: re-placing an ALREADY-counted piece is allowed even when the 5-piece cap is full', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedFreeKickSetup(roomCode, { kickerPlaced: true });
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const awayPieces = room.gameState.pieces.filter(
      (p) => p.teamId === 'away' && !room.gameState!.movedPieceIds.includes(p.id),
    );
    const placedIds = awayPieces.slice(0, 5).map((p) => p.id);
    room.gameState = { ...room.gameState, freeKickPlacedPieceIds: placedIds };

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_FREE_KICK_MOVE, placedIds[0]!, { q: 8, r: 8 });
    const [newState] = await statePromise;

    expect(newState.pieces.find((p) => p.id === placedIds[0])?.position).toEqual({ q: 8, r: 8 });
    expect(newState.freeKickPlacedPieceIds).toEqual(placedIds); // unchanged length — no new slot used
  });
});

describe('OFFSIDE-02 D-49/D-54/D-56: GAME_FREE_KICK_READY handler (stage-end, single-team)', () => {
  it('stage 0: rejects the INACTIVE team (home) attempting to end the kicking stage (NOT_YOUR_STAGE)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedFreeKickSetup(roomCode, { kickerPlaced: true });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_FREE_KICK_READY);
    const [reason] = await errorPromise;
    expect(reason).toBe('NOT_YOUR_STAGE');
  });

  it('stage 0 -> 1: the kicking team (away) may end its stage having placed ZERO additional pieces (optional-up-to-N) — D-56 merges the kicker into movedPieceIds (already there from placement)', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { kickerId } = seedFreeKickSetup(roomCode, { kickerPlaced: true });

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_FREE_KICK_READY);
    const [newState] = await statePromise;

    expect(newState.phase).toBe('FREE_KICK_SETUP');
    expect(newState.freeKickStageIndex).toBe(1);
    expect(newState.freeKickPlacedPieceIds).toEqual([]);
    expect(newState.movedPieceIds).toContain(kickerId);
  });

  it('stage 1 (defending = home): rejects Ready with DEFENDER_TOO_CLOSE when a home piece is within 2 hexes of the ball', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { freeKickHex } = seedFreeKickSetup(roomCode, { kickerPlaced: true });
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeDefender = room.gameState.pieces.find((p) => p.teamId === 'home');
    if (!homeDefender) throw new Error('No home piece found');
    room.gameState = {
      ...room.gameState,
      pieces: room.gameState.pieces.map((p) =>
        p.id === homeDefender.id
          ? { ...p, position: { q: freeKickHex.q - 1, r: freeKickHex.r } }
          : p,
      ),
    };

    // Advance stage 0 -> 1 first (away ends its kicking stage with no placements).
    const stage1Promise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_FREE_KICK_READY);
    await stage1Promise;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_FREE_KICK_READY);
    const [reason] = await errorPromise;
    expect(reason).toBe('DEFENDER_TOO_CLOSE');
  });

  // D-54 (supersedes D-51): KICKER_HEX_EMPTY no longer exists — the kicker is enforced
  // up front at stage 0 via GAME_FREE_KICK_MOVE, not re-validated at stage 2 end.
  //
  // broadcastState emits to the WHOLE room — both clients receive every broadcast. Wait
  // for BOTH clients' copies of each step before registering the next listener, or a
  // listener for the NEXT broadcast can race against a still-in-flight copy of the
  // PREVIOUS one (mirrors the established pattern from the "full sequence" test below).
  it('D-54: stage 2 (kicking, second turn) ends successfully regardless of freeKickHex occupancy — KICKER_HEX_EMPTY check removed', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedFreeKickSetup(roomCode, { kickerPlaced: true });

    const stage1PromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stage1PromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_FREE_KICK_READY); // stage 0 -> 1
    const [[s1]] = await Promise.all([stage1PromiseA, stage1PromiseB]);
    expect(s1.freeKickStageIndex).toBe(1);

    const stage2PromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stage2PromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FREE_KICK_READY); // stage 1 -> 2
    const [[s2]] = await Promise.all([stage2PromiseA, stage2PromiseB]);
    expect(s2.freeKickStageIndex).toBe(2);

    const stage3PromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stage3PromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_FREE_KICK_READY); // stage 2 -> 3, no KICKER_HEX_EMPTY check anymore
    const [[stage3State]] = await Promise.all([stage3PromiseA, stage3PromiseB]);
    expect(stage3State.freeKickStageIndex).toBe(3);
  });

  it('full sequence: all four stages complete, finalizing to PASS with correct carrier/attackingTeam/lastActionType/offsidePieceIds/movedPieceIds/field-clearing', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { freeKickHex } = seedFreeKickSetup(roomCode, { kickerPlaced: true });
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const awayKicker = room.gameState.pieces.find((p) => p.teamId === 'away');
    if (!awayKicker) throw new Error('No away piece found');
    // Seed multiple sticky offside flags (neither piece is "the offender" — no foul-trigger
    // call in this fixture) to prove the D-43/D-47 reset on finalize is unconditional.
    const homePieceIds = room.gameState.pieces
      .filter((p) => p.teamId === 'home')
      .map((p) => p.id)
      .slice(0, 2);
    room.gameState = {
      ...room.gameState,
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === awayKicker.id) return { ...p, position: freeKickHex };
        // All home (defending) pieces start clear of the 2-hex zone for stages 1 and 3.
        if (p.teamId === 'home') return { ...p, position: { q: 35, r: 1 } };
        return p;
      }),
      offsidePieceIds: homePieceIds,
    };

    // broadcastState emits to the WHOLE room — both clients receive every broadcast.
    // Wait for BOTH clients' copies of each step before registering the next listener,
    // or a listener for the NEXT broadcast can race against a still-in-flight copy of
    // the PREVIOUS one (mirrors the established pattern from the prior dual-Ready tests).

    // Stage 0 (kicking/away): end with zero new placements (kicker already on freeKickHex).
    const stage1PromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stage1PromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_FREE_KICK_READY);
    const [[stage1State]] = await Promise.all([stage1PromiseA, stage1PromiseB]);
    expect(stage1State.freeKickStageIndex).toBe(1);

    // Stage 1 (defending/home): all home pieces already clear of the zone.
    const stage2PromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stage2PromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FREE_KICK_READY);
    const [[stage2State]] = await Promise.all([stage2PromiseA, stage2PromiseB]);
    expect(stage2State.freeKickStageIndex).toBe(2);

    // Stage 2 (kicking/away, second kicking turn): kicker was already locked at stage 0.
    const stage3PromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stage3PromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_FREE_KICK_READY);
    const [[stage3State]] = await Promise.all([stage3PromiseA, stage3PromiseB]);
    expect(stage3State.freeKickStageIndex).toBe(3);

    // Stage 3 (defending/home, last defending turn): finalize.
    const finalPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FREE_KICK_READY);
    const [finalState] = await finalPromise;

    expect(finalState.phase).toBe('PASS');
    expect(finalState.ball.carrierId).toBe(awayKicker.id);
    expect(finalState.attackingTeam).toBe('away');
    expect(finalState.activeTeam).toBe('away');
    expect(finalState.lastActionType).toBe('FREE_KICK_RESTART');
    expect(finalState.freeKickHex).toBeNull();
    expect(finalState.freeKickAttackingTeam).toBeNull();
    expect(finalState.freeKickStageIndex).toBeNull();
    expect(finalState.freeKickPlacedPieceIds).toBeNull();
    // D-43/D-47: ALL sticky offside flags clear on finalize, not just an offender's.
    expect(finalState.offsidePieceIds).toEqual([]);
    // D-56: movedPieceIds (including the locked kicker) must not bleed into PASS.
    expect(finalState.movedPieceIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// D-41: shot-deflection sites — foul fires for a flagged offender even though
// the ball ends up loose (no clean possession)
// ---------------------------------------------------------------------------

describe('OFFSIDE-02 D-41: SNAPSHOT_DEFLECT deflection triggers the foul for a flagged defender', () => {
  function seedSnapshotDeflectWithGuaranteedDeflector(
    roomCode: string,
    flagged: boolean,
  ): { defenderId: string } {
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    const carrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    const onPathDefender = room.gameState.pieces.find(
      (p) => p.teamId === 'away' && p.role !== 'GK',
    );
    if (!carrier || !awayGK || !onPathDefender) throw new Error('Required pieces not found');

    const carrierPos = { q: 33, r: 13 };
    const gkPos = { q: 36, r: 13 };
    const onPathPos = { q: 34, r: 13 }; // directly on the shot line to {q:36,r:13}

    room.gameState = {
      ...room.gameState,
      phase: 'SNAPSHOT_DEFLECT',
      attackingTeam: 'home',
      activeTeam: 'away',
      ball: { position: carrierPos, carrierId: carrier.id },
      // MOVE-06 (Phase 17, corrected design): the carrier is already in the away third
      // (q=33 >= 26) before this end-turn — set ballZone to match so broadcastState's
      // applyFreeMoveZoneCheck does not treat the post-deflection ball position as a
      // fresh entry into a final third and hijack the phase into FREE_MOVE_ATTACK.
      ballZone: 'away',
      lastActionType: 'SNAPSHOT',
      shotTargetHex: { q: 36, r: 13 },
      snapDeflectMovedPieceId: null,
      snapDeflectPaceUsed: 0,
      offsidePieceIds: flagged ? [onPathDefender.id] : [],
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === carrier.id) return { ...p, position: carrierPos };
        if (p.id === awayGK.id) return { ...p, position: gkPos };
        // Guaranteed deflection: band A formula is die===5||6||die+tackling>=10.
        if (p.id === onPathDefender.id) return { ...p, position: onPathPos, tackling: 10 };
        return p;
      }),
    };
    return { defenderId: onPathDefender.id };
  }

  it("a FLAGGED defender deflecting a shot triggers FREE_KICK_SETUP at the defender's position", async () => {
    const { clientB, roomCode } = await setupRoom();
    const { defenderId } = seedSnapshotDeflectWithGuaranteedDeflector(roomCode, true);

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN); // defending team ends deflection-move turn
    const [newState] = await statePromise;

    expect(newState.phase).toBe('FREE_KICK_SETUP');
    // D-59 (BUG FIX): the flagged defender (the offender) is now auto-relocated away from
    // freeKickHex along with every other trapped conceding-team piece — freeKickHex itself
    // (the foul spot, fixed at the moment of the foul) no longer equals the defender's
    // CURRENT position post-relocation. Assert freeKickHex is the historical foul spot and
    // the defender no longer occupies it.
    expect(newState.freeKickHex).toEqual({ q: 34, r: 13 });
    const defender = newState.pieces.find((p) => p.id === defenderId);
    expect(defender?.position).not.toEqual(newState.freeKickHex);
    expect(newState.freeKickAttackingTeam).toBe('home');
    expect(newState.ball.carrierId).toBeNull();
    expect(newState.offsidePieceIds).not.toContain(defenderId);
  });

  it('an UNFLAGGED defender deflecting a shot does NOT trigger a free kick', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedSnapshotDeflectWithGuaranteedDeflector(roomCode, false);

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [newState] = await statePromise;

    expect(newState.phase).toBe('LOOSE_BALL');
    expect(newState.phase).not.toBe('FREE_KICK_SETUP');
  });
});

describe('OFFSIDE-02 D-41: regular GAME_SHOT deflection triggers the foul for a flagged defender', () => {
  function seedPassPhaseWithGuaranteedDeflector(
    roomCode: string,
    flagged: boolean,
  ): { defenderId: string } {
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    const carrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    const onPathDefender = room.gameState.pieces.find(
      (p) => p.teamId === 'away' && p.role !== 'GK',
    );
    if (!carrier || !awayGK || !onPathDefender) throw new Error('Required pieces not found');

    // D-09: shooter must be within 11 hexes of goal {q:36,r:13}.
    const carrierPos = { q: 25, r: 13 }; // hexDist to {q:36,r:13} = 11
    const gkPos = { q: 36, r: 13 };
    const onPathPos = { q: 30, r: 13 }; // on the straight line from carrierPos to goal

    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: null,
      ball: { position: carrierPos, carrierId: carrier.id },
      // MOVE-06 (Phase 17, corrected design): the deflection moves the ball to onPathPos
      // (q=30, away third) — pre-set ballZone to 'away' so this isn't treated as a fresh
      // entry into a final third by broadcastState's applyFreeMoveZoneCheck, which would
      // otherwise hijack the phase into FREE_MOVE_ATTACK before this test's assertion.
      ballZone: 'away',
      offsidePieceIds: flagged ? [onPathDefender.id] : [],
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === carrier.id) return { ...p, position: carrierPos };
        if (p.id === awayGK.id) return { ...p, position: gkPos };
        if (p.id === onPathDefender.id) return { ...p, position: onPathPos, tackling: 10 };
        return p;
      }),
    };
    return { defenderId: onPathDefender.id };
  }

  it("a FLAGGED defender deflecting a regular shot triggers FREE_KICK_SETUP at the defender's position", async () => {
    const { clientA, roomCode } = await setupRoom();
    const { defenderId } = seedPassPhaseWithGuaranteedDeflector(roomCode, true);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [newState] = await statePromise;

    expect(newState.phase).toBe('FREE_KICK_SETUP');
    // D-59 (BUG FIX): see the SNAPSHOT_DEFLECT analog above — the flagged defender (the
    // offender) is now auto-relocated away from freeKickHex, so freeKickHex (the fixed
    // historical foul spot) no longer equals the defender's CURRENT position.
    expect(newState.freeKickHex).toEqual({ q: 30, r: 13 });
    const defender = newState.pieces.find((p) => p.id === defenderId);
    expect(defender?.position).not.toEqual(newState.freeKickHex);
    expect(newState.freeKickAttackingTeam).toBe('home');
    expect(newState.ball.carrierId).toBeNull();
    expect(newState.offsidePieceIds).not.toContain(defenderId);
  });

  it('an UNFLAGGED defender deflecting a regular shot does NOT trigger a free kick', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedPassPhaseWithGuaranteedDeflector(roomCode, false);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [newState] = await statePromise;

    expect(newState.phase).toBe('LOOSE_BALL');
    expect(newState.phase).not.toBe('FREE_KICK_SETUP');
  });
});
