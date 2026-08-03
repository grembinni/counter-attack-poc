---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 02
subsystem: game-engine
tags: [typescript, vitest, socket.io, game-fsm, throw-in, goal-kick, out-of-bounds]

# Dependency graph
requires:
  - phase: 37-01
    provides: 'BallState.lastTouchedBy field and outOfBounds.ts classification module used by this plan's OUT_OF_BOUNDS event shape'
provides:
  - 'Six new GamePhase values (THROW_IN_SETUP, GOAL_KICK_SETUP_GK/OPPONENT, GOAL_KICK_CHOICE/TARGET/MOVE) registered in PHASE_LABEL, BALL_MARKER_PHASES, and (where applicable) validUndoPhases'
  - 'Three new LastActionType rows (THROW_IN_MOVEMENT_1/2, GOAL_KICK_RESTART) with ELIGIBLE_NEXT_ACTIONS eligibility sets enforcing the D-09 two-movement-phase cap'
  - 'Six new ActionEventType/ActionEvent variants (OUT_OF_BOUNDS, THROW_IN_PLACE, GOAL_KICK_WINDOW_ADVANCE, GOAL_KICK_CHOICE, GOAL_KICK_MOVE, GOAL_KICK) with ActionLog rendering and replay/undo registration'
  - 'Three new typed client socket events (GAME_THROW_IN_PLACE, GAME_GOAL_KICK_CHOICE, GAME_GOAL_KICK_TARGET)'
  - 'validatePass optional maxDistance override (THROWIN-04) that replaces the per-type distance cap without changing existing caller behavior'
  - 'ROOM_SETTINGS_CONFIRM/CONFIRMED extended with outOfBounds: boolean (type contract only — Room.outOfBoundsEnabled wiring is 37-03)'
