/**
 * Wave 7 socket-level integration tests for the GK dive-at-feet duel (Phase 39 Plan 15),
 * proving GKDIVE-01..05 end to end over a real Socket.io server + socket.io-client — no
 * mocking of the server itself. Structure mirrors foulFreeKick.integration.test.ts /
 * cornerKick.integration.test.ts (server lifecycle, createClient/oncePromise/
 * waitForConnect/waitForNStates/setupRoom).
 *
 * The offer is reached by driving a REAL `GAME_MOVE` (never a direct engine call) so the
 * post-action offer hook in roomStore.ts's `broadcastState` (Plan 39-15 Task 1) is
 * exercised exactly as a live client would trigger it — no client ever requests the
 * dive-at-feet prompt directly.
 *
 * Coverage (numbered to match the plan's Task 3 action list):
 * 1. A qualifying carrier move (within 3 hexes of the defending GK, parallel to the goal
 *    line) produces a broadcast with phase GK_DIVE_AT_FEET_PROMPT, with no client request.
 * 2. The attacking manager emitting GAME_GK_DIVE_AT_FEET -> WRONG_TEAM, phase unchanged.
 * 3. A non-boolean payload -> INVALID_TARGET.
 * 4. accept:false appends GK_DIVE_AT_FEET_DECLINED, restores the interrupted phase, and
 *    leaves the cap unset so a further qualifying move offers again.
 * 5. accept:true appends GK_DIVE_AT_FEET with both dice/scores and sets the cap so a
 *    further qualifying move does NOT re-offer (GKDIVE-05).
 * 6. After a dive-at-feet has been used, declaring a shot proceeds without a GK_DIVE
 *    phase (D-09 over the wire).
 * 7. A double-emitted GAME_GK_DIVE_AT_FEET produces exactly one dive event (mutex).
 * 8. With foulsEnabled:false, a qualifying carrier move produces NO GK_DIVE_AT_FEET_PROMPT
 *    (FOUL-05).
 *
 * Rule 1 auto-fix (discovered running this suite): GKDIVE-03 fires resolveFoulChain on
 * BOTH SUCCESS and FAIL whenever `gkDie === FOUL_TRIGGER_DIE` (1) — a real 1-in-6 chance
 * with unmocked `rollDice()` that intermittently sent item 5's accept flow into
 * FOUL_CHOICE instead of the expected resumed MOVE phase (a genuine game rule, not a
 * bug in the handler — but it makes item 5's "further move does not re-offer" assertion
 * flaky unless the dice are pinned). `vi.mock('../diceUtils.js')` fixes every roll to 3
 * (never 1) — mirrors shotGkRange.test.ts's identical mocking rationale. Every other
 * item in this file is dice-value-agnostic (decline never reads the rolled dice; the
 * D-09 shot-after-dive-used test's geometry keeps the GK on-path, so GAME_SHOT's own
 * deflection/auto-goal rollDice() calls are never reached before this file's assertion).
 */

// vi.mock is hoisted by vitest — must appear before other imports (mirrors
// shotGkRange.test.ts / foulFreeKick.integration.test.ts).
import { vi } from 'vitest';
vi.mock('../diceUtils.js', () => ({ rollDice: () => 3 }));

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
import { ClientEvents, ServerEvents, computeGkDiveAtFeetTargetHexes } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors foulFreeKick.integration.test.ts verbatim)
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
// Helpers (mirrors foulFreeKick.integration.test.ts verbatim)
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
 * arrival order. Used for the double-emit mutex-proof test (item 7).
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
// Seed helpers — direct room.gameState mutation (mirrors foulFreeKick.integration
// .test.ts / cornerKick.integration.test.ts's established seed pattern). Every seed
// parks every piece it does not care about far from the q=0..4/r=13 corridor and sets
// room.lastBroadcastBallPosition to the seeded ball position (D-10 39-15 Task 1
// convention — prevents roomStore.ts's box-entry offer hook from spuriously detecting a
// "fresh entry" from this direct test-state graft; see shotGkRange.test.ts for the
// identical pattern applied against the same broadcastState side-effect).
//
// The home GK sits ON the home goal hex ({q:0,r:13}, GOAL_R_VALUES' centre row) — the
// away team is the attacking team throughout this file, matching
// gameEngine.gkDiveAtFeet.test.ts's own fixture convention (homeGk at {q:0,r:13},
// carrierAt(q) at {q,r:13}: hexDistance(homeGk.position, {q,r:13}) === q, independently
// verified against the real hexDistance implementation by that unit-test file).
// ---------------------------------------------------------------------------

