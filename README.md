<!-- generated-by: gsd-doc-writer -->

# Counter Attack POC

A browser-based, 2-player real-time implementation of Counter Attack — the hex-grid football strategy board game by Webstar Games. Two players connect via a shared room code and play a full match directly in their browser, no installation required.

## Installation

**Requirements:** Node.js >= 22, pnpm >= 9

```bash
git clone <repository-url>
cd counter-attack-poc
pnpm install
```

## Quick Start

1. Build shared types (required before running either package):

```bash
pnpm --filter @counter-attack/shared build
```

2. Start the game server (from the project root):

```bash
cd packages/server
pnpm dev
```

3. In a second terminal, start the client:

```bash
cd packages/client
pnpm dev
```

4. Open `http://localhost:5173` in two browser tabs (or two machines). One player creates a room and shares the code; the other player joins.

## Monorepo Structure

This is a pnpm workspaces monorepo with three packages:

```
packages/
  shared/   — Shared TypeScript types, game rules, validators, and hex utilities
  server/   — Express + Socket.io game server (Node.js 22)
  client/   — React + Vite frontend with SVG hex grid
```

## Usage

### Starting a match

1. Player 1 opens the app, selects a team, and creates a room — a short room code is displayed.
2. Player 2 opens the app, enters the room code, and selects the opposing team.
3. Both players are placed on the pitch and the match begins. Kick-off is decided according to Counter Attack rules.

### Gameplay

- Click a player piece to see valid move destinations highlighted on the hex grid.
- Click a destination hex to move. The game enforces Counter Attack movement rules (pace, Zone of Influence, tackle resolution, pass accuracy checks, and shooting duels).
- The action log panel on the right shows every event in the current sequence.
- The server validates all moves; the client is authoritative only for UI state.

## Available Scripts

Run from the project root:

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `pnpm build`        | Build all packages                 |
| `pnpm test`         | Run tests in all packages          |
| `pnpm lint`         | ESLint across the whole monorepo   |
| `pnpm format`       | Prettier format all files          |
| `pnpm format:check` | Check formatting without writing   |
| `pnpm typecheck`    | TypeScript type-check all packages |

Run inside `packages/server` or `packages/client`:

| Command          | Description                     |
| ---------------- | ------------------------------- |
| `pnpm dev`       | Start in development/watch mode |
| `pnpm build`     | Compile TypeScript to `dist/`   |
| `pnpm test`      | Run Vitest test suite           |
| `pnpm typecheck` | Type-check without emitting     |

## Environment Variables

| Variable          | Required | Default     | Description                                                       |
| ----------------- | -------- | ----------- | ----------------------------------------------------------------- |
| `PORT`            | No       | `3001`      | Port the game server listens on                                   |
| `NODE_ENV`        | No       | —           | Set to `production` to enable production warnings                 |
| `CORS_ORIGIN`     | No       | `*`         | Restrict WebSocket connections to a specific origin in production |
| `VITE_SOCKET_URL` | No       | Same origin | Override the Socket.io server URL for the client build            |

## Tech Stack

| Layer         | Technology                                                                       |
| ------------- | -------------------------------------------------------------------------------- |
| Backend       | Node.js 22 + Express 4 + Socket.io 4                                             |
| Frontend      | React 18 + Vite 5                                                                |
| Hex grid math | honeycomb-grid 4                                                                 |
| Client state  | Zustand 4                                                                        |
| Shared types  | TypeScript 5 (pnpm workspace package)                                            |
| Testing       | Vitest 2                                                                         |
| Deployment    | Render (via `render.yaml`); AWS Elastic Beanstalk path documented in `CLAUDE.md` |

## Deployment

A `render.yaml` is included for one-click deployment to Render.com. The build command installs pnpm, installs all workspace dependencies, builds all packages, and starts the server at `node packages/server/dist/main.js`.

For AWS deployment (the intended production target), see the deployment notes in `CLAUDE.md` — Elastic Beanstalk single-instance with the static client hosted on S3 + CloudFront.

Set `VITE_SOCKET_URL` at client build time to point at the deployed server URL, and set `CORS_ORIGIN` on the server to restrict cross-origin WebSocket connections.

## CI

GitHub Actions runs on every push and pull request (`.github/workflows/ci.yml`):

1. `pnpm install --frozen-lockfile`
2. Build `@counter-attack/shared` (generates types needed by consumers)
3. `pnpm -r typecheck`
4. `pnpm -r test`
5. `pnpm -r build`
