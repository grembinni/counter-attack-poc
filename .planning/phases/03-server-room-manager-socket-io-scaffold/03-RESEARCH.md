# Phase 3: Server Room Manager + Socket.io Scaffold - Research

**Researched:** 2026-05-29
**Domain:** Express 4.x + Socket.io v4, room lifecycle management, session identity, disconnect/reconnect grace timers
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                              | Research Support                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| CONN-01 | Player can create a game room and receive a 4-6 character room code to share                                             | `nanoid` or `crypto.randomBytes` for code gen; server Map keyed on room code; emit `room:joined` with slot=1  |
| CONN-02 | Player can join an existing game room by entering a valid room code                                                      | Socket.io `socket.join(roomCode)`; emit `room:joined` with slot=2 to room; both players now in same IO room   |
| CONN-03 | Game starts automatically once both players have joined the room                                                         | Room `players` array length === 2 triggers `game:state` broadcast with `KICK_OFF` phase                       |
| CONN-04 | Server rejects join attempts for room codes that do not exist or are already in progress                                 | Guards on room existence + `status !== 'waiting'`; emit `room:error` with distinct messages                   |
| ARCH-01 | Game state is server-authoritative; clients send action intents and receive validated state broadcasts                   | All mutations go through server; full `GameState` broadcast via `game:state` after every validated change      |
| ARCH-04 | Server broadcasts full game state snapshot after every validated action (no differential patching)                       | `io.to(roomCode).emit(ServerEvents.GAME_STATE, state)` after every handler; no patch/delta                    |

</phase_requirements>

---

## Summary

Phase 3 installs Express 4.x and Socket.io v4 into `packages/server` and wires up the room lifecycle: room creation, room join, player slot assignment, session identity tokens for reconnection, and a 90-second disconnect grace timer. The `GameState` broadcast scaffold is also established so Phase 4 can hook into it without architectural changes.

The core architectural pattern is a server-side `Map<string, Room>` holding room state independently of Socket.io's own room adapter. Socket.io rooms are used for broadcasting (`io.to(roomCode).emit(...)`), but all game-level state — player slots, session tokens, disconnect timers — lives in the application-level Map. This separation means Phase 4 can evolve the Room object freely without touching Socket.io's internal room management.

Session identity uses a custom token pattern (not `socket.id`, which changes on reconnect). On first connect the server generates a `sessionToken` (UUID or 20-char random string), stores it in the Room's player record, and emits it back to the client via `room:joined`. On reconnect the client passes the token via `socket.handshake.auth.sessionToken`; a Socket.io middleware restores the player slot and cancels any pending grace timer.

**Primary recommendation:** Use the custom session-token + in-memory Map pattern (not `connectionStateRecovery`). `connectionStateRecovery` is simpler to configure but is not guaranteed to succeed and buffers events — for a turn-based game where full-state broadcast covers reconnection, the explicit session token approach gives more predictable control and maps directly to the 90-second grace timer requirement.

---

## Architectural Responsibility Map

| Capability                         | Primary Tier                 | Secondary Tier        | Rationale                                                                                      |
| ---------------------------------- | ---------------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| Room creation + code generation    | `packages/server` (roomStore) | —                     | Server-authoritative; client never generates room codes                                        |
| Room join + slot assignment        | `packages/server` (roomStore) | —                     | Validation must be server-side to enforce capacity and status guards                           |
| Session token generation           | `packages/server` (middleware) | —                    | Generated on first connect; tokens are secrets — must never originate client-side              |
| Socket.io broadcast (`game:state`) | `packages/server`             | —                     | `io.to(roomCode).emit()` after every state mutation; client is read-only receiver              |
| Disconnect grace timer             | `packages/server` (roomStore) | —                     | `setTimeout` stored per player slot; cancelled on reconnect within 90s                         |
| Health endpoint                    | `packages/server` (Express)   | —                     | `GET /health` returns 200; used by AWS ALB; lives in Express not Socket.io                     |
| Session token storage (client)     | Client (`localStorage`)       | —                     | Client persists token across page loads; passed back via `socket.handshake.auth.sessionToken`  |
| CORS configuration                 | `packages/server` (Socket.io) | Express (if REST)     | Socket.io `cors` option + Express `cors` middleware for the `/health` route                   |

---

## Standard Stack

### Core

| Library             | Version  | Purpose                                      | Why Standard                                                                            | Source                   |
| ------------------- | -------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| express             | 4.22.2   | HTTP server + `/health` route                | Project constraint (CLAUDE.md); most EB Node.js examples are Express                   | [VERIFIED: npm registry] |
| socket.io           | 4.8.3    | WebSocket server with room management        | Project constraint (CLAUDE.md); locked in STATE.md                                     | [VERIFIED: npm registry] |
| cors                | 2.8.6    | CORS middleware for Express HTTP routes      | Standard middleware; needed for `/health` to respond to ALB and for dev cross-origin    | [VERIFIED: npm registry] |
| nanoid              | 5.1.11   | Cryptographically random room code generator | ESM-native, no deps, collision-resistant; better than `Math.random()` for room codes    | [VERIFIED: npm registry] |

