import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { HexGrid } from './HexGrid.js';

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

// Carrier (home-9) sits at {q:14, r:13} in mockMovementState. We place a single defender
// adjacent to a candidate valid-move hex to drive zoiRiskSet through getZoIDefenders.
const CARRIER_ID = 'home-9';
const CARRIER_POS = { q: 14, r: 13 };
// {q:15, r:13} is hexDistance===1 from the carrier — a plausible valid-move destination.
const CANDIDATE_HEX = { q: 15, r: 13 };
// {q:16, r:13} is hexDistance===1 from CANDIDATE_HEX — a defender placed here projects ZoI onto it.
const DEFENDER_POS = { q: 16, r: 13 };

function baseStateWithDefender(defenderId: string, stealAttemptedByIds: string[] = []) {
  const pieces = mockMovementState.pieces.map((p) => {
    if (p.id === CARRIER_ID) return { ...p, position: CARRIER_POS };
    if (p.id === defenderId) return { ...p, position: DEFENDER_POS };
    return p;
  });
  return {
    ...mockMovementState,
    pieces,
    ball: { position: CARRIER_POS, carrierId: CARRIER_ID },
    stealAttemptedByIds,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: { ...mockMovementState },
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    tackleRiskHexes: [],
    playerSlot: 1,
    roomCode: 'ABC12',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

/** Finds risk-tinted polygons (fill matches the 'risk' highlight color) at the candidate hex. */
function countRiskPolygons(container: HTMLElement): number {
  return Array.from(container.querySelectorAll('polygon')).filter(
    (p) => p.getAttribute('fill') === 'rgba(255,140,0,1)',
  ).length;
}

// Gap closure plan 10: regular-shot goal-line highlight must match the server's D-09
// 11-hex range gate (applyDeclareShot). Shooter at {q:11,r:5}, attackingTeam='away'
// (goalQ=0): goal hexes (0,10) and (0,11) are exactly 11 hexes away (IN range);
// (0,12)-(0,16) are 12-16 hexes away (OUT of range). Verified via hexDistance calc.
const SHOOTER_ID = 'away-9';
const SHOOTER_POS = { q: 11, r: 5 };

function shootingModeStateWithShooterAt(pos: { q: number; r: number }) {
  const pieces = mockMovementState.pieces.map((p) =>
    p.id === SHOOTER_ID ? { ...p, position: pos } : p,
  );
  return {
    ...mockMovementState,
    phase: 'PASS' as const,
    attackingTeam: 'away' as const,
    activeTeam: 'away' as const,
    pieces,
    ball: { position: pos, carrierId: SHOOTER_ID },
  };
}

/**
 * Returns true if at least one goal-tinted polygon (highlightType='goal' fill color from
 * HIGHLIGHT_STYLES in HexCell.tsx) is present. Used as a presence check, not per-hex —
 * goalTintedCount (below) is used where exact per-hex counting matters.
 */
function hasGoalTintAt(container: HTMLElement): boolean {
  const goalFill = 'rgba(220,50,50,1)'; // HIGHLIGHT_STYLES.goal fill — see HexCell.tsx
  return Array.from(container.querySelectorAll('polygon')).some(
    (p) => p.getAttribute('fill') === goalFill,
  );
}

describe('HexGrid — gap closure plan 10: regular-shot highlight matches D-09 11-hex range gate', () => {
  it('does NOT highlight any goal hex as a shot target when shooter is out of range of all of them (regression baseline)', () => {
    // Shooter far enough that even the closest goal hex is out of range — sanity check that the
    // highlight is range-gated at all (pre-fix this test fails because the old code highlights
    // every goal hex unconditionally whenever shootingMode is true).
    const FAR_POS = { q: 18, r: 13 }; // centre — closest goal hex (0,13) is 18 away, out of range
    const state = shootingModeStateWithShooterAt(FAR_POS);
    useGameStore.setState({
      gameState: state,
      shootingMode: true,
      playerSlot: 2, // away
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasGoalTintAt(container)).toBe(false);
  });

  it('highlights a goal hex within 11 hexes of the shooter as a shot target', () => {
    const state = shootingModeStateWithShooterAt(SHOOTER_POS);
    useGameStore.setState({
      gameState: state,
      shootingMode: true,
      playerSlot: 2, // away — isActivePlayer requires myTeam === activeTeam
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasGoalTintAt(container)).toBe(true);
  });

  it('does NOT highlight a goal hex 12+ hexes from the shooter (reported bug regression coverage)', () => {
    const state = shootingModeStateWithShooterAt(SHOOTER_POS);
    useGameStore.setState({
      gameState: state,
      shootingMode: true,
      playerSlot: 2,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    // Count total goal-tinted polygons — with the bug, all 7 goal-line hexes light up.
    // With the fix, only (0,10) and (0,11) (distance 11) should be tinted — 2 hexes.
    const goalFill = 'rgba(220,50,50,1)';
    const goalTintedCount = Array.from(container.querySelectorAll('polygon')).filter(
      (p) => p.getAttribute('fill') === goalFill,
    ).length;
    expect(goalTintedCount).toBe(2);
  });

  it('SNAPSHOT_TARGET 6-hex gate is unchanged (no regression)', () => {
    // Shooter at (2,8): hexDistance to goal(0,r) for r=10..16 is [3,4,5,6,7,8,9] — verified via
    // hexDistance calc. 4 hexes (10,11,12,13) are within 6; 3 hexes (14,15,16) are out of range.
    const SNAP_SHOOTER_POS = { q: 2, r: 8 };
    const pieces = mockMovementState.pieces.map((p) =>
      p.id === SHOOTER_ID ? { ...p, position: SNAP_SHOOTER_POS } : p,
    );
    const state = {
      ...mockMovementState,
      phase: 'SNAPSHOT_TARGET' as const,
      attackingTeam: 'away' as const,
      activeTeam: 'away' as const,
      pieces,
      ball: { position: SNAP_SHOOTER_POS, carrierId: SHOOTER_ID },
    };
    useGameStore.setState({
      gameState: state,
      shootingMode: false,
      playerSlot: 2,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    const goalFill = 'rgba(220,50,50,1)';
    const goalTintedCount = Array.from(container.querySelectorAll('polygon')).filter(
      (p) => p.getAttribute('fill') === goalFill,
    ).length;
    expect(goalTintedCount).toBe(4);
  });
});

describe('HexGrid — D-02 gap closure: zoiRiskSet excludes stealAttemptedByIds defenders', () => {
  it('suppresses steal-risk tint when the only adjacent defender is in stealAttemptedByIds', () => {
    const defenderId = 'away-9'; // away FWD 2, distinct from any other away piece used elsewhere
    const state = baseStateWithDefender(defenderId, [defenderId]);
    useGameStore.setState({
      gameState: state,
      selectedPieceId: CARRIER_ID,
      validMoveHexes: [CANDIDATE_HEX],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(countRiskPolygons(container)).toBe(0);
  });

  it('keeps steal-risk tint when the adjacent defender is NOT in stealAttemptedByIds (regression guard)', () => {
    const defenderId = 'away-9';
    const state = baseStateWithDefender(defenderId, []); // not excluded
    useGameStore.setState({
      gameState: state,
      selectedPieceId: CARRIER_ID,
      validMoveHexes: [CANDIDATE_HEX],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(countRiskPolygons(container)).toBeGreaterThan(0);
  });

  it('keeps steal-risk tint when one of two adjacent defenders is excluded and the other is not', () => {
    // Second defender placed at another hex adjacent to CANDIDATE_HEX ({q:15,r:14} per axial adjacency).
    const excludedDefenderId = 'away-9';
    const otherDefenderId = 'away-8';
    const SECOND_DEFENDER_POS = { q: 15, r: 14 };
    const pieces = mockMovementState.pieces.map((p) => {
      if (p.id === CARRIER_ID) return { ...p, position: CARRIER_POS };
      if (p.id === excludedDefenderId) return { ...p, position: DEFENDER_POS };
      if (p.id === otherDefenderId) return { ...p, position: SECOND_DEFENDER_POS };
      return p;
    });
    const state = {
      ...mockMovementState,
      pieces,
      ball: { position: CARRIER_POS, carrierId: CARRIER_ID },
      stealAttemptedByIds: [excludedDefenderId],
    };
    useGameStore.setState({
      gameState: state,
      selectedPieceId: CARRIER_ID,
      validMoveHexes: [CANDIDATE_HEX],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(countRiskPolygons(container)).toBeGreaterThan(0);
  });
});
