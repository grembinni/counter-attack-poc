---
phase: 10-remaining-action-flows-tech-debt
plan: 02
subsystem: game-engine
tags: [typescript, vitest, game-engine, bug-fix, tdd]

# Dependency graph
requires:
  - phase: 10-01
    provides: Wave 0 test scaffolds (red tests for D-22/D-17/D-23/D-29), stealAttemptedByIds/tackleAttemptedByIds GameState fields

provides:
  - D-16 (WR-01): 'HIGH_PASS' removed from passTypes Set in applySnapshot (dead code)
  - D-17 (WR-02): intermediate slot transitions (ATTACKER_4→DEFENDER_5, DEFENDER_5→ATTACKER_2) now set lastActionType='MOVEMENT_PHASE'
  - D-20 (IN-01): passTypes Set hoisted to module-level const SNAPSHOT_ELIGIBLE_PASS_TYPES
  - D-21: Math.random() replaced with deterministic injected-die tie-break in pickWinner
  - D-22: GOAL ActionEvent appended to eventLog in SHOT GOAL branch
  - D-23: HEADER tie (equal scores → LOOSE_BALL) now sets lastActionType='DEFLECTION' not 'HEADER'
  - D-26: LOOSE_BALL trajectory boundary clamp confirmed via isPitchHex (pre-existing, tested)
  - D-29: applyStartMovement resets stealAttemptedByIds/tackleAttemptedByIds; applyMove enforces one steal + one tackle per piece per movement phase
  - D-30: loose-ball pickup during MOVEMENT stays in MOVEMENT phase with remaining pace

affects:
  - 10-03 (new engine functions — clean engine with no Math.random; D-29/D-30 behaviors established)
  - 10-04 (new handlers — consistent lastActionType behavior for sequence validation)
  - Replay system (GOAL events now in eventLog for correct score reconstruction)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'D-29 enforcement: accumulate attempted-by-ids lists through all ok:true return paths in applyMove'
    - 'D-30 loose-ball pickup: stay in MOVEMENT with updated paceUsedByPieceId instead of transitioning to PASS'
    - 'D-21 tiebreaker: (die-1) % tied.length as deterministic index into same-score contestant list'
    - 'TDD RED-GREEN pattern: failing tests committed as proof targets before implementation'

key-files:
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.phase10.test.ts

key-decisions:
  - 'D-30 keeps MOVEMENT phase on pickup: attackingTeam and activeTeam update immediately; paceUsedByPieceId records each step; phase/movementSlot preserved so player continues moving'
  - 'D-29 enforced in applyMove (engine layer) not in handler layer: engine stays single source of truth; returns MOVE_INVALID with detail ALREADY_ATTEMPTED'
  - 'D-21 tie-break die index: atkCount + defCount positions in ...dice spread (two additional dice for atkTieDie + defTieDie); defaults to 1 when not provided (backward-compatible)'
  - 'SNAPSHOT_ELIGIBLE_PASS_TYPES omits HIGH_PASS: HIGH_PASS→HEADER is the FSM path; state.phase=PASS with lastActionType=HIGH_PASS is unreachable'

# Metrics
duration: 45min
completed: 2026-06-10
---

# Phase 10 Plan 02: Engine Bug Fixes D-16/D-17/D-20/D-21/D-22/D-23/D-26/D-29/D-30 Summary

**9 code-review debt fixes and gameplay bugs applied to gameEngine.ts; Math.random eliminated; GOAL event logged; intermediate-slot lastActionType reset; one-steal/one-tackle per piece enforced; loose-ball pickup preserves movement pace**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-10T05:30:00Z
- **Completed:** 2026-06-10T06:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1: D-16/D-17/D-20/D-21/D-22/D-23 code-review fixes

- **D-16 (WR-01):** Removed dead `'HIGH_PASS'` entry from passTypes Set in applySnapshot (HIGH_PASS always transitions to HEADER, never reaching `phase=PASS`)
- **D-20 (IN-01):** Hoisted passTypes Set to module-level `SNAPSHOT_ELIGIBLE_PASS_TYPES` const — avoids per-call Set reallocation
- **D-17 (WR-02):** Added `lastActionType: 'MOVEMENT_PHASE'` to the intermediate slot return in applyEndTurn (ATTACKER_4→DEFENDER_5 and DEFENDER_5→ATTACKER_2 paths); previously these paths spread `state.lastActionType` unchanged, leaving it as `null` or whatever the prior action was
- **D-22:** Appended `{ type: 'GOAL', scoringTeam, timestamp }` ActionEvent to eventLog in the SHOT GOAL branch; replay engine can now reconstruct the score from events
- **D-21:** Replaced `Math.floor(Math.random() * tied.length)` in `pickWinner` with `(tieBreakerDie - 1) % tied.length` using a pre-injected die; engine is now fully deterministic (zero `Math.random()` calls)
- **D-23:** Changed HEADER tie (equal scores) LOOSE_BALL return from `lastActionType: 'HEADER'` to `lastActionType: 'DEFLECTION'`; aligns with ELIGIBLE_NEXT_ACTIONS expectations after deflection

