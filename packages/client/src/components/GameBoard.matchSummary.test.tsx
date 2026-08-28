import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { GamePhase } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { GameBoard } from './GameBoard.js';

// Wave 0 socket mock pattern (GameBoard.test.tsx precedent) — extended with
// socket.io: { on, off } for the ConnectionStatus Manager events.
vi.mock('../socket.js', () => ({
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
    io: { on: vi.fn(), off: vi.fn() },
  },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

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
// 45-05-02: scoreboard (i) icon + standalone modal mount
// ---------------------------------------------------------------------------
describe('GameBoard — 45-05-02: scoreboard (i) icon and modal mount', () => {
  // D-09: the icon must never be disabled or phase-gated. Table-driven so
  // adding a phase gate later breaks a named test, not a generic assertion.
  const PHASES_TO_CHECK: GamePhase[] = [
    'MOVE',
    'TACKLE_STEAL_PROMPT',
    'GK_DIVE_AT_FEET_PROMPT',
    'FOUL_CHOICE',
    'HALF_TIME',
    'FULL_TIME',
    'REPLAY',
  ];

  it.each(PHASES_TO_CHECK)('renders an enabled (i) icon during %s phase', (phase) => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase } });
    render(<GameBoard />);
    const icon = screen.getByTitle('View match summary');
    expect(icon).toBeDefined();
    expect((icon as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not render the modal before the icon is clicked', () => {
    render(<GameBoard />);
    expect(screen.queryByText('MATCH SUMMARY')).toBeNull();
  });

  it('opens the modal with the MATCH SUMMARY title and stats block visible when the icon is clicked', () => {
    render(<GameBoard />);
    fireEvent.click(screen.getByTitle('View match summary'));
    expect(screen.getByText('MATCH SUMMARY')).toBeDefined();
    // Stats block sanity check — POSSESSION is the first stat row rendered by
    // MatchSummaryContent.
    expect(screen.getByText('POSSESSION')).toBeDefined();
  });

  it('closes the modal when the footer Close button is clicked', () => {
    render(<GameBoard />);
    fireEvent.click(screen.getByTitle('View match summary'));
    expect(screen.getByText('MATCH SUMMARY')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('MATCH SUMMARY')).toBeNull();
  });

  it('closes the modal when the × control is clicked', () => {
    render(<GameBoard />);
    fireEvent.click(screen.getByTitle('View match summary'));
    expect(screen.getByText('MATCH SUMMARY')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Close match summary'));
    expect(screen.queryByText('MATCH SUMMARY')).toBeNull();
  });

  it('emits no socket event when the icon is clicked (T-45-17)', () => {
    render(<GameBoard />);
    fireEvent.click(screen.getByTitle('View match summary'));
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('does not alter selectedPieceId or other store state when opening the modal', () => {
    render(<GameBoard />);
    const before = useGameStore.getState().selectedPieceId;
    fireEvent.click(screen.getByTitle('View match summary'));
    expect(useGameStore.getState().selectedPieceId).toBe(before);
    expect(useGameStore.getState().selectedPieceId).toBeNull();
  });

  it('still renders the clock and phase summary unchanged with the icon row present', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, actionCount: 7 } });
    render(<GameBoard />);
    expect(screen.getByText(/7:00/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 45-05-03: MatchSummaryContent appended inside the HALF_TIME/FULL_TIME
// overlays, between their untouched headers and their untouched proceed
// controls (D-10/D-11).
// ---------------------------------------------------------------------------
describe('GameBoard — 45-05-03: HALF_TIME/FULL_TIME embedded summary', () => {
  it('renders the appended stats block in HALF_TIME, below the score header and above Start 2nd Half', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'HALF_TIME' },
    });
    render(<GameBoard />);
    // Regression: the HALF_TIME header content is still present, unmodified.
    expect(screen.getByText('HALF TIME')).toBeDefined();
    // The embedded block itself — no standalone MATCH SUMMARY title repeated.
    expect(screen.getByText('POSSESSION')).toBeDefined();
    expect(screen.queryByText('MATCH SUMMARY')).toBeNull();
    // The proceed control is still present and still below the appended block
    // in document order.
    const summaryLabel = screen.getByText('POSSESSION');
    const startButton = screen.getByRole('button', { name: 'Start 2nd Half' });
    expect(
      summaryLabel.compareDocumentPosition(startButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('the Start 2nd Half button still invokes the store emitter from its new position', () => {
    const emitHalfTimeStart = vi.fn();
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'HALF_TIME' },
      emitHalfTimeStart,
    });
    render(<GameBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'Start 2nd Half' }));
    expect(emitHalfTimeStart).toHaveBeenCalledTimes(1);
  });

  it('renders the appended stats block in FULL_TIME, below the score header and above the replay notice', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'FULL_TIME' },
    });
    render(<GameBoard />);
    expect(screen.getByText(/Replay starting/)).toBeDefined();
    expect(screen.getByText('POSSESSION')).toBeDefined();
    expect(screen.queryByText('MATCH SUMMARY')).toBeNull();
    const summaryLabel = screen.getByText('POSSESSION');
    const replayNotice = screen.getByText(/Replay starting/);
    expect(
      summaryLabel.compareDocumentPosition(replayNotice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('the same statistic values appear in the embedded HALF_TIME instance and the standalone modal', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'HALF_TIME',
        matchStats: {
          possessionActionCount: { home: 0, away: 0 },
          passesCompleted: { home: 0, away: 0 },
          tackleStealAttempts: { home: 0, away: 0 },
          tackleStealSuccesses: { home: 0, away: 0 },
          shots: { home: 4, away: 2 },
          xg: { home: 0, away: 0 },
          fouls: { home: 0, away: 0 },
          yellowCards: { home: 0, away: 0 },
          redCards: { home: 0, away: 0 },
        },
      },
    });
    render(<GameBoard />);
    // The embedded instance already shows the SHOTS row.
    expect(screen.getAllByText('SHOTS').length).toBeGreaterThanOrEqual(1);
    // Opening the standalone modal on top of it renders a second SHOTS row
    // with the same underlying data source (MatchSummaryContent, D-11).
    fireEvent.click(screen.getByTitle('View match summary'));
    expect(screen.getAllByText('SHOTS').length).toBe(2);
  });

  it('the standalone modal can open on top of a HALF_TIME overlay, both present in the document', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'HALF_TIME' },
    });
    render(<GameBoard />);
    fireEvent.click(screen.getByTitle('View match summary'));
    // Overlay still present (HALF TIME header).
    expect(screen.getByText('HALF TIME')).toBeDefined();
    // Standalone modal also present (its own title).
    expect(screen.getByText('MATCH SUMMARY')).toBeDefined();
  });
});
