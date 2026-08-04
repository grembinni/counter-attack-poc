import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { ThrowInSetupPanel } from './ThrowInSetupPanel.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

afterEach(() => cleanup());

const THROW_IN_HEX = { q: 25, r: 13 };

/** Seeds a THROW_IN_SETUP state with the given throwing team (THROWIN-02). */
function throwInSetupState(
  throwInTeam: 'home' | 'away',
  overrides: Partial<typeof mockMovementState> = {},
) {
  return {
    ...mockMovementState,
    phase: 'THROW_IN_SETUP' as const,
    throwInHex: THROW_IN_HEX,
    throwInTeam,
    throwInPhasesTaken: 0 as const,
    // WR-01/D-12-03: triggerOutOfBoundsRestart's THROW_IN branch always sets
    // attackingTeam/activeTeam to throwInTeam — the fixture must match that
    // invariant so it describes a state the server can actually produce.
    attackingTeam: throwInTeam,
    activeTeam: throwInTeam,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: throwInSetupState('away'),
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1, // home
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

describe('ThrowInSetupPanel — phase gating', () => {
  it('returns null when phase is not THROW_IN_SETUP', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<ThrowInSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when throwInHex is null', () => {
    useGameStore.setState({ gameState: throwInSetupState('away', { throwInHex: null }) });
    const { container } = render(<ThrowInSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when throwInTeam is null', () => {
    useGameStore.setState({ gameState: throwInSetupState('away', { throwInTeam: null }) });
    const { container } = render(<ThrowInSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when playerSlot is null (useMyTeam returns null)', () => {
    useGameStore.setState({ gameState: throwInSetupState('away'), playerSlot: null });
    const { container } = render(<ThrowInSetupPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ThrowInSetupPanel — turn gating (active vs inactive team)', () => {
  it('the NON-throwing team (home, playerSlot 1) sees only a waiting message, no buttons', () => {
    useGameStore.setState({ gameState: throwInSetupState('away'), playerSlot: 1 });
    render(<ThrowInSetupPanel />);
    expect(screen.getByText(/throw-in/i)).toBeDefined();
    expect(screen.getByText(/team is repositioning/i)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the THROWING team (away, playerSlot 2) sees the active panel with a Confirm button', () => {
    useGameStore.setState({ gameState: throwInSetupState('away'), playerSlot: 2 });
    render(<ThrowInSetupPanel />);
    expect(screen.getByText('No player selected.')).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });
});

describe('ThrowInSetupPanel — active-panel behaviour', () => {
  beforeEach(() => {
    useGameStore.setState({ playerSlot: 2, gameState: throwInSetupState('away') }); // away — throwing team
  });

  it('Confirm is disabled with a title when no thrower is selected', () => {
    render(<ThrowInSetupPanel />);
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
    expect(confirmBtn.title).toBe('Select one of your players to take the throw');
  });

  it('shows the selected thrower name/number once a piece is selected', () => {
    useGameStore.setState({ selectedPieceId: 'away-9' });
    render(<ThrowInSetupPanel />);
    const piece = mockMovementState.pieces.find((p) => p.id === 'away-9');
    if (!piece) throw new Error('away-9 not found in mockMovementState fixture');
    expect(
      screen.getByText(`Thrower: #${piece.number} ${piece.firstName} ${piece.lastName}`),
    ).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not treat an opponent piece id as a valid selection', () => {
    useGameStore.setState({ selectedPieceId: 'home-9' });
    render(<ThrowInSetupPanel />);
    expect(screen.getByText('No player selected.')).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('clicking Confirm with a selected piece calls emitThrowInPlace(selectedPieceId)', () => {
    useGameStore.setState({ selectedPieceId: 'away-9' });
    render(<ThrowInSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_THROW_IN_PLACE, 'away-9');
  });

  it('surfaces a server-rejection reason via the gameError display pattern', () => {
    useGameStore.setState({ gameError: 'NOT_YOUR_PIECE' });
    render(<ThrowInSetupPanel />);
    expect(screen.getByText('NOT_YOUR_PIECE')).toBeDefined();
  });
});

describe('ThrowInSetupPanel — button text and waiting copy', () => {
  it('the button text content is exactly "Confirm"', () => {
    useGameStore.setState({ playerSlot: 2, gameState: throwInSetupState('away') });
    render(<ThrowInSetupPanel />);
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn.textContent).toBe('Confirm');
  });

  it('the waiting-state row text matches /team is repositioning/', () => {
    useGameStore.setState({ playerSlot: 1, gameState: throwInSetupState('away') });
    render(<ThrowInSetupPanel />);
    expect(screen.getByText(/team is repositioning/)).toBeDefined();
  });

  it('WR-01: real-shaped state (attackingTeam === throwInTeam) renders "Attacking team is repositioning…"', () => {
    useGameStore.setState({ playerSlot: 1, gameState: throwInSetupState('away') });
    render(<ThrowInSetupPanel />);
    expect(screen.getByText('Attacking team is repositioning…')).toBeDefined();
  });

  it('WR-01: overridden attackingTeam (throwInTeam !== attackingTeam) renders "Defending team is repositioning…" — proves the label is derived, not hardcoded', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: throwInSetupState('away', { attackingTeam: 'home' }),
    });
    render(<ThrowInSetupPanel />);
    expect(screen.getByText('Defending team is repositioning…')).toBeDefined();
  });
});
