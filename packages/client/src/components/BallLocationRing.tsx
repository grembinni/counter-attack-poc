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
 *
 * Exported (Plan 37-18 / T-37-87) so `BallLocationRing.test.tsx` can pin `.size` against a
 * literal count and `docs/HIGHLIGHT-REFERENCE.md`'s stated phase list can be checked against
 * the real set rather than drifting silently, as it did after Plan 37-02 added the six
 * Phase-37 restart phases without updating the doc.
 */
export const BALL_MARKER_PHASES: ReadonlySet<GamePhase> = new Set([
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
  // Phase 37 (37-02) / D-08: throw-in and goal-kick phases — the ball is either fixed at
  // a restart hex or mid-air during every one of these, matching this list's existing
  // precedent. Reuses the existing marker; no new tint type added (D-08).
  'THROW_IN_SETUP',
  'GOAL_KICK_SETUP_GK',
  'GOAL_KICK_SETUP_OPPONENT',
  'GOAL_KICK_CHOICE',
  'GOAL_KICK_TARGET',
  'GOAL_KICK_MOVE',
  // Phase 38 (38-07): the ball is fixed at the corner hex or mid-repositioning throughout
  // every one of the five corner-kick phases, matching the Phase 37 restart-phase precedent
  // directly above. Reuses the existing marker; no new tint type added (D-09).
  'CORNER_KICK_GK_SETUP_ATTACKING',
  'CORNER_KICK_GK_SETUP_DEFENDING',
  'CORNER_KICK_TAKER_SELECT',
  'CORNER_KICK_REPOSITION',
  'CORNER_KICK_FINAL_SETUP',
  // Phase 39 (39-16): the ball is at a fixed restart hex or mid-decision throughout every
  // one of these eight foul/GK-interrupt/penalty-kick phases, matching the Phase 37/38
  // restart-phase precedent directly above. Reuses the existing marker; no new tint type
  // added. The dive-at-feet destination step joins this set too (39-UAT gap 3, Plan 39-21) —
  // the ball stays stationary with the carrier while the diving keeper's hex is chosen.
  'FOUL_CHOICE',
  'GK_DIVE_AT_FEET_PROMPT',
  'GK_DIVE_AT_FEET_TARGET',
  'GK_BOX_ENTRY_PROMPT',
  'GK_BOX_ENTRY_MOVE',
  'PENALTY_KICK_SETUP_ATTACKING',
  'PENALTY_KICK_SETUP_DEFENDING',
  'PENALTY_KICK_TAKER_SELECT',
  'PENALTY_KICK',
  // TACKLE-02 (Phase 43, 43-02): the ball sits with the carrier and does not move while
  // the defending manager decides whether to challenge — exactly like
  // GK_DIVE_AT_FEET_PROMPT above.
  'TACKLE_STEAL_PROMPT',
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
