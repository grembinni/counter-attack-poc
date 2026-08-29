---
phase: 46-final-cleanup
plan: 03
subsystem: ui
tags: [react, settings-ui, restart-panels, help-text-audit, dead-code]

# Dependency graph
requires:
  - phase: 44-referee-leniency-advanced-settings-drawer
    provides: the Advanced Settings disclosure (.advancedGrid/.advancedColumn) Match Speed now relocates into
provides:
  - Match Speed control moved into the Advanced Settings drawer (left column, 4th row)
  - Free Kick kicker-selection language aligned to the PK/Corner/ThrowIn select-then-lock family
  - 46-AUDIT.md: full 45/45 GamePhase help-text coverage table + 6-candidate redundant-flow disposition table
  - LOOSE_BALL ActionPanel gap fixed (active player previously saw a fully blank panel)
affects: [46-final-cleanup verification, gsd-verify-work CLEANUP-05/07/10/12 evidence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GamePhase-union audit: enumerate every union member, cross-check against production
      state.phase assignments (not type membership alone) before marking a phase covered/n/a"
    - "Reuse an existing CSS-module class for a relocated block instead of authoring a new
      rule when the target container already provides equivalent spacing"

key-files:
  created:
    - .planning/phases/46-final-cleanup/46-AUDIT.md
  modified:
    - packages/client/src/components/GameSettingsScreen.tsx
    - packages/client/src/components/GameSettingsScreen.test.tsx
    - packages/client/src/components/FreeKickSetupPanel.tsx
    - packages/client/src/components/FreeKickSetupPanel.test.tsx
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - "Match Speed block wraps in the existing .section class (not a new CSS rule) to preserve its prior spacing inside the left .advancedColumn"
  - "Free Kick kicker-selection alignment is language-only — FREE_KICK_STAGES/freeKickStageTeam mechanics are unchanged per CONTEXT.md D-03 minimum-scope guidance"
  - "LOOSE_BALL ActionPanel gap (blank panel for the active player) is a genuine copy-only fix — added in this task rather than deferred, reusing the existing 'Loose Ball!' string"
  - "SHOT phase marked deferred, not fixed — 2 of 5 enterGkDiveOrSkip call sites can broadcast phase:'SHOT' with no auto-roll and no ActionPanel branch; correct fix is an engine-level change beyond this task's copy-only scope"
  - "LOBBY and SNAPSHOT marked n/a as confirmed-dead GamePhase union members (never assigned to state.phase in production code) rather than gap; removal deferred as a CLEANUP-13 note, not actioned (type-level change, broader blast radius)"

patterns-established:
  - "CLEANUP-07-style audits must verify state.phase assignment sites directly, not just grep the type union — two GamePhase members (LOBBY, SNAPSHOT) turned out to be dead despite being valid TypeScript union members"

requirements-completed: [CLEANUP-05, CLEANUP-07, CLEANUP-10, CLEANUP-12]

# Metrics
duration: ~2h (across two sessions, including a session interruption/resume)
completed: 2026-08-29
---

# Phase 46 Plan 03: Interaction Consistency Fixes + Help-Text/Redundant-Flow Audit Summary

**Match Speed relocated into the Advanced Settings drawer, Free Kick's kicker-selection copy aligned to the Penalty/Corner/Throw-In select-then-lock family, and a full 45-phase help-text audit (CLEANUP-07) plus 6-candidate redundant-flow disposition table (CLEANUP-12) recorded in `46-AUDIT.md` — including one genuine ActionPanel gap (LOOSE_BALL) found and fixed, and two dead GamePhase union members (LOBBY, SNAPSHOT) discovered and documented.**

## Performance

- **Duration:** ~2h across two sessions (an API/quota interruption occurred after Task 2's commit; resumed cleanly from git state per the coordinator's instructions)
- **Tasks:** 3/3 completed
- **Files modified:** 7 (6 existing files + 1 new audit doc)

## Accomplishments

- Match Speed button-group relocated from its own top-level section into the left `.advancedColumn` (4th row, after Fouls/Booking/Injury), widget/colors/aria-pressed/payload unchanged
- Free Kick panel now states its kicker-selection mechanism explicitly ("Move a player onto the kick spot to become the kicker.") and names the locked kicker ("Kicker: #N Name"), matching Throw-In's format, with no change to `FREE_KICK_STAGES`/`freeKickStageTeam` mechanics or the three sibling panels
- `46-AUDIT.md` created: 45/45 `GamePhase` union members audited for help-text coverage (42 covered, 2 n/a, 1 deferred with evidence), plus a 6-candidate CLEANUP-12 redundant-flow disposition table (all `keep`, each with a specific reason)
- One genuine gap found and fixed in the same task: `ActionPanel.tsx` had no `LOOSE_BALL` render branch — the active-team client saw a fully blank panel while the scatter roll auto-resolved; now shows "Loose Ball!" / "Resolving automatically…"
- Two dead `GamePhase` union members discovered during the audit (`LOBBY`, `SNAPSHOT` — never assigned to `state.phase` in production code) and documented as a CLEANUP-13 note rather than silently ignored

## Task Commits

Each task was committed atomically:

1. **Task 1: Relocate the Match Speed control into the Advanced Settings drawer** - `09d9fe02` (feat)
2. **Task 2: Align the Free Kick panel's kicker-selection language with the select-then-lock family** - `f3c704a1` (feat)
3. **Task 3: Complete and record the help-text and redundant-flow audits** - `4f20e8c7` (docs, includes the LOOSE_BALL fix)

_No TDD tasks in this plan — all three were `type="auto"` with automated verification._

## Files Created/Modified

- `packages/client/src/components/GameSettingsScreen.tsx` - Match Speed block moved into `.advancedGrid`'s left `.advancedColumn`, wrapped in the existing `.section` class
- `packages/client/src/components/GameSettingsScreen.test.tsx` - initial-render test no longer asserts Match Speed visible before Advanced opens; new absent-then-present test; two-column layout test extended to check the speed buttons render inside the left column; payload test opens Advanced before clicking a speed option
- `packages/client/src/components/FreeKickSetupPanel.tsx` - added a neutral kicker-selection instruction row, a locked-kicker naming row (`Kicker: #N Name`), and reworded the red blocking-constraint row so no two rows ever repeat the same requirement simultaneously
- `packages/client/src/components/FreeKickSetupPanel.test.tsx` - updated existing assertions to the new copy; added a "no duplicate row" test and a locked-kicker-row-name test
- `packages/client/src/components/ActionPanel.tsx` - added a `LOOSE_BALL` phase branch (heading + description) before the `HIGH_PASS_MOVE` block
- `packages/client/src/components/ActionPanel.test.tsx` - 3 new tests: D-07 heading coverage for `LOOSE_BALL`, and two PANEL-01-style tests confirming the copy for both active and non-active players
- `.planning/phases/46-final-cleanup/46-AUDIT.md` (new) - CLEANUP-07 45-row help-text coverage table + CLEANUP-12 6-candidate redundant-flow disposition table + conclusion

## Decisions Made

- Reused the existing `.section` CSS class as the Match Speed wrapper inside `.advancedColumn` rather than authoring a new CSS rule — the `git diff` on `GameSettingsScreen.module.css` is empty, satisfying the plan's "no new color, no new spacing value" constraint by construction.
- For Free Kick, kept the instruction row and the reworded red row mutually exclusive by gating the red row on `!isKickerSelectionPhase` — `freeKickKickerChosen === false` (explicit) is a narrower condition than `!kickerLocked` (which also covers the `freeKickKickerChosen === null` un-initialized case), so the two rows are provably never shown together.
- Fixed the `LOOSE_BALL` gap in-task rather than deferring it: it required only a copy addition (reusing the existing "Loose Ball!" string), no new state or panel — squarely within the plan's "fix concrete gaps found" instruction.
- Deferred (did not fix) the `SHOT` phase gap: the correct fix is an engine-level auto-roll or an extension of the existing `phase === 'GK_DIVE'` auto-GOAL gate to also cover `'SHOT'` in `gameHandlers.ts`'s `GAME_HEADER_TARGET` handler — a logic change with its own re-verification burden, outside a help-text task's copy-only scope. Documented with exact file/line evidence in `46-AUDIT.md` for a future bug-fix phase.
- Marked `LOBBY` and `SNAPSHOT` `n/a` (not `gap`) after confirming via grep that neither is ever assigned to `state.phase` in production code — both are dead `GamePhase` union members. Did not remove the union members themselves (type-level change with broader exhaustiveness-check blast radius); flagged as a CLEANUP-13 note only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a genuine blank-panel gap on the LOOSE_BALL phase**
- **Found during:** Task 3 (CLEANUP-07 audit, pre-v1.6 `ActionPanel.tsx` branch sweep)
- **Issue:** `ActionPanel.tsx` had a `useEffect` that auto-fires the scatter roll on `LOOSE_BALL` entry for the active player, but no render branch matched `phase === 'LOOSE_BALL'` anywhere in the component. The non-active player got an adequate generic waiting panel, but the active player — the one whose auto-roll was in flight — fell through every phase check to the final `return null`: a genuinely blank panel with no heading and no text.
- **Fix:** Added a `phase === 'LOOSE_BALL'` branch rendering the existing "Loose Ball!" heading (already used verbatim by the PASS-phase loose-ball sub-case) plus "Resolving automatically…", shown identically to both clients since neither can act during this auto-resolving window.
- **Files modified:** `packages/client/src/components/ActionPanel.tsx`, `packages/client/src/components/ActionPanel.test.tsx`
- **Verification:** 3 new tests pass; full `ActionPanel.test.tsx` suite (90/90) and full client suite (1217/1217) green after the change.
- **Committed in:** `4f20e8c7` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** The fix was a pure copy addition matching an existing convention exactly — no scope creep, no new state, no new component.

## Issues Encountered

- **Session interruption:** the agent's session was terminated by an API/quota error partway through Task 3 (after Tasks 1 and 2 were already committed). Resumed in the same worktree per the coordinator's explicit instruction — verified via `git log`/`git status` that both prior commits were intact and the working tree was clean before continuing, then completed Task 3 from where the audit work had been left off.
- **Worktree had no `node_modules` at session start** (this worktree's dependencies were never installed). Resolved by running `pnpm install --frozen-lockfile` (backgrounded, ~90s) followed by `pnpm --filter @counter-attack/shared build` to produce `dist/` so the client package could resolve `@counter-attack/shared`'s workspace `exports` map. Not a plan deviation — standard worktree setup, not tracked as a Rule 1-4 item.
- **SHOT-phase investigation went deeper than a typical help-text check** (traced `enterGkDiveOrSkip`'s 5 call sites across `gameEngine.ts`/`gameHandlers.ts` to determine whether `phase: 'SHOT'` is genuinely reachable by a client). This was necessary to responsibly choose between `gap`/`n/a`/`deferred` for that row rather than guessing — resolved as `deferred` with full evidence rather than either silently marking it `n/a` (which would have been incorrect, since it *is* reachable at 2 sites) or attempting an engine fix out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CLEANUP-05, CLEANUP-07, CLEANUP-10, and CLEANUP-12 requirements are satisfied by this plan's changes plus `46-AUDIT.md`'s evidence trail.
- `46-AUDIT.md` documents one deferred item (`SHOT` phase dice-roll-resolution gap) and one dead-code note (`LOBBY`/`SNAPSHOT` union members) for a future phase — neither blocks Phase 46's own close.
- Full client test suite (1217 tests), `pnpm -w typecheck`, and `pnpm knip` all exit clean after this plan's changes.

---
*Phase: 46-final-cleanup*
*Completed: 2026-08-29*
