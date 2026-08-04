---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 13
subsystem: api
tags: [socket.io, hex-grid, validation, gap-closure, goal-kick]

# Dependency graph
requires:
  - phase: 37-08
    provides: applyGoalKickReposition, computeGoalKickEligibleIds, and the GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT GAME_MOVE handler branch
  - phase: 37-12
    provides: goal-kick warning-level fixes (kickDie gating, ThrowInSetupPanel label) that this plan's baseline (772 server tests) was measured against
provides:
  - 'isPitchHex(to) on-pitch bounds guard inside applyGoalKickReposition (gameEngine.ts), returning MOVE_INVALID/OFF_PITCH'
  - 'isPitchHex(to) defence-in-depth guard inside the GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT GAME_MOVE handler branch (gameHandlers.ts), emitting the wire-level OFF_PITCH code'
  - '13 new regression tests (8 engine unit + 5 socket integration) proving both guards are load-bearing via red-first proofs'
  - "GOALKICK-02 genuinely SATISFIED — closes the sole remaining BLOCKER from 37-VERIFICATION.md (2026-08-04T18:10:00Z), the last of the phase's 15 requirement IDs"
affects: [38-corner-kick]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Engine + handler defense-in-depth pair for bounds validation: engine guard is the authoritative one (exported, independently reachable), handler guard produces the precise wire code because the handler only ever emits result.reason, never result.detail'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
    - packages/server/src/__tests__/goalKick.integration.test.ts

key-decisions:
  - 'D-13-01: both engine and handler layers get the guard (not one) — engine-only would leave the wire code as the vague MOVE_INVALID; handler-only would leave the exported applyGoalKickReposition unguarded for future callers'
  - "D-13-02: ApplyMoveResult's reason union stays unwidened — OFF_PITCH travels only in the engine's detail field; the handler independently owns the OFF_PITCH wire-code string"
  - 'D-13-03: guard placed after adjacency, before occupancy — a distant off-pitch hex still returns OUT_OF_RANGE; OFF_PITCH precedes OCCUPIED because the two are mutually exclusive (no piece can occupy an off-pitch hex)'
  - 'D-13-04: handler guard placed strictly after the payload-shape check — isPitchHex dereferences .q/.r and would throw on the null/non-object payloads that check exists to reject'

requirements-completed: [GOALKICK-02]

# Metrics
duration: ~45min
completed: 2026-08-04
---

# Phase 37 Plan 13: Goal-Kick Reposition On-Pitch Bounds Guard Summary

