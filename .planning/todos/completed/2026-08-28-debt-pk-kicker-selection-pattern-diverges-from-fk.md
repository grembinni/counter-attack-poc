---
created: 2026-08-28T00:00:00.000Z
title: 'Debt — PK kicker selection pattern diverges from FK kicker selection pattern'
area: client-selection
resolves_phase: 46
files:
  - packages/client/src/components/PenaltyKickSetupPanel.tsx
  - packages/client/src/components/FreeKickSetupPanel.tsx
---

## Problem

**User observation (Phase 45 checkpoint verification, 2026-08-28):** "selecting PK kicker is
different pattern than selecting FK kicker pattern. kick selection should follow common pattern
-> select kicker and then select kick/ball location"

Penalty Kick setup and Free Kick setup use different interaction sequences for choosing who takes
the kick and where it goes, even though both are restart-type kick selections. They should follow
one common pattern: select the kicker first, then select the kick/ball location.

## Cross-reference

Phase 46 ("Final Cleanup") already lists this as in-scope success criterion 3: "kicker/thrower
selection interaction is aligned across every restart type." This todo captures the specific
PK-vs-FK divergence the developer hit while testing Phase 45, so it isn't lost before Phase 46
planning — no separate implementation needed if Phase 46 already resolves it, but verify PK
specifically is covered when that phase is planned.
