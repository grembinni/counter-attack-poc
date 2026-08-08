---
phase: 38-corner-kick
plan: 12
subsystem: game-engine
tags: [replay, corner-kick, gameEngine, vitest]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 10)
    provides: Undo fixes for CORNER_KICK_FINAL_SETUP/CORNER_KICK_REPOSITION (CR-01/CR-02) and the 38-REVIEW.md gap-closure backlog (WR-01/WR-02)
provides:
  - buildReplayFrames piece-position tracking for CORNER_KICK_GK_PLACE and CORNER_KICK_MOVE (WR-01 closed)
  - applyCornerKickReposition's per-stage distinct-piece cap sourced from CORNER_KICK_STAGES instead of a hardcoded literal (WR-02 closed)
  - A confirmed, documented finding that GOAL_KICK_MOVE has the identical WR-01 defect class and is not yet fixed
affects: [phase-38-corner-kick, future-goal-kick-replay-fix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Replay-frame position tracking for phase-transition-adjacent piece moves that carry no ballAfter: mutate current.pieces directly inside the event-processing loop's board-mutation branch (like GOAL/HALF_TIME_KICKOFF_RESET/KICK_OFF) rather than accumulating into moveGroup, when the event type is NOT in REPLAY_ELIGIBLE_TYPES — moveGroup's flush unconditionally emits a frame per accumulated step regardless of eligibility, so routing a non-eligible event through it produces an unwanted frame."

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts

key-decisions:
  - "Deviated from 38-REVIEW.md's literal WR-01 code suggestion (moveGroup accumulation, copying the KICK_OFF_SETUP arm's shape) in favor of a direct current.pieces mutation for CORNER_KICK_GK_PLACE/CORNER_KICK_MOVE, because the literal suggestion would have made flushMoveGroup emit a frame for these non-REPLAY_ELIGIBLE_TYPES events (breaking the plan's own 'emits no frame of its own' requirement and regressing a pre-existing passing test)."
  - "Test fixture ids for CORNER_KICK_GK_PLACE/CORNER_KICK_MOVE use real reconstructed piece ids ('away-0', 'away-9') rather than the file's local awayGK/awayPiece fixtures, because buildReplayFrames seeds current.pieces from buildKickOffPieces (squad/formation), not from finalState.pieces."

requirements-completed: [CORNER-01, CORNER-03, CORNER-06]

# Metrics
duration: ~45min
completed: 2026-08-08
---

# Phase 38 Plan 12: WR-01/WR-02 Gap Closure Summary

**Post-match replay now carries corner-kick GK placements and pre-kick repositions to their real hexes, and the engine's per-stage distinct-piece cap reads `CORNER_KICK_STAGES` instead of a hardcoded `2`.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Closed WR-01: `buildReplayFrames` now updates the reconstructed piece list for `CORNER_KICK_GK_PLACE` and `CORNER_KICK_MOVE` events, so a goalkeeper who repositioned for a corner (either GK reposition window) or a player who moved during `CORNER_KICK_FINAL_SETUP` no longer teleports back to a stale hex for the rest of the replay stream.
- Closed WR-02: `applyCornerKickReposition`'s per-stage cap is now read from `CORNER_KICK_STAGES[state.cornerKickStageIndex].max`, matching `CornerKickSetupPanel.tsx` and `useGameStore.ts` — editing `CORNER_KICK_STAGES` now changes the server-enforced cap for that stage.
- Confirmed neither `CORNER_KICK_GK_PLACE` nor `CORNER_KICK_MOVE` was added to `REPLAY_ELIGIBLE_TYPES` (exclusion remains correct/unchanged) and added 4 new regression tests plus 1 stage-cap single-source-of-truth test (128 total tests in the file, up from 123).
- Full server suite green (987 passed, 1 skipped, 1 todo — all pre-existing) and `typecheck` clean.

## Task Commits

1. **Task 1: WR-01 — track CORNER_KICK_GK_PLACE and CORNER_KICK_MOVE piece positions in buildReplayFrames** - `1d20a4a` (fix)
2. **Task 2: WR-02 — read the per-stage distinct-piece cap from CORNER_KICK_STAGES** - `eb7c27c` (fix)

_No separate plan-metadata commit — SUMMARY.md is committed directly per worktree-mode instructions._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — `buildReplayFrames` gained a `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE` branch that mutates `current.pieces` directly (no frame, ball untouched); `REPLAY_ELIGIBLE_TYPES` comment updated to document the new tracking; `applyCornerKickReposition` now imports `CORNER_KICK_STAGES` and reads `stageMax` from it instead of a literal `2`.
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` — 4 new `buildReplayFrames` tests (position carried forward for GK_PLACE, position carried forward for MOVE, no frame of its own, ball unaffected) and 1 new `applyCornerKickReposition` test deriving its expected cap from `CORNER_KICK_STAGES` rather than a literal.

## Decisions Made

- **Direct `current.pieces` mutation instead of `moveGroup` accumulation for WR-01.** 38-REVIEW.md's suggested fix (and the plan's `<action>` text) said to copy the `KICK_OFF_SETUP` arm's exact shape — accumulate into `moveGroup` and `continue`. Tracing `flushMoveGroup()`'s behavior showed this would be incorrect: `flushMoveGroup()` unconditionally emits a frame for every pending step in `moveGroup` regardless of whether the originating event type is in `REPLAY_ELIGIBLE_TYPES` (the four existing accumulating arms — `MOVE`, `KICK_OFF_SETUP`, `THROW_IN_PLACE`, `CORNER_KICK_TAKER_PLACED` — all happen to be REPLAY_ELIGIBLE_TYPES members, so this was never previously exposed). Since `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE` are deliberately NOT eligible, routing them through `moveGroup` would (a) give them a frame of their own whenever the group later flushes, violating the plan's explicit behavior requirement, and (b) break the pre-existing passing test asserting that a log of only `CORNER_KICK_STAGE_ADVANCE`/`CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE` produces zero frames (the trailing `flushMoveGroup()` call at the end of `buildReplayFrames` would flush the pending group and produce 1 frame). Verified this by tracing both scenarios before writing code. Fixed by mutating `current.pieces` directly in a `continue`-based branch placed before the generic `flushMoveGroup()` call (so an in-progress `moveGroup` is never prematurely flushed), matching the `GOAL/HALF_TIME_KICKOFF_RESET/KICK_OFF` board-mutation pattern instead. This is a Rule 1 (bug) auto-fix of the plan's own literal action text — the plan's testable `<behavior>`/`<acceptance_criteria>` contract is authoritative over its illustrative code snippet, and applying it literally would have broken both the new acceptance criteria and an existing test.
- **Test fixture piece ids corrected to reconstructed squad ids.** The plan's `read_first` pointed at the existing `buildReplayFrames — corner-kick replay eligibility` describe block for fixture style, which uses `baseLooseBallState` with a `pieces: [homePiece, awayPiece, homeGK, awayGK]` field — but `buildReplayFrames` never reads `finalState.pieces`; it reconstructs `current.pieces` from `buildKickOffPieces(finalState.kickOffTeam, finalState.selectedTeams, finalState.selectedFormation)`, which produces ids `home-0..home-10`/`away-0..away-10`. The existing `CORNER_KICK_TAKER_PLACED` test happens to use `awayPiece.id` ('away-9'), which coincidentally matches a real reconstructed id (FWD slot index 9 in 4-4-2); `awayGK.id` ('away-gk') does not match any reconstructed id. First test run surfaced this (`gk` was `undefined`). Fixed by using the real reconstructed id `'away-0'` (the GK formation slot, per `FORMATIONS['4-4-2'].away.slots[0]`) for the GK_PLACE test's `pieceId`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WR-01 fix implemented via direct `current.pieces` mutation, not the plan's literal moveGroup-accumulation code**

- **Found during:** Task 1 (WR-01 implementation), before running any tests — caught by manually tracing `flushMoveGroup()`'s unconditional per-step frame emission against the plan's own "emits no frame of its own" requirement and the pre-existing zero-frames test.
- **Issue:** The plan's `<action>` text (and 38-REVIEW.md's suggested diff, which it quotes near-verbatim) instructs accumulating `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE` into `moveGroup` exactly like `KICK_OFF_SETUP`. `flushMoveGroup()` always pushes at least one frame for any non-empty `moveGroup`, regardless of the originating event's `REPLAY_ELIGIBLE_TYPES` membership — the four existing accumulating arms happen to all be REPLAY_ELIGIBLE_TYPES members, so this always-frame behavior was never previously in tension with an event type that's deliberately excluded from producing frames. Following the plan literally would give `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE` a frame of their own whenever the accumulated group later flushes, contradicting the plan's explicit `<behavior>` bullet ("Neither event type adds a frame to the returned array") and its acceptance criterion ("A test asserts adding a CORNER_KICK_GK_PLACE event does not increase the emitted frame count") — and would have regressed the pre-existing test `'CORNER_KICK_STAGE_ADVANCE, CORNER_KICK_GK_PLACE and CORNER_KICK_MOVE are NOT replay-eligible (no ballAfter) — no frame produced for a log containing only these'` (frames would go from 0 to 1 via the trailing `flushMoveGroup()` call).
- **Fix:** Implemented the position update by mutating `current.pieces` directly (same technique as the existing `GOAL`/`HALF_TIME_KICKOFF_RESET`/`KICK_OFF` board-mutation branches) inside a `continue`-based arm placed before the generic `flushMoveGroup()` call, so no frame is ever pushed for these events and any in-progress `moveGroup` is never prematurely flushed — satisfying every `<behavior>` bullet and the plan's own zero-frame acceptance criteria while still carrying the corrected position into all later frames.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** All 4 new WR-01 tests pass; the pre-existing zero-frames test (unmodified) still passes; full `gameEngine.cornerKick.test.ts` (124 tests before this task's tests, now includes them) and the `replay.integration.test.ts` suite (16 tests) both green.
- **Committed in:** `1d20a4a` (Task 1 commit)

**2. [Rule 1 - Bug] Test fixture pieceIds corrected from local fixture ids to real reconstructed squad ids**

- **Found during:** Task 1, first test run — `expect(gk?.position).toEqual(gkPlaceTo)` failed with `expected undefined to deeply equal {...}` because `awayGK.id` ('away-gk') does not exist in `buildReplayFrames`'s internally-reconstructed piece list.
- **Issue:** `buildReplayFrames` seeds `current.pieces` from `buildKickOffPieces`, not from `finalState.pieces` — the plan's `read_first` pointer to the existing describe block's fixture style didn't surface this because the one existing test that checks a moved piece (`CORNER_KICK_TAKER_PLACED`) happens to use `awayPiece.id`, which coincidentally matches a real generated id.
- **Fix:** Used the real reconstructed id `'away-0'` (away team's GK formation slot) for the new GK_PLACE tests' `pieceId`, with a comment explaining why.
- **Files modified:** `packages/server/src/__tests__/gameEngine.cornerKick.test.ts`
- **Verification:** All 4 new tests pass with the corrected ids.
- **Committed in:** `1d20a4a` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug fixes to the plan's own illustrative code/test fixtures, discovered before either landed in a commit). No scope creep — both fixes were required to make the plan's own stated behavior contract actually hold.
**Impact on plan:** WR-01 and WR-02 are both closed with the plan's full acceptance-criteria set satisfied; net code shape differs slightly from the plan's literal suggested diff but is functionally equivalent to (and more correct than) what was specified.

## Issues Encountered

- Worktree had no `node_modules` (fresh worktree checkout). Per the "Worktree Junction Risk" project memory, did NOT use directory-junction workarounds. Instead ran `CI=true pnpm install --frozen-lockfile` in the worktree, which populates `node_modules` from the shared, already-populated pnpm content-addressable store with zero risk to the main repo's checkout (pnpm's store is global and immutable per-package-version; this does not touch or delete anything outside the worktree). Also ran `pnpm --filter @counter-attack/shared build` once to produce `dist/` so `@counter-attack/shared` resolves for the server test runner.

## Next Phase Readiness

- WR-01 and WR-02 (the last two open items from 38-REVIEW.md) are closed. Combined with 38-10 (CR-01/CR-02 Undo fixes) and 38-11 (if applicable), the corner-kick review backlog is fully addressed as of this plan.
- **Follow-up finding (per this plan's `<output>` instruction):** `GOAL_KICK_MOVE` (the goal-kick analog of `CORNER_KICK_MOVE`, emitted by the `gameHandlers.ts` `GAME_MOVE` branch during the `GOAL_KICK_MOVE` phase, `packages/server/src/gameHandlers.ts:593-600`) has the **identical WR-01 defect class**: it carries `pieceId`/`to` with no `ballAfter`, and in `buildReplayFrames` it sits in the top-of-loop skip list (`packages/server/src/gameEngine.ts` ~line 6879, alongside `GOAL_KICK_WINDOW_ADVANCE`/`GOAL_KICK_CHOICE`) with **zero position tracking** — worse than the pre-fix `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE` state, since it isn't even excluded-with-a-documented-comment the way those were; it's silently dropped. A player who repositions during the goal-kick travel window (`GOAL_KICK_MOVE` phase, GOALKICK-05) will show a stale position in every subsequent replay frame. This is out of scope for 38-12 (a Phase 38/corner-kick plan) but is the same defect class and should be picked up as a small follow-up fix in a Phase 37 (goal-kick) or cross-cutting gap-closure plan — the fix shape is identical to this plan's Task 1 (a `current.pieces`-mutating branch, not `REPLAY_ELIGIBLE_TYPES` membership, not `moveGroup` accumulation). `GOAL_KICK_WINDOW_ADVANCE` and `GOAL_KICK_CHOICE` were also checked and are correctly excluded — neither carries piece position data, so no fix is needed for them. The `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` reposition windows were also checked (`applyGoalKickReposition`) and are unaffected — they already emit a plain `MOVE` event with `ballAfter` set to the unchanged ball, which is fully tracked via the existing `MOVE` accumulation arm.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_

## Self-Check: PASSED

- FOUND: `.planning/phases/38-corner-kick/38-12-SUMMARY.md`
- FOUND: commit `1d20a4a` (Task 1)
- FOUND: commit `eb7c27c` (Task 2)
