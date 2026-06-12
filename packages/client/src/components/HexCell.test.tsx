import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { HexCell } from './HexCell.js';

afterEach(() => cleanup());

const testHex = { q: 18, r: 13 }; // kickoff hex (even-q, dark, not difficult-angle)

// Helper: render HexCell with highlightType prop (not yet in Props until Task 2)
function renderHighlighted(highlightType: string) {
  const props = { hex: testHex, highlightType, onClick: () => {} };
  return render(
    <svg>
      <HexCell {...(props as Parameters<typeof HexCell>[0])} />
    </svg>,
  );
}

describe('HexCell — UX-06: highlight tint colors', () => {
  it("highlightType='safe' renders an overlay polygon with fill rgba(245,197,24,1)", () => {
    const { container } = renderHighlighted('safe');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain('rgba(245,197,24,1)');
  });

  it("highlightType='risk' renders an overlay polygon with fill rgba(255,165,0,1)", () => {
    const { container } = renderHighlighted('risk');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain('rgba(255,165,0,1)');
  });

  it("highlightType='goal' renders an overlay polygon with fill rgba(220,50,50,1)", () => {
    const { container } = renderHighlighted('goal');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain('rgba(220,50,50,1)');
  });

  it("highlightType='kickoff' renders an overlay polygon with fill rgba(59,130,246,1)", () => {
    const { container } = renderHighlighted('kickoff');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain('rgba(59,130,246,1)');
  });

  it("highlightType='shot-path' renders an overlay polygon with fill rgba(255,255,255,1)", () => {
    const { container } = renderHighlighted('shot-path');
    const fills = Array.from(container.querySelectorAll('polygon')).map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain('rgba(255,255,255,1)');
  });

  it('highlightType=undefined renders only the base polygon (no tint overlay) and base polygon has default cursor', () => {
    const { container } = render(
      <svg>
        <HexCell hex={testHex} isHighlighted={false} onClick={() => {}} />
      </svg>,
    );
    const polygons = container.querySelectorAll('polygon');
    const fills = Array.from(polygons).map((p) => p.getAttribute('fill'));
    // None of the 5 tint rgba values should be present
    const tintFills = [
      'rgba(245,197,24,1)',
      'rgba(255,165,0,1)',
      'rgba(220,50,50,1)',
      'rgba(59,130,246,1)',
      'rgba(255,255,255,1)',
    ];
    for (const tint of tintFills) {
      expect(fills).not.toContain(tint);
    }
    // Base polygon should have default cursor (not clickable when no highlight)
    const basePolygon = polygons[0];
    expect(basePolygon?.getAttribute('style')).toContain('cursor: default');
  });
});
