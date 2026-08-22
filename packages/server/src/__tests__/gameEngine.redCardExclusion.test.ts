/**
 * Phase 42 Plan 05 (BUG-38) engine-level regression tests.
 *
 * Scope: verifies gameEngine.ts's own occupancy/eligibility retrofits from Plan 42-03
 * (movement rejection, kick-off ball-carrier lookup) and Plan 42-05 (this plan's
 * restart/reposition occupancy sweep across lines 5103-9315) directly against the
 * exported apply-functions, at the engine layer — no socket/handler layer involved.
 *
 * Does NOT duplicate:
 * - gameHandlers.redCardExclusion.test.ts (Plan 42-02) — handler-level deflection
 *   defender-set builders and validateResponseMoveStep rejection, via the socket layer.
 * - gameEngine.cornerKick.test.ts / gameEngine.outOfBounds.test.ts — the per-eligibility-
 *   function unit tests (computeCornerKickEligibleIds/computeGoalKickEligibleIds's own
 *   "excludes a redCarded piece" cases). This file's eligibility spot-checks below cover
 *   only computePenaltyKickEligibleIds (untested elsewhere) and re-confirm
 *   computeCornerKickEligibleIds's existing exclusion as a guard against a retrofit that
 *   accidentally inverted the predicate (T-42-17), not fresh coverage of that function.
 * - gameEngine.phase26-rules.test.ts / gameEngine.booking.test.ts — existing applyMove
 *   RED_CARDED coverage from Plan 42-03; case 1 below re-asserts the exact return shape
 *   as a regression guard for this plan's sweep, not new discovery.
 *
 * Every dismissed-piece fixture sets BOTH redCarded: true and onPitch: false, except the
 * dedicated two-clause proof case (case 4), which sets only onPitch: false — BUG-38
 * (D-08/D-09): isActivePiece must exclude a piece on EITHER flag alone, not just their
 * conjunction.
 */
