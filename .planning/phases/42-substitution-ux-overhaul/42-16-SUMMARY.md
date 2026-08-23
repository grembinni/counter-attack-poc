---
phase: 42-substitution-ux-overhaul
plan: 16
subsystem: shared/rules-engine
tags: [bug-fix, gap-closure, offside, passing, regression-tests]

# Dependency graph
requires:
  - phase: 42-substitution-ux-overhaul (plan 01)
    provides: isActivePiece predicate (packages/shared/src/stoppagePhases.ts)
provides:
  - passValidator.ts LONG-pass landing restriction filtered through isActivePiece (closes code-review WR-01)
  - offside.ts opponent counting (opposingPiecesEqualOrAhead) and offside-flag evaluation (evaluateOffside) filtered through isActivePiece
  - Regression coverage for both fixes, each proven to fail against pre-fix code
affects:
  - passValidator.ts LONG pass consumers (gameEngine.ts / gameHandlers.ts callers of validatePass)
  - offside.ts consumers (gameEngine.ts applyEndTurn / applyFreeMoveEnd calling evaluateOffside)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'isActivePiece(p) as the leading conjunct in every eligibility/occupancy/ZoI/interceptor array-construction filter in packages/shared (D-09 contract, stoppagePhases.ts:80-104)'

key-files:
  created: []
  modified:
    - packages/shared/src/passValidator.ts
    - packages/shared/src/passValidator.test.ts
    - packages/shared/src/offside.ts
    - packages/shared/src/offside.test.ts

# Verification
verification:
  automated: pass
  manual: n/a
---

# Phase 42 Plan 16: BUG-38 Residual Site Closure (passValidator LONG landing, offside opponent counting) Summary

## What Was Done

Closed the two residual BUG-38 unfiltered-piece-list sites recorded as Success Criterion 5's remaining failure in `42-VERIFICATION.md`: `passValidator.ts`'s LONG-pass landing-restriction check (code-review WARNING WR-01) and `offside.ts`'s `opposingPiecesEqualOrAhead` opponent counting plus both `evaluateOffside` derivations (`stillFlagged`/`newlyFlagged`). Both are mechanical applications of the existing shared `isActivePiece` predicate (D-09, `packages/shared/src/stoppagePhases.ts`), each proven by a TDD RED→GREEN cycle: the new regression assertions were run against the pre-fix source first (confirmed failing), then the source was patched and the same assertions re-run (confirmed passing).

**Task 1 — `passValidator.ts` LONG landing restriction (WR-01):** the `ownTeammates` and `opponents` filters inside the `if (passType === 'LONG')` guard (PASS-04 landing constraints) now lead with `isActivePiece(p) &&`, mirroring the comment discipline and array-construction-site pattern already used by the STANDARD `opponentPieces` filter, the HIGH/LONG adjacent-blocker filter, `destDefender`, and `rollIntercepts` `opponents` in the same file. A Long Ball may now land within 5 hexes of a sent-off/benched teammate and adjacent to a sent-off/benched opponent; the restriction still fires for every active player (proven by a mixed-case regression test with one active teammate and one red-carded opponent, which still returns `LANDING_RESTRICTED`).

**Task 2 — `offside.ts` opponent counting and flag evaluation:** added the `isActivePiece` import (no cycle — `stoppagePhases.ts` only imports `./types.js`). `opposingPiecesEqualOrAhead`'s `.filter` callback now excludes non-active opponents as its first guard, before the team-id check. `evaluateOffside`'s `stillFlagged` derivation drops a piece the instant it becomes inactive (a dismissed player never keeps a sticky offside flag); its `newlyFlagged` derivation never flags an inactive piece in the first place. `piecesById` (`evaluateOffside`) and the offender lookup in `triggerOffsideFoul` were deliberately left unfiltered, each annotated with a `// BUG-38 audit:` comment classifying them as CONSTRUCTION-class by-id lookups (not eligibility/occupancy lists) for plan 42-17's audit to consume without re-deriving the reasoning.

Both tasks are scoped exactly to the four files named in the plan's `files_modified` — no other file was touched.

## Pre-Fix / Post-Fix Evidence

### Task 1 — passValidator.ts LONG landing restriction

Pre-fix run (`pnpm --filter @counter-attack/shared test -- --pool=forks src/passValidator.test.ts`, source reverted to the unfiltered `ownTeammates`/`opponents` filters, all 5 new tests present):

```
Test Files  1 failed (1)
     Tests  4 failed | 35 passed (39)

FAIL  LONG pass does NOT return LANDING_RESTRICTED for a redCarded teammate within 5 hexes of target
  AssertionError: expected false to be true  (result.ok)
FAIL  LONG pass does NOT return LANDING_RESTRICTED for an onPitch: false teammate within 5 hexes of target
  AssertionError: expected false to be true  (result.ok)
FAIL  LONG pass does NOT return LANDING_RESTRICTED for a redCarded opponent adjacent to target
  AssertionError: expected false to be true  (result.ok)
FAIL  LONG pass does NOT return LANDING_RESTRICTED for an onPitch: false opponent adjacent to target
  AssertionError: expected false to be true  (result.ok)
```

(The 5th new case — the mixed active-teammate + redCarded-opponent control — passed in both pre-fix and post-fix states by design, since it asserts the restriction still fires.)

Post-fix run (source restored):

```
Test Files  1 passed (1)
     Tests  39 passed (39)
```

### Task 2 — offside.ts opponent counting and flag evaluation

Pre-fix run (`pnpm --filter @counter-attack/shared test -- --pool=forks src/offside.test.ts`, `opposingPiecesEqualOrAhead`'s `isActivePiece` guard and `evaluateOffside`'s two guards removed, all 11 new tests present):

