---
phase: 31-bug-fixes
plan: 06
subsystem: game-engine
tags: [gameEngine, header-duel, movedPieceIds, rule-correctness, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 31-bug-fixes
    provides: "Plan 31-04's movedPieceIds append inside applyResolveHeaderTarget's non-goal branches (the fix this plan makes durable through applyStartMovement)"
provides:
  - 'carriedMovedPieceIds optional field on GameState mirroring contestedPieceIds shape'
  - 'applyResolveHeaderTarget populates carriedMovedPieceIds on both non-goal branches (occupant-PASS and empty-hex/loose-ball)'
  - 'applyStartMovement merges carriedMovedPieceIds into movedPieceIds instead of clobbering it, then clears the carry'
  - 'Chained regression coverage: header winner id survives applyResolveHeaderTarget -> applyStartMovement into the MOVE phase on both non-goal branches; no-carry control confirms the common path is unaffected; carry is consumed after exactly one Movement Phase'
affects: [32-code-cleanup, response-activation-model-future-milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedicated carry field (mirroring contestedPieceIds) merged-then-cleared by the single downstream transition function, rather than trying to special-case the unconditional reset inline — keeps applyStartMovement's reset semantics for the common path unchanged while giving header resolution an explicit hand-off channel"

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.rule11.test.ts

key-decisions:
  - 'carriedMovedPieceIds is merged into movedPieceIds via spread ([...(state.carriedMovedPieceIds ?? [])]) in applyStartMovement rather than concatenated with any pre-existing movedPieceIds entries, since applyStartMovement is the START of a fresh Movement Phase — there are no other movedPieceIds entries to preserve at that transition point, only the carry.'
  - "contestedPieceIds' identical unconditional-reset defeat (flagged in 31-REVIEW.md CR-01) was explicitly left untouched per the plan's stated scope boundary — not fixed, not reused as a pattern for this carry."

patterns-established: []

requirements-completed: [BUG-31]

# Metrics
duration: ~15min
completed: 2026-07-22
---

# Phase 31 Plan 06: Header-Winner Carry-Through Gap Closure (BUG-31 family) Summary

**A dedicated `carriedMovedPieceIds` field on `GameState`, populated by `applyResolveHeaderTarget`'s non-goal branches and merged-then-cleared by `applyStartMovement`, makes the header-duel winner's spent status survive the PASS→MOVE transition — closing VERIFICATION.md truth 4, the gap Plan 31-04's fix left defeated.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-22T17:17:16Z (approx, from prior plan-creation commit)
- **Completed:** 2026-07-22T17:27:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Closed the second half of the folded header-winner-eligibility todo (BUG-31 family, VERIFICATION.md truth 4): a header-duel winner marked spent on a non-goal PASS route now REMAINS spent (unselectable, grey ring) through the following Movement Phase, instead of becoming fully selectable again the moment `applyStartMovement` produced the `MOVE`-phase state.
- Added a chained regression test suite that pipes `applyResolveHeaderTarget`'s PASS-phase output directly into `applyStartMovement`, proving the fix holds across the real function-call sequence the client actually exercises (not just the intermediate PASS-phase snapshot Plan 31-04 tested).
- Verified via a no-carry control that the common (non-header) PASS/KICK_OFF/LOOSE_BALL → MOVE path is unaffected — `movedPieceIds` still resets to `[]` when there is nothing to carry.
- Verified the carry is consumed after exactly one Movement Phase (`carriedMovedPieceIds` is empty on the resulting MOVE state).
- Confirmed `contestedPieceIds`' identical unconditional-reset defeat (CR-01, out of scope) was left completely untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing chained test — header winner survives applyStartMovement into the MOVE phase (RED)** - `c092897` (test) — RED confirmed: both non-goal chained branches failed (`expected [] to include 'home-fwd'`); the no-carry control and one-phase-only carry-cleared assertion passed unchanged (the latter trivially, since the field did not exist pre-fix).
2. **Task 2: Add carriedMovedPieceIds carry field; populate in applyResolveHeaderTarget, merge-then-clear in applyStartMovement (GREEN)** - `7e05e75` (feat) — GREEN confirmed: all 30 tests in `gameEngine.rule11.test.ts` pass; typecheck clean; full server suite (33 files, 627 tests, 1 skipped, 1 todo) and full shared suite (13 files, 583 tests) green.

**Plan metadata:** (this SUMMARY commit, docs)

_Note: TDD task — RED then GREEN, no REFACTOR needed (implementation was a minimal dedicated-field carry, no cleanup required)._

## Files Created/Modified

- `packages/shared/src/types.ts` - Added optional `carriedMovedPieceIds?: readonly string[]` field to `GameState`, placed adjacent to `contestedPieceIds` with a JSDoc explaining the merge-then-clear hand-off semantics and citing the folded header-winner todo / BUG-31 family.
- `packages/server/src/gameEngine.ts` - `applyResolveHeaderTarget`: both non-goal branches (occupant-PASS and empty-hex/loose-ball) now also set `carriedMovedPieceIds: resolvedWinner ? [resolvedWinner.id] : (state.carriedMovedPieceIds ?? [])` alongside the existing `movedPieceIds` append from Plan 31-04. `applyStartMovement`: `movedPieceIds: []` replaced with `movedPieceIds: [...(state.carriedMovedPieceIds ?? [])]`, and `carriedMovedPieceIds: []` added to clear the carry after merging. The goal-line `GK_DIVE` branch and all `contestedPieceIds` handling are unchanged.
- `packages/server/src/__tests__/gameEngine.rule11.test.ts` - Added a new `describe('RULE-02 gap: header winner stays spent through applyStartMovement ...')` block with 4 tests: chained empty-hex/loose-ball branch, chained occupant-PASS branch, a no-carry plain-PASS control, and a one-phase-only carry-cleared assertion. Reused the existing `makeHeaderStateWithWinner` builder and occupied-target-hex fixture pattern from Plan 31-04 verbatim — no new test harness introduced. Added `applyStartMovement` to the file's existing `gameEngine.js` import.

## Decisions Made

- Merged the carry via full replacement (`[...(state.carriedMovedPieceIds ?? [])]`) rather than concatenation with prior `movedPieceIds`, since `applyStartMovement` marks the START of a fresh Movement Phase — no other `movedPieceIds` entries are meaningful to preserve at that exact transition point, only the header-winner carry.
- Left `contestedPieceIds`' identical unconditional-reset defeat (CR-01 in `31-REVIEW.md`) completely untouched, per the plan's explicit scope boundary — this plan does not fix it and does not copy its (broken) pattern for the new carry field.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` specs verbatim; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

- **Worktree had no `node_modules`.** Ran `pnpm install --frozen-lockfile` (backgrounded, ~2 min) to get a clean, independently-installed `node_modules` in this worktree, then rebuilt `@counter-attack/shared` (`pnpm --filter @counter-attack/shared build`) before running server typecheck/tests — required because this plan adds a new field to `shared/src/types.ts`, exactly per this plan's stated reminder and the same gap found in this phase's Wave 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-31 (header-winner eligibility, both halves: the initial non-goal-branch append from Plan 31-04 and this plan's carry-through-applyStartMovement fix) is now closed with full chained regression coverage matching the real game-flow function sequence.
- VERIFICATION.md truth 4 (previously ✗ FAILED) is now satisfied by the codebase.
- No blockers introduced for other Wave plans in Phase 31 — only `packages/shared/src/types.ts`, `packages/server/src/gameEngine.ts`, and `packages/server/src/__tests__/gameEngine.rule11.test.ts` were touched, matching this plan's declared `files_modified` scope exactly.
- Full server test suite (33 files, 627 tests, 1 skipped, 1 todo) passes; full shared test suite (13 files, 583 tests) passes; `pnpm --filter @counter-attack/server typecheck` is clean.

## Self-Check: PASSED

- FOUND: packages/shared/src/types.ts
- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.rule11.test.ts
- FOUND: .planning/phases/31-bug-fixes/31-06-SUMMARY.md
- FOUND commit: c092897 (test)
- FOUND commit: 7e05e75 (feat)

---

_Phase: 31-bug-fixes_
_Completed: 2026-07-22_
