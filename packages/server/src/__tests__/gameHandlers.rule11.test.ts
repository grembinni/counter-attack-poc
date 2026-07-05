/**
 * Phase 11 handler-level tests — RULE-01 and RULE-02 correctness.
 *
 * Covers:
 *  - GAME_HEADER_ACCURACY_ACK: attacker clears flag; non-attacker is rejected
 *  - GAME_HEADER_CONTESTANT both-confirmed: duel auto-fires, headerDuelWinner is set
 *  - GAME_HEADER_TARGET: winner guard — winner succeeds; loser is rejected
 *  - RULE-02 header tie: equal scores → LOOSE_BALL (CR-02 regression coverage)
 *
 * Test harness mirrors gameHandlers.phase10.test.ts (real Socket.io server on port 0;
 * room store seeded directly via getRoom).
 */

// vi.mock is hoisted by vitest — must appear before other imports.
// Forces all rollDice() calls to return 3, making any two contestants with equal heading
// produce equal raw scores (heading + 3 each) → computeHeaderDuelWinner returns null → LOOSE_BALL.
vi.mock('../diceUtils.js', () => ({ rollDice: () => 3 }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
 * Creates a room with 2 connected clients, completes team selection.
 * clientA = slot 1 = 'home'; clientB = slot 2 = 'away'.
 *
 * Phase 16 D-10: game:state is only emitted after both teams picked via team:pick.
 * This helper drives the full team-selection flow so tests get a real GameState.
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

  return { clientA, clientB, roomCode, state };
}

/**
 * Seeds a HEADER phase state with headerAccuracyRollPending: true for RULE-01 ACK tests.
 * home is the attacker; ball at {q:25,r:12}.
 */
function seedHeaderPendingAccuracy(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
  if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

  room.gameState = {
    ...room.gameState,
    phase: 'HEADER',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: 'HIGH_PASS',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    ball: { position: { q: 25, r: 12 }, carrierId: null },
    pieces: room.gameState.pieces.map((p) => {
      if (p.id === homeAttacker.id) return { ...p, position: { q: 25, r: 12 } };
      if (p.id === awayDefender.id) return { ...p, position: { q: 26, r: 12 } };
      return p;
    }),
    headerContestants: { home: [], away: [] },
    headerConfirmed: { home: false, away: false },
    headerAccuracyRollPending: true,
    headerDuelWinner: null,
  };
}

/**
 * Seeds a HEADER phase state ready for both-team contestant confirmation.
 * Neither team has confirmed yet; headerAccuracyRollPending is null (already acked).
 */
function seedHeaderReadyForContestants(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
  if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

  room.gameState = {
    ...room.gameState,
    phase: 'HEADER',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: 'HIGH_PASS',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    ball: { position: { q: 25, r: 12 }, carrierId: null },
    pieces: room.gameState.pieces.map((p) => {
      if (p.id === homeAttacker.id) return { ...p, position: { q: 25, r: 12 } };
      if (p.id === awayDefender.id) return { ...p, position: { q: 26, r: 12 } };
      return p;
    }),
    headerContestants: { home: [], away: [] },
    headerConfirmed: { home: false, away: false },
    headerAccuracyRollPending: null, // already acknowledged
    headerDuelWinner: null,
  };
}

/**
 * Seeds a HEADER phase state with both teams confirmed and headerDuelWinner set.
 * Used for GAME_HEADER_TARGET winner guard tests.
 * home = winner (home is attacker, home wins duel).
 */
function seedHeaderWithDuelWinner(roomCode: string, winner: 'home' | 'away' = 'home'): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
  if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

  // Ball at {q:25,r:12}; home attacker at {q:25,r:12} (within 6 of target {q:28,r:12})
  room.gameState = {
    ...room.gameState,
    phase: 'HEADER',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: 'HIGH_PASS',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    ball: { position: { q: 25, r: 12 }, carrierId: null },
    pieces: room.gameState.pieces.map((p) => {
      if (p.id === homeAttacker.id) return { ...p, position: { q: 25, r: 12 } };
      if (p.id === awayDefender.id) return { ...p, position: { q: 26, r: 12 } };
      return p;
    }),
    headerContestants: { home: [homeAttacker.id], away: [awayDefender.id] },
    headerConfirmed: { home: true, away: true },
    headerAccuracyRollPending: null,
    headerDuelWinner: winner,
  };
}

// ---------------------------------------------------------------------------
// RULE-01: GAME_HEADER_ACCURACY_ACK handler
// ---------------------------------------------------------------------------

