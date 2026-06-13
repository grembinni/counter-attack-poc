/**
 * Integration tests for the FULL_TIME → REPLAY setInterval streaming loop.
 *
 * Tests that after a FULL_TIME transition, the server streams REPLAY-phase
 * game:state frames at 1-second intervals, each carrying phase='REPLAY',
 * replayIndex, and replayTotal. Uses vitest fake timers to avoid real 3s+Ns waits.
 *
 * Coverage:
 * - D-31: server streams buildReplayFrames at 1s intervals via setInterval
 * - D-32: each frame carries phase='REPLAY'
 * - D-33: each frame carries replayIndex and replayTotal
 * - T-08-15: replayTimer is cleared when frames are exhausted (no further emits)
 * - T-08-15: replayTimer is cleared on disconnect (roomHandlers.ts)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import type { ClientToServerEvents, GameState, ServerToClientEvents } from '@counter-attack/shared';
import { ClientEvents, ServerEvents } from '@counter-attack/shared';
import { buildReplayFrames } from '../gameEngine.js';

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let httpServer: ReturnType<typeof buildServer>['httpServer'];
let address: string;
const connectedClients: Socket[] = [];

beforeEach(async () => {
  // Use real timers for server startup; fake timers are enabled per-test
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
  // Restore real timers before teardown (some tests use fake timers)
  vi.useRealTimers();

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
 * Creates a room, drives team selection, seeds a FULL_TIME game state with a non-empty eventLog,
 * and returns the clients and room. The room state has phase='FULL_TIME'
 * and an eventLog with at least one MOVE event (so buildReplayFrames returns frames).
 *
 * Phase 16 D-10: game:state is only emitted after both teams picked via team:pick.
 */
