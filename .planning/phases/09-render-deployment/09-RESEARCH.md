# Phase 9: Render Deployment - Research

**Researched:** 2026-06-07
**Domain:** Render.com platform deployment, Express static serving, GitHub Actions CI, ESM Node.js
**Confidence:** HIGH (all decisions locked in CONTEXT.md; platform specifics verified against official Render docs)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Single-service architecture — ONE Render web service. Express serves built client AND handles Socket.io. No separate static-site service.
- **D-02**: Health check at `/healthz` — `app.get('/healthz', ...)` in `createServer.ts`, BEFORE static serving block. Keep existing `/health` for backward compatibility.
- **D-03**: Express static + SPA fallback — gated on `NODE_ENV=production`; uses ESM `fileURLToPath`; `clientDist = path.resolve(__dirname, '../../client/dist')`; `app.get('*', ...)` SPA fallback AFTER all other routes.
- **D-04**: Client socket targets same-origin in production — `socketUrl` becomes `import.meta.env['VITE_SOCKET_URL'] as string | undefined` (no localhost fallback string).
- **D-05**: Server binds `'0.0.0.0'` — `httpServer.listen(PORT, '0.0.0.0', ...)`.
- **D-06**: `render.yaml` at repo root — `type: web`, `runtime: node`, `plan: free`, `buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm -r build`, `startCommand: node packages/server/dist/main.js`, `healthCheckPath: /healthz`, `autoDeployTrigger: commit` (note: `autoDeploy` is deprecated), `envVars: NODE_VERSION: "22", NODE_ENV: production`.
- **D-07**: GitHub Actions CI — triggers push+PR; steps: checkout@v4 → pnpm/action-setup@v4 → setup-node@v4 (node 22, cache pnpm) → install --frozen-lockfile → typecheck → test → build.
- **D-08**: Keep `transports: ['websocket']` — already set in socket.ts, no change.
- **D-09**: CORS in production — existing warn-but-continue behavior acceptable; no `CORS_ORIGIN` env var required for POC.

### Claude's Discretion

- Whether to add `CORS_ORIGIN` to render.yaml envVars (leave as optional; same-origin makes it unnecessary)
- Order of `express.static` vs health route in the middleware chain (healthz must come before static)
- Whether to rename `/health` to `/healthz` or keep both (keeping both is safest)

### Deferred Ideas (OUT OF SCOPE)

- Fly.io alternative
- Render free → starter upgrade
- Separate CDN for static assets
- Redis adapter for multi-instance Socket.io
- `CORS_ORIGIN` enforcement in production

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                | Research Support                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ARCH-05 | Server deployable to AWS Elastic Beanstalk (single instance) without architectural changes; Socket.io client configured for WebSocket-only transport (no polling fallback) | Render is the actual target; `transports: ['websocket']` already locked; `0.0.0.0` bind confirmed required by Render docs  |
| ARCH-06 | Static client build deployable to S3 + CloudFront                                                                                                                          | Render single-service (Express serves static files) is the implementation; `vite build` → `packages/client/dist` confirmed |

</phase_requirements>

---

## Summary

Phase 9 deploys the counter-attack-poc as a single Render web service where Express serves the built React SPA and handles Socket.io from the same process and port. All six code tasks are locked in CONTEXT.md; this research confirms platform specifics, validates the exact implementation patterns, and surfaces pitfalls the planner must guard against.

The core architectural insight is that Socket.io attaches to the raw HTTP server before Express routing takes effect. Therefore `app.get('*')` SPA fallback in Express does NOT intercept Socket.io WebSocket upgrade requests — those are handled at the HTTP server level by Socket.io's `Engine.IO` handshake, which listens for the `upgrade` event directly on the Node.js `http.Server` instance. This is the fundamental reason the single-service architecture works cleanly.

Three platform-specific facts are critical for the plan:

1. Render injects `PORT` as an env var (default `10000`); the server must bind `0.0.0.0` explicitly.
2. Render free tier spins down after 15 minutes of inactivity; Socket.io's default `pingInterval` (25 s) + `pingTimeout` (20 s) = 45 s, which is well within typical proxy idle timeouts — no Socket.io tuning needed.
3. The `autoDeploy` field in `render.yaml` is deprecated; use `autoDeployTrigger: commit` instead.

**Primary recommendation:** Implement all six locked decisions in CONTEXT.md in the exact order specified; no alternatives needed.

---

