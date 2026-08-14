import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { GkBoxEntryPromptPanel } from './GkBoxEntryPromptPanel.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

afterEach(() => cleanup());

type BoxEntryPhase = 'GK_BOX_ENTRY_PROMPT' | 'GK_BOX_ENTRY_MOVE';

/**
 * Seeds a box-entry-phase state. attackingTeam defaults to 'away' (the team that entered the
 * box); gkBoxEntryTeam defaults to 'home' (the GK's/deciding/acting side).
 */
function boxEntryState(phase: BoxEntryPhase, overrides: Partial<typeof mockMovementState> = {}) {
  return {
    ...mockMovementState,
    phase,
    attackingTeam: 'away' as const,
    gkBoxEntryTeam: 'home' as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: boxEntryState('GK_BOX_ENTRY_PROMPT'),
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

describe('GkBoxEntryPromptPanel — phase gating', () => {
  it('returns null when phase is neither box-entry phase', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<GkBoxEntryPromptPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when playerSlot is null (useMyTeam returns null)', () => {
    useGameStore.setState({ gameState: boxEntryState('GK_BOX_ENTRY_PROMPT'), playerSlot: null });
    const { container } = render(<GkBoxEntryPromptPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('GkBoxEntryPromptPanel — GK_BOX_ENTRY_PROMPT', () => {
  it('the responding manager sees both buttons and the locked copy', () => {
    useGameStore.setState({ gameState: boxEntryState('GK_BOX_ENTRY_PROMPT'), playerSlot: 1 });
    render(<GkBoxEntryPromptPanel />);
    expect(screen.getByText('Goalkeeper Reposition?')).toBeDefined();
    expect(
      screen.getByText('The ball has entered the box — reposition your goalkeeper 1 hex?'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /^reposition$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^decline$/i })).toBeDefined();
  });

  it('"Reposition" calls emitGkBoxEntryResponse(true)', () => {
    useGameStore.setState({ gameState: boxEntryState('GK_BOX_ENTRY_PROMPT'), playerSlot: 1 });
    render(<GkBoxEntryPromptPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^reposition$/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_GK_BOX_ENTRY_RESPONSE, true);
  });

  it('"Decline" calls emitGkBoxEntryResponse(false)', () => {
    useGameStore.setState({ gameState: boxEntryState('GK_BOX_ENTRY_PROMPT'), playerSlot: 1 });
    render(<GkBoxEntryPromptPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^decline$/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_GK_BOX_ENTRY_RESPONSE, false);
  });

  it('the other manager sees the waiting text and no buttons', () => {
    useGameStore.setState({ gameState: boxEntryState('GK_BOX_ENTRY_PROMPT'), playerSlot: 2 }); // away
    render(<GkBoxEntryPromptPanel />);
    expect(screen.getByText('Goalkeeper Reposition?')).toBeDefined();
    expect(screen.getByText(/is deciding whether to reposition/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders a humanised gameError in the error row', () => {
    useGameStore.setState({
      gameState: boxEntryState('GK_BOX_ENTRY_PROMPT'),
      playerSlot: 1,
      gameError: 'WRONG_TEAM',
    });
    render(<GkBoxEntryPromptPanel />);
    expect(screen.queryByText('WRONG_TEAM')).toBeNull();
    expect(screen.getByText(restartErrorMessage('WRONG_TEAM') ?? '')).toBeDefined();
  });
});

describe('GkBoxEntryPromptPanel — GK_BOX_ENTRY_MOVE', () => {
  it('the acting manager sees "Select an adjacent hex for your goalkeeper." and zero buttons', () => {
    useGameStore.setState({ gameState: boxEntryState('GK_BOX_ENTRY_MOVE'), playerSlot: 1 });
    render(<GkBoxEntryPromptPanel />);
    expect(screen.getByText('Goalkeeper Reposition?')).toBeDefined();
    expect(screen.getByText('Select an adjacent hex for your goalkeeper.')).toBeDefined();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('the other manager sees a waiting message and zero buttons', () => {
    useGameStore.setState({ gameState: boxEntryState('GK_BOX_ENTRY_MOVE'), playerSlot: 2 }); // away
    render(<GkBoxEntryPromptPanel />);
    expect(screen.getByText(/team is repositioning/)).toBeDefined();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
