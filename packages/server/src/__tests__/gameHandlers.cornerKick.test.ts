/**
 * Handler-level socket integration tests for Phase 38's Corner Kick socket surface
 * (Plan 38-05). Structure mirrors throwIn.integration.test.ts / goalKick.integration.test.ts
 * (real Socket.io server + socket.io-client, no mocking; room store seeded directly via
 * getRoom for phase/state manipulation).
 *
 * Task 1 coverage (CORNER-01/CORNER-02):
 * - GAME_CORNER_KICK_GK_PLACE: malformed payload, WRONG_TEAM, WRONG_PHASE, success,
 *   double-emit mutex idempotency, finally-release on a rejected action.
 * - GAME_CORNER_KICK_TAKER: WRONG_TEAM, WRONG_PHASE, malformed payload, success,
 *   double-emit mutex idempotency, finally-release on a rejected action.
 * - GAME_END_TURN wiring for the two GK-setup windows (applyCornerKickGkWindowEnd).
 *
 * Task 2 coverage (CORNER-03/CORNER-06):
 * - GAME_MOVE during CORNER_KICK_REPOSITION/CORNER_KICK_FINAL_SETUP delegates to the
 *   corner engine functions and logs the correct event shape for each window.
 * - GAME_END_TURN during both windows delegates to the corner stage/slot-end engine
 *   functions, with the CORNER_KICK_FINAL_SETUP branch generating no dice.
 * - GAME_UNDO accepts the two reposition windows and rejects the three placement phases.
 * - GAME_ROLL is rejected in every corner setup phase (DICE_PHASES exclusion).
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
  cornerClearOutGoalHex,
  cornerKickStageTeam,
  hexDistance,
  hexNeighbors,
  isLegalClearOutStep,
  isPitchHex,
} from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors throwIn.integration.test.ts / goalKick.integration.test.ts)
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

/**
 * Waits for `n` GAME_STATE broadcasts on `client` and resolves with all of them in
 * arrival order. Used for double-emit mutex-idempotency tests, where a second emit
 * still produces a (no-op) snap-back broadcast that a single oncePromise would miss.
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
// Seed helpers — direct room.gameState mutation (mirrors goalKick.integration.test.ts)
// ---------------------------------------------------------------------------

const CORNER_KICK_TEAM: 'home' | 'away' = 'home';
const CORNER_HEX: HexCoord = { q: 0, r: 1 };

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 12 : 13, r: idx % 25 } },
  );
}

/**
 * Seeds one of the two corner-kick GK reposition windows. `phase` selects
 * CORNER_KICK_GK_SETUP_ATTACKING (activeTeam = cornerKickTeam) or
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
      lastTouchedBy: { pieceId: awayGk.id, teamId: 'away' },
    },
  };

  return { homeGk, awayGk };
}

/** Seeds CORNER_KICK_TAKER_SELECT with cornerKickTeam='home' and cornerKickHex fixed. */
function seedCornerKickTakerSelect(roomCode: string): {
  homeOutfield: PlayerPiece;
  awayOutfield: PlayerPiece;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeOutfield = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
  const awayOutfield = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;

  const pieces = parkBackgroundPieces(
    room.gameState.pieces,
    new Set([homeOutfield.id, awayOutfield.id]),
  );

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
      lastTouchedBy: { pieceId: awayOutfield.id, teamId: 'away' },
    },
  };

  return { homeOutfield, awayOutfield };
}

/**
 * Seeds CORNER_KICK_REPOSITION at the given stage index (default 0 — attacking side
 * moves first per CORNER_KICK_STAGES). activeTeam derived from cornerKickStageTeam,
 * mirroring the real trigger/applyCornerKickStageEnd assignment exactly.
 */
function seedCornerKickReposition(
  roomCode: string,
  opts?: { stageIndex?: 0 | 1 | 2 | 3 | 4 | 5 },
): {
  takerId: string;
  eligibleHomeId: string;
  eligibleHomeStart: HexCoord;
  eligibleHomeNeighbor: HexCoord;
  eligibleAwayId: string;
  eligibleAwayStart: HexCoord;
  eligibleAwayNeighbor: HexCoord;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const stageIndex = opts?.stageIndex ?? 0;
  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const taker = homeOutfield[0]!;
  const eligibleHome = homeOutfield[1]!;
  const eligibleAway = awayOutfield[0]!;

  const ELIGIBLE_HOME_START: HexCoord = { q: 10, r: 10 };
  const ELIGIBLE_HOME_NEIGHBOR = hexNeighbors(ELIGIBLE_HOME_START).find((h) => isPitchHex(h))!;
  const ELIGIBLE_AWAY_START: HexCoord = { q: 20, r: 10 };
  const ELIGIBLE_AWAY_NEIGHBOR = hexNeighbors(ELIGIBLE_AWAY_START).find((h) => isPitchHex(h))!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === taker.id) return { ...p, position: CORNER_HEX };
    if (p.id === eligibleHome.id) return { ...p, position: ELIGIBLE_HOME_START };
    if (p.id === eligibleAway.id) return { ...p, position: ELIGIBLE_AWAY_START };
    return p;
  });
  // Deliberately do NOT exclude the two GKs from parking (unlike seedCornerKickGkSetup) —
  // their default formation positions sit inside each team's own final third, which
  // combined with the ball's post-transition CORNER_HEX/PASS-phase position would
  // spuriously trigger applyFreeMoveZoneCheck's FREE_MOVE_ATTACK/DEFENSE overlay
  // (see goalKick.integration.test.ts's identical parkBackgroundPieces note).
  pieces = parkBackgroundPieces(pieces, new Set([taker.id, eligibleHome.id, eligibleAway.id]));

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
      attacking: [eligibleHome.id],
      defending: [eligibleAway.id],
    },
    cornerKickStageIndex: stageIndex,
    cornerKickStagePlacedIds: [],
    cornerKickUsedPace: {},
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
    eligibleHomeId: eligibleHome.id,
    eligibleHomeStart: ELIGIBLE_HOME_START,
    eligibleHomeNeighbor: ELIGIBLE_HOME_NEIGHBOR,
    eligibleAwayId: eligibleAway.id,
    eligibleAwayStart: ELIGIBLE_AWAY_START,
    eligibleAwayNeighbor: ELIGIBLE_AWAY_NEIGHBOR,
  };
}

