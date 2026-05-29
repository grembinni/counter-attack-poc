---
phase: 03-server-room-manager-socket-io-scaffold
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - packages/server/package.json
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/__tests__/roomStore.test.ts
  - packages/server/src/__tests__/sessionMiddleware.test.ts
  - packages/server/src/createServer.ts
  - packages/server/src/index.ts
  - packages/server/src/main.ts
  - packages/server/src/roomHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/server/src/sessionMiddleware.ts
  - packages/server/vitest.config.ts
  - packages/shared/src/events.test.ts
  - packages/shared/src/events.ts
findings:
  critical: 3
  warning: 4
  info: 1
  total: 8
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase delivers the Socket.io room lifecycle scaffold: room creation, joining, disconnect grace timers, session middleware for reconnection, and a health endpoint. The architecture is sound — in-memory Map store, server-authoritative slot assignment, typed events shared across packages. Three blockers were found: a session-token confidentiality breach that allows player A to impersonate player B on reconnect, an unhandled throw from `createRoom` that can crash the Node process, and a `@types/express` version mismatch that silently applies wrong types. Four warnings cover input normalization, a multiple-create-per-socket gap, CORS wildcard risk, and fragile source-text tests.

## Critical Issues

### CR-01: Player A receives Player B's sessionToken on room join (impersonation risk)

**File:** `packages/server/src/roomHandlers.ts:114`

**Issue:** `io.to(roomCode).emit(ServerEvents.ROOM_JOINED, roomCode, 2, result.sessionToken)` broadcasts to every socket in the Socket.io room, including the creator (player A, slot 1). Player A therefore receives player B's `sessionToken` in their `ROOM_JOINED` event payload. Because `sessionToken` is the sole credential for reconnect identity (checked in `sessionMiddleware.ts` and `createServer.ts`), a malicious player A client could reconnect using player B's token, inheriting slot 2 and receiving all subsequent `game:state` broadcasts intended for player B.

The creator already received their own `sessionToken` during `ROOM_CREATE`. The second `ROOM_JOINED` message is meant as a "room is full, game starting" signal; it does not need to carry slot 2's token to slot 1.

**Fix:** Send the join broadcast in two targeted messages: one to the joining socket with their token, and a separate token-free notification to the rest of the room.

```typescript
// packages/server/src/roomHandlers.ts — replace line 114

// Notify the joining socket (slot 2) with their credential.
socket.emit(ServerEvents.ROOM_JOINED, roomCode, 2, result.sessionToken);

// Notify the existing player(s) that slot 2 has joined — no token in payload.
// ServerToClientEvents signature must allow sessionToken to be optional (see events.ts fix below).
socket.to(roomCode).emit(ServerEvents.ROOM_JOINED, roomCode, 2, '');
```

Alternatively, define a separate `ROOM_FULL` or `GAME_STARTING` server event that carries no credential. The cleanest fix aligns with the typed event interface. At minimum, the broadcast must not send `result.sessionToken` to the creator's socket.

---

### CR-02: Unhandled throw from `createRoom` crashes the Node process

**File:** `packages/server/src/roomHandlers.ts:70`

**Issue:** `createRoom` (in `roomStore.ts:85`) throws `Error('Room code collision after 5 attempts')` if five consecutive room-code generations collide. This throw is synchronous and occurs inside a Socket.io `socket.on(ClientEvents.ROOM_CREATE, ...)` event handler. Socket.io does not catch synchronous errors thrown inside event callbacks — the error propagates to the Node.js uncaughtException domain and crashes the server process if no process-level handler is installed.

The collision probability is negligible in practice, but the code path exists and will terminate all active game sessions if it ever triggers.

**Fix:** Wrap the call in a try/catch and emit `ROOM_ERROR` to the client instead.

```typescript
// packages/server/src/roomHandlers.ts — ROOM_CREATE handler

socket.on(ClientEvents.ROOM_CREATE, () => {
  let roomCode: string;
  let sessionToken: string;
  try {
    ({ roomCode, sessionToken } = createRoom(socket.id));
  } catch {
    socket.emit(ServerEvents.ROOM_ERROR, 'SERVER_ERROR');
    return;
  }

  socket.data.roomCode = roomCode;
  socket.data.playerSlot = 1;
  socket.data.sessionToken = sessionToken;

  void socket.join(roomCode);
  socket.emit(ServerEvents.ROOM_JOINED, roomCode, 1, sessionToken);
});
```

---

### CR-03: `@types/express` v5 applied to Express 4 runtime — type contract mismatch

**File:** `packages/server/package.json:23`

**Issue:** `devDependencies` declares `"@types/express": "5.0.6"` while `dependencies` has `"express": "4.22.2"`. Express 4 and Express 5 have incompatible APIs (e.g. `res.json()` signature, async error handler shape, routing method signatures changed). TypeScript sees Express 5 types but the runtime runs Express 4. This means TypeScript will not catch API calls that are valid in v5 but behave differently or do not exist in v4, and will raise false positives for v4-specific patterns. The mismatch is silently wrong — no compile error is produced, but type safety guarantees no longer hold for the Express layer.

**Fix:** Align the types version with the runtime version.

```json
"@types/express": "4.17.21"
```

