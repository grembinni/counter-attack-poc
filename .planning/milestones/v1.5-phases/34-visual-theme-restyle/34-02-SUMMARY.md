---
phase: 34-visual-theme-restyle
plan: 02
subsystem: ui
tags: [wcag-contrast, hsl, color-derivation, react-hooks, tdd]

# Dependency graph
requires:
  - phase: 34-visual-theme-restyle (plan 01)
    provides: wcag-contrast + @types/wcag-contrast installed, stylelint gate
provides:
  - deriveAaAccentColor(uiColor, bgHex, fgHex) pure function
  - useTeamAccentColorAA(teamId) hook wrapper
  - AA_TEXT_MIN_RATIO (4.5) / AA_UI_MIN_RATIO (3.0) exported threshold constants
affects: [34-03 (CI contrast-check script), 34-04 (GameBoard --team-accent wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Inline HSL<->RGB conversion + wcag-contrast hex() for all ratio checks (never hand-rolled luminance)'
    - 'Hue-preserving lightness step-search with saturation-reduction fallback for color-contrast repair'

key-files:
  created: []
  modified:
    - packages/client/src/hooks/useTeamColors.ts
    - packages/client/src/hooks/useTeamColors.test.ts

key-decisions:
  - "Contrast policy corrected from 'uniform 4.5:1 both directions' (mathematically impossible, proven in planning) to '4.5:1 vs charcoal (text, SC 1.4.3) AND 3:1 vs white (UI/hover surface, SC 1.4.11)' — ratified this session per plan's IMPORTANT note"
  - 'Lightness-search steps at 2% increments, hue fixed, nearest-to-source-lightness result wins; saturation reduced in 10% steps only as a fallback (not needed for any of the 12 current TEAM_CONFIGS teams)'

patterns-established:
  - 'Color-contrast repair: search HSL lightness space with wcag-contrast as the sole ratio oracle, never reimplement luminance math'

requirements-completed: [THEME-04]

# Metrics
duration: ~11min
completed: 2026-07-26
---

# Phase 34 Plan 02: AA-Safe Team Accent Derivation Summary

**Hue-preserving WCAG AA accent-color derivation (`deriveAaAccentColor` + `useTeamAccentColorAA`) built TDD, with a corrected two-threshold contrast policy (4.5:1 text / 3:1 UI) that converges for all 12 TEAM_CONFIGS teams.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-26T08:54:58-05:00 (base commit `abe1c7f`)
- **Completed:** 2026-07-26T09:04:56-05:00
- **Tasks:** 2 completed (RED, GREEN)
- **Files modified:** 2

## Accomplishments

- `deriveAaAccentColor(uiColor, bgHex, fgHex)`: pure function that returns the input color unchanged when it already clears both AA thresholds (D-03), otherwise runs an inline hue-preserving HSL lightness search to find the closest AA-safe value
- `useTeamAccentColorAA(teamId)`: hook wrapper feeding the raw `teamAccentColor()` value through the derivation using the confirmed `#121212`/`#ffffff` literals (plan 34-04's `--color-bg-page`/`--color-text-inverse`)
- `AA_TEXT_MIN_RATIO` (4.5) and `AA_UI_MIN_RATIO` (3.0) exported as the single source of truth to be shared with the 34-03 CI contrast-check script
- Whole-palette invariant proven: all 12 teams in `TEAM_CONFIGS` (city, crew, la, miami, nashville, seattle, canada, england, france, mexico, spain, us) converge to an AA-safe color with hue preserved (measured hue deltas 0.0°-0.3°, well within the ±8° test tolerance) — no saturation-reduction fallback was ever triggered for the current palette
- Existing `teamAccentColor`/`useTeamAccentColor` left completely untouched (verified via `git diff` — additive lines only), preserving `ActionLog.tsx`'s raw-color log-prefix carve-out (D-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — failing tests for deriveAaAccentColor + useTeamAccentColorAA** - `f46144b` (test)
2. **Task 2: GREEN — implement deriveAaAccentColor, useTeamAccentColorAA, thresholds** - `23d547f` (feat)

_TDD gate sequence verified in git log: `test(34-02): ...` (RED) precedes `feat(34-02): ...` (GREEN). No REFACTOR commit was needed — the GREEN implementation required no cleanup pass._

## Files Created/Modified

- `packages/client/src/hooks/useTeamColors.ts` - Added `AA_TEXT_MIN_RATIO`/`AA_UI_MIN_RATIO` constants, private HSL<->RGB conversion helpers, `searchAaSafeLightness` search helper, `deriveAaAccentColor`, and `useTeamAccentColorAA`; existing exports unchanged
- `packages/client/src/hooks/useTeamColors.test.ts` - Added `describe('deriveAaAccentColor')` (6 tests: pass-through, light-color adjust, dark-color adjust, whole-palette invariant, hue preservation, threshold-constant export) and `describe('useTeamAccentColorAA')` (2 tests: hook-wraps-pure-fn, undefined-fallback)

## Decisions Made

- **Contrast policy correction (ratified this session):** The plan's `<objective>` documented a mathematically-proven-impossible policy in 34-UI-SPEC.md/34-RESEARCH.md (uniform 4.5:1 both directions — luminance bands for the two directions don't overlap). This plan implements the corrected, feasible policy instead: `contrast(accent, #121212) >= 4.5` (accent-as-text on the charcoal base, SC 1.4.3) AND `contrast(accent, #ffffff) >= 3.0` (white text on an accent hover background, SC 1.4.11). Verified computationally during execution that all 12 current teams converge under this policy with hue preserved.
- **Search granularity:** 2% lightness step size was verified sufficient to converge all 12 teams to within the ±8° hue tolerance without ever needing the saturation-reduction fallback path.
- **wcag-contrast as sole ratio oracle:** All contrast checks (both in the implementation and in the test suite) call `hex()` from `wcag-contrast` directly — no hand-rolled luminance formula anywhere, per 34-RESEARCH.md Pattern 1.

## Deviations from Plan

**None — plan executed exactly as written.** The "Contrast policy correction" was not a deviation from this plan; it was the plan's own explicit instruction (see 34-02-PLAN.md `<objective>` "IMPORTANT — Contrast policy correction" section), executed as specified.

One environment-setup step not explicitly listed as a plan task was required: `node_modules` was absent in this freshly-spawned worktree, so `pnpm install` (workspace-wide) and `pnpm --filter @counter-attack/shared build` were run before any test could execute. This is standard worktree bootstrap, not a plan deviation — no code or plan scope was affected.

## Issues Encountered

None beyond the worktree bootstrap noted above. The lightness-search algorithm was verified against all 12 `TEAM_CONFIGS` colors via a throwaway Node script (not committed) before writing the TypeScript implementation, confirming convergence and hue preservation ahead of time.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `deriveAaAccentColor`/`AA_TEXT_MIN_RATIO`/`AA_UI_MIN_RATIO` are ready to be imported by:
  - Plan 34-03 (CI contrast-check script) — should import the same constants and function rather than reimplementing thresholds
  - Plan 34-04 (GameBoard `--team-accent`/`--home-accent`/`--away-accent` wiring) — should call `useTeamAccentColorAA` in place of (or alongside) `useTeamAccentColor`, and must set `--color-bg-page: #121212` / `--color-text-inverse: #ffffff` to match the literals hardcoded in this plan's hook
- No blockers identified for downstream plans in this phase

---

_Phase: 34-visual-theme-restyle_
_Completed: 2026-07-26_