**Added a two-layer isPitchHex(to) bounds guard to applyGoalKickReposition and its GAME_MOVE handler branch, closing the sole remaining GOALKICK-02 BLOCKER from 37-VERIFICATION.md with 13 new tests and two red-first proofs confirming both guards are independently load-bearing.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-04T13:01:41-05:00 (worktree base commit)
- **Completed:** 2026-08-04T13:46:20-05:00
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- `applyGoalKickReposition` (gameEngine.ts) now rejects any off-pitch reposition destination on all four pitch boundaries (q=0, q=36, r=0, r=25) in both `GOAL_KICK_SETUP_GK` and `GOAL_KICK_SETUP_OPPONENT` windows, returning `{ ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' }` — without widening `ApplyMoveResult`'s `reason` union
- The `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` `GAME_MOVE` handler branch (gameHandlers.ts) independently rejects the same off-pitch destinations with the precise `OFF_PITCH` wire code, strictly after the existing payload-shape check
- 8 new engine-layer unit tests (all four boundaries, both windows, non-mutation proof, adjacency-vs-bounds precedence, positive on-pitch control, full 6-hex budget from a boundary hex)
- 5 new socket-level integration tests (GK-window and OPPONENT-window `OFF_PITCH` rejection, full non-mutation proof read from authoritative room state, positive control, payload-shape-before-bounds ordering)
- Two red-first proofs (both required by the plan's acceptance criteria) independently confirm each guard is load-bearing, not redundant with the other

## Task Commits

Each task was committed atomically:

1. **Task 1: Engine-layer on-pitch bounds guard in applyGoalKickReposition + unit coverage** - `c5a66f9` (feat)
2. **Task 2: Handler-layer bounds guard on GOAL_KICK_SETUP GAME_MOVE branch + socket-level regression test** - `c6d6e6f` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - `isPitchHex(to)` guard added inside `applyGoalKickReposition`, between the adjacency check and the occupancy check
- `packages/server/src/gameHandlers.ts` - `isPitchHex(to)` guard added inside the `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` `GAME_MOVE` branch, between the payload-shape check and the `applyGoalKickReposition` delegate
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` - 4 new boundary fixtures (`homeGoalLineEdge`, `homeFarEdge`, `homeTopEdge`, `awayFarEdge`) + 8 new `it` blocks appended to the existing `describe('applyGoalKickReposition')`
- `packages/server/src/__tests__/goalKick.integration.test.ts` - `seedGoalKickSetupGk` extended with an optional `{ homeStart, awayStart }` opts param (backwards-compatible; 4 existing call sites unchanged) plus derived `eligibleHomeOffPitchNeighbor`/`eligibleAwayOffPitchNeighbor`/`eligibleAwayStart` return fields; 5 new `it` blocks appended to the existing `describe('GOALKICK-02: reposition windows...')`

## Decisions Made

- D-13-01 through D-13-06 were locked at planning time (see 37-13-PLAN.md) and followed without deviation: two-layer guard, `detail`-not-`reason` for the engine, D-13-03/D-13-04 placement ordering, no client change, no `REQUIREMENTS.md` edit (GOALKICK-02 was already `[x]`/`Complete` and this plan makes that checkbox accurate rather than needing to flip it).
- No new decisions made during execution — the plan's read-first sections and behavior bullets were precise enough to implement without deviation.

## Verification Evidence (from plan acceptance criteria)

**`isPitchHex` occurrence counts in `gameEngine.ts`:**

- Baseline (HEAD before this plan): 10 total occurrences of the string `isPitchHex` (7 call sites incl. the pre-existing LOOSE_BALL clamp at line 3083, plus 2 pre-existing comment mentions, plus the import)
- After Task 1: 11 total occurrences (+1, exactly matching the acceptance criterion) — a comment initially added a second textual mention and was reworded to avoid double-counting
- `sed -n '3452,3548p' gameEngine.ts | grep -c 'isPitchHex(to)'` → `1` (guard is inside `applyGoalKickReposition`'s body)
- `sed -n '3452,3548p' gameEngine.ts | grep -v '^ *[*/]' | grep -c "detail: 'OFF_PITCH'"` → `1` (comment lines excluded)
- `ApplyMoveResult`'s `reason` union (`'WRONG_SLOT' | 'WRONG_TEAM' | 'PIECE_NOT_FOUND' | 'MOVE_INVALID' | 'WRONG_PHASE'`) still matches verbatim — NOT widened (D-13-02)
- Guard ordering confirmed by line number: `hexDistance` check (3484) < `isPitchHex(to)` (3502) < occupancy check (3505)

**Handler guard (`gameHandlers.ts`):**

- `sed -n '648,700p' gameHandlers.ts | grep -c 'isPitchHex(to)'` → `1`
- `sed -n '648,700p' gameHandlers.ts | grep -v '^ *[*/]' | grep -v '^ *//' | grep -c "GAME_ERROR, 'OFF_PITCH'"` → `1`
- Guard ordering confirmed by line number: `typeof to.r !== 'number'` (669) < `isPitchHex(to)` (685) < `applyGoalKickReposition(room.gameState` (690)

**Test-file diff hygiene:**

- `git diff -U0 gameEngine.outOfBounds.test.ts` shows zero deletions in the range 1155-1270 (pre-existing `applyGoalKickReposition` tests untouched) — pure insertions
- `git diff -U0 goalKick.integration.test.ts` shows deletions ONLY inside the `seedGoalKickSetupGk` function signature/body (the 2 hardcoded default-value lines replaced with `opts?.homeStart ?? {...}` / `opts?.awayStart ?? {...}`) — zero deletions in the reposition-windows describe or the GOALKICK-05 describe

**Test counts:**

- `gameEngine.outOfBounds.test.ts`: 85 → 93 tests (+8)
- `goalKick.integration.test.ts`: 25 → 30 tests (+5)
- Full server suite: 772 passed / 1 skipped / 1 todo (36 files, pre-existing baseline from 37-VERIFICATION.md) → **785 passed / 1 skipped / 1 todo (36 files)** — strictly higher, zero failures
- Client suite: 547 passed (27 files) — unchanged, confirming zero client-side regression (no client file was modified)
- `pnpm --filter @counter-attack/server typecheck` → clean
- `pnpm typecheck` (full monorepo) → clean

**Red-first proof A (Task 1, engine guard disabled via temporary comment-out, restored after):**

```
pnpm --filter @counter-attack/server test -- gameEngine.outOfBounds
→ Test Files  1 failed (1)
  Tests  5 failed | 88 passed (93)
```

All 5 failures were exactly the 4 new `OFF_PITCH`-assertion tests plus the non-mutation test (which also asserts rejection) — no other test was affected. Guard restored; suite returns to 93/93 passing.

**Red-first proof A (Task 2, handler guard disabled via temporary comment-out, restored after):**

```
pnpm --filter @counter-attack/server test -- goalKick.integration
→ Test Files  1 failed (1)
  Tests  3 failed | 27 passed (30)
```

All 3 failures showed:

```
AssertionError: expected 'MOVE_INVALID' to be 'OFF_PITCH'
Expected: "OFF_PITCH"
Received: "MOVE_INVALID"
```

Confirming the handler guard is load-bearing and NOT redundant with the Task 1 engine guard: with only the handler guard removed, the engine guard still rejects the move but the handler emits the generic `result.reason` (`'MOVE_INVALID'`) instead of the precise `OFF_PITCH` the wire protocol requires. Guard restored; suite returns to 30/30 passing.

**Red-first proof B (both guards disabled via temporary comment-out, restored after):**

```
pnpm --filter @counter-attack/server test -- goalKick.integration
→ Test Files  1 failed (1)
  Tests  3 failed | 27 passed (30)
```

All 3 failures:

```
Error: Timed out waiting for event "game:error" after 2000ms
```

No `GAME_ERROR` was ever emitted — the piece actually moved to the off-pitch destination and a `GAME_STATE` broadcast fired instead, which the tests (correctly) don't listen for. This proves the tests reach and exercise the real defect (an unvalidated coordinate walking a piece off-grid), not a mocked or shallow condition. Both guards restored; suite returns to 30/30 passing.

## Deviations from Plan

None — plan executed exactly as written. One minor self-correction during Task 1: the guard's explanatory comment initially repeated the identifier `isPitchHex` a second time in prose ("mirrors the sibling applyGoalKickTarget's isPitchHex guard"), which would have made `grep -c 'isPitchHex'` count +2 instead of the required +1. Reworded to "on-pitch guard" before committing — caught during self-verification, not a plan deviation, no behavior change.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no `dist/` build output on first test run (`Failed to resolve entry for package "@counter-attack/shared"`). Resolved by running `pnpm install --frozen-lockfile` (worktree-local, does not touch the main repo's `node_modules`) followed by `pnpm --filter @counter-attack/shared build`. Not a plan deviation — standard worktree bootstrap, not code-related.
- The pre-commit hook's `eslint --fix` flagged `@typescript-eslint/no-explicit-any` on the new `(clientA as any).emit(...)` malformed-payload test line. Fixed by adding the same `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment the file's two other identical patterns already use (lines 100, 922) — a pure lint-convention match, not a logic change.

## T-37-66 Follow-up (recorded per plan's `<output>` instruction)

`gameHandlers.ts`'s `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` `GAME_MOVE` branch (lines 629-647) has the identical missing-bounds-check shape: it delegates to `applyMove`, whose `applyFreeMove` path (`gameEngine.ts:537-540`) also lacks an `isPitchHex` check. This is deliberately **out of scope** for this plan (not GOALKICK-02, not in the `37-VERIFICATION.md` gap) and was explicitly NOT fixed here per the plan's `<read_first>` instruction and the threat register's T-37-66 disposition (`accept`, deferred). Flagging for a future phase — likely worth bundling with any future pass that touches `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GOALKICK-02 is genuinely SATISFIED. All 15 of Phase 37's requirement IDs are now closed (14 were already SATISFIED per 37-VERIFICATION.md; this plan closes the 15th).
- `.planning/REQUIREMENTS.md`'s existing `[x]`/`Complete` marks for GOALKICK-02 (checkbox line 61, traceability row line 142) are now accurate — no edit needed (D-13-06), no re-verification churn required.
- No blockers for Phase 38 (Corner Kick). The T-37-66 follow-up (FREE_MOVE_ATTACK/DEFENSE missing the same bounds check) is a pre-existing, unrelated gap worth considering when Phase 38 or a future cleanup phase next touches that branch.

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Completed: 2026-08-04_
