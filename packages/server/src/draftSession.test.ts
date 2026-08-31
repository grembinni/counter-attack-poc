/**
 * Unit tests for the pure draft-session state machine.
 * Rewritten Phase 30 Plan 03 (DRAFT-05/DRAFT-08) for the 6-round variable-pick model:
 * round 1 (GK-only) = 2 picks (D-12), rounds 2-6 (tiered) = 3 picks each (D-13/D-14/D-15),
 * 17 total drafted cards per side at completion (D-16), and the old DRAFT-08 GK-auto-pick
 * safety-net mechanic (and its associated session bookkeeping) fully deleted (D-21) rather
 * than left dormant.
 *
 * Deterministic array/constant-backed fake RNGs are used for exact-value assertions
 * (matching the `(min, max)` contract); real `crypto.randomInt` is used in a looped,
 * structural-invariant style (mirroring `draftPacks.test.ts`) for the shuffle/statistical
 * properties of `assignRoundPackOrder`/`assignBenchNumbers`.
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
import { DRAFT_ROUNDS, DRAFT_ROUND_COUNT } from '@counter-attack/shared';
import {
  createDraftSession,
  applyPick,
  applyRearrange,
  openNextRound,
  advanceSubStep,
  assignBenchNumbers,
  backfillBenchNumbers,
  buildDraftView,
} from './draftSession.js';

/** Always returns the same value regardless of (min, max) — deterministic, non-identity shuffle driver. */
function constantRng(value: number): RandomIntFn {
  return () => value;
}

function makeCard(
  id: string,
  tier: DraftTier,
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST' = 'DEF',
): TieredPoolPlayer {
  return {
    id,
    sourceTeamId: 'free-agent',
    firstName: 'Test',
    lastName: id,
    number: 0,
    nationality: 'Testland',
    role,
    position: { q: 0, r: 0 },
    pace: 3,
    shooting: 3,
    tackling: 3,
    dribbling: 3,
    saving: role === 'GK' ? 3 : 0,
    handling: role === 'GK' ? 3 : 0,
    resilience: 3,
    aerialAbility: 3,
    highPass: role === 'GK' ? 0 : 3,
    tier,
    totalStat: 27,
  };
}

/** Builds a 4-card, round-tagged pack (D-12..D-19: every round's packs are 4 cards). */
function makePack(
  packNumber: number,
  round: number,
  tier: DraftTier,
  role: 'GK' | 'DEF' = 'DEF',
): DraftPack {
  return {
    packNumber,
    round,
    cards: [
      makeCard(`p${packNumber}-${round}-a`, tier, role),
      makeCard(`p${packNumber}-${round}-b`, tier, role),
      makeCard(`p${packNumber}-${round}-c`, tier, role),
      makeCard(`p${packNumber}-${round}-d`, tier, role),
    ],
  };
}

/** Builds the full 12-pack set (2 per round x 6 rounds, D-12..D-16). Round 1 packs are
 * GK-role cards (mirroring D-12's GK-only round); rounds 2-6 are outfield 'common'-tier
 * cards (composition details don't matter for the state-machine tests in this file). */
function makeTwelvePacks(): DraftPack[] {
  const packs: DraftPack[] = [];
  let packNumber = 1;
  for (let round = 1; round <= DRAFT_ROUND_COUNT; round++) {
    const role = round === 1 ? 'GK' : 'DEF';
    packs.push(makePack(packNumber++, round, 'common', role));
    packs.push(makePack(packNumber++, round, 'common', role));
  }
  return packs;
}

/** A minimal, fully-valid DraftSession fixture — tests override only the fields they care about. */
function baseSession(overrides: Partial<DraftSession> = {}): DraftSession {
  const packs = makeTwelvePacks();
  const round1Packs = packs.filter((p) => p.round === 1);
  const round2Packs = packs.filter((p) => p.round === 2);
  return {
    round: 2,
    subStep: 'PICK1',
    draftPacks: packs,
    homePackOrder: [packs.indexOf(round1Packs[0]!), packs.indexOf(round2Packs[0]!), 0, 0, 0, 0],
    awayPackOrder: [packs.indexOf(round1Packs[1]!), packs.indexOf(round2Packs[1]!), 0, 0, 0, 0],
    homeCurrentPack: [...round2Packs[0]!.cards],
    awayCurrentPack: [...round2Packs[1]!.cards],
    homeDraftedIds: [],
    awayDraftedIds: [],
    homePicksRemaining: 1,
    awayPicksRemaining: 1,
    homeLineupSlots: new Array<string | null>(11).fill(null),
    awayLineupSlots: new Array<string | null>(11).fill(null),
    homeBenchIds: [],
    awayBenchIds: [],
    homeBenchNumbers: {},
    awayBenchNumbers: {},
    draftComplete: false,
    ...overrides,
  };
}

