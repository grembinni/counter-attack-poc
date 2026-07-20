---
phase: 27-game-creation-settings
plan: 01
subsystem: api
tags: [typescript, socket.io, shared-types]

# Dependency graph
requires: []
provides:
  - "TeamType = 'standard' | 'draft' exported from packages/shared/src/types.ts"
  - 'DraftPoolId (5-value forward-compat type) exported from packages/shared/src/types.ts'
  - 'SELECTABLE_DRAFT_POOLS (3-value validation allow-list) exported from packages/shared/src/types.ts'
  - 'ClientEvents.ROOM_SETTINGS_CONFIRM + ClientToServerEvents entry (object payload)'
  - 'ServerEvents.ROOM_SETTINGS_CONFIRMED + ServerToClientEvents entry (positional args)'
affects: [27-02-server-settings-handler, 27-03-client-settings-screen, 27-04-subheaders]

# Tech tracking
tech-stack:
  added: []
  patterns: ['type union + adjacent allow-list const (mirrors GameSpeed/GAME_SPEED_MINUTES)']

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts

key-decisions:
  - "DraftPoolId intentionally includes 'legends'/'icons' (5 values) for DRAFT-11 forward-compat, but SELECTABLE_DRAFT_POOLS is narrower (3 values) — the divergence is documented inline as the validation source of truth (Pitfall 3 / ASVS V5), enforced server-side in 27-02"
  - 'ROOM_SETTINGS_CONFIRM uses a single object payload (client->server); ROOM_SETTINGS_CONFIRMED uses positional args (server->client) — matches existing project conventions (LINEUP_CONFIRM object vs TEAM_SPEED_CHANGED positional)'
  - 'TEAM_SPEED_SET/TEAM_SPEED_CHANGED left untouched — the three settings lock together via one new event rather than layering onto the speed-only event'

patterns-established:
  - 'Type + narrower validation-allow-list divergence, documented via paired doc comments citing the mitigation location'

requirements-completed: [DRAFT-01]

# Metrics
duration: 12min
completed: 2026-07-20
---

# Phase 27 Plan 01: Shared Vocabulary Foundation Summary

**Added `TeamType`/`DraftPoolId`/`SELECTABLE_DRAFT_POOLS` to shared types and the `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` typed Socket.io event pair to `packages/shared/src/events.ts` — pure type-surface widening, no runtime behavior changes.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-20T19:49:00Z (approx, worktree base commit time)
- **Completed:** 2026-07-20
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- `TeamType`, `DraftPoolId`, and `SELECTABLE_DRAFT_POOLS` exported from `packages/shared/src/types.ts`, mirroring the existing `GameSpeed`/`GAME_SPEED_MINUTES` "type union + adjacent allow-list const" shape
- `ROOM_SETTINGS_CONFIRM` (client→server, object payload) and `ROOM_SETTINGS_CONFIRMED` (server→client, positional args) added to both the name consts and the typed event-map interfaces in `packages/shared/src/events.ts`
- Full workspace typecheck (`pnpm -r typecheck` across shared/server/client) confirmed green — no downstream consumer broken by the additive surface

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TeamType, DraftPoolId, and SELECTABLE_DRAFT_POOLS to shared types** - `301a4d1` (feat)
2. **Task 2: Add ROOM_SETTINGS_CONFIRM / ROOM_SETTINGS_CONFIRMED typed event pair** - `b96b012` (feat)

_No TDD tasks in this plan (tdd="false" on both tasks) — single commit per task._

## Files Created/Modified

- `packages/shared/src/types.ts` - Added `TeamType`, `DraftPoolId` (5-value forward-compat union), `SELECTABLE_DRAFT_POOLS` (3-value validation allow-list const), each with doc comments citing DRAFT-01/D-04
- `packages/shared/src/events.ts` - Added `TeamType`/`DraftPoolId` to the `./types.js` import; `ROOM_SETTINGS_CONFIRM` in `ClientEvents` (near `ROOM_CREATE`/`ROOM_JOIN`); `ROOM_SETTINGS_CONFIRMED` in `ServerEvents` (near `TEAM_SPEED_CHANGED`); corresponding entries in `ClientToServerEvents` (object payload) and `ServerToClientEvents` (positional args)

## Decisions Made

- Followed the plan's exact placement and naming guidance from RESEARCH.md — no deviations from the recommended shapes
- Confirmed via source read that `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` are byte-identical to their pre-change state (diff only adds the new `ROOM_SETTINGS_CONFIRMED` entry adjacent to `TEAM_SPEED_CHANGED`, does not modify it)

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the RESEARCH.md-recommended shapes verbatim.

## Issues Encountered

- **Environment setup:** The worktree had no `node_modules` (fresh worktree checkout) — ran `pnpm install` before the first typecheck could execute. Not a plan deviation; standard worktree bootstrap.
- **Workspace-wide typecheck initially failed** with `Cannot find module '@counter-attack/shared'` in `packages/server` — root cause was a missing `packages/shared/dist` build output (server imports the built package, not source). Ran `pnpm --filter @counter-attack/shared build` to produce `dist/`, after which `pnpm -r typecheck` passed cleanly across all three packages. This is a pre-existing build-order dependency of the monorepo, not a defect introduced by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `packages/shared` now exports the full type surface (`TeamType`, `DraftPoolId`, `SELECTABLE_DRAFT_POOLS`, `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED`) that 27-02 (server handler + Room fields) and 27-03/27-04 (client settings screen + subheaders) both depend on
- No blockers. Wave 2 plans can proceed in parallel against this committed shared contract.

---

_Phase: 27-game-creation-settings_
_Completed: 2026-07-20_
