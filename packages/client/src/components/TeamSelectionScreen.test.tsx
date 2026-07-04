/**
 * Phase 16 Wave 0 RED tests — PLAY-03, SELECT-01
 * Phase 21: updated for two-tab layout (LEAGUE-01, LEAGUE-02).
 * UX-07 (Phase 18.4): supply required selectedSpeed/onSpeedChange props.
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

/**
 * Filter all buttons to team cards only — exclude tab buttons (role="tab")
 * and speed buttons (aria-pressed). PATTERNS.md filtering approach.
 */
function getTeamCards(buttons: HTMLElement[]): HTMLElement[] {
  return buttons.filter((b) => b.getAttribute('role') !== 'tab' && !b.hasAttribute('aria-pressed'));
}

// ---------------------------------------------------------------------------
// PLAY-03: Free Agent players NOT shown in selection screen
// ---------------------------------------------------------------------------

describe('TeamSelectionScreen — PLAY-03: only named teams shown (no Free Agents)', () => {
  it('renders exactly 6 team cards on the default MLS tab', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    const teamCards = getTeamCards(allButtons);
    expect(teamCards).toHaveLength(6);
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
  it('all 6 team cards are enabled when playerSlot=1 (home) and homePickedTeam=null', () => {
    // Home player, no team picked yet — home player is active
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    const teamCards = getTeamCards(allButtons);
    expect(teamCards).toHaveLength(6);
    for (const card of teamCards) {
      expect(card.hasAttribute('disabled')).toBe(false);
    }
  });

  it('all 6 team cards are disabled when playerSlot=2 (away) and homePickedTeam=null', () => {
    // Away player, home has not yet picked — away player must wait
    useGameStore.setState({ playerSlot: 2 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    const teamCards = getTeamCards(allButtons);
    expect(teamCards).toHaveLength(6);
    for (const card of teamCards) {
      expect(card.hasAttribute('disabled')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// SELECT-01: Struck-out card after home picks
// ---------------------------------------------------------------------------

describe('TeamSelectionScreen — SELECT-01: city struck-out for away player after home picked it', () => {
  it('city card is disabled (struck-out) and remaining 5 are enabled for away player', () => {
    // Away player's view after home has picked city (MLS tab — city struck out, 5 enabled)
    useGameStore.setState({ playerSlot: 2 });
    render(<TeamSelectionScreen homePickedTeam="city" onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    const teamCards = getTeamCards(allButtons);

    // Find city card — it should be disabled; 5 others should be enabled
    const disabledCards = teamCards.filter((c) => c.hasAttribute('disabled'));
    const enabledCards = teamCards.filter((c) => !c.hasAttribute('disabled'));

    expect(disabledCards).toHaveLength(1);
    expect(enabledCards).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// SELECT-01: Clicking an enabled card calls onPick with that teamId
// ---------------------------------------------------------------------------

describe('TeamSelectionScreen — SELECT-01: clicking an enabled card calls onPick', () => {
  it('clicking an enabled card invokes onPick with the selected teamId', async () => {
    const onPick = vi.fn();
    // Away player with homePickedTeam=city — 5 MLS cards remain active
    useGameStore.setState({ playerSlot: 2 });
    render(<TeamSelectionScreen homePickedTeam="city" onPick={onPick} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    const teamCards = getTeamCards(allButtons);
    const enabledCards = teamCards.filter((c) => !c.hasAttribute('disabled'));
    expect(enabledCards).toHaveLength(5);

    // Click the first enabled card
    await userEvent.click(enabledCards[0]!);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('clicking a disabled card does NOT call onPick', async () => {
    const onPick = vi.fn();
    // Away player with homePickedTeam=city — city card is disabled
    useGameStore.setState({ playerSlot: 2 });
    render(<TeamSelectionScreen homePickedTeam="city" onPick={onPick} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    const teamCards = getTeamCards(allButtons);
    const disabledCards = teamCards.filter((c) => c.hasAttribute('disabled'));
    expect(disabledCards).toHaveLength(1);

    // Click the disabled (city) card — no event should fire
    await userEvent.click(disabledCards[0]!);
    expect(onPick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// LEAGUE-01: Two-tab layout
// ---------------------------------------------------------------------------

describe('TeamSelectionScreen — LEAGUE-01: two-tab layout', () => {
  it('renders MLS tab as active by default on mount', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    const mlsTab = screen.getByRole('tab', { name: /mls/i });
    expect(mlsTab.getAttribute('aria-selected')).toBe('true');
  });

  it('shows 6 team cards on the default MLS tab', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    const teamCards = getTeamCards(allButtons);
    expect(teamCards).toHaveLength(6);
  });

  it('switches to International tab on click and shows 6 cards', async () => {
    useGameStore.setState({ playerSlot: 1 });
    render(<TeamSelectionScreen homePickedTeam={null} onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    await userEvent.click(screen.getByRole('tab', { name: /international/i }));

    const intlTab = screen.getByRole('tab', { name: /international/i });
    expect(intlTab.getAttribute('aria-selected')).toBe('true');

    const allButtons = screen.getAllByRole('button');
    const teamCards = getTeamCards(allButtons);
    expect(teamCards).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// LEAGUE-02: Cross-tab struck-out behavior
// ---------------------------------------------------------------------------

describe('TeamSelectionScreen — LEAGUE-02: cross-tab struck-out behavior', () => {
  it("away player's MLS tab is active when homePickedTeam='city' (city is MLS)", () => {
    // When home picks a city (MLS team), away sees MLS tab active.
    // MLS is the default tab so this verifies the correct tab is shown after home picks MLS.
    useGameStore.setState({ playerSlot: 2 });
    render(<TeamSelectionScreen homePickedTeam="city" onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    expect(screen.getByRole('tab', { name: /mls/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('exactly 1 card is disabled (struck-out) when home picked an MLS team', () => {
    // Home picked 'city' (MLS tab); exactly 1 card on the MLS tab should be disabled
    useGameStore.setState({ playerSlot: 2 });
    render(<TeamSelectionScreen homePickedTeam="city" onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    const allButtons = screen.getAllByRole('button');
    const teamCards = getTeamCards(allButtons);
    const disabledCards = teamCards.filter((c) => c.hasAttribute('disabled'));
    expect(disabledCards).toHaveLength(1); // city struck out
  });

  it('struck-out card (city) stays struck out after switching tabs and back (tab-independent check)', async () => {
    // isStruckOut = teamId === homePickedTeam — independent of activeLeague
    useGameStore.setState({ playerSlot: 2 });
    render(<TeamSelectionScreen homePickedTeam="city" onPick={vi.fn()} {...DEFAULT_SPEED_PROPS} />);

    // Switch to International tab — city not present, no disabled cards
    await userEvent.click(screen.getByRole('tab', { name: /international/i }));
    const allButtonsIntl = screen.getAllByRole('button');
    const disabledIntl = getTeamCards(allButtonsIntl).filter((c) => c.hasAttribute('disabled'));
    expect(disabledIntl).toHaveLength(0);

    // Switch back to MLS — city is still struck out
    await userEvent.click(screen.getByRole('tab', { name: /mls/i }));
    const allButtonsMls = screen.getAllByRole('button');
    const disabledMls = getTeamCards(allButtonsMls).filter((c) => c.hasAttribute('disabled'));
    expect(disabledMls).toHaveLength(1);
  });
});
