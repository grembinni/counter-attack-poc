import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { ActionEvent } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { EventBanner } from './EventBanner.js';

vi.mock('../socket.js', () => ({
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
    io: { on: vi.fn(), off: vi.fn() },
  },
}));

// Use fake timers so we can control auto-dismiss timing
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: { ...mockMovementState, eventLog: [] },
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setEventLog(eventLog: ActionEvent[]) {
  useGameStore.setState({
    gameState: { ...mockMovementState, eventLog },
  });
}

// ---------------------------------------------------------------------------
// UX-14: EventBanner — transient centered banner for key match events
// ---------------------------------------------------------------------------

describe('EventBanner — UX-14: renders nothing when eventLog is empty', () => {
  it('returns null when no events', () => {
    render(<EventBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('EventBanner — UX-14: GOAL event shows GOOOOOAL!!!', () => {
  it('shows "GOOOOOAL!!!" when a GOAL event is appended', () => {
    render(<EventBanner />);

    act(() => {
      setEventLog([
        {
          type: 'GOAL',
          scoringTeam: 'home',
          scorerId: 'home-9',
          timestamp: 1,
          ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
        },
      ]);
    });

    expect(screen.getByText('GOOOOOAL!!!')).toBeDefined();
  });
});

describe('EventBanner — UX-14: STEAL_ATTEMPT SUCCESS shows INTERCEPTION!!', () => {
  it('shows "INTERCEPTION!!" when a STEAL_ATTEMPT with result SUCCESS is appended', () => {
    render(<EventBanner />);

    act(() => {
      setEventLog([
        {
          type: 'STEAL_ATTEMPT',
          defenderId: 'away-1',
          result: 'SUCCESS',
          defenderDie: 6,
          defenderCombined: 10,
          timestamp: 1,
          ballAfter: { position: { q: 14, r: 13 }, carrierId: 'away-1' },
        },
      ]);
    });

    expect(screen.getByText('INTERCEPTION!!')).toBeDefined();
  });

  it('does NOT show banner when STEAL_ATTEMPT result is FAIL', () => {
    render(<EventBanner />);

    act(() => {
      setEventLog([
        {
          type: 'STEAL_ATTEMPT',
          defenderId: 'away-1',
          result: 'FAIL',
          defenderDie: 3,
          defenderCombined: 5,
          timestamp: 1,
          ballAfter: { position: { q: 14, r: 13 }, carrierId: 'home-9' },
        },
      ]);
    });

    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('EventBanner — UX-14: TACKLE_ATTEMPT SUCCESS shows Tackle! Turnover!', () => {
  it('shows "Tackle! Turnover!" when a TACKLE_ATTEMPT with result SUCCESS is appended', () => {
    render(<EventBanner />);

    act(() => {
      setEventLog([
        {
          type: 'TACKLE_ATTEMPT',
          defenderId: 'away-1',
          carrierId: 'home-9',
          defenderDie: 5,
          carrierDie: 2,
          defenderCombined: 9,
          carrierCombined: 5,
          result: 'SUCCESS',
          timestamp: 1,
          ballAfter: { position: { q: 14, r: 13 }, carrierId: null },
        },
      ]);
    });

    expect(screen.getByText('Tackle! Turnover!')).toBeDefined();
  });

  it('does NOT show banner when TACKLE_ATTEMPT result is FAIL', () => {
    render(<EventBanner />);

    act(() => {
      setEventLog([
        {
          type: 'TACKLE_ATTEMPT',
          defenderId: 'away-1',
          carrierId: 'home-9',
          defenderDie: 2,
          carrierDie: 5,
          defenderCombined: 4,
          carrierCombined: 8,
          result: 'FAIL',
          timestamp: 1,
          ballAfter: { position: { q: 14, r: 13 }, carrierId: 'home-9' },
        },
      ]);
    });

    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('EventBanner — UX-14: LOOSE_BALL_LAND shows Loose Ball.', () => {
  it('shows "Loose Ball." when a LOOSE_BALL_LAND event is appended', () => {
    render(<EventBanner />);

    act(() => {
      setEventLog([
        {
          type: 'LOOSE_BALL_LAND',
          from: { q: 18, r: 13 },
          to: { q: 19, r: 14 },
          timestamp: 1,
        },
      ]);
    });

    expect(screen.getByText('Loose Ball.')).toBeDefined();
  });
});

describe('EventBanner — UX-14: ref-based diff prevents re-fire on same event', () => {
  it('does NOT re-fire banner when a non-qualifying event is appended after a GOAL', () => {
    render(<EventBanner />);

    // First: show the goal banner
    act(() => {
      setEventLog([
        {
          type: 'GOAL',
          scoringTeam: 'home',
          scorerId: 'home-9',
          timestamp: 1,
          ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
        },
      ]);
    });

    expect(screen.getByText('GOOOOOAL!!!')).toBeDefined();

    // Advance past the 1000ms auto-dismiss timer so the banner clears
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Now append a non-qualifying KICK_OFF event (should NOT re-trigger goal banner)
    act(() => {
      setEventLog([
        {
          type: 'GOAL',
          scoringTeam: 'home',
          scorerId: 'home-9',
          timestamp: 1,
          ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
        },
        {
          type: 'KICK_OFF',
          timestamp: 2,
          ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
        },
      ]);
    });

    // Banner must not re-appear for the non-qualifying KICK_OFF tail event
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('EventBanner — UX-14: auto-dismisses after ~1000ms', () => {
  it('removes the banner after 1000ms', () => {
    render(<EventBanner />);

    act(() => {
      setEventLog([
        {
          type: 'GOAL',
          scoringTeam: 'home',
          scorerId: 'home-9',
          timestamp: 1,
          ballAfter: { position: { q: 18, r: 13 }, carrierId: null },
        },
      ]);
    });

    expect(screen.getByText('GOOOOOAL!!!')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.queryByRole('status')).toBeNull();
  });
});
