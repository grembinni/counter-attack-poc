import type { HexCoord } from './types.js';
import { hexesInRange } from './hex.js';

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

// O(1) structural equality for HexCoord membership checks.
// NEVER use Array.includes() for HexCoord — object identity fails structural checks (PITCH-02).
const hexKey = (h: HexCoord): string => `${h.q},${h.r}`;
const buildRegion = (hexes: HexCoord[]): ReadonlySet<string> => new Set(hexes.map(hexKey));

/**
 * Named pitch regions derived from the placeholder 25×16 grid.
 * PITCH-02: All regions use ReadonlySet<string> for O(1) membership checks.
 */
export type PitchRegions = {
  homeThird: ReadonlySet<string>;
  awayThird: ReadonlySet<string>;
  middleThird: ReadonlySet<string>;
  homePenaltyArea: ReadonlySet<string>;
  awayPenaltyArea: ReadonlySet<string>;
  homeSixYardBox: ReadonlySet<string>;
  awaySixYardBox: ReadonlySet<string>;
  centreCircle: ReadonlySet<string>;
  /** Kick-off hex — the centre of the pitch. */
  kickOffHex: HexCoord;
};

/**
 * Encoded pitch regions for the placeholder 25×16 grid.
 * PLACEHOLDER — boundaries are approximations pending physical board measurements.
 * Phase 6 replaces these with real axial coordinates.
 * PITCH-02: All region lookups use Set.has() for O(1) structural-equality checks.
 */
export const PITCH_REGIONS: PitchRegions = {
  homeThird: buildRegion(PITCH_HEXES.filter((h) => h.q <= 7)),
  awayThird: buildRegion(PITCH_HEXES.filter((h) => h.q >= 17)),
  middleThird: buildRegion(PITCH_HEXES.filter((h) => h.q >= 8 && h.q <= 16)),
  homePenaltyArea: buildRegion(PITCH_HEXES.filter((h) => h.q <= 3 && h.r >= 4 && h.r <= 11)),
  awayPenaltyArea: buildRegion(PITCH_HEXES.filter((h) => h.q >= 21 && h.r >= 4 && h.r <= 11)),
  homeSixYardBox: buildRegion(PITCH_HEXES.filter((h) => h.q <= 1 && h.r >= 6 && h.r <= 9)),
  awaySixYardBox: buildRegion(PITCH_HEXES.filter((h) => h.q >= 23 && h.r >= 6 && h.r <= 9)),
  centreCircle: buildRegion(hexesInRange({ q: 12, r: 7 }, 3)),
  kickOffHex: { q: 12, r: 7 },
};

/**
 * Difficult-angle hexes — dot-marked positions on the physical board where shooting
 * is penalised. PITCH-03.
 * PLACEHOLDER — approximate positions. Phase 6 replaces with real coordinates.
 */
export const DIFFICULT_ANGLE_HEXES: ReadonlySet<string> = buildRegion([
  { q: 2, r: 3 },
  { q: 3, r: 3 },
  { q: 2, r: 4 },
  { q: 3, r: 4 }, // home end near-post
  { q: 2, r: 10 },
  { q: 3, r: 10 },
  { q: 2, r: 11 },
  { q: 3, r: 11 }, // home end far-post
  { q: 21, r: 3 },
  { q: 22, r: 3 },
  { q: 21, r: 4 },
  { q: 22, r: 4 }, // away end near-post
  { q: 21, r: 10 },
  { q: 22, r: 10 },
  { q: 21, r: 11 },
  { q: 22, r: 11 }, // away end far-post
]);

/**
 * Returns true when `hex` is inside the named pitch region.
 * PITCH-02: Uses Set.has() for O(1) structural equality — no Array.includes().
 */
export function isInRegion(hex: HexCoord, region: keyof Omit<PitchRegions, 'kickOffHex'>): boolean {
  return PITCH_REGIONS[region].has(hexKey(hex));
}

/**
 * Returns true when `hex` is a difficult-angle shooting position. PITCH-03.
 */
export function isDifficultAngle(hex: HexCoord): boolean {
  return DIFFICULT_ANGLE_HEXES.has(hexKey(hex));
}

/**
 * Returns true when `hex` is within the placeholder pitch grid.
 * Used by Loose Ball boundary enforcement to keep the ball in play.
 */
export function isPitchHex(hex: HexCoord): boolean {
  return PITCH_HEXES.some((h) => h.q === hex.q && h.r === hex.r);
}
