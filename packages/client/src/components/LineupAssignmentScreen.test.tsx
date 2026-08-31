/**
 * LineupAssignmentScreen.test.tsx — originated Phase 29 (29-05-PLAN.md Task 3);
 * fully rewritten Phase 47 (47-04-PLAN.md) from native HTML5 pointer-gesture
 * simulation to the app's click-to-select model (click = select green,
 * eligible targets = blue, click again = deselect, click a blue target =
 * complete the action) across all four roster surfaces.
 *
 * Covers, by requirement:
 * - ROSTER-01/02/03/04: select/deselect/eligible-highlight/complete, proven
 *   independently on every surface below.
 * - ROSTER-05: reposition/substitute eligibility stay structurally separate
 *   functions; a selection never survives a mode-toggle crossing.
 * - ROSTER-07: Standard pregame lineup click-to-swap (own describe block).
 * - ROSTER-08: draft pack/slot/bench click-select, including the five
 *   dispatch shapes (pick->slot, pick->bench, slot->slot, slot->bench,
 *   bench->slot) and the GK-slot rule — enforced in the eligibility
 *   highlight itself (a GK-violating slot is never highlighted and a click
 *   on it is a silent no-op), not via a client-side rejection message.
 * - D-06/D-07/D-08: substitution-mode bench-first selection with a
 *   switch-on-reselect gesture (D-07), contrasted with positioning-mode's
 *   strict deselect-first gesture (D-08) — each has its own dedicated test.
 * - D-05: the SENT OFF placeholder is a positioning-mode-only eligible
 *   target, never eligible in substitution mode.
 * - D-09: the GK card is never a selectable source in positioning mode, but
 *   remains a valid completion target (server's GK_SLOT_LOCKED stays the
 *   feedback path).
 *
 * Other coverage carried over from earlier phases: draft-mode carousel
 * layout and round/pick counter text (D-20, Phase 30), draftComplete
 * hand-off and tier-color borders (D-23, Phase 30), Standard-mode
 * non-regression, and the full Phase 40/42 mid-match substitution/
 * positioning-mode behavioural surface (SUB-0X/ICON-0X), all re-proven under
 * the click model.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import {
  PLAYER_POOL,
  computeTotalStat,
  MAX_SUBS_PER_TEAM,
  getGenericBenchPlayers,
} from '@counter-attack/shared';
import type {
  BenchEntry,
  DraftClientView,
  DraftDestination,
  DraftSlotRef,
  DraftTier,
  PlayerPiece,
  PoolPlayer,
  TieredPoolPlayer,
} from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { LineupAssignmentScreen } from './LineupAssignmentScreen.js';
import { TIER_CARD_CLASS } from './DraftPackCarousel.js';

afterEach(() => cleanup());

const PLAYER_BY_ID = new Map<string, PoolPlayer>(PLAYER_POOL.map((p) => [p.id, p]));

function tieredCard(id: string, tier: DraftTier): TieredPoolPlayer {
  const player = PLAYER_BY_ID.get(id)!;
  return { ...player, tier, totalStat: computeTotalStat(player) };
}

/** A representative DraftClientView: round 2 (tiered, 3 picks/round), subStep PICK1, a 7-card
 * pack, picksRemaining 1, a couple of filled lineup slots (GK + one DEF) with the rest null,
 * a 2-card bench. */
function makeDraftView(overrides: Partial<DraftClientView> = {}): DraftClientView {
  return {
    round: 2,
    subStep: 'PICK1',
    currentPack: [
      tieredCard('p013', 'chase'),
      tieredCard('p014', 'rare'),
      tieredCard('p015', 'uncommon'),
      tieredCard('p016', 'common'),
      tieredCard('p017', 'common'),
      tieredCard('p018', 'common'),
      tieredCard('p012', 'common'),
    ],
    picksRemaining: 1,
    waitingForOpponent: false,
    lineupSlots: ['p001', 'p002', null, null, null, null, null, null, null, null, null],
    benchIds: ['p003', 'p004'],
    benchNumbers: {},
    draftComplete: false,
    ...overrides,
  };
}

const NOOP = () => {};

describe('LineupAssignmentScreen — DRAFT-06: draft-mode carousel layout', () => {
  it('renders DraftPackCarousel above the formation grid and BenchCarousel below it', () => {
    const { container } = render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView()}
        onDraftPick={NOOP}
        onDraftRearrange={NOOP}
      />,
    );

    const carouselRow = container.querySelector(`.${TIER_CARD_CLASS.chase}`);
    const grid = container.querySelector('[class*="formationColumns"]');
    const bench = screen.getByTestId('bench-carousel');

    expect(carouselRow).not.toBeNull();
    expect(grid).not.toBeNull();

    // DOM order: carousel before grid, grid before bench.
    expect(
      carouselRow!.compareDocumentPosition(grid!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      grid!.compareDocumentPosition(bench).valueOf() & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('LineupAssignmentScreen — DRAFT-06/D-05/ROSTER-08: click-to-pick', () => {
  it('clicking a pack-sourced card then an empty lineup slot calls onDraftPick with a slot destination', () => {
    const onDraftPick = vi.fn();
    const { container } = render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView()}
        onDraftPick={onDraftPick}
        onDraftRearrange={NOOP}
      />,
    );

    const packCardEl = container.querySelector(`.${TIER_CARD_CLASS.chase}`);
    expect(packCardEl).not.toBeNull();

    fireEvent.click(packCardEl!);

    // slotIndex 2 is a null (empty) DEF slot per makeDraftView's lineupSlots fixture.
    const emptySlot = container.querySelector('[data-slot-index="2"]');
    expect(emptySlot).not.toBeNull();

    fireEvent.click(emptySlot!);

    expect(onDraftPick).toHaveBeenCalledWith('p013', { type: 'slot', slotIndex: 2 });
  });
});

describe('LineupAssignmentScreen — D-12: waiting-for-opponent state', () => {
  it('disables the draft-pack row and shows the waiting text', () => {
    const { container } = render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView({ waitingForOpponent: true })}
        onDraftPick={NOOP}
        onDraftRearrange={NOOP}
      />,
    );

    expect(screen.getByText('Waiting for Visitor Player to pick…')).toBeDefined();
    // Scoped to the draft-pack row specifically — gap-closure 29-08 gives
    // BenchCarousel its own "Previous card"/"Next card" nav buttons too
    // (DRAFT-09/D-21), so an unscoped screen-level query is now ambiguous.
    const draftPackRow = container.querySelector('[class*="draftPackRow"]') as HTMLElement;
    expect(draftPackRow).not.toBeNull();
    const prevBtn = within(draftPackRow).getByLabelText('Previous card');
    expect(prevBtn.closest('[class*="draftRowDisabled"]')).not.toBeNull();
  });
});

describe('LineupAssignmentScreen — D-20 (Phase 30): round/pick counter', () => {
  it('renders "Round 2 of 6 · Pick 1 of 3" for a tiered round (round 2, 3 picks/round)', () => {
    render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView()}
        onDraftPick={NOOP}
        onDraftRearrange={NOOP}
      />,
    );

    expect(screen.getByText('Round 2 of 6 · Pick 1 of 3')).toBeDefined();
  });

  it('renders "GK Round" (not "Round 1 of 6") for round 1, with 2 picks/round', () => {
    render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView({ round: 1, picksRemaining: 2 })}
        onDraftPick={NOOP}
        onDraftRearrange={NOOP}
      />,
    );

    expect(screen.getByText('GK Round · Pick 2 of 2')).toBeDefined();
    expect(screen.queryByText(/Round 1 of 6/)).toBeNull();
  });
});

/** All 11 starting lineup slots filled — a complete lineup, paired with
 * draftComplete: true (gap-closure 29-08: Confirm now also requires this). */
const FULL_LINEUP: (string | null)[] = [
  'p001',
  'p002',
  'p003',
  'p004',
  'p005',
  'p006',
  'p007',
  'p008',
  'p009',
  'p010',
  'p011',
];

describe('LineupAssignmentScreen — D-23: draft-complete hand-off', () => {
  it('hides the DraftPackCarousel and shows the Confirm button when draftComplete is true and the lineup is full', () => {
    const { container } = render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView({ draftComplete: true, lineupSlots: FULL_LINEUP })}
        onDraftPick={NOOP}
        onDraftRearrange={NOOP}
      />,
    );

    expect(container.querySelector(`.${TIER_CARD_CLASS.chase}`)).toBeNull();
    expect(screen.getByLabelText('Confirm lineup')).toBeDefined();
  });
});

describe('LineupAssignmentScreen — DRAFT-09 gap-closure: Confirm gated on a complete lineup', () => {
  it('renders a disabled not-ready Confirm button and shows helper copy when draftComplete is true but a lineup slot is still null', () => {
    render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView({ draftComplete: true })}
        onDraftPick={NOOP}
        onDraftRearrange={NOOP}
      />,
    );

    const confirmBtn = screen.getByLabelText('Confirm lineup');
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Fill all 11 lineup positions to confirm.')).toBeDefined();
  });

  it('renders the Confirm button and calls onConfirm when all 11 lineup slots are filled', () => {
    const onConfirm = vi.fn();
    render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={onConfirm}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView({ draftComplete: true, lineupSlots: FULL_LINEUP })}
        onDraftPick={NOOP}
        onDraftRearrange={NOOP}
      />,
    );

    const confirmBtn = screen.getByLabelText('Confirm lineup');
    expect(confirmBtn).toBeDefined();
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith(FULL_LINEUP);
  });
});

describe('LineupAssignmentScreen — DRAFT-09 gap-closure: selection clears after a completed pick (no wedge)', () => {
  it('after a pack-sourced pick completes, a subsequent lone click on a different empty slot does not call onDraftPick again, and a fresh pick still completes normally', () => {
    const onDraftPick = vi.fn();
    const { container } = render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView()}
        onDraftPick={onDraftPick}
        onDraftRearrange={NOOP}
      />,
    );

    const packCard = container.querySelector(`.${TIER_CARD_CLASS.chase}`) as HTMLElement;
    expect(packCard).not.toBeNull();

    fireEvent.click(packCard);
    const emptySlot = container.querySelector('[data-slot-index="2"]') as HTMLElement;
    expect(emptySlot).not.toBeNull();
    fireEvent.click(emptySlot);
    expect(onDraftPick).toHaveBeenCalledTimes(1);
    expect(onDraftPick).toHaveBeenCalledWith('p013', { type: 'slot', slotIndex: 2 });

    // The completed pick must clear the selection — a lone click on a different
    // empty slot (nothing selected anymore) must NOT call onDraftPick again.
    // This replaces the old pointer-cancel-based wedge test with the
    // click-model equivalent invariant: no stale selection state blocks
    // future actions.
    const anotherEmptySlot = container.querySelector('[data-slot-index="3"]') as HTMLElement;
    fireEvent.click(anotherEmptySlot);
    expect(onDraftPick).toHaveBeenCalledTimes(1);

    // A fresh select-then-complete cycle on a different card/slot still works —
    // proves no stale state from the first pick ever wedged the interaction.
    const packCard2 = container.querySelector(`.${TIER_CARD_CLASS.rare}`) as HTMLElement;
    fireEvent.click(packCard2);
    fireEvent.click(anotherEmptySlot);
    expect(onDraftPick).toHaveBeenCalledTimes(2);
    expect(onDraftPick).toHaveBeenLastCalledWith('p014', { type: 'slot', slotIndex: 3 });
  });
});