Or upgrade the runtime: `"express": "^5.0.0"`. Choose one and make them consistent. Given Express 5 is still RC-quality for some middleware interactions, pinning to 4.x types is the lower-risk path.

---

## Warnings

### WR-01: `roomCode` from client is not uppercased before Map lookup

**File:** `packages/server/src/roomHandlers.ts:91-96`

**Issue:** The `ROOM_JOIN` handler trims whitespace from the client-supplied `roomCode` but does not normalize case. All generated room codes use a Crockford uppercase alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), so a client sending lowercase `"abcde"` receives `ROOM_ERROR NOT_FOUND` even if the room `"ABCDE"` exists. This is a usability defect — UX flows that allow mixed-case input (e.g., a text box without `text-transform: uppercase`) will silently fail to find rooms.

**Fix:**

```typescript
const normalizedCode = roomCode.trim().toUpperCase();
if (normalizedCode.length === 0) {
  socket.emit(ServerEvents.ROOM_ERROR, 'INVALID_CODE');
  return;
}
const result = joinRoom(normalizedCode, socket.id);
// ... use normalizedCode everywhere below
socket.data.roomCode = normalizedCode;
```

---

### WR-02: `ROOM_CREATE` emitted multiple times per socket creates orphaned rooms

**File:** `packages/server/src/roomHandlers.ts:69-84`

**Issue:** If a client emits `room:create` more than once, each call invokes `createRoom`, writes a new room to the store, and overwrites `socket.data.roomCode` with the latest code. The earlier rooms remain in the Map with stale `socketId` references and no connected player, and their `disconnectTimers` are never started (no disconnect will fire for them). The `GRACE_PERIOD_MS` timer never triggers because no disconnect handler for those orphaned rooms runs. Those rooms accumulate in memory indefinitely.

There is no guard (`socket.data.roomCode !== undefined`) preventing re-creation after the first call.

**Fix:** Add an idempotency guard at the start of the `ROOM_CREATE` handler:

```typescript
socket.on(ClientEvents.ROOM_CREATE, () => {
  if (socket.data.roomCode !== undefined) {
    // Already in a room — re-emit the existing join info rather than creating a new room.
    socket.emit(ServerEvents.ROOM_JOINED, socket.data.roomCode, 1, socket.data.sessionToken!);
    return;
  }
  // ... rest of handler
});
```

---

### WR-03: CORS wildcard default with no startup warning

**File:** `packages/server/src/createServer.ts:50` and `69-74`

**Issue:** Both Express CORS middleware (`app.use(cors())`) and Socket.io's `cors.origin` default to `*` when `CORS_ORIGIN` is not set. In a production AWS deployment, this allows any origin to make credentialed Socket.io connections. There is a comment noting the env var must be set in production, but the application does not log a warning or refuse to start when `NODE_ENV=production` and the env var is absent. A misconfigured deployment silently runs with open CORS.

**Fix:** Add a startup guard in `main.ts`:

```typescript
if (process.env['NODE_ENV'] === 'production' && !process.env['CORS_ORIGIN']) {
  console.warn(
    '[WARN] CORS_ORIGIN is not set in production. All origins are allowed. Set CORS_ORIGIN to restrict access.',
  );
}
```

A stronger fix would throw in production if the env var is absent — acceptable for a security-conscious POC.

---

### WR-04: `events.test.ts` tests raw source text instead of runtime values

**File:** `packages/shared/src/events.test.ts:1-32`

**Issue:** All five tests use `readFileSync` to read `events.ts` as a raw string and then apply `.toMatch()` / `.toContain()` string searches against the source text. These tests will break on innocuous non-semantic changes (whitespace reformatting, property reordering, comment edits) while failing to catch actual runtime regressions (e.g. a property being renamed without updating the string literal). The tests provide false confidence: they verify the _source text shape_ of the file, not that the exported values are correct at runtime.

**Fix:** Import the module under test and assert on the actual exported values:

```typescript
import { ClientEvents, ServerEvents } from './events.js';
import type { SocketData } from './events.js';

it('ClientEvents.ROOM_CREATE equals room:create', () => {
  expect(ClientEvents.ROOM_CREATE).toBe('room:create');
});

it('ServerEvents.ROOM_JOINED equals room:joined', () => {
  expect(ServerEvents.ROOM_JOINED).toBe('room:joined');
});
```

The SocketData interface shape cannot be tested at runtime (it is erased by TypeScript compilation), so those three tests can be removed — type correctness is enforced at compile time by `tsc --noEmit`, not by runtime assertions.

---

## Info

### IN-01: `index.ts` exports internal store types that are not part of the public API surface

**File:** `packages/server/src/index.ts:2`

**Issue:** `index.ts` re-exports `Room`, `PlayerRecord`, and `JoinResult` from `roomStore.ts`. These are internal implementation types for the room store. No consumer outside the server package currently imports them (the client package communicates via Socket.io events, not direct imports). Exporting them expands the public API surface unnecessarily — if the store internals change, downstream consumers would see breaking type changes even though nothing in their code changed.

**Fix:** Remove the re-exports from `index.ts` unless an explicit external consumer is identified:

```typescript
// index.ts
export { buildServer } from './createServer.js';
// Remove: export type { Room, PlayerRecord, JoinResult } from './roomStore.js';
```

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
