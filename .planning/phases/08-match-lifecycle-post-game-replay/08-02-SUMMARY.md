---
phase: 08-match-lifecycle-post-game-replay
plan: '02'
subsystem: server/game-engine
tags: [game-engine, clock, action-sequence, snapshot, tdd, phase8]
dependency_graph:
  requires:
    - 08-01 (LastActionType, ELIGIBLE_NEXT_ACTIONS, GameState Phase 8 fields from shared)
  provides:
    - applyEndTurn clock hook (+3 min, addedTime inline roll, HALF_TIME/FULL_TIME branching)
    - lastActionType updates across all applyRoll branches (D-12..D-21)
    - applyGKRestart Phase 8 lastActionType + time cost updates
    - applyMove STEAL_ATTEMPT SUCCESSFUL_TACKLE lastActionType + actionCount
    - applySnapshot function (SNAP-01..03)
    - snapshotPenalty marker in GameState / SHOT branch penalty application
  affects:
    - packages/server (gameEngine.ts extended)
    - packages/shared (types.ts: snapshotPenalty optional field added)
tech_stack:
  added: []
  patterns:
    - Injected dice pattern (addedTimeRoll option in applyEndTurn, mirrors applyGKRestart)
    - Discriminated union result type (ApplySnapshotResult)
    - ELIGIBLE_NEXT_ACTIONS lookup for sequence validation in applySnapshot
    - snapshotPenalty boolean flag in GameState; consumed server-side in applyRoll SHOT branch
key_files:
  created:
    - packages/server/src/__tests__/gameEngine.phase8.test.ts
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/__tests__/game.integration.test.ts
    - packages/shared/src/types.ts
decisions:
  - 'addedTimeRoll injected via options parameter (not rollDie function) — simpler API, mirrors intent'
  - 'snapshotPenalty stored as optional boolean in GameState (not derived) — server-authoritative, T-08-04'
  - 'PASS branch accurate result stays in PASS phase (action-choice) per D-09; HIGH_PASS -> HEADER exception'
  - 'lastActionType in PASS branch: use state.lastActionType if already a pass type; default STANDARD_PASS'
metrics:
  duration_seconds: 1440
  completed: '2026-06-04'
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 8 Plan 02: Game Engine Clock, Action Sequence, and Snapshot Summary

**One-liner:** Match clock (+3 min per movement, inline added-time roll at 45, HALF_TIME/FULL_TIME), per-action lastActionType updates across all applyRoll/applyGKRestart branches, PASS->SHOT removal (D-09), and applySnapshot with -1 penalty marker (SNAP-01..03) implemented in the pure game engine.

## Tasks Completed

| Task | Name                                                          | Commit                         | Files                                                                 |
| ---- | ------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| TDD RED | All phase8 tests (clock, lastActionType, applySnapshot)    | 05895ea                        | packages/server/src/__tests__/gameEngine.phase8.test.ts               |
| 1    | applyEndTurn clock hook + added-time roll + half/full-time   | 6e577a7 (GREEN, all 3 tasks)   | packages/server/src/gameEngine.ts                                     |
| 2    | lastActionType updates + PASS->action-choice restructure      | 6e577a7                        | packages/server/src/gameEngine.ts                                     |
| 3    | applySnapshot engine function (SNAP-01, SNAP-02, SNAP-03)    | 6e577a7                        | packages/server/src/gameEngine.ts, packages/shared/src/types.ts       |
| fix  | Integration test update for D-09 PASS restructure             | c8c1cb4                        | packages/server/src/__tests__/game.integration.test.ts                |

## What Was Built

**applyEndTurn — Phase 8 clock hook (MATCH-01, MATCH-02):**

- Added `options?: { addedTimeRoll?: number }` parameter (injection pattern per Pitfall 1 — no randomInt inside engine)
- At ATTACKER_2→null transition: `newActionCount = state.actionCount + 3`
- Added-time guard: `if (newActionCount >= 45 && state.addedTime === null)` → `newAddedTime = options.addedTimeRoll + state.refereeCard.leniency` (Pitfall 3: only set once)
- Half-time threshold: `halfEnd = 45 + (newAddedTime ?? 0)` → `HALF_TIME` (half 1) or `FULL_TIME` (half 2) when `newActionCount >= halfEnd` (Pitfall 5)
- All transitions set `lastActionType: 'MOVEMENT_PHASE'`

