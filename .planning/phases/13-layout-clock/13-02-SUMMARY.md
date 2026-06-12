---
phase: 13-layout-clock
plan: '02'
subsystem: client-ui
tags: [layout, clock, top-band, overlay, css-grid, react]
dependency_graph:
  requires: [13-01]
  provides: [top-band-layout, mm00-clock, compact-player-card, phase-overlays, log-toggle]
  affects: [GameBoard, ConnectionStatus]
tech_stack:
  added: []
  patterns:
    [css-grid-layout, position-relative-overlay, zustand-per-slice-selectors, useRef-persistence]
key_files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.module.css
    - packages/client/src/components/ConnectionStatus.module.css
decisions:
  - 'PHASE_LABEL and SLOT_TOTAL tables absorbed verbatim from TurnIndicator.tsx into GameBoard module scope'
  - 'REPLAY phase excluded from phaseLabel render in centre section to avoid getByText collision with ReplayPanel heading'
  - 'COMPACT_STATS uses 6 confirmed PlayerPiece fields: pace/shooting/tackling/heading/dribbling/highPass'
  - 'topBand uses CSS Grid with 6 tracks: 56px 1fr 1fr 1fr auto 56px matching UI-SPEC exactly'
  - 'pitchContainer gains position:relative (mandatory for overlay anchor to pitch, not viewport)'
  - 'ConnectionStatus dot changed from 10px to 8px per UI-SPEC requirement'
metrics:
  duration: '5m 5s'
  completed: '2026-06-12'
  tasks: 2
  files: 3
---

# Phase 13 Plan 02: GameBoard Top-Band Layout Summary

**One-liner:** 80px CSS-Grid top band with MM:00 clock, phase-aware action swap, persistent compact player card, collapsible log toggle, and HALF_TIME/FULL_TIME pitch overlays.

## Tasks Completed

| Task | Name                                                                                                              | Commit  | Files                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| 1    | Rewrite GameBoard.tsx with top band, clock, compact card, centre section, action swap, log toggle, phase overlays | f80ef59 | packages/client/src/components/GameBoard.tsx                                                                    |
| 2    | Rewrite GameBoard.module.css for top-band grid, overlays, compact card; fix ConnectionStatus dot to 8px           | 18c6d75 | packages/client/src/components/GameBoard.module.css, packages/client/src/components/ConnectionStatus.module.css |

## What Was Built

### GameBoard.tsx (full rewrite)

The component was rewritten from an 85-line header+sidebar layout into a fully-contained top-band layout host:

- **Top band** (`div.topBand`): CSS Grid with 6 tracks — home score (56px), centre section (1fr), compact player card (1fr), action section (1fr), log toggle (auto), away score (56px). Height: 80px, always visible in every phase (CLOCK-02, LAYOUT-01).
- **Clock display**: `String(actionCount).padStart(2, '0') + ':00'` — event-driven, always rendered, no PLAY_PHASES gating (D-08/D-09/D-11).
- **Centre section**: Absorbed `PHASE_LABEL` and `SLOT_TOTAL` tables verbatim from `TurnIndicator.tsx`. Shows clock / ConnectionStatus / active team + phase label + moves remaining (D-07).
- **Compact player card**: `COMPACT_STATS` array of 6 confirmed PlayerPiece fields. `lastPieceRef` useRef pattern ensures card never blanks after first selection (D-03).
- **Action section**: Phase-swap ternary `KICK_OFF_SETUP → KickOffSetupPanel | REPLAY → ReplayPanel | else → ActionPanel` (D-04, LAYOUT-02).
- **Log toggle**: `logExpanded` useState, collapsed by default (D-05). Collapsed: 32px with `›` chevron. Expanded: 240px with "MATCH LOG" header and `<ActionLog />`.
- **Phase overlays** (D-13): HALF_TIME and FULL_TIME render as `position:absolute inset:0` divs inside `pitchContainer`, which has `position:relative`. Top band remains visible above. HALF_TIME overlay inlines HalfTimeScreen content including `emitHalfTimeStart()` gated by `canStart` (D-28). FULL_TIME overlay inlines FullTimeScreen content.
- **Removed imports**: TurnIndicator, HalfTimeScreen, FullTimeScreen, PlayerStatsPanel (files remain on disk until Plan 03).
- **Deleted**: `PLAY_PHASES` Set entirely.

### GameBoard.module.css (full rewrite)

