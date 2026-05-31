import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { useGameStore } from './useGameStore.js';
import { mockMovementState } from '../mock/index.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: mockMovementState,
    screen: 'CREATE_ROOM',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: null,
    roomCode: null,
    disconnectWarning: false,
    roomError: null,
    gameError: null,
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

describe('useGameStore — Phase 7 setters', () => {
  it('setGameState replaces gameState wholesale', () => {
    const newState = { ...mockMovementState, phase: 'SHOT' as const };
    useGameStore.getState().setGameState(newState);
    expect(useGameStore.getState().gameState.phase).toBe('SHOT');
  });

  it('setPlayerSlot sets playerSlot', () => {
    useGameStore.getState().setPlayerSlot(2);
    expect(useGameStore.getState().playerSlot).toBe(2);
  });

  it('setRoomCode sets roomCode', () => {
    useGameStore.getState().setRoomCode('AB12');
    expect(useGameStore.getState().roomCode).toBe('AB12');
  });

  it('setDisconnectWarning sets disconnectWarning to true', () => {
    useGameStore.getState().setDisconnectWarning(true);
    expect(useGameStore.getState().disconnectWarning).toBe(true);
  });

  it('setRoomError sets roomError', () => {
    useGameStore.getState().setRoomError('NOT_FOUND');
    expect(useGameStore.getState().roomError).toBe('NOT_FOUND');
  });

  it('setRoomError clears roomError when null', () => {
    useGameStore.getState().setRoomError('NOT_FOUND');
    useGameStore.getState().setRoomError(null);
    expect(useGameStore.getState().roomError).toBeNull();
  });
});

describe('useGameStore — emit actions', () => {
  it('emitMove calls socket.emit with game:move, pieceId, hex and clears selection', () => {
    const targetHex = { q: 10, r: 5 };
    useGameStore.setState({ selectedPieceId: 'home-8', validMoveHexes: [targetHex] });
    useGameStore.getState().emitMove('home-8', targetHex);
    expect(emitMock).toHaveBeenCalledWith('game:move', 'home-8', targetHex);
    expect(useGameStore.getState().selectedPieceId).toBeNull();
    expect(useGameStore.getState().validMoveHexes).toHaveLength(0);
  });

  it('emitRoll calls socket.emit with game:roll', () => {
    useGameStore.getState().emitRoll();
    expect(emitMock).toHaveBeenCalledWith('game:roll');
  });

  it('emitEndTurn calls socket.emit with game:end-turn', () => {
    useGameStore.getState().emitEndTurn();
    expect(emitMock).toHaveBeenCalledWith('game:end-turn');
  });

  it('emitUndo calls socket.emit with game:undo', () => {
    useGameStore.getState().emitUndo();
    expect(emitMock).toHaveBeenCalledWith('game:undo');
  });

  it('emitGKRestart calls socket.emit with game:gk-restart and choice', () => {
    useGameStore.getState().emitGKRestart('kick');
    expect(emitMock).toHaveBeenCalledWith('game:gk-restart', 'kick');
  });

  it('emitStartMovement calls socket.emit with game:start-movement', () => {
    useGameStore.getState().emitStartMovement();
    expect(emitMock).toHaveBeenCalledWith('game:start-movement');
  });
});
