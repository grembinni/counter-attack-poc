/** Uniform style renderer registry for Counter Attack — Phase 20.
 * Each renderer takes palette-only params and returns SVG fragment descriptors.
 * Renderers NEVER inspect teamId — palette parameterization is the entire point (RESEARCH.md anti-patterns).
 * Every pattern/gradient/clipPath id embeds pieceId to avoid SVG defs collisions (Pitfall 1).
 * All pattern elements use patternUnits="userSpaceOnUse" + x/y anchor (Pitfall 4).
 * All overlay sibling elements carry pointerEvents="none" (RESEARCH.md Pattern 6).
 */

import React from 'react';
import type { UniformStyleId, TeamPalette } from '@counter-attack/shared';

/** Parameters passed to every UniformStyleRenderer. Geometry + palette only — no teamId. */
export interface UniformRenderParams {
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
export interface UniformRenderResult {
  /** React element (or Fragment) to place inside SVG <defs>. Null if the style needs no defs. */
  patternDef: React.ReactElement | null;
  /** Value for the base circle's fill= attribute (colour string or url(#id)). */
  fill: string;
  /** Sibling SVG elements rendered after the base circle. Must carry pointerEvents="none". */
  overlay: React.ReactElement | null;
}

/** A function that converts geometry + palette into SVG fragment descriptors. */
export type UniformStyleRenderer = (params: UniformRenderParams) => UniformRenderResult;

// ─── Renderer implementations ────────────────────────────────────────────────

/**
 * D-01 pinstripe — City default.
 * 8×24px tile: solid primary base + 4px-wide primaryLight stripe at x=2.
 * Source: PieceOverlay.tsx lines 146-157 (city-jersey pattern), parameterised.
 */
export const pinstripe: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <pattern
      id={`pinstripe-${pieceId}`}
      x={cx - R}
      y={cy - R}
      width={8}
      height={24}
      patternUnits="userSpaceOnUse"
    >
      <rect width={8} height={24} fill={palette.primary} />
      <rect x={2} y={0} width={4} height={24} fill={palette.primaryLight} fillOpacity={0.9} />
    </pattern>
  ),
  fill: `url(#pinstripe-${pieceId})`,
  overlay: null,
});

/**
 * D-02 diagonal — Crew default.
 * Solid primary base pattern + clipPath + diagonal line overlay.
 * Source: PieceOverlay.tsx lines 159-174 (crew-jersey) and 236-248 (crew diagonal line).
 *
 * NOTE — D-02 divergence: D-02 states "secondary2 stripe" but Phase 19 teamConfig.ts places
 * near-black (#111111) at Crew.secondary1 (not secondary2). The v1.2 PieceOverlay hardcodes
 * stroke="#111111" (line 242), matching secondary1. This renderer uses palette.secondary1
 * to match v1.2 appearance exactly. See RESEARCH.md "Critical Finding" and PATTERNS.md
 * "Critical Data Contract Notes #1". Divergence from D-02 wording is intentional.
 */
export const diagonal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <>
      <pattern
        id={`diagonal-${pieceId}`}
        x={cx - R}
        y={cy - R}
        width={R * 2}
        height={R * 2}
        patternUnits="userSpaceOnUse"
      >
        <rect width={R * 2} height={R * 2} fill={palette.primary} />
      </pattern>
      <clipPath id={`clip-diagonal-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    </>
  ),
  fill: `url(#diagonal-${pieceId})`,
  overlay: (
    <line
      x1={cx - R}
      y1={cy - R}
      x2={cx + R}
      y2={cy + R}
      stroke={palette.secondary1}
      strokeWidth={10}
      strokeOpacity={0.8}
      clipPath={`url(#clip-diagonal-${pieceId})`}
      pointerEvents="none"
    />
  ),
});

/**
 * D-03 checker — modelled on GK checker pattern.
 * 12×12px tile: primary base + two 6×6 secondary1 quadrant rects (top-left, bottom-right).
 * Source: PieceOverlay.tsx lines 179-194 (home-gk-checker pattern), parameterised.
 */
export const checker: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <pattern
      id={`checker-${pieceId}`}
      x={cx - R}
      y={cy - R}
      width={12}
      height={12}
      patternUnits="userSpaceOnUse"
    >
      <rect width={12} height={12} fill={palette.primary} />
      <rect x={0} y={0} width={6} height={6} fill={palette.secondary1} />
      <rect x={6} y={6} width={6} height={6} fill={palette.secondary1} />
    </pattern>
  ),
  fill: `url(#checker-${pieceId})`,
  overlay: null,
});

