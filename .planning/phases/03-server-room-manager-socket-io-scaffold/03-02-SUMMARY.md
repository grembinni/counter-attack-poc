---
phase: 03-server-room-manager-socket-io-scaffold
plan: '02'
subsystem: server
tags: [room-store, session-middleware, socket-io, tdd, conn-01, conn-02, conn-04, arch-01, arch-04]
dependency_graph:
  requires: [03-01]
  provides: [roomStore, sessionMiddleware]
  affects: [03-03, phase-04]
tech_stack:
  added: []
  patterns:
    [
      discriminated-union-result,
      module-level-map-singleton,
      tdd-red-green,
      guard-first-early-return,
    ]
key_files:
  created:
    - packages/server/src/roomStore.ts
    - packages/server/src/sessionMiddleware.ts
    - packages/server/src/__tests__/roomStore.test.ts
    - packages/server/src/__tests__/sessionMiddleware.test.ts
  modified: []
decisions:
  - 'Used AppSocket type alias (Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) in sessionMiddleware to satisfy strict ESLint @typescript-eslint/no-unsafe-member-access on socket.data'
  - 'stub LOBBY GameState set on slot-2 join in roomStore — Phase 4 replaces with real initial state'
metrics:
  duration_minutes: 35
  completed_date: '2026-05-29'
  task_count: 3
  file_count: 4
---

# Phase 03 Plan 02: Room Store + Session Middleware Summary

In-memory room store (`roomStore.ts`) and Socket.io reconnection middleware (`sessionMiddleware.ts`) implemented as pure-function modules following the moveValidator.ts analog, with 17 passing unit tests (12 roomStore, 5 sessionMiddleware).

## Vitest Report

```
 ✓ src/__tests__/sessionMiddleware.test.ts (5 tests) 5ms
 ✓ src/__tests__/roomStore.test.ts (12 tests) 7ms

 Test Files  2 passed (2)
       Tests  17 passed (17)
    Start at  13:29:15
    Duration  516ms
```

## Final Type Signatures

```typescript
// Room and JoinResult types (from packages/server/src/roomStore.ts)

export type PlayerRecord = {
  socketId: string;
  sessionToken: string;
  slot: 1 | 2;
};

export type Room = {
  roomCode: string;
  players: [PlayerRecord | null, PlayerRecord | null];
  status: 'waiting' | 'playing' | 'ended';
  gameState: GameState | null;
  isProcessing: boolean;
  disconnectTimers: [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null];
};

export type JoinResult =
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_WAITING' | 'FULL' }
  | { ok: true; sessionToken: string; slot: 2 };
```

## Exported Function Signatures (roomStore.ts)

```typescript
export function createRoom(socketId: string): { roomCode: string; sessionToken: string };
export function joinRoom(roomCode: string, socketId: string): JoinResult;
export function getRoom(roomCode: string): Room | undefined;
export function deleteRoom(roomCode: string): void;
export function findPlayerByToken(sessionToken: string): { room: Room; slot: 1 | 2 } | null;
export function broadcastState(io: Server, room: Room): void;
export function clearAllRooms(): void; // @internal — test cleanup helper
```

## Exported Function Signature (sessionMiddleware.ts)

```typescript
export function sessionMiddleware(socket: AppSocket, next: (err?: Error) => void): void;
// where AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint strict typing on socket.data assignments in sessionMiddleware**

- **Found during:** Task 3 TDD GREEN pre-commit hook
- **Issue:** `socket: Socket` (plain untyped Socket from socket.io) caused `@typescript-eslint/no-unsafe-member-access` errors on all three `socket.data.*` assignments because `socket.data` resolved to `any` without generics.
- **Fix:** Added `AppSocket` type alias using `Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>` from `@counter-attack/shared`, replacing the plain `Socket` parameter type. The `import type { Socket } from 'socket.io'` is still present (acceptance criteria satisfied) — used within the AppSocket alias definition.
- **Files modified:** `packages/server/src/sessionMiddleware.ts`
- **Commit:** dd18e63

### Intentional Deviations from RESEARCH.md

**1. sessionMiddleware test file added (not in RESEARCH.md Wave 0 gaps)**

- RESEARCH.md Wave 0 gaps listed `roomStore.test.ts` but not `sessionMiddleware.test.ts`
- A sessionMiddleware unit test was added to provide adequate coverage and verify the guard+fallthrough behavior without requiring a live io instance
- This is consistent with the PATTERNS.md pattern of co-located unit tests for each module

## Known Stubs

| Stub                                               | File                                       | Reason                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stub LOBBY GameState (empty pieces, actionCount=0) | `packages/server/src/roomStore.ts:143-156` | Placeholder set on slot-2 join for ARCH-04 broadcast path. Phase 4 replaces with real initial state including KICK_OFF setup. Plan explicitly documents this as intentional. |

## TDD Gate Compliance

| Gate                           | Commit  | Status                                           |
| ------------------------------ | ------- | ------------------------------------------------ |
| RED (roomStore tests)          | ff8f1e3 | PASS — test file committed before implementation |
| GREEN (roomStore impl)         | 58e8d12 | PASS — all 12 tests pass                         |
| RED (sessionMiddleware tests)  | c592436 | PASS — test file committed before implementation |
| GREEN (sessionMiddleware impl) | dd18e63 | PASS — all 17 tests pass                         |

## Threat Flags

No new threat surface beyond the plan's threat model (T-03-03 through T-03-SC).

## Self-Check: PASSED

| Check                                                            | Result |
| ---------------------------------------------------------------- | ------ |
| `packages/server/src/roomStore.ts` exists                        | FOUND  |
| `packages/server/src/sessionMiddleware.ts` exists                | FOUND  |
| `packages/server/src/__tests__/roomStore.test.ts` exists         | FOUND  |
| `packages/server/src/__tests__/sessionMiddleware.test.ts` exists | FOUND  |
| Commit ff8f1e3 (test RED roomStore)                              | FOUND  |
| Commit 58e8d12 (feat GREEN roomStore)                            | FOUND  |
| Commit c592436 (test RED sessionMiddleware)                      | FOUND  |
| Commit dd18e63 (feat GREEN sessionMiddleware)                    | FOUND  |
