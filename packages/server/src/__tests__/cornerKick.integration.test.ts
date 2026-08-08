/**
 * Wave 0 socket-level integration tests for the full corner-kick sequence (Phase 38 Plan 08).
 *
 * Covers OOB-03 and CORNER-01 through CORNER-06 end to end over a real Socket.io server +
 * socket.io-client — no mocking. Structure mirrors goalKick.integration.test.ts (server
 * lifecycle, createClient/oncePromise/waitForConnect/setupRoom) and throwIn.integration
 * .test.ts's seedLooseBallForReclassification (real out-of-bounds trigger via a retried
 * random dice roll, never a mocked die). Every step is driven through the real socket
 * handlers registered in gameHandlers.ts — this file never calls an `applyCornerKick*`
 * engine function directly.
 *
 * The unit suites in 38-02..38-06 each verify one function or one component in isolation.
 * This file exists to catch the recurring failure mode where a new phase works
 * function-by-function but is unreachable end to end because a registration list or
 * handler branch was missed (see gameHandlers.ts's ZONE_CHECK_EXEMPT_PHASES Rule 2 fix
 * documented in 38-05-SUMMARY.md, discovered by exactly this kind of test).
 *
 * Coverage:
 * - OOB-03: a home-byline exit after a home touch is classified CORNER_KICK and awarded
 *   to the OPPOSITE team (away) — driven through a real LOOSE_BALL scatter roll, retried
 *   until an exiting direction is rolled (real crypto randomness, never mocked). The
 *   `outOfBoundsEnabled` toggle-off case is asserted as a sibling test.
 * - CORNER-01: the two GK reposition windows (attacking GK first, then defending GK),
 *   turn-guarded, End Turn advancing GK_SETUP_ATTACKING -> GK_SETUP_DEFENDING -> TAKER_SELECT.
 * - CORNER-02: corner-taker selection places the taker (and the ball) at the fixed corner
 *   hex and enters the CORNER-03 window at stage 0.
 * - CORNER-03: the 6-stage alternating reposition window — turn order per stage,
 *   out-of-turn End Turn rejection, the 2-distinct-piece-per-stage cap, and the per-piece
 *   6-hex cumulative budget that persists (never resets) across all 6 stages.
 * - CORNER-06: the pre-kick 1-piece/team <=3-hex final setup window, attacking first,
 *   resolving into PASS with lastActionType CORNER_KICK_RESTART.
 * - CORNER-04/CORNER-05: kick resolution — the penalty-area-conditional unlimited High
 *   Pass range, an accurate High Pass forcing a HEADER, an accurate Low Pass delivering
 *   without one, an inaccurate kick of either type dropping a Loose Ball, and the corner
 *   context (and its Low-pass accuracy gate) tearing down cleanly so a later, ordinary
 *   pass is never accuracy-gated by stale corner state.
 *
 * Every accuracy-dependent resolution case is made deterministic via the corner taker's
 * `highPass` attribute (7 forces accurate for any die, 1 forces inaccurate for any die) —
 * never via dice mocking, mirroring goalKick.integration.test.ts's approach exactly.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms, getRoom } from '../roomStore.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import type {
  ClientToServerEvents,
  GameState,
  HexCoord,
  PlayerPiece,
  ServerToClientEvents,
} from '@counter-attack/shared';
import {
  ClientEvents,
  ServerEvents,
  cornerKickStageTeam,
  hexDistance,
  hexNeighbors,
  isInRegion,
  isPitchHex,
} from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors goalKick.integration.test.ts / throwIn.integration.test.ts)
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
// Helpers (mirrors goalKick.integration.test.ts / throwIn.integration.test.ts verbatim)
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
// Seed helpers — direct room.gameState mutation (mirrors goalKick.integration.test.ts /
// gameHandlers.cornerKick.test.ts's established seed pattern). Every seed function parks
// every piece it does not care about in the pitch's MIDDLE third (q=12 home / q=13 away),
// including both goalkeepers — a corner's fixed taker hex and resolution PASS phase both
// sit near a byline (a final third), and PASS is NOT one of gameEngine.ts's
// ZONE_CHECK_EXEMPT_PHASES, so a default-formation GK left in its own final third would
// spuriously trigger applyFreeMoveZoneCheck's FREE_MOVE_ATTACK/DEFENSE overlay on the very
// first broadcast (see goalKick.integration.test.ts's identical parkBackgroundPieces note
// and 38-05-SUMMARY.md's Rule 2 fix for the five CORNER_KICK_* setup phases themselves).
// ---------------------------------------------------------------------------

/**
 * The team awarded the corner in every directly-seeded (non-trigger) test in this file.
 * Matches the real inversion OOB-03 produces for a home-byline exit after a home touch
 * (see the OOB-03 describe block below, which proves this via the real trigger).
 */
const CORNER_KICK_TEAM: 'home' | 'away' = 'away';
/** Fixed corner-taker hex — the nearer of CORNER_KICK_HEX.home's two candidates. */
const CORNER_HEX: HexCoord = { q: 0, r: 1 };
/** A hex on the home byline, well clear of both corners (r stays central). */
const HOME_BYLINE_LOOSE_BALL_HEX: HexCoord = { q: 0, r: 13 };

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 12 : 13, r: idx % 25 } },
  );
}

/**
 * Returns a free, on-pitch neighbour of `pos` given the current piece list — used by the
 * 6-stage walk test so each move target is derived from the piece's CURRENT (possibly
 * already-moved) position rather than a value computed once and reused stale.
 */
function freeNeighbor(state: GameState, pos: HexCoord): HexCoord {
  return hexNeighbors(pos).find(
    (h) => isPitchHex(h) && !state.pieces.some((p) => p.position.q === h.q && p.position.r === h.r),
  )!;
}

/**
 * Seeds LOOSE_BALL with the ball on the home byline row, `outOfBoundsEnabled` per `opts`,
 * and `lastTouchedBy` recording a HOME player (the defending touch that, per
 * classifyOutOfBounds, produces a CORNER_KICK restart awarded to the OPPOSITE team).
 * Mirrors throwIn.integration.test.ts's seedLooseBallForReclassification exactly.
 */
