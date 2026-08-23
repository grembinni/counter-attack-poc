/**
 * Phase 43 Plan 02, Task 3 — TACKLE_STEAL_PROMPT/TACKLE_STEAL_DECLINED registration
 * checklist regression suite.
 *
 * STATE.md v1.6 pitfall (already shipped twice as BUG-30/31 and BUG-37): "new dice-roll
 * event types are invisible to Undo/Replay unless registered in every relevant list
 * (isBoundary server + client mirror, REPLAY_ELIGIBLE_TYPES, PHASE_LABEL, STOPPAGE_PHASES)."
 * 43-RESEARCH.md Pitfall 6 lists six checklist sites a new GamePhase/ActionEventType pair
 * must be run through. This suite is the future-reader's single grep target for the
 * `TACKLE_STEAL_PROMPT`/`TACKLE_STEAL_DECLINED` pair's registration status at each site:
 *
 *   1. `ActionEventType` union (packages/shared/src/types.ts)         — REGISTERED (43-01)
 *   2. `formatEvent` switch (packages/client/src/components/ActionLog.tsx) — REGISTERED (43-02)
 *   3. `REPLAY_ELIGIBLE_TYPES` (gameEngine.ts)                        — DELIBERATELY EXCLUDED (43-02)
 *      — TACKLE_STEAL_DECLINED carries no `ballAfter`, matching GK_DIVE_AT_FEET_DECLINED.
 *   4. `applyUndo`'s `isBoundary` disjunction (gameEngine.ts)         — DELIBERATELY EXCLUDED (43-02)
 *      — a decline commits no dice outcome and must remain crossable by Undo; the resolved
 *        TACKLE_ATTEMPT/STEAL_ATTEMPT terms already cover the attempt path unconditionally.
 *   5. `PHASE_LABEL` (packages/client/src/components/GameBoard.tsx)   — REGISTERED (43-01)
 *   6. `STOPPAGE_PHASES` (packages/shared/src/stoppagePhases.ts)      — DELIBERATELY EXCLUDED (43-01)
 *      — TACKLE_STEAL_PROMPT is a mid-duel decision prompt, not a stoppage.
 *
 * No `vi.mock('../diceUtils.js')` anywhere in this file — mirrors gameEngine.undoReplay39
 * .test.ts's no-dice-mock convention (no dice are rolled by any behaviour under test here).
 */

import { describe, it, expect } from 'vitest';
import { applyUndo, applyFreeMoveZoneCheck, REPLAY_ELIGIBLE_TYPES } from '../gameEngine.js';
import { isStoppagePhase } from '@counter-attack/shared';
import type { ActionEvent, GameState, HexCoord, PlayerPiece } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Shared fixtures — compact piece/state factories, mirroring
// gameEngine.undoReplay39.test.ts's `piece()`/`baseState()` pattern.
// ---------------------------------------------------------------------------

function piece(
  id: string,
  teamId: 'home' | 'away',
  position: HexCoord,
  over: Partial<PlayerPiece> = {},
): PlayerPiece {
  return {
    id,
    teamId,
    position,
    firstName: teamId === 'home' ? 'Home' : 'Away',
    lastName: id.toUpperCase(),
    number: 9,
    nationality: 'Test',
    role: 'FWD',
    pace: 6,
    shooting: 4,
    tackling: 4,
    dribbling: 4,
    saving: 1,
    handling: 1,
    resilience: 4,
    aerialAbility: 4,
    highPass: 4,
    ...over,
  };
}

function baseState(pieces: PlayerPiece[], over: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'UNDOREPLAY43',
    phase: 'MOVE',
    activeTeam: 'home',
    attackingTeam: 'home',
    pieces,
    ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 10,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 4 },
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
    gameSpeed: 'standard',
    foulsEnabled: true,
    injuryEnabled: true,
    bookingEnabled: true,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Checklist site 3: REPLAY_ELIGIBLE_TYPES deliberate exclusion.
// ---------------------------------------------------------------------------

