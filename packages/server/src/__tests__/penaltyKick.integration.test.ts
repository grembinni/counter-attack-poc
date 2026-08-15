/**
 * Wave 4 socket-level integration tests for the full penalty-kick sequence (Phase 39
 * Plan 11), proving PEN-01/02/03 end to end over a real Socket.io server +
 * socket.io-client — no mocking. Structure mirrors goalKick.integration.test.ts
 * (server lifecycle, createClient/oncePromise/waitForConnect/waitForNStates/setupRoom)
 * and seeds restart phases the same way: drive to a room, then mutate
 * getRoom(code)!.gameState directly (using the real `triggerPenaltyKick` engine
 * function where possible so the fixture matches production exactly), then emit over
 * the wire.
 *
 * Coverage:
 * - Reposition windows (PEN-02): unbudgeted single-hex-per-click repositioning, the
 *   wrong-team snap-back guard, and the PENALTY_AREA_RESTRICTED guard.
 * - Window handoff (PEN-02/D-08): attacking -> defending -> taker-select.
 * - Taker selection (PEN-02): WRONG_TEAM, goalkeeper rejection, successful placement,
 *   malformed-payload rejection, and the isProcessing mutex (double-emit proof).
 * - Duel resolution (PEN-01/03): the flat -2 GK dice penalty expressed as an
 *   arithmetic relationship against the event's own reported dice (never a hardcoded
 *   score), and the tie-to-LOOSE_BALL routing (proven deterministically via a direct
 *   `applyPenaltyKickDuel` call, with the socket-level GAME_ROLL run kept as a real-RNG
 *   smoke check over the 3 legal outcomes).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import {
  applyMove,
  applyPenaltyKickDuel,
  applyPenaltyKickTaker,
  triggerPenaltyKick,
} from '../gameEngine.js';
import type {
  ClientToServerEvents,
  GameState,
  HexCoord,
  PlayerPiece,
  ServerToClientEvents,
} from '@counter-attack/shared';
import {
  ClientEvents,
  PENALTY_SPOT,
  PENALTY_GOAL_LINE_CENTRE,
  ServerEvents,
  hexNeighbors,
  isInRegion,
  isPitchHex,
} from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors goalKick.integration.test.ts verbatim)
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
// Helpers (mirrors goalKick.integration.test.ts verbatim)
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
 * arrival order. Used for the double-emit mutex-proof test, where a second emit still
 * produces a (no-op) snap-back broadcast that a single oncePromise would miss.
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
// Seed helpers — direct room.gameState mutation (mirrors goalKick.integration.test.ts's
// seed-helper family). PENALTY_KICK_TEAM is always 'home' (the kicking/attacking team);
// DEFENDING_TEAM is always 'away' — mirrors GOAL_KICK_TEAM's fixed convention.
// ---------------------------------------------------------------------------

const PENALTY_KICK_TEAM: 'home' | 'away' = 'home';
const DEFENDING_TEAM: 'home' | 'away' = 'away';

/** Fixed hexes used across the seed helpers below — verified via hexNeighbors/isInRegion,
 * never guessed, per STATE.md's ODD-Q-adjacency pitfall. */
const MOVER_START: HexCoord = { q: 18, r: 5 }; // open middle of the pitch, outside both boxes
const BOX_BOUNDARY_START: HexCoord = { q: 30, r: 13 }; // just outside awayPenaltyArea (q<=30)
const HOME_GK_HEX: HexCoord = { q: 2, r: 13 };
const AWAY_GK_HEX: HexCoord = { q: 34, r: 6 }; // inside awayPenaltyArea, away from r=12..14 test row

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 12 : 13, r: idx % 25 } },
  );
}

/**
 * Seeds PENALTY_KICK_SETUP_ATTACKING via the real `triggerPenaltyKick` + `applyPenaltyKickTaker`
 * chain (39-22: taker-select now precedes both reposition windows) so eligibleIds/spot/ball
 * are exactly what the engine itself produces. `taker` is a THIRD home outfielder, distinct
 * from `mover`/`boxBoundaryPiece`, so those two remain eligible for the reposition tests below
 * (the chosen taker and the defending GK are excluded from both eligible lists — T-39-22-02).
 */
