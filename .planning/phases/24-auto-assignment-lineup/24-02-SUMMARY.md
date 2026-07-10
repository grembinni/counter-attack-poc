---
phase: 24-auto-assignment-lineup
plan: 02
subsystem: api
tags: [typescript, vitest, game-engine, auto-assignment, formation]

# Dependency graph
requires:
  - phase: 24-auto-assignment-lineup/24-01
    provides: lineup event contracts (LINEUP_ASSIGNMENT_READY, LINEUP_SWAP, LINEUP_CONFIRM)
  - phase: 23-formation-system
    provides: FormationSlot, SlotRole, FORMATIONS registry

provides:
  - computeAutoAssignment — deterministic three-pass greedy assignment (ASSIGN-01)
  - scoreForRole — D-04 weighted scoring for all 7 SlotRole values
  - ANCHOR_ROLES const ['DEF-center','MID-central','FWD-central']
  - buildSquadPieces/buildInitialGameState accept confirmedHomeOrder/confirmedAwayOrder (D-11)
  - Unit test coverage for GK lock, anchor-before-flex, tie-break, and all D-04 formulas

affects:
  - 24-03 (lineupAssignment integration tests that call computeAutoAssignment via roomHandlers)
  - 24-04 (LineupAssignmentScreen relies on confirmed ordering from this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'pickBest: shallow copy + sort preserves object identity so indexOf splice is safe'
    - 'Three-pass greedy: GK-lock → anchor-roles → flex-roles; deterministic, no Math.random'
    - 'Optional trailing params on buildSquadPieces/buildInitialGameState with ?? fallback'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.phase24.test.ts
  modified:
    - packages/server/src/gameEngine.ts

key-decisions:
  - 'ST role excluded from FWD-wing +3 bonus (literal D-04; A1 resolved); strikers pulled central by FWD-central +4'
  - 'pickBest sorts a shallow copy of available[] to preserve object references — indexOf works correctly'
  - 'buildKickOffPieces NOT modified (Pitfall 8/A2): post-goal resets use getSquadPlayers default order'
  - 'new Array<PoolPlayer | null>(n).fill(null) required to satisfy no-unsafe-assignment ESLint rule'

patterns-established:
  - 'Object-identity-safe splice: spread available with [...available].sort() not available.map(e => ({...e}))'

requirements-completed: [ASSIGN-01]

# Metrics
duration: 8min
completed: 2026-07-10
---

# Phase 24 Plan 02: Auto-Assignment Algorithm Summary

**Deterministic three-pass greedy auto-assignment (computeAutoAssignment + scoreForRole) with D-04 weighted formulas, and optional confirmed-order threading through buildSquadPieces/buildInitialGameState**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-10T17:32:30Z
- **Completed:** 2026-07-10T17:41:10Z
- **Tasks:** 3 (RED, GREEN, thread-params)
- **Files modified:** 2

## Accomplishments

- Exported `computeAutoAssignment` with three-pass greedy strategy: GK lock (Pass 1), anchor slots (Pass 2), flex slots (Pass 3)
- Exported `scoreForRole` implementing all 7 D-04 formulas; ST intentionally excluded from FWD-wing bonus
- 18 unit tests covering GK-in-slot-0, no-duplicates across all 4 formations, anchor-before-flex, tie-break-by-index, and scoreForRole numeric values for all tested roles
- `buildSquadPieces` and `buildInitialGameState` extended with optional `confirmedHomeOrder`/`confirmedAwayOrder`; `buildKickOffPieces` intentionally untouched (Pitfall 8)
- Full server suite: 524 tests passing (baseline was 506)

## Task Commits

1. **Task 1: RED — failing unit tests** - `4b5298b` (test)
2. **Task 2: GREEN — computeAutoAssignment + scoreForRole** - `bbae642` (feat)
3. **Task 3: Thread confirmed-order params** - `bdba535` (feat)

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.phase24.test.ts` — 18 unit tests for ASSIGN-01 (created)
- `packages/server/src/gameEngine.ts` — computeAutoAssignment, scoreForRole, ANCHOR_ROLES, confirmed-order threading (modified)

## Decisions Made

- ST role excluded from FWD-wing +3 bonus (literal D-04 wording; assumption A1 resolved in RESEARCH.md): strikers are pulled to FWD-central slots by the +4 bonus there instead
- `buildKickOffPieces` not modified: post-goal resets intentionally use `getSquadPlayers` default ordering per Pitfall 8/A2 (preserves existing behavior)
- `pickBest` uses `[...available].sort(...)` (shallow copy) not `available.map(e => ({...e, score}))` — preserving object references so `indexOf` in the caller splice is safe

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pickBest created new object references via spread, breaking available.splice**

- **Found during:** Task 2 (GREEN — implementation), caught by failing Test 2a-2d (duplicate IDs) and Test 3-4
- **Issue:** `available.map((e) => ({ ...e, score }))` created new object instances. `available.indexOf(best)` returned -1. `splice(-1, 1)` silently removed the last element each time, leaving the intended player in `available` and producing duplicate assignments.
- **Fix:** Changed `pickBest` to sort a shallow copy `[...available].sort(...)` whose elements are the same references as in `available`, so `indexOf` works correctly.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** Tests 2a-2d (no-duplicates) and Tests 3-4 (anchor-before-flex, tie-break) pass after fix. The same bug exists in the RESEARCH.md reference implementation.
- **Committed in:** bbae642 (Task 2 commit)

**2. [Rule 1 - Bug] ESLint no-unsafe-assignment on new Array(...).fill(null)**

- **Found during:** Task 2 commit (pre-commit hook caught it)
- **Issue:** `new Array(n).fill(null)` infers `any[]` which violates `@typescript-eslint/no-unsafe-assignment`
- **Fix:** Added explicit type parameter: `new Array<PoolPlayer | null>(n).fill(null)`
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** ESLint passes; same test results
- **Committed in:** bbae642 (Task 2 commit, same commit after fix)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — Bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## Known Stubs

None — all functions are fully implemented and deterministic. No placeholder values or hardcoded empty returns.

## Next Phase Readiness

- `computeAutoAssignment` and `scoreForRole` are exported, tested, and deterministic — Plan 03 can call them directly from the `UNIFORM_CONFIRM` handler
- `buildSquadPieces`/`buildInitialGameState` accept confirmed ordering — Plan 03's `LINEUP_CONFIRM` handler can pass resolved `PoolPlayer[]` arrays
- `buildKickOffPieces` unchanged — existing post-goal reset path unaffected

---

_Phase: 24-auto-assignment-lineup_
_Completed: 2026-07-10_

## Self-Check: PASSED

- FOUND: packages/server/src/**tests**/gameEngine.phase24.test.ts
- FOUND: export function computeAutoAssignment in gameEngine.ts
- FOUND: export function scoreForRole in gameEngine.ts
- FOUND: ANCHOR_ROLES in gameEngine.ts
- FOUND: confirmedHomeOrder in gameEngine.ts (4 occurrences)
- FOUND: commit 4b5298b (test RED)
- FOUND: commit bbae642 (feat GREEN)
- FOUND: commit bdba535 (feat thread-params)
- Full suite: 524 tests passed, 1 skipped, 0 failed
