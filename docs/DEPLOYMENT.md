<!-- generated-by: gsd-doc-writer -->

# Deployment

This document covers how to build and deploy Counter Attack POC. The current deployment target is **Render** (configured via `render.yaml`). The planned production target is **AWS Elastic Beanstalk** — architecture decisions throughout the codebase support that migration path.

---

## Deployment Targets

### Render (current)

Config file: `render.yaml` (project root)

Render runs a single web service that serves both the Express/Socket.io server and the built React client as static files. The server reads `packages/client/dist/` at runtime and serves it as a static directory when `NODE_ENV=production`.

```yaml
# render.yaml (abridged)
services:
  - type: web
    name: counter-attack-poc
    runtime: node
    plan: free
    buildCommand: npm install -g pnpm@9.15.9 && NODE_ENV=development pnpm install --frozen-lockfile && pnpm -r build
    startCommand: node packages/server/dist/main.js
    healthCheckPath: /healthz
    autoDeployTrigger: commit
    envVars:
      - key: NODE_VERSION
        value: '22'
      - key: NODE_ENV
        value: production
```

Key facts:

- Build compiles all three packages (`shared`, `server`, `client`) via `pnpm -r build`
- Start command runs the compiled server entry point directly with Node
- Auto-deploy triggers on every commit to the connected branch
- Health check is `GET /healthz` which returns `200 ok` (plain text)
- `PORT` is injected automatically by the Render platform; the server defaults to `3001` locally
- `NODE_ENV=production` is set in `render.yaml`; the server then serves `packages/client/dist/` as static files and activates the SPA fallback route

### AWS Elastic Beanstalk (planned)

No EB-specific config file exists yet. The codebase is architected to support EB deployment with minimal changes:

- `GET /health` returns `{ status: 'ok', timestamp: <ISO> }` — compatible with AWS ALB health checks
- `GET /healthz` returns `200 ok` — Render-specific health check, harmless on EB
- Socket.io is configured with `transports: ['websocket']` only, which eliminates the sticky-session requirement for single-instance deployments
- `PORT` is read from `process.env['PORT']`; EB injects `PORT=8080` by default
- In-memory room state (`roomStore`) means no Redis dependency for a single-instance EB deployment

<!-- VERIFY: Confirm current EB Node.js platform version supports Node 22 LTS and that PORT=8080 is the EB default for the Node.js platform -->

---

## Build Pipeline

### CI (GitHub Actions)

Workflow file: `.github/workflows/ci.yml`

Trigger: every push and every pull request (all branches).

Steps in order:

1. `pnpm install --frozen-lockfile` — install all workspace dependencies
2. `pnpm --filter @counter-attack/shared build` — compile shared types (`dist/index.d.ts` must exist before consumer packages typecheck)
3. `pnpm -r typecheck` — typecheck all packages
4. `pnpm -r test` — run vitest suites across all packages
5. `pnpm -r build` — compile all packages to `dist/`

CI does **not** deploy — it validates only. Deployment is handled by Render's auto-deploy on commit.

### Render Build

The `buildCommand` in `render.yaml` runs on the Render build runner before `startCommand`:

```bash
npm install -g pnpm@9.15.9 && NODE_ENV=development pnpm install --frozen-lockfile && pnpm -r build
```

`NODE_ENV=development` during install prevents the `prepare` script (husky) from running. After install, `pnpm -r build` compiles packages in dependency order:

1. `@counter-attack/shared` → `packages/shared/dist/`
2. `@counter-attack/server` → `packages/server/dist/`
3. `@counter-attack/client` → `packages/client/dist/`

The start command then runs `node packages/server/dist/main.js`, which serves the client `dist/` as static files.

### Manual Build (local verification)

```bash
# From the project root
pnpm install --frozen-lockfile
pnpm --filter @counter-attack/shared build
pnpm -r build

# Verify the server starts and serves the client
NODE_ENV=production node packages/server/dist/main.js
# → Counter Attack server listening on port 3001
```

---

## Environment Setup

See [CONFIGURATION.md](CONFIGURATION.md) for the full environment variable reference.

The minimum required environment variables for a correct production deployment:

| Variable      | Value                                               | How to set                                                      |
| ------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`    | `production`                                        | Declared in `render.yaml`; use `eb setenv` for EB               |
| `PORT`        | Platform-injected                                   | Render injects automatically; EB uses `8080` by default         |
| `CORS_ORIGIN` | Frontend URL (e.g. `https://your-app.onrender.com`) | Must be set manually in the Render dashboard or via `eb setenv` |

`CORS_ORIGIN` is the only variable that **must** be set manually. If it is absent in production, the server starts and logs a `[WARN]` but all origins are permitted to make Socket.io connections.

**Render dashboard:** <!-- VERIFY: Confirm the exact Render dashboard path for adding environment variables to the counter-attack-poc service -->

**AWS Elastic Beanstalk:**

```bash
eb setenv NODE_ENV=production CORS_ORIGIN=https://your-frontend-url PORT=8080
```

If the client is deployed separately (e.g. S3 + CloudFront), inject `VITE_SOCKET_URL` at build time — it is a Vite build-time variable and cannot be set at runtime:

```bash
VITE_SOCKET_URL=https://your-server-url pnpm --filter @counter-attack/client build
```

<!-- VERIFY: Confirm S3/CloudFront frontend deployment is planned and the VITE_SOCKET_URL value for the EB deployment -->

---

## Rollback Procedure

### Render

Render retains a deployment history per service. To roll back:

1. Open the Render dashboard and navigate to the `counter-attack-poc` service.
2. Select "Deploys" in the left sidebar.
3. Find the last known-good deploy and click "Rollback to this deploy".

<!-- VERIFY: Confirm the exact Render rollback UI option name and whether it is available on the free plan -->

Because `autoDeployTrigger: commit` is active, a rollback can also be performed by reverting the offending commit and pushing — Render will build and deploy the reverted state automatically.

### AWS Elastic Beanstalk (planned)

Redeploy the previous application version:

```bash
# List available application versions
eb appversion

# Deploy a specific version
eb deploy --version <version-label>
```

Alternatively, use the EB console: Application > Application Versions > select the target version > Deploy.

---

## Monitoring

No application-level monitoring library (Sentry, Datadog, New Relic, OpenTelemetry) is installed in this project.

### Health Check Endpoints

Two health check routes are registered in `packages/server/src/createServer.ts`:

| Path           | Response                                 | Purpose                                                    |
| -------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `GET /healthz` | `200 ok` (plain text)                    | Render platform health check (configured in `render.yaml`) |
| `GET /health`  | `200 { status: 'ok', timestamp: <ISO> }` | AWS ALB health check (future EB deployment)                |

Both routes are registered before the static file middleware and the SPA fallback, so they are always reachable regardless of `NODE_ENV`.

### Render Logs

Render streams server stdout/stderr to the service dashboard under the "Logs" tab. `console.log` and `console.warn` output from the server process appears there in real time.

<!-- VERIFY: Confirm Render log retention period for the free plan -->

### AWS CloudWatch (planned)

Elastic Beanstalk streams instance logs to CloudWatch Logs automatically. The application writes to stdout/stderr, which EB captures as the `nodejs` log stream.

<!-- VERIFY: Confirm CloudWatch log group naming convention for EB Node.js platform and whether enhanced health reporting is included in the planned EB tier -->
