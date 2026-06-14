---
phase: 17-rule-bugs
plan: '02'
subsystem: server-engine
tags: [engine, bug-fix, tdd, wave-2, phase-17, applyRoll]
dependency_graph:
  requires:
    - 17-01 (FREE_MOVE phase literal, GameState fields, Wave-0 RED tests)
  provides:
    - BUG-01 isHeaderPass guard in applyRoll PASS case
    - BUG-04 occupant pickup with possession transfer in applyRoll PASS delivery
    - BUG-05 verified: gkEffectivePos already used (no engine change needed)
  affects:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.phase17.test.ts
tech_stack:
  added: []
  patterns:
    - Wrap interception loop with isHeaderPass guard (state.lastActionType check before loop)
    - Insert occupant lookup before teammate-only delivery (any-piece find on targetHex)
    - Possession-flip pattern (occupant.teamId !== carrier.teamId conditional)
key_files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.phase17.test.ts
decisions:
  - 'BUG-01: guard uses state.lastActionType === HEADER (not newLastActionType) — newLastActionType only
    holds pass types; HEADER is the original value before the resolved-type override'
  - 'BUG-04: occupant check wrapped in newLastActionType !== HIGH_PASS guard to prevent early return
    before the HIGH_PASS → HEADER routing branch below (regression fix)'
  - 'BUG-04a test passes via interception mechanism (awayDEF adjacent to penultimate path hex
    intercepts); new 1-hex pass test added to validate pure occupant-check path'
  - 'BUG-04b fixture corrected: awayDEF moved to {q:20,r:7} to remove interception noise'
  - 'BUG-05 already fixed in a prior phase (line 1450 uses gkEffectivePos); plan is verify-only'
metrics:
  duration: ~25min
  completed: '2026-06-14T17:13:00Z'
  tasks_completed: 3
  files_changed: 2
---

# Phase 17 Plan 02: BUG-01 / BUG-04 / BUG-05 Engine Fixes Summary

Three pure-engine corrections inside `applyRoll` in `gameEngine.ts`, turning Wave-0 RED tests GREEN. BUG-01 makes header passes unblockable server-side. BUG-04 adds occupant pickup with possession transfer on pass delivery. BUG-05 was already fixed in a prior phase — verified only.

## Tasks Completed

| #   | Task                                                          | Commit    | Files                                     |
| --- | ------------------------------------------------------------- | --------- | ----------------------------------------- |
| 1   | BUG-01: skip interception loop for header pass (RED test)     | `58654b5` | `gameEngine.phase17.test.ts`              |
| 1   | BUG-01: skip interception loop for header pass (GREEN fix)    | `3236623` | `gameEngine.ts`                           |
| 2   | BUG-04: occupant pickup on pass delivery (RED test + fixture) | `85c9018` | `gameEngine.phase17.test.ts`              |
| 2   | BUG-04: occupant pickup on pass delivery (GREEN fix)          | `705720c` | `gameEngine.ts`                           |
| 3   | BUG-05: GK loose ball position (verify only — already fixed)  | —         | `gameEngine.ts` line 1450 already correct |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BUG-01 test fixture needed ZoI-adjacent defender, not on-path defender**

- **Found during:** Task 1 RED test creation
- **Issue:** Initial fixture placed awayDEF at `{q:12,r:7}` — ON the pass path. `getZoIDefenders` requires distance=1 (exactly); distance=0 means the defender is on the path hex itself and is NOT a ZoI interceptor. The first BUG-01 test passed GREEN immediately, meaning no RED gate existed.
- **Fix:** Moved awayDEF to `{q:12,r:8}` — 1 hex off the pass line, making it a true ZoI interceptor with die=6 (auto-intercept). First test then went RED as expected.
- **Files modified:** `gameEngine.phase17.test.ts`
- **Commit:** `58654b5`

**2. [Rule 1 - Bug] BUG-04 isHeaderPass guard — `state.lastActionType` vs `newLastActionType`**

- **Found during:** Task 1 implementation (carry-over to Task 2 design)
- **Issue:** The PATTERNS.md showed `newLastActionType === 'HEADER'` as the guard, but `newLastActionType` is computed from a passTypeMap that excludes 'HEADER'. `newLastActionType` would always be 'STANDARD_PASS' when `state.lastActionType === 'HEADER'`, making the guard never true.
- **Fix:** Used `state.lastActionType === 'HEADER'` as the guard. Confirmed against D-01 in RESEARCH.md which explicitly states "skip the interception loop when `state.lastActionType === 'HEADER'`".
- **Files modified:** `gameEngine.ts`
- **Commit:** `3236623`

**3. [Rule 1 - Bug] BUG-04 occupant check caused HIGH_PASS regression**

