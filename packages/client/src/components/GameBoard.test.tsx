import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TEAM_CONFIGS, STOPPAGE_PHASES } from '@counter-attack/shared';
import type { GamePhase } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import {
  deriveAaAccentColor,
  AA_REFERENCE_BG_HEX,
  AA_REFERENCE_FG_HEX,
} from '../hooks/useTeamColors.js';
import { GameBoard } from './GameBoard.js';

vi.mock('../socket.js', () => ({
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
    // ConnectionStatus also calls socket.io.on/off ('reconnect_attempt' manager event)
    io: { on: vi.fn(), off: vi.fn() },
  },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

// Phase 39 (39-16 Task 3): the four new prompt/setup panels are mocked to identifiable
// stubs for the phase-dispatch assertions below — the point of those tests is which panel
// GameBoard's topBandRight ternary routes to, not each panel's own internal guard/copy
// logic (already covered by their own dedicated test suites from Plans 39-08/39-09).
vi.mock('./FoulChoicePanel.js', () => ({
  FoulChoicePanel: () => <div data-testid="mock-foul-choice-panel">MockFoulChoicePanel</div>,
}));
vi.mock('./GkDiveAtFeetPromptPanel.js', () => ({
  GkDiveAtFeetPromptPanel: () => (
    <div data-testid="mock-gk-dive-at-feet-prompt-panel">MockGkDiveAtFeetPromptPanel</div>
  ),
}));
vi.mock('./GkBoxEntryPromptPanel.js', () => ({
  GkBoxEntryPromptPanel: () => (
    <div data-testid="mock-gk-box-entry-prompt-panel">MockGkBoxEntryPromptPanel</div>
  ),
}));
vi.mock('./PenaltyKickSetupPanel.js', () => ({
  PenaltyKickSetupPanel: () => (
    <div data-testid="mock-penalty-kick-setup-panel">MockPenaltyKickSetupPanel</div>
  ),
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: { ...mockMovementState },
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1,
    roomCode: 'ABC12',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

// ---------------------------------------------------------------------------
// CLOCK-01: MM:00 format — actionCount maps to "${actionCount}:00"
// ---------------------------------------------------------------------------
describe('GameBoard — CLOCK-01: MM:00 format', () => {
  it('renders "7:00" when actionCount is 7', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, actionCount: 7 } });
    render(<GameBoard />);
    expect(screen.getByText(/7:00/)).toBeDefined();
  });

  it('renders "45:00" when actionCount is 45', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, actionCount: 45 } });
    render(<GameBoard />);
    expect(screen.getByText(/45:00/)).toBeDefined();
  });

  it('renders "46:00" when actionCount is 46 (added time / second half overflow)', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, actionCount: 46 } });
    render(<GameBoard />);
    expect(screen.getByText(/46:00/)).toBeDefined();
  });

  it('renders clock for actionCount 0 (matches /0?0:00/ to allow padStart variance)', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, actionCount: 0 } });
    render(<GameBoard />);
    // UI-SPEC formula: String(actionCount).padStart(2,'0') + ':00' → "00:00"
    // Accept either "0:00" or "00:00"
    expect(screen.getByText(/0?0:00/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CLOCK-02: clock visible in all phases — no PLAY_PHASES gating
// ---------------------------------------------------------------------------
describe('GameBoard — CLOCK-02: clock visible in all phases', () => {
  it('renders the clock during HALF_TIME phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'HALF_TIME', actionCount: 45 },
    });
    render(<GameBoard />);
    // HALF_TIME: overlay shows literal 45:00 + scoreboard shows computed 45:00 — both valid
    expect(screen.getAllByText(/\d+:00/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the clock during KICK_OFF_SETUP phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'KICK_OFF_SETUP', actionCount: 3 },
    });
    render(<GameBoard />);
    expect(screen.getByText(/\d+:00/)).toBeDefined();
  });

  it('renders the clock during FULL_TIME phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'FULL_TIME', actionCount: 90 },
    });
    render(<GameBoard />);
    expect(screen.getAllByText(/\d+:00/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the clock during REPLAY phase', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'REPLAY',
        actionCount: 68,
        replayIndex: 1,
        replayTotal: 10,
      },
    });
    render(<GameBoard />);
    expect(screen.getByText(/\d+:00/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// LAYOUT-01: scoreboard shows home and away scores
// ---------------------------------------------------------------------------
describe('GameBoard — LAYOUT-01: scoreboard scores', () => {
  it('renders home score "2" and away score "1" in the scoreboard', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, score: { home: 2, away: 1 } },
    });
    render(<GameBoard />);
    // Both score digits must appear — scoreboard shows home | center | away
    const twos = screen.getAllByText('2');
    expect(twos.length).toBeGreaterThanOrEqual(1);
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(1);
  });

  it('renders home score "0" and away score "0" by default', () => {
    // mockMovementState has score {home:0, away:0}
    render(<GameBoard />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('renders large scores correctly — home 3 away 2', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, score: { home: 3, away: 2 } },
    });
    render(<GameBoard />);
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// LAYOUT-02: phase-aware action section and log toggle
// ---------------------------------------------------------------------------
describe('GameBoard — LAYOUT-02: phase-aware action section and log toggle', () => {
  it('renders KickOffSetupPanel content during KICK_OFF_SETUP phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'KICK_OFF_SETUP' },
    });
    render(<GameBoard />);
    // KickOffSetupPanel renders "Kick-Off Setup" heading when phase === 'KICK_OFF_SETUP'
    expect(screen.getByText(/Kick-Off Setup/i)).toBeDefined();
  });

  it('renders ReplayPanel content during REPLAY phase', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'REPLAY',
        replayIndex: 0,
        replayTotal: 5,
      },
    });
    render(<GameBoard />);
    // ReplayPanel renders "Replay" heading when phase === 'REPLAY'
    expect(screen.getByText(/^Replay$/i)).toBeDefined();
  });

  it('renders ActionPanel (Confirm button) during MOVEMENT phase', () => {
    // mockMovementState is already MOVEMENT phase with playerSlot=1 (home team = active)
    render(<GameBoard />);
    // ActionPanel renders "Confirm" button in MOVEMENT phase for the active player
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });

  it('renders the log toggle chevron › button in the collapsed default state', () => {
    render(<GameBoard />);
    // UI-SPEC: LogToggle collapsed state shows › chevron button (UI-SPEC §LogToggle)
    // The button must exist by default since log starts collapsed
    const chevron = screen.getByText('›');
    expect(chevron).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// TEAM-06: Scoreboard badge images (TeamBadge replaces TeamShieldIcon)
// ---------------------------------------------------------------------------
describe('GameBoard — TEAM-06: scoreboard badge images', () => {
  it('renders at least two <img> elements with alt text containing "badge"', () => {
    render(<GameBoard />);
    // TeamBadge renders <img alt="{teamId} badge"> for home and away
    const imgs = screen.getAllByRole('img');
    const badgeImgs = imgs.filter((el) => /badge/i.test(el.getAttribute('alt') ?? ''));
    expect(badgeImgs.length).toBeGreaterThanOrEqual(2);
  });

  it('home scoreboard badge img alt contains "city" (selectedTeams home → city)', () => {
    render(<GameBoard />);
    // mockMovementState.selectedTeams: home -> city; TeamBadge alt = "{teamId} badge"
    const cityBadge = screen.getByAltText('city badge');
    expect(cityBadge).toBeDefined();
  });

  it('away scoreboard badge img alt contains "crew" (selectedTeams away → crew)', () => {
    render(<GameBoard />);
    // mockMovementState.selectedTeams: away -> crew; TeamBadge alt = "{teamId} badge"
    const crewBadge = screen.getByAltText('crew badge');
    expect(crewBadge).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DESIGN-01: scoreboard phase-label naming convention (D-11 corrected targets)
// ---------------------------------------------------------------------------
describe('GameBoard — DESIGN-01: phase label naming convention', () => {
  it('renders "CHOOSING ACTION" for PASS phase (D-11: gerund kept intentionally)', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'PASS' } });
    render(<GameBoard />);
    expect(screen.getByText(/CHOOSING ACTION/)).toBeDefined();
  });

  it('renders "GOALIE DIVE" for GK_DIVE phase, not "GK DIVING" or "GK DIVE"', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'GK_DIVE' } });
    render(<GameBoard />);
    expect(screen.getByText(/GOALIE DIVE/)).toBeDefined();
    expect(screen.queryByText(/GK DIVING/)).toBeNull();
    expect(screen.queryByText(/GK DIVE/)).toBeNull();
  });

  it('renders "MOVE 5" when phase is MOVE and movementSlot is DEFENDER_5', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'MOVE', movementSlot: 'DEFENDER_5' },
    });
    render(<GameBoard />);
    expect(screen.getByText(/MOVE 5/)).toBeDefined();
  });

  it('renders "MOVE 4" when phase is MOVE and movementSlot is ATTACKER_4', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'MOVE', movementSlot: 'ATTACKER_4' },
    });
    render(<GameBoard />);
    expect(screen.getByText(/MOVE 4/)).toBeDefined();
  });

  it('renders "SNAPSHOT - SELECT TARGET" for SNAPSHOT_TARGET phase', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'SNAPSHOT_TARGET' } });
    render(<GameBoard />);
    expect(screen.getByText(/SNAPSHOT - SELECT TARGET/)).toBeDefined();
  });

  it('renders "FIRST-TIME PASS — RESPONSE MOVE" for FIRST_TIME_PASS_MOVE phase', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'FIRST_TIME_PASS_MOVE' },
    });
    render(<GameBoard />);
    expect(screen.getByText(/FIRST-TIME PASS — RESPONSE MOVE/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// D-08 (soft): read-only active match-speed reminder in the scoreboard
// ---------------------------------------------------------------------------
describe('GameBoard — D-08: scoreboard active-speed reminder', () => {
  it('renders the active speed label (Fast) in the scoreboard for a known gameSpeed', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, gameSpeed: 'fast' } });
    render(<GameBoard />);
    expect(screen.getByText(/Fast/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// THEME-03 (D-06): runtime --team-accent/--home-accent/--away-accent CSS variables
// ---------------------------------------------------------------------------
describe('GameBoard — THEME-03/THEME-04: runtime accent CSS variables', () => {
  it('sets --team-accent to the active team AA-derived accent and --home-accent/--away-accent to the home/away AA-derived accents', () => {
    // mockMovementState: selectedTeams { home: 'city', away: 'crew' }, activeTeam: 'home'
    const { container } = render(<GameBoard />);
    const root = container.firstChild as HTMLElement;

    const homeUiColor = TEAM_CONFIGS[mockMovementState.selectedTeams.home].palette.uiColor;
    const awayUiColor = TEAM_CONFIGS[mockMovementState.selectedTeams.away].palette.uiColor;
    // THEME-04: --team-accent/--home-accent/--away-accent carry the AA-safe derived
    // value (deriveAaAccentColor), not the raw TEAM_CONFIGS uiColor — only colors that
    // fail AA are actually adjusted (D-03), but the assertion always goes through the
    // derivation function so it stays correct regardless of which teams the mock uses.
    // WR-04: reference colors sourced from useTeamColors.ts's exported constants
    // (not re-hardcoded) so this assertion always matches useTeamAccentColorAA.
    const homeAaColor = deriveAaAccentColor(homeUiColor, AA_REFERENCE_BG_HEX, AA_REFERENCE_FG_HEX);
    const awayAaColor = deriveAaAccentColor(awayUiColor, AA_REFERENCE_BG_HEX, AA_REFERENCE_FG_HEX);

    // The scoreboard stays two-color — proves home/away are not collapsed into one value.
    expect(homeAaColor).not.toBe(awayAaColor);

    expect(root.style.getPropertyValue('--team-accent')).toBe(homeAaColor);
    expect(root.style.getPropertyValue('--home-accent')).toBe(homeAaColor);
    expect(root.style.getPropertyValue('--away-accent')).toBe(awayAaColor);
  });

  it('updates --team-accent to the away team AA-derived accent when activeTeam is away (not a hardcoded literal)', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, activeTeam: 'away' } });
    const { container } = render(<GameBoard />);
    const root = container.firstChild as HTMLElement;

    const awayUiColor = TEAM_CONFIGS[mockMovementState.selectedTeams.away].palette.uiColor;
    const awayAaColor = deriveAaAccentColor(awayUiColor, AA_REFERENCE_BG_HEX, AA_REFERENCE_FG_HEX);
    expect(root.style.getPropertyValue('--team-accent')).toBe(awayAaColor);
    // home/away accents are stable regardless of which team is active
    const homeUiColor = TEAM_CONFIGS[mockMovementState.selectedTeams.home].palette.uiColor;
    expect(root.style.getPropertyValue('--home-accent')).toBe(
      deriveAaAccentColor(homeUiColor, AA_REFERENCE_BG_HEX, AA_REFERENCE_FG_HEX),
    );
  });
});

