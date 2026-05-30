/**
 * Integration tests for the game action wire layer.
 *
 * Mirrors room.integration.test.ts: real Socket.io server on port 0,
 * typed clients, oncePromise/waitForConnect helpers copied verbatim.
 *
 * Player slot assignment: slot 1 = clientA = 'home'; slot 2 = clientB = 'away'.
 * attackingTeam (coin flip) may be either — helpers derive which client is attacking.
 *
 * Requirements covered:
 * - D-12/D-14: setupRoom returns a KICK_OFF state with 22 pieces
 * - MOVE-01: game:move before MOVEMENT returns WRONG_PHASE
 * - T-4-05: game:start-movement restricted to attacking team
 * - FSM: ATTACKER_4→DEFENDER_5→ATTACKER_2→PASS over the wire (D-03/D-04)
 * - T-4-01 / T-4-04: WRONG_TEAM rejection for non-acting player
 * - D-09 / D-10: undo locked after SLOT_ADVANCE; reversal within slot
 * - SC-5: isProcessing duplicate-action drop
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms } from '../roomStore.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (copied verbatim from room.integration.test.ts)
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
// Helpers (copied verbatim from room.integration.test.ts)
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
  timeoutMs = 1000,
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
  timeoutMs = 1000,
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

// ---------------------------------------------------------------------------
// setupRoom helper
// ---------------------------------------------------------------------------

/**
 * Creates a room with 2 connected players and waits for the initial GAME_STATE broadcast.
 * clientA = slot 1 = 'home'; clientB = slot 2 = 'away'.
 * Returns which client controls the attacking team for convenience.
 */
async function setupRoom(): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  roomCode: string;
  state: GameState;
  attackingClient: Socket<ServerToClientEvents, ClientToServerEvents>;
  defendingClient: Socket<ServerToClientEvents, ClientToServerEvents>;
}> {
  const clientA = createClient();
  const clientB = createClient();
  await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

  const createPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
  clientA.emit(ClientEvents.ROOM_CREATE);
  const [roomCode] = await createPromise;

  const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  const [state] = await statePromise;

  // clientA = slot 1 = 'home'; attackingTeam from coin flip
  const attackingClient = state.attackingTeam === 'home' ? clientA : clientB;
  const defendingClient = state.attackingTeam === 'home' ? clientB : clientA;

  return { clientA, clientB, roomCode, state, attackingClient, defendingClient };
}