### Supporting (dev)

| Library          | Version | Purpose                              | When to Use                                                          |
| ---------------- | ------- | ------------------------------------ | -------------------------------------------------------------------- |
| tsx              | 4.22.3  | TypeScript execution for dev server  | `tsx watch src/main.ts` for hot reload during development            |
| vitest           | 4.1.7   | Unit test runner for server package  | Phase 3 introduces server unit tests for roomStore logic             |
| @types/express   | 5.0.6   | Express type declarations            | Required for TypeScript compilation                                  |
| @types/cors      | 2.8.19  | CORS type declarations               | Required for TypeScript compilation of cors middleware               |
| @types/node      | 25.9.1  | Node.js type stubs (already present) | Already a dev dep; may need version bump                             |

### Not Installing

| Library                   | Reason                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| helmet                    | Security headers middleware — useful but deferred to Phase 9 (AWS deployment); no browser clients yet   |
| `@socket.io/redis-adapter` | Not needed for single-instance POC; planned for Phase 9 scale path if needed                           |
| `express-validator`       | No user-input REST routes in Phase 3; only Socket.io events                                             |

### Alternatives Considered

| Instead of        | Could Use                     | Tradeoff                                                                                                                |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `nanoid`          | `crypto.randomBytes(3).toString('hex')` | Both are cryptographically random. `nanoid` is one import with no manual byte math. Either is fine. |
| Custom session token | `connectionStateRecovery` | `connectionStateRecovery` is built-in but not guaranteed to succeed; requires compatible adapters for multi-server. Custom token is explicit and deterministic — chosen for grace-timer control. |
| Express 4.22.2    | Express 5.2.1 (latest)        | Express 5 is stable (released 2024). CLAUDE.md specifies 4.x. Using 4.22.2 matches the constraint.                    |

**Installation:**

```bash
pnpm add --filter @counter-attack/server express socket.io cors nanoid
pnpm add -D --filter @counter-attack/server tsx vitest @types/express @types/cors
```

**Version verification:** All versions confirmed against npm registry on 2026-05-29.

---

## Package Legitimacy Audit

> slopcheck 0.6.1 run on 2026-05-29 against npm registry. All results below are from the scan output before the subprocess install step (which failed due to Windows shell — the scan itself completed successfully).

| Package      | Registry | Age              | Downloads           | Source Repo                      | slopcheck | Disposition |
| ------------ | -------- | ---------------- | ------------------- | -------------------------------- | --------- | ----------- |
| express      | npm      | 2010 (~15 yrs)   | 30M+/wk             | github.com/expressjs/express     | [OK]      | Approved    |
| socket.io    | npm      | 2010 (~15 yrs)   | 5M+/wk              | github.com/socketio/socket.io    | [OK]      | Approved    |
| cors         | npm      | 2013 (~12 yrs)   | 30M+/wk             | github.com/expressjs/cors        | [OK]      | Approved    |
| nanoid       | npm      | 2017 (~8 yrs)    | 50M+/wk             | github.com/ai/nanoid             | [OK]      | Approved    |
| @types/express | npm    | 2014 (~12 yrs)   | DefinitelyTyped     | github.com/DefinitelyTyped       | N/A (types pkg) | Approved |
| @types/cors  | npm      | 2016 (~9 yrs)    | DefinitelyTyped     | github.com/DefinitelyTyped       | N/A (types pkg) | Approved |
| tsx          | npm      | 2021 (~4 yrs)    | 5M+/wk              | github.com/privatenumber/tsx     | [OK]      | Approved    |
| vitest       | npm      | 2021 (~5 yrs)    | 10M+/wk             | github.com/vitest-dev/vitest     | [OK]      | Approved (already in shared) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Client Tab A                         packages/server                        Client Tab B
     │                                      │                                      │
     │  socket.handshake.auth.sessionToken  │                                      │
     ├─────── room:create ─────────────────►│                                      │
     │                                      │ roomStore.createRoom()                │
     │                                      │  → roomCode = nanoid(5)              │
     │                                      │  → sessionToken = crypto UUID        │
     │                                      │  → rooms.set(roomCode, Room)         │
     │                                      │  → socket.join(roomCode)             │
     │◄─────── room:joined ────────────────┤  → emit(room:joined, code, slot=1)   │
     │         (roomCode, slot=1,           │                                      │
     │          sessionToken)               │                                      │
     │                                      │                                      │
     │                                      │  room:join (roomCode)◄───────────────┤
     │                                      │ roomStore.joinRoom()                 │
     │                                      │  → guard: room exists?               │
     │                                      │  → guard: status === 'waiting'?      │
     │                                      │  → slot=2, sessionToken gen          │
     │                                      │  → socket.join(roomCode)             │
     │                                      │  → room.status = 'playing'           │
     │◄──────── room:joined ───────────────┤  io.to(roomCode)                     │
     │                                (both)│    .emit(room:joined, code, slot=2)  │
     │                                      │  io.to(roomCode)                     │
     │                                      │    .emit(game:state, initialState)►──┤
     │                                      │                                      │
     │  [Tab A disconnects]                 │                                      │
     │                                      │ socket.on('disconnect')              │
     │                                      │  → timer = setTimeout(90s, cleanup) │
     │                                      │  io.to(roomCode)                    │
     │                                      │    .emit(game:disconnect-warning)►───┤
     │                                      │                                      │
     │  [Tab A reconnects within 90s]       │                                      │
     │  socket.handshake.auth.sessionToken  │                                      │
     ├─────── reconnect ──────────────────►│                                      │
     │                                      │ middleware: findPlayerByToken()       │
     │                                      │  → clearTimeout(timer)               │
     │                                      │  → socket.join(roomCode)             │
     │                                      │  io.to(roomCode)                     │
     │◄──────── game:state ───────────────┤    .emit(game:state, currentState)►───┤
     │                                      │                                      │
  HTTP GET /health                          │                                      │
     ├─────────────────────────────────────►│                                      │
     │◄─────── 200 OK ────────────────────┤ res.json({ status: 'ok' })           │
