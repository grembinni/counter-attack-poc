import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ActionPanel } from './ActionPanel.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: { ...mockMovementState, phase: 'MOVE', activeTeam: 'home', lastDiceRoll: null },
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1,
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
    selectedPassType: null,
    passTargetHex: null,
  });
});

describe('ActionPanel — UNDO-03: active player gating', () => {
  it('renders waiting panel for the non-active player', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(<ActionPanel />);
    expect(screen.getByText(/Opponent's Turn/)).toBeDefined();
    expect(screen.getByText('Attacking team is taking their turn…')).toBeDefined();
  });

  it('renders controls for the active player', () => {
    render(<ActionPanel />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeDefined();
  });
});

describe('ActionPanel — UNDO-02: undo disabled when dice rolled', () => {
  it('Undo button is enabled when lastDiceRoll is null', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        // paceUsedByPieceId must be non-empty so canUndo's Bug-C guard (25-07) passes
        paceUsedByPieceId: { 'home-9': 1 },
        eventLog: [
          {
            type: 'MOVE',
            pieceId: 'home-9',
            from: { q: 14, r: 13 },
            to: { q: 15, r: 13 },
            slot: 'ATTACKER_4',
            timestamp: 0,
            ballAfter: { position: { q: 15, r: 13 }, carrierId: 'home-9' },
          },
        ],
      },
    });
    render(<ActionPanel />);
    const undo = screen.getByRole('button', { name: /undo/i });
    expect((undo as HTMLButtonElement).disabled).toBe(false);
  });

  it('Undo button is disabled when lastDiceRoll is set', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        lastDiceRoll: { rolls: [4], context: 'SHOT_DUEL' },
      },
    });
    render(<ActionPanel />);
    const undo = screen.getByRole('button', { name: /undo/i });
    expect((undo as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ActionPanel — UNDO-03: opponent sees no undo button', () => {
  it('queryByRole returns null for undo when playerSlot is 2 and activeTeam is home', () => {
    useGameStore.setState({ playerSlot: 2 });
    render(<ActionPanel />);
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });
});

describe('ActionPanel — UNDO-01: clicking Undo emits game:undo', () => {
  it('calls emitUndo when Undo button clicked', () => {
    const emitUndo = vi.fn();
    useGameStore.setState({
      emitUndo,
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        // paceUsedByPieceId must be non-empty so canUndo's Bug-C guard (25-07) passes
        paceUsedByPieceId: { 'home-9': 1 },
        eventLog: [
          {
            type: 'MOVE',
            pieceId: 'home-9',
            from: { q: 14, r: 13 },
            to: { q: 15, r: 13 },
            slot: 'ATTACKER_4',
            timestamp: 0,
            ballAfter: { position: { q: 15, r: 13 }, carrierId: 'home-9' },
          },
        ],
      },
    });
    render(<ActionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(emitUndo).toHaveBeenCalledOnce();
  });
});