function seedCornerKickLooseBall(
  roomCode: string,
  opts?: { outOfBoundsEnabled?: boolean },
): { homeToucherId: string } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeToucher = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;

  room.gameState = {
    ...room.gameState,
    phase: 'LOOSE_BALL',
    outOfBoundsEnabled: opts?.outOfBoundsEnabled ?? true,
    attackingTeam: 'home',
    activeTeam: 'home',
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    cornerKickTeam: null,
    cornerKickHex: null,
    cornerKickTakerId: null,
    cornerKickEligibleIds: null,
    cornerKickStageIndex: null,
    cornerKickStagePlacedIds: null,
    cornerKickUsedPace: null,
    cornerKickMoveSlot: null,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    ball: {
      position: HOME_BYLINE_LOOSE_BALL_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: homeToucher.id, teamId: 'home' },
    },
    // Every piece (including both default-formation GKs, who otherwise sit inside their
    // own final third) is parked in the MIDDLE third — a byline exit necessarily lands the
    // ball inside a final third, and applyFreeMoveZoneCheck (run centrally by
    // broadcastState on every resolved action, including the pre-existing clamp path when
    // the toggle is off) would otherwise overlay FREE_MOVE_ATTACK/DEFENSE the instant an
    // opposite-final-third occupant exists (mirrors goalKick.integration.test.ts's
    // parkBackgroundPieces rationale).
    pieces: parkBackgroundPieces(room.gameState.pieces, new Set()),
  };

  return { homeToucherId: homeToucher.id };
}

/**
 * Retries `seedCornerKickLooseBall` + a real GAME_ROLL (direction/distance dice are real
 * crypto randomness, never mocked) until the scatter exits over the home byline and the
 * server classifies it as a corner kick. From HOME_BYLINE_LOOSE_BALL_HEX (q=0), directions
 * 4 (W) and 5 (SW) both strictly decrease q — i.e. exit immediately regardless of the
 * distance die (verified via toCube: both directions' cube dx is -1, and q IS cube x) — so
 * 2 of the 6 direction values guarantee a byline exit at step 1. Failure probability after
 * 60 attempts is astronomically small (mirrors throwIn.integration.test.ts's identical
 * retry-loop rationale and MAX_ATTEMPTS).
 */
async function driveLooseBallToCorner(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  roomCode: string,
): Promise<GameState> {
  const MAX_ATTEMPTS = 60;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    seedCornerKickLooseBall(roomCode);
    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL);
    const [state] = await statePromise;
    if (state.phase === 'CORNER_KICK_GK_SETUP_ATTACKING') {
      return state;
    }
  }
  throw new Error(`Failed to roll a home-byline exit after ${MAX_ATTEMPTS} attempts`);
}

/**
 * Seeds one of the two corner-kick GK reposition windows directly. `phase` selects
 * CORNER_KICK_GK_SETUP_ATTACKING (activeTeam = CORNER_KICK_TEAM) or
 * CORNER_KICK_GK_SETUP_DEFENDING (activeTeam = the opposing team) — mirrors
 * triggerOutOfBoundsRestart's/applyCornerKickGkWindowEnd's own activeTeam assignment.
 */
function seedCornerKickGkSetup(
  roomCode: string,
  phase: 'CORNER_KICK_GK_SETUP_ATTACKING' | 'CORNER_KICK_GK_SETUP_DEFENDING',
): { homeGk: PlayerPiece; awayGk: PlayerPiece } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const awayGk = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role === 'GK')!;
  const activeTeam: 'home' | 'away' =
    phase === 'CORNER_KICK_GK_SETUP_ATTACKING'
      ? CORNER_KICK_TEAM
      : CORNER_KICK_TEAM === 'home'
        ? 'away'
        : 'home';

  const pieces = parkBackgroundPieces(room.gameState.pieces, new Set([homeGk.id, awayGk.id]));

  room.gameState = {
    ...room.gameState,
    phase,
    outOfBoundsEnabled: true,
    pieces,
    cornerKickTeam: CORNER_KICK_TEAM,
    cornerKickHex: CORNER_HEX,
    cornerKickTakerId: null,
    cornerKickEligibleIds: null,
    cornerKickStageIndex: null,
    cornerKickStagePlacedIds: null,
    cornerKickUsedPace: null,
    cornerKickMoveSlot: null,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    attackingTeam: CORNER_KICK_TEAM,
    activeTeam,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: CORNER_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: homeGk.id, teamId: 'home' },
    },
  };

  return { homeGk, awayGk };
}

/** Seeds CORNER_KICK_TAKER_SELECT with cornerKickTeam/cornerKickHex fixed. */
function seedCornerKickTakerSelect(roomCode: string): {
  homeOutfield: PlayerPiece[];
  awayOutfield: PlayerPiece[];
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const pieces = parkBackgroundPieces(room.gameState.pieces, new Set());

  room.gameState = {
    ...room.gameState,
    phase: 'CORNER_KICK_TAKER_SELECT',
    outOfBoundsEnabled: true,
    pieces,
    cornerKickTeam: CORNER_KICK_TEAM,
    cornerKickHex: CORNER_HEX,
    cornerKickTakerId: null,
    cornerKickEligibleIds: null,
    cornerKickStageIndex: null,
    cornerKickStagePlacedIds: null,
    cornerKickUsedPace: null,
    cornerKickMoveSlot: null,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    attackingTeam: CORNER_KICK_TEAM,
    activeTeam: CORNER_KICK_TEAM,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: CORNER_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: homeOutfield[0]!.id, teamId: 'home' },
    },
  };

  return { homeOutfield, awayOutfield };
}

/**
 * Seeds CORNER_KICK_REPOSITION at the given stage index (default 0 — attacking side moves
 * first per CORNER_KICK_STAGES). `cornerKickEligibleIds.attacking` gets 3 distinct pieces
 * (needed by the "third distinct piece rejected" test); `defending` gets 1.
 */
