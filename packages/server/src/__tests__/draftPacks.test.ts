/**
 * Phase 28 Plan 04 — DRAFT-04/DRAFT-05 integration invariants over real crypto RNG.
 *
 * These tests exercise `generateMatchPacks` (the server-authoritative entry point that
 * binds Node's `crypto.randomInt` into the shared engine), NOT `generateDraftPacks` with
 * a fake/seeded RNG. Because the randomness is real and non-deterministic, we assert
 * STRUCTURAL invariants that must hold on every run, looping several iterations to catch
 * seed-dependent regressions rather than asserting exact output.
 */
import { describe, it, expect } from 'vitest';
import { generateMatchPacks } from '../draftPacks.js';
import { PACKS_PER_MATCH, PACK_COMPOSITION, SELECTABLE_DRAFT_POOLS } from '@counter-attack/shared';
import type { DraftPoolId, DraftTier } from '@counter-attack/shared';

const ITERATIONS = 5;
const VALID_TIERS: DraftTier[] = ['chase', 'rare', 'uncommon', 'common', 'keeper'];

function assertStructuralInvariants(selectedPools: DraftPoolId[]) {
  const { pool, packs } = generateMatchPacks(selectedPools);

  expect(pool.length).toBeGreaterThan(0);
  expect(packs.length).toBe(PACKS_PER_MATCH);

  const poolIds = new Set(pool.map((p) => p.id));
  const allCardIds: string[] = [];

  for (const pack of packs) {
    expect(pack.cards.length).toBe(7);

    const tierCounts: Record<DraftTier, number> = {
      chase: 0,
      rare: 0,
      uncommon: 0,
      common: 0,
      keeper: 0,
    };

    for (const card of pack.cards) {
      expect(VALID_TIERS).toContain(card.tier);
      tierCounts[card.tier]++;
      allCardIds.push(card.id);

      // Every card dealt into a pack must exist in the returned classified pool.
      expect(poolIds.has(card.id)).toBe(true);

      // Keeper-slot cards are always GK; non-keeper-slot cards are never GK.
      if (card.tier === 'keeper') {
        expect(card.role).toBe('GK');
      } else {
        expect(card.role).not.toBe('GK');
      }
    }

    expect(tierCounts).toEqual(PACK_COMPOSITION);
  }

  // No cross-pack duplication: all pools available for backfill in these selections,
  // so the D-09 wrap-around exception stays dormant and every dealt card is unique.
  const uniqueCardIds = new Set(allCardIds);
  expect(uniqueCardIds.size).toBe(PACKS_PER_MATCH * 7);
}

describe('generateMatchPacks — end-to-end structural invariants over real crypto RNG (Phase 28 Plan 04)', () => {
  it(`Test 1: ['original'] yields 8 correctly-composed, duplicate-free packs across ${ITERATIONS} iterations`, () => {
    for (let i = 0; i < ITERATIONS; i++) {
      assertStructuralInvariants(['original']);
    }
  });

  it(`Test 2: ['original','mls','international'] yields 8 correctly-composed, duplicate-free packs across ${ITERATIONS} iterations`, () => {
    for (let i = 0; i < ITERATIONS; i++) {
      assertStructuralInvariants(['original', 'mls', 'international']);
    }
  });

  it('Test 3: every single-pool selection in SELECTABLE_DRAFT_POOLS backfills successfully without throwing', () => {
    for (const poolId of SELECTABLE_DRAFT_POOLS) {
      expect(() => generateMatchPacks([poolId])).not.toThrow();
    }
  });
});
