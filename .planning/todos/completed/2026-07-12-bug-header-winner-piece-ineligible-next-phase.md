---
title: 'Bug: Header winner piece should be ineligible in the subsequent movement phase'
date: 2026-07-12
priority: medium
tags: [bug, header, rules]
---

## Problem

After winning a header duel and targeting a hex, the piece that made the header
should be marked as already activated for the next movement phase and cannot move
or participate in that phase. Currently the piece is treated as a fresh player
with full movement available.

## Expected behaviour

The winner piece's ID should be added to `movedPieceIds` when the header target
resolves (non-goal route), so that:

- The piece appears as "activated / spent" (grey ring) in the next MOVE phase
- `canSelect` is false for that piece — it cannot be selected for movement
- The piece still renders normally on the pitch — it just cannot act

## Affected code

- `packages/server/src/gameEngine.ts` — `applyResolveHeaderTarget`: add winner ID
  to `movedPieceIds` on both the occupant (PASS) and empty-hex (PASS, loose ball) branches
- Corresponding tests in `gameEngine.rule11.test.ts`

## Notes

The goal-line route already enters `GK_DIVE` phase (a different flow); the
ineligibility rule likely only applies to the non-goal branches above.
