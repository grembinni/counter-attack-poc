---
phase: 08-match-lifecycle-post-game-replay
plan: '01'
subsystem: shared
tags: [types, events, action-sequence, eligibility-table, tdd]
dependency_graph:
  requires: []
  provides:
    - LastActionType type
    - ELIGIBLE_NEXT_ACTIONS constant
    - NextActionType type
    - KICK_OFF_SETUP GamePhase value
    - GameState.addedTime / lastActionType / kickOffTeam / kickOffActive fields
    - GameState.replayIndex / replayTotal optional fields
    - ActionEvent Phase 8 subtypes (HIGH_PASS, LONG_BALL, STANDARD_PASS, FIRST_TIME_PASS, SHOT_ATTEMPT, SNAPSHOT, HALF_TIME, FULL_TIME)
    - ClientEvents.GAME_READY / GAME_KICK_OFF_MOVE / GAME_HALF_TIME_START
  affects:
    - packages/server (imports GameState, ELIGIBLE_NEXT_ACTIONS)
    - packages/client (imports GameState, ClientEvents, NextActionType)
tech_stack:
  added: []
  patterns:
    - Functional-module style (no class, no default export) for actionSequence.ts
    - ReadonlySet<NextActionType> matching PITCH_REGIONS pattern
    - Discriminated union exhaustiveness via Record<LastActionType, ReadonlySet<NextActionType>>
key_files:
  created:
    - packages/shared/src/actionSequence.ts
    - packages/shared/src/actionSequence.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/shared/src/index.ts
decisions:
  - 'ELIGIBLE_NEXT_ACTIONS uses ReadonlySet<NextActionType> (matches PITCH_REGIONS pattern)'
  - 'SNAPSHOT and SHOT rows are empty sets — their outcomes always reset the sequence'
  - 'kickOffActive flag in GameState signals first-pass-from-centre enforcement (D-27/MATCH-03)'
metrics:
  duration_seconds: 496
  completed: '2026-06-04'
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 8 Plan 01: Shared Package Phase 8 Primitives Summary

**One-liner:** Action sequence eligibility table (D-07/D-08), LastActionType/NextActionType types, KICK_OFF_SETUP phase, and new GameState fields added to the shared package — the complete contract layer for Phase 8.

## Tasks Completed

| Task | Name                                                     | Commit                         | Files                                                                             |
| ---- | -------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| 1    | actionSequence.ts module + eligibility table tests (TDD) | 896b4cd (RED), 6be6b46 (GREEN) | packages/shared/src/actionSequence.ts, packages/shared/src/actionSequence.test.ts |
| 2    | types.ts extensions                                      | 4f2302e                        | packages/shared/src/types.ts                                                      |
| 3    | events.ts new client events + index.ts barrel export     | 6fd7977                        | packages/shared/src/events.ts, packages/shared/src/index.ts                       |

## What Was Built

**actionSequence.ts** — new module exporting:

- `NextActionType` union (8 action types)
- `ELIGIBLE_NEXT_ACTIONS: Record<LastActionType, ReadonlySet<NextActionType>>` — exhaustive D-08 eligibility table; TypeScript enforces all 10 keys are present

**actionSequence.test.ts** — 71 Vitest tests covering:

- All 10 LastActionType rows asserting positive and negative membership
- Exact set sizes (HIGH_PASS=1, SNAPSHOT=0, SHOT=0, MOVEMENT_PHASE=6, etc.)
- HIGH_PASS has HEADER as its only valid next action (D-08 key rule)
- SUCCESSFUL_TACKLE does not allow SHOT

**types.ts extensions:**

- `LastActionType` union (10 members: MOVEMENT_PHASE, SUCCESSFUL_TACKLE, STANDARD_PASS, FIRST_TIME_PASS, HIGH_PASS, LONG_BALL, HEADER, DEFLECTION, SNAPSHOT, SHOT)
- `KICK_OFF_SETUP` added to `GamePhase` union
- 8 new `ActionEventType` literals added
- 8 new `ActionEvent` discriminated union members with typed payloads
- `GameState` extended with: `addedTime`, `lastActionType`, `kickOffTeam`, `kickOffActive`, optional `replayIndex`, optional `replayTotal`

**events.ts + index.ts:**

- 3 new `ClientEvents` entries: `GAME_READY`, `GAME_KICK_OFF_MOVE`, `GAME_HALF_TIME_START`
- 3 typed `ClientToServerEvents` signatures for the new events
- `export * from './actionSequence.js'` added to barrel

## TDD Gate Compliance

- RED gate: test commit `896b4cd` — 71 tests written before implementation existed (import error confirmed failure)
- GREEN gate: implementation commit `6be6b46` — all 71 tests pass
- REFACTOR gate: not required (code was clean from first pass)

## Verification Evidence

- `pnpm --filter @counter-attack/shared build` exits 0 — dist emitted with actionSequence.{js,d.ts}
- `pnpm --filter @counter-attack/shared test` — 210 tests pass across 11 test files
- `tsc --noEmit` on shared package exits 0
- All 5 acceptance criteria for Task 1 confirmed via test assertions
- All acceptance criteria for Task 2 confirmed by grep and tsc
- All acceptance criteria for Task 3 confirmed by grep and build

## Deviations from Plan

None — plan executed exactly as written. The `pnpm exec vitest run` invocation in the plan did not work in the worktree context (vitest not in PATH without node_modules/.bin); used `./node_modules/.bin/vitest run` instead. Same binary, no functional difference.

## Known Stubs

None. All exported types and constants are fully defined with no placeholder values.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced at trust boundaries. All files are pure TypeScript type definitions and data constants — no runtime I/O. Consistent with T-08-01 / T-08-02 in the plan's threat model (both accepted as documented).

## Self-Check: PASSED

| Item                                       | Status |
| ------------------------------------------ | ------ |
| packages/shared/src/actionSequence.ts      | FOUND  |
| packages/shared/src/actionSequence.test.ts | FOUND  |
| packages/shared/src/types.ts               | FOUND  |
| packages/shared/src/events.ts              | FOUND  |
| packages/shared/src/index.ts               | FOUND  |
| Commit 896b4cd (RED: test)                 | FOUND  |
| Commit 6be6b46 (GREEN: impl)               | FOUND  |
| Commit 4f2302e (types.ts)                  | FOUND  |
| Commit 6fd7977 (events+index)              | FOUND  |
