---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 06
subsystem: ui
tags: [react, svg, css-modules, playerpiece, badges]

# Dependency graph
requires:
  - phase: 39-01
    provides: PlayerPiece.injuryCount / .yellowCards / .redCarded fields on the shared type
  - phase: 39-04
    provides: --color-card-yellow / --color-card-red semantic tokens and the EventBanner .cardBadge[data-card=...] CSS pattern
provides:
  - On-board card (rect) and injury (plus-sign) SVG badges in PieceOverlay.tsx, anchored at the negated ball-dot offset (opposite corner from the possession dot)
  - Card/injury status chips in PlayerStatsPanel.tsx's roster row, alongside the existing role chip and jersey number
affects: [40-substitutions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Badge anchor derived as the negation of an existing directional offset (dotOffsetX/dotOffsetY), not an independently hardcoded constant, so future geometry changes move both together'
    - 'Shape-based (not colour-based) layering distinction for simultaneously-possible status badges (rect vs. plus-sign cross)'

key-files:
  created: []
  modified:
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/PieceOverlay.test.tsx
    - packages/client/src/components/PlayerStatsPanel.tsx
    - packages/client/src/components/PlayerStatsPanel.module.css
    - packages/client/src/components/PlayerStatsPanel.test.tsx

key-decisions:
  - 'Badge anchor computed inline as `cx - dotOffsetX` / `cy - dotOffsetY` directly beside the existing ball-dot offset constants, with a comment tying the two together explicitly'
  - "Roster-panel chip dark-on-yellow text uses --color-bg-page (#121212, the darkest existing chrome token) rather than introducing a new 'dark text' token, since none currently exists in tokens.css"

patterns-established:
  - "Card/injury badge precedence: redCarded always beats yellowCards > 0, matching CARD-02's second-yellow-becomes-red rule; identical ternary duplicated (not shared) between PieceOverlay.tsx and PlayerStatsPanel.tsx since they are two independent, differently-shaped renderers (SVG rect+text vs. DOM span)"

requirements-completed: [CARD-02, INJURY-02, INJURY-03]

# Metrics
duration: ~30min
completed: 2026-08-14
---

# Phase 39 Plan 06: Card & Injury Badges Summary

**On-board SVG card/injury badges and matching roster-panel chips render CARD-02's booking state and INJURY-02/03's injury state as persistent match indicators, sourced entirely from the server-authoritative `PlayerPiece` fields added in Plan 39-01.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `PieceOverlay.tsx` renders a yellow/red rounded-rect card badge and a white plus-sign injury badge at the corner of the piece opposite the ball-possession dot (negated `dotOffsetX`/`dotOffsetY`), with the injury badge layered on top per D-05
- `PlayerStatsPanel.tsx`'s roster row gains a card chip (`RED`/`YELLOW`) and an injury chip (`INJ` / `INJ ×2`), completing D-04's "badges AND panel indicator" requirement
- 27 total `PieceOverlay.test.tsx` tests (8 new: presence, colour precedence, injury-count no-stacking, DOM-order layering, home/away placement) and 18 total `PlayerStatsPanel.test.tsx` tests (6 new) all green
- Every colour sourced from the existing `--color-card-yellow`/`--color-card-red`/`--color-text-inverse`/`--color-bg-page`/`--color-bg-surface-alt` tokens — zero new colour literals

## Task Commits

Each task was committed atomically:

1. **Task 1: Card and injury badges on PieceOverlay** - `1081b9c` (feat)
2. **Task 2: PieceOverlay badge tests** - `8385ed0` (test)
3. **Task 3: Card and injury chips in the player card panel** - `b49ab49` (feat)

## Files Created/Modified

- `packages/client/src/components/PieceOverlay.tsx` - card `<rect>` + injury plus-sign `<g>` badges anchored at the negated ball-dot offset
- `packages/client/src/components/PieceOverlay.test.tsx` - `describe('card and injury badges (D-04/D-05)')` block, 8 assertions
- `packages/client/src/components/PlayerStatsPanel.tsx` - card/injury `<span>` chips added to `.playerMeta`
- `packages/client/src/components/PlayerStatsPanel.module.css` - `.cardChip`/`.cardChip[data-card=...]`/`.injuryChip` rules
- `packages/client/src/components/PlayerStatsPanel.test.tsx` - `describe('... roster-panel card/injury chips')` block, 6 assertions

## Decisions Made

- Chip text colour on the yellow card chip uses `var(--color-bg-page)` (the darkest existing chrome token, `#121212`) as the "dark text" colour called for in the UI-SPEC, since no dedicated dark-text token exists yet in `tokens.css` — reusing an existing token satisfies the "no new colour literal" acceptance criterion without inventing a new semantic name for a single usage.
- The card-colour-precedence ternary (`redCarded === true ? 'red' : yellowCards > 0 ? 'yellow' : null`) is written independently in both `PieceOverlay.tsx` and `PlayerStatsPanel.tsx` rather than extracted to a shared helper — each site renders a structurally different output (SVG shape vs. text label) and the plan scoped both files independently; a shared helper would be a minor, out-of-scope refactor.

## Deviations from Plan

None - plan executed exactly as written. One environment-only adjustment was required (not a deviation from the plan's code): the worktree had no `node_modules` and `packages/shared` had no `dist/` build output, so `pnpm install` and `pnpm --filter @counter-attack/shared build` were run before any test/typecheck/build command would resolve `@counter-attack/shared` — a one-time environment setup step, not a plan or code change.

## Issues Encountered

- `pnpm --filter @counter-attack/client test`/`typecheck` initially failed with "Failed to resolve entry for package @counter-attack/shared" because this fresh worktree had never had `packages/shared` built. Resolved by running `pnpm --filter @counter-attack/shared build` once; all subsequent test/typecheck/stylelint/build runs succeeded.
- The first `git commit` attempt for Task 3 failed with `lint-staged automatic backup is missing!` from husky's pre-commit hook — caused by concurrent lint-staged runs across sibling worktree agents contending for the shared `refs/stash` (all worktrees share one stash list). No work was lost (`git diff --cached --stat` confirmed the staged changes were intact); a plain retry of the same `git commit` command succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- D-04/D-05's on-board and panel status indicators are fully wired to the server-authoritative `PlayerPiece.injuryCount`/`.yellowCards`/`.redCarded` fields; no further client work needed for CARD-02/INJURY-02/INJURY-03 visibility.
- No blockers for downstream Phase 39 plans or Phase 40 (Substitutions), which will read the same fields to gate INJURY-03's forced-substitution trigger.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_
