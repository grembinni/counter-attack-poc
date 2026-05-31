---
phase: 06-react-hex-grid-renderer
plan: '01'
subsystem: shared-pitch + client-scaffold
tags:
  - pitch-grid
  - react
  - vite
  - zustand
  - hex-math
  - mock-state
dependency_graph:
  requires:
    - '05-dice-resolver-all-resolution-branches'
  provides:
    - pitch-37x26-constants
    - client-vite-scaffold
    - zustand-game-store
    - hex-to-pixel-utility
    - mock-game-states
  affects:
    - packages/shared/src/pitch.ts
    - packages/client/*
    - packages/server/src/__tests__/gameEngine.test.ts
tech_stack:
  added:
    - react@18.3.1
    - react-dom@18.3.1
    - vite@5.4.21
    - '@vitejs/plugin-react@4.7.0'
    - zustand@4.5.7
    - honeycomb-grid@4.1.5
    - socket.io-client@4.8.3
    - vitest@2.1.9 (client)
    - jsdom@25.0.0
    - '@testing-library/react@14.3.1'
  patterns:
    - TDD (RED/GREEN/REFACTOR per task)
    - Zustand 4.x curried create<T>()() TypeScript form
    - axialToPixel flat-top hex formula (D-03)
    - ReadonlySet<string> for O(1) pitch region membership
key_files:
  created:
    - packages/client/package.json (updated with React 18 + Vite 5 + Zustand 4)
    - packages/client/tsconfig.json (added types:["vite/client"])
    - packages/client/vite.config.ts
    - packages/client/vitest.config.ts
    - packages/client/index.html
    - packages/client/src/main.tsx
    - packages/client/src/App.tsx
    - packages/client/src/App.module.css
    - packages/client/src/utils/hexToPixel.ts
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/mock/mockMovementState.ts
    - packages/client/src/mock/mockPassState.ts
    - packages/client/src/mock/mockShotState.ts
    - packages/client/src/mock/mockGKRestartState.ts
    - packages/client/src/mock/index.ts
  modified:
    - packages/shared/src/pitch.ts (37x26 grid, D-04/D-05 regions)
    - packages/shared/src/pitch.test.ts (rewritten for 37x26 assertions)
    - packages/server/src/__tests__/gameEngine.test.ts (kickoff hex fix, Rule 1)
decisions:
  - 'kickOffHex set to {q:18, r:13} per D-05 (real board centre of 37×26 grid)'
  - 'DIFFICULT_ANGLE_HEXES approximated as 16 hexes near penalty area corners (TODO: verify vs board photo D-06)'
  - "HEX_SIZE=20px selected per CONTEXT.md Claude's discretion (18–22px range)"
  - 'Zustand 4.5.7 pinned (not npm latest v5 — breaking API changes)'
  - 'React 18.3.1 pinned (not npm latest v19 — type definition changes)'
  - 'homeGoal and awayGoal added to PitchRegions type (needed by render layer)'
metrics:
  duration_minutes: 6
  completed_date: '2026-05-30'
  tasks_completed: 3
  files_created: 17
  files_modified: 3
---

# Phase 6 Plan 01: Client Scaffold + Pitch Data Foundation Summary

**One-liner:** Replaced placeholder 25×16 pitch with real 37×26 grid (962 hexes, D-04/D-05 regions) and bootstrapped React 18 + Vite 5 + Zustand 4 client scaffold with hexToPixel utility and 4 mock GameState fixtures.

## Tasks Completed

| #   | Name                                                                                       | Commit  | Result                                                |
| --- | ------------------------------------------------------------------------------------------ | ------- | ----------------------------------------------------- |
| 1   | Replace pitch.ts (37×26) and rewrite pitch.test.ts                                         | b33bd73 | 19 tests green; PITCH_HEXES.length===962              |
| 2   | Client scaffold — package.json, tsconfig, vite.config, vitest.config, index.html, main.tsx | 0242318 | vite build exits 0; React 18 + Vite 5 mounted         |
| 3   | hexToPixel utility + Zustand store + mock states + store unit tests                        | 0aa87d6 | 6 store tests green; pnpm -r test exits 0 (224 tests) |

## Verification Results

1. `pnpm --filter @counter-attack/shared test` — 134 tests, all green (19 pitch tests with 37×26 values)
2. `pnpm --filter @counter-attack/client test` — 6 tests, all green (useGameStore selectPiece/movePiece/setScreen)
3. `pnpm --filter @counter-attack/client build` — exits 0 (Vite compiles TypeScript cleanly)
4. `pnpm -r test` — 224 tests, all green across shared + server + client

## Must-Have Truths Verified

- `PITCH_HEXES.length === 962` — confirmed (37×26 = 962)
- `PITCH_REGIONS.kickOffHex === { q: 18, r: 13 }` — confirmed
- `homeGoal` and `awayGoal` regions exist in `PitchRegions` type and `PITCH_REGIONS` — confirmed
- `pnpm --filter @counter-attack/client build` exits 0 — confirmed
- `pnpm --filter @counter-attack/client test` passes — confirmed (6 tests)
- `hexToPixel.ts` exports `axialToPixel`, `hexPolygonPoints`, `computeViewBox`, `HEX_SIZE` — confirmed
- `useGameStore` exports Zustand 4.x store with `gameState`, `screen`, `selectedPieceId`, `validMoveHexes`, `setScreen`, `selectPiece`, `movePiece` — confirmed

## Decisions Made

- **kickOffHex = {q:18, r:13}**: Real board centre of 37×26 grid per D-05. Replaces placeholder {q:12, r:7}.
- **DIFFICULT_ANGLE_HEXES approximated**: 16 hexes at penalty area corners (q∈[3,4] and q∈[32,33], near r-boundaries of penalty box). TODO: verify against `docs/board-photo.jpg` when available (D-06).
- **HEX_SIZE = 20px**: Selected within Claude's discretion range (18–22px per CONTEXT.md).
- **Pinned react@^18.3.1 and zustand@^4.5.7**: Not npm latest (v19 / v5) — these versions have breaking API changes. Versions verified against RESEARCH.md slopcheck.
- **homeGoal + awayGoal added to PitchRegions**: Required by threat model T-06-01 (goal detection) and render layer in Plan 06-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed server gameEngine.test.ts kickoff hex assertion**

- **Found during:** Task 3 (pnpm -r test)
- **Issue:** `buildInitialGameState` uses `PITCH_REGIONS.kickOffHex` which was updated from `{q:12, r:7}` to `{q:18, r:13}` in Task 1. The server test asserted the old value.
- **Fix:** Updated assertion in `packages/server/src/__tests__/gameEngine.test.ts` line 90-93 to expect `{q:18, r:13}`.
- **Files modified:** `packages/server/src/__tests__/gameEngine.test.ts`
- **Commit:** 0aa87d6 (included in Task 3 commit)

## Known Stubs

- `packages/client/src/App.tsx`: Returns `<div>Counter Attack — Loading...</div>` — intentional stub, replaced in Plan 06-03 when GameBoard and LobbyScreen components are built.
- `packages/client/src/App.module.css`: Contains only `.app { font-family: sans-serif; }` — intentional stub, expanded in Plan 06-03.

These stubs do not prevent Plan 06-01's goal (data foundation + scaffold). Plan 06-03 wires the full UI.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. All files in this plan are pure client-side utilities, data fixtures, and build config. T-06-01 (ActionEvent rendering) and T-06-03 (room code input) are addressed in Plan 06-03 where those UI components are created.

## Self-Check: PASSED

Files exist:

- packages/shared/src/pitch.ts — FOUND
- packages/shared/src/pitch.test.ts — FOUND
- packages/client/package.json — FOUND (contains react@^18.3.1, zustand@^4.5.7)
- packages/client/vite.config.ts — FOUND (contains plugin-react)
- packages/client/src/utils/hexToPixel.ts — FOUND (exports axialToPixel)
- packages/client/src/store/useGameStore.ts — FOUND (contains create<GameStore>())
- packages/client/src/store/useGameStore.test.ts — FOUND (contains selectPiece)
- packages/client/src/mock/mockMovementState.ts — FOUND (contains MOVEMENT)

Commits verified:

- b33bd73 — FOUND (feat(06-01): replace placeholder 25×16 pitch)
- 0242318 — FOUND (feat(06-01): bootstrap React client scaffold)
- 0aa87d6 — FOUND (feat(06-01): hexToPixel utility, Zustand store)
