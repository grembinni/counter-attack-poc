/**
 * Wave 0 socket-level integration tests for the full goal-kick sequence (Phase 37 Plan 09).
 *
 * Covers GOALKICK-01 through GOALKICK-06 (T-37-01) end to end over a real Socket.io
 * server + socket.io-client — no mocking. Structure mirrors throwIn.integration.test.ts
 * (server lifecycle, createClient/oncePromise/waitForConnect/waitForNStates) and seeds
 * restart phases the same way gameHandlers.phase17-06.test.ts's seedFreeKickSetup does:
 * drive to a room, then mutate getRoom(code)!.gameState directly, then emit over the wire.
 *
 * Coverage:
 * - Reposition windows (GOALKICK-02, regression proof for Plan 37-08): per-piece 6-hex
 *   budget, team/eligibility guards, the GK-team-first / opponent-second window handoff.
 * - Choice (GOALKICK-03, regression proof for Plan 37-08): kick vs. standard-pass restart.
 * - Standard Pass unmodified (GOALKICK-04): the 11-hex range is NOT capped by the throw-in
 *   6-hex context (regression guard against Plan 37-06's cap leaking into this path).
 * - Target selection (GOALKICK-05): the Kick must target an outfield teammate's hex ("the
 *   head") — every other target is rejected server-side.
 * - Travel-movement window (GOALKICK-05): 1 piece per team, up to 3 hexes, kicking team first.
 * - Resolution (GOALKICK-04/05): an accurate kick (combined score >= 8) enters HEADER; an
 *   inaccurate kick drops loose and follows the existing out-of-bounds-aware Loose Ball path.
 *
 * Every accuracy-dependent case is made deterministic via the goalkeeper fixture's
 * `highPass` attribute (7 forces accurate, 1 forces inaccurate) — never via dice mocking.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import { computeGoalKickEligibleIds } from '../gameEngine.js';
import type {
  ClientToServerEvents,
  GameState,
  HexCoord,
  PlayerPiece,
  ServerToClientEvents,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents, hexNeighbors, isPitchHex } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors throwIn.integration.test.ts verbatim)
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
// Helpers (mirrors kickoffSetup.integration.test.ts / throwIn.integration.test.ts)
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
 * arrival order. Used for the double-click/double-emit mutex-proof tests, where a
 * second emit still produces a (no-op) snap-back broadcast that a single oncePromise
 * would miss.
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
// Seed helpers — direct room.gameState mutation (mirrors seedFreeKickSetup /
// throwIn.integration.test.ts's seedThrowInSetup family)
//
// Every seed function repositions ALL pieces (not just the ones it names) so no
// default-formation position from setupRoom() can accidentally collide with a
// hex a test relies on being empty/occupied. "Background" pieces are parked in the
// MIDDLE third (q=12 for home, q=13 for away — both inside PITCH_REGIONS' [11,25]
// middle band) spread across every row.
//
// Deliberately NOT parked in either final third (unlike throwIn.integration.test.ts's
// seedThrowContextState, which parks at q=2/34): applyFreeMoveZoneCheck runs centrally
// in broadcastState after every resolved action (MOVE-06) and overlays
// FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE the instant the ball enters a final third AND the
// opposite final third has any occupant. A goal kick's target/travel hexes routinely
// sit inside a final third, so parking background pieces at q=2/34 would spuriously
// trigger that interrupt and hijack the very GOAL_KICK_MOVE/LOOSE_BALL transition under
// test. q=12/13 are also comfortably clear of the q=18..29 Standard-Pass corridor used
// by the "Standard Pass unmodified" test group below.
// ---------------------------------------------------------------------------

const GOAL_KICK_TEAM: 'home' | 'away' = 'home';

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 12 : 13, r: idx % 25 } },
  );
}

/**
 * Seeds GOAL_KICK_SETUP_GK with both reposition windows non-empty: one home
 * outfield piece in the home third (eligible for the GK-team window) and one
 * away outfield piece in the away third (eligible for the opponent window).
 * goalKickEligibleIds is computed via the real computeGoalKickEligibleIds so
 * the fixture matches exactly what triggerOutOfBoundsRestart would produce.
 */
