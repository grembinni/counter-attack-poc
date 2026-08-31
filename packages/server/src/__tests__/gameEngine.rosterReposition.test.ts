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
import { PITCH_REGIONS, isActivePiece } from '@counter-attack/shared';

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
  it('NUMBER-01/02: a repositioned player keeps their own jersey number (number follows the person, not the slot)', () => {
    const [a, b] = homeOutfielders();
    // Guard: this assertion cannot pass vacuously if the fixture ever hands back two
    // pieces that happen to share a number.
    expect(a!.number).not.toBe(b!.number);
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

    // Slot-bound fields (id, position) stay bound to the slot — unchanged by this phase.
    expect(newA.id).toBe(a!.id);
    expect(newA.position).toEqual(a!.position);
    expect(newB.id).toBe(b!.id);
    expect(newB.position).toEqual(b!.position);

    // Number travels with the PERSON (Phase 48, NUMBER-01/NUMBER-02): slot A is now
    // occupied by person B, who brought their own number with them, and vice versa.
    expect(newA.number).toBe(b!.number);
    expect(newB.number).toBe(a!.number);
  });

  it('NUMBER-02: the ROSTER_REPOSITION event pairs each player name with the number that player still wears after the swap', () => {
    const [a, b] = homeOutfielders();
    const state = makeState();

    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const event = result.state.eventLog[result.state.eventLog.length - 1]!;
    expect(event.type).toBe('ROSTER_REPOSITION');
    if (event.type !== 'ROSTER_REPOSITION') return;

    // The logged number for each name matches that SAME person's number in the
    // post-swap state, looked up by identity (playerId), not by slot.
    const postSwapA = result.state.pieces.find((p) => p.playerId === a!.playerId)!;
    const postSwapB = result.state.pieces.find((p) => p.playerId === b!.playerId)!;

    expect(event.playerAName).toBe(`${a!.firstName} ${a!.lastName}`);
    expect(event.jerseyNumberA).toBe(postSwapA.number);
    expect(event.playerBName).toBe(`${b!.firstName} ${b!.lastName}`);
    expect(event.jerseyNumberB).toBe(postSwapB.number);
  });

  it('NUMBER-04: applyRosterContinuity preserves each person permanent number across a reset after a reposition', () => {
    const [a, b] = homeOutfielders();
    const state = makeState();
    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Stamp a deliberately non-slot-standard number onto the piece now holding person
    // A's identity, so the assertion below cannot be satisfied by a slot-derived rebuild.
    const postSwapPieces = result.state.pieces.map((p) =>
      p.playerId === a!.playerId ? { ...p, number: 77 } : p,
    );

    const resetPieces = buildKickOffPieces(
      'away',
      { home: HOME_TEAM, away: AWAY_TEAM },
      { home: '4-4-2', away: '4-4-2' },
    );
    const overlaid = applyRosterContinuity(resetPieces, postSwapPieces);

    const overlaidA = overlaid.find((p) => p.playerId === a!.playerId)!;
    const overlaidB = overlaid.find((p) => p.playerId === b!.playerId)!;
    const resetA = resetPieces.find((p) => p.id === overlaidA.id)!;
    const resetB = resetPieces.find((p) => p.id === overlaidB.id)!;

    // Number survived the reset even though it was stamped to a non-slot-standard value.
    expect(overlaidA.number).toBe(77);
    expect(overlaidB.number).toBe(b!.number);
    // Positions came from the reset array — proves continuity did run.
    expect(overlaidA.position).toEqual(resetA.position);
    expect(overlaidB.position).toEqual(resetB.position);
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

describe('gap item 6: a reposition can never stack two active pieces on one hex', () => {
  /** Asserts no two ACTIVE pieces in `pieces` share a hex (the post-swap invariant). */
  function assertNoActivePieceStacking(pieces: readonly PlayerPiece[]): void {
    const activePieces = pieces.filter(isActivePiece);
    const keys = new Set(activePieces.map((p) => `${p.position.q},${p.position.r}`));
    expect(keys.size).toBe(activePieces.length);
  }

  it('case 1: rejects with REPOSITION_SLOT_OCCUPIED when a THIRD own-team active piece already stands on the red-carded slot frozen hex', () => {
    const [active, redCarded, third] = homeOutfielders();
    const state = makeState({
      pieces: BASE_PIECES.map((p) => {
        if (p.id === redCarded!.id) return { ...p, redCarded: true, onPitch: false };
        if (p.id === third!.id) return { ...p, position: redCarded!.position };
        return p;
      }),
    });

    const result = applyRosterReposition(state, 'home', active!.id, redCarded!.id);
    expect(result).toEqual({ ok: false, reason: 'REPOSITION_SLOT_OCCUPIED' });
    // No partial mutation — pieces array unchanged.
    expect(state.pieces.find((p) => p.id === active!.id)!.position).toEqual(active!.position);
    expect(state.pieces.find((p) => p.id === redCarded!.id)!.position).toEqual(redCarded!.position);
  });

  it('case 2: rejects with REPOSITION_SLOT_OCCUPIED when the third piece on the frozen hex belongs to the OPPONENT', () => {
    const [active, redCarded] = homeOutfielders();
    const [oppThird] = awayOutfielders();
    const state = makeState({
      pieces: BASE_PIECES.map((p) => {
        if (p.id === redCarded!.id) return { ...p, redCarded: true, onPitch: false };
        if (p.id === oppThird!.id) return { ...p, position: redCarded!.position };
        return p;
      }),
    });

    const result = applyRosterReposition(state, 'home', active!.id, redCarded!.id);
    expect(result).toEqual({ ok: false, reason: 'REPOSITION_SLOT_OCCUPIED' });
  });

  it('case 3: an INACTIVE third piece (itself red-carded/off-pitch) on the frozen hex never blocks the swap', () => {
    const [active, redCarded, third] = homeOutfielders();
    const state = makeState({
      pieces: BASE_PIECES.map((p) => {
        if (p.id === redCarded!.id) return { ...p, redCarded: true, onPitch: false };
        if (p.id === third!.id)
          return { ...p, redCarded: true, onPitch: false, position: redCarded!.position };
        return p;
      }),
    });

    const result = applyRosterReposition(state, 'home', active!.id, redCarded!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    assertNoActivePieceStacking(result.state.pieces);
  });

  it('case 4 (D-05 preserved): repositioning into a red-carded slot succeeds when its frozen hex is free', () => {
    const [active, redCarded] = homeOutfielders();
    const state = makeState({
      pieces: BASE_PIECES.map((p) =>
        p.id === redCarded!.id ? { ...p, redCarded: true, onPitch: false } : p,
      ),
    });

    const result = applyRosterReposition(state, 'home', active!.id, redCarded!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const newRedCardSlot = result.state.pieces.find((p) => p.id === redCarded!.id)!;
    expect(newRedCardSlot.playerId).toBe(active!.playerId);
    expect(newRedCardSlot.position).toEqual(redCarded!.position);
    assertNoActivePieceStacking(result.state.pieces);
  });

  it('case 5: two ordinary active pieces swapped still succeeds — the new guard is unreachable for them', () => {
    const [a, b] = homeOutfielders();
    const state = makeState();

    const result = applyRosterReposition(state, 'home', a!.id, b!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    assertNoActivePieceStacking(result.state.pieces);
  });
});
