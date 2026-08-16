---
phase: 40-substitutions
plan: 05
subsystem: api
tags: [socket.io, express, real-time, substitution, roster-continuity, typescript]

# Dependency graph
requires:
  - phase: 40-substitutions plan 01
    provides: STOPPAGE_PHASES/isStoppagePhase, MAX_SUBS_PER_TEAM, GameState.bench/subsUsed/addedTimeBonus fields, SUBSTITUTION ActionEvent, GAME_SUBSTITUTION/SubstitutionPayload event contract
  - phase: 40-substitutions plan 02
    provides: applySubstitution and applyRosterContinuity pure functions in gameEngine.ts
provides:
  - GAME_SUBSTITUTION socket handler (mutex -> phase-guard -> team-guard -> pure-delegate -> broadcast)
  - Roster-continuity overlay applied at the three handler-side goal-reset call sites (GAME_END_TURN snapshot-deflect goal, GAME_SHOT declare-shot goal, GAME_HEADER_TARGET header goal)
  - 43-test socket-level integration spec covering every SubstitutionRejection reason, D-12 empty bench, double-emit mutex, and a full substitute-then-goal roster-continuity regression
affects: [40-06, 40-07, client substitution UI integration, milestone v1.6 close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GAME_SUBSTITUTION follows the codebase's universal isProcessing-mutex -> isStoppagePhase-guard -> socketTeam-ownership-guard -> applySubstitution-delegate -> broadcastState shape (same skeleton as GAME_UNDO)"
    - 'applyRosterContinuity(buildKickOffPieces(...), <liveState>.pieces) wraps every kick-off-reset pieces array at both engine call sites (40-04) and handler call sites (this plan) so a goal never resurrects a substituted-out or red-carded player'

key-files:
  created:
    - packages/server/src/__tests__/gameHandlers.substitution.test.ts
  modified:
    - packages/server/src/gameHandlers.ts

key-decisions:
  - 'Payload validation, ownership (WRONG_TEAM), and phase-guard (WRONG_PHASE) live at the handler layer as defence-in-depth; every applySubstitution rejection reason (SUB_CAP_REACHED, ALREADY_SUBBED, CANNOT_SUB_RED_CARD, CANNOT_SUB_IN_RED_CARDED, INVALID_SUBSTITUTE, GK_SLOT_REQUIRES_GK, NON_GK_SLOT_REJECTS_GK) is re-emitted verbatim, never remapped'
  - 'Team resolution uses socketTeam(socket), never isActivePlayer -- substitution is not turn-bound; either manager may act during any of the 15 STOPPAGE_PHASES regardless of activeTeam'
  - "No bench inspection/mutation added to the handler -- bench is written only by LINEUP_CONFIRM seeding (40-04), applySubstitution (40-02), and the red-card branch (40-04); an empty bench falls through to the engine's INVALID_SUBSTITUTE untouched (D-12)"

patterns-established:
  - "New socket handlers wrap kick-off/goal-reset pieces arrays in applyRosterContinuity wherever buildKickOffPieces is called from a handler (not just from gameEngine.ts), matching plan 40-04's in-engine precedent"

requirements-completed: [SUB-01, SUB-02, SUB-03, SUB-06, SUB-07, SETTINGS-04]

# Metrics
duration: ~20min
completed: 2026-08-16
---

# Phase 40 Plan 05: GAME_SUBSTITUTION Handler & Goal-Reset Roster Continuity Summary

**Socket-layer `GAME_SUBSTITUTION` handler enforcing SUB-01's "any stoppage, either manager" rule server-side via the shared `isStoppagePhase` allow-list, plus `applyRosterContinuity` wired into the three handler-side kick-off/goal-reset sites so a goal can never resurrect a substituted-out or red-carded player.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Registered `GAME_SUBSTITUTION` on the socket layer following the project's universal mutex -> phase-guard -> team-guard -> pure-delegate -> broadcast handler shape, gated on the shared `STOPPAGE_PHASES`/`isStoppagePhase` list (never a locally re-declared array)
- Every `SubstitutionRejection` reason from `applySubstitution` — including D-13's `CANNOT_SUB_IN_RED_CARDED` — now reaches the client verbatim as a distinct `GAME_ERROR`
- Closed the last three roster-continuity gaps: the three handler-side goal-reset sites (SNAPSHOT_DEFLECT end-turn goal, declared-shot GK-out-of-range goal, header GK-out-of-range goal) now overlay live roster identity/match-state onto the freshly-rebuilt kick-off pieces array via `applyRosterContinuity`, matching the four in-engine call sites plan 40-04 already wired
- 43-test socket-level integration suite (RED -> GREEN across Tasks 1-2, one additional regression added in Task 3) covers the full SUB-01..07/SETTINGS-04/D-12/D-13 threat surface for this handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — create gameHandlers.substitution.test.ts in the RED state** - `bca2f96` (test)
2. **Task 2: Implement the GAME_SUBSTITUTION handler** - `5def2a2` (feat)
3. **Task 3: Apply roster continuity at the three handler-side goal resets** - `b54f269` (fix)

_Note: Task 1 is the RED state of this plan's TDD-flavored spec-then-implement flow (not a formally `tdd="true"`-flagged task, but followed the same red/green discipline); Task 2 is GREEN._

## Files Created/Modified

- `packages/server/src/__tests__/gameHandlers.substitution.test.ts` - 43-test socket-level spec: 15-phase STOPPAGE_PHASES sweep (parametrized, not hand-copied), 5-phase WRONG_PHASE sweep, either-manager success, WRONG_TEAM ownership guard, 6 malformed-payload cases, all 7 engine rejection reasons, D-12 empty-bench, double-emit mutex, SC-5 finally-release, broadcast eventLog-tail shape, SETTINGS-04 toggle-off/toggle-on parity, and a Task 3 substitute-then-goal roster-continuity regression
- `packages/server/src/gameHandlers.ts` - new `GAME_SUBSTITUTION` handler (~75 lines) registered after `GAME_UNDO`; `applyRosterContinuity` import added and wrapped around all three `buildKickOffPieces(...)` call sites at the handler-side goal resets

## Decisions Made

- Ownership check (`outPiece.teamId !== team` -> `WRONG_TEAM`) is handled at the socket layer before ever calling `applySubstitution`, even though the engine re-checks — this is explicit defence-in-depth per the plan's threat model (T-40-15), and it also means a WRONG_TEAM opponent-piece attempt never reaches `INVALID_SUBSTITUTE` in the engine's own guard order
- Payload validation rejects non-object payloads and non-string/empty `outPieceId`/`inPlayerId` with `INVALID_SUBSTITUTE` before any state lookup, so a malformed payload can never throw inside the socket callback (T-40-17)
- Kept the roster-continuity fix's live-state expression consistent with what each of the three pre-existing goal-reset call sites already had in scope (`baseSnapState.pieces`, `declaredState.pieces`, `headerTargetState.pieces`) rather than introducing a new shared variable — minimizes the diff and matches the single-hoist BUG-30 invariant already documented at each site

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Formatting] Plan's literal single-line grep for Task 3's acceptance criteria does not survive the project's enforced Prettier `printWidth: 100`**

