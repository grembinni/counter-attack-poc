/**
 * Phase 26 regression suite — BUG-28 and BUG-29.
 *
 * BUG-28: applyResolveHeaderTarget — header-duel target range reference
 *   Validates that when the attacker wins a header duel, the range check uses
 *   the winning contestant's ACTUAL PIECE POSITION as referencePosition, not the
 *   ball position.  The critical assertion: a targetHex within 6 of the winner
 *   but more than 6 from the ball position is still accepted (ok: true).
 *
 * BUG-29: applyDeclareShot — standard shot range validation
 *   Validates that the server range gate (hexDistance > 11) is cube-consistent
 *   with piece positions stored in axial (ODD-Q offset) coordinates, and that
 *   the server constant (11) matches the client preview in ActionPanel.tsx:781
 *   (`dist <= 11`).  Boundary cases: distance 11 → accept, distance 12 → reject.
 */

import { describe, it, expect } from 'vitest';
import { applyResolveHeaderTarget, applyDeclareShot } from '../gameEngine.js';
import { hexDistance } from '@counter-attack/shared';
import type { GameState, PlayerPiece } from '@counter-attack/shared';
import type { UniformStyleId } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Shared style constant (Phase 22 D-17)
// ---------------------------------------------------------------------------

const DEFAULT_STYLES: { home: UniformStyleId; away: UniformStyleId } = {
  home: 'pinstripes-vertical',
  away: 'bar-diagonal',
};

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const homeFwd: PlayerPiece = {
  id: 'home-fwd',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'FWD',
  number: 9,
  nationality: 'Test',
  role: 'FWD',
  position: { q: 25, r: 12 },
  pace: 8,
  shooting: 8,
  tackling: 2,
  dribbling: 7,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 7,
  highPass: 8,
};

const awayDef: PlayerPiece = {
  id: 'away-def',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'DEF',
  number: 2,
  nationality: 'Test',
  role: 'DEF',
  position: { q: 26, r: 12 },
  pace: 6,
  shooting: 3,
  tackling: 8,
  dribbling: 4,
  saving: 1,
  handling: 1,
  resilience: 7,
  aerialAbility: 3,
  highPass: 4,
};

const awayGk: PlayerPiece = {
  id: 'away-gk',
  teamId: 'away',
  firstName: 'Away',
  lastName: 'GK',
  number: 1,
  nationality: 'Test',
  role: 'GK',
  position: { q: 36, r: 13 },
  pace: 5,
  shooting: 1,
  tackling: 1,
  dribbling: 1,
  saving: 8,
  handling: 8,
  resilience: 5,
  aerialAbility: 6,
  highPass: 0,
};

// ---------------------------------------------------------------------------
// Base state (minimal required fields for GameState)
// ---------------------------------------------------------------------------

const baseState: GameState = {
  roomCode: 'TEST26',
  phase: 'PASS',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [homeFwd, awayDef, awayGk],
  ball: { position: { q: 25, r: 12 }, carrierId: 'home-fwd' },
  score: { home: 0, away: 0 },
  actionCount: 5,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 2 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  ballZone: 'middle',
  addedTime: null,
  lastActionType: 'MOVEMENT_PHASE',
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' },
  selectedUniformStyles: DEFAULT_STYLES,
  gameSpeed: 'standard',
  contestedPieceIds: [],
};

// ---------------------------------------------------------------------------
// BUG-28: applyResolveHeaderTarget — range reference is contestant position
// ---------------------------------------------------------------------------

/**
 * Creates a HEADER state where the winning contestant (homeFwd) is at a DIFFERENT
 * position from the ball.
 *
 * Key positions:
 *   ball:    {q:10, r:12}  — far from any relevant target hex
 *   homeFwd: {q:25, r:12}  — actual winning contestant position
 *   awayDef: {q:26, r:12}  — losing contestant, adjacent to winner
 *
 * Target hexes used in tests:
 *   {q:28, r:12} — 3 hexes from homeFwd (within 6), 18 hexes from ball (> 6)
 *   {q:5,  r:5}  — 20 hexes from homeFwd (> 6) — out of range
 */
