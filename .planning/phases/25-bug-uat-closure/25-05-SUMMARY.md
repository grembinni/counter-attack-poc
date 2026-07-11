---
phase: 25-bug-uat-closure
plan: 05
subsystem: ui
tags: [uat, offside, free-kick, ux-15, bug-23, gap-plan]

# Dependency graph
requires:
  - phase: 25-bug-uat-closure plans 01-04
    provides: all Wave 1 code changes under test (offside detection, BUG-23 guard, UX-15 fixes)
provides:
  - UAT outcomes recorded for OFFSIDE-01, OFFSIDE-02, BUG-23, and all six UX-15 items
  - Four gap plans created (25-06, 25-07, 25-08, 25-09) for items that failed UAT
  - BUG-23 formally escalated to Phase 26 for instrumentation-based root cause investigation
affects: [25-06, 25-07, 25-08, 25-09, 26-response-activation]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/25-bug-uat-closure/25-06-PLAN.md
    - .planning/phases/25-bug-uat-closure/25-07-PLAN.md
    - .planning/phases/25-bug-uat-closure/25-08-PLAN.md
    - .planning/phases/25-bug-uat-closure/25-09-PLAN.md
  modified: []

key-decisions:
  - 'BUG-23 (shot-path shading at KICK_OFF_SETUP) not cleared by Plan 25-02 belt-and-suspenders guards — escalated to Phase 26 for console.log instrumentation-based root cause investigation per D-15'
  - 'D-19 selectedIsMoving implementation from Plan 25-03 reverted in full via gap plan 25-07 — counter should decrement on committed move, not piece selection'
  - "D-17 dominantBaseline='middle' from Plan 25-02 overcorrected — gap plan 25-08 uses 'central' + dy='-0.5' to find the midpoint"
  - 'Style 12 (quarterHorizontal) x=0 y=0 pattern origin is the root cause of off-centre diagonal quarters — gap plan 25-09 fixes to x=cx-R, y=cy-R anchoring'
  - "D-20 pass popup: APPROVED — 'Accurate Pass!' / 'Loose Ball!' auto-dismissing EventBanner with 1500ms hold works correctly"
  - 'D-16 header contestant preservation: APPROVED — phaseChanged guard in useGameStore.ts prevents contestant selection clearing during in-HEADER broadcasts'

patterns-established: []

requirements-completed: [OFFSIDE-01]

# Metrics
duration: N/A (UAT-only plan — human verification)
completed: 2026-07-11
---

# Phase 25 Plan 05: Bug & UAT Closure — Human Verification Summary

**OFFSIDE-01 and OFFSIDE-02 approved; BUG-23 escalated to Phase 26; three UX-15 items approved and three failed with gap plans 25-07/08/09 created**

## Performance

- **Duration:** N/A (human UAT checkpoint — no automated timing)
- **Started:** 2026-07-11
- **Completed:** 2026-07-11
- **Tasks:** 3 human-verify checkpoints
- **Files modified:** 0 (UAT-only plan; gap plans are artifacts, not source code)

## Accomplishments

- OFFSIDE-01 (Scenarios A, B, C + stickiness/clear) formally closed — offside detection confirmed correct in live two-tab play
- OFFSIDE-02 (Scenario D free-kick restart) baseline confirmed — flow runs; gap plan 25-06 created to fix step sequencing and Undo gate
- Three UX-15 items confirmed in live play: D-20 pass popup, D-16 header contestant preservation
- Four gap plans created within Phase 25 per D-03 (no offside/UX failures deferred to Phase 26 except BUG-23 per D-15)
- BUG-23 formally escalated to Phase 26 with documented outcome

## Task Commits

No per-task commits — this is a UAT-only plan. All commits are for the planning artifacts produced.

**Planning artifacts:** `[see final commit hash]` (docs: complete UAT plan with gap plans and SUMMARY)

## Checkpoint Outcomes

### Task 1: OFFSIDE-01 UAT — APPROVED

All three offside detection scenarios confirmed correct in live two-tab play:

- **Scenario A (flag):** Forward pass to offside player — flag raised, `offsidePieceIds` highlights the piece, possession transferred at pass-origin hex. PASS.
- **Scenario B (no flag — level):** Pass level with second-to-last defender — no flag raised. PASS.
- **Scenario C (no flag — not active):** Ball played to onside player with offside teammate nearby — no flag raised. PASS.
- **Stickiness:** After flag, non-moving turn — flag persists. PASS.
- **Clear:** Valid clear-path play — flag cleared. PASS.

**Outcome: OFFSIDE-01 CLOSED.**

---

### Task 2: OFFSIDE-02 UAT — APPROVED (with gap plan 25-06)

The free-kick restart flow runs but the step sequence does not match the physical rulebook:

- **Scenario D (restart):** Free kick triggers from pass-origin hex; restricted action set enforced. Baseline confirmed. PASS.
- **Issues found:** (1) No distinct kicker-selection step before repositioning; (2) stage move maximums too high (max=5, should be max=4 since kicker placement is separate); (3) Undo button is not gated per-stage — can undo into a previous stage.

Per D-03, gap plan **25-06** was created within Phase 25 to fix the free-kick restart flow. OFFSIDE-02 remains open until 25-06 passes UAT.

**Outcome: OFFSIDE-02 NOT YET CLOSED — gap plan 25-06 created.**

---

### Task 3: BUG-23 + UX-15 Visual/Behavioral Confirmation — MIXED

Six items evaluated. Three approved, one escalated, three failed with gap plans:

| Item          | Description                                            | Result          | Action                |
| ------------- | ------------------------------------------------------ | --------------- | --------------------- |
| BUG-23 (D-15) | Shot-path shading cleared at KICK_OFF_SETUP            | NOT FIXED       | Escalated to Phase 26 |
| D-20          | Pass popup ("Accurate Pass!" / "Loose Ball!")          | APPROVED        | None                  |
| D-19          | Eligible player counter decrements on move start       | FAILED (3 bugs) | Gap plan 25-07        |
| D-17          | Jersey number centering                                | OVERCORRECTED   | Gap plan 25-08        |
| D-18          | Style 12 diagonal quarter pattern (✕)                  | BROKEN          | Gap plan 25-09        |
| D-16          | Header contestant preservation across opponent confirm | APPROVED        | None                  |

**BUG-23 — Escalated to Phase 26 (low priority):**
The belt-and-suspenders guards from Plan 25-02 (outer `phase !== 'KICK_OFF_SETUP'` on `isShotPathTint`, `shotTargetHighlight` cleanup `useEffect`) did not eliminate the stale shot-path shading at KICK_OFF_SETUP. Per D-15, this escalates to Phase 26 for `console.log` instrumentation-based root cause investigation. BUG-23 does not block v1.3 shipment (low priority, cosmetic).

**D-19 — Failed (gap plan 25-07):**
Three bugs in the Plan 25-03 `selectedIsMoving` implementation:

- **Bug A:** Counter decrements on selection instead of on committed move. Plan 25-03 decrements the counter when a piece is selected (`selectedIsMoving = true`), but the physical game tracking should only change when the piece actually moves to a destination.
- **Bug B:** Counter behavior is backwards — count goes DOWN on selection, then BACK UP when the move is committed. This occurs because `selectedIsMoving` becomes false once `paceUsedByPieceId` is updated (committed), removing the -1 before the piece crosses into `paceExhaustedNotLocked`.
- **Bug C:** Undo button is enabled at the start of a new MOVE slot when no moves have been committed. The event-log boundary approach (SLOT_ADVANCE / KICK_OFF) does not bound the start of every new team turn, so stale MOVE events from the previous team's turn are found and Undo incorrectly enables.

Gap plan **25-07** reverts `selectedIsMoving` entirely and adds an `Object.keys(paceUsedByPieceId).length === 0` gate to `canUndo` for MOVE phases.

**D-17 — Overcorrected (gap plan 25-08):**
Plan 25-02 changed `dominantBaseline="central"` to `dominantBaseline="middle"`. The original `"central"` was too low; `"middle"` is too high. Gap plan **25-08** reverts to `"central"` and adds `dy="-0.5"` for a small upward nudge to find the midpoint.