function seedGoalKickSetupGk(
  roomCode: string,
  opts?: { homeStart?: HexCoord; awayStart?: HexCoord },
): {
  gk: PlayerPiece;
  eligibleHomeId: string;
  eligibleHomeStart: HexCoord;
  eligibleHomeNeighbor: HexCoord;
  eligibleAwayId: string;
  eligibleAwayStart: HexCoord;
  // GOALKICK-02 (37-13): derived via hexNeighbors/isPitchHex (never hardcoded) so the
  // coordinate is guaranteed genuinely hexDistance 1 under ODD-Q parity — the same
  // guarantee ELIGIBLE_HOME_NEIGHBOR already relies on. null when the start hex has no
  // off-pitch neighbour (shouldn't happen for the boundary starts these tests pass in,
  // but callers must check before using it — see the new tests below).
  eligibleHomeOffPitchNeighbor: HexCoord | null;
  eligibleAwayOffPitchNeighbor: HexCoord | null;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const gk = room.gameState.pieces.find((p) => p.teamId === GOAL_KICK_TEAM && p.role === 'GK')!;
  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const eligibleHome = homeOutfield[0]!;
  const eligibleAway = awayOutfield[0]!;

  const GK_HEX = { q: 15, r: 13 };
  const ELIGIBLE_HOME_START = opts?.homeStart ?? { q: 5, r: 5 };
  const ELIGIBLE_HOME_NEIGHBOR = hexNeighbors(ELIGIBLE_HOME_START).find((h) => isPitchHex(h))!;
  const ELIGIBLE_HOME_OFF_PITCH_NEIGHBOR =
    hexNeighbors(ELIGIBLE_HOME_START).find((h) => !isPitchHex(h)) ?? null;
  const ELIGIBLE_AWAY_START = opts?.awayStart ?? { q: 30, r: 5 };
  const ELIGIBLE_AWAY_OFF_PITCH_NEIGHBOR =
    hexNeighbors(ELIGIBLE_AWAY_START).find((h) => !isPitchHex(h)) ?? null;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === gk.id) return { ...p, position: GK_HEX };
    if (p.id === eligibleHome.id) return { ...p, position: ELIGIBLE_HOME_START };
    if (p.id === eligibleAway.id) return { ...p, position: ELIGIBLE_AWAY_START };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([gk.id, eligibleHome.id, eligibleAway.id]));

  const goalKickEligibleIds = computeGoalKickEligibleIds(pieces, GOAL_KICK_TEAM);

  room.gameState = {
    ...room.gameState,
    phase: 'GOAL_KICK_SETUP_GK',
    outOfBoundsEnabled: true,
    pieces,
    goalKickTeam: GOAL_KICK_TEAM,
    goalKickGkId: gk.id,
    goalKickEligibleIds,
    goalKickUsedPace: {},
    goalKickTargetHex: null,
    goalKickMoveSlot: null,
    goalKickMovedPieceId: null,
    goalKickPaceUsed: 0,
    movedPieceIds: [],
    attackingTeam: GOAL_KICK_TEAM,
    activeTeam: GOAL_KICK_TEAM,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: GK_HEX,
      carrierId: gk.id,
      lastTouchedBy: { pieceId: gk.id, teamId: GOAL_KICK_TEAM },
    },
  };

  return {
    gk: { ...gk, position: GK_HEX },
    eligibleHomeId: eligibleHome.id,
    eligibleHomeStart: ELIGIBLE_HOME_START,
    eligibleHomeNeighbor: ELIGIBLE_HOME_NEIGHBOR,
    eligibleAwayId: eligibleAway.id,
    eligibleAwayStart: ELIGIBLE_AWAY_START,
    eligibleHomeOffPitchNeighbor: ELIGIBLE_HOME_OFF_PITCH_NEIGHBOR,
    eligibleAwayOffPitchNeighbor: ELIGIBLE_AWAY_OFF_PITCH_NEIGHBOR,
  };
}

/** Seeds GOAL_KICK_CHOICE with the ball held by the goal-kicking team's GK. */
function seedGoalKickChoice(roomCode: string): { gk: PlayerPiece } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const gk = room.gameState.pieces.find((p) => p.teamId === GOAL_KICK_TEAM && p.role === 'GK')!;
  const GK_HEX = { q: 15, r: 13 };

  const pieces = parkBackgroundPieces(
    room.gameState.pieces.map((p) => (p.id === gk.id ? { ...p, position: GK_HEX } : p)),
    new Set([gk.id]),
  );

  room.gameState = {
    ...room.gameState,
    phase: 'GOAL_KICK_CHOICE',
    outOfBoundsEnabled: true,
    pieces,
    goalKickTeam: GOAL_KICK_TEAM,
    goalKickGkId: gk.id,
    goalKickEligibleIds: null,
    goalKickUsedPace: null,
    goalKickTargetHex: null,
    goalKickMoveSlot: null,
    goalKickMovedPieceId: null,
    goalKickPaceUsed: 0,
    attackingTeam: GOAL_KICK_TEAM,
    activeTeam: GOAL_KICK_TEAM,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: GK_HEX,
      carrierId: gk.id,
      lastTouchedBy: { pieceId: gk.id, teamId: GOAL_KICK_TEAM },
    },
  };

  return { gk: { ...gk, position: GK_HEX } };
}

