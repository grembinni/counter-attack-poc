import { describe, it, expect } from 'vitest';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';
import { teamAccentColor, useTeamAccentColor } from './useTeamColors.js';

// Pick a concrete valid team id by reading an actual key of TEAM_CONFIGS.
const VALID_TEAM_ID = Object.keys(TEAM_CONFIGS)[0] as TeamId;

describe('teamAccentColor', () => {
  it('returns TEAM_CONFIGS[teamId].palette.uiColor for a valid teamId', () => {
    expect(teamAccentColor(VALID_TEAM_ID)).toBe(TEAM_CONFIGS[VALID_TEAM_ID].palette.uiColor);
  });

  it("returns '#888888' for undefined", () => {
    expect(teamAccentColor(undefined)).toBe('#888888');
  });

  it("returns '#888888' for an unknown teamId (TEAM_CONFIGS miss fallback)", () => {
    expect(teamAccentColor('not-a-real-team' as TeamId)).toBe('#888888');
  });
});

describe('useTeamAccentColor', () => {
  it('returns the identical value to teamAccentColor for the same input (pass-through, no store subscription)', () => {
    expect(useTeamAccentColor(VALID_TEAM_ID)).toBe(teamAccentColor(VALID_TEAM_ID));
    expect(useTeamAccentColor(undefined)).toBe(teamAccentColor(undefined));
  });
});