function seedPenaltyKickSetupAttacking(roomCode: string): {
  moverPieceId: string;
  moverStart: HexCoord;
  moverNeighbor: HexCoord;
  boxBoundaryPieceId: string;
  boxBoundaryStart: HexCoord;
  boxNeighbor: HexCoord; // inside awayPenaltyArea, adjacent to boxBoundaryStart
  homeGkId: string;
  awayGkId: string;
  takerId: string;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const awayGk = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK')!;
  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const mover = homeOutfield[0]!;
  const boxBoundaryPiece = homeOutfield[1]!;
  const taker = homeOutfield[2]!;

  const moverNeighbor = hexNeighbors(MOVER_START).find(
    (h) => isPitchHex(h) && !isInRegion(h, 'awayPenaltyArea') && !isInRegion(h, 'homePenaltyArea'),
  )!;
  const boxNeighbor = hexNeighbors(BOX_BOUNDARY_START).find((h) =>
    isInRegion(h, 'awayPenaltyArea'),
  )!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === mover.id) return { ...p, position: MOVER_START };
    if (p.id === boxBoundaryPiece.id) return { ...p, position: BOX_BOUNDARY_START };
    if (p.id === homeGk.id) return { ...p, position: HOME_GK_HEX };
    if (p.id === awayGk.id) return { ...p, position: AWAY_GK_HEX };
    return p;
  });
  pieces = parkBackgroundPieces(
    pieces,
    new Set([mover.id, boxBoundaryPiece.id, taker.id, homeGk.id, awayGk.id]),
  );

  const awarded = triggerPenaltyKick({ ...room.gameState, pieces }, PENALTY_KICK_TEAM);
  const takerResult = applyPenaltyKickTaker(awarded, taker.id);
  if (!takerResult.ok)
    throw new Error(`seed: applyPenaltyKickTaker failed (${takerResult.reason})`);
  room.gameState = takerResult.state;

  return {
    moverPieceId: mover.id,
    moverStart: MOVER_START,
    moverNeighbor,
    boxBoundaryPieceId: boxBoundaryPiece.id,
    boxBoundaryStart: BOX_BOUNDARY_START,
    boxNeighbor,
    homeGkId: homeGk.id,
    awayGkId: awayGk.id,
    takerId: taker.id,
  };
}

/** Seeds PENALTY_KICK_TAKER_SELECT directly — both reposition windows already closed. */
function seedPenaltyKickTakerSelect(roomCode: string): {
  eligibleOutfielderId: string;
  homeGkId: string;
  awayGkId: string;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const awayGk = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK')!;
  const outfielder = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;

  const spot = PENALTY_SPOT[DEFENDING_TEAM];
  const eligibleIds = {
    attacking: room.gameState.pieces.filter((p) => p.teamId === 'home').map((p) => p.id),
    defending: room.gameState.pieces.filter((p) => p.teamId === 'away').map((p) => p.id),
  };

  room.gameState = {
    ...room.gameState,
    phase: 'PENALTY_KICK_TAKER_SELECT',
    penaltyKickTeam: PENALTY_KICK_TEAM,
    penaltyKickSpot: spot,
    penaltyKickEligibleIds: eligibleIds,
    penaltyKickUsedPace: {},
    penaltyKickTakerId: null,
    attackingTeam: PENALTY_KICK_TEAM,
    activeTeam: PENALTY_KICK_TEAM,
    movedPieceIds: [],
    ball: { position: spot, carrierId: null, lastTouchedBy: null },
  };

  return { eligibleOutfielderId: outfielder.id, homeGkId: homeGk.id, awayGkId: awayGk.id };
}

/**
 * Seeds PENALTY_KICK — the taker already placed on the spot, holding the ball.
 * `opts` overrides the taker's `shooting` / GK's `saving` attribute so the -2 and
 * tie assertions can be made deterministic without ever mocking `rollDice()` itself.
 */