```

### Recommended Project Structure

```
packages/server/
├── package.json          # add express, socket.io, cors, nanoid + dev deps
├── tsconfig.json         # existing — no changes needed
└── src/
    ├── main.ts           # entrypoint: createServer → httpServer → io → listen
    ├── createServer.ts   # factory: returns { httpServer, io } — testable without listen()
    ├── roomStore.ts      # Room type + Map<string, Room> + CRUD + disconnect timers
    ├── roomHandlers.ts   # socket event handlers: room:create, room:join
    └── sessionMiddleware.ts  # io.use() — session token lookup on every connection
```

**Why `createServer.ts` is separate from `main.ts`:** `main.ts` calls `httpServer.listen(PORT)`. Tests can import `createServer.ts` directly without binding to a port, enabling unit + integration tests for the room handlers.

### Pattern 1: Express + Socket.io Server Factory

**What:** The canonical pattern for wiring Express to Socket.io. `app.listen()` creates an independent HTTP server that Socket.io cannot intercept — must use `http.createServer(app)` explicitly.

**When to use:** Phase 3 only — `createServer.ts` is the single place this wiring lives.

**Example:**
```typescript
// packages/server/src/createServer.ts
// Source: socket.io/docs/v4/server-initialization/
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
  const app = express();
  app.use(cors());
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const httpServer = createServer(app);

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: process.env['CORS_ORIGIN'] ?? '*', methods: ['GET', 'POST'] },
    transports: ['websocket'], // locked decision: no polling
  });

  io.use(sessionMiddleware);

  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket);
  });

  return { app, httpServer, io };
}
```

[VERIFIED: socket.io/docs/v4/server-initialization/]

---

### Pattern 2: In-Memory Room Store

**What:** Application-level Map holding room state independently of Socket.io's adapter. Provides a single source of truth for room lifecycle.

**When to use:** Any server code that needs to look up or modify room state (room handlers, session middleware, disconnect timers).

**Example:**
```typescript
// packages/server/src/roomStore.ts
import { randomUUID } from 'crypto';
import { customAlphabet } from 'nanoid';
import type { GameState } from '@counter-attack/shared';

const genRoomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

export type PlayerRecord = {
  socketId: string;
  sessionToken: string;
  slot: 1 | 2;
};

export type Room = {
  roomCode: string;
  players: [PlayerRecord | null, PlayerRecord | null]; // index 0 = slot 1, index 1 = slot 2
  status: 'waiting' | 'playing' | 'ended';
  gameState: GameState | null;
  disconnectTimers: [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null];
};

const rooms = new Map<string, Room>();

export function createRoom(socketId: string): { roomCode: string; sessionToken: string } {
  const roomCode = genRoomCode();
  const sessionToken = randomUUID();
  const room: Room = {
    roomCode,
    players: [{ socketId, sessionToken, slot: 1 }, null],
    status: 'waiting',
    gameState: null,
    disconnectTimers: [null, null],
  };
  rooms.set(roomCode, room);
  return { roomCode, sessionToken };
}

export function getRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode);
}

export function deleteRoom(roomCode: string): void {
  rooms.delete(roomCode);
}

