---
phase: 08-match-lifecycle-post-game-replay
plan: '06'
subsystem: ui
tags: [react, svg, zustand, socket.io, hex-grid, game-lifecycle]

# Dependency graph
requires:
  - phase: 08-match-lifecycle-post-game-replay
    provides: '08-05 client lifecycle screens (store emitters, App routing, HalfTimeScreen, FullTimeScreen, KickOffSetupPanel)'
  - phase: 08-match-lifecycle-post-game-replay
    provides: '08-04 server handlers (game:ready, game:kick-off-move, applyKickOffReady zone validation)'
provides:
  - 'HexGrid KICK_OFF_SETUP zone tint overlays + centre-hex gold ring + kick-off-move click routing'
  - 'ActionPanel ELIGIBLE_NEXT_ACTIONS eligibility disabling + Snapshot/Header buttons'
  - "GameBoard header match-time display (N' / 45+N' added-time format)"
  - 'ReplayPanel with Action N of N counter, running/complete indicator, and Play Again button'
  - 'Full match lifecycle verified end-to-end by human across two browser tabs'
affects: [phase-09-aws-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'DOM-order z-layering for SVG polygon overlays — additional polygons after base hex fill achieve z-ordering without explicit z-index'
    - 'UX-only eligibility disabling — ELIGIBLE_NEXT_ACTIONS reflects lastActionType as disabled buttons only; server independently validates (snap-back on bypass)'
    - 'Play Again navigates to CREATE_ROOM screen via setScreen with no socket emit — server cleanup on disconnect (D-33)'

key-files:
  created:
    - packages/client/src/components/ReplayPanel.tsx
    - packages/client/src/components/ReplayPanel.module.css
  modified:
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/TurnIndicator.tsx
    - packages/server/src/game/gameEngine.ts
    - packages/server/src/game/gameHandlers.ts
    - packages/server/src/game/gameEngine.integration.test.ts
    - packages/client/vite.config.ts

key-decisions:
  - 'Kick-off zone boundary: attacking team restricted to own half only (not full centre circle); defending team excluded from q=18 column — matches physical rulebook interpretation'
  - 'home-9/away-9 starting positions adjusted to {q:14,r:13}/{q:22,r:13} to place them inside the centre circle for kick-off setup validity'
  - 'buildInitialGameState starts at KICK_OFF_SETUP (not KICK_OFF) — correct FSM entry point post D-23 fix'
  - 'Vite host:true for all-interface binding to support two-tab local testing'
  - 'SHOT and HEADER GOAL branches now transition to KICK_OFF_SETUP (not the prior incorrect phase)'

patterns-established:
  - "Zone tint overlay: additional <polygon> after base hex fill, gated on phase === 'KICK_OFF_SETUP', no new colour tokens"
  - 'Eligibility disabling: import ELIGIBLE_NEXT_ACTIONS from @counter-attack/shared, derive disabled state from lastActionType, UX only'
  - "ReplayPanel: returns null when phase !== 'REPLAY'; Play Again calls setScreen('CREATE_ROOM') only"

requirements-completed: [MATCH-01, MATCH-02, MATCH-05, REPLAY-01, REPLAY-02, SNAP-01]

# Metrics
duration: ~180min
completed: 2026-06-05
---

# Phase 8 Plan 06: In-Board Client + Full Lifecycle Verification Summary

**HexGrid kick-off zone tinting, ActionPanel sequence-eligibility disabling, match-time header display, and ReplayPanel with Play Again, plus 6 server-side correctness fixes making the full match lifecycle human-verified end-to-end.**

## Performance

- **Duration:** ~180 min (including human verification checkpoint iteration)
- **Started:** 2026-06-04
- **Completed:** 2026-06-05
- **Tasks:** 4 (Tasks 1-3 auto; Task 4 human-verify checkpoint — APPROVED)
- **Files modified:** 8

## Accomplishments

- HexGrid renders KICK_OFF_SETUP zone tints (blue/red per team), a gold ring on the centre hex {q:18,r:13}, and routes clicks to emitKickOffMove for own pieces only (opponents are no-ops)
- ActionPanel imports ELIGIBLE_NEXT_ACTIONS and disables ineligible action buttons based on lastActionType; Snapshot and Header buttons added for their respective phases
- GameBoard header shows match time in accent-gold (#f5c518) formatted as N' or 45+N' during added time; sidebar swaps between KickOffSetupPanel, ReplayPanel, and ActionPanel by phase
- ReplayPanel shows final score, "Action N of N" counter in accent-gold, "Playing..." / "Replay complete." indicator, and a "Play Again" button (visible only when complete) that returns the player to CREATE_ROOM
- Six server-side correctness bugs discovered during verification and auto-fixed (D-23 series): initial phase, GOAL transition target, zone boundary logic, starting positions, Vite host binding, and out-of-zone guard alignment between client and server
- Full match lifecycle verified by human across two browser tabs: KICK_OFF_SETUP placement, centre-hex enforcement, phase transition to KICK_OFF, clock/added-time display, half-time hand-off, full-time screen, replay auto-advance, Play Again lobby return

## Task Commits

Each task was committed atomically:

1. **Task 1: HexGrid kick-off zone tint + centre-hex ring + click routing** - `8cb0398` (feat)
2. **Task 2: ActionPanel eligibility disabling + Snapshot/Header; GameBoard match-time; sidebar swap** - `64c6b90` (feat)
3. **Task 3: ReplayPanel component** - `48b0627` (feat)
4. **Task 4 (verification iteration):**
   - `75910a0` — fix: buildInitialGameState KICK_OFF_SETUP start + GOAL→KICK_OFF_SETUP transitions (D-23)
   - `302b359` — fix: selectPiece kick-off zone hexes (all zone, no pace limit) + zone boundary logic
   - `c1b69ba` — fix: home-9/away-9 positions {q:14,r:13}/{q:22,r:13}; Vite host:true
   - `90af7dd` — fix: server applyKickOffReady OUT_OF_ZONE guard aligned to client zone definition

## Files Created/Modified

- `packages/client/src/components/HexGrid.tsx` — KICK_OFF_SETUP zone tint overlays, centre-hex gold ring polygon, kick-off-move click routing
- `packages/client/src/components/ActionPanel.tsx` — ELIGIBLE_NEXT_ACTIONS import, eligibility-based button disabling with tooltips, Snapshot and Header buttons
- `packages/client/src/components/GameBoard.tsx` — headerTime span (N'/45+N' format, accent-gold), sidebar panel swap by phase (KickOffSetupPanel/ReplayPanel/ActionPanel)
- `packages/client/src/components/TurnIndicator.tsx` — PHASE_LABEL entry for KICK_OFF_SETUP
- `packages/client/src/components/ReplayPanel.tsx` — new; replay sidebar with score, position counter, running/complete indicator, Play Again
- `packages/client/src/components/ReplayPanel.module.css` — new; .panel and .ctaButton using frozen design tokens only
- `packages/server/src/game/gameEngine.ts` — buildInitialGameState starts at KICK_OFF_SETUP; SHOT/HEADER GOAL branches transition to KICK_OFF_SETUP; applyKickOffReady OUT_OF_ZONE guard aligned
- `packages/server/src/game/gameHandlers.ts` — (supporting fixes)
- `packages/server/src/game/gameEngine.integration.test.ts` — driveToKickOff/setupRoomAtKickOff helpers; all phase assertions updated
- `packages/client/vite.config.ts` — host:true for all-interface binding

## Decisions Made

- Kick-off zone boundary interpretation: the attacking team is restricted to their own half (not the full centre circle), and the defending team is excluded from q=18 (centre column). This matches the physical rulebook's "defending team stays in their own half" rule.
- home-9 and away-9 starting positions moved to {q:14,r:13} and {q:22,r:13} respectively so they land inside the centre circle and satisfy kick-off zone validity from the initial state.
- Play Again uses setScreen('CREATE_ROOM') with no socket emit — server room cleanup happens naturally on socket disconnect (D-33 pattern).
- buildInitialGameState corrected to start at KICK_OFF_SETUP (not KICK_OFF), which is the correct entry point for a new match — the previous behaviour skipped the mandatory placement phase entirely.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] buildInitialGameState started at KICK_OFF instead of KICK_OFF_SETUP**

- **Found during:** Task 4 human verification
- **Issue:** The initial game state bypassed KICK_OFF_SETUP entirely, sending players directly into KICK_OFF without the mandatory placement phase
- **Fix:** Changed buildInitialGameState to set phase to KICK_OFF_SETUP and set attackingTeam to 'home'
- **Files modified:** packages/server/src/game/gameEngine.ts
- **Verification:** Integration tests updated; server test suite 149 pass
- **Committed in:** 75910a0

**2. [Rule 1 - Bug] SHOT and HEADER GOAL branches transitioned to wrong phase**

- **Found during:** Task 4 human verification
- **Issue:** After a goal, the FSM transitioned to KICK_OFF instead of KICK_OFF_SETUP, skipping placement
- **Fix:** Updated SHOT and HEADER GOAL outcome branches to transition to KICK_OFF_SETUP
- **Files modified:** packages/server/src/game/gameEngine.ts
- **Verification:** Server test suite 149 pass
- **Committed in:** 75910a0

**3. [Rule 1 - Bug] selectPiece computed kick-off zone hexes incorrectly (applied pace limit)**

- **Found during:** Task 4 human verification
- **Issue:** selectPiece used the standard movement pace limit when computing valid hexes during KICK_OFF_SETUP, producing too narrow a zone. All zone hexes should be available (no pace constraint)
- **Fix:** Added KICK_OFF_SETUP branch in selectPiece that computes all valid zone hexes (full zone, no pace limit)
- **Files modified:** packages/client/src/components/HexGrid.tsx (store selector), packages/client/src/store/useGameStore.ts
- **Verification:** Zone tints and click routing confirmed visually in two-tab test
- **Committed in:** 302b359

**4. [Rule 1 - Bug] Zone boundary logic: attacking team included full centre circle; defending team not correctly bounded**

- **Found during:** Task 4 human verification
- **Issue:** Attacking team's valid zone included the whole centre circle (crossing halfway), and defending team exclusion was inconsistent
- **Fix:** Attacking team restricted to own half (q<=18 for home, q>=18 for away); defending team excluded from q=18 column
- **Files modified:** packages/client/src/store/useGameStore.ts, packages/server/src/game/gameEngine.ts (applyKickOffReady guard)
- **Verification:** Human verified zone boundaries correct in both tabs
- **Committed in:** 302b359, 90af7dd

**5. [Rule 1 - Bug] home-9/away-9 starting positions not inside valid kick-off zone**

- **Found during:** Task 4 human verification
- **Issue:** Default starting positions for piece index 9 on each team were outside the valid kick-off zone, making the initial board state invalid
- **Fix:** Adjusted home-9 to {q:14,r:13} and away-9 to {q:22,r:13}
- **Files modified:** packages/shared/src/teams.ts
- **Verification:** Pieces shown in valid zone positions at game start
- **Committed in:** c1b69ba

**6. [Rule 3 - Blocking] Vite dev server not binding to all interfaces**

- **Found during:** Task 4 human verification (two-tab local test setup)
- **Issue:** Vite dev server bound only to localhost, preventing reliable two-tab access in the test environment
- **Fix:** Added host:true to vite.config.ts server config
- **Files modified:** packages/client/vite.config.ts
- **Verification:** Both browser tabs successfully connected
- **Committed in:** c1b69ba

---

**Total deviations:** 6 auto-fixed (5 Rule 1 bugs, 1 Rule 3 blocking)
**Impact on plan:** All fixes required for the human verification to pass. No scope creep — all fixes were correctness issues in Phase 8 code introduced by prior plans.

## Issues Encountered

- The integration test harness required new helpers (driveToKickOff, setupRoomAtKickOff) to set up the KICK_OFF_SETUP phase for downstream test scenarios. These were added as part of the Task 4 fix commits.
- Pre-existing test failures (2): "D-10 undo reverses last move" and "D-09 UNDO_LOCKED" — documented in 08-02 and 08-03 SUMMARYs as out-of-scope assertion mismatches; not affected by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 8 is complete. All 6 plans executed and verified:

- Full match lifecycle works end-to-end: KICK_OFF_SETUP → KICK_OFF → play → HALF_TIME → second half → FULL_TIME → REPLAY → Play Again
- Server test suite: 149 pass, 2 pre-existing failures (unchanged, documented in 08-02/08-03)
- Client TypeScript: 0 errors
- Shared build: 0 errors

Phase 9 (AWS Deployment) is unblocked. All Phase 8 requirements met.

---

_Phase: 08-match-lifecycle-post-game-replay_
_Completed: 2026-06-05_
