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
});
