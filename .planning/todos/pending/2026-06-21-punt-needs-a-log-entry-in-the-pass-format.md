---
created: 2026-06-21T12:25:19.018Z
title: Punt needs a log entry in the pass format
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
  - packages/server/src/gameEngine.ts
---

## Problem

The GK Punt (GK_KICK_TARGET, renamed from "Kick" to "Punt" in Phase 18-03) doesn't have a log entry
in the standard pass format. User feedback during Phase 18 close-out: "Punt needs a log in the pass
format."

## Solution

Confirm whether gameEngine.ts emits an ActionEvent for the GK punt delivery, then add (or extend) an
ActionLog.tsx render branch for it using the same pass-log format/conventions as the other pass
types (Standard/High/Long Pass).