function seedCornerKickReposition(
  roomCode: string,
  opts?: { stageIndex?: 0 | 1 | 2 | 3 | 4 | 5 },
): {
  takerId: string;
  attackingIds: string[];
  attackingStarts: HexCoord[];
  attackingNeighbors: HexCoord[];
  // 38-17 (D-GAP-03): three DISTINCT defending pieces, one per defending stage (1, 3, 5) —
  // a piece activated in one stage is now PIECE_LOCKED in any later stage, so the 3
  // defending-stage occurrences across a full 6-stage walk can no longer reuse one piece.
  defendingIds: string[];
  defendingStarts: HexCoord[];
  defendingNeighbors: HexCoord[];
  /** @deprecated use defendingIds[0] — kept for tests that only ever touch one defender. */
  defendingId: string;
  /** @deprecated use defendingStarts[0]. */
  defendingStart: HexCoord;
  /** @deprecated use defendingNeighbors[0]. */
  defendingNeighbor: HexCoord;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const stageIndex = opts?.stageIndex ?? 0;
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const taker = awayOutfield[0]!;
  const attacking1 = awayOutfield[1]!;
  const attacking2 = awayOutfield[2]!;
  const attacking3 = awayOutfield[3]!;
  const defending1 = homeOutfield[0]!;
  const defending2 = homeOutfield[1]!;
  const defending3 = homeOutfield[2]!;

  const ATTACKING_STARTS: HexCoord[] = [
    { q: 20, r: 10 },
    { q: 22, r: 10 },
    { q: 24, r: 10 },
  ];
  const ATTACKING_NEIGHBORS = ATTACKING_STARTS.map(
    (h) => hexNeighbors(h).find((n) => isPitchHex(n))!,
  );
  const DEFENDING_STARTS: HexCoord[] = [
    { q: 10, r: 10 },
    { q: 10, r: 12 },
    { q: 10, r: 14 },
  ];
  const DEFENDING_NEIGHBORS = DEFENDING_STARTS.map(
    (h) => hexNeighbors(h).find((n) => isPitchHex(n))!,
  );

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === taker.id) return { ...p, position: CORNER_HEX };
    if (p.id === attacking1.id) return { ...p, position: ATTACKING_STARTS[0]! };
    if (p.id === attacking2.id) return { ...p, position: ATTACKING_STARTS[1]! };
    if (p.id === attacking3.id) return { ...p, position: ATTACKING_STARTS[2]! };
    if (p.id === defending1.id) return { ...p, position: DEFENDING_STARTS[0]! };
    if (p.id === defending2.id) return { ...p, position: DEFENDING_STARTS[1]! };
    if (p.id === defending3.id) return { ...p, position: DEFENDING_STARTS[2]! };
    return p;
  });
  pieces = parkBackgroundPieces(
    pieces,
    new Set([
      taker.id,
      attacking1.id,
      attacking2.id,
      attacking3.id,
      defending1.id,
      defending2.id,
      defending3.id,
    ]),
  );

  room.gameState = {
    ...room.gameState,
    phase: 'CORNER_KICK_REPOSITION',
    outOfBoundsEnabled: true,
    pieces,
    movedPieceIds: [],
    cornerKickTeam: CORNER_KICK_TEAM,
    cornerKickHex: CORNER_HEX,
    cornerKickTakerId: taker.id,
    cornerKickEligibleIds: {
      attacking: [attacking1.id, attacking2.id, attacking3.id],
      defending: [defending1.id, defending2.id, defending3.id],
    },
    cornerKickStageIndex: stageIndex,
    cornerKickStagePlacedIds: [],
    cornerKickUsedPace: {},
    cornerKickActivatedIds: [],
    cornerKickMoveSlot: null,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    attackingTeam: CORNER_KICK_TEAM,
    activeTeam: cornerKickStageTeam(stageIndex, CORNER_KICK_TEAM),
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: CORNER_HEX,
      carrierId: taker.id,
      lastTouchedBy: { pieceId: taker.id, teamId: CORNER_KICK_TEAM },
    },
  };

  return {
    takerId: taker.id,
    attackingIds: [attacking1.id, attacking2.id, attacking3.id],
    attackingStarts: ATTACKING_STARTS,
    attackingNeighbors: ATTACKING_NEIGHBORS,
    defendingIds: [defending1.id, defending2.id, defending3.id],
    defendingStarts: DEFENDING_STARTS,
    defendingNeighbors: DEFENDING_NEIGHBORS,
    defendingId: defending1.id,
    defendingStart: DEFENDING_STARTS[0]!,
    defendingNeighbor: DEFENDING_NEIGHBORS[0]!,
  };
}

/** Seeds CORNER_KICK_FINAL_SETUP at the given slot (default 'ATTACKER'). */
function seedCornerKickFinalSetup(
  roomCode: string,
  opts?: { slot?: 'ATTACKER' | 'DEFENDER' },
): {
  takerId: string;
  attackingId: string;
  attackingStart: HexCoord;
  defendingId: string;
  defendingStart: HexCoord;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const slot = opts?.slot ?? 'ATTACKER';
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const taker = awayOutfield[0]!;
  const attacking = awayOutfield[1]!;
  const defending = homeOutfield[0]!;

  const ATTACKING_START: HexCoord = { q: 20, r: 10 };
  const DEFENDING_START: HexCoord = { q: 10, r: 10 };

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === taker.id) return { ...p, position: CORNER_HEX };
    if (p.id === attacking.id) return { ...p, position: ATTACKING_START };
    if (p.id === defending.id) return { ...p, position: DEFENDING_START };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([taker.id, attacking.id, defending.id]));

  const activeTeam: 'home' | 'away' =
    slot === 'ATTACKER' ? CORNER_KICK_TEAM : CORNER_KICK_TEAM === 'home' ? 'away' : 'home';

  room.gameState = {
    ...room.gameState,
    phase: 'CORNER_KICK_FINAL_SETUP',
    outOfBoundsEnabled: true,
    pieces,
    movedPieceIds: [],
    cornerKickTeam: CORNER_KICK_TEAM,
    cornerKickHex: CORNER_HEX,
    cornerKickTakerId: taker.id,
    cornerKickEligibleIds: {
      attacking: [attacking.id],
      defending: [defending.id],
    },
    cornerKickStageIndex: null,
    cornerKickStagePlacedIds: null,
    cornerKickMoveSlot: slot,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    attackingTeam: CORNER_KICK_TEAM,
    activeTeam,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: CORNER_HEX,
      carrierId: taker.id,
      lastTouchedBy: { pieceId: taker.id, teamId: CORNER_KICK_TEAM },
    },
  };

  return {
    takerId: taker.id,
    attackingId: attacking.id,
    attackingStart: ATTACKING_START,
    defendingId: defending.id,
    defendingStart: DEFENDING_START,
  };
}

