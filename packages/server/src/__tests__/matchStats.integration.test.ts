/**
 * Phase 45 (Game Summary Popup) -- STATS-01..09 end-to-end socket integration suite.
 *
 * Covers the full six-hop chain: a client emits a real action over Socket.io -> the
 * server-authoritative handler validates it -> the pure engine (gameEngine.ts) resolves
 * it -> matchStatsReducer.ts / the inline shot-capture sites fold the result into
 * `GameState.matchStats` -> `roomStore.ts`'s `broadcastState` sends the full snapshot ->
 * both connected clients receive the SAME `matchStats` object on the broadcast
 * `GameState`.
 *
 * Plans 45-01 through 45-05 each verified their own hop in isolation:
 * - 45-01: the pure `computeShotXg` formula and `MatchStats`/`RefereeCard.wasManualOverride`
 *   contract (unit-level, no sockets).
 * - 45-02: per-shot-resolution-site xG/shots capture, called directly against `applyRoll`/
 *   `applyPenaltyKickDuel` with explicit dice (no sockets).
 * - 45-03: `foldMatchStats`'s per-event-type folding rules, called directly with hand-built
 *   event arrays (no sockets); the `roomStore.ts` `broadcastState` fold wiring, exercised via
 *   `roomStore.test.ts`'s existing harness (no live client sockets).
 * - 45-04/45-05: the client-side rendering of `matchStats` inside `MatchSummaryContent`/
 *   `GameBoard` (component tests + one human-verify checkpoint), never touching the socket
 *   layer itself.
 *
 * Nothing so far has proven that a real client action -- driven over a real Socket.io
 * connection, through the real handler/engine/reducer/broadcast chain -- produces an
 * updated `matchStats` figure that BOTH connected browsers observe identically. That is
 * the gap this file closes, in the same style as `refereeLeniency.integration.test.ts`
 * closed the equivalent gap for Phase 44's Leniency override chain.
 *
 * This file deliberately does NOT re-test: the xG formula's own arithmetic (45-01), the
 * per-branch shot-capture call-site wiring (45-02, already proven via direct `applyRoll`/
 * `applyPenaltyKickDuel` calls), the reducer's own per-event-type switch logic (45-03), or
 * any client-side rendering (45-04/45-05). It asserts ONLY on the broadcast `GameState`
 * each client receives -- never on internal engine return values -- because the point of
 * this suite is that the numbers reach the browser.
 *
 * Structure mirrors `refereeLeniency.integration.test.ts` (server lifecycle,
 * `createClient`/`oncePromise`/`waitForConnect`, a local `setupMatch` helper that drives
 * create -> confirm settings -> join -> team pick -> uniform confirm -> LINEUP_CONFIRM and
 * returns the first broadcast `GameState`). Deliberately copied verbatim per the
 * per-file-self-contained convention documented in `testHelpers.ts` (lines 4-12) rather
 * than imported.
 *
 * Deterministic outcomes without dice mocking: this file never mocks `diceUtils.js`.
 * Where a test needs a guaranteed SUCCESS or FAIL duel outcome (the tackle tests), it uses
 * extreme attribute values (mirrors `gkDiveAtFeet.integration.test.ts`'s
 * `carrierDribbling: 10` convention) so the outcome is deterministic regardless of the real
 * `crypto.randomInt`-backed die roll. Where the outcome genuinely doesn't matter (the shot
 * test), real dice are used and the assertion only checks the invariant that holds across
 * every possible outcome (shots +1, `0 < xg <= 1`).
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
  MatchStats,
  ServerToClientEvents,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents, hexNeighbors, isPitchHex } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (copied verbatim per the per-file self-contained convention)
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
 * Local settings-confirm helper parametrised on the two Referee Leniency fields (mirrors
 * refereeLeniency.integration.test.ts's confirmRoomSettings). Every other field is pinned
 * to the same defaults `testHelpers.ts`'s `confirmDefaultRoomSettings` uses -- standard
 * speed, no toggles enabled, no tackle/steal decline -- so every seed helper in this file
 * can assume the tackle/steal duel resolves immediately (no TACKLE_STEAL_PROMPT interrupt)
 * and no foul/injury/booking chain fires.
 */
