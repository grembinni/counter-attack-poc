---
phase: 25-bug-uat-closure
plan: '07'
subsystem: ui
tags: [react, zustand, actionpanel, undo, movement-counter]

# Dependency graph
requires:
  - phase: 25-bug-uat-closure
    provides: 'Plan 25-03 Task 3 selectedIsMoving implementation being reverted'
provides:
  - 'selectedIsMoving decrement-on-selection removed from ActionPanel.tsx remaining formula'
  - 'canUndo IIFE gated on paceUsedByPieceId non-empty for MOVE/FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE'
affects: [25-bug-uat-closure, actionpanel, movement-counter, undo-button]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'paceUsedByPieceId as the authoritative gate for whether any move has been committed in a slot'

key-files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - 'Use paceUsedByPieceId emptiness (not event-log scan) to gate canUndo at MOVE slot start — server resets it at each boundary, so empty == no committed moves (Bug C fix)'
  - 'Remove selectedIsMoving decrement-on-selection entirely — counter should only change when a move is committed, not when a piece is selected (Bugs A+B revert)'

patterns-established:
  - 'paceUsedByPieceId non-empty guard as early-return in canUndo IIFE for MOVE-family phases'

requirements-completed: [UX-15]

# Metrics
duration: 25min
completed: 2026-07-11
---

# Phase 25 Plan 07: Bug UAT Closure — selectedIsMoving Revert + canUndo Slot Guard Summary

**Reverted D-19 decrement-on-selection (Bugs A+B) and added paceUsedByPieceId empty-map guard to canUndo IIFE (Bug C) — counter now only changes on committed moves and Undo is disabled at the start of every new MOVE slot**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-11T17:00:00Z
- **Completed:** 2026-07-11T17:22:38Z
- **Tasks:** 2 (+ 1 deviation auto-fix)
- **Files modified:** 2

## Accomplishments

- Removed `selectedIsMoving` derived boolean and `selectedPieceId` Zustand selector from ActionPanel.tsx — counter no longer decrements on piece selection
- Restored `remaining` formula to `Math.max(slotTotal - currentSlotLockedCount - paceExhaustedNotLocked, 0)` with no selection term
- Added `Object.keys(paceUsedByPieceId).length === 0` early-return guard in `canUndo` IIFE for MOVE / FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE phases
- All 303 client tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove selectedIsMoving from remaining derivation (Bug A+B revert)** — `e0b73f5` (fix)
2. **Task 2: Gate canUndo on paceUsedByPieceId in MOVE slot (Bug C fix)** — `3bea42f` (fix)
3. **Deviation fix: Update UNDO-01/02 tests for new guard** — `ed94dca` (fix)

## Files Created/Modified

- `packages/client/src/components/ActionPanel.tsx` — Removed selectedIsMoving + selectedPieceId selector; added paceUsedByPieceId guard in canUndo
- `packages/client/src/components/ActionPanel.test.tsx` — Added `paceUsedByPieceId: { 'home-9': 1 }` to UNDO-01/02 test setups to reflect new guard requirement

## Decisions Made

- Use `paceUsedByPieceId` as the authoritative committed-move signal rather than the event log, because `paceUsedByPieceId` is reset server-side at every slot boundary (including the Team A→Team B turn transition that lacks a `SLOT_ADVANCE` event in the log)
- Reverted Task 3 from Plan 25-03 entirely — the decrement-on-selection design conflicted with the board game's commit-on-arrival model and produced counter flicker

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated UNDO-01 and UNDO-02 test setups to include paceUsedByPieceId**

- **Found during:** Task 2 (canUndo guard) post-commit test run
- **Issue:** `mockMovementState` has `paceUsedByPieceId: {}` (empty); UNDO-01/02 tests added a MOVE event to `eventLog` but did not set `paceUsedByPieceId`, so the new Bug-C guard returned `false` and disabled the Undo button, causing 2 test failures
- **Fix:** Added `paceUsedByPieceId: { 'home-9': 1 }` to both test state setups — correctly represents the state where a move has been committed
- **Files modified:** `packages/client/src/components/ActionPanel.test.tsx`
- **Verification:** All 303 tests pass after fix
- **Committed in:** `ed94dca`

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test state that did not represent a committed-move scenario)
**Impact on plan:** Essential fix — tests were correctly describing the desired post-guard behavior but needed accurate state to exercise it. No scope creep.

## Issues Encountered

- Worktree did not have `node_modules` or the `@counter-attack/shared` dist — required `pnpm install` at worktree root and `pnpm --filter @counter-attack/shared build` before TypeScript checks could run. Pre-existing tsc errors in `ActionLog.tsx` and `EventBanner.test.tsx` remain unrelated to this plan.

## Known Stubs

None — all changes are functional, no placeholder values introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. All changes are client-display-only (pure `ActionPanel.tsx` derivation logic).

## Next Phase Readiness

- Bugs A, B, and C from Plan 05 UAT are resolved
- Counter decrements only on committed moves (paceUsedByPieceId update)
- Undo button is disabled at the start of a fresh MOVE slot and only enables after first commit
- Ready for Plan 05 re-UAT or continued UAT closure work

---

_Phase: 25-bug-uat-closure_
_Completed: 2026-07-11_
