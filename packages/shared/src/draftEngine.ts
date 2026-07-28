/**
 * Draft data-model engine — pool derivation and tier classification.
 *
 * DRAFT-04 (Phase 30), D-03/D-04: Classify each player into a rarity tier by a FIXED
 *       ABSOLUTE total-stat threshold (`TIER_STAT_THRESHOLDS`) — a player's tier is a
 *       pure function of their own total stat, with no population/ranking context
 *       needed. Replaces the old session-relative percentile-ranking model entirely.
 * D-04: Pool derivation ('original' = free-agent, untagged; 'mls'/'international' via
 *       TEAM_CONFIGS[sourceTeamId].league).
 * D-04/D-05 (Phase 30): GKs are classified by the IDENTICAL thresholds as outfield
 *       players — no separate GK-specific cutoffs, and no reserved 5th GK-only tier
 *       value. GK remains a distinct pack-dealing category (D-07) but is no longer a
 *       rarity.
 * D-07: Total stat = sum of all 9 PoolPlayer numeric stat fields.
 * D-09 (Phase 30): `isInPool` bridges the CSV's singular `PoolTag` ('legend'/'icon') to
 *       the plural `DraftPoolId` ('legends'/'icons') via `POOL_TAG_TO_DRAFT_POOL`.
 * D-13: This module emits ONLY the tier enum value — no color/label display constants
 *       (those live client-side).
 *
 * Pure module: no side effects, no internal RNG source, importable identically by
 * client and server — matches the scoreUtils.ts convention.
 */

import type { PoolPlayer } from './teams.js';
import { PLAYER_POOL } from './teams.js';
import { TEAM_CONFIGS } from './teamConfig.js';
import type { TeamId } from './teamConfig.js';
import type { DraftPoolId, DraftTier, PackSlot, RoundConfig } from './types.js';
import {
  TIER_STAT_THRESHOLDS,
  SELECTABLE_DRAFT_POOLS,
  DRAFT_ROUNDS,
  PACKS_PER_ROUND,
} from './types.js';

/**
 * DRAFT-04 (Phase 28), D-13: A pooled player annotated with its classified rarity tier
 * and precomputed total stat. Tier value only — no display/color constants here.
 */
export interface TieredPoolPlayer extends PoolPlayer {
  tier: DraftTier;
  totalStat: number;
}

/**
 * D-07: "Total stat count" = sum of all 9 PoolPlayer numeric stat fields.
 * Outfield players' saving/handling are always 0 and simply add 0 — one uniform
 * formula, no role-conditional branches. Jersey `number` and `position` are NOT stats.
 */
export function computeTotalStat(player: PoolPlayer): number {
  return (
    player.pace +
    player.shooting +
    player.tackling +
    player.dribbling +
    player.saving +
    player.handling +
    player.resilience +
    player.aerialAbility +
    player.highPass
  );
}

/**
 * D-03/D-04 (Phase 30): fixed-absolute-threshold classification — the identical rule for
 * GK and outfield players alike. No population/ranking context needed: a player's tier is
 * a pure function of their own total stat.
 */
export function classifyTier(totalStat: number): DraftTier {
  if (totalStat >= TIER_STAT_THRESHOLDS.chase) return 'chase';
  if (totalStat === TIER_STAT_THRESHOLDS.rare) return 'rare';
  if (totalStat >= TIER_STAT_THRESHOLDS.uncommon) return 'uncommon';
  return 'common';
}

/**
 * D-09 (Phase 30): bridges the CSV's singular `PoolTag` values to the plural
 * `DraftPoolId` values `isInPool` compares against.
 */
const POOL_TAG_TO_DRAFT_POOL: Readonly<Record<'legend' | 'icon', DraftPoolId>> = {
  legend: 'legends',
  icon: 'icons',
};

/**
 * D-04: Determines whether `player` belongs to the given draft pool.
 * - 'original': free-agent sourceTeamId AND no poolTag (reserved Legends/Icons excluded).
 * - 'mls' / 'international': TEAM_CONFIGS[sourceTeamId].league matches poolId.
 * - 'legends' / 'icons' (D-09, Phase 30): bridges the singular CSV `poolTag`
 *   ('legend'/'icon') to the plural `DraftPoolId` via `POOL_TAG_TO_DRAFT_POOL`.
 *
 * Optional chaining on the TEAM_CONFIGS lookup ensures a sourceTeamId absent from
 * TEAM_CONFIGS (e.g. 'free-agent') yields false for the league branches rather than
 * throwing.
 */
