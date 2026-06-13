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

describe('PlayerStatsPanel — D-08/D-06: MiniTokenBadge team-keyed patterns (15-03)', () => {
  it('home outfield piece: mini-token circle fill references url(#mini-cosmos-jersey-<id>) and the pattern exists', () => {
    // home-1 is a DEF (outfield, teamId='home'); TEAM_DEFAULTS: home -> cosmos
    useGameStore.setState({ selectedPieceId: 'home-1' });
    const { container } = render(<PlayerStatsPanel />);

    // The panel's inline SVG
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // The team-keyed jersey pattern def must exist
    const patternId = 'mini-cosmos-jersey-home-1';
    const pattern = container.querySelector(`pattern#${patternId}`);
    expect(pattern).not.toBeNull();

    // The base circle fill must reference the team-keyed pattern
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute('fill')).toBe(`url(#${patternId})`);
  });

  it('away outfield piece: mini-token circle fill references url(#mini-xolos-jersey-<id>) and the pattern exists', () => {
    // away-1 is a DEF (outfield, teamId='away'); TEAM_DEFAULTS: away -> xolos
    useGameStore.setState({ selectedPieceId: 'away-1' });
    const { container } = render(<PlayerStatsPanel />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const patternId = 'mini-xolos-jersey-away-1';
    const pattern = container.querySelector(`pattern#${patternId}`);
    expect(pattern).not.toBeNull();

    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute('fill')).toBe(`url(#${patternId})`);
  });

  it('home GK: mini-token circle references url(#mini-home-gk-checker-<id>) and checker pattern exists (D-10)', () => {
    // home-0 is the home GK
    useGameStore.setState({ selectedPieceId: 'home-0' });
    const { container } = render(<PlayerStatsPanel />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // Home GK now uses checker pattern, not solid fill
    const homeGkPatId = 'mini-home-gk-checker-home-0';
    const pattern = container.querySelector(`pattern#${homeGkPatId}`);
    expect(pattern).not.toBeNull();

    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute('fill')).toBe(`url(#${homeGkPatId})`);
  });

  it('away GK: mini-token circle uses solid amber fill (#f59e0b), no pattern', () => {
    // away-0 is the away GK
    useGameStore.setState({ selectedPieceId: 'away-0' });
    const { container } = render(<PlayerStatsPanel />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // Away GK keeps solid amber — no checker pattern
    const pattern = container.querySelector('pattern');
    expect(pattern).toBeNull();

    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    const fill = circle!.getAttribute('fill');
    expect(fill).not.toContain('url(#mini-');
    expect(fill).toBe('#f59e0b');
  });
});
