/**
 * Phase 27 — GameSettingsScreen behavior tests (DRAFT-01, D-04/D-05/D-06).
 *
 * CLEANUP (live-playtest gap-closure): the screen was restructured from a single
 * scrolling page (Team Type segmented control + collapsible Advanced disclosure +
 * conditional Draft Pool section) into two real tabs — "Settings" (all match-rule
 * toggles, visible immediately, no disclosure) and "Team Mode" (a Standard/Draft
 * toggle switch that reveals Draft Pool checkboxes when on). Match Speed is now a
 * plain radio group instead of a colored button group. Tests below reflect the new
 * structure; behavior that didn't change (Confirm payload shape, Fouls→Booking/
 * Injury dependency, Referee Leniency clamping) is preserved as-is.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameSettingsScreen } from './GameSettingsScreen.js';
import styles from './GameSettingsScreen.module.css';

afterEach(() => cleanup());

/** Switches to the "Team Mode" tab. */
async function openTeamMode() {
  await userEvent.click(screen.getByRole('tab', { name: 'Team Mode' }));
}

/** Switches to Team Mode and flips the Draft toggle on. */
async function enableDraftMode() {
  await openTeamMode();
  await userEvent.click(screen.getByRole('switch'));
}

describe('GameSettingsScreen — renders controls', () => {
  it('renders the heading, Settings/Team Mode tabs, and Confirm CTA', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText('Game Settings')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Team Mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm Settings' })).toBeTruthy();
  });

  it('defaults to the Settings tab active and Team Mode inactive, with the draft-pool section hidden', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Settings' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Team Mode' }).getAttribute('aria-selected')).toBe(
      'false',
    );
    expect(screen.queryByText('Draft Pool')).toBeNull();
  });
});

describe('GameSettingsScreen — Team Mode tab (D-04/D-05/D-06)', () => {
  it('switching to Team Mode shows the Draft toggle off by default, with no Draft Pool section', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await openTeamMode();

    const toggle = screen.getByRole<HTMLInputElement>('switch');
    expect(toggle.checked).toBe(false);
    expect(screen.queryByText('Draft Pool')).toBeNull();
  });

  it('turning the Draft toggle on reveals five pool checkboxes with Original pre-checked', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await enableDraftMode();

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

  it('turning the Draft toggle back off hides the Draft Pool section again', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await enableDraftMode();
    expect(screen.getByText('Draft Pool')).toBeTruthy();

    await userEvent.click(screen.getByRole('switch'));

    expect(screen.queryByText('Draft Pool')).toBeNull();
  });

  it('Legends and Icons checkboxes are enabled and unlabelled (D-08, Phase 30)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await enableDraftMode();

    const legends = screen.getByRole<HTMLInputElement>('checkbox', { name: /legends/i });
    const icons = screen.getByRole<HTMLInputElement>('checkbox', { name: /icons/i });

    expect(legends.disabled).toBe(false);
    expect(icons.disabled).toBe(false);
    expect(screen.queryByText('(coming soon)')).toBeNull();
  });

  it('clicking a Legends/Icons checkbox toggles it checked (D-08, Phase 30)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await enableDraftMode();
    const legends = screen.getByRole<HTMLInputElement>('checkbox', { name: /legends/i });

    await userEvent.click(legends);

    expect(legends.checked).toBe(true);
  });
});

describe('GameSettingsScreen — Confirm disabled state (D-06)', () => {
  it('Confirm is enabled by default in Draft mode (Original pre-checked)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await enableDraftMode();

    const confirmButton = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Confirm Settings',
    });
    expect(confirmButton.disabled).toBe(false);
  });

  it('Confirm becomes disabled when all enabled pools are unchecked, then re-enables after checking one', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await enableDraftMode();
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
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });

  it('Draft mode: onConfirm receives the checked selectable pools (Original pre-checked)', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await enableDraftMode();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'draft',
      draftPools: ['original'],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });

  it('Draft mode: a Draft-mode confirm can include legends and icons once checked (D-08, Phase 30)', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await enableDraftMode();
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
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });

  it('speed selection is reflected in the confirmed payload', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('radio', { name: /fast/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'fast',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });
});

describe('GameSettingsScreen — Out-of-Bounds / Restarts toggle (GOALKICK-06/OOB-05, Phase 37; default flipped ON by D-14, Phase 39)', () => {
  it('renders the "Out-of-Bounds / Restarts" row with a checked checkbox by default (D-14)', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    const checkbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Out-of-Bounds / Restarts',
    });
    expect(checkbox.checked).toBe(true);
  });

  it('unchecking the toggle then Confirm Settings calls onConfirm with outOfBounds: false', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Out-of-Bounds / Restarts' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: false,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });

  it('confirming without touching the toggle calls onConfirm with outOfBounds: true', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });
});

