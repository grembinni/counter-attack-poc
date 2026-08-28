import { describe, it, expect } from 'vitest';
import { computeShotXg, EMPTY_MATCH_STATS, recordShotInStats } from './matchStats.js';
import type { HexCoord, PlayerPiece } from './types.js';

/**
 * Small local factory — deliberately NOT importing squad/roster data (per 45-01-PLAN.md
 * Task 2's instruction) so this test suite has no coupling to team roster content.
 * Only `id`, `teamId`, and `position` vary per fixture; every other PlayerPiece field
 * gets an arbitrary but valid default.
 */
function makePiece(
  overrides: Partial<PlayerPiece> & { id: string; teamId: 'home' | 'away'; position: HexCoord },
): PlayerPiece {
  return {
    pace: 5,
    shooting: 5,
    tackling: 5,
    dribbling: 5,
    saving: 5,
    handling: 5,
    resilience: 5,
    aerialAbility: 5,
    highPass: 5,
    firstName: 'Test',
    lastName: 'Player',
    number: 1,
    nationality: 'Testland',
    role: 'DEF',
    ...overrides,
  };
}

describe('computeShotXg', () => {
  it('returns exactly 1 for zero defenders, on the goal line, on the centre row', () => {
    const xg = computeShotXg({ q: 36, r: 13 }, 'home', []);
    expect(xg).toBe(1);
    expect(xg).toBeGreaterThanOrEqual(0);
    expect(xg).toBeLessThanOrEqual(1);
  });

  it('reduces xg by the 0.13 factor for one active defender in the six-yard box', () => {
    const defender = makePiece({ id: 'd1', teamId: 'away', position: { q: 36, r: 13 } });
    const xg = computeShotXg({ q: 36, r: 13 }, 'home', [defender]);
    expect(xg).toBeCloseTo(0.87, 10);
    expect(xg).toBeGreaterThanOrEqual(0);
    expect(xg).toBeLessThanOrEqual(1);
  });

  it('reduces xg by the 0.10 factor for a defender in the penalty area but outside the six-yard box', () => {
    // q=32 is inside awayPenaltyArea (q∈[31,36]) but outside awaySixYardBox (q∈[35,36]).
    const defender = makePiece({ id: 'd1', teamId: 'away', position: { q: 32, r: 13 } });
    const xg = computeShotXg({ q: 36, r: 13 }, 'home', [defender]);
    expect(xg).toBeCloseTo(0.9, 10);
  });

  it('never double-counts a six-yard-box defender toward C', () => {
    // A single defender inside the six-yard box should only ever apply the 0.13 factor,
    // never also the 0.10 penalty-area factor.
    const defender = makePiece({ id: 'd1', teamId: 'away', position: { q: 36, r: 13 } });
    const xg = computeShotXg({ q: 36, r: 13 }, 'home', [defender]);
    expect(xg).toBeCloseTo(0.87, 10);
    expect(xg).not.toBeCloseTo(0.87 * 0.9, 10);
  });

  it('contributes to neither D nor C for a defender outside the penalty area', () => {
    const defender = makePiece({ id: 'd1', teamId: 'away', position: { q: 10, r: 13 } });
    const xg = computeShotXg({ q: 36, r: 13 }, 'home', [defender]);
    expect(xg).toBe(1);
  });

  it('excludes a red-carded piece in the six-yard box from D (isActivePiece filter)', () => {
    const redCarded = makePiece({
      id: 'd1',
      teamId: 'away',
      position: { q: 36, r: 13 },
      redCarded: true,
    });
    const xg = computeShotXg({ q: 36, r: 13 }, 'home', [redCarded]);
    expect(xg).toBe(1);
  });

  it('excludes an off-pitch piece in the six-yard box from D (isActivePiece filter)', () => {
    const offPitch = makePiece({
      id: 'd1',
      teamId: 'away',
      position: { q: 36, r: 13 },
      onPitch: false,
    });
    const xg = computeShotXg({ q: 36, r: 13 }, 'home', [offPitch]);
    expect(xg).toBe(1);
  });

  it('row factor: |r-13| <= 3 uses the 0.04 weight, |r-13| > 3 uses the 0.07 weight, and the two differ by more than one weight step', () => {
    const xgAtOffset3 = computeShotXg({ q: 36, r: 16 }, 'home', []); // |16-13| = 3
    const xgAtOffset4 = computeShotXg({ q: 36, r: 17 }, 'home', []); // |17-13| = 4

    expect(xgAtOffset3).toBeCloseTo(0.88, 10);
    expect(xgAtOffset4).toBeCloseTo(0.72, 10);
    // The jump across the threshold is larger than a single weight step (0.07) would
    // produce on its own — confirms the weight itself switches, not just the offset.
    expect(xgAtOffset3 - xgAtOffset4).toBeGreaterThan(0.07);
  });

  it('depth factor: X <= 3 uses the 0.04 weight, X > 3 uses the 0.07 weight', () => {
    const xgAtDepth3 = computeShotXg({ q: 33, r: 13 }, 'home', []); // X = |33-36| = 3
    const xgAtDepth4 = computeShotXg({ q: 32, r: 13 }, 'home', []); // X = |32-36| = 4

    expect(xgAtDepth3).toBeCloseTo(0.88, 10);
    expect(xgAtDepth4).toBeCloseTo(0.72, 10);
    expect(xgAtDepth3 - xgAtDepth4).toBeGreaterThan(0.07);
  });

  it('orientation (PD-02): a geometrically mirrored fixture yields the identical xg for the opposite team', () => {
    const homeDefender = makePiece({ id: 'd1', teamId: 'away', position: { q: 36, r: 13 } });
    const xgHome = computeShotXg({ q: 33, r: 16 }, 'home', [homeDefender]);

    // Mirror: q_away = 36 - q_home (per pitch.ts's PENALTY_SPOT mirroring convention).
    const awayDefender = makePiece({ id: 'd1', teamId: 'home', position: { q: 0, r: 13 } });
    const xgAway = computeShotXg({ q: 3, r: 16 }, 'away', [awayDefender]);

    expect(xgAway).toBeCloseTo(xgHome, 10);
  });

  it('clamping (PD-03): eight active defenders in the six-yard box yields exactly 0, not a negative number', () => {
    const defenders = Array.from({ length: 8 }, (_, i) =>
      makePiece({ id: `d${i}`, teamId: 'away', position: { q: 36, r: 13 } }),
    );
    const xg = computeShotXg({ q: 36, r: 13 }, 'home', defenders);
    expect(xg).toBe(0);
  });

  it('clamping (PD-03): a shot from q=0 while attacking q=36 combined with a crowded six-yard box yields exactly 0, not a positive number from two negative factors multiplying', () => {
    // Without per-factor clamping: defenderFactor = 1 - 10*0.13 = -0.3 (negative),
    // depthFactor = 1 - 36*0.07 = -1.52 (negative). Their unclamped product with the
    // other (positive) factors would be POSITIVE (-0.3 * -1.52 > 0) — exactly the
    // sign-flip hazard PD-03 guards against.
    const defenders = Array.from({ length: 10 }, (_, i) =>
      makePiece({ id: `d${i}`, teamId: 'away', position: { q: 36, r: 13 } }),
    );
    const xg = computeShotXg({ q: 0, r: 13 }, 'home', defenders);
    expect(xg).toBe(0);
  });

  it('is always within [0, 1] across every fixture in this suite', () => {
    const fixtures: Array<[HexCoord, 'home' | 'away', PlayerPiece[]]> = [
      [{ q: 36, r: 13 }, 'home', []],
      [{ q: 0, r: 13 }, 'away', []],
      [
        { q: 36, r: 13 },
        'home',
        [makePiece({ id: 'd1', teamId: 'away', position: { q: 36, r: 13 } })],
      ],
      [
        { q: 0, r: 0 },
        'home',
        Array.from({ length: 12 }, (_, i) =>
          makePiece({ id: `d${i}`, teamId: 'away', position: { q: 36, r: 13 } }),
        ),
      ],
      [
        { q: 18, r: 13 },
        'away',
        Array.from({ length: 12 }, (_, i) =>
          makePiece({ id: `d${i}`, teamId: 'home', position: { q: 0, r: 13 } }),
        ),
      ],
    ];

    for (const [shotHex, attackingTeam, defenders] of fixtures) {
      const xg = computeShotXg(shotHex, attackingTeam, defenders);
      expect(xg).toBeGreaterThanOrEqual(0);
      expect(xg).toBeLessThanOrEqual(1);
    }
  });
});

