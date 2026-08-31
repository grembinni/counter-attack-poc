---
phase: 48-permanent-jersey-numbers
plan: 01
subsystem: game-engine
tags: [gameEngine, roster-reposition, jersey-numbers, tdd]

# Dependency graph
requires:
  - phase: 47-select-based-roster-interaction
    provides: applyRosterReposition exercised end-to-end by the click-to-select roster UI
provides:
  - applyRosterReposition no longer re-binds PlayerPiece.number to the destination slot on a swap
  - Number-follows-person contract locked in by NUMBER-01/02/04 regression tests
  - In-source decision record for the ROSTER_REPOSITION event's jerseyNumberA/B fields
affects: [48-02, 48-03, 48-04, 48-05, 48-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Number-follows-person: applyRosterReposition's newA/newB literals omit `number` entirely so it flows through the full-object spread, matching the existing id/position slot-bound override pattern for those two fields only"

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.rosterReposition.test.ts

key-decisions:
  - "number is deliberately absent from applyRosterReposition's newA/newB override lists (Phase 48/D-05) — id and position remain slot-bound, number now travels with the person"
  - "ROSTER_REPOSITION event's jerseyNumberA/B fields are left reading the pre-swap pieces unchanged — under number-follows-person semantics that value equals the same person's post-swap number, so ActionLog.tsx's display and the ActionEvent shape both need no change"

patterns-established:
  - "Pattern: TDD RED/GREEN pair per plan (test commit then feat commit) for engine-level pure-function contract changes, verified by both narrow (2-file) and full-suite vitest runs before commit"

requirements-completed: [NUMBER-01, NUMBER-02, NUMBER-04]

# Metrics
duration: 20min
completed: 2026-08-31
---

# Phase 48 Plan 01: Number-Follows-Person on Roster Reposition Summary

**`applyRosterReposition` stops overriding `PlayerPiece.number` to the destination slot — a repositioned player now carries their own permanent jersey number with them, verified by 3 new/rewritten regression tests and zero regressions across the 1637-test server suite.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-31T11:21:00-05:00 (worktree branch base)
- **Completed:** 2026-08-31T11:35:35-05:00
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- Rewrote `gameEngine.rosterReposition.test.ts`'s happy-path test to assert number-follows-person (inverted the two number expectations, added a fixture-collision guard), landing intentionally RED
- Added two new regression tests: event name/number pairing (NUMBER-02) and reset-survival of a non-slot-standard number after a reposition (NUMBER-04)
- Deleted the two `number: pieceA.number` / `number: pieceB.number` overrides from `applyRosterReposition`'s `newA`/`newB` literals, letting `number` flow through the existing full-object spread
- Rewrote the function's docstring "Swap semantics" paragraph to state number travels with the person, and added inline comments at both deletion sites and above the `ROSTER_REPOSITION` event literal recording why the event's number fields are intentionally left unchanged
- Confirmed `applyRosterContinuity` and its 4 reset call sites required no changes — NUMBER-04 (reset survival) is satisfied automatically by the existing spread-and-overlay pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite gameEngine.rosterReposition.test.ts to the number-follows-person contract** - `3c367457` (test) — landed RED as required (3 failing tests, all for the expected number-mismatch reason)
2. **Task 2: Stop applyRosterReposition re-binding number to the slot, and record the event-field decision** - `ab4c0df3` (feat) — turned the suite GREEN

**Plan metadata:** SUMMARY commit pending (this file)

_Note: This plan does not use `tdd="true"` frontmatter but follows a plan-level RED→GREEN structure across its two tasks._

## Files Created/Modified
- `packages/server/src/__tests__/gameEngine.rosterReposition.test.ts` - Rewrote the happy-path number assertions and added 2 new test cases (event pairing, reset survival with a non-slot-standard number)
- `packages/server/src/gameEngine.ts` - Removed `number` overrides from `applyRosterReposition`'s swap literals; rewrote docstring; added in-source rationale comments (no other function touched)

## Decisions Made
- `number` is deliberately absent from `applyRosterReposition`'s `newA`/`newB` override lists (Phase 48/D-05) — `id` and `position` remain slot-bound; `number` now travels with the person. Recorded via inline comments at both literals and in the rewritten docstring.
- The `ROSTER_REPOSITION` event's `jerseyNumberA`/`jerseyNumberB` fields intentionally continue reading the pre-swap `pieceA`/`pieceB` — under number-follows-person semantics that value is identical to the same person's post-swap number, so `ActionLog.tsx:1298`'s existing render is correct with no shape change to `ActionEvent` (`packages/shared/src/types.ts:894-895`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed workspace dependencies and built `packages/shared`**
- **Found during:** Task 1 verification (running vitest)
- **Issue:** This worktree had no `node_modules` anywhere in the tree (fresh worktree checkout never had `pnpm install` run against it), so `vitest`/`tsc` all failed with "command not found" / module-resolution errors.
- **Fix:** Ran `pnpm install` at the workspace root (standard content-addressable pnpm install — no manual node_modules junction/symlink manipulation, per project memory on Windows junction risk) and `pnpm --filter @counter-attack/shared build` to produce `packages/shared/dist`.
- **Files modified:** none (installs `node_modules`/`packages/shared/dist`, both gitignored)
- **Verification:** `vitest run` and `tsc --noEmit` both ran successfully afterward
- **Committed in:** n/a (gitignored output, not committed)

---

**Total deviations:** 1 auto-fixed (1 blocking, environment setup only)
**Impact on plan:** No scope creep — environment bootstrap only, no code beyond the plan's two tasks.

## Issues Encountered
None beyond the environment bootstrap documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `applyRosterReposition` and `applyRosterContinuity` both now correctly implement number-follows-person for the reposition path; downstream plans in this phase (buildSquadPieces one-time locking, bench numbering, kickoff-striker lookup) are unaffected by and independent of this change.
- Full server suite green (1637 passed, 1 skipped, 1 todo) — no regressions introduced.

---
*Phase: 48-permanent-jersey-numbers*
*Completed: 2026-08-31*
