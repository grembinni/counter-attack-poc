---
created: 2026-06-21T12:25:19.018Z
title: Remove outline boxes from ActionPanel and kick-off helper text
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionPanel.tsx
---

## Problem

The light-blue outline boxes around ActionPanel helper text don't read as needed — user feedback
during Phase 18 close-out: "back doesn[']t need outline - review and remove all light blue outline
boxes from the action panel." The kick-off helper text specifically should be more meaningful and
should not have a box around it either.

## Solution

Review every helper-text block in ActionPanel.tsx and remove the light-blue outline/box styling.
Pay particular attention to the kick-off (KICK_OFF/KICK_OFF_SETUP) helper text, which also needs
more meaningful copy in addition to losing its box. TBD on exact CSS/className changes — audit
`ActionPanel.module.css` (or equivalent) for the outline rule first.
