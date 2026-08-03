---
phase: 35-actionpanel-log-standardization
plan: 06
subsystem: ui
tags: [react, css-modules, copy, actionpanel, kickoffsetuppanel]

# Dependency graph
requires:
  - phase: 35-actionpanel-log-standardization
    provides: ActionPanel/FreeKickSetupPanel copy+alignment conventions from plans 03 and 05
provides:
  - Centered heading/constraint-row text in KickOffSetupPanel matching sibling panels
  - Human-friendly centre-hex and placement guidance strings in KickOffSetupPanel
  - Renamed FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE title ("Position for Kick!")
  - Reworded non-kick-off action-chooser detail line naming move/pass/shoot
affects: [35-UAT, phase-35-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel copy for player-facing status rows avoids raw validation-state labels (e.g. 'Placement: valid') in favor of plain-language instructions"

key-files:
  created: []
  modified:
    - packages/client/src/components/KickOffSetupPanel.module.css
    - packages/client/src/components/KickOffSetupPanel.tsx
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - "KickOffSetupPanel .panel container keeps flex-direction: column (unlike FreeKickSetupPanel's row-wrap layout) — only text-align: center was added to .panelHeading and .constraintRow, no flex:0 0 100% needed"
  - 'zoneGuidance/piecesLabel consts added directly after disabledTitle to keep placement-row string composition readable and singular/plural-correct'

patterns-established: []

requirements-completed: [PANEL-01, PANEL-04]

# Metrics
duration: ~15min
completed: 2026-07-27
---

# Phase 35 Plan 06: ActionPanel/KickOffSetupPanel Gap Closure Summary

**Centered KickOffSetupPanel text, human-friendly setup guidance copy, renamed FREE_MOVE title to "Position for Kick!", and reworded the generic action-chooser detail line to name move/pass/shoot — closing all 5 diagnosed UAT gaps from 35-UAT.md test 2.**

## Performance

- **Duration:** ~15 min (including dependency install/build required for isolated worktree)
- **Completed:** 2026-07-27
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- KickOffSetupPanel's heading and both constraint rows now render centered, matching the already-centered ActionPanel/FreeKickSetupPanel siblings
- KickOffSetupPanel's centre-hex and placement rows show plain player-facing instructions instead of raw validation-state labels ("Centre hex: occupied" / "Placement: valid")
- ActionPanel's non-kick-off action-chooser detail line now names the concrete available actions (move a player, pass, shoot) instead of vague "use the ball" phrasing
- ActionPanel's FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE title renamed from "Free Move!" to "Position for Kick!"
- All 3 stale ActionPanel.test.tsx assertions (plus their test-description prose) updated to match the new copy

## Task Commits

Each task was committed atomically:

1. **Task 1: KickOffSetupPanel centering + human-friendly setup copy (gaps 1, 2, 3)** - `f63bf99` (fix)
2. **Task 2: ActionPanel action-chooser wording + FREE_MOVE rename (gaps 4, 5)** - `eb28ae5` (fix)

_Plan metadata commit pending (SDK final commit step)._

## Files Created/Modified

- `packages/client/src/components/KickOffSetupPanel.module.css` - Added `text-align: center` to `.panelHeading` and `.constraintRow`
- `packages/client/src/components/KickOffSetupPanel.tsx` - Added `zoneGuidance`/`piecesLabel` consts; replaced raw centre-hex and placement constraint text with plain player-facing instructions
- `packages/client/src/components/ActionPanel.tsx` - Renamed FREE_MOVE helper title to "Position for Kick!"; reworded non-kick-off action-chooser detail line
- `packages/client/src/components/ActionPanel.test.tsx` - Updated 3 stale assertions + 3 test-description strings to match new copy

## Decisions Made

- Kept `disabledTitle` button-tooltip text and all boolean constraint logic (`constraintsMet`/`placementValid`/`piecesOutOfZone`/`centreHexOccupied`) untouched — this plan was scoped as copy/CSS-only
- `zoneGuidance` and `piecesLabel` declared as local consts (not inlined) to keep the placement-row JSX readable and to correctly handle singular/plural ("1 player" vs "2 players")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The isolated git worktree had no `node_modules` and no built `packages/shared/dist` output (expected for a fresh worktree checkout). Ran `pnpm install --frozen-lockfile` (safe: pulls from the existing pnpm content-addressable store, does not touch the main repo's `node_modules`) and `pnpm --filter @counter-attack/shared build` to produce the `dist/index.js`/`dist/index.d.ts` that `packages/client` resolves via its workspace symlink. This is standard first-run worktree setup, not a plan deviation — no source files were affected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 diagnosed 35-UAT.md test-2 gaps closed; PANEL-01 and PANEL-04 requirements satisfied for this plan's scope
- Full client test suite (472 tests), typecheck, and stylelint all pass clean
- Ready for phase-level verification/UAT re-check of the unified heading/helper/Confirm/Keeper system

---

_Phase: 35-actionpanel-log-standardization_
_Completed: 2026-07-27_

## Self-Check: PASSED

All 4 modified source files and the SUMMARY.md file exist on disk; all 3 commit hashes (f63bf99, eb28ae5, 79e1b45) found in git log.
