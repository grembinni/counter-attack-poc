---
created: 2026-06-20T02:42:32.581Z
title: Fix stale client selection on FTP/HP slot hand-off
area: client
resolves_phase: null
files:
  - packages/client/src/store/useGameStore.ts:511
---

## Problem

`setGameState`'s `slotChanged` check (useGameStore.ts:511) computes staleness only from
`GameState.movementSlot`, the plain MOVE-phase 4-5-2 slot field. That field stays `null` for the
entire duration of `FIRST_TIME_PASS_MOVE` / `HIGH_PASS_MOVE` / `GK_KICK_MOVE`, including across the
internal ATTACKER→DEFENDER hand-off — those phases track slot via `firstTimePassMovementSlot` /
`highPassMovementSlot` / `gkKickMovementSlot` instead.

Confirmed via direct read of `gameHandlers.ts:689-707` (FTP) and `:623-639` (HP): neither branch
writes `movementSlot` or `movedPieceIds`, so none of `setGameState`'s four clear-conditions fire on
this transition. The sticky-selection branch runs instead, leaving the just-finished team's
already-spent piece "selected" with live, clickable valid-move highlights through the opponent's
repositioning slot.

Found by a deep code review during Phase 17.1's fifth gap-closure verification cycle
(`.planning/phases/17.1-action-flow-cleanup/17.1-REVIEW.md`, `17.1-VERIFICATION.md`).

**Not a security/correctness issue** — independently confirmed the server remains authoritative:
`gameHandlers.ts:489` (FTP) / `:617` (HP) both gate on `isActivePlayer` and reject any click
resulting from the stale selection with `WRONG_TEAM` before any state mutation. No incorrect
persisted game state, no possession change, no rule bypass. Worst outcome is a confusing visual
snap-back on click. This is why the phase was closed without a sixth gap-closure cycle — see
`17.1-VERIFICATION.md`'s cycle-5 report for the full severity reasoning.

## Solution

Extend `slotChanged` (useGameStore.ts ~511) to also compare `firstTimePassMovementSlot`,
`highPassMovementSlot`, and `gkKickMovementSlot` between `prevState` and `newState`, so the
selection-clear branch fires correctly on every ATTACKER→DEFENDER hand-off for all three
repositioning phases. Add a regression test that calls `setGameState` twice in sequence (seeding an
ATTACKER-slot state with a selected piece, then a DEFENDER-slot state) and asserts
`selectedPieceId`/`validMoveHexes` are cleared after the second call — current coverage is zero for
a sequential `setGameState` slot hand-off.
