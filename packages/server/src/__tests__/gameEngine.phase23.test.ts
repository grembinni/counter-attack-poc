/**
 * Phase 23 unit tests — formation-driven piece placement (FORM-04).
 *
 * Tests 1-7 verify buildKickOffPieces (which wraps buildSquadPieces) against
 * the FORMATIONS registry: positions, away mirror, kick-off +4 shift (GK exempt),
 * jersey-#9 striker anchor, jersey source, and FORMATIONS table immutability (T-23-01).
 *
 * Drives via buildKickOffPieces (exported) because buildSquadPieces is internal.
 * Uses 'city' (home) and 'crew' (away) — both have full 11-player squads in data/.
 */
import { describe, it, expect } from 'vitest';
import { FORMATIONS, PITCH_REGIONS } from '@counter-attack/shared';
import { buildKickOffPieces } from '../gameEngine.js';

const SELECTED_TEAMS = { home: 'city' as const, away: 'crew' as const };
const FORMATION_442 = { home: '4-4-2' as const, away: '4-4-2' as const };

// 4-4-2 slot index 2 = RCB: position {q:6,r:10}, jerseyNumber:4
const RCB_SLOT = FORMATIONS['4-4-2'].slots[2]!;

describe('Phase 23 — formation-driven placement (FORM-04)', () => {
  it('Test 1: non-kicking home pieces use FORMATIONS positions (no shift)', () => {
    // away kicks off → home is non-kicking → home outfield not shifted
    const pieces = buildKickOffPieces('away', SELECTED_TEAMS, FORMATION_442);
    const homeRCB = pieces.find((p) => p.teamId === 'home' && p.number === RCB_SLOT.jerseyNumber);
    expect(homeRCB, 'home RCB must exist').toBeDefined();
    expect(homeRCB!.position).toEqual({ q: 6, r: 10 });
  });

  it('Test 2: away pieces mirror home positions (q_away = 36 - q_home)', () => {
    // home kicks off → away is non-kicking → away positions are pure mirror (no shift)
    const pieces = buildKickOffPieces('home', SELECTED_TEAMS, FORMATION_442);
    // away slot index 2: mirror of home q=6 → q=30, same r=10
    const awayRCB = pieces.find((p) => p.teamId === 'away' && p.number === RCB_SLOT.jerseyNumber);
    expect(awayRCB, 'away RCB must exist').toBeDefined();
    expect(awayRCB!.position).toEqual({ q: 30, r: 10 });
  });

  it('Test 3: kicking home outfield shifted +4; non-kicking away unchanged', () => {
    // home kicks → home outfield q += 4; away (non-kicking) stays at mirror position
    const pieces = buildKickOffPieces('home', SELECTED_TEAMS, FORMATION_442);
    const homeRCB = pieces.find((p) => p.teamId === 'home' && p.number === RCB_SLOT.jerseyNumber);
    const awayRCB = pieces.find((p) => p.teamId === 'away' && p.number === RCB_SLOT.jerseyNumber);
    expect(homeRCB, 'home RCB must exist').toBeDefined();
    expect(awayRCB, 'away RCB must exist').toBeDefined();
    // Home RCB: formation q=6, after +4 = 10
    expect(homeRCB!.position).toEqual({ q: 10, r: 10 });
    // Away RCB: non-kicking, stays at mirror = 36-6=30
    expect(awayRCB!.position).toEqual({ q: 30, r: 10 });
  });

  it('Test 4: GK exempt from kick-off shift in both directions', () => {
    // home kicking: home GK not shifted (stays q=2); away GK not shifted (stays q=34)
    const homePieces = buildKickOffPieces('home', SELECTED_TEAMS, FORMATION_442);
    const awayPieces = buildKickOffPieces('away', SELECTED_TEAMS, FORMATION_442);

    const homeGK = homePieces.find((p) => p.teamId === 'home' && p.role === 'GK');
    const awayGK = awayPieces.find((p) => p.teamId === 'away' && p.role === 'GK');

    expect(homeGK, 'home GK must exist').toBeDefined();
    expect(awayGK, 'away GK must exist').toBeDefined();
    expect(homeGK!.position).toEqual({ q: 2, r: 13 });
    expect(awayGK!.position).toEqual({ q: 34, r: 13 }); // 36 - 2 = 34
  });

  it('Test 5: kicking team jersey-#9 piece anchored to kick-off hex', () => {
    // home kicks → home #9 must be at PITCH_REGIONS.kickOffHex {q:18,r:13}
    const pieces = buildKickOffPieces('home', SELECTED_TEAMS, FORMATION_442);
    const homeStriker = pieces.find((p) => p.teamId === 'home' && p.number === 9);
    expect(homeStriker, 'home #9 must exist').toBeDefined();
    expect(homeStriker!.position).toEqual(PITCH_REGIONS.kickOffHex);
  });

  it('Test 6: piece jersey number comes from formation slot (not squad number)', () => {
    const pieces = buildKickOffPieces('home', SELECTED_TEAMS, FORMATION_442);
    // Kicking-team striker is identified by number=9 (formation slot), not role
    const homeStriker = pieces.find((p) => p.teamId === 'home' && p.number === 9);
    expect(homeStriker, 'home #9 piece must exist').toBeDefined();
    expect(homeStriker!.number).toBe(9);
    // Verify RCB jersey comes from slot (jerseyNumber=4), not whatever the squad player's number was
    const homeRCB = pieces.find((p) => p.teamId === 'home' && p.number === 4);
    expect(homeRCB, 'home #4 (RCB) piece must exist').toBeDefined();
  });

  it('Test 7: FORMATIONS table is not mutated across two buildKickOffPieces calls', () => {
    // Pitfall 1: buildSquadPieces must spread positions, never mutate the readonly slot object
    const slotPositionBefore = { ...FORMATIONS['4-4-2'].slots[2]!.position };

    buildKickOffPieces('home', SELECTED_TEAMS, FORMATION_442);
    buildKickOffPieces('away', SELECTED_TEAMS, FORMATION_442);

    expect(FORMATIONS['4-4-2'].slots[2]!.position).toEqual(slotPositionBefore);
  });
});
