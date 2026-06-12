import { useState } from 'react';
import type { HexCoord } from '@counter-attack/shared';
import { isDifficultAngle } from '@counter-attack/shared';
import { axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';

export type HexHighlightType = 'safe' | 'risk' | 'goal' | 'kickoff' | 'shot-path';

const HIGHLIGHT_STYLES: Record<
  HexHighlightType,
  { fill: string; restOpacity: number; hoverOpacity: number; stroke: string; strokeWidth: number }
> = {
  safe: {
    fill: 'rgba(245,197,24,1)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#d4a017',
    strokeWidth: 1.5,
  },
  risk: {
    fill: 'rgba(255,165,0,1)',
    restOpacity: 0.4,
    hoverOpacity: 0.55,
    stroke: '#cc7700',
    strokeWidth: 1.5,
  },
  goal: {
    fill: 'rgba(220,50,50,1)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#cc2222',
    strokeWidth: 1.5,
  },
  kickoff: {
    fill: 'rgba(59,130,246,1)',
    restOpacity: 0.4,
    hoverOpacity: 0.55,
    stroke: '#2563eb',
    strokeWidth: 1.5,
  },
  'shot-path': {
    fill: 'rgba(255,255,255,1)',
    restOpacity: 0.35,
    hoverOpacity: 0.5,
    stroke: '#cccccc',
    strokeWidth: 1.5,
  },
};

type Props = {
  hex: HexCoord;
  highlightType?: HexHighlightType;
  onClick: () => void;
};

/**
 * Renders a single flat-top hex polygon with fill states and optional highlight overlay.
 * SVG fragment — must be a child of the HexGrid <svg> root (not a div wrapper).
 * D-10: highlightType enum prop replaces the free-form isHighlighted/highlightColor props.
 */
export function HexCell({ hex, highlightType, onClick }: Props) {
  const { cx, cy } = axialToPixel(hex.q, hex.r);
  const points = hexPolygonPoints(cx, cy);
  const [hovered, setHovered] = useState(false);

  // ODD-Q offset 3-coloring: (2r + q%2) % 3 === 2 selects ~1/3 of hexes as dark.
  // Formula is derived from ODD-Q visual adjacency (not axial), so no two visually
  // touching hexes share a colour. Even-q: (2r)%3; odd-q: (2r+1)%3. D-02.
  // Centre kickoff hex {q:18, r:13} (even q): (26+0)%3 = 2 → dark. ✓
  const isDark = (2 * hex.r + (hex.q % 2)) % 3 === 2;
  // D-10: Goal hexes now use grass stripe fill (same as all other hexes).
  const baseFill = isDark ? '#3d6b34' : '#4a7c3f';

  return (
    <>
      {/* Base hex polygon */}
      <polygon
        points={points}
        fill={baseFill}
        stroke="#2d5227"
        strokeWidth={0.5}
        onClick={highlightType !== undefined ? onClick : undefined}
        style={{ cursor: highlightType !== undefined ? 'pointer' : 'default' }}
        aria-hidden="true"
      >
        <title>{`(${hex.q}, ${hex.r})`}</title>
      </polygon>
      {/* Highlight overlay — semantic tint from HIGHLIGHT_STYLES lookup table (D-10) */}
      {highlightType !== undefined &&
        (() => {
          const s = HIGHLIGHT_STYLES[highlightType];
          return (
            <polygon
              points={points}
              fill={s.fill}
              fillOpacity={hovered ? s.hoverOpacity : s.restOpacity}
              stroke={s.stroke}
              strokeWidth={hovered ? s.strokeWidth + 0.5 : s.strokeWidth}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onClick={onClick}
              style={{ cursor: 'pointer' }}
            />
          );
        })()}
      {/* Difficult-angle dot — subtle white circle at 30% opacity. UI-SPEC §Hex Overlay Elements. */}
      {isDifficultAngle(hex) && (
        <circle cx={cx} cy={cy} r={3} fill="#ffffff" fillOpacity={0.3} pointerEvents="none" />
      )}
    </>
  );
}