describe('recordShotInStats', () => {
  it('returns a new object with shots and xg incremented for the scoring team, leaving the other team and the input untouched', () => {
    const before = EMPTY_MATCH_STATS;
    const after = recordShotInStats(before, 'home', 0.42);

    expect(after).not.toBe(before);
    expect(after.shots.home).toBe(1);
    expect(after.xg.home).toBeCloseTo(0.42, 10);
    expect(after.shots.away).toBe(0);
    expect(after.xg.away).toBe(0);

    // Input untouched.
    expect(before.shots.home).toBe(0);
    expect(before.xg.home).toBe(0);
  });

  it('seeds from EMPTY_MATCH_STATS rather than throwing when stats is undefined', () => {
    const after = recordShotInStats(undefined, 'away', 0.1);

    expect(after.shots.away).toBe(1);
    expect(after.xg.away).toBeCloseTo(0.1, 10);
    expect(after.shots.home).toBe(0);
    expect(after.xg.home).toBe(0);
  });

  it('accumulates across multiple calls without mutating intermediate results', () => {
    const first = recordShotInStats(undefined, 'home', 0.3);
    const second = recordShotInStats(first, 'home', 0.5);

    expect(second.shots.home).toBe(2);
    expect(second.xg.home).toBeCloseTo(0.8, 10);
    // first is untouched by the second call.
    expect(first.shots.home).toBe(1);
    expect(first.xg.home).toBeCloseTo(0.3, 10);
  });
});