function seedPenaltyKickDuel(
  roomCode: string,
  opts?: { takerShooting?: number; gkSaving?: number },
): { takerId: string; gkId: string; spot: HexCoord; gkSaving: number; takerShooting: number } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const gk = room.gameState.pieces.find((p) => p.teamId === DEFENDING_TEAM && p.role === 'GK')!;
  const taker = room.gameState.pieces.find(
    (p) => p.teamId === PENALTY_KICK_TEAM && p.role !== 'GK',
  )!;
  const spot = PENALTY_SPOT[DEFENDING_TEAM];
  const takerShooting = opts?.takerShooting ?? taker.shooting;
  const gkSaving = opts?.gkSaving ?? gk.saving;

  const pieces = room.gameState.pieces.map((p) => {
    if (p.id === taker.id) return { ...p, position: spot, shooting: takerShooting };
    if (p.id === gk.id) return { ...p, saving: gkSaving };
    return p;
  });

  room.gameState = {
    ...room.gameState,
    phase: 'PENALTY_KICK',
    pieces,
    // MOVE-06/D-33: PENALTY_KICK itself is zone-check-exempt, but its resolution
    // (KICK_OFF_SETUP/GK_RESTART/LOOSE_BALL) is NOT — an un-set/stale ballZone here
    // would spuriously read as a "fresh entry into a final third" the instant the duel
    // resolves and hijack the very phase this test suite asserts on with an unrelated
    // FREE_MOVE_ATTACK/DEFENSE overlay. The penalty spot genuinely sits in the
    // defending team's third, so 'away' is also the semantically correct value here
    // (mirrors goalKick.integration.test.ts's parking-based avoidance of the same hazard).
    ballZone: 'away',
    penaltyKickTeam: PENALTY_KICK_TEAM,
    penaltyKickSpot: spot,
    penaltyKickTakerId: taker.id,
    penaltyKickEligibleIds: {
      attacking: pieces.filter((p) => p.teamId === 'home').map((p) => p.id),
      defending: pieces.filter((p) => p.teamId === 'away').map((p) => p.id),
    },
    attackingTeam: PENALTY_KICK_TEAM,
    activeTeam: PENALTY_KICK_TEAM,
    ball: {
      position: spot,
      carrierId: taker.id,
      lastTouchedBy: { pieceId: taker.id, teamId: taker.teamId },
    },
  };
  // D-10 (Phase 39, 39-15): mark the ball's PREVIOUS-broadcast position as already at
  // the penalty spot so roomStore.ts's box-entry offer hook does not spuriously detect
  // a "fresh entry" into the penalty area when the duel resolves (e.g. a tie routing to
  // LOOSE_BALL with the ball still at `spot`) — mirrors the ballZone pre-match above.
  room.lastBroadcastBallPosition = spot;

  return { takerId: taker.id, gkId: gk.id, spot, gkSaving, takerShooting };
}

// ---------------------------------------------------------------------------
// PEN-02: reposition windows
// ---------------------------------------------------------------------------

