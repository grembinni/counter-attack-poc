/**
 * Phase 40 Plan 07 (final wave): the ONE integration test file that proves the whole
 * substitution feature works across the real socket boundary with two connected
 * clients. Plans 40-01..40-06 each verified their own layer in isolation (bench
 * seeding at LINEUP_CONFIRM, the stoppage gate, the engine rules, the added-time
 * fold-in, D-13's red-card bench relocation, roster continuity through a goal) — this
 * file is the only place those seams are exercised TOGETHER, end to end, over a real
 * Socket.io server + socket.io-client (no mocking of the server itself, except a
 * single fixed rollDice() return injected below purely for the SUB-05 added-time
 * assertion's determinism).
 *
 * Structure mirrors goalKick.integration.test.ts / foulFreeKick.integration.test.ts
 * (server lifecycle, createClient/oncePromise/waitForConnect) and
 * draftSession.integration.test.ts (drive a DRAFT room to a live match — the draft
 * room is the only room type with a non-empty, substitutable bench today).
 *
 * HISTORICAL NOTE (superseded by Phase 46, CONTEXT.md D-05..D-09 — kept for context,
 * not current behavior): a STANDARD-mode room's squads hold exactly 11 players
 * (packages/shared/src/teams.ts), so D-02/D-12's original derivation (bench = roster
 * minus the starting 11) yielded an EMPTY bench for a Standard room. Phase 40
 * deliberately did NOT generate or seed a Standard-room bench (D-10's pool-based
 * auto-fill design was explicitly retracted by the user during Phase 40's
 * requirements definition), and the D-12 test below asserted an EMPTY bench and a
 * rejected substitution attempt as WORKING AS INTENDED. Phase 46 (D-06) revisited
 * that stance and superseded it: standard rooms now fall back to a generic 5-player
 * placeholder bench per side (`getGenericBenchPlayers`, `roomHandlers.ts`) so
 * substitution works end to end outside Draft mode too — see the "Phase 46
 * D-05..D-09" describe block below, which replaces the old empty-bench test.
 *
 * Coverage (numbered to match 40-07-PLAN.md's Task 1 action list):
 * 1. SUB-02/SUB-03: post-LINEUP_CONFIRM broadcast bench/subsUsed/addedTimeBonus/playerId shape.
 * 2/3. SUB-01/SUB-02/SUB-03: a KICK_OFF_SETUP substitution (home, then away) — number/
 *    hex inheritance, subsUsed increment, bench status flip, SUBSTITUTION eventLog tail.
 * 4. SUB-07: re-subbing the just-departed player is rejected ALREADY_SUBBED.
 * 5. SUB-04: the 3-substitution cap survives a seeded HALF_TIME transition.
 * 6. SUB-05: addedTime = injected roll + refereeCard.leniency + subs made that half.
 * 7. SUB-06/D-08: CANNOT_SUB_RED_CARD for the outgoing red-carded piece; a different
 *    piece still subs successfully; the team stays at 10 on-pitch (maxOnPitchFor).
 * 8. D-13: a REAL foul (seeded via a direct, unmocked applyMove call — mirrors
 *    foulFreeKick.integration.test.ts's "seed via engine, drive over sockets"
 *    pattern) produces a red card; both clients' broadcast GameState shows the bench
 *    entry, the still-present onPitch:false piece, maxOnPitchFor===10, and a
 *    CANNOT_SUB_IN_RED_CARDED rejection over the wire.
 * 9. SUB-03/SUB-07: a substitute survives a real goal-triggered kick-off reset; the
 *    departed player never reappears; the bench (including an unrelated pre-existing
 *    D-13 entry) is unchanged.
 * 10. SETTINGS-04: the basic success case with all four v1.6 toggles off and again on.
 * 11. Phase 46 D-05..D-09 (supersedes the old D-12 empty-bench case): a STANDARD
 *     room reaches a live match with a 5-player generic placeholder bench per side,
 *     and a generic bench outfielder substitutes onto the pitch end to end.
 *
 * Also closes the threat register (T-40-22): a cross-team substitution attempt is
 * rejected WRONG_TEAM without mutating either team's subsUsed.
 */

// vi.mock is hoisted by vitest — must appear before other imports. Forces the ONE
// rollDice() call this file relies on (GAME_END_TURN's addedTimeRoll, case 6/SUB-05)
// to return a fixed, known value instead of a real crypto roll, so the added-time
// assertion can compute its expectation instead of hard-coding a total. Every other
// scenario in this file either performs no real dice roll at all (substitution/draft/
// lineup actions are dice-free) or seeds its dice explicitly via a direct applyMove()
// call (case 8/D-13), which never reads rollDice() — the mock is inert there. MOCKED_ROLL
// below must be kept in sync with this literal (kept literal, not a shared reference, to
// avoid vi.mock's hoist-above-declarations temporal-dead-zone pitfall).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../diceUtils.js', () => ({ rollDice: () => 4 }));
const MOCKED_ROLL = 4;

