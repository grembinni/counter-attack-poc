/**
 * Phase 27 — GameSettingsScreen behavior tests (DRAFT-01, D-04/D-05/D-06).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameSettingsScreen } from './GameSettingsScreen.js';
import styles from './GameSettingsScreen.module.css';

afterEach(() => cleanup());

// SETTINGS-05/06 (Phase 44): the Advanced disclosure is collapsed by default — every
// test that needs to query a match-rule checkbox must open it first. Uses a /advanced/i
// regex, not an exact string, since the accessible name includes the chevron glyph.
async function openAdvanced() {
  await userEvent.click(screen.getByRole('button', { name: /advanced/i }));
}

describe('GameSettingsScreen — renders controls', () => {
  it('renders the heading, Match Speed picker, Team Type toggle, and Confirm CTA', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

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
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Standard' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryByText('Draft Pool')).toBeNull();
  });
});

describe('GameSettingsScreen — Draft mode pool checkboxes (D-04/D-05)', () => {
  it('selecting Draft reveals five pool checkboxes with Original pre-checked', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

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
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));

    const legends = screen.getByRole<HTMLInputElement>('checkbox', { name: /legends/i });
    const icons = screen.getByRole<HTMLInputElement>('checkbox', { name: /icons/i });

    expect(legends.disabled).toBe(false);
    expect(icons.disabled).toBe(false);
    expect(screen.queryByText('(coming soon)')).toBeNull();
  });

  it('clicking a Legends/Icons checkbox toggles it checked (D-08, Phase 30)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));
    const legends = screen.getByRole<HTMLInputElement>('checkbox', { name: /legends/i });

    await userEvent.click(legends);

    expect(legends.checked).toBe(true);
  });
});

describe('GameSettingsScreen — Confirm disabled state (D-06)', () => {
  it('Confirm is enabled by default in Draft mode (Original pre-checked)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));

    const confirmButton = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Confirm Settings',
    });
    expect(confirmButton.disabled).toBe(false);
  });

  it('Confirm becomes disabled when all enabled pools are unchecked, then re-enables after checking one', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

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

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));
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

    await userEvent.click(screen.getByRole('button', { name: /fast/i }));
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
  it('renders the "Out-of-Bounds / Restarts" row with a checked checkbox by default (D-14)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

    const checkbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Out-of-Bounds / Restarts',
    });
    expect(checkbox.checked).toBe(true);
  });

  it('unchecking the toggle then Confirm Settings calls onConfirm with outOfBounds: false', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);
    await openAdvanced();

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
  it('renders the "Tackle/Steal Decline Prompt" row with a checked checkbox by default', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

    const checkbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Tackle/Steal Decline Prompt',
    });
    expect(checkbox.checked).toBe(true);
  });

  it('unchecking the toggle then Confirm Settings calls onConfirm with tackleStealDecline: false', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);
    await openAdvanced();

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
  it('all four checkboxes are checked on first render', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Fouls' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Booking' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Injury' }).checked).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Out-of-Bounds / Restarts' }).checked,
    ).toBe(true);
  });

  it('unchecking Fouls disables Booking/Injury and renders "(requires Fouls)" twice', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

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
    await openAdvanced();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));
    // Accessible name includes the trailing "(requires Fouls)" helper text once disabled.
    const booking = screen.getByRole<HTMLInputElement>('checkbox', { name: /^Booking/ });
    expect(booking.checked).toBe(true);

    await userEvent.click(booking);

    expect(booking.checked).toBe(true);
  });

  it('re-checking Fouls re-enables Booking/Injury and removes the helper text', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

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
    await openAdvanced();

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
  it('renders a Back control in the default Standard state', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
  });

  it('still renders after switching Team Type to Draft and after clicking Confirm Settings (D-05)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Draft' }));
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

describe('GameSettingsScreen — Advanced disclosure (SETTINGS-05/06, Phase 44)', () => {
  it('the Fouls checkbox is not rendered on first render, and the Advanced trigger reads collapsed', () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);

    expect(screen.queryByRole('checkbox', { name: 'Fouls' })).toBeNull();
    expect(screen.getByRole('button', { name: /advanced/i }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('clicking Advanced reveals all five match-rule checkboxes and sets aria-expanded true; clicking again hides them', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /advanced/i });

    await userEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Fouls' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /^Booking/ })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /^Injury/ })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Out-of-Bounds / Restarts' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Tackle/Steal Decline Prompt' })).toBeTruthy();

    await userEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('checkbox', { name: 'Fouls' })).toBeNull();
  });

  it('lays the revealed toggles out in exactly two columns: Fouls/Booking/Injury left, Out-of-Bounds/Tackle-Steal-Decline right (SETTINGS-06)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

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

    expect(
      within(rightColumn).getByRole('checkbox', { name: 'Out-of-Bounds / Restarts' }),
    ).toBeTruthy();
    expect(
      within(rightColumn).getByRole('checkbox', { name: 'Tackle/Steal Decline Prompt' }),
    ).toBeTruthy();
  });
});

describe('GameSettingsScreen — Fouls dependency shared derivation (SETTINGS-07, Phase 44)', () => {
  it('render time: with the drawer open, unchecking Fouls disables Booking/Injury and shows "(requires Fouls)" twice', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

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
    await openAdvanced();

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

  it('cross-site: with the drawer never opened, onConfirm receives the unchanged default payload', async () => {
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

  it('confirm-with-drawer-closed-after-editing: opening, unchecking Fouls, then re-closing the drawer preserves fouls/booking/injury: false at confirm time', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /advanced/i });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));
    await userEvent.click(trigger);

    expect(screen.queryByRole('checkbox', { name: 'Fouls' })).toBeNull();

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
  it('REFEREE-01: the "Referee Leniency" checkbox is present and unchecked on first render', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

    const checkbox = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Referee Leniency' });
    expect(checkbox.checked).toBe(false);
  });

  it('REFEREE-01/D-04: the stepper is present and disabled on first render (always mounted, never conditionally rendered)', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

    const stepper = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Referee Leniency value',
    });
    expect(stepper).toBeTruthy();
    expect(stepper.disabled).toBe(true);
  });

  it('REFEREE-02/D-01: the stepper shows 4 and becomes enabled after clicking the override checkbox', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

    const stepper = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Referee Leniency value',
    });
    expect(stepper.value).toBe('4');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Referee Leniency' }));

    expect(stepper.disabled).toBe(false);
  });

  it('REFEREE-02/D-02/D-03: the stepper min is 2 and max is 5', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

    const stepper = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Referee Leniency value',
    });
    expect(stepper.min).toBe('2');
    expect(stepper.max).toBe('5');
  });

  it('REFEREE-02 clamp: typing 9 leaves the confirmed payload at 5', async () => {
    const onConfirm = vi.fn();
    render(<GameSettingsScreen onConfirm={onConfirm} onBack={vi.fn()} />);
    await openAdvanced();

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
    await openAdvanced();

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

  it('REFEREE-04: renders the "(also affects added time)" coupling note', async () => {
    render(<GameSettingsScreen onConfirm={vi.fn()} onBack={vi.fn()} />);
    await openAdvanced();

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
    await openAdvanced();

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
    await openAdvanced();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Fouls' }));

    const leniencyCheckbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Referee Leniency',
    });
    expect(leniencyCheckbox.disabled).toBe(false);
    // Booking and Injury only — the Leniency row must never render this helper text.
    expect(screen.getAllByText('(requires Fouls)')).toHaveLength(2);
  });
});
