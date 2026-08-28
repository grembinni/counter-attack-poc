import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { MatchSummaryContent } from './MatchSummaryContent.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());

/** Seeds the store with mockMovementState plus the given gameState overrides. */
function seed(overrides: Partial<typeof mockMovementState> = {}) {
  useGameStore.setState({
    gameState: { ...mockMovementState, ...overrides },
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1,
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
    selectedPassType: null,
  });
}

// ─── Settings recap (STATS-03, D-12/D-13) ─────────────────────────────────

describe('MatchSummaryContent — settings recap', () => {
  it('renders a SETTINGS section label above the recap row', () => {
    seed();
    render(<MatchSummaryContent />);
    expect(screen.getByText('SETTINGS')).toBeDefined();
  });

  it('renders (Fouls: Off) when foulsEnabled is false, and (Booking: Active)/(Injury: Active)/(Out-of-Bounds: Active) when those three are true', () => {
    seed({
      foulsEnabled: false,
      bookingEnabled: true,
      injuryEnabled: true,
      outOfBoundsEnabled: true,
    });
    render(<MatchSummaryContent />);
    expect(screen.getByText('(Fouls: Off)')).toBeDefined();
    expect(screen.getByText('(Booking: Active)')).toBeDefined();
    expect(screen.getByText('(Injury: Active)')).toBeDefined();
    expect(screen.getByText('(Out-of-Bounds: Active)')).toBeDefined();
  });

  it('renders (Tackle/Steal Decline: On) when tackleStealDeclineEnabled is true', () => {
    seed({ tackleStealDeclineEnabled: true });
    render(<MatchSummaryContent />);
    expect(screen.getByText('(Tackle/Steal Decline: On)')).toBeDefined();
  });

  it('renders (Tackle/Steal Decline: Off) when tackleStealDeclineEnabled is false', () => {
    seed({ tackleStealDeclineEnabled: false });
    render(<MatchSummaryContent />);
    expect(screen.getByText('(Tackle/Steal Decline: Off)')).toBeDefined();
  });

  it('renders (Referee Leniency: Manual — 4) when refereeCard.wasManualOverride is true (STATS-03)', () => {
    seed({ refereeCard: { leniency: 4, wasManualOverride: true } });
    render(<MatchSummaryContent />);
    expect(screen.getByText('(Referee Leniency: Manual — 4)')).toBeDefined();
  });

  it('renders (Referee Leniency: Auto — 4) when refereeCard.wasManualOverride is false (STATS-03)', () => {
    seed({ refereeCard: { leniency: 4, wasManualOverride: false } });
    render(<MatchSummaryContent />);
    expect(screen.getByText('(Referee Leniency: Auto — 4)')).toBeDefined();
  });

  it('renders (Referee Leniency: Auto — 4) when refereeCard.wasManualOverride is absent (undefined)', () => {
    seed({ refereeCard: { leniency: 4 } });
    render(<MatchSummaryContent />);
    expect(screen.getByText('(Referee Leniency: Auto — 4)')).toBeDefined();
  });

  it('renders the Off/disabled word for an undefined toggle, never a blank or the string "undefined"', () => {
    // mockMovementState does not set any of these five toggle fields, so they
    // are already undefined by default — no override needed to exercise the
    // undefined branch (exactOptionalPropertyTypes forbids passing `undefined`
    // explicitly for a non-`| undefined`-typed optional field).
    seed();
    render(<MatchSummaryContent />);
    expect(screen.getByText('(Fouls: Off)')).toBeDefined();
    expect(screen.getByText('(Booking: Off)')).toBeDefined();
    expect(screen.getByText('(Injury: Off)')).toBeDefined();
    expect(screen.getByText('(Out-of-Bounds: Off)')).toBeDefined();
    expect(screen.getByText('(Tackle/Steal Decline: Off)')).toBeDefined();
    expect(screen.queryByText(/undefined/i)).toBeNull();
  });

  it('does NOT include Game Speed or team/formation/uniform selections in the recap (D-13 scope boundary)', () => {
    seed();
    render(<MatchSummaryContent />);
    expect(screen.queryByText(/game speed/i)).toBeNull();
    expect(screen.queryByText(/formation/i)).toBeNull();
    expect(screen.queryByText(/uniform/i)).toBeNull();
  });
});

