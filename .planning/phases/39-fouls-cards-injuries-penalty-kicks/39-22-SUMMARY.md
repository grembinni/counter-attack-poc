---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 22
subsystem: game-engine
tags: [socket.io, penalty-kick, fouls, gap-closure, uat]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: FOUL-03/FK-01 foul-choice restart routing (Plan 39-18), PEN-01/02/03 penalty-kick engine functions (Plan 39-11/39-07)
provides:
  - Box-location foul routing — any tackle/steal-sourced foul inside the fouling team's own penalty area now awards a penalty kick, not a free kick
  - Award-time penalty board setup — automatic non-GK box clear-out (relocateOutsidePenaltyArea) + defending goalkeeper placed on PENALTY_GOAL_LINE_CENTRE
  - Reordered penalty phase chain — TAKER_SELECT now precedes both reposition windows (was: windows then taker-select)
  - Unconditional PENALTY_KICK_PIECE_IMMOVABLE guard for the chosen taker and the defending goalkeeper during repositioning
  - Full in-box-foul-to-penalty journey proven end-to-end over real sockets
affects:
  [39-23 (kicker-selection UX), any future phase touching penalty-kick or foul-restart routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'relocateOutsidePenaltyArea: deterministic (sort by hexDistance, tie-break q then r) box clear-out helper, sibling of applyAutomaticCornerClearOut — never calls randomInt'
    - 'isPenaltyRestart single boolean feeding both the FOUL_CHOICE_MADE event literal and the triggerPenaltyKick/triggerFoulFreeKick branch selection, so the two can never drift'

key-files:
  created: []
  modified:
    - packages/shared/src/pitch.ts
    - packages/shared/src/pitch.test.ts
    - packages/shared/src/types.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.penaltyKick.test.ts
    - packages/server/src/__tests__/gameEngine.fouls.test.ts
    - packages/server/src/__tests__/gameEngine.undoReplay39.test.ts
    - packages/server/src/__tests__/penaltyKick.integration.test.ts
    - packages/client/src/components/ActionLog.tsx

key-decisions:
  - "39-UAT test 5's expected: line pairs PENALTY_SPOT the wrong way round ('(32,13) for away kicking') — confirmed as a transcription slip, not a bug; the existing PENALTY_SPOT keying (defending-team-keyed) is unchanged, per the UAT's own Gaps entry"
  - "No gameHandlers.ts change was needed for the phase reorder — every penalty handler's phase guard is per-function (checks state.phase directly), so re-sequencing which phase leads to which was entirely a gameEngine.ts concern; proven by a real socket walkthrough, not asserted by comment"
  - "ActionLog.tsx's exhaustive event-type switch DID need a new case for PENALTY_KICK_CLEAR_OUT_MOVE — pnpm typecheck failed with TS2366 (function lacks ending return) until added"

patterns-established:
  - "relocateOutsidePenaltyArea shared by triggerPenaltyKick's award-time clear-out and applyPenaltyKickTaker's spot-occupant safety net — one deterministic helper, two call sites"

requirements-completed: [FOUL-03, FK-01, PEN-01, PEN-02]

# Metrics
duration: 30min
completed: 2026-08-15
---

# Phase 39 Plan 22: In-Box Foul Routes to Penalty + Reordered Chain Summary

**Any tackle/steal foul inside the fouling team's own penalty area now awards a penalty (not a free kick), with an automatic box clear-out, goalkeeper placement, and a taker-select-first phase chain that makes the kicker and defending GK genuinely immovable during repositioning.**

## Performance

- **Duration:** ~30 min (including a one-time `pnpm install` for the worktree)
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- **Task 1 — Box-location routing + award-time setup.** `applyFoulChoice`'s restart branch now derives a single `isPenaltyRestart` boolean (fouling team's own penalty area contains `foulHex`, OR `foulSource === 'GK_DIVE_AT_FEET'`) that feeds both the `FOUL_CHOICE_MADE` event's `restart` literal and the `triggerPenaltyKick`/`triggerFoulFreeKick` branch selection — the two can never drift apart. `triggerPenaltyKick` now performs the full award-time setup before any reposition window opens: every non-GK piece inside the defending penalty area is relocated out via the new `relocateOutsidePenaltyArea` helper, then the defending goalkeeper is placed on the new `PENALTY_GOAL_LINE_CENTRE` hex, and the phase transitions straight to `PENALTY_KICK_TAKER_SELECT`.
- **Task 2 — Reordered chain + immovability.** `applyPenaltyKickTaker` now runs FIRST (from `PENALTY_KICK_TAKER_SELECT`, entered directly by `triggerPenaltyKick`), transitions to `PENALTY_KICK_SETUP_ATTACKING`, and recomputes `penaltyKickEligibleIds` excluding the chosen taker and the defending goalkeeper from both lists. `applyPenaltyKickReposition` gained an unconditional `PENALTY_KICK_PIECE_IMMOVABLE` guard for those same two pieces, and the `PENALTY_AREA_RESTRICTED` guard is now unconditional for everyone else (the former GK/taker exemptions are dead code under the new rules and were removed). `applyPenaltyKickWindowEnd`'s DEFENDING terminal now targets `PENALTY_KICK` directly.
- **Task 3 — Socket-level proof.** `penaltyKick.integration.test.ts` gained a real end-to-end walkthrough: a tackle foul seeded via a real `applyMove` TACKLE_ATTEMPT (injected `tackleDie: 1`) with the carrier standing inside the defending penalty area, a `GAME_FOUL_CHOICE('restart')` that broadcasts the full award (GK on the goal-line centre, box cleared, no shared hexes), kicker selection, one legal and two rejected repositions, both window ends, and the duel — proving no `gameHandlers.ts` change was needed for the reorder.