/**
 * D-04 cosmos — horizontal band.
 * 24×24px tile: primary base + secondary1 horizontal band y=6 h=12 at 0.85 opacity.
 * Source: PieceOverlay.tsx lines 119-130 (cosmos-jersey pattern), parameterised.
 */
export const cosmos: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <pattern
      id={`cosmos-${pieceId}`}
      x={cx - R}
      y={cy - R}
      width={24}
      height={24}
      patternUnits="userSpaceOnUse"
    >
      <rect width={24} height={24} fill={palette.primary} />
      <rect x={0} y={6} width={24} height={12} fill={palette.secondary1} fillOpacity={0.85} />
    </pattern>
  ),
  fill: `url(#cosmos-${pieceId})`,
  overlay: null,
});

/**
 * D-05 plus — bold cross shape.
 * Base fill: secondary2. Overlay: two rect bars forming a plus sign in primary.
 * Horizontal bar: x=cx-7, y=cy-2.5, w=14, h=5.
 * Vertical bar:   x=cx-2.5, y=cy-7, w=5, h=14.
 * Source: 20-UI-SPEC.md "Style-Specific Geometry — plus".
 */
export const plus: UniformStyleRenderer = ({ cx, cy, palette, pieceId }) => ({
  patternDef: null,
  fill: palette.secondary2,
  overlay: (
    <>
      <rect
        x={cx - 7}
        y={cy - 2.5}
        width={14}
        height={5}
        fill={palette.primary}
        pointerEvents="none"
      />
      <rect
        x={cx - 2.5}
        y={cy - 7}
        width={5}
        height={14}
        fill={palette.primary}
        pointerEvents="none"
      />
    </>
  ),
});

/**
 * D-06 v-stripe — V-shape chevron stripes.
 * 24×24px tile: secondary1 base + two primary polygon V-shapes per tile.
 * Source: 20-UI-SPEC.md "Style-Specific Geometry — v-stripe".
 */
export const vStripe: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <pattern
      id={`v-stripe-${pieceId}`}
      x={cx - R}
      y={cy - R}
      width={24}
      height={24}
      patternUnits="userSpaceOnUse"
    >
      <rect width={24} height={24} fill={palette.secondary1} />
      <polygon points="0,0 8,0 12,12 4,12" fill={palette.primary} />
      <polygon points="16,0 24,0 20,12 12,12" fill={palette.primary} />
    </pattern>
  ),
  fill: `url(#v-stripe-${pieceId})`,
  overlay: null,
});

/**
 * D-07 quarters — four-quadrant colour split.
 * 24×24px tile: secondary2 base (BL quadrant) + primary TL + secondary1 TR + primary BR.
 * Source: 20-UI-SPEC.md "Style-Specific Geometry — quarters".
 */
export const quarters: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <pattern
      id={`quarters-${pieceId}`}
      x={cx - R}
      y={cy - R}
      width={24}
      height={24}
      patternUnits="userSpaceOnUse"
    >
      {/* BL quadrant baseline — secondary2 covers whole tile first */}
      <rect width={24} height={24} fill={palette.secondary2} />
      {/* TL — primary */}
      <rect x={0} y={0} width={12} height={12} fill={palette.primary} />
      {/* TR — secondary1 */}
      <rect x={12} y={0} width={12} height={12} fill={palette.secondary1} />
      {/* BR — primary */}
      <rect x={12} y={12} width={12} height={12} fill={palette.primary} />
    </pattern>
  ),
  fill: `url(#quarters-${pieceId})`,
  overlay: null,
});

/**
 * D-08 polka-dots — dot pattern.
 * 10×10px tile: primary base + secondary1 circle r=2.5 at tile centre (5,5).
 * Source: 20-UI-SPEC.md "Style-Specific Geometry — polka-dots".
 */
export const polkaDots: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <pattern
      id={`polka-dots-${pieceId}`}
      x={cx - R}
      y={cy - R}
      width={10}
      height={10}
      patternUnits="userSpaceOnUse"
    >
      <rect width={10} height={10} fill={palette.primary} />
      <circle cx={5} cy={5} r={2.5} fill={palette.secondary1} />
    </pattern>
  ),
  fill: `url(#polka-dots-${pieceId})`,
  overlay: null,
});

/**
 * D-09 fade — linear gradient from primary (top-left) to secondary1 (bottom-right).
 * Uses <linearGradient> (not <pattern>) in patternDef. gradientUnits="userSpaceOnUse".
 * Source: 20-UI-SPEC.md "Style-Specific Geometry — fade" + RESEARCH.md Pattern 5.
 */
