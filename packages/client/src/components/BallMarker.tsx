import type { BallState } from '@counter-attack/shared';
import { axialToPixel } from '../utils/hexToPixel.js';

/**
 * Renders the ball as an off-white SVG circle at ball.position.
 * Visually distinct from piece circles: fill #f5f0dc (cream), r=6.
 * Not clickable — ball position is state-driven only.
 * Must be a child of the HexGrid <svg> root (z-order: above hexes, below pieces).
 * UI-SPEC §BallMarker Component.
 */
export function BallMarker({ ball }: { ball: BallState }) {
  const { cx, cy } = axialToPixel(ball.position.q, ball.position.r);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={9}
      fill="#f5f0dc"
      stroke="#222222"
      strokeWidth={1.5}
      pointerEvents="none"
    />
  );
}
