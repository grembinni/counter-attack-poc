---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 24
subsystem: game-logic
tags: [hex-geometry, fouls, tackling, action-log, gap-closure]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks (Plan 39-19)
    provides: FOUL_TRIGGER_DIE, resolveFoulChain, isProfessionalFoul, attackerGoalPath
  - phase: 39-fouls-cards-injuries-penalty-kicks (Plan 39-22)
    provides: GK-dive-at-feet foul resolution and 39-UAT gap tracking baseline
provides:
  - FOUL_TRIGGER_DIE_FROM_BEHIND (2), hexesBehindAttacker, isTackleFromBehind, foulTriggerThreshold in packages/shared/src/fouls.ts
  - resolveFoulChain optional triggerThreshold/fromBehind parameters (defaults preserve die-of-1)
  - TACKLE_ATTEMPT-only widened foul trigger (die 1 OR 2) when the tackle destination is one of the two hexes behind the carrier
  - fromBehind: boolean on the FOUL_CALLED ActionEvent
  - ActionLog "Tackle from Behind" distinct log suffix
affects: [40-substitutions, any future ActionLog FOUL_CALLED consumer, replay reconstruction of FOUL_CALLED events]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single threshold-selection function (foulTriggerThreshold) instead of scattering fromBehind boolean branches across call sites"
    - "hexNeighbors (not a hand-rolled offset table) reused for directional 'behind' geometry, per Phase 17.1-08 precedent"

key-files:
  created: []
  modified:
    - packages/shared/src/fouls.ts
    - packages/shared/src/fouls.test.ts
    - packages/shared/src/types.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.fouls.test.ts
    - packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts
    - packages/server/src/__tests__/gameEngine.undoReplay39.test.ts
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionLog.test.tsx
    - packages/client/src/components/EventBanner.test.tsx

key-decisions:
  - "fromBehind is a required (not optional) field on FOUL_CALLED — there is exactly one construction site (resolveFoulChain), so every fixture across the codebase was updated rather than defaulting it away"
  - "STEAL_ATTEMPT and GK_DIVE_AT_FEET call sites pass no triggerThreshold/fromBehind at all (rely on resolveFoulChain's defaults) rather than passing an explicit false/FOUL_TRIGGER_DIE, to keep the 'only TACKLE widens' invariant enforceable by a single grep for isTackleFromBehind call count"

patterns-established:
  - "Directional hex geometry (front/lateral/behind relative to attack direction) is derived via hexNeighbors + a q-delta filter, never a hand-rolled offset table"

requirements-completed: [FOUL-01, CARD-01]

# Metrics
duration: 25min
completed: 2026-08-15
---

# Phase 39 Plan 24: Tackle-from-Behind Foul Trigger Summary

**A TACKLE_ATTEMPT landing on either of the two hexes directly behind the ball carrier now fouls on a defender die of 1 OR 2 (was only 1), with the Action Log naming it "Tackle from Behind"; steal and GK-dive-at-feet fouls are unaffected.**

## Performance

