---
created: 2026-06-21T12:25:19.018Z
title: Add missing log for pass after winning a header
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
  - packages/server/src/gameEngine.ts
---

## Problem

After a player wins a header, the resulting pass/delivery isn't logged. User feedback during Phase
18 close-out: "there are no logs for the pass after winning the header and there should be."

## Solution

Trace the post-header pass/delivery path in gameEngine.ts to find where the ball is delivered after
a won header, and confirm whether an ActionEvent is emitted for it. If missing, add the event
emission server-side and a corresponding ActionLog.tsx render branch (likely reusing the existing
pass-log format). Related to the separate "missing HEADER contest log" todo — both are gaps in
header-flow logging coverage and may be worth fixing together.
