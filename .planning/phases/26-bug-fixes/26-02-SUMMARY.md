---
phase: 26-bug-fixes
plan: 02
subsystem: testing
tags: [gameEngine, header, shot, hexDistance, regression, BUG-28, BUG-29]

# Dependency graph
requires:
  - phase: 26-01
    provides: BUG-24 undo scoping fix already committed
provides:
  - Regression suite for BUG-28 header-target range (applyResolveHeaderTarget)
  - Regression suite for BUG-29 shot range (applyDeclareShot)
  - Confirmed production code correctness for both bugs (no production changes needed)
affects: [26-03, 26-04, 26-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Regression-lock-only TDD: investigation confirms existing production code correct, tests added to lock behavior

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.phase26-rules.test.ts
  modified: []

key-decisions:
  - 'BUG-28: applyResolveHeaderTarget referencePosition already correctly uses resolvedWinner?.position (contestant actual position), not ball position — no production change needed'
  - 'BUG-29: hexDistance is cube-consistent (ODD-Q offset → cube via toCube); server constant 11 matches client ActionPanel.tsx:781 (dist <= 11) — no production change needed'
  - 'TDD outcome: regression-lock only — tests pass immediately because production code was already correct'

patterns-established:
  - 'Regression-lock tests: place winner at position different from ball to distinguish contestant-vs-ball referencePosition'
  - 'Hex geometry verification: hand-compute ODD-Q offset → cube before writing distance assertions'

requirements-completed: [BUG-28, BUG-29]

# Metrics
duration: 20min
completed: 2026-07-12
---

# Phase 26 Plan 02: Rules Regression Suite Summary

**Regression suite locking BUG-28 (header-target range uses contestant position, not ball) and BUG-29 (shot range cube-consistent at distance 11) — investigation confirms production code already correct for both bugs**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-12T11:35:00Z
- **Completed:** 2026-07-12T11:42:00Z
- **Tasks:** 2 (both combined into a single regression-lock commit)
- **Files modified:** 1 (created)

## Accomplishments

- Investigated `applyResolveHeaderTarget` (BUG-28): confirmed `referencePosition = resolvedWinner?.position ?? state.ball.position` correctly uses the winning contestant's actual piece position when a contestant exists; ball-position fallback is only the genuinely uncontested case.
- Investigated `applyDeclareShot` (BUG-29): confirmed `hexDistance` in `@counter-attack/shared` converts ODD-Q offset coordinates to cube (via `toCube`) before computing max-component distance; server constant 11 matches client `ActionPanel.tsx:781` (`dist <= 11`); calculation is cube-consistent.
- Created 10-test regression suite covering both bugs: 4 BUG-28 assertions (contestant-vs-ball reference proof, out-of-range rejection, goal-line routing, uncontested fallback) and 6 BUG-29 assertions (hexDistance parity at 11 and 12, accept at 11, reject at 12, GK_DIVE transition, shotTargetHex recorded).
- All 10 tests pass; full server suite (550 tests) remains green; typecheck passes.

## Task Commits

1. **Tasks 1 + 2 combined: BUG-28 + BUG-29 regression suite** - `ab1ffc4` (test)

No GREEN production fix commit — investigation confirmed existing code was already correct for both bugs.

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.phase26-rules.test.ts` — 10-test regression suite: BUG-28 applyResolveHeaderTarget contestant-position reference, BUG-29 applyDeclareShot cube-consistent range gate

## Decisions Made

- **BUG-28 no-change decision:** `resolveHeaderWinnerPiece` returns the contestant piece with its actual position when `headerContestants` for the winner team is non-empty. The `referencePosition = resolvedWinner?.position ?? state.ball.position` fallback chain is correct as written. Regression-lock only.
- **BUG-29 no-change decision:** `hexDistance` already converts ODD-Q offset to cube via `toCube` before max-component calculation. The server `> 11` gate matches the client `<= 11` preview. Regression-lock only.
- **TDD approach:** Plan anticipated this outcome ("if investigation confirms correct, no production change required — lock with tests"). Tests committed in a single `test(26-02)` commit rather than a RED->GREEN cycle since production code needed no modification.

## Deviations from Plan

None — plan executed exactly as written. Plan explicitly stated "regression-lock only" as the expected outcome if investigation confirmed correctness, which it did.

## Issues Encountered

- Pre-commit ESLint hook rejected an unused `homeGk` piece fixture that was added defensively but not referenced in any test. Removed immediately; commit succeeded on the second attempt.
- Shared package needed to be built (`pnpm --filter @counter-attack/shared build`) before tests could resolve `@counter-attack/shared` imports — standard worktree setup step.

## Known Stubs

None — test file only; no data stubs or placeholder values.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Test file only.

## Next Phase Readiness

- BUG-28 and BUG-29 behavior is now locked by regression tests; any future regression in header-target reference or shot-range gate will be caught immediately.
- Wave 2 plan 26-02 is complete; plans 26-03 through 26-05 (BUG-25, BUG-26, BUG-27 client fixes) can proceed.

---

_Phase: 26-bug-fixes_
_Completed: 2026-07-12_
