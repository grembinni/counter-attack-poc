import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { GoalKickSetupPanel } from './GoalKickSetupPanel.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

afterEach(() => cleanup());

type GoalKickPhase =
  | 'GOAL_KICK_SETUP_GK'
  | 'GOAL_KICK_SETUP_OPPONENT'
  | 'GOAL_KICK_CHOICE'
  | 'GOAL_KICK_TARGET'
  | 'GOAL_KICK_MOVE';

/** Seeds a goal-kick-phase state. goalKickTeam defaults to 'away' (GOALKICK-01..06). */
function goalKickState(phase: GoalKickPhase, overrides: Partial<typeof mockMovementState> = {}) {
  return {
    ...mockMovementState,
    phase,
    goalKickTeam: 'away' as const,
    goalKickGkId: 'away-0',
    goalKickEligibleIds: { gkTeam: [] as readonly string[], opponent: [] as readonly string[] },
    goalKickUsedPace: {},
    goalKickMovedPieceId: null,
    activeTeam: 'away' as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: goalKickState('GOAL_KICK_SETUP_GK'),
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

describe('GoalKickSetupPanel — phase gating', () => {
  it('returns null when phase is not one of the five goal-kick phases', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<GoalKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when goalKickTeam is null', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', { goalKickTeam: null }),
    });
    const { container } = render(<GoalKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when goalKickTeam is undefined', () => {
    const state = goalKickState('GOAL_KICK_SETUP_GK');
    delete (state as { goalKickTeam?: 'home' | 'away' | null }).goalKickTeam;
    useGameStore.setState({ gameState: state });
    const { container } = render(<GoalKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when playerSlot is null (useMyTeam returns null)', () => {
    useGameStore.setState({ gameState: goalKickState('GOAL_KICK_SETUP_GK'), playerSlot: null });
    const { container } = render(<GoalKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('GoalKickSetupPanel — GOAL_KICK_SETUP_GK (goal-kicking team reposition window)', () => {
  it('the opposing manager (home) sees only a waiting message reading "Attacking team is repositioning…", no buttons', () => {
    useGameStore.setState({ gameState: goalKickState('GOAL_KICK_SETUP_GK'), playerSlot: 1 });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText('Goal Kick')).toBeDefined();
    expect(screen.getByText(/Attacking team is repositioning/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the goal-kicking manager (away) sees the eligibility helper and a Confirm button', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', {
        goalKickEligibleIds: { gkTeam: ['away-1', 'away-2'], opponent: [] },
      }),
      playerSlot: 2,
    });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText('Goal Kick!')).toBeDefined();
    expect(screen.getByText(/2 players still eligible to move/)).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn.textContent).toBe('Confirm');
  });

  it('remaining excludes eligible pieces already at goalKickUsedPace > 0 or already in movedPieceIds', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', {
        goalKickEligibleIds: { gkTeam: ['away-1', 'away-2', 'away-3'], opponent: [] },
        goalKickUsedPace: { 'away-1': 2 },
        movedPieceIds: ['away-2'],
      }),
      playerSlot: 2,
    });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText(/1 players still eligible to move/)).toBeDefined();
  });

  it('opens the soft end-turn confirm dialog when Confirm is clicked with eligible pieces remaining', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', {
        goalKickEligibleIds: { gkTeam: ['away-1'], opponent: [] },
      }),
      playerSlot: 2,
    });
    render(<GoalKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(screen.getByText(/1 players left to reposition, are you sure/)).toBeDefined();
    expect(emitMock).not.toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
  });

  it('"Yes, end turn" calls emitEndTurn exactly once and closes the dialog', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', {
        goalKickEligibleIds: { gkTeam: ['away-1'], opponent: [] },
      }),
      playerSlot: 2,
    });
    render(<GoalKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, end turn/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('"Cancel" closes the dialog without emitting', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', {
        goalKickEligibleIds: { gkTeam: ['away-1'], opponent: [] },
      }),
      playerSlot: 2,
    });
    render(<GoalKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(emitMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('clicking Confirm with zero eligible pieces remaining emits End Turn immediately (no dialog)', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', {
        goalKickEligibleIds: { gkTeam: ['away-1'], opponent: [] },
        goalKickUsedPace: { 'away-1': 6 },
      }),
      playerSlot: 2,
    });
    render(<GoalKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });
});

