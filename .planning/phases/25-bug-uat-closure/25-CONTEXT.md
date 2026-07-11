# Phase 25: Bug & UAT Closure - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase closes all open items before the v1.3 milestone ships. No new game features are added. Work is a mix of UAT closures, code fixes, and small UX changes surfaced during v1.3 playtesting.

Deliverables:

1. **OFFSIDE-01/02 UAT closure** — Two-tab live play verification for offside detection and free-kick restart. Code exists since Phase 17. Human UAT checkpoint was never closed.
2. **BUG-22 documentation closure** — `highPassCarrierId` exclusion fix was implemented in Phase 18.2. The requirement checkbox was never updated. No code changes needed.
3. **REPLAY-07/08 code fix** — `GK_KICK` and `LOOSE_BALL_LAND` action events are missing a `ballAfter` field and are excluded from `REPLAY_ELIGIBLE_TYPES`. Ball appears to teleport during post-game replay.
4. **BUG-23 speculative fix** — KICK_OFF_SETUP hexes matching the prior shot path retain a faint shading. Root cause unknown despite exhaustive static analysis. Apply belt-and-suspenders guard and verify with UAT.
5. **UX-15 bug fixes** — Three small bugs from v1.3 playtesting: uniform selection state cleared on opponent confirmation; player number SVG text positioned too low on pieces; Style 12 jersey pattern incorrect.
6. **UX-15 UX changes** — Two UX improvements from v1.3 playtesting: eligible-player move counter should trigger on move start (not full activation), including undo support; pass accuracy result (accurate/loose ball) shown as auto-popup notification rather than push-button confirmation.

**Deferred to Phase 26 (Response Activation Overhaul):**

- GK reactive 1-hex move when ball enters the penalty box
- GK reactive 1-hex move before a save attempt on an outside-box shot
- Full response activation cleanup: single-selection UI for all response types (header, deflect, final third, dive, keeper ball in box); range-in-white for all; challenge penalty display per hex; range-based eligibility filtering; auto-reposition keeper during final third response; log when no eligible players in range

After Phase 25 ships, v1.3 is complete.

</domain>

<decisions>
## Implementation Decisions

### OFFSIDE-01 & OFFSIDE-02 — UAT Closure

- **D-01:** Both requirements are pure UAT closures — no code changes are planned. The Phase 17 implementation is assumed correct until UAT contradicts it.
- **D-02:** UAT pass criteria (two-tab live play):
  - **Scenario A (flag):** Forward pass to a teammate who is behind the second-to-last defender at the moment of ball contact — expect offside flag, `offsidePieceIds` highlights the flagged player, possession transferred at the pass origin hex.
  - **Scenario B (no flag — level):** Pass played level with the second-to-last defender — expect no flag.
  - **Scenario C (no flag — not active):** Player in offside position but ball played to a different player — expect no flag.
  - **Scenario D (restart):** After offside flag, opponent takes free kick from the pass origin; verify restricted action set (free kick only, no normal move).
  - All four scenarios must pass without bugs for OFFSIDE-01 and OFFSIDE-02 to close.
- **D-03:** If any bug surfaces during UAT, create a gap plan within Phase 25 to fix it. Do not defer offside bugs to Phase 26.

### BUG-22 — Documentation Closure

- **D-04:** `carrierExclusionKey: 'highPassCarrierId'` is live in `gameHandlers.ts:405` and covered by `gameHandlers.phase18-02.test.ts`. This bug was fixed in Phase 18.2.
- **D-05:** Phase 25 Plan 01 updates the `BUG-22` requirement checkbox in `REQUIREMENTS.md` to `[x]` and adds a note pointing to the Phase 18.2 fix. No code changes. No new tests needed (existing Phase 18.2 tests cover it).

### REPLAY-07 & REPLAY-08 — Fix Scope

