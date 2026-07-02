---
created: 2026-07-02T11:38:09.262Z
title: 'Bug — loose ball from keeper short-throw restart disappears and is not logged'
area: rules
files:
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
---

## Problem

When a goalkeeper takes a short-throw restart and the pass results in a loose ball (e.g. no teammate at target hex, or deflection), the ball vanishes from the board entirely and no event is emitted to the action log. The game state becomes unrecoverable.

Likely root cause: The GK short-throw restart handler in `gameHandlers.ts` routes to a pass-delivery path, but when that delivery results in a loose-ball condition (no occupant at target, or occupant is an opponent), the `carrierId: null` / `LOOSE_BALL` transition is either not triggered or the resulting state is emitted without a `LOOSE_BALL` ActionEvent being pushed to `eventLog`. The ball position may also not be updated to `targetHex` in the loose-ball branch.

## Solution

1. Find the GK short-throw restart handler path (likely `GAME_GK_RESTART` or similar in `gameHandlers.ts` → delivery in `gameEngine.ts`).
2. Trace the loose-ball branch: confirm a `LOOSE_BALL` event is pushed to `eventLog` with `position: targetHex` and `carrierId: null`.
3. Confirm `broadcastState` emits the updated state with the ball at `targetHex`.
4. Add regression test: GK short-throw to empty hex → loose ball event logged, ball visible at target hex.
