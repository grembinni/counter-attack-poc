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
 * Converts axial hex coordinate to SVG pixel center point.
 * Flat-top orientation as per CONTEXT.md D-03.
 *   cx = hexSize * (3/2 * q)
 *   cy = hexSize * (√3/2 * q + √3 * r)
 * Source: CONTEXT.md D-03, redblobgames.com/grids/hexagons/
 */
export function axialToPixel(
  q: number,
  r: number,
  hexSize: number = HEX_SIZE,
): { cx: number; cy: number } {
  return {
    cx: hexSize * (3 / 2) * q,
    cy: hexSize * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
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
 * Computes the SVG viewBox string for the full 37×26 grid with padding.
 * Padding of 2×hexSize avoids q=0/r=0 hex clipping at SVG origin (Pitfall 5).
 * The HexGrid component should apply <g transform="translate(hexSize, hexSize * √3/2)">
 * to offset the origin so the q=0,r=0 hex center is fully visible.
 * Source: CONTEXT.md D-03, redblobgames.com/grids/hexagons/
 */
export function computeViewBox(hexSize: number = HEX_SIZE): string {
  const maxCoord = axialToPixel(36, 25, hexSize);
  const width = maxCoord.cx + hexSize * 2;
  const height = maxCoord.cy + hexSize * 2;
  return `0 0 ${width} ${height}`;
}