export function findPlayerByToken(sessionToken: string): { room: Room; slot: 1 | 2 } | null {
  for (const room of rooms.values()) {
    for (const player of room.players) {
      if (player?.sessionToken === sessionToken) {
        return { room, slot: player.slot };
      }
    }
  }
  return null;
}
```

[ASSUMED: `nanoid` customAlphabet API — confirmed package exists and is widely documented, but specific API surface not verified against official Context7 source. Verify at npmjs.com/package/nanoid before using.]

---

### Pattern 3: Session Middleware for Reconnection

**What:** `io.use()` middleware runs on every socket connection. If the client sends a `sessionToken` in `socket.handshake.auth`, the server looks it up and re-attaches the player to their room before the `connection` event fires.

**When to use:** Every connection — new and reconnection. Idempotent: if no token, falls through to fresh connection path.

**Example:**
```typescript
// packages/server/src/sessionMiddleware.ts
// Source: socket.io/docs/v4/middlewares/ + socket.io/get-started/private-messaging-part-2/
import type { Socket } from 'socket.io';
import { findPlayerByToken } from './roomStore.js';

export function sessionMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const token = socket.handshake.auth['sessionToken'] as string | undefined;
  if (token) {
    const found = findPlayerByToken(token);
    if (found) {
      // Restore slot context for the reconnection path in connection handler
      socket.data.sessionToken = token;
      socket.data.playerSlot = found.slot;
      socket.data.roomCode = found.room.roomCode;
    }
  }
  next(); // always proceed — new connections have no token
}
```

[VERIFIED: socket.io/docs/v4/middlewares/] [VERIFIED: socket.io/docs/v4/typescript/ — SocketData interface for socket.data]

---

### Pattern 4: Disconnect Grace Timer + Reconnect Cancellation

**What:** On disconnect, start a `setTimeout` for 90 seconds. Store the timer handle in the Room object. If the same session token reconnects, cancel the timer. If 90 seconds expire, clean up the room.

**When to use:** `socket.on('disconnect', ...)` — always wire disconnect in the same handler as room creation (STATE.md pitfall).

**Example:**
```typescript
// Inside roomHandlers.ts — disconnect handler
const GRACE_PERIOD_MS = 90_000;

socket.on('disconnect', () => {
  const room = getRoom(socket.data.roomCode);
  if (!room) return;

  const slotIndex = (socket.data.playerSlot as 1 | 2) - 1;
  const timer = setTimeout(() => {
    // Grace period expired — clean up room
    deleteRoom(room.roomCode);
  }, GRACE_PERIOD_MS);

  room.disconnectTimers[slotIndex] = timer;

  // Warn remaining player
  socket.to(room.roomCode).emit('game:disconnect-warning');
});

