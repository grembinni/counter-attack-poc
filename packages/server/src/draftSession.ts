/**
 * Pure draft-session state machine (Phase 29 Plan 02 — DRAFT-07/DRAFT-08/DRAFT-10).
 *
 * This module has zero `io`/`socket` imports and produces no side effects — it mirrors
 * `gameEngine.ts`'s separation from `roomHandlers.ts` (RESEARCH.md Open Question 2). Every
 * function here takes a `DraftSession` and returns a brand-new `DraftSession` (or a
 * `{ session, ok, error? }` envelope for validated mutations); the input is never mutated
 * in place. Plan 04 wires these helpers into `roomHandlers.ts`, binding `crypto.randomInt`
 * as the `RandomIntFn` — this module never sources randomness itself (same convention as
 * `draftEngine.ts`/`scoreUtils.ts`).
 *
 * Pack-swap protocol (D-01/D-03, phase-boundary-only mutual-wait gating, A1):
 *   PICK1 (1 card each) -> SWAP -> PICK2 (2 cards each) -> SWAP_BACK -> PICK3 (1 card each,
 *   3 leftovers discarded, D-02) -> NEW_PACK (cycle++) -> ... x4 cycles = 16 cards/player.
 *   `advanceSubStep` only advances once BOTH players have `picksRemaining === 0` in the
 *   current sub-step — never gated per individual card within PICK2.
 *
 * Card-placement boundary: `applyPick`/`applyRearrange` do NOT perform GK-slot role
 * validation (only a GK card may occupy the GK slot, D-09) — that allow-list check is the
 * Plan 04 socket handler's job before it ever calls into this module. This module trusts
 * a pre-validated `destination`/`from`/`to` ref.
 *
 * Card-sort ordering: this module does not sort/reorder pack contents by tier (D-20's
 * "rarest cards populate/sort to the left" carousel ordering is a pure display concern,
 * decided to live in the client carousel component, Plan 03/05) — `openNextPack` copies
 * `DraftPack.cards` verbatim in whatever order `generateDraftPacks` dealt them.
 */

import type {
  DraftSession,
  DraftClientView,
  DraftSubStep,
  DraftDestination,
  DraftSlotRef,
  DraftPack,
  TieredPoolPlayer,
  RandomIntFn,
} from '@counter-attack/shared';

/** Local alias — matches the 'home' | 'away' literal used throughout the room/game layer. */
export type DraftSide = 'home' | 'away';

const LINEUP_SLOT_COUNT = 11;
/** D-15/D-16: bench jersey numbers are drawn from this inclusive range, never sequential. */
const BENCH_NUMBER_MIN = 15;
const BENCH_NUMBER_MAX = 99;

/**
 * Fisher-Yates shuffle using the injected `rng`. Copies `items` first — never mutates the
 * input array (matches `draftEngine.ts`'s `shuffle` helper, reimplemented locally per the
 * plan's "do NOT import the private one" instruction).
 */
function shuffle<T>(items: readonly T[], rng: RandomIntFn): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng(0, i + 1);
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/**
 * D-04 / Pitfall 5: independent shuffle over pack INDICES (never a slice of
 * `generateDraftPacks`'s own dealt order) so pack->player assignment is not a predictable
 * fixed split. Splits the shuffled indices evenly: first half to home, second half to away.
 */
export function assignPackOrders(
  packCount: number,
  rng: RandomIntFn,
): { homePackOrder: number[]; awayPackOrder: number[] } {
  const indices = Array.from({ length: packCount }, (_, i) => i);
  const shuffled = shuffle(indices, rng);
  const half = packCount / 2;
  return {
    homePackOrder: shuffled.slice(0, half),
    awayPackOrder: shuffled.slice(half),
  };
}

/**
 * Bootstraps a brand-new `DraftSession` from the 8 pre-generated packs. `cycle` starts at
 * 0 and `picksRemaining` at 0 until the first `openNextPack` call opens cycle 1 (the Plan
 * 04 handler calls `openNextPack` immediately after bootstrap).
 */
