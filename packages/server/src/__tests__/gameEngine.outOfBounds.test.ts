import { describe, it, expect } from 'vitest';
import {
  applyRoll,
  triggerOutOfBoundsRestart,
  applyFreeMoveZoneCheck,
  applyThrowInPlace,
} from '../gameEngine.js';
import type { GameState, GamePhase, PlayerPiece } from '@counter-attack/shared';
import { isPitchHex } from '@counter-attack/shared';

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