describe('Phase 43 registration checklist — TACKLE_STEAL_PROMPT / TACKLE_STEAL_DECLINED', () => {
  it('REPLAY_ELIGIBLE_TYPES does NOT include TACKLE_STEAL_DECLINED (no ballAfter field)', () => {
    expect(REPLAY_ELIGIBLE_TYPES.has('TACKLE_STEAL_DECLINED')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Checklist site 4: applyUndo's isBoundary disjunction deliberate exclusion —
  // Undo must cross a TACKLE_STEAL_DECLINED event exactly like it crosses any other
  // non-boundary event.
  // -------------------------------------------------------------------------

  it('applyUndo crosses a TACKLE_STEAL_DECLINED event: two successive undos reverse both MOVEs', () => {
    const mover = piece('home-mover', 'home', { q: 16, r: 13 });
    const eventLog: ActionEvent[] = [
      {
        type: 'KICK_OFF',
        timestamp: 0,
        ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
      },
      {
        type: 'MOVE',
        pieceId: 'home-mover',
        from: { q: 14, r: 13 },
        to: { q: 15, r: 13 },
        slot: 'ATTACKER_4',
        timestamp: 1,
        ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
      },
      {
        type: 'TACKLE_STEAL_DECLINED',
        kind: 'STEAL',
        defenderId: 'away-defender',
        carrierId: 'home-mover',
        timestamp: 2,
      },
      {
        type: 'MOVE',
        pieceId: 'home-mover',
        from: { q: 15, r: 13 },
        to: { q: 16, r: 13 },
        slot: 'ATTACKER_4',
        timestamp: 3,
        ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
      },
    ];
    const state = baseState(
      [mover, piece('away-defender', 'away', { q: 17, r: 13 }, { tackling: 5 })],
      {
        phase: 'MOVE',
        eventLog,
        paceUsedByPieceId: { 'home-mover': 2 },
      },
    );

    // First undo: reverses the trailing MOVE (home-mover: 16,13 -> 15,13).
    const first = applyUndo(state);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstMover = first.state.pieces.find((p) => p.id === 'home-mover');
    expect(firstMover?.position).toEqual({ q: 15, r: 13 });
    // The decline event survives in the log — it is not itself undoable/removable.
    expect(first.state.eventLog.some((e) => e.type === 'TACKLE_STEAL_DECLINED')).toBe(true);

    // Second undo: crosses the surviving TACKLE_STEAL_DECLINED event and reverses the
    // earlier MOVE too (home-mover: 15,13 -> 14,13) — proving Undo is not blocked by it.
    const second = applyUndo(first.state);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const secondMover = second.state.pieces.find((p) => p.id === 'home-mover');
    expect(secondMover?.position).toEqual({ q: 14, r: 13 });
  });

  // -------------------------------------------------------------------------
  // Checklist site: ZONE_CHECK_EXEMPT_PHASES (part of the free-move zone-check
  // registration, alongside the six sites above — TACKLE-02's own dedicated
  // exemption, verified here per the plan's own acceptance criteria).
  // -------------------------------------------------------------------------

  it('applyFreeMoveZoneCheck leaves a TACKLE_STEAL_PROMPT state untouched even when the ball sits in a final third', () => {
    const state = baseState(
      [
        piece('home-mover', 'home', { q: 30, r: 7 }),
        piece('home-mid', 'home', { q: 5, r: 7 }),
        piece('away-gk', 'away', { q: 5, r: 8 }, { role: 'GK' }),
      ],
      {
        phase: 'TACKLE_STEAL_PROMPT',
        attackingTeam: 'home',
        ball: { position: { q: 30, r: 7 }, carrierId: 'home-mover', lastTouchedBy: null }, // awayThird
        ballZone: 'middle', // stale — would otherwise register a fresh final-third crossing
        movementSlot: null,
      },
    );

    const result = applyFreeMoveZoneCheck(state);

    // Exempt-phase early return: the state passes through completely unchanged, never
    // overlaying FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE on top of the prompt.
    expect(result).toBe(state);
    expect(result.phase).toBe('TACKLE_STEAL_PROMPT');
  });

  // -------------------------------------------------------------------------
  // Checklist site 6: STOPPAGE_PHASES deliberate exclusion — asserted here too (not
  // just in 43-01) since this is the file a future reader greps for the registration
  // checklist.
  // -------------------------------------------------------------------------

  it('isStoppagePhase(TACKLE_STEAL_PROMPT) is false — a mid-duel decision prompt, not a stoppage', () => {
    expect(isStoppagePhase('TACKLE_STEAL_PROMPT')).toBe(false);
  });
});
