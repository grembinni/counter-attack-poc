/**
 * BenchCarousel.test.tsx — Phase 29 gap-closure DRAFT-09/D-21 component tests
 * (29-08-PLAN.md Task 1), rewritten for click-select in Phase 47 (ROSTER-08).
 *
 * Covers: carousel nav chrome (Previous/Next buttons), cards render inside a
 * scroll track (not a wrapping row), N cards render for N benched cards, the
 * D-22 empty-bench placeholder, tier-border classes, benchNumbers jersey
 * rendering, OUT/RED CARD badge precedence + data-testid hooks,
 * CardInjuryBadge glyph presence/absence/ordering, and scroll-reset-on-
 * content-change — plus the click-select contract (Phase 47 / ROSTER-08):
 * click-to-select a bench card, source guards (disabled/OUT/RED CARD),
 * selected/eligible visuals, bench-area click-completion, and
 * click-propagation isolation (card click and nav click must not also
 * complete the bench-area target). Zero drag simulation remains.
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
    render(<BenchCarousel cards={cards} teamId="city" onCardClick={() => {}} />);
    expect(screen.getByLabelText('Previous card')).toBeDefined();
    expect(screen.getByLabelText('Next card')).toBeDefined();
  });

  it('renders cards inside a single scroll track, not a wrapping flex row', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel cards={cards} teamId="city" onCardClick={() => {}} />,
    );
    const track = container.querySelector('[class*="carouselTrack"]');
    expect(track).not.toBeNull();
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    expect(track!.contains(cardEl)).toBe(true);
  });

  it('renders N DraftCardBody cards for N benched cards', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare'), makeCard('b3', 'chase')];
    const { container } = render(
      <BenchCarousel cards={cards} teamId="city" onCardClick={() => {}} />,
    );
    const cardEls = container.querySelectorAll('[class*="cardBody"]');
    expect(cardEls.length).toBe(3);
  });
});

describe('BenchCarousel — Phase 47 (ROSTER-08): click-select source', () => {
  it('clicking an available bench card calls onCardClick exactly once with that bench index', () => {
    const onCardClick = vi.fn();
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container } = render(
      <BenchCarousel cards={cards} teamId="city" onCardClick={onCardClick} />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.rare}`);
    fireEvent.click(cardEl!);
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).toHaveBeenCalledWith(1);
  });

  it('clicking an OUT card does NOT call onCardClick', () => {
    const onCardClick = vi.fn();
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        unavailablePlayerIds={['b1']}
        onCardClick={onCardClick}
      />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    fireEvent.click(cardEl!);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('clicking a RED CARD card does NOT call onCardClick', () => {
    const onCardClick = vi.fn();
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        redCardedPlayerIds={['b1']}
        onCardClick={onCardClick}
      />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    fireEvent.click(cardEl!);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('clicking any card while disabled is true does NOT call onCardClick', () => {
    const onCardClick = vi.fn();
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel cards={cards} teamId="city" disabled onCardClick={onCardClick} />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    fireEvent.click(cardEl!);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('selectedCardId applies a statCardSelected-matching class to exactly one card wrapper', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container } = render(
      <BenchCarousel cards={cards} teamId="city" selectedCardId="b2" onCardClick={() => {}} />,
    );
    const cardEls = Array.from(container.querySelectorAll('[data-roster-card]'));
    expect(cardEls).toHaveLength(2);
    const selected = cardEls.filter((el) => /statCardSelected/.test(el.className));
    expect(selected).toHaveLength(1);
    expect(selected[0]!.textContent).toContain('Firstb2');
  });
});

describe('BenchCarousel — Phase 47 (ROSTER-08/T-47-07): bench-area click-completion target', () => {
  it('benchAreaEligible true applies a statCardEligible-matching class to the bench container, and clicking it calls onBenchAreaClick once', () => {
    const onBenchAreaClick = vi.fn();
    const cards = [makeCard('b1', 'common')];
    render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchAreaEligible
        onCardClick={() => {}}
        onBenchAreaClick={onBenchAreaClick}
      />,
    );
    const benchEl = screen.getByTestId('bench-carousel');
    expect(benchEl.className).toMatch(/statCardEligible/);
    fireEvent.click(benchEl);
    expect(onBenchAreaClick).toHaveBeenCalledTimes(1);
  });

  it('benchAreaEligible false (omitted): clicking the container does NOT call onBenchAreaClick', () => {
    const onBenchAreaClick = vi.fn();
    const cards = [makeCard('b1', 'common')];
    render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        onCardClick={() => {}}
        onBenchAreaClick={onBenchAreaClick}
      />,
    );
    const benchEl = screen.getByTestId('bench-carousel');
    expect(benchEl.className).not.toMatch(/statCardEligible/);
    fireEvent.click(benchEl);
    expect(onBenchAreaClick).not.toHaveBeenCalled();
  });

  it('with benchAreaEligible true, clicking a bench CARD calls onCardClick and does NOT also call onBenchAreaClick (propagation guard regression test)', () => {
    const onCardClick = vi.fn();
    const onBenchAreaClick = vi.fn();
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchAreaEligible
        onCardClick={onCardClick}
        onBenchAreaClick={onBenchAreaClick}
      />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    fireEvent.click(cardEl!);
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onBenchAreaClick).not.toHaveBeenCalled();
  });

  it('with benchAreaEligible true, clicking the Next card nav button does NOT call onBenchAreaClick', () => {
    const onBenchAreaClick = vi.fn();
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchAreaEligible
        onCardClick={() => {}}
        onBenchAreaClick={onBenchAreaClick}
      />,
    );
    fireEvent.click(screen.getByLabelText('Next card'));
    expect(onBenchAreaClick).not.toHaveBeenCalled();
  });

  it('with benchAreaEligible true, clicking the Previous card nav button does NOT call onBenchAreaClick', () => {
    const onBenchAreaClick = vi.fn();
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchAreaEligible
        onCardClick={() => {}}
        onBenchAreaClick={onBenchAreaClick}
      />,
    );
    fireEvent.click(screen.getByLabelText('Previous card'));
    expect(onBenchAreaClick).not.toHaveBeenCalled();
  });
});

describe('BenchCarousel — checkpoint gap-closure (40-07 Task 2): disabled/read-only bench', () => {
  it('every card reports data-interactive="false" when disabled is true, even a normally-available card', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container } = render(
      <BenchCarousel cards={cards} teamId="city" disabled onCardClick={() => {}} />,
    );
    const cardEls = container.querySelectorAll('[data-roster-card]');
    expect(cardEls.length).toBe(2);
    cardEls.forEach((el) => expect(el.getAttribute('data-interactive')).toBe('false'));
  });

  it('onCardClick is never called from a card click when disabled is true', () => {
    const onCardClick = vi.fn();
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel cards={cards} teamId="city" disabled onCardClick={onCardClick} />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    fireEvent.click(cardEl!);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('data-interactive stays "true" (unaffected) when disabled is false/undefined', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel cards={cards} teamId="city" onCardClick={() => {}} />,
    );
    const cardEl = container.querySelector('[data-roster-card]');
    expect(cardEl?.getAttribute('data-interactive')).toBe('true');
  });
});

describe('BenchCarousel — D-22: empty bench placeholder', () => {
  it('renders the dashed benchSlot placeholder for 0 cards', () => {
    render(<BenchCarousel cards={[]} teamId="city" onCardClick={() => {}} />);
    const benchEl = screen.getByTestId('bench-carousel');
    const slot = benchEl.querySelector('[class*="benchSlot"]');
    expect(slot).not.toBeNull();
  });

  it('empty bench remains a valid click-completion target when benchAreaEligible', () => {
    const onBenchAreaClick = vi.fn();
    render(
      <BenchCarousel
        cards={[]}
        teamId="city"
        benchAreaEligible
        onCardClick={() => {}}
        onBenchAreaClick={onBenchAreaClick}
      />,
    );
    const benchEl = screen.getByTestId('bench-carousel');
    fireEvent.click(benchEl);
    expect(onBenchAreaClick).toHaveBeenCalledTimes(1);
  });
});

describe('BenchCarousel — Phase 41 (ICON-03): bench card/injury glyph', () => {
  it('no benchCardStatus prop renders no badge markup at all (pre-match draft non-regression)', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container } = render(
      <BenchCarousel cards={cards} teamId="city" onCardClick={() => {}} />,
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
        onCardClick={() => {}}
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
        onCardClick={() => {}}
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
        onCardClick={() => {}}
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
        onCardClick={() => {}}
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
        onCardClick={() => {}}
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
        onCardClick={() => {}}
      />,
    );
    const cardNum = container.querySelector('[class*="cardNum"]') as HTMLElement;
    expect(cardNum).not.toBeNull();
    const glyph = cardNum.nextElementSibling;
    expect(glyph?.getAttribute('data-testid')).toBe('card-injury-badge');
    const statusBadge = glyph?.nextElementSibling;
    expect(statusBadge?.getAttribute('data-testid')).toBe('bench-out-badge');
  });

  it('the glyph never affects interactivity', () => {
    const cards = [makeCard('b1', 'common')];
    const { container } = render(
      <BenchCarousel
        cards={cards}
        teamId="city"
        benchCardStatus={{ b1: { cardColor: 'red', injuryCount: 0 } }}
        onCardClick={() => {}}
      />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.common}`);
    expect(cardEl?.getAttribute('data-interactive')).toBe('true');
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
      <BenchCarousel cards={cards} teamId="city" onCardClick={() => {}} />,
    );
    const track = container.querySelector('[class*="carouselTrack"]')!;
    const scrollLeft = installControllableScrollLeft(track);
    (track as HTMLDivElement).scrollLeft = 150;
    expect(scrollLeft.get()).toBe(150);

    // Brand-new array object, SAME ids — mirrors the pre-fix parent producing a
    // fresh benchCards reference on every re-render tick.
    const rerenderedCards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    rerender(<BenchCarousel cards={rerenderedCards} teamId="city" onCardClick={() => {}} />);

    expect(scrollLeft.get()).toBe(150);
  });

  it('DOES reset scroll when benched content actually changes', () => {
    const cards = [makeCard('b1', 'common'), makeCard('b2', 'rare')];
    const { container, rerender } = render(
      <BenchCarousel cards={cards} teamId="city" onCardClick={() => {}} />,
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
    rerender(<BenchCarousel cards={rerenderedCards} teamId="city" onCardClick={() => {}} />);

    expect(scrollLeft.get()).toBe(0);
  });
});