## Task Commits

1. **Task 1: Route every in-box foul to a penalty and build the award-time board setup** - `aca0455` (feat)
2. **Task 2: Reorder the penalty phase chain and lock the kicker, the goalkeeper and the box during repositioning** - `780a207` (feat)
3. **Task 3: Prove the whole in-box-foul-to-penalty journey over sockets** - `2f82379` (test)

**Plan metadata:** _pending — this commit_

## Files Created/Modified

- `packages/shared/src/pitch.ts` - new `PENALTY_GOAL_LINE_CENTRE` constant (home `{q:0,r:13}`, away `{q:36,r:13}`)
- `packages/shared/src/pitch.test.ts` - assertions for `PENALTY_GOAL_LINE_CENTRE` membership in goal/penalty-area regions
- `packages/shared/src/types.ts` - new `PENALTY_KICK_CLEAR_OUT_MOVE` `ActionEventType`/`ActionEvent` variant (byte-for-byte `CORNER_KICK_CLEAR_OUT_MOVE` minus `slot`)
- `packages/server/src/gameEngine.ts` - `relocateOutsidePenaltyArea`; rewritten `triggerPenaltyKick`, `applyFoulChoice`, `applyPenaltyKickTaker`, `applyPenaltyKickReposition`, `applyPenaltyKickWindowEnd`; `computePenaltyKickEligibleIds` gains `excludeIds`; `buildReplayFrames` piece-position arm; `applyUndo` comment update
- `packages/server/src/__tests__/gameEngine.penaltyKick.test.ts` - full rewrite of the reordered-chain assertions, new `relocateOutsidePenaltyArea`/`applyFoulChoice` box-routing/`applyUndo` boundary describe blocks
- `packages/server/src/__tests__/gameEngine.fouls.test.ts` - one assertion fixed (GK-dive foul now routes to `PENALTY_KICK_TAKER_SELECT`, not `PENALTY_KICK_SETUP_ATTACKING`)
- `packages/server/src/__tests__/gameEngine.undoReplay39.test.ts` - the full GK-dive-to-penalty chain test rewritten for the new step order
- `packages/server/src/__tests__/penaltyKick.integration.test.ts` - every pre-existing test updated for the reordered chain; new in-box-foul-to-penalty socket walkthrough describe block
- `packages/client/src/components/ActionLog.tsx` - new `PENALTY_KICK_CLEAR_OUT_MOVE` log-formatting case

## Decisions Made

- **PENALTY_SPOT keying confirmed correct, UAT transcription slip documented.** The plan's coordinate contract flagged that 39-UAT test 5's `expected:` line pairs the two penalty spots the wrong way round ("(32,13) for away kicking"). Verified against the existing `PENALTY_SPOT` constant (keyed by the DEFENDING team: `home: {q:4,r:13}` is inside the HOME box, used when AWAY is kicking) and its own doc comment — the existing keying is correct and was NOT changed. This is a one-line write-up error in the UAT document, not a code defect.
- **No `gameHandlers.ts` change was needed for the reorder.** Every penalty-kick socket handler (`GAME_PENALTY_KICK_TAKER`, the `GAME_END_TURN` window-end branches, the `GAME_MOVE` reposition branch) guards on `room.gameState.phase` per-function — none of them assume a fixed ORDER between phases, only that the CURRENT phase matches. Task 3's new integration test proves this by driving the entire reordered chain over real sockets with zero handler edits.
- **ActionLog.tsx DID need a new case.** `pnpm typecheck` failed with TS2366 ("function lacks ending return statement") for `formatEvent` once `PENALTY_KICK_CLEAR_OUT_MOVE` was added to `ActionEventType` — the switch has no `default` branch, so TypeScript's control-flow analysis flagged the gap immediately (unlike its `CORNER_KICK_CLEAR_OUT_MOVE` sibling, which shipped as a runtime crash in Phase 38 before a case was added). Fixed per the plan's explicit "if it does, add the log case in this plan" instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `gameEngine.fouls.test.ts`'s GK-dive-foul phase assertion**

