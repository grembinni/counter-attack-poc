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
      // D-12 tests seed selectedTeams via mockMovementState (cosmos/xolos) — already valid TeamIds.
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

  it('contested HEADER renders Aerial Ability for both sides', () => {
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
    const aerialCount = (container.textContent?.match(/Aerial Ability/g) ?? []).length;
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
    render(<ActionLog />);
    // home-9 in the cosmos squad (mockMovementState default) is Nicolae Rusu.
    expect(screen.getByText(/Nicolae Rusu/)).toBeDefined();
    expect(screen.getByText(/14,13 → 15,13 → 16,13/)).toBeDefined();
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
    // home-9 in the cosmos squad (mockMovementState default) is Nicolae Rusu.
    expect(screen.getByText(/Nicolae Rusu/)).toBeDefined();
    // away-1's exact seeded name is not hardcoded here — assert the number-then-name shape.
    expect(container.textContent).toMatch(/D \d+\s+\S+/);
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
    expect(screen.getByText(/Nicolae Rusu/)).toBeDefined();
    // fmtStatRoll assertions remain unchanged (still spelled out, still - 0)
    expect(container.textContent).toMatch(/Shooting/);
    expect(container.textContent).toMatch(/Saving/);
  });

  it('SHOT_ATTEMPT SAVE renders [SHOT ✗]', () => {
    setEventLog([
      {
        type: 'SHOT_ATTEMPT',
        shooterId: 'home-9',
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
    expect(container.textContent).toMatch(/D \d+\s+\S+/);
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
    // First rendered entry: the handling check under its own [HANDLING] prefix
    expect(entries[0]?.textContent).toMatch(/\[HANDLING\]/);
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
    expect(entries[0]?.textContent).toMatch(/\[HANDLING\]/);
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
