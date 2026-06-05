---
phase: 08-match-lifecycle-post-game-replay
plan: '05'
subsystem: client/lifecycle-screens
tags: [client, zustand, screen-routing, half-time, full-time, kick-off-setup, lifecycle-ui, phase8]
dependency_graph:
  requires:
    - 08-01 (HALF_TIME/FULL_TIME/REPLAY GamePhase, LastActionType, kickOffTeam in GameState)
    - 08-04 (GAME_READY/GAME_KICK_OFF_MOVE/GAME_HALF_TIME_START ClientEvents in events.ts)
  provides:
    - Screen union extended: HALF_TIME, FULL_TIME, REPLAY
    - emitReady, emitKickOffMove, emitHalfTimeStart emitters in useGameStore
    - App.tsx onGameState routes phase to HALF_TIME/FULL_TIME/REPLAY/GAME_BOARD screens
    - HalfTimeScreen component with score + Start 2nd Half (gated to non-first-half kick-off team)
    - FullTimeScreen component with score + result line + Replay starting notice
    - KickOffSetupPanel component with constraint rows + gated Ready button
  affects:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/App.tsx
    - packages/client/src/components/HalfTimeScreen.tsx + .module.css (new)
    - packages/client/src/components/FullTimeScreen.tsx + .module.css (new)
    - packages/client/src/components/KickOffSetupPanel.tsx + .module.css (new)
tech_stack:
  added: []
  patterns:
    - Zustand per-slice selectors in all new components (prevent whole-component re-renders)
    - Phase-conditional screen routing in App.tsx onGameState (D-28/D-30/D-31)
    - Local useState for "waiting for opponent" state in KickOffSetupPanel
    - Frozen CSS token inventory (no new colour/size tokens)
    - Disabled button with title attribute pattern for UX-only constraint gating
key_files:
  created:
    - packages/client/src/components/HalfTimeScreen.tsx
    - packages/client/src/components/HalfTimeScreen.module.css
    - packages/client/src/components/FullTimeScreen.tsx
    - packages/client/src/components/FullTimeScreen.module.css
    - packages/client/src/components/KickOffSetupPanel.tsx
    - packages/client/src/components/KickOffSetupPanel.module.css
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/App.tsx
    - packages/client/src/components/TurnIndicator.tsx
    - packages/client/src/mock/mockMovementState.ts
    - packages/client/src/components/ActionLog.tsx
decisions:
  - 'REPLAY phase routes to GameBoard in App.tsx — ReplayPanel sidebar swap deferred to 08-06 as planned'
  - 'KickOffSetupPanel localReady state tracks whether this player clicked Ready without needing server roundtrip'
  - 'ActionLog switch extended to cover all Phase 8 ActionEvent types (Rule 3 fix — blocking exhaustiveness error)'
  - 'TurnIndicator PHASE_LABEL gains KICK_OFF_SETUP entry (Rule 3 fix — GamePhase now includes it)'
  - 'mockMovementState gains Phase 8 fields addedTime/lastActionType/kickOffTeam/kickOffActive (Rule 3 fix — TypeScript strict check)'
metrics:
  duration_seconds: 1200
  completed: '2026-06-05'
  tasks_completed: 3
  tasks_total: 3
  files_changed: 11
---

# Phase 8 Plan 05: Client Routing and Lifecycle Screens Summary

**One-liner:** Extend Zustand Screen type and emitters, wire App.tsx phase routing, and build HalfTimeScreen/FullTimeScreen/KickOffSetupPanel with frozen token CSS and exact UI-SPEC copy.

## Tasks Completed

| Task | Name                                                    | Commit  | Files                                                                                        |
| ---- | ------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| 1    | Store Screen type + emitters; App.tsx phase routing     | 5fd39e2 | useGameStore.ts, App.tsx, TurnIndicator.tsx, mockMovementState.ts, ActionLog.tsx             |
| 2    | HalfTimeScreen + FullTimeScreen components              | 50f1931 | HalfTimeScreen.tsx, HalfTimeScreen.module.css, FullTimeScreen.tsx, FullTimeScreen.module.css |
| 3    | KickOffSetupPanel component (constraint status + Ready) | 3d97b22 | KickOffSetupPanel.tsx, KickOffSetupPanel.module.css                                          |

## What Was Built

### Task 1: Store + App.tsx

**useGameStore.ts Screen type (line 8):**

- Added `HALF_TIME`, `FULL_TIME`, `REPLAY` to the Screen union
- `KICK_OFF_SETUP` intentionally NOT added — uses `GAME_BOARD` so the pitch stays visible (UI-SPEC §Screen 1)