/** Pitch-centre hex used as the GK's carrier position for the "Standard Pass unmodified" group. */
const RESTART_CARRIER_HEX = { q: 18, r: 13 };
/**
 * Exactly 11 hexes from RESTART_CARRIER_HEX along the same row (same derivation approach
 * as throwIn.integration.test.ts's SIX_HEX_TARGET: verified via toCube/fromCube — same-row,
 * +N columns from an even-q base equals a hex distance of N).
 */
const RESTART_TARGET_11_HEX = { q: 29, r: 13 };

/**
 * Seeds a PASS-phase state with lastActionType: 'GOAL_KICK_RESTART' (the 'standard' choice
 * outcome) and the GK carrying the ball at RESTART_CARRIER_HEX — the state
 * applyGoalKickChoice's 'standard' branch produces.
 */
function seedGoalKickRestart(roomCode: string): { gk: PlayerPiece } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const gk = room.gameState.pieces.find((p) => p.teamId === GOAL_KICK_TEAM && p.role === 'GK')!;

  const pieces = parkBackgroundPieces(
    room.gameState.pieces.map((p) =>
      p.id === gk.id ? { ...p, position: RESTART_CARRIER_HEX } : p,
    ),
    new Set([gk.id]),
  );

  room.gameState = {
    ...room.gameState,
    phase: 'PASS',
    outOfBoundsEnabled: true,
    pieces,
    attackingTeam: GOAL_KICK_TEAM,
    activeTeam: GOAL_KICK_TEAM,
    kickOffActive: false,
    lastActionType: 'GOAL_KICK_RESTART',
    lastDiceRoll: null,
    passTargetHex: null,
    stealAttemptedByIds: [],
    tackleAttemptedByIds: [],
    goalKickTeam: null,
    goalKickGkId: null,
    goalKickEligibleIds: null,
    goalKickUsedPace: null,
    goalKickTargetHex: null,
    goalKickMoveSlot: null,
    goalKickMovedPieceId: null,
    goalKickPaceUsed: 0,
    ball: {
      position: RESTART_CARRIER_HEX,
      carrierId: gk.id,
      lastTouchedBy: { pieceId: gk.id, teamId: GOAL_KICK_TEAM },
    },
  };

  return { gk: { ...gk, position: RESTART_CARRIER_HEX } };
}

/**
 * Seeds GOAL_KICK_TARGET: the GK holds the ball, an outfield teammate stands at
 * `targetTeammateHex` (the valid Kick target), an opposing piece stands at
 * `opposingHex`, and `emptyHex`/`offPitchHex` are guaranteed clear/off-pitch.
 */
function seedGoalKickTarget(roomCode: string): {
  gk: PlayerPiece;
  targetTeammateHex: HexCoord;
  opposingHex: HexCoord;
  emptyHex: HexCoord;
  offPitchHex: HexCoord;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const gk = room.gameState.pieces.find((p) => p.teamId === GOAL_KICK_TEAM && p.role === 'GK')!;
  const targetTeammate = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
  const opposingPiece = room.gameState.pieces.find((p) => p.teamId === 'away')!;

  const GK_HEX = { q: 15, r: 13 };
  const TARGET_TEAMMATE_HEX = { q: 5, r: 10 };
  const OPPOSING_HEX = { q: 30, r: 10 };
  const EMPTY_HEX = { q: 19, r: 13 };
  const OFF_PITCH_HEX = { q: 100, r: 100 };

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === gk.id) return { ...p, position: GK_HEX };
    if (p.id === targetTeammate.id) return { ...p, position: TARGET_TEAMMATE_HEX };
    if (p.id === opposingPiece.id) return { ...p, position: OPPOSING_HEX };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([gk.id, targetTeammate.id, opposingPiece.id]));

  room.gameState = {
    ...room.gameState,
    phase: 'GOAL_KICK_TARGET',
    outOfBoundsEnabled: true,
    pieces,
    goalKickTeam: GOAL_KICK_TEAM,
    goalKickGkId: gk.id,
    goalKickEligibleIds: null,
    goalKickUsedPace: null,
    goalKickTargetHex: null,
    goalKickMoveSlot: null,
    goalKickMovedPieceId: null,
    goalKickPaceUsed: 0,
    attackingTeam: GOAL_KICK_TEAM,
    activeTeam: GOAL_KICK_TEAM,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: GK_HEX,
      carrierId: gk.id,
      lastTouchedBy: { pieceId: gk.id, teamId: GOAL_KICK_TEAM },
    },
  };

  return {
    gk: { ...gk, position: GK_HEX },
    targetTeammateHex: TARGET_TEAMMATE_HEX,
    opposingHex: OPPOSING_HEX,
    emptyHex: EMPTY_HEX,
    offPitchHex: OFF_PITCH_HEX,
  };
}

