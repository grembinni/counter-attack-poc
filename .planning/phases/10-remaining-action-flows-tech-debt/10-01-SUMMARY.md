---
phase: 10-remaining-action-flows-tech-debt
plan: 01
subsystem: testing
tags: [typescript, vitest, socket.io, shared-types, game-engine]

# Dependency graph
requires:
  - phase: 08.2-passing-cleanup-inserted
    provides: ACTION phase rename, GameState optional fields, headerContestants/headerConfirmed

provides:
  - GamePhase union with SHOT_DECLARED, GK_DIVING, SNAP_DEFLECT (already added in prior commit 339ccf9)
  - GameState fields headerTargetHex, shotTargetHex, gkDivePosition, stealAttemptedByIds, tackleAttemptedByIds (prior commit)
  - ClientEvents GAME_GK_DIVE, GAME_HEADER_TARGET with typed HexCoord signatures (prior commit 2573305)
  - Wave 0 test scaffolds: gameEngine.phase10.test.ts, gameHandlers.phase10.test.ts (c282395)

affects:
  - 10-02 (engine bug fixes — tests D-22, D-17, D-23, D-29 must go green)
  - 10-03 (new engine functions — SNAP_DEFLECT, HEAD-03, applyDeclareShot tests must go green)
  - 10-04 (new handlers — GAME_GK_DIVE, GAME_HEADER_TARGET, SNAP_DEFLECT handler tests must go green)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Wave 0 scaffold pattern: type stubs for not-yet-implemented functions allow test collection without crashing'
    - 'describe.skip for not-yet-implemented engine functions; real failing tests for engine bugs that exist now'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.phase10.test.ts
    - packages/server/src/__tests__/gameHandlers.phase10.test.ts
  modified:
    - packages/shared/src/types.ts (prior commit — SHOT_DECLARED, GK_DIVING, SNAP_DEFLECT, 5 new fields)
    - packages/shared/src/events.ts (prior commit — GAME_GK_DIVE, GAME_HEADER_TARGET)

key-decisions:
  - 'Wave 0 scaffolds use undefined stubs (not jest.fn()) for missing engine functions — avoids import errors at collection time'
  - 'Red tests for existing engine bugs (D-22, D-17, D-23, D-29) are left failing, not skipped — they are proof targets for plan 02'
  - 'describe.skip used only for functions not yet imported (applyDeclareShot, applyGKDive, applyDeclareHeaderTarget)'
  - 'Handler tests in gameHandlers.phase10.test.ts reuse real Socket.io server (port 0) matching existing test harness'

patterns-established:
  - 'Phase 10 fixture pattern: named piece objects (homeFwd, awayGk, homeMid, awayDef) with full attribute sets'
  - 'seedXxxPhase helpers patch room.gameState directly to avoid full game flow setup'

requirements-completed: [SHOT-01, SHOT-04, SNAP-02, HEAD-03]

# Metrics
duration: 15min
completed: 2026-06-09
---

# Phase 10 Plan 01: Shared Foundation + Wave 0 Test Scaffolds Summary

**GamePhase union extended with SHOT_DECLARED/GK_DIVING/SNAP_DEFLECT, five new GameState fields, two new typed events (GAME_GK_DIVE, GAME_HEADER_TARGET), and Wave 0 test scaffolds encoding all Phase 10 engine and handler proof targets**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-09T20:00:00Z
- **Completed:** 2026-06-09T20:15:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Verified shared package types.ts and events.ts were correctly extended in prior commits (339ccf9, 2573305) — all 3 new GamePhase values, 5 new GameState fields, and 2 new typed events present and type-checking clean
- Created gameEngine.phase10.test.ts with 8 describe blocks covering D-22 GOAL eventLog, D-17 lastActionType reset, D-21 pickWinner determinism, D-23 HEADER LOOSE_BALL lastActionType, D-29 steal/tackle tracking, SNAP_DEFLECT, HEAD-03, and applyGKDive guards
- Created gameHandlers.phase10.test.ts with 5 describe blocks covering D-15 CR-01 replay stale-ref, D-24 snap-back, GAME_GK_DIVE guards, SNAP_DEFLECT GAME_MOVE guard, and GAME_HEADER_TARGET guards

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 3 new GamePhase values and 5 new GameState fields** - `339ccf9` (feat — prior session)
2. **Task 2: Add GAME_GK_DIVE and GAME_HEADER_TARGET events** - `2573305` (feat — prior session)
3. **Task 3: Create Wave 0 phase10 test scaffolds (engine + handler)** - `c282395` (test)

## Files Created/Modified

- `packages/shared/src/types.ts` - GamePhase union with SHOT_DECLARED/GK_DIVING/SNAP_DEFLECT; GameState fields headerTargetHex, shotTargetHex, gkDivePosition, stealAttemptedByIds, tackleAttemptedByIds
- `packages/shared/src/events.ts` - ClientEvents.GAME_GK_DIVE ('game:gk-dive'), ClientEvents.GAME_HEADER_TARGET ('game:header-target') with typed HexCoord signatures in ClientToServerEvents
- `packages/server/src/__tests__/gameEngine.phase10.test.ts` - Wave 0 engine test scaffold: 5 red tests (existing bugs), 3 describe.skip blocks (new functions)
- `packages/server/src/__tests__/gameHandlers.phase10.test.ts` - Wave 0 handler test scaffold: 2 runnable tests (D-15/D-24), 3 describe.skip blocks (new handlers)

## Decisions Made

- Reused GAME_SHOT event for shot declaration (D-02 / CONTEXT.md Claude's discretion) — no GAME_DECLARE_SHOT added
- Wave 0 stubs use `undefined as unknown as StubFn` pattern rather than jest.fn() — type-safe and avoids import crashes on collection
- Handler test file uses real Socket.io server on port 0, matching the existing gameHandlers.test.ts pattern exactly

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were already committed in prior sessions; Task 3 was the only remaining work.

## Issues Encountered

None. The shared package type-checks cleanly (exit 0). Both test files collected by vitest. 5 intentional red scaffold tests (engine bugs) will be fixed in plan 02; 3 describe.skip blocks will be turned green in plans 03/04.

## Known Stubs

None — this plan creates type contracts and test scaffolds, not UI components with data placeholders.

## Threat Flags

No new security surface beyond what the PLAN.md threat model covers (T-10-01: HexCoord payload validation for GAME_GK_DIVE and GAME_HEADER_TARGET — runtime validation deferred to plan 04 handler implementation).

## Next Phase Readiness

Plan 02 (engine bug fixes: D-22, D-17, D-21, D-23, D-29, D-15, D-16, D-18, D-20, D-24, D-25) can begin immediately. The Wave 0 red tests in gameEngine.phase10.test.ts are the proof targets.

---

_Phase: 10-remaining-action-flows-tech-debt_
_Completed: 2026-06-09_
