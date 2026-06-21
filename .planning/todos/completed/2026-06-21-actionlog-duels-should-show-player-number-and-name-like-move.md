---
created: 2026-06-21T12:25:19.018Z
title: ActionLog duels should show player number and name like move logs
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
---

## Problem

Phase 18 (18-02) added player-number-then-name display to per-player move log lines via
`pieceName`, but TACKLE_ATTEMPT/STEAL_ATTEMPT/SHOT_ATTEMPT and other versus-style duel log entries
still identify players differently (not the same "# Name" pattern). User feedback during Phase 18
close-out: "logs should be player # then player name" and "tackle, steal, shot and other vs log
formats like it should use player # name like the move logs."

## Solution

Reuse the move-log's `pieceName`/`pieceNum` helpers (ActionLog.tsx, added in 18-02) in the duel-log
render branches for TACKLE_ATTEMPT, STEAL_ATTEMPT, SHOT_ATTEMPT, and HEADER so every player
reference across all log types is "{#} {Name}" consistently. TBD on exact formatting (e.g. "#7
Jane Doe" vs "7. Jane Doe").