/**
 * Task 2 helper: seeds CORNER_KICK_GK_SETUP_ATTACKING (with an optional `highPass`
 * override on the eventual taker, forcing a deterministic accuracy outcome exactly like
 * goalKick.integration.test.ts's seedGoalKickMoveKicker), then drives the ENTIRE chain —
 * both GK windows, taker selection, all 6 reposition stages (zero moves — legal per D-06),
 * and both final-setup slots (zero moves) — through real socket emissions, returning a
 * room parked in PASS with lastActionType CORNER_KICK_RESTART and the taker still holding
 * the ball. `clientA` is used as the single consistent GAME_STATE observer throughout
 * (stale-buffer guidance, matches goalKick.integration.test.ts's GAME_END_TURN sequence
 * test) even on the steps clientB emits.
 */
async function fastForwardToCornerPass(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>,
  roomCode: string,
  opts?: { highPass?: number; headerContestantHex?: HexCoord },
): Promise<{ takerId: string }> {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeGk = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role === 'GK')!;
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const originalTaker = awayOutfield[0]!;
  const taker =
    opts?.highPass !== undefined ? { ...originalTaker, highPass: opts.highPass } : originalTaker;

  // Deliberately do NOT keep either GK at its default-formation position — both sit
  // inside their own final third, and this window's End Turn resolves all the way into
  // PASS, which is NOT zone-check-exempt (see seedCornerKickLooseBall's identical note).
  const keepIds = new Set([taker.id]);
  let pieces = room.gameState.pieces.map((p) => (p.id === originalTaker.id ? taker : p));
  if (opts?.headerContestantHex) {
    const contestant = awayOutfield[1]!;
    keepIds.add(contestant.id);
    pieces = pieces.map((p) =>
      p.id === contestant.id ? { ...p, position: opts.headerContestantHex! } : p,
    );
  }
  pieces = parkBackgroundPieces(pieces, keepIds);

  room.gameState = {
    ...room.gameState,
    phase: 'CORNER_KICK_GK_SETUP_ATTACKING',
    outOfBoundsEnabled: true,
    pieces,
    cornerKickTeam: CORNER_KICK_TEAM,
    cornerKickHex: CORNER_HEX,
    cornerKickTakerId: null,
    cornerKickEligibleIds: null,
    cornerKickStageIndex: null,
    cornerKickStagePlacedIds: null,
    cornerKickUsedPace: null,
    cornerKickMoveSlot: null,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    attackingTeam: CORNER_KICK_TEAM,
    activeTeam: CORNER_KICK_TEAM,
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: CORNER_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: homeGk.id, teamId: 'home' },
    },
  };

  const awayClient = clientB;
  const homeClient = clientA;

  // ATTACKING GK window -> DEFENDING GK window (zero placements — legal).
  const p1 = oncePromise(clientA, ServerEvents.GAME_STATE);
  awayClient.emit(ClientEvents.GAME_END_TURN);
  await p1;

  // DEFENDING GK window -> TAKER_SELECT.
  const p2 = oncePromise(clientA, ServerEvents.GAME_STATE);
  homeClient.emit(ClientEvents.GAME_END_TURN);
  await p2;

  // Taker select -> CORNER_KICK_REPOSITION stage 0.
  const p3 = oncePromise(clientA, ServerEvents.GAME_STATE);
  awayClient.emit(ClientEvents.GAME_CORNER_KICK_TAKER, taker.id);
  await p3;

  // Drive all 6 alternating stages with zero moves per stage (legal, D-06).
  for (let i = 0; i < 6; i++) {
    const stageTeam = cornerKickStageTeam(i as 0 | 1 | 2 | 3 | 4 | 5, CORNER_KICK_TEAM);
    const actingClient = stageTeam === 'away' ? awayClient : homeClient;
    const p = oncePromise(clientA, ServerEvents.GAME_STATE);
    actingClient.emit(ClientEvents.GAME_END_TURN);
    await p;
  }

  // CORNER_KICK_FINAL_SETUP: ATTACKER slot end, then DEFENDER slot end (zero moves).
  const p4 = oncePromise(clientA, ServerEvents.GAME_STATE);
  awayClient.emit(ClientEvents.GAME_END_TURN);
  await p4;

  const p5 = oncePromise(clientA, ServerEvents.GAME_STATE);
  homeClient.emit(ClientEvents.GAME_END_TURN);
  const [finalState] = await p5;

  if (finalState.phase !== 'PASS' || finalState.lastActionType !== 'CORNER_KICK_RESTART') {
    throw new Error(
      `fastForwardToCornerPass did not reach PASS/CORNER_KICK_RESTART: phase=${finalState.phase}, lastActionType=${String(finalState.lastActionType)}`,
    );
  }

  return { takerId: taker.id };
}

/** In-box target for CORNER-04's range-override tests: inside homePenaltyArea, distance 16 from CORNER_HEX. */
const IN_BOX_TARGET: HexCoord = { q: 3, r: 15 };
/** Out-of-box target at exactly distance 15 from CORNER_HEX — accepted under the ordinary HIGH cap. */
const OUT_OF_BOX_15_HEX: HexCoord = { q: 15, r: 1 };
/** Out-of-box target at exactly distance 16 from CORNER_HEX — rejected (exceeds the ordinary HIGH cap). */
const OUT_OF_BOX_16_HEX: HexCoord = { q: 16, r: 1 };
/** Empty on-pitch hex for the Low-pass delivery tests — within the ordinary 11-hex STANDARD cap. */
const LOW_DELIVERY_TARGET: HexCoord = { q: 6, r: 5 };

