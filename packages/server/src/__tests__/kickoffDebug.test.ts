import { describe, it, expect } from 'vitest';
import { buildInitialGameState, applyKickOffReady } from '../gameEngine.js';
import { isInRegion, PITCH_REGIONS } from '@counter-attack/shared';

describe('kickoff debug', () => {
  it('applyKickOffReady passes for both teams after driveToKickOff seeding', () => {
    const state = buildInitialGameState('TEST', { home: 'cosmos', away: 'xolos' });
    const kickOffHex = PITCH_REGIONS.kickOffHex;
    const attackingTeam = state.attackingTeam;
    const defendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';

    // Simulate driveToKickOff seeding
    let pieces = state.pieces;
    const hasCentreHex = pieces.some(
      (p) =>
        p.teamId === attackingTeam &&
        p.position.q === kickOffHex.q &&
        p.position.r === kickOffHex.r,
    );

    if (!hasCentreHex) {
      const firstAttacking = pieces.find((p) => p.teamId === attackingTeam)!;
      pieces = pieces.map((p) => (p.id === firstAttacking.id ? { ...p, position: kickOffHex } : p));
    }

    pieces = pieces.map((p) => {
      if (p.teamId !== defendingTeam) return p;
      const safeHex = defendingTeam === 'away' ? { q: 30, r: 20 } : { q: 5, r: 20 };
      if (isInRegion(p.position, 'centreCircle')) return { ...p, position: safeHex };
      if (defendingTeam === 'home' && p.position.q > kickOffHex.q)
        return { ...p, position: { q: 5, r: p.position.r } };
      if (defendingTeam === 'away' && p.position.q < kickOffHex.q)
        return { ...p, position: { q: 30, r: p.position.r } };
      return p;
    });

    const seededState = { ...state, pieces };

    const attackingResult = applyKickOffReady(seededState, attackingTeam);
    const defendingResult = applyKickOffReady(seededState, defendingTeam);

    expect(attackingResult.ok).toBe(true);
    expect(defendingResult.ok).toBe(true);
  });
});
