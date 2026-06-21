import type { GameState } from '@counter-attack/shared';
import { mockShotState } from './mockShotState.js';

/**
 * Mock GameState for GK_RESTART phase.
 * A goal was scored; away GK takes a restart from the goal hex.
 * lastDiceRoll populated to test TurnIndicator and ActionLog dice display.
 * D-11: Exported for testing GK-restart-phase UI panels.
 */
export const mockGKRestartState: GameState = {
  ...mockShotState,
  phase: 'GK_RESTART',
  actionCount: 6,
  activeTeam: 'away',
  attackingTeam: 'away',
  score: { home: 1, away: 0 },
  ball: { position: { q: 36, r: 13 }, carrierId: 'away-0' },
  pieces: mockShotState.pieces.map((p) =>
    p.id === 'away-0' ? { ...p, position: { q: 36, r: 13 } } : p,
  ),
  lastDiceRoll: { rolls: [4, 3], context: 'SHOT_DUEL' },
  eventLog: [
    ...mockShotState.eventLog,
    {
      type: 'DICE_ROLL',
      result: 4,
      timestamp: Date.now(),
      ballAfter: { position: { q: 36, r: 13 }, carrierId: null },
    },
    {
      type: 'GOAL',
      scoringTeam: 'home',
      scorerId: 'home-9',
      timestamp: Date.now(),
      ballAfter: { position: { q: 36, r: 13 }, carrierId: null },
    },
  ],
};
