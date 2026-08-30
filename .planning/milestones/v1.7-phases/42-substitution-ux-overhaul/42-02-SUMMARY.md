---
phase: 42-substitution-ux-overhaul
plan: 02
subsystem: game-server
tags: [red-card, bug-fix, defense-in-depth, occupancy, gameHandlers]

requires: ['isActivePiece(piece) exported from packages/shared/src/stoppagePhases.ts (42-01)']
provides:
  - 'Red-card-aware SNAPSHOT_DEFLECT and SHOT-phase deflection defender-set builders in gameHandlers.ts'
  - 'RED_CARDED server-side rejection in validateResponseMoveStep (5 response-move phases)'
  - 'Red-card-aware occupancy predicates at all 6 pitch-occupancy sites in gameHandlers.ts'
  - 'packages/server/src/__tests__/gameHandlers.redCardExclusion.test.ts BUG-38 regression suite'
affects: [42-03, 42-04, 42-05, 42-06, 42-07, 42-08]

tech-stack:
  added: []
  patterns:
    - "gameHandlers.ts imports isActivePiece from @counter-attack/shared and applies it as a
      leading/trailing conjunct at every eligibility/defender-set/occupancy list construction
      site, never as a replacement of existing conjuncts (role !== 'GK', id !== pieceId, team
      filters all preserved verbatim)."
    - "validateResponseMoveStep's RED_CARDED guard sits immediately after the ownership check
      and before carrier-exclusion/lock/pace/distance/boundary/occupancy — an opponent's piece
      id always leaks WRONG_TEAM first, never RED_CARDED."

key-files:
  created:
    - packages/server/src/__tests__/gameHandlers.redCardExclusion.test.ts
  modified:
    - packages/server/src/gameHandlers.ts

key-decisions:
  - "All 6 pitch-occupancy predicates identified by the plan (validateResponseMoveStep
    destination check, FTP occupant lookup at the former ~line 1082, GK_KICK receiver lookup
    at the former ~line 1162, 2 destination-occupancy guards with id!==pieceId exclusion at the
    former ~lines 2512/2687, and the kick-off-hex kicker lookup at the former ~line 2591) were
    confirmed as genuine 'is a piece physically standing on this hex' tests (not roster/identity
    lookups) and all received the isActivePiece leading conjunct — no site was skipped."
  - "Task 1 and Task 2 touched the same file (gameHandlers.ts) but were committed as two
    separate atomic commits by splitting the working-tree diff into two patches (git apply
    --cached) rather than one combined commit, preserving the plan's one-commit-per-task
    granularity."

requirements-completed: [BUG-38]

duration: ~55min
completed: 2026-08-22
---

# Phase 42 Plan 02: BUG-38 Red-Card Exclusion in gameHandlers Summary

**Closed BUG-38's two confirmed live defect sites in `gameHandlers.ts` (SNAPSHOT_DEFLECT and SHOT-phase deflection defender-set builders), added a `validateResponseMoveStep` RED_CARDED guard covering all five response-move phases, narrowed all 6 pitch-occupancy predicates in the file, and added a 10-test regression suite.**

## Performance

- **Duration:** ~55 min (includes a ~5 min fresh-worktree `pnpm install --frozen-lockfile` + `packages/shared` build, not attributable to plan work)
- **Tasks:** 3 (as planned)
- **Files modified:** 2 (1 planned + regression test file, both declared in `files_modified`)

## Accomplishments

