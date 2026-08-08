---
phase: 38-corner-kick
plan: 14
subsystem: game-engine
tags: [corner-kick, loose-ball, goalkeeper, out-of-bounds, gap-closure, rulebook-correction]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: the corner-kick engine/handler surface built in 38-01..38-13, including CORNER_KICK_HEX, triggerOutOfBoundsRestart's CORNER_KICK branch (OOB-03), and the LOOSE_BALL scatter-walk clamp machinery
provides:
  - 'The Phase 17.1 D-07 placeholder replaced: a failed GK handling check on a SAVE now spills into a genuine LOOSE_BALL (ball.carrierId null, ball.lastTouchedBy the keeper) instead of an unconditional GK_RESTART clean-catch'
  - "A second, previously-missing route into a Corner Kick: a spilled-save scatter that crosses the keeper's own byline is classified CORNER_KICK by the existing classifyOutOfBounds/triggerOutOfBoundsRestart machinery and awarded to the opposite team"
  - 'An in-bounds spilled-save scatter continues play as an ordinary loose ball (phase PASS); the outOfBoundsEnabled:false toggle preserves the pre-Phase-37 clamp-to-pitch path unchanged'
  - "D-GAP-02 recorded: the spill is modelled as an ordinary Loose Ball from the keeper's hex, so a byline-ward direction only awards a corner when the scatter walk actually exits the pitch — flagged for 38-15's walkthrough to confirm or correct against the direction-only rulebook reading"
affects: [38-15, 38-corner-kick verification checkpoint (38-09 deferred walkthrough)]
requirements-completed: [OOB-03]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
    - packages/server/src/__tests__/gameEngine.phase17.test.ts
    - packages/server/src/__tests__/gameEngine.rule11.test.ts

key-decisions:
  - 'D-GAP-02 (recorded verbatim per plan Task 1 instruction): the spill is modelled as an ordinary Loose Ball scattering from the keeper''s hex, so a byline-ward direction produces a corner only when the scatter walk actually leaves the pitch. When the keeper is standing several hexes off their own byline, a short byline-ward scatter lands in play rather than awarding a corner. The user''s rule text ("if the landing direction is next to/behind the GK it is a Corner Kick") may intend a direction-only check that awards a corner regardless of the keeper''s distance from the line. This plan implements the scatter-walk reading because it is the minimal change that uses the exact functions the gap-closure scope names, and because the engine''s existing loose-ball model reproduces the physical case (keeper on the goal line) correctly. Flagged explicitly for confirmation or correction in plan 38-15''s walkthrough.'
  - "The spill branch deliberately does NOT reassign activeTeam/attackingTeam to the keeper's team (mirrors the SHOT duel-tie LOOSE_BALL branch exactly) — possession is not handed to a team that never controlled the ball, closing threat T-38-47."
  - 'Direction/distance dice for the new end-to-end corner-kick proof test are derived at test-run time from the real computeLooseBall/isPitchHex trajectory (not hardcoded literals), so the test survives a future change to the direction table.'

patterns-established: []

# Metrics
duration: ~14min
completed: 2026-08-08
---

# Phase 38 Plan 14: GK Save-Spill → Real Loose Ball / Second Corner Kick Route Summary

**Replaced the Phase 17.1 D-07 "spill treated as clean catch" placeholder with a genuine `LOOSE_BALL` transition, so a spilled goalkeeper save now scatters from the keeper's hex and a byline-ward scatter is awarded as a Corner Kick via the existing `classifyOutOfBounds`/`triggerOutOfBoundsRestart` machinery.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-08-08T13:32:20Z
- **Completed:** 2026-08-08T13:45:53Z
- **Tasks:** 3
- **Files modified:** 6 (5 code/test files + 1 deferred-items.md log)

## Accomplishments