export function createDraftSession(packs: DraftPack[], rng: RandomIntFn): DraftSession {
  const { homePackOrder, awayPackOrder } = assignPackOrders(packs.length, rng);

  return {
    cycle: 0,
    subStep: 'PICK1',
    draftPacks: packs,
    homePackOrder,
    awayPackOrder,
    homeCurrentPack: [],
    awayCurrentPack: [],
    homeDraftedIds: [],
    awayDraftedIds: [],
    homeHasKeeper: false,
    awayHasKeeper: false,
    homePicksRemaining: 0,
    awayPicksRemaining: 0,
    homeLineupSlots: new Array<string | null>(LINEUP_SLOT_COUNT).fill(null),
    awayLineupSlots: new Array<string | null>(LINEUP_SLOT_COUNT).fill(null),
    homeBenchIds: [],
    awayBenchIds: [],
    homeBenchNumbers: {},
    awayBenchNumbers: {},
    keeperAutoPickedThisCycle: { home: false, away: false },
    draftComplete: false,
  };
}

/** Internal per-side view of the fields that vary by `home`/`away` prefix. */
type SideFields = {
  currentPack: TieredPoolPlayer[];
  draftedIds: string[];
  hasKeeper: boolean;
  picksRemaining: number;
  lineupSlots: (string | null)[];
  benchIds: string[];
  benchNumbers: Record<string, number>;
};

function getSide(session: DraftSession, side: DraftSide): SideFields {
  return side === 'home'
    ? {
        currentPack: session.homeCurrentPack,
        draftedIds: session.homeDraftedIds,
        hasKeeper: session.homeHasKeeper,
        picksRemaining: session.homePicksRemaining,
        lineupSlots: session.homeLineupSlots,
        benchIds: session.homeBenchIds,
        benchNumbers: session.homeBenchNumbers,
      }
    : {
        currentPack: session.awayCurrentPack,
        draftedIds: session.awayDraftedIds,
        hasKeeper: session.awayHasKeeper,
        picksRemaining: session.awayPicksRemaining,
        lineupSlots: session.awayLineupSlots,
        benchIds: session.awayBenchIds,
        benchNumbers: session.awayBenchNumbers,
      };
}

/** Returns a NEW session with the given side's fields replaced (fields not passed are kept as-is). */
function withSide(
  session: DraftSession,
  side: DraftSide,
  fields: Partial<SideFields>,
): DraftSession {
  if (side === 'home') {
    return {
      ...session,
      homeCurrentPack: fields.currentPack ?? session.homeCurrentPack,
      homeDraftedIds: fields.draftedIds ?? session.homeDraftedIds,
      homeHasKeeper: fields.hasKeeper ?? session.homeHasKeeper,
      homePicksRemaining: fields.picksRemaining ?? session.homePicksRemaining,
      homeLineupSlots: fields.lineupSlots ?? session.homeLineupSlots,
      homeBenchIds: fields.benchIds ?? session.homeBenchIds,
      homeBenchNumbers: fields.benchNumbers ?? session.homeBenchNumbers,
    };
  }
  return {
    ...session,
    awayCurrentPack: fields.currentPack ?? session.awayCurrentPack,
    awayDraftedIds: fields.draftedIds ?? session.awayDraftedIds,
    awayHasKeeper: fields.hasKeeper ?? session.awayHasKeeper,
    awayPicksRemaining: fields.picksRemaining ?? session.awayPicksRemaining,
    awayLineupSlots: fields.lineupSlots ?? session.awayLineupSlots,
    awayBenchIds: fields.benchIds ?? session.awayBenchIds,
    awayBenchNumbers: fields.benchNumbers ?? session.awayBenchNumbers,
  };
}

