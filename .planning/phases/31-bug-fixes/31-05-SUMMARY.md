---
phase: 31-bug-fixes
plan: 05
subsystem: replay
tags:
  [
    replay-reconstruction,
    gameHandlers,
    ActionEvent,
    buildReplayFrames,
    gk-out-of-range,
    gap-closure,
  ]

# Dependency graph
requires:
  - phase: 31-bug-fixes (plan 01)
    provides: 'piecesAfter field on the GOAL ActionEvent variant (optional), buildReplayFrames applying it when present'
provides:
  - 'All 3 gameHandlers.ts GK-out-of-range auto-GOAL construction sites (SNAPSHOT_DEFLECT, declared-shot, header-at-goal) populate piecesAfter, closing the remaining 3-of-5 BUG-30 gap left open by Plan 31-01'
  - 'Regression coverage in shotGkRange.test.ts driving each branch through the real socket handler and asserting buildReplayFrames reconstructs all pieces at the kickoff formation'
affects: [replay-review, future-bug-fix-passes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resetPieces-hoist-then-attach: compute buildKickOffPieces(...) once per GOAL construction site, feed it to both state.pieces and the GOAL event's piecesAfter — now applied consistently across all 5 real GOAL-construction sites in the codebase (2 in gameEngine.ts from Plan 31-01, 3 in gameHandlers.ts from this plan)"

key-files:
  created: []
  modified:
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/shotGkRange.test.ts

key-decisions:
  - "Replaced the plan-specified independent buildKickOffPieces('away', ...) expected-value computation in the test with a direct reference to finalRoomState.pieces (the already-correct server state). buildKickOffPieces is defined in gameEngine.ts, not @counter-attack/shared as the plan assumed, and independently recomputing it produced a flaky assertion (RED/GREEN outcome depended on the random room-creation coin flip that sets kickOffTeam, which seeds buildReplayFrames' initial formation). Using finalRoomState.pieces directly removes both issues."
  - "Pinned kickOffTeam: 'home' explicitly in each test's state override (in addition to attackingTeam) so the RED failure is deterministic across repeated runs, independent of the room-creation coin flip that buildInitialGameState uses to assign kickOffTeam."

requirements-completed: [BUG-30]

# Metrics
duration: ~15min
completed: 2026-07-22
---

# Phase 31 Plan 05: GK-Out-of-Range Replay Reconstruction Gap Closure (BUG-30) Summary

**Populated `piecesAfter` at all 3 remaining `gameHandlers.ts` GK-out-of-range auto-GOAL construction sites (SNAPSHOT_DEFLECT, declared-shot, header-at-goal), closing the 3-of-5 BUG-30 gap left open by Plan 31-01, with regression coverage driving each branch through the real socket handler.**

## Performance

- **Duration:** ~15 min (2 commits, 17:27–17:29, plus ~4 min worktree `pnpm install`)
- **Started:** 2026-07-22T17:17:16-05:00 (plan read)
- **Completed:** 2026-07-22T17:29:23-05:00
- **Tasks:** 2
- **Files modified:** 2 (`gameHandlers.ts`, `shotGkRange.test.ts`)

## Accomplishments

- BUG-30 fully closed: all 5 real GOAL-construction code paths (2 in `gameEngine.ts` from Plan 31-01, 3 in `gameHandlers.ts` from this plan) now populate `piecesAfter`, so replaying any scored goal reconstructs every player at the new kickoff formation.
- Each of the 3 `gameHandlers.ts` sites computes `resetPieces` exactly once and feeds it to both `state.pieces` and the GOAL event's `piecesAfter` — no divergence, no double `buildKickOffPieces` call.
- Added 3 new regression assertions in `shotGkRange.test.ts` driving the real socket handler (`GAME_SHOT`, `SNAPSHOT_DEFLECT` end-turn, `GAME_HEADER_TARGET`) through each GK-out-of-range branch and asserting `buildReplayFrames` reconstructs all pieces at the kickoff formation.

## Task Commits

1. **Task 1: Write failing replay-reconstruction assertions for all 3 GK-out-of-range auto-goal paths (RED)** - `dfef2eb` (test) — RED confirmed across 3 repeated runs (all 3 assertions failed deterministically against unmodified source).
2. **Task 2: Populate piecesAfter at all 3 gameHandlers.ts GK-out-of-range GOAL sites via a hoisted resetPieces (GREEN, D-01)** - `8c8b800` (fix) — GREEN confirmed across 3 repeated runs; full server suite (623 passed, 1 skipped, 1 todo) remains green.

**Plan metadata:** (this commit, docs) — created after this SUMMARY.

## Files Created/Modified

- `packages/server/src/gameHandlers.ts` — At each of the 3 GK-out-of-range auto-GOAL sites (SNAPSHOT_DEFLECT ~line 1013, declared-shot ~line 1657, header-at-goal ~line 2438): hoisted `const resetPieces = buildKickOffPieces(newKickOffTeam, <baseState>.selectedTeams, <baseState>.selectedFormation)` above the `room.gameState = {...}` assignment, replaced the inline `pieces: buildKickOffPieces(...)` call with `pieces: resetPieces`, and added `piecesAfter: resetPieces` to the GOAL event literal. No other fields, the surrounding score/event logic, or the `broadcastState`/`return` tail were touched.
- `packages/server/src/__tests__/shotGkRange.test.ts` — Added `buildReplayFrames` import from `../gameEngine.js` (see Decisions Made re: `buildKickOffPieces` import). Added a replay-reconstruction assertion block to each of the 3 existing GK-out-of-range auto-goal `it` blocks (regular shot, snapshot, header), plus a `kickOffTeam: 'home'` pin in each scenario's state override to make the assertion deterministic.

## Decisions Made

- **`buildKickOffPieces` is defined in `gameEngine.ts`, not `@counter-attack/shared`.** The plan's `<action>` step for Task 1 specified importing it from `@counter-attack/shared`; a grep confirmed it is only exported from `packages/server/src/gameEngine.ts` (and re-exported nowhere else). Corrected the import to `../gameEngine.js`, mirroring the exact pattern already used by `replay.integration.test.ts`. This is a Rule 3 (blocking) auto-fix — the plan's stated import path does not exist.
- **Replaced independently-recomputed `expectedPieces` with a direct reference to `finalRoomState.pieces`.** The plan's action step directed computing `expectedPieces = buildKickOffPieces('away', finalRoomState.selectedTeams, finalRoomState.selectedFormation)`. During RED verification this produced a flaky, non-deterministic result: `buildReplayFrames` seeds its reconstruction from `finalState.kickOffTeam` (set by a random coin flip at room creation, unaffected by this file's `rollDice` mock), so whether the pre-fix reconstructed formation happened to coincidentally match the independently-recomputed `'away'` formation depended on that random coin flip — observed directly: repeated runs alternated which of the 3 tests failed. Switched the assertion to use `finalRoomState.pieces` (the true, already-verified-correct post-goal state written by the server, which the plan's own `<action>` step for Task 2 confirms is fed by the identical `resetPieces` value) as the expected formation. This removes the dependency on reproducing team-selection logic in the test and is immune to the coin flip. (Rule 1 — bug in the plan's specified test design, not a source-code bug.)
- **Pinned `kickOffTeam: 'home'` explicitly in each test's state override.** Even after switching to `finalRoomState.pieces` as the expected value, the RED failure signal itself remained coin-flip-dependent (whether the _unfixed_ code's stale reconstruction differs from the correct formation). Pinning `kickOffTeam` to `'home'` (the opposite of the always-`'away'` new-kickoff-team in these 3 scenarios) guarantees the pre-fix seed formation always differs from the expected one, making RED deterministic. Verified via 3 repeated RED runs (all 3 failed each time) and 3 repeated GREEN runs (all 6 tests passed each time) after the fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected `buildKickOffPieces` import path in the test file**

