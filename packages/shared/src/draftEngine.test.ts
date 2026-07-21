/**
 * Phase 28 DRAFT-04: pool derivation + tier classification contract for draftEngine.ts.
 * Follows the teams.test.ts vitest describe/it style, grouped by decision ID.
 */
import { describe, it, expect } from 'vitest';
import { PLAYER_POOL } from './teams.js';
import type { PoolPlayer } from './teams.js';
import { TEAM_CONFIGS } from './teamConfig.js';
import { PACKS_PER_MATCH, PACK_COMPOSITION, TIER_PERCENTILE_BOUNDS } from './types.js';
import {
  computeTotalStat,
  isInPool,
  resolvePoolPlayers,
  assignTiers,
  generateDraftPacks,
} from './draftEngine.js';
import type { RandomIntFn } from './draftEngine.js';

// ---------------------------------------------------------------------------
// Pool derivation — DRAFT-04: D-04
// ---------------------------------------------------------------------------

describe('resolvePoolPlayers / isInPool — DRAFT-04: D-04 pool derivation', () => {
  it("resolvePoolPlayers(['original']) has length 46 and every member is an untagged free agent", () => {
    const original = resolvePoolPlayers(['original']);
    expect(original).toHaveLength(46);
    for (const p of original) {
      expect(p.sourceTeamId).toBe('free-agent');
      expect(p.poolTag).toBeFalsy();
    }
  });

  it("resolvePoolPlayers(['mls']) has length 66 and every member's TEAM_CONFIGS league is 'mls'", () => {
    const mls = resolvePoolPlayers(['mls']);
    expect(mls).toHaveLength(66);
    for (const p of mls) {
      expect(TEAM_CONFIGS[p.sourceTeamId as keyof typeof TEAM_CONFIGS]?.league).toBe('mls');
    }
  });

  it("resolvePoolPlayers(['international']) has length 66", () => {
    const international = resolvePoolPlayers(['international']);
    expect(international).toHaveLength(66);
    for (const p of international) {
      expect(TEAM_CONFIGS[p.sourceTeamId as keyof typeof TEAM_CONFIGS]?.league).toBe(
        'international',
      );
    }
  });

  it("resolvePoolPlayers(['original', 'mls']) has length 112 (46 + 66, no overlap) with strictly ascending ids", () => {
    const union = resolvePoolPlayers(['original', 'mls']);
    expect(union).toHaveLength(112);
    const ids = union.map((p) => p.id);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] > ids[i - 1]).toBe(true);
    }
  });

  it("isInPool: a known city player is in 'mls' and NOT in 'international'", () => {
    const cityPlayer = PLAYER_POOL.find((p) => p.sourceTeamId === 'city');
    expect(cityPlayer).toBeDefined();
    expect(isInPool(cityPlayer, 'mls')).toBe(true);
    expect(isInPool(cityPlayer, 'international')).toBe(false);
  });

  it("isInPool: a known canada player is in 'international'", () => {
    const canadaPlayer = PLAYER_POOL.find((p) => p.sourceTeamId === 'canada');
    expect(canadaPlayer).toBeDefined();
    expect(isInPool(canadaPlayer, 'international')).toBe(true);
  });

  it("isInPool: tagged icon free agent Cristiano Ronaldo is NOT in 'original'", () => {
    const ronaldo = PLAYER_POOL.find(
      (p) => p.firstName === 'Cristiano' && p.lastName === 'Ronaldo',
    );
    expect(ronaldo).toBeDefined();
    expect(ronaldo.poolTag).toBe('icon');
    expect(isInPool(ronaldo, 'original')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Total stat — DRAFT-04: D-07
// ---------------------------------------------------------------------------

describe('computeTotalStat — DRAFT-04: D-07 total stat = sum of 9 numeric fields', () => {
  const basePlayer: PoolPlayer = {
    id: 'synthetic-1',
    sourceTeamId: 'free-agent',
    firstName: 'Test',
    lastName: 'Player',
    number: 99,
    nationality: 'Testland',
    role: 'FWD',
    position: { q: 0, r: 0 },
    pace: 1,
    shooting: 2,
    tackling: 3,
    dribbling: 4,
    saving: 5,
    handling: 6,
    resilience: 7,
    aerialAbility: 8,
    highPass: 9,
  };

  it('returns the exact sum of the 9 stat fields', () => {
    // 1+2+3+4+5+6+7+8+9 = 45
    expect(computeTotalStat(basePlayer)).toBe(45);
  });

  it('jersey number and position do not affect the total', () => {
    const varied: PoolPlayer = { ...basePlayer, number: 1, position: { q: 10, r: 10 } };
    expect(computeTotalStat(varied)).toBe(computeTotalStat(basePlayer));
  });
});

// ---------------------------------------------------------------------------
// Tier classification — DRAFT-04: D-05/D-06/D-08
// ---------------------------------------------------------------------------

describe('assignTiers — DRAFT-04: D-05/D-06/D-08 rank-based percentile classification', () => {
  const unionPool = resolvePoolPlayers(['original', 'mls', 'international']);
  const tiered = assignTiers(unionPool);

  it('preserves input order and length', () => {
    expect(tiered).toHaveLength(unionPool.length);
    expect(tiered.map((p) => p.id)).toEqual(unionPool.map((p) => p.id));
  });

  it('every GK has tier "keeper" and no GK receives an outfield tier', () => {
    for (const p of tiered) {
      if (p.role === 'GK') {
        expect(p.tier).toBe('keeper');
      } else {
        expect(p.tier).not.toBe('keeper');
      }
    }
  });

  it('every non-GK has a tier in [chase, rare, uncommon, common]', () => {
    const outfieldTiers = ['chase', 'rare', 'uncommon', 'common'];
    for (const p of tiered) {
      if (p.role !== 'GK') {
        expect(outfieldTiers).toContain(p.tier);
      }
    }
  });

  it('the single highest-totalStat outfielder is "chase" and the single lowest is "common"', () => {
    const outfield = tiered.filter((p) => p.role !== 'GK');
    const sortedAsc = [...outfield].sort((a, b) => a.totalStat - b.totalStat);
    const lowest = sortedAsc[0];
    const highest = sortedAsc[sortedAsc.length - 1];
    expect(highest.tier).toBe('chase');
    expect(lowest.tier).toBe('common');
  });

  it("each element's totalStat matches computeTotalStat(thatPlayer)", () => {
    for (const p of tiered) {
      expect(p.totalStat).toBe(computeTotalStat(p));
    }
  });

  it('D-06 tie-break: two identical-totalStat outfielders straddling a boundary can receive DIFFERENT tiers', () => {
    // Build a small hand-crafted population: 8 outfield players. Player at index 0 and
    // index 1 have IDENTICAL totalStat (40). With N=8, percentiles are:
    // idx0 -> 100 (chase, >=90), idx1 -> 87.5 (rare, >=80 but <90).
    // This proves classification is rank-based (input-order tie-break), not value-based
    // (which would force identical-stat players into the same tier).
    const makeOutfield = (id: string, totalStat: number): PoolPlayer => ({
      id,
      sourceTeamId: 'free-agent',
      firstName: 'Synthetic',
      lastName: id,
      number: 1,
      nationality: 'Testland',
      role: 'FWD',
      position: { q: 0, r: 0 },
      pace: totalStat,
      shooting: 0,
      tackling: 0,
      dribbling: 0,
      saving: 0,
      handling: 0,
      resilience: 0,
      aerialAbility: 0,
      highPass: 0,
    });

    const tieBreakPool: PoolPlayer[] = [
      makeOutfield('tie-1', 40), // idx 0 after sort -> percentile 100 -> chase
      makeOutfield('tie-2', 40), // idx 1 after sort -> percentile 87.5 -> rare
      makeOutfield('rank-3', 30),
      makeOutfield('rank-4', 25),
      makeOutfield('rank-5', 20),
      makeOutfield('rank-6', 15),
      makeOutfield('rank-7', 10),
      makeOutfield('rank-8', 5),
    ];

    const result = assignTiers(tieBreakPool);
    const tie1 = result.find((p) => p.id === 'tie-1');
    const tie2 = result.find((p) => p.id === 'tie-2');

    expect(tie1.totalStat).toBe(tie2.totalStat);
    expect(tie1.tier).not.toBe(tie2.tier);
    expect(tie1.tier).toBe('chase');
    expect(tie2.tier).toBe('rare');
  });
});

// Sanity check: TIER_PERCENTILE_BOUNDS is imported and used implicitly by assignTiers;
// referenced here to keep the import used and to document the boundary values relied on
// by the tie-break math above (chase >= 90, rare >= 80, uncommon >= 60).
describe('TIER_PERCENTILE_BOUNDS — DRAFT-04: boundary constants used by classification', () => {
  it('matches the documented chase/rare/uncommon floors', () => {
    expect(TIER_PERCENTILE_BOUNDS).toEqual({ chase: 90, rare: 80, uncommon: 60 });
  });
});

// ---------------------------------------------------------------------------
// generateDraftPacks — DRAFT-05: D-09/D-10/D-11/D-12 pack composition, no-duplication,
// backfill order, and determinism.
// ---------------------------------------------------------------------------

/**
 * Tiny deterministic seeded PRNG (mulberry32) mapped to the `RandomIntFn` contract
 * (min-inclusive, max-exclusive) — mirrors Node `crypto.randomInt(min, max)`. This is
 * test-only code, so `Math` is permitted here; the SHARED engine itself stays
 * `Math.random`-free (no global RNG is imported into draftEngine.ts).
 */
function createSeededRng(seed: number): RandomIntFn {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (minInclusive: number, maxExclusive: number) =>
    minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
}

const leagueOf = (sourceTeamId: string): string | undefined =>
  TEAM_CONFIGS[sourceTeamId as keyof typeof TEAM_CONFIGS]?.league;

describe('generateDraftPacks — DRAFT-05: D-10/D-11 pack count and composition', () => {
  it('all-pools: exactly PACKS_PER_MATCH packs of 7 cards, composed per PACK_COMPOSITION, keeper slots are always GK', () => {
    const rng = createSeededRng(1);
    const { packs } = generateDraftPacks(['original', 'mls', 'international'], rng);

    expect(packs).toHaveLength(PACKS_PER_MATCH);

    for (const pack of packs) {
      expect(pack.cards).toHaveLength(7);

      const counts: Record<string, number> = {};
      for (const card of pack.cards) {
        counts[card.tier] = (counts[card.tier] ?? 0) + 1;
        if (card.tier === 'keeper') {
          expect(card.role).toBe('GK');
        } else {
          expect(card.role).not.toBe('GK');
        }
      }
      expect(counts).toEqual(PACK_COMPOSITION);
    }
  });
});

describe('generateDraftPacks — DRAFT-05: D-09 no cross-pack duplication', () => {
  it('all-pools: no player id appears in more than one pack across the batch', () => {
    const rng = createSeededRng(2);
    const { packs } = generateDraftPacks(['original', 'mls', 'international'], rng);

    const allIds = packs.flatMap((pack) => pack.cards.map((c) => c.id));
    expect(allIds).toHaveLength(PACKS_PER_MATCH * 7);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe('generateDraftPacks — DRAFT-05: D-12 pool-shortage backfill order', () => {
  it('original-only: backfills from MLS, includes non-free-agent keepers, and pulls ZERO international cards', () => {
    const rng = createSeededRng(3);
    const { packs } = generateDraftPacks(['original'], rng);

    expect(packs).toHaveLength(PACKS_PER_MATCH);
    const allCards = packs.flatMap((pack) => pack.cards);
    expect(allCards).toHaveLength(PACKS_PER_MATCH * 7);

    const internationalCards = allCards.filter((c) => leagueOf(c.sourceTeamId) === 'international');
    expect(internationalCards).toHaveLength(0);

    const mlsCards = allCards.filter((c) => leagueOf(c.sourceTeamId) === 'mls');
    expect(mlsCards.length).toBeGreaterThan(0);

    const keeperCards = allCards.filter((c) => c.tier === 'keeper');
    expect(keeperCards).toHaveLength(PACKS_PER_MATCH * PACK_COMPOSITION.keeper);
    const nonFreeAgentKeepers = keeperCards.filter((c) => c.sourceTeamId !== 'free-agent');
    expect(nonFreeAgentKeepers.length).toBeGreaterThan(0);
  });

  it('mls-only: backfills from Original first (fallback order); International untouched', () => {
    const rng = createSeededRng(4);
    const { packs } = generateDraftPacks(['mls'], rng);

    expect(packs).toHaveLength(PACKS_PER_MATCH);
    const allCards = packs.flatMap((pack) => pack.cards);

    const internationalCards = allCards.filter((c) => leagueOf(c.sourceTeamId) === 'international');
    expect(internationalCards).toHaveLength(0);

    const originalCards = allCards.filter((c) => c.sourceTeamId === 'free-agent' && !c.poolTag);
    expect(originalCards.length).toBeGreaterThan(0);
  });
});

describe('generateDraftPacks — DRAFT-05: determinism given the same injected RNG', () => {
  it('two runs with identically-seeded rng produce deep-equal packs', () => {
    const rngA = createSeededRng(42);
    const rngB = createSeededRng(42);

    const resultA = generateDraftPacks(['original', 'mls', 'international'], rngA);
    const resultB = generateDraftPacks(['original', 'mls', 'international'], rngB);

    expect(resultA.packs).toEqual(resultB.packs);
  });
});