export function isInPool(player: PoolPlayer, poolId: DraftPoolId): boolean {
  if (poolId === 'original') {
    return player.sourceTeamId === 'free-agent' && !player.poolTag;
  }
  if (poolId === 'mls' || poolId === 'international') {
    const config = TEAM_CONFIGS[player.sourceTeamId as TeamId];
    return config?.league === poolId;
  }
  // 'legends' / 'icons' (D-09): bridge the CSV's singular PoolTag to the plural DraftPoolId.
  return player.poolTag !== undefined && POOL_TAG_TO_DRAFT_POOL[player.poolTag] === poolId;
}

/**
 * D-04: Resolves the union of players belonging to ANY of the given pool ids.
 * Preserves PLAYER_POOL's iteration order (sequential id order p001..p188) so
 * downstream stable tie-breaks (D-06) remain id-ordered. A single filter pass over
 * PLAYER_POOL suffices to dedupe — each player appears exactly once in PLAYER_POOL,
 * so no cross-pool duplicate is possible.
 */
export function resolvePoolPlayers(poolIds: DraftPoolId[]): PoolPlayer[] {
  return PLAYER_POOL.filter((player) => poolIds.some((poolId) => isInPool(player, poolId)));
}

/**
 * D-04/D-05 (Phase 30): Classifies `players` into rarity tiers.
 *
 * A pure per-player map — no population/ranking context at all. Every player (GK and
 * outfield alike) is classified by `classifyTier(computeTotalStat(player))` using the
 * identical fixed thresholds (D-04). Some GKs legitimately land in 'common' under this
 * rule (D-24 — an accepted, cosmetic-only outcome; GK tier does not affect pack dealing,
 * D-07). Output preserves the input array's order and length; does not mutate the input
 * array or PLAYER_POOL.
 */
export function assignTiers(players: PoolPlayer[]): TieredPoolPlayer[] {
  return players.map((player) => {
    const totalStat = computeTotalStat(player);
    return { ...player, tier: classifyTier(totalStat), totalStat };
  });
}

/**
 * DRAFT-05 (Phase 28): injected randomness source for shuffling and backfill sampling.
 * Mirrors Node's `crypto.randomInt(min, max)` signature exactly (min inclusive, max
 * exclusive) so the server (28-04) can pass `crypto.randomInt` straight through with no
 * adapter. This module never sources randomness itself — no built-in RNG import here,
 * matching `scoreUtils.ts`'s "dice values passed in — no RNG here" convention. Keeping
 * the shared engine RNG-agnostic is also a fairness boundary: pack contents are
 * gameplay-affecting, so the randomness source must be uncontrollable by either client.
 */
export type RandomIntFn = (minInclusive: number, maxExclusive: number) => number;

/**
 * DRAFT-05 (Phase 28), D-09, D-12..D-19 (Phase 30): One dealt pack. `packNumber` is
 * 1-based so callers/UI can label packs without re-deriving an index. `round` is the
 * 1-based round number (1..6, DRAFT_ROUND_COUNT) this pack belongs to — added so the
 * round-structured state machine (Plan 03) can validate pack/round alignment.
 */
export interface DraftPack {
  packNumber: number;
  round: number;
  cards: TieredPoolPlayer[];
}

/**
 * Fisher-Yates shuffle using the injected `rng`. Copies `items` first — never mutates
 * the input array (matches the module's no-side-effects convention; `PLAYER_POOL`-
 * derived arrays must stay immutable from the caller's perspective).
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
 * D-11 (Phase 30): fallback chain used to backfill a short pack candidate pool.
 * International is removed as a backfill SOURCE entirely (still directly selectable
 * as its own pool, per D-11) — only MLS and Original ever backfill another pool's
 * shortage, in that order.
 */
const FALLBACK_POOL_ORDER: readonly DraftPoolId[] = ['mls', 'original'];

/** D-17 (Phase 30): the three position buckets a non-GK pack's cap is tracked against. */
type PositionBucket = 'DEF' | 'MID' | 'FWD_ST';

/** D-17: maps a player's role to its position bucket; GK has no bucket (GK packs never reach here). */
function bucketForRole(role: PoolPlayer['role']): PositionBucket | null {
  if (role === 'DEF') return 'DEF';
  if (role === 'MID') return 'MID';
  if (role === 'FWD' || role === 'ST') return 'FWD_ST';
  return null;
}

