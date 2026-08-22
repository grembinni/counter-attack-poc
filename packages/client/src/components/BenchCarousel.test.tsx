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
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
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
  const role = 'FWD';
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

describe('BenchCarousel — checkpoint gap-closure (40-07 Task 2): disabled/read-only bench', () => {
  it('every card is draggable="false" when disabled is true, even a normally-available card', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        disabled
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    const cardEls = container.querySelectorAll('[draggable]');
    expect(cardEls.length).toBe(2);
    cardEls.forEach((el) => expect(el.getAttribute('draggable')).toBe('false'));
  });

  it('onCardDragStart is never called from a card drag-start when disabled is true', () => {
    const onCardDragStart = vi.fn();
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        disabled
        onCardDragStart={onCardDragStart}
        onDropToBench={() => {}}
      />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    fireEvent.dragStart(cardEl!, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    expect(onCardDragStart).not.toHaveBeenCalled();
  });

  it('onDropToBench is never called from a container drop when disabled is true', () => {
    const onDropToBench = vi.fn();
    const cards = [makeCard('b1', 'common')];
    render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        disabled
        onCardDragStart={() => {}}
        onDropToBench={onDropToBench}
      />,
    );
    const benchEl = screen.getByTestId('bench-carousel');
    fireEvent.drop(benchEl, { dataTransfer: { getData: () => '' } });
    expect(onDropToBench).not.toHaveBeenCalled();
  });

  it('draggable stays true (unaffected) when disabled is false/undefined', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    const cardEl = container.querySelector('[draggable]');
    expect(cardEl?.getAttribute('draggable')).toBe('true');
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

describe('BenchCarousel — Phase 41 (ICON-03): bench card/injury glyph', () => {
  it('no benchCardStatus prop renders no badge markup at all (pre-match draft non-regression)', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="card-injury-badge"]')).toBeNull();
  });

  it('ICON-03: a booked bench player shows a yellow card glyph', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchCardStatus={{ b1: { cardColor: 'yellow', injuryCount: 0 } }}
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    const badges = container.querySelectorAll('[data-testid="card-injury-badge"]');
    expect(badges.length).toBe(1);
    const cardBadge = badges[0]!.querySelector('[data-testid="piece-card-badge"]');
    expect(cardBadge?.getAttribute('data-card')).toBe('yellow');

    const b2El = container.querySelector(`.${TIER_CARD_CLASS.rare}`) as HTMLElement;
    expect(within(b2El).queryByTestId('card-injury-badge')).toBeNull();
  });

  it('ICON-03: an injured bench player shows exactly one injury glyph and no card glyph', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchCardStatus={{ b1: { cardColor: null, injuryCount: 1 } }}
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    expect(container.querySelectorAll('[data-testid="piece-injury-badge"]').length).toBe(1);
    expect(container.querySelectorAll('[data-testid="piece-card-badge"]').length).toBe(0);
    const wrapper = container.querySelector('[data-testid="card-injury-badge"]');
    expect(wrapper?.getAttribute('aria-label')).toBe('Injured');
  });

  it('ICON-03: injuryCount 2 still renders one glyph, with the count only in the label', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchCardStatus={{ b1: { cardColor: 'yellow', injuryCount: 2 } }}
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    expect(container.querySelectorAll('[data-testid="piece-injury-badge"]').length).toBe(1);
    const cardRect = container.querySelector('[data-testid="piece-card-badge"]') as SVGRectElement;
    const injuryGroup = container.querySelector('[data-testid="piece-injury-badge"]');
    expect(cardRect).not.toBeNull();
    expect(injuryGroup).not.toBeNull();
    const wrapper = container.querySelector('[data-testid="card-injury-badge"]');
    expect(wrapper?.getAttribute('aria-label')).toBe('Yellow card, Injured ×2');

    const cardRight = Number(cardRect.getAttribute('x')) + Number(cardRect.getAttribute('width'));
    const injuryFirstRect = injuryGroup!.querySelector('rect') as SVGRectElement;
    const injuryLeft = Number(injuryFirstRect.getAttribute('x'));
    expect(cardRight).toBeLessThanOrEqual(injuryLeft);
  });

  it('gap item 1: a red-carded bench card shows ONLY the RED CARD text badge — the duplicate card glyph is suppressed', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        redCardedPlayerIds={['b1']}
        benchCardStatus={{ b1: { cardColor: 'red', injuryCount: 0 } }}
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="piece-card-badge"]')).toBeNull();
    expect(container.querySelector('[data-testid="card-injury-badge"]')).toBeNull();
    const badge = screen.getByTestId('bench-red-card-badge');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('RED CARD');
  });

  it('gap item 1: a red-carded AND injured bench card still renders the injury glyph, with the card glyph still suppressed', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        redCardedPlayerIds={['b1']}
        benchCardStatus={{ b1: { cardColor: 'red', injuryCount: 1 } }}
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="piece-injury-badge"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="piece-card-badge"]')).toBeNull();
    const badge = screen.getByTestId('bench-red-card-badge');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('RED CARD');
  });

  it('ICON-02/D-02: the bench glyph sits between the jersey number and the status badge', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchNumbers={{ b1: 13 }}
        unavailablePlayerIds={['b1']}
        benchCardStatus={{ b1: { cardColor: 'yellow', injuryCount: 0 } }}
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    const cardNum = container.querySelector('[class*="cardNum"]') as HTMLElement;
    expect(cardNum).not.toBeNull();
    const glyph = cardNum.nextElementSibling;
    expect(glyph?.getAttribute('data-testid')).toBe('card-injury-badge');
    const statusBadge = glyph?.nextElementSibling;
    expect(statusBadge?.getAttribute('data-testid')).toBe('bench-out-badge');
  });

  it('the glyph never affects draggability', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchCardStatus={{ b1: { cardColor: 'red', injuryCount: 0 } }}
        onCardDragStart={() => {}}
        onDropToBench={() => {}}
      />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    expect(cardEl?.getAttribute('draggable')).toBe('true');
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
