---
phase: 10-remaining-action-flows-tech-debt
plan: 04
subsystem: api
tags: [typescript, vitest, socket-io, game-handlers, shot-flow, tdd]

# Dependency graph
requires:
  - phase: 10-03
    provides: applyDeclareShot, applyGKDive, applyDeclareHeaderTarget, computeShotPathDeflection pure engine functions

provides:
  - GAME_SHOT rework: PASS phase guard, attacker-team guard, calls applyDeclareShot, broadcasts (D-02)
  - GAME_GK_DIVE handler: phase/team/HexCoord guards, calls applyGKDive (T-10-08/T-10-09/T-10-11)
  - GAME_END_TURN GK_DIVING branch: pre-generates defender deflection + shot dice, calls computeShotPathDeflection + applyRoll (D-03/D-04)
  - GAME_MOVE SNAP_DEFLECT branch: defending team, 1 piece, max 2 hexes, full guards (D-08/SNAP-02)
  - GAME_END_TURN SNAP_DEFLECT branch: defending team ends, auto-resolves snapshot via applyRoll
  - GAME_HEADER_TARGET handler: both-confirmed + attacker guard, calls applyDeclareHeaderTarget (HEAD-03)
  - D-15 CR-01 BLOCKER: startReplayStream re-fetches liveRoom inside setTimeout; exits if room deleted
  - D-24: broadcastState snap-back on all error paths in GAME_RESTART_MOVEMENT
  - D-19 WR-04: duplicate GAME_HEADER handler removed; single auto-confirm resolution route

affects:
  - 10-05 (ActionPanel UI for GK_DIVING, SNAP_DEFLECT, HEADER target hex, Shoot button two-step)
  - SHOT-01/SHOT-04 end-to-end flow now fully wired handler-to-engine
  - HEAD-03 header-at-goal flow now fully wired

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'GAME_GK_DIVE: mandatory handler skeleton (isProcessing + null-state + phase + HexCoord + team + engine call + broadcastState on all paths)'
    - 'controlsGKTeam phase-aware: GK_DIVING derives defending team from attackingTeam; GK_RESTART uses ball.carrierId'
    - 'GK end-turn: pre-generate all defender deflection inputs + shot dice before computeShotPathDeflection + applyRoll'
    - 'SNAP_DEFLECT GAME_MOVE: mirrors HIGH_PASS_MOVEMENT block with defending team + 1 piece + max 2 hexes guards'
    - 'exactOptionalPropertyTypes workaround: destructure-omit optional fields rather than setting explicit undefined'

key-files:
  created: []
  modified:
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameHandlers.phase10.test.ts
    - packages/shared/src/types.ts

key-decisions:
  - 'controlsGKTeam special-cases GK_DIVING phase: in GK_DIVING ball.carrierId is the shooter (not the GK), so defending team derived from attackingTeam instead'
  - 'Away GK test fixture repositioned to q=36 goal line so valid dives to adjacent goal-mouth hexes pass the NOT_PARALLEL guard'
  - 'SNAP_DEFLECT end-turn omits snapDeflectMovedPieceId/snapDeflectPaceUsed via destructure-omit (exactOptionalPropertyTypes: no explicit undefined allowed)'
  - 'GK_DIVING shot resolution: computeShotPathDeflection checked first; if deflected -> LOOSE_BALL; else -> applyRoll SHOT branch with stateForShot phase=SHOT'

requirements-completed: [SHOT-01, SHOT-04, SNAP-02, HEAD-03, HEAD-04]

# Metrics
duration: 55min
completed: 2026-06-10
---

# Phase 10 Plan 04: Handler Layer — GAME_GK_DIVE, GAME_HEADER_TARGET, GAME_SHOT rework, SNAP_DEFLECT, D-15/D-24/D-19 Summary

**CR-01 BLOCKER fixed; GAME_SHOT reworked to declare from PASS phase; GAME_GK_DIVE, GAME_HEADER_TARGET, and SNAP_DEFLECT handlers wired with full guards, dice pre-generation, and snap-back**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-06-10T11:45:00Z
- **Completed:** 2026-06-10T12:36:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

