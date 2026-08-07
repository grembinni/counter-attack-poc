---
phase: 38-corner-kick
plan: 02
subsystem: game-engine
tags: [typescript, game-engine, corner-kick, out-of-bounds, vitest]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 01)
    provides: CORNER_KICK_HEX fixed geometry, 5 new GamePhase values, 10 cornerKick* GameState fields, CORNER_KICK_RESTART LastActionType, CORNER_KICK_GK_PLACE/CORNER_KICK_TAKER_PLACED ActionEvent shapes
provides:
  - Real triggerOutOfBoundsRestart CORNER_KICK branch (replaces the Phase-37 dead-end) with team-inverted award and nearest-corner resolution
  - applyCornerKickGkPlace / applyCornerKickGkWindowEnd — attacking-first, uncapped-placement GK reposition pair
  - applyCornerKickTakerSelect — corner-taker designation and placement at the resolved fixed corner hex
  - gameEngine.cornerKick.test.ts (42 tests) covering all three functions plus throw-in/goal-kick regression checks
affects: [38-03, 38-04, 38-05, 38-06, 38-07, 38-08, 38-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Corner Kick trigger branch mirrors the GOAL_KICK branch's shape but inverts team award (owner is the DEFENDING team, corner goes to the opposite team) — documented inline as the load-bearing divergence from the GOAL_KICK precedent"
    - 'GK placement is uncapped (Assumption A1) — only isPitchHex + occupancy validated, no hexDistance guard — with an inline comment naming the exact one-line change needed if the rulebook turns out to cap it'
    - 'Corner-taker/GK-placement destination hexes are always re-resolved against the piece list with the moving/selecting piece excluded, so a piece can never block its own destination'

key-files:
  created: [packages/server/src/__tests__/gameEngine.cornerKick.test.ts]
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
    - packages/shared/src/types.ts

key-decisions:
  - "Fixed a Plan 38-01 gap: the OUT_OF_BOUNDS ActionEvent's `restart` field type was missing the 'CORNER_KICK' literal needed by this plan's trigger branch — extended the union in types.ts (Rule 3, blocking)"
  - "Updated the pre-existing gameEngine.outOfBounds.test.ts assertion for 'byline exit after a defending touch' from its Phase-37 clamp/DEFLECTION expectation to the new CORNER_KICK_GK_SETUP_ATTACKING award — the test's own comment explicitly anticipated this change ('when Corner Kick is implemented, this scenario should be moved to a Phase 38 test... not deleted here')"
  - "Acting team for both GK-placement and window-end is derived from phase + the persistent cornerKickTeam field, never read from activeTeam directly, per the plan's threat-model mitigation (T-38-04)"

patterns-established:
  - "Corner Kick's engine functions (trigger branch, GK placement pair, taker select) are laid out top-to-bottom in gameEngine.ts in chain order, mirroring the throw-in/goal-kick precedent, so the whole restart chain reads sequentially"

requirements-completed: [OOB-03, CORNER-01, CORNER-02]

# Metrics
duration: ~25min
completed: 2026-08-07
---

# Phase 38 Plan 02: Corner Kick Trigger, GK Reposition & Taker Select Summary

**Real `triggerOutOfBoundsRestart` CORNER_KICK branch plus the first two steps of the corner-kick chain — the turn-based attacking-then-defending goalkeeper reposition pair and corner-taker selection/placement at the occupancy-resolved fixed corner hex — all covered by 42 new unit tests.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-07T13:00Z (approx)
- **Completed:** 2026-08-07T13:12:34Z
- **Tasks:** 3 completed
- **Files modified:** 4 (1 new)

## Accomplishments

- `triggerOutOfBoundsRestart`'s `CORNER_KICK` dead-end (`if (restart === 'CORNER_KICK') return null;`) replaced with a real branch: team-inverted award (`cornerKickTeam = owner === 'home' ? 'away' : 'home'`), nearest-corner selection between `CORNER_KICK_HEX[owner].top`/`.bottom` via `hexDistance`, occupancy resolution via `resolveThrowInHex` against the full (not GK-excluded) piece list, and every `cornerKick*` field explicitly initialized to prevent stale-value leakage from a prior corner
- `applyCornerKickGkPlace`: uncapped on-pitch placement (documented as RESEARCH.md Assumption A1) with the full 5-reason guard chain (`WRONG_PHASE` → `PIECE_NOT_FOUND` → `NOT_GOALKEEPER` → `WRONG_TEAM` → `INVALID_TARGET`), acting team derived from `phase` + `cornerKickTeam` (never `activeTeam`)
- `applyCornerKickGkWindowEnd`: `CORNER_KICK_GK_SETUP_ATTACKING` → `CORNER_KICK_GK_SETUP_DEFENDING` (flips `activeTeam`) → `CORNER_KICK_TAKER_SELECT` (restores `activeTeam` to `cornerKickTeam`); confirming with zero placements is legal in both windows (D-06)
- `applyCornerKickTakerSelect`: any own piece (including the GK) is selectable; the corner hex is re-resolved excluding the taker itself so a GK repositioned onto the corner hex during CORNER-01 never blocks its own selection; ball position/carrierId/lastTouchedBy and the taker's piece position are set together in one return so they can never diverge; transitions to `CORNER_KICK_REPOSITION` at stage 0
- `gameEngine.cornerKick.test.ts` created with 42 tests (13 trigger-branch, 18 GK-placement-pair, 11 taker-select) plus explicit sideline/goal-kick regression assertions; full server suite: 841 tests passing (37 files, 1 skipped, 1 todo — both pre-existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the CORNER_KICK dead-end in triggerOutOfBoundsRestart (OOB-03)** - `250c7eb` (feat)
2. **Task 2: Turn-based goalkeeper reposition pair (CORNER-01, D-03/D-04)** - `ea4d82b` (feat)
3. **Task 3: Corner-taker selection and placement at the fixed hex (CORNER-02, D-01)** - `922a8fb` (feat)

_Note: no plan-metadata commit is created by a worktree-isolated executor — the orchestrator handles final metadata commits after merge._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - Added the `CORNER_KICK` branch to `triggerOutOfBoundsRestart`; added `applyCornerKickGkPlace`, `applyCornerKickGkWindowEnd`, `applyCornerKickTakerSelect` and their result types, positioned immediately after the trigger branch's containing function
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` - **New file**: full behavior coverage for all three Task functions plus throw-in/goal-kick regression checks
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` - Updated the "byline exit after a defending touch" test from its stale Phase-37 clamp/DEFLECTION expectation to the new CORNER_KICK award (the test's own prior comment anticipated this exact change)
- `packages/shared/src/types.ts` - Extended the `OUT_OF_BOUNDS` `ActionEvent`'s `restart` field from `'THROW_IN' | 'GOAL_KICK'` to include `'CORNER_KICK'` (Plan 38-01 gap, fixed as a blocking dependency for Task 1)

## Decisions Made

- Fixed the Plan 38-01 `restart` field type gap in `types.ts` rather than working around it — the alternative (omitting `restart: 'CORNER_KICK'` from the emitted event, or casting) would have silently broken the OOB event's discriminated-union contract that later plans and the client rely on
- Updated (rather than left broken) the pre-existing `gameEngine.outOfBounds.test.ts` assertion for the defending-touch byline scenario — its own comment from Phase 37 explicitly said "when Corner Kick is implemented, this scenario should be moved to a Phase 38 test asserting a CORNER_KICK award, not deleted here," so updating it in place is the anticipated outcome, not a scope violation
- `applyCornerKickGkPlace`/`applyCornerKickGkWindowEnd`/`applyCornerKickTakerSelect` all derive the acting/awarded team from the persistent `cornerKickTeam` field (set once at trigger time) rather than the mutable `activeTeam`, matching the plan's T-38-04 threat-model mitigation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended OUT_OF_BOUNDS ActionEvent's `restart` field to include `'CORNER_KICK'`**

- **Found during:** Task 1 (Replace the CORNER_KICK dead-end in triggerOutOfBoundsRestart)
- **Issue:** `packages/shared/src/types.ts`'s `OUT_OF_BOUNDS` `ActionEvent` variant typed `restart: 'THROW_IN' | 'GOAL_KICK'` — missing the `'CORNER_KICK'` literal this task's trigger branch is required to emit (per the plan's own `<behavior>` spec: "An `OUT_OF_BOUNDS` `ActionEvent` is appended with `restart: 'CORNER_KICK'`"). This is a gap in Plan 38-01's shared-contracts delivery, not something introduced by this plan. Without the fix, the trigger branch would fail to compile.
- **Fix:** Widened the union to `restart: 'THROW_IN' | 'GOAL_KICK' | 'CORNER_KICK'`, matching `OutOfBoundsRestart`'s existing type in `outOfBounds.ts`.
- **Files modified:** `packages/shared/src/types.ts`
- **Verification:** `pnpm --filter @counter-attack/shared build` and `pnpm --filter @counter-attack/server build` both compile clean; `git diff packages/shared/src/outOfBounds.ts` remains empty as required by Task 1's acceptance criteria (only `types.ts` changed, not `outOfBounds.ts`)
- **Committed in:** `250c7eb` (Task 1 commit)

**2. [Rule 1 - Bug] Updated a now-incorrect regression test in gameEngine.outOfBounds.test.ts**

- **Found during:** Task 1
- **Issue:** `gameEngine.outOfBounds.test.ts`'s "byline exit after a defending touch stays in play (OOB-03 is Phase 38)" test asserted the pre-Phase-38 clamp/DEFLECTION fallback for a scenario that, after this plan's trigger-branch change, correctly resolves to a `CORNER_KICK` award instead. Leaving the test unchanged would have made it fail (not because of a regression, but because the behavior it asserted is exactly what Task 1 was built to change).
- **Fix:** Updated the test (renamed its describe block, replaced the clamp/DEFLECTION assertions with `CORNER_KICK_GK_SETUP_ATTACKING`/`cornerKickTeam`/`OUT_OF_BOUNDS` event assertions) to reflect the new, correct behavior — following the test's own prior comment that explicitly anticipated this exact change.
- **Files modified:** `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test -- gameEngine.outOfBounds` — 107/107 tests pass
- **Committed in:** `250c7eb` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/missing-type-literal, 1 bug/stale-test-expectation)
**Impact on plan:** Both auto-fixes necessary to satisfy the plan's own stated behavior and acceptance criteria. No scope creep — the type fix is a one-line union extension and the test update reflects intentionally-changed behavior, not an unrelated fix.

## Issues Encountered

- The pre-commit hook (`lint-staged` → `eslint --fix` + `prettier --write`) took longer than the default 2-minute Bash timeout on the first commit attempt and was killed (exit 143). No commit was created and the git index was untouched (confirmed via `git log` and `git status` before retrying); the retry with no timeout override completed successfully. Not a plan deviation — tooling latency only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full corner-kick trigger-through-taker-selection chain now compiles and is unit-tested: a byline exit after a defending touch correctly awards a corner, both goalkeepers reposition in the correct attacking-first order, and the kicking manager can designate any own piece (including the GK) as taker, landing both the piece and the ball on the resolved fixed corner hex.
- `pnpm --filter @counter-attack/server build` and the full server test suite (841 tests, 37 files) are green — no regressions in throw-in or goal-kick flows.
- `cornerKickEligibleIds` is left `null` by `applyCornerKickTakerSelect` with an inline comment naming `computeCornerKickEligibleIds` as the function 38-03 should wire in — exactly one place to change.
- `CORNER_KICK_REPOSITION` (stage 0, `cornerKickStageIndex`/`cornerKickStagePlacedIds`/`cornerKickUsedPace` all initialized) is ready for 38-03's 6-stage alternating reposition window to build on directly.

## Known Stubs

None - this plan implements complete, functioning engine logic for every behavior it covers; no placeholder/mock data paths were introduced.

## Threat Flags

None - the plan's own threat model (T-38-04 through T-38-07, T-38-SC) was fully addressed as designed: acting-team derivation never reads `activeTeam` or a client-supplied value (T-38-04), `isPitchHex` + occupancy scanning gates every placement (T-38-05), the corner hex is entirely server-derived with no client-suppliable hex parameter (T-38-06), team inversion is unit-tested in both directions (T-38-07), and no package-manager installs occurred (T-38-SC).

---

_Phase: 38-corner-kick_
_Completed: 2026-08-07_
