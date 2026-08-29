---
phase: 46-final-cleanup
plan: 01
subsystem: ui
tags: [react, dead-ball-consistency, hex-highlight-system, action-panel]

# Dependency graph
requires: []
provides:
  - "BALL_MARKER_PHASES (BallLocationRing.tsx) extended to 35 members, including FREE_KICK_SETUP, FREE_MOVE_ATTACK, FREE_MOVE_DEFENSE"
  - "docs/HIGHLIGHT-REFERENCE.md resynced to the real BALL_MARKER_PHASES Set (35-phase list, no stale exclusions, Phase 46 addition note)"
  - "ActionPanel.tsx FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE heading renamed to 'Final-Third Movement!'"
affects: ["46-05 (movement-tint audit depends on the corrected HIGHLIGHT-REFERENCE.md this plan produces)"]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/client/src/components/BallLocationRing.tsx
    - packages/client/src/components/BallLocationRing.test.tsx
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx
    - docs/HIGHLIGHT-REFERENCE.md

key-decisions:
  - "Confirmed FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE qualify for BALL_MARKER_PHASES: applyFreeMove (gameEngine.ts) never writes state.ball; its own emitted MOVE event carries the comment 'Ball unchanged during FREE_MOVE' — resolves 46-RESEARCH.md Open Question 1 / Assumption A2 in favour of inclusion, all three phases added"

patterns-established: []

requirements-completed: [CLEANUP-06, CLEANUP-08, CLEANUP-13]

# Metrics
duration: ~19min
completed: 2026-08-29
---

# Phase 46 Plan 01: Dead-Ball Consistency (Ball Marker Gate + Free Move Heading) Summary

