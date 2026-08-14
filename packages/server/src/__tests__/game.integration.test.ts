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
import { clearAllRooms, getRoom } from '../roomStore.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents, computeBallZone } from '@counter-attack/shared';
import { confirmDefaultRoomSettings } from './testHelpers.js';

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
 * Creates a room with 2 connected players, completes team selection, and waits for GAME_STATE.
 * clientA = slot 1 = 'home'; clientB = slot 2 = 'away'.
 * Returns which client controls the attacking team for convenience.
 *
 * Phase 16 D-10: game:state is only emitted after both teams picked via team:pick.
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

  // Phase 27 D-01/T-27-05: TEAM_SELECTION_START is gated on settings-confirmed AND
  // slot-2-joined — confirm settings before the joiner arrives so this helper's
  // join-then-team-selection-start flow still holds under the new both-conditions gate.
  await confirmDefaultRoomSettings(clientA);

  // Join: both clients receive team:selection-start (Phase 16 D-10)
  const selectionStartPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  await selectionStartPromise;

  // Drive team selection then uniform confirmation (Phase 22 D-13/D-14/D-15).
  // Away TEAM_PICK now broadcasts UNIFORM_SELECTION_START instead of building game state.
  const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED);
  clientA.emit(ClientEvents.TEAM_PICK, 'city');
  await homePickedPromise;
  const uniformStartPromise = oncePromise(clientA, ServerEvents.UNIFORM_SELECTION_START);
  clientB.emit(ClientEvents.TEAM_PICK, 'crew');
  await uniformStartPromise;
  // Home confirms uniform first; server broadcasts UNIFORM_HOME_CONFIRMED.
  const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED);
  clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
  await homeConfirmedPromise;
  // Away confirms uniform; Phase 24: server emits LINEUP_ASSIGNMENT_READY per socket.
  // Both players then confirm lineup to start the game (LINEUP_CONFIRM → GAME_STATE).
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

/**
 * Drives a room from KICK_OFF_SETUP → KICK_OFF by placing an attacking piece on the
 * centre hex, clearing defending pieces from the centre circle, and emitting game:ready
 * for both teams. Returns the KICK_OFF state.
 */
async function driveToKickOff(
  roomCode: string,
  attackingClient: Socket<ServerToClientEvents, ClientToServerEvents>,
  defendingClient: Socket<ServerToClientEvents, ClientToServerEvents>,
  attackingTeam: 'home' | 'away',
): Promise<GameState> {
  const { isInRegion, PITCH_REGIONS: PR } = await import('@counter-attack/shared');
  const room = getRoom(roomCode)!;
  const kickOffHex = PR.kickOffHex;
  const defendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';

  // Ensure attacking team has a piece on the centre hex
  const hasCentreHex = room.gameState!.pieces.some(
    (p) =>
      p.teamId === attackingTeam && p.position.q === kickOffHex.q && p.position.r === kickOffHex.r,
  );
  if (!hasCentreHex) {
    const firstAttacking = room.gameState!.pieces.find((p) => p.teamId === attackingTeam)!;
    room.gameState = {
      ...room.gameState!,
      pieces: room.gameState!.pieces.map((p) =>
        p.id === firstAttacking.id ? { ...p, position: kickOffHex } : p,
      ),
    };
  }

  // Move defending pieces out of centre circle and into their own half
  room.gameState = {
    ...room.gameState!,
    pieces: room.gameState!.pieces.map((p) => {
      if (p.teamId !== defendingTeam) return p;
      const safeHex = defendingTeam === 'away' ? { q: 30, r: 20 } : { q: 5, r: 20 };
      if (isInRegion(p.position, 'centreCircle')) return { ...p, position: safeHex };
      if (defendingTeam === 'home' && p.position.q > kickOffHex.q)
        return { ...p, position: { q: 5, r: p.position.r } };
      if (defendingTeam === 'away' && p.position.q < kickOffHex.q)
        return { ...p, position: { q: 30, r: p.position.r } };
      return p;
    }),
  };

  const afterFirst = oncePromise(attackingClient, ServerEvents.GAME_STATE);
  attackingClient.emit(ClientEvents.GAME_READY);
  await afterFirst;

  const afterSecond = oncePromise(attackingClient, ServerEvents.GAME_STATE);
  defendingClient.emit(ClientEvents.GAME_READY);
  const [kickOffState] = await afterSecond;
  return kickOffState;
}

/**
 * Creates a room and drives it to KICK_OFF phase (past KICK_OFF_SETUP).
 */
