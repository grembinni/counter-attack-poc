/** Uniform style renderer registry for Counter Attack.
 * Each renderer takes palette-only params and returns SVG fragment descriptors.
 * Renderers NEVER inspect teamId — palette parameterization is the entire point.
 * Every pattern/gradient/clipPath id embeds pieceId to avoid SVG defs collisions (Pitfall 1).
 * All pattern elements use patternUnits="userSpaceOnUse" + x/y anchor (Pitfall 4).
 * All overlay sibling elements carry pointerEvents="none" (Pattern 6).
 *
 * Color convention (all styles):
 *   homeAlt  = base background fill
 *   homePrime = shapes, bars, stripes, and the centre prime dot
 * Every style ends with a prime dot — <circle r≈58%R fill=homePrime> — so the jersey number
 * always reads on a consistent prime-colored centre regardless of pattern.
 *
 * ALL absolute pixel dimensions are expressed as R multiples so the renderers look
 * correct at both gameplay size (R=12) and the selection-screen tile size (R=30).
 *
 * Style families:
 *   pinstripes (H/V/D) — thin homePrime stripes on homeAlt base + prime dot
 *   bar (H/V/Diag/X/+) — bold homePrime bar(s) on homeAlt base + prime dot
 *   split (H/V/D)      — hard 50/50 colour divide + prime dot
 *   quarter (H/D)      — 4-section alternating pattern + prime dot
 *     H = quarter-D rotated 45° (argyle/diamond)
 *     D = 2×2 large checkerboard aligned to axes
 *   shape-oval         — horizontal homePrime oval on homeAlt base + prime dot
 *   shape-circle       — homePrime circle on homeAlt base + prime dot
 *   shape-diamond      — homePrime diamond on homeAlt base + prime dot
 *   sunburst           — 8 alternating wedge sectors from a solid homePrime centre circle
 *   checkers           — alternating squares + prime dot  (GK default)
 */

import React from 'react';
import type { UniformStyleId, TeamPalette } from '@counter-attack/shared';

/** Parameters passed to every UniformStyleRenderer. Geometry + palette only — no teamId. */
interface UniformRenderParams {
  /** Piece centre x in SVG user-space pixels. */
  cx: number;
  /** Piece centre y in SVG user-space pixels. */
  cy: number;
  /** Piece radius (PIECE_RADIUS = 12). */
  R: number;
  /** 4-colour palette. GK swap is applied by the caller before this function is invoked. */
  palette: TeamPalette;
  /** True when the piece is a goalkeeper (passed through for renderer awareness, but
   *  renderers should use the already-swapped palette — not branch on isGK directly). */
  isGK: boolean;
  /** Globally unique piece id (e.g. 'home-5', 'away-0'). Used in SVG id attributes. */
  pieceId: string;
}

/** Return value of every UniformStyleRenderer.
 *  PieceOverlay assembles these three parts:
 *    <defs>{patternDef}</defs>   — if not null
 *    <circle fill={fill} ... />  — base piece circle
 *    {overlay}                   — sibling elements after the circle
 */
interface UniformRenderResult {
  /** React element (or Fragment) to place inside SVG <defs>. Null if the style needs no defs. */
  patternDef: React.ReactElement | null;
  /** Value for the base circle's fill= attribute (colour string or url(#id)). */
  fill: string;
  /** Sibling SVG elements rendered after the base circle. Must carry pointerEvents="none". */
  overlay: React.ReactElement | null;
}

/** A function that converts geometry + palette into SVG fragment descriptors. */
export type UniformStyleRenderer = (params: UniformRenderParams) => UniformRenderResult;

// ─── Pinstripes family ────────────────────────────────────────────────────────
// homeAlt base + homePrime thin stripes + prime dot for number legibility.
// Period ≈ ⅔R, stripe ≈ ⅓R so the pattern repeats 3× across the piece diameter.

const pinstripeVertical: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const period = Math.round((R * 2) / 3);
  const sw = Math.round(R / 3);
  const sx = Math.round((period - sw) / 2);
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <pattern
        id={`ps-v-${pieceId}`}
        x={cx - R}
        y={cy - R}
        width={period}
        height={period}
        patternUnits="userSpaceOnUse"
      >
        <rect width={period} height={period} fill={palette.homeAlt} />
        <rect x={sx} y={0} width={sw} height={period} fill={palette.homePrime} fillOpacity={0.9} />
      </pattern>
    ),
    fill: `url(#ps-v-${pieceId})`,
    overlay: <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />,
  };
};

