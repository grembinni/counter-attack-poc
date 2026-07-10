/**
 * Phase 24 unit tests — computeAutoAssignment and scoreForRole (ASSIGN-01).
 *
 * RED state: tests import computeAutoAssignment and scoreForRole from gameEngine.ts,
 * which do not yet exist. Tests MUST fail until Task 2 (GREEN) adds the implementation.
 *
 * Test coverage:
 *  1. GK locked to slot index 0
 *  2. No duplicates / full coverage per formation (all 4 formations)
 *  3. Anchor roles filled before flex roles
 *  4. Tie-break by lower source-team index
 *  5. scoreForRole FWD-central D-04 formula
 *  6. scoreForRole MID-central D-04 formula
 *  7. scoreForRole DEF-back D-04 formula
 *  8. scoreForRole FWD-wing D-04 formula (role==='ST' receives NO wing bonus)
 */

import { describe, it, expect } from 'vitest';
import { computeAutoAssignment, scoreForRole } from '../gameEngine.js';
import { FORMATIONS } from '@counter-attack/shared';
import { getSquadPlayers } from '@counter-attack/shared';
import type { PoolPlayer } from '@counter-attack/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal PoolPlayer with sensible defaults for any omitted field. */
function mkP(
  id: string,
  role: PoolPlayer['role'],
  overrides: Partial<Omit<PoolPlayer, 'id' | 'role'>> = {},
): PoolPlayer {
  return {
    id,
    sourceTeamId: 'test-team',
    firstName: 'Player',
    lastName: id,
    number: 1,
    nationality: 'Test',
    role,
    position: { q: 0, r: 0 },
    pace: 1,
    shooting: 1,
    tackling: 1,
    dribbling: 1,
    saving: 1,
    handling: 1,
    resilience: 1,
    aerialAbility: 1,
    highPass: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Synthetic squad for anchor / tie-break tests
// ---------------------------------------------------------------------------

/**
 * 11-player squad designed to exercise anchor-before-flex ordering.
 *
 * strongDef (origIdx=1): tackling=6, aerialAbility=6, pace=6, role=DEF
 *   DEF-center score = 6+6+2 = 14  (anchor)
 *   DEF-back  score = 6+6+2 = 14   (flex)
 * Both scores are the same — if anchor is processed first the player lands in
 * a DEF-center slot (4-4-2 slot index 2 = RCB); if flex were processed first
 * they would be placed in a DEF-back slot (slot index 1 = RB).
 *
 * All other outfield players score ≤ 4 for DEF-center / DEF-back so strongDef
 * is unambiguously the best pick for either slot.
 */
const ANCHOR_SQUAD: PoolPlayer[] = [
  mkP('gk', 'GK'), // origIdx 0 — locked to slot 0
  mkP('str-def', 'DEF', { tackling: 6, aerialAbility: 6, pace: 6 }), // origIdx 1
  mkP('mid-1', 'MID', { dribbling: 1, tackling: 1, pace: 1, shooting: 1 }), // origIdx 2
  mkP('mid-2', 'MID', { dribbling: 1, tackling: 1, pace: 1, shooting: 1 }), // origIdx 3
  mkP('def-1', 'DEF', { tackling: 1, aerialAbility: 1, pace: 1 }), // origIdx 4
  mkP('fwd-1', 'FWD', { shooting: 1, aerialAbility: 1, dribbling: 1, highPass: 1 }), // origIdx 5
  mkP('mid-3', 'MID', { dribbling: 1, tackling: 1, pace: 1, shooting: 1 }), // origIdx 6
  mkP('mid-4', 'MID', { dribbling: 1, tackling: 1, pace: 1, shooting: 1 }), // origIdx 7
  mkP('def-2', 'DEF', { tackling: 1, aerialAbility: 1, pace: 1 }), // origIdx 8
  mkP('fwd-2', 'FWD', { shooting: 1, aerialAbility: 1, dribbling: 1, highPass: 1 }), // origIdx 9
  mkP('st-1', 'ST', { shooting: 1, aerialAbility: 1, dribbling: 1, highPass: 1 }), // origIdx 10
];

/**
 * 11-player squad for the tie-break test.
 *
 * fwdA (origIdx=9) and fwdB (origIdx=10) have identical stats and role='FWD'.
 * Both score identically for FWD-central (the only FWD-central slot in 4-4-2 = slot 10).
 * D-05: tie-break prefers lower origIdx, so fwdA should fill slot 10.
 */
const TIE_SQUAD: PoolPlayer[] = [
  mkP('gk-t', 'GK'), // origIdx 0
  mkP('def-t1', 'DEF', { tackling: 3, aerialAbility: 3, pace: 3 }), // origIdx 1
  mkP('def-t2', 'DEF', { tackling: 3, aerialAbility: 3, pace: 3 }), // origIdx 2
  mkP('def-t3', 'DEF', { tackling: 2, aerialAbility: 2, pace: 2 }), // origIdx 3
  mkP('def-t4', 'DEF', { tackling: 2, aerialAbility: 2, pace: 2 }), // origIdx 4
  mkP('mid-t1', 'MID', { dribbling: 2, tackling: 2, pace: 2, shooting: 2 }), // origIdx 5
  mkP('mid-t2', 'MID', { dribbling: 2, tackling: 2, pace: 2, shooting: 2 }), // origIdx 6
  mkP('mid-t3', 'MID', { dribbling: 2, tackling: 2, pace: 2, shooting: 2 }), // origIdx 7
  mkP('mid-t4', 'MID', { dribbling: 2, tackling: 2, pace: 2, shooting: 2 }), // origIdx 8
  // Two identical FWD players for the tie-break:
  mkP('fwd-a', 'FWD', { shooting: 4, aerialAbility: 3 }), // origIdx 9  — tie-break winner
  mkP('fwd-b', 'FWD', { shooting: 4, aerialAbility: 3 }), // origIdx 10 — tie-break loser
];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Phase 24 — computeAutoAssignment (ASSIGN-01)', () => {
  // -------------------------------------------------------------------------
  // Test 1: GK locked to slot index 0
  // -------------------------------------------------------------------------
  it('Test 1: GK is placed at slot index 0 (D-01)', () => {
    const result = computeAutoAssignment(getSquadPlayers('city'), FORMATIONS['4-4-2'].slots);
    expect(result).toHaveLength(11);
    expect(result[0]!.role).toBe('GK');
  });

  // -------------------------------------------------------------------------
  // Test 2: No duplicates / full coverage across all four formations
  // -------------------------------------------------------------------------
  it('Test 2a: 4-4-2 — result length equals slot count; no duplicate player IDs', () => {
    const slots = FORMATIONS['4-4-2'].slots;
    const squad = getSquadPlayers('city');
    const result = computeAutoAssignment(squad, slots);
    expect(result).toHaveLength(slots.length);
    const ids = result.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(result.every((p) => p !== null && p !== undefined)).toBe(true);
  });

  it('Test 2b: 5-3-2 — result length equals slot count; no duplicate player IDs', () => {
    const slots = FORMATIONS['5-3-2'].slots;
    const squad = getSquadPlayers('city');
    const result = computeAutoAssignment(squad, slots);
    expect(result).toHaveLength(slots.length);
    const ids = result.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Test 2c: 4-3-3 — result length equals slot count; no duplicate player IDs', () => {
    const slots = FORMATIONS['4-3-3'].slots;
    const squad = getSquadPlayers('city');
    const result = computeAutoAssignment(squad, slots);
    expect(result).toHaveLength(slots.length);
    const ids = result.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Test 2d: 3-4-3 — result length equals slot count; no duplicate player IDs', () => {
    const slots = FORMATIONS['3-4-3'].slots;
    const squad = getSquadPlayers('crew');
    const result = computeAutoAssignment(squad, slots);
    expect(result).toHaveLength(slots.length);
    const ids = result.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // -------------------------------------------------------------------------
  // Test 3: Anchor roles filled before flex roles (D-02)
  // -------------------------------------------------------------------------
  it('Test 3: strongDef lands at DEF-center (anchor) slot, not DEF-back (flex) slot (D-02)', () => {
    // 4-4-2 slot layout:
    //   [1] RB   DEF-back   (flex)
    //   [2] RCB  DEF-center (anchor) ← strongDef should end up here
    //   [3] LCB  DEF-center (anchor)
    //   [4] LB   DEF-back   (flex)
    const result = computeAutoAssignment(ANCHOR_SQUAD, FORMATIONS['4-4-2'].slots);

    const strongDefIndex = result.findIndex((p) => p.id === 'str-def');
    expect(strongDefIndex).toBeGreaterThan(0); // not GK slot

    const slotRole = FORMATIONS['4-4-2'].slots[strongDefIndex]!.slotRole;
    // Must be an anchor role, not a flex role
    expect(['DEF-center', 'MID-central', 'FWD-central']).toContain(slotRole);
    // More specifically: DEF-center (not DEF-back)
    expect(slotRole).toBe('DEF-center');
  });

  // -------------------------------------------------------------------------
  // Test 4: Tie-break by lower source-team index (D-05)
  // -------------------------------------------------------------------------
  it('Test 4: when two players score identically, lower origIdx wins the slot (D-05)', () => {
    // 4-4-2 slot 10 (ST) = FWD-central (anchor).
    // fwdA (origIdx=9) and fwdB (origIdx=10) both score:
    //   FWD-central = shooting(4) + aerialAbility(3) + 2 (FWD bonus) = 9
    // fwdA has lower origIdx → must win slot 10.
    const result = computeAutoAssignment(TIE_SQUAD, FORMATIONS['4-4-2'].slots);

    // Slot 10 is FWD-central (ST) — verify the earlier-indexed FWD is there
    const playerAtFwdCentral = result[10];
    expect(playerAtFwdCentral).toBeDefined();
    expect(playerAtFwdCentral!.id).toBe('fwd-a'); // lower origIdx wins
  });
});

// ---------------------------------------------------------------------------
// scoreForRole D-04 formula tests
// ---------------------------------------------------------------------------

describe('Phase 24 — scoreForRole D-04 formulas', () => {
  // -------------------------------------------------------------------------
  // Test 5: FWD-central
  //   D-04: shooting + aerialAbility + (2 if role==='FWD') + (4 if role==='ST')
  // -------------------------------------------------------------------------
  it('Test 5a: FWD-central — FWD role gets +2 bonus', () => {
    const shooting = 5;
    const aerialAbility = 3;
    const player = mkP('fwd-central-test', 'FWD', { shooting, aerialAbility });
    // Expected: shooting + aerialAbility + 2 (FWD bonus)
    expect(scoreForRole(player, 'FWD-central')).toBe(shooting + aerialAbility + 2);
  });

  it('Test 5b: FWD-central — ST role gets +4 bonus', () => {
    const shooting = 5;
    const aerialAbility = 3;
    const player = mkP('st-central-test', 'ST', { shooting, aerialAbility });
    // Expected: shooting + aerialAbility + 4 (ST bonus)
    expect(scoreForRole(player, 'FWD-central')).toBe(shooting + aerialAbility + 4);
  });

  it('Test 5c: FWD-central — MID role gets no bonus', () => {
    const shooting = 4;
    const aerialAbility = 2;
    const player = mkP('mid-central-fwd-test', 'MID', { shooting, aerialAbility });
    // Expected: shooting + aerialAbility (no role bonus)
    expect(scoreForRole(player, 'FWD-central')).toBe(shooting + aerialAbility);
  });

  // -------------------------------------------------------------------------
  // Test 6: MID-central
  //   D-04: dribbling + tackling + pace + shooting + (3 if role==='MID')
  // -------------------------------------------------------------------------
  it('Test 6a: MID-central — MID role gets +3 bonus', () => {
    const dribbling = 4;
    const tackling = 3;
    const pace = 5;
    const shooting = 2;
    const player = mkP('mid-central-test', 'MID', { dribbling, tackling, pace, shooting });
    // Expected: dribbling + tackling + pace + shooting + 3 (MID bonus)
    expect(scoreForRole(player, 'MID-central')).toBe(dribbling + tackling + pace + shooting + 3);
  });

  it('Test 6b: MID-central — DEF role gets no bonus', () => {
    const dribbling = 2;
    const tackling = 4;
    const pace = 3;
    const shooting = 1;
    const player = mkP('def-midcent-test', 'DEF', { dribbling, tackling, pace, shooting });
    // Expected: dribbling + tackling + pace + shooting (no role bonus)
    expect(scoreForRole(player, 'MID-central')).toBe(dribbling + tackling + pace + shooting);
  });

  // -------------------------------------------------------------------------
  // Test 7: DEF-back
  //   D-04: tackling + pace + (2 if role==='DEF')
  // -------------------------------------------------------------------------
  it('Test 7a: DEF-back — DEF role gets +2 bonus', () => {
    const tackling = 4;
    const pace = 5;
    const player = mkP('def-back-test', 'DEF', { tackling, pace });
    // Expected: tackling + pace + 2 (DEF bonus)
    expect(scoreForRole(player, 'DEF-back')).toBe(tackling + pace + 2);
  });

  it('Test 7b: DEF-back — MID role gets no bonus', () => {
    const tackling = 3;
    const pace = 4;
    const player = mkP('mid-back-test', 'MID', { tackling, pace });
    // Expected: tackling + pace (no role bonus)
    expect(scoreForRole(player, 'DEF-back')).toBe(tackling + pace);
  });

  // -------------------------------------------------------------------------
  // Test 8: FWD-wing
  //   D-04: dribbling + highPass + (3 if role==='FWD') + (2 if role==='MID')
  //   CRITICAL: role==='ST' receives NO wing bonus (literal D-04; +4 FWD-central pulls strikers central)
  // -------------------------------------------------------------------------
  it('Test 8a: FWD-wing — FWD role gets +3 bonus', () => {
    const dribbling = 3;
    const highPass = 4;
    const player = mkP('fwd-wing-test', 'FWD', { dribbling, highPass });
    // Expected: dribbling + highPass + 3 (FWD bonus)
    expect(scoreForRole(player, 'FWD-wing')).toBe(dribbling + highPass + 3);
  });

  it('Test 8b: FWD-wing — MID role gets +2 bonus', () => {
    const dribbling = 5;
    const highPass = 3;
    const player = mkP('mid-wing-test', 'MID', { dribbling, highPass });
    // Expected: dribbling + highPass + 2 (MID bonus)
    expect(scoreForRole(player, 'FWD-wing')).toBe(dribbling + highPass + 2);
  });

  it('Test 8c: FWD-wing — ST role gets NO bonus (literal D-04)', () => {
    const dribbling = 3;
    const highPass = 4;
    const player = mkP('st-wing-test', 'ST', { dribbling, highPass });
    // Expected: dribbling + highPass ONLY — ST is intentionally excluded from wing bonus
    expect(scoreForRole(player, 'FWD-wing')).toBe(dribbling + highPass);
  });
});
