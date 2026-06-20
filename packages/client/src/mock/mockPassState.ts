import type { GameState } from '@counter-attack/shared';
import { mockMovementState } from './mockMovementState.js';

/**
 * Mock GameState for PASS phase.
 * Ball carrier (home-9) has moved to {q:15, r:13} and is ready to pass.
 * D-11: Exported as a named constant for testing pass-phase UI panels.
 */
export const mockPassState: GameState = {
  ...mockMovementState,
  phase: 'PASS',
  actionCount: 4,
  movementSlot: null,
  ball: { position: { q: 15, r: 13 }, carrierId: 'home-9' },
  pieces: mockMovementState.pieces.map((p) =>
    p.id === 'home-9' ? { ...p, position: { q: 15, r: 13 } } : p,
  ),
  movedPieceIds: ['home-9'],
  paceUsedByPieceId: { 'home-9': 1 },
  eventLog: [
    {
      type: 'MOVE',
      pieceId: 'home-9',
      from: { q: 14, r: 13 },
      to: { q: 15, r: 13 },
      slot: 'ATTACKER_4',
      timestamp: Date.now(),
      ballAfter: { position: { q: 15, r: 13 }, carrierId: 'home-9' },
    },
  ],
  lastDiceRoll: null,
};
