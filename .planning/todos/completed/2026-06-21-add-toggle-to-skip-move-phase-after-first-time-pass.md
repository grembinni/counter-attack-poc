---
created: 2026-06-21T12:25:19.018Z
title: Add toggle to skip move phase after first-time pass
area: rules
resolves_phase: '18.3'
files:
  - packages/server/src/gameEngine.ts
  - packages/shared/src/types.ts
---

## Problem

User wants the ability to skip the repositioning move phase that follows a completed first-time
pass, without removing the underlying feature. User feedback during Phase 18 close-out: "gameplay -
create a toggle for the move phase after 1 time passe, I want to skip it for now. dont delete just
toggle off." User explicitly requested this be added to Phase 18.3 (Bug-Bash: Rule Correctness)
scope.

## Solution

Add a config/feature-flag toggle (default TBD — likely off per "I want to skip it for now") that,
when disabled, causes the FIRST_TIME_PASS_MOVE transition in gameEngine.ts to be bypassed (deliver
the ball and proceed directly to the next phase, as if no repositioning window existed) while
leaving the FIRST_TIME_PASS_MOVE phase/handler code intact for when the toggle is re-enabled. Tagged
`resolves_phase: "18.3"` so it surfaces when Phase 18.3 is planned.