### Task 1: D-15 CR-01, D-24, D-19 fixes

- **D-15 CR-01 BLOCKER fixed:** `startReplayStream` now re-fetches `liveRoom = getRoom(room.roomCode)` inside the 3s `setTimeout` callback. If the room was deleted during the hold, the callback returns early and no `setInterval` is created. Eliminates the stale closure reference that could emit replay frames to a dead room.

- **D-24 GAME_RESTART_MOVEMENT snap-back:** Added `broadcastState(io, room)` before every error `return` in the handler (3 paths: wrong phase, wrong team, engine error). Clients now receive the authoritative state on any rejection.

- **D-19 WR-04 GAME_HEADER removed:** The dedicated `GAME_HEADER` socket handler was removed. `GAME_HEADER_CONTESTANT` already auto-rolls the duel when both teams confirm (established Phase 8.2). A single resolution route prevents duplicate dice roll bugs. `ClientEvents.GAME_HEADER` constant retained in events.ts for backwards compatibility.

### Task 2: New handlers and GAME_SHOT rework

- **GAME_SHOT reworked (D-02):** Phase guard changed from `SHOT` to `PASS`. Added `controlsAttackingTeam` guard and HexCoord shape validation. Calls `applyDeclareShot(state, goalHex)` which transitions `PASS → GK_DIVING` and records `shotTargetHex`. Broadcasts new state (old version intentionally did not broadcast). Snap-back on all error paths.

- **GAME_GK_DIVE handler:** Full mandatory skeleton — isProcessing mutex, null-state guard, phase (`GK_DIVING`) guard, HexCoord shape validation, `controlsGKTeam` guard (WRONG_TEAM), `applyGKDive` engine call, broadcastState on success and all errors.

- **GAME_END_TURN GK_DIVING branch:** `controlsGKTeam` guard; builds `DefenderDeflectionInput[]` by iterating defending outfield pieces near the shot path (`hexLine` + `hexDistance`); pre-generates one die per relevant defender plus `shooterDie/gkDie/handlingDie`; calls `computeShotPathDeflection` — if deflected transitions to `LOOSE_BALL`; else normalises state to `SHOT` phase and calls `applyRoll` for the shooter-vs-GK duel. All dice pre-generated in handler (ARCH-01 engine purity).

- **SNAP_DEFLECT GAME_MOVE branch:** Mirrors `HIGH_PASS_MOVEMENT` block. Active team = defending team (opponent of `attackingTeam`). Guards: correct team socket, piece ownership, lock to first moved piece (`snapDeflectMovedPieceId`), max 2 hexes (`snapDeflectPaceUsed`), adjacency (`hexDistance === 1`), pitch boundary (`PITCH_HEXES`), no occupied hex.

- **SNAP_DEFLECT GAME_END_TURN branch:** Defending team ends deflection turn; auto-resolves snapshot by normalising to `SHOT` phase and calling `applyRoll` with pre-generated dice.

- **GAME_HEADER_TARGET handler:** Phase (`HEADER`) guard, both-teams-confirmed guard (`HEADER_NOT_CONFIRMED`), HexCoord shape validation, `controlsAttackingTeam` guard (WRONG_TEAM), `applyDeclareHeaderTarget` engine call, broadcastState.

- **`controlsGKTeam` updated:** In `GK_DIVING` phase, `ball.carrierId` is the shooter (not the GK), so the function now derives the defending/GK team from `attackingTeam` rather than `ball.carrierId` for that phase.

- **`snapDeflectMovedPieceId` + `snapDeflectPaceUsed` added to `GameState`** in `packages/shared/src/types.ts`.

## Task Commits

1. **Task 1 (D-15/D-24/D-19 fixes):** `5883406` (fix)
2. **Task 2 RED (un-skip tests):** `403cb03` (test)
3. **Task 2 GREEN (new handlers):** `44378d8` (feat)

## Files Created/Modified

- `packages/server/src/gameHandlers.ts` — All handler additions and fixes described above
- `packages/server/src/__tests__/gameHandlers.phase10.test.ts` — Removed `describe.skip` from 3 describe blocks; updated `seedGkDivingPhase` to position away GK at q=36 goal line
- `packages/shared/src/types.ts` — Added `snapDeflectMovedPieceId?: string | null` and `snapDeflectPaceUsed?: number` to `GameState`

