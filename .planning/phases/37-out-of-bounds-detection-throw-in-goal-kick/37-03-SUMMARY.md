---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 03
subsystem: game-settings
tags: [typescript, vitest, socket.io, react, out-of-bounds, settings-toggle]

# Dependency graph
requires:
  - phase: 37-02
    provides: 'ROOM_SETTINGS_CONFIRM/ROOM_SETTINGS_CONFIRMED outOfBounds type contract with outOfBounds:false placeholders at every call site'
provides:
  - 'Room.outOfBoundsEnabled?: boolean settings field, validated as a boolean before any room mutation'
  - 'GameState.outOfBoundsEnabled populated from Room.outOfBoundsEnabled at LINEUP_CONFIRM, defaulting to false'
  - 'Host-facing "Out-of-Bounds / Restarts" checkbox on GameSettingsScreen, fully wired end to end'
affects: [37-04, 37-05, 37-06, 37-07, 37-08, 37-09, 37-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'outOfBoundsEnabled follows the exact gameSpeed/teamType precedent: Room settings field -> ROOM_SETTINGS_CONFIRM allow-list guard -> room mutation -> ROOM_SETTINGS_CONFIRMED broadcast (4th positional arg) -> ROOM_JOIN late-joiner echo -> buildInitialGameState parameter -> GameState field -> buildReplayFrames seed carry-through'
    - 'formatSettingsSummary null-return guard changed from "teamType === standard" to "teamType === standard && !outOfBounds" so a standard match with restarts on still surfaces a settings summary line'

key-files:
  created: []
  modified:
    - packages/server/src/roomStore.ts
    - packages/server/src/roomHandlers.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/roomStore.test.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/client/src/components/GameSettingsScreen.tsx
    - packages/client/src/components/GameSettingsScreen.test.tsx
    - packages/client/src/App.tsx
    - packages/client/src/constants/settingsSummary.ts

key-decisions:
  - 'roomStore.test.ts Wave-0 toggle coverage mirrors the ROOM_SETTINGS_CONFIRM handler mutation directly (room.outOfBoundsEnabled = true) rather than driving a real socket event, since roomStore.test.ts has no socket-server test infrastructure (only room.integration.test.ts does, which already covers the wire-level INVALID_OUT_OF_BOUNDS rejection case per the plan)'
  - 'formatSettingsSummary produces a segment list conditionally (Team Type/Draft Pool segments only in draft mode) rather than a fixed array, so the Restarts segment can be appended in both standard and draft mode without duplicating the join logic'
  - 'testHelpers.ts confirmDefaultRoomSettings already carried outOfBounds: false from the Plan 37-02 placeholder threading — no change needed for Task 2, since that placeholder is now the intentional default-off payload'

requirements-completed: [OOB-05, GOALKICK-06]

# Metrics
duration: 55min
completed: 2026-08-03
---

# Phase 37 Plan 03: Out-of-Bounds/Restarts Toggle Wiring Summary

**End-to-end plumbing of the host-facing "Out-of-Bounds / Restarts" checkbox: GameSettingsScreen -> ROOM_SETTINGS_CONFIRM (boolean allow-list guard) -> Room.outOfBoundsEnabled -> buildInitialGameState -> GameState.outOfBoundsEnabled, with zero gameplay behavior change since nothing reads the flag yet.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-03T~17:55:00 (approx, immediately following 37-02)
- **Completed:** 2026-08-03T18:11:00 (approx)
- **Tasks:** 3
- **Files modified:** 9 (0 created, 9 modified)

## Accomplishments

- `Room.outOfBoundsEnabled?: boolean` added to `roomStore.ts`, mirroring the `draftPools?`/`teamType?` settings-cluster precedent exactly
- `ROOM_SETTINGS_CONFIRM` handler destructures `outOfBounds`, validates it with a `typeof outOfBounds !== 'boolean'` ASVS V5 allow-list guard (`INVALID_OUT_OF_BOUNDS`) placed after the existing speed/teamType guards and before any room mutation, mutates `room.outOfBoundsEnabled`, and broadcasts it as the 4th positional arg of `ROOM_SETTINGS_CONFIRMED` (both the confirm broadcast and the `ROOM_JOIN` late-joiner echo)
- `buildInitialGameState` gains a 9th parameter `outOfBoundsEnabled: boolean = false`, sets it on the returned `GameState` literal, and `buildReplayFrames`' hand-built seed state carries `finalState.outOfBoundsEnabled ?? false` forward into replay frames
- Every `buildInitialGameState(` call site was audited (see full list below); the one production call site (`roomHandlers.ts` `LINEUP_CONFIRM`) now passes `room.outOfBoundsEnabled ?? false`; all test call sites were deliberately left on the default per the plan's own instruction (they assert pre-Phase-37 behavior and don't exercise the toggle)
- `GameSettingsScreen.tsx` gained a new "Restarts" section with the literal `Out-of-Bounds / Restarts` checkbox label, reusing the existing `.section`/`.sectionLabel`/`.poolRow` CSS-module classes with zero new CSS rules
- `App.tsx`'s `outOfBounds` local state is wired through `onRoomSettingsConfirmed`'s new 4th positional arg, `handleSettingsConfirm`, and `handleSettingsBack`'s stale-state reset
- `settingsSummary.ts`'s `formatSettingsSummary` gained a 4th `outOfBounds` parameter and a `Restarts: On/Off` summary segment; the standard-mode null-return guard now only fires when `teamType === 'standard' && !outOfBounds`, so a standard match with restarts enabled still surfaces a settings-summary line
- Full monorepo (shared/server/client) typechecks and tests clean: shared 635 (unchanged), server 647 (+5), client 486 (+3) = 1,768 tests total, all green