export const fade: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <linearGradient
      id={`grad-fade-${pieceId}`}
      gradientUnits="userSpaceOnUse"
      x1={cx - R}
      y1={cy - R}
      x2={cx + R}
      y2={cy + R}
    >
      <stop offset="0%" stopColor={palette.primary} />
      <stop offset="50%" stopColor={palette.primary} stopOpacity={0.5} />
      <stop offset="100%" stopColor={palette.secondary1} />
    </linearGradient>
  ),
  fill: `url(#grad-fade-${pieceId})`,
  overlay: null,
});

/**
 * D-10 tree-rings — concentric circle overlay (no pattern tile).
 * Base fill: primary. Overlay: three concentric rings at radii 12, 8, 4.
 * Ring 1 (outermost): r=12, stroke=primary, strokeWidth=3, fill=none.
 * Ring 2:             r=8,  stroke=primaryLight, strokeWidth=3, fill=none.
 * Ring 3 (innermost): r=4,  fill=primary (solid dot).
 * Source: 20-UI-SPEC.md "Style-Specific Geometry — tree-rings" + RESEARCH.md Pitfall 5.
 */
export const treeRings: UniformStyleRenderer = ({ cx, cy, palette, pieceId: _pieceId }) => ({
  patternDef: null,
  fill: palette.primary,
  overlay: (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={12}
        fill="none"
        stroke={palette.primary}
        strokeWidth={3}
        pointerEvents="none"
      />
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill="none"
        stroke={palette.primaryLight}
        strokeWidth={3}
        pointerEvents="none"
      />
      <circle cx={cx} cy={cy} r={4} fill={palette.primary} pointerEvents="none" />
    </>
  ),
});

/**
 * D-11 corners — primary corner triangles clipped to circle on secondary1 base.
 * Base fill: secondary1. clipPath: circle at cx/cy/R. Four corner triangles fill=primary.
 * Source: 20-UI-SPEC.md "Style-Specific Geometry — corners".
 */
export const corners: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <clipPath id={`clip-corners-${pieceId}`}>
      <circle cx={cx} cy={cy} r={R} />
    </clipPath>
  ),
  fill: palette.secondary1,
  overlay: (
    <>
      {/* TL triangle */}
      <polygon
        points={`${cx - 12},${cy - 12} ${cx},${cy - 12} ${cx - 12},${cy}`}
        fill={palette.primary}
        clipPath={`url(#clip-corners-${pieceId})`}
        pointerEvents="none"
      />
      {/* TR triangle */}
      <polygon
        points={`${cx + 12},${cy - 12} ${cx},${cy - 12} ${cx + 12},${cy}`}
        fill={palette.primary}
        clipPath={`url(#clip-corners-${pieceId})`}
        pointerEvents="none"
      />
      {/* BL triangle */}
      <polygon
        points={`${cx - 12},${cy + 12} ${cx},${cy + 12} ${cx - 12},${cy}`}
        fill={palette.primary}
        clipPath={`url(#clip-corners-${pieceId})`}
        pointerEvents="none"
      />
      {/* BR triangle */}
      <polygon
        points={`${cx + 12},${cy + 12} ${cx},${cy + 12} ${cx + 12},${cy}`}
        fill={palette.primary}
        clipPath={`url(#clip-corners-${pieceId})`}
        pointerEvents="none"
      />
    </>
  ),
});

/**
 * D-12 solid — plain solid fill. Simplest renderer.
 * No pattern, no overlay. fill = palette.primary.
 * Source: RESEARCH.md "Proposed solid Style Renderer".
 */
export const solid: UniformStyleRenderer = ({ palette }) => ({
  patternDef: null,
  fill: palette.primary,
  overlay: null,
});

// ─── UNIFORM_STYLES registry ──────────────────────────────────────────────────

/**
 * Phase 20 UNIFORM-01: Complete registry of all 12 uniform style renderers.
 * Typed as Record<UniformStyleId, UniformStyleRenderer> — a missing renderer is a compile error.
 * Kebab-cased keys ('v-stripe', 'polka-dots', 'tree-rings') map to camelCase consts (vStripe, etc.).
 */
export const UNIFORM_STYLES: Record<UniformStyleId, UniformStyleRenderer> = {
  pinstripe,
  diagonal,
  checker,
  cosmos,
  plus,
  'v-stripe': vStripe,
  quarters,
  'polka-dots': polkaDots,
  fade,
  'tree-rings': treeRings,
  corners,
  solid,
};
