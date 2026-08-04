---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: '09'
subsystem: game-engine
tags: [typescript, vitest, gameEngine, gameHandlers, goal-kick, socket.io, header, loose-ball]

# Dependency graph
requires:
  - phase: 37-08
    provides: 'applyGoalKickChoice (kick branch leaves phase=GOAL_KICK_TARGET with goalKickTeam/goalKickGkId populated and the ball still carried by the GK) plus the two reposition windows (GOAL_KICK_SETUP_GK/OPPONENT) and GAME_GOAL_KICK_CHOICE handler this plan regression-tests at the socket level'
  - phase: 37-04
    provides: 'triggerOutOfBoundsRestart, the out-of-bounds-aware LOOSE_BALL clamp this plan reuses unmodified for the inaccurate-kick branch'
  - phase: 37-02
    provides: 'GOAL_KICK_TARGET/GOAL_KICK_MOVE GamePhase values and every goalKick* GameState field this plan consumes'
provides:
  - 'applyGoalKickTarget(state, targetHex) — GOALKICK-05 target-selection: rejects anything that is not an outfield teammate of the goalkeeper standing exactly on the target hex, transitions GOAL_KICK_TARGET -> GOAL_KICK_MOVE with the ball airborne (carrierId: null)'
  - 'applyGoalKickMoveEnd(state, kickDie) — owns both halves of the GOAL_KICK_MOVE travel window: KICKER->OPP slot handoff, then the accuracy roll (computeCombinedScore, GOALKICK-03 threshold >= 8) routing an accurate kick into HEADER (copying the HIGH_PASS->HEADER eligibility check verbatim) or LOOSE_BALL, and an inaccurate kick always into LOOSE_BALL'
  - 'GAME_GOAL_KICK_TARGET socket handler + the GOAL_KICK_MOVE branches of GAME_MOVE (validateResponseMoveStep, paceCap 3, strict-1 adjacency) and GAME_END_TURN (die generation + delegate)'
  - 'packages/server/src/__tests__/goalKick.integration.test.ts — the last outstanding Wave 0 gap in 37-VALIDATION.md (GOALKICK-01..06, T-37-01), closing socket-level coverage for the full goal-kick sequence including Plan 37-08 regression proof'
affects: [38]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "applyGoalKickTarget/applyGoalKickMoveEnd structurally mirror applyGKKickTarget/GK_KICK_MOVE's shape (phase-guard, GK lookup, isPitchHex/own-hex checks, KICKER->OPP handoff, computeCombinedScore accuracy) without calling into either — D-01 structural-mirror-not-reuse, verified by grep in Task 1/2's acceptance criteria"
    - "Integration-test background/parking pieces must avoid BOTH final thirds (q<=10 / q>=26), not just the specific hexes a test cares about — applyFreeMoveZoneCheck runs centrally in broadcastState after every resolved action and will overlay FREE_MOVE_ATTACK/DEFENSE the instant the ball enters a final third with any occupant in the opposite third, silently hijacking an unrelated phase transition under test. Recorded here so Phase 38's corner-kick integration tests don't rediscover this the hard way."
    - "Multi-actor socket-level tests (client A acts, then client B acts) must listen for the resulting GAME_STATE on the SAME client throughout a sequence (mirrors driveMovementPhaseToEnd's documented stale-buffer guidance) — broadcastState sends to every socket in the room, so listening on the second actor's own socket risks catching the first action's still-in-flight broadcast instead of the second action's."

key-files:
  created:
    - packages/server/src/__tests__/goalKick.integration.test.ts
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts

