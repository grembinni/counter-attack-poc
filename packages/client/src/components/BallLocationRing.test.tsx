import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { GamePhase } from '@counter-attack/shared';
import { BallLocationRing, BALL_MARKER_STROKE } from './BallLocationRing.js';
import { axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';

afterEach(() => cleanup());

const BALL_HEX = { q: 18, r: 13 };

function renderMarker(phase: GamePhase) {
  return render(
    <svg>
      <BallLocationRing ballPosition={BALL_HEX} phase={phase} />
    </svg>,
  );
}

// HILITE-04: the marker's stroke/fill/strokeWidth must be asserted against the exported
// BALL_MARKER_STROKE constant, never a retyped '#ffffff' literal (CONTEXT.md test-migration
// decision — mirrors the HexCell/HIGHLIGHT_STYLES pattern from Plan 33-04).
describe('BallLocationRing — HILITE-04: standalone always-on-top ball-location marker', () => {
  it("renders exactly one white hex-edge polygon (stroke=BALL_MARKER_STROKE, fill none, strokeWidth 2.5) during phase='HEADER'", () => {
    const { container } = renderMarker('HEADER');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    const [polygon] = polygons;
    expect(polygon?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
    expect(polygon?.getAttribute('fill')).toBe('none');
    expect(polygon?.getAttribute('stroke-width')).toBe('2.5');
  });

  it("renders no polygon during phase='MOVE' (a standard, non-gated phase)", () => {
    const { container } = renderMarker('MOVE');
    expect(container.querySelectorAll('polygon')).toHaveLength(0);
  });

  it("renders the marker during phase='GK_DIVE' (gated response phase)", () => {
    const { container } = renderMarker('GK_DIVE');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='GK_KICK_TARGET' (gated response phase)", () => {
    const { container } = renderMarker('GK_KICK_TARGET');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='KICK_OFF_SETUP' (added to the gate per Plan 33-07 Task 3 human-verify feedback — the ball's hex now gets the same white marker consistently everywhere, alongside the separate gold ring=\"required\" kicker-placement overlay)", () => {
    const { container } = renderMarker('KICK_OFF_SETUP');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it('positions the polygon points at axialToPixel/hexPolygonPoints of the given ballPosition', () => {
    const { container } = renderMarker('SHOT');
    const polygon = container.querySelector('polygon');
    const { cx, cy } = axialToPixel(BALL_HEX.q, BALL_HEX.r);
    const expectedPoints = hexPolygonPoints(cx, cy);
    expect(polygon?.getAttribute('points')).toBe(expectedPoints);
  });
});
