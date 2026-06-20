import type { GameState, PlayerPiece } from './types.js';
import { PITCH_REGIONS } from './pitch.js';

/**
 * OFFSIDE-01 (D-21..D-24): pure, team-relative offside geometry helpers.
 *
 * Mirrors the existing half-boundary convention used by kick-off enforcement
 * (gameEngine.ts applyKickOffReady): home attacks toward higher q, away attacks
 * toward lower q, and `OFFSIDE_HALFWAY_Q` (the kickOffHex column, q=18) is the
 * half-field boundary — fixed across both halves.
 *
 * All helpers are pure (no I/O, no side effects) and unit-testable in isolation
 * from the FSM wiring that calls `evaluateOffside` at end-of-phase transitions
 * (gameEngine.ts applyEndTurn / applyFreeMoveEnd).
 */

/** Half-field boundary column — mirrors the kick-off centre hex's q coordinate. */
export const OFFSIDE_HALFWAY_Q = PITCH_REGIONS.kickOffHex.q;

/**
 * D-24: direction multiplier for a team's attacking direction along the q-axis.
 * home attacks toward higher q (+1); away attacks toward lower q (-1).
 */
export function attackingDirection(team: 'home' | 'away'): 1 | -1 {
  return team === 'home' ? 1 : -1;
}

/**
 * D-21 condition 1: true when `piece` is strictly past the half-field line in its
 * own team's attacking direction. Exactly on the halfway column (q===18) is NOT past.
 */
export function isPastHalfway(piece: PlayerPiece, team: 'home' | 'away'): boolean {
  const dir = attackingDirection(team);
  return (piece.position.q - OFFSIDE_HALFWAY_Q) * dir > 0;
}

/**
 * Generic "is `aheadQ` strictly ahead of `refQ` in `team`'s attacking direction" check.
 * Used both for "piece ahead of ball" (D-21 condition 2) and internally for opposing-
 * piece counting (D-21 condition 3 / D-24).
 */
export function isAheadOf(aheadQ: number, refQ: number, team: 'home' | 'away'): boolean {
  const dir = attackingDirection(team);
  return (aheadQ - refQ) * dir > 0;
}

/**
 * D-21 condition 3 / D-24: counts OTHER-team pieces (any role, GK included) positioned
 * equal-to-or-ahead of `piece` in `piece`'s own team's attacking direction.
 * "Equal-or-ahead" is the logical negation of "strictly behind" — i.e. NOT
 * isAheadOf(piece.q, opp.q, team) when checked from the opponent's q relative to piece's q.
 */
export function opposingPiecesEqualOrAhead(state: GameState, piece: PlayerPiece): number {
  const dir = attackingDirection(piece.teamId);
  return state.pieces.filter((opp) => {
    if (opp.teamId === piece.teamId) return false;
    // Equal-or-ahead in piece's attacking direction: (opp.q - piece.q) * dir >= 0
    return (opp.position.q - piece.position.q) * dir >= 0;
  }).length;
}

/**
 * D-21: true iff ALL three trigger conditions hold for `piece` right now:
 * (1) past halfway, (2) strictly ahead of the ball, (3) <=1 opposing piece equal-or-ahead.
 */
export function isOffsideNow(state: GameState, piece: PlayerPiece): boolean {
  const team = piece.teamId;
  const pastHalfway = isPastHalfway(piece, team);
  const aheadOfBall = isAheadOf(piece.position.q, state.ball.position.q, team);
  const opposingCount = opposingPiecesEqualOrAhead(state, piece);
  return pastHalfway && aheadOfBall && opposingCount <= 1;
}

/**
 * D-22: true iff the clear condition holds — the logical complement of D-21's
 * conditions 2 and 3 (condition 1, past-halfway, is irrelevant to clearing: D-22 is
 * "equal-or-behind ball OR >=2 opposing equal-or-ahead", independent of halfway status).
 */
export function isClearedNow(state: GameState, piece: PlayerPiece): boolean {
  const team = piece.teamId;
  const aheadOfBall = isAheadOf(piece.position.q, state.ball.position.q, team);
  const opposingCount = opposingPiecesEqualOrAhead(state, piece);
  return !aheadOfBall || opposingCount >= 2;
}

/**
 * D-23: returns the next sticky `offsidePieceIds` set — keeps already-flagged ids
 * unless `isClearedNow`, and adds every piece where `isOffsideNow` holds right now.
 * Order: stable, deduplicated (existing flagged ids first, in their existing order,
 * followed by any newly-flagged ids not already present).
 */
export function evaluateOffside(state: GameState): readonly string[] {
  const priorFlagged = state.offsidePieceIds ?? [];
  const piecesById = new Map(state.pieces.map((p) => [p.id, p] as const));

  const stillFlagged = priorFlagged.filter((id) => {
    const piece = piecesById.get(id);
    if (!piece) return false; // defensive: piece no longer exists
    return !isClearedNow(state, piece);
  });

  const newlyFlagged = state.pieces
    .filter((p) => !stillFlagged.includes(p.id) && isOffsideNow(state, p))
    .map((p) => p.id);

  return [...stillFlagged, ...newlyFlagged];
}
