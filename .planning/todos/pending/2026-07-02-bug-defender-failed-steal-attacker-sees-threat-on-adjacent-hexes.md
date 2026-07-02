---
created: 2026-07-02T11:38:09.262Z
title: 'Bug — after defender fails steal, attacker still sees threat on adjacent hexes'
area: rules
files:
  - packages/client/src/components/HexGrid.tsx
  - packages/shared/src/moveValidator.ts
---

## Problem

When a defender has already attempted a steal/tackle and failed (`tackleAttemptedByIds` contains that defender's ID, or the defender has a `hasAttemptedSteal` flag), the attacker should be able to move adjacent to that defender freely — no threat highlight, no tackle re-attempt. However, `HexGrid.tsx` still highlights those hexes as threats (red/orange tint) even though the server-side `validateMove` already excludes that defender from the tackle-attempt list.

Root cause: The client-side threat-highlight computation in `HexGrid.tsx` calculates ZoI threat based on raw defender adjacency (hexDistance=1, opposing team) without checking whether those defenders have already exhausted their steal attempt against the current carrier. The server's `tackleAttemptedByIds` exclusion (in `moveValidator.ts`) prevents a second tackle server-side, but the client doesn't read this state to suppress the threat glow.

## Solution

In `HexGrid.tsx`, when computing which destination hexes show a threat indicator during MOVE:

- Read `tackleAttemptedByIds` from the game state (already in GameState, synced via WebSocket).
- Exclude any defender whose ID is in `tackleAttemptedByIds` from the ZoI-threat calculation for the current carrier's moves.
- Hexes adjacent only to already-attempted defenders should render as normal (no threat tint), identical to hexes not in any defender's ZoI.

This mirrors the server-side exclusion already in `moveValidator.ts` (~line 120) and makes the client display consistent with what the server will actually do.
