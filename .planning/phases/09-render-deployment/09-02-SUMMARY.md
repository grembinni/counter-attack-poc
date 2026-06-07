---
phase: 09-render-deployment
plan: 02
wave: 2
status: complete
completed: 2026-06-07
commits:
  - 5a5792c
---

# Plan 09-02 Summary — Render Blueprint + CI Workflow

## What was done

Created two IaC files that complete the Render deployment gate:

**Task 1 — `render.yaml` (D-06)**

- Single `web` service, `runtime: node`, `plan: free`
- `buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm -r build`
  (corecore enable required before pnpm on Render Node 22 image)
- `startCommand: node packages/server/dist/main.js` (not index.js)
- `healthCheckPath: /healthz` (wires to the route added in Plan 09-01)
- `autoDeployTrigger: commit` (not deprecated `autoDeploy: true`)
- `envVars`: `NODE_VERSION: '22'`, `NODE_ENV: production`

**Task 2 — `.github/workflows/ci.yml` (D-07)**

- Triggers on `push` and `pull_request` (no branch filters)
- Steps: checkout@v4 → pnpm/action-setup@v4 (v9) → setup-node@v4 (node 22, pnpm cache)
  → `pnpm install --frozen-lockfile` → `pnpm -r typecheck` → `pnpm -r test` → `pnpm -r build`
- `pnpm/action-setup` placed before `actions/setup-node` so node can detect pnpm store

## Verification

Both verify commands from the plan passed:

- `node -e "..."` render.yaml check → `render.yaml OK`
- `node -e "..."` ci.yml check → `ci.yml OK`

`pnpm -r typecheck` → clean across all 3 packages.

`pnpm -r test` → 2 pre-existing failures in `game.integration.test.ts` (D-09, D-10 undo
tests from unexecuted Phase 8.1 plan 08.1-03). Not introduced by this phase.
All other tests including `staticServing.test.ts` (fixed in the test-fixture commit)
pass (184 pass, 1 todo).

## Commits

| SHA     | Message                                                                |
| ------- | ---------------------------------------------------------------------- |
| 5a5792c | feat(deploy): add render.yaml Blueprint and GitHub Actions CI workflow |

## Manual steps remaining (owner)

1. Push this branch to GitHub if not already.
2. In Render dashboard: **New → Blueprint → connect repo → Apply** — Render reads `render.yaml` and creates the service.
3. After deploy: `curl https://<service>.onrender.com/healthz` should return `ok`.
4. Open service URL in two browser tabs, share a room code, play through kick-off + pass + shot.
5. Check no localhost in bundle: `strings packages/client/dist/assets/*.js | grep localhost` (should be empty).
