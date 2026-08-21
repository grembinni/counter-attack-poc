---
phase: 41-card-injury-iconography
plan: 04
subsystem: ui
tags: [react, svg, css-modules, vitest]

# Dependency graph
requires:
  - phase: 41-card-injury-iconography (plan 01)
    provides: CardInjuryBadge.tsx shared module (CardColor, cardColorFor, CardInjuryBadge, CardInjuryBadgeGroup, cardInjuryLabel)
provides:
  - 'Roster/lineup mid-match card (LineupStatCard inside LineupAssignmentScreen.tsx) now renders the shared CardInjuryBadge glyph instead of YELLOW/RED/INJ text chips'
  - "The last hand-written redCarded === true ? 'red' : ... card-colour ternary inside LineupAssignmentScreen.tsx is deleted, replaced by cardColorFor(piece)"
  - 'Dead .cardChip/.injuryChip CSS rules removed from LineupAssignmentScreen.module.css; two stale cross-file comments corrected'
  - 'Roster-card test suite rewritten from text-chip assertions to glyph/testid assertions, plus new D-02 anchor, D-04 side-by-side, and pregame non-regression coverage'
affects: [41-06-audit, 41-card-injury-iconography]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Plain-DOM surfaces (roster/lineup card) consume the self-contained <svg> CardInjuryBadge component with an explicit size prop, unconditionally rendered (component itself returns null when there is nothing to draw)'

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "Followed the plan's exact placement instruction: CardInjuryBadge renders between #jerseyNumber and the LOCK badge (D-02), one slot earlier than the old chips sat — confirmed harmless since isGK && !allowGKDrag (LOCK's guard) never co-renders with cardColor/injuryCount (both undefined in pregame, the only mode where LOCK can render)"
  - "Reformatted the SUB-06 sub-counter-chip CSS comment to use leading-* continuation lines (matching the file's existing top-of-file JSDoc-style convention) so the acceptance-criteria comment-exclusion grep (which only recognizes /* and * line starts) correctly excludes it despite still mentioning '.injuryChip' in prose"

requirements-completed: [ICON-01, ICON-02]

# Metrics
duration: 15min
completed: 2026-08-21
---

# Phase 41 Plan 04: Roster/Lineup Card Glyph Migration Summary

**Migrated `LineupStatCard`'s mid-match roster card off text chips (YELLOW/RED/INJ/INJ ×2) onto the shared `CardInjuryBadge` SVG glyph, deleting the last hand-written card-colour ternary outside `CardInjuryBadge.tsx`.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-21T12:03:16-05:00 (worktree base commit)
- **Completed:** 2026-08-21T12:18:14-05:00
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Roster/lineup card's card/injury status now reads via the same `CardInjuryBadge` component as the pitch token and scoreboard, positioned immediately after the jersey number and ahead of the `LOCK` status badge (D-01/D-02)
- Deleted `LineupAssignmentScreen.tsx`'s local `redCarded === true ? 'red' : (yellowCards ?? 0) > 0 ? 'yellow' : null` ternary, replaced with `cardColorFor(piece)` from the shared module (ICON-01)
- Removed dead `.cardChip`/`.injuryChip` CSS block and corrected two stale cross-file comments that referenced now-deleted classes
- Roster-card test suite (39 tests, all passing) rewritten to assert the glyph contract: `piece-card-badge`/`piece-injury-badge` testids, `card-injury-badge` `aria-label`, a D-02 anchor test (`cardNum.nextElementSibling`), a D-04 side-by-side no-overlap test using SVG rect geometry, and a pregame non-regression test confirming no badge markup renders when no card/injury props are passed

## Task Commits

1. **Task 1: Replace the roster card's text chips with the shared glyph** - `bcd4beb` (feat)
2. **Task 2: Rewrite the roster-card tests from text chips to glyphs** - `901c761` (test)

**Plan metadata:** (this commit, pending)

## Files Created/Modified

- `packages/client/src/components/LineupAssignmentScreen.tsx` - Imports `CardInjuryBadge`/`cardColorFor`/`CardColor`; retypes `StatCardProps.cardColor`; renders `<CardInjuryBadge>` in `cardMeta` between `#number` and `LOCK`; derives mid-match `cardColor` via `cardColorFor(piece)` instead of a local ternary
- `packages/client/src/components/LineupAssignmentScreen.module.css` - Deleted the dead `.cardChip`/`.injuryChip` rule block; corrected the `.redCardBadge` and `.subCounterChip` comments that referenced the deleted classes
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` - Rewrote 3 chip-text assertions to glyph/testid assertions (ICON-02); added a D-02 anchor test, a D-04 side-by-side test, and a pregame non-regression test

## Decisions Made

- Placement of the glyph one slot earlier than the old chips (before `LOCK` instead of after) is per the plan's explicit instruction and UI-SPEC render-order contract; verified it never visibly co-renders with `LOCK` since `isGK` is only true in pregame mode where `cardColor`/`injuryCount` are always `undefined`
- `size={16}` used (not the 20px `PlayerStatsPanel` default) to match this row's 14px `NationFlag`/12px text scale, per the plan's explicit sizing rationale

## Deviations from Plan

None — plan executed exactly as written. One cosmetic formatting adjustment was needed to satisfy the plan's own acceptance-criteria grep (see Decisions Made: the SUB-06 CSS comment's continuation-line leading-`*` style), which is a formatting-only change to comment text already specified verbatim by the plan, not new content.

## Issues Encountered

- The worktree had no `node_modules` (fresh worktree checkout) and no build for `@counter-attack/shared`. Resolved by running `pnpm install --frozen-lockfile` (via the pnpm content-addressable store — `pnpm store status` confirmed the store was untouched afterward, no shared-content corruption) and `pnpm --filter @counter-attack/shared build` before running typecheck/tests. This is worktree environment setup, not a plan deviation.
- The phase-level `<verification>` grep (`redCarded === true ? 'red'` across the whole `packages/client/src/components` tree) still matches `PieceOverlay.tsx` and `PlayerStatsPanel.tsx` — both are out of this plan's file scope (owned by plan 41-01's PieceOverlay origin and sibling plan 41-03 respectively) and were correctly left untouched per the plan's explicit "Do not touch" scope boundary. This plan's own scoped acceptance criterion (`grep -c "redCarded === true ?" LineupAssignmentScreen.tsx` = 0) passes; the whole-tree gate is a phase-wide condition that completes once all wave-2 sibling plans land.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `LineupAssignmentScreen.tsx` fully migrated onto the shared `CardInjuryBadge`; ready for plan 41-06's audit (`CardInjuryBadge.audit.test.ts`, `CardInjuryBadge.crossSurface.test.tsx`) once sibling plans 41-03 (`PlayerStatsPanel.tsx`) and the `PieceOverlay.tsx` migration also land
- No blockers for the rest of Phase 41

---

_Phase: 41-card-injury-iconography_
_Completed: 2026-08-21_