const pinstripeHorizontal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const period = Math.round((R * 2) / 3);
  const sw = Math.round(R / 3);
  const sy = Math.round((period - sw) / 2);
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <pattern
        id={`ps-h-${pieceId}`}
        x={cx - R}
        y={cy - R}
        width={period}
        height={period}
        patternUnits="userSpaceOnUse"
      >
        <rect width={period} height={period} fill={palette.homeAlt} />
        <rect x={0} y={sy} width={period} height={sw} fill={palette.homePrime} fillOpacity={0.9} />
      </pattern>
    ),
    fill: `url(#ps-h-${pieceId})`,
    overlay: <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />,
  };
};

/** Diagonal pinstripes via patternTransform="rotate(45 cx cy)" on a square vertical-stripe tile. */
const pinstripeDiagonal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const period = Math.round((R * 2) / 3);
  const sw = Math.round(R / 3);
  const sx = Math.round((period - sw) / 2);
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <pattern
        id={`ps-d-${pieceId}`}
        x={0}
        y={0}
        width={period}
        height={period}
        patternUnits="userSpaceOnUse"
        patternTransform={`rotate(45 ${cx} ${cy})`}
      >
        <rect width={period} height={period} fill={palette.homeAlt} />
        <rect x={sx} y={0} width={sw} height={period} fill={palette.homePrime} fillOpacity={0.9} />
      </pattern>
    ),
    fill: `url(#ps-d-${pieceId})`,
    overlay: <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />,
  };
};

// ─── Bar family ───────────────────────────────────────────────────────────────
// homeAlt solid base + homePrime bar(s) + prime dot.
// Bar width ≈ ⅔R; line strokes scale proportionally.

const barHorizontal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const bw = Math.round((R * 2) / 3);
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <pattern
        id={`bh-${pieceId}`}
        x={cx - R}
        y={cy - R}
        width={R * 2}
        height={R * 2}
        patternUnits="userSpaceOnUse"
      >
        <rect width={R * 2} height={R * 2} fill={palette.homeAlt} />
        <rect
          x={0}
          y={R - bw / 2}
          width={R * 2}
          height={bw}
          fill={palette.homePrime}
          fillOpacity={0.85}
        />
      </pattern>
    ),
    fill: `url(#bh-${pieceId})`,
    overlay: <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />,
  };
};

const barVertical: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const bw = Math.round((R * 2) / 3);
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <pattern
        id={`bv-${pieceId}`}
        x={cx - R}
        y={cy - R}
        width={R * 2}
        height={R * 2}
        patternUnits="userSpaceOnUse"
      >
        <rect width={R * 2} height={R * 2} fill={palette.homeAlt} />
        <rect
          x={R - bw / 2}
          y={0}
          width={bw}
          height={R * 2}
          fill={palette.homePrime}
          fillOpacity={0.85}
        />
      </pattern>
    ),
    fill: `url(#bv-${pieceId})`,
    overlay: <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />,
  };
};

