/**
 * Phase 28 DRAFT-04, Phase 30 D-03/D-04/D-05/D-09: pool derivation + fixed-threshold tier
 * classification contract for draftEngine.ts. Follows the teams.test.ts vitest
 * describe/it style, grouped by decision ID.
 *
 * Phase 30: generateDraftPacks is stubbed in this plan (round-structured implementation
 * lands in 30-02) — its describe blocks are intentionally NOT present here; fresh
 * round-scoped pack tests are written in Plan 02.
 */
import { describe, it, expect } from 'vitest';
import { PLAYER_POOL } from './teams.js';
import type { PoolPlayer } from './teams.js';
import { TEAM_CONFIGS } from './teamConfig.js';
import {
  computeTotalStat,
  classifyTier,
  isInPool,
  resolvePoolPlayers,
  assignTiers,
} from './draftEngine.js';

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