describe('LineupAssignmentScreen — D-23 (Phase 30): tier border on starting-11 lineup slot cards', () => {
  it('applies a TIER_CARD_CLASS tier-color class to filled starting-11 lineup slot cards', () => {
    const { container } = render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
        draftMode
        draftView={makeDraftView()}
        onDraftPick={NOOP}
        onDraftRearrange={NOOP}
      />,
    );

    // makeDraftView's lineupSlots fixture fills slot 0 (GK, p001) and slot 1 (DEF, p002) —
    // both should render with one of the 4 TIER_CARD_CLASS tier-color classes (D-23), scoped
    // to the formation grid so pack/bench cards elsewhere don't produce a false positive.
    const grid = container.querySelector('[class*="formationColumns"]');
    expect(grid).not.toBeNull();
    const tierSelector = [
      TIER_CARD_CLASS.chase,
      TIER_CARD_CLASS.rare,
      TIER_CARD_CLASS.uncommon,
      TIER_CARD_CLASS.common,
    ]
      .map((c) => `.${c}`)
      .join(', ');
    const tierCardsInGrid = grid!.querySelectorAll(tierSelector);
    expect(tierCardsInGrid.length).toBeGreaterThan(0);
  });
});

/** Task 1 (Phase 47, plan 04): renderDraft — a shared helper for the new
 * click-select draft-mode coverage below, reusing makeDraftView's default
 * fixture (pack: p013 chase/p014 rare/p015 uncommon/p016-p018/p012 common;
 * lineupSlots: p001 GK at 0, p002 DEF at 1, rest null; bench: p003, p004). */
function renderDraft(
  overrides: {
    draftView?: DraftClientView;
    onDraftPick?: (cardId: string, destination: DraftDestination) => void;
    onDraftRearrange?: (from: DraftSlotRef, to: DraftSlotRef) => void;
    lineupConfirmed?: boolean;
  } = {},
) {
  return render(
    <LineupAssignmentScreen
      assignment={[]}
      formationId="4-4-2"
      playerSlot={1}
      myTeamId="city"
      onSwap={NOOP}
      onConfirm={NOOP}
      lineupConfirmed={overrides.lineupConfirmed ?? false}
      draftMode
      draftView={overrides.draftView ?? makeDraftView()}
      onDraftPick={overrides.onDraftPick ?? NOOP}
      onDraftRearrange={overrides.onDraftRearrange ?? NOOP}
    />,
  );
}

