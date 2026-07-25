import { useState } from 'react';
import type { HexCoord } from '@counter-attack/shared';
import { isDifficultAngle } from '@counter-attack/shared';
import { axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';

export type HexHighlightType =
  | 'safe'
  | 'risk'
  | 'goal'
  | 'kickoff'
  | 'shot-path'
  | 'shot-path-action'
  | 'header-target'
  | 'gk-kick-target'
  | 'pass-target'
  | 'tackle-risk';

export const HIGHLIGHT_STYLES: Record<
  HexHighlightType,
  { fill: string; restOpacity: number; hoverOpacity: number; stroke: string; strokeWidth: number }
> = {
  // D-01: safe recolored gold -> green (HILITE-01/02 traffic-light remap).
  safe: {
    fill: 'rgba(34,197,94,0.4)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#16a34a',
    strokeWidth: 1.5,
  },
  risk: {
    fill: 'rgba(255,140,0,1)',
    restOpacity: 0.65,
    hoverOpacity: 0.8,
    stroke: '#b35a00',
    strokeWidth: 2,
  },
  // D-02: goal recolored red -> purple, freeing red app-wide for the offside ring only.
  goal: {
    fill: 'rgba(168,85,247,0.5)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#9333ea',
    strokeWidth: 1.5,
  },
  kickoff: {
    fill: 'rgba(59,130,246,1)',
    restOpacity: 0.4,
    hoverOpacity: 0.55,
    stroke: 'none',
    strokeWidth: 0,
  },
  'shot-path': {
    fill: 'rgba(255,255,255,1)',
    restOpacity: 0.2,
    hoverOpacity: 0.32,
    stroke: '#dddddd',
    strokeWidth: 1,
  },
  'shot-path-action': {
    fill: 'rgba(255,255,255,1)',
    restOpacity: 0.55,
    hoverOpacity: 0.7,
    stroke: '#aaaaaa',
    strokeWidth: 2,
  },
  'header-target': {
    fill: 'rgba(34,197,94,0.4)',
    restOpacity: 1,
    hoverOpacity: 1,
    stroke: 'none',
    strokeWidth: 0,
  },
  // New (33-04): GK kick destination — migrated from HexGrid.tsx inline literal.
  'gk-kick-target': {
    fill: 'rgba(56,189,248,0.30)',
    restOpacity: 1,
    hoverOpacity: 1,
    stroke: 'rgba(56,189,248,0.55)',
    strokeWidth: 1,
  },
  // New (33-04): safe pass target — merges former GK_QUICK_THROW inline tint (see UI-SPEC B1).
  'pass-target': {
    fill: 'rgba(34,197,94,0.4)',
    restOpacity: 1,
    hoverOpacity: 1,
    stroke: 'none',
    strokeWidth: 0,
  },
  // New (33-04): interception-risk pass target — migrated from the .hexTackleRisk CSS class.
  'tackle-risk': {
    fill: 'rgba(255,140,0,0.55)',
    restOpacity: 1,
    hoverOpacity: 1,
    stroke: 'none',
    strokeWidth: 0,
  },
};

// New (33-04): compound gold "ring" overlay — independent of highlightType (mirrors
// PieceOverlay's isOffside/isMovedThisStage additive-layer pattern). Single source of
// truth for the kick-off centre-hex marker and the confirmed-pass-target outline.
export const RING_STYLES: Record<
  'required' | 'confirmed',
  { fill: string; fillOpacity?: number; stroke: string; strokeWidth: number }
> = {
  required: { fill: '#f5c518', fillOpacity: 0.5, stroke: '#f5c518', strokeWidth: 2 },
  confirmed: { fill: 'none', stroke: '#f5c518', strokeWidth: 2 },
};

type Props = {
  hex: HexCoord;
  highlightType?: HexHighlightType;
  ring?: 'required' | 'confirmed';
  onClick: () => void;
};

/**
 * Renders a single flat-top hex polygon with fill states and optional highlight overlay.
 * SVG fragment — must be a child of the HexGrid <svg> root (not a div wrapper).
 * D-10: highlightType enum prop replaces the free-form isHighlighted/highlightColor props.
 */
export function HexCell({ hex, highlightType, ring, onClick }: Props) {
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
        onClick={highlightType !== undefined || ring !== undefined ? onClick : undefined}
        style={{
          cursor: highlightType !== undefined || ring !== undefined ? 'pointer' : 'default',
        }}
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
      {/* Compound gold ring overlay — independent of highlightType (D-B2, mirrors PieceOverlay's
          isOffside/isMovedThisStage additive-layer pattern). Values sourced from RING_STYLES so a
          hex may render both a tint and a ring simultaneously. */}
      {ring !== undefined && (
        <polygon
          points={points}
          pointerEvents="none"
          fill={RING_STYLES[ring].fill}
          fillOpacity={RING_STYLES[ring].fillOpacity}
          stroke={RING_STYLES[ring].stroke}
          strokeWidth={RING_STYLES[ring].strokeWidth}
        />
      )}
      {/* Difficult-angle dot — subtle white circle at 30% opacity. UI-SPEC §Hex Overlay Elements. */}
      {isDifficultAngle(hex) && (
        <circle cx={cx} cy={cy} r={3} fill="#ffffff" fillOpacity={0.3} pointerEvents="none" />
      )}
    </>
  );
}
