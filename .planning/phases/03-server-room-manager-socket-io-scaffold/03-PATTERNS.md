# Phase 3: Server Room Manager + Socket.io Scaffold - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 9
**Analogs found:** 7 / 9

## File Classification

| New/Modified File                                        | Role           | Data Flow        | Closest Analog                              | Match Quality |
| -------------------------------------------------------- | -------------- | ---------------- | ------------------------------------------- | ------------- |
| `packages/server/package.json`                           | config         | —                | `packages/shared/package.json`              | exact         |
| `packages/server/src/main.ts`                            | entrypoint     | request-response | `packages/client/src/main.ts`               | role-match    |
| `packages/server/src/createServer.ts`                    | factory/config | request-response | `packages/server/src/index.ts` (stub)       | partial       |
| `packages/server/src/roomStore.ts`                       | service        | CRUD             | `packages/shared/src/moveValidator.ts`      | role-match    |
| `packages/server/src/roomHandlers.ts`                    | controller     | event-driven     | `packages/shared/src/events.ts`             | partial       |
| `packages/server/src/sessionMiddleware.ts`               | middleware     | request-response | `packages/shared/src/moveValidator.ts`      | partial       |
| `packages/server/vitest.config.ts`                       | config         | —                | `packages/shared/vitest.config.ts`          | exact         |
| `packages/server/src/__tests__/roomStore.test.ts`        | test           | —                | `packages/shared/src/moveValidator.test.ts` | exact         |
| `packages/server/src/__tests__/room.integration.test.ts` | test           | event-driven     | `packages/shared/src/hex.test.ts`           | role-match    |

---

## Pattern Assignments

### `packages/server/package.json` (config)

**Analog:** `packages/shared/package.json` (lines 1–28)

Copy the `shared` package.json shape verbatim. Replace `@counter-attack/shared` name with `@counter-attack/server`. The existing `packages/server/package.json` already has the correct skeleton — the planner must ADD new deps/devDeps without overwriting the existing `scripts.test` stub.

**Full shape to mirror** (`packages/shared/package.json` lines 1–28):

```json
{
  "name": "@counter-attack/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "clean": "node --eval \"...\""
  },
  "devDependencies": {
    "@types/node": "22.19.19",
    "vitest": "2.1.9"
  }
}
```

**Key differences for server:**

- Add `"dev": "tsx watch src/main.ts"` to scripts
- `scripts.test` must become `"vitest run"` (replacing the placeholder `echo`)
- Production deps go in `"dependencies"`, not `"devDependencies"`: `express`, `socket.io`, `cors`, `nanoid`
- Dev deps to add: `tsx`, `vitest@2.1.9` (match shared), `@types/express`, `@types/cors`, `socket.io-client`
- Pin vitest to `2.1.9` (same as `packages/shared`, not the `4.1.7` mentioned in RESEARCH.md — see Open Questions A6)

---

### `packages/server/src/main.ts` (entrypoint, request-response)

**Analog:** `packages/server/src/index.ts` (lines 1–19) — existing server stub shows the import-and-call pattern.

**Import + call pattern** (`packages/server/src/index.ts` lines 1–2):

```typescript
import type { HexCoord, GameState } from '@counter-attack/shared';
import { PITCH_HEXES, ClientEvents } from '@counter-attack/shared';
```

**Entrypoint pattern** (index.ts lines 10–17 — import factory, call it, then listen):

```typescript
export function bootstrap(): void {
  console.log('Counter Attack server placeholder...');
}
// Do NOT call bootstrap() at module level — callers must invoke it explicitly.
```

`main.ts` must be the ONLY file that calls `httpServer.listen()`. Import `buildServer` from `./createServer.js`, call it, then listen. Use `process.env['PORT'] ?? '3001'`.

**Pattern to follow:**

```typescript
// packages/server/src/main.ts
import { buildServer } from './createServer.js';

const { httpServer } = buildServer();
const PORT = Number(process.env['PORT'] ?? 3001);
httpServer.listen(PORT, () => {
  console.log(`Counter Attack server listening on port ${PORT}`);
});
```

---

### `packages/server/src/createServer.ts` (factory, request-response)

**Analog:** None exact. Closest is `packages/server/src/index.ts` (the import/export pattern) combined with RESEARCH.md Pattern 1 (verified against Socket.io docs).

**Import style pattern** — follow `packages/shared/src/moveValidator.ts` lines 1–2 (`.js` extension on all local imports, `type` keyword for type-only imports):