describe('assignRoundPackOrder (D-12..D-19, RESEARCH.md Pattern 3)', () => {
  it('a controlling rng reaches both [home,away] and [away,home] pairings across the 6 per-round coin-flips', () => {
    const packs = makeTwelvePacks();

    const allHomeFirst = createDraftSession(packs, constantRng(0));
    const allAwayFirst = createDraftSession(packs, constantRng(1));

    // constantRng(0) -> rng(0,2) === 0 every round -> packA always goes home.
    // constantRng(1) -> rng(0,2) === 1 every round -> packA always goes away.
    expect(allHomeFirst.homePackOrder).not.toEqual(allAwayFirst.homePackOrder);
    expect(allHomeFirst.awayPackOrder).not.toEqual(allAwayFirst.awayPackOrder);
  });

  it('never assigns the same pack index to both sides in the same round', () => {
    for (let iter = 0; iter < 20; iter++) {
      const packs = makeTwelvePacks();
      const session = createDraftSession(packs, randomInt);

      for (let round = 1; round <= DRAFT_ROUND_COUNT; round++) {
        const homeIdx = session.homePackOrder[round - 1];
        const awayIdx = session.awayPackOrder[round - 1];
        expect(homeIdx).not.toBe(awayIdx);
        expect(packs[homeIdx!]!.round).toBe(round);
        expect(packs[awayIdx!]!.round).toBe(round);
      }
    }
  });
});

describe('createDraftSession', () => {
  it('bootstraps round 0, PICK1, empty arrays, 11-null lineup slots, not complete', () => {
    const packs = makeTwelvePacks();
    const session = createDraftSession(packs, constantRng(0));

    expect(session.round).toBe(0);
    expect(session.subStep).toBe('PICK1');
    expect(session.draftComplete).toBe(false);
    expect(session.homeDraftedIds).toEqual([]);
    expect(session.awayDraftedIds).toEqual([]);
    expect(session.homeLineupSlots).toEqual(new Array(11).fill(null));
    expect(session.awayLineupSlots).toEqual(new Array(11).fill(null));
    expect(session.homePicksRemaining).toBe(0);
    expect(session.awayPicksRemaining).toBe(0);
    expect(session.draftPacks).toBe(packs);

    // D-21: the session shape has no GK-auto-pick safety-net bookkeeping at all — the
    // DraftSession type itself no longer declares those fields (compile-time guarantee),
    // so there is nothing further to assert about their absence at runtime.
    expect(session.homePackOrder.length).toBe(6);
    expect(session.awayPackOrder.length).toBe(6);
  });
});

