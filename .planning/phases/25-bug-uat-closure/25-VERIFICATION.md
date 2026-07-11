---
phase: 25-bug-uat-closure
verified: 2026-07-11T00:00:00Z
status: human_needed
score: 11/14
overrides_applied: 0
human_verification:
  - test: 'OFFSIDE-02 UAT — two-tab live free-kick session'
    expected: 'Free-kick step sequence A:choose-kicker → A:move-4 → D:move-4 → A:move-3 → D:move-2 → A:kicks is enforced end-to-end; kicker cannot move twice; Undo greyed out when no placed pieces exist in current stage; Undo cannot cross stage boundaries; blue ring shown on eligible pieces during repositioning stages; End Turn shows orange until move count reached, green after'
    why_human: 'Requires Socket.io two-player session to exercise the full server-authoritative step sequence in live play; unit tests cannot simulate the multi-stage turn flow'
  - test: 'Jersey number centering visual check'
    expected: 'Numbers appear vertically centered in piece circles at R=12 (gameplay board) and R=30 (uniform selection screen); neither too high nor too low across all uniform styles (pinstripe, bar, quarter, plain)'
    why_human: 'SVG baseline attributes have renderer-dependent rendering across browsers; visual judgment required; dy=-0.5 is a heuristic that must be confirmed at actual render time'
  - test: 'Style 12 (quarterHorizontal) symmetric diamond-quarter visual check'
    expected: 'Four diamond-shaped quarters (diamond/✕ pattern) are symmetrically distributed around the piece centre at both R=12 and R=30; each quarter occupies equal area; Style 13 (quarterDiagonal / ╬) is visually unchanged'
    why_human: 'SVG pattern rotation and tile-origin alignment produces visual output only verifiable by eye; automated tests cannot inspect pixel-level symmetry of the rendered SVG pattern'
deferred:
  - truth: 'KICK_OFF_SETUP shot-path hex shading clears correctly after a SNAPSHOT_DEFLECT goal (BUG-23 / ROADMAP SC5)'
    addressed_in: 'Phase 26'
    evidence: "Plan 25-05 SUMMARY explicitly escalated BUG-23 to Phase 26 per D-15: 'BUG-23 does not block v1.3 shipment (low priority, cosmetic)'; Phase 26 will use console.log instrumentation for root-cause investigation"
---

# Phase 25 (Wave 3): Bug UAT Closure — Plans 06-09 Verification Report

