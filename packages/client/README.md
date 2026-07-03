<!-- generated-by: gsd-doc-writer -->

# @counter-attack/client

React + Vite frontend for Counter Attack POC. Renders the hex-grid pitch, handles all game screens (lobby, team selection, game board, replay), and maintains a real-time Socket.io connection to `@counter-attack/server`.

Part of the [Counter Attack POC](../../README.md) monorepo.

## Installation

This package is `private` and is not published to npm. Install dependencies from the monorepo root:

```bash
pnpm install
```

## Usage

### Development server

```bash
pnpm --filter @counter-attack/client dev
```

Starts the Vite dev server. The Vite proxy forwards `/socket.io` traffic to `ws://localhost:3001` (the server package), so both packages must be running for a full local session.

### Production build

```bash
pnpm --filter @counter-attack/client build
```

Outputs static files to `packages/client/dist/`. Set `VITE_SOCKET_URL` at build time to point at the deployed server:

```bash
VITE_SOCKET_URL=https://your-server-url pnpm --filter @counter-attack/client build
```

### Preview built output

```bash
pnpm --filter @counter-attack/client preview
```

## Key modules

| Path                                     | Description                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/main.tsx`                           | Application entry point — mounts `<App />` into `#root`                                                      |
| `src/App.tsx`                            | Top-level component — Socket.io event wiring, screen routing                                                 |
| `src/socket.ts`                          | Module-singleton `Socket<ServerToClientEvents, ClientToServerEvents>` (WebSocket only, `autoConnect: false`) |
| `src/store/useGameStore.ts`              | Zustand store — game state, screen, selection, pass target, and all derived hex highlights                   |
| `src/utils/hexToPixel.ts`                | Axial-to-pixel math for flat-top hex orientation; `axialToPixel`, `hexPolygonPoints`, `computeViewBox`       |
| `src/components/HexGrid.tsx`             | SVG pitch root — 37×26 ODD-Q offset grid with clip path, piece overlays, and ball marker                     |
| `src/components/GameBoard.tsx`           | Game screen shell — wraps HexGrid, ActionPanel, ActionLog, EventBanner, overlays                             |
| `src/components/LobbyScreen.tsx`         | Landing, create-room, join-room, and waiting screens                                                         |
| `src/components/TeamSelectionScreen.tsx` | Team and game-speed selection before kick-off                                                                |

## Screen flow

```
LANDING → CREATE_ROOM / JOIN_ROOM → WAITING → TEAM_SELECTION → GAME_BOARD → (REPLAY)
```

Screen state lives in the Zustand store (`screen` field). No React Router is used.

## Environment variables

| Variable          | Required | Default                   | Description                                |
| ----------------- | -------- | ------------------------- | ------------------------------------------ |
| `VITE_SOCKET_URL` | No       | `undefined` (same origin) | Socket.io server URL for production builds |

When `VITE_SOCKET_URL` is unset, the socket connects to the same origin — the Vite dev-server proxy handles this locally.

## Testing

```bash
# Run all client tests once
pnpm --filter @counter-attack/client test

# Type-check without emitting
pnpm --filter @counter-attack/client typecheck
```

Tests use [Vitest](https://vitest.dev/) with jsdom and `@testing-library/react`. Test files follow the `src/**/*.test.{ts,tsx}` naming convention and live alongside the source files they cover.
