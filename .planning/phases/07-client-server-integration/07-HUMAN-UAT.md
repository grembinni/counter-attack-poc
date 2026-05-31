---
status: partial
phase: 07-client-server-integration
source: [07-VERIFICATION.md]
started: 2026-05-31T22:00:00Z
updated: 2026-05-31T22:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end two-tab room session

expected: Both tabs display the live game board with matching game state. Tab 1 player is slot 1 (Home), Tab 2 player is slot 2 (Away).
result: [pending]

### 2. Undo move re-clickability (UNDO-04)

expected: After emitting game:undo, the undone piece is restored to its previous position AND becomes re-selectable/moveable (not stuck in movedPieceIds). Verify by moving a piece, clicking Undo, then clicking the piece again to confirm it can be moved.
result: [pending]

### 3. Undo button disappears on phase transition

expected: Undo button visible in MOVEMENT phase for active player, disappears when phase transitions to PASS/SHOT/etc.
result: [pending]

### 4. Disconnect banner lifecycle

expected: Disconnect one browser tab's network — the other tab shows the yellow banner. When the disconnected tab reconnects (within 90s), the banner auto-dismisses on the next game:state broadcast.
result: [pending]

### 5. ConnectionStatus visual states

expected: Connection indicator shows green (Connected) during normal play, amber (Reconnecting…) during brief disconnect, red (Disconnected) when connection is lost.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