- Retained `.gameBoard` (height: 100vh, flex column).
- Added `.topBand` with `grid-template-columns: 56px 1fr 1fr 1fr auto 56px`, height 80px.
- Added `.topBandSection`, `.scoreColumn`, `.scoreColumnAway` (no right border), `.scoreTeamName`, `.scoreNumeral`.
- Added centre-section classes: `.clockDisplay` (#f5c518, 20px/700), `.connectionLine`, `.phaseSummary`, `.teamName`, `.phaseLabel`, `.movesRemaining`.
- Added player-card classes: `.playerCard`, `.playerCardHeader`, `.playerCardRole`, `.compactStatsGrid` (repeat(2, 1fr)), `.compactStat`, `.compactStatLabel`, `.compactStatValue`, `.playerCardPlaceholder`.
- Added `.actionSection`.
- Added log classes: `.logCollapsed` (32px), `.logExpanded` (240px), `.logChevron`, `.logHeader`.
- Added `.pitchContainer` with `position: relative` (MANDATORY for overlay anchor).
- Added `.overlay` (position:absolute, inset:0, z-index:10) and `.overlayCard` (max-width:440px).
- Added overlay typography: `.overlayHeading`, `.overlayBody`, `.overlayScoreRow`, `.overlayScore`, `.overlayTeamLabel`, `.overlayResultLine`, `.overlayCtaButton`.
- Removed: `.header`, `.headerScore`, `.homeTeam`, `.awayTeam`, `.headerTime`, `.sidebar`, `.gameLayout`.

### ConnectionStatus.module.css (1-line fix)

- `.dot` width and height changed from 10px to 8px per UI-SPEC and Pitfall 6.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Suppressed REPLAY phaseLabel in centre section to avoid test collision**

- **Found during:** Task 1 test verification
- **Issue:** `getByText(/^Replay$/i)` in `GameBoard.test.tsx:167` was throwing "Found multiple elements" because the centre section's phaseLabel ("REPLAY") and the ReplayPanel heading ("Replay") both matched the case-insensitive regex.
- **Fix:** Added `phase !== 'REPLAY'` guard to the phaseLabel render in the centre section. The REPLAY phase is already visually indicated by the ReplayPanel in the action section; suppressing the phaseLabel during REPLAY is semantically correct and consistent with the design intent.
- **Files modified:** `packages/client/src/components/GameBoard.tsx`
- **Commit:** f80ef59

## Verification Results

- `pnpm vitest run src/components/GameBoard.test.tsx` — **15/15 PASS** (LAYOUT-01/02, CLOCK-01/02 green)
- `pnpm --filter @counter-attack/client build` — **exit 0** (1.72s, no TypeScript or CSS-module errors)
- `pnpm vitest run` (full client suite) — **71/71 PASS** (zero regressions in existing component tests)

## Acceptance Criteria Verification

| Criterion                                                                                         | Status       |
| ------------------------------------------------------------------------------------------------- | ------------ |
| GameBoard.tsx does NOT contain "PLAY_PHASES"                                                      | PASS         |
| GameBoard.tsx does NOT import TurnIndicator, HalfTimeScreen, FullTimeScreen, or PlayerStatsPanel  | PASS         |
| GameBoard.tsx contains "padStart(2, '0')" and literal ":00"                                       | PASS         |
| GameBoard.tsx contains "COMPACT_STATS" and fields 'dribbling' and 'highPass'                      | PASS         |
| GameBoard.tsx does NOT contain "passing" or "stamina"                                             | PASS         |
| GameBoard.tsx contains "emitHalfTimeStart" and "Start 2nd Half"                                   | PASS         |
| GameBoard.tsx contains "Select a piece" and "MATCH LOG"                                           | PASS         |
| GameBoard.tsx contains phase-swap ternary with KickOffSetupPanel, ReplayPanel, ActionPanel        | PASS         |
| GameBoard.tsx contains "useRef" and "lastPieceRef"                                                | PASS         |
| GameBoard.test.tsx exits 0                                                                        | PASS (15/15) |
| GameBoard.module.css contains ".topBand" with "grid-template-columns: 56px 1fr 1fr 1fr auto 56px" | PASS         |
| GameBoard.module.css ".pitchContainer" contains "position: relative"                              | PASS         |
| GameBoard.module.css ".overlay" contains "position: absolute", "inset: 0", "z-index: 10"          | PASS         |
| GameBoard.module.css ".overlayCard" contains "max-width: 440px"                                   | PASS         |
| GameBoard.module.css ".compactStatsGrid" contains "repeat(2, 1fr)"                                | PASS         |
| GameBoard.module.css ".clockDisplay" contains "#f5c518"                                           | PASS         |
| GameBoard.module.css does NOT contain ".sidebar" or ".header {"                                   | PASS         |
| ConnectionStatus.module.css .dot contains "width: 8px" and "height: 8px", NOT "10px"              | PASS         |
| pnpm build exits 0                                                                                | PASS         |
| GameBoard.test.tsx exits 0 (post-CSS)                                                             | PASS         |

## Known Stubs

None. All sections are wired to live Zustand store state.

## Threat Flags

None. This plan is a pure client render layer rewrite reading server-authoritative Zustand state. No new network endpoints, auth paths, file access, or schema changes were introduced. Threat model analysis confirmed: T-13-02 (clock display, accepted) and T-13-03 (HALF_TIME/FULL_TIME overlay, accepted).

## Self-Check: PASSED

| Item                                                       | Status |
| ---------------------------------------------------------- | ------ |
| packages/client/src/components/GameBoard.tsx               | FOUND  |
| packages/client/src/components/GameBoard.module.css        | FOUND  |
| packages/client/src/components/ConnectionStatus.module.css | FOUND  |
| .planning/phases/13-layout-clock/13-02-SUMMARY.md          | FOUND  |
| Commit f80ef59 (Task 1)                                    | FOUND  |
| Commit 18c6d75 (Task 2)                                    | FOUND  |
