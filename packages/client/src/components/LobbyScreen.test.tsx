import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { LobbyScreen } from './LobbyScreen.js';

// Typed mock module shape
type MockSocket = {
  emit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  connected: boolean;
};

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connected: false } as MockSocket,
}));

afterEach(() => cleanup());

describe('LobbyScreen — CONN-02: Enter key triggers room join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.setState({
      gameState: mockMovementState,
      screen: 'JOIN_ROOM',
      selectedPieceId: null,
      validMoveHexes: [],
      playerSlot: null,
      roomCode: null,
      disconnectWarning: false,
      roomError: null,
      gameError: null,
    });
  });

  it('Enter key in input calls socket.emit ROOM_JOIN', async () => {
    const socketMod = await import('../socket.js');
    const mockSocket = socketMod.socket as unknown as MockSocket;
    render(<LobbyScreen />);
    const input = screen.getByPlaceholderText(/room code/i);
    fireEvent.change(input, { target: { value: 'ABC12' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(mockSocket.emit).toHaveBeenCalledWith('room:join', 'ABC12');
  });

  it('Join button disables after click (isJoining = true)', () => {
    render(<LobbyScreen />);
    const input = screen.getByPlaceholderText(/room code/i);
    fireEvent.change(input, { target: { value: 'ABC12' } });
    const btn = screen.getByRole('button', { name: /join game/i });
    fireEvent.click(btn);
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.textContent).toMatch(/joining/i);
  });

  it('Join button re-enables when roomError arrives', () => {
    render(<LobbyScreen />);
    const input = screen.getByPlaceholderText(/room code/i);
    fireEvent.change(input, { target: { value: 'ABC12' } });
    fireEvent.click(screen.getByRole('button', { name: /join game/i }));
    // Simulate server error arriving
    act(() => {
      useGameStore.setState({ roomError: 'NOT_FOUND' });
    });
    // After roomError, isJoining resets → button text reverts and re-enables
    const btn = screen.getByRole('button', { name: /join game/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('empty input does not emit ROOM_JOIN and button stays disabled', async () => {
    const socketMod = await import('../socket.js');
    const mockSocket = socketMod.socket as unknown as MockSocket;
    render(<LobbyScreen />);
    // Do not type anything — input is empty
    const btn = screen.getByRole('button', { name: /join game/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});
