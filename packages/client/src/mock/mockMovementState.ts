import type { GameState } from '@counter-attack/shared';
import { PLAYER_POOL } from '@counter-attack/shared';

/**
 * Home team positions on the 37×26 grid (overriding placeholder 25×16 positions).
 * Formation: 4-3-3 approximation on left half of pitch.
 */
const HOME_POSITIONS: Record<string, { q: number; r: number }> = {
  'home-0': { q: 1, r: 13 }, // GK
  'home-1': { q: 4, r: 7 }, // DEF 1
  'home-2': { q: 5, r: 10 }, // DEF 2
  'home-3': { q: 5, r: 16 }, // DEF 3
  'home-4': { q: 4, r: 19 }, // DEF 4
  'home-5': { q: 9, r: 8 }, // MID 1
  'home-6': { q: 10, r: 13 }, // MID 2
  'home-7': { q: 9, r: 18 }, // MID 3
  'home-8': { q: 14, r: 9 }, // FWD 1
  'home-9': { q: 14, r: 13 }, // FWD 2 (ball carrier)
  'home-10': { q: 14, r: 17 }, // FWD 3
};

/**
 * Away team positions on the 37×26 grid (mirror of home positions, q=36-home_q).
 */
const AWAY_POSITIONS: Record<string, { q: number; r: number }> = {
  'away-0': { q: 35, r: 13 }, // GK
  'away-1': { q: 32, r: 7 }, // DEF 1
  'away-2': { q: 31, r: 10 }, // DEF 2
  'away-3': { q: 31, r: 16 }, // DEF 3
  'away-4': { q: 32, r: 19 }, // DEF 4
  'away-5': { q: 27, r: 8 }, // MID 1
  'away-6': { q: 26, r: 13 }, // MID 2
  'away-7': { q: 27, r: 18 }, // MID 3
  'away-8': { q: 22, r: 9 }, // FWD 1
  'away-9': { q: 22, r: 13 }, // FWD 2
  'away-10': { q: 22, r: 17 }, // FWD 3
};

/**
 * Mock GameState for MOVEMENT phase with 37×26 grid positions.
 * Used as the default initial state for the Zustand store (D-10, D-11).
 * Phase 19: rebuilt from PLAYER_POOL filtered by sourceTeamId (city=home, crew=away).
 * selectedTeams uses city/crew — cosmos/xolos are no longer valid TeamId values (D-04).
 */
// WR-06: `: GameState` type annotation catches missing required fields at compile time.
// Note: `satisfies GameState` cannot be used here because tests rely on
// `Partial<typeof mockMovementState>` — `satisfies` would narrow the type to the literal
// object shape, excluding GameState fields not present in this mock (e.g. freeKickHex).
export const mockMovementState: GameState = {
  roomCode: 'MOCK1',
  phase: 'MOVE',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [
    ...PLAYER_POOL.filter((p) => p.sourceTeamId === 'city').map((p, i) => ({
      ...p,
      teamId: 'home' as const,
      id: `home-${i}`,
      position: HOME_POSITIONS[`home-${i}`] ?? p.position,
    })),
    ...PLAYER_POOL.filter((p) => p.sourceTeamId === 'crew').map((p, i) => ({
      ...p,
      teamId: 'away' as const,
      id: `away-${i}`,
      position: AWAY_POSITIONS[`away-${i}`] ?? { q: 36 - p.position.q, r: p.position.r },
    })),
  ],
  ball: { position: { q: 18, r: 13 }, carrierId: 'home-9', lastTouchedBy: null },
  score: { home: 0, away: 0 },
  actionCount: 3,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 4 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
  lastDiceRoll: null,
  // MOVE-06 (Phase 17, corrected design): ball at kick-off hex {q:18,r:13} — middleThird.
  ballZone: 'middle',
  // Phase 8 fields (D-06)
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
  selectedTeams: { home: 'city', away: 'crew' }, // D-04: cosmos/xolos no longer valid TeamId
  selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' }, // Phase 22 D-16
  gameSpeed: 'standard' as const, // UX-07 (Phase 18.4)
};