const HOME_GK_HEX: HexCoord = { q: 0, r: 13 };
/** Distance 4 from HOME_GK_HEX — outside GKDIVE-02's <=3 offer range. */
const CARRIER_OUT_OF_RANGE_HEX: HexCoord = { q: 4, r: 13 };
/** Distance 3 from HOME_GK_HEX — the GKDIVE-02 offer boundary (inclusive). */
const CARRIER_BOUNDARY_HEX: HexCoord = { q: 3, r: 13 };
/** Distance 2 from HOME_GK_HEX — well inside range, used for the "offers again" step. */
const CARRIER_CLOSER_HEX: HexCoord = { q: 2, r: 13 };

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: 18, r: idx % 25 } },
  );
}

/**
 * Seeds a fresh MOVE phase (ATTACKER_4, away attacking) with the home GK on its goal
 * hex and an away carrier at CARRIER_OUT_OF_RANGE_HEX (holding the ball) — ready for a
 * real single-hex GAME_MOVE to bring the carrier into GKDIVE-02 range.
 */
function seedDiveAtFeetMove(
  roomCode: string,
  opts: { foulsEnabled?: boolean; gkSaving?: number; carrierDribbling?: number } = {},
): { homeGkId: string; carrierId: string } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const carrier = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === homeGk.id) {
      return { ...p, position: HOME_GK_HEX, saving: opts.gkSaving ?? p.saving };
    }
    if (p.id === carrier.id) {
      return {
        ...p,
        position: CARRIER_OUT_OF_RANGE_HEX,
        pace: 6,
        dribbling: opts.carrierDribbling ?? p.dribbling,
      };
    }
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
    ball: { position: CARRIER_OUT_OF_RANGE_HEX, carrierId: carrier.id, lastTouchedBy: null },
    ballZone: 'home',
    foulsEnabled: opts.foulsEnabled ?? true,
    injuryEnabled: true,
    bookingEnabled: true,
    gkDiveAtFeetUsedByTeam: null,
    pieces,
  };
  room.lastBroadcastBallPosition = CARRIER_OUT_OF_RANGE_HEX;

  return { homeGkId: homeGk.id, carrierId: carrier.id };
}

/**
 * Drives the real qualifying GAME_MOVE (CARRIER_OUT_OF_RANGE_HEX -> CARRIER_BOUNDARY_HEX,
 * a single adjacent hex) that brings the carrier to exactly distance 3 from the GK — the
 * offer hook fires on this broadcast alone, no client request.
 *
 * Test-harness note (mirrors shotGkRange.test.ts's documented pitfall): waits for BOTH
 * clients' copies of the broadcast before resolving, even though only one is returned.
 * Registering the NEXT action's `.once()` listener before a still-in-flight copy of
 * THIS broadcast arrives on the other client races that listener against this stale
 * broadcast — it would resolve with the pre-move state instead of the next real one.
 */
async function driveIntoRange(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>,
  carrierId: string,
  to: HexCoord = CARRIER_BOUNDARY_HEX,
): Promise<GameState> {
  const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
  const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
  clientB.emit(ClientEvents.GAME_MOVE, carrierId, to);
  const [[stateA], [stateB]] = await Promise.all([statePromiseA, statePromiseB]);
  void stateB;
  return stateA;
}

/**
 * Seeds a PASS-phase state (away attacking) with the dive-at-feet cap ALREADY used by
 * the home team, ready for a real GAME_SHOT declaration (item 6, D-09 over the wire).
 */