function confirmRoomSettings(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  refereeLeniencyOverride: boolean,
  refereeLeniencyValue: number,
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
      tackleStealDecline: false,
      refereeLeniencyOverride,
      refereeLeniencyValue,
    });
  });
}

/**
 * Creates a room with 2 connected clients, confirms settings with the given Referee
 * Leniency override, and completes team/uniform/lineup confirmation. Returns the first
 * broadcast `GameState` after both LINEUP_CONFIRM emits (mirrors
 * refereeLeniency.integration.test.ts's setupMatchWithLeniency). clientA = slot 1 =
 * 'home'; clientB = slot 2 = 'away' (project-wide convention).
 */
async function setupMatch(
  refereeLeniencyOverride: boolean,
  refereeLeniencyValue: number,
): Promise<{
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

  await confirmRoomSettings(clientA, refereeLeniencyOverride, refereeLeniencyValue);

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
// Seed helpers -- direct room.gameState mutation (mirrors penaltyKick.integration.test.ts
// / gkDiveAtFeet.integration.test.ts's established seed pattern: seed the state directly
// to the immediately-preceding position, then drive the FINAL action over a real socket).
// ---------------------------------------------------------------------------

/** A hex well inside the open middle of the pitch -- neutral, no box/ZoI/offside hazards. */
const OPEN_MID_HEX: HexCoord = { q: 18, r: 13 };

function parkBackgroundPieces<T extends { id: string; teamId: 'home' | 'away' }>(
  pieces: readonly T[],
  keepIds: ReadonlySet<string>,
): T[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 2 : 34, r: idx % 25 } },
  );
}

/** Seeds a PASS phase with a lone home carrier at OPEN_MID_HEX -- every other piece parked
 * far away so the pass has zero interceptors and resolves accurately unconditionally. */
function seedPassScenario(roomCode: string): { targetHex: HexCoord } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');
  const state = room.gameState;

  const passer = state.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
  const targetHex: HexCoord = { q: OPEN_MID_HEX.q + 1, r: OPEN_MID_HEX.r };

  let pieces = state.pieces.map((p) => (p.id === passer.id ? { ...p, position: OPEN_MID_HEX } : p));
  pieces = parkBackgroundPieces(pieces, new Set([passer.id]));

  room.gameState = {
    ...state,
    phase: 'PASS',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: 'MOVEMENT_PHASE',
    ball: { position: OPEN_MID_HEX, carrierId: passer.id, lastTouchedBy: null },
    ballZone: 'middle',
    pieces,
  };
  room.lastBroadcastBallPosition = OPEN_MID_HEX;

  return { targetHex };
}

/**
 * Seeds a MOVE phase (DEFENDER_5 slot, away defending) with a stationary home carrier at
 * OPEN_MID_HEX and an away defender one hex further out, ready to move into a
 * TACKLE_ATTEMPT-triggering hex adjacent to the carrier (moveValidator.ts guard 7: a
 * non-carrier moving to a hex adjacent to an opposing carrier). `defenderTackling` /
 * `carrierDribbling` are set to extreme values so the duel outcome is deterministic
 * regardless of the real (unmocked) die roll -- mirrors gkDiveAtFeet.integration.test.ts's
 * `carrierDribbling: 10` convention.
 */
