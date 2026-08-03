/**
 * Phase 26 Plan 01 — Regression suite: applyUndo scoping for FREE_KICK_SETUP and MOVE.
 *
 * Requirements: BUG-24 (D-04, D-05)
 *
 * Locks the following behaviors:
 *   1. FREE_KICK_SETUP with no FK_SETUP_MOVE after the last stage boundary → NOTHING_TO_UNDO.
 *   2. FREE_KICK_SETUP with FK_SETUP_MOVE after boundary → ok:true, undoes correctly.
 *   3. FK_STAGE_ADVANCE boundary prevents undoing a pre-boundary FK_SETUP_MOVE.
 *   4. MOVE phase with moves only before a SLOT_ADVANCE → UNDO_LOCKED.
 *   5. MOVE phase with no MOVE events at all → NOTHING_TO_UNDO.
 */

import { describe, it, expect } from 'vitest';
import { applyUndo } from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';
import type { UniformStyleId } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Shared style defaults (Phase 22 D-17)
// ---------------------------------------------------------------------------

const DEFAULT_STYLES_P26: { home: UniformStyleId; away: UniformStyleId } = {
  home: 'pinstripes-vertical',
  away: 'bar-diagonal',
};

// ---------------------------------------------------------------------------
// Shared piece fixtures
// ---------------------------------------------------------------------------

const homeFWD: PlayerPiece = {
  id: 'home-9',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'FWD',
  number: 10,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 23, r: 9 },
  pace: 9,
  shooting: 9,
  tackling: 1,
  dribbling: 8,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 6,
  highPass: 5,
};

/** home-8: the second home piece — repositioned during FREE_KICK_SETUP stage 0. */
const homeMID: PlayerPiece = {
  id: 'home-8',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'MID',
  number: 8,
  nationality: 'Test',
  role: 'MID',
  position: { q: 21, r: 9 }, // moved to here by the FK_SETUP_MOVE in stage 0 fixture
  pace: 7,
  shooting: 5,
  tackling: 4,
  dribbling: 5,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 5,
  highPass: 5,
};

/** away-1: defending team piece repositioned in stage 1. */
const awayDEF: PlayerPiece = {
  id: 'away-1',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'DEF',
  number: 2,
  nationality: 'Test',
  role: 'DEF',
  position: { q: 18, r: 9 }, // moved here in stage-1 FK_SETUP_MOVE fixture
  pace: 5,
  shooting: 3,
  tackling: 7,
  dribbling: 4,
  saving: 1,
  handling: 0,
  resilience: 7,
  aerialAbility: 6,
  highPass: 4,
};

const awayGK: PlayerPiece = {
  id: 'away-0',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 36, r: 13 },
  pace: 2,
  shooting: 1,
  tackling: 4,
  dribbling: 3,
  saving: 9,
  handling: 8,
  resilience: 7,
  aerialAbility: 8,
  highPass: 0,
};

// ---------------------------------------------------------------------------
// Base FREE_KICK_SETUP state (stage 1, after stage 0 completed)
//
// Fixture represents the moment stage 1 (defending team repositions) has begun
// but no pieces have been placed yet — freeKickPlacedPieceIds is empty.
//
// EventLog: FK_KICKER_CHOSEN → FK_SETUP_MOVE(stage0, home-8) → FK_STAGE_ADVANCE
// ---------------------------------------------------------------------------

