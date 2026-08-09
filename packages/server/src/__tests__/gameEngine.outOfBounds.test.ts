import { describe, it, expect } from 'vitest';
import {
  applyRoll,
  triggerOutOfBoundsRestart,
  applyFreeMoveZoneCheck,
  applyThrowInPlace,
  applyEndTurn,
  applyMove,
  applyStartMovement,
  computeGoalKickEligibleIds,
  applyGoalKickReposition,
  applyGoalKickWindowEnd,
  applyGoalKickChoice,
  applyGoalKickTarget,
  applyGoalKickMoveEnd,
} from '../gameEngine.js';
import type { GameState, GamePhase, PlayerPiece, HexCoord } from '@counter-attack/shared';
import { isPitchHex, ELIGIBLE_NEXT_ACTIONS, GOAL_KICK_RESTART_HEX } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Test fixtures
//
// Wave 0 coverage for OOB-01/02/04/05 (Plan 37-04). Direction/distance dice
// values below were verified against the real computeLooseBall/isPitchHex
// implementation (packages/shared/src/scoreUtils.ts + pitch.ts) before being
// hardcoded here — see the table in this plan's SUMMARY.md for the full
// from/direction/distance -> clampedPos/exitHex mapping so later plans (37-05+)
// can reuse these exact fixtures instead of re-deriving them.
// ---------------------------------------------------------------------------

const homePiece: PlayerPiece = {
  id: 'home-9',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'FWD',
  number: 10,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 20, r: 10 },
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

const awayPiece: PlayerPiece = {
  id: 'away-9',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'FWD',
  number: 10,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 16, r: 16 },
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

const homeGK: PlayerPiece = {
  id: 'home-gk',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 3, r: 5 },
  pace: 4,
  shooting: 1,
  tackling: 2,
  dribbling: 2,
  saving: 8,
  handling: 8,
  resilience: 6,
  aerialAbility: 5,
  highPass: 0,
};

const awayGK: PlayerPiece = {
  id: 'away-gk',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 33, r: 5 },
  pace: 4,
  shooting: 1,
  tackling: 2,
  dribbling: 2,
  saving: 8,
  handling: 8,
  resilience: 6,
  aerialAbility: 5,
  highPass: 0,
};

/** Minimal LOOSE_BALL-phase fixture, modelled on gameEngine.test.ts's baseMovementState. */
const baseLooseBallState: GameState = {
  roomCode: 'OOB1',
  phase: 'LOOSE_BALL',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homePiece, awayPiece, homeGK, awayGK],
  ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
  score: { home: 0, away: 0 },
  actionCount: 10,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  ballZone: 'middle',
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' },
  selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
  gameSpeed: 'standard',
};

// ---------------------------------------------------------------------------
// OOB-05: toggle-off (and toggle-absent) preservation — the clamp path must
// stay byte-for-byte identical to pre-Phase-37 behaviour.
// ---------------------------------------------------------------------------

