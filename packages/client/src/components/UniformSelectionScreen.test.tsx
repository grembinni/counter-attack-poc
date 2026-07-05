/**
 * Phase 22 Plan 03 — UniformSelectionScreen component tests.
 * Covers: pre-selection on team pick, disabled/enabled Confirm button,
 * confirm-emit payload, away struck-out card, and opponent banner.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UniformSelectionScreen } from './UniformSelectionScreen.js';
import { useGameStore } from '../store/useGameStore.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
});

/** Default props shared across most tests — no homePickedTeam or homeConfirmedStyle. */
const DEFAULT_PROPS = {
  homePickedTeam: null as null | string,
  homeConfirmedStyle: null as null | string,
  onConfirm: vi.fn(),
  selectedSpeed: 'standard' as const,
  onSpeedChange: vi.fn(),
};

// ---------------------------------------------------------------------------
// Style tiles always rendered (18 tiles)
// ---------------------------------------------------------------------------

describe('UniformSelectionScreen — style tiles always rendered', () => {
  it('renders known style tiles before any team is selected (home view)', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam={null}
        homeConfirmedStyle={null}
      />,
    );

    // Check a few known style tiles by their aria-label
    expect(screen.getByRole('button', { name: 'Pinstripes (V)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pinstripes (H)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Checkers' })).toBeTruthy();
  });

  it('Confirm button is disabled before any team or style is selected', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam={null}
        homeConfirmedStyle={null}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Confirm team and style selection' });
    expect(confirmButton.hasAttribute('disabled')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pre-selection: selecting a team pre-selects its defaultUniformStyle
// ---------------------------------------------------------------------------

describe('UniformSelectionScreen — pre-selection on team pick', () => {
  it("selecting 'city' pre-selects 'Pinstripes (V)' (city's defaultUniformStyle)", async () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam={null}
        homeConfirmedStyle={null}
      />,
    );

    // Click the City team card
    await userEvent.click(screen.getByRole('button', { name: 'City' }));

    // After team pick, city's defaultUniformStyle ('pinstripes-vertical' = 'Pinstripes (V)') is pre-selected
    const pinstripeVTile = screen.getByRole('button', { name: 'Pinstripes (V)' });
    expect(pinstripeVTile.getAttribute('aria-pressed')).toBe('true');
  });

  it('Confirm button is enabled after selecting a team (defaultUniformStyle pre-selects)', async () => {
    useGameStore.setState({ playerSlot: 1 });
    const onConfirm = vi.fn();
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        onConfirm={onConfirm}
        homePickedTeam={null}
        homeConfirmedStyle={null}
      />,
    );

    // Before team pick — disabled
    const confirmButton = screen.getByRole('button', { name: 'Confirm team and style selection' });
    expect(confirmButton.hasAttribute('disabled')).toBe(true);

    // After team pick — enabled (defaultUniformStyle auto-selected)
    await userEvent.click(screen.getByRole('button', { name: 'City' }));
    expect(confirmButton.hasAttribute('disabled')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Confirm emit: clicking Confirm calls onConfirm with (teamId, styleId)
// ---------------------------------------------------------------------------

describe('UniformSelectionScreen — confirm emit', () => {
  it('clicking Confirm after team+style selection calls onConfirm(teamId, styleId)', async () => {
    useGameStore.setState({ playerSlot: 1 });
    const onConfirm = vi.fn();
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        onConfirm={onConfirm}
        homePickedTeam={null}
        homeConfirmedStyle={null}
      />,
    );

    // Pick team — defaultUniformStyle auto-selected
    await userEvent.click(screen.getByRole('button', { name: 'City' }));

    // Click Confirm
    const confirmButton = screen.getByRole('button', { name: 'Confirm team and style selection' });
    await userEvent.click(confirmButton);

    // onConfirm should be called with city and its defaultUniformStyle
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('city', 'pinstripes-vertical');
  });

  it('after confirming, screen shows "Waiting for opponent…" instead of Confirm button', async () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        onConfirm={vi.fn()}
        homePickedTeam={null}
        homeConfirmedStyle={null}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'City' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm team and style selection' }));

    // Confirm button should be gone
    expect(screen.queryByRole('button', { name: 'Confirm team and style selection' })).toBeNull();

    // Waiting status line should appear
    expect(screen.getByText('Waiting for opponent…')).toBeTruthy();
  });

  it('selecting a different style then confirming sends the chosen style', async () => {
    useGameStore.setState({ playerSlot: 1 });
    const onConfirm = vi.fn();
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        onConfirm={onConfirm}
        homePickedTeam={null}
        homeConfirmedStyle={null}
      />,
    );

    // Pick team
    await userEvent.click(screen.getByRole('button', { name: 'City' }));

    // Override default style with Checkers
    await userEvent.click(screen.getByRole('button', { name: 'Checkers' }));

    await userEvent.click(screen.getByRole('button', { name: 'Confirm team and style selection' }));

    expect(onConfirm).toHaveBeenCalledWith('city', 'checkers');
  });
});

// ---------------------------------------------------------------------------
// Away player: struck-out card for homePickedTeam
// ---------------------------------------------------------------------------

describe('UniformSelectionScreen — away struck-out card', () => {
  it("away player sees home's team card disabled/struck-out", () => {
    useGameStore.setState({ playerSlot: 2 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam="city"
        homeConfirmedStyle={null}
      />,
    );

    const cityCard = screen.getByRole('button', { name: 'City' });
    expect(cityCard.hasAttribute('disabled')).toBe(true);
  });

  it('away player can still click other team cards (not struck-out)', async () => {
    useGameStore.setState({ playerSlot: 2 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam="city"
        homeConfirmedStyle={null}
      />,
    );

    const crewCard = screen.getByRole('button', { name: 'Crew' });
    expect(crewCard.hasAttribute('disabled')).toBe(false);

    await userEvent.click(crewCard);

    // crew's defaultUniformStyle is 'bar-diagonal' = 'Bar (Diag)'
    const barDiagonalTile = screen.getByRole('button', { name: 'Bar (Diag)' });
    expect(barDiagonalTile.getAttribute('aria-pressed')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Opponent confirmed banner (away player, after home confirms)
// ---------------------------------------------------------------------------

describe('UniformSelectionScreen — opponent confirmed banner', () => {
  it('does NOT show banner when homeConfirmedStyle is null', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam="city"
        homeConfirmedStyle={null}
      />,
    );

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows "Opponent confirmed" banner (role="status") when homeConfirmedStyle is set (away view)', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam="city"
        homeConfirmedStyle="pinstripes-vertical"
      />,
    );

    const banner = screen.getByRole('status');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Opponent confirmed');
  });

  it('does NOT show banner for home player even when homeConfirmedStyle is set', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam={null}
        homeConfirmedStyle="pinstripes-vertical"
      />,
    );

    // Home player (iAmHome=true) never sees the opponent banner
    expect(screen.queryByRole('status')).toBeNull();
  });
});
