import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { useGameStore } from './useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import {
  CORNER_KICK_HEX,
  isWithinCornerExclusionZone,
  hexNeighbors,
  hexesInRange,
  hexDistance,
  isPitchHex,
  isInRegion,
  type GamePhase,
} from '@counter-attack/shared';

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

// TACKLE-03 (Phase 43, plan 06): declined-but-live risk ring persists with no new persistent
// field. tackleRiskHexes is populated by selectPiece's plain-MOVEMENT fallback
// (computeMovementValidHexes -> validateMove per candidate hex), which already omits the
// TACKLE_ATTEMPT effect for a piece flagged in tackleAttemptedByIds (moveValidator.ts) while
// still allowing the move itself. WHY this test exists: without it, a future refactor that
// records a decline in tackleAttemptedByIds would silently break TACKLE-03's ring-persistence
// requirement with no failing test anywhere in the suite.
describe('useGameStore — TACKLE-03: selectPiece tackleRiskHexes persists across a decline resume', () => {
  const CARRIER_ID = 'home-9';
  const CARRIER_POS = { q: 14, r: 13 };
  const DEFENDER_ID = 'away-9';
  // hexDistance 2 from the carrier — the defender is not currently adjacent, but one of its
  // one-hex-pace candidate moves (CANDIDATE_HEX below) lands adjacent to the carrier.
  const DEFENDER_POS = { q: 16, r: 13 };
  const CANDIDATE_HEX = { q: 15, r: 13 }; // hexDistance===1 from both CARRIER_POS and DEFENDER_POS

  function tackleRiskFixture(tackleAttemptedByIds: string[] = []) {
    const pieces = mockMovementState.pieces.map((p) => {
      if (p.id === CARRIER_ID) return { ...p, position: CARRIER_POS };
      if (p.id === DEFENDER_ID) return { ...p, position: DEFENDER_POS };
      return p;
    });
    return {
      ...mockMovementState,
      pieces,
      ball: { position: CARRIER_POS, carrierId: CARRIER_ID, lastTouchedBy: null },
      tackleAttemptedByIds,
    };
  }

  it('TACKLE-03: selectPiece on a non-carrier defender within pace of an opposing carrier yields a non-empty tackleRiskHexes (unattempted baseline)', () => {
    useGameStore.setState({ gameState: tackleRiskFixture([]) });
    useGameStore.getState().selectPiece(DEFENDER_ID);
    const state = useGameStore.getState();
    expect(state.validMoveHexes).toContainEqual(CANDIDATE_HEX);
    expect(state.tackleRiskHexes.length).toBeGreaterThan(0);
  });

  it('TACKLE-03: yields an empty tackleRiskHexes once the defender id is present in tackleAttemptedByIds (attempted)', () => {
    useGameStore.setState({ gameState: tackleRiskFixture([DEFENDER_ID]) });
    useGameStore.getState().selectPiece(DEFENDER_ID);
    expect(useGameStore.getState().tackleRiskHexes).toHaveLength(0);
  });

  it('TACKLE-03: yields a non-empty tackleRiskHexes again on the move step immediately after a decline resume (defender id absent, tackleStealPrompt* cluster cleared)', () => {
    const state = {
      ...tackleRiskFixture([]),
      tackleStealPromptTeam: null,
      tackleStealPromptKind: null,
      tackleStealPromptDefenderId: null,
      tackleStealPromptCarrierId: null,
      tackleStealPromptQueue: [],
      tackleStealPromptResume: null,
    };
    useGameStore.setState({ gameState: state });
    useGameStore.getState().selectPiece(DEFENDER_ID);
    expect(useGameStore.getState().tackleRiskHexes.length).toBeGreaterThan(0);
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
      movementSlot: null,
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

// GOALKICK-02/05 (Plan 37-10): selectPiece coverage for the goal-kick reposition window
// (mirrors the FREE_MOVE_ATTACK/DEFENSE coverage above) and the GOAL_KICK_MOVE travel
// window's single-piece lock (mirrors the GK_KICK_MOVE coverage above).
describe('useGameStore — selectPiece GOAL_KICK_SETUP_GK / GOAL_KICK_MOVE (Plan 37-10)', () => {
  const GK_ELIGIBLE_ID = 'away-8';
  const GK_INELIGIBLE_ID = 'away-10';

  function goalKickSetupGkState(overrides: {
    eligibleIds?: string[];
    goalKickUsedPace?: Record<string, number>;
  }) {
    return {
      ...mockMovementState,
      phase: 'GOAL_KICK_SETUP_GK' as const,
      activeTeam: 'away' as const,
      attackingTeam: 'away' as const,
      goalKickTeam: 'away' as const,
      goalKickGkId: 'away-0',
      goalKickEligibleIds: {
        gkTeam: overrides.eligibleIds ?? [GK_ELIGIBLE_ID],
        opponent: [] as readonly string[],
      },
      goalKickUsedPace: overrides.goalKickUsedPace ?? {},
    };
  }

  function goalKickMoveState(overrides: {
    goalKickMovedPieceId?: string | null;
    goalKickPaceUsed?: number;
  }) {
    return {
      ...mockMovementState,
      phase: 'GOAL_KICK_MOVE' as const,
      activeTeam: 'away' as const,
      attackingTeam: 'away' as const,
      goalKickTeam: 'away' as const,
      goalKickMoveSlot: 'KICKER' as const,
      goalKickMovedPieceId: overrides.goalKickMovedPieceId ?? null,
      goalKickPaceUsed: overrides.goalKickPaceUsed ?? 0,
    };
  }

  beforeEach(() => {
    useGameStore.setState({
      playerSlot: 2, // away
      selectedPieceId: null,
      validMoveHexes: [],
    });
  });

  it('GOAL_KICK_SETUP_GK: selecting an eligible own-team piece populates adjacent valid-move hexes', () => {
    useGameStore.setState({ gameState: goalKickSetupGkState({}) });
    useGameStore.getState().selectPiece(GK_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(GK_ELIGIBLE_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('GOAL_KICK_SETUP_GK: rejects a piece NOT in goalKickEligibleIds.gkTeam (clears selection)', () => {
    useGameStore.setState({ gameState: goalKickSetupGkState({}) });
    useGameStore.getState().selectPiece(GK_INELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('GOAL_KICK_SETUP_GK: selects a pace-exhausted piece (goalKickUsedPace === 6) but yields empty validMoveHexes', () => {
    useGameStore.setState({
      gameState: goalKickSetupGkState({ goalKickUsedPace: { [GK_ELIGIBLE_ID]: 6 } }),
    });
    useGameStore.getState().selectPiece(GK_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(GK_ELIGIBLE_ID);
    expect(state.validMoveHexes).toEqual([]);
  });

  it('GOAL_KICK_SETUP_GK: rejects a piece already in movedPieceIds even with pace remaining under 6 (abandoned)', () => {
    useGameStore.setState({
      gameState: {
        ...goalKickSetupGkState({ goalKickUsedPace: { [GK_ELIGIBLE_ID]: 2 } }),
        movedPieceIds: [GK_ELIGIBLE_ID],
      },
    });
    useGameStore.getState().selectPiece(GK_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('GOAL_KICK_MOVE: respects the single-piece lock via goalKickMovedPieceId — rejects a different piece once one is locked in', () => {
    useGameStore.setState({
      gameState: goalKickMoveState({ goalKickMovedPieceId: GK_ELIGIBLE_ID }),
    });
    useGameStore.getState().selectPiece(GK_INELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('GOAL_KICK_MOVE: the locked piece itself remains selectable and yields adjacent valid-move hexes', () => {
    useGameStore.setState({
      gameState: goalKickMoveState({ goalKickMovedPieceId: GK_ELIGIBLE_ID, goalKickPaceUsed: 1 }),
    });
    useGameStore.getState().selectPiece(GK_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(GK_ELIGIBLE_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });
});

// CORNER-01/02/03/06 (Plan 38-06): selectPiece coverage for the four interactive Corner
// Kick phases — the two GK reposition windows, corner-taker selection, the 6-hex alternating
// reposition window, and the 3-hex pre-kick window. Mirrors the GOAL_KICK_SETUP_GK/GOAL_KICK_MOVE
// coverage above.
describe('useGameStore — selectPiece Corner Kick (Plan 38-06)', () => {
  const HOME_GK_ID = 'home-0';
  const AWAY_GK_ID = 'away-0';
  const REPOSITION_ELIGIBLE_ID = 'home-8';
  const REPOSITION_INELIGIBLE_ID = 'home-10';
  const FINAL_ELIGIBLE_ID = 'home-8';
  const FINAL_OTHER_ID = 'home-10';

  function cornerKickGkSetupState(overrides: {
    phase?: 'CORNER_KICK_GK_SETUP_ATTACKING' | 'CORNER_KICK_GK_SETUP_DEFENDING';
    cornerKickTeam?: 'home' | 'away';
  }) {
    return {
      ...mockMovementState,
      phase: overrides.phase ?? ('CORNER_KICK_GK_SETUP_ATTACKING' as const),
      cornerKickTeam: overrides.cornerKickTeam ?? ('home' as const),
    };
  }

  function cornerKickTakerSelectState(overrides: { cornerKickTeam?: 'home' | 'away' }) {
    return {
      ...mockMovementState,
      phase: 'CORNER_KICK_TAKER_SELECT' as const,
      cornerKickTeam: overrides.cornerKickTeam ?? ('home' as const),
    };
  }

  function cornerKickRepositionState(overrides: {
    stageIndex?: 0 | 1 | 2 | 3 | 4 | 5;
    cornerKickTeam?: 'home' | 'away';
    eligibleIds?: { attacking: string[]; defending: string[] };
    cornerKickActivatedIds?: readonly string[];
    cornerKickStagePlacedIds?: readonly string[];
  }) {
    return {
      ...mockMovementState,
      phase: 'CORNER_KICK_REPOSITION' as const,
      cornerKickTeam: overrides.cornerKickTeam ?? ('home' as const),
      cornerKickStageIndex: overrides.stageIndex ?? 0,
      cornerKickEligibleIds: overrides.eligibleIds ?? {
        attacking: [REPOSITION_ELIGIBLE_ID],
        defending: [] as readonly string[],
      },
      cornerKickActivatedIds: overrides.cornerKickActivatedIds ?? [],
      cornerKickStagePlacedIds: overrides.cornerKickStagePlacedIds ?? [],
    };
  }

  function cornerKickFinalSetupState(overrides: {
    cornerKickTeam?: 'home' | 'away';
    slot?: 'ATTACKER' | 'DEFENDER';
    movedPieceId?: string | null;
    paceUsed?: number;
    eligibleIds?: { attacking: string[]; defending: string[] };
  }) {
    return {
      ...mockMovementState,
      phase: 'CORNER_KICK_FINAL_SETUP' as const,
      cornerKickTeam: overrides.cornerKickTeam ?? ('home' as const),
      cornerKickMoveSlot: overrides.slot ?? ('ATTACKER' as const),
      cornerKickMovedPieceId: overrides.movedPieceId ?? null,
      cornerKickPaceUsed: overrides.paceUsed ?? 0,
      cornerKickEligibleIds: overrides.eligibleIds ?? {
        attacking: [FINAL_ELIGIBLE_ID],
        defending: [] as readonly string[],
      },
    };
  }

  beforeEach(() => {
    useGameStore.setState({
      playerSlot: 1, // home
      selectedPieceId: null,
      validMoveHexes: [],
    });
  });

  it('CORNER_KICK_GK_SETUP_ATTACKING: selects the attacking team GK and yields uncapped validMoveHexes (Assumption A1)', () => {
    useGameStore.setState({
      gameState: cornerKickGkSetupState({
        phase: 'CORNER_KICK_GK_SETUP_ATTACKING',
        cornerKickTeam: 'home',
      }),
    });
    useGameStore.getState().selectPiece(HOME_GK_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(HOME_GK_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('CORNER_KICK_GK_SETUP_ATTACKING: rejects a non-GK own-team piece', () => {
    useGameStore.setState({
      gameState: cornerKickGkSetupState({
        phase: 'CORNER_KICK_GK_SETUP_ATTACKING',
        cornerKickTeam: 'home',
      }),
    });
    useGameStore.getState().selectPiece(REPOSITION_ELIGIBLE_ID); // home-8, an FWD, not GK
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_GK_SETUP_DEFENDING: selects the defending team GK (the team opposite cornerKickTeam)', () => {
    useGameStore.setState({
      playerSlot: 2, // away
      gameState: cornerKickGkSetupState({
        phase: 'CORNER_KICK_GK_SETUP_DEFENDING',
        cornerKickTeam: 'home',
      }),
    });
    useGameStore.getState().selectPiece(AWAY_GK_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(AWAY_GK_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('CORNER_KICK_TAKER_SELECT: accepts any own on-pitch piece and yields empty validMoveHexes', () => {
    useGameStore.setState({ gameState: cornerKickTakerSelectState({ cornerKickTeam: 'home' }) });
    useGameStore.getState().selectPiece(REPOSITION_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(REPOSITION_ELIGIBLE_ID);
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_TAKER_SELECT: rejects an opponent piece', () => {
    useGameStore.setState({ gameState: cornerKickTakerSelectState({ cornerKickTeam: 'home' }) });
    useGameStore.getState().selectPiece(AWAY_GK_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it("CORNER_KICK_REPOSITION: rejects a piece absent from the current stage side's cornerKickEligibleIds", () => {
    useGameStore.setState({ gameState: cornerKickRepositionState({}) });
    useGameStore.getState().selectPiece(REPOSITION_INELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_REPOSITION: rejects a piece belonging to a team other than cornerKickStageTeam(stageIndex, cornerKickTeam)', () => {
    // Stage 0 is the attacking side's stage (cornerKickTeam='home') — an away piece is never
    // eligible this stage regardless of the eligible-list contents.
    useGameStore.setState({
      playerSlot: 2,
      gameState: cornerKickRepositionState({
        stageIndex: 0,
        cornerKickTeam: 'home',
        eligibleIds: { attacking: [], defending: ['away-8'] },
      }),
    });
    useGameStore.getState().selectPiece('away-8');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_REPOSITION: selects a piece activated in an earlier stage but yields empty validMoveHexes', () => {
    useGameStore.setState({
      gameState: cornerKickRepositionState({
        cornerKickActivatedIds: [REPOSITION_ELIGIBLE_ID],
        cornerKickStagePlacedIds: [],
      }),
    });
    useGameStore.getState().selectPiece(REPOSITION_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(REPOSITION_ELIGIBLE_ID);
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_REPOSITION: a piece activated THIS stage also yields empty validMoveHexes — no same-stage exemption', () => {
    useGameStore.setState({
      gameState: cornerKickRepositionState({
        cornerKickActivatedIds: [REPOSITION_ELIGIBLE_ID],
        cornerKickStagePlacedIds: [REPOSITION_ELIGIBLE_ID],
      }),
    });
    useGameStore.getState().selectPiece(REPOSITION_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(REPOSITION_ELIGIBLE_ID);
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_REPOSITION: an unactivated eligible piece offers a far-away (hexDistance >= 5) unoccupied on-pitch destination', () => {
    useGameStore.setState({ gameState: cornerKickRepositionState({}) });
    useGameStore.getState().selectPiece(REPOSITION_ELIGIBLE_ID);
    const state = useGameStore.getState();
    const piece = state.gameState.pieces.find((p) => p.id === REPOSITION_ELIGIBLE_ID)!;
    expect(state.selectedPieceId).toBe(REPOSITION_ELIGIBLE_ID);
    expect(state.validMoveHexes.some((hex) => hexDistance(piece.position, hex) >= 5)).toBe(true);
  });

  it('CORNER_KICK_REPOSITION: excludes a hex occupied by ANY piece, not just own-team pieces', () => {
    useGameStore.setState({ gameState: cornerKickRepositionState({}) });
    const occupiedHex = useGameStore
      .getState()
      .gameState.pieces.find((p) => p.id === AWAY_GK_ID)!.position;
    useGameStore.getState().selectPiece(REPOSITION_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(
      state.validMoveHexes.some((hex) => hex.q === occupiedHex.q && hex.r === occupiedHex.r),
    ).toBe(false);
  });

  it('CORNER_KICK_FINAL_SETUP: rejects a different eligible piece once cornerKickMovedPieceId is locked', () => {
    useGameStore.setState({
      gameState: cornerKickFinalSetupState({
        movedPieceId: FINAL_ELIGIBLE_ID,
        eligibleIds: { attacking: [FINAL_ELIGIBLE_ID, FINAL_OTHER_ID], defending: [] },
      }),
    });
    useGameStore.getState().selectPiece(FINAL_OTHER_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_FINAL_SETUP: yields empty validMoveHexes once cornerKickPaceUsed reaches cap 3', () => {
    useGameStore.setState({
      gameState: cornerKickFinalSetupState({ movedPieceId: FINAL_ELIGIBLE_ID, paceUsed: 3 }),
    });
    useGameStore.getState().selectPiece(FINAL_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(FINAL_ELIGIBLE_ID);
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_FINAL_SETUP: the locked piece itself remains selectable and yields adjacent valid-move hexes', () => {
    useGameStore.setState({
      gameState: cornerKickFinalSetupState({ movedPieceId: FINAL_ELIGIBLE_ID, paceUsed: 1 }),
    });
    useGameStore.getState().selectPiece(FINAL_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(FINAL_ELIGIBLE_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });
});

// Permanent defender exclusion-zone filter coverage for CORNER_KICK_REPOSITION and
// CORNER_KICK_FINAL_SETUP (Plan 38-22; clear-out-specific coverage removed in Plan 38-28
// alongside the deleted CORNER_KICK_CLEAR_OUT phase). Every probe hex below is derived from
// CORNER_KICK_HEX + hex helpers (hexNeighbors/hexesInRange/hexDistance/isPitchHex) — never a
// restated coordinate literal, per this plan's read_first instruction.
describe('useGameStore — selectPiece exclusion-zone filtering (Plan 38-22)', () => {
  // cornerKickTeam='away' (attacking/awarded side) -> bylineOwnerTeam='home' (conceding side)
  // -> the corner is taken from CORNER_KICK_HEX.home (matches outOfBounds.ts's inversion rule).
  const CORNER_HEX = CORNER_KICK_HEX.home.top;

  // A hex at exactly CORNER_EXCLUSION_RADIUS (3) from the corner, on-pitch, whose own on-pitch
  // neighbours span both inside and outside the zone — derived by scanning the real geometry
  // rather than hand-picking a literal, so this stays correct if the radius/corner constants
  // ever change.
  const ZONE_EDGE_HEX = (() => {
    const ring = hexesInRange(CORNER_HEX, 3).filter(
      (h) => hexDistance(h, CORNER_HEX) === 3 && isPitchHex(h),
    );
    const candidate = ring.find((c) => {
      const neighbors = hexNeighbors(c).filter(isPitchHex);
      const inZone = neighbors.filter((n) => isWithinCornerExclusionZone(n, CORNER_HEX));
      const outZone = neighbors.filter((n) => !isWithinCornerExclusionZone(n, CORNER_HEX));
      return inZone.length > 0 && outZone.length > 0;
    });
    if (!candidate) throw new Error('No zone-edge candidate found — geometry assumption broken');
    return candidate;
  })();

  beforeEach(() => {
    useGameStore.setState({ playerSlot: 2, selectedPieceId: null, validMoveHexes: [] }); // away
  });

  it('CORNER_KICK_REPOSITION: a defending piece is not offered any hex inside the exclusion zone', () => {
    // Stage 1 is the defending side's stage for cornerKickTeam='away' -> acting team 'home'.
    useGameStore.setState({
      playerSlot: 1, // home
      gameState: {
        ...mockMovementState,
        phase: 'CORNER_KICK_REPOSITION' as const,
        cornerKickTeam: 'away' as const,
        cornerKickHex: CORNER_HEX,
        cornerKickStageIndex: 1 as const,
        cornerKickEligibleIds: {
          attacking: [] as readonly string[],
          defending: ['home-1'] as readonly string[],
        },
        cornerKickActivatedIds: [] as readonly string[],
        cornerKickStagePlacedIds: [] as readonly string[],
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-1' ? { ...p, position: ZONE_EDGE_HEX } : p,
        ),
      },
      selectedPieceId: null,
      validMoveHexes: [],
    });
    useGameStore.getState().selectPiece('home-1');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('home-1');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
    for (const hex of state.validMoveHexes) {
      expect(isWithinCornerExclusionZone(hex, CORNER_HEX)).toBe(false);
    }
  });

  it('CORNER_KICK_REPOSITION: an attacking piece IS offered hexes inside the exclusion zone', () => {
    // Stage 0 is the attacking side's stage for cornerKickTeam='away' -> acting team 'away'.
    useGameStore.setState({
      playerSlot: 2, // away
      gameState: {
        ...mockMovementState,
        phase: 'CORNER_KICK_REPOSITION' as const,
        cornerKickTeam: 'away' as const,
        cornerKickHex: CORNER_HEX,
        cornerKickStageIndex: 0 as const,
        cornerKickEligibleIds: {
          attacking: ['away-1'] as readonly string[],
          defending: [] as readonly string[],
        },
        cornerKickActivatedIds: [] as readonly string[],
        cornerKickStagePlacedIds: [] as readonly string[],
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'away-1' ? { ...p, position: ZONE_EDGE_HEX } : p,
        ),
      },
      selectedPieceId: null,
      validMoveHexes: [],
    });
    useGameStore.getState().selectPiece('away-1');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('away-1');
    expect(state.validMoveHexes.some((hex) => isWithinCornerExclusionZone(hex, CORNER_HEX))).toBe(
      true,
    );
  });

  it('CORNER_KICK_FINAL_SETUP: the DEFENDER slot is not offered any hex inside the exclusion zone', () => {
    // slot='DEFENDER' -> acting team opposite cornerKickTeam ('away') -> 'home'.
    useGameStore.setState({
      playerSlot: 1, // home
      gameState: {
        ...mockMovementState,
        phase: 'CORNER_KICK_FINAL_SETUP' as const,
        cornerKickTeam: 'away' as const,
        cornerKickHex: CORNER_HEX,
        cornerKickMoveSlot: 'DEFENDER' as const,
        cornerKickMovedPieceId: null,
        cornerKickPaceUsed: 0,
        cornerKickEligibleIds: {
          attacking: [] as readonly string[],
          defending: ['home-1'] as readonly string[],
        },
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-1' ? { ...p, position: ZONE_EDGE_HEX } : p,
        ),
      },
      selectedPieceId: null,
      validMoveHexes: [],
    });
    useGameStore.getState().selectPiece('home-1');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('home-1');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
    for (const hex of state.validMoveHexes) {
      expect(isWithinCornerExclusionZone(hex, CORNER_HEX)).toBe(false);
    }
  });
});

// CORNER-03/06 (Plan 38-06): setGameState sticky-selection coverage — mirrors the BUG-09
// response-move slot hand-off tests above, plus CORNER_KICK_REPOSITION's stage-handoff clear
// (a same-phase-value transition, unlike GOAL_KICK_SETUP_GK->_OPPONENT's distinct phase values).
describe('useGameStore — setGameState sticky-selection for Corner Kick (Plan 38-06)', () => {
  const FINAL_LOCKED_ID = 'home-8';
  const REPOSITION_LOCKED_ID = 'home-8';

  function cornerKickFinalSetupBroadcast(overrides: {
    slot?: 'ATTACKER' | 'DEFENDER';
    paceUsed?: number;
  }) {
    return {
      ...mockMovementState,
      phase: 'CORNER_KICK_FINAL_SETUP' as const,
      cornerKickTeam: 'home' as const,
      cornerKickMoveSlot: overrides.slot ?? ('ATTACKER' as const),
      cornerKickMovedPieceId: FINAL_LOCKED_ID,
      cornerKickPaceUsed: overrides.paceUsed ?? 0,
      cornerKickEligibleIds: { attacking: [FINAL_LOCKED_ID], defending: [] as readonly string[] },
    };
  }

  function cornerKickRepositionBroadcast(overrides: {
    stageIndex?: 0 | 1 | 2 | 3 | 4 | 5;
    activated?: boolean;
    placedThisStage?: boolean;
  }) {
    return {
      ...mockMovementState,
      phase: 'CORNER_KICK_REPOSITION' as const,
      cornerKickTeam: 'home' as const,
      cornerKickStageIndex: overrides.stageIndex ?? 0,
      cornerKickEligibleIds: {
        attacking: [REPOSITION_LOCKED_ID],
        defending: [] as readonly string[],
      },
      cornerKickActivatedIds: overrides.activated ? [REPOSITION_LOCKED_ID] : [],
      cornerKickStagePlacedIds: overrides.placedThisStage ? [REPOSITION_LOCKED_ID] : [],
    };
  }

  it('CORNER_KICK_FINAL_SETUP: keeps the locked piece selected across a same-phase, same-slot broadcast', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: cornerKickFinalSetupBroadcast({ slot: 'ATTACKER', paceUsed: 0 }),
      selectedPieceId: FINAL_LOCKED_ID,
      validMoveHexes: [],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    const broadcast = cornerKickFinalSetupBroadcast({ slot: 'ATTACKER', paceUsed: 1 });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(FINAL_LOCKED_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('CORNER_KICK_FINAL_SETUP: clears selection on the ATTACKER -> DEFENDER slot flip', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: cornerKickFinalSetupBroadcast({ slot: 'ATTACKER' }),
      selectedPieceId: FINAL_LOCKED_ID,
      validMoveHexes: [{ q: 5, r: 5 }],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    const broadcast = cornerKickFinalSetupBroadcast({ slot: 'DEFENDER' });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_REPOSITION: clears selection on every stage handoff (cornerKickStageIndex change)', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: cornerKickRepositionBroadcast({ stageIndex: 0 }),
      selectedPieceId: REPOSITION_LOCKED_ID,
      validMoveHexes: [{ q: 5, r: 5 }],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    const broadcast = cornerKickRepositionBroadcast({ stageIndex: 1 });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_REPOSITION: activation lock clears destinations immediately once placement completes — no same-stage exemption', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: cornerKickRepositionBroadcast({
        stageIndex: 0,
        activated: false,
        placedThisStage: false,
      }),
      selectedPieceId: REPOSITION_LOCKED_ID,
      validMoveHexes: [],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    // Piece just placed this stage — activated AND placedThisStage both true. Under the
    // corrected model there is no same-stage exemption: the piece is locked the instant its
    // placement lands, so validMoveHexes must be empty even though the stage itself is unchanged.
    const broadcast = cornerKickRepositionBroadcast({
      stageIndex: 0,
      activated: true,
      placedThisStage: true,
    });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(REPOSITION_LOCKED_ID);
    expect(state.validMoveHexes).toEqual([]);
  });

  it('CORNER_KICK_REPOSITION: clears destinations once the locked piece was activated in an earlier stage', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: cornerKickRepositionBroadcast({
        stageIndex: 0,
        activated: true,
        placedThisStage: true,
      }),
      selectedPieceId: REPOSITION_LOCKED_ID,
      validMoveHexes: [{ q: 5, r: 5 }],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    // A later-stage broadcast where the piece is still activated but no longer in this
    // stage's placed set (i.e. the stage advanced but selection somehow persisted — the lock
    // condition alone, independent of the earlier stage-handoff clear tested above).
    const broadcast = cornerKickRepositionBroadcast({
      stageIndex: 0,
      activated: true,
      placedThisStage: false,
    });
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(REPOSITION_LOCKED_ID);
    expect(state.validMoveHexes).toEqual([]);
  });
});

// Phase 39 Plan 05: selectPiece coverage for the four new interactive phases (both penalty
// reposition windows, taker-select, and the GK box-entry move) plus the three pure two-button
// prompt phases that must leave no piece selectable. Mirrors the GOAL_KICK_SETUP_GK/Corner Kick
// coverage above in structure.
describe('useGameStore — selectPiece Penalty Kick / GK Box Entry / Foul Choice (Plan 39-05)', () => {
  const ATTACKING_ELIGIBLE_ID = 'home-6'; // MID 2, {q:10,r:13} — far from either penalty area
  const DEFENDING_ELIGIBLE_ID = 'away-6'; // MID 2, {q:26,r:13} — far from either penalty area

  function penaltySetupState(overrides: {
    phase?: 'PENALTY_KICK_SETUP_ATTACKING' | 'PENALTY_KICK_SETUP_DEFENDING';
    penaltyKickTeam?: 'home' | 'away';
    penaltyKickTakerId?: string | null;
    eligibleAttacking?: string[];
    eligibleDefending?: string[];
    movedPieceIds?: string[];
  }) {
    return {
      ...mockMovementState,
      phase: overrides.phase ?? ('PENALTY_KICK_SETUP_ATTACKING' as const),
      activeTeam:
        overrides.phase === 'PENALTY_KICK_SETUP_DEFENDING' ? ('away' as const) : ('home' as const),
      penaltyKickTeam: overrides.penaltyKickTeam ?? ('home' as const),
      penaltyKickTakerId: overrides.penaltyKickTakerId ?? null,
      penaltyKickEligibleIds: {
        attacking: overrides.eligibleAttacking ?? [ATTACKING_ELIGIBLE_ID],
        defending: overrides.eligibleDefending ?? [DEFENDING_ELIGIBLE_ID],
      },
      movedPieceIds: overrides.movedPieceIds ?? [],
    };
  }

  beforeEach(() => {
    useGameStore.setState({ selectedPieceId: null, validMoveHexes: [] });
  });

  it('PENALTY_KICK_SETUP_ATTACKING: selecting an eligible home piece (myTeam=home) yields unoccupied on-pitch neighbours', () => {
    useGameStore.setState({ playerSlot: 1, gameState: penaltySetupState({}) });
    useGameStore.getState().selectPiece(ATTACKING_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(ATTACKING_ELIGIBLE_ID);
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
    expect(state.validMoveHexes.length).toBeLessThanOrEqual(6);
  });

  it('PENALTY_KICK_SETUP_ATTACKING: selecting a piece absent from penaltyKickEligibleIds.attacking yields no selection', () => {
    useGameStore.setState({ playerSlot: 1, gameState: penaltySetupState({}) });
    // home-5 is on the active team but not in the eligible list above.
    useGameStore.getState().selectPiece('home-5');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('PENALTY_KICK_SETUP_ATTACKING: excludes a neighbour hex inside the defending (away) penalty area for an ordinary outfielder, includes it for the chosen taker', () => {
    // {q:30,r:13} sits just outside PITCH_REGIONS.awayPenaltyArea (q>=31,r 5..19); one of its
    // ODD-Q neighbours, {q:31,r:13}, is real awayPenaltyArea territory (verified via isInRegion
    // below rather than assumed) — per the Phase 10 STATE.md lesson, use real region membership,
    // not invented coordinates.
    const nearBoxHex = { q: 30, r: 13 };
    const boxNeighbor = hexNeighbors(nearBoxHex).find((h) => isInRegion(h, 'awayPenaltyArea'));
    expect(boxNeighbor).toBeDefined();

    const gameStateBase = penaltySetupState({ eligibleAttacking: ['home-6', 'home-7'] });
    const piecesWithOutfielderNearBox = gameStateBase.pieces.map((p) =>
      p.id === 'home-6' ? { ...p, position: nearBoxHex } : p,
    );

    // Ordinary outfielder (home-6, not the taker, not the defending GK): the box neighbour is excluded.
    useGameStore.setState({
      playerSlot: 1,
      gameState: { ...gameStateBase, pieces: piecesWithOutfielderNearBox },
    });
    useGameStore.getState().selectPiece('home-6');
    const outfielderState = useGameStore.getState();
    expect(outfielderState.validMoveHexes).not.toContainEqual(boxNeighbor);

    // Same piece, but now it IS the chosen penalty taker: the box neighbour is included.
    useGameStore.setState({
      playerSlot: 1,
      gameState: {
        ...gameStateBase,
        pieces: piecesWithOutfielderNearBox,
        penaltyKickTakerId: 'home-6',
      },
      selectedPieceId: null,
      validMoveHexes: [],
    });
    useGameStore.getState().selectPiece('home-6');
    const takerState = useGameStore.getState();
    expect(takerState.validMoveHexes).toContainEqual(boxNeighbor);
  });

  it('PENALTY_KICK_SETUP_ATTACKING: a piece already in movedPieceIds is not selectable', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: penaltySetupState({ movedPieceIds: [ATTACKING_ELIGIBLE_ID] }),
    });
    useGameStore.getState().selectPiece(ATTACKING_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('PENALTY_KICK_SETUP_DEFENDING: a piece already in movedPieceIds is not selectable', () => {
    useGameStore.setState({
      playerSlot: 2,
      gameState: penaltySetupState({
        phase: 'PENALTY_KICK_SETUP_DEFENDING',
        movedPieceIds: [DEFENDING_ELIGIBLE_ID],
      }),
    });
    useGameStore.getState().selectPiece(DEFENDING_ELIGIBLE_ID);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('transitioning PENALTY_KICK_SETUP_ATTACKING -> PENALTY_KICK_SETUP_DEFENDING clears selectedPieceId', () => {
    const attackingState = penaltySetupState({});
    useGameStore.setState({ playerSlot: 1, gameState: attackingState });
    useGameStore.getState().selectPiece(ATTACKING_ELIGIBLE_ID);
    expect(useGameStore.getState().selectedPieceId).toBe(ATTACKING_ELIGIBLE_ID);

    const defendingState = penaltySetupState({ phase: 'PENALTY_KICK_SETUP_DEFENDING' });
    useGameStore.getState().setGameState(defendingState);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
  });

  // 39-23 (gap-6 closure): PENALTY_KICK_TAKER_SELECT now mirrors CORNER_KICK_TAKER_SELECT —
  // a board click SELECTS the piece and emits nothing; commitment happens via
  // PenaltyKickSetupPanel's Confirm button (emitPenaltyKickTaker), tested separately in
  // PenaltyKickSetupPanel.test.tsx.
  it('PENALTY_KICK_TAKER_SELECT: clicking an own-team outfielder selects it and emits nothing', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: {
        ...mockMovementState,
        phase: 'PENALTY_KICK_TAKER_SELECT',
        penaltyKickTeam: 'home',
      },
    });
    useGameStore.getState().selectPiece('home-7');
    expect(useGameStore.getState().selectedPieceId).toBe('home-7');
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('PENALTY_KICK_TAKER_SELECT: clicking the own goalkeeper yields no selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: {
        ...mockMovementState,
        phase: 'PENALTY_KICK_TAKER_SELECT',
        penaltyKickTeam: 'home',
      },
    });
    useGameStore.getState().selectPiece('home-0'); // home-0 is the GK
    expect(emitMock).not.toHaveBeenCalled();
    expect(useGameStore.getState().selectedPieceId).toBeNull();
  });

  // 39-REVIEW IN-02 closure: a sent-off teammate is unselectable on the client, mirroring
  // applyPenaltyKickTaker's server-side TAKER_INVALID rejection, instead of round-tripping a
  // GAME_ERROR after an emission the server would reject anyway.
  it('PENALTY_KICK_TAKER_SELECT: clicking a red-carded teammate yields no selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: {
        ...mockMovementState,
        phase: 'PENALTY_KICK_TAKER_SELECT',
        penaltyKickTeam: 'home',
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-7' ? { ...p, redCarded: true } : p,
        ),
      },
    });
    useGameStore.getState().selectPiece('home-7');
    expect(emitMock).not.toHaveBeenCalled();
    expect(useGameStore.getState().selectedPieceId).toBeNull();
  });

  // Phase 42 (BUG-38 residual audit, 42-10): this guard was converged onto the shared
  // isActivePiece predicate (was a hand-written `redCarded === true` check) — proves the
  // two-clause predicate's onPitch:false-only branch is also honored here, not just redCarded.
  it('PENALTY_KICK_TAKER_SELECT: clicking a benched (onPitch:false, not redCarded) teammate yields no selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: {
        ...mockMovementState,
        phase: 'PENALTY_KICK_TAKER_SELECT',
        penaltyKickTeam: 'home',
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-7' ? { ...p, onPitch: false } : p,
        ),
      },
    });
    useGameStore.getState().selectPiece('home-7');
    expect(emitMock).not.toHaveBeenCalled();
    expect(useGameStore.getState().selectedPieceId).toBeNull();
  });

  it('PENALTY_KICK_TAKER_SELECT: clicking an opponent piece yields no selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: {
        ...mockMovementState,
        phase: 'PENALTY_KICK_TAKER_SELECT',
        penaltyKickTeam: 'home',
      },
    });
    useGameStore.getState().selectPiece('away-7');
    expect(emitMock).not.toHaveBeenCalled();
    expect(useGameStore.getState().selectedPieceId).toBeNull();
  });

  it('GK_BOX_ENTRY_MOVE: the responding team goalkeeper yields at most six valid hexes', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: { ...mockMovementState, phase: 'GK_BOX_ENTRY_MOVE', gkBoxEntryTeam: 'home' },
    });
    useGameStore.getState().selectPiece('home-0'); // home-0 is the GK
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('home-0');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
    expect(state.validMoveHexes.length).toBeLessThanOrEqual(6);
  });

  it('GK_BOX_ENTRY_MOVE: a non-goalkeeper own-team piece yields no selection', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: { ...mockMovementState, phase: 'GK_BOX_ENTRY_MOVE', gkBoxEntryTeam: 'home' },
    });
    useGameStore.getState().selectPiece('home-6'); // MID, not GK
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('GK_BOX_ENTRY_MOVE: myTeam !== gkBoxEntryTeam yields no selection, even for the goalkeeper', () => {
    useGameStore.setState({
      playerSlot: 1, // home
      gameState: { ...mockMovementState, phase: 'GK_BOX_ENTRY_MOVE', gkBoxEntryTeam: 'away' },
    });
    useGameStore.getState().selectPiece('home-0');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  // GK_DIVE_AT_FEET_TARGET (GKDIVE-02/GKDIVE-04, 39-UAT gap 3, Plan 39-21): away-0 (GK) is
  // repositioned adjacent to home-9 (the ball carrier at {q:14,r:13}) so the shared
  // computeGkDiveAtFeetTargetHexes helper returns a non-empty set within its 3-hex GK-range cap.
  const gkDiveAtFeetTargetState = {
    ...mockMovementState,
    phase: 'GK_DIVE_AT_FEET_TARGET' as const,
    gkDiveAtFeetTeam: 'away' as const,
    gkDiveAtFeetGkId: 'away-0',
    gkDiveAtFeetCarrierId: 'home-9',
    pieces: mockMovementState.pieces.map((p) =>
      p.id === 'away-0' ? { ...p, position: { q: 13, r: 13 } } : p,
    ),
  };

  it('GK_DIVE_AT_FEET_TARGET: the diving goalkeeper (away-0) is selectable by its own manager and yields a non-empty validMoveHexes set', () => {
    useGameStore.setState({
      playerSlot: 2, // away
      gameState: gkDiveAtFeetTargetState,
    });
    useGameStore.getState().selectPiece('away-0');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('away-0');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('GK_DIVE_AT_FEET_TARGET: every hex in validMoveHexes is exactly hexDistance 1 from the carrier', () => {
    useGameStore.setState({
      playerSlot: 2,
      gameState: gkDiveAtFeetTargetState,
    });
    useGameStore.getState().selectPiece('away-0');
    const carrier = gkDiveAtFeetTargetState.pieces.find((p) => p.id === 'home-9')!;
    const state = useGameStore.getState();
    for (const hex of state.validMoveHexes) {
      expect(hexDistance(hex, carrier.position)).toBe(1);
    }
  });

  it('GK_DIVE_AT_FEET_TARGET: clicking a non-goalkeeper outfield piece yields no selection', () => {
    useGameStore.setState({
      playerSlot: 2,
      gameState: gkDiveAtFeetTargetState,
    });
    useGameStore.getState().selectPiece('away-6'); // MID, not the diving GK
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('GK_DIVE_AT_FEET_TARGET: the attacking-team manager cannot select the diving goalkeeper', () => {
    useGameStore.setState({
      playerSlot: 1, // home (attacking team, NOT gkDiveAtFeetTeam)
      gameState: gkDiveAtFeetTargetState,
    });
    useGameStore.getState().selectPiece('away-0');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('entering FOUL_CHOICE clears any previously selected piece', () => {
    useGameStore.setState({
      playerSlot: 1,
      selectedPieceId: 'home-6',
      validMoveHexes: [{ q: 1, r: 1 }],
      gameState: mockMovementState,
    });
    useGameStore.getState().setGameState({ ...mockMovementState, phase: 'FOUL_CHOICE' });
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('FOUL_CHOICE: selectPiece is a defense-in-depth no-op even if called directly', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: { ...mockMovementState, phase: 'FOUL_CHOICE' },
    });
    useGameStore.getState().selectPiece('home-6');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('GK_DIVE_AT_FEET_PROMPT: selectPiece is a defense-in-depth no-op', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: { ...mockMovementState, phase: 'GK_DIVE_AT_FEET_PROMPT' },
    });
    useGameStore.getState().selectPiece('home-6');
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('GK_BOX_ENTRY_PROMPT: selectPiece is a defense-in-depth no-op', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: { ...mockMovementState, phase: 'GK_BOX_ENTRY_PROMPT' },
    });
    useGameStore.getState().selectPiece('home-6');
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

  // CORNER-01 (Plan 38-06): mirrors emitFreeKickMove's shape (two args, clears selection).
  it('emitCornerKickGkPlace calls socket.emit with game:corner-kick-gk-place, pieceId, hex and clears selection', () => {
    const targetHex = { q: 3, r: 3 };
    useGameStore.setState({ selectedPieceId: 'home-0', validMoveHexes: [targetHex] });
    useGameStore.getState().emitCornerKickGkPlace('home-0', targetHex);
    expect(emitMock).toHaveBeenCalledWith('game:corner-kick-gk-place', 'home-0', targetHex);
    expect(useGameStore.getState().selectedPieceId).toBeNull();
    expect(useGameStore.getState().validMoveHexes).toHaveLength(0);
  });

  // CORNER-02 (Plan 38-06): mirrors emitThrowInPlace's shape — a single pieceId argument, since
  // the destination (cornerKickHex) is server-owned. T-38-24: the emitted call carries exactly
  // one payload argument (event name + pieceId, no hex), so a tampered client cannot widen it.
  it('emitCornerKickTaker calls socket.emit with game:corner-kick-taker and exactly one payload argument', () => {
    useGameStore.getState().emitCornerKickTaker('home-8');
    expect(emitMock).toHaveBeenCalledWith('game:corner-kick-taker', 'home-8');
    expect(emitMock.mock.calls[emitMock.mock.calls.length - 1]).toHaveLength(2);
  });

  // Phase 39 Plan 05: the five new fire-and-forget emitters — no optimistic local state
  // mutation on any of them (unlike emitMove/emitFreeKickMove/emitCornerKickGkPlace, which
  // clear selectedPieceId/validMoveHexes). Each is asserted to call socket.emit exactly once
  // with the matching ClientEvents constant and payload.
  it('emitFoulChoice calls socket.emit with game:foul-choice and the choice', () => {
    useGameStore.getState().emitFoulChoice('restart');
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith('game:foul-choice', 'restart');
  });

  it('emitGkDiveAtFeet calls socket.emit with game:gk-dive-at-feet and accept', () => {
    useGameStore.getState().emitGkDiveAtFeet(true);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith('game:gk-dive-at-feet', true);
  });

  it('emitGkDiveAtFeetTarget calls socket.emit exactly once with game:gk-dive-at-feet-target and the hex, and clears selectedPieceId', () => {
    useGameStore.setState({ selectedPieceId: 'away-0', validMoveHexes: [{ q: 5, r: 5 }] });
    useGameStore.getState().emitGkDiveAtFeetTarget({ q: 5, r: 5 });
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith('game:gk-dive-at-feet-target', { q: 5, r: 5 });
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('emitGkBoxEntryResponse calls socket.emit with game:gk-box-entry-response and accept', () => {
    useGameStore.getState().emitGkBoxEntryResponse(false);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith('game:gk-box-entry-response', false);
  });

  it('emitGkBoxEntryMove calls socket.emit with game:gk-box-entry-move and the hex', () => {
    useGameStore.getState().emitGkBoxEntryMove({ q: 4, r: 13 });
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith('game:gk-box-entry-move', { q: 4, r: 13 });
  });

  it('emitPenaltyKickTaker calls socket.emit with game:penalty-kick-taker and the pieceId', () => {
    useGameStore.getState().emitPenaltyKickTaker('home-7');
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith('game:penalty-kick-taker', 'home-7');
  });

  // SUB-02 (Phase 40): fire-and-forget, no optimistic state mutation — mirrors emitFoulChoice's
  // shape. Payload is a single object ({ outPieceId, inPlayerId }), matching SubstitutionPayload.
  it('emitSubstitution calls socket.emit once with game:substitution and { outPieceId, inPlayerId }, and does not mutate store state', () => {
    const prevState = useGameStore.getState();
    useGameStore.getState().emitSubstitution('home-4', 'p055');
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith('game:substitution', {
      outPieceId: 'home-4',
      inPlayerId: 'p055',
    });
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe(prevState.selectedPieceId);
    expect(state.validMoveHexes).toBe(prevState.validMoveHexes);
    expect(state.gameState).toBe(prevState.gameState);
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

// SELECTOR-REVIEW.md fix #1 (Phase 32-05, CLEANUP-03/D-06): setGameState's sticky-selection
// logic previously had no dedicated branch for KICK_OFF_SETUP, so it fell through to the
// generic MOVEMENT computeMovementValidHexes path, which always yields [] during KICK_OFF_SETUP
// (validateMove's WRONG_SLOT guard fires because movementSlot is null) — silently wiping the
// zone highlight the moment the opponent repositions any piece while a piece stays selected.
describe('useGameStore — setGameState sticky-selection for KICK_OFF_SETUP (SELECTOR-REVIEW.md fix #1)', () => {
  function kickOffSetupState() {
    return {
      ...mockMovementState,
      phase: 'KICK_OFF_SETUP' as const,
      attackingTeam: 'home' as const,
    };
  }

  beforeEach(() => {
    useGameStore.setState({
      playerSlot: 1, // home
      gameState: kickOffSetupState(),
      selectedPieceId: 'home-8',
      validMoveHexes: [],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
  });

  it('keeps the piece selected and recomputes a non-empty zone across a same-phase broadcast (regression: previously collapsed to [])', () => {
    // Simulates the opponent repositioning a different piece during KICK_OFF_SETUP — phase
    // unchanged, movementSlot unchanged (stays null throughout this phase), the previously
    // selected piece is untouched and still exists.
    const broadcast = {
      ...kickOffSetupState(),
      pieces: mockMovementState.pieces.map((p) =>
        p.id === 'away-8' ? { ...p, position: { q: p.position.q + 1, r: p.position.r } } : p,
      ),
    };
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('home-8');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('clears selection when the selected piece is removed from the broadcast state (defense-in-depth, unrelated to the fix)', () => {
    const broadcast = {
      ...kickOffSetupState(),
      pieces: mockMovementState.pieces.filter((p) => p.id !== 'home-8'),
    };
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });
});

// SELECTOR-REVIEW.md fix #1 (Phase 32-05, CLEANUP-03/D-06): same root cause as the KICK_OFF_SETUP
// fix above — a FREE_KICK_SETUP stage hand-off does not change GameState.phase, so this phase
// also fell through to the generic MOVEMENT path and silently zeroed validMoveHexes on every
// same-phase broadcast, instead of either recomputing the zone or clearing selection when the
// active stage hands off to the other team.
describe('useGameStore — setGameState sticky-selection for FREE_KICK_SETUP (SELECTOR-REVIEW.md fix #1)', () => {
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

  it('stage 0 (kicking = away): keeps the piece selected and recomputes non-empty validMoveHexes across a same-stage broadcast', () => {
    useGameStore.setState({
      playerSlot: 2, // away
      gameState: freeKickSetupState(0),
      selectedPieceId: 'away-9',
      validMoveHexes: [],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    // Same stage, unrelated piece moved — simulates a broadcast arriving mid-selection.
    const broadcast = {
      ...freeKickSetupState(0),
      pieces: mockMovementState.pieces.map((p) =>
        p.id === 'home-1' ? { ...p, position: { q: p.position.q + 1, r: p.position.r } } : p,
      ),
    };
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBe('away-9');
    expect(state.validMoveHexes.length).toBeGreaterThan(0);
  });

  it('clears a kicking-team selection when the stage hands off to the defending team (regression: previously stayed selected with stale/empty hexes)', () => {
    useGameStore.setState({
      playerSlot: 2, // away (kicking team)
      gameState: freeKickSetupState(0),
      selectedPieceId: 'away-9',
      validMoveHexes: [{ q: 22, r: 12 }],
      tackleRiskHexes: [],
      lastMovedPieceId: null,
    });
    // Stage advances 0 -> 1: active team hands off from away (kicking) to home (defending).
    const broadcast = freeKickSetupState(1);
    useGameStore.getState().setGameState(broadcast);
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });
});

// GOALKICK-03/D-17 (gap-closure plan 37-17): 37-UAT.md Test 10 — a broadcast whose eligible
// next-action set (ELIGIBLE_NEXT_ACTIONS[lastActionType]) collapses to a single pass type must
// auto-select that pass type on the acting client only, going through the real setSelectedPassType
// action so validPassTargetHexes/interceptionRiskHexes are populated exactly as an explicit click
// would produce (D-17-03). GOAL_KICK_RESTART is the first singleton row; the rule itself is
// generic over set cardinality (D-17-01), not special-cased to that lastActionType.
describe('useGameStore — setGameState singleton pass-type auto-selection (GOALKICK-03/D-17, gap-closure plan 37-17)', () => {
  function goalKickRestartState() {
    return {
      ...mockMovementState,
      phase: 'PASS' as const,
      activeTeam: 'home' as const,
      lastActionType: 'GOAL_KICK_RESTART' as const,
    };
  }

  beforeEach(() => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: { ...mockMovementState, phase: 'MOVE', activeTeam: 'home' },
      selectedPieceId: null,
      lastMovedPieceId: null,
      selectedPassType: null,
      validPassTargetHexes: [],
      interceptionRiskHexes: [],
      passTargetHex: null,
    });
  });

  it('auto-selects STANDARD_PASS with populated valid targets on the acting (home) client', () => {
    useGameStore.setState({ playerSlot: 1 });
    useGameStore.getState().setGameState(goalKickRestartState());
    const state = useGameStore.getState();
    expect(state.selectedPassType).toBe('STANDARD_PASS');
    expect(state.validPassTargetHexes.length).toBeGreaterThan(0);
  });

  it('leaves selectedPassType null and validPassTargetHexes empty on the opposing (away) client', () => {
    useGameStore.setState({ playerSlot: 2 });
    useGameStore.getState().setGameState(goalKickRestartState());
    const state = useGameStore.getState();
    expect(state.selectedPassType).toBeNull();
    expect(state.validPassTargetHexes).toEqual([]);
  });

  it('leaves selectedPassType null when playerSlot is null (no silent team coercion)', () => {
    useGameStore.setState({ playerSlot: null });
    useGameStore.getState().setGameState(goalKickRestartState());
    expect(useGameStore.getState().selectedPassType).toBeNull();
  });

  it('does not auto-select for a multi-member eligible set (THROW_IN_MOVEMENT_1)', () => {
    useGameStore.setState({ playerSlot: 1 });
    useGameStore.getState().setGameState({
      ...mockMovementState,
      phase: 'PASS',
      activeTeam: 'home',
      lastActionType: 'THROW_IN_MOVEMENT_1',
    });
    expect(useGameStore.getState().selectedPassType).toBeNull();
  });

  it('does not auto-select and does not throw for an empty eligible set (SNAPSHOT)', () => {
    useGameStore.setState({ playerSlot: 1 });
    expect(() =>
      useGameStore.getState().setGameState({
        ...mockMovementState,
        phase: 'PASS',
        activeTeam: 'home',
        lastActionType: 'SNAPSHOT',
      }),
    ).not.toThrow();
    expect(useGameStore.getState().selectedPassType).toBeNull();
  });

  it('does not auto-select and does not throw for an empty eligible set (SHOT)', () => {
    useGameStore.setState({ playerSlot: 1 });
    expect(() =>
      useGameStore.getState().setGameState({
        ...mockMovementState,
        phase: 'PASS',
        activeTeam: 'home',
        lastActionType: 'SHOT',
      }),
    ).not.toThrow();
    expect(useGameStore.getState().selectedPassType).toBeNull();
  });

  it('treats a null lastActionType as MOVEMENT_PHASE (multi-member) and does not auto-select', () => {
    useGameStore.setState({ playerSlot: 1 });
    useGameStore.getState().setGameState({
      ...mockMovementState,
      phase: 'PASS',
      activeTeam: 'home',
      lastActionType: null,
    });
    expect(useGameStore.getState().selectedPassType).toBeNull();
  });

  it('produces identical validPassTargetHexes/interceptionRiskHexes/passTargetHex to an explicit setSelectedPassType call', () => {
    useGameStore.setState({ playerSlot: 1 });
    useGameStore.getState().setGameState(goalKickRestartState());
    const autoState = useGameStore.getState();
    const autoTargets = autoState.validPassTargetHexes;
    const autoRisk = autoState.interceptionRiskHexes;
    const autoPassTargetHex = autoState.passTargetHex;

    // Reset selection state (gameState/playerSlot unchanged) and explicitly select the same
    // pass type via the real action — this is the code path D-17-03 requires the auto-selection
    // to reuse, so the two outcomes must be identical.
    useGameStore.setState({
      selectedPassType: null,
      validPassTargetHexes: [],
      interceptionRiskHexes: [],
      passTargetHex: null,
    });
    useGameStore.getState().setSelectedPassType('STANDARD_PASS');
    const explicitState = useGameStore.getState();

    expect(autoTargets).toEqual(explicitState.validPassTargetHexes);
    expect(autoRisk).toEqual(explicitState.interceptionRiskHexes);
    expect(autoPassTargetHex).toBe(explicitState.passTargetHex);
  });
});

// Phase 46 / CLEANUP-05 (folded todo 2026-08-23-ux-no-auto-reselect-after-interrupt-prompt-resumes.md):
// resuming from any of the four interrupt/prompt phases back into MOVE must re-select the
// mid-move piece (still holding pace, not yet in movedPieceIds) and restore its movement ring,
// gated to the owning client only. Every other phase transition must keep clearing exactly as
// before (negative control).
describe('useGameStore — setGameState interrupt-resume auto-reselect (Phase 46 / CLEANUP-05)', () => {
  const INTERRUPT_PHASES: GamePhase[] = [
    'TACKLE_STEAL_PROMPT',
    'GK_DIVE_AT_FEET_PROMPT',
    'GK_BOX_ENTRY_PROMPT',
    'FOUL_CHOICE',
  ];
  const MID_MOVE_PIECE_ID = 'home-8';

  /** Prior state: mid-duel/prompt phase, home team active/attacking. */
  function priorInterruptState(phase: GamePhase) {
    return {
      ...mockMovementState,
      phase,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
    };
  }

  /** Resumed MOVE broadcast — home-8's pace bumped to 6 so a 2-hex partial move still leaves it selectable. */
  function resumedMoveState(overrides: {
    paceUsedByPieceId?: Record<string, number>;
    movedPieceIds?: string[];
    activeTeam?: 'home' | 'away';
  }) {
    const pieces = mockMovementState.pieces.map((p) =>
      p.id === MID_MOVE_PIECE_ID ? { ...p, pace: 6 } : p,
    );
    return {
      ...mockMovementState,
      pieces,
      phase: 'MOVE' as const,
      activeTeam: overrides.activeTeam ?? ('home' as const),
      attackingTeam: 'home' as const,
      movementSlot: 'ATTACKER_4' as const,
      paceUsedByPieceId: overrides.paceUsedByPieceId ?? { [MID_MOVE_PIECE_ID]: 2 },
      movedPieceIds: overrides.movedPieceIds ?? [],
    };
  }

  describe.each(INTERRUPT_PHASES)(
    'Test 1/2: resuming from %s back into MOVE with a mid-move piece holding pace',
    (prevPhase) => {
      it('re-selects the mid-move piece and restores its movement ring', () => {
        useGameStore.setState({
          playerSlot: 1,
          selectedPieceId: null,
          validMoveHexes: [],
          gameState: priorInterruptState(prevPhase),
        });
        useGameStore.getState().setGameState(resumedMoveState({}));
        const state = useGameStore.getState();
        expect(state.selectedPieceId).toBe(MID_MOVE_PIECE_ID);
        expect(state.validMoveHexes.length).toBeGreaterThan(0);
      });
    },
  );

  it('Test 3: no piece mid-move (paceUsedByPieceId empty) leaves selection cleared — nothing to resume', () => {
    useGameStore.setState({
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      gameState: priorInterruptState('TACKLE_STEAL_PROMPT'),
    });
    useGameStore.getState().setGameState(resumedMoveState({ paceUsedByPieceId: {} }));
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('Test 4: a piece whose activation already finished (in movedPieceIds) is not re-selected', () => {
    useGameStore.setState({
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      gameState: priorInterruptState('TACKLE_STEAL_PROMPT'),
    });
    useGameStore.getState().setGameState(
      resumedMoveState({
        paceUsedByPieceId: { [MID_MOVE_PIECE_ID]: 2 },
        movedPieceIds: [MID_MOVE_PIECE_ID],
      }),
    );
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
  });

  it('Test 5 (negative control): an ordinary non-interrupt phase change (MOVE -> PASS) still clears selection exactly as before', () => {
    useGameStore.setState({
      playerSlot: 1,
      selectedPieceId: MID_MOVE_PIECE_ID,
      validMoveHexes: [{ q: 1, r: 1 }],
      tackleRiskHexes: [{ q: 1, r: 1 }],
      lastMovedPieceId: MID_MOVE_PIECE_ID,
      selectedPassType: 'STANDARD_PASS',
      passTargetHex: { q: 2, r: 2 },
      shootingMode: true,
      gameState: { ...mockMovementState, phase: 'MOVE', activeTeam: 'home', attackingTeam: 'home' },
    });
    useGameStore.getState().setGameState({
      ...mockMovementState,
      phase: 'PASS',
      activeTeam: 'home',
      attackingTeam: 'home',
    });
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
    expect(state.tackleRiskHexes).toEqual([]);
    expect(state.lastMovedPieceId).toBeNull();
    expect(state.selectedPassType).toBeNull();
    expect(state.passTargetHex).toBeNull();
    expect(state.shootingMode).toBe(false);
  });

  it('Test 6: the re-selected piece must belong to newState.activeTeam — a mid-move opponent piece is never auto-selected', () => {
    useGameStore.setState({
      // playerSlot 2 (away) would make deriveMyTeam match the opponent piece's team below if the
      // derivation incorrectly keyed off the acting client's team instead of newState.activeTeam.
      playerSlot: 2,
      selectedPieceId: null,
      validMoveHexes: [],
      gameState: priorInterruptState('TACKLE_STEAL_PROMPT'),
    });
    // activeTeam is 'home', but the only piece with pace used is an AWAY piece — no HOME piece
    // qualifies, so nothing should be re-selected regardless of which client is watching.
    useGameStore.getState().setGameState(
      resumedMoveState({
        paceUsedByPieceId: { 'away-8': 2 },
        activeTeam: 'home',
      }),
    );
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('a client whose own team differs from the mid-move piece never gets it auto-selected (T-46-02-I)', () => {
    useGameStore.setState({
      playerSlot: 2, // away client, but the mid-move piece (home-8) belongs to home
      selectedPieceId: null,
      validMoveHexes: [],
      gameState: priorInterruptState('TACKLE_STEAL_PROMPT'),
    });
    useGameStore.getState().setGameState(resumedMoveState({}));
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });

  it('a null playerSlot (spectator/unassigned) falls through to the ordinary clearing behaviour', () => {
    useGameStore.setState({
      playerSlot: null,
      selectedPieceId: null,
      validMoveHexes: [],
      gameState: priorInterruptState('TACKLE_STEAL_PROMPT'),
    });
    useGameStore.getState().setGameState(resumedMoveState({}));
    const state = useGameStore.getState();
    expect(state.selectedPieceId).toBeNull();
    expect(state.validMoveHexes).toEqual([]);
  });
});
