/**
 * Phase 42 Plan 06 (SUB-08): full engine-level spec for `applyRosterReposition`.
 *
 * Fixture conventions (per gameEngine.substitution.test.ts): every hex literal comes
 * from `PITCH_REGIONS`/`buildKickOffPieces`'s own formation-derived output — never an
 * invented coordinate. Real `PLAYER_POOL`-backed pieces come from `buildKickOffPieces`.
 */
import { describe, it, expect } from 'vitest';
import { applyRosterReposition, applyRosterContinuity, buildKickOffPieces } from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';
import { PITCH_REGIONS } from '@counter-attack/shared';

const HOME_TEAM = 'city' as const;
const AWAY_TEAM = 'crew' as const;

const BASE_PIECES: PlayerPiece[] = buildKickOffPieces(
  'home',
  { home: HOME_TEAM, away: AWAY_TEAM },
  { home: '4-4-2', away: '4-4-2' },
);

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'TEST-REPO',
    phase: 'KICK_OFF_SETUP',
    activeTeam: 'home',
    attackingTeam: 'home',
    pieces: BASE_PIECES,
    ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 2 },
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    ballZone: 'middle',
    addedTime: null,
    lastActionType: null,
    kickOffTeam: 'home',
    kickOffActive: false,
    selectedTeams: { home: HOME_TEAM, away: AWAY_TEAM },
    selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' },
    selectedFormation: { home: '4-4-2', away: '4-4-2' },
    gameSpeed: 'standard' as const,
    foulsEnabled: false,
    bookingEnabled: false,
    injuryEnabled: false,
    outOfBoundsEnabled: false,
    bench: { home: [], away: [] },
    subsUsed: { home: 0, away: 0 },
    addedTimeBonus: 0,
    ...overrides,
  };
}

const homeOutfielders = () => BASE_PIECES.filter((p) => p.teamId === 'home' && p.role !== 'GK');
const homeGK = () => BASE_PIECES.find((p) => p.teamId === 'home' && p.role === 'GK')!;
const awayOutfielders = () => BASE_PIECES.filter((p) => p.teamId === 'away' && p.role !== 'GK');

