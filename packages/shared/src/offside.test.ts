import { describe, it, expect } from 'vitest';
import {
  CORNER_KICK_STAGES,
  cornerKickStageTeam,
  opposingPiecesEqualOrAhead,
  isOffsideNow,
  isClearedNow,
  evaluateOffside,
} from './offside.js';
import type { GameState, PlayerPiece } from './types.js';

describe('CORNER_KICK_STAGES', () => {
  it('has exactly 6 entries', () => {
    expect(CORNER_KICK_STAGES.length).toBe(6);
  });

  it('alternates by index parity: even indices are attacking, odd indices are defending', () => {
    CORNER_KICK_STAGES.forEach((stage, index) => {
      const expectedSide = index % 2 === 0 ? 'attacking' : 'defending';
      expect(stage.side).toBe(expectedSide);
    });
  });

  it('every stage has max: 2', () => {
    for (const stage of CORNER_KICK_STAGES) {
      expect(stage.max).toBe(2);
    }
  });
});

describe('cornerKickStageTeam', () => {
  it("stage 0 (attacking) with cornerKickTeam 'home' returns 'home'", () => {
    expect(cornerKickStageTeam(0, 'home')).toBe('home');
  });

  it("stage 1 (defending) with cornerKickTeam 'home' returns 'away'", () => {
    expect(cornerKickStageTeam(1, 'home')).toBe('away');
  });

  it("stage 4 (attacking) with cornerKickTeam 'away' returns 'away'", () => {
    expect(cornerKickStageTeam(4, 'away')).toBe('away');
  });

  it("stage 5 (defending) with cornerKickTeam 'away' returns 'home'", () => {
    expect(cornerKickStageTeam(5, 'away')).toBe('home');
  });

  it('across all 6 stages, each side acts exactly 3 times for either cornerKickTeam value', () => {
    for (const cornerKickTeam of ['home', 'away'] as const) {
      const actingTeams = CORNER_KICK_STAGES.map((_, index) =>
        cornerKickStageTeam(index as 0 | 1 | 2 | 3 | 4 | 5, cornerKickTeam),
      );
      const attackingCount = actingTeams.filter((t) => t === cornerKickTeam).length;
      const defendingCount = actingTeams.filter((t) => t !== cornerKickTeam).length;
      expect(attackingCount).toBe(3);
      expect(defendingCount).toBe(3);
    }
  });
});

// ---------------------------------------------------------------------------
// BUG-38 (Phase 42, D-09): isActivePiece exclusion of red-carded/benched pieces
// from opponent-counting and offside-flag evaluation.
// ---------------------------------------------------------------------------

const basePlayer: PlayerPiece = {
  id: 'base',
  teamId: 'home',
  position: { q: 0, r: 0 },
  pace: 4,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  heading: 5,
  saving: 1,
  handling: 5,
  resilience: 5,
  aerialAbility: 0,
  highPass: 3,
  name: 'Test Player',
  role: 'MID',
};

// home attacks toward higher q (attackingDirection('home') === 1); OFFSIDE_HALFWAY_Q === 18.
const homeFwd: PlayerPiece = {
  ...basePlayer,
  id: 'homeFwd',
  teamId: 'home',
  position: { q: 25, r: 10 },
};

const homeCarrier: PlayerPiece = {
  ...basePlayer,
  id: 'homeCarrier',
  teamId: 'home',
  position: { q: 20, r: 10 },
};

const awayActive: PlayerPiece = {
  ...basePlayer,
  id: 'awayActive',
  teamId: 'away',
  position: { q: 30, r: 10 },
};

const makeAwayDismissed = (flag: 'redCarded' | 'onPitch'): PlayerPiece => ({
  ...basePlayer,
  id: 'awayDismissed',
  teamId: 'away',
  position: { q: 26, r: 10 },
  ...(flag === 'redCarded' ? { redCarded: true } : { onPitch: false }),
});

