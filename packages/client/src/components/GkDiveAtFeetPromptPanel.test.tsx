import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { GkDiveAtFeetPromptPanel } from './GkDiveAtFeetPromptPanel.js';
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
 * Seeds a GK_DIVE_AT_FEET_PROMPT-phase state. attackingTeam defaults to 'away' (the ball
 * carrier's side); gkDiveAtFeetTeam defaults to 'home' (the GK's/deciding side).
 */
function diveAtFeetState(overrides: Partial<typeof mockMovementState> = {}) {
  return {
    ...mockMovementState,
    phase: 'GK_DIVE_AT_FEET_PROMPT' as const,
    attackingTeam: 'away' as const,
    gkDiveAtFeetTeam: 'home' as const,
    gkDiveAtFeetGkId: 'home-0',
    gkDiveAtFeetCarrierId: 'away-9',
    gkDiveAtFeetDistance: 2,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: diveAtFeetState(),
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1, // home — the GK's/deciding side by default
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
    selectedPassType: null,
  });
});

describe('GkDiveAtFeetPromptPanel — phase gating', () => {
  it('returns null when phase is not GK_DIVE_AT_FEET_PROMPT', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<GkDiveAtFeetPromptPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when playerSlot is null (useMyTeam returns null)', () => {
    useGameStore.setState({ gameState: diveAtFeetState(), playerSlot: null });
    const { container } = render(<GkDiveAtFeetPromptPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe("GkDiveAtFeetPromptPanel — the goalkeeper's manager (deciding)", () => {
  it('sees "Dive at Feet?" and both buttons', () => {
    useGameStore.setState({ gameState: diveAtFeetState(), playerSlot: 1 });
    render(<GkDiveAtFeetPromptPanel />);
    expect(screen.getByText('Dive at Feet?')).toBeDefined();
    expect(screen.getByRole('button', { name: /^dive$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^decline$/i })).toBeDefined();
  });

  it('renders the carrier name in the detail line', () => {
    useGameStore.setState({ gameState: diveAtFeetState(), playerSlot: 1 });
    render(<GkDiveAtFeetPromptPanel />);
    const carrier = mockMovementState.pieces.find((p) => p.id === 'away-9')!;
    const carrierName = carrier.lastName
      ? `${carrier.firstName} ${carrier.lastName}`
      : carrier.firstName;
    expect(
      screen.getByText(`${carrierName} is within range — dive to win the ball back?`),
    ).toBeDefined();
  });

  it('"Dive" calls emitGkDiveAtFeet(true)', () => {
    useGameStore.setState({ gameState: diveAtFeetState(), playerSlot: 1 });
    render(<GkDiveAtFeetPromptPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^dive$/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_GK_DIVE_AT_FEET, true);
  });

  it('"Decline" calls emitGkDiveAtFeet(false)', () => {
    useGameStore.setState({ gameState: diveAtFeetState(), playerSlot: 1 });
    render(<GkDiveAtFeetPromptPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_GK_DIVE_AT_FEET, false);
  });

  it('the −1 dice penalty qualifier appears when gkDiveAtFeetDistance is 3', () => {
    useGameStore.setState({
      gameState: diveAtFeetState({ gkDiveAtFeetDistance: 3 }),
      playerSlot: 1,
    });
    render(<GkDiveAtFeetPromptPanel />);
    expect(screen.getByText(/−1 dice penalty at this range/)).toBeDefined();
  });

  it('the −1 dice penalty qualifier does NOT appear when gkDiveAtFeetDistance is 2', () => {
    useGameStore.setState({
      gameState: diveAtFeetState({ gkDiveAtFeetDistance: 2 }),
      playerSlot: 1,
    });
    render(<GkDiveAtFeetPromptPanel />);
    expect(screen.queryByText(/−1 dice penalty/)).toBeNull();
  });

  it('renders a humanised gameError in the error row', () => {
    useGameStore.setState({
      gameState: diveAtFeetState(),
      playerSlot: 1,
      gameError: 'WRONG_TEAM',
    });
    render(<GkDiveAtFeetPromptPanel />);
    expect(screen.queryByText('WRONG_TEAM')).toBeNull();
    expect(screen.getByText(restartErrorMessage('WRONG_TEAM') ?? '')).toBeDefined();
  });
});

describe('GkDiveAtFeetPromptPanel — the attacking manager (non-deciding)', () => {
  it('sees "is deciding whether to dive…" and no buttons', () => {
    useGameStore.setState({ gameState: diveAtFeetState(), playerSlot: 2 }); // away, carrier's side
    render(<GkDiveAtFeetPromptPanel />);
    expect(screen.getByText('Dive at Feet?')).toBeDefined();
    expect(screen.getByText(/is deciding whether to dive/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
