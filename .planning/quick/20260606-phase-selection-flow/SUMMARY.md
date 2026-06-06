---
slug: phase-selection-flow
status: complete
completed: 2026-06-06
commit: c6a1cbf
---

# Phase Selection Flow — Complete

## What was fixed

**Bug 1 — game:start-movement KICK_OFF-only:** Handler now accepts both `KICK_OFF` and `PASS`
phases. `kickOffActive=true` is only set on the KICK_OFF path; PASS→MOVEMENT starts a fresh
4-5-2 sequence without kick-off constraints.

**Bug 2 — Pass type never reached server:** `game:roll` now accepts an optional `passType`
parameter (`'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL'`). The server
validates eligibility against `ELIGIBLE_NEXT_ACTIONS[lastActionType]` (null treated as
MOVEMENT_PHASE) then sets `lastActionType=passType` before calling `applyRoll`. The engine
now records the correct action type and time cost per pass.

**Bug 3 — No choose-phase menu:** ActionPanel PASS phase now has an explicit two-step flow:

- Step 1: eligible-action chooser derived from `ELIGIBLE_NEXT_ACTIONS[lastActionType]`
- Step 2 (after picking a pass type): Roll Dice + Back button

Phase changes auto-clear local `selectedPassType` via `useEffect`.

**Bug 4 — SHOT option missing:** A "Shoot" button now appears in the chooser when `SNAPSHOT`
or `SHOT` is in the eligible set; calls `emitSnapshot` (server differentiates by carrier
position for penalty application).

## Files changed

- `packages/shared/src/events.ts` — passType param on GAME_ROLL
- `packages/server/src/gameHandlers.ts` — GAME_START_MOVEMENT + GAME_ROLL handlers
- `packages/client/src/store/useGameStore.ts` — emitRoll(passType?) signature
- `packages/client/src/components/ActionPanel.tsx` — full rewrite with choose-phase flow
- `packages/client/src/components/ActionPanel.module.css` — phaseLabel + backButton styles
