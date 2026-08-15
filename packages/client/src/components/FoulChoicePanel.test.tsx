import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { FoulChoicePanel } from './FoulChoicePanel.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

afterEach(() => cleanup());

/** Seeds a FOUL_CHOICE-phase state. attackingTeam defaults to 'away' (the fouled side). */
function foulChoiceState(overrides: Partial<typeof mockMovementState> = {}) {
  return {
    ...mockMovementState,
    phase: 'FOUL_CHOICE' as const,
    attackingTeam: 'away' as const,
    foulDefenderId: 'home-1',
    foulVictimId: 'away-9',
    foulSource: 'TACKLE' as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: foulChoiceState(),
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 2, // away — the fouled/deciding side by default
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
    selectedPassType: null,
  });
});

describe('FoulChoicePanel — phase gating', () => {
  it('returns null when phase is not FOUL_CHOICE', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<FoulChoicePanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when playerSlot is null (useMyTeam returns null)', () => {
    useGameStore.setState({ gameState: foulChoiceState(), playerSlot: null });
    const { container } = render(<FoulChoicePanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('FoulChoicePanel — deciding manager (the fouled side)', () => {
  it('sees "Foul!", the victim name in the detail line, and both buttons', () => {
    useGameStore.setState({ gameState: foulChoiceState(), playerSlot: 2 });
    render(<FoulChoicePanel />);
    const victim = mockMovementState.pieces.find((p) => p.id === 'away-9')!;
    const victimName = victim.lastName
      ? `${victim.firstName} ${victim.lastName}`
      : victim.firstName;
    expect(screen.getByText('Foul!')).toBeDefined();
    expect(
      screen.getByText(`${victimName}'s side may continue play or take the restart.`),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /^continue play$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^take the free kick$/i })).toBeDefined();
  });

  it('"Continue Play" calls emitFoulChoice(\'continue\') exactly once', () => {
    useGameStore.setState({ gameState: foulChoiceState(), playerSlot: 2 });
    render(<FoulChoicePanel />);
    fireEvent.click(screen.getByRole('button', { name: /^continue play$/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_FOUL_CHOICE, 'continue');
  });

  it('"Take the Free Kick" calls emitFoulChoice(\'restart\') exactly once', () => {
    useGameStore.setState({ gameState: foulChoiceState(), playerSlot: 2 });
    render(<FoulChoicePanel />);
    fireEvent.click(screen.getByRole('button', { name: /^take the free kick$/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_FOUL_CHOICE, 'restart');
  });

  it('with foulSource GK_DIVE_AT_FEET, the second button reads "Take the Penalty" and still emits \'restart\'', () => {
    useGameStore.setState({
      gameState: foulChoiceState({ foulSource: 'GK_DIVE_AT_FEET' }),
      playerSlot: 2,
    });
    render(<FoulChoicePanel />);
    expect(screen.queryByRole('button', { name: /^take the free kick$/i })).toBeNull();
    const penaltyBtn = screen.getByRole('button', { name: /^take the penalty$/i });
    expect(penaltyBtn.textContent).toBe('Take the Penalty');
    fireEvent.click(penaltyBtn);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_FOUL_CHOICE, 'restart');
  });

  it('falls back to the raw foulVictimId when the piece is missing (never renders undefined)', () => {
    useGameStore.setState({
      gameState: foulChoiceState({ foulVictimId: 'not-a-real-piece' }),
      playerSlot: 2,
    });
    render(<FoulChoicePanel />);
    expect(
      screen.getByText("not-a-real-piece's side may continue play or take the restart."),
    ).toBeDefined();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it('39-18: foulDuelSucceeded true hides Continue Play but still renders the restart button', () => {
    useGameStore.setState({
      gameState: foulChoiceState({ foulDuelSucceeded: true }),
      playerSlot: 2,
    });
    render(<FoulChoicePanel />);
    expect(screen.queryByText('Continue Play')).toBeNull();
    expect(screen.getByRole('button', { name: /^take the free kick$/i })).toBeDefined();
  });

  it('39-18: foulDuelSucceeded false still renders both buttons (guards against over-suppression)', () => {
    useGameStore.setState({
      gameState: foulChoiceState({ foulDuelSucceeded: false }),
      playerSlot: 2,
    });
    render(<FoulChoicePanel />);
    expect(screen.getByRole('button', { name: /^continue play$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^take the free kick$/i })).toBeDefined();
  });

  it('renders a humanised gameError in the error row', () => {
    useGameStore.setState({
      gameState: foulChoiceState(),
      playerSlot: 2,
      gameError: 'WRONG_TEAM',
    });
    render(<FoulChoicePanel />);
    expect(screen.queryByText('WRONG_TEAM')).toBeNull();
    expect(screen.getByText(restartErrorMessage('WRONG_TEAM') ?? '')).toBeDefined();
  });
});

describe('FoulChoicePanel — non-deciding manager', () => {
  it('sees the waiting text and no buttons', () => {
    useGameStore.setState({ gameState: foulChoiceState(), playerSlot: 1 }); // home, not the fouled side
    render(<FoulChoicePanel />);
    expect(screen.getByText('Foul!')).toBeDefined();
    expect(screen.getByText(/Attacking team is deciding whether to continue play/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
