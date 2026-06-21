---
created: 2026-06-21T12:25:19.018Z
title: SHOT log should separate challenge and handling entries
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
---

## Problem

SHOT_ATTEMPT currently logs the shooter/GK duel and the handling sub-check together in one entry.
User feedback during Phase 18 close-out: "Shot should have seperate logs for challenge and
handling."

## Solution

Split the SHOT_ATTEMPT render branch (ActionLog.tsx, per 18-02-PLAN.md ~lines 275-304) into two
distinct log lines: one for the Shooting-vs-Saving duel (the `fmtStatRoll` pair), and a separate one
for the handling sub-check (`handling: {die} vs {gkHandling} ({result})`) that currently rides along
in the same entry.
