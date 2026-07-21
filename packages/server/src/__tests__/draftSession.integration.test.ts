/**
 * Integration tests for Phase 29 Plan 04 — draft session server wiring
 * (DRAFT-07/DRAFT-08/DRAFT-10).
 *
 * Spins up a real Socket.io server + clients (mirrors lineupAssignment.integration.test.ts's
 * harness — copied verbatim per the per-file self-contained convention noted in testHelpers.ts).
 * Drives the full handshake through draft-mode ROOM_SETTINGS_CONFIRM -> UNIFORM_CONFIRM (both
 * players, draft team type) and asserts:
 *   - Task 1: draft-mode away UNIFORM_CONFIRM bootstraps DRAFT_STATE_UPDATED (not
 *     LINEUP_ASSIGNMENT_READY) with a disjoint cycle-1 PICK1 pack per player, no GAME_STATE.
 *   - Task 2: DRAFT_PICK / DRAFT_REARRANGE full cycle sequencing, mutex, tampering guards,
 *     GK-slot role rules, and end-to-end 4-cycle completion with bench numbering.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import { clearAllRooms } from '../roomStore.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  DraftClientView,
  DraftPickPayload,
  GameState,
} from '@counter-attack/shared';
import { ClientEvents, ServerEvents, FORMATIONS } from '@counter-attack/shared';

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
// Helpers (copied verbatim from lineupAssignment.integration.test.ts)
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
  timeoutMs = 1500,
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

/**
 * Confirms room settings from clientA (host) with draft team type + the 'original' pool.
 * Mirrors testHelpers.ts's confirmDefaultRoomSettings but for draft mode — kept local to
 * this file per the per-file self-contained convention (only the Standard-mode default
 * fixture was factored out to testHelpers.ts).
 */
function confirmDraftRoomSettings(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
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
    });
  });
}

/**
 * Drive both clients through ROOM_CREATE -> ROOM_SETTINGS_CONFIRM(draft) -> ROOM_JOIN ->
 * TEAM_PICK x2 -> UNIFORM_CONFIRM x2 (both '4-4-2'). Returns the home (clientA) and away
 * (clientB) sockets positioned right after away confirms (draft session bootstrapped and
 * cycle-1 packs opened).
 */
async function setupThroughDraftUniformConfirm(): Promise<{
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>;
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>;
  viewA: DraftClientView;
  viewB: DraftClientView;
}> {
  const clientA = createClient();
  const clientB = createClient();
  await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

  // Create room
  const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
  clientA.emit(ClientEvents.ROOM_CREATE);
  const [roomCode] = await createJoinedPromise;

  // Confirm draft settings before the joiner arrives (T-27-05/Pitfall 1 both-conditions gate).
  await confirmDraftRoomSettings(clientA);

  // Join room
  const joinedBPromise = oncePromise(clientB, ServerEvents.ROOM_JOINED);
  const selectionStartPromise = oncePromise(clientA, ServerEvents.TEAM_SELECTION_START, 2000);
  clientB.emit(ClientEvents.ROOM_JOIN, roomCode);
  await joinedBPromise;
  await selectionStartPromise;

  // Team picks
  const homePickedPromise = oncePromise(clientB, ServerEvents.TEAM_HOME_PICKED, 2000);
  clientA.emit(ClientEvents.TEAM_PICK, 'city');
  await homePickedPromise;

  const uniformStartPromise = oncePromise(clientA, ServerEvents.UNIFORM_SELECTION_START, 2000);
  clientB.emit(ClientEvents.TEAM_PICK, 'crew');
  await uniformStartPromise;

  // Home confirms uniform + formation
  const homeConfirmedPromise = oncePromise(clientB, ServerEvents.UNIFORM_HOME_CONFIRMED, 2000);
  clientA.emit(ClientEvents.UNIFORM_CONFIRM, 'city', 'pinstripes-vertical', '4-4-2', 'home');
  await homeConfirmedPromise;

  // Away confirms uniform + formation -> bootstraps DraftSession's cycle-1 packs.
  const draftAPromise = oncePromise(clientA, ServerEvents.DRAFT_STATE_UPDATED, 2000);
  const draftBPromise = oncePromise(clientB, ServerEvents.DRAFT_STATE_UPDATED, 2000);
  clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');
  const [[viewA], [viewB]] = await Promise.all([draftAPromise, draftBPromise]);

  return { clientA, clientB, viewA, viewB };
}