describe('RULE-01: GAME_HEADER_ACCURACY_ACK — attacker clears accuracy-roll flag', () => {
  it('clears headerAccuracyRollPending to null when attacking team sends the ack', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedHeaderPendingAccuracy(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
    const [state] = await statePromise;

    expect(state.headerAccuracyRollPending == null).toBe(true);
    expect(state.phase).toBe('HEADER'); // still in HEADER — contestants not selected yet
  });

  it('emits GAME_ERROR WRONG_TEAM when non-attacking team sends the ack', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedHeaderPendingAccuracy(roomCode);

    // clientB = 'away' = NOT the attacker (attackingTeam = 'home')
    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('emits GAME_ERROR WRONG_PHASE when sent outside HEADER phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    room.gameState = {
      ...room.gameState,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
    };

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_PHASE');
  });

  it('does not change headerAccuracyRollPending after non-attacker ack attempt', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedHeaderPendingAccuracy(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
    await errorPromise; // wait for error

    // Flag should still be true
    const room = getRoom(roomCode);
    expect(room?.gameState?.headerAccuracyRollPending).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RULE-02: GAME_HEADER_CONTESTANT — auto-duel when both teams confirm (D-03)
// ---------------------------------------------------------------------------

describe('RULE-02: GAME_HEADER_CONTESTANT — both-confirmed auto-fires duel', () => {
  it('immediately transitions to PASS or LOOSE_BALL when both teams confirm (Bug 4 fix)', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!homeAttacker || !awayDefender) throw new Error('Pieces not found');

    // clientA (home) confirms first
    const stateAfterA = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await stateAfterA;

    // clientB (away) confirms second — duel auto-fires and resolves immediately
    const stateAfterB = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HEADER_CONTESTANT, [awayDefender.id]);
    const [stateB] = await stateAfterB;

    // Bug 4 fix: duel resolves immediately — phase transitions to PASS or LOOSE_BALL (tie).
    // HEADER phase is no longer held open for a target-selection step.
    expect(['PASS', 'GK_DIVE', 'LOOSE_BALL']).toContain(stateB.phase);
    // header fields cleared on all terminal transitions
    expect(stateB.headerDuelWinner == null).toBe(true);
    expect(stateB.headerContestants == null).toBe(true);
  });

  it('broadcasts exactly one GAME_STATE per contestant confirmation', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    if (!homeAttacker) throw new Error('Piece not found');

    let stateCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).on(ServerEvents.GAME_STATE, () => {
      stateCount++;
    });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await statePromise;

    expect(stateCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// D-57: header CONTESTED by an offside player goes directly to the free kick
// (supersedes D-52 — broader trigger: ANY nominated contestant, not just the
// eventual winner, and checked BEFORE dice are rolled / before
// computeHeaderDuelWinner is ever called)
// ---------------------------------------------------------------------------

describe('D-57: header contested by an offside-flagged player triggers the foul immediately (supersedes D-52)', () => {
  it('a contestant who would LOSE the duel but is flagged offside still triggers the foul (the case D-52 missed)', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

    // Stack aerialAbility so home would clearly WIN the duel on a normal resolution
    // (rollDice is mocked to always return 3, so the higher aerialAbility wins outright).
    // The away defender — the would-be LOSER — is the one flagged offside.
    // Reposition the defender to the middle third first: the foul's free-kick spot is
    // the offender's position (D-27), and seedHeaderReadyForContestants's default
    // {q:26,r:12} sits in awayThird, which would otherwise spuriously trigger MOVE-06's
    // ball-zone free-move overlay (D-33) on top of FREE_KICK_SETUP — an unrelated
    // interaction this test isn't exercising.
    room.gameState = {
      ...room.gameState,
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeAttacker.id) return { ...p, aerialAbility: 9 };
        if (p.id === awayDefender.id) return { ...p, aerialAbility: 1, position: { q: 20, r: 12 } };
        return p;
      }),
      offsidePieceIds: [awayDefender.id],
    };

    const stateAfterA = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await stateAfterA;

    const stateAfterB = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HEADER_CONTESTANT, [awayDefender.id]);
    const [finalState] = await stateAfterB;

    // Foul fires immediately — straight to FREE_KICK_SETUP, no duel resolution at all.
    expect(finalState.phase).toBe('FREE_KICK_SETUP');
    // The would-be loser (the flagged contestant) is the offender — the foul spot is
    // their position, and they are removed from offsidePieceIds (D-26/D-43 reset on fire).
    expect(finalState.offsidePieceIds).not.toContain(awayDefender.id);
    // No duel ever resolved: headerDuelWinner was never set, dice were never rolled for
    // the heading duel (lastDiceRoll context would be HEADING_DUEL if computeHeaderDuelWinner
    // / applyRoll had run for this contest).
    expect(finalState.headerDuelWinner == null).toBe(true);
    expect(finalState.lastDiceRoll?.context).not.toBe('HEADING_DUEL');
  });

  it('a contestant on the HOME side (attacking team) being flagged also triggers the foul', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

    room.gameState = {
      ...room.gameState,
      offsidePieceIds: [homeAttacker.id],
    };

    const stateAfterA = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await stateAfterA;

    const stateAfterB = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HEADER_CONTESTANT, [awayDefender.id]);
    const [finalState] = await stateAfterB;

    expect(finalState.phase).toBe('FREE_KICK_SETUP');
    expect(finalState.headerDuelWinner == null).toBe(true);
    // Possession goes to the team NOT committing the foul (D-28) — away conceded the
    // foul? No: home's contestant fouled, so away is awarded the kick.
    expect(finalState.freeKickAttackingTeam).toBe('away');
  });

  it('no dice are rolled / no heading duel resolves when a flagged contestant is present', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

    // Reposition the defender to the middle third first (see prior test's comment —
    // avoids a spurious MOVE-06 ball-zone overlay on top of FREE_KICK_SETUP).
    room.gameState = {
      ...room.gameState,
      pieces: room.gameState.pieces.map((p) =>
        p.id === awayDefender.id ? { ...p, position: { q: 20, r: 12 } } : p,
      ),
      lastDiceRoll: null,
      offsidePieceIds: [awayDefender.id],
    };

    const stateAfterA = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await stateAfterA;

    const stateAfterB = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HEADER_CONTESTANT, [awayDefender.id]);
    const [finalState] = await stateAfterB;

    // lastDiceRoll stays untouched (null) — confirms rollDice()/computeHeaderDuelWinner
    // were never invoked for this header contest; the foul path never touches lastDiceRoll.
    expect(finalState.lastDiceRoll == null).toBe(true);
    expect(finalState.phase).toBe('FREE_KICK_SETUP');
  });

  it('BUG-07: the normal (no flagged contestant) path delivers pass DIRECTLY after winner resolves — no HEADER phase stop', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

    // No offsidePieceIds set — neither contestant is flagged. Stack aerialAbility so the
    // outcome is deterministic (rollDice mocked to 3 — higher aerialAbility wins outright).
    room.gameState = {
      ...room.gameState,
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeAttacker.id) return { ...p, aerialAbility: 9 };
        if (p.id === awayDefender.id) return { ...p, aerialAbility: 1 };
        return p;
      }),
    };

    const stateAfterA = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await stateAfterA;

    const stateAfterB = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HEADER_CONTESTANT, [awayDefender.id]);
    const [finalState] = await stateAfterB;

    // BUG-07: duel resolves and pass is delivered IMMEDIATELY — no HEADER phase stop.
    // Phase must be PASS (or GK_DIVE if winner's position is goal-line-adjacent), not HEADER.
    // lastActionType must be HEADER (non-contestable delivery per BUG-01 precedent).
    expect(finalState.phase).not.toBe('HEADER');
    expect(finalState.lastActionType).toBe('HEADER');
    // The event log must contain a HEADED_PASS event (not FIRST_TIME_PASS) for the delivery.
    const headedPassEvent = finalState.eventLog.find(
      (e: { type: string }) => e.type === 'HEADED_PASS',
    );
    expect(headedPassEvent).toBeDefined();
  });

  it('the normal (no flagged contestant) TIE path still resolves to LOOSE_BALL exactly as before — regression check', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

    // Equal aerialAbility, no offside flags — deterministic tie (rollDice mocked to 3).
    room.gameState = {
      ...room.gameState,
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeAttacker.id || p.id === awayDefender.id) return { ...p, aerialAbility: 3 };
        return p;
      }),
    };

    const stateAfterA = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await stateAfterA;

    const stateAfterB = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HEADER_CONTESTANT, [awayDefender.id]);
    const [finalState] = await stateAfterB;

    expect(finalState.phase).toBe('LOOSE_BALL');
    expect(finalState.ball.carrierId).toBeNull();
  });

  it('multiple flagged contestants (one per side) — picks home first per the documented deterministic order, does not crash', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

    // Both nominated contestants are flagged offside — home's contestant should be
    // picked first (scan order: home's list, then away's).
    room.gameState = {
      ...room.gameState,
      offsidePieceIds: [homeAttacker.id, awayDefender.id],
    };

    const stateAfterA = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await stateAfterA;

    const stateAfterB = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HEADER_CONTESTANT, [awayDefender.id]);
    const [finalState] = await stateAfterB;

    expect(finalState.phase).toBe('FREE_KICK_SETUP');
    // Home's contestant was the offender (foul spot = home attacker's position) —
    // possession is awarded to away (D-28), confirming home's id was the one picked.
    expect(finalState.freeKickAttackingTeam).toBe('away');
    // home's offender id was cleared by the foul trigger; away's flagged id (not the
    // chosen offender this time) remains sticky since only the offender is removed.
    expect(finalState.offsidePieceIds).not.toContain(homeAttacker.id);
    expect(finalState.offsidePieceIds).toContain(awayDefender.id);
  });
});