describe('ActionPanel — FIRST_TIME_PASS_MOVE panel', () => {
  const ftpBaseState = {
    ...mockMovementState,
    phase: 'FIRST_TIME_PASS_MOVE' as const,
    activeTeam: 'home' as const,
    lastDiceRoll: null,
  };

  it('active player sees helper text and both Undo and Confirm buttons', () => {
    useGameStore.setState({
      gameState: ftpBaseState,
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('First-Time Pass!')).toBeDefined();
    expect(screen.getByText('Move 1 player to receive the ball (max 1 hex).')).toBeDefined();
    expect(screen.getByRole('button', { name: /undo/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });

  it('Undo is disabled when no FTP_REPOSITION event in log', () => {
    useGameStore.setState({
      gameState: {
        ...ftpBaseState,
        eventLog: [],
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const undo = screen.getByRole('button', { name: /undo/i });
    expect((undo as HTMLButtonElement).disabled).toBe(true);
  });

  it('Undo is enabled when last event is FTP_REPOSITION followed by a real FTP_MOVE', () => {
    // CR-01 (17.1-11): use the real FTP_MOVE shape gameHandlers.ts emits during
    // FIRST_TIME_PASS_MOVE — a fabricated MOVE event here would mask the canUndo bug.
    useGameStore.setState({
      gameState: {
        ...ftpBaseState,
        eventLog: [
          {
            type: 'FTP_REPOSITION',
            slot: 'ATTACKER',
            pieceId: null,
            timestamp: 1,
          },
          {
            type: 'FTP_MOVE',
            slot: 'ATTACKER',
            pieceId: 'home-9',
            from: { q: 14, r: 13 },
            to: { q: 15, r: 13 },
            timestamp: 2,
          },
        ],
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const undo = screen.getByRole('button', { name: /undo/i });
    expect((undo as HTMLButtonElement).disabled).toBe(false);
  });

  it('non-active player sees the waiting panel', () => {
    useGameStore.setState({
      gameState: ftpBaseState,
      playerSlot: 2, // away player — home is active
    });
    render(<ActionPanel />);
    expect(screen.getByText(/Opponent's Turn/)).toBeDefined();
    expect(screen.getByText('Attacking team is repositioning…')).toBeDefined();
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });
});

describe('ActionPanel — FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE panels (Phase 17 MOVE-06, corrected design)', () => {
  const freeMoveAttackBaseState = {
    ...mockMovementState,
    phase: 'FREE_MOVE_ATTACK' as const,
    activeTeam: 'home' as const,
    lastDiceRoll: null,
    freeMoveEligibleIds: { attack: ['home-9'], defense: [] },
    freeMoveUsedPace: {},
  };

  const freeMoveDefenseBaseState = {
    ...freeMoveAttackBaseState,
    phase: 'FREE_MOVE_DEFENSE' as const,
    activeTeam: 'away' as const,
    freeMoveEligibleIds: { attack: [], defense: ['away-0'] },
  };

  it('active player sees the Free Move helper text (attacking team) and a Confirm button', () => {
    useGameStore.setState({
      gameState: freeMoveAttackBaseState,
      playerSlot: 1,
    });
    render(<ActionPanel />);
    // UX-10: line-1 explains the mechanic; line-2 shows eligible-player count
    expect(
      screen.getByText(/reposition up to 6 hexes regardless of remaining pace/i),
    ).toBeDefined();
    expect(screen.getByText(/players still eligible to move/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });

  it('active player sees the Free Move helper text (defending team) during FREE_MOVE_DEFENSE', () => {
    useGameStore.setState({
      gameState: freeMoveDefenseBaseState,
      playerSlot: 2, // away is active during FREE_MOVE_DEFENSE here
    });
    render(<ActionPanel />);
    // UX-10: same mechanic explanation for both FREE_MOVE_ATTACK and FREE_MOVE_DEFENSE
    expect(
      screen.getByText(/reposition up to 6 hexes regardless of remaining pace/i),
    ).toBeDefined();
    expect(screen.getByText(/players still eligible to move/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });

  it('clicking Confirm with remaining players opens confirm dialog, Yes end turn calls emitEndTurn during FREE_MOVE_ATTACK', () => {
    const emitEndTurn = vi.fn();
    useGameStore.setState({
      emitEndTurn,
      gameState: freeMoveAttackBaseState,
      playerSlot: 1,
    });
    render(<ActionPanel />);
    // UX-08: eligibleRemaining > 0 → click Confirm opens the confirm dialog, not emit directly
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    // Dialog appears with confirm prompt
    expect(screen.getByText(/are you sure you want to end your turn\?/i)).toBeDefined();
    expect(emitEndTurn).not.toHaveBeenCalled();
    // Dialog affirm button invokes the deferred action
    fireEvent.click(screen.getByRole('button', { name: /yes, end turn/i }));
    expect(emitEndTurn).toHaveBeenCalledOnce();
  });

  it('non-active player sees the waiting panel during FREE_MOVE_ATTACK', () => {
    useGameStore.setState({
      gameState: freeMoveAttackBaseState,
      playerSlot: 2, // away player — home is active
    });
    render(<ActionPanel />);
    expect(screen.getByText(/Opponent's Turn/)).toBeDefined();
    expect(screen.getByText('Attacking team is repositioning…')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).toBeNull();
  });

  it('non-active player sees the waiting panel during FREE_MOVE_DEFENSE', () => {
    useGameStore.setState({
      gameState: freeMoveDefenseBaseState,
      playerSlot: 1, // home player — away is active during FREE_MOVE_DEFENSE here
    });
    render(<ActionPanel />);
    expect(screen.getByText(/Opponent's Turn/)).toBeDefined();
    expect(screen.getByText('Defending team is repositioning…')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).toBeNull();
  });
});

describe('ActionPanel — PASS phase pass-type selection flow', () => {
  it('shows target-hex prompt and Back button in step 2 (pass type selected, no target)', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', activeTeam: 'home' },
      selectedPassType: 'STANDARD_PASS',
      passTargetHex: null,
    });
    render(<ActionPanel />);
    expect(screen.getByText(/standard pass/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /back/i })).toBeDefined();
  });

  it('returns null in step 3 (target selected) because confirmPassTarget auto-emits', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', activeTeam: 'home' },
      selectedPassType: 'STANDARD_PASS',
      passTargetHex: { q: 6, r: 3 },
    });
    const { container } = render(<ActionPanel />);
    expect(container.firstChild).toBeNull();
  });
});

// OFFSIDE-02 (Phase 17 D-32): the free-kick restart action set is entirely data-driven via
// ELIGIBLE_NEXT_ACTIONS['FREE_KICK_RESTART'] (Task 1) — no bespoke client gating. These tests
// confirm the existing eligibility-driven chooser (already exercised above for other
// lastActionType values) renders exactly the four legal free-kick actions for this row too.
describe('ActionPanel — FREE_KICK_RESTART action set (OFFSIDE-02 D-32)', () => {
  it('offers Standard Pass, High Pass, and Long Ball but NOT Move/One-Touch/Snapshot', () => {
    // Carrier far from goal (no Shoot eligibility) isolates this assertion to the
    // Move/FTP/Snapshot suppression — Shoot-in-range is covered by the next test.
    const carrier = mockMovementState.pieces.find((p) => p.id === 'home-9');
    if (!carrier) throw new Error('home-9 not found in mockMovementState fixture');
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'PASS',
        activeTeam: 'home',
        attackingTeam: 'home',
        lastActionType: 'FREE_KICK_RESTART',
        ball: { position: { q: 1, r: 1 }, carrierId: 'home-9' },
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      },
      selectedPassType: null,
      passTargetHex: null,
    });
    render(<ActionPanel />);
    expect(screen.getByRole('button', { name: /standard pass/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /high pass/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /long ball/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^move$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /one-touch/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /snapshot/i })).toBeNull();
  });

  it('offers Shoot when the kicker is within 11 hexes of goal', () => {
    const homeGoalHex = { q: 36, r: 13 };
    const nearGoalPos = { q: 25, r: 13 }; // hexDistance to {q:36,r:13} = 11 (in range)
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'PASS',
        activeTeam: 'home',
        attackingTeam: 'home',
        lastActionType: 'FREE_KICK_RESTART',
        ball: { position: nearGoalPos, carrierId: 'home-9' },
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9' ? { ...p, position: nearGoalPos } : p,
        ),
      },
      selectedPassType: null,
      passTargetHex: null,
    });
    render(<ActionPanel />);
    expect(screen.getByRole('button', { name: /shoot/i })).toBeDefined();
    void homeGoalHex; // documents the goal hex used for the in-range distance comment above
  });

  it('suppresses Shoot when the kicker is out of the 11-hex range', () => {
    const farPos = { q: 5, r: 13 }; // hexDistance to {q:36,r:13} = 31 (out of range)
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'PASS',
        activeTeam: 'home',
        attackingTeam: 'home',
        lastActionType: 'FREE_KICK_RESTART',
        ball: { position: farPos, carrierId: 'home-9' },
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9' ? { ...p, position: farPos } : p,
        ),
      },
      selectedPassType: null,
      passTargetHex: null,
    });
    render(<ActionPanel />);
    expect(screen.queryByRole('button', { name: /shoot/i })).toBeNull();
  });
});

// D-13 (Phase 18-03): ActionPanel.tsx text corrections — unified wait state,
// HIGH_PASS_MOVE fix, Kick->Punt rename, and MOVE phase hex-cap scoping.
describe('ActionPanel — D-13 text corrections', () => {
  it('non-active player in MOVE phase renders the unified wait state', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'MOVE', activeTeam: 'home' },
      playerSlot: 2, // away player — home is active
    });
    render(<ActionPanel />);
    expect(screen.getByText(/Opponent's Turn/)).toBeDefined();
    expect(screen.getByText('Attacking team is taking their turn…')).toBeDefined();
  });

  it('HIGH_PASS_MOVE active player renders the Aerial Challenge fix, not the old Header! heading', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'HIGH_PASS_MOVE', activeTeam: 'home' },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('High Pass Aerial Challenge!')).toBeDefined();
    expect(screen.queryByText(/^Header!$/)).toBeNull();
  });

  it('GK_RESTART renders a Punt (High Pass) button and not Kick (High Pass)', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_RESTART',
        activeTeam: 'home',
        attackingTeam: 'away',
        ball: { position: { q: 1, r: 13 }, carrierId: 'home-0' },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByRole('button', { name: /punt \(high pass\)/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /kick \(high pass\)/i })).toBeNull();
  });

  it('MOVE phase with movementSlot ATTACKER_2 renders Move! and the 2 hex max note', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_2',
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Move!')).toBeDefined();
    expect(screen.getByText(/2 hex max/)).toBeDefined();
  });

  it('MOVE phase with movementSlot ATTACKER_4 renders Move! and no hex-cap text', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Move!')).toBeDefined();
    expect(screen.queryByText(/hex max/)).toBeNull();
  });
});

