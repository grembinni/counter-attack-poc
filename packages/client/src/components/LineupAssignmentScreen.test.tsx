/**
 * LineupAssignmentScreen.test.tsx — Phase 29 (29-05-PLAN.md Task 3).
 *
 * First-ever test file for this component (Wave 0 gap). Covers:
 * - Draft-mode rendering (DraftPackCarousel above the grid, BenchCarousel below)
 * - Drag-to-pick: a pack-sourced card dropped on a lineup slot calls onDraftPick
 * - Waiting-for-opponent disables the draft-pack row and shows the waiting text
 * - Cycle/pick counter text
 * - draftComplete hides the carousel and shows the existing Confirm button (D-23)
 * - Keeper-safety auto-pick banner (DRAFT-08)
 * - Standard-mode non-regression (draftMode falsy renders exactly as before)
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { PLAYER_POOL, computeTotalStat } from '@counter-attack/shared';
import type {
  DraftClientView,
  DraftTier,
  PoolPlayer,
  TieredPoolPlayer,
} from '@counter-attack/shared';
import { LineupAssignmentScreen } from './LineupAssignmentScreen.js';
import { TIER_CARD_CLASS } from './DraftPackCarousel.js';

afterEach(() => cleanup());

const PLAYER_BY_ID = new Map<string, PoolPlayer>(PLAYER_POOL.map((p) => [p.id, p]));

function tieredCard(id: string, tier: DraftTier): TieredPoolPlayer {
  const player = PLAYER_BY_ID.get(id)!;
  return { ...player, tier, totalStat: computeTotalStat(player) };
}

/** A representative DraftClientView: cycle 2, subStep PICK1, a 7-card pack, picksRemaining 1,
 * a couple of filled lineup slots (GK + one DEF) with the rest null, a 2-card bench. */
function makeDraftView(overrides: Partial<DraftClientView> = {}): DraftClientView {
  return {
    cycle: 2,
    subStep: 'PICK1',
    currentPack: [
      tieredCard('p013', 'chase'),
      tieredCard('p014', 'rare'),
      tieredCard('p015', 'uncommon'),
      tieredCard('p016', 'common'),
      tieredCard('p017', 'common'),
      tieredCard('p018', 'common'),
      tieredCard('p012', 'keeper'),
    ],
    picksRemaining: 1,
    waitingForOpponent: false,
    lineupSlots: ['p001', 'p002', null, null, null, null, null, null, null, null, null],
    benchIds: ['p003', 'p004'],
    benchNumbers: {},
    keeperAutoPickedThisCycle: false,
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

describe('LineupAssignmentScreen — DRAFT-06/D-05: drag-to-pick', () => {
  it('dropping a pack-sourced card onto an empty lineup slot calls onDraftPick with a slot destination', () => {
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

    fireEvent.dragStart(packCardEl!, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });

    // slotIndex 2 is a null (empty) DEF slot per makeDraftView's lineupSlots fixture.
    const emptySlot = container.querySelector('[data-slot-index="2"]');
    expect(emptySlot).not.toBeNull();

    fireEvent.drop(emptySlot!, { dataTransfer: { getData: () => '' } });

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

describe('LineupAssignmentScreen — D-01: cycle/pick counter', () => {
  it('renders "Cycle 2 of 4 · Pick 1 of 1"', () => {
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

    expect(screen.getByText('Cycle 2 of 4 · Pick 1 of 1')).toBeDefined();
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
  it('renders no Confirm button and shows helper copy when draftComplete is true but a lineup slot is still null', () => {
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

    expect(screen.queryByLabelText('Confirm lineup')).toBeNull();
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

describe('LineupAssignmentScreen — DRAFT-09 gap-closure: drag-state never wedges', () => {
  it('after a pack-sourced drag ends without a commit, a subsequent drag+drop still emits onDraftPick', () => {
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

    // Drag starts (dragState set to the pack card) then ends WITHOUT a drop —
    // the container-level onDragEnd must reset dragState so it never wedges.
    fireEvent.dragStart(packCard, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    fireEvent.dragEnd(packCard, { dataTransfer: {} });

    // A fresh drag+drop on the same card completes normally — proves no stale
    // dragState from the cancelled drag blocked this rearrangement.
    fireEvent.dragStart(packCard, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    const emptySlot = container.querySelector('[data-slot-index="2"]');
    expect(emptySlot).not.toBeNull();
    fireEvent.drop(emptySlot!, { dataTransfer: { getData: () => '' } });

    expect(onDraftPick).toHaveBeenCalledWith('p013', { type: 'slot', slotIndex: 2 });
  });
});

describe('LineupAssignmentScreen — DRAFT-08: keeper-safety banner', () => {
  it('renders the keeper auto-selected banner when keeperAutoPickedThisCycle is true', () => {
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
        draftView={makeDraftView({ keeperAutoPickedThisCycle: true })}
        onDraftPick={NOOP}
        onDraftRearrange={NOOP}
      />,
    );

    expect(screen.getByText('Keeper auto-selected — cycle 4 safety net.')).toBeDefined();
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
});
