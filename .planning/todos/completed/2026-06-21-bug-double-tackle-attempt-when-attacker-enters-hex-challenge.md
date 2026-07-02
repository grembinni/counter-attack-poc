---
created: 2026-06-21T12:25:19.018Z
title: Bug - double tackle attempt when attacker enters hex challenged by two defenders
area: rules
resolves_phase: '18.3'
files:
  - packages/shared/src/moveValidator.ts
  - packages/server/src/gameEngine.ts
---

## Problem

When an attacker moves into a hex that is within Zone of Influence of two defenders, only one
tackle attempt currently fires. User feedback during Phase 18 close-out: "bug - when attacker move
into a hex challenged by 2 player there should be tackle attempt from one defender, if the attacker
keeps the ball then there should be a tackle attempt from the second defender." User explicitly
requested this be added to Phase 18.3 (Bug-Bash: Rule Correctness) scope.

## Solution

TBD — needs investigation into the ZoI/tackle-attempt resolution path (moveValidator.ts /
gameEngine.ts) to determine where the second-defender tackle attempt should be sequenced in: after
the first tackle resolves with the attacker retaining the ball, trigger a second TACKLE_ATTEMPT
against the second contesting defender before the move fully resolves. Tagged `resolves_phase:
"18.3"` so it surfaces when Phase 18.3 is planned.
