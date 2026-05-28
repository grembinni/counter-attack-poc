---
phase: 01-monorepo-scaffold-shared-types
plan: '03'
subsystem: monorepo-packages
tags: [pnpm, typescript, node, nodenext, bundler, moduleresolution, workspace, gitattributes]

dependency_graph:
  requires:
    - phase: 01-02
      provides: packages/shared/dist/ (ESM output consumed by server at runtime)
  provides:
    - packages/server/package.json (workspace dep on @counter-attack/shared)
    - packages/server/tsconfig.json (NodeNext moduleResolution)
    - packages/server/src/index.ts (proves runtime resolution: Pitch hexes 400)
    - packages/client/package.json (workspace dep on @counter-attack/shared)
    - packages/client/tsconfig.json (Bundler moduleResolution, noEmit:true)
    - packages/client/src/main.ts (proves type resolution via Bundler mode)
    - .gitattributes (LF line endings enforcement)
  affects:
    - packages/server (Phase 3 Socket.io server builds on this scaffold)
    - packages/client (Phase 6 React/Vite client builds on this scaffold)

tech-stack:
  added:
    - '@types/node@22.19.19 in packages/server devDependencies'
  patterns:
    - NodeNext module/moduleResolution for server (respects exports field at runtime)
    - Bundler module/moduleResolution for client (Vite-compatible, respects exports)
    - noEmit:true on client tsconfig (Vite handles bundling in Phase 6)
    - workspace:* protocol in dependencies (not devDependencies) for runtime packages
    - .gitattributes enforcing LF line endings on Windows (prevents CRLF/prettier conflict)

key-files:
  created:
    - packages/server/package.json
    - packages/server/tsconfig.json
    - packages/server/src/index.ts
    - packages/client/package.json
    - packages/client/tsconfig.json
    - packages/client/src/main.ts
    - .gitattributes
  modified:
    - pnpm-lock.yaml (new packages added)

key-decisions:
  - "@types/node added to packages/server devDependencies (plan omitted it but tsconfig types:['node'] requires it)"
  - '.gitattributes added to enforce LF line endings (Windows core.autocrlf=true caused prettier --check to fail)'
  - 'workspace:* placed in dependencies not devDependencies for server (runtime needs the dep, not just dev-time)'

patterns-established:
  - 'Server tsconfig: module:NodeNext + moduleResolution:NodeNext for Node.js ESM runtime'
  - 'Client tsconfig: module:ESNext + moduleResolution:Bundler + noEmit:true for Vite workflow'
  - 'Import type used for type-only imports (verbatimModuleSyntax compliance)'
  - 'Placeholder source files import shared types and values to prove resolution before real implementation'

requirements-completed:
  - ARCH-02

duration: 8min
completed: '2026-05-28'
---

# Phase 01 Plan 03: Server + Client Scaffold Summary

**packages/server and packages/client scaffolded with NodeNext/Bundler moduleResolution, proving end-to-end @counter-attack/shared resolution: `node packages/server/dist/index.js` prints "Pitch hexes: 400" and `pnpm -r build` exits 0 across all three packages.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-28T06:50:00Z
- **Completed:** 2026-05-28T06:58:00Z
- **Tasks:** 3
- **Files created:** 7
- **Files modified:** 2 (pnpm-lock.yaml, line-ending normalizations)

## Accomplishments

- `packages/server` scaffolded with NodeNext moduleResolution, imports from `@counter-attack/shared` at runtime via pnpm symlink — `node packages/server/dist/index.js` outputs `Pitch hexes: 400 first client event: room:create`
- `packages/client` scaffolded with Bundler moduleResolution and `noEmit:true`, imports `HexCoord`, `GameState`, `PlayerPiece`, `hexDistance`, `ClientEvents` from `@counter-attack/shared` — typecheck exits 0
- `pnpm -r build` exits 0 across all three packages in topological order (shared → server+client in parallel)
- Full Phase 1 acceptance battery passed: ESLint, Prettier, 14 Vitest tests, all 11 decisions verified

