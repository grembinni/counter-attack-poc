/**
 * CardInjuryBadge.crossSurface.test.tsx — Phase 41 plan 41-06, Task 2.
 *
 * This spec exists because each surface plan (41-03/41-04/41-05) proves only its own
 * surface. ROADMAP Phase 41 Success Criterion 3 — "a booking or injury applied
 * mid-match updates all four surfaces consistently, with no surface left showing a
 * stale or missing icon" — is a genuinely CROSS-surface property that no single
 * surface's own test suite can express. The shared `piece-card-badge`/
 * `piece-injury-badge` `data-testid` hooks are what let one assertion vocabulary
 * (`glyphContract`) span both the SVG `CardInjuryBadgeGroup` surface (pitch token)
 * and the three self-contained-`<svg>` `CardInjuryBadge` DOM surfaces (scoreboard,
 * roster, bench).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent, screen, within } from '@testing-library/react';
import type { PlayerPiece, HexCoord, BenchEntry } from '@counter-attack/shared';
import { COLOR_SCHEME_REGISTRY } from '@counter-attack/shared';
import { PieceOverlay } from './PieceOverlay.js';
import { PlayerStatsPanel } from './PlayerStatsPanel.js';
import { LineupAssignmentScreen } from './LineupAssignmentScreen.js';
import { BenchCarousel } from './BenchCarousel.js';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import type { TieredPoolPlayer, DraftTier } from '@counter-attack/shared';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());

const noop = () => undefined;

/**
 * Shared vocabulary used identically by all four surfaces below — the whole point of
 * this spec is that ONE assertion function proves the property everywhere, not four
 * bespoke per-surface queries.
 */
function glyphContract(container: HTMLElement) {
  return {
    cards: Array.from(container.querySelectorAll('[data-testid="piece-card-badge"]')).map((e) =>
      e.getAttribute('data-card'),
    ),
    injuries: container.querySelectorAll('[data-testid="piece-injury-badge"]').length,
  };
}

const CLEAN = { cards: [], injuries: 0 };
const BOOKED_AND_INJURED = { cards: ['yellow'], injuries: 1 };

/** Minimal PlayerPiece literal, mirroring PieceOverlay.test.tsx's fixture pattern. */
const cleanPiece: PlayerPiece = {
  id: 'home-6',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'Carrier',
  number: 7,
  nationality: 'Brazil',
  role: 'MID',
  position: { q: 9, r: 8 },
  pace: 5,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  saving: 5,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
  highPass: 5,
};

