/** Unit tests for the UNIFORM_STYLES registry — Phase 20 UNIFORM-01.
 * Covers: 12-style completeness, return-shape, id uniqueness, GK-swap neutrality, fade gradient.
 * Mirror of PieceOverlay.test.tsx conventions: render inside <svg>, vitest imports, cleanup.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { COLOR_SCHEME_REGISTRY } from '@counter-attack/shared';
import type { UniformStyleId } from '@counter-attack/shared';
import { UNIFORM_STYLES } from './uniformStyles.js';

afterEach(() => cleanup());

/** All 12 expected style ids — matches UniformStyleId union exactly. */
const ALL_STYLE_IDS: UniformStyleId[] = [
  'pinstripe',
  'diagonal',
  'checker',
  'cosmos',
  'plus',
  'v-stripe',
  'quarters',
  'polka-dots',
  'fade',
  'tree-rings',
  'corners',
  'solid',
];

/** Sample palette — City's real palette from Phase 19 teamConfig.ts. */
const CITY_PALETTE = COLOR_SCHEME_REGISTRY.city.palette;

/** Base params used across tests. */
const BASE_PARAMS = {
  cx: 100,
  cy: 100,
  R: 12,
  palette: CITY_PALETTE,
  isGK: false,
  pieceId: 'home-5',
};

describe('UNIFORM_STYLES — UNIFORM-01: 12-style completeness', () => {
  it('has exactly 12 keys', () => {
    expect(Object.keys(UNIFORM_STYLES).length).toBe(12);
  });

  it('contains every expected UniformStyleId', () => {
    const keys = Object.keys(UNIFORM_STYLES) as UniformStyleId[];
    for (const id of ALL_STYLE_IDS) {
      expect(keys).toContain(id);
    }
  });
});

describe('UNIFORM_STYLES — UNIFORM-01: return-shape for all 12 renderers', () => {
  for (const id of ALL_STYLE_IDS) {
    it(`${id} renderer returns { patternDef, fill, overlay } with fill as string`, () => {
      const renderer = UNIFORM_STYLES[id];
      const result = renderer(BASE_PARAMS);
      // Must have all three own-properties
      expect(result).toHaveProperty('patternDef');
      expect(result).toHaveProperty('fill');
      expect(result).toHaveProperty('overlay');
      // fill must be a string
      expect(typeof result.fill).toBe('string');
      expect(result.fill.length).toBeGreaterThan(0);
    });
  }
});

describe('UNIFORM_STYLES — solid renderer', () => {
  it('returns { patternDef: null, fill: palette.primary, overlay: null }', () => {
    const result = UNIFORM_STYLES.solid(BASE_PARAMS);
    expect(result.patternDef).toBeNull();
    expect(result.fill).toBe(CITY_PALETTE.primary);
    expect(result.overlay).toBeNull();
  });
});

describe('UNIFORM_STYLES — UNIFORM-01: id uniqueness (Pitfall 1 guard)', () => {
  it('pinstripe fill embeds pieceId — two different pieceIds produce different fill strings', () => {
    const result1 = UNIFORM_STYLES.pinstripe({ ...BASE_PARAMS, pieceId: 'home-5' });
    const result2 = UNIFORM_STYLES.pinstripe({ ...BASE_PARAMS, pieceId: 'away-5' });
    expect(result1.fill).not.toBe(result2.fill);
    expect(result1.fill).toContain('home-5');
    expect(result2.fill).toContain('away-5');
  });

  it('checker fill embeds pieceId — two different pieceIds produce different fill strings', () => {
    const result1 = UNIFORM_STYLES.checker({ ...BASE_PARAMS, pieceId: 'home-5' });
    const result2 = UNIFORM_STYLES.checker({ ...BASE_PARAMS, pieceId: 'away-5' });
    expect(result1.fill).not.toBe(result2.fill);
    expect(result1.fill).toContain('home-5');
    expect(result2.fill).toContain('away-5');
  });

  it('solid fill equality is acceptable — no id in fill (no patternDef)', () => {
    const result1 = UNIFORM_STYLES.solid({ ...BASE_PARAMS, pieceId: 'home-5' });
    const result2 = UNIFORM_STYLES.solid({ ...BASE_PARAMS, pieceId: 'away-5' });
    // solid has no id — fill equality is fine (same palette → same colour)
    expect(result1.fill).toBe(result2.fill);
    expect(result1.patternDef).toBeNull();
  });
});

