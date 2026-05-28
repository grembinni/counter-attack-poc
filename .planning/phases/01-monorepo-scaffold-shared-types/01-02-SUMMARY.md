---
phase: 01-monorepo-scaffold-shared-types
plan: '02'
subsystem: packages/shared
tags: [typescript, hex-math, vitest, tdd, socket-io-types, pnpm-workspace]
dependency_graph:
  requires:
    - 01-01 (pnpm-workspace.yaml, tsconfig.base.json, eslint.config.js)
  provides:
    - packages/shared/dist/index.js (ESM runtime output for server)
    - packages/shared/dist/index.d.ts (type declarations for editor/IDE)
    - HexCoord, PlayerPiece, BallState, GamePhase, GameState types
    - hexDistance, hexNeighbors, hexesInRange, isUnderZoI pure functions
    - ClientEvents, ServerEvents typed const objects
    - ClientToServerEvents, ServerToClientEvents event-map interfaces
    - PITCH_HEXES placeholder coordinate set
  affects:
    - packages/server (will consume @counter-attack/shared in Phase 3)
    - packages/client (will consume @counter-attack/shared in Phase 3/6)
tech_stack:
  added:
    - vitest@2.1.9 (devDependency on packages/shared only, D-02)
    - '@types/node@22.19.19' (devDependency on packages/shared)
  patterns:
    - TDD RED/GREEN discipline (failing tests committed before implementation)
    - NodeNext module resolution with explicit .js import extensions
    - Pure axial hex arithmetic from Red Blob Games canonical formulas
    - as const Socket.io event objects (not TypeScript enums)
    - IIFE for readonly constant arrays (PITCH_HEXES)
    - tsconfig.test.json for separate ESLint/typecheck scope of test files
    - eslint.config.js allowDefaultProject for test files excluded from main tsconfig
key_files:
  created:
    - packages/shared/package.json
    - packages/shared/tsconfig.json
    - packages/shared/tsconfig.test.json
    - packages/shared/vitest.config.ts
    - packages/shared/src/types.ts
    - packages/shared/src/hex.ts
    - packages/shared/src/hex.test.ts
    - packages/shared/src/events.ts
    - packages/shared/src/pitch.ts
    - packages/shared/src/index.ts
  modified:
    - eslint.config.js (allowDefaultProject for test files, relaxed unsafe rules for *.test.ts)
    - pnpm-lock.yaml (vitest@2.1.9, @types/node@22.19.19 added)
decisions:
  - 'NodeNext module resolution requires explicit .js extensions in relative imports inside packages/shared/src/'
  - 'tsconfig.test.json created to allow ESLint project service to parse test files excluded from main tsconfig build'
  - 'eslint.config.js updated with allowDefaultProject and relaxed no-unsafe-* rules for *.test.ts'
  - 'Test expectation corrected: hexDistance({q:1,r:2},{q:-2,r:-1}) = 6 not 3 (cube coordinate math verified)'
  - 'dist/ is gitignored per .gitignore; compiled output exists on disk but not committed'
metrics:
  duration: '12m 0s'
  completed_date: '2026-05-28'
  tasks_completed: 3
  files_created: 10
  files_modified: 2
---

# Phase 01 Plan 02: Shared Types and Hex Math Package Summary

`packages/shared` built with HexCoord/GameState/PlayerPiece/BallState/GamePhase types, pure axial hex math (hexDistance/hexNeighbors/hexesInRange/isUnderZoI), typed Socket.io event const objects, and placeholder PITCH_HEXES — compiled to `dist/` as ESM with 14 passing Vitest tests.

## Tasks Completed

| Task      | Name                                                      | Commit  | Files                                                                                     |
| --------- | --------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| 1         | Scaffold packages/shared (package.json, tsconfig, vitest) | b24d8c0 | packages/shared/package.json, tsconfig.json, vitest.config.ts, pnpm-lock.yaml             |
| 2 (RED)   | Write failing hex math tests                              | 64ac065 | packages/shared/src/hex.test.ts, packages/shared/tsconfig.test.json, eslint.config.js     |
| 2 (GREEN) | Implement types.ts and hex.ts                             | db53549 | packages/shared/src/types.ts, packages/shared/src/hex.ts, packages/shared/src/hex.test.ts |
| 3         | Create events.ts, pitch.ts, index.ts; build to dist/      | be45251 | packages/shared/src/events.ts, packages/shared/src/pitch.ts, packages/shared/src/index.ts |

## TDD Gate Compliance

- RED gate: `test(01-02)` commit `64ac065` — test file committed with failing tests (module-not-found on ./hex.js)
- GREEN gate: `feat(01-02)` commit `db53549` — implementation committed after all 14 tests pass
- REFACTOR gate: not needed (code is clean as written)

## Test Results — All 14 Tests Pass

```
 RUN  v2.1.9

 src/hex.test.ts (14 tests)

hexDistance
  ✓ returns 0 for the same hex
  ✓ returns 3 for {q:0,r:0} to {q:3,r:0}
  ✓ returns 2 for {q:0,r:0} to {q:2,r:-2} (diagonal axis)
  ✓ returns 6 for {q:1,r:2} to {q:-2,r:-1} (non-origin pair)

hexNeighbors
  ✓ returns exactly 6 neighbors for {q:0,r:0}
  ✓ contains {q:1,r:0} (E direction) among neighbors of {q:0,r:0}
  ✓ contains {q:0,r:-1} (NW direction) among neighbors of {q:0,r:0}
  ✓ every neighbor of {q:0,r:0} has hexDistance === 1

hexesInRange
  ✓ returns 1 hex for range 0 (center only)
  ✓ returns 7 hexes for range 1 (center + 6 neighbors)
  ✓ returns 19 hexes for range 2 (canonical hex ring count: 1+6+12)

isUnderZoI
  ✓ returns true when an opponent is adjacent (distance 1)
  ✓ returns false when opponent is distant (distance 3)
  ✓ returns false when opponent list is empty

Test Files  1 passed (1)
     Tests  14 passed (14)
```

