---
status: diagnosed
phase: 37-out-of-bounds-detection-throw-in-goal-kick
source:
  [
    37-01-SUMMARY.md,
    37-02-SUMMARY.md,
    37-03-SUMMARY.md,
    37-04-SUMMARY.md,
    37-05-SUMMARY.md,
    37-06-SUMMARY.md,
    37-07-SUMMARY.md,
    37-08-SUMMARY.md,
    37-09-SUMMARY.md,
    37-10-SUMMARY.md,
    37-11-SUMMARY.md,
    37-12-SUMMARY.md,
    37-13-SUMMARY.md,
  ]
started: 2026-08-05T02:21:52Z
updated: 2026-08-05T02:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Enable Out-of-Bounds / Restarts Setting

expected: On the Game Settings screen (host view), a checkbox labeled "Out-of-Bounds / Restarts" is visible under a Restarts section. It is unchecked by default. Checking it and confirming settings shows a "Restarts: On" line in the settings summary shown to both players.
result: pass

### 2. Ball Out Over the Sideline Awards a Throw-In

expected: With Out-of-Bounds enabled, when a loose ball scatters off the pitch over one of the long side edges (sideline), play stops and a Throw-In is awarded to the team that did not last touch the ball (or to the attacking team if nobody touched it), with the ball placed at the exit point.
result: issue
reported: "the throw in player disapears when selected and is never returned to the game. the player should be moved to the throwin location and marked active through any following move phases. Second line is not helpful and can be removed- Throw in!"
severity: blocker

### 3. Throw-In Placement Starts a Real Movement Phase

expected: During Throw-In setup, the throwing manager selects one of their own pieces and confirms; that piece (and the ball) teleport to the throw-in hex and the game immediately enters a normal Movement Phase 1 for the throwing team — no throw option is available yet.
result: pass

### 4. Throw-In Choice After Movement Phase 1

expected: After the throwing team completes its first Movement Phase following the throw-in placement, they are offered three options: Standard Throw-In (Low), High Throw-In, or Move (continue to a second Movement Phase).
result: pass

### 5. Throw-In 6-Hex Distance Cap

expected: When delivering the throw (Low or High), only hexes within 6 hexes of the thrower are selectable as a throw target — hexes farther away are not offered/are rejected.
result: pass

### 6. Throw-In Hard Cap After Second Movement Phase

expected: If the throwing team chooses Move again and completes a second Movement Phase, only Standard Throw-In (Low) and High Throw-In remain as options — Move is no longer offered (hard two-Movement-Phase cap).
result: pass

### 7. Ball Out Over the Byline Awards a Goal Kick

expected: With Out-of-Bounds enabled, when the ball exits over a byline (short goal-line edge) without a defending touch, play stops and a Goal Kick is awarded to the byline-owning team, with the ball placed at that team's goalkeeper.
result: pass

### 8. Goal Kick Reposition Windows

expected: After a Goal Kick is awarded, the goalkeeper's team gets a window to reposition eligible players (up to 6 hexes each) inside the final thirds, then End Turn hands off to an equivalent window for the opponent (skipped automatically if the opponent has no eligible pieces).
result: pass

### 9. Goal Kick: Kick vs Standard Pass Choice

expected: After both reposition windows close, the goalkeeper is presented with two options: "Kick" or "Standard Pass".
result: pass

### 10. Goal Kick: Standard Pass Path

expected: Choosing "Standard Pass" hands the goalkeeper the ball and restricts their next action to a normal Standard Pass (same range/mechanics as any other Standard Pass).
result: issue
reported: "previously reported bug having to select standard pass twice to take the action"
severity: minor

### 11. Goal Kick: Kick Path (Target, Travel, Resolution)