## Architectural Responsibility Map

| Capability                | Primary Tier                      | Secondary Tier | Rationale                                                            |
| ------------------------- | --------------------------------- | -------------- | -------------------------------------------------------------------- |
| React SPA serving         | API / Backend (Express static)    | —              | Single-service: Express serves `packages/client/dist`                |
| Socket.io WebSocket       | API / Backend (HTTP server layer) | —              | Socket.io attaches to http.Server before Express routing             |
| Health check              | API / Backend (Express route)     | —              | `/healthz` is an Express route registered before static middleware   |
| Client-side routing (SPA) | Browser / Client                  | —              | React Router handles in-browser; Express wildcard sends `index.html` |
| Build orchestration       | CDN / Static (build step)         | —              | `pnpm -r build` produces `packages/client/dist` for Express to serve |
| PORT binding              | API / Backend                     | —              | `0.0.0.0:PORT` on Render-injected PORT                               |

---

## Standard Stack

### Core (all packages already in the monorepo — no new installs)

| Library          | Version (in use) | Purpose                                       | Status                                     |
| ---------------- | ---------------- | --------------------------------------------- | ------------------------------------------ |
| express          | 4.22.2           | HTTP server, static middleware, health routes | Already installed [VERIFIED: npm registry] |
| socket.io        | 4.8.3            | WebSocket game protocol                       | Already installed [VERIFIED: npm registry] |
| socket.io-client | 4.8.3            | Client WebSocket                              | Already installed [VERIFIED: npm registry] |
| cors             | 2.8.6            | HTTP CORS headers                             | Already installed [VERIFIED: npm registry] |

### New Files (no new npm packages)

| File                       | Location  | Purpose                       |
| -------------------------- | --------- | ----------------------------- |
| `render.yaml`              | repo root | Render Blueprint IaC (D-06)   |
| `.github/workflows/ci.yml` | repo root | GitHub Actions CI gate (D-07) |

**No new npm packages are installed in this phase.** All required functionality (Express static middleware, `path`, `url` built-ins) is already present.

**Installation:** None required.

---

## Package Legitimacy Audit

> No new packages are installed in Phase 9. The packages already in the monorepo were audited during their respective phases. For completeness, the four server packages were re-checked.