// 260621-ajd: countdown helper text for MOVE/FREE_MOVE, and meaningful kick-off copy.
describe('ActionPanel — 260621-ajd: remaining-player countdown + kick-off helper copy', () => {
  it('MOVE phase, slot ATTACKER_4, no one moved yet — line2 reads "4 of 4 players left to move."', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('4 of 4 players left to move.')).toBeDefined();
  });

  it('MOVE phase, slot ATTACKER_4, one piece moved — line2 reads "3 of 4 players left to move."', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: ['home-9'],
        paceUsedByPieceId: { 'home-9': 99 },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('3 of 4 players left to move.')).toBeDefined();
  });

  it('MOVE phase, slot ATTACKER_2 — countdown text appended with the existing "(2 hex max)" note preserved', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_2',
        movedPieceIds: [],
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText(/2 of 2 players left to move\./)).toBeDefined();
    expect(screen.getByText(/2 hex max/)).toBeDefined();
  });

  it('FREE_MOVE_ATTACK: 3 eligible, 1 moved — helper reads 2 players still eligible to move', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'FREE_MOVE_ATTACK',
        activeTeam: 'home',
        lastDiceRoll: null,
        freeMoveEligibleIds: { attack: ['home-9', 'home-8', 'home-7'], defense: [] },
        freeMoveUsedPace: { 'home-9': 6 },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    // UX-10: line-2 shows "{N} players still eligible to move." (not old "X of Y" format)
    expect(screen.getByText(/2 players still eligible to move/)).toBeDefined();
  });

  it('KICK_OFF chooser shows a meaningful kick-off helper block, not just bare "Choose Action"', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'KICK_OFF',
        activeTeam: 'home',
        attackingTeam: 'home',
        lastActionType: null,
      },
      playerSlot: 1,
      selectedPassType: null,
      passTargetHex: null,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Kick-Off!')).toBeDefined();
    expect(screen.getByText(/centre/i)).toBeDefined();
    expect(screen.getByText('Choose Action')).toBeDefined();
    expect(screen.getByRole('button', { name: /standard pass/i })).toBeDefined();
  });
});

