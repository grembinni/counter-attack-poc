---
phase: 05-dice-resolver-all-resolution-branches
plan: 03
subsystem: api
tags: [game-engine, websocket, socket-io, gk-restart, dice, tdd]

# Dependency graph
requires:
  - phase: 05-02
    provides: applyRoll dispatcher, game:roll handler, rollDice, diceUtils.ts
  - phase: 05-01
    provides: GK_RESTART GamePhase, GAME_GK_RESTART event, highPass attribute on PlayerPiece

provides:
  - applyGKRestart engine function with kick/throw/movement branches (SHOT-05)
  - controlsGKTeam helper deriving GK team from ball.carrierId
  - game:gk-restart Socket.io handler with phase/team/payload guards

affects: [phase-6, phase-7, client-gk-restart-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - rollDie injected into applyGKRestart (pure engine, deterministic for tests)
    - controlsGKTeam derives GK team from ball.carrierId not stored gkTeam field (Open Q3)
    - validatePassAccuracy(gk, 'HIGH', rollDie(), []) reused for GK kick accuracy
    - seedGKRestart helper in integration tests: direct room.gameState mutation without socket flow

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/__tests__/game.integration.test.ts

key-decisions:
  - 'rollDie injected into applyGKRestart; engine stays pure; handler passes rollDice fn'
  - 'controlsGKTeam derives GK team from ball.carrierId (not a stored gkTeam field) — resolves Open Q3'
  - 'throw and movement produce identical engine state in v1; kept distinct for Phase 7 targetHex extension'
  - 'kick inaccuracy uses computeLooseBall from GK position with two extra rollDie() calls'
  - 'seedGKRestart in integration test directly mutates room.gameState (away GK always ball carrier)'

patterns-established:
  - 'rollDie injection pattern: all dice-consuming engine functions accept an injected die function'
  - 'snap-back broadcastState on every guard rejection inside handlers'

requirements-completed: [SHOT-05]

# Metrics
duration: 8min
completed: 2026-05-30
---

# Phase 5 Plan 03: GK Restart — All Three Branches Summary

**applyGKRestart pure engine function (kick/throw/movement) + game:gk-restart Socket.io handler with controlsGKTeam guard, closing the full movement → pass → shot → save → GK restart loop (SHOT-05)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-30T17:30:39Z
- **Completed:** 2026-05-30T17:38:29Z
- **Tasks:** 2 (Task 1 TDD: 2 commits + Task 2: 1 commit)
- **Files modified:** 4

## Accomplishments

- Exported `applyGKRestart` and `ApplyGKRestartResult` from `gameEngine.ts` with all three branches (kick/throw/movement), rollDie injection, WRONG_PHASE and INVALID_CHOICE guards
- Added `controlsGKTeam` helper to `gameHandlers.ts` deriving the GK team from `ball.carrierId` (Open Q3 resolved: no stored `gkTeam` field needed)
- Registered `socket.on(GAME_GK_RESTART)` handler with isProcessing mutex, phase/team/payload guards (T-05-07/08/09/10), and single-broadcast success path (ARCH-04)
- 6 new engine unit tests + 3 new integration tests; full server test suite: 82 passed, 1 todo (all green)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED — failing applyGKRestart tests** - `f60aa00` (test)
2. **Task 1 GREEN — applyGKRestart implementation** - `31f92ee` (feat)
3. **Task 2 — game:gk-restart handler + controlsGKTeam + integration tests** - `c9f1fbb` (feat)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — Added `ApplyGKRestartResult` union and `applyGKRestart(state, choice, rollDie)` function with kick/throw/movement branches
- `packages/server/src/gameHandlers.ts` — Added `controlsGKTeam` helper; registered `socket.on(GAME_GK_RESTART)` handler with all four threat mitigations
- `packages/server/src/__tests__/gameEngine.test.ts` — 6 new tests for applyGKRestart (WRONG_PHASE, INVALID_CHOICE, movement, throw, kick-accurate, kick-inaccurate)
- `packages/server/src/__tests__/game.integration.test.ts` — 3 new GK restart integration tests (movement success, WRONG_TEAM, INVALID_CHOICE); `seedGKRestart` synchronous helper

## Decisions Made

- **rollDie injection**: `applyGKRestart` does not call `rollDice()` itself; the handler passes `rollDice` as the injected function. Keeps the engine pure and deterministic for unit tests (consistent with `applyRoll` pattern).
- **GK team via ball.carrierId**: `controlsGKTeam` looks up `ball.carrierId` at call time — no stored `gkTeam` field on `GameState`. Resolves Open Question 3 from RESEARCH.md. Simple and correct because `GK_RESTART` always follows a save catch where the GK is the ball carrier.
- **throw === movement in v1**: The `throw` and `movement` branches produce identical `GameState` today (both set phase MOVEMENT, attackingTeam = gkTeam, ball stays with GK). They are deliberately kept as distinct branches so Phase 7 only needs to extend the `throw` branch with a `targetHex` parameter — not reintroduce it.
- **Kick inaccuracy from GK position**: When the kick accuracy roll fails, `computeLooseBall` is called from `gk.position` (not `ball.position`, which is the same), consuming two additional `rollDie()` calls for direction and distance. All three roll values included in `lastDiceRoll.rolls`.
- **Integration test seedGKRestart**: Seeds `room.gameState` directly into `GK_RESTART` with the away GK as ball carrier (clientB = slot 2 = 'away' = GK team). The away GK is always `role: 'GK' && teamId: 'away'` in the hardcoded squads. This is the same direct mutation pattern used in the Plan 02 integration tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint async/await errors in seedGKRestart**

- **Found during:** Task 2 pre-commit hook
- **Issue:** `seedGKRestart` was declared `async` but contained no `await` expression (ESLint `@typescript-eslint/require-await`), and its callers in integration tests had `await` before a non-Promise return (`@typescript-eslint/await-thenable`)
- **Fix:** Removed `async` from `seedGKRestart`; removed `await` from all three call sites in the integration test `describe` block
- **Files modified:** `packages/server/src/__tests__/game.integration.test.ts`
- **Committed in:** c9f1fbb (Task 2 commit, after lint-staged fixed and re-committed)

**2. [Rule 3 - Blocking] Worktree was 92 commits behind main**

- **Found during:** Plan start (files missing in worktree)
- **Issue:** The worktree branch was created from Phase 1 commit (483164b); all Phase 2–5 work (Plans 01–02) was on `main` but not in the worktree
- **Fix:** Ran `git merge main --no-edit` (fast-forward); then `pnpm install` to populate `node_modules`; then built shared package (`npx tsc` in packages/shared) before running tests
- **Files modified:** All Phase 2–5 files (via fast-forward merge, no conflicts)

---

**Total deviations:** 2 auto-fixed (1 lint bug, 1 blocking environment setup)
**Impact on plan:** Both auto-fixes necessary for correctness and execution. No scope creep.

## Issues Encountered

- **`npx vitest`** in the plan's `<verify>` block triggered npm downloading a newer vitest version, conflicting with the local version. Resolved by using `pnpm test` instead.
- `@counter-attack/shared` dist was out of date after merge; resolved by running `npx tsc` in `packages/shared` before the first test run.

## Known Stubs

None. All three GK restart branches are fully wired server-side:

- `movement`: phase MOVEMENT, attackingTeam = GK team, ball with GK, lastDiceRoll null
- `throw`: same as movement in v1 (D-25 targetHex deferred to Phase 7 as documented)
- `kick`: validatePassAccuracy(gk, 'HIGH', rollDie(), []) → accurate/inaccurate with Loose Ball

The `throw === movement` equivalence is a deliberate v1 scope decision (not a stub) — documented in the plan, in code comments, and in the `applyGKRestart` JSDoc.

## Threat Surface Scan

All threat model mitigations from the plan were applied:

| Threat ID | Mitigation                                                                                       | Status    |
| --------- | ------------------------------------------------------------------------------------------------ | --------- |
| T-05-07   | controlsGKTeam derives GK team from ball.carrierId; WRONG_TEAM + snap-back                       | Mitigated |
| T-05-08   | choice validated against ['kick','throw','movement'] before dispatch; INVALID_CHOICE + snap-back | Mitigated |
| T-05-09   | Phase guard: phase !== GK_RESTART → WRONG_PHASE + snap-back                                      | Mitigated |
| T-05-10   | isProcessing mutex in try/finally; second event silently dropped                                 | Mitigated |
| T-05-SC   | No packages installed this phase                                                                 | Accepted  |

No new network surface beyond `game:gk-restart` (planned in threat model).

## Self-Check

- `packages/server/src/gameEngine.ts` exports `applyGKRestart`: FOUND
- `packages/server/src/gameHandlers.ts` contains `controlsGKTeam`: FOUND (3 occurrences)
- `packages/server/src/gameHandlers.ts` contains `GAME_GK_RESTART`: FOUND (2 occurrences)
- `pnpm test` in packages/server: 82 passed, 1 todo, 0 failed: VERIFIED
- `pnpm -r build` succeeds: VERIFIED
- Commits f60aa00, 31f92ee, c9f1fbb in git log: VERIFIED

## Self-Check: PASSED

---

_Phase: 05-dice-resolver-all-resolution-branches_
_Completed: 2026-05-30_
