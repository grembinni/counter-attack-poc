---
phase: 41-card-injury-iconography
plan: 05
subsystem: ui
tags: [react, typescript, vitest, card-injury-badge, bench-carousel]

# Dependency graph
requires:
  - phase: 41-card-injury-iconography (plan 01)
    provides: CardInjuryBadge.tsx shared component (CardInjuryBadge, CardColor, cardColorFor, cardColorForBenchEntry, cardInjuryLabel)
  - phase: 41-card-injury-iconography (plan 02)
    provides: BenchEntry.yellowCards / BenchEntry.injuryCount optional fields on the shared type
  - phase: 41-card-injury-iconography (plan 04)
    provides: LineupAssignmentScreen roster-card migration to the shared CardInjuryBadge (pattern this plan mirrors for the bench)
provides:
  - DraftCardBodyProps.cardColor / injuryCount optional props rendering the shared CardInjuryBadge glyph
  - BenchCarouselProps.benchCardStatus lookup-map prop threading per-card glyph state
  - LineupAssignmentScreen mid-match derivation of benchCardStatus from BenchEntry via cardColorForBenchEntry
  - First-ever bench card/injury glyph test coverage (BenchCarousel.test.tsx, LineupAssignmentScreen.test.tsx)
affects: [42-substitution-ux-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Shared DraftCardBody glyph slot: cardColor/injuryCount props render CardInjuryBadge unconditionally between jersey number and the RED CARD/OUT status badge, coexisting rather than replacing it'
    - 'Per-card status lookup map (Record<playerId, BenchCardStatus>) threaded through BenchCarousel, mirroring the existing unavailablePlayerIds/redCardedPlayerIds id-array pattern but carrying two correlated values per card'

key-files:
  created: []
  modified:
    - packages/client/src/components/DraftPackCarousel.tsx
    - packages/client/src/components/BenchCarousel.tsx
    - packages/client/src/components/BenchCarousel.test.tsx
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "cardColorForBenchEntry (not cardColorFor) used to derive bench glyph state — a BenchEntry has no redCarded field, so its status === 'redCarded' alone derives red"
  - 'benchCardStatus passed only to the mid-match BenchCarousel call site, never the draft-mode one — draft cards have no live match state, keeping the pre-match path provably unchanged'

patterns-established:
  - 'Bench card/injury display now uses the same CardInjuryBadge component and locked position (#number -> glyph -> status badge) as the pitch token, player-stats card, and roster card — the fourth and final surface unified'

requirements-completed: [ICON-02, ICON-03]

# Metrics
duration: ~6min (task execution; excludes one-time pnpm install/shared build needed to bootstrap the worktree)
completed: 2026-08-21
---

# Phase 41 Plan 05: Bench Card/Injury Iconography Summary

**Bench cards render the shared CardInjuryBadge glyph for the first time — booked/injured bench players now show that status on the bench, matching the pitch token, player-stats card, and roster card.**

## Performance

- **Duration:** ~6 min (task execution)
- **Started:** 2026-08-21T12:37:44-05:00 (first task commit)
- **Completed:** 2026-08-21T12:43:23-05:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `DraftCardBody` (the shared inner card renderer used by both `DraftPackCarousel` and `BenchCarousel`) now accepts optional `cardColor`/`injuryCount` props and renders the shared `CardInjuryBadge` glyph unconditionally, positioned immediately after the jersey number and ahead of the untouched `RED CARD`/`OUT` status badge (the two coexist per the UI-SPEC lock).
- `BenchCarousel` threads a new `benchCardStatus` lookup map (keyed by `PLAYER_POOL` card id, same key space as `unavailablePlayerIds`/`redCardedPlayerIds`/`benchNumbers`) through to each card.
- `LineupAssignmentScreen`'s mid-match branch derives `benchCardStatus` from the live `BenchEntry[]` via `cardColorForBenchEntry`, passed only to the mid-match `BenchCarousel` call site — the draft-mode bench call site is untouched and receives no new prop.
- First-ever bench card/injury glyph test coverage: 7 new `BenchCarousel.test.tsx` tests (non-regression, booked, injured, both-glyphs, red-card coexistence, D-02 sibling-order position, drag-unaffected) and 1 new end-to-end `LineupAssignmentScreen.test.tsx` integration test proving the `BenchEntry` -> glyph wiring.

## Task Commits

Each task was committed atomically:

1. **Task 1: Give DraftCardBody the card/injury glyph** - `f6422c6` (feat)
2. **Task 2: Thread bench card status from BenchEntry through BenchCarousel** - `a475d0b` (feat)
3. **Task 3: First-ever bench glyph test coverage** - `0e4727c` (test)

_Note: worktree isolation — STATE.md/ROADMAP.md updates and the plan-metadata commit are owned by the orchestrator after merge, not this executor._

## Files Created/Modified

- `packages/client/src/components/DraftPackCarousel.tsx` - `DraftCardBodyProps` gains optional `cardColor`/`injuryCount`; `CardInjuryBadge` rendered unconditionally in the locked `cardMeta` slot
- `packages/client/src/components/BenchCarousel.tsx` - `BenchCarouselProps.benchCardStatus` lookup map; per-card `status` lookup passed as `cardColor`/`injuryCount` to `DraftCardBody`
- `packages/client/src/components/BenchCarousel.test.tsx` - new `Phase 41 (ICON-03): bench card/injury glyph` describe block (7 tests)
- `packages/client/src/components/LineupAssignmentScreen.tsx` - imports `cardColorForBenchEntry`/`BenchCardStatus`; builds `benchCardStatus` from `benchList` in the mid-match branch; passes it to the mid-match `BenchCarousel` only
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` - new `BENCH_WITH_STATUS` fixture and one end-to-end derivation test

## Decisions Made

- Used `cardColorForBenchEntry` (not `cardColorFor`) for the bench derivation — a `BenchEntry` has no `redCarded` field; its `status: 'redCarded'` alone is sufficient to derive red, per the shared module's documented contract.
- `benchCardStatus` is a single lookup map rather than parallel id arrays (unlike `unavailablePlayerIds`/`redCardedPlayerIds`) because the glyph needs two correlated values (`cardColor` + `injuryCount`) per card, and the caller already owns the `BenchEntry` list they're derived from.

## Deviations from Plan

None - plan executed exactly as written. One environment bootstrapping step was required but is not a deviation from the plan itself: this worktree had no `node_modules` (fresh worktree checkout), so `pnpm install` was run once before any typecheck/test/lint command would work, followed by `pnpm --filter @counter-attack/shared build` per the plan's own stated verification prerequisite (the plan already documents this as required "before any dependent typecheck — the shared package resolves through `dist`, and this plan reads `BenchEntry`'s plan 41-02 fields").

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four card/injury display surfaces (pitch token, player-stats card, roster card, bench card) now share one component and one locked visual contract — ready for Phase 42's substitution UX overhaul, which the plan notes will consume this component for its own bench red-card marker (per `41-CONTEXT.md` Integration Points).
- Full client test suite (1034 tests) and `pnpm -r typecheck` both green after this plan; no regressions in draft-pack, bench drag/drop, or roster-card behavior.

---

_Phase: 41-card-injury-iconography_
_Completed: 2026-08-21_
