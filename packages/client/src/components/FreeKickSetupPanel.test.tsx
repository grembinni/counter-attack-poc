import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { FreeKickSetupPanel } from './FreeKickSetupPanel.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());

const FREE_KICK_HEX = { q: 25, r: 13 };

/** Seeds a FREE_KICK_SETUP state with away awarded the kick (D-28). */
function freeKickSetupState(overrides: Partial<typeof mockMovementState> = {}) {
  return {
    ...mockMovementState,
    phase: 'FREE_KICK_SETUP' as const,
    freeKickHex: FREE_KICK_HEX,
    freeKickAttackingTeam: 'away' as const,
    attackingTeam: 'away' as const,
    activeTeam: 'away' as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: freeKickSetupState(),
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1, // home — defending team in these fixtures
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

describe('FreeKickSetupPanel — phase gating', () => {
  it('returns null when phase is not FREE_KICK_SETUP', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<FreeKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when freeKickHex is null', () => {
    useGameStore.setState({ gameState: freeKickSetupState({ freeKickHex: null }) });
    const { container } = render(<FreeKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders for BOTH teams (no isActivePlayer gate) — defending team (home, playerSlot 1)', () => {
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/offside — free kick/i)).toBeDefined();
  });

  it('renders for the kicking team (away, playerSlot 2)', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/offside — free kick/i)).toBeDefined();
  });
});

describe('FreeKickSetupPanel — D-31 kicker-hex constraint (kicking team)', () => {
  beforeEach(() => {
    useGameStore.setState({ playerSlot: 2 }); // away — kicking team
  });

  it('Ready is disabled when zero kicking-team pieces are on freeKickHex', () => {
    render(<FreeKickSetupPanel />);
    const ready = screen.getByRole('button', { name: /ready/i });
    expect((ready as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/kicker hex: empty/i)).toBeDefined();
  });

  it('Ready is enabled when exactly one kicking-team piece is on freeKickHex', () => {
    useGameStore.setState({
      gameState: freeKickSetupState({
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'away-9' ? { ...p, position: FREE_KICK_HEX } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const ready = screen.getByRole('button', { name: /ready/i });
    expect((ready as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/kicker hex: occupied/i)).toBeDefined();
  });

  it('Ready is disabled when TWO kicking-team pieces are on freeKickHex', () => {
    useGameStore.setState({
      gameState: freeKickSetupState({
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'away-9' || p.id === 'away-8' ? { ...p, position: FREE_KICK_HEX } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const ready = screen.getByRole('button', { name: /ready/i });
    expect((ready as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/multiple players/i)).toBeDefined();
  });
});

describe('FreeKickSetupPanel — D-30 defender-zone constraint (defending team)', () => {
  beforeEach(() => {
    useGameStore.setState({ playerSlot: 1 }); // home — defending team
  });

  it('Ready is disabled when a defending-team piece is within 2 hexes of freeKickHex', () => {
    useGameStore.setState({
      gameState: freeKickSetupState({
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9'
            ? { ...p, position: { q: FREE_KICK_HEX.q - 1, r: FREE_KICK_HEX.r } }
            : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const ready = screen.getByRole('button', { name: /ready/i });
    expect((ready as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/defending zone: 1 player/i)).toBeDefined();
  });

  it('Ready is enabled when all defending-team pieces are more than 2 hexes from freeKickHex', () => {
    useGameStore.setState({
      gameState: freeKickSetupState({
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const ready = screen.getByRole('button', { name: /ready/i });
    expect((ready as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/defending zone: clear/i)).toBeDefined();
  });
});

describe('FreeKickSetupPanel — Ready button emits and shows waiting state', () => {
  it('clicking Ready (when enabled) calls emitFreeKickReady and shows the waiting label', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: freeKickSetupState({
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const ready = screen.getByRole('button', { name: /ready/i });
    fireEvent.click(ready);
    expect(screen.getByText(/waiting for opponent/i)).toBeDefined();
  });
});