const baseFKSetupState: GameState = {
  roomCode: 'TEST26',
  phase: 'FREE_KICK_SETUP',
  activeTeam: 'away', // defending team's repositioning stage
  attackingTeam: 'home',
  pieces: [homeFWD, homeMID, awayDEF, awayGK],
  ball: { position: { q: 25, r: 13 }, carrierId: null, lastTouchedBy: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [
    {
      type: 'FK_KICKER_CHOSEN',
      kickerPieceId: 'home-9',
      hex: { q: 25, r: 13 },
      timestamp: 1000,
    },
    {
      type: 'FK_SETUP_MOVE',
      stageIndex: 0,
      pieceId: 'home-8',
      from: { q: 20, r: 9 }, // original position before stage-0 move
      to: { q: 21, r: 9 }, // current position (homeMID.position)
      timestamp: 2000,
    },
    {
      type: 'FK_STAGE_ADVANCE',
      fromStageIndex: 0,
      timestamp: 3000,
    },
  ],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  ballZone: 'away',
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' },
  selectedUniformStyles: DEFAULT_STYLES_P26,
  gameSpeed: 'standard',
  // FREE_KICK_SETUP fields
  freeKickHex: { q: 25, r: 13 },
  freeKickAttackingTeam: 'home',
  freeKickStageIndex: 1,
  freeKickPlacedPieceIds: [], // stage 1 just started — no pieces placed yet
  freeKickKickerChosen: true,
};

// ---------------------------------------------------------------------------
// Base MOVE state
// ---------------------------------------------------------------------------

const homeMover: PlayerPiece = {
  id: 'home-9',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'FWD',
  number: 10,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 11, r: 7 }, // already moved from {q:10,r:7}
  pace: 9,
  shooting: 9,
  tackling: 1,
  dribbling: 8,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 6,
  highPass: 5,
};