/** A pitch-centre hex, matching throwIn.integration.test.ts's CARRIER_HEX. */
const ORDINARY_CARRIER_HEX: HexCoord = { q: 18, r: 13 };
/** Exactly 6 hexes from ORDINARY_CARRIER_HEX along the same row (throwIn's SIX_HEX_TARGET). */
const ORDINARY_TARGET_HEX: HexCoord = { q: 24, r: 13 };

/**
 * Seeds a fresh, non-corner PASS state (cornerKickTeam: null) so an ordinary Standard Pass
 * with a low `highPass` attribute can be contrasted against the corner Low pass's
 * accuracy-gated behaviour above — proving STANDARD_PASS is never accuracy-gated outside a
 * corner context.
 */
function seedOrdinaryPassState(
  roomCode: string,
  opts: { highPass: number },
): { carrierId: string } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const originalCarrier = room.gameState.pieces.find(
    (p) => p.teamId === 'home' && p.role !== 'GK',
  )!;
  const carrier = { ...originalCarrier, highPass: opts.highPass, position: ORDINARY_CARRIER_HEX };

  const pieces = room.gameState.pieces.map((p, idx) =>
    p.id === originalCarrier.id
      ? carrier
      : { ...p, position: { q: p.teamId === 'home' ? 2 : 34, r: idx % 25 } },
  );

  room.gameState = {
    ...room.gameState,
    phase: 'PASS',
    outOfBoundsEnabled: true,
    pieces,
    attackingTeam: 'home',
    activeTeam: 'home',
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    passTargetHex: null,
    cornerKickTeam: null,
    cornerKickHex: null,
    cornerKickTakerId: null,
    ball: {
      position: ORDINARY_CARRIER_HEX,
      carrierId: carrier.id,
      lastTouchedBy: { pieceId: carrier.id, teamId: 'home' },
    },
  };

  return { carrierId: carrier.id };
}

/**
 * Seeds a fresh, non-corner PASS state with the carrier positioned AT CORNER_HEX — used to
 * prove the CORNER_KICK_UNLIMITED_DISTANCE range override never applies outside an active
 * corner context (isCornerKickContext reads the persistent cornerKickTeam field, which is
 * null here), even when the target is inside a penalty area beyond the ordinary 15-hex cap.
 */
function seedOrdinaryHighPassState(roomCode: string): { carrierId: string } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const originalCarrier = room.gameState.pieces.find(
    (p) => p.teamId === 'home' && p.role !== 'GK',
  )!;
  const carrier = { ...originalCarrier, position: CORNER_HEX };

  const pieces = parkBackgroundPieces(
    room.gameState.pieces.map((p) => (p.id === originalCarrier.id ? carrier : p)),
    new Set([originalCarrier.id]),
  );

  room.gameState = {
    ...room.gameState,
    phase: 'PASS',
    outOfBoundsEnabled: true,
    pieces,
    attackingTeam: 'home',
    activeTeam: 'home',
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    passTargetHex: null,
    cornerKickTeam: null,
    cornerKickHex: null,
    cornerKickTakerId: null,
    ball: {
      position: CORNER_HEX,
      carrierId: carrier.id,
      lastTouchedBy: { pieceId: carrier.id, teamId: 'home' },
    },
  };

  return { carrierId: carrier.id };
}

// ---------------------------------------------------------------------------
// OOB-03: byline exit classification + team inversion (real out-of-bounds trigger)
// ---------------------------------------------------------------------------

describe('OOB-03: a home-byline exit after a home touch triggers a corner kick', () => {
  it('awards the corner to away (team inversion) and enters CORNER_KICK_GK_SETUP_ATTACKING', async () => {
    const { clientA, roomCode } = await setupRoom();
    const state = await driveLooseBallToCorner(clientA, roomCode);

    expect(state.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
    expect(state.cornerKickTeam).toBe('away');
    expect(state.cornerKickHex).not.toBeNull();
    expect(state.cornerKickHex?.q).toBe(0);
    expect(state.activeTeam).toBe('away');
    const oobEvent = state.eventLog.find((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvent).toBeDefined();
    if (oobEvent?.type === 'OUT_OF_BOUNDS') {
      expect(oobEvent.kind).toBe('BYLINE');
      expect(oobEvent.restart).toBe('CORNER_KICK');
      expect(oobEvent.awardedTo).toBe('away');
    }
  });

  it('does not fire when outOfBoundsEnabled is off — the pre-existing clamp behaviour runs instead', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickLooseBall(roomCode, { outOfBoundsEnabled: false });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL);
    const [state] = await statePromise;

    expect(state.phase).toBe('PASS');
    expect(state.cornerKickTeam).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CORNER-01: goalkeeper reposition windows
// ---------------------------------------------------------------------------

describe('CORNER-01: goalkeeper reposition windows', () => {
  it('the away (attacking) socket can place its own goalkeeper during CORNER_KICK_GK_SETUP_ATTACKING', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { awayGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');
    const target = hexNeighbors(awayGk.position).find((h) => isPitchHex(h))!;

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, awayGk.id, target);
    const [state] = await statePromise;

    const moved = state.pieces.find((p) => p.id === awayGk.id)!;
    expect(moved.position).toEqual(target);
  });

  it('the home (defending) socket cannot act during CORNER_KICK_GK_SETUP_ATTACKING', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');
    const target = hexNeighbors(homeGk.position).find((h) => isPitchHex(h))!;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeGk.id, target);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('game:end-turn from away advances _ATTACKING -> _DEFENDING, then from home advances _DEFENDING -> CORNER_KICK_TAKER_SELECT', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    // Listen on clientA throughout (stale-buffer guidance, matches
    // goalKick.integration.test.ts's identical GAME_END_TURN sequence test).
    const p1 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [afterFirst] = await p1;
    expect(afterFirst.phase).toBe('CORNER_KICK_GK_SETUP_DEFENDING');
    expect(afterFirst.activeTeam).toBe('home');

    const p2 = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [afterSecond] = await p2;
    expect(afterSecond.phase).toBe('CORNER_KICK_TAKER_SELECT');
    expect(afterSecond.activeTeam).toBe('away');
  });
});

// ---------------------------------------------------------------------------
// CORNER-02: corner-taker selection
// ---------------------------------------------------------------------------

describe('CORNER-02: GAME_CORNER_KICK_TAKER', () => {
  it('game:corner-kick-taker from away places the taker and ball at the fixed corner hex and enters CORNER_KICK_REPOSITION at stage 0', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { awayOutfield } = seedCornerKickTakerSelect(roomCode);
    const taker = awayOutfield[0]!;

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_TAKER, taker.id);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_REPOSITION');
    expect(state.cornerKickStageIndex).toBe(0);
    expect(state.ball.position).toEqual(CORNER_HEX);
    expect(state.ball.carrierId).toBe(taker.id);
    const takerPiece = state.pieces.find((p) => p.id === taker.id)!;
    expect(takerPiece.position).toEqual(CORNER_HEX);
  });

  it('the opposing (home) team selecting a taker is rejected with WRONG_TEAM', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeOutfield[0]!.id);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_TAKER_SELECT');
  });
});

