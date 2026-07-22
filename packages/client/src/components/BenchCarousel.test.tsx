/**
 * BenchCarousel.test.tsx — Phase 29 gap-closure DRAFT-09/D-21 component tests
 * (29-08-PLAN.md Task 1).
 *
 * Covers: carousel nav chrome (Previous/Next buttons), cards render inside a
 * scroll track (not a wrapping row), N cards render for N benched cards,
 * the drop-target contract (onDropToBench) still fires on a container drop,
 * the drag-source contract (onCardDragStart) still fires with the bench
 * index on a card drag-start, and the D-22 empty-bench placeholder remains a
 * valid drop target.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { TieredPoolPlayer, DraftTier, HexCoord } from '@counter-attack/shared';
import { BenchCarousel } from './BenchCarousel.js';
import { TIER_CARD_CLASS } from './DraftPackCarousel.js';

afterEach(() => cleanup());

const ORIGIN: HexCoord = { q: 0, r: 0 };

/** Builds a minimal TieredPoolPlayer for tests — only the fields the carousel /
 * card renderer actually reads are given meaningful values. */
function makeCard(
  id: string,
  tier: DraftTier,
  overrides: Partial<TieredPoolPlayer> = {},
): TieredPoolPlayer {
  const role = tier === 'keeper' ? 'GK' : 'FWD';
  return {
    id,
    sourceTeamId: 'free-agent',
    firstName: `First${id}`,
    lastName: `Last${id}`,
    number: 0,
    nationality: 'England',
    role,
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

describe('BenchCarousel — DRAFT-09/D-21: carousel nav chrome', () => {
  it('renders Previous/Next nav buttons with correct aria-labels', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    expect(screen.getByLabelText('Previous card')).toBeDefined();
    expect(screen.getByLabelText('Next card')).toBeDefined();
  });

  it('renders cards inside a single scroll track, not a wrapping flex row', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    const track = container.querySelector('[class*="carouselTrack"]');
    expect(track).not.toBeNull();
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    expect(track!.contains(cardEl)).toBe(true);
  });

  it('renders N DraftCardBody cards for N benched cards', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare'), makeCard('b3', 'chase')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    const cardEls = container.querySelectorAll('[class*="cardBody"]');
    expect(cardEls.length).toBe(3);
  });
});

describe('BenchCarousel — drag-source/drop-target contract preserved', () => {
  it('still fires onDropToBench on a container drop', () => {
    const onDropToBench = vi.fn();
    const cards = [makeCard('b1', 'common')];
    render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={onDropToBench}
      />,
    );
    const benchEl = screen.getByTestId('bench-carousel');
    fireEvent.drop(benchEl, { dataTransfer: { getData: () => '' } });
    expect(onDropToBench).toHaveBeenCalledTimes(1);
  });

  it('still fires onCardDragStart(benchIndex) on a card drag-start', () => {
    const onCardDragStart = vi.fn();
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardDragStart={onCardDragStart}
        onDropToBench={() => {}}
      />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.rare}`);
    fireEvent.dragStart(cardEl!, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    expect(onCardDragStart).toHaveBeenCalledWith(1);
  });
});

describe('BenchCarousel — D-22: empty bench placeholder', () => {
  it('renders the dashed benchSlot placeholder for 0 cards and it remains a valid drop target', () => {
    const onDropToBench = vi.fn();
    render(
      <BenchCarousel
        cards={[]}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={onDropToBench}
      />,
    );
    const benchEl = screen.getByTestId('bench-carousel');
    const slot = benchEl.querySelector('[class*="benchSlot"]');
    expect(slot).not.toBeNull();
    fireEvent.drop(benchEl, { dataTransfer: { getData: () => '' } });
    expect(onDropToBench).toHaveBeenCalledTimes(1);
  });
});

describe('BenchCarousel — DRAFT-09 scroll stability (gap-closure 29-12)', () => {
  /** jsdom performs no layout: native scrollLeft does not persist meaningfully and
   * scrollWidth/clientWidth read 0. Installing a controllable property backed by a
   * local variable makes the scroll-reset effect's `el.scrollLeft = 0` write
   * observable via a real setter, without needing real layout. */
  function installControllableScrollLeft(track: Element): { get: () => number } {
    let value = 0;
    Object.defineProperty(track, 'scrollLeft', {
      configurable: true,
      get: () => value,
      set: (v: number) => {
        value = v;
      },
    });
    return { get: () => value };
  }

  it('does NOT reset scroll on an unrelated re-render (new array reference, identical ids)', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container, rerender } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    const track = container.querySelector('[class*="carouselTrack"]')!;
    const scrollLeft = installControllableScrollLeft(track);
    (track as HTMLDivElement).scrollLeft = 150;
    expect(scrollLeft.get()).toBe(150);

    // Brand-new array object, SAME ids — mirrors the pre-fix parent producing a
    // fresh benchCards reference on every dragover tick.
    const rerenderedCards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    rerender(
      <BenchCarousel
        cards={rerenderedCards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );

    expect(scrollLeft.get()).toBe(150);
  });

  it('DOES reset scroll when benched content actually changes', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container, rerender } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    const track = container.querySelector('[class*="carouselTrack"]')!;
    const scrollLeft = installControllableScrollLeft(track);
    (track as HTMLDivElement).scrollLeft = 150;
    expect(scrollLeft.get()).toBe(150);

    // Ids differ (b3 appended) — bench content genuinely changed.
    const rerenderedCards = [
      makeCard('b1', 'common'),
      makeCard('b2', 'rare'),
      makeCard('b3', 'chase'),
    ];
    rerender(
      <BenchCarousel
        cards={rerenderedCards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );

    expect(scrollLeft.get()).toBe(0);
  });
});