key-decisions:
  - "No opponent-final-third restriction was imported from applyGKKickTarget. GOALKICK-05 is enforced purely by the teammate-occupancy rule (target hex must hold an outfield teammate of the GK); there is no additional 'not into the opponent's final third' guard because GOALKICK-01..06 gives no basis for one and D-01 forbids importing GK-punt-specific rules into the structurally-independent goal kick."
  - "evaluateOffside is applied to every applyGoalKickMoveEnd return (KICKER->OPP handoff AND both OPP-slot resolution branches), computed once per call and spread into every return — mirrors applyEndTurn/applyGoalKickWindowEnd's contract, since pieces may have repositioned during either travel-movement slot."
  - "Deterministic-accuracy fixture values for reuse: goalkeeper highPass: 7 forces accurate === true for any die (7 + 1..6 always >= 8); highPass: 1 forces accurate === false for any die (1 + 1..6 always <= 7, below the GOALKICK-03 threshold of 8). Phase 38's corner-kick tests can reuse this exact trick — see computeCombinedScore(highPass, die, []) in scoreUtils.ts."
  - 'ballAfter.carrierId is null on both applyGoalKickMoveEnd resolution branches (accurate and inaccurate) — diverges deliberately from the GK_KICK/GK_KICK_MOVE analog, where an accurate punt is caught by a receiver. An accurate goal kick lands in a mandatory HEADER contest, so nobody carries the ball at resolution time.'
  - "Task 3 integration-test background/parking pieces are placed in the MIDDLE third (q=12 home / q=13 away) rather than the final-third columns (q=2/34) throwIn.integration.test.ts's seedThrowContextState uses — parking in a final third spuriously triggered applyFreeMoveZoneCheck's FREE_MOVE_ATTACK/DEFENSE overlay on the LOOSE_BALL/HEADER resolution transitions under test (see Deviations)."

requirements-completed: [GOALKICK-04, GOALKICK-05]

# Metrics
duration: ~50min (Tasks 1-2 completed in a prior session; this session covered Task 3 only, ~35min)
completed: 2026-08-04
---

# Phase 37 Plan 09: Goal Kick — Target Selection, Travel Movement & Accuracy Resolution Summary

**Target-selection (GOALKICK-05 "teammate's head" rule), the two-team 3-hex travel-movement window, and the accuracy roll routing an accurate kick into a mandatory HEADER contest or an inaccurate kick into the existing out-of-bounds-aware Loose Ball path — completed with 25 new socket-level integration tests closing the phase's last outstanding Wave 0 gap.**

## Performance

- **Duration:** ~50 min total across two sessions (Tasks 1-2 in a prior session terminated by a provider usage limit; Task 3 completed in this continuation session, ~35 min)
- **Tasks:** 3
- **Files modified:** 4 (2 source, 2 test files — 1 extended, 1 created)

## Accomplishments

- `applyGoalKickTarget(state, targetHex)` exported from `gameEngine.ts`: enforces GOALKICK-05's "the Kick targets a teammate's head" rule by rejecting any target hex that is not occupied by an outfield teammate of the goalkeeper (`goalKickGkId`-derived, never `ball.carrierId`, per D-01). On success, transitions `GOAL_KICK_TARGET` → `GOAL_KICK_MOVE` with the ball airborne (`carrierId: null`) at the target hex and the travel window opened in the `KICKER` slot.
- `applyGoalKickMoveEnd(state, kickDie)` exported from `gameEngine.ts`: owns both halves of the `GOAL_KICK_MOVE` travel window as a single pure, dice-injected function (ARCH-01 compliant — never calls `rollDice()`/`Math.random()`). The `KICKER` slot hands off to `OPP` (activeTeam flips to the non-kicking team); the `OPP` slot resolves accuracy via `computeCombinedScore(gk.highPass, kickDie, [])` against the GOALKICK-03 threshold of 8, routing an accurate kick with an eligible header contestant into `HEADER` (copying the `HIGH_PASS`→`HEADER` eligibility check verbatim), an accurate kick with no eligible contestant into `LOOSE_BALL`, and an inaccurate kick always into `LOOSE_BALL` (GOALKICK-04) — which then scatters through `applyRoll`'s existing out-of-bounds-aware clamp (Plan 37-04) with zero extra code.
- `GAME_GOAL_KICK_TARGET` socket handler registered in `gameHandlers.ts`: mutex → phase guard → ASVS V5 payload-shape guard → team guard (comparing `socketTeam(socket)` against server-owned `goalKickTeam`, deliberately not `controlsGKTeam`) → delegate → single broadcast.
- `GOAL_KICK_MOVE` branches added to both `GAME_MOVE` (delegates to `validateResponseMoveStep` with `paceCap: 3`, `clickDistanceMode: 'strict-1'`, locked via `goalKickMovedPieceId`) and `GAME_END_TURN` (generates the die via `rollDice()` in the handler, then delegates the whole resolution to `applyGoalKickMoveEnd`).
- `packages/server/src/__tests__/goalKick.integration.test.ts` created: 25 socket-level tests (real Socket.io server + `socket.io-client`, zero `vi.mock`) covering the full goal-kick sequence end to end — reposition windows and choice (regression proof for Plan 37-08), the unmodified 11-hex Standard Pass branch (GOALKICK-04, no throw-in cap leakage), target selection (GOALKICK-05, every rejection reason plus the mutex-proof double-emission case), the travel-movement window (WRONG_PIECE/NOT_ADJACENT/PACE_EXCEEDED/WRONG_TEAM), and both accuracy resolution branches plus the post-resolution Loose Ball scatter continuation.
- Full server suite: 761 tests passing (1 skipped, 1 todo), up from the 719 baseline recorded at the close of Plan 37-08. Monorepo typecheck (`pnpm -r typecheck`) clean across shared/server/client.