// ---------------------------------------------------------------------------
// CORNER-03: the 6-stage alternating reposition window
// ---------------------------------------------------------------------------

describe('CORNER-03: the 6-stage alternating reposition window', () => {
  it('driving all 6 stages with alternating game:move/game:end-turn reaches CORNER_KICK_FINAL_SETUP, rejecting every out-of-turn game:end-turn along the way', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { attackingIds, defendingIds } = seedCornerKickReposition(roomCode, { stageIndex: 0 });

    // 38-17 (D-GAP-03): a piece may be activated only once per reposition window, so each of
    // the 3 attacking stages (0, 2, 4) and each of the 3 defending stages (1, 3, 5) must move
    // a DISTINCT piece — reusing one piece across stages of the same side is now PIECE_LOCKED.
    let nextAttackingIdx = 0;
    let nextDefendingIdx = 0;

    for (let i = 0; i < 6; i++) {
      const stageIndex = i as 0 | 1 | 2 | 3 | 4 | 5;
      const stageTeam = cornerKickStageTeam(stageIndex, CORNER_KICK_TEAM);
      const actingClient = stageTeam === 'away' ? clientB : clientA;
      const waitingClient = stageTeam === 'away' ? clientA : clientB;

      // Out-of-turn End Turn is rejected. Both the error (waitingClient) and the resulting
      // snap-back broadcast (clientA — our consistent observer) are listened for BEFORE the
      // emit, so neither can be missed regardless of network arrival order.
      const wrongTurnErrorPromise = oncePromise(waitingClient, ServerEvents.GAME_ERROR);
      const wrongTurnSnapbackPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      waitingClient.emit(ClientEvents.GAME_END_TURN);
      const [wrongTurnReason] = await wrongTurnErrorPromise;
      await wrongTurnSnapbackPromise;
      expect(wrongTurnReason).toBe('WRONG_TEAM');
      expect(getRoom(roomCode)!.gameState!.cornerKickStageIndex).toBe(stageIndex);

      // The acting team makes one legal move, always with a piece not yet activated this
      // window.
      const pieceId =
        stageTeam === CORNER_KICK_TEAM
          ? attackingIds[nextAttackingIdx++]!
          : defendingIds[nextDefendingIdx++]!;
      const before = getRoom(roomCode)!.gameState!;
      const piece = before.pieces.find((p) => p.id === pieceId)!;
      const target = freeNeighbor(before, piece.position);

      const movePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      actingClient.emit(ClientEvents.GAME_MOVE, pieceId, target);
      const [afterMove] = await movePromise;
      expect(afterMove.pieces.find((p) => p.id === pieceId)!.position).toEqual(target);
      expect(afterMove.cornerKickUsedPace?.[pieceId]).toBeGreaterThan(0);

      const endTurnPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      actingClient.emit(ClientEvents.GAME_END_TURN);
      const [afterEndTurn] = await endTurnPromise;

      if (stageIndex < 5) {
        expect(afterEndTurn.phase).toBe('CORNER_KICK_REPOSITION');
        expect(afterEndTurn.cornerKickStageIndex).toBe(stageIndex + 1);
        expect(afterEndTurn.activeTeam).toBe(
          cornerKickStageTeam((stageIndex + 1) as 0 | 1 | 2 | 3 | 4 | 5, CORNER_KICK_TEAM),
        );
      } else {
        expect(afterEndTurn.phase).toBe('CORNER_KICK_FINAL_SETUP');
        expect(afterEndTurn.cornerKickMoveSlot).toBe('ATTACKER');
      }
    }
  });

  it('moving a third distinct piece in one stage is rejected with STAGE_LIMIT_REACHED', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { attackingIds, attackingNeighbors } = seedCornerKickReposition(roomCode, {
      stageIndex: 0,
    });

    const p1 = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_MOVE, attackingIds[0]!, attackingNeighbors[0]!);
    await p1;

    const p2 = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_MOVE, attackingIds[1]!, attackingNeighbors[1]!);
    const [afterSecond] = await p2;
    expect(afterSecond.cornerKickStagePlacedIds).toHaveLength(2);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, attackingIds[2]!, attackingNeighbors[2]!);
    const [reason] = await errorPromise;

    expect(reason).toBe('STAGE_LIMIT_REACHED');
    expect(getRoom(roomCode)!.gameState!.cornerKickStagePlacedIds).toHaveLength(2);
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_REPOSITION');
  });

  // Reclassified by 38-17 (D-GAP-03, closing 38-15 defect 1): this test used to prove a
  // 6-hex-per-piece budget that persisted across the whole window, rejecting a 7th move.
  // That budget is gone — repositioning is uncapped within the activating stage. The test
  // now proves the 7th successive move by the same piece still succeeds.
  it('moving one piece 7 single hexes within its activating stage all succeed — movement is uncapped', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { attackingIds, attackingStarts, attackingNeighbors } = seedCornerKickReposition(
      roomCode,
      { stageIndex: 0 },
    );
    const pieceId = attackingIds[0]!;
    const start = attackingStarts[0]!;
    const neighbor = attackingNeighbors[0]!;
    const targets = [neighbor, start, neighbor, start, neighbor, start, neighbor];

    for (let i = 0; i < 7; i++) {
      const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
      clientB.emit(ClientEvents.GAME_MOVE, pieceId, targets[i]!);
      const [state] = await statePromise;
      expect(state.cornerKickUsedPace?.[pieceId]).toBe(i + 1);
    }

    expect(getRoom(roomCode)!.gameState!.cornerKickUsedPace?.[pieceId]).toBe(7);
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_REPOSITION');
  });
});

