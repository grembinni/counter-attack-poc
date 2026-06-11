---
phase: 11-rule-correctness
plan: 02
subsystem: api
tags: [game-engine, shot-path, loose-ball, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 11-01
    provides: gameEngine.rule11.test.ts test file (plan 11-02 appends RULE-03 tests to it)
provides:
  - lastShotPath: null on SHOT LOOSE_BALL tie branch (gameEngine.ts ~line 1289)
  - lastShotPath: null on SHOT save-dropped LOOSE_BALL branch (gameEngine.ts ~line 1341)
  - lastShotPath: null on LOOSE_BALL scatter -> PASS return (gameEngine.ts ~line 1746)
  - 4 new regression tests in gameEngine.rule11.test.ts asserting RULE-03 fix
affects: [11-03, client-hex-grid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'RULE-03 targeted null: lastShotPath: null added to three specific branches only — no defensive clear in applyStartMovement (D-07)'
    - 'Dead variable removal: shotPath variable in SHOT case removed after all LOOSE_BALL branch usages replaced with explicit null'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.rule11.test.ts

key-decisions:
  - 'D-07 respected: no lastShotPath clearing added to applyStartMovement — fix is targeted to the three confirmed-bug branches only'
  - 'Dead shotPath variable removed from SHOT case after all LOOSE_BALL return objects set null explicitly'
  - 'TDD gate: RED commit (c35077a) precedes GREEN commit (e8ff5dc) — gate sequence validated in git log'

patterns-established:
  - 'Surgical lastShotPath null: each LOOSE_BALL resolution branch that enters a subsequent phase must explicitly set lastShotPath: null rather than relying on spread inheritance'

requirements-completed: [RULE-03]

# Metrics
duration: 20min
completed: 2026-06-11
---

# Phase 11 Plan 02: RULE-03 Shot-Path Clear Fix Summary

**Three surgical `lastShotPath: null` additions to gameEngine.ts stop stale shot-path hexes from persisting into PASS/MOVEMENT after a shot resolves to a Loose Ball that scatters**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-11T20:55:00Z
- **Completed:** 2026-06-11T21:02:53Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (1 engine, 1 test)

## Accomplishments

- RULE-03 primary fix: `lastShotPath: null` added to `applyRoll` LOOSE_BALL scatter → PASS return object (the root cause — stale path was inherited via `...state` spread)
- RULE-03 secondary fixes: `lastShotPath: null` added to SHOT LOOSE_BALL (tie) branch and SHOT save-dropped → LOOSE_BALL branch (both previously set `lastShotPath: shotPath`)
- Dead code cleanup: removed the now-unused `shotPath` variable from the SHOT case (all LOOSE_BALL resolution branches now set `null` explicitly)
- 4 new regression tests appended to `gameEngine.rule11.test.ts`: 3 RED → GREEN tests for the bug branches, 1 regression guard for confirmed-correct branches
- All 251 server tests pass; TypeScript clean; `applyStartMovement` untouched (D-07)

## Task Commits

1. **test(11-02): add failing RULE-03 regression tests** - `c35077a` (RED phase)
2. **feat(11-02): fix RULE-03 stale lastShotPath on loose-ball scatter and SHOT branches** - `e8ff5dc` (GREEN phase)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — Three targeted `lastShotPath: null` additions (lines ~1289, ~1341, ~1746); removed dead `shotPath` variable from SHOT case
- `packages/server/src/__tests__/gameEngine.rule11.test.ts` — 4 RULE-03 regression tests appended: SHOT LOOSE_BALL tie, SHOT save-dropped, LOOSE_BALL scatter → PASS, and confirmed-correct regression guards

## Decisions Made

- Removed the `shotPath` variable from the SHOT case entirely rather than prefixing with `_` — it was dead code after all LOOSE_BALL return objects set `lastShotPath: null` explicitly. The variable had no remaining purpose.
- `applyStartMovement` was not modified (D-07 hard constraint). The fix is surgical to the three identified branches.

## TDD Gate Compliance

1. RED gate: `test(11-02)` commit `c35077a` — 3 tests fail, 17 pass
2. GREEN gate: `feat(11-02)` commit `e8ff5dc` — all 20 tests pass
3. REFACTOR: no separate refactor commit needed (dead variable removal was part of GREEN fix to satisfy lint)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `shotPath` variable after lint failure**

- **Found during:** Task 1 GREEN phase (pre-commit ESLint hook)
- **Issue:** After replacing `lastShotPath: shotPath` with `lastShotPath: null` in both LOOSE_BALL return objects, the `shotPath` variable became unused. `@typescript-eslint/no-unused-vars` flagged it as an error.
- **Fix:** Removed the `const shotPath = hexLine(shooter.position, shotTarget)` line and its comment from the SHOT case. The variable was only used in the two bug branches.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** ESLint passes, `tsc --noEmit` exits 0, all 251 tests pass
- **Committed in:** e8ff5dc (GREEN phase commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — lint error from dead variable)
**Impact on plan:** None. The removal of the dead variable is a cleanup, not a behavior change.

## Known Stubs

None — no stubs introduced. All three fix points are explicit `null` literals.

## Threat Flags

No new security surface introduced. Changes are confined to server-internal state assignments in existing return objects. `lastShotPath` is server-authoritative state broadcast to both clients; it contains only public board geometry (already visible to both players).

## Self-Check: PASSED

- `packages/server/src/gameEngine.ts` — exists, contains `lastShotPath: null, // RULE-03` at 3 locations
- `packages/server/src/__tests__/gameEngine.rule11.test.ts` — exists, contains RULE-03 test describes
- Commits `c35077a` and `e8ff5dc` — verified in git log
- `pnpm exec vitest run src/__tests__/gameEngine.rule11.test.ts` — 20/20 pass
- Full server suite — 251/253 pass (1 intentionally skipped, 1 todo)
- `tsc --noEmit` — exits 0
