---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 19
subsystem: game-rules
tags: [fouls, dogso, hex-geometry, shared-package, vitest]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks (plan 18)
    provides: resolveFoulChain call sites guaranteed to pass the FOULED ATTACKER's hex
      as the third isProfessionalFoul argument (not the tackle contact hex)
provides:
  - Goal-side + goal-path DOGSO reachability test replacing the omnidirectional
    "any teammate anywhere" test
  - GOAL_PATH_R_MIN/MAX constants, clampGoalPathRow, attackerGoalPath exported helpers
  - The user's own worked example (39-UAT test 8) locked in as a permanent regression test
affects: [39-20, 39-21, any future plan touching isProfessionalFoul or FOUL-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Directional coverage test: horizontal goal-side comparison + straight hex-line
      goal-path reachability, replacing omnidirectional distance-to-hex reachability'

key-files:
  created: []
  modified:
    - packages/shared/src/fouls.ts
    - packages/shared/src/fouls.test.ts
    - packages/server/src/__tests__/gameEngine.fouls.test.ts

key-decisions:
  - "The user's (29,25) worked-example coordinate is a transcription slip for (29,15) -- locked in as a commented regression test per PLAN.md's resolved rule specification"
  - "isProfessionalFoul's third parameter renamed foulHex -> attackerHex; no arity/call-site changes needed since Plan 39-18 already guarantees every resolveFoulChain call site passes the fouled attacker's hex"
  - 'Two pre-existing gameEngine.fouls.test.ts FOUL-04 fixtures asserted the old omnidirectional rule (a teammate behind the attacker or off the goal path no longer counts as cover) -- repositioned under Rule 1 (bug fix, behavior legitimately changed) rather than left red'

requirements-completed: [FOUL-04, CARD-03]

# Metrics
duration: 22min
completed: 2026-08-15
---

# Phase 39 Plan 19: Goal-Side + Goal-Path DOGSO Reachability Summary

**Rewrote `isProfessionalFoul`'s reachability test from omnidirectional teammate-coverage to a directional goal-side + goal-path test (row-clamped straight hex line to the attacked goal), closing 39-UAT gap 8 and locking in the user's own worked example as a permanent unit test.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-15T17:57:00Z
- **Completed:** 2026-08-15T18:19:46Z
- **Tasks:** 2
- **Files modified:** 3 (2 planned, 1 additional test file per deviation below)

## Accomplishments

- `attackerGoalPath` + `clampGoalPathRow` + `GOAL_PATH_R_MIN`/`GOAL_PATH_R_MAX` implement the user's row-clamped straight-line goal-path rule as independently testable pure helpers
- `isProfessionalFoul` now requires a candidate defender to be BOTH horizontally closer to the attacked goal than the attacker AND able to reach the attacker's clamped goal path with remaining pace — a defender behind the attacker, or level with the attacker, never suppresses DOGSO regardless of pace
- The fouling team's goalkeeper is now explicitly excluded from the covering-defender set (previously only the fouler itself and red-carded pieces were excluded)
- The user's worked example from 39-UAT test 8 (home attacker on `{q:21,r:15}`, away defender on `{q:29,r:12}` with pace 4) is now a named, commented regression test proving NOT-DOGSO, with the `(29,25)` → `(29,15)` transcription correction documented inline so it is never "fixed" back
- `fouls.test.ts`'s DOGSO suite grew from 31 to 50 assertions (13 new `isProfessionalFoul` cases + 11 new `clampGoalPathRow`/`attackerGoalPath` boundary cases, replacing the 4 old omnidirectional cases)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the goal-path geometry helpers and rewrite isProfessionalFoul** - `81b649e` (feat)
2. **Task 2: Replace the DOGSO test suite with the goal-path geometry cases** - `f86557b` (test)

_Note: hooks (lint-staged: eslint --fix + prettier --write) ran automatically on both commits; no manual reformatting was needed._

## Files Created/Modified

- `packages/shared/src/fouls.ts` - Added `GOAL_PATH_R_MIN`/`GOAL_PATH_R_MAX`/`clampGoalPathRow`/`attackerGoalPath`; rewrote `isProfessionalFoul` to the goal-side + goal-path predicate; deleted the old `couldHaveCovered` omnidirectional block entirely
- `packages/shared/src/fouls.test.ts` - Replaced the `isProfessionalFoul` describe block (13 cases: worked example, pace-reduced, pace-consumed, behind-defender, level-defender, GK exclusion, red-card exclusion, away-attacking mirror x2, row-clamping x2, fouler self-exclusion, missing-fouler); added a new `clampGoalPathRow`/`attackerGoalPath` describe block (11 boundary-value cases)
- `packages/server/src/__tests__/gameEngine.fouls.test.ts` - Updated two `FOUL-04` fixtures whose positions no longer exercised the intended reachable/unreachable distinction under the new directional rule (moved the "no remaining pace" fixture off the exact goal-path row so it still tests pace exhaustion rather than accidentally standing on the path with zero budget; moved the "reachable teammate" fixture goal-side of the attacker); added a third case pinning the new "behind the attacker never suppresses DOGSO" rule at the engine-integration layer

## Decisions Made

- Kept the third `isProfessionalFoul` parameter's semantic rename (`foulHex` → `attackerHex`) doc-comment-only, per PLAN.md — no call-site edits were required since Plan 39-18 already guarantees every `resolveFoulChain` call passes the fouled attacker's hex
- Wrote the goal-side filter predicate in positive form (`candidate.role !== 'GK' && ...`) rather than early-return guards, for both readability and literal grep-ability against the plan's acceptance criteria
- Verified all worked-example and row-clamping hex-distance/hexLine values numerically via a Node script against the compiled `dist/hex.js`/`dist/fouls.js` before writing test assertions, rather than trusting mental hex-geometry math

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated two gameEngine.fouls.test.ts fixtures that asserted the old omnidirectional DOGSO rule**

- **Found during:** Task 2 (running `pnpm --filter @counter-attack/server test` per the plan's acceptance criteria, which explicitly requires "any Phase 39 server suite that asserted the old DOGSO behaviour must be updated in the same change, not left red")
- **Issue:** `gameEngine.fouls.test.ts`'s two `FOUL-04: Professional Foul reachability` tests placed covering teammates at positions that happened to be exactly on the new goal-path row (making a "no remaining pace" teammate accidentally still cover with 0 budget) or behind the attacker (making a "reachable teammate" fixture no longer goal-side, so it stopped covering) — both genuine behavior changes correctly caused by the Task 1 rewrite, not new bugs in Task 1's code
- **Fix:** Repositioned the "no remaining pace" teammate 3 hexes off the goal-path row (still goal-side, still would be reachable with full pace, but unreachable once exhausted) and repositioned the "reachable teammate" fixture goal-side of the attacker on/near the goal path; added a third case (`a teammate BEHIND the attacker ... never suppresses DOGSO`) to explicitly pin the new directional exclusion at the engine-integration layer, since the old fixture's original position `{q:9,r:7}` (one hex from the foul hex but NOT goal-side) is exactly the scenario 39-UAT gap 8 was reported against
- **Files modified:** `packages/server/src/__tests__/gameEngine.fouls.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test` — 1285 passed, 1 skipped (pre-existing), 1 todo (pre-existing), 0 failed
- **Committed in:** `f86557b` (Task 2 commit, alongside the planned `fouls.test.ts` rewrite)

---

**Total deviations:** 1 auto-fixed (1 bug — pre-existing test fixtures invalidated by an intentional, plan-specified behavior change)
**Impact on plan:** Necessary to satisfy the plan's own acceptance criteria (zero-failure server suite). No scope creep — no other files touched, no new server behavior introduced.

## Issues Encountered

- The worktree had no `node_modules` installed (fresh worktree checkout). Ran `pnpm install --offline` (543 packages, all reused from the local store, 0 downloaded) before any build/test/typecheck command would run. Not a deviation — infrastructure prerequisite, no code impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `isProfessionalFoul`'s new signature semantics (`attackerHex` as the fouled attacker's hex) and its exported `GOAL_PATH_R_MIN`/`GOAL_PATH_R_MAX`/`clampGoalPathRow`/`attackerGoalPath` helpers are stable and available to any future plan needing goal-path geometry (e.g. future professional-foul UI highlighting)
- No known stubs, no threat-surface changes beyond the existing accepted/mitigate dispositions already recorded in this plan's `<threat_model>` (all three threats — tampering on server-derived inputs, the bounded `hexLine` DoS mitigation, and the pre-existing repudiation/audit-trail acceptance — hold unchanged after implementation)
- Full monorepo build, typecheck, and both `shared`/`server` test suites are green; no follow-up work identified

## Self-Check: PASSED

- FOUND: `packages/shared/src/fouls.ts`
- FOUND: `packages/shared/src/fouls.test.ts`
- FOUND: `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-19-SUMMARY.md`
- FOUND: commit `81b649e` (Task 1)
- FOUND: commit `f86557b` (Task 2)
- FOUND: commit `3a4257d` (docs: summary)

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-15_