// ---------------------------------------------------------------------------
// Task 1: draft-mode UNIFORM_CONFIRM away-branch bootstraps DRAFT_STATE_UPDATED
// ---------------------------------------------------------------------------

describe('Phase 29 Plan 04 Task 1 — draft-mode UNIFORM_CONFIRM bootstrap', () => {
  it('both sockets receive DRAFT_STATE_UPDATED (not LINEUP_ASSIGNMENT_READY) with cycle-1 PICK1 view and no GAME_STATE', async () => {
    // Track whether LINEUP_ASSIGNMENT_READY or GAME_STATE ever fire — they must NOT, since
    // the draft branch never emits either (verified by inspection of roomHandlers.ts — no
    // timing race is possible here, unlike a race against a competing async emit).
    let lineupReadyReceivedA = false;
    let lineupReadyReceivedB = false;
    let gameStateReceivedA = false;
    let gameStateReceivedB = false;

    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();

    clientA.once(ServerEvents.LINEUP_ASSIGNMENT_READY, () => {
      lineupReadyReceivedA = true;
    });
    clientB.once(ServerEvents.LINEUP_ASSIGNMENT_READY, () => {
      lineupReadyReceivedB = true;
    });
    clientA.once(ServerEvents.GAME_STATE, () => {
      gameStateReceivedA = true;
    });
    clientB.once(ServerEvents.GAME_STATE, () => {
      gameStateReceivedB = true;
    });

    // (a) both receive a cycle-1 PICK1 view of a 7-card pack, no picks made yet.
    for (const view of [viewA, viewB]) {
      expect(view.cycle).toBe(1);
      expect(view.subStep).toBe('PICK1');
      expect(view.currentPack).toHaveLength(7);
      expect(view.picksRemaining).toBe(1);
      expect(view.draftComplete).toBe(false);
      expect(view.lineupSlots).toEqual(Array(11).fill(null));
    }

    // (b) the two players' initial packs are DIFFERENT — disjoint card-id sets (D-04).
    const idsA = new Set(viewA.currentPack.map((c) => c.id));
    const idsB = new Set(viewB.currentPack.map((c) => c.id));
    for (const id of idsA) {
      expect(idsB.has(id)).toBe(false);
    }

    // (c) LINEUP_ASSIGNMENT_READY / GAME_STATE must NOT have been emitted.
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect(lineupReadyReceivedA).toBe(false);
    expect(lineupReadyReceivedB).toBe(false);
    expect(gameStateReceivedA).toBe(false);
    expect(gameStateReceivedB).toBe(false);
  }, 8000);

  it('Standard-mode UNIFORM_CONFIRM away-branch is unaffected by the draft gate (Pitfall 2 regression guard)', async () => {
    // This is a duplicate-safety smoke test local to this file; the authoritative
    // regression coverage lives in lineupAssignment.integration.test.ts (run as part of
    // the full suite per this task's acceptance criteria).
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    const createJoinedPromise = oncePromise(clientA, ServerEvents.ROOM_JOINED);
    clientA.emit(ClientEvents.ROOM_CREATE);
    const [roomCode] = await createJoinedPromise;

    // Standard settings (teamType: 'standard').
    const settingsPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1000);
      clientA.once(ServerEvents.ROOM_SETTINGS_CONFIRMED, () => {
        clearTimeout(timer);
        resolve();
      });
      clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
        speed: 'standard',
        teamType: 'standard',
        draftPools: [],
      });
    });
    await settingsPromise;

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

    const readyAPromise = oncePromise(clientA, ServerEvents.LINEUP_ASSIGNMENT_READY, 2000);
    const readyBPromise = oncePromise(clientB, ServerEvents.LINEUP_ASSIGNMENT_READY, 2000);
    clientB.emit(ClientEvents.UNIFORM_CONFIRM, 'crew', 'bar-diagonal', '4-4-2', 'away');

    const [[homeAssignment]] = await Promise.all([readyAPromise, readyBPromise]);
    expect(homeAssignment).toHaveLength(11);
  }, 8000);
});