/** A pitch-centre hex used as the ball-carrier position for the Task 3 range tests. */
const RANGE_CARRIER_HEX: HexCoord = { q: 18, r: 13 };

/**
 * Seeds a PASS-phase state for the Task 3 range-override tests. `cornerKickTeam: null`
 * produces a non-corner PASS state (regression group); a non-null value produces a
 * corner PASS state with `lastActionType: 'CORNER_KICK_RESTART'`. `lastActionType`
 * may be overridden directly for the throw-in regression case. Every other piece is
 * parked in the MIDDLE third (mirrors goalKick.integration.test.ts's parkBackgroundPieces
 * rationale) so no background occupant can trigger the centralized ball-zone free-move
 * interrupt when an accepted High Pass lands the ball inside a final third.
 */
function seedPassRangeState(
  roomCode: string,
  opts: {
    cornerKickTeam: 'home' | 'away' | null;
    lastActionType?: 'CORNER_KICK_RESTART' | 'THROW_IN_MOVEMENT_1' | 'MOVEMENT_PHASE';
  },
): { carrierId: string; carrierTeam: 'home' | 'away' } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const carrierTeam: 'home' | 'away' = opts.cornerKickTeam ?? 'home';
  const carrier = room.gameState.pieces.find((p) => p.teamId === carrierTeam && p.role !== 'GK')!;

  const pieces = room.gameState.pieces.map((p, idx) =>
    p.id === carrier.id
      ? { ...p, position: RANGE_CARRIER_HEX }
      : { ...p, position: { q: 12, r: idx % 25 } },
  );

  room.gameState = {
    ...room.gameState,
    phase: 'PASS',
    outOfBoundsEnabled: true,
    pieces,
    attackingTeam: carrierTeam,
    activeTeam: carrierTeam,
    kickOffActive: false,
    lastActionType:
      opts.lastActionType ??
      (opts.cornerKickTeam != null ? 'CORNER_KICK_RESTART' : 'MOVEMENT_PHASE'),
    lastDiceRoll: null,
    passTargetHex: null,
    cornerKickTeam: opts.cornerKickTeam,
    cornerKickHex: opts.cornerKickTeam != null ? RANGE_CARRIER_HEX : null,
    cornerKickTakerId: opts.cornerKickTeam != null ? carrier.id : null,
    throwInHex: opts.lastActionType === 'THROW_IN_MOVEMENT_1' ? RANGE_CARRIER_HEX : null,
    throwInTeam: opts.lastActionType === 'THROW_IN_MOVEMENT_1' ? carrierTeam : null,
    throwInPhasesTaken: opts.lastActionType === 'THROW_IN_MOVEMENT_1' ? 1 : null,
    ball: {
      position: RANGE_CARRIER_HEX,
      carrierId: carrier.id,
      lastTouchedBy: { pieceId: carrier.id, teamId: carrierTeam },
    },
  };

  return { carrierId: carrier.id, carrierTeam };
}

/** Seeds CORNER_KICK_FINAL_SETUP at the given slot (default 'ATTACKER'). */
function seedCornerKickFinalSetup(
  roomCode: string,
  opts?: { slot?: 'ATTACKER' | 'DEFENDER' },
): {
  takerId: string;
  eligibleHomeId: string;
  eligibleHomeStart: HexCoord;
  eligibleHomeNeighbor: HexCoord;
  eligibleAwayId: string;
  eligibleAwayStart: HexCoord;
  eligibleAwayNeighbor: HexCoord;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const slot = opts?.slot ?? 'ATTACKER';
  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const taker = homeOutfield[0]!;
  const eligibleHome = homeOutfield[1]!;
  const eligibleAway = awayOutfield[0]!;

  const ELIGIBLE_HOME_START: HexCoord = { q: 10, r: 10 };
  const ELIGIBLE_HOME_NEIGHBOR = hexNeighbors(ELIGIBLE_HOME_START).find((h) => isPitchHex(h))!;
  const ELIGIBLE_AWAY_START: HexCoord = { q: 20, r: 10 };
  const ELIGIBLE_AWAY_NEIGHBOR = hexNeighbors(ELIGIBLE_AWAY_START).find((h) => isPitchHex(h))!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === taker.id) return { ...p, position: CORNER_HEX };
    if (p.id === eligibleHome.id) return { ...p, position: ELIGIBLE_HOME_START };
    if (p.id === eligibleAway.id) return { ...p, position: ELIGIBLE_AWAY_START };
    return p;
  });
  // Deliberately do NOT exclude the two GKs from parking — see the identical note in
  // seedCornerKickReposition above (this window's End Turn can resolve straight into
  // PASS, which is NOT zone-check-exempt, so a GK left in its default final-third
  // position would spuriously hijack the DEFENDER-slot-end resolution test below).
  pieces = parkBackgroundPieces(pieces, new Set([taker.id, eligibleHome.id, eligibleAway.id]));

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
      attacking: [eligibleHome.id],
      defending: [eligibleAway.id],
    },
    cornerKickStageIndex: null,
    cornerKickStagePlacedIds: null,
    cornerKickUsedPace: {},
    cornerKickMoveSlot: slot,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    attackingTeam: CORNER_KICK_TEAM,
    activeTeam:
      slot === 'ATTACKER' ? CORNER_KICK_TEAM : CORNER_KICK_TEAM === 'home' ? 'away' : 'home',
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
    eligibleHomeId: eligibleHome.id,
    eligibleHomeStart: ELIGIBLE_HOME_START,
    eligibleHomeNeighbor: ELIGIBLE_HOME_NEIGHBOR,
    eligibleAwayId: eligibleAway.id,
    eligibleAwayStart: ELIGIBLE_AWAY_START,
    eligibleAwayNeighbor: ELIGIBLE_AWAY_NEIGHBOR,
  };
}

