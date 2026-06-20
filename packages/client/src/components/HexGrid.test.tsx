import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { axialToPixel } from '../utils/hexToPixel.js';
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
    ball: { position: CARRIER_POS, carrierId: FTP_OWN_PIECE_ID },
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
 * Matches on BOTH stroke color (#3b82f6) AND radius (PIECE_RADIUS+2=14, PieceOverlay.tsx)
 * because the cosmos (home) team's jersey primaryColor is also '#3b82f6' (teamConfig.ts) —
 * matching stroke color alone would false-positive on every home piece's base circle
 * (r=PIECE_RADIUS=12), which is a distinct, always-rendered element.
 */
function hasSelectableRingAt(container: HTMLElement, q: number, r: number): boolean {
  const { cx, cy } = axialToPixel(q, r);
  return Array.from(container.querySelectorAll('circle')).some(
    (c) =>
      c.getAttribute('stroke') === '#3b82f6' &&
      c.getAttribute('r') === '14' &&
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
// D-45: FREE_KICK_SETUP valid placement hexes must use the light-blue 'kickoff' tint
// (rgba(59,130,246,1)), not the generic yellow 'safe' tint — and must match server truth
// (validMoveHexes, already team-restricted by D-46 in useGameStore.ts).
// ---------------------------------------------------------------------------

const KICKOFF_FILL = 'rgba(59,130,246,1)'; // HIGHLIGHT_STYLES.kickoff fill — see HexCell.tsx
const SAFE_FILL = 'rgba(245,197,24,1)'; // HIGHLIGHT_STYLES.safe fill — see HexCell.tsx

describe('HexGrid — D-45: FREE_KICK_SETUP valid placement hexes render the kickoff (light-blue) tint', () => {
  function freeKickSetupState() {
    return {
      ...mockMovementState,
      phase: 'FREE_KICK_SETUP' as const,
      freeKickHex: { q: 25, r: 13 },
      freeKickAttackingTeam: 'away' as const,
    };
  }

  beforeEach(() => {
    useGameStore.setState({
      gameState: freeKickSetupState(),
      screen: 'GAME_BOARD',
      selectedPieceId: 'home-8',
      // Mirrors what useGameStore.selectPiece would compute for a defending-team piece
      // (D-30/D-46 already applied) — a hex ahead of and clear of the freeKickHex zone.
      validMoveHexes: [{ q: 30, r: 13 }],
      tackleRiskHexes: [],
      playerSlot: 1,
      roomCode: 'ABC12',
      disconnectWarning: false,
      roomError: null,
      gameError: null,
    });
  });

  it('renders the valid placement hex with the kickoff (light-blue) fill', () => {
    const { container } = render(<HexGrid />);
    const { cx, cy } = axialToPixel(30, 13);
    const hasKickoffFillAtHex = Array.from(container.querySelectorAll('polygon')).some((p) => {
      if (p.getAttribute('fill') !== KICKOFF_FILL) return false;
      const points = p.getAttribute('points') ?? '';
      // hexPolygonPoints centers each polygon's vertices around (cx, cy) — checking that the
      // polygon's bounding-box center matches confirms it's the hex at (30, 13), not some
      // other kickoff-tinted hex coincidentally sharing the fill colour.
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
    expect(hasKickoffFillAtHex).toBe(true);
  });

  it('does NOT render any valid placement hex with the generic safe (yellow) fill', () => {
    const { container } = render(<HexGrid />);
    const hasSafeFill = Array.from(container.querySelectorAll('polygon')).some(
      (p) => p.getAttribute('fill') === SAFE_FILL,
    );
    expect(hasSafeFill).toBe(false);
  });
});