affects: [37-03, 37-04, 37-05, 37-06, 37-07, 37-08, 37-09, 37-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'New GamePhase values require registration in four lists: PHASE_LABEL (compiler-enforced), GameBoard dispatch ternary (NOT compiler-enforced), validUndoPhases (server), BALL_MARKER_PHASES (client) — this plan closes all four for the six new phases'
    - 'New ActionEventType values require registration in: ActionLog.formatEvent (compiler-enforced via exhaustive switch), REPLAY_ELIGIBLE_TYPES, buildReplayFrames event loop, and applyUndo boundary scan — this plan closes all four for the six new event types'
    - 'GOAL_KICK is deliberately its own ActionEventType, never DICE_ROLL, to avoid reactivating a dormant full-slot Undo lockout (STATE.md pitfall)'
    - 'goalKickEligibleIds/goalKickUsedPace mirror the freeMoveEligibleIds/freeMoveUsedPace shape; goalKickMoveSlot/goalKickMovedPieceId/goalKickPaceUsed mirror gkKickMovementSlot/gkKickMovedPieceId/gkKickPaceUsed'

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/actionSequence.ts
    - packages/shared/src/actionSequence.test.ts
    - packages/shared/src/events.ts
    - packages/shared/src/passValidator.ts
    - packages/shared/src/passValidator.test.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/BallLocationRing.tsx
    - packages/server/src/roomHandlers.ts
    - packages/client/src/App.tsx
    - packages/client/src/App.test.tsx
    - packages/client/src/components/GameSettingsScreen.tsx
    - packages/client/src/components/GameSettingsScreen.test.tsx
    - packages/server/src/__tests__/testHelpers.ts
    - packages/server/src/__tests__/draftReconnect.integration.test.ts
    - packages/server/src/__tests__/draftSession.integration.test.ts
    - packages/server/src/__tests__/room.integration.test.ts

key-decisions:
  - 'outOfBounds: boolean threaded through ROOM_SETTINGS_CONFIRM/CONFIRMED as a required field with a hardcoded false placeholder at every call site (roomHandlers.ts, App.tsx/GameSettingsScreen.tsx, all server integration test fixtures) — the actual settings-screen checkbox and Room.outOfBoundsEnabled storage is Plan 37-03s scope; this plan only had to keep the monorepo compiling'
  - 'GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT are two separate GamePhase values (not one phase + a window flag), mirroring the FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE precedent, per RESEARCH.md Open Question 2'
  - 'THROW_IN_SETUP/GOAL_KICK_CHOICE/GOAL_KICK_TARGET deliberately excluded from validUndoPhases (no reversible piece move in those phases); GOAL_KICK_SETUP_GK/OPPONENT/MOVE included'

requirements-completed: [OOB-05, THROWIN-03, GOALKICK-01, GOALKICK-03, GOALKICK-06]

# Metrics
duration: 35min
completed: 2026-08-03
---

# Phase 37 Plan 02: Type Contracts for Out-of-Bounds, Throw-In & Goal Kick Summary

**Six new GamePhase/ActionEvent/ClientEvents contracts for throw-in and goal-kick declared and registered in every compiler-enforced and non-compiler-enforced consumer list, with the monorepo kept fully compiling and green across all three packages.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-03T17:15:00-05:00 (approx)
- **Completed:** 2026-08-03T17:50:13-05:00
- **Tasks:** 3
- **Files modified:** 20 (0 created, 20 modified)

## Accomplishments

- `types.ts` extended with 6 new `GamePhase` values, 3 new `LastActionType` rows, 6 new `ActionEventType`/`ActionEvent` variants, and 12 new optional `GameState` fields — all pure type declarations, no behavior change
- `actionSequence.ts`'s `ELIGIBLE_NEXT_ACTIONS` gains `THROW_IN_MOVEMENT_1`/`THROW_IN_MOVEMENT_2`/`GOAL_KICK_RESTART` rows, with `THROW_IN_MOVEMENT_2` deliberately omitting `MOVEMENT` to enforce D-09's hard two-movement-phase cap server-side (not just UI-hidden)
- `events.ts` gains 3 new typed client socket events and extends `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` with the `outOfBounds` toggle
- `passValidator.ts`'s `validatePass` gains an optional `maxDistance` override for THROWIN-04's 6-hex throw cap, with 2 new regression tests proving existing per-type behavior is unchanged when the option is absent
- All six new phases and six new event types registered across `GameBoard.tsx` (`PHASE_LABEL`), `ActionLog.tsx` (`formatEvent` exhaustive switch), `BallLocationRing.tsx` (`BALL_MARKER_PHASES`), `gameEngine.ts` (`REPLAY_ELIGIBLE_TYPES`, `buildReplayFrames`, `applyUndo` boundary/moveTypeForPhase/Extract-cast/lockReset), and `gameHandlers.ts` (`validUndoPhases`), with deliberate exclusions documented in code comments
- Full monorepo (shared/server/client) typechecks and builds clean; test suite grew from 1,754 to 1,760 (shared 635, server 642, client 483), zero regressions

## Task Commits

1. **Task 1: Declare new phases, state fields, last-action types and action events** - `38ad9eb` (feat)
2. **Task 2: Add eligibility rows, socket events and the validatePass distance-cap override** - `440b3e8` (feat)
3. **Task 3: Register the new phases and events in every consumer list** - `e3ccdf1` (feat)

## Files Created/Modified

- `packages/shared/src/types.ts` - 6 new `GamePhase` values, 3 new `LastActionType` rows, 6 new `ActionEventType`/`ActionEvent` variants, 12 new `GameState` optional fields
- `packages/shared/src/actionSequence.ts` / `.test.ts` - `THROW_IN_MOVEMENT_1`/`THROW_IN_MOVEMENT_2`/`GOAL_KICK_RESTART` eligibility rows + tests
- `packages/shared/src/events.ts` - `GAME_THROW_IN_PLACE`/`GAME_GOAL_KICK_CHOICE`/`GAME_GOAL_KICK_TARGET` events; `ROOM_SETTINGS_CONFIRM`/`CONFIRMED` `outOfBounds` extension
- `packages/shared/src/passValidator.ts` / `.test.ts` - optional `maxDistance` override + 2 tests
- `packages/client/src/components/GameBoard.tsx` - `PHASE_LABEL` gains 6 keys; Pitfall-1 comment above the dispatch ternary
- `packages/client/src/components/ActionLog.tsx` - `formatEvent` gains 6 cases; new `teamDisplayName` helper for `OUT_OF_BOUNDS`'s awarded-team text
- `packages/client/src/components/BallLocationRing.tsx` - `BALL_MARKER_PHASES` gains 6 phases
- `packages/server/src/gameEngine.ts` - `REPLAY_ELIGIBLE_TYPES`, `buildReplayFrames` (THROW*IN_PLACE move-group accumulation + 3-event skip guard), `applyUndo` (boundary scan, `moveTypeForPhase`, `Extract` cast, `lockReset` for `GOAL_KICK_MOVE` and the two `GOAL_KICK_SETUP*\*` windows)
- `packages/server/src/gameHandlers.ts` - `validUndoPhases` gains `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT`/`GOAL_KICK_MOVE`
- `packages/server/src/roomHandlers.ts` - both `ROOM_SETTINGS_CONFIRMED` emit sites pass `outOfBounds: false` placeholder
- `packages/client/src/App.tsx`, `packages/client/src/components/GameSettingsScreen.tsx` - `outOfBounds: false` placeholder threaded through the client confirm flow
- Test fixtures (`App.test.tsx`, `GameSettingsScreen.test.tsx`, `testHelpers.ts`, `draftReconnect.integration.test.ts`, `draftSession.integration.test.ts`, `room.integration.test.ts`) - mechanical `outOfBounds: false` addition to keep runtime assertions in sync with the new required field

## Decisions Made

- **outOfBounds placeholder threading:** extending `ROOM_SETTINGS_CONFIRM`'s payload with a required `outOfBounds: boolean` field (per plan spec) broke every existing call site across server and client packages at compile time. Rather than leave the monorepo non-compiling until Plan 37-03 lands (which would violate this plan's own "the monorepo compiles" success criterion), threaded a behavior-preserving `outOfBounds: false` literal through every affected call site. No new UI or Room-state behavior was added — the actual checkbox and `Room.outOfBoundsEnabled` storage remains Plan 37-03's scope.
- **GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT as two phase values:** matches the existing `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` precedent rather than one phase + a window flag, per RESEARCH.md Open Question 2's resolution.
- **validUndoPhases exclusions:** `THROW_IN_SETUP`/`GOAL_KICK_CHOICE`/`GOAL_KICK_TARGET` deliberately NOT added — those phases contain no reversible piece move, so adding them would make Undo a silent no-op. Reasoning documented in code comments per the plan's explicit instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` type extension broke compilation across server and client packages**

