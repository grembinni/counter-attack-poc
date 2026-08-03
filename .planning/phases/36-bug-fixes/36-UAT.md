---
status: complete
phase: 36-bug-fixes
source: [36-VERIFICATION.md]
started: 2026-08-02T20:50:00Z
updated: 2026-08-03T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Two-tab Back/ROOM_CLOSED flow

expected: |
With two browser tabs, create a room in tab A, join it from tab B (both land pre-game),
then click Back on tab A's Game Settings screen. Tab A returns to the Landing screen with
no stale settings; tab B is also routed back to the Landing screen (not left stuck on a
dead room), with no console errors in either tab.
result: pass

### 2. Loose-ball scatter origin during real play

expected: |
Play or force a shot to resolve as a shooter/GK duel tie (shooter total == GK total) in a
live match and observe the loose ball. The loose ball marker appears at the goalkeeper's
square (or dive-adjusted square if the keeper dove) immediately after the shot, and the
subsequent scatter animation/placement visibly originates from that square rather than the
shooter's square.
result: pass

### 3. Undo button greying out/re-enabling during real play

expected: |
During a live match, move a defender adjacent to the ball carrier to trigger a tackle
attempt that resolves as FAIL, then observe the Undo button, then make a further move and
observe it again. Undo is disabled (greyed out) immediately after the failed tackle
resolves. After making any further move in the same slot, Undo re-enables and successfully
undoes that later move (but a repeated Undo click does not cross back over the tackle).
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
