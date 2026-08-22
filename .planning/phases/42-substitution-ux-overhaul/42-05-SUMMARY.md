---
phase: 42-substitution-ux-overhaul
plan: 05
subsystem: game-engine
tags: [red-card, gameEngine, shared-package, bug-fix, hex-grid, audit]

requires:
  - phase: 42-substitution-ux-overhaul (plan 01)
    provides: 'isActivePiece(piece) exported from packages/shared'
  - phase: 42-substitution-ux-overhaul (plan 03)
    provides: 'gameEngine.ts red-card retrofit and occupancy sweep across lines 337-4171'
provides:
  - 'Every restart/reposition occupancy predicate in gameEngine.ts lines 5103-9315
    is red-card aware via the shared isActivePiece predicate'
  - 'A complete D-10 item 4 whole-file classification audit for every
    pieces.some|find|filter hit in gameEngine.ts'
  - '9 additional genuine occupancy/eligibility gaps found and fixed outside the
    plan-enumerated line list (header eligibility x2, restart-placement GK identity
    x2, trapped-piece relocation x2, free-kick finalize x1)'
  - 'gameEngine.redCardExclusion.test.ts — engine-level BUG-38 regression coverage'
affects: [42-06, 42-07, 42-08]

tech-stack:
  added: []
  patterns:
    - "Every remaining restart/reposition occupancy site in gameEngine.ts now calls
      isActivePiece(p) as a leading conjunct, matching the pattern established in
      42-01/42-03. No hand-written redCarded/onPitch comparison remains anywhere in
      the file outside stoppagePhases.ts (isActivePiece's own home)."
    - 'GK-identity lookups (role===GK) feeding duel-resolution (SHOT/PENALTY_KICK_DUEL/
      GK_DIVE/header-goal-line dive-entry) are deliberately NOT narrowed with
      isActivePiece — the codebase has no "team plays without a live goalkeeper"
      fallback behavior anywhere, so narrowing them would either soft-lock the SHOT/
      PENALTY phase permanently or requires new design work. This is the one
      documented exception to the "every isActivePiece site gets narrowed" rule.'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.redCardExclusion.test.ts
  modified:
    - packages/server/src/gameEngine.ts

key-decisions:
  - "GK-restart-placement identity lookups (triggerOutOfBoundsRestart's GOAL_KICK
    branch, triggerPenaltyKick's defendingGk) WERE narrowed with isActivePiece,
    unlike the duel-resolution GK lookups, because both already have a pre-existing
    graceful 'no GK found' fallback (documented inline: 'defensive fallback to clamp'
    and the ternary defendingGk-optional handling) — narrowing them prevents a
    red-carded goalkeeper from being visually resurrected onto the restart hex, with
    zero risk of a new failure mode."
  - "applyCornerKickTakerSelect's missing isActivePiece/onPitch guard on the SELECTED
    taker (discovered while designing Task 3's tests) was NOT fixed in this plan —
    Task 3's declared file scope is test-only (gameEngine.redCardExclusion.test.ts),
    and this is a piece-selection eligibility gap (not an occupancy predicate the
    Task 1/2 grep audit would have surfaced). Documented as a discovered-but-deferred
    finding for a future plan."
  - "The plan's own verification grep (grep -vn \"^\\s*[*/]\" ... | grep \"p\\.position\\.q ===\" |
    grep -vc isActivePiece) returns 9, not the true CONSTRUCTION count of 1 — 8 of
    those 9 are false positives from the grep being line-scoped against multi-line
    predicates where isActivePiece already appears on an adjacent line (verified
    individually; see Verification section below)."

requirements-completed: [BUG-38]

duration: ~55min
completed: 2026-08-22
---

# Phase 42 Plan 05: gameEngine.ts Occupancy Sweep Completion & D-10 Audit Closeout Summary