/**
 * Seeds GOAL_KICK_MOVE in the KICKER slot: the ball is airborne at `targetHex`, where
 * an outfield home teammate stands (trivially header-eligible at distance 0 — used by
 * the resolution tests below), and a separate `moverPieceId` is placed at `moverStart`
 * with a verified on-pitch `moverNeighbor` for the travel-movement-window tests.
 * `highPass` (optional) overrides the GK's attribute for deterministic accuracy:
 * 7 forces `accurate === true` for any die; 1 forces `accurate === false` for any die.
 */
function seedGoalKickMoveKicker(
  roomCode: string,
  opts?: { highPass?: number },
): {
  gk: PlayerPiece;
  targetHex: HexCoord;
  moverPieceId: string;
  moverStart: HexCoord;
  moverNeighbor: HexCoord;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const originalGk = room.gameState.pieces.find(
    (p) => p.teamId === GOAL_KICK_TEAM && p.role === 'GK',
  )!;
  const gk = opts?.highPass !== undefined ? { ...originalGk, highPass: opts.highPass } : originalGk;

  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const targetTeammate = homeOutfield[0]!;
  const mover = homeOutfield[1]!;

  const GK_HEX = { q: 15, r: 13 };
  const TARGET_HEX = { q: 10, r: 8 };
  const MOVER_START = { q: 5, r: 5 };
  const MOVER_NEIGHBOR = hexNeighbors(MOVER_START).find((h) => isPitchHex(h))!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === originalGk.id) return gk;
    if (p.id === targetTeammate.id) return { ...p, position: TARGET_HEX };
    if (p.id === mover.id) return { ...p, position: MOVER_START };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([gk.id, targetTeammate.id, mover.id]));
  // GK position doesn't participate in any assertion for this seed family — park it
  // off-corridor too, distinct from the travel-window/target-hex geometry above.
  pieces = pieces.map((p) => (p.id === gk.id ? { ...p, position: GK_HEX } : p));

  room.gameState = {
    ...room.gameState,
    phase: 'GOAL_KICK_MOVE',
    outOfBoundsEnabled: true,
    pieces,
    goalKickTeam: GOAL_KICK_TEAM,
    goalKickGkId: gk.id,
    goalKickEligibleIds: null,
    goalKickUsedPace: null,
    goalKickTargetHex: TARGET_HEX,
    goalKickMoveSlot: 'KICKER',
    goalKickMovedPieceId: null,
    goalKickPaceUsed: 0,
    attackingTeam: GOAL_KICK_TEAM,
    activeTeam: GOAL_KICK_TEAM,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: TARGET_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: gk.id, teamId: GOAL_KICK_TEAM },
    },
  };

  return {
    gk,
    targetHex: TARGET_HEX,
    moverPieceId: mover.id,
    moverStart: MOVER_START,
    moverNeighbor: MOVER_NEIGHBOR,
  };
}

// ---------------------------------------------------------------------------
// Reposition windows (GOALKICK-02, regression proof for Plan 37-08)
// ---------------------------------------------------------------------------