import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { broadcastState, clearAllRooms, getRoom } from '../roomStore.js';
import { applyMove } from '../gameEngine.js';
import { confirmDefaultRoomSettings } from './testHelpers.js';
import type {
  BenchEntry,
  ClientToServerEvents,
  DraftClientView,
  DraftPickPayload,
  GameState,
  HexCoord,
  PlayerPiece,
  ServerToClientEvents,
} from '@counter-attack/shared';
import {
  ClientEvents,
  ServerEvents,
  FORMATIONS,
  PLAYER_POOL,
  computeBallZone,
  hexNeighbors,
  isPitchHex,
  maxOnPitchFor,
} from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Server lifecycle (mirrors goalKick.integration.test.ts / foulFreeKick.integration.test.ts)
// ---------------------------------------------------------------------------

let httpServer: ReturnType<typeof buildServer>['httpServer'];
let io: ReturnType<typeof buildServer>['io'];
let address: string;
const connectedClients: Socket[] = [];

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  io = server.io;
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
// Transport helpers (copied verbatim per the per-file self-contained convention)
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

// ---------------------------------------------------------------------------
// Draft-mode setup (mirrors draftSession.integration.test.ts's
// setupThroughDraftUniformConfirm/makeDraftDriver/pickIntoLineup/
// driveDraftToCompletionFillingLineups verbatim — self-contained per file)
// ---------------------------------------------------------------------------

type Toggles = {
  outOfBounds: boolean;
  fouls: boolean;
  booking: boolean;
  injury: boolean;
  tackleStealDecline: boolean;
};
const TOGGLES_OFF: Toggles = {
  outOfBounds: false,
  fouls: false,
  booking: false,
  injury: false,
  tackleStealDecline: false,
};

