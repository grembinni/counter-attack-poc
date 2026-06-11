---
status: diagnosed
phase: 10-remaining-action-flows-tech-debt
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md, 10-05-SUMMARY.md
started: 2026-06-11T00:00:00Z
updated: 2026-06-11T00:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Two-step Shoot flow

expected: In the ACTION (PASS) phase, when you have ball possession, an active "Shoot" button appears in the ActionPanel. Clicking it switches the UI into shooting mode — goal hexes on the opponent's goal line become highlighted (gold or distinct colour). Clicking one of those highlighted goal hexes declares the shot and the game transitions to GK_DIVING phase (your opponent's GK must now respond).
result: pass

### 2. GK dive reposition

expected: When in GK_DIVING phase, the GK's team (defender) sees a repositioning prompt in the ActionPanel. The GK can click a hex on the same goal line up to 3 hexes away from their current position to reposition. Clicking "End Turn" confirms the dive. Moving exactly 3 hexes applies a -1 Saving penalty (SHOT-04). The attacker's side shows a waiting/disabled state.
result: pass

### 3. Shot auto-resolution (no dice button)

expected: After the GK player clicks End Turn in GK_DIVING, the server auto-resolves the shot immediately — no "Roll Dice" button appears. The outcome (GOAL, GK save, or LOOSE_BALL) is broadcast and visible in the ActionLog / game state. If a defender is in the shot path the ball may deflect to LOOSE_BALL instead of reaching the GK.
result: pass

### 4. GK save and restart flow

expected: When the GK makes a clean save (handling check passes), the game enters GK_RESTART phase. The GK's team sees restart options in the ActionPanel (kick, throw, or movement). Play continues from there. A failed handling check produces LOOSE_BALL instead.
result: pass

### 5. Snapshot button works in MOVEMENT phase

expected: When a player with the ball is adjacent to the goal in MOVEMENT phase, the Snapshot button in the ActionPanel is enabled (not permanently disabled). Clicking it declares a snapshot and the game moves to SNAP_DEFLECT phase.
result: pass

### 6. SNAP_DEFLECT phase — opponent deflection move

expected: After a snapshot is declared, the defending team sees a SNAP_DEFLECT prompt in the ActionPanel. They can move exactly one of their players up to 2 hexes (to try to block the path). Clicking End Turn auto-resolves the snapshot shot. The attacking team sees a waiting state during this phase.
result: pass

### 7. HEADER contestant selection + target hex

expected: During HEADER phase, after both teams have confirmed their contestants, the ActionPanel shows a prompt for the attacker to select a target hex. Valid target hexes are highlighted on the board (including goal-line hexes for a headed goal attempt). Clicking a goal-line hex triggers the GK save flow (GK_DIVING phase). Clicking a non-goal hex delivers the ball to that position.
result: issue
reported: "All header functions work except for the targeting goaline"
severity: major

### 8. HEADER auto-roll — no Roll Header button

expected: In HEADER phase, after both teams confirm their contestants, the header duel resolves automatically — there is no "Roll Header" button. The result (attacker wins, defender wins, tie → LOOSE_BALL) appears in the ActionLog without any manual dice trigger.
result: pass

### 9. ActionLog pass entries show team colour

expected: When a STANDARD_PASS or FIRST_TIME_PASS is made, the entry in the ActionLog panel shows the passer's team colour prefix (e.g. home team colour for home passes, away colour for away passes) — matching the same colouring used for other team-attributed actions.
result: pass

### 10. No stale highlights during GK_DIVING / SNAP_DEFLECT

expected: When the game is in GK_DIVING or SNAP_DEFLECT phase, no gold "valid movement" hex highlights remain on the board from a prior movement phase. The board shows only the contextually appropriate highlights (GK dive targets or SNAP_DEFLECT movement targets).
result: pass

## Summary

total: 10
passed: 9
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Clicking a goal-line hex during HEADER target-hex selection triggers the GK save flow (GK_DIVING phase)"
  status: failed
  reason: "User reported: All header functions work except for the targeting goaline"
  severity: major
  test: 7
  root_cause: "isHeaderTargetGoalHex missing from isHighlighted in HexGrid.tsx — HexCell only wires onClick when isHighlighted=true, so goal-line hexes were unclickable and unlit during HEADER target step"
  artifacts:
  - path: "packages/client/src/components/HexGrid.tsx"
    issue: "isHeaderTargetGoalHex not included in isHighlighted expression; also missing from highlightColor condition"
    missing:
  - "Add isHeaderTargetGoalHex to isHighlighted (line 262)"
  - "Add isHeaderTargetGoalHex to highlightColor red condition (line 341)"
    debug_session: ""
