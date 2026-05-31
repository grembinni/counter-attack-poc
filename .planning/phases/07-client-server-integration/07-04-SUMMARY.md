---
phase: 07-client-server-integration
plan: '04'
subsystem: server/shared
tags: [websocket, events, game-shot, security, phase-guards]
dependency_graph:
  requires: []
  provides:
    - "ClientEvents.GAME_SHOT = 'game:shot' in packages/shared/src/events.ts"
    - 'ClientToServerEvents[GAME_SHOT]: (targetHex: HexCoord) => void'
    - 'Room.shotTarget?: HexCoord | null in packages/server/src/roomStore.ts'
    - 'game:shot handler in packages/server/src/gameHandlers.ts (phase + team + payload guards)'
  affects:
    - packages/client/src/components/HexGrid.tsx
tech_stack:
  added: []
  patterns:
    - 'UX-bookkeeping handler: server records shot intent without broadcasting (D-06 revision)'
    - 'ASVS V5 shape validation on HexCoord payload mirrors GK_RESTART INVALID_CHOICE pattern'
    - 'isProcessing mutex + finally release per Pitfall 5'
key_files:
  created: []
  modified:
    - packages/shared/src/events.ts
    - packages/server/src/roomStore.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/game.integration.test.ts
decisions:
  - 'game:shot handler intentionally does NOT call broadcastState — recording shot intent is UX/broadcast bookkeeping only; a full snapshot broadcast is not needed and was explicitly excluded by D-06 revision'
  - 'Room.shotTarget field added to Room type (server/roomStore.ts), NOT to GameState in shared/types.ts — keeps the shared GameState type untouched (no client snapshot churn)'
  - 'applyRoll SHOT branch reads no shotTarget; dice-only resolution preserved per T-07-13'
metrics:
  duration: '~15 minutes'
  completed: '2026-05-31T18:11:57Z'
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 7 Plan 04: Add game:shot Event (D-06 Contract) Summary

**One-liner:** game:shot shared event constant + typed HexCoord payload + server handler with phase/team/payload guards records shot target server-side without touching dice resolution.

## Tasks Completed

| #   | Name                                                        | Commit  | Files                                                                                       |
| --- | ----------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| 1   | Add GAME_SHOT to shared events and Room.shotTarget to store | c6ae362 | packages/shared/src/events.ts, packages/server/src/roomStore.ts                             |
| 2   | Add game:shot handler with guards and integration tests     | efc3702 | packages/server/src/gameHandlers.ts, packages/server/src/**tests**/game.integration.test.ts |

## What Was Built

### Task 1 — Shared contract + room store field

`packages/shared/src/events.ts`:

- Added `GAME_SHOT: 'game:shot'` to `ClientEvents` const object (placed adjacent to `GAME_ROLL`)
- Added `[ClientEvents.GAME_SHOT]: (targetHex: HexCoord) => void` to `ClientToServerEvents` interface with D-06 JSDoc
- `HexCoord` was already imported; no new imports needed

`packages/server/src/roomStore.ts`:

- Added `import type { GameState, HexCoord } from '@counter-attack/shared'`
- Added optional field `shotTarget?: HexCoord | null` to the `Room` type with documenting JSDoc (server-side UX bookkeeping only; never fed into dice resolution; `applyRoll` never reads it)
- Field deliberately not initialised in `createRoom`/`joinRoom` (optional, defaults to undefined)
- Field deliberately excluded from `broadcastState` (not part of `GameState` snapshot)

### Task 2 — Server handler + integration tests

`packages/server/src/gameHandlers.ts`:

- Registered `socket.on(ClientEvents.GAME_SHOT, ...)` handler inside `registerGameHandlers` after `GAME_ROLL` and before `GAME_GK_RESTART`
- Guard ladder (all rejections are silent — NO `broadcastState` call per D-06 revision):
  1. `roomCode === undefined` → early return
  2. `!room || room.isProcessing` → SC-5 drop
  3. `isProcessing = true` / `finally { isProcessing = false }` — Pitfall 5
  4. Phase guard: `phase !== 'SHOT'` → `GAME_ERROR 'WRONG_PHASE'`
  5. Team guard: `!isActivePlayer(socket, room)` → `GAME_ERROR 'WRONG_TEAM'`
  6. Payload shape guard: non-`{q:number, r:number}` → `GAME_ERROR 'INVALID_TARGET'`
  7. Happy path: `room.shotTarget = { q: targetHex.q, r: targetHex.r }` (no broadcast)
- `applyRoll` and the `GAME_ROLL` handler are **unchanged** — dice-only SHOT resolution is preserved

`packages/server/src/__tests__/game.integration.test.ts`:

- Added `describe('game:shot (D-06)')` block with `seedShotPhase` helper
- Test (a): emitting `game:shot` when phase is NOT SHOT (KICK_OFF) → `WRONG_PHASE`; `shotTarget` remains `undefined`
- Test (b): emitting `game:shot` from shooter in SHOT phase → `room.shotTarget` equals sent hex; no `game:state` event emitted within 200ms window
- Test (c): emitting `game:shot` with `{ q: 'x' }` malformed payload → `INVALID_TARGET`; `shotTarget` remains `undefined`

## Verification Results

- `cd packages/shared && npx tsc --noEmit -p tsconfig.json` → exit 0
- `cd packages/server && npx tsc --noEmit -p tsconfig.json` → exit 0
- `cd packages/server && npx vitest run src/__tests__/game.integration.test.ts` → **17 passed, 1 todo skipped**

## Deviations from Plan

None — plan executed exactly as written.

The handler was implemented with explicit `return` after each rejection guard (no `broadcastState` anywhere in the handler body) per the plan's "second departure" instruction. The integration test for the recorded-target path uses a 200ms window listener pattern (collecting `game:state` events and asserting none arrived) rather than the "wait 200ms then check" approach in some other tests, which is stable because the handler never emits `game:state`.

## Known Stubs

None — this plan adds a new event contract; no placeholder data or TODO rendering paths were introduced.

## Threat Flags

No new security surface beyond what the plan's threat model documents. All three STRIDE items in the register (T-07-11, T-07-12, T-07-13) are addressed:

- T-07-11 mitigated: phase + team guards reject out-of-phase / wrong-team emits with `GAME_ERROR` and never write `room.shotTarget`
- T-07-12 mitigated: shape validation (ASVS V5) rejects non-`{q:number,r:number}` payloads with `INVALID_TARGET`
- T-07-13 accepted: `room.shotTarget` is UX bookkeeping; `applyRoll` resolves SHOT from dice only

## Self-Check: PASSED

Files exist:

- packages/shared/src/events.ts — FOUND (contains GAME_SHOT)
- packages/server/src/roomStore.ts — FOUND (contains shotTarget)
- packages/server/src/gameHandlers.ts — FOUND (contains GAME_SHOT handler)
- packages/server/src/**tests**/game.integration.test.ts — FOUND (contains game:shot describe block)

Commits exist:

- c6ae362 — FOUND
- efc3702 — FOUND