- Closed the Phase 17.1 D-07 TODO: the SHOT `SAVE` branch's `!handling.caught` (spill) return now sets `phase: 'LOOSE_BALL'` with `ball.carrierId: null` and `ball.lastTouchedBy` naming the goalkeeper, instead of returning the same `GK_RESTART` state as a clean catch.
- Proved end to end, at the engine level, that a spilled-save scatter crossing the keeper's own byline routes through the already-built OOB-03 `CORNER_KICK` classification and awards `CORNER_KICK_GK_SETUP_ATTACKING` to the opposite team — the second (previously missing) route into a Corner Kick.
- Proved the two complementary paths: an in-bounds spill scatter resolves as an ordinary loose ball (`phase: 'PASS'`), and `outOfBoundsEnabled: false` preserves the pre-Phase-37 clamp-to-pitch behaviour exactly, never awarding a corner from a spill.
- Ran a full regression sweep and corrected three pre-existing test fixtures across two other test files that had encoded the old "spill = clean catch" assumption, updating their assertions to the new `LOOSE_BALL` outcome without deleting any test.
- Confirmed by reading (not assuming) that `ELIGIBLE_NEXT_ACTIONS['DEFLECTION']` needs no new row and that `ActionLog.tsx` already renders a `SHOT_ATTEMPT` carrying `outcome: 'LOOSE_BALL'` from the SAVE branch — that combination was already emitted by the pre-existing `saveOutcome` computation even under the old placeholder, so this plan changes only the resulting `GameState.phase`, not the event shape.
- Confirmed the STATE.md v1.6 "5+ independent clamp-to-pitch call sites" pitfall does not apply here: the spill now feeds the single existing ball-scatter clamp site inside `applyRoll`'s `LOOSE_BALL` case (`gameEngine.ts:3312`), not a new or bypassed one.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the spill placeholder with a real LOOSE_BALL transition** - `67ab728` (feat)
2. **Task 2: Prove the spill scatter routes a byline exit into a Corner Kick** - `e44bffb` (test)
3. **Task 3: Regression sweep across every consumer of the old spill-to-GK_RESTART behaviour** - `9a392e2` (fix)

**Plan metadata:** (this commit, appended after SUMMARY.md is written)