function seedTackleScenario(
  roomCode: string,
  opts: { defenderTackling: number; carrierDribbling: number },
): { defenderId: string; approachHex: HexCoord } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');
  const state = room.gameState;

  const approachHex = hexNeighbors(OPEN_MID_HEX).find((h) => isPitchHex(h))!;
  const defenderHex = hexNeighbors(approachHex).find(
    (h) => isPitchHex(h) && !(h.q === OPEN_MID_HEX.q && h.r === OPEN_MID_HEX.r),
  )!;

  const carrier = state.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
  const defender = state.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;

  let pieces = state.pieces.map((p) => {
    if (p.id === carrier.id)
      return { ...p, position: OPEN_MID_HEX, dribbling: opts.carrierDribbling };
    if (p.id === defender.id)
      return { ...p, position: defenderHex, tackling: opts.defenderTackling };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([carrier.id, defender.id]));

  room.gameState = {
    ...state,
    phase: 'MOVE',
    attackingTeam: 'home',
    activeTeam: 'away',
    movementSlot: 'DEFENDER_5',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    stealAttemptedByIds: [],
    tackleAttemptedByIds: [],
    ball: { position: OPEN_MID_HEX, carrierId: carrier.id, lastTouchedBy: null },
    ballZone: 'middle',
    foulsEnabled: false,
    pieces,
  };
  room.lastBroadcastBallPosition = OPEN_MID_HEX;

  return { defenderId: defender.id, approachHex };
}

/**
 * Seeds a GK_DIVE phase (home attacking, away GK diving) with the shot path a straight
 * line from the shooter's hex to the goal hex, and the GK already positioned exactly on
 * the goal hex -- a 0-hex dive to the same hex is trivially on-path and within 3 hexes, so
 * driving GAME_GK_DIVE over the socket unconditionally reaches the post-dive auto-resolve
 * shot duel (gameHandlers.ts's GAME_GK_DIVE handler) regardless of dice.
 */
function seedGkDiveShotScenario(roomCode: string): { goalHex: HexCoord } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');
  const state = room.gameState;

  const shooter = state.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
  const awayGk = state.pieces.find((p) => p.teamId === 'away' && p.role === 'GK')!;
  const shooterHex: HexCoord = { q: 34, r: 13 }; // inside awayPenaltyArea (q>=31), not awaySixYardBox (q>=35)
  const goalHex: HexCoord = { q: 36, r: 13 }; // inside awaySixYardBox

  let pieces = state.pieces.map((p) => {
    if (p.id === shooter.id) return { ...p, position: shooterHex };
    if (p.id === awayGk.id) return { ...p, position: goalHex };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([shooter.id, awayGk.id]));

  room.gameState = {
    ...state,
    phase: 'GK_DIVE',
    attackingTeam: 'home',
    activeTeam: 'away',
    movementSlot: null,
    lastActionType: 'SHOT',
    shotTargetHex: goalHex,
    gkDivePosition: goalHex,
    ball: { position: shooterHex, carrierId: shooter.id, lastTouchedBy: null },
    ballZone: 'away',
    pieces,
  };
  room.lastBroadcastBallPosition = shooterHex;

  return { goalHex };
}

/** Seeds a MOVE phase at the last movement slot (ATTACKER_2), close to (or exactly at) an
 * actionCount boundary, so a single real GAME_END_TURN drives the slot-advance/clock-tick
 * (and, when the boundary is crossed, the HALF_TIME transition) in one socket round-trip. */
function seedNearSlotAdvance(
  roomCode: string,
  overrides: { actionCount: number; addedTime?: number | null },
): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');
  const state = room.gameState;

  room.gameState = {
    ...state,
    phase: 'MOVE',
    attackingTeam: 'home',
    activeTeam: 'home',
    movementSlot: 'ATTACKER_2',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    half: 1,
    actionCount: overrides.actionCount,
    addedTime: overrides.addedTime ?? null,
  };
}

/** Non-zero, distinct-per-field pre-half-time MatchStats fixture -- every one of the nine
 * counters carries a DIFFERENT non-zero value so a test that accidentally reads the wrong
 * field cannot pass by coincidence. */
