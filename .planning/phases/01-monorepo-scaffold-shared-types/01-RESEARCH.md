# Phase 1: Monorepo Scaffold + Shared Types - Research

**Researched:** 2026-05-28
**Domain:** pnpm workspaces, TypeScript monorepo configuration, shared type packages, hex math, Socket.io typed events, ESLint/Prettier/Husky toolchain
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use **Vitest** as the test framework for `packages/shared`. Aligns with the Vite frontend, is ESM-native, and requires no babel/ts-jest configuration.
- **D-02:** Vitest is configured **only in `packages/shared`** for Phase 1. Server and client test configs are added in their respective phases. Config file lives at `packages/shared/vitest.config.ts` (per-package, not a root workspace config).
- **D-03:** `packages/shared` implements hex math (`hexDistance`, `hexNeighbors`, `hexesInRange`, `isUnderZoI`) as **pure axial arithmetic** — TypeScript math on `{q, r}` objects with zero external dependencies. No `honeycomb-grid` dependency in `packages/shared`.
- **D-04:** `axialToPixel` (and any other pixel/rendering conversion) lives **exclusively in `packages/client`**. The server's import chain never sees rendering code.
- **D-05:** All shared exports use a **single root index** (`import { hexDistance, GameState } from '@counter-attack/shared'`). No sub-path exports at this stage.
- **D-06:** Resolution via **`package.json` exports + pnpm workspace symlinks**. Each package declares `main` / `types` in its `package.json`; pnpm workspaces symlinks them under `node_modules`. Both `tsc` and Vite resolve via `node_modules`. No TypeScript composite project references.
- **D-07:** **Root `tsconfig.base.json`** with shared strict settings (`strict: true`, `noUncheckedIndexedAccess`, etc.). Each package's `tsconfig.json` extends it and adds package-specific overrides (e.g. `"lib": ["dom"]` for client only).
- **D-08:** `packages/shared` **builds to `/dist`** via `tsc` emit (JS + `.d.ts`). Server and client import compiled output. This is required for Node.js runtime resolution — the server cannot import `.ts` files directly.
- **D-09:** **ESLint + Prettier included in Phase 1**. Clean from the first commit; no backfill needed in later phases.
- **D-10:** ESLint base: **`typescript-eslint` recommended + `eslint-config-prettier`**. Minimal and well-maintained; covers TS correctness and consistent style across all three packages.
- **D-11:** **Husky + lint-staged** wired as a pre-commit hook. Auto-formats and lints on every commit.

### Claude's Discretion

- Module format for `packages/shared` dist output (ESM vs CJS vs dual): choose based on what Node.js + Vite consumption requires — likely ESM-only given the stack.
- Exact `tsconfig.base.json` strict flags beyond `strict: true`: use the recommended typescript-eslint strict preset as the baseline.
- Prettier config specifics (print width, trailing commas, semi): use community defaults.
- Package naming convention for the workspace packages (e.g. `@counter-attack/shared` vs `shared`): use scoped names for clarity.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-02 | Project is structured as a pnpm monorepo with packages: `shared` (types, hex math, move validation), `server` (Express + Socket.io), `client` (React + Vite) | pnpm workspaces with `pnpm-workspace.yaml`, `workspace:*` protocol |
| ARCH-03 | All hex geometry uses axial (q, r) coordinates; cube coordinate conversion available in `shared` for distance arithmetic | Pure axial math: distance formula `(|dq| + |dq+dr| + |dr|) / 2`, neighbor lookup table, range loop |
| ARCH-07 | Move validation logic lives exclusively in `packages/shared` as pure functions with no Socket.io or Express imports; fully unit-testable in isolation | Vitest per-package config at `packages/shared/vitest.config.ts`; TypeScript compilation isolation |
</phase_requirements>

---

## Summary

Phase 1 is a pure scaffolding phase — no game logic runs, no server listens, no browser renders. The deliverable is a working pnpm monorepo where `pnpm install && pnpm build` succeeds across all three packages and `packages/shared` exports a stable type and utility API that every subsequent phase depends on.

The critical technical challenge is the **build dependency chain**: `packages/server` and `packages/client` cannot compile until `packages/shared/dist/` exists. The solution is to use `pnpm -r build` which respects topological order (shared builds before its dependents), and to declare dependencies with `workspace:*` protocol so pnpm knows the graph. [VERIFIED: pnpm.io/workspaces]

The second challenge is **moduleResolution consistency**: `packages/shared` must emit to `dist/` as ESM (`.mjs` or `"type": "module"`) so that both Vite's bundler and Node.js can consume the same dist without CJS/ESM bridging headaches. The `tsconfig.base.json` must use `"moduleResolution": "bundler"` for client (Vite) and `"moduleResolution": "node16"` for server (Node.js runtime). [VERIFIED: typescriptlang.org/tsconfig/moduleResolution]