/**
 * CORNER_KICK_CLEAR_OUT geometry (38-21). bylineOwnerTeam is the team OPPOSITE
 * CORNER_KICK_TEAM ('away'), mirroring applyCornerKickClearOut's own inversion — the
 * clear-out moves in-zone pieces toward the CONCEDING team's goal, not the kicking
 * team's own goal. goalHex derived via cornerClearOutGoalHex, never a restated literal
 * (mirrors gameEngine.cornerKick.test.ts's identical CORNER_KICK_CLEAR_OUT fixture).
 */
const CLEAR_OUT_BYLINE_OWNER: 'home' | 'away' = CORNER_KICK_TEAM === 'home' ? 'away' : 'home';
const CLEAR_OUT_GOAL_HEX: HexCoord = cornerClearOutGoalHex(CLEAR_OUT_BYLINE_OWNER);

/** The first legal (away-from-corner, goal-ward) neighbor step for a hex inside the zone. */
function clearOutLegalTarget(from: HexCoord): HexCoord {
  return hexNeighbors(from).find(
    (to) => isPitchHex(to) && isLegalClearOutStep(from, to, CORNER_HEX, CLEAR_OUT_GOAL_HEX),
  )!;
}

/** A neighbor step that moves BACK toward the corner — fails isLegalClearOutStep. */
function clearOutIllegalTarget(from: HexCoord): HexCoord {
  return hexNeighbors(from).find(
    (to) => isPitchHex(to) && hexDistance(to, CORNER_HEX) <= hexDistance(from, CORNER_HEX),
  )!;
}

/**
 * Seeds CORNER_KICK_CLEAR_OUT with cornerKickTeam='home' (mirrors every sibling corner
 * seed helper in this file) and one in-zone piece per team, each placed on a distinct
 * on-pitch neighbor of CORNER_HEX (distance 1, guaranteed inside CORNER_EXCLUSION_RADIUS
 * 3). `slot` selects which side is currently active (default 'ATTACKER').
 */
function seedCornerKickClearOut(
  roomCode: string,
  opts?: { slot?: 'ATTACKER' | 'DEFENDER' },
): {
  inZoneHomeId: string;
  inZoneHomeStart: HexCoord;
  inZoneAwayId: string;
  inZoneAwayStart: HexCoord;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const slot = opts?.slot ?? 'ATTACKER';
  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const inZoneHome = homeOutfield[0]!;
  const inZoneAway = awayOutfield[0]!;

  const cornerNeighborsOnPitch = hexNeighbors(CORNER_HEX).filter((h) => isPitchHex(h));
  const IN_ZONE_HOME_START = cornerNeighborsOnPitch[0]!;
  // Exclude not just IN_ZONE_HOME_START itself but also its own legal/illegal probe targets
  // (clearOutLegalTarget/clearOutIllegalTarget) — otherwise the away piece can land on the
  // exact hex a home-piece test targets, turning an intended NOT_TOWARD_GOAL/legal-step
  // assertion into an unrelated INVALID_TARGET (occupied) rejection.
  const homeLegalTarget = clearOutLegalTarget(IN_ZONE_HOME_START);
  const homeIllegalTarget = clearOutIllegalTarget(IN_ZONE_HOME_START);
  const reserved = new Set(
    [IN_ZONE_HOME_START, homeLegalTarget, homeIllegalTarget].map((h) => `${h.q},${h.r}`),
  );
  const IN_ZONE_AWAY_START = cornerNeighborsOnPitch.find((h) => !reserved.has(`${h.q},${h.r}`))!;

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === inZoneHome.id) return { ...p, position: IN_ZONE_HOME_START };
    if (p.id === inZoneAway.id) return { ...p, position: IN_ZONE_AWAY_START };
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([inZoneHome.id, inZoneAway.id]));

  room.gameState = {
    ...room.gameState,
    phase: 'CORNER_KICK_CLEAR_OUT',
    outOfBoundsEnabled: true,
    pieces,
    cornerKickTeam: CORNER_KICK_TEAM,
    cornerKickHex: CORNER_HEX,
    cornerKickClearOutSlot: slot,
    cornerKickTakerId: null,
    cornerKickEligibleIds: null,
    cornerKickStageIndex: null,
    cornerKickStagePlacedIds: null,
    cornerKickUsedPace: null,
    cornerKickMoveSlot: null,
    cornerKickMovedPieceId: null,
    cornerKickPaceUsed: 0,
    attackingTeam: CORNER_KICK_TEAM,
    activeTeam:
      slot === 'ATTACKER' ? CORNER_KICK_TEAM : CORNER_KICK_TEAM === 'home' ? 'away' : 'home',
    kickOffActive: false,
    lastActionType: null,
    lastDiceRoll: null,
    ball: {
      position: CORNER_HEX,
      carrierId: null,
      lastTouchedBy: { pieceId: inZoneAway.id, teamId: 'away' },
    },
  };

  return {
    inZoneHomeId: inZoneHome.id,
    inZoneHomeStart: IN_ZONE_HOME_START,
    inZoneAwayId: inZoneAway.id,
    inZoneAwayStart: IN_ZONE_AWAY_START,
  };
}

