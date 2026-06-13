/**
 * Phase 16 Wave 0 RED tests — SELECT-01, PLAY-01
 *
 * Tests the two-argument signature of buildInitialGameState(roomCode, selectedTeams).
 * The current production signature is buildInitialGameState(roomCode: string) — only
 * one argument. These tests MUST fail until plan 16-03 updates the engine signature.
 *
 * Do NOT add production code to make these pass in plan 16-01.
 */
import { describe, it, expect } from 'vitest';
import { buildInitialGameState } from '../gameEngine.js';

describe('buildInitialGameState(roomCode, selectedTeams) — SELECT-01, PLAY-01', () => {
  it('embeds selectedTeams in the returned GameState (SELECT-01, D-15, D-16)', () => {
    // The two-argument signature does not yet exist — this will fail until plan 16-03
    // @ts-expect-error — two-arg signature not yet present (Wave 0 RED state)
    const state = buildInitialGameState('ROOM1', { home: 'cosmos', away: 'xolos' });
    expect(state.selectedTeams).toEqual({ home: 'cosmos', away: 'xolos' });
  });

  it('returns 22 pieces (11 home + 11 away) when selectedTeams are provided (PLAY-01)', () => {
    // @ts-expect-error — two-arg signature not yet present (Wave 0 RED state)
    const state = buildInitialGameState('ROOM1', { home: 'cosmos', away: 'xolos' });
    expect(state.pieces).toHaveLength(22);
  });

  it('home pieces have ids starting with "home-" (PLAY-01)', () => {
    // @ts-expect-error — two-arg signature not yet present (Wave 0 RED state)
    const state = buildInitialGameState('ROOM1', { home: 'cosmos', away: 'xolos' });
    const homePieces = state.pieces.filter((p: { id: string }) => p.id.startsWith('home-'));
    expect(homePieces).toHaveLength(11);
  });

  it('away pieces have ids starting with "away-" (PLAY-01)', () => {
    // @ts-expect-error — two-arg signature not yet present (Wave 0 RED state)
    const state = buildInitialGameState('ROOM1', { home: 'cosmos', away: 'xolos' });
    const awayPieces = state.pieces.filter((p: { id: string }) => p.id.startsWith('away-'));
    expect(awayPieces).toHaveLength(11);
  });

  it('at least one away piece position has q > 18 (mirrored to away half — SELECT-01, D-16)', () => {
    // q_away = 36 - q_home; home positions are in range q=[1..18], so away must be q=[18..35]
    // @ts-expect-error — two-arg signature not yet present (Wave 0 RED state)
    const state = buildInitialGameState('ROOM1', { home: 'cosmos', away: 'xolos' });
    const awayPieces = state.pieces.filter((p: { id: string }) => p.id.startsWith('away-'));
    const hasAwayHalfPosition = awayPieces.some(
      (p: { position: { q: number } }) => p.position.q > 18,
    );
    expect(hasAwayHalfPosition, 'at least one away piece is in the away half (q > 18)').toBe(true);
  });
});
