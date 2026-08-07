/**
 * Unit tests for the action sequence eligibility table.
 * D-07: Server enforces the eligibility table after every action.
 * D-08: Corrected eligibility matrix (Counter Attack rulebook v1.4.1).
 *
 * Each describe block tests one row of the D-08 table:
 *   - Positive membership: .has(X) === true for each allowed next action
 *   - Negative membership: .has(X) === false for each disallowed next action
 *   - Size assertion: verifies no undocumented entries slipped in
 */
import { describe, it, expect } from 'vitest';
import { ELIGIBLE_NEXT_ACTIONS } from './actionSequence.js';

describe('ELIGIBLE_NEXT_ACTIONS — D-08 eligibility table', () => {
  describe('MOVEMENT_PHASE', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.MOVEMENT_PHASE;

    it('allows MOVEMENT', () => {
      expect(set.has('MOVEMENT')).toBe(true);
    });
    it('allows STANDARD_PASS', () => {
      expect(set.has('STANDARD_PASS')).toBe(true);
    });
    it('allows HIGH_PASS', () => {
      expect(set.has('HIGH_PASS')).toBe(true);
    });
    it('allows LONG_BALL', () => {
      expect(set.has('LONG_BALL')).toBe(true);
    });
    it('allows SNAPSHOT', () => {
      expect(set.has('SNAPSHOT')).toBe(true);
    });
    it('allows SHOT', () => {
      expect(set.has('SHOT')).toBe(true);
    });
    it('does not allow FIRST_TIME_PASS', () => {
      expect(set.has('FIRST_TIME_PASS')).toBe(false);
    });
    it('does not allow HEADER', () => {
      expect(set.has('HEADER')).toBe(false);
    });
    it('has exactly 6 entries', () => {
      expect(set.size).toBe(6);
    });
  });

  describe('SUCCESSFUL_TACKLE', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.SUCCESSFUL_TACKLE;

    it('allows MOVEMENT', () => {
      expect(set.has('MOVEMENT')).toBe(true);
    });
    it('allows STANDARD_PASS', () => {
      expect(set.has('STANDARD_PASS')).toBe(true);
    });
    it('allows HIGH_PASS', () => {
      expect(set.has('HIGH_PASS')).toBe(true);
    });
    it('allows LONG_BALL', () => {
      expect(set.has('LONG_BALL')).toBe(true);
    });
    it('allows SNAPSHOT', () => {
      expect(set.has('SNAPSHOT')).toBe(true);
    });
    it('does not allow SHOT', () => {
      expect(set.has('SHOT')).toBe(false);
    });
    it('does not allow FIRST_TIME_PASS', () => {
      expect(set.has('FIRST_TIME_PASS')).toBe(false);
    });
    it('does not allow HEADER', () => {
      expect(set.has('HEADER')).toBe(false);
    });
    it('has exactly 5 entries', () => {
      expect(set.size).toBe(5);
    });
  });

  describe('STANDARD_PASS', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.STANDARD_PASS;

    it('allows MOVEMENT', () => {
      expect(set.has('MOVEMENT')).toBe(true);
    });
    it('allows FIRST_TIME_PASS', () => {
      expect(set.has('FIRST_TIME_PASS')).toBe(true);
    });
    it('allows SNAPSHOT', () => {
      expect(set.has('SNAPSHOT')).toBe(true);
    });
    it('does not allow STANDARD_PASS', () => {
      expect(set.has('STANDARD_PASS')).toBe(false);
    });
    it('does not allow HIGH_PASS', () => {
      expect(set.has('HIGH_PASS')).toBe(false);
    });
    it('does not allow LONG_BALL', () => {
      expect(set.has('LONG_BALL')).toBe(false);
    });
    it('does not allow HEADER', () => {
      expect(set.has('HEADER')).toBe(false);
    });
    it('does not allow SHOT', () => {
      expect(set.has('SHOT')).toBe(false);
    });
    it('has exactly 3 entries', () => {
      expect(set.size).toBe(3);
    });
  });

  describe('FIRST_TIME_PASS', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.FIRST_TIME_PASS;

    it('allows MOVEMENT', () => {
      expect(set.has('MOVEMENT')).toBe(true);
    });
    it('allows SNAPSHOT', () => {
      expect(set.has('SNAPSHOT')).toBe(true);
    });
    it('does not allow STANDARD_PASS', () => {
      expect(set.has('STANDARD_PASS')).toBe(false);
    });
    it('does not allow FIRST_TIME_PASS', () => {
      expect(set.has('FIRST_TIME_PASS')).toBe(false);
    });
    it('does not allow HIGH_PASS', () => {
      expect(set.has('HIGH_PASS')).toBe(false);
    });
    it('does not allow LONG_BALL', () => {
      expect(set.has('LONG_BALL')).toBe(false);
    });
    it('does not allow HEADER', () => {
      expect(set.has('HEADER')).toBe(false);
    });
    it('does not allow SHOT', () => {
      expect(set.has('SHOT')).toBe(false);
    });
    it('has exactly 2 entries', () => {
      expect(set.size).toBe(2);
    });
  });

  describe('HIGH_PASS', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.HIGH_PASS;

    it('allows HEADER and only HEADER (size === 1)', () => {
      expect(set.size).toBe(1);
      expect(set.has('HEADER')).toBe(true);
    });
    it('does not allow MOVEMENT', () => {
      expect(set.has('MOVEMENT')).toBe(false);
    });
    it('does not allow STANDARD_PASS', () => {
      expect(set.has('STANDARD_PASS')).toBe(false);
    });
    it('does not allow FIRST_TIME_PASS', () => {
      expect(set.has('FIRST_TIME_PASS')).toBe(false);
    });
    it('does not allow LONG_BALL', () => {
      expect(set.has('LONG_BALL')).toBe(false);
    });
    it('does not allow SNAPSHOT', () => {
      expect(set.has('SNAPSHOT')).toBe(false);
    });
    it('does not allow SHOT', () => {
      expect(set.has('SHOT')).toBe(false);
    });
  });

  describe('LONG_BALL', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.LONG_BALL;

    it('allows MOVEMENT', () => {
      expect(set.has('MOVEMENT')).toBe(true);
    });
    it('allows HEADER', () => {
      expect(set.has('HEADER')).toBe(true);
    });
    it('does not allow STANDARD_PASS', () => {
      expect(set.has('STANDARD_PASS')).toBe(false);
    });
    it('does not allow FIRST_TIME_PASS', () => {
      expect(set.has('FIRST_TIME_PASS')).toBe(false);
    });
    it('does not allow HIGH_PASS', () => {
      expect(set.has('HIGH_PASS')).toBe(false);
    });
    it('does not allow SNAPSHOT', () => {
      expect(set.has('SNAPSHOT')).toBe(false);
    });
    it('does not allow SHOT', () => {
      expect(set.has('SHOT')).toBe(false);
    });
    it('has exactly 2 entries', () => {
      expect(set.size).toBe(2);
    });
  });

  describe('HEADER', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.HEADER;

    it('allows MOVEMENT', () => {
      expect(set.has('MOVEMENT')).toBe(true);
    });
    it('allows FIRST_TIME_PASS', () => {
      expect(set.has('FIRST_TIME_PASS')).toBe(true);
    });
    it('allows SNAPSHOT', () => {
      expect(set.has('SNAPSHOT')).toBe(true);
    });
    it('does not allow STANDARD_PASS', () => {
      expect(set.has('STANDARD_PASS')).toBe(false);
    });
    it('does not allow HIGH_PASS', () => {
      expect(set.has('HIGH_PASS')).toBe(false);
    });
    it('does not allow LONG_BALL', () => {
      expect(set.has('LONG_BALL')).toBe(false);
    });
    it('does not allow HEADER (HEAD-04: no consecutive headed passes)', () => {
      expect(set.has('HEADER')).toBe(false);
    });
    it('does not allow SHOT', () => {
      expect(set.has('SHOT')).toBe(false);
    });
    it('has exactly 3 entries', () => {
      expect(set.size).toBe(3);
    });
  });

  describe('DEFLECTION', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.DEFLECTION;

    it('allows MOVEMENT', () => {
      expect(set.has('MOVEMENT')).toBe(true);
    });
    it('allows FIRST_TIME_PASS', () => {
      expect(set.has('FIRST_TIME_PASS')).toBe(true);
    });
    it('allows LONG_BALL', () => {
      expect(set.has('LONG_BALL')).toBe(true);
    });
    it('allows SNAPSHOT', () => {
      expect(set.has('SNAPSHOT')).toBe(true);
    });
    it('does not allow STANDARD_PASS', () => {
      expect(set.has('STANDARD_PASS')).toBe(false);
    });
    it('does not allow HIGH_PASS', () => {
      expect(set.has('HIGH_PASS')).toBe(false);
    });
    it('does not allow HEADER', () => {
      expect(set.has('HEADER')).toBe(false);
    });
    it('does not allow SHOT', () => {
      expect(set.has('SHOT')).toBe(false);
    });
    it('has exactly 4 entries', () => {
      expect(set.size).toBe(4);
    });
  });

  describe('SNAPSHOT', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.SNAPSHOT;

    it('is an empty set (size 0) — snapshot transitions directly to SHOT', () => {
      expect(set.size).toBe(0);
    });
  });

  describe('SHOT', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.SHOT;

    it('is an empty set (size 0) — shot outcomes always initiate a new sequence', () => {
      expect(set.size).toBe(0);
    });
  });

  // Phase 37 (37-02): THROWIN-03/D-09 throw-in two-movement-phase cap.
  describe('THROW_IN_MOVEMENT_1', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.THROW_IN_MOVEMENT_1;

    it('allows STANDARD_PASS, HIGH_PASS, and MOVEMENT and nothing else', () => {
      expect(set.has('STANDARD_PASS')).toBe(true);
      expect(set.has('HIGH_PASS')).toBe(true);
      expect(set.has('MOVEMENT')).toBe(true);
      expect(set.size).toBe(3);
    });
  });

  describe('THROW_IN_MOVEMENT_2', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.THROW_IN_MOVEMENT_2;

    it('allows STANDARD_PASS and HIGH_PASS only — D-09 hard cap omits MOVEMENT', () => {
      expect(set.has('STANDARD_PASS')).toBe(true);
      expect(set.has('HIGH_PASS')).toBe(true);
      expect(set.has('MOVEMENT')).toBe(false);
      expect(set.size).toBe(2);
    });
  });

  // GOALKICK-03 (Phase 37): goal kick's "Standard Pass" branch.
  describe('GOAL_KICK_RESTART', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.GOAL_KICK_RESTART;

    it('allows STANDARD_PASS and only STANDARD_PASS (size === 1)', () => {
      expect(set.size).toBe(1);
      expect(set.has('STANDARD_PASS')).toBe(true);
    });
    it('does not allow MOVEMENT, HIGH_PASS, SNAPSHOT, or SHOT', () => {
      expect(set.has('MOVEMENT')).toBe(false);
      expect(set.has('HIGH_PASS')).toBe(false);
      expect(set.has('SNAPSHOT')).toBe(false);
      expect(set.has('SHOT')).toBe(false);
    });
  });

  // CORNER-04/CORNER-05 (Phase 38): corner kick's Low/High accuracy options.
  describe('CORNER_KICK_RESTART', () => {
    const set = ELIGIBLE_NEXT_ACTIONS.CORNER_KICK_RESTART;

    it('allows exactly STANDARD_PASS and HIGH_PASS (size === 2)', () => {
      expect(set.size).toBe(2);
      expect(set.has('STANDARD_PASS')).toBe(true);
      expect(set.has('HIGH_PASS')).toBe(true);
    });
    it('does not allow MOVEMENT, FIRST_TIME_PASS, LONG_BALL, SNAPSHOT, or SHOT', () => {
      expect(set.has('MOVEMENT')).toBe(false);
      expect(set.has('FIRST_TIME_PASS')).toBe(false);
      expect(set.has('LONG_BALL')).toBe(false);
      expect(set.has('SNAPSHOT')).toBe(false);
      expect(set.has('SHOT')).toBe(false);
    });
  });
});