describe('GoalKickSetupPanel — GOAL_KICK_SETUP_OPPONENT (defending team reposition window)', () => {
  it('the goal-kicking manager (away) sees a waiting message reading "Defending team is repositioning…"', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_OPPONENT'),
      playerSlot: 2,
    });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText(/Defending team is repositioning/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the opposing (defending) manager (home) sees the active panel with a Confirm button', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_OPPONENT', {
        goalKickEligibleIds: { gkTeam: [], opponent: ['home-1'] },
      }),
      playerSlot: 1,
    });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText(/1 players still eligible to move/)).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });
});

describe('GoalKickSetupPanel — GOAL_KICK_CHOICE', () => {
  it('the opposing manager (home) sees only a waiting message, no buttons', () => {
    useGameStore.setState({ gameState: goalKickState('GOAL_KICK_CHOICE'), playerSlot: 1 });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText(/Keeper is choosing how to take the goal kick/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the goal-kicking manager (away) sees exactly "Kick" and "Standard Pass" buttons', () => {
    useGameStore.setState({ gameState: goalKickState('GOAL_KICK_CHOICE'), playerSlot: 2 });
    render(<GoalKickSetupPanel />);
    const kickBtn = screen.getByRole('button', { name: /^kick$/i });
    const standardBtn = screen.getByRole('button', { name: /^standard pass$/i });
    expect(kickBtn.textContent).toBe('Kick');
    expect(standardBtn.textContent).toBe('Standard Pass');
  });

  it('clicking "Kick" calls emitGoalKickChoice(\'kick\')', () => {
    useGameStore.setState({ gameState: goalKickState('GOAL_KICK_CHOICE'), playerSlot: 2 });
    render(<GoalKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^kick$/i }));
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_GOAL_KICK_CHOICE, 'kick');
  });

  it('clicking "Standard Pass" calls emitGoalKickChoice(\'standard\')', () => {
    useGameStore.setState({ gameState: goalKickState('GOAL_KICK_CHOICE'), playerSlot: 2 });
    render(<GoalKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^standard pass$/i }));
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_GOAL_KICK_CHOICE, 'standard');
  });
});

describe('GoalKickSetupPanel — GOAL_KICK_TARGET', () => {
  it('the opposing manager (home) sees a waiting message reading "Keeper is choosing a kick target…"', () => {
    useGameStore.setState({ gameState: goalKickState('GOAL_KICK_TARGET'), playerSlot: 1 });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText(/Keeper is choosing a kick target/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the goal-kicking manager (away) sees the target-selection helper text and no CTA', () => {
    useGameStore.setState({ gameState: goalKickState('GOAL_KICK_TARGET'), playerSlot: 2 });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText('Goal Kick!')).toBeDefined();
    expect(screen.getByText('Select a teammate to head the ball.')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('GoalKickSetupPanel — GOAL_KICK_MOVE (3-hex travel window)', () => {
  it('the non-active manager sees a waiting message', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_MOVE', { activeTeam: 'away' }),
      playerSlot: 1, // home, not active
    });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText(/Attacking team is repositioning/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the active manager sees "Ball in Air!" helper and a Confirm button, pending while goalKickMovedPieceId is null', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_MOVE', {
        activeTeam: 'away',
        goalKickMovedPieceId: null,
      }),
      playerSlot: 2,
    });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText('Ball in Air!')).toBeDefined();
    expect(screen.getByText('Move 1 player to receive the ball (max 3 hexes).')).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn.textContent).toBe('Confirm');
  });

  it('clicking Confirm once goalKickMovedPieceId is set emits End Turn immediately (ready, no dialog)', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_MOVE', {
        activeTeam: 'away',
        goalKickMovedPieceId: 'away-1',
      }),
      playerSlot: 2,
    });
    render(<GoalKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('the waiting message reads "Defending team is repositioning…" when the active team is not the goal-kicking team', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_MOVE', { activeTeam: 'home', goalKickTeam: 'away' }),
      playerSlot: 2, // away — not active
    });
    render(<GoalKickSetupPanel />);
    expect(screen.getByText(/Defending team is repositioning/)).toBeDefined();
  });
});

