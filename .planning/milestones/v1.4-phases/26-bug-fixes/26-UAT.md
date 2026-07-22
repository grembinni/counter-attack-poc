---
status: complete
phase: 26-bug-fixes
source:
  - 26-01-SUMMARY.md
  - 26-02-SUMMARY.md
  - 26-03-SUMMARY.md
started: 2026-07-12T00:00:00.000Z
updated: 2026-07-12T00:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Undo disabled at start of FREE_KICK_SETUP stage

expected: During FREE_KICK_SETUP, at the very start of a new stage (no pieces placed yet in this stage), the Undo button should be disabled / greyed out. It should NOT be possible to undo moves from a previous stage.
result: pass

### 2. Undo works within current FREE_KICK_SETUP stage

expected: During FREE_KICK_SETUP, after placing at least one piece in the current stage, the Undo button becomes enabled. Clicking Undo removes the last-placed piece and it returns to its original hex. Undo cannot reach moves from before the current stage boundary.
result: pass

### 3. MOVE End Turn button is orange while options remain

expected: During the MOVE phase, when one or more players in the current slot still have not moved, the End Turn button is orange/yellow (pending color). It only turns green once all movement options for the current slot are exhausted.
result: pass

### 4. Clicking opponent's activated piece opens stats panel

expected: During the MOVE phase (or any phase where opponents have activated/moved pieces), clicking on an opponent's piece that has already moved opens that player's stats panel. It should not be a no-op.
result: pass

### 5. Deflection log shows consistent format

expected: When a deflection attempt fails, the Action Log entry reads "failed to deflect — [close range (Set A), die X + Tackling Y = Z]" or similar with the range band and dice details always present. A bare "failed to deflect" with no reason suffix should never appear.
result: pass

### 6. Header target based on contestant position; shot range blocks at distance 12+

expected: (a) After winning a header duel, valid target hexes are computed from the winning contestant's actual position on the pitch — not from the ball's position. (b) A player attempting a standard shot from more than 11 hexes away from goal is blocked (shot option not available / rejected).
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