// On reconnect (inside connection handler, after middleware sets socket.data)
if (socket.data.roomCode && socket.data.playerSlot) {
  const room = getRoom(socket.data.roomCode);
  if (room) {
    const slotIndex = socket.data.playerSlot - 1;
    const existingTimer = room.disconnectTimers[slotIndex];
    if (existingTimer !== null) {
      clearTimeout(existingTimer);
      room.disconnectTimers[slotIndex] = null;
    }
    // Update socket ID in player record
    const player = room.players[slotIndex];
    if (player) player.socketId = socket.id;
    socket.join(room.roomCode);
    // Re-emit current game state
    if (room.gameState) {
      socket.emit('game:state', room.gameState);
    }
  }
}
```

[ASSUMED: exact timer + reconnect pattern — standard Node.js setTimeout pattern, no official Socket.io doc prescribes this exact approach. Pattern is well-established in the Socket.io community but not in official docs.]

---

### Pattern 5: Full-State Broadcast Helper

**What:** Every mutation to room game state must call a shared broadcast helper. This is the ARCH-04 requirement: no differential patching, always full snapshot.

**When to use:** Every event handler that changes game state in Phase 4+. The helper is defined in Phase 3 so Phase 4 has a stable calling convention.

**Example:**
```typescript
// packages/server/src/roomStore.ts (add to existing file)
export function broadcastState(io: Server, room: Room): void {
  if (!room.gameState) return;
  io.to(room.roomCode).emit('game:state', room.gameState);
}
```

[ASSUMED: helper pattern — consistent with locked decision "full-snapshot broadcast after every action" from STATE.md]

---

### Anti-Patterns to Avoid

- **`app.listen()` instead of `createServer(app)` + `httpServer.listen()`:** Socket.io cannot attach to Express's internal HTTP server created by `app.listen()`. Will silently fail — WebSocket upgrades never arrive. [VERIFIED: socket.io/docs/v4/server-initialization/]
- **Using `socket.id` as session identity:** `socket.id` is ephemeral — it changes on every reconnect. Using it for player slot identity means reconnections create new players. Always use a server-generated UUID stored in the Room.
- **Trusting client-supplied `playerSlot`:** Never let a client tell the server which slot it belongs to. The server assigns slots and communicates them back via `room:joined`. Client claims of slot ownership must be verified against the session token.
- **Omitting disconnect handler at room creation time (STATE.md pitfall):** Wire the disconnect handler in the same commit as room creation. Orphaned rooms accumulate until server restart otherwise.
- **Forgetting `socket.join(roomCode)` after reconnect:** On reconnect, the socket is new — it is NOT already in the Socket.io room. Must call `socket.join(roomCode)` again, or broadcasts to that room will miss the reconnected player.
- **Calling `io.to(room).emit()` from inside `socket.on('disconnect')` for the disconnected socket:** The disconnected socket has already left all rooms. Use `socket.to(room).emit()` (which excludes the sender) to reach the remaining player.
- **`transports: ['polling', 'websocket']` (both transports):** STATE.md locked decision is `transports: ['websocket']` only. Polling requires sticky sessions on multi-instance deployments. Set on both server `Server` options and client `io()` options.

---

## Don't Hand-Roll

| Problem                        | Don't Build                                    | Use Instead                                    | Why                                                                          |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Room code generation           | `Math.random().toString(36).slice(2, 7)`       | `nanoid` with custom alphabet                  | `Math.random()` is not cryptographically random; collision probability compounds at scale |
| WebSocket upgrade negotiation  | Raw `ws` with manual HTTP upgrade handling     | `socket.io` Server                             | Socket.io handles polling→websocket upgrade, ping/pong, reconnect backoff    |
| Room broadcast                 | Iterating `rooms.get(code).players` to find sockets | `io.to(roomCode).emit()`                  | Socket.io's room adapter handles socket lookup + emission atomically         |
| CORS headers                   | Manual `res.setHeader('Access-Control-Allow-Origin', ...)` | `cors` npm package                   | Handles preflight OPTIONS, credentials, multiple origin configs              |
| Session UUIDs                  | Custom hash function                           | `crypto.randomUUID()` (built-in Node.js 22+)  | `crypto.randomUUID()` is RFC 4122 UUID v4, cryptographically strong, built-in |

**Key insight:** The room manager's complexity is in the disconnect/reconnect lifecycle, not in the data structure. The Map is trivial; the timer management and reconnect identity resolution are where bugs appear. Keep the data model flat and explicit — no nested class hierarchies.

---

## Common Pitfalls

### Pitfall 1: Socket.io CORS Blocks HTTP Routes

**What goes wrong:** `GET /health` returns 200 locally (same origin) but fails from the ALB health check or from a different origin. The Express `cors()` middleware and Socket.io's `cors` option are independent. Setting one does not configure the other.

**Why it happens:** Socket.io's HTTP handshake (polling upgrade, connection info) goes through Socket.io's own CORS layer. Express HTTP routes use Express's middleware chain. Both need CORS configured.

**How to avoid:** Apply `cors()` Express middleware AND set `cors` in the Socket.io `Server` constructor. For dev, `origin: '*'` is fine. For production, set `CORS_ORIGIN` env var.

**Warning signs:** `OPTIONS /health` returns 403; `/socket.io/` polling requests fail from browser with CORS error.

---

### Pitfall 2: `socket.rooms` Is Empty in `disconnect` Handler

**What goes wrong:** Code inside `socket.on('disconnect', ...)` reads `socket.rooms` to find the room code — but `socket.rooms` is a Set and may already be cleared by the time the async handler runs.

**Why it happens:** Socket.io cleans up room membership synchronously on disconnect. If the handler awaits anything, `socket.rooms` may be empty when it resumes. [VERIFIED: socket.io/docs/v4/server-socket-instance/]

**How to avoid:** Store `roomCode` and `playerSlot` in `socket.data` during the connection phase (set by session middleware or room creation handler). Read from `socket.data.roomCode` in disconnect handlers — never from `socket.rooms`.

**Warning signs:** Disconnect handler runs but can't find the room; orphaned room timers never start.

---

### Pitfall 3: Duplicate `room:joined` Broadcast on Reconnect

**What goes wrong:** On reconnect, the middleware restores `socket.data.roomCode` and `socket.data.playerSlot`. If the `connection` handler then re-runs room creation or join logic without checking whether this is a reconnection, the client receives a second `room:joined` event with a new session token — overwriting the original one.

**Why it happens:** The `connection` event fires for both new connections and reconnections. Without an explicit `socket.data.sessionToken` guard, join logic runs twice.

**How to avoid:** In the `connection` handler, check `socket.data.sessionToken` first. If set (populated by middleware), handle as reconnection path (timer cancel + state re-emit). Only proceed to new room join logic if `socket.data.sessionToken` is undefined.

**Warning signs:** Client receives two `room:joined` events; `sessionToken` in localStorage gets overwritten on reconnect.

---

### Pitfall 4: Room Code Collisions

**What goes wrong:** Two concurrent `room:create` calls generate the same 5-character code. The second overwrites the first in the Map, leaving the first room's players in a ghost room.

**Why it happens:** With a 5-character alphanumeric code (32^5 = ~33M combinations), collision probability is low but not zero under concurrent load.

**How to avoid:** After generating a code, check `rooms.has(roomCode)` and regenerate if it collides. In practice a loop of 3 attempts is sufficient.

**Warning signs:** Rare but detectable: two different pairs of players find themselves in the same room.

---

### Pitfall 5: `isProcessing` Mutex Not Present in Phase 3

**What goes wrong:** Phase 4 adds game action handlers. Without the mutex already in the Room object, a second action arriving while the first is processing can corrupt room state. Adding the mutex after the fact requires all Phase 4 handlers to be retrofitted.

**Why it happens:** STATE.md explicitly locks "Per-room `isProcessing` mutex before any game logic". If not added to the Room type in Phase 3, Phase 4 has a structural gap.

**How to avoid:** Add `isProcessing: boolean` to the `Room` type in Phase 3 (defaulting to `false`). Phase 4 sets it before calling validators, clears it after broadcasting state.

**Warning signs:** Double-click on a button causes duplicate moves; game state has impossible values.

---

### Pitfall 6: `transports: ['websocket']` Must Be Set on Server AND Client

**What goes wrong:** Server accepts only WebSocket transport, but the client (Vite dev default) tries HTTP long-polling first. The upgrade fails; client is stuck.

**Why it happens:** Socket.io client default is `['polling', 'websocket']`. If the server rejects polling, the client cannot upgrade.

**How to avoid:** Client must also pass `transports: ['websocket']` to `io('url', { transports: ['websocket'] })`. Phase 3 does not wire the client — but add a comment in `createServer.ts` flagging this as a client requirement.

**Warning signs:** Connection fails locally in dev; browser network tab shows HTTP 400 on `/socket.io/` polling requests.

---

## Code Examples

Verified patterns from official sources:

### Express + Socket.io Typed Server (canonical)
```typescript
// Source: socket.io/docs/v4/server-initialization/ + socket.io/docs/v4/typescript/
import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@counter-attack/shared';