describe('applyPick (D-06/D-07)', () => {
  it('moves a card from currentPack to a slot, drafts it, decrements picksRemaining', () => {
    const session = baseSession();
    const card = session.homeCurrentPack[0]!;

    const result = applyPick(session, 'home', card.id, { type: 'slot', slotIndex: 5 });

    expect(result.ok).toBe(true);
    expect(result.session.homeLineupSlots[5]).toBe(card.id);
    expect(result.session.homeDraftedIds).toContain(card.id);
    expect(result.session.homeCurrentPack.find((c) => c.id === card.id)).toBeUndefined();
    expect(result.session.homePicksRemaining).toBe(session.homePicksRemaining - 1);
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
  it('moves a card from a lineup slot to the bench without changing round/subStep/picksRemaining', () => {
    const lineupSlots = new Array<string | null>(11).fill(null);
    lineupSlots[3] = 'card-x';
    const session = baseSession({
      round: 3,
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
    expect(result.session.round).toBe(3);
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

describe('openNextRound (D-12..D-19)', () => {
  it('opens round 1 from a freshly-bootstrapped (round 0) session', () => {
    const packs = makeTwelvePacks();
    let session = createDraftSession(packs, constantRng(0));

    session = openNextRound(session);

    expect(session.round).toBe(1);
    expect(session.subStep).toBe('PICK1');
    expect(session.homePicksRemaining).toBe(1);
    expect(session.awayPicksRemaining).toBe(1);

    const homePackIdx = session.homePackOrder[0]!;
    const awayPackIdx = session.awayPackOrder[0]!;
    expect(session.homeCurrentPack).toEqual(packs[homePackIdx]!.cards);
    expect(session.awayCurrentPack).toEqual(packs[awayPackIdx]!.cards);
  });

  it('discards round-leftover cards — currentPack is fully overwritten, never merged (D-18)', () => {
    const packs = makeTwelvePacks();
    let session = createDraftSession(packs, constantRng(0));
    session = openNextRound(session); // round 1

    // Simulate a round-1 leftover: pretend the pack still has an uncollected card.
    const leftoverCard = session.homeCurrentPack[0]!;
    session = { ...session, round: 1, homePicksRemaining: 0, awayPicksRemaining: 0 };

    const advanced = openNextRound(session); // -> round 2

    expect(advanced.homeCurrentPack.find((c) => c.id === leftoverCard.id)).toBeUndefined();
  });
});

describe('advanceSubStep (D-12..D-20, phase-boundary-only gating A1)', () => {
  it('is a no-op while either side still has picksRemaining > 0 (mid-PICK2 waiting state)', () => {
    const session = baseSession({ subStep: 'PICK2', homePicksRemaining: 1, awayPicksRemaining: 0 });

    const result = advanceSubStep(session);

    expect(result).toBe(session);
  });

  it('advances PICK1 -> PICK2, swapping the two players current packs, picksRemaining 1 each', () => {
    const homePack = makeTwelvePacks().filter((p) => p.round === 2)[0]!.cards;
    const awayPack = makeTwelvePacks().filter((p) => p.round === 2)[1]!.cards;
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
    expect(result.homePicksRemaining).toBe(1);
    expect(result.awayPicksRemaining).toBe(1);
  });

  describe('round 1 (GK-only, D-12): completes after PICK2, no PICK3', () => {
    it('advances PICK2 -> next round PICK1 directly (no PICK3 sub-step)', () => {
      const packs = makeTwelvePacks();
      let session = createDraftSession(packs, constantRng(0));
      session = openNextRound(session); // round 1, PICK1

      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // -> PICK2
      expect(session.subStep).toBe('PICK2');
      expect(session.round).toBe(1);

      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // -> round 2 PICK1 directly, no PICK3

      expect(session.round).toBe(2);
      expect(session.subStep).toBe('PICK1');
      expect(session.homePicksRemaining).toBe(1);
      expect(session.awayPicksRemaining).toBe(1);
    });
  });

  describe('rounds 2-6 (tiered, D-13/D-14/D-15): run PICK1 -> PICK2 -> PICK3', () => {
    it('advances PICK2 -> PICK3, swapping packs back to their original owners', () => {
      const originalHomePack = makeTwelvePacks().filter((p) => p.round === 2)[0]!.cards;
      const originalAwayPack = makeTwelvePacks().filter((p) => p.round === 2)[1]!.cards;
      // Post PICK1->PICK2 swap: home holds away's original pack (minus away's PICK1 pick) and
      // vice-versa. Swapping back at PICK2->PICK3 should restore each side to what the OTHER
      // side currently holds (i.e. a second swap of the same two references).
      const session = baseSession({
        round: 2,
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

    it('advances PICK3 -> next round PICK1 for rounds 2-5 (leftover cards discarded, D-18)', () => {
      const packs = makeTwelvePacks();
      let session = createDraftSession(packs, constantRng(0));
      session = openNextRound(session); // round 1, PICK1

      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // -> PICK2 (still round 1)
      expect(session.round).toBe(1);
      expect(session.subStep).toBe('PICK2');

      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // -> round 2, PICK1 (round 1 has no PICK3)
      expect(session.round).toBe(2);
      expect(session.subStep).toBe('PICK1');

      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // -> PICK2
      expect(session.subStep).toBe('PICK2');

      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // -> PICK3
      expect(session.subStep).toBe('PICK3');

      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // -> round 3, PICK1 (3 leftovers silently discarded)

      expect(session.round).toBe(3);
      expect(session.subStep).toBe('PICK1');
      expect(session.homePicksRemaining).toBe(1);
      expect(session.awayPicksRemaining).toBe(1);
    });
  });

  it('sets draftComplete true after round 6 PICK3 resolves (subStep left as-is)', () => {
    const packs = makeTwelvePacks();
    let session = createDraftSession(packs, constantRng(0));
    session = openNextRound(session); // round 1

    // Round 1: PICK1 -> PICK2 -> (round complete, no PICK3) -> round 2
    session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
    session = advanceSubStep(session); // PICK2
    session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
    session = advanceSubStep(session); // -> round 2, PICK1
    expect(session.round).toBe(2);

    // Rounds 2-6: PICK1 -> PICK2 -> PICK3 -> next round
    for (let round = 2; round <= 6; round++) {
      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // PICK2
      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // PICK3
      session = { ...session, homePicksRemaining: 0, awayPicksRemaining: 0 };
      session = advanceSubStep(session); // next round PICK1, or draftComplete if round === 6
    }

    expect(session.draftComplete).toBe(true);
  });
});

describe('full 6-round drive — 17 drafted cards per player cross-check (D-16)', () => {
  it('drives a complete session end-to-end via applyPick + advanceSubStep', () => {
    const packs = makeTwelvePacks();
    let session = createDraftSession(packs, constantRng(0));
    session = openNextRound(session); // round 1, PICK1

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

    expect(session.homeDraftedIds.length).toBe(17);
    expect(session.awayDraftedIds.length).toBe(17);
    expect(new Set(session.homeDraftedIds).size).toBe(17);
    expect(new Set(session.awayDraftedIds).size).toBe(17);
  });

  it('round 1 contributes exactly 2 of the 17 total picks, rounds 2-6 contribute 3 each (D-16 sum check)', () => {
    const totalFromConfig = DRAFT_ROUNDS.reduce((sum, r) => sum + r.picks, 0);
    expect(totalFromConfig).toBe(17);
    expect(DRAFT_ROUNDS[0]!.picks).toBe(2);
    for (let i = 1; i < DRAFT_ROUNDS.length; i++) {
      expect(DRAFT_ROUNDS[i]!.picks).toBe(3);
    }
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

describe('backfillBenchNumbers (Phase 48, D-05)', () => {
  it('an id present in benchIds but missing from benchNumbers receives a number in [15, 99]', () => {
    const session = baseSession({
      homeBenchIds: ['a'],
      homeBenchNumbers: {},
    });

    const result = backfillBenchNumbers(session, 'home', randomInt);

    expect(result.homeBenchNumbers['a']).toBeGreaterThanOrEqual(15);
    expect(result.homeBenchNumbers['a']).toBeLessThanOrEqual(99);
  });

  it('an id already present in benchNumbers keeps its exact prior value across the call', () => {
    const session = baseSession({
      homeBenchIds: ['x', 'y'],
      homeBenchNumbers: { x: 42 },
    });

    const result = backfillBenchNumbers(session, 'home', randomInt);

    expect(result.homeBenchNumbers['x']).toBe(42);
    expect(result.homeBenchNumbers['y']).toBeDefined();
  });

  it('the drawn number never equals an already-in-use number', () => {
    const session = baseSession({
      homeBenchIds: ['a', 'b', 'c', 'd', 'newId'],
      homeBenchNumbers: { a: 15, b: 16, c: 17, d: 18 },
    });

    const result = backfillBenchNumbers(session, 'home', randomInt);

    expect([15, 16, 17, 18]).not.toContain(result.homeBenchNumbers['newId']);
  });

  it('calling backfillBenchNumbers twice in a row is idempotent (same contents, same session reference)', () => {
    const session = baseSession({
      homeBenchIds: ['a'],
      homeBenchNumbers: {},
    });

    const first = backfillBenchNumbers(session, 'home', randomInt);
    const second = backfillBenchNumbers(first, 'home', randomInt);

    expect(second.homeBenchNumbers).toEqual(first.homeBenchNumbers);
    expect(second).toBe(first);
  });

  it('a benchIds array containing the same id twice produces exactly one entry for that id', () => {
    const session = baseSession({
      homeBenchIds: ['dup', 'dup'],
      homeBenchNumbers: {},
    });

    const result = backfillBenchNumbers(session, 'home', randomInt);

    expect(Object.keys(result.homeBenchNumbers)).toEqual(['dup']);
  });

  it("the other side's benchNumbers is untouched", () => {
    const session = baseSession({
      homeBenchIds: ['a'],
      homeBenchNumbers: {},
      awayBenchIds: ['b'],
      awayBenchNumbers: { b: 55 },
    });

    const result = backfillBenchNumbers(session, 'home', randomInt);

    expect(result.awayBenchNumbers).toEqual({ b: 55 });
  });
});

describe('buildDraftView (D-14/T-29-PRIV/T-30-PRIV)', () => {
  it('exposes no opponent-prefixed keys, only this players own pack, round instead of cycle, no GK-auto-pick field', () => {
    const session = baseSession({ homePicksRemaining: 0, awayPicksRemaining: 1 });

    const view = buildDraftView(session, 'home');

    const keys = Object.keys(view);
    expect(keys).not.toContain('awayCurrentPack');
    expect(keys).not.toContain('homeCurrentPack');
    expect(keys.some((k) => /^away/i.test(k))).toBe(false);
    expect(keys.some((k) => /^home/i.test(k))).toBe(false);
    expect(keys).not.toContain('cycle');
    expect(keys).toContain('round');
    // D-05/D-21: DraftClientView's type shape has no GK-auto-pick field at all — a
    // compile-time guarantee (view satisfies DraftClientView), nothing further to assert.
    expect(view.currentPack).toEqual(session.homeCurrentPack);
    expect(view.round).toBe(session.round);
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
});