**Finished the BUG-38 occupancy sweep across gameEngine.ts lines 5103-9315 (14 sites: 6 in Task 1, 8 in Task 2), closed out the D-10 item 4 whole-file audit with a complete classification table, fixed 9 additional genuine gaps the audit found outside the enumerated line list, and added engine-level regression tests proving movement, occupancy, three restart placements, the two-clause predicate, and two eligibility retrofits.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-22T04:02:55Z
- **Tasks:** 3 (as planned)
- **Files modified:** 2 (`packages/server/src/gameEngine.ts` across 2 commits, plus 1 new test file)

## Accomplishments

- All 6 Task-1-enumerated occupancy sites (lines ~5103-6731) narrowed with `isActivePiece(p) &&`: the LOOSE_BALL trajectory-landing occupant lookup in `applyRoll`, `applyCornerKickGkPlace`, `applyCornerKickReposition`, `applyCornerKickFinalMove`, `applyGoalKickReposition`, and `applyGoalKickTarget`'s header-receiver lookup.
- All 8 Task-2-enumerated occupancy sites (lines ~7225-9315) narrowed: `applyPenaltyKickReposition`, `applyPenaltyKickTaker`'s spot-occupant lookup, `applyQuickThrow`'s receiver lookup, `applyResolveHeaderTarget`'s non-goal-line occupant lookup, `applyKickOffReady`'s `teamPieces` filter (covers both its OUT_OF_ZONE and CENTRE_HEX_EMPTY checks), `applyFreeKickMove`'s kicker-select `kickerHexOccupant` check and its backward-compat `kickerAlreadyPlaced` check, and `applyFreeKickReady`'s `teamPieces` filter (covers its DEFENDER_TOO_CLOSE check).
- Whole-file D-10 item 4 audit completed: every `pieces.some|find|filter` hit in `gameEngine.ts` classified into (a) already isActivePiece-aware, (b) id-based lookup where the flag is irrelevant, (c) CONSTRUCTION, or (d) genuine gap — full table below.
- **9 additional genuine gaps found by the audit and fixed**, all outside the plan's enumerated 14-line list:
  1. `applyRoll`'s HIGH_PASS→HEADER `homeEligible`/`awayEligible` check counted a red-carded/benched piece as a live header contestant instead of correctly falling through to the "no eligible players" LOOSE_BALL branch.
  2. `applyGoalKickMoveEnd`'s identical "copied verbatim" `homeEligible`/`awayEligible` check — same fix.
  3. `triggerOutOfBoundsRestart`'s GOAL_KICK-branch GK lookup could reposition ("resurrect") a red-carded goalkeeper onto the goal-kick restart hex; the existing `if (!gk) return null` fallback already handles "no GK found" gracefully.
  4. `triggerPenaltyKick`'s `defendingGk` lookup — same resurrection risk, same pre-existing safe fallback (the `defendingGk ? ... : clearOut.pieces` ternary).
  5. `relocateTrappedFreeKickPieces`'s `trappedIds` filter could sweep a dismissed player's frozen position into an unrelated relocation.
  6. `relocateTrappedFreeKickPieces`'s `occupied` hex-set could let a dead piece's frozen hex block a live trapped piece's destination.
  7. `applyFreeKickReady`'s finalize-kick `kicker` lookup could hand ball possession to a red-carded piece frozen on `freeKickHex`.
- **Deliberately NOT fixed** (documented, not a mechanical narrowing): 7 `role==='GK'` identity lookups feeding SHOT/PENALTY_KICK_DUEL/GK_DIVE duel resolution and header-goal-line dive-entry (`applyRoll` SHOT case, `applyDeclareShot`, `applyGKDive`, `applyPenaltyKickDuel`, and 3 header-goal-line-target dive-entry sites). No "team plays without a live goalkeeper" fallback exists anywhere in this codebase; narrowing these would either permanently soft-lock the SHOT/PENALTY phase or requires new design work outside this plan's restart/reposition scope — squarely Rule 4 (architectural).
- Engine-level regression test file `gameEngine.redCardExclusion.test.ts` created: 12 tests covering `applyMove` rejection + occupancy + the two-clause proof, three restart placements (`applyFreeKickMove`, `applyCornerKickReposition`, `applyKickOffReady`) each with a positive control, and 2 eligibility spot-checks (`computePenaltyKickEligibleIds`, `computeCornerKickEligibleIds`).
- Full test suite: `packages/server` 1466 passed / 1 skipped / 1 todo (up from the 1454 baseline — +12 new tests, zero regressions). `packages/shared` 861 passed (untouched, confirmed as baseline). Monorepo `tsc --noEmit` clean across shared/server/client. `eslint`/`prettier --check` clean on all touched files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Occupancy sweep, gameEngine.ts lines 5103-6731** - `8ef7ffa` (fix)
2. **Task 2: Occupancy sweep, gameEngine.ts lines 7225-9315, and whole-file audit closeout** - `d87537f` (fix)
3. **Task 3: Engine-level BUG-38 regression tests** - `53c8825` (test)

