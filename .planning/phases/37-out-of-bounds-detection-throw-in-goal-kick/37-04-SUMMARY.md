---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 04
subsystem: game-engine
tags: [typescript, vitest, gameEngine, out-of-bounds, throw-in, goal-kick]

# Dependency graph
requires:
  - phase: 37-03
    provides: 'GameState.outOfBoundsEnabled toggle, defaulting to false everywhere, reaching the engine reliably before any classification logic exists'
provides:
  - 'triggerOutOfBoundsRestart(state, exitHex, lastInBoundsHex) — pure engine helper classifying a ball exit into a fully-formed THROW_IN_SETUP or GOAL_KICK_SETUP_GK restart state, or null (CORNER_KICK/missing-GK fallback)'
  - 'The LOOSE_BALL clamp loop now classifies an off-pitch scatter step and routes to a restart when outOfBoundsEnabled === true, with the disabled/absent path proven byte-for-byte unchanged'
  - 'ZONE_CHECK_EXEMPT_PHASES — module-level exemption set so the ball-zone free-move interrupt can never overlay any of the six Phase-37 restart phases'
affects: [37-05, 37-06, 37-07, 37-08, 37-09, 37-10, 38]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "triggerOutOfBoundsRestart mirrors applyGKRestart/applyGKKickTarget's return-literal shape (phase + team fields + lastDiceRoll left as caller-set + lastActionType: null) but is a standalone classify-then-transition helper, not a phase-guarded apply* handler — the caller (the LOOSE_BALL clamp site) owns gating it behind outOfBoundsEnabled"
    - 'Early-branch-not-interleaved-conditionals for OOB-05: exitInfo stays null unless outOfBoundsEnabled === true, so the disabled path executes the exact same statement sequence (including the same `break`) it did before Phase 37'
    - 'ZONE_CHECK_EXEMPT_PHASES: ReadonlySet<GamePhase> replaces an inline boolean OR chain in applyFreeMoveZoneCheck, giving Phase 38 one greppable place to add CORNER_KICK_* later'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
  modified:
    - packages/server/src/gameEngine.ts

key-decisions:
  - "goalKickEligibleIds is set to null (not computed) by triggerOutOfBoundsRestart — Plan 37-08 owns computing the GOALKICK-02 eligible lists when it implements the reposition windows, per the plan's own explicit instruction, to avoid two places deriving the same list"
  - 'triggerOutOfBoundsRestart returns null (not a thrown error) for CORNER_KICK and for a missing GK — both are documented, tested fallback-to-clamp paths, not defensive-only dead code; the missing-GK case in particular protects a malformed-fixture edge case from ever reaching a phase transition with no ball carrier'
  - 'Test fixtures'' direction/distance dice values were verified against the real computeLooseBall/isPitchHex implementation via a throwaway node script before being hardcoded into the test file, rather than hand-derived from the cube-coordinate formula alone — eliminates a class of subtly-wrong "off by one hex" test bugs'

requirements-completed: [OOB-01, OOB-02, OOB-04, OOB-05, THROWIN-01, THROWIN-05]

# Metrics
duration: 25min
completed: 2026-08-03
---

# Phase 37 Plan 04: LOOSE_BALL Out-of-Bounds Hook Summary

