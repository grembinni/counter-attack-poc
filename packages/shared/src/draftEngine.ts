/**
 * Draft data-model engine — pool derivation and tier classification.
 *
 * DRAFT-04: Classify the player pool into rarity tiers by total stat count.
 * D-04: Pool derivation ('original' = free-agent, untagged; 'mls'/'international' via
 *       TEAM_CONFIGS[sourceTeamId].league).
 * D-05: Tier percentiles are recomputed dynamically per draft session, based on the
 *       percentile rank of total stat within the resolved pool population.
 * D-06: Ties at a percentile boundary use rank-based percentile (stable sort / input
 *       order tie-break) — not value-based percentile.
 * D-07: Total stat = sum of all 9 PoolPlayer numeric stat fields.
 * D-08: 'keeper' tier is simply role === 'GK' — GKs are excluded from the outfield
 *       Chase/Rare/Uncommon/Common percentile population entirely.
 * D-13: This module emits ONLY the tier enum value — no color/label display constants
 *       (those are deferred to Phase 29).
 *
 * Pure module: no side effects, no internal RNG source, importable identically by
 * client and server — matches the scoreUtils.ts convention.
 */

import type { PoolPlayer } from './teams.js';
import { PLAYER_POOL } from './teams.js';
import { TEAM_CONFIGS } from './teamConfig.js';
import type { TeamId } from './teamConfig.js';
import type { DraftPoolId, DraftTier } from './types.js';
import {
  PACKS_PER_MATCH,
  PACK_COMPOSITION,
  TIER_PERCENTILE_BOUNDS,
  SELECTABLE_DRAFT_POOLS,
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
 * D-04: Determines whether `player` belongs to the given draft pool.
 * - 'original': free-agent sourceTeamId AND no poolTag (reserved Legends/Icons excluded).
 * - 'mls' / 'international': TEAM_CONFIGS[sourceTeamId].league matches poolId.
 * - 'legends' / 'icons': not selectable in v1 (DRAFT-11, deferred) — always false.
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
  // 'legends' / 'icons' — deferred (DRAFT-11), never selectable in v1.
  return false;
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
 * D-05/D-06/D-07/D-08: Classifies `players` into rarity tiers.
 *
 * - GKs (role === 'GK') are excluded from the outfield population and assigned the
 *   'keeper' tier directly (D-08) — no stat-based subdivision.
 * - Outfield players are ranked by totalStat descending using a stable sort, so
 *   equal-stat players retain their input-array (id) order — this is the D-06
 *   tie-break (rank/id order, NOT value-based).
 * - Each outfield player's percentile rank = ((N - index) / N) * 100, where index is
 *   its zero-based position in the descending-sorted array and N is the outfield
 *   count. Tier is assigned by comparing against TIER_PERCENTILE_BOUNDS.
 * - Output preserves the input array's order and length; does not mutate the input
 *   array or PLAYER_POOL.
 */
export function assignTiers(players: PoolPlayer[]): TieredPoolPlayer[] {
  const outfield = players.filter((p) => p.role !== 'GK');

  // Stable sort (Array.prototype.sort is stable in modern JS engines) — descending by
  // totalStat, ties retain input-array order (D-06 rank/id-order tie-break).
  const rankedOutfield = [...outfield].sort((a, b) => computeTotalStat(b) - computeTotalStat(a));

  const tierById = new Map<string, DraftTier>();

  const n = rankedOutfield.length;
  if (n > 0) {
    rankedOutfield.forEach((player, index) => {
      const percentileRank = ((n - index) / n) * 100;
      let tier: DraftTier;
      if (percentileRank >= TIER_PERCENTILE_BOUNDS.chase) {
        tier = 'chase';
      } else if (percentileRank >= TIER_PERCENTILE_BOUNDS.rare) {
        tier = 'rare';
      } else if (percentileRank >= TIER_PERCENTILE_BOUNDS.uncommon) {
        tier = 'uncommon';
      } else {
        tier = 'common';
      }
      tierById.set(player.id, tier);
    });
  }

  for (const player of players) {
    if (player.role === 'GK') {
      tierById.set(player.id, 'keeper');
    }
  }

  return players.map((player) => ({
    ...player,
    tier: tierById.get(player.id)!,
    totalStat: computeTotalStat(player),
  }));
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
 * DRAFT-05 (Phase 28), D-09: One dealt pack of 7 cards. `packNumber` is 1-based
 * (1..PACKS_PER_MATCH) so callers/UI can label packs without re-deriving an index.
 */
export interface DraftPack {
  packNumber: number;
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
 * D-12: Fallback pool draw order when the selected pool(s) fall short of a tier need —
 * Original -> MLS -> International. The active fallback list for a given selection is
 * this order minus any pool(s) already in `selectedPools`.
 */
const FALLBACK_POOL_ORDER: readonly DraftPoolId[] = ['original', 'mls', 'international'];

/** Outfield tiers (everything except 'keeper') — used to iterate per-tier need/counts. */
const OUTFIELD_TIERS: readonly Exclude<DraftTier, 'keeper'>[] = [
  'chase',
  'rare',
  'uncommon',
  'common',
];

/**
 * DRAFT-05: Batch-generates the full set of `PACKS_PER_MATCH` packs a match needs from
 * the selected pool(s), each composed per `PACK_COMPOSITION` (D-11), with pool-shortage
 * backfill (D-12) and no cross-pack duplication (D-09) for the default constants with
 * all three pools available.
 *
 * Implementation stages:
 * 1. Resolve the selected-pool union via `resolvePoolPlayers`.
 * 2. Compute the active fallback order (D-12): Original -> MLS -> International, minus
 *    whichever pool(s) are already selected.
 * 3. Compute per-tier need counts from `PACKS_PER_MATCH * PACK_COMPOSITION[tier]`.
 * 4. Backfill loop: reclassify the growing union via `assignTiers` each iteration (so
 *    D-05's "recompute percentiles on the union of selected pools PLUS backfill
 *    players" holds); while any tier (keeper or outfield) remains short, draw ONE
 *    not-yet-included player of the needed kind from the first fallback pool that can
 *    supply it, walking the fallback order. Terminates when every need is met or the
 *    fallback list is exhausted for the still-short kinds.
 * 5. Final classify: `assignTiers` on the completed union is the authoritative tiered
 *    pool returned to the caller.
 * 6. Deal: partition the pool by tier, shuffle each tier's array with the injected
 *    `rng`, then deal each pack's composition by advancing a per-tier cursor (no
 *    reuse). A cursor wraps modulo its tier's array length only if backfill could not
 *    reach a tier's need because every fallback pool was exhausted — a dormant D-09
 *    exception that never triggers for the default constants with all three pools
 *    selected (16 keepers >= 8; every outfield tier's population >= its need).
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

  const selected = resolvePoolPlayers(selectedPools);

  // (2) FALLBACK ORDER
  const fallbackPools = FALLBACK_POOL_ORDER.filter((p) => !selectedPools.includes(p));

  // (3) NEED COUNTS
  const keeperNeed = PACKS_PER_MATCH * PACK_COMPOSITION.keeper;
  const need: Record<Exclude<DraftTier, 'keeper'>, number> = {
    chase: PACKS_PER_MATCH * PACK_COMPOSITION.chase,
    rare: PACKS_PER_MATCH * PACK_COMPOSITION.rare,
    uncommon: PACKS_PER_MATCH * PACK_COMPOSITION.uncommon,
    common: PACKS_PER_MATCH * PACK_COMPOSITION.common,
  };

  // (4) BACKFILL
  const includedIds = new Set<string>(selected.map((p) => p.id));
  let union: PoolPlayer[] = [...selected];

  for (;;) {
    const classified = assignTiers(union);
    const keeperCount = classified.filter((p) => p.tier === 'keeper').length;
    const outfieldCounts: Record<Exclude<DraftTier, 'keeper'>, number> = {
      chase: 0,
      rare: 0,
      uncommon: 0,
      common: 0,
    };
    for (const p of classified) {
      if (p.tier !== 'keeper') {
        outfieldCounts[p.tier]++;
      }
    }

    const keeperShort = keeperCount < keeperNeed;
    const outfieldShort = OUTFIELD_TIERS.some((t) => outfieldCounts[t] < need[t]);

    if (!keeperShort && !outfieldShort) break; // every need met

    let drew = false;
    for (const fallbackPoolId of fallbackPools) {
      const poolMembers = PLAYER_POOL.filter(
        (p) => isInPool(p, fallbackPoolId) && !includedIds.has(p.id),
      );
      if (poolMembers.length === 0) continue;

      // Needed KIND for this pool: prefer GK when only keeper is short; prefer
      // outfield when only outfield is short; when both are short, prefer whichever
      // this pool can supply, GK first.
      let candidates: PoolPlayer[] = [];
      if (keeperShort) {
        candidates = poolMembers.filter((p) => p.role === 'GK');
      }
      if (candidates.length === 0 && outfieldShort) {
        candidates = poolMembers.filter((p) => p.role !== 'GK');
      }
      if (candidates.length === 0) continue; // pool lacks the needed kind — try next

      const picked = shuffle(candidates, rng)[0]!;
      union = [...union, picked];
      includedIds.add(picked.id);
      drew = true;
      break; // re-classify the union from the top after each draw
    }

    if (!drew) {
      // Fallback list exhausted for the still-short kind(s) — stop backfilling; stage
      // 6 dealing's wrap-around cursor is the dormant D-09 last resort for this case.
      break;
    }
  }

  // (5) FINAL CLASSIFY
  const pool = assignTiers(union);

  // WR-01 (Phase 28 review): assert every tier's post-backfill population meets its
  // need. Today this is provably dormant for the default constants + full three-pool
  // universe (confirmed by stress-execution across every reachable pool combination),
  // but nothing upstream enforces it — if PACKS_PER_MATCH/PACK_COMPOSITION are ever
  // tuned past what the fixed player pool can support, fail loudly here instead of
  // silently producing short packs (dealing loop's `tierArray.length === 0` skip) or
  // cross-pack duplicate cards (dealing loop's cursor wraparound), both of which
  // violate the D-09 contract.
  const finalKeeperCount = pool.filter((p) => p.tier === 'keeper').length;
  if (finalKeeperCount < keeperNeed) {
    throw new Error(
      `generateDraftPacks: insufficient 'keeper' supply (${finalKeeperCount}/${keeperNeed}) after backfill`,
    );
  }
  const finalOutfieldCounts: Record<Exclude<DraftTier, 'keeper'>, number> = {
    chase: 0,
    rare: 0,
    uncommon: 0,
    common: 0,
  };
  for (const p of pool) {
    if (p.tier !== 'keeper') {
      finalOutfieldCounts[p.tier]++;
    }
  }
  for (const tier of OUTFIELD_TIERS) {
    if (finalOutfieldCounts[tier] < need[tier]) {
      throw new Error(
        `generateDraftPacks: insufficient '${tier}' supply (${finalOutfieldCounts[tier]}/${need[tier]}) after backfill`,
      );
    }
  }

  // (6) DEAL
  const tierDealOrder: DraftTier[] = ['chase', 'rare', 'uncommon', 'common', 'keeper'];
  const byTier: Record<DraftTier, TieredPoolPlayer[]> = {
    chase: shuffle(
      pool.filter((p) => p.tier === 'chase'),
      rng,
    ),
    rare: shuffle(
      pool.filter((p) => p.tier === 'rare'),
      rng,
    ),
    uncommon: shuffle(
      pool.filter((p) => p.tier === 'uncommon'),
      rng,
    ),
    common: shuffle(
      pool.filter((p) => p.tier === 'common'),
      rng,
    ),
    keeper: shuffle(
      pool.filter((p) => p.tier === 'keeper'),
      rng,
    ),
  };
  const cursors: Record<DraftTier, number> = {
    chase: 0,
    rare: 0,
    uncommon: 0,
    common: 0,
    keeper: 0,
  };

  const packs: DraftPack[] = [];
  for (let i = 0; i < PACKS_PER_MATCH; i++) {
    const cards: TieredPoolPlayer[] = [];
    for (const tier of tierDealOrder) {
      const tierArray = byTier[tier];
      const count = PACK_COMPOSITION[tier];
      for (let c = 0; c < count; c++) {
        if (tierArray.length === 0) continue; // unfillable tier — no cards exist at all
        const idx = cursors[tier] % tierArray.length;
        cards.push(tierArray[idx]!);
        cursors[tier]++;
      }
    }
    packs.push({ packNumber: i + 1, cards });
  }

  return { pool, packs };
}
