import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { useGameStore } from './useGameStore.js';
import { mockMovementState } from '../mock/index.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: mockMovementState,
    screen: 'CREATE_ROOM',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: null,
    roomCode: null,
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

describe('useGameStore — setScreen', () => {
  it('updates the screen field', () => {
    useGameStore.getState().setScreen('GAME_BOARD');
    expect(useGameStore.getState().screen).toBe('GAME_BOARD');
  });
});

describe('useGameStore — selectPiece', () => {
  it('sets selectedPieceId and populates validMoveHexes when a valid piece is selected', () => {
    useGameStore.getState().selectPiece('home-8');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('home-8');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('clears selectedPieceId and validMoveHexes when selecting the same piece twice (toggle)', () => {
    useGameStore.getState().selectPiece('home-8');
    useGameStore.getState().selectPiece('home-8');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toHaveLength(0);
  });

  it('does nothing if no piece with the given id exists', () => {
    useGameStore.getState().selectPiece('nonexistent-id');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toHaveLength(0);
  });
});

describe('useGameStore — selectPiece FIRST_TIME_PASS_MOVE (CR-01, 17.1-16 self-pass-reclaim fix)', () => {
  beforeEach(() => {
    // Seed FTP ATTACKER slot, home team active, playerSlot=1 (home).
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'FIRST_TIME_PASS_MOVE',
        activeTeam: 'home',
        attackingTeam: 'home',
        firstTimePassMovementSlot: 'ATTACKER',
        firstTimePassMovedPieceId: null,
        firstTimePassPaceUsed: 0,
        firstTimePassCarrierId: 'home-9', // the passer
      },
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
    });
  });

  it('rejects selection of the original passer (firstTimePassCarrierId) — would have been selectable pre-fix', () => {
    // Behaviour-assertion: pre-fix, this branch gated only on team/lock/pace, so the passer
    // (own team, slot unlocked, pace remaining) would have passed every gate and been
    // selected with non-empty validMoveHexes. This assertion would FAIL pre-fix.
    useGameStore.getState().selectPiece('home-9');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toHaveLength(0);
  });

  it('accepts selection of a non-passer own-team piece (existing happy path preserved)', () => {
    useGameStore.getState().selectPiece('home-5');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('home-5');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });
});

describe('useGameStore — selectPiece HIGH_PASS_MOVE (BUG-11, Phase 18.2 carrier-exclusion fix)', () => {
  beforeEach(() => {
    // Seed HIGH_PASS_MOVE ATTACKER slot, home team active, playerSlot=1 (home).
    useGameStore.setState({
      gameState: {
        ...mockMovementState,
        phase: 'HIGH_PASS_MOVE',
        activeTeam: 'home',
        attackingTeam: 'home',
        highPassMovementSlot: 'ATTACKER',
        highPassMovedPieceId: null,
        highPassPaceUsed: 0,
        highPassCarrierId: 'home-9', // the kicker
      },
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
    });
  });

  it('rejects selection of the original high-pass kicker (highPassCarrierId) — mirrors the FTP fix', () => {
    // Behaviour-assertion: pre-fix, this branch gated only on team/lock/pace, so the kicker
    // (own team, slot unlocked, pace remaining) would have passed every gate and been
    // selected with non-empty validMoveHexes. This assertion would FAIL pre-fix.
    useGameStore.getState().selectPiece('home-9');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toHaveLength(0);
  });

  it('accepts selection of a non-carrier own-team piece (existing happy path preserved)', () => {
    useGameStore.getState().selectPiece('home-5');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('home-5');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });
});

