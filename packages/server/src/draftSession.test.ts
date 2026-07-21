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
import {
  assignPackOrders,
  createDraftSession,
  applyPick,
  applyRearrange,
  openNextPack,
  advanceSubStep,
  checkKeeperSafety,
  assignBenchNumbers,
  buildDraftView,
} from './draftSession.js';

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

  it('performs a true two-way swap when both from and to are occupied lineup slots (D-24)', () => {
    const lineupSlots = new Array<string | null>(11).fill(null);
    lineupSlots[3] = 'card-a';
    lineupSlots[7] = 'card-b';
    const preBenchIds = ['unrelated-bench-card'];
    const session = baseSession({ homeLineupSlots: lineupSlots, homeBenchIds: preBenchIds });

    const result = applyRearrange(
      session,
      'home',
      { type: 'slot', slotIndex: 3 },
      { type: 'slot', slotIndex: 7 },
    );

    expect(result.ok).toBe(true);
    expect(result.session.homeLineupSlots[7]).toBe('card-a');
    expect(result.session.homeLineupSlots[3]).toBe('card-b');
    expect(result.session.homeBenchIds).toEqual(preBenchIds);
  });

  it('moves a card slot-to-slot onto an EMPTY destination without touching the bench', () => {
    const lineupSlots = new Array<string | null>(11).fill(null);
    lineupSlots[4] = 'card-c';
    const preBenchIds = ['unrelated-bench-card'];
    const session = baseSession({ homeLineupSlots: lineupSlots, homeBenchIds: preBenchIds });

    const result = applyRearrange(
      session,
      'home',
      { type: 'slot', slotIndex: 4 },
      { type: 'slot', slotIndex: 9 },
    );

    expect(result.ok).toBe(true);
    expect(result.session.homeLineupSlots[9]).toBe('card-c');
    expect(result.session.homeLineupSlots[4]).toBeNull();
    expect(result.session.homeBenchIds).toEqual(preBenchIds);
  });
});

describe('openNextPack (D-01/D-04)', () => {
  it('opens cycle 1 from a freshly-bootstrapped (cycle 0) session', () => {
    const packs = makeEightPacks();
    let session = createDraftSession(packs, constantRng(0));

    session = openNextPack(session);

    expect(session.cycle).toBe(1);
    expect(session.subStep).toBe('PICK1');
    expect(session.homePicksRemaining).toBe(1);
    expect(session.awayPicksRemaining).toBe(1);
    expect(session.keeperAutoPickedThisCycle).toEqual({ home: false, away: false });

    const homePackIdx = session.homePackOrder[0]!;
    const awayPackIdx = session.awayPackOrder[0]!;
    expect(session.homeCurrentPack).toEqual(packs[homePackIdx]!.cards);
    expect(session.awayCurrentPack).toEqual(packs[awayPackIdx]!.cards);
  });
});

describe('advanceSubStep (D-01/D-03, phase-boundary-only gating A1)', () => {
  it('is a no-op while either side still has picksRemaining > 0 (mid-PICK2 waiting state)', () => {
    const session = baseSession({ subStep: 'PICK2', homePicksRemaining: 1, awayPicksRemaining: 0 });

    const result = advanceSubStep(session);

    expect(result).toBe(session);
  });

  it('advances PICK1 -> PICK2, swapping the two players current packs', () => {
    const homePack = makeEightPacks()[0]!.cards;
    const awayPack = makeEightPacks()[4]!.cards;
    const session = baseSession({
      subStep: 'PICK1',
      homePicksRemaining: 0,
      awayPicksRemaining: 0,
      homeCurrentPack: homePack,
      awayCurrentPack: awayPack,
    });

    const result = advanceSubStep(session);

    expect(result.subStep).toBe('PICK2');
    expect(result.homeCurrentPack).toEqual(awayPack);
    expect(result.awayCurrentPack).toEqual(homePack);
    expect(result.homePicksRemaining).toBe(2);
    expect(result.awayPicksRemaining).toBe(2);
  });

  it('advances PICK2 -> PICK3, swapping packs back to their original owners', () => {
    const originalHomePack = makeEightPacks()[0]!.cards;
    const originalAwayPack = makeEightPacks()[4]!.cards;
    // Post PICK1->PICK2 swap: home holds away's original pack (minus away's PICK1 pick) and
    // vice-versa. Swapping back at PICK2->PICK3 should restore each side to what the OTHER
    // side currently holds (i.e. a second swap of the same two references).
    const session = baseSession({
      subStep: 'PICK2',
      homePicksRemaining: 0,
      awayPicksRemaining: 0,
      homeCurrentPack: originalAwayPack,
      awayCurrentPack: originalHomePack,
    });

    const result = advanceSubStep(session);

    expect(result.subStep).toBe('PICK3');
    expect(result.homeCurrentPack).toEqual(originalHomePack);
    expect(result.awayCurrentPack).toEqual(originalAwayPack);
    expect(result.homePicksRemaining).toBe(1);
    expect(result.awayPicksRemaining).toBe(1);
  });

  it('advances PICK3 -> next cycle PICK1 for cycles 1-3 (leftover cards discarded, D-02)', () => {
    const packs = makeEightPacks();
    let session = createDraftSession(packs, constantRng(0));
    session = openNextPack(session); // cycle 1, PICK1

    session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
    session = advanceSubStep(session); // -> PICK2
    expect(session.subStep).toBe('PICK2');

    session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
    session = advanceSubStep(session); // -> PICK3
    expect(session.subStep).toBe('PICK3');

    session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
    session = advanceSubStep(session); // -> cycle 2, PICK1 (3 leftovers silently discarded)

    expect(session.cycle).toBe(2);
    expect(session.subStep).toBe('PICK1');
    expect(session.homePicksRemaining).toBe(1);
    expect(session.awayPicksRemaining).toBe(1);
  });

  it('sets draftComplete true after cycle 4 PICK3 resolves (subStep left as-is)', () => {
    const packs = makeEightPacks();
    let session = createDraftSession(packs, constantRng(0));
    session = openNextPack(session); // cycle 1

    for (let cyc = 1; cyc < 4; cyc++) {
      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // PICK2
      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // PICK3
      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // next cycle PICK1
    }
    expect(session.cycle).toBe(4);
    expect(session.draftComplete).toBe(false);

    session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
    session = advanceSubStep(session); // PICK2
    session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
    session = advanceSubStep(session); // PICK3
    expect(session.draftComplete).toBe(false);

    session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
    session = advanceSubStep(session); // draft complete

    expect(session.draftComplete).toBe(true);
  });
});

