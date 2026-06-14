---
phase: 17-rule-bugs
plan: '03'
subsystem: server-engine, server-handlers, client-ui
tags: [bug-fix, tdd, wave-3, BUG-02, BUG-03, phase-17, cancel-movement, undo]
dependency_graph:
  requires:
    - 17-01 (GAME_CANCEL_MOVEMENT in shared events, Wave-0 RED tests)
    - 17-02 (no direct dependency — engine fixes in parallel)
  provides:
    - applyCancelMovement engine function (BUG-02)
    - ApplyCancelMovementResult discriminated union type (BUG-02)
    - GAME_CANCEL_MOVEMENT socket handler (BUG-02)
    - applyUndo HP_REPOSITION boundary extension (BUG-03)
    - GAME_UNDO relaxed phase guard: MOVEMENT | HIGH_PASS_MOVEMENT (BUG-03)
    - emitCancelMovement Zustand store action (BUG-02)
    - Cancel button in ActionPanel MOVEMENT phase (BUG-02)
    - Undo button in ActionPanel HIGH_PASS_MOVEMENT phase (BUG-03)
  affects:
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.phase17.test.ts
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/components/ActionPanel.tsx
tech_stack:
  added: []
  patterns:
    - Discriminated-union result type for new apply* engine function (existing convention)
    - Socket handler mutex + phase guard + isActivePlayer + broadcastState (existing pattern)
    - Shared canUndo const lifted above multiple phase branches (refactor)
    - Boundary-predicate extension: HP_REPOSITION added to applyUndo reduce (existing convention)
key_files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.phase17.test.ts
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/components/ActionPanel.tsx
decisions:
  - 'BUG-02: paceUsedByPieceId emptiness check (Object.keys length) used in both engine and client — Pitfall 5 guard applied correctly'
  - 'BUG-03: HP_REPOSITION treated as slot boundary in applyUndo when state.phase === HIGH_PASS_MOVEMENT; engine remains phase-agnostic otherwise (D-06)'
  - 'BUG-03: GAME_UNDO handler uses validUndoPhases array for extensibility; allows future addition of other move phases without further changes'
  - 'canUndo computation lifted to shared const above both phase branches in ActionPanel to avoid duplication (DRY refactor)'
  - 'shared package dist rebuild was required before handler tests could pass; Plan 01 had committed events.ts but the shared dist was stale in the test runner context'
metrics:
  duration: ~18min
  completed: '2026-06-14T17:45:00Z'
  tasks_completed: 3
  files_changed: 5
---

# Phase 17 Plan 03: BUG-02 + BUG-03 Cancel/Undo Summary

Cancel control in MOVEMENT phase (BUG-02) and Undo in HIGH_PASS_MOVEMENT phase (BUG-03), fully wired client→server→broadcast. `applyCancelMovement` pure engine function reverts MOVEMENT→PASS with no slot consumed; `applyUndo` extended to recognise `HP_REPOSITION` as a slot boundary; `GAME_CANCEL_MOVEMENT` socket handler wired; `GAME_UNDO` phase guard relaxed; ActionPanel gains Cancel button (pre-move only) and Undo button in HIGH_PASS_MOVEMENT.

## Tasks Completed

| #   | Task                                                        | Commit    | Files                                         |
| --- | ----------------------------------------------------------- | --------- | --------------------------------------------- |
| 1   | BUG-02 + BUG-03 engine functions                            | `d26f0c6` | `gameEngine.ts`, `gameEngine.phase17.test.ts` |
| 2   | Wire GAME_CANCEL_MOVEMENT + relax GAME_UNDO guard           | `52e83f6` | `gameHandlers.ts`                             |
| 3   | ActionPanel Cancel + HIGH_PASS_MOVEMENT Undo + store action | `7a0e1c5` | `ActionPanel.tsx`, `useGameStore.ts`          |

## Test Results

### Before plan 17-03

- 272 passing, 9 failing (BUG-02 ×5, BUG-03 ×0 engine already tracked in handler, MOVE-06 ×2, PASS-02 ×2)

Note: as discovered in Plan 01, BUG-03 engine tests were already GREEN (applyUndo has no phase guard — the handler was the blocker). The Wave-0 "BUG-03" label covered the handler test path.

### After plan 17-03

- 277 passing, 4 failing (MOVE-06 ×2, PASS-02 ×2 — out-of-scope for this plan)

### BUG-02 tests green (5 of 5)

