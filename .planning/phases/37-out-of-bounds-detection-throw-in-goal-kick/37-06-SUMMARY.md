---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 06
subsystem: game-engine
tags: [typescript, vitest, gameHandlers, throw-in, out-of-bounds, socket.io, integration-test]

# Dependency graph
requires:
  - phase: 37-05
    provides: 'applyThrowInPlace + the applyEndTurn throw-in movement-counting branch producing THROW_IN_MOVEMENT_1/2 lastActionType rows'
  - phase: 37-02
    provides: 'validatePass options.maxDistance parameter and the THROW_IN_MOVEMENT_1/2 ELIGIBLE_NEXT_ACTIONS rows'
  - phase: 37-04
    provides: 'triggerOutOfBoundsRestart producing a fully-formed THROW_IN_SETUP state from a LOOSE_BALL sideline exit'
provides:
  - 'THROW_IN_MAX_DISTANCE (6) + isThrowInContext predicate in gameHandlers.ts, applied at 4 sites in the GAME_ROLL PASS/KICK_OFF branch: defence-in-depth pass-type restriction, off-pitch guard (OFF_PITCH), validatePass maxDistance override, and throw-in context teardown at commit'
  - 'packages/server/src/__tests__/throwIn.integration.test.ts — Wave 0 socket-level coverage of the full throw-in sequence (placement, mandatory Movement Phase 1, the three-way choice, the 6-hex throw, reclassification)'
