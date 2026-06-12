---
phase: quick-260612-ike
plan: 01
subsystem: client-ui
tags: [layout, top-band, player-card, scoreboard, stat-bubbles]
dependency_graph:
  requires: []
  provides: [5-track-top-band, scoreboard-with-shields, player-card-3col, stat-bubble-colors]
  affects: [GameBoard.tsx, GameBoard.module.css]
tech_stack:
  added: []
  patterns:
    [
      CSS Grid auto-track,
      inline SVG component,
      role-conditional rendering,
      stat bubble color mapping,
    ]
key_files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.module.css
decisions:
  - 5-track grid (auto 1fr auto 1fr auto) replaces 6-track (56px 1fr 1fr 1fr auto 56px); 56px edge score columns removed
  - statBubbleClass helper closes over styles at module scope — no cast needed; ?? '' handles undefined module class names
  - StatRow extracted as a local sub-component to avoid inline duplication across 8 stat rows
  - GK role detection via displayPiece?.role === 'GK' stored as isGK for clean conditional branching
metrics:
  duration: ~5min
  completed: 2026-06-12
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 260612-ike: Refactor GameBoard Top Band Layout and Player Card

**One-liner:** 5-track top band with centered scoreboard + SVG shields, player card shifted left with 3-column stat layout and green/yellow/red value bubbles, role-conditional GK vs outfield stats.

## Tasks Completed

| Task | Name                                                                                           | Commit  | Files                |
| ---- | ---------------------------------------------------------------------------------------------- | ------- | -------------------- |
| 1    | Refactor top-band CSS: 5-track grid, scoreboard, player card 3-col, stat bubble classes        | 3fad4a1 | GameBoard.module.css |
| 2    | Refactor GameBoard.tsx: new band order, SVG shields, 3-col player card, role-conditional stats | 3fad4a1 | GameBoard.tsx        |

Both tasks committed together as a single atomic unit — CSS and TSX changes are inseparable.

## Changes Made

### CSS (GameBoard.module.css)

**Removed:**

- `.scoreColumn` — fixed 56px home score column (leftmost track)
- `.scoreColumnAway` — fixed 56px away score column (rightmost track)
- `.scoreTeamName` — "Home" / "Away" text label
- `.playerCard`, `.playerCardHeader`, `.compactStatsGrid`, `.compactStat`, `.compactStatLabel`, `.compactStatValue` — old flat stat layout classes

**Added:**

- `.topBand` updated: `grid-template-columns: auto 1fr auto 1fr auto` (5 tracks)
- `.playerCardSection` — leftmost track wrapper (min 180px, max 240px, border-right)
- `.playerCardName` — player name row in info column
- `.playerCard3Col` — 3-column inner grid (`auto 1fr 1fr`)
- `.playerCardInfoCol` — column 1 (name/role/shield)
- `.playerCardStatsCol` — columns 2 and 3 (stats)
- `.statRow` — label + bubble pair
- `.statLabel` — 22px right-aligned abbreviation
- `.statBubble` — 18px circle base class
- `.statBubbleGreen` — `background: #27ae60` (values 5-6)
- `.statBubbleYellow` — `background: #f39c12` (values 3-4)
- `.statBubbleRed` — `background: #e74c3c` (values 1-2)
- `.scoreboard` — centered track 3 flex container with left/right borders
- `.scoreIcon` — 28px shield icon container
- `.scoreDash` — `–` separator between score numerals
- `.scoreNumeral` updated: font-size 24px (was 20px)

**Kept unchanged:** `.topBandSection`, `.playerCardPlaceholder`, `.clockDisplay`, `.connectionLine`, `.phaseSummary`, `.teamName`, `.phaseLabel`, `.movesRemaining`, `.actionSection`, `.logCollapsed`, `.logExpanded`, `.logChevron`, `.logHeader`, `.pitchContainer`, all overlay classes.

### TSX (GameBoard.tsx)

**Removed:**

- `COMPACT_STATS` constant array (flat 6-stat list)
- Old score column JSX (`scoreColumn` / `scoreColumnAway` divs with "Home"/"Away" text)
- Old flat player card JSX (playerCard, playerCardHeader, compactStatsGrid)

**Added:**

- `statBubbleClass(value)` — returns correct CSS module class string for green/yellow/red
- `TeamShieldIcon({ color })` — inline SVG shield component (22×26px path, used in scoreboard and player card)
- `StatRow({ label, value })` — single stat row helper component
- `isGK` derived boolean from `displayPiece?.role === 'GK'`
- New top-band track order: [playerCardSection] [topBandSection:centre] [scoreboard] [topBandSection:action] [log]
- Player card 3-col layout with role-conditional stats:
  - Col 2 outfield: PAC / DRB / HED / SHT
  - Col 2 GK: PAC / DRB / AA / SAV
  - Col 3 outfield: HPS / RES / TAC
  - Col 3 GK: HPS / RES / TAC / HND
- Scoreboard: home shield + home score + `–` + away score + away shield

## Verification

- TypeScript: `pnpm --filter @counter-attack/client exec tsc --noEmit` — 0 errors
- Tests: 71/71 pass (`src/components/GameBoard.test.tsx` 15/15 pass)
- Build: `pnpm --filter @counter-attack/client build` — clean (10.01 kB CSS, 254.95 kB JS)

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented together as a single commit since CSS and TSX changes are inseparable. `StatRow` sub-component extracted to reduce JSX repetition across 8 stat rows (minor readability improvement, not a deviation).

## Self-Check: PASSED

- `packages/client/src/components/GameBoard.tsx` — FOUND (modified, committed at 3fad4a1)
- `packages/client/src/components/GameBoard.module.css` — FOUND (modified, committed at 3fad4a1)
- Commit 3fad4a1 — FOUND in git log
- 71/71 tests pass
- Build clean
