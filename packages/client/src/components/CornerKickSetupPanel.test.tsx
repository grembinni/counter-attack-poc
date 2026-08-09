import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { CornerKickSetupPanel } from './CornerKickSetupPanel.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

afterEach(() => cleanup());

type CornerKickPhase =
  | 'CORNER_KICK_GK_SETUP_ATTACKING'
  | 'CORNER_KICK_GK_SETUP_DEFENDING'
  | 'CORNER_KICK_TAKER_SELECT'
  | 'CORNER_KICK_REPOSITION'
  | 'CORNER_KICK_FINAL_SETUP'
  | 'PASS'
  | 'MOVE';

/** Seeds a corner-kick-phase state. cornerKickTeam defaults to 'away' (CORNER-01..06). */
function cornerKickState(
  phase: CornerKickPhase,
  overrides: Partial<typeof mockMovementState> = {},
) {
  return {
    ...mockMovementState,
    phase,
    cornerKickTeam: 'away' as const,
    cornerKickHex: { q: 36, r: 1 },
    cornerKickTakerId: null,
    cornerKickStageIndex: 0 as const,
    cornerKickStagePlacedIds: [] as readonly string[],
    cornerKickActivatedIds: [] as readonly string[],
    cornerKickEligibleIds: {
      attacking: [] as readonly string[],
      defending: [] as readonly string[],
    },
    cornerKickMoveSlot: 'ATTACKER' as const,
    cornerKickMovedPieceId: null,
    activeTeam: 'away' as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: cornerKickState('CORNER_KICK_GK_SETUP_ATTACKING'),
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 2, // away
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
    selectedPassType: null,
  });
});

describe('CornerKickSetupPanel — phase gating', () => {
  it('returns null when phase is not a corner phase and not PASS with cornerKickTeam set', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<CornerKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null during PASS when cornerKickTeam is null (an ordinary pass)', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', cornerKickTeam: null },
    });
    const { container } = render(<CornerKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when cornerKickTeam is null', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_ATTACKING', { cornerKickTeam: null }),
    });
    const { container } = render(<CornerKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when cornerKickTeam is undefined', () => {
    const state = cornerKickState('CORNER_KICK_GK_SETUP_ATTACKING');
    delete (state as { cornerKickTeam?: 'home' | 'away' | null }).cornerKickTeam;
    useGameStore.setState({ gameState: state });
    const { container } = render(<CornerKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when playerSlot is null (useMyTeam returns null)', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_ATTACKING'),
      playerSlot: null,
    });
    const { container } = render(<CornerKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('CornerKickSetupPanel — CORNER_KICK_GK_SETUP_ATTACKING', () => {
  it('the opposing manager (home) sees only a waiting message reading "Attacking team is repositioning…", no buttons', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_ATTACKING'),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText('Corner Kick')).toBeDefined();
    expect(screen.getByText(/Attacking team is repositioning/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the attacking manager (away) sees the GK-placement helper text and a Confirm button', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_ATTACKING'),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText('Goalkeeper: choose a new position, then Confirm.')).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn.textContent).toBe('Confirm');
  });

  it('clicking Confirm calls emitEndTurn immediately (no dialog — placement is uncapped)', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_ATTACKING'),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });
});

describe('CornerKickSetupPanel — CORNER_KICK_GK_SETUP_DEFENDING', () => {
  it('the attacking manager (away) sees a waiting message reading "Defending team is repositioning…"', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_DEFENDING'),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText(/Defending team is repositioning/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the defending manager (home) sees the active panel with a Confirm button', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_DEFENDING'),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText('Goalkeeper: choose a new position, then Confirm.')).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });
});

describe('CornerKickSetupPanel — CORNER_KICK_TAKER_SELECT', () => {
  it('the opposing (defending) manager sees a waiting message reading "Attacking team is choosing a corner-taker…", no buttons', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_TAKER_SELECT'),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText(/Attacking team is choosing a corner-taker/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the kicking manager (away) sees "Choose a player to take the corner kick." with a disabled Confirm and error text when no piece is selected', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_TAKER_SELECT'),
      playerSlot: 2,
      selectedPieceId: null,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText('Choose a player to take the corner kick.')).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn).toHaveProperty('disabled', true);
    expect(screen.getByText('Select a player to take the corner kick first.')).toBeDefined();
  });

  it('clicking Confirm with a selected piece calls emitCornerKickTaker(pieceId)', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_TAKER_SELECT'),
      playerSlot: 2,
      selectedPieceId: 'away-3',
    });
    render(<CornerKickSetupPanel />);
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn).toHaveProperty('disabled', false);
    fireEvent.click(confirmBtn);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_CORNER_KICK_TAKER, 'away-3');
  });
});

