---
phase: 10-remaining-action-flows-tech-debt
plan: 05
subsystem: ui
tags: [react, zustand, socket.io, typescript, vitest, integration-tests]

# Dependency graph
requires:
  - phase: 10-remaining-action-flows-tech-debt
    provides: 'Plans 01-04: shared types (GK_DIVING/SNAP_DEFLECT phases, GAME_GK_DIVE/GAME_HEADER_TARGET events), engine functions (applyDeclareShot, applyGKDive, applyDeclareHeaderTarget), handler layer wiring; emitDeclareShot/emitGKDive/emitHeaderTarget + shootingMode state (plan 05 Task 1)'
provides:
  - 'Two-step Shoot flow wired: ActionPanel Shoot button → shootingMode → HexGrid goal-hex highlights → emitDeclareShot'
  - "Snapshot wired in MOVEMENT and PASS/ACTION phases (emitSnapshot, isEligible('SNAPSHOT') guard)"
  - 'GK_DIVING phase UI: GK team repositions with End Turn; opponent sees wait panel'
  - 'SNAP_DEFLECT phase UI: defending team moves player; attacker waits'
  - 'HEADER target-hex step: after both teams confirm contestants, attacker clicks goal-line hex → emitHeaderTarget'
  - 'D-19 WR-04: single HEADER resolution route (no Roll Header button)'
  - 'D-27 fix: STANDARD_PASS and FIRST_TIME_PASS ActionLog entries show passer team colour'
  - 'D-28 fix: GK_DIVING/SNAP_DEFLECT phases suppress stale gold move highlights'
  - 'D-25 fix: 4 previously-failing integration tests updated to real squad positions and new GAME_SHOT behavior'
