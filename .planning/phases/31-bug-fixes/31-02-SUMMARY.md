---
phase: 31-bug-fixes
plan: 02
subsystem: ui
tags: [react, zustand, action-panel, movement, ux]

# Dependency graph
requires: []
provides:
  - "remaining derived purely from paceUsedByPieceId (any entry = started) in ActionPanel.tsx"
  - "regression coverage in ActionPanel.test.tsx proving BUG-31 fixed (first-step decrement, button flip, Undo revert)"
affects: [32-code-cleanup, 35-actionpanel-log-standardization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "startedCount = Object.keys(paceUsedByPieceId).length as the canonical 'piece started this slot' signal, mirroring activatedCount at HexGrid.tsx:702"

key-files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - "startedCount subsumes both prior terms (paceExhaustedNotLocked + currentSlotLockedCount) since every piece counted by either has a paceUsedByPieceId entry — single-term derivation with no double-count and no under-count"
  - "ctaButtonClass and its call sites left unchanged; only the remaining value feeding them changes"
  - "D-05 (Undo revert) required no source change beyond the remaining derivation — applyUndo already deletes the reverted piece's paceUsedByPieceId entry server-side and the full-snapshot broadcast recomputes remaining from scratch on the next render"

patterns-established:
  - "Single-term derived-count pattern for slot-quota UI countdowns: Object.keys(stateField).length instead of summing overlapping filtered subsets"

requirements-completed: [BUG-31]

# Metrics
duration: ~20min
completed: 2026-07-22
---

# Phase 31 Plan 02: BUG-31 Move-Started Timing + Undo Summary

**Eligible-players-remaining message and End Turn button color now flip the instant a piece takes its first hex step, derived from a single `startedCount = Object.keys(paceUsedByPieceId).length` term instead of the prior two-term exhausted-or-locked calculation.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-22
- **Tasks:** 2 (TDD RED/GREEN)
- **Files modified:** 2

## Accomplishments

- Fixed BUG-31: the "N of M players left to move" helper text and the End Turn button's `ctaButtonClass` (pending/ready) color now update the moment a piece steps its first hex (`paceUsedByPieceId[id] > 0`), not only once the piece exhausts its pace and locks into `movedPieceIds`.
- Confirmed D-05 (Undo case) requires no additional source change: `applyUndo` already deletes the reverted piece's `paceUsedByPieceId` entry server-side, and the client's full-snapshot re-render recomputes `remaining` from the new state with no stale-state window. A dedicated regression test proves this.
- Simplified the `remaining` calculation from two overlapping filtered-count terms (`paceExhaustedNotLocked`, `currentSlotLockedCount`) to a single derived term (`startedCount`), removing ~15 lines of filter/dedup logic while fixing the bug.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Write failing tests for immediate remaining/button update on first step and after Undo** - `700ccce` (test)
2. **Task 2: Derive remaining from paceUsedByPieceId so it updates on first step (D-03/D-04/D-05)** - `3ca6193` (feat)

_TDD gate sequence verified in git log: `test(31-02): ...` (RED) precedes `feat(31-02): ...` (GREEN)._

## Files Created/Modified

- `packages/client/src/components/ActionPanel.tsx` - MOVE-phase `remaining` calc replaced with single-term `startedCount` derivation; `paceExhaustedNotLocked` and `currentSlotLockedCount` removed (confirmed zero remaining references via grep)
- `packages/client/src/components/ActionPanel.test.tsx` - 3 new tests added under `describe('ActionPanel — BUG-31: remaining/button update on first step, not full activation')`: started-not-exhausted decrement, button-flip-to-ready on all-started, Undo-revert (paceUsedByPieceId cleared)

## Decisions Made

- `startedCount = Object.keys(paceUsedByPieceId).length` is the single source of truth for "started" — confirmed via set-theory reasoning (documented in code comment) that it strictly subsumes the union of the two previous filtered counts, so no dedup helper (e.g. `Set` union) was needed, contrary to the PATTERNS.md note that flagged a potential double-count risk. The two prior terms partitioned the same underlying key set (`paceUsedByPieceId` keys), so replacing the sum with the key count is exact, not an approximation.
- No changes to `ctaButtonClass` or its call sites (`ctaButtonClass(remaining ?? 0)`, `withEndTurnConfirm(remaining ?? 0, ...)`) — they are pure consumers of `remaining` and needed no modification per the plan.

## Deviations from Plan

None - plan executed exactly as written. Both tasks completed with no auto-fixes required; `pnpm --filter @counter-attack/client typecheck` reported zero errors on first attempt after the Task 2 edit, and all 44 `ActionPanel.test.tsx` tests (41 pre-existing + 3 new) passed GREEN on first run after the fix. Full client suite (374 tests across 20 files) also passed with no regressions.

## Issues Encountered

- The worktree had no `node_modules` installed and `packages/shared` had no built `dist/` output, causing initial test/typecheck runs to fail with module-resolution errors unrelated to this plan's code changes. Resolved by running `pnpm install --frozen-lockfile` (all packages resolved from the local pnpm store/cache, no new downloads) and `pnpm --filter @counter-attack/shared build`. This is worktree environment setup, not a plan deviation — no application code was affected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-31 closed; `remaining` derivation is now the single-term pattern that future ActionPanel work (Phase 35: ActionPanel & Log Standardization) can build on directly.
- No blockers for other Phase 31 plans (31-01 BUG-30 replay reconstruction, 31-03/31-04 BUG-32 GK deflection eligibility) — this plan touched only `ActionPanel.tsx`/`ActionPanel.test.tsx`, no shared code paths with those bugs.

---
_Phase: 31-bug-fixes_
_Completed: 2026-07-22_