describe('GOALKICK-02: reposition windows (regression proof for Plan 37-08)', () => {
  it('the goal-kicking team moving an eligible final-third piece one hex updates goalKickUsedPace', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId, eligibleHomeStart, eligibleHomeNeighbor } =
      seedGoalKickSetupGk(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, eligibleHomeNeighbor);
    const [state] = await statePromise;

    const moved = state.pieces.find((p) => p.id === eligibleHomeId)!;
    expect(moved.position).toEqual(eligibleHomeNeighbor);
    expect(moved.position).not.toEqual(eligibleHomeStart);
    expect(state.goalKickUsedPace?.[eligibleHomeId]).toBe(1);
  });

  it('the opposing team moving during GOAL_KICK_SETUP_GK receives GAME_ERROR and the phase is unchanged', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { eligibleAwayId } = seedGoalKickSetupGk(roomCode);
    const awayPiece = getRoom(roomCode)!.gameState!.pieces.find((p) => p.id === eligibleAwayId)!;
    const anyNeighbor = hexNeighbors(awayPiece.position).find((h) => isPitchHex(h))!;

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, eligibleAwayId, anyNeighbor);
    await errorPromise;

    expect(getRoom(roomCode)!.gameState!.phase).toBe('GOAL_KICK_SETUP_GK');
  });

  it('six successive single-hex moves on one eligible piece all succeed; the seventh is rejected', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId, eligibleHomeStart, eligibleHomeNeighbor } =
      seedGoalKickSetupGk(roomCode);

    // Oscillate between the start hex and its neighbor: A->B->A->B->A->B (6 moves,
    // budget 1..6), then the 7th attempted move (B->A again, budget would be 7) is rejected.
    const targets = [
      eligibleHomeNeighbor,
      eligibleHomeStart,
      eligibleHomeNeighbor,
      eligibleHomeStart,
      eligibleHomeNeighbor,
      eligibleHomeStart,
      eligibleHomeNeighbor,
    ];

    for (let i = 0; i < 6; i++) {
      const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, targets[i]!);
      const [state] = await statePromise;
      expect(state.goalKickUsedPace?.[eligibleHomeId]).toBe(i + 1);
    }

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, targets[6]!);
    const [reason] = await errorPromise;
    // Wire value is the generic ApplyMoveResult reason ('MOVE_INVALID') — the handler
    // emits `result.reason`, not `result.detail` ('GOAL_KICK_PACE_EXHAUSTED'). This
    // mirrors the pre-existing FREE_MOVE_ATTACK/DEFENSE branch's identical behavior
    // (Plan 37-08), not a regression introduced by this plan — see SUMMARY deviations.
    expect(reason).toBe('MOVE_INVALID');
    expect(getRoom(roomCode)!.gameState!.goalKickUsedPace?.[eligibleHomeId]).toBe(6);
  });

  it('GAME_END_TURN advances GK-team window -> opponent window -> GOAL_KICK_CHOICE, flipping activeTeam each step', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedGoalKickSetupGk(roomCode);

    const p1 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [afterFirst] = await p1;
    expect(afterFirst.phase).toBe('GOAL_KICK_SETUP_OPPONENT');
    expect(afterFirst.activeTeam).toBe('away');

    // Listen on clientA throughout (matches kickoffSetup.integration.test.ts's
    // stale-buffer guidance, also followed by throwIn.integration.test.ts's
    // driveMovementPhaseToEnd): broadcastState sends to both clients, so listening
    // on clientB here would risk catching the still-in-flight broadcast from the
    // FIRST end turn rather than the second one.
    const p2 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [afterSecond] = await p2;
    expect(afterSecond.phase).toBe('GOAL_KICK_CHOICE');
    expect(afterSecond.activeTeam).toBe('home');
  });

  // -------------------------------------------------------------------------
  // GOALKICK-02 (37-13): socket-level regression coverage for the reposition
  // GAME_MOVE branch's on-pitch bounds guard. The pre-existing 'an off-pitch hex
  // is rejected with OFF_PITCH' test (below, ~line 785) exercises
  // GAME_GOAL_KICK_TARGET only — a different function entirely — which is
  // precisely the coverage hole 37-VERIFICATION.md identified.
  //
  // Seeded at the q=0/q=36 boundary columns via seedGoalKickSetupGk's opts
  // param: {0,5} is q<=10 -> homeThird, {36,5} is q>=26 -> awayThird, so both
  // are inside their eligibility regions. Both are clear of the parked
  // background pieces (q=12/13) and GK_HEX ({q:15,r:13}); the ball stays at
  // {q:15,r:13} in the middle third throughout, so applyFreeMoveZoneCheck
  // cannot fire and hijack the phase under test (see the seed-helpers comment
  // above this describe block).
  // -------------------------------------------------------------------------

  const BOUNDARY_SEED_OPTS = { homeStart: { q: 0, r: 5 }, awayStart: { q: 36, r: 5 } };

  it('an off-pitch hex is rejected with OFF_PITCH (GOAL_KICK_SETUP_GK reposition GAME_MOVE branch)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId, eligibleHomeOffPitchNeighbor } = seedGoalKickSetupGk(
      roomCode,
      BOUNDARY_SEED_OPTS,
    );
    expect(eligibleHomeOffPitchNeighbor).not.toBeNull();

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, eligibleHomeOffPitchNeighbor!);
    const [reason] = await errorPromise;

    expect(reason).toBe('OFF_PITCH');
  });

  it('the OFF_PITCH rejection is fully non-mutating (phase, position, pace, movedPieceIds, eventLog)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId, eligibleHomeOffPitchNeighbor } = seedGoalKickSetupGk(
      roomCode,
      BOUNDARY_SEED_OPTS,
    );
    expect(eligibleHomeOffPitchNeighbor).not.toBeNull();
    const beforeEventLogLength = getRoom(roomCode)!.gameState!.eventLog.length;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, eligibleHomeOffPitchNeighbor!);
    const [reason] = await errorPromise;
    expect(reason).toBe('OFF_PITCH');

    // Read the authoritative state back directly (not the broadcast payload).
    const state = getRoom(roomCode)!.gameState!;
    expect(state.phase).toBe('GOAL_KICK_SETUP_GK');
    const piece = state.pieces.find((p) => p.id === eligibleHomeId)!;
    expect(piece.position).toEqual({ q: 0, r: 5 });
    expect(state.goalKickUsedPace?.[eligibleHomeId] ?? 0).toBe(0);
    expect(state.movedPieceIds).toEqual([]);
    expect(state.eventLog).toHaveLength(beforeEventLogLength);
    expect(state.eventLog.some((e) => e.type === 'MOVE')).toBe(false);
  });

  it('an off-pitch hex is rejected with OFF_PITCH (GOAL_KICK_SETUP_OPPONENT reposition GAME_MOVE branch)', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { eligibleAwayId, eligibleAwayOffPitchNeighbor } = seedGoalKickSetupGk(
      roomCode,
      BOUNDARY_SEED_OPTS,
    );
    expect(eligibleAwayOffPitchNeighbor).not.toBeNull();

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [afterFirst] = await statePromise;
    expect(afterFirst.phase).toBe('GOAL_KICK_SETUP_OPPONENT');
    expect(afterFirst.activeTeam).toBe('away');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, eligibleAwayId, eligibleAwayOffPitchNeighbor!);
    const [reason] = await errorPromise;

    expect(reason).toBe('OFF_PITCH');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('GOAL_KICK_SETUP_OPPONENT');
  });

  it('a boundary-seeded home piece moving to its first on-pitch neighbour still succeeds', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId, eligibleHomeNeighbor } = seedGoalKickSetupGk(
      roomCode,
      BOUNDARY_SEED_OPTS,
    );

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, eligibleHomeNeighbor);
    const [state] = await statePromise;

    const moved = state.pieces.find((p) => p.id === eligibleHomeId)!;
    expect(moved.position).toEqual(eligibleHomeNeighbor);
    expect(state.goalKickUsedPace?.[eligibleHomeId]).toBe(1);
  });

  it('a non-object GAME_MOVE payload is rejected with INVALID_TARGET, not OFF_PITCH, and does not throw (D-13-04)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId } = seedGoalKickSetupGk(roomCode, BOUNDARY_SEED_OPTS);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // Intentionally malformed payload (attacker-controlled) — proves isPitchHex
    // never sees a non-object, since the shape check strictly precedes it (D-13-04).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_MOVE, eligibleHomeId, 12345);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
  });
});