expected: Choosing "Kick" lets the goalkeeper target an outfield teammate (click a teammate's hex); both teams then get a short travel-movement window; the kick then resolves with a dice-based accuracy check — an accurate kick leads into a Header contest at the target, an inaccurate kick becomes a Loose Ball.
result: issue
reported: "previousely mentioned bug on header targeting"
severity: minor

### 12. Out-of-Bounds Toggle Off Leaves Existing Behavior Unchanged

expected: With the Out-of-Bounds / Restarts setting left off (default/unchecked), a ball that scatters off the edge of the pitch behaves exactly as before — it clamps back onto the pitch as a Loose Ball, with no Throw-In or Goal Kick ever triggered.
result: pass

## Summary

total: 12
passed: 9
issues: 3
pending: 0
skipped: 0

## Gaps

<!-- YAML fenced to prevent the markdown formatter from corrupting nested list indentation -->

```yaml
- truth: 'Selecting a thrower during Throw-In Setup teleports that piece and the ball to the throw-in hex and keeps the piece active/selectable through the following Movement Phases'
  status: failed
  reason: 'User reported: the throw in player disapears when selected and is never returned to the game. the player should be moved to the throwin location and marked active through any following move phases.'
  severity: blocker
  test: 2
  root_cause: "HexGrid.tsx's SVG pitch-clip clipPath (CLIP_Y/CLIP_H) does not match axialToPixel's ODD-Q offset stagger, so certain in-bounds boundary hexes (even-q r=0, odd-q r=25) render fully or partially outside the visible clipped pitch area even though the piece/ball are placed there correctly in server state. When a throw-in lands the thrower on one of these hexes, the piece is real and selectable server-side but invisible on screen. A related, separate finding: useGameStore.ts's selectPiece has no dedicated THROW_IN_SETUP branch and falls through to a generic MOVE-phase fallback, which may compound selection-state confusion."
  artifacts:
    - path: 'packages/client/src/components/HexGrid.tsx'
      issue: "CLIP_Y/CLIP_H clip-path constants don't bisect hex centers as originally intended, clipping out even-q r=0 hexes entirely and half-clipping odd-q r=0/r=25 hexes"
    - path: 'packages/client/src/utils/hexToPixel.ts'
      issue: "axialToPixel's ODD-Q offset formula is the source of the stagger the clip-path doesn't account for"
    - path: 'packages/shared/src/pitch.ts'
      issue: 'isPitchHex/PITCH_HEXES treats the full rectangle as in-bounds with no awareness of the render-side stagger'
    - path: 'packages/client/src/store/useGameStore.ts'
      issue: 'selectPiece has no THROW_IN_SETUP branch, falls through to generic MOVE-phase handling'
  missing:
    - "Reconcile isPitchHex's logical boundary with HexGrid's render clip-path geometry (recompute CLIP_Y/CLIP_H to actually bisect boundary-row hex centers, or exclude the phantom hexes from PITCH_HEXES)"
    - "Add/verify a THROW_IN_SETUP branch in useGameStore.ts's selectPiece"
  debug_session: .planning/debug/throw-in-piece-disappears.md

- truth: 'ThrowInSetupPanel shows only necessary/helpful text'
  status: failed
  reason: 'User reported: Second line is not helpful and can be removed- Throw in!'
  severity: cosmetic
  test: 2
  root_cause: "ThrowInSetupPanel.tsx's throwing-manager branch renders a redundant second line ('Throw-In!') at line 79, directly beneath the 'Throw-In' heading (line 77) and above the actionable instruction 'Select a player to take the throw.' (line 80) — it duplicates the heading and adds no new information."
  artifacts:
    - path: 'packages/client/src/components/ThrowInSetupPanel.tsx'
      issue: 'Line 79 duplicates the heading with no new information'
  missing:
    - "Delete the redundant 'Throw-In!' line (and its blank line at 78) from the isMyThrow render branch"
  debug_session: .planning/debug/throw-in-panel-second-line-text.md

- truth: 'Pitch boundary classification (isPitchHex / out-of-bounds geometry) is consistent across all columns — hex (20,0) is classified out-of-bounds the same way other even-q hexes at r=0 are'
  status: failed
  reason: 'User reported: new bug - 20,0 is not being treated as out of bounds, (even, 0) is out of bounds'
  severity: major
  test: 3
  root_cause: "The shared rules logic (isPitchHex, classifyExit/classifyOutOfBounds/bylineOwner) is correct and parity-independent — it treats every column identically at r=0. The real bug is client-side: HexGrid.tsx's pitch-clip clipPath (CLIP_Y/CLIP_H, introduced pre-Phase-37 in commit 26535c1) does not actually bisect hex centers as its own commit message intended, so even-q r=0 hexes render ~0% visible and odd-q r=0 hexes render ~50% visible. A hex the rules engine correctly treats as in-bounds can appear entirely missing/unclickable on screen — this is what the user perceived as '(20,0) not being out of bounds.' Same root cause as the Test 2 throw-in-piece-disappears gap and the Test 7 (even,26) gap below."
  artifacts:
    - path: 'packages/client/src/components/HexGrid.tsx'
      issue: "CLIP_Y/CLIP_H clip-path constants don't bisect hex centers as intended"
    - path: 'packages/client/src/utils/hexToPixel.ts'
      issue: "axialToPixel's ODD-Q offset formula the clip-path must align against"
  missing:
    - 'Recompute CLIP_Y/CLIP_H so the clip rectangle actually bisects boundary-row hex centers, or remove the vertical clip at top/bottom so all PITCH_HEXES render consistently'
  debug_session: .planning/debug/pitch-boundary-oob-classification.md

- truth: 'A Goal Kick restart places the ball and goalkeeper at the correct byline-center hex (34,13 for the away byline / 4,13 for the home byline) before the reposition window opens'
  status: failed
  reason: 'User reported: bug - ball and keeper should be place at 34,13 or 4, 13 before 6 space movement prompt'
  severity: major
  test: 7
  root_cause: "triggerOutOfBoundsRestart's GOAL_KICK branch in gameEngine.ts places the ball at the defending goalkeeper's live/current position (gk.position) rather than a fixed byline-center restart hex. This matches 37-04-PLAN.md's explicit (but rule-mismatched) design instruction — not a coding slip. Because GKs move freely (GK_DIVING, GK_KICK_MOVE, etc.), their live position routinely drifts from their formation-default hex, so the goal kick restart lands wherever the keeper last happened to be. The GK piece itself is also never repositioned back to a restart hex — only ball.position is touched."
  artifacts:
    - path: 'packages/server/src/gameEngine.ts'
      issue: "triggerOutOfBoundsRestart's GOAL_KICK branch uses gk.position instead of a fixed byline-center hex for both ball and GK placement"
    - path: '.planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-04-PLAN.md'
      issue: 'Line 109 is the source of the gk.position design decision'
    - path: 'packages/shared/src/formations.ts'
      issue: 'Existing fixed GK formation-default hexes ({q:2,r:13} home / {q:34,r:13} away) are the natural source of truth for the corrected fixed hex'
  missing:
    - "Replace gk.position with a fixed byline-center hex per team (derived from the existing GK formation-default coordinates) for ball.position, and also reposition the GK piece's own state.pieces entry to that hex"
  debug_session: .planning/debug/goal-kick-restart-placement.md

- truth: 'During the Goal Kick reposition windows, defenders standing inside the penalty box are automatically relocated out of the box (toward the center of the field) before the 6-hex reposition prompt is offered'
  status: failed
  reason: 'User reported: bug - all defenders should be auto moved to the center of the field until they are out of the box before 6 space movement prompt'
  severity: major
  test: 8
  root_cause: "Not a bug — this is a missing/never-specified feature. GOALKICK-02's requirement text says final-thirds' players 'may' reposition up to 6 hexes each (optional, player-driven), not that box occupants must be force-relocated. No decision anywhere in Phase 37's plans (37-01 through 37-13) mentions forced relocation or penalty-box clearance; computeGoalKickEligibleIds/applyGoalKickReposition only ever execute on explicit player-initiated moves. A homePenaltyArea/awayPenaltyArea region primitive already exists in packages/shared/src/pitch.ts but is unused by any goal-kick function."
  artifacts:
    - path: 'packages/server/src/gameEngine.ts'
      issue: 'computeGoalKickEligibleIds/applyGoalKickReposition/triggerOutOfBoundsRestart correctly implement the documented optional/manual reposition behavior; no auto-clear step exists anywhere'
    - path: '.planning/REQUIREMENTS.md'
      issue: "GOALKICK-02 (line 61) text itself only specifies an optional 'may reposition' — the implemented behavior fully satisfies it as written"
  missing:
    - 'A new requirement/decision (e.g. GOALKICK-02a) explicitly specifying the box-clearing rule (target hex, tie-breaking, interaction with the existing 6-hex budget) is needed before this can be implemented — this is new game-rule scope, not a fix to broken logic'
  debug_session: .planning/debug/goal-kick-defenders-not-cleared-from-box.md

- truth: "After selecting the header target during a Goal Kick's Kick path, a header-target ring is visible on the pitch to guide each team's single-piece travel-movement response"
  status: failed
  reason: 'User reported: bug - after select player to target with kick, header ring should be visible to guide single player response move from each team'
  severity: minor
  test: 11
  root_cause: "No dedicated header-target highlight was ever designed or implemented for the GOAL_KICK_MOVE travel-movement window. applyGoalKickTarget correctly sets ball.position/goalKickTargetHex on entering GOAL_KICK_MOVE, and the generic BallLocationRing marker does technically render there (GOAL_KICK_MOVE is in BALL_MARKER_PHASES), but that marker is shared across 17 response phases and was never purpose-built or verified for this specific 'guide the header contest' requirement. Plan 37-10's client work explicitly scoped HexGrid.tsx highlighting to only target-selection (GOAL_KICK_TARGET) and the acting piece's own destination tint — it never added a highlight anchored at goalKickTargetHex itself once the travel window begins."
  artifacts:
    - path: 'packages/client/src/components/BallLocationRing.tsx'
      issue: 'Only generic mechanism touching this phase; not purpose-built for the header-target requirement'
    - path: 'packages/client/src/components/HexGrid.tsx'
      issue: 'No highlight logic anchored at goalKickTargetHex during GOAL_KICK_MOVE'
    - path: 'docs/HIGHLIGHT-REFERENCE.md'
      issue: 'Stale — missing all 6 Phase-37 restart phases'
  missing:
    - 'Add a distinctive, purpose-built header-target highlight anchored at goalKickTargetHex for the duration of GOAL_KICK_MOVE, distinct from the generic always-on BallLocationRing marker'
    - 'Update docs/HIGHLIGHT-REFERENCE.md and add test coverage for GOAL_KICK_MOVE'
  debug_session: .planning/debug/goal-kick-header-ring-missing.md

- truth: 'Choosing Standard Pass from the Goal Kick choice screen takes the goalkeeper directly into the Standard Pass action, without a redundant second selection step'
  status: failed
  reason: 'User reported: bug - selecting standard pass takes to new prompt to select standard pass, should not have to select twice before taking the action'
  severity: minor
  test: 10
  root_cause: "Confirmed genuine one-extra-step regression, unique to GOAL_KICK_RESTART. ActionPanel's Step 1 pass-type chooser is generic across every lastActionType and always requires an explicit click, regardless of how many options ELIGIBLE_NEXT_ACTIONS actually contains. GOAL_KICK_RESTART's eligible set is a singleton ({STANDARD_PASS}) — the player already made this exact decision one screen earlier in GoalKickSetupPanel (clicking 'Standard Pass' over 'Kick'). useGameStore.ts unconditionally resets selectedPassType to null on every phaseChanged broadcast with no exception for singleton-eligible lastActionTypes, forcing Step 1 to re-render with one enabled button that must be clicked again purely to satisfy the generic gate."
  artifacts:
    - path: 'packages/client/src/components/ActionPanel.tsx'
      issue: 'Generic Step 1 pass-type chooser (lines 712-838) has no special-case for singleton eligible sets'
    - path: 'packages/client/src/store/useGameStore.ts'
      issue: 'Unconditional selectedPassType: null reset on phase change (~lines 902-938), no exception for GOAL_KICK_RESTART'
    - path: 'packages/shared/src/actionSequence.ts'
      issue: 'ELIGIBLE_NEXT_ACTIONS.GOAL_KICK_RESTART (line 114) is a singleton set — context confirming the redundant step'
  missing:
    - 'Auto-set selectedPassType on the client when lastActionType maps to a singleton ELIGIBLE_NEXT_ACTIONS pass-type set, skipping straight to Step 2 (target-hex selection)'
  debug_session: .planning/debug/goal-kick-standard-pass-double-select.md

- truth: 'Pitch boundary classification is consistent across all columns at the byline — hex (even, 26) is classified out-of-bounds consistent with the rest of the byline row'
  status: failed
  reason: 'User reported: check - (even, 26) should be out of bounds'
  severity: major
  test: 7
  root_cause: "Same root cause as the (20,0) gap above (see that entry) — HexGrid.tsx's CLIP_Y/CLIP_H clip-path geometry mismatch. r=26 doesn't exist in the grid at all (MAX_R=25), so it's already unconditionally out-of-bounds server-side for every column; the visual/click-boundary mismatch at the r=25 boundary row (odd-q ~50% visible) is what the user is perceiving as an inconsistency near that edge."
  artifacts:
    - path: 'packages/client/src/components/HexGrid.tsx'
      issue: 'Same CLIP_Y/CLIP_H mismatch as the (20,0) gap'
  missing:
    - 'Same fix as the (20,0) gap — recompute CLIP_Y/CLIP_H boundary geometry'
  debug_session: .planning/debug/pitch-boundary-oob-classification.md

- truth: 'The hex grid on the pitch is fully clickable — no coordinate produces an error when clicked'
  status: failed
  reason: "User reported: this game doesn't have a proper hex grid, several coordinates give errors when clicked"
  severity: blocker
  test: 8
  root_cause: "No unguarded crash found in the GOAL_KICK_SETUP_GK/OPPONENT click path itself — it is well-guarded and its one known off-pitch defect was already fixed in Plan 37-13. The most likely explanation is a UX/surfacing issue: every legitimate server rejection during the reposition windows (off-pitch, non-adjacent, occupied, budget-exhausted, ineligible, wrong-team) is displayed as a raw, untranslated server error-code string (e.g. 'OFF_PITCH', 'MOVE_INVALID', 'GOAL_KICK_PACE_EXHAUSTED') via GoalKickSetupPanel.tsx's unconditional gameError banner — reading as the grid 'giving errors' to a non-technical tester. Likely compounded by the same CLIP_Y/CLIP_H boundary mismatch documented in the pitch-boundary-oob-classification gap, since Goal-Kick-eligible pieces cluster near the byline/pitch edge. Also flagged: T-37-66 (FREE_MOVE_ATTACK/DEFENSE still missing an isPitchHex guard, per Plan 37-13's summary) remains open, and useGameStore.ts's selectPiece has no THROW_IN_SETUP branch."
  artifacts:
    - path: 'packages/client/src/components/GoalKickSetupPanel.tsx'
      issue: 'Raw gameError wire-code strings displayed verbatim with no humanized translation'
    - path: 'packages/client/src/components/HexGrid.tsx'
      issue: 'Likely compounded by the CLIP_Y/CLIP_H boundary mismatch (see pitch-boundary-oob-classification gap)'
    - path: 'packages/server/src/gameEngine.ts'
      issue: 'T-37-66 (applyFreeMove missing isPitchHex guard) remains an open, related gap'
  missing:
    - 'Add a humanized error-message mapping layer for gameError codes in restart-setup panels (GoalKickSetupPanel/ThrowInSetupPanel/FreeKickSetupPanel) instead of raw wire codes'
    - 'Confirm/fix the CLIP_Y/CLIP_H boundary bug, which likely compounds this'
    - 'Consider closing T-37-66 (isPitchHex guard on applyFreeMove) as part of the same pass'
  debug_session: .planning/debug/hex-grid-click-errors.md

- truth: 'The Throw-In Movement Phase choice screen uses UI copy/terminology the user can map onto what they see on screen, making the flow testable'
  status: failed
  reason: "User reported (on Test 4): this game doesn't have movement phases so this is impossible to test."
  severity: minor
  test: 4
  root_cause: "Pre-existing whole-game UI convention: the client has never displayed the literal phrase 'Movement Phase' for the MOVE game phase, for any trigger — the scoreboard label reads 'MOVE'/'MOVE 4' and ActionPanel's live heading reads 'Move!'. Phase 37 is the only place in the entire codebase that literally writes 'Movement Phase' into user-facing copy (ActionPanel.tsx lines 757-760, the throw-in choice screen), and that screen only appears retrospectively after the MOVE phase has already ended — with nothing tying the term back to what the tester just watched live. Not a whole-game regression (out of Phase 37's scope to fix globally), but an internal terminology inconsistency Phase 37 introduced."
  artifacts:
    - path: 'packages/client/src/components/GameBoard.tsx'
      issue: "PHASE_LABEL map never surfaces 'Movement Phase' for any GamePhase, including MOVE"
    - path: 'packages/client/src/components/ActionPanel.tsx'
      issue: "Lines 757-760 are the only place 'Movement Phase' appears in client UI copy, shown only after the MOVE phase already ended"
  missing:
    - "Reword the throw-in choice screen's copy (ActionPanel.tsx:757-760) to match the game's existing 'Move' vocabulary instead of 'Movement Phase', or add a bridging on-screen cue during the live MOVE phase when triggered from a throw-in"
  debug_session: .planning/debug/throw-in-movement-phase-terminology-unclear.md
```
