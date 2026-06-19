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
