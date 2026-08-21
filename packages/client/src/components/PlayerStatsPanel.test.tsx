/**
 * Phase 16 Wave 0 RED tests — PLAY-02, D-09
 *
 * Updated assertions:
 * - Mock gameState includes selectedTeams (GameState.selectedTeams not yet in type → compile error)
 * - Removes /Home GK/i assertion; replaces with firstName/lastName/role/number rendering assertions
 * - These tests are RED until plan 16-02 adds firstName/lastName to PlayerPiece and plan 16-03
 *   redesigns the PlayerStatsPanel header (D-09)
 */
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
    gameState: {
      ...mockMovementState,
      selectedTeams: { home: 'city', away: 'crew' },
    },
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

describe('PlayerStatsPanel — PLAY-02 / D-09: player card header renders firstName/lastName/role/number', () => {
  it('renders the GK full name in the card header (flat layout — PLAY-02)', () => {
    // home-0 is the GK. After Phase 19, the city GK is Roman Bürki (array index 0 in city squad).
    useGameStore.setState({ selectedPieceId: 'home-0' });
    render(<PlayerStatsPanel />);
    // Flat card combines firstName + lastName in one span
    expect(screen.getByText('Roman Bürki')).toBeDefined();
  });

  it('renders the role text (e.g. "GK") on line 3 (D-09)', () => {
    useGameStore.setState({ selectedPieceId: 'home-0' });
    render(<PlayerStatsPanel />);
    // Line 3 shows role
    expect(screen.getByText('GK')).toBeDefined();
  });

  it('renders "#1" jersey number on line 3 (D-09, D-08)', () => {
    useGameStore.setState({ selectedPieceId: 'home-0' });
    render(<PlayerStatsPanel />);
    // Line 3: badge | role | #number — GK gets number 1
    expect(screen.getByText('#1')).toBeDefined();
  });

  it('does NOT render the old "Home GK" text (name field removed — D-06)', () => {
    useGameStore.setState({ selectedPieceId: 'home-0' });
    render(<PlayerStatsPanel />);
    // /Home GK/i must not appear anywhere in the rendered output
    expect(screen.queryByText(/Home GK/i)).toBeNull();
  });

  it('outfield: shows 6 stats (PACE SHOOTING TACKLING DRIBBLING AERIAL PASSING), no SAVE/HANDLING/RES; GK: shows 6 stats, no SHOOTING/PASSING/RES', () => {
    // home-1 is an outfield player (DEF)
    useGameStore.setState({ selectedPieceId: 'home-1' });
    render(<PlayerStatsPanel />);
    expect(screen.getByText('PACE')).toBeDefined();
    expect(screen.getByText('SHOOTING')).toBeDefined();
    expect(screen.getByText('TACKLING')).toBeDefined();
    expect(screen.getByText('DRIBBLING')).toBeDefined();
    expect(screen.getByText('AERIAL')).toBeDefined();
    expect(screen.getByText('PASSING')).toBeDefined();
    // SAVE, HANDLING, RES hidden for outfield
    expect(screen.queryByText('SAVE')).toBeNull();
    expect(screen.queryByText('HANDLING')).toBeNull();
    expect(screen.queryByText('RES')).toBeNull();
    cleanup();

    // home-0 is the GK
    useGameStore.setState({ selectedPieceId: 'home-0' });
    render(<PlayerStatsPanel />);
    expect(screen.getByText('SAVE')).toBeDefined();
    expect(screen.getByText('HANDLING')).toBeDefined();
    // SHOOTING, PASSING, RES hidden for GK
    expect(screen.queryByText('SHOOTING')).toBeNull();
    expect(screen.queryByText('PASSING')).toBeNull();
    expect(screen.queryByText('RES')).toBeNull();
  });

  it('renders full stat names as title tooltip attributes on chip wrappers', () => {
    useGameStore.setState({ selectedPieceId: 'home-1' });
    render(<PlayerStatsPanel />);
    expect(screen.getByTitle('Pace')).toBeDefined();
    expect(screen.getByTitle('Shooting')).toBeDefined();
    expect(screen.getByTitle('Aerial Ability')).toBeDefined();
    expect(screen.getByTitle('High Pass')).toBeDefined();
  });

  it('renders the correct attribute value from gameState.pieces', () => {
    useGameStore.setState({ selectedPieceId: 'home-9' });
    render(<PlayerStatsPanel />);
    // home-9 (Carlo Holse, FWD) from city squad CSV data has shooting:5, highPass(passing):5
    const statValues = screen.getAllByText('5');
    expect(statValues.length).toBeGreaterThanOrEqual(2);
  });
});