/**
 * Pattern 4 (RESEARCH.md): rarest-first slot processing order so scarcer tiers are dealt
 * before the more plentiful 'common' tier exhausts the position-bucket headroom.
 */
const SLOT_RARITY_ORDER: Record<PackSlot['tier'], number> = {
  chaseOrRare: 0,
  chase: 0,
  rare: 0,
  uncommon: 1,
  common: 2,
};

function sortSlotsRarestFirst(slots: readonly PackSlot[]): PackSlot[] {
  return [...slots].sort((a, b) => SLOT_RARITY_ORDER[a.tier] - SLOT_RARITY_ORDER[b.tier]);
}

/**
 * D-17 (Phase 30): draws `count` cards from `pool` (mutated in place — consumed cards are
 * removed via splice so the SAME shared pool can be drawn from again for the round's other
 * pack without re-dealing a card already used, D-09). Skips any candidate whose position
 * bucket already sits at the D-17 cap of 2, scanning forward through the pre-shuffled pool;
 * only relaxes the cap (takes the next candidate regardless of bucket) if every remaining
 * candidate would exceed its bucket — a low-probability edge case per RESEARCH.md A4, but
 * handled rather than left to throw a false "insufficient supply" error.
 */
function drawFromPool(
  pool: TieredPoolPlayer[],
  count: number,
  bucketCounts: Record<PositionBucket, number>,
): TieredPoolPlayer[] {
  const drawn: TieredPoolPlayer[] = [];
  while (drawn.length < count) {
    if (pool.length === 0) {
      throw new Error('generateDraftPacks: exhausted tier supply while dealing a pack');
    }
    let index = pool.findIndex((candidate) => {
      const bucket = bucketForRole(candidate.role);
      return bucket === null || bucketCounts[bucket] < 2;
    });
    if (index === -1) {
      index = 0;
    }
    const [card] = pool.splice(index, 1);
    drawn.push(card!);
    const bucket = bucketForRole(card!.role);
    if (bucket !== null) bucketCounts[bucket] += 1;
  }
  return drawn;
}

/**
 * D-12 (Phase 30): resolves the GK candidate pool for round 1, backfilling from
 * `fallbackChain` (Pitfall 2 — never special-cased to skip backfill) until `neededCount`
 * is met or the chain is exhausted. Returns whatever was assembled; the caller checks the
 * final length against `neededCount` and throws a per-round "insufficient supply" error.
 *
 * BUG-34 (Phase 36), D-06: also excludes any candidate already dealt into an earlier
 * pack this match (`matchUsedIds`). In practice round 1 is always dealt first, so this
 * set is empty when this function runs — the parameter exists for uniformity/future-
 * proofing (Pitfall 3), not because a real GK-round collision is possible today. This
 * function only READS `matchUsedIds`; it never mutates it (see `generateDraftPacks`).
 */
function resolveGkCandidates(
  selectedUnion: PoolPlayer[],
  fallbackChain: readonly DraftPoolId[],
  neededCount: number,
  matchUsedIds: ReadonlySet<string>,
): PoolPlayer[] {
  const candidates = selectedUnion.filter((p) => p.role === 'GK' && !matchUsedIds.has(p.id));
  const usedIds = new Set(candidates.map((p) => p.id));
  for (const fallbackPoolId of fallbackChain) {
    if (candidates.length >= neededCount) break;
    const fallbackGks = resolvePoolPlayers([fallbackPoolId]).filter(
      (p) => p.role === 'GK' && !usedIds.has(p.id) && !matchUsedIds.has(p.id),
    );
    for (const p of fallbackGks) {
      candidates.push(p);
      usedIds.add(p.id);
    }
  }
  return candidates;
}

/** D-17: total cards of `slot`'s tier needed across BOTH of the round's packs. */
function tierSupplyCount(classified: TieredPoolPlayer[], tier: PackSlot['tier']): number {
  return tier === 'chaseOrRare'
    ? classified.filter((p) => p.tier === 'chase' || p.tier === 'rare').length
    : classified.filter((p) => p.tier === tier).length;
}

/** D-19: whether `classified` has enough of every tier `round.slots` needs, across both packs. */
function tierSupplyMeetsNeed(
  classified: TieredPoolPlayer[],
  round: Extract<RoundConfig, { kind: 'tiered' }>,
): boolean {
  return round.slots.every(
    (slot) => tierSupplyCount(classified, slot.tier) >= slot.count * PACKS_PER_ROUND,
  );
}

