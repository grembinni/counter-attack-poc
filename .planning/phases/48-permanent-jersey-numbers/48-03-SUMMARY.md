---
phase: 48-permanent-jersey-numbers
plan: 03
subsystem: ui
tags: [react, jersey-numbers, roster, bench-carousel]

# Dependency graph
requires:
  - phase: 47-select-based-roster-interaction
    provides: the current click-to-select LineupAssignmentScreen.tsx production port this plan edits
provides:
  - Standard-mode pregame (Step 3) bench no longer fabricates a client-side jersey number from PoolPlayer.number
  - Regression test locking the pregame bench to zero #n jersey-number markup while still rendering all five placeholder players by name
affects: [48-02 (server-side random bench-number draw at LINEUP_CONFIRM), 48-05 (draft-mode bench number sync)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BenchCarousel's benchNumbers prop is optional and already renders nothing when omitted — the correct fix for 'number not assigned yet' is omitting the prop, not fabricating a placeholder value"

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "Deleted the pregameBenchNumbers map and its BenchCarousel prop entirely rather than passing an empty/undefined map explicitly — matches the pattern the draft-mode bench already uses before draftComplete"

patterns-established: []

requirements-completed: [NUMBER-01]

# Metrics
duration: ~20min
completed: 2026-08-31
---

# Phase 48 Plan 03: Remove Fabricated Pregame Bench Numbers Summary

**Deleted the client-side `pregameBenchNumbers` map and its `BenchCarousel` prop in `LineupAssignmentScreen.tsx` so the standard-mode Step 3 bench renders zero jersey numbers, matching the fact that no permanent number exists until the server's `LINEUP_CONFIRM` draw.**

## Performance

- **Duration:** ~20 min (includes a one-time `pnpm install` + `@counter-attack/shared` build in this worktree, since neither existed yet)
- **Started:** 2026-08-31T16:22:00Z (approx)
- **Completed:** 2026-08-31T16:33:41Z
- **Tasks:** 1/1 completed
- **Files modified:** 2

## Accomplishments
- Removed the only client site that fabricated a jersey number from `PoolPlayer.number` instead of rendering a server-supplied one (closes threat T-48-06)
- Added a 4-assertion regression test (`NUMBER-01`) proving the pregame bench renders 5 named cards with 0 `#n` markup, while the 11 starting-XI slot-derived numbers are untouched
- Verified the two correct bench-number paths (mid-match `midmatchBenchNumbers`, draft `draftView.benchNumbers`) were left untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the fabricated pregame bench numbers and lock the behavior with a test** - `d90305d0` (fix)

**Plan metadata:** (this commit, added after self-check)

## Files Created/Modified
- `packages/client/src/components/LineupAssignmentScreen.tsx` - Deleted the `pregameBenchNumbers` map (2 lines) and the `benchNumbers={pregameBenchNumbers}` prop on the pregame `BenchCarousel`; added an explanatory comment recording why (Phase 48 D-02/D-04/D-05)
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` - Added `getGenericBenchPlayers` import and a new `NUMBER-01` test inside the existing `ROSTER-07: Standard pregame click-to-swap` describe block

## Decisions Made
- Omitted the `benchNumbers` prop entirely (rather than passing `undefined` explicitly) since `BenchCarousel`'s prop is already optional and this mirrors the existing pre-`draftComplete` draft-mode bench pattern — no new visual idiom introduced.

## Deviations from Plan

None - plan executed exactly as written. The plan's `<action>` block specified deleting exactly these two source locations and adding exactly this one test; both were done verbatim, including the acceptance-criteria grep checks.

## Issues Encountered

The worktree had no `node_modules` and no built `packages/shared/dist` (this worktree had never had `pnpm install`/`build` run in it). Ran `pnpm install --frozen-lockfile` (safe, real install — not a node_modules junction into the main repo, per the project's known Windows worktree-junction risk) followed by `pnpm --filter @counter-attack/shared build` to unblock Vitest's module resolution. This is environment setup, not a plan deviation — no plan files or scope were affected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- NUMBER-01 fully satisfied: no jersey number is ever shown for a standard-mode bench player before their permanent number is assigned at `LINEUP_CONFIRM`.
- Client suite green: `LineupAssignmentScreen.test.tsx` 113/113 tests pass; full client suite 1293/1293 tests pass across 40 files; `tsc --noEmit` clean.
- No blockers for downstream plans (48-02's server-side draw, 48-05's draft-mode bench sync) — this plan touched only the pregame client render path and did not alter server or draft-mode code.

---
*Phase: 48-permanent-jersey-numbers*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: packages/client/src/components/LineupAssignmentScreen.tsx
- FOUND: .planning/phases/48-permanent-jersey-numbers/48-03-SUMMARY.md
- FOUND: d90305d0 (Task 1 commit)
- FOUND: ca5544ec (SUMMARY.md commit)
