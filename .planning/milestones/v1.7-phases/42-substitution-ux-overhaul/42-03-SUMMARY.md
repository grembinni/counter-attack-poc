---
phase: 42-substitution-ux-overhaul
plan: 03
subsystem: game-engine
tags: [red-card, gameEngine, shared-package, bug-fix, hex-grid]

requires:
  - phase: 42-substitution-ux-overhaul (plan 01)
    provides: 'isActivePiece(piece) exported from packages/shared'
provides:
  - 'gameEngine.ts fully converged on the shared isActivePiece predicate for red-card
    exclusion — zero hand-written redCarded flag comparisons remain in the file'
  - 'Red-card-aware pitch-occupancy checks across gameEngine.ts lines 337-4171
    (kick-off carrier assignment, free-move/GK-box-entry destination occupancy,
    GK-dive-at-feet displacement, and all four PASS-delivery target-hex lookups)'
affects: [42-05]

tech-stack:
  added: []
  patterns:
    - 'Every eligibility/rejection/occupancy site in gameEngine.ts that needs to
      exclude a red-carded or benched piece calls the shared isActivePiece(piece)
      predicate — no site hand-writes redCarded/onPitch comparisons anymore.'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts

key-decisions:
  - "Retrofitted a 9th site (applySubstitution's SUB-06 outPiece.redCarded===true
    guard) beyond the plan's explicit 8-site list — caught by the plan's own strict
    zero-remaining-comparisons acceptance grep, and structurally identical to the two
    other already-in-scope reject-a-red-carded-piece guards (applyMove,
    applyPenaltyKickTaker). Behavior-identical: a red-carded piece is always
    onPitch:false too, so isActivePiece narrows to the same outcome."
  - "Task 3's four target-hex occupancy sites (passTeammate, ftpOccupant, occupant,
    teammate) all live inside applyRoll's PASS-delivery branch, not literally inside a
    named 'restart/reposition apply-function' as the plan's shorthand suggested —
    confirmed by reading each enclosing block before editing, per the plan's own
    read-before-edit instruction."
  - "buildSquadPieces's defendingFwdLine filter (line ~337) confirmed CONSTRUCTION and
    left unchanged with an audit comment: it operates on the squad array this function
    is still building from the player pool, before any match-state overlay, so it
    cannot contain a red-carded/benched piece."

requirements-completed: [BUG-38]

duration: ~25min
completed: 2026-08-22
---

# Phase 42 Plan 03: gameEngine.ts Red-Card Retrofit & Occupancy Sweep Summary

**Converged all 9 hand-written `redCarded` comparisons in `gameEngine.ts` onto the shared `isActivePiece` predicate and extended red-card-aware occupancy checks to 9 pitch-occupancy sites across lines 337-4171 (kick-off, free-move, GK-box-entry, GK-dive displacement, and all four PASS-delivery target-hex lookups).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-22T03:22:17Z
- **Tasks:** 3 (as planned)
- **Files modified:** 1 (`packages/server/src/gameEngine.ts`, across 3 atomic commits)

## Accomplishments