describe('CornerKickSetupPanel — CORNER_KICK_REPOSITION (alternating 6-hex window)', () => {
  it('stage 0 (attacking): the defending manager (home) sees "Attacking team is repositioning…"', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', { cornerKickStageIndex: 0 }),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText(/Attacking team is repositioning/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('stage 0 (attacking): the attacking manager (away) sees the eligibility helper (row 1 + attacking row 2) and a Confirm button', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickStageIndex: 0,
        cornerKickEligibleIds: { attacking: ['away-1', 'away-2'], defending: [] },
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    expect(
      screen.getByText(/2 players still eligible to move this round — up to 2\./),
    ).toBeDefined();
    expect(
      screen.getByText(
        /Pick a player, then pick their new position\. A repositioned player is done for this window\./,
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });

  it('stage 1 (defending): the exclusion-radius sentence renders with CORNER_EXCLUSION_RADIUS interpolated', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickStageIndex: 1,
        cornerKickEligibleIds: { attacking: [], defending: ['home-1'] },
      }),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(
      screen.getByText(
        /Pick a player, then pick their new position — not within 3 hexes of the corner\. A repositioned player is done for this window\./,
      ),
    ).toBeDefined();
  });

  it('remaining excludes every activated piece, regardless of whether it was touched this stage or an earlier one', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickStageIndex: 0,
        cornerKickEligibleIds: { attacking: ['away-1', 'away-2', 'away-3'], defending: [] },
        cornerKickActivatedIds: ['away-1', 'away-2'],
        cornerKickStagePlacedIds: ['away-2'],
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    // away-1 and away-2 are both activated (no same-stage exemption) — only away-3 remains.
    expect(screen.getByText(/1 players still eligible to move this round/)).toBeDefined();
  });

  it('remaining reaches 0 once cornerKickStagePlacedIds.length equals stage.max, even with unactivated eligible pieces left', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickStageIndex: 0,
        cornerKickEligibleIds: { attacking: ['away-1', 'away-2', 'away-3'], defending: [] },
        cornerKickActivatedIds: ['away-1', 'away-2'],
        cornerKickStagePlacedIds: ['away-1', 'away-2'],
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    // Stage full (2 placed === stage.max): the whole stage is closed, so remaining is 0 even
    // though away-3 is still eligible and unactivated.
    expect(screen.getByText(/0 players still eligible to move this round/)).toBeDefined();
  });

  it('opens the soft end-turn confirm dialog when Confirm is clicked with eligible pieces remaining', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickEligibleIds: { attacking: ['away-1'], defending: [] },
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(screen.getByText(/1 players left to reposition, are you sure/)).toBeDefined();
    expect(emitMock).not.toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
  });

  it('"Yes, end turn" calls emitEndTurn exactly once and closes the dialog', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickEligibleIds: { attacking: ['away-1'], defending: [] },
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, end turn/i }));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('"Cancel" closes the dialog without emitting', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickEligibleIds: { attacking: ['away-1'], defending: [] },
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(emitMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('clicking Confirm with zero eligible pieces remaining emits End Turn immediately (no dialog)', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickEligibleIds: { attacking: ['away-1'], defending: [] },
        cornerKickActivatedIds: ['away-1'],
        cornerKickStagePlacedIds: [],
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('stage 1 (defending): the attacking manager (away) sees "Defending team is repositioning…"', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', { cornerKickStageIndex: 1 }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText(/Defending team is repositioning/)).toBeDefined();
  });

  it('stage 1 (defending): the defending manager (home) sees the active panel', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickStageIndex: 1,
        cornerKickEligibleIds: { attacking: [], defending: ['home-1'] },
      }),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });

  it('CORNER_KICK_REPOSITION: renders an Undo button for the acting manager', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickEligibleIds: { attacking: ['away-1'], defending: [] },
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByRole('button', { name: /^undo$/i })).toBeDefined();
  });

  it('CORNER_KICK_REPOSITION: Undo is disabled with no MOVE after the last stage boundary', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickEligibleIds: { attacking: ['away-1'], defending: [] },
        eventLog: [{ type: 'CORNER_KICK_TAKER_PLACED', timestamp: 1 }] as never,
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    const undoBtn = screen.getByRole('button', { name: /^undo$/i });
    expect(undoBtn).toHaveProperty('disabled', true);
    fireEvent.click(undoBtn);
    expect(emitMock).not.toHaveBeenCalledWith(ClientEvents.GAME_UNDO);
  });

  it('CORNER_KICK_REPOSITION: Undo is enabled and emits GAME_UNDO once a MOVE exists in the current stage', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', {
        cornerKickEligibleIds: { attacking: ['away-1'], defending: [] },
        eventLog: [
          { type: 'CORNER_KICK_TAKER_PLACED', timestamp: 1 },
          {
            type: 'MOVE',
            pieceId: 'away-1',
            from: { q: 36, r: 1 },
            to: { q: 35, r: 1 },
            timestamp: 2,
          },
        ] as never,
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    const undoBtn = screen.getByRole('button', { name: /^undo$/i });
    expect(undoBtn).toHaveProperty('disabled', false);
    fireEvent.click(undoBtn);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_UNDO);
  });
});

