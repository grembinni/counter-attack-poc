/**
 * Phase 23 Plan 01 — FORM-01/FORM-04 data-integrity tests for the FORMATIONS table.
 *
 * These tests are integrity guards that validate the hand-authored formations.ts data.
 * They must PASS against the Task-1 table — if any fail, the bug is in formations.ts.
 * They are NOT RED-first TDD tests; they serve as regression protection for the registry.
 */
import { describe, it, expect } from 'vitest';
import { FORMATIONS } from '@counter-attack/shared';
import type { FormationId } from '@counter-attack/shared';

const EXPECTED_FORMATION_IDS: FormationId[] = ['4-4-2', '5-3-2', '4-3-3', '3-4-3'];

describe('FORMATIONS registry — data integrity (Phase 23 Plan 01)', () => {
  it('Test 1: FORMATIONS contains exactly the four expected formation keys', () => {
    const actualKeys = Object.keys(FORMATIONS).sort();
    const expectedKeys = [...EXPECTED_FORMATION_IDS].sort();
    expect(actualKeys).toEqual(expectedKeys);
  });

  it('Test 2: every formation has exactly 11 slots', () => {
    for (const [id, formation] of Object.entries(FORMATIONS)) {
      expect(formation.slots.length, `${id} should have 11 slots`).toBe(11);
    }
  });

  it('Test 3: every formation has jersey numbers 1–11 each appearing exactly once', () => {
    const expectedJerseys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (const [id, formation] of Object.entries(FORMATIONS)) {
      const jerseys = formation.slots.map((s) => s.jerseyNumber).sort((a, b) => a - b);
      expect(jerseys, `${id} jerseys should be 1–11 unique`).toEqual(expectedJerseys);
    }
  });

  it('Test 4: slot index 0 is the GK with the correct position and jersey number in every formation', () => {
    for (const [id, formation] of Object.entries(FORMATIONS)) {
      const gk = formation.slots[0];
      expect(gk, `${id} slots[0] must exist`).toBeDefined();
      if (!gk) continue;
      expect(gk.slotId, `${id} slots[0].slotId`).toBe('GK');
      expect(gk.slotRole, `${id} slots[0].slotRole`).toBe('GK');
      expect(gk.position, `${id} slots[0].position`).toEqual({ q: 2, r: 13 });
      expect(gk.jerseyNumber, `${id} slots[0].jerseyNumber`).toBe(1);
    }
  });

  it('NUMBER-03: every formation has exactly one slotId === ST slot (kick-off anchor target)', () => {
    for (const [id, formation] of Object.entries(FORMATIONS)) {
      const strikers = formation.slots.filter((s) => s.slotId === 'ST');
      expect(strikers.length, `${id} should have exactly one ST slot`).toBe(1);
      expect(strikers[0]!.slotRole, `${id} ST slot's slotRole`).toBe('FWD-central');
      // Incidental authored data only (Phase 48 / D-07): every formation happens to assign
      // jerseyNumber: 9 to its ST slot, but the kick-off anchor no longer keys on this number —
      // it keys on slotId === 'ST' above. This assertion pins the sanity of the authored data,
      // not the anchor mechanism.
      expect(
        strikers[0]!.jerseyNumber,
        `${id} ST slot's jerseyNumber (incidental, not anchor key)`,
      ).toBe(9);
    }
  });

  it('Test 6: every slot position.q is one of {2, 6, 8, 10, 12, 14} and position.r is within [4, 22]', () => {
    const validQ = new Set([2, 6, 8, 10, 12, 14]);
    for (const [id, formation] of Object.entries(FORMATIONS)) {
      for (const slot of formation.slots) {
        expect(
          validQ.has(slot.position.q),
          `${id} slot ${slot.slotId}: q=${slot.position.q} must be one of {2, 6, 8, 10, 12, 14}`,
        ).toBe(true);
        expect(
          slot.position.r,
          `${id} slot ${slot.slotId}: r=${slot.position.r} must be in [4, 22]`,
        ).toBeGreaterThanOrEqual(4);
        expect(
          slot.position.r,
          `${id} slot ${slot.slotId}: r=${slot.position.r} must be in [4, 22]`,
        ).toBeLessThanOrEqual(22);
      }
    }
  });
});
