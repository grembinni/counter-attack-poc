---
phase: 27-game-creation-settings
plan: 02
subsystem: api
tags: [socket.io, room-lifecycle, tdd, race-condition, allow-list]

# Dependency graph
requires:
  - phase: 27-game-creation-settings (plan 01)
    provides: TeamType/DraftPoolId/SELECTABLE_DRAFT_POOLS shared types and the ROOM_SETTINGS_CONFIRM/ROOM_SETTINGS_CONFIRMED typed event pair
provides:
  - Server-side ROOM_SETTINGS_CONFIRM handler (host-only, one-shot lock, allow-list validated)
  - Room.teamType / Room.draftPools / Room.settingsConfirmed fields
  - Both-conditions gate on TEAM_SELECTION_START (settingsConfirmed && players[1] !== null) closing the settings-confirmed/joiner-present race
  - Join-time delivery of ROOM_SETTINGS_CONFIRMED to a late-joining player (D-02)
affects: [27-03-game-settings-screen, 27-04-readonly-speed-subheaders, draft-mode-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Both-conditions race gate: two independently-arriving preconditions (settings confirmed, slot 2 joined) each check the other's flag before firing the shared next-phase broadcast, mirroring the existing LINEUP_CONFIRM both-confirm-flags pattern"
    - "Allow-list narrower than the type: SELECTABLE_DRAFT_POOLS (3 values) validates DraftPoolId (5-value type) server-side, so a broader TS type doesn't imply a broader trust boundary"

key-files:
  created: []
  modified:
    - packages/server/src/roomStore.ts
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/server/src/__tests__/game.integration.test.ts
    - packages/server/src/__tests__/gameHandlers.test.ts
    - packages/server/src/__tests__/gameHandlers.phase10.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts
    - packages/server/src/__tests__/gameHandlers.phase18-02.test.ts
    - packages/server/src/__tests__/gameHandlers.rule11.test.ts
    - packages/server/src/__tests__/kickoffSetup.integration.test.ts
    - packages/server/src/__tests__/lineupAssignment.integration.test.ts
    - packages/server/src/__tests__/replay.integration.test.ts
    - packages/server/src/__tests__/shotGkRange.test.ts

key-decisions:
  - "SETTINGS_ALREADY_CONFIRMED guard runs before the host-only guard, so a re-confirm attempt after lock returns the lock error even if the sender is not the host (matches the plan's specified guard order)"
  - "Every pre-existing server integration test helper that drove ROOM_JOIN expecting an unconditional TEAM_SELECTION_START was updated to emit ROOM_SETTINGS_CONFIRM (standard/standard/[]) immediately after ROOM_CREATE, before the joiner connects — preserves each test's original timing/assertions under the new both-conditions gate"

patterns-established:
  - "Pattern 1: host-authenticated settings confirm clones TEAM_SPEED_SET's exact guard shape (roomCode lookup -> room lookup -> lock guard -> host-only guard -> game-started guard -> allow-list validation) rather than introducing a new abstraction"

requirements-completed: [DRAFT-01]

# Metrics
duration: ~20min
completed: 2026-07-20
---

# Phase 27 Plan 02: ROOM_SETTINGS_CONFIRM Handler + Race-Gate Fix Summary

**Host-authenticated ROOM_SETTINGS_CONFIRM Socket.io handler with a both-conditions gate (settingsConfirmed && slot-2-joined) that closes the race where a fast-joining player could reach team selection before game settings exist.**

## Performance

- **Duration:** ~20 min (includes `pnpm install` + `@counter-attack/shared build` cold-start in the worktree)
- **Tasks:** 2 (TDD RED/GREEN pair)
- **Files modified:** 14 (2 source files, 12 test files)

## Accomplishments

- Added `teamType?`, `draftPools?`, and `settingsConfirmed?` fields to `Room` in `roomStore.ts`
- Implemented `ROOM_SETTINGS_CONFIRM` in `roomHandlers.ts`: settings-lock guard (`SETTINGS_ALREADY_CONFIRMED`) fires first, then host-only guard (`WRONG_TURN`), then `game.gameState !== null` freeze guard, then speed/teamType allow-lists, then conditional draft-pool validation (`DRAFT_POOL_REQUIRED` / `INVALID_DRAFT_POOL` against the 3-value `SELECTABLE_DRAFT_POOLS`, never the 5-value `DraftPoolId` type)
- Closed the settings-confirmed/joiner-present race: `TEAM_SELECTION_START` now only fires when both `room.settingsConfirmed` and `room.players[1] !== null` are true, checked symmetrically in `ROOM_SETTINGS_CONFIRM` (checks `players[1]`) and `ROOM_JOIN` (checks `settingsConfirmed`)
- `ROOM_JOIN` delivers `ROOM_SETTINGS_CONFIRMED` to a late-joining player carrying the host's already-confirmed settings (D-02) before firing `TEAM_SELECTION_START`
- Five new integration test cases in `room.integration.test.ts` covering host-only guard, draft-pool-required, standard-mode success + re-confirm lock, draft-pool allow-list, and the race gate in both event orderings (confirm-then-join and join-then-confirm)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing integration tests for ROOM_SETTINGS_CONFIRM (RED)** - `0694c0a` (test)
2. **Task 2: Add Room settings fields + ROOM_SETTINGS_CONFIRM handler + gated ROOM_JOIN emit (GREEN)** - `0312f15` (feat)

_Note: Task 2's commit also includes the 10 pre-existing test-helper fixes required to keep the full server suite green — see Deviations below._

## Files Created/Modified

- `packages/server/src/roomStore.ts` - `Room.teamType`, `Room.draftPools`, `Room.settingsConfirmed` fields
- `packages/server/src/roomHandlers.ts` - `ROOM_SETTINGS_CONFIRM` handler, `VALID_TEAM_TYPES` allow-list, gated `ROOM_JOIN` `TEAM_SELECTION_START` emit + join-time `ROOM_SETTINGS_CONFIRMED` delivery
- `packages/server/src/__tests__/room.integration.test.ts` - `ROOM_SETTINGS_CONFIRM` describe block (5 cases) + `assertEventNotEmitted` negative-event helper
- `packages/server/src/__tests__/game.integration.test.ts`, `gameHandlers.test.ts`, `gameHandlers.phase10.test.ts`, `gameHandlers.phase17.test.ts`, `gameHandlers.phase17-06.test.ts`, `gameHandlers.phase18-02.test.ts`, `gameHandlers.rule11.test.ts`, `kickoffSetup.integration.test.ts`, `lineupAssignment.integration.test.ts`, `replay.integration.test.ts`, `shotGkRange.test.ts` - each file's room-setup helper now confirms settings (`standard`/`standard`/`[]`) immediately after `ROOM_CREATE`, before the joiner connects, to preserve the pre-existing join-then-team-selection-start flow under the new gate

## Decisions Made

- Guard order in the confirm handler places the `SETTINGS_ALREADY_CONFIRMED` lock check before the host-only guard (matches the plan's explicit ordering instruction: lock-guard first-class per D-03, independent of who is attempting the re-confirm)
- Used a bounded-timeout negative-event helper (`assertEventNotEmitted`, 250ms default window) for the race test's "must NOT prematurely receive TEAM_SELECTION_START" assertions, since no existing negative-await pattern was present in the file to mirror

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing server test suite broke under the new both-conditions gate**

- **Found during:** Task 2 (running `pnpm --filter @counter-attack/server test` full suite, per plan's own `<verification>` requirement)
- **Issue:** 10 other test files (`game.integration.test.ts`, `gameHandlers.test.ts`, `gameHandlers.phase10.test.ts`, `gameHandlers.phase17.test.ts`, `gameHandlers.phase17-06.test.ts`, `gameHandlers.phase18-02.test.ts`, `gameHandlers.rule11.test.ts`, `kickoffSetup.integration.test.ts`, `lineupAssignment.integration.test.ts`, `replay.integration.test.ts`, `shotGkRange.test.ts`) each contain a `setupRoom`-style helper that drove `ROOM_CREATE` → `ROOM_JOIN` and awaited `TEAM_SELECTION_START` unconditionally — this was correct behavior before this plan, but the new gate defers `TEAM_SELECTION_START` until settings are confirmed, so every one of these helpers started timing out (131 tests failing across 11 files)
- **Fix:** Inserted a `ROOM_SETTINGS_CONFIRM` emit (`standard`/`standard`/`[]`) + await `ROOM_SETTINGS_CONFIRMED` immediately after `ROOM_CREATE` and before the joiner's `ROOM_JOIN` in each helper, so settings are already confirmed by the time the joiner arrives — restores each test's original timing and assertions unchanged
- **Files modified:** the 10 test files listed above (each edit is a same-shape 8-line insertion into an existing setup helper)
- **Verification:** `pnpm --filter @counter-attack/server test` — 29 files, 555 passed, 1 skipped, 1 todo; `pnpm --filter @counter-attack/server typecheck` exits 0
- **Committed in:** `0312f15` (Task 2 commit — grouped with the GREEN implementation since both are required for the plan's own full-suite-green verification gate)

---

**Total deviations:** 1 auto-fixed (1 bug — broad test-suite fallout from the intentional race-gate behavior change)
**Impact on plan:** Necessary for correctness — the plan's own `<verification>` section requires the full server suite green, and the race gate is the plan's central deliverable (T-27-05/Pitfall 1). No scope creep beyond restoring pre-existing test coverage to a passing state under the new (correct) behavior.

## Issues Encountered

None beyond the test-suite fallout documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` are fully wired server-side and ready for the client `GameSettingsScreen` (plan 27-03) to emit against
- `room.settingsConfirmed`/`room.teamType`/`room.draftPools` are available for the client-side settings summary work in plan 27-04
- `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` remain wired but are now dead code from the live client's perspective once plan 27-03 lands (flagged in RESEARCH.md as a follow-up cleanup, not required this phase)

---

_Phase: 27-game-creation-settings_
_Completed: 2026-07-20_

## Self-Check: PASSED

- FOUND: packages/server/src/roomStore.ts
- FOUND: packages/server/src/roomHandlers.ts
- FOUND: packages/server/src/**tests**/room.integration.test.ts
- FOUND commit: 0694c0a (test(27-02): add failing integration tests for ROOM_SETTINGS_CONFIRM)
- FOUND commit: 0312f15 (feat(27-02): implement ROOM_SETTINGS_CONFIRM handler and race-gate fix)
