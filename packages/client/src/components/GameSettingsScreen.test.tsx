/**
 * Phase 27 — GameSettingsScreen behavior tests (DRAFT-01, D-04/D-05/D-06).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameSettingsScreen } from './GameSettingsScreen.js';

afterEach(() => cleanup());

describe('GameSettingsScreen — renders controls', () => {
  it('renders the heading, Match Speed picker, Team Type toggle, and Confirm CTA', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} />);

    expect(screen.getByText('Game Settings')).toBeTruthy();
    expect(screen.getByText('Match Speed')).toBeTruthy();
    expect(screen.getByRole('button', { name: /slow/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /standard/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /fast/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Standard' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm Settings' })).toBeTruthy();
  });

  it('defaults to Team Type Standard and hides the draft-pool section', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Standard' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryByText('Draft Pool')).toBeNull();
  });
});

describe('GameSettingsScreen — Draft mode pool checkboxes (D-04/D-05)', () => {
  it('selecting Draft reveals five pool checkboxes with Original pre-checked', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));

    expect(screen.getByText('Draft Pool')).toBeTruthy();
    const original = screen.getByRole<HTMLInputElement>('checkbox', { name: /original/i });
    const mls = screen.getByRole<HTMLInputElement>('checkbox', { name: /^mls/i });
    const international = screen.getByRole<HTMLInputElement>('checkbox', {
      name: /international/i,
    });
    const legends = screen.getByRole<HTMLInputElement>('checkbox', { name: /legends/i });
    const icons = screen.getByRole<HTMLInputElement>('checkbox', { name: /icons/i });

    expect(original.checked).toBe(true);
    expect(mls.checked).toBe(false);
    expect(international.checked).toBe(false);
    expect(legends.checked).toBe(false);
    expect(icons.checked).toBe(false);
  });

  it('Legends and Icons checkboxes are enabled and unlabelled (D-08, Phase 30)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));

    const legends = screen.getByRole<HTMLInputElement>('checkbox', { name: /legends/i });
    const icons = screen.getByRole<HTMLInputElement>('checkbox', { name: /icons/i });

    expect(legends.disabled).toBe(false);
    expect(icons.disabled).toBe(false);
    expect(screen.queryByText('(coming soon)')).toBeNull();
  });

  it('clicking a Legends/Icons checkbox toggles it checked (D-08, Phase 30)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));
    const legends = screen.getByRole<HTMLInputElement>('checkbox', { name: /legends/i });

    await userEvent.click(legends);

    expect(legends.checked).toBe(true);
  });
});

describe('GameSettingsScreen — Confirm disabled state (D-06)', () => {
  it('Confirm is enabled by default in Draft mode (Original pre-checked)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));

    const confirmButton = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Confirm Settings',
    });
    expect(confirmButton.disabled).toBe(false);
  });

  it('Confirm becomes disabled when all enabled pools are unchecked, then re-enables after checking one', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));
    const original = screen.getByRole('checkbox', { name: /original/i });
    const mls = screen.getByRole('checkbox', { name: /^mls/i });
    const confirmButton = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Confirm Settings',
    });

    // Uncheck Original — zero of the three enabled pools checked.
    await userEvent.click(original);
    expect(confirmButton.disabled).toBe(true);

    // Check MLS — Confirm re-enables.
    await userEvent.click(mls);
    expect(confirmButton.disabled).toBe(false);
  });
});

describe('GameSettingsScreen — onConfirm payload shape', () => {
  it('Standard mode: onConfirm receives draftPools: [] regardless of teamType default state', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
    });
  });

  it('Draft mode: onConfirm receives the checked selectable pools (Original pre-checked)', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'draft',
      draftPools: ['original'],
    });
  });

  it('Draft mode: a Draft-mode confirm can include legends and icons once checked (D-08, Phase 30)', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));
    const mls = screen.getByRole('checkbox', { name: /^mls/i });
    const legends = screen.getByRole('checkbox', { name: /legends/i });
    const icons = screen.getByRole('checkbox', { name: /icons/i });
    await userEvent.click(mls);
    await userEvent.click(legends);
    await userEvent.click(icons);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'draft',
      draftPools: ['original', 'mls', 'legends', 'icons'],
    });
  });

  it('speed selection is reflected in the confirmed payload', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', { name: /fast/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'fast',
      teamType: 'standard',
      draftPools: [],
    });
  });
});
