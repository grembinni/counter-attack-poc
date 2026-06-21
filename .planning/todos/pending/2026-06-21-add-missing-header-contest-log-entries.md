---
created: 2026-06-21T12:25:19.018Z
title: Add missing HEADER contest log entries
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
  - packages/server/src/gameEngine.ts
---

## Problem

There are no log entries for the HEADER contest (the duel that decides who wins a header), unlike
TACKLE_ATTEMPT, STEAL_ATTEMPT, and SHOT_ATTEMPT which all log their duel. User feedback during Phase
18 close-out: "there are no logs for header contest but there should be like for tackle, steal,
ect."

## Solution

Check whether the server emits a HEADER-contest ActionEvent at all (gameEngine.ts) — if the event
exists but ActionLog.tsx has no render branch for it, add one using the Phase 18 `fmtStatRoll`
("Aerial Ability" stat per D-12) pattern already used for the contested-HEADER duel in 18-02. If the
event itself is missing server-side, that's a larger change — confirm event-emission scope before
starting.
