import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { KickOffSetupPanel } from './KickOffSetupPanel.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

afterEach(() => cleanup());

const KICK_OFF_HEX = { q: 18, r: 13 };

/** Seeds a KICK_OFF_SETUP state with home attacking, per mockMovementState defaults. */
function kickOffSetupState(overrides: Partial<typeof mockMovementState> = {}) {
  return {
    ...mockMovementState,
    phase: 'KICK_OFF_SETUP' as const,
    attackingTeam: 'home' as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: kickOffSetupState(),
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1, // home — attacking team in these fixtures
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

describe('KickOffSetupPanel — phase gating', () => {
  it('returns null when phase is not KICK_OFF_SETUP', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<KickOffSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the "Kick-Off Setup" heading when phase is KICK_OFF_SETUP', () => {
    render(<KickOffSetupPanel />);
    expect(screen.getByText(/kick-off setup/i)).toBeDefined();
  });
});

describe('KickOffSetupPanel — D-08: Confirm CTA gating', () => {
  it('the CTA reads Confirm and is disabled when the attacking team has no piece on the centre hex', () => {
    // Default mockMovementState home positions have no piece at {q:18, r:13}.
    render(<KickOffSetupPanel />);
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('the CTA is enabled once the centre hex is occupied and all pieces are in-zone', () => {
    useGameStore.setState({
      gameState: kickOffSetupState({
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9' ? { ...p, position: KICK_OFF_HEX } : p,
        ),
      }),
    });
    render(<KickOffSetupPanel />);
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('KickOffSetupPanel — D-09: context-specific waiting state after Confirm', () => {
  it('the waiting text is absent before Confirm is clicked', () => {
    useGameStore.setState({
      gameState: kickOffSetupState({
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9' ? { ...p, position: KICK_OFF_HEX } : p,
        ),
      }),
    });
    render(<KickOffSetupPanel />);
    expect(screen.queryByText(/waiting for the opponent to confirm their placement/i)).toBeNull();
  });

  it('after clicking Confirm, emitReady is called, the button reads Confirmed and is disabled, and the waiting text is present', () => {
    useGameStore.setState({
      gameState: kickOffSetupState({
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9' ? { ...p, position: KICK_OFF_HEX } : p,
        ),
      }),
    });
    render(<KickOffSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_READY);
    const confirmedBtn = screen.getByRole('button', { name: /^confirmed$/i });
    expect((confirmedBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/waiting for the opponent to confirm their placement/i)).toBeDefined();
  });
});