describe('PEN-02: PENALTY_KICK_SETUP_ATTACKING/DEFENDING reposition windows', () => {
  // 39-22 (gap closure, UAT gap 5): taker-select now precedes both reposition windows,
  // so by the time SETUP_ATTACKING is reached the taker is already on the spot holding
  // the ball, and eligibility has been narrowed to exclude the taker + defending GK.
  it('an awarded+taker-selected penalty seeds PENALTY_KICK_SETUP_ATTACKING with the taker on PENALTY_SPOT[away] holding the ball, and eligibility excluding the taker + defending GK', async () => {
    const { roomCode } = await setupRoom();
    const { homeGkId, awayGkId, takerId } = seedPenaltyKickSetupAttacking(roomCode);

    const state = getRoom(roomCode)!.gameState!;
    expect(state.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
    expect(state.ball.position).toEqual(PENALTY_SPOT[DEFENDING_TEAM]);
    expect(state.ball.carrierId).toBe(takerId);

    const homeCount = state.pieces.filter((p) => p.teamId === 'home').length;
    const awayCount = state.pieces.filter((p) => p.teamId === 'away').length;
    // Narrowed: -1 for the excluded taker (attacking) and -1 for the excluded
    // defending GK (defending) versus the full-squad counts.
    expect(state.penaltyKickEligibleIds?.attacking).toHaveLength(homeCount - 1);
    expect(state.penaltyKickEligibleIds?.defending).toHaveLength(awayCount - 1);
    // The attacking team's OWN goalkeeper is NOT excluded — only the chosen taker and
    // the DEFENDING team's goalkeeper are immovable during the windows.
    expect(state.penaltyKickEligibleIds?.attacking).toContain(homeGkId);
    expect(state.penaltyKickEligibleIds?.attacking).not.toContain(takerId);
    expect(state.penaltyKickEligibleIds?.defending).not.toContain(awayGkId);
  });

  it('the defending manager emitting GAME_MOVE during the attacking window receives WRONG_TEAM and the snapshot is unchanged', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { moverPieceId, moverNeighbor } = seedPenaltyKickSetupAttacking(roomCode);
    const before = getRoom(roomCode)!.gameState!.pieces.find((p) => p.id === moverPieceId)!;

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, moverPieceId, moverNeighbor);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    const after = getRoom(roomCode)!.gameState!;
    expect(after.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
    expect(after.pieces.find((p) => p.id === moverPieceId)!.position).toEqual(before.position);
  });

  it('the attacking manager moves one piece 8 successive single hexes with no budget rejection (PEN-02 unbudgeted repositioning)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { moverPieceId, moverStart, moverNeighbor } = seedPenaltyKickSetupAttacking(roomCode);

    const targets: HexCoord[] = Array.from({ length: 8 }, (_, i) =>
      i % 2 === 0 ? moverNeighbor : moverStart,
    );
    for (let i = 0; i < targets.length; i++) {
      const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      clientA.emit(ClientEvents.GAME_MOVE, moverPieceId, targets[i]!);
      const [state] = await statePromise;
      expect(state.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
      expect(state.pieces.find((p) => p.id === moverPieceId)!.position).toEqual(targets[i]);
    }
    expect(getRoom(roomCode)!.gameState!.penaltyKickUsedPace?.[moverPieceId]).toBe(8);
  });

  it('moving an ordinary outfielder into a hex inside the defending penalty area is rejected with MOVE_INVALID and does not move the piece', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { boxBoundaryPieceId, boxBoundaryStart, boxNeighbor } =
      seedPenaltyKickSetupAttacking(roomCode);
    expect(isInRegion(boxNeighbor, 'awayPenaltyArea')).toBe(true);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, boxBoundaryPieceId, boxNeighbor);
    const [reason] = await errorPromise;

    expect(reason).toBe('MOVE_INVALID');
    const state = getRoom(roomCode)!.gameState!;
    expect(state.pieces.find((p) => p.id === boxBoundaryPieceId)!.position).toEqual(
      boxBoundaryStart,
    );
  });
});

// ---------------------------------------------------------------------------
// PEN-02/D-08: window handoff (GAME_END_TURN)
// ---------------------------------------------------------------------------

describe('PEN-02/D-08: window handoff (GAME_END_TURN)', () => {
  // 39-22: taker-select now precedes both windows, so the DEFENDING terminal goes
  // straight to PENALTY_KICK (the duel) — there is no further choice phase left.
  it('attacking window End Turn advances to PENALTY_KICK_SETUP_DEFENDING with activeTeam flipped and movedPieceIds reset; defending window End Turn then advances to PENALTY_KICK', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedPenaltyKickSetupAttacking(roomCode);

    const p1 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [afterFirst] = await p1;
    expect(afterFirst.phase).toBe('PENALTY_KICK_SETUP_DEFENDING');
    expect(afterFirst.activeTeam).toBe('away');
    expect(afterFirst.movedPieceIds).toEqual([]);

    // Listen on clientA throughout (mirrors goalKick.integration.test.ts's stale-buffer
    // guidance): broadcastState sends to both clients, so listening on clientB here
    // would risk catching the still-in-flight broadcast from the FIRST end turn.
    const p2 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [afterSecond] = await p2;
    expect(afterSecond.phase).toBe('PENALTY_KICK');
    expect(afterSecond.activeTeam).toBe('home');
  });

  it('the wrong team ending the attacking window receives WRONG_TEAM and the phase stays PENALTY_KICK_SETUP_ATTACKING', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedPenaltyKickSetupAttacking(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
  });
});

// ---------------------------------------------------------------------------
// PEN-02: GAME_PENALTY_KICK_TAKER (taker selection)
// ---------------------------------------------------------------------------

