---
created: 2026-08-23T00:00:00.000Z
title: 'UX — moving piece is not auto-reselected (with movement ring) after an interrupt prompt resumes play'
area: client-selection
resolves_phase: 46
files:
  - packages/client/src/store/useGameStore.ts
---

## Problem

When a move is interrupted by a duel/decision prompt (`TACKLE_STEAL_PROMPT`,
`GK_DIVE_AT_FEET_PROMPT`, `GK_BOX_ENTRY_PROMPT`, `FOUL_CHOICE`) and play then resumes back to
`MOVE`, the piece that was mid-movement is NOT automatically re-selected with its movement ring,
even if it still has moves remaining. The player has to manually re-click the piece to see valid
destinations again.

**User observation (Phase 43 UAT):** after declining/resolving a tackle/steal prompt, focus
should return to the moved player — selected with movement ring shown — if moves are still
remaining.

## Root Cause

`useGameStore.ts`'s `setGameState` clears `selectedPieceId`/`validMoveHexes` on every
`phaseChanged` transition (~line 1425 `phaseChanged`), with no exception for "returned to MOVE
from an interrupt phase, same piece, moves remaining." Entering AND leaving an interrupt phase
are both `phaseChanged` events, so selection is wiped on both transitions.

Confirmed this is NOT phase-43-specific: none of `gkDiveAtFeetResume`, `gkBoxEntry`-equivalent,
or `tackleStealPromptResume` fields are read anywhere client-side
(`grep -rn "gkDiveAtFeetResume\|tackleStealPromptResume" packages/client/src/` returns nothing
outside tests) — this is a pre-existing gap across every interrupt-style prompt, not a regression
introduced by Phase 43.

## Suggested Fix Approach

In `setGameState`, when `phaseChanged` is true AND the new phase is `MOVE` (or a movement
sub-phase) AND the previous phase was one of the known interrupt/prompt phases
(`TACKLE_STEAL_PROMPT`, `GK_DIVE_AT_FEET_PROMPT`, `GK_BOX_ENTRY_PROMPT`, `FOUL_CHOICE`) AND the
resume snapshot's piece still has moves remaining (pace/movedPieceIds check), skip the
selection-clearing branch and instead re-select that piece the same way the "sticky selection"
path below it already does for non-phase-changing broadcasts (recompute `validMoveHexes` via
`computeMovementValidHexes`).

This affects all four interrupt phases identically — fix once in the shared `setGameState`
resume-detection logic rather than per-phase.
