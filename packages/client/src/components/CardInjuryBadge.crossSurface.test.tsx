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
import { render, cleanup, act } from '@testing-library/react';
import type { PlayerPiece, HexCoord } from '@counter-attack/shared';
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
