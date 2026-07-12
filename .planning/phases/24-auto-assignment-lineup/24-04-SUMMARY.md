---
phase: 24-auto-assignment-lineup
plan: '04'
subsystem: client
tags: [lineup, ui, drag-and-drop, stat-cards, formation-columns]
dependency_graph:
  requires: [24-01, 24-02, 24-03]
  provides: [ASSIGN-02, ASSIGN-03, ASSIGN-04]
  affects: [LineupAssignmentScreen, App.tsx, useGameStore, PlayerStatsPanel]
tech_stack:
  added: []
  patterns:
    - HTML5 native drag-and-drop (no library) per D-19
    - PLAYER_MAP O(1) module-level Map built once from PLAYER_POOL
    - Local drag state (dragSourceIndex/dropTargetIndex) — never in Zustand (Pitfall 7)
    - gameError 'GK_SLOT_LOCKED' drives swap-rejection message via useEffect
    - Flat card format with TeamBadge + NationFlag + 6-stat chip grid (role-filtered)
key_files:
  created:
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.module.css
  modified:
    - packages/client/src/components/PlayerStatsPanel.tsx
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/App.tsx
decisions:
  - 'D-13/D-14: Standalone LineupAssignmentScreen with 4-column GK|DEF|MID|FWD horizontal grid'
  - 'D-15: Full stat card with TeamBadge + NationFlag + role-filtered 6-stat chip grid (not 9-stat)'
  - 'Flat card format (badge left, content right) adopted over vertical card — matches PlayerStatsPanel post-Plan 04 styling'
  - 'D-20: GK card always renders statCardLocked class with LOCK badge; draggable=false'
  - 'D-19/D-22: onDragOver calls e.preventDefault() only for non-GK targets; multiple swaps supported pre-confirm'
  - 'D-21: onLineupAssignmentUpdated replaces assignment from server payload after each swap'
  - 'D-17: BENCH section renders 5 empty benchSlot divs with data-bench-index; no drop behavior in v1.3'
  - 'D-25: both players can confirm in any order (no home-first gate) — mirroring server parallel gate'
  - 'myConfirmedTeamId added to App.tsx local state so lineup screen renders the correct team badge'
  - 'BOTH_FORMATIONS_CONFIRMED must be emitted before LINEUP_ASSIGNMENT_READY (server-side fix b0a2e2d)'
metrics:
  duration_minutes: 90
  completed_date: '2026-07-10T21:13:10Z'
  tasks_completed: 3
  files_changed: 5
---

# Phase 24 Plan 04: LineupAssignmentScreen Client UI Summary

Delivers the player-facing lineup assignment experience: a standalone GK|DEF|MID|FWD formation grid of stat cards with HTML5 drag-to-swap, GK lock, server-authoritative updates, and confirm-to-kickoff flow.

## What Was Built

**Task 1 — Export STAT_LABELS, add Screen member, build LineupAssignmentScreen + CSS (`cba7cac`):**

- Added `export` keyword to `STAT_LABELS` in `PlayerStatsPanel.tsx`
- Added `'LINEUP_ASSIGNMENT'` to the `Screen` union in `useGameStore.ts`
- Created `LineupAssignmentScreen.tsx` — standalone component with `LineupStatCard` sub-component; groups formation slots into GK/DEF/MID/FWD columns; HTML5 drag-and-drop with GK locked; BENCH section with 5 empty placeholders; swap rejection message driven by `gameError` via `useEffect`
- Created `LineupAssignmentScreen.module.css` — dark-theme card layout matching prior setup screens; composes-based card state classes (.statCard, .statCardLocked, .statCardConfirmed, .statCardDragging, .statCardDropTarget); equal-width 3-column stat chip grid

**Task 2 — Wire App.tsx (`bfeff11`):**

- Added `lineupAssignment`, `lineupConfirmed`, `myFormationId`, `myConfirmedTeamId` local state
- `onBothFormationsConfirmed` sets `myFormationId` from `playerSlot` (no longer sets a locked flag)
- `onLineupAssignmentReady` and `onLineupAssignmentUpdated` handlers registered with matching `socket.off` cleanup
- `handleLineupSwap` emits `LINEUP_SWAP`; `handleLineupConfirm` emits `LINEUP_CONFIRM` + sets `lineupConfirmed`
- `screen === 'LINEUP_ASSIGNMENT'` render branch added; `formationsLocked` placeholder removed
- `myTeamId` prop passed from `myConfirmedTeamId` so lineup badge shows confirmed team

**Task 3 — Browser UAT (`7604bb7`, `b0a2e2d`, then styling polish):**

UAT identified three issues, all fixed:

1. `BOTH_FORMATIONS_CONFIRMED` was emitted after `LINEUP_ASSIGNMENT_READY`, causing client to render lineup before `myFormationId` was set → fixed: server now emits `BOTH_FORMATIONS_CONFIRMED` first
2. `myFormationId` could be null when lineup screen rendered on slow connections → fixed: null guard added
3. Team badge showed wrong team (store default) → fixed: `myConfirmedTeamId` local state added to App.tsx, passed as `myTeamId` prop

Extensive card layout polish commits followed (flat format, equal-width stat chips, nation flags, role-filtered stats, GK stat column order) — all verified in UAT sign-off.

## Verification Results

- `npx tsc --noEmit` in packages/client: **clean**
- `pnpm --filter @counter-attack/client run build`: **clean (✓ built in 3.68s)**
- Browser UAT: **approved** — lineup screen renders, drag-swap works, GK locked, confirm-to-kickoff confirmed

## Self-Check: PASSED

Files exist:

- `packages/client/src/components/LineupAssignmentScreen.tsx` — FOUND
- `packages/client/src/components/LineupAssignmentScreen.module.css` — FOUND

Key assertions:

- `STAT_LABELS` exported from `PlayerStatsPanel.tsx` — CONFIRMED (line 17)
- `'LINEUP_ASSIGNMENT'` in Screen union — CONFIRMED (useGameStore.ts line 30)
- GK slot locked (slotIndex === 0 guard) — CONFIRMED
- `onDragOver` calls `e.preventDefault()` only when `idx !== 0` — CONFIRMED
- BENCH section renders 5 `.benchSlot` divs with `data-bench-index` — CONFIRMED
- `onLineupAssignmentUpdated` replaces assignment (server-authoritative) — CONFIRMED
