import { describe, it, expect } from 'vitest';
import { CORNER_KICK_STAGES, cornerKickStageTeam } from './offside.js';

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
