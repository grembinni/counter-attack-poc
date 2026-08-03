---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 01
subsystem: game-engine
tags: [typescript, vitest, hex-grid, ball-state, out-of-bounds]

# Dependency graph
requires: []
provides:
  - 'packages/shared/src/outOfBounds.ts: classifyExit / classifyOutOfBounds / bylineOwner / resolveThrowInHex pure functions'
  - 'BallState.lastTouchedBy required field on every ball construction site (shared/server/client)'
affects: [37-02, 37-03, 37-04, 37-05, 38-corner-kick]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'outOfBounds.ts follows the scoreUtils.ts pure-function, side-effect-free module pattern'
    - 'BallState.lastTouchedBy is a required (non-optional) field so the compiler surfaces every construction site'
    - 'ActionEvent.ballAfter intentionally stays the narrow {position, carrierId} shape; never widened to carry lastTouchedBy'

key-files:
  created:
    - packages/shared/src/outOfBounds.ts
    - packages/shared/src/outOfBounds.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/index.ts
    - packages/shared/src/offside.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/client/src/mock/mockMovementState.ts
    - '23 test fixture files across shared/server/client (mechanical lastTouchedBy: null addition)'

key-decisions:
  - 'classifyExit checks qOut before rOut so an ambiguous double-boundary exit (both axes out of range) defaults to BYLINE, per D-05'
  - 'lastTouchedBy per-site semantics: carrier gain -> new carrier; kicker leaves ball with no receiver -> kicker; deflection/GK save/parry -> deflecting piece; LOOSE_BALL landing on occupant -> occupant else carry forward; header resolution -> winning contestant (attacker on tie) else carry forward; pure resets (kick-off/half-time/replay seed) -> null'
  - 'buildReplayFrames and the successful-tackle/steal MOVE-event correction sites keep ActionEvent.ballAfter narrow ({position, carrierId}) even though the source BallState now carries lastTouchedBy — avoids a second mass edit across every event construction site (plan directive)'

requirements-completed: [OOB-01, OOB-02, OOB-04]

# Metrics
duration: 48min
completed: 2026-08-03
---

# Phase 37 Plan 01: Out-of-Bounds Classification Module + BallState.lastTouchedBy Summary

**Pure `classifyExit`/`classifyOutOfBounds`/`bylineOwner`/`resolveThrowInHex` geometry module plus a required `BallState.lastTouchedBy` field threaded through every ball-construction site in the monorepo (server, shared, client).**

## Performance

- **Duration:** 48 min
- **Started:** 2026-08-03T16:30:16-05:00
- **Completed:** 2026-08-03T17:18:20-05:00
- **Tasks:** 3 (Task 1 followed RED/GREEN TDD gates)
- **Files modified:** 30 (2 created, 28 modified)

## Accomplishments

- `packages/shared/src/outOfBounds.ts` created with exactly the 6 exports the plan/PATTERNS.md contract specifies (`OutOfBoundsExit`, `OutOfBoundsRestart`, `classifyExit`, `bylineOwner`, `classifyOutOfBounds`, `resolveThrowInHex`), barrel-exported from `packages/shared/src/index.ts`, 16 new unit tests all green
- `BallState.lastTouchedBy: { pieceId: string; teamId: 'home' | 'away' } | null` added as a **required** field, forcing the compiler to surface every construction site across the monorepo
- Every production `ball: {...}` literal in `gameEngine.ts` (44 refs) and `gameHandlers.ts` (15 refs), plus `offside.ts`'s FREE_KICK_SETUP reset, updated with semantically-correct per-site toucher logic
- Discovered and fixed a genuine turnover-tracking gap during full-suite regression testing: `applyMove`'s successful STEAL_ATTEMPT/TACKLE_ATTEMPT branches were carrying the pre-turnover `lastTouchedBy` forward instead of crediting the new carrier (defender) — fixed both branches
- Full monorepo (shared + server + client) type-checks and builds clean; test suite grew from 1,738 to 1,754 (16 new `outOfBounds.test.ts` cases), zero regressions

## Task Commits

