/**
 * Goal net SVG overlay rendered OUTSIDE the pitch clip boundary.
 * Both rects use the #goal-net pattern defined in HexGrid <defs>.
 *
 * Coordinates are LOCAL to the outer <g translate(20, 17.32)> but intentionally
 * sit outside the <g clipPath="url(#pitch-clip)"> inner group so they are visible
 * at each pitch end (D-09, Phase 7.1).
 *
 * Home goal net: x∈[-30,-10] local → abs x∈[-10,10] (butts against CLIP_X=-10)
 * Away goal net: x∈[1090,1110] local → abs x∈[1110,1130] (butts against CLIP_RIGHT=1090)
 */
export function GoalNets() {
  return (
    <>
      {/* Home goal net — left end of pitch */}
      <rect
        x={-30}
        y={329.1}
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
        x={1090}
        y={329.1}
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