- `isActivePiece` added to the existing `@counter-attack/shared` named-import in `gameHandlers.ts` — no second import statement created.
- **Site 1 (SNAPSHOT_DEFLECT defender-set builder, `gameHandlers.ts:~1303`):** filter changed from `(p) => p.teamId === defendingTeam && p.role !== 'GK'` to `(p) => p.teamId === defendingTeam && p.role !== 'GK' && isActivePiece(p)`, with a BUG-38/D-08 comment recording that a sent-off piece keeps a live on-pitch `position` by design and must be excluded by flag.
- **Site 2 (SHOT-phase defender-set builder, `gameHandlers.ts:~2295`):** identical fix and comment for the parallel non-snapshot shot-deflection path.
- **`validateResponseMoveStep` RED_CARDED guard (`gameHandlers.ts:~302`):** `if (!isActivePiece(piece)) return fail('RED_CARDED');` inserted immediately after the ownership check (`piece.teamId !== config.actingTeam` → `WRONG_TEAM`) and before the carrier-exclusion check — covers HIGH_PASS_MOVE, GK_KICK_MOVE, FIRST_TIME_PASS_MOVE, SNAPSHOT_DEFLECT, and GOAL_KICK_MOVE (all five phases share this one guard function). Ownership is checked first by construction, so an opponent's piece id always yields `WRONG_TEAM`, never `RED_CARDED`.
- **All 6 pitch-occupancy predicates** in `gameHandlers.ts` now carry `isActivePiece(p)` as an added conjunct, every pre-existing conjunct preserved verbatim:
  1. `validateResponseMoveStep`'s destination-occupancy check (`~line 335`)
  2. FTP (FIRST_TIME_PASS_MOVE) occupant-at-targetHex lookup (`~line 1094`) — determines who receives the ball on delivery
  3. GK_KICK receiver-at-targetHex lookup (`~line 1174`) — same delivery-occupant semantics
  4. Destination-occupancy guard with `id !== pieceId` exclusion (KICK_OFF_SETUP repositioning, `~line 2532`)
  5. Kick-off-hex kicker lookup (`~line 2610`) — assigns ball possession to whichever attacking piece stands on the kick-off hex
  6. Destination-occupancy guard with `id !== pieceId` exclusion (FREE_KICK_SETUP repositioning, `~line 2708`)
  - All 6 were confirmed as genuine "is a piece physically standing on this hex" pitch-occupancy tests during implementation — none were roster/identity lookups, so no site was skipped or left undocumented.
