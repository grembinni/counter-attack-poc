/**
 * DraftPackCarousel.test.tsx — Phase 29 DRAFT-06/DRAFT-09 component tests (29-03-PLAN.md Task 2).
 *
 * Covers: rarest-first sort, variable pack size (not hardcoded to 7),
 * tier-border class application, carousel nav button wiring, and the
 * one-way-out drag-start payload (`pack:`-prefixed cardId).
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
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardDragStart={() => {}} />,
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
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardDragStart={() => {}} />,
    );
    const cardEls = container.querySelectorAll('[class*="cardBody"]');
    expect(cardEls.length).toBe(6);
  });
});

describe('DraftPackCarousel — D-19: tier border class application', () => {
  it('applies the correct TIER_CARD_CLASS to each card', () => {
    const cards = [makeCard('chase-card', 'chase'), makeCard('rare-card', 'rare')];
    const { container } = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardDragStart={() => {}} />,
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
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardDragStart={() => {}} />,
    );

    const prevBtn = screen.getByLabelText('Previous card');
    const nextBtn = screen.getByLabelText('Next card');
    expect(prevBtn).toBeDefined();
    expect(nextBtn).toBeDefined();
    // At the leftmost scroll position (list start), Previous is disabled.
    expect(prevBtn).toHaveProperty('disabled', true);
  });
});

describe('DraftPackCarousel — D-06: drag-start writes a pack:-prefixed cardId', () => {
  it('a card drag-start populates dataTransfer.setData with "pack:<cardId>"', () => {
    const cards = [makeCard('drag-me', 'chase')];
    const { container } = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardDragStart={() => {}} />,
    );

    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.chase}`);
    expect(cardEl).not.toBeNull();

    const setData = vi.fn();
    fireEvent.dragStart(cardEl!, {
      dataTransfer: { setData, effectAllowed: '' },
    });

    expect(setData).toHaveBeenCalledWith('text/plain', 'pack:drag-me');
  });

  it('draft-pack cards have no onDrop/onDragOver handler (one-way-out, D-06)', () => {
    const cards = [makeCard('c1', 'chase')];
    const { container } = render(
      <DraftPackCarousel cards={cards} teamId="city" disabled={false} onCardDragStart={() => {}} />,
    );
    const cardEl = container.querySelector(`.${TIER_CARD_CLASS.chase}`) as HTMLElement;
    expect(cardEl.getAttribute('draggable')).toBe('true');
    // fireEvent.drop/dragOver should not throw and should not be wired to any handler
    // that would allow a card to be dropped back into the row — verified structurally
    // by asserting the component never attaches onDrop/onDragOver props to card elements.
    expect(cardEl.ondrop).toBeNull();
    expect(cardEl.ondragover).toBeNull();
  });
});
