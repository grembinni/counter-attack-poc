---
phase: quick-260621-ajd
plan: 01
subsystem: ui
tags: [react, css-modules, vitest, action-panel]

# Dependency graph
requires:
  - phase: 13-layout-clock
    provides: GameBoard top-band layout with .actionSection wrapper around ActionPanel
  - phase: 17-rule-bugs
    provides: FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE phases with freeMoveEligibleIds/freeMoveUsedPace
provides:
  - Borderless ActionPanel/KickOffSetupPanel helper-text containers in the top band
  - Meaningful "Kick-Off!" helper copy in the KICK_OFF chooser step
  - Live "{remaining} of {total} players left to move" countdown in MOVE phase
  - Same countdown pattern applied to FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE helper text
affects: [18-design-polish, 18.4-ux-enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Remaining-player countdown: remaining = Math.max(total - movedCount, 0), rendered as '{remaining} of {total} players left to move.'"

key-files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.module.css
    - packages/client/src/components/KickOffSetupPanel.module.css
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - "FREE_MOVE countdown counts a piece as 'moved' when freeMoveUsedPace[id] > 0 (any pace spent), not only when fully exhausted at 6"
  - "Kick-off helper block only renders when isKickOff is true; the regular PASS chooser keeps its existing bare 'Choose Action' label unchanged"

patterns-established:
  - "Countdown helper text pattern: derive remaining from a total minus a moved/used count, clamp at 0, render as '{remaining} of {total} players left to move.'"

requirements-completed: [QUICK-ACTIONPANEL-HELPER]

# Metrics
duration: 6min
completed: 2026-06-21
---

# Quick Task 260621-ajd: ActionPanel Helper Text Cleanup Summary

**Removed the blue outline boxes framing ActionPanel/kick-off helper text and replaced static "Move up to N players" copy with a live remaining-player countdown for MOVE and FREE_MOVE phases, plus added meaningful kick-off copy.**

## Performance

- **Duration:** 6 min (execution; plus one-time `pnpm install` + shared package build to restore a missing worktree environment)
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- `.actionSection` (GameBoard top band) and KickOffSetupPanel `.panel` no longer render a `1px solid #0f3460` outline border around their helper text — backgrounds, radii, and padding unchanged
- KICK_OFF chooser now shows a "Kick-Off!" helper block explaining play starts with a Standard Pass from the centre circle, instead of just a bare "Choose Action" label
- MOVE phase helper text now reads "{remaining} of {total} players left to move." and counts down live as players are moved (ATTACKER_4/DEFENDER_5/ATTACKER_2 slots); the ATTACKER_2 "(2 hex max)" note is preserved
- FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE helper text appends the same live countdown, derived from `freeMoveEligibleIds[side]` and `freeMoveUsedPace`

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the blue outline boxes from the ActionPanel + kick-off helper containers** - `7da7287` (fix)
2. **Task 2: Add kick-off helper copy + remaining-player countdown to MOVE and FREE_MOVE** - `4d36390` (test, RED) → `0ea4017` (feat, GREEN)

_TDD task: RED commit `4d36390` added 5 failing tests; GREEN commit `0ea4017` implemented the countdown/copy and all 30 ActionPanel tests passed._

## Files Created/Modified

- `packages/client/src/components/GameBoard.module.css` - removed `.actionSection` outline border
- `packages/client/src/components/KickOffSetupPanel.module.css` - removed `.panel` outline border
- `packages/client/src/components/ActionPanel.tsx` - added `freeMoveEligibleIds`/`freeMoveUsedPace` selectors; MOVE phase countdown; FREE_MOVE countdown; KICK_OFF helper block
- `packages/client/src/components/ActionPanel.test.tsx` - added 5 new tests covering the MOVE/FREE_MOVE countdown and KICK_OFF helper copy

## Decisions Made

- FREE_MOVE "moved" detection uses `freeMoveUsedPace[id] > 0` (any pace spent counts as moved) rather than requiring the full 6-hex budget to be exhausted — matches the plan's intent of reflecting in-slot progress, not just completion
- Countdown clamps at 0 via `Math.max(total - movedCount, 0)` to guard against any transient over-count from stale state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing worktree dependencies and built `@counter-attack/shared`**

- **Found during:** Task 2 (running `pnpm vitest run src/components/ActionPanel.test.tsx` to confirm RED state)
- **Issue:** The worktree had no `node_modules` at all (commit hook failed with `lint-staged not found`; vitest failed with `Failed to resolve entry for package "@counter-attack/shared"` because `packages/shared/dist` did not exist)
- **Fix:** Ran `pnpm install` (resolved entirely from the existing lockfile, no version changes) and `pnpm --filter @counter-attack/shared build` to produce `dist/`
- **Files modified:** None tracked — `node_modules/` and `packages/shared/dist/` are both gitignored; no package.json/lockfile changes
- **Verification:** `git status --short` confirmed no untracked files after install/build; subsequent test runs and commits succeeded normally
- **Committed in:** N/A (no trackable changes — pure local environment restoration)

**2. [Rule 1 - Bug] Fixed a test-query ambiguity in my own new KICK_OFF test**

- **Found during:** Task 2 (first GREEN test run)
- **Issue:** `screen.getByText(/standard pass/i)` matched both the new helper-line2 copy and the existing "Standard Pass" button, causing a "Found multiple elements" failure
- **Fix:** Removed the redundant assertion; the test still verifies the helper copy via `getByText(/centre/i)` and the button via `getByRole('button', { name: /standard pass/i })`
- **Files modified:** packages/client/src/components/ActionPanel.test.tsx
- **Verification:** All 30 ActionPanel tests pass
- **Committed in:** `0ea4017` (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking environment fix, 1 bug in newly-added test)
**Impact on plan:** Both fixes were necessary to execute the plan at all (no working test runner without them) or to make the new test suite internally consistent. No scope creep — no application code outside the plan's stated files was touched.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ActionPanel helper text cleanup is complete; no follow-on work identified by this task
- The `freeMoveUsedPace[id] > 0` "moved" heuristic could be revisited if a future phase wants finer-grained partial-move countdown semantics (e.g. a player who has moved 2 of 6 hexes still shows as "left to move" under the current definition only once they reach 0 remaining pace is irrelevant — they show as moved as soon as any pace is spent)

---

_Phase: quick-260621-ajd_
_Completed: 2026-06-21_

## Self-Check: PASSED

All claimed files and commits verified present:

- FOUND: packages/client/src/components/GameBoard.module.css
- FOUND: packages/client/src/components/KickOffSetupPanel.module.css
- FOUND: packages/client/src/components/ActionPanel.tsx
- FOUND: packages/client/src/components/ActionPanel.test.tsx
- FOUND: .planning/quick/260621-ajd-clean-up-actionpanel-helper-text-1-remov/260621-ajd-SUMMARY.md
- FOUND commit: 7da7287
- FOUND commit: 4d36390
- FOUND commit: 0ea4017