- **D-06:** Both defects are fixed in a single plan. They are the same defect class (missing `ballAfter` + excluded from `REPLAY_ELIGIBLE_TYPES`) and the fix pattern is identical.
- **D-07:** `GK_KICK` type fix: add `ballAfter: { position: HexCoord; carrierId: string | null }` to the `GK_KICK` ActionEvent definition in `packages/shared/src/types.ts`. The `ballAfter.position` is the target hex where the ball lands after the kick; `carrierId` is the player who takes possession (or `null` for a loose ball).
- **D-08:** `LOOSE_BALL_LAND` type fix: add the same `ballAfter` field. `ballAfter.position` = the `to` hex (landing position); `carrierId` = whoever takes possession.
- **D-09:** Both `gameHandlers.ts` construction sites (accurate and inaccurate branches) for each event must populate `ballAfter` with the resolved position/carrier at the time of construction. Do not leave `ballAfter` as a null placeholder.
- **D-10:** Add both `'GK_KICK'` and `'LOOSE_BALL_LAND'` to `REPLAY_ELIGIBLE_TYPES` in `gameEngine.ts`. Add separate inline comments explaining why each is included (do not bundle them under a shared comment — this was the root cause of the Phase 18.1 "dead code" mistake).
- **D-11:** The incorrect "dead code" comment near `REPLAY_ELIGIBLE_TYPES` (which says `GK_KICK` has "zero construction sites") must be removed or replaced with the correct explanation.
- **D-12:** Add regression tests mirroring the `HEADED_PASS`/`GK_PUNT` visibility cases in `replay.integration.test.ts` — one test each for `GK_KICK` and `LOOSE_BALL_LAND` replay frame visibility.

### BUG-23 — Speculative Fix Approach

- **D-13:** Root cause was not identified through static analysis (see todo file for full writeup). The code appears correct: all server paths clear `lastShotPath: null` before KICK_OFF_SETUP; all `isShotPathTint` sub-conditions are provably false during KICK_OFF_SETUP.
- **D-14:** Apply two fixes in the client as belt-and-suspenders measures:
  - **Fix 1:** Broaden the `isShotPathTint` guard in `HexGrid.tsx` to gate the entire expression on `phase !== 'KICK_OFF_SETUP'` (not just the `lastShotPath` sub-clause):
    ```typescript
    const isShotPathTint =
      phase !== 'KICK_OFF_SETUP' &&
      (lastShotPathSet.has(hexId) ||
        isHpMoveTarget ||
        isGKDiveTarget ||
        isShotPath ||
        highPassContestZoneSet.has(hexId));
    ```
  - **Fix 2:** Clear `shotTargetHighlight` (a React `useState<HexCoord | null>` in `HexGrid.tsx` that is never cleared) when phase transitions to `KICK_OFF_SETUP`. This produces a stale red tint on the prior goal-target hex and has been flagged as a separate issue.
- **D-15:** After applying both fixes, reproduce the SNAPSHOT_DEFLECT → goal → KICK_OFF_SETUP scenario in two-tab UAT. If shading is gone, BUG-23 closes. If it persists, escalate to Phase 26 for `console.log` instrumentation-based root cause investigation.

### UX-15 Bug Fixes

- **D-16:** **Header contestant selection cleared on opponent confirm:** During the HEADER phase, when Player A confirms their contestant selection (`GAME_HEADER_CONTESTANT`), Player B's in-progress `headerContestantIds` is cleared. Root cause: `useGameStore.ts` state-update handler clears `headerContestantIds: []` whenever `prevSelectedId === null`, which is always true in HEADER phase because contestant selection uses `toggleHeaderContestant` (not `selectedPieceId`). Fix: gate the `headerContestantIds` reset on `phaseChanged` so it only clears on genuine phase transitions, not on in-HEADER broadcasts.
- **D-17:** **Player number too low on piece:** The jersey number `<text>` element in the SVG piece renderer is fractionally misaligned vertically. Fix by adjusting `dominantBaseline="central"` or adding a small `dy` offset. Target: number visually centered in the piece circle. Verify across multiple piece styles and zoom levels.
- **D-18:** **Style 12 piece pattern incorrect:** Style 13 = quarters divided horizontally + vertically (cross/plus axis, like ╬). Style 12 should use the same quarter-division but rotated 45° (diagonal axis, like ✕). Fix the SVG pattern/path in the piece style renderer for style index 12.

### UX-15 UX Changes