**useGameStore.ts emitters:**

- `emitReady()` — emits `ClientEvents.GAME_READY` (D-24)
- `emitKickOffMove(pieceId, to)` — emits `ClientEvents.GAME_KICK_OFF_MOVE` + clears selection state
- `emitHalfTimeStart()` — emits `ClientEvents.GAME_HALF_TIME_START` (D-28)

**App.tsx onGameState routing:**

- `phase === 'HALF_TIME'` → `setScreen('HALF_TIME')`
- `phase === 'FULL_TIME'` → `setScreen('FULL_TIME')`
- `phase === 'REPLAY'` → `setScreen('REPLAY')`
- else → `setScreen('GAME_BOARD')` if not already there (covers KICK_OFF_SETUP, MOVEMENT, etc.)

**App.tsx render ternary extended:**

- HALF_TIME → `<HalfTimeScreen />`
- FULL_TIME → `<FullTimeScreen />`
- REPLAY → `<GameBoard />` (ReplayPanel sidebar swap lands in 08-06)
- default → `<LobbyScreen />`

### Task 2: HalfTimeScreen + FullTimeScreen

**HalfTimeScreen.tsx:**

- Full-screen centred card (`.page` 100vh flex-centre #1a1a2e; `.card` max-width 440px #16213e)
- Per-slice selectors: `score`, `playerSlot`, `gameState.kickOffTeam`, `gameState.addedTime`, `emitHalfTimeStart`
- Renders: "Half Time" heading (20px/700/#e0e0e0); "End of 1st Half" (13px/400/#a0a0a0); score display (28px/700/#e0e0e0 monospace) with Home (#1a56b0) / Away (#c0392b) team labels; "Added time played: +N'" only when addedTime > 0; "2nd half kick-off: {team}" with team colour; "Start 2nd Half" button
- `canStart = myTeam !== null && myTeam !== kickOffTeam` — disabled with title when not canStart (Copywriting Contract copy exact)

**FullTimeScreen.tsx:**

- Same `.page`/`.card` layout
- Per-slice selector: `score`
- Renders: "Full Time" heading; score display (28px/700 monospace); result line (`score.home > score.away` → "Home wins" #1a56b0, `score.away > score.home` → "Away wins" #c0392b, else "Draw" #e0e0e0); "Replay starting…" static notice (13px/400/#a0a0a0)
- No buttons — server drives FULL_TIME → REPLAY transition after ~3s (UI-SPEC §Screen 3)

**Both CSS modules:** Strictly frozen tokens — #1a1a2e, #16213e, #0f3460, #e0e0e0, #a0a0a0, #1a56b0, #c0392b. Zero new hex values.

### Task 3: KickOffSetupPanel

**KickOffSetupPanel.tsx:**

- Returns null when `phase !== 'KICK_OFF_SETUP'` (no isActivePlayer gate — both players position pieces)
- Per-slice selectors: `gameState.phase`, `playerSlot`, `gameState.pieces`, `gameState.attackingTeam`, `gameError`, `emitReady`
- `isAttacking = myTeam === attackingTeam` — determines which constraints apply
- **Constraint 1 (attacking team only):** `centreHexOccupied` — checks if any of my pieces matches `PITCH_REGIONS.kickOffHex {q:18, r:13}`
- **Constraint 2 (both teams):** `piecesOutOfZone` — home attacking: q>18 and not in centreCircle; home defending: q>18 or in centreCircle; away attacking: q<18 and not in centreCircle; away defending: q<18 or in centreCircle
- `constraintsMet = centreHexOccupied && placementValid` — gates the Ready button
- Disabled title: attacking → "Place a player on the centre hex first"; defending → "Move all players to your own half outside the centre circle"
- Local `useState(false)` for `localReady` — switches button label to "Waiting for opponent…" after click (disabled)
- Server `gameError` displayed at #ef4444; auto-clears on next game:state via App.tsx

**KickOffSetupPanel.module.css:** `.panel` / `.ctaButton` / `.ctaButton:disabled` matching ActionPanel frozen tokens.

## Verification Evidence

- `pnpm --filter @counter-attack/client build` exits 0 (vite build: 121 modules transformed)
- `pnpm exec tsc --noEmit` exits 0 (clean TypeScript)
- `HalfTimeScreen.tsx` contains "Half Time" and "Start 2nd Half"
- `HalfTimeScreen` Start button uses `disabled={!canStart}` (canStart = `myTeam !== kickOffTeam`)
- `FullTimeScreen.tsx` contains "Full Time", covers all three result branches (Home wins / Away wins / Draw), and "Replay starting…"
- Both screen CSS modules pass frozen-token audit (no values outside the spec inventory)
- `KickOffSetupPanel.tsx` returns null when `phase !== 'KICK_OFF_SETUP'`
- Contains "Kick-Off Setup", "Ready", centre-hex constraint copy
- Ready button `disabled={!constraintsMet}` with appropriate title; switches to "Waiting for opponent…"
- `KickOffSetupPanel.module.css` uses only frozen tokens (#16213e, #0f3460, #e0e0e0, #a0a0a0, #ef4444)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ActionLog.tsx exhaustiveness error from Phase 8 ActionEvent types**

- **Found during:** Task 1 verification (`pnpm exec tsc --noEmit`)
- **Issue:** `ActionLog.tsx` had an exhaustive `switch` over `ActionEvent`. Phase 8 added 8 new ActionEvent subtypes (`HIGH_PASS`, `LONG_BALL`, `STANDARD_PASS`, `FIRST_TIME_PASS`, `SHOT_ATTEMPT`, `SNAPSHOT`, `HALF_TIME`, `FULL_TIME`) to `types.ts` (08-01). TypeScript flagged the switch as lacking an ending return statement.
- **Fix:** Added case handlers for all 8 new Phase 8 event types with appropriate `[PREFIX]` labels and content strings.
- **Files modified:** `packages/client/src/components/ActionLog.tsx`
- **Commit:** 5fd39e2

**2. [Rule 3 - Blocking] TurnIndicator.tsx missing KICK_OFF_SETUP in PHASE_LABEL**

- **Found during:** Task 1 verification
- **Issue:** `TurnIndicator.tsx` uses a `Record<GamePhase, string>` constant. Phase 8 added `KICK_OFF_SETUP` to `GamePhase` (08-01). TypeScript flagged the missing key.
- **Fix:** Added `KICK_OFF_SETUP: 'KICK OFF SETUP'` to `PHASE_LABEL` per UI-SPEC §KICK_OFF_SETUP layout.
- **Files modified:** `packages/client/src/components/TurnIndicator.tsx`
- **Commit:** 5fd39e2

**3. [Rule 3 - Blocking] mockMovementState.ts missing Phase 8 GameState fields**

- **Found during:** Task 1 verification
- **Issue:** `mockMovementState` used as the default Zustand store state. Phase 8 added `addedTime`, `lastActionType`, `kickOffTeam`, `kickOffActive` to `GameState` (08-01/08-02). TypeScript flagged the missing required fields.
- **Fix:** Added `addedTime: null`, `lastActionType: null`, `kickOffTeam: 'home'`, `kickOffActive: false` to the mock.
- **Files modified:** `packages/client/src/mock/mockMovementState.ts`
- **Commit:** 5fd39e2

## Known Stubs

None. All components read live data from the Zustand store which is populated from server-broadcast `GameState`. No hardcoded placeholder values, TODO markers, or empty collections flow to UI rendering.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or trust-boundary surface beyond the plan's threat model (T-08-16 and T-08-17 accepted). Client button gating is UX reflection only; server (08-04) validates all emitted events authoritatively.

## Self-Check: PASSED

| Item                                                                  | Status |
| --------------------------------------------------------------------- | ------ |
| packages/client/src/components/HalfTimeScreen.tsx                     | FOUND  |
| packages/client/src/components/HalfTimeScreen.module.css              | FOUND  |
| packages/client/src/components/FullTimeScreen.tsx                     | FOUND  |
| packages/client/src/components/FullTimeScreen.module.css              | FOUND  |
| packages/client/src/components/KickOffSetupPanel.tsx                  | FOUND  |
| packages/client/src/components/KickOffSetupPanel.module.css           | FOUND  |
| useGameStore.ts Screen type contains HALF_TIME, FULL_TIME, REPLAY     | FOUND  |
| useGameStore.ts defines emitReady, emitKickOffMove, emitHalfTimeStart | FOUND  |
| App.tsx routes HALF_TIME/FULL_TIME/REPLAY phases to correct screens   | FOUND  |
| pnpm --filter @counter-attack/client build exits 0                    | PASSED |
| Commit 5fd39e2 (Task 1: store + App.tsx + auto-fixes)                 | FOUND  |
| Commit 50f1931 (Task 2: HalfTimeScreen + FullTimeScreen)              | FOUND  |
| Commit 3d97b22 (Task 3: KickOffSetupPanel)                            | FOUND  |
