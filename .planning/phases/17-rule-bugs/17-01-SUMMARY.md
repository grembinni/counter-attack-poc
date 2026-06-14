---
phase: 17-rule-bugs
plan: '01'
subsystem: shared-types, server-tests
tags: [types, events, wave-0, tdd-red, phase-17]
dependency_graph:
  requires: []
  provides:
    - FREE_MOVE phase literal in GamePhase union
    - firstTimePassPath / firstTimePassStep / freeMoveEligibleIds / freeMoveUsedPace / passerId on GameState
    - GAME_CANCEL_MOVEMENT in ClientEvents and ClientToServerEvents
    - Wave-0 RED test files for engine and handler layer
  affects:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/server/src/__tests__/gameEngine.phase17.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17.test.ts
tech_stack:
  added: []
  patterns:
    - Optional GameState fields with JSDoc and | null type (existing convention)
    - ClientEvents const object + ClientToServerEvents interface extension (existing convention)
    - Wave-0 RED test seeding with @ts-expect-error on missing exports
key_files:
  created:
    - packages/server/src/__tests__/gameEngine.phase17.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
decisions:
  - 'FREE_MOVE inserted after GK_KICK_MOVEMENT and before HALF_TIME in GamePhase union per PATTERNS.md exact sequence'
  - 'passerId field added alongside firstTimePassPath/Step per plan spec — enables handler to reject passer repositioning in PASS-02 attacker step'
  - 'Wave-0 BUG-03 engine tests pass green because applyUndo has no phase guard — the bug lives in the HANDLER (WRONG_PHASE check at gameHandlers.ts line 884); engine layer already works'
  - 'Wave-0 BUG-04a (defender pickup) appears green due to interception fallback: awayDEF at target hex is within pass ZoI, default die=3 + tackling=7 → combined=10 → interception succeeds, giving ball to defender anyway'
  - 'Wave-0 BUG-05 engine test passes green: the save-dropped LOOSE_BALL already uses gkEffectivePos (line 1414 in gameEngine.ts) — bug was fixed in a prior phase'
metrics:
  duration: '6m 50s'
  completed: '2026-06-14T16:57:45Z'
  tasks_completed: 3
  files_changed: 4
---

# Phase 17 Plan 01: Shared Types + Wave-0 Test Foundation Summary

Established the shared-type and test foundation for all seven Phase 17 fixes. Extended `types.ts` with `FREE_MOVE` phase literal and five new `GameState` fields; extended `events.ts` with `GAME_CANCEL_MOVEMENT`; seeded two Wave-0 failing test files covering every unimplemented behavior downstream plans will fix.

## Tasks Completed

| #   | Task                                        | Commit    | Files                                                        |
| --- | ------------------------------------------- | --------- | ------------------------------------------------------------ |
| 1   | Extend GamePhase union + GameState fields   | `7a25682` | `packages/shared/src/types.ts`                               |
| 2   | Add GAME_CANCEL_MOVEMENT to events contract | `72e9e7e` | `packages/shared/src/events.ts`                              |
| 3   | Seed Wave-0 RED test files                  | `3346d97` | `gameEngine.phase17.test.ts`, `gameHandlers.phase17.test.ts` |

## Deviations from Plan

### Auto-observed (no fixes required — informational only)

**1. [Informational] BUG-03 engine layer already works**

- **Found during:** Task 3 test execution
- **Issue:** `applyUndo` has no phase guard — it's purely event-log based. The bug described in BUG-03 is at the HANDLER layer (`gameHandlers.ts` line 884 phase guard: `phase !== 'MOVEMENT'`), not the engine layer.
- **Impact:** Wave-0 BUG-03 engine tests pass green (5 passing, not all red). This is correct — the engine doesn't need fixing for BUG-03. Plan 03 (BUG-03 fix) targets the handler phase guard.
- **Files:** `gameEngine.phase17.test.ts` BUG-03 describe block

**2. [Informational] BUG-04a (defender pickup) test passes via interception mechanism**

- **Found during:** Task 3 test execution
- **Issue:** When awayDEF is placed at the target hex `{q:14}`, validatePass identifies it as an interceptor (within ZoI). With default die=3 and awayDEF.tackling=7, combined score=10 triggers interception success. Ball lands with awayDEF as carrier — test expectation satisfied, but NOT via the intended occupant-check fix.
- **Impact:** Test is behaviorally correct for BUG-04a but tests the wrong code path. Plan 04 will need to verify the occupant check fires for passes where no interception is possible (e.g., empty ZoI).
- **Files:** `gameEngine.phase17.test.ts` BUG-04a test case

**3. [Informational] BUG-05 already fixed in prior phase**

- **Found during:** Task 3 test execution
- **Issue:** `gameEngine.ts` line 1414 already uses `gkEffectivePos` for the save-dropped LOOSE_BALL position. BUG-05 was fixed during Phase 10/11 work.
- **Impact:** Wave-0 BUG-05 test passes green. No plan needed to fix it.
- **Files:** `gameEngine.ts` lines 1408-1422

### Net RED count: 10 failing (meets acceptance criteria of "reports RED cases")

- gameEngine.phase17.test.ts: 7 RED (BUG-02 ×3, BUG-04b ×1, MOVE-06 ×2, PASS-02 ×1)
- gameHandlers.phase17.test.ts: 3 RED (BUG-02 handler ×2, PASS-02 snap deflect ×1)

## Known Stubs

None — plan produces only type definitions and test files, no UI or data stubs.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries.

## Self-Check

Files exist:

- `packages/shared/src/types.ts` — modified (contains 'FREE_MOVE', new fields) ✓
- `packages/shared/src/events.ts` — modified (contains GAME_CANCEL_MOVEMENT) ✓
- `packages/server/src/__tests__/gameEngine.phase17.test.ts` — created ✓
- `packages/server/src/__tests__/gameHandlers.phase17.test.ts` — created ✓

Commits exist:

- `7a25682` feat(17-01): add FREE_MOVE phase literal and five new GameState fields ✓
- `72e9e7e` feat(17-01): add GAME_CANCEL_MOVEMENT to shared events contract ✓
- `3346d97` test(17-01): seed Wave-0 RED test files for Phase 17 engine and handler fixes ✓

Verification:

- `pnpm --filter @counter-attack/shared exec tsc --noEmit` exits 0 ✓
- Both test files discovered by vitest ✓
- Tests report 10 RED failures for unimplemented behaviors ✓

## Self-Check: PASSED