describe('PEN-02: GAME_PENALTY_KICK_TAKER (taker selection)', () => {
  it('the defending manager selecting a taker receives WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { eligibleOutfielderId } = seedPenaltyKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_PENALTY_KICK_TAKER, eligibleOutfielderId);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.penaltyKickTakerId).toBeNull();
  });

  it('the kicking manager selecting their own goalkeeper as taker is rejected and mutates nothing', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGkId } = seedPenaltyKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_PENALTY_KICK_TAKER, homeGkId);
    const [reason] = await errorPromise;

    expect(reason).toBeTruthy();
    const state = getRoom(roomCode)!.gameState!;
    expect(state.phase).toBe('PENALTY_KICK_TAKER_SELECT');
    expect(state.penaltyKickTakerId).toBeNull();
  });

  // 39-22: success now transitions to PENALTY_KICK_SETUP_ATTACKING (the reposition
  // windows come AFTER taker-select), not PENALTY_KICK.
  it('the kicking manager selecting a valid outfielder places them on penaltyKickSpot, sets penaltyKickTakerId, and transitions to PENALTY_KICK_SETUP_ATTACKING', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleOutfielderId } = seedPenaltyKickTakerSelect(roomCode);
    const spot = PENALTY_SPOT[DEFENDING_TEAM];

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_PENALTY_KICK_TAKER, eligibleOutfielderId);
    const [state] = await statePromise;

    expect(state.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
    expect(state.penaltyKickTakerId).toBe(eligibleOutfielderId);
    expect(state.pieces.find((p) => p.id === eligibleOutfielderId)!.position).toEqual(spot);
    expect(state.ball.carrierId).toBe(eligibleOutfielderId);
    // The chosen taker is excluded from both eligible lists (T-39-22-02).
    expect(state.penaltyKickEligibleIds?.attacking).not.toContain(eligibleOutfielderId);
  });

  it('a non-string payload (42) is rejected with INVALID_TARGET and mutates nothing', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedPenaltyKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // Intentionally malformed payload (attacker-controlled) — pieceId must be a string.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_PENALTY_KICK_TAKER, 42);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    const state = getRoom(roomCode)!.gameState!;
    expect(state.phase).toBe('PENALTY_KICK_TAKER_SELECT');
    expect(state.penaltyKickTakerId).toBeNull();
  });

  it('a double-emitted GAME_PENALTY_KICK_TAKER results in exactly one PENALTY_KICK_TAKER_PLACED event (isProcessing mutex)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleOutfielderId } = seedPenaltyKickTakerSelect(roomCode);

    const statesPromise = waitForNStates(clientA, 2);
    clientA.emit(ClientEvents.GAME_PENALTY_KICK_TAKER, eligibleOutfielderId);
    clientA.emit(ClientEvents.GAME_PENALTY_KICK_TAKER, eligibleOutfielderId);
    const states = await statesPromise;

    // 39-22: the first emit transitions to PENALTY_KICK_SETUP_ATTACKING; the second
    // (redundant) emit now hits the WRONG_PHASE guard and snaps back — still exactly
    // one PENALTY_KICK_TAKER_PLACED event either way.
    expect(states[states.length - 1]!.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
    const finalState = getRoom(roomCode)!.gameState!;
    const placedEvents = finalState.eventLog.filter((e) => e.type === 'PENALTY_KICK_TAKER_PLACED');
    expect(placedEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// PEN-01/03: GAME_ROLL duel resolution
// ---------------------------------------------------------------------------

describe('PEN-01/03: GAME_ROLL duel resolution', () => {
  it('GAME_ROLL in PENALTY_KICK appends one PENALTY_KICK event whose gkCombined equals gk.saving + gkDie - 2 (PEN-01)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { gkSaving, takerShooting } = seedPenaltyKickDuel(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL);
    const [state] = await statePromise;

    const penEvents = state.eventLog.filter((e) => e.type === 'PENALTY_KICK');
    expect(penEvents).toHaveLength(1);
    const penEvent = penEvents[0]!;
    if (penEvent.type !== 'PENALTY_KICK') throw new Error('unreachable');
    // Arithmetic relationship against the event's OWN reported dice — never a fixed value.
    expect(penEvent.gkCombined).toBe(gkSaving + penEvent.gkDie - 2);
    expect(penEvent.takerCombined).toBe(takerShooting + penEvent.takerDie);
    expect(['GOAL', 'SAVED', 'TIE']).toContain(penEvent.result);
  });

  it('the defending manager cannot roll the penalty duel (WRONG_TEAM)', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedPenaltyKickDuel(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_ROLL);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('PENALTY_KICK');
  });

  it('PEN-03: applyPenaltyKickDuel with tied dice routes to LOOSE_BALL with the ball at the penalty spot; the socket-level GAME_ROLL run is a real-RNG smoke check over the 3 legal outcomes', async () => {
    const { clientA, roomCode } = await setupRoom();
    // taker.shooting=5 + takerDie=3 = 8; gk.saving=7 + gkDie=3 - 2 = 8 -> exact tie.
    const { spot } = seedPenaltyKickDuel(roomCode, { takerShooting: 5, gkSaving: 7 });

    const seededState = getRoom(roomCode)!.gameState!;
    const tieResult = applyPenaltyKickDuel(seededState, 3, 3);
    expect(tieResult.ok).toBe(true);
    if (tieResult.ok) {
      expect(tieResult.state.phase).toBe('LOOSE_BALL');
      expect(tieResult.state.ball.position).toEqual(spot);
      expect(tieResult.state.ball.carrierId).toBeNull();
    }

    // The direct engine call above never touched room.gameState — the socket-level run
    // below still resolves against the original seeded PENALTY_KICK phase with real dice.
    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL);
    const [finalState] = await statePromise;
    expect(['KICK_OFF_SETUP', 'GK_RESTART', 'LOOSE_BALL']).toContain(finalState.phase);
  });
});

