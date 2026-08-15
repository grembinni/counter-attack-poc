import type { GameState, HexCoord, PlayerPiece } from './types.js';
import { hexDistance, hexLine, hexNeighbors } from './hex.js';

/**
 * v1.6 (Phase 39): pure, side-effect-free foul/injury/booking/professional-foul rule
 * kernel. No imports from packages/server — every helper here is importable by both
 * the server engine and the client (T-39-02-01/02/03).
 *
 * RESEARCH.md Pitfall 2: injury/booking rolls use a bare `die >= attribute` comparison
 * — the INVERSE convention of every other duel in this codebase (which route through
 * `computeCombinedScore`). Higher resilience/leniency makes the roll LESS likely to
 * injure/book its owner. This is intentional rulebook behaviour — do not "correct" it.
 *
 * FOUL-04 (Plan 39-19, closes 39-UAT gap 8): `isProfessionalFoul`'s reachability model
 * changed from omnidirectional teammate-coverage ("could any teammate anywhere reach the
 * foul hex") to goal-side + goal-path coverage — only defenders horizontally BETWEEN the
 * attacker and the goal they are attacking count, and only if they can reach the
 * attacker's straight-line goal path (see `attackerGoalPath` below) with their remaining
 * pace. The goalkeeper of the fouling (defending) team is now explicitly excluded from
 * the covering-defender set — previously only the fouler itself and red-carded pieces
 * were excluded.
 *
 * FOUL-01 from-behind variant (Plan 39-24, closes 39-UAT gap 7): a TACKLE_ATTEMPT that
 * arrives on either of the two hexes directly behind the ball carrier fouls on a
 * defender die of 1 OR 2 (`FOUL_TRIGGER_DIE_FROM_BEHIND`), instead of only 1
 * (`FOUL_TRIGGER_DIE`). STEAL_ATTEMPT and GK_DIVE_AT_FEET fouls are unaffected and keep
 * the die-of-1 trigger — see `foulTriggerThreshold`.
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

/**
 * FOUL-01 (Plan 39-24, 39-UAT gap 7): widened trigger for a TACKLE_ATTEMPT that arrives
 * from behind the ball carrier — a foul is called on a defender die less than or equal
 * to this value (so 1 OR 2). Every other duel (STEAL_ATTEMPT, GK_DIVE_AT_FEET, and a
 * TACKLE_ATTEMPT that is NOT from behind) keeps `FOUL_TRIGGER_DIE`. Never compare a die
 * to this constant directly at a call site — always go through `foulTriggerThreshold`,
 * the single place the two constants are chosen between.
 */
export const FOUL_TRIGGER_DIE_FROM_BEHIND = 2;

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
 * FOUL-04 (Plan 39-19): the goal-path row is clamped into this inclusive band before the
 * attacker's goal-path line is drawn. Quoting the user's rule verbatim: "Attackers
 * position (X,Y>20) = (X,20) AND position (X,Y<5) = (X,5) for calculations." Never
 * inline these numbers — always reference these constants.
 */
export const GOAL_PATH_R_MIN = 5;
export const GOAL_PATH_R_MAX = 20;

/**
 * FOUL-04: clamps a raw `r` (row) value into the inclusive `[GOAL_PATH_R_MIN,
 * GOAL_PATH_R_MAX]` band used for the attacker's goal-path calculation.
 */
export function clampGoalPathRow(r: number): number {
  return Math.min(GOAL_PATH_R_MAX, Math.max(GOAL_PATH_R_MIN, r));
}

/**
 * FOUL-04: returns the straight hex line from the fouled attacker's hex (with `r`
 * clamped via `clampGoalPathRow`) to the attacked goal column, at that SAME clamped row
 * — not the attacker's raw row. `attackingTeam` resolves the attacked goal column using
 * the repo-wide convention (`goalQ = attackingTeam === 'home' ? 36 : 0`, mirrored from
 * `applyDeclareShot`/`applySnapshot`/`applyResolveHeaderTarget` in gameEngine.ts).
 *
 * `hexLine` returns both endpoints inclusive (length = hexDistance + 1) — the returned
 * path includes the attacker's clamped hex and the goal-column hex at the clamped row.
 */
export function attackerGoalPath(
  attackerHex: HexCoord,
  attackingTeam: 'home' | 'away',
): HexCoord[] {
  const clampedR = clampGoalPathRow(attackerHex.r);
  const goalQ = attackingTeam === 'home' ? 36 : 0;
  return hexLine({ q: attackerHex.q, r: clampedR }, { q: goalQ, r: clampedR });
}

