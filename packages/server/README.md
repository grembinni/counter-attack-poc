<!-- generated-by: gsd-doc-writer -->

# @counter-attack/server

The Socket.io + Express game server for Counter Attack POC. Manages room lifecycle, session identity, and all authoritative game logic for the 2-player real-time hex-grid football game.

Part of the [counter-attack-poc](../../README.md) monorepo.

## Installation

This is a private workspace package — it is not published to npm. Install from the monorepo root:

```bash
pnpm install
```

## Development

Build the shared types package first (required — the server imports from `@counter-attack/shared`):

```bash
pnpm --filter @counter-attack/shared build
```

Then start the development server with hot-reload from this package directory or the monorepo root:

```bash
# From packages/server
pnpm dev

# From monorepo root
pnpm --filter @counter-attack/server dev
```

The server listens on port `3001` by default. Set `PORT` to override.

## Scripts

| Command          | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `pnpm dev`       | Build shared, then run `src/main.ts` with `tsx watch` (hot reload) |
| `pnpm build`     | Compile TypeScript to `dist/` via `tsc`                            |
| `pnpm typecheck` | Type-check without emitting output                                 |
| `pnpm clean`     | Delete the `dist/` directory                                       |
| `pnpm test`      | Run the full test suite with Vitest                                |

## Environment Variables

| Variable      | Required | Default | Description                                                                             |
| ------------- | -------- | ------- | --------------------------------------------------------------------------------------- |
| `PORT`        | No       | `3001`  | TCP port the HTTP server listens on                                                     |
| `CORS_ORIGIN` | No (dev) | `*`     | Allowed origin for Socket.io CORS. **Must be set in production** — wildcard is dev-only |
| `NODE_ENV`    | No       | —       | Set to `production` to enable static SPA serving from `packages/client/dist`            |

> The server warns at startup if `NODE_ENV=production` and `CORS_ORIGIN` is unset.

## Architecture

The server is built as a factory (`buildServer()`) that wires together Express and Socket.io without binding to a port. `main.ts` calls the factory and then calls `httpServer.listen()`. This separation lets tests import the factory and listen on port `0` without side effects.

**Key modules:**

| File                   | Responsibility                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `main.ts`              | Entry point — calls `buildServer()` and binds to `PORT`                                     |
| `createServer.ts`      | Express + Socket.io factory; wires CORS, health endpoints, session middleware, and handlers |
| `roomStore.ts`         | In-memory `Map<string, Room>` holding all room and player state                             |
| `roomHandlers.ts`      | Socket events: `ROOM_CREATE`, `ROOM_JOIN`, `TEAM_PICK`, disconnect/grace-timer logic        |
| `gameHandlers.ts`      | Socket events: all in-game actions (move, pass, shoot, roll, end-turn, etc.)                |
| `gameEngine.ts`        | Pure-function FSM — all state transitions; no Socket.io dependencies                        |
| `sessionMiddleware.ts` | Socket.io `io.use()` middleware that restores player identity from session tokens           |
| `diceUtils.ts`         | Dice roll helpers used by `gameEngine.ts`                                                   |

**Design invariants:**

- **Server-authoritative (ARCH-01):** all slot assignment, FSM transitions, and identity resolution happen on the server. Clients emit events; the server validates and broadcasts the resulting state.
- **Full-state broadcast (ARCH-04):** after every validated action, `broadcastState()` emits the complete `GameState` snapshot to all sockets in the room. No differential patching.
- **WebSocket-only transport:** Socket.io is configured with `transports: ['websocket']`, eliminating sticky-session requirements on a single-instance AWS deployment.
- **Reconnect with grace timer:** on disconnect, a 90-second timer starts before the room is deleted. A reconnecting socket (identified by session token) cancels the timer and receives a full state re-emit.

## HTTP Endpoints

| Method | Path       | Description                                                         |
| ------ | ---------- | ------------------------------------------------------------------- |
| GET    | `/health`  | Returns `{ status: 'ok', timestamp: <ISO> }` — AWS ALB health check |
| GET    | `/healthz` | Returns plain-text `ok` — Render health check                       |

All game communication uses Socket.io events, not REST.

## Testing

```bash
pnpm test
```

Vitest runs the full suite (`src/**/*.test.ts`) in a Node environment. Tests cover:

- Unit: `roomStore`, `gameEngine`, `sessionMiddleware`, `diceUtils`
- Integration: room lifecycle, kick-off setup, game flow, replay streaming, static serving

Run a single test file:

```bash
pnpm vitest run src/__tests__/roomStore.test.ts
```