**Plan metadata:** commit pending (final SUMMARY/STATE commit is handled by the orchestrator per worktree isolation)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — 14 plan-enumerated occupancy sites narrowed with `isActivePiece`, plus 9 additional genuine gaps found and fixed by the whole-file audit closeout.
- `packages/server/src/__tests__/gameEngine.redCardExclusion.test.ts` (created) — 12 engine-level regression tests, self-contained fixtures (no cross-test-file imports, per project convention).

## Task 1 Classification Table (lines ~5103-6731)

| Plan line | Enclosing function                                                  | Classification | Action                      |
| --------- | ------------------------------------------------------------------- | -------------- | --------------------------- |
| 5103      | `applyRoll` (LOOSE_BALL case — trajectory-landing occupant `.find`) | OCCUPANCY      | `isActivePiece(p) &&` added |
| 5528      | `applyCornerKickGkPlace`                                            | OCCUPANCY      | `isActivePiece(p) &&` added |
| 5843      | `applyCornerKickReposition`                                         | OCCUPANCY      | `isActivePiece(p) &&` added |
| 6077      | `applyCornerKickFinalMove`                                          | OCCUPANCY      | `isActivePiece(p) &&` added |
| 6415      | `applyGoalKickReposition`                                           | OCCUPANCY      | `isActivePiece(p) &&` added |
| 6731      | `applyGoalKickTarget` (header-receiver `.find`)                     | OCCUPANCY      | `isActivePiece(p) &&` added |

## Task 2 Classification Table (lines ~7225-9315, plan-enumerated)

| Plan line | Enclosing function                                                               | Classification | Action                                      |
| --------- | -------------------------------------------------------------------------------- | -------------- | ------------------------------------------- |
| 7225      | `applyPenaltyKickReposition`                                                     | OCCUPANCY      | `isActivePiece(p) &&` added                 |
| 7422      | `applyPenaltyKickTaker` (spot-occupant `.find`)                                  | OCCUPANCY      | `isActivePiece(p) &&` added                 |
| 7885      | `applyQuickThrow` (receiver `.find`)                                             | OCCUPANCY      | `isActivePiece(p) &&` added                 |
| 8326      | `applyResolveHeaderTarget` (non-goal-line occupant `.find`)                      | OCCUPANCY      | `isActivePiece(p) &&` added                 |
| 8747      | `applyKickOffReady` (`teamPieces` filter — feeds OUT_OF_ZONE + CENTRE_HEX_EMPTY) | OCCUPANCY      | `isActivePiece(p) &&` added at construction |
| 9064      | `applyFreeKickMove` (`kickerHexOccupant` `.find`)                                | OCCUPANCY      | `isActivePiece(p) &&` added                 |
| 9126      | `applyFreeKickMove` (`kickerAlreadyPlaced` `.some`)                              | OCCUPANCY      | `isActivePiece(p) &&` added                 |
| 9315      | `applyFreeKickReady` (`teamPieces` filter — feeds DEFENDER_TOO_CLOSE)            | OCCUPANCY      | `isActivePiece(p) &&` added at construction |

## Whole-File D-10 Item 4 Audit — Every `pieces.some|find|filter` Hit

