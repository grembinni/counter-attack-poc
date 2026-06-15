/**
 * Phase 16 Wave 0 RED tests — PLAY-01, SELECT-01
 *
 * These tests import symbols that do not yet exist (TEAM_SQUADS, FREE_AGENTS).
 * They are expected to fail to compile / fail at runtime until production plans
 * 02–04 land. Do NOT add production code to make them pass in this plan.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — TEAM_SQUADS and FREE_AGENTS do not exist yet (Wave 0 RED state, PLAY-01)
import { TEAM_SQUADS, FREE_AGENTS } from './teams.js';

const VALID_ROLES = ['GK', 'DEF', 'MID', 'FWD', 'ST'] as const;

const ATTRIBUTES = [
  'pace',
  'shooting',
  'tackling',
  'dribbling',
  'saving',
  'handling',
  'resilience',
  'aerialAbility',
  'highPass',
] as const;

/**
 * Role-based minimum values for attributes that are 0 for certain roles (D-05, D-06, D-07).
 * - aerialAbility: 0 for outfielders; GKs have meaningful values (>= 1)
 * - handling: 0 for outfielders; GKs have meaningful values (>= 1)
 * - saving: 0 for outfielders; GKs have meaningful values (>= 1)
 * - highPass: 0 for GKs (use kick accuracy rule instead); outfielders >= 1
 */
function minForAttr(attr: (typeof ATTRIBUTES)[number], role: string): number {
  if (attr === 'aerialAbility' && role !== 'GK') return 0;
  if (attr === 'handling' && role !== 'GK') return 0;
  if (attr === 'saving' && role !== 'GK') return 0;
  if (attr === 'highPass' && role === 'GK') return 0;
  return 1;
}

// ---------------------------------------------------------------------------
// TEAM_SQUADS shape — PLAY-01
// ---------------------------------------------------------------------------

describe('TEAM_SQUADS — PLAY-01: four named squads exist', () => {
  it('exports exactly the four expected team ids (cosmos, xolos, city, crew)', () => {
    // TEAM_SQUADS is a Record<TeamId, readonly PlayerPiece[]>
    const keys = Object.keys(TEAM_SQUADS).sort();
    expect(keys).toEqual(['city', 'cosmos', 'crew', 'xolos']);
  });

  it('each squad has exactly 11 players (TEAM-01)', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      expect(TEAM_SQUADS[teamId], `${teamId} squad`).toHaveLength(11);
    }
  });

  it('each squad has exactly 1 GK (TEAM-01)', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      const gks = TEAM_SQUADS[teamId].filter((p: { role: string }) => p.role === 'GK');
      expect(gks, `${teamId} GK count`).toHaveLength(1);
    }
  });

  it('the GK in each squad has number === 1 (D-04)', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      const gk = TEAM_SQUADS[teamId].find((p: { role: string }) => p.role === 'GK');
      expect(gk, `${teamId} has GK`).toBeDefined();
      expect(gk.number, `${teamId} GK number`).toBe(1);
    }
  });

  it('the GK in each squad has highPass === 0 (D-04 / Pitfall 3)', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      const gk = TEAM_SQUADS[teamId].find((p: { role: string }) => p.role === 'GK');
      expect(gk.highPass, `${teamId} GK highPass must be 0`).toBe(0);
    }
  });

  it('jersey numbers within each squad are the set 1..11 with no duplicates (D-04)', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      const numbers: number[] = TEAM_SQUADS[teamId].map((p: { number: number }) => p.number);
      const unique = new Set(numbers);
      expect(unique.size, `${teamId} numbers are unique`).toBe(11);
      expect(
        numbers.sort((a: number, b: number) => a - b),
        `${teamId} numbers are 1..11`,
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    }
  });

  it('every player has non-empty firstName and lastName (replaces name check — PLAY-01, D-06)', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      for (const player of TEAM_SQUADS[teamId]) {
        expect(
          player.firstName.length,
          `${teamId} player ${player.id} firstName must be non-empty`,
        ).toBeGreaterThan(0);
        expect(
          player.lastName.length,
          `${teamId} player ${player.id} lastName must be non-empty`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('every player has a non-empty nationality (PLAY-01, D-06)', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      for (const player of TEAM_SQUADS[teamId]) {
        expect(
          player.nationality.length,
          `${teamId} player ${player.id} nationality must be non-empty`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('NO player object has a "name" key — name field removed (PLAY-01, D-06)', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      for (const player of TEAM_SQUADS[teamId]) {
        expect('name' in player, `${teamId} player ${player.id} must not have a "name" key`).toBe(
          false,
        );
      }
    }
  });

  it('every player role is one of GK|DEF|MID|FWD|ST (proves STR→ST mapping — Pitfall 2)', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      for (const player of TEAM_SQUADS[teamId]) {
        expect(
          VALID_ROLES.includes(player.role),
          `${teamId} player ${player.id} role "${player.role}" must be valid`,
        ).toBe(true);
      }
    }
  });

  it('each player in each squad has all 10 attributes as integers in role-adjusted range..6', () => {
    for (const teamId of ['cosmos', 'xolos', 'city', 'crew'] as const) {
      for (const player of TEAM_SQUADS[teamId]) {
        for (const attr of ATTRIBUTES) {
          const val = player[attr];
          const min = minForAttr(attr, player.role);
          expect(Number.isInteger(val), `${teamId} ${player.id}.${attr} must be integer`).toBe(
            true,
          );
          expect(val, `${teamId} ${player.id}.${attr} must be >= ${min}`).toBeGreaterThanOrEqual(
            min,
          );
          expect(val, `${teamId} ${player.id}.${attr} must be <= 6`).toBeLessThanOrEqual(6);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// FREE_AGENTS — PLAY-01, PLAY-03
// ---------------------------------------------------------------------------

describe('FREE_AGENTS — PLAY-01 / PLAY-03: stored but not selectable', () => {
  it('FREE_AGENTS has exactly 24 players (PLAY-01)', () => {
    expect(FREE_AGENTS).toHaveLength(24);
  });

  it('every FREE_AGENT player has non-empty firstName, lastName, nationality (PLAY-01)', () => {
    for (const player of FREE_AGENTS) {
      expect(player.firstName.length, `FA player ${player.id} firstName`).toBeGreaterThan(0);
      expect(player.lastName.length, `FA player ${player.id} lastName`).toBeGreaterThan(0);
      expect(player.nationality.length, `FA player ${player.id} nationality`).toBeGreaterThan(0);
    }
  });

  it('every FREE_AGENT role is one of GK|DEF|MID|FWD|ST', () => {
    for (const player of FREE_AGENTS) {
      expect(
        VALID_ROLES.includes(player.role),
        `FA player ${player.id} role "${player.role}" must be valid`,
      ).toBe(true);
    }
  });

  it('NO FREE_AGENT has a "name" key (D-06)', () => {
    for (const player of FREE_AGENTS) {
      expect('name' in player, `FA player ${player.id} must not have a "name" key`).toBe(false);
    }
  });
});