- **Found during:** Task 3 (roster continuity wiring)
- **Issue:** The plan's acceptance criteria specifies `grep -c "applyRosterContinuity(buildKickOffPieces" packages/server/src/gameHandlers.ts` should return 3. Prettier (enforced via the project's lint-staged pre-commit hook) reformats each nested call across multiple lines (`applyRosterContinuity(` on its own line, `buildKickOffPieces(...)` indented below it) at all three sites, since the combined call text exceeds the 100-char print width once properly indented — so the literal single-line substring never appears in the committed file.
- **Fix:** Verified the acceptance criteria's semantic intent instead: `grep -c "applyRosterContinuity("` returns 3 (one per goal-reset site), and the total `buildKickOffPieces(` call count in the file is unchanged from before this task (still 3, one nested inside each `applyRosterContinuity` call). Did not add `// prettier-ignore` comments to force single-line formatting, since that would introduce an inconsistent formatting exception across otherwise-identically-styled code for the sole purpose of satisfying a grep string.
- **Files modified:** packages/server/src/gameHandlers.ts (no additional changes beyond the already-planned wrapping)
- **Committed in:** b54f269 (Task 3 commit, deviation noted in commit message)

---

**Total deviations:** 1 auto-fixed (1 formatting/tooling-boundary note, no functional impact)
**Impact on plan:** None on correctness or scope — the underlying code change matches the plan's intent exactly; only the exact grep syntax used to verify it needed adjusting for the project's own enforced code style.

## Issues Encountered

- This worktree's `node_modules` was missing on first run (`pnpm --filter ... test` failed with "vitest not recognized"); resolved with a real `pnpm install` (resolves from the shared pnpm content-addressable store, ~3 min) per the parallel-execution instructions — no Windows junction/symlink workaround was used.
- `packages/shared`'s `dist/` was stale/absent after install, causing Vite to fail resolving `@counter-attack/shared`'s package exports; resolved by running `pnpm --filter @counter-attack/shared build` once before running server tests.
- One `pnpm --filter @counter-attack/server test` run hit the known Windows vitest worker-crash flake ("Worker exited unexpectedly", Tinypool) noted in project memory; re-ran with `--pool=forks` and the full suite passed cleanly (55 files / 1403 tests). No test or handler code was implicated — a re-run confirmed the flake was environmental, not a regression.
- Plan 40-04 (bench seeding at `LINEUP_CONFIRM`) runs in the same wave (wave 3) as this plan and was not present in this worktree, so `gameHandlers.substitution.test.ts` seeds `bench`/`subsUsed`/`playerId` directly on `room.gameState` after a real room/lineup socket flow (mirroring `gameEngine.substitution.test.ts`'s BASE_PIECES/bench fixture approach from plan 40-02), exactly as the plan's Task 1 action instructed. No dependency on 40-04's changes was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `GAME_SUBSTITUTION` is now the authoritative, fully-tested substitution entry point on the server; the client-side substitution UI (plan 40-03, `LineupAssignmentScreen` mid-match mode) can wire its `onSubstitute` callback directly to this event with confidence every rejection reason surfaces distinctly
- All seven kick-off/goal-reset sites across the server (4 in-engine from 40-04, 3 handler-side from this plan) now preserve the live roster — no remaining roster-continuity gaps for goal resets
- `pnpm test` is green across all three packages (shared 17 files/839 tests, server 55 files/1403 tests, client 34 files/978 tests) — no regressions introduced
- No blockers for plans 40-06/40-07

---

_Phase: 40-substitutions_
_Completed: 2026-08-16_

## Self-Check: PASSED

- FOUND: packages/server/src/**tests**/gameHandlers.substitution.test.ts
- FOUND: packages/server/src/gameHandlers.ts
- FOUND: .planning/phases/40-substitutions/40-05-SUMMARY.md
- FOUND: commit bca2f96 (test: RED)
- FOUND: commit 5def2a2 (feat: GREEN)
- FOUND: commit b54f269 (fix: roster continuity)
