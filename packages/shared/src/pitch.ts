import type { HexCoord } from './types.js';

// PLACEHOLDER: This grid is a rectangular approximation of the Counter Attack board.
// It is NOT derived from real board measurements and must NOT be used for
// boundary-dependent rules (goal detection, penalty box, pitch edge).
//
// Blocking dependency: pending real board measurements from the user (photo/ruler).
// See STATE.md §Blocking Dependencies — "Board layout (HARD BLOCK)".
// Replace this export when real axial coordinates are provided in Phase 6.

/**
 * PLACEHOLDER rectangular grid approximating the Counter Attack pitch.
 * ~25 cols × 16 rows; actual board dimensions are a blocking dependency.
 * This constant pending real board measurements — do not use for boundary rules.
 */
export const PITCH_HEXES: readonly HexCoord[] = (() => {
  const hexes: HexCoord[] = [];
  // Approximate Counter Attack board: ~25 cols × 16 rows
  // Real axial coordinates depend on physical board measurements (blocking dependency).
  for (let q = 0; q < 25; q++) {
    for (let r = 0; r < 16; r++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
})();