// ---------------------------------------------------------------------------
// Task 2: DRAFT_PICK / DRAFT_REARRANGE full server-authoritative validation
// ---------------------------------------------------------------------------

/** Registers persistent DRAFT_STATE_UPDATED mirrors and a helper to drive one pick and await both sides' refreshed views. */
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
      const check = () => {
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
    destination: DraftPickPayload['destination'] = { type: 'bench' },
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

describe('Phase 29 Plan 04 Task 2 — DRAFT_PICK / DRAFT_REARRANGE', () => {
  it('(a) full cycle-1 PICK1 drive: both players pick, subStep advances to PICK2 with swapped packs', async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();
    const driver = makeDraftDriver(clientA, clientB, viewA, viewB);

    const homeOriginalIds = viewA.currentPack.map((c) => c.id);
    const awayOriginalIds = viewB.currentPack.map((c) => c.id);
    const homePickedId = homeOriginalIds[0]!;
    const awayPickedId = awayOriginalIds[0]!;
    const homeRemainingIds = homeOriginalIds.filter((id) => id !== homePickedId);
    const awayRemainingIds = awayOriginalIds.filter((id) => id !== awayPickedId);

    // Home picks first — away has not picked yet, so the sub-step must NOT advance.
    await driver.pick(clientA, homePickedId);
    expect(driver.getViewA().subStep).toBe('PICK1');
    expect(driver.getViewA().picksRemaining).toBe(0);
    expect(driver.getViewA().waitingForOpponent).toBe(true);

    // Away picks — both reach 0, sub-step advances to PICK2 with packs swapped.
    await driver.pick(clientB, awayPickedId);

    expect(driver.getViewA().subStep).toBe('PICK2');
    expect(driver.getViewB().subStep).toBe('PICK2');
    expect(driver.getViewA().picksRemaining).toBe(2);
    expect(driver.getViewB().picksRemaining).toBe(2);

    // Packs swapped: home's new pack is away's post-pick remaining pack, and vice versa.
    const homeNewIds = driver.getViewA().currentPack.map((c) => c.id);
    const awayNewIds = driver.getViewB().currentPack.map((c) => c.id);
    expect(new Set(homeNewIds)).toEqual(new Set(awayRemainingIds));
    expect(new Set(awayNewIds)).toEqual(new Set(homeRemainingIds));
  }, 10000);

  it('(b) mid-PICK2 wait: one pick of two does not advance the sub-step early', async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();
    const driver = makeDraftDriver(clientA, clientB, viewA, viewB);

    // Drive to PICK2 (both pick their single PICK1 card).
    await driver.pick(clientA, viewA.currentPack[0]!.id);
    await driver.pick(clientB, viewB.currentPack[0]!.id);
    expect(driver.getViewA().subStep).toBe('PICK2');

    // Home picks ONE of its two PICK2 cards — away has not picked at all yet.
    const pick2CardId = driver.getViewA().currentPack[0]!.id;
    await driver.pick(clientA, pick2CardId);

    expect(driver.getViewA().subStep).toBe('PICK2'); // sub-step must NOT advance yet
    expect(driver.getViewA().picksRemaining).toBe(1);
    expect(driver.getViewA().waitingForOpponent).toBe(false); // home still has 1 left itself
  }, 10000);

  it("(c) tampering: a cardId not in the sender's current pack is rejected with INVALID_CARD and does not mutate state", async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();

    // A card id that exists in AWAY's pack, not home's — proves side/pack isolation:
    // even though the id is a real, valid card, home cannot draft it because it is not
    // present in home's own server-stored current pack (T-29-01/T-29-02).
    const foreignCardId = viewB.currentPack[0]!.id;

    const errorPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.GAME_ERROR, (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
    clientA.emit(ClientEvents.DRAFT_PICK, {
      cardId: foreignCardId,
      destination: { type: 'bench' },
    });
    const reason = await errorPromise;
    expect(reason).toBe('INVALID_CARD');

    // State unmutated: a legitimate pick from home's OWN pack still succeeds afterward and
    // consumes exactly the expected single PICK1 pick.
    const driver = makeDraftDriver(clientA, clientB, viewA, viewB);
    await driver.pick(clientA, viewA.currentPack[0]!.id);
    expect(driver.getViewA().picksRemaining).toBe(0);
  }, 8000);

  it('(d) GK-slot role rule enforced in both directions', async () => {
    const { clientA, viewA } = await setupThroughDraftUniformConfirm();

    const keeperCard = viewA.currentPack.find((c) => c.tier === 'keeper')!;
    const outfieldCard = viewA.currentPack.find((c) => c.tier !== 'keeper')!;
    expect(keeperCard).toBeDefined();
    expect(outfieldCard).toBeDefined();

    // Non-GK card dropped on the GK slot (index 0) -> GK_SLOT_REQUIRES_GK.
    const errorPromise1 = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.GAME_ERROR, (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
    clientA.emit(ClientEvents.DRAFT_PICK, {
      cardId: outfieldCard.id,
      destination: { type: 'slot', slotIndex: 0 },
    });
    expect(await errorPromise1).toBe('GK_SLOT_REQUIRES_GK');

    // GK card dropped on a non-GK slot (index 1, 'RB' / DEF-back) -> NON_GK_SLOT_REJECTS_GK.
    const errorPromise2 = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.GAME_ERROR, (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
    clientA.emit(ClientEvents.DRAFT_PICK, {
      cardId: keeperCard.id,
      destination: { type: 'slot', slotIndex: 1 },
    });
    expect(await errorPromise2).toBe('NON_GK_SLOT_REJECTS_GK');
  }, 8000);

  it('(e) end-to-end: drives all 4 cycles to completion for both players with correct card counts and bench numbering', async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();
    const driver = makeDraftDriver(clientA, clientB, viewA, viewB);

    let guard = 0;
    while (!(driver.getViewA().draftComplete && driver.getViewB().draftComplete) && guard < 200) {
      guard++;
      if (driver.getViewA().picksRemaining > 0) {
        await driver.pick(clientA, driver.getViewA().currentPack[0]!.id);
      } else if (driver.getViewB().picksRemaining > 0) {
        await driver.pick(clientB, driver.getViewB().currentPack[0]!.id);
      } else {
        break;
      }
    }

    const finalA = driver.getViewA();
    const finalB = driver.getViewB();

    expect(finalA.draftComplete).toBe(true);
    expect(finalB.draftComplete).toBe(true);

    for (const view of [finalA, finalB]) {
      const filledSlots = view.lineupSlots.filter((s): s is string => s !== null);
      const totalCards = filledSlots.length + view.benchIds.length;
      expect(totalCards).toBe(16);

      // Bench numbers: every bench id has a distinct number in [15, 99].
      expect(Object.keys(view.benchNumbers).length).toBe(view.benchIds.length);
      const numbers = view.benchIds.map((id) => view.benchNumbers[id]!);
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(15);
        expect(n).toBeLessThanOrEqual(99);
      }
      expect(new Set(numbers).size).toBe(numbers.length);
    }
  }, 20000);

  it('DRAFT_REARRANGE moves an already-drafted card without touching cycle/subStep (D-10)', async () => {
    const { clientA, viewA } = await setupThroughDraftUniformConfirm();

    const cardId = viewA.currentPack[0]!.id;

    // Draft the card onto the bench first.
    const firstUpdate = new Promise<DraftClientView>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.DRAFT_STATE_UPDATED, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
    clientA.emit(ClientEvents.DRAFT_PICK, { cardId, destination: { type: 'bench' } });
    const afterPick = await firstUpdate;
    expect(afterPick.benchIds).toContain(cardId);

    // Now rearrange it from bench (index 0) to an outfield slot (index 1, non-GK).
    const rearrangePromise = new Promise<DraftClientView>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.DRAFT_STATE_UPDATED, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
    clientA.emit(ClientEvents.DRAFT_REARRANGE, {
      from: { type: 'bench', benchIndex: 0 },
      to: { type: 'slot', slotIndex: 1 },
    });
    const afterRearrange = await rearrangePromise;

    expect(afterRearrange.lineupSlots[1]).toBe(cardId);
    expect(afterRearrange.benchIds).not.toContain(cardId);
    // D-10: cycle/subStep/picksRemaining are untouched by rearrangement.
    expect(afterRearrange.cycle).toBe(afterPick.cycle);
    expect(afterRearrange.subStep).toBe(afterPick.subStep);
    expect(afterRearrange.picksRemaining).toBe(afterPick.picksRemaining);
  }, 8000);
});

