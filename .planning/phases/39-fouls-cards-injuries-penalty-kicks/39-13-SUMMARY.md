---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 13
subsystem: api
tags: [typescript, socket.io, gameHandlers, vitest, integration-test, fouls, free-kick]

# Dependency graph
requires:
  - phase: 39-10
    provides: 'gameEngine.ts resolveFoulChain/triggerFoulFreeKick/applyFoulChoice — the pure foul-chain engine functions this plan wires over sockets'
  - phase: 39-11
    provides: 'gameHandlers.ts penalty-kick socket wiring — applyFoulChoice GK_DIVE_AT_FEET restart branch calls triggerPenaltyKick directly, already reachable from this plan'
provides:
  - 'gameHandlers.ts GAME_MOVE dice payload extended with server-rolled injuryDie/bookingDie, consumed unconditionally by resolveFoulChain'
  - 'gameHandlers.ts new GAME_FOUL_CHOICE handler (five-step mutex/guard shape copied from GAME_GK_DIVE)'
  - "gameEngine.ts relocateTrappedFreeKickPieces — a shared post-foul-trigger relocation sweep (extracted from D-59's applyOffsideFoulWithRelocation body) now also applied to applyFoulChoice's TACKLE/STEAL restart branch"
  - 'packages/server/src/__tests__/foulFreeKick.integration.test.ts — 9-test/54-assertion two-socket integration suite covering FOUL-02/03/05, CARD-01, INJURY-01 and FK-01 end to end'
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'GAME_FOUL_CHOICE handler copies the canonical five-step socket-handler shape (null-state guard -> phase guard -> explicit payload allow-list -> team guard -> pure engine call + broadcastState) already established by GAME_GK_DIVE/GAME_PENALTY_KICK_TAKER'
    - 'Integration-test seeding pattern: call the real, unmocked engine function directly with injected trigger dice to reach a deterministic mid-chain state, then drive every subsequent access-control/ordering/transport assertion over real sockets — same pattern PEN-03 established in penaltyKick.integration.test.ts'
    - "File-scoped vi.mock('../diceUtils.js', () => ({ rollDice: () => 1 })) (mirrors gameHandlers.rule11.test.ts) used ONLY for the one suite that needs a real GAME_MOVE to deterministically reach the foul chain without relying on a 1-in-6 random trigger; every other test in the file seeds via a direct, unmocked applyMove call with explicit dice"

key-files:
  created:
    - packages/server/src/__tests__/foulFreeKick.integration.test.ts
  modified:
    - packages/server/src/gameHandlers.ts
    - packages/server/src/gameEngine.ts

key-decisions:
  - "injuryDie/bookingDie are rolled unconditionally in GAME_MOVE's dice payload, exactly like the pre-existing stealDie/tackleDie/carrierDie — resolveFoulChain ignores them when no foul fires; keeps the handler free of rule logic (mirrors the plan's own instruction)."
  - "GAME_FOUL_CHOICE's team guard compares socketTeam(socket) against room.gameState.attackingTeam (the fouled side, set by resolveFoulChain) rather than a new dedicated field — no new GameState field needed."
  - "[Rule 1 auto-fix, surfaced by the new FK-01 integration test] A TACKLE-sourced foul's fouling defender always ends up standing exactly on foulHex/freeKickHex, because applyMove moves the acting piece to `to` unconditionally regardless of the subsequent duel's SUCCESS/FAIL outcome (the TACKLE_ATTEMPT FAIL branch's own code comment confirms this is intentional game-physics, not a bug). Without a relocation sweep, applyFoulChoice('restart') would leave the kicking team permanently blocked from FREE_KICK_SETUP's mandatory kicker-first placement (rejected OCCUPIED at the gameHandlers.ts level) — the exact same class of stalled-game bug D-59 already fixed for the OFFSIDE-02 trigger path. Fixed by extracting D-59's relocation-sweep body out of applyOffsideFoulWithRelocation into a shared, phase-agnostic relocateTrappedFreeKickPieces(state) helper, and applying it to both call sites (OFFSIDE-02's existing wrapper, and applyFoulChoice's new TACKLE/STEAL restart branch)."

requirements-completed: [FOUL-01, FOUL-02, FOUL-03, FOUL-05, CARD-01, INJURY-01, FK-01]

# Metrics
duration: ~2h (includes a mid-task session-limit interruption and resume)
completed: 2026-08-14
---

# Phase 39 Plan 13: Foul Chain Socket Wiring & FK-01 Integration Suite Summary

**Wired Plan 39-10's foul-chain engine functions onto GAME_MOVE (server-rolled injury/booking dice) and a new GAME_FOUL_CHOICE handler, then proved the whole chain — including FK-01's reuse of the untouched FREE_KICK_SETUP flow — end to end with a 9-test/54-assertion two-socket integration suite that also surfaced and fixed a genuine stalled-game bug in the TACKLE-sourced restart path.**