const app = express();
const httpServer = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket'],
});
```
[VERIFIED: socket.io/docs/v4/server-initialization/, socket.io/docs/v4/typescript/]

### Room Broadcast to All Members
```typescript
// Source: socket.io/docs/v4/rooms/
// Sends to EVERY socket in roomCode (both players), including sender
io.to(roomCode).emit('game:state', gameState);

// Sends to every socket in roomCode EXCEPT sender (use for disconnect-warning)
socket.to(roomCode).emit('game:disconnect-warning');
```
[VERIFIED: socket.io/docs/v4/rooms/]

### Session Token via Handshake Auth
```typescript
// Source: socket.io/docs/v4/middlewares/
// Client sends: io(url, { auth: { sessionToken: 'stored-uuid' } })
// Server middleware reads:
io.use((socket, next) => {
  const token = socket.handshake.auth['sessionToken'] as string | undefined;
  // ... lookup and restore session
  next();
});
```
[VERIFIED: socket.io/docs/v4/middlewares/]

### Health Endpoint Pattern
```typescript
// Standard Express health check — ALB pings this
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
```
[ASSUMED: exact response shape — standard convention, no canonical Socket.io/Express doc specifies this format]

---

## State of the Art

| Old Approach                                        | Current Approach                                   | When Changed        | Impact                                                                    |
| --------------------------------------------------- | -------------------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `socket.id` as persistent user identity             | Custom session token + `socket.handshake.auth`     | Socket.io v4 (2021) | `socket.id` changes on reconnect; stable token required for room recovery |
| Manual `http.createServer()` + `ws`                 | `socket.io` `Server` wrapping `http.createServer` | Socket.io v2+       | Room management, reconnect backoff, typed events built-in                 |
| `socket.emit` with untyped string event names       | Typed generics `Server<C, S, I, D>`                | Socket.io v3+       | TypeScript compile-time check on event names and payload shapes           |
| `connectionStateRecovery` for reconnect state       | Custom session-token + full-state re-emit          | Available v4.6.0    | `connectionStateRecovery` is not guaranteed to succeed; custom token is deterministic |

**Deprecated/outdated:**
- `socket.id` as a stable player identifier — changes on every reconnect
- `socket.rooms` inside async disconnect handlers — may be empty; use `socket.data` instead

---

## Assumptions Log

| #  | Claim                                                                                                               | Section                         | Risk if Wrong                                                                                         |
| -- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A1 | `nanoid` `customAlphabet` API signature: `customAlphabet(alphabet: string, size: number) => () => string`           | Standard Stack / Pattern 2      | API mismatch causes compile error; fix is to read nanoid README at npmjs.com/package/nanoid            |
| A2 | `crypto.randomUUID()` is available in Node.js 22 with no import needed (built-in)                                   | Don't Hand-Roll                 | LOW risk — confirmed in Node.js 22 release notes; crypto module export is stable                      |
| A3 | 90-second grace timer (requirement says 90s) will not cause memory pressure on a POC server                         | Architecture Patterns           | No risk for POC with 2 concurrent players; revisit if server hosts many rooms                         |
| A4 | `socket.data.roomCode` approach avoids the `socket.rooms` async-emptied-on-disconnect pitfall                       | Common Pitfalls / Pattern 4     | Pattern is community-standard but not explicitly documented in Socket.io official docs as the fix      |
| A5 | Express 4.22.2 is the latest 4.x release (matches CLAUDE.md constraint)                                            | Standard Stack                  | CLAUDE.md says "4.x" — latest in 4.x series is what to use; confirmed via npm registry                |
| A6 | `vitest` version 4.1.7 for server tests — same major version as shared package (2.1.9 → need to decide: pin to 2.x or upgrade) | Standard Stack | Version mismatch may not matter for separate package configs, but pinning 2.x across all packages avoids accidental major upgrade |

---

## Open Questions

1. **nanoid vs `crypto.randomBytes` for room codes**
   - What we know: Both produce cryptographically random codes. `nanoid` is clean, no deps. `crypto.randomBytes(3).toString('hex')` is built-in.
   - What's unclear: Team preference for external dep vs built-in
   - Recommendation: Use `nanoid` — it handles custom alphabet (no ambiguous characters like 0/O, 1/I) and is well-tested. If dep minimalism is a priority, `crypto.randomBytes(3).toString('hex').toUpperCase()` is equivalent.

2. **Vitest version in `packages/server` — pin to 2.x or upgrade?**
   - What we know: `packages/shared` uses Vitest 2.1.9. Vitest latest is 4.1.7.
   - What's unclear: Whether mixing Vitest versions across packages causes any issues (each package has its own config).
   - Recommendation: Install Vitest 2.x in server (matching shared) for consistency. Upgrade both in a future maintenance phase if needed.

3. **Should `game:state` be broadcast immediately upon room status = 'playing', or deferred to Phase 4?**
   - What we know: Success criteria item 4 says "server emits a full `game:state` broadcast after every validated state change". Phase 3 has no game logic yet.
   - What's unclear: Should Phase 3 emit a minimal/stub `GameState` when both players join?
   - Recommendation: Yes — emit a stub `GameState` with `phase: 'LOBBY'` when room reaches 2 players. This validates the broadcast path and satisfies success criterion 4. Phase 4 replaces the stub with real initial state.

---

## Environment Availability

| Dependency   | Required By                    | Available | Version   | Fallback |
| ------------ | ------------------------------ | --------- | --------- | -------- |
| Node.js 22   | Express + Socket.io runtime    | Yes       | v24.15.0  | —        |
| pnpm         | Package installation           | Yes       | (present) | —        |
| npm registry | Package installation           | Yes       | 11.12.1   | —        |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| Framework          | Vitest 2.x (matching `packages/shared` pinned version)                       |
| Config file        | `packages/server/vitest.config.ts` — Wave 0 gap, must be created             |
| Quick run command  | `pnpm --filter @counter-attack/server test`                                  |
| Full suite command | `pnpm --filter @counter-attack/server test`                                  |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                   | Test Type   | Automated Command                                    | File Exists?   |
| ------- | -------------------------------------------------------------------------- | ----------- | ---------------------------------------------------- | -------------- |
| CONN-01 | `createRoom()` returns unique 5-char alphanumeric code + sessionToken      | unit        | `pnpm --filter @counter-attack/server test`          | ❌ Wave 0      |
| CONN-01 | Two calls to `createRoom()` never return the same room code                | unit        | `pnpm --filter @counter-attack/server test`          | ❌ Wave 0      |
| CONN-02 | `joinRoom()` assigns slot=2 and transitions room to 'playing'              | unit        | `pnpm --filter @counter-attack/server test`          | ❌ Wave 0      |
| CONN-03 | Both players in room triggers `game:state` broadcast with `phase: 'LOBBY'` | integration | `pnpm --filter @counter-attack/server test`          | ❌ Wave 0      |
| CONN-04 | `joinRoom()` rejects unknown room code with `room:error`                   | unit        | `pnpm --filter @counter-attack/server test`          | ❌ Wave 0      |
| CONN-04 | `joinRoom()` rejects a room with status 'playing' with distinct error      | unit        | `pnpm --filter @counter-attack/server test`          | ❌ Wave 0      |
| ARCH-01 | State mutations only occur server-side (no client-side state calculation)  | manual-only | N/A — architectural constraint, not testable in unit | manual         |
| ARCH-04 | After any state change, `game:state` emits the full `GameState` object     | integration | `pnpm --filter @counter-attack/server test`          | ❌ Wave 0      |
| SC-3    | Reconnect within 90s cancels grace timer + re-emits state                  | integration | `pnpm --filter @counter-attack/server test`          | ❌ Wave 0      |
| SC-5    | `GET /health` returns HTTP 200                                              | smoke       | `curl http://localhost:PORT/health` (manual in dev)  | ❌ Wave 0      |