// ---------------------------------------------------------------------------
// Choice (GOALKICK-03, regression proof for Plan 37-08)
// ---------------------------------------------------------------------------

describe('GOALKICK-03: GAME_GOAL_KICK_CHOICE (regression proof for Plan 37-08)', () => {
  it("'kick' advances to GOAL_KICK_TARGET", async () => {
    const { clientA, roomCode } = await setupRoom();
    seedGoalKickChoice(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GOAL_KICK_CHOICE, 'kick');
    const [state] = await statePromise;

    expect(state.phase).toBe('GOAL_KICK_TARGET');
  });

  it("'standard' reaches PASS with lastActionType GOAL_KICK_RESTART and the GK carrying the ball", async () => {
    const { clientA, roomCode } = await setupRoom();
    const { gk } = seedGoalKickChoice(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GOAL_KICK_CHOICE, 'standard');
    const [state] = await statePromise;

    expect(state.phase).toBe('PASS');
    expect(state.lastActionType).toBe('GOAL_KICK_RESTART');
    expect(state.ball.carrierId).toBe(gk.id);
  });

  it('the opposing team choosing receives WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedGoalKickChoice(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_GOAL_KICK_CHOICE, 'kick');
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('GOAL_KICK_CHOICE');
  });
});

// ---------------------------------------------------------------------------
// GOALKICK-04: the Standard Pass branch keeps its unmodified 11-hex range
// ---------------------------------------------------------------------------

describe('GOALKICK-04: Standard Pass branch is unmodified (no throw-in cap leak)', () => {
  it('an 11-hex Standard Pass from GOAL_KICK_RESTART is accepted', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedGoalKickRestart(roomCode);

    let errorReceived: string | null = null;
    const errorListener = (err: string): void => {
      errorReceived = err;
    };
    clientA.on(ServerEvents.GAME_ERROR, errorListener);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', RESTART_TARGET_11_HEX);
    await statePromise;
    clientA.off(ServerEvents.GAME_ERROR, errorListener);

    expect(errorReceived).toBeNull();
    const passEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'STANDARD_PASS',
    );
    expect(passEvents).toHaveLength(1);
  });

  it('GOALKICK-04: a HIGH_PASS from GOAL_KICK_RESTART is rejected with INVALID_SEQUENCE (only STANDARD_PASS is eligible)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedGoalKickRestart(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', RESTART_TARGET_11_HEX);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_SEQUENCE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// Target selection (GOALKICK-05)
// ---------------------------------------------------------------------------

