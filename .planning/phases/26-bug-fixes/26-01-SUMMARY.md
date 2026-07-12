---
phase: 26-bug-fixes
plan: '01'
subsystem: game-engine / client-ui
tags: [bug-fix, undo-scoping, free-kick-setup, regression-tests, BUG-24]
dependency_graph:
  requires: []
  provides: [BUG-24-server-undo-scoping, BUG-24-client-canUndo-guard]
  affects: [packages/server/src/gameEngine.ts, packages/client/src/components/ActionPanel.tsx]
tech_stack:
  added: []
  patterns: [TDD, regression-lock, applyXxx-pure-function-convention]
key_files:
  created:
    - packages/server/src/__tests__/gameEngine.phase26-undo.test.ts
  modified:
    - packages/server/src/gameEngine.ts
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx
decisions:
  - 'applyUndo returns NOTHING_TO_UNDO (not UNDO_LOCKED) for FREE_KICK_SETUP empty current stage — UNDO_LOCKED is misleading because cross-stage undo is always blocked by design'
  - 'canUndo guard uses freeKickPlacedPieceIds.length === 0 as the authoritative empty-stage check, short-circuiting before the eventLog boundary scan'
metrics:
  duration: '~25 minutes'
  completed: '2026-07-12'
  tasks_completed: 2
  files_changed: 4
---

# Phase 26 Plan 01: Undo Scoping for FREE_KICK_SETUP (BUG-24) Summary

**One-liner:** Lock FREE_KICK_SETUP undo to the current stage via a server NOTHING_TO_UNDO fix and a client canUndo empty-stage guard using freeKickPlacedPieceIds.

## What Was Built

Two fixes for BUG-24 (undo scoping across turn/stage boundaries):

### Task 1: Server applyUndo regression suite + fix

Created `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` — a 5-case regression suite locking `applyUndo` behavior for FREE_KICK_SETUP and MOVE:

| Case | Scenario                                                                      | Expected                  | Pre-fix           |
| ---- | ----------------------------------------------------------------------------- | ------------------------- | ----------------- |
| 1    | FREE_KICK_SETUP empty current stage (no FK_SETUP_MOVE after FK_STAGE_ADVANCE) | NOTHING_TO_UNDO           | UNDO_LOCKED (bug) |
| 2    | FREE_KICK_SETUP: FK_SETUP_MOVE after boundary                                 | ok:true, undoes correctly | already correct   |
| 3    | FK_STAGE_ADVANCE boundary blocks pre-boundary undo                            | pre-boundary move stays   | already correct   |
| 4    | MOVE cross-slot: moves only before SLOT_ADVANCE                               | UNDO_LOCKED               | already correct   |
| 5    | MOVE phase: no MOVE events at all                                             | NOTHING_TO_UNDO           | already correct   |

**Code change required:** Yes — case 1 failed (code returned `UNDO_LOCKED` but contract requires `NOTHING_TO_UNDO`). Added `state.phase !== 'FREE_KICK_SETUP'` to the `hasPriorMoves` guard in `applyUndo` (gameEngine.ts lines 1438). Rationale: cross-stage undo is always impossible for FREE_KICK_SETUP (by the FK_STAGE_ADVANCE boundary); returning UNDO_LOCKED is misleading — the user cannot resolve it, and the current stage simply has nothing to undo.

### Task 2: Client canUndo empty-stage guard

Added a guard to the `canUndo` IIFE in `ActionPanel.tsx` (after the MOVE/FREE_MOVE paceUsedByPieceId guard):

```typescript
if (phase === 'FREE_KICK_SETUP' && (freeKickPlacedPieceIds ?? []).length === 0) return false;
```

Reuses the existing `freeKickPlacedPieceIds` selector (line 114). No new selector added.

Added 2 new tests to `ActionPanel.test.tsx`:

- **RED test (failing before guard):** eventLog has a stale FK_SETUP_MOVE with no boundary before it; `freeKickPlacedPieceIds: []` — without the guard, canUndo returns true (button enabled — bug); with guard, button disabled.
- **Positive test:** `freeKickPlacedPieceIds: ['home-9']` with FK_SETUP_MOVE after boundary → button enabled.

## Commits

| Hash    | Type        | Description                                                                       |
| ------- | ----------- | --------------------------------------------------------------------------------- |
| 9cbf7b1 | test(26-01) | Add failing regression suite for applyUndo FREE_KICK_SETUP scoping (BUG-24) — RED |
| c5953c8 | feat(26-01) | Fix applyUndo to return NOTHING_TO_UNDO for empty FREE_KICK_SETUP stage — GREEN   |
| 011f201 | test(26-01) | Add failing test for freeKickPlacedPieceIds empty-stage canUndo guard — RED       |
| 5ad8872 | feat(26-01) | Add freeKickPlacedPieceIds empty-stage guard to canUndo — GREEN                   |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] applyUndo returned UNDO_LOCKED instead of NOTHING_TO_UNDO for FREE_KICK_SETUP empty stage**

- **Found during:** Task 1 RED phase (test case 1 failed)
- **Issue:** When `phase === 'FREE_KICK_SETUP'` and no FK_SETUP_MOVE exists after the last FK_STAGE_ADVANCE boundary, but FK_SETUP_MOVE events exist before the boundary (from prior stages), `applyUndo` returned `UNDO_LOCKED` instead of `NOTHING_TO_UNDO`. The `hasPriorMoves` check did not distinguish between MOVE-phase cross-slot locking (where UNDO_LOCKED is meaningful) and FREE_KICK_SETUP cross-stage blocking (where NOTHING_TO_UNDO is correct).
- **Fix:** Added `&& state.phase !== 'FREE_KICK_SETUP'` to the `hasPriorMoves` guard (gameEngine.ts). FREE_KICK_SETUP always returns NOTHING_TO_UNDO when the current stage is empty.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Commit:** c5953c8

The plan's D-04 note stated the existing code "expected to already hold" but the test confirmed it did not for the prior-stage case. The fix was minimal (one condition added) and fully satisfies the D-04/BUG-24 contract.

## Verification Results

| Check                                                        | Result       |
| ------------------------------------------------------------ | ------------ |
| `cd packages/server && pnpm test -- gameEngine.phase26-undo` | 5/5 passed   |
| `cd packages/client && pnpm test -- ActionPanel`             | 38/38 passed |
| `cd packages/server && pnpm typecheck`                       | Clean        |
| `cd packages/client && pnpm typecheck`                       | Clean        |

## Known Stubs

None — all data flows are wired to live state.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` exists ✓
- `packages/server/src/gameEngine.ts` modified (applyUndo fix) ✓
- `packages/client/src/components/ActionPanel.tsx` modified (canUndo guard) ✓
- `packages/client/src/components/ActionPanel.test.tsx` modified (2 new tests) ✓
- Commits 9cbf7b1, c5953c8, 011f201, 5ad8872 exist in git log ✓
