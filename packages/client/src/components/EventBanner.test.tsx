import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { ActionEvent, GamePhase } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { EventBanner, RESTART_BANNERS } from './EventBanner.js';

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

function setPhase(phase: GamePhase) {
  useGameStore.setState({
    gameState: { ...mockMovementState, eventLog: [], phase },
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
          ballAfter: { position: { q: 19, r: 14 }, carrierId: null },
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

// ---------------------------------------------------------------------------
// 38-19 (38-15 defect 4): restart banners (phase-entry, RESTART_BANNERS table)
// ---------------------------------------------------------------------------

describe('restart banners (38-15 defect 4)', () => {
  it.each(Object.entries(RESTART_BANNERS))(
    'shows "%s" banner when entering phase %s',
    (phase, message) => {
      // beforeEach seeds a non-restart phase ('MOVE' via mockMovementState).
      render(<EventBanner />);

      act(() => {
        setPhase(phase as GamePhase);
      });

      expect(screen.getByText(message)).toBeDefined();
    },
  );

  it('does NOT fire a banner on first mount into a restart phase (reconnect snapshot)', () => {
    // A reconnecting client's first render can land directly on a restart phase — this must
    // not be treated as a transition (T-38-64 "reconnect snapshot to banner").
    useGameStore.setState({
      gameState: { ...mockMovementState, eventLog: [], phase: 'THROW_IN_SETUP' },
    });

    render(<EventBanner />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('fires the restart banner once per entry, not once per broadcast while the phase is active', () => {
    render(<EventBanner />);

    act(() => {
      setPhase('THROW_IN_SETUP');
    });
    expect(screen.getByText('Throw In!')).toBeDefined();

    // Dismiss via the same fake-timer advance the other auto-dismiss tests use.
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByRole('status')).toBeNull();

    // Re-broadcast of the SAME restart phase (e.g. another action inside the restart setup
    // window) must not re-fire the banner.
    act(() => {
      setPhase('THROW_IN_SETUP');
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does NOT fire a banner for a non-restart phase transition (MOVE -> PASS)', () => {
    render(<EventBanner />);

    act(() => {
      setPhase('PASS');
    });

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('uses the notable variant and the 1000ms duration, same as the turnover banners', () => {
    render(<EventBanner />);

    act(() => {
      setPhase('THROW_IN_SETUP');
    });

    const banner = screen.getByRole('status');
    expect(banner.className).toContain('notable');
    expect(banner.style.animationDuration).toBe('1000ms');
  });

  // Plan 38-28 (T-38-94): re-keying RESTART_BANNERS off the deleted CORNER_KICK_CLEAR_OUT
  // phase onto CORNER_KICK_GK_SETUP_ATTACKING (the corner sequence's new entry phase) must not
  // silently drop the Corner Kick banner shipped for 38-15 defect 4/38-19. Fires once on entry
  // to the attacking-GK window and does not re-fire on the very next corner phase transition.
  it('fires "Corner Kick!" once on entry to CORNER_KICK_GK_SETUP_ATTACKING and not again on the transition to CORNER_KICK_GK_SETUP_DEFENDING', () => {
    render(<EventBanner />);

    act(() => {
      setPhase('CORNER_KICK_GK_SETUP_ATTACKING');
    });
    expect(screen.getByText('Corner Kick!')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByRole('status')).toBeNull();

    act(() => {
      setPhase('CORNER_KICK_GK_SETUP_DEFENDING');
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
