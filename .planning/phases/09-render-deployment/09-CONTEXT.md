# Phase 9: Render Deployment - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Source:** PRD Express Path (RENDER_SETUP_FOR_COUNTER_ATTACK.md)

<domain>
## Phase Boundary

Deploy the counter-attack-poc app as a single Render web service: Express serves the
built React SPA and handles Socket.io from the same process and port. Add GitHub Actions
as the CI gate so broken commits don't ship.

This phase changes only how the app is hosted — not the game engine, authoritative-server
design, or Socket.io event protocol.

</domain>

<decisions>
## Implementation Decisions

### D-01: Single-service architecture (locked)

Deploy as ONE Render web service. Express serves the built client AND handles Socket.io.
No separate static-site service. Rationale: no CORS config, no cross-origin WS setup,
one URL, one deploy. Do NOT split into separate services.

### D-02: Health check at `/healthz` (locked)

Add `app.get('/healthz', (_req, res) => res.status(200).send('ok'))` to Express in
`createServer.ts`, BEFORE the static serving block. The existing `/health` endpoint may
be kept for backward compatibility but `/healthz` is what `render.yaml` references.

### D-03: Express static + SPA fallback (locked)

After all Socket.io and API route registration, add a `NODE_ENV=production` block in
`createServer.ts` that:

- Imports `path` and `{ fileURLToPath }` from `url` (server is ESM — no `__dirname`)
- Derives `__dirname` via `path.dirname(fileURLToPath(import.meta.url))`
- Resolves `clientDist` as `path.resolve(__dirname, '../../client/dist')`
- Serves `express.static(clientDist)`
- Adds `app.get('*', ...)` SPA fallback returning `index.html`
  Socket.io attaches to the HTTP server before Express routing, so the `*` fallback does
  NOT shadow Socket.io at `/socket.io/`.

### D-04: Client socket targets same-origin in production (locked)

In `packages/client/src/socket.ts`, the fallback must be `undefined` (same-origin),
not `'http://localhost:3001'`. Fix the socketUrl declaration:

```
const socketUrl = import.meta.env['VITE_SOCKET_URL'] as string | undefined;
```

Dev sessions that rely on `VITE_SOCKET_URL` proxy continue to work. In production the
socket connects to the page origin — no env var needed.

### D-05: Server binds `process.env.PORT` + `'0.0.0.0'` (locked)

In `packages/server/src/main.ts`, update `httpServer.listen(PORT, ...)` to include
`'0.0.0.0'` as the bind address. Render injects `PORT`; `0.0.0.0` is required.
Existing fallback to `3001` is fine for local dev.

### D-06: `render.yaml` at repo root (locked)

Create `render.yaml` with:

- `type: web`, `runtime: node`, `plan: free`
- `buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm -r build`
- `startCommand: node packages/server/dist/main.js`
- `healthCheckPath: /healthz`
- `autoDeploy: true`
- `envVars`: `NODE_VERSION: "22"`, `NODE_ENV: production`
  `pnpm -r build` relies on pnpm's topological ordering (shared → server/client).
  `startCommand` points at `main.js` (the actual server entry), NOT `index.js` (library exports barrel).

### D-07: GitHub Actions CI workflow (locked)

Create `.github/workflows/ci.yml` with:

- Triggers: `push`, `pull_request`
- Steps: `actions/checkout@v4` → `pnpm/action-setup@v4` → `actions/setup-node@v4`
  (node-version 22, cache pnpm) → `pnpm install --frozen-lockfile` →
  `pnpm -r typecheck` → `pnpm -r test` → `pnpm -r build`
  All three packages already have `typecheck` and `test` scripts.

### D-08: Keep `transports: ['websocket']` (locked — already set)

`socket.ts` already sets `transports: ['websocket']`. No change needed.

### D-09: CORS in production (informational)

`main.ts` already warns when `CORS_ORIGIN` is unset in production. With the single-service
architecture (same origin), cross-origin requests are not an issue. CORS_ORIGIN env var
is not required for the POC; the existing warn-but-continue behavior is acceptable.

### Claude's Discretion

- Whether to add `CORS_ORIGIN` to `render.yaml` envVars (leave as optional; same-origin
  makes it unnecessary)
- Order of `express.static` vs health route in the middleware chain (healthz must come
  before static to avoid index.html being returned for /healthz if the path ever conflicts)
- Whether to rename `/health` to `/healthz` or keep both (keeping both is safest)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Server entry and listen binding

- `packages/server/src/main.ts` — PORT binding and listen call; D-05 target

### Express app factory and route registration

- `packages/server/src/createServer.ts` — where /healthz (D-02) and static serving
  (D-03) must be added; health route ordering is critical

### Client socket connection

- `packages/client/src/socket.ts` — socketUrl declaration; D-04 target

### Build and package metadata

- `packages/server/package.json` — ESM (`"type": "module"`), `"main": "./dist/index.js"`,
  tsconfig outDir is `./dist`; startCommand uses `main.js` not `index.js`
- `packages/server/tsconfig.json` — `module: NodeNext`, `outDir: ./dist`, `rootDir: ./src`
- `packages/client/vite.config.ts` — `build.outDir: dist`; in prod the dist is at
  `packages/client/dist` relative to repo root
- Root `package.json` — `engines.node: ">=22"`; scripts: `build`, `typecheck`, `test`

### New files (to be created)

- `render.yaml` — repo root IaC (D-06)
- `.github/workflows/ci.yml` — CI gate (D-07)

</canonical_refs>

<specifics>
## Specific Ideas

- Client dist relative path from compiled `packages/server/dist/main.js`:
  `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')`
- ESM `__dirname` substitute: `import { fileURLToPath } from 'url'` +
  `const __dirname = path.dirname(fileURLToPath(import.meta.url))`
- `app.get('*')` fallback must be the LAST route registered so it doesn't shadow
  `/healthz` or any other route (Socket.io is safe — it's attached at HTTP layer)
- Render free plan has 15-min idle cold start; acceptable for POC, $7/mo starter removes it

</specifics>

<deferred>
## Deferred Ideas

- Fly.io alternative (cheaper at idle, needs Dockerfile + fly.toml) — deferred post-POC
- Upgrade from Render free to starter ($7/mo) — manual step for repo owner, not coded
- Separate CDN for static assets — explicitly deferred (premature at 2-player scale)
- Redis adapter for multi-instance Socket.io — deferred (single-instance Render is fine)
- `CORS_ORIGIN` enforcement in production — deferred (same-origin serving makes it moot)

</deferred>

---

_Phase: 09-render-deployment_
_Context gathered: 2026-06-07 via PRD Express Path (RENDER_SETUP_FOR_COUNTER_ATTACK.md)_
