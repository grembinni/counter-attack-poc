/**
 * Phase 22 Plan 03 — UniformSelectionScreen component tests.
 * Covers: pre-selection on team pick, disabled/enabled Confirm button,
 * confirm-emit payload, away struck-out card, and opponent banner.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UniformSelectionScreen } from './UniformSelectionScreen.js';
import type { FormationId } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
});

/** Default props shared across most tests — no homePickedTeam, homeConfirmedStyle, or homeConfirmedFormation. */
const DEFAULT_PROPS = {
  homePickedTeam: null as null | string,
  homeConfirmedStyle: null as null | string,
  homeConfirmedFormation: null as FormationId | null,
  onConfirm: vi.fn(),
  selectedSpeed: 'standard' as const,
  settingsSummary: null as string | null,
};

// ---------------------------------------------------------------------------
// Style tiles always rendered (18 tiles)
// ---------------------------------------------------------------------------

describe('UniformSelectionScreen — style tiles always rendered', () => {
  it('renders known style tiles before any team is selected (home view)', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen {...DEFAULT_PROPS} homePickedTeam={null} homeConfirmedStyle={null} />,
    );

    // Check a few known style tiles by their aria-label
    expect(screen.getByRole('button', { name: 'Pinstripes (V)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pinstripes (H)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Checkers' })).toBeTruthy();
  });

  it('Confirm button is disabled before any team or style is selected', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen {...DEFAULT_PROPS} homePickedTeam={null} homeConfirmedStyle={null} />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Confirm selection' });
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
      <UniformSelectionScreen {...DEFAULT_PROPS} homePickedTeam={null} homeConfirmedStyle={null} />,
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
    const confirmButton = screen.getByRole('button', { name: 'Confirm selection' });
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
    const confirmButton = screen.getByRole('button', { name: 'Confirm selection' });
    await userEvent.click(confirmButton);

    // onConfirm should be called with city, its defaultUniformStyle, the default formation, and home jersey (home player)
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('city', 'pinstripes-vertical', '4-4-2', 'home');
  });

  it('after confirming, Confirm button is hidden and status shows waiting message', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Confirm selection' }));

    // Confirm button should be gone
    expect(screen.queryByRole('button', { name: 'Confirm selection' })).toBeNull();

    // Waiting status line should appear (home player waits for Visitor)
    expect(screen.getByText('Waiting for Visitor Player to Lock in their Selection.')).toBeTruthy();
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

    await userEvent.click(screen.getByRole('button', { name: 'Confirm selection' }));

    expect(onConfirm).toHaveBeenCalledWith('city', 'checkers', '4-4-2', 'home');
  });
});

// ---------------------------------------------------------------------------
// Away player: struck-out card for homePickedTeam
// ---------------------------------------------------------------------------

describe('UniformSelectionScreen — away struck-out card', () => {
  it("away player sees home's team card disabled/struck-out", () => {
    useGameStore.setState({ playerSlot: 2 });
    render(
      <UniformSelectionScreen {...DEFAULT_PROPS} homePickedTeam="city" homeConfirmedStyle={null} />,
    );

    const cityCard = screen.getByRole('button', { name: 'City' });
    expect(cityCard.hasAttribute('disabled')).toBe(true);
  });

  it('away player sees ALL cards and style tiles disabled before home confirms', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(
      <UniformSelectionScreen {...DEFAULT_PROPS} homePickedTeam="city" homeConfirmedStyle={null} />,
    );

    // Non-struck-out team card is disabled while away is locked
    const crewCard = screen.getByRole('button', { name: 'Crew' });
    expect(crewCard.hasAttribute('disabled')).toBe(true);

    // Style tiles are also disabled while away is locked
    const pinstripeVTile = screen.getByRole('button', { name: 'Pinstripes (V)' });
    expect(pinstripeVTile.hasAttribute('disabled')).toBe(true);
  });

  it('away player can click other team cards once home confirms', async () => {
    useGameStore.setState({ playerSlot: 2 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam="city"
        homeConfirmedStyle="pinstripes-vertical"
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
// Step/status heading — after home confirms, UI advances to Step 2
// ---------------------------------------------------------------------------

describe('UniformSelectionScreen — step heading and status', () => {
  it('away player sees STEP 1 — HOME PLAYER (OPPONENT) while waiting for home to confirm', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(
      <UniformSelectionScreen {...DEFAULT_PROPS} homePickedTeam="city" homeConfirmedStyle={null} />,
    );

    expect(screen.getByRole('heading').textContent).toContain('STEP 1');
    expect(screen.getByRole('heading').textContent).toContain('HOME PLAYER (OPPONENT)');
    expect(screen.getByText('Waiting for Home Player to Lock in their Selection.')).toBeTruthy();
  });

  it('away player sees STEP 2 — VISITOR PLAYER (YOU) and active status after home confirms', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam="city"
        homeConfirmedStyle="pinstripes-vertical"
      />,
    );

    expect(screen.getByRole('heading').textContent).toContain('STEP 2');
    expect(screen.getByRole('heading').textContent).toContain('VISITOR PLAYER (YOU)');
    expect(screen.getByText('Make your selections now!')).toBeTruthy();
  });

  it('home player sees STEP 1 HOME PLAYER (YOU) and active status', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen {...DEFAULT_PROPS} homePickedTeam={null} homeConfirmedStyle={null} />,
    );

    expect(screen.getByRole('heading').textContent).toContain('STEP 1');
    expect(screen.getByRole('heading').textContent).toContain('HOME PLAYER (YOU)');
    expect(screen.getByText('Make your selections now!')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Phase 27 (DRAFT-02/DRAFT-03, D-07/D-09): read-only speed subheader / settings summary
// ---------------------------------------------------------------------------

describe('UniformSelectionScreen — read-only speed subheader / settings summary (D-07/D-09)', () => {
  it('renders NO interactive speed picker button for the home player', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen {...DEFAULT_PROPS} homePickedTeam={null} homeConfirmedStyle={null} />,
    );

    expect(screen.queryByRole('button', { name: /^Slow$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Standard$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Fast$/i })).toBeNull();
  });

  it('standard mode (settingsSummary=null) renders the read-only speed label', () => {
    useGameStore.setState({ playerSlot: 1 });
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam={null}
        homeConfirmedStyle={null}
        selectedSpeed="standard"
        settingsSummary={null}
      />,
    );

    expect(screen.getByText('0 | MATCH SPEED')).toBeTruthy();
    expect(screen.getByText('Standard')).toBeTruthy();
  });

  it('draft mode renders the provided settings summary line verbatim', () => {
    useGameStore.setState({ playerSlot: 1 });
    const summary = 'Speed: ⚽ Standard · Team Type: Draft · Draft Pool: Original';
    render(
      <UniformSelectionScreen
        {...DEFAULT_PROPS}
        homePickedTeam={null}
        homeConfirmedStyle={null}
        settingsSummary={summary}
      />,
    );

    expect(screen.getByText(summary)).toBeTruthy();
    expect(screen.queryByText('0 | MATCH SPEED')).toBeNull();
  });
});