**Phase Goal:** Close the Wave 3 gap-closure bugs identified during Plan 25-05 UAT — FREE_KICK_SETUP step sequence (OFFSIDE-02), move counter decrement revert, jersey number centering midpoint, and quarterHorizontal pattern centering.
**Verified:** 2026-07-11
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                              | Status        | Evidence                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | FREE_KICK_SETUP step sequence enforced server-side (A:kicker → A:move-4 → D:move-4 → A:move-3 → D:move-2 → A:kick) | VERIFIED      | `applyFreeKickMove` checks `freeKickKickerChosen === false`; KICKER_PLACEMENT_REQUIRED returned for non-freeKickHex; FK_KICKER_CHOSEN emitted on kicker placement; FK_STAGE_ADVANCE emitted at each inter-stage transition (gameEngine.ts:4058-4087, 4280-4284); FREE_KICK_STAGES stage 0 and 1 max=4 (offside.ts:38-43); triggerOffsideFoul initializes freeKickKickerChosen:false (offside.ts:226) |
| 2   | Kicker selection is distinct from 4-move stage; kicker excluded from all other setup moves                         | VERIFIED      | `freeKickKickerChosen === false` gate blocks all non-freeKickHex placements (gameEngine.ts:4069); kicker locked in `movedPieceIds` via D-54 behavior on kicker placement; subsequent moves use existing stage-gated placement logic with kicker excluded by movedPieceIds membership                                                                                                                 |
| 3   | Undo disabled when no moves in current stage; cannot reach across stage boundaries                                 | VERIFIED      | `applyUndo` boundary scan treats FK_KICKER_CHOSEN and FK_STAGE_ADVANCE as slot boundaries when `state.phase === 'FREE_KICK_SETUP'` (gameEngine.ts:1392-1401); `canUndo` IIFE in ActionPanel.tsx mirrors same boundary pattern (ActionPanel.tsx:250-251); NOTHING_TO_UNDO when current stage has no FK_SETUP_MOVE events after last boundary                                                          |
| 4   | Eligible players show blue ring in FREE_KICK_SETUP when it is their team's stage                                   | VERIFIED      | `isFreeKickEligible` flag in HexGrid.tsx (lines 803-809): checks phase, myFreeKickStageActive, freeKickKickerChosen !== false, piece.teamId === activeTeamForStage, !movedPieceIds, !freeKickPlacedPieceIds; drives `selectionState='selectable'` (blue ring) at line 820-823; ring suppressed during kicker-select sub-step                                                                         |
| 5   | End Turn button yellow (pending) until stage move-count reached, green (ready) after                               | VERIFIED      | FREE_KICK_SETUP block uses `ctaButtonClass(remaining)` (ActionPanel.tsx:713); `ctaButtonClass` returns `ctaButtonPending` when remaining > 0, `ctaButtonReady` when remaining <= 0 (ActionPanel.tsx:43-47)                                                                                                                                                                                           |
| 6   | Eligible 'left to move' counter only decrements when a move is committed, not on piece selection                   | VERIFIED      | `selectedIsMoving` boolean completely absent from ActionPanel.tsx (confirmed grep: no matches); `remaining` formula is `Math.max(slotTotal - currentSlotLockedCount - paceExhaustedNotLocked, 0)` with no selection term (ActionPanel.tsx:938-941)                                                                                                                                                   |
| 7   | Selecting and then deselecting a piece without moving leaves the counter unchanged                                 | VERIFIED      | By corollary: no selection term in `remaining` formula; `selectedPieceId` selector removed from ActionPanel (confirmed grep: no `s.selectedPieceId` in ActionPanel.tsx)                                                                                                                                                                                                                              |
| 8   | Undo button is disabled at the start of a MOVE slot when no moves have been committed                              | VERIFIED      | `Object.keys(paceUsedByPieceId).length === 0` early-return guard in `canUndo` IIFE for MOVE / FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE phases (ActionPanel.tsx:239-243); paceUsedByPieceId is reset server-side at each slot boundary                                                                                                                                                                    |
| 9   | Undo button re-enables once the first move is committed in the current slot                                        | VERIFIED      | Same guard: enabled when `Object.keys(paceUsedByPieceId).length > 0`; paceUsedByPieceId entry created on first move commit                                                                                                                                                                                                                                                                           |
| 10  | Jersey numbers appear visually centered in the piece circle at R=12 and R=30                                       | ? NEEDS HUMAN | Code: `dominantBaseline="central"` restored (from "middle") + `dy="-0.5"` added (PieceOverlay.tsx:257-259); no `dominantBaseline="middle"` remains; TypeScript clean. Visual outcome is renderer-dependent — requires browser confirmation                                                                                                                                                           |
| 11  | Centering fix confirmed across multiple piece styles and zoom levels                                               | ? NEEDS HUMAN | Same code change; visual judgment required across all uniform styles                                                                                                                                                                                                                                                                                                                                 |
| 12  | Style 12 (quarterHorizontal) renders four symmetric diamond quarters at R=12 and R=30                              | ? NEEDS HUMAN | Code: pattern origin changed from `x={0} y={0}` to `x={cx - R} y={cy - R}` (uniformStyles.tsx:411-412); `patternTransform` unchanged; mirrors quarterDiagonal anchor. Visual symmetry requires browser confirmation                                                                                                                                                                                  |
| 13  | Style 13 (quarterDiagonal) is unchanged and renders correct axis-aligned quarters                                  | VERIFIED      | quarterDiagonal still uses `x={cx - R}` `y={cy - R}` (uniformStyles.tsx:438-439); no modifications to this function or its pattern content                                                                                                                                                                                                                                                           |
| 14  | No other uniform style renderers modified in Plans 08/09                                                           | VERIFIED      | Plan 09 SUMMARY: "No other style renderers touched"; git commits 5eb5ed5 and 799a9c3 each touch exactly one file (PieceOverlay.tsx and uniformStyles.tsx respectively)                                                                                                                                                                                                                               |

