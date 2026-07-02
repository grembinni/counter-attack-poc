/**
 * Phase 16 Wave 0 RED tests — PLAY-03, SELECT-01
 * UX-07 (Phase 18.4): updated to supply required selectedSpeed/onSpeedChange props.
 *
 * Tests for TeamSelectionScreen component that does not yet exist.
 * These tests MUST fail (module not found) until plan 16-03 creates
 * TeamSelectionScreen.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamSelectionScreen } from './TeamSelectionScreen.js';
import { useGameStore } from '../store/useGameStore.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
});

/** Default UX-07 props — pass to every render so existing tests stay focused on PLAY-03/SELECT-01. */
const DEFAULT_SPEED_PROPS = {
  selectedSpeed: 'standard' as const,
  onSpeedChange: vi.fn(),
};

// ---------------------------------------------------------------------------
// PLAY-03: Free Agent players NOT shown in selection screen
// ---------------------------------------------------------------------------

describe('TeamSelectionScreen — PLAY-03: only 4 named teams shown (no Free Agents)', () => {
  it('renders exactly 4 team cards (cosmos, xolos, city, crew)', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    // UX-07: speed buttons (3) are also present for home player — filter to team cards only.
    // Team cards are identified by NOT having aria-pressed (speed buttons use aria-pressed).
    const allButtons = screen.getAllByRole('button');
    const teamCards = allButtons.filter((b) => !b.hasAttribute('aria-pressed'));
    expect(teamCards).toHaveLength(4);
  });

  it('does NOT render a "FA" card or any card labelled "Free Agent" (PLAY-03)', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    // No button or element should contain "FA" or "Free Agent"
    expect(screen.queryByText(/free agent/i)).toBeNull();
    expect(screen.queryByText(/\bFA\b/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SELECT-01: Home picks first; away is disabled until home has picked
// ---------------------------------------------------------------------------

describe('TeamSelectionScreen — SELECT-01: home-first turn order', () => {
  it('all 4 team cards are enabled when playerSlot=1 (home) and homePickedTeam=null', () => {
    // Home player, no team picked yet — home player is active
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    const teamCards = allButtons.filter((b) => !b.hasAttribute('aria-pressed'));
    expect(teamCards).toHaveLength(4);
    for (const card of teamCards) {
      expect(card.hasAttribute('disabled')).toBe(false);
    }
  });

  it('all 4 team cards are disabled when playerSlot=2 (away) and homePickedTeam=null', () => {
    // Away player, home has not yet picked — away player must wait
    useGameStore.setState({ playerSlot: 2 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    // For away player, speed buttons are also disabled — filter by aria-pressed to get team cards.
    const teamCards = allButtons.filter((b) => !b.hasAttribute('aria-pressed'));
    expect(teamCards).toHaveLength(4);
    for (const card of teamCards) {
      expect(card.hasAttribute('disabled')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// SELECT-01: Struck-out card after home picks
// ---------------------------------------------------------------------------

describe('TeamSelectionScreen — SELECT-01: cosmos struck-out for away player after home picked it', () => {
  it('cosmos card is disabled (struck-out) and remaining 3 are enabled for away player', () => {
    // Away player's view after home has picked cosmos
    useGameStore.setState({ playerSlot: 2 });
    render(
      <TeamSelectionScreen homePickedTeam="cosmos" onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />,
    );

    const allButtons = screen.getAllByRole('button');
    // Speed buttons have aria-pressed; team cards don't.
    const teamCards = allButtons.filter((b) => !b.hasAttribute('aria-pressed'));
    expect(teamCards).toHaveLength(4);

    // Find cosmos card — it should be disabled
    // Cards should have accessible text matching team name or data-testid
    // We assert by counting: exactly 1 disabled (cosmos) and 3 enabled (xolos, city, crew)
    const disabledCards = teamCards.filter((c) => c.hasAttribute('disabled'));
    const enabledCards = teamCards.filter((c) => !c.hasAttribute('disabled'));

    expect(disabledCards).toHaveLength(1);
    expect(enabledCards).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// SELECT-01: Clicking an enabled card calls onPick with that teamId
// ---------------------------------------------------------------------------

describe('TeamSelectionScreen — SELECT-01: clicking an enabled card calls onPick', () => {
  it('clicking an enabled card invokes onPick with the selected teamId', async () => {
    const onPick = vi.fn();
    // Away player with homePickedTeam=cosmos — 3 remaining cards are active
    useGameStore.setState({ playerSlot: 2 });
    render(
      <TeamSelectionScreen homePickedTeam="cosmos" onPick={onPick} {...DEFAULT_SPEED_PROPS} />,
    );

    const allButtons = screen.getAllByRole('button');
    const teamCards = allButtons.filter((b) => !b.hasAttribute('aria-pressed'));
    const enabledCards = teamCards.filter((c) => !c.hasAttribute('disabled'));
    expect(enabledCards).toHaveLength(3);

    // Click the first enabled card
    await userEvent.click(enabledCards[0]!);
    expect(onPick).toHaveBeenCalledTimes(1);
    // onPick should be called with one of the remaining teamIds (not cosmos)
    const calledWith = onPick.mock.calls[0]?.[0];
    expect(['xolos', 'city', 'crew']).toContain(calledWith);
  });

  it('clicking a disabled card does NOT call onPick', async () => {
    const onPick = vi.fn();
    // Away player with homePickedTeam=cosmos — cosmos card is disabled
    useGameStore.setState({ playerSlot: 2 });
    render(
      <TeamSelectionScreen homePickedTeam="cosmos" onPick={onPick} {...DEFAULT_SPEED_PROPS} />,
    );

    const allButtons = screen.getAllByRole('button');
    const teamCards = allButtons.filter((b) => !b.hasAttribute('aria-pressed'));
    const disabledCards = teamCards.filter((c) => c.hasAttribute('disabled'));
    expect(disabledCards).toHaveLength(1);

    // Click the disabled (cosmos) card — no event should fire
    await userEvent.click(disabledCards[0]!);
    expect(onPick).not.toHaveBeenCalled();
  });
});
