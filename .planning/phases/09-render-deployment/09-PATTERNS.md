# Phase 9: Render Deployment - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 5 (3 modified, 2 created)
**Analogs found:** 3 / 5 (2 new files have no codebase analog — use RESEARCH.md patterns)

---

## File Classification

| New/Modified File                     | Role              | Data Flow        | Closest Analog                               | Match Quality                                      |
| ------------------------------------- | ----------------- | ---------------- | -------------------------------------------- | -------------------------------------------------- |
| `packages/server/src/createServer.ts` | middleware/config | request-response | `packages/server/src/createServer.ts` (self) | exact — modify in place                            |
| `packages/server/src/main.ts`         | config/entry      | request-response | `packages/server/src/main.ts` (self)         | exact — modify in place                            |
| `packages/client/src/socket.ts`       | config/utility    | request-response | `packages/client/src/socket.ts` (self)       | exact — modify in place                            |
| `render.yaml`                         | config            | —                | none                                         | no analog                                          |
| `.github/workflows/ci.yml`            | config/CI         | —                | `node_modules/.pnpm/rfdc@1.4.1/.../ci.yml`   | poor — outdated npm-based pattern; use RESEARCH.md |

---

## Pattern Assignments

### `packages/server/src/createServer.ts` (middleware/config, request-response)

**Analog:** Self — read at lines 1–157. Modify in place.

**Current imports pattern** (lines 15–30):

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@counter-attack/shared';
import cors from 'cors';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerGameHandlers } from './gameHandlers.js';
import { sessionMiddleware } from './sessionMiddleware.js';
import { getRoom } from './roomStore.js';
import { ServerEvents } from '@counter-attack/shared';
```

**Additions required — new imports** (prepend to existing import block or add at top of file):

```typescript
import { fileURLToPath } from 'url';
import path from 'path';
```

**Existing health route pattern** (lines 57–60) — the anchor for D-02 insertion:

```typescript
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

**D-02 — new /healthz route** (insert immediately after line 60, before `const httpServer = createServer(app)`):

```typescript
// D-02: Render health check endpoint. Plain text 'ok'; registered BEFORE static
// middleware so app.get('*') SPA fallback cannot shadow it.
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});
```

**Existing httpServer creation** (line 62) — insertion point for D-03 block is AFTER line 156 (`return { app, httpServer, io };` is line 157; insert D-03 block between lines 154 and 156):

```typescript
const httpServer = createServer(app);
```

**D-03 — production static serving + SPA fallback** (insert after all Socket.io setup, before `return`):

```typescript
// D-03: Serve the React SPA in production. Must come AFTER /healthz and /health
// routes and AFTER Socket.io is attached to httpServer. Socket.io intercepts at the
// http.Server upgrade event — app.get('*') never sees WebSocket handshakes.
if (process.env['NODE_ENV'] === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // From packages/server/dist/createServer.js → packages/client/dist
  const clientDist = path.resolve(__dirname, '../../client/dist');

  app.use(express.static(clientDist));

  // SPA fallback: LAST route. Returns index.html for any path not matched above.
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
```

**Critical route registration order** (enforced by insertion points above):

1. `app.use(cors())` — line 51, unchanged
2. `app.get('/health', ...)` — lines 57-60, unchanged
3. `app.get('/healthz', ...)` — NEW after line 60
4. `const httpServer = createServer(app)` — line 62, unchanged
5. `new Server(httpServer, ...)` Socket.io — lines 67-76, unchanged
6. `io.use(sessionMiddleware)` — line 81, unchanged
7. `io.on('connection', ...)` — lines 83-154, unchanged
8. `if (NODE_ENV === 'production') { static + SPA fallback }` — NEW after line 154
9. `return { app, httpServer, io }` — line 156/157, unchanged

---

### `packages/server/src/main.ts` (config/entry, request-response)

**Analog:** Self — read at lines 1–18. Modify in place.

**Current listen call** (lines 15–18):

```typescript
const { httpServer } = buildServer();
const PORT = Number(process.env['PORT'] ?? 3001);
httpServer.listen(PORT, () => {
  console.log(`Counter Attack server listening on port ${PORT}`);
});
```

**D-05 — add '0.0.0.0' bind address** (replace lines 16–18 only):

```typescript
const PORT = Number(process.env['PORT'] ?? 3001);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Counter Attack server listening on port ${PORT}`);
});
```

**What does NOT change:** The CORS warn block (lines 7–12) and the `buildServer()` import (line 1) are untouched.

---

### `packages/client/src/socket.ts` (config/utility, request-response)

**Analog:** Self — read at lines 1–28. Modify in place.

**Current broken line** (line 14–15):

```typescript
const socketUrl: string =
  (import.meta.env['VITE_SOCKET_URL'] as string | undefined) ?? 'http://localhost:3001';
```

**D-04 — fix socketUrl type** (replace lines 14–15 only):

```typescript
const socketUrl = import.meta.env['VITE_SOCKET_URL'] as string | undefined;
```

**Why this works:** `socket.io-client`'s `io(undefined, opts)` connects to the page's own origin (same-origin WSS). The `?? 'http://localhost:3001'` fallback would bake a localhost URL into the Vite production bundle via `import.meta.env` inlining.

**What does NOT change:** Lines 1–13 (imports, JSDoc), lines 17–28 (`io(socketUrl, ...)` call with `autoConnect: false`, `transports: ['websocket']`, auth callback). The `io(socketUrl, ...)` call already accepts `string | undefined` — no other edits needed.

---

### `render.yaml` (config, infrastructure-as-code)

**Analog:** None in this codebase. Use RESEARCH.md Pattern 5 directly.

**Complete file content** (D-06):

```yaml
services:
  - type: web
    name: counter-attack-poc
    runtime: node
    plan: free
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm -r build
    startCommand: node packages/server/dist/main.js
    healthCheckPath: /healthz
    autoDeployTrigger: commit
    envVars:
      - key: NODE_VERSION
        value: '22'
      - key: NODE_ENV
        value: production