## Build Output — dist/ Contents

```
packages/shared/dist/
  events.d.ts  events.d.ts.map  events.js  events.js.map
  hex.d.ts     hex.d.ts.map     hex.js     hex.js.map
  index.d.ts   index.d.ts.map   index.js   index.js.map
  pitch.d.ts   pitch.d.ts.map   pitch.js   pitch.js.map
  types.d.ts   types.d.ts.map   types.js   types.js.map
```

20 files emitted (5 modules × 4 outputs each: .js, .js.map, .d.ts, .d.ts.map).

## ESM Consumption Verified

```
node --input-type=module -e "import { hexDistance, ClientEvents, PITCH_HEXES } from './packages/shared/dist/index.js'; console.log(hexDistance({q:0,r:0},{q:3,r:0}), ClientEvents.ROOM_CREATE, PITCH_HEXES.length);"
3 room:create 400
```

## Zero Framework Imports Confirmed

```
grep -rE "from ['\"](socket\.io|express|honeycomb-grid)" packages/shared/src/
(no output — clean)
```

No `socket.io`, `express`, or `honeycomb-grid` imports in any `packages/shared/src/` file. ARCH-07 satisfied.

## Zero Pixel Code Confirmed

```
grep -rE "(axialToPixel|hexToPixel|toPixel)" packages/shared/src/
(no output — clean)
```

D-04 satisfied: no pixel/rendering conversions in shared package.

## PITCH_HEXES Placeholder Comment Confirmed

`packages/shared/src/pitch.ts` contains both required strings:

- `PLACEHOLDER` — present (line 6)
- `pending real board measurements` — present (line 6 and line 17)

25 x 16 = 400 hexes. `PITCH_HEXES.length === 400`.

## Public API Surface

Everything exported from `packages/shared/src/index.ts`:

**Types (from types.ts):**

- `HexCoord` — `{ q: number; r: number }` (axial coordinate)
- `PlayerPiece` — full 9-attribute player object with position
- `BallState` — `{ position: HexCoord; carrierId: string | null }`
- `GamePhase` — string literal union of 12 game phases
- `GameState` — complete server-authoritative game state type

**Functions (from hex.ts):**

- `hexDistance(a, b)` — axial distance using Red Blob Games formula
- `hexNeighbors(hex)` — 6 axial direction neighbors
- `hexesInRange(center, range)` — all hexes within N steps
- `isUnderZoI(position, opponentPieces)` — adjacency-based ZoI check

**Constants (from events.ts):**

- `ClientEvents` — `{ ROOM_CREATE, ROOM_JOIN, GAME_MOVE, GAME_ROLL } as const`
- `ServerEvents` — `{ ROOM_JOINED, ROOM_ERROR, GAME_STATE, GAME_DISCONNECT_WARNING } as const`

**Interfaces (from events.ts):**

- `ClientToServerEvents` — typed event map for Socket.io server generic
- `ServerToClientEvents` — typed event map for Socket.io client generic

**Data (from pitch.ts):**

- `PITCH_HEXES` — `readonly HexCoord[]` placeholder 25x16 grid (400 hexes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint project service could not parse test files**

- **Found during:** Task 2 RED commit
- **Issue:** `hex.test.ts` is excluded from `tsconfig.json` (so tsc doesn't compile it), but ESLint's `projectService: true` could not locate the file in any tsconfig, causing a parse error blocking the pre-commit hook.
- **Fix:** Created `packages/shared/tsconfig.test.json` (includes test files, noEmit:true) and updated `eslint.config.js` with `allowDefaultProject: ['packages/*/src/*.test.ts']` plus relaxed `no-unsafe-*` rules for test files.
- **Files modified:** `packages/shared/tsconfig.test.json` (new), `eslint.config.js` (updated)
- **Commit:** 64ac065

**2. [Rule 1 - Bug] Incorrect test expectation for hexDistance**

- **Found during:** Task 2 GREEN run
- **Issue:** `hexDistance({q:1,r:2}, {q:-2,r:-1})` was expected to be `3` in the plan's behavior spec, but the correct axial distance is `6`. Cube coordinates: a=(1,2,-3), b=(-2,-1,3); max(|dq|,|dr|,|ds|) = max(3,3,6) = 6.
- **Fix:** Updated test expectation from `toBe(3)` to `toBe(6)` with explanatory comment showing the cube coordinate calculation.
- **Files modified:** `packages/shared/src/hex.test.ts`
- **Commit:** db53549

**3. [Deviation from plan] Barrel export paths use .js extension**

- **Found during:** Task 3 acceptance criteria verification
- **Issue:** The plan's grep pattern `"^export \* from ['\"]\./(types|hex|events|pitch)['\"]"` expected bare module names, but NodeNext module resolution requires `.js` extensions in relative imports (`./types.js` not `./types`). The plan's grep returns 0; a corrected grep returns 4.
- **Status:** Correct behavior — NodeNext mandates `.js` extensions. All 4 barrel exports present; plan grep was overly strict.

## Known Stubs

- `PITCH_HEXES` in `packages/shared/src/pitch.ts` — explicitly documented as a placeholder, contains required PLACEHOLDER comment and "pending real board measurements" text. Intentional; will be replaced in Phase 6 when user provides board dimensions.

## Threat Flags

None. `packages/shared` has no runtime, no endpoints, no data, and no secrets. See plan threat model.

## Self-Check: PASSED

All 10 created files exist. All 4 task commits found in git log.
