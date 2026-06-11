/**
 * Shot, save, and handling validators for the Counter Attack game engine.
 *
 * SHOT-01: Shot duel — combined-score comparison (shooter vs goalkeeper).
 * SHOT-02: Outside-area shot — -1 shooting penalty + GK 1-hex move permitted.
 *          Boundary detection is deferred to Phase 4 (requires pitch region encoding, CONTEXT.md Deferred Ideas).
 *          See getOutsideAreaModifiers() helper below.
 * SHOT-03: Auto-miss — if shooter dice === 1, result is AUTO_MISS before attribute calculation.
 * SHOT-04: GK dive range — saveable up to 3 hexes; 3rd hex incurs -1 saving penalty; 4+ hexes unsavable.
 * SHOT-06: Handling check — if diceValue >= gk.handling, the ball is spilled (triggerLooseBall).
 */

import type { PlayerPiece } from './types.js';
import { computeCombinedScore } from './scoreUtils.js';

/**
 * Discriminated union for shot duel outcome.
 *
 * SAVE carries needsHandlingCheck:true — caller invokes validateHandlingCheck.
 * D-13 (Phase 5): Ties (equal scores) produce LOOSE_BALL, not SAVE.
 */
export type ShotDuelResult =
  | { outcome: 'GOAL' }
  | { outcome: 'SAVE'; needsHandlingCheck: true }
  | { outcome: 'LOOSE_BALL' }; // D-13: tie → Loose Ball

/** GK dive savability result based on distance from shot origin (SHOT-04). */
export type DiveResult =
  | { saveable: true; savingPenalty: number }
  | { saveable: false; reason: 'OUT_OF_RANGE' };

/** Handling check result — spill (triggerLooseBall) or clean catch. */
export type HandlingResult = { caught: true } | { caught: false; triggerLooseBall: true };

/**
 * Resolves the shot duel between shooter and goalkeeper.
 *
 * SHOT-03: Auto-miss check runs BEFORE attribute calculation — if shooterDice === 1 the
 * shot is a miss regardless of attributes or GK dice.
 *
 * SHOT-01: Combined scores are computed via computeCombinedScore (DICE-04 -2 cap applied centrally).
 * Result: GOAL if shooterScore > gkScore; LOOSE_BALL if equal (D-13); SAVE if gkScore strictly greater.
 *
 * SHOT-02: Outside-area penalty (+GK 1-hex move permitted) requires pitch-area boundary detection,
 * deferred to Phase 4. See getOutsideAreaModifiers() for the static modifier constants.
 *
 * @param shooter - The shooting PlayerPiece
 * @param goalkeeper - The opposing GK PlayerPiece
 * @param shooterDice - Injected shooter dice value (1-6)
 * @param gkDice - Injected GK dice value (1-6)
 * @param shooterPenalties - Array of shooter penalty modifiers (DICE-04 cap applied)
 * @param gkPenalties - Array of GK penalty modifiers (DICE-04 cap applied)
 */
export function validateShotDuel(
  shooter: PlayerPiece,
  goalkeeper: PlayerPiece,
  shooterDice: number,
  gkDice: number,
  shooterPenalties: number[],
  gkPenalties: number[],
): ShotDuelResult {
  const shooterScore = computeCombinedScore(shooter.shooting, shooterDice, shooterPenalties);
  const gkScore = computeCombinedScore(goalkeeper.saving, gkDice, gkPenalties);

  if (shooterScore > gkScore) return { outcome: 'GOAL' };
  if (shooterScore === gkScore) return { outcome: 'LOOSE_BALL' }; // D-13: tie → Loose Ball
  return { outcome: 'SAVE', needsHandlingCheck: true };
}

/**
 * Returns the static outside-area modifiers for SHOT-02.
 * Pitch-area boundary detection is deferred to Phase 4.
 * The FSM will call this only after confirming the shot is from outside the penalty area.
 */
export function getOutsideAreaModifiers(): { shootingPenalty: -1; gkMayMoveOneHex: true } {
  return { shootingPenalty: -1, gkMayMoveOneHex: true };
}

/**
 * Determines whether the GK can reach the shot origin with a dive, and the saving penalty incurred.
 *
 * SHOT-04: GK can dive up to 3 hexes.
 * - distance > 3: unsavable (OUT_OF_RANGE)
 * - distance === 3: saveable with -1 savingPenalty
 * - distance 0–2: saveable with 0 savingPenalty
 *
 * Goal-line boundary (which axis is "parallel to the goal line") is deferred to Phase 4.
 * Negative distance is treated as distance 0.
 *
 * @param _gk - Goalkeeper piece (accepted for future attribute-based extensions)
 * @param distance - Distance in hexes from GK to shot origin
 */
export function validateGKDive(_gk: PlayerPiece, distance: number): DiveResult {
  // Negative distance treated as 0 (GK is already at or past shot origin — no dive needed)
  const d = Math.max(distance, 0);
  if (d > 3) return { saveable: false, reason: 'OUT_OF_RANGE' };
  const savingPenalty = d === 3 ? -1 : 0;
  return { saveable: true, savingPenalty };
}

/**
 * Determines whether the GK catches the saved ball or spills it for a Loose Ball.
 *
 * SHOT-06: If diceValue >= gk.handling, the GK spills the ball (triggerLooseBall).
 * Equality counts as a spill — callers should pass the raw dice value without adjustment.
 *
 * @param gk - Goalkeeper piece
 * @param diceValue - Injected dice value (1-6)
 */
export function validateHandlingCheck(gk: PlayerPiece, diceValue: number): HandlingResult {
  if (diceValue >= gk.handling) return { caught: false, triggerLooseBall: true };
  return { caught: true };
}