function confirmDraftRoomSettings(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  toggles: Toggles,
  timeoutMs = 1000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ROOM_SETTINGS_CONFIRMED after ${timeoutMs}ms`));
    }, timeoutMs);
    clientA.once(ServerEvents.ROOM_SETTINGS_CONFIRMED, () => {
      clearTimeout(timer);
      resolve();
    });
    clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'draft',
      draftPools: ['original'],
      outOfBounds: toggles.outOfBounds,
      fouls: toggles.fouls,
      booking: toggles.booking,
      injury: toggles.injury,
      tackleStealDecline: toggles.tackleStealDecline,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });
}

async function setupThroughDraftUniformConfirm(toggles: Toggles): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  viewA: DraftClientView;
  viewB: DraftClientView;
  roomCode: string;
}> {
  const clientA = createClient();
  const clientB = createClient();
  await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

  const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
  clientA.emit(ClientEvents.ROOM_CREATE);
  const [roomCode] = await createJoinedPromise;

  await confirmDraftRoomSettings(clientA, toggles);

  const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
  const selectionStartPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START, 2000);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  await joinedBPromise;
  await selectionStartPromise;

  const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED, 2000);
  clientA.emit(ClientEvents.TEAM_PICK, 'city');
  await homePickedPromise;

  const uniformStartPromise = oncePromise(clientA, ServerEvents.UNIFORM_SELECTION_START, 2000);
  clientB.emit(ClientEvents.TEAM_PICK, 'crew');
  await uniformStartPromise;

  const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED, 2000);
  clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
  await homeConfirmedPromise;

  const draftAPromise = oncePromise(clientA, ServerEvents.DRAFT_STATE_UPDATED, 2000);
  const draftBPromise = oncePromise(clientB, ServerEvents.DRAFT_STATE_UPDATED, 2000);
  clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');
  const [[viewA], [viewB]] = await Promise.all([draftAPromise, draftBPromise]);

  return { clientA, clientB, viewA, viewB, roomCode };
}

function makeDraftDriver(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>,
  initialViewA: DraftClientView,
  initialViewB: DraftClientView,
) {
  let viewA = initialViewA;
  let viewB = initialViewB;
  clientA.on(ServerEvents.DRAFT_STATE_UPDATED, (v) => {
    viewA = v;
  });
  clientB.on(ServerEvents.DRAFT_STATE_UPDATED, (v) => {
    viewB = v;
  });

  function waitForBothUpdate(timeoutMs = 1500): Promise<void> {
    return new Promise((resolve, reject) => {
      let count = 0;
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for both updates')),
        timeoutMs,
      );
      const check = (): void => {
        count++;
        if (count >= 2) {
          clearTimeout(timer);
          resolve();
        }
      };
      clientA.once(ServerEvents.DRAFT_STATE_UPDATED, check);
      clientB.once(ServerEvents.DRAFT_STATE_UPDATED, check);
    });
  }

  async function pick(
    who: Socket<ServerToClientEvents, ClientToServerEvents>,
    cardId: string,
    destination: DraftPickPayload['destination'],
  ): Promise<void> {
    const done = waitForBothUpdate();
    who.emit(ClientEvents.DRAFT_PICK, { cardId, destination });
    await done;
  }

  return {
    pick,
    getViewA: () => viewA,
    getViewB: () => viewB,
  };
}

const SLOT_ROLES = FORMATIONS['4-4-2'].slots.map((s) => s.slotRole);

/** Picks the front card of the side's current pack into the first compatible empty lineup
 * slot (GK card -> GK slot, non-GK card -> any empty non-GK slot); falls back to the bench
 * once no compatible empty slot remains. Mirrors the GK-slot role rule enforced server-side. */
async function pickIntoLineup(
  who: Socket<ServerToClientEvents, ClientToServerEvents>,
  driver: ReturnType<typeof makeDraftDriver>,
  which: 'A' | 'B',
): Promise<void> {
  const view = which === 'A' ? driver.getViewA() : driver.getViewB();
  const card = view.currentPack[0]!;
  let destSlotIndex = -1;
  for (let i = 0; i < SLOT_ROLES.length; i++) {
    if (view.lineupSlots[i] !== null) continue;
    const isGKSlot = SLOT_ROLES[i] === 'GK';
    const isGKCard = card.role === 'GK';
    if (isGKSlot === isGKCard) {
      destSlotIndex = i;
      break;
    }
  }
  const destination: DraftPickPayload['destination'] =
    destSlotIndex >= 0 ? { type: 'slot', slotIndex: destSlotIndex } : { type: 'bench' };
  await driver.pick(who, card.id, destination);
}

/** Drives all 6 rounds to draftComplete for both sides, filling lineup slots along the way. */
async function driveDraftToCompletionFillingLineups(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>,
  viewA: DraftClientView,
  viewB: DraftClientView,
): Promise<ReturnType<typeof makeDraftDriver>> {
  const driver = makeDraftDriver(clientA, clientB, viewA, viewB);

  let guard = 0;
  while (!(driver.getViewA().draftComplete && driver.getViewB().draftComplete) && guard < 400) {
    guard++;
    if (driver.getViewA().picksRemaining > 0) {
      await pickIntoLineup(clientA, driver, 'A');
    } else if (driver.getViewB().picksRemaining > 0) {
      await pickIntoLineup(clientB, driver, 'B');
    } else {
      break;
    }
  }

  return driver;
}

/**
 * Drives a DRAFT room all the way to a live KICK_OFF_SETUP match (both sides'
 * LINEUP_CONFIRM), returning the connected clients and the initial broadcast
 * GameState both clients received. This is the shared entry point for every test in
 * this file that needs a real, substitutable 6-entry bench per team (SUB-02/07).
 */
async function setupLiveDraftMatch(toggles: Toggles = TOGGLES_OFF): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  roomCode: string;
  stateA: GameState;
  stateB: GameState;
}> {
  const { clientA, clientB, viewA, viewB, roomCode } =
    await setupThroughDraftUniformConfirm(toggles);
  const driver = await driveDraftToCompletionFillingLineups(clientA, clientB, viewA, viewB);
  expect(driver.getViewA().draftComplete).toBe(true);
  expect(driver.getViewB().draftComplete).toBe(true);

  const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE, 2000);
  const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE, 2000);
  clientA.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: [] });
  clientB.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: [] });
  const [[stateA], [stateB]] = await Promise.all([stateAPromise, stateBPromise]);

  return { clientA, clientB, roomCode, stateA, stateB };
}

// ---------------------------------------------------------------------------
// Standard-mode setup (mirrors goalKick.integration.test.ts's setupRoom() verbatim)
// — the STANDARD path for the Phase 46 generic-placeholder-bench case (case 11).
// ---------------------------------------------------------------------------

async function setupStandardMatch(): Promise<{
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
// Small query helpers shared by several cases below
// ---------------------------------------------------------------------------

function homeOutfielders(state: GameState): PlayerPiece[] {
  return state.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
}

/**
 * Finds an 'available' bench entry of the requested role by cross-referencing
 * PLAYER_POOL (a BenchEntry itself carries no role field). `exclude` lets callers
 * avoid re-picking an entry already consumed earlier in the same test.
 */
function findBenchEntryByRole(
  bench: readonly BenchEntry[],
  role: 'GK' | 'outfield',
  exclude: ReadonlySet<string> = new Set(),
): BenchEntry {
  const entry = bench.find((e) => {
    if (e.status !== 'available') return false;
    if (exclude.has(e.playerId)) return false;
    const pool = PLAYER_POOL.find((p) => p.id === e.playerId);
    if (!pool) return false;
    return role === 'GK' ? pool.role === 'GK' : pool.role !== 'GK';
  });
  if (!entry) throw new Error(`No available ${role} bench entry found`);
  return entry;
}

// ---------------------------------------------------------------------------
// Case 8/D-13 seed helper — a real STEAL_ATTEMPT foul via a direct, unmocked
// applyMove call (mirrors foulFreeKick.integration.test.ts's seedFoulChoiceViaSteal),
// on the real draft-room pieces. The fouler already carries one prior yellow card,
// so any booking die >= leniency upgrades to a second-yellow red (CARD-02) —
// fouls.ts's resolveBooking doc comment: "this upgrade applies regardless of
// whether the foul was a professional foul", so no reachability/cover-teammate
// fixture is needed.
// ---------------------------------------------------------------------------

const CENTER: HexCoord = { q: 18, r: 13 };
const MID_HEX: HexCoord = hexNeighbors(CENTER).find((h) => isPitchHex(h))!;
const DEFENDER_HEX: HexCoord = hexNeighbors(MID_HEX).find(
  (h) => isPitchHex(h) && !(h.q === CENTER.q && h.r === CENTER.r),
)!;

function parkBackgroundPieces(
  pieces: readonly PlayerPiece[],
  keepIds: ReadonlySet<string>,
): PlayerPiece[] {
  return pieces.map((p, idx) =>
    keepIds.has(p.id) ? p : { ...p, position: { q: p.teamId === 'home' ? 2 : 34, r: idx % 25 } },
  );
}

function seedRedCardFoul(roomCode: string): {
  fouler: PlayerPiece;
  foulerTeam: 'away';
  otherAwayOutfieldId: string;
} {
  const room = getRoom(roomCode);
  if (!room || !room.gameState) throw new Error('Room or gameState not found');

  const homeOutfield = room.gameState.pieces.filter((p) => p.teamId === 'home' && p.role !== 'GK');
  const awayOutfield = room.gameState.pieces.filter((p) => p.teamId === 'away' && p.role !== 'GK');
  const carrier = homeOutfield[0]!;
  const defenderBase = awayOutfield[0]!;
  const otherAwayOutfieldId = awayOutfield[1]!.id;
  const defender: PlayerPiece = { ...defenderBase, yellowCards: 1, position: DEFENDER_HEX };

  let pieces = room.gameState.pieces.map((p) => {
    if (p.id === carrier.id) return { ...p, position: CENTER };
    if (p.id === defender.id) return defender;
    return p;
  });
  pieces = parkBackgroundPieces(pieces, new Set([carrier.id, defender.id]));

  room.gameState = {
    ...room.gameState,
    pieces,
    phase: 'MOVE',
    attackingTeam: 'home',
    activeTeam: 'home',
    movementSlot: 'ATTACKER_4',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    stealAttemptedByIds: [],
    tackleAttemptedByIds: [],
    ball: { position: CENTER, carrierId: carrier.id, lastTouchedBy: null },
    ballZone: 'middle',
    foulsEnabled: true,
    bookingEnabled: true,
    injuryEnabled: false,
    refereeCard: { leniency: 3 },
  };

  const result = applyMove(room.gameState, carrier.id, MID_HEX, {
    stealDie: 1, // FOUL_TRIGGER_DIE — deterministically triggers the foul chain
    tackleDie: 3,
    carrierDie: 3,
    injuryDie: 6, // irrelevant — injuryEnabled: false above
    bookingDie: 4, // >= leniency(3) -> "yellow" base outcome, upgraded to red (secondYellow)
  });
  if (!result.ok) {
    throw new Error(`Seed applyMove (D-13 red card) failed: ${result.reason}`);
  }
  room.gameState = result.state;

  return { fouler: defender, foulerTeam: 'away', otherAwayOutfieldId };
}

// ---------------------------------------------------------------------------
// Case 1 (SUB-02/SUB-03): post-LINEUP_CONFIRM broadcast shape
// ---------------------------------------------------------------------------

describe('SUB-02/SUB-03: the first broadcast GameState after LINEUP_CONFIRM', () => {
  it('SUB-02/SUB-03: both clients see a 6-entry available bench per team, zeroed subsUsed/addedTimeBonus, and every piece carrying a playerId', async () => {
    const { stateA, stateB } = await setupLiveDraftMatch();

    for (const state of [stateA, stateB]) {
      expect(state.bench?.home).toHaveLength(6);
      expect(state.bench?.away).toHaveLength(6);
      for (const entry of [...(state.bench?.home ?? []), ...(state.bench?.away ?? [])]) {
        expect(entry.status).toBe('available');
      }
      expect(state.subsUsed).toEqual({ home: 0, away: 0 });
      expect(state.addedTimeBonus).toBe(0);
      for (const piece of state.pieces) {
        expect(piece.playerId).toBeDefined();
      }
    }
  }, 30000);
});

// ---------------------------------------------------------------------------
// Case 2/3 (SUB-01/SUB-02/SUB-03): a KICK_OFF_SETUP substitution, home then away
// ---------------------------------------------------------------------------

describe('SUB-01/SUB-02/SUB-03: a manager-initiated substitution during a stoppage', () => {
  it('SUB-01/SUB-02/SUB-03: the home client substitutes during KICK_OFF_SETUP (number/hex inherited, subsUsed incremented, bench flips to subbedOut, eventLog tail is SUBSTITUTION); the away client can then substitute in the same stoppage without touching home', async () => {
    const { clientA, clientB, stateA } = await setupLiveDraftMatch();
    expect(stateA.phase).toBe('KICK_OFF_SETUP'); // first entry of STOPPAGE_PHASES

    const outfield = homeOutfielders(stateA)[0]!;
    const incoming = findBenchEntryByRole(stateA.bench!.home, 'outfield');

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: outfield.id,
      inPlayerId: incoming.playerId,
    });
    const [[afterHomeA], [afterHomeB]] = await Promise.all([stateAPromise, stateBPromise]);

    for (const state of [afterHomeA, afterHomeB]) {
      const slot = state.pieces.find((p) => p.id === outfield.id)!;
      expect(slot.playerId).toBe(incoming.playerId);
      expect(slot.number).toBe(outfield.number);
      expect(slot.position).toEqual(outfield.position);
      expect(state.subsUsed).toEqual({ home: 1, away: 0 });
      const benchEntry = state.bench!.home.find((e) => e.playerId === outfield.playerId)!;
      expect(benchEntry.status).toBe('subbedOut');
      expect(state.eventLog[state.eventLog.length - 1]!.type).toBe('SUBSTITUTION');
    }

    // SUB-01: substitution is not turn-bound — the away manager may act in the same
    // stoppage without waiting for a turn, and without touching home's counter.
    const awayOutfield = afterHomeA.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;
    const awayIncoming = findBenchEntryByRole(afterHomeA.bench!.away, 'outfield');

    const statePromise2 = oncePromise(clientB, ServerEvents.GAME_STATE);
    clientB.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: awayOutfield.id,
      inPlayerId: awayIncoming.playerId,
    });
    const [afterAway] = await statePromise2;
    expect(afterAway.subsUsed).toEqual({ home: 1, away: 1 });
  }, 30000);
});

// ---------------------------------------------------------------------------
// Case 4 (SUB-07): a substituted-out player may never return
// ---------------------------------------------------------------------------

describe('SUB-07: a substituted-out player may never return', () => {
  it('SUB-07: re-emitting with the just-substituted-out player as inPlayerId is rejected ALREADY_SUBBED', async () => {
    const { clientA, stateA } = await setupLiveDraftMatch();
    const outfield = homeOutfielders(stateA)[0]!;
    const incoming = findBenchEntryByRole(stateA.bench!.home, 'outfield');
    const departedPlayerId = outfield.playerId!;

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: outfield.id,
      inPlayerId: incoming.playerId,
    });
    await statePromise;

    const anotherOutfield = homeOutfielders(stateA)[1]!;
    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: anotherOutfield.id,
      inPlayerId: departedPlayerId,
    });
    const [reason] = await errorPromise;
    expect(reason).toBe('ALREADY_SUBBED');
  }, 30000);
});

// ---------------------------------------------------------------------------
// Case 5 (SUB-04): the whole-match cap survives the half-time boundary
// ---------------------------------------------------------------------------

describe('SUB-04: the whole-match substitution cap survives a HALF_TIME transition', () => {
  it('SUB-04: three home substitutions succeed, the fourth is rejected SUB_CAP_REACHED; after a seeded HALF_TIME transition, subsUsed.home is still 3 and a further attempt is still rejected', async () => {
    const { clientA, roomCode, stateA } = await setupLiveDraftMatch();
    const outfielders = homeOutfielders(stateA);
    const usedIds = new Set<string>();
    const bench: BenchEntry[] = [];
    for (let i = 0; i < 4; i++) {
      const entry = findBenchEntryByRole(stateA.bench!.home, 'outfield', usedIds);
      usedIds.add(entry.playerId);
      bench.push(entry);
    }

    for (let i = 0; i < 3; i++) {
      const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
        outPieceId: outfielders[i]!.id,
        inPlayerId: bench[i]!.playerId,
      });
      const [state] = await statePromise;
      expect(state.subsUsed?.home).toBe(i + 1);
    }

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: outfielders[3]!.id,
      inPlayerId: bench[3]!.playerId,
    });
    const [reason] = await errorPromise;
    expect(reason).toBe('SUB_CAP_REACHED');
    expect(getRoom(roomCode)!.gameState!.subsUsed?.home).toBe(3);

    // Seed a HALF_TIME transition directly (D-07: the whole-match cap is never reset at
    // half-time — only addedTimeBonus, a structurally independent per-half counter, resets).
    const room = getRoom(roomCode)!;
    room.gameState = { ...room.gameState!, phase: 'HALF_TIME' };
    expect(room.gameState.subsUsed?.home).toBe(3);

    const errorPromise2 = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: outfielders[3]!.id,
      inPlayerId: bench[3]!.playerId,
    });
    const [reason2] = await errorPromise2;
    expect(reason2).toBe('SUB_CAP_REACHED');
    expect(getRoom(roomCode)!.gameState!.subsUsed?.home).toBe(3);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Case 6 (SUB-05): added time folds in one minute per substitution made that half
// ---------------------------------------------------------------------------

describe('SUB-05: added time folds in one minute per substitution made in that half', () => {
  it('SUB-05: addedTime equals the injected roll plus refereeCard.leniency plus the number of substitutions made this half — never hard-coded', async () => {
    const { clientA, roomCode, stateA } = await setupLiveDraftMatch();
    const outfielders = homeOutfielders(stateA);
    const usedIds = new Set<string>();
    const bench: BenchEntry[] = [];
    for (let i = 0; i < 2; i++) {
      const entry = findBenchEntryByRole(stateA.bench!.home, 'outfield', usedIds);
      usedIds.add(entry.playerId);
      bench.push(entry);
    }

    // Two substitutions this half — addedTimeBonus accumulates to 2 (SUB-05).
    for (let i = 0; i < 2; i++) {
      const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
      clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
        outPieceId: outfielders[i]!.id,
        inPlayerId: bench[i]!.playerId,
      });
      await statePromise;
    }
    const afterSubs = getRoom(roomCode)!.gameState!;
    expect(afterSubs.addedTimeBonus).toBe(2);

    // Seed a state one movement cycle short of the 45-minute threshold, sitting in the
    // ATTACKER_2 slot (the slot whose end-turn crosses actionCount 45 and rolls added
    // time inline — gameEngine.ts applyEndTurn's nextSlot===null branch), with a known
    // leniency so the expected total is fully derivable from state, never hard-coded.
    const room = getRoom(roomCode)!;
    const KNOWN_LENIENCY = 3;
    room.gameState = {
      ...afterSubs,
      phase: 'MOVE',
      movementSlot: 'ATTACKER_2',
      activeTeam: 'home',
      attackingTeam: 'home',
      actionCount: 43, // + GAME_SPEED_MINUTES.standard (2) = 45 — crosses the threshold
      addedTime: null,
      movedPieceIds: [],
      paceUsedByPieceId: {},
      refereeCard: { leniency: KNOWN_LENIENCY },
    };

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_END_TURN);
    const [finalState] = await statePromise;

    const expectedAddedTime = MOCKED_ROLL + KNOWN_LENIENCY + 2;
    expect(finalState.actionCount).toBe(45);
    expect(finalState.addedTime).toBe(expectedAddedTime);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Case 7 (SUB-06/D-08): a red-carded outgoing piece is unsubstitutable
// ---------------------------------------------------------------------------

describe('SUB-06/D-08: a red-carded outgoing piece can never be substituted; the team stays at 10 on-pitch', () => {
  it('SUB-06/D-08: CANNOT_SUB_RED_CARD for the outgoing red-carded piece; a substitution of a different piece still succeeds', async () => {
    const { clientA, roomCode, stateA } = await setupLiveDraftMatch();
    const room = getRoom(roomCode)!;
    const outfielders = homeOutfielders(stateA);
    const redCardedPiece = outfielders[0]!;
    const otherPiece = outfielders[1]!;
    const benchEntry1 = findBenchEntryByRole(stateA.bench!.home, 'outfield');
    const benchEntry2 = findBenchEntryByRole(
      stateA.bench!.home,
      'outfield',
      new Set([benchEntry1.playerId]),
    );

    room.gameState = {
      ...stateA,
      pieces: stateA.pieces.map((p) =>
        p.id === redCardedPiece.id ? { ...p, redCarded: true, onPitch: false } : p,
      ),
    };

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: redCardedPiece.id,
      inPlayerId: benchEntry1.playerId,
    });
    const [reason] = await errorPromise;
    expect(reason).toBe('CANNOT_SUB_RED_CARD');

    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: otherPiece.id,
      inPlayerId: benchEntry2.playerId,
    });
    const [state] = await statePromise;
    expect(state.subsUsed?.home).toBe(1);
    expect(maxOnPitchFor(state.pieces, 'home')).toBe(10);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Case 8 (D-13): a real foul relocates a red card to the bench, proven over the wire
// ---------------------------------------------------------------------------

describe('D-13: a red card relocates to the bench and is proven end to end over the socket', () => {
  it('D-13: the sent-off player appears on the bench, remains in pieces (onPitch:false), caps maxOnPitchFor at 10, and cannot be subbed in (CANNOT_SUB_IN_RED_CARDED)', async () => {
    const { clientA, clientB, roomCode } = await setupLiveDraftMatch();
    const room = getRoom(roomCode)!;
    const { fouler, foulerTeam, otherAwayOutfieldId } = seedRedCardFoul(roomCode);

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    const stateBPromise = oncePromise(clientB, ServerEvents.GAME_STATE);
    broadcastState(io, room);
    const [[stateA], [stateB]] = await Promise.all([stateAPromise, stateBPromise]);

    for (const state of [stateA, stateB]) {
      const benchEntry = state.bench?.[foulerTeam].find((e) => e.playerId === fouler.playerId);
      expect(benchEntry).toBeDefined();
      expect(benchEntry?.status).toBe('redCarded');
      expect(benchEntry?.jerseyNumber).toBe(fouler.number);

      const foulerPiece = state.pieces.find((p) => p.id === fouler.id)!;
      expect(foulerPiece.redCarded).toBe(true);
      expect(foulerPiece.onPitch).toBe(false);

      expect(maxOnPitchFor(state.pieces, foulerTeam)).toBe(10);
    }

    // (d) — move to a legal stoppage so GAME_SUBSTITUTION's phase gate passes, then try to
    // sub the red-carded player IN via a legitimate own-team outgoing piece.
    room.gameState = { ...room.gameState!, phase: 'KICK_OFF_SETUP' };
    const errorPromise = oncePromise(clientB, ServerEvents.GAME_ERROR);
    clientB.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: otherAwayOutfieldId,
      inPlayerId: fouler.playerId!,
    });
    const [reason] = await errorPromise;
    expect(reason).toBe('CANNOT_SUB_IN_RED_CARDED');
  }, 30000);
});

// ---------------------------------------------------------------------------
// Case 9 (SUB-03/SUB-07): roster continuity survives a real goal reset
// ---------------------------------------------------------------------------

describe('SUB-03/SUB-07: roster continuity survives a goal-triggered kick-off reset', () => {
  it('SUB-03/SUB-07: the substitute stays at the slot, the departed player never reappears, and the bench (including an unrelated pre-existing redCarded entry) is unchanged after a goal', async () => {
    const { clientA, roomCode, stateA } = await setupLiveDraftMatch();
    const room = getRoom(roomCode)!;

    // Mirror case 8's D-13 shape with a distinct, unrelated red-card bench entry so this
    // test also proves that entry survives the goal reset untouched (D-13 never rewritten
    // by a substitution or a reset — see applySubstitution/applyRosterContinuity).
    const preExistingRedCard: BenchEntry = { ...stateA.bench!.home[1]!, status: 'redCarded' };
    const seededBenchHome = stateA.bench!.home.map((e, i) => (i === 1 ? preExistingRedCard : e));
    room.gameState = {
      ...stateA,
      bench: { home: seededBenchHome, away: [...stateA.bench!.away] },
    };

    const outfield = homeOutfielders(room.gameState)[0]!;
    const incoming = findBenchEntryByRole(
      seededBenchHome,
      'outfield',
      new Set([preExistingRedCard.playerId]),
    );
    const departedPlayerId = outfield.playerId!;

    const subStatePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: outfield.id,
      inPlayerId: incoming.playerId,
    });
    const [afterSub] = await subStatePromise;
    expect(afterSub.pieces.find((p) => p.id === outfield.id)!.playerId).toBe(incoming.playerId);
    expect(afterSub.subsUsed?.home).toBe(1);
    expect(
      afterSub.bench!.home.find((e) => e.playerId === preExistingRedCard.playerId)?.status,
    ).toBe('redCarded');

    // Drive a real GAME_SHOT auto-GOAL with the GK positioned far from every shot-path hex
    // (mirrors gameHandlers.substitution.test.ts Task 3 / shotGkRange.test.ts's fixture),
    // forcing the goal outcome regardless of dice.
    const awayGK = afterSub.pieces.find((p) => p.teamId === 'away' && p.role === 'GK')!;
    const carrierPos = { q: 30, r: 13 };
    const gkPos = { q: 5, r: 0 }; // far away — >3 hexes from any hex on the q=36 shot path
    room.gameState = {
      ...afterSub,
      phase: 'PASS',
      attackingTeam: 'home',
      activeTeam: 'home',
      lastActionType: null,
      ball: { position: carrierPos, carrierId: outfield.id, lastTouchedBy: null },
      ballZone: computeBallZone(carrierPos),
      pieces: afterSub.pieces.map((p) => {
        if (p.id === outfield.id) return { ...p, position: carrierPos };
        if (p.id === awayGK.id) return { ...p, position: gkPos };
        return p;
      }),
    };
    // D-10 (Phase 39, 39-15): prevents a false box-entry "fresh entry" detection from this
    // direct test-state graft (mirrors shotGkRange.test.ts / gameHandlers.substitution.test.ts).
    room.lastBroadcastBallPosition = carrierPos;

    const goalStatePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SHOT, { q: 36, r: 13 });
    const [finalState] = await goalStatePromise;

    expect(finalState.phase).toBe('KICK_OFF_SETUP');
    expect(finalState.score.home).toBe(1);

    const slotPiece = finalState.pieces.find((p) => p.id === outfield.id)!;
    expect(slotPiece.playerId).toBe(incoming.playerId);
    expect(finalState.pieces.some((p) => p.playerId === departedPlayerId)).toBe(false);

    expect(finalState.subsUsed).toEqual(afterSub.subsUsed);
    expect(finalState.bench).toEqual(afterSub.bench);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Case 10 (SETTINGS-04): substitution reads none of the four v1.6 toggles
// ---------------------------------------------------------------------------

describe('SETTINGS-04: substitution succeeds regardless of the four v1.6 toggle states', () => {
  it('SETTINGS-04: succeeds in a room created with all four toggles off', async () => {
    const { clientA, stateA } = await setupLiveDraftMatch({
      outOfBounds: false,
      fouls: false,
      booking: false,
      injury: false,
      tackleStealDecline: false,
    });
    expect(stateA.foulsEnabled).toBe(false);
    expect(stateA.bookingEnabled).toBe(false);
    expect(stateA.injuryEnabled).toBe(false);
    expect(stateA.outOfBoundsEnabled).toBe(false);

    const outfield = homeOutfielders(stateA)[0]!;
    const incoming = findBenchEntryByRole(stateA.bench!.home, 'outfield');
    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: outfield.id,
      inPlayerId: incoming.playerId,
    });
    const [state] = await statePromise;
    expect(state.subsUsed?.home).toBe(1);
  }, 30000);

  it('SETTINGS-04: succeeds in a room created with all four toggles on', async () => {
    const { clientA, stateA } = await setupLiveDraftMatch({
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: false,
    });
    expect(stateA.foulsEnabled).toBe(true);
    expect(stateA.bookingEnabled).toBe(true);
    expect(stateA.injuryEnabled).toBe(true);
    expect(stateA.outOfBoundsEnabled).toBe(true);

    const outfield = homeOutfielders(stateA)[0]!;
    const incoming = findBenchEntryByRole(stateA.bench!.home, 'outfield');
    const statePromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: outfield.id,
      inPlayerId: incoming.playerId,
    });
    const [state] = await statePromise;
    expect(state.subsUsed?.home).toBe(1);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Case 11 (Phase 46 D-05..D-09, supersedes the old D-12 empty-bench case): a
// STANDARD room reaches a live match with a 5-player generic placeholder bench
// ---------------------------------------------------------------------------

describe('Phase 46 D-05..D-09: a Standard-mode room reaches a live match with a generic placeholder bench', () => {
  it('Phase 46: bench.home/away each carry the 5-player generic placeholder roster (random 15-99 numbers, one per role), the broadcast state is otherwise fully valid, and a generic bench outfielder substitutes onto the pitch end to end', async () => {
    const { clientA, roomCode, state } = await setupStandardMatch();

    const homeBench = state.bench?.home ?? [];
    const awayBench = state.bench?.away ?? [];
    expect(homeBench).toHaveLength(5);
    expect(awayBench).toHaveLength(5);
    expect(state.subsUsed).toEqual({ home: 0, away: 0 });
    expect(state.addedTimeBonus).toBe(0);
    for (const piece of state.pieces) {
      expect(piece.playerId).toBeDefined();
    }

    for (const entry of [...homeBench, ...awayBench]) {
      expect(entry.status).toBe('available');
      expect(entry.jerseyNumber).toBeGreaterThanOrEqual(15);
      expect(entry.jerseyNumber).toBeLessThanOrEqual(99);
    }
    const homeRoles = new Set(
      homeBench.map((e) => PLAYER_POOL.find((p) => p.id === e.playerId)?.role),
    );
    expect(homeRoles.size).toBe(5);

    // Sub a generic bench outfielder in for a home outfield starter during KICK_OFF_SETUP
    // (first entry of STOPPAGE_PHASES) — proves substitution works end to end through the
    // unchanged applySubstitution guards, with no generic-player special case (D-09).
    expect(state.phase).toBe('KICK_OFF_SETUP');
    const outfield = state.pieces.find((p) => p.teamId === 'home' && p.role !== 'GK')!;
    const incoming = findBenchEntryByRole(homeBench, 'outfield');
    const incomingPoolPlayer = PLAYER_POOL.find((p) => p.id === incoming.playerId)!;
    expect(incomingPoolPlayer.sourceTeamId).toBe('generic-bench-home');

    const stateAPromise = oncePromise(clientA, ServerEvents.GAME_STATE);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: outfield.id,
      inPlayerId: incoming.playerId,
    });
    const [afterSub] = await stateAPromise;

    const slot = afterSub.pieces.find((p) => p.id === outfield.id)!;
    expect(slot.id).toBe(outfield.id);
    expect(slot.position).toEqual(outfield.position);
    expect(slot.playerId).toBe(incomingPoolPlayer.id);
    expect(slot.firstName).toBe(incomingPoolPlayer.firstName);
    expect(slot.lastName).toBe(incomingPoolPlayer.lastName);
    expect(slot.pace).toBe(incomingPoolPlayer.pace);
    expect(afterSub.subsUsed).toEqual({ home: 1, away: 0 });

    // GK parity (RESEARCH.md Pitfall 6, applySubstitution guard 9, unchanged): the generic
    // bench GK still cannot be subbed into an outfield slot.
    const anotherOutfield = afterSub.pieces.find(
      (p) => p.teamId === 'home' && p.role !== 'GK' && p.id !== outfield.id,
    )!;
    const genericGk = findBenchEntryByRole(afterSub.bench!.home, 'GK');
    const genericGkPoolPlayer = PLAYER_POOL.find((p) => p.id === genericGk.playerId)!;
    expect(genericGkPoolPlayer.sourceTeamId).toBe('generic-bench-home');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: anotherOutfield.id,
      inPlayerId: genericGk.playerId,
    });
    const [reason] = await errorPromise;
    expect(reason).toBe('NON_GK_SLOT_REJECTS_GK');
    expect(getRoom(roomCode)!.gameState!.subsUsed).toEqual({ home: 1, away: 0 });
    expect(clientA.connected).toBe(true);
  }, 30000);
});

// ---------------------------------------------------------------------------
// T-40-22: cross-team substitution is impossible (threat register mitigation)
// ---------------------------------------------------------------------------

describe('T-40-22: a cross-team substitution attempt is impossible', () => {
  it("T-40-22: an opponent-owned outPieceId is rejected WRONG_TEAM and neither side's subsUsed changes", async () => {
    const { clientA, roomCode, stateA } = await setupLiveDraftMatch();
    const awayOutfield = stateA.pieces.find((p) => p.teamId === 'away' && p.role !== 'GK')!;
    const incoming = findBenchEntryByRole(stateA.bench!.away, 'outfield');

    const errorPromise = oncePromise(clientA, ServerEvents.GAME_ERROR);
    clientA.emit(ClientEvents.GAME_SUBSTITUTION, {
      outPieceId: awayOutfield.id,
      inPlayerId: incoming.playerId,
    });
    const [reason] = await errorPromise;

    expect(reason).toBe('WRONG_TEAM');
    expect(getRoom(roomCode)!.gameState!.subsUsed).toEqual({ home: 0, away: 0 });
  }, 30000);
});
