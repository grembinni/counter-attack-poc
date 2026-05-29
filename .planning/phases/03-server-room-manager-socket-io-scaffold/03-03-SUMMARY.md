---
phase: '03-server-room-manager-socket-io-scaffold'
plan: '03'
subsystem: 'server'
tags: ['socket.io', 'express', 'room-lifecycle', 'integration-tests', 'reconnect']
dependency_graph:
  requires:
    - '03-01 (package installs: express, socket.io, cors, nanoid, vitest)'
    - '03-02 (roomStore.ts, sessionMiddleware.ts — pure functions consumed here)'
  provides:
    - 'buildServer(): Express + Socket.io server factory'
    - 'registerRoomHandlers(): ROOM_CREATE, ROOM_JOIN, disconnect lifecycle'
    - 'main.ts entrypoint for dev/prod'
    - '6-test integration suite proving all Phase 3 requirements at live-socket level'
  affects:
    - 'packages/shared/src/events.ts (ROOM_JOINED widened to include sessionToken)'
tech_stack:
  added: []
  patterns:
    - 'Factory pattern: buildServer() returns { app, httpServer, io } without calling listen'
    - 'Reconnect dispatch: connection handler checks socket.data.sessionToken to branch fresh vs reconnect'
    - 'socket.to() for disconnect-warning (not io.to) — excludes disconnecting sender'
    - 'socket.data.roomCode read in disconnect handler, never socket.rooms (Pitfall 2 avoided)'
    - 'oncePromise() helper: wraps socket.once in a Promise with configurable timeout'
key_files:
  created:
    - 'packages/server/src/createServer.ts'
    - 'packages/server/src/roomHandlers.ts'
    - 'packages/server/src/main.ts'
    - 'packages/server/src/__tests__/room.integration.test.ts'
  modified:
    - 'packages/server/src/index.ts (bootstrap placeholder removed, re-exports buildServer)'
    - 'packages/shared/src/events.ts (ROOM_JOINED widened with sessionToken 3rd param)'
decisions:
  - 'registerRoomHandlers receives a boolean reconnectOnly param — on reconnect only the disconnect handler is re-registered, preventing duplicate ROOM_CREATE/ROOM_JOIN handlers (RESEARCH.md Pitfall 3)'
  - "game:state listener in integration test registered before waitForConnect to avoid missing the server's immediate emission in the connection handler"
  - "ioClient cast to Socket<ServerToClientEvents, ClientToServerEvents> (io() doesn't accept type args in this socket.io-client version)"
metrics:
  duration: '12m 16s'
  completed: '2026-05-29'
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 2
---

# Phase 03 Plan 03: Socket.io Server Wiring + Integration Tests Summary

**One-liner:** Express + Socket.io server factory with typed room lifecycle handlers, 90s disconnect grace timer, reconnect path with timer cancel, and 6-test integration suite proving all Phase 3 requirements at the live-socket layer.

## What Was Built

### Task 1: createServer.ts + roomHandlers.ts + events.ts widening

`createServer.ts` exports `buildServer()` — a factory that returns `{ app, httpServer, io }` without calling `listen`. The factory:

- Applies `cors()` Express middleware for HTTP routes (independent of Socket.io's cors option — both required per RESEARCH.md Pitfall 1)
- Mounts `GET /health` returning `{ status: 'ok', timestamp: <ISO> }` (SC-5)
- Creates httpServer via `http.createServer(app)` — not `app.listen` (RESEARCH.md anti-pattern avoided)
- Constructs Socket.io `Server` with typed generics and `transports: ['websocket']` (STATE.md locked decision)
- Installs `io.use(sessionMiddleware)` before the connection event fires
- In `io.on('connection')`: checks `socket.data.sessionToken` first; if set (reconnect path), cancels grace timer, updates socket ID, rejoins Socket.io room, and emits `game:state` to the single reconnected socket; otherwise calls `registerRoomHandlers(io, socket, false)`

`roomHandlers.ts` exports `registerRoomHandlers(io, socket, reconnectOnly)`:

- **ROOM_CREATE**: `createRoom(socket.id)` → sets `socket.data`, `socket.join(roomCode)`, emits `ROOM_JOINED(roomCode, 1, sessionToken)` to the creator socket
- **ROOM_JOIN**: validates `roomCode` is a non-empty string (T-03-08), calls `joinRoom`; on `ok:false` emits `ROOM_ERROR(reason)` with distinct `NOT_FOUND`/`NOT_WAITING` strings (CONN-04); on `ok:true` broadcasts `ROOM_JOINED(roomCode, 2, sessionToken)` to the whole room via `io.to()`, then calls `broadcastState(io, room)` (CONN-03 + ARCH-04)
- **disconnect**: reads `socket.data.roomCode/playerSlot` (never `socket.rooms` — Pitfall 2), starts 90s `setTimeout` stored in `room.disconnectTimers[slotIndex]`, emits `GAME_DISCONNECT_WARNING` via `socket.to(roomCode)` (not `io.to` — anti-pattern avoided)

`packages/shared/src/events.ts` `ROOM_JOINED` type widened: `(roomCode: string, playerSlot: 1 | 2, sessionToken: string) => void`

### Task 2: main.ts entrypoint + index.ts cleanup

`main.ts` is the sole file calling `httpServer.listen(PORT)` — imports `buildServer`, reads `process.env['PORT'] ?? 3001`, listens, logs. No exports (script entrypoint).

`index.ts` replaced: removed `bootstrap()` placeholder and type-suppression stubs, replaced with `export { buildServer } from './createServer.js'` + type re-exports. Side-effect-free.

### Task 3: Integration tests (6 tests)

`packages/server/src/__tests__/room.integration.test.ts` — 6 tests, all passing:

```
 ✓ src/__tests__/sessionMiddleware.test.ts  (5 tests) 5ms
 ✓ src/__tests__/roomStore.test.ts          (12 tests) 7ms
 ✓ src/__tests__/room.integration.test.ts  (6 tests) 191ms

 Test Files  3 passed (3)
       Tests  23 passed (23)
    Duration  957ms
```

Tests cover:

1. **CONN-01** wire: `room:create` → `ROOM_JOINED` slot=1, roomCode 5-char Crockford alphabet, sessionToken UUID v4
2. **CONN-02 + CONN-03 + ARCH-04**: slot-2 join → both clients receive `ROOM_JOINED` slot=2 (broadcast) AND `game:state` with `phase:'LOBBY'`, `pieces:[]`, `score:{home:0,away:0}`
3. **CONN-04 NOT_FOUND**: join unknown code → `ROOM_ERROR('NOT_FOUND')`
4. **CONN-04 NOT_WAITING** (distinct `it()` block): join in-progress room → `ROOM_ERROR('NOT_WAITING')`
5. **SC-5**: `GET /health` → status 200, body `{ status: 'ok', timestamp: string }`
6. **SC-3** (partial): reconnect with sessionToken → `game:state` re-emitted to reconnected socket, no `ROOM_ERROR`, timer cancelled

## Connection Handler Dispatch Logic

On every socket connection the `io.use(sessionMiddleware)` middleware runs first. If the socket presents a `sessionToken` in `socket.handshake.auth` that matches a player in the room Map, the middleware sets `socket.data.sessionToken/playerSlot/roomCode`. In `io.on('connection')`:

**Reconnect path** (all three `socket.data` fields are defined): the handler calls `clearTimeout` on the matching `disconnectTimers[slotIndex]` slot, updates `room.players[slotIndex].socketId` to the new socket ID, calls `socket.join(roomCode)` (required — the new socket is not automatically in the IO room), and emits `ServerEvents.GAME_STATE` directly to this socket if `room.gameState !== null`. The disconnect handler is re-registered via `registerRoomHandlers(io, socket, true)` so the reconnected socket can disconnect again.

**Fresh connect path** (no session data): calls `registerRoomHandlers(io, socket, false)` which wires `ROOM_CREATE`, `ROOM_JOIN`, and `disconnect`.

**Disconnect path**: reads `socket.data.roomCode/playerSlot` (never `socket.rooms`), starts a 90s `setTimeout` that calls `deleteRoom(roomCode)`, stores the handle in `room.disconnectTimers[slotIndex]`, and emits `GAME_DISCONNECT_WARNING` via `socket.to(roomCode)` (excludes the disconnecting sender).

## ROOM_JOINED Type Signature Post-Widening

```typescript
[ServerEvents.ROOM_JOINED]: (roomCode: string, playerSlot: 1 | 2, sessionToken: string) => void;
```

## Requirements Coverage

| Requirement                             | Test                                               | Status |
| --------------------------------------- | -------------------------------------------------- | ------ |
| CONN-01 (room code returned to creator) | Test 1 — wire level slot=1 + sessionToken          | PASS   |
| CONN-02 (slot-2 joiner)                 | Test 2 — both players receive ROOM_JOINED slot=2   | PASS   |
| CONN-03 (game starts when both joined)  | Test 2 — game:state LOBBY broadcast on slot-2 join | PASS   |
| CONN-04 NOT_FOUND                       | Test 3                                             | PASS   |
| CONN-04 NOT_WAITING                     | Test 4                                             | PASS   |
| ARCH-01 (server-authoritative slot)     | Code review — slot never accepted from client      | PASS   |
| ARCH-04 (full snapshot broadcast)       | Test 2 — broadcastState emits full GameState       | PASS   |
| SC-3 (reconnect within 90s)             | Test 6 — timer cancel + state re-emit              | PASS   |
| SC-5 (GET /health 200)                  | Test 5                                             | PASS   |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] test ordering fixed — game:state listener registered before waitForConnect**

