/** Unit tests for the UNIFORM_STYLES registry — 18-style system.
 * Covers: 18-style completeness, return-shape, id uniqueness, sunburst sectors, overlay pointerEvents.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { COLOR_SCHEME_REGISTRY } from '@counter-attack/shared';
import type { UniformStyleId } from '@counter-attack/shared';
import { UNIFORM_STYLES } from './uniformStyles.js';

afterEach(() => cleanup());

/** All 18 expected style ids — matches UniformStyleId union exactly. */
const ALL_STYLE_IDS: UniformStyleId[] = [
  'pinstripes-horizontal',
  'pinstripes-vertical',
  'pinstripes-diagonal',
  'bar-horizontal',
  'bar-vertical',
  'bar-diagonal',
  'bar-x',
  'bar-plus',
  'split-horizontal',
  'split-vertical',
  'split-diagonal',
  'quarter-horizontal',
  'quarter-diagonal',
  'shape-oval',
  'shape-circle',
  'shape-diamond',
  'sunburst',
  'checkers',
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

describe('UNIFORM_STYLES — 18-style completeness', () => {
  it('has exactly 18 keys', () => {
    expect(Object.keys(UNIFORM_STYLES).length).toBe(18);
  });

  it('contains every expected UniformStyleId', () => {
    const keys = Object.keys(UNIFORM_STYLES) as UniformStyleId[];
    for (const id of ALL_STYLE_IDS) {
      expect(keys).toContain(id);
    }
  });
});

describe('UNIFORM_STYLES — return-shape for all 18 renderers', () => {
  for (const id of ALL_STYLE_IDS) {
    it(`${id} renderer returns { patternDef, fill, overlay } with fill as string`, () => {
      const renderer = UNIFORM_STYLES[id];
      const result = renderer(BASE_PARAMS);
      expect(result).toHaveProperty('patternDef');
      expect(result).toHaveProperty('fill');
      expect(result).toHaveProperty('overlay');
      expect(typeof result.fill).toBe('string');
      expect(result.fill.length).toBeGreaterThan(0);
    });
  }
});

describe('UNIFORM_STYLES — id uniqueness (Pitfall 1 guard)', () => {
  it('pinstripes-vertical fill embeds pieceId — two pieceIds produce different fill strings', () => {
    const r1 = UNIFORM_STYLES['pinstripes-vertical']({ ...BASE_PARAMS, pieceId: 'home-5' });
    const r2 = UNIFORM_STYLES['pinstripes-vertical']({ ...BASE_PARAMS, pieceId: 'away-5' });
    expect(r1.fill).not.toBe(r2.fill);
    expect(r1.fill).toContain('home-5');
    expect(r2.fill).toContain('away-5');
  });

  it('checkers fill embeds pieceId — two pieceIds produce different fill strings', () => {
    const r1 = UNIFORM_STYLES.checkers({ ...BASE_PARAMS, pieceId: 'home-5' });
    const r2 = UNIFORM_STYLES.checkers({ ...BASE_PARAMS, pieceId: 'away-5' });
    expect(r1.fill).not.toBe(r2.fill);
    expect(r1.fill).toContain('home-5');
    expect(r2.fill).toContain('away-5');
  });

  it('bar-plus fill equality is acceptable — solid fill, pieceId irrelevant to fill', () => {
    const r1 = UNIFORM_STYLES['bar-plus']({ ...BASE_PARAMS, pieceId: 'home-5' });
    const r2 = UNIFORM_STYLES['bar-plus']({ ...BASE_PARAMS, pieceId: 'away-5' });
    expect(r1.fill).toBe(r2.fill);
    expect(r1.patternDef).not.toBeNull();
  });
});

describe('UNIFORM_STYLES — patternDef DOM rendering', () => {
  it('pinstripes-vertical patternDef renders a pattern element with id ps-v-home-5', () => {
    const result = UNIFORM_STYLES['pinstripes-vertical']({ ...BASE_PARAMS, pieceId: 'home-5' });
    expect(result.patternDef).not.toBeNull();
    const { container } = render(
      <svg>
        <defs>{result.patternDef}</defs>
      </svg>,
    );
    const pattern = container.querySelector('pattern');
    expect(pattern).not.toBeNull();
    expect(pattern!.id).toBe('ps-v-home-5');
  });

  it('checkers patternDef renders a 12×12 pattern with homePrime base + two homeAlt quadrant rects', () => {
    const result = UNIFORM_STYLES.checkers({ ...BASE_PARAMS, pieceId: 'home-5' });
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
    expect(fills).toContain(CITY_PALETTE.homePrime);
    expect(fills).toContain(CITY_PALETTE.homeAlt);
  });

  it('bar-diagonal patternDef contains a clipPath (no pattern element — solid fill)', () => {
    const result = UNIFORM_STYLES['bar-diagonal']({ ...BASE_PARAMS, pieceId: 'home-5' });
    expect(result.patternDef).not.toBeNull();
    const { container } = render(
      <svg>
        <defs>{result.patternDef}</defs>
      </svg>,
    );
    expect(container.querySelector('clipPath')).not.toBeNull();
    expect(container.querySelector('pattern')).toBeNull();
  });

  it('bar-diagonal fill is solid homeAlt (background — not a url pattern reference)', () => {
    const result = UNIFORM_STYLES['bar-diagonal'](BASE_PARAMS);
    expect(result.fill).toBe(CITY_PALETTE.homeAlt);
    expect(result.fill.startsWith('url(')).toBe(false);
  });
});

describe('UNIFORM_STYLES — overlay elements carry pointerEvents="none"', () => {
  it('bar-diagonal overlay line has pointerEvents="none"', () => {
    const result = UNIFORM_STYLES['bar-diagonal'](BASE_PARAMS);
    expect(result.overlay).not.toBeNull();
    const { container } = render(<svg>{result.overlay}</svg>);
    const line = container.querySelector('line');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('pointer-events')).toBe('none');
  });

  it('bar-plus overlay rects all have pointerEvents="none"', () => {
    const result = UNIFORM_STYLES['bar-plus'](BASE_PARAMS);
    expect(result.overlay).not.toBeNull();
    const { container } = render(<svg>{result.overlay}</svg>);
    const rects = Array.from(container.querySelectorAll('rect'));
    expect(rects.length).toBe(2);
    for (const rect of rects) {
      expect(rect.getAttribute('pointer-events')).toBe('none');
    }
  });

  it('sunburst overlay has 8 sector paths all with pointerEvents="none"', () => {
    const result = UNIFORM_STYLES.sunburst(BASE_PARAMS);
    expect(result.overlay).not.toBeNull();
    const { container } = render(<svg>{result.overlay}</svg>);
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths.length).toBe(8);
    for (const path of paths) {
      expect(path.getAttribute('pointer-events')).toBe('none');
    }
  });

  it('split-vertical overlay elements all have pointerEvents="none"', () => {
    const result = UNIFORM_STYLES['split-vertical'](BASE_PARAMS);
    expect(result.overlay).not.toBeNull();
    const { container } = render(<svg>{result.overlay}</svg>);
    const elements = Array.from(container.querySelectorAll('[pointer-events]'));
    expect(elements.length).toBeGreaterThan(0);
    for (const el of elements) {
      expect(el.getAttribute('pointer-events')).toBe('none');
    }
  });
});

describe('UNIFORM_STYLES — centre circle overlay for number legibility', () => {
  it('pinstripes-vertical overlay is a circle with fill=homePrime', () => {
    const result = UNIFORM_STYLES['pinstripes-vertical'](BASE_PARAMS);
    expect(result.overlay).not.toBeNull();
    const { container } = render(<svg>{result.overlay}</svg>);
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute('fill')).toBe(CITY_PALETTE.homePrime);
  });

  it('checkers overlay is a circle with fill=homePrime', () => {
    const result = UNIFORM_STYLES.checkers(BASE_PARAMS);
    expect(result.overlay).not.toBeNull();
    const { container } = render(<svg>{result.overlay}</svg>);
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute('fill')).toBe(CITY_PALETTE.homePrime);
  });
});