// ---------------------------------------------------------------------------
// Plan 38-07: each of the five Corner Kick phases (plus the PASS-with-cornerKickTeam High/Low
// choice) renders CornerKickSetupPanel — not ActionPanel — via the top-band dispatch ternary.
// ---------------------------------------------------------------------------
describe('GameBoard — Phase 38 (38-07): Corner Kick phase dispatch', () => {
  const CORNER_KICK_PHASES = [
    'CORNER_KICK_GK_SETUP_ATTACKING',
    'CORNER_KICK_GK_SETUP_DEFENDING',
    'CORNER_KICK_TAKER_SELECT',
    'CORNER_KICK_REPOSITION',
    'CORNER_KICK_FINAL_SETUP',
  ] as const;

  it.each(CORNER_KICK_PHASES)(
    'renders CornerKickSetupPanel (not ActionPanel) during %s',
    (phase) => {
      useGameStore.setState({
        gameState: { ...mockMovementState, phase, cornerKickTeam: 'home' },
      });
      render(<GameBoard />);
      expect(screen.getByText('Corner Kick')).toBeDefined();
    },
  );

  it("renders CornerKickSetupPanel's High/Low Pass choice (not ActionPanel's generic chooser) during PASS once cornerKickTeam is set", () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'PASS',
        cornerKickTeam: 'home',
        ball: { position: { q: 0, r: 1 }, carrierId: 'home-9', lastTouchedBy: null },
      },
      playerSlot: 1, // home === cornerKickTeam
    });
    render(<GameBoard />);
    expect(screen.getByText('Corner Kick')).toBeDefined();
    expect(screen.getByRole('button', { name: /^high pass$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^low pass$/i })).toBeDefined();
  });

  it('renders the ordinary ActionPanel during PASS when cornerKickTeam is null (unchanged, non-corner behavior)', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', cornerKickTeam: null },
    });
    render(<GameBoard />);
    expect(screen.queryByText('Corner Kick')).toBeNull();
  });

  it.each(CORNER_KICK_PHASES)('PHASE_LABEL has a distinct human-readable entry for %s', (phase) => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase, cornerKickTeam: 'home' },
    });
    const { container } = render(<GameBoard />);
    expect(container.textContent).toMatch(/CORNER KICK/);
  });
});

