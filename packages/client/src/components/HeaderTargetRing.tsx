import type { GamePhase, HexCoord } from '@counter-attack/shared';
import { axialToPixel, hexPolygonPoints, HEX_SIZE } from '../utils/hexToPixel.js';

/**
 * GOALKICK-05 (D-18-02): the gold accent stroke color for the header-target contest marker.
 * Equals `RING_STYLES.confirmed.stroke` in `HexCell.tsx` — the gold accent is shared, not a
 * new color literal. Exported so `HeaderTargetRing.test.tsx` (and any future consumer, e.g.
 * Phase 38's corner-kick contest point) asserts against this constant instead of retyping the
 * `#f5c518` literal — mirrors the `BallLocationRing.BALL_MARKER_STROKE` convention.
 */
export const HEADER_TARGET_STROKE = '#f5c518';

/**
 * GOALKICK-05: standalone always-on-top gold bullseye marker anchored at
 * `GameState.goalKickTargetHex`, the hex where the header contest will happen during the
 * `GOAL_KICK_MOVE` travel window. Marks the contest point so both managers can aim their
 * single 3-hex response move (D-18-03 — deliberately ungated by `isActivePlayer`, exactly
 * like `BallLocationRing`).
 *
 * Renders alongside — not instead of — the white `BallLocationRing` marker, which also
 * covers `GOAL_KICK_MOVE` and shares the same hex (the ball sits at `goalKickTargetHex`
 * during this phase). The two are told apart by shape and color: `BallLocationRing` draws a
 * single white hex-edge outline, while this component draws two concentric gold hex outlines
 * (an outer ring larger than the hex and an inner ring at roughly half scale), reading
 * unmistakably as a target rather than a selection ring (D-18-02).
 *
 * This is a standalone always-on-top overlay, not a `HexHighlightType` member, because at
 * most one `highlightType` renders per hex (`HIGHLIGHT-REFERENCE.md` section 1) and this hex
 * will frequently also be a valid response-move destination or a `gk-kick-target` tint — a
 * tint would be silently out-prioritized exactly when it matters most (D-18-01).
 *
 * Phase gating lives inside this component, not at the call site (D-18-05): returns `null`
 * unless `phase === 'GOAL_KICK_MOVE'` and `targetHex` is non-null, mirroring
 * `BallLocationRing`'s own `BALL_MARKER_PHASES` gate.
 *
 * Must be a child of the `HexGrid` `<svg>` root, rendered after `PieceOverlay` (and after
 * `BallLocationRing`) so it is never hidden or out-prioritized by any hex tint/ring, and both
 * polygons are click-transparent (D-18-04) so the marker never swallows a click on the hex
 * underneath.
 */
export function HeaderTargetRing({
  targetHex,
  phase,
}: {
  targetHex: HexCoord | null | undefined;
  phase: GamePhase;
}) {
  if (phase !== 'GOAL_KICK_MOVE') return null;
  if (targetHex == null) return null;

  const { cx, cy } = axialToPixel(targetHex.q, targetHex.r);
  const outerPoints = hexPolygonPoints(cx, cy, HEX_SIZE + 3);
  const innerPoints = hexPolygonPoints(cx, cy, HEX_SIZE * 0.55);

  return (
    <>
      <polygon
        points={outerPoints}
        fill="none"
        stroke={HEADER_TARGET_STROKE}
        strokeWidth={3}
        pointerEvents="none"
      />
      <polygon
        points={innerPoints}
        fill="none"
        stroke={HEADER_TARGET_STROKE}
        strokeWidth={2}
        pointerEvents="none"
      />
    </>
  );
}
