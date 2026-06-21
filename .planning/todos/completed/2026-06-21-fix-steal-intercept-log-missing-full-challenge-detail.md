---
created: 2026-06-21T12:25:19.018Z
title: Fix STEAL intercept log missing full challenge detail
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
---

## Problem

STEAL_ATTEMPT (intercept) log entries don't show the full challenge detail that TACKLE_ATTEMPT
entries do. User feedback during Phase 18 close-out: "steal (intercept) isnt showing the full
challenge logs, should be same format as tackle."

## Solution

Compare the STEAL_ATTEMPT render branch (ActionLog.tsx, ~lines 205-219 per 18-02-PLAN.md) against
the TACKLE_ATTEMPT branch (~lines 220-236) and bring STEAL_ATTEMPT's detail level up to parity —
both already use the shared `fmtStatRoll` formatter from Phase 18, so this is likely a missing
side's-worth of detail (e.g. only showing the defender's roll, not a full duel comparison) rather
than a formatting gap.
