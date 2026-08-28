---
created: 2026-08-28T00:00:00.000Z
title: 'Debt — move game speed setting into the Advanced Settings drawer'
area: settings
files:
  - packages/client/src/components/GameSettingsScreen.tsx
---

## Problem

**User observation (Phase 45 checkpoint verification, 2026-08-28):** "move speed to advance
settings"

The game speed setting currently lives outside the Advanced Settings drawer (added in Phase 44:
"Referee Leniency & Advanced Settings Drawer"). The developer wants it relocated into that
drawer alongside the other advanced toggles, for consistency.

## Suggested Fix Approach

Locate the speed control in `GameSettingsScreen.tsx` and move it into the same
advanced-settings section/drawer introduced in Phase 44, following that drawer's existing
layout and disclosure pattern rather than inventing a new one.
