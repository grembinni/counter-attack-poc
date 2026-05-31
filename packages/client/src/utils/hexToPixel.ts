/**
 * Hex-to-pixel coordinate conversion utilities for flat-top hex orientation.
 * Source: CONTEXT.md D-03 + redblobgames.com/grids/hexagons/
 *
 * Flat-top orientation (D-01): flat horizontal edges at top/bottom, pointy vertices left/right.
 * q-axis runs left-to-right (q=0 = home goal end, q=36 = away goal end). D-02.
 */

/** Default hex size in pixels. Selected per CONTEXT.md (Claude's discretion: 18–22px). */
export const HEX_SIZE = 20;

/**
 * Converts axial hex coordinate to SVG pixel center point using ODD-Q offset layout.
 * Even columns sit at integer r positions; odd columns are offset down by half a row.
 * This produces a rectangular bounding box (landscape, not a parallelogram).
 * Rendering only — game logic remains in axial coords. D-03.
 */
export function axialToPixel(
  q: number,
  r: number,
  hexSize: number = HEX_SIZE,
): { cx: number; cy: number } {
  return {
    cx: hexSize * (3 / 2) * q,
    cy: hexSize * Math.sqrt(3) * (r + 0.5 * (q % 2)),
  };
}

/**
 * Returns the 6 corner point strings for a flat-top hex polygon.
 * Flat-top vertex angles: 0°, 60°, 120°, 180°, 240°, 300° (D-03).
 * Returns a space-separated string of "x,y" pairs for use in SVG <polygon points="...">.
 * Source: CONTEXT.md D-03, redblobgames.com/grids/hexagons/
 */
export function hexPolygonPoints(cx: number, cy: number, hexSize: number = HEX_SIZE): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    return `${cx + hexSize * Math.cos(angleRad)},${cy + hexSize * Math.sin(angleRad)}`;
  }).join(' ');
}

/**
 * Computes the SVG viewBox string for the full 37×26 ODD-Q offset grid.
 * Width:  q=0 left-vertex (x=0 with translate) → q=36 right-vertex (x=1120).
 * Height: even-q r=0 top-flat (y=0 with translate) → odd-q r=25 bottom-flat (y≈918).
 * The HexGrid translate(hexSize, hexSize*√3/2) aligns the top-left corner to SVG origin.
 */
export function computeViewBox(hexSize: number = HEX_SIZE): string {
  // Width: 36 column-steps × 1.5×hexSize + 2×hexSize for left/right vertex padding.
  const width = hexSize * 1.5 * 36 + hexSize * 2; // 1120
  // Height: odd-q r=25 center + half-hex bottom + translate offset = hexSize×√3×26.5
  const height = hexSize * Math.sqrt(3) * 26.5;
  return `0 0 ${Math.ceil(width)} ${Math.ceil(height)}`;
}
