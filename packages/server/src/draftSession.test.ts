/**
 * Unit tests for the pure draft-session state machine (Phase 29 Plan 02).
 *
 * Task 1: pack assignment (D-04), session bootstrap, pick/rearrange application (D-07/D-08).
 * Deterministic array/constant-backed fake RNGs are used for exact-value assertions
 * (matching the `(min, max)` contract); real `crypto.randomInt` is used in a looped,
 * structural-invariant style (mirroring `draftPacks.test.ts`) for the shuffle/statistical
 * properties of `assignPackOrders`/`assignBenchNumbers`.
 */
import { randomInt } from 'crypto';
import { describe, it, expect } from 'vitest';
import type {
  DraftPack,
  TieredPoolPlayer,
  DraftTier,
  RandomIntFn,
  DraftSession,
} from '@counter-attack/shared';
import { assignPackOrders, createDraftSession, applyPick, applyRearrange } from './draftSession.js';

/** Always returns the same value regardless of (min, max) — deterministic, non-identity shuffle driver. */
function constantRng(value: number): RandomIntFn {
  return () => value;
}

function makeCard(id: string, tier: DraftTier): TieredPoolPlayer {
  return {
    id,
    sourceTeamId: 'free-agent',
    firstName: 'Test',
    lastName: id,
    number: 0,
    nationality: 'Testland',
    role: tier === 'keeper' ? 'GK' : 'DEF',
    position: { q: 0, r: 0 },
    pace: 3,
    shooting: 3,
    tackling: 3,
    dribbling: 3,
    saving: tier === 'keeper' ? 3 : 0,
    handling: tier === 'keeper' ? 3 : 0,
    resilience: 3,
    aerialAbility: 3,
    highPass: 3,
    tier,
    totalStat: 27,
  };
}

function makePack(packNumber: number): DraftPack {
  return {
    packNumber,
    cards: [
      makeCard(`p${packNumber}-chase`, 'chase'),
      makeCard(`p${packNumber}-rare`, 'rare'),
      makeCard(`p${packNumber}-uncommon`, 'uncommon'),
      makeCard(`p${packNumber}-common1`, 'common'),
      makeCard(`p${packNumber}-common2`, 'common'),
      makeCard(`p${packNumber}-common3`, 'common'),
      makeCard(`p${packNumber}-keeper`, 'keeper'),
    ],
  };
}

function makeEightPacks(): DraftPack[] {
  return Array.from({ length: 8 }, (_, i) => makePack(i + 1));
}

/** A minimal, fully-valid DraftSession fixture — tests override only the fields they care about. */
function baseSession(overrides: Partial<DraftSession> = {}): DraftSession {
  const packs = makeEightPacks();
  return {
    cycle: 1,
    subStep: 'PICK1',
    draftPacks: packs,
    homePackOrder: [0, 1, 2, 3],
    awayPackOrder: [4, 5, 6, 7],
    homeCurrentPack: [...packs[0]!.cards],
    awayCurrentPack: [...packs[4]!.cards],
    homeDraftedIds: [],
    awayDraftedIds: [],
    homeHasKeeper: false,
    awayHasKeeper: false,
    homePicksRemaining: 1,
    awayPicksRemaining: 1,
    homeLineupSlots: new Array<string | null>(11).fill(null),
    awayLineupSlots: new Array<string | null>(11).fill(null),
    homeBenchIds: [],
    awayBenchIds: [],
    homeBenchNumbers: {},
    awayBenchNumbers: {},
    keeperAutoPickedThisCycle: { home: false, away: false },
    draftComplete: false,
    ...overrides,
  };
}

describe('assignPackOrders (D-04, Pitfall 5)', () => {
  it('returns a no-overlap permutation of 0..7 across many real-RNG runs', () => {
    for (let iter = 0; iter < 20; iter++) {
      const { homePackOrder, awayPackOrder } = assignPackOrders(8, randomInt);
      expect(homePackOrder.length).toBe(4);
      expect(awayPackOrder.length).toBe(4);

      const union = new Set([...homePackOrder, ...awayPackOrder]);
      expect(union.size).toBe(8);
      for (let i = 0; i < 8; i++) {
        expect(union.has(i)).toBe(true);
      }

      const homeSet = new Set(homePackOrder);
      for (const idx of awayPackOrder) {
        expect(homeSet.has(idx)).toBe(false);
      }
    }
  });

  it('is NOT the identity 0-3/4-7 split — a controlling rng produces a non-identity assignment', () => {
    // Every non-final iteration of the Fisher-Yates loop swaps index (n-1) with index 0 first,
    // so a constant-0 rng deterministically moves element 0 into the LAST position (away's
    // slice) — proving the shuffle actually redistributes elements across the home/away halves
    // rather than preserving the naive packs[0-3]->home / packs[4-7]->away convention.
    const { homePackOrder, awayPackOrder } = assignPackOrders(8, constantRng(0));
    expect(homePackOrder).not.toEqual([0, 1, 2, 3]);
    expect(awayPackOrder).not.toEqual([4, 5, 6, 7]);
    expect(awayPackOrder).toContain(0);
  });
});

