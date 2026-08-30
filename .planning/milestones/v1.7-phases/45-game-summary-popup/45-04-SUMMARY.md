---
phase: 45-game-summary-popup
plan: 04
subsystem: ui
tags: [react, zustand, css-modules, match-summary, xg, stats]

# Dependency graph
requires:
  - phase: 45-01
    provides: "MatchStats type, GameState.matchStats, RefereeCard.wasManualOverride, computeShotXg/EMPTY_MATCH_STATS/recordShotInStats"
provides:
  - "MatchSummaryContent — the single reusable stats block (settings recap + 8 stat rows) consumed by both the standalone modal and the HALF_TIME/FULL_TIME overlay"
  - "MatchSummaryContent.module.css — bar/pill/accordion styling reusable by both call sites"
  - "29-test regression suite covering settings recap, diverging bars, possession, and the xG accordion"
affects: [45-05, 45-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Diverging bar sub-component (DivergingRow) taking optional homeDisplay/awayDisplay overrides and homeValueClassName/awayValueClassName overrides, reused across 7 of 8 stat rows"
    - "Possession row as dedicated markup (not the diverging sub-component) — continuous bar with a neutral remainder segment"
    - "Plain useState conditional-render accordion for the xG explainer, mirroring GameSettingsScreen.tsx's Advanced-drawer disclosure pattern"

key-files:
  created:
    - packages/client/src/components/MatchSummaryContent.module.css
    - packages/client/src/components/MatchSummaryContent.tsx
    - packages/client/src/components/MatchSummaryContent.test.tsx
  modified: []

key-decisions:
  - "Possession row rendered as its own dedicated markup rather than reusing DivergingRow, since it is a direct 0-100% pair over a continuous bar, not a centre-split comparison (per 45-UI-SPEC.md)"
  - "xG row's info-icon and explainer are layered onto DivergingRow via optional labelExtra/belowBar render-prop slots rather than forking a second row component"
  - "Settings recap toggle words declared once as a local array (PD-17 word pairs), not hand-written six times"

patterns-established:
  - "DivergingRow render-prop slots (labelExtra, belowBar) for row-specific affordances without forking the shared bar-proportion logic"

requirements-completed: [STATS-03, STATS-04, STATS-05, STATS-06, STATS-07, STATS-08, STATS-09]

# Metrics
duration: 17min
completed: 2026-08-28
---

# Phase 45 Plan 04: MatchSummaryContent Summary

**Built the single reusable `MatchSummaryContent` block — inline D-12/D-13 settings-toggle recap plus 8 proportional stat rows (possession, passes, tackles/steals, shots, xG, fouls, cards) — with zero client-side authoritative computation, consumed identically by both the on-demand modal and the HALF_TIME/FULL_TIME overlay.**

## Performance

- **Duration:** ~17 min (including a one-time `pnpm install` to materialize this worktree's `node_modules`)
- **Started:** 2026-08-28T19:35:00Z (approx, first tool call)
- **Completed:** 2026-08-28T19:52:00Z
- **Tasks:** 3 (1 non-TDD CSS task, 2 TDD tasks each with RED+GREEN commits)
- **Files modified:** 3 (all new)

## Accomplishments

- `MatchSummaryContent.module.css`: stylelint-clean CSS module (0 literal colors, 0 `rgb()`/`hsl()`, 0 `--color-accent-gold` usages) providing every class the block needs — settings recap, divider, diverging bar (two half-tracks + centre seam + no-data modifier), possession pills/continuous bar/neutral-remainder segment, yellow/red card value modifiers, and the 16px info-icon + accordion explainer classes.
- `MatchSummaryContent.tsx`: renders the six-item D-12 settings recap (Fouls, Booking, Injury, Out-of-Bounds, Referee Leniency with Manual/Auto distinction, Tackle/Steal Decline) and all 8 stat rows in the contracted order (Possession → Passes Completed → Tackles & Steals → Shots → Expected Goals (xG) → Fouls → Yellow Cards → Red Cards), reading exclusively from `useGameStore` per-slice selectors with zero authoritative computation (only display ratios/bar widths).
- `MatchSummaryContent.test.tsx`: 29 named tests, one per behavior bullet in both TDD tasks, covering the settings recap's six toggle words and Manual/Auto distinction, the D-13 scope boundary (no Game Speed/formation/uniform), diverging-bar proportion math (75%/25% split, no-data flat-track), the Tackles & Steals raw-count-driven bar vs. its percentage display, the Yellow/Red Cards card-colour value exception, the possession row's actionCount-denominator percentages with a neutral remainder and a zero-actionCount guard, and the xG row's two-decimal display with an unrounded bar plus the click-to-open/close explainer accordion.

## Task Commits

Each task was committed atomically:

1. **Task 45-04-01: Author the MatchSummaryContent CSS module** - `9e9ebcfe` (feat)
2. **Task 45-04-02: Build the settings recap and the seven diverging stat rows** - `77f9d06e` (test, RED) → `e3b7f0f3` (feat, GREEN)
3. **Task 45-04-03: Add the possession row and the xG explainer accordion** - `d474d553` (test, RED) → `e1db0739` (feat, GREEN)

_TDD tasks 02 and 03 each have a `test(...)` commit before their `feat(...)` commit — RED confirmed by running the suite before implementing (11 and 12 new failures respectively), GREEN confirmed after._

**Plan metadata:** committed by the orchestrator after all worktree agents in this wave complete (per the parallel-execution contract — this executor does not write STATE.md/ROADMAP.md).

## Files Created/Modified

- `packages/client/src/components/MatchSummaryContent.module.css` - All layout, bar, pill, and accordion styles (235 lines)
- `packages/client/src/components/MatchSummaryContent.tsx` - The single reusable `MatchSummaryContent` component (260 lines)
- `packages/client/src/components/MatchSummaryContent.test.tsx` - 29-test regression suite (478 lines)

## Decisions Made

- Possession row built as its own dedicated markup (continuous bar, no centre gap) rather than reusing `DivergingRow`, per 45-UI-SPEC.md's explicit "not a diverging bar" callout for this one row.
- Extended `DivergingRow` with optional `labelExtra`/`belowBar` render-prop slots so the xG row's info-icon and accordion explainer layer onto the shared sub-component instead of forking a second, near-duplicate row implementation.
- Added a `POSSESSION` label to the possession row's pill row (not explicitly specified in the plan action, but consistent with every other row's 3-part home-label-away text layout and D-11's "one block" consistency goal) — Rule 2 (missing-completeness) addition, purely cosmetic/structural, no behavior risk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed two `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` typecheck errors**
- **Found during:** Task 45-04-02 (GREEN verification)
- **Issue:** `tsconfig.base.json` enables both `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. `DivergingRow`'s `homeValueClassName?: string` prop rejected the `string | undefined` value produced by indexing the CSS-module import (`styles.valueCardYellow`), and array indexing in a test (`positions[i]`) typed as possibly-undefined broke a `toBeGreaterThan` call.
- **Fix:** Widened the two class-name props to `string | undefined` explicitly; added non-null assertions (`as number`) at the two known-in-bounds array-index test sites; removed two test overrides that explicitly assigned `undefined` to fields whose `Partial<GameState>` type (under `exactOptionalPropertyTypes`) doesn't include `undefined` — those fields are already `undefined` by default in `mockMovementState`, so the override was redundant as well as a type error.
- **Files modified:** `packages/client/src/components/MatchSummaryContent.tsx`, `packages/client/src/components/MatchSummaryContent.test.tsx`
- **Verification:** `pnpm --filter @counter-attack/client typecheck` exits 0; all 29 tests still pass.
- **Committed in:** `e3b7f0f3` (Task 02 GREEN commit)

**2. [Rule 1 - Bug] Fixed test assertion library mismatch (`toBeInTheDocument` unavailable)**
- **Found during:** Task 45-04-02 (initial GREEN run)
- **Issue:** The test file was drafted using jest-dom's `toBeInTheDocument()` matcher, but this project's Vitest setup has no jest-dom extension wired (`vitest.config.ts` has no `setupFiles`, and no sibling test file in the codebase uses it — confirmed by grep). Every assertion failed with "Invalid Chai property".
- **Fix:** Rewrote all `toBeInTheDocument()`/`.not.toBeInTheDocument()` assertions to the codebase's established `toBeDefined()`/`toBeNull()` convention (confirmed against `TackleStealPromptPanel.test.tsx`).
- **Files modified:** `packages/client/src/components/MatchSummaryContent.test.tsx`
- **Verification:** All 17 (then 29) tests pass.
- **Committed in:** `e3b7f0f3` (Task 02 GREEN commit)

**3. [Rule 1 - Bug] Fixed a `getByText` multiple-match failure in the 40/40 possession test**
- **Found during:** Task 45-04-03 (GREEN verification)
- **Issue:** `screen.getByText('40%')` threw because both the home and away pills render identical text when possession is tied 40/40.
- **Fix:** Changed the assertion to `screen.getAllByText('40%').length === 2`.
- **Files modified:** `packages/client/src/components/MatchSummaryContent.test.tsx`
- **Verification:** All 29 tests pass.
- **Committed in:** `e1db0739` (Task 03 GREEN commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in the drafted test/type code, none in the shipped component's runtime behavior).
**Impact on plan:** All three fixes are test/typecheck-only corrections required to make the plan's own specified behavior verifiable under this repo's actual toolchain configuration. No scope creep; no change to any acceptance criterion.

## Issues Encountered

- **Worktree had no `node_modules`.** This is a fresh git worktree with no prior `pnpm install`. Per the project's own documented Windows-worktree risk (`feedback_worktree_junction_risk` memory: junction-based `node_modules` workarounds have previously deleted real shared package content), a directory-junction shortcut was deliberately NOT used. Instead ran `pnpm install --frozen-lockfile` directly inside the worktree — pnpm's content-addressable store meant 100% of packages were reused from the existing store with zero downloads (~3 min). This is safe and does not touch the main repo's `node_modules`.
- **`pnpm lint` (whole-monorepo) fails** with a pre-existing `packages/shared` typescript-eslint "too many files matched the default project" parsing error. This is documented, pre-existing tech debt (STATE.md: "the whole-workspace `pnpm lint` OOMs on a pre-existing `packages/shared` typescript-eslint file-count-cap config issue... doesn't gate CI") entirely unrelated to this plan's client-only changes. Per the deviation rules' scope boundary, this was not touched. Verified instead: `npx eslint` directly on both new files (`MatchSummaryContent.tsx`, `MatchSummaryContent.test.tsx`) — zero errors/warnings.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `MatchSummaryContent` is ready for plan 45-05 to mount in two places: a new standalone modal opened from the scoreboard (i) icon, and appended inside the existing HALF_TIME/FULL_TIME overlay card — per this plan's objective, no rendering logic needs to be duplicated or forked at either call site.
- All inputs the component reads (`gameState.matchStats`, `refereeCard.wasManualOverride`, the five toggle fields, `actionCount`) already exist on `GameState` from plan 45-01; plans 45-02/45-03 (parallel, server-side instrumentation) populate `matchStats` at runtime but this component already renders correctly with `matchStats` entirely undefined (all-zero display), so there is no hard runtime dependency ordering between this plan and 45-02/45-03.
- Full regression run performed before closing this plan: client suite 1187/1187 passed (including `GameBoard.test.tsx`, which shares the store fixtures this component's tests mutate), shared suite 902/902 passed, `pnpm --filter @counter-attack/client typecheck` and `pnpm stylelint` both exit 0, `pnpm --filter @counter-attack/client check-contrast` still passes (12/12 teams clear AA).

## Self-Check: PASSED

- FOUND: `packages/client/src/components/MatchSummaryContent.module.css`
- FOUND: `packages/client/src/components/MatchSummaryContent.tsx`
- FOUND: `packages/client/src/components/MatchSummaryContent.test.tsx`
- FOUND commit: `9e9ebcfe` (Task 45-04-01)
- FOUND commit: `77f9d06e` (Task 45-04-02 RED)
- FOUND commit: `e3b7f0f3` (Task 45-04-02 GREEN)
- FOUND commit: `d474d553` (Task 45-04-03 RED)
- FOUND commit: `e1db0739` (Task 45-04-03 GREEN)

---
*Phase: 45-game-summary-popup*
*Completed: 2026-08-28*
