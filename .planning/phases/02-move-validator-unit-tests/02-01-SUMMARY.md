---
phase: 02-move-validator-unit-tests
plan: '01'
subsystem: shared
tags: [types, hex-utilities, score-utils, tdd, foundation]
dependency_graph:
  requires: []
  provides:
    - GameState.movedPieceIds
    - GameState.paceUsedByPieceId
    - GameState.movementSlot
    - hexLine
    - getZoIDefenders
    - computeCombinedScore
    - computeLooseBall
  affects:
    - packages/shared/src/index.ts
    - packages/server (imports GameState type)
    - plans 02-02, 02-03, 02-04 (consume these foundations)
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN cycle per task)
    - Discriminated union result types (D-04)
    - Dice injection pattern (D-06)
    - Barrel pre-registration for parallel Wave 2 execution
key_files:
  created:
    - packages/shared/src/scoreUtils.ts
    - packages/shared/src/scoreUtils.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/hex.ts
    - packages/shared/src/hex.test.ts
    - packages/shared/src/index.ts
decisions:
  - 'hexLine uses simplified axial-lerp + cube_round (Pattern 2 variant from RESEARCH.md) — mathematically equivalent to full cube variant, fewer intermediate variables'
  - 'getZoIDefenders added alongside isUnderZoI (boolean form kept for backward compat); typed variant returns PlayerPiece[] for validator consequence data'
  - 'LOOSE_BALL_DIRECTIONS hard-coded with inline comments per D-07; assumption A2 (rulebook verification before Phase 4) documented in code'
  - 'index.ts Phase 2 barrel exports pre-registered in Wave 1 with explanatory comment so Wave 2 plans (02-02, 02-03, 02-04) never touch index.ts'
metrics:
  duration: '6m'
  completed: '2026-05-29T16:27:26Z'
  tasks_completed: 2
  files_modified: 6
---

# Phase 2 Plan 1: Foundation Types, Hex Utilities, and Score Utils Summary

**One-liner:** Extended GameState with D-08 movement-tracking fields, added hexLine (cube-lerp algorithm) and getZoIDefenders to hex.ts, created scoreUtils with DICE-04 penalty cap and DICE-05 loose-ball mapping, and pre-registered all six Phase 2 barrel exports in index.ts.

## Tasks Completed

| #         | Name                                                        | Commit  | Files                                                           |
| --------- | ----------------------------------------------------------- | ------- | --------------------------------------------------------------- |
| 1 (RED)   | Failing tests for hexLine and getZoIDefenders               | c1e768f | packages/shared/src/hex.test.ts                                 |
| 1 (GREEN) | Extend GameState + add hex utilities                        | 7c41444 | packages/shared/src/types.ts, packages/shared/src/hex.ts        |
| 2 (RED)   | Failing tests for computeCombinedScore and computeLooseBall | 8fc4ee3 | packages/shared/src/scoreUtils.test.ts                          |
| 2 (GREEN) | Create scoreUtils module + pre-register barrel exports      | 33456f1 | packages/shared/src/scoreUtils.ts, packages/shared/src/index.ts |

## New GameState Fields (D-08)

```typescript
/**
 * D-08: Movement-phase tracking fields.
 * Default values when outside MOVEMENT phase: `[]`, `{}`, `null`.
 */
movedPieceIds: readonly string[];
paceUsedByPieceId: Readonly<Record<string, number>>;
movementSlot: 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null;
```

All three fields are REQUIRED (not optional) to satisfy `exactOptionalPropertyTypes`. Existing `GameState` construction sites will need these fields populated (with `[]`, `{}`, `null` defaults outside MOVEMENT phase).

## hexLine and getZoIDefenders Signatures

```typescript
// packages/shared/src/hex.ts

/**
 * Returns the sequence of hex coordinates forming a straight line from `from` to `to`,
 * inclusive of both endpoints. Length = hexDistance(from, to) + 1.
 * Source: redblobgames.com/grids/hexagons/#line-drawing
 */
export function hexLine(from: HexCoord, to: HexCoord): HexCoord[];

/**
 * Returns the subset of `opponentPieces` at distance exactly 1 from `position`.
 * Typed variant of isUnderZoI that returns PlayerPiece[] for validator consequence data (D-03/D-04).
 */
export function getZoIDefenders(
  position: HexCoord,
  opponentPieces: readonly PlayerPiece[],
): PlayerPiece[];
```

## scoreUtils Signatures and LOOSE_BALL_DIRECTIONS Order

```typescript
// packages/shared/src/scoreUtils.ts

export function computeCombinedScore(
  attribute: number,
  diceValue: number,
  penalties: number[],
): number;
// DICE-04: clampedPenalty = Math.max(sum(penalties), -2)

export function computeLooseBall(
  from: HexCoord,
  direction: 1 | 2 | 3 | 4 | 5 | 6,
  distance: 1 | 2 | 3 | 4 | 5 | 6,
): HexCoord;
```