## Task Commits

1. **Task 1: applyGoalKickTarget + GAME_GOAL_KICK_TARGET handler** - `83acd58` (feat) — completed in the prior session
2. **Task 2: applyGoalKickMoveEnd + GOAL_KICK_MOVE branches in GAME_MOVE/GAME_END_TURN** - `28d430a` (feat) — completed in the prior session
3. **Task 3: Wave 0 goalKick.integration.test.ts** - `a059e6a` (test) — completed in this continuation session

_Note: Tasks 1 and 2 were completed and committed in a prior executor session that was terminated early by a provider session/usage limit. This continuation session verified those commits were present and intact on `worktree-agent-a0c71bc8fc729d3f2` before proceeding to Task 3._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — `applyGoalKickTarget` + `ApplyGoalKickTargetResult` (Task 1, after `applyGoalKickChoice`); `applyGoalKickMoveEnd` + `ApplyGoalKickMoveEndResult` (Task 2, after `applyGoalKickTarget`)
- `packages/server/src/gameHandlers.ts` — `GAME_GOAL_KICK_TARGET` handler (Task 1, after `GAME_GOAL_KICK_CHOICE`); `GOAL_KICK_MOVE` branches in `GAME_MOVE` (after `GK_KICK_MOVE`) and `GAME_END_TURN` (after `GK_KICK_MOVE`) (Task 2); `ResponseMoveConfig`'s `lockedPieceIdKey`/`paceUsedKey` unions widened with `'goalKickMovedPieceId'`/`'goalKickPaceUsed'` (Task 2)
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` — `describe('applyGoalKickTarget')` (Task 1) and `describe('applyGoalKickMoveEnd')` (Task 2) engine-level test blocks, plus supporting fixtures (`goalKickTargetState`, `goalKickMoveKickerState`, `oppTargetHex`, `teammateAtTarget`, `makeGoalKickMoveOppState`)
- `packages/server/src/__tests__/goalKick.integration.test.ts` (created, Task 3) — 25 socket-level integration tests plus 5 seed helpers (`seedGoalKickSetupGk`, `seedGoalKickChoice`, `seedGoalKickRestart`, `seedGoalKickTarget`, `seedGoalKickMoveKicker`) and the shared `parkBackgroundPieces` utility

## Decisions Made

- **No opponent-final-third restriction imported from `applyGKKickTarget`.** The GK-punt analog forbids punting into the opponent's final third; GOALKICK-01..06 gives no such basis for the goal kick, and D-01 requires structural independence from that chain. The only binding constraint on the target is the teammate-occupancy rule. Recorded explicitly per this plan's `<output>` instruction so Phase 38 does not "restore" it by analogy.
- **`evaluateOffside` applied to all three `applyGoalKickMoveEnd` returns** (the `KICKER`→`OPP` handoff and both `OPP`-slot resolution branches) — computed once per call, spread into every return, mirroring `applyEndTurn`/`applyGoalKickWindowEnd`'s established contract, since pieces may have repositioned during either travel-movement slot.
- **Deterministic-accuracy fixture values, recorded for Phase 38 reuse:** goalkeeper `highPass: 7` forces `accurate === true` for any die (7 + 1..6 is always >= 8); `highPass: 1` forces `accurate === false` for any die (1 + 1..6 is always <= 7, below the GOALKICK-03 threshold of 8).
- **`ballAfter.carrierId` is `null` on both resolution branches** (accurate and inaccurate) — deliberately diverges from the `GK_KICK`/`GK_KICK_MOVE` analog (an accurate punt is caught by a receiver); an accurate goal kick lands in a mandatory `HEADER` contest, so nobody carries the ball at resolution time.
- **Task 3's wire-value assertion for the 6-hex reposition-budget rejection uses `'MOVE_INVALID'`, not `'GOAL_KICK_PACE_EXHAUSTED'`.** `applyGoalKickReposition` (Plan 37-08) returns `{ reason: 'MOVE_INVALID', detail: 'GOAL_KICK_PACE_EXHAUSTED' }`, but the `GAME_MOVE` handler's `GOAL_KICK_SETUP_GK`/`OPPONENT` branch emits `result.reason` over the wire, not `result.detail` — identical to the pre-existing `FREE_MOVE_ATTACK`/`DEFENSE` branch's behavior. This is not a regression introduced by this plan; the test asserts the actual wire value with an inline comment explaining the divergence from the plan text's descriptive language.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in test authoring, caught before commit] Background/parking pieces in the integration test spuriously triggered `FREE_MOVE_ATTACK`/`DEFENSE`**

- **Found during:** Task 3, while iterating the new integration test file against the live server
- **Issue:** The first draft of `goalKick.integration.test.ts` parked non-participant pieces at `q=2` (home) / `q=34` (away) — the exact convention `throwIn.integration.test.ts`'s `seedThrowContextState` uses. Those columns sit inside `homeThird`/`awayThird` respectively. `applyFreeMoveZoneCheck` (MOVE-06) runs centrally in `broadcastState` after every resolved action and overlays `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` the instant the ball's zone changes into a final third AND the opposite final third has any occupant. Because the goal kick's target/travel hexes routinely land inside a final third, the parked away-team pieces at `q=34` were detected as eligible occupants of the opposite third, hijacking the `LOOSE_BALL`/`HEADER` resolution transitions under test — 3 of the 25 tests initially failed with `phase === 'FREE_MOVE_DEFENSE'` instead of the expected resolution phase.
- **Fix:** Moved the background-parking column to the MIDDLE third (`q=12` home / `q=13` away — both inside `PITCH_REGIONS`' `[11,25]` band, and clear of the `q=18..29` Standard-Pass corridor used by the "Standard Pass unmodified" test group), where `applyFreeMoveZoneCheck`'s opposite-third occupant search always finds nobody, so it correctly no-ops.
- **Files modified:** `packages/server/src/__tests__/goalKick.integration.test.ts` only (test-file-local fix, no engine/handler change — the zone-check behavior itself is correct and pre-existing).
- **Verification:** All 25 tests pass; full server suite (761 tests) green; documented as a `tech-stack.patterns` entry above so Phase 38's corner-kick integration tests don't rediscover this.
- **Commit:** part of `a059e6a` (Task 3's only commit — caught during iteration before the commit, not a follow-up fix).

**2. [Rule 1 - Bug in test authoring, caught before commit] Stale-buffer race in multi-actor GAME_STATE assertions**

- **Found during:** Task 3, same iteration pass
- **Issue:** Several tests have client A act, then immediately have client B act and listen for the resulting `GAME_STATE` on client B's own socket. Since `broadcastState` emits to every socket in the room, client B's socket had already received (but nobody was listening for) the broadcast from client A's prior action. Listening on client B immediately afterward risked catching that still-in-flight/queued broadcast instead of the one produced by client B's own action — 1 test failed this way outright (asserted phase stuck at the pre-second-action value with no error), matching the documented stale-buffer failure mode `throwIn.integration.test.ts`'s `driveMovementPhaseToEnd` helper comment already warns about.
- **Fix:** Changed every multi-actor assertion to listen for the resulting `GAME_STATE` on client A throughout the sequence (regardless of which client is actually emitting the action), matching the established `driveMovementPhaseToEnd` convention.
- **Files modified:** `packages/server/src/__tests__/goalKick.integration.test.ts` only.
- **Verification:** All 25 tests pass; re-run confirmed deterministic (no flakiness across repeated runs).
- **Commit:** part of `a059e6a`.

## Issues Encountered

- The `git log --oneline -5` continuity check at session start confirmed `28d430a` and `83acd58` were present and intact on the worktree branch before any Task 3 work began, per the continuation protocol.
- No package installs were required for this plan (T-37-SC: not applicable).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 37's goal-kick flow is now fully wired end to end: reposition windows → choice → (kick: target selection → travel movement → accuracy resolution → HEADER/LOOSE_BALL) or (standard: unmodified Standard Pass). No further plan work is needed to make either branch playable.
- The `highPass: 7` / `highPass: 1` deterministic-accuracy fixture trick (recorded in `key-decisions` above) is available for Phase 38's corner-kick tests to reuse verbatim via the same `computeCombinedScore(attribute, die, [])` mechanism.
- The middle-third background-parking convention (`q=12`/`q=13`, documented in `tech-stack.patterns`) should be the default for any future Phase 37/38 integration test that seeds a restart phase whose target/travel hexes may land inside a final third — parking at the final-third columns `throwIn.integration.test.ts` uses is only safe when the restart's own geometry never touches a final third.
- Total test count for regression tracking: **server 761 tests (1 skipped, 1 todo)** — up from the 719 baseline recorded at the close of Plan 37-08.

## Threat Flags

None. This plan's threat model (T-37-39 through T-37-45, T-37-SC) was addressed exactly as specified: T-37-39 (spoofing the target-selector) is closed by the `goalKickTeam` team guard plus `applyGoalKickTarget`'s independent `goalKickGkId` resolution. T-37-40 (malformed/off-pitch target) is closed by the ASVS V5 payload-shape guard plus the `isPitchHex` guard inside the engine function. T-37-41 (dodging the mandatory header via an empty-hex target) is closed by the teammate-occupancy requirement — verified directly by this plan's Task 3 integration tests (empty/opposing/own-hex targets all rejected). T-37-42/T-37-43 (spoofing or over-budgeting the travel-movement window) are closed by `validateResponseMoveStep`'s team/lock/pace/adjacency guards, identical to the pre-existing `GK_KICK_MOVE` analog. T-37-44 (forcing a favorable accuracy result) is closed by server-side `rollDice()` generation plus `computeCombinedScore`'s DICE-04 clamp. T-37-45 (rapid double-click) is closed by the `room.isProcessing` mutex on the new `GAME_GOAL_KICK_TARGET` handler, released in `finally` — verified by this plan's mutex-proof integration test. No packages were installed (T-37-SC).

## Known Stubs

None. Every artifact this plan's `must_haves` section requires is fully wired and tested: `applyGoalKickTarget` and `applyGoalKickMoveEnd` are exported from `gameEngine.ts` with dedicated engine-level test coverage (Tasks 1-2, prior session); the `GAME_GOAL_KICK_TARGET` handler and both `GOAL_KICK_MOVE` phase branches are live in `gameHandlers.ts`; and `goalKick.integration.test.ts` closes the last outstanding Wave 0 socket-level gap for GOALKICK-01..06 (Task 3, this session).

---

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts (applyGoalKickTarget, applyGoalKickMoveEnd both present and exported)
- FOUND: packages/server/src/gameHandlers.ts (GAME_GOAL_KICK_TARGET handler; GOAL_KICK_MOVE branches in GAME_MOVE and GAME_END_TURN)
- FOUND: packages/server/src/**tests**/gameEngine.outOfBounds.test.ts (describe('applyGoalKickTarget') and describe('applyGoalKickMoveEnd') blocks present)
- FOUND: packages/server/src/**tests**/goalKick.integration.test.ts (25 tests present, all passing)
- FOUND: 83acd58 (feat: Task 1)
- FOUND: 28d430a (feat: Task 2)
- FOUND: a059e6a (test: Task 3)
- VERIFIED: `pnpm --filter @counter-attack/server test` exits 0 — 761 passed, 1 skipped, 1 todo
- VERIFIED: `pnpm --filter @counter-attack/server test -- goalKick.integration` exits 0 — 25/25 passed
- VERIFIED: `pnpm -r typecheck` exits 0 clean across shared/server/client
- VERIFIED: `git status --short` clean on `worktree-agent-a0c71bc8fc729d3f2` after Task 3's commit
- VERIFIED: acceptance-criteria greps for Task 3 (it-count >= 20, zero vi.mock, highPass: 7/1 present, GOALKICK-04 present >= 2x, zero toMatchSnapshot, real buildServer/ioClient usage) all pass

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Plan: 09_
_Completed: 2026-08-04_