- **Found during:** Task 2 GREEN verification — 2 new failures in `gameEngine.rule11.test.ts` and `gameEngine.test.ts`
- **Issue:** Initial occupant check ran unconditionally before the teammate lookup, but also before the `if (newLastActionType === 'HIGH_PASS')` branch. A player at the HIGH_PASS target would cause early return with phase='PASS' instead of routing to HEADER phase.
- **Fix:** Wrapped occupant check in `if (newLastActionType !== 'HIGH_PASS')` guard per D-10: "Applies to STANDARD_PASS, FIRST_TIME_PASS, LONG_BALL — not HIGH_PASS".
- **Files modified:** `gameEngine.ts`
- **Commit:** `705720c`

**4. [Rule 2 - Missing] BUG-04 passToTeammateState fixture had wrong interceptor position**

- **Found during:** Task 2 test investigation
- **Issue:** Wave-0 passToTeammateState had awayDEF at `{q:15,r:7}` — adjacent (distance=1) to target `{q:14,r:7}`. With die=3 and tackling=7, combined=10 → interception. Test was RED because interception gave ball to awayDEF (not homeMID teammate). This tested the WRONG code path.
- **Fix:** Moved awayDEF to `{q:20,r:7}` — far from pass path. With no interceptors, existing teammate lookup correctly finds homeMID → test GREEN.
- **Files modified:** `gameEngine.phase17.test.ts`
- **Commit:** `85c9018`

**5. [Informational] BUG-04 1-hex pass test added for pure occupant-check validation**

- **Found during:** Task 2 analysis — BUG-04a (defender at target) already passes via interception; BUG-04b (teammate) already passes via existing teammate lookup. No RED test for the actual occupant-check code path existed.
- **Action:** Added `shortPassToDefenderState` fixture: 1-hex pass where awayDEF is at target (distance=0 from target path hex → NOT in ZoI → no interception). Without the BUG-04 fix, `carrierId` would be null. Test RED before fix, GREEN after.
- **Files modified:** `gameEngine.phase17.test.ts`
- **Commit:** `85c9018`

**6. [Informational] BUG-05 pre-existing fix — verify-only task**

- **Found during:** Task 3 code review — line 1450 of `gameEngine.ts` already has `ball: { position: gkEffectivePos, carrierId: null }`. This was fixed in Phase 10/11 work.
- **Action:** Verified via test (BUG-05 passes GREEN) and source code inspection. No engine changes made. No commit for Task 3.

## BUG-01 / BUG-04 / BUG-05 Test Results

### BUG-01 (header pass unblockable)

- `Phase 17 BUG-01: header pass skips interception loop > PASS with lastActionType=HEADER delivers to target despite die=6 interceptor` ✓ GREEN
- `Phase 17 BUG-01: header pass skips interception loop > non-header PASS: interception still fires` ✓ GREEN (regression guard)

### BUG-04 (occupant pickup with possession transfer)

- `Phase 17 BUG-04: pass to occupied hex → ball pickup > pass landing on defender hex` ✓ GREEN (via interception)
- `Phase 17 BUG-04: pass to occupied hex → ball pickup > pass landing on teammate hex` ✓ GREEN (existing lookup)
- `Phase 17 BUG-04: pass to occupied hex → ball pickup > BUG-04 occupant check: 1-hex pass, defender at target outside ZoI` ✓ GREEN (new pure occupant-check test)

### BUG-05 (GK loose ball position)

- `Phase 17 BUG-05: save dropped → LOOSE_BALL at GK position > handling die >= handling stat → LOOSE_BALL; ball.position equals GK hex` ✓ GREEN (pre-existing fix)

### No regressions

9 failing tests remain — all out-of-scope for plan 17-02:

- BUG-02 (3 engine + 2 handler): `applyCancelMovement` — plan 17-03
- MOVE-06 (2): FREE_MOVE phase transition — plan 17-04
- PASS-02 (1 engine + 1 handler): FIRST_TIME_PASS attacker step — plan 17-05

## Known Stubs

None — plan produces only engine bug fixes, no UI or data stubs.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes.

## Self-Check

Files exist:

- `packages/server/src/gameEngine.ts` — modified (contains `isHeaderPass`, `if (!isHeaderPass)`, `occupant` lookup, `possessionChanges`) ✓
- `packages/server/src/__tests__/gameEngine.phase17.test.ts` — modified (BUG-01 + BUG-04 tests added, passToTeammateState fixture fixed) ✓

Commits exist:

- `58654b5` test(17-02): add BUG-01 RED test ✓
- `3236623` feat(17-02): BUG-01 — skip interception loop for header passes ✓
- `85c9018` test(17-02): add BUG-04 RED test — occupant check for 1-hex pass outside ZoI ✓
- `705720c` feat(17-02): BUG-04 — occupant pickup on pass delivery ✓

Verification:

- `pnpm --filter @counter-attack/server test` — 272 passing, 9 failing (all out-of-scope) ✓
- BUG-01 tests: 2/2 GREEN ✓
- BUG-04 tests: 3/3 GREEN ✓
- BUG-05 test: 1/1 GREEN ✓

## Self-Check: PASSED