// ---------------------------------------------------------------------------
// RULE-02: GAME_HEADER_TARGET winner guard (D-05)
// ---------------------------------------------------------------------------

describe('RULE-02: GAME_HEADER_TARGET — winner guard replaces attacker guard', () => {
  it('succeeds for the winning team socket (home wins, clientA = home)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedHeaderWithDuelWinner(roomCode, 'home');

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    // clientA = home = winner; target within 6 hexes of home attacker at {q:25,r:12}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_HEADER_TARGET, { q: 28, r: 12 });
    const [state] = await statePromise;

    // Phase should have transitioned away from HEADER
    expect(state.phase).not.toBe('HEADER');
    // header fields cleared
    expect(state.headerDuelWinner == null).toBe(true);
  });

  it('emits GAME_ERROR WRONG_TEAM for the losing team socket (home wins, clientB = away loses)', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedHeaderWithDuelWinner(roomCode, 'home');

    // clientB = 'away' = NOT the winner
    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientB as any).emit(ClientEvents.GAME_HEADER_TARGET, { q: 28, r: 12 });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('emits GAME_ERROR WRONG_TEAM when duelWinner is null (tie — no one can submit)', async () => {
    const { clientA, roomCode } = await setupRoom();
    // Seed with null winner (tie)
    seedHeaderWithDuelWinner(roomCode, 'home');
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    room.gameState = { ...room.gameState, headerDuelWinner: null };

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_HEADER_TARGET, { q: 28, r: 12 });
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });
});

