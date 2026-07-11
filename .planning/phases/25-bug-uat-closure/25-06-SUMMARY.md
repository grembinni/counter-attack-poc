---
phase: 25-bug-uat-closure
plan: 06
subsystem: game-engine
tags: [free-kick, offside, undo, action-panel, hex-grid, game-state]

# Dependency graph
requires:
  - phase: 17-rule-bugs
    provides: FREE_KICK_SETUP phase FSM, FK_SETUP_MOVE event type, applyFreeKickMove/applyFreeKickReady engine functions, triggerOffsideFoul
  - phase: 25-bug-uat-closure (plan 05)
    provides: UAT outcome identifying free-kick step sequence as incorrect; gap plan 25-06 created from D-03
provides:
  - freeKickKickerChosen field on GameState tracks kicker-select sub-step lifecycle
  - FK_KICKER_CHOSEN and FK_STAGE_ADVANCE ActionEvent types as undo boundary markers
  - Correct FREE_KICK_STAGES max (4,4,3,2 instead of 5,5,3,2)
  - Server-side kicker-select enforcement in applyFreeKickMove
  - applyUndo respects FK stage boundaries — cross-stage undo blocked
  - ActionPanel dedicated FREE_KICK_SETUP block with kicker-select, move counter, gated End Turn
  - HexGrid eligible-player blue ring in repositioning stages