// ---------------------------------------------------------------------------
// D-16 (Phase 39-16): mutual-confirm Start 2nd Half button — replaces the D-28
// single-team kick-off-team-only gate. Both managers see an actionable button before their
// own confirm; each sees a waiting message once THEY have confirmed.
// ---------------------------------------------------------------------------
describe('GameBoard — D-16: mutual-confirm Start 2nd Half button', () => {
  function halfTimeState(overrides: Partial<typeof mockMovementState> = {}) {
    return {
      ...mockMovementState,
      phase: 'HALF_TIME' as const,
      kickOffTeam: 'home' as const,
      secondHalfConfirmed: null,
      ...overrides,
    };
  }

  it('shows an enabled Start 2nd Half button for the home-viewing manager when secondHalfConfirmed is null (D-16 regression: previously disabled for the non-kick-off team)', () => {
    useGameStore.setState({ gameState: halfTimeState(), playerSlot: 1 }); // home
    render(<GameBoard />);
    const button = screen.getByRole('button', { name: /^start 2nd half$/i });
    expect(button).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows an enabled Start 2nd Half button for the away-viewing manager when secondHalfConfirmed is null (D-16 regression: previously the ONLY side that saw an enabled button)', () => {
    useGameStore.setState({ gameState: halfTimeState(), playerSlot: 2 }); // away
    render(<GameBoard />);
    const button = screen.getByRole('button', { name: /^start 2nd half$/i });
    expect(button).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('clicking Start 2nd Half calls emitHalfTimeStart exactly once', () => {
    const emitHalfTimeStartSpy = vi.fn();
    useGameStore.setState({
      gameState: halfTimeState(),
      playerSlot: 1,
      emitHalfTimeStart: emitHalfTimeStartSpy,
    });
    render(<GameBoard />);
    screen.getByRole('button', { name: /^start 2nd half$/i }).click();
    expect(emitHalfTimeStartSpy).toHaveBeenCalledTimes(1);
  });

  it('replaces the button with "Waiting for Away to start the 2nd half…" when secondHalfConfirmed is {home:true, away:false} and myTeam is home', () => {
    useGameStore.setState({
      gameState: halfTimeState({ secondHalfConfirmed: { home: true, away: false } }),
      playerSlot: 1, // home
    });
    render(<GameBoard />);
    expect(screen.queryByRole('button', { name: /^start 2nd half$/i })).toBeNull();
    expect(screen.getByText(/Waiting for Away to start the 2nd half/)).toBeDefined();
  });

  it('shows an enabled Start 2nd Half button (not the waiting message) when secondHalfConfirmed is {home:true, away:false} and myTeam is away', () => {
    useGameStore.setState({
      gameState: halfTimeState({ secondHalfConfirmed: { home: true, away: false } }),
      playerSlot: 2, // away
    });
    render(<GameBoard />);
    const button = screen.getByRole('button', { name: /^start 2nd half$/i });
    expect(button).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/Waiting for/)).toBeNull();
  });

  it('never renders the removed "Only the 2nd half kick-off team can start" tooltip text, regardless of confirm state', () => {
    useGameStore.setState({ gameState: halfTimeState(), playerSlot: 1 });
    const { container: containerA } = render(<GameBoard />);
    expect(containerA.textContent).not.toMatch(/Only the 2nd half kick-off team can start/);
    cleanup();

    useGameStore.setState({
      gameState: halfTimeState({ secondHalfConfirmed: { home: true, away: false } }),
      playerSlot: 1,
    });
    const { container: containerB } = render(<GameBoard />);
    expect(containerB.textContent).not.toMatch(/Only the 2nd half kick-off team can start/);
  });
});

