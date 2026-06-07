---
phase: 09-render-deployment
plan: '01'
subsystem: server
tags: [deployment, express, static-serving, health-check, socket-url]
dependency_graph:
  requires: []
  provides:
    - /healthz Render health check endpoint
    - NODE_ENV=production static SPA serving block
    - 0.0.0.0 server bind address
    - same-origin socket URL for production client
  affects:
    - packages/server/src/createServer.ts
    - packages/server/src/main.ts
    - packages/client/src/socket.ts
    - packages/server/src/__tests__/staticServing.test.ts
tech_stack:
  added: []
  patterns:
    - ESM __dirname substitute via fileURLToPath(import.meta.url)
    - express.static + app.get('*') SPA fallback gated on NODE_ENV=production
    - route registration order: /healthz before express.static before app.get('*')
key_files:
  created:
    - packages/server/src/__tests__/staticServing.test.ts
  modified:
    - packages/server/src/createServer.ts
    - packages/server/src/main.ts
    - packages/client/src/socket.ts
decisions:
  - D-02 locked: /healthz returns plain text 'ok'; registered before static middleware
  - D-03 locked: production static block derives __dirname from fileURLToPath(import.meta.url)
  - D-04 locked: socketUrl is string | undefined with no localhost fallback
  - D-05 locked: httpServer.listen(PORT, '0.0.0.0', ...) for Render bind
metrics:
  duration_seconds: 322
  completed_date: '2026-06-07'
  tasks_completed: 3
  files_changed: 4
---

# Phase 9 Plan 01: Render Deployment Prerequisites Summary

One-liner: Express /healthz + production static SPA serving + 0.0.0.0 bind + same-origin socket URL wired to make the monorepo deployable as a single Render web service.

## Tasks Completed

| Task | Name                                                                     | Commit  | Files                                                      |
| ---- | ------------------------------------------------------------------------ | ------- | ---------------------------------------------------------- |
| 1    | Add Wave 0 static-serving test scaffold (RED)                            | 3788e9f | packages/server/src/**tests**/staticServing.test.ts        |
| 2    | Add /healthz route and production static+SPA fallback to createServer.ts | 2a71169 | packages/server/src/createServer.ts                        |
| 3    | Bind 0.0.0.0 in main.ts (D-05) and fix socket URL in socket.ts (D-04)    | 9c0e5cd | packages/server/src/main.ts, packages/client/src/socket.ts |

## What Was Built

### D-02: /healthz health check endpoint

`app.get('/healthz', (_req, res) => res.status(200).send('ok'))` registered in `createServer.ts` immediately after the existing `/health` route, and critically BEFORE `express.static()` and the SPA fallback `app.get('*')`. Render's `healthCheckPath: /healthz` now resolves to a 200 plain-text response, not index.html.

### D-03: Production static + SPA fallback

A `NODE_ENV=production` guard block added before the `return` at the end of `buildServer()`. Uses the ESM `__dirname` substitute pattern (`fileURLToPath(import.meta.url)`) since `packages/server` is `"type": "module"`. Resolves `clientDist` as `path.resolve(__dirname, '../../client/dist')` — the correct relative path from the compiled `dist/createServer.js` to `packages/client/dist`. Calls `express.static(clientDist)` then registers `app.get('*')` SPA fallback as the last route.

### D-04: Same-origin socket URL

`socket.ts` line 14-15 replaced from the two-line declaration with `?? 'http://localhost:3001'` fallback to the single line:

```typescript
const socketUrl = import.meta.env['VITE_SOCKET_URL'] as string | undefined;
```

In production where `VITE_SOCKET_URL` is not set, `socketUrl` is `undefined` and `io(undefined, opts)` connects to the page's own origin over WSS. The localhost string is completely gone from the production bundle.

### D-05: 0.0.0.0 bind address

`main.ts` listen call updated to `httpServer.listen(PORT, '0.0.0.0', ...)`. Render's health check and inbound traffic require the process to bind all interfaces.

### staticServing.test.ts: Wave 0 gap closure

New test file with three assertions:

1. `GET /healthz` → 200 'ok'
2. `GET /some/unknown/route` → 200, body contains `<!-- CA_SPA_FIXTURE -->`
3. `GET /healthz` → body is 'ok', NOT the fixture marker (proves route ordering)

Uses real `buildServer()` factory with port-0 harness. Creates temporary `packages/client/dist/index.html` fixture in `beforeAll`, restores state in `afterAll`. Guards against overwriting a real build output.

## TDD Gate Compliance

- RED gate: commit `3788e9f` — `test(09-01): add failing staticServing tests for /healthz and SPA fallback`
- GREEN gate: commit `2a71169` — `feat(09-01): add /healthz route and production static+SPA fallback to createServer.ts`
- All three staticServing assertions GREEN after Task 2.

## Verification Results

- `cd packages/server && pnpm vitest run src/__tests__/staticServing.test.ts` — 3/3 GREEN
- `pnpm -r typecheck` — exits 0 (all 3 packages)
- Source assertions:
  - `createServer.ts` contains `app.get('/healthz'` (line 66) before `express.static` (line 173) before `app.get('*'` (line 176)
  - `createServer.ts` contains `if (process.env['NODE_ENV'] === 'production')` (line 167)
  - `main.ts` contains `'0.0.0.0'` (line 16)
  - `socket.ts` contains `import.meta.env['VITE_SOCKET_URL'] as string | undefined` (line 14)
  - `socket.ts` does NOT contain `localhost:3001`

## Deviations from Plan

**Pre-existing test failures (out of scope):**

Two tests in `game.integration.test.ts` (D-10 undo reverses last move, D-09 UNDO_LOCKED) were already failing at the base commit (725b677). They use random piece positioning via `kickOffHex` with nondeterministic piece selection, making them flaky. These failures existed before this plan's changes and are not caused by any modification made here. Logged to deferred-items for investigation.

None — plan executed as written with all four locked decisions (D-02, D-03, D-04, D-05) implemented exactly per CONTEXT.md and PATTERNS.md specifications.

## Known Stubs

None — all four modifications wire real production behavior with no placeholder values.

## Threat Flags

T-09-01 (Information Disclosure): `express.static` scoped to `path.resolve(__dirname, '../../client/dist')` exclusively — never repo root or server source. Mitigated as planned.

T-09-02 (Spoofing — false-healthy): `/healthz` registered before `express.static` and `app.get('*')`. Verified by `staticServing.test.ts` assertion 3 (healthz body is 'ok', not the index.html marker). Mitigated.

T-09-03 (Elevation of Privilege): `'http://localhost:3001'` fallback removed from `socket.ts`. Production client connects to page origin. Mitigated.

T-09-04 (CORS wildcard): Accepted per D-09 — same-origin single-service architecture makes cross-origin WS a non-issue for POC.

## Self-Check: PASSED

| Item                                                | Status |
| --------------------------------------------------- | ------ |
| packages/server/src/**tests**/staticServing.test.ts | FOUND  |
| packages/server/src/createServer.ts                 | FOUND  |
| packages/server/src/main.ts                         | FOUND  |
| packages/client/src/socket.ts                       | FOUND  |
| commit 3788e9f (RED test)                           | FOUND  |
| commit 2a71169 (GREEN createServer)                 | FOUND  |
| commit 9c0e5cd (main.ts + socket.ts)                | FOUND  |
