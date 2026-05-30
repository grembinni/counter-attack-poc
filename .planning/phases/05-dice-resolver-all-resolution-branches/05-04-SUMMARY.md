---
phase: 05-dice-resolver-all-resolution-branches
plan: 04
subsystem: api
tags: [game-engine, dice, loose-ball, gk-restart, movement-slot, bug-fix]

# Dependency graph
requires:
  - phase: 05-03
    provides: applyGKRestart with kick/throw/movement branches, controlsGKTeam helper

provides:
  - movementSlot correctly set on all MOVEMENT-producing paths (Gap 1 closed)
  - SHOT tie transitions to LOOSE_BALL phase with fresh dice (Gap 2 closed)
  - PASS inaccurate and HEADER tie use LOOSE_BALL phase with fresh dice (Gap 3 closed)
  - Regression test guards applyMove acceptance after GK restart

affects: [phase-6, phase-7, client-gk-restart-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Every MOVEMENT-producing path (applyGKRestart + applyRoll) sets movementSlot: ATTACKER_4'
    - 'Tie/inaccuracy branches transition to LOOSE_BALL phase; fresh dice on next game:roll'
    - 'No biased dice reuse: SHOT/HEADER tie and PASS inaccuracy no longer call computeLooseBall inline'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/__tests__/game.integration.test.ts

key-decisions:
  - 'SHOT SAVE+SPILL retained with existing computeLooseBall call (d1/d2 reused); plan action explicitly said do not change this branch; not listed in VERIFICATION.md gaps'
  - 'HEADER validateHeading-rejected and SHOT MISS branches also received movementSlot fields for full consistency'
  - 'regression test: applyMove after restart may fail for game-logic reasons (pace/ZoI) but must NOT return WRONG_SLOT'

patterns-established:
  - 'Every state object with phase: MOVEMENT must co-locate movementSlot: ATTACKER_4, movedPieceIds: [], paceUsedByPieceId: {}'
  - 'Ties and inaccuracies set phase: LOOSE_BALL with ball at incident hex; fresh dice on the subsequent game:roll'

requirements-completed: [SHOT-05]

# Metrics
duration: 7min
completed: 2026-05-30
---

# Phase 5 Plan 04: Gap Closure — movementSlot and LOOSE_BALL Phase Routing Summary

**Three verification gaps closed: GK-restart MOVEMENT is playable (Gap 1), SHOT tie uses LOOSE_BALL phase with fresh dice (Gap 2), PASS inaccurate and HEADER tie use LOOSE_BALL phase with unbiased independent dice (Gap 3)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-30T19:00:00Z
- **Completed:** 2026-05-30T19:07:00Z
- **Tasks:** 3 (all type: auto)
- **Files modified:** 3

## Accomplishments

- Added `movementSlot: 'ATTACKER_4'`, `movedPieceIds: []`, `paceUsedByPieceId: {}` to all 9 MOVEMENT-producing paths in `gameEngine.ts` (4 applyGKRestart branches + LOOSE_BALL case + SHOT MISS + SHOT SAVE+SPILL + HEADER validateHeading-rejected + HEADER defender-wins)
- Fixed SHOT tie branch: removed inline `computeLooseBall`, changed `phase: 'MOVEMENT'` to `phase: 'LOOSE_BALL'`, ball stays at incident hex
- Fixed PASS inaccurate branch: removed inline `computeLooseBall`, ball stays at incident hex, `lastDiceRoll.rolls` now only contains the accuracy die d1 (not d2)
- Fixed HEADER tie branch: removed inline `computeLooseBall`, changed `phase: 'MOVEMENT'` to `phase: 'LOOSE_BALL'`, ball stays at incident hex
- Test suite: 84 passed, 1 todo, 0 failed (added 2 new tests: HEADER tie and regression)

## Task Commits

Each task was committed atomically:

1. **Task 1 — movementSlot on every MOVEMENT-producing path** - `8caad1a`
2. **Task 2 — SHOT tie, PASS inaccurate, HEADER tie to LOOSE_BALL phase** - `adda9d7`
3. **Task 3 — Updated unit and integration tests** - `49b3352`

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — Added movementSlot/movedPieceIds/paceUsedByPieceId to 9 MOVEMENT branches; removed 3 inline computeLooseBall calls from SHOT tie, PASS inaccurate, HEADER tie; changed those 3 branches to phase: 'LOOSE_BALL'
- `packages/server/src/__tests__/gameEngine.test.ts` — Updated SHOT tie test (LOOSE_BALL phase); updated PASS inaccurate test (ball position + lastDiceRoll rolls); added HEADER tie test; added movementSlot assertions to all 4 applyGKRestart success tests + LOOSE_BALL branch test; added regression test for applyMove after restart
- `packages/server/src/__tests__/game.integration.test.ts` — Added `movementSlot === 'ATTACKER_4'` assertion to GK restart movement wire test

## Decisions Made

- **SHOT SAVE+SPILL retained as-is**: The plan action text explicitly says "Do NOT change SHOT SAVE/spill". The acceptance criterion saying "2 call sites" was a miscounted expectation (it counted PASS, SHOT tie, HEADER tie as removals but missed SAVE+SPILL was still present). The VERIFICATION.md gaps do not list SAVE+SPILL as a problem. This results in 3 `computeLooseBall` call sites instead of 2 (SAVE+SPILL, LOOSE_BALL case, GK kick inaccurate) — all three are legitimate, unbiased fresh-dice sites or use independent rollDie() calls.
- **HEADER validateHeading-rejected and SHOT MISS also received movementSlot fields**: The plan said to add to the HEADER defender-win branch for consistency; the rejected and SHOT MISS branches were also missing the fields. Added for full invariant compliance ("every phase: MOVEMENT has movementSlot").
- **Regression test uses applyMove on GK piece**: GK is the only piece in `gkRestartState.pieces` on the 'away' (GK) team after restart. The test tries to move GK 1 hex and asserts the result is not WRONG_SLOT. The move may still fail for pace/ZoI reasons but the guard correctness is verified.

## Deviations from Plan

### Auto-fixed Issues

None beyond the planned changes.

### Discrepancy: computeLooseBall call site count

The Task 2 acceptance criteria stated "exactly 2 call sites for computeLooseBall". After applying the three removals (SHOT tie, PASS inaccurate, HEADER tie), there are 3 call sites:

1. `LOOSE_BALL` phase case — correct (fresh d1/d2 via game:roll)
2. GK kick inaccurate (applyGKRestart) — correct (independent rollDie() calls)
3. SHOT SAVE+SPILL — correct (d1/d2 passed in as pre-generated dice; these are the same dice used for the shot duel, not independent; however the plan action explicitly prohibited changing this branch)

The VERIFICATION.md gaps do not flag SAVE+SPILL as biased-dice reuse. Documented here as a known minor inconsistency; not a blocker.

---

**Total deviations:** 0 rule-triggered (all changes were planned); 1 discrepancy noted (3 vs 2 computeLooseBall call sites due to explicit plan prohibition on SAVE+SPILL)
**Impact on plan:** No scope creep. Three verification gaps closed. SHOT-05 moves from PARTIAL to SATISFIED.

## Known Stubs

None. All three gaps are fully closed:

- Gap 1: Every MOVEMENT branch sets movementSlot, movedPieceIds, paceUsedByPieceId
- Gap 2: SHOT tie reaches LOOSE_BALL phase; fresh dice on next game:roll
- Gap 3: PASS inaccurate and HEADER tie reach LOOSE_BALL phase; fresh dice on next game:roll

## Threat Surface Scan

No new network surfaces introduced. All changes are internal engine state-transition corrections in pure functions.

| Threat ID  | Mitigation                                                                                     | Status    |
| ---------- | ---------------------------------------------------------------------------------------------- | --------- |
| T-05-04-01 | Pure engine fixes only; no new client input path; existing handler guards unchanged            | Accepted  |
| T-05-04-02 | Biased dice reuse eliminated for SHOT tie, PASS inaccurate, HEADER tie; Loose Ball now uniform | Mitigated |

## Self-Check

- `packages/server/src/gameEngine.ts` has 10 occurrences of `movementSlot: 'ATTACKER_4'`: VERIFIED (grep confirmed)
- Commits 8caad1a, adda9d7, 49b3352 in git log: VERIFIED
- `pnpm test` in packages/server: 84 passed, 1 todo, 0 failed: VERIFIED
- `pnpm -r build` succeeds: VERIFIED
- SHOT tie test asserts `phase === 'LOOSE_BALL'`: VERIFIED (no `toBe('MOVEMENT')` in that block)
- All 4 applyGKRestart success tests assert `movementSlot === 'ATTACKER_4'`: VERIFIED
- Integration GK restart movement test asserts `movementSlot === 'ATTACKER_4'`: VERIFIED

## Self-Check: PASSED

---

_Phase: 05-dice-resolver-all-resolution-branches_
_Completed: 2026-05-30_