async function setupRoomAtKickOff(): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  roomCode: string;
  state: GameState;
  attackingClient: Socket<ServerToClientEvents, ClientToServerEvents>;
  defendingClient: Socket<ServerToClientEvents, ClientToServerEvents>;
  attackingTeam: 'home' | 'away';
}> {
  const { clientA, clientB, roomCode, state, attackingClient, defendingClient } = await setupRoom();
  const attackingTeam = state.attackingTeam;
  const kickOffState = await driveToKickOff(
    roomCode,
    attackingClient,
    defendingClient,
    attackingTeam,
  );
  return {
    clientA,
    clientB,
    roomCode,
    state: kickOffState,
    attackingClient,
    defendingClient,
    attackingTeam,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('game integration — lifecycle', () => {
  it('setupRoom returns a KICK_OFF_SETUP state with 22 pieces (D-12, D-23, TEAM-01)', async () => {
    const { state } = await setupRoom();
    expect(state.phase).toBe('KICK_OFF_SETUP');
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
    const { clientA, attackingClient, defendingClient } = await setupRoomAtKickOff();

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
    expect(movementState.phase).toBe('MOVE');
    expect(movementState.movementSlot).toBe('ATTACKER_4');
  });

  it('FSM: ATTACKER_4→DEFENDER_5→ATTACKER_2→PASS over the wire (D-03/D-04)', async () => {
    const { clientA, clientB, attackingClient } = await setupRoomAtKickOff();

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
    expect(slot2State.phase).toBe('MOVE');

    // DEFENDER_5 → ATTACKER_2: defending client ends turn
    const defendingClient = attackingIsA ? clientB : clientA;
    const slot3Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    defendingClient.emit(ClientEvents.GAME_END_TURN);
    const [slot3State] = await slot3Promise;
    expect(slot3State.movementSlot).toBe('ATTACKER_2');
    expect(slot3State.phase).toBe('MOVE');

    // ATTACKER_2 → PASS: attacking client ends turn again (D-04)
    const passPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_END_TURN);
    const [passState] = await passPromise;
    expect(passState.phase).toBe('PASS');
    expect(passState.movementSlot).toBeNull();
  });

  it('T-4-01 WRONG_TEAM: game:move from non-acting client returns WRONG_TEAM after start-movement', async () => {
    const { clientA, attackingClient, defendingClient } = await setupRoomAtKickOff();
    await startMovement(attackingClient, clientA);

    // Non-acting client tries to move — should get WRONG_TEAM
    const errorPromise = oncePromise(defendingClient, ServerEvents.GAME_ERROR);
    defendingClient.emit(ClientEvents.GAME_MOVE, 'home-9', { q: 11, r: 7 });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('D-10 undo reverses last move within the current slot', async () => {
    const { clientA, attackingClient } = await setupRoomAtKickOff();
    const movementState = await startMovement(attackingClient, clientA);

    // Use piece-9 of the attacking team; read its actual position from live state
    // (avoids hardcoding positions that differ between team squads).
    const teamPrefix = movementState.attackingTeam === 'home' ? 'home' : 'away';
    const pieceId = `${teamPrefix}-9`;
    const piece = movementState.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new Error(`Piece ${pieceId} not found in state`);
    const origPos = piece.position;
    // Move one hex in q — always a valid single-step move (piece has pace >= 1)
    const targetHex = {
      q: origPos.q + (movementState.attackingTeam === 'home' ? 1 : -1),
      r: origPos.r,
    };

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

  it('CR-01 (17.1-11): GAME_UNDO reverses a real FTP_MOVE during FIRST_TIME_PASS_MOVE', async () => {
    const { clientA, roomCode, attackingClient, attackingTeam } = await setupRoomAtKickOff();
    const movementState = await startMovement(attackingClient, clientA);

    const teamPrefix = attackingTeam === 'home' ? 'home' : 'away';
    const pieceId = `${teamPrefix}-9`;
    const piece = movementState.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new Error(`Piece ${pieceId} not found in state`);
    const origPos = piece.position;
    const toPos = { q: origPos.q + (attackingTeam === 'home' ? 1 : -1), r: origPos.r };

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    // Seed FIRST_TIME_PASS_MOVE directly: boundary FTP_REPOSITION followed by a real
    // FTP_MOVE (the shape gameHandlers.ts actually emits — never a fabricated MOVE event).
    room.gameState = {
      ...room.gameState,
      phase: 'FIRST_TIME_PASS_MOVE',
      activeTeam: attackingTeam,
      pieces: room.gameState.pieces.map((p) => (p.id === pieceId ? { ...p, position: toPos } : p)),
      eventLog: [
        { type: 'FTP_REPOSITION', slot: 'ATTACKER', pieceId: null, timestamp: 1000 },
        { type: 'FTP_MOVE', slot: 'ATTACKER', pieceId, from: origPos, to: toPos, timestamp: 2000 },
      ],
      firstTimePassMovementSlot: 'ATTACKER',
      firstTimePassMovedPieceId: pieceId,
      firstTimePassPaceUsed: 1,
    };

    const afterUndoPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_UNDO);
    const [afterUndo] = await afterUndoPromise;
    // Must NOT be a GAME_ERROR NOTHING_TO_UNDO snap-back — piece is restored to from-hex.
    expect(afterUndo.pieces.find((p) => p.id === pieceId)?.position).toEqual(origPos);
  });

  it('Review-CR-02 (17.1-15): FTP DEFENDER-slot delivery transfers possession to a defending-team occupant on passTargetHex', async () => {
    const { clientA, roomCode, attackingClient, defendingClient, attackingTeam } =
      await setupRoomAtKickOff();
    await startMovement(attackingClient, clientA);

    const defendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
    const defenderId = `${defendingTeam}-9`;

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    // Pick a real on-pitch target hex and place the defender exactly on it (Phase 10 P05:
    // avoid placeholder coords that break adjacency — derive from an existing attacking piece).
    const attackerPiece = room.gameState.pieces.find((p) => p.teamId === attackingTeam)!;
    const passTargetHex = {
      q: attackerPiece.position.q + (attackingTeam === 'home' ? 1 : -1),
      r: attackerPiece.position.r,
    };

    // Seed FIRST_TIME_PASS_MOVE in the DEFENDER slot (boundary already crossed: ATTACKER
    // slot done), with the defending-team piece occupying passTargetHex.
    room.gameState = {
      ...room.gameState,
      phase: 'FIRST_TIME_PASS_MOVE',
      attackingTeam,
      activeTeam: defendingTeam,
      passTargetHex,
      pieces: room.gameState.pieces.map((p) =>
        p.id === defenderId ? { ...p, position: passTargetHex } : p,
      ),
      eventLog: [
        ...room.gameState.eventLog,
        { type: 'FTP_REPOSITION', slot: 'ATTACKER', pieceId: null, timestamp: 1000 },
      ],
      firstTimePassMovementSlot: 'DEFENDER',
      firstTimePassMovedPieceId: null,
      firstTimePassPaceUsed: 0,
      // MOVE-06 (Phase 17, corrected design): the ball will land on passTargetHex after
      // delivery — mark that zone as already current so broadcastState's
      // applyFreeMoveZoneCheck does not fire mid-test. This fixture tests FTP DEFENDER-slot
      // delivery (Review-CR-02), not MOVE-06.
      ballZone: computeBallZone(passTargetHex),
    };
    // D-10 (Phase 39, 39-15): mark the ball's PREVIOUS-broadcast position as already
    // at passTargetHex so roomStore.ts's box-entry offer hook does not spuriously
    // detect a "fresh entry" into a penalty area from this direct test-state graft —
    // mirrors the ballZone pre-match above for the identical class of broadcastState
    // side-effect. This fixture tests FTP DEFENDER-slot delivery, not D-10.
    room.lastBroadcastBallPosition = passTargetHex;

    // The defending client is active in the DEFENDER slot — it ends the turn to complete delivery.
    // NOTE: against the pre-fix team-restricted lookup (`p.teamId === ftpEndState.attackingTeam`),
    // this defender would never match, so ball.carrierId would be null and attackingTeam would
    // stay unchanged — the invalid Review-CR-02 state this test guards against.
    const afterDeliveryPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    defendingClient.emit(ClientEvents.GAME_END_TURN);
    const [afterDelivery] = await afterDeliveryPromise;

    expect(afterDelivery.phase).toBe('PASS');
    expect(afterDelivery.ball.carrierId).toBe(defenderId);
    expect(afterDelivery.ball.position).toEqual(passTargetHex);
    expect(afterDelivery.attackingTeam).toBe(defendingTeam);
    expect(afterDelivery.activeTeam).toBe(defendingTeam);
  });

  it('Review-CR-02 (17.1-15): FTP DEFENDER-slot delivery to an EMPTY passTargetHex preserves carrierId:null with possession unchanged', async () => {
    const { clientA, roomCode, attackingClient, defendingClient, attackingTeam } =
      await setupRoomAtKickOff();
    await startMovement(attackingClient, clientA);

    const defendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    // Choose a target hex with no piece on it at all (empty-target preservation case).
    const passTargetHex = { q: 18, r: 13 }; // board centre (kickOffHex) — cleared of pieces below
    room.gameState = {
      ...room.gameState,
      phase: 'FIRST_TIME_PASS_MOVE',
      attackingTeam,
      activeTeam: defendingTeam,
      passTargetHex,
      pieces: room.gameState.pieces.map((p) =>
        p.position.q === passTargetHex.q && p.position.r === passTargetHex.r
          ? { ...p, position: { q: p.position.q + 5, r: p.position.r } } // move any occupant off-target
          : p,
      ),
      eventLog: [
        ...room.gameState.eventLog,
        { type: 'FTP_REPOSITION', slot: 'ATTACKER', pieceId: null, timestamp: 1000 },
      ],
      firstTimePassMovementSlot: 'DEFENDER',
      firstTimePassMovedPieceId: null,
      firstTimePassPaceUsed: 0,
    };

    const afterDeliveryPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    defendingClient.emit(ClientEvents.GAME_END_TURN);
    const [afterDelivery] = await afterDeliveryPromise;

    expect(afterDelivery.phase).toBe('PASS');
    expect(afterDelivery.ball.carrierId).toBeNull();
    expect(afterDelivery.ball.position).toEqual(passTargetHex);
    expect(afterDelivery.attackingTeam).toBe(attackingTeam); // possession unchanged
  });

  it('CR-01 (17.1-16): GAME_MOVE rejects the original passer repositioning onto passTargetHex during FTP ATTACKER slot (self-pass-reclaim exploit)', async () => {
    const { clientA, roomCode, attackingClient, attackingTeam } = await setupRoomAtKickOff();
    const movementState = await startMovement(attackingClient, clientA);

    const teamPrefix = attackingTeam === 'home' ? 'home' : 'away';
    const passerId = `${teamPrefix}-9`;
    const passer = movementState.pieces.find((p) => p.id === passerId);
    if (!passer) throw new Error(`Piece ${passerId} not found in state`);
    // passTargetHex exactly 1 hex from the passer's own position (an ordinary in-range FTP).
    const passTargetHex = {
      q: passer.position.q + (attackingTeam === 'home' ? 1 : -1),
      r: passer.position.r,
    };

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    // Seed FIRST_TIME_PASS_MOVE in the ATTACKER slot with firstTimePassCarrierId set to the
    // passer — this is the exact state produced by the real FIRST_TIME_PASS transition
    // (gameEngine.ts applyRoll PASS branch) before this fix existed, the passer's own
    // GAME_MOVE onto passTargetHex would have been silently accepted.
    room.gameState = {
      ...room.gameState,
      phase: 'FIRST_TIME_PASS_MOVE',
      attackingTeam,
      activeTeam: attackingTeam,
      passTargetHex,
      firstTimePassMovementSlot: 'ATTACKER',
      firstTimePassMovedPieceId: null,
      firstTimePassPaceUsed: 0,
      firstTimePassCarrierId: passerId,
    };

    // The passer attempts to reposition onto the (empty) passTargetHex to reclaim their own pass.
    const errorPromise = oncePromise(attackingClient, ServerEvents.GAME_ERROR);
    attackingClient.emit(ClientEvents.GAME_MOVE, passerId, passTargetHex);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_PIECE');

    // Passer's position must be unchanged — no reposition occurred.
    const roomAfter = getRoom(roomCode);
    const passerAfter = roomAfter?.gameState?.pieces.find((p) => p.id === passerId);
    expect(passerAfter?.position).toEqual(passer.position);
  });

  it('CR-01 (17.1-16): GAME_MOVE accepts a non-passer attacking-team piece repositioning during FTP ATTACKER slot', async () => {
    const { clientA, roomCode, attackingClient, attackingTeam } = await setupRoomAtKickOff();
    const movementState = await startMovement(attackingClient, clientA);

    const teamPrefix = attackingTeam === 'home' ? 'home' : 'away';
    const passerId = `${teamPrefix}-9`;
    // A different attacking-team piece (non-passer) — piece-5.
    const nonPasserId = `${teamPrefix}-5`;
    const nonPasser = movementState.pieces.find((p) => p.id === nonPasserId);
    if (!nonPasser) throw new Error(`Piece ${nonPasserId} not found in state`);
    // Empty on-pitch hex 1 hex from the non-passer's position.
    const destHex = {
      q: nonPasser.position.q + (attackingTeam === 'home' ? 1 : -1),
      r: nonPasser.position.r,
    };

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');
    // Ensure destHex is unoccupied (clear any piece that happens to be sitting there).
    room.gameState = {
      ...room.gameState,
      pieces: room.gameState.pieces.map((p) =>
        p.id !== nonPasserId && p.position.q === destHex.q && p.position.r === destHex.r
          ? { ...p, position: { q: p.position.q, r: p.position.r + 1 } }
          : p,
      ),
      phase: 'FIRST_TIME_PASS_MOVE',
      attackingTeam,
      activeTeam: attackingTeam,
      passTargetHex: { q: nonPasser.position.q + 5, r: nonPasser.position.r },
      firstTimePassMovementSlot: 'ATTACKER',
      firstTimePassMovedPieceId: null,
      firstTimePassPaceUsed: 0,
      firstTimePassCarrierId: passerId,
    };

    const afterMovePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_MOVE, nonPasserId, destHex);
    const [afterMove] = await afterMovePromise;

    expect(afterMove.pieces.find((p) => p.id === nonPasserId)?.position).toEqual(destHex);
    expect(afterMove.firstTimePassMovedPieceId).toBe(nonPasserId);
  });

  it('CR-01 (17.1-16): GAME_MOVE rejects the original passer regardless of WRONG_TEAM/lock/pace-gate ordering', async () => {
    // Behaviour-assertion: prior to this fix, the GAME_MOVE FTP handler gated only on
    // team/lock/pace/adjacency/pitch/occupied-by-other (gameHandlers.ts 488-550) — no
    // passer-identity exclusion existed, so this same seeded state would have let the
    // passer's move through to the position-update branch. This test re-confirms the
    // exclusion fires even when all other gates would have passed (own team, slot unlocked,
    // pace remaining, exactly 1 hex, on-pitch, unoccupied).
    const { clientA, roomCode, attackingClient, attackingTeam } = await setupRoomAtKickOff();
    const movementState = await startMovement(attackingClient, clientA);

    const teamPrefix = attackingTeam === 'home' ? 'home' : 'away';
    const passerId = `${teamPrefix}-9`;
    const passer = movementState.pieces.find((p) => p.id === passerId);
    if (!passer) throw new Error(`Piece ${passerId} not found in state`);
    const passTargetHex = {
      q: passer.position.q + (attackingTeam === 'home' ? 1 : -1),
      r: passer.position.r,
    };

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');
    room.gameState = {
      ...room.gameState,
      // Clear any other piece off passTargetHex so OCCUPIED would not otherwise fire.
      pieces: room.gameState.pieces.map((p) =>
        p.id !== passerId && p.position.q === passTargetHex.q && p.position.r === passTargetHex.r
          ? { ...p, position: { q: p.position.q, r: p.position.r + 1 } }
          : p,
      ),
      phase: 'FIRST_TIME_PASS_MOVE',
      attackingTeam,
      activeTeam: attackingTeam,
      passTargetHex,
      firstTimePassMovementSlot: 'ATTACKER',
      firstTimePassMovedPieceId: null,
      firstTimePassPaceUsed: 0,
      firstTimePassCarrierId: passerId,
    };

    const errorPromise = oncePromise(attackingClient, ServerEvents.GAME_ERROR);
    attackingClient.emit(ClientEvents.GAME_MOVE, passerId, passTargetHex);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_PIECE');
  });

  it('CR-01 (17.1-11): GAME_UNDO reverses a real HP_MOVE during HIGH_PASS_MOVE', async () => {
    const { clientA, roomCode, attackingClient, attackingTeam } = await setupRoomAtKickOff();
    const movementState = await startMovement(attackingClient, clientA);

    const teamPrefix = attackingTeam === 'home' ? 'home' : 'away';
    const pieceId = `${teamPrefix}-9`;
    const piece = movementState.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new Error(`Piece ${pieceId} not found in state`);
    const origPos = piece.position;
    const toPos = { q: origPos.q + (attackingTeam === 'home' ? 1 : -1), r: origPos.r };

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room or gameState not found');

    // Seed HIGH_PASS_MOVE directly: boundary HP_REPOSITION followed by a real HP_MOVE.
    room.gameState = {
      ...room.gameState,
      phase: 'HIGH_PASS_MOVE',
      activeTeam: attackingTeam,
      pieces: room.gameState.pieces.map((p) => (p.id === pieceId ? { ...p, position: toPos } : p)),
      eventLog: [
        { type: 'HP_REPOSITION', slot: 'ATTACKER', pieceId: null, timestamp: 1000 },
        { type: 'HP_MOVE', slot: 'ATTACKER', pieceId, from: origPos, to: toPos, timestamp: 2000 },
      ],
      highPassMovementSlot: 'ATTACKER',
      highPassMovedPieceId: pieceId,
      highPassPaceUsed: 1,
    };

    const afterUndoPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_UNDO);
    const [afterUndo] = await afterUndoPromise;
    // Must NOT be a GAME_ERROR NOTHING_TO_UNDO snap-back — piece is restored to from-hex.
    expect(afterUndo.pieces.find((p) => p.id === pieceId)?.position).toEqual(origPos);
  });

  it('D-09 UNDO_LOCKED: undo after a SLOT_ADVANCE is rejected for the defending team', async () => {
    const { clientA, attackingClient, defendingClient } = await setupRoomAtKickOff();
    const movementState = await startMovement(attackingClient, clientA);

    // Use piece-9 of the attacking team; read actual position from live state
    // to avoid hardcoding positions that differ between team squads.
    const teamPrefix = movementState.attackingTeam === 'home' ? 'home' : 'away';
    const pieceId = `${teamPrefix}-9`;
    const piece = movementState.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new Error(`Piece ${pieceId} not found in state`);
    const origPos = piece.position;
    const targetHex = {
      q: origPos.q + (movementState.attackingTeam === 'home' ? 1 : -1),
      r: origPos.r,
    };

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
    const { clientA, attackingClient } = await setupRoomAtKickOff();
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

// ---------------------------------------------------------------------------
// Helper: drive a room to PASS phase
// ---------------------------------------------------------------------------

/**
 * Drives a room from KICK_OFF through all three movement slots to reach PASS phase.
 * Returns the PASS-phase GameState.
 */
async function reachPassPhase(
  attackingClient: Socket<ServerToClientEvents, ClientToServerEvents>,
  defendingClient: Socket<ServerToClientEvents, ClientToServerEvents>,
  listenerSocket: Socket<ServerToClientEvents, ClientToServerEvents>,
): Promise<GameState> {
  // Start movement (KICK_OFF → MOVEMENT/ATTACKER_4)
  const movementState = await startMovement(attackingClient, listenerSocket);
  expect(movementState.movementSlot).toBe('ATTACKER_4');

  // ATTACKER_4 → DEFENDER_5
  const slot2Promise = oncePromise(listenerSocket, ServerEvents.GAME_STATE);
  attackingClient.emit(ClientEvents.GAME_END_TURN);
  await slot2Promise;

  // DEFENDER_5 → ATTACKER_2
  const slot3Promise = oncePromise(listenerSocket, ServerEvents.GAME_STATE);
  defendingClient.emit(ClientEvents.GAME_END_TURN);
  await slot3Promise;

  // ATTACKER_2 → PASS
  const passPromise = oncePromise(listenerSocket, ServerEvents.GAME_STATE);
  attackingClient.emit(ClientEvents.GAME_END_TURN);
  const [passState] = await passPromise;
  expect(passState.phase).toBe('PASS');
  return passState;
}

// ---------------------------------------------------------------------------
// game:roll integration tests
// ---------------------------------------------------------------------------

describe('game integration — game:roll (D-10, T-05-03, T-05-04)', () => {
  it('game:roll from active player in PASS phase → both clients receive game:state with lastDiceRoll and phase advanced', async () => {
    const { clientA, attackingClient, defendingClient, roomCode, state } =
      await setupRoomAtKickOff();
    const passState = await reachPassPhase(attackingClient, defendingClient, clientA);
    expect(passState.phase).toBe('PASS');

    // Set a ball carrier on the server so applyRoll can find the carrier piece.
    // In a real game the ball carrier is set when a player explicitly carries the ball;
    // for this integration test we wire it directly via the room store.
    // Also clear kickOffActive (Phase 8: set true after game:start-movement) so this test
    // can freely place the carrier anywhere without triggering kick-off origin enforcement (D-27).
    const room = getRoom(roomCode);
    // Phase 8.2: GAME_ROLL in PASS phase requires passType + targetHex (D-10).
    // Use a hex one step from the carrier with a clear path (distance=1, no intermediate hexes).
    let passTargetHex = { q: 6, r: 3 }; // default for home-1 carrier at {q:5, r:3}
    if (room?.gameState) {
      // Pick the first outfielder of the attacking team as the ball carrier
      const carrierId = `${state.attackingTeam}-1`;
      const carrier = room.gameState.pieces.find((p) => p.id === carrierId);
      if (carrier) {
        passTargetHex = { q: carrier.position.q + 1, r: carrier.position.r };
        room.gameState = {
          ...room.gameState,
          ball: { position: carrier.position, carrierId, lastTouchedBy: null },
          kickOffActive: false, // clear kick-off enforcement for this general pass test
          // MOVE-06 (Phase 17, corrected design): mark the ball's zone as already current
          // so broadcastState's applyFreeMoveZoneCheck does not fire mid-test — this
          // fixture tests game:roll/PASS-01, not MOVE-06.
          ballZone: computeBallZone(carrier.position),
        };
      }
    }

    // Both clients should receive the updated state
    const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);

    // Active player (attackingClient) emits game:roll — Phase 8.2: passType + targetHex required
    attackingClient.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', passTargetHex);

    // Wait for state from clientA perspective
    const [newState] = await statePromiseA;

    // lastDiceRoll must be populated (D-10: single broadcast with rolls embedded)
    expect(newState.lastDiceRoll).toBeDefined();
    expect(newState.lastDiceRoll).not.toBeNull();
    expect(newState.lastDiceRoll?.rolls).toBeDefined();
    expect(newState.lastDiceRoll?.rolls?.length ?? 0).toBeGreaterThanOrEqual(1);

    // D-09/Pitfall 8: Phase 8 restructures the FSM — accurate pass returns to action-choice (PASS),
    // NOT SHOT. Only inaccurate pass goes to LOOSE_BALL. SHOT is only reachable via game:shot
    // (from MOVEMENT) or applySnapshot. The pass result is either PASS (accurate) or LOOSE_BALL.
    expect(['PASS', 'LOOSE_BALL']).toContain(newState.phase);
  });

  it('game:roll from WRONG_TEAM (non-active player) in PASS phase → game:error WRONG_TEAM', async () => {
    const { clientA, attackingClient, defendingClient } = await setupRoomAtKickOff();
    await reachPassPhase(attackingClient, defendingClient, clientA);

    // Non-active player emits game:roll
    const errorPromise = oncePromise(defendingClient, ServerEvents.GAME_ERROR);
    defendingClient.emit(ClientEvents.GAME_ROLL);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('game:roll in MOVEMENT phase (non-dice phase) → game:error WRONG_PHASE', async () => {
    const { clientA, attackingClient } = await setupRoomAtKickOff();
    await startMovement(attackingClient, clientA);
    // We are now in MOVEMENT phase — game:roll is invalid

    const errorPromise = oncePromise(attackingClient, ServerEvents.GAME_ERROR);
    attackingClient.emit(ClientEvents.GAME_ROLL);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_PHASE');
  });
});

// ---------------------------------------------------------------------------
// game:gk-restart integration tests
// ---------------------------------------------------------------------------

describe('game integration — game:gk-restart (D-22, D-23, T-05-07/08/09/10)', () => {
  /**
   * Seeds a room's gameState directly into GK_RESTART with the away GK as ball carrier.
   * The away GK is piece 'away-0' (slot 1 = home = clientA; slot 2 = away = clientB).
   * Returns the seeded state and which client controls the GK team (clientB = 'away').
   */
  function seedGKRestart(
    roomCode: string,
    clientA: ReturnType<typeof createClient>,
    clientB: ReturnType<typeof createClient>,
  ): {
    gkTeamClient: ReturnType<typeof createClient>;
    nonGKTeamClient: ReturnType<typeof createClient>;
  } {
    const room = getRoom(roomCode);
    if (!room || !room.gameState) {
      throw new Error('Room or gameState not found');
    }

    // Find the away GK piece
    const awayGK = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK');
    if (!awayGK) throw new Error('Away GK not found in game state');

    // Seed state: GK_RESTART, away GK holds the ball
    room.gameState = {
      ...room.gameState,
      phase: 'GK_RESTART',
      ball: { position: awayGK.position, carrierId: awayGK.id, lastTouchedBy: null },
      attackingTeam: 'home', // home was attacking before the save
      activeTeam: 'away', // GK team is now relevant
      // MOVE-06 (Phase 17, corrected design): mark the ball's zone as already current
      // (not freshly entered) so broadcastState's applyFreeMoveZoneCheck does not fire
      // mid-seed — this fixture tests GK_RESTART, not MOVE-06.
      ballZone: computeBallZone(awayGK.position),
    };
    // D-10 (Phase 39, 39-15): mark the ball's PREVIOUS-broadcast position as already at
    // the GK's position so roomStore.ts's box-entry offer hook does not spuriously
    // detect a "fresh entry" into the GK's own penalty area from this direct
    // test-state graft — mirrors the ballZone pre-match above. This fixture tests
    // GK_RESTART, not D-10.
    room.lastBroadcastBallPosition = awayGK.position;

    // clientA = slot 1 = 'home' = non-GK team (home was attacking, away GK caught)
    // clientB = slot 2 = 'away' = GK team
    return { gkTeamClient: clientB, nonGKTeamClient: clientA };
  }

  it("GK team socket emits 'movement' → both clients receive MOVEMENT state with attackingTeam = GK team (D-26)", async () => {
    const { clientA, clientB, roomCode } = await setupRoom();

    // Reach KICK_OFF state (already at KICK_OFF after setupRoom; seed directly)
    const { gkTeamClient } = seedGKRestart(roomCode, clientA, clientB);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    gkTeamClient.emit(ClientEvents.GAME_GK_RESTART, 'movement');
    const [newState] = await statePromise;

    expect(newState.phase).toBe('MOVE');
    expect(newState.attackingTeam).toBe('away'); // GK team (away) now attacks
    expect(newState.lastDiceRoll).toBeNull();
    expect(newState.movementSlot).toBe('ATTACKER_4'); // Gap 1 fix: post-restart MOVEMENT is playable
  });

  it('non-GK socket emits game:gk-restart → game:error WRONG_TEAM; phase unchanged (T-05-07)', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { nonGKTeamClient } = seedGKRestart(roomCode, clientA, clientB);

    const errorPromise = oncePromise(nonGKTeamClient, ServerEvents.GAME_ERROR);
    nonGKTeamClient.emit(ClientEvents.GAME_GK_RESTART, 'movement');
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('GK socket emits invalid choice → game:error INVALID_CHOICE (T-05-08)', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { gkTeamClient } = seedGKRestart(roomCode, clientA, clientB);

    const errorPromise = oncePromise(gkTeamClient, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gkTeamClient.emit(ClientEvents.GAME_GK_RESTART, 'punt' as any);
    const [reason] = await errorPromise;
    expect(reason).toBe('INVALID_CHOICE');
  });
});

// ---------------------------------------------------------------------------
// game:shot integration tests (D-06, T-07-11, T-07-12)
// ---------------------------------------------------------------------------

describe('game:shot (D-06)', () => {
  /**
   * Seeds a room's gameState directly into PASS phase for the attacking team shooter
   * (D-02 rework: GAME_SHOT handler now guards on PASS phase, not SHOT).
   * Adds a ball carrier for the attacking team to satisfy applyDeclareShot guards.
   * Returns which client controls the attacking team and which is the defender.
   */
  function seedPassPhaseForShot(
    roomCode: string,
    clientA: ReturnType<typeof createClient>,
    clientB: ReturnType<typeof createClient>,
    attackingTeam: 'home' | 'away',
  ): {
    shooterClient: ReturnType<typeof createClient>;
    otherClient: ReturnType<typeof createClient>;
  } {
    const room = getRoom(roomCode);
    if (!room || !room.gameState) {
      throw new Error('Room or gameState not found');
    }
    // Assign a ball carrier from the attacking team (first FWD piece works)
    const carrierId = attackingTeam === 'home' ? 'home-8' : 'away-8';
    // D-09: shooter must be within 11 hexes of the goal.
    // Home attacks toward q=36 (goal r∈[10..16]); away attacks toward q=0.
    // Place shooter exactly 11 hexes from the centre goal hex so the range gate allows the shot.
    const shooterPos =
      attackingTeam === 'home'
        ? { q: 25, r: 13 } // hexDist to {q:36,r:13} = 11
        : { q: 11, r: 13 }; // hexDist to {q:0,r:13} = 11
    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam,
      activeTeam: attackingTeam,
      // lastActionType: null allows SHOT to be eligible (null treated as MOVEMENT_PHASE)
      lastActionType: null,
      // Reposition the carrier piece to within 11 hexes of the goal (D-09 range gate)
      pieces: room.gameState.pieces.map((p) =>
        p.id === carrierId ? { ...p, position: shooterPos } : p,
      ),
      ball: {
        position: shooterPos,
        carrierId,
        lastTouchedBy: null,
      },
    };
    // clientA = slot 1 = 'home'; clientB = slot 2 = 'away'
    const shooterClient = attackingTeam === 'home' ? clientA : clientB;
    const otherClient = attackingTeam === 'home' ? clientB : clientA;
    return { shooterClient, otherClient };
  }

  it('game:shot emitted when phase is NOT PASS returns GAME_ERROR WRONG_PHASE (T-07-11)', async () => {
    const { clientA, roomCode } = await setupRoom();
    // Phase is KICK_OFF_SETUP after setup — not PASS
    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_PHASE');
    // State must not have changed (still KICK_OFF_SETUP)
    expect(getRoom(roomCode)!.gameState?.phase).toBe('KICK_OFF_SETUP');
  });

  it('game:shot from the shooter in PASS phase → shot transition accepted (D-02 rework)', async () => {
    // D-02: GAME_SHOT now runs deflection check then enters GK_DIVING (or auto-resolves).
    const { clientA, clientB, roomCode, state } = await setupRoom();
    const { shooterClient } = seedPassPhaseForShot(roomCode, clientA, clientB, state.attackingTeam);

    // Register state listener BEFORE emitting (state IS broadcast now — ARCH-04)
    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);

    // Valid goal hex for the attacking team: q=36 for home, q=0 for away; r=13 (centre of goal)
    const targetHex = state.attackingTeam === 'home' ? { q: 36, r: 13 } : { q: 0, r: 13 };
    shooterClient.emit(ClientEvents.GAME_SHOT, targetHex);

    // Server broadcasts new state — phase leaves PASS (deflection or GK_DIVING or auto-GOAL)
    const [newState] = await statePromise;
    expect(newState.phase).not.toBe('PASS');
    // If GK in range and no deflection: GK_DIVING with shotTargetHex recorded
    if (newState.phase === 'GK_DIVE') {
      expect(newState.shotTargetHex).toEqual(targetHex);
    }
  });

  it('game:shot with a malformed payload (non-{q,r} object) returns GAME_ERROR INVALID_TARGET (T-07-12)', async () => {
    const { clientA, clientB, roomCode, state } = await setupRoom();
    // Seed in PASS phase so phase guard passes and payload check triggers
    const { shooterClient } = seedPassPhaseForShot(roomCode, clientA, clientB, state.attackingTeam);

    const errorPromise = oncePromise(shooterClient, ServerEvents.GAME_ERROR);

    shooterClient.emit(ClientEvents.GAME_SHOT, { q: 'x' } as never);
    const [reason] = await errorPromise;
    expect(reason).toBe('INVALID_TARGET');
    // Phase must not have changed (still PASS)
    expect(getRoom(roomCode)!.gameState?.phase).toBe('PASS');
  });
});

// Export helpers for potential reuse
export { setupRoom, createClient, oncePromise, waitForConnect };
