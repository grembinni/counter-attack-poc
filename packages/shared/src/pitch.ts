import type { HexCoord } from './types.js';
import { hexesInRange } from './hex.js';

/**
 * Full 37×26 rectangular pitch grid: q∈[0,36], r∈[0,25], minus 19 even-q
 * `r=0` hexes excluded per Plan 37-14 (gap-closure wave 12, user-redefined
 * scope). Total: 943 hexes (962 − 19). D-04, amended by 37-14.
 *
 * 37-14 decision (recorded verbatim): under the CURRENT, unmodified client
 * clip geometry, every even-q `r=0` hex — e.g. (20,0), 19 hexes total,
 * q = 0,2,4,...,36 — renders at 0% visibility (entirely clipped, invisible,
 * unclickable). Rather than fixing client rendering (the original plan's
 * Task 2/3 scope), the user's final approved instruction was: "Do not change
 * anything about how the field currently renders — just remove 0% visibility
 * hexes from the field of play." So those 19 hexes are removed from the
 * rules layer only; zero client/rendering files were touched. No `r=25` hex
 * is excluded — every `r=25` hex (even-q and odd-q) remains in PITCH_HEXES
 * exactly as before (odd-q `r=25` and odd-q `r=0` still render at ~50%
 * visibility, which the user explicitly said is fine and not to touch).
 *
 * Replaces the placeholder 25×16 grid from Phase 1.
 */