describe('PlayerStatsPanel — ICON-01/ICON-02/D-04: roster-panel card/injury glyphs (shared badge)', () => {
  /** Applies field overrides to a single piece in the mock store's gameState.pieces. */
  function overridePiece(pieceId: string, overrides: Record<string, unknown>) {
    const state = useGameStore.getState();
    useGameStore.setState({
      gameState: {
        ...state.gameState,
        pieces: state.gameState.pieces.map((p) => (p.id === pieceId ? { ...p, ...overrides } : p)),
      },
    });
  }

  it('renders no glyph for a clean player', () => {
    useGameStore.setState({ selectedPieceId: 'home-1' });
    const { container } = render(<PlayerStatsPanel />);
    expect(container.querySelector('[data-testid="card-injury-badge"]')).toBeNull();
  });

  it('ICON-02: a yellow-carded player renders the shared glyph with data-card="yellow"', () => {
    overridePiece('home-1', { yellowCards: 1 });
    useGameStore.setState({ selectedPieceId: 'home-1' });
    const { container } = render(<PlayerStatsPanel />);
    const badge = container.querySelector('[data-testid="piece-card-badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.getAttribute('data-card')).toBe('yellow');
  });

  it('a red-carded player renders the shared glyph with data-card="red"', () => {
    overridePiece('home-1', { redCarded: true });
    useGameStore.setState({ selectedPieceId: 'home-1' });
    const { container } = render(<PlayerStatsPanel />);
    const badge = container.querySelector('[data-testid="piece-card-badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.getAttribute('data-card')).toBe('red');
  });

  it('an injured player renders exactly one injury glyph with aria-label "Injured"', () => {
    overridePiece('home-1', { injuryCount: 1 });
    useGameStore.setState({ selectedPieceId: 'home-1' });
    const { container } = render(<PlayerStatsPanel />);
    const injuryGlyphs = container.querySelectorAll('[data-testid="piece-injury-badge"]');
    expect(injuryGlyphs.length).toBe(1);
    const wrapper = container.querySelector('[data-testid="card-injury-badge"]');
    expect(wrapper!.getAttribute('aria-label')).toBe('Injured');
  });

  it('a twice-injured player still renders exactly one injury glyph (binary glyph rule), aria-label "Injured ×2"', () => {
    overridePiece('home-1', { injuryCount: 2 });
    useGameStore.setState({ selectedPieceId: 'home-1' });
    const { container } = render(<PlayerStatsPanel />);
    const injuryGlyphs = container.querySelectorAll('[data-testid="piece-injury-badge"]');
    expect(injuryGlyphs.length).toBe(1);
    const wrapper = container.querySelector('[data-testid="card-injury-badge"]');
    expect(wrapper!.getAttribute('aria-label')).toBe('Injured ×2');
  });

  it('D-04: a booked-and-injured player renders both glyphs side by side, non-overlapping', () => {
    overridePiece('home-1', { yellowCards: 1, injuryCount: 1 });
    useGameStore.setState({ selectedPieceId: 'home-1' });
    const { container } = render(<PlayerStatsPanel />);
    const cardBadge = container.querySelector('[data-testid="piece-card-badge"]');
    const injuryBadge = container.querySelector('[data-testid="piece-injury-badge"]');
    expect(cardBadge).not.toBeNull();
    expect(injuryBadge).not.toBeNull();
    const cardX = Number(cardBadge!.getAttribute('x'));
    const cardWidth = Number(cardBadge!.getAttribute('width'));
    const injuryRect = injuryBadge!.querySelector('rect');
    const injuryX = Number(injuryRect!.getAttribute('x'));
    expect(cardX + cardWidth).toBeLessThanOrEqual(injuryX);
  });
});

describe('PlayerStatsPanel — D-08/D-06: MiniTokenBadge team-keyed patterns (15-03)', () => {
  it('home outfield piece: mini-token circle fill references url(#mini-city-jersey-<id>) and the pattern exists', () => {
    // home-1 is a DEF (outfield, teamId='home'); selectedTeams.home = city (Phase 19 D-04)
    useGameStore.setState({ selectedPieceId: 'home-1' });
    const { container } = render(<PlayerStatsPanel />);

    // The panel's inline SVG
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // The team-keyed jersey pattern def must exist
    const patternId = 'mini-city-jersey-home-1';
    const pattern = container.querySelector(`pattern#${patternId}`);
    expect(pattern).not.toBeNull();

    // The base circle fill must reference the team-keyed pattern
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute('fill')).toBe(`url(#${patternId})`);
  });

  it('away outfield piece: mini-token circle fill references url(#mini-crew-jersey-<id>) and the pattern exists', () => {
    // away-1 is a DEF (outfield, teamId='away'); selectedTeams.away = crew (Phase 19 D-04)
    useGameStore.setState({ selectedPieceId: 'away-1' });
    const { container } = render(<PlayerStatsPanel />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const patternId = 'mini-crew-jersey-away-1';
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
