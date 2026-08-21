/**
 * LineupAssignmentScreen.test.tsx — Phase 29 (29-05-PLAN.md Task 3).
 *
 * First-ever test file for this component (Wave 0 gap). Covers:
 * - Draft-mode rendering (DraftPackCarousel above the grid, BenchCarousel below)
 * - Drag-to-pick: a pack-sourced card dropped on a lineup slot calls onDraftPick
 * - Waiting-for-opponent disables the draft-pack row and shows the waiting text
 * - Round/pick counter text (D-20, Phase 30)
 * - draftComplete hides the carousel and shows the existing Confirm button (D-23)
 * - D-23 (Phase 30): tier-color border on filled starting-11 lineup slot cards
 * - Standard-mode non-regression (draftMode falsy renders exactly as before)
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import { PLAYER_POOL, computeTotalStat } from '@counter-attack/shared';
import type {
  BenchEntry,
  DraftClientView,
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
const HOME_TEAM_PIECES: PlayerPiece[] = [
  makePiece({
    id: 'home-0',
    playerId: 'p001',
    role: 'GK',
    number: 1,
    firstName: 'Home',
    lastName: 'Keeper',
  }),
  makePiece({
    id: 'home-1',
    playerId: 'p002',
    role: 'DEF',
    number: 2,
    firstName: 'Home',
    lastName: 'DefOne',
  }),
  makePiece({
    id: 'home-2',
    playerId: 'p003',
    role: 'DEF',
    number: 3,
    firstName: 'Home',
    lastName: 'DefTwo',
  }),
  makePiece({
    id: 'home-3',
    playerId: 'p004',
    role: 'DEF',
    number: 4,
    firstName: 'Home',
    lastName: 'DefThree',
  }),
  makePiece({
    id: 'home-4',
    playerId: 'p005',
    role: 'DEF',
    number: 5,
    firstName: 'Home',
    lastName: 'DefRedCarded',
    redCarded: true,
  }),
  makePiece({
    id: 'home-5',
    playerId: 'p006',
    role: 'MID',
    number: 6,
    firstName: 'Home',
    lastName: 'MidOne',
  }),
  makePiece({
    id: 'home-6',
    playerId: 'p007',
    role: 'MID',
    number: 7,
    firstName: 'Home',
    lastName: 'MidYellow',
    yellowCards: 1,
  }),
  makePiece({
    id: 'home-7',
    playerId: 'p008',
    role: 'MID',
    number: 8,
    firstName: 'Home',
    lastName: 'MidInjuredOnce',
    injuryCount: 1,
  }),
  makePiece({
    id: 'home-8',
    playerId: 'p009',
    role: 'FWD', // deliberately mismatched vs. its MID slot — see fixture doc above
    number: 9,
    firstName: 'Home',
    lastName: 'FwdInjuredTwice',
    injuryCount: 2,
  }),
  makePiece({
    id: 'home-9',
    playerId: 'p010',
    role: 'FWD',
    number: 10,
    firstName: 'Home',
    lastName: 'FwdOne',
  }),
  makePiece({
    id: 'home-10',
    playerId: 'p011',
    role: 'ST',
    number: 11,
    firstName: 'Home',
    lastName: 'Striker',
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

  it('SUB-07: a subbedOut bench entry renders an OUT badge, is dimmed, and is not draggable', () => {
    renderMidmatch();
    const outBadge = screen.getByTestId('bench-out-badge');
    expect(outBadge.textContent).toBe('OUT');
    const card = outBadge.closest('[draggable]');
    expect(card).not.toBeNull();
    expect(card!.getAttribute('draggable')).toBe('false');
    expect(card!.className).toMatch(/cardUnavailable/);
  });

  it('D-13: a redCarded bench entry renders a RED CARD badge distinct from OUT, is dimmed, and is not draggable', () => {
    renderMidmatch();
    const redBadge = screen.getByTestId('bench-red-card-badge');
    expect(redBadge.textContent).toBe('RED CARD');
    const card = redBadge.closest('[draggable]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.getAttribute('draggable')).toBe('false');
    expect(card.className).toMatch(/cardUnavailable/);
    expect(within(card).queryByTestId('bench-out-badge')).toBeNull();
  });

  it('D-13: dragging a redCarded bench card never calls onSubstitute', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    const redBadge = screen.getByTestId('bench-red-card-badge');
    const card = redBadge.closest('[draggable]') as HTMLElement;
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    const target = screen.getByText('Home DefOne').closest('[draggable]') as HTMLElement;
    fireEvent.drop(target, { dataTransfer: { getData: () => '' } });
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('SUB-02: dragging an available bench card and dropping it on an on-pitch card calls onSubstitute once with (outPieceId, inPlayerId)', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    const benchCard = screen.getByText('Fallou Fall').closest('[draggable]') as HTMLElement;
    fireEvent.dragStart(benchCard, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    const target = screen.getByText('Home DefOne').closest('[draggable]') as HTMLElement;
    fireEvent.drop(target, { dataTransfer: { getData: () => '' } });
    expect(onSubstitute).toHaveBeenCalledTimes(1);
    expect(onSubstitute).toHaveBeenCalledWith('home-1', 'p013');
  });

  it('SUB-06: dropping a bench card onto a redCarded on-pitch card does not call onSubstitute', () => {
    const onSubstitute = vi.fn();
    renderMidmatch({ onSubstitute });
    const benchCard = screen.getByText('Fallou Fall').closest('[draggable]') as HTMLElement;
    fireEvent.dragStart(benchCard, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    const target = screen.getByText('Home DefRedCarded').closest('[draggable]') as HTMLElement;
    fireEvent.drop(target, { dataTransfer: { getData: () => '' } });
    expect(onSubstitute).not.toHaveBeenCalled();
  });

  it('SUB-02: on-pitch cards are never draggable in mid-match mode', () => {
    renderMidmatch();
    const card = screen.getByText('Home DefOne').closest('[draggable]');
    expect(card).not.toBeNull();
    expect(card!.getAttribute('draggable')).toBe('false');
  });

  it('ICON-02: renders a yellow card glyph for an on-pitch piece with yellowCards 1', () => {
    renderMidmatch();
    const card = screen.getByText('Home MidYellow').closest('[class*="statCard"]') as HTMLElement;
    const badge = within(card).getByTestId('piece-card-badge');
    expect(badge.getAttribute('data-card')).toBe('yellow');
  });

  it('ICON-02: renders a red card glyph for a redCarded on-pitch piece', () => {
    renderMidmatch();
    const card = screen
      .getByText('Home DefRedCarded')
      .closest('[class*="statCard"]') as HTMLElement;
    const badge = within(card).getByTestId('piece-card-badge');
    expect(badge.getAttribute('data-card')).toBe('red');
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

  it('ICON-03: bench cards derive their glyph from BenchEntry — booked/injured subbedOut entry shows both glyphs, red-carded entry shows the red glyph, available entry shows none', () => {
    renderMidmatch({ bench: BENCH_WITH_STATUS });
    const bench = screen.getByTestId('bench-carousel');
    const badges = within(bench).getAllByTestId('card-injury-badge');
    expect(badges.length).toBe(2);

    const cardBadges = within(bench).getAllByTestId('piece-card-badge');
    const redBadge = cardBadges.find((b) => b.getAttribute('data-card') === 'red');
    const yellowBadge = cardBadges.find((b) => b.getAttribute('data-card') === 'yellow');
    expect(redBadge).toBeDefined();
    expect(yellowBadge).toBeDefined();

    // The yellow-carded card (p014) also carries an injury glyph in the same wrapper.
    const yellowWrapper = yellowBadge!.closest('[data-testid="card-injury-badge"]') as HTMLElement;
    expect(within(yellowWrapper).getByTestId('piece-injury-badge')).toBeDefined();

    // The red-carded card (p015) has no injury glyph (injuryCount: 0).
    const redWrapper = redBadge!.closest('[data-testid="card-injury-badge"]') as HTMLElement;
    expect(within(redWrapper).queryByTestId('piece-injury-badge')).toBeNull();

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
   * be read-only: no bench card is draggable and a drop can never call onSubstitute. */
  describe('read-only presentation (checkpoint gap-closure 2a)', () => {
    it('shows the read-only copy instead of the drag CTA when readOnly is true', () => {
      renderMidmatch({ readOnly: true });
      expect(
        screen.getByText(
          'Viewing roster — substitutions are only available during a stoppage in play.',
        ),
      ).toBeDefined();
      expect(
        screen.queryByText('Drag a bench card onto an on-pitch card to Substitute.'),
      ).toBeNull();
    });

    it('shows the normal drag CTA when readOnly is false/undefined', () => {
      renderMidmatch();
      expect(
        screen.getByText('Drag a bench card onto an on-pitch card to Substitute.'),
      ).toBeDefined();
    });

    it('bench cards are not draggable when readOnly is true, even an otherwise-available entry', () => {
      renderMidmatch({ readOnly: true });
      const benchCard = screen.getByText('Fallou Fall').closest('[draggable]') as HTMLElement;
      expect(benchCard.getAttribute('draggable')).toBe('false');
    });

    it('dragging a bench card and dropping it on an on-pitch card never calls onSubstitute when readOnly is true', () => {
      const onSubstitute = vi.fn();
      renderMidmatch({ readOnly: true, onSubstitute });
      const benchCard = screen.getByText('Fallou Fall').closest('[draggable]') as HTMLElement;
      // The card itself is non-draggable, but exercise the drop handler directly too —
      // belt-and-suspenders per the onDrop-level readOnly guard added alongside the
      // draggable=false gate (never rely on drag-source gating alone).
      fireEvent.dragStart(benchCard, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
      const target = screen.getByText('Home DefOne').closest('[draggable]') as HTMLElement;
      fireEvent.drop(target, { dataTransfer: { getData: () => '' } });
      expect(onSubstitute).not.toHaveBeenCalled();
    });
  });
});
