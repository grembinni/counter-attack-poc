/**
 * Pure draft-session state machine (Phase 29 Plan 02 — DRAFT-07/DRAFT-08/DRAFT-10;
 * rewritten Phase 30 Plan 03 — DRAFT-05/DRAFT-08 for the 6-round variable-pick model).
 *
 * This module has zero `io`/`socket` imports and produces no side effects — it mirrors
 * `gameEngine.ts`'s separation from `roomHandlers.ts` (RESEARCH.md Open Question 2). Every
 * function here takes a `DraftSession` and returns a brand-new `DraftSession` (or a
 * `{ session, ok, error? }` envelope for validated mutations); the input is never mutated
 * in place. Plan 04/05 wires these helpers into `roomHandlers.ts`, binding `crypto.randomInt`
 * as the `RandomIntFn` — this module never sources randomness itself (same convention as
 * `draftEngine.ts`/`scoreUtils.ts`).
 *
 * Round/pick protocol (D-12/D-13/D-14/D-15/D-20, phase-boundary-only mutual-wait gating):
 *   Round 1 (GK-only, D-12): PICK1 (1 card each) -> SWAP -> PICK2 (1 card each) -> round
 *     complete (no PICK3, no swap-back) -> openNextRound. 2 picks total.
 *   Rounds 2-6 (tiered, D-13/D-14/D-15): PICK1 (1 card each) -> SWAP -> PICK2 (1 card each)
 *     -> SWAP_BACK -> PICK3 (1 card each) -> round complete -> openNextRound. 3 picks total.
 *   `DRAFT_ROUNDS[round - 1].picks` (2 or 3) is the single source of truth `advanceSubStep`
 *   reads to decide whether a round stops after PICK2 or continues to PICK3 — never a
 *   hardcoded literal. `advanceSubStep` only advances once BOTH players have
 *   `picksRemaining === 0` in the current sub-step — never gated per individual card.
 *   After round 6 completes, `draftComplete = true`. Total picks per side across all 6
 *   rounds sums to 17 (D-16): 2 (round 1) + 3x5 (rounds 2-6).
 *
 * DRAFT-08 forced-GK-auto-pick safety-net removal (D-21): the old cycle-4 GK-auto-pick
 * fallback mechanic is fully deleted — superseded by round 1's dedicated GK-only pack
 * round, which guarantees every player exactly 2 GK cards structurally, with no auto-pick
 * fallback needed. No function, field, or view projection in this module references that
 * removed fallback mechanic; GK remains only a pack-dealing category (D-07), never a
 * safety concern here.
 *
 * Round-leftover discard (D-18): cards dealt into a round's packs but never picked are
 * discarded, never carried forward or auto-benched — `openNextRound` overwrites
 * `currentPack` from the next round's pack, never merging in whatever remained.
 *
 * Card-placement boundary: `applyPick`/`applyRearrange` do NOT perform GK-slot role
 * validation (only a GK card may occupy the GK slot, D-09) — that allow-list check is the
 * Plan 05 socket handler's job before it ever calls into this module. This module trusts
 * a pre-validated `destination`/`from`/`to` ref.
 *
 * Card-sort ordering: this module does not sort/reorder pack contents by tier (D-20's
 * "rarest cards populate/sort to the left" carousel ordering is a pure display concern,
 * decided to live in the client carousel component, Plan 03/05) — `openNextRound` copies
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
import { DRAFT_ROUNDS, DRAFT_ROUND_COUNT } from '@counter-attack/shared';

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
 * D-12..D-19/RESEARCH.md Pattern 3: a per-round coin-flip over that round's own two packs —
 * NEVER a global cross-round shuffle. Pack composition is round-specific (GK-only in round
 * 1, uncommon+common in round 4, etc.), so packs are no longer structurally interchangeable
 * across rounds; only "which of THIS round's two packs goes to home vs. away" is randomized.
 */