- **D-19:** **Eligible player counter on move start:** The "X players left to move" message and the green ready-button state currently update when a player's move is fully committed. Change: the counter should decrement (and button state update) when the player selects a piece to move (move starts), not when the destination is confirmed. The original count is restored on undo. This matches how the physical game is tracked.
- **D-20:** **Pass result as popup notification:** For any kick/pass that uses high-pass skill for accuracy (HIGH_PASS, HIGH_PASS_MOVE), the current "Accurate / Loose Ball" push-button confirmation is removed. Replace with an auto-advancing popup notification — styled like the existing turnover notification — that reads "ACCURATE PASS!" or "LOOSE BALL!" and auto-dismisses after a brief pause (1.5–2 seconds), then advances to the next action. No player input required. This removes an unnecessary click and keeps match flow smooth.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Offside Implementation (Phase 17)

- `packages/server/src/gameEngine.ts` — `evaluateOffside` function and `offsidePieceIds` state field; Phase 17 implementation
- `.planning/phases/17-rule-bugs/17-CONTEXT.md` — D-22 through D-41: offside detection logic, team-relative direction, clear paths, defender flagging, free-kick restart placement rules, restricted action set

### REPLAY_ELIGIBLE_TYPES and ActionEvent Types

- `packages/server/src/gameEngine.ts` ~line 4349 — `REPLAY_ELIGIBLE_TYPES` set; currently excludes `GK_KICK` and `LOOSE_BALL_LAND`; incorrect "dead code" comment must be removed
- `packages/shared/src/types.ts` line 291 — `GK_KICK` ActionEvent; line 289 — `LOOSE_BALL_LAND` ActionEvent; both missing `ballAfter` field
- `packages/server/src/gameHandlers.ts` ~line 828 — `GK_KICK` construction site(s)
- `packages/server/src/__tests__/replay.integration.test.ts` — Reference for `HEADED_PASS`/`GK_PUNT` regression test pattern to mirror for GK_KICK/LOOSE_BALL_LAND
- `.planning/phases/18.1-replay-review/18.1-REVIEW.md` — CR-01, WR-01: full defect analysis for GK_KICK and LOOSE_BALL_LAND

### BUG-23 Fix Target

