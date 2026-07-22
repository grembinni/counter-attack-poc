---
phase: 31-bug-fixes
plan: 03
subsystem: game-logic
tags: [react, socket.io, zustand, hex-grid, server-authoritative-validation]

# Dependency graph
requires: []
provides:
  - Client selection gate forbidding GK selection during SNAPSHOT_DEFLECT (canSelectSnapDeflect)
  - Server-side rejection of GK-role SNAPSHOT_DEFLECT moves (gameHandlers.ts)
  - Removal of the now-dead SNAP-02 GK-penalty-recompute branch
affects: [31-bug-fixes]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-authoritative two-layer validation (client gate + server rejection)]

key-files:
  created: []
  modified:
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameHandlers.phase10.test.ts

key-decisions:
  - 'Rejection guard placed in gameHandlers.ts (not gameEngine.ts) — the actual SNAPSHOT_DEFLECT validator location, per 31-PATTERNS.md correction to CONTEXT.md D-06'
  - 'Removed dead SNAP-02 GK-penalty-recompute branch since sdPiece can never be GK after the rejection guard; snapshotGkPenalty preserved as unchanged pass-through'
  - "Updated pre-existing multi-hex-click regression test to use a non-GK outfield defender instead of the GK, since that test's assertions were about click-distance handling, not GK-specific behavior"

patterns-established:
  - 'Two-layer server-authoritative validation for a role-based selection restriction: client canSelect* AND clause + server pre-mutation role check with GAME_ERROR + broadcastState + return'

requirements-completed: [BUG-32]

# Metrics
duration: ~20min
completed: 2026-07-22
---

# Phase 31 Plan 03: SNAPSHOT_DEFLECT GK Selection Fix Summary

**Goalkeeper is now unselectable as a SNAPSHOT_DEFLECT deflection responder in both the client selection gate and the server-authoritative move validator, with the compensating dead penalty-recompute branch removed.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2 completed
- **Files modified:** 4

## Accomplishments

- Added `piece.role !== 'GK'` to `canSelectSnapDeflect` in `HexGrid.tsx` so the GK never renders with a selectable ring during SNAPSHOT_DEFLECT
- Added a server-side rejection in the SNAPSHOT_DEFLECT `GAME_MOVE` handler block in `gameHandlers.ts`: a GK-role piece submitted as the deflection responder is rejected with `GAME_ERROR 'WRONG_PIECE'` before any state mutation, and `broadcastState` re-syncs the client
- Removed the now-unreachable SNAP-02 GK-penalty-recompute branch (`if (sdPiece.role === 'GK' && sdState.shotTargetHex) {...}`); `snapshotGkPenalty` is now a straight pass-through of the prior value
- Added regression coverage on both layers, plus a full-suite pass confirming no existing test relied on GK-during-deflect behavior (one did — updated, see Deviations)

## Task Commits

Each task was committed atomically:

1. **Task 1: Client — gate canSelectSnapDeflect on non-GK and cover it** - `8962f00` (fix)
2. **Task 2: Server — reject GK deflection move, remove dead SNAP-02 branch, cover it** - `7ce142e` (fix)

_No TDD red/green split was used — this is a straightforward guard-clause addition with tests added and verified in the same commit per task (verified via a temporary revert-and-rerun check, see below)._

## Files Created/Modified

- `packages/client/src/components/HexGrid.tsx` - Added `piece.role !== 'GK' &&` clause to `canSelectSnapDeflect`
- `packages/client/src/components/HexGrid.test.tsx` - Added a `describe('HexGrid — SNAPSHOT_DEFLECT GK selection gate (BUG-32)')` block: GK not selectable, outfield defender still selectable
- `packages/server/src/gameHandlers.ts` - Added GK-role rejection guard in the SNAPSHOT_DEFLECT `GAME_MOVE` block (before state mutation); removed dead SNAP-02 branch
- `packages/server/src/__tests__/gameHandlers.phase10.test.ts` - Added 2 new tests (GK rejected + state unchanged; non-GK still succeeds); updated 1 pre-existing test that used the GK as the deflection piece

## Decisions Made

