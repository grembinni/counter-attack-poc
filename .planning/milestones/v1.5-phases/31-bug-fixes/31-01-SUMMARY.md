---
phase: 31-bug-fixes
plan: 01
subsystem: replay
tags: [replay-reconstruction, gameEngine, ActionEvent, buildReplayFrames, gk-kick, half-time]

# Dependency graph
requires:
  - phase: 8-match-lifecycle-post-game-replay
    provides: buildReplayFrames, REPLAY_ELIGIBLE_TYPES, universal ballAfter-apply pattern
provides:
  - 'GOAL ActionEvent carrying an optional piecesAfter: PlayerPiece[] field, populated at both gameEngine.ts GOAL construction sites'
  - 'New HALF_TIME_KICKOFF_RESET ActionEvent (piecesAfter + ballAfter) closing a previously-undiscovered second-half kickoff replay gap (D-02)'
  - 'buildReplayFrames applies piecesAfter for both GOAL and HALF_TIME_KICKOFF_RESET, mirroring the existing universal ballAfter pattern'
  - 'Regression coverage confirming GK_KICK/LOOSE_BALL_LAND replay visibility (folded todo) is already correct in current code — no source change needed'
affects: [31-02-bug-fixes, 31-03-bug-fixes, 31-04-bug-fixes, replay-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'piecesAfter-on-event + universal-apply-in-buildReplayFrames — same shape convention as the existing ballAfter pattern, used for full-board-reset events (GOAL, HALF_TIME_KICKOFF_RESET)'

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/replay.integration.test.ts
    - packages/client/src/components/ActionLog.tsx

key-decisions:
  - 'piecesAfter on GOAL is OPTIONAL (not required) so the 3 pre-existing GK-out-of-range auto-GOAL construction sites in gameHandlers.ts (owned by Plan 03 in this wave) remain valid without modification — avoids cross-plan file conflicts in a parallel wave'
  - "D-02 second-half kickoff reset had NO ActionEvent at all in current code (contradicting PATTERNS.md's tentative 'likely already is [fine]' guess) — added a new HALF_TIME_KICKOFF_RESET event type to close the gap, since Test B empirically proved buildReplayFrames produced ZERO frames for this transition"
  - "GK_KICK/LOOSE_BALL_LAND folded todo re-diagnosed per 31-PATTERNS.md's explicit warning — the todo's stated root cause (missing ballAfter / missing REPLAY_ELIGIBLE_TYPES entry) does not match current code; both already exist. Added one missing regression case (inaccurate GK_KICK branch) and confirmed no source change needed."

patterns-established:
  - "Full-board-reset events (as opposed to ball-only events) carry piecesAfter and are applied via an explicit event.type branch in buildReplayFrames, not the universal 'ballAfter' in event check, since piecesAfter is not shared by every event type"

requirements-completed: [BUG-30]

# Metrics
duration: 5min
completed: 2026-07-22
---

# Phase 31 Plan 01: Replay Piece Reconstruction (BUG-30) Summary

**Added `piecesAfter` to the GOAL ActionEvent (both gameEngine.ts construction sites) plus a brand-new `HALF_TIME_KICKOFF_RESET` event for the previously-unrecorded second-half formation reset, both applied in `buildReplayFrames`; confirmed the folded GK_KICK/LOOSE_BALL_LAND replay todo was already resolved in current code.**

## Performance

- **Duration:** ~5 min (3 commits, 12:53–12:58)
- **Started:** 2026-07-22T12:53:00-05:00
- **Completed:** 2026-07-22T12:58:17-05:00
- **Tasks:** 3
- **Files modified:** 4 (types.ts, gameEngine.ts, ActionLog.tsx, replay.integration.test.ts)

## Accomplishments

- BUG-30 closed: replaying a scored goal now reconstructs every player at the new kickoff formation, proven by a regression test that drives a real GOAL through `applyRoll`'s shot-duel branch (not a hand-crafted eventLog).
- D-02 (second-half kickoff) — **discovered it was NOT already correct** (contrary to the phase's PATTERNS.md tentative guess): `applyHalfTimeStart` recorded no ActionEvent at all for the formation reset, so `buildReplayFrames` produced zero frames for that transition. Fixed with a new `HALF_TIME_KICKOFF_RESET` event, same shape convention as GOAL's `piecesAfter`.
- Folded GK_KICK/LOOSE_BALL_LAND todo — re-diagnosed per the phase's explicit warning that the todo's premise was stale; confirmed both are already correct in current code (added the one missing inaccurate-GK_KICK regression case for full coverage).

## Task Commits

1. **Task 1: Write failing replay regression tests for goal-reset (BUG-30) and second-half kickoff (D-02)** - `013dd0e` (test) — RED confirmed for both: goal-reset test failed with a stale-position mismatch; second-half kickoff test failed with `frames.length === 0`.
2. **Task 2: Add piecesAfter to GOAL event, populate both construction sites, apply in buildReplayFrames (D-01)** - `6aa941c` (fix) — also includes the D-02 `HALF_TIME_KICKOFF_RESET` fix and the required `ActionLog.tsx` exhaustive-switch case (deviation, see below).
3. **Task 3: Verify (then fix only if broken) GK_KICK and LOOSE_BALL_LAND replay visibility** - `11d9b43` (test) — added the missing inaccurate-branch case; no source change needed.

**Plan metadata:** (this commit, docs) — created after this SUMMARY.

## Files Created/Modified

- `packages/shared/src/types.ts` - Added optional `piecesAfter?: PlayerPiece[]` to the `GOAL` `ActionEvent` variant; added a new `HALF_TIME_KICKOFF_RESET` variant (`piecesAfter`, `ballAfter`, `timestamp`).
- `packages/server/src/gameEngine.ts` - Both GOAL construction sites (unsaveable-shot ~2124, shot-duel-goal ~2216) hoist a single `resetPieces` const feeding both `state.pieces` and the event's `piecesAfter`. `applyHalfTimeStart` now emits a `HALF_TIME_KICKOFF_RESET` event. `buildReplayFrames`: `REPLAY_ELIGIBLE_TYPES` gains `HALF_TIME_KICKOFF_RESET`; the GOAL branch applies `event.piecesAfter` when present; a new branch applies it unconditionally for `HALF_TIME_KICKOFF_RESET`.
- `packages/client/src/components/ActionLog.tsx` - Added a `HALF_TIME_KICKOFF_RESET` case to the exhaustive `formatEvent` switch (required by the new discriminated-union member; minimal `[KICK OFF]`-style display, mirrors the existing `KICK_OFF_SETUP` treatment).
- `packages/server/src/__tests__/replay.integration.test.ts` - Added 3 tests: goal-reset all-pieces reconstruction (BUG-30), second-half kickoff all-pieces reconstruction (D-02), and an inaccurate-GK_KICK loose-ball regression case (folded todo completeness).

## Decisions Made

- **piecesAfter is optional, not required.** During implementation I discovered 3 additional GOAL construction sites in `packages/server/src/gameHandlers.ts` (GK-out-of-range auto-GOAL branches in SNAPSHOT_DEFLECT, regular shot, and header-at-goal flows) that the plan's PATTERNS.md did not identify. `gameHandlers.ts` is explicitly flagged as owned by Plan 03 in this same parallel wave. Making the field optional lets `buildReplayFrames` apply the reconstruction wherever it's populated (both `gameEngine.ts` sites) without forcing changes to a file owned by a sibling plan, and without breaking existing test/mock fixtures across the client package that construct `GOAL` literals (`mockGKRestartState.ts`, `ActionLog.test.tsx`, `EventBanner.test.tsx`, `gameEngine.phase8.test.ts`) — all remain valid unmodified.
- **D-02 required a real source fix, not just a test.** Empirically, `buildReplayFrames(result.state)` returned an empty frames array for a state produced by `applyHalfTimeStart` alone — there was no ActionEvent marking the transition at all, so the gap was strictly worse than BUG-30 (no frame, not just stale positions). Added `HALF_TIME_KICKOFF_RESET` following the identical `piecesAfter`/universal-apply-in-buildReplayFrames pattern as the GOAL fix.
- **Task 3 required no source change.** Confirmed via re-diagnosis (per 31-PATTERNS.md's explicit instruction not to trust the folded todo's stale premise) that `GK_KICK`/`LOOSE_BALL_LAND` already carry `ballAfter` and are already in `REPLAY_ELIGIBLE_TYPES`, with `gameHandlers.ts:832` already resolving `carrierId` correctly for both accurate and inaccurate branches. Added the one missing inaccurate-branch regression test; `git diff` confirms `gameHandlers.ts` untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added HALF_TIME_KICKOFF_RESET event to fix the second-half kickoff replay gap (D-02)**

- **Found during:** Task 1 (writing the D-02 regression test)
- **Issue:** `applyHalfTimeStart` (the HALF_TIME → KICK_OFF_SETUP second-half formation reset) recorded no ActionEvent at all, so `buildReplayFrames` produced zero frames for that transition — the reset was completely invisible in replay, worse than BUG-30's "stale positions" symptom. This directly violates the plan's must-have truth: "The second-half kickoff reset ... reconstructs correctly in replay, or a regression test proves it was already correct (D-02)." PATTERNS.md's tentative guess that this path was "likely already fine" did not hold empirically.
- **Fix:** Added a new `HALF_TIME_KICKOFF_RESET` `ActionEvent` variant (piecesAfter + ballAfter) emitted by `applyHalfTimeStart`, registered in `REPLAY_ELIGIBLE_TYPES`, and applied in `buildReplayFrames` the same way as GOAL's `piecesAfter`.
- **Files modified:** `packages/shared/src/types.ts`, `packages/server/src/gameEngine.ts`
- **Verification:** D-02 test went from RED (`frames.length === 0`) to GREEN (all 22 pieces match the new formation).
- **Committed in:** `6aa941c` (Task 2 commit)

**2. [Rule 3 - Blocking] Added HALF_TIME_KICKOFF_RESET case to ActionLog.tsx's exhaustive switch**

- **Found during:** Task 2, client typecheck
- **Issue:** Adding a new `ActionEvent` union member broke `formatEvent`'s exhaustive switch in `ActionLog.tsx` (TS2366: function lacks ending return statement) since the switch has no default case.
- **Fix:** Added a minimal display case mirroring the existing `KICK_OFF_SETUP` treatment (formation-reset events get a `[KICK OFF]`-prefixed line, no per-piece detail).
- **Files modified:** `packages/client/src/components/ActionLog.tsx`
- **Verification:** `pnpm --filter @counter-attack/client typecheck` and full client test suite (371 tests) pass.
- **Committed in:** `6aa941c` (Task 2 commit)

**3. [Rule 4 → resolved via Rule 2, not architectural] piecesAfter made optional instead of required, due to 3 undiscovered GOAL construction sites in gameHandlers.ts**

- **Found during:** Task 2 planning (before implementation)
- **Issue:** The plan's PATTERNS.md and frontmatter only identified 2 GOAL construction sites (both in `gameEngine.ts`). Grep revealed 3 more in `packages/server/src/gameHandlers.ts` (GK-out-of-range auto-GOAL in SNAPSHOT_DEFLECT ~line 1008, regular shot ~line 1652, header-at-goal ~line 2433). Making `piecesAfter` a required field would force either touching `gameHandlers.ts` (owned by Plan 03 in this same wave, risking cross-plan merge conflicts) or leaving the build broken.
- **Fix:** Made `piecesAfter` optional on the `GOAL` variant; `buildReplayFrames` only applies it when present. The 2 `gameEngine.ts` sites (this plan's actual scope) populate it; the 3 `gameHandlers.ts` sites are unchanged and untouched.
- **Files modified:** `packages/shared/src/types.ts` (field made optional, not a new deviation touching gameHandlers.ts)
- **Verification:** `pnpm --filter @counter-attack/server typecheck` passes; `git diff` confirms zero changes to `gameHandlers.ts`.
- **Committed in:** `6aa941c` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 missing-critical/Rule 2, 1 blocking/Rule 3)
**Impact on plan:** All auto-fixes were necessary for correctness (D-02) or to unblock the build (ActionLog exhaustive switch, optional-field scope containment). No unrelated scope creep — `gameHandlers.ts` was deliberately left untouched to respect Plan 03's ownership in this parallel wave.

## Known Follow-up Gap (not fixed in this plan)

The 3 GK-out-of-range auto-GOAL construction sites in `packages/server/src/gameHandlers.ts` (SNAPSHOT_DEFLECT ~line 1008-1038, regular shot ~line 1652-1682, header-at-goal ~line 2433-2462) still do **not** populate `piecesAfter` on their `GOAL` events. These are a narrower, less common path (GK too far to reach any hex on the shot's path — an automatic uncontested goal, no duel) than the two `gameEngine.ts` sites fixed in this plan, but they share the exact same underlying defect: replaying one of these goals would still show stale pre-goal piece positions. Recommended as a fast-follow using the identical `resetPieces`-hoist pattern established here. Flagged for awareness of Plan 03 (which also touches `gameHandlers.ts` in this wave) and for a future bug-fix pass.

## Issues Encountered

- **Worktree had no `node_modules`.** Ran `pnpm install` (not a Windows junction workaround — per project memory's documented risk with junction-based node_modules sharing) to get a clean, independently-installed `node_modules` in the worktree before running any tests.
- **Test file needed to drive real engine paths, not hand-crafted eventLogs**, per the plan's `<action>` instructions. Reused `setupFullTimeRoom()`'s real city/crew roster and team selection, then overrode `phase`/`shotTargetHex`/relevant piece stats to deterministically force a GOAL via `applyRoll`'s shot-duel branch — no dice mocking needed since `applyRoll` takes injected dice values directly (already deterministic).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-30 is closed with regression coverage; D-02 is closed with regression coverage (a genuine gap was found and fixed, not just verified).
- The folded GK_KICK/LOOSE_BALL_LAND todo is confirmed resolved with full regression coverage (accurate + inaccurate branches, plus the pre-existing LOOSE_BALL_LAND case).
- Flagged follow-up: `gameHandlers.ts`'s 3 GK-out-of-range auto-GOAL sites still lack `piecesAfter` (see "Known Follow-up Gap" above) — worth a fast-follow bug-fix task, potentially by whichever plan next touches `gameHandlers.ts`'s GOAL branches.
- No blockers for Plans 02/03/04 in this wave; `gameHandlers.ts` was deliberately left untouched by this plan.

## Self-Check: PASSED

- FOUND: packages/shared/src/types.ts
- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/client/src/components/ActionLog.tsx
- FOUND: packages/server/src/**tests**/replay.integration.test.ts
- FOUND: .planning/phases/31-bug-fixes/31-01-SUMMARY.md
- FOUND commit: 013dd0e (test)
- FOUND commit: 6aa941c (fix)
- FOUND commit: 11d9b43 (test)

---

_Phase: 31-bug-fixes_
_Completed: 2026-07-22_