// ---------------------------------------------------------------------------
// Phase 39 (39-16 Task 1/3): the eight new foul/GK-interrupt/penalty-kick phases each
// dispatch to their own mocked panel stub, never the generic ActionPanel.
// ---------------------------------------------------------------------------
describe('GameBoard — Phase 39 (39-16): new phase dispatch', () => {
  const NEW_PHASE_DISPATCH = [
    { phase: 'FOUL_CHOICE', testId: 'mock-foul-choice-panel' },
    { phase: 'GK_DIVE_AT_FEET_PROMPT', testId: 'mock-gk-dive-at-feet-prompt-panel' },
    { phase: 'GK_BOX_ENTRY_PROMPT', testId: 'mock-gk-box-entry-prompt-panel' },
    { phase: 'GK_BOX_ENTRY_MOVE', testId: 'mock-gk-box-entry-prompt-panel' },
    { phase: 'PENALTY_KICK_SETUP_ATTACKING', testId: 'mock-penalty-kick-setup-panel' },
    { phase: 'PENALTY_KICK_SETUP_DEFENDING', testId: 'mock-penalty-kick-setup-panel' },
    { phase: 'PENALTY_KICK_TAKER_SELECT', testId: 'mock-penalty-kick-setup-panel' },
    { phase: 'PENALTY_KICK', testId: 'mock-penalty-kick-setup-panel' },
  ] as const;

  it.each(NEW_PHASE_DISPATCH)(
    'renders the mocked panel (not ActionPanel) during $phase',
    ({ phase, testId }) => {
      useGameStore.setState({
        gameState: { ...mockMovementState, phase },
      });
      render(<GameBoard />);
      expect(screen.getByTestId(testId)).toBeDefined();
      // ActionPanel's "Confirm" button (the generic-dispatch fallback assertion used
      // elsewhere in this file, e.g. the MOVEMENT-phase test above) must not appear —
      // proves the ternary routed to the mocked panel, not the generic ActionPanel.
      expect(screen.queryByRole('button', { name: /^confirm$/i })).toBeNull();
    },
  );
});