- Confirmed via `31-PATTERNS.md` that the SNAPSHOT_DEFLECT validator lives in `gameHandlers.ts`, not `gameEngine.ts` — `applyMove` in `gameEngine.ts` only accepts `MOVE`/`FREE_MOVE*` phases, so SNAPSHOT_DEFLECT moves never reach it.
- Placed the GK rejection guard immediately after `validateResponseMoveStep` succeeds (i.e., after ownership/team/lock/pace/distance/occupancy checks pass), preserving existing `WRONG_TEAM`-first error semantics and guaranteeing zero state mutation occurs before the GK check.
- `snapshotGkPenalty` field kept in the state spread as an unchanged pass-through (`sdState.snapshotGkPenalty ?? 0`) rather than deleted, since it's still a valid `GameState` field consumed elsewhere (`gameEngine.ts` SHOT resolution reads it, though a prior fix already made `applyRoll` ignore it for tie-breaking — verified via existing `gameEngine.phase8.test.ts` assertions, unaffected by this change).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test relied on GK-during-deflect behavior — plan's stated "no test depends on this" assumption was incorrect**

- **Found during:** Task 2 verification (`pnpm --filter @counter-attack/server test gameHandlers.phase10`)
- **Issue:** The plan's action notes stated "confirm no existing test relied on the GK moving during SNAPSHOT_DEFLECT ... none currently exercises a GK deflect move." This was inaccurate: `'the defending team can reposition with a single multi-hex click (no forced hex-by-hex adjacency)'` in `gameHandlers.phase10.test.ts` explicitly moved the away GK 2 hexes to verify multi-hex-click behavior. After adding the GK rejection, this test failed (GK move now rejected with `WRONG_PIECE` instead of succeeding).
- **Fix:** Updated the test to use a non-GK away outfield defender instead of the GK, preserving the exact same assertions (single click covering 2 hexes succeeds, `snapDeflectPaceUsed` becomes 2) — the behavior under test (multi-hex click distance handling) was never GK-specific, so substituting the piece fully preserves the test's original intent.
- **Files modified:** `packages/server/src/__tests__/gameHandlers.phase10.test.ts`
- **Verification:** Full server suite re-run after the fix — all 616 tests pass (18 in `gameHandlers.phase10.test.ts`, up from 614 total before this plan).
- **Committed in:** `7ce142e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — pre-existing test needed updating after the fix removed behavior it depended on)
**Impact on plan:** Necessary correction; the plan's own verification instruction ("confirm no existing test relied on GK-during-deflect") is what surfaced this, and the fix keeps the regression coverage's original intent intact using a legal (non-GK) piece.

## Issues Encountered

- The worktree had no `node_modules` installed and `packages/shared` had no built `dist/` output, causing initial typecheck failures unrelated to this plan's code changes (`Cannot find module '@counter-attack/shared'`, and unrelated pre-existing `useGameStore.ts`/`uniformStyles.test.tsx` errors that were symptoms of the missing shared build, not real regressions). Resolved by running `pnpm install` and `pnpm --filter @counter-attack/shared build` before typechecking; both client and server typechecks are clean afterward with zero errors.
- Verified both new client tests and both new server tests are not vacuously true: temporarily reverted the `HexGrid.tsx` client gate and reran `HexGrid.test.tsx` — the new GK-not-selectable test failed as expected (`expected true to be false`), confirming it genuinely exercises the fix; then restored the fix and reconfirmed all 41 client tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-32 (both client and server layers) is fully closed with regression coverage on both sides.
- Full workspace test counts after this plan: shared 583 (unchanged), server 616 (+2, 1 skipped, 1 todo unchanged), client 373 (+2) — 1,572 tests total, all green. Full client + server typecheck clean.
- No blockers for the remaining Phase 31 plans (31-01, 31-02, 31-04) or subsequent v1.5 phases.

---

_Phase: 31-bug-fixes_
_Completed: 2026-07-22_

## Self-Check: PASSED

- FOUND: packages/client/src/components/HexGrid.tsx
- FOUND: packages/client/src/components/HexGrid.test.tsx
- FOUND: packages/server/src/gameHandlers.ts
- FOUND: packages/server/src/**tests**/gameHandlers.phase10.test.ts
- FOUND: commit 8962f00
- FOUND: commit 7ce142e