describe('GameSettingsScreen — Tackle/Steal Decline Prompt toggle (TACKLE-01, Phase 43)', () => {
  it('renders the "Tackle/Steal Decline Prompt" row with a checked checkbox by default', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    const checkbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Tackle/Steal Decline Prompt',
    });
    expect(checkbox.checked).toBe(true);
  });

  it('unchecking the toggle then Confirm Settings calls onConfirm with tackleStealDecline: false', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Tackle/Steal Decline Prompt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: false,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });
});

describe('GameSettingsScreen — Match Rules: Fouls/Booking/Injury toggles (D-12/D-13/D-14, Phase 39)', () => {
  it('all four checkboxes are checked on first render', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Fouls' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Booking' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Injury' }).checked).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Out-of-Bounds / Restarts' }).checked,
    ).toBe(true);
  });

  it('unchecking Fouls disables Booking/Injury and renders "(requires Fouls)" twice', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));

    // Accessible name includes the trailing "(requires Fouls)" helper text once disabled.
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Booking/ }).disabled).toBe(
      true,
    );
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Injury/ }).disabled).toBe(true);
    expect(screen.getAllByText('(requires Fouls)')).toHaveLength(2);
  });

  it('clicking a disabled Booking checkbox does not change its checked state', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));
    // Accessible name includes the trailing "(requires Fouls)" helper text once disabled.
    const booking = screen.getByRole<HTMLInputElement>('checkbox', { name: /^Booking/ });
    expect(booking.checked).toBe(true);

    await userEvent.click(booking);

    expect(booking.checked).toBe(true);
  });

  it('re-checking Fouls re-enables Booking/Injury and removes the helper text', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    const fouls = screen.getByRole('checkbox', { name: 'Fouls' });
    await userEvent.click(fouls);
    expect(screen.getAllByText('(requires Fouls)')).toHaveLength(2);

    await userEvent.click(fouls);

    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Booking' }).disabled).toBe(
      false,
    );
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Injury' }).disabled).toBe(false);
    expect(screen.queryByText('(requires Fouls)')).toBeNull();
  });

  it('confirming with all four checked calls onConfirm with fouls/booking/injury/outOfBounds: true', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });

  it('confirming with Fouls unchecked calls onConfirm with fouls/booking/injury all false regardless of prior Booking/Injury state', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    // Fouls off — Booking/Injury remain checked in local state but are inert (D-13).
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: false,
      booking: false,
      injury: false,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });
});

describe('GameSettingsScreen — Back control (BUG-33, Phase 36)', () => {
  it('renders a Back control in the default state', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
  });

  it('still renders after switching to Team Mode/Draft and after clicking Confirm Settings (D-05)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await enableDraftMode();
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
  });

  it('clicking Back calls onBack exactly once and does not call onConfirm', async () => {
    const onConfirm = vi.fn();
    const onBack = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={onBack} />);

    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('GameSettingsScreen — Settings tab (CLEANUP, replaces the old Advanced disclosure)', () => {
  it('the Fouls checkbox and Match Speed are visible immediately on first render — no disclosure to open', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Fouls' })).toBeTruthy();
    expect(screen.getByText('Match Speed')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /slow/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /standard/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /fast/i })).toBeTruthy();
  });

  it('Match Speed defaults to the "standard" radio checked', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole<HTMLInputElement>('radio', { name: /standard/i }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /slow/i }).checked).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /fast/i }).checked).toBe(false);
  });

  it('switching to Team Mode hides the Settings-tab content, and switching back shows it again', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await openTeamMode();
    expect(screen.queryByRole('checkbox', { name: 'Fouls' })).toBeNull();
    expect(screen.queryByText('Match Speed')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByRole('checkbox', { name: 'Fouls' })).toBeTruthy();
    expect(screen.getByText('Match Speed')).toBeTruthy();
  });

  it('lays the toggles out in exactly two columns: Fouls/Booking/Injury/Match-Speed left, Out-of-Bounds/Referee-Leniency/Tackle-Steal-Decline right (SETTINGS-06)', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    // Structural assertion of the CSS-module grid container is the documented technique
    // for this check; the module's class identifiers are stable (identity-mapped) under
    // the vitest config.
    const grid = document.querySelector(`.${styles.advancedGrid}`);
    expect(grid).toBeTruthy();
    expect(grid?.children).toHaveLength(2);

    const columns = Array.from(grid?.children ?? []) as HTMLElement[];
    const leftColumn = columns[0]!;
    const rightColumn = columns[1]!;

    expect(within(leftColumn).getByRole('checkbox', { name: 'Fouls' })).toBeTruthy();
    expect(within(leftColumn).getByRole('checkbox', { name: /^Booking/ })).toBeTruthy();
    expect(within(leftColumn).getByRole('checkbox', { name: /^Injury/ })).toBeTruthy();
    expect(within(leftColumn).getByText('Match Speed')).toBeTruthy();
    expect(within(leftColumn).getByRole('radio', { name: /slow/i })).toBeTruthy();

    expect(
      within(rightColumn).getByRole('checkbox', { name: 'Out-of-Bounds / Restarts' }),
    ).toBeTruthy();
    expect(
      within(rightColumn).getByRole('checkbox', { name: 'Tackle/Steal Decline Prompt' }),
    ).toBeTruthy();
  });
});

