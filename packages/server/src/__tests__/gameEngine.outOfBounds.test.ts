import { describe, it, expect } from 'vitest';
import {
  applyRoll,
  triggerOutOfBoundsRestart,
  applyFreeMoveZoneCheck,
  applyThrowInPlace,
  applyEndTurn,
  computeGoalKickEligibleIds,
  applyGoalKickReposition,
  applyGoalKickWindowEnd,
  applyGoalKickChoice,
  applyGoalKickTarget,
  applyGoalKickMoveEnd,
} from '../gameEngine.js';
import type { GameState, GamePhase, PlayerPiece } from '@counter-attack/shared';
import { isPitchHex, ELIGIBLE_NEXT_ACTIONS } from '@counter-attack/shared';

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
    // direction=3 (NW, r decreases, q constant), distance=2: step1 {q:18,r:0} on-pitch,
    // step2 {q:18,r:-1} off-pitch — clamp stops at {q:18,r:0}.
    const result = applyRoll(state, 3, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('DEFLECTION');
    expect(isPitchHex(result.state.ball.position)).toBe(true);
    expect(result.state.ball.position).toEqual({ q: 18, r: 0 });
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
    expect(result.state.ball.position).toEqual({ q: 18, r: 0 });
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
    expect(result.state.ball.position).toEqual(homeGK.position);
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
// OOB-03 is Phase 38 scope — a defending touch at the byline must NOT award a
// restart in Phase 37; it falls back to today's clamp behaviour.
// ---------------------------------------------------------------------------

describe('byline exit after a defending touch stays in play (OOB-03 is Phase 38)', () => {
  it('falls back to the clamp/DEFLECTION path when the byline owner touched last', () => {
    // Phase 38 / OOB-03: when Corner Kick is implemented, this scenario should be moved to
    // a Phase 38 test asserting a CORNER_KICK award, not deleted here.
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
    expect(result.state.phase).toBe('PASS');
    expect(result.state.lastActionType).toBe('DEFLECTION');
    expect(result.state.ball.position).toEqual({ q: 0, r: 14 });
    const oobEvents = result.state.eventLog.filter((e) => e.type === 'OUT_OF_BOUNDS');
    expect(oobEvents).toHaveLength(0);
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