describe('GoalKickSetupPanel — error display', () => {
  it('surfaces a non-null gameError in every branch (GOAL_KICK_SETUP_GK example), humanised (Plan 37-16)', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', {
        goalKickEligibleIds: { gkTeam: ['away-1'], opponent: [] },
      }),
      playerSlot: 2,
      gameError: 'WRONG_PIECE',
    });
    render(<GoalKickSetupPanel />);
    expect(screen.queryByText('WRONG_PIECE')).toBeNull();
    expect(screen.getByText(restartErrorMessage('WRONG_PIECE') ?? '')).toBeDefined();
  });

  it('surfaces a non-null gameError during GOAL_KICK_CHOICE, humanised (Plan 37-16)', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_CHOICE'),
      playerSlot: 2,
      gameError: 'WRONG_TEAM',
    });
    render(<GoalKickSetupPanel />);
    expect(screen.queryByText('WRONG_TEAM')).toBeNull();
    expect(screen.getByText(restartErrorMessage('WRONG_TEAM') ?? '')).toBeDefined();
  });

  it('surfaces a non-null gameError during GOAL_KICK_TARGET, humanised (Plan 37-16)', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_TARGET'),
      playerSlot: 2,
      gameError: 'INVALID_TARGET',
    });
    render(<GoalKickSetupPanel />);
    expect(screen.queryByText('INVALID_TARGET')).toBeNull();
    expect(screen.getByText(restartErrorMessage('INVALID_TARGET') ?? '')).toBeDefined();
  });

  it('surfaces a non-null gameError during GOAL_KICK_MOVE, humanised (Plan 37-16)', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_MOVE', { activeTeam: 'away' }),
      playerSlot: 2,
      gameError: 'PACE_EXCEEDED',
    });
    render(<GoalKickSetupPanel />);
    expect(screen.queryByText('PACE_EXCEEDED')).toBeNull();
    expect(screen.getByText(restartErrorMessage('PACE_EXCEEDED') ?? '')).toBeDefined();
  });

  // Plan 37-16 Task 2: same gameError:'OFF_PITCH' humanisation assertion driven across all
  // four phase branches, reusing the file's goalKickState(phase, overrides) helper.
  it('humanises gameError:OFF_PITCH in GOAL_KICK_SETUP_GK', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', {
        goalKickEligibleIds: { gkTeam: ['away-1'], opponent: [] },
      }),
      playerSlot: 2,
      gameError: 'OFF_PITCH',
    });
    render(<GoalKickSetupPanel />);
    expect(screen.queryByText('OFF_PITCH')).toBeNull();
    expect(screen.getByText(restartErrorMessage('OFF_PITCH') ?? '')).toBeDefined();
  });

  it('humanises gameError:MOVE_INVALID in GOAL_KICK_SETUP_GK — the code the reposition-window rejections actually emit', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_SETUP_GK', {
        goalKickEligibleIds: { gkTeam: ['away-1'], opponent: [] },
      }),
      playerSlot: 2,
      gameError: 'MOVE_INVALID',
    });
    render(<GoalKickSetupPanel />);
    expect(screen.queryByText('MOVE_INVALID')).toBeNull();
    expect(screen.getByText(restartErrorMessage('MOVE_INVALID') ?? '')).toBeDefined();
  });

  it('humanises gameError:OFF_PITCH in GOAL_KICK_CHOICE', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_CHOICE'),
      playerSlot: 2,
      gameError: 'OFF_PITCH',
    });
    render(<GoalKickSetupPanel />);
    expect(screen.queryByText('OFF_PITCH')).toBeNull();
    expect(screen.getByText(restartErrorMessage('OFF_PITCH') ?? '')).toBeDefined();
  });

  it('humanises gameError:OFF_PITCH in GOAL_KICK_TARGET', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_TARGET'),
      playerSlot: 2,
      gameError: 'OFF_PITCH',
    });
    render(<GoalKickSetupPanel />);
    expect(screen.queryByText('OFF_PITCH')).toBeNull();
    expect(screen.getByText(restartErrorMessage('OFF_PITCH') ?? '')).toBeDefined();
  });

  it('humanises gameError:OFF_PITCH in GOAL_KICK_MOVE', () => {
    useGameStore.setState({
      gameState: goalKickState('GOAL_KICK_MOVE', { activeTeam: 'away' }),
      playerSlot: 2,
      gameError: 'OFF_PITCH',
    });
    render(<GoalKickSetupPanel />);
    expect(screen.queryByText('OFF_PITCH')).toBeNull();
    expect(screen.getByText(restartErrorMessage('OFF_PITCH') ?? '')).toBeDefined();
  });
});
