---
phase: 43-tackle-steal-prompt-decline
plan: 03
subsystem: game-settings
tags: [socket-events, room-state, game-engine, settings-ui, testing, tackle, steal]
dependency-graph:
  requires:
    - phase: 43-01
      provides: GameState.tackleStealDeclineEnabled field declaration, GamePhase.TACKLE_STEAL_PROMPT, ActionEventType.TACKLE_STEAL_DECLINED
    - phase: 43-02
      provides: TACKLE_STEAL_PROMPT/TACKLE_STEAL_DECLINED registration-checklist completeness
  provides:
    - ROOM_SETTINGS_CONFIRM payload field tackleStealDecline (required boolean)
    - ROOM_SETTINGS_CONFIRMED trailing positional tackleStealDecline argument
    - Room.tackleStealDeclineEnabled field
    - INVALID_TACKLE_STEAL_DECLINE ASVS V5 allow-list guard
    - buildInitialGameState trailing tackleStealDeclineEnabled parameter (default false)
    - GameSettingsScreen "Tackle/Steal Decline Prompt" checkbox (default checked)
  affects:
    - 43-04 (engine logic that branches on state.tackleStealDeclineEnabled === true)
    - 43-05 (GAME_TACKLE_STEAL_CHOICE socket handler)
tech-stack:
  added: []
  patterns:
    - 'Toggle wiring mirrors outOfBoundsEnabled byte-for-byte: client-default-ON checkbox / server-default-OFF buildInitialGameState parameter, independent allow-list guard per field, dedicated error-reason string'
key-files:
  created: []
  modified:
    - packages/shared/src/events.ts
    - packages/server/src/roomStore.ts
    - packages/server/src/roomHandlers.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.substitution.test.ts
    - packages/client/src/components/GameSettingsScreen.tsx
    - packages/client/src/App.tsx
    - packages/server/src/__tests__/testHelpers.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/server/src/__tests__/draftReconnect.integration.test.ts
    - packages/server/src/__tests__/draftSession.integration.test.ts
    - packages/server/src/__tests__/gameHandlers.substitution.test.ts
    - packages/server/src/__tests__/substitution.integration.test.ts
    - packages/client/src/App.test.tsx
    - packages/client/src/components/GameSettingsScreen.test.tsx
decisions:
  - "tackleStealDeclineEnabled inserted between injuryEnabled and homeBench in buildInitialGameState's positional signature (matching the plan's exact requirement) — every existing call site passing bench arrays explicitly had to be updated for the shift, not just the plan's own LINEUP_CONFIRM call site"
  - 'Replay-frame construction (gameEngine.ts ~line 10038) deliberately does NOT carry tackleStealDeclineEnabled — replay reconstructs from ballAfter and never re-enters TACKLE_STEAL_PROMPT, so threading the toggle would be dead state; documented with a one-line comment per the plan'
  - "Mechanical test migration used tackleStealDecline: false everywhere except App.test.tsx/GameSettingsScreen.test.tsx cases exercising the client's default-ON checkbox behavior, which correctly assert true"
requirements-completed: [TACKLE-01, TACKLE-04]
metrics:
  duration: ~55min
  completed: 2026-08-23
---

# Phase 43 Plan 03: Tackle/Steal Decline Toggle Wiring Summary