describe('LineupAssignmentScreen — Phase 47 draft-mode click-select (ROSTER-01/02/03/04/08, D-11)', () => {
  it('1. clicking a pack card applies a class matching /statCardSelected/ to that card, and to no other card', () => {
    const { container } = renderDraft();
    const packCard = container.querySelector(`.${TIER_CARD_CLASS.chase}`) as HTMLElement;
    fireEvent.click(packCard);
    expect(packCard.className).toMatch(/statCardSelected/);
    const others = Array.from(container.querySelectorAll('[data-roster-card]')).filter(
      (el) => el !== packCard,
    );
    others.forEach((el) => expect(el.className).not.toMatch(/statCardSelected/));
  });

  it('2. with a pack card selected, every lineup slot except the GK slot, and the bench carousel carry /statCardEligible/', () => {
    const { container } = renderDraft();
    const packCard = container.querySelector(`.${TIER_CARD_CLASS.chase}`) as HTMLElement;
    fireEvent.click(packCard);

    const grid = container.querySelector('[class*="formationColumns"]') as HTMLElement;
    const eligibleInGrid = grid.querySelectorAll('[class*="statCardEligible"]');
    // Slot 0 (GK, p001) is excluded because a non-GK card is selected, leaving
    // 1 filled slot (p002) + 9 empty slots = 10 eligible targets in the grid.
    expect(eligibleInGrid.length).toBe(10);

    const bench = screen.getByTestId('bench-carousel');
    expect(bench.className).toMatch(/statCardEligible/);
  });

  it('3. clicking the selected pack card again clears the selection: no element carries /statCardSelected/ or /statCardEligible/', () => {
    const { container } = renderDraft();
    const packCard = container.querySelector(`.${TIER_CARD_CLASS.chase}`) as HTMLElement;
    fireEvent.click(packCard);
    fireEvent.click(packCard);
    expect(container.querySelector('[class*="statCardSelected"]')).toBeNull();
    expect(container.querySelector('[class*="statCardEligible"]')).toBeNull();
  });

  it('4. clicking a different pack card while one is selected switches the selection (D-11), never calling onDraftPick', () => {
    const onDraftPick = vi.fn();
    const { container } = renderDraft({ onDraftPick });
    const packCard1 = container.querySelector(`.${TIER_CARD_CLASS.chase}`) as HTMLElement;
    const packCard2 = container.querySelector(`.${TIER_CARD_CLASS.rare}`) as HTMLElement;
    fireEvent.click(packCard1);
    fireEvent.click(packCard2);
    expect(packCard2.className).toMatch(/statCardSelected/);
    expect(packCard1.className).not.toMatch(/statCardSelected/);
    expect(onDraftPick).not.toHaveBeenCalled();
  });

  it('5. pack card then the bench container calls onDraftPick once with a bench destination', () => {
    const onDraftPick = vi.fn();
    const { container } = renderDraft({ onDraftPick });
    const packCard = container.querySelector(`.${TIER_CARD_CLASS.chase}`) as HTMLElement;
    fireEvent.click(packCard);
    fireEvent.click(screen.getByTestId('bench-carousel'));
    expect(onDraftPick).toHaveBeenCalledTimes(1);
    expect(onDraftPick).toHaveBeenCalledWith('p013', { type: 'bench' });
  });

  it('6. filled slot then another slot calls onDraftRearrange with slot->slot, never onDraftPick', () => {
    const onDraftRearrange = vi.fn();
    const onDraftPick = vi.fn();
    const { container } = renderDraft({ onDraftRearrange, onDraftPick });
    const p002 = PLAYER_BY_ID.get('p002')!;
    const slot1Card = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(slot1Card);
    const emptySlot2 = container.querySelector('[data-slot-index="2"]') as HTMLElement;
    fireEvent.click(emptySlot2);
    expect(onDraftRearrange).toHaveBeenCalledTimes(1);
    expect(onDraftRearrange).toHaveBeenCalledWith(
      { type: 'slot', slotIndex: 1 },
      { type: 'slot', slotIndex: 2 },
    );
    expect(onDraftPick).not.toHaveBeenCalled();
  });

  it('7. filled slot then the bench container calls onDraftRearrange with slot->bench (append position)', () => {
    const onDraftRearrange = vi.fn();
    renderDraft({ onDraftRearrange });
    const p002 = PLAYER_BY_ID.get('p002')!;
    const slot1Card = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(slot1Card);
    fireEvent.click(screen.getByTestId('bench-carousel'));
    expect(onDraftRearrange).toHaveBeenCalledWith(
      { type: 'slot', slotIndex: 1 },
      { type: 'bench', benchIndex: 2 },
    );
  });

  it('8. a bench card then an empty slot calls onDraftRearrange with bench->slot', () => {
    const onDraftRearrange = vi.fn();
    const { container } = renderDraft({ onDraftRearrange });
    const p003 = PLAYER_BY_ID.get('p003')!;
    const benchCard = screen
      .getByText(`${p003.firstName} ${p003.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const emptySlot2 = container.querySelector('[data-slot-index="2"]') as HTMLElement;
    fireEvent.click(emptySlot2);
    expect(onDraftRearrange).toHaveBeenCalledWith(
      { type: 'bench', benchIndex: 0 },
      { type: 'slot', slotIndex: 2 },
    );
  });

  it('9. with a bench card selected, the bench container itself is not an eligible target and a click on it calls neither callback (bench->bench no-op)', () => {
    const onDraftPick = vi.fn();
    const onDraftRearrange = vi.fn();
    renderDraft({ onDraftPick, onDraftRearrange });
    const p003 = PLAYER_BY_ID.get('p003')!;
    const benchCard = screen
      .getByText(`${p003.firstName} ${p003.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const bench = screen.getByTestId('bench-carousel');
    expect(bench.className).not.toMatch(/statCardEligible/);
    fireEvent.click(bench);
    expect(onDraftPick).not.toHaveBeenCalled();
    expect(onDraftRearrange).not.toHaveBeenCalled();
  });

  it('10. clicking the selected slot card again deselects it (ROSTER-03)', () => {
    const { container } = renderDraft();
    const p002 = PLAYER_BY_ID.get('p002')!;
    const slot1Card = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(slot1Card);
    expect(slot1Card.className).toMatch(/statCardSelected/);
    fireEvent.click(slot1Card);
    expect(slot1Card.className).not.toMatch(/statCardSelected/);
    expect(container.querySelector('[class*="statCardEligible"]')).toBeNull();
  });

  it('11. GK-from-slot: a GK selected from its filled lineup slot leaves NO slot eligible; only the bench is', () => {
    const { container } = renderDraft();
    const p001 = PLAYER_BY_ID.get('p001')!;
    const gkSlotCard = screen
      .getByText(`${p001.firstName} ${p001.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(gkSlotCard);
    expect(gkSlotCard.className).toMatch(/statCardSelected/);

    // Slot 0 is excluded as the selection's own origin slot; slots 1-10 are
    // excluded by the GK rule (a GK card fits only slot 0).
    const grid = container.querySelector('[class*="formationColumns"]') as HTMLElement;
    const eligibleInGrid = grid.querySelectorAll('[class*="statCardEligible"]');
    expect(eligibleInGrid.length).toBe(0);

    const bench = screen.getByTestId('bench-carousel');
    expect(bench.className).toMatch(/statCardEligible/);
  });

  it('12. GK-from-pack: only the GK slot and the bench are eligible', () => {
    const { container } = renderDraft();
    const p012 = PLAYER_BY_ID.get('p012')!;
    const gkPackCard = screen
      .getByText(`${p012.firstName} ${p012.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(gkPackCard);

    const grid = container.querySelector('[class*="formationColumns"]') as HTMLElement;
    const eligibleInGrid = grid.querySelectorAll('[class*="statCardEligible"]');
    expect(eligibleInGrid.length).toBe(1);

    const p001 = PLAYER_BY_ID.get('p001')!;
    const gkSlotCard = screen
      .getByText(`${p001.firstName} ${p001.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    expect(eligibleInGrid[0]).toBe(gkSlotCard);

    const bench = screen.getByTestId('bench-carousel');
    expect(bench.className).toMatch(/statCardEligible/);
  });

  it('13. GK-from-bench: only the GK slot is eligible; the bench itself is not', () => {
    const { container } = renderDraft({
      draftView: makeDraftView({ benchIds: ['p023', 'p004'] }),
    });
    const p023 = PLAYER_BY_ID.get('p023')!;
    const gkBenchCard = screen
      .getByText(`${p023.firstName} ${p023.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(gkBenchCard);

    const grid = container.querySelector('[class*="formationColumns"]') as HTMLElement;
    const eligibleInGrid = grid.querySelectorAll('[class*="statCardEligible"]');
    expect(eligibleInGrid.length).toBe(1);

    const p001 = PLAYER_BY_ID.get('p001')!;
    const gkSlotCard = screen
      .getByText(`${p001.firstName} ${p001.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    expect(eligibleInGrid[0]).toBe(gkSlotCard);

    // Bench-sourced selections can never target the bench — existing rule,
    // re-proven here for the GK case.
    const bench = screen.getByTestId('bench-carousel');
    expect(bench.className).not.toMatch(/statCardEligible/);
  });

  it('14. non-GK from the pack: the GK slot is never eligible and clicking it is a silent no-op', () => {
    const onDraftPick = vi.fn();
    const onDraftRearrange = vi.fn();
    const { container } = renderDraft({ onDraftPick, onDraftRearrange });
    const nonGkPackCard = container.querySelector(`.${TIER_CARD_CLASS.chase}`) as HTMLElement;
    fireEvent.click(nonGkPackCard);

    const p001 = PLAYER_BY_ID.get('p001')!;
    const gkSlotCard = screen
      .getByText(`${p001.firstName} ${p001.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    expect(gkSlotCard.className).not.toMatch(/statCardEligible/);

    fireEvent.click(gkSlotCard);
    expect(onDraftPick).not.toHaveBeenCalled();
    expect(onDraftRearrange).not.toHaveBeenCalled();
    // D-04 silent no-op replaces the old client-side rejection message.
    expect(
      screen.queryByText('Swap rejected — only a goalkeeper card can be placed here.'),
    ).toBeNull();
  });

  it('15. non-GK from the bench: the GK slot is never eligible', () => {
    renderDraft();
    const p003 = PLAYER_BY_ID.get('p003')!;
    const nonGkBenchCard = screen
      .getByText(`${p003.firstName} ${p003.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(nonGkBenchCard);

    const p001 = PLAYER_BY_ID.get('p001')!;
    const gkSlotCard = screen
      .getByText(`${p001.firstName} ${p001.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    expect(gkSlotCard.className).not.toMatch(/statCardEligible/);
  });

  it('16. non-GK from another slot: the GK slot is never eligible', () => {
    renderDraft();
    const p002 = PLAYER_BY_ID.get('p002')!;
    const nonGkSlotCard = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(nonGkSlotCard);

    const p001 = PLAYER_BY_ID.get('p001')!;
    const gkSlotCard = screen
      .getByText(`${p001.firstName} ${p001.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    expect(gkSlotCard.className).not.toMatch(/statCardEligible/);
  });

  it('17. waitingForOpponent true: clicking a pack card does not select it', () => {
    const { container } = renderDraft({ draftView: makeDraftView({ waitingForOpponent: true }) });
    const packCard = container.querySelector(`.${TIER_CARD_CLASS.chase}`) as HTMLElement;
    fireEvent.click(packCard);
    expect(packCard.className).not.toMatch(/statCardSelected/);
  });
});

describe('LineupAssignmentScreen — Standard-mode non-regression', () => {
  it('renders the 4 formation columns and Confirm button unchanged when draftMode is falsy', () => {
    const assignment = [
      'p001',
      'p002',
      'p003',
      'p004',
      'p005',
      'p006',
      'p007',
      'p008',
      'p009',
      'p010',
      'p011',
    ];

    const { container } = render(
      <LineupAssignmentScreen
        assignment={assignment}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
      />,
    );

    const columnHeaders = Array.from(container.querySelectorAll('[class*="columnHeader"]')).map(
      (el) => el.textContent,
    );
    expect(columnHeaders).toEqual(['GK', 'DEF', 'MID', 'FWD']);
    expect(screen.getByLabelText('Confirm lineup')).toBeDefined();
    expect(screen.getByText('MATCH SETUP: STEP 3 — HOME PLAYER (YOU)')).toBeDefined();
  });

  it('ICON-02: a pregame lineup card renders no badge markup (no card/injury data is passed)', () => {
    const assignment = [
      'p001',
      'p002',
      'p003',
      'p004',
      'p005',
      'p006',
      'p007',
      'p008',
      'p009',
      'p010',
      'p011',
    ];

    const { container } = render(
      <LineupAssignmentScreen
        assignment={assignment}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
      />,
    );

    expect(container.querySelector('[data-testid="card-injury-badge"]')).toBeNull();
  });

  /* CLEANUP bug fix: the Step 3 bench section previously rendered 5 inert placeholder
   * divs with no data (D-17: "structural only in v1.3"). Standard-mode teams always have
   * exactly 11 players (no squad remainder), so the bench is now wired to the Phase 46
   * generic placeholder bench for the player's own side, client-side, before confirm. */
  it("CLEANUP: Step 3's bench section shows the 5 generic placeholder bench players for the player's side", () => {
    const assignment = [
      'p001',
      'p002',
      'p003',
      'p004',
      'p005',
      'p006',
      'p007',
      'p008',
      'p009',
      'p010',
      'p011',
    ];

    const { container: homeContainer } = render(
      <LineupAssignmentScreen
        assignment={assignment}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
      />,
    );
    expect(homeContainer.textContent).toContain('Jack Sullivan');
    expect(homeContainer.textContent).not.toContain('Tomas Novak');

    const { container: awayContainer } = render(
      <LineupAssignmentScreen
        assignment={assignment}
        formationId="4-4-2"
        playerSlot={2}
        myTeamId="crew"
        onSwap={NOOP}
        onConfirm={NOOP}
        lineupConfirmed={false}
      />,
    );
    expect(awayContainer.textContent).toContain('Tomas Novak');
    expect(awayContainer.textContent).not.toContain('Jack Sullivan');
  });
});

/** Task 2 (Phase 47, plan 04): a full 11-player Standard-mode assignment, and a
 * render helper for the new ROSTER-07 pregame click-to-swap coverage below.
 * Slot indices follow FORMATIONS['4-4-2'].slots ordering — slot 0 is always GK. */
const PREGAME_ASSIGNMENT: string[] = [
  'p001',
  'p002',
  'p003',
  'p004',
  'p005',
  'p006',
  'p007',
  'p008',
  'p009',
  'p010',
  'p011',
];

function renderPregame(
  overrides: { lineupConfirmed?: boolean; onSwap?: (a: number, b: number) => void } = {},
) {
  return render(
    <LineupAssignmentScreen
      assignment={PREGAME_ASSIGNMENT}
      formationId="4-4-2"
      playerSlot={1}
      myTeamId="city"
      onSwap={overrides.onSwap ?? NOOP}
      onConfirm={NOOP}
      lineupConfirmed={overrides.lineupConfirmed ?? false}
    />,
  );
}

describe('LineupAssignmentScreen — ROSTER-07: Standard pregame click-to-swap', () => {
  it('1. clicking an outfield card applies /statCardSelected/ to its wrapper', () => {
    renderPregame();
    const p002 = PLAYER_BY_ID.get('p002')!;
    const card = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card);
    expect(card.className).toMatch(/statCardSelected/);
  });

  it('2. with a card selected, every other outfield card carries /statCardEligible/, and the GK card does not', () => {
    const { container } = renderPregame();
    const p002 = PLAYER_BY_ID.get('p002')!;
    const card = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card);

    const grid = container.querySelector('[class*="formationColumns"]') as HTMLElement;
    // 11 total cards - 1 selected - 1 GK (never an eligible target) = 9.
    expect(grid.querySelectorAll('[class*="statCardEligible"]').length).toBe(9);

    const p001 = PLAYER_BY_ID.get('p001')!;
    const gkCard = screen
      .getByText(`${p001.firstName} ${p001.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    expect(gkCard.className).not.toMatch(/statCardEligible/);
  });

  it('3. clicking a second outfield card calls onSwap exactly once with (sourceSlotIndex, targetSlotIndex) and clears the selection', () => {
    const onSwap = vi.fn();
    const { container } = renderPregame({ onSwap });
    const p002 = PLAYER_BY_ID.get('p002')!;
    const p003 = PLAYER_BY_ID.get('p003')!;
    const card1 = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    const card2 = screen
      .getByText(`${p003.firstName} ${p003.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card1);
    fireEvent.click(card2);
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onSwap).toHaveBeenCalledWith(1, 2);
    expect(container.querySelector('[class*="statCardSelected"]')).toBeNull();
    expect(container.querySelector('[class*="statCardEligible"]')).toBeNull();
  });

  it('4. clicking the selected card again deselects it and clears every highlight; onSwap is not called (ROSTER-03)', () => {
    const onSwap = vi.fn();
    const { container } = renderPregame({ onSwap });
    const p002 = PLAYER_BY_ID.get('p002')!;
    const card = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card);
    fireEvent.click(card);
    expect(card.className).not.toMatch(/statCardSelected/);
    expect(container.querySelector('[class*="statCardEligible"]')).toBeNull();
    expect(onSwap).not.toHaveBeenCalled();
  });

  it('5. the GK card is never selectable; clicking it while another card is selected calls neither onSwap nor clears the selection (D-04)', () => {
    const onSwap = vi.fn();
    renderPregame({ onSwap });
    const p001 = PLAYER_BY_ID.get('p001')!;
    const gkCard = screen
      .getByText(`${p001.firstName} ${p001.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(gkCard);
    expect(gkCard.className).not.toMatch(/statCardSelected/);

    const p002 = PLAYER_BY_ID.get('p002')!;
    const outfieldCard = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(outfieldCard);
    fireEvent.click(gkCard);
    expect(onSwap).not.toHaveBeenCalled();
    expect(outfieldCard.className).toMatch(/statCardSelected/);
  });

  it('6. when lineupConfirmed is true, clicking any card neither selects it nor calls onSwap', () => {
    const onSwap = vi.fn();
    renderPregame({ onSwap, lineupConfirmed: true });
    const p002 = PLAYER_BY_ID.get('p002')!;
    const card = screen
      .getByText(`${p002.firstName} ${p002.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card);
    expect(card.className).not.toMatch(/statCardSelected/);
    expect(onSwap).not.toHaveBeenCalled();
  });

  it('NUMBER-01: the standard pregame bench renders no jersey number (none is assigned until LINEUP_CONFIRM)', () => {
    const { container } = renderPregame();
    const benchSection = container.querySelector('[class*="benchSection"]') as HTMLElement;
    expect(benchSection).not.toBeNull();
    // No #n jersey number anywhere on the bench — the server hasn't drawn one yet.
    expect(benchSection.querySelectorAll('[class*="cardNum"]').length).toBe(0);
    // The five placeholder bench players still render by name.
    expect(benchSection.querySelectorAll('[data-roster-card]').length).toBe(5);
    const genericBenchPlayer = getGenericBenchPlayers('home')[0]!;
    expect(benchSection.textContent).toContain(
      `${genericBenchPlayer.firstName} ${genericBenchPlayer.lastName}`,
    );
    // The eleven slot-derived starting-XI numbers (D-01) are untouched, outside the bench.
    expect(container.querySelectorAll('[class*="cardNum"]').length).toBeGreaterThanOrEqual(11);
  });
});

/* ─── Phase 40 (40-03): mid-match substitution mode (SUB-02/03/06/07, D-12/D-13) ──────── */

function makePiece(
  overrides: Partial<PlayerPiece> &
    Pick<PlayerPiece, 'id' | 'playerId' | 'role' | 'number' | 'firstName' | 'lastName'>,
): PlayerPiece {
  return {
    teamId: 'home',
    position: { q: 10, r: 10 },
    pace: 5,
    shooting: 5,
    tackling: 5,
    dribbling: 5,
    saving: 5,
    handling: 5,
    resilience: 5,
    aerialAbility: 5,
    highPass: 5,
    nationality: 'Canada',
    ...overrides,
  };
}

/** 11-piece home XI, ids matching the REAL gameEngine.ts slot-identity convention
 * (`${team}-${slotIndex}`, 0-indexed, aligned to FORMATIONS['4-4-2'].slots — see
 * buildSquadPieces/applySubstitution) rather than arbitrary 1-indexed test ids, because
 * the mid-match column grouping now derives each piece's column from its SLOT (parsed
 * from `id`), not from `piece.role` (checkpoint gap-closure, 40-07 Task 2 human-verify
 * feedback). 4-4-2 slot map: 0=GK, 1-4=DEF, 5-8=MID, 9-10=FWD.
 *
 * `home-8` (a MID slot) deliberately carries `role: 'FWD'` — this is the regression
 * fixture for the formation-shape bug: a forward who has been substituted into a
 * midfield slot must still render in the MID column (preserving the 4-4-2 shape),
 * never in the FWD column just because that's their own playing specialism. `home-10`
 * (the true FWD-central/ST slot) keeps `role: 'ST'` so the pre-existing "ST renders in
 * the FWD column" coverage is preserved (both role- and slot-based grouping agree here). */
// Phase 42 gap item 6 (Task 2 action D): every piece below now carries an explicit,
// distinct `position` (q incrementing by slot index, all on the r=10 row) rather than
// relying on `makePiece`'s shared `{ q: 10, r: 10 }` default. Real game state never
// places two ACTIVE pieces on one hex, so the fixture now mirrors that invariant —
// the previous shared-default fixture accidentally colocated every piece (including
// the red-carded `home-4`) on the same hex, which made the new own-team hex-occupancy
// pre-gate (`ownActiveHexKeys`) spuriously report every active piece as standing on
// the SENT OFF slot's frozen hex. `home-4`'s frozen hex (`{ q: 14, r: 10 }`) is free
// by default, matching the pre-existing D-05 tests' expectation; the new gap-item-6
// describe block below explicitly relocates a piece onto it to exercise the guard.
const HOME_TEAM_PIECES: PlayerPiece[] = [
  makePiece({
    id: 'home-0',
    playerId: 'p001',
    role: 'GK',
    number: 1,
    firstName: 'Home',
    lastName: 'Keeper',
    position: { q: 10, r: 10 },
  }),
  makePiece({
    id: 'home-1',
    playerId: 'p002',
    role: 'DEF',
    number: 2,
    firstName: 'Home',
    lastName: 'DefOne',
    position: { q: 11, r: 10 },
  }),
  makePiece({
    id: 'home-2',
    playerId: 'p003',
    role: 'DEF',
    number: 3,
    firstName: 'Home',
    lastName: 'DefTwo',
    position: { q: 12, r: 10 },
  }),
  makePiece({
    id: 'home-3',
    playerId: 'p004',
    role: 'DEF',
    number: 4,
    firstName: 'Home',
    lastName: 'DefThree',
    position: { q: 13, r: 10 },
  }),
  makePiece({
    id: 'home-4',
    playerId: 'p005',
    role: 'DEF',
    number: 5,
    firstName: 'Home',
    lastName: 'DefRedCarded',
    redCarded: true,
    position: { q: 14, r: 10 },
  }),
  makePiece({
    id: 'home-5',
    playerId: 'p006',
    role: 'MID',
    number: 6,
    firstName: 'Home',
    lastName: 'MidOne',
    position: { q: 15, r: 10 },
  }),
  makePiece({
    id: 'home-6',
    playerId: 'p007',
    role: 'MID',
    number: 7,
    firstName: 'Home',
    lastName: 'MidYellow',
    yellowCards: 1,
    position: { q: 16, r: 10 },
  }),
  makePiece({
    id: 'home-7',
    playerId: 'p008',
    role: 'MID',
    number: 8,
    firstName: 'Home',
    lastName: 'MidInjuredOnce',
    injuryCount: 1,
    position: { q: 17, r: 10 },
  }),
  makePiece({
    id: 'home-8',
    playerId: 'p009',
    role: 'FWD', // deliberately mismatched vs. its MID slot — see fixture doc above
    number: 9,
    firstName: 'Home',
    lastName: 'FwdInjuredTwice',
    injuryCount: 2,
    position: { q: 18, r: 10 },
  }),
  makePiece({
    id: 'home-9',
    playerId: 'p010',
    role: 'FWD',
    number: 10,
    firstName: 'Home',
    lastName: 'FwdOne',
    position: { q: 19, r: 10 },
  }),
  makePiece({
    id: 'home-10',
    playerId: 'p011',
    role: 'ST',
    number: 11,
    firstName: 'Home',
    lastName: 'Striker',
    position: { q: 20, r: 10 },
  }),
];

/** Real PLAYER_POOL ids so PLAYER_MAP/resolveTieredCard lookups resolve (Task 1 read_first). */
const BENCH_MIXED: BenchEntry[] = [
  { playerId: 'p013', jerseyNumber: 13, status: 'available' },
  { playerId: 'p014', jerseyNumber: 14, status: 'subbedOut' },
  { playerId: 'p015', jerseyNumber: 15, status: 'redCarded' },
];

const BENCH_ONLY_UNAVAILABLE: BenchEntry[] = [
  { playerId: 'p014', jerseyNumber: 14, status: 'subbedOut' },
  { playerId: 'p015', jerseyNumber: 15, status: 'redCarded' },
];

/** Phase 47 (D-07): two AVAILABLE bench entries — BENCH_MIXED only has one,
 * which is insufficient to prove a bench-to-bench selection switch. */
const BENCH_TWO_AVAILABLE: BenchEntry[] = [
  { playerId: 'p013', jerseyNumber: 13, status: 'available' },
  { playerId: 'p016', jerseyNumber: 16, status: 'available' },
];

/** Phase 41 (ICON-03): real PLAYER_POOL ids so PLAYER_MAP/resolveTieredCard lookups
 * resolve, proving the BenchEntry -> glyph derivation is really wired end-to-end. */
const BENCH_WITH_STATUS: BenchEntry[] = [
  { playerId: 'p013', jerseyNumber: 13, status: 'available' },
  { playerId: 'p014', jerseyNumber: 14, status: 'subbedOut', yellowCards: 1, injuryCount: 1 },
  { playerId: 'p015', jerseyNumber: 15, status: 'redCarded', injuryCount: 0 },
];

type MidmatchOverrides = {
  midmatchPieces?: PlayerPiece[];
  bench?: BenchEntry[];
  subsUsed?: number;
  maxOnPitch?: number;
  onSubstitute?: (outPieceId: string, inPlayerId: string) => void;
  /** Checkpoint gap-closure (40-07 Task 2 human-verify feedback): defaults to false/
   * undefined in every existing call so pre-existing tests are unaffected. */
  readOnly?: boolean;
  /** Phase 42 (SUB-08): fires on a positioning-mode drop. Defaults to NOOP so
   * every pre-existing call is unaffected. */
  onReposition?: (pieceIdA: string, pieceIdB: string) => void;
  /** Phase 42 (SUB-09): defaults to false/undefined so pre-existing calls are
   * unaffected. */
  actionPending?: boolean;
  /** Gap-closure (42-12 Task 2E): defaults to undefined (omitted) so every
   * pre-existing call renders exactly as before — no Resume button. */
  onResume?: () => void;
};

function renderMidmatch(overrides: MidmatchOverrides = {}) {
  return render(
    <LineupAssignmentScreen
      assignment={[]}
      formationId="4-4-2"
      playerSlot={1}
      myTeamId="city"
      onSwap={NOOP}
      onConfirm={NOOP}
      lineupConfirmed={false}
      mode="midmatch"
      midmatchPieces={overrides.midmatchPieces ?? HOME_TEAM_PIECES}
      bench={overrides.bench ?? BENCH_MIXED}
      subsUsed={overrides.subsUsed ?? 0}
      maxOnPitch={overrides.maxOnPitch ?? 11}
      onSubstitute={overrides.onSubstitute ?? NOOP}
      readOnly={overrides.readOnly ?? false}
      onReposition={overrides.onReposition ?? NOOP}
      actionPending={overrides.actionPending ?? false}
      {...(overrides.onResume !== undefined ? { onResume: overrides.onResume } : {})}
    />,
  );
}

describe('LineupAssignmentScreen — mid-match substitution mode (SUB-02/03/06/07, D-12/D-13)', () => {
  it('SUB-02: groups on-pitch pieces into GK/DEF/MID/FWD columns, with ST pieces rendering in the FWD column', () => {
    const { container } = renderMidmatch();
    const headers = Array.from(container.querySelectorAll('[class*="columnHeader"]'));
    expect(headers.map((h) => h.textContent)).toEqual(['GK', 'DEF', 'MID', 'FWD']);

    const fwdHeader = headers.find((h) => h.textContent === 'FWD');
    expect(fwdHeader?.parentElement?.textContent).toContain('Home Striker');
    const gkHeader = headers.find((h) => h.textContent === 'GK');
    expect(gkHeader?.parentElement?.textContent).toContain('Home Keeper');
  });

  /* CLEANUP bug fix: isGK in mid-match mode was hard-coded to `!isMidmatch && slotIndex
   * === 0`, which is always false in mid-match (slotIndex there is the per-column render
   * index, not a formation-slot index) — the actual goalkeeper's roster/substitution card
   * silently showed the outfield stat set (SHOOTING/PASSING) instead of SAVE/HANDLING. */
  it('mid-match GK card shows SAVE/HANDLING, not SHOOTING/PASSING; an outfield card shows the reverse', () => {
    const { container } = renderMidmatch();
    const headers = Array.from(container.querySelectorAll('[class*="columnHeader"]'));
    const gkCard = headers.find((h) => h.textContent === 'GK')?.parentElement;
    expect(gkCard?.textContent).toContain('SAVE');
    expect(gkCard?.textContent).toContain('HANDLING');
    expect(gkCard?.textContent).not.toContain('SHOOTING');
    expect(gkCard?.textContent).not.toContain('PASSING');

    const defCard = headers.find((h) => h.textContent === 'DEF')?.parentElement;
    expect(defCard?.textContent).toContain('SHOOTING');
    expect(defCard?.textContent).toContain('PASSING');
    expect(defCard?.textContent).not.toContain('SAVE');
    expect(defCard?.textContent).not.toContain('HANDLING');
  });

  /* Checkpoint gap-closure (40-07 Task 2 human-verify feedback): regression coverage for
   * the formation-shape bug — "in a 4-4-2 if a mid is in the 5 and is replaced with a FWD
   * then the new lineup will show as a 4-3-3 instead of the selected lineup." Grouping must
   * key off the piece's fixed formation SLOT (from its id's slot-identity suffix), never off
   * `piece.role` (the occupant's own specialism), or a substitute re-shuffles the visible
   * formation shape purely because their own natural position differs from the vacated slot. */
  it('formation-shape regression: a FWD-role piece occupying a MID slot renders in the MID column, not the FWD column (4-4-2 shape preserved)', () => {
    const { container } = renderMidmatch();
    const headers = Array.from(container.querySelectorAll('[class*="columnHeader"]'));

    const midHeader = headers.find((h) => h.textContent === 'MID');
    const fwdHeader = headers.find((h) => h.textContent === 'FWD');

    // home-8 is a MID slot (4-4-2 slot index 8) occupied by a piece whose own `role` is
    // 'FWD' — it must render in the MID column (preserving 4 DEF / 4 MID / 2 FWD), not the
    // FWD column (which would collapse the shape to a 4-3-3-looking 4/3/4 split).
    expect(midHeader?.parentElement?.textContent).toContain('Home FwdInjuredTwice');
    expect(fwdHeader?.parentElement?.textContent).not.toContain('Home FwdInjuredTwice');

    // Shape check: MID column has 4 cards (the true formation slot count), not 3.
    const midColumnCards = midHeader?.parentElement?.querySelectorAll('[class*="statCard"]');
    expect(midColumnCards?.length).toBe(4);
    const fwdColumnCards = fwdHeader?.parentElement?.querySelectorAll('[class*="statCard"]');
    expect(fwdColumnCards?.length).toBe(2);
  });

  it('SUB-02: does not render the draft pack row, round/pick counter, or Confirm button, and shows a Substitute-labelled CTA', () => {
    const { container } = renderMidmatch();
    expect(container.querySelector('[class*="draftPackRow"]')).toBeNull();
    expect(screen.queryByText(/Round \d of \d/)).toBeNull();
    expect(screen.queryByText('GK Round')).toBeNull();
    expect(screen.queryByLabelText('Confirm lineup')).toBeNull();
    expect(screen.getByText(/Substitute/)).toBeDefined();
  });

  it('SUB-03: on-pitch cards display the live PlayerPiece jersey number (post-substitution inheritance)', () => {
    renderMidmatch();
    const card = screen.getByText('Home DefOne').closest('[class*="statCard"]') as HTMLElement;
    expect(within(card).getByText('#2')).toBeDefined();
  });

  it('SUB-06: sub-counter chip renders "0/3 SUBS USED"', () => {
    renderMidmatch({ subsUsed: 0 });
    expect(screen.getByText('0/3 SUBS USED')).toBeDefined();
  });

  it('SUB-06: sub-counter chip renders "3/3 SUBS USED" with the capped styling when subsUsed is 3', () => {
    renderMidmatch({ subsUsed: 3 });
    const chip = screen.getByText('3/3 SUBS USED');
    expect(chip.className).toMatch(/subCounterChipCapped/);
  });

  it('SUB-06: renders the permanent-slot-cap note naming the team, headcount, and red-card count when maxOnPitch < 11', () => {
    renderMidmatch({ maxOnPitch: 10 });
    expect(screen.getByText(/down to 10 players/)).toBeDefined();
    expect(screen.getByText(/1 red card/)).toBeDefined();
  });

  it('SUB-06: does not render the permanent-slot-cap note when maxOnPitch is 11', () => {
    renderMidmatch({ maxOnPitch: 11 });
    expect(screen.queryByText(/vacated slot cannot be filled/)).toBeNull();
  });

  it('SUB-07: a subbedOut bench entry renders an OUT badge, is dimmed, and is not interactive', () => {
    renderMidmatch();
    const outBadge = screen.getByTestId('bench-out-badge');
    expect(outBadge.textContent).toBe('OUT');
    const card = outBadge.closest('[data-roster-card]');
    expect(card).not.toBeNull();
    expect(card!.getAttribute('data-interactive')).toBe('false');
    expect(card!.className).toMatch(/cardUnavailable/);
  });

  it('D-13: a redCarded bench entry renders a RED CARD badge distinct from OUT, is dimmed, and is not interactive', () => {
    renderMidmatch();
    const redBadge = screen.getByTestId('bench-red-card-badge');
    expect(redBadge.textContent).toBe('RED CARD');
    const card = redBadge.closest('[data-roster-card]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.getAttribute('data-interactive')).toBe('false');
    expect(card.className).toMatch(/cardUnavailable/);
    expect(within(card).queryByTestId('bench-out-badge')).toBeNull();
  });

  it('D-13: clicking a redCarded bench card never calls onSubstitute', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const redBadge = screen.getByTestId('bench-red-card-badge');
    const card = redBadge.closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  /* Plan 08 (SUB-13/14/15): a bench-to-pitch click sequence does not call
   * onSubstitute immediately — it stages a pending substitution behind a
   * confirmation popup, and onSubstitute fires only after clicking "Confirm
   * Substitution" (see 42-08-SUMMARY.md). */
  it('SUB-02: clicking an available bench card, then an on-pitch card, then confirming the popup calls onSubstitute once with (outPieceId, inPlayerId)', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(onSubstitute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Confirm substitution'));
    expect(onSubstitute).toHaveBeenCalledTimes(1);
    expect(onSubstitute).toHaveBeenCalledWith('home-1', 'p013');
  });

  /* Phase 42 (SUB-18/D-05/D-06): a red-carded on-pitch piece is never rendered
   * as a named LineupStatCard — it renders the SENT OFF placeholder instead
   * (see scenario 13 below), so the target here is located via the
   * placeholder rather than the piece's own name. */
  it('SUB-06: clicking a bench card then the SENT OFF (redCarded) on-pitch slot does not call onSubstitute', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
    fireEvent.click(target);
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('SUB-08: on-pitch cards are selectable in positioning mode (default), but not selectable/clickable in substitution mode', () => {
    renderMidmatch();
    const card = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card);
    expect(card.className).toMatch(/statCardSelected/);
    fireEvent.click(card); // deselect before switching modes

    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const cardInSubMode = screen
      .getByText('Home DefOne')
      .closest('[data-roster-card]') as HTMLElement;
    expect(cardInSubMode.getAttribute('role')).not.toBe('button');
  });

  it('ICON-02: renders a yellow card glyph for an on-pitch piece with yellowCards 1', () => {
    renderMidmatch();
    const card = screen.getByText('Home MidYellow').closest('[class*="statCard"]') as HTMLElement;
    const badge = within(card).getByTestId('piece-card-badge');
    expect(badge.getAttribute('data-card')).toBe('yellow');
  });

  /* Phase 42 (SUB-18/D-05/D-06) UPDATED EXPECTATION: a red-carded on-pitch
   * piece is no longer rendered as a LineupStatCard at all (SUB-18: "never
   * rendered with a player on the pitch"), so it can no longer carry a
   * piece-card-badge glyph — it renders the SENT OFF placeholder instead
   * (asserted directly here). Old expectation: the on-pitch card rendered a
   * red piece-card-badge glyph. New expectation: no card (and therefore no
   * glyph) renders for that slot at all; the SENT OFF placeholder is the
   * card/injury status surface for a dismissed player in mid-match mode. Bench
   * still carries the red-card glyph for the SAME player (ICON-03 coverage
   * below is unaffected — that's the bench's `DefRedCarded`-independent p015
   * fixture). See 42-07-SUMMARY.md Deviations. */
  it('SUB-18: a redCarded on-pitch piece renders no card (and no piece-card-badge) — the SENT OFF placeholder replaces it', () => {
    renderMidmatch();
    expect(screen.queryByText('Home DefRedCarded')).toBeNull();
    const placeholder = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
    expect(within(placeholder).queryByTestId('piece-card-badge')).toBeNull();
  });

  it('ICON-02: renders exactly one injury glyph for injuryCount 1 and for injuryCount 2, with the count preserved only in the accessible label', () => {
    renderMidmatch();
    const cardOnce = screen
      .getByText('Home MidInjuredOnce')
      .closest('[class*="statCard"]') as HTMLElement;
    expect(within(cardOnce).getAllByTestId('piece-injury-badge')).toHaveLength(1);
    expect(within(cardOnce).getByTestId('card-injury-badge').getAttribute('aria-label')).toBe(
      'Injured',
    );

    const cardTwice = screen
      .getByText('Home FwdInjuredTwice')
      .closest('[class*="statCard"]') as HTMLElement;
    expect(within(cardTwice).getAllByTestId('piece-injury-badge')).toHaveLength(1);
    expect(within(cardTwice).getByTestId('card-injury-badge').getAttribute('aria-label')).toBe(
      'Injured ×2',
    );
  });

  it('ICON-02/D-02: the roster-card glyph renders immediately after the jersey number', () => {
    renderMidmatch();
    const card = screen.getByText('Home MidYellow').closest('[class*="statCard"]') as HTMLElement;
    const cardNum = card.querySelector('[class*="cardNum"]') as HTMLElement;
    expect(cardNum.nextElementSibling?.getAttribute('data-testid')).toBe('card-injury-badge');
  });

  it('ICON-02/D-04: a booked AND injured roster card shows both glyphs side by side', () => {
    const { container } = renderMidmatch({
      midmatchPieces: [
        makePiece({
          id: 'home-6',
          playerId: 'p007',
          role: 'MID',
          number: 7,
          firstName: 'Home',
          lastName: 'MidBookedInjured',
          yellowCards: 1,
          injuryCount: 1,
        }),
      ],
    });
    const card = screen
      .getByText('Home MidBookedInjured')
      .closest('[class*="statCard"]') as HTMLElement;
    const cardBadge = within(card).getByTestId('piece-card-badge');
    const injuryBadge = within(card).getByTestId('piece-injury-badge');
    const cardX = Number(cardBadge.getAttribute('x'));
    const cardWidth = Number(cardBadge.getAttribute('width'));
    const injuryCrossX = Number(injuryBadge.firstElementChild?.getAttribute('x'));
    expect(cardX + cardWidth).toBeLessThanOrEqual(injuryCrossX);
    expect(
      container.querySelector('[data-testid="card-injury-badge"]')?.getAttribute('aria-label'),
    ).toBe('Yellow card, Injured');
  });

  it('D-12: an empty bench renders the no-substitutes empty state and no bench card, without error', () => {
    renderMidmatch({ bench: [] });
    expect(screen.getByText('No available substitutes on the bench.')).toBeDefined();
    expect(screen.queryByTestId('bench-out-badge')).toBeNull();
    expect(screen.queryByTestId('bench-red-card-badge')).toBeNull();
  });

  it('D-12/D-13: a bench with only subbedOut/redCarded entries renders the empty-state copy alongside the badged cards', () => {
    renderMidmatch({ bench: BENCH_ONLY_UNAVAILABLE });
    expect(screen.getByText('No available substitutes on the bench.')).toBeDefined();
    expect(screen.getByTestId('bench-out-badge')).toBeDefined();
    expect(screen.getByTestId('bench-red-card-badge')).toBeDefined();
  });

  it('ICON-03/gap item 1: bench cards derive their glyph from BenchEntry — booked/injured subbedOut entry shows both glyphs, red-carded entry shows only the RED CARD badge (duplicate glyph suppressed), available entry shows none', () => {
    renderMidmatch({ bench: BENCH_WITH_STATUS });
    const bench = screen.getByTestId('bench-carousel');
    const badges = within(bench).getAllByTestId('card-injury-badge');
    // Gap-closure (42-10 Section D / gap item 1): only the yellow-carded/injured card
    // (p014) renders a card-injury-badge wrapper now — the red-carded card (p015) has
    // injuryCount: 0, so once its card glyph is suppressed there is nothing left to draw.
    expect(badges.length).toBe(1);

    const cardBadges = within(bench).getAllByTestId('piece-card-badge');
    const redBadge = cardBadges.find((b) => b.getAttribute('data-card') === 'red');
    const yellowBadge = cardBadges.find((b) => b.getAttribute('data-card') === 'yellow');
    expect(redBadge).toBeUndefined();
    expect(yellowBadge).toBeDefined();

    // The yellow-carded card (p014) also carries an injury glyph in the same wrapper.
    const yellowWrapper = yellowBadge!.closest('[data-testid="card-injury-badge"]') as HTMLElement;
    expect(within(yellowWrapper).getByTestId('piece-injury-badge')).toBeDefined();

    // The red-carded card (p015) shows only the RED CARD text badge — the duplicate
    // card glyph is suppressed (gap item 1).
    const redCardEntry = screen.getByText('#15').closest('[class*="cardBody"]') as HTMLElement;
    expect(within(redCardEntry).queryByTestId('card-injury-badge')).toBeNull();
    expect(within(redCardEntry).getByTestId('bench-red-card-badge')).toBeDefined();

    // p013 (available, no card/injury state) shows no badge at all.
    const availableCard = screen.getByText('#13').closest('[class*="cardBody"]') as HTMLElement;
    expect(within(availableCard).queryByTestId('card-injury-badge')).toBeNull();
  });

  describe('rejection messages', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      useGameStore.setState({ gameError: null });
      vi.useRealTimers();
    });

    it('SUB-06: SUB_CAP_REACHED surfaces the rejection copy and clears after 2s', () => {
      renderMidmatch();
      act(() => {
        useGameStore.setState({ gameError: 'SUB_CAP_REACHED' });
      });
      expect(screen.getByText('Substitution rejected — limit reached.')).toBeDefined();
      act(() => {
        vi.advanceTimersByTime(2100);
      });
      expect(screen.queryByText('Substitution rejected — limit reached.')).toBeNull();
    });

    it('D-13: CANNOT_SUB_IN_RED_CARDED surfaces its own distinct rejection copy', () => {
      renderMidmatch();
      act(() => {
        useGameStore.setState({ gameError: 'CANNOT_SUB_IN_RED_CARDED' });
      });
      expect(
        screen.getByText('Substitution rejected — a sent-off player cannot return.'),
      ).toBeDefined();
    });
  });

  /* Checkpoint gap-closure (40-07 Task 2 human-verify feedback, item 2a): the panel is now
   * openable at ANY time so a manager can view their roster outside a stoppage — but it must
   * be read-only: no bench card is interactive and a click can never call onSubstitute. */
  describe('read-only presentation (checkpoint gap-closure 2a)', () => {
    it('shows the read-only copy instead of the select CTA when readOnly is true', () => {
      renderMidmatch({ readOnly: true });
      expect(
        screen.getByText(
          'Viewing roster — substitutions are only available during a stoppage in play.',
        ),
      ).toBeDefined();
      expect(
        screen.queryByText('Select a bench card, then click an on-pitch card to substitute.'),
      ).toBeNull();
    });

    /* Phase 42 (SUB-08): the "normal" (non-readOnly) default is positioning
     * mode, not substitution mode — the substitution-mode copy only appears
     * after entering that mode (covered by Phase 42 scenario 8). */
    it('shows the normal (positioning-mode) select CTA when readOnly is false/undefined', () => {
      renderMidmatch();
      expect(
        screen.getByText('Select a player, then click another to swap positions.'),
      ).toBeDefined();
      expect(
        screen.queryByText(
          'Viewing roster — substitutions are only available during a stoppage in play.',
        ),
      ).toBeNull();
    });

    it('bench cards are not interactive when readOnly is true, even an otherwise-available entry', () => {
      renderMidmatch({ readOnly: true });
      const benchCard = screen
        .getByText('Fallou Fall')
        .closest('[data-roster-card]') as HTMLElement;
      expect(benchCard.getAttribute('data-interactive')).toBe('false');
    });

    it('clicking a bench card then an on-pitch card never calls onSubstitute when readOnly is true', () => {
      const onSubstitute = vi.fn();
      renderMidmatch({ readOnly: true, onSubstitute });
      const benchCard = screen
        .getByText('Fallou Fall')
        .closest('[data-roster-card]') as HTMLElement;
      fireEvent.click(benchCard);
      const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
      fireEvent.click(target);
      expect(onSubstitute).not.toHaveBeenCalled();
    });
  });

  it('Gap-closure (42-12 Task 2E): when onResume is NOT supplied, no button named "Resume match" renders — the prop is additive and cannot leak into callers that omit it (e.g. pre-match/draft screens)', () => {
    renderMidmatch();
    expect(screen.queryByRole('button', { name: 'Resume match' })).toBeNull();
  });

  it('Gap-closure (42-12 Task 2E): when onResume IS supplied, the Resume button renders and calls it on click', () => {
    const onResume = vi.fn();
    renderMidmatch({ onResume });
    const resumeButton = screen.getByRole('button', { name: 'Resume match' });
    expect(resumeButton.textContent).toBe('Resume');
    fireEvent.click(resumeButton);
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});

/* ─── Phase 42/47: midmatch positioning mode ────────────────────────────────
 * Covers SUB-08..12/18 and the Pitfall-5 mode-coexistence regression matrix
 * (research PITFALLS.md #5), rewritten from the retired pointer-based gesture
 * to click-select (Phase 47, plan 04, Task 3). */
describe('Phase 42 — midmatch positioning mode', () => {
  // ─── Positioning mode (default) ──────────────────────────────────────────

  it('1. default positioning mode renders the select helper copy and a Substitute button', () => {
    renderMidmatch();
    expect(
      screen.getByText('Select a player, then click another to swap positions.'),
    ).toBeDefined();
    expect(screen.getByLabelText('Enter substitution mode')).toBeDefined();
  });

  it('1b. clicking an eligible on-pitch card applies /statCardSelected/; every other rendered mid-match card carries /statCardEligible/', () => {
    const { container } = renderMidmatch();
    const card = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card);
    expect(card.className).toMatch(/statCardSelected/);
    const grid = container.querySelector('[class*="formationColumns"]') as HTMLElement;
    const others = Array.from(grid.querySelectorAll('[data-roster-card]')).filter(
      (el) => el !== card,
    );
    expect(others.length).toBeGreaterThan(0);
    others.forEach((el) => expect(el.className).toMatch(/statCardEligible/));
  });

  it('2. clicking an on-field card then another calls onReposition once with (source, target), never onSubstitute', () => {
    const onReposition = vi.fn();
    const onSubstitute = vi.fn();
    renderMidmatch({ onReposition, onSubstitute });
    const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(source);
    const target = screen.getByText('Home DefTwo').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(onReposition).toHaveBeenCalledTimes(1);
    expect(onReposition).toHaveBeenCalledWith('home-1', 'home-2');
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('3. clicking a selected card again (self-click) deselects it and calls neither onReposition nor onSubstitute (ROSTER-03)', () => {
    const onReposition = vi.fn();
    const onSubstitute = vi.fn();
    renderMidmatch({ onReposition, onSubstitute });
    const card = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card);
    fireEvent.click(card);
    expect(onReposition).not.toHaveBeenCalled();
    expect(onSubstitute).not.toHaveBeenCalled();
    expect(card.className).not.toMatch(/statCardSelected/);
  });

  it('4. SUB-09: actionPending disables positioning-mode selection and a click calls neither callback', () => {
    const onReposition = vi.fn();
    const onSubstitute = vi.fn();
    renderMidmatch({ onReposition, onSubstitute, actionPending: true });
    const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    expect(source.getAttribute('role')).not.toBe('button');
    fireEvent.click(source);
    const target = screen.getByText('Home DefTwo').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(onReposition).not.toHaveBeenCalled();
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('5. readOnly disables positioning-mode selection and a click calls neither callback', () => {
    const onReposition = vi.fn();
    const onSubstitute = vi.fn();
    renderMidmatch({ onReposition, onSubstitute, readOnly: true });
    const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    expect(source.getAttribute('role')).not.toBe('button');
    fireEvent.click(source);
    const target = screen.getByText('Home DefTwo').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(onReposition).not.toHaveBeenCalled();
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('6. SUB-10: bench cards are not interactive in positioning mode and a bench-sourced click calls neither callback', () => {
    const onReposition = vi.fn();
    const onSubstitute = vi.fn();
    renderMidmatch({ onReposition, onSubstitute });
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    expect(benchCard.getAttribute('data-interactive')).toBe('false');
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(onReposition).not.toHaveBeenCalled();
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('7. the GK card (slot 0) is not selectable in positioning mode; clicking it with nothing selected does not select it, and onReposition is not called (D-09)', () => {
    const onReposition = vi.fn();
    renderMidmatch({ onReposition });
    const gkCard = screen.getByText('Home Keeper').closest('[data-roster-card]') as HTMLElement;
    expect(gkCard.getAttribute('role')).not.toBe('button');
    fireEvent.click(gkCard);
    expect(gkCard.className).not.toMatch(/statCardSelected/);
    expect(onReposition).not.toHaveBeenCalled();
  });

  it('7b. GK-as-target is preserved: with an outfield card selected, the GK card carries /statCardEligible/ and clicking it calls onReposition', () => {
    const onReposition = vi.fn();
    renderMidmatch({ onReposition });
    const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(source);
    const gkCard = screen.getByText('Home Keeper').closest('[data-roster-card]') as HTMLElement;
    expect(gkCard.className).toMatch(/statCardEligible/);
    fireEvent.click(gkCard);
    expect(onReposition).toHaveBeenCalledWith('home-1', 'home-0');
  });

  // ─── Mode toggle (SUB-11/SUB-12) ─────────────────────────────────────────

  it('8. clicking Substitute switches the helper copy and relabels the button to Cancel', () => {
    renderMidmatch();
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    expect(
      screen.getByText('Select a bench card, then click an on-pitch card to substitute.'),
    ).toBeDefined();
    expect(screen.getByLabelText('Cancel substitution')).toBeDefined();
  });

  it('9. at MAX_SUBS_PER_TEAM the Substitute button is disabled and clicking it does not change modes', () => {
    renderMidmatch({ subsUsed: MAX_SUBS_PER_TEAM });
    const btn = screen.getByLabelText('Enter substitution mode');
    expect(btn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(btn);
    expect(
      screen.getByText('Select a player, then click another to swap positions.'),
    ).toBeDefined();
  });

  it('10. below MAX_SUBS_PER_TEAM the Substitute button is enabled', () => {
    renderMidmatch({ subsUsed: MAX_SUBS_PER_TEAM - 1 });
    expect(screen.getByLabelText('Enter substitution mode').hasAttribute('disabled')).toBe(false);
  });

  it('11. clicking Cancel returns to positioning mode and calls neither callback', () => {
    const onSubstitute = vi.fn();
    const onReposition = vi.fn();
    renderMidmatch({ onSubstitute, onReposition });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    fireEvent.click(screen.getByLabelText('Cancel substitution'));
    expect(
      screen.getByText('Select a player, then click another to swap positions.'),
    ).toBeDefined();
    expect(screen.getByLabelText('Enter substitution mode')).toBeDefined();
    expect(onSubstitute).not.toHaveBeenCalled();
    expect(onReposition).not.toHaveBeenCalled();
  });

  it('12. readOnly disables the Substitute button', () => {
    renderMidmatch({ readOnly: true });
    expect(screen.getByLabelText('Enter substitution mode').hasAttribute('disabled')).toBe(true);
  });

  // ─── Sent-off slot (SUB-18/D-05/D-06) ────────────────────────────────────

  it('13. a red-carded on-pitch piece renders a SENT OFF placeholder, not a player card', () => {
    renderMidmatch();
    expect(screen.queryByText('Home DefRedCarded')).toBeNull();
    const badge = screen.getByText('SENT OFF');
    const placeholder = badge.closest('[role="img"]') as HTMLElement;
    expect(placeholder).not.toBeNull();
    expect(placeholder.getAttribute('aria-label')).toBe('Sent off — slot empty');
  });

  it('14. D-05: with an on-field card selected, the SENT OFF placeholder carries /statCardEligible/ and clicking it calls onReposition with the dismissed piece id as the target', () => {
    const onReposition = vi.fn();
    renderMidmatch({ onReposition });
    const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(source);
    const placeholder = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
    expect(placeholder.className).toMatch(/statCardEligible/);
    fireEvent.click(placeholder);
    expect(onReposition).toHaveBeenCalledWith('home-1', 'home-4');
  });

  it('15. the SENT OFF placeholder is not clickable when nothing is selected', () => {
    const onReposition = vi.fn();
    renderMidmatch({ onReposition });
    const placeholder = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
    expect(placeholder.className).not.toMatch(/statCardEligible/);
    fireEvent.click(placeholder);
    expect(onReposition).not.toHaveBeenCalled();
  });

  // ─── Mode-coexistence regression matrix (Pitfall 5) ──────────────────────
  // Each row names the SUB-0X requirement it protects, exercises the guard
  // under substitution mode (original outcome unchanged), and exercises
  // positioning mode (the guard is never reached / structurally irrelevant).

  it('SUB-04/06 (3-sub cap): positioning mode is unaffected by the cap; substitution mode entry is still blocked at the cap', () => {
    const onReposition = vi.fn();
    renderMidmatch({ subsUsed: MAX_SUBS_PER_TEAM, onReposition });
    const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(source);
    const target = screen.getByText('Home DefTwo').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(onReposition).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Enter substitution mode').hasAttribute('disabled')).toBe(true);
  });

  it('SUB-06 (red-card isSubBlocked exclusion): positioning mode allows a reposition-click onto the SENT OFF slot (D-05); substitution mode still blocks a bench-click onto it', () => {
    const onSubstitute = vi.fn();
    const onReposition = vi.fn();
    renderMidmatch({ onSubstitute, onReposition });

    const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(source);
    const sentOffPlaceholder = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
    fireEvent.click(sentOffPlaceholder);
    expect(onReposition).toHaveBeenCalledWith('home-1', 'home-4');

    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    fireEvent.click(sentOffPlaceholder);
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('SUB-07 (subbedOut bench exclusion): the bench is inert in positioning mode; substitution mode still blocks clicking a subbedOut bench card', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });

    const outBadge = screen.getByTestId('bench-out-badge');
    const subbedOutCard = outBadge.closest('[data-roster-card]') as HTMLElement;
    expect(subbedOutCard.getAttribute('data-interactive')).toBe('false');

    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    fireEvent.click(subbedOutCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('SUB-07/D-13 gap-closure: clicking a subbedOut or redCarded bench card in substitution mode never stages a confirmation popup', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));

    const outBadge = screen.getByTestId('bench-out-badge');
    const subbedOutCard = outBadge.closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(subbedOutCard);
    const targetOne = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(targetOne);
    expect(screen.queryByRole('dialog')).toBeNull();

    const redBadge = screen.getByTestId('bench-red-card-badge');
    const redCardedCard = redBadge.closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(redCardedCard);
    const targetTwo = screen.getByText('Home DefTwo').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(targetTwo);
    expect(screen.queryByRole('dialog')).toBeNull();

    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('readOnly guard: disables positioning-mode selection and blocks entry into (and selection within) substitution mode identically', () => {
    renderMidmatch({ readOnly: true });
    const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    expect(source.getAttribute('role')).not.toBe('button');
    expect(screen.getByLabelText('Enter substitution mode').hasAttribute('disabled')).toBe(true);
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    expect(benchCard.getAttribute('data-interactive')).toBe('false');
  });

  describe('gap item 6: SENT OFF slot stacking', () => {
    /** Fixture where `home-2` (an active own-team piece) already stands on
     * red-carded `home-4`'s frozen hex — the exact BUG-38-interaction scenario
     * this gap item closes (42-10-SUMMARY.md gap item 6). */
    const COLLISION_PIECES: PlayerPiece[] = HOME_TEAM_PIECES.map((p) =>
      p.id === 'home-2' ? { ...p, position: { q: 14, r: 10 } } : p,
    );

    afterEach(() => {
      useGameStore.setState({ gameError: null });
    });

    it('1. with a third active own-team piece on the red-carded slot frozen hex, clicking the SENT OFF slot does NOT call onReposition', () => {
      const onReposition = vi.fn();
      renderMidmatch({ midmatchPieces: COLLISION_PIECES, onReposition });
      const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
      fireEvent.click(source);
      const placeholder = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
      fireEvent.click(placeholder);
      expect(onReposition).not.toHaveBeenCalled();
    });

    it('2. the SENT OFF placeholder does not carry the eligible-target highlight when its hex is taken', () => {
      renderMidmatch({ midmatchPieces: COLLISION_PIECES });
      const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
      fireEvent.click(source);
      const placeholder = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
      expect(placeholder.className).not.toMatch(/statCardEligible/);
    });

    it('3. when the red-carded slot frozen hex is free, the same click sequence still calls onReposition (D-05 preserved)', () => {
      const onReposition = vi.fn();
      renderMidmatch({ onReposition }); // default HOME_TEAM_PIECES: home-4's hex is free
      const source = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
      fireEvent.click(source);
      const placeholder = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
      fireEvent.click(placeholder);
      expect(onReposition).toHaveBeenCalledWith('home-1', 'home-4');
    });

    it('4. REPOSITION_SLOT_OCCUPIED renders the roster panel rejection message', () => {
      renderMidmatch();
      act(() => {
        useGameStore.setState({ gameError: 'REPOSITION_SLOT_OCCUPIED' });
      });
      expect(
        screen.getByText('Swap rejected — another player is already in that position.'),
      ).toBeDefined();
    });

    it('5. substitution mode is unaffected by the pre-gate: clicking a bench card then the taken SENT OFF slot behaves as it does today', () => {
      const onSubstitute = vi.fn();
      renderMidmatch({ midmatchPieces: COLLISION_PIECES, onSubstitute });
      fireEvent.click(screen.getByLabelText('Enter substitution mode'));
      const benchCard = screen
        .getByText('Fallou Fall')
        .closest('[data-roster-card]') as HTMLElement;
      fireEvent.click(benchCard);
      const placeholder = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
      fireEvent.click(placeholder);
      expect(onSubstitute).not.toHaveBeenCalled();
    });
  });
});

/* ─── Phase 47 (plan 04, Task 3): click-select behaviors with no prior
 * pointer-based equivalent — ROSTER-01/02/03/05/07, D-05..D-09. Covers the
 * D-07/D-08 selection-switch asymmetry, the substitution-mode bench-first
 * gesture, the eligible-target set on bench selection, the SENT OFF
 * placeholder's non-eligibility in substitution mode, and the mode-crossing
 * selection-clearing regression (RESEARCH.md Pitfall 1). */
describe('Phase 47 — click-select gap coverage (ROSTER-01/02/03/05/07, D-05..D-09)', () => {
  it('D-08: in positioning mode, clicking a different selectable card completes the swap rather than switching the selection', () => {
    const onReposition = vi.fn();
    renderMidmatch({ onReposition });
    const cardA = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    const cardB = screen.getByText('Home DefTwo').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(cardA);
    fireEvent.click(cardB);
    expect(onReposition).toHaveBeenCalledTimes(1);
    expect(onReposition).toHaveBeenCalledWith('home-1', 'home-2');
    expect(document.querySelector('[class*="statCardSelected"]')).toBeNull();
  });

  it('D-07: in substitution mode, clicking a different available bench card switches the selection without completing anything', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ bench: BENCH_TWO_AVAILABLE, onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const p013 = PLAYER_BY_ID.get('p013')!;
    const p016 = PLAYER_BY_ID.get('p016')!;
    const benchA = screen
      .getByText(`${p013.firstName} ${p013.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    const benchB = screen
      .getByText(`${p016.firstName} ${p016.lastName}`)
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchA);
    expect(benchA.className).toMatch(/statCardSelected/);
    fireEvent.click(benchB);
    expect(benchB.className).toMatch(/statCardSelected/);
    expect(benchA.className).not.toMatch(/statCardSelected/);
    expect(onSubstitute).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('D-06: bench-first only — clicking an on-pitch card with nothing selected does nothing', () => {
    renderMidmatch();
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const onPitchCard = screen
      .getByText('Home DefOne')
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(onPitchCard);
    expect(onPitchCard.className).not.toMatch(/statCardSelected/);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking a bench card applies /statCardSelected/ to it and /statCardEligible/ to eligible on-pitch cards', () => {
    renderMidmatch();
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    expect(benchCard.className).toMatch(/statCardSelected/);
    const eligibleTarget = screen
      .getByText('Home DefOne')
      .closest('[data-roster-card]') as HTMLElement;
    expect(eligibleTarget.className).toMatch(/statCardEligible/);
  });

  it('D-05: in substitution mode with a bench card selected, the SENT OFF placeholder carries no /statCardEligible/ class, stages no pendingSub, and calls neither callback', () => {
    const onSubstitute = vi.fn();
    const onReposition = vi.fn();
    renderMidmatch({ onSubstitute, onReposition });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const placeholder = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
    expect(placeholder.className).not.toMatch(/statCardEligible/);
    fireEvent.click(placeholder);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSubstitute).not.toHaveBeenCalled();
    expect(onReposition).not.toHaveBeenCalled();
  });

  it('ROSTER-05: a positioning-mode selection clears when entering substitution mode, and cannot be reused as a swap participant', () => {
    const onReposition = vi.fn();
    const onSubstitute = vi.fn();
    renderMidmatch({ onReposition, onSubstitute });
    const card = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(card);
    expect(card.className).toMatch(/statCardSelected/);

    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    expect(document.querySelector('[class*="statCardSelected"]')).toBeNull();
    expect(document.querySelector('[class*="statCardEligible"]')).toBeNull();

    const anotherCard = screen
      .getByText('Home DefTwo')
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(anotherCard);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onReposition).not.toHaveBeenCalled();
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('ROSTER-05: a substitution-mode bench selection clears on Cancel, and a subsequent on-pitch click calls neither callback', () => {
    const onReposition = vi.fn();
    const onSubstitute = vi.fn();
    renderMidmatch({ onReposition, onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    expect(benchCard.className).toMatch(/statCardSelected/);

    fireEvent.click(screen.getByLabelText('Cancel substitution'));
    expect(document.querySelector('[class*="statCardSelected"]')).toBeNull();

    const onPitchCard = screen
      .getByText('Home DefOne')
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(onPitchCard);
    expect(onReposition).not.toHaveBeenCalled();
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('ROSTER-05: confirming a staged substitution returns to positioning mode with no selection left over', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    fireEvent.click(screen.getByLabelText('Confirm substitution'));
    expect(
      screen.getByText('Select a player, then click another to swap positions.'),
    ).toBeDefined();
    expect(document.querySelector('[class*="statCardSelected"]')).toBeNull();
    expect(document.querySelector('[class*="statCardEligible"]')).toBeNull();
  });
});

/* ─── Plan 08 (42-08), rewritten Phase 47 (plan 04): staged substitution with
 * confirmation ────────────────────────────────────────────────────────────
 * Covers SUB-13/14/15 — a click-to-complete substitution stages a pending
 * confirmation popup rather than firing immediately. */
describe('Phase 42 — staged substitution with confirmation', () => {
  it('1. a bench-click-then-pitch-click sequence stages a substitution and renders a confirmation dialog naming both players, without calling onSubstitute', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(onSubstitute).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Substitute Home DefOne for Fallou Fall?')).toBeDefined();
  });

  it('2. SUB-13: a second click sequence onto a different on-pitch card while the popup is open does not change its text or call onSubstitute', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target1 = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target1);
    expect(screen.getByText('Substitute Home DefOne for Fallou Fall?')).toBeDefined();

    // A second click attempt while staged — belt-and-suspenders: the bench
    // card is disabled while a substitution is pending, so this exercises
    // the completion handler's own SUB-13 guard directly too.
    fireEvent.click(benchCard);
    const target2 = screen.getByText('Home DefTwo').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target2);
    expect(screen.getByText('Substitute Home DefOne for Fallou Fall?')).toBeDefined();
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('3. SUB-13: while the popup is open, bench cards are non-interactive and on-pitch cards are non-selectable', () => {
    renderMidmatch();
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(screen.getByText('Substitute Home DefOne for Fallou Fall?')).toBeDefined();

    const benchCardAfter = screen
      .getByText('Fallou Fall')
      .closest('[data-roster-card]') as HTMLElement;
    expect(benchCardAfter.getAttribute('data-interactive')).toBe('false');
    const pitchCardAfter = screen
      .getByText('Home DefTwo')
      .closest('[data-roster-card]') as HTMLElement;
    expect(pitchCardAfter.getAttribute('role')).not.toBe('button');
  });

  it('4. SUB-15 confirm: clicking Confirm Substitution calls onSubstitute once, closes the popup, and returns to positioning mode', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    fireEvent.click(screen.getByLabelText('Confirm substitution'));
    expect(onSubstitute).toHaveBeenCalledTimes(1);
    expect(onSubstitute).toHaveBeenCalledWith('home-1', 'p013');
    expect(screen.queryByText('Substitute Home DefOne for Fallou Fall?')).toBeNull();
    expect(
      screen.getByText('Select a player, then click another to swap positions.'),
    ).toBeDefined();
    expect(screen.getByLabelText('Enter substitution mode')).toBeDefined();
  });

  it('5. SUB-15 cancel: clicking the popup Cancel closes it, calls neither callback, and stays in substitution mode', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    fireEvent.click(screen.getByLabelText('Cancel substitution selection'));
    expect(onSubstitute).not.toHaveBeenCalled();
    expect(screen.queryByText('Substitute Home DefOne for Fallou Fall?')).toBeNull();
    expect(
      screen.getByText('Select a bench card, then click an on-pitch card to substitute.'),
    ).toBeDefined();
    expect(screen.getByLabelText('Cancel substitution')).toBeDefined();
  });

  it('5b. Gap-closure (42-12 Task 3C, gap item 5): both Cancel surfaces are orange — the popup Cancel carries subConfirmButtonCancel, and the mode-level Cancel carries rosterActionButtonCancel', () => {
    renderMidmatch();
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    const popupCancel = screen.getByLabelText('Cancel substitution selection');
    expect(popupCancel.className).toMatch(/subConfirmButtonCancel/);
    fireEvent.click(popupCancel);
    const modeCancel = screen.getByLabelText('Cancel substitution');
    expect(modeCancel.className).toMatch(/rosterActionButtonCancel/);
  });

  it('6. after cancelling the popup, a fresh bench-click-then-pitch-click stages again', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    fireEvent.click(screen.getByLabelText('Cancel substitution selection'));

    const benchCardAgain = screen
      .getByText('Fallou Fall')
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCardAgain);
    const targetAgain = screen
      .getByText('Home DefTwo')
      .closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(targetAgain);
    expect(screen.getByText('Substitute Home DefTwo for Fallou Fall?')).toBeDefined();
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('7. clicking the mode-level Cancel while the popup is open clears it, applies nothing, and returns to positioning mode', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    fireEvent.click(screen.getByLabelText('Cancel substitution'));
    expect(onSubstitute).not.toHaveBeenCalled();
    expect(screen.queryByText('Substitute Home DefOne for Fallou Fall?')).toBeNull();
    expect(
      screen.getByText('Select a player, then click another to swap positions.'),
    ).toBeDefined();
    expect(screen.getByLabelText('Enter substitution mode')).toBeDefined();
  });

  it('8. SUB-18: a red-carded on-pitch slot (SENT OFF placeholder) is still not a valid substitution target — no popup appears and onSubstitute is not called', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('SENT OFF').closest('[role="img"]') as HTMLElement;
    fireEvent.click(target);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('9. readOnly prevents staging entirely — no popup renders and onSubstitute is never called', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ readOnly: true, onSubstitute });
    const benchCard = screen.getByText('Fallou Fall').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(benchCard);
    const target = screen.getByText('Home DefOne').closest('[data-roster-card]') as HTMLElement;
    fireEvent.click(target);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSubstitute).not.toHaveBeenCalled();
  });
});
