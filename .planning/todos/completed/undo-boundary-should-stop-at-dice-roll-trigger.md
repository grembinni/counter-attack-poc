---
created: 2026-07-27T00:00:00.000Z
title: 'Bug — Undo can progress earlier than a dice-roll-triggering action (tackle/steal) within a move'
area: rules
resolves_phase: 36
resolved: 2026-07-28
resolution: 'Fixed as BUG-37 in Phase 36 plan 05 (36-05-SUMMARY.md) — TACKLE_ATTEMPT/STEAL_ATTEMPT added to the isBoundary set on both client canUndo and server applyUndo.'
files:
  - packages/client/src/components/ActionPanel.tsx
  - packages/server/src/gameHandlers.ts
---

## Problem

During a move, once an action has triggered a dice roll (e.g. a tackle or steal attempt), Undo should not be able to progress earlier than that action — the dice-roll outcome is committed and should act as an undo boundary. Currently Undo can step back past it.

Raised during Phase 34 (Visual Theme Restyle) discussion — an undo-boundary/state-management defect, unrelated to that phase's chrome-color scope, and unrelated to Phase 35's ActionPanel/Log scope. Logged now per user request during Phase 35 discussion to formalize it as a backlog item.

## Where to look

- `packages/client/src/components/ActionPanel.tsx` — the shared `canUndo` computation (event-log boundary scan: `SLOT_ADVANCE` / `KICK_OFF` / phase-specific reposition events). No existing boundary for `TACKLE_ATTEMPT` / `STEAL_ATTEMPT` dice-roll events.
- `packages/server/src/gameHandlers.ts` — server-side `applyUndo` validation, which should mirror whatever boundary the client enforces.

## Suggested Investigation

Add `TACKLE_ATTEMPT` and `STEAL_ATTEMPT` (and any other dice-roll-producing event type within a move) to the boundary-event set on both the client `canUndo` scan and the server's `applyUndo` guard, so Undo cannot rewind past a resolved dice roll.