**`triggerOutOfBoundsRestart` engine helper hooked into the `LOOSE_BALL` scatter clamp — sideline exits award a throw-in, byline exits after an attacking/no touch award a goal kick, defending-touch byline exits and the toggle-off path both fall back to today's clamp unchanged, and the ball-zone free-move interrupt can no longer hijack any of the six new restart phases.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-03T21:05:00-05:00 (approx)
- **Completed:** 2026-08-03T21:21:20-05:00
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `triggerOutOfBoundsRestart(state, exitHex, lastInBoundsHex)` exported from `gameEngine.ts`: classifies an off-pitch exit via `classifyExit`/`bylineOwner`/`classifyOutOfBounds` (imported from `@counter-attack/shared`), and returns either a fully-formed `THROW_IN_SETUP` state (OOB-02/THROWIN-01: award to the non-touching team, or against `attackingTeam` when untouched; `throwInHex` via `resolveThrowInHex` so placement can never dead-end on an occupied exit hex) or a fully-formed `GOAL_KICK_SETUP_GK` state (OOB-04: award to the byline-owning team, ball placed on that team's GK), or `null` for `CORNER_KICK` (OOB-03/Phase 38 scope) or a missing GK
- Every returned state appends exactly one `OUT_OF_BOUNDS` event and resets the full Movement-sequence/dice/shot-path bookkeeping set (`movementSlot`, `movedPieceIds`, `paceUsedByPieceId`, `stealAttemptedByIds`, `tackleAttemptedByIds`, `lastShotPath`, `lastActionType`) — verified directly via a dedicated unit test, not just observed incidentally through the `applyRoll` integration tests
- `applyRoll`'s `LOOSE_BALL` clamp loop now records `exitInfo` only when `state.outOfBoundsEnabled === true`, routes through `triggerOutOfBoundsRestart` immediately after the loop, and falls through to the completely untouched pre-Phase-37 clamp/trajectory/landing code on a `null` result or a disabled/absent toggle — OOB-05's "disabled path unchanged" contract holds by construction (same statement sequence, same `break`), not just by test coverage
- `applyFreeMoveZoneCheck`'s phase-exclusion guard extracted into a module-level `ZONE_CHECK_EXEMPT_PHASES: ReadonlySet<GamePhase>`, extended with `THROW_IN_SETUP`/`GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT`/`GOAL_KICK_CHOICE`/`GOAL_KICK_TARGET`/`GOAL_KICK_MOVE` alongside the pre-existing `HALF_TIME`/`FULL_TIME`/`FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` — the BUG-20 `MOVE`-with-active-slot and `HEADER` deferral branches are untouched
- New `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts`: 16 tests covering OOB-05 toggle-off/absent preservation (including the explicit "no `OUT_OF_BOUNDS` event in either case" assertion), sideline award direction (both edges + untouched-ball + occupied-hex relocation), byline award for both attacker-touch and untouched-shot cases, the OOB-03/Phase-38 corner-kick fallback, direct `triggerOutOfBoundsRestart` bookkeeping-reset coverage, and one regression test per exempted restart phase
- Full server suite: 663 tests passing (+16 from this plan's baseline of 647), 1 skipped, 1 todo; full monorepo (`pnpm -r typecheck`) clean

## Task Commits

1. **Task 1: Build the triggerOutOfBoundsRestart engine helper** - `875f6ea` (feat)
2. **Task 2: Hook classification into the LOOSE_BALL clamp and guard the free-move interrupt** - `10c7e34` (feat)
3. **Task 3: Wave 0 — gameEngine.outOfBounds.test.ts** - `7c37601` (test)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — `triggerOutOfBoundsRestart` (new, placed between `applyRoll` and `applyGKRestart`); `LOOSE_BALL` clamp loop's `exitInfo` branch + post-loop restart routing; `ZONE_CHECK_EXEMPT_PHASES` module-level const + `applyFreeMoveZoneCheck` guard rewrite; four new named imports (`classifyExit`, `bylineOwner`, `classifyOutOfBounds`, `resolveThrowInHex`) from `@counter-attack/shared`
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` — new Wave-0 test file (16 tests, 4 `PlayerPiece` fixtures including a GK per team, one `baseLooseBallState` fixture derived per-scenario via object spread)

## Decisions Made

- Reused `applyGKRestart`/`applyGKKickTarget`'s return-literal shape as the template for both new-phase returns rather than inventing a new shape, per the plan's own instruction — keeps the restart states structurally consistent with every other phase-transition function in the file
- Chose direction=3 (NW)/6 (SE) for the two sideline test scenarios and direction=1 (E)/4 (W) for the two byline scenarios specifically because their cube-coordinate deltas hold `q` (sideline) or move `q` predictably (byline) without an incidental parity-driven `r` jump muddying the assertions — verified against the real `computeLooseBall`/`isPitchHex` functions via a throwaway script before being written into the test file (see key-decisions)
- Left `goalKickEligibleIds: null` in the `GOAL_KICK_SETUP_GK` return rather than computing final-third eligibility here, exactly as the plan specifies — Plan 37-08 owns that computation

## Deviations from Plan

None — plan executed exactly as written across all three tasks. `node_modules`/`packages/shared/dist` were absent at session start (same pre-existing worktree-bootstrap gap Plans 37-01/02/03 each hit) — resolved with `pnpm install --frozen-lockfile` followed by `pnpm --filter @counter-attack/shared build`; not a plan deviation, standard worktree setup.

## Issues Encountered

- Same worktree-bootstrap gap noted above (missing `node_modules`/shared `dist/`) — resolved before any task work began, no impact on task execution.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `triggerOutOfBoundsRestart` is exported and ready for Plan 37-05+ to build the `THROW_IN_SETUP` placement/movement handlers and the `GOAL_KICK_SETUP_GK`/`GOAL_KICK_CHOICE`/`GOAL_KICK_TARGET`/`GOAL_KICK_MOVE` chain on top of the phase transition this plan already produces.
- `ZONE_CHECK_EXEMPT_PHASES` is the single place later plans (and Phase 38) add any further restart phase that must be immune to the ball-zone free-move interrupt.
- The exact direction/distance/start-hex fixtures used in `gameEngine.outOfBounds.test.ts` (documented in that file's header comment) are ready for later plans to reuse rather than re-deriving: sideline-north `{q:18,r:1}` dir=3 dist=2; sideline-south `{q:18,r:24}` dir=6 dist=2; byline-home `{q:1,r:13}` dir=4 dist=2; byline-away `{q:35,r:13}` dir=1 dist=2.
- Total test count for regression tracking: **server 663 tests (1 skipped, 1 todo)** — up from the 647 baseline recorded at the close of Plan 37-03. Shared/client counts unchanged by this plan (no shared or client files were touched).

## Threat Flags

None. This plan's threat model (T-37-12 through T-37-16, T-37-SC) was addressed exactly as specified: T-37-12/T-37-13's team-selection logic (`throwInTeam`/`goalKickTeam`) is derived exclusively from server-owned `ball.lastTouchedBy`/`bylineOwner`/`attackingTeam` — no client payload participates, and `applyRoll` only ever receives server-generated dice; the null-toucher branch is explicitly unit-tested. T-37-14 is closed by the dedicated "byline exit after a defending touch stays in play" test asserting no restart is awarded on a `CORNER_KICK` classification. T-37-15 is closed by the six `ZONE_CHECK_EXEMPT_PHASES` regression tests. T-37-16 is satisfied — every restart path appends an `OUT_OF_BOUNDS` event to the replay-visible `eventLog`. No packages were installed (T-37-SC).

## Known Stubs

None. Every artifact this plan's `must_haves` section requires is fully wired: `triggerOutOfBoundsRestart` exists and is pure; the `LOOSE_BALL` clamp site classifies exits and routes restarts when the toggle is on, and is provably unchanged when the toggle is off/absent; the free-move interrupt cannot hijack any of the six new restart phases. The actual placement/movement UI and handlers for `THROW_IN_SETUP`/`GOAL_KICK_*` are intentionally out of this plan's scope (Plans 37-05+), not a stub — this plan only had to produce the phase transition, not the downstream flow.

---

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts (triggerOutOfBoundsRestart, exitInfo branch, ZONE_CHECK_EXEMPT_PHASES all present)
- FOUND: packages/server/src/**tests**/gameEngine.outOfBounds.test.ts (16 tests present)
- FOUND: 875f6ea (feat: Task 1)
- FOUND: 10c7e34 (feat: Task 2)
- FOUND: 7c37601 (test: Task 3)

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Plan: 04_
_Completed: 2026-08-03_