// ---------------------------------------------------------------------------
// CORNER-06: the pre-kick final setup window
// ---------------------------------------------------------------------------

describe('CORNER-06: CORNER_KICK_FINAL_SETUP', () => {
  it('the defending team cannot move during the ATTACKER slot', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { defendingId, defendingStart } = seedCornerKickFinalSetup(roomCode, {
      slot: 'ATTACKER',
    });
    const target = hexNeighbors(defendingStart).find((h) => isPitchHex(h))!;

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, defendingId, target);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_FINAL_SETUP');
  });

  it('accepts up to a 3-hex cumulative move per team, attacking first, and the second game:end-turn reaches PASS with lastActionType CORNER_KICK_RESTART', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { attackingId, attackingStart, defendingId, defendingStart, takerId } =
      seedCornerKickFinalSetup(roomCode, { slot: 'ATTACKER' });

    // Attacking (away) makes 2 successive 1-hex moves (cumulative budget <= 3). Listen on
    // clientA throughout for consistency with the rest of the file, even on clientB's steps.
    const attackingStep1 = hexNeighbors(attackingStart).find((h) => isPitchHex(h))!;
    const move1Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_MOVE, attackingId, attackingStep1);
    const [afterMove1] = await move1Promise;
    expect(afterMove1.cornerKickPaceUsed).toBe(1);

    const attackingStep2 = hexNeighbors(attackingStep1).find(
      (h) => isPitchHex(h) && !(h.q === attackingStart.q && h.r === attackingStart.r),
    )!;
    const move2Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_MOVE, attackingId, attackingStep2);
    const [afterMove2] = await move2Promise;
    expect(afterMove2.cornerKickPaceUsed).toBe(2);

    const endTurn1Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [afterEndTurn1] = await endTurn1Promise;
    expect(afterEndTurn1.phase).toBe('CORNER_KICK_FINAL_SETUP');
    expect(afterEndTurn1.cornerKickMoveSlot).toBe('DEFENDER');
    expect(afterEndTurn1.activeTeam).toBe('home');
    expect(afterEndTurn1.cornerKickPaceUsed).toBe(0);

    // Defending (home) makes one move, then ends turn -> PASS.
    const homeStep = hexNeighbors(defendingStart).find((h) => isPitchHex(h))!;
    const move3Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, defendingId, homeStep);
    await move3Promise;

    const endTurn2Promise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [finalState] = await endTurn2Promise;

    expect(finalState.phase).toBe('PASS');
    expect(finalState.lastActionType).toBe('CORNER_KICK_RESTART');
    expect(finalState.ball.carrierId).toBe(takerId);
    expect(finalState.cornerKickMoveSlot).toBeNull();
    expect(finalState.attackingTeam).toBe(CORNER_KICK_TEAM);
  });
});

// ---------------------------------------------------------------------------
// CORNER-04: the penalty-area-conditional unlimited High Pass range
// ---------------------------------------------------------------------------

describe('CORNER-04: the High Pass corner range override', () => {
  it("a target inside the byline owner's penalty area beyond 15 hexes is accepted (unlimited range)", async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    await fastForwardToCornerPass(clientA, clientB, roomCode);

    expect(hexDistance(CORNER_HEX, IN_BOX_TARGET)).toBeGreaterThan(15);
    expect(isInRegion(IN_BOX_TARGET, 'homePenaltyArea')).toBe(true);

    let errorReceived: string | null = null;
    const errorListener = (err: string): void => {
      errorReceived = err;
    };
    clientB.on(ServerEvents.GAME_ERROR, errorListener);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', IN_BOX_TARGET);
    await statePromise;
    clientB.off(ServerEvents.GAME_ERROR, errorListener);

    expect(errorReceived).toBeNull();
  });

  it('a target outside the box is capped at the ordinary 15-hex range: distance 16 rejected, distance 15 accepted', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    await fastForwardToCornerPass(clientA, clientB, roomCode);

    expect(hexDistance(CORNER_HEX, OUT_OF_BOX_16_HEX)).toBe(16);
    expect(hexDistance(CORNER_HEX, OUT_OF_BOX_15_HEX)).toBe(15);
    expect(isInRegion(OUT_OF_BOX_16_HEX, 'homePenaltyArea')).toBe(false);
    expect(isInRegion(OUT_OF_BOX_15_HEX, 'homePenaltyArea')).toBe(false);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', OUT_OF_BOX_16_HEX);
    const [reason] = await errorPromise;
    expect(reason).toBe('INVALID_TARGET');
    // The rejection is pre-commit (validatePass runs before any state mutation) — the
    // corner context is still intact, so the same room can be reused for the accepted case.
    expect(getRoom(roomCode)!.gameState!.phase).toBe('PASS');
    expect(getRoom(roomCode)!.gameState!.cornerKickTeam).toBe(CORNER_KICK_TEAM);

    let errorReceived: string | null = null;
    const errorListener = (err: string): void => {
      errorReceived = err;
    };
    clientB.on(ServerEvents.GAME_ERROR, errorListener);
    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', OUT_OF_BOX_15_HEX);
    await statePromise;
    clientB.off(ServerEvents.GAME_ERROR, errorListener);

    expect(errorReceived).toBeNull();
  });

  it('the unlimited-range override never applies outside an active corner context', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedOrdinaryHighPassState(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', IN_BOX_TARGET);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
  });
});

