import type { GameState, HexCoord, PlayerPiece } from './types.js';
import { hexDistance } from './hex.js';

/**
 * v1.6 (Phase 39): pure, side-effect-free foul/injury/booking/professional-foul rule
 * kernel. No imports from packages/server — every helper here is importable by both
 * the server engine and the client (T-39-02-01/02/03).
 *
 * RESEARCH.md Pitfall 2: injury/booking rolls use a bare `die >= attribute` comparison
 * — the INVERSE convention of every other duel in this codebase (which route through
 * `computeCombinedScore`). Higher resilience/leniency makes the roll LESS likely to
 * injure/book its owner. This is intentional rulebook behaviour — do not "correct" it.
 */

/**
 * FOUL-01: fixed trigger die value. A foul is called when the DEFENDER's own die
 * (`dice.stealDie` for STEAL_ATTEMPT, `dice.tackleDie` for TACKLE_ATTEMPT) equals this
 * value. Exported so the engine never hardcodes a magic `1`.
 *
 * Nutmeg is explicitly NOT a v1.6 trigger (REQUIREMENTS.md FOUL-01) — only the two
 * existing duel types (STEAL_ATTEMPT, TACKLE_ATTEMPT) can produce a foul.
 */
export const FOUL_TRIGGER_DIE = 1;

/** INJURY-02: the nine numeric PlayerPiece attributes degraded by an injury. */
export const INJURY_DEGRADED_ATTRIBUTES = [
  'pace',
  'shooting',
  'tackling',
  'dribbling',
  'saving',
  'handling',
  'resilience',
  'aerialAbility',
  'highPass',
] as const;

/** INJURY-01: true once `piece` has been injured at least once this match. */
export function isInjured(piece: PlayerPiece): boolean {
  return (piece.injuryCount ?? 0) > 0;
}

/**
 * Returns the additive penalty a duel site would apply for this piece's injury count.
 * Provided for any future duel-site use. INJURY-02 is delivered via stored attribute
 * degradation (see applyInjuryDegradation) — this helper must NOT be added to a
 * computeCombinedScore penalty array, or the injury would be double-counted (once via
 * the stored, already-degraded attribute, and again via this penalty).
 */
export function injuryPenalty(piece: PlayerPiece): number {
  return -(piece.injuryCount ?? 0);
}

/**
 * INJURY-02: returns a NEW piece (immutable) with every INJURY_DEGRADED_ATTRIBUTES key
 * decremented by 1, floored at 1 — except a value already at 0 (GKs legitimately carry
 * highPass: 0) is left at 0 rather than being raised to 1. `injuryCount` is incremented.
 * All other fields (id/teamId/position/firstName/lastName/number/nationality/role) are
 * untouched.
 */
export function applyInjuryDegradation(piece: PlayerPiece): PlayerPiece {
  const degraded = { ...piece };
  for (const key of INJURY_DEGRADED_ATTRIBUTES) {
    const v = piece[key];
    degraded[key] = v > 0 ? Math.max(1, v - 1) : v;
  }
  degraded.injuryCount = (piece.injuryCount ?? 0) + 1;
  return degraded;
}

/** INJURY-01: `die >= resilience` — see Pitfall 2 note above (bare comparison, no computeCombinedScore). */
export function rollsInjury(die: number, resilience: number): boolean {
  return die >= resilience;
}

/** CARD-01: `die >= leniency` — identical bare-comparison shape to rollsInjury (Pitfall 2). */
export function rollsBooking(die: number, leniency: number): boolean {
  return die >= leniency;
}

export type BookingOutcome = { card: 'none' | 'yellow' | 'red'; secondYellow: boolean };

/**
 * CARD-01/02/03: resolves a booking check into a card outcome.
 *
 * Evaluation order:
 * 1. Compute the base outcome: a professional foul rolls red-or-yellow
 *    (rollsBooking ? 'red' : 'yellow'); a normal foul rolls yellow-or-none
 *    (rollsBooking ? 'yellow' : 'none').
 * 2. If the base outcome is 'yellow' and the player already has >=1 prior yellow this
 *    match, upgrade to a second-yellow red (CARD-02) — this upgrade applies regardless
 *    of whether the foul was a professional foul, since a professional foul that only
 *    rolled yellow (CARD-03's "otherwise-yellow" branch) is still just a yellow subject
 *    to the same second-yellow rule.
 */
export function resolveBooking(input: {
  die: number;
  leniency: number;
  priorYellows: 0 | 1 | 2;
  professional: boolean;
}): BookingOutcome {
  const { die, leniency, priorYellows, professional } = input;
  const booked = rollsBooking(die, leniency);
  const baseCard: 'none' | 'yellow' | 'red' = professional
    ? booked
      ? 'red'
      : 'yellow'
    : booked
      ? 'yellow'
      : 'none';

  if (baseCard === 'yellow' && priorYellows >= 1) {
    return { card: 'red', secondYellow: true };
  }

  return { card: baseCard, secondYellow: false };
}

/**
 * FOUL-04: true only when NO other piece on the fouler's team (excluding the fouler
 * itself and excluding any redCarded piece) could have reached `foulHex` with its
 * remaining pace this Movement Phase.
 *
 * RESEARCH.md Pitfall 5: straight-line ("as the crow flies") reachability —
 * `hexDistance(other.position, foulHex) <= other.pace - (state.paceUsedByPieceId[other.id] ?? 0)`.
 * No path-walk, no occupancy simulation — this matches the move-range highlighting
 * standard already used elsewhere in the codebase.
 */
export function isProfessionalFoul(state: GameState, foulerId: string, foulHex: HexCoord): boolean {
  const fouler = state.pieces.find((p) => p.id === foulerId);
  if (!fouler) return true;

  const couldHaveCovered = state.pieces.some((other) => {
    if (other.id === foulerId) return false;
    if (other.teamId !== fouler.teamId) return false;
    if (other.redCarded) return false;
    const paceUsed = state.paceUsedByPieceId[other.id] ?? 0;
    const budget = other.pace - paceUsed;
    return hexDistance(other.position, foulHex) <= budget;
  });

  return !couldHaveCovered;
}
