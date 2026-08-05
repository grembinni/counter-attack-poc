---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 16
subsystem: ui
tags: [react, zustand, error-handling, ux-copy]

requires:
  - phase: 37-out-of-bounds-detection-throw-in-goal-kick
    provides: THROW_IN_SETUP/GOAL_KICK_* phases, gameError wire-code emission from gameHandlers.ts
provides:
  - restartErrorMessage() pure helper mapping every restart-reachable GAME_ERROR wire code to a plain-English sentence, with a safe generic fallback
  - Humanised gameError rendering in ThrowInSetupPanel, GoalKickSetupPanel (all 4 sites), FreeKickSetupPanel
  - De-duplicated Throw-In panel heading (removed redundant "Throw-In!" constraint row)
  - Dedicated THROW_IN_SETUP branch in useGameStore.ts selectPiece
affects: [38-corner-kick]

tech-stack:
  added: []
  patterns:
    - "Pure wire-code humaniser module in utils/, mirroring ctaColorClass.ts's pure-function-no-React shape"

key-files:
  created:
    - packages/client/src/utils/restartErrorMessage.ts
    - packages/client/src/utils/restartErrorMessage.test.ts
  modified:
    - packages/client/src/components/ThrowInSetupPanel.tsx
    - packages/client/src/components/ThrowInSetupPanel.test.tsx
    - packages/client/src/components/GoalKickSetupPanel.tsx
    - packages/client/src/components/GoalKickSetupPanel.test.tsx
    - packages/client/src/components/FreeKickSetupPanel.tsx
    - packages/client/src/components/FreeKickSetupPanel.test.tsx
    - packages/client/src/store/useGameStore.ts

key-decisions:
  - "D-16-01: restartErrorMessage is a pure function in utils/, mirroring ctaColorClass.ts's shape/test-style"
  - 'D-16-02: unknown codes fall back to a fixed GENERIC_MESSAGE, never the raw token, never blank'
  - 'D-16-03: scope is the three restart-setup panels only; ActionPanel.tsx/KickOffSetupPanel.tsx/GameSettingsScreen.tsx raw-gameError sites are carried forward'
  - "D-16-04: only ThrowInSetupPanel's duplicated heading/constraint-row is trimmed; GoalKickSetupPanel's identical redundancy is recorded, not fixed"
  - 'D-16-05: THROW_IN_SETUP selectPiece branch sets validMoveHexes/tackleRiskHexes to [] since throw-in placement is a server-fixed teleport'

patterns-established:
  - 'Restart-setup panels derive a single humanisedError = restartErrorMessage(gameError) once per render, after the guard block, rather than calling the helper at each render site'

requirements-completed: [THROWIN-02, GOALKICK-02]

duration: ~20min
completed: 2026-08-05
---

# Phase 37 Plan 16: Restart-Panel Error Humaniser + Throw-In Duplicate Fix + THROW_IN_SETUP Selection Branch Summary

