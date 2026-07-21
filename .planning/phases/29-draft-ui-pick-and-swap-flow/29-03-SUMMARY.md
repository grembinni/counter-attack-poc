---
phase: 29-draft-ui-pick-and-swap-flow
plan: 03
subsystem: client
tags: [react, css-modules, drag-and-drop, carousel, draft-mode]

requires:
  - phase: 28-draft-data-model
    provides: TieredPoolPlayer/DraftTier types, generateMatchPacks pack generation
  - phase: 29-draft-ui-pick-and-swap-flow
    plan: 01
    provides: DraftSession/DraftClientView types (referenced, not consumed directly by this plan)
provides:
  - 'DraftPackCarousel component: variable-size, tier-sorted, left/right-nav, drag-source-only draft-pack row'
  - 'DraftCardBody shared inner card renderer + TIER_ORDER/TIER_CARD_CLASS exports'
  - 'BenchCarousel component: dynamic 0..16-card row, drag source + drop target'
  - '5 tier-border CSS classes + carousel chrome classes in LineupAssignmentScreen.module.css'
affects: [29-05-client-screen]

tech-stack:
  added: []
  patterns:
    - 'Shared inner card renderer (DraftCardBody) exported from DraftPackCarousel.tsx and imported by BenchCarousel.tsx — single source of truth for card markup/tier-border styling across both carousels'
    - 'Payload-free onDropToBench callback — BenchCarousel signals a drop landed but never reads dataTransfer to resolve card/origin; the parent (Plan 05) owns drag-state resolution via onCardDragStart callbacks'
    - 'Carousel scroll-state via useRef + scrollLeft/scrollWidth/clientWidth checked on scroll and on cards-prop change (useEffect resets to leftmost on new pack)'

key-files:
  created:
    - packages/client/src/components/DraftPackCarousel.tsx
    - packages/client/src/components/BenchCarousel.tsx
    - packages/client/src/components/DraftPackCarousel.test.tsx
  modified:
    - packages/client/src/components/LineupAssignmentScreen.module.css

key-decisions:
  - 'TIER_CARD_CLASS declared as Record<DraftTier, string> (matching plan spec literally) using non-null assertions on the CSS-module property access, since noUncheckedIndexedAccess types bare `styles.cardTierChase` as string | undefined — every referenced class is verified present via grep in the same commit'
  - 'BenchCarousel drag-start payload (`bench:<index>`) exists purely to satisfy native HTML5 drag initiation requirements — it is NOT the resolution channel; onCardDragStart(benchIndex) is the actual signal the parent uses, per the plan action text'

requirements-completed: [DRAFT-06, DRAFT-09]

duration: ~25min
completed: 2026-07-21
---

# Phase 29 Plan 03: Draft Card Carousels Summary

**Two new client carousels — `DraftPackCarousel` (variable-size, tier-sorted, drag-source-only pack row) and `BenchCarousel` (dynamic drag-source + drop-target bench) — sharing one `DraftCardBody` renderer and five new tier-border CSS classes, isolating all new draft visuals so Plan 05 only wires `.tsx`.**

## Performance