// ---------------------------------------------------------------------------
// Gap-closure Plan 07 helpers — drive a full 4-cycle draft while explicitly placing picks
// into lineup slots (not just the bench) so BOTH sides end draftComplete with all 11
// starting slots filled. Needed for Task 1's post-draft-rearrange tests (which need a
// side to be able to legally LINEUP_CONFIRM) and Task 2's full-roster resolution tests.
// ---------------------------------------------------------------------------

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

/** Drives all 4 cycles to draftComplete for both sides, filling lineup slots along the way. */
async function driveDraftToCompletionFillingLineups(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>,
  viewA: DraftClientView,
  viewB: DraftClientView,
): Promise<ReturnType<typeof makeDraftDriver>> {
  const driver = makeDraftDriver(clientA, clientB, viewA, viewB);

  let guard = 0;
  while (!(driver.getViewA().draftComplete && driver.getViewB().draftComplete) && guard < 200) {
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
 * Phase 29 Plan 11 (CR-01 regression fix): drives all 4 cycles to draftComplete for both
 * sides while sending EVERY pick to the bench, never a lineup slot. Used to reach the
 * "mechanically complete draft, still-empty starting lineup" window — the scenario the
 * LINEUP_INCOMPLETE guard actually protects, now that the new draftComplete guard (CR-01)
 * runs first and would otherwise shadow LINEUP_INCOMPLETE for any still-incomplete draft.
 */
async function driveDraftToCompletionBenchOnly(
  clientA: Socket<ServerToClientEvents, ClientToServerEvents>,
  clientB: Socket<ServerToClientEvents, ClientToServerEvents>,
  viewA: DraftClientView,
  viewB: DraftClientView,
): Promise<ReturnType<typeof makeDraftDriver>> {
  const driver = makeDraftDriver(clientA, clientB, viewA, viewB);

  let guard = 0;
  while (!(driver.getViewA().draftComplete && driver.getViewB().draftComplete) && guard < 200) {
    guard++;
    if (driver.getViewA().picksRemaining > 0) {
      await driver.pick(clientA, driver.getViewA().currentPack[0]!.id, { type: 'bench' });
    } else if (driver.getViewB().picksRemaining > 0) {
      await driver.pick(clientB, driver.getViewB().currentPack[0]!.id, { type: 'bench' });
    } else {
      break;
    }
  }

  return driver;
}

// ---------------------------------------------------------------------------
// Gap-closure Plan 07 Task 1 — post-draft rearrangement (DRAFT-09/DRAFT-10/D-08/D-15)
// ---------------------------------------------------------------------------

describe('Phase 29 Plan 07 Task 1 — post-draft rearrangement', () => {
  it('after draftComplete, two consecutive DRAFT_REARRANGE round-trips from the same side both apply', async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();
    const driver = await driveDraftToCompletionFillingLineups(clientA, clientB, viewA, viewB);

    expect(driver.getViewA().draftComplete).toBe(true);

    // Round-trip 1: move the home GK-slot occupant... no — move a non-GK slot (index 1) card
    // to the bench, then move it right back. Both must succeed and be reflected in the
    // server-emitted DRAFT_STATE_UPDATED.
    const beforeView = driver.getViewA();
    const movedCardId = beforeView.lineupSlots[1]!;
    expect(movedCardId).not.toBeNull();

    const firstMove = new Promise<DraftClientView>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.DRAFT_STATE_UPDATED, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
    clientA.emit(ClientEvents.DRAFT_REARRANGE, {
      from: { type: 'slot', slotIndex: 1 },
      to: { type: 'bench', benchIndex: 0 },
    });
    const afterFirstMove = await firstMove;
    expect(afterFirstMove.lineupSlots[1]).toBeNull();
    expect(afterFirstMove.benchIds).toContain(movedCardId);

    // Round-trip 2: move it straight back from the bench into slot 1 — a SECOND, consecutive
    // rearrange from the same side after draftComplete (the repeat-rearrange regression).
    const benchIndex = afterFirstMove.benchIds.indexOf(movedCardId);
    const secondMove = new Promise<DraftClientView>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.DRAFT_STATE_UPDATED, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
    clientA.emit(ClientEvents.DRAFT_REARRANGE, {
      from: { type: 'bench', benchIndex },
      to: { type: 'slot', slotIndex: 1 },
    });
    const afterSecondMove = await secondMove;
    expect(afterSecondMove.lineupSlots[1]).toBe(movedCardId);
    expect(afterSecondMove.benchIds).not.toContain(movedCardId);

    // D-10: cycle/subStep never touched by either rearrange.
    expect(afterSecondMove.cycle).toBe(beforeView.cycle);
    expect(afterSecondMove.subStep).toBe(beforeView.subStep);
  }, 25000);

  it('DRAFT_REARRANGE from a side is rejected with LINEUP_ALREADY_CONFIRMED once that side has confirmed', async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();
    const driver = await driveDraftToCompletionFillingLineups(clientA, clientB, viewA, viewB);
    expect(driver.getViewA().draftComplete).toBe(true);

    // Home confirms its (fully filled) lineup.
    const homeConfirmedPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.GAME_ERROR, (reason) => {
        clearTimeout(timer);
        reject(new Error(`Unexpected GAME_ERROR during confirm: ${reason}`));
      });
      // No dedicated "confirmed" ack event fired to a single side when the other hasn't
      // confirmed yet (both-confirm mutual-wait gate) — just wait a tick for processing.
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 200);
    });
    clientA.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: [] });
    await homeConfirmedPromise;

    // Now a further DRAFT_REARRANGE from home must be rejected — no DRAFT_STATE_UPDATED,
    // LINEUP_ALREADY_CONFIRMED error instead.
    let stateUpdated = false;
    clientA.once(ServerEvents.DRAFT_STATE_UPDATED, () => {
      stateUpdated = true;
    });
    const errorPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.GAME_ERROR, (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
    clientA.emit(ClientEvents.DRAFT_REARRANGE, {
      from: { type: 'slot', slotIndex: 1 },
      to: { type: 'bench', benchIndex: 0 },
    });
    const reason = await errorPromise;
    expect(reason).toBe('LINEUP_ALREADY_CONFIRMED');
    expect(stateUpdated).toBe(false);
  }, 25000);
});