import { describe, it, expect } from 'vitest';
import {
  applyMove,
  applyFreeKickMove,
  applyCornerKickReposition,
  applyKickOffReady,
  computePenaltyKickEligibleIds,
  computeCornerKickEligibleIds,
} from '../gameEngine.js';
import type { GameState, PlayerPiece, HexCoord } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Fixture helpers — self-contained per project convention (each test file copies its
// own scaffolding rather than importing across test files; see testHelpers.ts's own
// doc comment and offside.test.ts's makeState/makePiece for the mirrored pattern).
// ---------------------------------------------------------------------------

function makePiece(
  overrides: Partial<PlayerPiece> & {
    id: string;
    teamId: 'home' | 'away';
    position: HexCoord;
  },
): PlayerPiece {
  return {
    firstName: 'Test',
    lastName: 'Player',
    number: 9,
    nationality: 'Test',
    role: 'FWD',
    pace: 5,
    shooting: 5,
    tackling: 5,
    dribbling: 5,
    saving: 5,
    handling: 5,
    resilience: 5,
    aerialAbility: 5,
    highPass: 5,
    ...overrides,
  };
}

/** Minimal GameState fixture — mirrors offside.test.ts/gameEngine.cornerKick.test.ts's baseline shape. */
function makeState(overrides: Partial<GameState> & { pieces: PlayerPiece[] }): GameState {
  return {
    roomCode: 'RCX01',
    phase: 'MOVE',
    activeTeam: 'home',
    attackingTeam: 'home',
    ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
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
    selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
    gameSpeed: 'standard' as const,
    ...overrides,
  };
}

describe('BUG-38 — red-carded pieces excluded from gameEngine occupancy and eligibility', () => {
  // -------------------------------------------------------------------------
  // 1. applyMove rejection retrofit (Plan 42-03)
  // -------------------------------------------------------------------------
  describe('applyMove — red-carded mover rejection', () => {
    it('rejects a redCarded mover with the exact MOVE_INVALID/RED_CARDED shape', () => {
      const mover = makePiece({
        id: 'home-red',
        teamId: 'home',
        position: { q: 10, r: 10 },
        redCarded: true,
        onPitch: false,
      });
      const state = makeState({ pieces: [mover] });
      const result = applyMove(state, mover.id, { q: 11, r: 10 });
      expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'RED_CARDED' });
    });
  });

  // -------------------------------------------------------------------------
  // 2. applyMove occupancy — a dead piece never blocks; a live piece still does
  // -------------------------------------------------------------------------
  describe('applyMove — destination occupancy', () => {
    const mover = makePiece({ id: 'home-mover', teamId: 'home', position: { q: 10, r: 10 } });
    const destHex: HexCoord = { q: 11, r: 10 }; // confirmed adjacent (even-q +1,0 neighbour)

    it('a destination hex occupied ONLY by a red-carded piece is now a legal move destination', () => {
      const deadOccupant = makePiece({
        id: 'away-dead',
        teamId: 'away',
        position: destHex,
        redCarded: true,
        onPitch: false,
      });
      const state = makeState({ pieces: [mover, deadOccupant] });
      const result = applyMove(state, mover.id, destHex);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.pieces.find((p) => p.id === mover.id)?.position).toEqual(destHex);
    });

    it('positive control: the same hex occupied by a live piece still returns OCCUPIED', () => {
      const liveOccupant = makePiece({ id: 'away-live', teamId: 'away', position: destHex });
      const state = makeState({ pieces: [mover, liveOccupant] });
      const result = applyMove(state, mover.id, destHex);
      expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OCCUPIED' });
    });

    // ---------------------------------------------------------------------
    // 4. Two-clause proof: onPitch:false alone (redCarded unset) excludes too.
    // ---------------------------------------------------------------------
    it('two-clause proof: onPitch:false alone (redCarded unset) is sufficient to exclude the occupant', () => {
      const benchedOccupant = makePiece({
        id: 'away-benched',
        teamId: 'away',
        position: destHex,
        onPitch: false,
      });
      const state = makeState({ pieces: [mover, benchedOccupant] });
      const result = applyMove(state, mover.id, destHex);
      expect(result.ok).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3a. Restart placement #1 — free-kick setup kicker placement (this plan, Task 2)
  // -------------------------------------------------------------------------
  describe('applyFreeKickMove — kicker-select placement (this plan, Task 2)', () => {
    const kicker = makePiece({ id: 'away-kicker', teamId: 'away', position: { q: 5, r: 5 } });
    const freeKickHex: HexCoord = { q: 25, r: 10 };

    function freeKickState(pieces: PlayerPiece[]): GameState {
      return makeState({
        pieces,
        phase: 'FREE_KICK_SETUP',
        freeKickHex,
        freeKickAttackingTeam: 'away',
        freeKickStageIndex: 0,
        freeKickPlacedPieceIds: [],
        freeKickKickerChosen: false,
        movedPieceIds: [],
      });
    }

    it('a red-carded piece frozen on freeKickHex no longer blocks kicker placement', () => {
      const deadOnHex = makePiece({
        id: 'home-dead',
        teamId: 'home',
        position: freeKickHex,
        redCarded: true,
        onPitch: false,
      });
      const state = freeKickState([kicker, deadOnHex]);
      const result = applyFreeKickMove(state, kicker.id, freeKickHex);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.pieces.find((p) => p.id === kicker.id)?.position).toEqual(freeKickHex);
      expect(result.state.freeKickKickerChosen).toBe(true);
    });

    it('positive control: a live piece on freeKickHex still returns KICKER_HEX_OCCUPIED', () => {
      const liveOnHex = makePiece({ id: 'home-live', teamId: 'home', position: freeKickHex });
      const state = freeKickState([kicker, liveOnHex]);
      const result = applyFreeKickMove(state, kicker.id, freeKickHex);
      expect(result).toEqual({ ok: false, reason: 'KICKER_HEX_OCCUPIED' });
    });
  });

  // -------------------------------------------------------------------------
  // 3b. Restart placement #2 — corner-kick reposition (this plan, Task 1)
  // -------------------------------------------------------------------------
  describe('applyCornerKickReposition — reposition destination occupancy (this plan, Task 1)', () => {
    const taker = makePiece({ id: 'away-taker', teamId: 'away', position: { q: 1, r: 1 } });
    const mover = makePiece({ id: 'away-mover', teamId: 'away', position: { q: 20, r: 16 } });
    const destHex: HexCoord = { q: 22, r: 16 };

    function cornerRepositionState(pieces: PlayerPiece[]): GameState {
      return makeState({
        pieces,
        phase: 'CORNER_KICK_REPOSITION',
        attackingTeam: 'away',
        activeTeam: 'away',
        cornerKickTeam: 'away',
        cornerKickHex: { q: 1, r: 1 },
        cornerKickTakerId: taker.id,
        cornerKickEligibleIds: { attacking: [mover.id], defending: [] },
        cornerKickStageIndex: 0,
        cornerKickStagePlacedIds: [],
        cornerKickUsedPace: {},
      });
    }

    it('a red-carded piece frozen on the destination hex no longer blocks the reposition', () => {
      const deadOnHex = makePiece({
        id: 'home-dead',
        teamId: 'home',
        position: destHex,
        redCarded: true,
        onPitch: false,
      });
      const state = cornerRepositionState([taker, mover, deadOnHex]);
      const result = applyCornerKickReposition(state, mover.id, destHex);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.pieces.find((p) => p.id === mover.id)?.position).toEqual(destHex);
    });

    it('positive control: a live piece on the destination hex still returns INVALID_TARGET', () => {
      const liveOnHex = makePiece({ id: 'home-live', teamId: 'home', position: destHex });
      const state = cornerRepositionState([taker, mover, liveOnHex]);
      const result = applyCornerKickReposition(state, mover.id, destHex);
      expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
    });
  });

  // -------------------------------------------------------------------------
  // 3c. Restart placement #3 — kick-off setup placement (this plan, Task 2)
  // -------------------------------------------------------------------------
  describe('applyKickOffReady — CENTRE_HEX_EMPTY (this plan, Task 2)', () => {
    const kickOffHex: HexCoord = { q: 18, r: 13 };
    const otherHomePiece = makePiece({
      id: 'home-other',
      teamId: 'home',
      position: { q: 10, r: 12 },
    });
    const awayDefender = makePiece({ id: 'away-def', teamId: 'away', position: { q: 25, r: 12 } });
    const awayGk = makePiece({
      id: 'away-gk',
      teamId: 'away',
      role: 'GK',
      position: { q: 30, r: 13 },
    });

    function kickOffState(homePieceOnHex: PlayerPiece): GameState {
      return makeState({
        pieces: [homePieceOnHex, otherHomePiece, awayDefender, awayGk],
        phase: 'KICK_OFF_SETUP',
        activeTeam: 'home',
        attackingTeam: 'home',
        movementSlot: null,
      });
    }

    it('a red-carded piece frozen on kickOffHex does not satisfy CENTRE_HEX_EMPTY', () => {
      const deadOnHex = makePiece({
        id: 'home-dead',
        teamId: 'home',
        position: kickOffHex,
        redCarded: true,
        onPitch: false,
      });
      const result = applyKickOffReady(kickOffState(deadOnHex), 'home');
      expect(result).toEqual({ ok: false, reason: 'CENTRE_HEX_EMPTY' });
    });

    it('positive control: a live piece on kickOffHex satisfies the placement (ok:true)', () => {
      const liveOnHex = makePiece({ id: 'home-live', teamId: 'home', position: kickOffHex });
      const result = applyKickOffReady(kickOffState(liveOnHex), 'home');
      expect(result.ok).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Eligibility retrofit spot-checks (guard against an inverted predicate, T-42-17)
  // -------------------------------------------------------------------------
  describe('Eligibility retrofit spot-checks', () => {
    it('computePenaltyKickEligibleIds excludes a red-carded piece (positive control: a live piece is included)', () => {
      const live = makePiece({ id: 'home-live', teamId: 'home', position: { q: 10, r: 10 } });
      const dead = makePiece({
        id: 'home-dead',
        teamId: 'home',
        position: { q: 12, r: 10 },
        redCarded: true,
        onPitch: false,
      });
      const result = computePenaltyKickEligibleIds([live, dead], 'away');
      expect(result.defending).toContain(live.id);
      expect(result.defending).not.toContain(dead.id);
    });

    it('computeCornerKickEligibleIds (the corner-kick-taker filter) still excludes a red-carded piece (positive control: a live piece is included)', () => {
      const live = makePiece({ id: 'home-live', teamId: 'home', position: { q: 10, r: 10 } });
      const dead = makePiece({
        id: 'home-dead',
        teamId: 'home',
        position: { q: 12, r: 10 },
        redCarded: true,
        onPitch: false,
      });
      const result = computeCornerKickEligibleIds([live, dead], 'away', null);
      expect(result.defending).toContain(live.id);
      expect(result.defending).not.toContain(dead.id);
    });
  });
});