function seedShotAfterDiveUsed(roomCode: string): { carrierId: string } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const carrier = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === homeGk.id) return { ...p, position: HOME_GK_HEX };
    if (p.id === carrier.id) return { ...p, position: CARRIER_BOUNDARY_HEX };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([homeGk.id, carrier.id]));

  room.gameState = {
    ...room.gameState,
    phase: 'PASS',
    attackingTeam: 'away',
    activeTeam: 'away',
    lastActionType: null,
    ball: { position: CARRIER_BOUNDARY_HEX, carrierId: carrier.id, lastTouchedBy: null },
    ballZone: 'home',
    foulsEnabled: true,
    gkDiveAtFeetUsedByTeam: { home: true, away: false },
    pieces,
  };
  room.lastBroadcastBallPosition = CARRIER_BOUNDARY_HEX;

  return { carrierId: carrier.id };
}

// ---------------------------------------------------------------------------
// 1. Automatic offer on a qualifying carrier move
// ---------------------------------------------------------------------------

describe('GKDIVE-02: automatic offer on a qualifying carrier move', () => {
  it('a carrier move to within 3 hexes of the defending GK produces GK_DIVE_AT_FEET_PROMPT with no client request for it', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId } = seedDiveAtFeetMove(roomCode);

    const state = await driveIntoRange(clientA, clientB, carrierId);

    expect(state.phase).toBe('GK_DIVE_AT_FEET_PROMPT');
    expect(state.gkDiveAtFeetTeam).toBe('home');
    expect(state.gkDiveAtFeetCarrierId).toBe(carrierId);
    expect(state.gkDiveAtFeetDistance).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 2/3. Access-control and payload validation
// ---------------------------------------------------------------------------

describe('GKDIVE-01: GAME_GK_DIVE_AT_FEET access control', () => {
  it('the attacking (non-GK) manager emitting GAME_GK_DIVE_AT_FEET receives WRONG_TEAM and the phase is unchanged', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId } = seedDiveAtFeetMove(roomCode);
    await driveIntoRange(clientA, clientB, carrierId);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_GK_DIVE_AT_FEET, true);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('GK_DIVE_AT_FEET_PROMPT');
  });

  it('a non-boolean payload receives INVALID_TARGET', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId } = seedDiveAtFeetMove(roomCode);
    await driveIntoRange(clientA, clientB, carrierId);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // Intentionally malformed payload (attacker-controlled) — accept must be a boolean.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_GK_DIVE_AT_FEET, 'yes');
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('GK_DIVE_AT_FEET_PROMPT');
  });
});

// ---------------------------------------------------------------------------
// 4. Decline — cap NOT consumed
// ---------------------------------------------------------------------------

describe('GKDIVE-02/D-07: declining the dive-at-feet offer', () => {
  it('accept:false appends GK_DIVE_AT_FEET_DECLINED, restores the interrupted phase, and leaves the cap unset so a further qualifying move offers again', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId } = seedDiveAtFeetMove(roomCode);
    await driveIntoRange(clientA, clientB, carrierId);

    // Wait for BOTH clients' copies of the decline broadcast (see driveIntoRange's doc
    // comment) before registering the next action's listener — otherwise a still-in-flight
    // copy of THIS broadcast on clientB could race the next listener and resolve stale.
    const declinePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declinePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GK_DIVE_AT_FEET, false);
    const [[declinedState]] = await Promise.all([declinePromiseA, declinePromiseB]);

    expect(declinedState.phase).toBe('MOVE');
    expect(declinedState.activeTeam).toBe('away');
    expect(declinedState.movementSlot).toBe('ATTACKER_4');
    expect(declinedState.gkDiveAtFeetTeam).toBeNull();
    expect(declinedState.gkDiveAtFeetUsedByTeam?.home).not.toBe(true);
    const declineEvent = declinedState.eventLog.find((e) => e.type === 'GK_DIVE_AT_FEET_DECLINED');
    expect(declineEvent).toBeDefined();

    // A further qualifying move (one more hex closer) offers again — cap was never consumed.
    const reOfferedState = await driveIntoRange(clientA, clientB, carrierId, CARRIER_CLOSER_HEX);

    expect(reOfferedState.phase).toBe('GK_DIVE_AT_FEET_PROMPT');
    expect(reOfferedState.gkDiveAtFeetTeam).toBe('home');
  });
});

// ---------------------------------------------------------------------------
// 5. Accept — cap consumed (GKDIVE-05)
// ---------------------------------------------------------------------------