## Task Commits

1. **Task 1: Store the toggle on Room and validate the confirm payload** - `80b5529` (feat)
2. **Task 2: Bake the toggle into GameState via buildInitialGameState** - `639e067` (feat)
3. **Task 3: Add the Out-of-Bounds / Restarts checkbox to the Game Settings screen** - `d2140da` (feat)

## `buildInitialGameState` Call-Site Audit (Pitfall 5, required by plan Task 2)

| Call site                                                                       | File                                                          | Disposition                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LINEUP_CONFIRM` handler                                                        | `packages/server/src/roomHandlers.ts:859`                     | **Updated** — now passes `room.outOfBoundsEnabled ?? false` as the 9th argument (the only production call site)                                                               |
| `buildInitialGameState(...)` (4 calls)                                          | `packages/server/src/__tests__/gameEngine.phase24.test.ts`    | Left on default (`false`) — asserts Phase 24 lineup/auto-assignment behavior, not the toggle                                                                                  |
| `buildInitialGameState('ROOM8'/'ROOM9'/'ROOM10', ...)` (3 calls)                | `packages/server/src/__tests__/gameEngine.phase8.test.ts`     | Left on default — asserts Phase 8 match-lifecycle behavior                                                                                                                    |
| `buildInitialGameState('ROOM1'..'ROOM6', ...)` (7 calls)                        | `packages/server/src/__tests__/gameEngine.test.ts`            | Left on default — core engine regression suite, predates Phase 37                                                                                                             |
| `buildInitialGameState('ROOM1', { home: 'city', away: 'crew' }, ...)` (5 calls) | `packages/server/src/__tests__/gameEngine.teamselect.test.ts` | Left on default — asserts the 4-argument team-select signature explicitly (test file docstring says so); adding a 9th arg here would contradict the test's own stated purpose |
| `buildInitialGameState('TEST', ...)` (1 call)                                   | `packages/server/src/__tests__/kickoffDebug.test.ts`          | Left on default — kickoff-debug regression, unrelated to the toggle                                                                                                           |
| `export function buildInitialGameState(`                                        | `packages/server/src/gameEngine.ts:317`                       | The function declaration itself, not a call site                                                                                                                              |

Total: 21 call sites found via `grep -rn "buildInitialGameState(" packages/`. 1 production call site updated; 20 test call sites (all pre-existing, all asserting pre-Phase-37 behavior) deliberately left on the `false` default, consistent with the plan's explicit guidance.

## Files Created/Modified

- `packages/server/src/roomStore.ts` — `Room.outOfBoundsEnabled?: boolean` field with JSDoc documenting the `undefined` == disabled default and Phase 39 independence
- `packages/server/src/roomHandlers.ts` — `ROOM_SETTINGS_CONFIRM` destructures/validates/stores/broadcasts `outOfBounds`; `ROOM_JOIN` late-joiner echo passes `joinedRoom.outOfBoundsEnabled ?? false`; `LINEUP_CONFIRM`'s `buildInitialGameState` call passes `room.outOfBoundsEnabled ?? false`
- `packages/server/src/gameEngine.ts` — `buildInitialGameState`'s 9th parameter + returned-state field; `buildReplayFrames`' seed-state carry-through
- `packages/server/src/__tests__/roomStore.test.ts` — Wave-0 toggle coverage (default undefined, settings-confirm mutation reflected, `buildInitialGameState` true/default-false)
- `packages/server/src/__tests__/room.integration.test.ts` — forged non-boolean `outOfBounds` rejected with `INVALID_OUT_OF_BOUNDS` before any room mutation (T-37-08)
- `packages/client/src/components/GameSettingsScreen.tsx` — new Restarts checkbox section; `onConfirm` payload carries the live `outOfBounds` value
- `packages/client/src/components/GameSettingsScreen.test.tsx` — 3 new assertions (default unchecked, toggled confirm payload, untouched confirm payload)
- `packages/client/src/App.tsx` — `outOfBounds` local state threaded through `onRoomSettingsConfirmed`, `handleSettingsConfirm`, `handleSettingsBack`, and both `formatSettingsSummary` call sites
- `packages/client/src/constants/settingsSummary.ts` — `formatSettingsSummary` 4th parameter + `Restarts: On/Off` segment + revised null-return guard

## Deviations from Plan

None. Plan executed exactly as written across all three tasks. `packages/server/src/__tests__/testHelpers.ts`'s `confirmDefaultRoomSettings` already carried `outOfBounds: false` from Plan 37-02's placeholder threading — this satisfied Task 2's instruction with no additional edit required (verified via `grep -n "outOfBounds: false" packages/server/src/__tests__/testHelpers.ts`).

## Issues Encountered

- `node_modules` was absent in this worktree at session start (same setup step Plans 37-01/37-02 encountered) — resolved with `pnpm install --frozen-lockfile`.
- `packages/shared`'s `dist/` build output was also absent, causing `Cannot find module '@counter-attack/shared'` across the server package's typecheck — resolved by running `pnpm --filter @counter-attack/shared build` before the server typecheck. Not a plan deviation; standard worktree bootstrap.
- `exactOptionalPropertyTypes: true` (project tsconfig) rejected `outOfBoundsEnabled: finalState.outOfBoundsEnabled` in `buildReplayFrames`' seed state because `finalState.outOfBoundsEnabled`'s type is `boolean | undefined` while the target field is `boolean`. Fixed inline with `finalState.outOfBoundsEnabled ?? false` (Rule 1 — compile-blocking type error, trivial nullish-coalescing fix, no plan deviation worth separately documenting).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `Room.outOfBoundsEnabled`, `GameState.outOfBoundsEnabled`, and the host-facing checkbox are fully wired end to end. Plan 37-04 can now read `state.outOfBoundsEnabled` to gate the actual out-of-bounds classification hook — OOB-05's "disabled path unchanged" guarantee is enforceable because the flag reaches the engine reliably before any classification logic exists.
- The toggle defaults to `false` everywhere (Room field `undefined` treated as disabled, `buildInitialGameState`'s parameter default, client checkbox unchecked, `handleSettingsBack` reset) — no behavior change to any existing match when the toggle is left off.
- Total test count recorded for regression tracking: **shared 635 / server 647 (1 skipped, 1 todo) / client 486 = 1,768 tests total, all green.** Later plans in this phase should expect this as their baseline.

## Threat Flags

None. This plan's threat model (T-37-08 through T-37-11, T-37-SC) was addressed exactly as specified: T-37-08's `typeof outOfBounds !== 'boolean'` guard runs before any room mutation (proven by the new integration test asserting `settingsConfirmed` stays falsy on rejection); T-37-09's pre-existing host-only guard is untouched and still runs before the new validation; T-37-10's `settingsConfirmed`/`gameState !== null` guards still run before the new field write, and no handler in this plan writes `GameState.outOfBoundsEnabled` after match start; T-37-11 is inherently satisfied (server is the sole `GameState` constructor). No packages were installed (T-37-SC).

## Known Stubs

None. Every artifact this plan's `must_haves` section requires is fully wired and functional: the host sees and can toggle the checkbox; the value is stored on `Room`, echoed to the joiner, and baked into `GameState.outOfBoundsEnabled` at match start; the forged-payload guard runs before any mutation; the disabled path leaves `GameState.outOfBoundsEnabled === false` with zero existing-behavior change (nothing in this plan reads the flag for gameplay purposes — that's Plan 37-04's scope).

---

## Self-Check: PASSED

- FOUND: packages/server/src/roomStore.ts (outOfBoundsEnabled field present)
- FOUND: packages/server/src/roomHandlers.ts (INVALID_OUT_OF_BOUNDS guard, room.outOfBoundsEnabled mutation, 4-arg broadcasts present)
- FOUND: packages/server/src/gameEngine.ts (outOfBoundsEnabled parameter, state literal, replay seed present)
- FOUND: packages/server/src/**tests**/roomStore.test.ts (Wave-0 toggle assertions present)
- FOUND: packages/server/src/**tests**/room.integration.test.ts (INVALID_OUT_OF_BOUNDS rejection test present)
- FOUND: packages/client/src/components/GameSettingsScreen.tsx (Out-of-Bounds / Restarts checkbox present)
- FOUND: packages/client/src/components/GameSettingsScreen.test.tsx (3 new assertions present)
- FOUND: packages/client/src/App.tsx (outOfBounds state threading present)
- FOUND: packages/client/src/constants/settingsSummary.ts (Restarts segment present)
- FOUND: 80b5529 (feat: Task 1)
- FOUND: 639e067 (feat: Task 2)
- FOUND: d2140da (feat: Task 3)

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Plan: 03_
_Completed: 2026-08-03_
