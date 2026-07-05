/**
 * Integration tests for kick-off setup over-the-wire behaviour.
 *
 * Tests the game:kick-off-move, game:ready, and game:start-movement handlers
 * that manage the KICK_OFF_SETUP phase. All tests use a real Socket.io server
 * (port 0) and socket.io-client — no mocking.
 *
 * Coverage:
 * - T-08-09: game:kick-off-move rejects opponent's piece with game:error
 * - T-08-10: game:ready with invalid placement is rejected; state snaps back to KICK_OFF_SETUP
 * - D-24: game:ready only transitions to KICK_OFF when BOTH teams confirm ready
 * - D-27: after KICK_OFF → MOVEMENT via game:start-movement, kickOffActive is true
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';
import { PITCH_REGIONS } from '@counter-attack/shared';

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
 * Creates a room with 2 connected players, completes team selection, and returns KICK_OFF_SETUP state.
 * clientA = slot 1 = 'home'; clientB = slot 2 = 'away'.
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
  attackingTeam: 'home' | 'away';
}> {
  const clientA = createClient();
  const clientB = createClient();
  await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

  const createPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
  clientA.emit(ClientEvents.ROOM_CREATE);
  const [roomCode] = await createPromise;

  // Join: both clients receive team:selection-start (Phase 16 D-10)
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
  clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical');
  await homeConfirmedPromise;
  const statePromiseA = oncePromise(clientA, ServerEvents.GAME_STATE);
  const statePromiseB = oncePromise(clientB, ServerEvents.GAME_STATE);
  clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal');
  const [[state]] = await Promise.all([statePromiseA, statePromiseB]);

  const attackingTeam = state.attackingTeam;
  const attackingClient = attackingTeam === 'home' ? clientA : clientB;
  const defendingClient = attackingTeam === 'home' ? clientB : clientA;

  return { clientA, clientB, roomCode, state, attackingClient, defendingClient, attackingTeam };
}

/**
 * Drives a room from KICK_OFF_SETUP → KICK_OFF by ensuring valid placement and both teams ready.
 * Returns the KICK_OFF state.
 *
 * @param observer - The socket to listen on for GAME_STATE broadcasts. Always use clientA
 *   (slot 1) as the observer to avoid stale event buffer issues when attackingClient = clientB.
 */
async function driveToKickOff(
  roomCode: string,
  attackingClient: Socket<ServerToClientEvents, ClientToServerEvents>,
  defendingClient: Socket<ServerToClientEvents, ClientToServerEvents>,
  attackingTeam: 'home' | 'away',
  observer?: Socket<ServerToClientEvents, ClientToServerEvents>,
): Promise<GameState> {
  // Default observer to attackingClient for backwards compatibility, but callers should
  // always pass clientA (slot 1) to avoid stale-buffer issues when attackingClient = clientB.
  const stateObserver = observer ?? attackingClient;
  const { isInRegion } = await import('@counter-attack/shared');
  const room = getRoom(roomCode)!;
  const kickOffHex = PITCH_REGIONS.kickOffHex;
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

  // Move defending pieces out of centre circle and into own half
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

  // Both teams ready — observe GAME_STATE on stateObserver (always clientA where possible)
  const afterFirst = oncePromise(stateObserver, ServerEvents.GAME_STATE);
  attackingClient.emit(ClientEvents.GAME_READY);
  await afterFirst;

  const afterSecond = oncePromise(stateObserver, ServerEvents.GAME_STATE);
  defendingClient.emit(ClientEvents.GAME_READY);
  const [kickOffState] = await afterSecond;
  return kickOffState;
}

/**
 * Creates a room already in KICK_OFF_SETUP phase (which is now the initial game state per D-23).
 * clientA = slot 1 = 'home'; clientB = slot 2 = 'away'.
 */