Wired the TACKLE-01 game-creation toggle end to end — a checked-by-default "Tackle/Steal Decline Prompt" checkbox on `GameSettingsScreen.tsx` flows through `ROOM_SETTINGS_CONFIRM`, an ASVS V5 allow-list guard, `Room.tackleStealDeclineEnabled` storage, the `ROOM_SETTINGS_CONFIRMED` echo (host + late-joiner), and lands on `GameState.tackleStealDeclineEnabled` via a new `buildInitialGameState` parameter that defaults to `false` — mirroring `outOfBoundsEnabled`'s established client-default-ON / server-default-OFF split exactly, with zero consumers yet (TACKLE-04 preserved by construction).

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Shared event contract (`events.ts`) gained the required `tackleStealDecline` field on `ROOM_SETTINGS_CONFIRM` and the matching trailing positional argument on `ROOM_SETTINGS_CONFIRMED`.
- `Room.tackleStealDeclineEnabled`, the `INVALID_TACKLE_STEAL_DECLINE` allow-list guard (placed before any room mutation, after the existing `INVALID_INJURY` guard), storage, and both `ROOM_SETTINGS_CONFIRMED` emit sites (host echo + late-joiner) are live in `roomHandlers.ts`.
- `buildInitialGameState` gained a `tackleStealDeclineEnabled: boolean = false` trailing parameter (inserted between `injuryEnabled` and `homeBench`) and assigns it onto the returned `GameState`; replay-frame construction deliberately omits it with a documented rationale.
- `GameSettingsScreen.tsx` renders a "Tackle/Steal Decline Prompt" checkbox, checked by default, threaded into `handleConfirm`'s payload with no normalization (no parent-toggle dependency); `App.tsx` forwards the field and discards the `ROOM_SETTINGS_CONFIRMED` echo's trailing argument as dead state, matching the existing Fouls/Booking/Injury precedent.
- Every pre-existing `ROOM_SETTINGS_CONFIRM` emit payload across 7 test files was mechanically migrated to include `tackleStealDecline` (32 sites total, verified equal to the pre-existing `injury:` baseline count); new coverage added for the `INVALID_TACKLE_STEAL_DECLINE` rejection, `buildInitialGameState`'s default/explicit `tackleStealDeclineEnabled` values, and the checkbox's checked-by-default render + unchecked-payload behavior.

## Task Commits

1. **Task 1: Thread the toggle through events, Room storage, validation and buildInitialGameState** - `243fecba` (feat)
2. **Task 2: Add the settings-screen checkbox (default ON) and the App.tsx wiring** - `50269464` (feat)
3. **Task 3: Migrate every existing ROOM_SETTINGS_CONFIRM emit payload and add toggle tests** - `94006621` (test)

## Files Created/Modified

