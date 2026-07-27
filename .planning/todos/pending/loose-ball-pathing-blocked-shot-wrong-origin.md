---
created: 2026-07-27T00:00:00.000Z
title: 'Bug — loose-ball pathing on a blocked shot paths from the shooting square instead of the blocking square'
area: rules
resolves_phase: null
files:
  - packages/server/src/gameEngine.ts
---

## Problem

When a shot is blocked/deflected and the ball becomes a loose ball, the resulting scatter path is computed from the shooter's square instead of the square where the block/deflection actually occurred.

Raised during Phase 34 (Visual Theme Restyle) discussion — a gameplay-logic defect, unrelated to that phase's chrome-color scope, and unrelated to Phase 35's ActionPanel/Log scope. Logged now per user request during Phase 35 discussion to formalize it as a backlog item.

## Where to look

- `packages/server/src/gameEngine.ts` — `computeShotPathDeflection` (~line 3615) and the `computeLooseBall` scatter-trajectory walk (~line 2757) that consumes the deflection/block outcome.

## Suggested Investigation

Confirm which hex `computeLooseBall`'s `from` argument is seeded with when a shot is blocked — it should be the blocking piece's/deflection hex, not the shooter's origin hex.