// BUG-25: MOVE Confirm button color must use ctaButtonClass(remaining) —
// pending (orange) while move options remain, ready (green) when slot is exhausted.
describe('ActionPanel — BUG-25: MOVE Confirm button color driven by ctaButtonClass', () => {
  it('Confirm button has pending class when remaining > 0 (not all players moved)', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        paceUsedByPieceId: {},
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    // ctaButtonClass(remaining=4) returns styles.ctaButtonPending
    expect(endTurnBtn.className).toContain('ctaButtonPending');
    expect(endTurnBtn.className).not.toContain('ctaButtonReady');
  });

  it('Confirm button has ready class when remaining <= 0 (all slot players moved)', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
        // All 4 pieces locked: movedPieceIds + paceUsedByPieceId satisfy remaining=0
        movedPieceIds: ['home-9', 'home-8', 'home-7', 'home-6'],
        paceUsedByPieceId: {
          'home-9': 99,
          'home-8': 99,
          'home-7': 99,
          'home-6': 99,
        },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    // ctaButtonClass(remaining=0) returns styles.ctaButtonReady
    expect(endTurnBtn.className).toContain('ctaButtonReady');
    expect(endTurnBtn.className).not.toContain('ctaButtonPending');
  });
});

// BUG-31 (D-03/D-04/D-05): remaining and the Confirm button color must update the moment a
// piece takes its first hex step (paceUsedByPieceId[id] > 0), not only once the piece is fully
// activated (pace exhausted + locked into movedPieceIds). Undo must revert this in the same
// render, since applyUndo already deletes the piece's paceUsedByPieceId entry server-side.
describe('ActionPanel — BUG-31: remaining/button update on first step, not full activation', () => {
  it('started-but-not-exhausted piece decrements remaining immediately (3 of 4, not 4 of 4)', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        // home-9 has pace >= 4 (PLAYER_POOL); paceUsed=1 is neither exhausted nor locked —
        // this is the "started" case the bug fails to count.
        paceUsedByPieceId: { 'home-9': 1 },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('3 of 4 players left to move.')).toBeDefined();
  });

  it('button flips to ready once enough pieces have started (not exhausted/locked) to fill the slot', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        // All 4 pieces "started" (single pace step each) but none exhausted or locked.
        paceUsedByPieceId: {
          'home-9': 1,
          'home-8': 1,
          'home-7': 1,
          'home-6': 1,
        },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonReady');
    expect(endTurnBtn.className).not.toContain('ctaButtonPending');
  });

  it('Undo reverts remaining and button color in the same render (paceUsedByPieceId cleared)', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        // Post-applyUndo broadcast: the reverted piece's paceUsedByPieceId entry is deleted.
        paceUsedByPieceId: {},
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('4 of 4 players left to move.')).toBeDefined();
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonPending');
    expect(endTurnBtn.className).not.toContain('ctaButtonReady');
  });
});