// ---------------------------------------------------------------------------
// CORNER-01: GAME_CORNER_KICK_GK_PLACE
// ---------------------------------------------------------------------------

describe('CORNER-01: GAME_CORNER_KICK_GK_PLACE', () => {
  it('a malformed payload (missing pieceId) is rejected and does not mutate the phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, 12345, { q: 1, r: 1 });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('a malformed `to` (non-object) is rejected and does not mutate the phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeGk.id, null);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('the non-acting team is rejected with WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { awayGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, awayGk.id, { q: 5, r: 5 });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('outside the two GK-setup phases the event is rejected with WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeOutfield.id, { q: 5, r: 5 });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_TAKER_SELECT');
  });

  it('a valid placement during the attacking GK window repositions the GK and broadcasts to both sockets', async () => {
    const { clientA, clientB, roomCode } = await setupRoom();
    const { homeGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeGk.id, { q: 6, r: 6 });
    const [[stateA], [stateB]] = await Promise.all([stateAPromise, stateBPromise]);

    expect(stateA.pieces.find((p) => p.id === homeGk.id)!.position).toEqual({ q: 6, r: 6 });
    expect(stateB.pieces.find((p) => p.id === homeGk.id)!.position).toEqual({ q: 6, r: 6 });
    expect(stateA.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('the defending GK window accepts a placement from the defending team', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { awayGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_DEFENDING');

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, awayGk.id, { q: 30, r: 6 });
    const [state] = await statePromise;

    expect(state.pieces.find((p) => p.id === awayGk.id)!.position).toEqual({ q: 30, r: 6 });
  });

  it('two rapid successive emissions are each serialized through the isProcessing mutex and both land cleanly', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    // applyCornerKickGkPlace explicitly allows re-placing the same GK within the same
    // window (no lock/budget tracking, per its own doc comment) — so unlike
    // GAME_CORNER_KICK_TAKER (which transitions phase and blocks a second attempt),
    // GK_PLACE's mutex-serialization proof is that BOTH synchronous, back-to-back
    // emits complete cleanly (no corrupted/interleaved state) and the room is left
    // unlocked, with the final broadcast state reflecting the LAST accepted placement.
    const statesPromise = waitForNStates(clientA, 2);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeGk.id, { q: 6, r: 6 });
    clientA.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, homeGk.id, { q: 7, r: 6 });
    const states = await statesPromise;

    const placeEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'CORNER_KICK_GK_PLACE',
    );
    expect(placeEvents).toHaveLength(2);
    expect(states[states.length - 1]!.pieces.find((p) => p.id === homeGk.id)!.position).toEqual({
      q: 7,
      r: 6,
    });
    expect(getRoom(roomCode)!.isProcessing).toBe(false);
  });

  it('a rejected placement leaves room.isProcessing false (finally-release)', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { awayGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, awayGk.id, { q: 5, r: 5 });
    await errorPromise;

    expect(getRoom(roomCode)!.isProcessing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CORNER-02: GAME_CORNER_KICK_TAKER
// ---------------------------------------------------------------------------

describe('CORNER-02: GAME_CORNER_KICK_TAKER', () => {
  it('a piece belonging to the other team is rejected with WRONG_TEAM', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { awayOutfield } = seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, awayOutfield.id);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_TAKER_SELECT');
  });

  it('a non-kicking-team socket is rejected with WRONG_TEAM even for a valid own-team-of-the-kicker piece id', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { homeOutfield } = seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeOutfield.id);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
  });

  it('outside CORNER_KICK_TAKER_SELECT the event is rejected with WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeGk } = seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeGk.id);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });

  it('a non-string payload is rejected and does not mutate the phase', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_CORNER_KICK_TAKER, 12345);
    await errorPromise;

    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_TAKER_SELECT');
  });

  it('a valid selection places the taker and the ball and transitions to CORNER_KICK_REPOSITION', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedCornerKickTakerSelect(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeOutfield.id);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_REPOSITION');
    expect(state.cornerKickTakerId).toBe(homeOutfield.id);
    expect(state.ball.carrierId).toBe(homeOutfield.id);
    expect(state.pieces.find((p) => p.id === homeOutfield.id)!.position).toEqual(CORNER_HEX);
  });

  it('two rapid successive emissions leave exactly one CORNER_KICK_TAKER_PLACED event in the log', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { homeOutfield } = seedCornerKickTakerSelect(roomCode);

    const statesPromise = waitForNStates(clientA, 1);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeOutfield.id);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, homeOutfield.id);
    await statesPromise;

    const placeEvents = getRoom(roomCode)!.gameState!.eventLog.filter(
      (e) => e.type === 'CORNER_KICK_TAKER_PLACED',
    );
    expect(placeEvents).toHaveLength(1);
  });

  it('a rejected selection leaves room.isProcessing false (finally-release)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { awayOutfield } = seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_CORNER_KICK_TAKER, awayOutfield.id);
    await errorPromise;

    expect(getRoom(roomCode)!.isProcessing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CORNER-01: GAME_END_TURN wiring for the two GK-setup windows
// ---------------------------------------------------------------------------

describe('CORNER-01: GAME_END_TURN wiring for CORNER_KICK_GK_SETUP_ATTACKING/_DEFENDING', () => {
  it('ending the attacking GK window with zero placements hands off to the defending window (D-06)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_GK_SETUP_DEFENDING');
    expect(state.activeTeam).toBe('away');
  });

  it('ending the defending GK window transitions to CORNER_KICK_TAKER_SELECT', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_DEFENDING');

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_TAKER_SELECT');
    expect(state.activeTeam).toBe('home');
  });

  it('the non-acting team ending the attacking GK window is rejected with WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
  });
});

