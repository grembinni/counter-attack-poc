---
phase: 31-bug-fixes
plan: 04
subsystem: game-engine
tags: [gameEngine, header-duel, movedPieceIds, rule-correctness, tdd]

# Dependency graph
requires:
  - phase: 11-rule-correctness
    provides: applyResolveHeaderTarget (RULE-02), movedPieceIds/computeMovedPieceIds locking convention in applyMove
provides:
  - 'applyResolveHeaderTarget marks the header-duel winner spent (movedPieceIds) on both non-goal PASS routes (occupant-PASS and empty-hex/loose-ball)'
  - 'Regression coverage: winner added on both non-goal branches, winner NOT added on the goal-line GK_DIVE route, and null-winner (uncontested/declined) case never pushes null/undefined into movedPieceIds'
affects: [32-code-cleanup, response-activation-model-future-milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Guarded ternary append (`resolvedWinner ? [...state.movedPieceIds, resolvedWinner.id] : state.movedPieceIds`) as the minimal-diff way to extend movedPieceIds for a single already-resolved piece — deliberately simpler than the abandon-sweep computeMovedPieceIds helper used elsewhere, since no dedup is needed here (resolvedWinner.id cannot already be present mid-header-contest)'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.rule11.test.ts

key-decisions:
  - 'Reused prettier-wrapped multi-line ternary formatting for the guarded append (printWidth 100 forced the line to wrap at this indent depth) rather than fighting the formatter to keep it on one physical line — functional pattern is identical to the plan spec, verified via a newline-tolerant grep'

patterns-established: []

requirements-completed: [BUG-31]

# Metrics
duration: ~20min
completed: 2026-07-22
---

# Phase 31 Plan 04: Header-Winner Eligibility (BUG-31 family) Summary

**Header-duel winners on non-goal PASS routes are now marked spent (`movedPieceIds`) so they render grey-ringed and unselectable in the following MOVE phase, closing the folded 2026-07-12 header-winner-ineligibility todo.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-22T18:00:00Z (approx.)
- **Completed:** 2026-07-22T18:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Closed the folded todo `2026-07-12-bug-header-winner-piece-ineligible-next-phase.md` (BUG-31 eligibility family): a header-duel winner that lands on a non-goal PASS route (occupant-PASS or empty-hex/loose-ball) is now appended to `movedPieceIds`, so `canSelect*` gates and phase-completion logic correctly treat it as already-activated for the next MOVE phase.
- Verified via new regression tests that the goal-line GK_DIVE route and the null-winner (uncontested/declined header) case are both unaffected, exactly per the plan's scope boundary.
- Full RED→GREEN TDD cycle: 2 new assertions started failing against current source, then passed once the guarded append was added; zero regressions across the full 623-test server suite.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests — header winner becomes spent on non-goal routes** - `59b7470` (test) — RED confirmed: occupant-PASS and empty-hex branches failed (`expected [] to include 'home-fwd'`); goal-line and null-winner cases passed unchanged, confirming test isolation.
2. **Task 2: Append winner id to movedPieceIds on both non-goal branches of applyResolveHeaderTarget** - `4695029` (feat) — GREEN confirmed: all 26 tests in `gameEngine.rule11.test.ts` pass; typecheck clean; full server suite (623 tests) green.

**Plan metadata:** (this SUMMARY commit, docs)

_Note: TDD task — RED then GREEN, no REFACTOR needed (implementation was a minimal guarded append, no cleanup required)._

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.rule11.test.ts` - Added 4 new tests: winner added to `movedPieceIds` on the empty-hex/loose-ball branch, winner added on the occupant-PASS branch (new occupied-target-hex fixture), winner NOT added on the goal-line GK_DIVE branch, and null-winner case never introduces `null`/`undefined` into `movedPieceIds`.
- `packages/server/src/gameEngine.ts` - `applyResolveHeaderTarget`: both non-goal branches (occupant-PASS ~3505-3532, empty-hex/loose-ball ~3539-3561) now set `movedPieceIds: resolvedWinner ? [...state.movedPieceIds, resolvedWinner.id] : state.movedPieceIds` with an explanatory comment citing the folded todo. The goal-line GK_DIVE branch (~3463-3482) is unchanged.

## Decisions Made

- No architectural decisions required — this was a minimal, isolated guarded-append fix following the plan's prescribed pattern exactly. The only implementation-level note is that Prettier wrapped the ternary across 3 lines (line would exceed the 100-char printWidth at this indentation depth), so the plan's literal single-line grep heuristic (`movedPieceIds: resolvedWinner ?`) returns 0 matches; the newline-tolerant equivalent (`movedPieceIds: resolvedWinner$`) confirms exactly 2 occurrences (one per non-goal branch), matching the acceptance criteria's intent.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` specs verbatim; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

- **Worktree had no `node_modules`.** Ran `pnpm install --frozen-lockfile` to get a clean, independently-installed `node_modules` in this worktree (per project memory's documented Windows-junction risk, avoided by doing a real install rather than any manual junction/symlink workaround), then rebuilt `@counter-attack/shared` (`pnpm --filter @counter-attack/shared build`) before running server tests, per this plan's stated success-criteria reminder.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-31 (header-winner eligibility) is closed with full regression coverage (both non-goal branches, goal-line exclusion, and null-winner guard).
- No blockers introduced for other Wave 2/3 plans in Phase 31 — only `gameEngine.ts`'s `applyResolveHeaderTarget` function and its dedicated test file were touched, matching this plan's declared `files_modified` scope exactly.
- Full server test suite (33 files, 623 tests, 1 skipped, 1 todo) passes; `pnpm --filter @counter-attack/server typecheck` is clean.

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.rule11.test.ts
- FOUND: .planning/phases/31-bug-fixes/31-04-SUMMARY.md
- FOUND commit: 59b7470 (test)
- FOUND commit: 4695029 (feat)

---

_Phase: 31-bug-fixes_
_Completed: 2026-07-22_