describe('full 4-cycle drive — 16 drafted cards per player cross-check (DRAFT-07)', () => {
  it('drives a complete session end-to-end via applyPick + advanceSubStep', () => {
    const packs = makeEightPacks();
    let session = createDraftSession(packs, constantRng(0));
    session = openNextPack(session); // cycle 1, PICK1

    let iterations = 0;
    while (!session.draftComplete) {
      iterations++;
      expect(iterations).toBeLessThan(100); // safety valve against an infinite loop

      while (session.homePicksRemaining > 0) {
        const cardId = session.homeCurrentPack[0]!.id;
        const result = applyPick(session, 'home', cardId, { type: 'bench' });
        expect(result.ok).toBe(true);
        session = result.session;
      }
      while (session.awayPicksRemaining > 0) {
        const cardId = session.awayCurrentPack[0]!.id;
        const result = applyPick(session, 'away', cardId, { type: 'bench' });
        expect(result.ok).toBe(true);
        session = result.session;
      }

      session = advanceSubStep(session);
    }

    expect(session.homeDraftedIds.length).toBe(16);
    expect(session.awayDraftedIds.length).toBe(16);
    expect(new Set(session.homeDraftedIds).size).toBe(16);
    expect(new Set(session.awayDraftedIds).size).toBe(16);
  });
});

