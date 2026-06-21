---
created: 2026-06-21T12:25:19.018Z
title: ActionLog bracket labels should match scoreboard phase naming
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/GameBoard.tsx
---

## Problem

ActionLog entries prefix each line with a bracketed label (e.g. `[MOVE_A4]`) that doesn't match the
scoreboard's player-facing phase naming convention locked in Phase 18 (e.g. `MOVE 4`). User feedback
during Phase 18 close-out: "LOG [] between brackets should match score board when possible i.e.
MOVE_A4 -> MOVE 4."

## Solution

Audit every bracketed log-line prefix in ActionLog.tsx and, where a corresponding scoreboard label
already exists in GameBoard.tsx's `PHASE_LABEL` map (or the MOVE-slot suffix helper from 18-01),
reuse that exact text instead of the internal enum-ish label. This pairs with the separate todo
about the `[TURN] ATTACKER_4 -> DEFENDER_5` move-sequence header, which is the most visible instance
of this mismatch.
