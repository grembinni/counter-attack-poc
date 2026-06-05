import { describe, it, expect } from 'vitest';
import { HOME_SQUAD, AWAY_SQUAD } from './teams.js';

const ATTRIBUTES = [
  'pace',
  'shooting',
  'tackling',
  'dribbling',
  'heading',
  'saving',
  'handling',
  'resilience',
  'aerialAbility',
  'highPass',
] as const;

/**
 * The 9 attributes that contribute to a player's tier total (all except highPass).
 * D-02: Tier totals count all 9 attributes (0s count as 0).
 */
const ATTRS = [
  'pace',
  'shooting',
  'tackling',
  'dribbling',
  'heading',
  'saving',
  'handling',
  'resilience',
  'aerialAbility',
] as const;

const VALID_ROLES = ['GK', 'DEF', 'MID', 'FWD'] as const;

/**
 * Role-based minimum values for attributes that are 0 for certain roles (D-05, D-06, D-07).
 * - aerialAbility: 0 for outfielders (DEF/MID/FWD); GKs have meaningful values (>= 1)
 * - handling: 0 for outfielders; GKs have meaningful values (>= 1)
 * - highPass: 0 for GKs (use kick accuracy rule instead); outfielders have meaningful values (>= 1)
 * All other attributes must be >= 1 for all roles.
 */
function minForAttr(attr: (typeof ATTRIBUTES)[number], role: string): number {
  if (attr === 'aerialAbility' && role !== 'GK') return 0;
  if (attr === 'handling' && role !== 'GK') return 0;
  if (attr === 'highPass' && role === 'GK') return 0;
  return 1;
}

/**
 * Returns the Counter Attack tier for a player's total attribute score (sum of 9 ATTRS).
 * Tier 1 = World Class (34+), Tier 2 = International (32-33), Tier 3 = Top Flight (30-31),
 * Tier 4 = Respected Pro (28-29), Tier 5 = Journeyman (26-27). D-03.
 */
function getTier(total: number): number {
  if (total >= 34) return 1;
  if (total >= 32) return 2;
  if (total >= 30) return 3;
  if (total >= 28) return 4;
  if (total >= 26) return 5;
  return 0; // below Tier 5 (should not occur in a valid squad)
}

describe('HOME_SQUAD', () => {
  it('contains exactly 11 players (TEAM-01)', () => {
    expect(HOME_SQUAD).toHaveLength(11);
  });

  it('each player has all 10 attributes as integers in role-adjusted range..6 (TEAM-01, D-01, D-05, D-06, D-07)', () => {
    for (const player of HOME_SQUAD) {
      for (const attr of ATTRIBUTES) {
        const val = player[attr];
        const min = minForAttr(attr, player.role);
        expect(Number.isInteger(val), `${player.id}.${attr} must be integer`).toBe(true);
        expect(val, `${player.id}.${attr} must be >= ${min}`).toBeGreaterThanOrEqual(min);
        expect(val, `${player.id}.${attr} must be <= 6`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('each player has a non-empty name and a valid role (TEAM-02)', () => {
    for (const player of HOME_SQUAD) {
      expect(player.name.length, `${player.id} name must be non-empty`).toBeGreaterThan(0);
      expect(VALID_ROLES.includes(player.role), `${player.id} role must be GK|DEF|MID|FWD`).toBe(
        true,
      );
    }
  });

  it('has exactly 1 GK per squad (TEAM-01)', () => {
    const gks = HOME_SQUAD.filter((p) => p.role === 'GK');
    expect(gks).toHaveLength(1);
  });

  it('all player ids are unique and follow the home- prefix scheme', () => {
    const ids = HOME_SQUAD.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(HOME_SQUAD.length);
    for (const id of ids) {
      expect(id.startsWith('home-')).toBe(true);
    }
  });

  it('teamId is home for every player', () => {
    for (const player of HOME_SQUAD) {
      expect(player.teamId).toBe('home');
    }
  });

  it('has the correct tier distribution 1/2/3/3/2 (D-03)', () => {
    const tierCounts = [0, 0, 0, 0, 0, 0]; // index 0 unused; indices 1-5 = tier counts
    for (const player of HOME_SQUAD) {
      const total = ATTRS.reduce((sum, a) => sum + player[a], 0);
      const tier = getTier(total);
      tierCounts[tier]++;
    }
    expect(tierCounts[1], 'Tier 1 (World Class, 34+): 1 player').toBe(1);
    expect(tierCounts[2], 'Tier 2 (International, 32-33): 2 players').toBe(2);
    expect(tierCounts[3], 'Tier 3 (Top Flight, 30-31): 3 players').toBe(3);
    expect(tierCounts[4], 'Tier 4 (Respected Pro, 28-29): 3 players').toBe(3);
    expect(tierCounts[5], 'Tier 5 (Journeyman, 26-27): 2 players').toBe(2);
  });
});

describe('AWAY_SQUAD', () => {
  it('contains exactly 11 players (TEAM-01)', () => {
    expect(AWAY_SQUAD).toHaveLength(11);
  });

  it('each player has all 10 attributes as integers in role-adjusted range..6 (TEAM-01, D-01, D-05, D-06, D-07)', () => {
    for (const player of AWAY_SQUAD) {
      for (const attr of ATTRIBUTES) {
        const val = player[attr];
        const min = minForAttr(attr, player.role);
        expect(Number.isInteger(val), `${player.id}.${attr} must be integer`).toBe(true);
        expect(val, `${player.id}.${attr} must be >= ${min}`).toBeGreaterThanOrEqual(min);
        expect(val, `${player.id}.${attr} must be <= 6`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('each player has a non-empty name and a valid role (TEAM-02)', () => {
    for (const player of AWAY_SQUAD) {
      expect(player.name.length, `${player.id} name must be non-empty`).toBeGreaterThan(0);
      expect(VALID_ROLES.includes(player.role), `${player.id} role must be GK|DEF|MID|FWD`).toBe(
        true,
      );
    }
  });

  it('has exactly 1 GK per squad (TEAM-01)', () => {
    const gks = AWAY_SQUAD.filter((p) => p.role === 'GK');
    expect(gks).toHaveLength(1);
  });

  it('all player ids are unique and follow the away- prefix scheme', () => {
    const ids = AWAY_SQUAD.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(AWAY_SQUAD.length);
    for (const id of ids) {
      expect(id.startsWith('away-')).toBe(true);
    }
  });

  it('teamId is away for every player', () => {
    for (const player of AWAY_SQUAD) {
      expect(player.teamId).toBe('away');
    }
  });

  it('has the correct tier distribution 1/2/3/3/2 (D-03)', () => {
    const tierCounts = [0, 0, 0, 0, 0, 0]; // index 0 unused; indices 1-5 = tier counts
    for (const player of AWAY_SQUAD) {
      const total = ATTRS.reduce((sum, a) => sum + player[a], 0);
      const tier = getTier(total);
      tierCounts[tier]++;
    }
    expect(tierCounts[1], 'Tier 1 (World Class, 34+): 1 player').toBe(1);
    expect(tierCounts[2], 'Tier 2 (International, 32-33): 2 players').toBe(2);
    expect(tierCounts[3], 'Tier 3 (Top Flight, 30-31): 3 players').toBe(3);
    expect(tierCounts[4], 'Tier 4 (Respected Pro, 28-29): 3 players').toBe(3);
    expect(tierCounts[5], 'Tier 5 (Journeyman, 26-27): 2 players').toBe(2);
  });
});