`LOOSE_BALL_DIRECTIONS` constant order (per Counter Attack rulebook v1.4.1 deflection ruler, assumption A2):

```
index 0 (direction 1): {q: 1,  r:  0}  // E
index 1 (direction 2): {q: 1,  r: -1}  // NE
index 2 (direction 3): {q: 0,  r: -1}  // NW
index 3 (direction 4): {q: -1, r:  0}  // W
index 4 (direction 5): {q: -1, r:  1}  // SW
index 5 (direction 6): {q: 0,  r:  1}  // SE
```

Matches `AXIAL_DIRECTIONS` order in `hex.ts`. Physical rulebook verification is required before Phase 4 live use.

## Test Counts

| Module                                    | New Tests           | Total Tests |
| ----------------------------------------- | ------------------- | ----------- |
| hex.test.ts (hexLine)                     | 5                   | —           |
| hex.test.ts (getZoIDefenders)             | 4                   | —           |
| hex.test.ts (all)                         | 9 new + 14 existing | 23          |
| scoreUtils.test.ts (computeCombinedScore) | 6                   | —           |
| scoreUtils.test.ts (computeLooseBall)     | 8                   | —           |
| scoreUtils.test.ts (all)                  | 14                  | 14          |
| **Total new tests**                       | **23**              | —           |

All tests passing as of plan completion.

## Final packages/shared/src/index.ts

```typescript
// Single barrel export for @counter-attack/shared (D-05).
// All consumers import from '@counter-attack/shared' — no sub-path imports.
export * from './types.js';
export * from './hex.js';
export * from './events.js';
export * from './pitch.js';
// Phase 2 barrel exports — pre-registered in Wave 1 (Plan 02-01) to permit parallel Wave 2 execution.
// Validator modules themselves are created by plans 02-02, 02-03, 02-04.
// TypeScript build will fail until those plans complete; this is expected and documented in 02-01-PLAN.md.
export * from './scoreUtils.js';
export * from './moveValidator.js';
export * from './passValidator.js';
export * from './shotValidator.js';
export * from './headingValidator.js';
export * from './snapshotValidator.js';
```

## Build Status

`pnpm --filter=@counter-attack/shared build` is **intentionally red** at the end of Plan 02-01 because `index.ts` references five validator modules that do not yet exist. This is the expected and documented state per the plan objective.

The build gate turns green incrementally as Wave 2 plans complete:

- Plan 02-02 creates `moveValidator.ts` (turns `moveValidator.js` export green)
- Plan 02-03 creates `passValidator.ts`, `shotValidator.ts` (turns those exports green)
- Plan 02-04 creates `headingValidator.ts`, `snapshotValidator.ts` (turns remaining exports green; full build green)

Test commands remain fully usable: `pnpm --filter=@counter-attack/shared test -- hex` and `pnpm --filter=@counter-attack/shared test -- scoreUtils` run against individual files without invoking `tsc`.

## Deviations from Plan

None — plan executed exactly as written.

- hexLine uses the simplified axial-lerp variant from RESEARCH.md Pattern 2 (not the full cube-coordinate version). Both are mathematically equivalent per the source documentation; the simplified form is slightly cleaner. The linter changed `let rs` to `const rs` (rs is only used in the round value, not reassigned), which is correct behavior.
- TDD gate compliance: each task followed RED (failing test commit) → GREEN (implementation commit) sequence.

## TDD Gate Compliance

| Task                               | RED commit | GREEN commit |
| ---------------------------------- | ---------- | ------------ |
| Task 1 (hexLine + getZoIDefenders) | c1e768f    | 7c41444      |
| Task 2 (scoreUtils + index.ts)     | 8fc4ee3    | 33456f1      |

Both gates satisfied.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. All code is pure in-process TypeScript in `packages/shared` with no I/O surface. T-02-01 (DICE-04 penalty cap) is mitigated by `computeCombinedScore` as the single enforcement point, verified by tests including `[-1,-1,-1]` → 7 and `[-2,-2]` → 7.

## Self-Check

Files created/modified:

- `packages/shared/src/types.ts` — contains `movementSlot`, `movedPieceIds`, `paceUsedByPieceId` ✓
- `packages/shared/src/hex.ts` — exports `hexLine`, `getZoIDefenders` ✓
- `packages/shared/src/hex.test.ts` — contains `describe('hexLine'` and `describe('getZoIDefenders'` ✓
- `packages/shared/src/scoreUtils.ts` — exports `computeCombinedScore`, `computeLooseBall`, contains `DICE-04` ✓
- `packages/shared/src/scoreUtils.test.ts` — contains `describe('computeCombinedScore'` and `describe('computeLooseBall'` ✓
- `packages/shared/src/index.ts` — contains all 6 Phase 2 export lines ✓

Commits verified: c1e768f, 7c41444, 8fc4ee3, 33456f1 ✓

## Self-Check: PASSED

All files found, all commits verified, all key strings confirmed present in output files.