- **Duration:** ~25 min (includes one-time `pnpm install` + `@counter-attack/shared` build to populate the worktree's missing `node_modules`/`dist`)
- **Completed:** 2026-07-21
- **Tasks:** 2/2 completed
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments

- Added 5 tier-border CSS classes (`cardTierChase`/`cardTierRare`/`cardTierUncommon`/`cardTierCommon`/`cardTierKeeper`, 3px solid tier-colored borders per D-17/D-19) plus carousel chrome classes (`draftPackRow`, `carouselViewport`, `carouselTrack`, `carouselNav`/`carouselNavDisabled`, `draftRowDisabled`, `waitingIndicator`, `cyclePickCounter`, `keeperBanner`, `benchCarousel`) to `LineupAssignmentScreen.module.css`, all reusing the existing dark-theme tokens — no new base palette.
- Built `DraftPackCarousel.tsx`: renders `cards.map(...)` (variable length, never hardcoded to 7 — verified with a 6-card test), sorted rarest-first (`TIER_ORDER = ['chase','rare','uncommon','common','keeper']`), resets scroll to the leftmost card on every new-pack `cards` prop change (`useEffect`), with `‹`/`›` nav buttons that scroll the track and disable at each end. Cards are drag-source-only: `draggable`, `onDragStart` writes `pack:<cardId>` to `dataTransfer` and calls `onCardDragStart(cardId)` — no `onDrop`/`onDragOver` attached to cards (D-06 one-way-out).
- Extracted `DraftCardBody` — a shared inner card renderer mirroring `LineupStatCard`'s exact `TeamBadge`/`cardBody`/`cardHeader`/`statGrid`/`statChip` markup and `STAT_LABELS` role-filter, parameterized by `card`, `teamId`, optional `jerseyNumber`, and drag handler props — plus exported `TIER_ORDER`/`TIER_CARD_CLASS` constants, all reused by `BenchCarousel`.
- Built `BenchCarousel.tsx`: renders `cards.map(...)` dynamically (0..16, D-09) reusing `DraftCardBody`; each card is a drag source (`onCardDragStart(benchIndex)`) and the bench container itself is a drop target (`onDragOver` preventDefault + `onDrop` calls the payload-free `onDropToBench()` — the parent resolves which card/origin via its own drag-state, per the plan's explicit "must NOT read dataTransfer to decide anything" instruction). Empty bench (0 cards) falls back to the existing dashed `.benchSlot` placeholder style (D-22, no new empty-state component). `benchNumbers` prop renders `#{number}` in the jersey-number header slot once provided.
- Added `DraftPackCarousel.test.tsx` (Vitest + `@testing-library/react`, jsdom): 6 tests covering rarest-first DOM order, a 6-card pack rendering exactly 6 cards, `TIER_CARD_CLASS` application per tier, nav-button aria-labels + Previous disabled at list start, `pack:`-prefixed drag-start `dataTransfer.setData` payload, and structural confirmation that card elements have no `onDrop`/`onDragOver` handlers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tier border CSS + shared draft card renderer + DraftPackCarousel** - `f103717` (feat)
2. **Task 2: BenchCarousel + DraftPackCarousel component tests** - `b237e36` (feat)

## Files Created/Modified

- `packages/client/src/components/DraftPackCarousel.tsx` (NEW) - `DraftPackCarousel` component, `DraftCardBody` shared inner card renderer, `TIER_ORDER`, `TIER_CARD_CLASS` constants
- `packages/client/src/components/BenchCarousel.tsx` (NEW) - `BenchCarousel` component reusing `DraftCardBody`/`TIER_CARD_CLASS`
- `packages/client/src/components/DraftPackCarousel.test.tsx` (NEW) - 6 component tests (sort, variable size, tier classes, nav wiring, drag-start payload, one-way-out)
- `packages/client/src/components/LineupAssignmentScreen.module.css` (MODIFIED) - added tier-border classes + carousel/bench chrome classes; no existing rule changed

## Decisions Made

- `TIER_CARD_CLASS` is typed exactly as the plan specifies (`Record<DraftTier, string>`), using non-null assertions on the CSS-module property lookups to satisfy `noUncheckedIndexedAccess` (project-wide `tsconfig.base.json` setting) — every referenced class name (`cardTierChase`, `cardTierRare`, `cardTierUncommon`, `cardTierCommon`, `cardTierKeeper`) is confirmed present via `grep` against `LineupAssignmentScreen.module.css` in the same task's commit.
- `BenchCarousel`'s `bench:<index>` dataTransfer string exists solely to satisfy native HTML5 drag-and-drop initiation requirements (a `dragstart` needs a payload to be a valid drag) — it is explicitly NOT the resolution channel; `onCardDragStart(benchIndex)` is the callback the parent (Plan 05) uses to track drag origin, matching the plan's instruction that `BenchCarousel.onDrop` must never read `dataTransfer` to decide anything.
- Removed an initially-added but unused `cardId` parameter from `BenchCarousel`'s internal `handleDragStart` helper (caught by the project's pre-commit ESLint `no-unused-vars` gate) — `benchIndex` alone is sufficient since the dataTransfer payload and the `onCardDragStart` callback are both index-keyed, not id-keyed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused `react-hooks/exhaustive-deps` eslint-disable comment**

- **Found during:** Task 1 (first commit attempt)
- **Issue:** The project's ESLint config has no `react-hooks` plugin registered, so a `// eslint-disable-next-line react-hooks/exhaustive-deps` comment on the pack-change `useEffect` failed the pre-commit hook with "Definition for rule 'react-hooks/exhaustive-deps' was not found".
- **Fix:** Removed the now-unnecessary disable comment (no rule exists to suppress).
- **Files modified:** `packages/client/src/components/DraftPackCarousel.tsx`
- **Commit:** `f103717`

**2. [Rule 1 - Bug] Removed unused `cardId` parameter from BenchCarousel's drag-start helper**

- **Found during:** Task 2 (first commit attempt)
- **Issue:** `@typescript-eslint/no-unused-vars` failed the pre-commit hook — `handleDragStart`'s third parameter (`cardId: string`) was accepted but never read.
- **Fix:** Dropped the parameter; `benchIndex` alone drives both the dataTransfer payload and the `onCardDragStart` callback.
- **Files modified:** `packages/client/src/components/BenchCarousel.tsx`
- **Commit:** `b237e36`

**3. [Rule 3 - Blocking] `exactOptionalPropertyTypes` conditional-spread for `jerseyNumber`**

- **Found during:** Task 2 typecheck
- **Issue:** `BenchCarousel` passed `jerseyNumber={benchNumbers?.[card.id]}` (type `number | undefined`) directly to `DraftCardBody`'s optional `jerseyNumber?: number` prop; the workspace's `exactOptionalPropertyTypes: true` rejects assigning `undefined` to an optional property that doesn't itself include `undefined` in its type.
- **Fix:** Conditionally spread the prop (`{...(jerseyNumber !== undefined ? { jerseyNumber } : {})}`) so the prop is omitted entirely rather than passed as `undefined`.
- **Files modified:** `packages/client/src/components/BenchCarousel.tsx`
- **Commit:** `b237e36`

No Rule 4 (architectural) deviations — plan's component boundaries, file ownership, and prop contracts were followed exactly as written.

## Issues Encountered

- Worktree had no `node_modules` (fresh git worktree checkout) — ran `pnpm install --frozen-lockfile` (429 packages resolved from the existing pnpm store, zero downloads, no junction workaround used per project memory on Windows junction risk).
- `@counter-attack/shared`'s `dist/` output didn't exist yet in the fresh worktree, causing an initial `pnpm --filter @counter-attack/client typecheck` failure (`Cannot find module '@counter-attack/shared'`) until `pnpm --filter @counter-attack/shared build` was run once. Normal monorepo build-order requirement, not a plan deviation.

## Next Phase Readiness

- `DraftPackCarousel`, `BenchCarousel`, `DraftCardBody`, `TIER_ORDER`, and `TIER_CARD_CLASS` are all committed and typecheck-clean; Plan 05 (client screen integration) can import them directly and wire drag-drop resolution logic without touching any CSS in this file.
- Full client test suite (352 tests across 18 files, including the 6 new `DraftPackCarousel.test.tsx` tests) passes with no regressions.
- Standard-mode `LineupAssignmentScreen` visuals are untouched — only additive CSS classes were introduced; no existing class or component prop was changed.
- No blockers for Plan 05.

---

_Phase: 29-draft-ui-pick-and-swap-flow_
_Completed: 2026-07-21_