- **Duration:** 25 min (includes a one-time `pnpm install --frozen-lockfile` to restore the worktree's missing `node_modules`)
- **Tasks:** 2/2
- **Files modified:** 10

## Accomplishments

- Added `hexesBehindAttacker`, `isTackleFromBehind`, `foulTriggerThreshold`, and `FOUL_TRIGGER_DIE_FROM_BEHIND` (=2) to `packages/shared/src/fouls.ts`, all pure and independently unit-tested (62 shared tests total, up from prior count)
- Wired the widened threshold into `resolveFoulChain` via optional `triggerThreshold`/`fromBehind` parameters that default to the pre-existing die-of-1 behavior, and into the `TACKLE_ATTEMPT` branch only — `STEAL_ATTEMPT` and `GK_DIVE_AT_FEET` call sites are untouched and keep the die-of-1 trigger
- Added the required `fromBehind: boolean` field to the `FOUL_CALLED` `ActionEvent`, and updated the single construction site plus every test fixture across the codebase that constructs a `FOUL_CALLED` literal
- `ActionLog.tsx` renders a `— Tackle from Behind` suffix (same position/style as the existing DOGSO suffix) when `fromBehind` is true, and both suffixes render together when a from-behind tackle is also a professional foul
- 35 server tests (`gameEngine.fouls.test.ts`) and 69 client tests (`ActionLog.test.tsx`) pass, including new coverage for behind/lateral/in-front tackle destinations, home/away mirroring, steal-trigger isolation, and GK-dive-trigger isolation

## Worked Geometry Examples (for audit without re-running the suite)

- **Even-`q` home carrier at `{q:20,r:13}`:** `hexesBehindAttacker` returns `{q:19,r:12}` and `{q:19,r:13}` (both `q===19`)
- **Odd-`q` home carrier at `{q:21,r:13}`:** `hexesBehindAttacker` returns `{q:20,r:13}` and `{q:20,r:14}` (both `q===20`, distinct `r` set from the even-`q` case — proves the parity-correct `hexNeighbors` path is used, not a hand-rolled offset)
- **Away mirror at `{q:20,r:13}`:** `hexesBehindAttacker` returns `{q:21,r:12}` and `{q:21,r:13}` (both `q===21`)
- **Engine-level worked example (`gameEngine.fouls.test.ts`):** home carrier at `{q:10,r:7}` → behind hexes `{q:9,r:6}`/`{q:9,r:7}`; a tackler moving `{q:8,r:7}` → `{q:9,r:7}` with `tackleDie:2` fouls (`fromBehind:true`); the same tackler moving `{q:11,r:6}` → `{q:10,r:6}` (lateral) with `tackleDie:2` does NOT foul; away-mirror carrier at `{q:20,r:7}` → behind hex `{q:21,r:7}`, tackler `{q:22,r:7}` → `{q:21,r:7}` with `tackleDie:2` fouls (`fromBehind:true`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the from-behind geometry and trigger-threshold helpers** - `9d46e09` (feat)
2. **Task 2: Apply the widened trigger to tackles only and log it distinctly** - `e58fc80` (feat)

_No TDD tasks in this plan (`tdd` not set on either task) — standard auto-execution._

## Files Created/Modified

- `packages/shared/src/fouls.ts` - Added `FOUL_TRIGGER_DIE_FROM_BEHIND`, `hexesBehindAttacker`, `isTackleFromBehind`, `foulTriggerThreshold`
- `packages/shared/src/fouls.test.ts` - Added 21 new tests covering geometry, mirroring, parity, and threshold selection
- `packages/shared/src/types.ts` - Added required `fromBehind: boolean` to the `FOUL_CALLED` `ActionEvent`
- `packages/server/src/gameEngine.ts` - `resolveFoulChain` gained optional `triggerThreshold`/`fromBehind`; `TACKLE_ATTEMPT` branch computes and passes both; `STEAL_ATTEMPT`/`GK_DIVE_AT_FEET` call sites annotated as intentionally unchanged
- `packages/server/src/__tests__/gameEngine.fouls.test.ts` - Added an 8-test describe block for the from-behind trigger (behind/lateral/in-front destinations, die 1/2/3, steal isolation, away mirror)
- `packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts` - Added `fromBehind: false` assertions to the two existing GKDIVE-03 foul tests (out-of-plan file, see Deviations)
- `packages/server/src/__tests__/gameEngine.undoReplay39.test.ts` - Added `fromBehind: false` to the `FOUL_CALLED` event fixture (out-of-plan file, see Deviations)
- `packages/client/src/components/ActionLog.tsx` - `FOUL_CALLED` case renders a `— Tackle from Behind` suffix
- `packages/client/src/components/ActionLog.test.tsx` - Added `fromBehind` field to the existing FOUL_CALLED test plus 2 new tests (from-behind alone, from-behind + professional together)
- `packages/client/src/components/EventBanner.test.tsx` - Added `fromBehind: false` to both `FOUL_CALLED` event fixtures (out-of-plan file, see Deviations)

## Decisions Made

- `defenderDie > triggerThreshold` (not `!==`) is the early-return condition in `resolveFoulChain`, so a threshold of 1 reproduces the exact prior behavior (foul only on exactly 1) and a threshold of 2 admits both 1 and 2 without any special-casing
- `foulTriggerThreshold` is the single call-site choice point between the two exported constants — no caller branches on the `fromBehind` boolean directly, satisfying the plan's "no call site ever branches on the boolean itself" requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no `node_modules` — installed from the existing lockfile**
- **Found during:** Task 1 verification (`pnpm --filter @counter-attack/shared test fouls` failed with `'vitest' is not recognized`)
- **Issue:** The worktree checkout had no `node_modules` at all (not even a junction), so no test/build/lint command could run
- **Fix:** Ran `pnpm install --frozen-lockfile` at the worktree root — restores exactly the versions pinned in the existing `pnpm-lock.yaml`, adds no new dependency, and is not the "new package install" case the deviation-rules exclusion targets
- **Files modified:** none (node_modules is gitignored)
- **Verification:** All subsequent test/typecheck/lint commands ran successfully
- **Committed in:** N/A (no tracked files changed)

**2. [Rule 3 - Blocking] `fromBehind: boolean` is a required field on `FOUL_CALLED` — every existing test fixture needed updating**
- **Found during:** Task 2, after adding the required field to `types.ts`
- **Issue:** `packages/server/src/__tests__/gameEngine.undoReplay39.test.ts` and `packages/client/src/components/EventBanner.test.tsx` (both outside this plan's declared `files_modified` list) construct literal `FOUL_CALLED` events and would fail to typecheck without the new field
- **Fix:** Added `fromBehind: false` to each existing literal (both scenarios predate the from-behind rule and are unaffected by it)
- **Files modified:** `packages/server/src/__tests__/gameEngine.undoReplay39.test.ts`, `packages/client/src/components/EventBanner.test.tsx`
- **Verification:** `pnpm typecheck` passes across all three packages; both files' test suites still pass
- **Committed in:** `e58fc80` (Task 2 commit)

**3. [Rule 2 - Missing coverage] Added `fromBehind: false` assertions to the existing GKDIVE-03 foul tests**
- **Found during:** Task 2, satisfying the acceptance criterion "`fromBehind` is `false` on every GK-dive-sourced `FOUL_CALLED` event"
- **Issue:** `packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts` (outside this plan's declared `files_modified` list) already exercises GK-dive-sourced fouls but had no assertion on the new field
- **Fix:** Added a one-line `fromBehind` assertion to both existing "fires on gkDie===1" tests rather than duplicating the GK-dive fixture machinery inside `gameEngine.fouls.test.ts`
- **Files modified:** `packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test` — 1335 tests pass
- **Committed in:** `e58fc80` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing-coverage addition)
**Impact on plan:** All three were necessary to keep the build/typecheck green and to satisfy an explicit acceptance criterion. No scope creep beyond what the required-field change and the acceptance criteria demanded.

## Issues Encountered

- The whole-workspace `pnpm lint` command fails with `Parsing error: Too many files (>8) have matched the default project` inside `packages/shared` — this is the pre-existing, previously-documented tech debt from Phase 32/33 close (`packages/shared` typescript-eslint file-count-cap config issue, unrelated to any phase's specific changes; see `PROJECT.md`'s "Known tech debt entering Phase 33" note). Verified it is NOT caused by this plan: `npx eslint` run directly against every file this plan touched (`fouls.ts`, `types.ts`, `fouls.test.ts`, `gameEngine.ts`, `gameEngine.fouls.test.ts`, `gameEngine.gkDiveAtFeet.test.ts`, `gameEngine.undoReplay39.test.ts`, `ActionLog.tsx`, `ActionLog.test.tsx`, `EventBanner.test.tsx`) individually returns zero errors. Out of scope per the executor's Scope Boundary rule — not fixed here.
- One `pnpm --filter @counter-attack/server test` run reported "Worker exited unexpectedly" (Vitest/tinypool infra flake) causing 1 of 53 test files to not execute; an immediate re-run completed all 53 files with 1335/1335 tests passing. Not a code issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 39-UAT gap 7 is closed: tackle-from-behind fouls on 1 or 2, distinctly logged, parity- and direction-correct
- No blockers for subsequent Phase 39 gap-closure plans
- The pre-existing whole-workspace `pnpm lint` file-count-cap issue remains open (documented, not introduced or worsened by this plan) — a future cleanup plan should raise `maximumDefaultProjectFileMatchCount` or split the shared package's eslint project glob

---
*Phase: 39-fouls-cards-injuries-penalty-kicks*
*Completed: 2026-08-15*

## Self-Check: PASSED

All created/modified files verified present (`fouls.ts`, `types.ts`, `gameEngine.ts`, `ActionLog.tsx`, this SUMMARY.md). All 3 commits (`9d46e09`, `e58fc80`, `4f8b7f5`) verified present in `git log`.
