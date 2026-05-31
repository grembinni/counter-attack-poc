import { useState } from 'react';
import type { HexCoord } from '@counter-attack/shared';
import { isInRegion, isDifficultAngle } from '@counter-attack/shared';
import { axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';

type Props = {
  hex: HexCoord;
  isHighlighted: boolean;
  /** D-06: undefined → gold (#f5c518) for valid-move; '#ef4444' for SHOT phase goal hexes */
  highlightColor?: string | undefined;
  onClick: () => void;
};

/**
 * Renders a single flat-top hex polygon with fill states and optional highlight overlay.
 * SVG fragment — must be a child of the HexGrid <svg> root (not a div wrapper).
 */
export function HexCell({ hex, isHighlighted, highlightColor, onClick }: Props) {
  const { cx, cy } = axialToPixel(hex.q, hex.r);
  const points = hexPolygonPoints(cx, cy);
  const [hovered, setHovered] = useState(false);

  // Goal hexes: q=0 r∈[9,15] (home) or q=36 r∈[9,15] (away). UI-SPEC §Hex Fill States.
  const isGoal = isInRegion(hex, 'homeGoal') || isInRegion(hex, 'awayGoal');

  // ODD-Q offset 3-coloring: (2r + q%2) % 3 === 2 selects ~1/3 of hexes as dark.
  // Formula is derived from ODD-Q visual adjacency (not axial), so no two visually
  // touching hexes share a colour. Even-q: (2r)%3; odd-q: (2r+1)%3. D-02.
  // Centre kickoff hex {q:18, r:13} (even q): (26+0)%3 = 2 → dark. ✓
  const isDark = (2 * hex.r + (hex.q % 2)) % 3 === 2;
  const baseFill = isGoal ? '#1a1a1a' : isDark ? '#3d6b34' : '#4a7c3f';

  return (
    <>
      {/* Base hex polygon */}
      <polygon
        points={points}
        fill={baseFill}
        stroke="#2d5227"
        strokeWidth={0.5}
        onClick={isHighlighted ? onClick : undefined}
        style={{ cursor: isHighlighted ? 'pointer' : 'default' }}
        aria-hidden="true"
      />
      {/* Highlight overlay — valid-move (gold) or SHOT goal hex (red, D-06) */}
      {isHighlighted && (
        <polygon
          points={points}
          fill={highlightColor ?? '#f5c518'}
          fillOpacity={hovered ? 0.75 : 0.55}
          stroke={highlightColor ? '#cc2222' : '#d4a017'}
          strokeWidth={hovered ? 2 : 1.5}
          pointerEvents="none"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ cursor: 'pointer' }}
        />
      )}
      {/* Difficult-angle dot — subtle white circle at 30% opacity. UI-SPEC §Hex Overlay Elements. */}
      {isDifficultAngle(hex) && (
        <circle cx={cx} cy={cy} r={3} fill="#ffffff" fillOpacity={0.3} pointerEvents="none" />
      )}
    </>
  );
}
