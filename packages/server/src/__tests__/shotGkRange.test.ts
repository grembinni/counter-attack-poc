/**
 * Deterministic GK-range / save-possession regression tests for the
 * snapshot-shot-flow-mismatch debug session (ROUND 2).
 *
 * Round 1 fixed three symptoms but only conditionally verified the SAVE->carrierId
 * path for snapshot/header (the existing tests guard SAVE assertions behind
 * `if (finalState.phase === 'GK_RESTART')`, never forcing dice to actually land on
 * SAVE). This file forces deterministic dice via vi.mock('../diceUtils.js') so the
 * GK-range auto-GOAL gate and the SAVE->carrierId transfer can be asserted
 * unconditionally, for all three GK_DIVE entry points: regular shot (GAME_SHOT),
 * snapshot (SNAPSHOT_TARGET -> SNAPSHOT_DEFLECT), and header (GAME_HEADER_TARGET).
 *
 * Dice are forced to 3 for every roll. With gk.saving=10, gk.handling=10,
 * shooter.shooting=1, and the GK on/very near the shot path (no saving penalty,
 * dive distance <=2), the duel score is gk(10+3=13) vs shooter(1+3=4) -> SAVE,
 * and the handling check (diceValue=3 < gk.handling=10) -> clean catch.
 *
 * Test-harness note (found while writing these tests, NOT a server bug): every
 * two-client sequential action in this file waits for BOTH clientA's and clientB's
 * copy of an intermediate broadcast (e.g. declarePromiseA + declarePromiseB) before
 * emitting the next action from clientB. Skipping this and waiting on clientA's
 * broadcast alone lets the next emit's `.once()` listener register on clientB before
 * clientB's own still-in-flight copy of the PREVIOUS broadcast arrives — that
 * listener then resolves with the stale prior-phase state instead of the new one,
 * producing a false failure that looks exactly like a stuck-phase bug. Confirmed by
 * reproducing it (received GK_DIVE instead of GK_RESTART) and fixing it by awaiting
 * both clients' broadcasts before proceeding.
 */

// vi.mock is hoisted by vitest — must appear before other imports.
import { vi } from 'vitest';
vi.mock('../diceUtils.js', () => ({ rollDice: () => 3 }));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents, computeBallZone } from '@counter-attack/shared';

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
    httpServer.listen(0, () => resolve());
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
    httpServer.close(() => resolve());
  });
  clearAllRooms();
});

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
      reject(new Error(`Timed out waiting for "${String(event)}"`));
    }, timeoutMs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).once(event, (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args as Parameters<ServerToClientEvents[E]>);
    });
  });
}

function waitForConnect(client: Socket<ServerToClientEvents, ClientToServerEvents>): Promise<void> {
  if (client.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('connect_error', (err) => reject(err));
  });
}

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

  // Phase 27 D-01/T-27-05: TEAM_SELECTION_START is gated on settings-confirmed AND
  // slot-2-joined — confirm settings before the joiner arrives so this helper's
  // join-then-team-selection-start flow still holds under the new both-conditions gate.
  const settingsConfirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED);
  clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
    speed: 'standard',
    teamType: 'standard',
    draftPools: [],
  });
  await settingsConfirmedPromise;

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
// Regular shot (GAME_SHOT, non-snapshot, non-header) — GK-range auto-GOAL gate
// ---------------------------------------------------------------------------

