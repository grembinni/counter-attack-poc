---
phase: 45-game-summary-popup
plan: 03
subsystem: api
tags: [socket.io, server-state, statistics, tdd]

# Dependency graph
requires:
  - phase: 45-game-summary-popup (plan 01)
    provides: MatchStats type, EMPTY_MATCH_STATS, computeShotXg/recordShotInStats in @counter-attack/shared
provides:
  - foldMatchStats — pure reducer folding newly-appended eventLog events + a possession
    delta into MatchStats (possession, completed passes, tackle/steal attempts+successes,
    fouls, yellow/red cards)
  - Room baselines (lastBroadcastEventLogLength/lastBroadcastActionCount/lastBroadcastAttackingTeam)
    and the single broadcastState fold call site that keeps matchStats current on every
    server broadcast
affects: [45-04 (Game Summary popup UI, consumes GameState.matchStats), 45-02 (owns shots/xg — unaffected by this plan)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Edge-triggered stat accumulation at a single choke point (broadcastState), diffing
      against per-Room baselines, mirroring the existing lastBroadcastBallPosition pattern"
    - "Pure fold reducer taking (current, newEvents, pieces, possession) -> new state,
      seeded from a frozen EMPTY_* constant when current is undefined"

key-files:
  created:
    - packages/server/src/matchStatsReducer.ts
    - packages/server/src/__tests__/matchStatsReducer.test.ts
  modified:
    - packages/server/src/roomStore.ts
    - packages/server/src/__tests__/roomStore.test.ts

key-decisions:
  - "PD-08/09/10/11/12/13 all implemented as specified in 45-03-PLAN.md (completed-pass
    definition, LONG_BALL carrierId attribution, second-yellow double count, fold
    placement before the goalkeeper offer hooks, unconditional baseline advance outside
    the TACKLE_STEAL_PROMPT guard, clamped undo-safe slice length)"
  - "COUNTED_ACCURATE_PASS_TYPES exported per plan instruction but consumed only by its
    own dedicated test (not imported by roomStore.ts) — added a small assertion test so
    pnpm knip does not flag it as an unused export"

patterns-established:
  - "Pattern 2 from 45-03-PLAN.md: a single pure fold reducer + a single call site inside
    broadcastState, in preference to per-call-site inline instrumentation, for statistics
    that are produced across many independent branches"

requirements-completed: [STATS-04, STATS-05, STATS-06, STATS-09]

# Metrics
duration: ~35min
completed: 2026-08-28
---

# Phase 45 Plan 03: Match Stats Reducer + broadcastState Wiring Summary

**Pure `foldMatchStats` reducer plus a single `broadcastState` call site accumulate possession, completed passes, tackle/steal attempts+successes, fouls, yellow cards, and red cards from the server's own `eventLog`, exactly once per broadcast.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- New pure `foldMatchStats(current, newEvents, pieces, possession)` reducer in `packages/server/src/matchStatsReducer.ts` covering all six non-shot whole-match statistics (STATS-04, STATS-05, STATS-06, STATS-09), with `shots`/`xg` passed through byte-identically (owned exclusively by plan 45-02)
- `Room` gained three new edge-trigger baselines (`lastBroadcastEventLogLength`, `lastBroadcastActionCount`, `lastBroadcastAttackingTeam`) mirroring the existing `lastBroadcastBallPosition` pattern
- `broadcastState` now folds the newly-appended `eventLog` slice and the `actionCount` delta into `matchStats` exactly once per broadcast, inserted before the goalkeeper offer hooks (PD-11) so both hooks' state spreads carry `matchStats` forward automatically with zero per-hook edits
- The three new baselines advance unconditionally (PD-12), unlike `lastBroadcastBallPosition`, which stays suppressed during `TACKLE_STEAL_PROMPT` for an unrelated Phase 43 reason — this prevents a resume broadcast from re-folding and double-counting
- Undo safety (PD-13): the previous `eventLog` length is clamped to the current length before slicing, so an undo-shrunk log can never produce an out-of-range slice

## Task Commits

Each task was committed atomically (TDD task 1 has separate RED/GREEN commits):

1. **Task 45-03-01 (RED): add failing test for foldMatchStats reducer** - `fd6b339c` (test)
2. **Task 45-03-01 (GREEN): implement pure foldMatchStats reducer** - `03679afa` (feat)
3. **Task 45-03-02: wire foldMatchStats into broadcastState with three edge-trigger baselines** - `94689052` (feat)

_TDD task 45-03-01 has two commits (test → feat) per the RED/GREEN protocol; no REFACTOR commit was needed since the GREEN implementation already matched the target design._

## Files Created/Modified

- `packages/server/src/matchStatsReducer.ts` - New pure `foldMatchStats` reducer + exported `COUNTED_ACCURATE_PASS_TYPES` constant (178 lines)
- `packages/server/src/__tests__/matchStatsReducer.test.ts` - 25 named tests, one per behavior bullet plus the mandatory D-07/Pitfall-5 tests and a `COUNTED_ACCURATE_PASS_TYPES` assertion (516 lines)
- `packages/server/src/roomStore.ts` - Three new `Room` fields + the fold call site + unconditional baseline advance inside `broadcastState`
- `packages/server/src/__tests__/roomStore.test.ts` - New `describe('broadcastState — match-stats fold (Phase 45 Plan 03)')` block: 5 tests covering first-broadcast no-op, single-fold-on-append, idempotency, `TACKLE_STEAL_PROMPT` single-fold (PD-12), and shrunken-log safety (PD-13)

