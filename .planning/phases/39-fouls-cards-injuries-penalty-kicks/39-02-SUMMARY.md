---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 02
subsystem: api
tags: [typescript, shared-kernel, pure-functions, vitest, tdd]

# Dependency graph
requires:
  - phase: 39-01
    provides: PlayerPiece.injuryCount/yellowCards/redCarded, GameState.paceUsedByPieceId, RefereeCard.leniency, and the full Phase 39 GamePhase/ActionEvent/GameState contract this plan's fixtures build against
provides:
  - 'packages/shared/src/fouls.ts — pure foul/injury/booking/professional-foul rule kernel: FOUL_TRIGGER_DIE, INJURY_DEGRADED_ATTRIBUTES, isInjured, injuryPenalty, applyInjuryDegradation, rollsInjury, rollsBooking, resolveBooking, isProfessionalFoul'
  - 'packages/shared/src/shotValidator.ts validateDiveAtFeetDistance — GKDIVE-02 distance-banded saving-penalty sibling of validateGKDive'
  - 'packages/shared/src/index.ts barrel re-export of ./fouls.js'
affects:
  [
    39-03,
    39-04,
    39-05,
    39-06,
    39-07,
    39-08,
    39-09,
    39-10,
    39-11,
    39-12,
    39-13,
    39-14,
    39-15,
    39-16,
    39-17,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Bare `die >= attribute` comparison for injury/booking rolls — the documented INVERSE of every combined-score duel elsewhere in the codebase (RESEARCH.md Pitfall 2); never route through computeCombinedScore'
    - 'Straight-line ("as the crow flies") reachability via hexDistance(other.position, targetHex) <= other.pace - paceUsed, with no path-walk or occupancy simulation (RESEARCH.md Pitfall 5) — same standard already used for move-range highlighting'
    - 'Distance-banded DiveResult siblings (validateGKDive / validateDiveAtFeetDistance) kept deliberately un-refactored/duplicated so a future divergence of either band cannot silently leak into the other'

key-files:
  created:
    - packages/shared/src/fouls.ts
    - packages/shared/src/fouls.test.ts
  modified:
    - packages/shared/src/index.ts
    - packages/shared/src/shotValidator.ts
    - packages/shared/src/shotValidator.test.ts

key-decisions:
  - 'isProfessionalFoul returns true (professional foul confirmed) when the fouler itself cannot be found in state.pieces — a defensive default that treats a malformed caller input as the safety-critical (straight-red-eligible) branch rather than silently downgrading to a normal foul'
  - 'resolveBooking evaluates the base card first (professional ? red-or-yellow : yellow-or-none), then applies the second-yellow upgrade uniformly to any yellow base outcome — this means CARD-03s otherwise-yellow professional-foul branch is still subject to the ordinary second-yellow rule, per the plans explicit test case'

requirements-completed:
  [FOUL-04, CARD-01, CARD-02, CARD-03, INJURY-01, INJURY-02, GKDIVE-02, PEN-01]

# Metrics
duration: ~20min (includes one-time ~3min pnpm install for the fresh worktree)
completed: 2026-08-14
---

# Phase 39 Plan 2: Foul/Injury/Booking/Professional-Foul Rule Kernel Summary

**`packages/shared/src/fouls.ts` delivers the pure rule kernel for injury degradation, the inverted `die >= attribute` booking/injury check, `resolveBooking`'s six-outcome CARD-01/02/03 matrix, and `isProfessionalFoul`'s straight-line reachability test — plus `validateDiveAtFeetDistance`, GKDIVE-02's distance-banded sibling of `validateGKDive` — all fully unit-tested (36 new tests) with the full monorepo build/test suite green (shared 742, server 1034, client 794).**

## Performance

- **Duration:** ~20 min (includes one-time ~3 min `pnpm install --frozen-lockfile` for the fresh worktree)
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Wrote a 31-case `fouls.test.ts` specifying every foul/injury/booking/professional-foul primitive before implementation, confirmed a true RED state (unresolved-import error for `./fouls.js`), then implemented `fouls.ts` to make it GREEN — full TDD RED→GREEN cycle with separate commits.
- Delivered `isProfessionalFoul` per RESEARCH.md Pitfall 5's exact straight-line reachability formula, including the two hardest edge cases: a teammate whose remaining pace budget (post-partial-spend) falls just short of reach, and a `redCarded` teammate in range but ineligible to cover.
- Delivered `resolveBooking`'s full CARD-01/02/03 matrix (6 outcome combinations: normal/professional × booked/not-booked × prior-yellow upgrade), matching the plan's exact evaluation order (base outcome first, then unconditional second-yellow upgrade on any yellow base).
- Added `validateDiveAtFeetDistance` immediately after `validateGKDive` in `shotValidator.ts`, deliberately NOT refactored to share code with it (documented rationale: GKDIVE-05/D-09's shared once-per-team-per-half cap already couples them behaviourally; collapsing the pure functions would let a future band change leak across contexts).
- Full monorepo `pnpm build` and `pnpm -r test` green: shared 742 tests, server 1034 (1 skipped, 1 todo), client 794 — no regressions in any pre-existing suite.

## Task Commits

Each task was committed atomically, following the plan's `tdd="true"` RED→GREEN cycle for Task 1/2:

1. **Task 1: Write fouls.test.ts covering every rule primitive before implementing them** - `7a966de` (test) — RED state confirmed: `Failed to load url ./fouls.js` before `fouls.ts` existed
2. **Task 2: Implement packages/shared/src/fouls.ts and export it from the barrel** - `c7db43d` (feat) — GREEN: all 31 fouls.test.ts cases pass; `pnpm --filter @counter-attack/shared build` exits 0
3. **Task 3: Add validateDiveAtFeetDistance alongside validateGKDive** - `b0b8d0f` (feat) — 5 new cases pass; `validateGKDive`'s body unchanged (diff shows only additions); full shared suite green

_No plan-metadata commit yet — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/shared/src/fouls.ts` - FOUL_TRIGGER_DIE, INJURY_DEGRADED_ATTRIBUTES, isInjured, injuryPenalty, applyInjuryDegradation, rollsInjury, rollsBooking, resolveBooking, isProfessionalFoul
- `packages/shared/src/fouls.test.ts` - 31-case Vitest suite covering every helper, including the Pitfall 2 inversion note and the Pitfall 5 reachability edge cases
- `packages/shared/src/index.ts` - barrel re-export `export * from './fouls.js'` added after `outOfBounds.js`
- `packages/shared/src/shotValidator.ts` - `validateDiveAtFeetDistance` added immediately after `validateGKDive`
- `packages/shared/src/shotValidator.test.ts` - 5 new `describe('validateDiveAtFeetDistance')` cases (0/2/3/4/negative distance)

## Decisions Made

- `isProfessionalFoul` treats a not-found fouler id as `true` (professional foul) rather than `false` — a defensive default favoring the safety-critical branch over a silent normal-foul downgrade, since the plan's contract only specifies behaviour for a valid fouler id.
- `resolveBooking`'s second-yellow upgrade applies uniformly to any `'yellow'` base outcome (normal or professional-foul-otherwise-yellow) — matches the plan's explicit "professional foul, die < leniency, 1 prior yellow -> red" test case, confirming the upgrade rule is foul-type-agnostic.

## Deviations from Plan

None — plan executed exactly as written. The one procedural correction made during execution: `fouls.ts` was drafted in parallel with the test file while waiting on a slow background test run; before committing, the implementation file was moved aside and `index.ts` reverted so the true RED state (unresolved-import failure) could be captured and committed first, per the plan's explicit `tdd="true"` RED→GREEN requirement. This is process discipline, not a plan deviation — the final committed sequence (test-only RED commit, then feat GREEN commit) matches the plan's intent exactly.

## Issues Encountered

- Fresh worktree had no `node_modules` (each git worktree gets its own working directory, consistent with 39-01's note) — ran `pnpm install --frozen-lockfile` once (~3 min) before any test/build command would run.
- Background `vitest run` invocations on this Windows/pnpm setup have a long (~50-80s) "prepare" phase before tests actually execute, even though the tests themselves run in single-digit milliseconds — accounted for by using `run_in_background` and waiting for completion notifications rather than assuming a quick synchronous return.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fouls.ts`'s nine exports and `validateDiveAtFeetDistance` are ready for the server-side engine logic (later Phase 39 waves) to wire into the `TACKLE_ATTEMPT`/`STEAL_ATTEMPT`/`GK_DIVE_AT_FEET` duel-resolution branches per STATE.md's Decisions Locked note (injury/booking rolls wired inline, never inside restart-setup phases).
- `isProfessionalFoul`'s signature (`state, foulerId, foulHex`) is ready to be called from `gameEngine.ts`'s foul-resolution chain once the fouler id and foul hex are known at the call site.
- No blockers. Full monorepo build/test all green.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_
