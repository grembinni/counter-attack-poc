---
status: testing
phase: 25-bug-uat-closure
source: [25-VERIFICATION.md]
started: 2026-07-11T21:32:34.663Z
updated: 2026-07-11T21:32:34.663Z
---

## Current Test

number: 1
name: OFFSIDE-02 two-tab free-kick session (full step sequence)
expected: |
Full 6-step sequence enforced: A chooses kicker on freeKickHex → A moves up to 4 players →
D moves up to 4 players → A moves up to 3 → D moves up to 2 → A takes the kick.
Undo disabled at the start of each stage (no moves yet); Undo works within a stage;
Undo cannot cross stage boundaries.
awaiting: user response

## Tests

### 1. OFFSIDE-02 two-tab free-kick session (full step sequence)

expected: |
Full 6-step sequence enforced in two-browser session. A:choose-kicker → A:move-4 →
D:move-4 → A:move-3 → D:move-2 → A:kick. Kicker-select helper text shown before
repositioning begins. Undo is disabled when current stage has no placed pieces;
active-team pieces show blue eligible ring during repositioning stages; End Turn
button is yellow until move-count reached, green after.
result: [pending]

### 2. Jersey number centering (Plan 25-08)

expected: |
Jersey numbers visually centered in piece circle at R=12 (gameplay) and R=30
(selection screen) across multiple uniform styles. Neither too low nor too high.
result: [pending]

### 3. Style 12 (quarterHorizontal) symmetric quarters (Plan 25-09)

expected: |
Style 12 shows four equal diamond-shaped (✕) quarters symmetrically centered on the
piece at both R=12 and R=30. Style 13 (╬ axis-aligned quarters) is visually unchanged.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