const PRE_HALF_STATS: MatchStats = {
  possessionActionCount: { home: 5, away: 3 },
  passesCompleted: { home: 4, away: 2 },
  tackleStealAttempts: { home: 3, away: 1 },
  tackleStealSuccesses: { home: 2, away: 1 },
  shots: { home: 2, away: 1 },
  xg: { home: 0.6, away: 0.3 },
  fouls: { home: 1, away: 0 },
  yellowCards: { home: 1, away: 0 },
  redCards: { home: 0, away: 0 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('matchStats end-to-end socket integration (STATS-01..09, T-45-22, T-45-23)', () => {
  it('a freshly built match broadcasts a GameState whose matchStats is present and all-zero across all nine counters (STATS-04..09)', async () => {
    const { clientA, clientB, state } = await setupMatch(false, 4);
    expect(state.matchStats).toBeDefined();
    const stats = state.matchStats!;
    for (const key of Object.keys(stats) as (keyof MatchStats)[]) {
      expect(stats[key]).toEqual({ home: 0, away: 0 });
    }
    clientA.disconnect();
    clientB.disconnect();
  });

  it('refereeCard.wasManualOverride is true in the broadcast state when the room was created with a manual Leniency override (STATS-03)', async () => {
    const { clientA, clientB, state } = await setupMatch(true, 3);
    expect(state.refereeCard.wasManualOverride).toBe(true);
    clientA.disconnect();
    clientB.disconnect();
  });

  it('refereeCard.wasManualOverride is false or absent when Leniency was left to the random roll -- proving the STATS-03 distinction survives the full six-hop chain from room settings to broadcast', async () => {
    const { clientA, clientB, state } = await setupMatch(false, 4);
    expect(state.refereeCard.wasManualOverride).toBeFalsy();
    clientA.disconnect();
    clientB.disconnect();
  });

  it('driving a completed pass over real sockets increases passesCompleted for the passing team by exactly 1, and leaves the other team unchanged (STATS-05)', async () => {
    const { clientA, clientB, roomCode } = await setupMatch(false, 4);
    const { targetHex } = seedPassScenario(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', targetHex);
    const [state] = await statePromise;

    expect(state.matchStats?.passesCompleted.home).toBe(1);
    expect(state.matchStats?.passesCompleted.away).toBe(0);
    clientA.disconnect();
    clientB.disconnect();
  });

  it('both connected clients receive the same broadcast payload: the matchStats object each client observes for a given action is deep-equal (T-45-22)', async () => {
    const { clientA, clientB, roomCode } = await setupMatch(false, 4);
    const { targetHex } = seedPassScenario(roomCode);

    const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', targetHex);
    const [[stateA], [stateB]] = await Promise.all([statePromiseA, statePromiseB]);

    expect(stateA.matchStats).toEqual(stateB.matchStats);
    expect(stateA.matchStats?.passesCompleted.home).toBe(1);
    clientA.disconnect();
    clientB.disconnect();
  });

  it('driving a tackle duel that the defender wins increases tackleStealAttempts AND tackleStealSuccesses for the defending team by exactly 1 (STATS-06)', async () => {
    const { clientB, roomCode } = await setupMatch(false, 4);
    // Extreme attribute split guarantees SUCCESS regardless of the real (unmocked) dice:
    // defCombined (>=11) always >= carCombined (<=7).
    const { defenderId, approachHex } = seedTackleScenario(roomCode, {
      defenderTackling: 10,
      carrierDribbling: 1,
    });

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_MOVE, defenderId, approachHex);
    const [state] = await statePromise;

    expect(state.matchStats?.tackleStealAttempts.away).toBe(1);
    expect(state.matchStats?.tackleStealSuccesses.away).toBe(1);
    expect(state.matchStats?.tackleStealAttempts.home).toBe(0);
    expect(state.matchStats?.tackleStealSuccesses.home).toBe(0);
    clientB.disconnect();
  });

  it('driving a tackle duel that the carrier wins increases tackleStealAttempts for the defending team by exactly 1 but leaves tackleStealSuccesses unchanged (STATS-06)', async () => {
    const { clientB, roomCode } = await setupMatch(false, 4);
    // Extreme attribute split guarantees FAIL regardless of the real (unmocked) dice:
    // defCombined (<=7) always < carCombined (>=21).
    const { defenderId, approachHex } = seedTackleScenario(roomCode, {
      defenderTackling: 1,
      carrierDribbling: 20,
    });

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_MOVE, defenderId, approachHex);
    const [state] = await statePromise;

    expect(state.matchStats?.tackleStealAttempts.away).toBe(1);
    expect(state.matchStats?.tackleStealSuccesses.away).toBe(0);
    clientB.disconnect();
  });

  it('driving a shot (via GK_DIVE auto-resolve) increases shots for the attacking team by exactly 1 and increases xg for that team by a value strictly greater than 0 and no greater than 1 (STATS-07/08)', async () => {
    const { clientA, clientB, roomCode } = await setupMatch(false, 4);
    const { goalHex } = seedGkDiveShotScenario(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_GK_DIVE, goalHex);
    const [state] = await statePromise;

    expect(state.matchStats?.shots.home).toBe(1);
    expect(state.matchStats?.shots.away).toBe(0);
    expect(state.matchStats?.xg.home).toBeGreaterThan(0);
    expect(state.matchStats?.xg.home).toBeLessThanOrEqual(1);
    clientA.disconnect();
    clientB.disconnect();
  });

  it('elapsed match time accrues into possessionActionCount: after a real GAME_END_TURN, the two team counters sum to a value greater than 0 and no greater than the broadcast actionCount (STATS-04, D-05)', async () => {
    const { clientA, clientB, roomCode } = await setupMatch(false, 4);
    seedNearSlotAdvance(roomCode, { actionCount: 10 });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.actionCount).toBeGreaterThan(10);
    const { home, away } = state.matchStats!.possessionActionCount;
    expect(home + away).toBeGreaterThan(0);
    expect(home + away).toBeLessThanOrEqual(state.actionCount);
    clientA.disconnect();
    clientB.disconnect();
  });

  it('crossing the half-time boundary via a real GAME_END_TURN leaves every one of the nine matchStats counters at or above its pre-half-time value, resets addedTimeBonus to 0, and leaves subsUsed unchanged (STATS-04..09, T-45-23, ROADMAP Success Criterion 4, D-06)', async () => {
    const { clientA, clientB, roomCode } = await setupMatch(false, 4);
    const room = getRoom(roomCode)!;

    // HALF_LENGTH=45, GAME_SPEED_MINUTES.standard=2: actionCount 44 -> 46 on this single
    // ATTACKER_2->PASS transition. addedTime is pre-set (non-null) so the added-time roll
    // is skipped and halfEnd = 45 + 1 = 46 is reached on this exact call.
    seedNearSlotAdvance(roomCode, { actionCount: 44, addedTime: 1 });
    room.gameState = {
      ...room.gameState!,
      matchStats: PRE_HALF_STATS,
      subsUsed: { home: 2, away: 1 },
      addedTimeBonus: 5,
    };

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('HALF_TIME');

    // Per-counter assertion (not just one representative counter) -- the failure mode this
    // guards against is exactly ONE counter accidentally being rebuilt/reset while the
    // other eight silently carry forward, which a single aggregate assertion would miss.
    const postStats = state.matchStats!;
    for (const key of Object.keys(PRE_HALF_STATS) as (keyof MatchStats)[]) {
      expect(postStats[key].home).toBeGreaterThanOrEqual(PRE_HALF_STATS[key].home);
      expect(postStats[key].away).toBeGreaterThanOrEqual(PRE_HALF_STATS[key].away);
    }

    // subsUsed (SUB-04, whole-match cap) persists byte-for-byte across the boundary --
    // it must never be conflated with addedTimeBonus's per-half reset below.
    expect(state.subsUsed).toEqual({ home: 2, away: 1 });
    // addedTimeBonus (SUB-05, per-half accumulator) resets to 0 at the boundary -- proving
    // the new matchStats family joined the whole-match (subsUsed-like) lifecycle without
    // disturbing the pre-existing per-half (addedTimeBonus) one.
    expect(state.addedTimeBonus).toBe(0);

    clientA.disconnect();
    clientB.disconnect();
  });
});
