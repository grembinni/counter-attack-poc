# Phase 1: Monorepo Scaffold + Shared Types - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 1-Monorepo Scaffold + Shared Types
**Areas discussed:** Test runner, Hex math in shared, TS build wiring, Dev tooling scope

---

## Test Runner

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest | ESM-native, shares Vite config, works without babel/ts-jest for pure TS | ✓ |
| Jest + ts-jest | More familiar; heavier; requires ts-jest or babel-jest for ESM/TypeScript | |

**User's choice:** Vitest

| Option | Description | Selected |
|--------|-------------|----------|
| Shared only for Phase 1 | Only packages/shared gets Vitest config now | ✓ |
| Configure all three packages now | Add Vitest config to server and client upfront | |

**User's choice:** Shared only for Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| vitest.config.ts in packages/shared | Isolated config per package | ✓ |
| Root-level vitest.config.ts with workspace projects | Single config, pnpm test from root runs everything | |

**User's choice:** vitest.config.ts in packages/shared

**Notes:** Phase 2 is the unit-test phase; only shared needs a test runner now. Server/client test config deferred to their respective phases.

---

## Hex Math in Shared

| Option | Description | Selected |
|--------|-------------|----------|
| Pure axial arithmetic | Plain TypeScript math on {q, r} objects; zero external deps in shared | ✓ |
| honeycomb-grid in shared | Reuse honeycomb-grid API in shared as well as client | |

**User's choice:** Pure axial arithmetic

| Option | Description | Selected |
|--------|-------------|----------|
| packages/client only | axialToPixel is a rendering concern | ✓ |
| packages/shared/src/hexToPixel.ts | Available to server too (but server has no display) | |

**User's choice:** packages/client only

| Option | Description | Selected |
|--------|-------------|----------|
| Named from root index | Single import path: import { hexDistance } from '@counter-attack/shared' | ✓ |
| Sub-path exports (/hex, /types, /events) | Finer-grained tree-shaking; more config overhead | |

**User's choice:** Named from root index

**Notes:** honeycomb-grid remains a client-only dependency for SVG rendering. The server's import chain stays lean.

---

## TS Build Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| package.json exports + pnpm symlinks | Standard approach; tsc and Vite resolve via node_modules | ✓ |
| TypeScript composite + project references | Incremental tsc --build; more config overhead; overkill for POC | |

**User's choice:** package.json exports + pnpm symlinks

| Option | Description | Selected |
|--------|-------------|----------|
| Root tsconfig.base.json extended by each package | Shared strict settings in one place; per-package overrides | ✓ |
| Standalone configs per package | Self-contained but duplicated | |

**User's choice:** Root tsconfig.base.json

| Option | Description | Selected |
|--------|-------------|----------|
| Build shared to /dist (tsc emit) | Server and client import compiled JS + .d.ts output | ✓ |
| Direct /src imports with path aliases | Avoids build step but requires ts-node at server runtime | |

**User's choice:** Build shared to /dist

**Notes:** Node.js cannot run .ts files natively; a /dist build step for packages/shared is required for server runtime resolution.

---

## Dev Tooling Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include now | ESLint + Prettier at repo root, wired into each package | ✓ |
| Defer to later | Faster first commit; add when second contributor joins | |

**User's choice:** Include now

| Option | Description | Selected |
|--------|-------------|----------|
| eslint-config-prettier + typescript-eslint | Minimal, well-maintained; covers TS correctness and consistent style | ✓ |
| @antfu/eslint-config | Opinionated all-in-one preset; more rules out of the box | |

**User's choice:** typescript-eslint + eslint-config-prettier

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, wire Husky + lint-staged | Auto-format and lint on every commit | ✓ |
| No — just config files, no git hook | Manual lint only; less setup friction | |

**User's choice:** Husky + lint-staged

**Notes:** Pre-commit hook ensures consistent style from the very first phase commit.

---

## Claude's Discretion

- Module format for packages/shared dist output (ESM vs CJS vs dual)
- Exact tsconfig.base.json strict flags beyond `strict: true`
- Prettier config specifics (print width, trailing commas, semi)
- Package naming convention (`@counter-attack/shared` vs bare `shared`)

## Deferred Ideas

None — discussion stayed within phase scope.