affects: [25-07, OFFSIDE-02 UAT closure in plan 07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Boundary-event pattern: emit FK_KICKER_CHOSEN/FK_STAGE_ADVANCE as undo slot boundaries in applyFreeKickMove/applyFreeKickReady; mirror boundary scan in both applyUndo (server) and canUndo (client)'
    - 'Phase-before-isActivePlayer pattern: FREE_KICK_SETUP render block placed before !isActivePlayer guard so both teams see correct waiting/active panel'
    - "Eligibility-ring suppression: isFreeKickEligible gates selectionState='selectable' independently of isClickable to allow clicking without showing ring during kicker-select sub-step"

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/offside.ts
    - packages/server/src/gameEngine.ts
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/HexGrid.tsx

key-decisions:
  - 'freeKickKickerChosen initialized to false in triggerOffsideFoul, set to true on FK_KICKER_CHOSEN, cleared to null on FREE_KICK_SETUP exit — distinct from the old hex-scan approach'
  - 'FREE_KICK_STAGES stage 0 and 1 max reduced from 5 to 4: kicker placement is a prior dedicated step outside the 4-move budget'
  - 'FK_KICKER_CHOSEN and FK_STAGE_ADVANCE are boundary-only events — never themselves undoable; applyUndo boundary scan uses phase===FREE_KICK_SETUP guard to avoid false-positive boundaries in other phases'
  - "isFreeKickEligible drives selectionState='selectable' in HexGrid instead of canSelectFreeKick, suppressing blue ring during kicker-select sub-step while keeping pieces clickable"
  - 'Backward-compat fallback in applyFreeKickMove: when freeKickKickerChosen is null/undefined (pre-fix states), original hex-scan guard still fires'

patterns-established:
  - 'Plan 25-06 FK boundary pattern: FK_KICKER_CHOSEN and FK_STAGE_ADVANCE emitted as slot boundaries; both server applyUndo and client canUndo mirror the same boundary scan'

requirements-completed: [OFFSIDE-02]

# Metrics
duration: 35min
completed: 2026-07-11
---

# Phase 25 Plan 06: FREE_KICK_SETUP Step Sequence Fix Summary

**Fixed FREE_KICK_SETUP flow: kicker-select sub-step, stage max 4, per-stage undo boundaries, and dedicated ActionPanel block with eligible-ring in HexGrid**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-11T16:30:00Z
- **Completed:** 2026-07-11T17:02:33Z
- **Tasks:** 5
- **Files modified:** 5

## Accomplishments

- Kicker-select sub-step enforced server-side: kicking team must place kicker on freeKickHex before any repositioning moves; non-freeKickHex destinations return KICKER_PLACEMENT_REQUIRED
- Stage move caps corrected (max 4 for stages 0 and 1) — kicker placement is now a dedicated prior step excluded from the budget
- Undo cannot cross stage boundaries: FK_KICKER_CHOSEN and FK_STAGE_ADVANCE are slot boundaries in both server applyUndo and client canUndo
- ActionPanel dedicated FREE_KICK_SETUP block shows kicker-select helper text, per-stage move counter, gated Undo and End Turn (yellow/green)
- HexGrid shows blue eligible ring for not-yet-placed active-team pieces during repositioning stages; ring suppressed during kicker-select sub-step

## Task Commits

1. **Task 1: Shared types — freeKickKickerChosen, FK boundary event types, stage max 4** - `56a4927` (feat)
2. **Task 2: Server — kicker-select enforcement, FK_KICKER_CHOSEN/FK_STAGE_ADVANCE emission** - `803921a` (feat)
3. **Task 3: Server — applyUndo FK boundary scan** - `46967df` (fix)
4. **Task 4: Client — ActionPanel FREE_KICK_SETUP block and canUndo fix** - `b4d2c29` (feat)
5. **Task 5: Client — HexGrid eligible-player blue ring** - `400a3b1` (feat)

## Files Created/Modified

- `packages/shared/src/types.ts` - Added freeKickKickerChosen to GameState; FK_KICKER_CHOSEN and FK_STAGE_ADVANCE to ActionEventType union and ActionEvent discriminated union
- `packages/shared/src/offside.ts` - FREE_KICK_STAGES stage 0 and 1 max 5→4; triggerOffsideFoul initializes freeKickKickerChosen: false
- `packages/server/src/gameEngine.ts` - applyFreeKickMove kicker-select block; applyFreeKickReady FK_STAGE_ADVANCE emission and freeKickKickerChosen: null on exit; applyUndo FK boundary scan
- `packages/client/src/components/ActionPanel.tsx` - FREE_KICK_STAGES and freeKickStageTeam imports; freeKick store selectors; canUndo FK boundary events; dedicated FREE_KICK_SETUP render block
- `packages/client/src/components/HexGrid.tsx` - freeKickKickerChosen selector; activeTeamForStage extracted; isFreeKickEligible flag; selectionState gated on isFreeKickEligible for FREE_KICK_SETUP

## Decisions Made

- freeKickKickerChosen uses `?: boolean | null` matching the other freeKick optional fields so existing spread patterns do not break
- Backward-compat path in applyFreeKickMove: when freeKickKickerChosen is null/undefined, the original hex-scan guard still fires (no breaking change for any in-flight game state created before this fix)
- isFreeKickEligible drives selectionState='selectable' separately from isClickable: pieces remain clickable during kicker-select (server provides the enforcement) but do not show the blue ring
- FK_STAGE_ADVANCE is emitted BEFORE freeKickPlacedPieceIds reset so the event is always committed even if the reset path changes

## Deviations from Plan

None - plan executed exactly as written. Minor implementation detail: 'eligible' SelectionState value does not exist in the codebase (type is 'none' | 'selectable' | 'active' | 'activated'), so 'selectable' was used as the blue-ring value as intended by the plan.

## Issues Encountered

- TypeScript in worktree had no node_modules on first attempt — resolved by running `pnpm install` in the worktree root. Pre-existing implicit-any errors in gameHandlers.ts/roomHandlers.ts were confirmed pre-existing (0 errors on baseline build after shared package was built).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 25-07 (revert selectedIsMoving counter regression) can proceed independently
- OFFSIDE-02 UAT closure requires Plan 07 checkpoint where a live two-tab session validates the corrected step sequence
- FK_KICKER_CHOSEN and FK_STAGE_ADVANCE boundary events are in the event log for any replay-eligible replay work if needed

---

_Phase: 25-bug-uat-closure_
_Completed: 2026-07-11_
