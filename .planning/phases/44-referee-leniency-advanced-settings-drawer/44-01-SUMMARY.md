---
phase: 44-referee-leniency-advanced-settings-drawer
plan: 01
subsystem: api
tags: [gameEngine, referee-leniency, engine-parameters, tdd-adjacent-regression-suite, vitest]

# Dependency graph
requires:
  - phase: 43-tackle-steal-prompt-decline
    provides: the `tackleStealDeclineEnabled` defaulted-trailing-param convention this plan mirrors exactly
provides:
  - "buildInitialGameState 13th/14th positional params: refereeLeniencyOverrideEnabled (boolean, default false), refereeLeniencyValue (optional number)"
  - "Conditional refereeCard.leniency expression: override value when enabled+supplied, otherwise the existing randomInt(2, 6) roll"
  - "gameEngine.refereeLeniency.test.ts: REFEREE-01/02/03/04 engine-level regression suite (9 tests)"
affects: [44-04-room-settings-confirm-handler, 44-03-client-settings-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defaulted trailing-param toggle pattern (mirrors outOfBoundsEnabled/tackleStealDeclineEnabled): new engine capability added as optional params appended at the END of the signature so no existing positional caller breaks"
    - "Single source of truth for a derived-at-construction value: no redundant GameState field added for the override — both runtime consumers (resolveBooking, added-time accumulator) already read state.refereeCard.leniency, so overriding the constructor is sufficient"

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.refereeLeniency.test.ts
  modified:
    - packages/server/src/gameEngine.ts

key-decisions:
  - "No new GameState field added for the override flag/value — confirmed by reading all three runtime consumers of refereeCard.leniency (resolveBooking x2, added-time accumulator) that none re-roll or re-derive Leniency; they all read state.refereeCard.leniency directly, so REFEREE-04 coupling holds automatically once the constructor writes the right number"
  - "Params appended at the tail (13th/14th) rather than inserted earlier, preserving every existing positional call site (production roomHandlers.ts LINEUP_CONFIRM plus ~40 test call sites) without any edits"
  - "refereeLeniencyValue declared as `?: number` (optional param) rather than `: number | undefined`, required by repo-wide exactOptionalPropertyTypes: true"

patterns-established:
  - "Single-helper test-file pattern (buildWithOverride) that routes every test through one positional call site, so a future param append breaks in one place instead of N"

requirements-completed: [REFEREE-02, REFEREE-03, REFEREE-04]

# Metrics
duration: 17min
completed: 2026-08-23
---

# Phase 44 Plan 01: Referee Leniency Engine Override Summary

**Added defaulted 13th/14th trailing params to `buildInitialGameState` (`refereeLeniencyOverrideEnabled`, `refereeLeniencyValue`) that conditionally replace the existing `randomInt(2, 6)` roll, with a 9-test regression suite pinning both the override and the REFEREE-03 random-fallback behavior — zero call-site edits and zero new GameState fields.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-23T21:33:40-05:00
- **Completed:** 2026-08-23T21:50:20-05:00
- **Tasks:** 2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- `buildInitialGameState` now accepts a host-supplied Referee Leniency override as two defaulted trailing params, with every existing positional caller (production `roomHandlers.ts` LINEUP_CONFIRM plus ~40 test call sites) compiling and behaving identically, verified by the full server test suite passing unchanged
- `refereeCard.leniency` uses the override when `refereeLeniencyOverrideEnabled && refereeLeniencyValue !== undefined`, otherwise falls back to the unmodified `randomInt(2, 6)` roll (REFEREE-03, already shipped by quick task `260823-akw`) — confirmed by inverting the conditional and watching 5 of the new suite's tests fail, then reverting
- Confirmed by direct read of all three runtime consumers (`resolveBooking` at gameEngine.ts ~978/~986, the added-time accumulator at ~3065) that none re-roll or re-derive Leniency — they all read `state.refereeCard.leniency` directly, so REFEREE-04's "booking and added-time stay coupled" requirement holds by construction with zero consumer-side code change
- New `gameEngine.refereeLeniency.test.ts` (9 tests) pins: exact override value for Leniency 2/3/4/5 across repeated builds, override-off randomness (2..5 range across 50 builds, ≥2 distinct values across 20 builds), both fallback edge cases (flag true + undefined value; flag false + a value supplied), and a structural no-sibling-field assertion for REFEREE-04

## Task Commits

Each task was committed atomically:

1. **Task 1: Add override params to buildInitialGameState and make refereeCard.leniency conditional** - `e81177b6` (feat)
2. **Task 2: Add the REFEREE-02/03/04 engine regression suite** - `49882973` (test)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - Appended `refereeLeniencyOverrideEnabled: boolean = false` (13th param) and `refereeLeniencyValue?: number` (14th param, appended after `awayBench`); replaced the unconditional `randomInt(2, 6)` in the `refereeCard` object literal with a conditional expression; updated the `TEAM-03` doc-comment block to note the override
- `packages/server/src/__tests__/gameEngine.refereeLeniency.test.ts` - New file, 9 tests, all routed through a single `buildWithOverride` positional-call helper

## Decisions Made

- No new `GameState` field for the override flag/value (per PATTERNS.md's flagged decision point) — the two runtime consumers already read `state.refereeCard.leniency`, so adding a redundant snapshot field would create a second source of truth without any benefit
- The random-fallback test ("override OFF... the default path every legacy caller takes") calls the shared `buildWithOverride(roomCode, false)` helper rather than a bare `buildInitialGameState(...)` call, since `enabled=false` with no value is functionally identical to the trailing params being omitted entirely — this keeps the file's `buildInitialGameState(` occurrence count at exactly 1, satisfying the plan's single-call-site acceptance criterion while still exercising the true default/legacy path

## Deviations from Plan

None — plan executed exactly as written. Two minor plan-authoring discrepancies were found and are noted below for transparency; neither reflects incorrect behavior:

1. The plan's Task 1 acceptance criterion `grep -c "randomInt(2, 6)" packages/server/src/gameEngine.ts` returns exactly `1` is not literally satisfiable — the file's pre-existing (unmodified by this plan) header doc-comment at line 12 ("TEAM-03: refereeCard assigned randomly at match start via crypto.randomInt(2, 6)") also matches the grep pattern, making the true count `2`. This pre-dates this plan (present since the file's Phase-8/quick-task-260823-akw history) and was not introduced by this plan. The underlying invariant the criterion was checking for — exactly one *live* `randomInt(2, 6)` call site, not duplicated — is verified true: `grep -n "randomInt(2, 6)"` shows the single functional call at line 463, with the other hit being a doc comment.
2. The plan's overall `<verification>` item 5 has the identical `grep -c` discrepancy for the same reason (pre-existing doc comment).

Both are cosmetic verification-tooling mismatches, not functional gaps. Logged here rather than silently ignored per deviation-tracking discipline.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no built `dist/` output, causing an initial `pnpm --filter @counter-attack/server typecheck` failure (`Cannot find module '@counter-attack/shared'`) unrelated to this plan's code changes. Resolved by running `pnpm install` (backgrounded, ~4 min) followed by `pnpm --filter @counter-attack/shared build`. Not a deviation under the deviation rules (environment setup, not a code fix), but noted for traceability.
- The Windows vitest worker-crash flake documented in project memory (`feedback_gsd_execute_phase_windows_quirks.md`) occurred on the first full-suite `pnpm --filter @counter-attack/server test` run (3 "Worker exited unexpectedly" errors). Resolved per the documented workaround: rerun with `--pool=forks`, which passed clean (1561 passed, 1 skipped, 1 todo).
- Whole-workspace `pnpm lint` (root `eslint .`) fails on a pre-existing `packages/shared` typescript-eslint file-count-cap parsing error, documented since Phase 32/33 close as unrelated tech debt that doesn't gate CI. Confirmed out of scope for this plan: `npx eslint` scoped directly to the two files this plan touches (`gameEngine.ts`, `gameEngine.refereeLeniency.test.ts`) produces zero errors. Logged to `.planning/phases/44-referee-leniency-advanced-settings-drawer/deferred-items.md` per the Scope Boundary rule; not fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `buildInitialGameState`'s 13th/14th positional params are ready for plan 44-04 (`roomHandlers.ts` `ROOM_SETTINGS_CONFIRM` handler + `LINEUP_CONFIRM` call-site update) to wire `room.refereeLeniencyOverrideEnabled ?? false, room.refereeLeniencyValue` as the two new trailing arguments
- No client-side (`packages/client`) or shared-contract (`packages/shared/src/events.ts`) changes were made in this plan — confirmed client-neutral via a clean `pnpm --filter @counter-attack/client typecheck`, consistent with this plan's design as the deepest, most isolated hop of the six-hop plumbing chain and safe to have run in parallel with plan 44-02
- Full server test suite (1561 passed / 1 skipped / 1 todo) and server+client typecheck are green at this plan's boundary; whole-workspace `pnpm lint` has a pre-existing unrelated failure (see Issues Encountered) that does not block downstream plans

---

*Phase: 44-referee-leniency-advanced-settings-drawer*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/__tests__/gameEngine.refereeLeniency.test.ts
- FOUND: .planning/phases/44-referee-leniency-advanced-settings-drawer/44-01-SUMMARY.md
- FOUND: commit e81177b6
- FOUND: commit 49882973
- FOUND: commit 002565bc