**Score:** 11/14 truths code-verified; 3 require human visual/UAT verification

---

### Deferred Items

Items not yet met but explicitly addressed in later phases per plan decisions.

| #   | Item                                                                            | Addressed In | Evidence                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | BUG-23: KICK_OFF_SETUP shot-path hex shading clears after SNAPSHOT_DEFLECT goal | Phase 26     | Plan 25-05 SUMMARY: "BUG-23 does not block v1.3 shipment (low priority, cosmetic)" — escalated to Phase 26 for console.log instrumentation root-cause investigation per D-15 |

---

### Required Artifacts

| Artifact                                          | Expected                                                                                                                                           | Status   | Details                                                                                                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts`                    | `freeKickKickerChosen?: boolean\|null` field; FK_KICKER_CHOSEN and FK_STAGE_ADVANCE event types                                                    | VERIFIED | Lines 99-100 (event type union), lines 366/373 (ActionEvent shapes), line 742 (GameState field)                                                                                                            |
| `packages/shared/src/offside.ts`                  | FREE_KICK_STAGES stage 0 and 1 max=4; triggerOffsideFoul initializes freeKickKickerChosen:false                                                    | VERIFIED | Lines 38-43 (FREE_KICK_STAGES), line 226 (freeKickKickerChosen: false in triggerOffsideFoul)                                                                                                               |
| `packages/server/src/gameEngine.ts`               | applyFreeKickMove kicker-select enforcement; FK_KICKER_CHOSEN/FK_STAGE_ADVANCE emitted; applyUndo FK boundary scan                                 | VERIFIED | Lines 4058-4087 (kicker-select), line 4076 (FK_KICKER_CHOSEN), lines 4280-4284 (FK_STAGE_ADVANCE), lines 1392-1401 (applyUndo boundary)                                                                    |
| `packages/client/src/components/ActionPanel.tsx`  | Dedicated FREE_KICK_SETUP render block before !isActivePlayer guard; canUndo FK boundary events; selectedIsMoving removed; paceUsedByPieceId guard | VERIFIED | Lines 654-723 (FREE_KICK_SETUP block, before !isActivePlayer at line 725); lines 239-243 (paceUsedByPieceId guard); lines 250-251 (FK boundary in canUndo); no selectedIsMoving or s.selectedPieceId found |
| `packages/client/src/components/HexGrid.tsx`      | freeKickKickerChosen selector; isFreeKickEligible flag driving selectionState='selectable'                                                         | VERIFIED | Line 91 (freeKickKickerChosen selector), lines 803-823 (isFreeKickEligible logic and selectionState assignment)                                                                                            |
| `packages/client/src/components/PieceOverlay.tsx` | Jersey number `<text>` with dominantBaseline="central" + dy="-0.5"                                                                                 | VERIFIED | Lines 257-259: `dy="-0.5"` and `dominantBaseline="central"` present; no `dominantBaseline="middle"` found                                                                                                  |
| `packages/client/src/styles/uniformStyles.tsx`    | quarterHorizontal `<pattern>` x={cx - R} y={cy - R}                                                                                                | VERIFIED | Lines 411-412: `x={cx - R}` and `y={cy - R}` confirmed in quarterHorizontal function                                                                                                                       |

---

### Key Link Verification

| From                                   | To                                          | Via                                                       | Status | Details                   |
| -------------------------------------- | ------------------------------------------- | --------------------------------------------------------- | ------ | ------------------------- |
| `triggerOffsideFoul`                   | `freeKickKickerChosen: false` initial state | offside.ts return spread                                  | WIRED  | offside.ts:226            |
| `FK_STAGE_ADVANCE` in eventLog         | undo boundary in applyUndo                  | `lastSlotAdvanceIdx` boundary scan                        | WIRED  | gameEngine.ts:1392-1401   |
| `FK_KICKER_CHOSEN` in eventLog         | undo boundary in canUndo                    | ActionPanel.tsx `lastBoundaryIdx` reduce                  | WIRED  | ActionPanel.tsx:250-251   |
| `paceUsedByPieceId` non-empty          | `canUndo` enabled in MOVE slot              | `Object.keys(...).length === 0` guard                     | WIRED  | ActionPanel.tsx:239-243   |
| `PieceOverlay` jersey number `<text>`  | Vertically centered number                  | `dominantBaseline="central"` + `dy="-0.5"`                | WIRED  | PieceOverlay.tsx:257-259  |
| `quarterHorizontal` pattern x/y origin | Symmetric diagonal quarter rendering        | `x={cx - R}` `y={cy - R}` matching quarterDiagonal anchor | WIRED  | uniformStyles.tsx:411-412 |

---

### Data-Flow Trace (Level 4)

N/A — Wave 3 changes are game-logic enforcement, UI state derivation, and SVG rendering presentation. No external data sources. All data flows from Zustand store (client) and GameState (server) which are established infrastructure. No new disconnected props or hollow data paths introduced.

---

### Behavioral Spot-Checks

| Behavior                                               | Command                                                                                    | Result                                                             | Status |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------ |
| FK_KICKER_CHOSEN event type in ActionEvent union       | `grep -q "FK_KICKER_CHOSEN" packages/shared/src/types.ts`                                  | Match at lines 99, 366                                             | PASS   |
| FK_STAGE_ADVANCE event type in ActionEvent union       | `grep -q "FK_STAGE_ADVANCE" packages/shared/src/types.ts`                                  | Match at lines 100, 373                                            | PASS   |
| FREE_KICK_STAGES stage 0 max=4                         | Read offside.ts lines 38-43                                                                | `{ side: 'kicking', max: 4 }`                                      | PASS   |
| selectedIsMoving removed from ActionPanel              | `grep -q "selectedIsMoving" packages/client/src/components/ActionPanel.tsx`                | No matches                                                         | PASS   |
| dominantBaseline="middle" absent from PieceOverlay     | `grep -q 'dominantBaseline="middle"' packages/client/src/components/PieceOverlay.tsx`      | No matches                                                         | PASS   |
| quarterHorizontal uses cx-R anchor                     | `grep -A 8 "id=.*qh-" packages/client/src/styles/uniformStyles.tsx \| grep "cx - R"`       | Match at line 411                                                  | PASS   |
| FreeKickSetupPanel tests updated for max=4             | `grep "4 players\|4 remaining" packages/client/src/components/FreeKickSetupPanel.test.tsx` | Matches at lines 78, 85, 100                                       | PASS   |
| All 10 commit hashes from Plans 06-09 exist in git log | `git log --oneline`                                                                        | All 10 commits (56a4927 through 799a9c3 + test/docs fixes) present | PASS   |

---

### Probe Execution

Step 7c: SKIPPED — No `scripts/*/tests/probe-*.sh` files found and phase does not declare probe-based verification.

---

### Requirements Coverage

| Requirement | Source Plan(s)                                     | Description                                             | Status    | Evidence                                                                                                                                                                                                                                     |
| ----------- | -------------------------------------------------- | ------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OFFSIDE-01  | 25-05 (UAT)                                        | Two-tab live UAT closure — offside detection            | SATISFIED | Plan 05 SUMMARY: `requirements-completed: [OFFSIDE-01]`; "All three offside detection scenarios confirmed correct"                                                                                                                           |
| OFFSIDE-02  | 25-06 (code)                                       | Two-tab live UAT closure — free-kick restart            | PARTIAL   | Code implementation VERIFIED (Plan 06 — all artifacts and key links wired); UAT of new step-sequence code not yet done; NEEDS HUMAN UAT to formally close                                                                                    |
| REPLAY-07   | 25-01 (code)                                       | GK_KICK ball delivery visible in replay                 | SATISFIED | `ballAfter` field on GK_KICK ActionEvent (types.ts:303-311); GK_KICK in REPLAY_ELIGIBLE_TYPES (gameEngine.ts:4433); WARNING: REQUIREMENTS.md traceability table still shows Pending (documentation gap — should be Complete)                 |
| REPLAY-08   | 25-01 (code)                                       | LOOSE_BALL_LAND ball delivery visible in replay         | SATISFIED | `ballAfter` field on LOOSE_BALL_LAND ActionEvent (types.ts:296-301); LOOSE_BALL_LAND in REPLAY_ELIGIBLE_TYPES (gameEngine.ts:4436); WARNING: REQUIREMENTS.md traceability table still shows Pending (documentation gap — should be Complete) |
| BUG-22      | 25-01 (docs)                                       | HIGH_PASS_MOVE excludes highPassCarrierId               | SATISFIED | Already Complete in REQUIREMENTS.md (fix shipped Phase 18.2); Plan 01 closed checkbox                                                                                                                                                        |
| BUG-23      | 25-02 (code attempt), 25-05 (UAT found unresolved) | KICK_OFF_SETUP shot-path shading after SNAPSHOT_DEFLECT | DEFERRED  | Plan 05 UAT confirmed guards did not fix root cause; explicitly escalated to Phase 26 per D-15; REQUIREMENTS.md correctly shows Pending                                                                                                      |
| UX-15       | 25-02/03/04 (Wave 1) + 25-07/08/09 (Wave 3)        | UX streamlining — various sub-items                     | PARTIAL   | Code items done; visual sub-items (jersey centering, Style 12) need human visual confirmation; REQUIREMENTS.md shows Pending                                                                                                                 |

**Orphaned requirements check:** All 7 Phase 25 requirement IDs appear in plan frontmatter fields. No orphaned requirements found.

**ROADMAP Success Criteria Check (Phase 25):**

| SC# | Criterion                                 | Status                                                               |
| --- | ----------------------------------------- | -------------------------------------------------------------------- |
| SC1 | OFFSIDE-01 UAT closed                     | VERIFIED — Plan 05 human UAT passed                                  |
| SC2 | OFFSIDE-02 UAT closed                     | NEEDS HUMAN — Plan 06 code implemented; UAT of new code not yet done |
| SC3 | GK_KICK + LOOSE_BALL_LAND replay visible  | VERIFIED — ballAfter + REPLAY_ELIGIBLE_TYPES confirmed in code       |
| SC4 | HIGH_PASS_MOVE carrier exclusion (BUG-22) | VERIFIED — Phase 18.2 fix, documented                                |
| SC5 | BUG-23 shot-path shading cleared          | DEFERRED — Explicitly escalated to Phase 26 per D-15 plan decision   |

---

### Anti-Patterns Found

| File                           | Line | Pattern                                                                                                            | Severity | Impact                                                                                                                          |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts` | 715  | Stale JSDoc: "up to 5" for stage 0 and stage 1 — should be "up to 4" after Plan 25-06 reduced FREE_KICK_STAGES max | Warning  | Developer reading the GameState type to understand the free-kick budget will see the wrong cap; identified in code review WR-03 |

No TBD, FIXME, or XXX markers found in any of the 6 files modified by Plans 06-09.

**Pre-existing code review findings (in files modified by Plan 06, but not introduced by Plan 06):**

- CR-01 (gameEngine.ts:184-218): `computeAutoAssignment` silently casts `null` GK slot to `PoolPlayer[]` via type assertion — pre-existing, not in free-kick code area
- CR-02 (gameEngine.ts:806-811): `applyMove` STEAL_ATTEMPT unguarded `defenders[0]!.id` non-null assertion — pre-existing, not in free-kick code area

These are noted for completeness; they are not introduced by Plans 06-09 and are tracked in 25-REVIEW.md.

---

### Human Verification Required

#### 1. OFFSIDE-02 UAT — Free-Kick Step Sequence Live Session

**Test:** Open two browser tabs on the local dev server. Trigger an offside foul in live two-player play. Verify the following sequence in order:

1. Kicking team is prompted "Free Kick — Select Kicker" in ActionPanel; no other action is available
2. Kicking team clicks a player and moves them to the ball hex — kicker is confirmed and locked
3. ActionPanel transitions to "Free Kick Setup — Attacking Team" showing "4 of 4 players left to reposition"
4. Kicking team repositions up to 4 players (NOT the kicker); Undo works within-stage only
5. After Undo is attempted with no placed pieces in stage → Undo is greyed out
6. "End Turn" shows orange until count reaches 0, then green; click advances to defending team
7. Defending team repositions up to 4 players; Undo cannot undo attacking team's moves
8. Sequence continues: A:move-3 → D:move-2 → free-kick execution

**Expected:** All 8 steps pass without errors; Undo gates work as described; stage boundaries respected.

**Why human:** Socket.io two-player session required; multi-stage turn flow cannot be exercised in unit tests.

---

#### 2. Jersey Number Centering Visual Check

**Test:** Load the game in a browser. Open the uniform selection screen (shows pieces at R=30). Verify that jersey numbers appear vertically centered within the piece circles. Then start a match and view the playing board (R=12). Check multiple uniform styles (pinstripe, bar, quarterHorizontal, plain).

**Expected:** Numbers are neither obviously too high nor too low — visually sit at the center of the circle. The dy="-0.5" nudge from "central" baseline should place them at the visual midpoint between the "too low" (original) and "too high" (Plan 25-02 "middle" baseline) positions.

**Why human:** SVG baseline attributes interact with font metrics in a browser-renderer-specific way; dy="-0.5" is a heuristic approximation; pixel-level centering requires visual judgment.

---

#### 3. Style 12 (quarterHorizontal) Symmetric Diamond Quarter Visual Check

**Test:** On the uniform selection screen, view Style 12 (quarterHorizontal). Verify that four diamond-shaped sections (✕ pattern) are symmetrically distributed around the piece centre — each diamond occupies equal area and the seam passes through the centre. Also verify Style 13 (quarterDiagonal / ╬) is visually unchanged.

**Expected:** Style 12 shows symmetric ✕ pattern. Style 13 shows symmetric ╬ pattern (unchanged).

**Why human:** SVG pattern tile rotation with `patternTransform="rotate(45 cx cy)"` and `patternUnits="userSpaceOnUse"` produces visual output that requires eye inspection; pixel-level symmetry cannot be asserted in automated SVG tests.

---

### Gaps Summary

No automated gaps found. All code artifacts are substantive, wired, and functional. Three items require human visual/UAT verification before the phase can be formally closed:

1. OFFSIDE-02 human UAT (two-tab live session for the new step-sequence code)
2. Jersey number centering visual confirmation
3. Style 12 symmetric diamond quarter visual confirmation

One item is deferred by plan decision: BUG-23 escalated to Phase 26.

Two documentation maintenance gaps exist (not code gaps):

- REQUIREMENTS.md traceability table shows OFFSIDE-01, REPLAY-07, REPLAY-08 as Pending despite being completed by Plans 01 and 05 respectively. These should be updated to Complete.

---

_Verified: 2026-07-11_
_Verifier: Claude (gsd-verifier)_