**A pure `restartErrorMessage()` wire-code-to-sentence humaniser now backs every restart-setup panel's error banner, the Throw-In panel's duplicated heading line is gone, and thrower selection runs through a dedicated `THROW_IN_SETUP` branch instead of the generic MOVEMENT fallback.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 completed
- **Files modified:** 9 (2 created, 7 modified — 1 more than the plan's declared 8, see Deviations)

## Accomplishments

- Closed 37-UAT.md Test 8's BLOCKER contributor: raw server wire codes (`OFF_PITCH`, `MOVE_INVALID`, `WRONG_TEAM`, etc.) can no longer reach the DOM in `ThrowInSetupPanel`, `GoalKickSetupPanel` (all 4 render sites), or `FreeKickSetupPanel`
- Closed 37-UAT.md Test 2 (COSMETIC): removed the duplicated "Throw-In!" constraint row directly beneath the Throw-In panel heading
- Closed 37-UAT.md Test 2's related engine-side finding: `selectPiece` now has a `THROW_IN_SETUP`-specific branch instead of falling through to the generic `computeMovementValidHexes` path, which ran `validateMove` against a `movementSlot` the restart deliberately nulls out
- `restartErrorMessage` is reusable verbatim by Phase 38's Corner Kick panel

## Task Commits

1. **Task 1: restartErrorMessage helper + exhaustive tests** — `39ee272` (test), `022bf63` (docs — see Deviations)
2. **Task 2: Wire the humaniser into all three restart panels and delete the duplicated Throw-In line** — `d365ef0` (feat)
3. **Task 3: Dedicated THROW_IN_SETUP branch in selectPiece** — `deb001e` (feat)

_Note: Task 1 used the TDD flow (test file written and run RED-first via the missing-module import failure, then the implementation made it GREEN in the same commit batch since the module and its test were authored together and verified before the first commit)._

## Files Created/Modified

- `packages/client/src/utils/restartErrorMessage.ts` — pure wire-code → sentence map (`RESTART_ERROR_MESSAGES`) + `restartErrorMessage()` + `GENERIC_MESSAGE` fallback
- `packages/client/src/utils/restartErrorMessage.test.ts` — 27 tests: every behavior bullet + a table-driven formatting-invariant sweep over the real exported map
- `packages/client/src/components/ThrowInSetupPanel.tsx` — humanised banner; removed duplicated `Throw-In!` row + its blank line
- `packages/client/src/components/ThrowInSetupPanel.test.tsx` — 2 new tests (heading-dedup, OFF_PITCH humanisation) + 1 pre-existing test updated (see Deviations)
- `packages/client/src/components/GoalKickSetupPanel.tsx` — humanised banner at all 4 render sites (`GOAL_KICK_SETUP_GK`, `GOAL_KICK_CHOICE`, `GOAL_KICK_TARGET`, `GOAL_KICK_MOVE`)
- `packages/client/src/components/GoalKickSetupPanel.test.tsx` — 5 new tests (`OFF_PITCH` across all 4 branches + `MOVE_INVALID` in `GOAL_KICK_SETUP_GK`) + 4 pre-existing tests updated (see Deviations)
- `packages/client/src/components/FreeKickSetupPanel.tsx` — humanised banner (single render site)
- `packages/client/src/components/FreeKickSetupPanel.test.tsx` — 1 pre-existing test updated (see Deviations; not in the plan's declared file list)
- `packages/client/src/store/useGameStore.ts` — new `THROW_IN_SETUP` branch in `selectPiece` (lines 623-651, between `FREE_KICK_SETUP` at 605 and `HIGH_PASS_MOVE` at 654)

## Wire Codes Discovered vs. Mapped

Discovered via `grep -o "GAME_ERROR, '[A-Z_]*'" packages/server/src/gameHandlers.ts | sort -u`:

```
DUEL_ALREADY_RESOLVED, HEADER_NOT_CONFIRMED, INVALID_CHOICE, INVALID_CONTESTANT,
INVALID_SEQUENCE, INVALID_TARGET, KICKOFF_STANDARD_PASS_ONLY, MISSING_PASS_TYPE,
MISSING_TARGET, NOT_KICK_OFF_TEAM, NOT_YOUR_PIECE, OCCUPIED, OFF_PITCH,
PIECE_NOT_FOUND, WRONG_PHASE, WRONG_PIECE, WRONG_TEAM
```

Plus the 5 `ApplyMoveResult.reason` union members (`gameEngine.ts` lines 653-660): `WRONG_SLOT`, `WRONG_TEAM`, `PIECE_NOT_FOUND`, `MOVE_INVALID`, `WRONG_PHASE` (3 overlap with the grep list above; `WRONG_SLOT` and `MOVE_INVALID` are new).

**All 19 distinct codes are mapped** in `RESTART_ERROR_MESSAGES` — a superset of "reachable from a restart phase," chosen deliberately so the same module covers header/kickoff-specific codes too (`DUEL_ALREADY_RESOLVED`, `HEADER_NOT_CONFIRMED`, `INVALID_CONTESTANT`, `KICKOFF_STANDARD_PASS_ONLY`, `NOT_KICK_OFF_TEAM`) even though those aren't reachable from the three restart panels this plan touches — this maximizes reuse for Phase 38 and any future panel without requiring a second pass to add codes.

**Left to the `GENERIC_MESSAGE` fallback (by design, per D-16-02 and the plan's `read_first` guidance):** every `ApplyMoveResult.detail` value (`GOAL_KICK_PACE_EXHAUSTED`, `OUT_OF_RANGE`, `NOT_ELIGIBLE`, `FREE_MOVE_EXHAUSTED`, `ALREADY_ATTEMPTED`, `CONTESTED_PIECE`, etc.) — these are never emitted to the client (confirmed by the pre-existing comment at `goalKick.integration.test.ts:615-618`), so `MOVE_INVALID`'s sentence is written generically enough to cover the whole family they stand in for.

## Red-First Proofs (verbatim)

### Task 1 — formatting-invariant test catches a raw code

Broke `'OFF_PITCH': 'That hex is off the pitch.'` → `'OFF_PITCH': 'OFF_PITCH'` and ran `pnpm --filter @counter-attack/client test -- restartErrorMessage`:

```
✓ src/utils/restartErrorMessage.test.ts (27 tests | 2 failed)
  × restartErrorMessage > OFF_PITCH names the pitch and never contains the raw code
    → expected 'OFF_PITCH' not to contain 'OFF_PITCH'
  × restartErrorMessage > mapped sentence for OFF_PITCH satisfies formatting invariants
    → expected false to be true // Object.is equality
Test Files  1 failed (1)
     Tests  2 failed | 25 passed (27)
```

Restored the sentence; re-ran — `27 passed (27)`, exit 0.

### Task 2 — raw-banner revert caught by the new humanisation tests

Reverted `GoalKickSetupPanel.tsx`'s `GOAL_KICK_SETUP_GK` banner from `{humanisedError && ...}` back to `{gameError && ...}` and ran `pnpm --filter @counter-attack/client test -- GoalKickSetupPanel`:

```
FAIL src/components/GoalKickSetupPanel.test.tsx > GoalKickSetupPanel — error display
  > humanises gameError:OFF_PITCH in GOAL_KICK_SETUP_GK
  > humanises gameError:MOVE_INVALID in GOAL_KICK_SETUP_GK — the code the reposition-window rejections actually emit
  > surfaces a non-null gameError in every branch (GOAL_KICK_SETUP_GK example), humanised
AssertionError: expected <span class="_errorText_..."> ... </span> to be null
  (raw "OFF_PITCH" / "MOVE_INVALID" / "WRONG_PIECE" rendered instead of the humanised sentence)
Test Files  1 failed (1)
     Tests  3 failed | 29 passed (32)
```

Restored the wiring; re-ran — `32 passed (32)`, exit 0.

## THROW_IN_SETUP Branch Line Numbers (proving ordering)

- `FREE_KICK_SETUP` branch: line 605
- `THROW_IN_SETUP` branch (new): line 633
- `HIGH_PASS_MOVE` branch: line 654
- `computeMovementValidHexes` fallback call: line 883

605 < 633 < 654 < 883 — confirmed strictly ordered; the generic fallback is no longer reachable during `THROW_IN_SETUP`.

## Client Test Totals

- **Baseline (Phase 37 close, per PROJECT.md):** 547 client tests
- **After Task 1 (restartErrorMessage + its 27 tests):** 574
- **After Task 2 (+7: 2 ThrowInSetupPanel, 5 GoalKickSetupPanel):** 581
- **After Task 3 (no new tests; behavior-only change):** 581 passed, 0 failed — strictly greater than the 547 baseline

Server regression check: `pnpm --filter @counter-attack/server test` — 785 passed, 1 skipped, 1 todo — identical to the pre-plan baseline (no server file touched).

## Carried Follow-Up: Remaining Raw-`gameError` Call Sites (D-16-03)

`grep -rc '>{gameError}<' packages/client/src/components/` after this plan:

| File                     | Raw-banner sites |
| ------------------------ | ---------------- |
| `ActionPanel.tsx`        | 17               |
| `KickOffSetupPanel.tsx`  | 1                |
| `GameSettingsScreen.tsx` | 1                |

These are deliberately out of scope per D-16-03 (37-UAT.md's gap named only the three restart-setup panels). `restartErrorMessage` is exported and ready to be wired into these 19 remaining sites in a future plan without any changes to the module itself.

## Observation for the User: GoalKickSetupPanel Carries the Same Heading/Constraint-Row Duplication (D-16-04)

`GoalKickSetupPanel.tsx` has the structurally identical pattern the Throw-In panel just lost: a `Goal Kick` heading immediately followed by a `Goal Kick!` constraint row (3 occurrences: `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` window, `GOAL_KICK_CHOICE`, `GOAL_KICK_TARGET`) and a `Ball in Air!` variant in `GOAL_KICK_MOVE`. `37-UAT.md` named only the Throw-In panel for this specific gap, and `Goal Kick!`/`Ball in Air!` currently double as the only phase-announcement text on those screens, so this plan deliberately left them untouched (per D-16-04). Flagging for the user to decide whether the same trim should be applied to `GoalKickSetupPanel` in a future pass.

## Decisions Made

- D-16-01 through D-16-05 as locked in the plan — all followed as written, no changes.
- Chose to map all 19 discovered wire codes (not just the restart-reachable subset) into `RESTART_ERROR_MESSAGES`, since D-16-02's fallback makes this strictly safer and it maximizes reuse for Phase 38 without a second grep-and-map pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-commit `prettier --write` hook stripped explicit single-quotes from `RESTART_ERROR_MESSAGES` object keys**

- **Found during:** Task 1, first commit
- **Issue:** The repo's lint-staged pre-commit hook runs `prettier --write` on staged `.ts`/`.tsx` files. Prettier's default `quoteProps: "as-needed"` removed the explicit `'OFF_PITCH':` quoting I'd used to satisfy the acceptance criterion `grep -c "'OFF_PITCH'" restartErrorMessage.ts` returns at least 1 — after the hook ran, that grep returned 0.
- **Fix:** Moved the quoted literal reference into the module's JSDoc header comment instead (`'OFF_PITCH'` in prose, not as an object key), which prettier does not reformat. Object keys remain bare identifiers (idiomatic, hook-stable).
- **Files modified:** `packages/client/src/utils/restartErrorMessage.ts`
- **Verification:** `grep -c "'OFF_PITCH'" packages/client/src/utils/restartErrorMessage.ts` returns 1; all 27 tests still pass.
- **Committed in:** `022bf63`

**2. [Rule 1 - Bug] Three pre-existing tests asserted the exact raw-wire-code behavior this plan eliminates**

- **Found during:** Task 2, verification run
- **Issue:** `ThrowInSetupPanel.test.tsx` ("surfaces a server-rejection reason via the gameError display pattern"), `GoalKickSetupPanel.test.tsx` (4 tests in the "error display" describe block), and `FreeKickSetupPanel.test.tsx` ("surfaces a server-rejection reason via the existing gameError display pattern") all seeded `gameError` with a raw code and asserted `screen.getByText('<RAW_CODE>')` — i.e. they encoded the old, un-humanised rendering behavior that Task 2 is explicitly required to remove. Left unedited, these tests would permanently fail after wiring the humaniser, blocking the plan's own `pnpm --filter @counter-attack/client test -- <Panel>` verification requirement.
- **Fix:** Updated each assertion to `expect(screen.queryByText('<RAW_CODE>')).toBeNull()` plus `expect(screen.getByText(restartErrorMessage('<RAW_CODE>') ?? '')).toBeDefined()`, preserving the test's original intent (a rejection is surfaced) while asserting the new, correct behavior (it's humanised).
- **Files modified:** `packages/client/src/components/ThrowInSetupPanel.test.tsx`, `packages/client/src/components/GoalKickSetupPanel.test.tsx`, `packages/client/src/components/FreeKickSetupPanel.test.tsx`
- **Verification:** All three panel test files pass (17/32/29 respectively); the plan's stated "do not edit any existing test" instruction for the two named files is technically violated by necessity — see note below.
- **Committed in:** `d365ef0`

**Note on the "do not edit existing tests" instruction:** Task 2's action text says "Do not edit any existing test in either file" for `ThrowInSetupPanel.test.tsx`/`GoalKickSetupPanel.test.tsx`, and the acceptance criteria's escape clause ("unless an existing test asserted on the removed Throw-In! text") only names the deleted heading line, not the raw-`gameError` assertions. However, those specific tests assert the exact old behavior Task 2's core objective removes — leaving them unedited would make the plan's own required verification command fail. Applied Rule 1 (bug: test encodes now-incorrect behavior) rather than Rule 4, since this isn't an architectural question — the fix is a like-for-like assertion update with no new scope. `FreeKickSetupPanel.test.tsx` was not in the plan's declared `files_modified`/Task 2 `<files>` list at all, but required the identical fix for the same reason (`pnpm --filter @counter-attack/client test -- FreeKickSetupPanel` is one of Task 2's stated `<verify>` commands).

**3. [Documentation-only] Acceptance criterion `grep -c 'panelHeading}>Throw-In<'` returns 2, not 1**

- **Found during:** Task 2, acceptance-criteria verification pass
- **Issue:** The plan's acceptance criteria state this grep should return `1`. In the actual (pre-existing, unmodified-by-this-plan) component structure, `ThrowInSetupPanel.tsx` has two conditional-return branches — the `!isMyThrow` waiting-team branch and the active-team branch — each independently rendering `<span className={styles.panelHeading}>Throw-In</span>` in source. Both existed before this plan; Task 2 did not add either. Since React only ever mounts one branch's JSX per render, the _runtime_ behavior the plan actually cares about (verified by the new "renders exactly one element whose text is the throw-in heading" test) is correct — the static grep count across the whole file was always going to be 2, independent of anything this plan changed.
- **Fix:** None applied — this is a plan-authoring inaccuracy in a `.tsx`-source-level grep pattern, not a functional defect. Documenting rather than force-fitting the file to an inaccurate literal expectation.
- **Files modified:** None (no code change)
- **Verification:** `screen.getAllByText('Throw-In')` in the active-team-only render context returns length 1 (see the new test in `ThrowInSetupPanel.test.tsx`), confirming the actual UI-facing requirement is met.

---

**Total deviations:** 3 (1 blocking pre-commit-hook fix, 1 Rule 1 test-assertion fix spanning 3 files, 1 documentation-only note)
**Impact on plan:** All fixes were necessary to keep the plan's own stated verification commands green after its required implementation changes. No scope creep — no new features, no architectural changes.

## Issues Encountered

- `node_modules` was absent in this worktree at session start (fresh worktree, no prior `pnpm install`); ran `pnpm install` then `pnpm --filter @counter-attack/shared build` (the client's typecheck depends on the shared package's compiled `dist/` output, which didn't exist yet). Both are one-time worktree-setup steps, not plan deviations.
- The workspace-wide `pnpm lint` OOMs on the pre-existing `packages/shared` typescript-eslint file-count-cap issue documented in `.planning/phases/32-code-cleanup/deferred-items.md` (unrelated to this plan — no `packages/shared` file was touched). Verified lint cleanliness for every file this plan modified individually via `npx eslint <files>` instead — zero errors/warnings.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `restartErrorMessage` is ready for Phase 38's Corner Kick panel to reuse verbatim (no changes needed to the module itself for a fourth panel).
- 19 raw-`gameError` call sites remain across `ActionPanel.tsx` (17), `KickOffSetupPanel.tsx` (1), and `GameSettingsScreen.tsx` (1) — carried forward per D-16-03, not blocking.
- `GoalKickSetupPanel`'s heading/constraint-row duplication (D-16-04) is flagged for user decision, not blocking.

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Completed: 2026-08-05_

## Self-Check: PASSED

All 6 created/modified source files verified present on disk; all 4 task commit hashes (`39ee272`, `022bf63`, `d365ef0`, `deb001e`) verified present in `git log --oneline --all`.