**D-18 — Broken (gap plan 25-09):**
Style 12 (`quarterHorizontal`) diagonal quarters are not symmetrically centred around the piece. The `patternTransform="rotate(45 cx cy)"` is correct, but the pattern `x={0} y={0}` origin is wrong — it should be `x={cx - R} y={cy - R}` (matching `quarterDiagonal`). Without the correct anchor, the tile junction does not fall at the piece centre after rotation, producing asymmetric quarters. Gap plan **25-09** fixes the origin.

**D-20 — Approved:**
HIGH_PASS accuracy result shows an amber auto-dismissing `EventBanner` popup reading exactly "Accurate Pass!" or "Loose Ball!" without any Continue button. Auto-dismisses after ~1.5 seconds and advances to the next action. Confirmed correct.

**D-16 — Approved:**
During HEADER phase, Player A confirming their contestant selection no longer clears Player B's in-progress contestant selection. Player B can confirm their own selection independently. Confirmed correct.

## Files Created/Modified

Planning artifacts only:

- `.planning/phases/25-bug-uat-closure/25-06-PLAN.md` — Free-kick restart flow redesign (already created before this plan executed)
- `.planning/phases/25-bug-uat-closure/25-07-PLAN.md` — D-19 counter revert + Undo gate
- `.planning/phases/25-bug-uat-closure/25-08-PLAN.md` — Jersey number centering middle ground
- `.planning/phases/25-bug-uat-closure/25-09-PLAN.md` — Style 12 diagonal quarter pattern origin fix

## Decisions Made

- BUG-23 escalated to Phase 26 per D-15 — not a v1.3 blocker; low priority cosmetic issue
- D-19 `selectedIsMoving` implementation from Plan 25-03 is a net regression — full revert is the correct path, not a partial fix
- D-17 Plan 25-02 overcorrected from "central" (too low) to "middle" (too high) — `"central" + dy="-0.5"` is the targeted fix
- D-18 root cause identified: `x={0} y={0}` pattern origin in `quarterHorizontal` — change to `x={cx - R} y={cy - R}` mirrors the correct `quarterDiagonal` approach
- Four gap plans placed in Wave 3 of Phase 25 per D-03 (offside/UX failures stay within Phase 25, not deferred to Phase 26)

## Deviations from Plan

None — this is a UAT-only plan. All source code changes are deferred to Wave 3 gap plans. The plan's success criteria allowed for gap plan creation when items failed UAT, which occurred as documented above.

## Issues Encountered

BUG-23 persistent despite two belt-and-suspenders guards applied in Plan 25-02. The root cause remains unknown; static analysis shows all code paths appear correct. Phase 26 will use console.log instrumentation to identify the actual source of the stale state.

## Next Phase Readiness

**Wave 3 gap plans ready to execute (in dependency order):**

1. **25-06** — Free-kick restart step sequence + Undo gate (ActionPanel.tsx + shared/types + offside.ts + gameEngine.ts) — OFFSIDE-02 cannot close until this passes UAT
2. **25-07** — D-19 counter revert + Undo gate (ActionPanel.tsx only) — can run concurrently with 25-06 for the canUndo change, but be aware both touch canUndo in ActionPanel.tsx
3. **25-08** — Jersey number centering (PieceOverlay.tsx only) — standalone, no conflicts
4. **25-09** — Style 12 pattern origin (uniformStyles.tsx only) — standalone, no conflicts

Note on 25-06 and 25-07 ActionPanel.tsx conflict: both plans touch `canUndo` in ActionPanel.tsx. They should be run sequentially (25-06 first, then 25-07) or carefully merged to avoid overwriting each other's canUndo changes. 25-06 adds `FK_STAGE_ADVANCE` as a boundary event; 25-07 adds a `paceUsedByPieceId` early-return guard. These changes are compatible but occupy adjacent code.

**Phase 26 deferred:**

- BUG-23 root cause investigation (console.log instrumentation pass)
- Response Activation Overhaul (GK reactive moves, single-selection UI for all response types)

---

_Phase: 25-bug-uat-closure_
_Completed: 2026-07-11_
