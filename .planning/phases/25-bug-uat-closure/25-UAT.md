---
status: complete
phase: 25-bug-uat-closure
source: [25-VERIFICATION.md]
started: 2026-07-11T21:32:34.663Z
updated: 2026-07-11T19:30:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. OFFSIDE-02 two-tab free-kick session (full step sequence)

expected: |
Full 6-step sequence enforced in two-browser session. A:choose-kicker → A:move-4 →
D:move-4 → A:move-3 → D:move-2 → A:kick. Kicker-select helper text shown before
repositioning begins. Undo is disabled when current stage has no placed pieces;
active-team pieces show blue eligible ring during repositioning stages; End Turn
button is yellow until move-count reached, green after.
result: pass
note: Undo not implemented for FREE_KICK_SETUP — logged as todo for future phase

### 2. Jersey number centering (Plan 25-08)

expected: |
Jersey numbers visually centered in piece circle at R=12 (gameplay) and R=30
(selection screen) across multiple uniform styles. Neither too low nor too high.
result: pass

### 3. Style 12 (quarterHorizontal) symmetric quarters (Plan 25-09)

expected: |
Style 12 shows four equal diamond-shaped (✕) quarters symmetrically centered on the
piece at both R=12 and R=30. Style 13 (╬ axis-aligned quarters) is visually unchanged.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
