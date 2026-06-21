---
created: 2026-06-21T12:25:19.018Z
title: Move-sequence log header should show MOVE slot labels colored by team
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
---

## Problem

The move-sequence change log header currently reads `[TURN] ATTACKER_4 -> DEFENDER_5`. User
feedback during Phase 18 close-out: "change in move sequence [TURN] ATTACKER_4 -> DEFENDER_5 should
instead be [MOVE 4] -> [MOVE 5] each move being in color of team owning that action."

## Solution

Replace the `ATTACKER_4`/`DEFENDER_5`/`ATTACKER_2` slot labels in this log header with the
scoreboard-matching `MOVE 4`/`MOVE 5`/`MOVE 2` labels (reuse the `moveSlotSuffix` helper added in
Phase 18-01), and color each bracketed `[MOVE N]` segment by the team that owns that slot (attacker
vs defender team color) rather than rendering both segments in one neutral color. Related to the
separate "ActionLog bracket labels should match scoreboard" todo — this is the highest-visibility
instance of that mismatch.
