---
phase: 10-remaining-action-flows-tech-debt
plan: 03
subsystem: game-engine
tags: [typescript, vitest, game-engine, shot-flow, header, tdd]

# Dependency graph
requires:
  - phase: 10-02
    provides: clean engine with no Math.random; D-29/D-30 behaviors established; SHOT/GK_DIVING GamePhase values

provides:
  - applyDeclareShot: PASS → GK_DIVING transition with shotTargetHex and gkDivePosition seed
  - applyGKDive: GK reposition guard (parallel-to-goal-line, ≤3 hexes, on-pitch)
  - applyDeclareHeaderTarget: sets headerTargetHex in HEADER phase after both teams confirm
  - HEAD-03 goal-line redirect in applyRoll HEADER branch (attacker win on goal-line → GK_DIVING)
  - computeShotPathDeflection: pure helper for two-band defender deflection (consumed by plan 04 handler)
  - ApplyDeclareShotResult, ApplyGKDiveResult, ApplyDeclareHeaderTargetResult types
  - DefenderDeflectionInput, ShotPathDeflectionResult types

affects:
  - 10-04 (new handlers GAME_GK_DIVE, GAME_HEADER_TARGET, GAME_SHOT rework consume these engine functions)
  - SHOT-01/SHOT-04 end-to-end flow (applyDeclareShot + applyGKDive + existing applyRoll SHOT branch)
  - HEAD-03 header-at-goal flow (applyDeclareHeaderTarget + HEADER branch redirect)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'applyDeclareShot: Engine Pure Function Result Pattern (discriminated union ok:false/ok:true)'
    - 'applyGKDive: constant-q parallel-to-goal-line guard prevents diagonal GK moves (Pitfall 1)'
    - 'HEAD-03 redirect: goal-line check (goalQ + r∈[10..16]) in HEADER attacker-win path'
    - 'computeShotPathDeflection: two-band deflection (Set A: die 5/6 or combined≥10; Set B: die 6 or combined≥10)'
    - 'TDD RED-GREEN: failing tests committed before implementation for both tasks'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.phase10.test.ts

key-decisions:
  - 'applyDeclareShot transitions directly to GK_DIVING (single hop per D-02); SHOT_DECLARED intermediate phase not used'
  - 'gkDivePosition seeded from GK piece position when entering GK_DIVING; cumulative distance checked against piece.position (not updated gkDivePosition)'
  - 'HEAD-03 goal-line check uses attackingTeam direction (goalQ=36 home / goalQ=0 away, r∈[10..16]); applied in both contested and uncontested attacker-win paths'
  - 'computeShotPathDeflection is pure (no dice generation) — handler generates dice and builds DefenderDeflectionInput list before calling'
  - 'headerTargetHex cleared to null in HEADER attacker-win returns after routing decision'

# Metrics
duration: 10min
completed: 2026-06-10
---

# Phase 10 Plan 03: New Engine Functions (applyDeclareShot, applyGKDive, applyDeclareHeaderTarget) Summary

**Three new pure engine functions implementing the shot-declaration FSM, GK-dive reposition guard, header target selection, and HEAD-03 goal-line redirect; defender path-deflection pure helper exported for plan 04 handler integration**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-10T11:25:13Z
- **Completed:** 2026-06-10T11:35:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1: applyDeclareShot + applyGKDive

- **applyDeclareShot(state, goalHex):** Transitions `PASS` → `GK_DIVING` after shooter declares a goal hex. Guards: WRONG_PHASE (phase ≠ PASS), INVALID_SEQUENCE (SHOT not in ELIGIBLE_NEXT_ACTIONS[lastActionType]), INVALID_TARGET (goalHex not a goal-line hex for attackingTeam: q=36/q=0, r∈[10..16]). Sets `shotTargetHex`, `gkDivePosition` (from GK piece position), `phase='GK_DIVING'`, `lastActionType='SHOT'`.

- **applyGKDive(state, to):** Repositions GK during `GK_DIVING` phase. Guards: WRONG_PHASE, NOT_PARALLEL (to.q ≠ gk.position.q — prevents diagonal moves, Pitfall 1), TOO_FAR (hexDistance from GK piece position to target > 3, SHOT-04), OFF_PITCH (isPitchHex check, T-10-06). Updates `gkDivePosition` on success.

### Task 2: applyDeclareHeaderTarget + HEAD-03 redirect + defender deflection helper

- **applyDeclareHeaderTarget(state, targetHex):** Sets `headerTargetHex` in HEADER phase after both teams confirm. Guards: WRONG_PHASE, NOT_CONFIRMED (headerConfirmed.home && .away must both be true), INVALID_TARGET (isPitchHex). Stays in HEADER; duel fires on subsequent ROLL event.