// ---------------------------------------------------------------------------
// Task 3 (39-22, gap closure — UAT gap 5): the whole in-box-foul-to-penalty
// journey, proven end to end over the real socket surface.
//
// Seeds via a real, unmocked `applyMove` TACKLE_ATTEMPT (mirrors
// foulFreeKick.integration.test.ts's `seedFoulChoiceViaTackle` pattern) with the
// carrier standing INSIDE the defending (away) penalty area and an adjacent
// defender, injected tackleDie: 1 so the foul fires deterministically. Every
// subsequent step drives real ClientEvents over the wire and asserts on the
// broadcast GAME_STATE — never a direct engine call — so this is a genuine
// proof that no socket handler needed a change for the 39-22 reorder (the
// phase guards are per-function and were already correct).
// ---------------------------------------------------------------------------

/** A hex well inside awayPenaltyArea (q>=31, r 5..19), away from the six-yard-box edge. */
const IN_BOX_CENTER: HexCoord = { q: 33, r: 13 };
const IN_BOX_MID_HEX: HexCoord = hexNeighbors(IN_BOX_CENTER).find(
  (h) => isPitchHex(h) && isInRegion(h, 'awayPenaltyArea'),
)!;
const IN_BOX_DEFENDER_HEX: HexCoord = hexNeighbors(IN_BOX_MID_HEX).find(
  (h) => isPitchHex(h) && !(h.q === IN_BOX_CENTER.q && h.r === IN_BOX_CENTER.r),
)!;
/** A hex well outside every penalty area, in the open middle of the pitch. */
const OUT_OF_BOX_CENTER: HexCoord = { q: 18, r: 13 };
const OUT_OF_BOX_MID_HEX: HexCoord = hexNeighbors(OUT_OF_BOX_CENTER).find((h) => isPitchHex(h))!;
const OUT_OF_BOX_DEFENDER_HEX: HexCoord = hexNeighbors(OUT_OF_BOX_MID_HEX).find(
  (h) => isPitchHex(h) && !(h.q === OUT_OF_BOX_CENTER.q && h.r === OUT_OF_BOX_CENTER.r),
)!;

/**
 * Parks every piece not in `keepIds` to a middleThird hex (q=12/13, clear of BOTH
 * penalty areas: homePenaltyArea is q<=5, awayPenaltyArea is q>=31) — unlike
 * foulFreeKick.integration.test.ts's sibling helper (which parks into q=2/34,
 * harmless there since that suite never asserts on box occupancy), this suite's
 * in-box assertions require every non-participant piece to be OUTSIDE both boxes.
 */
function parkBackgroundPiecesFoul(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 12 : 13, r: idx % 25 } },
  );
}

