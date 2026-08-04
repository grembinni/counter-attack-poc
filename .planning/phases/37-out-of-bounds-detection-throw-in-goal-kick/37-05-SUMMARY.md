---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 05
subsystem: game-engine
tags: [typescript, vitest, gameEngine, gameHandlers, throw-in, movement-phase, socket.io]

# Dependency graph
requires:
  - phase: 37-04
    provides: 'triggerOutOfBoundsRestart producing a fully-formed THROW_IN_SETUP state (throwInHex/throwInTeam/throwInPhasesTaken:0) reachable from the LOOSE_BALL clamp'
provides:
  - "applyThrowInPlace(state, pieceId) — teleports the throwing team's chosen piece + ball to the server-owned throwInHex and transitions directly into a real Movement Phase 1 (phase: MOVE, movementSlot: ATTACKER_4), never PASS, so no throw option exists before it completes"
  - 'applyEndTurn throw-in movement-counting branch — sets lastActionType to THROW_IN_MOVEMENT_1/2 and increments throwInPhasesTaken (0->1->2, hard-capped) each time a throw-in Movement Phase completes with the ball still held by the throwing team; clears throwInHex/throwInTeam/throwInPhasesTaken on possession loss, half-end, or GK restart'
  - 'GAME_THROW_IN_PLACE socket handler (game:throw-in-place) — pieceId-only payload; destination is always server-owned room.gameState.throwInHex'