const makeHeaderStateWinnerNotAtBall = (overrides: Partial<GameState> = {}): GameState => ({
  ...baseState,
  phase: 'HEADER',
  lastActionType: 'HIGH_PASS',
  movementSlot: null,
  // Ball is far from the winner's position — the key distinguishing factor for BUG-28.
  ball: { position: { q: 10, r: 12 }, carrierId: null },
  pieces: [
    { ...homeFwd, position: { q: 25, r: 12 } }, // winner at a position ≠ ball
    { ...awayDef, position: { q: 26, r: 12 } },
    awayGk,
  ],
  headerContestants: { home: ['home-fwd'], away: ['away-def'] },
  headerConfirmed: { home: true, away: true },
  headerDuelWinner: 'home',
  headerAccuracyRollPending: null,
  headerTargetHex: null,
  ...overrides,
});

describe('BUG-28: applyResolveHeaderTarget — referencePosition uses winning contestant (not ball)', () => {
  it('accepts targetHex within 6 of winner even when it is more than 6 from ball position', () => {
    // This test is the KEY BUG-28 assertion.
    // winner at {q:25,r:12}; ball at {q:10,r:12} (distance 15 from target)
    // target {q:28,r:12}: hexDistance(winner, target)=3 ≤ 6 → ACCEPT
    //                       hexDistance(ball,   target)=18 > 6 → would reject if bug existed
    const state = makeHeaderStateWinnerNotAtBall();
    const targetHex = { q: 28, r: 12 };

    // Sanity: confirm the geometry is what we expect
    const distFromWinner = hexDistance({ q: 25, r: 12 }, targetHex);
    const distFromBall = hexDistance({ q: 10, r: 12 }, targetHex);
    expect(distFromWinner).toBeLessThanOrEqual(6); // within winner's heading range
    expect(distFromBall).toBeGreaterThan(6); // outside ball position — BUG-28 would reject

    const result = applyResolveHeaderTarget(state, targetHex);
    expect(result.ok).toBe(true); // must accept — reference is contestant, not ball
  });

  it('rejects targetHex more than 6 hexes from the winning contestant position', () => {
    const state = makeHeaderStateWinnerNotAtBall();
    // {q:5,r:5}: hexDistance({q:25,r:12}, {q:5,r:5}) = 20 → out of range
    const result = applyResolveHeaderTarget(state, { q: 5, r: 5 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('INVALID_TARGET');
  });

  it('accepts a goal-line hex within 6 of the contestant position and routes to GK_DIVE', () => {
    // Winner near goal line at {q:32,r:12}; ball far away at {q:10,r:12}.
    // Goal hex {q:36,r:12}: hexDistance({q:32,r:12}, {q:36,r:12}) = 4 ≤ 6 → accept.
    const nearGoalState = makeHeaderStateWinnerNotAtBall({
      pieces: [
        { ...homeFwd, position: { q: 32, r: 12 } },
        { ...awayDef, position: { q: 33, r: 12 } },
        awayGk,
      ],
      ball: { position: { q: 10, r: 12 }, carrierId: null }, // ball still far
      headerContestants: { home: ['home-fwd'], away: ['away-def'] },
      headerDuelWinner: 'home',
    });
    const goalHex = { q: 36, r: 12 };
    const result = applyResolveHeaderTarget(nearGoalState, goalHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Goal-line route → GK_DIVE, not PASS
    expect(result.state.phase).toBe('GK_DIVE');
  });

  it('falls back to ball carrier position when no contestant exists (uncontested win)', () => {
    // Uncontested: headerContestants.home is empty → resolveHeaderWinnerPiece falls back
    // to ball.carrierId. The ball carrier is the reference position.
    const ballCarrierId = 'home-fwd';
    const uncontestedState: GameState = {
      ...baseState,
      phase: 'HEADER',
      lastActionType: 'HIGH_PASS',
      movementSlot: null,
      ball: { position: { q: 25, r: 12 }, carrierId: ballCarrierId },
      pieces: [
        { ...homeFwd, position: { q: 25, r: 12 } }, // ball carrier at {q:25,r:12}
        awayGk,
      ],
      // No contestants for winner team — triggers uncontested fallback
      headerContestants: { home: [], away: [] },
      headerConfirmed: { home: true, away: true },
      headerDuelWinner: 'home',
      headerAccuracyRollPending: null,
      headerTargetHex: null,
    };
    // target {q:28,r:12}: distance 3 from carrier {q:25,r:12} → accept
    const result = applyResolveHeaderTarget(uncontestedState, { q: 28, r: 12 });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BUG-29: applyDeclareShot — shot range is cube-consistent; constant = 11
// ---------------------------------------------------------------------------

/**
 * hexDistance geometry for BUG-29 shooter/goal pairs (ODD-Q offset → cube).
 *
 * Shooter at {q:25, r:13}: cube = (25, -26, 1)
 * Goal    at {q:36, r:13}: cube = (36, -31, -5)
 * Distance = max(|25-36|=11, |-26+31|=5, |1+5|=6) = 11
 *
 * Shooter at {q:24, r:13}: cube = (24, -25, 1)
 * Goal    at {q:36, r:13}: cube = (36, -31, -5)
 * Distance = max(|24-36|=12, |-25+31|=6, |1+5|=6) = 12
 *
 * Server constant: applyDeclareShot line — hexDistance(shooter.position, goalHex) > 11
 * Client constant: ActionPanel.tsx:781 — dist <= 11
 * Both sides use hexDistance from @counter-attack/shared: constants are in parity.
 */

/** Shooter piece for BUG-29 tests — home FWD at known position. */
const makeShooterAt = (q: number, r: number): PlayerPiece => ({
  id: 'home-shooter',
  teamId: 'home',
  firstName: 'Home',
  lastName: 'Shooter',
  number: 9,
  nationality: 'Test',
  role: 'FWD',
  position: { q, r },
  pace: 8,
  shooting: 8,
  tackling: 2,
  dribbling: 7,
  saving: 1,
  handling: 1,
  resilience: 6,
  aerialAbility: 5,
  highPass: 5,
});

/** PASS-phase state for applyDeclareShot tests. Home attacking toward q=36. */
const makeShotState = (shooterQ: number, shooterR: number): GameState => {
  const shooter = makeShooterAt(shooterQ, shooterR);
  return {
    ...baseState,
    phase: 'PASS',
    attackingTeam: 'home',
    activeTeam: 'home',
    lastActionType: 'MOVEMENT_PHASE', // MOVEMENT_PHASE → SHOT is eligible
    ball: { position: { q: shooterQ, r: shooterR }, carrierId: 'home-shooter' },
    pieces: [shooter, awayGk], // awayGk is GK for defending team (away)
  };
};

describe('BUG-29: hexDistance — cube-consistent with axial piece positions', () => {
  it('returns 11 for {q:25,r:13} → {q:36,r:13} (known distance 11)', () => {
    // Hand-computed: cube (25,-26,1) → cube (36,-31,-5); max-component = 11
    expect(hexDistance({ q: 25, r: 13 }, { q: 36, r: 13 })).toBe(11);
  });

  it('returns 12 for {q:24,r:13} → {q:36,r:13} (known distance 12)', () => {
    // Hand-computed: cube (24,-25,1) → cube (36,-31,-5); max-component = 12
    expect(hexDistance({ q: 24, r: 13 }, { q: 36, r: 13 })).toBe(12);
  });
});

describe('BUG-29: applyDeclareShot — range gate boundary (server constant 11)', () => {
  // Server constant: applyDeclareShot uses hexDistance(shooter.position, goalHex) > 11
  // Client constant: ActionPanel.tsx:781 uses dist <= 11
  // Both constants are 11 → client/server parity confirmed.

  it('accepts a goal hex at cube distance exactly 11 from the shooter', () => {
    // Shooter at {q:25,r:13}; goal at {q:36,r:13}: distance = 11 ≤ 11 → accept
    const state = makeShotState(25, 13);
    const goalHex = { q: 36, r: 13 }; // valid goal-line hex (q=36, r∈[10..16])
    const result = applyDeclareShot(state, goalHex);
    expect(result.ok).toBe(true);
  });

  it('rejects a goal hex at cube distance 12 from the shooter (one beyond range)', () => {
    // Shooter at {q:24,r:13}; goal at {q:36,r:13}: distance = 12 > 11 → reject
    const state = makeShotState(24, 13);
    const goalHex = { q: 36, r: 13 };
    const result = applyDeclareShot(state, goalHex);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('INVALID_TARGET');
  });

  it('transitions to GK_DIVE phase on accepted shot', () => {
    const state = makeShotState(25, 13);
    const result = applyDeclareShot(state, { q: 36, r: 13 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('GK_DIVE');
  });

  it('records shotTargetHex on accepted shot', () => {
    const goalHex = { q: 36, r: 13 };
    const state = makeShotState(25, 13);
    const result = applyDeclareShot(state, goalHex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.shotTargetHex).toEqual(goalHex);
  });
});
