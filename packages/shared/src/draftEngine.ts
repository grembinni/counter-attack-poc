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
import type { DraftPoolId, DraftTier } from './types.js';
import { TIER_STAT_THRESHOLDS, SELECTABLE_DRAFT_POOLS } from './types.js';

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
 *
 * Temporarily unused by this file's `generateDraftPacks` stub (30-01) — the round-
 * structured dealing algorithm implemented in Plan 30-02 reuses this helper verbatim
 * (RESEARCH.md "Don't Hand-Roll": do not reimplement shuffling/dealing).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reused verbatim by 30-02
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
 * DRAFT-05 (Phase 30): Batch-generates the full round-structured pack set a match needs.
 *
 * TEMPORARY STUB (30-01): keeps the CR-01 fail-closed input guard (unchanged from Phase
 * 28/29 — pack contents are gameplay-affecting, T-28-04-FAIR) so the allow-list check
 * remains defense-in-depth alongside the server's ROOM_SETTINGS_CONFIRM validation, but
 * the round-structured dealing algorithm (DRAFT_ROUNDS-driven, position-bucket-capped,
 * per-round backfill) is NOT yet implemented — it lands in Plan 30-02. This stub exists
 * only to keep the shared package compiling against the new DraftPack.round field and
 * the narrowed DraftTier/TIER_STAT_THRESHOLDS contract while Plan 02 is pending.
 */
export function generateDraftPacks(
  selectedPools: DraftPoolId[],
  _rng: RandomIntFn,
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

  throw new Error('generateDraftPacks: round-structured implementation lands in 30-02');
}
