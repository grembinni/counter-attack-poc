import type { BallState } from '@counter-attack/shared';
import { axialToPixel } from '../utils/hexToPixel.js';

const BALL_R = 12; // 9 * 1.3

function SoccerPatches({ cx, cy, R }: { cx: number; cy: number; R: number }) {
  const outerDist = R * 0.62;
  const angles = Array.from({ length: 5 }, (_, i) => (i * 72 - 90) * (Math.PI / 180));
  return (
    <>
      <circle cx={cx} cy={cy} r={R * 0.27} fill="#111" pointerEvents="none" />
      {angles.map((a, i) => (
        <circle
          key={i}
          cx={cx + outerDist * Math.cos(a)}
          cy={cy + outerDist * Math.sin(a)}
          r={R * 0.19}
          fill="#111"
          pointerEvents="none"
        />
      ))}
    </>
  );
}

/**
 * Renders the ball as a cream SVG circle with a soccer-ball dot pattern.
 * Not clickable — ball position is state-driven only.
 * Must be a child of the HexGrid <svg> root (z-order: above hexes, below pieces).
 */
export function BallMarker({ ball }: { ball: BallState }) {
  const { cx, cy } = axialToPixel(ball.position.q, ball.position.r);

  return (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={BALL_R}
        fill="#f5f0dc"
        stroke="#222222"
        strokeWidth={1.5}
        pointerEvents="none"
      />
      <SoccerPatches cx={cx} cy={cy} R={BALL_R} />
    </>
  );
}