// ─── Seven diverging stat rows ─────────────────────────────────────────────

describe('MatchSummaryContent — diverging stat rows', () => {
  it('renders seven diverging rows with the exact labels, in order, after the possession row', () => {
    seed();
    render(<MatchSummaryContent />);
    const labels = [
      'PASSES COMPLETED',
      'TACKLES & STEALS',
      'SHOTS',
      'EXPECTED GOALS (XG)',
      'FOULS',
      'YELLOW CARDS',
      'RED CARDS',
    ];
    const positions = labels.map((label) => {
      const el = screen.getByText(label);
      const all = Array.from(document.querySelectorAll('body *'));
      return all.indexOf(el);
    });
    for (let i = 1; i < positions.length; i++) {
      // noUncheckedIndexedAccess types array indexing as possibly-undefined;
      // both indices are always in bounds here (fixed-length `positions`).
      expect(positions[i] as number).toBeGreaterThan(positions[i - 1] as number);
    }
  });

  it('shows the home value on the left and the away value on the right, read from matchStats with a ?? 0 default', () => {
    seed({
      matchStats: {
        ...mockMovementState.matchStats,
        possessionActionCount: { home: 0, away: 0 },
        passesCompleted: { home: 12, away: 7 },
        tackleStealAttempts: { home: 0, away: 0 },
        tackleStealSuccesses: { home: 0, away: 0 },
        shots: { home: 0, away: 0 },
        xg: { home: 0, away: 0 },
        fouls: { home: 0, away: 0 },
        yellowCards: { home: 0, away: 0 },
        redCards: { home: 0, away: 0 },
      },
    });
    render(<MatchSummaryContent />);
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
  });

  it('renders 0 on both sides and a flat unfilled track for every diverging row, and throws nothing, when matchStats is entirely undefined', () => {
    // mockMovementState does not set matchStats, so it is already undefined by
    // default — no override needed (exactOptionalPropertyTypes forbids passing
    // `undefined` explicitly for a non-`| undefined`-typed optional field).
    seed();
    const { container } = render(<MatchSummaryContent />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
    const noDataTracks = container.querySelectorAll('[class*="barTrackNoData"]');
    expect(noDataTracks.length).toBeGreaterThan(0);
  });

  it('splits a diverging bar 75%/25% for home 3 / away 1', () => {
    seed({
      matchStats: {
        ...mockMovementState.matchStats,
        possessionActionCount: { home: 0, away: 0 },
        passesCompleted: { home: 3, away: 1 },
        tackleStealAttempts: { home: 0, away: 0 },
        tackleStealSuccesses: { home: 0, away: 0 },
        shots: { home: 0, away: 0 },
        xg: { home: 0, away: 0 },
        fouls: { home: 0, away: 0 },
        yellowCards: { home: 0, away: 0 },
        redCards: { home: 0, away: 0 },
      },
    });
    const { container } = render(<MatchSummaryContent />);
    const homeSegment = container.querySelector('[class*="barSegmentHome"]') as HTMLElement;
    const awaySegment = container.querySelector('[class*="barSegmentAway"]') as HTMLElement;
    expect(homeSegment.style.width).toBe('75%');
    expect(awaySegment.style.width).toBe('25%');
  });

  it('renders the no-data flat-track modifier instead of a 50/50 split when home 0 / away 0', () => {
    seed({
      matchStats: {
        ...mockMovementState.matchStats,
        possessionActionCount: { home: 0, away: 0 },
        passesCompleted: { home: 0, away: 0 },
        tackleStealAttempts: { home: 0, away: 0 },
        tackleStealSuccesses: { home: 0, away: 0 },
        shots: { home: 0, away: 0 },
        xg: { home: 0, away: 0 },
        fouls: { home: 0, away: 0 },
        yellowCards: { home: 0, away: 0 },
        redCards: { home: 0, away: 0 },
      },
    });
    const { container } = render(<MatchSummaryContent />);
    const noDataTracks = container.querySelectorAll('[class*="barTrackNoData"]');
    expect(noDataTracks.length).toBeGreaterThan(0);
    const segments = container.querySelectorAll(
      '[class*="barSegmentHome"], [class*="barSegmentAway"]',
    );
    expect(segments.length).toBe(0);
  });

  it('formats Tackles & Steals as "{successes} ({percent}%)" per side, with 0 attempts rendering 0 (0%)', () => {
    seed({
      matchStats: {
        ...mockMovementState.matchStats,
        possessionActionCount: { home: 0, away: 0 },
        passesCompleted: { home: 0, away: 0 },
        tackleStealAttempts: { home: 10, away: 0 },
        tackleStealSuccesses: { home: 6, away: 0 },
        shots: { home: 0, away: 0 },
        xg: { home: 0, away: 0 },
        fouls: { home: 0, away: 0 },
        yellowCards: { home: 0, away: 0 },
        redCards: { home: 0, away: 0 },
      },
    });
    render(<MatchSummaryContent />);
    expect(screen.getByText('6 (60%)')).toBeDefined();
    expect(screen.getByText('0 (0%)')).toBeDefined();
  });

  it('drives the Tackles & Steals bar from the raw success counts, not the percentages', () => {
    seed({
      matchStats: {
        ...mockMovementState.matchStats,
        possessionActionCount: { home: 0, away: 0 },
        passesCompleted: { home: 0, away: 0 },
        // home: 3/4 successes (75% success rate), away: 1/1 (100% success rate) —
        // if the bar used percentages, away would dominate (100 vs 75); using raw
        // counts, home dominates (3 vs 1).
        tackleStealAttempts: { home: 4, away: 1 },
        tackleStealSuccesses: { home: 3, away: 1 },
        shots: { home: 0, away: 0 },
        xg: { home: 0, away: 0 },
        fouls: { home: 0, away: 0 },
        yellowCards: { home: 0, away: 0 },
        redCards: { home: 0, away: 0 },
      },
    });
    const { container } = render(<MatchSummaryContent />);
    const homeSegment = container.querySelector('[class*="barSegmentHome"]') as HTMLElement;
    // raw counts 3 vs 1 => home share 75%, not the 75%-vs-100% percentage figures.
    expect(homeSegment.style.width).toBe('75%');
  });

  it('applies the card-colour value modifier (not team-accent) to Yellow Cards and Red Cards numerals, while their bars still use team-accent segments', () => {
    seed({
      matchStats: {
        ...mockMovementState.matchStats,
        possessionActionCount: { home: 0, away: 0 },
        passesCompleted: { home: 0, away: 0 },
        tackleStealAttempts: { home: 0, away: 0 },
        tackleStealSuccesses: { home: 0, away: 0 },
        shots: { home: 0, away: 0 },
        xg: { home: 0, away: 0 },
        fouls: { home: 0, away: 0 },
        yellowCards: { home: 2, away: 1 },
        redCards: { home: 1, away: 0 },
      },
    });
    const { container } = render(<MatchSummaryContent />);
    const cardYellowValues = container.querySelectorAll('[class*="valueCardYellow"]');
    const cardRedValues = container.querySelectorAll('[class*="valueCardRed"]');
    expect(cardYellowValues.length).toBe(2);
    expect(cardRedValues.length).toBe(2);
    // Bars beneath those rows still use team-accent segments.
    const homeSegments = container.querySelectorAll('[class*="barSegmentHome"]');
    const awaySegments = container.querySelectorAll('[class*="barSegmentAway"]');
    expect(homeSegments.length).toBeGreaterThan(0);
    expect(awaySegments.length).toBeGreaterThan(0);
  });
});