describe('Regular shot (GAME_SHOT): GK-range auto-GOAL gate', () => {
  it('GK far from every shot-path hex (>3) auto-resolves to GOAL, never enters GK_DIVE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const homeCarrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    if (!homeCarrier || !awayGK) throw new Error('Required pieces not found');

    const carrierPos = { q: 30, r: 13 }; // inside away penalty area, near goal-line target
    const gkPos = { q: 5, r: 0 }; // far away — >3 hexes from any hex on the q=36 path

    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: null,
      ball: { position: carrierPos, carrierId: homeCarrier.id },
      // MOVE-06 (Phase 17, corrected design): mark the ball's zone as already current so
      // broadcastState's applyFreeMoveZoneCheck does not fire mid-test.
      ballZone: computeBallZone(carrierPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeCarrier.id) return { ...p, position: carrierPos };
        if (p.id === awayGK.id) return { ...p, position: gkPos };
        return p;
      }),
    };

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [state] = await statePromise;

    expect(state.phase).not.toBe('GK_DIVE');
    expect(state.phase).toBe('KICK_OFF_SETUP');
    expect(state.score.home).toBe(1);
  });

  it('GK within range (on the goal hex) enters GK_DIVE and a forced SAVE transfers the ball to the GK', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const homeCarrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    if (!homeCarrier || !awayGK) throw new Error('Required pieces not found');

    const carrierPos = { q: 30, r: 13 };
    const gkPos = { q: 36, r: 13 }; // sits directly on the declared goal hex — distance 0

    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: null,
      ball: { position: carrierPos, carrierId: homeCarrier.id },
      // MOVE-06 (Phase 17, corrected design): mark the ball's zone as already current so
      // broadcastState's applyFreeMoveZoneCheck does not fire mid-test.
      ballZone: computeBallZone(carrierPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeCarrier.id) return { ...p, position: carrierPos, shooting: 1 };
        if (p.id === awayGK.id) return { ...p, position: gkPos, saving: 10, handling: 10 };
        return p;
      }),
    };

    // Both clients receive the GK_DIVE broadcast — wait for clientB's copy too,
    // so the dive-response .once() listener registered below cannot race against
    // the still-in-flight declare-shot broadcast.
    const declarePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declarePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [[declaredState]] = await Promise.all([declarePromiseA, declarePromiseB]);
    expect(declaredState.phase).toBe('GK_DIVE');

    // GK dives to stay on the same hex (distance 0 — no saving penalty).
    const divePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_GK_DIVE, { q: 36, r: 13 });
    const [finalState] = await divePromise;

    // Deterministic dice (3) + gk.saving=10 vs shooter.shooting=1 -> SAVE.
    // gk.handling=10 > diceValue(3) -> clean catch -> GK_RESTART with carrierId=gk.id.
    expect(finalState.phase).toBe('GK_RESTART');
    expect(finalState.ball.carrierId).toBe(awayGK.id);
    expect(finalState.ball.position).toEqual(gkPos);
  });
});

// ---------------------------------------------------------------------------
// Snapshot shot (SNAPSHOT_TARGET -> SNAPSHOT_DEFLECT -> GK_DIVE) — deterministic SAVE
// ---------------------------------------------------------------------------

describe('Snapshot shot: GK-range gate and deterministic SAVE', () => {
  it('GK far from every shot-path hex auto-resolves to GOAL at end-of-turn, never enters GK_DIVE', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const carrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    const otherAway = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!carrier || !awayGK) throw new Error('Required pieces not found');

    const carrierPos = { q: 33, r: 13 };
    const gkPos = { q: 5, r: 0 }; // far from goal-line path

    room.gameState = {
      ...room.gameState,
      phase: 'SNAPSHOT_TARGET',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: 'SNAPSHOT',
      ball: { position: carrierPos, carrierId: carrier.id },
      // MOVE-06 (Phase 17, corrected design): mark the ball's zone as already current so
      // broadcastState's applyFreeMoveZoneCheck does not fire mid-test.
      ballZone: computeBallZone(carrierPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === carrier.id) return { ...p, position: carrierPos };
        if (p.id === awayGK.id) return { ...p, position: gkPos };
        if (otherAway.some((d) => d.id === p.id)) return { ...p, position: { q: 4, r: 0 } };
        return p;
      }),
    };

    const declarePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declarePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [[declaredState]] = await Promise.all([declarePromiseA, declarePromiseB]);
    expect(declaredState.phase).toBe('SNAPSHOT_DEFLECT');

    const endTurnPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [state] = await endTurnPromise;

    expect(state.phase).not.toBe('GK_DIVE');
    expect(state.phase).toBe('KICK_OFF_SETUP');
    expect(state.score.home).toBe(1);
  });

  it('GK in range -> GK_DIVE -> forced SAVE transfers the ball to the GK (end-to-end)', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const carrier = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    const otherAway = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!carrier || !awayGK) throw new Error('Required pieces not found');

    const carrierPos = { q: 33, r: 13 };
    const gkPos = { q: 36, r: 13 }; // on the goal hex — distance 0, in range

    room.gameState = {
      ...room.gameState,
      phase: 'SNAPSHOT_TARGET',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: 'SNAPSHOT',
      ball: { position: carrierPos, carrierId: carrier.id },
      // MOVE-06 (Phase 17, corrected design): mark the ball's zone as already current so
      // broadcastState's applyFreeMoveZoneCheck does not fire mid-test.
      ballZone: computeBallZone(carrierPos),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === carrier.id) return { ...p, position: carrierPos, shooting: 1 };
        if (p.id === awayGK.id) return { ...p, position: gkPos, saving: 10, handling: 10 };
        if (otherAway.some((d) => d.id === p.id)) return { ...p, position: { q: 4, r: 0 } };
        return p;
      }),
    };

    const declarePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const declarePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [[declaredState]] = await Promise.all([declarePromiseA, declarePromiseB]);
    expect(declaredState.phase).toBe('SNAPSHOT_DEFLECT');

    const endTurnPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [afterDeflectState] = await endTurnPromise;
    expect(afterDeflectState.phase).toBe('GK_DIVE');

    const divePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_GK_DIVE, { q: 36, r: 13 });
    const [finalState] = await divePromise;

    expect(finalState.phase).toBe('GK_RESTART');
    expect(finalState.ball.carrierId).toBe(awayGK.id);
    expect(finalState.ball.position).toEqual(gkPos);
  });
});