```typescript
import type { GameState, PlayerPiece, HexCoord } from './types.js';
import { hexDistance, getZoIDefenders } from './hex.js';
```

**Factory function pattern** — follow `packages/shared/src/moveValidator.ts` line 57 (named export function, no default exports):

```typescript
export function validateMove(state: GameState, piece: PlayerPiece, to: HexCoord): MoveResult {
```

**For `createServer.ts`, copy structure from RESEARCH.md Pattern 1 exactly** — it is the canonical Socket.io + Express wiring and is already verified. Key constraints from the codebase:

- All local imports use `.js` extension (NodeNext module resolution; enforced in `tsconfig.base.json`)
- `verbatimModuleSyntax: true` in `tsconfig.base.json` — `import type` for type-only imports
- Named exports only (no `export default`)

```typescript
// packages/server/src/createServer.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@counter-attack/shared';
import cors from 'cors';
import { registerRoomHandlers } from './roomHandlers.js';
import { sessionMiddleware } from './sessionMiddleware.js';

export function buildServer() {
  // ... (copy from RESEARCH.md Pattern 1)
}
```

---

### `packages/server/src/roomStore.ts` (service, CRUD)

**Analog:** `packages/shared/src/moveValidator.ts` — best match for a pure-function service module with discriminated union results.

**Module-level constant pattern** (`packages/shared/src/hex.ts` lines 4–12 — module-level const, not exported):

```typescript
const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 }, // E
  { q: 1, r: -1 }, // NE
  ...
];
```

Apply same pattern to the room Map — module-level, not exported:

```typescript
const rooms = new Map<string, Room>();
```

**Named function export pattern** (`packages/shared/src/moveValidator.ts` lines 57–98):

```typescript
export function validateMove(state: GameState, piece: PlayerPiece, to: HexCoord): MoveResult {
  if (state.movementSlot === null) return { ok: false, reason: 'WRONG_SLOT' };
  ...
}
```

Apply to `createRoom`, `joinRoom`, `getRoom`, `deleteRoom`, `findPlayerByToken`, `broadcastState` — each is a named export function.

**Discriminated union type pattern** (`packages/shared/src/moveValidator.ts` lines 28–40):

```typescript
export type MoveResult =
  | { ok: false; reason: 'WRONG_SLOT' | 'OUT_OF_RANGE' | ... }
  | { ok: true }
  | { ok: true; effect: { type: 'STEAL_ATTEMPT'; defenders: PlayerPiece[] } };
```

Apply same pattern to `joinRoom` result:

```typescript
export type JoinResult =
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_WAITING' | 'FULL' }
  | { ok: true; sessionToken: string; slot: 1 | 2 };
```

**JSDoc comment pattern** (`packages/shared/src/moveValidator.ts` lines 44–56 — multi-line JSDoc before each exported function, listing rule IDs):

```typescript
/**
 * Validates a single-step movement action in the Movement Phase.
 *
 * Guard precedence (tests must verify this order):
 * 1. WRONG_SLOT — movementSlot must not be null
 * ...
 * @param state - Current game state
 */
```

**Import pattern** (`packages/shared/src/moveValidator.ts` lines 1–2):

```typescript
import type { GameState, PlayerPiece, HexCoord } from './types.js';
import { hexDistance, getZoIDefenders } from './hex.js';
```

For roomStore, external imports use `type` keyword selectively:

```typescript
import { randomUUID } from 'crypto';
import { customAlphabet } from 'nanoid';
import type { GameState } from '@counter-attack/shared';
import type { Server } from 'socket.io';
```

---

### `packages/server/src/roomHandlers.ts` (controller, event-driven)

**Analog:** `packages/shared/src/events.ts` for the event name constants pattern. `packages/shared/src/moveValidator.ts` for guard-first logic with early returns.

**Event name import pattern** (`packages/shared/src/events.ts` lines 7–18):

```typescript
export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ...
} as const;

export const ServerEvents = {
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
  ...
} as const;
```

Import these constants from `@counter-attack/shared` — never hardcode event name strings in handlers.

**Guard-first pattern** (`packages/shared/src/moveValidator.ts` lines 59–66):

```typescript
if (state.movementSlot === null) return { ok: false, reason: 'WRONG_SLOT' };
if (hexDistance(piece.position, to) !== 1) return { ok: false, reason: 'OUT_OF_RANGE' };
if (state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r)) {
  return { ok: false, reason: 'OCCUPIED' };
}
```

Apply same early-return guard pattern in Socket.io event handlers:

```typescript
socket.on(ClientEvents.ROOM_JOIN, (roomCode: string) => {
  const result = joinRoom(roomCode, socket.id);
  if (!result.ok) {
    socket.emit(ServerEvents.ROOM_ERROR, result.reason);
    return;
  }
  // ... success path
});
```

**Handler registration pattern** — export a single `registerRoomHandlers(io, socket)` function (named export, no default). Handler file imports from roomStore with `.js` extension.

---

### `packages/server/src/sessionMiddleware.ts` (middleware, request-response)

**Analog:** `packages/shared/src/moveValidator.ts` — pure function with a single responsibility, early-return guard, named export.

**Single-function module pattern** (`packages/shared/src/moveValidator.ts` line 57):

```typescript
export function validateMove(...): MoveResult {
```

For middleware, the single exported function is:

```typescript
export function sessionMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
```

**Guard + fallthrough pattern** (always call `next()` — mirrors moveValidator always returning a result):

```typescript
// always proceed — new connections have no token
next();
```

**Import pattern** — uses `.js` extension on all local imports:

```typescript
import { findPlayerByToken } from './roomStore.js';
```

The `socket.data` fields populated by this middleware must match the `SocketData` interface exported from `packages/shared/src/events.ts`:

```typescript
/** Per-socket data stored by Socket.io (player slot, room code, etc.). */
export interface SocketData {
  playerSlot: 1 | 2;
  roomCode: string;
}
```

Note: RESEARCH.md Pattern 3 also sets `socket.data.sessionToken` — the `SocketData` interface in `packages/shared/src/events.ts` does not yet include this field. The planner must extend `SocketData` in `events.ts` to add `sessionToken?: string` before writing the middleware.

---

### `packages/server/vitest.config.ts` (config)

**Analog:** `packages/shared/vitest.config.ts` (lines 1–8) — exact match, copy verbatim.

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

No changes needed. The server's test files follow the same `src/**/*.test.ts` glob pattern.

---

### `packages/server/src/__tests__/roomStore.test.ts` (test, unit)

**Analog:** `packages/shared/src/moveValidator.test.ts` — exact match for unit test structure.

**Import pattern** (`packages/shared/src/moveValidator.test.ts` lines 1–3):

```typescript
import { describe, it, expect } from 'vitest';
import { validateMove } from './moveValidator.js';
import type { GameState, PlayerPiece } from './types.js';
```

