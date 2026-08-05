import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { GamePhase } from '@counter-attack/shared';
import { HeaderTargetRing, HEADER_TARGET_STROKE } from './HeaderTargetRing.js';
import { axialToPixel, hexPolygonPoints, HEX_SIZE } from '../utils/hexToPixel.js';
import { RING_STYLES } from './HexCell.js';

afterEach(() => cleanup());

const TARGET_HEX = { q: 14, r: 9 };

function renderMarker(phase: GamePhase, targetHex: { q: number; r: number } | null | undefined) {
  return render(
    <svg>
      <HeaderTargetRing targetHex={targetHex} phase={phase} />
    </svg>,
  );
}

/**
 * Full `GamePhase` union enumerated from a single array (per the plan's Task 1 behavior
 * requirement) so a future phase addition to the codebase without updating this array is
 * visible as a new failing/passing case, not silently opted in.
 */
const ALL_PHASES: readonly GamePhase[] = [
  'LOBBY',
  'KICK_OFF',
  'KICK_OFF_SETUP',
  'MOVE',
  'PASS',
  'SNAPSHOT_TARGET',
  'GK_DIVE',
  'SNAPSHOT_DEFLECT',
  'SHOT',
  'HEADER',
  'SNAPSHOT',
  'LOOSE_BALL',
  'HIGH_PASS_MOVE',
  'GK_RESTART',
  'GK_QUICK_THROW',
  'GK_KICK_TARGET',
  'GK_KICK_MOVE',
  'FREE_MOVE_ATTACK',
  'FREE_MOVE_DEFENSE',
  'FIRST_TIME_PASS_MOVE',
  'FREE_KICK_SETUP',
  'THROW_IN_SETUP',
  'GOAL_KICK_SETUP_GK',
  'GOAL_KICK_SETUP_OPPONENT',
  'GOAL_KICK_CHOICE',
  'GOAL_KICK_TARGET',
  'GOAL_KICK_MOVE',
  'HALF_TIME',
  'FULL_TIME',
  'REPLAY',
];

// GOALKICK-05 (D-18-02): the marker's stroke must be asserted against the exported
// HEADER_TARGET_STROKE constant, never a retyped '#f5c518' literal — mirrors the
// BallLocationRing/BALL_MARKER_STROKE test-migration convention.
describe('HeaderTargetRing — GOALKICK-05: header-contest gold bullseye marker', () => {
  it('HEADER_TARGET_STROKE equals RING_STYLES.confirmed.stroke — shared gold accent, not a new color literal', () => {
    expect(HEADER_TARGET_STROKE).toBe(RING_STYLES.confirmed.stroke);
  });

  it("renders exactly two gold hex-edge polygons (fill none, stroke HEADER_TARGET_STROKE) during phase='GOAL_KICK_MOVE' with a non-null targetHex", () => {
    const { container } = renderMarker('GOAL_KICK_MOVE', TARGET_HEX);
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(2);
    for (const polygon of polygons) {
      expect(polygon.getAttribute('stroke')).toBe(HEADER_TARGET_STROKE);
      expect(polygon.getAttribute('fill')).toBe('none');
    }
  });

  it('both polygons are centred on axialToPixel(targetHex.q, targetHex.r), with an outer polygon strictly larger than HEX_SIZE and an inner polygon strictly smaller', () => {
    const { container } = renderMarker('GOAL_KICK_MOVE', TARGET_HEX);
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(2);

    const { cx, cy } = axialToPixel(TARGET_HEX.q, TARGET_HEX.r);
    const outerSize = HEX_SIZE + 3;
    const innerSize = HEX_SIZE * 0.55;
    expect(outerSize).toBeGreaterThan(HEX_SIZE);
    expect(innerSize).toBeLessThan(HEX_SIZE);

    const expectedOuterPoints = hexPolygonPoints(cx, cy, outerSize);
    const expectedInnerPoints = hexPolygonPoints(cx, cy, innerSize);
    const actualPoints = polygons.map((p) => p.getAttribute('points'));
    expect(actualPoints).toContain(expectedOuterPoints);
    expect(actualPoints).toContain(expectedInnerPoints);
  });

  it('both polygons carry pointer-events="none" so the marker never swallows a click', () => {
    const { container } = renderMarker('GOAL_KICK_MOVE', TARGET_HEX);
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons).toHaveLength(2);
    for (const polygon of polygons) {
      expect(polygon.getAttribute('pointer-events')).toBe('none');
    }
  });

  it("renders nothing during phase='GOAL_KICK_MOVE' when targetHex is null", () => {
    const { container } = renderMarker('GOAL_KICK_MOVE', null);
    expect(container.querySelectorAll('polygon')).toHaveLength(0);
  });

  it("renders nothing during phase='GOAL_KICK_MOVE' when targetHex is undefined", () => {
    const { container } = renderMarker('GOAL_KICK_MOVE', undefined);
    expect(container.querySelectorAll('polygon')).toHaveLength(0);
  });

  describe('renders nothing for every GamePhase other than GOAL_KICK_MOVE (full-union table, targetHex non-null)', () => {
    for (const phase of ALL_PHASES) {
      const expectPolygons = phase === 'GOAL_KICK_MOVE' ? 2 : 0;
      it(`phase='${phase}' renders ${expectPolygons} polygon(s)`, () => {
        const { container } = renderMarker(phase, TARGET_HEX);
        expect(container.querySelectorAll('polygon')).toHaveLength(expectPolygons);
      });
    }
  });
});