## Performance

- **Duration:** ~2h (includes a mid-task session-limit interruption; resumed cleanly from the last committed task)
- **Completed:** 2026-08-14
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `GAME_MOVE`'s dice payload now rolls `injuryDie`/`bookingDie` unconditionally via `rollDice()` alongside the existing `stealDie`/`tackleDie`/`carrierDie` — never client-supplied, consumed by `resolveFoulChain` only when a foul actually fires.
- New `GAME_FOUL_CHOICE` socket handler: null-state guard, `FOUL_CHOICE` phase guard, explicit `'continue'`/`'restart'` two-value allow-list (`INVALID_CHOICE` on any forged value), `WRONG_TEAM` guard against `attackingTeam` (the fouled side), `applyFoulChoice` engine call, and `startReplayStream` on a `FULL_TIME` transition — copied verbatim from `GAME_GK_DIVE`'s five-step shape.
- `foulFreeKick.integration.test.ts` (9 tests, 54 `expect(` assertions) proving: FOUL-02's exact event ordering (duel → `FOUL_CALLED` → `INJURY_CHECK` → `BOOKING_CHECK`) within a single `broadcastState` snapshot; every `GAME_FOUL_CHOICE` access-control path (wrong team, forged choice, wrong phase, double-emit mutex); `'continue'` restoring `foulResume` byte-for-byte and appending `FOUL_CHOICE_MADE`; `'restart'` with `foulSource: 'TACKLE'` reaching `FREE_KICK_SETUP` (FK-01) and the pre-existing, untouched `GAME_FREE_KICK_MOVE`/`GAME_FREE_KICK_READY` flow still working; `foulsEnabled: false` gating the entire chain over the wire (FOUL-05); and `GAME_MOVE`'s dice always being server-rolled, provably ignoring forged extra dice fields on the payload (T-39-13-01).
- **Bug found and fixed while writing the FK-01 test:** a TACKLE-sourced foul's fouling defender always ends up standing exactly on `freeKickHex` (a real game-physics rule, not a test artifact — `applyMove` moves the mover to `to` regardless of duel outcome), which permanently blocked the kicking team's mandatory kicker-first placement with `OCCUPIED`. Fixed by generalizing the existing D-59 `applyOffsideFoulWithRelocation` relocation sweep into a shared `relocateTrappedFreeKickPieces` helper, now applied to `applyFoulChoice`'s TACKLE/STEAL restart branch too.
- Full server suite (1144 tests, 1 skipped, 1 todo) and full monorepo build (`pnpm build`) green after Task 2; `tsc --noEmit` clean throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate the injury and booking dice on GAME_MOVE and add the GAME_FOUL_CHOICE handler** - `ea32455` (feat)
2. **Task 2: Socket-level integration suite for the foul chain and FK-01** - `b1e620d` (test) — includes the `relocateTrappedFreeKickPieces` bug fix in `gameEngine.ts`, discovered and fixed while writing this task's FK-01 test (see Deviations below)

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/server/src/gameHandlers.ts` - `GAME_MOVE`'s dice payload extended with `injuryDie`/`bookingDie`; new `GAME_FOUL_CHOICE` handler; `applyFoulChoice` import added
- `packages/server/src/gameEngine.ts` - Extracted D-59's relocation-sweep body out of `applyOffsideFoulWithRelocation` into a new shared `relocateTrappedFreeKickPieces(state)` helper; applied it to `applyFoulChoice`'s TACKLE/STEAL `'restart'` branch (in addition to its original `applyOffsideFoulWithRelocation` call site, which now delegates to it)
- `packages/server/src/__tests__/foulFreeKick.integration.test.ts` - 9-test, 54-assertion two-socket integration suite (real Socket.io server + `socket.io-client`, no mocking except a file-scoped `rollDice()` mock used by one suite) covering every numbered item in the plan's Task 2 action list

## Decisions Made

See `key-decisions` in frontmatter — the unconditional dice-rolling rationale, the `attackingTeam`-as-team-guard decision, and the Rule 1 auto-fix for the TACKLE-sourced-foul relocation bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TACKLE-sourced foul restarts were permanently stuck behind an OCCUPIED rejection**

- **Found during:** Task 2, while writing the FK-01 integration test (`'restart' from the fouled manager with foulSource 'TACKLE' transitions to FREE_KICK_SETUP...`)
- **Issue:** `applyMove` moves the acting piece to its destination hex unconditionally, regardless of whether the subsequent `TACKLE_ATTEMPT` duel succeeds or fails (confirmed intentional by the existing code comment on the FAIL branch: "defender moves to `to` (newPieces already reflects this)"). This means a TACKLE-sourced foul's fouling defender is ALWAYS standing exactly on `foulHex` at the moment `applyFoulChoice('restart')` calls `triggerFoulFreeKick`, which sets `freeKickHex` to that same hex. `gameHandlers.ts`'s `GAME_FREE_KICK_MOVE` handler has its own `OCCUPIED` pre-check that rejects any destination already held by another piece — so the kicking team's mandatory kicker-first placement (D-54) onto `freeKickHex` was unconditionally rejected, permanently stalling the game. This is exactly the class of bug D-59 already fixed for the OFFSIDE-02 trigger path (`applyOffsideFoulWithRelocation`'s own JSDoc describes the identical failure mode almost verbatim), but `triggerFoulFreeKick` (added in Plan 39-10) was never wrapped with that same relocation sweep.
- **Fix:** Extracted D-59's relocation-sweep body (which finds every conceding-team piece within 2 hexes of `freeKickHex`, including one sitting exactly on it, and relocates each to a tactically sensible ring-3 hex) out of `applyOffsideFoulWithRelocation` into a new, phase-agnostic `relocateTrappedFreeKickPieces(state: GameState): GameState` helper. `applyOffsideFoulWithRelocation` now delegates to it (behavior-preserving refactor, verified by the full pre-existing OFFSIDE-02 test suite staying green). `applyFoulChoice`'s TACKLE/STEAL `'restart'` branch now also calls it after `triggerFoulFreeKick`.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** The FK-01 integration test explicitly asserts `freeKickHex` is unoccupied immediately after the `'restart'` transition, then drives a real `GAME_FREE_KICK_MOVE` (kicker placement onto `freeKickHex`) and `GAME_FREE_KICK_READY` (stage advance) to prove the flow completes. Full pre-existing OFFSIDE-02 suites (`offside.test.ts`, `gameHandlers.phase17-06.test.ts`, `gameEngine.phase26-undo.test.ts`) — which exercise `applyOffsideFoulWithRelocation`'s original call path — stayed green after the refactor, confirming it is behavior-preserving.
- **Committed in:** `b1e620d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for FK-01's own explicit success criterion ("choosing the restart reaches the untouched FREE_KICK_SETUP flow and it continues to work") to actually hold for the TACKLE-sourced case the plan's Task 2 explicitly required testing. No scope creep — the fix is a targeted extraction of an already-proven relocation algorithm, not new design.