> SC-3 and SC-5 reference Phase 3 Success Criteria not directly tied to REQUIREMENTS.md IDs.

### Integration Test Strategy (Socket.io)

Socket.io integration tests (CONN-03, ARCH-04, SC-3) use `socket.io-client` connecting to the test server:

```typescript
// packages/server/src/__tests__/room.integration.test.ts
import { io as ioClient } from 'socket.io-client';
import { buildServer } from '../createServer.js';

// Start server on random port, connect two clients, assert room:joined events
```

This requires `socket.io-client` as a dev dependency in `packages/server`. [VERIFIED: socket.io/docs/v4/server-initialization/ — socket.io-client used for server-side testing in official Socket.io tutorial]

Add to dev deps:
```bash
pnpm add -D --filter @counter-attack/server socket.io-client
```

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/server build` (typecheck)
- **Per wave merge:** `pnpm --filter @counter-attack/server test`
- **Phase gate:** `pnpm -r build` green + `pnpm --filter @counter-attack/server test` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/vitest.config.ts` — Vitest config for server package
- [ ] `packages/server/src/__tests__/roomStore.test.ts` — unit tests for createRoom, joinRoom, findPlayerByToken
- [ ] `packages/server/src/__tests__/room.integration.test.ts` — Socket.io integration tests
- [ ] Framework install: `pnpm add -D --filter @counter-attack/server vitest socket.io-client`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                               |
| --------------------- | ------- | ------------------------------------------------------------------------------ |
| V2 Authentication     | Partial | Session token via `socket.handshake.auth` — not full auth, but identity token  |
| V3 Session Management | Yes     | Custom session token (UUID v4) + 90s grace period; server-side Map, not JWT    |
| V4 Access Control     | Yes     | Server validates slot ownership via session token; client cannot self-assign   |
| V5 Input Validation   | Yes     | Room codes from client must be validated as string, length 5, alphanumeric     |
| V6 Cryptography       | Yes     | `crypto.randomUUID()` for session tokens; `nanoid` for room codes — never `Math.random()` |

