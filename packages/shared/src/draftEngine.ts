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
 * Pure module: no side effects, no internal RNG (crypto/Math.random), importable
 * identically by client and server — matches the scoreUtils.ts convention.
 */

import type { PoolPlayer } from './teams.js';
import { PLAYER_POOL } from './teams.js';
import { TEAM_CONFIGS } from './teamConfig.js';
import type { TeamId } from './teamConfig.js';
import type { DraftPoolId, DraftTier } from './types.js';
import { TIER_PERCENTILE_BOUNDS } from './types.js';

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