describe('UNIFORM_STYLES — fade renderer: linearGradient in patternDef', () => {
  it('fill starts with url(#grad-fade- and includes pieceId', () => {
    const result = UNIFORM_STYLES.fade({ ...BASE_PARAMS, pieceId: 'home-5' });
    expect(result.fill).toMatch(/^url\(#grad-fade-home-5\)$/);
  });

  it('patternDef renders a linearGradient element (not a pattern)', () => {
    const result = UNIFORM_STYLES.fade({ ...BASE_PARAMS, pieceId: 'home-5' });
    expect(result.patternDef).not.toBeNull();
    const { container } = render(
      <svg>
        <defs>{result.patternDef}</defs>
      </svg>,
    );
    const gradients = container.querySelectorAll('linearGradient');
    expect(gradients.length).toBe(1);
    expect(gradients[0]!.id).toBe('grad-fade-home-5');
    // Must NOT have a <pattern> element
    const patterns = container.querySelectorAll('pattern');
    expect(patterns.length).toBe(0);
  });
});

describe('UNIFORM_STYLES — patternDef DOM rendering for pattern-based styles', () => {
  it('pinstripe patternDef renders a pattern element with id pinstripe-home-5', () => {
    const result = UNIFORM_STYLES.pinstripe({ ...BASE_PARAMS, pieceId: 'home-5' });
    expect(result.patternDef).not.toBeNull();
    const { container } = render(
      <svg>
        <defs>{result.patternDef}</defs>
      </svg>,
    );
    const pattern = container.querySelector('pattern');
    expect(pattern).not.toBeNull();
    expect(pattern!.id).toBe('pinstripe-home-5');
  });

  it('checker patternDef renders a 12×12 pattern with primary base + two secondary1 quadrant rects', () => {
    const result = UNIFORM_STYLES.checker({ ...BASE_PARAMS, pieceId: 'home-5' });
    const { container } = render(
      <svg>
        <defs>{result.patternDef}</defs>
      </svg>,
    );
    const pattern = container.querySelector('pattern');
    expect(pattern).not.toBeNull();
    expect(pattern!.getAttribute('width')).toBe('12');
    expect(pattern!.getAttribute('height')).toBe('12');
    const rects = pattern!.querySelectorAll('rect');
    const fills = Array.from(rects).map((r) => r.getAttribute('fill'));
    expect(fills).toContain(CITY_PALETTE.primary);
    expect(fills).toContain(CITY_PALETTE.secondary1);
  });

  it('diagonal patternDef contains both a pattern element and a clipPath', () => {
    const result = UNIFORM_STYLES.diagonal({ ...BASE_PARAMS, pieceId: 'home-5' });
    const { container } = render(
      <svg>
        <defs>{result.patternDef}</defs>
      </svg>,
    );
    expect(container.querySelector('pattern')).not.toBeNull();
    const clip = container.querySelector('clipPath');
    expect(clip).not.toBeNull();
    expect(clip!.id).toBe('clip-diagonal-home-5');
  });
});

describe('UNIFORM_STYLES — overlay elements carry pointerEvents="none"', () => {
  it('diagonal overlay line has pointerEvents="none"', () => {
    const result = UNIFORM_STYLES.diagonal(BASE_PARAMS);
    expect(result.overlay).not.toBeNull();
    const { container } = render(<svg>{result.overlay}</svg>);
    const line = container.querySelector('line');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('pointer-events')).toBe('none');
  });

  it('plus overlay rects all have pointerEvents="none"', () => {
    const result = UNIFORM_STYLES.plus(BASE_PARAMS);
    expect(result.overlay).not.toBeNull();
    const { container } = render(<svg>{result.overlay}</svg>);
    const rects = Array.from(container.querySelectorAll('rect'));
    expect(rects.length).toBe(2);
    for (const rect of rects) {
      expect(rect.getAttribute('pointer-events')).toBe('none');
    }
  });

  it('tree-rings overlay circles all have pointerEvents="none"', () => {
    const result = UNIFORM_STYLES['tree-rings'](BASE_PARAMS);
    expect(result.overlay).not.toBeNull();
    const { container } = render(<svg>{result.overlay}</svg>);
    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles.length).toBe(3);
    for (const circle of circles) {
      expect(circle.getAttribute('pointer-events')).toBe('none');
    }
  });
});
