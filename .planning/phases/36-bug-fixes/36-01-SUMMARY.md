---
phase: 36-bug-fixes
plan: 01
subsystem: multiplayer-lobby
tags: [socket.io, react, zustand, room-lifecycle]

# Dependency graph
requires:
  - phase: 27-game-creation-settings
    provides: GameSettingsScreen pre-game host settings screen and ROOM_SETTINGS_CONFIRM flow
provides:
  - LEAVE_ROOM socket event (room:leave) with server handler that deletes rooms immediately
  - Back control on GameSettingsScreen that returns the host to Landing
affects: [36-bug-fixes remaining plans, any future pre-game screen back-navigation work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Terminal void-payload socket events read only from socket.data (never client-supplied identifiers) to prevent spoofing'

key-files:
  created: []
  modified:
    - packages/shared/src/events.ts
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/client/src/components/GameSettingsScreen.tsx
    - packages/client/src/components/GameSettingsScreen.module.css
    - packages/client/src/App.tsx
    - packages/client/src/components/GameSettingsScreen.test.tsx

key-decisions:
  - 'LEAVE_ROOM is a void-payload event — room code to delete is read only from socket.data.roomCode, making client-side room-code spoofing structurally impossible'
  - "No isProcessing mutex on LEAVE_ROOM — it's a terminal, idempotent action (deleteRoom on an already-removed key is a safe no-op)"
  - 'Cleared socket.data fields with `delete` rather than assigning undefined, per exactOptionalPropertyTypes'

requirements-completed: [BUG-33]

# Metrics
duration: ~25min
completed: 2026-07-28
---

# Phase 36 Plan 01: Game Settings Back Button Summary

**Added a dedicated `LEAVE_ROOM` (`room:leave`) socket event plus an unconditional Back link on GameSettingsScreen, so a host can escape the pre-game settings screen with immediate server-side room teardown instead of relying on the 90s disconnect grace timer.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-28T07:38:00Z (approx, first Bash tool call)
- **Completed:** 2026-07-28T12:48:14Z (approx, final verification)
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments

- New `ClientEvents.LEAVE_ROOM` event (`room:leave`) with a `() => void` payload — no client-supplied room code is possible, closing the spoofing threat (T-36-01)
- Server handler in `roomHandlers.ts` synchronously calls `deleteRoom(socket.data.roomCode)`, leaves the socket.io room, and clears `socket.data.roomCode`/`playerSlot`/`sessionToken`
- `GameSettingsScreen` now renders an unconditional `&larr; Back` link (not gated by `hasConfirmed`/team type), matching `LobbyScreen`'s existing `.subLink` treatment
- `App.tsx`'s new `handleSettingsBack()` emits `LEAVE_ROOM`, clears the session token, resets local pre-game settings state (`selectedSpeed`, `teamType`, `draftPools`, `homePickedTeam`), and calls `resetLobby()` — so a subsequent Create Room starts clean
- 2 new server integration tests prove immediate teardown (`NOT_FOUND` on subsequent join, `getRoom` returns `undefined`) and that a room-less socket's `LEAVE_ROOM` is a harmless no-op that cannot affect an unrelated room
- 3 new client tests prove the Back control renders unconditionally (including after switching to Draft mode and after clicking Confirm Settings) and that clicking it calls `onBack` exactly once without calling `onConfirm`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the LEAVE_ROOM event and its server handler, with wire-level coverage** - `bd7a14b` (feat)
2. **Task 2: Render the Back button on GameSettingsScreen and wire it through App.tsx** - `dd9306e` (feat)

_Note: Task 2's commit also includes a small Rule-1 typecheck fix to Task 1's `roomHandlers.ts` (see Deviations below), discovered while running the plan's full-workspace typecheck verification step after Task 2._

## Files Created/Modified

- `packages/shared/src/events.ts` - Added `ClientEvents.LEAVE_ROOM` (`room:leave`) and its `() => void` entry in `ClientToServerEvents`
- `packages/server/src/roomHandlers.ts` - Added the `LEAVE_ROOM` socket handler (deletes room, leaves socket.io room, clears socket.data)
- `packages/server/src/__tests__/room.integration.test.ts` - Added `describe('LEAVE_ROOM (BUG-33)', ...)` with 2 wire-level tests
- `packages/client/src/components/GameSettingsScreen.tsx` - Added required `onBack: () => void` prop; renders unconditional Back button as last child of `.card`
- `packages/client/src/components/GameSettingsScreen.module.css` - Added `.subLink`/`.subLink:hover` copied verbatim from `LobbyScreen.module.css`
- `packages/client/src/App.tsx` - Added `handleSettingsBack()`, wired `resetLobby` selector, passed `onBack={handleSettingsBack}` to `GameSettingsScreen`
- `packages/client/src/components/GameSettingsScreen.test.tsx` - Updated all existing `render()` calls with `onBack={vi.fn()}`; added `describe('GameSettingsScreen — Back control (BUG-33, Phase 36)', ...)` with 3 new tests

## Decisions Made

- `LEAVE_ROOM` carries no payload — the room code to delete is resolved exclusively from `socket.data.roomCode` server-side, so a forged/arbitrary room code can never reach `deleteRoom` (ASVS V3/V4, T-36-01)
- No `isProcessing` mutex on the handler: it's a terminal action (nothing left to race against) and `deleteRoom` on an already-removed key is already a documented safe no-op
- No confirmation dialog on Back per UI-SPEC — clicking Back is immediate and irreversible by design (matches `LobbyScreen`'s existing Back pattern)
- Did not touch the disconnect handler/90s grace timer (roomHandlers.ts:1028-1067 verified byte-identical) — D-03 explicitly forbids reusing that path
- Did not add a Back affordance to `UniformSelectionScreen`, `LineupAssignmentScreen`, or `TeamSelectionScreen` — D-04 scopes this fix to `GameSettingsScreen` only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes typecheck error when clearing socket.data fields**

- **Found during:** Task 2 (running the plan's `pnpm -r typecheck` verification step, which covers Task 1's handler too)
- **Issue:** `socket.data.roomCode = undefined;` (and the `playerSlot`/`sessionToken` equivalents) fails under the project's `exactOptionalPropertyTypes: true` TypeScript setting — assigning `undefined` to an optional field is a distinct type error from the field being absent.
- **Fix:** Replaced the three assignments with `delete socket.data.roomCode;` / `delete socket.data.playerSlot;` / `delete socket.data.sessionToken;`, which fully clears the optional fields without violating the strict type.
- **Files modified:** packages/server/src/roomHandlers.ts
- **Verification:** `pnpm -r typecheck` passes clean across shared/server/client; `pnpm --filter @counter-attack/server test -- room.integration` remains green (17/17)
- **Committed in:** dd9306e (part of Task 2 commit, since it was discovered during Task 2's verification pass)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for the plan's own stated verification requirement (`pnpm -r typecheck` clean). No scope creep — same handler, same task's files.

## Issues Encountered

- The worktree had no `node_modules` installed at all (fresh worktree checkout). Ran `pnpm install --prefer-offline` (all packages resolved from the local pnpm store, no network downloads) and `pnpm --filter @counter-attack/shared build` (dist output needed for `@counter-attack/shared`'s package.json `exports` resolution) before any test command would run. Not a plan deviation — standard worktree bootstrap, no source files affected.

## Next Phase Readiness

- BUG-33 fully closed: Back control works, room teardown is immediate and unspoofable, no dependence on the 90s grace timer, and no other pre-game screen was touched.
- Full verification suite green: server 629 passed (1 skipped, 1 todo) across 33 files; client 478 passed across 25 files; full-workspace `pnpm -r typecheck` clean.
- No blockers for the remaining Phase 36 bug-fix plans.

---

_Phase: 36-bug-fixes_
_Completed: 2026-07-28_