/**
 * Opens each player's next pre-assigned pack (D-01/D-04): increments `cycle`, sets each
 * side's `currentPack` from `draftPacks[<side>PackOrder[cycle-1]].cards` (copied, not
 * referenced), resets `subStep` to 'PICK1', `picksRemaining` to 1 each, and clears
 * `keeperAutoPickedThisCycle` for the new cycle.
 */
export function openNextPack(session: DraftSession): DraftSession {
  const newCycle = session.cycle + 1;
  const homePackIndex = session.homePackOrder[newCycle - 1];
  const awayPackIndex = session.awayPackOrder[newCycle - 1];
  const homePack = homePackIndex !== undefined ? session.draftPacks[homePackIndex] : undefined;
  const awayPack = awayPackIndex !== undefined ? session.draftPacks[awayPackIndex] : undefined;

  return {
    ...session,
    cycle: newCycle,
    subStep: 'PICK1',
    homeCurrentPack: homePack ? [...homePack.cards] : [],
    awayCurrentPack: awayPack ? [...awayPack.cards] : [],
    homePicksRemaining: 1,
    awayPicksRemaining: 1,
    keeperAutoPickedThisCycle: { home: false, away: false },
  };
}

/**
 * Drafts `cardId` out of `side`'s current pack and places it at `destination` (D-06/D-07).
 * Does NOT validate GK-slot role rules (D-09) — see module doc comment; the caller
 * (Plan 04 handler) is responsible for that allow-list check before calling this.
 */
export function applyPick(
  session: DraftSession,
  side: DraftSide,
  cardId: string,
  destination: DraftDestination,
): { session: DraftSession; ok: boolean; error?: string } {
  const current = getSide(session, side);
  const card = current.currentPack.find((c) => c.id === cardId);
  if (!card) {
    return { session, ok: false, error: 'INVALID_CARD' };
  }

  const newCurrentPack = current.currentPack.filter((c) => c.id !== cardId);
  const newDraftedIds = [...current.draftedIds, cardId];
  const newHasKeeper = current.hasKeeper || card.tier === 'keeper';
  const newPicksRemaining = current.picksRemaining - 1;

  let newLineupSlots = current.lineupSlots;
  let newBenchIds = current.benchIds;

  if (destination.type === 'slot') {
    newLineupSlots = [...current.lineupSlots];
    const occupant = newLineupSlots[destination.slotIndex];
    if (occupant) {
      // D-07: the displaced occupant moves to the bench, never discarded.
      newBenchIds = [...current.benchIds, occupant];
    }
    newLineupSlots[destination.slotIndex] = cardId;
  } else {
    newBenchIds = [...current.benchIds, cardId];
  }

  const newSession = withSide(session, side, {
    currentPack: newCurrentPack,
    draftedIds: newDraftedIds,
    hasKeeper: newHasKeeper,
    picksRemaining: newPicksRemaining,
    lineupSlots: newLineupSlots,
    benchIds: newBenchIds,
  });

  return { session: newSession, ok: true };
}

/**
 * Moves an ALREADY-drafted card between a lineup slot and/or the bench (D-08). Never
 * touches `cycle`/`subStep`/`picksRemaining` (D-10) — rearranging drafted cards has no
 * effect on cycle progression. Does NOT validate GK-slot role rules (D-09) — see module
 * doc comment; the caller (Plan 04 handler) does that allow-list check first.
 */
export function applyRearrange(
  session: DraftSession,
  side: DraftSide,
  from: DraftSlotRef,
  to: DraftSlotRef,
): { session: DraftSession; ok: boolean; error?: string } {
  const current = getSide(session, side);

  const lineupSlots = [...current.lineupSlots];
  let benchIds = [...current.benchIds];

  let cardId: string | null = null;
  if (from.type === 'slot') {
    const occupant = lineupSlots[from.slotIndex];
    if (!occupant) {
      return { session, ok: false, error: 'INVALID_REARRANGE' };
    }
    cardId = occupant;
    lineupSlots[from.slotIndex] = null;
  } else {
    const occupant = benchIds[from.benchIndex];
    if (!occupant) {
      return { session, ok: false, error: 'INVALID_REARRANGE' };
    }
    cardId = occupant;
    benchIds = benchIds.filter((_, idx) => idx !== from.benchIndex);
  }

  if (to.type === 'slot') {
    const displaced = lineupSlots[to.slotIndex];
    if (displaced) {
      // D-07: displace the destination slot's current occupant to the bench.
      benchIds = [...benchIds, displaced];
    }
    lineupSlots[to.slotIndex] = cardId;
  } else {
    benchIds = [...benchIds, cardId];
  }

  const newSession = withSide(session, side, { lineupSlots, benchIds });
  return { session: newSession, ok: true };
}