**buildInitialGameState — Phase 8 fields (D-06):**

- `addedTime: null` — seeds correctly per MATCH-02
- `lastActionType: null` — null at match start
- `kickOffTeam: attackingTeam` — coin-flip winner as kick-off team

**applyRoll PASS branch — D-09 restructure (Pitfall 8):**

- Accurate pass no longer transitions to `phase: 'SHOT'`
- Returns to neutral action-choice state (`phase: 'PASS'`) with `lastActionType: 'STANDARD_PASS'` (default) or uses handler-set lastActionType if it's a pass type
- Exception: `lastActionType === 'HIGH_PASS'` → `phase: 'HEADER'` (mandatory next action per D-08)
- Time cost: `passTimeCost = lastActionType === 'FIRST_TIME_PASS' ? 0 : 1`
- Inaccurate pass: stays as LOOSE_BALL (unchanged), time cost still applied

**applyRoll per-branch lastActionType + time (D-12..D-21):**

- PASS inaccurate → LOOSE_BALL (no lastActionType change yet)
- LOOSE_BALL → `lastActionType: 'DEFLECTION'`, +0 min (D-20)
- SHOT GOAL → `lastActionType: null` (D-19), +0 min
- SHOT non-GOAL → `snapshotPenalty: false` cleared on all outcomes
- HEADER all outcomes → `lastActionType: 'HEADER'`, +0 min (D-17)

**applyGKRestart — Phase 8 (D-21):**

- `'kick'` accurate: `lastActionType: 'MOVEMENT_PHASE'`, `actionCount + 1`
- `'kick'` inaccurate: `lastActionType: 'DEFLECTION'`, `actionCount + 1`
- `'throw'`: `lastActionType: 'STANDARD_PASS'`, +0 min
- `'movement'`: `lastActionType: null`, +0 min

**applyMove STEAL_ATTEMPT SUCCESS — Phase 8 (D-14):**

- On steal success: `lastActionType: 'SUCCESSFUL_TACKLE'`, `actionCount + 3`

**applySnapshot — SNAP-01..03:**

- `ApplySnapshotResult` discriminated union exported
- Validation order: (1) sequence guard via `ELIGIBLE_NEXT_ACTIONS[lastActionType].has('SNAPSHOT')` → `INVALID_SEQUENCE`; (2) phase/position guard
- Valid triggers: MOVEMENT phase with ball-carrier in opponent penalty area, OR PASS phase (immediately post-accurate-pass)
- Success: `phase: 'SHOT'`, `lastActionType: 'SNAPSHOT'`, `snapshotPenalty: true`, `actionCount` unchanged
- SHOT branch reads `state.snapshotPenalty` and passes `shooterPenalties: [-1]` to `validateShotDuel` (T-08-04: server-side penalty, client cannot bypass)

**snapshotPenalty field added to GameState (packages/shared/src/types.ts):**

- `snapshotPenalty?: boolean` — optional; true when current SHOT was entered via applySnapshot; cleared after shot resolves

## TDD Gate Compliance

- RED gate: commit `05895ea` — 32 tests written before implementation (25 failing, 7 passing on pre-existing logic)
- GREEN gate: commit `6e577a7` — all 32 phase8 tests pass
- REFACTOR gate: fix commit `c8c1cb4` — existing integration test updated to reflect D-09 behavior (not a refactor of new code; Rule 1 auto-fix of pre-existing test with incorrect assertion)

## Verification Evidence