// Bug fix (second checkpoint round, this plan): FREE_MOVE_ATTACK/DEFENSE had zero client wiring —
// selectPiece had no branch for these phases, so even a clickable piece (once HexGrid.tsx is
// fixed) would fall through with no destination hexes computed.
describe('useGameStore — selectPiece FREE_MOVE_ATTACK/DEFENSE (second checkpoint round fix)', () => {
  const FM_ELIGIBLE_ID = 'home-8';
  const FM_INELIGIBLE_ID = 'home-10';

  function freeMoveAttackState(overrides: {
    eligibleIds?: string[];
    freeMoveUsedPace?: Record<string, number>;
  }) {
    return {
      ...mockMovementState,
      phase: 'FREE_MOVE_ATTACK' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      freeMoveEligibleIds: {
        attack: overrides.eligibleIds ?? [FM_ELIGIBLE_ID],
        defense: [] as readonly string[],
      },
      freeMoveUsedPace: overrides.freeMoveUsedPace ?? {},
    };
  }

  function freeMoveDefenseState(overrides: {
    eligibleIds?: string[];
    freeMoveUsedPace?: Record<string, number>;
  }) {
    return {
      ...mockMovementState,
      phase: 'FREE_MOVE_DEFENSE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'away' as const,
      freeMoveEligibleIds: {
        attack: [] as readonly string[],
        defense: overrides.eligibleIds ?? [FM_ELIGIBLE_ID],
      },
      freeMoveUsedPace: overrides.freeMoveUsedPace ?? {},
    };
  }

  beforeEach(() => {
    useGameStore.setState({
      playerSlot: 1, // home
      selectedPieceId: null,
      validMoveHexes: [],
    });
  });

  it('FREE_MOVE_ATTACK: selecting an eligible own-team piece populates adjacent valid-move hexes', () => {
    useGameStore.setState({ gameState: freeMoveAttackState({}) });
    useGameStore.getState().selectPiece(FM_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(FM_ELIGIBLE_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('FREE_MOVE_DEFENSE: selecting an eligible own-team piece populates adjacent valid-move hexes', () => {
    useGameStore.setState({ gameState: freeMoveDefenseState({}) });
    useGameStore.getState().selectPiece(FM_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(FM_ELIGIBLE_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('FREE_MOVE_ATTACK: rejects a piece NOT in freeMoveEligibleIds.attack (clears selection)', () => {
    useGameStore.setState({ gameState: freeMoveAttackState({}) });
    useGameStore.getState().selectPiece(FM_INELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('FREE_MOVE_ATTACK: rejects an opponent-team piece even if (incorrectly) listed as eligible', () => {
    useGameStore.setState({ gameState: freeMoveAttackState({ eligibleIds: ['away-9'] }) });
    useGameStore.getState().selectPiece('away-9');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('FREE_MOVE_ATTACK: selects a pace-exhausted piece (freeMoveUsedPace === 6) but yields empty validMoveHexes', () => {
    useGameStore.setState({
      gameState: freeMoveAttackState({ freeMoveUsedPace: { [FM_ELIGIBLE_ID]: 6 } }),
    });
    useGameStore.getState().selectPiece(FM_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(FM_ELIGIBLE_ID);
    expect(state.validMoveHexes).toEqual([]);
  });

  it('FREE_MOVE_ATTACK: a piece with partial pace used (< 6) still yields adjacent valid-move hexes', () => {
    useGameStore.setState({
      gameState: freeMoveAttackState({ freeMoveUsedPace: { [FM_ELIGIBLE_ID]: 3 } }),
    });
    useGameStore.getState().selectPiece(FM_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(FM_ELIGIBLE_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  // UX-parity fix: activated/abandoned-piece tracking for FREE_MOVE (reuses movedPieceIds,
  // defense-in-depth check mirroring other phase branches in this file).
  it('FREE_MOVE_ATTACK: rejects a piece already in movedPieceIds even with pace remaining under 6 (abandoned)', () => {
    useGameStore.setState({
      gameState: {
        ...freeMoveAttackState({ freeMoveUsedPace: { [FM_ELIGIBLE_ID]: 2 } }),
        movedPieceIds: [FM_ELIGIBLE_ID],
      },
    });
    useGameStore.getState().selectPiece(FM_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('FREE_MOVE_DEFENSE: rejects a piece already in movedPieceIds even with pace remaining under 6 (abandoned)', () => {
    useGameStore.setState({
      gameState: {
        ...freeMoveDefenseState({ freeMoveUsedPace: { [FM_ELIGIBLE_ID]: 4 } }),
        movedPieceIds: [FM_ELIGIBLE_ID],
      },
    });
    useGameStore.getState().selectPiece(FM_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });
});

// Bug fix (second checkpoint round, this plan): setGameState's sticky-selection logic had no
// branch for FREE_MOVE_ATTACK/DEFENSE, so a selected piece would lose its highlight after exactly
// one accepted move despite having up to 5 more hexes of budget remaining.
describe('useGameStore — setGameState sticky-selection for FREE_MOVE_ATTACK/DEFENSE (second checkpoint round fix)', () => {
  const FM_ELIGIBLE_ID = 'home-8';

  function freeMoveAttackState(freeMoveUsedPace: Record<string, number> = {}) {
    return {
      ...mockMovementState,
      phase: 'FREE_MOVE_ATTACK' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      freeMoveEligibleIds: { attack: [FM_ELIGIBLE_ID], defense: [] as readonly string[] },
      freeMoveUsedPace,
    };
  }

  beforeEach(() => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: freeMoveAttackState(),
      selectedPieceId: FM_ELIGIBLE_ID,
      validMoveHexes: [],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
  });

  it('keeps a FREE_MOVE_ATTACK piece selected and recomputes validMoveHexes across a same-phase broadcast', () => {
    // Same phase, pace advanced by 1 (one accepted move already applied server-side) — simulates
    // the broadcast that arrives right after emitMove for this piece.
    const broadcast = freeMoveAttackState({ [FM_ELIGIBLE_ID]: 1 });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(FM_ELIGIBLE_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('keeps the piece selected but yields empty validMoveHexes once the 6-hex cap is reached', () => {
    const broadcast = freeMoveAttackState({ [FM_ELIGIBLE_ID]: 6 });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(FM_ELIGIBLE_ID);
    expect(state.validMoveHexes).toEqual([]);
  });

  it('clears selection when the phase changes from FREE_MOVE_ATTACK to FREE_MOVE_DEFENSE (D-35 no carry-over)', () => {
    const broadcast = {
      ...freeMoveAttackState({ [FM_ELIGIBLE_ID]: 2 }),
      phase: 'FREE_MOVE_DEFENSE' as const,
      attackingTeam: 'away' as const,
      freeMoveEligibleIds: { attack: [] as readonly string[], defense: [FM_ELIGIBLE_ID] },
    };
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });
});

// BUG-09 (Phase 18.2-03): setGameState's clear-condition gate previously only inspected the
// plain MOVE-phase movementSlot field, so it never fired for response-move sub-phases
// (HIGH_PASS_MOVE / FIRST_TIME_PASS_MOVE / GK_KICK_MOVE / SNAPSHOT_DEFLECT). When a response-move
// slot hands off (ATTACKER->DEFENDER) or a piece's phase-imposed pace is exhausted, the
// previously-selected piece survived into the sticky-selection block, producing a stale,
// clickable validMoveHexes highlight for a piece that may now belong to the opponent's turn.
// Supersedes/resolves .planning/todos/pending/2026-06-20-fix-stale-client-selection-on-ftp-hp-slot-handoff.md.
describe('useGameStore — setGameState response-move slot hand-off / pace-exhaustion clearing (BUG-09)', () => {
  const HP_LOCKED_ID = 'home-8';
  const FTP_LOCKED_ID = 'home-8';
  const GK_LOCKED_ID = 'home-8';
  const SNAP_LOCKED_ID = 'home-8';

  function highPassMoveState(overrides: {
    slot?: 'ATTACKER' | 'DEFENDER';
    highPassPaceUsed?: number;
  }) {
    return {
      ...mockMovementState,
      phase: 'HIGH_PASS_MOVE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      highPassMovementSlot: overrides.slot ?? ('ATTACKER' as const),
      highPassMovedPieceId: null,
      highPassPaceUsed: overrides.highPassPaceUsed ?? 0,
      highPassCarrierId: 'home-9',
    };
  }

  function firstTimePassMoveState(overrides: {
    slot?: 'ATTACKER' | 'DEFENDER';
    firstTimePassPaceUsed?: number;
  }) {
    return {
      ...mockMovementState,
      phase: 'FIRST_TIME_PASS_MOVE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      firstTimePassMovementSlot: overrides.slot ?? ('ATTACKER' as const),
      firstTimePassMovedPieceId: null,
      firstTimePassPaceUsed: overrides.firstTimePassPaceUsed ?? 0,
      firstTimePassCarrierId: 'home-9',
    };
  }

  function gkKickMoveState(overrides: { slot?: 'KICKER' | 'OPP'; gkKickPaceUsed?: number }) {
    return {
      ...mockMovementState,
      phase: 'GK_KICK_MOVE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      gkKickMovementSlot: overrides.slot ?? ('KICKER' as const),
      gkKickMovedPieceId: null,
      gkKickPaceUsed: overrides.gkKickPaceUsed ?? 0,
    };
  }

  function snapshotDeflectState(overrides: { snapDeflectPaceUsed?: number }) {
    return {
      ...mockMovementState,
      phase: 'SNAPSHOT_DEFLECT' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'away' as const,
      snapDeflectMovedPieceId: null,
      snapDeflectPaceUsed: overrides.snapDeflectPaceUsed ?? 0,
    };
  }

  it('Test 1: HIGH_PASS_MOVE slot hand-off (ATTACKER->DEFENDER) clears a locked selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: highPassMoveState({ slot: 'ATTACKER' }),
      selectedPieceId: HP_LOCKED_ID,
      validMoveHexes: [{ q: 5, r: 5 }],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    const broadcast = highPassMoveState({ slot: 'DEFENDER' });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('Test 2: FIRST_TIME_PASS_MOVE slot hand-off (ATTACKER->DEFENDER) clears a locked selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: firstTimePassMoveState({ slot: 'ATTACKER' }),
      selectedPieceId: FTP_LOCKED_ID,
      validMoveHexes: [{ q: 5, r: 5 }],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    const broadcast = firstTimePassMoveState({ slot: 'DEFENDER' });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('Test 3: GK_KICK_MOVE slot hand-off (KICKER->OPP) clears a locked selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: gkKickMoveState({ slot: 'KICKER' }),
      selectedPieceId: GK_LOCKED_ID,
      validMoveHexes: [{ q: 5, r: 5 }],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    const broadcast = gkKickMoveState({ slot: 'OPP' });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('Test 4: HIGH_PASS_MOVE pace exhaustion (highPassPaceUsed reaches cap 3) clears a locked selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: highPassMoveState({ slot: 'ATTACKER', highPassPaceUsed: 1 }),
      selectedPieceId: HP_LOCKED_ID,
      validMoveHexes: [{ q: 5, r: 5 }],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    const broadcast = highPassMoveState({ slot: 'ATTACKER', highPassPaceUsed: 3 });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('Test 5 (regression guard): same-slot HIGH_PASS_MOVE broadcast with pace NOT exhausted retains selection and recomputes validMoveHexes', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: highPassMoveState({ slot: 'ATTACKER', highPassPaceUsed: 0 }),
      selectedPieceId: HP_LOCKED_ID,
      validMoveHexes: [],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    // Same slot, pace advanced by 1 but not yet exhausted (cap 3) — simulates the broadcast
    // arriving right after emitMove for this piece (sticky behaviour must be preserved).
    const broadcast = highPassMoveState({ slot: 'ATTACKER', highPassPaceUsed: 1 });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(HP_LOCKED_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('Test 6: SNAPSHOT_DEFLECT pace exhaustion (snapDeflectPaceUsed reaches cap 2) clears a locked selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: snapshotDeflectState({ snapDeflectPaceUsed: 1 }),
      selectedPieceId: SNAP_LOCKED_ID,
      validMoveHexes: [{ q: 5, r: 5 }],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    const broadcast = snapshotDeflectState({ snapDeflectPaceUsed: 2 });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('Test 7 (regression guard): same-phase SNAPSHOT_DEFLECT broadcast with pace NOT exhausted (snapDeflectPaceUsed 1 of 2) retains selection and recomputes a non-empty validMoveHexes', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: snapshotDeflectState({ snapDeflectPaceUsed: 0 }),
      selectedPieceId: SNAP_LOCKED_ID,
      validMoveHexes: [],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    // Same phase, pace advanced by 1 but not yet exhausted (cap 2) — simulates the broadcast
    // arriving right after emitMove for this piece (sticky behaviour must be preserved).
    const broadcast = snapshotDeflectState({ snapDeflectPaceUsed: 1 });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(SNAP_LOCKED_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });
});

describe('useGameStore — Phase 7 setters', () => {
  it('setGameState replaces gameState wholesale', () => {
    const newState = { ...mockMovementState, phase: 'SHOT' as const };
    useGameStore.getState().setGameState(newState);
    expect(useGameStore.getState().gameState.phase).toBe('SHOT');
  });

  it('setPlayerSlot sets playerSlot', () => {
    useGameStore.getState().setPlayerSlot(2);
    expect(useGameStore.getState().playerSlot).toBe(2);
  });

  it('setRoomCode sets roomCode', () => {
    useGameStore.getState().setRoomCode('AB12');
    expect(useGameStore.getState().roomCode).toBe('AB12');
  });

  it('setDisconnectWarning sets disconnectWarning to true', () => {
    useGameStore.getState().setDisconnectWarning(true);
    expect(useGameStore.getState().disconnectWarning).toBe(true);
  });

  it('setRoomError sets roomError', () => {
    useGameStore.getState().setRoomError('NOT_FOUND');
    expect(useGameStore.getState().roomError).toBe('NOT_FOUND');
  });

  it('setRoomError clears roomError when null', () => {
    useGameStore.getState().setRoomError('NOT_FOUND');
    useGameStore.getState().setRoomError(null);
    expect(useGameStore.getState().roomError).toBeNull();
  });
});

describe('useGameStore — emit actions', () => {
  it('emitMove calls socket.emit with game:move, pieceId, hex and clears selection', () => {
    const targetHex = { q: 10, r: 5 };
    useGameStore.setState({ selectedPieceId: 'home-8', validMoveHexes: [targetHex] });
    useGameStore.getState().emitMove('home-8', targetHex);
    expect(emitMock).toHaveBeenCalledWith('game:move', 'home-8', targetHex);
    expect(useGameStore.getState().selectedPieceId).toBeNull();
    expect(useGameStore.getState().validMoveHexes).toHaveLength(0);
  });

  it('emitRoll calls socket.emit with game:roll', () => {
    useGameStore.getState().emitRoll();
    expect(emitMock).toHaveBeenCalledWith('game:roll', undefined, undefined);
  });

  it('emitEndTurn calls socket.emit with game:end-turn', () => {
    useGameStore.getState().emitEndTurn();
    expect(emitMock).toHaveBeenCalledWith('game:end-turn');
  });

  it('emitUndo calls socket.emit with game:undo', () => {
    useGameStore.getState().emitUndo();
    expect(emitMock).toHaveBeenCalledWith('game:undo');
  });

  it('emitGKRestart calls socket.emit with game:gk-restart and choice', () => {
    useGameStore.getState().emitGKRestart('kick');
    expect(emitMock).toHaveBeenCalledWith('game:gk-restart', 'kick');
  });

  it('emitStartMovement calls socket.emit with game:start-movement', () => {
    useGameStore.getState().emitStartMovement();
    expect(emitMock).toHaveBeenCalledWith('game:start-movement');
  });

  it('emitFreeKickMove calls socket.emit with game:free-kick-move, pieceId, hex and clears selection', () => {
    const targetHex = { q: 2, r: 2 };
    useGameStore.setState({ selectedPieceId: 'home-8', validMoveHexes: [targetHex] });
    useGameStore.getState().emitFreeKickMove('home-8', targetHex);
    expect(emitMock).toHaveBeenCalledWith('game:free-kick-move', 'home-8', targetHex);
    expect(useGameStore.getState().selectedPieceId).toBeNull();
    expect(useGameStore.getState().validMoveHexes).toHaveLength(0);
  });

  it('emitFreeKickReady calls socket.emit with game:free-kick-ready', () => {
    useGameStore.getState().emitFreeKickReady();
    expect(emitMock).toHaveBeenCalledWith('game:free-kick-ready');
  });
});

// OFFSIDE-02 (Phase 17 D-49 staged rework): only the piece belonging to the CURRENTLY-active
// stage's team may be selected. Valid destinations are unrestricted during the kicking team's
// stages (D-29) or all-pitch-minus-2-hex-zone during the conceding team's stages (D-30) — same
// geometry as the prior simultaneous model, now turn-gated by freeKickStageIndex.
describe('useGameStore — selectPiece FREE_KICK_SETUP (D-49 staged/turn-gated)', () => {
  // freeKickAttackingTeam is 'away' (kicking). home is the conceding/defending team.
  function freeKickSetupState(stageIndex: 0 | 1 | 2 | 3 = 0) {
    return {
      ...mockMovementState,
      phase: 'FREE_KICK_SETUP' as const,
      freeKickHex: { q: 25, r: 13 },
      freeKickAttackingTeam: 'away' as const,
      freeKickStageIndex: stageIndex,
      freeKickPlacedPieceIds: [],
    };
  }

  beforeEach(() => {
    useGameStore.setState({
      playerSlot: 1, // home
      selectedPieceId: null,
      validMoveHexes: [],
    });
  });

  it('stage 0 (kicking = away): rejects selecting a home (inactive-stage) piece', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0) });
    useGameStore.getState().selectPiece('home-8');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('stage 0 (kicking = away): away (slot 2) selecting an own piece populates validMoveHexes unrestricted', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0), playerSlot: 2 });
    useGameStore.getState().selectPiece('away-9');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('away-9');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('stage 1 (defending = home): home selecting an own piece populates validMoveHexes (restricted set, still non-empty)', () => {
    useGameStore.setState({ gameState: freeKickSetupState(1) });
    useGameStore.getState().selectPiece('home-8');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('home-8');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('stage 1 (defending = home): rejects selecting an away (inactive-stage, kicking) piece', () => {
    useGameStore.setState({ gameState: freeKickSetupState(1), playerSlot: 2 });
    useGameStore.getState().selectPiece('away-9');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('stage 1: excludes hexes already occupied by another own-team piece', () => {
    useGameStore.setState({ gameState: freeKickSetupState(1) });
    const otherHomePiece = mockMovementState.pieces.find(
      (p) => p.teamId === 'home' && p.id !== 'home-8',
    );
    if (!otherHomePiece) throw new Error('No other home piece in fixture');
    useGameStore.getState().selectPiece('home-8');
    const { validMoveHexes } = useGameStore.getState();
    const occupiedHexExcluded = !validMoveHexes.some(
      (h) => h.q === otherHomePiece.position.q && h.r === otherHomePiece.position.r,
    );
    expect(occupiedHexExcluded).toBe(true);
  });

  // D-30: defending team's stage (1 or 3) must exclude the 2-hex zone around freeKickHex.
  it('stage 1 (defending): excludes the 2-hex zone around freeKickHex', () => {
    useGameStore.setState({ gameState: freeKickSetupState(1) });
    useGameStore.getState().selectPiece('home-8');
    const { validMoveHexes } = useGameStore.getState();
    // freeKickHex {q:25, r:13} itself and immediate neighbours must be excluded.
    const withinZoneExcluded = !validMoveHexes.some((h) => h.q === 25 && h.r === 13);
    expect(withinZoneExcluded).toBe(true);
  });

  it('stage 1 (defending): retains hexes outside the 2-hex zone, including hexes behind freeKickHex (no D-46 restriction — REVERTED)', () => {
    useGameStore.setState({ gameState: freeKickSetupState(1) });
    useGameStore.getState().selectPiece('home-8');
    const { validMoveHexes } = useGameStore.getState();
    // {q: 20, r: 13} is "behind" freeKickHex (q<25) in home's attacking direction — D-46 would
    // have excluded this, but D-46 is fully reverted, so this hex IS legal (well outside the
    // 2-hex zone, hexDistance from {q:25,r:13} = 5).
    expect(validMoveHexes.some((h) => h.q === 20 && h.r === 13)).toBe(true);
  });

  it('stage 3 (defending = home, last defending turn): same 2-hex-zone restriction as stage 1', () => {
    useGameStore.setState({ gameState: freeKickSetupState(3) });
    useGameStore.getState().selectPiece('home-8');
    const { validMoveHexes } = useGameStore.getState();
    const withinZoneExcluded = !validMoveHexes.some((h) => h.q === 25 && h.r === 13);
    expect(withinZoneExcluded).toBe(true);
  });

  // D-29: kicking team's stages (0 and 2) have NO restriction beyond own-piece occupancy.
  it('stage 2 (kicking = away, last kicking turn): away piece valid hexes are unrestricted', () => {
    useGameStore.setState({ gameState: freeKickSetupState(2), playerSlot: 2 });
    useGameStore.getState().selectPiece('away-9');
    const { validMoveHexes, selectedPieceId } = useGameStore.getState();
    expect(selectedPieceId).toBe('away-9');
    // A hex within the 2-hex zone (which would be excluded for the defending team) is legal here.
    expect(validMoveHexes.some((h) => h.q === 25 && h.r === 14)).toBe(true);
  });
});