async function setupKickOffSetupRoom(): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  roomCode: string;
  attackingClient: Socket<ServerToClientEvents, ClientToServerEvents>;
  defendingClient: Socket<ServerToClientEvents, ClientToServerEvents>;
  attackingTeam: 'home' | 'away';
}> {
  const { clientA, clientB, roomCode, state, attackingClient, defendingClient, attackingTeam } =
    await setupRoom();

  // buildInitialGameState now starts at KICK_OFF_SETUP (D-23), so no manual phase override needed.
  void state; // suppress unused warning

  return { clientA, clientB, roomCode, attackingClient, defendingClient, attackingTeam };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GAME_KICK_OFF_MOVE — piece repositioning during KICK_OFF_SETUP', () => {
  it('T-08-09: rejects moving an opponent piece with game:error and snaps back state', async () => {
    const { clientA, clientB, roomCode, attackingTeam } = await setupKickOffSetupRoom();

    const room = getRoom(roomCode)!;
    const opponentTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';

    // Find a piece belonging to the opponent of slot 1 (clientA = home)
    const opponentPiece = room.gameState!.pieces.find((p) => p.teamId === opponentTeam)!;

    // clientA is always 'home'; clientB is always 'away'
    // To get clientA to try to move an away piece:
    // If attackingTeam === 'home', clientA is home and opponentTeam is away — clientA moves away piece (BAD)
    // If attackingTeam === 'away', clientA is home and opponentTeam is home — clientB moves home piece (BAD)
    const playerWithWrongPiece = opponentTeam === 'away' ? clientA : clientB;

    const errorPromise = oncePromise(playerWithWrongPiece, ServerEvents.GAME_ERROR);
    playerWithWrongPiece.emit(ClientEvents.GAME_KICK_OFF_MOVE, opponentPiece.id, {
      q: 10,
      r: 10,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('NOT_YOUR_PIECE');

    // State should snap back to KICK_OFF_SETUP
    const stateAfter = room.gameState!;
    expect(stateAfter.phase).toBe('KICK_OFF_SETUP');
    // Piece should not have moved
    const pieceAfter = stateAfter.pieces.find((p) => p.id === opponentPiece.id)!;
    expect(pieceAfter.position).toEqual(opponentPiece.position);
  });

  it('allows a player to reposition their own piece during KICK_OFF_SETUP', async () => {
    const { clientA, roomCode } = await setupKickOffSetupRoom();

    const room = getRoom(roomCode)!;
    // clientA = slot 1 = 'home'
    const homePiece = room.gameState!.pieces.find((p) => p.teamId === 'home')!;

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_KICK_OFF_MOVE, homePiece.id, { q: 5, r: 5 });
    const [newState] = await statePromise;

    expect(newState.phase).toBe('KICK_OFF_SETUP');
    const movedPiece = newState.pieces.find((p) => p.id === homePiece.id)!;
    expect(movedPiece.position).toEqual({ q: 5, r: 5 });
  });
});