```

**Critical correctness rules (from RESEARCH.md anti-patterns):**

- `autoDeployTrigger: commit` — NOT `autoDeploy: true` (deprecated, generates warnings)
- `startCommand: node packages/server/dist/main.js` — NOT `index.js` (`index.js` is a library barrel with no `listen` call; server would silently exit)
- `corepack enable &&` must precede `pnpm install` — Render Node 22 includes corepack but pnpm is not pre-installed
- `NODE_VERSION: '22'` as an envVar (not a schema field) — this is Render's mechanism for Node version selection

---

### `.github/workflows/ci.yml` (config/CI, batch)

**Analog:** The only CI yml found in the repo (`node_modules/.pnpm/rfdc@1.4.1/.../ci.yml`) uses `actions/checkout@v2`, `actions/setup-node@v1`, and npm — all outdated and incompatible with this project's pnpm monorepo. Do not use it as a model. Use RESEARCH.md Pattern 6 directly.

**Complete file content** (D-07):

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm -r typecheck

      - run: pnpm -r test

      - run: pnpm -r build
```

**Critical correctness rules:**

- `pnpm/action-setup@v4` must come BEFORE `actions/setup-node@v4` so setup-node can detect the pnpm store path for `cache: 'pnpm'`
- `version: 9` matches `packageManager: pnpm@9.15.9` in root `package.json`
- `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build` match the scripts defined in root `package.json` (verified: all three packages have these scripts)
- Run order: typecheck → test → build; build last so a type error or test failure aborts before building

---

## Shared Patterns

### ESM `__dirname` substitute

**Source:** RESEARCH.md Pattern 1 (no existing codebase usage — this project has not needed `__dirname` before)
**Apply to:** `packages/server/src/createServer.ts` (D-03 production static block only)

```typescript
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

Note: `packages/server` has `"type": "module"` in `package.json` — `__dirname` is undefined in ESM. This substitute is mandatory. The static serving block is gated on `NODE_ENV === 'production'` so the CJS `__dirname` ReferenceError only manifests in production if this pattern is omitted.

### `process.env['KEY']` access style

**Source:** `packages/server/src/createServer.ts` line 71, `packages/server/src/main.ts` lines 7–12
**Apply to:** All env var references in new/modified server files

```typescript
process.env['NODE_ENV']; // bracket notation, not process.env.NODE_ENV
process.env['PORT']; // consistent with existing codebase style
```

### `import.meta.env['KEY']` access style

**Source:** `packages/client/src/socket.ts` line 14
**Apply to:** D-04 fix in socket.ts

```typescript
import.meta.env['VITE_SOCKET_URL'] as string | undefined;
```

### Express route handler signature (unused-param prefix)

**Source:** `packages/server/src/createServer.ts` line 58
**Apply to:** `/healthz` route handler and SPA fallback handler

```typescript
app.get('/healthz', (_req, res) => {
  // underscore prefix for unused `req`
  res.status(200).send('ok');
});

app.get('*', (_req, res) => {
  // same pattern for SPA fallback
  res.sendFile(path.join(clientDist, 'index.html'));
});
```

### Test harness pattern (for Wave 0 gap — `staticServing.test.ts`)

**Source:** `packages/server/src/__tests__/gameHandlers.test.ts` lines 14–54
**Apply to:** `packages/server/src/__tests__/staticServing.test.ts` (new test file in Wave 0)

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../createServer.js';

let httpServer: ReturnType<typeof buildServer>['httpServer'];

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});
```

The test should set `process.env['NODE_ENV'] = 'production'` before `buildServer()` and create a temp `packages/client/dist/index.html` fixture so the SPA fallback has a file to send.

---

## No Analog Found

| File                       | Role   | Data Flow      | Reason                                                                                         |
| -------------------------- | ------ | -------------- | ---------------------------------------------------------------------------------------------- |
| `render.yaml`              | config | infrastructure | No IaC files exist in this repo yet                                                            |
| `.github/workflows/ci.yml` | config | CI/batch       | No project-owned GitHub Actions exist; only a stale npm-based yml in a node_modules dependency |

---

## Metadata

**Analog search scope:** `packages/server/src/`, `packages/client/src/`, `.github/workflows/`, repo root
**Files scanned:** 5 source files read directly; 1 dependency CI yml inspected and rejected
**Pattern extraction date:** 2026-06-07

**Key finding — all three source modifications are self-analogs:** The files to be modified (`createServer.ts`, `main.ts`, `socket.ts`) are the direct targets. The patterns to copy from are extracted from the current state of those same files. The planner should instruct the implementer to read each file, locate the exact insertion/replacement point documented above, and apply the minimal diff.

**Key finding — no new packages:** Phase 9 requires zero new npm dependencies. `express.static`, `path`, and `url` (`fileURLToPath`) are all already available (`express` is installed; `path` and `url` are Node.js built-ins).
