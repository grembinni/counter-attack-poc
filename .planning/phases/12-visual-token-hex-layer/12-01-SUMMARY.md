---
phase: 12-visual-token-hex-layer
plan: '01'
subsystem: client-rendering
tags: [svg, piece-overlay, stripe-patterns, selection-state, tdd, vis-01, ux-05]
dependency_graph:
  requires: []
  provides:
    - SelectionState type exported from PieceOverlay.tsx
    - Per-piece SVG stripe pattern defs (home-stripe-<id>, away-stripe-<id>)
    - selectionState enum prop replacing 4 booleans
  affects:
    - packages/client/src/components/HexGrid.tsx (Plan 04 must update call site)
tech_stack:
  added: []
  patterns:
    - SVG <defs><pattern> with patternUnits="userSpaceOnUse" for per-piece stripe centering
    - selectionState enum replacing boolean prop bag
key_files:
  created:
    - packages/client/src/components/PieceOverlay.test.tsx
  modified:
    - packages/client/src/components/PieceOverlay.tsx
decisions:
  - 'D-01: Per-piece SVG <defs><pattern> inside PieceOverlay (not shared HexGrid defs) for pixel-accurate centering'
  - "D-04: SelectionState enum 'none'|'selectable'|'active'|'activated' replaces isSelected+isClickable+isSpent+isHeaderContestant"
  - 'D-05: activated = orange ring (#f97316) + red X (#ef4444) rendered together as one selectionState branch'
  - "D-06: cursor pointer derived from selectionState !== 'none'"
metrics:
  duration: '5m 11s'
  completed: '2026-06-12'
  tasks_completed: 2
  files_modified: 2
---

# Phase 12 Plan 01: PieceOverlay Stripe Defs + SelectionState API Summary

PieceOverlay now renders per-piece SVG stripe patterns on outfield tokens and exposes a single `selectionState` enum replacing the four boolean props.

## What Was Built

**VIS-01 — Stripe patterns on outfield tokens:**

- Home outfield: single vertical black stripe (`x=10, w=4, fillOpacity=0.55`) centered on token using `patternUnits="userSpaceOnUse"`
- Away outfield: two horizontal dark maroon bands (`y=6` and `y=14`, `h=4`, `fill=#7f0000`, `fillOpacity=0.65`)
- GK tokens: unchanged solid fill (`#9b59b6` home / `#f59e0b` away) — no stripe applied
- Pattern IDs per-piece: `home-stripe-<piece.id>` / `away-stripe-<piece.id>` — avoids ID collisions between same-team pieces in the same SVG

**UX-05 — Three-state selection ring system:**

- `selectable`: bright blue ring (`#3b82f6`, r+2, strokeWidth=2)
- `active`: green ring (`#22c55e`, r+4, strokeWidth=2.5) — also serves D-07 header contestant role
- `activated`: orange ring (`#f97316`, r+3, strokeWidth=2) + red X (`#ef4444`, strokeWidth=2.5)
- `none`: no ring, default cursor

**Prop API change:**

- Removed: `isSelected`, `isClickable`, `isSpent`, `isHeaderContestant`
- Added: `selectionState: SelectionState` (exported type)

## Tasks Completed

| Task | Name                                                             | Commit  | Files                                   |
| ---- | ---------------------------------------------------------------- | ------- | --------------------------------------- |
| 1    | Create PieceOverlay unit test scaffold (RED)                     | d4160b6 | PieceOverlay.test.tsx                   |
| 2    | Refactor PieceOverlay — stripe defs + selectionState API (GREEN) | 5eca2d7 | PieceOverlay.tsx, PieceOverlay.test.tsx |

## TDD Gate Compliance

- RED gate: `test(12-01)` commit d4160b6 — 5 tests failing before implementation
- GREEN gate: `feat(12-01)` commit 5eca2d7 — all 8 tests passing after implementation
- REFACTOR gate: not needed — implementation was clean on first pass

## Verification Results

- `pnpm vitest run src/components/PieceOverlay.test.tsx`: 8/8 tests pass
- `pnpm tsc --noEmit` filtered to PieceOverlay files: 0 errors
- Expected HexGrid.tsx TS2322 error present (Plan 04 will fix call site — per plan notes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file imported non-existent SelectionState in RED phase**

- **Found during:** Task 1 commit (pre-commit ESLint hook blocked `@typescript-eslint/no-unsafe-assignment`)
- **Issue:** Importing `SelectionState` from `./PieceOverlay.js` in the RED phase causes TypeScript to type it as an error, which ESLint flags as unsafe assignment
- **Fix:** Defined `SelectionState` locally in the test file for the RED phase; updated to use real import in Task 2 (GREEN) once the type was exported
- **Files modified:** `PieceOverlay.test.tsx`
- **Commit:** Resolved before d4160b6

**2. [Rule 2 - Missing null checks] TypeScript TS18048/TS2532 in test assertions**

- **Found during:** Task 2 TypeScript check
- **Issue:** `querySelectorAll()[0]` returns `Element | undefined` in strict TypeScript; tests used direct array index access
- **Fix:** Changed to `Array.from(...)[0]!` with non-null assertion (valid since test renders known SVG structure) and `ringCircles[0]!` for known-length arrays
- **Files modified:** `PieceOverlay.test.tsx`
- **Commit:** 5eca2d7

## Known Stubs

None — PieceOverlay renders actual SVG stripe patterns and ring states from live props. No placeholder data.

## Threat Flags

None — PieceOverlay is a pure client-side render component with no network endpoints, auth paths, or data persistence.

## Self-Check: PASSED