/** Crew default. homeAlt solid base + homePrime diagonal line + prime dot. */
const barDiagonal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const sw = Math.round((R * 10) / 12);
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <clipPath id={`clip-bd-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    ),
    fill: palette.homeAlt,
    overlay: (
      <>
        <line
          x1={cx - R}
          y1={cy - R}
          x2={cx + R}
          y2={cy + R}
          stroke={palette.homePrime}
          strokeWidth={sw}
          strokeOpacity={0.8}
          clipPath={`url(#clip-bd-${pieceId})`}
          pointerEvents="none"
        />
        <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

/** USA default. homeAlt solid base + two crossed homePrime diagonal bars + prime dot. */
const barX: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const sw = Math.round((R * 9) / 12);
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <clipPath id={`clip-bx-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    ),
    fill: palette.homeAlt,
    overlay: (
      <>
        <line
          x1={cx - R}
          y1={cy - R}
          x2={cx + R}
          y2={cy + R}
          stroke={palette.homePrime}
          strokeWidth={sw}
          strokeOpacity={0.85}
          clipPath={`url(#clip-bx-${pieceId})`}
          pointerEvents="none"
        />
        <line
          x1={cx + R}
          y1={cy - R}
          x2={cx - R}
          y2={cy + R}
          stroke={palette.homePrime}
          strokeWidth={sw}
          strokeOpacity={0.85}
          clipPath={`url(#clip-bx-${pieceId})`}
          pointerEvents="none"
        />
        <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

/** England default. homeAlt solid base + homePrime horizontal and vertical bars + prime dot.
 *  Bars extend edge-to-edge (cx±R / cy±R), clipped to the piece circle. */
const barPlus: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const bw = Math.round((R * 2) / 3);
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <clipPath id={`clip-bp-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    ),
    fill: palette.homeAlt,
    overlay: (
      <>
        <rect
          x={cx - R}
          y={cy - bw / 2}
          width={R * 2}
          height={bw}
          fill={palette.homePrime}
          clipPath={`url(#clip-bp-${pieceId})`}
          pointerEvents="none"
        />
        <rect
          x={cx - bw / 2}
          y={cy - R}
          width={bw}
          height={R * 2}
          fill={palette.homePrime}
          clipPath={`url(#clip-bp-${pieceId})`}
          pointerEvents="none"
        />
        <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

// ─── Split family ─────────────────────────────────────────────────────────────
// Hard 50/50 colour divide clipped to the piece circle + prime dot.

const splitHorizontal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <clipPath id={`clip-sh-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    ),
    fill: palette.homeAlt,
    overlay: (
      <>
        <rect
          x={cx - R * 2}
          y={cy}
          width={R * 4}
          height={R * 2}
          fill={palette.homePrime}
          clipPath={`url(#clip-sh-${pieceId})`}
          pointerEvents="none"
        />
        <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

/** Seattle default. Left half = homeAlt (base fill), right half = homePrime. */
const splitVertical: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <clipPath id={`clip-sv-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    ),
    fill: palette.homeAlt,
    overlay: (
      <>
        <rect
          x={cx}
          y={cy - R * 2}
          width={R * 2}
          height={R * 4}
          fill={palette.homePrime}
          clipPath={`url(#clip-sv-${pieceId})`}
          pointerEvents="none"
        />
        <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

/** Top-left = homeAlt, bottom-right = homePrime. */
const splitDiagonal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <clipPath id={`clip-sd-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    ),
    fill: palette.homeAlt,
    overlay: (
      <>
        <polygon
          points={`${cx + R * 2},${cy - R * 2} ${cx + R * 2},${cy + R * 2} ${cx - R * 2},${cy + R * 2}`}
          fill={palette.homePrime}
          clipPath={`url(#clip-sd-${pieceId})`}
          pointerEvents="none"
        />
        <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

// ─── Quarter family ───────────────────────────────────────────────────────────
// Four-section alternating patterns + prime dot.

/** Quarter (H): quarter-D rotated 45° — argyle/diamond checkerboard.
 *  2×2 checkerboard tile (sq=R, period=2R) with patternTransform="rotate(45 cx cy)". */
const quarterHorizontal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const sq = R;
  const period = sq * 2;
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <pattern
        id={`qh-${pieceId}`}
        x={cx - R}
        y={cy - R}
        width={period}
        height={period}
        patternUnits="userSpaceOnUse"
        patternTransform={`rotate(45 ${cx} ${cy})`}
      >
        <rect width={period} height={period} fill={palette.homeAlt} />
        <rect x={0} y={0} width={sq} height={sq} fill={palette.homePrime} />
        <rect x={sq} y={sq} width={sq} height={sq} fill={palette.homePrime} />
      </pattern>
    ),
    fill: `url(#qh-${pieceId})`,
    overlay: <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />,
  };
};

/** Quarter (D): 2×2 checkerboard aligned to axes — TL/BR = homePrime, TR/BL = homeAlt.
 *  Tile sq=R so exactly four squares span the piece bounding box. */
const quarterDiagonal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const sq = R;
  const period = sq * 2;
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <pattern
        id={`qd-${pieceId}`}
        x={cx - R}
        y={cy - R}
        width={period}
        height={period}
        patternUnits="userSpaceOnUse"
      >
        <rect width={period} height={period} fill={palette.homeAlt} />
        <rect x={0} y={0} width={sq} height={sq} fill={palette.homePrime} />
        <rect x={sq} y={sq} width={sq} height={sq} fill={palette.homePrime} />
      </pattern>
    ),
    fill: `url(#qd-${pieceId})`,
    overlay: <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />,
  };
};

// ─── Shape family ─────────────────────────────────────────────────────────────

/** Miami default. homePrime oval with rx=R (touches left/right edges), ry≈55% R, on homeAlt base + prime dot. */
const shapeOval: UniformStyleRenderer = ({ cx, cy, R, palette }) => {
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: null,
    fill: palette.homeAlt,
    overlay: (
      <>
        <ellipse
          cx={cx}
          cy={cy}
          rx={R}
          ry={R * 0.55}
          fill={palette.homePrime}
          pointerEvents="none"
        />
        <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

/** France default. homePrime circle (r=70% R) on homeAlt base + prime dot. */
const shapeCircle: UniformStyleRenderer = ({ cx, cy, R, palette }) => {
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: null,
    fill: palette.homeAlt,
    overlay: (
      <>
        <circle cx={cx} cy={cy} r={R * 0.7} fill={palette.homePrime} pointerEvents="none" />
        <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

/** Nashville default. homePrime diamond (inscribed at 90% R) on homeAlt base + prime dot, clipped to circle. */
const shapeDiamond: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <clipPath id={`clip-dm-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    ),
    fill: palette.homeAlt,
    overlay: (
      <>
        <polygon
          points={`${cx},${cy - R * 0.9} ${cx + R * 0.9},${cy} ${cx},${cy + R * 0.9} ${cx - R * 0.9},${cy}`}
          fill={palette.homePrime}
          clipPath={`url(#clip-dm-${pieceId})`}
          pointerEvents="none"
        />
        <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

// ─── Sunburst ─────────────────────────────────────────────────────────────────

/** Mexico default. 8 alternating wedge sectors (homePrime/homeAlt) radiating from a solid
 *  homePrime centre circle (r=45% R). Sectors start from piece perimeter inward. */
const sunburst: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const N = 8;
  const sectors = Array.from({ length: N }, (_, i) => {
    const a1 = (i * 2 * Math.PI) / N - Math.PI / 2;
    const a2 = ((i + 1) * 2 * Math.PI) / N - Math.PI / 2;
    const x1 = cx + R * Math.cos(a1);
    const y1 = cy + R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2);
    const y2 = cy + R * Math.sin(a2);
    const largeArc = a2 - a1 > Math.PI ? 1 : 0;
    return (
      <path
        key={i}
        d={`M ${cx},${cy} L ${x1.toFixed(2)},${y1.toFixed(2)} A ${R},${R} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`}
        fill={i % 2 === 0 ? palette.homePrime : palette.homeAlt}
        clipPath={`url(#clip-sb-${pieceId})`}
        pointerEvents="none"
      />
    );
  });

  return {
    patternDef: (
      <clipPath id={`clip-sb-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    ),
    fill: palette.homeAlt,
    overlay: (
      <>
        {sectors}
        <circle cx={cx} cy={cy} r={R * 0.45} fill={palette.homePrime} pointerEvents="none" />
      </>
    ),
  };
};

// ─── Checkers ─────────────────────────────────────────────────────────────────

/** GK default kit. homeAlt base + homePrime alternating checker squares + prime dot.
 *  Square size = R/2 so 4 squares span the radius (same visual density at all R values). */
const checkers: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => {
  const sq = Math.round(R / 2);
  const period = sq * 2;
  const dotR = Math.round((R * 7) / 12);
  return {
    patternDef: (
      <pattern
        id={`checkers-${pieceId}`}
        x={cx - R}
        y={cy - R}
        width={period}
        height={period}
        patternUnits="userSpaceOnUse"
      >
        <rect width={period} height={period} fill={palette.homeAlt} />
        <rect x={0} y={0} width={sq} height={sq} fill={palette.homePrime} />
        <rect x={sq} y={sq} width={sq} height={sq} fill={palette.homePrime} />
      </pattern>
    ),
    fill: `url(#checkers-${pieceId})`,
    overlay: <circle cx={cx} cy={cy} r={dotR} fill={palette.homePrime} pointerEvents="none" />,
  };
};

// ─── UNIFORM_STYLES registry ──────────────────────────────────────────────────

/** Complete registry of all 18 uniform style renderers.
 * Typed as Record<UniformStyleId, UniformStyleRenderer> — a missing renderer is a compile error. */
export const UNIFORM_STYLES: Record<UniformStyleId, UniformStyleRenderer> = {
  'pinstripes-horizontal': pinstripeHorizontal,
  'pinstripes-vertical': pinstripeVertical,
  'pinstripes-diagonal': pinstripeDiagonal,
  'bar-horizontal': barHorizontal,
  'bar-vertical': barVertical,
  'bar-diagonal': barDiagonal,
  'bar-x': barX,
  'bar-plus': barPlus,
  'split-horizontal': splitHorizontal,
  'split-vertical': splitVertical,
  'split-diagonal': splitDiagonal,
  'quarter-horizontal': quarterHorizontal,
  'quarter-diagonal': quarterDiagonal,
  'shape-oval': shapeOval,
  'shape-circle': shapeCircle,
  'shape-diamond': shapeDiamond,
  sunburst,
  checkers,
};