export const PITCH_HEXES: readonly HexCoord[] = (() => {
  const hexes: HexCoord[] = [];
  for (let q = 0; q <= 36; q++) {
    for (let r = 0; r <= 25; r++) {
      // 37-14: even-q r=0 hexes are 0%-visibility under the current client
      // clip (entirely invisible and unclickable) — excluded from the rules
      // layer rather than fixing the renderer. See module doc comment above.
      if (r === 0 && q % 2 === 0) continue;
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
 * Named pitch regions for the 37×26 grid.
 * PITCH-02: All regions use ReadonlySet<string> for O(1) membership checks.
 * D-05: Region boundaries encoded from real board measurements.
 */
export type PitchRegions = {
  homeThird: ReadonlySet<string>;
  awayThird: ReadonlySet<string>;
  middleThird: ReadonlySet<string>;
  homePenaltyArea: ReadonlySet<string>;
  awayPenaltyArea: ReadonlySet<string>;
  homeSixYardBox: ReadonlySet<string>;
  awaySixYardBox: ReadonlySet<string>;
  homeGoal: ReadonlySet<string>;
  awayGoal: ReadonlySet<string>;
  centreCircle: ReadonlySet<string>;
  /** Kick-off hex — the centre of the 37×26 pitch. D-05. */
  kickOffHex: HexCoord;
};

/**
 * Encoded pitch regions for the real 37×26 grid. D-04, D-05.
 * PITCH-02: All region lookups use Set.has() for O(1) structural-equality checks.
 * Region boundaries:
 *   homeThird:        q ∈ [0, 10]  (11 columns)
 *   middleThird:      q ∈ [11, 25] (15 columns)
 *   awayThird:        q ∈ [26, 36] (11 columns)
 *   homeGoal:         q = 0,  r ∈ [10, 16]  (7 hexes)
 *   awayGoal:         q = 36, r ∈ [10, 16]  (7 hexes)
 *   homeSixYardBox:   q ∈ [0, 1],  r ∈ [8, 17]
 *   awaySixYardBox:   q ∈ [35, 36], r ∈ [8, 17]
 *   homePenaltyArea:  q ∈ [0, 5],  r ∈ [5, 19]
 *   awayPenaltyArea:  q ∈ [31, 36], r ∈ [5, 19]
 *   centreCircle:     hexDistance ≤ 3 from kickoff hex {q:18, r:13}
 *   kickOffHex:       {q: 18, r: 13}
 */
export const PITCH_REGIONS: PitchRegions = {
  homeThird: buildRegion(PITCH_HEXES.filter((h) => h.q <= 10)),
  middleThird: buildRegion(PITCH_HEXES.filter((h) => h.q >= 11 && h.q <= 25)),
  awayThird: buildRegion(PITCH_HEXES.filter((h) => h.q >= 26)),
  homePenaltyArea: buildRegion(PITCH_HEXES.filter((h) => h.q <= 5 && h.r >= 5 && h.r <= 19)),
  awayPenaltyArea: buildRegion(PITCH_HEXES.filter((h) => h.q >= 31 && h.r >= 5 && h.r <= 19)),
  homeSixYardBox: buildRegion(PITCH_HEXES.filter((h) => h.q <= 1 && h.r >= 8 && h.r <= 17)),
  awaySixYardBox: buildRegion(PITCH_HEXES.filter((h) => h.q >= 35 && h.r >= 8 && h.r <= 17)),
  homeGoal: buildRegion(PITCH_HEXES.filter((h) => h.q === 0 && h.r >= 10 && h.r <= 16)),
  awayGoal: buildRegion(PITCH_HEXES.filter((h) => h.q === 36 && h.r >= 10 && h.r <= 16)),
  centreCircle: buildRegion(hexesInRange({ q: 18, r: 13 }, 3)),
  kickOffHex: { q: 18, r: 13 },
};

/** r-values of the home goal (q=0) and away goal (q=36) hexes. Single source of truth for shot-range checks. */
export const GOAL_R_VALUES = [10, 11, 12, 13, 14, 15, 16] as const;

/**
 * Penalty spot hexes (PEN-01..03, Phase 39). Keyed by the DEFENDING team — the team
 * whose penalty area contains the spot (the ATTACKING/kicking team is the other key).
 * Derivation: `homePenaltyArea` is `q<=5, r 5..19` and `homeGoal` is `q=0, r 10..16`, so
 * the spot sits on the goal centre-line (`r=13`) two thirds of the way out (`q=4`); the
 * away spot is the `36 - q_home` mirror, matching the existing `q_away = 36 - q_home`
 * mirroring convention used throughout this file.
 */
export const PENALTY_SPOT: Readonly<Record<'home' | 'away', HexCoord>> = {
  home: { q: 4, r: 13 },
  away: { q: 32, r: 13 },
};

/**
 * Difficult-angle hexes — corner kick zones where shooting is penalised. PITCH-03.
 * 16 hexes per corner × 4 corners = 64 hexes total.
 *
 * Top-left shape (home goal × top sideline):
 *   r=1: q=0..4  r=2: q=0..2  r=3: q=0..2  r=4: q=0..1  r=5..7: q=0
 * Bottom corners shifted +1 row toward board edge vs. simple r-mirror of top.
 */
export const DIFFICULT_ANGLE_HEXES: ReadonlySet<string> = buildRegion([
  // Top-left corner
  { q: 0, r: 1 },
  { q: 1, r: 1 },
  { q: 2, r: 1 },
  { q: 3, r: 1 },
  { q: 4, r: 1 },
  { q: 0, r: 2 },
  { q: 1, r: 2 },
  { q: 2, r: 2 },
  { q: 0, r: 3 },
  { q: 1, r: 3 },
  { q: 2, r: 3 },
  { q: 0, r: 4 },
  { q: 1, r: 4 },
  { q: 0, r: 5 },
  { q: 0, r: 6 },
  { q: 0, r: 7 },

  // Bottom-left corner
  { q: 0, r: 25 },
  { q: 2, r: 25 },
  { q: 4, r: 25 },
  { q: 0, r: 24 },
  { q: 1, r: 24 },
  { q: 2, r: 24 },
  { q: 3, r: 24 },
  { q: 0, r: 23 },
  { q: 1, r: 23 },
  { q: 2, r: 23 },
  { q: 0, r: 22 },
  { q: 1, r: 22 },
  { q: 0, r: 21 },
  { q: 1, r: 21 },
  { q: 0, r: 20 },
  { q: 0, r: 19 },

  // Top-right corner (q mirrored: 36-q)
  { q: 36, r: 1 },
  { q: 35, r: 1 },
  { q: 34, r: 1 },
  { q: 33, r: 1 },
  { q: 32, r: 1 },
  { q: 36, r: 2 },
  { q: 35, r: 2 },
  { q: 34, r: 2 },
  { q: 36, r: 3 },
  { q: 35, r: 3 },
  { q: 34, r: 3 },
  { q: 36, r: 4 },
  { q: 35, r: 4 },
  { q: 36, r: 5 },
  { q: 36, r: 6 },
  { q: 36, r: 7 },

  // Bottom-right corner
  { q: 36, r: 25 },
  { q: 34, r: 25 },
  { q: 32, r: 25 },
  { q: 36, r: 24 },
  { q: 35, r: 24 },
  { q: 34, r: 24 },
  { q: 33, r: 24 },
  { q: 36, r: 23 },
  { q: 35, r: 23 },
  { q: 34, r: 23 },
  { q: 36, r: 22 },
  { q: 35, r: 22 },
  { q: 36, r: 21 },
  { q: 35, r: 21 },
  { q: 36, r: 20 },
  { q: 36, r: 19 },
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
 * MOVE-06 (Phase 17, corrected design D-33): classifies a hex into one of the three
 * pitch thirds for the ball-zone-triggered free-move rule. Mirrors the homeThird/
 * middleThird/awayThird boundaries already encoded in PITCH_REGIONS (q<=10 / q 11-25 /
 * q>=26) — exported standalone so gameEngine.ts can compare a ball position's zone
 * against `GameState.ballZone` without re-deriving the boundary logic.
 */
export function computeBallZone(position: HexCoord): 'home' | 'middle' | 'away' {
  if (isInRegion(position, 'homeThird')) return 'home';
  if (isInRegion(position, 'awayThird')) return 'away';
  return 'middle';
}

/** Pre-built Set for O(1) `isPitchHex` lookups (CR-04: was O(n) Array.some). */
const PITCH_HEX_SET: ReadonlySet<string> = buildRegion([...PITCH_HEXES]);

/**
 * Returns true when `hex` is within the 37×26 pitch grid.
 * Used by Loose Ball boundary enforcement to keep the ball in play.
 * CR-04: O(1) Set.has() — consistent with isInRegion/isDifficultAngle.
 */
export function isPitchHex(hex: HexCoord): boolean {
  return PITCH_HEX_SET.has(hexKey(hex));
}