- `pnpm --filter @counter-attack/server test -- gameEngine.phase8` → 32 tests pass
- `-t "clock"` → 9 tests pass (actionCount+3, addedTime inline, HALF_TIME/FULL_TIME by half)
- `-t "lastActionType"` → 16 tests pass (per-branch values, applyGKRestart, inaccurate pass)
- `-t "applySnapshot"` → 7 tests pass (SNAP-01 rejection, SNAP-02 marker, SNAP-03 shot outcome)
- `applyEndTurn` does NOT contain any new `randomInt(` calls inside the function body (Pitfall 1 satisfied)
- Accurate Standard pass does NOT yield `phase === 'SHOT'` (D-09, Pitfall 8 satisfied)
- TypeScript `tsc --noEmit` exits 0 on the server package

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated gameEngine.test.ts PASS->SHOT test to reflect D-09 correct behavior**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Existing test at line 503 expected `phase === 'SHOT'` after accurate STANDARD pass — this was the OLD (incorrect) behavior we were specifically removing per D-09/Pitfall 8
- **Fix:** Updated test description and assertion: `expect(result.state.phase).not.toBe('SHOT')`, added `lastActionType` and `actionCount` assertions
- **Files modified:** `packages/server/src/__tests__/gameEngine.test.ts`
- **Commit:** 6e577a7

**2. [Rule 1 - Bug] Updated game.integration.test.ts game:roll PASS phase test for D-09**
- **Found during:** Post-commit verification (full test suite run)
- **Issue:** Integration test expected `['SHOT', 'LOOSE_BALL'].toContain(newState.phase)` — with D-09, accurate pass now returns to PASS (action-choice), so SHOT is no longer a valid outcome from game:roll in PASS phase
- **Fix:** Changed assertion to `expect(['PASS', 'LOOSE_BALL']).toContain(newState.phase)` with explanatory D-09 comment
- **Files modified:** `packages/server/src/__tests__/game.integration.test.ts`
- **Commit:** c8c1cb4

**3. [Rule 2 - Missing critical functionality] Added `snapshotPenalty` to shared GameState type**
- **Found during:** Task 3 implementation
- **Issue:** `snapshotPenalty` flag needed in GameState to carry the -1 penalty marker from applySnapshot into applyRoll SHOT branch (SNAP-02 requirement — server-authoritative, client cannot bypass T-08-04)
- **Fix:** Added `snapshotPenalty?: boolean` to GameState in `packages/shared/src/types.ts`
- **Files modified:** `packages/shared/src/types.ts`
- **Commit:** 6e577a7

### Pre-existing Test Failures (Out of Scope)

The following 2 integration test failures existed before this plan's changes and are NOT caused by our modifications:
- "D-10 undo reverses last move within the current slot" — pre-existing assertion mismatch on undo position
- "D-09 UNDO_LOCKED: undo after a SLOT_ADVANCE is rejected for the defending team" — pre-existing NOTHING_TO_UNDO vs UNDO_LOCKED mismatch

These are documented as known gaps for a future plan.

## Known Stubs

None. All engine functions are fully implemented with no placeholder values or TODO markers.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| None | — | No new network endpoints, auth paths, or trust-boundary surface introduced. All changes are to pure engine functions (no I/O). snapshotPenalty marker is set and consumed server-side — no client influence (T-08-04 satisfied). |

## Self-Check: PASSED

| Item                                                                          | Status |
| ----------------------------------------------------------------------------- | ------ |
| packages/server/src/__tests__/gameEngine.phase8.test.ts                       | FOUND  |
| packages/server/src/gameEngine.ts (applyEndTurn with addedTimeRoll option)    | FOUND  |
| packages/server/src/gameEngine.ts (applySnapshot exported)                    | FOUND  |
| packages/shared/src/types.ts (snapshotPenalty field)                          | FOUND  |
| Commit 05895ea (RED: test)                                                    | FOUND  |
| Commit 6e577a7 (GREEN: all tasks implementation)                              | FOUND  |
| Commit c8c1cb4 (fix: integration test update)                                 | FOUND  |
| 32 phase8 tests pass (verified via vitest run)                                | PASSED |
| No new randomInt inside applyEndTurn (Pitfall 1)                              | PASSED |
| Accurate STANDARD pass does not yield phase SHOT (D-09, Pitfall 8)           | PASSED |