Each task was committed atomically (Task 1 followed the plan's `tdd="true"` RED→GREEN cycle):

1. **Task 1 (RED): failing test for out-of-bounds classification** - `c00f91a` (test)
2. **Task 1 (GREEN): implement out-of-bounds classification module** - `9162ad1` (feat)
3. **Task 2: add required BallState.lastTouchedBy and update production sites** - `4416db2` (feat)
4. **Task 3: update all test fixtures + fix steal/tackle turnover gap** - `bfb9679` (test)

_TDD Gate Compliance: RED commit (`c00f91a`) confirmed failing (module did not exist) before the GREEN commit (`9162ad1`) — gate sequence intact._

## Files Created/Modified

- `packages/shared/src/outOfBounds.ts` - `classifyExit`/`bylineOwner`/`classifyOutOfBounds`/`resolveThrowInHex` pure functions
- `packages/shared/src/outOfBounds.test.ts` - 16 unit tests covering every `<behavior>` case plus determinism
- `packages/shared/src/index.ts` - barrel export for the new module
- `packages/shared/src/types.ts` - `BallState.lastTouchedBy` required field
- `packages/shared/src/offside.ts` - FREE_KICK_SETUP ball reset carries `lastTouchedBy` forward
- `packages/server/src/gameEngine.ts` - 44 `lastTouchedBy` sites across MOVE/PASS/SHOT/HEADER/LOOSE_BALL/GK_RESTART/replay reconstruction; steal/tackle turnover fix
- `packages/server/src/gameHandlers.ts` - 15 `lastTouchedBy` sites across FIRST_TIME_PASS delivery, GK_KICK_MOVE, SNAPSHOT/shot deflection, kick-off transitions
- `packages/client/src/mock/mockMovementState.ts` - dev mock fixture field added
- 23 test fixture files (`gameEngine.*.test.ts`, `gameHandlers.*.test.ts`, `offside.test.ts`, `shotGkRange.test.ts`, `roomStore.test.ts`, `replay.integration.test.ts`, `game.integration.test.ts`, `moveValidator.test.ts`, `passValidator.test.ts`, `snapshotValidator.test.ts`, `headingValidator.test.ts`, `ActionPanel.test.tsx`, `HexGrid.test.tsx`) - mechanical `lastTouchedBy: null` addition to every `ball: {...}` / `const ball = {...}` fixture

## Decisions Made

- **D-05 (byline priority):** `classifyExit` checks `qOut` before `rOut`, so a hex out of bounds on both axes (corner of the bounding rectangle) resolves to `'BYLINE'`, never `'SIDELINE'`.
- **Per-site `lastTouchedBy` semantics** (documented in code comments at each site): carrier gain → new carrier; kicker leaves ball with no immediate receiver (HIGH_PASS/FTP in-flight, GK punt/kick, LONG_BALL/HIGH_PASS inaccurate) → kicker; deflection (SNAPSHOT_DEFLECT, shot-path deflection, GK save/spill) → deflecting/saving piece; LOOSE_BALL scatter landing on an occupant → occupant, else carry forward; header resolution → winning contestant (attacker on a tie, since `attackerPiece` is guaranteed defined in the contested-duel branch), else carry forward; pure resets (kick-off, half-time, replay seed state) → `null`.
- **`ActionEvent.ballAfter` stays narrow:** even though `BallState` now has 3 fields, every `ballAfter` assignment (including the two MOVE-event correction sites for successful steal/tackle turnovers, and `buildReplayFrames`'s universal `event.ballAfter` assignment) is deliberately narrowed back to `{position, carrierId}` — this was an explicit plan directive to avoid a second mass edit across every `ActionEvent` construction site, since replay reconstruction doesn't need per-step toucher fidelity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `packages/client/src/mock/mockMovementState.ts` missed by Task 2's file list**

- **Found during:** Task 3 full-monorepo typecheck
- **Issue:** This client dev-mock fixture (listed in the plan's `files_modified` frontmatter but not called out in Task 2's action steps) has a `ball: {...}` literal that failed to compile once `lastTouchedBy` became required.
- **Fix:** Added `lastTouchedBy: null` (a mock/dev fixture, not live gameplay state — matches the "genuinely fresh state" rule).
- **Files modified:** `packages/client/src/mock/mockMovementState.ts`
- **Committed in:** `bfb9679` (Task 3 commit)

**2. [Rule 1 - Bug] `applyMove`'s successful STEAL_ATTEMPT/TACKLE_ATTEMPT turnover branches did not credit the new carrier as last toucher**

- **Found during:** Task 3 full-suite regression run (`replay.integration.test.ts` failures exposed the gap)
- **Issue:** `tackleSuccessBall`/`stealSuccessBall` were built via `{ ...state.ball, position: to, carrierId: <new carrier> }` — the spread carried the OLD `lastTouchedBy` forward instead of crediting the tackling/stealing defender who just won possession. This is exactly the D-06 case the plan flagged as "must not be skipped" (a missed site is a wrong-team restart award, not a crash).
- **Fix:** Both branches now explicitly set `lastTouchedBy: { pieceId, teamId }` to the new carrier. Additionally narrowed the two MOVE-event "corrected ballAfter" rewrites (Pitfall 3 pattern) back to `{position, carrierId}` so the wider `BallState` shape doesn't leak onto `ActionEvent.ballAfter` (consistent with the plan's explicit "do not widen `ballAfter`" directive for `buildReplayFrames`).
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** Full server suite re-run green (642/642, 1 skipped, 1 todo — matches baseline exactly)
- **Committed in:** `bfb9679` (Task 3 commit)

**3. [Rule 1 - Bug] A handful of pre-existing test assertions needed value updates, not just field additions**

- **Found during:** Task 3 full-suite regression run
- **Issue:** 10 assertions in `gameEngine.test.ts`, `offside.test.ts`, and `replay.integration.test.ts` used strict `toEqual({...})` against a literal `ball` object that is now a semantically-updated `BallState` (e.g. `applyGKKickTarget`'s punt now records the GK as last toucher; `applyFreeKickReady` stage-3 finalize now records the kicker; `triggerOffsideFoul`'s pure repositioning now carries `lastTouchedBy` forward from the fixture's `null`; replay frame reconstruction seeds `lastTouchedBy: null`).
- **Fix:** Updated each assertion's expected value to match the new, semantically-correct `BallState` shape. No assertion's _behavioral intent_ changed — only the expected value grew a `lastTouchedBy` field consistent with the engine change.
- **Files modified:** `packages/server/src/__tests__/gameEngine.test.ts`, `packages/server/src/__tests__/offside.test.ts`, `packages/server/src/__tests__/replay.integration.test.ts`
- **Verification:** Full monorepo suite green (shared 629, server 642, client 483 — 1,754 total)
- **Committed in:** `bfb9679` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 test-assertion follow-through from the bugs)
**Impact on plan:** All fixes are within Task 2/3's stated correctness scope (`BallState.lastTouchedBy` must be semantically correct at every site — a missed site is a wrong-team restart award). No scope creep; no architectural changes.

## Issues Encountered

- **Worktree had no `node_modules`.** The worktree directory had never had `pnpm install` run in it (main repo's `node_modules` is not shared/junctioned into worktrees in this setup). Ran `pnpm install --frozen-lockfile` scoped to the worktree root before any test could execute — this created the worktree's own `node_modules` without touching the main repo's.
- **Transient "Worker exited unexpectedly" vitest error** on one full-monorepo `pnpm -r test` run (2 server test files didn't get to run). Re-ran `pnpm test` in `packages/server` alone immediately after — all 33 files / 642 tests passed cleanly. Treated as infra flakiness, not a real regression (confirmed by the clean re-run).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `classifyExit`/`bylineOwner`/`classifyOutOfBounds`/`resolveThrowInHex` are exported from `@counter-attack/shared` and ready for Plan 37-04's LOOSE_BALL clamp-site hook.
- `BallState.lastTouchedBy` is populated correctly at every production contact site (carrier changes, deflections, header contact, GK saves/parries/punts, loose-ball landings, and now — after the Task 3 bugfix — successful steal/tackle turnovers), so Plan 37-04's restart-award decision has a trustworthy single source of truth.
- Total test count recorded for regression tracking: **shared 629 / server 642 (1 skipped, 1 todo) / client 483 = 1,754 tests total, all green.** Later plans in this phase should expect this as their baseline.
- No blockers for Plan 37-02 (new `GamePhase`/`LastActionType`/`ActionEventType` values) or Plan 37-03 (`Room.outOfBoundsEnabled`) — neither depends on anything left incomplete here.

## Threat Flags

None — this plan's threat model was fully addressed as specified (T-37-01/T-37-02 mitigated by construction: `lastTouchedBy` is server-only-written and never accepted from client input; `outOfBounds.ts` remains pure and side-effect-free). No new network endpoints, auth paths, or trust-boundary changes were introduced beyond what the plan's threat register already covers.

## Known Stubs

None. Every artifact the plan's `must_haves` section requires is fully wired (not stubbed): `classifyExit`/`classifyOutOfBounds`/`bylineOwner`/`resolveThrowInHex` are complete pure functions with full test coverage, and `BallState.lastTouchedBy` is a required, non-optional field populated everywhere.

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Plan: 01_
_Completed: 2026-08-03_
