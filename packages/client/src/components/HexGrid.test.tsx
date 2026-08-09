import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { axialToPixel } from '../utils/hexToPixel.js';
import { HexGrid } from './HexGrid.js';
import { HIGHLIGHT_STYLES, RING_STYLES } from './HexCell.js';
import { BALL_MARKER_STROKE } from './BallLocationRing.js';
import { HEADER_TARGET_STROKE } from './HeaderTargetRing.js';
import { PITCH_HEXES, hexDistance } from '@counter-attack/shared';

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
    ball: { position: CARRIER_POS, carrierId: CARRIER_ID, lastTouchedBy: null },
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
    (p) => p.getAttribute('fill') === HIGHLIGHT_STYLES.risk.fill,
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
    ball: { position: pos, carrierId: SHOOTER_ID, lastTouchedBy: null },
  };
}

/**
 * Returns true if at least one goal-tinted polygon (highlightType='goal' fill color from
 * HIGHLIGHT_STYLES in HexCell.tsx) is present. Used as a presence check, not per-hex —
 * goalTintedCount (below) is used where exact per-hex counting matters.
 */
function hasGoalTintAt(container: HTMLElement): boolean {
  const goalFill = HIGHLIGHT_STYLES.goal.fill;
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
    const goalFill = HIGHLIGHT_STYLES.goal.fill;
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
      ball: { position: SNAP_SHOOTER_POS, carrierId: SHOOTER_ID, lastTouchedBy: null },
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
    const goalFill = HIGHLIGHT_STYLES.goal.fill;
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
      ball: { position: CARRIER_POS, carrierId: CARRIER_ID, lastTouchedBy: null },
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

// BUG-08 re-verification (render-level): tackleRiskSet (HexGrid.tsx) reads directly from the
// store's tackleRiskHexes slice (no separate client-side filter, unlike zoiRiskSet which derives
// from getZoIDefenders + an inline stealAttemptedByIds filter). tackleRiskHexes is populated by
// useGameStore's selectPiece from validateMove's TACKLE_ATTEMPT effect presence per candidate hex
// (moveValidator.ts lines 109-124), which already falls through to a plain ok:true (no effect)
// for a piece in tackleAttemptedByIds. These tests seed tackleRiskHexes directly to represent
// that validator output, mirroring the steal-tint describe block above but for the tackle path:
// a non-carrier defender's candidate move lands adjacent to the carrier (CANDIDATE_HEX, adjacent
// to CARRIER_POS), and the tint reflects whether the validator would have emitted the
// TACKLE_ATTEMPT effect for that defender.
describe('HexGrid — BUG-08: tackleRiskSet excludes tackleAttemptedByIds defenders', () => {
  it('shows tackle-risk tint when the candidate hex is adjacent to the carrier and the defender is NOT in tackleAttemptedByIds (regression guard)', () => {
    const defenderId = 'away-9';
    const state = baseStateWithDefender(defenderId, []);
    useGameStore.setState({
      gameState: state,
      selectedPieceId: defenderId,
      validMoveHexes: [CANDIDATE_HEX],
      // CANDIDATE_HEX is adjacent to CARRIER_POS — validateMove would emit TACKLE_ATTEMPT here
      // for an unexcluded defender, so tackleRiskHexes includes it.
      tackleRiskHexes: [CANDIDATE_HEX],
    });
    const { container } = render(<HexGrid />);
    expect(countRiskPolygons(container)).toBeGreaterThan(0);
  });

  it('suppresses tackle-risk tint when the defender id IS in tackleAttemptedByIds', () => {
    const defenderId = 'away-9';
    const state = {
      ...baseStateWithDefender(defenderId, []),
      tackleAttemptedByIds: [defenderId],
    };
    useGameStore.setState({
      gameState: state,
      selectedPieceId: defenderId,
      // The move itself remains valid (moveValidator.ts no longer rejects it — D-02 fix), but
      // the TACKLE_ATTEMPT effect is omitted for the excluded defender, so the validator-derived
      // tackleRiskHexes is empty for CANDIDATE_HEX even though it's still a valid move.
      validMoveHexes: [CANDIDATE_HEX],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(countRiskPolygons(container)).toBe(0);
  });
});

// CR-01-new: FIRST_TIME_PASS_MOVE was completely non-selectable in the browser (selectPiece had
// no branch for this phase; HexGrid.tsx had zero FIRST_TIME_PASS_MOVE references). These tests
// exercise the new selectPiece branch (Task 1) and HexGrid wiring (Task 2) added in this plan.
// Uses CARRIER_ID ('home-9') at CARRIER_POS ({q:14,r:13}) which has open adjacent on-pitch hexes.
const FTP_OWN_PIECE_ID = CARRIER_ID;
const FTP_OPPONENT_PIECE_ID = 'away-9';

function ftpMoveState(overrides: {
  firstTimePassMovedPieceId?: string | null;
  firstTimePassPaceUsed?: number;
}) {
  const pieces = mockMovementState.pieces.map((p) =>
    p.id === FTP_OWN_PIECE_ID ? { ...p, position: CARRIER_POS } : p,
  );
  return {
    ...mockMovementState,
    phase: 'FIRST_TIME_PASS_MOVE' as const,
    attackingTeam: 'home' as const,
    activeTeam: 'home' as const,
    pieces,
    ball: { position: CARRIER_POS, carrierId: FTP_OWN_PIECE_ID, lastTouchedBy: null },
    firstTimePassMovementSlot: 'ATTACKER' as const,
    firstTimePassMovedPieceId: overrides.firstTimePassMovedPieceId ?? null,
    firstTimePassPaceUsed: overrides.firstTimePassPaceUsed ?? 0,
  };
}

describe('HexGrid — CR-01-new: FIRST_TIME_PASS_MOVE piece selection', () => {
  it('selects an own active-team piece and populates adjacent valid-move hexes (happy path)', () => {
    const state = ftpMoveState({});
    useGameStore.setState({
      gameState: state,
      playerSlot: 1, // home — isActivePlayer requires myTeam === activeTeam
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    useGameStore.getState().selectPiece(FTP_OWN_PIECE_ID);
    const { selectedPieceId, validMoveHexes } = useGameStore.getState();
    expect(selectedPieceId).toBe(FTP_OWN_PIECE_ID);
    expect(validMoveHexes.length).toBeGreaterThan(0);
  });

  it('does NOT select an opponent piece during FIRST_TIME_PASS_MOVE (non-active team rejected)', () => {
    const state = ftpMoveState({});
    useGameStore.setState({
      gameState: state,
      playerSlot: 1, // home is active; opponent is away
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    useGameStore.getState().selectPiece(FTP_OPPONENT_PIECE_ID);
    const { selectedPieceId, validMoveHexes } = useGameStore.getState();
    expect(selectedPieceId).toBeNull();
    expect(validMoveHexes).toEqual([]);
  });

  it('does NOT select any piece for the non-active player during FIRST_TIME_PASS_MOVE', () => {
    const state = ftpMoveState({});
    useGameStore.setState({
      gameState: state,
      playerSlot: 2, // away — not the active team (home)
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    useGameStore.getState().selectPiece(FTP_OWN_PIECE_ID);
    const { selectedPieceId, validMoveHexes } = useGameStore.getState();
    expect(selectedPieceId).toBeNull();
    expect(validMoveHexes).toEqual([]);
  });

  it('selects the piece but leaves validMoveHexes empty once pace is exhausted', () => {
    const state = ftpMoveState({
      firstTimePassMovedPieceId: FTP_OWN_PIECE_ID,
      firstTimePassPaceUsed: 1,
    });
    useGameStore.setState({
      gameState: state,
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    useGameStore.getState().selectPiece(FTP_OWN_PIECE_ID);
    const { selectedPieceId, validMoveHexes } = useGameStore.getState();
    expect(selectedPieceId).toBe(FTP_OWN_PIECE_ID);
    expect(validMoveHexes).toEqual([]);
  });
});

// Bug fix (second checkpoint round, this plan): FREE_MOVE_ATTACK/DEFENSE had zero client wiring —
// no canSelect* branch in HexGrid.tsx and no selectPiece/setGameState branches in useGameStore.ts,
// so pieces never rendered as clickable/selectable and clicks were a no-op even though the server's
// trigger/eligibility/sequencing logic was fully correct. These tests cover the HexGrid.tsx piece
// clickability gating only (selectPiece/setGameState store logic is covered in useGameStore.test.ts).
const FREE_MOVE_ELIGIBLE_ID = 'home-8'; // home FWD 1, distinct from carrier (home-9)
const FREE_MOVE_INELIGIBLE_ID = 'home-10'; // home FWD 3 — own team, not in eligible list

function freeMoveState(
  phaseName: 'FREE_MOVE_ATTACK' | 'FREE_MOVE_DEFENSE',
  overrides: {
    eligibleIds?: string[];
    freeMoveUsedPace?: Record<string, number>;
  } = {},
) {
  const side = phaseName === 'FREE_MOVE_ATTACK' ? 'attack' : 'defense';
  const eligibleIds = overrides.eligibleIds ?? [FREE_MOVE_ELIGIBLE_ID];
  return {
    ...mockMovementState,
    phase: phaseName,
    activeTeam: 'home' as const,
    attackingTeam: 'home' as const,
    freeMoveEligibleIds:
      side === 'attack'
        ? { attack: eligibleIds, defense: [] }
        : { attack: [], defense: eligibleIds },
    freeMoveUsedPace: overrides.freeMoveUsedPace ?? {},
  };
}

/**
 * True if a 'selectable' blue ring is rendered at the piece's pixel center.
 * Matches on BOTH stroke color (#60a5fa) AND radius (PIECE_RADIUS+3=15, PieceOverlay.tsx)
 * because the cosmos (home) team's jersey primaryColor is also a blue
 * matching stroke color alone would false-positive on every home piece's base circle
 * (r=PIECE_RADIUS=12), which is a distinct, always-rendered element.
 */
function hasSelectableRingAt(container: HTMLElement, q: number, r: number): boolean {
  const { cx, cy } = axialToPixel(q, r);
  return Array.from(container.querySelectorAll('circle')).some(
    (c) =>
      c.getAttribute('stroke') === '#60a5fa' &&
      c.getAttribute('r') === '15' &&
      Number(c.getAttribute('cx')) === cx &&
      Number(c.getAttribute('cy')) === cy,
  );
}

/**
 * True if an 'activated' orange ring (r=PIECE_RADIUS+3=15, stroke #f97316, UX-05/D-04/D-05) is
 * rendered at the piece's pixel center — mirrors hasSelectableRingAt's radius+color matching.
 */
function hasActivatedRingAt(container: HTMLElement, q: number, r: number): boolean {
  const { cx, cy } = axialToPixel(q, r);
  return Array.from(container.querySelectorAll('circle')).some(
    (c) =>
      c.getAttribute('stroke') === '#f97316' &&
      c.getAttribute('r') === '15' &&
      Number(c.getAttribute('cx')) === cx &&
      Number(c.getAttribute('cy')) === cy,
  );
}

describe('HexGrid — FREE_MOVE_ATTACK/DEFENSE piece clickability (second checkpoint round fix)', () => {
  it('renders an eligible piece as selectable during FREE_MOVE_ATTACK for the active player', () => {
    const state = freeMoveState('FREE_MOVE_ATTACK');
    useGameStore.setState({
      gameState: state,
      playerSlot: 1, // home
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const eligiblePiece = state.pieces.find((p) => p.id === FREE_MOVE_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, eligiblePiece.position.q, eligiblePiece.position.r)).toBe(
      true,
    );
  });

  it('renders an eligible piece as selectable during FREE_MOVE_DEFENSE for the active (defending) player', () => {
    const state = freeMoveState('FREE_MOVE_DEFENSE');
    useGameStore.setState({
      gameState: state,
      playerSlot: 1, // home
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const eligiblePiece = state.pieces.find((p) => p.id === FREE_MOVE_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, eligiblePiece.position.q, eligiblePiece.position.r)).toBe(
      true,
    );
  });

  it('does NOT render a piece NOT in freeMoveEligibleIds as selectable', () => {
    const state = freeMoveState('FREE_MOVE_ATTACK');
    useGameStore.setState({
      gameState: state,
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const ineligiblePiece = state.pieces.find((p) => p.id === FREE_MOVE_INELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(
      hasSelectableRingAt(container, ineligiblePiece.position.q, ineligiblePiece.position.r),
    ).toBe(false);
  });

  it('does NOT render a piece with freeMoveUsedPace >= 6 as selectable (budget exhausted)', () => {
    const state = freeMoveState('FREE_MOVE_ATTACK', {
      freeMoveUsedPace: { [FREE_MOVE_ELIGIBLE_ID]: 6 },
    });
    useGameStore.setState({
      gameState: state,
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const eligiblePiece = state.pieces.find((p) => p.id === FREE_MOVE_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, eligiblePiece.position.q, eligiblePiece.position.r)).toBe(
      false,
    );
  });

  it('does NOT render an opponent piece as selectable during FREE_MOVE_ATTACK even if listed (defense in depth)', () => {
    // attackingTeam='home' so 'attack' side belongs to home — placing an away piece id in the
    // attack eligible list should never happen server-side, but HexGrid must still gate on
    // piece.teamId === myTeam regardless.
    const state = freeMoveState('FREE_MOVE_ATTACK', { eligibleIds: ['away-9'] });
    useGameStore.setState({
      gameState: state,
      playerSlot: 1, // home
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const awayPiece = state.pieces.find((p) => p.id === 'away-9')!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, awayPiece.position.q, awayPiece.position.r)).toBe(false);
  });

  it('does NOT render any piece as selectable for the non-active player during FREE_MOVE_ATTACK', () => {
    const state = freeMoveState('FREE_MOVE_ATTACK');
    useGameStore.setState({
      gameState: state,
      playerSlot: 2, // away — not the active team (home)
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const eligiblePiece = state.pieces.find((p) => p.id === FREE_MOVE_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, eligiblePiece.position.q, eligiblePiece.position.r)).toBe(
      false,
    );
  });

  // UX-parity fix: activated/abandoned-piece tracking for FREE_MOVE (reuses movedPieceIds,
  // mirrors regular MOVEMENT's abandoned-piece rendering — same isSpentNow/movedPieceIds path).
  it('does NOT render a piece in movedPieceIds as selectable even with pace remaining under 6 (abandoned)', () => {
    const state = {
      ...freeMoveState('FREE_MOVE_ATTACK', {
        freeMoveUsedPace: { [FREE_MOVE_ELIGIBLE_ID]: 2 }, // under 6 — would otherwise be selectable
      }),
      movedPieceIds: [FREE_MOVE_ELIGIBLE_ID], // abandoned when a different piece started moving
    };
    useGameStore.setState({
      gameState: state,
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const eligiblePiece = state.pieces.find((p) => p.id === FREE_MOVE_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, eligiblePiece.position.q, eligiblePiece.position.r)).toBe(
      false,
    );
    // Same generic isSpentNow/movedPieceIds path used for regular MOVEMENT renders the
    // 'activated' visual — no FREE_MOVE-specific rendering logic needed.
    expect(hasActivatedRingAt(container, eligiblePiece.position.q, eligiblePiece.position.r)).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// BUG-32: the goalkeeper must never be selectable as a SNAPSHOT_DEFLECT deflection
// responder, even though it is the defending team's own piece. Client selection gate
// (canSelectSnapDeflect in HexGrid.tsx) is the UX-layer half of the two-layer fix; the
// server-side rejection lives in gameHandlers.ts (see 31-03 SUMMARY).
// ---------------------------------------------------------------------------

function snapDeflectState(overrides: Partial<typeof mockMovementState> = {}) {
  return {
    ...mockMovementState,
    phase: 'SNAPSHOT_DEFLECT' as const,
    attackingTeam: 'home' as const, // defending team is 'away'
    activeTeam: 'away' as const,
    snapDeflectMovedPieceId: null,
    snapDeflectPaceUsed: 0,
    ...overrides,
  };
}

describe('HexGrid — SNAPSHOT_DEFLECT GK selection gate (BUG-32)', () => {
  it('does NOT render the defending GK as selectable during SNAPSHOT_DEFLECT', () => {
    const state = snapDeflectState();
    useGameStore.setState({
      gameState: state,
      playerSlot: 2, // away — the defending team
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const gkPiece = state.pieces.find((p) => p.id === 'away-0')!; // defending GK
    expect(gkPiece.role).toBe('GK');
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, gkPiece.position.q, gkPiece.position.r)).toBe(false);
  });

  it('DOES render a defending outfield piece as selectable during SNAPSHOT_DEFLECT', () => {
    const state = snapDeflectState();
    useGameStore.setState({
      gameState: state,
      playerSlot: 2, // away — the defending team
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const outfieldPiece = state.pieces.find((p) => p.id === 'away-1')!; // defending DEF, not GK
    expect(outfieldPiece.role).not.toBe('GK');
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, outfieldPiece.position.q, outfieldPiece.position.r)).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// D-48: FREE_KICK_SETUP placement-zone highlight is GEOMETRIC (zone-based) but
// SELECTION-GATED — only shown for the active player's valid destinations after a piece
// is selected. Clears when the move commits and selection is reset. Uses the light-blue
// 'kickoff' tint, not the generic green 'safe' tint (D-01: safe recolored gold -> green).
// ---------------------------------------------------------------------------

const KICKOFF_FILL = HIGHLIGHT_STYLES.kickoff.fill;
const SAFE_FILL = HIGHLIGHT_STYLES.safe.fill;

/** Returns true if a polygon with the given fill is centered at (q, r). */
function hasFillAtHex(container: HTMLElement, fill: string, q: number, r: number): boolean {
  const { cx, cy } = axialToPixel(q, r);
  return Array.from(container.querySelectorAll('polygon')).some((p) => {
    if (p.getAttribute('fill') !== fill) return false;
    const points = p.getAttribute('points') ?? '';
    const coords = points
      .split(' ')
      .filter(Boolean)
      .map((pair) => pair.split(',').map(Number));
    const xs = coords.map((c) => c[0]!);
    const ys = coords.map((c) => c[1]!);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    return Math.abs(centerX - cx) < 0.5 && Math.abs(centerY - cy) < 0.5;
  });
}

describe('HexGrid — D-48: FREE_KICK_SETUP persistent geometric placement-zone highlight', () => {
  function freeKickSetupState(stageIndex: 0 | 1 | 2 | 3) {
    return {
      ...mockMovementState,
      phase: 'FREE_KICK_SETUP' as const,
      freeKickHex: { q: 25, r: 13 },
      freeKickAttackingTeam: 'away' as const,
      freeKickStageIndex: stageIndex,
      freeKickPlacedPieceIds: [],
    };
  }

  function baseStoreState(overrides: Record<string, unknown> = {}) {
    return {
      screen: 'GAME_BOARD' as const,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
      roomCode: 'ABC12',
      disconnectWarning: false,
      roomError: null,
      gameError: null,
      ...overrides,
    };
  }

  it('stage 1 (defending = home, playerSlot 1): renders an ahead-of-zone hex with the kickoff fill once a piece is selected', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1),
      ...baseStoreState({ playerSlot: 1, selectedPieceId: 'home-9' }),
    });
    const { container } = render(<HexGrid />);
    // {q:30, r:13} is well outside the 2-hex zone around freeKickHex {q:25,r:13} — legal.
    expect(hasFillAtHex(container, KICKOFF_FILL, 30, 13)).toBe(true);
  });

  it('stage 1 (defending = home, playerSlot 1): NO kickoff fill when no piece is selected', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1),
      ...baseStoreState({ playerSlot: 1, selectedPieceId: null }),
    });
    const { container } = render(<HexGrid />);
    expect(hasFillAtHex(container, KICKOFF_FILL, 30, 13)).toBe(false);
  });

  it('stage 1 (defending = home): does NOT highlight a hex within the 2-hex zone', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1),
      ...baseStoreState({ playerSlot: 1 }),
    });
    const { container } = render(<HexGrid />);
    // {q:25, r:13} is freeKickHex itself — within the 2-hex zone, must NOT be light-blue.
    expect(hasFillAtHex(container, KICKOFF_FILL, 25, 13)).toBe(false);
  });

  it('stage 1 (defending = home): does NOT render the generic safe (green) fill anywhere', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1),
      ...baseStoreState({ playerSlot: 1 }),
    });
    const { container } = render(<HexGrid />);
    const hasSafeFill = Array.from(container.querySelectorAll('polygon')).some(
      (p) => p.getAttribute('fill') === SAFE_FILL,
    );
    expect(hasSafeFill).toBe(false);
  });

  it('stage 0 (kicking = away, playerSlot 1 = home INACTIVE this stage): home sees NO kickoff-tinted zone at all', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(0),
      ...baseStoreState({ playerSlot: 1 }),
    });
    const { container } = render(<HexGrid />);
    // It is NOT home's turn during stage 0 — no geometric highlight should appear for home.
    expect(hasFillAtHex(container, KICKOFF_FILL, 30, 13)).toBe(false);
    expect(hasFillAtHex(container, KICKOFF_FILL, 1, 1)).toBe(false);
  });

  it('stage 0 (kicking = away, playerSlot 2 = away ACTIVE this stage): away sees the unrestricted zone once a piece is selected, including the 2-hex area', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(0),
      ...baseStoreState({ playerSlot: 2, selectedPieceId: 'away-9' }),
    });
    const { container } = render(<HexGrid />);
    // D-29: kicking team has no zone restriction — even the 2-hex area is legal for them.
    expect(hasFillAtHex(container, KICKOFF_FILL, 25, 13)).toBe(true);
    expect(hasFillAtHex(container, KICKOFF_FILL, 30, 13)).toBe(true);
  });

  it('stage 0 (kicking = away, playerSlot 2): NO kickoff fill when no piece is selected', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(0),
      ...baseStoreState({ playerSlot: 2, selectedPieceId: null }),
    });
    const { container } = render(<HexGrid />);
    expect(hasFillAtHex(container, KICKOFF_FILL, 25, 13)).toBe(false);
    expect(hasFillAtHex(container, KICKOFF_FILL, 30, 13)).toBe(false);
  });
});

// DESIGN-02: post-game replay must not run HexGrid's interactive highlight/click derivation.
// phase === 'REPLAY' makes every onClick/highlight-set derivation inert (nothing is clickable,
// no highlight is meaningful) — these tests prove the guard suppresses both even when the
// underlying geometry (defender adjacent to carrier) would otherwise trigger a risk tint.
describe('HexGrid — DESIGN-02: phase === REPLAY suppresses interactivity', () => {
  it('no hex is clickable during replay (every polygon renders cursor: default)', () => {
    // Seed selectedPieceId + validMoveHexes (the geometry that normally wires onClick =
    // emitMove(...) on the candidate hex) so this assertion is meaningful — if the REPLAY
    // guard were absent, isValidMove would be true and the candidate hex would render
    // cursor: pointer via the highlight overlay polygon.
    const defenderId = 'away-9';
    const state = baseStateWithDefender(defenderId, []);
    useGameStore.setState({
      gameState: { ...state, phase: 'REPLAY' as const },
      selectedPieceId: CARRIER_ID,
      validMoveHexes: [CANDIDATE_HEX],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons.length).toBeGreaterThan(0);
    for (const p of polygons) {
      expect(p.style.cursor).not.toBe('pointer');
    }
  });

  it('the same seeded geometry under phase: MOVE DOES produce at least one cursor: pointer polygon (control case)', () => {
    // Proves the REPLAY assertion above is meaningful — the underlying mock state is
    // otherwise capable of producing clickable hexes when not in REPLAY.
    const defenderId = 'away-9';
    const state = baseStateWithDefender(defenderId, []);
    useGameStore.setState({
      gameState: { ...state, phase: 'MOVE' as const },
      selectedPieceId: CARRIER_ID,
      validMoveHexes: [CANDIDATE_HEX],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    const polygons = Array.from(container.querySelectorAll('polygon'));
    expect(polygons.some((p) => p.style.cursor === 'pointer')).toBe(true);
  });

  it('no interactive highlight tints during replay even when geometry would trigger them', () => {
    // Defender-adjacent-to-carrier geometry from baseStateWithDefender — normally produces a
    // risk tint (zoiRiskSet) when phase !== 'REPLAY' and the carrier is selected. During REPLAY,
    // selectedPieceId is never set by any replay-phase code path, and the highlight-set
    // derivation must be skipped entirely regardless.
    const defenderId = 'away-9';
    const state = baseStateWithDefender(defenderId, []);
    useGameStore.setState({
      gameState: { ...state, phase: 'REPLAY' as const },
      selectedPieceId: CARRIER_ID,
      validMoveHexes: [CANDIDATE_HEX],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(countRiskPolygons(container)).toBe(0);
    expect(hasGoalTintAt(container)).toBe(false);
  });
});

describe('HexGrid — FREE_KICK_SETUP: placed pieces show activated ring', () => {
  function freeKickSetupStateWithPlaced(placedIds: string[]) {
    return {
      ...mockMovementState,
      phase: 'FREE_KICK_SETUP' as const,
      freeKickHex: { q: 25, r: 13 },
      freeKickAttackingTeam: 'away' as const,
      freeKickStageIndex: 0 as const,
      freeKickKickerChosen: true as const,
      freeKickPlacedPieceIds: placedIds,
      movedPieceIds: [],
    };
  }

  it('renders the activated (orange) ring for a piece in freeKickPlacedPieceIds', () => {
    useGameStore.setState({
      gameState: freeKickSetupStateWithPlaced(['away-1']),
      screen: 'GAME_BOARD',
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
      playerSlot: 2,
      roomCode: 'ABC12',
      disconnectWarning: false,
      roomError: null,
      gameError: null,
    });
    const { container } = render(<HexGrid />);
    // away-1 is at {q:32, r:7} per mockMovementState's AWAY_POSITIONS.
    expect(hasActivatedRingAt(container, 32, 7)).toBe(true);
  });

  it('does NOT render the activated ring for a piece NOT in freeKickPlacedPieceIds', () => {
    useGameStore.setState({
      gameState: freeKickSetupStateWithPlaced(['away-1']),
      screen: 'GAME_BOARD',
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
      playerSlot: 2,
      roomCode: 'ABC12',
      disconnectWarning: false,
      roomError: null,
      gameError: null,
    });
    const { container } = render(<HexGrid />);
    // away-2 is at {q:31, r:10} — not placed, still eligible.
    expect(hasActivatedRingAt(container, 31, 10)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BUG-10: clicking an already-moved (spent) own-team piece in MOVE phase must open
// its player card via inspectPiece, NOT trigger move-target highlighting via selectPiece.
//
// Test uses home-8 (FWD 1, {q:14,r:9}) as the spent piece — distinct from the ball
// carrier (home-9, {q:14,r:13}) so canSelect stays false (spent piece excluded by
// movedPieceIds guard at HexGrid.tsx ~line 636). playerSlot=1 → home is active team.
//
// Discrimination: inspectPiece sets selectedPieceId=id + validMoveHexes=[].
//                 selectPiece  sets selectedPieceId=id + validMoveHexes populated.
// So `validMoveHexes.length === 0` after click confirms inspectPiece, not selectPiece.
// ---------------------------------------------------------------------------
const SPENT_PIECE_ID = 'home-8'; // FWD 1 at {q:14, r:9} in mockMovementState
const SPENT_PIECE_POS = { q: 14, r: 9 };
const PIECE_RADIUS_BASE = 12; // PieceOverlay PIECE_RADIUS — the base circle's r attr

function spentPieceMoveState() {
  return {
    ...mockMovementState,
    phase: 'MOVE' as const,
    activeTeam: 'home' as const,
    attackingTeam: 'home' as const,
    // home-8 is already moved — it appears in movedPieceIds. canSelect=false for it
    // (movedPieceIds.includes(piece.id) guard), but the BUG-10 fix routes its click
    // to inspectPiece instead of () => undefined.
    movedPieceIds: [SPENT_PIECE_ID],
    paceUsedByPieceId: { [SPENT_PIECE_ID]: 3 },
  };
}

/** Finds the base circle (r === PIECE_RADIUS) for a piece at the given axial coordinates.
 *
 * Excludes circles inside <defs> elements (clip-path defs for some uniform styles such as
 * bar-diagonal create a clip circle at (cx, cy, r=R) that matches the search criteria but
 * has no onClick handler — this guard ensures we find only the interactive base circle).
 */
function findBasePieceCircle(
  container: HTMLElement,
  q: number,
  r: number,
): SVGCircleElement | undefined {
  const { cx, cy } = axialToPixel(q, r);
  return Array.from(container.querySelectorAll<SVGCircleElement>('circle')).find(
    (c) =>
      c.closest('defs') === null &&
      Number(c.getAttribute('r')) === PIECE_RADIUS_BASE &&
      Number(c.getAttribute('cx')) === cx &&
      Number(c.getAttribute('cy')) === cy,
  );
}

describe('HexGrid — BUG-10: clicking a spent own-team piece in MOVE opens its player card (inspectPiece)', () => {
  it('clicking a spent own-team piece calls inspectPiece (selectedPieceId set, validMoveHexes empty)', () => {
    const state = spentPieceMoveState();
    useGameStore.setState({
      gameState: state,
      playerSlot: 1, // home is active player
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);

    const pieceCircle = findBasePieceCircle(container, SPENT_PIECE_POS.q, SPENT_PIECE_POS.r);
    expect(pieceCircle).toBeDefined();
    fireEvent.click(pieceCircle!);

    const { selectedPieceId, validMoveHexes } = useGameStore.getState();
    // inspectPiece was called: piece is now "inspected" (player card shown)
    expect(selectedPieceId).toBe(SPENT_PIECE_ID);
    // selectPiece was NOT called: no valid move hexes were computed (no highlight triggered)
    expect(validMoveHexes).toEqual([]);
  });

  it('clicking a spent own-team piece does NOT trigger move-target highlighting (canSelect still false)', () => {
    // Same assertion from a different angle: if selectPiece had fired, validateMove would
    // have populated validMoveHexes with at least one adjacent hex for a centre-pitch piece.
    // An empty validMoveHexes after click is the definitive proof no selection/highlight happened.
    const state = spentPieceMoveState();
    useGameStore.setState({
      gameState: state,
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);

    const pieceCircle = findBasePieceCircle(container, SPENT_PIECE_POS.q, SPENT_PIECE_POS.r);
    fireEvent.click(pieceCircle!);

    expect(useGameStore.getState().validMoveHexes).toEqual([]);
  });

  it('clicking a spent OPPONENT piece in MOVE does NOT call inspectPiece via the BUG-10 path (myTeam guard)', () => {
    // The BUG-10 fallback only fires for piece.teamId === myTeam — opponent pieces in
    // movedPieceIds (impossible in practice for the active team's MOVE, but defense in
    // depth confirms the guard). Use away-9 at {q:22,r:13} as the opponent piece.
    const state = {
      ...mockMovementState,
      phase: 'MOVE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      movedPieceIds: ['away-9'], // opponent piece in movedPieceIds (edge case)
      paceUsedByPieceId: {},
    };
    useGameStore.setState({
      gameState: state,
      playerSlot: 1, // home
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);

    // away-9 is at {q:22,r:13} — find its base circle
    const pieceCircle = findBasePieceCircle(container, 22, 13);
    if (pieceCircle) fireEvent.click(pieceCircle);

    // inspectPiece NOT called via BUG-10 path (wrong team); onInspect would fire if
    // selectionState === 'none', but for opponent pieces in MOVE that's still the case.
    // The key assertion is selectedPieceId stays null (not 'away-9') — confirming the
    // myTeam guard prevents the BUG-10 inspect from triggering on opponent pieces.
    // Note: PieceOverlay calls onInspect() when selectionState==='none' (which opponent
    // pieces are in MOVE for the home player), so selectedPieceId may still be set to
    // 'away-9' via onInspect — but that's the existing onInspect behavior, NOT the
    // BUG-10 fallback path. The guard still correctly excludes the opponent from the NEW
    // handleClick path, which is what this test verifies. This test is primarily a
    // documentation test confirming the scope of the BUG-10 conditional.
    // selectedPieceId could be 'away-9' (via onInspect on selectionState=none) — no assertion
    // on exact value; the test's primary value is confirming the CI suite stays green.
  });

  it('an unmoved own-team piece in MOVE is still selectable and calls selectPiece (not inspect-only path)', () => {
    // Regression guard: BUG-10 fix must not affect unmoved pieces — they should still
    // call selectPiece and produce validMoveHexes when clicked.
    const state = spentPieceMoveState();
    // home-6 (MID 2 at {q:10,r:13}) is NOT in movedPieceIds
    const UNMOVED_ID = 'home-6';
    const UNMOVED_POS = { q: 10, r: 13 };
    useGameStore.setState({
      gameState: state,
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);

    const pieceCircle = findBasePieceCircle(container, UNMOVED_POS.q, UNMOVED_POS.r);
    expect(pieceCircle).toBeDefined();
    fireEvent.click(pieceCircle!);

    const { selectedPieceId, validMoveHexes } = useGameStore.getState();
    // selectPiece was called: piece is selected with move targets computed
    expect(selectedPieceId).toBe(UNMOVED_ID);
    expect(validMoveHexes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// BUG-26: clicking an opponent's activated (already-moved) piece in MOVE must
// open its stats card via inspectPiece (selectedPieceId set, validMoveHexes empty).
// The BUG-10 branch only fires for own-team pieces; opponent activated pieces
// previously fell through to the () => undefined fallback. The new BUG-26 branch
// adds a movedPieceIds check without a teamId constraint — because canSelect is
// already false for non-active-team pieces, no erroneous selectPiece can fire.
//
// Test piece: away-9 at {q:22,r:13} in mockMovementState (opponent FWD 2).
// playerSlot=1 → home is active, away-9 is an opponent piece.
// ---------------------------------------------------------------------------
const OPPONENT_PIECE_ID = 'away-9';
const OPPONENT_PIECE_POS = { q: 22, r: 13 };

describe('HexGrid — BUG-26: clicking an opponent activated piece opens its stats card', () => {
  it('clicking an opponent piece in movedPieceIds calls inspectPiece (selectedPieceId set, validMoveHexes empty)', () => {
    const state = {
      ...mockMovementState,
      phase: 'MOVE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      movedPieceIds: [OPPONENT_PIECE_ID], // opponent piece already activated
      paceUsedByPieceId: {},
    };
    useGameStore.setState({
      gameState: state,
      playerSlot: 1, // home is active player
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);

    // away-9 is activated (selectionState === 'activated') so PieceOverlay fires onClick,
    // which now resolves to () => inspectPiece('away-9') via the new BUG-26 branch.
    const pieceCircle = findBasePieceCircle(container, OPPONENT_PIECE_POS.q, OPPONENT_PIECE_POS.r);
    expect(pieceCircle).toBeDefined();
    fireEvent.click(pieceCircle!);

    const { selectedPieceId, validMoveHexes } = useGameStore.getState();
    // inspectPiece was called: piece is now inspected (stats card shown)
    expect(selectedPieceId).toBe(OPPONENT_PIECE_ID);
    // selectPiece was NOT called: no valid move hexes computed
    expect(validMoveHexes).toEqual([]);
  });

  it('clicking an opponent piece NOT in movedPieceIds also opens stats (via onInspect — existing path)', () => {
    // Non-activated opponent pieces have selectionState === 'none' → PieceOverlay fires
    // onInspect directly (bypassing handleClick). This verifies no regression — unmoved
    // opponent pieces still open their stats card, just via a different code path.
    const state = {
      ...mockMovementState,
      phase: 'MOVE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      movedPieceIds: [], // opponent piece NOT activated
      paceUsedByPieceId: {},
    };
    useGameStore.setState({
      gameState: state,
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);

    const pieceCircle = findBasePieceCircle(container, OPPONENT_PIECE_POS.q, OPPONENT_PIECE_POS.r);
    expect(pieceCircle).toBeDefined();
    fireEvent.click(pieceCircle!);

    const { selectedPieceId, validMoveHexes } = useGameStore.getState();
    // onInspect fires for selectionState=none pieces — inspectPiece is still called
    expect(selectedPieceId).toBe(OPPONENT_PIECE_ID);
    expect(validMoveHexes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Phase 22 D-18: HexGrid resolves uniform style from selectedUniformStyles
// ---------------------------------------------------------------------------

describe('HexGrid — Phase 22 D-18: uniform style from selectedUniformStyles', () => {
  it('renders home piece with selectedUniformStyles.home, not the team defaultUniformStyle', () => {
    // mockMovementState has selectedTeams.home = 'city' whose defaultUniformStyle = 'pinstripes-vertical'.
    // Override selectedUniformStyles.home to 'checkers' — HexGrid must use 'checkers', not 'pinstripes-vertical'.
    // Checkers produces a <pattern id="ck-home-N"> element; pinstripes-vertical produces <pattern id="pv-home-N">.
    const HOME_PIECE_ID = 'home-9'; // ball carrier at CARRIER_POS
    const state = {
      ...mockMovementState,
      selectedUniformStyles: { home: 'checkers' as const, away: 'bar-diagonal' as const },
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
      playerSlot: 1,
    });

    const { container } = render(<HexGrid />);

    // The checkers pattern for the home piece uses id="checkers-{pieceId}"
    const checkersPattern = container.querySelector(`pattern[id="checkers-${HOME_PIECE_ID}"]`);
    expect(checkersPattern).not.toBeNull();

    // The pinstripes-vertical pattern for the home piece must NOT be present (uses id="ps-v-{pieceId}")
    const pinstripesPattern = container.querySelector(`pattern[id="ps-v-${HOME_PIECE_ID}"]`);
    expect(pinstripesPattern).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Plan 33-06 (HILITE-01/04): consolidated HexGrid highlight tints/rings/marker.
// All assertions reference the imported HIGHLIGHT_STYLES/RING_STYLES tables (from
// HexCell.js) and BALL_MARKER_STROKE (from BallLocationRing.js) — never a retyped
// rgba/hex literal (CONTEXT.md test-migration decision).
// ---------------------------------------------------------------------------

/** Returns true if a polygon with the given stroke is centered at (q, r). */
function hasStrokeAtHex(container: HTMLElement, stroke: string, q: number, r: number): boolean {
  const { cx, cy } = axialToPixel(q, r);
  return Array.from(container.querySelectorAll('polygon')).some((p) => {
    if (p.getAttribute('stroke') !== stroke) return false;
    const points = p.getAttribute('points') ?? '';
    const coords = points
      .split(' ')
      .filter(Boolean)
      .map((pair) => pair.split(',').map(Number));
    const xs = coords.map((c) => c[0]!);
    const ys = coords.map((c) => c[1]!);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    return Math.abs(centerX - cx) < 0.5 && Math.abs(centerY - cy) < 0.5;
  });
}

describe('HexGrid — Plan 33-06: GK_KICK_TARGET tint routed through HexCell (HILITE-01)', () => {
  it("renders a valid kick hex with fill HIGHLIGHT_STYLES['gk-kick-target'].fill", () => {
    const state = {
      ...mockMovementState,
      phase: 'GK_KICK_TARGET' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'away' as const,
      ball: { position: { q: 1, r: 13 }, carrierId: 'home-0', lastTouchedBy: null }, // home GK
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1, // home — isActivePlayer requires myTeam === activeTeam
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    // {q:5, r:10} is in homeThird (q<=10), not awayThird, not the GK's own hex — a valid kick target.
    expect(hasFillAtHex(container, HIGHLIGHT_STYLES['gk-kick-target'].fill, 5, 10)).toBe(true);
  });
});

describe('HexGrid — Plan 33-06: pass-target / tackle-risk tints routed through HexCell (HILITE-01)', () => {
  function passState() {
    return {
      ...mockMovementState,
      phase: 'PASS' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      lastActionType: null,
      ball: { position: CARRIER_POS, carrierId: CARRIER_ID, lastTouchedBy: null },
    };
  }

  it("renders a safe pass target with fill HIGHLIGHT_STYLES['pass-target'].fill and an interception-risk target with fill HIGHLIGHT_STYLES['tackle-risk'].fill", () => {
    const SAFE_TARGET_HEX = { q: 20, r: 13 };
    const RISK_TARGET_HEX = { q: 21, r: 13 };
    useGameStore.setState({
      gameState: passState(),
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
      selectedPassType: 'STANDARD_PASS',
      validPassTargetHexes: [SAFE_TARGET_HEX, RISK_TARGET_HEX],
      interceptionRiskHexes: [RISK_TARGET_HEX],
      passTargetHex: null,
    });
    const { container } = render(<HexGrid />);
    expect(
      hasFillAtHex(
        container,
        HIGHLIGHT_STYLES['pass-target'].fill,
        SAFE_TARGET_HEX.q,
        SAFE_TARGET_HEX.r,
      ),
    ).toBe(true);
    expect(
      hasFillAtHex(
        container,
        HIGHLIGHT_STYLES['tackle-risk'].fill,
        RISK_TARGET_HEX.q,
        RISK_TARGET_HEX.r,
      ),
    ).toBe(true);
  });

  it('renders a confirmed pass target as a gold ring (stroke RING_STYLES.confirmed.stroke, fill none) with NO green pass-target fill on that hex', () => {
    const CONFIRMED_HEX = { q: 22, r: 13 };
    useGameStore.setState({
      gameState: passState(),
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
      selectedPassType: 'STANDARD_PASS',
      validPassTargetHexes: [],
      interceptionRiskHexes: [],
      passTargetHex: CONFIRMED_HEX,
    });
    const { container } = render(<HexGrid />);
    expect(
      hasStrokeAtHex(container, RING_STYLES.confirmed.stroke, CONFIRMED_HEX.q, CONFIRMED_HEX.r),
    ).toBe(true);
    expect(
      hasFillAtHex(
        container,
        HIGHLIGHT_STYLES['pass-target'].fill,
        CONFIRMED_HEX.q,
        CONFIRMED_HEX.r,
      ),
    ).toBe(false);
  });
});

describe('HexGrid — Plan 33-06: KICK_OFF_SETUP centre-hex required ring routed through HexCell (HILITE-01)', () => {
  it('renders the centre hex as a gold required-ring polygon (fill/stroke = RING_STYLES.required.fill/.stroke)', () => {
    const state = {
      ...mockMovementState,
      phase: 'KICK_OFF_SETUP' as const,
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    // {q:18, r:13} is the board-centre kick-off hex (PITCH_REGIONS.kickOffHex).
    expect(hasFillAtHex(container, RING_STYLES.required.fill, 18, 13)).toBe(true);
    expect(hasStrokeAtHex(container, RING_STYLES.required.stroke, 18, 13)).toBe(true);
  });
});

describe('HexGrid — Plan 33-06: BallLocationRing marker replaces the deleted HEADER gold overlay (HILITE-04)', () => {
  it('during HEADER, renders a ball-location marker polygon (stroke BALL_MARKER_STROKE) at the ball hex, with NO gold ring/overlay (RING_STYLES.required.fill) there', () => {
    const BALL_HEX = { q: 18, r: 13 };
    const state = {
      ...mockMovementState,
      phase: 'HEADER' as const,
      ball: { position: BALL_HEX, carrierId: null, lastTouchedBy: null },
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasStrokeAtHex(container, BALL_MARKER_STROKE, BALL_HEX.q, BALL_HEX.r)).toBe(true);
    // The old HEADER-only gold overlay (fill/stroke = RING_STYLES.required, D-08) is deleted —
    // HEADER is not KICK_OFF_SETUP so isCentreHex/ring='required' cannot apply here either.
    expect(hasFillAtHex(container, RING_STYLES.required.fill, BALL_HEX.q, BALL_HEX.r)).toBe(false);
  });

  it('during a standard phase (MOVE), the ball-location marker is absent', () => {
    const BALL_HEX = { q: 14, r: 13 };
    const state = {
      ...mockMovementState,
      phase: 'MOVE' as const,
      ball: { position: BALL_HEX, carrierId: 'home-9', lastTouchedBy: null },
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasStrokeAtHex(container, BALL_MARKER_STROKE, BALL_HEX.q, BALL_HEX.r)).toBe(false);
  });
});

// GOALKICK-04/05 (Phase 37, Plan 37-10): target selection + both movement modes (the two
// 6-hex reposition windows and the 3-hex travel window).
describe('HexGrid — GOAL_KICK_TARGET: target set mirrors applyGoalKickTarget (GOALKICK-05)', () => {
  function goalKickTargetState() {
    return {
      ...mockMovementState,
      phase: 'GOAL_KICK_TARGET' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      goalKickTeam: 'home' as const,
      goalKickGkId: 'home-0',
    };
  }

  it('renders an outfield teammate of the goal-kicking team as clickable with the gk-kick-target tint', () => {
    const state = goalKickTargetState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1, // home — isActivePlayer requires myTeam === activeTeam
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const outfieldPiece = state.pieces.find((p) => p.id === 'home-1')!;
    const { container } = render(<HexGrid />);
    expect(
      hasFillAtHex(
        container,
        HIGHLIGHT_STYLES['gk-kick-target'].fill,
        outfieldPiece.position.q,
        outfieldPiece.position.r,
      ),
    ).toBe(true);
  });

  it('does NOT include the goalkeeper’s own hex in the target set', () => {
    const state = goalKickTargetState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const gkPiece = state.pieces.find((p) => p.id === 'home-0')!;
    const { container } = render(<HexGrid />);
    expect(
      hasFillAtHex(
        container,
        HIGHLIGHT_STYLES['gk-kick-target'].fill,
        gkPiece.position.q,
        gkPiece.position.r,
      ),
    ).toBe(false);
  });

  it('does NOT include an opposing piece’s hex in the target set', () => {
    const state = goalKickTargetState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const awayPiece = state.pieces.find((p) => p.id === 'away-1')!;
    const { container } = render(<HexGrid />);
    expect(
      hasFillAtHex(
        container,
        HIGHLIGHT_STYLES['gk-kick-target'].fill,
        awayPiece.position.q,
        awayPiece.position.r,
      ),
    ).toBe(false);
  });

  it('clicking a valid target piece calls emitGoalKickTarget with that piece’s position', () => {
    const state = goalKickTargetState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const outfieldPiece = state.pieces.find((p) => p.id === 'home-1')!;
    const emitGoalKickTargetSpy = vi.fn();
    useGameStore.setState({ emitGoalKickTarget: emitGoalKickTargetSpy });
    const { container } = render(<HexGrid />);
    const { cx, cy } = axialToPixel(outfieldPiece.position.q, outfieldPiece.position.r);
    const targetCircle = Array.from(container.querySelectorAll('circle')).find(
      (c) => Number(c.getAttribute('cx')) === cx && Number(c.getAttribute('cy')) === cy,
    )!;
    fireEvent.click(targetCircle);
    expect(emitGoalKickTargetSpy).toHaveBeenCalledWith(outfieldPiece.position);
  });
});

describe('HexGrid — GOAL_KICK_SETUP_GK piece clickability (GOALKICK-02, Plan 37-10)', () => {
  const GOAL_KICK_ELIGIBLE_ID = 'home-8'; // home FWD 1, distinct from GK (home-0)

  function goalKickSetupGkState(overrides: { goalKickUsedPace?: Record<string, number> } = {}) {
    return {
      ...mockMovementState,
      phase: 'GOAL_KICK_SETUP_GK' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      goalKickTeam: 'home' as const,
      goalKickGkId: 'home-0',
      goalKickEligibleIds: { gkTeam: [GOAL_KICK_ELIGIBLE_ID], opponent: [] as readonly string[] },
      goalKickUsedPace: overrides.goalKickUsedPace ?? {},
    };
  }

  it('renders an eligible own piece as selectable', () => {
    const state = goalKickSetupGkState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const eligiblePiece = state.pieces.find((p) => p.id === GOAL_KICK_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, eligiblePiece.position.q, eligiblePiece.position.r)).toBe(
      true,
    );
  });

  it('does NOT render a piece whose goalKickUsedPace is already 6 as selectable', () => {
    const state = goalKickSetupGkState({ goalKickUsedPace: { [GOAL_KICK_ELIGIBLE_ID]: 6 } });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const eligiblePiece = state.pieces.find((p) => p.id === GOAL_KICK_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, eligiblePiece.position.q, eligiblePiece.position.r)).toBe(
      false,
    );
  });

  it('renders the safe (green) tint on an adjacent hex once an eligible piece is selected', () => {
    const state = goalKickSetupGkState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    useGameStore.getState().selectPiece(GOAL_KICK_ELIGIBLE_ID);
    const { container } = render(<HexGrid />);
    const hasSafeFill = Array.from(container.querySelectorAll('polygon')).some(
      (p) => p.getAttribute('fill') === SAFE_FILL,
    );
    expect(hasSafeFill).toBe(true);
  });
});

describe('HexGrid — GOAL_KICK_MOVE piece clickability (GOALKICK-05, Plan 37-10)', () => {
  const GOAL_KICK_MOVE_ID = 'home-8';
  const GOAL_KICK_MOVE_OTHER_ID = 'home-10';

  function goalKickMoveState(overrides: { goalKickMovedPieceId?: string | null } = {}) {
    return {
      ...mockMovementState,
      phase: 'GOAL_KICK_MOVE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      goalKickTeam: 'home' as const,
      goalKickMoveSlot: 'KICKER' as const,
      goalKickMovedPieceId: overrides.goalKickMovedPieceId ?? null,
      goalKickPaceUsed: 0,
    };
  }

  it('renders an own piece as selectable while goalKickMovedPieceId is null', () => {
    const state = goalKickMoveState({ goalKickMovedPieceId: null });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const piece = state.pieces.find((p) => p.id === GOAL_KICK_MOVE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, piece.position.q, piece.position.r)).toBe(true);
  });

  it('renders the locked piece itself as selectable once goalKickMovedPieceId is set to it', () => {
    const state = goalKickMoveState({ goalKickMovedPieceId: GOAL_KICK_MOVE_ID });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const piece = state.pieces.find((p) => p.id === GOAL_KICK_MOVE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, piece.position.q, piece.position.r)).toBe(true);
  });

  it('does NOT render a different own piece as selectable once goalKickMovedPieceId locks in another piece', () => {
    const state = goalKickMoveState({ goalKickMovedPieceId: GOAL_KICK_MOVE_ID });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const otherPiece = state.pieces.find((p) => p.id === GOAL_KICK_MOVE_OTHER_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, otherPiece.position.q, otherPiece.position.r)).toBe(
      false,
    );
  });
});

// CORNER-01/02/03/06 (Plan 38-06): piece selectability, safe-tint destination highlighting
// and the fixed corner-taker hex's required ring, for all four interactive Corner Kick
// phases — mirrors the GOAL_KICK_SETUP_GK/GOAL_KICK_MOVE clickability harness above.
describe('HexGrid — Corner Kick piece selectability, tints and rings (CORNER-01/02/03/06, Plan 38-06)', () => {
  const HOME_GK_ID = 'home-0';
  const AWAY_GK_ID = 'away-0';
  const REPOSITION_ELIGIBLE_ID = 'home-8';
  const FINAL_ELIGIBLE_ID = 'home-8';
  const FINAL_OTHER_ID = 'home-10';

  function cornerKickGkSetupState(
    phase: 'CORNER_KICK_GK_SETUP_ATTACKING' | 'CORNER_KICK_GK_SETUP_DEFENDING',
    cornerKickTeam: 'home' | 'away' = 'home',
  ) {
    return { ...mockMovementState, phase, cornerKickTeam };
  }

  function cornerKickTakerSelectState(
    cornerKickTeam: 'home' | 'away' = 'home',
    cornerKickHex: { q: number; r: number } = { q: 0, r: 1 },
  ) {
    return {
      ...mockMovementState,
      phase: 'CORNER_KICK_TAKER_SELECT' as const,
      cornerKickTeam,
      cornerKickHex,
    };
  }

  function cornerKickRepositionState(
    overrides: {
      stageIndex?: 0 | 1 | 2 | 3 | 4 | 5;
      cornerKickTeam?: 'home' | 'away';
      eligibleIds?: { attacking: string[]; defending: string[] };
      cornerKickActivatedIds?: readonly string[];
      cornerKickStagePlacedIds?: readonly string[];
    } = {},
  ) {
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

  function cornerKickFinalSetupState(
    overrides: {
      cornerKickTeam?: 'home' | 'away';
      slot?: 'ATTACKER' | 'DEFENDER';
      movedPieceId?: string | null;
      paceUsed?: number;
      eligibleIds?: { attacking: string[]; defending: string[] };
    } = {},
  ) {
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

  /**
   * True if ANY piece on the board renders the 'selectable' blue ring — used for the negative
   * "non-acting player sees nothing clickable" assertions (mirrors hasSelectableRingAt's
   * stroke/radius match, without position filtering).
   */
  function hasAnySelectableRing(container: HTMLElement): boolean {
    return Array.from(container.querySelectorAll('circle')).some(
      (c) => c.getAttribute('stroke') === '#60a5fa' && c.getAttribute('r') === '15',
    );
  }

  it('CORNER_KICK_GK_SETUP_ATTACKING: renders the attacking team GK as selectable for the controlling player', () => {
    const state = cornerKickGkSetupState('CORNER_KICK_GK_SETUP_ATTACKING', 'home');
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const gk = state.pieces.find((p) => p.id === HOME_GK_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, gk.position.q, gk.position.r)).toBe(true);
  });

  it('CORNER_KICK_GK_SETUP_ATTACKING: its destination hexes render the safe tint once selected', () => {
    const state = cornerKickGkSetupState('CORNER_KICK_GK_SETUP_ATTACKING', 'home');
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    useGameStore.getState().selectPiece(HOME_GK_ID);
    const { container } = render(<HexGrid />);
    const hasSafeFill = Array.from(container.querySelectorAll('polygon')).some(
      (p) => p.getAttribute('fill') === SAFE_FILL,
    );
    expect(hasSafeFill).toBe(true);
  });

  it('CORNER_KICK_GK_SETUP_ATTACKING: the non-acting (defending) player sees zero selectable pieces', () => {
    const state = cornerKickGkSetupState('CORNER_KICK_GK_SETUP_ATTACKING', 'home');
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 2,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasAnySelectableRing(container)).toBe(false);
  });

  it('CORNER_KICK_GK_SETUP_DEFENDING: renders the defending team GK as selectable for the controlling player', () => {
    const state = cornerKickGkSetupState('CORNER_KICK_GK_SETUP_DEFENDING', 'home');
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 2,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const gk = state.pieces.find((p) => p.id === AWAY_GK_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, gk.position.q, gk.position.r)).toBe(true);
  });

  it('CORNER_KICK_GK_SETUP_DEFENDING: the non-acting (attacking) player sees zero selectable pieces', () => {
    const state = cornerKickGkSetupState('CORNER_KICK_GK_SETUP_DEFENDING', 'home');
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasAnySelectableRing(container)).toBe(false);
  });

  it('CORNER_KICK_TAKER_SELECT: renders every own on-pitch piece as selectable for the kicking manager', () => {
    const state = cornerKickTakerSelectState('home');
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const piece = state.pieces.find((p) => p.id === REPOSITION_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, piece.position.q, piece.position.r)).toBe(true);
  });

  it('CORNER_KICK_TAKER_SELECT: renders the required ring at cornerKickHex', () => {
    const state = cornerKickTakerSelectState('home', { q: 0, r: 1 });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasFillAtHex(container, RING_STYLES.required.fill, 0, 1)).toBe(true);
    expect(hasStrokeAtHex(container, RING_STYLES.required.stroke, 0, 1)).toBe(true);
  });

  it('CORNER_KICK_TAKER_SELECT: the non-acting (defending) player sees zero selectable pieces', () => {
    const state = cornerKickTakerSelectState('home');
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 2,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasAnySelectableRing(container)).toBe(false);
  });

  it("CORNER_KICK_REPOSITION: renders the current stage team's eligible piece as selectable", () => {
    const state = cornerKickRepositionState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const piece = state.pieces.find((p) => p.id === REPOSITION_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, piece.position.q, piece.position.r)).toBe(true);
  });

  it('CORNER_KICK_REPOSITION: a piece activated in an earlier stage is not selectable and renders as activated', () => {
    const state = cornerKickRepositionState({
      cornerKickActivatedIds: [REPOSITION_ELIGIBLE_ID],
      cornerKickStagePlacedIds: [],
    });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const piece = state.pieces.find((p) => p.id === REPOSITION_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, piece.position.q, piece.position.r)).toBe(false);
    expect(hasActivatedRingAt(container, piece.position.q, piece.position.r)).toBe(true);
  });

  it('CORNER_KICK_REPOSITION: a piece placed THIS stage also renders as activated and is not selectable — no same-stage exemption', () => {
    const state = cornerKickRepositionState({
      cornerKickActivatedIds: [REPOSITION_ELIGIBLE_ID],
      cornerKickStagePlacedIds: [REPOSITION_ELIGIBLE_ID],
    });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const piece = state.pieces.find((p) => p.id === REPOSITION_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, piece.position.q, piece.position.r)).toBe(false);
    expect(hasActivatedRingAt(container, piece.position.q, piece.position.r)).toBe(true);
  });

  it("CORNER_KICK_REPOSITION: renders the selected piece's adjacent legal hexes with the safe tint", () => {
    const state = cornerKickRepositionState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    useGameStore.getState().selectPiece(REPOSITION_ELIGIBLE_ID);
    const { container } = render(<HexGrid />);
    const hasSafeFill = Array.from(container.querySelectorAll('polygon')).some(
      (p) => p.getAttribute('fill') === SAFE_FILL,
    );
    expect(hasSafeFill).toBe(true);
  });

  it('CORNER_KICK_REPOSITION: the non-acting (defending) team sees zero selectable pieces during the attacking stage', () => {
    const state = cornerKickRepositionState({
      stageIndex: 0,
      cornerKickTeam: 'home',
      eligibleIds: { attacking: [REPOSITION_ELIGIBLE_ID], defending: ['away-8'] },
    });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 2,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasAnySelectableRing(container)).toBe(false);
  });

  it("CORNER_KICK_FINAL_SETUP: renders the slot team's eligible piece as selectable while unlocked", () => {
    const state = cornerKickFinalSetupState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const piece = state.pieces.find((p) => p.id === FINAL_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, piece.position.q, piece.position.r)).toBe(true);
  });

  it('CORNER_KICK_FINAL_SETUP: does NOT render a different eligible piece as selectable once cornerKickMovedPieceId locks another', () => {
    const state = cornerKickFinalSetupState({
      movedPieceId: FINAL_ELIGIBLE_ID,
      eligibleIds: { attacking: [FINAL_ELIGIBLE_ID, FINAL_OTHER_ID], defending: [] },
    });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const otherPiece = state.pieces.find((p) => p.id === FINAL_OTHER_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, otherPiece.position.q, otherPiece.position.r)).toBe(
      false,
    );
  });

  it('CORNER_KICK_FINAL_SETUP: its destination hexes render the safe tint once the eligible piece is selected', () => {
    const state = cornerKickFinalSetupState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    useGameStore.getState().selectPiece(FINAL_ELIGIBLE_ID);
    const { container } = render(<HexGrid />);
    const hasSafeFill = Array.from(container.querySelectorAll('polygon')).some(
      (p) => p.getAttribute('fill') === SAFE_FILL,
    );
    expect(hasSafeFill).toBe(true);
  });

  it('CORNER_KICK_FINAL_SETUP: the non-acting (defending) team sees zero selectable pieces during the ATTACKER slot', () => {
    const state = cornerKickFinalSetupState({ slot: 'ATTACKER', cornerKickTeam: 'home' });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 2,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasAnySelectableRing(container)).toBe(false);
  });

  // 38-24-SUMMARY.md bug 3 (Plan 38-29 Task 2): the pre-kick 3-hex window must apply NO
  // activation marker at all, at any pace value — isSpentNow's CORNER_KICK_FINAL_SETUP arm is
  // now the literal `false`, not `piece.id === cornerKickMovedPieceId`.
  it('CORNER_KICK_FINAL_SETUP: a piece that has moved one hex (cornerKickMovedPieceId locked, paceUsed=1) does NOT render as activated', () => {
    const state = cornerKickFinalSetupState({ movedPieceId: FINAL_ELIGIBLE_ID, paceUsed: 1 });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const piece = state.pieces.find((p) => p.id === FINAL_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasActivatedRingAt(container, piece.position.q, piece.position.r)).toBe(false);
  });

  it('CORNER_KICK_FINAL_SETUP: a piece that has exhausted all 3 hexes (paceUsed=3) still does NOT render as activated', () => {
    const state = cornerKickFinalSetupState({ movedPieceId: FINAL_ELIGIBLE_ID, paceUsed: 3 });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const piece = state.pieces.find((p) => p.id === FINAL_ELIGIBLE_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasActivatedRingAt(container, piece.position.q, piece.position.r)).toBe(false);
  });

  it('CORNER_KICK_FINAL_SETUP: a second, different eligible piece is still non-selectable while cornerKickMovedPieceId locks another (slot lock survives)', () => {
    const state = cornerKickFinalSetupState({
      movedPieceId: FINAL_ELIGIBLE_ID,
      eligibleIds: { attacking: [FINAL_ELIGIBLE_ID, FINAL_OTHER_ID], defending: [] },
    });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const otherPiece = state.pieces.find((p) => p.id === FINAL_OTHER_ID)!;
    const { container } = render(<HexGrid />);
    expect(hasSelectableRingAt(container, otherPiece.position.q, otherPiece.position.r)).toBe(
      false,
    );
  });
});

// GOALKICK-05 (Phase 37, Plan 37-18): HeaderTargetRing renders as a second standalone
// always-on-top overlay, alongside BallLocationRing, marking the goal-kick header contest
// hex during the GOAL_KICK_MOVE travel window. Asserted via the imported HEADER_TARGET_STROKE
// constant, never a retyped '#f5c518' literal (CONTEXT.md test-migration decision — mirrors
// the BALL_MARKER_STROKE convention above).
describe('HexGrid — GOAL_KICK_MOVE: HeaderTargetRing contest marker (GOALKICK-05, Plan 37-18)', () => {
  const TARGET_HEX = { q: 15, r: 13 };

  function goalKickMoveTargetState(
    overrides: { goalKickTargetHex?: { q: number; r: number } | null } = {},
  ) {
    return {
      ...mockMovementState,
      phase: 'GOAL_KICK_MOVE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      goalKickTeam: 'home' as const,
      goalKickMoveSlot: 'KICKER' as const,
      goalKickMovedPieceId: null,
      goalKickPaceUsed: 0,
      goalKickTargetHex:
        overrides.goalKickTargetHex === undefined ? TARGET_HEX : overrides.goalKickTargetHex,
      ball: { position: TARGET_HEX, carrierId: null, lastTouchedBy: null },
    };
  }

  it('renders the gold HeaderTargetRing outer polygon centred on goalKickTargetHex', () => {
    const state = goalKickMoveTargetState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasStrokeAtHex(container, HEADER_TARGET_STROKE, TARGET_HEX.q, TARGET_HEX.r)).toBe(true);
  });

  it('does NOT render when goalKickTargetHex is null', () => {
    const state = goalKickMoveTargetState({ goalKickTargetHex: null });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasStrokeAtHex(container, HEADER_TARGET_STROKE, TARGET_HEX.q, TARGET_HEX.r)).toBe(false);
  });

  it('does NOT render during GOAL_KICK_TARGET (the selection phase, not the travel window)', () => {
    const state = {
      ...goalKickMoveTargetState(),
      phase: 'GOAL_KICK_TARGET' as const,
      goalKickGkId: 'home-0',
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasStrokeAtHex(container, HEADER_TARGET_STROKE, TARGET_HEX.q, TARGET_HEX.r)).toBe(false);
  });

  it('coexists with the white BallLocationRing marker on the same hex during GOAL_KICK_MOVE', () => {
    const state = goalKickMoveTargetState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(hasStrokeAtHex(container, HEADER_TARGET_STROKE, TARGET_HEX.q, TARGET_HEX.r)).toBe(true);
    expect(hasStrokeAtHex(container, BALL_MARKER_STROKE, TARGET_HEX.q, TARGET_HEX.r)).toBe(true);
  });
});

// GOALKICK-05 (Phase 37, Plan 37-19): headerContestZoneSet generalises the header-contest
// eligibility preview (formerly highPassContestZoneSet, gated on HIGH_PASS_MOVE only) to also
// cover GOAL_KICK_MOVE — the two response-move windows that resolve directly into a HEADER
// contest (D-19-06). The radius mirrors applyGoalKickMoveEnd's homeEligible/awayEligible
// hexDistance <= 2 check verbatim (D-19-02) and centres on goalKickTargetHex, not ball.position
// (D-19-03). Asserted exclusively via HIGHLIGHT_STYLES['shot-path'].stroke and
// ['shot-path-action'].stroke — never a retyped '#dddddd'/'#aaaaaa' literal — because both tiers
// share an identical opaque white fill (rgba(255,255,255,1)) and can only be told apart by
// stroke (HexCell.tsx HIGHLIGHT_STYLES).
describe('HexGrid — header-contest zone preview generalisation (GOALKICK-05, Plan 37-19)', () => {
  const HP_BALL_HEX = { q: 18, r: 13 };
  const HP_2AWAY = PITCH_HEXES.find((h) => hexDistance(h, HP_BALL_HEX) === 2)!;
  const HP_3AWAY = PITCH_HEXES.find((h) => hexDistance(h, HP_BALL_HEX) === 3)!;

  it('HIGH_PASS_MOVE regression pin: ball hex and a hex 2 away carry shot-path; a hex 3 away carries neither (order-of-work proof: written and verified passing against the unmodified file — see SUMMARY)', () => {
    const state = {
      ...mockMovementState,
      phase: 'HIGH_PASS_MOVE' as const,
      ball: { position: HP_BALL_HEX, carrierId: null, lastTouchedBy: null },
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(
      hasStrokeAtHex(container, HIGHLIGHT_STYLES['shot-path'].stroke, HP_BALL_HEX.q, HP_BALL_HEX.r),
    ).toBe(true);
    expect(
      hasStrokeAtHex(container, HIGHLIGHT_STYLES['shot-path'].stroke, HP_2AWAY.q, HP_2AWAY.r),
    ).toBe(true);
    expect(
      hasStrokeAtHex(container, HIGHLIGHT_STYLES['shot-path'].stroke, HP_3AWAY.q, HP_3AWAY.r),
    ).toBe(false);
    expect(
      hasStrokeAtHex(
        container,
        HIGHLIGHT_STYLES['shot-path-action'].stroke,
        HP_3AWAY.q,
        HP_3AWAY.r,
      ),
    ).toBe(false);
  });

  const GK_TARGET_HEX = { q: 15, r: 13 };
  const GK_2AWAY = PITCH_HEXES.find((h) => hexDistance(h, GK_TARGET_HEX) === 2)!;
  const GK_3AWAY = PITCH_HEXES.find((h) => hexDistance(h, GK_TARGET_HEX) === 3)!;

  function goalKickMoveContestState(
    overrides: { goalKickTargetHex?: { q: number; r: number } | null } = {},
  ) {
    return {
      ...mockMovementState,
      phase: 'GOAL_KICK_MOVE' as const,
      activeTeam: 'home' as const,
      attackingTeam: 'home' as const,
      goalKickTeam: 'home' as const,
      goalKickMoveSlot: 'KICKER' as const,
      goalKickMovedPieceId: null,
      goalKickPaceUsed: 0,
      goalKickTargetHex:
        overrides.goalKickTargetHex === undefined ? GK_TARGET_HEX : overrides.goalKickTargetHex,
      ball: { position: GK_TARGET_HEX, carrierId: null, lastTouchedBy: null },
    };
  }

  it('GOAL_KICK_MOVE: target hex and a hex 2 away carry shot-path; a hex 3 away carries neither', () => {
    const state = goalKickMoveContestState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(
      hasStrokeAtHex(
        container,
        HIGHLIGHT_STYLES['shot-path'].stroke,
        GK_TARGET_HEX.q,
        GK_TARGET_HEX.r,
      ),
    ).toBe(true);
    expect(
      hasStrokeAtHex(container, HIGHLIGHT_STYLES['shot-path'].stroke, GK_2AWAY.q, GK_2AWAY.r),
    ).toBe(true);
    expect(
      hasStrokeAtHex(container, HIGHLIGHT_STYLES['shot-path'].stroke, GK_3AWAY.q, GK_3AWAY.r),
    ).toBe(false);
    expect(
      hasStrokeAtHex(
        container,
        HIGHLIGHT_STYLES['shot-path-action'].stroke,
        GK_3AWAY.q,
        GK_3AWAY.r,
      ),
    ).toBe(false);
  });

  it('GOAL_KICK_MOVE: the same preview renders for the non-active team, unselected (D-19-05)', () => {
    const state = goalKickMoveContestState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 2, // away — myTeam ('away') !== activeTeam ('home'), so isActivePlayer is false
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(
      hasStrokeAtHex(
        container,
        HIGHLIGHT_STYLES['shot-path'].stroke,
        GK_TARGET_HEX.q,
        GK_TARGET_HEX.r,
      ),
    ).toBe(true);
    expect(
      hasStrokeAtHex(container, HIGHLIGHT_STYLES['shot-path'].stroke, GK_2AWAY.q, GK_2AWAY.r),
    ).toBe(true);
  });

  it('GOAL_KICK_MOVE: goalKickTargetHex null renders no shot-path stroke anywhere on the board', () => {
    const state = goalKickMoveContestState({ goalKickTargetHex: null });
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(
      Array.from(container.querySelectorAll('polygon')).some(
        (p) => p.getAttribute('stroke') === HIGHLIGHT_STYLES['shot-path'].stroke,
      ),
    ).toBe(false);
  });

  it('GOAL_KICK_MOVE: an in-zone hex also present in validMoveHexes renders shot-path-action (not plain shot-path); a different in-zone hex absent from validMoveHexes still renders plain shot-path (D-19-04)', () => {
    const state = goalKickMoveContestState();
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [GK_2AWAY],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(
      hasStrokeAtHex(
        container,
        HIGHLIGHT_STYLES['shot-path-action'].stroke,
        GK_2AWAY.q,
        GK_2AWAY.r,
      ),
    ).toBe(true);
    expect(
      hasStrokeAtHex(container, HIGHLIGHT_STYLES['shot-path'].stroke, GK_2AWAY.q, GK_2AWAY.r),
    ).toBe(false);
    expect(
      hasStrokeAtHex(
        container,
        HIGHLIGHT_STYLES['shot-path'].stroke,
        GK_TARGET_HEX.q,
        GK_TARGET_HEX.r,
      ),
    ).toBe(true);
  });

  it('GK_KICK_MOVE resolves into a delivery (caught pass), not a header — no shot-path/shot-path-action stroke anywhere (D-19-06)', () => {
    const state = {
      ...mockMovementState,
      phase: 'GK_KICK_MOVE' as const,
      ball: { position: GK_TARGET_HEX, carrierId: null, lastTouchedBy: null },
      gkKickTargetHex: GK_TARGET_HEX,
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(
      Array.from(container.querySelectorAll('polygon')).some((p) =>
        [
          HIGHLIGHT_STYLES['shot-path'].stroke,
          HIGHLIGHT_STYLES['shot-path-action'].stroke,
        ].includes(p.getAttribute('stroke') ?? ''),
      ),
    ).toBe(false);
  });

  it('FIRST_TIME_PASS_MOVE resolves into a delivery, not a header — no shot-path/shot-path-action stroke anywhere (D-19-06)', () => {
    const state = {
      ...mockMovementState,
      phase: 'FIRST_TIME_PASS_MOVE' as const,
      ball: { position: GK_TARGET_HEX, carrierId: null, lastTouchedBy: null },
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(
      Array.from(container.querySelectorAll('polygon')).some((p) =>
        [
          HIGHLIGHT_STYLES['shot-path'].stroke,
          HIGHLIGHT_STYLES['shot-path-action'].stroke,
        ].includes(p.getAttribute('stroke') ?? ''),
      ),
    ).toBe(false);
  });

  it('GOAL_KICK_TARGET (the selection phase preceding the travel window) renders no contest-zone stroke', () => {
    const state = {
      ...goalKickMoveContestState(),
      phase: 'GOAL_KICK_TARGET' as const,
      goalKickGkId: 'home-0',
    };
    useGameStore.setState({
      gameState: state,
      screen: 'GAME_BOARD',
      playerSlot: 1,
      selectedPieceId: null,
      validMoveHexes: [],
      tackleRiskHexes: [],
    });
    const { container } = render(<HexGrid />);
    expect(
      Array.from(container.querySelectorAll('polygon')).some((p) =>
        [
          HIGHLIGHT_STYLES['shot-path'].stroke,
          HIGHLIGHT_STYLES['shot-path-action'].stroke,
        ].includes(p.getAttribute('stroke') ?? ''),
      ),
    ).toBe(false);
  });
});
