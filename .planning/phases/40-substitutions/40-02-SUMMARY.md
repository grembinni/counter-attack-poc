---
phase: 40-substitutions
plan: 02
subsystem: game-engine
tags: [typescript, pure-functions, game-state, substitutions, added-time]

# Dependency graph
requires:
  - phase: 40-substitutions (plan 40-01)
    provides: STOPPAGE_PHASES/isStoppagePhase, MAX_SUBS_PER_TEAM, maxOnPitchFor, BenchEntry/BenchEntryStatus, GameState.bench/subsUsed/addedTimeBonus, PlayerPiece.playerId, SUBSTITUTION ActionEvent (all contract-only, no behavior)
provides:
  - applySubstitution pure function enforcing SUB-02/03/04/06/07, SETTINGS-04, D-12, D-13
  - SubstitutionRejection discriminated-union reason type (8 members)
  - applyRosterContinuity helper (position from reset array, identity/match-state from live pieces)
  - applyEndTurn addedTimeBonus fold-in (SUB-05/D-06) and half-boundary reset (SUB-05/D-07)
affects: [40-03, 40-04, 40-05, 40-06, 40-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Validate-all-guards-before-any-mutation pure function returning { ok: true; state } | { ok: false; reason }, matching the applyUndo/applyEndTurn template'
    - 'Two structurally separate GK-parity checks (never merged with another boolean) — mirrors the pre-match lineup flow error strings verbatim'
    - 'Mutually exclusive fold-in (applyEndTurn, addedTime === null) vs. direct-increment (applySubstitution, addedTime !== null) added-time paths so a substitution minute is never double-counted'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.substitution.test.ts
  modified:
    - packages/server/src/gameEngine.ts

key-decisions:
  - 'D-12 empty-bench guard (guard 5) never generates a substitute from PLAYER_POOL or any other pool — the retracted D-10 auto-fill design must never be reintroduced at this call site'
  - 'D-13: guards 6 (ALREADY_SUBBED) and 7 (CANNOT_SUB_IN_RED_CARDED) kept as two structurally separate checks rather than a single status !== "available" test, since the client renders a distinct message/badge for each'
  - 'SUB-05 fold-in lives at the single existing newAddedTime = roll + leniency computation site inside applyEndTurn; the state.addedTime === null set-once-per-half guard is untouched so a late substitution still adds its minute via the separate direct-increment path'
  - 'SUB-05/D-07 addedTimeBonus reset placed in the HALF_TIME/FULL_TIME return branch of applyEndTurn (not applyHalfTimeStart) because HALF_TIME is itself a stoppage where substitutions must still accumulate toward the second half'

requirements-completed: [SUB-02, SUB-03, SUB-04, SUB-05, SUB-06, SUB-07, SETTINGS-04]

# Metrics
duration: ~25min
completed: 2026-08-16
---

# Phase 40 Plan 02: Substitution Rules Engine Summary

**`applySubstitution` pure function enforcing all eight SUB-02..07/SETTINGS-04/D-12/D-13 guards in validation order, plus the SUB-05 per-half added-time accumulator fold-in and the `applyRosterContinuity` overlay helper for later plans.**

## Performance

- **Duration:** ~25 min (includes fresh-worktree `pnpm install` + `packages/shared` build)
- **Started:** 2026-08-16T17:59:00Z (approx.)
- **Completed:** 2026-08-16T18:24:00Z (approx.)
- **Tasks:** 3/3 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Wrote a 480+ line RED-state spec (`gameEngine.substitution.test.ts`) covering SUB-02..07, SETTINGS-04, D-12 (empty bench), D-13 (red-carded bench entry), ownership, GK parity, and `applyRosterContinuity` — 20 tests, all using real `PLAYER_POOL` ids and `buildKickOffPieces`-derived positions (no invented hex coordinates).
- Implemented `applySubstitution`: 9 sequential guards (phase → cap → ownership → red-card-out → bench-lookup/D-12 → already-subbed → D-13-red-carded → pool-lookup → GK-parity) before any state mutation, then a single immutable rebuild of `pieces`/`bench`/`subsUsed`/`addedTimeBonus`/`addedTime`/`eventLog`.
- The substitute inherits the outgoing piece's `id`/`teamId`/`number`/`position` (so `ball.carrierId`, `movedPieceIds`, and per-cycle pace budgets keep pointing at the slot, and a substitution can never refresh a spent budget) while taking identity/attributes from the incoming pool player and arriving with `redCarded: false` / `yellowCards: 0` / `injuryCount: 0`.
- Folded `state.addedTimeBonus` into `applyEndTurn`'s existing single `newAddedTime = roll + leniency` computation site, and added the SUB-05/D-07 `addedTimeBonus: 0` reset to the HALF_TIME/FULL_TIME return branch (leaving `subsUsed`, the whole-match cap, untouched).
- Exported `applyRosterContinuity(resetPieces, currentPieces)` — takes positions from `resetPieces`, identity/match state from `currentPieces`, matched by piece `id` — for plans 40-04/40-05 to wire into goal and half-time resets.

## Task Commits

1. **Task 1: Wave 0 — create gameEngine.substitution.test.ts in the RED state** - `67641a9` (test)
2. **Task 2: Implement applySubstitution** - `72c99e4` (feat)
3. **Task 3: Added-time accumulator fold-in, half-boundary reset, and applyRosterContinuity** - `5d047ff` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.substitution.test.ts` - full engine-level spec for `applySubstitution`/`applyRosterContinuity` (20 tests)
- `packages/server/src/gameEngine.ts` - `SubstitutionRejection` type, `applySubstitution`, `applyRosterContinuity`, `applyEndTurn`'s added-time fold-in and half-boundary reset

## Decisions Made

- Used `buildKickOffPieces('home', {home:'city', away:'crew'}, ...)` plus a local `playerId` stamp (since that wiring is plan 40-04's job, not this plan's) to build the 22-piece Wave-0 fixture — real ids and real formation-derived hex positions throughout, per the plan's fixture-convention requirement.
- Bench fixtures draw from real free-agent `PLAYER_POOL` entries disjoint from both starting XIs (including a real free-agent GK, `p077`, for the GK-parity tests) rather than inventing player records.
- Renamed `applySubstitution`'s local added-time variable to `substitutionAddedTime` (distinct from `applyEndTurn`'s `newAddedTime`) to avoid an unrelated grep collision when verifying Task 3's single fold-in edit site.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed two Wave-0 test-fixture bugs discovered during Task 2's GREEN run**

- **Found during:** Task 2 (`applySubstitution` implementation) — running the Wave-0 suite against the real implementation surfaced two test-design bugs, not implementation bugs.
- **Issue A:** The SUB-04 "three successful substitutions" test reused the same bench entry (`homeBenchBase[0]`) across all three loop iterations. After the first substitution, that bench slot is overwritten to `status: 'subbedOut'` holding the _previous_ outgoing player's pool id, so the second/third loop iterations were substituting a different (no-longer-matching) `inPlayerId` and returning `INVALID_SUBSTITUTE` instead of succeeding.
- **Issue B:** Both `applyEndTurn` HALF_TIME-transition tests used `actionCount`/`refereeCard.leniency`/`addedTimeRoll` values whose resulting `newAddedTime` pushed `halfEnd` past `newActionCount`, so the transition landed on the normal `PASS` branch instead of `HALF_TIME` — the test never actually exercised the code path it claimed to assert on.
- **Fix:** Issue A — consumed all three distinct bench entries in sequence (two outfield subs + a GK-for-GK sub using the bench GK, satisfying GK parity). Issue B — recalculated `actionCount`/`leniency`/`roll` so `newActionCount >= halfEnd` genuinely holds both before and after Task 3's fold-in change.
- **Files modified:** `packages/server/src/__tests__/gameEngine.substitution.test.ts`
- **Verification:** Full 20-test file green after Task 3; no assertion was weakened, only the fixture inputs were corrected so the intended code path actually executes.
- **Committed in:** `72c99e4` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug-class fix spanning 2 test fixtures)
**Impact on plan:** Both fixes correct test-input bugs that were masking the real assertions; no production code or acceptance-criteria behavior was changed. No scope creep.

## Issues Encountered

- Fresh worktree had no `node_modules` (documented Windows-worktree quirk from project memory) — ran `pnpm install` (no junction workarounds; reads from the shared pnpm content-addressable store) and then `pnpm run build` in `packages/shared` (its `exports` field points at `dist/`, which a fresh worktree doesn't have until built).
- Root `pnpm test` hit the known Windows `tinypool`/`threads`-pool "Worker exited unexpectedly" flake (2 unhandled errors, 52/54 server test files reported instead of 54/54) — documented in project memory as a pre-existing environment issue, not a real regression. Reran each package individually with `--pool=forks`: shared 839/839, server 1360/1360 (1 skipped, 1 todo), client 958/958, all green.
- The plan's Task 3 acceptance criterion `grep -c "newAddedTime = " packages/server/src/gameEngine.ts` returning exactly `1` is not literally achievable: a pre-existing `let newAddedTime = state.addedTime;` declaration (predating Phase 40, at `applyEndTurn`'s top) also matches that substring and is out of this task's scope to rename. Verified the substantive requirement instead — exactly one _reassignment_ site contains the roll formula (`newAddedTime = roll + state.refereeCard.leniency + (state.addedTimeBonus ?? 0)`), and all four `addedTime: newAddedTime` return sites read that same local — via `grep -n "addedTime: newAddedTime"` (4 matches) and `grep -n "newAddedTime = "` (2 matches: the pre-existing declaration + the one fold-in reassignment).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `applySubstitution`, `SubstitutionRejection`, and `applyRosterContinuity` are exported, fully unit-tested (20/20 green), and typecheck-clean — plan 40-03 (mid-match roster UI) and plan 40-05 (the `GAME_SUBSTITUTION` socket handler) can now build directly against this pure-function surface.
- `applyRosterContinuity` is exported but not yet wired into any reset call site (goal reset, `applyHalfTimeStart`) — that wiring is explicitly plans 40-04/40-05's scope, not this plan's.
- Full monorepo verification (per-package, `--pool=forks`): shared 839/839, server 1360/1360 (1 skipped, 1 todo), client 958/958 — all green; `pnpm typecheck` clean for `packages/server`.

---

_Phase: 40-substitutions_
_Completed: 2026-08-16_

## Self-Check: PASSED

- FOUND: packages/server/src/**tests**/gameEngine.substitution.test.ts
- FOUND: packages/server/src/gameEngine.ts (applySubstitution, applyRosterContinuity present)
- FOUND commit: 67641a9 (Task 1)
- FOUND commit: 72c99e4 (Task 2)
- FOUND commit: 5d047ff (Task 3)