- **Found during:** Task 2, verifying `pnpm --filter @counter-attack/server exec tsc --noEmit` and `pnpm --filter @counter-attack/client exec tsc --noEmit` after adding the required `outOfBounds` field
- **Issue:** The plan (Task 2) explicitly specifies extending `ROOM_SETTINGS_CONFIRM`'s payload and `ROOM_SETTINGS_CONFIRMED`'s signature with a required `outOfBounds: boolean`. Making it required (not optional) is correct per the plan text, but it broke every existing emit call site (2 in `roomHandlers.ts`, 1 in `App.tsx`) and every test fixture constructing the settings object literal (17 sites across 4 server test files, 1 client test file) — none of which are in Task 2/3's declared `files_modified` list, yet the plan's own objective states "the monorepo compiles."
- **Fix:** Threaded a hardcoded `outOfBounds: false` placeholder through every affected call site (2 server emit sites, the client confirm-flow signature chain, and all test fixtures/assertions). No new checkbox UI or `Room.outOfBoundsEnabled` storage was added — this is a type-safety-preserving placeholder only; the real wiring is explicitly Plan 37-03's scope per the plan's own "Produced by other plans" list.
- **Files modified:** `packages/server/src/roomHandlers.ts`, `packages/client/src/App.tsx`, `packages/client/src/App.test.tsx`, `packages/client/src/components/GameSettingsScreen.tsx`, `packages/client/src/components/GameSettingsScreen.test.tsx`, `packages/server/src/__tests__/testHelpers.ts`, `packages/server/src/__tests__/draftReconnect.integration.test.ts`, `packages/server/src/__tests__/draftSession.integration.test.ts`, `packages/server/src/__tests__/room.integration.test.ts`
- **Verification:** Full monorepo typecheck (`tsc --noEmit` per package) clean; `pnpm --filter @counter-attack/server test` (642 passed) and `pnpm --filter @counter-attack/client test` (483 passed) both green
- **Committed in:** `440b3e8` (Task 2), `e3ccdf1` (Task 3 — the two test-assertion fixups surfaced by Task 3's server/client test verify step)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking compile fix, mechanically applied across many call sites)
**Impact on plan:** No scope creep — the fix is a type-safety placeholder with a hardcoded `false`, not new behavior. All actual `outOfBounds` wiring (settings checkbox, `Room.outOfBoundsEnabled`, `GameState.outOfBoundsEnabled` at match start) remains Plan 37-03's responsibility exactly as the plan's "Produced by other plans" list specifies.

## Issues Encountered

None beyond the deviation above. `pnpm install --frozen-lockfile` was required at the start of this session since the worktree had no `node_modules` (same setup step Plan 37-01 encountered).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six new `GamePhase` values, three new `LastActionType` rows, six new `ActionEventType`/`ActionEvent` variants, and three new typed client socket events are declared, registered everywhere required, and ready for Plans 37-03 through 37-10 to build behavior against.
- `validatePass`'s `maxDistance` override is ready for Plan 37-05's 6-hex throw-in cap.
- `ELIGIBLE_NEXT_ACTIONS` enforces the D-09 two-movement-phase cap at the data level — Plan 37-05/37-06's handler wiring can rely on server-side rejection of a third Movement Phase without duplicating the check.
- `Room.outOfBoundsEnabled` does NOT yet exist — Plan 37-03 must add it to `roomStore.ts` and replace the `outOfBounds: false` placeholders in `roomHandlers.ts`/`App.tsx`/`GameSettingsScreen.tsx` with real values threaded from the settings checkbox.
- Total test count recorded for regression tracking: **shared 635 / server 642 (1 skipped, 1 todo) / client 483 = 1,760 tests total, all green.** Later plans in this phase should expect this as their baseline.

## Threat Flags

None — this plan's threat model (T-37-04 through T-37-07, T-37-SC) was fully addressed as specified: `THROW_IN_MOVEMENT_2`'s eligibility set omits `MOVEMENT` (server-enforced, not UI-only); `GAME_THROW_IN_PLACE`'s payload carries only `pieceId` (destination hex stays server-owned); `validatePass`'s `maxDistance` override is server-supplied only (no client payload path added in this plan); `ROOM_SETTINGS_CONFIRM.outOfBounds` is declared as `boolean` (allow-list validation is Plan 37-03's scope). No packages were installed.

## Known Stubs

None. Every artifact this plan's `must_haves` section requires is fully wired: all six phases/event types are registered in every consumer list with no placeholder rendering; the `outOfBounds: false` values threaded through `ROOM_SETTINGS_CONFIRM`/`CONFIRMED` are documented in code as an explicit, intentional Plan 37-03 handoff (not a forgotten stub) and do not affect this plan's own `must_haves`.

---

## Self-Check: PASSED

- FOUND: packages/shared/src/types.ts (GamePhase/LastActionType/ActionEventType additions present)
- FOUND: packages/shared/src/actionSequence.ts (THROW_IN_MOVEMENT_1/2, GOAL_KICK_RESTART rows present)
- FOUND: packages/shared/src/events.ts (GAME_THROW_IN_PLACE/GAME_GOAL_KICK_CHOICE/GAME_GOAL_KICK_TARGET present)
- FOUND: packages/shared/src/passValidator.ts (maxDistance option present)
- FOUND: packages/client/src/components/GameBoard.tsx (6 new PHASE_LABEL keys present)
- FOUND: packages/client/src/components/ActionLog.tsx (6 new formatEvent cases present)
- FOUND: packages/client/src/components/BallLocationRing.tsx (6 new BALL_MARKER_PHASES entries present)
- FOUND: packages/server/src/gameEngine.ts (REPLAY_ELIGIBLE_TYPES/buildReplayFrames/applyUndo registrations present)
- FOUND: packages/server/src/gameHandlers.ts (validUndoPhases additions present)
- FOUND: 38ad9eb (feat: Task 1)
- FOUND: 440b3e8 (feat: Task 2)
- FOUND: e3ccdf1 (feat: Task 3)

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Plan: 02_
_Completed: 2026-08-03_