- **Found during:** Task 1 (writing the RED assertions)
- **Issue:** The plan's Task 1 `<action>` step specified `import { buildKickOffPieces } from '@counter-attack/shared'`, but `buildKickOffPieces` is defined and exported only from `packages/server/src/gameEngine.ts`. Following the plan literally would have produced a build error (missing export).
- **Fix:** Imported `buildReplayFrames` (and initially `buildKickOffPieces`) from `../gameEngine.js`, matching the exact import used by the existing `replay.integration.test.ts`.
- **Files modified:** `packages/server/src/__tests__/shotGkRange.test.ts`
- **Verification:** Test file compiles and runs; no import errors.
- **Committed in:** `dfef2eb` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed flaky RED/GREEN assertion caused by coin-flip-dependent `expectedPieces` computation**

- **Found during:** Task 1, first RED verification run (results were inconsistent across repeated runs — different subsets of the 3 new assertions failed each time)
- **Issue:** The plan's action step for computing `expectedPieces` via an independent `buildKickOffPieces('away', ...)` call did not account for `buildReplayFrames` seeding its reconstruction from the room's randomly-assigned `kickOffTeam` (coin flip at room creation, not mocked by this file's `rollDice` override). This made both the RED failure and (less critically) the correctness of the comparison depend on an untested, non-deterministic factor.
- **Fix:** (a) Changed `expectedPieces` to reference `finalRoomState.pieces` directly (the server's own already-correct post-goal state) instead of independently recomputing it. (b) Pinned `kickOffTeam: 'home'` in each test's state override so the pre-fix reconstruction is guaranteed to differ from the expected post-goal formation, making the RED failure deterministic.
- **Files modified:** `packages/server/src/__tests__/shotGkRange.test.ts`
- **Verification:** RED confirmed failing deterministically across 3 repeated runs (all 3 new assertions failed each time); GREEN confirmed passing deterministically across 3 repeated runs after the Task 2 fix (all 6 tests passed each time).
- **Committed in:** `dfef2eb` (Task 1 commit, RED); verified GREEN in `8c8b800` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/Rule 3 import-path correction, 1 bug/Rule 1 test-determinism fix)
**Impact on plan:** Both fixes were necessary to make the plan's own regression coverage reliable and buildable. No scope creep — `gameHandlers.ts`'s 3 GOAL sites were modified exactly as specified (resetPieces hoist-and-attach), with zero changes to surrounding logic.

## Issues Encountered

- **Worktree had no `node_modules`.** Ran `pnpm install` (clean, independent install; not a Windows junction workaround) before running any tests, per this phase's established pattern from Plan 31-01.
- **Flaky RED assertion due to room-creation coin flip** — see Deviations above for full detail and resolution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-30 is now fully closed: all 5 real GOAL-construction code paths (`gameEngine.ts` x2 from Plan 31-01, `gameHandlers.ts` x3 from this plan) populate `piecesAfter`, and `buildReplayFrames` applies it universally.
- `31-VERIFICATION.md`'s gap #1 ("3 of 5 real GOAL-construction code paths still omit piecesAfter") is closed by this plan; REQUIREMENTS.md's BUG-30 `[x]` Complete marker is now accurate.
- No blockers for future phases. The header-winner-eligibility gap (31-VERIFICATION.md gap #2, `applyStartMovement` clobbering `movedPieceIds`) is a separate, unrelated defect not in this plan's scope — tracked separately per the phase's gap-closure plan set.

## Self-Check: PASSED

- FOUND: packages/server/src/gameHandlers.ts
- FOUND: packages/server/src/**tests**/shotGkRange.test.ts
- FOUND: .planning/phases/31-bug-fixes/31-05-SUMMARY.md
- FOUND commit: dfef2eb (test)
- FOUND commit: 8c8b800 (fix)

---

_Phase: 31-bug-fixes_
_Completed: 2026-07-22_
