---
phase: 36-bug-fixes
plan: 05
subsystem: rules
tags: [undo, game-engine, dice-roll, action-panel, state-machine]

# Dependency graph
requires:
  - phase: 36-bug-fixes plan 04
    provides: prior wave-1 bug fixes merged into this worktree's base
provides:
  - Undo cannot revert state to before a resolved TACKLE_ATTEMPT/STEAL_ATTEMPT (BUG-37 / D-13)
  - Undo remains fully available for steps taken after the resolved contest (clamp, not lockout)
  - Client canUndo mirrors the server's applyUndo boundary set term-for-term
affects: [undo, gameEngine, ActionPanel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Undo boundary floor extended via unconditional isBoundary disjunction terms, never via the separate DICE_ROLL per-slot lockout check'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.phase26-undo.test.ts
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - "TACKLE_ATTEMPT and STEAL_ATTEMPT added unconditionally (no phase guard) to applyUndo's isBoundary disjunction and to ActionPanel's canUndo isBoundary disjunction, at the same level as the existing SLOT_ADVANCE/KICK_OFF terms"
  - "The currentSlotEvents.some(... 'DICE_ROLL') lockout check was left byte-identical — extending it would have made Undo unavailable for the rest of the slot, contradicting D-13's clamp-not-lockout requirement"

patterns-established:
  - 'Undo-floor extension pattern: add new boundary event types to the isBoundary reducer, never to the separate slot-wide lockout check'

requirements-completed: [BUG-37]

# Metrics
duration: ~35min
completed: 2026-08-02
---

# Phase 36 Plan 05: Clamp Undo at a Resolved Dice-Roll Trigger Summary

**Undo now refuses to cross a resolved TACKLE_ATTEMPT or STEAL_ATTEMPT on both the server (`applyUndo`) and the client (`ActionPanel`'s `canUndo`), while remaining fully available for any move made after the contest resolves.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- Extended `applyUndo`'s boundary-floor disjunction in `packages/server/src/gameEngine.ts` with unconditional `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` terms, closing the defect where Undo could revert past a resolved dice-roll contest (re-rolling a committed outcome)
- Left the separate `currentSlotEvents.some(... 'DICE_ROLL')` per-slot lockout untouched — confirming the fix is a clamp (only blocks crossing the resolved event), not a lockout (which would disable Undo for the rest of the slot)
- Mirrored the identical fix in `ActionPanel`'s `canUndo` UX computation, keeping client and server boundary term sets identical (server remains the sole enforcement layer per the threat model)
- Added 10 new server regression tests and 5 new client regression tests covering: clamp on resolved tackle, clamp on resolved steal, continued undo-ability for moves made after each, and non-regression of the pre-existing `SLOT_ADVANCE`-only boundary

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the server-side applyUndo boundary set and prove clamp-not-lockout** - `ec0c8ba` (fix)
2. **Task 2: Mirror the boundary in the client canUndo computation** - `47c1c32` (fix)

_Note: this plan runs in worktree isolation — the plan-metadata commit (SUMMARY.md) is committed separately per the worktree protocol; STATE.md/ROADMAP.md are updated by the orchestrator after merge, not by this executor._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - `applyUndo`'s `isBoundary` disjunction extended with unconditional `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` terms; doc comment extended to record BUG-37/D-13
- `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` - New `Phase 36 BUG-37` describe block: 10 tests covering clamp, post-contest undo-ability, and non-regression for both TACKLE_ATTEMPT and STEAL_ATTEMPT
- `packages/client/src/components/ActionPanel.tsx` - `canUndo`'s `isBoundary` disjunction mirrors the server change identically; comment updated to cite BUG-37/D-13 and note the server is the enforcement layer
- `packages/client/src/components/ActionPanel.test.tsx` - New `BUG-37` describe block: 5 tests covering the Undo button's disabled/enabled state around a resolved tackle/steal

## Decisions Made

- Both new boundary terms were added unconditionally (no phase guard), matching the plan's explicit instruction that they sit at the same level as `SLOT_ADVANCE`/`KICK_OFF`, not inside any phase-scoped clause
- No changes made to `moveTypeForPhase`, the `lastMoveRelIdx` search, pace/`movedPieceIds` restoration, or the event-log splice logic — scope was strictly the boundary-floor reducer on both sides

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched the plan's `<action>` and `<acceptance_criteria>` precisely; no architectural changes, no missing critical functionality discovered, no blocking issues.

## Issues Encountered

- First `pnpm --filter @counter-attack/server test` run after a fresh `pnpm install` hit a transient `Worker exited unexpectedly` error (1 test file didn't report), unrelated to this plan's changes (likely resource contention immediately following the multi-minute dependency install). A clean rerun passed all 33 server test files (640 tests, 1 skipped, 1 todo) with no errors.
- The worktree had no `node_modules` and `packages/shared` had no build output at session start; ran `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` before tests could resolve `@counter-attack/shared`. Standard worktree bootstrap, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm --filter @counter-attack/server test -- gameEngine.phase26-undo` — 10/10 passed
- `pnpm --filter @counter-attack/client test -- ActionPanel` — 73/73 passed (includes 5 new BUG-37 tests)
- `pnpm --filter @counter-attack/server test` (full suite) — 33 files, 640 passed, 1 skipped, 1 todo, 0 failed
- `pnpm --filter @counter-attack/client test` (full suite) — 25 files, 483 passed, 0 failed
- `pnpm --filter @counter-attack/server exec tsc --noEmit` — clean
- `pnpm --filter @counter-attack/client exec tsc --noEmit` — clean
- Mirror gate: `grep -n "STEAL_ATTEMPT" packages/server/src/gameEngine.ts packages/client/src/components/ActionPanel.tsx` — term present in both boundary disjunctions
- Wrong-site gate: `git diff HEAD~2 -- packages/server/src/gameEngine.ts | grep DICE_ROLL` — no output; the `currentSlotEvents.some(... 'DICE_ROLL')` lockout line is unchanged

## Next Phase Readiness

- BUG-37 fully closed: Undo cannot revert state to before a resolved TACKLE_ATTEMPT/STEAL_ATTEMPT, and remains available for steps taken after it
- Client and server boundary sets are identical; the server is the sole enforcement point (T-36-13 mitigated)
- No blockers for subsequent Phase 36 waves

---

_Phase: 36-bug-fixes_
_Completed: 2026-08-02_