/**
 * Advances the sub-step/cycle state machine (D-01/D-03, phase-boundary-only gating A1).
 * No-op while either side still has `picksRemaining > 0` in the current sub-step.
 *
 * PICK1 -> PICK2: swaps `homeCurrentPack`/`awayCurrentPack`; sets `picksRemaining` to 2
 *   each, UNLESS `keeperAutoPickedThisCycle[side]` is true (Task 3/checkKeeperSafety already
 *   consumed one of that side's PICK2 picks), in which case that side gets 1.
 * PICK2 -> PICK3: swaps packs back to their original owners; `picksRemaining` 1 each.
 * PICK3 -> NEW_PACK/complete: the 3 leftover cards are discarded (D-02) simply by not
 *   carrying `currentPack` forward — `openNextPack` overwrites it from the next pack index.
 *   If `cycle < 4`, opens the next cycle's packs (cycle++, subStep 'PICK1'). If `cycle ===
 *   4`, sets `draftComplete = true` and leaves `subStep` as-is.
 */
export function advanceSubStep(session: DraftSession): DraftSession {
  if (session.homePicksRemaining !== 0 || session.awayPicksRemaining !== 0) {
    return session; // still waiting on at least one player — phase-boundary-only gate
  }

  if (session.subStep === 'PICK1') {
    const homePicksRemaining = session.keeperAutoPickedThisCycle.home ? 1 : 2;
    const awayPicksRemaining = session.keeperAutoPickedThisCycle.away ? 1 : 2;
    return {
      ...session,
      subStep: 'PICK2',
      homeCurrentPack: session.awayCurrentPack,
      awayCurrentPack: session.homeCurrentPack,
      homePicksRemaining,
      awayPicksRemaining,
    };
  }

  if (session.subStep === 'PICK2') {
    return {
      ...session,
      subStep: 'PICK3',
      homeCurrentPack: session.awayCurrentPack,
      awayCurrentPack: session.homeCurrentPack,
      homePicksRemaining: 1,
      awayPicksRemaining: 1,
    };
  }

  // subStep === 'PICK3': leftover 3 cards discarded (D-02) — never carried into openNextPack.
  if (session.cycle < 4) {
    return openNextPack(session);
  }

  return {
    ...session,
    draftComplete: true,
  };
}

function autoSelectKeeperIfMissing(session: DraftSession, side: DraftSide): DraftSession {
  const current = getSide(session, side);
  if (current.hasKeeper) {
    return session; // already safe — no-op for this side
  }

  // A3 / Phase 28 invariant: PACK_COMPOSITION.keeper === 1 for every generated pack, so the
  // player's own cycle-4 pack is guaranteed to still contain its keeper if never drafted.
  const keeperCard = current.currentPack.find((c) => c.tier === 'keeper');
  if (!keeperCard) {
    return session; // defensive no-op — should be unreachable given the Phase 28 invariant
  }

  const newCurrentPack = current.currentPack.filter((c) => c.id !== keeperCard.id);
  const newDraftedIds = [...current.draftedIds, keeperCard.id];

  let newLineupSlots = current.lineupSlots;
  let newBenchIds = current.benchIds;
  if (current.lineupSlots[0] === null) {
    // UI-SPEC Component Note 5: auto-place into the empty GK slot (index 0) if unfilled.
    newLineupSlots = [...current.lineupSlots];
    newLineupSlots[0] = keeperCard.id;
  } else {
    newBenchIds = [...current.benchIds, keeperCard.id];
  }

  const updated = withSide(session, side, {
    currentPack: newCurrentPack,
    draftedIds: newDraftedIds,
    hasKeeper: true,
    lineupSlots: newLineupSlots,
    benchIds: newBenchIds,
  });

  return {
    ...updated,
    keeperAutoPickedThisCycle: {
      ...updated.keeperAutoPickedThisCycle,
      [side]: true,
    },
  };
}