const baseMoveStateNoMoves: GameState = {
  roomCode: 'TEST26M',
  phase: 'MOVE',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeMover, awayGK],
  ball: { position: { q: 10, r: 7 }, carrierId: null, lastTouchedBy: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
  ballZone: 'middle',
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' },
  selectedUniformStyles: DEFAULT_STYLES_P26,
  gameSpeed: 'standard',
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Phase 26 BUG-24: applyUndo scoping — FREE_KICK_SETUP', () => {
  // ── Case 1 ──────────────────────────────────────────────────────────────
  // D-04: empty current stage (no FK_SETUP_MOVE after last FK_STAGE_ADVANCE) →
  // NOTHING_TO_UNDO, not UNDO_LOCKED, because the current stage simply has
  // nothing to undo and cross-stage undo is impossible.
  it('returns NOTHING_TO_UNDO when no FK_SETUP_MOVE exists after the last FK_STAGE_ADVANCE boundary (empty current stage)', () => {
    // baseFKSetupState has: FK_KICKER_CHOSEN → FK_SETUP_MOVE(stage0) → FK_STAGE_ADVANCE
    // Nothing after the FK_STAGE_ADVANCE; freeKickPlacedPieceIds is empty.
    const result = applyUndo(baseFKSetupState);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('NOTHING_TO_UNDO');
  });

  // ── Case 2 ──────────────────────────────────────────────────────────────
  // D-04: FK_SETUP_MOVE after the last FK_STAGE_ADVANCE boundary → ok:true,
  // undoes that move and removes the piece from freeKickPlacedPieceIds.
  it('undoes the last FK_SETUP_MOVE when it follows the last FK_STAGE_ADVANCE boundary', () => {
    // Stage 1 has one FK_SETUP_MOVE (away-1 moved from {q:17,r:9} to {q:18,r:9})
    const stateWithStage1Move: GameState = {
      ...baseFKSetupState,
      freeKickPlacedPieceIds: ['away-1'],
      eventLog: [
        ...baseFKSetupState.eventLog,
        {
          type: 'FK_SETUP_MOVE',
          stageIndex: 1,
          pieceId: 'away-1',
          from: { q: 17, r: 9 },
          to: { q: 18, r: 9 },
          timestamp: 4000,
        },
      ],
    };

    const result = applyUndo(stateWithStage1Move);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // away-1 should be restored to its pre-move position
    const piece = result.state.pieces.find((p) => p.id === 'away-1');
    expect(piece?.position).toEqual({ q: 17, r: 9 });

    // away-1 removed from freeKickPlacedPieceIds
    expect(result.state.freeKickPlacedPieceIds ?? []).not.toContain('away-1');

    // The FK_SETUP_MOVE(stage1) event removed from eventLog
    const fkMovesInLog = result.state.eventLog.filter((e) => e.type === 'FK_SETUP_MOVE');
    const stage1Moves = fkMovesInLog.filter(
      (e) => e.type === 'FK_SETUP_MOVE' && e.stageIndex === 1,
    );
    expect(stage1Moves).toHaveLength(0);
  });

  // ── Case 3 ──────────────────────────────────────────────────────────────
  // D-04: FK_STAGE_ADVANCE boundary prevents undoing a pre-boundary FK_SETUP_MOVE.
  // After undoing the post-boundary move, the pre-boundary move must still be in
  // the eventLog (applyUndo never crosses the FK_STAGE_ADVANCE).
  it('undoes only the post-boundary FK_SETUP_MOVE; the pre-boundary FK_SETUP_MOVE remains in the eventLog', () => {
    // EventLog: FK_KICKER_CHOSEN → FK_SETUP_MOVE(stage0,home-8) → FK_STAGE_ADVANCE → FK_SETUP_MOVE(stage1,away-1)
    const stateWithBothStages: GameState = {
      ...baseFKSetupState,
      freeKickPlacedPieceIds: ['away-1'],
      eventLog: [
        {
          type: 'FK_KICKER_CHOSEN',
          kickerPieceId: 'home-9',
          hex: { q: 25, r: 13 },
          timestamp: 1000,
        },
        {
          type: 'FK_SETUP_MOVE',
          stageIndex: 0,
          pieceId: 'home-8',
          from: { q: 20, r: 9 },
          to: { q: 21, r: 9 },
          timestamp: 2000,
        },
        {
          type: 'FK_STAGE_ADVANCE',
          fromStageIndex: 0,
          timestamp: 3000,
        },
        {
          type: 'FK_SETUP_MOVE',
          stageIndex: 1,
          pieceId: 'away-1',
          from: { q: 17, r: 9 },
          to: { q: 18, r: 9 },
          timestamp: 4000,
        },
      ],
    };

    const result = applyUndo(stateWithBothStages);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // away-1 (stage1 move) is undone
    const awayPiece = result.state.pieces.find((p) => p.id === 'away-1');
    expect(awayPiece?.position).toEqual({ q: 17, r: 9 });

    // home-8 (stage0 move — pre-boundary) is NOT affected
    const homePiece = result.state.pieces.find((p) => p.id === 'home-8');
    expect(homePiece?.position).toEqual({ q: 21, r: 9 }); // unchanged

    // The stage-0 FK_SETUP_MOVE is still in the eventLog
    const stage0MovesInLog = result.state.eventLog.filter(
      (e) => e.type === 'FK_SETUP_MOVE' && e.stageIndex === 0,
    );
    expect(stage0MovesInLog).toHaveLength(1);

    // The stage-1 FK_SETUP_MOVE has been removed
    const stage1MovesInLog = result.state.eventLog.filter(
      (e) => e.type === 'FK_SETUP_MOVE' && e.stageIndex === 1,
    );
    expect(stage1MovesInLog).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// MOVE phase undo scoping
// ---------------------------------------------------------------------------

describe('Phase 26 BUG-24: applyUndo scoping — MOVE phase', () => {
  // ── Case 4 ──────────────────────────────────────────────────────────────
  // D-05: cross-slot undo is prohibited — moves exist but only before a
  // SLOT_ADVANCE boundary → UNDO_LOCKED.
  it('returns UNDO_LOCKED when MOVE events exist only before a SLOT_ADVANCE boundary', () => {
    const stateWithCrossSlotMoves: GameState = {
      ...baseMoveStateNoMoves,
      eventLog: [
        {
          type: 'MOVE',
          pieceId: 'home-9',
          from: { q: 10, r: 7 },
          to: { q: 11, r: 7 },
          slot: 'ATTACKER_4',
          timestamp: 1000,
          ballAfter: { position: { q: 10, r: 7 }, carrierId: null },
        },
        {
          type: 'SLOT_ADVANCE',
          from: 'ATTACKER_4',
          to: 'DEFENDER_5',
          timestamp: 2000,
        },
      ],
      // paceUsedByPieceId is empty: no committed moves in the current slot
      paceUsedByPieceId: {},
    };

    const result = applyUndo(stateWithCrossSlotMoves);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('UNDO_LOCKED');
  });

  // ── Case 5 ──────────────────────────────────────────────────────────────
  // D-05: no MOVE events at all in the eventLog → NOTHING_TO_UNDO.
  it('returns NOTHING_TO_UNDO when no MOVE events exist in the eventLog', () => {
    // baseMoveStateNoMoves has an empty eventLog
    const result = applyUndo(baseMoveStateNoMoves);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('NOTHING_TO_UNDO');
  });
});

// ---------------------------------------------------------------------------
// BUG-37 (Phase 36) / D-13: applyUndo clamp-not-lockout for resolved
// TACKLE_ATTEMPT / STEAL_ATTEMPT
// ---------------------------------------------------------------------------

describe('Phase 36 BUG-37: applyUndo clamp-not-lockout — TACKLE_ATTEMPT / STEAL_ATTEMPT', () => {
  // ── Case 1 ──────────────────────────────────────────────────────────────
  // A resolved TACKLE_ATTEMPT is an undo floor: Undo cannot cross back over it.
  it('returns ok:false when the eventLog ends in a resolved TACKLE_ATTEMPT (clamp)', () => {
    const stateWithResolvedTackle: GameState = {
      ...baseMoveStateNoMoves,
      eventLog: [
        {
          type: 'MOVE',
          pieceId: 'home-9',
          from: { q: 10, r: 7 },
          to: { q: 11, r: 7 },
          slot: 'ATTACKER_4',
          timestamp: 1000,
          ballAfter: { position: { q: 10, r: 7 }, carrierId: null },
        },
        {
          type: 'TACKLE_ATTEMPT',
          defenderId: 'away-0',
          carrierId: 'home-9',
          defenderDie: 3,
          carrierDie: 5,
          defenderCombined: 7,
          carrierCombined: 13,
          result: 'FAIL',
          timestamp: 2000,
          ballAfter: { position: { q: 11, r: 7 }, carrierId: 'home-9' },
        },
      ],
      paceUsedByPieceId: { 'home-9': 1 },
    };

    const result = applyUndo(stateWithResolvedTackle);
    expect(result.ok).toBe(false);
  });

  // ── Case 2 ──────────────────────────────────────────────────────────────
  // D-13: Undo still works normally for a MOVE made AFTER the resolved
  // TACKLE_ATTEMPT — it reverts only that later move and leaves the
  // pre-tackle MOVE and the TACKLE_ATTEMPT itself untouched in the log.
  it('undoes a MOVE made after a resolved TACKLE_ATTEMPT, leaving the tackle and pre-tackle move intact', () => {
    const stateWithMoveAfterTackle: GameState = {
      ...baseMoveStateNoMoves,
      pieces: [{ ...homeMover, position: { q: 12, r: 7 } }, awayGK],
      eventLog: [
        {
          type: 'MOVE',
          pieceId: 'home-9',
          from: { q: 10, r: 7 },
          to: { q: 11, r: 7 },
          slot: 'ATTACKER_4',
          timestamp: 1000,
          ballAfter: { position: { q: 10, r: 7 }, carrierId: null },
        },
        {
          type: 'TACKLE_ATTEMPT',
          defenderId: 'away-0',
          carrierId: 'home-9',
          defenderDie: 3,
          carrierDie: 5,
          defenderCombined: 7,
          carrierCombined: 13,
          result: 'FAIL',
          timestamp: 2000,
          ballAfter: { position: { q: 11, r: 7 }, carrierId: 'home-9' },
        },
        {
          type: 'MOVE',
          pieceId: 'home-9',
          from: { q: 11, r: 7 },
          to: { q: 12, r: 7 },
          slot: 'ATTACKER_4',
          timestamp: 3000,
          ballAfter: { position: { q: 11, r: 7 }, carrierId: 'home-9' },
        },
      ],
      paceUsedByPieceId: { 'home-9': 2 },
    };

    const result = applyUndo(stateWithMoveAfterTackle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The later move is reverted — piece back at its `from`
    const piece = result.state.pieces.find((p) => p.id === 'home-9');
    expect(piece?.position).toEqual({ q: 11, r: 7 });

    // Only the pre-tackle MOVE remains; the later MOVE was removed
    const moveEvents = result.state.eventLog.filter((e) => e.type === 'MOVE');
    expect(moveEvents).toHaveLength(1);
    expect(moveEvents[0]).toMatchObject({ from: { q: 10, r: 7 }, to: { q: 11, r: 7 } });

    // The TACKLE_ATTEMPT is still present — undo never crosses a resolved contest
    const tackleEvents = result.state.eventLog.filter((e) => e.type === 'TACKLE_ATTEMPT');
    expect(tackleEvents).toHaveLength(1);
  });

  // ── Case 3 ──────────────────────────────────────────────────────────────
  // Same clamp behavior for a resolved STEAL_ATTEMPT.
  it('returns ok:false when the eventLog ends in a resolved STEAL_ATTEMPT (clamp)', () => {
    const stateWithResolvedSteal: GameState = {
      ...baseMoveStateNoMoves,
      eventLog: [
        {
          type: 'MOVE',
          pieceId: 'home-9',
          from: { q: 10, r: 7 },
          to: { q: 11, r: 7 },
          slot: 'ATTACKER_4',
          timestamp: 1000,
          ballAfter: { position: { q: 10, r: 7 }, carrierId: null },
        },
        {
          type: 'STEAL_ATTEMPT',
          defenderId: 'away-0',
          result: 'FAIL',
          defenderDie: 3,
          defenderCombined: 7,
          timestamp: 2000,
          ballAfter: { position: { q: 11, r: 7 }, carrierId: 'home-9' },
        },
      ],
      paceUsedByPieceId: { 'home-9': 1 },
    };

    const result = applyUndo(stateWithResolvedSteal);
    expect(result.ok).toBe(false);
  });

  // ── Case 3b ─────────────────────────────────────────────────────────────
  // D-13: Undo still works normally for a MOVE made AFTER the resolved
  // STEAL_ATTEMPT.
  it('undoes a MOVE made after a resolved STEAL_ATTEMPT, leaving the steal and pre-steal move intact', () => {
    const stateWithMoveAfterSteal: GameState = {
      ...baseMoveStateNoMoves,
      pieces: [{ ...homeMover, position: { q: 12, r: 7 } }, awayGK],
      eventLog: [
        {
          type: 'MOVE',
          pieceId: 'home-9',
          from: { q: 10, r: 7 },
          to: { q: 11, r: 7 },
          slot: 'ATTACKER_4',
          timestamp: 1000,
          ballAfter: { position: { q: 10, r: 7 }, carrierId: null },
        },
        {
          type: 'STEAL_ATTEMPT',
          defenderId: 'away-0',
          result: 'FAIL',
          defenderDie: 3,
          defenderCombined: 7,
          timestamp: 2000,
          ballAfter: { position: { q: 11, r: 7 }, carrierId: 'home-9' },
        },
        {
          type: 'MOVE',
          pieceId: 'home-9',
          from: { q: 11, r: 7 },
          to: { q: 12, r: 7 },
          slot: 'ATTACKER_4',
          timestamp: 3000,
          ballAfter: { position: { q: 11, r: 7 }, carrierId: 'home-9' },
        },
      ],
      paceUsedByPieceId: { 'home-9': 2 },
    };

    const result = applyUndo(stateWithMoveAfterSteal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const piece = result.state.pieces.find((p) => p.id === 'home-9');
    expect(piece?.position).toEqual({ q: 11, r: 7 });

    const moveEvents = result.state.eventLog.filter((e) => e.type === 'MOVE');
    expect(moveEvents).toHaveLength(1);

    const stealEvents = result.state.eventLog.filter((e) => e.type === 'STEAL_ATTEMPT');
    expect(stealEvents).toHaveLength(1);
  });

  // ── Case 4 ──────────────────────────────────────────────────────────────
  // Non-regression: an eventLog whose only boundary is a SLOT_ADVANCE behaves
  // exactly as the pre-existing Phase 26 tests already assert — guards
  // against the new TACKLE_ATTEMPT/STEAL_ATTEMPT terms accidentally
  // shadowing the existing SLOT_ADVANCE boundary.
  it('still returns UNDO_LOCKED for cross-slot moves when no tackle/steal event is present (non-regression)', () => {
    const stateWithCrossSlotMoves: GameState = {
      ...baseMoveStateNoMoves,
      eventLog: [
        {
          type: 'MOVE',
          pieceId: 'home-9',
          from: { q: 10, r: 7 },
          to: { q: 11, r: 7 },
          slot: 'ATTACKER_4',
          timestamp: 1000,
          ballAfter: { position: { q: 10, r: 7 }, carrierId: null },
        },
        {
          type: 'SLOT_ADVANCE',
          from: 'ATTACKER_4',
          to: 'DEFENDER_5',
          timestamp: 2000,
        },
      ],
      paceUsedByPieceId: {},
    };

    const result = applyUndo(stateWithCrossSlotMoves);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('UNDO_LOCKED');
  });
});
