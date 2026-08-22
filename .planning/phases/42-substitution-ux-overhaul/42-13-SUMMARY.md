---
phase: 42-substitution-ux-overhaul
plan: 13
subsystem: game-engine
tags: [free-kick, offside, hex-grid, socket.io, vitest, gap-closure]

# Dependency graph
requires:
  - phase: 42-substitution-ux-overhaul
    provides: 42-10-SUMMARY.md's live two-browser playtest, which surfaced gap item 7 (defensive wall distance dead-end) as an out-of-phase-scope defect carried into this gap-closure round
provides:
  - Automatic wall-distance enforcement (>= 3 hexes) for every ACTIVE defending piece at FREE_KICK_SETUP award time, defending-stage entry, and defending-stage end
  - Removal of the silent DEFENDER_TOO_CLOSE rejection (no client-side message mapping existed) from applyFreeKickReady
  - RED-first invariant test suite (gameEngine.freeKickWallDistance.test.ts) covering the wall rule across every FREE_KICK_SETUP boundary
affects: [offside, free-kick-setup, fouls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Stage-boundary auto-relocation: reuse the same relocateTrappedFreeKickPieces helper for a rejection-turned-auto-move fix, applied at both the END of the outgoing stage and the ENTRY of the incoming stage — idempotent by construction (empty trappedIds on re-sweep)'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.freeKickWallDistance.test.ts
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/offside.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts

key-decisions:
  - "Replaced applyFreeKickReady's DEFENDER_TOO_CLOSE rejection with two relocateTrappedFreeKickPieces sweeps: one at the END of an outgoing defending stage (line ~9564), one at the ENTRY of an incoming defending stage (line ~9583) — both idempotent and reusing the existing ring-3/own-goal-line-preference algorithm"
  - "Narrowed ApplyFreeKickReadyResult's rejection union to 'WRONG_PHASE' | 'NOT_YOUR_STAGE' (DEFENDER_TOO_CLOSE removed) — pnpm -r typecheck is the proof no caller still branches on it"
  - 'Cases 7-9 of the new test suite deliberately exercise the stage-0-to-1 ENTRY transition (never rejected pre-fix) rather than a defending-stage-END transition, so they pass both before and after the fix as true non-regression guards'

requirements-completed: [OFFSIDE-02]

# Metrics
duration: ~25min
completed: 2026-08-22
---

# Phase 42 Plan 13: Defensive Wall Distance Auto-Move (Gap Item 7) Summary

**Replaced the silent `DEFENDER_TOO_CLOSE` free-kick stage-end rejection with automatic relocation to the minimum legal wall distance (>= 3 hexes), applied at both defending-stage entry and defending-stage end via the existing `relocateTrappedFreeKickPieces` sweep.**

## Performance

- **Duration:** ~25 min (including a `pnpm install` + `packages/shared` build to bring up the worktree's toolchain)
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Diagnosed and closed gap item 7 from `42-10-SUMMARY.md`: a defending player left inside the 2-hex free-kick bubble no longer silently blocks the Ready button — the engine now auto-moves them to the minimum legal distance, at both the moment their stage ends AND the moment their stage begins.
- Added a 10-case RED-first invariant suite (`gameEngine.freeKickWallDistance.test.ts`) that pins the wall-distance rule (`hexDistance(defender.position, freeKickHex) >= 3`) across every `FREE_KICK_SETUP` boundary: award time, stage entry, stage end, and 4 non-regression invariants (kicker never relocated, no hex collisions, no placement-budget leakage, red-carded pieces exempt).
- Removed `DEFENDER_TOO_CLOSE` from `ApplyFreeKickReadyResult`'s rejection union entirely — confirmed via `pnpm -r typecheck` (0 errors) and a repo-wide grep (0 non-comment references outside the one historical-context comment permitted by Task 3's own acceptance criteria).
- Confirmed `gameHandlers.ts`'s `GAME_FREE_KICK_READY` handler required zero changes — it already emits `result.reason` generically with no switch statement.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED-first characterization of the wall-distance invariant** - `665be349` (test)
2. **Task 2: Auto-move defenders at every defending-stage boundary** - `f53a078f` (feat)
3. **Task 3: Socket-level proof the Ready click no longer dead-ends** - `afe3ecfc` (test)

_Note: this is a `type: execute` plan, not `type: tdd` — Task 1's RED-first suite establishes the diagnosis before Task 2's fix, but the plan does not mandate a strict TDD gate sequence._

## Task 1 RED-Run Evidence (Diagnosis of Record)

Against the unmodified engine (`gameEngine.ts` reverted to HEAD, test file present), the suite ran with **4 failures, 6 passed** — exactly cases 3-6, matching the plan's acceptance criteria ("failures are exactly among cases 3-6"):

```
❯ src/__tests__/gameEngine.freeKickWallDistance.test.ts (10 tests | 4 failed)
  × case 3: stage 0 -> 1 entry sweep — a home piece at distance 1 is legal by the time defending stage 1 becomes active
    → assertWallDistanceHolds: piece home-1 (team home) is at distance 1 from freeKickHex (25,10) — expected >= 3
  × case 4: stage 2 -> 3 entry sweep — a home piece at distance 2 is legal by the time defending stage 3 becomes active
    → assertWallDistanceHolds: piece home-1 (team home) is at distance 2 from freeKickHex (25,10) — expected >= 3
  × case 5: stage 1 end — a home piece at distance 2 no longer blocks Ready; it is auto-moved instead
    → expected false to be true // Object.is equality   (result.ok — pre-fix this was {ok:false, reason:'DEFENDER_TOO_CLOSE'})
  × case 6: stage 3 end — a home piece at distance 1 no longer blocks finalization; it is auto-moved before the kick is taken
    → expected false to be true // Object.is equality   (result.ok — pre-fix this was {ok:false, reason:'DEFENDER_TOO_CLOSE'})

Test Files  1 failed (1)
     Tests  4 failed | 6 passed (10)
```

Cases 1, 2, 7, 8, 9, 10 passed against the unmodified engine, proving the harness was sound and the trigger-time sweep (`relocateTrappedFreeKickPieces`, called from `applyOffsideFoulWithRelocation` and `applyFoulChoice`'s restart branch) already worked correctly — the gap was isolated entirely to `applyFreeKickReady`'s stage-boundary transitions.

After Task 2's fix, all 10 cases pass (verified before commit).

## Exact Placement of the Two New `relocateTrappedFreeKickPieces` Calls

Inside `applyFreeKickReady` (`packages/server/src/gameEngine.ts`):

- **Line 9564** — end-of-stage sweep: `stage.side === 'defending' ? relocateTrappedFreeKickPieces(state, team) : state` — assigned to `const base`. Runs when the CURRENTLY-ending stage (index 1 or 3) is a defending stage, sweeping the team that is about to leave it.
- **Line 9583** — entry sweep: `relocateTrappedFreeKickPieces(base, freeKickStageTeam(nextStageIndex, kickingTeam))` — assigned to `const entrySwept`, only inside the `stageIndex < 3` advance branch. Runs when the NEXT stage (index `stageIndex + 1`) is a defending stage, sweeping the team that is about to enter it.

Both calls are idempotent: sweeping an already-legal wall relocates nothing, since `relocateTrappedFreeKickPieces`'s `<= 2` trap filter yields an empty `trappedIds` set. All downstream reads in the function (`stagePlacedIds`, `mergedMovedPieceIds`, the `eventLog` spread, the advance-branch `...entrySwept` spread, and the finalize-branch kicker lookup `base.pieces.find(...)` / `...base` spread) were updated to flow through `base`/`entrySwept` instead of the raw input `state`.

## Final `ApplyFreeKickReadyResult` Union

```ts
export type ApplyFreeKickReadyResult =
  | {
      ok: false;
      // D-54 (supersedes D-51): KICKER_HEX_EMPTY removed — the kicker-placed requirement
      // is now enforced up front in applyFreeKickMove (KICKER_NOT_YET_PLACED), not at
      // stage-end.
      // Gap item 7 (supersedes D-30/D-50, 42-10-SUMMARY.md, this plan): the former
      // too-close-to-freeKickHex rejection reason is removed — a defender within 2 hexes
      // of freeKickHex is now auto-moved to the minimum legal distance rather than
      // blocking the stage-end. See the "Automatic wall enforcement" paragraph in this
      // function's JSDoc below.
      reason: 'WRONG_PHASE' | 'NOT_YOUR_STAGE';
    }
  | { ok: true; state: GameState };
```

`DEFENDER_TOO_CLOSE` is fully removed from the rejection union (down from 3 members to 2).

## `gameHandlers.ts` Confirmation

`git diff --stat packages/server/src/gameHandlers.ts` is empty for every task in this plan. Read and confirmed: the `GAME_FREE_KICK_READY` handler (around line 2819) emits `result.reason` generically via `socket.emit(ServerEvents.GAME_ERROR, result.reason)` with no switch on the reason value, so removing `DEFENDER_TOO_CLOSE` from the union requires zero handler changes — it compiles and behaves unchanged.

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.freeKickWallDistance.test.ts` (new) - 10-case invariant suite for the wall-distance rule across every `FREE_KICK_SETUP` boundary, with a self-diagnosing `assertWallDistanceHolds` helper
- `packages/server/src/gameEngine.ts` - `applyFreeKickReady` now auto-moves trapped defenders at stage-end AND stage-entry instead of rejecting; `ApplyFreeKickReadyResult` union narrowed; JSDoc updated with an "Automatic wall enforcement" section
- `packages/server/src/__tests__/offside.test.ts` - the two `DEFENDER_TOO_CLOSE` engine tests (stage 1 and stage 3) retitled and rewritten to assert the auto-move behavior
- `packages/server/src/__tests__/gameHandlers.phase17-06.test.ts` - the socket-level `DEFENDER_TOO_CLOSE` test rewritten to prove the full round trip succeeds (no `GAME_ERROR`, stage advances, defender relocated, kicker untouched)

## Decisions Made

- Reused `relocateTrappedFreeKickPieces` verbatim for both new call sites rather than writing new relocation logic — the algorithm (ring-3 candidates, own-goal-line preference, random `>= 3` fallback) already existed and is now applied consistently at every boundary instead of only at award time.
- Test cases 7-9 (non-regression, must be GREEN before and after the fix) were designed around the stage-0-to-1 ENTRY transition rather than a defending-stage-END transition, because ending a KICKING stage was never subject to the old rejection regardless of team occupancy — this makes them true regression guards rather than tests that happen to fail pre-fix for unrelated reasons.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded 4 comments in `gameEngine.ts` and 3 in test files that still contained the literal string `DEFENDER_TOO_CLOSE`**

- **Found during:** Task 2, while verifying the acceptance-criteria grep (`grep -rc "DEFENDER_TOO_CLOSE" packages/server/src packages/client/src packages/shared/src` must report `0` for every non-`dist` file)
- **Issue:** My own explanatory comments (documenting _why_ the reason was removed) used the literal identifier, which the grep-based acceptance criterion does not distinguish from live code references
- **Fix:** Reworded every comment to reference "the former too-close-to-freeKickHex rejection" instead of the literal identifier, preserving the same explanatory content
- **Files modified:** `packages/server/src/gameEngine.ts`, `packages/server/src/__tests__/gameEngine.freeKickWallDistance.test.ts`, `packages/server/src/__tests__/offside.test.ts`
- **Verification:** `grep -c "DEFENDER_TOO_CLOSE"` returns `0` for all three files
- **Committed in:** `f53a078f` (Task 2 commit; the wall-distance test file's 2 comment fixes are included in this commit even though the file itself was created in Task 1, since the fix was made necessary by Task 2's own acceptance criteria)

**2. [Rule 3 - Blocking] Ran `pnpm install` and `pnpm --filter @counter-attack/shared build` in the worktree**

- **Found during:** Task 1, first attempt to run the new test file
- **Issue:** The worktree had no `node_modules` (fresh worktree checkout) and `@counter-attack/shared` had no build output, so `vitest` failed with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` and then a Vite package-resolution error
- **Fix:** Ran `pnpm install` (content-addressable store, safe/non-destructive to the main checkout) and `pnpm --filter @counter-attack/shared build`
- **Files modified:** none (tooling setup only; `node_modules/` and `packages/shared/dist/` are gitignored)
- **Verification:** Subsequent test runs succeeded

---

**Total deviations:** 2 auto-fixed (1 bug/comment-wording, 1 blocking/tooling-setup)
**Impact on plan:** Both auto-fixes were necessary to meet the plan's own stated acceptance criteria and to run tests at all in a fresh worktree. No scope creep — no production code beyond what the plan specified was touched.

## Issues Encountered

- Initial designs for non-regression test cases 7-9 accidentally chained through a defending-stage-END transition, which meant they failed pre-fix too (contradicting the plan's classification of them as "must be GREEN before and after the fix"). Redesigned all three around the stage-0-to-1 ENTRY transition, which was never subject to the old rejection regardless of fix status — re-verified the RED baseline showed exactly cases 3-6 failing (4 failures) after the redesign, matching the acceptance criteria precisely.

## Known Stubs

None.

## Threat Flags

None — this plan's `<threat_model>` (T-42-49 through T-42-53) covers every trust-boundary change introduced (server-only relocation targets, explicit `team` argument preventing cross-team relocation, no client input to the sweep). No new network endpoints, auth paths, or schema changes were introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap item 7 is closed; the defensive wall distance rule is now a true invariant maintained automatically at every `FREE_KICK_SETUP` boundary, with the confusing silent-rejection UX fully removed.
- No blockers for the remaining gap-closure plans (42-11, 42-12, 42-14, 42-15) — this plan shares no requirement, component, or user-facing surface with them per its own scope note.
- Full server suite (1500 tests, 61 files) and shared suite (863 tests, 17 files) both pass clean; `pnpm -r typecheck`, `npx eslint` (on all 4 touched files), and `pnpm knip` all exit clean. `pnpm format:check` reports 13 pre-existing unrelated files with formatting drift (none touched by this plan) — out of scope per the deviation rules' scope boundary.

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_
