---
phase: 24-auto-assignment-lineup
plan: '03'
subsystem: server
tags: [lineup, assignment, socket-handlers, tdd, security]
dependency_graph:
  requires: [24-01, 24-02]
  provides: [ASSIGN-02, ASSIGN-03, ASSIGN-04, ASSIGN-05]
  affects: [roomHandlers, roomStore, lineupAssignment.integration.test]
tech_stack:
  added: []
  patterns:
    - Per-socket emit for private assignment delivery (D-12)
    - isProcessing mutex wrapping new LINEUP_SWAP and LINEUP_CONFIRM handlers
    - Parallel both-confirm gate (D-25) — no home-first sequential gate
    - D-11 PlayerId[] → PoolPlayer[] resolution before buildInitialGameState
    - Rule 1 mass test-helper update pattern (11 files, same fix applied uniformly)
key_files:
  created:
    - packages/server/src/__tests__/lineupAssignment.integration.test.ts
  modified:
    - packages/server/src/roomStore.ts
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/game.integration.test.ts
    - packages/server/src/__tests__/gameHandlers.test.ts
    - packages/server/src/__tests__/gameHandlers.phase10.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts
    - packages/server/src/__tests__/gameHandlers.phase18-02.test.ts
    - packages/server/src/__tests__/gameHandlers.rule11.test.ts
    - packages/server/src/__tests__/kickoffSetup.integration.test.ts
    - packages/server/src/__tests__/replay.integration.test.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/server/src/__tests__/shotGkRange.test.ts
decisions:
  - 'D-25 corrected: LINEUP_CONFIRM is a parallel both-confirm gate — either player may confirm first; no home-first sequential requirement'
  - 'D-11: LINEUP_CONFIRM resolves stored PlayerId[] → PoolPlayer[] via PLAYER_POOL before calling buildInitialGameState; engine receives explicit confirmed order'
  - 'D-12: LINEUP_ASSIGNMENT_READY and LINEUP_ASSIGNMENT_UPDATED emitted per socket via io.sockets.sockets.get() — never io.to(roomCode)'
  - 'T-24-03 cross-team guard: playerSlot gates which assignment array may be mutated (slot 1 → homeAssignment only)'
  - "awayPickedUniformStyle and awayPickedJerseyType added to Room type (discovered during GREEN) because LINEUP_CONFIRM now calls buildInitialGameState and needs away's style/kit which was previously only used in the immediate UNIFORM_CONFIRM call"
  - 'Tasks 2 and 3 GREEN implemented together in one commit batch because away-confirm restructure breaks 128 existing tests and those tests require LINEUP_CONFIRM to exist to be fixed'
metrics:
  duration_minutes: 180
  completed_date: '2026-07-10T18:05:53Z'
  tasks_completed: 3
  files_changed: 13
---

# Phase 24 Plan 03: Lineup Assignment Server Handlers Summary

Server defers game start until both lineups confirmed — privately delivers auto-assignment per socket, validates outfield swaps with GK lock and ownership guard, and builds game state from the confirmed-order PoolPlayer[] (D-11).

## What Was Built

**Task 1 — Room type fields (`70314b6`):** Added 6 optional fields to the `Room` type:

- `homeAssignment?: string[] | null` / `awayAssignment?: string[] | null` — PlayerId[11] per team
- `homeLineupConfirmed?: boolean` / `awayLineupConfirmed?: boolean` — parallel confirm flags
- `awayPickedUniformStyle?: UniformStyleId` / `awayPickedJerseyType?: 'home' | 'away'` — needed by LINEUP_CONFIRM because buildInitialGameState was deferred from UNIFORM_CONFIRM

**Task 2 RED — Integration test scaffold (`3f946d6`):** Created `lineupAssignment.integration.test.ts` with a real Socket.io server/client harness and 9 test cases covering ASSIGN-02/03/04/05, T-24-01/02/03, D-11, and both the single-confirm gate and the dual-confirm trigger. All tests were in failing (RED) state at commit time.

**Tasks 2+3 GREEN — Handler implementations + broken test fixes (`f066ebb`):**