/**
 * D-13..D-15 (Phase 30): resolves the non-GK, tier-classified candidate pool for a
 * `'tiered'` round, backfilling from `fallbackChain` (re-classifying after each addition)
 * until every slot's need is met or the chain is exhausted (Pattern 4/Anti-Patterns:
 * needs are per-round-pack-pair, not match-wide totals).
 *
 * BUG-34 (Phase 36), D-06: also excludes any candidate already dealt into an earlier
 * pack this match (`matchUsedIds`), both from the base union and from cross-pool
 * fallback candidates. This function only READS `matchUsedIds`; it never mutates it
 * (see `generateDraftPacks`, which adds ids only after cards are actually dealt).
 */
function resolveTieredCandidates(
  selectedUnion: PoolPlayer[],
  fallbackChain: readonly DraftPoolId[],
  round: Extract<RoundConfig, { kind: 'tiered' }>,
  matchUsedIds: ReadonlySet<string>,
): TieredPoolPlayer[] {
  const baseCandidates = selectedUnion.filter((p) => p.role !== 'GK' && !matchUsedIds.has(p.id));
  const usedIds = new Set(baseCandidates.map((p) => p.id));
  let classified = assignTiers(baseCandidates);

  for (const fallbackPoolId of fallbackChain) {
    if (tierSupplyMeetsNeed(classified, round)) break;
    const fallbackPlayers = resolvePoolPlayers([fallbackPoolId]).filter(
      (p) => p.role !== 'GK' && !usedIds.has(p.id) && !matchUsedIds.has(p.id),
    );
    for (const p of fallbackPlayers) {
      baseCandidates.push(p);
      usedIds.add(p.id);
    }
    classified = assignTiers(baseCandidates);
  }

  return classified;
}

/**
 * D-17 (Phase 30): builds one shuffled draw pool per distinct tier referenced in
 * `round.slots` — 'chaseOrRare' merges the chase+rare candidates into a single shuffled
 * pool (D-25 unbiased mix), never "prefer chase". Shared across both of the round's packs
 * so sequential `drawFromPool` calls never re-deal an already-dealt card (D-09).
 */
function buildTierPoolsForRound(
  round: Extract<RoundConfig, { kind: 'tiered' }>,
  classified: TieredPoolPlayer[],
  rng: RandomIntFn,
): Map<PackSlot['tier'], TieredPoolPlayer[]> {
  const pools = new Map<PackSlot['tier'], TieredPoolPlayer[]>();
  for (const slot of round.slots) {
    if (pools.has(slot.tier)) continue;
    const source =
      slot.tier === 'chaseOrRare'
        ? classified.filter((p) => p.tier === 'chase' || p.tier === 'rare')
        : classified.filter((p) => p.tier === slot.tier);
    pools.set(slot.tier, shuffle(source, rng));
  }
  return pools;
}

/**
 * DRAFT-05 (Phase 30), D-07/D-10..D-18/D-25: Batch-generates the full round-structured
 * pack set a match needs — 6 rounds (`DRAFT_ROUNDS`), `PACKS_PER_ROUND` (2) packs per
 * round, `cardsPerPack` (4) cards per pack, every pack tagged with its `round`.
 *
 * Round 1 (D-12) deals GK-only packs from the selected-pool union, backfilled via
 * `FALLBACK_POOL_ORDER` (D-11 — MLS then Original; International backfills nothing,
 * Pitfall 2 — never special-cased to skip backfill). Rounds 2-6 (D-13..D-15) deal
 * per-round tiered packs (all-common; 2 uncommon+2 common; 1 chaseOrRare+1 uncommon+2
 * common) from the non-GK union, enforcing the D-17 position-bucket cap (DEF<=2, MID<=2,
 * {FWD,ST}<=2 combined) per pack and drawing the chaseOrRare slot from a single merged,
 * shuffled chase+rare pool (D-25 — an even, unbiased mix, never "prefer chase").
 *
 * BUG-34 (Phase 36), D-06/D-07: no card id appears twice across the whole match's 12
 * packs, tracked by a match-wide `matchUsedIds` id set populated only from cards actually
 * dealt into a pack (never from undealt candidates — see Pitfall 5). The within-round
 * no-duplicate guarantee (D-09) still holds as a consequence of this match-wide rule
 * being a strict superset. This supersedes Phase 30's D-18, which previously allowed a
 * card to reappear in a different round since discarded/unpicked cards were never
 * tracked match-wide.
 * Throws a per-round "insufficient supply" error if a round's need cannot be met even
 * after exhausting the fallback chain (loud-fail, matching the CR-01/WR-01 convention —
 * never silently deals a short or duplicated pack).
 *
 * Pure and RNG-agnostic: `rng` is the only randomness source (T-28-04-FAIR fairness
 * boundary) — this module never sources its own randomness (no built-in insecure
 * pseudo-random helper, no Node built-in secure random module import).
 */