// ---------------------------------------------------------------------------
// CORNER-03: GAME_MOVE / GAME_END_TURN during CORNER_KICK_REPOSITION
// ---------------------------------------------------------------------------

describe('CORNER-03: GAME_MOVE/GAME_END_TURN during CORNER_KICK_REPOSITION', () => {
  it('a valid move by the eligible attacking piece logs a MOVE event and repositions the piece', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId, eligibleHomeNeighbor } = seedCornerKickReposition(roomCode);

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, eligibleHomeNeighbor);
    const [state] = await statePromise;

    expect(state.pieces.find((p) => p.id === eligibleHomeId)!.position).toEqual(
      eligibleHomeNeighbor,
    );
    const moveEvents = state.eventLog.filter(
      (e) => e.type === 'MOVE' && 'pieceId' in e && e.pieceId === eligibleHomeId,
    );
    expect(moveEvents).toHaveLength(1);
  });

  it('a move by the non-acting (defending-side) team at the attacking stage is rejected with WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { eligibleAwayId, eligibleAwayNeighbor } = seedCornerKickReposition(roomCode);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, eligibleAwayId, eligibleAwayNeighbor);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
  });

  it('ending the stage with zero moves made is legal (D-06) and advances to the next stage', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickReposition(roomCode, { stageIndex: 0 });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_REPOSITION');
    expect(state.cornerKickStageIndex).toBe(1);
    expect(state.activeTeam).toBe('away');
  });

  it('ending the terminal stage (5) transitions to CORNER_KICK_FINAL_SETUP', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedCornerKickReposition(roomCode, { stageIndex: 5 });

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_FINAL_SETUP');
    expect(state.cornerKickMoveSlot).toBe('ATTACKER');
  });

  it('the non-acting team ending the stage is rejected with WRONG_TEAM and does not advance', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedCornerKickReposition(roomCode, { stageIndex: 0 });

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.cornerKickStageIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CORNER-06: GAME_MOVE / GAME_END_TURN during CORNER_KICK_FINAL_SETUP
// ---------------------------------------------------------------------------

describe('CORNER-06: GAME_MOVE/GAME_END_TURN during CORNER_KICK_FINAL_SETUP', () => {
  it('a valid move by the eligible attacking piece logs exactly one CORNER_KICK_MOVE event', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId, eligibleHomeNeighbor } = seedCornerKickFinalSetup(roomCode, {
      slot: 'ATTACKER',
    });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, eligibleHomeNeighbor);
    const [state] = await statePromise;

    expect(state.pieces.find((p) => p.id === eligibleHomeId)!.position).toEqual(
      eligibleHomeNeighbor,
    );
    const moveEvents = state.eventLog.filter((e) => e.type === 'CORNER_KICK_MOVE');
    // Exactly one — proves the handler does not double-log on top of
    // applyCornerKickFinalMove's own internal event append.
    expect(moveEvents).toHaveLength(1);
  });

  it('a move by the non-acting team during the ATTACKER slot is rejected with WRONG_TEAM', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { eligibleAwayId, eligibleAwayNeighbor } = seedCornerKickFinalSetup(roomCode, {
      slot: 'ATTACKER',
    });

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, eligibleAwayId, eligibleAwayNeighbor);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
  });

  it('ending the ATTACKER slot hands off to DEFENDER with no dice rolled', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickFinalSetup(roomCode, { slot: 'ATTACKER' });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('CORNER_KICK_FINAL_SETUP');
    expect(state.cornerKickMoveSlot).toBe('DEFENDER');
    expect(state.activeTeam).toBe('away');
    expect(state.lastDiceRoll).toBeNull();
  });

  it('ending the DEFENDER slot resolves into PASS with lastActionType CORNER_KICK_RESTART and no dice rolled', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedCornerKickFinalSetup(roomCode, { slot: 'DEFENDER' });

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_END_TURN);
    const [state] = await statePromise;

    expect(state.phase).toBe('PASS');
    expect(state.lastActionType).toBe('CORNER_KICK_RESTART');
    expect(state.attackingTeam).toBe('home');
    expect(state.activeTeam).toBe('home');
    expect(state.lastDiceRoll).toBeNull();
    // Pitfall 3: cornerKickTeam/cornerKickHex/cornerKickTakerId survive into PASS —
    // the later accuracy-resolution site (Task 3) reads them after lastActionType has
    // already been overwritten by the client's chosen passType.
    expect(state.cornerKickTeam).toBe('home');
  });

  it('the non-acting team ending the DEFENDER slot is rejected with WRONG_TEAM', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickFinalSetup(roomCode, { slot: 'DEFENDER' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_FINAL_SETUP');
  });
});

// ---------------------------------------------------------------------------
// GAME_UNDO across the five corner-kick phases
// ---------------------------------------------------------------------------