- Restructured `UNIFORM_CONFIRM` away-branch: removed `buildInitialGameState` call; added `computeAutoAssignment` for both teams; stored results as `room.homeAssignment` / `room.awayAssignment`; emitted `LINEUP_ASSIGNMENT_READY` to each socket individually (D-12 privacy); kept `BOTH_FORMATIONS_CONFIRMED` broadcast
- `LINEUP_SWAP` handler: isProcessing mutex; playerSlot-gated team selection (T-24-03); `WRONG_PHASE` if assignment not computed; `INVALID_SLOT_INDEX` if non-integer or outside [0,10]; `GK_SLOT_LOCKED` if either index === 0 (T-24-01); in-place swap; per-socket `LINEUP_ASSIGNMENT_UPDATED` emit
- `LINEUP_CONFIRM` handler: isProcessing mutex; `WRONG_PHASE` guard; per-player confirm flag set; early return if both flags not yet true (D-25 parallel gate); D-11 `PLAYER_POOL.find()` resolution; `buildInitialGameState` called with `confirmedHomeOrder` / `confirmedAwayOrder`; `broadcastState`
- [Rule 1 - Bug] Updated `setupRoom` helpers in 11 existing integration test files (128 tests that timed out after UNIFORM_CONFIRM no longer emits GAME_STATE directly)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 11 integration test setupRoom helpers broke when away-confirm no longer emits GAME_STATE**

- **Found during:** Task 2+3 GREEN implementation
- **Issue:** Every existing integration test's setup helper did `clientB.emit(UNIFORM_CONFIRM) → await GAME_STATE`. After restructuring the away-confirm branch to emit `LINEUP_ASSIGNMENT_READY` instead, all 128 downstream tests timed out.
- **Fix:** Updated each `setupRoom` helper to drive through the new lineup phase: register `LINEUP_ASSIGNMENT_READY` listeners before `UNIFORM_CONFIRM`, await both, then emit `LINEUP_CONFIRM` from both clients before awaiting `GAME_STATE`. Applied uniformly to 11 test files.
- **Files modified:** `game.integration.test.ts`, `gameHandlers.test.ts`, `gameHandlers.phase10.test.ts`, `gameHandlers.phase17.test.ts`, `gameHandlers.phase17-06.test.ts`, `gameHandlers.phase18-02.test.ts`, `gameHandlers.rule11.test.ts`, `kickoffSetup.integration.test.ts`, `replay.integration.test.ts`, `room.integration.test.ts`, `shotGkRange.test.ts`
- **Commit:** `f066ebb`

**2. [Rule 2 - Missing functionality] Added awayPickedUniformStyle and awayPickedJerseyType to Room type**

- **Found during:** Task 3 GREEN — implementing LINEUP_CONFIRM handler
- **Issue:** `LINEUP_CONFIRM` needs to call `buildInitialGameState` with away's uniform style and jersey type, but these were never stored on the Room (previously used immediately and discarded in UNIFORM_CONFIRM away-branch).
- **Fix:** Added `awayPickedUniformStyle?: UniformStyleId` and `awayPickedJerseyType?: 'home' | 'away'` to Room type; stored both in the UNIFORM_CONFIRM away-branch alongside existing team/formation storage.
- **Files modified:** `roomStore.ts`, `roomHandlers.ts`
- **Commit:** `f066ebb` (included in Task 2+3 GREEN commit)

**3. [Design decision] Tasks 2 and 3 implemented together in one GREEN commit**

- **Reason:** The away-confirm restructure (Task 2) breaks 128 existing tests. Fixing those tests requires the LINEUP_CONFIRM handler (Task 3) to exist. Implementing them separately would produce an intermediate broken state. Combined into a single GREEN commit for correctness.

## Verification Results

- Full server suite: **533 tests passed, 1 skipped** (27 test files)
- New lineup tests: 9 tests in `lineupAssignment.integration.test.ts` — all green
- `io.to(roomCode)` audit: no `LINEUP_ASSIGNMENT_READY` or `LINEUP_ASSIGNMENT_UPDATED` broadcast to room (D-12 confirmed)

## Self-Check: PASSED

Files exist:

- `packages/server/src/__tests__/lineupAssignment.integration.test.ts` — FOUND
- `packages/server/src/roomHandlers.ts` — FOUND
- `packages/server/src/roomStore.ts` — FOUND

Commits exist:

- `70314b6` (Task 1) — FOUND
- `3f946d6` (Task 2 RED) — FOUND
- `f066ebb` (Tasks 2+3 GREEN) — FOUND
