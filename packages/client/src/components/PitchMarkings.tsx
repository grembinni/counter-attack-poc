/**
 * Cosmetic SVG pitch marking overlay rendered inside the HexGrid <g translate(20, 17.32)>.
 * All coordinates are LOCAL to that <g> (do NOT add the translate offset again — Pitfall 3).
 *
 * Layers: rendered between Layer 1 (HexCells) and Layer 2 (BallMarker) so markings sit
 * over hex fill but under the ball and pieces.
 *
 * D-07, D-08, D-12 (Phase 7.1): halfway line, centre circle, penalty boxes,
 * 6-yard boxes, and corner arcs.
 */
export function PitchMarkings() {
  return (
    <>
      {/* Halfway line — vertical at x=540 (q=18 centre column) */}
      <line
        x1={540}
        y1={17.3}
        x2={540}
        y2={883.3}
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        fill="none"
        pointerEvents="none"
      />

      {/* Centre circle — centred on kickOffHex {q:18,r:13} */}
      <circle
        cx={540}
        cy={450.3}
        r={103.9}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        pointerEvents="none"
      />

      {/* Home penalty box — left side (~q∈[0,5]) */}
      <rect
        x={-10}
        y={173.2}
        width={210}
        height={536.9}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        pointerEvents="none"
      />

      {/* Away penalty box — right side (~q∈[31,36]) */}
      <rect
        x={880}
        y={173.2}
        width={210}
        height={536.9}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        pointerEvents="none"
      />

      {/* Home 6-yard box — inside home penalty area */}
      <rect
        x={-10}
        y={294.4}
        width={80}
        height={329.1}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        pointerEvents="none"
      />

      {/* Away 6-yard box — inside away penalty area */}
      <rect
        x={1030}
        y={294.4}
        width={80}
        height={329.1}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        pointerEvents="none"
      />

      {/* Corner arcs (D-12) — quarter-circle paths at each pitch corner */}
      {/* Top-left corner */}
      <path
        d="M -10,57.3 A 40,40 0 0,0 50,17.3"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        fill="none"
        pointerEvents="none"
      />
      {/* Bottom-left corner */}
      <path
        d="M -10,843.3 A 40,40 0 0,1 50,883.3"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        fill="none"
        pointerEvents="none"
      />
      {/* Top-right corner */}
      <path
        d="M 1090,57.3 A 40,40 0 0,1 1030,17.3"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        fill="none"
        pointerEvents="none"
      />
      {/* Bottom-right corner */}
      <path
        d="M 1090,843.3 A 40,40 0 0,0 1030,883.3"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        fill="none"
        pointerEvents="none"
      />
    </>
  );
}