/** Emits game:start-movement and waits for the MOVEMENT GAME_STATE broadcast. */
async function startMovement(
  attackingClient: Socket<ServerToClientEvents, ClientToServerEvents>,
  listenerSocket: Socket<ServerToClientEvents, ClientToServerEvents>,
): Promise<GameState> {
  const statePromise = oncePromise(listenerSocket, ServerEvents.GAME_STATE);
  attackingClient.emit(ClientEvents.GAME_START_MOVEMENT);
  const [state] = await statePromise;
  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('game integration — lifecycle', () => {
  it('setupRoom returns a KICK_OFF state with 22 pieces (D-12, D-14, TEAM-01)', async () => {
    const { state } = await setupRoom();
    expect(state.phase).toBe('KICK_OFF');
    expect(state.pieces).toHaveLength(22);
    expect(['home', 'away']).toContain(state.attackingTeam);
  });
});

describe('game integration — Movement Phase scenarios', () => {
  it('MOVE-01: game:move before MOVEMENT (KICK_OFF) returns game:error WRONG_PHASE', async () => {
    const { clientA } = await setupRoom();
    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, 'home-9', { q: 11, r: 7 });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_PHASE');
  });

  it('T-4-05: non-attacking client gets WRONG_TEAM; attacking client transitions to MOVEMENT/ATTACKER_4', async () => {
    const { clientA, attackingClient, defendingClient } = await setupRoom();

    // Defending client emits; server sends WRONG_TEAM error AND a snap-back GAME_STATE.
    // Register both listeners BEFORE emitting to avoid missing the snap-back broadcast.
    const wrongTeamPromise = oncePromise(defendingClient, ServerEvents.GAME_ERROR);
    const snapBackPromise = oncePromise(clientA, ServerEvents.GAME_STATE); // drain snap-back
    defendingClient.emit(ClientEvents.GAME_START_MOVEMENT);
    const [[wrongReason], [snapBackState]] = await Promise.all([wrongTeamPromise, snapBackPromise]);
    expect(wrongReason).toBe('WRONG_TEAM');
    expect(snapBackState.phase).toBe('KICK_OFF'); // still KICK_OFF after snap-back

    // Now attacking client emits — statePromise registered after snap-back is drained
    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_START_MOVEMENT);
    const [movementState] = await statePromise;
    expect(movementState.phase).toBe('MOVEMENT');
    expect(movementState.movementSlot).toBe('ATTACKER_4');
  });

  it('FSM: ATTACKER_4→DEFENDER_5→ATTACKER_2→PASS over the wire (D-03/D-04)', async () => {
    const { clientA, clientB, attackingClient } = await setupRoom();

    // Reach MOVEMENT phase
    const movementState = await startMovement(attackingClient, clientA);
    expect(movementState.movementSlot).toBe('ATTACKER_4');

    // Determine acting client for each slot (ATTACKER_4 and ATTACKER_2 = attacker; DEFENDER_5 = defender)
    const attackingIsA = attackingClient === clientA;

    // ATTACKER_4 → DEFENDER_5: attacking client ends turn
    const slot2Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_END_TURN);
    const [slot2State] = await slot2Promise;
    expect(slot2State.movementSlot).toBe('DEFENDER_5');
    expect(slot2State.phase).toBe('MOVEMENT');

    // DEFENDER_5 → ATTACKER_2: defending client ends turn
    const defendingClient = attackingIsA ? clientB : clientA;
    const slot3Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    defendingClient.emit(ClientEvents.GAME_END_TURN);
    const [slot3State] = await slot3Promise;
    expect(slot3State.movementSlot).toBe('ATTACKER_2');
    expect(slot3State.phase).toBe('MOVEMENT');

    // ATTACKER_2 → PASS: attacking client ends turn again (D-04)
    const passPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_END_TURN);
    const [passState] = await passPromise;
    expect(passState.phase).toBe('PASS');
    expect(passState.movementSlot).toBeNull();
  });

  it('T-4-01 WRONG_TEAM: game:move from non-acting client returns WRONG_TEAM after start-movement', async () => {
    const { clientA, attackingClient, defendingClient } = await setupRoom();
    await startMovement(attackingClient, clientA);

    // Non-acting client tries to move — should get WRONG_TEAM
    const errorPromise = oncePromise(defendingClient, ServerEvents.GAME_ERROR);
    defendingClient.emit(ClientEvents.GAME_MOVE, 'home-9', { q: 11, r: 7 });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('D-10 undo reverses last move within the current slot', async () => {
    const { clientA, attackingClient } = await setupRoom();
    const movementState = await startMovement(attackingClient, clientA);

    // Pick the piece matching the attacking team
    const teamPrefix = movementState.attackingTeam === 'home' ? 'home' : 'away';
    const pieceId = `${teamPrefix}-9`;
    const targetHex = movementState.attackingTeam === 'home' ? { q: 11, r: 7 } : { q: 13, r: 7 };
    const origPos = movementState.attackingTeam === 'home' ? { q: 10, r: 7 } : { q: 14, r: 7 };

    // Make a valid move
    const afterMovePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_MOVE, pieceId, targetHex);
    const [afterMove] = await afterMovePromise;
    expect(afterMove.pieces.find((p) => p.id === pieceId)?.position).toEqual(targetHex);

    // Undo it (D-10) — piece returns to original position
    const afterUndoPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_UNDO);
    const [afterUndo] = await afterUndoPromise;
    expect(afterUndo.pieces.find((p) => p.id === pieceId)?.position).toEqual(origPos);
  });

  it('D-09 UNDO_LOCKED: undo after a SLOT_ADVANCE is rejected for the defending team', async () => {
    const { clientA, attackingClient, defendingClient } = await setupRoom();
    const movementState = await startMovement(attackingClient, clientA);

    // Make a move in ATTACKER_4 then end the turn (leaving the MOVE in the log)
    const teamPrefix = movementState.attackingTeam === 'home' ? 'home' : 'away';
    const pieceId = `${teamPrefix}-9`;
    const targetHex = movementState.attackingTeam === 'home' ? { q: 11, r: 7 } : { q: 13, r: 7 };

    const moveStatePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_MOVE, pieceId, targetHex);
    await moveStatePromise;

    // End the turn → SLOT_ADVANCE written, now in DEFENDER_5
    const defender5Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_END_TURN);
    const [defender5State] = await defender5Promise;
    expect(defender5State.movementSlot).toBe('DEFENDER_5');

    // Defending client (now active in DEFENDER_5) tries to undo
    // The log contains [MOVE, SLOT_ADVANCE]; current slot is empty but prior MOVE exists
    // → UNDO_LOCKED (D-09: moves from prior slot are committed)
    const undoLockedPromise = oncePromise(defendingClient, ServerEvents.GAME_ERROR);
    defendingClient.emit(ClientEvents.GAME_UNDO);
    const [lockedReason] = await undoLockedPromise;
    expect(lockedReason).toBe('UNDO_LOCKED');
  });

  it('SC-5: two rapid game:end-turn actions — second is dropped while first is processing', async () => {
    const { clientA, attackingClient } = await setupRoom();
    await startMovement(attackingClient, clientA);

    // Collect all GAME_STATE events for 500ms after two back-to-back end-turns
    const states: GameState[] = [];
    const stateListener = (s: GameState): void => {
      states.push(s);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).on(ServerEvents.GAME_STATE, stateListener);

    // Emit two end-turns synchronously
    attackingClient.emit(ClientEvents.GAME_END_TURN);
    attackingClient.emit(ClientEvents.GAME_END_TURN);

    // Wait for any states to arrive
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).off(ServerEvents.GAME_STATE, stateListener);

    // Only ONE slot advance should have occurred (second was dropped by isProcessing)
    const uniqueSlots = new Set(states.map((s) => s.movementSlot));
    // We expect ATTACKER_4→DEFENDER_5 (one transition, not two)
    const hasDefender5 = states.some((s) => s.movementSlot === 'DEFENDER_5');
    const hasAttacker2 = states.some((s) => s.movementSlot === 'ATTACKER_2');
    expect(hasDefender5).toBe(true);
    // If the second was dropped, ATTACKER_2 should NOT have been reached in this batch
    expect(hasAttacker2).toBe(false);
    expect(uniqueSlots.size).toBe(1); // only one distinct slot in the state snapshots
  });

  it.todo(
    'MOVE-06 free-move — engine-covered in gameEngine.test.ts; full wire exercise lands with the free-move handler in Phase 5',
  );
});

// Export helpers for potential reuse
export { setupRoom, createClient, oncePromise, waitForConnect };
