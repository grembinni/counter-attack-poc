import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { PenaltyKickSetupPanel } from './PenaltyKickSetupPanel.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

afterEach(() => cleanup());

type PenaltyKickPhase =
  | 'PENALTY_KICK_SETUP_ATTACKING'
  | 'PENALTY_KICK_SETUP_DEFENDING'
  | 'PENALTY_KICK_TAKER_SELECT'
  | 'PENALTY_KICK';

/** Seeds a penalty-kick-phase state. penaltyKickTeam defaults to 'away' (PEN-01/PEN-02). */
function penaltyKickState(
  phase: PenaltyKickPhase,
  overrides: Partial<typeof mockMovementState> = {},
) {
  return {
    ...mockMovementState,
    phase,
    penaltyKickTeam: 'away' as const,
    penaltyKickEligibleIds: {
      attacking: [] as readonly string[],
      defending: [] as readonly string[],
    },
    penaltyKickUsedPace: {},
    penaltyKickTakerId: null,
    activeTeam: 'away' as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING'),
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

describe('PenaltyKickSetupPanel — phase gating', () => {
  it('returns null when phase is not one of the four penalty-kick phases', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<PenaltyKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when penaltyKickTeam is null', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING', { penaltyKickTeam: null }),
    });
    const { container } = render(<PenaltyKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when penaltyKickTeam is undefined', () => {
    const state = penaltyKickState('PENALTY_KICK_SETUP_ATTACKING');
    delete (state as { penaltyKickTeam?: 'home' | 'away' | null }).penaltyKickTeam;
    useGameStore.setState({ gameState: state });
    const { container } = render(<PenaltyKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when playerSlot is null (useMyTeam returns null)', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING'),
      playerSlot: null,
    });
    const { container } = render(<PenaltyKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PenaltyKickSetupPanel — PENALTY_KICK_SETUP_ATTACKING (attacking-team reposition window)', () => {
  it('the acting manager (away) sees the heading, eligible-count row, penalty-area constraint row, and a Confirm button', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING', {
        penaltyKickEligibleIds: { attacking: ['away-1', 'away-2'], defending: [] },
      }),
      playerSlot: 2,
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.getByText('Penalty Kick')).toBeDefined();
    expect(screen.getByText(/2 players still eligible to move/)).toBeDefined();
    expect(
      screen.getByText('Only the penalty taker and goalkeeper may stand in the penalty area.'),
    ).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn.textContent).toBe('Confirm');
  });

  it('remaining excludes eligible pieces already at penaltyKickUsedPace > 0 or already in movedPieceIds', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING', {
        penaltyKickEligibleIds: { attacking: ['away-1', 'away-2', 'away-3'], defending: [] },
        penaltyKickUsedPace: { 'away-1': 1 },
        movedPieceIds: ['away-2'],
      }),
      playerSlot: 2,
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.getByText(/1 players still eligible to move/)).toBeDefined();
  });

  it('the non-acting manager (home) sees only "Attacking is repositioning…", no buttons', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING'),
      playerSlot: 1,
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.getByText('Penalty Kick')).toBeDefined();
    expect(screen.getByText(/Attacking is repositioning/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens the soft end-turn confirm dialog when Confirm is clicked with eligible pieces remaining', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING', {
        penaltyKickEligibleIds: { attacking: ['away-1'], defending: [] },
      }),
      playerSlot: 2,
    });
    render(<PenaltyKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(screen.getByText(/1 players left to reposition, are you sure/)).toBeDefined();
    expect(emitMock).not.toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
  });

  it('"Yes, end turn" calls emitEndTurn exactly once and closes the dialog', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING', {
        penaltyKickEligibleIds: { attacking: ['away-1'], defending: [] },
      }),
      playerSlot: 2,
    });
    render(<PenaltyKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, end turn/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('"Cancel" closes the dialog without emitting', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING', {
        penaltyKickEligibleIds: { attacking: ['away-1'], defending: [] },
      }),
      playerSlot: 2,
    });
    render(<PenaltyKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(emitMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('clicking Confirm with zero eligible pieces remaining emits End Turn immediately (no dialog)', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING', {
        penaltyKickEligibleIds: { attacking: ['away-1'], defending: [] },
        penaltyKickUsedPace: { 'away-1': 1 },
      }),
      playerSlot: 2,
    });
    render(<PenaltyKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('surfaces a non-null gameError, humanised', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_ATTACKING', {
        penaltyKickEligibleIds: { attacking: ['away-1'], defending: [] },
      }),
      playerSlot: 2,
      gameError: 'MOVE_INVALID',
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.queryByText('MOVE_INVALID')).toBeNull();
    expect(screen.getByText(restartErrorMessage('MOVE_INVALID') ?? '')).toBeDefined();
  });
});

