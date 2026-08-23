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
import { isActivePiece } from './stoppagePhases.js';

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
  | { ok: true; effect: { type: 'TACKLE_ATTEMPT'; carrierId: string } }
  | { ok: true; effect: { type: 'SNAPSHOT_AVAILABLE' } };

/**
 * Validates a single-step movement action in the Movement Phase.
 *
 * Guard precedence (tests must verify this order):
 * 1. WRONG_SLOT — movementSlot must not be null
 * 2. OUT_OF_RANGE — destination must be exactly 1 hex away (D-10)
 * 3. OCCUPIED — destination must be unoccupied (MOVE-03); a red-carded/benched piece is
 *    excluded via isActivePiece (BUG-38) — its frozen hex no longer blocks occupancy.
 * 4. ATTACKER_2 branch: ALREADY_MOVED_IN_ATTACKER4 before PACE_EXCEEDED (D-12 before D-11)
 * 5. ATTACKER_4/DEFENDER_5 branch: PACE_EXCEEDED against piece.pace (D-11)
 * 6. ZoI steal trigger for ball-carrier only (MOVE-04/MOVE-05, D-03); the opponent list is
 *    filtered through isActivePiece (BUG-38) — a red-carded opponent no longer projects ZoI.
 *
 * @param state - Current game state (includes D-08 movement-tracking fields)
 * @param piece - The piece being moved
 * @param to - Destination hex coordinate
 */
export function validateMove(state: GameState, piece: PlayerPiece, to: HexCoord): MoveResult {
  // 1. WRONG_SLOT: movementSlot must be active (checked first — no movement outside Movement Phase)
  if (state.movementSlot === null) return { ok: false, reason: 'WRONG_SLOT' };

  // 2. OUT_OF_RANGE: single-step — must move exactly 1 adjacent hex per action (D-10)
  if (hexDistance(piece.position, to) !== 1) return { ok: false, reason: 'OUT_OF_RANGE' };

  // 3. OCCUPIED: destination must be clear (MOVE-03). BUG-38: a red-carded/benched piece is
  // excluded by isActivePiece — its frozen hex no longer reports as occupied.
  if (
    state.pieces.some((p) => isActivePiece(p) && p.position.q === to.q && p.position.r === to.r)
  ) {
    return { ok: false, reason: 'OCCUPIED' };
  }

  // 4+5. Slot restrictions and per-step pace cap
  // Pieces in movedPieceIds have exhausted their activation — cannot move again this phase
  if (state.movedPieceIds.includes(piece.id)) {
    return { ok: false, reason: 'ALREADY_MOVED_IN_ATTACKER4' };
  }

  // Slot quota: each slot allows a fixed number of player activations (D-11)
  // ATTACKER_4 = 4 attackers, DEFENDER_5 = 5 defenders, ATTACKER_2 = 2 attackers (fresh players)
  const slotQuota =
    state.movementSlot === 'ATTACKER_4' ? 4 : state.movementSlot === 'DEFENDER_5' ? 5 : 2;
  const activatedCount = Object.keys(state.paceUsedByPieceId).length;
  const isNewActivation = (state.paceUsedByPieceId[piece.id] ?? 0) === 0;
  if (isNewActivation && activatedCount >= slotQuota) {
    return { ok: false, reason: 'PACE_EXCEEDED' }; // slot quota full
  }

  // D-11: each step costs 1 pace; reject if this step would exceed the effective pace cap.
  // ATTACKER_2 enforces an artificial cap of 2 hexes per piece regardless of piece.pace.
  const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0;
  const effectivePace = state.movementSlot === 'ATTACKER_2' ? Math.min(piece.pace, 2) : piece.pace;
  if (paceUsed + 1 > effectivePace) return { ok: false, reason: 'PACE_EXCEEDED' };

  // 6. ZoI steal trigger — only when the moving piece is the ball-carrier (D-03, MOVE-04/MOVE-05)
  // MOVE-06: deferred to Phase 4 — requires pitch region encoding (CONTEXT.md Deferred Ideas)
  if (state.ball.carrierId === piece.id) {
    // BUG-38: exclude red-carded/benched opponents via isActivePiece — a sent-off opponent no
    // longer projects a Zone of Influence. Independent of the stealAttemptedByIds exclusion
    // below; the two filters must not be merged.
    const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId && isActivePiece(p));
    const allDefenders = getZoIDefenders(to, opponents);
    // D-02 (Phase 17.1): exclude defenders who have already attempted a steal this sequence.
    // A defender flagged in stealAttemptedByIds still projects TACKLE ZoI (cross-type exclusion).
    const eligibleDefenders = allDefenders.filter(
      (d) => !(state.stealAttemptedByIds ?? []).includes(d.id),
    );
    // D-02 (Phase 43/TACKLE-01): order defenders by tackling descending so the prompt-and-decline
    // sequence offers the strongest tackler first. Sort a copy — never mutate the array returned
    // by .filter — with comparator (a, b) => b.tackling - a.tackling. Array.prototype.sort is
    // stable in Node 12+/all supported browsers, so defenders with equal tackling retain their
    // getZoIDefenders order (itself derived from state.pieces order) — this is the intentional,
    // documented tie-break, not an accident (43-RESEARCH.md Pitfall 2).
    const defenders = [...eligibleDefenders].sort((a, b) => b.tackling - a.tackling);
    if (defenders.length > 0) {
      return { ok: true, effect: { type: 'STEAL_ATTEMPT', defenders } };
    }
  }

  // 7. Tackle trigger — when a NON-carrier moves adjacent to an opponent carrier (D-10)
  // Only fires when: there is a carrier, the moving piece is NOT the carrier,
  // the carrier is on the opposing team, and the destination is adjacent to the carrier.
  // Note: STEAL_ATTEMPT and TACKLE_ATTEMPT are mutually exclusive (carrier vs non-carrier).
  // BUG-38: no isActivePiece guard is added here for the moving `piece` itself — a red-carded
  // piece can never be the carrier, and applyMove already rejects a red-carded mover by id
  // (gameEngine.ts CARD-02/CARD-04 guard). Duplicating that rejection here is deliberately
  // avoided.
  if (state.ball.carrierId !== null && state.ball.carrierId !== piece.id) {
    const carrier = state.pieces.find((p) => p.id === state.ball.carrierId);
    if (
      carrier !== undefined &&
      piece.teamId !== carrier.teamId &&
      hexDistance(to, carrier.position) === 1
    ) {
      // D-02 (Phase 17.1): exclude defenders who have already attempted a tackle this sequence.
      // The move itself remains valid (mirrors the STEAL_ATTEMPT pattern above) — only the
      // TACKLE_ATTEMPT effect is suppressed for an already-flagged tackler. Falls through to
      // the function's final plain { ok: true } return below.
      if (!(state.tackleAttemptedByIds ?? []).includes(piece.id)) {
        return { ok: true, effect: { type: 'TACKLE_ATTEMPT', carrierId: carrier.id } };
      }
    }
  }

  // MOVE-07: penalty-area trigger deferred to Phase 4; Phase 2 returns plain ok:true
  // when no STEAL_ATTEMPT applies. Phase 4 FSM will gate SNAPSHOT_AVAILABLE on
  // penalty-area membership once pitch regions are available.
  return { ok: true };
}