describe('GOALKICK-05: GAME_GOAL_KICK_TARGET', () => {
  it('an empty on-pitch hex is rejected with INVALID_TARGET and the phase stays GOAL_KICK_TARGET', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { emptyHex } = seedGoalKickTarget(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_GOAL_KICK_TARGET, emptyHex);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('GOAL_KICK_TARGET');
  });

  it('a hex occupied by an opposing piece is rejected with INVALID_TARGET', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { opposingHex } = seedGoalKickTarget(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_GOAL_KICK_TARGET, opposingHex);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
  });

  it("the goalkeeper's own hex is rejected with INVALID_TARGET", async () => {
    const { clientA, roomCode } = await setupRoom();
    const { gk } = seedGoalKickTarget(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_GOAL_KICK_TARGET, gk.position);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
  });

  it('an off-pitch hex is rejected with OFF_PITCH', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { offPitchHex } = seedGoalKickTarget(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_GOAL_KICK_TARGET, offPitchHex);
    const [reason] = await errorPromise;

    expect(reason).toBe('OFF_PITCH');
  });

  it('emitted by the opposing team is rejected with WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { targetTeammateHex } = seedGoalKickTarget(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_GOAL_KICK_TARGET, targetTeammateHex);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
  });

  it('a non-object payload is rejected with INVALID_TARGET and does not mutate the phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedGoalKickTarget(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_GOAL_KICK_TARGET, 12345);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('GOAL_KICK_TARGET');
  });

  it('a hex occupied by an outfield teammate transitions to GOAL_KICK_MOVE with the ball in the air', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { targetTeammateHex } = seedGoalKickTarget(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_GOAL_KICK_TARGET, targetTeammateHex);
    const [state] = await statePromise;

    expect(state.phase).toBe('GOAL_KICK_MOVE');
    expect(state.ball.position).toEqual(targetTeammateHex);
    expect(state.ball.carrierId).toBeNull();
    expect(state.goalKickMoveSlot).toBe('KICKER');
  });

  it('two target emissions fired back to back leave the state in GOAL_KICK_MOVE exactly once (mutex proof)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { targetTeammateHex } = seedGoalKickTarget(roomCode);

    const statesPromise = waitForNStates(clientA, 2);
    clientA.emit(ClientEvents.GAME_GOAL_KICK_TARGET, targetTeammateHex);
    clientA.emit(ClientEvents.GAME_GOAL_KICK_TARGET, targetTeammateHex);
    const states = await statesPromise;

    expect(states[states.length - 1]!.phase).toBe('GOAL_KICK_MOVE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('GOAL_KICK_MOVE');
    expect(getRoom(roomCode)!.gameState!.goalKickMoveSlot).toBe('KICKER');
  });
});

// ---------------------------------------------------------------------------
// Travel-movement window (GOALKICK-05)
// ---------------------------------------------------------------------------

