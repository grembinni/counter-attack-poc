---
phase: 23-formation-system
plan: '01'
subsystem: shared-types
tags: [formations, shared-types, socket-events, data-registry, tdd]
dependency_graph:
  requires: []
  provides:
    - FormationId
    - SlotRole
    - FormationSlot
    - FORMATIONS
    - GameState.selectedFormation
    - ClientEvents.UNIFORM_CONFIRM (extended with formationId)
    - ServerEvents.UNIFORM_HOME_CONFIRMED (extended with formationId)
    - ServerEvents.BOTH_FORMATIONS_CONFIRMED
  affects:
    - packages/shared/src/formations.ts
    - packages/shared/src/index.ts
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/server/src/__tests__/formations.test.ts
tech_stack:
  added: []
  patterns:
    - satisfies Record<FormationId,...> + readonly FormationSlot[] for mutation-safe registry
    - Barrel re-export pattern (uniformStyles.js analog)
    - Vitest describe/it integrity guards for data-registry correctness
key_files:
  created:
    - packages/shared/src/formations.ts
    - packages/server/src/__tests__/formations.test.ts
  modified:
    - packages/shared/src/index.ts
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
decisions:
  - 'selectedFormation added as required field on GameState; buildInitialGameState update deferred to Plan 02 (D-15)'
  - "UNIFORM_HOME_CONFIRMED extended with formationId rather than adding a separate event (Claude's Discretion)"
  - 'Shared package built (pnpm build) before running server tests — dist/ needed for Vite resolver'
metrics:
  duration: '9m'
  completed: '2026-07-05'
  tasks_completed: 3
  files_changed: 5
---

# Phase 23 Plan 01: Shared Formation Foundation Summary

**One-liner:** FORMATIONS data registry (4 formations × 11 slots) with FormationId/SlotRole/FormationSlot types, GameState.selectedFormation field, extended UNIFORM_CONFIRM/UNIFORM_HOME_CONFIRMED socket payloads, new BOTH_FORMATIONS_CONFIRMED server event, and 6 passing data-integrity tests.

## Tasks Completed

| Task | Name                                                 | Commit  | Files                                                           |
| ---- | ---------------------------------------------------- | ------- | --------------------------------------------------------------- |
| 1    | Create formations.ts data-registry and barrel export | a9e3db9 | packages/shared/src/formations.ts, packages/shared/src/index.ts |
| 2    | Extend GameState and Socket.io event contracts       | 8c7a353 | packages/shared/src/types.ts, packages/shared/src/events.ts     |
| 3    | Data-integrity tests for FORMATIONS table            | 0913284 | packages/server/src/**tests**/formations.test.ts                |

## What Was Built

### formations.ts (new file)

`packages/shared/src/formations.ts` exports:

- `FormationId` union type: `'4-4-2' | '5-3-2' | '4-3-3' | '3-4-3'`
- `SlotRole` union: 7 roles from `'GK'` to `'FWD-wing'`
- `FormationSlot` interface: `{ slotId, slotRole, position: HexCoord, jerseyNumber }`
- `FORMATIONS` const: `Record<FormationId, { slots: readonly FormationSlot[]; description: string }>` — 44 hand-authored slots

Mutation is prevented via `satisfies Record<FormationId,...>` + `as readonly FormationSlot[]` (T-23-01 mitigation). GK is slot index 0 in every formation at `{q:2, r:13}` with `jerseyNumber: 1`. Jersey numbers 1-11 appear exactly once per formation. All positions use valid columns `{2,6,8,10,14}` with r-values in `[5,21]`.

### types.ts (extended)

- Added `import type { FormationId } from './formations.js'`
- Added `selectedFormation: { home: FormationId; away: FormationId }` to `GameState` immediately after `selectedUniformStyles` (D-11)

### events.ts (extended)

- Added `import type { FormationId } from './formations.js'`
- Added `BOTH_FORMATIONS_CONFIRMED: 'formation:both-confirmed'` to `ServerEvents` const (D-12)
- Extended `ClientToServerEvents[UNIFORM_CONFIRM]` to `(teamId, uniformStyle, formationId)` (D-09)
- Extended `ServerToClientEvents[UNIFORM_HOME_CONFIRMED]` to `(teamId, uniformStyle, formationId)` (D-09)
- Added `ServerToClientEvents[BOTH_FORMATIONS_CONFIRMED]: (homeFormation, awayFormation) => void` (D-12)

### formations.test.ts (new file)

6 data-integrity tests all passing:

1. Exactly 4 formation keys present
2. Every formation has 11 slots
3. Jersey numbers 1-11 unique per formation
4. slot[0] is GK at `{q:2,r:13}` with jerseyNumber 1
5. Exactly one #9 jersey slot per formation (kick-off striker anchor)
6. All positions within valid q-columns and r-row range

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Deviation: Build step needed before server tests

**Found during:** Task 3
**Issue:** `pnpm --filter @counter-attack/server test formations` failed because the shared package `dist/` directory didn't exist, causing Vite's package resolver to fail on `@counter-attack/shared`. Even the pre-existing `gameEngine.teamselect.test.ts` fails for the same reason (pre-existing infrastructure gap).
**Fix:** Ran `pnpm build` in `packages/shared` to generate `dist/` before running server tests. This is a standard step documented in the research runtime state inventory.
**Files modified:** None (build output in dist/, which is gitignored)

## Known Stubs

None — FORMATIONS table is fully populated with all 44 slots. No placeholder data.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. The `selectedFormation` field in `GameState` is non-sensitive public game info (T-23-02: accepted). FORMATIONS mutation prevention via `readonly` + `satisfies` is in place (T-23-01: mitigated).

## Verification Results

- `cd packages/shared && npx tsc --noEmit`: PASS (0 errors)
- `pnpm --filter @counter-attack/server test formations`: PASS (6/6 tests)
- Manual grep: `FORMATIONS` in formations.ts, `selectedFormation` in types.ts, `BOTH_FORMATIONS_CONFIRMED` in events.ts: all present

## Self-Check: PASSED

Files verified:

- packages/shared/src/formations.ts: FOUND
- packages/shared/src/index.ts: FOUND (contains `export * from './formations.js'`)
- packages/shared/src/types.ts: FOUND (contains `selectedFormation`)
- packages/shared/src/events.ts: FOUND (contains `BOTH_FORMATIONS_CONFIRMED`)
- packages/server/src/**tests**/formations.test.ts: FOUND

Commits verified:

- a9e3db9: Task 1 — formations.ts + barrel export
- 8c7a353: Task 2 — types.ts + events.ts extensions
- 0913284: Task 3 — formations.test.ts (6 passing)
