---
phase: 38-corner-kick
plan: 08
subsystem: testing
tags: [vitest, socket.io, corner-kick, integration-test, out-of-bounds]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 05)
    provides: 'the full Corner Kick socket surface — GAME_CORNER_KICK_GK_PLACE/
      GAME_CORNER_KICK_TAKER handlers, GAME_MOVE/GAME_END_TURN corner branches, the
      CORNER_KICK_UNLIMITED_DISTANCE range override, and the ZONE_CHECK_EXEMPT_PHASES
      Rule 2 fix that makes the five corner phases reachable through a real broadcast'
  - phase: 38-corner-kick (plan 07)
    provides: 'CornerKickSetupPanel and its GameBoard/BallLocationRing/ActionLog
      registrations — confirms the corner phases are dispatch-reachable client-side,
      though this plan drives the server/socket layer directly and does not depend on
      the client build'
provides:
  - 'packages/server/src/__tests__/cornerKick.integration.test.ts — 20 socket-level
    integration tests covering OOB-03 and CORNER-01 through CORNER-06 end to end, from
    a real byline-exit trigger through GK placement, corner-taker selection, the
    6-stage reposition window, the final pre-kick window, and High/Low kick
    resolution'
  - 'Confirms the full corner-kick chain is reachable end to end through the actual
    registered socket handlers with zero direct engine-function calls, closing the
    "works function-by-function but unreachable end to end" failure mode this phase
    was explicitly built to catch'
affects: [38-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real out-of-bounds trigger testing via a retried GAME_ROLL (not seeded
      directly at the post-trigger phase): seedCornerKickLooseBall positions the ball
      at the home-byline edge (q=0) where 2 of the 6 direction dice (W, SW) guarantee
      an immediate byline exit regardless of the distance die (verified via toCube:
      q IS cube x, and both directions cube-dx -1) — mirrors
      throwIn.integration.test.ts's seedLooseBallForReclassification retry-loop
      pattern (MAX_ATTEMPTS=60, real crypto randomness, never mocked)"
    - "Every seed helper parks ALL non-test-subject pieces (including both
      goalkeepers) in the pitch's MIDDLE third, never in either final third — a
      corner's taker hex and its PASS-phase resolution both sit in a final third,
      and PASS is NOT one of gameEngine.ts's ZONE_CHECK_EXEMPT_PHASES, so a
      default-formation GK left in its own final third spuriously triggers
      applyFreeMoveZoneCheck's FREE_MOVE_ATTACK/DEFENSE overlay on the very next
      broadcast (discovered as a real, reproducible bug during this plan — see
      Deviations)"
    - "fastForwardToCornerPass drives the entire corner chain (both GK windows, taker
      selection, all 6 reposition stages, both final-setup slots) with zero piece
      moves per step — legal per D-06/D-05's no-minimum-move guarantee — reaching
      PASS/CORNER_KICK_RESTART purely through GAME_END_TURN sequencing, mirroring
      goalKick.integration.test.ts's seedGoalKickMoveKicker highPass-override
      technique (7 forces accurate, 1 forces inaccurate for any die) for
      deterministic accuracy resolution without dice mocking"
    - "A single consistent GAME_STATE observer (clientA) is used for every state wait
      across a multi-step chained test, even on steps clientB emits, and any
      rejection check registers BOTH the GAME_ERROR listener AND the snap-back
      GAME_STATE listener before emitting — closes the stale-buffer race
      broadcastState's emit-to-both-clients-on-every-action (including errors)
      behavior otherwise creates when interleaving a rejection assertion with a
      subsequent successful multi-step flow in the same test"

key-files:
  created:
    - packages/server/src/__tests__/cornerKick.integration.test.ts
  modified: []