// ---------------------------------------------------------------------------
// Header shot (GAME_HEADER_TARGET -> GK_DIVE) — deterministic SAVE
// ---------------------------------------------------------------------------

describe('Header shot: GK-range gate and deterministic SAVE', () => {
  it('GK far from every shot-path hex auto-resolves to GOAL, never enters GK_DIVE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    if (!homeAttacker || !awayGK) throw new Error('Required pieces not found');

    room.gameState = {
      ...room.gameState,
      phase: 'HEADER',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: 'HIGH_PASS',
      ball: { position: { q: 33, r: 13 }, carrierId: null },
      // MOVE-06 (Phase 17, corrected design): mark the ball's zone as already current so
      // broadcastState's applyFreeMoveZoneCheck does not fire mid-test.
      ballZone: computeBallZone({ q: 33, r: 13 }),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeAttacker.id) return { ...p, position: { q: 33, r: 13 } };
        if (p.id === awayGK.id) return { ...p, position: { q: 5, r: 0 } };
        return p;
      }),
      headerContestants: { home: [homeAttacker.id], away: [] },
      headerConfirmed: { home: true, away: true },
      headerAccuracyRollPending: null,
      headerDuelWinner: 'home',
    };

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_TARGET, { q: 36, r: 13 });
    const [state] = await statePromise;

    expect(state.phase).not.toBe('GK_DIVE');
    expect(state.phase).toBe('KICK_OFF_SETUP');
    expect(state.score.home).toBe(1);
  });

  it('GK in range -> GK_DIVE -> forced SAVE transfers the ball to the GK', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    if (!homeAttacker || !awayGK) throw new Error('Required pieces not found');

    room.gameState = {
      ...room.gameState,
      phase: 'HEADER',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: 'HIGH_PASS',
      ball: { position: { q: 33, r: 13 }, carrierId: null },
      // MOVE-06 (Phase 17, corrected design): mark the ball's zone as already current so
      // broadcastState's applyFreeMoveZoneCheck does not fire mid-test.
      ballZone: computeBallZone({ q: 33, r: 13 }),
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeAttacker.id) return { ...p, position: { q: 33, r: 13 }, shooting: 1 };
        if (p.id === awayGK.id)
          return { ...p, position: { q: 36, r: 13 }, saving: 10, handling: 10 };
        return p;
      }),
      headerContestants: { home: [homeAttacker.id], away: [] },
      headerConfirmed: { home: true, away: true },
      headerAccuracyRollPending: null,
      headerDuelWinner: 'home',
    };

    const targetPromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
    const targetPromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_TARGET, { q: 36, r: 13 });
    const [[declaredState]] = await Promise.all([targetPromiseA, targetPromiseB]);
    expect(declaredState.phase).toBe('GK_DIVE');

    const divePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_GK_DIVE, { q: 36, r: 13 });
    const [finalState] = await divePromise;

    expect(finalState.phase).toBe('GK_RESTART');
    expect(finalState.ball.carrierId).toBe(awayGK.id);
    expect(finalState.ball.position).toEqual({ q: 36, r: 13 });
  });
});
