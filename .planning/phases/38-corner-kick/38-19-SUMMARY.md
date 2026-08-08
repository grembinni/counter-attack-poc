---
phase: 38-corner-kick
plan: 19
subsystem: ui
tags: [react, zustand, event-banner, restart-phases, gap-closure]

# Dependency graph
requires:
  - phase: 38-corner-kick (38-16)
    provides: CORNER_KICK_CLEAR_OUT GamePhase value used as one of the four RESTART_BANNERS keys
provides:
  - RESTART_BANNERS phase-entry table in EventBanner.tsx, mapping the four existing restart
    entry phases (THROW_IN_SETUP, GOAL_KICK_SETUP_GK, CORNER_KICK_CLEAR_OUT, FREE_KICK_SETUP)
    to their banner text
  - A prevPhaseRef-driven useEffect that fires the existing notable/1000ms banner treatment
    exactly once per restart phase entry
  - Full test coverage (fire-once, no-fire-on-mount, non-restart no-op, variant/duration parity)
  - Explicit deferred-items.md record naming the Phase 39 penalty-kick follow-up as a one-row
    RESTART_BANNERS addition
affects: [39-fouls-cards-injuries-penalty-kicks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Phase-entry diff-and-trigger via useRef, mirroring the existing eventLog-length diff
      pattern (lastProcessedLengthRef) already in EventBanner.tsx'

key-files:
  created: []
  modified:
    - packages/client/src/components/EventBanner.tsx
    - packages/client/src/components/EventBanner.test.tsx
    - .planning/phases/38-corner-kick/deferred-items.md

key-decisions:
  - "RESTART_BANNERS is phase-keyed, not event-keyed, because the Free Kick award emits no
    ActionEvent at all (triggerOffsideFoul appends nothing to eventLog) — an event-keyed table
    could not cover all four restarts uniformly, and phase-entry detection is also immune to
    the STATE.md v1.6 'only the tail event is inspected' pitfall class"
  - "prevPhaseRef initialises to the current phase on first render (mirrors
    lastProcessedLengthRef's mount-safety), so a reconnect snapshot landing mid-restart never
    fires a stale banner"
  - 'Only CORNER_KICK_CLEAR_OUT is in the table for the corner family, not
    CORNER_KICK_GK_SETUP_ATTACKING — once 38-20 lands and wires that transition, adding the
    second corner phase would double-fire on the intra-family transition'

patterns-established:
  - 'One-entry-per-restart-family rule documented directly above RESTART_BANNERS, with the
    rationale (double-fire risk) and the Phase 39 extension point named inline'

requirements-completed: [OOB-03]

# Metrics
duration: ~35min
completed: 2026-08-08
---

# Phase 38 Plan 19: Restart Banners (38-15 defect 4 closure) Summary

**Added a `RESTART_BANNERS` phase-entry table and edge-detected `useEffect` to `EventBanner`, giving Throw In, Goal Kick, Corner Kick, and Free Kick the same transient centred-banner treatment turnovers already had — with the Penalty Kick fifth row recorded as a Phase 39 one-line extension.**

## Performance

- **Duration:** ~35 min (majority spent on first-run `pnpm install` / `@counter-attack/shared` build inside a fresh worktree with no pre-existing `node_modules`)
- **Completed:** 2026-08-08
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- `EventBanner.tsx` now shows a 1000ms notable banner ("Throw In!", "Goal Kick!", "Corner Kick!", "Free Kick!") exactly once on entry into each restart's entry phase, without touching `getBannerMessage`, the pre-existing eventLog effect, the auto-dismiss effect, or any CSS.
- The trigger is phase-driven (a second `useRef`/`useEffect` pair mirroring the existing `lastProcessedLengthRef` pattern), so it survives the reconnect case (mount directly into a restart phase fires nothing) and the re-broadcast case (repeated broadcasts of the same restart phase fire nothing after the first).
- `EventBanner.test.tsx` gained a `restart banners (38-15 defect 4)` describe block: an `it.each(Object.entries(RESTART_BANNERS))` per-restart coverage loop (so a future fifth row is automatically tested) plus four scenario tests (no-fire-on-mount, fire-once, non-restart transition, variant/duration parity).
- `deferred-items.md` now has an explicit "From Plan 38-19 (restart banners)" entry naming why Penalty Kick can't be built yet (no `GamePhase` value exists — Phase 39 scope) and exactly what Phase 39 needs to do (`add one row to `RESTART_BANNERS``).

## Task Commits

1. **Task 1: Add the phase-keyed restart banner table and its transition effect** - `3303285` (feat)
2. **Task 2: Test the restart banners and record the Phase 39 penalty-kick follow-up** - `1574696` (test)

_Both tasks executed as pure feat/test commits — no refactor pass was needed._

## Files Created/Modified

- `packages/client/src/components/EventBanner.tsx` - Added `RESTART_BANNERS` table (4 entries: `THROW_IN_SETUP`, `GOAL_KICK_SETUP_GK`, `CORNER_KICK_CLEAR_OUT`, `FREE_KICK_SETUP`), a `phase` selector, `prevPhaseRef`, and a phase-transition `useEffect` that calls the existing `setActive({ message, variant: 'notable', duration: 1000 })` shape
- `packages/client/src/components/EventBanner.test.tsx` - New `restart banners (38-15 defect 4)` describe block: `it.each` per-restart coverage plus mount-safety, fire-once, non-restart no-op, and variant/duration tests; added a `setPhase` helper mirroring the existing `setEventLog` helper
- `.planning/phases/38-corner-kick/deferred-items.md` - New "From Plan 38-19 (restart banners)" entry recording the Phase 39 penalty-kick gap

## Decisions Made

- Phase-keyed table over event-keyed: Free Kick award emits no `ActionEvent`, so only a phase-entry mechanism covers all four restarts uniformly (see plan's Task 1 note, carried into the code comment above `RESTART_BANNERS`).
- Kept the table to exactly the four phases named in the plan — did not add `CORNER_KICK_GK_SETUP_ATTACKING` as a hedge for when 38-20 lands, per the plan's explicit "Ordering note — the corner row" instruction.
- `it.each(Object.entries(RESTART_BANNERS))` for per-restart tests, per the plan's acceptance criteria, so a future fifth (Penalty Kick) row is automatically covered without a test-file change.

## Deviations from Plan

None — plan executed exactly as written. One informational note: the plan's acceptance criterion `grep -c "useRef" ... is 2` undercounts by one because the import line (`import { useEffect, useRef, useState } from 'react';`) itself matches the `useRef` substring; actual count is 3 (import line + the pre-existing `lastProcessedLengthRef` + the new `prevPhaseRef`). This is a plan-authoring miscount, not an implementation defect — there are still exactly two `useRef()` calls, matching the plan's intent. Not treated as a deviation requiring code changes.

## Issues Encountered

- The worktree had no `node_modules` and `@counter-attack/shared` had no `dist/` build output, so the client test runner failed to resolve `@counter-attack/shared` until `pnpm install` (offline, using the existing pnpm store — no lockfile changes) and `pnpm --filter @counter-attack/shared build` were run first. This is worktree/environment setup, not a plan-scope deviation — no source files were touched to work around it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `RESTART_BANNERS` is ready for Phase 39 to extend with exactly one row (the penalty-kick entry phase) once that `GamePhase` value exists — no mechanism changes needed, and the `it.each` test loop will automatically cover it.
- `pnpm --filter @counter-attack/client test` passes (751/751, up from the pre-plan baseline); `pnpm --filter @counter-attack/client typecheck` still reports exactly the same 2 pre-existing errors documented in `deferred-items.md` (`ActionLog.tsx` return-statement gap, `GameBoard.tsx` `PHASE_LABEL` missing `CORNER_KICK_CLEAR_OUT`) — no regression introduced by this plan.
- No server or shared package file was touched; `EventBanner.module.css` is byte-identical to its pre-plan content.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_

## Self-Check: PASSED

- FOUND: packages/client/src/components/EventBanner.tsx
- FOUND: packages/client/src/components/EventBanner.test.tsx
- FOUND: .planning/phases/38-corner-kick/deferred-items.md
- FOUND: .planning/phases/38-corner-kick/38-19-SUMMARY.md
- FOUND commit: 3303285 (feat(38-19): add RESTART_BANNERS phase-entry table to EventBanner)
- FOUND commit: 1574696 (test(38-19): cover restart banners, fire-once and no-fire-on-mount rules)
- FOUND commit: 353b715 (docs(38-19): add plan summary)
