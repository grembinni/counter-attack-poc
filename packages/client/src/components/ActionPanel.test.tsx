import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ActionPanel } from './ActionPanel.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: { ...mockMovementState, phase: 'MOVEMENT', activeTeam: 'home', lastDiceRoll: null },
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1,
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

describe('ActionPanel — UNDO-03: active player gating', () => {
  it('renders null for the non-active player', () => {
    useGameStore.setState({ playerSlot: 2 });
    const { container } = render(<ActionPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders controls for the active player', () => {
    render(<ActionPanel />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeDefined();
  });
});

describe('ActionPanel — UNDO-02: undo disabled when dice rolled', () => {
  it('Undo button is enabled when lastDiceRoll is null', () => {
    render(<ActionPanel />);
    const undo = screen.getByRole('button', { name: /undo/i });
    expect((undo as HTMLButtonElement).disabled).toBe(false);
  });

  it('Undo button is disabled when lastDiceRoll is set', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVEMENT',
        activeTeam: 'home',
        lastDiceRoll: { rolls: [4], context: 'SHOT_DUEL' },
      },
    });
    render(<ActionPanel />);
    const undo = screen.getByRole('button', { name: /undo/i });
    expect((undo as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ActionPanel — UNDO-03: opponent sees no undo button', () => {
  it('queryByRole returns null for undo when playerSlot is 2 and activeTeam is home', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(<ActionPanel />);
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });
});

describe('ActionPanel — UNDO-01: clicking Undo emits game:undo', () => {
  it('calls emitUndo when Undo button clicked', () => {
    const emitUndo = vi.fn();
    useGameStore.setState({ emitUndo });
    render(<ActionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(emitUndo).toHaveBeenCalledOnce();
  });
});

describe('ActionPanel — Roll button for PASS phase', () => {
  it('shows Roll Dice button during PASS phase for active player', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', activeTeam: 'home' },
    });
    render(<ActionPanel />);
    expect(screen.getByRole('button', { name: /roll dice/i })).toBeDefined();
  });

  it('calls emitRoll when Roll Dice clicked', () => {
    const emitRoll = vi.fn();
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', activeTeam: 'home' },
      emitRoll,
    });
    render(<ActionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /roll dice/i }));
    expect(emitRoll).toHaveBeenCalledOnce();
  });
});

describe('ActionPanel — Start Movement button for KICK_OFF phase', () => {
  it('shows Start Movement button during KICK_OFF phase for active player', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'KICK_OFF', activeTeam: 'home' },
    });
    render(<ActionPanel />);
    expect(screen.getByRole('button', { name: /start movement/i })).toBeDefined();
  });
});