describe('GAME_READY — kick-off placement confirmation', () => {
  it('T-08-10: rejects game:ready from attacking team when centre hex is empty (no piece on kickOffHex)', async () => {
    const { attackingClient, roomCode, attackingTeam } = await setupKickOffSetupRoom();

    const room = getRoom(roomCode)!;
    // Move ALL attacking pieces OFF the centre hex to ensure it is empty
    const kickOffHex = PITCH_REGIONS.kickOffHex; // {q:18, r:13}
    const safeHex: { q: number; r: number } =
      attackingTeam === 'home' ? { q: 5, r: 5 } : { q: 30, r: 5 };
    const newPieces = room.gameState!.pieces.map((p) =>
      p.teamId === attackingTeam && p.position.q === kickOffHex.q && p.position.r === kickOffHex.r
        ? { ...p, position: safeHex }
        : p,
    );
    room.gameState = { ...room.gameState!, pieces: newPieces };

    const errorPromise = oncePromise(attackingClient, ServerEvents.GAME_ERROR);
    attackingClient.emit(ClientEvents.GAME_READY);
    const [reason] = await errorPromise;

    expect(reason).toBe('CENTRE_HEX_EMPTY');
    // State should snap back to KICK_OFF_SETUP
    expect(room.gameState.phase).toBe('KICK_OFF_SETUP');
  });

  it('D-24: only the confirming team transitions; phase stays KICK_OFF_SETUP until both teams ready', async () => {
    const { attackingClient, roomCode, attackingTeam } = await setupKickOffSetupRoom();

    const room = getRoom(roomCode)!;
    // Ensure attacking team has a piece on the centre hex
    const kickOffHex = PITCH_REGIONS.kickOffHex;
    const hasCentreHex = room.gameState!.pieces.some(
      (p) =>
        p.teamId === attackingTeam &&
        p.position.q === kickOffHex.q &&
        p.position.r === kickOffHex.r,
    );
    if (!hasCentreHex) {
      // Place first attacking piece on centre hex
      const firstAttackingPiece = room.gameState!.pieces.find((p) => p.teamId === attackingTeam)!;
      const newPieces = room.gameState!.pieces.map((p) =>
        p.id === firstAttackingPiece.id ? { ...p, position: kickOffHex } : p,
      );
      room.gameState = { ...room.gameState!, pieces: newPieces };
    }

    // Attacking player emits ready — should get a GAME_STATE broadcast but phase stays KICK_OFF_SETUP
    // (only 1 of 2 players is ready)
    let gameError: string | null = null;
    attackingClient.once(ServerEvents.GAME_ERROR, (reason: string) => {
      gameError = reason;
    });
    const statePromise = oncePromise(attackingClient, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_READY);
    const [state] = await statePromise;

    // Capture any error for debugging (should be null — no error expected)
    // After one team ready, phase must still be KICK_OFF_SETUP
    expect(state.phase).toBe('KICK_OFF_SETUP');
    // If applyKickOffReady passed, readyPlayers should have 1 entry (no error)
    // Include gameError in the assertion message for debugging
    expect(gameError, `GAME_ERROR received: ${gameError}`).toBeNull();
    expect(room.readyPlayers?.size).toBe(1);
  });

  it('D-24: transitions to KICK_OFF when both teams confirm ready', async () => {
    const { clientA, clientB, roomCode, attackingTeam } = await setupKickOffSetupRoom();

    const room = getRoom(roomCode)!;
    const kickOffHex = PITCH_REGIONS.kickOffHex;

    // Ensure attacking team has a piece on the centre hex
    const hasCentreHex = room.gameState!.pieces.some(
      (p) =>
        p.teamId === attackingTeam &&
        p.position.q === kickOffHex.q &&
        p.position.r === kickOffHex.r,
    );
    if (!hasCentreHex) {
      const firstAttackingPiece = room.gameState!.pieces.find((p) => p.teamId === attackingTeam)!;
      const newPieces = room.gameState!.pieces.map((p) =>
        p.id === firstAttackingPiece.id ? { ...p, position: kickOffHex } : p,
      );
      room.gameState = { ...room.gameState!, pieces: newPieces };
    }

    // Ensure defending team has no pieces in the centre circle (all should be in own half by default)
    // The default squad positions from teams.ts should already satisfy this for the defending team
    const defendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
    // Move any defending pieces that might be in the centre circle out of it
    const { isInRegion } = await import('@counter-attack/shared');
    const newPieces2 = room.gameState!.pieces.map((p) => {
      if (p.teamId === defendingTeam && isInRegion(p.position, 'centreCircle')) {
        const safeHex = defendingTeam === 'away' ? { q: 30, r: 20 } : { q: 5, r: 20 };
        return { ...p, position: safeHex };
      }
      return p;
    });
    // Also ensure defending pieces are in their own half
    const newPieces3 = newPieces2.map((p) => {
      if (p.teamId === defendingTeam) {
        if (defendingTeam === 'home' && p.position.q > kickOffHex.q) {
          return { ...p, position: { q: 5, r: p.position.r } };
        }
        if (defendingTeam === 'away' && p.position.q < kickOffHex.q) {
          return { ...p, position: { q: 30, r: p.position.r } };
        }
      }
      return p;
    });
    room.gameState = { ...room.gameState!, pieces: newPieces3 };

    // Attacking client (clientA = home if attackingTeam=home, else clientB)
    const attackingClient = attackingTeam === 'home' ? clientA : clientB;
    const defendingClient = attackingTeam === 'home' ? clientB : clientA;

    // Both teams ready
    const statePromise1 = oncePromise(attackingClient, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_READY);
    await statePromise1; // wait for state after first ready

    // Second player ready — should trigger KICK_OFF transition
    const statePromise2 = oncePromise(attackingClient, ServerEvents.GAME_STATE);
    defendingClient.emit(ClientEvents.GAME_READY);
    const [finalState] = await statePromise2;

    expect(finalState.phase).toBe('KICK_OFF');
    expect(room.readyPlayers).toBeNull();
  });

  // D-47 (Phase 17, free-kick rulebook-correction round): a player cannot be flagged/
  // remain-flagged offside as a direct result of a kick-off restart — generalizes D-43
  // (already done for the free-kick restart) to the kick-off restart's GAME_READY
  // both-ready transition, which previously did not touch offsidePieceIds at all.
  it('D-47: both-ready transition resets offsidePieceIds to [] even when multiple pieces are flagged', async () => {
    const { clientA, clientB, roomCode, attackingTeam } = await setupKickOffSetupRoom();

    const room = getRoom(roomCode)!;
    const kickOffHex = PITCH_REGIONS.kickOffHex;

    const hasCentreHex = room.gameState!.pieces.some(
      (p) =>
        p.teamId === attackingTeam &&
        p.position.q === kickOffHex.q &&
        p.position.r === kickOffHex.r,
    );
    if (!hasCentreHex) {
      const firstAttackingPiece = room.gameState!.pieces.find((p) => p.teamId === attackingTeam)!;
      const newPieces = room.gameState!.pieces.map((p) =>
        p.id === firstAttackingPiece.id ? { ...p, position: kickOffHex } : p,
      );
      room.gameState = { ...room.gameState!, pieces: newPieces };
    }

    const defendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
    const { isInRegion } = await import('@counter-attack/shared');
    const newPieces2 = room.gameState!.pieces.map((p) => {
      if (p.teamId === defendingTeam && isInRegion(p.position, 'centreCircle')) {
        const safeHex = defendingTeam === 'away' ? { q: 30, r: 20 } : { q: 5, r: 20 };
        return { ...p, position: safeHex };
      }
      return p;
    });
    const newPieces3 = newPieces2.map((p) => {
      if (p.teamId === defendingTeam) {
        if (defendingTeam === 'home' && p.position.q > kickOffHex.q) {
          return { ...p, position: { q: 5, r: p.position.r } };
        }
        if (defendingTeam === 'away' && p.position.q < kickOffHex.q) {
          return { ...p, position: { q: 30, r: p.position.r } };
        }
      }
      return p;
    });
    // Seed sticky offside flags on BOTH teams' pieces before the restart — proves the
    // reset is unconditional (not just clearing the attacking/kicking side).
    const flaggedIds = room.gameState!.pieces.slice(0, 2).map((p) => p.id);
    room.gameState = { ...room.gameState!, pieces: newPieces3, offsidePieceIds: flaggedIds };

    const attackingClient = attackingTeam === 'home' ? clientA : clientB;
    const defendingClient = attackingTeam === 'home' ? clientB : clientA;

    const statePromise1 = oncePromise(attackingClient, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_READY);
    await statePromise1;

    const statePromise2 = oncePromise(attackingClient, ServerEvents.GAME_STATE);
    defendingClient.emit(ClientEvents.GAME_READY);
    const [finalState] = await statePromise2;

    expect(finalState.phase).toBe('KICK_OFF');
    expect(finalState.offsidePieceIds).toEqual([]);
  });
});