- New file `packages/server/src/__tests__/gameHandlers.redCardExclusion.test.ts`: 10 tests covering all 6 numbered scenarios from the plan (SHOT-phase exclusion + positive control + onPitch-only case, SNAPSHOT_DEFLECT exclusion + positive control, validateResponseMoveStep rejection for both SNAPSHOT_DEFLECT and HIGH_PASS_MOVE, ownership precedence, and occupancy accept/reject parity).
- Full `packages/server` suite: **1454 tests green** (up from 1444 baseline; 1 skipped, 1 todo unchanged) — a Windows vitest worker-crash flake was observed on 2 of 4 consecutive full-suite runs (matches known project flake, per `.planning/STATE.md`'s "vitest worker-crash flake (rerun with --pool=forks)" note); all 4 runs that completed without a worker crash were 100% green, confirming the flake is unrelated to this plan's changes.
- `pnpm -r typecheck` clean across shared/server/client. `npx eslint packages/server/src/gameHandlers.ts packages/server/src/__tests__/gameHandlers.redCardExclusion.test.ts` clean.
- Grep audit `grep -n "redCarded" packages/server/src/gameHandlers.ts | grep -v "^[0-9]*: *[*/]"` returns zero matches — no residual hand-written inline `redCarded` flag check remains in this file; every check now routes through `isActivePiece`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Exclude red-carded defenders from both deflection defender-set builders** - `ea21ffd` (fix)
2. **Task 2: Add the red-card guard to validateResponseMoveStep and the file's occupancy predicates** - `4f06728` (fix)
3. **Task 3: BUG-38 regression tests for gameHandlers** - `8e48a88` (test)

**Plan metadata:** SUMMARY commit handled per worktree isolation (this file is committed separately by the executor per the worktree protocol).

## Files Created/Modified

- `packages/server/src/gameHandlers.ts` — 2 deflection defender-set filters narrowed, 1 new `RED_CARDED` guard added to `validateResponseMoveStep`, 6 occupancy predicates narrowed, 1 new named import (`isActivePiece`)
- `packages/server/src/__tests__/gameHandlers.redCardExclusion.test.ts` (new) — 10-test BUG-38 regression suite

## Revert-Check Verification (acceptance criteria)

Per the plan's acceptance criteria, the SNAPSHOT_DEFLECT filter (`gameHandlers.ts:~1303`) was temporarily reverted to its pre-fix form (`(p) => p.teamId === defendingTeam && p.role !== 'GK'`, dropping `&& isActivePiece(p)`) and the new test file was re-run:

- **Observed failing test:** `BUG-38 — red-carded pieces excluded from gameHandlers eligibility > SNAPSHOT_DEFLECT: a red-carded (+ onPitch:false) defender directly on the shot path is excluded from the deflection defender-set — no DEFLECT_ATTEMPT for that piece`
- **Failure:** `expected [ { type: 'DEFLECT_ATTEMPT', …(6) } ] to have a length of +0 but got 1` — the reverted filter let the red-carded defender back into the deflection defender-set, producing a `DEFLECT_ATTEMPT` event the test asserts must not exist.
- The fix was then restored (`git status --short` confirmed a clean diff on `gameHandlers.ts` afterward) and the full regression file was re-run green (10/10) before proceeding to the final commit.

This confirms the regression suite genuinely fails if the fix is reverted, per the plan's acceptance criteria.

## Decisions Made

- **All 6 occupancy predicates classified as genuine occupancy tests, none skipped.** The plan required documenting any site that turned out to be a roster/identity lookup rather than a pitch-occupancy test. During implementation every one of the 6 sites (validateResponseMoveStep destination check, FTP occupant lookup, GK_KICK receiver lookup, 2 KICK_OFF_SETUP/FREE_KICK_SETUP destination-occupancy guards, and the kick-off-hex kicker lookup) was confirmed to answer "is a piece physically standing on this hex" — no skip was needed.
- **Task 1/Task 2 commit-per-task granularity preserved despite same-file edits.** Both tasks modified `gameHandlers.ts`. Rather than combining them into one commit, the working-tree diff was split into two patches using `git diff` → `git apply --cached` so each task's exact hunks landed in its own commit, matching the plan's declared one-commit-per-task structure.
- **Test fixture reuses proven-working coordinates.** The SHOT-phase and SNAPSHOT_DEFLECT test fixtures reuse the exact `{q:33,r:13}` (carrier) / `{q:36,r:13}` (goal) / `{q:34,r:13}` (on-path defender) coordinate triple already proven to produce a genuine on-path defender in `gameHandlers.phase10.test.ts`, rather than deriving new coordinates from scratch — reduces risk of a coordinate-geometry bug in the new test file itself.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on the first implementation pass (no fix-attempt cycles were needed).

## Issues Encountered

- **Fresh worktree had no `node_modules`.** Ran `pnpm install --frozen-lockfile` (background, completed successfully) followed by `pnpm --filter @counter-attack/shared build` to produce `packages/shared/dist` (required for `isActivePiece` to resolve via the workspace package). Not a plan deviation — infrastructure setup only, matching the note already recorded in 42-01's summary for the same worktree.
- **Windows vitest worker-crash flake observed twice during full-suite verification** ("Worker exited unexpectedly" from tinypool), consistent with the known flake documented in `.planning/STATE.md`. Both times, an immediate rerun with the same `--pool=forks` flag passed 100% green (1444 then 1454 tests). Not related to this plan's code changes — no test in the new suite or the modified file was implicated in any failed run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Every eligibility/occupancy list construction in `gameHandlers.ts` now routes through the shared `isActivePiece` predicate from 42-01; no hand-written `redCarded`/`onPitch` inline check remains in this file (confirmed by grep audit).
- Downstream Phase 42 plans that touch client-side rendering (`HexGrid.tsx`'s existing render-skip) can rely on this server-side defense-in-depth being in place — a modified client attempting to move a red-carded piece through any of the five response-move phases now receives an explicit `RED_CARDED` rejection, not a silent state desync.
- No blockers. Full server suite green (1454 tests), monorepo typecheck clean, eslint clean.

## Self-Check: PASSED

- FOUND: `packages/server/src/__tests__/gameHandlers.redCardExclusion.test.ts`
- FOUND: `.planning/phases/42-substitution-ux-overhaul/42-02-SUMMARY.md`
- FOUND commit `ea21ffd` (Task 1)
- FOUND commit `4f06728` (Task 2)
- FOUND commit `8e48a88` (Task 3)
- FOUND commit `9e7af0c` (this SUMMARY)

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_