key-decisions:
  - "CORNER_KICK_TEAM constant is fixed to 'away' throughout every directly-seeded
    test in this file, matching exactly the real inversion OOB-03's own test proves
    (a home-byline exit after a home touch awards the corner to away) — keeps every
    seed helper's mental model consistent with the one real end-to-end trigger test"
  - "A High Pass corner (High or the corner's own High option) does NOT resolve its
    accuracy die on the initial GAME_ROLL — like any ordinary High Pass, it first
    enters the shared HIGH_PASS_MOVE repositioning window (attacker slot, then
    defender slot), and only the defender slot's End Turn actually rolls the
    accuracy die (gameHandlers.ts's HIGH_PASS_MOVE GAME_END_TURN branch). The two
    HIGH_PASS resolution tests drive this 2-slot window (zero moves, legal) via a
    dedicated driveHighPassMoveToResolution helper before asserting the terminal
    phase — this was not obvious from the plan's read_first list and required
    tracing gameHandlers.ts's GAME_ROLL PASS branch to find the early-return-into-
    HIGH_PASS_MOVE code path"
  - "The Low corner option (STANDARD_PASS with cornerKickTeam set) resolves its
    accuracy die immediately on GAME_ROLL, unlike High — it never enters a
    repositioning sub-phase, since ordinary STANDARD_PASS has none. Confirmed by
    tracing gameEngine.ts's applyRoll PASS case directly."
  - 'IN_BOX_TARGET/OUT_OF_BOX_15_HEX/OUT_OF_BOX_16_HEX distances from the fixed
    CORNER_HEX ({q:0,r:1}) are computed and asserted via the imported hexDistance
    function in the test bodies themselves (not just verified by hand in a comment),
    satisfying the plan''s explicit "distances computed with hexDistance in the test"
    acceptance criterion'

patterns-established:
  - "This file is now the reference example (alongside goalKick.integration.test.ts
    and throwIn.integration.test.ts) for testing a restart family's real
    out-of-bounds trigger via a retried real dice roll rather than mocking or
    directly seeding the post-trigger phase — useful for Phase 39's penalty-kick
    trigger tests"

requirements-completed: [OOB-03, CORNER-01, CORNER-02, CORNER-03, CORNER-04, CORNER-05, CORNER-06]

# Metrics
duration: ~50min
completed: 2026-08-07
---

# Phase 38 Plan 08: Corner Kick End-to-End Integration Tests Summary

**A 20-test socket-level integration suite (`cornerKick.integration.test.ts`) proves the entire Corner Kick chain — byline-exit trigger, both GK windows, taker selection, the 6-stage reposition window, the final pre-kick window, and High/Low kick resolution — is reachable end to end through the real registered socket handlers, with zero direct engine-function calls.**

## Performance

- **Duration:** ~50 min (includes a one-time `pnpm install` + `pnpm --filter @counter-attack/shared build` for the fresh worktree checkout)
- **Completed:** 2026-08-07
- **Tasks:** 2 completed
- **Files modified:** 1 (created)

## Accomplishments