describe('GKDIVE-01/05 (39-UAT gap 3): accepting the dive-at-feet offer opens GK_DIVE_AT_FEET_TARGET', () => {
  it('accept:true broadcasts phase GK_DIVE_AT_FEET_TARGET with no GK_DIVE_AT_FEET event appended yet, and sets the cap immediately', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId } = seedDiveAtFeetMove(roomCode);
    await driveIntoRange(clientA, clientB, carrierId);

    const acceptPromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const acceptPromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GK_DIVE_AT_FEET, true);
    const [[acceptedState]] = await Promise.all([acceptPromiseA, acceptPromiseB]);

    expect(acceptedState.phase).toBe('GK_DIVE_AT_FEET_TARGET');
    expect(acceptedState.eventLog.find((e) => e.type === 'GK_DIVE_AT_FEET')).toBeUndefined();
    expect(acceptedState.gkDiveAtFeetUsedByTeam?.home).toBe(true);
    expect(acceptedState.gkDiveAtFeetGkId).not.toBeNull();
    expect(acceptedState.gkDiveAtFeetCarrierId).toBe(carrierId);
  });

  it('accept:true then resolving GAME_GK_DIVE_AT_FEET_TARGET appends GK_DIVE_AT_FEET with both dice/scores and sets the cap so a further qualifying move does NOT re-offer', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    // Deterministic FAIL (carrier always wins the duel regardless of dice) so play resumes
    // in MOVE with the away carrier still holding the ball — lets the "further move does
    // not re-offer" assertion continue directly from the SAME carrier/ball.
    const { carrierId } = seedDiveAtFeetMove(roomCode, { gkSaving: 1, carrierDribbling: 10 });
    await driveIntoRange(clientA, clientB, carrierId);

    const acceptPromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const acceptPromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GK_DIVE_AT_FEET, true);
    const [[acceptedState]] = await Promise.all([acceptPromiseA, acceptPromiseB]);
    expect(acceptedState.phase).toBe('GK_DIVE_AT_FEET_TARGET');

    const chosenHex = computeGkDiveAtFeetTargetHexes(acceptedState)[0]!;
    const resolvePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const resolvePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GK_DIVE_AT_FEET_TARGET, chosenHex);
    const [[resolvedState]] = await Promise.all([resolvePromiseA, resolvePromiseB]);

    const diveEvent = resolvedState.eventLog.find((e) => e.type === 'GK_DIVE_AT_FEET');
    expect(diveEvent).toBeDefined();
    if (diveEvent?.type !== 'GK_DIVE_AT_FEET') throw new Error('unreachable');
    expect(typeof diveEvent.gkDie).toBe('number');
    expect(typeof diveEvent.carrierDie).toBe('number');
    expect(typeof diveEvent.gkCombined).toBe('number');
    expect(typeof diveEvent.carrierCombined).toBe('number');
    expect(diveEvent.result).toBe('FAIL');
    expect(diveEvent.diveTo).toEqual(chosenHex);
    expect(resolvedState.gkDiveAtFeetUsedByTeam?.home).toBe(true);
    expect(resolvedState.phase).toBe('MOVE');
    expect(resolvedState.activeTeam).toBe('away');

    // A further qualifying move (one more hex closer, still <=3) must NOT re-offer —
    // the cap is set.
    const noOfferState = await driveIntoRange(clientA, clientB, carrierId, CARRIER_CLOSER_HEX);

    expect(noOfferState.phase).toBe('MOVE');
    expect(noOfferState.gkDiveAtFeetTeam).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5b. GAME_GK_DIVE_AT_FEET_TARGET — access control, payload validation, server-side
// membership check, and the happy path (39-UAT gap 3)
// ---------------------------------------------------------------------------