describe('applyRoll LOOSE_BALL with outOfBoundsEnabled falsy (OOB-05)', () => {
  it('clamps to the last in-bounds hex and resolves to PASS/DEFLECTION when the toggle is false', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: { position: { q: 18, r: 1 }, carrierId: null, lastTouchedBy: null },
      outOfBoundsEnabled: false,
    };
    // direction=3 (NW, r decreases, q constant), distance=2: step1 {q:18,r:0},
    // step2 {q:18,r:-1}. Both are off-pitch: r=-1 is below the rectangle bound, and
    // (18,0) is an even-q r=0 hex excluded from PITCH_HEXES per Plan 37-14 (gap-closure
    // wave 12 — 0%-visibility hex under the current client clip). The clamp walk never
    // advances past the starting hex, so the ball stays at {q:18,r:1}.
    const result = applyRoll(state, 3, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('DEFLECTION');
    expect(isPitchHex(result.state.ball.position)).toBe(true);
    expect(result.state.ball.position).toEqual({ q: 18, r: 1 });
    const landEvents = result.state.eventLog.filter((e) => e.type === 'LOOSE_BALL_LAND');
    expect(landEvents).toHaveLength(1);
    const oobEvents = result.state.eventLog.filter((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvents).toHaveLength(0);
  });

  it('produces an identical result when outOfBoundsEnabled is undefined (absent means disabled)', () => {
    // baseLooseBallState omits outOfBoundsEnabled entirely — the "absent means disabled"
    // contract (exactOptionalPropertyTypes forbids an explicit `outOfBoundsEnabled: undefined`).
    const state: GameState = {
      ...baseLooseBallState,
      ball: { position: { q: 18, r: 1 }, carrierId: null, lastTouchedBy: null },
    };
    const result = applyRoll(state, 3, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('DEFLECTION');
    // 37-14: (18,0) is excluded from PITCH_HEXES (even-q r=0) — see sibling test above.
    expect(result.state.ball.position).toEqual({ q: 18, r: 1 });
    const landEvents = result.state.eventLog.filter((e) => e.type === 'LOOSE_BALL_LAND');
    expect(landEvents).toHaveLength(1);
    const oobEvents = result.state.eventLog.filter((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Toggle on — sideline exit (OOB-02, THROWIN-01)
// ---------------------------------------------------------------------------

describe('applyRoll LOOSE_BALL with outOfBoundsEnabled true — sideline (OOB-02, THROWIN-01)', () => {
  it('awards a throw-in to the non-touching team on a north-touchline exit', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 18, r: 1 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
      outOfBoundsEnabled: true,
    };
    const result = applyRoll(state, 3, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('THROW_IN_SETUP');
    expect(result.state.throwInTeam).toBe('away');
    expect(result.state.attackingTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.throwInPhasesTaken).toBe(0);
    expect(isPitchHex(result.state.throwInHex!)).toBe(true);
    expect(
      result.state.pieces.some(
        (p) =>
          p.position.q === result.state.throwInHex!.q &&
          p.position.r === result.state.throwInHex!.r,
      ),
    ).toBe(false);
    const oobEvent = result.state.eventLog.find((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvent).toBeDefined();
    if (oobEvent?.type === 'OUT_OF_BOUNDS') {
      expect(oobEvent.kind).toBe('SIDELINE');
      expect(oobEvent.restart).toBe('THROW_IN');
      expect(oobEvent.awardedTo).toBe('away');
    }
  });

  it('awards a throw-in to the non-touching team on a south-touchline exit', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 18, r: 24 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' },
      },
      outOfBoundsEnabled: true,
    };
    // direction=6 (SE, r increases, q constant), distance=2: step1 {q:18,r:25} on-pitch,
    // step2 {q:18,r:26} off-pitch.
    const result = applyRoll(state, 6, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('THROW_IN_SETUP');
    expect(result.state.throwInTeam).toBe('home');
    expect(result.state.attackingTeam).toBe('home');
    expect(result.state.activeTeam).toBe('home');
  });

  it('awards the throw-in against the current attackingTeam when the ball was never touched', () => {
    const state: GameState = {
      ...baseLooseBallState,
      attackingTeam: 'home',
      ball: { position: { q: 18, r: 1 }, carrierId: null, lastTouchedBy: null },
      outOfBoundsEnabled: true,
    };
    const result = applyRoll(state, 3, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('THROW_IN_SETUP');
    expect(result.state.throwInTeam).toBe('away');
  });

  it('relocates the throw-in hex to a free neighbour when the exit hex is occupied', () => {
    const state: GameState = {
      ...baseLooseBallState,
      pieces: [
        { ...homePiece, position: { q: 18, r: 0 } }, // occupies the exit's last in-bounds hex
        awayPiece,
        homeGK,
        awayGK,
      ],
      ball: {
        position: { q: 18, r: 1 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
      outOfBoundsEnabled: true,
    };
    const result = applyRoll(state, 3, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.throwInHex).not.toEqual({ q: 18, r: 0 });
    expect(isPitchHex(result.state.throwInHex!)).toBe(true);
    expect(
      result.state.pieces.some(
        (p) =>
          p.position.q === result.state.throwInHex!.q &&
          p.position.r === result.state.throwInHex!.r,
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Toggle on — byline exit (OOB-04)
// ---------------------------------------------------------------------------

describe('applyRoll LOOSE_BALL with outOfBoundsEnabled true — byline (OOB-04)', () => {
  it('awards a goal kick to home when an away (attacking) touch crosses the home byline', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' },
      },
      outOfBoundsEnabled: true,
    };
    // direction=4 (W, q decreases), distance=2: step1 {q:0,r:14} on-pitch, step2 {q:-1,r:14} off-pitch.
    const result = applyRoll(state, 4, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GOAL_KICK_SETUP_GK');
    expect(result.state.goalKickTeam).toBe('home');
    expect(result.state.goalKickGkId).toBe(homeGK.id);
    expect(result.state.ball.carrierId).toBe(homeGK.id);
    // Plan 37-15: the restart is the fixed GOAL_KICK_RESTART_HEX.home, NOT
    // homeGK's live position ({q:3,r:5}) — this assertion previously read
    // `expect(result.state.ball.position).toEqual(homeGK.position)`, which
    // encoded the defect this plan closes (the ball landed wherever the
    // keeper last happened to stand). Before: passed trivially because the
    // engine wrote gk.position verbatim. After: the keeper is now also
    // moved to the fixed restart hex, so this still holds AND additionally
    // proves the restart hex is the fixed constant, not the drifted fixture
    // position (see the dedicated 'GOAL_KICK_RESTART_HEX placement' block
    // below for the drift-distinguishing assertion).
    expect(result.state.ball.position).toEqual(GOAL_KICK_RESTART_HEX.home);
    const oobEvent = result.state.eventLog.find((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvent).toBeDefined();
    if (oobEvent?.type === 'OUT_OF_BOUNDS') {
      expect(oobEvent.kind).toBe('BYLINE');
      expect(oobEvent.restart).toBe('GOAL_KICK');
      expect(oobEvent.awardedTo).toBe('home');
    }
  });

  it('awards a goal kick to away on an untouched off-target shot crossing the away byline', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: { position: { q: 35, r: 13 }, carrierId: null, lastTouchedBy: null },
      outOfBoundsEnabled: true,
    };
    // direction=1 (E, q increases), distance=2: step1 {q:36,r:14} on-pitch, step2 {q:37,r:14} off-pitch.
    const result = applyRoll(state, 1, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GOAL_KICK_SETUP_GK');
    expect(result.state.goalKickTeam).toBe('away');
    expect(result.state.goalKickGkId).toBe(awayGK.id);
    expect(result.state.ball.carrierId).toBe(awayGK.id);
  });
});

// ---------------------------------------------------------------------------
// GOAL_KICK_RESTART_HEX placement (Plan 37-15, closes 37-UAT.md Test 7 MAJOR)
//
// triggerOutOfBoundsRestart's GOAL_KICK branch places both the ball and the
// goalkeeper at the fixed GOAL_KICK_RESTART_HEX for the awarded team, never
// at the keeper's live (possibly drifted) position. lastInBoundsHex is
// unused by the GOAL_KICK branch (only THROW_IN reads it), so an arbitrary
// on-pitch placeholder is used below.
// ---------------------------------------------------------------------------

describe('triggerOutOfBoundsRestart GOAL_KICK placement (Plan 37-15)', () => {
  it('places ball.position at GOAL_KICK_RESTART_HEX.away and moves the away GK there for an away-byline exit awarding away', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 35, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: 37, r: 13 }, { q: 36, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.goalKickTeam).toBe('away');
    expect(result!.ball.position).toEqual(GOAL_KICK_RESTART_HEX.away);
    const movedGk = result!.pieces.find((p) => p.id === awayGK.id)!;
    expect(movedGk.position).toEqual(GOAL_KICK_RESTART_HEX.away);
  });

  it('places ball.position at GOAL_KICK_RESTART_HEX.home and moves the home GK there for a home-byline exit awarding home (mirror case)', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.goalKickTeam).toBe('home');
    expect(result!.ball.position).toEqual(GOAL_KICK_RESTART_HEX.home);
    const movedGk = result!.pieces.find((p) => p.id === homeGK.id)!;
    expect(movedGk.position).toEqual(GOAL_KICK_RESTART_HEX.home);
  });

  it('returns a keeper that had drifted far from goal (homeGK fixture at {q:3,r:5}) to GOAL_KICK_RESTART_HEX.home — asserted against the constant, never the fixture position', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' },
      },
    };
    expect(homeGK.position).not.toEqual(GOAL_KICK_RESTART_HEX.home); // sanity: fixture IS drifted
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    const movedGk = result!.pieces.find((p) => p.id === homeGK.id)!;
    expect(movedGk.position).toEqual(GOAL_KICK_RESTART_HEX.home);
    expect(movedGk.position).not.toEqual(homeGK.position);
  });

  it('ball.carrierId is the goalkeeper id and the goalkeeper position equals ball.position — carrier and ball never separated', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    expect(result!.ball.carrierId).toBe(homeGK.id);
    const carrierPiece = result!.pieces.find((p) => p.id === result!.ball.carrierId)!;
    expect(carrierPiece.position).toEqual(result!.ball.position);
  });

  it("the appended OUT_OF_BOUNDS event's ballAfter.position equals the resolved restart hex, not the keeper's prior position", () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    const oobEvent = result!.eventLog.find((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvent?.type).toBe('OUT_OF_BOUNDS');
    if (oobEvent?.type === 'OUT_OF_BOUNDS') {
      expect(oobEvent.ballAfter).toEqual({
        position: GOAL_KICK_RESTART_HEX.home,
        carrierId: homeGK.id,
      });
    }
  });

  it('places the keeper on a different on-pitch hex when an outfield piece is parked exactly on the restart hex — no two pieces share a coordinate, ball.position matches the keeper', () => {
    const state: GameState = {
      ...baseLooseBallState,
      pieces: baseLooseBallState.pieces.map((p) =>
        p.id === homePiece.id ? { ...p, position: GOAL_KICK_RESTART_HEX.home } : p,
      ),
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    const movedGk = result!.pieces.find((p) => p.id === homeGK.id)!;
    expect(movedGk.position).not.toEqual(GOAL_KICK_RESTART_HEX.home);
    expect(isPitchHex(movedGk.position)).toBe(true);
    // No two pieces share a coordinate.
    const occupied = result!.pieces.map((p) => `${p.position.q},${p.position.r}`);
    expect(new Set(occupied).size).toBe(occupied.length);
    expect(result!.ball.position).toEqual(movedGk.position);
  });

  it('computes goalKickEligibleIds from the POST-placement piece list: a keeper outside its own final third pre-move whose restart hex is inside it appears in gkTeam', () => {
    const state: GameState = {
      ...baseLooseBallState,
      pieces: baseLooseBallState.pieces.map(
        (p) => (p.id === homeGK.id ? { ...p, position: { q: 15, r: 13 } } : p), // middleThird: NOT eligible pre-move
      ),
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' },
      },
    };
    const result = triggerOutOfBoundsRestart(state, { q: -1, r: 13 }, { q: 0, r: 13 });
    expect(result).not.toBeNull();
    // GOAL_KICK_RESTART_HEX.home (q:2) is in homeThird (q<=10) — eligible post-placement.
    expect(result!.goalKickEligibleIds?.gkTeam).toContain(homeGK.id);
  });
});

// ---------------------------------------------------------------------------
// OOB-03 / Phase 38: a defending touch at the byline now awards a corner kick
// instead of falling back to the clamp/DEFLECTION path (superseded by Plan
// 38-02 — this scenario moved from a "stays in play" assertion to a
// CORNER_KICK award assertion per this describe block's own prior comment).
// Full Corner Kick trigger-branch coverage lives in gameEngine.cornerKick.test.ts;
// this test only guards the applyRoll → triggerOutOfBoundsRestart wiring.
// ---------------------------------------------------------------------------

describe('byline exit after a defending touch awards a corner kick (OOB-03, Phase 38)', () => {
  it('routes to CORNER_KICK_GK_SETUP_ATTACKING (gap-closure round 3, 38-25: the clear-out is now automatic), awarded to the opposite team from the byline owner', () => {
    const state: GameState = {
      ...baseLooseBallState,
      ball: {
        position: { q: 1, r: 13 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' }, // home is the byline owner at q<0
      },
      outOfBoundsEnabled: true,
    };
    const result = applyRoll(state, 4, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // CORNER-01 (gap-closure round 3, 38-25): the clear-out is automatic — a corner opens
    // directly on the attacking goalkeeper reposition window, no intermediate phase.
    expect(result.state.phase).toBe('CORNER_KICK_GK_SETUP_ATTACKING');
    expect(result.state.cornerKickTeam).toBe('away'); // inverted from byline owner 'home'
    expect(result.state.attackingTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
    const oobEvents = result.state.eventLog.filter((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvents).toHaveLength(1);
    expect(oobEvents[0]).toMatchObject({ restart: 'CORNER_KICK', awardedTo: 'away' });
  });
});

// ---------------------------------------------------------------------------
// triggerOutOfBoundsRestart — sequence bookkeeping reset (Task 1 must_haves)
// ---------------------------------------------------------------------------

describe('triggerOutOfBoundsRestart resets sequence bookkeeping', () => {
  it('clears movement/dice/shot-path bookkeeping on every restart it produces', () => {
    const state: GameState = {
      ...baseLooseBallState,
      phase: 'MOVE',
      ball: {
        position: { q: 18, r: 1 },
        carrierId: null,
        lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
      },
      movedPieceIds: [homePiece.id],
      paceUsedByPieceId: { [homePiece.id]: 2 },
      movementSlot: 'ATTACKER_4',
      stealAttemptedByIds: [homePiece.id],
      tackleAttemptedByIds: [awayPiece.id],
      lastShotPath: [{ q: 1, r: 1 }],
      lastActionType: 'DEFLECTION',
    };
    const result = triggerOutOfBoundsRestart(state, { q: 18, r: -1 }, { q: 18, r: 0 });
    expect(result).not.toBeNull();
    expect(result!.movementSlot).toBeNull();
    expect(result!.movedPieceIds).toEqual([]);
    expect(result!.paceUsedByPieceId).toEqual({});
    expect(result!.stealAttemptedByIds).toEqual([]);
    expect(result!.tackleAttemptedByIds).toEqual([]);
    expect(result!.lastShotPath).toBeNull();
    expect(result!.lastActionType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyFreeMoveZoneCheck must never hijack a Phase-37 restart phase (T-37-15)
// ---------------------------------------------------------------------------

describe('applyFreeMoveZoneCheck does not hijack restart phases', () => {
  /** Shared assertion body for every exempt phase below — kept as a helper (not a loop
   *  generating `it(` calls) so each phase has its own literal, greppable test case. */
  const assertPhaseUnchanged = (phase: GamePhase): void => {
    const state: GameState = {
      ...baseLooseBallState,
      phase,
      ball: { position: { q: 5, r: 13 }, carrierId: null, lastTouchedBy: null }, // homeThird
      ballZone: 'away', // mismatched — would trigger the interrupt on a non-exempt phase
    };
    const result = applyFreeMoveZoneCheck(state);
    expect(result.phase).toBe(phase);
    expect(result.freeMoveResume ?? null).toBeNull();
  };

  it('leaves THROW_IN_SETUP unchanged even when the ball sits in a mismatched final third', () => {
    assertPhaseUnchanged('THROW_IN_SETUP');
  });

  it('leaves GOAL_KICK_SETUP_GK unchanged even when the ball sits in a mismatched final third', () => {
    assertPhaseUnchanged('GOAL_KICK_SETUP_GK');
  });

  it('leaves GOAL_KICK_SETUP_OPPONENT unchanged even when the ball sits in a mismatched final third', () => {
    assertPhaseUnchanged('GOAL_KICK_SETUP_OPPONENT');
  });

  it('leaves GOAL_KICK_CHOICE unchanged even when the ball sits in a mismatched final third', () => {
    assertPhaseUnchanged('GOAL_KICK_CHOICE');
  });

  it('leaves GOAL_KICK_TARGET unchanged even when the ball sits in a mismatched final third', () => {
    assertPhaseUnchanged('GOAL_KICK_TARGET');
  });

  it('leaves GOAL_KICK_MOVE unchanged even when the ball sits in a mismatched final third', () => {
    assertPhaseUnchanged('GOAL_KICK_MOVE');
  });
});

// ---------------------------------------------------------------------------
// applyThrowInPlace (Plan 37-05 Task 1) — THROWIN-02: place the thrower + ball
// at the throw-in hex and start a real Movement Phase 1.
// ---------------------------------------------------------------------------

/** THROW_IN_SETUP fixture: home is throwing in at {q:18,r:0}. */
const throwInSetupState: GameState = {
  ...baseLooseBallState,
  phase: 'THROW_IN_SETUP',
  attackingTeam: 'away', // deliberately stale pre-placement value; placement must overwrite it
  activeTeam: 'away',
  throwInHex: { q: 18, r: 0 },
  throwInTeam: 'home',
  throwInPhasesTaken: 0,
  ball: {
    position: { q: 18, r: 0 },
    carrierId: null,
    lastTouchedBy: { pieceId: 'away-9', teamId: 'away' },
  },
};

describe('applyThrowInPlace', () => {
  it('rejects when phase is not THROW_IN_SETUP', () => {
    const state: GameState = { ...throwInSetupState, phase: 'PASS' };
    const result = applyThrowInPlace(state, homePiece.id);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects an unknown pieceId', () => {
    const result = applyThrowInPlace(throwInSetupState, 'nonexistent-piece');
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('rejects a piece belonging to the other team', () => {
    const result = applyThrowInPlace(throwInSetupState, awayPiece.id);
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('rejects when throwInHex is null', () => {
    const state: GameState = { ...throwInSetupState, throwInHex: null };
    const result = applyThrowInPlace(state, homePiece.id);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects when throwInTeam is null', () => {
    const state: GameState = { ...throwInSetupState, throwInTeam: null };
    const result = applyThrowInPlace(state, homePiece.id);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('places the thrower with the ball at the throw-in hex and starts Movement Phase 1', () => {
    const result = applyThrowInPlace(throwInSetupState, homePiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('MOVE');
    expect(result.state.movementSlot).toBe('ATTACKER_4');

    const placedPiece = result.state.pieces.find((p) => p.id === homePiece.id);
    expect(placedPiece?.position).toEqual({ q: 18, r: 0 });

    expect(result.state.ball.position).toEqual({ q: 18, r: 0 });
    expect(result.state.ball.carrierId).toBe(homePiece.id);
    expect(result.state.ball.lastTouchedBy).toEqual({ pieceId: homePiece.id, teamId: 'home' });
  });

  it('preserves throwInHex/throwInTeam and resets throwInPhasesTaken to 0', () => {
    const result = applyThrowInPlace(throwInSetupState, homePiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.throwInHex).toEqual({ q: 18, r: 0 });
    expect(result.state.throwInTeam).toBe('home');
    expect(result.state.throwInPhasesTaken).toBe(0);
  });

  it('sets activeTeam/attackingTeam to throwInTeam and resets Movement Phase bookkeeping', () => {
    const result = applyThrowInPlace(throwInSetupState, homePiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.attackingTeam).toBe('home');
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.movedPieceIds).toEqual([]);
    expect(result.state.paceUsedByPieceId).toEqual({});
    expect(result.state.lastDiceRoll).toBeNull();
    expect(result.state.lastActionType).toBeNull();
  });

  it('appends exactly one THROW_IN_PLACE event with the correct from/to/ballAfter', () => {
    const result = applyThrowInPlace(throwInSetupState, homePiece.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const events = result.state.eventLog.filter((e) => e.type === 'THROW_IN_PLACE');
    expect(events).toHaveLength(1);
    const event = events[0];
    if (event?.type !== 'THROW_IN_PLACE') throw new Error('expected THROW_IN_PLACE event');
    expect(event.pieceId).toBe(homePiece.id);
    expect(event.from).toEqual(homePiece.position);
    expect(event.to).toEqual({ q: 18, r: 0 });
    expect(event.ballAfter).toEqual({ position: { q: 18, r: 0 }, carrierId: homePiece.id });
  });
});

// ---------------------------------------------------------------------------
// applyEndTurn throw-in movement counting (Plan 37-05 Task 2) — THROWIN-03/D-09
// ---------------------------------------------------------------------------

/** MOVE-phase fixture at the end of a Movement Phase during a throw-in sequence. */
const throwInMoveEndState: GameState = {
  ...baseLooseBallState,
  phase: 'MOVE',
  movementSlot: 'ATTACKER_2',
  attackingTeam: 'home',
  activeTeam: 'home',
  throwInHex: { q: 18, r: 0 },
  throwInTeam: 'home',
  throwInPhasesTaken: 0,
  ball: {
    position: { q: 18, r: 0 },
    carrierId: homePiece.id,
    lastTouchedBy: { pieceId: homePiece.id, teamId: 'home' },
  },
};

describe('applyEndTurn throw-in movement counting', () => {
  it('sets THROW_IN_MOVEMENT_1 and increments throwInPhasesTaken from 0 to 1', () => {
    const result = applyEndTurn(throwInMoveEndState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('THROW_IN_MOVEMENT_1');
    expect(result.state.throwInPhasesTaken).toBe(1);
  });

  it('sets THROW_IN_MOVEMENT_2 and increments throwInPhasesTaken from 1 to 2', () => {
    const state: GameState = { ...throwInMoveEndState, throwInPhasesTaken: 1 };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('THROW_IN_MOVEMENT_2');
    expect(result.state.throwInPhasesTaken).toBe(2);
  });

  it('THROW_IN_MOVEMENT_1 permits a further MOVEMENT action; THROW_IN_MOVEMENT_2 does not', () => {
    expect(ELIGIBLE_NEXT_ACTIONS.THROW_IN_MOVEMENT_1.has('MOVEMENT')).toBe(true);
    expect(ELIGIBLE_NEXT_ACTIONS.THROW_IN_MOVEMENT_2.has('MOVEMENT')).toBe(false);
  });

  it('does not fire a third time when throwInPhasesTaken is already 2 — generic branch runs and clears fields', () => {
    const state: GameState = { ...throwInMoveEndState, throwInPhasesTaken: 2 };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.lastActionType).toBe('MOVEMENT_PHASE');
    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
  });

  it('does not fire when the carrier belongs to the opposing team (ball was stolen) — fields cleared', () => {
    const state: GameState = {
      ...throwInMoveEndState,
      ball: {
        position: awayPiece.position,
        carrierId: awayPiece.id,
        lastTouchedBy: { pieceId: awayPiece.id, teamId: 'away' },
      },
    };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.lastActionType).toBe('MOVEMENT_PHASE');
    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
  });

  it('does not fire when ball.carrierId is null at end of movement — fields cleared', () => {
    const state: GameState = {
      ...throwInMoveEndState,
      ball: { position: throwInMoveEndState.ball.position, carrierId: null, lastTouchedBy: null },
    };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.lastActionType).toBe('MOVEMENT_PHASE');
    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
  });

  it('the half-end branch still takes precedence over the throw-in branch', () => {
    const state: GameState = {
      ...throwInMoveEndState,
      actionCount: 44, // + GAME_SPEED_MINUTES('standard')=2 -> 46 >= 45 half length
      addedTime: 0, // already set for this half (guard `=== null` skips re-roll); halfEnd = 45 + 0 = 45 <= 46 -> HALF_TIME
    };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('HALF_TIME');
    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
  });

  it('the GK-carrier-in-own-penalty-area branch still takes precedence over the throw-in branch', () => {
    const state: GameState = {
      ...throwInMoveEndState,
      ball: {
        position: { q: 3, r: 5 }, // homeGK's position, inside home's own penalty area
        carrierId: homeGK.id,
        lastTouchedBy: { pieceId: homeGK.id, teamId: 'home' },
      },
    };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('GK_RESTART');
    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
  });

  it('intermediate slot transitions (ATTACKER_4->DEFENDER_5) leave throwInPhasesTaken unchanged', () => {
    const state: GameState = { ...throwInMoveEndState, movementSlot: 'ATTACKER_4' };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.movementSlot).toBe('DEFENDER_5');
    expect(result.state.throwInPhasesTaken).toBe(0);
  });

  it('intermediate slot transitions (DEFENDER_5->ATTACKER_2) leave throwInPhasesTaken unchanged', () => {
    const state: GameState = { ...throwInMoveEndState, movementSlot: 'DEFENDER_5' };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.movementSlot).toBe('ATTACKER_2');
    expect(result.state.throwInPhasesTaken).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CR-01 throw-in teardown on break-in-play early returns (Plan 37-11 Task 1)
// THROWIN-03/CR-01: a tackle, steal or defending-team loose-ball pickup that
// ends a throw-in Movement Phase early must not leave throwInHex/throwInTeam/
// throwInPhasesTaken behind on state, and applyEndTurn's re-entry guard must
// not fire on a Movement Phase whose lastActionType is a turnover marker even
// if the three fields were somehow left stale.
// ---------------------------------------------------------------------------

/** Verified duel dice from gameEngine.test.ts: defCombined 11 >= carCombined 9 -> SUCCESS. */
const CR01_DUEL_DICE = { stealDie: 3, tackleDie: 6, carrierDie: 1 };

describe('CR-01 throw-in teardown on break-in-play early returns', () => {
  it('tackle success clears throwInHex/throwInTeam/throwInPhasesTaken', () => {
    const carrier: PlayerPiece = {
      ...homePiece,
      id: 'home-carrier',
      position: { q: 10, r: 7 },
      dribbling: 8,
    };
    const defender: PlayerPiece = {
      ...awayPiece,
      id: 'away-defender',
      position: { q: 12, r: 7 },
      tackling: 5,
    };
    const state: GameState = {
      ...baseLooseBallState,
      phase: 'MOVE',
      movementSlot: 'DEFENDER_5',
      pieces: [carrier, defender],
      attackingTeam: 'home',
      activeTeam: 'away',
      throwInHex: { q: 10, r: 7 },
      throwInTeam: 'home',
      throwInPhasesTaken: 0,
      ball: { position: { q: 10, r: 7 }, carrierId: carrier.id, lastTouchedBy: null },
    };
    const result = applyMove(state, defender.id, { q: 11, r: 7 }, CR01_DUEL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
    expect(result.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    expect(result.state.attackingTeam).toBe('away');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.phase).toBe('PASS');
  });

  it('steal success clears throwInHex/throwInTeam/throwInPhasesTaken', () => {
    const carrier: PlayerPiece = {
      ...homePiece,
      id: 'home-carrier2',
      position: { q: 10, r: 7 },
      dribbling: 8,
    };
    // tackling:8 + stealDie:3 = 11 >= 10 -> SUCCESS (D-06 threshold)
    const defender: PlayerPiece = {
      ...awayPiece,
      id: 'away-steal-defender',
      position: { q: 12, r: 7 },
      tackling: 8,
    };
    const state: GameState = {
      ...baseLooseBallState,
      phase: 'MOVE',
      movementSlot: 'ATTACKER_4',
      pieces: [carrier, defender],
      attackingTeam: 'home',
      activeTeam: 'home',
      throwInHex: { q: 10, r: 7 },
      throwInTeam: 'home',
      throwInPhasesTaken: 0,
      ball: { position: { q: 10, r: 7 }, carrierId: carrier.id, lastTouchedBy: null },
    };
    // carrier moves adjacent to defender -> STEAL_ATTEMPT (carrier is the mover, D-03/MOVE-04)
    const result = applyMove(state, carrier.id, { q: 11, r: 7 }, CR01_DUEL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
    expect(result.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    expect(result.state.ball.carrierId).toBe(defender.id);
  });

  it('defending-team loose-ball pickup clears throwInHex/throwInTeam/throwInPhasesTaken', () => {
    const awayPicker: PlayerPiece = { ...awayPiece, id: 'away-picker', position: { q: 9, r: 8 } };
    const state: GameState = {
      ...baseLooseBallState,
      phase: 'MOVE',
      movementSlot: 'DEFENDER_5',
      pieces: [homePiece, awayPicker],
      attackingTeam: 'home',
      activeTeam: 'away',
      throwInHex: { q: 10, r: 7 },
      throwInTeam: 'home',
      throwInPhasesTaken: 0,
      ball: { position: { q: 9, r: 7 }, carrierId: null, lastTouchedBy: null },
    };
    const result = applyMove(state, awayPicker.id, { q: 9, r: 7 }, CR01_DUEL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
    expect(result.state.lastActionType).toBe('DEFLECTION');
    expect(result.state.phase).toBe('PASS');
  });

  it('tackle FAIL does not clear the fields — the throw-in Movement Phase survives', () => {
    const carrier: PlayerPiece = {
      ...homePiece,
      id: 'home-carrier3',
      position: { q: 10, r: 7 },
      dribbling: 8,
    };
    const defender: PlayerPiece = {
      ...awayPiece,
      id: 'away-defender-fail',
      position: { q: 12, r: 7 },
      tackling: 5,
    };
    const state: GameState = {
      ...baseLooseBallState,
      phase: 'MOVE',
      movementSlot: 'DEFENDER_5',
      pieces: [carrier, defender],
      attackingTeam: 'home',
      activeTeam: 'away',
      throwInHex: { q: 10, r: 7 },
      throwInTeam: 'home',
      throwInPhasesTaken: 0,
      ball: { position: { q: 10, r: 7 }, carrierId: carrier.id, lastTouchedBy: null },
    };
    // defCombined = 5+1=6; carCombined = 8+6=14; 6<14 -> FAIL
    const result = applyMove(
      state,
      defender.id,
      { q: 11, r: 7 },
      { stealDie: 3, tackleDie: 1, carrierDie: 6 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.throwInHex).toEqual({ q: 10, r: 7 });
    expect(result.state.throwInTeam).toBe('home');
    expect(result.state.throwInPhasesTaken).toBe(0);
  });

  it('a normal (non-contest) move does not clear the fields', () => {
    const state: GameState = {
      ...baseLooseBallState,
      phase: 'MOVE',
      movementSlot: 'ATTACKER_4',
      pieces: [homePiece, awayPiece],
      attackingTeam: 'home',
      activeTeam: 'home',
      throwInHex: { q: 10, r: 7 },
      throwInTeam: 'home',
      throwInPhasesTaken: 0,
      ball: { position: homePiece.position, carrierId: homePiece.id, lastTouchedBy: null },
    };
    // homePiece at {q:20,r:10} -> {q:21,r:10}, far from awayPiece {q:16,r:16} -> no contest
    const result = applyMove(state, homePiece.id, { q: 21, r: 10 }, CR01_DUEL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.throwInHex).toEqual({ q: 10, r: 7 });
    expect(result.state.throwInTeam).toBe('home');
    expect(result.state.throwInPhasesTaken).toBe(0);
  });

  it('same-team loose-ball pickup mid-Movement-Phase does not clear the fields (stays in MOVE)', () => {
    const homePicker: PlayerPiece = { ...homePiece, id: 'home-picker', position: { q: 9, r: 8 } };
    const state: GameState = {
      ...baseLooseBallState,
      phase: 'MOVE',
      movementSlot: 'ATTACKER_4',
      pieces: [homePicker, awayPiece],
      attackingTeam: 'home',
      activeTeam: 'home',
      throwInHex: { q: 10, r: 7 },
      throwInTeam: 'home',
      throwInPhasesTaken: 0,
      ball: { position: { q: 9, r: 7 }, carrierId: null, lastTouchedBy: null },
    };
    const result = applyMove(state, homePicker.id, { q: 9, r: 7 }, CR01_DUEL_DICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('MOVE');
    expect(result.state.throwInHex).toEqual({ q: 10, r: 7 });
    expect(result.state.throwInTeam).toBe('home');
    expect(result.state.throwInPhasesTaken).toBe(0);
  });

  it("applyEndTurn's throw-in branch does not fire when lastActionType is a stale SUCCESSFUL_TACKLE marker", () => {
    const state: GameState = { ...throwInMoveEndState, lastActionType: 'SUCCESSFUL_TACKLE' };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.lastActionType).toBe('MOVEMENT_PHASE');
    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
    expect(ELIGIBLE_NEXT_ACTIONS[result.state.lastActionType!].has('SHOT')).toBe(true);
  });

  it("applyEndTurn's throw-in branch does not fire when lastActionType is a stale DEFLECTION marker", () => {
    const state: GameState = { ...throwInMoveEndState, lastActionType: 'DEFLECTION' };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.lastActionType).toBe('MOVEMENT_PHASE');
    expect(result.state.throwInHex).toBeNull();
    expect(result.state.throwInTeam).toBeNull();
    expect(result.state.throwInPhasesTaken).toBeNull();
    expect(ELIGIBLE_NEXT_ACTIONS[result.state.lastActionType!].has('SHOT')).toBe(true);
  });

  it('a genuine throw-in Movement Phase 1 (lastActionType null) still yields THROW_IN_MOVEMENT_1', () => {
    const result = applyEndTurn(throwInMoveEndState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.lastActionType).toBe('THROW_IN_MOVEMENT_1');
    expect(result.state.throwInPhasesTaken).toBe(1);
  });

  it('a genuine throw-in Movement Phase 2 (lastActionType THROW_IN_MOVEMENT_1) still yields THROW_IN_MOVEMENT_2', () => {
    const state: GameState = {
      ...throwInMoveEndState,
      throwInPhasesTaken: 1,
      lastActionType: 'THROW_IN_MOVEMENT_1',
    };
    const result = applyEndTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.lastActionType).toBe('THROW_IN_MOVEMENT_2');
    expect(result.state.throwInPhasesTaken).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// CR-01 regression: interrupted throw-in cannot corrupt a later Movement Phase
// (Plan 37-11 Task 2) — the executable form of the five-step reachable
// sequence documented in 37-REVIEW.md. {q:10,r:7} below is an ordinary
// mid-pitch hex chosen for the tackle geometry, not a real sideline exit hex
// — this test seeds the awarded throw-in directly (via THROW_IN_SETUP) since
// the exit-classification path already has dedicated coverage earlier in
// this file; what is under test here is the field teardown.
// ---------------------------------------------------------------------------

describe('CR-01 regression: interrupted throw-in cannot corrupt a later Movement Phase', () => {
  it('a throw-in interrupted twice by tackles still ends a later clean Movement Phase as MOVEMENT_PHASE, not THROW_IN_MOVEMENT_1', () => {
    const thrower: PlayerPiece = { ...homePiece, id: 'home-thrower', position: { q: 8, r: 7 } };
    const homeTackler: PlayerPiece = {
      ...homePiece,
      id: 'home-tackler',
      position: { q: 13, r: 7 },
      tackling: 5,
      pace: 9,
    };
    const awayTackler: PlayerPiece = {
      ...awayPiece,
      id: 'away-tackler',
      position: { q: 12, r: 7 },
      tackling: 5,
      dribbling: 8,
      pace: 9,
    };
    // Verified duel dice from gameEngine.test.ts: defCombined 11 >= carCombined 9 -> SUCCESS,
    // for both tacklers (tackling:5, dribbling:8) below.
    const dice = { stealDie: 3, tackleDie: 6, carrierDie: 1 };

    const seed: GameState = {
      ...baseLooseBallState,
      phase: 'THROW_IN_SETUP',
      pieces: [thrower, homeTackler, awayTackler, homeGK, awayGK],
      attackingTeam: 'home',
      activeTeam: 'home',
      outOfBoundsEnabled: true,
      throwInHex: { q: 10, r: 7 },
      throwInTeam: 'home',
      throwInPhasesTaken: 0,
      ball: {
        position: { q: 10, r: 7 },
        carrierId: null,
        lastTouchedBy: { pieceId: awayTackler.id, teamId: 'away' },
      },
    };

    // Step 1: place the thrower — starts a real Movement Phase 1.
    const s1 = applyThrowInPlace(seed, thrower.id);
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;
    expect(s1.state.movementSlot).toBe('ATTACKER_4');
    expect(s1.state.lastActionType).toBeNull();
    expect(s1.state.pieces.find((p) => p.id === thrower.id)?.position).toEqual({ q: 10, r: 7 });

    // Step 2: ATTACKER_4 -> DEFENDER_5 (intermediate) — must not count a phase.
    const s2 = applyEndTurn(s1.state);
    expect(s2.ok).toBe(true);
    if (!s2.ok) return;
    expect(s2.state.movementSlot).toBe('DEFENDER_5');
    expect(s2.state.activeTeam).toBe('away');
    expect(s2.state.throwInPhasesTaken).toBe(0);

    // Step 3: away tackles successfully during DEFENDER_5 — the primary assertion
    // (fails before Task 1's teardown fix).
    const s3 = applyMove(s2.state, awayTackler.id, { q: 11, r: 7 }, dice);
    expect(s3.ok).toBe(true);
    if (!s3.ok) return;
    expect(s3.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    expect(s3.state.attackingTeam).toBe('away');
    expect(s3.state.throwInHex).toBeNull();
    expect(s3.state.throwInTeam).toBeNull();
    expect(s3.state.throwInPhasesTaken).toBeNull();

    // Step 4: away takes a Movement Phase, then home tackles the ball back.
    const s4 = applyStartMovement(s3.state);
    expect(s4.ok).toBe(true);
    if (!s4.ok) return;
    const s4b = applyEndTurn(s4.state);
    expect(s4b.ok).toBe(true);
    if (!s4b.ok) return;
    expect(s4b.state.movementSlot).toBe('DEFENDER_5');
    expect(s4b.state.activeTeam).toBe('home');

    const s5 = applyMove(s4b.state, homeTackler.id, { q: 12, r: 7 }, dice);
    expect(s5.ok).toBe(true);
    if (!s5.ok) return;
    expect(s5.state.attackingTeam).toBe('home');
    expect(s5.state.lastActionType).toBe('SUCCESSFUL_TACKLE');
    expect(s5.state.throwInHex).toBeNull();
    expect(s5.state.throwInTeam).toBeNull();
    expect(s5.state.throwInPhasesTaken).toBeNull();

    // Step 5: home takes a Movement Phase and completes it cleanly.
    const s6 = applyStartMovement(s5.state);
    expect(s6.ok).toBe(true);
    if (!s6.ok) return;
    const s6b = applyEndTurn(s6.state); // ATTACKER_4 -> DEFENDER_5
    expect(s6b.ok).toBe(true);
    if (!s6b.ok) return;
    const s6c = applyEndTurn(s6b.state); // DEFENDER_5 -> ATTACKER_2
    expect(s6c.ok).toBe(true);
    if (!s6c.ok) return;
    const final = applyEndTurn(s6c.state); // ATTACKER_2 -> PASS
    expect(final.ok).toBe(true);
    if (!final.ok) return;

    expect(final.state.phase).toBe('PASS');
    expect(final.state.lastActionType).toBe('MOVEMENT_PHASE');
    expect(final.state.lastActionType).not.toBe('THROW_IN_MOVEMENT_1');
    expect(final.state.throwInHex).toBeNull();
    expect(final.state.throwInTeam).toBeNull();
    expect(final.state.throwInPhasesTaken).toBeNull();
    expect(ELIGIBLE_NEXT_ACTIONS[final.state.lastActionType!].has('SHOT')).toBe(true);
    expect(ELIGIBLE_NEXT_ACTIONS[final.state.lastActionType!].has('SNAPSHOT')).toBe(true);
    expect(ELIGIBLE_NEXT_ACTIONS[final.state.lastActionType!].has('LONG_BALL')).toBe(true);

    // Clock sanity: two tackle-turnovers + one full Movement Phase end = 3 clock
    // increments at GAME_SPEED_MINUTES['standard']=2 each -> 10 + 6 = 16.
    expect(final.state.actionCount).toBe(16);
    expect(final.state.phase).not.toBe('HALF_TIME');
  });
});

// ---------------------------------------------------------------------------
// computeGoalKickEligibleIds / applyGoalKickReposition (Plan 37-08 Task 1)
// GOALKICK-02: both final-thirds' players may reposition, GK's team first.
// ---------------------------------------------------------------------------

/** Home piece standing in the homeThird (q<=10) — eligible for the gkTeam list when goalKickTeam='home'. */
const homeMidThird: PlayerPiece = { ...homePiece, id: 'home-mid', position: { q: 8, r: 10 } };
/** Home piece standing in the awayThird (q>=26) — still eligible for home's gkTeam list per the
 * literal "either final third" reading (D-01 of 37-08-PLAN.md), not RESEARCH.md's narrower reading. */
const homeFwdAwayThird: PlayerPiece = { ...homePiece, id: 'home-fwd', position: { q: 30, r: 10 } };
/** Away piece standing in the homeThird — eligible for the opponent list when goalKickTeam='home'. */
const awayMidHomeThird: PlayerPiece = { ...awayPiece, id: 'away-mid', position: { q: 5, r: 16 } };
/** Away piece standing in the awayThird — eligible for the opponent list when goalKickTeam='home'. */
const awayFwdAwayThird: PlayerPiece = { ...awayPiece, id: 'away-fwd', position: { q: 28, r: 16 } };

// GOALKICK-02 (37-13) boundary fixtures — each one hex-click away from an off-grid
// coordinate under ODD-Q parity (see hexNeighbors in packages/shared/src/hex.ts).
/** Left byline column (q=0), inside homeThird; even-q neighbours include {q:-1,r:5}. */
const homeGoalLineEdge: PlayerPiece = {
  ...homePiece,
  id: 'home-edge-left',
  position: { q: 0, r: 5 },
};
/** Right byline column (q=36), inside awayThird (broad-reading eligibility); even-q neighbours include {q:37,r:20}. */
const homeFarEdge: PlayerPiece = {
  ...homePiece,
  id: 'home-edge-right',
  position: { q: 36, r: 20 },
};
/** Top sideline row (r=0), inside homeThird; odd-q neighbours include {q:5,r:-1}. */
const homeTopEdge: PlayerPiece = { ...homePiece, id: 'home-edge-top', position: { q: 5, r: 0 } };
/** Right byline column (q=36), inside awayThird; even-q neighbours include {q:37,r:3}. */
const awayFarEdge: PlayerPiece = { ...awayPiece, id: 'away-edge-right', position: { q: 36, r: 3 } };

const eligibilityPieces: readonly PlayerPiece[] = [
  homeGK, // homeThird (q:3) -> gkTeam
  awayGK, // awayThird (q:33) -> opponent
  homePiece, // middle (q:20) -> neither
  awayPiece, // middle (q:16) -> neither
  homeMidThird, // homeThird -> gkTeam
  homeFwdAwayThird, // awayThird -> gkTeam (broad reading)
  awayMidHomeThird, // homeThird -> opponent
  awayFwdAwayThird, // awayThird -> opponent
];

describe('computeGoalKickEligibleIds', () => {
  it('partitions both final-thirds pieces by team when goalKickTeam is home', () => {
    const result = computeGoalKickEligibleIds(eligibilityPieces, 'home');
    expect(new Set(result.gkTeam)).toEqual(
      new Set([homeGK.id, homeMidThird.id, homeFwdAwayThird.id]),
    );
    expect(new Set(result.opponent)).toEqual(
      new Set([awayGK.id, awayMidHomeThird.id, awayFwdAwayThird.id]),
    );
  });

  it('partitions both final-thirds pieces by team when goalKickTeam is away', () => {
    const result = computeGoalKickEligibleIds(eligibilityPieces, 'away');
    expect(new Set(result.gkTeam)).toEqual(
      new Set([awayGK.id, awayMidHomeThird.id, awayFwdAwayThird.id]),
    );
    expect(new Set(result.opponent)).toEqual(
      new Set([homeGK.id, homeMidThird.id, homeFwdAwayThird.id]),
    );
  });

  it('excludes pieces standing in the middle third from both lists', () => {
    const result = computeGoalKickEligibleIds(eligibilityPieces, 'home');
    expect(result.gkTeam).not.toContain(homePiece.id);
    expect(result.opponent).not.toContain(awayPiece.id);
  });
});

/** GOAL_KICK_SETUP_GK fixture: home is taking the goal kick; homeGK holds the ball. */
const goalKickSetupGkState: GameState = {
  ...baseLooseBallState,
  phase: 'GOAL_KICK_SETUP_GK',
  pieces: eligibilityPieces,
  goalKickTeam: 'home',
  goalKickGkId: homeGK.id,
  goalKickEligibleIds: computeGoalKickEligibleIds(eligibilityPieces, 'home'),
  goalKickUsedPace: {},
  goalKickTargetHex: null,
  goalKickMoveSlot: null,
  goalKickMovedPieceId: null,
  goalKickPaceUsed: 0,
  attackingTeam: 'home',
  activeTeam: 'home',
  ball: {
    position: homeGK.position,
    carrierId: homeGK.id,
    lastTouchedBy: { pieceId: homeGK.id, teamId: 'home' },
  },
};

describe('applyGoalKickReposition', () => {
  it('rejects when phase is not a goal-kick setup phase', () => {
    const state: GameState = { ...goalKickSetupGkState, phase: 'PASS' };
    const result = applyGoalKickReposition(state, homeMidThird.id, { q: 9, r: 10 });
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects an unknown pieceId', () => {
    const result = applyGoalKickReposition(goalKickSetupGkState, 'nonexistent-piece', {
      q: 9,
      r: 10,
    });
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('rejects a piece belonging to the non-active window team (WRONG_TEAM)', () => {
    // activeTeam is 'home' (GK-team window) — an away piece is the wrong team.
    const result = applyGoalKickReposition(goalKickSetupGkState, awayMidHomeThird.id, {
      q: 4,
      r: 16,
    });
    expect(result).toEqual({ ok: false, reason: 'WRONG_TEAM' });
  });

  it('rejects a home piece that is not in the eligible list (NOT_ELIGIBLE)', () => {
    // homePiece is home-team but stands in the middle third — not eligible.
    const result = applyGoalKickReposition(goalKickSetupGkState, homePiece.id, { q: 19, r: 10 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'NOT_ELIGIBLE' });
  });

  it('rejects a move of more than 1 hex (OUT_OF_RANGE)', () => {
    const result = applyGoalKickReposition(goalKickSetupGkState, homeMidThird.id, {
      q: 10,
      r: 10,
    });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OUT_OF_RANGE' });
  });

  it('rejects a move onto an occupied hex (OCCUPIED)', () => {
    // homeGK sits at {q:3,r:5}; place homeMidThird adjacent to it for this one test.
    const state: GameState = {
      ...goalKickSetupGkState,
      pieces: goalKickSetupGkState.pieces.map((p) =>
        p.id === homeMidThird.id ? { ...p, position: { q: 4, r: 5 } } : p,
      ),
    };
    const result = applyGoalKickReposition(state, homeMidThird.id, homeGK.position);
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OCCUPIED' });
  });

  it('rejects a move that would push goalKickUsedPace past 6 (GOAL_KICK_PACE_EXHAUSTED)', () => {
    const state: GameState = {
      ...goalKickSetupGkState,
      goalKickUsedPace: { [homeMidThird.id]: 6 },
    };
    const result = applyGoalKickReposition(state, homeMidThird.id, { q: 9, r: 10 });
    expect(result).toEqual({
      ok: false,
      reason: 'MOVE_INVALID',
      detail: 'GOAL_KICK_PACE_EXHAUSTED',
    });
  });

  it('allows six successive single-hex moves on one piece; the seventh is rejected', () => {
    // Path verified against hexNeighbors' ODD-Q parity-dependent offsets:
    // (8,10)->(9,10)->(10,10)->(11,10)->(12,10)->(13,10)->(14,10), each step distance 1.
    const path: Array<{ q: number; r: number }> = [
      { q: 9, r: 10 },
      { q: 10, r: 10 },
      { q: 11, r: 10 },
      { q: 12, r: 10 },
      { q: 13, r: 10 },
      { q: 14, r: 10 },
    ];
    let state = goalKickSetupGkState;
    for (const to of path) {
      const result = applyGoalKickReposition(state, homeMidThird.id, to);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }
    expect(state.goalKickUsedPace?.[homeMidThird.id]).toBe(6);
    const movedPiece = state.pieces.find((p) => p.id === homeMidThird.id);
    expect(movedPiece?.position).toEqual({ q: 14, r: 10 });

    // Seventh move (one more hex) is rejected — budget exhausted.
    const seventh = applyGoalKickReposition(state, homeMidThird.id, { q: 15, r: 10 });
    expect(seventh).toEqual({
      ok: false,
      reason: 'MOVE_INVALID',
      detail: 'GOAL_KICK_PACE_EXHAUSTED',
    });
  });

  it('success appends one MOVE event and increments goalKickUsedPace by 1', () => {
    const result = applyGoalKickReposition(goalKickSetupGkState, homeMidThird.id, {
      q: 9,
      r: 10,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const moveEvents = result.state.eventLog.filter((e) => e.type === 'MOVE');
    expect(moveEvents).toHaveLength(1);
    const event = moveEvents[0];
    if (event?.type !== 'MOVE') throw new Error('expected MOVE event');
    expect(event.pieceId).toBe(homeMidThird.id);
    expect(event.from).toEqual({ q: 8, r: 10 });
    expect(event.to).toEqual({ q: 9, r: 10 });
    expect(result.state.goalKickUsedPace?.[homeMidThird.id]).toBe(1);
    const movedPiece = result.state.pieces.find((p) => p.id === homeMidThird.id);
    expect(movedPiece?.position).toEqual({ q: 9, r: 10 });
  });

  // -------------------------------------------------------------------------
  // GOALKICK-02 (37-13) — on-pitch bounds guard, all four boundaries, both
  // reposition windows. Closes the 37-VERIFICATION.md 2026-08-04 BLOCKER.
  // -------------------------------------------------------------------------

  const gkWindowPieces: readonly PlayerPiece[] = [
    ...eligibilityPieces,
    homeGoalLineEdge,
    homeFarEdge,
    homeTopEdge,
  ];
  const gkWindowState: GameState = {
    ...goalKickSetupGkState,
    pieces: gkWindowPieces,
    goalKickEligibleIds: computeGoalKickEligibleIds(gkWindowPieces, 'home'),
  };

  const opponentWindowPieces: readonly PlayerPiece[] = [...eligibilityPieces, awayFarEdge];
  const opponentWindowState: GameState = {
    ...goalKickSetupGkState,
    phase: 'GOAL_KICK_SETUP_OPPONENT',
    activeTeam: 'away',
    pieces: opponentWindowPieces,
    goalKickEligibleIds: computeGoalKickEligibleIds(opponentWindowPieces, 'home'),
  };

  it('rejects a left-column (q=0) reposition destination outside the pitch (OFF_PITCH) in the GK window', () => {
    const result = applyGoalKickReposition(gkWindowState, homeGoalLineEdge.id, { q: -1, r: 5 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('rejects a right-column (q=36) reposition destination outside the pitch (OFF_PITCH) in the GK window', () => {
    const result = applyGoalKickReposition(gkWindowState, homeFarEdge.id, { q: 37, r: 20 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('rejects a top-row (r=0) reposition destination outside the pitch (OFF_PITCH) in the GK window', () => {
    const result = applyGoalKickReposition(gkWindowState, homeTopEdge.id, { q: 5, r: -1 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('rejects a right-column (q=36) reposition destination outside the pitch (OFF_PITCH) in the OPPONENT window', () => {
    const result = applyGoalKickReposition(opponentWindowState, awayFarEdge.id, { q: 37, r: 3 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('an OFF_PITCH rejection does not mutate the input state (position or goalKickUsedPace)', () => {
    const result = applyGoalKickReposition(gkWindowState, homeGoalLineEdge.id, { q: -1, r: 5 });
    expect(result.ok).toBe(false);
    const untouchedPiece = gkWindowState.pieces.find((p) => p.id === homeGoalLineEdge.id);
    expect(untouchedPiece?.position).toEqual({ q: 0, r: 5 });
    expect(gkWindowState.goalKickUsedPace).toEqual({});
  });

  it('adjacency still wins over bounds for a distant off-pitch hex (OUT_OF_RANGE, not OFF_PITCH)', () => {
    // {q:-3,r:5} is off-pitch AND hexDistance 3 from {q:0,r:5} — adjacency (checked
    // first, D-13-03) must reject it as OUT_OF_RANGE, not OFF_PITCH.
    const result = applyGoalKickReposition(gkWindowState, homeGoalLineEdge.id, { q: -3, r: 5 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OUT_OF_RANGE' });
  });

  it('does not over-block: a boundary piece can still step to a legal on-pitch neighbour', () => {
    const result = applyGoalKickReposition(gkWindowState, homeGoalLineEdge.id, { q: 0, r: 6 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const movedPiece = result.state.pieces.find((p) => p.id === homeGoalLineEdge.id);
    expect(movedPiece?.position).toEqual({ q: 0, r: 6 });
    expect(result.state.goalKickUsedPace?.[homeGoalLineEdge.id]).toBe(1);
  });

  it('a boundary piece keeps its full 6-hex budget despite standing on the edge of the pitch', () => {
    // Path stays on the q=0 column, walking down the sideline: every step uses the
    // even-q {0,1} neighbour offset (r+1, q unchanged) — on-pitch and collision-free
    // for the full 6-hex budget: (0,5)->(0,6)->(0,7)->(0,8)->(0,9)->(0,10)->(0,11).
    const path: Array<{ q: number; r: number }> = [
      { q: 0, r: 6 },
      { q: 0, r: 7 },
      { q: 0, r: 8 },
      { q: 0, r: 9 },
      { q: 0, r: 10 },
      { q: 0, r: 11 },
    ];
    let state = gkWindowState;
    for (const to of path) {
      const result = applyGoalKickReposition(state, homeGoalLineEdge.id, to);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }
    expect(state.goalKickUsedPace?.[homeGoalLineEdge.id]).toBe(6);
    const movedPiece = state.pieces.find((p) => p.id === homeGoalLineEdge.id);
    expect(movedPiece?.position).toEqual({ q: 0, r: 11 });
  });
});

// ---------------------------------------------------------------------------
// applyGoalKickWindowEnd / applyGoalKickChoice (Plan 37-08 Task 2)
// GOALKICK-02/03: window advance, empty-window skip, and the Kick/Standard-Pass
// choice.
// ---------------------------------------------------------------------------

describe('applyGoalKickWindowEnd', () => {
  it('rejects when phase is not a goal-kick setup phase', () => {
    const state: GameState = { ...goalKickSetupGkState, phase: 'PASS' };
    const result = applyGoalKickWindowEnd(state);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('from GOAL_KICK_SETUP_GK with a non-empty opponent list, advances to GOAL_KICK_SETUP_OPPONENT', () => {
    const result = applyGoalKickWindowEnd(goalKickSetupGkState);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('GOAL_KICK_SETUP_OPPONENT');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.movedPieceIds).toEqual([]);
    // goalKickUsedPace is preserved unchanged (keyed by piece id, no collision risk).
    expect(result.state.goalKickUsedPace).toEqual({});
    const advanceEvents = result.state.eventLog.filter(
      (e) => e.type === 'GOAL_KICK_WINDOW_ADVANCE',
    );
    expect(advanceEvents).toHaveLength(1);
    const event = advanceEvents[0];
    if (event?.type !== 'GOAL_KICK_WINDOW_ADVANCE') throw new Error('expected event');
    expect(event.fromWindow).toBe('GK_TEAM');
  });

  it('from GOAL_KICK_SETUP_GK with an empty opponent list, skips straight to GOAL_KICK_CHOICE', () => {
    const state: GameState = {
      ...goalKickSetupGkState,
      goalKickEligibleIds: { gkTeam: [homeMidThird.id], opponent: [] },
    };
    const result = applyGoalKickWindowEnd(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('GOAL_KICK_CHOICE');
    expect(result.state.activeTeam).toBe('home');
  });

  it('from GOAL_KICK_SETUP_OPPONENT, always advances to GOAL_KICK_CHOICE', () => {
    const state: GameState = {
      ...goalKickSetupGkState,
      phase: 'GOAL_KICK_SETUP_OPPONENT',
      activeTeam: 'away',
    };
    const result = applyGoalKickWindowEnd(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('GOAL_KICK_CHOICE');
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.attackingTeam).toBe('home');
    const advanceEvents = result.state.eventLog.filter(
      (e) => e.type === 'GOAL_KICK_WINDOW_ADVANCE',
    );
    expect(advanceEvents).toHaveLength(1);
    const event = advanceEvents[0];
    if (event?.type !== 'GOAL_KICK_WINDOW_ADVANCE') throw new Error('expected event');
    expect(event.fromWindow).toBe('OPPONENT');
  });

  it('re-evaluates offsidePieceIds on every return', () => {
    const gkEndResult = applyGoalKickWindowEnd(goalKickSetupGkState);
    expect(gkEndResult.ok).toBe(true);
    if (!gkEndResult.ok) return;
    expect(gkEndResult.state.offsidePieceIds).toBeDefined();

    const opponentState: GameState = {
      ...goalKickSetupGkState,
      phase: 'GOAL_KICK_SETUP_OPPONENT',
      activeTeam: 'away',
    };
    const opponentEndResult = applyGoalKickWindowEnd(opponentState);
    expect(opponentEndResult.ok).toBe(true);
    if (!opponentEndResult.ok) return;
    expect(opponentEndResult.state.offsidePieceIds).toBeDefined();
  });
});

/** GOAL_KICK_CHOICE fixture: home has finished both reposition windows. */
const goalKickChoiceState: GameState = {
  ...goalKickSetupGkState,
  phase: 'GOAL_KICK_CHOICE',
  goalKickEligibleIds: null,
  goalKickUsedPace: null,
};

describe('applyGoalKickChoice', () => {
  it('rejects when phase is not GOAL_KICK_CHOICE', () => {
    const state: GameState = { ...goalKickChoiceState, phase: 'PASS' };
    const result = applyGoalKickChoice(state, 'standard');
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects an invalid choice value', () => {
    const result = applyGoalKickChoice(
      goalKickChoiceState,
      'invalid' as unknown as 'kick' | 'standard',
    );
    expect(result).toEqual({ ok: false, reason: 'INVALID_CHOICE' });
  });

  it("'standard': hands the GK the ball and transitions to PASS with GOAL_KICK_RESTART", () => {
    const result = applyGoalKickChoice(goalKickChoiceState, 'standard');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('GOAL_KICK_RESTART');
    expect(result.state.ball.carrierId).toBe(homeGK.id);
    expect(result.state.attackingTeam).toBe('home');
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.goalKickTeam).toBeNull();
    expect(result.state.goalKickGkId).toBeNull();
    expect(result.state.goalKickEligibleIds).toBeNull();
    expect(result.state.goalKickUsedPace).toBeNull();
    const choiceEvents = result.state.eventLog.filter((e) => e.type === 'GOAL_KICK_CHOICE');
    expect(choiceEvents).toHaveLength(1);
    const event = choiceEvents[0];
    if (event?.type !== 'GOAL_KICK_CHOICE') throw new Error('expected event');
    expect(event.choice).toBe('standard');
  });

  it("'kick': advances to GOAL_KICK_TARGET with the ball still held by the GK", () => {
    const result = applyGoalKickChoice(goalKickChoiceState, 'kick');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('GOAL_KICK_TARGET');
    expect(result.state.ball.carrierId).toBe(homeGK.id);
    expect(result.state.lastDiceRoll).toBeNull();
    const choiceEvents = result.state.eventLog.filter((e) => e.type === 'GOAL_KICK_CHOICE');
    expect(choiceEvents).toHaveLength(1);
  });

  it('ELIGIBLE_NEXT_ACTIONS.GOAL_KICK_RESTART contains only STANDARD_PASS', () => {
    expect(ELIGIBLE_NEXT_ACTIONS.GOAL_KICK_RESTART.size).toBe(1);
    expect(ELIGIBLE_NEXT_ACTIONS.GOAL_KICK_RESTART.has('STANDARD_PASS')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyGoalKickTarget (Plan 37-09 Task 1)
// GOALKICK-05: the Kick must target an outfield teammate's hex ("the head").
// ---------------------------------------------------------------------------

/**
 * GOAL_KICK_TARGET fixture: home has chosen 'kick'. homeGK still holds the ball
 * (mirrors applyGoalKickChoice's 'kick' branch). homeMidThird ({q:8,r:10}) is
 * homeGK's outfield teammate and the valid target for the success case.
 */
const goalKickTargetState: GameState = {
  ...goalKickSetupGkState,
  phase: 'GOAL_KICK_TARGET',
  goalKickEligibleIds: null,
  goalKickUsedPace: null,
  ball: {
    position: homeGK.position,
    carrierId: homeGK.id,
    lastTouchedBy: { pieceId: homeGK.id, teamId: 'home' },
  },
};

describe('applyGoalKickTarget', () => {
  it('rejects when phase is not GOAL_KICK_TARGET', () => {
    const state: GameState = { ...goalKickTargetState, phase: 'PASS' };
    const result = applyGoalKickTarget(state, homeMidThird.position);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects when goalKickGkId matches no piece', () => {
    const state: GameState = { ...goalKickTargetState, goalKickGkId: 'nonexistent-gk' };
    const result = applyGoalKickTarget(state, homeMidThird.position);
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('rejects an off-pitch target', () => {
    const result = applyGoalKickTarget(goalKickTargetState, { q: -5, r: 10 });
    expect(result).toEqual({ ok: false, reason: 'OFF_PITCH' });
  });

  it("rejects the goalkeeper's own hex", () => {
    const result = applyGoalKickTarget(goalKickTargetState, homeGK.position);
    expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
  });

  it('rejects an empty on-pitch hex (GOALKICK-05: must target a teammate)', () => {
    const result = applyGoalKickTarget(goalKickTargetState, { q: 19, r: 10 });
    expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
  });

  it('rejects a hex occupied by an opposing piece', () => {
    const result = applyGoalKickTarget(goalKickTargetState, awayMidHomeThird.position);
    expect(result).toEqual({ ok: false, reason: 'INVALID_TARGET' });
  });

  it("accepts a teammate's hex and transitions to GOAL_KICK_MOVE with the ball in the air", () => {
    const result = applyGoalKickTarget(goalKickTargetState, homeMidThird.position);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('GOAL_KICK_MOVE');
    expect(result.state.goalKickTargetHex).toEqual(homeMidThird.position);
    expect(result.state.goalKickMoveSlot).toBe('KICKER');
    expect(result.state.goalKickMovedPieceId).toBeNull();
    expect(result.state.goalKickPaceUsed).toBe(0);
    expect(result.state.ball.position).toEqual(homeMidThird.position);
    expect(result.state.ball.carrierId).toBeNull();
    expect(result.state.ball.lastTouchedBy).toEqual({ pieceId: homeGK.id, teamId: 'home' });
    expect(result.state.lastDiceRoll).toBeNull();
    expect(result.state.lastActionType).toBeNull();
    expect(result.state.activeTeam).toBe('home');
    expect(result.state.attackingTeam).toBe('home');
    expect(result.state.eventLog).toHaveLength(goalKickTargetState.eventLog.length);
  });
});

// ---------------------------------------------------------------------------
// applyGoalKickMoveEnd (Plan 37-09 Task 2)
// GOALKICK-04/05: KICKER->OPP slot handoff, then the accuracy roll resolving
// into HEADER (accurate + eligible contestant), LOOSE_BALL (accurate + no
// eligible contestant, or inaccurate).
// ---------------------------------------------------------------------------

/**
 * GOAL_KICK_MOVE fixture, KICKER slot: home is kicking, target = homeMidThird's
 * hex, ball in the air — mirrors applyGoalKickTarget's success return.
 */
const goalKickMoveKickerState: GameState = {
  ...goalKickSetupGkState,
  phase: 'GOAL_KICK_MOVE',
  goalKickEligibleIds: null,
  goalKickUsedPace: null,
  goalKickTargetHex: homeMidThird.position,
  goalKickMoveSlot: 'KICKER',
  goalKickMovedPieceId: null,
  goalKickPaceUsed: 0,
  activeTeam: 'home',
  ball: {
    position: homeMidThird.position,
    carrierId: null,
    lastTouchedBy: { pieceId: homeGK.id, teamId: 'home' },
  },
};

/** Isolated target hex for OPP-slot tests — far from every fixture piece below. */
const oppTargetHex = { q: 15, r: 8 };
/** Home outfield piece standing exactly on oppTargetHex — the header-eligible receiver. */
const teammateAtTarget: PlayerPiece = {
  ...homePiece,
  id: 'home-receiver',
  position: oppTargetHex,
};

/**
 * Builds an OPP-slot GOAL_KICK_MOVE state with a fully-controlled `pieces` list
 * (just the GK, the away GK, and whatever `extraPieces` the test supplies) so
 * header-eligibility ("within 2 hexes of the target") is deterministic without
 * needing to reason about every fixture piece's exact distance to the target.
 */
function makeGoalKickMoveOppState(highPass: number, extraPieces: PlayerPiece[]): GameState {
  const gk: PlayerPiece = { ...homeGK, highPass };
  return {
    ...goalKickMoveKickerState,
    pieces: [gk, awayGK, ...extraPieces],
    goalKickGkId: gk.id,
    goalKickTargetHex: oppTargetHex,
    goalKickMoveSlot: 'OPP',
    activeTeam: 'away',
    ball: {
      position: oppTargetHex,
      carrierId: null,
      lastTouchedBy: { pieceId: gk.id, teamId: 'home' },
    },
  };
}

describe('applyGoalKickMoveEnd', () => {
  it('rejects when phase is not GOAL_KICK_MOVE', () => {
    const state: GameState = { ...goalKickMoveKickerState, phase: 'PASS' };
    const result = applyGoalKickMoveEnd(state, 4);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('KICKER slot: hands off to OPP with the opposing team active; kickDie is ignored', () => {
    const result = applyGoalKickMoveEnd(goalKickMoveKickerState, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.goalKickMoveSlot).toBe('OPP');
    expect(result.state.activeTeam).toBe('away');
    expect(result.state.goalKickMovedPieceId).toBeNull();
    expect(result.state.goalKickPaceUsed).toBe(0);
    expect(result.state.goalKickTargetHex).toEqual(homeMidThird.position);
    expect(result.state.eventLog).toHaveLength(goalKickMoveKickerState.eventLog.length);
  });

  it('OPP slot rejects when goalKickGkId matches no piece', () => {
    const state = makeGoalKickMoveOppState(7, []);
    const badState: GameState = { ...state, goalKickGkId: 'nonexistent-gk' };
    const result = applyGoalKickMoveEnd(badState, 4);
    expect(result).toEqual({ ok: false, reason: 'PIECE_NOT_FOUND' });
  });

  it('OPP slot rejects when goalKickTargetHex is null (MISSING_TARGET)', () => {
    const state = makeGoalKickMoveOppState(7, []);
    const badState: GameState = { ...state, goalKickTargetHex: null };
    const result = applyGoalKickMoveEnd(badState, 4);
    expect(result).toEqual({ ok: false, reason: 'MISSING_TARGET' });
  });

  it('highPass 7 is accurate for any die 1-6, and kickScore equals highPass + kickDie', () => {
    const state = makeGoalKickMoveOppState(7, [teammateAtTarget]);
    for (const die of [1, 2, 3, 4, 5, 6]) {
      const result = applyGoalKickMoveEnd(state, die);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const event = result.state.eventLog.find((e) => e.type === 'GOAL_KICK');
      if (event?.type !== 'GOAL_KICK') throw new Error('expected GOAL_KICK event');
      expect(event.accurate).toBe(true);
      expect(event.kickScore).toBe(7 + die);
    }
  });

  it('accurate with an eligible header contestant transitions to HEADER', () => {
    const state = makeGoalKickMoveOppState(7, [teammateAtTarget]);
    const result = applyGoalKickMoveEnd(state, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('HEADER');
    expect(result.state.ball.carrierId).toBeNull();
    expect(result.state.ball.position).toEqual(oppTargetHex);
    expect(result.state.headerAccuracyRollPending).toBe(true);
    expect(result.state.headerContestants).toEqual({ home: [], away: [] });
    expect(result.state.headerConfirmed).toEqual({ home: false, away: true });
    expect(result.state.lastActionType).toBe('HIGH_PASS');
  });

  it('accurate with no eligible header contestant on either team falls to LOOSE_BALL', () => {
    // Only the two GKs are on the pitch, both far from oppTargetHex — no eligible receiver.
    const state = makeGoalKickMoveOppState(7, []);
    const result = applyGoalKickMoveEnd(state, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.lastActionType).toBe('DEFLECTION');
    expect(result.state.ball.position).toEqual(oppTargetHex);
    expect(result.state.ball.carrierId).toBeNull();
  });

  it('inaccurate (highPass 1) resolves to LOOSE_BALL with an inaccurate GOAL_KICK event', () => {
    const state = makeGoalKickMoveOppState(1, [teammateAtTarget]);
    const result = applyGoalKickMoveEnd(state, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('LOOSE_BALL');
    expect(result.state.ball.position).toEqual(oppTargetHex);
    expect(result.state.ball.carrierId).toBeNull();
    expect(result.state.lastActionType).toBe('DEFLECTION');
    const event = result.state.eventLog.find((e) => e.type === 'GOAL_KICK');
    if (event?.type !== 'GOAL_KICK') throw new Error('expected GOAL_KICK event');
    expect(event.accurate).toBe(false);
  });

  it('every OPP-slot return clears all goal-kick fields and increments actionCount by 1', () => {
    const state = makeGoalKickMoveOppState(7, [teammateAtTarget]);
    const result = applyGoalKickMoveEnd(state, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.goalKickTeam).toBeNull();
    expect(result.state.goalKickGkId).toBeNull();
    expect(result.state.goalKickTargetHex).toBeNull();
    expect(result.state.goalKickMoveSlot).toBeNull();
    expect(result.state.goalKickMovedPieceId).toBeNull();
    expect(result.state.goalKickEligibleIds).toBeNull();
    expect(result.state.goalKickUsedPace).toBeNull();
    expect(result.state.goalKickPaceUsed).toBe(0);
    expect(result.state.lastDiceRoll).toEqual({ rolls: [3], context: 'GOAL_KICK' });
    expect(result.state.lastShotPath).toBeNull();
    expect(result.state.actionCount).toBe(state.actionCount + 1);
  });

  it('re-evaluates offsidePieceIds on both KICKER and OPP returns', () => {
    const kickerResult = applyGoalKickMoveEnd(goalKickMoveKickerState, 3);
    expect(kickerResult.ok).toBe(true);
    if (kickerResult.ok) expect(kickerResult.state.offsidePieceIds).toBeDefined();

    const oppState = makeGoalKickMoveOppState(7, [teammateAtTarget]);
    const oppResult = applyGoalKickMoveEnd(oppState, 3);
    expect(oppResult.ok).toBe(true);
    if (oppResult.ok) expect(oppResult.state.offsidePieceIds).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// applyFreeMove OFF_PITCH guard (Plan 37-15, closes T-37-66 — the sibling
// threat that 37-13 accepted and required be carried). Mirrors
// applyGoalKickReposition's isPitchHex guard (37-13) applied to its
// documented sibling: no game:move payload can walk a piece off the grid
// during a FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE sub-phase.
// ---------------------------------------------------------------------------

const edgePieceEvenQ: PlayerPiece = {
  ...homePiece,
  id: 'edge-even-q',
  position: { q: 0, r: 5 },
};

const edgePieceOddQ: PlayerPiece = {
  ...homePiece,
  id: 'edge-odd-q',
  position: { q: 5, r: 0 },
};

const edgePieceAwayQ: PlayerPiece = {
  ...awayPiece,
  id: 'edge-away-q',
  position: { q: 36, r: 20 },
};

const edgePieceAwayR: PlayerPiece = {
  ...awayPiece,
  id: 'edge-away-r',
  position: { q: 20, r: 25 },
};

/** FREE_MOVE_ATTACK fixture with both even-q and odd-q edge pieces eligible. */
const freeMoveAttackEdgeState: GameState = {
  ...baseLooseBallState,
  phase: 'FREE_MOVE_ATTACK',
  activeTeam: 'home',
  pieces: [edgePieceEvenQ, edgePieceOddQ, homeGK, awayGK],
  freeMoveEligibleIds: { attack: [edgePieceEvenQ.id, edgePieceOddQ.id], defense: [] },
  freeMoveUsedPace: {},
};

/** FREE_MOVE_DEFENSE fixture with both away-column and away-row edge pieces eligible. */
const freeMoveDefenseEdgeState: GameState = {
  ...baseLooseBallState,
  phase: 'FREE_MOVE_DEFENSE',
  activeTeam: 'away',
  pieces: [edgePieceAwayQ, edgePieceAwayR, homeGK, awayGK],
  freeMoveEligibleIds: { attack: [], defense: [edgePieceAwayQ.id, edgePieceAwayR.id] },
  freeMoveUsedPace: {},
};

describe('applyFreeMove OFF_PITCH guard (Plan 37-15, closes T-37-66)', () => {
  it('FREE_MOVE_ATTACK: eligible piece at {q:0,r:5} attempting {q:-1,r:5} returns MOVE_INVALID/OFF_PITCH', () => {
    const result = applyMove(freeMoveAttackEdgeState, edgePieceEvenQ.id, { q: -1, r: 5 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('FREE_MOVE_ATTACK: eligible piece at {q:5,r:0} attempting {q:5,r:-1} returns MOVE_INVALID/OFF_PITCH (gap is not q-only)', () => {
    const result = applyMove(freeMoveAttackEdgeState, edgePieceOddQ.id, { q: 5, r: -1 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('FREE_MOVE_DEFENSE: eligible piece at {q:36,r:20} attempting {q:37,r:20} returns MOVE_INVALID/OFF_PITCH', () => {
    const result = applyMove(freeMoveDefenseEdgeState, edgePieceAwayQ.id, { q: 37, r: 20 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('FREE_MOVE_DEFENSE: eligible piece at {q:20,r:25} attempting {q:20,r:26} returns MOVE_INVALID/OFF_PITCH', () => {
    const result = applyMove(freeMoveDefenseEdgeState, edgePieceAwayR.id, { q: 20, r: 26 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' });
  });

  it('precedence: a far-away off-pitch destination still returns OUT_OF_RANGE (adjacency checked first)', () => {
    const result = applyMove(freeMoveAttackEdgeState, edgePieceEvenQ.id, { q: -10, r: 5 });
    expect(result).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OUT_OF_RANGE' });
  });

  it('pre-existing rejections keep their exact reason+detail shape: WRONG_TEAM, NOT_ELIGIBLE, OCCUPIED, FREE_MOVE_EXHAUSTED', () => {
    // WRONG_TEAM: activeTeam is 'home' during FREE_MOVE_ATTACK; awayGK is on the pitch
    // in this fixture (pieces list) but belongs to 'away'.
    const wrongTeam = applyMove(freeMoveAttackEdgeState, awayGK.id, { q: 34, r: 6 });
    expect(wrongTeam).toEqual({ ok: false, reason: 'WRONG_TEAM' });

    // NOT_ELIGIBLE: homeGK is home-team but not in the attack eligible list.
    const notEligible = applyMove(freeMoveAttackEdgeState, homeGK.id, { q: 3, r: 6 });
    expect(notEligible).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'NOT_ELIGIBLE' });

    // OCCUPIED: edgePieceOddQ sits adjacent to edgePieceEvenQ's on-pitch neighbour {q:1,r:5}.
    const occupiedState: GameState = {
      ...freeMoveAttackEdgeState,
      pieces: [edgePieceEvenQ, { ...edgePieceOddQ, position: { q: 1, r: 5 } }, homeGK, awayGK],
    };
    const occupied = applyMove(occupiedState, edgePieceEvenQ.id, { q: 1, r: 5 });
    expect(occupied).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'OCCUPIED' });

    // FREE_MOVE_EXHAUSTED: already at movedPieceIds lock.
    const exhaustedState: GameState = {
      ...freeMoveAttackEdgeState,
      movedPieceIds: [edgePieceEvenQ.id],
    };
    const exhausted = applyMove(exhaustedState, edgePieceEvenQ.id, { q: 1, r: 4 });
    expect(exhausted).toEqual({
      ok: false,
      reason: 'MOVE_INVALID',
      detail: 'FREE_MOVE_EXHAUSTED',
    });
  });

  it('positive control: a boundary-positioned eligible piece can still reach every legal on-pitch neighbour and spend its full 6-hex budget', () => {
    // edgePieceEvenQ at {q:0,r:5}; {q:1,r:5} is on-pitch and adjacent.
    let current = freeMoveAttackEdgeState;
    let position = edgePieceEvenQ.position;
    const path: HexCoord[] = [
      { q: 1, r: 5 },
      { q: 1, r: 4 },
      { q: 0, r: 4 },
      { q: 0, r: 3 },
      { q: 1, r: 3 },
      { q: 1, r: 2 },
    ];
    for (const to of path) {
      const result = applyMove(current, edgePieceEvenQ.id, to);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.state;
      position = to;
    }
    expect(position).toEqual({ q: 1, r: 2 });
    expect((current.freeMoveUsedPace ?? {})[edgePieceEvenQ.id]).toBe(6);
    // Budget is fully spent: a 7th step (even a legal on-pitch adjacent hex) is rejected.
    const seventh = applyMove(current, edgePieceEvenQ.id, { q: 1, r: 1 });
    expect(seventh).toEqual({ ok: false, reason: 'MOVE_INVALID', detail: 'FREE_MOVE_EXHAUSTED' });
  });
});