// ---------------------------------------------------------------------------
// RULE-02: header tie → LOOSE_BALL recovery (CR-02 regression coverage)
// ---------------------------------------------------------------------------

describe('RULE-02: header tie → LOOSE_BALL recovery (CR-02)', () => {
  it('transitions to LOOSE_BALL with carrierId null when both contestants have equal heading (deterministic tie)', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedHeaderReadyForContestants(roomCode);

    // Force equal heading on both contestants so that heading + die (3) + 0 = equal raw scores.
    const room = getRoom(roomCode);
    if (!room || !room.gameState) throw new Error('Room not found');
    const homeAttacker = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK');
    const awayDefender = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK');
    if (!homeAttacker || !awayDefender) throw new Error('Required pieces not found');

    // Both contestants get aerialAbility=3; rollDice is mocked to 3; raw score = 3 + 3 = 6 each → tie.
    room.gameState = {
      ...room.gameState,
      pieces: room.gameState.pieces.map((p) => {
        if (p.id === homeAttacker.id || p.id === awayDefender.id) return { ...p, aerialAbility: 3 };
        return p;
      }),
    };

    // clientA (home) confirms first — duel not yet fired
    const stateAfterA = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_HEADER_CONTESTANT, [homeAttacker.id]);
    await stateAfterA;

    // clientB (away) confirms second — bothConfirmed → duel fires → tie → LOOSE_BALL
    const stateAfterB = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_HEADER_CONTESTANT, [awayDefender.id]);
    const [tieState] = await stateAfterB;

    // CR-02 recovery: header tie must transition to LOOSE_BALL (not deadlock in HEADER)
    expect(tieState.phase).toBe('LOOSE_BALL');
    // Loose ball has no carrier
    expect(tieState.ball.carrierId).toBeNull();
    // headerDuelWinner cleared on tie path
    expect(tieState.headerDuelWinner == null).toBe(true);
    // No lingering HEADER phase
    expect(tieState.phase).not.toBe('HEADER');
  });
});