```
Test Files  1 failed (1)
     Tests  7 failed | 12 passed (19)

FAIL  opposingPiecesEqualOrAhead > returns 1 (not 2) when the second equal-or-ahead away piece is redCarded
  AssertionError: expected 2 to be 1
FAIL  opposingPiecesEqualOrAhead > returns 1 (not 2) when the second equal-or-ahead away piece is onPitch: false
  AssertionError: expected 2 to be 1
FAIL  isOffsideNow > returns true when the dismissed away piece drops the count to 1
  AssertionError: expected false to be true
FAIL  isClearedNow > returns false when the dismissed away piece drops the count to 1
  AssertionError: expected true to be false
FAIL  evaluateOffside > returns exactly [homeFwd.id] when the second away piece is dismissed
  AssertionError: expected [] to deeply equal ['homeFwd']
FAIL  evaluateOffside > never newly flags a redCarded home piece itself, ...
  AssertionError: expected ['redCardedHomeFwd'] to not include 'redCardedHomeFwd'
FAIL  evaluateOffside > drops a home piece from the result once it becomes redCarded, ...
  AssertionError: expected ['nowDismissedHomeFwd'] to not include 'nowDismissedHomeFwd'
```

This reproduces the verifier's probe exactly: `opposingPiecesEqualOrAhead` returned **2** pre-fix for a fixture with one active and one dismissed (redCarded/onPitch:false) away piece equal-or-ahead of the attacker, where 1 is correct.

Post-fix run (source restored):

```
Test Files  1 passed (1)
     Tests  19 passed (19)
```

Server-side geometry suite (`pnpm --filter @counter-attack/server test -- --pool=forks src/__tests__/offside.test.ts`) — run against the post-fix source, zero expectation changes:

```
Test Files  1 passed (1)
     Tests  89 passed (89)
```

`git diff --stat packages/server/src/__tests__/offside.test.ts` is empty — confirmed no existing geometry case was touched.

## isActivePiece Occurrence Audit

Grep command: `grep -v '^\s*\*' <file> | grep -v '^\s*//' | grep -c 'isActivePiece'` (comment lines filtered out).

| File                                   | Count | Enclosing function / site                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/passValidator.ts` | 7     | 1 import; `validatePass` STANDARD `opponentPieces` filter; `validatePass` HIGH/LONG adjacent-blocker `opponentPieces` filter; `validatePass` LONG `ownTeammates` filter (this plan); `validatePass` LONG `opponents` filter (this plan); `validatePass` `destDefender` lookup; `validatePass` `rollIntercepts` `opponents` filter |
| `packages/shared/src/offside.ts`       | 4     | 1 import; `opposingPiecesEqualOrAhead` `.filter` callback (this plan); `evaluateOffside` `stillFlagged` filter (this plan); `evaluateOffside` `newlyFlagged` filter (this plan)                                                                                                                                                   |

Both counts match the plan's acceptance criteria exactly (7 and 4).

## Classification Notes

- `offside.ts:198` (`piecesById`, inside `evaluateOffside`) — CONSTRUCTION-class by-id lookup (a `Map` keyed by `p.id` for O(1) lookup of `priorFlagged` ids), not an eligibility/occupancy/ZoI/interceptor list. It is filtered downstream at the point of use (`stillFlagged`'s `isActivePiece` check on the retrieved piece), so leaving the map construction itself unfiltered is correct and does not reintroduce the bug — a dismissed piece can still be _looked up_, it just fails the eligibility check immediately after. Annotated with a `// BUG-38 audit:` comment.
- `offside.ts:250` (`triggerOffsideFoul`'s `state.pieces.find((p) => p.id === offenderId)`) — CONSTRUCTION-class by-id lookup resolving a single named offender for the free-kick foul transition, not a list the game iterates for eligibility/occupancy purposes. `triggerOffsideFoul` only ever fires for a piece already present in `offsidePieceIds` (which post-fix can no longer contain a dismissed piece — see `evaluateOffside`'s `stillFlagged`/`newlyFlagged` fix above), so filtering this lookup would be redundant, not corrective. Annotated with a `// BUG-38 audit:` comment.

Both notes are recorded here for plan 42-17's re-audit to consume directly rather than re-deriving the classification.

## Test Counts

| File                                            | Before | After          |
| ----------------------------------------------- | ------ | -------------- |
| `packages/shared/src/passValidator.test.ts`     | 34     | 39             |
| `packages/shared/src/offside.test.ts`           | 8      | 19             |
| `packages/server/src/__tests__/offside.test.ts` | 89     | 89 (unchanged) |

Full `packages/shared` suite: 879 tests passing (17 test files) after both fixes. `pnpm --filter @counter-attack/shared build` and `pnpm -r typecheck` both exit 0.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched the described `<action>` and `<behavior>` blocks; no Rule 1-4 deviations were required.

## Known Stubs

None.

## Threat Flags

None — both edited functions are pure, server-authoritative, and already covered by the plan's `<threat_model>` (T-42-61 through T-42-64). No new network endpoint, auth path, file access pattern, or schema change was introduced.

## Self-Check: PASSED

- FOUND: packages/shared/src/passValidator.ts (isActivePiece count 7, confirmed via grep)
- FOUND: packages/shared/src/passValidator.test.ts (39 tests passing)
- FOUND: packages/shared/src/offside.ts (isActivePiece count 4, confirmed via grep)
- FOUND: packages/shared/src/offside.test.ts (19 tests passing)
- FOUND commit 13772f3c (Task 1)
- FOUND commit 54541335 (Task 2)