/**
 * DRAFT-08: cycle-4 keeper safety net. Only acts when `cycle === 4`, `subStep === 'PICK1'`,
 * and BOTH players have resolved their PICK1 pick (`picksRemaining === 0` each) — the exact
 * boundary right before the PICK1->PICK2 transition (Plan 04 calls this BEFORE
 * `advanceSubStep`, so the reduced `picksRemaining` lands on the correct player's PICK2,
 * per `advanceSubStep`'s `keeperAutoPickedThisCycle` check above).
 *
 * `rng` is accepted for signature parity with the other fairness-sensitive helpers in this
 * module, but is unused: every generated pack is guaranteed exactly one keeper-tier card
 * (`PACK_COMPOSITION.keeper === 1`), so there is never a choice to make randomly.
 */
export function checkKeeperSafety(session: DraftSession, rng: RandomIntFn): DraftSession {
  void rng;

  if (session.cycle !== 4 || session.subStep !== 'PICK1') {
    return session;
  }
  if (session.homePicksRemaining !== 0 || session.awayPicksRemaining !== 0) {
    return session;
  }

  let next = autoSelectKeeperIfMissing(session, 'home');
  next = autoSelectKeeperIfMissing(next, 'away');
  return next;
}

/**
 * D-15/D-16: assigns each bench id a DISTINCT random jersey number in [15,99] (never
 * sequential, never the insecure built-in pseudo-random helper). Shuffles the full 85-value
 * range and takes the first N — the range is always far larger than any possible bench size
 * (max 16 drafted minus 11 lineup slots = 5), so distinctness is guaranteed without a
 * rejection-sampling loop.
 */
export function assignBenchNumbers(benchIds: string[], rng: RandomIntFn): Record<string, number> {
  const range = Array.from(
    { length: BENCH_NUMBER_MAX - BENCH_NUMBER_MIN + 1 },
    (_, i) => i + BENCH_NUMBER_MIN,
  );
  const shuffled = shuffle(range, rng);

  const numbers: Record<string, number> = {};
  benchIds.forEach((id, index) => {
    numbers[id] = shuffled[index]!;
  });
  return numbers;
}

/**
 * D-14/T-29-PRIV: projects the privacy-scoped per-player view — the single place that
 * decides what a given side is allowed to see. Never includes the opponent's pack or any
 * opponent-prefixed field; `DraftClientView`'s shape enforces this structurally.
 */
export function buildDraftView(session: DraftSession, side: DraftSide): DraftClientView {
  const current = getSide(session, side);
  const opponentPicksRemaining =
    side === 'home' ? session.awayPicksRemaining : session.homePicksRemaining;
  const keeperAutoPickedThisCycle =
    side === 'home'
      ? session.keeperAutoPickedThisCycle.home
      : session.keeperAutoPickedThisCycle.away;

  return {
    cycle: session.cycle,
    subStep: session.subStep satisfies DraftSubStep,
    currentPack: current.currentPack,
    picksRemaining: current.picksRemaining,
    waitingForOpponent:
      current.picksRemaining === 0 && opponentPicksRemaining > 0 && !session.draftComplete,
    lineupSlots: current.lineupSlots,
    benchIds: current.benchIds,
    benchNumbers: current.benchNumbers,
    keeperAutoPickedThisCycle,
    draftComplete: session.draftComplete,
  };
}