const makeState = (pieces: PlayerPiece[], overrides?: Partial<GameState>): GameState => ({
  roomCode: 'TEST',
  phase: 'MOVE',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces,
  // ball possessed by homeCarrier — required by isClearedNow's D-40 possession gate.
  ball: { position: { q: 20, r: 10 }, carrierId: 'homeCarrier', lastTouchedBy: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  ...overrides,
});

describe('BUG-38: red-carded/benched piece exclusion', () => {
  describe('opposingPiecesEqualOrAhead', () => {
    it('returns 1 (not 2) when the second equal-or-ahead away piece is redCarded', () => {
      const dismissed = makeAwayDismissed('redCarded');
      const state = makeState([homeFwd, homeCarrier, awayActive, dismissed]);
      expect(opposingPiecesEqualOrAhead(state, homeFwd)).toBe(1);
    });

    it('returns 1 (not 2) when the second equal-or-ahead away piece is onPitch: false', () => {
      const dismissed = makeAwayDismissed('onPitch');
      const state = makeState([homeFwd, homeCarrier, awayActive, dismissed]);
      expect(opposingPiecesEqualOrAhead(state, homeFwd)).toBe(1);
    });

    it('control: returns 2 when both away pieces are active — count logic itself unchanged', () => {
      const activeSecond: PlayerPiece = {
        ...basePlayer,
        id: 'awayDismissed',
        teamId: 'away',
        position: { q: 26, r: 10 },
      };
      const state = makeState([homeFwd, homeCarrier, awayActive, activeSecond]);
      expect(opposingPiecesEqualOrAhead(state, homeFwd)).toBe(2);
    });
  });

  describe('isOffsideNow', () => {
    it('returns true when the dismissed away piece drops the count to 1 (D-21 condition 3 satisfied)', () => {
      const dismissed = makeAwayDismissed('redCarded');
      const state = makeState([homeFwd, homeCarrier, awayActive, dismissed]);
      expect(isOffsideNow(state, homeFwd)).toBe(true);
    });

    it('returns false when both away pieces are active (count is 2, condition 3 fails)', () => {
      const activeSecond: PlayerPiece = {
        ...basePlayer,
        id: 'awayDismissed',
        teamId: 'away',
        position: { q: 26, r: 10 },
      };
      const state = makeState([homeFwd, homeCarrier, awayActive, activeSecond]);
      expect(isOffsideNow(state, homeFwd)).toBe(false);
    });
  });

  describe('isClearedNow', () => {
    it('returns false when the dismissed away piece drops the count to 1 (not >=2, does not clear)', () => {
      const dismissed = makeAwayDismissed('redCarded');
      const state = makeState([homeFwd, homeCarrier, awayActive, dismissed]);
      expect(isClearedNow(state, homeFwd)).toBe(false);
    });

    it('returns true when both away pieces are active (count >=2 clears)', () => {
      const activeSecond: PlayerPiece = {
        ...basePlayer,
        id: 'awayDismissed',
        teamId: 'away',
        position: { q: 26, r: 10 },
      };
      const state = makeState([homeFwd, homeCarrier, awayActive, activeSecond]);
      expect(isClearedNow(state, homeFwd)).toBe(true);
    });
  });

  describe('evaluateOffside', () => {
    it('returns exactly [homeFwd.id] when the second away piece is dismissed', () => {
      const dismissed = makeAwayDismissed('redCarded');
      const state = makeState([homeFwd, homeCarrier, awayActive, dismissed]);
      expect(evaluateOffside(state)).toEqual([homeFwd.id]);
    });

    it('returns [] when both away pieces are active', () => {
      const activeSecond: PlayerPiece = {
        ...basePlayer,
        id: 'awayDismissed',
        teamId: 'away',
        position: { q: 26, r: 10 },
      };
      const state = makeState([homeFwd, homeCarrier, awayActive, activeSecond]);
      expect(evaluateOffside(state)).toEqual([]);
    });

    it('never newly flags a redCarded home piece itself, even when past halfway/ahead of ball with only 1 active opponent equal-or-ahead', () => {
      const redCardedHomeFwd: PlayerPiece = {
        ...basePlayer,
        id: 'redCardedHomeFwd',
        teamId: 'home',
        position: { q: 28, r: 10 },
        redCarded: true,
      };
      const state = makeState([homeCarrier, redCardedHomeFwd, awayActive]);
      expect(evaluateOffside(state)).not.toContain('redCardedHomeFwd');
    });

    it('drops a home piece from the result once it becomes redCarded, even though it was already in state.offsidePieceIds', () => {
      const nowDismissedHomeFwd: PlayerPiece = {
        ...basePlayer,
        id: 'nowDismissedHomeFwd',
        teamId: 'home',
        position: { q: 28, r: 10 },
        redCarded: true,
      };
      const state = makeState([homeCarrier, nowDismissedHomeFwd, awayActive], {
        offsidePieceIds: ['nowDismissedHomeFwd'],
      });
      expect(evaluateOffside(state)).not.toContain('nowDismissedHomeFwd');
    });
  });
});