- **OOB-03 (real trigger, not seeded):** `seedCornerKickLooseBall` + `driveLooseBallToCorner` seed a `LOOSE_BALL` state on the home byline edge with a home player recorded as the last toucher, then retry a real `GAME_ROLL` (crypto dice, never mocked) until the scatter exits the byline — proving `triggerOutOfBoundsRestart`'s `CORNER_KICK` branch and its team inversion (home-byline exit after a home touch → corner awarded to **away**) work through the real out-of-bounds pipeline. A sibling test confirms the `outOfBoundsEnabled` toggle-off path runs the pre-existing clamp behaviour instead (phase resolves to `PASS`, `cornerKickTeam` stays `null`).
- **CORNER-01 (GK reposition windows):** the attacking (away) socket can place its own GK during `CORNER_KICK_GK_SETUP_ATTACKING`; the defending (home) socket is rejected `WRONG_TEAM`; `GAME_END_TURN` advances `_ATTACKING → _DEFENDING → CORNER_KICK_TAKER_SELECT`, flipping `activeTeam` at each step.
- **CORNER-02 (taker selection):** `GAME_CORNER_KICK_TAKER` from away places the taker and the ball at the fixed corner hex and enters `CORNER_KICK_REPOSITION` at stage 0; the opposing team is rejected `WRONG_TEAM`.
- **CORNER-03 (6-stage reposition window):** one test drives all 6 alternating stages end to end via real `GAME_MOVE`/`GAME_END_TURN` emissions, asserting an out-of-turn `GAME_END_TURN` is rejected at **every** stage along the way and the window terminates in `CORNER_KICK_FINAL_SETUP`. Two dedicated tests prove the budget rules: a third distinct piece touched in one stage is rejected `STAGE_LIMIT_REACHED`, and a seventh cumulative hex on one piece is rejected `PACE_EXHAUSTED` (proving the per-piece 6-hex budget is a running total, not reset per stage).
- **CORNER-06 (final pre-kick window):** the defending team cannot move during the `ATTACKER` slot (`WRONG_TEAM`); the attacking team makes up to a 3-hex cumulative move, `GAME_END_TURN` flips to the `DEFENDER` slot, the defending team moves, and the second `GAME_END_TURN` reaches `PASS` with `lastActionType: 'CORNER_KICK_RESTART'` and the taker still holding the ball.
- **CORNER-04 (range override):** an in-box High Pass target beyond the ordinary 15-hex cap is accepted (unlimited range inside the byline owner's own penalty area); an out-of-box target at distance 16 is rejected `INVALID_TARGET` while distance 15 is accepted (the ordinary cap boundary); a dedicated regression test proves the unlimited-range override never applies outside an active corner context.
- **CORNER-05 (resolution):** an accurate High Pass corner (via `HIGH_PASS_MOVE`'s two-slot window, discovered mid-plan — see Decisions) ends in `HEADER`; an accurate Low Pass corner delivers without entering `HEADER`; an inaccurate corner of either type drops a `LOOSE_BALL`; every resolution asserts a `CORNER_KICK_ACCURACY` event in `eventLog` and `cornerKickTeam === null` (proving teardown); a dedicated contrast test proves a Low corner with a failing die does not deliver while an ordinary (non-corner) Standard Pass with the identical low `highPass` attribute always does — the corner-context accuracy gate is real and does not leak.
- Full three-package test suite green: **shared 665 / server 976 (1 skipped, 1 todo) / client 733**, no regressions.

## Task Commits

Both tasks were authored together as a single cohesive test file (Task 2 directly extends Task 1's seed helpers within the same file, per the plan's own instruction to build one shared helper set) and committed atomically as one commit:

1. **Task 1 (end-to-end socket sequence) + Task 2 (kick resolution)** — `356a60c` (test)

_Note: no plan-metadata commit is created by a worktree-isolated executor — the orchestrator handles final metadata commits after merge._

## Files Created/Modified

- `packages/server/src/__tests__/cornerKick.integration.test.ts` (new) — 20 socket-level integration tests across 7 `describe` groups (`OOB-03`, `CORNER-01`, `CORNER-02`, `CORNER-03`, `CORNER-06`, `CORNER-04`, `CORNER-05`), plus supporting seed helpers (`seedCornerKickLooseBall`, `driveLooseBallToCorner`, `seedCornerKickGkSetup`, `seedCornerKickTakerSelect`, `seedCornerKickReposition`, `seedCornerKickFinalSetup`, `fastForwardToCornerPass`, `driveHighPassMoveToResolution`, `seedOrdinaryPassState`, `seedOrdinaryHighPassState`).

## Decisions Made

See frontmatter `key-decisions` for the full list. Highlights:

- `CORNER_KICK_TEAM = 'away'` is used consistently across every directly-seeded test, matching the real inversion the OOB-03 trigger test independently proves.
- A High Pass corner does not resolve its accuracy die immediately — it enters the shared `HIGH_PASS_MOVE` repositioning window first (attacker slot, then defender slot), and only the defender slot's End Turn actually rolls the die. This was discovered by tracing `gameHandlers.ts`'s `GAME_ROLL` handler after the first version of the HEADER/LOOSE_BALL resolution tests failed (`HIGH_PASS_MOVE` instead of `HEADER`/`LOOSE_BALL`) — see Issues Encountered.
- Every seed helper parks all non-test-subject pieces (including both GKs) in the pitch's middle third, never a final third — required because a corner's taker hex and its PASS-phase resolution both sit inside a final third, and `applyFreeMoveZoneCheck` (run on every `broadcastState` call) is not exempted for `PASS`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two seed helpers initially left default-formation goalkeepers (or unparked pieces) inside their own final third, spuriously triggering `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`**

- **Found during:** first full test run — 8 of 20 tests failed with the resolved phase being `FREE_MOVE_DEFENSE`/`FREE_MOVE_ATTACK` instead of the expected `PASS`/corner phase.
- **Issue:** `seedCornerKickLooseBall` (used by the `outOfBoundsEnabled: false` test) did not park any background pieces at all — every piece stayed at its real 4-4-2 formation position, meaning both teams had occupants in both final thirds. `fastForwardToCornerPass` kept both goalkeepers at their real formation positions (a specific `keepIds` choice, since GK placement is meaningfully tested elsewhere in the file). Once the corner resolves into `PASS` — a phase `gameEngine.ts`'s `ZONE_CHECK_EXEMPT_PHASES` does NOT cover — `applyFreeMoveZoneCheck` (run centrally by `broadcastState` on every action) saw the ball in a final third with the opposite final third occupied and overlaid `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`, silently hijacking every resolution test.
- **Fix:** `seedCornerKickLooseBall` now parks every piece via `parkBackgroundPieces` (middle third, mirrors `goalKick.integration.test.ts`'s established convention). `fastForwardToCornerPass` no longer keeps either GK in `keepIds` — both are parked to the middle third alongside every other non-test-subject piece.
- **Files modified:** `packages/server/src/__tests__/cornerKick.integration.test.ts` (test-file-only fix, no production code touched)
- **Verification:** all 20 tests pass; full three-package suite green with no regressions.
- **Committed in:** `356a60c` (single commit — the fix was applied before the first commit was made, so it is not separately visible in history)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug, test-file-only, no production code impact).
**Impact on plan:** Necessary for the test suite to actually exercise the intended phases rather than being silently hijacked by a pre-existing, unrelated centralized interrupt. No scope creep — the fix is entirely within this plan's own new test file.

## Issues Encountered

- The two HIGH_PASS resolution tests (`accurate` / `inaccurate` High Pass corner) initially asserted the terminal phase immediately after the first `GAME_ROLL('HIGH_PASS', ...)` emission, expecting `HEADER`/`LOOSE_BALL` directly. Both failed with `phase: 'HIGH_PASS_MOVE'` — tracing `gameHandlers.ts`'s `GAME_ROLL` handler showed that `HIGH_PASS` (ordinary or corner) always enters a two-slot repositioning window (`HIGH_PASS_MOVE`) before its accuracy die is rolled; the die only rolls on the **defender slot's** `GAME_END_TURN`. Added a `driveHighPassMoveToResolution` helper (two zero-move `GAME_END_TURN`s, attacker then defender) and updated both tests to drive it before asserting the terminal phase. Not a plan gap — this mechanic is documented in `gameEngine.ts`/`gameHandlers.ts` and the Low-pass path correctly has no such window (confirmed by tracing `applyRoll`'s PASS case directly), so only the two HIGH_PASS tests needed the fix.
- `pnpm install` + `pnpm --filter @counter-attack/shared build` was required once for the fresh worktree checkout (no `node_modules` present) — a one-time setup cost, not a plan deviation, matching the same cost documented in 38-06/38-07's summaries.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The full Corner Kick chain (trigger, GK windows, taker selection, reposition, final setup, High/Low resolution) is now proven reachable end to end through the real socket layer, closing the phase's stated objective.
- Every row of `38-VALIDATION.md`'s Per-Task Verification Map now has a corresponding end-to-end assertion in this file (OOB-03, CORNER-01 through CORNER-06), in addition to the unit-level coverage already delivered by `gameEngine.cornerKick.test.ts`, `offside.test.ts`, and `gameHandlers.cornerKick.test.ts` (Plans 38-02 through 38-05).
- `pnpm --filter @counter-attack/server build` and the full three-package test suite (shared 665, server 976, client 733) are green — no regressions in goal-kick, free-kick, throw-in, or any pre-existing pass-type flow.
- No blockers for Plan 38-09 (the phase's final human-verify/UAT checkpoint, if scheduled) — this plan's own scope is complete and self-contained.

## Known Stubs

None — every test in this file exercises real, already-implemented server behavior; no placeholder/mock data paths were introduced.

## Threat Flags

None — this plan's own threat model (T-38-29, T-38-30, T-38-31, T-38-SC) was addressed exactly as scoped: T-38-29 (out-of-turn action acceptance) is closed by the out-of-turn assertions embedded in the 6-stage walk test and the two dedicated `WRONG_TEAM` tests; T-38-30 (budget/range bypass reachable only end to end) is closed by the `STAGE_LIMIT_REACHED`/`PACE_EXHAUSTED`/distance-16 rejection tests, each exercised through the real handler chain; T-38-31 (feature reachable with the toggle off) is closed by the dedicated `outOfBoundsEnabled: false` test plus the CORNER-04 toggle/context regression test. No new network endpoints, schema changes, or trust-boundary shifts — this plan adds test coverage only, no production code.

## Self-Check: PASSED

- FOUND: packages/server/src/**tests**/cornerKick.integration.test.ts
- FOUND: commit 356a60c

---

_Phase: 38-corner-kick_
_Completed: 2026-08-07_
