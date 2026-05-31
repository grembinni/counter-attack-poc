import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './useGameStore.js';
import { mockMovementState } from '../mock/index.js';

beforeEach(() => {
  useGameStore.setState({
    gameState: mockMovementState,
    selectedPieceId: null,
    validMoveHexes: [],
  });
});

describe('useGameStore — setScreen', () => {
  it('updates the screen field', () => {
    useGameStore.getState().setScreen('GAME_BOARD');
    expect(useGameStore.getState().screen).toBe('GAME_BOARD');
  });
});

describe('useGameStore — selectPiece', () => {
  it('sets selectedPieceId and populates validMoveHexes when a valid piece is selected', () => {
    useGameStore.getState().selectPiece('home-8');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('home-8');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('clears selectedPieceId and validMoveHexes when selecting the same piece twice (toggle)', () => {
    useGameStore.getState().selectPiece('home-8');
    useGameStore.getState().selectPiece('home-8');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toHaveLength(0);
  });

  it('does nothing if no piece with the given id exists', () => {
    useGameStore.getState().selectPiece('nonexistent-id');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toHaveLength(0);
  });
});

describe('useGameStore — movePiece', () => {
  it('updates piece position, clears selectedPieceId and validMoveHexes after a valid move', () => {
    useGameStore.getState().selectPiece('home-8');
    const beforeMove = useGameStore.getState();
    expect(beforeMove.validMoveHexes.length).toBeGreaterThan(0);

    const targetHex = beforeMove.validMoveHexes[0];
    if (!targetHex) throw new Error('No valid move hexes found — cannot test movePiece');

    useGameStore.getState().movePiece(targetHex);
    const afterMove = useGameStore.getState();

    const movedPiece = afterMove.gameState.pieces.find((p) => p.id === 'home-8');
    expect(movedPiece?.position).toEqual(targetHex);
    expect(afterMove.selectedPieceId).toBeNull();
    expect(afterMove.validMoveHexes).toHaveLength(0);
  });

  it('does nothing when selectedPieceId is null', () => {
    const before = useGameStore.getState();
    useGameStore.getState().movePiece({ q: 18, r: 13 });
    const after = useGameStore.getState();
    expect(after.gameState).toBe(before.gameState);
  });
});
