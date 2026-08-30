/**
 * DraftPackCarousel.test.tsx — Phase 29 DRAFT-06/DRAFT-09 component tests (29-03-PLAN.md Task 2),
 * rewritten for click-select in Phase 47 (ROSTER-08).
 *
 * Covers: rarest-first sort, variable pack size (not hardcoded to 7),
 * tier-border class application, carousel nav button wiring, and the
 * pack row as a click-select source (Phase 47 / ROSTER-08) — click-to-pick,
 * disabled-click suppression, selected-class application, and keyboard
 * (Enter) activation. Zero drag simulation remains.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { TieredPoolPlayer, DraftTier, HexCoord } from '@counter-attack/shared';
import { DraftPackCarousel, TIER_CARD_CLASS } from './DraftPackCarousel.js';

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

describe('DraftPackCarousel — DRAFT-06: rarest-first sort', () => {
  it('renders a mixed-tier pack with the chase-tier card before the common-tier card (D-20)', () => {
    const cards = [
      makeCard('common-1', 'common'),
      makeCard('chase-1', 'chase'),
      makeCard('uncommon-1', 'uncommon'),
    ];
    const { container } = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardClick={() => {}} />,
    );

    const names = Array.from(container.querySelectorAll('[class*="cardName"]')).map(
      (el) => el.textContent,
    );
    const chaseIdx = names.findIndex((n) => n?.includes('Firstchase-1'));
    const commonIdx = names.findIndex((n) => n?.includes('Firstcommon-1'));
    expect(chaseIdx).toBeGreaterThanOrEqual(0);
    expect(commonIdx).toBeGreaterThanOrEqual(0);
    expect(chaseIdx).toBeLessThan(commonIdx);
  });
});

describe('DraftPackCarousel — DRAFT-06: variable pack size (not hardcoded to 7)', () => {
  it('a 6-card pack renders exactly 6 cards', () => {
    const cards = [
      makeCard('c1', 'chase'),
      makeCard('c2', 'rare'),
      makeCard('c3', 'uncommon'),
      makeCard('c4', 'common'),
      makeCard('c5', 'common'),
      makeCard('c6', 'common'),
    ];
    const { container } = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardClick={() => {}} />,
    );
    const cardEls = container.querySelectorAll('[class*="cardBody"]');
    expect(cardEls.length).toBe(6);
  });
});

describe('DraftPackCarousel — D-19: tier border class application', () => {
  it('applies the correct TIER_CARD_CLASS to each card', () => {
    const cards = [makeCard('chase-card', 'chase'), makeCard('rare-card', 'rare')];
    const { container } = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardClick={() => {}} />,
    );
    const chaseCardEl = Array.from(container.querySelectorAll(`.${TIER_CARD_CLASS.chase}`));
    const rareCardEl = Array.from(container.querySelectorAll(`.${TIER_CARD_CLASS.rare}`));
    expect(chaseCardEl.length).toBe(1);
    expect(rareCardEl.length).toBe(1);
  });
});

describe('DraftPackCarousel — D-20: left/right nav wiring', () => {
  it('renders Previous/Next nav buttons with correct aria-labels; Previous is disabled at the list start', () => {
    const cards = [makeCard('c1', 'chase'), makeCard('c2', 'common')];
    render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardClick={() => {}} />,
    );

    const prevBtn = screen.getByLabelText('Previous card');
    const nextBtn = screen.getByLabelText('Next card');
    expect(prevBtn).toBeDefined();
    expect(nextBtn).toBeDefined();
    // At the leftmost scroll position (list start), Previous is disabled.
    expect(prevBtn).toHaveProperty('disabled', true);
  });
});

describe('DraftPackCarousel — Phase 47 (D-11/ROSTER-08): click selection source', () => {
  it('clicking a card calls onCardClick once with that card id', () => {
    const cards = [makeCard('click-me', 'chase')];
    const onCardClick = vi.fn();
    const { container } = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardClick={onCardClick} />,
    );

    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.chase}`);
    expect(cardEl).not.toBeNull();

    fireEvent.click(cardEl!);

    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).toHaveBeenCalledWith('click-me');
  });

  it('cards report data-interactive="true" when not disabled, "false" when disabled', () => {
    const cards = [makeCard('c1', 'chase')];

    const enabled = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardClick={() => {}} />,
    );
    const enabledCard = enabled.container.querySelector('[data-roster-card]') as HTMLElement;
    expect(enabledCard.getAttribute('data-interactive')).toBe('true');
    enabled.unmount();

    const disabled = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={true} onCardClick={() => {}} />,
    );
    const disabledCard = disabled.container.querySelector('[data-roster-card]') as HTMLElement;
    expect(disabledCard.getAttribute('data-interactive')).toBe('false');
  });

  it('clicking a card while disabled does NOT call onCardClick', () => {
    const cards = [makeCard('c1', 'chase')];
    const onCardClick = vi.fn();
    const { container } = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={true} onCardClick={onCardClick} />,
    );

    const cardEl = container.querySelector('[data-roster-card]') as HTMLElement;
    fireEvent.click(cardEl);

    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('selectedCardId applies a statCardSelected-matching class to only the matching card', () => {
    const cards = [makeCard('a', 'chase'), makeCard('b', 'rare')];
    const { container } = render(
      <DraftPackCarousel
        cards={cards}
        teamId="city"
        disabled={false}
        onCardClick={() => {}}
        selectedCardId="b"
      />,
    );

    const cardEls = Array.from(container.querySelectorAll('[data-roster-card]'));
    expect(cardEls).toHaveLength(2);
    const selected = cardEls.filter((el) => /statCardSelected/.test(el.className));
    expect(selected).toHaveLength(1);
    // The selected card is the one whose name contains "Firstb".
    expect(selected[0]!.textContent).toContain('Firstb');
  });

  it('pressing Enter on an interactive card calls onCardClick once with that card id', () => {
    const cards = [makeCard('enter-me', 'chase')];
    const onCardClick = vi.fn();
    const { container } = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardClick={onCardClick} />,
    );

    const cardEl = container.querySelector('[data-roster-card]') as HTMLElement;
    fireEvent.keyDown(cardEl, { key: 'Enter' });

    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).toHaveBeenCalledWith('enter-me');
  });
});