function assignRoundPackOrder(rng: RandomIntFn): ['home' | 'away', 'home' | 'away'] {
  return rng(0, 2) === 0 ? ['home', 'away'] : ['away', 'home'];
}

/**
 * Bootstraps a brand-new `DraftSession` from the 12 pre-generated packs (2 per round x 6
 * rounds, D-12..D-16). `round` starts at 0 and `picksRemaining` at 0 until the first
 * `openNextRound` call opens round 1 (the Plan 05 handler calls `openNextRound` immediately
 * after bootstrap). Pack-to-side assignment is a per-round coin-flip (`assignRoundPackOrder`)
 * — packs are grouped by their `round` field and each round's pair is independently
 * coin-flipped, never a single match-wide shuffle.
 */
export function createDraftSession(packs: DraftPack[], rng: RandomIntFn): DraftSession {
  const homePackOrder: number[] = [];
  const awayPackOrder: number[] = [];

  for (let round = 1; round <= DRAFT_ROUND_COUNT; round++) {
    const roundPackIndices = packs
      .map((pack, index) => ({ pack, index }))
      .filter(({ pack }) => pack.round === round)
      .map(({ index }) => index);
    const [packAIdx, packBIdx] = roundPackIndices;
    const [firstSide] = assignRoundPackOrder(rng);
    if (firstSide === 'home') {
      homePackOrder.push(packAIdx!);
      awayPackOrder.push(packBIdx!);
    } else {
      homePackOrder.push(packBIdx!);
      awayPackOrder.push(packAIdx!);
    }
  }

  return {
    round: 0,
    subStep: 'PICK1',
    draftPacks: packs,
    homePackOrder,
    awayPackOrder,
    homeCurrentPack: [],
    awayCurrentPack: [],
    homeDraftedIds: [],
    awayDraftedIds: [],
    homePicksRemaining: 0,
    awayPicksRemaining: 0,
    homeLineupSlots: new Array<string | null>(LINEUP_SLOT_COUNT).fill(null),
    awayLineupSlots: new Array<string | null>(LINEUP_SLOT_COUNT).fill(null),
    homeBenchIds: [],
    awayBenchIds: [],
    homeBenchNumbers: {},
    awayBenchNumbers: {},
    draftComplete: false,
  };
}

/** Internal per-side view of the fields that vary by `home`/`away` prefix. */
type SideFields = {
  currentPack: TieredPoolPlayer[];
  draftedIds: string[];
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
        picksRemaining: session.homePicksRemaining,
        lineupSlots: session.homeLineupSlots,
        benchIds: session.homeBenchIds,
        benchNumbers: session.homeBenchNumbers,
      }
    : {
        currentPack: session.awayCurrentPack,
        draftedIds: session.awayDraftedIds,
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
    awayPicksRemaining: fields.picksRemaining ?? session.awayPicksRemaining,
    awayLineupSlots: fields.lineupSlots ?? session.awayLineupSlots,
    awayBenchIds: fields.benchIds ?? session.awayBenchIds,
    awayBenchNumbers: fields.benchNumbers ?? session.awayBenchNumbers,
  };
}

/**
 * Opens each player's next pre-assigned round pack (D-12..D-19): increments `round`, sets
 * each side's `currentPack` from `draftPacks[<side>PackOrder[round-1]].cards` (copied, not
 * referenced), resets `subStep` to 'PICK1', and `picksRemaining` to 1 each. Round-leftover
 * cards from the PREVIOUS round are discarded (D-18) simply by not carrying `currentPack`
 * forward — this function always overwrites it from the new round's pack.
 */
export function openNextRound(session: DraftSession): DraftSession {
  const newRound = session.round + 1;
  const homePackIndex = session.homePackOrder[newRound - 1];
  const awayPackIndex = session.awayPackOrder[newRound - 1];
  const homePack = homePackIndex !== undefined ? session.draftPacks[homePackIndex] : undefined;
  const awayPack = awayPackIndex !== undefined ? session.draftPacks[awayPackIndex] : undefined;

  return {
    ...session,
    round: newRound,
    subStep: 'PICK1',
    homeCurrentPack: homePack ? [...homePack.cards] : [],
    awayCurrentPack: awayPack ? [...awayPack.cards] : [],
    homePicksRemaining: 1,
    awayPicksRemaining: 1,
  };
}