describe('39-UAT gap 3: GAME_GK_DIVE_AT_FEET_TARGET', () => {
  async function acceptAndReachTarget(): Promise<{
    clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
    clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
    roomCode: string;
    acceptedState: GameState;
    gkId: string;
    carrierId: string;
  }> {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId, homeGkId } = seedDiveAtFeetMove(roomCode);
    await driveIntoRange(clientA, clientB, carrierId);

    const acceptPromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const acceptPromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GK_DIVE_AT_FEET, true);
    const [[acceptedState]] = await Promise.all([acceptPromiseA, acceptPromiseB]);

    return { clientA, clientB, roomCode, acceptedState, gkId: homeGkId, carrierId };
  }

  it('the NON-goalkeeper manager emitting GAME_GK_DIVE_AT_FEET_TARGET receives WRONG_TEAM and mutates nothing', async () => {
    const { clientB, roomCode, acceptedState, gkId } = await acceptAndReachTarget();
    const to = computeGkDiveAtFeetTargetHexes(acceptedState)[0]!;

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_GK_DIVE_AT_FEET_TARGET, to);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    const state = getRoom(roomCode)!.gameState!;
    expect(state.phase).toBe('GK_DIVE_AT_FEET_TARGET');
    expect(state.pieces.find((p) => p.id === gkId)?.position).toEqual(HOME_GK_HEX);
  });

  it('a malformed payload (missing q) receives INVALID_TARGET and mutates nothing', async () => {
    const { clientA, roomCode, gkId } = await acceptAndReachTarget();

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_GK_DIVE_AT_FEET_TARGET, { r: 13 });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    const state = getRoom(roomCode)!.gameState!;
    expect(state.phase).toBe('GK_DIVE_AT_FEET_TARGET');
    expect(state.pieces.find((p) => p.id === gkId)?.position).toEqual(HOME_GK_HEX);
  });

  it('a malformed payload (string r) receives INVALID_TARGET and mutates nothing', async () => {
    const { clientA, roomCode, gkId } = await acceptAndReachTarget();

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_GK_DIVE_AT_FEET_TARGET, { q: 1, r: '13' });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    const state = getRoom(roomCode)!.gameState!;
    expect(state.phase).toBe('GK_DIVE_AT_FEET_TARGET');
    expect(state.pieces.find((p) => p.id === gkId)?.position).toEqual(HOME_GK_HEX);
  });

  it('a legal-looking but out-of-set hex (adjacent to the carrier, but outside the GK dive range) receives MOVE_INVALID and leaves the goalkeeper unmoved', async () => {
    const { clientA, roomCode, gkId } = await acceptAndReachTarget();
    // The carrier sits at CARRIER_BOUNDARY_HEX ({q:3,r:13}), distance 3 from HOME_GK_HEX.
    // {q:4,r:13} is adjacent to the carrier (distance 1) but distance 4 from the GK —
    // "next to the attacker" but outside dive range.
    const outOfRangeButAdjacent: HexCoord = { q: 4, r: 13 };

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_GK_DIVE_AT_FEET_TARGET, outOfRangeButAdjacent);
    const [reason] = await errorPromise;

    expect(reason).toBe('MOVE_INVALID');
    const state = getRoom(roomCode)!.gameState!;
    expect(state.phase).toBe('GK_DIVE_AT_FEET_TARGET');
    expect(state.pieces.find((p) => p.id === gkId)?.position).toEqual(HOME_GK_HEX);
  });

  it('happy path: the goalkeeper piece ends up on the emitted hex and the event log ends with a matching GK_DIVE_AT_FEET event', async () => {
    const { clientA, clientB, acceptedState, gkId } = await acceptAndReachTarget();
    const chosenHex = computeGkDiveAtFeetTargetHexes(acceptedState)[0]!;

    const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GK_DIVE_AT_FEET_TARGET, chosenHex);
    const [[resolvedState]] = await Promise.all([statePromiseA, statePromiseB]);

    expect(resolvedState.pieces.find((p) => p.id === gkId)?.position).toEqual(chosenHex);
    const lastEvent = resolvedState.eventLog[resolvedState.eventLog.length - 1];
    expect(lastEvent?.type).toBe('GK_DIVE_AT_FEET');
    if (lastEvent?.type === 'GK_DIVE_AT_FEET') {
      expect(lastEvent.diveTo).toEqual(chosenHex);
      expect(lastEvent.gkId).toBe(gkId);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. D-09 over the wire: a used dive-at-feet cap skips the shot-block GK_DIVE window
// ---------------------------------------------------------------------------

describe('D-09: a used dive-at-feet cap skips the shot-block GK_DIVE reposition window', () => {
  it('declaring a shot after the dive-at-feet cap is used proceeds without reaching a GK_DIVE phase', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedShotAfterDiveUsed(roomCode);

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_SHOT, HOME_GK_HEX);
    const [state] = await statePromise;

    expect(state.phase).not.toBe('GK_DIVE');
  });
});

