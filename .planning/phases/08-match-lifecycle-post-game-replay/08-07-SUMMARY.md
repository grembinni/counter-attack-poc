---
phase: 08-match-lifecycle-post-game-replay
plan: '07'
subsystem: server
tags: [socket.io, game-engine, server, security, correctness]

# Dependency graph
requires:
  - phase: 08-match-lifecycle-post-game-replay
    provides: '08-01 through 08-06 — full match lifecycle server + client implementation'
provides:
  - 'GAME_SNAPSHOT socket handler registered in registerGameHandlers (CR-01 server end)'
  - 'GAME_HEADER socket handler registered in registerGameHandlers (CR-02)'
  - 'GK save-and-spill transitions to LOOSE_BALL phase with deferred fresh-roll landing (CR-03)'
affects: [phase-09-aws-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'GAME_SNAPSHOT handler delegates all phase/sequence/position validation to applySnapshot internally — no duplicate guards needed beyond null-state and team checks'
    - 'GAME_HEADER as a dedicated alias for GAME_ROLL restricted to HEADER phase — lower-risk than removing the event from ClientEvents since client emitHeader already shipped'
    - 'GK spill mirrors the SHOT tie path: transition to LOOSE_BALL, defer computeLooseBall to the next LOOSE_BALL game:roll with independent crypto-backed dice'

key-files:
  created: []
  modified:
    - packages/server/src/gameHandlers.ts
    - packages/server/src/gameEngine.ts

key-decisions:
  - 'GAME_HEADER registered as a dedicated alias for GAME_ROLL restricted to HEADER phase — not removed from ClientEvents because emitHeader is already in the shipped client code'
  - 'GAME_SNAPSHOT handler does not pre-generate dice; applySnapshot only transitions to SHOT — the subsequent game:roll resolves the shot duel as normal'
  - 'GK spill ball.position set to gk.position (spill origin) consistent with the physical board rule that loose balls scatter from the last touch point'

metrics:
  duration_minutes: 15
  completed_date: '2026-06-05'
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 08 Plan 07: Server Gap Closures (CR-01, CR-02, CR-03) Summary

**One-liner:** Registered game:snapshot and game:header socket handlers, and fixed GK save-and-spill to defer loose-ball landing to a fresh independent roll.

## Tasks Completed

| Task | Description                                                                      | Commit  | Files                               |
| ---- | -------------------------------------------------------------------------------- | ------- | ----------------------------------- |
| 1    | Register GAME_SNAPSHOT and GAME_HEADER socket handlers (CR-01 server end, CR-02) | d33c1cd | packages/server/src/gameHandlers.ts |
| 2    | GK save-and-spill defers landing to a fresh LOOSE_BALL roll (CR-03)              | 51b3dc5 | packages/server/src/gameEngine.ts   |

## What Was Built

### Task 1: GAME_SNAPSHOT and GAME_HEADER handlers

**CR-01 (server end):** Added `applySnapshot` to the import list in `gameHandlers.ts` and registered `socket.on(ClientEvents.GAME_SNAPSHOT, ...)` inside `registerGameHandlers`. The handler follows the GAME_START_MOVEMENT shape: isProcessing mutex with finally-release, isActivePlayer team guard with snap-back, delegates to `applySnapshot(room.gameState)` which performs all internal phase/sequence/position validation (NOT_IN_PENALTY_AREA, INVALID_SEQUENCE). On success broadcasts via broadcastState. No dice pre-generation — applySnapshot only transitions to SHOT; the shot duel is resolved by a subsequent game:roll.

**CR-02:** Registered `socket.on(ClientEvents.GAME_HEADER, ...)` inside `registerGameHandlers`. The handler applies: phase guard (phase must be 'HEADER'), isActivePlayer team guard, the HEADER sequence guard (same guard already in GAME_ROLL), pre-generates d1/d2/d3, calls applyRoll, broadcasts on success. GAME_HEADER is a dedicated alias for GAME_ROLL restricted to the HEADER phase — lower-risk than removing GAME_HEADER from ClientEvents since the client's emitHeader is already shipped.

### Task 2: GK save-and-spill LOOSE_BALL transition

**CR-03:** In `applyRoll` SHOT branch, the spill `else` block previously computed `computeLooseBall(gk.position, d1, d2)` reusing the shot-duel dice (d1=shooterDice, d2=gkDice), then returned phase:'MOVEMENT'. Replaced with a return of `phase: 'LOOSE_BALL'` with `ball: { position: gk.position, carrierId: null }` — mirroring the SHOT tie path at ~line 661. The `computeLooseBall` import is retained and still used by the LOOSE_BALL case (~line 907) and `applyGKRestart` (~line 1075).

## Verification Results

- `pnpm exec tsc --noEmit` (server package): exits 0
- `pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts`: 53/53 tests pass
- `pnpm exec vitest run` (full server suite): 149 pass, 2 pre-existing failures in `game.integration.test.ts` (D-10 undo / D-09 UNDO_LOCKED — documented in 08-02/08-03 SUMMARYs as pre-existing)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder values, hardcoded empties, or TODO/FIXME patterns introduced.

## Threat Flags

All threats addressed per plan threat model:

| Threat                                                      | File            | Mitigation Applied                                             |
| ----------------------------------------------------------- | --------------- | -------------------------------------------------------------- |
| T-08-21 Tampering: game:snapshot out of turn                | gameHandlers.ts | isActivePlayer guard + applySnapshot internal validation       |
| T-08-22 Tampering: game:header out of phase/turn            | gameHandlers.ts | phase guard + isActivePlayer + sequence guard before applyRoll |
| T-08-23 Spoofing: dice replay influences loose-ball landing | gameEngine.ts   | Spill now defers to fresh server-generated LOOSE_BALL roll     |

No new threat surface introduced beyond what the plan modelled.

## Self-Check: PASSED

- packages/server/src/gameHandlers.ts: exists and contains both `socket.on(ClientEvents.GAME_SNAPSHOT` and `socket.on(ClientEvents.GAME_HEADER` inside `registerGameHandlers`
- packages/server/src/gameEngine.ts: spill branch returns `phase: 'LOOSE_BALL'` without calling `computeLooseBall`
- Commit d33c1cd: verified in git log
- Commit 51b3dc5: verified in git log