- Zero live (non-comment) inline `redCarded === true` / `redCarded !== true` comparisons remain anywhere in `gameEngine.ts` — confirmed by `grep -vn "^\s*[*/]" ... | grep -c "redCarded === true\|redCarded !== true"` returning `0`.
- All 8 plan-enumerated retrofit sites converted to `isActivePiece`: `applyMove`'s CARD-02/CARD-04 rejection, both GK-dive-at-feet/box-entry-response `redCarded===true` guards, `applyFreeMoveZoneCheck`'s eligible-pieces filter, `computeCornerKickEligibleIds`, `computeGoalKickEligibleIds`, `computePenaltyKickEligibleIds`, and `applyPenaltyKickTaker`'s `TAKER_INVALID` rejection — every return shape and surrounding doc comment preserved verbatim, mechanism sentences updated to cite `isActivePiece`/BUG-38/D-09.
- Plus a 9th site (deviation, see below): `applySubstitution`'s SUB-06 `outPiece.redCarded===true` guard, caught by the plan's own audit-style acceptance criteria though outside its explicit 8-item list.
- 5 occupancy sites in lines 337-2432 (Task 2) now exclude red-carded/benched pieces: `applyStartMovement`'s kick-off ball-carrier lookup, `applyFreeMove`'s destination `OCCUPIED` check, `computeGkDiveDisplacement`'s `displaceOccupantsOf` (both the occupant-detection filter and the working-pieces displacement map), and `applyBoxEntryMove`'s destination `OCCUPIED` check. `buildSquadPieces`'s `defendingFwdLine` filter (~line 337) audited and deliberately left unchanged (CONSTRUCTION — builds a fresh squad before any match-state overlay), with a code comment recording the audit.
- 4 occupancy sites in lines 3865-4171 (Task 3) now exclude red-carded/benched pieces, all inside `applyRoll`'s PASS-delivery branch: `passTeammate` (corner-kick `ballAfter` logging), `ftpOccupant` (FTP-toggle-off direct delivery, BUG-04 parity), `occupant` (STANDARD_PASS/LONG_BALL delivery), and `teammate` (no-occupant delivery fallback, determines who catches an uncontested pass).
- `applyRosterContinuity` and its two reset call sites (goal reset, half-time reset) are provably untouched — `git diff packages/server/src/gameEngine.ts | grep -c "applyRosterContinuity"` returns `0`.
- No un-narrowed pitch-occupancy predicate remains anywhere in lines 1-4200 (independently re-audited after Task 3 — the only two non-`isActivePiece` position-matching lines found were the already-audited `buildSquadPieces` CONSTRUCTION site and a ball-position check inside `displaceOccupantsOf`, which tests the _ball's_ position, not a piece, so `isActivePiece` does not apply). The remaining occupancy sweep from line ~5103 onward is plan 42-05's scope, left untouched here so the two plans do not collide.
- Full `packages/server` test suite: 1444 passed / 1 skipped / 1 todo (unchanged baseline from plan 42-01) — green after every task, zero test files edited across all 3 commits. `pnpm -r typecheck` clean. `eslint`/`prettier --check` clean on the touched file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Retrofit the eight existing redCarded filters onto isActivePiece** - `5e8522e` (fix)
2. **Task 2: Apply isActivePiece to occupancy checks in gameEngine.ts lines 337-2432** - `cc8379e` (fix)
3. **Task 3: Apply isActivePiece to occupancy checks in gameEngine.ts lines 3865-4171** - `0432770` (fix)

**Plan metadata:** commit pending (final SUMMARY/STATE commit is handled by the orchestrator per worktree isolation)

_Note: Task 1 and Task 2's edits were initially made in the same working-tree pass before either was committed (pnpm install/build had to complete first). To preserve atomic per-task commits, Task 2's edits were temporarily reverted, Task 1 was verified and committed alone, then Task 2's edits were reapplied and committed separately — both states were independently test/typecheck-verified before their respective commits._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — `isActivePiece` imported from `@counter-attack/shared`; 9 hand-written `redCarded` comparisons retrofitted; 9 pitch-occupancy predicates narrowed with a leading `isActivePiece(p) &&` conjunct; 1 audit comment recording a deliberate CONSTRUCTION-site skip.

## Decisions Made

- **Deviation (Rule 2 — missing critical / scope consistency):** `applySubstitution`'s SUB-06 guard (`if (outPiece.redCarded === true) return { ok: false, reason: 'CANNOT_SUB_RED_CARD' }`) was not in the plan's explicit 8-site list, but the plan's own acceptance-criteria grep (`grep -vn "^\s*[*/]" ... | grep -c "redCarded === true\|redCarded !== true"` must return `0`) would have failed with this site left as-is. It is structurally identical to `applyMove` and `applyPenaltyKickTaker`'s already-in-scope reject-a-red-carded-piece pattern, and behavior-identical (a red-carded piece is always `onPitch:false` too, per the shared `isActivePiece` semantics and the `PlayerPiece.onPitch` doc comment), so it was retrofitted alongside the other 8. Documented per the same precedent set in plan 42-01's summary (its own out-of-list `fouls.ts` fix).
- **Task 3 site identification:** the plan's approximate line numbers (3865/4075/4135/4171) carried roughly a consistent +20 line offset from the actual post-drift locations. Rather than editing blind at the stated line numbers, each candidate was located by reading the enclosing function first (per the plan's own `read_first` instruction), confirming all four are target-hex `.find()` lookups inside `applyRoll`'s PASS case: `passTeammate`, `ftpOccupant`, `occupant`, `teammate`.
- **Verification workaround:** the parallel `vitest --pool=forks` run intermittently hit a "Worker exited unexpectedly" crash — a known flake from concurrent sibling worktree agents contending for resources (documented in project memory, `feedback_gsd_execute_phase_windows_quirks.md`). Re-ran with `--poolOptions.forks.singleFork` to get a clean, deterministic 1444/1444 pass before each commit; this is a verification-environment workaround, not a code deviation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical / Scope Consistency] applySubstitution's SUB-06 guard hand-wrote a redCarded check outside the plan's explicit site list**

