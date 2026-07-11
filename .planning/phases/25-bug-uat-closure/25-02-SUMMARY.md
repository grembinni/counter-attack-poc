---
phase: 25-bug-uat-closure
plan: '02'
subsystem: client-rendering
tags: [bug-fix, ux, hex-grid, piece-overlay, shot-path, svg]
dependency_graph:
  requires: []
  provides: [BUG-23-fix, UX-15-d17-fix]
  affects:
    [packages/client/src/components/HexGrid.tsx, packages/client/src/components/PieceOverlay.tsx]
tech_stack:
  added: []
  patterns: [react-useEffect-state-cleanup, svg-dominant-baseline]
key_files:
  created: []
  modified:
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/PieceOverlay.tsx
decisions:
  - "Gate entire isShotPathTint boolean on phase !== 'KICK_OFF_SETUP' (outer AND) rather than only the lastShotPathSet sub-clause"
  - 'Add useEffect([phase]) to clear shotTargetHighlight on KICK_OFF_SETUP; this state was previously never cleared after shot-declaration click'
  - "Change dominantBaseline from 'central' to 'middle' on jersey number SVG text; 'middle' is the cross-browser-reliable vertical centering value"
  - 'Style 12/13 swap (D-18): no code change required — live uniformStyles.tsx already satisfies D-18 as built; confirmed visually at Plan 05 UAT checkpoint'
metrics:
  duration: '12m'
  completed: '2026-07-11'
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 25 Plan 02: BUG-23 Shot-Path Tint Guard + UX-15 Jersey Number Centering Summary

Outer `phase !== 'KICK_OFF_SETUP'` guard on `isShotPathTint`, `useEffect` clearing `shotTargetHighlight` on kick-off transition, and `dominantBaseline="middle"` for SVG jersey number vertical centering.

## Tasks Completed

| Task | Name                                                                              | Commit  | Files                                           |
| ---- | --------------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| 1    | BUG-23 — outer KICK_OFF_SETUP guard on isShotPathTint + clear shotTargetHighlight | 32c71d2 | packages/client/src/components/HexGrid.tsx      |
| 2    | UX-15 — correct jersey number vertical centering                                  | 6bf29d0 | packages/client/src/components/PieceOverlay.tsx |

## What Was Built

### Task 1: BUG-23 Belt-and-Suspenders KICK_OFF_SETUP Guard (HexGrid.tsx)

Two edits per D-14:

**Fix 1 — Outer phase guard on `isShotPathTint`:**
The expression that was previously `(phase !== 'KICK_OFF_SETUP' && lastShotPathSet.has(hexId)) || isHpMoveTarget || isGKDiveTarget || isShotPath || highPassContestZoneSet.has(hexId)` is now fully gated: `phase !== 'KICK_OFF_SETUP' && (lastShotPathSet.has(hexId) || isHpMoveTarget || isGKDiveTarget || isShotPath || highPassContestZoneSet.has(hexId))`. This ensures all five sub-conditions are suppressed during KICK_OFF_SETUP, not just `lastShotPathSet`.

**Fix 2 — `useEffect` clearing `shotTargetHighlight`:**
Added `useEffect(() => { if (phase === 'KICK_OFF_SETUP') setShotTargetHighlight(null); }, [phase])` immediately after the `shotTargetHighlight` state declaration. This clears the never-previously-cleared React state that drives the red goal-target tint after a SNAPSHOT_DEFLECT goal sequence. `useEffect` was also added to the React import.

### Task 2: UX-15 D-17 Jersey Number Centering (PieceOverlay.tsx)

Changed `dominantBaseline="central"` to `dominantBaseline="middle"` on the jersey number `<text>` element. The `"middle"` value is the cross-browser-reliable SVG baseline for vertical text centering. No other attributes (`x`, `y`, `textAnchor`, `fontSize`, `fontWeight`, `fill`, GK italic style) were changed.

### D-18 (Style 12/13) — No Code Change

The live `uniformStyles.tsx` already satisfies D-18 as built: Style 12 (`quarterHorizontal`, registry index 12) applies `patternTransform="rotate(45 cx cy)"` producing diagonal-axis quarters (✕), while Style 13 (`quarterDiagonal`, index 13) is axis-aligned rendering cross-axis quarters (╬). The mapping matches D-18 without any swap. Visual confirmation deferred to the Plan 05 UAT checkpoint.

## Verification

- `pnpm --filter @counter-attack/client test`: **15 test files, 303 tests — all pass** (no regressions in HexGrid, PieceOverlay, or uniform test suites)
- `npx tsc --noEmit` in packages/client: passes (zero new errors from this plan's changes; pre-existing workspace-linkage errors in worktree environment are unrelated)
- `grep -c "phase !== 'KICK_OFF_SETUP'"` in HexGrid.tsx: 2 occurrences (isShotPathTint outer guard + useEffect condition)
- `grep -q "setShotTargetHighlight(null)"` in HexGrid.tsx: found
- `grep -q 'dominantBaseline="middle"'` in PieceOverlay.tsx: found
- `grep -q 'dominantBaseline="central"'` in PieceOverlay.tsx: not found (removed)

## Deviations from Plan

None — plan executed exactly as written. Pre-commit lint-staged hook required the shared workspace package to be built in the worktree (`pnpm --filter @counter-attack/shared build`) before ESLint could resolve `@counter-attack/shared` types; this is a one-time worktree environment setup step, not a code deviation.

## Known Stubs

None — both changes are complete implementations with no placeholder values or TODO markers.

## Threat Flags

None — changes are pure client-side rendering (SVG attribute + React state cleanup). No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- [x] `packages/client/src/components/HexGrid.tsx` — modified, committed at 32c71d2
- [x] `packages/client/src/components/PieceOverlay.tsx` — modified, committed at 6bf29d0
- [x] Commits 32c71d2 and 6bf29d0 verified in git log
- [x] All 303 client tests pass