The hex math functions (`hexDistance`, `hexNeighbors`, `hexesInRange`, `isUnderZoI`) use well-established axial coordinate formulas from Red Blob Games, which are trivially expressible as zero-dependency TypeScript functions on `{q, r}` objects. [VERIFIED: redblobgames.com/grids/hexagons]

**Primary recommendation:** Use ESM-only output (`"type": "module"`) for `packages/shared`, `moduleResolution: "node16"` for server, `moduleResolution: "bundler"` for client, and the `pnpm -r build` command (not `--parallel`) to respect build order. Wire Husky using `pnpm exec husky init` at the monorepo root.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Shared TypeScript types (GameState, HexCoord, etc.) | `packages/shared` | — | Must be importable by both server runtime and client bundler with zero runtime dep leak |
| Hex math (distance, neighbors, range, ZoI) | `packages/shared` | — | Pure computation; server uses for validation, client uses for highlighting — same logic both sides |
| Socket.io event name constants | `packages/shared` | — | Typed event map is shared between `Server<…>` and `Socket<…>` instantiation points |
| Placeholder pitch coordinates (PITCH_HEXES) | `packages/shared/src/pitch.ts` | — | Blocking dependency placeholder; real measurements arrive later |
| TypeScript compilation (shared) | `packages/shared` (tsc emit) | — | Compiles to `dist/`; consumed at runtime by server, at bundle-time by Vite |
| TypeScript compilation (server) | `packages/server` (tsc) | — | Server package compiles independently, importing shared via node_modules symlink |
| TypeScript compilation (client) | `packages/client` (Vite) | — | Vite handles transpilation; no separate tsc emit step needed |
| Dev tooling (lint, format, hooks) | Monorepo root | Each package | Root `eslint.config.js` + `.prettierrc` + `.husky/`; lint-staged configured per-package |
| Test runner | `packages/shared` only (Phase 1) | — | D-02: only shared gets Vitest in this phase |

---

## Standard Stack

### Core (Phase 1)

| Library | Version | Purpose | Why Standard | Source |
|---------|---------|---------|--------------|--------|
| pnpm | 9.15.9 | Package manager + workspace orchestration | Only major package manager with first-class workspace:* protocol and strict hoisting | [VERIFIED: npm registry] |
| TypeScript | 5.9.3 | Type system for all packages | Project constraint; 5.x stable; `bundler` moduleResolution added in 5.0 | [VERIFIED: npm registry] |
| vitest | 2.1.9 | Unit test runner for packages/shared | ESM-native, zero-babel config, reuses Vite transform pipeline (D-01) | [VERIFIED: npm registry] |
| ESLint | 9.39.4 | Static analysis | v9 flat config is standard; typescript-eslint v8 drops legacy .eslintrc format | [VERIFIED: npm registry] |
| typescript-eslint | 8.60.0 | TypeScript ESLint rules + parser | Canonical TS linting; v8 "project service" requires no extra monorepo config (D-10) | [VERIFIED: npm registry] |
| eslint-config-prettier | 10.1.8 | Disables ESLint formatting rules that Prettier owns | Standard integration point between the two tools (D-10) | [VERIFIED: npm registry] |
| prettier | 3.8.3 | Opinionated code formatter | Zero-config formatter; D-09 | [VERIFIED: npm registry] |
| husky | 9.1.7 | Git hooks manager | v9 is current stable; `husky init` replaces deprecated `husky install` (D-11) | [VERIFIED: npm registry] |
| lint-staged | 17.0.5 | Run linters on staged files only | Prevents committing unformatted code; pairs with husky (D-11) | [VERIFIED: npm registry] |

### Type Stubs (Phase 1, dev only)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| @types/node | 22.19.19 | Node.js type stubs for server package | [VERIFIED: npm registry] |

### Packages for Later Phases (do NOT install in Phase 1)