| Package   | Registry | Age               | slopcheck | Disposition |
| --------- | -------- | ----------------- | --------- | ----------- |
| express   | npm      | ~15 yrs (2010)    | [OK]      | Approved    |
| socket.io | npm      | ~15 yrs (2010)    | [OK]      | Approved    |
| cors      | npm      | ~13 yrs (2013)    | [OK]      | Approved    |
| nanoid    | npm      | verified existing | [OK]      | Approved    |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (player A / B)
        |
        | HTTPS / WSS (same origin)
        v
  Render Web Service
  [Node.js process, PORT=10000]
        |
        +-- http.Server (Node core)
               |
               +-- Socket.io Engine.IO
               |     Listens for HTTP Upgrade → handles /socket.io/* at HTTP layer
               |     Game events: room:*, game:*
               |
               +-- Express app (mounted on same http.Server)
                     |
                     +-- GET /healthz   → 200 "ok"  (Render health check)
                     +-- GET /health    → 200 JSON  (backward compat)
                     +-- express.static(packages/client/dist)
                     |     Serves: main.js, CSS, assets (matched first)
                     +-- GET /* (SPA fallback)
                           Sends: packages/client/dist/index.html
```

**Key insight:** Socket.io intercepts at the `http.Server` level via the `upgrade` event — Express routing (`app.get('*')`) never sees WebSocket handshake requests. The `*` wildcard is safe.

### Recommended Project Structure (additions only)

```
counter-attack-poc/
├── render.yaml                    # NEW: Render Blueprint
├── .github/
│   └── workflows/
│       └── ci.yml                 # NEW: GitHub Actions CI
├── packages/
│   ├── server/
│   │   └── src/
│   │       ├── createServer.ts    # MODIFIED: +/healthz, +static serving
│   │       └── main.ts            # MODIFIED: +'0.0.0.0' bind address
│   └── client/
│       └── src/
│           └── socket.ts          # MODIFIED: socketUrl type fix
```

### Pattern 1: ESM `__dirname` substitute

**What:** Node.js ESM modules do not have `__dirname`. Use `fileURLToPath` from the built-in `url` module.

**When to use:** Any ESM module that needs `__dirname` for path resolution (D-03 in `createServer.ts`).

```typescript
// Source: Node.js official docs (https://nodejs.org/api/esm.html#importmetaurl)
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

**Critical path note:** `createServer.ts` compiles to `packages/server/dist/createServer.js`. The client dist is at `packages/client/dist`. From `dist/createServer.js`, the relative path is `../../client/dist`.

```typescript
// Verified path resolution for this monorepo layout
const clientDist = path.resolve(__dirname, '../../client/dist');
```

### Pattern 2: Express static + SPA fallback (production gate)

**What:** Serve the React SPA from Express, but only in production. Dev uses Vite dev server.

**Why gate on NODE_ENV:** In dev, Express and Vite run as separate processes (server on 3001, Vite on 5173 with proxy). Serving static files in dev would conflict with HMR.

```typescript
// Source: Express docs (https://expressjs.com/en/starter/static-files.html)
// Placement: AFTER /healthz and /health routes, AFTER Socket.io is attached to httpServer

if (process.env['NODE_ENV'] === 'production') {
  import { fileURLToPath } from 'url';
  import path from 'path';

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, '../../client/dist');

  app.use(express.static(clientDist));

  // SPA fallback: must be LAST route. Does NOT shadow /healthz or Socket.io.
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
```

**Route order in `createServer.ts`:**

1. `app.use(cors())` — existing
2. `app.get('/health', ...)` — existing
3. `app.get('/healthz', ...)` — NEW (D-02)
4. `const httpServer = createServer(app)` — existing
5. `new Server(httpServer, ...)` Socket.io — existing
6. `io.use(sessionMiddleware)` — existing
7. `io.on('connection', ...)` — existing
8. `if (NODE_ENV === 'production') { static + SPA fallback }` — NEW (D-03)

### Pattern 3: Server bind with `0.0.0.0`

**What:** Render requires services to bind `0.0.0.0` to accept traffic. [CITED: render.com/docs/web-services]

```typescript
// In packages/server/src/main.ts
const PORT = Number(process.env['PORT'] ?? 3001);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Counter Attack server listening on port ${PORT}`);
});
```

### Pattern 4: Client socket — same-origin production

**What:** When `VITE_SOCKET_URL` is not set, `io(undefined, ...)` connects to the page's own origin. [CITED: socket.io docs on client initialization]

```typescript
// In packages/client/src/socket.ts — current (broken for prod):
const socketUrl: string =
  (import.meta.env['VITE_SOCKET_URL'] as string | undefined) ?? 'http://localhost:3001';

// Fixed (D-04):
const socketUrl = import.meta.env['VITE_SOCKET_URL'] as string | undefined;
// socketUrl is undefined when VITE_SOCKET_URL is not set → connects to page origin
```

**Why this matters:** In production, the client is served from the same Express server at `https://your-app.onrender.com`. Without `VITE_SOCKET_URL`, `socketUrl` must be `undefined` (not `'http://localhost:3001'`) so `io(undefined, ...)` connects to the page origin over WSS.

### Pattern 5: `render.yaml` — complete spec

**What:** Render Blueprint IaC at repo root. [CITED: render.com/docs/blueprint-spec]

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

**Critical schema notes:**

- `autoDeploy: true` is DEPRECATED — use `autoDeployTrigger: commit` instead [CITED: render.com/docs/blueprint-spec]
- `NODE_VERSION` is set as an env var (not a schema field) — Render reads it to select Node.js version [CITED: render.com/docs/node-version]
- `startCommand` points to `main.js` (actual server entry), NOT `index.js` (library barrel that only exports, does not call `listen`)
- `corepack enable` must precede `pnpm install` because Render does not ship pnpm natively; corepack activates the pnpm version pinned in `packageManager` field

### Pattern 6: GitHub Actions CI

**What:** CI gate using pnpm/action-setup@v4 + actions/setup-node@v4. [CITED: github.com/pnpm/action-setup]

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

**Action version notes:**

- `pnpm/action-setup@v4` is a valid stable tag [CITED: github.com/pnpm/action-setup/tree/v4/]
- `pnpm/action-setup` latest is v6.0.8 (released May 2026) — v4 is still maintained and valid per CONTEXT.md D-07
- `actions/setup-node@v4` with `cache: 'pnpm'` handles store caching when pnpm/action-setup is installed first
- `version: 9` matches root `package.json` `"packageManager": "pnpm@9.15.9"` — corepack will pin the exact version

### Anti-Patterns to Avoid

- **Using `autoDeploy: true` in render.yaml:** Deprecated field — Render will accept it but emit a warning. Use `autoDeployTrigger: commit`.
- **`startCommand: node packages/server/dist/index.js`:** `index.js` is a library barrel (exports only, no `listen` call). Server never starts. Must use `main.js`.
- **`const socketUrl: string = ... ?? 'http://localhost:3001'`:** In production the string `'http://localhost:3001'` is a literal cross-origin URL that will fail (no CORS, wrong host). Must be `undefined`.
- **Omitting `'0.0.0.0'` from listen:** Render expects the service to bind all interfaces. Binding only `127.0.0.1` (Node.js default) means Render's health check and inbound traffic cannot reach the process.
- **Putting SPA fallback before `/healthz`:** Express routes are matched in registration order. If `app.get('*')` comes before `/healthz`, all health checks return `index.html` with 200 — Render cannot distinguish healthy from broken.
- **`app.get('*', ...)` intercepting Socket.io:** This does NOT happen. Socket.io operates at the `http.Server` level via the `upgrade` event, which Express does not handle. Express only processes HTTP requests where the Upgrade header was NOT sent.
- **Using `__dirname` directly in ESM:** `__dirname` is `undefined` in ES modules. Always derive it from `import.meta.url`.

---

## Don't Hand-Roll

| Problem                              | Don't Build                       | Use Instead                                      | Why                                                                       |
| ------------------------------------ | --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Static file serving                  | Custom file-read route            | `express.static()`                               | Handles ETags, conditional GET, MIME types, range requests                |
| SPA routing                          | Manual route array matching       | `app.get('*', ...)` + static middleware ordering | One-liner; ordering guarantees correct precedence                         |
| Node.js version management on Render | `.nvmrc` + manual corepack setup  | `NODE_VERSION` env var in render.yaml            | Highest-precedence override per Render docs                               |
| CI pnpm caching                      | `actions/cache` manual store path | `actions/setup-node@v4` with `cache: 'pnpm'`     | setup-node auto-detects pnpm store path when pnpm/action-setup runs first |

**Key insight:** Phase 9 is pure infrastructure configuration — no custom algorithms. Every problem has a one-liner solution from the existing stack.

---

## Common Pitfalls

### Pitfall 1: `startCommand` points at `index.js` instead of `main.js`

**What goes wrong:** Service silently exits after start (no `listen` call in `index.js`). Render marks deployment unhealthy.
**Why it happens:** `"main": "./dist/index.js"` in `package.json` is the library entry for consumers importing `@counter-attack/server`. The runnable server entry is `dist/main.js`.
**How to avoid:** `startCommand: node packages/server/dist/main.js` (explicit path, not `node .` or `npm start`).
**Warning signs:** Service shows "Deploy live" but health check immediately fails; Render dashboard shows repeated restarts.

### Pitfall 2: `autoDeploy: true` vs `autoDeployTrigger: commit`

**What goes wrong:** render.yaml linter warnings; future Render schema updates may reject the deprecated field.
**Why it happens:** `autoDeploy` was the original field; `autoDeployTrigger` was added with more granular values.
**How to avoid:** Use `autoDeployTrigger: commit` exclusively. [CITED: render.com/docs/blueprint-spec]

### Pitfall 3: `__dirname` in ESM without `fileURLToPath`

**What goes wrong:** `ReferenceError: __dirname is not defined` at runtime when `NODE_ENV=production` static serving block executes.
**Why it happens:** `packages/server` has `"type": "module"` — all `.js` files are ESM. `__dirname` is a CommonJS global.
**How to avoid:** `import { fileURLToPath } from 'url'; const __dirname = path.dirname(fileURLToPath(import.meta.url));`
**Warning signs:** Server starts but crashes on first HTTP request in production; stack trace points to `path.resolve(__dirname, ...)`.

### Pitfall 4: SPA fallback before health route

**What goes wrong:** `/healthz` returns `index.html` with HTTP 200, which passes Render's health check. But `/healthz?debug` returning HTML instead of `ok` signals wrong content type. More critically, any future monitoring that checks response body breaks.
**Why it happens:** Express routes match in registration order; `*` matches `/healthz`.
**How to avoid:** Register `/healthz` BEFORE `express.static()` and `app.get('*', ...)`.

### Pitfall 5: Render free tier cold start during initial connection

**What goes wrong:** First player to connect after 15 minutes of idle gets a ~60 second wait while Render spins up the instance. WebSocket connection may time out before the server is ready.
**Why it happens:** Free plan spins down idle services after 15 minutes. [CITED: render.com/docs/free]
**How to avoid (for POC):** Accept this limitation; it's acceptable per CONTEXT.md. Socket.io's autoConnect:false + explicit `socket.connect()` in the React component means the client retries connection. For starter plan ($7/mo), cold starts are eliminated.
**Warning signs:** First connection after idle period appears to hang; server logs show blank period followed by startup message.

### Pitfall 6: `corepack enable` missing from buildCommand

**What goes wrong:** `pnpm: command not found` during Render build. Render's Node.js 22 environment includes corepack but does not have pnpm pre-installed.
**Why it happens:** Render's native Node.js runtime doesn't include pnpm; corepack must be activated explicitly to recognize the `packageManager` field.
**How to avoid:** Prefix build command with `corepack enable &&`. [CITED: render.discourse.group/t/how-to-use-corepack/14297]

### Pitfall 7: Client socket URL hardcoded to localhost in production build

**What goes wrong:** Vite embeds `'http://localhost:3001'` into the production bundle at build time. Every production client tries to connect to localhost (the user's machine), not the Render service.
**Why it happens:** `import.meta.env` values are inlined by Vite at build time; `VITE_SOCKET_URL` is not set in Render env, so the fallback string `'http://localhost:3001'` gets baked in.
**How to avoid:** Fix D-04 — `socketUrl` must be `string | undefined` with no localhost fallback. `io(undefined, opts)` connects to page origin.

### Pitfall 8: `pnpm -r build` ordering assumption

**What goes wrong:** `shared` package isn't compiled before `server` or `client` reference its types, causing TypeScript errors during build.
**Why it happens (non-issue):** pnpm -r build executes scripts in topological order by default (dependencies before dependents). Since `server` and `client` declare `@counter-attack/shared: workspace:*`, pnpm sorts `shared` first. [CITED: pnpm.io/cli/recursive]
**Confirmation:** Topological ordering is guaranteed by default unless `--no-sort` is passed. The build command is correct as specified.

---

## Code Examples

### `/healthz` route in `createServer.ts`

```typescript
// Source: Express docs (https://expressjs.com/en/4x/api.html#res.send)
// Placement: after /health, before httpServer = createServer(app)
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});
```

Note: Returns plain text `ok` (not JSON). Render's healthCheckPath only checks HTTP status code, not body — either format works. Plain text matches common health check conventions.

### Complete main.ts `listen` call (D-05)

```typescript
// In packages/server/src/main.ts
// Replace: httpServer.listen(PORT, () => {
// With:
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Counter Attack server listening on port ${PORT}`);
});
```

### Socket.ts fix (D-04)

```typescript
// Replace line 14-15 in packages/client/src/socket.ts:
// const socketUrl: string =
//   (import.meta.env['VITE_SOCKET_URL'] as string | undefined) ?? 'http://localhost:3001';

// With:
const socketUrl = import.meta.env['VITE_SOCKET_URL'] as string | undefined;

// socket.io-client treats io(undefined, ...) as "connect to current page origin"
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
  // ... rest unchanged
});
```

---

## State of the Art

| Old Approach                                 | Current Approach                                    | Impact                                                              |
| -------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `autoDeploy: true` in render.yaml            | `autoDeployTrigger: commit`                         | Deprecated field; use new form                                      |
| `pnpm/action-setup@v2` / v3                  | `pnpm/action-setup@v4` (or v6)                      | v4 is stable; v6 is latest (May 2026); v4 valid per CONTEXT.md D-07 |
| `actions/setup-node@v3`                      | `actions/setup-node@v4`                             | v4 is current stable                                                |
| Separate static site + API service on Render | Single web service (Express serves SPA + Socket.io) | Simpler: no CORS, one URL, one deploy                               |

**Deprecated/outdated:**

- `autoDeploy` render.yaml field: replaced by `autoDeployTrigger`; still accepted but generates warnings
- `pnpm/action-setup` without specifying version: now accepts `version: 9` or reads `packageManager` from package.json

---

## Assumptions Log

| #   | Claim                                                                                                    | Section              | Risk if Wrong                                              |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| A1  | Render's native Node.js 22 environment includes corepack but requires `corepack enable` to activate pnpm | Pitfall 6, Pattern 5 | Build fails; fix: add `npm install -g pnpm` as alternative |
| A2  | `pnpm/action-setup@v4` (not v6) is a valid and still-maintained tag                                      | Pattern 6            | Workflow may warn about outdated action; fix: bump to v6   |

**All other claims are verified or cited from official Render docs or official pnpm docs.**

---

## Open Questions

1. **Render account and service setup**
   - What we know: Render provides a free tier; Blueprint auto-deploys from GitHub push
   - What's unclear: The user must create a Render account, connect the GitHub repo, and trigger the first Blueprint sync manually — this is a one-time human step outside the code tasks
   - Recommendation: Document as a manual verification step in the plan's wave, not a code task

2. **Socket.io ping keepalive on Render's proxy**
   - What we know: Render does not publish an explicit idle TCP timeout for WebSocket connections; Socket.io's default `pingInterval` (25 s) + `pingTimeout` (20 s) = 45 s heartbeat keeps connections alive
   - What's unclear: Render's actual proxy idle timeout in seconds — not documented
   - Recommendation: No Socket.io configuration change needed; the default heartbeat is well within expected proxy timeouts. Monitor in production; if disconnects appear, reduce `pingInterval` to 20 s.

---

## Environment Availability

| Dependency        | Required By                        | Available   | Version                            | Fallback              |
| ----------------- | ---------------------------------- | ----------- | ---------------------------------- | --------------------- |
| Node.js           | Server runtime                     | ✓           | v24.15.0 (local); v22 on Render    | —                     |
| pnpm              | Build orchestration                | ✓           | 9.15.9                             | —                     |
| corepack          | Render build activation of pnpm    | ✓           | bundled with Node.js 22+           | `npm install -g pnpm` |
| Git               | Render auto-deploy, GitHub Actions | ✓           | system                             | —                     |
| GitHub repository | Render webhook, CI                 | ✓           | github.com/user/counter-attack-poc | —                     |
| Render account    | Deployment target                  | NOT CHECKED | —                                  | Human prerequisite    |

**Missing dependencies with no fallback:**

- Render account: must be created manually by repo owner before `render.yaml` triggers a deploy. This is a human prerequisite, not a code blocker.

**Missing dependencies with fallback:**

- None applicable.

---

## Validation Architecture

### Test Framework

| Property      | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Framework     | Vitest 2.1.9                                                                                   |
| Server config | `packages/server/vitest.config.ts` — `environment: 'node'`, `include: src/**/*.test.ts`        |
| Client config | `packages/client/vitest.config.ts` — `environment: 'jsdom'`, `include: src/**/*.test.{ts,tsx}` |
| Quick run     | `pnpm -r test`                                                                                 |
| Full suite    | `pnpm -r typecheck && pnpm -r test && pnpm -r build`                                           |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                   | Test Type      | Automated Command                                     | File Exists?                               |
| ------- | ---------------------------------------------------------- | -------------- | ----------------------------------------------------- | ------------------------------------------ |
| ARCH-05 | Server binds 0.0.0.0, WebSocket-only transport             | smoke (manual) | verify Render health check passes                     | ❌ Wave 0 (smoke only — platform behavior) |
| ARCH-05 | `httpServer.listen` includes `'0.0.0.0'` arg               | unit           | `grep '0.0.0.0' packages/server/src/main.ts`          | ❌ Wave 0 (static verify)                  |
| ARCH-05 | Socket.io client transport is websocket-only               | unit           | existing test coverage for socket.ts                  | ✅ socket.ts already tested                |
| ARCH-06 | `pnpm -r build` produces `packages/client/dist/index.html` | integration    | `pnpm -r build && ls packages/client/dist/index.html` | ❌ Wave 0 (build verification)             |
| ARCH-06 | Express serves `index.html` for SPA fallback in production | unit           | `vitest` with `NODE_ENV=production` createServer test | ❌ Wave 0 gap                              |

**Note on ARCH-05 / ARCH-06:** These requirements are primarily platform-level deployment concerns. The automated tests that matter are:

1. The existing test suite must still pass after code changes (regression guard).
2. A `buildServer()` unit test with `NODE_ENV=production` should verify `/healthz` returns 200 and `GET /nonexistent` returns the SPA `index.html` (not 404).

### Sampling Rate

- **Per task commit:** `pnpm -r test` (fast — all three packages)
- **Per wave merge:** `pnpm -r typecheck && pnpm -r test && pnpm -r build`
- **Phase gate:** Full suite green + manual Render health check passing before close

### Wave 0 Gaps

- [ ] `packages/server/src/__tests__/staticServing.test.ts` — covers SPA fallback (`GET /*` returns `index.html`) and `/healthz` ordering (must come before static); requires mocking `process.env.NODE_ENV = 'production'` and a temp `client/dist/index.html` fixture.

_(Existing test infrastructure covers all other requirements — no framework install needed.)_

---

## Security Domain

> `security_enforcement` not explicitly set to false in config.json — section required.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                             |
| --------------------- | ------- | ------------------------------------------------------------ |
| V2 Authentication     | no      | Socket.io session token (already implemented)                |
| V3 Session Management | no      | sessionStorage token (already implemented)                   |
| V4 Access Control     | no      | Room-scoped game logic (already implemented)                 |
| V5 Input Validation   | no      | No new user input surfaces in this phase                     |
| V6 Cryptography       | no      | No new crypto in this phase                                  |
| V1 Architecture       | yes     | Single-origin serving eliminates cross-origin attack surface |

### Known Threat Patterns for Render Deployment

| Pattern                                                             | STRIDE                                                      | Standard Mitigation                                                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Serving `index.html` for `/healthz` before registering health route | Spoofing (false healthy state)                              | Register `/healthz` before `express.static()` — enforced by route order                       |
| `localhost:3001` hardcoded in production client build               | Elevation of Privilege (client connects to attacker server) | D-04 fix: `socketUrl = undefined` — connects to page origin                                   |
| Render free tier cold start → race on reconnect                     | Denial of Service (accidental)                              | Acceptable for POC; Socket.io `autoConnect: false` + explicit connect prevents premature auth |
| `CORS_ORIGIN='*'` in production                                     | Information Disclosure                                      | Acceptable for POC per D-09; single-origin serving means cross-origin WS is non-issue         |

---

## Sources

### Primary (HIGH confidence)

- [render.com/docs/websocket](https://render.com/docs/websocket) — WebSocket keepalive, SIGTERM shutdown, proxy behavior
- [render.com/docs/blueprint-spec](https://render.com/docs/blueprint-spec) — render.yaml schema, `autoDeployTrigger` (confirmed deprecated `autoDeploy`)
- [render.com/docs/free](https://render.com/docs/free) — 15-minute idle spindown, cold start ~60 seconds
- [render.com/docs/node-version](https://render.com/docs/node-version) — `NODE_VERSION` env var, precedence rules, Node 22 support confirmed
- [render.com/docs/environment-variables (docs.render.com)](https://docs.render.com/environment-variables) — `PORT` default 10000, `NODE_ENV` runtime injection
- [github.com/pnpm/action-setup/tree/v4/](https://github.com/pnpm/action-setup/tree/v4/) — v4 inputs, setup-node integration
- [pnpm.io/cli/recursive](https://pnpm.io/cli/recursive) — topological build ordering guarantee
- [Node.js ESM docs](https://nodejs.org/api/esm.html#importmetaurl) — `import.meta.url` + `fileURLToPath` pattern
- [render.discourse.group/t/how-to-use-corepack/14297](https://render.discourse.group/t/how-to-use-corepack/14297) — corepack enable in buildCommand

### Secondary (MEDIUM confidence)

- [dashdashhard.com/posts/socketio-on-render/](https://dashdashhard.com/posts/socketio-on-render/) — Socket.io on Render practical guide (NODE_VERSION env var pattern)
- [socket.io/docs/v4/troubleshooting-connection-issues/](https://socket.io/docs/v4/troubleshooting-connection-issues/) — pingInterval + pingTimeout sum less than proxy idle timeout

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages already installed; no new npm dependencies
- Architecture: HIGH — single-service pattern well-documented; Socket.io / Express coexistence is a well-understood Node.js pattern
- Render platform specifics: HIGH — verified against official Render docs (WebSocket, free tier, node-version, blueprint spec, env vars)
- GitHub Actions: HIGH — pnpm/action-setup@v4 + setup-node@v4 is documented and widely used pattern
- ESM `__dirname` pattern: HIGH — Node.js official docs
- Pitfalls: HIGH — most derived from reading actual source code + official docs

**Research date:** 2026-06-07
**Valid until:** 2026-09-07 (stable platform — 90 days; Render Blueprint schema rarely breaks)