// ---------------------------------------------------------------------------
// Gap-closure Plan 07 Task 2 — draft-mode LINEUP_CONFIRM roster resolution (DRAFT-10)
// ---------------------------------------------------------------------------

describe('Phase 29 Plan 07 Task 2 — draft-mode LINEUP_CONFIRM roster resolution', () => {
  it('after both draft-mode confirms, all 22 built pieces have real stats and board positions', async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();
    const driver = await driveDraftToCompletionFillingLineups(clientA, clientB, viewA, viewB);
    expect(driver.getViewA().draftComplete).toBe(true);
    expect(driver.getViewB().draftComplete).toBe(true);
    // Both sides must have fully filled starting lineups from our pickIntoLineup driver.
    expect(driver.getViewA().lineupSlots.every((s) => s !== null)).toBe(true);
    expect(driver.getViewB().lineupSlots.every((s) => s !== null)).toBe(true);

    const gameStateAPromise = new Promise<GameState>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 2000);
      clientA.once(ServerEvents.GAME_STATE, (state) => {
        clearTimeout(timer);
        resolve(state);
      });
    });
    const gameStateBPromise = new Promise<GameState>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 2000);
      clientB.once(ServerEvents.GAME_STATE, (state) => {
        clearTimeout(timer);
        resolve(state);
      });
    });

    clientA.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: [] });
    clientB.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: [] });

    const [gameStateA] = await Promise.all([gameStateAPromise, gameStateBPromise]);

    expect(gameStateA.pieces).toHaveLength(22);
    for (const piece of gameStateA.pieces) {
      expect(piece.position).toBeDefined();
      expect(piece.position.q).not.toBeNull();
      expect(piece.position.r).not.toBeNull();
      expect(piece.pace).toBeGreaterThan(0);
      expect(piece.tackling).toBeGreaterThan(0);
    }
  }, 25000);

  it('a draft LINEUP_CONFIRM with a null starting slot emits LINEUP_INCOMPLETE and does not start the game', async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();
    // Phase 29 Plan 11 (CR-01 regression fix): drive the FULL draft to draftComplete=true
    // while sending every pick to the bench, so home's lineupSlots stay entirely null. This
    // reaches the LINEUP_INCOMPLETE window without also tripping the new draftComplete guard
    // (CR-01), which now runs first and would otherwise shadow this check for any draft that
    // is still mechanically in progress.
    const driver = await driveDraftToCompletionBenchOnly(clientA, clientB, viewA, viewB);
    expect(driver.getViewA().draftComplete).toBe(true);
    // Slot 0 (GK) may be force-filled by the cycle-4 keeper safety net (DRAFT-08) even though
    // every pick went to the bench — the outfield slots (1-10) stay null regardless, which is
    // the LINEUP_INCOMPLETE window under test.
    expect(
      driver
        .getViewA()
        .lineupSlots.slice(1)
        .every((s) => s === null),
    ).toBe(true);

    let gameStateReceived = false;
    clientA.once(ServerEvents.GAME_STATE, () => {
      gameStateReceived = true;
    });

    const errorPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.GAME_ERROR, (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
    clientA.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: [] });
    const reason = await errorPromise;
    expect(reason).toBe('LINEUP_INCOMPLETE');
    expect(gameStateReceived).toBe(false);
  }, 10000);
});