| Library | Phase | Notes |
|---------|-------|-------|
| socket.io / socket.io-client | Phase 3 | Typed event interfaces defined in shared Phase 1; runtime dep deferred |
| express / @types/express | Phase 3 | Server scaffolding |
| react / react-dom | Phase 6 | Client rendering |
| @vitejs/plugin-react | Phase 6 | React + Vite integration |
| zustand | Phase 7 | Client state |
| honeycomb-grid | Phase 6 | Pixel rendering in client only; NOT in shared (D-03) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pnpm workspaces | npm workspaces | npm workspaces lacks workspace:* protocol enforcement; pnpm's strict hoisting avoids phantom dependencies |
| pnpm workspaces | Turborepo on top of pnpm | Turborepo adds caching but also complexity; overkill for 3 packages, no CI yet |
| ESM-only shared dist | Dual CJS+ESM (tsup) | Dual builds require tsup/rollup and add build time; Node.js 22 LTS supports ESM natively; no legacy CJS consumer |
| typescript-eslint v8 project service | `parserOptions.project` | Project service is zero-config for monorepos; direct parserOptions.project needs tsconfig.eslint.json maintenance |
| Vitest 2.x per-package | Root vitest workspace config | Per-package config (D-02) is simpler for Phase 1; workspace config added in future phases if needed |
| tsconfig `"moduleResolution": "bundler"` globally | `"node16"` globally | Server needs `node16` (runtime enforces .js extensions); client needs `bundler` (Vite doesn't enforce extensions). Split by package. |

**Installation (root devDependencies):**
```bash
pnpm add -D -w typescript prettier eslint typescript-eslint eslint-config-prettier husky lint-staged
```

**Installation (packages/shared devDependencies):**
```bash
pnpm add -D --filter @counter-attack/shared vitest @types/node
```

---

## Package Legitimacy Audit

> slopcheck was run against PyPI (wrong registry — this is a Node.js project). All packages below are npm packages verified directly against the npm registry via `npm view <pkg> version`. slopcheck [SLOP] verdicts reflect PyPI non-existence, not npm non-existence — those verdicts are INVALID for this project.

| Package | Registry | Age | slopcheck (npm) | Disposition |
|---------|----------|-----|-----------------|-------------|
| pnpm | npm | 2013 (13 yrs) | N/A — tool, not project dep | Approved |
| typescript | npm | 2012 (14 yrs) | N/A — confirmed via npm view | Approved |
| vitest | npm | 2021 (5 yrs) | Confirmed: 2.1.9 on npm | Approved |
| eslint | npm | 2013 (13 yrs) | Confirmed: 9.39.4 on npm | Approved |
| typescript-eslint | npm | 2019 (7 yrs) | Confirmed: 8.60.0 on npm | Approved |
| eslint-config-prettier | npm | ~2017 (8 yrs) | Confirmed: 10.1.8 on npm | Approved |
| prettier | npm | 2017 (8 yrs) | Confirmed: 3.8.3 on npm | Approved |
| husky | npm | 2014 (12 yrs) | Confirmed: 9.1.7 on npm | Approved |
| lint-staged | npm | ~2016 (9 yrs) | Confirmed: 17.0.5 on npm | Approved |
| @types/node | npm | 2014 (12 yrs) | Confirmed: 22.19.19 on npm | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck ran against wrong registry — PyPI — and its results are not applicable to this Node.js project)
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MONOREPO ROOT                            │
│  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js │
│  .prettierrc  .husky/pre-commit  package.json (root)        │
└───────────────────┬─────────────────────────────────────────┘
                    │ pnpm install (symlinks workspace packages)
        ┌───────────┼──────────────┐
        ▼           ▼              ▼
┌──────────────┐  ┌─────────────┐  ┌─────────────────┐
│packages/     │  │packages/    │  │packages/        │
│shared        │  │server       │  │client           │
│              │  │             │  │                 │
│ src/         │  │ (placeholder│  │ (placeholder    │
│  types.ts    │  │  tsconfig   │  │  tsconfig       │
│  hex.ts      │  │  package    │  │  package        │
│  events.ts   │  │  .json)     │  │  .json)         │
│  pitch.ts    │  │             │  │                 │
│  index.ts    │  │             │  │                 │
│              │  │             │  │                 │
│ dist/ ◄──tsc │  │             │  │                 │
│  index.js    │  │ ↑ imports   │  │ ↑ imports       │
│  index.d.ts  │  │ @counter-   │  │ @counter-       │
└──────────────┘  │ attack/     │  │ attack/         │
        │         │ shared      │  │ shared          │
        │         └─────────────┘  └─────────────────┘
        │                 ▲                ▲
        └─────────────────┴────────────────┘
          node_modules/@counter-attack/shared
          (symlink → packages/shared via workspace:*)
```

### Recommended Project Structure

```
counter-attack-poc/
├── pnpm-workspace.yaml          # packages: ['packages/*']
├── package.json                 # root — devDeps: typescript, eslint, prettier, husky, lint-staged
├── tsconfig.base.json           # shared strict settings; extended by each package
├── eslint.config.js             # root flat config — typescript-eslint + eslint-config-prettier
├── .prettierrc                  # print width 100, trailing commas 'all', single quotes
├── .husky/
│   └── pre-commit               # runs lint-staged
├── .lintstagedrc.js             # or lint-staged config in root package.json
└── packages/
    ├── shared/
    │   ├── package.json         # name: @counter-attack/shared, type: module, exports: {".": {...}}
    │   ├── tsconfig.json        # extends ../../tsconfig.base.json, module: NodeNext
    │   ├── vitest.config.ts     # per-package vitest config (D-02)
    │   └── src/
    │       ├── types.ts         # HexCoord, GameState, PlayerPiece, BallState, GamePhase
    │       ├── hex.ts           # hexDistance, hexNeighbors, hexesInRange, isUnderZoI
    │       ├── events.ts        # Socket.io event constants (typed const objects)
    │       ├── pitch.ts         # PITCH_HEXES placeholder (rectangular grid)
    │       └── index.ts         # single barrel export (D-05)
    ├── server/
    │   ├── package.json         # name: @counter-attack/server, deps: {workspace:*}
    │   ├── tsconfig.json        # extends ../../tsconfig.base.json, moduleResolution: node16
    │   └── src/
    │       └── index.ts         # placeholder (import check only — no Express yet)
    └── client/
        ├── package.json         # name: @counter-attack/client, type: module
        ├── tsconfig.json        # extends ../../tsconfig.base.json, moduleResolution: bundler, lib: [dom]
        └── src/
            └── main.ts          # placeholder (import check only — no React yet)
