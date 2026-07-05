---
phase: 22-uniform-selection-screen
plan: 02
subsystem: api
tags: [typescript, socket.io, server-handlers, uniform-confirm, room-state]

# Dependency graph
requires:
  - phase: 22-01
    provides: ServerEvents.UNIFORM_SELECTION_START, ServerEvents.UNIFORM_HOME_CONFIRMED, ClientEvents.UNIFORM_CONFIRM typed signatures
provides:
  - Room.awayPickedTeam field (roomStore.ts)
  - Room.homePickedUniformStyle field (roomStore.ts)
  - UNIFORM_CONFIRM socket handler with mutex + allow-list guards (roomHandlers.ts)
  - Deferred TEAM_PICK away branch broadcasting UNIFORM_SELECTION_START
affects: [22-03-client-uniform-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UNIFORM_CONFIRM home-first enforcement keyed on room.homePickedUniformStyle === undefined (mirrors TEAM_PICK homePickedTeam === undefined)"
    - "4-arg buildInitialGameState called in UNIFORM_CONFIRM away branch with both teams + both styles"
    - "VALID_UNIFORM_STYLE_IDS = Object.keys(UNIFORM_STYLE_META) as UniformStyleId[] — allow-list from shared constants"

key-files:
  created: []
  modified:
    - packages/server/src/roomStore.ts
    - packages/server/src/roomHandlers.ts

key-decisions:
  - "TEAM_PICK away branch now stores awayPickedTeam and broadcasts UNIFORM_SELECTION_START instead of building game state — game start is deferred to UNIFORM_CONFIRM away branch"
  - "UNIFORM_CONFIRM home-first enforcement uses homePickedUniformStyle === undefined as the gate (presence of the field signals home has confirmed)"
  - "UNIFORM_CONFIRM validates both teamId and uniformStyle before any state write (T-22-03 allow-list)"

# Metrics
duration: 20min
completed: 2026-07-05
---

# Phase 22 Plan 02: Server Uniform Handler Summary

**UNIFORM_CONFIRM handler + deferred-build TEAM_PICK away branch: home-first order enforcement, allow-list validation, isProcessing mutex, buildInitialGameState with both teams and both uniform styles**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-05T06:40:00Z
- **Completed:** 2026-07-05T07:00:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added `awayPickedTeam?: TeamId` and `homePickedUniformStyle?: UniformStyleId` optional fields to the `Room` type in roomStore.ts
- Replaced the game-state-building block in the TEAM_PICK away branch with `room.awayPickedTeam = teamId` + `UNIFORM_SELECTION_START` broadcast (deferred build, D-13)
- Added `VALID_UNIFORM_STYLE_IDS` allow-list constant derived from `Object.keys(UNIFORM_STYLE_META)`
- Added `UNIFORM_CONFIRM` handler with: isProcessing mutex (T-22-05), allow-list validation for both teamId and uniformStyle (T-22-03), home-first slot enforcement (T-22-04), home branch stores style and broadcasts UNIFORM_HOME_CONFIRMED, away branch builds game state with 4-arg `buildInitialGameState` and calls `broadcastState` (T-22-06 error guard)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add awayPickedTeam + homePickedUniformStyle to Room type** - `390d50e` (feat)
2. **Task 2: Defer game-state build in TEAM_PICK away branch** - `8966f7b` (feat)
3. **Task 3: Add UNIFORM_CONFIRM handler with guards + deferred build** - `58e5d74` (feat)

## Files Created/Modified

- `packages/server/src/roomStore.ts` — Added `awayPickedTeam?: TeamId` and `homePickedUniformStyle?: UniformStyleId` to Room type; merged `UniformStyleId` into the shared import
- `packages/server/src/roomHandlers.ts` — TEAM_PICK away branch replaced with deferred store+broadcast; VALID_UNIFORM_STYLE_IDS constant; UNIFORM_STYLE_META import; UNIFORM_CONFIRM handler with full guard stack

## Decisions Made

- The `homePickedUniformStyle === undefined` gate mirrors the existing `homePickedTeam === undefined` gate in TEAM_PICK — consistent pattern for home-first two-phase confirmation
- The plan-22-01 placeholder defaults (`pinstripes-vertical`/`bar-diagonal`) in the TEAM_PICK away branch were removed; the away branch no longer calls `buildInitialGameState` at all — the build happens exclusively in the UNIFORM_CONFIRM away branch
- `VALID_UNIFORM_STYLE_IDS` derives from `Object.keys(UNIFORM_STYLE_META)` rather than manually listing all 18 IDs — stays in sync with additions to the style registry automatically

## Deviations from Plan

None — plan executed exactly as written. The placeholder `selectedUniformStyles` const from plan 22-01 was successfully removed as the TEAM_PICK away branch no longer builds game state.

## Verification

- `cd packages/server && npx tsc --noEmit` exits 0 (run from main repo)
- `cd packages/server && npx vitest run` passes: 490 passed, 1 skipped, 1 todo (23 test files)

## Known Stubs

None — the plan-22-01 placeholder defaults (`pinstripes-vertical`/`bar-diagonal`) have been removed. All uniform style values now flow from actual player input via UNIFORM_CONFIRM.

## Threat Flags

No new security surfaces beyond those already in the threat model. All T-22-03 through T-22-06 mitigations are implemented:

| Threat | Mitigation | Location |
|--------|------------|----------|
| T-22-03 (Tampering) | Allow-list validation against VALID_TEAM_IDS + VALID_UNIFORM_STYLE_IDS | UNIFORM_CONFIRM handler, before any state write |
| T-22-04 (EoP) | Home-first slot enforcement via homePickedUniformStyle === undefined + playerSlot guard | UNIFORM_CONFIRM handler |
| T-22-05 (DoS) | isProcessing mutex try/finally | UNIFORM_CONFIRM handler |
| T-22-06 (DoS) | try/catch around buildInitialGameState emitting GAME_ERROR 'SERVER_ERROR' | UNIFORM_CONFIRM away branch |

---
*Phase: 22-uniform-selection-screen*
*Completed: 2026-07-05*