/**
 * Seeds FOUL_CHOICE via a real TACKLE_ATTEMPT with the carrier standing at `carrierHex`
 * (stationary) and the defender approaching from `defenderHex` through `approachHex`
 * (adjacent to `carrierHex`), injected `tackleDie: 1`. Mirrors
 * foulFreeKick.integration.test.ts's `seedFoulChoiceViaTackle` — 39-18 (UAT gap 2):
 * `foulHex` is the stationary CARRIER's hex, not the fouling defender's landing hex.
 */
function seedFoulChoiceViaTackleAt(
  roomCode: string,
  carrierHex: HexCoord,
  approachHex: HexCoord,
  defenderHex: HexCoord,
): { carrier: PlayerPiece; defender: PlayerPiece; homeGk: PlayerPiece; awayGk: PlayerPiece } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const awayGk = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK')!;
  const carrier = homeOutfield[0]!;
  const defender = awayOutfield[0]!;

  // Explicitly relocate both goalkeepers away from the carrier/defender/approach
  // triangle — their default lineup positions can otherwise collide with the
  // in-box test hexes (r=12..14) and trip OCCUPIED in validateMove.
  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === carrier.id) return { ...p, position: carrierHex };
    if (p.id === defender.id) return { ...p, position: defenderHex };
    if (p.id === homeGk.id) return { ...p, position: HOME_GK_HEX };
    if (p.id === awayGk.id) return { ...p, position: AWAY_GK_HEX };
    return p;
  });
  pieces = parkBackgroundPiecesFoul(
    pieces,
    new Set([carrier.id, defender.id, homeGk.id, awayGk.id]),
  );

  room.gameState = {
    ...room.gameState,
    pieces,
    phase: 'MOVE',
    attackingTeam: 'home',
    activeTeam: 'away',
    movementSlot: 'DEFENDER_5',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    stealAttemptedByIds: [],
    tackleAttemptedByIds: [],
    ball: { position: carrierHex, carrierId: carrier.id, lastTouchedBy: null },
    ballZone: isInRegion(carrierHex, 'awayPenaltyArea') ? 'away' : 'middle',
    foulsEnabled: true,
    injuryEnabled: true,
    bookingEnabled: true,
  };

  const result = applyMove(room.gameState, defender.id, approachHex, {
    stealDie: 3,
    tackleDie: 1,
    carrierDie: 3,
    injuryDie: 3,
    bookingDie: 3,
  });
  if (!result.ok) {
    const detail = 'detail' in result ? result.detail : undefined;
    throw new Error(`Seed applyMove (tackle) failed: ${result.reason} ${detail ?? ''}`);
  }
  room.gameState = result.state;

  return { carrier, defender, homeGk, awayGk };
}

