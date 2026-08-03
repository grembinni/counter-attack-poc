---
phase: 33-design-tokens-highlight-standardization
plan: 05
subsystem: ui
tags: [react, svg, piece-overlay, design-tokens, highlight-standardization]

# Dependency graph
requires:
  - phase: 33-design-tokens-highlight-standardization
    provides: 33-UI-SPEC.md B3 piece-ring color contract (authoritative grey/green values)
provides:
  - 'PieceOverlay exported color constants: ACTIVE_RING_STROKE, MOVED_THIS_STAGE_RING_STROKE, MOVED_THIS_STAGE_OVERLAY_FILL'
  - 'Grey ring + overlay treatment for the isMovedThisStage marker, visually distinct from the green active ring'
  - 'PieceOverlay.test.tsx assertions migrated to reference the exported constants instead of retyped hex literals'
affects: [33-06, 33-07, 'any future phase touching PieceOverlay ring colors']

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exported module-level color constants as single source of truth for a component's paint values, imported by both the component and its test file (mirrors Plan 33-01 Task 3 pattern)."

key-files:
  created: []
  modified:
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/PieceOverlay.test.tsx

key-decisions:
  - 'Kept the moved-this-stage block in its existing DOM position (before the ball-carrier dot and player-number text) so the number stays legible on top of the grey overlay.'
  - "Did not migrate the OFFSIDE-01 describe block's inline '#22c55e' literal assertion (line ~289) — out of the explicit scope of this plan's action spec (it targets the D-55/moved-this-stage block specifically) and its value is unchanged, so the literal remains correct."

patterns-established:
  - 'Named export constants for SVG paint values with a test-migration mandate (assert semantic identity, not retyped hex) — reusable for any future PieceOverlay/HexCell color work.'

requirements-completed: [HILITE-03]

# Metrics
duration: ~20min
completed: 2026-07-25
---

# Phase 33 Plan 05: Grey Moved-This-Stage Marker Summary

**Moved-this-stage piece marker changed from a green ring (identical to the active-selection ring) to a distinct dark-grey ring + light-grey overlay, both colors and the active green sourced from exported named constants.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- `PieceOverlay.tsx` now exports `ACTIVE_RING_STROKE` (`#22c55e`), `MOVED_THIS_STAGE_RING_STROKE` (`#6b7280`), and `MOVED_THIS_STAGE_OVERLAY_FILL` (`#9ca3af`) as the single source of truth for these two ring treatments.
- The `isMovedThisStage` marker now renders a light-grey semi-transparent overlay circle (`fillOpacity: 0.35`, radius `PIECE_RADIUS`) plus a dark-grey ring (`strokeWidth: 2.5`, radius `PIECE_RADIUS + 8`) — a "dimmed/spent" look, no longer confusable with the bright-green active-selection ring.
- The active ring (`selectionState === 'active'`) is unchanged visually (still `#22c55e`) but now reads its stroke from `ACTIVE_RING_STROKE`.
- `PieceOverlay.test.tsx` migrated: imports the three constants and asserts against them, including an explicit `expect(ACTIVE_RING_STROKE).not.toBe(MOVED_THIS_STAGE_RING_STROKE)` proof plus stacking tests (active+moved, offside+moved, activated+moved) confirming both layers render independently and simultaneously.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract exported color constants and replace the green moved-this-stage ring with the grey ring + overlay treatment** - `a7fe8f4` (feat)
2. **Task 2: Migrate PieceOverlay.test.tsx moved-this-stage assertions to the imported grey/green constants** - `22d3ba6` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `packages/client/src/components/PieceOverlay.tsx` - Added 3 exported color constants; active ring reads `ACTIVE_RING_STROKE`; `isMovedThisStage` block replaced with grey overlay circle + grey ring (both from constants)
- `packages/client/src/components/PieceOverlay.test.tsx` - Imports the 3 constants; rewrote the D-55 describe block to assert grey ring/overlay by constant reference, including the HILITE-03 distinctness proof and updated stacking tests

## Decisions Made

- Kept the moved-this-stage rendering block in its existing DOM position (overlay circle drawn first, over the piece body; ring drawn second; both still before the ball-carrier dot and player-number text) so the number remains legible and z-order/stacking with other rings (offside, activated) is unaffected.
- Left the pre-existing OFFSIDE-01 describe block's `'#22c55e'` literal assertion (unrelated to the moved-this-stage change, value itself is unchanged) untouched — the plan's action spec scoped test migration specifically to the D-55/moved-this-stage block, and touching unrelated tests would be out of scope per the deviation rules' scope boundary.

## Deviations from Plan

None - plan executed exactly as written. No fallback to the orange-circle-plus-red-X treatment was needed; the grey values from UI-SPEC B3 read clearly distinct from both the green active ring and the existing orange `activated` ring in the rendered SVG attribute values (visually verified via the stacking tests asserting all three colors coexist without collision).

## Issues Encountered

- Worktree had no `node_modules` (fresh worktree checkout) and `packages/shared` had no built `dist/` output, causing an initial test failure (`Failed to resolve entry for package "@counter-attack/shared"`). Resolved by running `pnpm install --frozen-lockfile` (worktree-local dependency install, no lockfile changes) followed by `pnpm --filter @counter-attack/shared build`. This is standard first-run worktree setup, not a plan or code defect — no deviation rule applies (nothing in the plan or source code was fixed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- HILITE-03 fully satisfied: the moved-this-stage marker is now grey, distinct from the green active ring, with both colors and the active green sourced from exported constants that future plans (e.g. any HexCell/PieceOverlay ring work in 33-06/33-07) can import rather than re-deriving.
- No blockers for subsequent Phase 33 plans.

---

_Phase: 33-design-tokens-highlight-standardization_
_Completed: 2026-07-25_

## Self-Check: PASSED

- FOUND: packages/client/src/components/PieceOverlay.tsx
- FOUND: packages/client/src/components/PieceOverlay.test.tsx
- FOUND: .planning/phases/33-design-tokens-highlight-standardization/33-05-SUMMARY.md
- FOUND commit: a7fe8f4
- FOUND commit: 22d3ba6
- FOUND commit: 125fa7a