// D-02/D-06: every phase CTA that tracks its own eligible-remaining count must derive its
// Confirm button color from the shared ctaColorClass helper (via the ctaClass adapter),
// mirroring the BUG-25 MOVE-phase two-way assertion shape for the five remaining phases.
describe('ActionPanel — D-02: every phase CTA color-state driven by ctaColorClass', () => {
  it('HIGH_PASS_MOVE: Confirm is pending when highPassMovedPieceId is null', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'HIGH_PASS_MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        highPassMovedPieceId: null,
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonPending');
    expect(endTurnBtn.className).not.toContain('ctaButtonReady');
  });

  it('HIGH_PASS_MOVE: Confirm is ready when highPassMovedPieceId is set', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'HIGH_PASS_MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        highPassMovedPieceId: 'home-9',
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonReady');
    expect(endTurnBtn.className).not.toContain('ctaButtonPending');
  });

  it('FIRST_TIME_PASS_MOVE: Confirm is pending when firstTimePassMovedPieceId is null', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'FIRST_TIME_PASS_MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        firstTimePassMovedPieceId: null,
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonPending');
    expect(endTurnBtn.className).not.toContain('ctaButtonReady');
  });

  it('FIRST_TIME_PASS_MOVE: Confirm is ready when firstTimePassMovedPieceId is set', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'FIRST_TIME_PASS_MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        firstTimePassMovedPieceId: 'home-9',
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonReady');
    expect(endTurnBtn.className).not.toContain('ctaButtonPending');
  });

  it('SNAPSHOT_DEFLECT: Confirm is pending when snapDeflectMovedPieceId is null', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'SNAPSHOT_DEFLECT',
        activeTeam: 'home',
        attackingTeam: 'home',
        lastDiceRoll: null,
        snapDeflectMovedPieceId: null,
      },
      playerSlot: 2,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonPending');
    expect(endTurnBtn.className).not.toContain('ctaButtonReady');
  });

  it('SNAPSHOT_DEFLECT: Confirm is ready when snapDeflectMovedPieceId is set', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'SNAPSHOT_DEFLECT',
        activeTeam: 'home',
        attackingTeam: 'home',
        lastDiceRoll: null,
        snapDeflectMovedPieceId: 'away-0',
      },
      playerSlot: 2,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonReady');
    expect(endTurnBtn.className).not.toContain('ctaButtonPending');
  });

  it('GK_KICK_MOVE: Confirm is pending when gkKickMovedPieceId is null', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_KICK_MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        gkKickMovedPieceId: null,
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonPending');
    expect(endTurnBtn.className).not.toContain('ctaButtonReady');
  });

  it('GK_KICK_MOVE: Confirm is ready when gkKickMovedPieceId is set', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_KICK_MOVE',
        activeTeam: 'home',
        lastDiceRoll: null,
        gkKickMovedPieceId: 'home-9',
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonReady');
    expect(endTurnBtn.className).not.toContain('ctaButtonPending');
  });

  it('FREE_MOVE_ATTACK: Confirm is pending when eligible players remain (remaining > 0)', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'FREE_MOVE_ATTACK',
        activeTeam: 'home',
        lastDiceRoll: null,
        freeMoveEligibleIds: { attack: ['home-9'], defense: [] },
        freeMoveUsedPace: {},
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonPending');
    expect(endTurnBtn.className).not.toContain('ctaButtonReady');
  });

  it('FREE_MOVE_ATTACK: Confirm is ready when all eligible players have moved (remaining <= 0)', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'FREE_MOVE_ATTACK',
        activeTeam: 'home',
        lastDiceRoll: null,
        freeMoveEligibleIds: { attack: ['home-9'], defense: [] },
        freeMoveUsedPace: { 'home-9': 1 },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const endTurnBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(endTurnBtn.className).toContain('ctaButtonReady');
    expect(endTurnBtn.className).not.toContain('ctaButtonPending');
  });
});