**Extended `BALL_MARKER_PHASES` from 32 to 35 members (FREE_KICK_SETUP, FREE_MOVE_ATTACK, FREE_MOVE_DEFENSE), renamed the Free Move panel heading to "Final-Third Movement!", and resynced `docs/HIGHLIGHT-REFERENCE.md` to match both changes exactly.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-08-29T06:42:00-05:00 (approx, worktree base commit)
- **Completed:** 2026-08-29T07:01:00-05:00
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- The white ball-location ring now renders during `FREE_KICK_SETUP`, `FREE_MOVE_ATTACK`, and `FREE_MOVE_DEFENSE` — closing the last gap in dead-ball hex-highlight consistency across every restart-setup family (kick-off, throw-in, goal kick, corner kick, penalty kick, free kick) plus both final-third free-move phases.
- Verified the ball-stationary premise for `FREE_MOVE_*` directly against `applyFreeMove` in `gameEngine.ts` before adding it — the function only ever mutates `state.pieces`, never `state.ball`, confirmed both by reading the full function body and by its own inline comment.
- The Free Move action panel heading now reads "Final-Third Movement!" instead of the generic "Free Move!", naming the phase's actual trigger the same way every restart panel already names its own trigger by heading alone.
- `docs/HIGHLIGHT-REFERENCE.md`'s `BallLocationRing.tsx` visibility-gate section fully resynced: heading count (17 → 35), full phase-name transcription (not hand-authored — copied from the Set literal in declaration order), stale exclusion entries removed, and a new Phase 46 CLEANUP-06 addition note inserted directly after the existing `KICK_OFF_SETUP` addition note, in that note's voice.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the three dead-ball repositioning phases to BALL_MARKER_PHASES and resync the highlight doc** - `4ba0b82e` (feat)
2. **Task 2: Rename the Free Move panel heading to name its final-third trigger** - `214454be` (feat)
3. **Fix: avoid double-counting the "Final-Third Movement!" literal in ActionPanel.tsx** - `97a57979` (fix, self-correction against Task 2's own acceptance criteria)

## Files Created/Modified

- `packages/client/src/components/BallLocationRing.tsx` - Added `FREE_KICK_SETUP`, `FREE_MOVE_ATTACK`, `FREE_MOVE_DEFENSE` to `BALL_MARKER_PHASES` with a Phase 46 / CLEANUP-06 comment block; no new color literal, stroke width, or exported symbol
- `packages/client/src/components/BallLocationRing.test.tsx` - Updated the `BALL_MARKER_PHASES.size` assertion from 32 to 35; added 3 new per-phase render assertions (`FREE_KICK_SETUP`, `FREE_MOVE_ATTACK`, `FREE_MOVE_DEFENSE`)
- `packages/client/src/components/ActionPanel.tsx` - Changed the `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` `helperLine1` from `"Free Move!"` to `"Final-Third Movement!"`; extended (not replaced) the existing checkpoint 45-05-04 in-branch comment with the Phase 46 / CLEANUP-08 rationale; `helperLine2` and `ActionPanel.module.css` untouched
- `packages/client/src/components/ActionPanel.test.tsx` - Updated the two `Free Move!` text assertions (active-player attacking-team and defending-team tests) to `Final-Third Movement!`
- `docs/HIGHLIGHT-REFERENCE.md` - Updated the `BallLocationRing.tsx` gate section: heading now states 35 phases, the full phase list is transcribed from the Set literal, the "does not render during…" exclusion list no longer lists `FREE_KICK_SETUP`/`FREE_MOVE_*`, and a new Phase 46 CLEANUP-06 addition note was inserted after the `KICK_OFF_SETUP` addition note

## Decisions Made

- Confirmed via direct read of `applyFreeMove` (packages/server/src/gameEngine.ts:654-750) that the ball position is provably unchanged throughout `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` — the function's return object only ever spreads `pieces`, `eventLog`, `freeMoveUsedPace`, and `movedPieceIds`; `ball` is never touched, and the emitted `MOVE` event's own comment states "Ball unchanged during FREE_MOVE." This resolved 46-RESEARCH.md Open Question 1 in favor of including all three phases (`FREE_KICK_SETUP` + both `FREE_MOVE_*`) rather than just `FREE_KICK_SETUP` alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed acceptance-criteria violation: `Final-Third Movement!` literal appeared twice in ActionPanel.tsx**
- **Found during:** Task 2, post-commit acceptance-criteria verification (`grep -c "Final-Third Movement!" packages/client/src/components/ActionPanel.tsx` was expected to return exactly 1)
- **Issue:** The extended in-branch comment (documenting the Phase 46 rename rationale) quoted the new string literal in full, causing the grep count to return 2 instead of 1 — violating the plan's explicit acceptance criterion.
- **Fix:** Reworded the comment to reference "the actual trigger... per 46-UI-SPEC.md's Copywriting Contract" without repeating the exact string, leaving only the JSX text node as the sole occurrence.
- **Files modified:** packages/client/src/components/ActionPanel.tsx
- **Verification:** `grep -c "Final-Third Movement!" packages/client/src/components/ActionPanel.tsx` now returns 1; `pnpm --filter @counter-attack/client test -- ActionPanel` still passes (87/87)
- **Committed in:** `97a57979`

---

**Total deviations:** 1 auto-fixed (1 bug — self-caught acceptance-criteria violation)
**Impact on plan:** No scope creep; a pure self-correction against the plan's own stated acceptance criteria before task completion.

## Issues Encountered

- The worktree had no `node_modules` and no built `packages/shared/dist` on first use — ran `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` before tests would resolve `@counter-attack/shared`. Standard worktree setup, not a deviation from plan scope.
- The Husky `pre-commit` → `lint-staged` hook was intermittently slow on this Windows environment (one `git stash create` step took several seconds under contention), causing two `git commit` invocations to exceed their tool-level timeout before completing. No commit was left in a partial state in either case — verified via `git log` and `git status` after each timeout that the file remained correctly staged with no stray uncommitted changes, then retried the commit successfully. No `git stash` command was run manually by this agent; only `lint-staged`'s own internal, sanctioned backup-stash mechanism was involved, and it was inspected (not manipulated) via `git stash list`/`git status`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs/HIGHLIGHT-REFERENCE.md`'s `BallLocationRing.tsx` gate section is now the accurate, resynced source that Plan 46-05's movement-tint audit depends on.
- `BALL_MARKER_PHASES.size === 35` is the final member count for any future plan needing to cite it.
- No blockers for subsequent Phase 46 plans.

---
*Phase: 46-final-cleanup*
*Completed: 2026-08-29*
