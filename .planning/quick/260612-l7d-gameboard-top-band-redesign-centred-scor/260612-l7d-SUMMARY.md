---
status: complete
phase: quick-260612-l7d
plan: '01'
subsystem: client-ui
tags: [layout, top-band, scoreboard, css-grid, action-panel]
dependency_graph:
  requires: []
  provides: [3-track-top-band, scoreboard-centrepiece, 2-col-action-panel]
  affects: [GameBoard.tsx, GameBoard.module.css, ActionPanel.module.css]
tech_stack:
  added: []
  patterns: [css-grid-1fr-auto-1fr, flexbox-centre, grid-column-span]
key_files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.module.css
    - packages/client/src/components/ActionPanel.module.css
decisions:
  - topBandLeft/topBandRight replace playerCardSection/topBandSection; centreSection removed
  - scoreboardGrid uses auto 1fr auto (centre cell takes remaining space)
  - phaseLabel/gkLabel/errorText span full 2-column grid via grid-column 1/-1
metrics:
  duration: ~8m
  completed: 2026-06-12
  tasks: 2
  files: 3
---

# Quick Task 260612-l7d: GameBoard Top-Band 3-Track Redesign Summary

**One-liner:** 3-zone top band (1fr auto 1fr) with scoreboard as dark-blue centrepiece (#0f3460) flanked by flex-centred player card and action panel zones.

## Tasks Completed

| Task | Name                                     | Commit  | Key Files                                    |
| ---- | ---------------------------------------- | ------- | -------------------------------------------- |
| 1    | Restructure top-band JSX                 | 1d2ad07 | GameBoard.tsx                                |
| 2    | Rewrite top-band CSS + 2-col ActionPanel | 36a852c | GameBoard.module.css, ActionPanel.module.css |

## What Was Built

**Task 1 — JSX restructure (GameBoard.tsx):**

- Replaced 4-track topBand (`auto 1fr 1fr auto`) with 3 direct children: `.topBandLeft`, `.scoreboard`, `.topBandRight`
- `.topBandLeft`: player card (3-col card or placeholder) flex-centred within 1fr zone
- `.scoreboard > .scoreboardGrid`: 3-cell internal grid (`auto 1fr auto`)
  - `.scoreboardHomeCell`: TeamShieldIcon (#1a56b0) + home score numeral
  - `.scoreboardCentreCell`: clockDisplay + ConnectionStatus + phaseSummary (teamName / phaseLabel / movesRemaining)
  - `.scoreboardAwayCell`: away score numeral + TeamShieldIcon (#c0392b)
- `.topBandRight`: action panel switcher (KickOffSetupPanel / ReplayPanel / ActionPanel) flex-centred within 1fr zone
- Removed: `.centreSection`, `.topBandSection`, `.scoreRow` divs; removed empty track 4 comment

**Task 2 — CSS rewrite (GameBoard.module.css + ActionPanel.module.css):**

- `.topBand`: `grid-template-columns: 1fr auto 1fr`
- `.topBandLeft`: `display:flex; align-items:center; justify-content:center; background:#16213e; border-right`
- `.topBandRight`: same but `border-left`
- `.scoreboard`: `display:flex; align-items:stretch; background:#0f3460; blue side borders`
- `.scoreboardGrid`: `display:grid; grid-template-columns: auto 1fr auto`
- `.scoreboardHomeCell` / `.scoreboardAwayCell`: flex row, gap 6px, padding 0 10px
- `.scoreboardCentreCell`: flex column, centred, subtle inner borders
- Removed: `.topBandSection`, `.centreSection`, `.scoreRow` rules (dead)
- `ActionPanel .panel`: `display:grid; grid-template-columns:1fr 1fr; gap:3px; align-items:start`
- `ActionPanel .phaseLabel, .gkLabel, .errorText`: `grid-column: 1 / -1`

## Verification

- TypeScript: `tsc --noEmit` — zero errors
- Build: `pnpm --filter @counter-attack/client build` — clean (10.54 kB CSS, 254.99 kB JS)
- Tests: `vitest run src/components/GameBoard.test.tsx` — 15/15 pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — CSS/JSX restructure only; no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- `packages/client/src/components/GameBoard.tsx` — modified (verified via git log)
- `packages/client/src/components/GameBoard.module.css` — modified (verified via git log)
- `packages/client/src/components/ActionPanel.module.css` — modified (verified via git log)
- Commit 1d2ad07 — exists
- Commit 36a852c — exists
- 15/15 tests pass
- Build clean