// D-07: every ActionPanel render site is wrapped in PanelShell, which always emits an
// "Actions" heading as the first child — regardless of which phase-gated block is showing.
describe('ActionPanel — D-07: every phase state renders the panel heading', () => {
  it('waiting panel (non-active player) shows the Actions heading', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'MOVE', activeTeam: 'home' },
      playerSlot: 2, // away — home is active
    });
    render(<ActionPanel />);
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('MOVE phase shows the Actions heading', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'MOVE', activeTeam: 'home' },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('GK_RESTART phase shows the Actions heading', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_RESTART',
        activeTeam: 'home',
        attackingTeam: 'away',
        ball: { position: { q: 1, r: 13 }, carrierId: 'home-0' },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('HEADER contest phase shows the Actions heading', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'HEADER',
        activeTeam: 'home',
        headerAccuracyRollPending: false,
        headerConfirmed: { home: false, away: false },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('PASS chooser (step 1) shows the Actions heading', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', activeTeam: 'home' },
      selectedPassType: null,
      passTargetHex: null,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('PASS step-2 target prompt shows the Actions heading', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'PASS', activeTeam: 'home' },
      selectedPassType: 'STANDARD_PASS',
      passTargetHex: null,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('confirm dialog does not add a second Actions heading inside its card', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        paceUsedByPieceId: {},
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    // remaining > 0 in this state, so clicking Confirm opens the confirm dialog
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(screen.getByText(/are you sure you want to end your turn\?/i)).toBeDefined();
    // Only the one PanelShell heading exists — the confirm dialog does not get its own.
    expect(screen.getAllByText('Actions')).toHaveLength(1);
  });
});

