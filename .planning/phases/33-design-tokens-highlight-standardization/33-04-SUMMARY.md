---
phase: 33-design-tokens-highlight-standardization
plan: 04
subsystem: ui
tags: [react, svg, hex-grid, design-tokens, highlight-system]

# Dependency graph
requires:
  - phase: 33-design-tokens-highlight-standardization (plan 01-03)
    provides: UI-SPEC.md B1/B2 authoritative color tables and ring-prop contract
provides:
  - Exported HIGHLIGHT_STYLES (10-member HexHighlightType union) and RING_STYLES tables in HexCell.tsx as the single source of truth for every hex tint/ring
  - HexCell ring?: 'required' | 'confirmed' independent overlay prop (mirrors PieceOverlay isOffside/isMovedThisStage pattern)
  - HexCell/HexGrid color-literal tests migrated to assert against the imported tables instead of retyped literals
affects: [33-06 (HexGrid consolidation, depends on this contract)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single exported lookup table (HIGHLIGHT_STYLES/RING_STYLES) as sole color source; tests import and assert against it rather than retyping literal values"
    - "Independent additive boolean/enum-driven overlay layer (ring) rendered as a sibling polygon after the mutually-exclusive tint ternary — same DOM-order pattern as PieceOverlay's isOffside/isMovedThisStage"

key-files:
  created: []
  modified:
    - packages/client/src/components/HexCell.tsx
    - packages/client/src/components/HexCell.test.tsx
    - packages/client/src/components/HexGrid.test.tsx

key-decisions:
  - "D-01: 'safe' hex tint recolored gold -> green (rgba(34,197,94,0.4))"
  - "D-02: 'goal' hex tint recolored red -> purple (rgba(168,85,247,0.5)), freeing red app-wide for the offside ring only"
  - "gk-kick-target, pass-target, tackle-risk added as new HIGHLIGHT_STYLES entries per UI-SPEC B1 (pass-target merges the former GK_QUICK_THROW inline tint)"
  - "RING_STYLES lives in HexCell.tsx alongside HIGHLIGHT_STYLES (not tokens.css) per D-07 since it's a highlight/ring color, not a base design token"
  - "ring and highlightType are independent/additive, not mutually exclusive — a hex can render both simultaneously"

patterns-established:
  - "Test files import exported style tables and assert token/semantic identity (e.g. HIGHLIGHT_STYLES.safe.fill) instead of retyping rgba/hex literals, so a future palette change only touches the table"

requirements-completed: [HILITE-01, HILITE-02]

# Metrics
duration: ~20min
completed: 2026-07-25
---

# Phase 33 Plan 04: Extend + Export Highlight Tables Summary

**Extended HexCell's HIGHLIGHT_STYLES to 10 exported hex-tint types (green safe / purple goal / 3 new types) plus a new exported RING_STYLES table and independent `ring` prop, with HexCell/HexGrid tests migrated to assert against the imported tables instead of retyped color literals.**

## Performance

- **Duration:** ~20 min (includes one-time `pnpm install` + `packages/shared` build in the freshly-created worktree, ~7 min)
- **Tasks:** 3/3 completed
- **Files modified:** 3

## Accomplishments

- `HexHighlightType` extended to the full 10-member union (`gk-kick-target`, `pass-target`, `tackle-risk` added); `safe` recolored gold→green and `goal` recolored red→purple (HILITE-01/02)
- `HIGHLIGHT_STYLES` and the new `RING_STYLES` table are both exported from `HexCell.tsx`, making them the single source of truth for HexGrid (33-06) and both test files
- New `ring?: 'required' | 'confirmed'` prop renders an independent gold overlay polygon (sourced entirely from `RING_STYLES`, no inline literals), and the base polygon's onClick/cursor guard now fires on `highlightType !== undefined || ring !== undefined` so a ring-only hex stays clickable
- `HexCell.test.tsx` and `HexGrid.test.tsx` migrated to import and assert against the exported tables — no color literal is retyped anywhere in either test file for values the component sources from those tables

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend + export HexHighlightType/HIGHLIGHT_STYLES, add exported RING_STYLES, and add the ring prop** - `ea85834` (feat)
2. **Task 2: Migrate HexCell.test.tsx to assert against imported HIGHLIGHT_STYLES/RING_STYLES and add new-type + ring coverage** - `d1cb76b` (test)
3. **Task 3: Derive HexGrid.test.tsx color constants from the imported HIGHLIGHT_STYLES table to keep the suite green after the recolor** - `f02f310` (test)

_Note: tasks were flagged `tdd="true"` in the plan, but the RED/GREEN cycle here is a table-extension + test-migration pair rather than a fresh-feature TDD cycle — tests and implementation were verified together against the same acceptance criteria before each commit; see TDD Gate Compliance below._

## Files Created/Modified

- `packages/client/src/components/HexCell.tsx` - Exported `HIGHLIGHT_STYLES` (10 tint types, safe=green/goal=purple) + new exported `RING_STYLES` table + `ring` prop rendering + widened onClick/cursor guard
- `packages/client/src/components/HexCell.test.tsx` - Imports `HIGHLIGHT_STYLES`/`RING_STYLES`; asserts fills/strokes against them; adds gk-kick-target/pass-target/tackle-risk/ring coverage
- `packages/client/src/components/HexGrid.test.tsx` - Imports `HIGHLIGHT_STYLES`; `SAFE_FILL`, all `goalFill` declarations, `KICKOFF_FILL`, and the risk-fill matcher now derive from the table instead of retyped rgba literals

## Decisions Made

- Followed the plan's exact color/table values (UI-SPEC B1/B2) — no deviation on color choices.
- `RING_STYLES` was defined and exported in `HexCell.tsx` (not `tokens.css`) per the plan's explicit D-07 rationale (ring color is a highlight-system value, not a base design token).
- No `header-target`/`safe`/`pass-target` fill collision issues surfaced in the HexGrid suite despite the three now sharing the identical green fill value — confirmed by running the full HexGrid.test.tsx suite (41/41 green); no assertion needed adjustment (the plan's contingency clause in Task 3 for over-counting green polygons did not trigger).

## Deviations from Plan

None - plan executed exactly as written. One minor documentation touch-up not called out as a separate deviation: updated a stale test comment in `HexGrid.test.tsx` ("does NOT render the generic safe (yellow) fill anywhere" → "(green)") to stay accurate after the D-01 recolor; this is a comment-only change with no behavioral or assertion impact.

## TDD Gate Compliance

Tasks 1 and 2 were marked `tdd="true"` in the plan, but this plan's structure is a table/contract extension (not a from-scratch behavior addition), so no separate `test(...)`-then-`feat(...)` RED/GREEN commit pair was produced — implementation (Task 1, `feat`) and test migration (Task 2, `test`) were committed as two distinct atomic commits in plan order, each independently verified green via `pnpm --filter @counter-attack/client test`. No stand-alone failing-test-first commit exists for this plan; flagging per the gate-sequence validation instruction since the RED gate commit is absent.

## Issues Encountered

- The worktree had no `node_modules` (fresh worktree checkout) and `packages/shared` had no built `dist/`, causing an initial Vite resolution failure (`Failed to resolve entry for package "@counter-attack/shared"`). Resolved by running `pnpm install --frozen-lockfile` (workspace-wide, no new packages added) followed by `pnpm --filter @counter-attack/shared build`. Not a plan deviation — standard one-time worktree bootstrap, no dependency added or changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `HIGHLIGHT_STYLES` and `RING_STYLES` are now exported and stable — Plan 33-06 (HexGrid consolidation) can import both directly to replace HexGrid's remaining inline color literals (`gk-kick-target`/`pass-target`/`tackle-risk` usage sites, and the `ring="required"`/`ring="confirmed"` migration of the kick-off centre-hex marker and confirmed-pass-target outline) without needing any further HexCell changes.
- Verification commands both green: `pnpm --filter @counter-attack/client test -- HexCell.test.tsx HexGrid.test.tsx` (55/55 passing) and `pnpm --filter @counter-attack/client build` (typecheck via `tsc --noEmit` also clean, confirming union exhaustiveness holds).
- Full client suite re-run for regression safety: 398/398 tests passing (22 files) after this plan's changes.

---

_Phase: 33-design-tokens-highlight-standardization_
_Completed: 2026-07-25_
