/**
 * Phase 16 Wave 0 RED tests — SELECT-01, PLAY-01
 *
 * Tests the four-argument signature of buildInitialGameState(roomCode, selectedTeams, gameSpeed, selectedUniformStyles).
 * Updated in Phase 22 plan 22-01 to pass the required 4th argument (selectedUniformStyles).
 */
import { describe, it, expect } from 'vitest';
import type { UniformStyleId } from '@counter-attack/shared';
import { buildInitialGameState } from '../gameEngine.js';

// Phase 22 D-17: default uniform styles for test call sites.
const DEFAULT_STYLES: { home: UniformStyleId; away: UniformStyleId } = {
  home: 'pinstripes-vertical',
  away: 'bar-diagonal',
};

describe('buildInitialGameState(roomCode, selectedTeams) — SELECT-01, PLAY-01', () => {
  it('embeds selectedTeams in the returned GameState (SELECT-01, D-15, D-16)', () => {
    const state = buildInitialGameState('ROOM1', { home: 'city', away: 'crew' }, 'standard', DEFAULT_STYLES);
    expect(state.selectedTeams).toEqual({ home: 'city', away: 'crew' });
  });

  it('returns 22 pieces (11 home + 11 away) when selectedTeams are provided (PLAY-01)', () => {
    const state = buildInitialGameState('ROOM1', { home: 'city', away: 'crew' }, 'standard', DEFAULT_STYLES);
    expect(state.pieces).toHaveLength(22);
  });

  it('home pieces have ids starting with "home-" (PLAY-01)', () => {
    const state = buildInitialGameState('ROOM1', { home: 'city', away: 'crew' }, 'standard', DEFAULT_STYLES);
    const homePieces = state.pieces.filter((p) => p.id.startsWith('home-'));
    expect(homePieces).toHaveLength(11);
  });

  it('away pieces have ids starting with "away-" (PLAY-01)', () => {
    const state = buildInitialGameState('ROOM1', { home: 'city', away: 'crew' }, 'standard', DEFAULT_STYLES);
    const awayPieces = state.pieces.filter((p) => p.id.startsWith('away-'));
    expect(awayPieces).toHaveLength(11);
  });

  it('at least one away piece position has q > 18 (mirrored to away half — SELECT-01, D-16)', () => {
    // q_away = 36 - q_home; home positions are in range q=[1..18], so away must be q=[18..35]
    const state = buildInitialGameState('ROOM1', { home: 'city', away: 'crew' }, 'standard', DEFAULT_STYLES);
    const awayPieces = state.pieces.filter((p) => p.id.startsWith('away-'));
    const hasAwayHalfPosition = awayPieces.some((p) => p.position.q > 18);
    expect(hasAwayHalfPosition, 'at least one away piece is in the away half (q > 18)').toBe(true);
  });
});