// D-08: every confirm-and-advance CTA in ActionPanel reads the single canonical "Confirm"
// verb; the old "End Turn" wording is gone and the modal affirm reads "Yes, end turn" so the
// two buttons are never simultaneously ambiguous when the dialog is open.
describe('ActionPanel — D-08: single Confirm verb', () => {
  it('MOVE phase: no button is named "End Turn"; exactly one is named "Confirm"', () => {
    useGameStore.setState({
      gameState: { ...mockMovementState, phase: 'MOVE', activeTeam: 'home' },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.queryByRole('button', { name: /end turn/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });

  it('HEADER contest with a contestant selected: button reads exactly "Confirm", not "Confirm Selection"', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'HEADER',
        activeTeam: 'home',
        headerAccuracyRollPending: false,
        headerConfirmed: { home: false, away: false },
      },
      playerSlot: 1,
      headerContestantIds: ['home-9'],
    });
    render(<ActionPanel />);
    const btn = screen.getByRole('button', { name: /^confirm$/i });
    expect(btn.textContent).toBe('Confirm');
  });

  it('HEADER contest with no contestant selected: button still reads "Decline (no contestant)"', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'HEADER',
        activeTeam: 'home',
        headerAccuracyRollPending: false,
        headerConfirmed: { home: false, away: false },
      },
      playerSlot: 1,
      headerContestantIds: [],
    });
    render(<ActionPanel />);
    expect(screen.getByRole('button', { name: /decline \(no contestant\)/i })).toBeDefined();
  });

  it('confirm dialog open in MOVE phase: Cancel, Yes end turn, and Confirm all present; Yes end turn calls emitEndTurn', () => {
    const emitEndTurn = vi.fn();
    useGameStore.setState({
      emitEndTurn,
      gameState: {
        ...mockMovementState,
        phase: 'MOVE',
        activeTeam: 'home',
        movementSlot: 'ATTACKER_4',
        movedPieceIds: [],
        paceUsedByPieceId: {},
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /yes, end turn/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /yes, end turn/i }));
    expect(emitEndTurn).toHaveBeenCalledOnce();
  });
});

// D-03: ActionPanel's user-facing goalkeeper wording is standardized on "Keeper" —
// never "Goalie" or "Goalkeeper".
describe('ActionPanel — D-03: Keeper terminology', () => {
  it('GK_RESTART for the keeper\'s team shows "Keeper Restart!" and no "Goalie" text', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_RESTART',
        activeTeam: 'home',
        attackingTeam: 'away',
        ball: { position: { q: 1, r: 13 }, carrierId: 'home-0' },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Keeper Restart!')).toBeDefined();
    expect(screen.queryByText(/Goalie/i)).toBeNull();
  });

  it('the Punt (High Pass) button title uses "Keeper", not "Goalkeeper"', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_RESTART',
        activeTeam: 'home',
        attackingTeam: 'away',
        ball: { position: { q: 1, r: 13 }, carrierId: 'home-0' },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const puntBtn = screen.getByRole('button', { name: /punt \(high pass\)/i });
    expect(puntBtn.title).toMatch(/^Keeper clears/);
    expect(puntBtn.title).not.toMatch(/Goalkeeper/);
  });

  it('the Quick Throw button title uses "Keeper", not "Goalkeeper"', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_RESTART',
        activeTeam: 'home',
        attackingTeam: 'away',
        ball: { position: { q: 1, r: 13 }, carrierId: 'home-0' },
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    const throwBtn = screen.getByRole('button', { name: /quick throw/i });
    expect(throwBtn.title).toMatch(/^Keeper throws/);
    expect(throwBtn.title).not.toMatch(/Goalkeeper/);
  });
});