// ---------------------------------------------------------------------------
// Phase 40 (SUB-01/02, Task 2 — Wave 0 RED): persistent stoppage-gated SUB
// affordance + substitution modal. 'HALF_TIME' is sampled from STOPPAGE_PHASES
// (the shared allow-list); 'MOVE'/'PENALTY_KICK' are sampled non-stoppage phases.
// ---------------------------------------------------------------------------
describe('substitution affordance (SUB-01/02)', () => {
  const HOME_BENCH_ENTRY = { playerId: 'p900', jerseyNumber: 30, status: 'available' as const };
  const AWAY_BENCH_ENTRY = { playerId: 'p901', jerseyNumber: 31, status: 'available' as const };

  const STOPPAGE_SAMPLE: GamePhase = 'HALF_TIME';
  const NON_STOPPAGE_SAMPLES: readonly GamePhase[] = ['MOVE', 'PENALTY_KICK'];

  function seedRosterState(phase: GamePhase) {
    useGameStore.setState({
      playerSlot: 1, // home — myTeam scoping asserted below
      gameState: {
        ...mockMovementState,
        phase,
        // playerId seeded on every home piece so the modal has bench-substitution data to
        // render (Task 2 instruction: "Seed ... pieces with playerId values").
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, playerId: `pid-${p.id}` } : p,
        ),
        bench: { home: [HOME_BENCH_ENTRY], away: [AWAY_BENCH_ENTRY] },
        subsUsed: { home: 0, away: 0 },
      },
    });
  }

  it('confirms HALF_TIME is a sampled STOPPAGE_PHASES member (sanity check for the fixture below)', () => {
    expect(STOPPAGE_PHASES).toContain(STOPPAGE_SAMPLE);
  });

  it('renders in every phase, including non-stoppage phases (persistent, never conditionally mounted)', () => {
    for (const phase of [...NON_STOPPAGE_SAMPLES, STOPPAGE_SAMPLE]) {
      seedRosterState(phase);
      const { unmount } = render(<GameBoard />);
      const button =
        screen.queryByRole('button', { name: 'Open substitutions' }) ??
        screen.queryByRole('button', { name: 'Substitutions unavailable — not a stoppage' });
      expect(button).not.toBeNull();
      unmount();
    }
  });

  it('is enabled with aria-label "Open substitutions" during a stoppage phase', () => {
    seedRosterState(STOPPAGE_SAMPLE);
    render(<GameBoard />);
    // getByRole returns HTMLElement per this project's tsc config; cast required for .disabled.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const button = screen.getByRole('button', {
      name: 'Open substitutions',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it.each(NON_STOPPAGE_SAMPLES)(
    'is disabled outside a stoppage (%s), carries the disabled aria-label and tooltip',
    (phase) => {
      seedRosterState(phase);
      render(<GameBoard />);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- see above
      const button = screen.getByRole('button', {
        name: 'Substitutions unavailable — not a stoppage',
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('title')).toBe(
        'Substitutions are only available during a stoppage in play.',
      );
    },
  );

  it('clicking while enabled renders the substitution modal containing the roster screen', () => {
    seedRosterState(STOPPAGE_SAMPLE);
    render(<GameBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'Open substitutions' }));
    expect(screen.getByText('Substitution')).toBeDefined();
  });

  it('clicking while disabled renders nothing', () => {
    seedRosterState('MOVE');
    render(<GameBoard />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Substitutions unavailable — not a stoppage' }),
    );
    expect(screen.queryByText('Substitution')).toBeNull();
  });

  it('the close control (aria-label="Close substitutions") dismisses the modal with no emit', () => {
    seedRosterState(STOPPAGE_SAMPLE);
    render(<GameBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'Open substitutions' }));
    expect(screen.getByText('Substitution')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close substitutions' }));
    expect(screen.queryByText('Substitution')).toBeNull();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("renders the caller's own team only — the opposing teamId's pieces do not appear", () => {
    seedRosterState(STOPPAGE_SAMPLE);
    render(<GameBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'Open substitutions' }));
    const homePiece = mockMovementState.pieces.find((p) => p.teamId === 'home');
    const awayPiece = mockMovementState.pieces.find((p) => p.teamId === 'away');
    expect(homePiece).toBeDefined();
    expect(awayPiece).toBeDefined();
    expect(
      screen.getAllByText(`${homePiece!.firstName} ${homePiece!.lastName}`).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(`${awayPiece!.firstName} ${awayPiece!.lastName}`)).toBeNull();
  });

  it('is not rendered on a phase transition by itself, and closes automatically when the phase leaves the stoppage set while open', () => {
    seedRosterState(STOPPAGE_SAMPLE);
    const { rerender } = render(<GameBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'Open substitutions' }));
    expect(screen.getByText('Substitution')).toBeDefined();

    // Server-driven phase change (not a user click) leaves the stoppage set — the modal must
    // self-close via the useEffect force-close, not merely become unopenable.
    useGameStore.setState({
      gameState: { ...useGameStore.getState().gameState, phase: 'MOVE' },
    });
    rerender(<GameBoard />);
    expect(screen.queryByText('Substitution')).toBeNull();
  });
});
