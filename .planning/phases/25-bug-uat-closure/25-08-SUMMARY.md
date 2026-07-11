---
phase: 25-bug-uat-closure
plan: '08'
subsystem: ui
tags: [react, svg, pieceoverlay, jersey-number, typography, ux]

# Dependency graph
requires:
  - phase: 25-02
    provides: "dominantBaseline='middle' jersey number centering (now over-corrected)"
provides:
  - "Jersey number <text> with dominantBaseline='central' + dy='-0.5' for corrected vertical centering"
affects: [25-bug-uat-closure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SVG text vertical centering: dominantBaseline='central' + dy='-0.5' as stable midpoint"

key-files:
  created: []
  modified:
    - packages/client/src/components/PieceOverlay.tsx

key-decisions:
  - "D-17 corrected: dominantBaseline='central' + dy='-0.5' is the stable midpoint between Plan 25-02's 'too high' (middle) and original 'too low' (central without offset)"

patterns-established:
  - "SVG font metric correction: 'central' baseline aligns em-square center (slightly low on screen); adding dy='-0.5' at fontSize=15 nudges upward to visual midpoint without overshoot"

requirements-completed: [UX-15]

# Metrics
duration: 15min
completed: 2026-07-11
---

# Phase 25 Plan 08: Jersey Number Centering Midpoint Summary

**SVG jersey number corrected to dominantBaseline="central" + dy="-0.5" — stable midpoint between Plan 25-02's "too high" and original "too low" placement**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-11T12:00:00Z
- **Completed:** 2026-07-11T12:15:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Reverted `dominantBaseline` from `"middle"` back to `"central"` on the jersey number `<text>` element in PieceOverlay.tsx
- Added `dy="-0.5"` upward offset to nudge the text from `"central"`'s slightly-low position to the visual midpoint of the piece circle
- No other attributes changed — `x`, `y`, `textAnchor`, `fontSize`, `fontWeight`, `fill`, `fontStyle` GK branch all unchanged
- ESLint + Prettier checks passed; no TypeScript errors introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Revert dominantBaseline to "central" and add dy="-0.5" upward offset** - `5eb5ed5` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/client/src/components/PieceOverlay.tsx` - Jersey number `<text>`: `dominantBaseline="central"` (restored from "middle"), `dy="-0.5"` added

## Decisions Made

- `dominantBaseline="central"` + `dy="-0.5"` is the plan-specified midpoint correction. `"central"` aligns the mathematical em-square center to the y coordinate (renders slightly low due to SVG font metrics); `"middle"` aligns the em-box midpoint (renders slightly high). A dy="-0.5" shift (half a user-space pixel upward) from `"central"` compensates for the font metric discrepancy.
- If `-0.5` is still insufficient after live browser review, `-1` is the next candidate; per the plan, this is tracked as a deferred Phase 26 item if still needed.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Worktree node_modules not set up:** Pre-commit hook (`pnpm exec lint-staged`) failed initially because the worktree had no `node_modules`. Resolved by running `pnpm install --frozen-lockfile` in the worktree, then building `@counter-attack/shared` (`pnpm --filter @counter-attack/shared build`) to make TypeScript type resolution work for ESLint's project service mode. This is a worktree environment setup issue, not a code issue.

## Known Stubs

None.

## Threat Flags

None — pure presentation change on the SVG text baseline attribute; no network endpoints, auth paths, file access patterns, or schema changes introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Jersey number centering fix is committed and ready for merge
- Visual confirmation at R=12 (gameplay) and R=30 (selection screen) should be done during UAT
- If dy="-0.5" proves still slightly low in browser review, dy="-1" is the next adjustment (deferred to Phase 26 per plan)

---

## Self-Check: PASSED

- SUMMARY.md: FOUND at `.planning/phases/25-bug-uat-closure/25-08-SUMMARY.md`
- PieceOverlay.tsx: FOUND at `packages/client/src/components/PieceOverlay.tsx`
- Task commit `5eb5ed5`: FOUND
- Summary commit `e1d8650`: FOUND

---

_Phase: 25-bug-uat-closure_
_Completed: 2026-07-11_
