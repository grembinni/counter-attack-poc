import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { HexCell, HIGHLIGHT_STYLES, RING_STYLES } from './HexCell.js';
import type { HexHighlightType } from './HexCell.js';

afterEach(() => cleanup());

const testHex = { q: 18, r: 13 }; // kickoff hex (even-q, dark, not difficult-angle)

// Helper: render HexCell with highlightType and/or ring props. Builds props via a spread
// object (rather than passing `highlightType={undefined}` directly) so the optional props
// are omitted entirely when not provided — required under exactOptionalPropertyTypes.
function renderHighlighted(highlightType?: HexHighlightType, ring?: 'required' | 'confirmed') {
  const optional = {
    ...(highlightType !== undefined ? { highlightType } : {}),
    ...(ring !== undefined ? { ring } : {}),
  };
  return render(
    <svg>
      <HexCell hex={testHex} onClick={() => {}} {...optional} />
    </svg>,
  );
}

// 33-04: tests assert against the exported HIGHLIGHT_STYLES/RING_STYLES tables (token/semantic
// identity, not retyped literals) so a future palette change touches only the table.
describe('HexCell — UX-06/HILITE-01/02: highlight tint colors', () => {
  it("highlightType='safe' renders an overlay polygon with fill HIGHLIGHT_STYLES.safe.fill (green, D-01)", () => {
    const { container } = renderHighlighted('safe');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain(HIGHLIGHT_STYLES.safe.fill);
  });

  it("highlightType='risk' renders an overlay polygon with fill HIGHLIGHT_STYLES.risk.fill", () => {
    const { container } = renderHighlighted('risk');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain(HIGHLIGHT_STYLES.risk.fill);
  });

  it("highlightType='goal' renders an overlay polygon with fill HIGHLIGHT_STYLES.goal.fill (purple, D-02)", () => {
    const { container } = renderHighlighted('goal');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain(HIGHLIGHT_STYLES.goal.fill);
  });

  it("highlightType='kickoff' renders an overlay polygon with fill HIGHLIGHT_STYLES.kickoff.fill", () => {
    const { container } = renderHighlighted('kickoff');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain(HIGHLIGHT_STYLES.kickoff.fill);
  });

  it("highlightType='shot-path' renders an overlay polygon with fill HIGHLIGHT_STYLES['shot-path'].fill", () => {
    const { container } = renderHighlighted('shot-path');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain(HIGHLIGHT_STYLES['shot-path'].fill);
  });

  it("highlightType='shot-path-action' renders an overlay polygon with fill HIGHLIGHT_STYLES['shot-path-action'].fill", () => {
    const { container } = renderHighlighted('shot-path-action');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain(HIGHLIGHT_STYLES['shot-path-action'].fill);
  });

  it("highlightType='gk-kick-target' renders an overlay polygon with fill HIGHLIGHT_STYLES['gk-kick-target'].fill", () => {
    const { container } = renderHighlighted('gk-kick-target');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain(HIGHLIGHT_STYLES['gk-kick-target'].fill);
  });

  it("highlightType='pass-target' renders an overlay polygon with fill HIGHLIGHT_STYLES['pass-target'].fill", () => {
    const { container } = renderHighlighted('pass-target');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain(HIGHLIGHT_STYLES['pass-target'].fill);
  });

  it("highlightType='tackle-risk' renders an overlay polygon with fill HIGHLIGHT_STYLES['tackle-risk'].fill", () => {
    const { container } = renderHighlighted('tackle-risk');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain(HIGHLIGHT_STYLES['tackle-risk'].fill);
  });

  it('highlightType=undefined renders only the base polygon (no tint overlay) and base polygon has default cursor', () => {
    const { container } = render(
      <svg>
        <HexCell hex={testHex} onClick={() => {}} />
      </svg>,
    );
    const polygons = container.querySelectorAll('polygon');
    const fills = Array.from(polygons).map((p) => p.getAttribute('fill'));
    // None of the tint fills should be present — built from HIGHLIGHT_STYLES, not retyped literals.
    const tintFills = [
      HIGHLIGHT_STYLES.safe.fill,
      HIGHLIGHT_STYLES.goal.fill,
      HIGHLIGHT_STYLES.kickoff.fill,
      HIGHLIGHT_STYLES['shot-path'].fill,
    ];
    for (const tint of tintFills) {
      expect(fills).not.toContain(tint);
    }
    // Base polygon should have default cursor (not clickable when no highlight and no ring).
    const basePolygon = polygons[0];
    expect(basePolygon?.getAttribute('style')).toContain('cursor: default');
  });
});

describe('HexCell — 33-04: ring prop (independent gold overlay)', () => {
  it("ring='required' renders a polygon with stroke/fill equal to RING_STYLES.required", () => {
    const { container } = renderHighlighted(undefined, 'required');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    const ringPolygon = polygons.find(
      (p) =>
        p.getAttribute('stroke') === RING_STYLES.required.stroke &&
        p.getAttribute('fill') === RING_STYLES.required.fill,
    );
    expect(ringPolygon).toBeDefined();
    expect(ringPolygon?.getAttribute('fill')).not.toBe('none');
  });

  it("ring='confirmed' renders a polygon with stroke equal to RING_STYLES.confirmed.stroke and fill 'none'", () => {
    const { container } = renderHighlighted(undefined, 'confirmed');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    const ringPolygon = polygons.find(
      (p) => p.getAttribute('stroke') === RING_STYLES.confirmed.stroke,
    );
    expect(ringPolygon).toBeDefined();
    expect(ringPolygon?.getAttribute('fill')).toBe(RING_STYLES.confirmed.fill);
    expect(RING_STYLES.confirmed.fill).toBe('none');
  });

  it('a ring renders in addition to a highlightType tint (independent layers)', () => {
    const { container } = renderHighlighted('safe', 'required');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    const fills = polygons.map((p) => p.getAttribute('fill'));
    const strokes = polygons.map((p) => p.getAttribute('stroke'));
    expect(fills).toContain(HIGHLIGHT_STYLES.safe.fill);
    expect(strokes).toContain(RING_STYLES.required.stroke);
  });

  it('a ring-only hex (no highlightType) still fires onClick on the base polygon', () => {
    const onClick = vi.fn();
    const { container } = render(
      <svg>
        <HexCell hex={testHex} ring="confirmed" onClick={onClick} />
      </svg>,
    );
    const polygons = container.querySelectorAll('polygon');
    const basePolygon = polygons[0];
    expect(basePolygon?.getAttribute('style')).toContain('cursor: pointer');
    if (basePolygon) fireEvent.click(basePolygon);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