- **HEAD-03 redirect in applyRoll HEADER branch:** Both the contested and uncontested attacker-win paths now check `headerTargetHex`. If the target is a goal-line hex for the attacking team → transitions to `GK_DIVING` with `shotTargetHex` set (no outfield deflection per D-13). If not goal-line → ball delivered to `headerTargetHex` (or attacker's position as fallback).

- **computeShotPathDeflection pure helper:** Two-band defender deflection for regular shot resolution. Set A (in-path): deflects on die 5/6 or die+tackling≥10. Set B (within 1 hex of path): deflects on die 6 or die+tackling≥10. Returns first deflector position for LOOSE_BALL routing. Consumed by plan 04 handler (GAME_END_TURN in GK_DIVING phase auto-resolve). Exports `DefenderDeflectionInput`, `ShotPathDeflectionResult` types.

## Task Commits

1. **Task 1 RED (failing tests):** `0171e14` — import real applyDeclareShot/applyGKDive, un-skip describe blocks
2. **Task 1 GREEN:** `c05572e` — implement applyDeclareShot and applyGKDive in gameEngine.ts
3. **Task 2 RED (failing tests):** `bd7bfc2` — import applyDeclareHeaderTarget, un-skip HEAD-03 tests, add goal-line redirect tests
4. **Task 2 GREEN:** `56a1ed6` — implement applyDeclareHeaderTarget, HEAD-03 redirect, computeShotPathDeflection

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — Four new exported functions + three new result types added (368 net lines)
- `packages/server/src/__tests__/gameEngine.phase10.test.ts` — Real imports replacing stubs; describe blocks un-skipped; HEAD-03 redirect tests added

## Test Results

- **Phase 10 engine tests:** 25/25 pass (1 skipped — path-deflection end-to-end requires plan 04 handler integration)
- **Phase 8 engine tests:** 62/62 pass
- **Core engine tests:** 58/58 pass
- **TypeScript:** `tsc --noEmit` exits 0

## Decisions Made

- `applyDeclareShot` transitions directly to `GK_DIVING` (single hop) rather than `SHOT_DECLARED` + `GK_DIVING` — per D-02 "single transition to 'GK_DIVING' is acceptable so long as shotTargetHex is recorded"
- `gkDivePosition` seeded from GK's current piece position (not a separate "starting position" field) so cumulative distance check in `applyGKDive` uses `hexDistance(gk.position, to)` against the unchanged piece position
- `computeShotPathDeflection` takes pre-computed defender inputs rather than computing the hexLine internally — keeps the engine pure (handler builds defender sets from hexLine before calling)
- `headerTargetHex` cleared to null in HEADER attacker-win returns after routing to prevent stale state in next phase

## Deviations from Plan

**Auto-added: Uncontested attacker-win HEAD-03 routing**

- **Found during:** Task 2 implementation
- **Issue:** The plan specified modifying the contested attacker-win path; the uncontested path (HEAD-02) also needed the same goal-line routing for correctness
- **Fix:** Applied identical goal-line check logic to the uncontested attacker-win block
- **Rule:** Rule 2 (missing critical functionality — HEAD-03 rule applies to all attacker wins, not only contested duels)
- **Files modified:** packages/server/src/gameEngine.ts

## Known Stubs

None — all three functions are fully implemented pure engine functions. The `computeShotPathDeflection` helper is complete; its integration into the auto-resolve flow requires plan 04 handler work.

## Threat Flags

No new security surface beyond what the plan's threat model covers:

- T-10-05 (Tampering — header target for wrong goal): mitigated by goal-line direction check in HEAD-03 redirect (goalQ based on attackingTeam)
- T-10-06 (Tampering — off-pitch GK dive): mitigated by isPitchHex check in applyGKDive
- T-10-07 (Tampering — fabricated deflection outcome): mitigated by computeShotPathDeflection consuming injected dice only

## Self-Check: PASSED

- packages/server/src/gameEngine.ts: FOUND
- packages/server/src/**tests**/gameEngine.phase10.test.ts: FOUND
- .planning/phases/10-remaining-action-flows-tech-debt/10-03-SUMMARY.md: FOUND (this file)
- Commit 0171e14 (Task 1 RED): FOUND
- Commit c05572e (Task 1 GREEN): FOUND
- Commit bd7bfc2 (Task 2 RED): FOUND
- Commit 56a1ed6 (Task 2 GREEN): FOUND
