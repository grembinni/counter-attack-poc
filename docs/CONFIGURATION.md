<!-- generated-by: gsd-doc-writer -->

# Configuration

This document covers all environment variables and runtime configuration for the Counter Attack POC server and client packages.

---

## Environment Variables

### Server (`packages/server`)

| Variable      | Required               | Default     | Description                                                                                                                                                                                                                                                |
| ------------- | ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`        | Optional               | `3001`      | TCP port the HTTP/WebSocket server binds to. Render/EB set this automatically.                                                                                                                                                                             |
| `NODE_ENV`    | Optional               | `undefined` | When set to `production`, enables static file serving of the built React client and activates the CORS origin warning if `CORS_ORIGIN` is unset.                                                                                                           |
| `CORS_ORIGIN` | Required in production | `*`         | Allowed origin for Socket.io CORS. Defaults to `*` (all origins) in development. **Must** be set to the frontend URL in production — the server logs a warning and continues if it is missing, but any origin can make credentialed WebSocket connections. |

Setting `CORS_ORIGIN` is enforced at the application layer (`packages/server/src/main.ts`). The Socket.io server reads it directly at startup via `process.env['CORS_ORIGIN']` inside `createServer.ts`.

### Client (`packages/client`)

| Variable          | Required | Default                                  | Description                                                                                                                                                                                                                                                                                              |
| ----------------- | -------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SOCKET_URL` | Optional | `undefined` (connects to current origin) | WebSocket server URL for the Socket.io client. When unset, `socket.io-client` connects to the same origin as the page — which works in development via Vite's proxy and in production when the server serves the client statically. Set this when the client and server are hosted on different origins. |

Vite exposes variables prefixed `VITE_` to the browser bundle at build time. Any variable without the `VITE_` prefix is not accessible in client code.

---

## Config File Format

This project does not use JSON/YAML application config files. All runtime configuration is passed through environment variables only.

**TypeScript compiler options** are declared in `tsconfig.base.json` at the project root and extended by each package's own `tsconfig.json`. The base options are not runtime configuration — they affect the build only.

**Vite build options** for the client are in `packages/client/vite.config.ts`. The relevant production settings are:

```ts
// packages/client/vite.config.ts
build: {
  outDir: 'dist',
  sourcemap: true,
}
```

The dev server proxy (`/socket.io` → `ws://localhost:3001`) is active only during `vite dev` and has no effect on production builds.

---

## Required vs Optional Settings

The following settings cause observable problems if absent in production:

| Setting                        | Effect if absent                                                                         | Where validated                                |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `CORS_ORIGIN` (server)         | All origins are permitted; logged as a `[WARN]` at startup                               | `packages/server/src/main.ts` line 7–12        |
| `NODE_ENV=production` (server) | Static file serving for the React client is disabled; server does not serve `index.html` | `packages/server/src/createServer.ts` line 167 |

No setting throws on startup if absent — the server starts in all cases. The table above represents the settings that must be configured for a correct production deployment.

---

## Defaults

| Variable          | Default value                | Set in                                                                                                                                                                                  |
| ----------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`            | `3001`                       | `packages/server/src/main.ts` — `Number(process.env['PORT'] ?? 3001)`                                                                                                                   |
| `CORS_ORIGIN`     | `'*'`                        | `packages/server/src/createServer.ts` — `process.env['CORS_ORIGIN'] ?? '*'`                                                                                                             |
| `VITE_SOCKET_URL` | `undefined` (current origin) | `packages/client/src/socket.ts` — `import.meta.env['VITE_SOCKET_URL']` passed directly to `io()`; `socket.io-client` defaults to `window.location.origin` when the value is `undefined` |

---

## Per-Environment Overrides

There are no `.env.development` or `.env.production` files in the repository. Environment variables are supplied through the deployment platform:

**Local development:**

The Vite dev server proxies `/socket.io` to `ws://localhost:3001`, so `VITE_SOCKET_URL` does not need to be set. Run the server on port 3001 (the default) and the client on Vite's default port (`5173`).

```bash
# Terminal 1 — server
cd packages/server
pnpm dev   # starts tsx watch on src/main.ts, binds to :3001

# Terminal 2 — client
cd packages/client
pnpm dev   # Vite dev server, proxies /socket.io to :3001
```

**Render (current deployment target):**

`render.yaml` declares these variables directly:

```yaml
envVars:
  - key: NODE_VERSION
    value: '22'
  - key: NODE_ENV
    value: production
```

`PORT` is injected automatically by the Render platform. `CORS_ORIGIN` must be added manually in the Render service dashboard. <!-- VERIFY: Confirm the exact Render environment variable management UI path for setting CORS_ORIGIN -->

**AWS Elastic Beanstalk (planned target):**

Set environment variables with `eb setenv`:

```bash
eb setenv NODE_ENV=production CORS_ORIGIN=https://your-frontend-url PORT=8080
```

Elastic Beanstalk expects `PORT=8080` by default. `VITE_SOCKET_URL` is a build-time Vite variable and must be injected at `vite build` time, not at runtime:

```bash
VITE_SOCKET_URL=https://your-server-url pnpm --filter @counter-attack/client build
```

<!-- VERIFY: Confirm EB platform's default port expectation and whether ALB forwards to 8080 for this deployment -->

---

## Session Token Behaviour

The client stores a reconnection session token in `sessionStorage` under the key `ca_session_token`. This is not an environment variable — it is set by the server at room join and read by the Socket.io client `auth` callback on every connection attempt. Clearing `sessionStorage` forces the client to start a fresh session.
