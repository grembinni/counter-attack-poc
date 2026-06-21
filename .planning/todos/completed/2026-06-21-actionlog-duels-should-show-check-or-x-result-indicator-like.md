---
created: 2026-06-21T12:25:19.018Z
title: ActionLog duels should show check or x result indicator like passes
area: ui
resolves_phase: null
files:
  - packages/client/src/components/ActionLog.tsx
---

## Problem

Pass log entries use a checkmark/x-mark style result indicator. TACKLE_ATTEMPT, STEAL_ATTEMPT,
SHOT_ATTEMPT, and other versus-style duel log entries don't use the same indicator convention. User
feedback during Phase 18 close-out: "tackle, steal, shot and other vs log formats like it should
use the check / x pass like passes use."

## Solution

Identify the pass log's success/fail indicator (likely a ✓/✗ glyph or styled span near the outcome
text) and apply the same indicator to the duel-log render branches (TACKLE_ATTEMPT, STEAL_ATTEMPT,
SHOT_ATTEMPT, HEADER) based on each event's win/lose outcome. TBD on exact glyph/styling reuse —
check whether the pass indicator is a shared component or inline JSX before duplicating it.