describe('GameSettingsScreen — Fouls dependency shared derivation (SETTINGS-07, Phase 44)', () => {
  it('render time: unchecking Fouls disables Booking/Injury and shows "(requires Fouls)" twice', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));

    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Booking/ }).disabled).toBe(
      true,
    );
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Injury/ }).disabled).toBe(true);
    expect(screen.getAllByText('(requires Fouls)')).toHaveLength(2);
  });

  it('confirm time: with Fouls unchecked, onConfirm receives booking: false, injury: false', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: false,
      booking: false,
      injury: false,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });

  it('cross-site: with Settings never touched, onConfirm receives the unchanged default payload', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });

  it('confirm-after-tab-switch: unchecking Fouls, switching to Team Mode and back, preserves fouls/booking/injury: false at confirm time', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));
    await openTeamMode();
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));

    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Booking/ }).disabled).toBe(
      true,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: false,
      booking: false,
      injury: false,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });
});

describe('GameSettingsScreen — Referee Leniency override (REFEREE-01/02/04, Phase 44)', () => {
  it('REFEREE-01: the "Referee Leniency" checkbox is present and unchecked on first render', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    const checkbox = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Referee Leniency' });
    expect(checkbox.checked).toBe(false);
  });

  it('REFEREE-01/D-04: the stepper is present and disabled on first render (always mounted, never conditionally rendered)', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    const stepper = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Referee Leniency value',
    });
    expect(stepper).toBeTruthy();
    expect(stepper.disabled).toBe(true);
  });

  it('REFEREE-02/D-01: the stepper shows 4 and becomes enabled after clicking the override checkbox', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    const stepper = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Referee Leniency value',
    });
    expect(stepper.value).toBe('4');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Referee Leniency' }));

    expect(stepper.disabled).toBe(false);
  });

  it('REFEREE-02/D-02/D-03: the stepper min is 2 and max is 5', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    const stepper = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Referee Leniency value',
    });
    expect(stepper.min).toBe('2');
    expect(stepper.max).toBe('5');
  });

  it('REFEREE-02 clamp: typing 9 leaves the confirmed payload at 5', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Referee Leniency' }));
    const stepper = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Referee Leniency value',
    });
    // fireEvent.change (not userEvent.clear+type) sets the exact typed value in one
    // event — matches this codebase's established pattern for numeric input value
    // changes (LobbyScreen.test.tsx) and avoids a controlled-number-input quirk where
    // userEvent.clear() doesn't force a DOM sync when the change handler bails on NaN
    // without calling the setter (see handleRefereeLeniencyValueChange).
    fireEvent.change(stepper, { target: { value: '9' } });
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: true,
      refereeLeniencyValue: 5,
    });
  });

  it('REFEREE-02 clamp: typing 1 leaves the confirmed payload at 2', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Referee Leniency' }));
    const stepper = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Referee Leniency value',
    });
    fireEvent.change(stepper, { target: { value: '1' } });
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: true,
      refereeLeniencyValue: 2,
    });
  });

  it('REFEREE-04: renders the "(also affects added time)" coupling note', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText('(also affects added time)')).toBeTruthy();
  });

  it('confirm pass-through, override off: onConfirm receives refereeLeniencyOverride: false, refereeLeniencyValue: 4', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: false,
      refereeLeniencyValue: 4,
    });
  });

  it('confirm pass-through, override on with a changed value: onConfirm receives refereeLeniencyOverride: true and the selected value', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Referee Leniency' }));
    const stepper = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Referee Leniency value',
    });
    fireEvent.change(stepper, { target: { value: '3' } });
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    expect(onConfirm).toHaveBeenCalledWith({
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
      tackleStealDecline: true,
      refereeLeniencyOverride: true,
      refereeLeniencyValue: 3,
    });
  });

  it('independence: unchecking Fouls does not disable or alter the Referee Leniency row (not routed through deriveFoulDependents)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));

    const leniencyCheckbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Referee Leniency',
    });
    expect(leniencyCheckbox.disabled).toBe(false);
    // Booking and Injury only — the Leniency row must never render this helper text.
    expect(screen.getAllByText('(requires Fouls)')).toHaveLength(2);
  });
});
