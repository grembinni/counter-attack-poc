---
status: diagnosed
trigger: "Investigate issue: goal-kick-header-response-move-radius-missing. After a Goal Kick's Kick path selects a header target, the target hex now shows a distinct ring (fixed in Phase 37 plan 37-18), but the white range/radius hexes that normally indicate a piece's single-move response range during a response-move window are not shown for either team during this GOAL_KICK_MOVE travel window."
created: 2026-08-05T18:08:55Z
updated: 2026-08-05T18:35:00Z
---

## Current Focus

hypothesis: CONFIRMED — see Resolution.root_cause. `highPassContestZoneSet` (HexGrid.tsx ~line 238), the white/selection-independent "contest zone preview" set used by HIGH_PASS_MOVE (the structural analog of GOAL_KICK_MOVE — both are single-piece response-move windows that resolve into a HEADER phase), is phase-gated exclusively to `phase === 'HIGH_PASS_MOVE'` and has no GOAL_KICK_MOVE branch. The per-piece green 'safe' valid-move-destination highlight (canSelectGoalKickMove / validMoveHexes / isValidMove) IS correctly wired for GOAL_KICK_MOVE and was eliminated as the cause (see Eliminated).
test: n/a — root cause confirmed via code read + existing passing tests, goal is find_root_cause_only (no fix applied).
expecting: n/a
next_action: n/a — investigation complete, returning ROOT CAUSE FOUND to caller.

## Symptoms

