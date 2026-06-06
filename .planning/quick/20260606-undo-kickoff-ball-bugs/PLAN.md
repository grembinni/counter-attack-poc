---
slug: undo-kickoff-ball-bugs
created: 2026-06-06
status: complete
commit: e8bb5bc
---

# Fix Undo/Kickoff/Ball Bugs

## Bugs fixed (5)

1. applyStartMovement only reassigns ball.carrierId from KICK_OFF — PASS keeps existing carrier
2. applyUndo treats KICK_OFF as slot boundary so undo can't cross into pre-steal history
3. applyUndo always removes piece from movedPieceIds on any undo (X clears immediately)
4. ActionPanel KICK_OFF merged into PASS chooser (no more "Start Movement Phase" button)
5. Undo button disabled when no MOVE events exist after last slot boundary
