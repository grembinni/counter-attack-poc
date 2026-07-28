/**
 * Phase 30 Plan 05 — DRAFT-05/DRAFT-08/DRAFT-11 integration invariants over real crypto RNG.
 *
 * These tests exercise `generateMatchPacks` (the server-authoritative entry point that
 * binds Node's `crypto.randomInt` into the shared engine), NOT `generateDraftPacks` with
 * a fake/seeded RNG. Because the randomness is real and non-deterministic, we assert
 * STRUCTURAL invariants that must hold on every run, looping several iterations to catch
 * seed-dependent regressions rather than asserting exact output.
 *
 * Recalibrated for the 6-round model (Phase 30): 12 round-tagged 4-card packs (2 per
 * round), round 1 is GK-only, rounds 2-6 are non-GK tiered packs. Legends/Icons pools
 * are now selectable (DRAFT-11) and must backfill without throwing (D-08/D-10).
 */
import { describe, it, expect } from 'vitest';
import { generateMatchPacks } from '../draftPacks.js';
import { DRAFT_ROUND_COUNT, PACKS_PER_ROUND, SELECTABLE_DRAFT_POOLS } from '@counter-attack/shared';
import type { DraftPoolId } from '@counter-attack/shared';

const ITERATIONS = 5;
const TOTAL_PACKS = DRAFT_ROUND_COUNT * PACKS_PER_ROUND;

function assertStructuralInvariants(selectedPools: DraftPoolId[]) {
  const { pool, packs } = generateMatchPacks(selectedPools);

  expect(pool.length).toBeGreaterThan(0);
  expect(packs.length).toBe(TOTAL_PACKS);

  const poolIds = new Set(pool.map((p) => p.id));
  const countsByRound = new Map<number, number>();

  for (const pack of packs) {
    expect(pack.cards.length).toBe(4);
    expect(pack.round).toBeGreaterThanOrEqual(1);
    expect(pack.round).toBeLessThanOrEqual(DRAFT_ROUND_COUNT);
    countsByRound.set(pack.round, (countsByRound.get(pack.round) ?? 0) + 1);

    for (const card of pack.cards) {
      // Every card dealt into a pack must exist in the returned classified pool.
      expect(poolIds.has(card.id)).toBe(true);

      // Round 1 is GK-only; rounds 2-6 exclude GK entirely (D-07/D-12).
      if (pack.round === 1) {
        expect(card.role).toBe('GK');
      } else {
        expect(card.role).not.toBe('GK');
      }
    }
  }

  for (let round = 1; round <= DRAFT_ROUND_COUNT; round++) {
    expect(countsByRound.get(round)).toBe(PACKS_PER_ROUND);
  }

  // BUG-34 (Phase 36), D-06: no player id appears in more than one pack across the WHOLE
  // match's 12 packs — supersedes Phase 30's D-18, which previously scoped this check
  // per-round only (a card was allowed to reappear in a different round). Flatten every
  // dealt card id across all packs and assert both the total count and the distinct count
  // equal TOTAL_PACKS * 4 — any duplicate anywhere in the match fails this.
  const allIds = packs.flatMap((pack) => pack.cards.map((c) => c.id));
  expect(allIds.length).toBe(TOTAL_PACKS * 4);
  expect(new Set(allIds).size).toBe(TOTAL_PACKS * 4);

  // D-07: the within-round no-duplicate-card guarantee still holds as a distinct,
  // explicitly-labelled assertion — a regression that broke only the within-round rule
  // (while somehow leaving the broader match-wide count intact) would still be caught
  // here with a precise per-round failure message.
  for (let round = 1; round <= DRAFT_ROUND_COUNT; round++) {
    const roundPacks = packs.filter((p) => p.round === round);
    const idSets = roundPacks.map((pack) => new Set(pack.cards.map((c) => c.id)));
    for (let i = 0; i < idSets.length; i++) {
      for (let j = i + 1; j < idSets.length; j++) {
        const overlap = [...idSets[i]!].filter((id) => idSets[j]!.has(id));
        expect(overlap).toHaveLength(0);
      }
    }
  }
}

describe('generateMatchPacks — end-to-end structural invariants over real crypto RNG (Phase 30 Plan 05)', () => {
  it(`Test 1: ['original'] yields ${TOTAL_PACKS} round-tagged, correctly-composed, duplicate-free packs across ${ITERATIONS} iterations`, () => {
    for (let i = 0; i < ITERATIONS; i++) {
      assertStructuralInvariants(['original']);
    }
  });

  it(`Test 2: ['original','mls','international'] yields ${TOTAL_PACKS} round-tagged, correctly-composed, duplicate-free packs across ${ITERATIONS} iterations`, () => {
    for (let i = 0; i < ITERATIONS; i++) {
      assertStructuralInvariants(['original', 'mls', 'international']);
    }
  });

  it('Test 3: every single-pool selection in SELECTABLE_DRAFT_POOLS backfills successfully without throwing', () => {
    for (const poolId of SELECTABLE_DRAFT_POOLS) {
      expect(() => generateMatchPacks([poolId])).not.toThrow();
    }
  });

  // WR-02 (Phase 28 review, carried forward): 'mls' and 'international' each have a
  // comparatively small outfield population — they are tight-supply, backfill-dependent
  // single-pool scenarios. Test 3 above only asserts `not.toThrow()`; exercise the FULL
  // structural invariants (pack size, round tagging, GK gating, no cross-pack duplication)
  // for these two so a regression cannot pass this suite silently.
  it(`Test 4: ['mls'] yields ${TOTAL_PACKS} round-tagged, correctly-composed, duplicate-free packs across ${ITERATIONS} iterations`, () => {
    for (let i = 0; i < ITERATIONS; i++) {
      assertStructuralInvariants(['mls']);
    }
  });

  it(`Test 5: ['international'] yields ${TOTAL_PACKS} round-tagged, correctly-composed, duplicate-free packs across ${ITERATIONS} iterations`, () => {
    for (let i = 0; i < ITERATIONS; i++) {
      assertStructuralInvariants(['international']);
    }
  });

  // D-08/D-10 (Phase 30, DRAFT-11): Legends/Icons pools are small and heavily
  // backfill-dependent by design — they must NOT throw, and must still produce a fully
  // round-tagged 12-pack structure via the MLS/Original fallback chain (D-11).
  it("Test 6: ['legends'] does not throw and yields a full round-tagged pack structure via backfill", () => {
    expect(() => {
      const { packs } = generateMatchPacks(['legends']);
      expect(packs.length).toBe(TOTAL_PACKS);
      const round1 = packs.filter((p) => p.round === 1);
      expect(round1).toHaveLength(PACKS_PER_ROUND);
      for (const pack of round1) {
        for (const card of pack.cards) expect(card.role).toBe('GK');
      }
    }).not.toThrow();
  });

  it("Test 7: ['icons'] does not throw and yields a full round-tagged pack structure via backfill", () => {
    expect(() => {
      const { packs } = generateMatchPacks(['icons']);
      expect(packs.length).toBe(TOTAL_PACKS);
      const round1 = packs.filter((p) => p.round === 1);
      expect(round1).toHaveLength(PACKS_PER_ROUND);
      for (const pack of round1) {
        for (const card of pack.cards) expect(card.role).toBe('GK');
      }
    }).not.toThrow();
  });
});
