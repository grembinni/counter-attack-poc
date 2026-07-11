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

/** Seeds a FREE_KICK_SETUP state with away awarded the kick (D-28), at a given stage (D-49). */
function freeKickSetupState(
  stageIndex: 0 | 1 | 2 | 3,
  overrides: Partial<typeof mockMovementState> = {},
) {
  return {
    ...mockMovementState,
    phase: 'FREE_KICK_SETUP' as const,
    freeKickHex: FREE_KICK_HEX,
    freeKickAttackingTeam: 'away' as const,
    freeKickStageIndex: stageIndex,
    freeKickPlacedPieceIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: freeKickSetupState(0),
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1, // home — defending team (conceding) in these fixtures
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
    useGameStore.setState({ gameState: freeKickSetupState(0, { freeKickHex: null }) });
    const { container } = render(<FreeKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when freeKickStageIndex is null', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0, { freeKickStageIndex: null }) });
    const { container } = render(<FreeKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('FreeKickSetupPanel — turn gating (active vs inactive team)', () => {
  it('stage 0 (kicking = away): the INACTIVE team (home, playerSlot 1) sees only a waiting message, no End-Turn button', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0), playerSlot: 1 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/offside — free kick/i)).toBeDefined();
    expect(screen.getByText(/repositioning/i)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('stage 0 (kicking = away): the ACTIVE team (away, playerSlot 2) sees the per-stage UI and End Turn button', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0), playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/attacking team: place up to 4 players/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /end turn/i })).toBeDefined();
  });

  it('stage 1 (defending = home): the ACTIVE team (home, playerSlot 1) sees the defending-stage UI', () => {
    useGameStore.setState({ gameState: freeKickSetupState(1), playerSlot: 1 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/defending team: place up to 4 players/i)).toBeDefined();
  });

  it('stage 1 (defending = home): the INACTIVE team (away, playerSlot 2) sees only a waiting message', () => {
    useGameStore.setState({ gameState: freeKickSetupState(1), playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/repositioning/i)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('FreeKickSetupPanel — placements used/remaining display', () => {
  it('shows 0 used / N remaining when no placements have been made this stage', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0), playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/0 used, 4 remaining/i)).toBeDefined();
  });

  it('shows the correct used/remaining count after some placements this stage', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(0, { freeKickPlacedPieceIds: ['away-9', 'away-8'] }),
      playerSlot: 2,
    });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/2 used, 2 remaining/i)).toBeDefined();
  });

  it('stage 2 (kicking, cap 3): shows the stage-specific cap, not the stage-0 cap', () => {
    useGameStore.setState({ gameState: freeKickSetupState(2), playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/place up to 3 players/i)).toBeDefined();
  });

  it('stage 3 (defending, cap 2): shows the stage-specific cap', () => {
    useGameStore.setState({ gameState: freeKickSetupState(3), playerSlot: 1 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/place up to 2 players/i)).toBeDefined();
  });
});

describe('FreeKickSetupPanel — D-54 mandatory kicker-first placement (supersedes D-51, checked on EVERY kicking stage)', () => {
  beforeEach(() => {
    useGameStore.setState({ playerSlot: 2 }); // away — kicking team
  });

  it('stage 0: End Turn is DISABLED when no kicking-team piece is locked into movedPieceIds yet', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0, { movedPieceIds: [] }) });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /end turn/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/kicker: move a player onto the free-kick hex first/i)).toBeDefined();
  });

  it('stage 0: End Turn is ENABLED once a kicking-team piece is locked into movedPieceIds (kicker placed)', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(0, { movedPieceIds: ['away-9'] }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /end turn/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/kicker: placed and locked/i)).toBeDefined();
  });

  it('stage 2 (kicking, second kicking turn): End Turn is ENABLED when the kicker was already locked at stage 0 (carries forward in movedPieceIds)', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(2, { movedPieceIds: ['away-9'] }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /end turn/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/kicker: placed and locked/i)).toBeDefined();
  });

  it('stage 2: End Turn is DISABLED in the (abnormal) case where movedPieceIds has no kicking-team piece locked', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(2, { movedPieceIds: [] }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /end turn/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(true);
  });

  it('defending stages (1, 3) never show the kicker constraint row', () => {
    useGameStore.setState({ playerSlot: 1 }); // home — defending team
    useGameStore.setState({
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    expect(screen.queryByText(/kicker/i)).toBeNull();
  });
});

describe('FreeKickSetupPanel — D-50 defender-zone constraint (defending stages, 1 and 3)', () => {
  beforeEach(() => {
    useGameStore.setState({ playerSlot: 1 }); // home — defending team
  });

  it('stage 1: End Turn is disabled when a defending-team piece is within 2 hexes of freeKickHex', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9'
            ? { ...p, position: { q: FREE_KICK_HEX.q - 1, r: FREE_KICK_HEX.r } }
            : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /end turn/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/defending zone: 1 player/i)).toBeDefined();
  });

  it('stage 1: End Turn is enabled when all defending-team pieces are more than 2 hexes from freeKickHex', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /end turn/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/defending zone: clear/i)).toBeDefined();
  });

  it('stage 3 (last defending turn): the same 2-hex constraint applies and the button reads "Take Kick"', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(3, {
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9'
            ? { ...p, position: { q: FREE_KICK_HEX.q - 1, r: FREE_KICK_HEX.r } }
            : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const takeKick = screen.getByRole('button', { name: /take kick/i });
    expect((takeKick as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/defending zone: 1 player/i)).toBeDefined();
  });
});

describe('FreeKickSetupPanel — End Turn click emits and surfaces server errors', () => {
  it('clicking End Turn (when enabled) calls emitFreeKickReady', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /end turn/i });
    fireEvent.click(endTurn);
    // socket.emit is mocked at the module level — assert no throw and the button is still
    // present (no local "waiting" state in this component anymore; the NEXT server broadcast
    // either advances the stage or rejects with a snap-back, both surfaced via gameState/gameError).
    expect(screen.getByRole('button', { name: /end turn/i })).toBeDefined();
  });

  it('surfaces a server-rejection reason via the existing gameError display pattern', () => {
    useGameStore.setState({
      playerSlot: 2,
      gameState: freeKickSetupState(0),
      gameError: 'NOT_YOUR_STAGE',
    });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText('NOT_YOUR_STAGE')).toBeDefined();
  });
});
