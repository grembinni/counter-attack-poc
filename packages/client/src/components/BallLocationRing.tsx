import type { GamePhase, HexCoord } from '@counter-attack/shared';
import { axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';

/**
 * HILITE-04 (D-08): the white hex-edge stroke color for the standalone ball-location
 * marker. Exported so BallLocationRing.test.tsx asserts against this constant instead of
 * retyping the `#ffffff` literal — single source of truth (mirrors the Plan 33-01 Task 3
 * / PieceOverlay ACTIVE_RING_STROKE pattern).
 */
export const BALL_MARKER_STROKE = '#ffffff';

/**
 * HILITE-04 (D-09): the visibility gate resolved in UI-SPEC B4 — the marker renders only
 * during these response phases, where the ball position is not already legible from
 * BallMarker + piece positions alone.
 *
 * Plan 33-07 Task 3 human-verify follow-up: `KICK_OFF_SETUP` was added to this set
 * (originally a 10-phase list) so the ball's hex gets the same consistent white marker
 * during kickoff setup as it does everywhere else. Previously KICK_OFF_SETUP only showed
 * the gold `ring="required"` overlay (HexCell.tsx) marking "place the kicker here" — a
 * real, separate concept that is unchanged and still renders. The white marker now
 * renders additively alongside that gold ring during KICK_OFF_SETUP: they mean different
 * things (ball location vs. required-placement hex) and both apply to the same hex here,
 * so both render simultaneously.
 */
const BALL_MARKER_PHASES: ReadonlySet<GamePhase> = new Set([
  'HEADER',
  'SNAPSHOT',
  'SNAPSHOT_TARGET',
  'SNAPSHOT_DEFLECT',
  'GK_DIVE',
  'SHOT',
  'GK_RESTART',
  'GK_QUICK_THROW',
  'GK_KICK_TARGET',
  'GK_KICK_MOVE',
  'KICK_OFF_SETUP',
]);

/**
 * HILITE-04: standalone always-on-top white hex-edge marker at the ball's hex, rendered
 * only during response phases (BALL_MARKER_PHASES). Must be a child of the HexGrid <svg>
 * root, rendered as the topmost sibling (after PieceOverlay) so it is never hidden or
 * out-prioritized by any HexCell highlightType/ring tint (D-09).
 */
export function BallLocationRing({
  ballPosition,
  phase,
}: {
  ballPosition: HexCoord;
  phase: GamePhase;
}) {
  if (!BALL_MARKER_PHASES.has(phase)) return null;

  const { cx, cy } = axialToPixel(ballPosition.q, ballPosition.r);
  const points = hexPolygonPoints(cx, cy);

  return (
    <polygon
      points={points}
      fill="none"
      stroke={BALL_MARKER_STROKE}
      strokeWidth={2.5}
      pointerEvents="none"
    />
  );
}
