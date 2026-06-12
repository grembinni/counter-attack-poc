---
phase: 13-layout-clock
plan: 03
subsystem: ui
tags: [react, routing, zustand, typescript]

# Dependency graph
requires:
  - phase: 13-layout-clock plan 02
    provides: GameBoard HALF_TIME/FULL_TIME overlays, top-band layout, absorbed TurnIndicator/HalfTimeScreen/FullTimeScreen content

provides:
  - Simplified App.tsx routing — all game phases (including HALF_TIME/FULL_TIME) render GameBoard
  - Screen type trimmed — HALF_TIME and FULL_TIME removed from union
  - Six retired component/CSS files deleted (TurnIndicator, HalfTimeScreen, FullTimeScreen)

affects: [App.tsx consumers, any future Screen-type usage, Phase 14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - D-12: HALF_TIME/FULL_TIME phases fall through App.tsx routing to GameBoard; overlays rendered inside GameBoard pitch area

key-files:
  created: []
  modified:
    - packages/client/src/App.tsx
    - packages/client/src/store/useGameStore.ts
  deleted:
    - packages/client/src/components/TurnIndicator.tsx
    - packages/client/src/components/TurnIndicator.module.css
    - packages/client/src/components/HalfTimeScreen.tsx
    - packages/client/src/components/HalfTimeScreen.module.css
    - packages/client/src/components/FullTimeScreen.tsx
    - packages/client/src/components/FullTimeScreen.module.css

key-decisions:
  - "D-12 finalised: App.tsx onGameState handler removes HALF_TIME/FULL_TIME branches; render tree collapses to screen === 'GAME_BOARD' || screen === 'REPLAY' ? GameBoard : LobbyScreen"
  - 'Screen type trimmed to 6 members — HALF_TIME and FULL_TIME removed; REPLAY retained (App.tsx still branches on it)'
  - 'emitHalfTimeStart preserved in useGameStore — called by GameBoard HALF_TIME overlay, not deleted with HalfTimeScreen component'

patterns-established:
  - 'All game phases route through GameBoard; phase-specific UI is overlay-based, not screen-based'

requirements-completed: [LAYOUT-01, CLOCK-02]

# Metrics
duration: 6min
completed: 2026-06-12
---

# Phase 13 Plan 03: Routing Simplification Summary

**App.tsx HALF_TIME/FULL_TIME routing branches removed and six retired component files deleted, completing the D-12 screen-routing simplification**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-12T17:54:00Z
- **Completed:** 2026-06-12T18:00:08Z
- **Tasks:** 2
- **Files modified:** 2 (+ 6 deleted)

## Accomplishments

- Removed HALF_TIME/FULL_TIME setScreen branches from App.tsx onGameState handler — those phases now fall through to GameBoard which renders their overlay content (Plan 02 work)
- Collapsed 5-branch ternary render tree in App.tsx to a single `screen === 'GAME_BOARD' || screen === 'REPLAY'` check
- Removed 'HALF_TIME' and 'FULL_TIME' from the Screen union type in useGameStore.ts; emitHalfTimeStart preserved
- Deleted all six retired component/CSS files: TurnIndicator.tsx/.module.css, HalfTimeScreen.tsx/.module.css, FullTimeScreen.tsx/.module.css
- Build and full 71-test client suite green after all changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Simplify App.tsx routing and trim the Screen type** - `a9f1a48` (refactor)
2. **Task 2: Delete retired TurnIndicator, HalfTimeScreen, and FullTimeScreen component and CSS files** - `19a6661` (refactor)

**Plan metadata:** _(docs commit to follow)_

## Files Created/Modified

- `packages/client/src/App.tsx` - Removed HALF_TIME/FULL_TIME routing branches and component imports; simplified render tree
- `packages/client/src/store/useGameStore.ts` - Removed 'HALF_TIME' and 'FULL_TIME' from Screen union type; emitHalfTimeStart preserved

## Files Deleted

- `packages/client/src/components/TurnIndicator.tsx` - Logic absorbed into GameBoard in Plan 02
- `packages/client/src/components/TurnIndicator.module.css` - No longer needed
- `packages/client/src/components/HalfTimeScreen.tsx` - Content converted to inline overlay in GameBoard
- `packages/client/src/components/HalfTimeScreen.module.css` - Styles absorbed into GameBoard.module.css
- `packages/client/src/components/FullTimeScreen.tsx` - Content converted to inline overlay in GameBoard
- `packages/client/src/components/FullTimeScreen.module.css` - Styles absorbed into GameBoard.module.css

## Decisions Made

- D-12 fully implemented: HALF_TIME and FULL_TIME no longer have dedicated Screen states. They route to GameBoard, which renders their overlay content over the hex pitch, keeping the top band and clock always visible.
- REPLAY retained in Screen type — App.tsx still has a `state.phase === 'REPLAY'` branch in onGameState that calls setScreen('REPLAY'); the render tree checks `screen === 'REPLAY'` alongside 'GAME_BOARD'.
- emitHalfTimeStart kept in useGameStore — it is called by the HALF_TIME overlay button in GameBoard.tsx line 270; only the HalfTimeScreen component was deleted, not the store action.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The acceptance criteria grepped clean (no remaining HALF_TIME/FULL_TIME Screen references in App.tsx), build passed on first attempt, and all 71 tests passed after deletion.

## Known Stubs

None — this plan only removes dead code. No new UI or data paths introduced.

## Threat Flags

None — routing simplification and dead-code deletion only. No new trust boundaries or network surface.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 13 is now complete:

- Plan 01: ConnectionStatus dot size fix
- Plan 02: GameBoard top-band layout rewrite; HALF_TIME/FULL_TIME overlays inlined
- Plan 03: App.tsx routing simplified; dead component files deleted

Requirements LAYOUT-01 and CLOCK-02 are satisfied. The persistent top band + clock are visible in every game phase including HALF_TIME and FULL_TIME. Phase 14 (kickoff constraints + replay improvements) can proceed.

---

_Phase: 13-layout-clock_
_Completed: 2026-06-12_

## Self-Check: PASSED

- `packages/client/src/App.tsx` — exists and contains `screen === 'GAME_BOARD' || screen === 'REPLAY'`
- `packages/client/src/store/useGameStore.ts` — exists and Screen type does not contain HALF_TIME/FULL_TIME
- Deleted files confirmed absent: TurnIndicator.tsx, TurnIndicator.module.css, HalfTimeScreen.tsx, HalfTimeScreen.module.css, FullTimeScreen.tsx, FullTimeScreen.module.css
- Commits `a9f1a48` and `19a6661` exist in git log
