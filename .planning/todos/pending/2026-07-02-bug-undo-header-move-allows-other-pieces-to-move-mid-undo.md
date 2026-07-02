---
created: 2026-07-02T11:38:09.262Z
title: 'Bug — undo on HEADER_MOVE allows other pieces to move before full undo completes'
area: rules
files:
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/client/src/components/ActionPanel.tsx
---

## Problem

When Undo is used during a HEADER_MOVE phase, the undo operation does not fully reset the active-piece tracking state. After the undo, other players' pieces become selectable and moveable even though the undone move has not been fully reversed — the turn state is broken.

Likely root cause: `applyUndo` for HEADER_MOVE (and possibly other move-bearing phases added in BUG-18: GK_KICK_MOVE, SNAPSHOT_DEFLECT, FREE_MOVE_ATTACK/DEFENSE, FREE_KICK_SETUP) does not reset `movedPieceIds`, `activatedPieceId`, or the active-player lock alongside the position revert. The `lockReset` block in `applyUndo` may be missing cases for the newly-extended phase list.

BUG-18 (phase 18.3) extended `validUndoPhases` to 8 phases but the `lockReset` block may not have been updated for all of them — needs audit across the full extended list.

## Solution

1. Audit `applyUndo`'s `lockReset` block in `gameEngine.ts` for all 8 phases in `validUndoPhases`. For each phase, confirm that: (a) piece position is reverted via eventLog scan, (b) the piece is removed from `movedPieceIds`, (c) `activatedPieceId`/`lastActivatedPieceId` is cleared or reset to the pre-move value, and (d) the active-player lock (socket-level or phase-level) is not prematurely released.
2. Add regression test: undo a HEADER_MOVE step, assert no other piece is selectable/moveable until the undo is fully resolved.
3. Check all other newly-extended undo phases for the same lockReset gap.
