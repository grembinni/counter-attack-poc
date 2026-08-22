/**
 * Phase 42 Plan 13 (gap item 7, OFFSIDE-02): defensive wall distance invariant.
 *
 * Characterises `hexDistance(defender.position, freeKickHex) >= 3` for every ACTIVE
 * defending-team piece at every FREE_KICK_SETUP boundary — award time, every
 * defending-stage ENTRY, and every defending-stage END. Written RED-first per Task 1:
 * cases 1/2/7/8/10 are expected GREEN against the unmodified engine (the award-time
 * sweep, `relocateTrappedFreeKickPieces`, already covers those); cases 3-6 are expected
 * RED — they characterise the gap this plan closes (auto-move at stage-entry/stage-end
 * boundaries, replacing the silent too-close-to-freeKickHex rejection).
 *
 * Fixture conventions mirror offside.test.ts's `makePiece`/`makeState`/`freeKickState`
 * verbatim (per this plan's read_first) — reused here rather than inventing a new shape.
 */
import { describe, it, expect } from 'vitest';
import {
  applyFreeKickReady,
  applyOffsideFoulWithRelocation,
  applyFoulChoice,
} from '../gameEngine.js';
import type { GameState, PlayerPiece, UniformStyleId } from '@counter-attack/shared';
import { hexDistance, isActivePiece } from '@counter-attack/shared';

// Phase 22 D-17: default uniform styles for test call sites.
const DEFAULT_STYLES: { home: UniformStyleId; away: UniformStyleId } = {
  home: 'pinstripes-vertical',
  away: 'bar-diagonal',
};

// ---------------------------------------------------------------------------
// Test fixtures (mirrors offside.test.ts's fixture conventions verbatim)
// ---------------------------------------------------------------------------