describe('GAME_UNDO validUndoPhases coverage for Corner Kick', () => {
  it('CORNER_KICK_REPOSITION accepts Undo after a move', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId, eligibleHomeNeighbor } = seedCornerKickReposition(roomCode);
    const preMovePosition = getRoom(roomCode)!.gameState!.pieces.find(
      (p) => p.id === eligibleHomeId,
    )!.position;

    const movePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, eligibleHomeNeighbor);
    await movePromise;

    // WR-03 (38-10, gap closure): Undo previously silently no-op'd (CR-02) and this test
    // asserted only state.phase, which stays 'CORNER_KICK_REPOSITION' on both success AND
    // failure — masking the bug. Register a persistent GAME_ERROR listener BEFORE emitting
    // GAME_UNDO (not awaited, so a GAME_ERROR that never fires cannot hang the test), then
    // assert Undo's actual effect: position, pace ledger, and stage-cap membership.
    let errorReason: string | undefined;
    const errorHandler = (reason: string): void => {
      errorReason = reason;
    };
    clientA.on(ServerEvents.GAME_ERROR, errorHandler);

    const undoPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_UNDO);
    const [state] = await undoPromise;
    clientA.off(ServerEvents.GAME_ERROR, errorHandler);

    expect(errorReason).toBeUndefined();
    expect(state.phase).toBe('CORNER_KICK_REPOSITION');
    const moved = state.pieces.find((p) => p.id === eligibleHomeId);
    expect(moved?.position).toEqual(preMovePosition);
    expect(state.cornerKickUsedPace?.[eligibleHomeId]).toBeUndefined();
    expect(state.cornerKickStagePlacedIds ?? []).not.toContain(eligibleHomeId);
  });

  it('CORNER_KICK_FINAL_SETUP accepts Undo after a move', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { eligibleHomeId, eligibleHomeNeighbor } = seedCornerKickFinalSetup(roomCode, {
      slot: 'ATTACKER',
    });
    const preMovePosition = getRoom(roomCode)!.gameState!.pieces.find(
      (p) => p.id === eligibleHomeId,
    )!.position;

    const movePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, eligibleHomeId, eligibleHomeNeighbor);
    await movePromise;

    // WR-03 (38-10, gap closure): Undo previously silently no-op'd (CR-01) here too — assert
    // the actual effect (position + single-piece lock/pace release), not just state.phase.
    let errorReason: string | undefined;
    const errorHandler = (reason: string): void => {
      errorReason = reason;
    };
    clientA.on(ServerEvents.GAME_ERROR, errorHandler);

    const undoPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_UNDO);
    const [state] = await undoPromise;
    clientA.off(ServerEvents.GAME_ERROR, errorHandler);

    expect(errorReason).toBeUndefined();
    expect(state.phase).toBe('CORNER_KICK_FINAL_SETUP');
    const moved = state.pieces.find((p) => p.id === eligibleHomeId);
    expect(moved?.position).toEqual(preMovePosition);
    expect(state.cornerKickMovedPieceId).toBeNull();
    expect(state.cornerKickPaceUsed).toBe(0);
  });

  it('CORNER_KICK_TAKER_SELECT rejects Undo with WRONG_PHASE (placement, no reversible move)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_UNDO);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
  });

  it('CORNER_KICK_GK_SETUP_ATTACKING rejects Undo with WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_ATTACKING');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_UNDO);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
  });

  it('CORNER_KICK_GK_SETUP_DEFENDING rejects Undo with WRONG_PHASE', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedCornerKickGkSetup(roomCode, 'CORNER_KICK_GK_SETUP_DEFENDING');

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_UNDO);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
  });
});

// ---------------------------------------------------------------------------
// CORNER_KICK_CLEAR_OUT over the socket (38-15 defect 3, Plan 38-21)
// ---------------------------------------------------------------------------

describe('CORNER_KICK_CLEAR_OUT over the socket (38-15 defect 3)', () => {
  it("a non-acting socket's clear-out move is rejected with WRONG_TEAM and changes nothing", async () => {
    const { clientB, roomCode } = await setupRoom();
    const { inZoneHomeId, inZoneHomeStart } = seedCornerKickClearOut(roomCode, {
      slot: 'ATTACKER',
    });
    const target = clearOutLegalTarget(inZoneHomeStart);

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_MOVE, inZoneHomeId, target);
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_CLEAR_OUT');
    expect(
      getRoom(roomCode)!.gameState!.pieces.find((p) => p.id === inZoneHomeId)!.position,
    ).toEqual(inZoneHomeStart);
  });

  it('a malformed `to` payload is rejected with INVALID_TARGET', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { inZoneHomeId } = seedCornerKickClearOut(roomCode, { slot: 'ATTACKER' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clientA as any).emit(ClientEvents.GAME_MOVE, inZoneHomeId, null);
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_CLEAR_OUT');
  });

  it('an engine rejection reason reaches the requesting socket verbatim as a GAME_ERROR (NOT_TOWARD_GOAL)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { inZoneHomeId, inZoneHomeStart } = seedCornerKickClearOut(roomCode, {
      slot: 'ATTACKER',
    });
    const illegalTarget = clearOutIllegalTarget(inZoneHomeStart);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_MOVE, inZoneHomeId, illegalTarget);
    const [reason] = await errorPromise;

    expect(reason).toBe('NOT_TOWARD_GOAL');
    expect(
      getRoom(roomCode)!.gameState!.pieces.find((p) => p.id === inZoneHomeId)!.position,
    ).toEqual(inZoneHomeStart);
  });

  it('confirming with an in-zone movable piece emits MUST_CLEAR_CORNER and does not advance the slot', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickClearOut(roomCode, { slot: 'ATTACKER' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [reason] = await errorPromise;

    expect(reason).toBe('MUST_CLEAR_CORNER');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('CORNER_KICK_CLEAR_OUT');
    expect(getRoom(roomCode)!.gameState!.cornerKickClearOutSlot).toBe('ATTACKER');
  });

  it('exactly one CORNER_KICK_CLEAR_OUT_MOVE is appended per accepted move (double-log guard)', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { inZoneHomeId, inZoneHomeStart } = seedCornerKickClearOut(roomCode, {
      slot: 'ATTACKER',
    });
    const target = clearOutLegalTarget(inZoneHomeStart);
    const eventsBefore = getRoom(roomCode)!.gameState!.eventLog.length;

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_MOVE, inZoneHomeId, target);
    const [state] = await statePromise;

    expect(state.pieces.find((p) => p.id === inZoneHomeId)!.position).toEqual(target);
    expect(state.eventLog.length - eventsBefore).toBe(1);
    const clearOutMoveEvents = state.eventLog.filter(
      (e) => e.type === 'CORNER_KICK_CLEAR_OUT_MOVE',
    );
    expect(clearOutMoveEvents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GAME_ROLL is rejected in every corner setup phase (DICE_PHASES exclusion)
// ---------------------------------------------------------------------------

describe('GAME_ROLL rejected in corner setup phases', () => {
  it('GAME_ROLL during CORNER_KICK_REPOSITION is rejected with WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickReposition(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', { q: 15, r: 10 });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
  });

  it('GAME_ROLL during CORNER_KICK_TAKER_SELECT is rejected with WRONG_PHASE', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedCornerKickTakerSelect(roomCode);

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', { q: 15, r: 10 });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_PHASE');
  });
});