## Task Commits

1. **Task 1: Scaffold packages/server** - `0e4ef2b` (feat)
2. **Task 2: Scaffold packages/client** - `54f9815` (feat)
3. **Task 3 deviation: Add .gitattributes + normalize line endings** - `3846723` (fix)

## Files Created/Modified

- `packages/server/package.json` — @counter-attack/server with workspace:\* dep on shared, @types/node devDep
- `packages/server/tsconfig.json` — extends base, NodeNext module/moduleResolution, outDir:./dist
- `packages/server/src/index.ts` — type import HexCoord/GameState, value import PITCH_HEXES/ClientEvents; logs "Pitch hexes: 400"
- `packages/client/package.json` — @counter-attack/client with workspace:\* dep on shared
- `packages/client/tsconfig.json` — extends base, Bundler moduleResolution, DOM lib, noEmit:true, jsx:react-jsx
- `packages/client/src/main.ts` — type imports HexCoord/GameState/PlayerPiece, value imports hexDistance/ClientEvents; uses import type for type-only line
- `.gitattributes` — enforces LF line endings for all text/source files
- `pnpm-lock.yaml` — updated for @types/node in server devDeps

## Phase 1 ROADMAP Success Criteria Verification

| #   | Success Criterion                                                                               | Command                                               | Result                                                                                      |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | `pnpm install` and `pnpm build` succeed across all three packages                               | `pnpm -r build`                                       | PASS — shared → server+client all exit 0                                                    |
| 2   | Five shared types importable from both server and client                                        | grep imports in server/index.ts + client/main.ts      | PASS — HexCoord, GameState, PlayerPiece, BallState, GamePhase all exported from shared/dist |
| 3   | `pnpm --filter @counter-attack/shared test` passes with all assertions green                    | `pnpm --filter @counter-attack/shared test`           | PASS — 14/14 tests pass                                                                     |
| 4   | ESLint and Prettier clean                                                                       | `pnpm exec eslint .` + `pnpm exec prettier --check .` | PASS — both exit 0                                                                          |
| 5   | `packages/shared/src/pitch.ts` contains PLACEHOLDER comment + "pending real board measurements" | grep check                                            | PASS — both strings present on line 6                                                       |

## Decision Audit — D-01 through D-11

| Decision                                              | Evidence                                                                                                      | Status |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| D-01 Vitest in packages/shared                        | `packages/shared/vitest.config.ts` exists                                                                     | PASS   |
| D-02 Vitest only in shared (no root workspace config) | No `vitest.*` at repo root                                                                                    | PASS   |
| D-03 Pure axial math (no external deps in hex.ts)     | `grep "^import" packages/shared/src/hex.ts` → only `import type { HexCoord } from './types.js'`               | PASS   |
| D-04 No pixel code in shared or server                | `grep -rE "(axialToPixel\|hexToPixel\|toPixel)"` → 0 matches                                                  | PASS   |
| D-05 Single barrel export                             | `packages/shared/src/index.ts` has 4 `export *` lines; `packages/shared/package.json` has single `"."` export | PASS   |
| D-06 workspace:\* + exports field                     | Both server and client package.json contain `"@counter-attack/shared": "workspace:*"`; shared has `exports`   | PASS   |
| D-07 tsconfig.base.json extends                       | All three tsconfigs have `"extends": "../../tsconfig.base.json"`                                              | PASS   |
| D-08 shared builds to /dist                           | `packages/shared/dist/index.js` + `index.d.ts` exist                                                          | PASS   |
| D-09 ESLint + Prettier present                        | `eslint.config.js` + `.prettierrc` at repo root                                                               | PASS   |
| D-10 typescript-eslint + eslint-config-prettier       | `eslint.config.js` imports both                                                                               | PASS   |
| D-11 Husky + lint-staged                              | `.husky/pre-commit` contains `lint-staged`; `package.json` has lint-staged config                             | PASS   |

## pnpm -r build Output