- `packages/shared/src/events.ts` - `tackleStealDecline` field/positional arg added to `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED`
- `packages/server/src/roomStore.ts` - `Room.tackleStealDeclineEnabled?: boolean` field
- `packages/server/src/roomHandlers.ts` - destructure/type/guard/storage/both emits/LINEUP_CONFIRM call site all threaded
- `packages/server/src/gameEngine.ts` - `buildInitialGameState` trailing parameter + `GameState` assignment; replay-frame omission documented
- `packages/server/src/__tests__/gameEngine.substitution.test.ts` - two explicit-bench `buildInitialGameState` calls updated for the new positional argument (Rule 3 fix, not in plan's file list)
- `packages/client/src/components/GameSettingsScreen.tsx` - checkbox, state, payload field
- `packages/client/src/App.tsx` - `handleSettingsConfirm` type + discarded `_confirmedTackleStealDecline` param
- `packages/server/src/__tests__/testHelpers.ts`, `room.integration.test.ts`, `draftReconnect.integration.test.ts`, `draftSession.integration.test.ts`, `gameHandlers.substitution.test.ts`, `substitution.integration.test.ts` - mechanical `tackleStealDecline: false` migration + new server-side test coverage
- `packages/client/src/App.test.tsx`, `packages/client/src/components/GameSettingsScreen.test.tsx` - payload assertions updated + new checkbox behavior tests

## Decisions Made

- `tackleStealDeclineEnabled` positioned between `injuryEnabled` and `homeBench` in `buildInitialGameState`'s signature, per the plan's explicit instruction — this shifted the positional slot of `homeBench`/`awayBench`, which broke two out-of-plan-scope calls in `gameEngine.substitution.test.ts` that passed bench arrays explicitly (fixed under Rule 3, see Deviations).
- Replay-frame construction intentionally does not carry `tackleStealDeclineEnabled` (documented one-line comment) — consistent with the existing precedent that `foulsEnabled`/`bookingEnabled`/`injuryEnabled` are also absent from that same replay-frame object.
- Test migration comment wording avoided the literal substring `tackleStealDecline` in the new INVALID-payload test's eslint-disable comment, keeping the mechanical-migration verification count exactly symmetric with the `injury:`-anchored baseline the plan's acceptance criteria specifies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed two `gameEngine.substitution.test.ts` `buildInitialGameState` calls broken by the new positional parameter**

- **Found during:** Task 1, `pnpm -r typecheck` verification
- **Issue:** `gameEngine.substitution.test.ts` (not in this plan's `files_modified` list) has two tests that call `buildInitialGameState` with the four toggle booleans followed directly by explicit `homeBenchBase`/`awayBenchBase` or `[]`/`[]` bench arrays. Inserting `tackleStealDeclineEnabled` before `homeBench` shifted the bench arguments one position to the right, so TypeScript reported `BenchEntry[]`/`never[]` being passed where a `boolean | undefined` was expected.
- **Fix:** Added a fifth `false,` argument (the new toggle, off) immediately before the bench arrays at both call sites, preserving every existing assertion's behavior unchanged.
- **Files modified:** `packages/server/src/__tests__/gameEngine.substitution.test.ts`
- **Commit:** `243fecba` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 — blocking type error directly caused by this plan's own positional-parameter insertion, outside the plan's declared file list but required for `pnpm -r typecheck` to pass, which is this task's own acceptance criterion).
**Impact on plan:** The fix is a mechanical positional-argument update with no behavior change; no scope creep beyond restoring the pre-existing test's compileability.

## Issues Encountered

- Worktree had no `node_modules` at session start (fresh worktree checkout) — resolved with `pnpm install --frozen-lockfile` (global content-addressable pnpm store, does not touch the main checkout), consistent with the Worktree Junction Risk memory note; no directory junctions created or deleted.
- The mechanical-migration acceptance criterion (`grep -c tackleStealDecline` across 7 test files' `ROOM_SETTINGS_CONFIRM` emit call sites, `-A 10` window, must equal the same search for `injury:`) initially came up 33 vs 32 because the new `INVALID_TACKLE_STEAL_DECLINE` test's eslint-disable comment happened to contain the bare substring `tackleStealDecline` (the `injury:`-anchored baseline pattern excludes its own equivalent comment because it requires a trailing colon). Reworded the comment to avoid the literal field-name substring; counts now match exactly at 32/32.

## Next Phase Readiness

- The toggle is live end to end (checkbox → socket payload → allow-list validation → `Room` storage → both `ROOM_SETTINGS_CONFIRMED` echoes → `buildInitialGameState` → `GameState.tackleStealDeclineEnabled`) with zero consumers, matching this plan's own scope boundary.
- `pnpm -r test` (886 shared + 1512 server + 1121 client, all passing, 1 skipped/1 todo pre-existing and unrelated) and `pnpm -r typecheck` (shared/server/client all clean) both green.
- Ready for 43-04 (engine logic that first branches on `state.tackleStealDeclineEnabled === true`, making `TACKLE_STEAL_PROMPT` reachable) and 43-05 (the `GAME_TACKLE_STEAL_CHOICE` socket handler).

---

_Phase: 43-tackle-steal-prompt-decline_
_Completed: 2026-08-23_

## Self-Check: PASSED

- FOUND: packages/shared/src/events.ts
- FOUND: packages/server/src/roomStore.ts
- FOUND: packages/server/src/roomHandlers.ts
- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.substitution.test.ts
- FOUND: packages/client/src/components/GameSettingsScreen.tsx
- FOUND: packages/client/src/App.tsx
- FOUND: packages/server/src/**tests**/testHelpers.ts
- FOUND: packages/server/src/**tests**/room.integration.test.ts
- FOUND: packages/server/src/**tests**/draftReconnect.integration.test.ts
- FOUND: packages/server/src/**tests**/draftSession.integration.test.ts
- FOUND: packages/server/src/**tests**/gameHandlers.substitution.test.ts
- FOUND: packages/server/src/**tests**/substitution.integration.test.ts
- FOUND: packages/client/src/App.test.tsx
- FOUND: packages/client/src/components/GameSettingsScreen.test.tsx
- FOUND commit 243fecba in git log
- FOUND commit 50269464 in git log
- FOUND commit 94006621 in git log