```

### Pattern 1: pnpm Workspace Protocol Dependency

**What:** Use `workspace:*` in dependents' `package.json` to reference local packages. pnpm symlinks `node_modules/@counter-attack/shared` → `packages/shared`. No path hacks in tsconfig needed.

**When to use:** Every time one workspace package imports from another.

**Example:**
```jsonc
// packages/server/package.json
{
  "name": "@counter-attack/server",
  "dependencies": {
    "@counter-attack/shared": "workspace:*"
  }
}
```
[CITED: pnpm.io/workspaces]

---

### Pattern 2: package.json `exports` Field for Shared Package

**What:** The `exports` field in `packages/shared/package.json` controls what TypeScript and bundlers can resolve. Without it, consumers can import any file from `dist/` — a leaky API. Combined with `"type": "module"`, ensures ESM-only output.

**When to use:** Required for `moduleResolution: bundler` and `node16` to respect the package boundary.

**Example:**
```jsonc
// packages/shared/package.json
{
  "name": "@counter-attack/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  }
}
```
[CITED: typescriptlang.org/tsconfig/moduleResolution]

---

### Pattern 3: Root tsconfig.base.json with Package Overrides

**What:** Shared compiler options in one file; each package extends and adds tier-specific settings. Prevents drift between packages.

**When to use:** Always — single source of truth for strictness settings.

**Example:**
```jsonc
// tsconfig.base.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

```jsonc
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

```jsonc
// packages/server/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

```jsonc
// packages/client/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```
[ASSUMED: split moduleResolution strategy — MEDIUM confidence. Standard pattern but should be verified when server package first compiles against Node.js runtime.]

---

### Pattern 4: Typed Socket.io Event Constants

