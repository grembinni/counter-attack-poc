---
phase: 36-bug-fixes
plan: 04
subsystem: game-engine
tags: [gameEngine, applyRoll, SHOT, LOOSE_BALL, gkEffectivePos, replay, vitest]

# Dependency graph
requires:
  - phase: 10
    provides: gkEffectivePos / gkDivePosition dive-adjusted GK position pattern already used by the SAVE branches
provides:
  - Shooter/GK duel-tie LOOSE_BALL branch now places the ball on the keeper's dive-adjusted hex (gkEffectivePos), not the shooter's hex
  - SHOT_ATTEMPT event's ballAfter records the same corrected hex so replay reconstruction matches live play
  - BUG-36 regression coverage: no-dive tie, 2-hex-dive tie, event/ballAfter consistency, end-to-end scatter origin, replay-frame consistency, and a GOAL-path guard
affects: [36-bug-fixes remaining plans, any future replay/loose-ball work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LOOSE_BALL tie branch mirrors the sibling SAVE branches' gkEffectivePos usage — single pattern for 'where does the ball go after a GK-involved shot outcome' across all SHOT sub-branches"

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.phase8.test.ts
    - packages/server/src/__tests__/gameEngine.test.ts

key-decisions:
  - 'Fixed exactly two field values (ballAfter.position and ball.position) in the LOOSE_BALL tie branch, per plan scope — computeShotPathDeflection, the LOOSE_BALL-phase scatter walk, and computeLooseBall were confirmed untouched'
  - "Updated a pre-existing test in gameEngine.test.ts that asserted the buggy behavior (ball.position unchanged at the shooter's hex) as correct — Rule 1 auto-fix, discovered during full-suite verification"

requirements-completed: [BUG-36]

# Metrics
duration: ~20min
completed: 2026-07-28
---

# Phase 36 Plan 04: Loose-Ball Path Origin on a Blocked Shot Summary

**Shooter/GK duel ties now drop the loose ball on the keeper's dive-adjusted hex (gkEffectivePos) instead of the shooter's hex, fixing BUG-36/D-14 with two corrected field assignments plus end-to-end regression coverage proving the scatter walk and replay reconstruction both originate from the corrected hex.**

## Performance

- **Duration:** ~20 min (includes a one-time `pnpm install` + `pnpm --filter @counter-attack/shared build` to restore the worktree's missing node_modules/dist)
- **Completed:** 2026-07-28T12:47:50Z
- **Tasks:** 2 (both plan tasks) + 1 auto-fixed pre-existing test discovered during verification
- **Files modified:** 3

## Accomplishments

- Corrected the `outcome === 'LOOSE_BALL'` tie branch of `applyRoll`'s SHOT case in `gameEngine.ts`: both the `shotAttempt` event's `ballAfter.position` and the returned state's `ball.position` now read `gkEffectivePos` instead of `state.ball.position`, matching the already-correct sibling SAVE branches
- Added a BUG-36 describe block to `gameEngine.phase8.test.ts` covering: no-dive tie lands on the GK hex, 2-hex-dive tie lands specifically on the dive-adjusted hex (distinguishing `gkEffectivePos` from both `gk.position` and the shooter's hex), SHOT_ATTEMPT `ballAfter` matches the returned ball in both scenarios, the subsequent scatter walk's `LOOSE_BALL_LAND` event `from` equals the GK hex, `buildReplayFrames` reconstructs the SHOT_ATTEMPT frame with the ball at the GK hex, and a GOAL-path guard confirming a tie-breaking 3-hex dive is unaffected
- Discovered and fixed one pre-existing test in `gameEngine.test.ts` that encoded the pre-fix (buggy) behavior as its expected assertion; updated it to assert the corrected behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Place the loose ball on the goalkeeper's hex in the duel-tie branch** - `01662d2` (fix)
2. **Task 2: Prove the scatter and the replay frame both originate from the corrected hex** - `4669d47` (test)
3. **Rule 1 auto-fix: update pre-existing SHOT-tie test to expect the BUG-36 correction** - `d5b9194` (fix)

_Note: no plan-metadata commit — worktree mode; STATE.md/ROADMAP.md are updated centrally by the orchestrator after merge._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - LOOSE_BALL tie branch now assigns `gkEffectivePos` to both `ballAfter.position` and `ball.position` (2 field changes, 2 explanatory comments)
- `packages/server/src/__tests__/gameEngine.phase8.test.ts` - New `applyRoll SHOT duel tie — loose-ball origin (BUG-36, D-14)` describe block: 6 tests covering no-dive, 2-hex-dive, event consistency, end-to-end scatter origin, replay consistency, and a GOAL guard
- `packages/server/src/__tests__/gameEngine.test.ts` - Updated the pre-existing SHOT-tie test's title and assertions to expect the ball on the GK's hex instead of the shooter's hex

## Decisions Made

- Kept the fix minimal and localized to exactly the two field values the plan specified — did not touch `computeShotPathDeflection` (~line 3615), the LOOSE_BALL-phase scatter walk (~lines 2757-2790), or `packages/shared/src/scoreUtils.ts`'s `computeLooseBall`, all of which RESEARCH.md confirmed were already correct
- Verified via cube-coordinate hand-calculation that direction=4 (W), distance=2 from the dive-adjusted hex `{q:34,r:13}` lands on `{q:32,r:14}` with no intermediate trajectory occupant, so the Task 2 scatter-origin assertion exercises the real clamp/trajectory path rather than a clamped fallback
- Updated the one pre-existing test in `gameEngine.test.ts` that asserted the old (buggy) behavior as correct, since it exercises the exact code path this plan corrects

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test in `gameEngine.test.ts` asserted the buggy behavior as expected**

- **Found during:** Full server-suite verification run (`pnpm --filter @counter-attack/server test`) after Task 2
- **Issue:** `SHOT tie (shooterScore === gkScore) → LOOSE_BALL (D-13), ball.carrierId null, ball.position unchanged` asserted `result.state.ball.position` equals `shotState.ball.position` (the shooter's incident hex) — this was the exact bug BUG-36 fixes, encoded as the test's expected value. With the fix applied, this test failed (correctly) because the ball now lands on the GK's hex.
- **Fix:** Updated the test title and assertions to expect `result.state.ball.position` to equal `awayGK.position` (no dive in this fixture, so `gkEffectivePos === gk.position`) and explicitly assert it no longer equals the shooter's hex.
- **Files modified:** `packages/server/src/__tests__/gameEngine.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test -- gameEngine.test` green (62/62); full server suite green (633 passed, 1 skipped, 1 todo — same skip/todo counts as before this plan)
- **Committed in:** `d5b9194`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary correctness fix directly caused by this plan's behavior change; no scope creep — the plan's designated files (`gameEngine.ts`, `gameEngine.phase8.test.ts`) are unmodified beyond what the plan specified, and this additional file falls within Rule 1's "directly caused by the current task's changes" scope since it tests the identical code path.

## Issues Encountered

- The worktree lacked `node_modules` and the `packages/shared` build output (`dist/`), causing an initial `vitest: command not found` and then a `Failed to resolve entry for package "@counter-attack/shared"` error. Resolved via `pnpm install --frozen-lockfile` (installs from the existing lockfile/global content-addressable store — does not touch the main repo checkout) followed by `pnpm --filter @counter-attack/shared build`. No junction workaround was used (per prior Phase 28 junction-deletion incident recorded in project memory).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-36/D-14 closed: a shooter/GK duel tie now leaves the ball on the goalkeeper's dive-adjusted hex, the scatter walk demonstrably originates from that hex, and replay reconstruction matches live play.
- Verification per plan's `<verification>` block confirmed: `gameEngine.phase8` suite green (81 tests), full server suite green (633 passed / 1 skipped / 1 todo across 33 files, no regressions), `packages/shared` `scoreUtils` suite green and untouched (86 tests).
- Diff review gate: `git diff --stat` against the plan's designated files shows `gameEngine.ts` and `gameEngine.phase8.test.ts` changed as specified, plus one additional pre-existing test file (`gameEngine.test.ts`) updated under Rule 1 — documented above, not a scope violation.
- No blockers for subsequent 36-bug-fixes plans.

---

_Phase: 36-bug-fixes_
_Completed: 2026-07-28_
