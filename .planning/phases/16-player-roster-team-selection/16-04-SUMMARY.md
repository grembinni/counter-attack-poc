---
phase: 16-player-roster-team-selection
plan: '04'
subsystem: client
tags: [team-selection, player-card, zustand, react, css-modules]
dependency_graph:
  requires:
    - phase: 16-03
      provides: server team:pick handler, buildInitialGameState(selectedTeams), TEAM_SELECTION_START/TEAM_HOME_PICKED events
  provides:
    - TeamSelectionScreen component (4 team cards, home-first turn order)
    - Screen union TEAM_SELECTION member
    - App.tsx team selection socket wiring (team:selection-start / team:home-picked)
    - PlayerStatsPanel 3-line header (firstName/lastName/badge|role|#number)
    - teamDefaults.ts deleted; 4 components read gameState.selectedTeams
  affects:
    - packages/client/src/App.tsx
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/components/TeamSelectionScreen.tsx
    - packages/client/src/components/TeamSelectionScreen.module.css
    - packages/client/src/components/PlayerStatsPanel.tsx
    - packages/client/src/components/PlayerStatsPanel.module.css
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/mock/mockMovementState.ts
tech_stack:
  added:
    - '@testing-library/user-event (devDep) — for TeamSelectionScreen.test.tsx userEvent.click tests'
  patterns:
    - Zustand per-field selector for selectedTeams (replaces module-level TEAM_DEFAULTS constant)
    - Static Vite import pattern for full-size badge PNGs (same as TeamBadge.tsx)
    - App.tsx local state for homePickedTeam (D-14 — not in Zustand store)
    - useGameStore.getState() in module-level helper (pieceColorOf in ActionLog)
key_files:
  created:
    - packages/client/src/components/TeamSelectionScreen.tsx
    - packages/client/src/components/TeamSelectionScreen.module.css
  modified:
    - packages/client/src/App.tsx
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/mock/mockMovementState.ts
    - packages/client/src/components/PlayerStatsPanel.tsx
    - packages/client/src/components/PlayerStatsPanel.module.css
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/PieceOverlay.test.tsx
    - packages/client/src/components/PlayerStatsPanel.test.tsx
    - packages/client/src/components/TeamSelectionScreen.test.tsx
    - packages/client/package.json
    - pnpm-lock.yaml
  deleted:
    - packages/client/src/teamDefaults.ts
decisions:
  - 'pieceColorOf in ActionLog reads useGameStore.getState().gameState.selectedTeams (D-17) — avoids threading param through all call sites in consolidateEvents/formatEvent'
  - 'TeamSelectionScreen.test.tsx: replaced toBeDisabled() with hasAttribute(disabled) — @testing-library/jest-dom not installed; standard DOM assertions used instead'
  - 'PieceOverlay.test.tsx and PlayerStatsPanel.test.tsx updated to new PlayerPiece shape (firstName/lastName/number/nationality) — pre-existing type errors from Plan 02 type surgery'
  - 'PlayerStatsPanel stat test updated to use value "4" (pace/dribbling/heading/highPass of real cosmos home-9) — Wave 0 test was written with old placeholder data'
metrics:
  duration: '~12 minutes'
  completed: '2026-06-14'
  tasks_completed: 2
  files_modified: 13
---

# Phase 16 Plan 04: Client-Side Team Selection + Player Card Redesign Summary

Complete client side of Phase 16: TeamSelectionScreen with 2x2 grid, 3-line PlayerStatsPanel header, teamDefaults deletion with selectedTeams migration, and App.tsx socket wiring for team selection flow.

## Tasks Completed

| Task | Name                                                                            | Commit  | Files                                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Repair mock + delete teamDefaults + migrate 4 components + player card redesign | 3eeb917 | mockMovementState.ts, teamDefaults.ts (deleted), PieceOverlay.tsx, GameBoard.tsx, ActionLog.tsx, PlayerStatsPanel.tsx, PlayerStatsPanel.module.css, PieceOverlay.test.tsx, PlayerStatsPanel.test.tsx |
| 2    | TeamSelectionScreen + Screen union + App wiring                                 | 190fdab | TeamSelectionScreen.tsx, TeamSelectionScreen.module.css, useGameStore.ts, App.tsx, TeamSelectionScreen.test.tsx, package.json, pnpm-lock.yaml                                                        |

## Checkpoint Reached

**Type:** human-verify
**Status:** Awaiting two-browser end-to-end verification before plan is complete.

## Verification State

- `cd packages/client && npx tsc --noEmit` — only pre-existing errors remain (ActionPanel.test.tsx, mock state files with ballAfter — all pre-Plan-16 tech debt)
- `pnpm --filter @counter-attack/client run test` — 91/92 PASS; 1 failure is the known pre-existing ActionPanel.test.tsx failure
- TeamSelectionScreen.test.tsx: 8/8 GREEN
- PlayerStatsPanel.test.tsx: 11/11 GREEN
- PieceOverlay.test.tsx: 15/15 GREEN

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PieceOverlay.test.tsx piece literals used deprecated `name` field**

- **Found during:** Task 1 TypeScript check
- **Issue:** Test fixtures still had `name: 'Home MID'` etc. after Plan 02 removed `name` from PlayerPiece type
- **Fix:** Replaced with `firstName`, `lastName`, `number`, `nationality` fields
- **Files modified:** packages/client/src/components/PieceOverlay.test.tsx
- **Commit:** 3eeb917

**2. [Rule 1 - Bug] PlayerStatsPanel.test.tsx stat assertion used old placeholder data**

- **Found during:** Task 1 test run
- **Issue:** Test asserted `getAllByText('5').length >= 2` for home-9, but real CSV data for cosmos home-9 has no stat value of 5
- **Fix:** Updated to `getAllByText('4').length >= 2` — home-9 (Nicolae Rusu, FWD) has pace=4, dribbling=4, heading=4, highPass=4
- **Files modified:** packages/client/src/components/PlayerStatsPanel.test.tsx
- **Commit:** 3eeb917

**3. [Rule 1 - Bug] PlayerStatsPanel.test.tsx had stale @ts-expect-error directive**

- **Found during:** Task 1 TypeScript check
- **Issue:** `@ts-expect-error` on `selectedTeams` property was no longer needed after Plan 02 added it to GameState type
- **Fix:** Removed the directive
- **Files modified:** packages/client/src/components/PlayerStatsPanel.test.tsx
- **Commit:** 3eeb917

**4. [Rule 2 - Missing] TeamSelectionScreen.test.tsx @ts-expect-error now unused**

- **Found during:** Task 2 TypeScript check
- **Issue:** `@ts-expect-error` on TeamSelectionScreen import was no longer needed after component was created
- **Fix:** Removed the directive
- **Files modified:** packages/client/src/components/TeamSelectionScreen.test.tsx
- **Commit:** 190fdab

**5. [Rule 1 - Bug] TeamSelectionScreen.test.tsx used toBeDisabled() from jest-dom (not installed)**

- **Found during:** Task 2 TypeScript check
- **Issue:** Test file used `expect(card).toBeDisabled()` / `expect(card).not.toBeDisabled()` from `@testing-library/jest-dom`, which is not installed in this project
- **Fix:** Replaced with `expect(card.hasAttribute('disabled')).toBe(true/false)` — standard DOM API, no extra package required
- **Files modified:** packages/client/src/components/TeamSelectionScreen.test.tsx
- **Commit:** 190fdab

**6. [Rule 2 - Missing] @testing-library/user-event not installed**

- **Found during:** Task 2 TypeScript check
- **Issue:** TeamSelectionScreen.test.tsx imported `@testing-library/user-event` but the package was not installed
- **Fix:** Added `pnpm add -D @testing-library/user-event` to packages/client
- **Files modified:** packages/client/package.json, pnpm-lock.yaml
- **Commit:** 190fdab

**7. [Rule 3 - Design] ActionLog pieceColorOf reads Zustand store state directly**

- **Found during:** Task 1 implementation
- **Issue:** Plan specified `pieceColorOf(pieceId, selectedTeams)` with parameter threading, but ActionLog has 15+ call sites in consolidateEvents and formatEvent (module-level functions)
- **Fix:** Used `useGameStore.getState().gameState.selectedTeams` inside pieceColorOf — consistent with existing store access patterns; added Zustand selector in ActionLog component for reactivity
- **Files modified:** packages/client/src/components/ActionLog.tsx
- **Commit:** 3eeb917

## Known Stubs

None — all data is wired from real TEAM_SQUADS (CSV-seeded). No placeholder text or hardcoded empty values.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. Client-side disable is UX only (T-16-01 accepted). selectedTeams contains only non-sensitive team IDs (T-16-06 accepted).

## Self-Check: PASSED

- packages/client/src/components/TeamSelectionScreen.tsx: FOUND
- packages/client/src/components/TeamSelectionScreen.module.css: FOUND
- packages/client/src/App.tsx (TEAM_SELECTION routing + socket handlers): FOUND
- packages/client/src/store/useGameStore.ts (TEAM_SELECTION in Screen union): FOUND
- packages/client/src/teamDefaults.ts: DELETED (confirmed not found)
- Commit 3eeb917: FOUND
- Commit 190fdab: FOUND