```
Scope: 3 of 4 workspace projects
packages/shared build$ tsc
packages/shared build: Done
packages/client build$ tsc
packages/server build$ tsc
packages/client build: Done
packages/server build: Done
```

(root package has no build script — this is correct, only 3 of 4 workspace projects have build scripts)

## node packages/server/dist/index.js Output

```
Counter Attack server placeholder. Pitch hexes: 400 first client event: room:create
```

Proves:

1. `@counter-attack/shared` resolved at Node.js runtime via pnpm symlink
2. `PITCH_HEXES.length === 400` (25×16 placeholder grid from plan 02)
3. `ClientEvents.ROOM_CREATE === 'room:create'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @types/node missing from packages/server devDependencies**

- **Found during:** Task 1 (server build)
- **Issue:** Plan said "No devDependencies in Phase 1" but `packages/server/tsconfig.json` specifies `"types": ["node"]`, which requires `@types/node` to be installed. `tsc` errored: `error TS2688: Cannot find type definition file for 'node'`.
- **Fix:** Added `"devDependencies": { "@types/node": "22.19.19" }` to `packages/server/package.json` (same version as packages/shared).
- **Files modified:** `packages/server/package.json`
- **Verification:** `pnpm --filter @counter-attack/server build` exits 0
- **Committed in:** `0e4ef2b` (Task 1 commit)

**2. [Rule 3 - Blocking] Windows CRLF checkout caused prettier --check to fail**

- **Found during:** Task 3 (Step 4 — prettier --check)
- **Issue:** Git global `core.autocrlf=true` converts LF→CRLF on Windows checkout. With `"endOfLine": "lf"` in `.prettierrc`, running `prettier --check .` failed on 35 files (all text files in repo). This is a Windows-specific environment issue.
- **Fix:** Added `.gitattributes` with `* text=auto eol=lf` to force LF line endings. Ran `prettier --write .` to normalize all files on disk to LF. Only `.planning/` files and `CLAUDE.md` had real content changes (from CRLF→LF); source files in `packages/` already had LF in the index (git was converting on checkout only).
- **Files modified:** `.gitattributes` (new), `.planning/**` + `CLAUDE.md` (LF normalization)
- **Verification:** `pnpm exec prettier --check .` exits 0 after fix
- **Committed in:** `3846723` (fix commit)

---

**Total deviations:** 2 auto-fixed (2× Rule 3 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep. The @types/node omission was a plan oversight; the CRLF issue is a Windows-specific environment condition.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 1 is complete. The repo is ready for Phase 2 (move validator):

- `@counter-attack/shared` exports stable types (`HexCoord`, `GameState`, `PlayerPiece`, etc.) and hex math functions (`hexDistance`, `hexNeighbors`, `hexesInRange`, `isUnderZoI`) that Phase 2 can import directly
- `packages/server` and `packages/client` are scaffolded; Phase 3 adds Express/Socket.io to server, Phase 6 adds React/Vite to client
- `pnpm -r build` is green; CI baseline is established
- `.gitattributes` added — Windows developers will get correct LF line endings going forward

**Blocking dependencies unchanged:**

- Board layout (HARD BLOCK): pitch.ts uses 25×16 placeholder grid — Phase 6 needs real measurements
- Hex orientation: flat-top vs pointy-top not yet confirmed — Phase 6

**Final phase status: READY for Phase 2**

## Known Stubs

- `packages/server/src/index.ts` — placeholder that logs and exits; Phase 3 replaces with real server (Express + Socket.io)
- `packages/client/src/main.ts` — placeholder for type resolution proof; Phase 6 replaces with React/Vite entrypoint
- `PITCH_HEXES` in `packages/shared/src/pitch.ts` — 25×16 placeholder grid pending real board measurements (intentional, documented)

## Threat Flags

None. Both placeholder files are scaffolding only:

- Server placeholder runs `console.log` once and exits — no port binding, no network input, no endpoints
- Client placeholder is type-checked but never executed in a browser in this phase

---

_Phase: 01-monorepo-scaffold-shared-types_
_Completed: 2026-05-28_
