---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 11
subsystem: game-engine
tags: [gameEngine, applyMove, applyEndTurn, throw-in, gap-closure, code-review-fix, vitest]

# Dependency graph
requires:
  - phase: 37-out-of-bounds-detection-throw-in-goal-kick (Plan 05)
    provides: applyThrowInPlace + applyEndTurn's THROWIN-03 two-Movement-Phase counting model
provides:
  - Single shared THROW_IN_TEARDOWN literal spread at all six throw-in-context teardown sites in gameEngine.ts
  - Narrowed applyEndTurn throwInStillValid re-entry guard (state.lastActionType clause)
  - CR-01 unit + end-to-end regression coverage for the reachable stale-throw-in-context bug
  - REQUIREMENTS.md traceability synced for all 15 Phase 37 requirement IDs
affects:
  [
    37-VERIFICATION.md follow-up,
    any future Phase 37/38 work touching applyMove break-in-play returns or applyEndTurn's intermediate-slot-transition branch,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Single shared teardown literal (THROW_IN_TEARDOWN) spread at every early-return call site instead of duplicating a null-clearing object literal per site'
    - 'Defense-in-depth FSM re-entry guard narrowed on a second independent state signal (lastActionType) in addition to the primary signal (throwInPhasesTaken), while accounting for a pre-existing unconditional reset of that signal at intermediate slot transitions'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - 'D-11-01/D-11-02/D-11-03/D-11-04 (plan-locked, implemented as written): both the shared teardown AND the narrowed re-entry guard are applied; no new GameState field; the narrowing clause is not paired to throwInPhasesTaken; the defensive third early return (defending-team pickup) is included.'
  - "Deviation (Rule 1 - bug): the plan's guard design assumed applyStartMovement's lastActionType-preservation was the only relevant carrier, but did not account for the pre-existing D-17 (WR-02) intermediate-slot-transition reset in applyEndTurn, which unconditionally overwrites lastActionType to 'MOVEMENT_PHASE' at every ATTACKER_4->DEFENDER_5 and DEFENDER_5->ATTACKER_2 step. Since movementSlot can only reach ATTACKER_2 (the slot the terminal check fires from) via that transition, the guard as literally specified in the plan saw lastActionType==='MOVEMENT_PHASE' on every real FSM traversal and never null/THROW_IN_MOVEMENT_1 -- breaking THROWIN-03's entire clean path. Widened the accepted set to include 'MOVEMENT_PHASE'. This still excludes SUCCESSFUL_TACKLE/DEFLECTION, which is the only exclusion the guard can meaningfully make given D-17 already scrubs a turnover marker before the terminal check ever runs on any real code path."

patterns-established:
  - 'When narrowing an FSM re-entry guard on a state field that survives one FSM transition, verify it also survives every OTHER transition on the path to the check site -- not just the one transition explicitly named in the design rationale.'

requirements-completed: [THROWIN-03]

# Metrics
duration: ~25min
completed: 2026-08-04
---

# Phase 37 Plan 11: CR-01 Stale Throw-In Teardown Gap Closure Summary

**Single shared `THROW_IN_TEARDOWN` literal closes the stale-throw-in-context blocker (CR-01) across all six applyMove/applyEndTurn early-return sites, with a narrowed re-entry guard and full regression coverage (11 new tests, 772/772 server suite green).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-04T12:00:00-05:00 (approx.)
- **Completed:** 2026-08-04T12:13:09-05:00
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Closed the one BLOCKER gap from `37-VERIFICATION.md` / `37-REVIEW.md` CR-01: a successful tackle, successful steal, or defending-team loose-ball pickup that ends a throw-in Movement Phase early no longer leaves `throwInHex`/`throwInTeam`/`throwInPhasesTaken` stale on state — all three now clear via one shared `THROW_IN_TEARDOWN` literal spread at all six teardown sites.
- Narrowed `applyEndTurn`'s `throwInStillValid` re-entry guard with an additional `state.lastActionType` clause, so the throw-in branch is defended by two independent signals rather than one coincidence check (`carrier.teamId === state.throwInTeam`).
- Discovered and fixed a real bug in the plan's own guard design during verification (Rule 1 — see Deviations below): the pre-existing D-17 (WR-02) intermediate-slot-transition reset would have made the narrowed guard as originally specified break the entire legitimate throw-in flow. Caught by the plan's own required `throwIn.integration.test.ts` verification gate before it could ship broken.
- Added the exact reachable five-step corruption sequence from `37-REVIEW.md` as an executable regression test, with a red-first proof recorded below.
- Synced `.planning/REQUIREMENTS.md` traceability for all 15 Phase 37 requirement IDs (checkbox list + traceability table), leaving `OOB-03`/`CORNER-*` untouched (Phase 38 scope).

## Task Commits

Each task was committed atomically:

1. **Task 1: Single shared throw-in teardown + a sound applyEndTurn re-entry guard** - `542566c` (fix) + `c0ae215` (fix — Rule 1 deviation, see below)
2. **Task 2: End-to-end regression test for the documented reachable corruption sequence** - `28437a7` (test)
3. **Task 3: Sync REQUIREMENTS.md traceability for the 15 Phase 37 requirement IDs** - `10f4c9e` (docs)

_Note: `542566c` implements Task 1's Part A-D exactly as planned; `c0ae215` is a same-task follow-up fix for a bug discovered while running Task 1's own required verification (`throwIn.integration.test.ts`), applied before moving on to Task 2 per Rule 1 (auto-fix bugs)._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — module-private `THROW_IN_TEARDOWN` literal (line 633); spread at all six teardown sites (lines 818, 986, 1061, 1178, 1208, 1312); narrowed `throwInStillValid` guard (line 1248) with the `state.lastActionType` clause
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` — `CR-01 throw-in teardown on break-in-play early returns` describe (10 tests) + `CR-01 regression: interrupted throw-in cannot corrupt a later Movement Phase` describe (1 test)
- `.planning/REQUIREMENTS.md` — 15 Phase 37 requirement IDs marked Complete in both the checkbox list and the traceability table

## Final Teardown Spread Site Line Numbers

```
633:const THROW_IN_TEARDOWN = {
818:          ...THROW_IN_TEARDOWN,   // applyMove: defending-team loose-ball pickup return
986:            ...THROW_IN_TEARDOWN, // applyMove: tackle-success return
1061:        ...THROW_IN_TEARDOWN,    // applyMove: steal-success return
1178:          ...THROW_IN_TEARDOWN,  // applyEndTurn: half-end (HALF_TIME/FULL_TIME) return
1208:            ...THROW_IN_TEARDOWN,// applyEndTurn: GK_RESTART return
1312:        ...THROW_IN_TEARDOWN,    // applyEndTurn: generic ATTACKER_2->PASS return
```

## Final `throwInStillValid` Guard Text

```typescript
const throwInStillValid =
  state.throwInPhasesTaken !== null &&
  state.throwInPhasesTaken !== undefined &&
  state.throwInPhasesTaken < 2 &&
  carrier != null &&
  carrier.teamId === state.throwInTeam &&
  (state.lastActionType === null ||
    state.lastActionType === 'THROW_IN_MOVEMENT_1' ||
    state.lastActionType === 'MOVEMENT_PHASE');
```

(The plan specified only `null || 'THROW_IN_MOVEMENT_1'`; `'MOVEMENT_PHASE'` was added as a Rule 1 deviation — see below.)

## Decisions Made

- D-11-01 through D-11-04 (plan-locked): implemented exactly as specified — both the teardown and the guard narrowing are applied together (D-11-01); no new `GameState` field (D-11-02); the narrowing clause is not paired to `throwInPhasesTaken` (D-11-03); the defensive third early return (defending-team pickup) is included even though currently unreachable during a throw-in (D-11-04).
- Guard widened to accept `'MOVEMENT_PHASE'` in addition to `null`/`'THROW_IN_MOVEMENT_1'` — see Deviations below for full rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `throwInStillValid` guard broke the legitimate clean throw-in path**

- **Found during:** Task 1, while running the plan's own required verification (`pnpm --filter @counter-attack/server test -- throwIn.integration`) immediately after implementing Part D exactly as specified.
- **Issue:** The plan's guard design (D-11-02) assumed `state.lastActionType` would be `null` for Movement Phase 1 and `'THROW_IN_MOVEMENT_1'` for Movement Phase 2 at the point `applyEndTurn`'s terminal (`nextSlot === null`) block runs. This overlooked a pre-existing, unrelated fix — D-17 (WR-02), introduced in commit `0600ab4` (Plan 10-02) — that unconditionally resets `lastActionType` to `'MOVEMENT_PHASE'` at every intermediate slot transition (`ATTACKER_4->DEFENDER_5` and `DEFENDER_5->ATTACKER_2`) inside the same function. Since `movementSlot` can only reach `'ATTACKER_2'` (the slot from which the terminal check fires) via that `DEFENDER_5->ATTACKER_2` transition, `state.lastActionType` is `'MOVEMENT_PHASE'` at the terminal check on every real gameplay traversal — never `null`, never `'THROW_IN_MOVEMENT_1'`. With the guard as literally specified, `throwInStillValid` was always `false` in production, meaning THROWIN-03's entire two-Movement-Phase clean path (never entering `THROW_IN_MOVEMENT_1`/`THROW_IN_MOVEMENT_2`) would have shipped broken. Confirmed by `throwIn.integration.test.ts` regressing from 15/15 to 13/15 (`T-37-19`/`T-37-20` failing with `expected 'MOVEMENT_PHASE' to be 'THROW_IN_MOVEMENT_1'`).
- **Fix:** Widened the guard's accepted `lastActionType` set to include `'MOVEMENT_PHASE'`. This still excludes `SUCCESSFUL_TACKLE`/`DEFLECTION` — which is the only exclusion the guard can meaningfully make, since D-17 already scrubs any turnover marker at the first subsequent intermediate transition before the terminal check ever runs on any real code path. The guard therefore still functions as documented defense-in-depth against a hypothetical future caller that invokes `applyEndTurn` directly on a state already sitting in `ATTACKER_2` with a stale turnover-marker `lastActionType`, bypassing the normal intermediate-transition codepath.
- **Files modified:** `packages/server/src/gameEngine.ts` (guard clause + updated rationale comment)
- **Verification:** `throwIn.integration.test.ts` restored to 15/15; `gameEngine.outOfBounds.test.ts`'s new CR-01 unit tests (including the two stale-turnover-marker cases) still pass unchanged; full server suite 772/772 green; typecheck clean.
- **Committed in:** `c0ae215` (separate commit, not amended into `542566c`, per no-amend policy)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — bug)
**Impact on plan:** Necessary correctness fix — without it, THROWIN-03's clean 1-or-2-Movement-Phase flow would have regressed while "fixing" CR-01. No scope creep; the fix is a one-line widening of an OR-clause plus an expanded rationale comment. No new files, no architectural change.

## Issues Encountered

- Worktree had no `node_modules` (fresh worktree) — ran `pnpm install --prefer-offline` (all packages resolved from local cache, zero downloads) and `pnpm --filter @counter-attack/shared build` (the `@counter-attack/server` test suite imports `@counter-attack/shared`'s compiled `dist/` output, which did not yet exist in this worktree) before any test could run. Both are environment setup, not deviations from the plan.

## Red-First Proof (Task 2, acceptance criterion)

With `packages/server/src/gameEngine.ts` checked out to commit `28d430a` (the last commit before this plan's fixes) while keeping the new/updated test file, 6 tests fail — the primary CR-01 regression assertion and 5 related CR-01 unit tests:

```
❯ src/__tests__/gameEngine.outOfBounds.test.ts (85 tests | 6 failed)
  × CR-01 throw-in teardown on break-in-play early returns > tackle success clears throwInHex/throwInTeam/throwInPhasesTaken
    → expected { q: 10, r: 7 } to be null
  × CR-01 throw-in teardown on break-in-play early returns > steal success clears throwInHex/throwInTeam/throwInPhasesTaken
    → expected { q: 10, r: 7 } to be null
  × CR-01 throw-in teardown on break-in-play early returns > defending-team loose-ball pickup clears throwInHex/throwInTeam/throwInPhasesTaken
    → expected { q: 10, r: 7 } to be null
  × CR-01 throw-in teardown on break-in-play early returns > applyEndTurn's throw-in branch does not fire when lastActionType is a stale SUCCESSFUL_TACKLE marker
    → expected 'THROW_IN_MOVEMENT_1' to be 'MOVEMENT_PHASE'
  × CR-01 throw-in teardown on break-in-play early returns > applyEndTurn's throw-in branch does not fire when lastActionType is a stale DEFLECTION marker
    → expected 'THROW_IN_MOVEMENT_1' to be 'MOVEMENT_PHASE'
  × CR-01 regression: interrupted throw-in cannot corrupt a later Movement Phase > a throw-in interrupted twice by tackles still ends a later clean Movement Phase as MOVEMENT_PHASE, not THROW_IN_MOVEMENT_1
    → expected { q: 10, r: 7 } to be null

 Test Files  1 failed (1)
      Tests  6 failed | 79 passed (85)
```

With `gameEngine.ts` restored to this plan's committed state (`git checkout HEAD -- packages/server/src/gameEngine.ts`):

```
✓ src/__tests__/gameEngine.outOfBounds.test.ts (85 tests) 25ms
 Test Files  1 passed (1)
      Tests  85 passed (85)
```

(Note: rather than `git stash`, which is prohibited in worktree mode per the destructive-git-operations policy, the red-first proof used `git checkout <pre-fix-commit> -- packages/server/src/gameEngine.ts` followed by `git checkout HEAD -- packages/server/src/gameEngine.ts` to restore — functionally equivalent, single-file, non-destructive.)

## Before/After Full-Server-Suite Pass Counts

- **Pre-gap baseline (per plan text, `37-REVIEW.md`):** 761 passed / 1 skipped / 1 todo, 36 files
- **After this plan:** 772 passed / 1 skipped / 1 todo, 36 files (761 + 10 Task-1 unit tests + 1 Task-2 regression test = 772)
- Zero failures at every intermediate step and at completion.

## Verification Results

- `pnpm --filter @counter-attack/server test` — 772 passed / 1 skipped / 1 todo, 0 failures ✓
- `pnpm --filter @counter-attack/server test -- gameEngine.outOfBounds` — 85/85, including all nine pre-existing `applyEndTurn throw-in movement counting` tests unedited (confirmed via `git diff -U0` — insertions only, no deletions in the pre-existing describe's line range) ✓
- `pnpm --filter @counter-attack/server test -- throwIn.integration` — 15/15 (confirms the narrowed guard did not break the legitimate 1-or-2-Movement-Phase clean path) ✓
- `pnpm --filter @counter-attack/server test -- goalKick.integration` — 25/25 (confirms the shared teardown did not disturb the goal-kick state machine) ✓
- `pnpm -r typecheck` — clean across `packages/shared`, `packages/server`, `packages/client` ✓
- `grep -c '| Phase 37 | Pending' .planning/REQUIREMENTS.md` — 0 ✓
- `grep -c '| Phase 37 | Complete' .planning/REQUIREMENTS.md` — 15 ✓
- All Task 1/Task 2 acceptance-criteria grep checks (THROW_IN_TEARDOWN const count=1, spread count=6, throwInClear count=0, throwInHex: null count=1, guard narrowing line present) — all pass exactly as specified

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CR-01 (the one BLOCKER from `37-VERIFICATION.md`) is closed. THROWIN-03 is now fully satisfied (was PARTIALLY SATISFIED).
- All 15 Phase 37 requirement IDs read Complete in `REQUIREMENTS.md`. `OOB-03` and `CORNER-*` remain correctly assigned to Phase 38.
- No follow-up work identified for this specific gap; `37-12` (the sibling gap-closure plan for WR-01/WR-02 warnings) is a separate, independent plan not touched here.
- The Rule 1 deviation (widening the guard to accept `MOVEMENT_PHASE`) is a durable fix, not a workaround — it correctly reflects the actual invariant given the pre-existing D-17 behavior, and is fully covered by both the new unit tests and the pre-existing integration suite.

---

## Self-Check: PASSED

- FOUND: `packages/server/src/gameEngine.ts`
- FOUND: `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-11-SUMMARY.md`
- FOUND commit: `542566c` (Task 1)
- FOUND commit: `c0ae215` (Task 1 — Rule 1 deviation fix)
- FOUND commit: `28437a7` (Task 2)
- FOUND commit: `10f4c9e` (Task 3)
- FOUND commit: `865a88d` (this summary)

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Completed: 2026-08-04_
