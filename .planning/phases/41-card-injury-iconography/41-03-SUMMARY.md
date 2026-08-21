---
phase: 41-card-injury-iconography
plan: 03
subsystem: ui
tags: [react, svg, card-injury-badge, css-modules]

# Dependency graph
requires:
  - phase: 41-01
    provides: CardInjuryBadge.tsx (CardInjuryBadgeGroup, CardInjuryBadge, cardColorFor, cardInjuryLabel)
provides:
  - PieceOverlay.tsx pitch token badge migrated to CardInjuryBadgeGroup (visually identical)
  - PlayerStatsPanel.tsx scoreboard card badge migrated to standalone CardInjuryBadge
  - Dead .cardChip/.injuryChip CSS removed
  - PlayerStatsPanel.test.tsx assertions rewritten from chip text to glyph contract
affects: [41-04, 41-05, 41-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Consumers import CardInjuryBadgeGroup/CardInjuryBadge + cardColorFor from ./CardInjuryBadge.js; never re-derive the card-color ternary locally (ICON-01)'

key-files:
  created: []
  modified:
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/PlayerStatsPanel.tsx
    - packages/client/src/components/PlayerStatsPanel.module.css
    - packages/client/src/components/PlayerStatsPanel.test.tsx

key-decisions:
  - "PieceOverlay's badge IIFE replaced 1:1 with <CardInjuryBadgeGroup> at the pre-existing negated-ball-dot corner anchor; PieceOverlay.test.tsx left untouched as the behaviour-preservation proof"
  - "PlayerStatsPanel's YELLOW/RED/INJ text chips replaced with <CardInjuryBadge size={20}/>, relying on .playerMeta's existing gap: 12px instead of the old chip's margin-left: 8px"

patterns-established:
  - 'Scoreboard/roster-style surfaces render the self-contained <CardInjuryBadge> SVG; the raw pitch-token SVG renders <CardInjuryBadgeGroup> primitives directly into the parent <svg>'

requirements-completed: [ICON-01, ICON-02]

# Metrics
duration: ~20min
completed: 2026-08-21
---

# Phase 41 Plan 03: Pitch Token + Scoreboard Card Badge Migration Summary

**Migrated PieceOverlay's pitch-token badge and PlayerStatsPanel's scoreboard-card chips onto the shared `CardInjuryBadge.tsx` component, retiring the second and third of three duplicated card/injury-glyph implementations.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- `PieceOverlay.tsx`'s pitch-token badge IIFE (60 lines: local `badgeCx`/`badgeCy`/`badgeR`/`cardColor`/`hasInjury`/`cardWidth`/`cardHeight`/`barLength`/`barThickness` and the inline `redCarded === true ?` ternary) replaced with a single `<CardInjuryBadgeGroup>` element at the exact same negated-ball-dot corner anchor — `PieceOverlay.test.tsx` required zero edits and stayed green (27/27) as the behaviour-preservation signal.
- `PlayerStatsPanel.tsx`'s scoreboard card now renders the shared `<CardInjuryBadge>` glyph (20px) immediately after the jersey number instead of `YELLOW`/`RED`/`INJ`/`INJ ×2` text chips, per D-01/D-02.
- Dead `.cardChip`/`.injuryChip` CSS rule block (and its stale "Plan 39-06 (D-04)" comment) removed from `PlayerStatsPanel.module.css`.
- `PlayerStatsPanel.test.tsx`'s six chip assertions rewritten to assert the glyph contract: `data-testid="card-injury-badge"` wrapper presence/absence, `data-testid="piece-card-badge"`/`data-card` attribute, exactly-one `data-testid="piece-injury-badge"` element regardless of injury count (binary glyph rule), `aria-label` text ("Injured" / "Injured ×2"), and D-04's side-by-side non-overlap geometry (card rect `x + width <= injury rect x`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Point the pitch token at the shared badge (no visual change)** - `a0de3a9` (refactor)
2. **Task 2: Replace the scoreboard card's text chips with the shared glyph** - `b24a132` (refactor)

_Both commits ran through the project's lint-staged pre-commit hook (eslint --fix + prettier --write); no functional changes resulted, only formatting normalization._

## Files Created/Modified

- `packages/client/src/components/PieceOverlay.tsx` - pitch-token badge now renders `<CardInjuryBadgeGroup>` via `cardColorFor(piece)`
- `packages/client/src/components/PlayerStatsPanel.tsx` - scoreboard card renders `<CardInjuryBadge size={20}>` after the jersey number
- `packages/client/src/components/PlayerStatsPanel.module.css` - `.cardChip`/`.injuryChip` rule block removed
- `packages/client/src/components/PlayerStatsPanel.test.tsx` - chip-text assertions replaced with glyph-contract assertions (ICON-02 referenced in test title)

## Decisions Made

- Followed the plan's exact prop mapping for `CardInjuryBadgeGroup` (`cx={cx - dotOffsetX}`, `cy={cy - dotOffsetY}`, `r={PIECE_RADIUS * 0.59}`) — no deviation.
- `PlayerStatsPanel`'s glyph added with no wrapper `<span>` or new CSS class, relying on `.playerMeta`'s pre-existing `gap: 12px`, as directed by the plan.

## Deviations from Plan

None - plan executed exactly as written. (One incidental self-caught slip: an Edit tool call briefly left a stray zero-width space character after the `CardInjuryBadgeGroup` closing tag in `PieceOverlay.tsx`; caught and removed before any test run or commit — not a deviation from plan scope, just a same-task typo fix.)

## Issues Encountered

- The worktree had no installed `node_modules` and no built `packages/shared/dist` output, so the first test run failed to resolve `@counter-attack/shared`. Ran `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` before tests would resolve — a one-time environment-setup step, not a code change, so not logged as a Rule-based deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Two of the three original duplicated card/injury implementations (pitch token, scoreboard card) are now retired; `LineupAssignmentScreen.tsx` (roster/bench) remains for a later plan (41-05/41-06 per the phase's artifact table) plus the phase-wide ICON-01 grep audit (41-06).
- Full client suite (35 files / 1023 tests, including `HexGrid`/`GameBoard` which render `PieceOverlay` transitively) passes; `typecheck` and `stylelint` both exit 0.

---

_Phase: 41-card-injury-iconography_
_Completed: 2026-08-21_