// ---------------------------------------------------------------------------
// 39-UAT gap 4 regression: the fifth GK_DIVE entry point (GAME_END_TURN's
// SNAPSHOT_DEFLECT resolution branch) must also route through enterGkDiveOrSkip.
// ---------------------------------------------------------------------------

/**
 * Seeds a SNAPSHOT_DEFLECT phase (away attacking, home defending) with the home team's
 * dive-at-feet cap ALREADY used, the shot path clear of any home outfield defender (no
 * deflection), and the home GK within range of the shot path (so, absent the fix, the
 * snapshot resolution would reach a shot-block GK_DIVE reposition window) — ready for a
 * real GAME_END_TURN emitted by the defending (home) manager.
 */
function seedSnapshotDeflectCapUsed(roomCode: string): { shooterId: string } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const shooter = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === homeGk.id) return { ...p, position: HOME_GK_HEX };
    if (p.id === shooter.id) return { ...p, position: CARRIER_BOUNDARY_HEX };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([homeGk.id, shooter.id]));

  room.gameState = {
    ...room.gameState,
    phase: 'SNAPSHOT_DEFLECT',
    attackingTeam: 'away',
    activeTeam: 'home',
    shotTargetHex: HOME_GK_HEX,
    ball: { position: CARRIER_BOUNDARY_HEX, carrierId: shooter.id, lastTouchedBy: null },
    ballZone: 'home',
    foulsEnabled: true,
    gkDiveAtFeetUsedByTeam: { home: true, away: false },
    pieces,
  };
  room.lastBroadcastBallPosition = CARRIER_BOUNDARY_HEX;

  return { shooterId: shooter.id };
}

describe('39-UAT gap 4: SNAPSHOT_DEFLECT resolution routes through enterGkDiveOrSkip', () => {
  it('a snapshot resolved via GAME_END_TURN when the defending team already used its dive-at-feet produces phase SHOT, never GK_DIVE', async () => {
    const { clientA, roomCode } = await setupRoom(); // clientA = home = defending team here
    seedSnapshotDeflectCapUsed(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('SHOT');
    expect(state.phase).not.toBe('GK_DIVE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('SHOT');
  });
});

// ---------------------------------------------------------------------------
// 7. Double-emit mutex
// ---------------------------------------------------------------------------

describe('T-39-15-05: double-emitted GAME_GK_DIVE_AT_FEET (isProcessing mutex)', () => {
  it('produces exactly one GK_DIVE_AT_FEET_DECLINED event', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId } = seedDiveAtFeetMove(roomCode);
    await driveIntoRange(clientA, clientB, carrierId);

    const statesPromise = waitForNStates(clientA, 2);
    clientA.emit(ClientEvents.GAME_GK_DIVE_AT_FEET, false);
    clientA.emit(ClientEvents.GAME_GK_DIVE_AT_FEET, false);
    const states = await statesPromise;

    expect(states[states.length - 1]!.phase).toBe('MOVE');
    const finalState = getRoom(roomCode)!.gameState!;
    const declineEvents = finalState.eventLog.filter((e) => e.type === 'GK_DIVE_AT_FEET_DECLINED');
    expect(declineEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 8. FOUL-05: foulsEnabled: false gates the whole offer over the wire
// ---------------------------------------------------------------------------

describe('FOUL-05: foulsEnabled: false gates the dive-at-feet offer over the wire', () => {
  it('with foulsEnabled: false, a qualifying carrier move produces NO GK_DIVE_AT_FEET_PROMPT', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { carrierId } = seedDiveAtFeetMove(roomCode, { foulsEnabled: false });

    const state = await driveIntoRange(clientA, clientB, carrierId);

    expect(state.phase).toBe('MOVE');
    expect(state.gkDiveAtFeetTeam).toBeFalsy();
  });
});
