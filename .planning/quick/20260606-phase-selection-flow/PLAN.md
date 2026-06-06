---
slug: phase-selection-flow
created: 2026-06-06
status: in-progress
---

# Fix Phase Selection Flow

## Goal

Implement the correct choose-phase → execute-phase → choose-phase UX for the PASS game phase,
connecting pass type selection to the server and enabling proper eligible-action filtering.

## Bugs Fixed

### Bug 1: game:start-movement only accepts KICK_OFF

**File:** packages/server/src/gameHandlers.ts
**Fix:** Update phase guard from `phase !== 'KICK_OFF'` to `phase !== 'KICK_OFF' && phase !== 'PASS'`.
Only set `kickOffActive=true` on the KICK_OFF→MOVEMENT path. Validate MOVEMENT is eligible via
ELIGIBLE_NEXT_ACTIONS when coming from PASS.

### Bug 2: Pass type never sent to server

**File:** packages/shared/src/events.ts, packages/server/src/gameHandlers.ts, packages/client/src/store/useGameStore.ts
**Fix:** Add optional `passType` parameter to `game:roll` event. Server validates passType eligibility
against current lastActionType, then sets lastActionType=passType before calling applyRoll.

### Bug 3: No "Choose Phase" menu — all controls shown simultaneously

**File:** packages/client/src/components/ActionPanel.tsx
**Fix:** In PASS phase, show an eligible-action menu derived from ELIGIBLE_NEXT_ACTIONS[lastActionType]
(null → treated as MOVEMENT_PHASE). After player selects a pass type (stored in local state), show
Roll Dice. After emit, clear local selection. Non-pass actions (Move, Snapshot, Shot) trigger
immediately without a roll step.

### Bug 4: SHOT option missing from eligible actions

**File:** packages/client/src/components/ActionPanel.tsx
**Fix:** When SHOT is in the eligible set, render a Shoot button that calls emitSnapshot (same
mechanism as Snapshot — server differentiates by position/penalty).

## Tasks

1. [x] Create quick task directory
2. [ ] Fix GAME_START_MOVEMENT handler (gameHandlers.ts)
3. [ ] Add passType to ClientToServerEvents GAME_ROLL (events.ts)
4. [ ] Update GAME_ROLL server handler to accept/validate passType (gameHandlers.ts)
5. [ ] Add emitRoll(passType?) to useGameStore.ts
6. [ ] Redesign ActionPanel PASS phase UI
7. [ ] TypeScript check + commit