describe('39-22 (gap closure, UAT gap 5): in-box-foul-to-penalty journey over sockets', () => {
  it('a tackle foul committed OUTSIDE any penalty area still broadcasts FREE_KICK_SETUP', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedFoulChoiceViaTackleAt(
      roomCode,
      OUT_OF_BOX_CENTER,
      OUT_OF_BOX_MID_HEX,
      OUT_OF_BOX_DEFENDER_HEX,
    );
    expect(getRoom(roomCode)!.gameState!.phase).toBe('FOUL_CHOICE');

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FOUL_CHOICE, 'restart');
    const [state] = await statePromise;

    expect(state.phase).toBe('FREE_KICK_SETUP');
  });

  it('a tackle foul committed INSIDE the fouling team penalty area broadcasts the full penalty award: PENALTY_KICK_TAKER_SELECT, defending GK on the goal-line centre, exactly one piece in the box, no shared hexes', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { awayGk } = seedFoulChoiceViaTackleAt(
      roomCode,
      IN_BOX_CENTER,
      IN_BOX_MID_HEX,
      IN_BOX_DEFENDER_HEX,
    );
    const seeded = getRoom(roomCode)!.gameState!;
    expect(seeded.phase).toBe('FOUL_CHOICE');
    expect(seeded.foulSource).toBe('TACKLE');
    expect(isInRegion(seeded.foulHex!, 'awayPenaltyArea')).toBe(true);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FOUL_CHOICE, 'restart');
    const [state] = await statePromise;

    expect(state.phase).toBe('PENALTY_KICK_TAKER_SELECT');
    const madeEvent = state.eventLog.find((e) => e.type === 'FOUL_CHOICE_MADE');
    if (madeEvent?.type === 'FOUL_CHOICE_MADE') {
      expect(madeEvent.restart).toBe('PENALTY');
    }

    const gk = state.pieces.find((p) => p.id === awayGk.id)!;
    expect(gk.position).toEqual(PENALTY_GOAL_LINE_CENTRE.away);
    const insideBox = state.pieces.filter((p) => isInRegion(p.position, 'awayPenaltyArea'));
    expect(insideBox).toHaveLength(1);
    expect(insideBox[0]!.id).toBe(awayGk.id);
    const keys = state.pieces.map((p) => `${p.position.q},${p.position.r}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('drives the full journey: award -> taker select -> one legal reposition -> one rejected reposition (box) -> one rejected reposition (taker) -> both window ends -> duel', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedFoulChoiceViaTackleAt(roomCode, IN_BOX_CENTER, IN_BOX_MID_HEX, IN_BOX_DEFENDER_HEX);

    // Award: 'restart' from the fouled (home) manager.
    const awardPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_FOUL_CHOICE, 'restart');
    const [awarded] = await awardPromise;
    expect(awarded.phase).toBe('PENALTY_KICK_TAKER_SELECT');
    expect(awarded.penaltyKickTeam).toBe('home');

    // Kicker selection: the kicking (home) manager picks an eligible outfielder.
    const taker = awarded.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
    const takerPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_PENALTY_KICK_TAKER, taker.id);
    const [afterTaker] = await takerPromise;
    expect(afterTaker.phase).toBe('PENALTY_KICK_SETUP_ATTACKING');
    expect(afterTaker.penaltyKickTakerId).toBe(taker.id);
    expect(afterTaker.ball.carrierId).toBe(taker.id);

    // One legal reposition: an eligible home piece (not the taker) moves one hex.
    const mover = afterTaker.pieces.find(
      (p) => p.teamId === 'home' && p.id !== taker.id && p.role !== 'GK',
    )!;
    const legalTo = hexNeighbors(mover.position).find(
      (h) =>
        isPitchHex(h) &&
        !isInRegion(h, 'awayPenaltyArea') &&
        !afterTaker.pieces.some((p) => p.position.q === h.q && p.position.r === h.r),
    )!;
    const legalMovePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, mover.id, legalTo);
    const [afterLegalMove] = await legalMovePromise;
    expect(afterLegalMove.pieces.find((p) => p.id === mover.id)!.position).toEqual(legalTo);

    // One rejected reposition: the same mover targeting a hex inside the box.
    const boxTarget = hexNeighbors(legalTo).find(
      (h) => isPitchHex(h) && isInRegion(h, 'awayPenaltyArea'),
    );
    if (boxTarget) {
      const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
      clientA.emit(ClientEvents.GAME_MOVE, mover.id, boxTarget);
      const [reason] = await errorPromise;
      expect(reason).toBe('MOVE_INVALID');
    }

    // One rejected reposition: naming the taker itself is immovable. `taker`'s captured
    // `.position` is stale (pre-selection) — the taker now stands on penaltyKickSpot.
    const takerCurrentPosition = afterTaker.pieces.find((p) => p.id === taker.id)!.position;
    const takerAdjacent = hexNeighbors(takerCurrentPosition).find((h) => isPitchHex(h))!;
    const takerErrorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, taker.id, takerAdjacent);
    const [takerReason] = await takerErrorPromise;
    expect(takerReason).toBe('MOVE_INVALID');
    expect(getRoom(roomCode)!.gameState!.pieces.find((p) => p.id === taker.id)!.position).toEqual(
      takerCurrentPosition,
    );

    // Both window ends.
    const window1Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [afterWindow1] = await window1Promise;
    expect(afterWindow1.phase).toBe('PENALTY_KICK_SETUP_DEFENDING');

    const window2Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [afterWindow2] = await window2Promise;
    expect(afterWindow2.phase).toBe('PENALTY_KICK');

    // Duel resolves to one of GOAL / SAVED / LOOSE_BALL (via the game's phase surface).
    const duelPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL);
    const [finalState] = await duelPromise;
    expect(['KICK_OFF_SETUP', 'GK_RESTART', 'LOOSE_BALL']).toContain(finalState.phase);
  });
});
