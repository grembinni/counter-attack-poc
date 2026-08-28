---
phase: 45-game-summary-popup
plan: 01
subsystem: shared-types
tags: [typescript, vitest, shared-package, xg-formula, hex-grid]

# Dependency graph
requires: []
provides:
  - "MatchStats type: 9 per-team whole-match counters on GameState.matchStats"
  - "RefereeCard.wasManualOverride flag for the STATS-03 settings recap"
  - "computeShotXg: pure D-01 xG formula implementation, clamped to [0, 1]"
  - "EMPTY_MATCH_STATS frozen seed constant"
  - "recordShotInStats: immutable shot-recording helper"
affects: [45-02, 45-03, 45-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whole-match stat counters follow the subsUsed never-reset-at-half-time shape/pattern (not addedTimeBonus's per-half pattern)"
    - "Pure formula modules (matchStats.ts, mirroring pitch.ts) consume isInRegion/isActivePiece rather than re-deriving geometry or eligibility filters"
    - "Per-factor Math.max(0, ...) clamping before multiplication to prevent sign-flip when multiple formula factors can independently go negative"

key-files:
  created:
    - packages/shared/src/matchStats.ts
    - packages/shared/src/matchStats.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/index.ts

key-decisions:
  - "Followed PD-01..PD-06 verbatim from the plan's planner_decisions (shot hex = shooter's own position, goal orientation derivation, per-factor clamping, raw float xG storage, no new ActionEvent type, wasManualOverride nested in RefereeCard)"

patterns-established:
  - "Pattern: new whole-match GameState counters use the subsUsed shape { home: number; away: number } and cite 'never reset at half-time' in their doc comment"
  - "Pattern: pure shared-package geometry/eligibility logic imports isInRegion (pitch.ts) and isActivePiece (stoppagePhases.ts) rather than reimplementing region or active-piece checks"

requirements-completed: [STATS-03, STATS-04, STATS-05, STATS-06, STATS-07, STATS-08, STATS-09]

# Metrics
duration: ~35min
completed: 2026-08-28
---

# Phase 45 Plan 01: Shared MatchStats Contract & xG Formula Summary

**Pure, unit-tested `computeShotXg` implementing the user's verbatim D-01 xG formula, plus the `MatchStats` type/`GameState.matchStats` field and `RefereeCard.wasManualOverride` flag that every Wave 2 plan (server instrumentation, broadcast reducer, client rendering) builds against.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-28T19:02:01Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `MatchStats` type added to `types.ts` with all nine per-team whole-match counters (`possessionActionCount`, `passesCompleted`, `tackleStealAttempts`, `tackleStealSuccesses`, `shots`, `xg`, `fouls`, `yellowCards`, `redCards`), each shaped like the existing `subsUsed` field and documented as never-reset-at-half-time.
- `GameState.matchStats?: MatchStats` added directly after `subsUsed`, and `RefereeCard.wasManualOverride?: boolean` added per PD-06 — both optional so no existing construction site breaks.
- `computeShotXg(shotHex, attackingTeam, defendingPieces)` implements D-01's exact formula (defender-count factor, penalty-area factor, row factor, depth factor), deriving goal orientation and region keys from `attackingTeam` per PD-02, using `isInRegion` (`pitch.ts`) and `isActivePiece` (`stoppagePhases.ts`) rather than reimplementing geometry or eligibility checks, with every factor individually clamped via `Math.max(0, ...)` per PD-03 so the return value is always within `[0, 1]`.
- `EMPTY_MATCH_STATS` frozen seed constant and `recordShotInStats(stats, team, xg)` immutable shot-recording helper added, both exported via the `index.ts` barrel.
- 16 new unit tests cover the zero-defender baseline, six-yard-box vs. penalty-area-only defender factors, no-double-counting, `isActivePiece` exclusion of red-carded/off-pitch pieces, row/depth weight thresholds, orientation mirroring, and both clamping scenarios (single negative factor and the double-negative sign-flip hazard) — plus an explicit `[0, 1]` range assertion across a fixture sweep.

## Task Commits

Each task was committed atomically:

1. **Task 45-01-01: Define the MatchStats contract on GameState and RefereeCard** - `95f94700` (feat)
2. **Task 45-01-02: Implement and unit-test the pure xG formula module** - `d08ef4aa` (feat)

## Files Created/Modified

- `packages/shared/src/types.ts` - Added `MatchStats` type (above `GameState`), `GameState.matchStats?` field (after `subsUsed`), and `RefereeCard.wasManualOverride?` flag
- `packages/shared/src/matchStats.ts` - New pure module: `EMPTY_MATCH_STATS`, `computeShotXg`, `recordShotInStats`
- `packages/shared/src/matchStats.test.ts` - New co-located Vitest suite, 16 tests, local `makePiece` fixture factory (no roster-data coupling)
- `packages/shared/src/index.ts` - Barrel-exports `matchStats.js` after `stoppagePhases.js`

## Decisions Made

None beyond the plan's own `planner_decisions` (PD-01 through PD-06), which were followed verbatim:
- Shot hex is the shooter's own position at the moment of the shot (PD-01), never the target hex.
- Goal column/region derivation from `attackingTeam`: home attacks `q=36`/`away*` regions, away attacks `q=0`/`home*` regions (PD-02).
- Each of the four D-01 formula factors is clamped individually with `Math.max(0, ...)` before multiplication (PD-03).
- `matchStats.xg` stores a raw unrounded running float; all rounding/formatting deferred to display code (PD-04).
- No new `ActionEvent` type or field was added — xG/shot counts will be written directly into `GameState.matchStats` at each resolution site in later plans (PD-05).
- `wasManualOverride` lives inside `RefereeCard`, not as a sibling `GameState` field, so it survives replay for free via the existing `refereeCard: finalState.refereeCard` carry-forward (PD-06).

## Deviations from Plan

None - plan executed exactly as written. Task 2's TDD tests and implementation were authored and verified together (both files created before the task commit); the co-located test suite passed on first run with no red→fix cycle needed, so a single `feat` commit was made for the task rather than a separate RED/GREEN pair — this matches the plan's `tdd="true"` intent (test coverage exists and passes) without an artificial failing-test-first commit, since the implementation and its tests were written as one deliverable per the task's own `<action>` instructions.

## Issues Encountered

The worktree had no `node_modules` installed (git worktrees don't carry them). Ran `pnpm install --frozen-lockfile`, which resolved entirely from the shared pnpm store (536+/543 packages reused, 0 downloaded) in under 5 minutes — no lockfile or dependency changes were introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The shared `MatchStats` contract, `computeShotXg`, `EMPTY_MATCH_STATS`, and `recordShotInStats` are all built, tested, and exported from `@counter-attack/shared` — ready for Wave 2's three parallel plans (server shot instrumentation at every shot-resolution branch per D-03, server broadcast/possession reducer, client stats rendering) to import against a single already-defined interface.
- `ActionEvent`/`ActionEventType` are confirmed byte-for-byte unchanged (verified via grep), so no Undo/Replay/ActionLog registration checklist is triggered by this plan.
- Full shared-package regression suite (902 tests across 18 files, including `pitch.test.ts` and `stoppagePhases.test.ts`) is green; `pnpm --filter @counter-attack/shared build` emits `dist/matchStats.js`/`dist/matchStats.d.ts`; `git diff --stat` against the plan's base commit shows exactly the four files the plan's `<verification>` section expects.

---
*Phase: 45-game-summary-popup*
*Completed: 2026-08-28*