describe('checkKeeperSafety (DRAFT-08)', () => {
  it('auto-selects a keeper for a keeperless player at the cycle-4 PICK1 boundary, places it into the empty GK slot, and marks the auto-pick flag', () => {
    const packs = makeEightPacks();
    const cycle4Pack = packs[0]!;
    const session = baseSession({
      cycle: 4,
      subStep: 'PICK1',
      homePicksRemaining: 0,
      awayPicksRemaining: 0,
      homeCurrentPack: [...cycle4Pack.cards],
      homeHasKeeper: false,
      homeLineupSlots: new Array<string | null>(11).fill(null),
    });
    const keeperCard = cycle4Pack.cards.find((c) => c.tier === 'keeper')!;

    const result = checkKeeperSafety(session, constantRng(0));

    expect(result.homeDraftedIds).toContain(keeperCard.id);
    expect(result.homeHasKeeper).toBe(true);
    expect(result.keeperAutoPickedThisCycle.home).toBe(true);
    expect(result.homeLineupSlots[0]).toBe(keeperCard.id);
    expect(result.homeCurrentPack.find((c) => c.id === keeperCard.id)).toBeUndefined();
  });

  it("reduces the auto-picked side's next PICK2 requirement to 1 (via advanceSubStep)", () => {
    const packs = makeEightPacks();
    const cycle4Pack = packs[0]!;
    const session = baseSession({
      cycle: 4,
      subStep: 'PICK1',
      homePicksRemaining: 0,
      awayPicksRemaining: 0,
      homeCurrentPack: [...cycle4Pack.cards],
      homeHasKeeper: false,
      awayHasKeeper: true,
      homeLineupSlots: new Array<string | null>(11).fill(null),
    });

    const afterKeeperSafety = checkKeeperSafety(session, constantRng(0));
    const advanced = advanceSubStep(afterKeeperSafety);

    expect(advanced.subStep).toBe('PICK2');
    expect(advanced.homePicksRemaining).toBe(1); // reduced — auto-pick counted as one of the two
    expect(advanced.awayPicksRemaining).toBe(2); // untouched — away already had a keeper
  });

  it('places the auto-selected keeper onto the bench when the GK slot is already occupied', () => {
    const packs = makeEightPacks();
    const cycle4Pack = packs[0]!;
    const lineupSlots = new Array<string | null>(11).fill(null);
    lineupSlots[0] = 'already-here';
    const session = baseSession({
      cycle: 4,
      subStep: 'PICK1',
      homePicksRemaining: 0,
      awayPicksRemaining: 0,
      homeCurrentPack: [...cycle4Pack.cards],
      homeHasKeeper: false,
      homeLineupSlots: lineupSlots,
    });
    const keeperCard = cycle4Pack.cards.find((c) => c.tier === 'keeper')!;

    const result = checkKeeperSafety(session, constantRng(0));

    expect(result.homeLineupSlots[0]).toBe('already-here');
    expect(result.homeBenchIds).toContain(keeperCard.id);
  });

  it('leaves a side untouched if it already has a keeper', () => {
    const session = baseSession({
      cycle: 4,
      subStep: 'PICK1',
      homePicksRemaining: 0,
      awayPicksRemaining: 0,
      awayHasKeeper: true,
    });

    const result = checkKeeperSafety(session, constantRng(0));

    expect(result.awayHasKeeper).toBe(true);
    expect(result.awayDraftedIds).toEqual([]);
    expect(result.keeperAutoPickedThisCycle.away).toBe(false);
  });

  it('is a no-op outside the cycle-4 PICK1 boundary (wrong cycle)', () => {
    const session = baseSession({
      cycle: 2,
      subStep: 'PICK1',
      homePicksRemaining: 0,
      awayPicksRemaining: 0,
      homeHasKeeper: false,
    });

    const result = checkKeeperSafety(session, constantRng(0));

    expect(result).toBe(session);
  });

  it('is a no-op while either player still has a PICK1 pick remaining (wrong sub-step boundary)', () => {
    const session = baseSession({
      cycle: 4,
      subStep: 'PICK1',
      homePicksRemaining: 1,
      awayPicksRemaining: 0,
      homeHasKeeper: false,
    });

    const result = checkKeeperSafety(session, constantRng(0));

    expect(result).toBe(session);
  });
});

describe('assignBenchNumbers (D-15/D-16)', () => {
  it('returns N distinct integers within [15,99] across repeated real-RNG runs', () => {
    const benchIds = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (let iter = 0; iter < 20; iter++) {
      const numbers = assignBenchNumbers(benchIds, randomInt);
      const values = Object.values(numbers);

      expect(Object.keys(numbers).length).toBe(benchIds.length);
      expect(new Set(values).size).toBe(benchIds.length);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(15);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });

  it('returns an empty record for an empty bench', () => {
    expect(assignBenchNumbers([], randomInt)).toEqual({});
  });
});

describe('buildDraftView (D-14/T-29-PRIV)', () => {
  it('exposes no opponent-prefixed keys and only this players own pack', () => {
    const session = baseSession({ homePicksRemaining: 0, awayPicksRemaining: 1 });

    const view = buildDraftView(session, 'home');

    const keys = Object.keys(view);
    expect(keys).not.toContain('awayCurrentPack');
    expect(keys).not.toContain('homeCurrentPack');
    expect(keys.some((k) => /^away/i.test(k))).toBe(false);
    expect(keys.some((k) => /^home/i.test(k))).toBe(false);
    expect(view.currentPack).toEqual(session.homeCurrentPack);
  });

  it('computes waitingForOpponent true once this player is done and the opponent is not', () => {
    const session = baseSession({
      homePicksRemaining: 0,
      awayPicksRemaining: 1,
      draftComplete: false,
    });

    const view = buildDraftView(session, 'home');

    expect(view.waitingForOpponent).toBe(true);
  });

  it('computes waitingForOpponent false while this player still has picks remaining', () => {
    const session = baseSession({ homePicksRemaining: 1, awayPicksRemaining: 0 });

    const view = buildDraftView(session, 'home');

    expect(view.waitingForOpponent).toBe(false);
  });

  it('computes waitingForOpponent false once the draft is complete, even if picksRemaining is stale', () => {
    const session = baseSession({
      homePicksRemaining: 0,
      awayPicksRemaining: 0,
      draftComplete: true,
    });

    const view = buildDraftView(session, 'home');

    expect(view.waitingForOpponent).toBe(false);
    expect(view.draftComplete).toBe(true);
  });

  it("reflects this side's own keeperAutoPickedThisCycle flag only", () => {
    const session = baseSession({
      keeperAutoPickedThisCycle: { home: true, away: false },
    });

    const homeView = buildDraftView(session, 'home');
    const awayView = buildDraftView(session, 'away');

    expect(homeView.keeperAutoPickedThisCycle).toBe(true);
    expect(awayView.keeperAutoPickedThisCycle).toBe(false);
  });
});