describe('CornerKickSetupPanel — CORNER_KICK_FINAL_SETUP (pre-kick 3-hex window)', () => {
  it('ATTACKER slot: the defending manager (home) sees "Attacking team is repositioning…"', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_FINAL_SETUP', { cornerKickMoveSlot: 'ATTACKER' }),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText(/Attacking team is repositioning/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ATTACKER slot: the attacking manager (away) sees "Reposition 1 player — up to 3 hexes." and a Confirm button', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_FINAL_SETUP', {
        cornerKickMoveSlot: 'ATTACKER',
        cornerKickMovedPieceId: null,
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText('Reposition 1 player — up to 3 hexes.')).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn.textContent).toBe('Confirm');
  });

  it('clicking Confirm once cornerKickMovedPieceId is set emits End Turn immediately (ready, no dialog)', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_FINAL_SETUP', {
        cornerKickMoveSlot: 'ATTACKER',
        cornerKickMovedPieceId: 'away-1',
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_END_TURN);
    expect(screen.queryByText(/are you sure/)).toBeNull();
  });

  it('DEFENDER slot: the attacking manager (away) sees "Defending team is repositioning…"', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_FINAL_SETUP', { cornerKickMoveSlot: 'DEFENDER' }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText(/Defending team is repositioning/)).toBeDefined();
  });

  it('CORNER_KICK_FINAL_SETUP: Undo is enabled and emits GAME_UNDO once a CORNER_KICK_MOVE exists', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_FINAL_SETUP', {
        cornerKickMoveSlot: 'ATTACKER',
        cornerKickMovedPieceId: 'away-1',
        eventLog: [
          { type: 'CORNER_KICK_STAGE_ADVANCE', timestamp: 1 },
          {
            type: 'CORNER_KICK_MOVE',
            slot: 'ATTACKER',
            pieceId: 'away-1',
            from: { q: 36, r: 1 },
            to: { q: 35, r: 1 },
            timestamp: 2,
          },
        ] as never,
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    const undoBtn = screen.getByRole('button', { name: /^undo$/i });
    expect(undoBtn).toHaveProperty('disabled', false);
    fireEvent.click(undoBtn);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_UNDO);
  });

  it('CORNER_KICK_FINAL_SETUP: Undo is disabled with no CORNER_KICK_MOVE after the boundary', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_FINAL_SETUP', {
        cornerKickMoveSlot: 'ATTACKER',
        cornerKickMovedPieceId: null,
        eventLog: [{ type: 'CORNER_KICK_STAGE_ADVANCE', timestamp: 1 }] as never,
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    const undoBtn = screen.getByRole('button', { name: /^undo$/i });
    expect(undoBtn).toHaveProperty('disabled', true);
  });
});