export function generateDraftPacks(
  selectedPools: DraftPoolId[],
  rng: RandomIntFn,
): { pool: TieredPoolPlayer[]; packs: DraftPack[] } {
  // CR-01 (Phase 28 review): fail closed on empty/unselectable input instead of
  // silently broadening the fallback draw to the entire real-pool universe. This is
  // defense-in-depth alongside the Phase 29 ROOM_SETTINGS_CONFIRM allow-list check —
  // pack contents are gameplay-affecting (T-28-04-FAIR), so this module (its own
  // "single authoritative entry point") must not have a fail-open gap.
  if (
    selectedPools.length === 0 ||
    !selectedPools.every((p) => SELECTABLE_DRAFT_POOLS.includes(p))
  ) {
    throw new Error(
      `generateDraftPacks: selectedPools must be a non-empty subset of SELECTABLE_DRAFT_POOLS, got ${JSON.stringify(selectedPools)}`,
    );
  }

  const selectedUnion = resolvePoolPlayers(selectedPools);
  const fallbackChain = FALLBACK_POOL_ORDER.filter((p) => !selectedPools.includes(p));

  const packs: DraftPack[] = [];
  const poolMap = new Map<string, TieredPoolPlayer>();
  const addToPool = (players: readonly TieredPoolPlayer[]): void => {
    for (const p of players) {
      if (!poolMap.has(p.id)) poolMap.set(p.id, p);
    }
  };

  let packNumber = 0;

  // BUG-34 (Phase 36), D-06: match-wide "already dealt this match" id set, threaded
  // through both resolvers (read-only there) and populated ONLY from cards actually
  // dealt into a pack, below — supersedes Phase 30's D-18 per-round-only scoping.
  const matchUsedIds = new Set<string>();

  for (const round of DRAFT_ROUNDS) {
    if (round.kind === 'gk') {
      const neededCount = PACKS_PER_ROUND * round.cardsPerPack;
      const gkCandidates = resolveGkCandidates(
        selectedUnion,
        fallbackChain,
        neededCount,
        matchUsedIds,
      );
      if (gkCandidates.length < neededCount) {
        throw new Error(
          `generateDraftPacks: insufficient GK supply for round ${round.round} (need ${neededCount}, have ${gkCandidates.length})`,
        );
      }
      const dealt = shuffle(assignTiers(gkCandidates), rng);
      addToPool(dealt);
      for (let i = 0; i < PACKS_PER_ROUND; i++) {
        packNumber += 1;
        const cards = dealt.slice(i * round.cardsPerPack, (i + 1) * round.cardsPerPack);
        packs.push({ packNumber, round: round.round, cards });
        for (const card of cards) matchUsedIds.add(card.id);
      }
    } else {
      const classified = resolveTieredCandidates(selectedUnion, fallbackChain, round, matchUsedIds);
      if (!tierSupplyMeetsNeed(classified, round)) {
        throw new Error(
          `generateDraftPacks: insufficient tiered supply for round ${round.round} even after backfill`,
        );
      }
      addToPool(classified);
      const tierPools = buildTierPoolsForRound(round, classified, rng);
      const orderedSlots = sortSlotsRarestFirst(round.slots);
      for (let i = 0; i < PACKS_PER_ROUND; i++) {
        const bucketCounts: Record<PositionBucket, number> = { DEF: 0, MID: 0, FWD_ST: 0 };
        const cards: TieredPoolPlayer[] = [];
        for (const slot of orderedSlots) {
          const tierPool = tierPools.get(slot.tier)!;
          cards.push(...drawFromPool(tierPool, slot.count, bucketCounts));
        }
        packNumber += 1;
        packs.push({ packNumber, round: round.round, cards });
        for (const card of cards) matchUsedIds.add(card.id);
      }
    }
  }

  const pool = Array.from(poolMap.values()).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  return { pool, packs };
}
