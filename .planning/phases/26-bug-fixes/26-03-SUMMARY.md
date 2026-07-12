---
phase: 26-bug-fixes
plan: '03'
subsystem: client-ui
tags: [bug-fix, action-panel, hex-grid, action-log, css, click-routing, log-format]
dependency_graph:
  requires: [26-01]
  provides: [BUG-25-fix, BUG-26-fix, BUG-27-verification]
  affects: [ActionPanel.tsx, HexGrid.tsx, ActionLog.tsx]
tech_stack:
  added: []
  patterns:
    - ctaButtonClass(remaining) used consistently on all MOVE-phase End Turn buttons
    - handleClick ternary extended with movedPieceIds branch before () => undefined fallback
    - findBasePieceCircle defs-exclusion guard for away-team uniform clip circles
key_files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx
    - packages/client/src/components/ActionLog.test.tsx
decisions:
  - 'BUG-27: No production code change — format confirmed already consistent; test added to lock behavior'
  - 'findBasePieceCircle updated to exclude <defs> circles (barDiagonal clip-path bug discovery)'
metrics:
  duration: '~25 minutes'
  completed: '2026-07-12'
  tasks_completed: 3
  files_changed: 5
---

# Phase 26 Plan 03: Client Display Fixes (BUG-25, BUG-26, BUG-27) Summary

**One-liner:** Three client fixes — MOVE End Turn button color from ctaButtonClass, opponent activated-piece inspect on click, and deflect log format verification with test coverage.

## Tasks Completed

| Task | Description                                           | Commit  | Files                                 |
| ---- | ----------------------------------------------------- | ------- | ------------------------------------- |
| 1    | BUG-25: MOVE End Turn button color via ctaButtonClass | d466b63 | ActionPanel.tsx, ActionPanel.test.tsx |
| 2    | BUG-26: Opponent activated-piece opens stats on click | 7b3566c | HexGrid.tsx, HexGrid.test.tsx         |
| 3    | BUG-27: Deflect log format verification + test        | 573a88a | ActionLog.test.tsx                    |

## What Was Done

### BUG-25 — MOVE End Turn Button Color

**Problem:** The MOVE-phase End Turn button hard-coded `${styles.ctaButtonReady}` (green) regardless of how many players had moved in the slot.

**Fix:** Changed line 981 in `ActionPanel.tsx` from `${styles.ctaButtonReady ?? ''}` to `${ctaButtonClass(remaining ?? 0)}`. `ctaButtonClass` returns `ctaButtonReady` (green) when `remaining <= 0` and `ctaButtonPending` (orange) while options remain — matching the pattern already used by the HEADER-phase End Turn button.

**Tests added (2):**

- `remaining > 0` (no one moved) → button className contains `ctaButtonPending`
- `remaining <= 0` (all 4 in slot moved) → button className contains `ctaButtonReady`

### BUG-26 — Opponent Activated-Piece Stats Panel on Click

**Problem:** Clicking an opponent's activated (already-moved) piece had `selectionState === 'activated'`, causing PieceOverlay to route the click through `handleClick` rather than `onInspect`. The `handleClick` ternary's BUG-10 branch excludes opponent pieces (`piece.teamId === myTeam` guard), so opponent activated pieces fell through to `() => undefined` — a no-op.

**Fix:** Added a new branch in `HexGrid.tsx` `handleClick` immediately before the `() => undefined` fallback:

```typescript
: movedPieceIds.includes(piece.id)
? () => inspectPiece(piece.id)
: () => undefined;
```

No `piece.teamId === myTeam` constraint is needed — `canSelect` is already false for non-active-team pieces at this point in the chain, so no erroneous `selectPiece` can occur.

**Side-fix discovered:** `findBasePieceCircle` in `HexGrid.test.tsx` was matching the clip-path `<circle r={R}>` inside `<defs>` (used by the `barDiagonal` uniform style for away pieces) before the interactive base circle. This caused clicks in tests against away pieces to fire on an element with no `onClick` handler. Fixed by adding `c.closest('defs') === null` guard in the helper.

**Tests added (2):**

- Opponent piece in `movedPieceIds` → click sets `selectedPieceId`, `validMoveHexes` stays empty (inspectPiece path)
- Opponent piece NOT in `movedPieceIds` → click also opens stats via existing `onInspect` path (selectionState === 'none')

### BUG-27 — Deflect Log Format Verification

**Investigation result:** The format is already consistent. Both server emission paths (`gameHandlers.ts:927-943` and `:1557-1573`) always populate `band`, `die`, and `tackling`. The TypeScript type declares all three as required (non-optional) fields. The JSX render always appends `— {rangeLabel}, {rollStr}` unconditionally for both the `deflected` and `NO_DEFLECT` branches. There is no code path that produces a bare `failed to deflect` without the `— reason` suffix.

**Production code change: None required.** The format was already correct.

**Tests added (2):**

- Band A, NO_DEFLECT: verifies `failed to deflect — close range (Set A), die X + Tackling Y = Z`
- Band B, NO_DEFLECT: verifies `failed to deflect — long range (Set B), die X`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] findBasePieceCircle found clip-path defs circle instead of interactive base circle**

- **Found during:** Task 2 (BUG-26 test writing)
- **Issue:** The `barDiagonal` uniform style (used for away pieces) creates `<clipPath><circle cx cy r={R}/></clipPath>` inside `<defs>`. Since `defs` is rendered before the base circle in PieceOverlay, `querySelectorAll('circle')` returned the clip-path circle first. This circle has no `onClick` handler, so `fireEvent.click` did nothing and `selectedPieceId` stayed null.
- **Fix:** Added `c.closest('defs') === null` guard to `findBasePieceCircle` in `HexGrid.test.tsx`. The existing BUG-10 tests used home pieces (pinstripes-vertical style, which uses `<pattern>` not a `<clipPath><circle>`), so they were unaffected. The existing opponent-piece BUG-10 test at line 897 had no assertions on `selectedPieceId`, so it passed even with the wrong circle — the guard now makes it truly correct.
- **Files modified:** `packages/client/src/components/HexGrid.test.tsx`
- **Commit:** 7b3566c

## Known Stubs

None — all three fixes are complete with no placeholder data or stub behavior.

## Threat Flags

No new security-relevant surface introduced. All changes are pure client-side presentation/interaction with no server trust decisions. T-26-05 and T-26-06 from the plan's threat register cover these fixes (both accepted).

## Self-Check: PASSED

- `packages/client/src/components/ActionPanel.tsx` — modified, fix verified
- `packages/client/src/components/HexGrid.tsx` — modified, fix verified
- `packages/client/src/components/ActionLog.test.tsx` — modified, tests verified
- Commits: d466b63, 7b3566c, 573a88a — all exist in git log
- `pnpm test -- ActionPanel` → 40 passed
- `pnpm test -- HexGrid` → 39 passed
- `pnpm test -- ActionLog` → 26 passed
- `pnpm -r typecheck` → 0 errors