### Known Threat Patterns for This Stack

| Pattern                          | STRIDE      | Standard Mitigation                                                                            |
| -------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| Slot hijacking (client claims slot) | Spoofing   | Server assigns slots and verifies via session token; client slot claim is ignored             |
| Room code brute force            | Spoofing    | Rate limiting (deferred — Phase 9); 5-char alphanumeric is 33M combinations (acceptable POC) |
| Session token theft              | Spoofing    | Token is in `localStorage`; no HTTPS = cleartext risk in production. HTTPS enforced Phase 9  |
| Room enumeration                 | Information | Room codes are random; no API to list all rooms                                               |
| Event flooding / DoS             | Denial      | `isProcessing` mutex limits processing to one action per room at a time                       |
| Prototype pollution via events   | Tampering   | Never spread untrusted event payloads onto plain objects; use explicit field extraction        |

---

## Sources

### Primary (HIGH confidence)
- [socket.io/docs/v4/server-initialization/](https://socket.io/docs/v4/server-initialization/) — Express + http.createServer + Socket.io wiring pattern
- [socket.io/docs/v4/typescript/](https://socket.io/docs/v4/typescript/) — Typed Server generics, SocketData interface
- [socket.io/docs/v4/rooms/](https://socket.io/docs/v4/rooms/) — socket.join(), io.to().emit(), socket.to().emit(), automatic disconnect cleanup
- [socket.io/docs/v4/middlewares/](https://socket.io/docs/v4/middlewares/) — io.use() pattern, socket.handshake.auth, next() rejection
- [socket.io/docs/v4/server-socket-instance/](https://socket.io/docs/v4/server-socket-instance/) — socket.id, socket.data, socket.rooms, disconnect reasons
- [socket.io/docs/v4/server-options/](https://socket.io/docs/v4/server-options/) — cors option, transports option, pingTimeout/pingInterval defaults
- [socket.io/docs/v4/connection-state-recovery/](https://socket.io/docs/v4/connection-state-recovery/) — connectionStateRecovery evaluated and rejected for this phase

### Secondary (MEDIUM confidence)
- [socket.io/get-started/private-messaging-part-2/](https://socket.io/get-started/private-messaging-part-2/) — Custom session ID / InMemorySessionStore pattern (official Socket.io tutorial series)
- npm registry (`npm view <pkg> version`) — version verification for all packages

### Tertiary (LOW confidence)
- Community patterns for disconnect timer + reconnect cancellation — no official Socket.io doc prescribes the exact `setTimeout` + `clearTimeout` pattern; it is standard Node.js but the room-manager application of it is community convention

---

## Metadata

**Confidence breakdown:**
- Standard stack (Express + Socket.io + cors + nanoid): HIGH — all packages verified on npm registry; versions are current stable; slopcheck returned [OK] for all five
- Architecture (room Map + session token + middleware): HIGH — pattern derived from official Socket.io private-messaging tutorial and typescript docs
- Disconnect timer pattern: MEDIUM — standard Node.js setTimeout, community convention for the game room use case, no official doc prescribes exact form
- nanoid API (`customAlphabet`): MEDIUM — package is widely documented but API not verified against Context7/official docs in this session

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (Socket.io 4.x is stable; express 4.x is stable; check nanoid if > 30 days since v5 may have changed API)