describe('Card/injury iconography — ROADMAP Phase 41 Success Criterion 3: all four surfaces update consistently', () => {
  it('pitch token (PieceOverlay) shows the glyph after a mid-match booking+injury', () => {
    const { container, rerender } = render(
      <svg>
        <PieceOverlay
          piece={cleanPiece}
          uniformStyle="pinstripes-vertical"
          palette={COLOR_SCHEME_REGISTRY.city.palette}
          selectionState="none"
          onClick={noop}
          onInspect={noop}
          carrierId={null}
          attackingTeam="home"
        />
      </svg>,
    );
    expect(glyphContract(container)).toEqual(CLEAN);

    rerender(
      <svg>
        <PieceOverlay
          piece={{ ...cleanPiece, yellowCards: 1, injuryCount: 1 }}
          uniformStyle="pinstripes-vertical"
          palette={COLOR_SCHEME_REGISTRY.city.palette}
          selectionState="none"
          onClick={noop}
          onInspect={noop}
          carrierId={null}
          attackingTeam="home"
        />
      </svg>,
    );
    expect(glyphContract(container)).toEqual(BOOKED_AND_INJURED);
  });

  describe('scoreboard card (PlayerStatsPanel)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      useGameStore.setState({
        gameState: {
          ...mockMovementState,
          selectedTeams: { home: 'city', away: 'crew' },
          pieces: [cleanPiece],
        },
        screen: 'GAME_BOARD',
        selectedPieceId: 'home-6',
        validMoveHexes: [],
        playerSlot: 1,
        roomCode: 'ABC12',
        disconnectWarning: false,
        roomError: null,
        gameError: null,
      });
    });

    it('shows the glyph after a mid-match booking+injury', () => {
      const { container } = render(<PlayerStatsPanel />);
      expect(glyphContract(container)).toEqual(CLEAN);

      act(() => {
        const state = useGameStore.getState();
        useGameStore.setState({
          gameState: {
            ...state.gameState,
            pieces: state.gameState.pieces.map((p) =>
              p.id === 'home-6' ? { ...p, yellowCards: 1, injuryCount: 1 } : p,
            ),
          },
        });
      });
      // No re-render call — proving the zustand subscription itself updates the DOM,
      // which is exactly the "no stale icon" property Success Criterion 3 requires.
      expect(glyphContract(container)).toEqual(BOOKED_AND_INJURED);
    });
  });

  it('roster card (LineupAssignmentScreen mid-match) shows the glyph after a mid-match booking+injury', () => {
    const { container, rerender } = render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={noop}
        onConfirm={noop}
        lineupConfirmed={false}
        mode="midmatch"
        midmatchPieces={[cleanPiece]}
        bench={[]}
        subsUsed={0}
        maxOnPitch={11}
        onSubstitute={noop}
        readOnly={false}
      />,
    );
    expect(glyphContract(container)).toEqual(CLEAN);

    rerender(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={noop}
        onConfirm={noop}
        lineupConfirmed={false}
        mode="midmatch"
        midmatchPieces={[{ ...cleanPiece, yellowCards: 1, injuryCount: 1 }]}
        bench={[]}
        subsUsed={0}
        maxOnPitch={11}
        onSubstitute={noop}
        readOnly={false}
      />,
    );
    expect(glyphContract(container)).toEqual(BOOKED_AND_INJURED);
  });

  it('bench card (BenchCarousel) shows the glyph after a mid-match booking+injury', () => {
    const ORIGIN: HexCoord = { q: 0, r: 0 };
    /** Reproduced locally from BenchCarousel.test.tsx's module-local, non-exported
     * `makeCard` builder — a minimal `TieredPoolPlayer` with only the fields the
     * carousel/card renderer actually reads given meaningful values. */
    function makeCard(
      id: string,
      tier: DraftTier,
      overrides: Partial<TieredPoolPlayer> = {},
    ): TieredPoolPlayer {
      return {
        id,
        sourceTeamId: 'free-agent',
        firstName: `First${id}`,
        lastName: `Last${id}`,
        number: 0,
        nationality: 'England',
        role: 'FWD',
        position: ORIGIN,
        pace: 3,
        shooting: 3,
        tackling: 3,
        dribbling: 3,
        saving: 3,
        handling: 3,
        resilience: 3,
        aerialAbility: 3,
        highPass: 3,
        tier,
        totalStat: 27,
        ...overrides,
      };
    }

    const card = makeCard('p013', 'common');
    const { container, rerender } = render(
      <BenchCarousel
        cards={[card]}
        teamId="city"
        benchNumbers={{ p013: 13 }}
        onCardDragStart={noop}
        onDropToBench={noop}
      />,
    );
    expect(glyphContract(container)).toEqual(CLEAN);

    rerender(
      <BenchCarousel
        cards={[card]}
        teamId="city"
        benchNumbers={{ p013: 13 }}
        benchCardStatus={{ p013: { cardColor: 'yellow', injuryCount: 1 } }}
        onCardDragStart={noop}
        onDropToBench={noop}
      />,
    );
    expect(glyphContract(container)).toEqual(BOOKED_AND_INJURED);
  });

  it('ICON-02: all four surfaces render the identical glyph contract for the identical state', () => {
    const bookedPiece = { ...cleanPiece, yellowCards: 1 as const, injuryCount: 1 };

    const pitch = render(
      <svg>
        <PieceOverlay
          piece={bookedPiece}
          uniformStyle="pinstripes-vertical"
          palette={COLOR_SCHEME_REGISTRY.city.palette}
          selectionState="none"
          onClick={noop}
          onInspect={noop}
          carrierId={null}
          attackingTeam="home"
        />
      </svg>,
    );
    const pitchResult = glyphContract(pitch.container);
    pitch.unmount();

    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        selectedTeams: { home: 'city', away: 'crew' },
        pieces: [bookedPiece],
      },
      screen: 'GAME_BOARD',
      selectedPieceId: 'home-6',
      validMoveHexes: [],
      playerSlot: 1,
      roomCode: 'ABC12',
      disconnectWarning: false,
      roomError: null,
      gameError: null,
    });
    const scoreboard = render(<PlayerStatsPanel />);
    const scoreboardResult = glyphContract(scoreboard.container);
    scoreboard.unmount();

    const roster = render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={noop}
        onConfirm={noop}
        lineupConfirmed={false}
        mode="midmatch"
        midmatchPieces={[bookedPiece]}
        bench={[]}
        subsUsed={0}
        maxOnPitch={11}
        onSubstitute={noop}
        readOnly={false}
      />,
    );
    const rosterResult = glyphContract(roster.container);
    roster.unmount();

    const ORIGIN: HexCoord = { q: 0, r: 0 };
    const benchCard: TieredPoolPlayer = {
      id: 'p013',
      sourceTeamId: 'free-agent',
      firstName: 'Firstp013',
      lastName: 'Lastp013',
      number: 0,
      nationality: 'England',
      role: 'FWD',
      position: ORIGIN,
      pace: 3,
      shooting: 3,
      tackling: 3,
      dribbling: 3,
      saving: 3,
      handling: 3,
      resilience: 3,
      aerialAbility: 3,
      highPass: 3,
      tier: 'common',
      totalStat: 27,
    };
    const bench = render(
      <BenchCarousel
        cards={[benchCard]}
        teamId="city"
        benchNumbers={{ p013: 13 }}
        benchCardStatus={{ p013: { cardColor: 'yellow', injuryCount: 1 } }}
        onCardDragStart={noop}
        onDropToBench={noop}
      />,
    );
    const benchResult = glyphContract(bench.container);
    bench.unmount();

    const allResults = [pitchResult, scoreboardResult, rosterResult, benchResult];
    for (const result of allResults) {
      expect(result).toEqual(BOOKED_AND_INJURED);
    }
  });
});