/**
 * FOUL-04: true (DOGSO) only when NO non-goalkeeper, non-red-carded defender on the
 * fouler's team is BOTH horizontally closer to the attacked goal than the fouled
 * attacker AND able to reach any hex of the attacker's clamped goal path with its
 * remaining pace this Movement Phase.
 *
 * `attackerHex` is the FOULED ATTACKER's hex (guaranteed by every `resolveFoulChain`
 * call site as of Plan 39-18) — NOT the tackle contact hex.
 *
 * This replaces the prior omnidirectional "could any teammate anywhere reach the foul
 * hex" test (39-UAT gap 8): a defender standing BEHIND the attacker (further from the
 * attacked goal) never suppresses DOGSO, no matter how much pace they have, and the
 * fouling team's goalkeeper never counts as a covering defender.
 *
 * RESEARCH.md Pitfall 5: straight-line ("as the crow flies") reachability —
 * `hexDistance(candidate.position, h) <= candidate.pace - (state.paceUsedByPieceId[candidate.id] ?? 0)`
 * for some hex `h` on the goal path. No path-walk, no occupancy simulation — this
 * matches the move-range highlighting standard already used elsewhere in the codebase.
 */
export function isProfessionalFoul(
  state: GameState,
  foulerId: string,
  attackerHex: HexCoord,
): boolean {
  const fouler = state.pieces.find((p) => p.id === foulerId);
  if (!fouler) return true;

  const defendingTeam = fouler.teamId;
  const attackingTeam: 'home' | 'away' = defendingTeam === 'home' ? 'away' : 'home';
  const goalQ = attackingTeam === 'home' ? 36 : 0;

  const path = attackerGoalPath(attackerHex, attackingTeam);

  const candidates = state.pieces.filter((candidate) => {
    const isGoalSide =
      goalQ === 36 ? candidate.position.q > attackerHex.q : candidate.position.q < attackerHex.q;
    return (
      candidate.teamId === defendingTeam &&
      candidate.id !== foulerId &&
      candidate.role !== 'GK' &&
      candidate.redCarded !== true &&
      isGoalSide
    );
  });

  const covered = candidates.some((candidate) => {
    const paceUsed = state.paceUsedByPieceId[candidate.id] ?? 0;
    const budget = candidate.pace - paceUsed;
    return path.some((h) => hexDistance(candidate.position, h) <= budget);
  });

  return !covered;
}

/**
 * FOUL-01 (Plan 39-24, 39-UAT gap 7): returns the two hexes directly behind
 * `attackerHex`, relative to the goal `attackingTeam` is attacking (`goalQ = 36` for
 * `'home'`, `goalQ = 0` for `'away'`, the repo-wide convention mirrored from
 * `attackerGoalPath` above). "Behind" means away from the attacked goal — the two
 * `hexNeighbors` results with `q === attackerHex.q - 1` for `'home'` (attacking toward
 * increasing q) or `q === attackerHex.q + 1` for `'away'` (attacking toward decreasing
 * q).
 *
 * The ODD-Q neighbour set (`hexNeighbors`, imported from `./hex.js` — never hand-rolled
 * here, per Phase 17.1-08's parity-bug precedent) always contains exactly two hexes at
 * each of `Δq = -1`, `Δq = 0`, `Δq = +1`, so this always returns exactly two hexes.
 * On-pitch filtering is deliberately NOT applied here — the caller compares this result
 * against a defender's actual (already move-validated, therefore on-pitch) destination
 * hex, so an off-pitch "behind" hex, if one exists at a board edge, simply never matches.
 */
export function hexesBehindAttacker(
  attackerHex: HexCoord,
  attackingTeam: 'home' | 'away',
): HexCoord[] {
  const behindQ = attackingTeam === 'home' ? attackerHex.q - 1 : attackerHex.q + 1;
  return hexNeighbors(attackerHex).filter((h) => h.q === behindQ);
}

/**
 * FOUL-01 (Plan 39-24): true when `tackleHex` structurally equals (matching `q` AND `r`
 * — never `Array.includes` on a `HexCoord`, the PITCH-02 structural-equality convention)
 * one of `hexesBehindAttacker(attackerHex, attackingTeam)`'s two hexes.
 */
export function isTackleFromBehind(
  attackerHex: HexCoord,
  tackleHex: HexCoord,
  attackingTeam: 'home' | 'away',
): boolean {
  return hexesBehindAttacker(attackerHex, attackingTeam).some(
    (h) => h.q === tackleHex.q && h.r === tackleHex.r,
  );
}

/**
 * FOUL-01 (Plan 39-24): the single place `FOUL_TRIGGER_DIE` and
 * `FOUL_TRIGGER_DIE_FROM_BEHIND` are chosen between — no call site should ever branch on
 * a `fromBehind` boolean itself.
 */
export function foulTriggerThreshold(fromBehind: boolean): number {
  return fromBehind ? FOUL_TRIGGER_DIE_FROM_BEHIND : FOUL_TRIGGER_DIE;
}