affects: [UAT, phase 11, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Two-step Shoot flow: client state flag (shootingMode) gates second click to goal-line hex; emitDeclareShot on hex click'
    - 'Phase-gated ActionPanel blocks (GK_DIVING, SNAP_DEFLECT) mirror HIGH_PASS_MOVEMENT pattern: team guard + label + End Turn'
    - 'D-27: passerId added to STANDARD_PASS/FIRST_TIME_PASS ActionEvent so log prefix can derive team colour via pieceColorOf'

key-files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/ActionLog.tsx
    - packages/server/src/gameEngine.ts
    - packages/shared/src/types.ts
    - packages/server/src/__tests__/game.integration.test.ts

key-decisions:
  - 'ActionPanel already had GK_DIVING/SNAP_DEFLECT/HEADER-target blocks from prior chore commit (25ba033) — no re-implementation needed; Task 2 only required ActionLog D-27 + shared types additions'
  - 'D-27: add passerId to STANDARD_PASS and FIRST_TIME_PASS ActionEvent (shared types + engine) to enable team-colour prefix in ActionLog — simplest correct fix avoiding runtime team derivation'
  - 'game:shot integration tests updated to reflect D-02 rework: handler now guards PASS (not SHOT) and calls applyDeclareShot → GK_DIVING with broadcastState; old shotTarget-on-room assertion removed'
  - 'D-25: integration tests used placeholder coords far outside piece home positions; fix uses real HOME_SQUAD/AWAY_SQUAD positions from teams.ts for adjacent valid moves'

patterns-established:
  - 'passerId on STANDARD_PASS/FIRST_TIME_PASS: pattern to follow for any new ActionEvent type that needs team-coloured log entries'
  - 'Integration test seeding: use real squad positions from teams.ts, not placeholder coords; always verify adjacency (hexDistance=1)'

requirements-completed:
  [
    SHOT-01,
    SHOT-02,
    SHOT-03,
    SHOT-04,
    SNAP-02,
    SNAP-03,
    HEAD-01,
    HEAD-02,
    HEAD-03,
    HEAD-04,
    HEAD-05,
  ]

# Metrics
duration: 45min
completed: 2026-06-10
---

# Phase 10 Plan 05: Client UI Wiring + Integration Test Fixes Summary

**Two-step Shoot, GK_DIVING/SNAP_DEFLECT/HEADER-target UI wired end-to-end; D-27 pass-log team colour applied; 4 failing integration tests fixed to use real squad positions and the reworked GAME_SHOT handler**

## Performance

- **Duration:** 45 min
- **Started:** 2026-06-10T15:30:00Z
- **Completed:** 2026-06-10T16:15:00Z
- **Tasks:** 3 (Tasks 1 already committed; Tasks 2-3 completed here)
- **Files modified:** 6

## Accomplishments

- ActionPanel, HexGrid, ActionLog fully wired for Phase 10 shot/snap/header flows
- D-27 fix: STANDARD_PASS/FIRST_TIME_PASS log entries now show passer team colour (passerId added to ActionEvent union)
- D-28 fix: GK_DIVING and SNAP_DEFLECT phases suppress stale gold movement highlights
- All 4 previously-failing integration tests now pass (D-25 undo/UNDO_LOCKED + D-02 GAME_SHOT rework assertions)
- Full server suite green: 223 tests pass, 1 skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Store wiring (emitDeclareShot/emitGKDive/emitHeaderTarget, shootingMode)** — `d932683` (feat, prior commit)
2. **Task 2: ActionPanel + HexGrid + ActionLog** — `f1099a5` (feat)
3. **Task 3: Fix 4 failing integration tests (D-25)** — `8c0ee8b` (fix)

**Plan metadata:** (committed below as docs commit)

## Files Created/Modified

- `packages/client/src/components/ActionPanel.tsx` — GK_DIVING/SNAP_DEFLECT/HEADER-target blocks, two-step Shoot, Snapshot wired, D-18 WR-03
- `packages/client/src/components/HexGrid.tsx` — shootingMode goal-line highlights, GK dive targets, HEADER target routing, D-28 highlight suppression
- `packages/client/src/components/ActionLog.tsx` — D-27 STANDARD_PASS/FIRST_TIME_PASS passerId team colour
- `packages/shared/src/types.ts` — passerId added to STANDARD_PASS and FIRST_TIME_PASS ActionEvent
- `packages/server/src/gameEngine.ts` — passerId: carrier.id in STANDARD_PASS/FIRST_TIME_PASS event creation
- `packages/server/src/__tests__/game.integration.test.ts` — D-25: real squad positions + game:shot D-02 rework assertions

## Decisions Made

- ActionPanel/HexGrid Phase 10 code was pre-staged in a prior chore commit (25ba033) — no re-implementation was needed; Task 2 focused on the remaining D-27 fix and shared type changes.
- `passerId` was added to `STANDARD_PASS` and `FIRST_TIME_PASS` ActionEvent types (simplest fix per PATTERNS.md D-27 guidance) rather than deriving team at render time.
- game:shot integration tests rewritten to reflect the D-02 handler rework: `seedPassPhaseForShot` seeds PASS phase with a ball carrier; assertions check for GK_DIVING transition (not the old `shotTarget` room field).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added passerId to STANDARD_PASS/FIRST_TIME_PASS ActionEvent and gameEngine event creation**

- **Found during:** Task 2 (ActionLog D-27 fix)
- **Issue:** ActionLog D-27 fix requires team colour on STANDARD_PASS/FIRST_TIME_PASS entries, but the event type lacked passerId. Without the type change the fix would require fragile runtime derivation.
- **Fix:** Extended both ActionEvent union members to include `passerId: string`; added `passerId: carrier.id` in gameEngine.ts event creation. Rebuilt shared package.
- **Files modified:** packages/shared/src/types.ts, packages/server/src/gameEngine.ts
- **Verification:** `cd packages/client && npx tsc --noEmit` + `cd packages/server && npx tsc --noEmit` both exit 0
- **Committed in:** f1099a5 (Task 2 commit)

**2. [Rule 1 - Bug] game:shot integration tests used obsolete SHOT-phase seeding and stale room.shotTarget assertion**

- **Found during:** Task 3 (integration test fix)
- **Issue:** Plan listed 3 failing tests but there were 4: D-10 undo, D-09 UNDO_LOCKED, plus 2 game:shot tests that broke when the D-02 handler rework changed phase guard (SHOT→PASS) and added broadcastState. The old tests used `seedShotPhase` (SHOT phase) and checked `room.shotTarget`.
- **Fix:** Replaced `seedShotPhase` with `seedPassPhaseForShot` (PASS phase + ball carrier); updated test assertions to check GK_DIVING transition and phase-unchanged-on-error.
- **Files modified:** packages/server/src/**tests**/game.integration.test.ts
- **Verification:** `cd packages/server && npx vitest run src/__tests__/game.integration.test.ts` — all 18 tests pass (1 skipped todo)
- **Committed in:** 8c0ee8b (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 2 missing data field, 1 Rule 1 outdated test assertions)
**Impact on plan:** Both fixes necessary for correctness. No scope creep; all changes within the plan's files_modified list or shared types (required by ActionLog fix).

## Issues Encountered

- Task 2 discovered that ActionPanel.tsx and HexGrid.tsx already had all Phase 10 UI code from a prior Phase 8.2 chore commit (25ba033). This accelerated Task 2 significantly — only the ActionLog D-27 fix + shared types remained.
- Task 3 found 4 failing tests instead of the expected 3: the game:shot tests failed due to the D-02 handler rework (PASS phase guard + broadcastState) that wasn't covered in the D-25 description.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Task 4 (UAT checkpoint) is ready: all automated code is committed and green.
- Human UAT required: UAT-01 (snapshot + SNAP_DEFLECT), UAT-02 (header-at-goal + GK_DIVING), UAT-03 (HEADER auto-roll, no Roll Header button), D-14 (regular shot + GK save/restart flow).
- Start dev server with `pnpm dev` (from repo root) and open two browser tabs.

---

_Phase: 10-remaining-action-flows-tech-debt_
_Completed: 2026-06-10_
