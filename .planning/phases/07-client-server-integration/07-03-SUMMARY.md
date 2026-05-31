---
phase: '07'
plan: '03'
subsystem: client
tags: [react, zustand, socket-io, tdd, action-panel, connection-status, hex-grid]
requires:
  - '07-01-SUMMARY.md'
  - '07-04-SUMMARY.md'
provides:
  - 'ActionPanel with phase-gated, active-player-gated controls (UNDO-01/02/03)'
  - 'ConnectionStatus three-state socket indicator using Manager reconnect_attempt event'
  - 'DisconnectBanner conditional render from Zustand disconnectWarning (D-13)'
  - 'HexGrid emitMove + game:shot SHOT-phase goal-hex routing (D-06)'
  - 'HexCell highlightColor prop for red goal-hex highlight'
affects:
  - 'packages/client/src/components/ActionPanel.tsx'
  - 'packages/client/src/components/ActionPanel.module.css'
  - 'packages/client/src/components/ActionPanel.test.tsx'
  - 'packages/client/src/components/ConnectionStatus.tsx'
  - 'packages/client/src/components/ConnectionStatus.module.css'
  - 'packages/client/src/components/DisconnectBanner.tsx'
  - 'packages/client/src/components/DisconnectBanner.module.css'
  - 'packages/client/src/components/GameBoard.tsx'
  - 'packages/client/src/components/HexGrid.tsx'
  - 'packages/client/src/components/HexCell.tsx'
tech-stack:
  patterns:
    - 'TDD RED/GREEN for ActionPanel — failing tests committed before implementation'
    - 'afterEach(cleanup) required in Vitest + @testing-library/react to prevent render accumulation'
    - 'socket.io Manager events (reconnect_attempt) use socket.io.on, NOT socket.on (Pitfall 6)'
    - 'SHOT goal-hex click emits game:shot server-side; optimistic local state is cosmetic only (D-06)'
    - 'exactOptionalPropertyTypes requires explicit string|undefined for optional props'
key-files:
  created:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.module.css
    - packages/client/src/components/ActionPanel.test.tsx
    - packages/client/src/components/ConnectionStatus.tsx
    - packages/client/src/components/ConnectionStatus.module.css
    - packages/client/src/components/DisconnectBanner.tsx
    - packages/client/src/components/DisconnectBanner.module.css
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexCell.tsx
key-decisions:
  - decision: 'game:shot emit is the source of truth for shot target; local setShotTargetHighlight is cosmetic only'
    rationale: 'Plan 04 added server-side shot target recording; D-06 requires server emit not local state'
  - decision: 'afterEach(cleanup) added to ActionPanel.test.tsx'
    rationale: 'Vitest does not auto-cleanup @testing-library/react renders without explicit setup; accumulation caused getByRole multiple-elements errors'
  - decision: 'highlightColor typed as string|undefined (not string) due to exactOptionalPropertyTypes'
    rationale: 'Passing undefined explicitly fails the strict type check; explicit union fixes it without changing semantics'
requirements-completed: [UNDO-01, UNDO-02, UNDO-03, UNDO-04]
duration: '~45 minutes'
completed: '2026-05-31'
---

# Phase 07 Plan 03: ActionPanel + ConnectionStatus + DisconnectBanner + Board Upgrades Summary

Built the live game-board interaction layer: ActionPanel with phase-gated controls and undo gating (all four UNDO requirements), ConnectionStatus indicator, DisconnectBanner, and HexGrid/HexCell upgrades including SHOT-phase goal-hex click routing that emits game:shot to the server (D-06).

**Duration:** ~45 minutes | **Tasks:** 3/3 | **Files:** 7 created, 3 modified

## What Was Built

### Task 1 — ActionPanel (TDD: RED → GREEN)

- Returns `null` for non-active player (UNDO-03 mechanism)
- Undo Move button: MOVEMENT phase only, `disabled={!!lastDiceRoll}` (UNDO-02), `onClick={emitUndo}` (UNDO-01)
- Roll Dice: PASS/SHOT/HEADER/LOOSE_BALL phases
- End Turn: MOVEMENT; Start Movement: KICK_OFF
- GK restart group: GK_RESTART phase gated on `isGKTeam` (mirrors server `controlsGKTeam`)
- PassTypeSelector local state (STANDARD/FIRST_TIME/HIGH/LONG — UI-only, Phase 8 ext point)
- gameError display with `#ef4444`
- ActionPanel.module.css: `.panel`, `.ctaButton` + `:disabled`, passType button styles
- 9 tests covering all UNDO requirements, Roll Dice, Start Movement

### Task 2 — ConnectionStatus + DisconnectBanner

- ConnectionStatus: `useState<Status>` with named handlers, `socket.io.on('reconnect_attempt')` for Manager event (Pitfall 6), cleanup with `socket.io.off`
- DisconnectBanner: reads `disconnectWarning`, returns `null` when false (conditional render not display:none), auto-dismisses via App.tsx game:state handler

### Task 3 — GameBoard + HexGrid/HexCell

- GameBoard: ConnectionStatus in header, DisconnectBanner after header, ActionPanel in sidebar between TurnIndicator and ActionLog
- HexCell: `highlightColor?: string | undefined` prop; highlight polygon uses `highlightColor ?? '#f5c518'`
- HexGrid: `emitMove` replaces `movePiece`; SHOT-phase goal-hex click emits `ClientEvents.GAME_SHOT` to server; optimistic `shotTargetHighlight` local state for red highlight; `!movedPieceIds.includes(piece.id)` guards piece clickability (Pitfall 8)

## Commits

| Hash      | Description                                                                          |
| --------- | ------------------------------------------------------------------------------------ |
| `36080b1` | test(07-03): add failing tests for ActionPanel (RED)                                 |
| `df5336e` | feat(07-03): implement ActionPanel with phase-gated controls and undo gating (GREEN) |
| `d3b3ab4` | feat(07-03): add ConnectionStatus and DisconnectBanner components                    |
| `5cc5a69` | feat(07-03): wire GameBoard + upgrade HexGrid/HexCell for Phase 7                    |

## Deviations from Plan

**[Rule 1 - Bug Fix]** `afterEach(cleanup)` added to ActionPanel.test.tsx — Found during: Task 1 GREEN | Issue: @testing-library/react renders accumulated across tests, causing "Found multiple elements" errors | Fix: explicit `afterEach(() => cleanup())` | Verification: all 9 tests pass | No commit hash change needed (fix in same GREEN commit).

**[Rule 1 - TypeScript]** `highlightColor?: string | undefined` instead of `highlightColor?: string` — Found during: Task 3 typecheck | Issue: `exactOptionalPropertyTypes: true` rejects passing `undefined` explicitly | Fix: explicit union type | Verification: typecheck passes.

**Total deviations:** 2 auto-fixed. **Impact:** None — both fixes align with project TypeScript config and test hygiene.

## Verification

- `npx tsc --noEmit` exits 0 ✓
- `npx vitest run` exits 0 — 25 tests pass (16 store + 9 ActionPanel) ✓
- `grep -c movePiece HexGrid.tsx` returns 0 ✓
- HexGrid emits `game:shot` on SHOT-phase goal-hex click ✓
- ActionPanel returns null for non-active player (UNDO-03) ✓
- ActionPanel disables Undo when lastDiceRoll set (UNDO-02) ✓

## Self-Check: PASSED

Phase 07 complete — all 4 plans done.
