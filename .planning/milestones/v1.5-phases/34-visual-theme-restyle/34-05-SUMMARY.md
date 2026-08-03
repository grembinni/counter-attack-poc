---
phase: 34-visual-theme-restyle
plan: 05
subsystem: ui
tags: [react, css-modules, design-tokens, cta-buttons]

# Dependency graph
requires:
  - phase: 33-design-tokens-highlight-standardization
    provides: tokens.css chrome design-token layer (--color-cta-ready-bg, --color-bg-surface-alt, --color-text-inverse)
provides:
  - UniformSelectionScreen Confirm button migrated to the shared CTA grey/green color pattern
  - LineupAssignmentScreen Confirm button migrated to the shared CTA grey/green color pattern
  - LineupAssignmentScreen draft-incomplete branch now renders a genuine disabled not-ready Confirm button
affects: [34-uat, theme-consistency]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Confirm-button CSS Module classes renamed to self-documenting confirmButton (not-ready) / confirmButtonReady (ready), mirroring ActionPanel's .ctaButton / .ctaButtonReady naming"

key-files:
  created: []
  modified:
    - packages/client/src/components/UniformSelectionScreen.module.css
    - packages/client/src/components/UniformSelectionScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "Confirm button not-ready state uses --color-bg-surface-alt + --color-text-inverse (grey/white/outline) matching ActionPanel's .ctaButton base, replacing the bespoke --color-confirm-pending-bg (bright yellow/gold)"
  - 'Confirm button ready state uses --color-cta-ready-bg / --color-cta-ready-bg-hover (canonical green) replacing the off-palette --color-success / --color-success-hover'
  - 'LineupAssignmentScreen draft-incomplete branch renders a disabled, no-onClick Confirm button above the existing helper paragraph instead of hiding the button entirely, giving the not-ready -> ready transition a genuine visual state'

patterns-established:
  - 'Pattern: setup-screen Confirm buttons follow the same base/ready class-naming convention as ActionPanel (confirmButton / confirmButtonReady), all sourced from the canonical --color-cta-ready-bg token family'

requirements-completed: [THEME-01]

# Metrics
duration: 8min
completed: 2026-07-26
---

# Phase 34 Plan 05: Confirm Button CTA Color Migration Summary

**Migrated the Uniform Selection and Lineup Assignment Confirm buttons off bespoke yellow/green tokens onto the canonical grey/white-outline (not-ready) and green (ready) CTA color pattern used everywhere else in the app, and gave the Roster screen a genuine not-ready visual state.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-26T22:47:47-05:00
- **Completed:** 2026-07-26T22:55:32-05:00
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments

- UniformSelectionScreen Confirm button now renders neutral-grey/white/outline before a team is picked and canonical green (`--color-cta-ready-bg`) once ready — closes UAT test 3 and 8 gaps.
- LineupAssignmentScreen Confirm button ready state migrated from `--color-success` to `--color-cta-ready-bg`/`--color-cta-ready-bg-hover`.
- LineupAssignmentScreen draft-incomplete branch (lineup not yet full) now shows a disabled grey Confirm button instead of no button at all, giving the not-ready state a real visual presence.
- Both bespoke class names (`confirmButtonYellow`, `confirmButtonGreen`) fully retired app-wide; zero remaining references in `packages/client/src`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate UniformSelectionScreen Confirm button to the shared CTA color pattern** - `4e4c5ab` (fix)
2. **Task 2: Migrate LineupAssignmentScreen Confirm button and add a genuine not-ready state** - `36046f6` (fix)

**Plan metadata:** (this SUMMARY.md commit, made after this document is written)

## Files Created/Modified

- `packages/client/src/components/UniformSelectionScreen.module.css` - Renamed `.confirmButtonYellow` → `.confirmButton` (grey base) and `.confirmButtonGreen` → `.confirmButtonReady` (canonical green); migrated color tokens
- `packages/client/src/components/UniformSelectionScreen.tsx` - Updated Confirm button className ternary to reference the renamed classes
- `packages/client/src/components/LineupAssignmentScreen.module.css` - Renamed `.confirmButtonGreen` → `.confirmButtonReady` (canonical green); added new `.confirmButton` not-ready base class
- `packages/client/src/components/LineupAssignmentScreen.tsx` - Updated both `confirmButtonReady` references (draft-complete-and-full branch, standard-mode branch); draft-incomplete branch now renders a disabled `.confirmButton` above the helper paragraph
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` - Updated the incomplete-branch test to assert a disabled Confirm button is present (was asserting no button existed)

## Decisions Made

- Not-ready base state reuses the exact `--color-bg-surface-alt` / `--color-text-inverse` token pair already used by ActionPanel's `.ctaButton`, so the Confirm buttons visually match every other base-state action button in the app.
- Ready state reuses `--color-cta-ready-bg` / `--color-cta-ready-bg-hover`, the same tokens ActionPanel's `.ctaButtonReady` uses, eliminating the last two off-palette green/yellow references in the client.
- Left `--color-confirm-pending-bg` in `tokens.css` unremoved (now unreferenced) per the plan's explicit out-of-scope note — stylelint/check-contrast CI gates target hardcoded literals and contrast, not unused custom properties; removing it risked unrelated CI churn.

## Deviations from Plan

None - plan executed exactly as written. `node_modules` and the built `packages/shared/dist` output were missing in this fresh worktree (expected — both are gitignored build artifacts, not tracked source); ran `pnpm install` (all packages reused from the local pnpm store, zero downloads) and `pnpm --filter @counter-attack/shared run build` to restore the environment before running tests. This is standard worktree setup, not a plan deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both UAT gap-closure targets (test 3: Uniform Selection Confirm button color; test 8: Uniform Selection Confirm button outline/color parity) are code-complete and unit-test verified.
- Ready for the phase's visual re-UAT: confirm the Uniform Selection Confirm button is grey/white/outline before team pick and green after; confirm the Roster screen shows a disabled grey Confirm button while the lineup is incomplete and green once all 11 slots are filled.
- `pnpm --filter @counter-attack/client exec vitest run src/components/UniformSelectionScreen.test.tsx src/components/LineupAssignmentScreen.test.tsx` — 27/27 tests pass.
- `pnpm --filter @counter-attack/client typecheck` — passes clean.
- `grep -rn 'confirmButtonYellow\|confirmButtonGreen' packages/client/src` — no matches.

---

_Phase: 34-visual-theme-restyle_
_Completed: 2026-07-26_

## Self-Check: PASSED

- FOUND: packages/client/src/components/UniformSelectionScreen.module.css
- FOUND: packages/client/src/components/LineupAssignmentScreen.module.css
- FOUND: .planning/phases/34-visual-theme-restyle/34-05-SUMMARY.md
- FOUND commit: 4e4c5ab
- FOUND commit: 36046f6
- FOUND commit: e4f6ea9