expected: After choosing "Kick" and selecting an outfield teammate as the header target, both teams get a short travel-movement window before the header contest resolves. During this window, each team should see the same white radius/range highlight hexes that are shown elsewhere in the game to guide a single-piece response move (i.e. the reachable hexes for the one piece each side gets to move during this window) — not just the ring/marker at the target hex itself.
actual: The header-target ring at the target hex is visible and correct (this is the fix landed in plan 37-18 / HeaderTargetRing). But the white radius/range hexes indicating where each team's response piece can actually move during this travel window are missing — the player reported "partial pass. It does highlight the target hex but it should display the same white radius hexes as a header for the response move."
errors: None reported
reproduction: Test 6 in .planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-UAT.md (a fresh UAT re-verification round after Phase 37's gap-closure plans 37-14 through 37-18 executed)
started: Discovered during UAT re-verification on 2026-08-05, after plan 37-18 added the HeaderTargetRing component/wiring for the target hex. The regular per-piece move-range highlight mechanism (used during normal Movement Phase and other response-move windows in this game) is presumably a separate, pre-existing highlight system that was never wired up for the GOAL_KICK_MOVE phase specifically.

## Eliminated

- hypothesis: "The per-piece 'valid move destination' highlight mechanism (canSelectGoalKickMove / selectPiece's validMoveHexes computation / isValidMove -> isSafeTint 'safe' tint) was never wired up for the GOAL_KICK_MOVE phase, so selecting the response piece never populates any reachable-hex set."
  evidence: "Disproven by direct code read. HexGrid.tsx:746-753 defines `canSelectGoalKickMove`, byte-for-byte mirroring the known-working `canSelectGKKickMove` (lines 740-745), gating piece selectability on `phase === 'GOAL_KICK_MOVE' && isActivePlayer && piece.teamId === myTeam && (goalKickMovedPieceId === null || goalKickMovedPieceId === piece.id)`. useGameStore.ts's `selectPiece` (lines 865-888) has an explicit `if (gameState.phase === 'GOAL_KICK_MOVE')` branch that calls `computeResponseMoveValidHexes(id, piece, gameState, GOAL_KICK_MOVE_CONFIG)` and sets `validMoveHexes`. The `setGameState` sticky-selection block (lines 1087-1114) also explicitly includes `GOAL_KICK_MOVE` alongside HIGH_PASS_MOVE/GK_KICK_MOVE/FIRST_TIME_PASS_MOVE. Two passing unit tests confirm this at the store level: useGameStore.test.ts:564-570 (GOAL_KICK_SETUP_GK analog) and :613-621 ('GOAL_KICK_MOVE: the locked piece itself remains selectable and yields adjacent valid-move hexes' — asserts `state.validMoveHexes.length` > 0 after `selectPiece(GK_ELIGIBLE_ID)`). This mechanism DOES render — but as a GREEN 'safe' tint (HexCell.tsx HIGHLIGHT_STYLES.safe = `rgba(34,197,94,0.4)`), never white, and only for one adjacent hex at a time (`clickDistanceMode: 'strict-1'` in GOAL_KICK_MOVE_CONFIG). This is a real, working, but different mechanism than what the UAT report describes ('white radius hexes')."
  timestamp: 2026-08-05T18:30:00Z

## Evidence

- timestamp: 2026-08-05T18:15:00Z
  checked: packages/client/src/components/HexGrid.tsx (full read, 983 lines) — canSelectGoalKickMove (746-753), selectPiece wiring, and the highlightType priority ternary (537-561)
  found: GOAL_KICK_MOVE piece-selection and per-piece valid-move-hex tinting (green 'safe') is fully wired and structurally identical to GK_KICK_MOVE. HeaderTargetRing (line 978) is a separate, correctly-working standalone overlay drawn only at the single goalKickTargetHex.
  implication: The bug is not in piece selectability or the per-piece move-destination highlight. Something else — a broader, selection-independent "contest zone" highlight — is the actual missing piece.

- timestamp: 2026-08-05T18:20:00Z
  checked: packages/client/src/store/useGameStore.ts (selectPiece GOAL_KICK_MOVE branch, lines 865-888; setGameState sticky block, lines 1087-1114; GOAL_KICK_MOVE_CONFIG, lines 278-283) and useGameStore.test.ts (lines 513-621)
  found: computeResponseMoveValidHexes + GOAL_KICK_MOVE_CONFIG (paceCap 3, clickDistanceMode 'strict-1') correctly populates validMoveHexes for the selected response piece; passing tests confirm this at the store level.
  implication: Confirms Eliminated hypothesis H1 — the per-piece response-move mechanism is not the gap.

- timestamp: 2026-08-05T18:24:00Z
  checked: packages/client/src/components/HexCell.tsx — HIGHLIGHT_STYLES table (lines 18-99)
  found: highlightType 'safe' (used for normal valid-move destinations, including GOAL_KICK_MOVE via isValidMove -> isSafeTint) is GREEN (`fill: 'rgba(34,197,94,0.4)'`), NOT white. Only 'shot-path' (`rgba(255,255,255,1)`, restOpacity 0.2) and 'shot-path-action' (`rgba(255,255,255,1)`, restOpacity 0.55) are white.
  implication: The color the UAT reporter calls "white radius hexes" cannot be the green per-piece move highlight at all — it must refer to one of the white 'shot-path'/'shot-path-action' tints, which are driven by a completely different, selection-independent set: highPassContestZoneSet.

- timestamp: 2026-08-05T18:27:00Z
  checked: packages/client/src/components/HexGrid.tsx lines 234-245 (highPassContestZoneSet definition) and its two consumption sites at lines 489 and 502 (isShotPathActionTint / isShotPathTint)
  found: |

  ```
  // Bug 1 fix: HIGH_PASS_MOVE — contest zone preview.
  // During repositioning, highlight the ball's landing hex (= pass target) plus all hexes
  // within 2 hexes of it with shot-path (white) tint. This shows players where the header
  // contest will take place before the accuracy roll resolves.
  const highPassContestZoneSet = new Set<string>();
  if (phase === 'HIGH_PASS_MOVE') {
    for (const h of PITCH_HEXES) {
      if (hexDistance(h, ball.position) <= 2) {
        highPassContestZoneSet.add(`${h.q},${h.r}`);
      }
    }
  }
  ```

  This set is gated EXCLUSIVELY on `phase === 'HIGH_PASS_MOVE'`. It feeds `isShotPathActionTint` (brighter white, for hexes that are also a valid move destination) and `isShotPathTint` (dimmer white, unconditional — visible to both teams the instant HIGH_PASS_MOVE begins, no piece selection required). A `grep -c 'highPassContestZoneSet'` shows exactly these 4 occurrences (definition + 2 accumulation sites inside the loop + 2 consumption sites) — there is no equivalent set, and no `phase === 'GOAL_KICK_MOVE'` (or `'GK_KICK_MOVE'`) branch anywhere near it.
  implication: This IS the missing mechanism. HIGH_PASS_MOVE is architecturally the exact analog of GOAL_KICK_MOVE — both are the single-piece-per-team response-move window immediately preceding a HEADER contest. applyGoalKickMoveEnd's own doc comment (gameEngine.ts ~3910) confirms this parallel verbatim: "An accurate kick ... with an eligible header contest enters HEADER (copying the HIGH_PASS -> HEADER eligibility check verbatim)." The white, selection-independent, multi-hex "radius" the UAT reporter is describing is HIGH_PASS_MOVE's contest-zone preview — and GOAL_KICK_MOVE never got the equivalent branch.

- timestamp: 2026-08-05T18:31:00Z
  checked: .planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-18-PLAN.md, "Deliberately NOT done in this plan" section
  found: "A 3-hex reachability highlight for the travel window. The gap asks for a marker at the contest point; HexGrid already tints the acting piece's own valid destinations once it is selected. Adding a second range overlay is unrequested scope and would collide with those tints."
  implication: Corroborates the root cause from the planning side — Plan 37-18's author was aware only of the green per-piece highlight (already working) and explicitly treated a broader "range overlay" as new, unrequested scope, rather than recognizing that HIGH_PASS_MOVE already has exactly this overlay (highPassContestZoneSet) which simply needs its phase condition extended to GOAL_KICK_MOVE. This explains why the gap survived plan 37-18: the plan scoped out the very thing the UAT is now asking for, believing it did not already exist as a pattern.

## Resolution

root_cause: |
`highPassContestZoneSet` in packages/client/src/components/HexGrid.tsx (lines 234-245) — the white, radius-based (2 hexes around `ball.position`), selection-independent "header contest zone preview" highlight that shows both teams where an upcoming HEADER contest will occur — is phase-gated exclusively to `if (phase === 'HIGH_PASS_MOVE')`. GOAL_KICK_MOVE is the structurally identical single-piece-per-team response-move window for the goal-kick flow (also resolving into a HEADER contest, per applyGoalKickMoveEnd in gameEngine.ts), but no equivalent set/condition was ever added for `phase === 'GOAL_KICK_MOVE'`, either in the set's own definition (line 239) or in its two consumption sites, `isShotPathActionTint` (line 489) and `isShotPathTint` (line 502). The per-piece green 'safe' move-destination highlight (canSelectGoalKickMove / validMoveHexes) is correctly wired and NOT the gap — it is a separate, already-working mechanism that only shows one adjacent hex at a time once a piece is selected, which is why the UAT reporter still sees "nothing" resembling the broader white radius they expect, even though technically a highlight (green, single-hex) does appear once a piece is clicked.
fix:
verification:
files_changed: []