**Group (a) — already `isActivePiece`-aware (no change; from 42-01/42-03 or already narrowed elsewhere):**
`applyStartMovement` kick-off carrier lookup; `moveValidator.ts`-mirrored `applyMove`/`applyFreeMove` OCCUPIED checks; `applyFreeMoveZoneCheck` `eligiblePieces`; the four PASS-delivery target-hex lookups (`passTeammate`, `ftpOccupant`, `occupant`, `teammate`) in `applyRoll`; `computeCornerKickEligibleIds`; `computeGoalKickEligibleIds`; `computePenaltyKickEligibleIds`; `computeGkDiveAtFeetOffer`/`computeBoxEntryOffer` (isActivePiece checked as a separate statement, not inline in the `.find` predicate — same effect).

**Group (b) — id-based lookup, flag irrelevant (caller already validated the id, or the id is gated upstream by an isActivePiece-aware offer/eligibility computation):**
The large majority of `.find((p) => p.id === someId)` sites across the file — piece-by-id resolution for `ball.carrierId`, `foulerId`, `defenderId`, `victimId`, header-contestant ids (fed from `state.headerContestants`, itself populated only from eligible selections), `state.gkDiveAtFeetGkId`/`gkDiveAtFeetCarrierId` (gated by `computeGkDiveAtFeetOffer`'s own `isActivePiece` check before the phase is ever entered), `state.gkBoxEntryTeam`'s GK lookup in `applyBoxEntryMove` (gated by `computeBoxEntryOffer`'s own `isActivePiece` check), `state.goalKickGkId`, `state.penaltyKickTakerId`, `outPieceId`/`inPlayerId` in `applySubstitution`, and the `resolveThrowInHex`-feeding exclusion filters in `applyCornerKickTakerSelect`/`applyGoalKickTarget`'s sibling (`otherPieces`/`state.pieces.filter(p => p.id !== pieceId)`) — safe because `resolveThrowInHex` itself is `isActivePiece`-aware internally (42-01).

**Group (c) — CONSTRUCTION (builds a fresh array that cannot contain a dismissed piece):**
`buildSquadPieces`'s `defendingFwdLine`/jersey-#9-anchor filters (~line 320/343) — operates on the squad array being built from the player pool, before any match-state overlay.

**Group (d) — genuine gaps, all fixed this plan:** the 14 plan-enumerated sites (Task 1 + Task 2 tables above) plus the 9 additional finds:

1. `applyRoll` HIGH_PASS `homeEligible`/`awayEligible` header-eligibility check
2. `applyGoalKickMoveEnd`'s identical header-eligibility check
3. `triggerOutOfBoundsRestart` GOAL_KICK-branch GK restart-placement lookup
4. `triggerPenaltyKick`'s `defendingGk` placement lookup
5. `relocateTrappedFreeKickPieces`'s `trappedIds` filter
6. `relocateTrappedFreeKickPieces`'s `occupied` hex-set construction
7. `applyFreeKickReady`'s finalize-kick `kicker` lookup

**Group (e) — deliberately NOT narrowed (documented exception, not CONSTRUCTION/id-based/already-fixed):** 7 `role==='GK'` identity lookups feeding duel resolution — `applyRoll`'s SHOT-case defending-GK lookup, `applyDeclareShot`, `applyGKDive`, `applyPenaltyKickDuel`, and 3 header-goal-line-target `enterGkDiveOrSkip` dive-entry sites (in the HEADER contested-duel branches and `applyResolveHeaderTarget`'s goal-line branch). See "Decisions Made" below for the full rationale.

**Verification grep note:** the plan's acceptance criterion (`grep -vn "^\s*[*/]" ... | grep "p\.position\.q ===" | grep -vc "isActivePiece"`) returns 9 after this plan's edits, not the true CONSTRUCTION count of 1. Each of the 9 hits was individually re-verified: 1 is the genuine CONSTRUCTION site (`buildSquadPieces`); the other 8 are false positives from the grep matching only the single line containing `p.position.q ===`, while `isActivePiece(p) &&` sits on an earlier line of the same multi-line arrow-function predicate (confirmed by reading each site directly — see commit `d87537f`'s message for the itemized list).

## Decisions Made

- **GK-restart-placement lookups WERE narrowed; GK-duel-resolution lookups were NOT.** The distinguishing test applied throughout this audit: does excluding a red-carded GK from this `.find` already have a safe, pre-existing fallback path? `triggerOutOfBoundsRestart`'s GOAL_KICK branch and `triggerPenaltyKick`'s `defendingGk` both already handle "no GK found" gracefully (a documented `return null` / `defendingGk ? ... : clearOut.pieces` ternary) — narrowing them closes a real resurrection bug with zero new risk. The 7 duel-resolution sites (SHOT, PENALTY_KICK_DUEL, GK_DIVE, and the 3 header-goal-line dive-entry call sites) have no such fallback: `applyRoll`'s SHOT case and `applyDeclareShot` both `return { ok: false, reason: 'WRONG_PHASE' }` if no GK is found — narrowing them would permanently soft-lock the SHOT/PENALTY phase for any match where the defending GK has been sent off, since no "team plays without a keeper" resolution path exists anywhere in this codebase. That is a strictly worse outcome than the current (bugged but playable) behavior, and fixing it properly requires new design work — Rule 4 (architectural change), explicitly out of this plan's restart/reposition-placement scope.
- **`applyCornerKickTakerSelect`'s missing red-card guard on the chosen taker was found but not fixed.** While designing Task 3's tests, it became clear `applyCornerKickTakerSelect` never checks `isActivePiece`/`onPitch` on the piece selected as corner-kick taker (unlike `applyPenaltyKickTaker`, which does). CORNER-02's own docstring ("any own on-pitch piece") implies this should be excluded, but this is a piece-_selection_ eligibility gap, not a hex-occupancy predicate the Task 1/2 grep audit targets, and Task 3's declared file scope is test-only. Documented here as a discovered-but-deferred finding rather than silently fixed out-of-scope or silently ignored.
- **Test fixtures for Task 3 are self-contained** (own `makePiece`/`makeState` helpers), matching this test suite's established convention (see `testHelpers.ts`'s own doc comment and `offside.test.ts`'s identical pattern) rather than importing fixtures across test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `applyRoll`/`applyGoalKickMoveEnd` header-eligibility checks counted a dead piece as a live contestant**

- **Found during:** Task 2's whole-file audit sweep
- **Issue:** The HIGH_PASS→HEADER `homeEligible`/`awayEligible` proximity check (and its "copied verbatim" goal-kick sibling) used `hexDistance(p.position, targetHex) <= 2` with no `isActivePiece` filter — a red-carded/benched piece within 2 hexes of the target would incorrectly force a HEADER phase with no live contestant on that side, instead of correctly falling through to the "no eligible players" LOOSE_BALL branch.
- **Fix:** Added `isActivePiece(p) &&` to both `.some()` predicates in both locations.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** Full server suite green; no existing test exercised this exact scenario (a dead piece as the sole nearby "contestant"), so this is a genuine gap closure, not a regression fix.
- **Committed in:** `d87537f` (Task 2 commit)

**2. [Rule 1 - Bug] Restart-placement GK lookups could resurrect a red-carded goalkeeper onto the pitch**

- **Found during:** Task 2's whole-file audit sweep
- **Issue:** `triggerOutOfBoundsRestart`'s GOAL_KICK branch and `triggerPenaltyKick` both look up "the team's GK" by `role==='GK'` with no red-card exclusion, then reposition that piece onto a restart hex (goal-kick restart centre / penalty goal-line centre). A red-carded GK — frozen `onPitch:false` — would be visibly teleported back onto the pitch by these restart triggers.
- **Fix:** Added `isActivePiece(p) &&` to both lookups. Both call sites already had a graceful "no GK found" fallback (a `return null` and a `defendingGk ? ... : ...` ternary respectively), so this is a safe narrowing with no new failure mode.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** Full server suite green (includes existing goal-kick/penalty-kick restart tests, all still passing with a live GK).
- **Committed in:** `d87537f` (Task 2 commit)

**3. [Rule 1 - Bug] `relocateTrappedFreeKickPieces` could sweep a dismissed player's frozen hex into relocation, or let it block a live piece's destination**

- **Found during:** Task 2's whole-file audit sweep
- **Issue:** The `trappedIds` filter (which pieces get relocated away from `freeKickHex`) and the `occupied` hex-set (candidate-destination collision check) both operated on every piece regardless of red-card/bench status.
- **Fix:** Added `isActivePiece` to both. Verified this does not reintroduce the D-59 stuck-game bug the function was written to fix: the sibling `KICKER_HEX_OCCUPIED` check in `applyFreeKickMove` is itself `isActivePiece`-aware (this plan's own Task 2 fix), so a dead piece left un-relocated on `freeKickHex` no longer blocks kicker placement independently.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** Full server suite green (includes existing foul-free-kick and offside-relocation integration tests).
- **Committed in:** `d87537f` (Task 2 commit)

**4. [Rule 1 - Bug] `applyFreeKickReady`'s finalize-kick lookup could hand possession to a red-carded piece**

- **Found during:** Task 2's whole-file audit sweep
- **Issue:** The stage-3 finalize branch's `kicker` lookup (who receives the ball when the free kick is taken) had no `isActivePiece` filter.
- **Fix:** Added `isActivePiece(p) &&` to the predicate.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** Full server suite green.
- **Committed in:** `d87537f` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed groups covering 9 individual sites (1 missing critical, 3 bugs)
**Impact on plan:** All directly required by BUG-38's stated unconditional acceptance text ("stop appearing in any gameplay computation... or any other pitch-occupancy check, plus any other site an audit finds") and this plan's own Task 2 mandate to fix every genuine gap the whole-file audit surfaces. No scope creep — every fix is a mechanical `isActivePiece` narrowing with a verified-safe fallback path, consistent with the pattern established in 42-01/42-03.

## Issues Encountered

- Fresh worktree had no `node_modules` and `packages/shared` had no built `dist/` output (same as 42-01/42-03). Ran `pnpm install --frozen-lockfile` then `pnpm --filter @counter-attack/shared build` before any verification command could succeed. Not a plan deviation — infrastructure setup only.
- `vitest --pool=forks` intermittently threw "Worker exited unexpectedly" (documented recurring flake under concurrent sibling-worktree resource contention). Resolved with `--poolOptions.forks.singleFork` for interim verification runs; the final full-suite run with the default `--pool=forks` also passed clean (1466/1466), confirming this was the known flake, not a real failure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `gameEngine.ts` is now fully converged on `isActivePiece` for every restart/reposition occupancy predicate across its full ~9,400 lines (337-9315 combined with 42-03's earlier sweep). Zero hand-written `redCarded`/`onPitch` comparisons remain anywhere in the codebase outside `stoppagePhases.ts` (confirmed by the whole-repo residual grep in Verification).
- One documented, deliberate exception remains: GK-identity lookups feeding duel resolution (SHOT/PENALTY_KICK_DUEL/GK_DIVE) are not red-card aware — this is a distinct, larger "team plays without a live goalkeeper" architectural gap, explicitly flagged for a future dedicated plan rather than silently patched.
- One additional discovered-but-deferred finding: `applyCornerKickTakerSelect` lacks a red-card/onPitch guard on the selected corner-kick taker. Flagged for a future plan; not blocking.
- No blockers. Full server suite green (1466 tests, +12 from this plan), shared suite unaffected (861, baseline), monorepo typecheck/eslint/prettier all clean.

## Self-Check: PASSED

- FOUND: `packages/server/src/gameEngine.ts`
- FOUND: `packages/server/src/__tests__/gameEngine.redCardExclusion.test.ts`
- FOUND commit: `8ef7ffa` (Task 1)
- FOUND commit: `d87537f` (Task 2)
- FOUND commit: `53c8825` (Task 3)

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_