## Issues Encountered

- Fresh worktree had no `node_modules` and `packages/shared` had no `dist/` build output — resolved with `pnpm install --frozen-lockfile` then `pnpm --filter @counter-attack/shared build` before any typecheck/test command, consistent with every prior Phase 39 plan's worktree notes.
- This execution was interrupted mid-task by a session usage limit after Task 1 was committed and before Task 2's test file was written. Resumed cleanly: verified the prior commit (`ea32455`) and clean working tree via `git log`/`git status`, then proceeded directly into Task 2 without redoing any completed work.
- The FK-01 test's initial geometry choice (using the first home outfielder as both the seeded carrier AND the free-kick "kicker") surfaced the TACKLE-relocation bug above via a failing assertion (`expected {q:18,r:13} to deeply equal {q:19,r:12}`), traced to an `OCCUPIED` `GAME_ERROR` via a temporary debug listener, then fixed at the root cause in `gameEngine.ts` rather than working around it by picking a different kicker or hex (which would have hidden the real defect instead of proving FK-01 actually holds).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full foul chain (die-of-1 trigger → injury/booking rolls → fouled-manager choice → continue-resume or restart-into-FREE_KICK_SETUP/PENALTY_KICK) is now reachable and proven end-to-end over real sockets, including every access-control failure path and the reuse of the untouched FREE_KICK_SETUP flow.
- `relocateTrappedFreeKickPieces` is now a general-purpose, reusable helper for any future restart-trigger path that transitions into `FREE_KICK_SETUP` and might leave a piece standing on `freeKickHex` — worth checking if a future GK-dive-at-feet-into-free-kick variant (if one is ever added) or any other new foul source needs the same treatment.
- No blockers. Full monorepo build/test all green (server 1144 tests, 1 skipped, 1 todo; shared/client unaffected, both still build clean).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: `packages/server/src/gameHandlers.ts`
- FOUND: `packages/server/src/gameEngine.ts`
- FOUND: `packages/server/src/__tests__/foulFreeKick.integration.test.ts`
- FOUND: commit `ea32455` (feat: injury/booking dice + GAME_FOUL_CHOICE handler)
- FOUND: commit `b1e620d` (test: foulFreeKick.integration.test.ts + relocation fix)
