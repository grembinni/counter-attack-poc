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

describe('PlayerStatsPanel — D-08: MiniTokenBadge in panel header', () => {
  it('home outfield piece: mini-token circle fill references url(#mini-home-stripe-<id>) and the pattern exists', () => {
    // home-1 is a DEF (outfield, teamId='home')
    useGameStore.setState({ selectedPieceId: 'home-1' });
    const { container } = render(<PlayerStatsPanel />);

    // The panel's inline SVG
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // The pattern def must exist with the expected id
    const patternId = 'mini-home-stripe-home-1';
    const pattern = container.querySelector(`pattern#${patternId}`);
    expect(pattern).not.toBeNull();

    // The base circle fill must reference the pattern
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute('fill')).toBe(`url(#${patternId})`);
  });

  it('away outfield piece: mini-token circle fill references url(#mini-away-stripe-<id>) and the pattern exists', () => {
    // away-1 is a DEF (outfield, teamId='away')
    useGameStore.setState({ selectedPieceId: 'away-1' });
    const { container } = render(<PlayerStatsPanel />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const patternId = 'mini-away-stripe-away-1';
    const pattern = container.querySelector(`pattern#${patternId}`);
    expect(pattern).not.toBeNull();

    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute('fill')).toBe(`url(#${patternId})`);
  });

  it('GK piece: mini-token circle uses solid fill (no stripe pattern, no url(#mini-...))', () => {
    // home-0 is the home GK
    useGameStore.setState({ selectedPieceId: 'home-0' });
    const { container } = render(<PlayerStatsPanel />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // No stripe pattern def should exist for GK
    const pattern = container.querySelector('pattern');
    expect(pattern).toBeNull();

    // Circle fill should be the solid GK color, not a url reference
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    const fill = circle!.getAttribute('fill');
    expect(fill).not.toContain('url(#mini-');
    // Home GK is purple
    expect(fill).toBe('#9b59b6');
  });
});
