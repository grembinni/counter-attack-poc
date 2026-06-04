---
phase: 03-server-room-manager-socket-io-scaffold
fixed_at: 2026-05-29T16:58:00Z
review_path: .planning/phases/03-server-room-manager-socket-io-scaffold/03-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-29T16:58:00Z
**Source review:** .planning/phases/03-server-room-manager-socket-io-scaffold/03-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Player A receives Player B's sessionToken on room join (impersonation risk)

**Files modified:** `packages/server/src/roomHandlers.ts`
**Commit:** f93a6d8
**Applied fix:** Replaced `io.to(roomCode).emit(ServerEvents.ROOM_JOINED, roomCode, 2, result.sessionToken)` with two targeted calls: `socket.emit(...)` to send the token exclusively to the joining socket (slot 2), and `socket.to(roomCode).emit(ServerEvents.ROOM_JOINED, roomCode, 2, '')` to notify the existing player with an empty string token. Player 1 no longer receives Player 2's reconnect credential.

---

### CR-02: Unhandled throw from `createRoom` crashes the Node process

**Files modified:** `packages/server/src/roomHandlers.ts`
**Commit:** f93a6d8
**Applied fix:** Wrapped `createRoom(socket.id)` in a try/catch block inside the ROOM_CREATE handler. On catch, emits `ServerEvents.ROOM_ERROR` with reason `'SERVER_ERROR'` and returns early, preventing the unhandled synchronous throw from propagating to Node's uncaughtException handler.

---

### CR-03: `@types/express` v5 applied to Express 4 runtime — type contract mismatch

**Files modified:** `packages/server/package.json`, `pnpm-lock.yaml`
**Commit:** 26b65b6
**Applied fix:** Changed `"@types/express": "5.0.6"` to `"@types/express": "^4.17.21"` in devDependencies. Ran `pnpm install --filter @counter-attack/server` which resolved to `@types/express@4.17.25` (latest 4.x). TypeScript check passes cleanly with no new errors.

---

### WR-01: `roomCode` from client is not uppercased before Map lookup

**Files modified:** `packages/server/src/roomHandlers.ts`
**Commit:** f93a6d8
**Applied fix:** Added `const normalizedCode = roomCode.trim().toUpperCase()` after the empty-string validation guard. All subsequent calls — `joinRoom`, `socket.data.roomCode`, `socket.join`, `socket.emit`, `socket.to`, and `getRoom` — use `normalizedCode` instead of the raw `roomCode` parameter so mixed-case input finds the correct room.

---

### WR-02: `ROOM_CREATE` emitted multiple times per socket creates orphaned rooms

**Files modified:** `packages/server/src/roomHandlers.ts`
**Commit:** f93a6d8
**Applied fix:** Added an idempotency guard at the start of the ROOM_CREATE handler that checks `socket.data.roomCode !== undefined`. If the socket already has a room, emits `ServerEvents.ROOM_ERROR` with reason `'ALREADY_IN_ROOM'` and returns early, preventing duplicate room creation and the resulting orphaned Map entries.

---

### WR-03: CORS wildcard default with no startup warning

**Files modified:** `packages/server/src/main.ts`
**Commit:** 0941a2b
**Applied fix:** Added a startup check in `main.ts` (the process entry point) that calls `console.warn` when `NODE_ENV === 'production'` and `CORS_ORIGIN` is not set. This alerts operators to a misconfigured production deployment without making startup fatal (appropriate for a POC stage).

---

### WR-04: `events.test.ts` tests raw source text instead of runtime values

**Files modified:** `packages/shared/src/events.test.ts`
**Commit:** 045e5cc
**Applied fix:** Rewrote the test file to import `ClientEvents` and `ServerEvents` from `./events.js` and assert on the actual exported string values (e.g. `expect(ClientEvents.ROOM_CREATE).toBe('room:create')`). The three SocketData interface tests were removed — TypeScript interfaces are erased at compile time and cannot be tested at runtime; type correctness is enforced by `tsc --noEmit`. The rewritten tests cover all 8 event constants across both enums. All 103 shared package tests pass.

---

## Post-fix verification

- `pnpm -r build`: passed (shared, server, client all clean)
- `pnpm --filter @counter-attack/server test`: 23/23 tests pass
- `pnpm --filter @counter-attack/shared test`: 103/103 tests pass
- `tsc --noEmit -p packages/server/tsconfig.json`: no errors

---

_Fixed: 2026-05-29T16:58:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
