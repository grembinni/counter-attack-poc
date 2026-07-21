/**
 * Phase 19 DATA-01/DATA-02: PLAYER_POOL shape and team resolution tests.
 * Replaces the Phase 16 TEAM_SQUADS/FREE_AGENTS tests (now removed per D-12).
 */
import { describe, it, expect } from 'vitest';
import { PLAYER_POOL } from './teams.js';
import { getSquadPlayers } from './teamConfig.js';

const VALID_ROLES = ['GK', 'DEF', 'MID', 'FWD', 'ST'] as const;

// ---------------------------------------------------------------------------
// PLAYER_POOL — DATA-01
// ---------------------------------------------------------------------------

describe('PLAYER_POOL — DATA-01: unified flat player pool', () => {
  it('has the expected total player count (4 MLS + 8 national squads + FA)', () => {
    // 4 MLS teams × 11 = 44; 8 national × 11 = 88; 56 free agents
    // Total = 44 + 88 + 56 = 188
    expect(PLAYER_POOL).toHaveLength(188);
  });

  it('all player IDs are unique', () => {
    const ids = PLAYER_POOL.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(PLAYER_POOL.length);
  });

  it('all player IDs match /^p\\d{3}$/', () => {
    for (const p of PLAYER_POOL) {
      expect(p.id).toMatch(/^p\d{3}$/);
    }
  });

  it('IDs are assigned sequentially starting at p001', () => {
    expect(PLAYER_POOL[0].id).toBe('p001');
    expect(PLAYER_POOL[PLAYER_POOL.length - 1].id).toBe('p188');
  });

  it('every PoolPlayer has a sourceTeamId string', () => {
    for (const p of PLAYER_POOL) {
      expect(typeof p.sourceTeamId).toBe('string');
      expect(p.sourceTeamId.length).toBeGreaterThan(0);
    }
  });

  it('free-agent sourceTeamId exists (PLAYER_POOL has free-agent entries)', () => {
    const fas = PLAYER_POOL.filter((p) => p.sourceTeamId === 'free-agent');
    expect(fas.length).toBeGreaterThan(0);
  });

  it('every PoolPlayer has a defined aerialAbility >= 0 (D-13: confirms typo fix works)', () => {
    for (const p of PLAYER_POOL) {
      expect(typeof p.aerialAbility).toBe('number');
      expect(p.aerialAbility).toBeGreaterThanOrEqual(0);
    }
  });

  it('GK players have aerialAbility > 0 (header fix verification — GKs have non-blank Aerial Ability in CSVs)', () => {
    // GKs have explicit Aerial Ability values in all CSVs (e.g., cosmos GK = 6).
    // Outfield players have blank CSV values for this column (aerialAbility = 0 is correct for them).
    // This test confirms the header key lookup works — before the fix it would return 0 for GKs too.
    const gks = PLAYER_POOL.filter((p) => p.role === 'GK');
    const withAerialAbility = gks.filter((p) => p.aerialAbility > 0);
    expect(withAerialAbility.length).toBeGreaterThan(0);
  });

  it('every PoolPlayer role is one of GK|DEF|MID|FWD|ST', () => {
    for (const p of PLAYER_POOL) {
      expect(VALID_ROLES.includes(p.role)).toBe(true);
    }
  });

  it('every PoolPlayer has all required stat fields as numbers', () => {
    const STAT_FIELDS = [
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
    for (const p of PLAYER_POOL) {
      for (const field of STAT_FIELDS) {
        expect(typeof p[field], `${p.id}.${field} must be a number`).toBe('number');
        expect(Number.isInteger(p[field]), `${p.id}.${field} must be integer`).toBe(true);
      }
    }
  });

  it('PoolPlayer does NOT have a "heading" field (D-01 Phase 17)', () => {
    for (const p of PLAYER_POOL) {
      expect('heading' in p).toBe(false);
    }
  });

  it('PoolPlayer does NOT have a "teamId" field', () => {
    for (const p of PLAYER_POOL) {
      expect('teamId' in p).toBe(false);
    }
  });

  it('MLS squad sourceTeamIds are present (city, crew, la, miami, nashville, seattle)', () => {
    const slugs = new Set(PLAYER_POOL.map((p) => p.sourceTeamId));
    expect(slugs.has('city')).toBe(true);
    expect(slugs.has('crew')).toBe(true);
    expect(slugs.has('la')).toBe(true);
    expect(slugs.has('miami')).toBe(true);
    expect(slugs.has('nashville')).toBe(true);
    expect(slugs.has('seattle')).toBe(true);
  });

  it('international squad sourceTeamIds are present (canada, england, france, mexico, spain, us)', () => {
    const slugs = new Set(PLAYER_POOL.map((p) => p.sourceTeamId));
    expect(slugs.has('canada')).toBe(true);
    expect(slugs.has('england')).toBe(true);
    expect(slugs.has('france')).toBe(true);
    expect(slugs.has('mexico')).toBe(true);
    expect(slugs.has('spain')).toBe(true);
    expect(slugs.has('us')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getSquadPlayers — DATA-02
// ---------------------------------------------------------------------------

describe('getSquadPlayers — DATA-02: squad resolution from PLAYER_POOL', () => {
  it('getSquadPlayers("city") returns exactly 11 players', () => {
    expect(getSquadPlayers('city')).toHaveLength(11);
  });

  it('getSquadPlayers("crew") returns exactly 11 players', () => {
    expect(getSquadPlayers('crew')).toHaveLength(11);
  });

  it('city squad players all have sourceTeamId === "city"', () => {
    const players = getSquadPlayers('city');
    for (const p of players) {
      expect(p.sourceTeamId).toBe('city');
    }
  });

  it('crew squad players all have sourceTeamId === "crew"', () => {
    const players = getSquadPlayers('crew');
    for (const p of players) {
      expect(p.sourceTeamId).toBe('crew');
    }
  });

  it('city squad GK is at number 1', () => {
    const players = getSquadPlayers('city');
    const gk = players.find((p) => p.role === 'GK');
    expect(gk).toBeDefined();
    expect(gk.number).toBe(1);
  });

  it('crew squad GK is at number 1', () => {
    const players = getSquadPlayers('crew');
    const gk = players.find((p) => p.role === 'GK');
    expect(gk).toBeDefined();
    expect(gk.number).toBe(1);
  });

  it('city squad players all have sourceTeamId city', () => {
    const players = getSquadPlayers('city');
    expect(players.length).toBe(11);
    expect(players.every((p) => p.sourceTeamId === 'city')).toBe(true);
  });

  it('crew squad players all have sourceTeamId crew', () => {
    const players = getSquadPlayers('crew');
    expect(players.length).toBe(11);
    expect(players.every((p) => p.sourceTeamId === 'crew')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PoolPlayer poolTag — DRAFT-04 / D-01 / D-02 / D-03
// ---------------------------------------------------------------------------

describe('PoolPlayer poolTag — DRAFT-04 / D-01 / D-02 / D-03: reserved Legends/Icons tagging', () => {
  it('exactly 10 players have a defined poolTag; 5 legend and 5 icon', () => {
    const tagged = PLAYER_POOL.filter((p) => p.poolTag !== undefined);
    expect(tagged).toHaveLength(10);
    expect(tagged.filter((p) => p.poolTag === 'legend')).toHaveLength(5);
    expect(tagged.filter((p) => p.poolTag === 'icon')).toHaveLength(5);
  });

  it('the 5 legends match the expected players', () => {
    const legends = PLAYER_POOL.filter((p) => p.poolTag === 'legend');
    const names = legends.map((p) => `${p.firstName} ${p.lastName}`.trim());
    expect(names).toContain('Diego Maradona');
    expect(names).toContain('Paolo Maldini');
    expect(names).toContain('Pelé');
    expect(names).toContain('Ronaldinho');
    expect(names).toContain('Zinedine Zidane');
  });

  it('the 5 icons match the expected players', () => {
    const icons = PLAYER_POOL.filter((p) => p.poolTag === 'icon');
    const names = icons.map((p) => `${p.firstName} ${p.lastName}`.trim());
    expect(names).toContain('Cristiano Ronaldo');
    expect(names).toContain('Erling Haaland');
    expect(names).toContain('Kevin De Bruyne');
    expect(names).toContain('Neymar Jr');
    expect(names).toContain('Virgil van Dijk');
  });

  it('no player firstName or lastName contains a (L) or (M) suffix', () => {
    for (const p of PLAYER_POOL) {
      expect(p.firstName).not.toMatch(/\((L|M)\)/);
      expect(p.lastName).not.toMatch(/\((L|M)\)/);
    }
  });

  it('mononym Pelé has empty lastName and poolTag legend', () => {
    const pele = PLAYER_POOL.find((p) => p.firstName === 'Pelé');
    expect(pele).toBeDefined();
    expect(pele.lastName).toBe('');
    expect(pele.poolTag).toBe('legend');
  });

  it('mononym Ronaldinho has empty lastName and poolTag legend', () => {
    const ronaldinho = PLAYER_POOL.find((p) => p.firstName === 'Ronaldinho');
    expect(ronaldinho).toBeDefined();
    expect(ronaldinho.lastName).toBe('');
    expect(ronaldinho.poolTag).toBe('legend');
  });

  it('decoys Neymar Andre and Cristiano Ribeiro stay untagged', () => {
    const neymarAndre = PLAYER_POOL.find((p) => p.firstName === 'Neymar' && p.lastName === 'Andre');
    const cristianoRibeiro = PLAYER_POOL.find(
      (p) => p.firstName === 'Cristiano' && p.lastName === 'Ribeiro',
    );
    expect(neymarAndre).toBeDefined();
    expect(neymarAndre.poolTag).toBeUndefined();
    expect(cristianoRibeiro).toBeDefined();
    expect(cristianoRibeiro.poolTag).toBeUndefined();
  });

  it("'original' pool derivation (free-agent AND no poolTag) yields exactly 46 players", () => {
    const original = PLAYER_POOL.filter((p) => p.sourceTeamId === 'free-agent' && !p.poolTag);
    expect(original).toHaveLength(46);
    expect(original.filter((p) => p.role === 'GK')).toHaveLength(4);
  });
});
