import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ActionEvent } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ActionLog } from './ActionLog.js';

vi.mock('../socket.js', () => ({
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
    io: { on: vi.fn(), off: vi.fn() },
  },
}));

afterEach(() => cleanup());

function setEventLog(eventLog: ActionEvent[]) {
  useGameStore.setState({
    gameState: {
      ...mockMovementState,
      // D-12 tests seed selectedTeams via mockMovementState (city/crew) — valid TeamIds post Phase 19.
      eventLog,
    },
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1,
    roomCode: 'ABC12',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setEventLog([]);
});

// ---------------------------------------------------------------------------
// D-12: shared fmtStatRoll formatter — spelled-out stat name, always shows
// the `- {penalty}` term (including `- 0`).
// ---------------------------------------------------------------------------
describe('ActionLog — D-12: fmtStatRoll spelled-out format', () => {
  it('TACKLE_ATTEMPT renders Tackling and Dribbling with - 0 for both sides', () => {
    setEventLog([
      {
        type: 'TACKLE_ATTEMPT',
        defenderId: 'away-1',
        carrierId: 'home-9',
        defenderDie: 4,
        carrierDie: 3,
        defenderCombined: 5, // Tackling(away-1) + 4 - 0 = 5 -> stat = 1
        carrierCombined: 7, // Dribbling(home-9) + 3 - 0 = 7 -> stat = 4
        result: 'FAIL',
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 22 }, carrierId: 'home-9' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Tackling/);
    expect(container.textContent).toMatch(/Dribbling/);
    // Both sides render "- 0" (penalty always 0 for TACKLE_ATTEMPT) — count occurrences in the combined text.
    const zeroCount = (container.textContent?.match(/- 0/g) ?? []).length;
    expect(zeroCount).toBeGreaterThanOrEqual(2);
  });

  it('SHOT_ATTEMPT with a non-zero penalty renders Shooting/Saving plus - {abs(penalty)}', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'SAVE',
        shooterDie: 4,
        shooterScore: 8, // stat 6, die 4, penalty -2 -> 6+4-2=8
        gkDie: 5,
        gkScore: 9, // stat 4, die 5, penalty 0 -> 4+5-0=9
        handlingDie: null,
        gkHandling: null,
        shooterPenaltyTotal: -2,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: 'away-0' },
      },
    ]);
    render(<ActionLog />);
    expect(screen.getByText(/Shooting/)).toBeDefined();
    expect(screen.getByText(/Saving/)).toBeDefined();
    expect(screen.getByText(/- 2/)).toBeDefined();
  });

  it('SHOT_ATTEMPT with zero penalty renders - 0 (regression guard, not omitted)', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'GOAL',
        shooterDie: 4,
        shooterScore: 10, // stat 6, die 4, penalty 0
        gkDie: 2,
        gkScore: 6, // stat 4, die 2, penalty 0
        handlingDie: null,
        gkHandling: null,
        shooterPenaltyTotal: 0,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Shooting/);
    expect(container.textContent).toMatch(/Saving/);
    const zeroCount = (container.textContent?.match(/- 0/g) ?? []).length;
    expect(zeroCount).toBeGreaterThanOrEqual(2);
  });

  it('STEAL_ATTEMPT renders Tackling and - 0', () => {
    setEventLog([
      {
        type: 'STEAL_ATTEMPT',
        defenderId: 'away-1',
        result: 'SUCCESS',
        defenderDie: 6,
        defenderCombined: 7, // stat 1, die 6, penalty 0
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 22 }, carrierId: 'away-1' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Tackling/);
    expect(container.textContent).toMatch(/- 0/);
  });

  it('contested HEADER renders Aerial for both sides', () => {
    setEventLog([
      {
        type: 'HEADER',
        attackerId: 'home-9',
        defenderId: 'away-1',
        result: 'ATTACKER_WIN',
        attackerDie: 5,
        attackerAerialAbility: 3,
        attackerCombined: 8,
        defenderDie: 2,
        defenderAerialAbility: 4,
        defenderCombined: 6,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    const aerialCount = (container.textContent?.match(/Aerial/g) ?? []).length;
    expect(aerialCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// D-01: per-player move-log lines show first + last name plus the arrow path.
// ---------------------------------------------------------------------------
describe('ActionLog — D-01: per-player move log shows name + path', () => {
  it('a merged two-step MOVE move_group renders firstName lastName and the arrow-joined path', () => {
    setEventLog([
      {
        type: 'MOVE',
        pieceId: 'home-9',
        from: { q: 14, r: 13 },
        to: { q: 15, r: 13 },
        slot: 'ATTACKER_4',
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 13 }, carrierId: 'home-9' },
      },
      {
        type: 'MOVE',
        pieceId: 'home-9',
        from: { q: 15, r: 13 },
        to: { q: 16, r: 13 },
        slot: 'ATTACKER_4',
        timestamp: 1,
        ballAfter: { position: { q: 16, r: 13 }, carrierId: 'home-9' },
      },
    ]);
    const { container } = render(<ActionLog />);
    // home-9 (array index 9 in city squad) is Carlo Holse, jersey #10.
    expect(screen.getByText(/Carlo Holse/)).toBeDefined();
    expect(screen.getByText(/14,13 → 15,13 → 16,13/)).toBeDefined();
    // Requirement 2: the consolidated MOVE entry now carries the player's #-prefixed
    // jersey number ahead of the name.
    expect(container.textContent).toMatch(/#\d+\s+Carlo Holse/);
  });

  it('a MOVE event for an unknown pieceId renders without throwing (fallback path)', () => {
    setEventLog([
      {
        type: 'MOVE',
        pieceId: 'home-99',
        from: { q: 1, r: 1 },
        to: { q: 2, r: 1 },
        slot: 'ATTACKER_4',
        timestamp: 0,
        ballAfter: { position: { q: 2, r: 1 }, carrierId: null },
      },
    ]);
    expect(() => render(<ActionLog />)).not.toThrow();
    // Falls back to the terse pieceLabel (e.g. 'A100') since home-99 is not in pieces.
    expect(screen.getByText(/1,1 → 2,1/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// TODO-NAME / TODO-CHECKX: duel branches render "{number} {Name}" labels and
// carry a ✓/✗ result glyph in their prefix, matching move-log and pass-log
// conventions.
// ---------------------------------------------------------------------------
describe('ActionLog — duel branches: name + result glyph parity', () => {
  it('TACKLE_ATTEMPT SUCCESS renders [TACKLE ✓] and the defender/carrier "{number} {Name}" labels', () => {
    setEventLog([
      {
        type: 'TACKLE_ATTEMPT',
        defenderId: 'away-1',
        carrierId: 'home-9',
        defenderDie: 6,
        carrierDie: 2,
        defenderCombined: 10,
        carrierCombined: 5,
        result: 'SUCCESS',
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 22 }, carrierId: 'away-1' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[TACKLE ✓\]/);
    // home-9 (array index 9 in city squad) is Carlo Holse, jersey #10.
    expect(screen.getByText(/Carlo Holse/)).toBeDefined();
    // away-1's exact seeded name is not hardcoded here — assert the #number-then-name
    // shape, with NO leading role letter (requirement 1 dropped D/A from the vs-line).
    expect(container.textContent).toMatch(/#\d+\s+\S+/);
  });

  it('TACKLE_ATTEMPT FAIL renders [TACKLE ✗]', () => {
    setEventLog([
      {
        type: 'TACKLE_ATTEMPT',
        defenderId: 'away-1',
        carrierId: 'home-9',
        defenderDie: 1,
        carrierDie: 5,
        defenderCombined: 2,
        carrierCombined: 9,
        result: 'FAIL',
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 22 }, carrierId: 'home-9' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[TACKLE ✗\]/);
  });

  it('SHOT_ATTEMPT GOAL renders [SHOT ✓] and the shooter "{number} {Name}" label', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'GOAL',
        shooterDie: 4,
        shooterScore: 10,
        gkDie: 2,
        gkScore: 6,
        handlingDie: null,
        gkHandling: null,
        shooterPenaltyTotal: 0,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[SHOT ✓\]/);
    // home-9 (array index 9 in city squad) is Carlo Holse, jersey #10.
    expect(screen.getByText(/Carlo Holse/)).toBeDefined();
    // GK now rendered as a named PNamed label (TACKLE-parity "vs" shape), not a bare stat string.
    // away-0 (array index 0 in crew squad) is Patrick Schulte, GK jersey #1.
    expect(screen.getByText(/Patrick Schulte/)).toBeDefined();
    // fmtStatRoll assertions remain unchanged (still spelled out, still - 0)
    expect(container.textContent).toMatch(/Shooting/);
    expect(container.textContent).toMatch(/Saving/);
  });

  it('GOAL renders [SHOT] and "{number} {Name} Scored!" for the scorer', () => {
    setEventLog([
      {
        type: 'GOAL',
        scoringTeam: 'home',
        scorerId: 'home-9',
        timestamp: 0,
        ballAfter: { position: { q: 36, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[SHOT\]/);
    // home-9 (array index 9 in city squad) is Carlo Holse, jersey #10.
    expect(screen.getByText(/Carlo Holse/)).toBeDefined();
    expect(container.textContent).toMatch(/Scored!/);
  });

  it('SHOT_ATTEMPT SAVE renders [SHOT ✗]', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'SAVE',
        shooterDie: 4,
        shooterScore: 8,
        gkDie: 5,
        gkScore: 9,
        handlingDie: null,
        gkHandling: null,
        shooterPenaltyTotal: -2,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: 'away-0' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[SHOT ✗\]/);
  });

  it('SHOT_ATTEMPT LOOSE_BALL renders [SHOT ✗]', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'LOOSE_BALL',
        shooterDie: 3,
        shooterScore: 7,
        gkDie: 3,
        gkScore: 7,
        handlingDie: null,
        gkHandling: null,
        shooterPenaltyTotal: 0,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[SHOT ✗\]/);
  });
});

// ---------------------------------------------------------------------------
// TODO-STEAL-DETAIL: STEAL_ATTEMPT (intercept) brought to TACKLE-parity detail
// — full defender challenge + interception threshold, with an honest
// auto-intercept (no-roll) case for the sentinel 0/0 dice values.
// ---------------------------------------------------------------------------
describe('ActionLog — STEAL_ATTEMPT challenge detail parity (TODO-STEAL-DETAIL)', () => {
  it('a rolled STEAL_ATTEMPT renders the defender name, the Tackling fmtStatRoll line, and the threshold clause', () => {
    setEventLog([
      {
        type: 'STEAL_ATTEMPT',
        defenderId: 'away-1',
        result: 'SUCCESS',
        defenderDie: 6,
        defenderCombined: 7,
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 22 }, carrierId: 'away-1' },
      },
    ]);
    const { container } = render(<ActionLog />);
    // The "D" role prefix was dropped in quick task 260621-hnd.
    expect(container.textContent).toMatch(/#\d+\s+\S+/);
    expect(container.textContent).toMatch(/Tackling.*=\s*7/);
    expect(container.textContent).toMatch(/intercept if die 6 or total/i);
  });

  it('an auto-intercept STEAL_ATTEMPT (defenderDie:0, defenderCombined:0) renders "auto-intercept" and omits the Tackling 0 line', () => {
    setEventLog([
      {
        type: 'STEAL_ATTEMPT',
        defenderId: 'away-1',
        result: 'SUCCESS',
        defenderDie: 0,
        defenderCombined: 0,
        timestamp: 0,
        ballAfter: { position: { q: 32, r: 7 }, carrierId: 'away-1' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/auto-intercept/i);
    expect(container.textContent).not.toMatch(/Tackling 0/);
  });
});

// ---------------------------------------------------------------------------
// Quick-task 260621-b8f: ActionLog coverage gaps closed —
//   #3 SHOT_ATTEMPT handling sub-check renders as two separate log entries;
//   #2 HEADED_PASS (won-header delivery) renders [HEADER PASS];
//   #4 GK_PUNT renders [PUNT].
// ---------------------------------------------------------------------------
describe('ActionLog — quick-task 260621-b8f: split shot handling + new pass-format branches', () => {
  it('a handling-running SHOT_ATTEMPT renders two entries: one with the Shooting/Saving duel, one with handling: under a separate prefix', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'SAVE',
        shooterDie: 4,
        shooterScore: 8,
        gkDie: 5,
        gkScore: 9,
        handlingDie: 2,
        gkHandling: 8,
        shooterPenaltyTotal: -2,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: 'away-0' },
      },
    ]);
    const { container } = render(<ActionLog />);
    // Two distinct entries rendered (one per .entry node). ActionLog renders in
    // reverse-chronological order, so the handling entry (pushed second into the
    // underlying consolidated array) appears FIRST, and the duel entry appears second.
    const entries = container.querySelectorAll('[class*="entry"]');
    expect(entries.length).toBe(2);
    // First rendered entry: the handling check under its own [HANDLING ✓] prefix (D-04: SAVE = caught = keeper success)
    expect(entries[0]?.textContent).toMatch(/\[HANDLING ✓\]/);
    expect(entries[0]?.textContent).toMatch(/handling: 2 vs 8/);
    expect(entries[0]?.textContent).toMatch(/caught/);
    // Second rendered entry: the duel — [SHOT ✗] prefix (SAVE outcome) plus Shooting/Saving stat lines
    expect(entries[1]?.textContent).toMatch(/\[SHOT ✗\]/);
    expect(entries[1]?.textContent).toMatch(/Shooting/);
    expect(entries[1]?.textContent).toMatch(/Saving/);
    expect(entries[1]?.textContent).not.toMatch(/handling:/);
  });

  it('a non-handling SHOT_ATTEMPT still renders exactly one entry (regression guard)', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'GOAL',
        shooterDie: 4,
        shooterScore: 10,
        gkDie: 2,
        gkScore: 6,
        handlingDie: null,
        gkHandling: null,
        shooterPenaltyTotal: 0,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    const entries = container.querySelectorAll('[class*="entry"]');
    expect(entries.length).toBe(1);
    expect(entries[0]?.textContent).toMatch(/\[SHOT ✓\]/);
  });

  it('a spilled handling check (outcome LOOSE_BALL) renders "spilled" in the handling entry', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'LOOSE_BALL',
        shooterDie: 4,
        shooterScore: 8,
        gkDie: 5,
        gkScore: 9,
        handlingDie: 1,
        gkHandling: 8,
        shooterPenaltyTotal: -2,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    const entries = container.querySelectorAll('[class*="entry"]');
    expect(entries.length).toBe(2);
    // Reverse-chronological order: handling entry renders first (see comment above).
    // D-04: spilled = keeper failed to handle it = fail glyph.
    expect(entries[0]?.textContent).toMatch(/\[HANDLING ✗\]/);
    expect(entries[0]?.textContent).toMatch(/spilled/);
  });

  it('a HEADED_PASS event renders the [HEADER PASS] prefix and from→to', () => {
    setEventLog([
      {
        type: 'HEADED_PASS',
        passerId: 'home-9',
        from: { q: 27, r: 12 },
        to: { q: 30, r: 12 },
        timestamp: 0,
        ballAfter: { position: { q: 30, r: 12 }, carrierId: 'home-9' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[HEADER PASS\]/);
    expect(container.textContent).toMatch(/27,12 → 30,12/);
  });

  it('a GK_PUNT event renders the [PUNT] prefix and from→to', () => {
    setEventLog([
      {
        type: 'GK_PUNT',
        passerId: 'away-0',
        from: { q: 23, r: 7 },
        to: { q: 23, r: 12 },
        timestamp: 0,
        ballAfter: { position: { q: 23, r: 12 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[PUNT\]/);
    expect(container.textContent).toMatch(/23,7 → 23,12/);
  });
});

// ---------------------------------------------------------------------------
// ActionLog — quick-task 260621-hnd: remaining D/A removal + SNAPSHOT name
// resolution
// ---------------------------------------------------------------------------
describe('ActionLog — quick-task 260621-hnd: remaining D/A removal + SNAPSHOT name resolution', () => {
  it('an uncontested HEADER renders the contestant "#{num} {name}" with no leading role letter', () => {
    setEventLog([
      {
        type: 'HEADER',
        attackerId: 'home-9',
        defenderId: null,
        result: 'ATTACKER_WIN',
        attackerDie: null,
        attackerAerialAbility: null,
        attackerCombined: null,
        defenderDie: null,
        defenderAerialAbility: null,
        defenderCombined: null,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    // home-9 (array index 9 in city squad) is Carlo Holse, jersey #10.
    expect(container.textContent).toMatch(/#\d+\s+Carlo Holse/);
    // No leading role letter immediately precedes the contestant number.
    expect(container.textContent).not.toMatch(/\b[AD] #\d/);
  });

  it('a DEFLECT_ATTEMPT renders the defender "#{num} {name}" with no leading role letter', () => {
    setEventLog([
      {
        type: 'DEFLECT_ATTEMPT',
        defenderId: 'away-1',
        band: 'A',
        die: 6,
        tackling: 2,
        result: 'DEFLECTED',
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/#\d+\s+\S+/);
    expect(container.textContent).not.toMatch(/\b[AD] #\d/);
    expect(container.textContent).toMatch(/\[DEFLECT/);
  });

  it('a SNAPSHOT event renders the resolved shooter name, not the raw piece id', () => {
    setEventLog([
      {
        type: 'SNAPSHOT',
        shooterId: 'home-9',
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: 'home-9' },
      },
    ]);
    const { container } = render(<ActionLog />);
    // home-9 (array index 9 in city squad) is Carlo Holse, jersey #10.
    expect(screen.getByText(/Carlo Holse/)).toBeDefined();
    expect(container.textContent).not.toMatch(/home-9/);
  });

  it('a GK_KICK_MOVE OPP-slot event renders [KEEPER KICK RESPONSE MOVE] with no underscore', () => {
    setEventLog([
      {
        type: 'GK_KICK_MOVE',
        slot: 'OPP',
        pieceId: 'away-1',
        from: { q: 30, r: 13 },
        to: { q: 29, r: 13 },
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[KEEPER KICK RESPONSE MOVE\]/);
    expect(container.textContent).not.toMatch(/_/);
  });
});

// BUG-27: DEFLECT_ATTEMPT NO_DEFLECT entries must consistently render
// 'failed to deflect — [reason]' (never a bare 'failed to deflect').
// Investigation: the TypeScript type requires band/die/tackling as non-optional
// fields; both server emission paths always populate them; the client render
// already appends '— {rangeLabel}, {rollStr}' unconditionally. This test locks
// the format for both bands to prevent regression.
describe('ActionLog — D-01/D-03/D-10: panel chrome and keeper terminology', () => {
  it('renders no ACTION LOG heading text (D-10: duplicate header removed)', () => {
    setEventLog([]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).not.toMatch(/ACTION LOG/i);
  });

  it('a GK_KICK entry renders "K #" not "GK #" (D-03)', () => {
    setEventLog([
      {
        type: 'GK_KICK',
        gkId: 'away-0',
        targetHex: { q: 23, r: 7 },
        accurate: true,
        kickDie: 4,
        kickScore: 6,
        timestamp: 0,
        ballAfter: { position: { q: 23, r: 7 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\bK #/);
    expect(container.textContent).not.toMatch(/\bGK #/);
  });

  it('a SHOT_ATTEMPT with shooterScore null renders "Goal — keeper out of range" not "GK out of range" (D-03/D-11)', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'GOAL',
        shooterDie: 6,
        shooterScore: null,
        gkDie: 0,
        gkScore: null,
        handlingDie: null,
        gkHandling: null,
        shooterPenaltyTotal: 0,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Goal — keeper out of range/);
    expect(container.textContent).not.toMatch(/GK out of range/);
  });
});

describe('ActionLog — D-11/D-12: sentence-case narration and unicode arrows', () => {
  it('a TACKLE_ATTEMPT SUCCESS renders "Success →" and not raw SUCCESS or ASCII arrow', () => {
    setEventLog([
      {
        type: 'TACKLE_ATTEMPT',
        defenderId: 'away-1',
        carrierId: 'home-9',
        defenderDie: 6,
        carrierDie: 2,
        defenderCombined: 10,
        carrierCombined: 5,
        result: 'SUCCESS',
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 22 }, carrierId: 'away-1' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Success →/);
    expect(container.textContent).not.toMatch(/SUCCESS/);
    expect(container.textContent).not.toMatch(/-> /);
  });

  it('a STEAL_ATTEMPT FAIL renders "Failed →" and not raw FAIL/FAILURE', () => {
    setEventLog([
      {
        type: 'STEAL_ATTEMPT',
        defenderId: 'away-1',
        result: 'FAIL',
        defenderDie: 2,
        defenderCombined: 3,
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 22 }, carrierId: 'home-9' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Failed →/);
    expect(container.textContent).not.toMatch(/FAILURE|FAIL /);
  });

  it('a SHOT_ATTEMPT SAVE with a duel renders "Save →" not raw SAVE', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'SAVE',
        shooterDie: 4,
        shooterScore: 8,
        gkDie: 5,
        gkScore: 9,
        handlingDie: null,
        gkHandling: null,
        shooterPenaltyTotal: -2,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: 'away-0' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Save →/);
    expect(container.textContent).not.toMatch(/SAVE/);
  });

  it('a SHOT_ATTEMPT LOOSE_BALL renders "Loose ball (tie) →"', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
        gkId: 'away-0',
        targetHex: { q: 35, r: 13 },
        outcome: 'LOOSE_BALL',
        shooterDie: 3,
        shooterScore: 7,
        gkDie: 3,
        gkScore: 7,
        handlingDie: null,
        gkHandling: null,
        shooterPenaltyTotal: 0,
        gkPenaltyTotal: 0,
        timestamp: 0,
        ballAfter: { position: { q: 35, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Loose ball \(tie\) →/);
  });

  it('a contested HEADER ATTACKER_WIN renders "Attacker wins" not "ATTACKER WINS"', () => {
    setEventLog([
      {
        type: 'HEADER',
        attackerId: 'home-9',
        defenderId: 'away-1',
        result: 'ATTACKER_WIN',
        attackerDie: 5,
        attackerAerialAbility: 3,
        attackerCombined: 8,
        defenderDie: 2,
        defenderAerialAbility: 4,
        defenderCombined: 6,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Attacker wins/);
    expect(container.textContent).not.toMatch(/ATTACKER WINS/);
  });

  it('an HP_ACCURACY accurate event renders "Accurate → contesting header" not "ACCURATE"', () => {
    setEventLog([
      {
        type: 'HP_ACCURACY',
        passerId: 'home-9',
        accurate: true,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Accurate → contesting header/);
    expect(container.textContent).not.toMatch(/ACCURATE/);
  });

  it('a SLOT_ADVANCE entry renders the unicode arrow, not the ASCII arrow', () => {
    setEventLog([
      {
        type: 'SLOT_ADVANCE',
        from: 'ATTACKER_4',
        to: 'DEFENDER_5',
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/→/);
    expect(container.textContent).not.toMatch(/-> /);
  });

  it('a MOVE entry still renders its raw coordinate pair with the unicode arrow (D-13 no-change guard)', () => {
    setEventLog([
      {
        type: 'MOVE',
        pieceId: 'home-9',
        from: { q: 14, r: 13 },
        to: { q: 15, r: 13 },
        slot: 'ATTACKER_4',
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 13 }, carrierId: 'home-9' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/14,13 → 15,13/);
  });
});

describe('ActionLog — BUG-27: DEFLECT_ATTEMPT NO_DEFLECT renders consistent failed-to-deflect format', () => {
  it('band A NO_DEFLECT renders "failed to deflect — close range, die X"', () => {
    setEventLog([
      {
        type: 'DEFLECT_ATTEMPT',
        defenderId: 'away-1',
        band: 'A',
        die: 3,
        tackling: 2,
        result: 'NO_DEFLECT',
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    // 'failed to deflect' must be followed by '— ' and a non-empty reason
    expect(container.textContent).toMatch(/failed to deflect\s*—\s*.+/);
    // Specific reason format for band A without bonus (die >= 5 threshold not met for bonus here)
    // die=3 < 5 → hasBonus is true → 'die 3 + Tackling 2 = 5'
    expect(container.textContent).toContain('close range');
    expect(container.textContent).toContain('die 3 + Tackling 2 = 5');
  });

  it('band B NO_DEFLECT renders "failed to deflect — long range, die X"', () => {
    setEventLog([
      {
        type: 'DEFLECT_ATTEMPT',
        defenderId: 'away-1',
        band: 'B',
        die: 4,
        tackling: 1,
        result: 'NO_DEFLECT',
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/failed to deflect\s*—\s*.+/);
    // Band B has no tackling bonus regardless of die value
    expect(container.textContent).toContain('long range');
    expect(container.textContent).toContain('die 4');
  });
});

// ---------------------------------------------------------------------------
// D-04: glyph rule audit — a SNAP_DEFLECT_MOVE reposition event carries no
// glyph (renamed [DEFLECT] -> [DEFLECT MOVE] to remove the collision with
// DEFLECT_ATTEMPT's outcome-bearing prefix); DEFLECT_ATTEMPT's own glyph is
// unchanged by the rename; GK_KICK_MOVE (a repositioning event with no
// outcome) carries no glyph either.
// ---------------------------------------------------------------------------
describe('ActionLog — D-04: glyph rule', () => {
  it('a SNAP_DEFLECT_MOVE event renders [DEFLECT MOVE] and no glyph', () => {
    setEventLog([
      {
        type: 'SNAP_DEFLECT_MOVE',
        pieceId: 'away-1',
        from: { q: 20, r: 10 },
        to: { q: 21, r: 10 },
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[DEFLECT MOVE\]/);
    expect(container.textContent).not.toMatch(/\[DEFLECT ✓\]|\[DEFLECT ✗\]/);
  });

  it('a DEFLECT_ATTEMPT with result DEFLECTED still renders [DEFLECT ✓] (regression guard for the rename)', () => {
    setEventLog([
      {
        type: 'DEFLECT_ATTEMPT',
        defenderId: 'away-1',
        band: 'A',
        die: 6,
        tackling: 2,
        result: 'DEFLECTED',
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[DEFLECT ✓\]/);
  });

  it('a GK_KICK_MOVE event renders a prefix containing no glyph', () => {
    setEventLog([
      {
        type: 'GK_KICK_MOVE',
        slot: 'KICKER',
        pieceId: 'away-0',
        from: { q: 23, r: 7 },
        to: { q: 24, r: 7 },
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    const entry = container.querySelector('[class*="prefix"]');
    expect(entry?.textContent).not.toMatch(/✓/);
    expect(entry?.textContent).not.toMatch(/✗/);
  });
});

// ---------------------------------------------------------------------------
// Plan 38-07: Corner Kick event rendering (CORNER_KICK_GK_PLACE, CORNER_KICK_TAKER_PLACED,
// CORNER_KICK_STAGE_ADVANCE, CORNER_KICK_MOVE, CORNER_KICK_ACCURACY) and the OUT_OF_BOUNDS
// restartLabel's three-way extension to 'CORNER_KICK'.
// ---------------------------------------------------------------------------
describe('ActionLog — Phase 38 (38-07): Corner Kick event rendering', () => {
  it('an OUT_OF_BOUNDS event with restart CORNER_KICK renders "Corner Kick" (not Throw-In or Goal Kick)', () => {
    setEventLog([
      {
        type: 'OUT_OF_BOUNDS',
        exitHex: { q: 0, r: 5 },
        kind: 'BYLINE',
        restart: 'CORNER_KICK',
        awardedTo: 'away',
        lastTouchedByPieceId: 'home-1',
        timestamp: 0,
        ballAfter: { position: { q: 0, r: 1 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Corner Kick/);
    expect(container.textContent).not.toMatch(/Throw-In/);
  });

  it("a CORNER_KICK_GK_PLACE event names the goalkeeper and which side's window it was", () => {
    setEventLog([
      {
        type: 'CORNER_KICK_GK_PLACE',
        pieceId: 'away-0',
        side: 'ATTACKING',
        from: { q: 35, r: 13 },
        to: { q: 30, r: 10 },
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[CORNER KICK\]/);
    expect(container.textContent).toMatch(/Attacking GK/);
    expect(container.textContent).toMatch(/30,10/);
  });

  it("a CORNER_KICK_TAKER_PLACED event names the corner-taker (mirrors THROW_IN_PLACE's wording shape)", () => {
    setEventLog([
      {
        type: 'CORNER_KICK_TAKER_PLACED',
        pieceId: 'away-9',
        from: { q: 22, r: 13 },
        to: { q: 36, r: 1 },
        timestamp: 0,
        ballAfter: { position: { q: 36, r: 1 }, carrierId: 'away-9' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/placed at 36,1/);
  });

  it('a CORNER_KICK_STAGE_ADVANCE event renders a round-handoff line naming the side that just finished', () => {
    setEventLog([
      {
        type: 'CORNER_KICK_STAGE_ADVANCE',
        fromStageIndex: 0,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[CORNER KICK\]/);
    expect(container.textContent).toMatch(/Attacking team.*reposition round ended/);
  });

  it('a CORNER_KICK_MOVE event names the piece and slot (mirrors the GOAL_KICK_MOVE format)', () => {
    setEventLog([
      {
        type: 'CORNER_KICK_MOVE',
        slot: 'ATTACKER',
        pieceId: 'away-1',
        from: { q: 30, r: 5 },
        to: { q: 32, r: 5 },
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[CORNER KICK RESULT\]/);
    expect(container.textContent).toMatch(/30,5.*32,5/);
  });

  it('an accurate High Pass CORNER_KICK_ACCURACY event names the taker, the die, combined score and outcome', () => {
    setEventLog([
      {
        type: 'CORNER_KICK_ACCURACY',
        takerId: 'away-9',
        passType: 'HIGH',
        targetHex: { q: 33, r: 12 },
        accurate: true,
        kickDie: 5,
        kickScore: 9,
        timestamp: 0,
        ballAfter: { position: { q: 33, r: 12 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[CORNER KICK ✓\]/);
    expect(container.textContent).toMatch(/High Pass/);
    expect(container.textContent).toMatch(/33,12/);
    expect(container.textContent).toMatch(/Accurate/);
  });

  it('an inaccurate Low Pass CORNER_KICK_ACCURACY event renders the ✗ glyph and "Inaccurate — loose ball"', () => {
    setEventLog([
      {
        type: 'CORNER_KICK_ACCURACY',
        takerId: 'away-9',
        passType: 'LOW',
        targetHex: { q: 33, r: 12 },
        accurate: false,
        kickDie: 2,
        kickScore: 5,
        timestamp: 0,
        ballAfter: { position: { q: 33, r: 12 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[CORNER KICK ✗\]/);
    expect(container.textContent).toMatch(/Low Pass/);
    expect(container.textContent).toMatch(/Inaccurate — loose ball/);
  });

  // Gap-closure round 3 (38-26): regression test for 38-24-SUMMARY.md bug 4 — a
  // CORNER_KICK_CLEAR_OUT_MOVE event previously crashed formatEvent (missing switch case,
  // TS2366) which crashed the whole ActionLog render via the { prefix } destructure.
  it('a CORNER_KICK_CLEAR_OUT_MOVE event renders a normal action-log line instead of crashing', () => {
    setEventLog([
      {
        type: 'CORNER_KICK_CLEAR_OUT_MOVE',
        slot: 'ATTACKER',
        pieceId: 'away-3',
        from: { q: 34, r: 12 },
        to: { q: 31, r: 12 },
        timestamp: 0,
      },
    ]);
    expect(() => render(<ActionLog />)).not.toThrow();
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[CORNER KICK\]/);
    expect(container.textContent).toMatch(/34,12.*31,12/);
  });

  it('a CORNER_KICK_CLEAR_OUT_MOVE event renders correctly alongside another corner event in a mixed list', () => {
    setEventLog([
      {
        type: 'CORNER_KICK_TAKER_PLACED',
        pieceId: 'away-9',
        from: { q: 22, r: 13 },
        to: { q: 36, r: 1 },
        timestamp: 0,
        ballAfter: { position: { q: 36, r: 1 }, carrierId: 'away-9' },
      },
      {
        type: 'CORNER_KICK_CLEAR_OUT_MOVE',
        slot: 'DEFENDER',
        pieceId: 'home-4',
        from: { q: 33, r: 11 },
        to: { q: 30, r: 11 },
        timestamp: 1,
      },
    ]);
    expect(() => render(<ActionLog />)).not.toThrow();
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/placed at 36,1/);
    expect(container.textContent).toMatch(/33,11.*30,11/);
  });
});

describe('ActionLog — Phase 39 (39-01): Fouls, Cards, Injuries & Penalty Kicks event rendering', () => {
  it('a LOOSE_BALL_LAND event with direction 2, distance 3 renders both NE and 3 hex (D-15)', () => {
    setEventLog([
      {
        type: 'LOOSE_BALL_LAND',
        from: { q: 18, r: 13 },
        to: { q: 19, r: 10 },
        direction: 2,
        distance: 3,
        timestamp: 0,
        ballAfter: { position: { q: 19, r: 10 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/NE/);
    expect(container.textContent).toMatch(/3 hex/);
  });

  it('a LOOSE_BALL_LAND event with distance 1 renders singular "hex" (not "hexes")', () => {
    setEventLog([
      {
        type: 'LOOSE_BALL_LAND',
        from: { q: 18, r: 13 },
        to: { q: 19, r: 13 },
        direction: 1,
        distance: 1,
        timestamp: 0,
        ballAfter: { position: { q: 19, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/1 hex\b/);
    expect(container.textContent).not.toMatch(/1 hexes/);
  });

  it('a FOUL_CALLED event names the fouling player, victim, and die; appends DOGSO when professional', () => {
    setEventLog([
      {
        type: 'FOUL_CALLED',
        defenderId: 'away-1',
        victimId: 'home-9',
        hex: { q: 15, r: 22 },
        source: 'TACKLE',
        defenderDie: 1,
        professional: true,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[FOUL\]/);
    expect(container.textContent).toMatch(/fouled/);
    expect(container.textContent).toMatch(/Professional Foul \(DOGSO\)/);
  });

  it('an INJURY_CHECK event shows the injured glyph and Resilience comparison when injured', () => {
    setEventLog([
      {
        type: 'INJURY_CHECK',
        victimId: 'home-9',
        die: 5,
        resilience: 3,
        injured: true,
        injuryCount: 1,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[INJURY ✓\]/);
    expect(container.textContent).toMatch(/Resilience 3/);
    expect(container.textContent).toMatch(/Injured/);
  });

  it('an INJURY_CHECK event shows the non-injured glyph and "No injury" when not injured', () => {
    setEventLog([
      {
        type: 'INJURY_CHECK',
        victimId: 'home-9',
        die: 1,
        resilience: 5,
        injured: false,
        injuryCount: 0,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[INJURY ✗\]/);
    expect(container.textContent).toMatch(/No injury/);
  });

  it('a BOOKING_CHECK event renders Yellow Card and Leniency comparison', () => {
    setEventLog([
      {
        type: 'BOOKING_CHECK',
        defenderId: 'away-1',
        die: 4,
        leniency: 3,
        card: 'yellow',
        secondYellow: false,
        professional: false,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[BOOKING\]/);
    expect(container.textContent).toMatch(/Leniency 3/);
    expect(container.textContent).toMatch(/Yellow Card/);
  });

  it('a BOOKING_CHECK event renders "Red Card (2nd Yellow)" for a second-yellow dismissal', () => {
    setEventLog([
      {
        type: 'BOOKING_CHECK',
        defenderId: 'away-1',
        die: 5,
        leniency: 3,
        card: 'red',
        secondYellow: true,
        professional: false,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Red Card \(2nd Yellow\)/);
  });

  it('a FOUL_CHOICE_MADE event shows "Play continues" for a continue choice', () => {
    setEventLog([
      {
        type: 'FOUL_CHOICE_MADE',
        team: 'home',
        choice: 'continue',
        restart: null,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[FOUL\]/);
    expect(container.textContent).toMatch(/Play continues/);
  });

  it('a FOUL_CHOICE_MADE event shows "Penalty awarded" for a penalty restart choice', () => {
    setEventLog([
      {
        type: 'FOUL_CHOICE_MADE',
        team: 'home',
        choice: 'restart',
        restart: 'PENALTY',
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/Penalty awarded/);
  });

  it('a GK_DIVE_AT_FEET event renders the vs-comparison and the -1-at-3-hexes note when penalized', () => {
    setEventLog([
      {
        type: 'GK_DIVE_AT_FEET',
        gkId: 'away-0',
        carrierId: 'home-9',
        gkDie: 3,
        carrierDie: 4,
        gkCombined: 7,
        carrierCombined: 8,
        distance: 3,
        savingPenalty: -1,
        result: 'FAIL',
        timestamp: 0,
        ballAfter: { position: { q: 15, r: 22 }, carrierId: 'home-9' },
        // 39-UAT gap 3 (39-20): diveFrom/diveTo are now required on this event variant.
        diveFrom: { q: 14, r: 22 },
        diveTo: { q: 15, r: 22 },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[DIVE AT FEET ✗\]/);
    expect(container.textContent).toMatch(/Saving/);
    expect(container.textContent).toMatch(/Dribbling/);
    expect(container.textContent).toMatch(/−1 at 3 hexes/);
  });

  it('a GK_DIVE_AT_FEET_DECLINED event names the GK who declined', () => {
    setEventLog([
      {
        type: 'GK_DIVE_AT_FEET_DECLINED',
        gkId: 'away-0',
        carrierId: 'home-9',
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[DIVE AT FEET\]/);
    expect(container.textContent).toMatch(/declined to dive/);
  });

  it('a GK_BOX_ENTRY_MOVE event shows the GK name and from/to coordinates', () => {
    setEventLog([
      {
        type: 'GK_BOX_ENTRY_MOVE',
        gkId: 'away-0',
        from: { q: 33, r: 12 },
        to: { q: 34, r: 13 },
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[KEEPER RESPONSE\]/);
    expect(container.textContent).toMatch(/33,12.*34,13/);
  });

  it('a PENALTY_KICK_WINDOW_ADVANCE event names the team that finished repositioning', () => {
    setEventLog([
      {
        type: 'PENALTY_KICK_WINDOW_ADVANCE',
        from: 'ATTACKING',
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[PENALTY KICK\]/);
    expect(container.textContent).toMatch(/Attacking team finished repositioning/);
  });

  it('a PENALTY_KICK_TAKER_PLACED event names the taker and the penalty-spot hex', () => {
    setEventLog([
      {
        type: 'PENALTY_KICK_TAKER_PLACED',
        pieceId: 'home-9',
        hex: { q: 4, r: 13 },
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[PENALTY KICK\]/);
    expect(container.textContent).toMatch(/will take the penalty \(4,13\)/);
  });

  it('a PENALTY_KICK GOAL result renders the goal glyph, vs-comparison, and the GK -2 term', () => {
    setEventLog([
      {
        type: 'PENALTY_KICK',
        takerId: 'home-9',
        gkId: 'away-0',
        takerDie: 5,
        gkDie: 3,
        takerCombined: 10,
        gkCombined: 5,
        result: 'GOAL',
        timestamp: 0,
        ballAfter: { position: { q: 0, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[PENALTY ✓\]/);
    expect(container.textContent).toMatch(/Shooting/);
    expect(container.textContent).toMatch(/Saving/);
    expect(container.textContent).toMatch(/- 2/);
    expect(container.textContent).toMatch(/Goal!/);
  });

  it('a PENALTY_KICK SAVED result renders the saved glyph and "Saved"', () => {
    setEventLog([
      {
        type: 'PENALTY_KICK',
        takerId: 'home-9',
        gkId: 'away-0',
        takerDie: 2,
        gkDie: 6,
        takerCombined: 6,
        gkCombined: 10,
        result: 'SAVED',
        timestamp: 0,
        ballAfter: { position: { q: 4, r: 13 }, carrierId: 'away-0' },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[PENALTY ✗\]/);
    expect(container.textContent).toMatch(/Saved/);
  });

  it('a PENALTY_KICK TIE result renders the tie glyph and "Tie — loose ball"', () => {
    setEventLog([
      {
        type: 'PENALTY_KICK',
        takerId: 'home-9',
        gkId: 'away-0',
        takerDie: 4,
        gkDie: 4,
        takerCombined: 8,
        gkCombined: 8,
        result: 'TIE',
        timestamp: 0,
        ballAfter: { position: { q: 4, r: 13 }, carrierId: null },
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[PENALTY\]/);
    expect(container.textContent).toMatch(/Tie — loose ball/);
  });

  it('a SECOND_HALF_CONFIRM event names the confirming team and shows the starting note when both confirmed', () => {
    setEventLog([
      {
        type: 'SECOND_HALF_CONFIRM',
        team: 'away',
        bothConfirmed: true,
        timestamp: 0,
      },
    ]);
    const { container } = render(<ActionLog />);
    expect(container.textContent).toMatch(/\[HALF TIME\]/);
    expect(container.textContent).toMatch(/Away confirmed/);
    expect(container.textContent).toMatch(/starting 2nd half/);
  });
});