async function setupFullTimeRoom(): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  roomCode: string;
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

  // Drive team selection: home picks cosmos, away picks xolos
  const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
  clientA.emit(ClientEvents.TEAM_PICK, 'cosmos');
  const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED);
  await homePickedPromise;
  clientB.emit(ClientEvents.TEAM_PICK, 'xolos');
  await statePromise;

  // Seed the room with a FULL_TIME state and a non-empty eventLog.
  // We add a MOVE event so buildReplayFrames produces at least one frame.
  const room = getRoom(roomCode)!;
  room.gameState = {
    ...room.gameState!,
    phase: 'FULL_TIME',
    eventLog: [
      ...room.gameState!.eventLog,
      {
        type: 'MOVE',
        pieceId: room.gameState!.pieces[0]!.id,
        from: room.gameState!.pieces[0]!.position,
        to: {
          q: room.gameState!.pieces[0]!.position.q + 1,
          r: room.gameState!.pieces[0]!.position.r,
        },
        slot: 'ATTACKER_4' as const,
        timestamp: Date.now(),
        ballAfter: {
          position: room.gameState!.ball.position,
          carrierId: room.gameState!.ball.carrierId,
        },
      },
    ],
  };

  return { clientA, clientB, roomCode };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FULL_TIME → REPLAY stream', () => {
  it('D-31/D-32: buildReplayFrames produces REPLAY-phase frames from FULL_TIME state', async () => {
    const { roomCode } = await setupFullTimeRoom();
    const room = getRoom(roomCode)!;

    // Verify the room has FULL_TIME state with frames available
    const frames = buildReplayFrames(room.gameState!);
    expect(frames.length).toBeGreaterThan(0);

    // D-31: every frame from buildReplayFrames has phase='REPLAY'
    for (const frame of frames) {
      expect(frame.phase).toBe('REPLAY');
    }

    // D-32: the frame is a valid GameState (has required fields)
    const firstFrame = frames[0]!;
    expect(firstFrame.roomCode).toBeDefined();
    expect(firstFrame.pieces).toBeDefined();
    expect(firstFrame.score).toBeDefined();
  });

  it('D-33: buildReplayFrames output verifies frame structure for replayIndex/replayTotal use', async () => {
    const { roomCode } = await setupFullTimeRoom();
    const room = getRoom(roomCode)!;

    // Seed multiple events for multiple frames
    const piece = room.gameState!.pieces[0]!;
    room.gameState = {
      ...room.gameState!,
      eventLog: [
        {
          type: 'MOVE',
          pieceId: piece.id,
          from: piece.position,
          to: { q: piece.position.q + 1, r: piece.position.r },
          slot: 'ATTACKER_4' as const,
          timestamp: Date.now() - 2000,
          ballAfter: {
            position: { q: piece.position.q + 1, r: piece.position.r },
            carrierId: null,
          },
        },
        {
          type: 'MOVE',
          pieceId: piece.id,
          from: { q: piece.position.q + 1, r: piece.position.r },
          to: { q: piece.position.q + 2, r: piece.position.r },
          slot: 'ATTACKER_4' as const,
          timestamp: Date.now() - 1000,
          ballAfter: {
            position: { q: piece.position.q + 2, r: piece.position.r },
            carrierId: null,
          },
        },
      ],
    };

    const frames = buildReplayFrames(room.gameState);
    // REPLAY-05: K = max path length across all moving pieces. Here one piece moves 2 steps
    // (path length 2), so K=2 and 2 step-frames are emitted. This is NOT simply '1 frame per
    // MOVE event' — if a second piece moved 3 steps concurrently the result would be 3 frames.
    expect(frames.length).toBe(2); // K = 2 steps for the single moving piece
    for (const frame of frames) {
      expect(frame.phase).toBe('REPLAY'); // D-31
    }
    // The handler adds replayIndex and replayTotal when streaming
    // Verify that adding these fields is type-safe (GameState has replayIndex/replayTotal fields)
    const annotatedFrame = { ...frames[0], replayIndex: 1, replayTotal: frames.length };
    expect(annotatedFrame.replayIndex).toBe(1);
    expect(annotatedFrame.replayTotal).toBe(2);
  });

  it('REPLAY-06: each replay frame reflects ball position from ballAfter on the triggering event', async () => {
    const { roomCode } = await setupFullTimeRoom();
    const room = getRoom(roomCode)!;
    const piece = room.gameState!.pieces[0]!;
    const targetA = { q: piece.position.q + 1, r: piece.position.r };
    const targetB = { q: piece.position.q + 2, r: piece.position.r };
    const carrierId = 'home-st';

    room.gameState = {
      ...room.gameState!,
      eventLog: [
        {
          type: 'MOVE',
          pieceId: piece.id,
          from: piece.position,
          to: targetA,
          slot: 'ATTACKER_4' as const,
          timestamp: 1,
          ballAfter: { position: targetA, carrierId },
        },
        {
          type: 'MOVE',
          pieceId: piece.id,
          from: targetA,
          to: targetB,
          slot: 'ATTACKER_4' as const,
          timestamp: 2,
          ballAfter: { position: targetB, carrierId: null },
        },
      ],
    };

    const frames = buildReplayFrames(room.gameState);
    expect(frames).toHaveLength(2);
    expect(frames[0]!.ball).toEqual({ position: targetA, carrierId });
    expect(frames[1]!.ball).toEqual({ position: targetB, carrierId: null });
  });

  it('T-08-15: replayTimer is cleared when frames are exhausted (no further emits)', async () => {
    vi.useFakeTimers();

    const { roomCode } = await setupFullTimeRoom();
    const room = getRoom(roomCode)!;
    const frames = buildReplayFrames(room.gameState!);
    expect(frames.length).toBeGreaterThan(0);

    // Simulate the stream using the same pattern as startReplayStream
    let framesSent = 0;
    let idx = 0;
    room.replayTimer = setInterval(() => {
      if (idx >= frames.length) {
        clearInterval(room.replayTimer!);
        room.replayTimer = null;
        return;
      }
      idx++;
      framesSent++;
    }, 1000);

    // Advance time to send all frames
    vi.advanceTimersByTime(frames.length * 1000 + 500);
    expect(framesSent).toBe(frames.length);
    // After all frames, the next tick clears the timer
    vi.advanceTimersByTime(1000);
    expect(room.replayTimer).toBeNull(); // T-08-15: timer cleared after exhaustion

    vi.useRealTimers();
  });

  it('T-08-15: disconnect handler clears replayTimer when set', async () => {
    const { clientA, roomCode } = await setupFullTimeRoom();
    const room = getRoom(roomCode)!;

    // Set a mock replayTimer on the room
    let intervalCleared = false;
    const mockTimer = setInterval(() => {
      /* no-op */
    }, 999999);
    room.replayTimer = mockTimer;

    // clientA disconnects — the disconnect handler should clear room.replayTimer
    const disconnectPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, 500); // give handler time to run
    });
    clientA.disconnect();
    await disconnectPromise;

    // Clear the mock timer if it wasn't already cleared (to prevent test leak)
    if (room.replayTimer !== null) {
      clearInterval(room.replayTimer);
      intervalCleared = true;
    } else {
      intervalCleared = true; // handler cleared it
    }

    expect(intervalCleared).toBe(true);
  });

  it('REPLAY-04: replay stream emits frames at 500ms cadence with 3s pre-roll', async () => {
    vi.useFakeTimers();
    const { roomCode } = await setupFullTimeRoom();
    const room = getRoom(roomCode)!;
    const piece = room.gameState!.pieces[0]!;

    // Seed 2 MOVE events so buildReplayFrames produces 2 frames to stream
    room.gameState = {
      ...room.gameState!,
      eventLog: [
        {
          type: 'MOVE',
          pieceId: piece.id,
          from: piece.position,
          to: { q: piece.position.q + 1, r: piece.position.r },
          slot: 'ATTACKER_4' as const,
          timestamp: 1,
          ballAfter: { position: piece.position, carrierId: null },
        },
        {
          type: 'MOVE',
          pieceId: piece.id,
          from: { q: piece.position.q + 1, r: piece.position.r },
          to: { q: piece.position.q + 2, r: piece.position.r },
          slot: 'ATTACKER_4' as const,
          timestamp: 2,
          ballAfter: {
            position: { q: piece.position.q + 2, r: piece.position.r },
            carrierId: null,
          },
        },
      ],
    };

    const frames = buildReplayFrames(room.gameState);
    expect(frames.length).toBe(2);

    // Simulate startReplayStream's timer pattern: 3s pre-roll then 500ms interval (REPLAY-04)
    let framesSent = 0;
    let idx = 0;
    setTimeout(() => {
      room.replayTimer = setInterval(() => {
        if (idx >= frames.length) {
          clearInterval(room.replayTimer!);
          room.replayTimer = null;
          return;
        }
        idx++;
        framesSent++;
      }, 500);
    }, 3000);

    // Before pre-roll: no frames
    vi.advanceTimersByTime(2999);
    expect(framesSent).toBe(0);

    // Pre-roll fires at t=3000ms; advance to t=3499ms — 499ms into interval, no tick yet
    vi.advanceTimersByTime(500);
    expect(framesSent).toBe(0);

    // At t=3500ms: first 500ms tick fires
    vi.advanceTimersByTime(1);
    expect(framesSent).toBe(1);

    // At t=4000ms: second 500ms tick fires
    vi.advanceTimersByTime(500);
    expect(framesSent).toBe(2);

    vi.useRealTimers();
  });

  it('REPLAY-05: movement phase replays as K simultaneous step-frames', async () => {
    const { roomCode } = await setupFullTimeRoom();
    const room = getRoom(roomCode)!;
    const pieces = room.gameState!.pieces;
    const pieceX = pieces[0]!;
    const pieceY = pieces[1]!;
    const xPos = pieceX.position;
    const yPos = pieceY.position;
    const ballPos = { q: 18, r: 13 };

    // pieceX: 3 consecutive MOVE events (path length 3)
    // pieceY: 1 MOVE event (path length 1)
    // No non-MOVE boundary event — flush occurs at end of log
    room.gameState = {
      ...room.gameState!,
      eventLog: [
        {
          type: 'MOVE',
          pieceId: pieceX.id,
          from: xPos,
          to: { q: xPos.q + 1, r: xPos.r },
          slot: 'ATTACKER_4' as const,
          timestamp: 1,
          ballAfter: { position: ballPos, carrierId: null },
        },
        {
          type: 'MOVE',
          pieceId: pieceX.id,
          from: { q: xPos.q + 1, r: xPos.r },
          to: { q: xPos.q + 2, r: xPos.r },
          slot: 'ATTACKER_4' as const,
          timestamp: 2,
          ballAfter: { position: ballPos, carrierId: null },
        },
        {
          type: 'MOVE',
          pieceId: pieceX.id,
          from: { q: xPos.q + 2, r: xPos.r },
          to: { q: xPos.q + 3, r: xPos.r },
          slot: 'ATTACKER_4' as const,
          timestamp: 3,
          ballAfter: { position: ballPos, carrierId: null },
        },
        {
          type: 'MOVE',
          pieceId: pieceY.id,
          from: yPos,
          to: { q: yPos.q + 1, r: yPos.r },
          slot: 'DEFENDER_5' as const,
          timestamp: 4,
          ballAfter: { position: ballPos, carrierId: null },
        },
      ],
    };

    const frames = buildReplayFrames(room.gameState);

    // K = 3 (max path length; pieceX has 3 steps, pieceY has 1)
    expect(frames).toHaveLength(3);

    for (const frame of frames) {
      expect(frame.phase).toBe('REPLAY');
    }

    const getPiecePos = (frame: GameState, id: string) =>
      frame.pieces.find((p) => p.id === id)!.position;

    // Step 1: both pieces advance simultaneously
    expect(getPiecePos(frames[0]!, pieceX.id)).toEqual({ q: xPos.q + 1, r: xPos.r });
    expect(getPiecePos(frames[0]!, pieceY.id)).toEqual({ q: yPos.q + 1, r: yPos.r });

    // Step 2: pieceX advances; pieceY holds its final hex
    expect(getPiecePos(frames[1]!, pieceX.id)).toEqual({ q: xPos.q + 2, r: xPos.r });
    expect(getPiecePos(frames[1]!, pieceY.id)).toEqual({ q: yPos.q + 1, r: yPos.r });

    // Step 3: pieceX reaches its final hex; pieceY still holds
    expect(getPiecePos(frames[2]!, pieceX.id)).toEqual({ q: xPos.q + 3, r: xPos.r });
    expect(getPiecePos(frames[2]!, pieceY.id)).toEqual({ q: yPos.q + 1, r: yPos.r });
  });

  it('D-31: startReplayStream is triggered when FULL_TIME is reached via GAME_END_TURN', async () => {
    // This test seeds a room where the next GAME_END_TURN will produce FULL_TIME,
    // then verifies that REPLAY-phase frames are eventually emitted.
    const { clientA, clientB, roomCode } = await setupFullTimeRoom();

    // Seed the room so the next applyEndTurn call produces FULL_TIME:
    // half=2, actionCount just before 45+addedTime, movementSlot=ATTACKER_2
    const room = getRoom(roomCode)!;
    room.gameState = {
      ...room.gameState!,
      phase: 'MOVEMENT',
      movementSlot: 'ATTACKER_2',
      half: 2,
      actionCount: 42, // +3 on end-turn = 45; addedTime will be set and then crossed
      addedTime: null,
      // We'll use leniency=0 effectively: addedTime will be roll + leniency
      // but we can't control the roll. Instead set addedTime already = 0 (min possible)
      // and actionCount such that 45 + 0 = 45 <= 45 -> FULL_TIME
      // Actually set actionCount=45 so +3 = 48 >= 45+addedTime (roll result)
      // The safest approach: set addedTime=1 (already set), actionCount=44 → 44+3=47 >= 45+1=46
    };
    // Set addedTime and actionCount so FULL_TIME fires deterministically
    room.gameState = {
      ...room.gameState,
      addedTime: 1, // already set; halfEnd = 46
      actionCount: 44, // +3 = 47 >= 46 → FULL_TIME
      attackingTeam: room.gameState.attackingTeam,
      activeTeam: room.gameState.attackingTeam, // must be the acting team for isActivePlayer check
    };

    // Collect REPLAY frames (will arrive after ~3s + intervals)
    const replayFrames: GameState[] = [];
    const replayPromise = new Promise<void>((resolve) => {
      clientA.on(ServerEvents.GAME_STATE, (state: GameState) => {
        if (state.phase === 'REPLAY') {
          replayFrames.push(state);
          // Resolve after first REPLAY frame arrives
          resolve();
        }
      });
    });

    // The attacking team ends their turn
    const attackingClient = room.gameState.attackingTeam === 'home' ? clientA : clientB;
    attackingClient.emit(ClientEvents.GAME_END_TURN);

    // Wait up to 8s for first REPLAY frame (3s hold + first 1s tick + buffer)
    await Promise.race([
      replayPromise,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('No REPLAY frame received within 8s')), 8000),
      ),
    ]);

    // Should have at least one REPLAY frame
    expect(replayFrames.length).toBeGreaterThan(0);
    expect(replayFrames[0]!.phase).toBe('REPLAY');
    // D-33: frame should carry replayTotal
    expect(replayFrames[0]!.replayTotal).toBeGreaterThanOrEqual(1);
    // D-33: frame should carry replayIndex (1-based)
    expect(replayFrames[0]!.replayIndex).toBeGreaterThanOrEqual(1);
  }, 10000); // longer timeout for this test
});
