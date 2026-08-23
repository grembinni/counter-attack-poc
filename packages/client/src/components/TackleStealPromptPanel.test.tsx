import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { TackleStealPromptPanel } from './TackleStealPromptPanel.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

afterEach(() => cleanup());

/**
 * Seeds a TACKLE_STEAL_PROMPT-phase state. attackingTeam defaults to 'away' (the ball
 * carrier's side); tackleStealPromptTeam defaults to 'home' (the defending/deciding side) —
 * this is the STEAL case, where the decider is deliberately NOT the active/attacking team.
 */
function tackleStealPromptState(overrides: Partial<typeof mockMovementState> = {}) {
  return {
    ...mockMovementState,
    phase: 'TACKLE_STEAL_PROMPT' as const,
    attackingTeam: 'away' as const,
    tackleStealPromptTeam: 'home' as const,
    tackleStealPromptKind: 'STEAL' as const,
    tackleStealPromptDefenderId: 'home-1',
    tackleStealPromptCarrierId: 'away-9',
    tackleStealPromptQueue: [] as readonly string[],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: tackleStealPromptState(),
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1, // home — the deciding side by default
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
    selectedPassType: null,
  });
});

describe('TackleStealPromptPanel — phase gating', () => {
  it('returns null when phase is not TACKLE_STEAL_PROMPT', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<TackleStealPromptPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when playerSlot is null (useMyTeam returns null)', () => {
    useGameStore.setState({ gameState: tackleStealPromptState(), playerSlot: null });
    const { container } = render(<TackleStealPromptPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('TackleStealPromptPanel — the defending manager (deciding)', () => {
  it('sees "Challenge for the Ball?" and both buttons', () => {
    useGameStore.setState({ gameState: tackleStealPromptState(), playerSlot: 1 });
    render(<TackleStealPromptPanel />);
    expect(screen.getByText('Challenge for the Ball?')).toBeDefined();
    expect(screen.getByRole('button', { name: /^attempt$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^decline$/i })).toBeDefined();
  });

  it('renders the defender and carrier names in the detail line', () => {
    useGameStore.setState({ gameState: tackleStealPromptState(), playerSlot: 1 });
    render(<TackleStealPromptPanel />);
    const defender = mockMovementState.pieces.find((p) => p.id === 'home-1')!;
    const carrier = mockMovementState.pieces.find((p) => p.id === 'away-9')!;
    const defenderName = defender.lastName
      ? `${defender.firstName} ${defender.lastName}`
      : defender.firstName;
    const carrierName = carrier.lastName
      ? `${carrier.firstName} ${carrier.lastName}`
      : carrier.firstName;
    expect(
      screen.getByText(`${defenderName} can challenge ${carrierName} for the ball — attempt it?`),
    ).toBeDefined();
  });

  it('"Attempt" calls emitTackleStealChoice(true)', () => {
    useGameStore.setState({ gameState: tackleStealPromptState(), playerSlot: 1 });
    render(<TackleStealPromptPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^attempt$/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_TACKLE_STEAL_CHOICE, true);
  });

  it('"Decline" calls emitTackleStealChoice(false)', () => {
    useGameStore.setState({ gameState: tackleStealPromptState(), playerSlot: 1 });
    render(<TackleStealPromptPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_TACKLE_STEAL_CHOICE, false);
  });

  it('the queue qualifier is absent when tackleStealPromptQueue is empty', () => {
    useGameStore.setState({
      gameState: tackleStealPromptState({ tackleStealPromptQueue: [] }),
      playerSlot: 1,
    });
    render(<TackleStealPromptPanel />);
    expect(screen.queryByText(/more defenders? can challenge after this/)).toBeNull();
  });

  it('the queue qualifier is singular when tackleStealPromptQueue has one entry', () => {
    useGameStore.setState({
      gameState: tackleStealPromptState({ tackleStealPromptQueue: ['home-2'] }),
      playerSlot: 1,
    });
    render(<TackleStealPromptPanel />);
    expect(screen.getByText(/\(1 more defender can challenge after this\)/)).toBeDefined();
  });

  it('the queue qualifier is plural when tackleStealPromptQueue has more than one entry', () => {
    useGameStore.setState({
      gameState: tackleStealPromptState({ tackleStealPromptQueue: ['home-2', 'home-3'] }),
      playerSlot: 1,
    });
    render(<TackleStealPromptPanel />);
    expect(screen.getByText(/\(2 more defenders can challenge after this\)/)).toBeDefined();
  });

  it('renders a humanised gameError in the error row', () => {
    useGameStore.setState({
      gameState: tackleStealPromptState(),
      playerSlot: 1,
      gameError: 'WRONG_TEAM',
    });
    render(<TackleStealPromptPanel />);
    expect(screen.queryByText('WRONG_TEAM')).toBeNull();
    expect(screen.getByText(restartErrorMessage('WRONG_TEAM') ?? '')).toBeDefined();
  });
});

describe('TackleStealPromptPanel — the attacking manager (non-deciding)', () => {
  it('sees "is deciding whether to challenge…" and zero buttons', () => {
    useGameStore.setState({ gameState: tackleStealPromptState(), playerSlot: 2 }); // away, carrier's side
    render(<TackleStealPromptPanel />);
    expect(screen.getByText('Challenge for the Ball?')).toBeDefined();
    expect(screen.getByText(/is deciding whether to challenge/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
