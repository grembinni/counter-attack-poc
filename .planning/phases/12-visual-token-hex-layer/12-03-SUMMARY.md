---
phase: 12-visual-token-hex-layer
plan: '03'
subsystem: client-rendering
tags: [svg, mini-token-badge, player-stats-panel, stripe-patterns, tdd, vis-02]
dependency_graph:
  requires:
    - phase: 12-visual-token-hex-layer/12-01
      provides: PieceOverlay fill/stroke color values and player-number derivation pattern mirrored by MiniTokenBadge
  provides:
    - MiniTokenBadge local function in PlayerStatsPanel.tsx with self-contained SVG stripe defs
    - CSS classes .tokenBadge and .headerText in PlayerStatsPanel.module.css
    - Self-contained pattern IDs mini-home-stripe-<id> and mini-away-stripe-<id>
  affects:
    - Phase 12 Plan 04 (HexGrid refactor) — no dependency; Plan 03 is fully independent

tech-stack:
  added: []
  patterns:
    - D-09: self-contained SVG defs inside inline <svg> — no cross-document url(#...) reference
    - D-08: MiniTokenBadge in PlayerStatsPanel header showing stripe identity in stats context
    - Mini stripe tile 18px (vs 24px on-pitch) — proportionally scaled band geometry

key-files:
  created: []
  modified:
    - packages/client/src/components/PlayerStatsPanel.tsx
    - packages/client/src/components/PlayerStatsPanel.module.css
    - packages/client/src/components/PlayerStatsPanel.test.tsx

key-decisions:
  - 'D-08: mini token rendered in PlayerStatsPanel header for selected piece'
  - 'D-09: self-contained <defs> inside inline SVG — cannot cross SVG document boundary'
  - 'Mini away stripe bands 3px tall at y=4 and y=11 of 18px tile (proportional to 4px/y=6,y=14 on 24px on-pitch tile)'

patterns-established:
  - 'Mini token badge pattern: local function inside component file, not exported; self-contained <defs><pattern>'
  - 'Player number derivation: String(Number(piece.id.slice(piece.id.lastIndexOf("-") + 1)) + 1) — same in MiniTokenBadge as PieceOverlay'

requirements-completed: [VIS-02]

duration: 2m 21s
completed: '2026-06-12'
---

# Phase 12 Plan 03: MiniTokenBadge in PlayerStatsPanel Header Summary

**Self-contained inline SVG mini token badge in the PlayerStatsPanel header showing the home vertical-stripe or away horizontal-stripe pattern (or solid GK fill) for the selected piece — satisfying VIS-02's third required context.**

## Performance

- **Duration:** 2m 21s
- **Started:** 2026-06-12T10:40:12Z
- **Completed:** 2026-06-12T10:42:33Z
- **Tasks:** 2 (+ 1 checkpoint pending human-verify)
- **Files modified:** 3

## Accomplishments

- `MiniTokenBadge` local component added to `PlayerStatsPanel.tsx` — inline 20x20 SVG with self-contained `<defs><pattern>` per D-09
- Home outfield: single vertical black stripe (`x=7, w=4` on 18px tile, `fillOpacity=0.55`) centered at miniCx/miniCy
- Away outfield: two horizontal maroon bands (`y=4, y=11, h=3` on 18px tile, `fillOpacity=0.65`)
- GK pieces: solid fill (`#9b59b6` home / `#f59e0b` away) with no stripe pattern
- Header restructured to `[MiniTokenBadge][headerText]` flex row with 6px gap per D-08
- TDD: 3 new behavior tests + 4 existing tests all pass (7/7)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing tests for MiniTokenBadge** - `0ee98fb` (test)
2. **Task 1 GREEN: implement MiniTokenBadge + update header render** - `03d49a6` (feat)
3. **Task 2: update PlayerStatsPanel header CSS** - `c1dbcbe` (feat)
4. **Post-checkpoint fix: add base fill rect to stripe patterns** - `73be801` (fix) — transparent token background bug discovered during human visual verification; fixed in both PlayerStatsPanel.tsx and PieceOverlay.tsx

## Files Created/Modified

- `packages/client/src/components/PlayerStatsPanel.tsx` — added `MiniTokenBadge` function; updated header div structure with `<MiniTokenBadge>` + `<div className={styles.headerText}>`
- `packages/client/src/components/PlayerStatsPanel.module.css` — changed `.header` to `align-items: center; gap: 6px`; added `.tokenBadge` and `.headerText` rules
- `packages/client/src/components/PlayerStatsPanel.test.tsx` — added 3 mini-token behavior tests (home outfield, away outfield, GK solid fill)

## Decisions Made

- D-08 implemented: mini token badge in the stats panel header alongside player name (flex row with 6px gap)
- D-09 enforced: `<defs>` are fully self-contained inside the panel's inline `<svg>` — no cross-document reference to HexGrid's patterns
- Mini stripe tile dimensions use 18px (matching `miniR=9`, diameter=18) vs 24px on-pitch — bands scaled proportionally: `y=4,y=11,h=3` (not `y=6,y=14,h=4`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Add base fill rect to stripe patterns — tokens rendered transparent**

- **Found during:** Post-checkpoint human verification (Task 3 — approved visual review)
- **Issue:** SVG `<pattern>` elements in both `PlayerStatsPanel.tsx` and `PieceOverlay.tsx` lacked a base `<rect fill="...">` behind the stripe overlay, leaving the token circle fill transparent on all browsers where the pattern background does not default to the team colour. Outfield tokens appeared colourless instead of showing the team base colour with stripe bands on top.
- **Fix:** Added a base `<rect x={0} y={0} width={18} height={18} fill={baseFill} />` as the first child of every stripe `<pattern>` in both components (home `#1a3a8a`, away `#8e1c12`).
- **Files modified:** `packages/client/src/components/PlayerStatsPanel.tsx`, `packages/client/src/components/PieceOverlay.tsx`
- **Commit:** `73be801`

## Issues Encountered

None — all 55 client tests pass after the transparency fix.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- VIS-02 satisfied: stripe identity now appears in all three required contexts — on-pitch (Plan 01), stats panel (Plan 03), replay (Plan 04 covers via shared PieceOverlay)
- Plan 04 (HexGrid refactor) is fully independent and unaffected by this plan
- Human visual verification approved: home vertical stripe, away horizontal stripes, and GK solid fill all confirmed correct

## Known Stubs

None — MiniTokenBadge renders actual SVG stripe patterns from live `piece.teamId` and `piece.role` props. No placeholder data.

## Threat Flags

None — PlayerStatsPanel is a pure client-side render component with no network endpoints, auth paths, or data persistence.

## Self-Check: PASSED

- `packages/client/src/components/PlayerStatsPanel.tsx`: exists with `MiniTokenBadge` function
- `packages/client/src/components/PlayerStatsPanel.module.css`: exists with `.tokenBadge` and `.headerText`
- `packages/client/src/components/PlayerStatsPanel.test.tsx`: exists with 7 passing tests
- Commits 0ee98fb, 03d49a6, c1dbcbe, 73be801: all present in git log
- 55/55 client tests pass (pnpm --filter @counter-attack/client test)
