/**
 * Phase 28 DRAFT-04, Phase 30 D-03/D-04/D-05/D-09: pool derivation + fixed-threshold tier
 * classification contract for draftEngine.ts. Follows the teams.test.ts vitest
 * describe/it style, grouped by decision ID.
 *
 * Phase 30 Plan 02: round-scoped generateDraftPacks tests live in the final describe
 * block below (DRAFT-05, D-09..D-18/D-25).
 */
import { randomInt } from 'crypto';
import { describe, it, expect } from 'vitest';
import { PLAYER_POOL } from './teams.js';
import type { PoolPlayer } from './teams.js';
import { TEAM_CONFIGS } from './teamConfig.js';
import {
  SELECTABLE_DRAFT_POOLS,
  DRAFT_ROUNDS,
  DRAFT_ROUND_COUNT,
  PACKS_PER_ROUND,
} from './types.js';
import type { DraftTier, DraftPoolId } from './types.js';
import {
  computeTotalStat,
  classifyTier,
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
  it("resolvePoolPlayers(['original']) has length 38 and every member is an untagged free agent", () => {
    const original = resolvePoolPlayers(['original']);
    expect(original).toHaveLength(38);
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

  it("resolvePoolPlayers(['original', 'mls']) has length 104 (38 + 66, no overlap) with strictly ascending ids", () => {
    const union = resolvePoolPlayers(['original', 'mls']);
    expect(union).toHaveLength(104);
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
// Legends/Icons PoolTag -> DraftPoolId bridge — DRAFT-11: D-09 (Phase 30)
// ---------------------------------------------------------------------------

describe('isInPool — DRAFT-11: D-09 legends/icons PoolTag bridge', () => {
  it("a 'legend'-tagged player is in the 'legends' pool and NOT in 'icons'", () => {
    const legend = PLAYER_POOL.find((p) => p.poolTag === 'legend');
    expect(legend).toBeDefined();
    expect(isInPool(legend, 'legends')).toBe(true);
    expect(isInPool(legend, 'icons')).toBe(false);
  });

  it("an 'icon'-tagged player is in the 'icons' pool and NOT in 'legends'", () => {
    const icon = PLAYER_POOL.find((p) => p.poolTag === 'icon');
    expect(icon).toBeDefined();
    expect(isInPool(icon, 'icons')).toBe(true);
    expect(isInPool(icon, 'legends')).toBe(false);
  });

  it("an untagged free agent is in NEITHER 'legends' nor 'icons'", () => {
    const untagged = PLAYER_POOL.find((p) => p.sourceTeamId === 'free-agent' && !p.poolTag);
    expect(untagged).toBeDefined();
    expect(isInPool(untagged, 'legends')).toBe(false);
    expect(isInPool(untagged, 'icons')).toBe(false);
  });

  it("resolvePoolPlayers(['legends']) returns only legend-tagged players", () => {
    const legends = resolvePoolPlayers(['legends']);
    expect(legends.length).toBeGreaterThan(0);
    for (const p of legends) {
      expect(p.poolTag).toBe('legend');
    }
  });

  it("resolvePoolPlayers(['icons']) returns only icon-tagged players", () => {
    const icons = resolvePoolPlayers(['icons']);
    expect(icons.length).toBeGreaterThan(0);
    for (const p of icons) {
      expect(p.poolTag).toBe('icon');
    }
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
// classifyTier — DRAFT-04: D-03/D-04 fixed absolute total-stat thresholds
// (replaces the old session-relative percentile ranking entirely)
// ---------------------------------------------------------------------------

describe('classifyTier — DRAFT-04: D-03/D-04 fixed absolute total-stat thresholds', () => {
  it('totalStat >= 32 classifies as "chase"', () => {
    expect(classifyTier(32)).toBe('chase');
    expect(classifyTier(33)).toBe('chase');
    expect(classifyTier(45)).toBe('chase');
  });

  it('totalStat === 31 classifies as "rare" (exact boundary)', () => {
    expect(classifyTier(31)).toBe('rare');
  });

  it('totalStat 29-30 classifies as "uncommon"', () => {
    expect(classifyTier(30)).toBe('uncommon');
    expect(classifyTier(29)).toBe('uncommon');
  });

  it('totalStat < 29 classifies as "common"', () => {
    expect(classifyTier(28)).toBe('common');
    expect(classifyTier(0)).toBe('common');
  });
});

// ---------------------------------------------------------------------------
// assignTiers — DRAFT-04: D-04/D-05 per-player classification, no population ranking
// ---------------------------------------------------------------------------

describe('assignTiers — DRAFT-04: D-04/D-05 per-player classification, no population ranking', () => {
  const unionPool = resolvePoolPlayers(['original', 'mls', 'international']);
  const tiered = assignTiers(unionPool);

  it('preserves input order and length', () => {
    expect(tiered).toHaveLength(unionPool.length);
    expect(tiered.map((p) => p.id)).toEqual(unionPool.map((p) => p.id));
  });

  it("each element's tier equals classifyTier(computeTotalStat(player)) — GK and outfield alike (D-04)", () => {
    for (const p of tiered) {
      expect(p.tier).toBe(classifyTier(computeTotalStat(p)));
    }
  });

  it("each element's totalStat matches computeTotalStat(thatPlayer)", () => {
    for (const p of tiered) {
      expect(p.totalStat).toBe(computeTotalStat(p));
    }
  });

  it('every tier value is one of the 4 DraftTier values — "keeper" is never produced (D-05)', () => {
    const validTiers = ['chase', 'rare', 'uncommon', 'common'];
    for (const p of tiered) {
      expect(validTiers).toContain(p.tier);
    }
  });

  it(
    'D-24: at least one GK legitimately classifies as "common" under the identical thresholds ' +
      '— an explicitly accepted, cosmetic-only distribution outcome (GK tier does not affect ' +
      'pack dealing per D-07), NOT a bug to "fix" by forbidding it',
    () => {
      const gkTiers = tiered.filter((p) => p.role === 'GK').map((p) => p.tier);
      expect(gkTiers.length).toBeGreaterThan(0);
      expect(gkTiers).toContain('common');
    },
  );

  it('identical-totalStat players receive the SAME tier — classification is value-based, not rank-based (D-03 supersedes the old D-06 rank tie-break)', () => {
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

    const pool: PoolPlayer[] = [makeOutfield('tie-1', 31), makeOutfield('tie-2', 31)];
    const result = assignTiers(pool);
    const tie1 = result.find((p) => p.id === 'tie-1');
    const tie2 = result.find((p) => p.id === 'tie-2');

    expect(tie1?.totalStat).toBe(tie2?.totalStat);
    expect(tie1?.tier).toBe(tie2?.tier);
    expect(tie1?.tier).toBe('rare');
  });
});

// ---------------------------------------------------------------------------
// generateDraftPacks — DRAFT-05 (Phase 30): 6-round structure (D-09..D-18/D-25)
// ---------------------------------------------------------------------------

/**
 * Deterministic, seeded pseudo-random RandomIntFn for structural assertions — NOT
 * cryptographically secure, used only so this suite's structural tests are repeatable.
 * Distribution-sensitive assertions (chase-or-rare even mix) use real `crypto.randomInt`
 * instead, per the plan's guidance to mirror the existing draftPacks.test real-RNG
 * structural-check pattern.
 */
function makeSeededRng(seed: number): RandomIntFn {
  let state = seed >>> 0;
  return (minInclusive: number, maxExclusive: number) => {
    // xorshift32 — cheap, deterministic, good-enough distribution for shuffling tests.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const range = maxExclusive - minInclusive;
    return minInclusive + (state % range);
  };
}

describe('generateDraftPacks — 6-round structure', () => {
  const ALL_POOLS = [...SELECTABLE_DRAFT_POOLS];

  it(`returns ${DRAFT_ROUND_COUNT * PACKS_PER_ROUND} packs total, ${PACKS_PER_ROUND} per round, each with 4 cards and a round tag in 1..${DRAFT_ROUND_COUNT}`, () => {
    const rng = makeSeededRng(1);
    const { packs } = generateDraftPacks(ALL_POOLS, rng);
    expect(packs).toHaveLength(DRAFT_ROUND_COUNT * PACKS_PER_ROUND);

    const countsByRound = new Map<number, number>();
    for (const pack of packs) {
      expect(pack.cards).toHaveLength(4);
      expect(pack.round).toBeGreaterThanOrEqual(1);
      expect(pack.round).toBeLessThanOrEqual(DRAFT_ROUND_COUNT);
      countsByRound.set(pack.round, (countsByRound.get(pack.round) ?? 0) + 1);
    }
    for (const round of DRAFT_ROUNDS) {
      expect(countsByRound.get(round.round)).toBe(PACKS_PER_ROUND);
    }
  });

  it('round-1 packs are GK-only; rounds 2-6 packs contain zero GK cards', () => {
    const rng = makeSeededRng(2);
    const { packs } = generateDraftPacks(ALL_POOLS, rng);
    for (const pack of packs) {
      if (pack.round === 1) {
        for (const card of pack.cards) expect(card.role).toBe('GK');
      } else {
        for (const card of pack.cards) expect(card.role).not.toBe('GK');
      }
    }
  });

  it('round 4 packs are 2 uncommon + 2 common by classifyTier (D-14)', () => {
    const rng = makeSeededRng(3);
    const { packs } = generateDraftPacks(ALL_POOLS, rng);
    const round4Packs = packs.filter((p) => p.round === 4);
    expect(round4Packs).toHaveLength(PACKS_PER_ROUND);

    for (const pack of round4Packs) {
      const tierCounts: Record<DraftTier, number> = { chase: 0, rare: 0, uncommon: 0, common: 0 };
      for (const card of pack.cards) {
        expect(classifyTier(card.totalStat)).toBe(card.tier);
        tierCounts[card.tier] += 1;
      }
      expect(tierCounts.uncommon).toBe(2);
      expect(tierCounts.common).toBe(2);
      expect(tierCounts.chase).toBe(0);
      expect(tierCounts.rare).toBe(0);
    }
  });

  it('round 2-3 packs are all-common by classifyTier (D-13)', () => {
    const rng = makeSeededRng(4);
    const { packs } = generateDraftPacks(ALL_POOLS, rng);
    const rounds23 = packs.filter((p) => p.round === 2 || p.round === 3);
    expect(rounds23).toHaveLength(PACKS_PER_ROUND * 2);

    for (const pack of rounds23) {
      for (const card of pack.cards) {
        expect(classifyTier(card.totalStat)).toBe(card.tier);
        expect(card.tier).toBe('common');
      }
    }
  });

  it('round 5-6 packs are 1 chaseOrRare + 1 uncommon + 2 common by classifyTier (D-15)', () => {
    const rng = makeSeededRng(5);
    const { packs } = generateDraftPacks(ALL_POOLS, rng);
    const rounds56 = packs.filter((p) => p.round === 5 || p.round === 6);
    expect(rounds56).toHaveLength(PACKS_PER_ROUND * 2);

    for (const pack of rounds56) {
      const tierCounts: Record<DraftTier, number> = { chase: 0, rare: 0, uncommon: 0, common: 0 };
      for (const card of pack.cards) {
        expect(classifyTier(card.totalStat)).toBe(card.tier);
        tierCounts[card.tier] += 1;
      }
      expect(tierCounts.chase + tierCounts.rare).toBe(1);
      expect(tierCounts.uncommon).toBe(1);
      expect(tierCounts.common).toBe(2);
    }
  });

  it('position-bucket cap holds per non-GK pack: DEF<=2, MID<=2, {FWD,ST} combined <=2 (D-17)', () => {
    const rng = makeSeededRng(6);
    const { packs } = generateDraftPacks(ALL_POOLS, rng);
    for (const pack of packs) {
      if (pack.round === 1) continue; // GK-only round, no position bucket concept applies
      let def = 0;
      let mid = 0;
      let fwdSt = 0;
      for (const card of pack.cards) {
        if (card.role === 'DEF') def += 1;
        else if (card.role === 'MID') mid += 1;
        else if (card.role === 'FWD' || card.role === 'ST') fwdSt += 1;
      }
      expect(def).toBeLessThanOrEqual(2);
      expect(mid).toBeLessThanOrEqual(2);
      expect(fwdSt).toBeLessThanOrEqual(2);
    }
  });

  it('no card id appears in more than one pack of the same round (D-09, re-scoped per round)', () => {
    const rng = makeSeededRng(7);
    const { packs } = generateDraftPacks(ALL_POOLS, rng);
    for (const round of DRAFT_ROUNDS) {
      const roundPacks = packs.filter((p) => p.round === round.round);
      expect(roundPacks).toHaveLength(PACKS_PER_ROUND);
      const idSets = roundPacks.map((pack) => new Set(pack.cards.map((c) => c.id)));
      for (let i = 0; i < idSets.length; i++) {
        for (let j = i + 1; j < idSets.length; j++) {
          const overlap = [...idSets[i]].filter((id) => idSets[j].has(id));
          expect(overlap).toHaveLength(0);
        }
      }
    }
  });

  it('every card dealt into any pack exists in the returned classified pool', () => {
    const rng = makeSeededRng(8);
    const { pool, packs } = generateDraftPacks(ALL_POOLS, rng);
    const poolIds = new Set(pool.map((p) => p.id));
    for (const pack of packs) {
      for (const card of pack.cards) {
        expect(poolIds.has(card.id)).toBe(true);
      }
    }
  });

  it("generateDraftPacks(['legends'], rng) does not throw and still fills round-1 GK packs via MLS/Original backfill (D-10/D-11)", () => {
    const rng = makeSeededRng(9);
    let result: ReturnType<typeof generateDraftPacks> | undefined;
    expect(() => {
      result = generateDraftPacks(['legends'], rng);
    }).not.toThrow();

    const { packs } = result;
    expect(packs).toHaveLength(DRAFT_ROUND_COUNT * PACKS_PER_ROUND);
    const round1 = packs.filter((p) => p.round === 1);
    expect(round1).toHaveLength(PACKS_PER_ROUND);
    for (const pack of round1) {
      expect(pack.cards).toHaveLength(4);
      for (const card of pack.cards) expect(card.role).toBe('GK');
    }
  });

  it("generateDraftPacks(['icons'], rng) does not throw and still fills round-1 GK packs via MLS/Original backfill (D-10/D-11)", () => {
    const rng = makeSeededRng(10);
    let result: ReturnType<typeof generateDraftPacks> | undefined;
    expect(() => {
      result = generateDraftPacks(['icons'], rng);
    }).not.toThrow();

    const { packs } = result;
    expect(packs).toHaveLength(DRAFT_ROUND_COUNT * PACKS_PER_ROUND);
    const round1 = packs.filter((p) => p.round === 1);
    expect(round1).toHaveLength(PACKS_PER_ROUND);
    for (const pack of round1) {
      expect(pack.cards).toHaveLength(4);
      for (const card of pack.cards) expect(card.role).toBe('GK');
    }
  });

  it('every single-pool selection in SELECTABLE_DRAFT_POOLS backfills successfully without throwing', () => {
    const rng = makeSeededRng(11);
    for (const poolId of ALL_POOLS) {
      expect(() => generateDraftPacks([poolId], rng)).not.toThrow();
    }
  });

  it('generateDraftPacks: selectedPools must be a non-empty subset of SELECTABLE_DRAFT_POOLS (CR-01 fail-closed guard)', () => {
    const rng = makeSeededRng(12);
    expect(() => generateDraftPacks([], rng)).toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately invalid pool id to exercise the fail-closed guard
    expect(() => generateDraftPacks(['not-a-real-pool' as any], rng)).toThrow();
  });

  it(
    'chase-or-rare slot draws an unbiased mix of both chase and rare over many real-RNG runs (D-25) — ' +
      'not "prefer chase, fall back to rare"',
    () => {
      let chaseCount = 0;
      let rareCount = 0;
      const ITERATIONS = 25;
      for (let i = 0; i < ITERATIONS; i++) {
        const { packs } = generateDraftPacks(ALL_POOLS, randomInt);
        const rounds56 = packs.filter((p) => p.round === 5 || p.round === 6);
        for (const pack of rounds56) {
          for (const card of pack.cards) {
            if (card.tier === 'chase') chaseCount += 1;
            if (card.tier === 'rare') rareCount += 1;
          }
        }
      }
      // 4 chaseOrRare draws per run (2 packs x 2 rounds) x ITERATIONS runs.
      expect(chaseCount + rareCount).toBe(4 * ITERATIONS);
      expect(chaseCount).toBeGreaterThan(0);
      expect(rareCount).toBeGreaterThan(0);
    },
  );
});

// ---------------------------------------------------------------------------
// generateDraftPacks — BUG-34 (Phase 36): match-wide uniqueness (D-06/D-07)
// Supersedes Phase 30's D-18 ("a card CAN reappear in a different round") — a player
// may now appear in at most ONE pack across all 6 rounds / 12 packs of a match.
// ---------------------------------------------------------------------------

describe('generateDraftPacks — BUG-34 (Phase 36): match-wide uniqueness (D-06/D-07)', () => {
  const SINGLE_POOL_SELECTIONS: DraftPoolId[][] = [['original'], ['mls'], ['international']];
  const ALL_POOLS_SELECTION = [...SELECTABLE_DRAFT_POOLS];

  const flattenIds = (packs: ReturnType<typeof generateDraftPacks>['packs']): string[] =>
    packs.flatMap((pack) => pack.cards.map((c) => c.id));

  it.each([1, 2, 3, 4, 5])(
    'seed %i: 48 distinct player ids across all 12 packs for every selectable pool combination',
    (seed) => {
      const rng = makeSeededRng(seed);
      for (const selection of [...SINGLE_POOL_SELECTIONS, ALL_POOLS_SELECTION]) {
        const { packs } = generateDraftPacks(selection, rng);
        const ids = flattenIds(packs);
        expect(ids).toHaveLength(48);
        expect(new Set(ids).size).toBe(48);
      }
    },
  );

  it('round-1 GK card ids are disjoint from every rounds-2-to-6 card id (D-10 sanity)', () => {
    const rng = makeSeededRng(6);
    const { packs } = generateDraftPacks(ALL_POOLS_SELECTION, rng);
    const round1Ids = new Set(flattenIds(packs.filter((p) => p.round === 1)));
    const laterIds = flattenIds(packs.filter((p) => p.round !== 1));
    for (const id of laterIds) {
      expect(round1Ids.has(id)).toBe(false);
    }
  });

  it('the pre-existing per-round guarantee still holds — zero overlap between a round pair (D-07 superset check)', () => {
    const rng = makeSeededRng(7);
    const { packs } = generateDraftPacks(ALL_POOLS_SELECTION, rng);
    for (const round of DRAFT_ROUNDS) {
      const roundPacks = packs.filter((p) => p.round === round.round);
      expect(roundPacks).toHaveLength(PACKS_PER_ROUND);
      const idSets = roundPacks.map((pack) => new Set(pack.cards.map((c) => c.id)));
      for (let i = 0; i < idSets.length; i++) {
        for (let j = i + 1; j < idSets.length; j++) {
          const overlap = [...idSets[i]].filter((id) => idSets[j].has(id));
          expect(overlap).toHaveLength(0);
        }
      }
    }
  });

  it('none of the pool selections throws under match-wide dedup', () => {
    const rng = makeSeededRng(8);
    for (const selection of [...SINGLE_POOL_SELECTIONS, ALL_POOLS_SELECTION]) {
      expect(() => generateDraftPacks(selection, rng)).not.toThrow();
    }
  });
});
