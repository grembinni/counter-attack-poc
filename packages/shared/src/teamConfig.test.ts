import { describe, it, expect } from 'vitest';
import { TEAM_CONFIGS } from './teamConfig.js';
import type { TeamId } from './teamConfig.js';

const TEAM_IDS: TeamId[] = ['cosmos', 'xolos', 'city', 'crew'];

describe('TEAM_CONFIGS', () => {
  it('exports all four team ids', () => {
    expect(Object.keys(TEAM_CONFIGS)).toEqual(expect.arrayContaining(TEAM_IDS));
    expect(Object.keys(TEAM_CONFIGS)).toHaveLength(4);
  });

  it.each(TEAM_IDS)('%s.id strictly equals its key', (teamId) => {
    expect(TEAM_CONFIGS[teamId].id).toBe(teamId);
  });

  it.each(TEAM_IDS)('%s has a truthy name', (teamId) => {
    expect(TEAM_CONFIGS[teamId].name).toBeTruthy();
  });

  it.each(TEAM_IDS)('%s primaryColor matches /^#[0-9a-f]{6}$/i', (teamId) => {
    expect(TEAM_CONFIGS[teamId].primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(TEAM_IDS)('%s secondaryColor matches /^#[0-9a-f]{6}$/i', (teamId) => {
    expect(TEAM_CONFIGS[teamId].secondaryColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(TEAM_IDS)('%s badgeFile matches /\\.png$/', (teamId) => {
    expect(TEAM_CONFIGS[teamId].badgeFile).toMatch(/\.png$/);
  });

  it("TEAM_CONFIGS.cosmos.name === 'Cosmos' (not 'Cozmos')", () => {
    expect(TEAM_CONFIGS.cosmos.name).toBe('Cosmos');
  });
});
