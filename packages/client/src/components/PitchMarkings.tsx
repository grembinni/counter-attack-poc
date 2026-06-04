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

      {/* Home penalty box — inner edge bisects q=6 centre (cx=180); symmetric about y=450.32 */}
      <rect
        x={-10}
        y={190.5}
        width={190}
        height={519.6}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        pointerEvents="none"
      />

      {/* Away penalty box — mirror of home; inner edge at x=900 (1090-190) */}
      <rect
        x={900}
        y={190.5}
        width={190}
        height={519.6}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        pointerEvents="none"
      />

      {/* Home 6-yard box — symmetric about y=450.32; right edge at x=60 (q=2 centre) */}
      <rect
        x={-10}
        y={277.1}
        width={70}
        height={346.4}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        pointerEvents="none"
      />

      {/* Away 6-yard box — mirror of home; right edge at clip boundary x=1090 */}
      <rect
        x={1020}
        y={277.1}
        width={70}
        height={346.4}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        pointerEvents="none"
      />

      {/* Corner arcs (D-12) — r=10 quarter circles centred at each pitch corner, bulging into the field */}
      {/* Top-left: centre (-10, 17.32); from left-edge down to top-edge right */}
      <path
        d="M -10,27.32 A 10,10 0 0,0 0,17.32"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        fill="none"
        pointerEvents="none"
      />
      {/* Bottom-left: centre (-10, 883.32); from left-edge up to bottom-edge right */}
      <path
        d="M -10,873.32 A 10,10 0 0,1 0,883.32"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        fill="none"
        pointerEvents="none"
      />
      {/* Top-right: centre (1090, 17.32); from right-edge down to top-edge left */}
      <path
        d="M 1090,27.32 A 10,10 0 0,1 1080,17.32"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        fill="none"
        pointerEvents="none"
      />
      {/* Bottom-right: centre (1090, 883.32); from right-edge up to bottom-edge left */}
      <path
        d="M 1090,873.32 A 10,10 0 0,0 1080,883.32"
        stroke="white"
        strokeWidth={1.5}
        strokeOpacity={0.6}
        fill="none"
        pointerEvents="none"
      />
    </>
  );
}
