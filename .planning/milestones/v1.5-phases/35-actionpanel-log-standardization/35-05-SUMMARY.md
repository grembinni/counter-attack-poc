---
phase: 35-actionpanel-log-standardization
plan: 05
subsystem: ui
tags: [react, action-panel, ux-copy, css-cleanup]

# Dependency graph
requires:
  - phase: 35-actionpanel-log-standardization (plan 04)
    provides: 'PanelShell({ wide?, children }), ACTION_PANEL_HEADING, .panelHeading'
provides:
  - 'waitingPanel(detail) function + waitingHelperBlock(detail) shared two-line waiting markup'
  - '13 phase-specific waiting-state detail strings (D-09) naming the acting side or actor'
  - 'Uniform two-line helperBlock shape for the PASS/KICK_OFF chooser, PASS step-2 prompt, and FREE_MOVE_* helper text (PANEL-01)'
  - '.phaseLabel and .gkLabel removed from ActionPanel.module.css'
affects: [action-log-standardization, ui-copy-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'waitingPanel(detail) as a named function (not an arrow const) so its declaration site is grep-discoverable alongside its 13 call sites'
    - 'waitingHelperBlock(detail) shared two-line waiting markup reused by both the generic waitingPanel wrapper and an inline already-confirmed branch (HEADER myConfirmed)'

key-files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.module.css
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - 'actingSideLabel (Attacking/Defending) is derived from activeTeam === attackingTeam and used only at the 5 call sites gated by !isActivePlayer; the 5 keeper/defender-gated waiting sites (GK_DIVE, GK_RESTART, GK_QUICK_THROW, GK_KICK_TARGET, SNAPSHOT_DEFLECT) use an explicitly-named actor (Keeper / Defending team) instead, since activeTeam may still be the attacking team when those guards fire'
  - 'waitingPanel converted from a const to a named function declaration (not an arrow function assigned to a const) so its own declaration line contains the literal substring "waitingPanel(" for source-audit grep consistency with its 13 call sites'
  - 'SNAPSHOT_DEFLECT helperLine1 hyphen-to-em-dash change (outlier d) was folded into the same edit as its D-09 waiting-text call site since both touch the same lines'

patterns-established:
  - 'Every ActionPanel phase state now renders exactly one .helperBlock with a short helperLine1 title and a helperLine2 detail — no phase-gated block outputs a bare label span'

requirements-completed: [PANEL-01, PANEL-04]

# Metrics
duration: ~15min
completed: 2026-07-27
---

# Phase 35 Plan 05: ActionPanel Waiting-Text Parameterization & Two-Line Uniformity Summary

**Parameterized ActionPanel's single generic "Waiting for opponent..." message into 13 phase-specific detail strings naming the acting side/actor (D-09), and unified the 4 remaining help-text outliers (PASS chooser, PASS target prompt, FREE_MOVE, SNAPSHOT_DEFLECT punctuation) into the two-line title-plus-detail shape (PANEL-01).**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-27
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- Converted the single `waitingPanel` constant into a `waitingPanel(detail)` function backed by a shared `waitingHelperBlock(detail)` two-line markup, reused by HEADER's already-confirmed inline branch — the waiting title (`Opponent's Turn`) and its markup now exist in exactly one place in the file.
- All 13 waiting-state early returns now render a phase-specific detail string naming the acting side (`Attacking`/`Defending team is repositioning…`), the specific actor (`Keeper is …`), or, for the HEADER post-duel state, the winning side or a tie message — the generic `Waiting for opponent...` phrase is fully removed from the source file.
- Brought all 4 remaining help-text outliers into the two-line `helperBlock` (title + detail) convention: the PASS/KICK*OFF chooser now always renders one helper block (`Kick-Off!` / `Choose an Action!`) instead of a conditional block plus a separate bare `Choose Action` label; the PASS step-2 target prompt renders `{PassType}!` / `Click a target hex.` instead of a bare label; `FREE_MOVE*\*`moved its mechanic explanation out of the title slot into a short`Free Move!`title with the explanation in the detail line;`SNAPSHOT_DEFLECT`'s title now uses an em dash (`Snapshot — Deflection Attempt!`) matching the convention used elsewhere in the file.
- Removed the now-fully-unreferenced `.phaseLabel` and `.gkLabel` CSS rules (and their full-width group membership) from `ActionPanel.module.css`, confirmed `GameBoard.module.css`'s identically-named `.phaseLabel` is untouched.
- Added 6 new waiting-state tests (GK_DIVE, SNAPSHOT_DEFLECT, GK_RESTART, GK_QUICK_THROW, GK_KICK_TARGET, HEADER accuracy-pending) and 3 new PANEL-01 tests (non-kick-off PASS chooser, PASS step-2 prompt, SNAPSHOT_DEFLECT em dash), while updating 5 pre-existing generic-waiting assertions and 2 pre-existing outlier assertions to their new exact strings. Client test count for this file grew from 58 to 68.

## Task Commits

Each task was committed atomically:

1. **Task 1: Parameterize the waiting panel with per-phase acting-side and action text (D-09)** - `51b6328` (feat)
2. **Task 2: Bring the four help-text outliers into the two-line title-plus-detail shape and drop the orphaned CSS (PANEL-01)** - `e0d0f43` (feat)

**Plan metadata:** committed separately per orchestrator convention (worktree mode — this executor does not perform the final metadata commit; the orchestrator handles it after merge).

## Files Created/Modified

- `packages/client/src/components/ActionPanel.tsx` - `waitingPanel(detail)` + `waitingHelperBlock(detail)`, `actingSideLabel` const, 13 phase-specific waiting-detail call sites, HEADER myConfirmed branch reuse, and the 4 restructured outlier help blocks
- `packages/client/src/components/ActionPanel.module.css` - `.phaseLabel` and `.gkLabel` rules and their full-width group membership removed
- `packages/client/src/components/ActionPanel.test.tsx` - 5 pre-existing waiting-panel assertions and 2 pre-existing outlier assertions updated to exact new strings; 2 new describe blocks added (`D-09: phase-specific waiting text`, `PANEL-01: uniform two-line helper blocks`)

## Decisions Made

- `actingSideLabel` is derived from `activeTeam === attackingTeam` and used only where the guard is `!isActivePlayer` (HIGH_PASS_MOVE, FIRST_TIME_PASS_MOVE, GK_KICK_MOVE, FREE_MOVE_ATTACK/DEFENSE, and the final generic PASS/KICK_OFF/MOVE fallback). The 5 keeper/defender-gated waiting sites (GK_DIVE, GK_RESTART, GK_QUICK_THROW, GK_KICK_TARGET, SNAPSHOT_DEFLECT) name an explicit actor (`Keeper`, `Defending team`) instead, because `activeTeam` may still equal the attacking team when those specific guards fire — using `actingSideLabel` there would name the wrong side.
- `waitingPanel` was written as a named function declaration (`function waitingPanel(detail: string) { … }`) rather than an arrow function assigned to a `const`, so the declaration line itself contains the literal `waitingPanel(` substring — this satisfies the plan's source-grep acceptance criterion (14 occurrences: 1 declaration + 13 call sites) without any special-casing.
- The SNAPSHOT_DEFLECT ASCII-hyphen-to-em-dash change (Task 2 outlier d) was applied in the same edit as its D-09 waiting-text change (Task 1) since both touch adjacent lines in the same block; both are recorded as completed within their respective task's acceptance criteria.

## Deviations from Plan

None - plan executed exactly as written. One environment-only action was required and is not a plan deviation: this worktree had no `node_modules` and `packages/shared` had no built `dist/` output (both expected for a fresh git worktree, since neither is tracked in git); `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` were run before any verification command could execute, using only the existing local pnpm store (no network installs, no dependency changes).

## Issues Encountered

- The whole-workspace `pnpm lint` command fails with a pre-existing, unrelated `packages/shared` typescript-eslint file-count-cap parsing error (documented in `.planning/phases/32-code-cleanup/deferred-items.md` and `PROJECT.md`'s known tech debt). This is out of scope for this plan (SCOPE BOUNDARY — pre-existing issue confined to `packages/shared` test files, not caused by this plan's changes). Verified `ActionPanel.tsx`/`ActionPanel.test.tsx` lint clean in isolation via `npx eslint` scoped to just those files (0 errors), and confirmed `pnpm --filter @counter-attack/client typecheck`, `pnpm stylelint`, and `pnpm -r build` all pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 13 ActionPanel waiting states and the 4 previously-inconsistent help-text outliers now conform to PANEL-01's uniform two-line format; ready for any subsequent action-log standardization plan in this phase to proceed without further ActionPanel copy work.
- Full client test suite (472 tests across 25 files, including this file's 68), typecheck, stylelint, and full-workspace build all pass.

---

_Phase: 35-actionpanel-log-standardization_
_Completed: 2026-07-27_

## Self-Check: PASSED

All modified files present (`ActionPanel.tsx`, `ActionPanel.module.css`, `ActionPanel.test.tsx`) and both task commits (`51b6328`, `e0d0f43`) verified present in git log.