- `applyCancelMovement` returns `{ok:true, phase:PASS}` when paceUsedByPieceId empty ✓
- `applyCancelMovement` returns `{ok:false, reason:PIECES_ALREADY_MOVED}` when piece has partial pace ✓
- `applyCancelMovement` returns `{ok:false, reason:WRONG_PHASE}` when not MOVEMENT ✓
- Handler: reverts MOVEMENT to PASS (integration test) ✓
- Handler: emits GAME_ERROR with PIECES_ALREADY_MOVED (integration test) ✓

### BUG-03 tests green (2 of 2)

- `applyUndo` reverses last MOVE after HP_REPOSITION boundary ✓
- `applyUndo` returns NOTHING_TO_UNDO when no MOVE after HP_REPOSITION ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shared package dist was stale — handler integration tests timed out**

- **Found during:** Task 2 verification — BUG-02 handler tests timed out waiting for `game:state`
- **Issue:** TypeScript compiler and test runner were resolving `@counter-attack/shared` to the
  compiled dist which didn't include `GAME_CANCEL_MOVEMENT` at the time tests ran. The socket
  handler's `socket.on(ClientEvents.GAME_CANCEL_MOVEMENT, ...)` resolved to `undefined` event name
  at runtime (the const was `"game:cancel_movement"` in the JS dist but TypeScript reported the
  type error, and the vitest runtime appeared to miss the handler registration).
- **Fix:** Ran `pnpm --filter @counter-attack/shared build` to rebuild the shared dist. After rebuild,
  handler tests passed immediately (2/2 GREEN).
- **Root cause:** Plan 01 modified `events.ts` and committed the source, but the dist was compiled
  in the same session — the dist in the repo was already current. The issue was the test runner
  picking up a stale cached version. Rebuilding resolved it.
- **Files modified:** `packages/shared/dist/events.js`, `packages/shared/dist/events.d.ts` (rebuilt)
- **Commit:** No separate commit needed — dist was already committed from Plan 01

**2. [Refactor] canUndo computation lifted to shared const above phase branches**

- **Found during:** Task 3 ActionPanel implementation
- **Issue:** The plan specified "lift to shared const or replicate" — lifting was cleanest given
  the boundary predicate needed to be extended for HIGH_PASS_MOVEMENT anyway.
- **Fix:** Removed the local `canUndo` from the MOVEMENT block; added a shared `canUndo` const
  above the HIGH_PASS_MOVEMENT block with the extended boundary predicate (`HP_REPOSITION` included
  when `phase === 'HIGH_PASS_MOVEMENT'`).
- **Files modified:** `packages/client/src/components/ActionPanel.tsx`
- **Commit:** `7a0e1c5`

## Checkpoint Pending

Task 4 is a `checkpoint:human-verify` — the functional behavior needs human verification in a live two-tab session:

1. MOVEMENT → Click Move → `← Cancel` visible before any piece moves; click it → returns to PASS action chooser, no slot consumed
2. MOVEMENT → move one hex → `← Cancel` disappears; `Undo` works
3. High Pass → HIGH_PASS_MOVEMENT → reposition a piece → `Undo` button appears and reverses move; `Undo` disabled before any move

## Known Stubs

None — all UI elements and server logic are fully wired.

## Threat Flags

None — `GAME_CANCEL_MOVEMENT` follows the same security model as all other game handlers:
`isProcessing` mutex + phase guard (`MOVEMENT` only) + `isActivePlayer` guard. No new trust
boundary introduced.

## Self-Check

Files exist:

- `packages/server/src/gameEngine.ts` — modified (contains `applyCancelMovement`, `ApplyCancelMovementResult`, HP_REPOSITION boundary) ✓
- `packages/server/src/gameHandlers.ts` — modified (contains `GAME_CANCEL_MOVEMENT` handler, `validUndoPhases`) ✓
- `packages/client/src/store/useGameStore.ts` — modified (contains `emitCancelMovement`) ✓
- `packages/client/src/components/ActionPanel.tsx` — modified (contains Cancel button, HIGH_PASS_MOVEMENT Undo) ✓

Commits exist:

- `d26f0c6` feat(17-03): BUG-02 + BUG-03 engine functions ✓
- `52e83f6` feat(17-03): wire GAME_CANCEL_MOVEMENT handler and relax GAME_UNDO phase guard ✓
- `7a0e1c5` feat(17-03): ActionPanel Cancel button + HIGH_PASS_MOVEMENT Undo + store action ✓

Verification:

- `pnpm --filter @counter-attack/server exec vitest run` — 277 passing, 4 failing (MOVE-06 + PASS-02 only — out-of-scope) ✓
- `pnpm --filter @counter-attack/client exec vitest run` — 91 passing, 0 failing ✓
- BUG-02 tests: 5/5 GREEN ✓
- BUG-03 tests: 2/2 GREEN ✓
- Human checkpoint (Task 4) pending

## Self-Check: PASSED