describe('applyRosterReposition', () => {
  it('happy path: two outfield same-team pieces swap occupants; id/position/number unchanged', () => {
    const [a, b] = homeOutfielders();
    const state = makeState();

    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const newA = result.state.pieces.find((p) => p.id === a!.id)!;
    const newB = result.state.pieces.find((p) => p.id === b!.id)!;

    // Identity swapped
    expect(newA.playerId).toBe(b!.playerId);
    expect(newB.playerId).toBe(a!.playerId);
    expect(newA.firstName).toBe(b!.firstName);
    expect(newB.firstName).toBe(a!.firstName);

    // Slot-bound fields unchanged
    expect(newA.id).toBe(a!.id);
    expect(newA.position).toEqual(a!.position);
    expect(newA.number).toBe(a!.number);
    expect(newB.id).toBe(b!.id);
    expect(newB.position).toEqual(b!.position);
    expect(newB.number).toBe(b!.number);
  });

  it('reset survival: applyRosterContinuity preserves the swapped identities while positions come from the reset array', () => {
    const [a, b] = homeOutfielders();
    const state = makeState();
    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resetPieces = buildKickOffPieces(
      'away',
      { home: HOME_TEAM, away: AWAY_TEAM },
      { home: '4-4-2', away: '4-4-2' },
    );
    const overlaid = applyRosterContinuity(resetPieces, result.state.pieces);

    const overlaidA = overlaid.find((p) => p.id === a!.id)!;
    const overlaidB = overlaid.find((p) => p.id === b!.id)!;
    const resetA = resetPieces.find((p) => p.id === a!.id)!;
    const resetB = resetPieces.find((p) => p.id === b!.id)!;

    // Identity persists from the post-swap live roster
    expect(overlaidA.playerId).toBe(b!.playerId);
    expect(overlaidB.playerId).toBe(a!.playerId);
    // Position comes from the reset array, not the pre-reset live roster
    expect(overlaidA.position).toEqual(resetA.position);
    expect(overlaidB.position).toEqual(resetB.position);
  });

  it('rejects: non-stoppage phase returns WRONG_PHASE', () => {
    const [a, b] = homeOutfielders();
    const state = makeState({ phase: 'MOVE' });
    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result).toEqual({ ok: false, reason: 'WRONG_PHASE' });
  });

  it('rejects: same id twice returns INVALID_REPOSITION', () => {
    const [a] = homeOutfielders();
    const state = makeState();
    const result = applyRosterReposition(state, 'home', a!.id, a!.id);
    expect(result).toEqual({ ok: false, reason: 'INVALID_REPOSITION' });
  });

  it('rejects: opponent-owned id returns INVALID_REPOSITION', () => {
    const [a] = homeOutfielders();
    const [oppPiece] = awayOutfielders();
    const state = makeState();
    const result = applyRosterReposition(state, 'home', a!.id, oppPiece!.id);
    expect(result).toEqual({ ok: false, reason: 'INVALID_REPOSITION' });
  });

  it('rejects: unknown id returns INVALID_REPOSITION', () => {
    const [a] = homeOutfielders();
    const state = makeState();
    const result = applyRosterReposition(state, 'home', a!.id, 'home-unknown-id');
    expect(result).toEqual({ ok: false, reason: 'INVALID_REPOSITION' });
  });

  it('rejects: GK by role returns GK_SLOT_LOCKED', () => {
    const gk = homeGK();
    const [a] = homeOutfielders();
    const state = makeState();
    const result = applyRosterReposition(state, 'home', gk.id, a!.id);
    expect(result).toEqual({ ok: false, reason: 'GK_SLOT_LOCKED' });
  });

  it('rejects: GK by slot index 0 (even if role changed) returns GK_SLOT_LOCKED', () => {
    const gk = homeGK();
    const [a] = homeOutfielders();
    // Simulate a prior substitution that changed role but kept the slot id ending in -0.
    const state = makeState({
      pieces: BASE_PIECES.map((p) => (p.id === gk.id ? { ...p, role: 'DEF' as const } : p)),
    });
    const result = applyRosterReposition(state, 'home', gk.id, a!.id);
    expect(result).toEqual({ ok: false, reason: 'GK_SLOT_LOCKED' });
  });

  it('rejects: ball-carrier participation returns REPOSITION_BALL_CARRIER', () => {
    const [a, b] = homeOutfielders();
    const state = makeState({
      ball: { position: a!.position, carrierId: a!.id, lastTouchedBy: null },
    });
    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result).toEqual({ ok: false, reason: 'REPOSITION_BALL_CARRIER' });
  });

  it('D-05: swapping an active piece with a red-carded piece succeeds; card/onPitch state travels with the person', () => {
    const [active, redCarded] = homeOutfielders();
    const state = makeState({
      pieces: BASE_PIECES.map((p) =>
        p.id === redCarded!.id ? { ...p, redCarded: true, onPitch: false } : p,
      ),
    });

    const result = applyRosterReposition(state, 'home', active!.id, redCarded!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const newActiveSlot = result.state.pieces.find((p) => p.id === active!.id)!;
    const newRedCardSlot = result.state.pieces.find((p) => p.id === redCarded!.id)!;

    // The red-carded person now occupies the formerly-active slot, still dismissed.
    expect(newActiveSlot.playerId).toBe(redCarded!.playerId);
    expect(newActiveSlot.redCarded).toBe(true);
    expect(newActiveSlot.onPitch).toBe(false);

    // The formerly-active person now occupies the red-carded slot, still active.
    expect(newRedCardSlot.playerId).toBe(active!.playerId);
    expect(newRedCardSlot.redCarded).toBeFalsy();
    expect(newRedCardSlot.onPitch).not.toBe(false);

    // Neither piece was removed from state.pieces.
    expect(result.state.pieces.length).toBe(state.pieces.length);
  });

  it('immutability: the input state object and its pieces array are not mutated', () => {
    const [a, b] = homeOutfielders();
    const state = makeState();
    const originalPieces = state.pieces;
    const originalPieceA = { ...a! };
    const originalPieceB = { ...b! };

    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result.ok).toBe(true);

    expect(state.pieces).toBe(originalPieces);
    const stillA = state.pieces.find((p) => p.id === a!.id)!;
    const stillB = state.pieces.find((p) => p.id === b!.id)!;
    expect(stillA).toEqual(originalPieceA);
    expect(stillB).toEqual(originalPieceB);
  });

  it('event: exactly one ROSTER_REPOSITION event appended, with pre-swap names and numbers', () => {
    const [a, b] = homeOutfielders();
    const state = makeState();
    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const events = result.state.eventLog.filter((e) => e.type === 'ROSTER_REPOSITION');
    expect(events.length).toBe(1);
    const evt = events[0]!;
    if (evt.type !== 'ROSTER_REPOSITION') throw new Error('unreachable');
    expect(evt.team).toBe('home');
    expect(evt.pieceId).toBe(a!.id);
    expect(evt.pieceIdB).toBe(b!.id);
    expect(evt.playerAName).toBe(`${a!.firstName} ${a!.lastName}`);
    expect(evt.playerBName).toBe(`${b!.firstName} ${b!.lastName}`);
    expect(evt.jerseyNumberA).toBe(a!.number);
    expect(evt.jerseyNumberB).toBe(b!.number);
  });

  it('no counters moved: subsUsed, addedTime, addedTimeBonus, phase, activeTeam all identical to the input state', () => {
    const [a, b] = homeOutfielders();
    const state = makeState({ subsUsed: { home: 1, away: 2 }, addedTimeBonus: 3, addedTime: 4 });
    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.subsUsed).toEqual(state.subsUsed);
    expect(result.state.addedTime).toBe(state.addedTime);
    expect(result.state.addedTimeBonus).toBe(state.addedTimeBonus);
    expect(result.state.phase).toBe(state.phase);
    expect(result.state.activeTeam).toBe(state.activeTeam);
  });
});