- **Found during:** Task 3 (first test run)
- **Issue:** `game:state` is emitted by the server immediately in the `connection` handler. The original test registered the listener after `waitForConnect`, missing the event (1000ms timeout).
- **Fix:** Registered the `oncePromise(clientAReconnected, GAME_STATE, 2000)` listener before `waitForConnect` so no events are missed regardless of timing.
- **Files modified:** `packages/server/src/__tests__/room.integration.test.ts`
- **Commit:** 7d773b0

**2. [Rule 1 - Bug] TypeScript compile errors in integration test fixed**

- **Found during:** Task 3 verification (`pnpm -r build`)
- **Issue 1:** `ioClient<ServerToClientEvents, ClientToServerEvents>(...)` — socket.io-client's `io()` function does not accept type arguments in the callable form.
- **Issue 2:** `socket.once(event, (...args: unknown[]) => {...})` — type mismatch against the typed Socket event map.
- **Fix:** Cast `ioClient(...)` result to `Socket<ServerToClientEvents, ClientToServerEvents>`. Used `(socket as any).once(...)` with eslint-disable for the polymorphic once wrapper.
- **Files modified:** `packages/server/src/__tests__/room.integration.test.ts`
- **Commit:** 7d773b0

**3. [Rule 1 - Bug] game:state listener in Test 2 also registered before join emit**

- **Found during:** Task 3 code review pre-commit
- **Issue:** Same race condition as deviation 1 — `stateAPromise` and `stateBPromise` were registered after the potential broadcast.
- **Fix:** All four listeners (ROOM_JOINED × 2, GAME_STATE × 2) registered before `clientB.emit(ROOM_JOIN)`.
- **Files modified:** `packages/server/src/__tests__/room.integration.test.ts`
- **Commit:** 7d773b0

### ARCH-01 Note

`ARCH-01` (server-authoritative state) is verified by code review only — the client cannot claim a slot because `ROOM_CREATE` takes no payload and `ROOM_JOIN` accepts only a `roomCode` string. The server assigns slots deterministically from Map state. No automated test covers this architectural constraint (consistent with RESEARCH.md).

## Threat Surface Scan

No new network endpoints or auth paths beyond what the plan's `<threat_model>` covers. `/health` is the only new HTTP endpoint — T-03-14 disposition is `accept` (no user-controlled input echoed). CORS wildcard default documented in `createServer.ts` JSDoc as Phase 9 hardening (T-03-16). No new security surface introduced.

## Known Stubs

- `room.gameState` is set to a stub `LOBBY` `GameState` (no pieces, no ball logic) in `roomStore.joinRoom`. This is intentional per Phase 3 RESEARCH.md resolved question 3: "emit a stub GameState with phase: 'LOBBY' when both players join". Phase 4 replaces this stub with real initial state (team placement, kick-off phase).

## Self-Check: PASSED

| Check                                                         | Result |
| ------------------------------------------------------------- | ------ |
| packages/server/src/createServer.ts exists                    | FOUND  |
| packages/server/src/roomHandlers.ts exists                    | FOUND  |
| packages/server/src/main.ts exists                            | FOUND  |
| packages/server/src/index.ts exists (re-export only)          | FOUND  |
| packages/server/src/**tests**/room.integration.test.ts exists | FOUND  |
| packages/shared/src/events.ts exists (ROOM_JOINED widened)    | FOUND  |
| 03-03-SUMMARY.md exists                                       | FOUND  |
| Commit 21fbc48 (Task 1)                                       | FOUND  |
| Commit 023a8ea (Task 2)                                       | FOUND  |
| Commit 7d773b0 (Task 3)                                       | FOUND  |
