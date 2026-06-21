---
created: 2026-06-21T12:25:19.018Z
title: Show remaining-player countdown in MOVE and FREE_MOVE phase prompts
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionPanel.tsx
---

## Problem

MOVE and FREE_MOVE phase helper text currently shows a static "Move up to {N} players." line but
doesn't count down as players are moved during the phase. User feedback during Phase 18 close-out:
"move & free move needs to count down the number of players left to move, update current message
pattern to support this."

## Solution

Extend the MOVE/FREE_MOVE helper-text line to derive a remaining-count (e.g. "{total} players,
{remaining} left to move") from the existing moved-piece tracking (`movedPieceIds` /
`paceUsedByPieceId` in GameState). TBD on exact phrasing — needs a message-pattern update since the
current text is static, not derived per-render from progress.
