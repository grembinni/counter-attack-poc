import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { GamePhase } from '@counter-attack/shared';
import { BallLocationRing, BALL_MARKER_STROKE } from './BallLocationRing.js';
import { BALL_MARKER_PHASES } from './BallLocationRing.js';
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

  // Plan 37-18 (T-37-87) / Plan 38-07 / Plan 38-22 / Plan 38-28: pins the real
  // BALL_MARKER_PHASES set size so docs/HIGHLIGHT-REFERENCE.md's stated phase
  // count/enumeration cannot silently drift from the code again, as it did after Plan 37-02
  // added the six Phase-37 restart phases without updating the doc's "exact 11-phase list"
  // claim. Grew from 17 (11 original + 6 Phase-37 restart phases) to 22 with Plan 38-07's five
  // Corner Kick phases, briefly to 23 with Plan 38-22's CORNER_KICK_CLEAR_OUT addition (38-15
  // defect 3), then back to 22 with Plan 38-28's removal of the clear-out phase entirely.
  // Grew to 31 with Plan 39-21's GK_DIVE_AT_FEET_TARGET addition (39-UAT gap 3), then to
  // 32 with Plan 43-02's TACKLE_STEAL_PROMPT addition (TACKLE-02).
  it('BALL_MARKER_PHASES has 32 members (22 + 8 Phase-39 foul/GK-interrupt/penalty-kick phases + 1 Plan 39-21 addition + 1 Plan 43-02 addition)', () => {
    expect(BALL_MARKER_PHASES.size).toBe(32);
  });

  it("renders the marker during phase='CORNER_KICK_GK_SETUP_ATTACKING' (Phase 38 corner-kick phase)", () => {
    const { container } = renderMarker('CORNER_KICK_GK_SETUP_ATTACKING');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='CORNER_KICK_TAKER_SELECT' (Phase 38 corner-kick phase)", () => {
    const { container } = renderMarker('CORNER_KICK_TAKER_SELECT');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='CORNER_KICK_REPOSITION' (Phase 38 corner-kick phase)", () => {
    const { container } = renderMarker('CORNER_KICK_REPOSITION');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='CORNER_KICK_FINAL_SETUP' (Phase 38 corner-kick phase)", () => {
    const { container } = renderMarker('CORNER_KICK_FINAL_SETUP');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='FOUL_CHOICE' (Phase 39 foul phase)", () => {
    const { container } = renderMarker('FOUL_CHOICE');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='GK_DIVE_AT_FEET_PROMPT' (Phase 39 GK-interrupt phase)", () => {
    const { container } = renderMarker('GK_DIVE_AT_FEET_PROMPT');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='GK_DIVE_AT_FEET_TARGET' (39-UAT gap 3, Plan 39-21 — the dive-destination step)", () => {
    const { container } = renderMarker('GK_DIVE_AT_FEET_TARGET');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='GK_BOX_ENTRY_PROMPT' (Phase 39 GK-interrupt phase)", () => {
    const { container } = renderMarker('GK_BOX_ENTRY_PROMPT');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='GK_BOX_ENTRY_MOVE' (Phase 39 GK-interrupt phase)", () => {
    const { container } = renderMarker('GK_BOX_ENTRY_MOVE');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='PENALTY_KICK_SETUP_ATTACKING' (Phase 39 penalty-kick phase)", () => {
    const { container } = renderMarker('PENALTY_KICK_SETUP_ATTACKING');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='PENALTY_KICK_SETUP_DEFENDING' (Phase 39 penalty-kick phase)", () => {
    const { container } = renderMarker('PENALTY_KICK_SETUP_DEFENDING');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='PENALTY_KICK_TAKER_SELECT' (Phase 39 penalty-kick phase)", () => {
    const { container } = renderMarker('PENALTY_KICK_TAKER_SELECT');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });

  it("renders the marker during phase='PENALTY_KICK' (Phase 39 penalty-kick phase)", () => {
    const { container } = renderMarker('PENALTY_KICK');
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]?.getAttribute('stroke')).toBe(BALL_MARKER_STROKE);
  });
});