- **Found during:** Task 1 (immediately after rewriting `triggerPenaltyKick`'s target phase)
- **Issue:** `triggerPenaltyKick`'s phase target changed from `PENALTY_KICK_SETUP_ATTACKING` to `PENALTY_KICK_TAKER_SELECT`, breaking a pre-existing, out-of-scope test asserting the old phase
- **Fix:** Updated the single assertion (and its describe-block title) to expect `PENALTY_KICK_TAKER_SELECT`
- **Files modified:** `packages/server/src/__tests__/gameEngine.fouls.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test -- gameEngine.fouls.test.ts` — 27/27 pass
- **Committed in:** `aca0455` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed `gameEngine.undoReplay39.test.ts`'s full GK-dive-to-penalty chain test**

- **Found during:** Task 2 (after reordering `applyPenaltyKickTaker`/`applyPenaltyKickWindowEnd`)
- **Issue:** The chain test drove the OLD step order (windows → taker-select → duel); the reorder made every intermediate phase assertion wrong
- **Fix:** Rewrote the step sequence to TAKER_SELECT → SETUP_ATTACKING → SETUP_DEFENDING → PENALTY_KICK, matching the new engine behavior
- **Files modified:** `packages/server/src/__tests__/gameEngine.undoReplay39.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test -- gameEngine.undoReplay39.test.ts` — 31/31 pass
- **Committed in:** `780a207` (Task 2 commit)

**3. [Rule 2 - Missing critical] Added `PENALTY_KICK_CLEAR_OUT_MOVE` case to `ActionLog.tsx`**

- **Found during:** Task 3 final verification (`pnpm typecheck`)
- **Issue:** The new `ActionEventType` member broke `formatEvent`'s exhaustive switch (TS2366) — a genuine compile-time correctness gap the plan's `<verification>` block explicitly anticipated and pre-authorized fixing in this plan
- **Fix:** Added a log-formatting case modeled on `CORNER_KICK_CLEAR_OUT_MOVE`'s sibling case (minus the `slot` field, since penalty clear-outs have no attacker/defender distinction)
- **Files modified:** `packages/client/src/components/ActionLog.tsx`
- **Verification:** `pnpm typecheck` clean across all 3 packages; `pnpm --filter @counter-attack/client test` — 929/929 pass
- **Committed in:** `2f82379` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 bug fixes directly caused by this plan's own phase-reorder, 1 pre-authorized missing-case fix)
**Impact on plan:** All three were direct, foreseeable consequences of the reorder this plan introduces — no scope creep. The plan's own task ordering (Task 1 → Task 2 → Task 3) meant tests 1 and 2 above lived in a transiently red state between the Task 1 and Task 2 commits (`triggerPenaltyKick`'s new phase target vs. the not-yet-reordered `applyPenaltyKickTaker`); this was expected and resolved within the same plan execution, never left for a future plan.

## Issues Encountered

- **Worktree had no `node_modules`.** A one-time `pnpm install` was required before any test could run (standard pnpm workspace install, not a directory-junction workaround — no risk to the shared content-addressable store).
- **`seedFoulChoiceViaTackleAt`'s background-piece parking initially collided with the away goalkeeper's default lineup position** (parking away pieces at q=5, inside the HOME box, and the away GK's own starting hex landing inside the test triangle), producing an `OCCUPIED` seed failure. Fixed by explicitly repositioning both goalkeepers to dedicated hexes (reusing the file's existing `HOME_GK_HEX`/`AWAY_GK_HEX` constants) and correcting the park-helper's target columns to the middleThird (q=12/13, clear of both penalty areas) before seeding.
- **A stale-position assertion bug in the new full-journey integration test** — the immovable-taker rejection check compared against the taker's PRE-selection position instead of its post-selection position (on the spot). Fixed by capturing the taker's current position from the post-selection broadcast.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 39-UAT gap 5 is closed: in-box tackle/steal fouls award penalties, the goalkeeper auto-places on the goal-line centre, the box clears automatically, the kicker is chosen before repositioning, and neither the kicker, the goalkeeper, nor the box can be touched during it.
- GKDIVE-03's always-penalty rule for GK-dive fouls is preserved and covered by both engine and integration tests.
- The reordered phase chain (`TAKER_SELECT → SETUP_ATTACKING → SETUP_DEFENDING → PENALTY_KICK`) is proven end-to-end over sockets with zero `gameHandlers.ts` changes, so Plan 39-23's kicker-selection UX work can build on a stable, already-correct server contract.
- Full verification green: shared 772 tests, server 1327 tests (1 skipped, 1 todo), client 929 tests — all passing; `pnpm typecheck` clean across all 3 packages; `pnpm --filter @counter-attack/shared build` clean. `pnpm lint` (whole-workspace) still fails on the pre-existing, documented `packages/shared` typescript-eslint file-count-cap issue (STATE.md tech debt, unrelated to this plan) — per-package `eslint` runs for `server`, `client`, and the specific `shared` files this plan touched are all clean.

---

## Self-Check: PASSED

All 9 modified source/test files and the SUMMARY.md itself verified present on disk. All 4 commit hashes (`aca0455`, `780a207`, `2f82379`, `c76e673`) verified present in git history.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-15_
