---
status: complete
phase: 08-match-lifecycle-post-game-replay
source: [08-VERIFICATION.md]
started: 2026-06-05T11:00:00Z
updated: 2026-06-06T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Snapshot full-path test (requires gap fixes — now applied)

expected: After placing ball carrier in opponent penalty area during MOVEMENT, clicking
the Snapshot button transitions phase to SHOT with -1 penalty applied. Roll Dice resolves
the shot duel. No GAME_ERROR emitted. Both clients see consistent state.

result: issue
reported: "Snapshot button appears for pieces that don't have the ball — should only appear when the ball carrier is in the penalty area"
severity: major

### 2. Header button interaction path (requires gap fixes — now applied)

expected: After a High Pass, clicking the Header button (not Roll Dice) resolves the
heading duel via the GAME_HEADER handler. No silent event drop. Both clients see
consistent state after resolution.

result: skipped
reason: "Will be addressed in Phase 8.2 — deferred"

## Summary

total: 2
passed: 0
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Snapshot button should only appear in the action panel when the ball carrier (the piece with carrierId) is in the opponent's penalty area during MOVEMENT phase"
  status: failed
  reason: "User reported: Snapshot button appears for pieces that don't have the ball — should only appear when the ball carrier is in the penalty area"
  severity: major
  test: 1
  artifacts: []
  missing: []