Apply to roomStore test:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { createRoom, joinRoom, getRoom, findPlayerByToken, deleteRoom } from '../roomStore.js';
```

**Base fixture pattern** (`packages/shared/src/moveValidator.test.ts` lines 5–33 — const fixture at module level, spread to override in each test):

```typescript
const basePiece: PlayerPiece = { id: 'p1', teamId: 'home', position: { q: 5, r: 5 }, ... };
const baseState: GameState = { roomCode: 'TEST', phase: 'MOVEMENT', ... };
```

Apply to roomStore test — no base fixture needed since `createRoom` generates fresh state. Use `afterEach` to clear room Map between tests (the Map is module-level in roomStore.ts — expose a `clearRooms()` test-only helper or reset via deleteRoom in afterEach).

**Describe + it naming pattern** (`packages/shared/src/moveValidator.test.ts` lines 35–170):

- Top-level `describe` = function name: `describe('createRoom', () => {`
- `it` descriptions state the expected behavior: `it('returns a 5-char uppercase room code', () => {`
- For reject paths: `it('returns NOT_FOUND when room code does not exist', () => {`

**Discriminated union assertion pattern** (`packages/shared/src/moveValidator.test.ts` lines 38–41):

```typescript
expect(result.ok).toBe(false);
if (!result.ok) expect(result.reason).toBe('WRONG_SLOT');
```

Apply same pattern:

```typescript
expect(result.ok).toBe(false);
if (!result.ok) expect(result.reason).toBe('NOT_FOUND');
```

---

### `packages/server/src/__tests__/room.integration.test.ts` (test, event-driven)

**Analog:** `packages/shared/src/hex.test.ts` for describe/it structure. No Socket.io integration test exists in the codebase — RESEARCH.md's integration test pattern is the primary reference.

**Import pattern** (follow hex.test.ts lines 1–10, but with socket.io-client):

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { buildServer } from '../createServer.js';
import type { ServerToClientEvents, ClientToServerEvents } from '@counter-attack/shared';
```

**Server lifecycle pattern** — start server in `beforeEach` on port 0 (random), stop in `afterEach`:

```typescript
let httpServer: ReturnType<typeof buildServer>['httpServer'];
let address: string;

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  const port = (httpServer.address() as { port: number }).port;
  address = `http://localhost:${port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});
```

**Client connection helper** — typed socket client:

```typescript
function createClient(opts?: { auth?: { sessionToken?: string } }) {
  return ioClient<ServerToClientEvents, ClientToServerEvents>(address, {
    transports: ['websocket'],
    ...opts,
  });
}
```

**Event assertion pattern** — wrap socket events in Promises:

```typescript
it('emits room:joined with slot=1 on room:create', async () => {
  const client = createClient();
  const result = await new Promise<{ roomCode: string; slot: number }>((resolve) => {
    client.on('room:joined', (roomCode, playerSlot) => {
      resolve({ roomCode, slot: playerSlot });
    });
    client.emit('room:create');
  });
  expect(result.slot).toBe(1);
  expect(result.roomCode).toHaveLength(5);
  client.disconnect();
});
```

---

## Shared Patterns

### `.js` Extension on All Local Imports

**Source:** `packages/shared/src/hex.ts` line 1, `packages/shared/src/moveValidator.ts` lines 1–2
**Apply to:** All new server files (NodeNext module resolution requires explicit `.js` extension)

```typescript
import type { HexCoord, PlayerPiece } from './types.js';
import { hexDistance, getZoIDefenders } from './hex.js';
```

### `verbatimModuleSyntax` — `import type` for Type-Only Imports

**Source:** `packages/shared/tsconfig.json` extends `tsconfig.base.json` which sets `"verbatimModuleSyntax": true`
**Apply to:** All new server files — any import used only as a type MUST use `import type`

```typescript
import type { GameState } from '@counter-attack/shared'; // type-only
import { ClientEvents, ServerEvents } from '@counter-attack/shared'; // value
```

### Named Exports Only (No Default Exports)

**Source:** All files in `packages/shared/src/` — every file uses named exports
**Apply to:** All new server source files

```typescript
export function buildServer() { ... }    // correct
export default function buildServer() {} // never
```

### JSDoc with Rule ID References

**Source:** `packages/shared/src/moveValidator.ts` lines 1–56
**Apply to:** `roomStore.ts`, `roomHandlers.ts`, `sessionMiddleware.ts` — reference CONN-01–04, ARCH-01, ARCH-04 in JSDoc

```typescript
/**
 * Creates a new room and assigns slot 1 to the creating socket.
 * CONN-01: server generates room code and session token; client never generates these.
 */
export function createRoom(socketId: string): { roomCode: string; sessionToken: string } {
```

### Discriminated Union Results

**Source:** `packages/shared/src/moveValidator.ts` lines 28–40
**Apply to:** `roomStore.ts` functions that can fail (createRoom, joinRoom) — return `{ ok: true; ... } | { ok: false; reason: string }`

```typescript
export type MoveResult =
  | { ok: false; reason: 'WRONG_SLOT' | ... }
  | { ok: true }
  | { ok: true; effect: { type: 'STEAL_ATTEMPT'; defenders: PlayerPiece[] } };
```

### `tsconfig.json` Shape (NodeNext + strict)

**Source:** `packages/shared/tsconfig.json` lines 1–12 + `tsconfig.base.json` lines 1–18
**Apply to:** `packages/server/tsconfig.json` (already exists and matches — verify no changes needed)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

Note: The existing `packages/server/tsconfig.json` already excludes `**/*.test.ts` absence — it does NOT exclude test files unlike shared (which does: `"exclude": [..., "**/*.test.ts"]`). This is fine; server test files are in `src/__tests__/` and will compile normally. If the planner needs a separate `tsconfig.test.json` (for test-only types), copy `packages/shared/tsconfig.test.json` exactly.

---

## No Analog Found

| File                                                     | Role    | Data Flow        | Reason                                                                                                                                       |
| -------------------------------------------------------- | ------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/createServer.ts`                    | factory | request-response | No Express+Socket.io server factory exists in the codebase; RESEARCH.md Pattern 1 (verified against socket.io docs) is the primary reference |
| `packages/server/src/__tests__/room.integration.test.ts` | test    | event-driven     | No Socket.io integration tests exist anywhere in the codebase; RESEARCH.md integration test strategy is the primary reference                |

---

## Metadata

**Analog search scope:** `packages/shared/src/`, `packages/server/src/`, `packages/client/src/`
**Files scanned:** 14 source files + 4 config files
**Pattern extraction date:** 2026-05-29