- `packages/client/src/components/HexGrid.tsx` ~line 413 — `isShotPathTint` expression (all sub-conditions individually phase-gated; apply outer `phase !== 'KICK_OFF_SETUP'` guard)
- `shotTargetHighlight` React useState in `HexGrid.tsx` — never cleared; add cleanup on KICK_OFF_SETUP phase transition
- `.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — full root cause analysis with all investigated paths

### Piece Rendering (UX-15 visual bugs)

- `packages/client/src/components/HexGrid.tsx` or corresponding piece component — jersey number `<text>` element positioning; piece style pattern definitions
- Style 12 and Style 13 SVG patterns — Style 13 = cross-axis quarters (╬); Style 12 = diagonal-axis quarters (✕)

### Header Contestant Selection Flow (UX-15 clearing bug)

- `packages/client/src/store/useGameStore.ts` ~line 683 — state-update handler reset block; `headerContestantIds: []` is included in the blanket reset triggered by `prevSelectedId === null`, which is always true in HEADER phase
- `packages/client/src/components/HexGrid.tsx` ~line 733 — HEADER phase piece-click handler; calls `toggleHeaderContestant` (not `selectPiece`), keeping `selectedPieceId` null throughout contestant selection

### Pass Result Popup (UX-15 change)

- `packages/client/src/App.tsx` or `HexGrid.tsx` — existing turnover popup pattern for reference; adapt for "ACCURATE PASS!" / "LOOSE BALL!" variants
- Whichever component currently renders the "Accurate / Loose Ball" push-button confirmation — this is the replacement target

### Eligible Player Count (UX-15 change)

- Wherever "X players remaining" counter and green button state are maintained — likely in `App.tsx` or `useGameStore`; the trigger event (move start vs. move commit) must be changed and undo must restore the count

### Requirements

- `.planning/REQUIREMENTS.md` — OFFSIDE-01, OFFSIDE-02, REPLAY-07, REPLAY-08, BUG-22, BUG-23, UX-15

</canonical_refs>

<code_context>

## Existing Code Insights

### BUG-22 Fix Already Live

`carrierExclusionKey: 'highPassCarrierId'` is present in `gameHandlers.ts:405` inside the `HIGH_PASS_MOVE` handler. This was implemented in Phase 18.2 (`gameHandlers.phase18-02.test.ts` covers it). The requirement checkbox in `REQUIREMENTS.md` was never updated. Phase 25 Plan 01 closes it without touching the code.

### REPLAY_ELIGIBLE_TYPES Location

The `REPLAY_ELIGIBLE_TYPES` set is at `gameEngine.ts` ~line 4349. As of Phase 18.1, it includes `HEADED_PASS` and `GK_PUNT` (the Phase 18.1 fix) but not `GK_KICK` or `LOOSE_BALL_LAND`. The comment incorrectly describes `GK_KICK` as dead code — this comment must be corrected.

### BUG-23 Static Analysis Summary

All server-side paths to KICK_OFF_SETUP clear `lastShotPath: null`. The client guard `phase !== 'KICK_OFF_SETUP' && lastShotPathSet.has(hexId)` is already in `isShotPathTint`. Every other sub-condition (`isHpMoveTarget`, `isGKDiveTarget`, `isShotPath`, `highPassContestZoneSet`) is phase-gated and mathematically false during KICK_OFF_SETUP. Despite this, the shading persists. The two speculative fixes (outer phase gate + clear `shotTargetHighlight`) are the recommended first attempt.

### Turnover Popup Pattern

An existing auto-advancing popup exists for turnovers. The "ACCURATE PASS!" / "LOOSE BALL!" notification should reuse this pattern exactly — same styling, same auto-dismiss timing. Locate it before implementing to avoid inventing a new pattern.

### Piece SVG Text Rendering

The jersey number `<text>` element in piece SVGs uses `dominantBaseline="central"` for vertical centering. The observed downward offset suggests the current value is wrong or the `y` coordinate needs a small correction. A `dy="-0.5"` or switching to `dominantBaseline="middle"` is the first fix to try.

</code_context>

<specifics>
## Specific Ideas

### Pass Result Notification Text (from user)

User specified exact wording: **"Accurate Pass!"** or **"Loose Ball!"** — match this casing exactly in the notification banner. Do not say "Pass Result: Accurate" or similar.

### Style 12 vs Style 13 Clarification (from user)

Style 13 = quarters divided by horizontal and vertical axes (like ╬, a plus sign cutting the circle into 4). Style 12 = same four quarters but divided by diagonal axes (like ✕, an X cutting the circle). The quarters are the same size and from the center — just rotated 45°. The SVG implementation is a `<pattern>` or `<path>` operation.

### Eligible Counter Behaviour (from user)

Counter decrements when a player **starts their move** (selects a piece / begins drag), not when they **commit the destination**. Undo should restore the counter. This is a UX alignment with the physical board game where a player "activates" a piece by picking it up.

### Header Contestant Clearing Bug — Root Cause

Root cause identified: `useGameStore.ts` state-update handler at ~line 683 resets `headerContestantIds: []` whenever `prevSelectedId === null`. During HEADER phase `selectedPieceId` is always null (contestant selection uses `toggleHeaderContestant`, not the normal piece-selection path). The Task 1 investigation checkpoint confirms this mechanism before the fix is applied.

</specifics>

<deferred>
## Deferred Ideas

### Phase 26 — Response Activation Overhaul

Captured from v1.3 playtesting. Too large for Phase 25; forms the core of Phase 26:

- **GK reactive move (ball enters box):** Goalkeeper may move 1 hex in response when the ball enters the penalty box.
- **GK reactive move (outside-box shot):** Goalkeeper may move 1 hex before attempting a save when the shot originates outside the penalty box.
- **Response activation cleanup:**
  - All response move types (header, deflect, final third, dive, keeper ball in box) switch to single-selection UI pattern (like current keeper dive)
  - All response ranges displayed in white
  - Range hexes show per-hex challenge penalties (e.g., "−1" badge for being too far away or moving too far)
  - Eligibility pre-filtered: only players actually in range can be activated; deflect only if player can move onto or adjacent to shot path; header only if player can finish in range to challenge
  - Final third response: 6-hex ring displayed for single-move action; keeper automatically repositioned to starting position and excluded from eligible player count; helper text notes the automatic repositioning
  - Log a message (console or helper text) when no players are eligible for a response type

### Phase 26+ — Player Number Centering Validation

If the number centering fix does not fully resolve across all piece styles and zoom levels, a follow-up pass in Phase 26 may be needed.

</deferred>

---

_Phase: 25-bug-uat-closure_
_Context gathered: 2026-07-10_
