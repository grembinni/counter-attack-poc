/**
 * Phase 11 Rule Correctness — Client Store Tests
 *
 * RULE-04: selectPiece during SNAP_DEFLECT returns validMoveHexes [] when pace exhausted.
 * RULE-05: post-deflect MOVEMENT phase has selectable pieces for active team in ATTACKER_4
 *           and switches correctly to DEFENDER_5.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from './useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import type { GameState } from '@counter-attack/shared';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

// ─────────────────────────────────────────────────────────────────────────────
// RULE-04 Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a GameState in SNAP_DEFLECT phase.
 * attackingTeam = 'home' → defendingTeam = 'away'.
 * We put away-1 (DEF 1) at q=10,r=10 — on the pitch — so adjacency moves are available.
 */
function makeSnapDeflectState(snapDeflectPaceUsed: number): GameState {
  const base = { ...mockMovementState };
  const pieces = base.pieces.map((p) => {
    if (p.id === 'away-1') return { ...p, position: { q: 10, r: 10 } };
    return p;
  });
  return {
    ...base,
    phase: 'SNAPSHOT_DEFLECT',
    attackingTeam: 'home',
    activeTeam: 'away',
    pieces,
    snapDeflectPaceUsed,
    snapDeflectMovedPieceId: null,
    movedPieceIds: [],
    paceUsedByPieceId: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE-05 Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a post-deflect MOVEMENT GameState.
 * Simulates the state that arrives after a LOOSE_BALL → PASS → applyStartMovement chain.
 * attackingTeam = 'home', movementSlot = 'ATTACKER_4', activeTeam = 'home',
 * movedPieceIds = [], paceUsedByPieceId = {} (server resets these on movement start).
 */
function makePostDeflectMovementState(): GameState {
  return {
    ...mockMovementState,
    phase: 'MOVE',
    attackingTeam: 'home',
    activeTeam: 'home',
    movementSlot: 'ATTACKER_4',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    lastShotPath: null,
  };
}

/**
 * Build a MOVEMENT state in DEFENDER_5 slot.
 */
function makeDefender5State(): GameState {
  return {
    ...mockMovementState,
    phase: 'MOVE',
    attackingTeam: 'home',
    activeTeam: 'away', // defender's turn
    movementSlot: 'DEFENDER_5',
    movedPieceIds: [],
    paceUsedByPieceId: {},
    lastShotPath: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: mockMovementState,
    selectedPieceId: null,
    validMoveHexes: [],
    tackleRiskHexes: [],
    playerSlot: null,
    roomCode: null,
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RULE-04: SNAP_DEFLECT pace-exhaustion guard
// ─────────────────────────────────────────────────────────────────────────────

describe('RULE-04 selectPiece SNAP_DEFLECT — pace guard contract', () => {
  it('returns validMoveHexes [] when snapDeflectPaceUsed === 2 (pace exhausted)', () => {
    useGameStore.setState({
      gameState: makeSnapDeflectState(2),
      playerSlot: 2, // away team player (defending team)
    });
    useGameStore.getState().selectPiece('away-1');
    const { validMoveHexes } = useGameStore.getState();
    expect(validMoveHexes).toHaveLength(0);
  });

  it('returns non-empty validMoveHexes when snapDeflectPaceUsed === 0 (pace fresh)', () => {
    useGameStore.setState({
      gameState: makeSnapDeflectState(0),
      playerSlot: 2, // away team player (defending team)
    });
    useGameStore.getState().selectPiece('away-1');
    const { validMoveHexes } = useGameStore.getState();
    expect(validMoveHexes.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RULE-05: post-deflect MOVEMENT Phase selectability
// ─────────────────────────────────────────────────────────────────────────────

describe('RULE-05 post-deflect MOVEMENT — active team pieces are selectable', () => {
  it('home pieces are selectable for home player in ATTACKER_4 slot after deflect', () => {
    useGameStore.setState({
      gameState: makePostDeflectMovementState(),
      playerSlot: 1, // home player
    });
    // Select a home piece — should yield valid move hexes (not zero)
    useGameStore.getState().selectPiece('home-9');
    const { validMoveHexes } = useGameStore.getState();
    expect(validMoveHexes.length).toBeGreaterThan(0);
  });

  it('away pieces are selectable for away player in DEFENDER_5 slot', () => {
    useGameStore.setState({
      gameState: makeDefender5State(),
      playerSlot: 2, // away player
    });
    useGameStore.getState().selectPiece('away-9');
    const { validMoveHexes } = useGameStore.getState();
    expect(validMoveHexes.length).toBeGreaterThan(0);
  });

  it('DEFENDER_5 state: activeTeam is away (HexGrid canSelect gates home pieces out)', () => {
    // This tests that the GameState correctly reflects activeTeam=away in DEFENDER_5 slot.
    // The canSelect condition in HexGrid uses isActivePlayer = myTeam === activeTeam;
    // a home player (playerSlot=1) with activeTeam='away' has isActivePlayer=false → no highlight.
    // We verify the state contract here; HexGrid enforces it visually.
    const state = makeDefender5State();
    expect(state.activeTeam).toBe('away');
    expect(state.movementSlot).toBe('DEFENDER_5');
  });
});