/**
 * Phase 42 Plan 10 (Task 1 Part B) — D-07/SUB-18 bench regression check. D-07 states
 * Phase 42 adds no new bench-side component; the obligation here is proving Phase 41's
 * `CardInjuryBadge` (via BenchCarousel/DraftCardBody) still renders correctly on the
 * bench once the reposition/substitution mode rework and the BUG-38 fixes have landed.
 * Reading `LineupAssignmentScreen.tsx`'s mid-match branch shows `unavailablePlayerIds`/
 * `redCardedPlayerIds`/`benchCardStatus` (the props that drive these badges) are all
 * derived from `benchList` alone (~lines 1006-1011) — none reference `subMode`,
 * `readOnly`, `actionPending`, or `pendingSub` — so badge rendering is provably
 * independent of mode/gating state. These tests exercise that independence directly
 * rather than relying on reading alone, since this is the single highest-regression-risk
 * item in the milestone (research PITFALLS.md Pitfall 5).
 */
describe('Bench badge regression — Phase 42 rework (D-07/SUB-18)', () => {
  /** Real PLAYER_POOL ids (p013 Fallou Fall / p014 Mamadou / p015 Timo / p016 Tomas)
   * so PLAYER_MAP/resolveTieredCard lookups resolve — same convention as
   * LineupAssignmentScreen.test.tsx's BENCH_WITH_STATUS fixture. */
  const BENCH_REGRESSION_ENTRIES: BenchEntry[] = [
    { playerId: 'p013', jerseyNumber: 13, status: 'available' },
    { playerId: 'p014', jerseyNumber: 14, status: 'available', injuryCount: 1 },
    { playerId: 'p015', jerseyNumber: 15, status: 'subbedOut' },
    { playerId: 'p016', jerseyNumber: 16, status: 'redCarded' },
  ];

  const HOME_PIECES: PlayerPiece[] = [
    { ...cleanPiece, id: 'home-0', role: 'GK', number: 1, firstName: 'Home', lastName: 'Keeper' },
    { ...cleanPiece, id: 'home-1', role: 'DEF', number: 2, firstName: 'Home', lastName: 'DefOne' },
    { ...cleanPiece, id: 'home-2', role: 'DEF', number: 3, firstName: 'Home', lastName: 'DefTwo' },
  ];

  /** Asserts all three bullets (redCarded glyph+badge, subbedOut OUT badge+dimming,
   * injured glyph) hold, regardless of which mode/gating state the screen is in. */
  function assertBenchBadges() {
    const redBadge = screen.getByTestId('bench-red-card-badge');
    expect(redBadge.textContent).toBe('RED CARD');
    const redCard = redBadge.closest('[class*="cardUnavailable"]');
    expect(redCard).not.toBeNull();
    // Gap-closure (42-10 Section D / gap item 1): the duplicate card glyph is now
    // suppressed on a red-carded bench card — the RED CARD text badge above is the
    // sole surviving indicator. This was inverted from "renders the red-card glyph"
    // when the coexistence was reported as a defect.
    const redGlyphs = within(redCard as HTMLElement).queryAllByTestId('piece-card-badge');
    expect(redGlyphs.length).toBe(0);

    const outBadge = screen.getByTestId('bench-out-badge');
    expect(outBadge.textContent).toBe('OUT');
    const outCard = outBadge.closest('[class*="cardUnavailable"]');
    expect(outCard).not.toBeNull();

    const injuredCard = screen.getByText('#14').closest('[class*="cardBody"]') as HTMLElement;
    expect(within(injuredCard).getByTestId('piece-injury-badge')).toBeDefined();
  }

  function renderRegression(
    overrides: Partial<{ readOnly: boolean; actionPending: boolean }> = {},
  ) {
    return render(
      <LineupAssignmentScreen
        assignment={[]}
        formationId="4-4-2"
        playerSlot={1}
        myTeamId="city"
        onSwap={noop}
        onConfirm={noop}
        lineupConfirmed={false}
        mode="midmatch"
        midmatchPieces={HOME_PIECES}
        bench={BENCH_REGRESSION_ENTRIES}
        subsUsed={0}
        maxOnPitch={11}
        onSubstitute={noop}
        readOnly={overrides.readOnly ?? false}
        onReposition={noop}
        actionPending={overrides.actionPending ?? false}
      />,
    );
  }

  it('redCarded/subbedOut/injured bench badges render in positioning mode (the default)', () => {
    renderRegression();
    assertBenchBadges();
  });

  it('the same bench badges render unchanged after entering substitution mode', () => {
    renderRegression();
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    assertBenchBadges();
  });

  it('bench badges are unaffected by readOnly', () => {
    renderRegression({ readOnly: true });
    assertBenchBadges();
  });

  it('bench badges are unaffected by actionPending', () => {
    renderRegression({ actionPending: true });
    assertBenchBadges();
  });

  it('bench badges are unaffected by an open substitution-confirm popup', () => {
    renderRegression();
    fireEvent.click(screen.getByLabelText('Enter substitution mode'));
    const benchCard = screen.getByText('Fallou Fall').closest('[draggable]') as HTMLElement;
    fireEvent.dragStart(benchCard, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    const target = screen.getByText('Home DefOne').closest('[draggable]') as HTMLElement;
    fireEvent.drop(target, { dataTransfer: { getData: () => '' } });
    expect(screen.getByRole('dialog')).toBeDefined();
    assertBenchBadges();
  });

  it('gap item 1 (42-10 Section D): a red-carded bench entry renders exactly one card indicator — no duplicate glyph beside the RED CARD badge', () => {
    renderRegression();
    const redBadge = screen.getByTestId('bench-red-card-badge');
    const card = redBadge.closest('[class*="cardUnavailable"]') as HTMLElement;
    expect(card).not.toBeNull();

    const cardGlyphs = within(card).queryAllByTestId('piece-card-badge');
    const redCardBadges = within(card).queryAllByTestId('bench-red-card-badge');
    expect(cardGlyphs.length).toBe(0);
    expect(redCardBadges.length).toBe(1);
    expect(cardGlyphs.length + redCardBadges.length).toBe(1);
  });
});