describe('createDraftSession', () => {
  it('bootstraps cycle 0, PICK1, empty arrays, 11-null lineup slots, no keeper, not complete', () => {
    const packs = makeEightPacks();
    const session = createDraftSession(packs, constantRng(0));

    expect(session.cycle).toBe(0);
    expect(session.subStep).toBe('PICK1');
    expect(session.draftComplete).toBe(false);
    expect(session.homeDraftedIds).toEqual([]);
    expect(session.awayDraftedIds).toEqual([]);
    expect(session.homeLineupSlots).toEqual(new Array(11).fill(null));
    expect(session.awayLineupSlots).toEqual(new Array(11).fill(null));
    expect(session.homeHasKeeper).toBe(false);
    expect(session.awayHasKeeper).toBe(false);
    expect(session.homePicksRemaining).toBe(0);
    expect(session.awayPicksRemaining).toBe(0);
    expect(session.draftPacks).toBe(packs);
    expect(session.keeperAutoPickedThisCycle).toEqual({ home: false, away: false });

    const union = new Set([...session.homePackOrder, ...session.awayPackOrder]);
    expect(union.size).toBe(8);
  });
});

describe('applyPick (D-06/D-07)', () => {
  it('moves a card from currentPack to a slot, drafts it, decrements picksRemaining, sets hasKeeper', () => {
    const session = baseSession();
    const keeperCard = session.homeCurrentPack.find((c) => c.tier === 'keeper')!;

    const result = applyPick(session, 'home', keeperCard.id, { type: 'slot', slotIndex: 5 });

    expect(result.ok).toBe(true);
    expect(result.session.homeLineupSlots[5]).toBe(keeperCard.id);
    expect(result.session.homeDraftedIds).toContain(keeperCard.id);
    expect(result.session.homeCurrentPack.find((c) => c.id === keeperCard.id)).toBeUndefined();
    expect(result.session.homePicksRemaining).toBe(session.homePicksRemaining - 1);
    expect(result.session.homeHasKeeper).toBe(true);
  });

  it('pushes the prior slot occupant to the bench when placed onto an occupied slot (D-07)', () => {
    const lineupSlots = new Array<string | null>(11).fill(null);
    lineupSlots[5] = 'existing-card';
    const session = baseSession({ homeLineupSlots: lineupSlots });
    const card = session.homeCurrentPack[0]!;

    const result = applyPick(session, 'home', card.id, { type: 'slot', slotIndex: 5 });

    expect(result.ok).toBe(true);
    expect(result.session.homeLineupSlots[5]).toBe(card.id);
    expect(result.session.homeBenchIds).toContain('existing-card');
  });

  it('appends to the bench for a bench destination', () => {
    const session = baseSession();
    const card = session.homeCurrentPack[0]!;

    const result = applyPick(session, 'home', card.id, { type: 'bench' });

    expect(result.ok).toBe(true);
    expect(result.session.homeBenchIds).toEqual([card.id]);
  });

  it('returns INVALID_CARD and leaves the input session unmodified for an out-of-pack cardId', () => {
    const session = baseSession();
    const snapshot = structuredClone(session);

    const result = applyPick(session, 'home', 'not-a-real-card-id', { type: 'bench' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('INVALID_CARD');
    expect(result.session).toBe(session);
    expect(session).toEqual(snapshot);
  });

  it('returns a NEW session object on success — does not mutate the input', () => {
    const session = baseSession();
    const card = session.homeCurrentPack[0]!;

    const result = applyPick(session, 'home', card.id, { type: 'bench' });

    expect(result.session).not.toBe(session);
    expect(session.homeBenchIds).toEqual([]);
    expect(session.homeCurrentPack).toContainEqual(card);
  });
});

describe('applyRearrange (D-08/D-10)', () => {
  it('moves a card from a lineup slot to the bench without changing cycle/subStep/picksRemaining', () => {
    const lineupSlots = new Array<string | null>(11).fill(null);
    lineupSlots[3] = 'card-x';
    const session = baseSession({
      cycle: 2,
      subStep: 'PICK2',
      homePicksRemaining: 1,
      homeLineupSlots: lineupSlots,
    });

    const result = applyRearrange(
      session,
      'home',
      { type: 'slot', slotIndex: 3 },
      { type: 'bench', benchIndex: 0 },
    );

    expect(result.ok).toBe(true);
    expect(result.session.homeLineupSlots[3]).toBeNull();
    expect(result.session.homeBenchIds).toContain('card-x');
    expect(result.session.cycle).toBe(2);
    expect(result.session.subStep).toBe('PICK2');
    expect(result.session.homePicksRemaining).toBe(1);
  });

  it('displaces the current slot occupant to the bench when a bench card moves onto an occupied slot (D-07)', () => {
    const lineupSlots = new Array<string | null>(11).fill(null);
    lineupSlots[2] = 'occupant';
    const session = baseSession({ homeLineupSlots: lineupSlots, homeBenchIds: ['bench-card'] });

    const result = applyRearrange(
      session,
      'home',
      { type: 'bench', benchIndex: 0 },
      { type: 'slot', slotIndex: 2 },
    );

    expect(result.ok).toBe(true);
    expect(result.session.homeLineupSlots[2]).toBe('bench-card');
    expect(result.session.homeBenchIds).toContain('occupant');
    expect(result.session.homeBenchIds).not.toContain('bench-card');
  });

  it('returns INVALID_REARRANGE for a `from` ref holding no card, session unchanged', () => {
    const session = baseSession();

    const result = applyRearrange(
      session,
      'home',
      { type: 'slot', slotIndex: 0 },
      { type: 'bench', benchIndex: 0 },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('INVALID_REARRANGE');
    expect(result.session).toBe(session);
  });
});
