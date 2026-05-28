# Phase 1: Monorepo Scaffold + Shared Types - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the pnpm monorepo with three packages (`packages/shared`, `packages/server`, `packages/client`), TypeScript compilation wired end-to-end, all shared types and interfaces, hex math utilities as pure axial functions, Socket.io event constants, and a consistent dev tooling baseline (ESLint, Prettier, Husky) — so every subsequent phase has a stable, importable foundation.

Deliverables: `pnpm install && pnpm build` succeeds across all three packages; `packages/shared` exports `HexCoord`, `GameState`, `PlayerPiece`, `BallState`, `GamePhase` types plus `hexDistance`, `hexNeighbors`, `hexesInRange`, `isUnderZoI`; placeholder `PITCH_HEXES` present.

</domain>

<decisions>
## Implementation Decisions

### Test Runner
- **D-01:** Use **Vitest** as the test framework for `packages/shared`. Aligns with the Vite frontend, is ESM-native, and requires no babel/ts-jest configuration.
- **D-02:** Vitest is configured **only in `packages/shared`** for Phase 1. Server and client test configs are added in their respective phases. Config file lives at `packages/shared/vitest.config.ts` (per-package, not a root workspace config).

### Hex Math in packages/shared
- **D-03:** `packages/shared` implements hex math (`hexDistance`, `hexNeighbors`, `hexesInRange`, `isUnderZoI`) as **pure axial arithmetic** — TypeScript math on `{q, r}` objects with zero external dependencies. No `honeycomb-grid` dependency in `packages/shared`.
- **D-04:** `axialToPixel` (and any other pixel/rendering conversion) lives **exclusively in `packages/client`**. The server's import chain never sees rendering code.
- **D-05:** All shared exports use a **single root index** (`import { hexDistance, GameState } from '@counter-attack/shared'`). No sub-path exports at this stage.

### TypeScript Build Wiring
- **D-06:** Resolution via **`package.json` exports + pnpm workspace symlinks**. Each package declares `main` / `types` in its `package.json`; pnpm workspaces symlinks them under `node_modules`. Both `tsc` and Vite resolve via `node_modules`. No TypeScript composite project references.
- **D-07:** **Root `tsconfig.base.json`** with shared strict settings (`strict: true`, `noUncheckedIndexedAccess`, etc.). Each package's `tsconfig.json` extends it and adds package-specific overrides (e.g. `"lib": ["dom"]` for client only).
- **D-08:** `packages/shared` **builds to `/dist`** via `tsc` emit (JS + `.d.ts`). Server and client import compiled output. This is required for Node.js runtime resolution — the server cannot import `.ts` files directly.

### Dev Tooling Scope
- **D-09:** **ESLint + Prettier included in Phase 1**. Clean from the first commit; no backfill needed in later phases.
- **D-10:** ESLint base: **`typescript-eslint` recommended + `eslint-config-prettier`**. Minimal and well-maintained; covers TS correctness and consistent style across all three packages.
- **D-11:** **Husky + lint-staged** wired as a pre-commit hook. Auto-formats and lints on every commit.

### Claude's Discretion
- Module format for `packages/shared` dist output (ESM vs CJS vs dual): choose based on what Node.js + Vite consumption requires — likely ESM-only given the stack.
- Exact `tsconfig.base.json` strict flags beyond `strict: true`: use the recommended typescript-eslint strict preset as the baseline.
- Prettier config specifics (print width, trailing commas, semi): use community defaults.
- Package naming convention for the workspace packages (e.g. `@counter-attack/shared` vs `shared`): use scoped names for clarity.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` §Technical Architecture — ARCH-02, ARCH-03, ARCH-07 are the three requirements this phase must satisfy; read them for the exact acceptance criteria wording.
- `.planning/PROJECT.md` §Technology Stack — full version table and rationale for pnpm, TypeScript, Socket.io v4, React + Vite, honeycomb-grid.
- `.planning/STATE.md` §Decisions Locked and §Key Pitfalls to Avoid — locked architectural decisions and pitfalls that MUST be respected (axial-only coords, typed Socket.io events, no offset coordinates).

### Phase Roadmap
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria, and dependency list for this phase. Read success criteria verbatim when writing the plan acceptance tests.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is the first phase; the repo is empty beyond planning documents.

### Established Patterns
- Axial `{q, r}` coordinate objects are locked from day one. Every hex math function signature must use this type, not cube or offset coordinates.
- Server-authoritative state pattern (locked): all game logic runs on the server; client receives state snapshots. The `packages/shared` types must support full `GameState` serialisation.

### Integration Points
- `packages/shared/src/index.ts` → imported by `packages/server` and `packages/client` in every subsequent phase. The public API surface established here is the contract for all later work.
- `packages/shared/src/hex.ts` → `hexDistance`, `hexNeighbors`, `hexesInRange`, `isUnderZoI` are consumed by Phase 2's move validator. The function signatures must be stable.
- `packages/shared/src/pitch.ts` → `PITCH_HEXES` placeholder used by Phase 4 (Game Engine) before real board measurements arrive.

</code_context>

<specifics>
## Specific Ideas

- `packages/shared/src/pitch.ts` must include a clear comment marking `PITCH_HEXES` as a placeholder pending real board measurements (per ROADMAP.md success criteria 5 and STATE.md blocking dependency note).
- Socket.io event constants should be typed `const` objects (not enums) per ROADMAP.md success criteria 4.
- The `isUnderZoI` function signature matters for Phase 2: it should accept a piece position and a list of opponent pieces, returning a boolean — keep it pure and dependency-free.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Monorepo Scaffold + Shared Types*
*Context gathered: 2026-05-28*
