/**
 * Goal net SVG overlay rendered OUTSIDE the pitch clip boundary.
 * Both rects use the #goal-net pattern defined in HexGrid <defs>.
 *
 * Coordinates are LOCAL to the outer <g translate(20, 17.32)> but intentionally
 * sit outside the <g clipPath="url(#pitch-clip)"> inner group so they are visible
 * at each pitch end (D-09, Phase 7.1).
 *
 * Home goal net: x∈[-30,-10] (left end, just outside clip boundary)
 * Away goal net: x∈[1110,1130] (right end, just outside clip boundary)
 */
export function GoalNets() {
  return (
    <>
      {/* Home goal net — left end of pitch */}
      <rect
        x={-30}
        y={346.4}
        width={20}
        height={242.5}
        fill="url(#goal-net)"
        stroke="white"
        strokeWidth={1}
        strokeOpacity={0.6}
        pointerEvents="none"
      />
      {/* Away goal net — right end of pitch */}
      <rect
        x={1110}
        y={346.4}
        width={20}
        height={242.5}
        fill="url(#goal-net)"
        stroke="white"
        strokeWidth={1}
        strokeOpacity={0.6}
        pointerEvents="none"
      />
    </>
  );
}
