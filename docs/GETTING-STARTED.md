<!-- generated-by: gsd-doc-writer -->

# Getting Started

This guide walks through cloning the repository, installing dependencies, and running the Counter Attack POC locally for the first time.

---

## Prerequisites

Before you begin, install the following tools:

| Tool    | Required Version   | Notes                                                                              |
| ------- | ------------------ | ---------------------------------------------------------------------------------- |
| Node.js | `>= 22`            | `.nvmrc` pins version `22` — use `nvm use` to switch automatically                 |
| pnpm    | `>= 9`             | Required package manager; `npm install -g pnpm@9.15.9` to match the locked version |
| Git     | Any recent version | For cloning the repository                                                         |

> **Using nvm:** The repository includes a `.nvmrc` file pinned to Node 22. Run `nvm use` in the project root to switch to the correct version automatically.

---

## Installation Steps

1. Clone the repository:

```bash
git clone <repository-url>
cd counter-attack-poc
```

2. Install all workspace dependencies (run from the project root):

```bash
pnpm install
```

3. Build the shared package. The `@counter-attack/shared` package must be compiled before the server or client can start, because they depend on its generated TypeScript declarations:

```bash
pnpm --filter @counter-attack/shared build
```

---

## First Run

The game requires two processes running simultaneously: the game server and the Vite development client.

**Terminal 1 — game server:**

```bash
cd packages/server
pnpm dev
```

The server starts on port `3001` by default. You should see:

```
Counter Attack server listening on port 3001
```

**Terminal 2 — client dev server:**

```bash
cd packages/client
pnpm dev
```

Vite starts on `http://localhost:5173`. The dev server proxies all `/socket.io` traffic to `ws://localhost:3001` automatically — no `VITE_SOCKET_URL` configuration is needed in development.

**Play the game:**

Open `http://localhost:5173` in two separate browser tabs (or on two machines on the same network). One player creates a room and shares the room code; the other player enters it to join.

---

## Common Setup Issues

**Wrong Node.js version**

The project requires Node.js 22. If you see syntax errors or module resolution failures on startup, check your active version:

```bash
node --version
```

If it shows a version below 22, switch with `nvm use 22` (requires nvm) or install Node 22 LTS from [nodejs.org](https://nodejs.org).

**`@counter-attack/shared` types not found**

If the server or client fails to start with errors like `Cannot find module '@counter-attack/shared'` or missing type declarations, the shared package has not been built yet. Run:

```bash
pnpm --filter @counter-attack/shared build
```

This must be re-run any time you make changes to `packages/shared/src/` and are running the server outside of its `pnpm dev` watch mode.

**Port 3001 already in use**

If the server fails to bind with `EADDRINUSE`, another process is using port 3001. Override the port with:

```bash
PORT=3002 pnpm dev
```

Note: the Vite proxy in `packages/client/vite.config.ts` points at `ws://localhost:3001`. If you change the server port, update the proxy `target` value in that config file to match.

**`pnpm install` fails with lockfile mismatch**

The lockfile (`pnpm-lock.yaml`) is committed and must stay in sync. If install fails with a frozen-lockfile error, ensure you are using pnpm >= 9:

```bash
pnpm --version
```

Upgrade if needed: `npm install -g pnpm@9.15.9`

---

## Next Steps

- **Development workflow:** See [DEVELOPMENT.md](../docs/DEVELOPMENT.md) for build commands, code style tools, and branch conventions.
- **Testing:** See [TESTING.md](../docs/TESTING.md) for how to run the test suite and write new tests.
- **Configuration:** See [CONFIGURATION.md](CONFIGURATION.md) for all environment variables (required for production deployment).
- **Architecture:** See [ARCHITECTURE.md](ARCHITECTURE.md) for a component diagram and data flow overview.
