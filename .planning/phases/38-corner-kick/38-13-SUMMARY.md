---
phase: 38-corner-kick
plan: 13
subsystem: game-engine
tags: [corner-kick, interception, pass-validation, gap-closure, rulebook-correction]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: the corner-kick engine/handler/UI surface built in plans 38-01..38-09, including the CORNER_KICK_TEARDOWN literal, the isCornerKick interception bypass this plan narrows, and the Low/High Pass choice panel
provides:
  - 'Assumption A2 corrected: a Low Pass corner is interceptable (auto-intercept and roll-intercept); a High Pass corner remains non-interceptable and routes into HEADER'
  - 'CORNER_KICK_TEARDOWN spread into both newly-reachable interception return paths, closing the state-integrity leak Task 1 would otherwise open'
  - 'Low Pass button tooltip corrected to describe the interception rule'
affects:
  [38-corner-kick verification, any future plan touching applyRoll's PASS case interception loop]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
    - packages/server/src/__tests__/gameHandlers.cornerKick.test.ts
    - packages/client/src/components/CornerKickSetupPanel.tsx

key-decisions:
  - "isCornerKick renamed to isCornerKickHighDelivery, gated on newLastActionType === 'HIGH_PASS' (not state.lastActionType), so the bypass agrees with deliveredPassType used elsewhere in the same applyRoll PASS-case block"
  - "No change to passValidator.ts or the STANDARD passType mapping: a corner Low pass already maps to 'STANDARD', which already populates autoIntercepts/rollIntercepts; verified by reading, not by trial-and-error"
  - "No change to gameHandlers.ts's High-corner unlimited-distance override or preGeneratedInterceptionDice seeding: both were already unconditional on passResult.rollIntercepts.length > 0, already covering a corner Low pass"
  - "No change to useGameStore.ts or HexGrid.tsx: selectPassType's existing STANDARD_PASS branch already computes interceptionRiskHexes via the travel-path ZoI scan, so the orange interception-risk tint already renders for a Low corner"

patterns-established: []

requirements-completed: [CORNER-04]

# Metrics
duration: ~20min
completed: 2026-08-08
---

# Phase 38 Plan 13: Corner Low Pass Interceptability Correction Summary

**Narrowed the corner-kick interception bypass in `applyRoll`'s PASS case to High Pass only, closing rulebook Assumption A2's partial-correction gap so a Low Pass corner now runs the same auto-intercept/roll-intercept loop as an ordinary Standard Pass.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Corrected Assumption A2 at its source-comment site in `gameEngine.ts`: a Low Pass corner is a grounded pass a defender can step in front of (interceptable, mirroring an ordinary Standard Pass); a High Pass corner flies into the box (non-interceptable, unchanged, still routes into `HEADER`).
- Renamed the flag from `isCornerKick` to `isCornerKickHighDelivery`, keyed off `newLastActionType === 'HIGH_PASS'` (the resolved delivery pass type) rather than the merely-persistent `cornerKickTeam` field, so a Low corner (`STANDARD_PASS` delivery) now falls through into the same auto-intercept/roll-intercept loop every other Standard Pass uses.
- Added `...CORNER_KICK_TEARDOWN` to both interception return paths inside the loop (the `autoIntercepts` case-1 return and the `rollIntercepts` case-3 intercepted return) — these paths were unreachable for a corner before this plan, so they never needed the teardown spread; now that a corner can end there, an intercepted corner correctly clears every `cornerKick*` field instead of leaking `cornerKickTeam` into the next possession and wrongly accuracy-gating the next ordinary `STANDARD_PASS`.
- Corrected the Low Pass button's tooltip in `CornerKickSetupPanel.tsx` to state the pass can be intercepted, matching the corrected rule.

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Narrow the interception bypass to High Pass only; tear down corner state on both interception returns** - `e2247ef` (fix) — committed together because both tasks touch the same `gameEngine.ts` interception-loop block and the same test file's overlapping describe blocks; splitting them into separate commits would have left an intermediate commit with a real state-integrity gap (Task 1's widened interceptability without Task 2's teardown).
2. **Task 3: Correct the Low Pass button copy** - `19ca03b` (fix)

**Plan metadata:** (this commit, appended after SUMMARY.md is written)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - `isCornerKickHighDelivery` bypass (High-only), corrected `Assumption A2` comment, `CORNER_KICK_TEARDOWN` added to both interception returns
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` - Replaced the old (incorrectly-passing-for-the-wrong-reason — its far-off target hit `RANGE_EXCEEDED`, not the bypass) "Low corner skips the interception loop" test with 4 new interception-behaviour tests within STANDARD's 11-hex range, plus 3 new teardown-audit tests (auto-intercept, roll-intercept, next-pass-not-gated)
- `packages/server/src/__tests__/gameHandlers.cornerKick.test.ts` - New handler-level test proving `preGeneratedInterceptionDice` is seeded for a Low corner, observed via a `STEAL_ATTEMPT` event with a non-zero `defenderDie`
- `packages/client/src/components/CornerKickSetupPanel.tsx` - Low Pass button `title` corrected

## Decisions Made

- Built new interception-test fixtures at a close, in-STANDARD-range target ({q:4,r:3}/{q:7,r:4} from the taker's corner-hex position {q:0,r:1}) rather than reusing the pre-existing far-off `homePiece.position` target, because the old target's distance-20 hex exceeded STANDARD's 11-hex cap — `validatePass` returned `RANGE_EXCEEDED` there regardless of the bypass, so the old test never actually exercised interception behaviour even before this plan.
- Guaranteed the ZoI roll-intercept fixtures' outcome deterministically (die=6 for success, die=3 for the tackling=1 defender's guaranteed fail) rather than relying on threshold-adjacent randomness, keeping the new engine tests non-flaky.
- For the handler-level dice-seeding test, overrode the corner taker's `highPass` attribute to 10 so the corner's own 8+ accuracy check always passes regardless of the real (unmocked) accuracy die — isolating the test's assertion to the interception-dice-seeding plumbing without needing to mock `rollDice()` file-wide (which would have risked affecting the file's other, unrelated real-dice-dependent tests).

## Deviations from Plan

**1. [Rule 1 - Bug] Replaced a pre-existing test that was passing for the wrong reason**

- **Found during:** Task 1 (extending `gameEngine.cornerKick.test.ts` with interception-behaviour tests)
- **Issue:** The existing test `'accurate Low corner skips the interception loop: no STEAL_ATTEMPT event even with a defender standing exactly on the target hex'` used `homePiece.position` (distance 20 from the corner taker) as the pass target. `validatePass` rejects any STANDARD pass beyond 11 hexes with `RANGE_EXCEEDED`, so `autoIntercepts`/`rollIntercepts` were always empty for that fixture regardless of whether the old `isCornerKick` bypass fired — the test's assertion (no `STEAL_ATTEMPT`) was true for the wrong reason and would have continued passing under the corrected (interceptable) behaviour without ever exercising it.
- **Fix:** Replaced it with fixtures inside STANDARD's 11-hex range that genuinely exercise `validatePass`'s auto-intercept and roll-intercept population, matching the plan's required new test names.
- **Files modified:** `packages/server/src/__tests__/gameEngine.cornerKick.test.ts`
- **Verification:** All 130 tests in the file pass; the new auto-intercept test fails if `isCornerKickHighDelivery`'s guard were reverted to the old unconditional `isCornerKick` (manually confirmed by reasoning through the removed branch, not by reverting and re-running).
- **Committed in:** `e2247ef` (Task 1+2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary to genuinely close the gap the plan targets — the replaced test would have silently continued passing without the interception loop being reached, defeating the purpose of Task 1's coverage. No scope creep.

## Issues Encountered

- The worktree had no `node_modules` installed and `packages/shared`'s `dist/` output was missing, causing `vite:import-analysis` resolution failures on first test run. Resolved with `pnpm install` followed by `pnpm --filter @counter-attack/shared build` before running any test suite.
- One full-server-suite run (`pnpm --filter @counter-attack/server test`) reported 1 error alongside 994 passing tests; two immediate re-runs both passed cleanly with the identical 994/996 count and no error, indicating a transient port-binding flake in the Socket.io integration tests (this suite spins up real HTTP servers) rather than a regression from this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CORNER-04 is now fully satisfied: Low Pass corners are interceptable via both auto-intercept and roll-intercept, High Pass corners remain non-interceptable, and no corner-resolving return path (including the two newly-reachable interception returns) can leak `cornerKick*` state into the next possession.
- Full server suite (994 tests, 1 skipped, 1 todo) and full client suite (743 tests) pass; client typecheck clean.
- No blockers for the remaining gap-closure plans in this wave.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_
