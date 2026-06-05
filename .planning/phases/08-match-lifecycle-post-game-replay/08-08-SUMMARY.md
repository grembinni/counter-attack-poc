---
phase: 08-match-lifecycle-post-game-replay
plan: '08'
subsystem: ui
tags: [react, zustand, actionpanel, snapshot, selection-state]

# Dependency graph
requires:
  - phase: 08-match-lifecycle-post-game-replay
    provides: applySnapshot server logic, SNAP-01 trigger conditions, gameHandlers.ts, useGameStore.ts baseline
provides:
  - ActionPanel Snapshot button gated on reachable SNAP-01 trigger conditions (canSnapshot boolean)
  - setGameState clears selectedPieceId and validMoveHexes on every server push
affects: [09-aws-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Permissive client UX reflection: client computes a superset of server trigger conditions, server re-validates and rejects'
    - 'Server-push state reset: clear all client selection/highlight state on every setGameState call'

key-files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/store/useGameStore.ts

key-decisions:
  - 'Snapshot button uses permissive client reflection (MOVEMENT+penalty area OR PASS+lastActionType) — server applySnapshot is the authoritative gate; client guard is UX only'
  - 'setGameState resets both selectedPieceId: null and validMoveHexes: [] in a single set() call, matching the reset pattern already used by emitMove and emitKickOffMove'

patterns-established:
  - 'Client action button visibility: derive from reachable game-state conditions, not from unreachable phase values'
  - 'Zustand state reset: multi-field reset in single set() call prevents partial state inconsistency'

requirements-completed: [MATCH-03, MATCH-05]

# Metrics
duration: 15min
completed: 2026-06-05
---

# Phase 8 Plan 08: CR-01/CR-04 Client-Side Gap Closure Summary

**Snapshot button now uses reachable canSnapshot boolean (MOVEMENT+penalty area OR PASS+lastActionType), and setGameState atomically clears selectedPieceId and validMoveHexes on every server push**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-05T11:46:00Z
- **Completed:** 2026-06-05T12:01:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- CR-01 (client end) resolved: ActionPanel Snapshot button re-gated from the unreachable `phase === 'SNAPSHOT'` to a `canSnapshot` boolean derived from the actual SNAP-01 trigger conditions (ball carrier in opponent penalty area during MOVEMENT, or post-pass in PASS phase with lastActionType present)
- CR-04 resolved: `setGameState` now clears `selectedPieceId: null` and `validMoveHexes: []` atomically in every server broadcast, eliminating stale selection rings and move highlights that persisted across end-turn, phase change, goal, and kick-off repositioning events
- Client `tsc --noEmit` and `pnpm build` both exit 0 with no warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-gate Snapshot button on reachable SNAP-01 trigger conditions (CR-01)** - `7904bd0` (fix)
2. **Task 2: setGameState clears stale selection state on server push (CR-04)** - `2573ade` (fix)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified

- `packages/client/src/components/ActionPanel.tsx` - Added `isInRegion` import, `attackingTeam` selector, `canSnapshot` computation; replaced `phase === 'SNAPSHOT'` guard with `canSnapshot`
- `packages/client/src/store/useGameStore.ts` - Extended `setGameState` to also reset `selectedPieceId: null` and `validMoveHexes: []`

## Decisions Made

- Client snapshot trigger is a permissive superset (phase PASS + any lastActionType) rather than a strict re-implementation of the server's passTypes set. The server applySnapshot independently rejects ineligible snapshots; re-implementing the exact set client-side would create a maintenance hazard.
- Single `set(...)` call in `setGameState` maintains Zustand's atomic update guarantee — both fields reset together, never partially.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The worktree did not have node_modules installed. Required running `pnpm install` and `pnpm --filter @counter-attack/shared build` in the worktree before TypeScript verification could run. This is a standard worktree bootstrap step, not a code issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 8 verification gaps are now closed (08-07 server, 08-08 client)
- Client build passes; no outstanding TypeScript errors
- Ready for Phase 9 AWS Deployment

---

_Phase: 08-match-lifecycle-post-game-replay_
_Completed: 2026-06-05_