describe('MATCH-07: only a Standard Pass may be played as the opening action from KICK_OFF', () => {
  it('rejects a non-Standard-Pass during KICK_OFF with KICKOFF_STANDARD_PASS_ONLY and snaps back', async () => {
    const { clientA, clientB, roomCode, attackingClient, defendingClient, attackingTeam } =
      await setupRoom();
    const kickOffState = await driveToKickOff(
      roomCode,
      attackingClient,
      defendingClient,
      attackingTeam,
    );
    expect(kickOffState.phase).toBe('KICK_OFF');

    // Seed a valid targetHex (adjacent to the kickoff hex)
    const targetHex = { q: PITCH_REGIONS.kickOffHex.q + 1, r: PITCH_REGIONS.kickOffHex.r };

    const errorPromise = oncePromise(attackingClient, ServerEvents.GAME_ERROR);
    attackingClient.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', targetHex);
    const [reason] = await errorPromise;

    expect(reason).toBe('KICKOFF_STANDARD_PASS_ONLY');

    // Phase must snap back to KICK_OFF
    const snapState = oncePromise(attackingClient, ServerEvents.GAME_STATE);
    const [state] = await snapState.catch(() => [[kickOffState]]);
    void state; // snap-back already broadcast alongside the error
    const room = getRoom(roomCode)!;
    expect(room.gameState!.phase).toBe('KICK_OFF');

    void clientA;
    void clientB;
  });

  it('does not block a Standard Pass during KICK_OFF with KICKOFF_STANDARD_PASS_ONLY', async () => {
    const { clientA, clientB, roomCode, attackingClient, defendingClient, attackingTeam } =
      await setupRoom();
    const kickOffState = await driveToKickOff(
      roomCode,
      attackingClient,
      defendingClient,
      attackingTeam,
    );
    expect(kickOffState.phase).toBe('KICK_OFF');

    // Place the ball carrier at the kickoff hex so STANDARD_PASS is valid
    const room = getRoom(roomCode)!;
    const carrier = room.gameState!.pieces.find((p) => p.id === room.gameState!.ball.carrierId);
    if (!carrier) throw new Error('No ball carrier');

    const targetHex = { q: carrier.position.q + 1, r: carrier.position.r };

    // Listen for the first GAME_ERROR or GAME_STATE — whichever arrives
    let errorReceived: string | null = null;
    const errorListener = (err: string) => {
      errorReceived = err;
    };
    attackingClient.on(ServerEvents.GAME_ERROR, errorListener);

    const statePromise = oncePromise(attackingClient, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', targetHex);
    await statePromise;

    attackingClient.off(ServerEvents.GAME_ERROR, errorListener);

    // The guard must not have fired with KICKOFF_STANDARD_PASS_ONLY
    expect(errorReceived).not.toBe('KICKOFF_STANDARD_PASS_ONLY');

    void clientA;
    void clientB;
  });
});

describe('D-27: kickOffActive is set to true when KICK_OFF → MOVEMENT', () => {
  it('broadcast state has kickOffActive === true after game:start-movement from KICK_OFF', async () => {
    const { clientA, clientB, roomCode, attackingClient, defendingClient, attackingTeam } =
      await setupRoom();

    // Drive KICK_OFF_SETUP → KICK_OFF first (initial state is now KICK_OFF_SETUP per D-23)
    await driveToKickOff(roomCode, attackingClient, defendingClient, attackingTeam);

    // Now in KICK_OFF — game:start-movement transitions to MOVEMENT and sets kickOffActive = true
    const statePromise = oncePromise(attackingClient, ServerEvents.GAME_STATE);
    attackingClient.emit(ClientEvents.GAME_START_MOVEMENT);
    const [state] = await statePromise;

    expect(state.phase).toBe('MOVE');
    expect(state.kickOffActive).toBe(true);

    // Also verify via room store
    const room = getRoom(roomCode)!;
    expect(room.gameState!.kickOffActive).toBe(true);

    void clientA;
    void clientB; // suppress unused warning
  });
});