- **Found during:** Task 1 (running the plan's own acceptance-criteria audit grep across `gameEngine.ts`)
- **Issue:** `applySubstitution`'s SUB-06 guard used `outPiece.redCarded === true` inline instead of the shared `isActivePiece` predicate. This site was not among the plan's 8 explicitly enumerated retrofit targets, but the plan's own strict "zero remaining inline comparisons" acceptance criterion would fail without fixing it, and it is the exact same hand-written-flag-check pattern BUG-38 exists to eliminate.
- **Fix:** Replaced `if (outPiece.redCarded === true)` with `if (!isActivePiece(outPiece))`, adding a comment recording the BUG-38/D-09 rationale and the behavior-equivalence note (a red-carded piece is always `onPitch: false` too).
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** Full server suite (1444 tests) green afterward; the specific `gameEngine.substitution.test.ts` (47 tests) and `substitution.integration.test.ts` (12 tests) suites both pass unedited.
- **Committed in:** `5e8522e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical / scope consistency)
**Impact on plan:** Necessary for BUG-38's stated goal ("converging every site on one predicate is the structural fix that prevents a fourth recurrence") and for the plan's own literal acceptance criteria. Not scope creep — caught by the plan's own audit command.

## Issues Encountered

- Fresh worktree had no `node_modules` and `packages/shared` had no built `dist/` output, causing every server test file to fail with `Failed to resolve entry for package "@counter-attack/shared"`. Ran `pnpm install --frozen-lockfile` (safe — pnpm's content-addressable store, isolated per worktree) followed by `pnpm --filter @counter-attack/shared build` before any verification command could succeed. Not a plan deviation — infrastructure setup only, matching the same issue plan 42-01 encountered and documented.
- `vitest --pool=forks` intermittently crashed with "Worker exited unexpectedly" mid-run, a known flake under concurrent sibling-worktree resource contention (see project memory). Resolved by re-running with `--poolOptions.forks.singleFork`, which produced a clean, deterministic 1444/1444 pass every time. No code issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `gameEngine.ts` is now fully converged on `isActivePiece` for red-card/bench exclusion across every eligibility, rejection, and occupancy site in lines 337-4171.
- The remaining occupancy sweep from line ~5103 onward in `gameEngine.ts` is explicitly reserved for plan 42-05 — confirmed no overlap or collision in this plan's edits.
- No blockers. Full server suite green (1444 tests), monorepo typecheck clean, eslint/prettier clean on the touched file, zero test files edited across all 3 tasks.

## Self-Check: PASSED

- FOUND: `packages/server/src/gameEngine.ts`
- FOUND: `.planning/phases/42-substitution-ux-overhaul/42-03-SUMMARY.md`
- FOUND commit: `5e8522e` (Task 1)
- FOUND commit: `cc8379e` (Task 2)
- FOUND commit: `0432770` (Task 3)
- FOUND commit: `187c57d` (SUMMARY.md)

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_
