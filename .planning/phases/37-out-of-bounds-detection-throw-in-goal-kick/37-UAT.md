---
status: complete
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

- truth: "Selecting a thrower during Throw-In Setup teleports that piece and the ball to the throw-in hex and keeps the piece active/selectable through the following Movement Phases"
  status: failed
  reason: "User reported: the throw in player disapears when selected and is never returned to the game. the player should be moved to the throwin location and marked active through any following move phases."
  severity: blocker
  test: 2
  artifacts: []
  missing: []

- truth: "ThrowInSetupPanel shows only necessary/helpful text"
  status: failed
  reason: "User reported: Second line is not helpful and can be removed- Throw in!"
  severity: cosmetic
  test: 2
  artifacts: []
  missing: []

- truth: "Pitch boundary classification (isPitchHex / out-of-bounds geometry) is consistent across all columns — hex (20,0) is classified out-of-bounds the same way other even-q hexes at r=0 are"
  status: failed
  reason: "User reported: new bug - 20,0 is not being treated as out of bounds, (even, 0) is out of bounds"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "A Goal Kick restart places the ball and goalkeeper at the correct byline-center hex (34,13 for the away byline / 4,13 for the home byline) before the reposition window opens"
  status: failed
  reason: "User reported: bug - ball and keeper should be place at 34,13 or 4, 13 before 6 space movement prompt"
  severity: major
  test: 7
  artifacts: []
  missing: []

- truth: "During the Goal Kick reposition windows, defenders standing inside the penalty box are automatically relocated out of the box (toward the center of the field) before the 6-hex reposition prompt is offered"
  status: failed
  reason: "User reported: bug - all defenders should be auto moved to the center of the field until they are out of the box before 6 space movement prompt"
  severity: major
  test: 8
  artifacts: []
  missing: []

- truth: "After selecting the header target during a Goal Kick's Kick path, a header-target ring is visible on the pitch to guide each team's single-piece travel-movement response"
  status: failed
  reason: "User reported: bug - after select player to target with kick, header ring should be visible to guide single player response move from each team"
  severity: minor
  test: 11
  artifacts: []
  missing: []

- truth: "Choosing Standard Pass from the Goal Kick choice screen takes the goalkeeper directly into the Standard Pass action, without a redundant second selection step"
  status: failed
  reason: "User reported: bug - selecting standard pass takes to new prompt to select standard pass, should not have to select twice before taking the action"
  severity: minor
  test: 10
  artifacts: []
  missing: []

- truth: "Pitch boundary classification is consistent across all columns at the byline — hex (even, 26) is classified out-of-bounds consistent with the rest of the byline row"
  status: failed
  reason: "User reported: check - (even, 26) should be out of bounds"
  severity: major
  test: 7
  artifacts: []
  missing: []

- truth: "The hex grid on the pitch is fully clickable — no coordinate produces an error when clicked"
  status: failed
  reason: "User reported: this game doesn't have a proper hex grid, several coordinates give errors when clicked"
  severity: blocker
  test: 8
  artifacts: []
  missing: []

- truth: "The Throw-In Movement Phase choice screen uses UI copy/terminology the user can map onto what they see on screen, making the flow testable"
  status: failed
  reason: "User reported (on Test 4): this game doesn't have movement phases so this is impossible to test."
  severity: minor
  test: 4
  artifacts: []
  missing: []