## Decisions Made

- `controlsGKTeam` is phase-aware for `GK_DIVING`: in that phase `ball.carrierId` is the shooter not the GK, so defending team is derived from `attackingTeam`
- Test fixture `seedGkDivingPhase` repositions away GK to `q=36, r=13` (goal line) so a dive to `{ q: 36, r: 14 }` passes the `NOT_PARALLEL` guard (`to.q === gk.position.q`)
- `exactOptionalPropertyTypes: true` prevents setting optional fields to `undefined` explicitly; handled via destructure-omit pattern (`const { fieldA: _, fieldB: __, ...rest } = state`)
- GK_DIVING shot resolution uses a two-stage approach: deflection check first (`computeShotPathDeflection`), then `applyRoll` with `phase: 'SHOT'` normalisation — avoids duplicating shot duel logic

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] controlsGKTeam returns wrong result in GK_DIVING phase**

- **Found during:** Task 2 implementation
- **Issue:** In `GK_DIVING`, `ball.carrierId` is the shooter (not the GK). The original `controlsGKTeam` derived GK team from `ball.carrierId`, so it returned `true` for the **attacker** (wrong) and `false` for the **defender** (wrong).
- **Fix:** Added a `phase === 'GK_DIVING'` special-case that derives defending team from `attackingTeam` instead of `ball.carrierId`.
- **Files modified:** `packages/server/src/gameHandlers.ts`
- **Verification:** `GAME_GK_DIVE by wrong team emits GAME_ERROR (WRONG_TEAM)` test passes
- **Committed in:** `44378d8` (Task 2 GREEN)

**2. [Rule 2 - Missing Critical] snapDeflectMovedPieceId + snapDeflectPaceUsed fields missing from GameState**

- **Found during:** Task 2 implementation (TypeScript compile error)
- **Issue:** `SNAP_DEFLECT` GAME_MOVE block needed `snapDeflectMovedPieceId` and `snapDeflectPaceUsed` fields to track piece locking and pace. These were not yet added to `GameState` in types.ts.
- **Fix:** Added both fields as optional to `GameState` in `packages/shared/src/types.ts` and rebuilt the shared package.
- **Files modified:** `packages/shared/src/types.ts`
- **Verification:** `tsc --noEmit` exits 0 after `pnpm build` on shared
- **Committed in:** `44378d8` (Task 2 GREEN)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical field)
**Impact on plan:** Both fixes required for correct behaviour and TypeScript compilation. No scope creep.

## Known Stubs

None — all handlers are fully implemented. The SNAP_DEFLECT and GK_DIVING phases are wired in the handler layer; the client UI (ActionPanel, HexGrid) is the remaining work in plan 05.

## Threat Flags

No new security surface beyond what the plan's threat model covers:

- T-10-08 mitigated: `controlsGKTeam` guard prevents wrong-team GK dive (including the GK_DIVING phase fix)
- T-10-09 mitigated: HexCoord shape validation on GAME_GK_DIVE, GAME_HEADER_TARGET, reworked GAME_SHOT
- T-10-10 mitigated: all dice pre-generated server-side in handlers; engine is pure
- T-10-11 mitigated: `isProcessing` mutex on all new handlers
- T-10-12 mitigated: `controlsAttackingTeam` guard on GAME_HEADER_TARGET

## Self-Check: PASSED

- packages/server/src/gameHandlers.ts: FOUND
- packages/server/src/**tests**/gameHandlers.phase10.test.ts: FOUND
- packages/shared/src/types.ts: FOUND
- .planning/phases/10-remaining-action-flows-tech-debt/10-04-SUMMARY.md: FOUND (this file)
- Commit 5883406 (Task 1 fixes): FOUND
- Commit 403cb03 (Task 2 RED): FOUND
- Commit 44378d8 (Task 2 GREEN): FOUND
- 27/27 handler tests pass (gameHandlers.phase10 + gameHandlers + replay.integration)
- tsc --noEmit exits 0
