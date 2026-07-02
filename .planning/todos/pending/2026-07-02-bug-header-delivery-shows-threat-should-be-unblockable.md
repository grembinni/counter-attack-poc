---
created: 2026-07-02T11:38:09.262Z
title: 'Bug — header delivery (after winning duel) shows threat indicator; should be unblockable'
area: ui
files:
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/server/src/gameEngine.ts
---

## Problem

After a header duel is won (BUG-07 fixed direct delivery in phase 18.3), the pass/header delivery that follows still shows a threat indicator on the receiving hex in `HexGrid.tsx`. This is incorrect: header deliveries are non-contestable (server enforces this via `lastActionType === 'HEADER'` suppressing interception in `applyPass`), so no threat should be displayed.

Root cause: The client-side threat-highlight computation in `HexGrid.tsx` (the `isHighlighted`/`isThreat` logic for the PASS phase) does not check `lastActionType`. It renders threat indicators based on ZoI/defender proximity regardless of whether the delivery is actually interception-suppressed server-side.

## Solution

In `HexGrid.tsx`, gate the threat-indicator render for PASS-phase hexes behind a check on `lastActionType !== 'HEADER'` (read from game state via the Zustand store). When `lastActionType === 'HEADER'`, suppress all threat highlights for the pass delivery — show valid delivery targets without threat tinting. Mirror the same check in `ActionPanel.tsx` if it also displays a threat warning for header deliveries.