affects: [37-07, 37-08, 37-09, 37-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'isThrowInContext(lastActionType) is the single greppable predicate for "are we inside a throw-in Movement-Phase-1-completed window" — called 4 times (pass-type restriction, off-pitch guard, validatePass maxDistance arg, pre-commit wasThrowIn capture) plus its own declaration'
    - 'Context teardown captures wasThrowIn BEFORE the lastActionType commit overwrites it with the chosen passType, then conditionally spreads throwInHex/throwInTeam/throwInPhasesTaken:null into the SAME commit object — teardown happens atomically with the throw, before the HIGH_PASS repositioning detour'
    - 'Socket-integration test for a dice-dependent server-side branch (crypto.randomInt, no DI, vi.mock forbidden): seed the exact pre-exit state, retry the real GAME_ROLL emit in a bounded loop until the branch fires, derived from a closed-form geometric analysis of computeLooseBall (3 of 6 directions exit a touchline-adjacent hex regardless of the distance die) rather than asserting on any single roll'

key-files:
  created:
    - packages/server/src/__tests__/throwIn.integration.test.ts
  modified:
    - packages/server/src/gameHandlers.ts

key-decisions:
  - 'Context teardown is merged into the existing `lastActionType: passType` commit object (one spread, one statement) rather than a second `room.gameState = {...}` assignment — matches the plan’s "before the HIGH_PASS block" requirement trivially since there is only one commit point'
  - 'The reclassification test does not mock dice. Instead it place the ball directly on the touchline row (r:0) at q=18 (pitch-centre column) and retries a real GAME_ROLL emit in a bounded loop (60 attempts) until the random direction die lands on one of the 3 directions (NE/NW/SW) that provably exit the pitch at step 1 regardless of the distance die — derived from computeLooseBall’s toCube/fromCube arithmetic, cross-checked against the existing gameEngine.outOfBounds.test.ts fixture family. Failure probability after 60 attempts is ~2^-60'
  - "GAME_START_MOVEMENT rejecting a third Movement Phase from THROW_IN_MOVEMENT_2 required NO handler change — the existing D-07/T-08-12 ELIGIBLE_NEXT_ACTIONS[lastActionType].has('MOVEMENT') guard (pre-dating this plan) already enforces it, because THROW_IN_MOVEMENT_2’s eligible-next-actions set (added in Plan 37-02) omits 'MOVEMENT'. The test passes against unmodified code, confirming no handler-level gap exists."

requirements-completed: [THROWIN-01, THROWIN-04, THROWIN-05]

# Metrics
duration: ~25min
completed: 2026-08-03
---

# Phase 37 Plan 06: The Throw — 6-Hex Cap, Context Teardown & Reclassification Summary

**A server-side 6-hex distance cap and off-pitch guard on the throw-in's Low/High delivery, reusing the unmodified Standard-Pass/High-Pass-to-Header mechanics verbatim, plus 15 new socket-level integration tests proving an overthrown throw is reclassified by the existing out-of-bounds detection system with zero special-casing.**

## Performance

- **Duration:** ~25 min (1940873 to 5a9ae69)
- **Started:** 2026-08-03T22:05:00Z (approx, after context load)
- **Completed:** 2026-08-03T22:16:33Z
- **Tasks:** 2
- **Files modified:** 2 (1 source, 1 new test file)

## Accomplishments

- `THROW_IN_MAX_DISTANCE = 6` constant and `isThrowInContext(lastActionType)` predicate added to `gameHandlers.ts`, used at exactly 4 call sites in the `GAME_ROLL` `PASS`/`KICK_OFF` branch (verified by acceptance-criteria grep count of 5: declaration + 4 uses)
- Defence-in-depth pass-type restriction: during a throw-in, a `passType` other than `STANDARD_PASS`/`HIGH_PASS` is rejected with `INVALID_SEQUENCE`, backing up the `ELIGIBLE_NEXT_ACTIONS[THROW_IN_MOVEMENT_*]` sets from Plan 37-02
- Off-pitch guard (`OFF_PITCH`) added in the handler layer only — `validatePass` remains byte-for-byte unchanged for all four existing pass types, per RESEARCH.md Assumption A4 / Open Question 1
- `validatePass` now receives `{ maxDistance: THROW_IN_MAX_DISTANCE }` when in a throw-in context (using the `options` parameter added in Plan 37-02); the 6-hex cap is proven context-scoped, not a global regression, by a test asserting the identical 7-hex target IS accepted under a normal `MOVEMENT_PHASE` context
- Throw-in context (`throwInHex`/`throwInTeam`/`throwInPhasesTaken`) is torn down atomically with the throw commit — captured as `wasThrowIn` before the `lastActionType` overwrite, then conditionally nulled in the same spread, before the `HIGH_PASS` repositioning detour, so it applies to both Low and High throws
- `packages/server/src/__tests__/throwIn.integration.test.ts` created: 15 tests across placement (THROWIN-02), Movement-Phase sequencing (THROWIN-03/D-09), the throw itself (THROWIN-04), and reclassification (THROWIN-05/D-04) — all against a real Socket.io server + `socket.io-client`, zero mocking
- Full server suite: 697 tests passing (+15 from this plan's baseline of 682), 1 skipped, 1 todo; full monorepo (`pnpm -r typecheck`) clean; `git diff packages/server/src/gameEngine.ts` empty for this plan, confirming `applyRoll`'s `PASS` branch was never touched

## Task Commits

1. **Task 1: Cap the throw at 6 hexes and tear down the throw-in context on commit** - `1940873` (feat)
2. **Task 2: Wave 0 — throwIn.integration.test.ts** - `5a9ae69` (test)

## Files Created/Modified

- `packages/server/src/gameHandlers.ts` — `THROW_IN_MAX_DISTANCE`/`isThrowInContext` module constants; `isPitchHex` and `LastActionType` added to imports; 4 new guard/argument sites in the `GAME_ROLL` `PASS`/`KICK_OFF` branch (pass-type restriction, off-pitch guard, `validatePass` `maxDistance` arg, context teardown at commit)
- `packages/server/src/__tests__/throwIn.integration.test.ts` (new) — full socket-level throw-in test suite: server lifecycle boilerplate (mirrors `kickoffSetup.integration.test.ts`), `seedThrowInSetup`/`seedThrowContextState`/`seedLooseBallForReclassification` direct-mutation seed helpers (mirrors `gameHandlers.phase17-06.test.ts`'s `seedFreeKickSetup`), a `waitForNStates` helper for the double-click idempotency test, and a `driveMovementPhaseToEnd` helper for the 4-5-2 sequence

## Decisions Made

- Reused the exact commit statement for both the `lastActionType: passType` write and the conditional throw-in-context clear — one spread expression rather than two sequential `room.gameState = {...}` assignments, since both mutations are logically part of "committing the throw"
- The pitch-boundary guard and pass-type restriction both re-evaluate `isThrowInContext(room.gameState.lastActionType)` independently at their own call sites rather than caching a single boolean, matching the plan's explicit instruction that each of the 4 numbered guard sites call the predicate directly (only the teardown site — which runs after the value would otherwise be destroyed by the commit — uses the earlier-captured `wasThrowIn`)
- Test-file dice-randomness strategy: rather than skip or weaken the reclassification assertion (the plan's Required Case), derived the exact 3-of-6-directions-always-exit geometry from `computeLooseBall`'s cube-coordinate math (confirmed against the existing `gameEngine.outOfBounds.test.ts` fixture family at a neighbouring row) and used a bounded retry loop — the same `while (...) { ...; guard < N }` pattern already established in `draftSession.integration.test.ts` for other non-deterministic multi-step flows

## Deviations from Plan

None — plan executed exactly as written across both tasks. Task 1's four guard-site insertions match the plan's numbered list verbatim; Task 2's test file covers every "Required case" bullet in the plan (Placement, Movement-phase sequencing, The throw, Reclassification) with at least one test each, several with two (distance-cap accept/reject pair; MOVEMENT_PHASE regression check).

One clarifying note for the plan's `<output>` request: **the `GAME_START_MOVEMENT` handler did NOT need its own new `ELIGIBLE_NEXT_ACTIONS` gate to satisfy the "no third Movement Phase" test.** The handler's existing D-07/T-08-12 guard (`ELIGIBLE_NEXT_ACTIONS[lastActionType].has('MOVEMENT')`, pre-dating this plan) already enforces the cap, because Plan 37-02 already omitted `'MOVEMENT'` from `THROW_IN_MOVEMENT_2`'s eligible-next-actions set. The test (`T-37-20: GAME_START_MOVEMENT from THROW_IN_MOVEMENT_2 is rejected`) passes against completely unmodified `gameHandlers.ts` logic, confirming no handler-level gap existed — this is exactly the "if the handler's own guard permits it, fix the handler" contingency the plan described, except the contingency never triggered.

## Issues Encountered

- `node_modules`/`packages/shared/dist` were absent at session start (same pre-existing worktree-bootstrap gap noted in Plans 37-01 through 37-05) — resolved with `pnpm install --frozen-lockfile` followed by `pnpm --filter @counter-attack/shared build` before any task work began. Not a plan deviation, standard worktree setup.
- Initial test-file draft had a comment containing the literal substring `vi.mock` inside an explanatory sentence ("no vi.mock permitted here"), which tripped the acceptance criterion's `grep -c "vi.mock"` check (a plain substring match, not a mock-detection tool). Reworded to "no dice mocking permitted here" — no functional change, comment-only fix, folded into the Task 2 commit before it was ever staged separately.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The throw-in feature (THROWIN-01 through THROWIN-05) is now fully implemented end to end: detection (37-04) → placement (37-05) → mandatory Movement Phase 1 and the three-way choice (37-05) → the 6-hex Low/High throw with context teardown (37-06) → reclassification of an overthrown throw by the same detection system (37-06), all covered by both unit-level (`gameEngine.outOfBounds.test.ts`) and socket-level (`throwIn.integration.test.ts`) tests.
- `packages/server/src/__tests__/throwIn.integration.test.ts`'s `waitForNStates` and bounded-retry-loop patterns are available as precedent for Plan 37-07+'s Goal Kick / Corner Kick socket-level tests, which will face similar real-dice-randomness testing needs.
- Total test count for regression tracking: **server 697 tests (1 skipped, 1 todo)** — up from the 682 baseline recorded at the close of Plan 37-05.

## Threat Flags

None. This plan's threat model (T-37-23 through T-37-27, T-37-SC) was addressed exactly as specified: T-37-23 (throw-distance tampering) is closed by the server-side `maxDistance` override sourced from `isThrowInContext`, never trusting client highlight state. T-37-24 (off-pitch target tampering) is closed by the handler-only `isPitchHex` guard, with `validatePass` deliberately left unchanged per RESEARCH.md A4. T-37-25 (throw-type bypass) is closed by two independent gates (the pre-existing `ELIGIBLE_NEXT_ACTIONS` set plus this plan's explicit defence-in-depth check), both verified by dedicated tests. T-37-26 (stale throw-in context) is closed by the atomic teardown-at-commit, verified by an integration assertion checking all three fields are `null` after a High throw. T-37-27 (non-active-team spoofing) required no new code — the pre-existing `isActivePlayer` guard at the top of `GAME_ROLL` is untouched and runs before any throw-in logic. No packages were installed (T-37-SC).

## Known Stubs

None. Every artifact this plan's `must_haves` section requires is fully wired: the 6-hex cap and off-pitch guard are enforced server-side in `gameHandlers.ts`; Low and High throws reuse the unmodified `STANDARD_PASS`/`HIGH_PASS` event types and dice mechanics with zero duplication; the throw-in context clears atomically on commit; and an overthrown throw is reclassified by `triggerOutOfBoundsRestart` with no special-casing, proven by a real socket-level test.

---

## Self-Check: PASSED

- FOUND: packages/server/src/gameHandlers.ts (THROW_IN_MAX_DISTANCE, isThrowInContext, isPitchHex import, all 4 guard sites present)
- FOUND: packages/server/src/**tests**/throwIn.integration.test.ts (15 tests present, all passing)
- FOUND: 1940873 (feat: Task 1)
- FOUND: 5a9ae69 (test: Task 2)
- VERIFIED: `git diff packages/server/src/gameEngine.ts` returns empty (no changes)
- VERIFIED: `pnpm --filter @counter-attack/server test` exits 0 — 697 passed, 1 skipped, 1 todo
- VERIFIED: `pnpm -r typecheck` exits 0 clean across shared/server/client

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Plan: 06_
_Completed: 2026-08-03_