describe('CornerKickSetupPanel — PASS phase High/Low Pass choice (CORNER-04/05)', () => {
  it('the defending manager (home) sees a waiting message, no buttons', () => {
    useGameStore.setState({
      gameState: cornerKickState('PASS', {
        ball: { position: { q: 36, r: 1 }, carrierId: 'away-9', lastTouchedBy: null },
      }),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.getByText(/Attacking team is choosing a pass type/)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the kicking manager (away) sees exactly "High Pass" and "Low Pass" buttons with the UI-SPEC tooltips', () => {
    useGameStore.setState({
      gameState: cornerKickState('PASS', {
        ball: { position: { q: 36, r: 1 }, carrierId: 'away-9', lastTouchedBy: null },
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    const highBtn = screen.getByRole('button', { name: /^high pass$/i });
    const lowBtn = screen.getByRole('button', { name: /^low pass$/i });
    expect(highBtn.textContent).toBe('High Pass');
    expect(lowBtn.textContent).toBe('Low Pass');
    expect(highBtn.getAttribute('title')).toMatch(/combined score of 8 or more/);
    expect(lowBtn.getAttribute('title')).toMatch(/no header required/);
  });

  it('clicking "High Pass" selects the HIGH_PASS pass type', () => {
    useGameStore.setState({
      gameState: cornerKickState('PASS', {
        ball: { position: { q: 36, r: 1 }, carrierId: 'away-9', lastTouchedBy: null },
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^high pass$/i }));
    expect(useGameStore.getState().selectedPassType).toBe('HIGH_PASS');
  });

  it('clicking "Low Pass" selects the STANDARD_PASS pass type (the Throw-In precedent: reuse, no new label)', () => {
    useGameStore.setState({
      gameState: cornerKickState('PASS', {
        ball: { position: { q: 36, r: 1 }, carrierId: 'away-9', lastTouchedBy: null },
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^low pass$/i }));
    expect(useGameStore.getState().selectedPassType).toBe('STANDARD_PASS');
  });
});

describe('CornerKickSetupPanel — error display', () => {
  it('surfaces a non-null gameError, humanised (mirrors Plan 37-16), during CORNER_KICK_GK_SETUP_ATTACKING', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_ATTACKING'),
      playerSlot: 2,
      gameError: 'WRONG_PIECE',
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByText('WRONG_PIECE')).toBeNull();
    expect(screen.getByText(restartErrorMessage('WRONG_PIECE') ?? '')).toBeDefined();
  });

  it('surfaces a non-null gameError, humanised, during CORNER_KICK_TAKER_SELECT', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_TAKER_SELECT'),
      playerSlot: 2,
      gameError: 'MOVE_INVALID',
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByText('MOVE_INVALID')).toBeNull();
    expect(screen.getByText(restartErrorMessage('MOVE_INVALID') ?? '')).toBeDefined();
  });

  it('surfaces a non-null gameError, humanised, during CORNER_KICK_REPOSITION', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION'),
      playerSlot: 2,
      gameError: 'OFF_PITCH',
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByText('OFF_PITCH')).toBeNull();
    expect(screen.getByText(restartErrorMessage('OFF_PITCH') ?? '')).toBeDefined();
  });

  it('surfaces a non-null gameError, humanised, during CORNER_KICK_FINAL_SETUP', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_FINAL_SETUP'),
      playerSlot: 2,
      gameError: 'PACE_EXCEEDED',
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByText('PACE_EXCEEDED')).toBeNull();
    expect(screen.getByText(restartErrorMessage('PACE_EXCEEDED') ?? '')).toBeDefined();
  });

  it('surfaces a non-null gameError, humanised, during the PASS High/Low choice', () => {
    useGameStore.setState({
      gameState: cornerKickState('PASS', {
        ball: { position: { q: 36, r: 1 }, carrierId: 'away-9', lastTouchedBy: null },
      }),
      playerSlot: 2,
      gameError: 'RANGE_EXCEEDED',
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByText('RANGE_EXCEEDED')).toBeNull();
    expect(screen.getByText(restartErrorMessage('RANGE_EXCEEDED') ?? '')).toBeDefined();
  });
});

describe('Undo is absent from the goalkeeper, taker-select, waiting-state and pass-choice branches', () => {
  it('CORNER_KICK_GK_SETUP_ATTACKING: no Undo control renders for the acting manager', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_ATTACKING'),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByRole('button', { name: /^undo$/i })).toBeNull();
  });

  it('CORNER_KICK_GK_SETUP_DEFENDING: no Undo control renders for the acting manager', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_GK_SETUP_DEFENDING'),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByRole('button', { name: /^undo$/i })).toBeNull();
  });

  it('CORNER_KICK_TAKER_SELECT: no Undo control renders for the acting manager', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_TAKER_SELECT'),
      playerSlot: 2,
      selectedPieceId: 'away-3',
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByRole('button', { name: /^undo$/i })).toBeNull();
  });

  it('a waiting-state branch (CORNER_KICK_REPOSITION, non-acting manager): no Undo control renders', () => {
    useGameStore.setState({
      gameState: cornerKickState('CORNER_KICK_REPOSITION', { cornerKickStageIndex: 0 }),
      playerSlot: 1,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByRole('button', { name: /^undo$/i })).toBeNull();
  });

  it('the PASS-phase High/Low pass-choice branch: no Undo control renders', () => {
    useGameStore.setState({
      gameState: cornerKickState('PASS', {
        ball: { position: { q: 36, r: 1 }, carrierId: 'away-9', lastTouchedBy: null },
      }),
      playerSlot: 2,
    });
    render(<CornerKickSetupPanel />);
    expect(screen.queryByRole('button', { name: /^undo$/i })).toBeNull();
  });
});