describe('GOALKICK-05: the GOAL_KICK_MOVE travel-movement window', () => {
  it('three successive single-hex moves on one piece succeed; the fourth is rejected with PACE_EXCEEDED', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { moverPieceId, moverStart, moverNeighbor } = seedGoalKickMoveKicker(roomCode);

    // Oscillate start<->neighbor for 3 successful moves (budget 1..3), then a 4th
    // attempted move (budget would be 4) is rejected.
    const targets = [moverNeighbor, moverStart, moverNeighbor, moverStart];
    for (let i = 0; i < 3; i++) {
      const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      clientA.emit(ClientEvents.GAME_MOVE, moverPieceId, targets[i]!);
      const [state] = await statePromise;
      expect(state.goalKickPaceUsed).toBe(i + 1);
    }

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, moverPieceId, targets[3]!);
    const [reason] = await errorPromise;
    expect(reason).toBe('PACE_EXCEEDED');
  });

  it('a second, different piece is rejected with WRONG_PIECE once the slot is locked', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { moverPieceId, moverNeighbor } = seedGoalKickMoveKicker(roomCode);
    const otherHomePiece = getRoom(roomCode)!.gameState!.pieces.find(
      (p) => p.teamId === 'home' && p.role !== 'GK' && p.id !== moverPieceId,
    )!;
    const otherNeighbor = hexNeighbors(otherHomePiece.position).find((h) => isPitchHex(h))!;

    const lockPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, moverPieceId, moverNeighbor);
    await lockPromise;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, otherHomePiece.id, otherNeighbor);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_PIECE');
  });

  it('a 2-hex click is rejected with NOT_ADJACENT', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { moverPieceId, moverStart } = seedGoalKickMoveKicker(roomCode);
    const twoHexAway = { q: moverStart.q + 2, r: moverStart.r };

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, moverPieceId, twoHexAway);
    const [reason] = await errorPromise;
    expect(reason).toBe('NOT_ADJACENT');
  });

  it('the opposing team moving during the KICKER slot is rejected with WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedGoalKickMoveKicker(roomCode);
    const awayPiece = getRoom(roomCode)!.gameState!.pieces.find((p) => p.teamId === 'away')!;
    const anyNeighbor = hexNeighbors(awayPiece.position).find((h) => isPitchHex(h))!;

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, awayPiece.id, anyNeighbor);
    const [reason] = await errorPromise;
    expect(reason).toBe('WRONG_TEAM');
  });

  it('GAME_END_TURN flips the slot to OPP and activeTeam to the opposing team, resetting goalKickMovedPieceId', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { moverPieceId, moverNeighbor } = seedGoalKickMoveKicker(roomCode);

    const movePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, moverPieceId, moverNeighbor);
    await movePromise;

    const endTurnPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [state] = await endTurnPromise;

    expect(state.goalKickMoveSlot).toBe('OPP');
    expect(state.activeTeam).toBe('away');
    expect(state.goalKickMovedPieceId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resolution (GOALKICK-04 and GOALKICK-05)
// ---------------------------------------------------------------------------

describe('GOALKICK-04/05: accuracy resolution after both travel-movement slots', () => {
  it('an accurate kick (highPass: 7) enters HEADER with headerAccuracyRollPending true and no ball carrier', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedGoalKickMoveKicker(roomCode, { highPass: 7 });

    const p1 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN); // KICKER -> OPP
    await p1;

    // Listen on clientA throughout (stale-buffer guidance — see the reposition-window
    // GAME_END_TURN test above for the full explanation).
    const p2 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN); // OPP -> resolution
    const [state] = await p2;

    expect(state.phase).toBe('HEADER');
    expect(state.headerAccuracyRollPending).toBe(true);
    expect(state.ball.carrierId).toBeNull();
    const kickEvent = state.eventLog.find((e) => e.type === 'GOAL_KICK');
    expect(kickEvent).toBeDefined();
    if (kickEvent?.type === 'GOAL_KICK') {
      expect(kickEvent.accurate).toBe(true);
    }
    expect(state.goalKickTeam).toBeNull();
    expect(state.goalKickGkId).toBeNull();
    expect(state.goalKickTargetHex).toBeNull();
    expect(state.goalKickMoveSlot).toBeNull();
    expect(state.goalKickMovedPieceId).toBeNull();
  });

  it('an inaccurate kick (highPass: 1) drops loose at the target with lastActionType DEFLECTION', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { targetHex } = seedGoalKickMoveKicker(roomCode, { highPass: 1 });

    const p1 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN); // KICKER -> OPP
    await p1;

    // Listen on clientA throughout (stale-buffer guidance — see the reposition-window
    // GAME_END_TURN test above for the full explanation).
    const p2 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN); // OPP -> resolution
    const [state] = await p2;

    expect(state.phase).toBe('LOOSE_BALL');
    expect(state.lastActionType).toBe('DEFLECTION');
    expect(state.ball.position).toEqual(targetHex);
    const kickEvent = state.eventLog.find((e) => e.type === 'GOAL_KICK');
    expect(kickEvent).toBeDefined();
    if (kickEvent?.type === 'GOAL_KICK') {
      expect(kickEvent.accurate).toBe(false);
    }
    expect(state.goalKickTeam).toBeNull();
    expect(state.goalKickGkId).toBeNull();
    expect(state.goalKickTargetHex).toBeNull();
    expect(state.goalKickMoveSlot).toBeNull();
    expect(state.goalKickMovedPieceId).toBeNull();
  });

  it('GOALKICK-04/D-04: following an inaccurate resolution, GAME_ROLL scatters the loose ball through the shared out-of-bounds-aware clamp', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedGoalKickMoveKicker(roomCode, { highPass: 1 });

    const p1 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    await p1;
    // Listen on clientA throughout (stale-buffer guidance).
    const p2 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [afterKick] = await p2;
    expect(afterKick.phase).toBe('LOOSE_BALL');
    // Teardown set activeTeam back to the goal-kicking team ('home') — clientA rolls.
    expect(afterKick.activeTeam).toBe('home');

    const rollPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL);
    const [finalState] = await rollPromise;

    // Any of the 3 LOOSE_BALL outcomes is a valid resolution of the shared clamp —
    // this test proves the goal kick's Loose Ball drop reuses that system unmodified,
    // not any specific outcome. D-10 (Phase 39, 39-15): a scatter landing INSIDE a
    // penalty area is also a legitimate "first entry" trigger for the new box-entry GK
    // offer (D-10 explicitly includes "loose ball" among its means of entry) — a real,
    // deterministic-per-dice-roll outcome discovered running this suite after wiring
    // the offer hook into broadcastState, not a defect in either mechanism.
    expect(['PASS', 'THROW_IN_SETUP', 'GOAL_KICK_SETUP_GK', 'GK_BOX_ENTRY_PROMPT']).toContain(
      finalState.phase,
    );
    // The completed kick's travel-window fields are cleared regardless of outcome —
    // goalKickTeam/goalKickGkId are excluded from this check because a byline exit
    // legitimately re-populates them with a brand-new goal kick (GOAL_KICK_SETUP_GK).
    expect(finalState.goalKickTargetHex).toBeNull();
    expect(finalState.goalKickMoveSlot).toBeNull();
    expect(finalState.goalKickMovedPieceId).toBeNull();
  });
});