// ---------------------------------------------------------------------------
// Plan 10 (gap-closure) — D-09 GK-slot enforcement on both ends of a slot<->slot swap
// ---------------------------------------------------------------------------

describe('Phase 29 Plan 10 — slot<->slot swap GK-slot enforcement', () => {
  it('rejects a non-GK card swapping into the GK slot, rejects the GK swapping out into an outfield slot, and applies a legal outfield swap', async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();
    const driver = await driveDraftToCompletionFillingLineups(clientA, clientB, viewA, viewB);

    expect(driver.getViewA().draftComplete).toBe(true);
    expect(driver.getViewA().lineupSlots[0]).not.toBeNull(); // GK, placed by pickIntoLineup
    expect(driver.getViewA().lineupSlots[1]).not.toBeNull(); // non-GK outfield slot

    // (1) ILLEGAL: non-GK (slot 1) swaps into the GK slot (slot 0) -> GK_SLOT_REQUIRES_GK,
    // no DRAFT_STATE_UPDATED fired.
    let stateUpdated1 = false;
    clientA.once(ServerEvents.DRAFT_STATE_UPDATED, () => {
      stateUpdated1 = true;
    });
    const errorPromise1 = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.GAME_ERROR, (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
    clientA.emit(ClientEvents.DRAFT_REARRANGE, {
      from: { type: 'slot', slotIndex: 1 },
      to: { type: 'slot', slotIndex: 0 },
    });
    const reason1 = await errorPromise1;
    expect(reason1).toBe('GK_SLOT_REQUIRES_GK');
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect(stateUpdated1).toBe(false);

    // (2) ILLEGAL: the GK (slot 0) swaps out into an outfield slot (slot 1) ->
    // NON_GK_SLOT_REJECTS_GK, no DRAFT_STATE_UPDATED fired.
    let stateUpdated2 = false;
    clientA.once(ServerEvents.DRAFT_STATE_UPDATED, () => {
      stateUpdated2 = true;
    });
    const errorPromise2 = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.GAME_ERROR, (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
    clientA.emit(ClientEvents.DRAFT_REARRANGE, {
      from: { type: 'slot', slotIndex: 0 },
      to: { type: 'slot', slotIndex: 1 },
    });
    const reason2 = await errorPromise2;
    expect(reason2).toBe('NON_GK_SLOT_REJECTS_GK');
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect(stateUpdated2).toBe(false);

    // Positive control: a LEGAL outfield<->outfield swap (slot 1 <-> slot 2) applies and
    // trades the two cards — neither ends up on the bench.
    const beforeView = driver.getViewA();
    const cardAt1 = beforeView.lineupSlots[1]!;
    const cardAt2 = beforeView.lineupSlots[2]!;
    expect(cardAt1).not.toBeNull();
    expect(cardAt2).not.toBeNull();

    const legalSwapPromise = new Promise<DraftClientView>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.DRAFT_STATE_UPDATED, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
    clientA.emit(ClientEvents.DRAFT_REARRANGE, {
      from: { type: 'slot', slotIndex: 1 },
      to: { type: 'slot', slotIndex: 2 },
    });
    const afterLegalSwap = await legalSwapPromise;

    expect(afterLegalSwap.lineupSlots[1]).toBe(cardAt2);
    expect(afterLegalSwap.lineupSlots[2]).toBe(cardAt1);
    expect(afterLegalSwap.benchIds).not.toContain(cardAt1);
    expect(afterLegalSwap.benchIds).not.toContain(cardAt2);
  }, 25000);
});

// ---------------------------------------------------------------------------
// Phase 29 Plan 11 — CR-01 LINEUP_CONFIRM draftComplete guard
// ---------------------------------------------------------------------------

describe('Phase 29 Plan 11 — CR-01 LINEUP_CONFIRM draftComplete guard', () => {
  it('rejects a home LINEUP_CONFIRM with DRAFT_NOT_COMPLETE when all 11 lineup slots are filled but draftComplete is still false', async () => {
    const { clientA, clientB, viewA, viewB } = await setupThroughDraftUniformConfirm();
    const driver = makeDraftDriver(clientA, clientB, viewA, viewB);

    // Drive picks (filling lineup slots) until home's 11 slots are all filled OR draftComplete
    // flips — stop the instant we reach the cycle-3-full / cycle-4-incomplete window.
    let guard = 0;
    while (
      !(
        driver.getViewA().lineupSlots.every((s) => s !== null) && !driver.getViewA().draftComplete
      ) &&
      guard < 200
    ) {
      guard++;
      if (driver.getViewA().draftComplete) break; // safety: never overshoot into completion
      if (driver.getViewA().picksRemaining > 0) {
        await pickIntoLineup(clientA, driver, 'A');
      } else if (driver.getViewB().picksRemaining > 0) {
        await pickIntoLineup(clientB, driver, 'B');
      } else {
        break;
      }
    }

    // Precondition: all 11 home slots filled, draft mechanically incomplete.
    expect(driver.getViewA().lineupSlots.every((s) => s !== null)).toBe(true);
    expect(driver.getViewA().draftComplete).toBe(false);

    let gameStateReceived = false;
    clientA.once(ServerEvents.GAME_STATE, () => {
      gameStateReceived = true;
    });

    const errorPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 1500);
      clientA.once(ServerEvents.GAME_ERROR, (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
    clientA.emit(ClientEvents.LINEUP_CONFIRM, { confirmedOrder: [] });
    const reason = await errorPromise;
    expect(reason).toBe('DRAFT_NOT_COMPLETE');

    // No GAME_STATE within a further wait window — the match must not have started.
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect(gameStateReceived).toBe(false);
  }, 20000);
});
