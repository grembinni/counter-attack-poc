import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { PlayerStatsPanel } from './PlayerStatsPanel.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: { ...mockMovementState },
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1,
    roomCode: 'ABC12',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

describe('PlayerStatsPanel — TEAM-02: renders null when no piece selected', () => {
  it('returns null when selectedPieceId is null', () => {
    const { container } = render(<PlayerStatsPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PlayerStatsPanel — TEAM-02: renders stats for selected piece', () => {
  it('renders player name when a piece is selected', () => {
    useGameStore.setState({ selectedPieceId: 'home-0' });
    render(<PlayerStatsPanel />);
    expect(screen.getByText(/Home GK/i)).toBeDefined();
  });

  it('renders all 10 attribute labels', () => {
    useGameStore.setState({ selectedPieceId: 'home-1' });
    render(<PlayerStatsPanel />);
    expect(screen.getByText('Pace')).toBeDefined();
    expect(screen.getByText('Shooting')).toBeDefined();
    expect(screen.getByText('Tackling')).toBeDefined();
    expect(screen.getByText('Dribbling')).toBeDefined();
    expect(screen.getByText('Heading')).toBeDefined();
    expect(screen.getByText('Saving')).toBeDefined();
    expect(screen.getByText('Handling')).toBeDefined();
    expect(screen.getByText('Resilience')).toBeDefined();
    expect(screen.getByText('Aerial Ability')).toBeDefined();
    expect(screen.getByText('High Pass')).toBeDefined();
  });

  it('renders the correct attribute value from gameState.pieces', () => {
    useGameStore.setState({ selectedPieceId: 'home-9' });
    render(<PlayerStatsPanel />);
    // home-9 has pace: 5, dribbling: 5, heading: 5, resilience: 5 (from teams.ts)
    const statValues = screen.getAllByText('5');
    expect(statValues.length).toBeGreaterThanOrEqual(2);
  });
});
