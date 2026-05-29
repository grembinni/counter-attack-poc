/**
 * Heading duel validator for the Counter Attack game engine.
 *
 * HEAD-01: Challenger at distance 1 from ball: no penalty modifier.
 *          Challenger at distance 2 from ball: -1 penalty modifier.
 * HEAD-02: Uncontested header (no other challengers) is an automatic win — no dice roll.
 * HEAD-03: Headed shot — caller indicates intent via aimedAtGoal option (see options type).
 *          Phase 4 FSM wires GK involvement based on this signal. Not validated here.
 * HEAD-04: Two consecutive headed passes are not allowed (CONSECUTIVE_HEADER rejection).
 * HEAD-05: excludedPieceIds carries all participants so the Phase 4 FSM can enforce
 *          the "player who headed cannot head again this sequence" rule.
 *
 * The `state` parameter is accepted for type discipline and future eventLog consultation
 * (Phase 4 may derive previousActionWasHeadedPass from eventLog). In Phase 2, this is
 * passed explicitly via options.previousActionWasHeadedPass.
 */

import type { GameState, PlayerPiece, HexCoord } from './types.js';
import { hexDistance } from './hex.js';

/**
 * Discriminated union result for validateHeading.
 *
 * Reject: OUT_OF_RANGE (challenger > 2 hexes from ball), CONSECUTIVE_HEADER (HEAD-04).
 * Accept: contested:false (no other challengers — uncontested auto-win),
 *         or contested:true with penaltyModifier and excludedPieceIds.
 */
export type HeadingResult =
  | { ok: false; reason: 'OUT_OF_RANGE' | 'CONSECUTIVE_HEADER' }
  | { ok: true; contested: false }
  | { ok: true; contested: true; penaltyModifier: number; excludedPieceIds: string[] };

/** Options controlling heading evaluation context. */
export type HeadingOptions = {
  /** HEAD-04: true when the previous action in this sequence was a headed pass. */
  previousActionWasHeadedPass: boolean;
  /** IDs of all other pieces challenging for the same header (HEAD-05). */
  otherChallengerIds?: readonly string[];
  /**
   * HEAD-03: When true, caller intends a headed shot at goal.
   * The validateHeading result does not change — Phase 4 FSM uses this to involve the GK.
   * TODO: Verify head-shot composition with FSM before Phase 4 live use (CONTEXT.md).
   */
  aimedAtGoal?: boolean;
};

/**
 * Validates a heading challenge attempt.
 *
 * Guard precedence:
 * 1. CONSECUTIVE_HEADER (HEAD-04) — checked BEFORE distance (FSM context dominates geometry)
 * 2. OUT_OF_RANGE (HEAD-01) — challenger must be ≤2 hexes from ball
 * 3. Uncontested (HEAD-02) — no other challengers → auto-win (contested:false, no modifier)
 * 4. Contested — penaltyModifier computed here (dist===2 → -1), excludedPieceIds for HEAD-05
 *
 * @param _state - Game state (accepted for future eventLog use; Phase 2 uses options.previousActionWasHeadedPass)
 * @param challenger - The piece attempting the header
 * @param ballPosition - Current ball hex coordinate
 * @param options - Context including HEAD-04 flag and other challenger IDs
 */
export function validateHeading(
  _state: GameState,
  challenger: PlayerPiece,
  ballPosition: HexCoord,
  options: HeadingOptions,
): HeadingResult {
  // 1. HEAD-04: consecutive header restriction — FSM context checked before geometry
  if (options.previousActionWasHeadedPass) {
    return { ok: false, reason: 'CONSECUTIVE_HEADER' };
  }

  // 2. HEAD-01: distance check
  const dist = hexDistance(challenger.position, ballPosition);
  if (dist > 2) return { ok: false, reason: 'OUT_OF_RANGE' };

  // 3. HEAD-02: uncontested auto-win when no other challengers
  const otherIds = options.otherChallengerIds ?? [];
  if (otherIds.length === 0) {
    return { ok: true, contested: false };
  }

  // 4. Contested — penaltyModifier based on distance (HEAD-01), HEAD-05 excludedPieceIds
  const penaltyModifier = dist === 2 ? -1 : 0;
  const excludedPieceIds: string[] = [challenger.id, ...otherIds];
  return { ok: true, contested: true, penaltyModifier, excludedPieceIds };
}