/**
 * A High Pass corner (like any ordinary High Pass) does not resolve its accuracy die
 * immediately on GAME_ROLL — it first enters the shared HIGH_PASS_MOVE repositioning
 * window (1 piece per team, attacker slot then defender slot). Only the DEFENDER slot's
 * End Turn actually rolls the accuracy die (gameHandlers.ts's HIGH_PASS_MOVE GAME_END_TURN
 * branch). Zero moves in either slot is legal — mirrors CORNER_KICK_REPOSITION's D-06
 * zero-move allowance. `clientA` observes throughout (stale-buffer guidance).
 */
async function driveHighPassMoveToResolution(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>,
): Promise<GameState> {
  // ATTACKER slot (the corner-kicking team, away) -> DEFENDER slot.
  const p1 = oncePromise(clientA, ServerEvents.GAME_STATE);
  clientB.emit(ClientEvents.GAME_END_TURN);
  await p1;
  // DEFENDER slot (home) -> accuracy die rolls, resolving into HEADER or LOOSE_BALL.
  const p2 = oncePromise(clientA, ServerEvents.GAME_STATE);
  clientA.emit(ClientEvents.GAME_END_TURN);
  const [state] = await p2;
  return state;
}

// ---------------------------------------------------------------------------
// CORNER-05: kick resolution — High forces a header, Low delivers without one
// ---------------------------------------------------------------------------

describe('CORNER-05: kick resolution', () => {
  it('an accurate High Pass corner ends in phase HEADER and tears down the corner context', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    await fastForwardToCornerPass(clientA, clientB, roomCode, {
      highPass: 7,
      headerContestantHex: IN_BOX_TARGET,
    });

    const rollPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', IN_BOX_TARGET);
    const [afterRoll] = await rollPromise;
    expect(afterRoll.phase).toBe('HIGH_PASS_MOVE');

    const state = await driveHighPassMoveToResolution(clientA, clientB);

    expect(state.phase).toBe('HEADER');
    expect(state.cornerKickTeam).toBeNull();
    const accEvent = state.eventLog.find((e) => e.type === 'CORNER_KICK_ACCURACY');
    expect(accEvent).toBeDefined();
    if (accEvent?.type === 'CORNER_KICK_ACCURACY') {
      expect(accEvent.accurate).toBe(true);
      expect(accEvent.passType).toBe('HIGH');
    }
  });

  it('an accurate Low Pass corner delivers without entering HEADER and tears down the corner context', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    await fastForwardToCornerPass(clientA, clientB, roomCode, { highPass: 7 });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', LOW_DELIVERY_TARGET);
    const [state] = await statePromise;

    expect(state.phase).not.toBe('HEADER');
    expect(state.ball.position).toEqual(LOW_DELIVERY_TARGET);
    expect(state.cornerKickTeam).toBeNull();
    const accEvent = state.eventLog.find((e) => e.type === 'CORNER_KICK_ACCURACY');
    expect(accEvent).toBeDefined();
    if (accEvent?.type === 'CORNER_KICK_ACCURACY') {
      expect(accEvent.accurate).toBe(true);
      expect(accEvent.passType).toBe('LOW');
    }
  });

  it('an inaccurate High Pass corner ends in LOOSE_BALL', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    await fastForwardToCornerPass(clientA, clientB, roomCode, {
      highPass: 1,
      headerContestantHex: IN_BOX_TARGET,
    });

    const rollPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', IN_BOX_TARGET);
    const [afterRoll] = await rollPromise;
    expect(afterRoll.phase).toBe('HIGH_PASS_MOVE');

    const state = await driveHighPassMoveToResolution(clientA, clientB);

    expect(state.phase).toBe('LOOSE_BALL');
    expect(state.cornerKickTeam).toBeNull();
    const accEvent = state.eventLog.find((e) => e.type === 'CORNER_KICK_ACCURACY');
    expect(accEvent).toBeDefined();
    if (accEvent?.type === 'CORNER_KICK_ACCURACY') {
      expect(accEvent.accurate).toBe(false);
    }
  });

  it('an inaccurate Low Pass corner ends in LOOSE_BALL', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    await fastForwardToCornerPass(clientA, clientB, roomCode, { highPass: 1 });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', LOW_DELIVERY_TARGET);
    const [state] = await statePromise;

    expect(state.phase).toBe('LOOSE_BALL');
    expect(state.cornerKickTeam).toBeNull();
    const accEvent = state.eventLog.find((e) => e.type === 'CORNER_KICK_ACCURACY');
    expect(accEvent).toBeDefined();
    if (accEvent?.type === 'CORNER_KICK_ACCURACY') {
      expect(accEvent.accurate).toBe(false);
    }
  });

  it('a Low Pass corner with a failing die does not deliver — unlike an ordinary Standard Pass with the same die', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    await fastForwardToCornerPass(clientA, clientB, roomCode, { highPass: 1 });

    const cornerStatePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', LOW_DELIVERY_TARGET);
    const [cornerState] = await cornerStatePromise;
    expect(cornerState.phase).toBe('LOOSE_BALL');

    // Contrast: an ordinary (non-corner) Standard Pass with the identical low highPass
    // attribute is never accuracy-gated and always delivers.
    seedOrdinaryPassState(roomCode, { highPass: 1 });
    const ordinaryStatePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', ORDINARY_TARGET_HEX);
    const [ordinaryState] = await ordinaryStatePromise;

    expect(ordinaryState.phase).toBe('PASS');
    expect(ordinaryState.ball.position).toEqual(ORDINARY_TARGET_HEX);
  });
});