describe('PenaltyKickSetupPanel — PENALTY_KICK_SETUP_DEFENDING (defending-team reposition window)', () => {
  it('the acting side is the team opposite penaltyKickTeam, and the waiting text reads "Defending" for the kicking manager', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_DEFENDING'),
      playerSlot: 2, // away === penaltyKickTeam, not acting during the defending window
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.getByText(/Defending is repositioning/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the opposing (defending) manager (home) sees the active panel with a Confirm button', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_SETUP_DEFENDING', {
        penaltyKickEligibleIds: { attacking: [], defending: ['home-1'] },
      }),
      playerSlot: 1,
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.getByText(/1 players still eligible to move/)).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });
});

describe('PenaltyKickSetupPanel — PENALTY_KICK_TAKER_SELECT', () => {
  it('the kicking manager (away), with no piece selected, sees "Choose your penalty taker.", a disabled Confirm button, and the select-first message', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_TAKER_SELECT'),
      playerSlot: 2,
      selectedPieceId: null,
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.getByText('Choose your penalty taker.')).toBeDefined();
    expect(screen.getByText('Select a player to take the penalty kick first.')).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn).toHaveProperty('disabled', true);
  });

  it('with a piece selected, Confirm is enabled and clicking it calls emitPenaltyKickTaker exactly once with that id', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_TAKER_SELECT'),
      playerSlot: 2,
      selectedPieceId: 'away-7',
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.queryByText('Select a player to take the penalty kick first.')).toBeNull();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn).toHaveProperty('disabled', false);
    fireEvent.click(confirmBtn);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_PENALTY_KICK_TAKER, 'away-7');
  });

  it('the other manager (home) sees the waiting text and no Confirm button', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_TAKER_SELECT'),
      playerSlot: 1,
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.getByText(/Attacking is choosing a penalty taker/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('surfaces a non-null gameError, humanised', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK_TAKER_SELECT'),
      playerSlot: 2,
      selectedPieceId: 'away-7',
      gameError: 'MISSING_TARGET',
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.queryByText('MISSING_TARGET')).toBeNull();
    expect(screen.getByText(restartErrorMessage('MISSING_TARGET') ?? '')).toBeDefined();
  });
});

describe('PenaltyKickSetupPanel — PENALTY_KICK (duel resolution)', () => {
  it('the kicking manager sees exactly one button, labelled Shoot, and clicking it calls emitRoll exactly once', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK', { activeTeam: 'away' }),
      playerSlot: 2,
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.getByText('Take your penalty kick.')).toBeDefined();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('Shoot');
    fireEvent.click(buttons[0]!);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_ROLL, undefined, undefined);
  });

  it('the defending manager sees a waiting message and no button', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK', { activeTeam: 'away' }),
      playerSlot: 1,
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.getByText(/Waiting for the penalty kick/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('surfaces a non-null gameError, humanised', () => {
    useGameStore.setState({
      gameState: penaltyKickState('PENALTY_KICK', { activeTeam: 'away' }),
      playerSlot: 2,
      gameError: 'DUEL_ALREADY_RESOLVED',
    });
    render(<PenaltyKickSetupPanel />);
    expect(screen.queryByText('DUEL_ALREADY_RESOLVED')).toBeNull();
    expect(screen.getByText(restartErrorMessage('DUEL_ALREADY_RESOLVED') ?? '')).toBeDefined();
  });

  it('no control in any penalty phase has a label containing Pass, High, Long or Move', () => {
    const phases: PenaltyKickPhase[] = [
      'PENALTY_KICK_SETUP_ATTACKING',
      'PENALTY_KICK_SETUP_DEFENDING',
      'PENALTY_KICK_TAKER_SELECT',
      'PENALTY_KICK',
    ];
    for (const phase of phases) {
      useGameStore.setState({
        gameState: penaltyKickState(phase, {
          penaltyKickEligibleIds: { attacking: ['away-1'], defending: ['home-1'] },
          activeTeam: 'away',
        }),
        playerSlot: 2,
        selectedPieceId: 'away-7',
      });
      const { unmount } = render(<PenaltyKickSetupPanel />);
      const labels = screen.queryAllByRole('button').map((b) => b.textContent ?? '');
      for (const label of labels) {
        expect(label).not.toMatch(/Pass|High|Long|Move/);
      }
      unmount();
    }
  });
});