Also required rebuilding the `@counter-attack/shared` package — the compiled dist had `GamePhase = 'ACTION'` from a prior (reverted) rename commit while the source still had `'PASS'`; `pnpm --filter @counter-attack/shared build` fixed the mismatch.

### Task 2: D-26/D-29/D-30 gameplay bug fixes (TDD)

RED phase committed first, then GREEN implementation:

- **D-26 (boundary clamp):** Confirmed pre-existing via `isPitchHex` check in LOOSE_BALL trajectory (line 1445); added test coverage to prove it never produces off-board positions
- **D-29 (one steal + one tackle):**
  - `applyStartMovement` now resets `stealAttemptedByIds: []` and `tackleAttemptedByIds: []`
  - `applyMove` checks before any STEAL_ATTEMPT or TACKLE_ATTEMPT; if pieceId already in the respective list → returns `{ ok: false, reason: 'MOVE_INVALID', detail: 'ALREADY_ATTEMPTED' }`
  - All `ok: true` return paths now propagate updated `stealAttemptedByIds`/`tackleAttemptedByIds`
- **D-30 (pickup continues movement):**
  - Previous behavior: loose-ball pickup transitioned to `phase: 'PASS'` with all pace/slot fields reset
  - Fixed: pickup stays in `phase: 'MOVEMENT'` with `movementSlot`, `paceUsedByPieceId` (updated for the step), `movedPieceIds` (computed normally) preserved; `attackingTeam`/`activeTeam` update to the picking-up piece's team immediately

## Task Commits

1. **Task 1 (D-16/D-17/D-20/D-21/D-22/D-23 fixes):** `0600ab4`
2. **Task 2 RED tests (D-26/D-29/D-30):** `c72d01f`
3. **Task 2 GREEN implementation:** `42545df`

## Test Results

- **Phase 10 engine tests:** 13/13 pass (plus 10 describe.skip blocks for plans 03/04)
- **Phase 8 engine tests:** 62/62 pass
- **Core engine tests:** 58/58 pass
- **Integration tests (pre-existing D-25 failures):** 2 failures remain — D-09/D-10 integration tests use placeholder hex positions (documented as D-25 and tracked for plan 05)

## Deviations from Plan

**Auto-fix: Rebuilt shared package dist**

- **Found during:** Task 1 verification
- **Issue:** `packages/shared/dist/types.d.ts` had `GamePhase = '...ACTION...'` from a previously-reverted rename commit (339ccf9 renamed PASS→ACTION, 78d714b reverted it, but dist was not rebuilt). TypeScript used the stale dist → 23 type errors.
- **Fix:** `pnpm --filter @counter-attack/shared build` rebuilt the types; 0 type errors after
- **Files modified:** `packages/shared/dist/` (generated files, not tracked)
- **Rule:** Rule 3 (blocking issue — build was broken)

## Known Stubs

None — this plan contains only bug fixes and gameplay logic corrections, no UI components or placeholder data.

## Threat Flags

No new security surface introduced. All threat mitigations in the plan's `<threat_model>` (T-10-02, T-10-03, T-10-04) were addressed:

- T-10-02 (Tampering — HEADER tie-break randomness): eliminated via deterministic injected die (D-21)
- T-10-03 (Tampering — Loose Ball off-board): confirmed by test; isPitchHex boundary clamp already present (D-26)
- T-10-04 (DoS — repeated steal/tackle): enforced via stealAttemptedByIds/tackleAttemptedByIds (D-29)

## Self-Check: PASSED

- packages/server/src/gameEngine.ts: FOUND
- packages/server/src/**tests**/gameEngine.phase10.test.ts: FOUND
- .planning/phases/10-remaining-action-flows-tech-debt/10-02-SUMMARY.md: FOUND
- Commit 0600ab4 (Task 1): FOUND
- Commit c72d01f (Task 2 RED): FOUND
- Commit 42545df (Task 2 GREEN): FOUND