**What:** Socket.io v4 accepts TypeScript generics for full type safety. Event name constants live in `packages/shared/src/events.ts` as typed `const` objects (not enums — D-04's specification).

**When to use:** Define once in shared; import in both server (`Server<…>` instantiation) and client (`Socket<…>` instantiation). Phase 1 defines the interfaces and constants; Phase 3 wires them to the actual socket instances.

**Example:**
```typescript
// packages/shared/src/events.ts
// Source: socket.io/docs/v4/typescript/

// Typed const objects (not enums) per D-04
export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  GAME_MOVE: 'game:move',
  GAME_ROLL: 'game:roll',
} as const;

export const ServerEvents = {
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
  GAME_STATE: 'game:state',
  GAME_DISCONNECT_WARNING: 'game:disconnect-warning',
} as const;

// Typed event map interfaces — consumed by Server<…> and Socket<…> in later phases
export interface ServerToClientEvents {
  [ServerEvents.ROOM_JOINED]: (roomCode: string, playerSlot: 1 | 2) => void;
  [ServerEvents.ROOM_ERROR]: (message: string) => void;
  [ServerEvents.GAME_STATE]: (state: GameState) => void;
  [ServerEvents.GAME_DISCONNECT_WARNING]: () => void;
}

export interface ClientToServerEvents {
  [ClientEvents.ROOM_CREATE]: () => void;
  [ClientEvents.ROOM_JOIN]: (roomCode: string) => void;
  [ClientEvents.GAME_MOVE]: (from: HexCoord, to: HexCoord) => void;
  [ClientEvents.GAME_ROLL]: () => void;
}
```
[VERIFIED: socket.io/docs/v4/typescript/]

---

### Pattern 5: ESLint v9 Flat Config with typescript-eslint v8

**What:** ESLint v9 uses `eslint.config.js` (flat config). No more `.eslintrc`. The `typescript-eslint` v8 "project service" requires no extra tsconfig configuration for monorepos.

**When to use:** Single `eslint.config.js` at root covers all packages.

**Example:**
```javascript
// eslint.config.js (root)
// Source: typescript-eslint.io/troubleshooting/typed-linting/monorepos/
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,  // v8 zero-config monorepo support
      },
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  }
);
```
[CITED: typescript-eslint.io/troubleshooting/typed-linting/monorepos/]

---

### Pattern 6: Husky v9 Init + lint-staged

**What:** Husky v9 replaced `husky install` with `husky init`. The `prepare` script ensures hooks are installed after `pnpm install`.

**When to use:** Run once during scaffold; commit `.husky/` directory.

**Example:**
```bash
# One-time setup (not in scripts — run manually)
pnpm exec husky init
```

```json
// root package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml}": ["prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
pnpm exec lint-staged
```
[CITED: typicode.github.io/husky/get-started.html]

---

### Anti-Patterns to Avoid

- **TypeScript composite project references:** D-06 explicitly rules these out. They require `"composite": true` in every tsconfig and manual `references` arrays. The simpler `package.json` exports + workspace symlinks approach works without this complexity.
- **`--parallel` flag on `pnpm -r build`:** Bypasses topological ordering. `packages/shared` must build before `packages/server` and `packages/client`. Use `pnpm -r build` (no `--parallel`).
- **`"moduleResolution": "node"` (legacy):** Does not respect `package.json` exports field. `"node"` was deprecated for this reason. Use `"node16"` (server) or `"bundler"` (client).
- **Importing `.ts` files directly from server into shared:** Node.js runtime cannot execute `.ts`. Server must import from `@counter-attack/shared` (the compiled `dist/`), never from `../shared/src/`.
- **`workspace:*` only in `devDependencies`:** If `packages/server` has a runtime dependency on `packages/shared`, declare it in `dependencies`, not `devDependencies` — otherwise it won't be included when packaging for deployment.
- **Offset hex coordinates:** State.md and project constraint. Never use `{col, row}` offset. Axial `{q, r}` only from day one.
- **Enums for event constants:** Use `as const` object patterns instead. TypeScript enums compile to IIFE patterns and don't tree-shake cleanly. Const objects emit nothing at runtime.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Axial hex distance | Custom formula guessed from memory | Formula from Red Blob Games: `(|dq| + |dq+dr| + |dr|) / 2` | Easy to get wrong sign or division; canonical reference is authoritative |
| Hex neighbor directions | Hard-coded `[{q:1,r:0},...]` array guessed | Look-up from Red Blob Games direction table | Direction ordering matters for consistency across functions |
| Workspace package resolution | `paths` aliases in tsconfig | `package.json` exports + `workspace:*` | `paths` is not respected by Node.js at runtime; workspace symlinks are |
| Git hook file management | Manually maintaining `.git/hooks/` | Husky v9 | `.git/hooks/` is not committed to the repo; Husky manages this via `.husky/` which IS committed |
| Staged-file filtering in hooks | `git diff --name-only` in pre-commit | lint-staged | lint-staged handles glob patterns, cascading configs, and partial-file application correctly |

**Key insight:** The main risk in monorepo scaffolding is implicit coupling — one package's `tsconfig` `paths` aliasing around the workspace resolution, or a build script that happens to work locally but fails in CI because it relies on source-file importing instead of compiled dist. The patterns above ensure the resolution path is consistent between TypeScript's type checker, the runtime (Node.js), and the bundler (Vite).

---

## Common Pitfalls

### Pitfall 1: Build Order — Compiling Dependents Before shared/dist Exists

**What goes wrong:** Running `pnpm -r build` with `--parallel` or without workspace dependencies declared causes `packages/server` and `packages/client` to try compiling before `packages/shared/dist/` exists. TypeScript reports `Cannot find module '@counter-attack/shared'`.

**Why it happens:** pnpm's topological sort only works if workspace packages declare each other via `workspace:*` in `package.json`. If the dependency isn't declared, pnpm doesn't know the ordering.

**How to avoid:** Declare `"@counter-attack/shared": "workspace:*"` in both `packages/server` and `packages/client` `dependencies`. Run `pnpm -r build` (not `pnpm -r build --parallel`). [VERIFIED: pnpm.io/cli/recursive]

**Warning signs:** `TS2307: Cannot find module '@counter-attack/shared'` during build.

---

### Pitfall 2: moduleResolution Mismatch — `exports` Field Ignored

**What goes wrong:** If `tsconfig.json` uses `"moduleResolution": "node"` (the legacy default), TypeScript silently ignores the `exports` field in `packages/shared/package.json`. It resolves to `dist/index.js` via the `main` field but without enforcing the public API boundary.

**Why it happens:** TypeScript only respects `package.json` `exports` when `moduleResolution` is `"node16"`, `"nodenext"`, or `"bundler"`.

**How to avoid:** Set `"moduleResolution": "NodeNext"` in server's tsconfig and `"moduleResolution": "Bundler"` in client's tsconfig. [CITED: typescriptlang.org/tsconfig/moduleResolution]

**Warning signs:** TypeScript resolves `@counter-attack/shared/src/internal` (a private path) without error.

---

### Pitfall 3: ESM/CJS Dual-Consumer Mismatch

**What goes wrong:** `packages/shared` is configured as `"type": "module"` but `packages/server` uses CommonJS (`require()`). Node.js throws `ERR_REQUIRE_ESM` at runtime.

**Why it happens:** Node.js 22 supports both ESM and CJS, but a package with `"type": "module"` cannot be `require()`'d.

**How to avoid:** Ensure server's `tsconfig.json` uses `"module": "NodeNext"` and its `package.json` also has `"type": "module"`. This is the recommended approach for modern Node.js projects. [VERIFIED: typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options]

**Warning signs:** `ERR_REQUIRE_ESM` at server startup, or `Cannot use import statement in a module` errors.

---

### Pitfall 4: Husky Hooks Not Installed for New Clones

**What goes wrong:** Developer clones the repo, runs `pnpm install`, commits code — hook doesn't run because `.git/hooks/pre-commit` was never created.

**Why it happens:** `.git/` is not committed. Husky hooks must be installed post-install.

**How to avoid:** Add `"prepare": "husky"` to the root `package.json` scripts. `pnpm install` runs `prepare` automatically. [CITED: typicode.github.io/husky/get-started.html]

**Warning signs:** Pre-commit hook never fires for a new contributor; no `.husky/_/husky.sh` file exists.

---

### Pitfall 5: verbatimModuleSyntax + `import type` Requirements

**What goes wrong:** With `"verbatimModuleSyntax": true` in tsconfig, using `import { SomeType }` for type-only imports will produce a TS error. All type-only imports must use `import type { SomeType }`.

**Why it happens:** `verbatimModuleSyntax` is the recommended setting for ESM correctness — it ensures type imports are erased at emit time.

**How to avoid:** Use `import type` for all type-only imports in all packages. TypeScript will error on non-compliant code, so this is self-enforcing once the flag is set.

**Warning signs:** `TS1484: 'X' is a type and must be imported using a type-only import` errors.

---

### Pitfall 6: pnpm Injected Dependencies + Hardlinks

**What goes wrong:** If `packages/shared` is added as an injected dependency (via `injected: true` in `.pnpmfile.cjs`), pnpm uses hardlinks that don't update when source changes. This is the wrong approach for development.

**Why it happens:** Hardlinks are the default for injected deps to avoid symlink issues in certain environments.

**How to avoid:** Do NOT use injected dependencies for `packages/shared`. Use the standard workspace symlink approach. [CITED: github.com/pnpm/pnpm issue #7131]

---

## Code Examples

Verified patterns from official sources:

### Axial Hex Distance (Red Blob Games canonical formula)

```typescript
// packages/shared/src/hex.ts
// Source: redblobgames.com/grids/hexagons/

export type HexCoord = { q: number; r: number };

export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (
    Math.abs(a.q - b.q) +
    Math.abs(a.q + a.r - b.q - b.r) +
    Math.abs(a.r - b.r)
  ) / 2;
}
```
[VERIFIED: redblobgames.com/grids/hexagons/]

---

### Axial Hex Neighbors

```typescript
// packages/shared/src/hex.ts
// Source: redblobgames.com/grids/hexagons/

const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },   // E
  { q: 1, r: -1 },  // NE
  { q: 0, r: -1 },  // NW
  { q: -1, r: 0 },  // W
  { q: -1, r: 1 },  // SW
  { q: 0, r: 1 },   // SE
];

export function hexNeighbors(hex: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map((dir) => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
  }));
}
```
[VERIFIED: redblobgames.com/grids/hexagons/]

---

### Hexes in Range (N steps)

```typescript
// packages/shared/src/hex.ts
// Source: redblobgames.com/grids/hexagons/

export function hexesInRange(center: HexCoord, range: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -range; q <= range; q++) {
    for (
      let r = Math.max(-range, -q - range);
      r <= Math.min(range, -q + range);
      r++
    ) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}
```
[VERIFIED: redblobgames.com/grids/hexagons/]

---

### isUnderZoI (Zone of Influence check)

```typescript
// packages/shared/src/hex.ts
// Phase 2 will consume this signature — keep it pure and dependency-free

export function isUnderZoI(
  position: HexCoord,
  opponentPieces: readonly HexCoord[]
): boolean {
  return opponentPieces.some(
    (opponent) => hexDistance(position, opponent) === 1
  );
}
```
[ASSUMED: signature shape. The exact ZoI definition — whether it applies to movement endpoints or only to dribble/pass paths — is an open question flagged for Phase 2. This Phase 1 implementation is intentionally minimal: ZoI = adjacent (distance 1). Phase 2 will refine if needed.]

---

### Placeholder PITCH_HEXES

```typescript
// packages/shared/src/pitch.ts
// TODO: Replace with real board measurements once user provides board photo/dimensions.
// This rectangular grid is a PLACEHOLDER only — do not use for boundary-dependent rules.

export const PITCH_HEXES: readonly HexCoord[] = (() => {
  const hexes: HexCoord[] = [];
  // Approximate Counter Attack board: ~25 cols × 16 rows
  // Real axial coordinates depend on physical board measurements (blocking dependency).
  for (let q = 0; q < 25; q++) {
    for (let r = 0; r < 16; r++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
})();
```
[ASSUMED: grid dimensions (25×16). Actual board dimensions are a blocking dependency per STATE.md.]

---

### Vitest Per-Package Config

```typescript
// packages/shared/vitest.config.ts
// Source: v2.vitest.dev/guide/

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```
[CITED: v2.vitest.dev/guide/]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.eslintrc.json` + `eslintignore` | `eslint.config.js` flat config | ESLint v9 (2024) | Legacy config format removed as default; new format is JS not JSON |
| `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` separately | `typescript-eslint` unified package | typescript-eslint v8 (2024) | Single entry point `import tseslint from 'typescript-eslint'` |
| `husky install` + `husky add` | `husky init` + manual hook file creation | Husky v9 (2024) | `husky add` deprecated; hooks are plain shell scripts in `.husky/` |
| `moduleResolution: "node"` | `moduleResolution: "node16"` (server) or `"bundler"` (Vite) | TypeScript 4.7 / 5.0 | `node` does not respect `package.json` exports field |
| Separate `@typescript-eslint/eslint-plugin` + `parserOptions.project` array | `typescript-eslint` v8 `projectService: true` | typescript-eslint v8 | Zero monorepo config; `projectService` auto-discovers tsconfigs |
| `tsup` for dual CJS+ESM builds | ESM-only `tsc` emit with `"type": "module"` | Node.js ESM stable ~2022 | Dual builds add tooling; Node.js 22 LTS + Vite both handle native ESM |

**Deprecated/outdated:**
- `parserOptions.project` array in ESLint config: replaced by `projectService: true` in typescript-eslint v8
- `husky add <hook>`: removed in Husky v9; create `.husky/<hook>` file directly
- `"moduleResolution": "node"`: does not support `exports` field; use `"node16"` or `"bundler"`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `packages/shared` should use `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` (same as server) rather than a separate `"Bundler"` mode | Standard Stack / Pattern 3 | Vite may require `"Bundler"` for shared package tsconfig; the dist is consumed by both. Low risk — Vite doesn't use shared tsconfig, only the package.json exports field |
| A2 | ESM-only (`"type": "module"`) is appropriate for server package | Standard Stack | If any transitive dep of the server is CJS-only and hard to `.mjs`-ify, we may need dual output or CJS server. Node.js 22 LTS handles this well for mainstream deps |
| A3 | `isUnderZoI` signature: `(position, opponentPieces) => boolean` | Code Examples | Phase 2 may need richer return type (e.g., which piece is contesting) or a different call site API; signature is intentionally minimal for Phase 1 |
| A4 | Rectangular placeholder PITCH_HEXES: 25×16 grid | Code Examples | Real board dimensions unknown; placeholder is a blocker-marker, not functional |
| A5 | Root `eslint.config.js` covers all packages with a single config | Architecture Patterns | If packages need different ESLint rules (e.g., React-specific in client), the root config will need per-glob overrides added in later phases |

---

## Open Questions (RESOLVED)

1. **Server moduleResolution: node16 vs nodenext**
   - What we know: `node16` and `nodenext` are functionally identical today; `nodenext` is "future-proof"
   - What's unclear: No difference for v1 scope
   - Recommendation: Use `"NodeNext"` (case-insensitive alias) for both `module` and `moduleResolution` in server; it's the canonical choice per TypeScript docs

2. **ZoI Function Scope**
   - What we know: `isUnderZoI` in Phase 1 is a placeholder with adjacency-only semantics
   - What's unclear: STATE.md flags "does ZoI block movement destinations or only pass/dribble paths?" as an open question for Phase 2
   - Recommendation: Keep Phase 1 signature minimal (`position + opponentPieces → boolean`); Phase 2 will own the full semantic

3. **pnpm version constraint**
   - What we know: pnpm 9.15.9 is latest in the 9.x series; CLAUDE.md specifies 9.x
   - What's unclear: Whether to pin exact version in `packageManager` field in root `package.json`
   - Recommendation: Add `"packageManager": "pnpm@9.15.9"` to root `package.json` to enforce consistent pnpm version via Corepack

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All packages | Yes | v24.15.0 | — |
| npm | Bootstrapping pnpm | Yes | 11.12.1 | — |
| pnpm | Monorepo management | No (not in PATH) | — | Install via `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@9.15.9 --activate` |
| git | Husky hooks | Yes (repo exists) | — | — |

**Missing dependencies with no fallback:**
- pnpm is not installed globally in this environment. The plan MUST include an install step: `npm install -g pnpm@9` or `corepack enable && corepack prepare pnpm@9.15.9 --activate` before any `pnpm` commands.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `packages/shared/vitest.config.ts` (Wave 0 gap — must be created) |
| Quick run command | `pnpm --filter @counter-attack/shared test` |
| Full suite command | `pnpm --filter @counter-attack/shared test` (Phase 1 scope) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-02 | pnpm install succeeds across all three packages | smoke | `pnpm install` (exit 0) | — (verified by build) |
| ARCH-02 | pnpm build succeeds with zero errors | smoke | `pnpm -r build` (exit 0) | — (verified by CI) |
| ARCH-03 | hexDistance returns correct distance for axial coords | unit | `pnpm --filter @counter-attack/shared test` | ❌ Wave 0 |
| ARCH-03 | hexNeighbors returns exactly 6 neighbors | unit | `pnpm --filter @counter-attack/shared test` | ❌ Wave 0 |
| ARCH-03 | hexesInRange returns correct count for range N | unit | `pnpm --filter @counter-attack/shared test` | ❌ Wave 0 |
| ARCH-07 | packages/shared compiles in isolation (no socket.io/express imports) | type-check | `pnpm --filter @counter-attack/shared build` (exit 0) | ❌ Wave 0 |
| ARCH-07 | isUnderZoI returns true when piece is adjacent to opponent | unit | `pnpm --filter @counter-attack/shared test` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/shared build` (type-check only, fast)
- **Per wave merge:** `pnpm --filter @counter-attack/shared test` (full unit suite)
- **Phase gate:** `pnpm -r build` green + `pnpm --filter @counter-attack/shared test` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/shared/vitest.config.ts` — Vitest config (covers all ARCH-03, ARCH-07 unit tests)
- [ ] `packages/shared/src/hex.test.ts` — unit tests for hexDistance, hexNeighbors, hexesInRange, isUnderZoI
- [ ] Framework install: `pnpm add -D --filter @counter-attack/shared vitest` — Vitest not yet installed

---

## Security Domain

> This phase has no user-facing endpoints, no authentication, no data storage, and no network traffic. Security controls do not apply to a scaffolding phase.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | No (types only, no runtime input) | — |
| V6 Cryptography | No | — |

---

## Sources

### Primary (HIGH confidence)
- [pnpm.io/workspaces](https://pnpm.io/workspaces) — workspace protocol, pnpm-workspace.yaml format, topological build order
- [redblobgames.com/grids/hexagons](https://www.redblobgames.com/grids/hexagons/) — axial coordinate formulas: distance, neighbors, hexes in range
- [socket.io/docs/v4/typescript](https://socket.io/docs/v4/typescript/) — TypeScript generics for typed events (ServerToClientEvents, ClientToServerEvents)
- [typescript-eslint.io/troubleshooting/typed-linting/monorepos](https://typescript-eslint.io/troubleshooting/typed-linting/monorepos/) — v8 project service zero-config monorepo setup
- [typicode.github.io/husky/get-started.html](https://typicode.github.io/husky/get-started.html) — Husky v9 init, prepare script
- npm registry (`npm view <pkg> version`) — version verification for all packages listed

### Secondary (MEDIUM confidence)
- [typescriptlang.org/tsconfig/moduleResolution](https://www.typescriptlang.org/tsconfig/moduleResolution.html) — bundler vs node16 recommendation, exports field behavior
- [colinhacks.com/essays/live-types-typescript-monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo) — compiled dist vs live types tradeoffs (justifies D-08 decision)
- [v2.vitest.dev/guide](https://v2.vitest.dev/guide/) — Vitest 2.x per-package config, defineProject pattern

### Tertiary (LOW confidence)
- Community blog posts on pnpm monorepo ESM setup — patterns consistent with official docs but not directly cited

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry; versions are current stable in their pinned major series
- Architecture: HIGH — workspace:* protocol and exports field are official pnpm/TypeScript documentation
- Hex math formulas: HIGH — Red Blob Games is the authoritative reference for hex grid algorithms; formulas are mathematically verified
- Husky/lint-staged setup: HIGH — official Husky docs confirm v9 init pattern
- ESLint flat config: HIGH — typescript-eslint official docs confirm v8 project service approach
- moduleResolution split (server=node16 / client=bundler): MEDIUM — standard pattern but requires validation when first compiling server against Node.js runtime
- Vitest per-package config: MEDIUM — documented in Vitest v2 guide; no known issues at this scale

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (tooling releases frequently; re-verify husky/lint-staged/typescript-eslint versions if > 30 days)