// ---------------------------------------------------------------------------
// CORNER-04: penalty-area-conditional range override for a High Pass corner
// ---------------------------------------------------------------------------

describe('CORNER-04: GAME_ROLL High Pass corner range override', () => {
  it('cornerKickTeam=away: a High corner targeting deep inside homePenaltyArea (dist 18) is accepted regardless of distance', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { carrierId } = seedPassRangeState(roomCode, { cornerKickTeam: 'away' });
    const room = getRoom(roomCode)!;
    // Carrier deliberately kept in the MIDDLE third (not a final third): a carrier left
    // behind in the OPPOSITE final third after the kick would legitimately trigger the
    // unrelated ball-zone free-move interrupt (applyFreeMoveZoneCheck), which is real
    // engine behavior but would obscure this test's actual subject (the range override).
    room.gameState = {
      ...room.gameState!,
      pieces: room.gameState!.pieces.map((p) =>
        p.id === carrierId ? { ...p, position: { q: 20, r: 12 } } : p,
      ),
      ball: { ...room.gameState!.ball, position: { q: 20, r: 12 } },
    };

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    // {q:2,r:12} is inside homePenaltyArea, distance 18 from the {20,12} carrier —
    // beyond the ordinary 15-hex HIGH cap, so acceptance proves the override fired.
    clientB.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', { q: 2, r: 12 });
    const [state] = await statePromise;

    expect(state.phase).toBe('HIGH_PASS_MOVE');
    expect(state.ball.position).toEqual({ q: 2, r: 12 });
  });

  it('cornerKickTeam=away: a High corner targeting outside homePenaltyArea at distance 16 is rejected with RANGE_EXCEEDED (wire: INVALID_TARGET)', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedPassRangeState(roomCode, { cornerKickTeam: 'away' });

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    // {q:34,r:13} is distance 16 from RANGE_CARRIER_HEX and outside homePenaltyArea (q>5).
    clientB.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', { q: 34, r: 13 });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
    expect(getRoom(roomCode)!.gameState!.phase).toBe('PASS');
  });

  it('cornerKickTeam=away: the same out-of-box High corner at distance 15 is accepted (default HIGH cap untouched)', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedPassRangeState(roomCode, { cornerKickTeam: 'away' });

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    // {q:33,r:13} is distance 15 from RANGE_CARRIER_HEX and outside homePenaltyArea.
    clientB.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', { q: 33, r: 13 });
    const [state] = await statePromise;

    expect(state.phase).toBe('HIGH_PASS_MOVE');
  });

  it('cornerKickTeam=home (mirror): a High corner targeting deep inside awayPenaltyArea (dist 18) is accepted regardless of distance', async () => {
    const { clientA, roomCode } = await setupRoom();
    const { carrierId } = seedPassRangeState(roomCode, { cornerKickTeam: 'home' });
    const room = getRoom(roomCode)!;
    // Carrier kept in the MIDDLE third — see the identical note in the away-team test above.
    room.gameState = {
      ...room.gameState!,
      pieces: room.gameState!.pieces.map((p) =>
        p.id === carrierId ? { ...p, position: { q: 16, r: 12 } } : p,
      ),
      ball: { ...room.gameState!.ball, position: { q: 16, r: 12 } },
    };

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    // {q:34,r:12} is inside awayPenaltyArea, distance 18 from the {16,12} carrier.
    clientA.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', { q: 34, r: 12 });
    const [state] = await statePromise;

    expect(state.phase).toBe('HIGH_PASS_MOVE');
    expect(state.ball.position).toEqual({ q: 34, r: 12 });
  });

  it('cornerKickTeam=home (mirror): a High corner targeting outside awayPenaltyArea at distance 16 is rejected', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedPassRangeState(roomCode, { cornerKickTeam: 'home' });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // {q:2,r:13} is distance 16 from RANGE_CARRIER_HEX and outside awayPenaltyArea (q<31).
    clientA.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', { q: 2, r: 13 });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
  });

  it('cornerKickTeam=home (mirror): the same out-of-box High corner at distance 15 is accepted', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedPassRangeState(roomCode, { cornerKickTeam: 'home' });

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    // {q:3,r:13} is distance 15 from RANGE_CARRIER_HEX and outside awayPenaltyArea.
    clientA.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', { q: 3, r: 13 });
    const [state] = await statePromise;

    expect(state.phase).toBe('HIGH_PASS_MOVE');
  });

  it('a STANDARD_PASS (Low) corner receives no range override and is bound by the ordinary 11-hex STANDARD cap', async () => {
    const { clientB, roomCode } = await setupRoom();
    seedPassRangeState(roomCode, { cornerKickTeam: 'away' });

    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    // {q:2,r:13} is inside homePenaltyArea and distance 18 from RANGE_CARRIER_HEX — the
    // override is scoped to HIGH_PASS only (CORNER-04), so STANDARD's 11-hex cap applies.
    clientB.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', { q: 2, r: 13 });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
  });

  it('a non-corner High Pass into a penalty area is still capped at 15 (regression)', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedPassRangeState(roomCode, { cornerKickTeam: null });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // {q:0,r:13} is inside homePenaltyArea and distance 18 — with no cornerKickTeam set,
    // isCornerKickContext is false, so the ordinary 15-hex HIGH cap applies unmodified.
    clientA.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', { q: 0, r: 13 });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
  });

  it('a throw-in High Pass still gets THROW_IN_MAX_DISTANCE, not the corner override', async () => {
    const { clientA, roomCode } = await setupRoom();
    seedPassRangeState(roomCode, {
      cornerKickTeam: null,
      lastActionType: 'THROW_IN_MOVEMENT_1',
    });

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    // {q:25,r:13} is distance 7 from RANGE_CARRIER_HEX — exceeds THROW_IN_MAX_DISTANCE
    // (6) while staying well inside the ordinary 15-hex HIGH cap, proving the throw-in
    // override (not the corner override, and not the default HIGH cap) is in effect.
    clientA.emit(ClientEvents.GAME_ROLL, 'HIGH_PASS', { q: 25, r: 13 });
    const [reason] = await errorPromise;

    expect(reason).toBe('INVALID_TARGET');
  });
});