// D-09: every ActionPanel waiting state names who is acting and what they are doing — no
// state may fall back to the generic "Waiting for opponent" phrase.
describe('ActionPanel — D-09: phase-specific waiting text', () => {
  it('GK_DIVE: non-keeper player sees the keeper-diving detail, not the generic phrase', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_DIVE',
        activeTeam: 'home',
        attackingTeam: 'home',
      },
      playerSlot: 1, // home — keeper's team is 'away' here, so home is not the GK team
    });
    render(<ActionPanel />);
    expect(screen.getByText('Keeper is diving to attempt a save…')).toBeDefined();
    expect(screen.queryByText(/Waiting for opponent/)).toBeNull();
  });

  it('SNAPSHOT_DEFLECT: non-defending player sees the defender-repositioning detail', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'SNAPSHOT_DEFLECT',
        activeTeam: 'away',
        attackingTeam: 'home',
      },
      playerSlot: 1, // home — defending team is 'away' here, so home is not the defending team
    });
    render(<ActionPanel />);
    expect(screen.getByText('Defending team is moving to deflect the shot…')).toBeDefined();
    expect(screen.queryByText(/Waiting for opponent/)).toBeNull();
  });

  it('GK_RESTART: non-keeper player sees the keeper-restart-choice detail', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_RESTART',
        activeTeam: 'home',
        attackingTeam: 'away',
        ball: { position: { q: 1, r: 13 }, carrierId: 'home-0' },
      },
      playerSlot: 2, // away — carrier (keeper) is home-0, so away is not the GK team
    });
    render(<ActionPanel />);
    expect(screen.getByText('Keeper is choosing how to restart play…')).toBeDefined();
    expect(screen.queryByText(/Waiting for opponent/)).toBeNull();
  });

  it('GK_QUICK_THROW: non-keeper player sees the keeper-throw-target detail', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_QUICK_THROW',
        activeTeam: 'home',
        attackingTeam: 'away',
        ball: { position: { q: 1, r: 13 }, carrierId: 'home-0' },
      },
      playerSlot: 2, // away — carrier (keeper) is home-0, so away is not the GK team
    });
    render(<ActionPanel />);
    expect(screen.getByText('Keeper is choosing a throw target…')).toBeDefined();
    expect(screen.queryByText(/Waiting for opponent/)).toBeNull();
  });

  it('GK_KICK_TARGET: non-keeper player sees the keeper-punt-target detail', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'GK_KICK_TARGET',
        activeTeam: 'home',
        attackingTeam: 'away',
        ball: { position: { q: 1, r: 13 }, carrierId: 'home-0' },
      },
      playerSlot: 2, // away — carrier (keeper) is home-0, so away is not the GK team
    });
    render(<ActionPanel />);
    expect(screen.getByText('Keeper is choosing a punt target…')).toBeDefined();
    expect(screen.queryByText(/Waiting for opponent/)).toBeNull();
  });

  it('HEADER (accuracy roll pending): both players see the aerial-challenge-resolving detail', () => {
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'HEADER',
        activeTeam: 'home',
        attackingTeam: 'home',
        headerAccuracyRollPending: true,
      },
      playerSlot: 1,
    });
    render(<ActionPanel />);
    expect(screen.getByText('Resolving the aerial challenge…')).toBeDefined();
    expect(screen.queryByText(/Waiting for opponent/)).toBeNull();
  });
});