/**
 * Drafts `cardId` out of `side`'s current pack and places it at `destination` (D-06/D-07).
 * Does NOT validate GK-slot role rules (D-09) — see module doc comment; the caller
 * (Plan 05 handler) is responsible for that allow-list check before calling this.
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
    picksRemaining: newPicksRemaining,
    lineupSlots: newLineupSlots,
    benchIds: newBenchIds,
  });

  return { session: newSession, ok: true };
}

/**
 * Moves an ALREADY-drafted card between a lineup slot and/or the bench (D-08). Never
 * touches `round`/`subStep`/`picksRemaining` (D-10) — rearranging drafted cards has no
 * effect on round progression. Does NOT validate GK-slot role rules (D-09) — see module
 * doc comment; the caller (Plan 05 handler) does that allow-list check first.
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
      if (from.type === 'slot') {
        // D-24: slot->slot is a true two-way swap — the displaced occupant returns to the
        // dragged card's just-vacated source slot, never the bench.
        lineupSlots[from.slotIndex] = displaced;
      } else {
        // D-07: bench-origin moves displace the destination slot's current occupant to the
        // bench — there is no source lineup slot to return it to.
        benchIds = [...benchIds, displaced];
      }
    }
    lineupSlots[to.slotIndex] = cardId;
  } else {
    benchIds = [...benchIds, cardId];
  }

  const newSession = withSide(session, side, { lineupSlots, benchIds });
  return { session: newSession, ok: true };
}

/**
 * Advances the sub-step/round state machine (D-12..D-20, phase-boundary-only gating A1).
 * No-op while either side still has `picksRemaining > 0` in the current sub-step.
 *
 * PICK1 -> PICK2: swaps `homeCurrentPack`/`awayCurrentPack`; sets `picksRemaining` to 1
 *   each (always 1 — pick count no longer varies per sub-step, only per round via
 *   `DRAFT_ROUNDS[round - 1].picks`, D-20).
 * At the PICK2 boundary, reads `DRAFT_ROUNDS[session.round - 1].picks`:
 *   - 2 (round 1, D-12): the round completes after PICK2 — no PICK3, no swap-back.
 *   - 3 (rounds 2-6, D-13/D-14/D-15): PICK2 -> PICK3 swaps packs back to their original
 *     owners, `picksRemaining` 1 each; PICK3 completes the round.
 * Round-leftover cards are discarded (D-18) simply by not carrying `currentPack` forward —
 * `openNextRound` overwrites it from the next round's pack.
 * On round completion: if `round < DRAFT_ROUND_COUNT`, opens the next round
 * (`openNextRound`); otherwise sets `draftComplete = true` and leaves `subStep` as-is.
 */
export function advanceSubStep(session: DraftSession): DraftSession {
  if (session.homePicksRemaining !== 0 || session.awayPicksRemaining !== 0) {
    return session; // still waiting on at least one player — phase-boundary-only gate
  }

  if (session.subStep === 'PICK1') {
    return {
      ...session,
      subStep: 'PICK2',
      homeCurrentPack: session.awayCurrentPack,
      awayCurrentPack: session.homeCurrentPack,
      homePicksRemaining: 1,
      awayPicksRemaining: 1,
    };
  }

  const roundConfig = DRAFT_ROUNDS[session.round - 1];
  const picksThisRound = roundConfig?.picks ?? 3;

  if (session.subStep === 'PICK2') {
    if (picksThisRound === 2) {
      // D-12: round 1 completes after PICK2 — no PICK3, no swap-back.
      return session.round < DRAFT_ROUND_COUNT
        ? openNextRound(session)
        : { ...session, draftComplete: true };
    }
    return {
      ...session,
      subStep: 'PICK3',
      homeCurrentPack: session.awayCurrentPack,
      awayCurrentPack: session.homeCurrentPack,
      homePicksRemaining: 1,
      awayPicksRemaining: 1,
    };
  }

  // subStep === 'PICK3': leftover cards discarded (D-18) — never carried into openNextRound.
  return session.round < DRAFT_ROUND_COUNT
    ? openNextRound(session)
    : { ...session, draftComplete: true };
}

