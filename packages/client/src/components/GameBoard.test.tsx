import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { GameBoard } from './GameBoard.js';

vi.mock('../socket.js', () => ({
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
    // ConnectionStatus also calls socket.io.on/off ('reconnect_attempt' manager event)
    io: { on: vi.fn(), off: vi.fn() },
  },
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

// ---------------------------------------------------------------------------
// CLOCK-01: MM:00 format — actionCount maps to "${actionCount}:00"
// ---------------------------------------------------------------------------
describe('GameBoard — CLOCK-01: MM:00 format', () => {
  it('renders "7:00" when actionCount is 7', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, actionCount: 7 } });
    render(<GameBoard />);
    expect(screen.getByText(/7:00/)).toBeDefined();
  });

  it('renders "45:00" when actionCount is 45', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, actionCount: 45 } });
    render(<GameBoard />);
    expect(screen.getByText(/45:00/)).toBeDefined();
  });

  it('renders "46:00" when actionCount is 46 (added time / second half overflow)', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, actionCount: 46 } });
    render(<GameBoard />);
    expect(screen.getByText(/46:00/)).toBeDefined();
  });

  it('renders clock for actionCount 0 (matches /0?0:00/ to allow padStart variance)', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, actionCount: 0 } });
    render(<GameBoard />);
    // UI-SPEC formula: String(actionCount).padStart(2,'0') + ':00' → "00:00"
    // Accept either "0:00" or "00:00"
    expect(screen.getByText(/0?0:00/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CLOCK-02: clock visible in all phases — no PLAY_PHASES gating
// ---------------------------------------------------------------------------
describe('GameBoard — CLOCK-02: clock visible in all phases', () => {
  it('renders the clock during HALF_TIME phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'HALF_TIME', actionCount: 45 },
    });
    render(<GameBoard />);
    // HALF_TIME: overlay shows literal 45:00 + scoreboard shows computed 45:00 — both valid
    expect(screen.getAllByText(/\d+:00/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the clock during KICK_OFF_SETUP phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'KICK_OFF_SETUP', actionCount: 3 },
    });
    render(<GameBoard />);
    expect(screen.getByText(/\d+:00/)).toBeDefined();
  });

  it('renders the clock during FULL_TIME phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'FULL_TIME', actionCount: 90 },
    });
    render(<GameBoard />);
    expect(screen.getAllByText(/\d+:00/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the clock during REPLAY phase', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'REPLAY',
        actionCount: 68,
        replayIndex: 1,
        replayTotal: 10,
      },
    });
    render(<GameBoard />);
    expect(screen.getByText(/\d+:00/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// LAYOUT-01: scoreboard shows home and away scores
// ---------------------------------------------------------------------------
describe('GameBoard — LAYOUT-01: scoreboard scores', () => {
  it('renders home score "2" and away score "1" in the scoreboard', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, score: { home: 2, away: 1 } },
    });
    render(<GameBoard />);
    // Both score digits must appear — scoreboard shows home | center | away
    const twos = screen.getAllByText('2');
    expect(twos.length).toBeGreaterThanOrEqual(1);
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(1);
  });

  it('renders home score "0" and away score "0" by default', () => {
    // mockMovementState has score {home:0, away:0}
    render(<GameBoard />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('renders large scores correctly — home 3 away 2', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, score: { home: 3, away: 2 } },
    });
    render(<GameBoard />);
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// LAYOUT-02: phase-aware action section and log toggle
// ---------------------------------------------------------------------------
describe('GameBoard — LAYOUT-02: phase-aware action section and log toggle', () => {
  it('renders KickOffSetupPanel content during KICK_OFF_SETUP phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'KICK_OFF_SETUP' },
    });
    render(<GameBoard />);
    // KickOffSetupPanel renders "Kick-Off Setup" heading when phase === 'KICK_OFF_SETUP'
    expect(screen.getByText(/Kick-Off Setup/i)).toBeDefined();
  });

  it('renders ReplayPanel content during REPLAY phase', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'REPLAY',
        replayIndex: 0,
        replayTotal: 5,
      },
    });
    render(<GameBoard />);
    // ReplayPanel renders "Replay" heading when phase === 'REPLAY'
    expect(screen.getByText(/^Replay$/i)).toBeDefined();
  });

  it('renders ActionPanel (End Turn button) during MOVEMENT phase', () => {
    // mockMovementState is already MOVEMENT phase with playerSlot=1 (home team = active)
    render(<GameBoard />);
    // ActionPanel renders "End Turn" button in MOVEMENT phase for the active player
    expect(screen.getByText(/End Turn/i)).toBeDefined();
  });

  it('renders the log toggle chevron › button in the collapsed default state', () => {
    render(<GameBoard />);
    // UI-SPEC: LogToggle collapsed state shows › chevron button (UI-SPEC §LogToggle)
    // The button must exist by default since log starts collapsed
    const chevron = screen.getByText('›');
    expect(chevron).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// TEAM-06: Scoreboard badge images (TeamBadge replaces TeamShieldIcon)
// ---------------------------------------------------------------------------
describe('GameBoard — TEAM-06: scoreboard badge images', () => {
  it('renders at least two <img> elements with alt text containing "badge"', () => {
    render(<GameBoard />);
    // TeamBadge renders <img alt="{teamId} badge"> for home and away
    const imgs = screen.getAllByRole('img');
    const badgeImgs = imgs.filter((el) => /badge/i.test(el.getAttribute('alt') ?? ''));
    expect(badgeImgs.length).toBeGreaterThanOrEqual(2);
  });

  it('home scoreboard badge img alt contains "city" (selectedTeams home → city)', () => {
    render(<GameBoard />);
    // mockMovementState.selectedTeams: home -> city; TeamBadge alt = "{teamId} badge"
    const cityBadge = screen.getByAltText('city badge');
    expect(cityBadge).toBeDefined();
  });

  it('away scoreboard badge img alt contains "crew" (selectedTeams away → crew)', () => {
    render(<GameBoard />);
    // mockMovementState.selectedTeams: away -> crew; TeamBadge alt = "{teamId} badge"
    const crewBadge = screen.getByAltText('crew badge');
    expect(crewBadge).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DESIGN-01: scoreboard phase-label naming convention (D-11 corrected targets)
// ---------------------------------------------------------------------------
describe('GameBoard — DESIGN-01: phase label naming convention', () => {
  it('renders "CHOOSING ACTION" for PASS phase (D-11: gerund kept intentionally)', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'PASS' } });
    render(<GameBoard />);
    expect(screen.getByText(/CHOOSING ACTION/)).toBeDefined();
  });

  it('renders "GOALIE DIVE" for GK_DIVE phase, not "GK DIVING" or "GK DIVE"', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'GK_DIVE' } });
    render(<GameBoard />);
    expect(screen.getByText(/GOALIE DIVE/)).toBeDefined();
    expect(screen.queryByText(/GK DIVING/)).toBeNull();
    expect(screen.queryByText(/GK DIVE/)).toBeNull();
  });

  it('renders "MOVE 5" when phase is MOVE and movementSlot is DEFENDER_5', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'MOVE', movementSlot: 'DEFENDER_5' },
    });
    render(<GameBoard />);
    expect(screen.getByText(/MOVE 5/)).toBeDefined();
  });

  it('renders "MOVE 4" when phase is MOVE and movementSlot is ATTACKER_4', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'MOVE', movementSlot: 'ATTACKER_4' },
    });
    render(<GameBoard />);
    expect(screen.getByText(/MOVE 4/)).toBeDefined();
  });

  it('renders "SNAPSHOT - SELECT TARGET" for SNAPSHOT_TARGET phase', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'SNAPSHOT_TARGET' } });
    render(<GameBoard />);
    expect(screen.getByText(/SNAPSHOT - SELECT TARGET/)).toBeDefined();
  });

  it('renders "FIRST-TIME PASS — RESPONSE MOVE" for FIRST_TIME_PASS_MOVE phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'FIRST_TIME_PASS_MOVE' },
    });
    render(<GameBoard />);
    expect(screen.getByText(/FIRST-TIME PASS — RESPONSE MOVE/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// D-08 (soft): read-only active match-speed reminder in the scoreboard
// ---------------------------------------------------------------------------
describe('GameBoard — D-08: scoreboard active-speed reminder', () => {
  it('renders the active speed label (Fast) in the scoreboard for a known gameSpeed', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, gameSpeed: 'fast' } });
    render(<GameBoard />);
    expect(screen.getByText(/Fast/)).toBeDefined();
  });
});
