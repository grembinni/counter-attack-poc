---
created: 2026-06-21T12:25:19.018Z
title: Make DEFLECT log more meaningful and clear
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
---

## Problem

The SNAPSHOT_DEFLECT log entry isn't clear. User feedback during Phase 18 close-out: "deflect log
isnt clear and should be more meaningful."

## Solution

Review the current SNAPSHOT_DEFLECT render branch in ActionLog.tsx and rewrite it for clarity — TBD
on exact wording, but should follow the same spelled-out, named-player conventions established by
Phase 18 for other duel/move logs (player # + name, fmtStatRoll-style stat breakdown where
applicable).
