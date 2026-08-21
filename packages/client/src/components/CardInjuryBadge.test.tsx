/**
 * CardInjuryBadge.test.tsx — Phase 41 plan 41-01 Task 2 unit spec.
 *
 * Covers every case in 41-01-PLAN.md Task 1's <behavior> block, organised into four
 * describe blocks: pure-function derivation (cardColorFor/cardColorForBenchEntry),
 * cardInjuryLabel string composition, the standalone CardInjuryBadge's self-contained
 * <svg> (D-04 side-by-side layout), and CardInjuryBadgeGroup's layered pitch-token
 * treatment (D-03, both glyphs centred on the same point).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  cardColorFor,
  cardColorForBenchEntry,
  cardInjuryLabel,
  CardInjuryBadge,
  CardInjuryBadgeGroup,
} from './CardInjuryBadge.js';

afterEach(() => cleanup());

describe('cardColorFor / cardColorForBenchEntry (precedence)', () => {
  it('cardColorFor({ redCarded: true }) returns "red"', () => {
    expect(cardColorFor({ redCarded: true })).toBe('red');
  });

  it('cardColorFor({ yellowCards: 1 }) returns "yellow"', () => {
    expect(cardColorFor({ yellowCards: 1 })).toBe('yellow');
  });

  it('cardColorFor({ yellowCards: 2 }) with no red still returns "yellow"', () => {
    expect(cardColorFor({ yellowCards: 2 })).toBe('yellow');
  });

  it('cardColorFor({ yellowCards: 1, redCarded: true }) returns "red" (red wins)', () => {
    expect(cardColorFor({ yellowCards: 1, redCarded: true })).toBe('red');
  });

  it('cardColorFor({}) returns null for an undefined-field clean object', () => {
    expect(cardColorFor({})).toBeNull();
  });

  it('cardColorForBenchEntry({ status: "redCarded" }) returns "red"', () => {
    expect(cardColorForBenchEntry({ status: 'redCarded' })).toBe('red');
  });

  it('cardColorForBenchEntry({ status: "subbedOut", yellowCards: 1 }) returns "yellow"', () => {
    expect(cardColorForBenchEntry({ status: 'subbedOut', yellowCards: 1 })).toBe('yellow');
  });

  it('cardColorForBenchEntry({ status: "available" }) returns null', () => {
    expect(cardColorForBenchEntry({ status: 'available' })).toBeNull();
  });
});

describe('cardInjuryLabel', () => {
  it('cardInjuryLabel("yellow", 0) returns "Yellow card"', () => {
    expect(cardInjuryLabel('yellow', 0)).toBe('Yellow card');
  });

  it('cardInjuryLabel("red", 0) returns "Red card"', () => {
    expect(cardInjuryLabel('red', 0)).toBe('Red card');
  });

  it('cardInjuryLabel(null, 1) returns "Injured"', () => {
    expect(cardInjuryLabel(null, 1)).toBe('Injured');
  });

  it('cardInjuryLabel(null, 2) returns "Injured ×2" (U+00D7 multiplication sign)', () => {
    expect(cardInjuryLabel(null, 2)).toBe('Injured ×2');
  });

  it('cardInjuryLabel("yellow", 1) returns the two-part join "Yellow card, Injured"', () => {
    expect(cardInjuryLabel('yellow', 1)).toBe('Yellow card, Injured');
  });

  it('cardInjuryLabel(null, 0) returns an empty string', () => {
    expect(cardInjuryLabel(null, 0)).toBe('');
  });
});

describe('CardInjuryBadge — standalone self-contained <svg> (D-04 side-by-side)', () => {
  it('a clean piece (no card, no injury) renders no badge markup at all', () => {
    const { container } = render(<CardInjuryBadge cardColor={null} injuryCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('cardColor="yellow" renders one svg wrapper containing exactly one card badge and zero injury badges', () => {
    const { container } = render(<CardInjuryBadge cardColor="yellow" injuryCount={0} />);
    const svg = container.querySelector('[data-testid="card-injury-badge"]');
    expect(svg).not.toBeNull();
    const cardBadges = container.querySelectorAll('[data-testid="piece-card-badge"]');
    expect(cardBadges.length).toBe(1);
    expect(cardBadges[0]!.getAttribute('data-card')).toBe('yellow');
    expect(container.querySelectorAll('[data-testid="piece-injury-badge"]').length).toBe(0);
  });

  it('cardColor="red" renders one card badge with data-card="red"', () => {
    const { container } = render(<CardInjuryBadge cardColor="red" injuryCount={0} />);
    const cardBadges = container.querySelectorAll('[data-testid="piece-card-badge"]');
    expect(cardBadges.length).toBe(1);
    expect(cardBadges[0]!.getAttribute('data-card')).toBe('red');
  });

  it('injuryCount: 1 renders exactly one injury glyph (binary treatment)', () => {
    const { container } = render(<CardInjuryBadge cardColor={null} injuryCount={1} />);
    expect(container.querySelectorAll('[data-testid="piece-injury-badge"]').length).toBe(1);
  });

  it('injuryCount: 2 still renders exactly ONE injury glyph — no second cross, no numeric overlay', () => {
    const { container } = render(<CardInjuryBadge cardColor={null} injuryCount={2} />);
    expect(container.querySelectorAll('[data-testid="piece-injury-badge"]').length).toBe(1);
  });

  it('cardColor="red" + injuryCount=1 renders both glyphs with non-overlapping horizontal extents (D-04)', () => {
    const { container } = render(<CardInjuryBadge cardColor="red" injuryCount={1} />);
    const cardRect = container.querySelector('[data-testid="piece-card-badge"]') as SVGRectElement;
    const injuryGroup = container.querySelector('[data-testid="piece-injury-badge"]');
    expect(cardRect).not.toBeNull();
    expect(injuryGroup).not.toBeNull();

    const cardRight = Number(cardRect.getAttribute('x')) + Number(cardRect.getAttribute('width'));
    const injuryFirstRect = injuryGroup!.querySelector('rect') as SVGRectElement;
    const injuryLeft = Number(injuryFirstRect.getAttribute('x'));

    expect(cardRight).toBeLessThanOrEqual(injuryLeft);
  });

  it('wrapper carries data-testid="card-injury-badge" and the expected aria-label for both-present', () => {
    const { container } = render(<CardInjuryBadge cardColor="yellow" injuryCount={1} />);
    const svg = container.querySelector('[data-testid="card-injury-badge"]');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-label')).toBe('Yellow card, Injured');
  });

  it('the card rect fill resolves to the red/yellow token and the cross fill resolves to the inverse-text token', () => {
    const { container: redContainer } = render(<CardInjuryBadge cardColor="red" injuryCount={1} />);
    const redCardRect = redContainer.querySelector('[data-testid="piece-card-badge"]');
    expect(redCardRect!.getAttribute('fill')).toBe('var(--color-card-red)');
    const crossRect = redContainer.querySelector('[data-testid="piece-injury-badge"] rect');
    expect(crossRect!.getAttribute('fill')).toBe('var(--color-text-inverse)');

    const { container: yellowContainer } = render(
      <CardInjuryBadge cardColor="yellow" injuryCount={0} />,
    );
    const yellowCardRect = yellowContainer.querySelector('[data-testid="piece-card-badge"]');
    expect(yellowCardRect!.getAttribute('fill')).toBe('var(--color-card-yellow)');
  });
});

describe('CardInjuryBadgeGroup — layered pitch-token treatment (D-03)', () => {
  it('centres both the card rect and the injury cross on the passed cx/cy (layered, not side-by-side)', () => {
    const { container } = render(
      <svg>
        <CardInjuryBadgeGroup cx={100} cy={50} r={10} cardColor="red" injuryCount={1} />
      </svg>,
    );

    const cardRect = container.querySelector('[data-testid="piece-card-badge"]') as SVGRectElement;
    const cardCenterX =
      Number(cardRect.getAttribute('x')) + Number(cardRect.getAttribute('width')) / 2;
    const cardCenterY =
      Number(cardRect.getAttribute('y')) + Number(cardRect.getAttribute('height')) / 2;
    expect(cardCenterX).toBeCloseTo(100);
    expect(cardCenterY).toBeCloseTo(50);

    const injuryGroup = container.querySelector('[data-testid="piece-injury-badge"]')!;
    const bars = injuryGroup.querySelectorAll('rect');
    expect(bars.length).toBe(2);

    // Horizontal bar (wide, short) — centred on cx/cy.
    const hBar = bars[0] as SVGRectElement;
    const hCenterX = Number(hBar.getAttribute('x')) + Number(hBar.getAttribute('width')) / 2;
    const hCenterY = Number(hBar.getAttribute('y')) + Number(hBar.getAttribute('height')) / 2;
    expect(hCenterX).toBeCloseTo(100);
    expect(hCenterY).toBeCloseTo(50);

    // Vertical bar (narrow, tall) — also centred on cx/cy.
    const vBar = bars[1] as SVGRectElement;
    const vCenterX = Number(vBar.getAttribute('x')) + Number(vBar.getAttribute('width')) / 2;
    const vCenterY = Number(vBar.getAttribute('y')) + Number(vBar.getAttribute('height')) / 2;
    expect(vCenterX).toBeCloseTo(100);
    expect(vCenterY).toBeCloseTo(50);
  });

  it('renders the injury cross AFTER the card rect in DOM order (D-05 layering)', () => {
    const { container } = render(
      <svg>
        <CardInjuryBadgeGroup cx={0} cy={0} r={10} cardColor="yellow" injuryCount={1} />
      </svg>,
    );
    const cardBadge = container.querySelector('[data-testid="piece-card-badge"]');
    const injuryBadge = container.querySelector('[data-testid="piece-injury-badge"]');
    const position = cardBadge!.compareDocumentPosition(injuryBadge!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders nothing when cardColor is null and injuryCount is 0', () => {
    const { container } = render(
      <svg>
        <CardInjuryBadgeGroup cx={0} cy={0} r={10} cardColor={null} injuryCount={0} />
      </svg>,
    );
    expect(container.querySelector('[data-testid="piece-card-badge"]')).toBeNull();
    expect(container.querySelector('[data-testid="piece-injury-badge"]')).toBeNull();
  });
});