_Note: no TDD RED/GREEN split was used — the plan's `tdd="true"` tasks were executed by writing the engine change and its direct test coverage together per task, then a separate proof/regression task, matching the plan's own task structure rather than a strict test-first RED commit._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - SHOT SAVE branch's spill (`!handling.caught`) return rewritten to `LOOSE_BALL` (was `GK_RESTART`); deleted the `activeTeam`/`attackingTeam` reassignment; deleted the Phase 17.1 D-07 TODO comment, replaced with the implemented-rule comment citing 38-14
- `packages/server/src/__tests__/gameEngine.test.ts` - Added `SHOT SAVE + SPILL` (phase/carrier, lastTouchedBy) tests; renamed the existing catch test to `SHOT SAVE + CAUGHT: still transitions to GK_RESTART...` per the plan's required test names
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` - New describe block `spilled save: the second route into a Corner Kick (38-14)` with the 3 required test names, deriving byline-ward/in-bounds direction-distance dice from the real `computeLooseBall`/`isPitchHex` trajectory
- `packages/server/src/__tests__/gameEngine.phase17.test.ts` - 2 pre-existing spill-intent fixtures (`Phase 17 BUG-05`, `Phase 17.1 D-07`) updated from `GK_RESTART`/carrier assertions to `LOOSE_BALL`/null-carrier/`lastTouchedBy` assertions; describe/test names updated to reflect the superseding rule
- `packages/server/src/__tests__/gameEngine.rule11.test.ts` - 1 pre-existing spill-intent fixture (`RULE-03: SHOT save-dropped branch`) updated the same way; its actual purpose (`lastShotPath === null`) assertion was preserved unchanged
- `.planning/phases/38-corner-kick/deferred-items.md` - Logged a pre-existing, out-of-scope `pnpm lint` failure in `packages/shared` (see Deviations)

## Decisions Made

See `key-decisions` in frontmatter for D-GAP-02 (recorded verbatim per the plan's Task 1 instruction) and the two supporting decisions (no possession handover on spill; derived-not-hardcoded dice in the proof test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 3 pre-existing test fixtures whose assertions encoded the old placeholder behaviour**

- **Found during:** Task 3 (regression sweep)
- **Issue:** `pnpm --filter @counter-attack/server test` failed 3 tests after Task 1's change: `gameEngine.phase17.test.ts`'s `Phase 17 BUG-05...` and `Phase 17.1 D-07...` describe blocks, and `gameEngine.rule11.test.ts`'s `RULE-03: SHOT save-dropped branch` test — all three asserted `phase === 'GK_RESTART'` with the keeper carrying the ball for a spilled (dropped) save, which was exactly the D-07 placeholder behaviour this plan replaces.
- **Fix:** Reclassified all three as spill-intent (not catch-intent) fixtures per the plan's Task 3 instructions. Updated assertions to `phase === 'LOOSE_BALL'`, `ball.carrierId === null`, and (where absent) added a `ball.lastTouchedBy` assertion naming the keeper. `gameEngine.rule11.test.ts`'s test also asserts `lastShotPath === null`, which is its actual RULE-03 purpose — that assertion was left unchanged and still passes. Renamed describe/test titles to name 38-14 as the superseding change and cite the closed Phase 17.1 D-07 TODO, rather than leaving stale titles that still claim `GK_RESTART`.
- **Files modified:** `packages/server/src/__tests__/gameEngine.phase17.test.ts`, `packages/server/src/__tests__/gameEngine.rule11.test.ts`
- **Verification:** Full monorepo suite green afterward — `pnpm test` (shared 665, server 999/1 skipped/1 todo, client 743), both packages' `typecheck` clean.
- **Committed in:** `9a392e2` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug-class fix touching 3 fixtures across 2 files)
**Impact on plan:** Necessary and expected — Task 3's own acceptance criteria required exactly this reclassify-and-update sweep. No scope creep; no test was deleted, and the net test count only increased (added 5 new tests across Tasks 1-2, updated but did not remove 3 existing tests in Task 3).

## Issues Encountered

- **Pre-existing repo-state gap, not caused by this plan:** the worktree had no `node_modules` installed and `packages/shared/dist/` was missing at plan start (same class of issue noted in 38-13's SUMMARY). Resolved with `pnpm install` followed by `pnpm --filter @counter-attack/shared build` before running any test suite.
- **Pre-existing, out-of-scope `pnpm lint` failure:** the repo-root `eslint .` fails with 8 `Parsing error: Too many files (>8) have matched the default project` errors, entirely inside `packages/shared/src/*.test.ts` and `packages/shared/scripts/seed-rosters.ts` — files this plan never touched (`packages/shared` was rebuilt via `pnpm --filter @counter-attack/shared build`, not edited). Confirmed out of scope by running `npx eslint` scoped to exactly this plan's 5 touched files: zero errors. Logged to `.planning/phases/38-corner-kick/deferred-items.md` per the Scope Boundary rule rather than fixed here (fix requires either raising typescript-eslint's `maximumDefaultProjectFileMatchCount` or adding the matched globs to `packages/shared/tsconfig.json`'s `include`, neither of which is this plan's concern).
- One `pnpm --filter @counter-attack/server test` run during Task 3's initial regression pass surfaced the 3 expected failures cleanly (no flakes this run, unlike 38-13's noted transient port-binding flake).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- OOB-03's byline-exit corner-kick route remains fully verified and untouched; the second, previously-missing spill-to-corner route is now implemented and proven end to end.
- Full monorepo test suite green: shared 665/665, server 999/999 (1 skipped, 1 todo), client 743/743. Both server and client `typecheck` clean.
- `packages/shared/src/outOfBounds.ts`, `packages/shared/src/scoreUtils.ts`, and `packages/shared/src/actionSequence.ts` are unchanged, as required by this plan's verification section.
- **D-GAP-02 must be confirmed or corrected in plan 38-15's walkthrough** — see key-decisions above. This is the single open question blocking full closure of the 38-09 checkpoint's gap-closure scope item 2.
- The pre-existing `pnpm lint` / `packages/shared` eslint-config gap (logged to deferred-items.md) is non-blocking for this plan and for 38-15, but should be picked up by a dedicated cleanup pass before phase close if `pnpm lint` is a phase-close gate.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_