affects: [37-06, 37-07, 37-08, 37-09, 37-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "applyThrowInPlace copies applyStartMovement's fresh-Movement-Phase reset literal (movedPieceIds/paceUsedByPieceId/contestedPieceIds/stealAttemptedByIds/tackleAttemptedByIds/carriedMovedPieceIds/lastDiceRoll/lastActionType) by value rather than calling applyStartMovement itself, since that function's phase guard (KICK_OFF/PASS/LOOSE_BALL only) would reject THROW_IN_SETUP and widening it would let a client start a movement phase from a restart setup screen"
    - "applyEndTurn's throw-in branch reuses the exact carrier lookup already computed for the pre-existing GK-carrier-in-own-penalty-area branch (no duplicate state.pieces.find scan) — the new branch is gated on carrier.teamId === state.throwInTeam using that same carrier reference"
    - 'throwInClear is a single named object literal spread into the one remaining terminal return (the generic ATTACKER_2->PASS path) that needs conditional clearing; the half-end and GK_RESTART returns clear the same three fields unconditionally inline since a throw-in context must never survive either of those regardless of throwInPhasesTaken validity'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts

key-decisions:
  - "The applyEndTurn throw-in branch is inserted after the half-end return and after the GK-carrier-in-own-penalty-area return, but before the generic ATTACKER_2->PASS return — exact ordering verified by grep (the branch's `if (throwInStillValid)` line number is higher than the `phase: 'GK_RESTART'` return's line number)"
  - 'throwInStillValid is computed as a single boolean (throwInPhasesTaken in [0,1] AND carrier non-null AND carrier.teamId === throwInTeam) so there is exactly one place that decides whether the branch fires, and exactly one guard expression to audit for T-37-22 (stolen-ball elevation-of-privilege)'
  - "GAME_START_MOVEMENT's existing phase allow-list (KICK_OFF/PASS/LOOSE_BALL) already omits THROW_IN_SETUP with no code change required — only a one-line comment was added recording the omission as deliberate, per the plan's explicit instruction to verify rather than assume"

requirements-completed: [THROWIN-02, THROWIN-03]

# Metrics
duration: 12min
completed: 2026-08-03
---

# Phase 37 Plan 05: Throw-In Placement & Movement-Phase Choice Model Summary

**`applyThrowInPlace` teleports the thrower onto the exit hex and starts a real 4-5-2 Movement Phase 1; `applyEndTurn` now counts completed throw-in Movement Phases and drives the D-09 per-step Low/High/Move choice, hard-capped at two; `GAME_THROW_IN_PLACE` wires it all to a pieceId-only socket event that can never accept a client-chosen destination.**

## Performance

- **Duration:** ~12 min (338319f at 21:42:12 to fd93593 at 21:46:48)
- **Started:** 2026-08-03T21:39:00-05:00 (approx, after context load)
- **Completed:** 2026-08-03T21:46:48-05:00
- **Tasks:** 3
- **Files modified:** 3 (2 source, 1 test)

## Accomplishments

- `applyThrowInPlace(state, pieceId)` exported from `gameEngine.ts`: guard order mirrors `applyGKKickTarget` (`WRONG_PHASE` including missing `throwInHex`/`throwInTeam` → `PIECE_NOT_FOUND` → `WRONG_TEAM`); on success repositions the chosen piece to `throwInHex` (a teleport, no `validateMove` call, no pace consumed), assigns the piece the ball with `lastTouchedBy` recorded as a real contact per D-06, transitions `phase: 'MOVE'` / `movementSlot: 'ATTACKER_4'`, sets `attackingTeam`/`activeTeam` to `throwInTeam`, applies the full fresh-Movement-Phase reset set, and appends exactly one `THROW_IN_PLACE` event
- `applyEndTurn`'s `nextSlot === null` block gained a throw-in movement-counting branch positioned after the half-end and GK-carrier-in-own-penalty-area returns and before the generic `ATTACKER_2→PASS` return: fires only while `throwInPhasesTaken < 2` and the ball is still held by `throwInTeam`, setting `lastActionType` to `THROW_IN_MOVEMENT_1` (first completion) or `THROW_IN_MOVEMENT_2` (second) and incrementing the counter — re-evaluating offside and advancing the clock exactly like every other full-movement-end return (verified: `offsidePieceIds: nextOffside` count increased by exactly 1)
- Throw-in context (`throwInHex`/`throwInTeam`/`throwInPhasesTaken`) is now cleared to `null` on three independent terminal paths: possession loss (no carrier, or carrier belongs to the opposing team), the half-end (`HALF_TIME`/`FULL_TIME`) return, and the `GK_RESTART` return — so a throw-in cannot survive a steal/tackle, a half boundary, or a GK restart
- `GAME_THROW_IN_PLACE` (`game:throw-in-place`) registered in `gameHandlers.ts` next to the free-kick restart handlers, following the project's mutex → phase-guard → payload-shape-validation → ownership-check → turn-guard → delegate → broadcast shape verbatim; payload is `pieceId` only, with two independent guards distinguishing tampering (`NOT_YOUR_PIECE`) from a wrong-turn attempt (`WRONG_TEAM`)
- `GAME_START_MOVEMENT`'s existing phase allow-list already rejects `THROW_IN_SETUP` with `WRONG_PHASE` (no change needed) — a one-line comment now records this as a deliberate, verified omission rather than an oversight
- 19 new tests added to `gameEngine.outOfBounds.test.ts` (9 for `applyThrowInPlace`, 10 for the `applyEndTurn` throw-in branch, including the `ELIGIBLE_NEXT_ACTIONS.THROW_IN_MOVEMENT_2.has('MOVEMENT') === false` cap assertion)
- Full server suite: 682 tests passing (+19 from this plan's baseline of 663), 1 skipped, 1 todo; full monorepo (`pnpm -r typecheck`) clean

## Task Commits

1. **Task 1: applyThrowInPlace — place the thrower and enter Movement Phase 1** - `338319f` (feat)
2. **Task 2: applyEndTurn throw-in branch — count Movement Phases and drive the D-09 choice** - `01b3fad` (feat)
3. **Task 3: GAME_THROW_IN_PLACE socket handler** - `fd93593` (feat)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — `applyThrowInPlace` + `ApplyThrowInPlaceResult` (new, placed between `triggerOutOfBoundsRestart` and `applyGKRestart`); `applyEndTurn`'s new throw-in movement-counting branch plus unconditional throw-in-field clears added to the half-end and `GK_RESTART` returns
- `packages/server/src/gameHandlers.ts` — `GAME_THROW_IN_PLACE` handler (new, registered after `GAME_FREE_KICK_READY`); `applyThrowInPlace` added to the `gameEngine.js` import block; one-line deliberate-omission comment added to `GAME_START_MOVEMENT`
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` — `describe('applyThrowInPlace')` (9 tests) and `describe('applyEndTurn throw-in movement counting')` (10 tests), plus a `throwInSetupState`/`throwInMoveEndState` fixture pair

## Decisions Made

- Exact insertion point of the `applyEndTurn` branch: immediately after the GK-carrier-in-own-penalty-area `return` block closes (the same `if (carrier?.role === 'GK') { ... }` block whose `carrier` const the new branch reuses) and immediately before the `throwInClear` const / generic `ATTACKER_2→PASS` return. Verified via `grep -n` that the branch's `if (throwInStillValid)` line is numerically greater than the `phase: 'GK_RESTART'` return's line, per the plan's acceptance criteria.
- `throwInStillValid` is a single named boolean rather than an inline compound condition, so the possession-loss elevation-of-privilege guard (T-37-22) is one greppable expression, not scattered across the branch body.
- Reused `applyGKKickTarget`'s guard-ordering convention (phase/context → lookup → ownership) for `applyThrowInPlace` exactly as instructed, rather than inventing a new order.

## Deviations from Plan

None — plan executed exactly as written across all three tasks. As in Plans 37-01 through 37-04, `node_modules`/`packages/shared/dist` were absent at session start (same pre-existing worktree-bootstrap gap) — resolved with `pnpm install --frozen-lockfile` followed by `pnpm --filter @counter-attack/shared build` before any task work began; not a plan deviation, standard worktree setup.

## Issues Encountered

- Same worktree-bootstrap gap noted above — resolved before any task work began, no impact on task execution or timing beyond the initial setup.
- Both Task 1 and Task 2 touch the same two files (`gameEngine.ts` and the shared test file). To keep each task's commit atomic and independently verifiable per the per-task commit protocol, each task's edits were applied, typechecked, and tested in isolation (reverting the working tree to HEAD between tasks via `git checkout --` on the two specific files, then re-applying only that task's edit) before staging and committing — not a deviation, just the mechanism used to satisfy "commit each task atomically" when two tasks share files.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `applyThrowInPlace` and the `applyEndTurn` throw-in-counting branch are exported and ready for Plan 37-06 to build the actual throw (Low/High delivery, 6-hex cap) on top of the `THROW_IN_MOVEMENT_1`/`THROW_IN_MOVEMENT_2` `lastActionType` rows this plan produces.
- `GAME_THROW_IN_PLACE` is the only client-facing entry point into the throw-in Movement Phase; Plan 37-06's throw handlers will be new, separate events (e.g. a low/high throw event) consumed from the `PASS` phase once `lastActionType` is one of the `THROW_IN_MOVEMENT_*` rows.
- Total test count for regression tracking: **server 682 tests (1 skipped, 1 todo)** — up from the 663 baseline recorded at the close of Plan 37-04.

## Threat Flags

None. This plan's threat model (T-37-17 through T-37-22, T-37-SC) was addressed exactly as specified: T-37-17/T-37-18 are closed by the handler's two independent ownership/team guards plus the engine's own re-check of `piece.teamId !== state.throwInTeam`, and by the payload being `pieceId`-only (no client-chosen hex ever reaches the engine). T-37-19 is closed structurally — `applyThrowInPlace` never transitions to `PASS`, so there is no reachable state offering a throw before Movement Phase 1 completes. T-37-20 is closed by the `THROW_IN_MOVEMENT_2` eligibility set (already omitting `MOVEMENT`, added in Plan 37-02) combined with the `throwInPhasesTaken < 2` guard added this plan — two independent blocks on a third Movement Phase. T-37-21 is satisfied by the standard `room.isProcessing` mutex acquired before any state read and released in `finally`. T-37-22 is closed by `throwInStillValid`'s carrier-team check, verified directly by the "does not fire when the carrier belongs to the opposing team" test. No packages were installed (T-37-SC).

## Known Stubs

None. Every artifact this plan's `must_haves` section requires is fully wired: `applyThrowInPlace` places the thrower and starts a real Movement Phase; the `applyEndTurn` branch counts phases and drives the D-09 choice model; the `GAME_THROW_IN_PLACE` handler delegates to it with the full guard sequence. The actual Low/High throw delivery mechanics are intentionally out of this plan's scope (Plan 37-06), not a stub.

---

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts (applyThrowInPlace, ApplyThrowInPlaceResult, applyEndTurn throw-in branch all present)
- FOUND: packages/server/src/gameHandlers.ts (GAME_THROW_IN_PLACE handler, applyThrowInPlace import)
- FOUND: packages/server/src/**tests**/gameEngine.outOfBounds.test.ts (19 new tests present, 35 total in file)
- FOUND: 338319f (feat: Task 1)
- FOUND: 01b3fad (feat: Task 2)
- FOUND: fd93593 (feat: Task 3)

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Plan: 05_
_Completed: 2026-08-03_