// ---------------------------------------------------------------------------
// CORNER-04 (38-13 Task 2): Low corner interception dice seeding
// ---------------------------------------------------------------------------

/** A pitch hex used as the ball-carrier position for the interception-dice-seeding test. */
const INTERCEPT_CARRIER_HEX: HexCoord = { q: 18, r: 13 };
/** Within STANDARD's 11-hex cap of INTERCEPT_CARRIER_HEX (distance 4). */
const INTERCEPT_TARGET_HEX: HexCoord = { q: 22, r: 11 };
/** Adjacent to {q:20,r:12} (an intermediate hex on the carrier->target path) but NOT itself
 * on the path and NOT the destination — a case-3 ZoI roll-intercept, not a case-1 auto-intercept. */
const INTERCEPT_ZOI_HEX: HexCoord = { q: 20, r: 11 };

/**
 * Seeds a corner-kick Low-pass PASS state with exactly one home defender positioned in ZoI
 * of the intended pass path (not on the path, not on the destination) and an away carrier
 * whose highPass is overridden high enough that the corner's own 8+ accuracy check always
 * passes regardless of the real (unmocked) accuracy die — isolating this test's assertion to
 * the interception-dice seeding plumbing, not the independent accuracy roll. Every other
 * piece is parked out of the way at column 12 (mirrors seedPassRangeState) so no other piece
 * can accidentally populate the interception lists.
 */
function seedCornerLowInterceptState(roomCode: string): { carrierId: string; defenderId: string } {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const carrier = room.gameState.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;
  const defender = room.gameState.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;

  const pieces = room.gameState.pieces.map((p, idx) => {
    if (p.id === carrier.id) return { ...p, position: INTERCEPT_CARRIER_HEX, highPass: 10 };
    if (p.id === defender.id) return { ...p, position: INTERCEPT_ZOI_HEX };
    return { ...p, position: { q: 12, r: idx % 25 } };
  });

  room.gameState = {
    ...room.gameState,
    phase: 'PASS',
    outOfBoundsEnabled: true,
    pieces,
    attackingTeam: 'away',
    activeTeam: 'away',
    kickOffActive: false,
    lastActionType: 'CORNER_KICK_RESTART',
    lastDiceRoll: null,
    passTargetHex: null,
    cornerKickTeam: 'away',
    cornerKickHex: INTERCEPT_CARRIER_HEX,
    cornerKickTakerId: carrier.id,
    ball: {
      position: INTERCEPT_CARRIER_HEX,
      carrierId: carrier.id,
      lastTouchedBy: { pieceId: carrier.id, teamId: 'away' },
    },
  };

  return { carrierId: carrier.id, defenderId: defender.id };
}

describe('CORNER-04: a Low corner aimed past a ZoI defender seeds preGeneratedInterceptionDice', () => {
  it('emits a STEAL_ATTEMPT event with a non-zero defenderDie, proving the handler seeded preGeneratedInterceptionDice before applyRoll consumed them', async () => {
    const { clientB, roomCode } = await setupRoom();
    const { defenderId } = seedCornerLowInterceptState(roomCode);

    const statePromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_ROLL, 'STANDARD_PASS', INTERCEPT_TARGET_HEX);
    const [state] = await statePromise;

    // Before Task 1 (38-13), a corner's own isCornerKick bypass meant a Low corner never
    // reached the interception loop at all — no STEAL_ATTEMPT could ever be logged for a
    // corner pass. Its presence here proves both that the loop is reached (Task 1) and that
    // the roll-intercept die was populated from preGeneratedInterceptionDice rather than
    // silently defaulting (the only path that can produce a STEAL_ATTEMPT event for a
    // ZoI-only defender at all).
    const stealEvent = state.eventLog.find((e) => e.type === 'STEAL_ATTEMPT');
    expect(stealEvent).toBeDefined();
    expect(stealEvent).toMatchObject({ type: 'STEAL_ATTEMPT', defenderId });
    if (stealEvent?.type === 'STEAL_ATTEMPT') {
      expect(stealEvent.defenderDie).toBeGreaterThan(0);
    }
  });
});
