import { create } from 'zustand';
import type { GameState, HexCoord } from '@counter-attack/shared';
import { validateMove, hexesInRange } from '@counter-attack/shared';
import { mockMovementState } from '../mock/index.js';

/** Screen states for client-side routing (D-12). No React Router — screen field in store. */
export type Screen = 'CREATE_ROOM' | 'JOIN_ROOM' | 'WAITING' | 'GAME_BOARD';

/** Zustand store shape for the Counter Attack game client. */
export type GameStore = {
  gameState: GameState;
  screen: Screen;
  selectedPieceId: string | null;
  validMoveHexes: HexCoord[];
  /** Navigate to a different screen (D-12). */
  setScreen: (s: Screen) => void;
  /**
   * Select or deselect a piece. Toggles off if already selected (D-07).
   * Computes valid move destinations via hexesInRange + validateMove (client-side, D-07).
   * Uses hexesInRange(piece.position, piece.pace) to limit candidates — never iterates all 962 PITCH_HEXES.
   */
  selectPiece: (id: string) => void;
  /**
   * Move the currently selected piece to targetHex. No-op if no piece is selected.
   * Updates piece position in gameState.pieces (local mock mutation, D-10).
   * Phase 7 replaces local mutation with server-broadcast update path (D-08).
   */
  movePiece: (targetHex: HexCoord) => void;
};

/**
 * Zustand 4.x store using curried TypeScript form: create<T>()((set, get) => ...).
 * Required for correct TypeScript type inference in Zustand 4 (Pitfall 1 from RESEARCH.md).
 * Initial state uses mockMovementState (D-10, D-11).
 */
export const useGameStore = create<GameStore>()((set, get) => ({
  gameState: mockMovementState,
  screen: 'CREATE_ROOM',
  selectedPieceId: null,
  validMoveHexes: [],

  setScreen: (s) => set({ screen: s }),

  selectPiece: (id) => {
    const { gameState, selectedPieceId } = get();
    // Toggle off if the same piece is clicked again
    if (selectedPieceId === id) {
      set({ selectedPieceId: null, validMoveHexes: [] });
      return;
    }
    const piece = gameState.pieces.find((p) => p.id === id);
    if (!piece) return;
    // Use hexesInRange to limit candidates — never iterate all 962 PITCH_HEXES (D-07, Pitfall 7)
    const candidates = hexesInRange(piece.position, piece.pace);
    const valid = candidates.filter((hex) => validateMove(gameState, piece, hex).ok);
    set({ selectedPieceId: id, validMoveHexes: valid });
  },

  movePiece: (targetHex) => {
    const { gameState, selectedPieceId } = get();
    if (!selectedPieceId) return;
    const updatedPieces = gameState.pieces.map((p) =>
      p.id === selectedPieceId ? { ...p, position: targetHex } : p,
    );
    set({
      gameState: { ...gameState, pieces: updatedPieces },
      selectedPieceId: null,
      validMoveHexes: [],
    });
  },
}));
