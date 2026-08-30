---
phase: 41-card-injury-iconography
plan: 01
subsystem: ui
tags: [react, svg, design-tokens, testing, vitest]

# Dependency graph
requires: []
provides:
  - 'CardInjuryBadge.tsx: the single shared card/injury glyph module (ICON-01 foundation)'
  - 'cardColorFor / cardColorForBenchEntry derivation functions (red-wins-over-yellow precedence)'
  - 'cardInjuryLabel accessible-label composer'
  - 'CardInjuryBadgeGroup (layered, D-03) and CardInjuryBadge (side-by-side, D-04) exports'
affects: [41-03, 41-04, 41-05, 41-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'One module owns glyph geometry + derivation + accessible-label copy; consumers never re-implement the red-wins-over-yellow ternary'
    - 'CardInjuryBadge composes CardInjuryBadgeGroup twice (offset centres) so glyph geometry has exactly one definition across both render modes'

key-files:
  created:
    - packages/client/src/components/CardInjuryBadge.tsx
    - packages/client/src/components/CardInjuryBadge.test.tsx
  modified: []

key-decisions:
  - "cardColorForBenchEntry accepts a structural Pick<BenchEntry,'status'> & { yellowCards?: 0|1|2 } type instead of Pick<BenchEntry,'status'|'yellowCards'>, since BenchEntry.yellowCards is added by sibling same-wave plan 41-02 landing independently in a separate worktree — this avoids a compile-time dependency on that plan's merge order while still accepting any real BenchEntry once 41-02 lands (structural typing)"

patterns-established:
  - 'Glyph geometry (cardWidth = r*1.5, cardHeight = r*2, barLength = r*1.8, barThickness = r*0.6) is lifted verbatim from PieceOverlay.tsx and now lives in exactly one place'

requirements-completed: [ICON-01, ICON-02]

# Metrics
duration: ~20min
completed: 2026-08-21
---

# Phase 41 Plan 01: Shared CardInjuryBadge Module Summary

**Extracted the card/injury glyph (colored-rectangle card + white-cross injury, red-wins-over-yellow derivation) from `PieceOverlay.tsx` into a single shared `CardInjuryBadge.tsx` module with two render modes — a layered pitch-token composer (`CardInjuryBadgeGroup`, D-03) and a self-contained side-by-side standalone badge (`CardInjuryBadge`, D-04) — plus centralized derivation (`cardColorFor`/`cardColorForBenchEntry`) and accessible-label composition (`cardInjuryLabel`).**

## Performance

- **Duration:** ~20 min (includes a cold `pnpm install` + `packages/shared` build in the worktree, since neither existed yet)
- **Started:** 2026-08-21T11:32:30-05:00 (worktree base commit)
- **Completed:** 2026-08-21T11:50:05-05:00
- **Tasks:** 2/2
- **Files created:** 2

## Accomplishments

- `CardInjuryBadge.tsx` exports all seven required symbols: `CardColor`, `BenchCardStatus`, `cardColorFor`, `cardColorForBenchEntry`, `cardInjuryLabel`, `CardInjuryBadgeGroup`, `CardInjuryBadge`
- Glyph geometry lifted verbatim from `PieceOverlay.tsx:240-289` — one definition, reused by both render modes
- Standalone `CardInjuryBadge` renders card + injury side by side with no horizontal overlap (D-04), verified by an explicit `cardRight <= injuryLeft` assertion
- `CardInjuryBadgeGroup` preserves the pitch token's existing layered, same-centre treatment (D-03)
- Injury glyph is strictly binary (1 vs 2+ renders the identical single cross); only `cardInjuryLabel`'s accessible text distinguishes count
- Zero hex color literals — every fill/stroke resolves through `tokens.css` custom properties
- 25 unit tests covering derivation precedence, label composition, both render modes, D-04 no-overlap, D-05 DOM ordering, D-03 centring, and token-fill assertions — all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the shared CardInjuryBadge module** - `cc270d1` (feat)
2. **Task 2: Unit spec for the shared badge module** - `10a0aca` (test)

**Plan metadata:** committed as part of this SUMMARY (worktree mode — orchestrator handles final shared-file commit after merge)

## Files Created/Modified

- `packages/client/src/components/CardInjuryBadge.tsx` - Single shared owner of card/injury glyph geometry, derivation, and accessible-label copy (221 lines)
- `packages/client/src/components/CardInjuryBadge.test.tsx` - Unit spec, 25 passing tests (207 lines)

## Decisions Made

- **`cardColorForBenchEntry` parameter type uses structural intersection, not `Pick<BenchEntry, 'status' | 'yellowCards'>`.** Plan 41-02 (same wave, `depends_on: []`, executing in a sibling worktree) is the plan that actually adds `yellowCards`/`injuryCount` to `BenchEntry` in `packages/shared/src/types.ts`. Since this worktree does not yet see that change, writing the literal `Pick<BenchEntry, 'status' | 'yellowCards'>` signature the plan's `<action>` text describes would fail to compile (`yellowCards` doesn't exist on `BenchEntry` yet in this isolated worktree). Used `Pick<BenchEntry, 'status'> & { yellowCards?: 0 | 1 | 2 }` instead — behaviorally identical, accepts any real `BenchEntry` today and once 41-02's field addition merges (TypeScript structural typing), and requires no coordination with 41-02's landing order or file set.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adjusted `cardColorForBenchEntry` parameter type to avoid a same-wave cross-plan compile dependency**

