/**
 * Movement Phase validator for the Counter Attack game engine.
 *
 * MOVE-01: Only one piece may move per Movement Phase slot.
 * MOVE-02: Movement is limited by the piece's Pace attribute.
 * MOVE-03: Pieces cannot move into a hex occupied by another piece.
 * MOVE-04: Ball-carrier moving into adjacency with an opponent triggers a steal attempt.
 * MOVE-05: Steal attempt involves all adjacent opponents at the destination.
 * MOVE-06: Free 6-hex move — deferred to Phase 4 (requires pitch region encoding, CONTEXT.md Deferred Ideas).
 * MOVE-07: Snapshot availability — penalty-area trigger deferred to Phase 4; Phase 2 returns
 *          { ok: true } when no STEAL_ATTEMPT applies. Phase 4 will gate SNAPSHOT_AVAILABLE on
 *          penalty-area membership once pitch regions are encoded.
 */

import type { GameState, PlayerPiece, HexCoord } from './types.js';
import { hexDistance, getZoIDefenders } from './hex.js';

/**
 * Discriminated union result for validateMove.
 *
 * Reject paths: WRONG_SLOT (no active movement phase), OUT_OF_RANGE (not single-step),
 * OCCUPIED (destination taken), PACE_EXCEEDED (would exceed pace cap for slot),
 * ALREADY_MOVED_IN_ATTACKER4 (ATTACKER_2 restricts each piece to one turn).
 *
 * Accept paths: plain ok:true, or ok:true with STEAL_ATTEMPT effect (ball-carrier + ZoI),
 * or ok:true with SNAPSHOT_AVAILABLE effect (Phase 4 gated, never emitted in Phase 2).
 */
export type MoveResult =
  | {
      ok: false;
      reason:
        | 'WRONG_SLOT'
        | 'OUT_OF_RANGE'
        | 'OCCUPIED'
        | 'PACE_EXCEEDED'
        | 'ALREADY_MOVED_IN_ATTACKER4';
    }
  | { ok: true }
  | { ok: true; effect: { type: 'STEAL_ATTEMPT'; defenders: PlayerPiece[] } }
  | { ok: true; effect: { type: 'SNAPSHOT_AVAILABLE' } };

/**
 * Validates a single-step movement action in the Movement Phase.
 *
 * Guard precedence (tests must verify this order):
 * 1. WRONG_SLOT — movementSlot must not be null
 * 2. OUT_OF_RANGE — destination must be exactly 1 hex away (D-10)
 * 3. OCCUPIED — destination must be unoccupied (MOVE-03)
 * 4. ATTACKER_2 branch: ALREADY_MOVED_IN_ATTACKER4 before PACE_EXCEEDED (D-12 before D-11)
 * 5. ATTACKER_4/DEFENDER_5 branch: PACE_EXCEEDED against piece.pace (D-11)
 * 6. ZoI steal trigger for ball-carrier only (MOVE-04/MOVE-05, D-03)
 *
 * @param state - Current game state (includes D-08 movement-tracking fields)
 * @param piece - The piece being moved
 * @param to - Destination hex coordinate
 */
export function validateMove(state: GameState, piece: PlayerPiece, to: HexCoord): MoveResult {
  // 1. WRONG_SLOT: movementSlot must be active (checked first — no movement outside Movement Phase)
  if (state.movementSlot === null) return { ok: false, reason: 'WRONG_SLOT' };

  // 2. OUT_OF_RANGE: single-step constraint (D-10)
  if (hexDistance(piece.position, to) !== 1) return { ok: false, reason: 'OUT_OF_RANGE' };

  // 3. OCCUPIED: destination must be clear (MOVE-03)
  if (state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r)) {
    return { ok: false, reason: 'OCCUPIED' };
  }

  // 4+5. Pace and ATTACKER_2 restrictions
  if (state.movementSlot === 'ATTACKER_2') {
    // D-12: check "already moved" before pace — ALREADY_MOVED_IN_ATTACKER4 takes precedence
    if (state.movedPieceIds.includes(piece.id)) {
      return { ok: false, reason: 'ALREADY_MOVED_IN_ATTACKER4' };
    }
    // D-11: flat 2-hex cap for ATTACKER_2 regardless of piece.pace
    const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0;
    if (paceUsed + 1 > 2) return { ok: false, reason: 'PACE_EXCEEDED' };
  } else {
    // ATTACKER_4 or DEFENDER_5: pace cap is the piece's own Pace attribute (D-11)
    const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0;
    if (paceUsed + 1 > piece.pace) return { ok: false, reason: 'PACE_EXCEEDED' };
  }

  // 6. ZoI steal trigger — only when the moving piece is the ball-carrier (D-03, MOVE-04/MOVE-05)
  // MOVE-06: deferred to Phase 4 — requires pitch region encoding (CONTEXT.md Deferred Ideas)
  if (state.ball.carrierId === piece.id) {
    const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
    const defenders = getZoIDefenders(to, opponents);
    if (defenders.length > 0) {
      return { ok: true, effect: { type: 'STEAL_ATTEMPT', defenders } };
    }
  }

  // MOVE-07: penalty-area trigger deferred to Phase 4; Phase 2 returns plain ok:true
  // when no STEAL_ATTEMPT applies. Phase 4 FSM will gate SNAPSHOT_AVAILABLE on
  // penalty-area membership once pitch regions are available.
  return { ok: true };
}
