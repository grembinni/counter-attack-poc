/**
 * Phase 42 Plan 02 (BUG-38) regression tests.
 *
 * Closes the confirmed live defect: `gameHandlers.ts`'s SNAPSHOT_DEFLECT and SHOT-phase
 * deflection defender-set builders filtered only on `p.teamId === X && p.role !== 'GK'`,
 * with no red-card exclusion — a sent-off defender whose frozen `position` happens to sit
 * on a later shot's `hexLine` could be rolled a real deflection die and block a goal while
 * invisible on both clients' boards. Also covers the secondary `validateResponseMoveStep`
 * defense-in-depth gap and every pitch-occupancy predicate touched by this plan.
 *
 * Test harness mirrors gameHandlers.substitution.test.ts / gameHandlers.phase10.test.ts:
 * real Socket.io server on port 0; room state seeded directly via getRoom for
 * phase/state manipulation after a full team-selection handshake.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
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
// Helpers
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
 * Creates a room with 2 connected clients and completes team selection through
 * LINEUP_CONFIRM. clientA = slot 1 = 'home' = 'city'; clientB = slot 2 = 'away' = 'crew'
 * (project-wide convention).
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
// Fixture data — real 4-4-2 slot ids. slots[0] is always GK (home-0/away-0);
// home-8 is a proven-safe attacking-team outfielder used elsewhere in this suite
// (gameHandlers.phase10.test.ts, gameHandlers.phase18-02.test.ts) as a shot carrier.
// ---------------------------------------------------------------------------

const HOME_CARRIER_ID = 'home-8';
const AWAY_GK_ID = 'away-0';
const AWAY_ON_PATH_DEFENDER_ID = 'away-3';

/** Straight same-r shot line, proven working in gameHandlers.phase10.test.ts. */
const CARRIER_POS = { q: 33, r: 13 };
const GOAL_HEX = { q: 36, r: 13 };
const ON_PATH_POS = { q: 34, r: 13 };

type DeflectionFlags = { redCarded?: boolean; onPitch?: boolean };

/**
 * Seeds PASS phase for a GAME_SHOT declaration: home carrier deep in the away box,
 * away GK on the goal line (guarantees GK-range reachability so the test isolates the
 * deflection defender-set builder, not the auto-GOAL-on-out-of-range branch), and a single
 * away outfielder placed directly ON the shot's hexLine with `tackling: 10` (guarantees a
 * deflection roll per the band-A formula: die===5||6||die+tackling>=10 — true for any die).
 * All other away outfielders are pushed far from the shot path so they cannot
 * independently register as an on-path/near-path defender.
 */
function seedShotPassPhase(roomCode: string, flags: DeflectionFlags = {}): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  room.gameState = {
    ...room.gameState,
    phase: 'PASS',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: null,
    ball: { position: CARRIER_POS, carrierId: HOME_CARRIER_ID, lastTouchedBy: null },
    pieces: room.gameState.pieces.map((p) => {
      if (p.id === HOME_CARRIER_ID) return { ...p, position: CARRIER_POS };
      if (p.id === AWAY_GK_ID) return { ...p, position: GOAL_HEX };
      if (p.id === AWAY_ON_PATH_DEFENDER_ID) {
        return {
          ...p,
          position: ON_PATH_POS,
          tackling: 10,
          ...(flags.redCarded !== undefined ? { redCarded: flags.redCarded } : {}),
          ...(flags.onPitch !== undefined ? { onPitch: flags.onPitch } : {}),
        };
      }
      if (p.teamId === 'away' && p.role !== 'GK') {
        return { ...p, position: { q: 5, r: 0 } };
      }
      return p;
    }),
  };
}

/**
 * Seeds SNAPSHOT_DEFLECT directly (mirrors gameHandlers.phase10.test.ts's multi-hex-click
 * fixture): home carrier holds the ball at CARRIER_POS, away (defending team) is active,
 * and the same guaranteed-deflect on-path defender fixture as seedShotPassPhase.
 */
function seedSnapshotDeflectPhase(roomCode: string, flags: DeflectionFlags = {}): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  room.gameState = {
    ...room.gameState,
    phase: 'SNAPSHOT_DEFLECT',
    attackingTeam: 'home',
    activeTeam: 'away',
    shotTargetHex: GOAL_HEX,
    snapDeflectMovedPieceId: null,
    snapDeflectPaceUsed: 0,
    ball: { position: CARRIER_POS, carrierId: HOME_CARRIER_ID, lastTouchedBy: null },
    pieces: room.gameState.pieces.map((p) => {
      if (p.id === HOME_CARRIER_ID) return { ...p, position: CARRIER_POS };
      if (p.id === AWAY_ON_PATH_DEFENDER_ID) {
        return {
          ...p,
          position: ON_PATH_POS,
          tackling: 10,
          ...(flags.redCarded !== undefined ? { redCarded: flags.redCarded } : {}),
          ...(flags.onPitch !== undefined ? { onPitch: flags.onPitch } : {}),
        };
      }
      if (p.teamId === 'away' && p.role !== 'GK') {
        return { ...p, position: { q: 5, r: 0 } };
      }
      return p;
    }),
  };
}