- **Found during:** Task 1 (writing `cardColorForBenchEntry`)
- **Issue:** The plan's `<action>` text specifies `entry: Pick<BenchEntry, 'status' | 'yellowCards'>`, but `BenchEntry.yellowCards` is added by sibling plan 41-02, which executes independently in a separate worktree in the same wave. Writing the literal signature would fail `pnpm --filter @counter-attack/client typecheck` in this worktree (acceptance criterion), since the field doesn't exist on `BenchEntry` here.
- **Fix:** Used a structural intersection type (`Pick<BenchEntry, 'status'> & { yellowCards?: 0 | 1 | 2 }`) that compiles today and remains structurally compatible with real `BenchEntry` values once 41-02 lands — no behavior change, same derivation logic.
- **Files modified:** `packages/client/src/components/CardInjuryBadge.tsx`
- **Verification:** `pnpm --filter @counter-attack/client typecheck` exits 0; `cardColorForBenchEntry` unit tests (precedence cases) pass.
- **Committed in:** `cc270d1` (Task 1 commit)

**2. [Rule 1 - Bug] Removed an unnecessary type assertion flagged by eslint**

- **Found during:** Task 1, post-write eslint pass
- **Issue:** An initial `(entry.status as BenchEntryStatus)` cast triggered `@typescript-eslint/no-unnecessary-type-assertion` since the field is already typed as `BenchEntryStatus` via the `Pick`.
- **Fix:** Removed the cast and the now-unused `BenchEntryStatus` import.
- **Files modified:** `packages/client/src/components/CardInjuryBadge.tsx`
- **Verification:** `pnpm exec eslint packages/client/src/components/CardInjuryBadge.tsx` exits 0.
- **Committed in:** `cc270d1` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking cross-plan compile dependency, 1 lint-driven cleanup)
**Impact on plan:** Both fixes were necessary to satisfy the plan's own acceptance criteria (typecheck/eslint exit 0) inside this worktree's isolated view of the codebase. No scope creep — `cardColorForBenchEntry`'s runtime behavior is unchanged from the plan's specification.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no `dist/` build, so the initial `pnpm --filter @counter-attack/client typecheck` failed with unrelated pre-existing errors (`Cannot find module '@counter-attack/shared'`, plus stray `useGameStore.ts`/`uniformStyles.test.tsx` errors that were themselves downstream of the missing `@counter-attack/shared` type declarations). Resolved by running `pnpm install` at the worktree root and `pnpm --filter @counter-attack/shared build` before re-running typecheck — both clean afterward. Not a deviation from the plan itself (environment setup, not code), so not logged under Deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CardInjuryBadge.tsx` is ready for plans 41-03/41-04/41-05 to migrate the four consumer surfaces (pitch token, player-stats card, roster card, bench card) onto it.
- No consumer changes were made this plan — `git diff --stat` from the worktree base shows exactly two new files and zero modified files, matching the plan's own `<verification>` requirement.
- Plan 41-02 (sibling, same wave) still needs to land its `BenchEntry.yellowCards`/`injuryCount` fields in `packages/shared/src/types.ts` before the bench surface (41-05) can pass real card/injury data through `cardColorForBenchEntry` — this plan's structural-intersection type accepts that shape once it exists, no further change needed here.
- Post-merge, plan 41-06's audit grep (`redCarded === true ?` across `packages/client/src/components/*.tsx` excluding this file) should be re-run once 41-03/41-04/41-05 migrate their consumers.

---

_Phase: 41-card-injury-iconography_
_Completed: 2026-08-21_
