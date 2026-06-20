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
    gameState: { ...mockMovementState, phase: 'MOVE', activeTeam: 'home', lastDiceRoll: null },
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1,
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
    selectedPassType: null,
    passTargetHex: null,
  });
});

describe('ActionPanel — UNDO-03: active player gating', () => {
  it('renders waiting panel for the non-active player', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(<ActionPanel />);
    expect(screen.getByText('Waiting for Opponent.')).toBeDefined();
  });

  it('renders controls for the active player', () => {
    render(<ActionPanel />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeDefined();
  });
});

describe('ActionPanel — UNDO-02: undo disabled when dice rolled', () => {
  it('Undo button is enabled when lastDiceRoll is null', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        eventLog: [
          {
            type: 'MOVE',
            pieceId: 'home-9',
            from: { q: 14, r: 13 },
            to: { q: 15, r: 13 },
            slot: 'ATTACKER_4',
            timestamp: 0,
            ballAfter: { position: { q: 15, r: 13 }, carrierId: 'home-9' },
          },
        ],
      },
    });
    render(<ActionPanel />);
    const undo = screen.getByRole('button', { name: /undo/i });
    expect((undo as HTMLButtonElement).disabled).toBe(false);
  });

  it('Undo button is disabled when lastDiceRoll is set', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
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
    useGameStore.setState({
      emitUndo,
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        eventLog: [
          {
            type: 'MOVE',
            pieceId: 'home-9',
            from: { q: 14, r: 13 },
            to: { q: 15, r: 13 },
            slot: 'ATTACKER_4',
            timestamp: 0,
            ballAfter: { position: { q: 15, r: 13 }, carrierId: 'home-9' },
          },
        ],
      },
    });
    render(<ActionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(emitUndo).toHaveBeenCalledOnce();
  });
});

describe('ActionPanel — FIRST_TIME_PASS_MOVE panel', () => {
  const ftpBaseState = {
    ...mockMovementState,
    phase: 'FIRST_TIME_PASS_MOVE' as const,
    activeTeam: 'home' as const,
    lastDiceRoll: null,
  };

  it('active player sees helper text and both Undo and End Turn buttons', () => {
    useGameStore.setState({
      gameState: ftpBaseState,
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('First-time pass!')).toBeDefined();
    expect(screen.getByText('Move 1 player to receive the ball.')).toBeDefined();
    expect(screen.getByRole('button', { name: /undo/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /end turn/i })).toBeDefined();
  });

  it('Undo is disabled when no FTP_REPOSITION event in log', () => {
    useGameStore.setState({
      gameState: {
        ...ftpBaseState,
        eventLog: [],
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const undo = screen.getByRole('button', { name: /undo/i });
    expect((undo as HTMLButtonElement).disabled).toBe(true);
  });

  it('Undo is enabled when last event is FTP_REPOSITION followed by a real FTP_MOVE', () => {
    // CR-01 (17.1-11): use the real FTP_MOVE shape gameHandlers.ts emits during
    // FIRST_TIME_PASS_MOVE — a fabricated MOVE event here would mask the canUndo bug.
    useGameStore.setState({
      gameState: {
        ...ftpBaseState,
        eventLog: [
          {
            type: 'FTP_REPOSITION',
            slot: 'ATTACKER',
            pieceId: null,
            timestamp: 1,
          },
          {
            type: 'FTP_MOVE',
            slot: 'ATTACKER',
            pieceId: 'home-9',
            from: { q: 14, r: 13 },
            to: { q: 15, r: 13 },
            timestamp: 2,
          },
        ],
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const undo = screen.getByRole('button', { name: /undo/i });
    expect((undo as HTMLButtonElement).disabled).toBe(false);
  });

  it('non-active player sees the waiting panel', () => {
    useGameStore.setState({
      gameState: ftpBaseState,
      playerSlot: 2, // away player — home is active
    });
    render(<ActionPanel />);
    expect(screen.getByText('Waiting for Opponent.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });
});

describe('ActionPanel — FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE panels (Phase 17 MOVE-06, corrected design)', () => {
  const freeMoveAttackBaseState = {
    ...mockMovementState,
    phase: 'FREE_MOVE_ATTACK' as const,
    activeTeam: 'home' as const,
    lastDiceRoll: null,
    freeMoveEligibleIds: { attack: ['home-9'], defense: [] },
    freeMoveUsedPace: {},
  };

  const freeMoveDefenseBaseState = {
    ...freeMoveAttackBaseState,
    phase: 'FREE_MOVE_DEFENSE' as const,
    activeTeam: 'away' as const,
    freeMoveEligibleIds: { attack: [], defense: ['away-0'] },
  };

  it('active player sees the Free Move helper text (attacking team) and an End Turn button', () => {
    useGameStore.setState({
      gameState: freeMoveAttackBaseState,
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Free Move!')).toBeDefined();
    expect(
      screen.getByText(/Attacking team.*move up to 6 hexes per player in the opponent's third\./i),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /end turn/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });

  it('active player sees the Free Move helper text (defending team) during FREE_MOVE_DEFENSE', () => {
    useGameStore.setState({
      gameState: freeMoveDefenseBaseState,
      playerSlot: 2, // away is active during FREE_MOVE_DEFENSE here
    });
    render(<ActionPanel />);
    expect(screen.getByText('Free Move!')).toBeDefined();
    expect(
      screen.getByText(/Defending team.*move up to 6 hexes per player in the opponent's third\./i),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /end turn/i })).toBeDefined();
  });

  it('clicking End Turn calls emitEndTurn during FREE_MOVE_ATTACK', () => {
    const emitEndTurn = vi.fn();
    useGameStore.setState({
      emitEndTurn,
      gameState: freeMoveAttackBaseState,
      playerSlot: 1,
    });
    render(<ActionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /end turn/i }));
    expect(emitEndTurn).toHaveBeenCalledOnce();
  });

  it('non-active player sees the waiting panel during FREE_MOVE_ATTACK', () => {
    useGameStore.setState({
      gameState: freeMoveAttackBaseState,
      playerSlot: 2, // away player — home is active
    });
    render(<ActionPanel />);
    expect(screen.getByText('Waiting for Opponent.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /end turn/i })).toBeNull();
  });

  it('non-active player sees the waiting panel during FREE_MOVE_DEFENSE', () => {
    useGameStore.setState({
      gameState: freeMoveDefenseBaseState,
      playerSlot: 1, // home player — away is active during FREE_MOVE_DEFENSE here
    });
    render(<ActionPanel />);
    expect(screen.getByText('Waiting for Opponent.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /end turn/i })).toBeNull();
  });
});

describe('ActionPanel — PASS phase pass-type selection flow', () => {
  it('shows target-hex prompt and Back button in step 2 (pass type selected, no target)', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', activeTeam: 'home' },
      selectedPassType: 'STANDARD_PASS',
      passTargetHex: null,
    });
    render(<ActionPanel />);
    expect(screen.getByText(/standard pass/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /back/i })).toBeDefined();
  });

  it('returns null in step 3 (target selected) because confirmPassTarget auto-emits', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', activeTeam: 'home' },
      selectedPassType: 'STANDARD_PASS',
      passTargetHex: { q: 6, r: 3 },
    });
    const { container } = render(<ActionPanel />);
    expect(container.firstChild).toBeNull();
  });
});