function deflectEventsFor(state: GameState, defenderId: string): unknown[] {
  return (state.eventLog as unknown as { type: string; defenderId?: string }[]).filter(
    (e) => e.type === 'DEFLECT_ATTEMPT' && e.defenderId === defenderId,
  );
}

// ---------------------------------------------------------------------------
// 1 & 2. SHOT-phase deflection defender-set builder (gameHandlers.ts ~line 2288)
// ---------------------------------------------------------------------------

describe('BUG-38 — red-carded pieces excluded from gameHandlers eligibility', () => {
  it('SHOT-phase: a red-carded (+ onPitch:false) defender directly on the shot path is excluded from the deflection defender-set — no DEFLECT_ATTEMPT for that piece', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedShotPassPhase(roomCode, { redCarded: true, onPitch: false });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, GOAL_HEX);
    const [state] = await statePromise;

    expect(deflectEventsFor(state, AWAY_ON_PATH_DEFENDER_ID)).toHaveLength(0);
  });

  it('SHOT-phase positive control: the identical scenario with a NOT red-carded defender IS included in the deflection defender-set', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedShotPassPhase(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, GOAL_HEX);
    const [state] = await statePromise;

    expect(deflectEventsFor(state, AWAY_ON_PATH_DEFENDER_ID).length).toBeGreaterThan(0);
  });

  it('SHOT-phase: onPitch:false alone (not redCarded) is sufficient to exclude the defender — proves the two-clause predicate', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedShotPassPhase(roomCode, { onPitch: false });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, GOAL_HEX);
    const [state] = await statePromise;

    expect(deflectEventsFor(state, AWAY_ON_PATH_DEFENDER_ID)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 3. SNAPSHOT_DEFLECT deflection defender-set builder (gameHandlers.ts ~line 1286)
  // -------------------------------------------------------------------------

  it('SNAPSHOT_DEFLECT: a red-carded (+ onPitch:false) defender directly on the shot path is excluded from the deflection defender-set — no DEFLECT_ATTEMPT for that piece', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedSnapshotDeflectPhase(roomCode, { redCarded: true, onPitch: false });

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(deflectEventsFor(state, AWAY_ON_PATH_DEFENDER_ID)).toHaveLength(0);
  });

  it('SNAPSHOT_DEFLECT positive control: the identical scenario with a NOT red-carded defender IS included in the deflection defender-set', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedSnapshotDeflectPhase(roomCode);

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(deflectEventsFor(state, AWAY_ON_PATH_DEFENDER_ID).length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 4. validateResponseMoveStep rejection — SNAPSHOT_DEFLECT and HIGH_PASS_MOVE
  // -------------------------------------------------------------------------

  it('SNAPSHOT_DEFLECT: GAME_MOVE for a red-carded own-team piece is rejected with RED_CARDED and leaves gameState unchanged', async () => {
    const { clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const redCardedId = 'away-4';
    const origPos = room.gameState.pieces.find((p) => p.id === redCardedId)!.position;
    room.gameState = {
      ...room.gameState,
      phase: 'SNAPSHOT_DEFLECT',
      attackingTeam: 'home',
      activeTeam: 'away',
      shotTargetHex: GOAL_HEX,
      snapDeflectMovedPieceId: null,
      snapDeflectPaceUsed: 0,
      pieces: room.gameState.pieces.map((p) =>
        p.id === redCardedId ? { ...p, redCarded: true, onPitch: false } : p,
      ),
    };

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, redCardedId, { q: origPos.q + 1, r: origPos.r });
    const [reason] = await errorPromise;

    expect(reason).toBe('RED_CARDED');
    const after = getRoom(roomCode);
    expect(after?.gameState?.pieces.find((p) => p.id === redCardedId)?.position).toEqual(origPos);
    expect(after?.gameState?.snapDeflectMovedPieceId ?? null).toBeNull();
  });

  it('HIGH_PASS_MOVE: GAME_MOVE for a red-carded own-team (non-carrier) piece is rejected with RED_CARDED and leaves gameState unchanged', async () => {
    const { clientA, roomCode, state } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const carrierId = 'home-9';
    const redCardedId = 'home-7';
    const mover = state.pieces.find((p) => p.id === redCardedId)!;
    const destHex = { q: mover.position.q + 1, r: mover.position.r };

    room.gameState = {
      ...room.gameState,
      phase: 'HIGH_PASS_MOVE',
      attackingTeam: 'home',
      activeTeam: 'home',
      highPassMovementSlot: 'ATTACKER',
      highPassMovedPieceId: null,
      highPassPaceUsed: 0,
      highPassCarrierId: carrierId,
      pieces: room.gameState.pieces.map((p) =>
        p.id === redCardedId ? { ...p, redCarded: true, onPitch: false } : p,
      ),
    };

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, redCardedId, destHex);
    const [reason] = await errorPromise;

    expect(reason).toBe('RED_CARDED');
    const after = getRoom(roomCode);
    expect(after?.gameState?.pieces.find((p) => p.id === redCardedId)?.position).toEqual(
      mover.position,
    );
    expect(after?.gameState?.highPassMovedPieceId ?? null).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 5. Ownership precedence — an opponent-owned red-carded piece id still yields WRONG_TEAM
  // -------------------------------------------------------------------------

  it('SNAPSHOT_DEFLECT: an opponent-owned red-carded piece id still yields WRONG_TEAM (guard order preserved), not RED_CARDED', async () => {
    const { clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    // Opponent (attacking team, 'home') piece, red-carded — clientB controls the
    // defending team ('away'), so ownership must reject this BEFORE the red-card check.
    const opponentId = 'home-7';
    room.gameState = {
      ...room.gameState,
      phase: 'SNAPSHOT_DEFLECT',
      attackingTeam: 'home',
      activeTeam: 'away',
      shotTargetHex: GOAL_HEX,
      snapDeflectMovedPieceId: null,
      snapDeflectPaceUsed: 0,
      pieces: room.gameState.pieces.map((p) =>
        p.id === opponentId ? { ...p, redCarded: true, onPitch: false } : p,
      ),
    };

    const opponentPiece = room.gameState.pieces.find((p) => p.id === opponentId)!;
    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, opponentId, {
      q: opponentPiece.position.q + 1,
      r: opponentPiece.position.r,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
  });

  // -------------------------------------------------------------------------
  // 6. Occupancy — a destination hex occupied only by a red-carded piece is accepted;
  //    the same hex occupied by a live piece is still rejected with OCCUPIED
  // -------------------------------------------------------------------------

  it('SNAPSHOT_DEFLECT occupancy: a destination hex occupied only by a red-carded piece is accepted (no OCCUPIED)', async () => {
    const { clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const moverId = 'away-2';
    const redCardedOccupantId = 'away-4';
    const mover = room.gameState.pieces.find((p) => p.id === moverId)!;
    const destHex = { q: mover.position.q + 1, r: mover.position.r };

    room.gameState = {
      ...room.gameState,
      phase: 'SNAPSHOT_DEFLECT',
      attackingTeam: 'home',
      activeTeam: 'away',
      shotTargetHex: GOAL_HEX,
      snapDeflectMovedPieceId: null,
      snapDeflectPaceUsed: 0,
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === redCardedOccupantId) {
          return { ...p, position: destHex, redCarded: true, onPitch: false };
        }
        return p;
      }),
    };

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_MOVE, moverId, destHex);
    const [state] = await statePromise;

    expect(state.pieces.find((p) => p.id === moverId)?.position).toEqual(destHex);
    expect(state.snapDeflectMovedPieceId).toBe(moverId);
  });

  it('SNAPSHOT_DEFLECT occupancy: the same destination hex occupied by a live piece is still rejected with OCCUPIED', async () => {
    const { clientB, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');

    const moverId = 'away-2';
    const liveOccupantId = 'away-4';
    const mover = room.gameState.pieces.find((p) => p.id === moverId)!;
    const destHex = { q: mover.position.q + 1, r: mover.position.r };

    room.gameState = {
      ...room.gameState,
      phase: 'SNAPSHOT_DEFLECT',
      attackingTeam: 'home',
      activeTeam: 'away',
      shotTargetHex: GOAL_HEX,
      snapDeflectMovedPieceId: null,
      snapDeflectPaceUsed: 0,
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === liveOccupantId) {
          return { ...p, position: destHex };
        }
        return p;
      }),
    };

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, moverId, destHex);
    const [reason] = await errorPromise;

    expect(reason).toBe('OCCUPIED');
    const after = getRoom(roomCode);
    expect(after?.gameState?.snapDeflectMovedPieceId ?? null).toBeNull();
  });
});
