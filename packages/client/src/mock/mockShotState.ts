import type { GameState } from '@counter-attack/shared';
import { mockPassState } from './mockPassState.js';

/**
 * Mock GameState for SHOT phase.
 * Ball carrier (home-9) has advanced into the away penalty area and is shooting.
 * D-11: Exported for testing shot-phase UI panels.
 */
export const mockShotState: GameState = {
  ...mockPassState,
  phase: 'SHOT',
  actionCount: 5,
  ball: { position: { q: 33, r: 13 }, carrierId: 'home-9' },
  pieces: mockPassState.pieces.map((p) =>
    p.id === 'home-9' ? { ...p, position: { q: 33, r: 13 } } : p,
  ),
  eventLog: [
    ...mockPassState.eventLog,
    {
      type: 'MOVE',
      pieceId: 'home-9',
      from: { q: 15, r: 13 },
      to: { q: 33, r: 13 },
      slot: 'ATTACKER_4',
      timestamp: Date.now(),
      ballAfter: { position: { q: 33, r: 13 }, carrierId: 'home-9' },
    },
  ],
  lastDiceRoll: null,
  // MOVE-06 (Phase 17, corrected design): ball moved to {q:33,r:13} — awayThird.
  ballZone: 'away',
};
