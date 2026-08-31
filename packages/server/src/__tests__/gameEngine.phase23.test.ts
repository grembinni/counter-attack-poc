/**
 * Phase 23 unit tests — formation-driven piece placement (FORM-04).
 *
 * Tests 1-7 verify buildKickOffPieces (which wraps buildSquadPieces) against
 * the FORMATIONS registry: positions, away mirror, kick-off +4 shift (GK exempt),
 * ST-slot striker anchor, jersey source, and FORMATIONS table immutability (T-23-01).
 *
 * Drives via buildKickOffPieces (exported) because buildSquadPieces is internal.
 * Uses 'city' (home) and 'crew' (away) — both have full 11-player squads in data/.
 */
import { describe, it, expect } from 'vitest';
import { FORMATIONS, PITCH_REGIONS, getSquadPlayers } from '@counter-attack/shared';
import type { FormationId } from '@counter-attack/shared';
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

  it('NUMBER-03: the kicking team ST-slot occupant is anchored to the kick-off hex in every formation, home- and away-attacking', () => {
    // 4 formations x 2 attacking sides = 8 combinations. `pieces` is always
    // `[...homeSquad, ...awaySquad]` with a 1:1 slot-to-player index mapping
    // (buildSquadPieces), so the home squad occupies pieces[0..10] and the away
    // squad occupies pieces[11..21].
    const formationIds = Object.keys(FORMATIONS) as FormationId[];
    for (const formationId of formationIds) {
      const stSlotIndex = FORMATIONS[formationId].slots.findIndex((s) => s.slotId === 'ST');
      expect(stSlotIndex, `${formationId} must have an ST slot`).not.toBe(-1);

      for (const attackingTeam of ['home', 'away'] as const) {
        const pieces = buildKickOffPieces(attackingTeam, SELECTED_TEAMS, {
          home: formationId,
          away: formationId,
        });
        const attackingIndex = attackingTeam === 'home' ? stSlotIndex : 11 + stSlotIndex;
        const defendingIndex = attackingTeam === 'home' ? 11 + stSlotIndex : stSlotIndex;
        const attackingPiece = pieces[attackingIndex]!;
        const defendingPiece = pieces[defendingIndex]!;

        expect(
          attackingPiece.position,
          `${formationId}/${attackingTeam}-attacking: attacking ST-slot occupant must be at kickOffHex`,
        ).toEqual(PITCH_REGIONS.kickOffHex);
        expect(
          defendingPiece.position,
          `${formationId}/${attackingTeam}-attacking: defending ST-slot occupant must NOT be at kickOffHex`,
        ).not.toEqual(PITCH_REGIONS.kickOffHex);
      }
    }
  });

  it('D-01: a starting-XI piece number comes from its formation slot, resolved by slot index', () => {
    const pieces = buildKickOffPieces('home', SELECTED_TEAMS, FORMATION_442);
    const stSlotIndex = FORMATIONS['4-4-2'].slots.findIndex((s) => s.slotId === 'ST');
    expect(stSlotIndex, '4-4-2 must have an ST slot').not.toBe(-1);
    // Kicking-team striker is resolved by slot index (not by number lookup); its number
    // must match the formation slot's own authored jerseyNumber.
    expect(pieces[stSlotIndex]!.number).toBe(FORMATIONS['4-4-2'].slots[stSlotIndex]!.jerseyNumber);
    // Verify RCB jersey comes from slot (jerseyNumber=4), not whatever the squad player's number was
    const rcbSlotIndex = FORMATIONS['4-4-2'].slots.findIndex((s) => s.jerseyNumber === 4);
    expect(rcbSlotIndex, '4-4-2 must have a jerseyNumber=4 slot').not.toBe(-1);
    expect(pieces[rcbSlotIndex]!.number).toBe(4);
  });

  it('NUMBER-03: the anchored piece is identified by slot index, independently of the number it wears', () => {
    // This test cannot be made to fail against the old number-keyed anchor implementation:
    // all four formations author the ST slot with the same incidental jersey number
    // (see formations.test.ts), so the number-keyed and slot-keyed lookups coincide today.
    // Its value is locking the slot-keyed contract in place for any future formation that
    // does NOT give its ST slot that same incidental jersey number.
    const pieces = buildKickOffPieces('home', SELECTED_TEAMS, FORMATION_442);
    const stSlotIndex = FORMATIONS['4-4-2'].slots.findIndex((s) => s.slotId === 'ST');
    expect(stSlotIndex, '4-4-2 must have an ST slot').not.toBe(-1);
    const anchoredPiece = pieces[stSlotIndex]!;

    // (1) the piece at the home ST slot index is at the kick-off hex
    expect(anchoredPiece.position).toEqual(PITCH_REGIONS.kickOffHex);

    // (2) exactly one home piece sits on that hex
    const homePiecesOnHex = pieces.filter(
      (p) =>
        p.teamId === 'home' &&
        p.position.q === PITCH_REGIONS.kickOffHex.q &&
        p.position.r === PITCH_REGIONS.kickOffHex.r,
    );
    expect(homePiecesOnHex.length).toBe(1);

    // (3) the anchored piece's playerId equals the id of the pool player at the same
    // slot index in the default squad order — proving the anchor identifies a SLOT OCCUPANT
    const defaultHomeSquad = getSquadPlayers(SELECTED_TEAMS.home);
    expect(anchoredPiece.playerId).toBe(defaultHomeSquad[stSlotIndex]!.id);
  });

  it('Test 7: FORMATIONS table is not mutated across two buildKickOffPieces calls', () => {
    // Pitfall 1: buildSquadPieces must spread positions, never mutate the readonly slot object
    const slotPositionBefore = { ...FORMATIONS['4-4-2'].slots[2]!.position };

    buildKickOffPieces('home', SELECTED_TEAMS, FORMATION_442);
    buildKickOffPieces('away', SELECTED_TEAMS, FORMATION_442);

    expect(FORMATIONS['4-4-2'].slots[2]!.position).toEqual(slotPositionBefore);
  });
});