function makePiece(
  overrides: Partial<PlayerPiece> & {
    id: string;
    teamId: 'home' | 'away';
    position: { q: number; r: number };
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

/** Minimal GameState fixture — only fields the engine reads are meaningful. */
function makeState(overrides: Partial<GameState> & { pieces: PlayerPiece[] }): GameState {
  return {
    roomCode: 'TEST-WALL',
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
    selectedUniformStyles: DEFAULT_STYLES,
    gameSpeed: 'standard' as const,
    ...overrides,
  };
}

/** Mirrors offside.test.ts's freeKickState helper verbatim. */
function freeKickState(overrides: Partial<GameState> & { pieces: PlayerPiece[] }): GameState {
  return makeState({
    phase: 'FREE_KICK_SETUP',
    freeKickHex: { q: 25, r: 10 },
    freeKickAttackingTeam: 'away',
    freeKickStageIndex: 0,
    freeKickPlacedPieceIds: [],
    movedPieceIds: [],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Shared invariant helper (Task 1.A)
// ---------------------------------------------------------------------------

/**
 * Asserts every ACTIVE piece of `defendingTeam` is at least 3 hexes from
 * `state.freeKickHex`. Throws with the offending piece id and its measured distance
 * so a red run is self-diagnosing (Task 1.A requirement).
 */
function assertWallDistanceHolds(state: GameState, defendingTeam: 'home' | 'away'): void {
  const freeKickHex = state.freeKickHex;
  if (!freeKickHex) {
    throw new Error(
      'assertWallDistanceHolds: state.freeKickHex is null — invariant is undefined without a live free kick',
    );
  }
  for (const piece of state.pieces) {
    if (!isActivePiece(piece) || piece.teamId !== defendingTeam) continue;
    const dist = hexDistance(piece.position, freeKickHex);
    if (dist < 3) {
      throw new Error(
        `assertWallDistanceHolds: piece ${piece.id} (team ${piece.teamId}) is at distance ${dist} ` +
          `from freeKickHex (${freeKickHex.q},${freeKickHex.r}) — expected >= 3`,
      );
    }
  }
}

// freeKickHex used by every freeKickState-based case below: { q: 25, r: 10 }.
// Precomputed distances from it (verified via hexDistance directly, ODD-Q cube conversion):
//   dist 1: {q:24,r:10}, {q:24,r:11}, {q:25,r:9}, {q:25,r:11}, {q:26,r:10}, {q:26,r:11}
//   dist 2: {q:23,r:10}, {q:23,r:9}, {q:23,r:11}, ...
//   dist 3 (legal): {q:22,r:10}

describe('gap item 7 (OFFSIDE-02): defensive wall distance invariant', () => {
  // -------------------------------------------------------------------------
  // B. Entry-point coverage (expected GREEN today — the award-time sweep already works)
  // -------------------------------------------------------------------------

  describe('entry-point coverage (award-time sweep, expected GREEN today)', () => {
    it('case 1: applyFoulChoice("restart") sweeps a fouling-team piece adjacent (distance 1) to foulHex', () => {
      const fouler = makePiece({ id: 'home-1', teamId: 'home', position: { q: 5, r: 5 } });
      const nearbyDefender = makePiece({
        id: 'home-2',
        teamId: 'home',
        position: { q: 19, r: 13 },
      }); // dist 1 from foulHex
      const victim = makePiece({ id: 'away-1', teamId: 'away', position: { q: 10, r: 10 } });
      const state = makeState({
        pieces: [fouler, nearbyDefender, victim],
        phase: 'FOUL_CHOICE',
        attackingTeam: 'away',
        activeTeam: 'away',
        foulDefenderId: 'home-1',
        foulVictimId: 'away-1',
        foulHex: { q: 18, r: 13 },
        foulSource: 'TACKLE',
      });

      const result = applyFoulChoice(state, 'restart');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.phase).toBe('FREE_KICK_SETUP');
      assertWallDistanceHolds(result.state, 'home');
    });

    it('case 2: applyOffsideFoulWithRelocation sweeps the offender (distance 0) and another conceding-team piece (distance 2) from the resulting freeKickHex', () => {
      const offender = makePiece({ id: 'home-1', teamId: 'home', position: { q: 30, r: 12 } });
      const otherConceding = makePiece({
        id: 'home-2',
        teamId: 'home',
        position: { q: 32, r: 12 },
      }); // dist 2 from offender's position
      const kicker = makePiece({ id: 'away-1', teamId: 'away', position: { q: 5, r: 5 } });
      const state = makeState({
        pieces: [offender, otherConceding, kicker],
        phase: 'MOVE',
        activeTeam: 'home',
        attackingTeam: 'home',
        ball: { position: { q: 30, r: 12 }, carrierId: 'home-1', lastTouchedBy: null },
        offsidePieceIds: ['home-1'],
      });

      const afterFoul = applyOffsideFoulWithRelocation(state);
      expect(afterFoul.phase).toBe('FREE_KICK_SETUP');
      expect(afterFoul.freeKickHex).toEqual({ q: 30, r: 12 });
      assertWallDistanceHolds(afterFoul, 'home');
    });
  });

  // -------------------------------------------------------------------------
  // C. Defending-stage-entry coverage (expected RED today)
  // -------------------------------------------------------------------------

  describe('defending-stage-entry coverage (expected RED today)', () => {
    it('case 3: stage 0 -> 1 entry sweep — a home piece at distance 1 is legal by the time defending stage 1 becomes active', () => {
      const kicker = makePiece({ id: 'away-1', teamId: 'away', position: { q: 25, r: 10 } });
      const homeDefender = makePiece({ id: 'home-1', teamId: 'home', position: { q: 24, r: 10 } }); // dist 1
      const state = freeKickState({
        pieces: [kicker, homeDefender],
        freeKickStageIndex: 0,
        movedPieceIds: ['away-1'],
      });

      const result = applyFreeKickReady(state, 'away');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.freeKickStageIndex).toBe(1);
      assertWallDistanceHolds(result.state, 'home');
      // Case 7 (partial): the kicker on freeKickHex must never be relocated by this sweep.
      expect(result.state.pieces.find((p) => p.id === 'away-1')?.position).toEqual({
        q: 25,
        r: 10,
      });
    });

    it('case 4: stage 2 -> 3 entry sweep — a home piece at distance 2 is legal by the time defending stage 3 becomes active', () => {
      const kicker = makePiece({ id: 'away-1', teamId: 'away', position: { q: 25, r: 10 } });
      const homeDefender = makePiece({ id: 'home-1', teamId: 'home', position: { q: 23, r: 10 } }); // dist 2
      const state = freeKickState({
        pieces: [kicker, homeDefender],
        freeKickStageIndex: 2,
        movedPieceIds: ['away-1'],
      });

      const result = applyFreeKickReady(state, 'away');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.freeKickStageIndex).toBe(3);
      assertWallDistanceHolds(result.state, 'home');
    });
  });

  // -------------------------------------------------------------------------
  // D. Defending-stage-end coverage (expected RED today — the reported dead-end)
  // -------------------------------------------------------------------------

  describe('defending-stage-end coverage (expected RED today — the reported dead-end)', () => {
    it('case 5: stage 1 end — a home piece at distance 2 no longer blocks Ready; it is auto-moved instead', () => {
      const kicker = makePiece({ id: 'away-1', teamId: 'away', position: { q: 25, r: 10 } });
      const homeDefender = makePiece({ id: 'home-1', teamId: 'home', position: { q: 23, r: 10 } }); // dist 2
      const state = freeKickState({
        pieces: [kicker, homeDefender],
        freeKickStageIndex: 1,
        movedPieceIds: ['away-1'],
      });

      const result = applyFreeKickReady(state, 'home');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.freeKickStageIndex).toBe(2);
      assertWallDistanceHolds(result.state, 'home');
      // Case 7 (partial): the kicker on freeKickHex must never be relocated by this sweep.
      expect(result.state.pieces.find((p) => p.id === 'away-1')?.position).toEqual({
        q: 25,
        r: 10,
      });
    });

    it('case 6: stage 3 end — a home piece at distance 1 no longer blocks finalization; it is auto-moved before the kick is taken', () => {
      const originalFreeKickHex = { q: 25, r: 10 };
      const kicker = makePiece({ id: 'away-1', teamId: 'away', position: originalFreeKickHex });
      const homeDefender = makePiece({ id: 'home-1', teamId: 'home', position: { q: 24, r: 10 } }); // dist 1
      const state = freeKickState({
        pieces: [kicker, homeDefender],
        freeKickStageIndex: 3,
        movedPieceIds: ['away-1'],
      });

      const result = applyFreeKickReady(state, 'home');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.phase).toBe('PASS');
      expect(result.state.lastActionType).toBe('FREE_KICK_RESTART');
      // freeKickHex is cleared to null on finalize (D-49) — check the relocated defender's
      // final distance against the ORIGINAL freeKickHex captured before the call.
      const relocatedDefender = result.state.pieces.find((p) => p.id === 'home-1')!;
      expect(hexDistance(relocatedDefender.position, originalFreeKickHex)).toBeGreaterThanOrEqual(
        3,
      );
      // Case 7: the kicker is still on the original freeKickHex and becomes ball carrier.
      const finalKicker = result.state.pieces.find((p) => p.id === 'away-1')!;
      expect(finalKicker.position).toEqual(originalFreeKickHex);
      expect(result.state.ball.carrierId).toBe('away-1');
    });
  });

  // -------------------------------------------------------------------------
  // E. Non-regression coverage (must be GREEN before AND after the fix)
  // -------------------------------------------------------------------------

  describe('non-regression coverage (must be GREEN before and after the fix)', () => {
    // Cases 7-9 deliberately exercise the stage 0 -> 1 ENTRY transition (Task 2 part B),
    // not a defending-stage END transition (Task 2 part A / cases 5-6) — ending a KICKING
    // stage (stage 0) never triggered the old too-close-to-freeKickHex rejection regardless of
    // which team is inside the bubble, so this transition already succeeds unmodified
    // (pre-fix: no entry sweep exists yet, pieces are simply left in place; post-fix: the
    // entry sweep introduced by this plan runs and must preserve every invariant below).
    // This is what makes cases 7-9 true non-regression tests — GREEN before AND after.
    it('case 7: the kicker on freeKickHex is never relocated by a defending-stage entry sweep or by finalize', () => {
      // Sub-case A: stage 0 -> 1 entry sweep — the kicker (kicking team) is never the
      // sweep's target team and must be unaffected regardless of whether the sweep exists.
      const kickerA = makePiece({ id: 'away-1', teamId: 'away', position: { q: 25, r: 10 } });
      const legalHomeA = makePiece({ id: 'home-1', teamId: 'home', position: { q: 5, r: 5 } }); // already legal, never trapped
      const stateA = freeKickState({
        pieces: [kickerA, legalHomeA],
        freeKickStageIndex: 0,
        movedPieceIds: ['away-1'],
      });
      const resultA = applyFreeKickReady(stateA, 'away');
      expect(resultA.ok).toBe(true);
      if (!resultA.ok) return;
      expect(resultA.state.freeKickStageIndex).toBe(1);
      expect(resultA.state.pieces.find((p) => p.id === 'away-1')?.position).toEqual({
        q: 25,
        r: 10,
      });

      // Sub-case B: stage 3 end finalize (no trapped piece, so this already succeeds
      // pre-fix) — the kicker must still be found on freeKickHex and become ball.carrierId.
      const kickerB = makePiece({ id: 'away-2', teamId: 'away', position: { q: 25, r: 10 } });
      const legalHomeB = makePiece({ id: 'home-2', teamId: 'home', position: { q: 5, r: 5 } });
      const stateB = freeKickState({
        pieces: [kickerB, legalHomeB],
        freeKickStageIndex: 3,
        movedPieceIds: ['away-2'],
      });
      const resultB = applyFreeKickReady(stateB, 'home');
      expect(resultB.ok).toBe(true);
      if (!resultB.ok) return;
      expect(resultB.state.phase).toBe('PASS');
      expect(resultB.state.ball.carrierId).toBe('away-2');
      expect(resultB.state.pieces.find((p) => p.id === 'away-2')?.position).toEqual({
        q: 25,
        r: 10,
      });
    });

    it('case 8: no two ACTIVE pieces share a hex after a defending-stage-entry sweep relocates multiple trapped pieces', () => {
      const kicker = makePiece({ id: 'away-1', teamId: 'away', position: { q: 25, r: 10 } });
      const homeDefender1 = makePiece({ id: 'home-1', teamId: 'home', position: { q: 23, r: 10 } }); // dist 2
      const homeDefender2 = makePiece({ id: 'home-2', teamId: 'home', position: { q: 24, r: 10 } }); // dist 1
      const state = freeKickState({
        pieces: [kicker, homeDefender1, homeDefender2],
        freeKickStageIndex: 0,
        movedPieceIds: ['away-1'],
      });

      const result = applyFreeKickReady(state, 'away');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.freeKickStageIndex).toBe(1);

      const activePieces = result.state.pieces.filter(isActivePiece);
      const hexKeys = new Set(activePieces.map((p) => `${p.position.q},${p.position.r}`));
      expect(hexKeys.size).toBe(activePieces.length);
    });

    it('case 9: an automatic relocation does not consume placement budget or leak into movedPieceIds beyond what the ending stage itself placed', () => {
      const kicker = makePiece({ id: 'away-1', teamId: 'away', position: { q: 25, r: 10 } });
      const homeDefender = makePiece({ id: 'home-1', teamId: 'home', position: { q: 24, r: 10 } }); // dist 1 — trapped by the entry sweep once Task 2 lands
      const state = freeKickState({
        pieces: [kicker, homeDefender],
        freeKickStageIndex: 0,
        freeKickPlacedPieceIds: [],
        movedPieceIds: ['away-1'],
      });

      const result = applyFreeKickReady(state, 'away');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.freeKickStageIndex).toBe(1);
      expect(result.state.freeKickPlacedPieceIds).toEqual([]);
      // The auto-relocated home-1 id must never leak into movedPieceIds via this
      // transition — only the KICKING team's own stage-0 placements are merged in (D-56),
      // and stage 0 placed nothing extra here.
      expect(result.state.movedPieceIds).toEqual(['away-1']);
    });

    it('case 10: a RED-CARDED defending piece at distance 1 is neither relocated nor treated as blocking (BUG-38 invariant)', () => {
      const kicker = makePiece({ id: 'away-1', teamId: 'away', position: { q: 25, r: 10 } });
      const redCardedDefender = makePiece({
        id: 'home-1',
        teamId: 'home',
        position: { q: 24, r: 10 }, // dist 1 — would be "trapped" if still active
        redCarded: true,
        onPitch: false,
      });
      const legalDefender = makePiece({ id: 'home-2', teamId: 'home', position: { q: 5, r: 5 } }); // well clear
      const state = freeKickState({
        pieces: [kicker, redCardedDefender, legalDefender],
        freeKickStageIndex: 1,
        movedPieceIds: ['away-1'],
      });

      const result = applyFreeKickReady(state, 'home');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.freeKickStageIndex).toBe(2);
      // The red-carded piece's frozen hex must be untouched.
      expect(result.state.pieces.find((p) => p.id === 'home-1')?.position).toEqual({
        q: 24,
        r: 10,
      });
      assertWallDistanceHolds(result.state, 'home');
    });
  });
});