/**
 * D-15/D-16: assigns each bench id a DISTINCT random jersey number in [15,99] (never
 * sequential, never the insecure built-in pseudo-random helper). Shuffles the full 85-value
 * range and takes the first N — the range is always far larger than any possible bench size
 * (max 17 drafted minus 11 lineup slots = 6), so distinctness is guaranteed without a
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
 * Phase 48 / D-05 / NUMBER-05: fills in a jersey number for any bench id that doesn't have
 * one yet, WITHOUT ever touching a number that's already assigned. This is the only
 * sanctioned way to add bench numbers after the initial `assignBenchNumbers` draw — it
 * deliberately never re-rolls an existing entry, encoding D-05's "fill gaps, never re-roll"
 * rule in exactly one tested place (used by plan 48-05 to close the `DRAFT_REARRANGE`
 * orphan-to-`0` gap).
 *
 * Idempotent: calling this twice in a row with the same inputs returns the identical
 * `benchNumbers` contents the second time, and if nothing is missing the second call
 * returns the exact same `session` reference (no allocation, no RNG call) — the load-bearing
 * half of "never re-roll once assigned".
 */
export function backfillBenchNumbers(
  session: DraftSession,
  side: DraftSide,
  rng: RandomIntFn,
): DraftSession {
  const { benchIds, benchNumbers } = getSide(session, side);

  // Distinct ids missing a number. benchIds can legitimately contain a repeated id (pack
  // generation only guards duplication within a round) — dedupe so a repeated id consumes
  // exactly one number.
  const missingIds = Array.from(
    new Set(benchIds.filter((id) => !Object.prototype.hasOwnProperty.call(benchNumbers, id))),
  );

  if (missingIds.length === 0) {
    return session;
  }

  const range = Array.from(
    { length: BENCH_NUMBER_MAX - BENCH_NUMBER_MIN + 1 },
    (_, i) => i + BENCH_NUMBER_MIN,
  );
  const inUse = new Set(Object.values(benchNumbers));
  const available = range.filter((n) => !inUse.has(n));
  const shuffled = shuffle(available, rng);

  const drawn: Record<string, number> = {};
  missingIds.forEach((id, index) => {
    drawn[id] = shuffled[index]!;
  });

  return withSide(session, side, { benchNumbers: { ...benchNumbers, ...drawn } });
}

/**
 * D-14/T-29-PRIV/T-30-PRIV: projects the privacy-scoped per-player view — the single place
 * that decides what a given side is allowed to see. Never includes the opponent's pack or
 * any opponent-prefixed field; `DraftClientView`'s shape enforces this structurally. The
 * old GK-auto-pick view projection (D-05/D-21) is fully removed, not just trimmed.
 */
export function buildDraftView(session: DraftSession, side: DraftSide): DraftClientView {
  const current = getSide(session, side);
  const opponentPicksRemaining =
    side === 'home' ? session.awayPicksRemaining : session.homePicksRemaining;

  return {
    round: session.round,
    subStep: session.subStep satisfies DraftSubStep,
    currentPack: current.currentPack,
    picksRemaining: current.picksRemaining,
    waitingForOpponent:
      current.picksRemaining === 0 && opponentPicksRemaining > 0 && !session.draftComplete,
    lineupSlots: current.lineupSlots,
    benchIds: current.benchIds,
    benchNumbers: current.benchNumbers,
    draftComplete: session.draftComplete,
  };
}