## Decisions Made

- Followed the plan's PD-08 through PD-13 exactly as specified — no deviation from the documented planner decisions.
- `COUNTED_ACCURATE_PASS_TYPES` is exported per the plan's explicit instruction ("Declare the counted pass-event types as a named exported constant array... so the definition is adjustable in one place"), but the switch's `case` labels for `STANDARD_PASS`/`FIRST_TIME_PASS`/`LONG_BALL` are still hand-written literals (TypeScript discriminated-union `case` labels cannot be derived from a runtime array) — a code comment at the constant and at each relevant `case` flags that the two must be kept in sync by hand if a new pass type is ever added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two test-fixture type errors surfaced by `pnpm --filter @counter-attack/server typecheck`**
- **Found during:** Task 45-03-01, immediately after the GREEN implementation
- **Issue:** `matchStatsReducer.test.ts`'s `TACKLE_STEAL_DECLINED` fixture used an invalid `kind: 'TACKLE_ATTEMPT'` value (the declared type is `'STEAL' | 'TACKLE'`) via an `as ActionEvent` cast that TypeScript correctly rejected as a non-overlapping conversion; a separate `MOVE`/`SLOT_ADVANCE` fixture used `'ATTACKER_1'`, which is not a member of `MovementSlot` (`'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2'`).
- **Fix:** Corrected `kind` to the literal `'TACKLE'` and removed the unsound cast; corrected the `MovementSlot` fixture values to `'ATTACKER_4'`/`'ATTACKER_2'`.
- **Files modified:** `packages/server/src/__tests__/matchStatsReducer.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server typecheck` exits 0.
- **Committed in:** `03679afa` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] `pnpm knip` flagged `COUNTED_ACCURATE_PASS_TYPES` as an unused export**
- **Found during:** Task 45-03-02, running the plan's own `<verification>` checklist (`pnpm knip still exits clean`)
- **Issue:** The plan instructs exporting `COUNTED_ACCURATE_PASS_TYPES` as a named constant for future adjustability, but nothing outside `matchStatsReducer.ts` imports it, so `knip` correctly flagged it as dead surface.
- **Fix:** Added a small dedicated test (`describe('COUNTED_ACCURATE_PASS_TYPES', ...)`) in `matchStatsReducer.test.ts` that imports and asserts its contents — genuinely useful regression coverage that also satisfies `knip`.
- **Files modified:** `packages/server/src/__tests__/matchStatsReducer.test.ts`
- **Verification:** `pnpm knip` exits 0 with no findings.
- **Committed in:** `94689052` (Task 2 commit)

**3. [Rule 3 - Blocking] Two `@typescript-eslint/no-unnecessary-type-assertion` lint errors in the new roomStore tests**
- **Found during:** Task 45-03-02, running eslint on the modified test file
- **Issue:** Two `room.gameState = { ...(room.gameState as GameState), ... }` spreads immediately followed an earlier assignment in the same test where TypeScript had already narrowed `room.gameState` to a non-null type, making the `as GameState` cast redundant.
- **Fix:** Removed the two redundant casts (`...room.gameState` instead of `...(room.gameState as GameState)`).
- **Files modified:** `packages/server/src/__tests__/roomStore.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server exec eslint` exits 0 with no findings; typecheck and full test suite re-run clean afterward.
- **Committed in:** `94689052` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking issues surfaced by the plan's own verification commands, not scope changes)
**Impact on plan:** All three fixes were required to satisfy the plan's own stated verification/acceptance criteria (typecheck, knip, lint). No scope creep — no behavior, requirement, or architectural decision was altered.

## Issues Encountered

- The worktree had no `node_modules` installed at session start (`pnpm install` was required before any test/typecheck command would run). This is expected worktree setup, not a plan defect, and is not itself a deviation from the plan's task instructions.
- The literal `grep -v '^\s*\*' packages/server/src/matchStatsReducer.ts | grep -c "shots\b"` command in the plan's acceptance criteria returns 2 (not 0), because the mandatory pass-through lines `shots: base.shots,` / `xg: base.xg,` necessarily reference those identifiers by name — the plan's own action text requires this exact pass-through. The grep's intent ("the reducer must not *compute* either") is satisfied: no arithmetic, counter mutation, or switch branch touches `shots`/`xg` anywhere in the file; only the unconditional pass-through assignment references them. Flagging this as a wording nuance in the plan's grep command rather than a defect in the implementation.

## Next Phase Readiness

- `GameState.matchStats` is now kept live and current by every `broadcastState` call across the whole match, ready for plan 45-04 (Game Summary popup UI) to read `possessionActionCount`, `passesCompleted`, `tackleStealAttempts`/`tackleStealSuccesses`, `fouls`, `yellowCards`, and `redCards` directly off broadcast `GameState` with no additional server wiring.
- `shots`/`xg` remain exclusively owned by plan 45-02's inline capture; this plan never reads or writes either, confirmed structurally (no computation) and by the full 68-file, 1604-test server suite passing with both plans' changes present.
- No blockers for 45-04.

---
*Phase: 45-game-summary-popup*
*Completed: 2026-08-28*
