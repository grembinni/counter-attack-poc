---
phase: 47-select-based-roster-interaction
plan: 02
subsystem: ui
tags: [react, click-select, draft-mode, bench, accessibility]

# Dependency graph
requires: ["47-01"]
provides:
  - "BenchCarousel click-select prop contract: onCardClick(benchIndex)/onBenchAreaClick?()/selectedCardId?/benchAreaEligible?, replacing onCardDragStart/onDropToBench"
  - "DraftCardBody onClick widened to (event: React.SyntheticEvent<HTMLDivElement>) => void so a card/container that nests other clickable children (BenchCarousel's bench-area target) can stopPropagation from the card's own click"
  - "Target-based container click guard idiom (event.target.closest('button') / closest('[data-roster-card]')) as the robust propagation-isolation pattern for a click-completion container that wraps clickable children, proven more reliable than child-side stopPropagation alone when a child can be `disabled` (React skips onClick on disabled <button> elements, so its own stopPropagation() never runs — the guard must live on the container too)"
affects: ["47-03 (LineupAssignmentScreen.tsx port — currently typecheck-broken against BenchCarousel's new prop contract, consumes onCardClick/onBenchAreaClick/selectedCardId/benchAreaEligible)", "47-03 (CardInjuryBadge.crossSurface.test.tsx — one pre-existing 47-01-inherited test needs its drag simulation converted to click, logged in deferred-items.md)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Container click-completion target attaches onClick/role/tabIndex/onKeyDown only when eligible AND not disabled (mirrors DraftCardBody's click-gating idiom from 47-01, now applied to a container rather than a leaf card)"
    - "Propagation isolation for a click-completion container needs BOTH child-side stopPropagation (works when the child is enabled) AND a container-side event.target closest() check (catches the disabled-child case, since React does not invoke onClick on a disabled DOM button at all)"

key-files:
  created: []
  modified:
    - packages/client/src/components/BenchCarousel.tsx
    - packages/client/src/components/BenchCarousel.test.tsx
    - packages/client/src/components/DraftPackCarousel.tsx

key-decisions:
  - "Widened DraftCardBody's onClick from () => void to (event: React.SyntheticEvent<HTMLDivElement>) => void (the plan's Task 1 action text offered this as one of two explicit routes) rather than React.MouseEvent<HTMLDivElement> as the plan's action text literally suggested, because the same callback is invoked from both the div's onClick (a MouseEvent) and DraftCardBody's own handleKeyDown Enter/Space activation (a KeyboardEvent) — SyntheticEvent is the common ancestor type exposing stopPropagation() on both, and MouseEvent would not type-check against the KeyboardEvent call site"
  - "Added a target-based container click guard (event.target.closest('button' / '[data-roster-card]')) in BenchCarousel's bench-area click handler, in addition to the plan-specified child-side stopPropagation calls — discovered via the plan's own mandated regression tests (assertion 8: nav-button click must not complete the bench-area target) that React skips invoking onClick on a disabled <button> entirely, so the nav button's own stopPropagation() never executes while it's disabled (its initial/no-scroll-content state), yet the native click event still bubbles to the container in jsdom. The container-side check is the actual guard; the button/card-side stopPropagation calls remain as defense-in-depth for the enabled case, exactly as the plan's action text specified"

requirements-completed: [ROSTER-01, ROSTER-02, ROSTER-06, ROSTER-08]

# Metrics
duration: ~45min
completed: 2026-08-30
---

# Phase 47 Plan 02: BenchCarousel Click-Select Contract Summary

**Converted `BenchCarousel` from a native HTML5 drag source + drop target into a click-select source (`onCardClick`) and click-completion target (`onBenchAreaClick`), fully consuming the `DraftCardBody`/`.statCardSelected`/`.statCardEligible` contract from 47-01, with a fully click-based test rewrite and a hardened container-level propagation guard.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2/2 completed
- **Files modified:** 3

## Accomplishments

- `BenchCarousel.tsx`: `onCardDragStart`/`onDropToBench` replaced with `onCardClick(benchIndex)`/`onBenchAreaClick?()`; added `selectedCardId?`/`benchAreaEligible?`; deleted `handleDragStart`/`handleDragOver`/`handleDrop`; the container gains `.statCardEligible` plus click/keyboard affordance (`role="button"`/`tabIndex={0}`/Enter+Space `onKeyDown`) only when `benchAreaEligible === true && disabled !== true`; the OUT/RED-CARD/disabled selection-source guards from the old `handleDragStart` are preserved verbatim in the new `handleCardClick`
- `DraftPackCarousel.tsx`: `DraftCardBody`'s `onClick` prop widened to accept the originating `SyntheticEvent` (both its two internal call sites — the div's `onClick` attribute and `handleKeyDown`'s Enter/Space activation — updated) so a caller embedding `DraftCardBody` inside its own click-completion container (`BenchCarousel`) can call `event.stopPropagation()`
- `BenchCarousel.test.tsx`: fully rewritten for click-select — preserved every pre-existing non-interaction assertion (tier-border classes, `benchNumbers` jersey rendering, OUT/RED CARD badge precedence and `data-testid` hooks, `CardInjuryBadge` glyph presence/absence/ordering, empty-bench `.benchSlot` placeholder, carousel nav chrome, scroll-reset-on-content-change) and added the full click-select surface: click-to-select with bench-index reporting, disabled/OUT/RED-CARD source guards, `selectedCardId`/`benchAreaEligible` visual application, bench-area click-completion, and click-propagation isolation for both bench-card clicks and nav-button clicks (28/28 tests green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert BenchCarousel to a click-select source and click-completion target** - `241ed98c` (feat)
2. **Task 2: Rewrite BenchCarousel.test.tsx for the click contract** - `ec36dde0` (test)

_Note: no plan-metadata commit — worktree mode excludes STATE.md/ROADMAP.md updates; the orchestrator handles those centrally after merge._

## Files Created/Modified

- `packages/client/src/components/BenchCarousel.tsx` — click-select prop contract (`onCardClick`/`onBenchAreaClick?`/`selectedCardId?`/`benchAreaEligible?`); `handleCardClick` preserves the old drag-source guards; bench-area container gains conditional click/keyboard affordance and a target-based propagation guard (`event.target.closest('button'|'[data-roster-card]')`); module doc rewritten from drag-source-and-target language to click-select-source-and-target language
- `packages/client/src/components/BenchCarousel.test.tsx` — fully rewritten for the click contract; zero drag simulation remains
- `packages/client/src/components/DraftPackCarousel.tsx` — `DraftCardBody`'s `onClick` prop type widened from `() => void` to `(event: React.SyntheticEvent<HTMLDivElement>) => void`; `handleKeyDown`'s two `onClick()` calls updated to `onClick(e)`

## Decisions Made

- Chose `React.SyntheticEvent<HTMLDivElement>` over the plan text's suggested `React.MouseEvent<HTMLDivElement>` for the widened `onClick` type, since the same prop is invoked from both a `MouseEvent` context (the div's own `onClick`) and a `KeyboardEvent` context (`handleKeyDown`'s Enter/Space) — `SyntheticEvent` is the shared ancestor exposing `stopPropagation()` on both without a type error. Documented in the plan's own action text as an acceptable variation ("Record whichever route you take in the SUMMARY").
- Added a container-side `event.target.closest(...)` guard in `BenchCarousel`'s bench-area click handler, beyond what the plan's action text specified (child-side `stopPropagation` only). Discovered this was necessary via the plan's own mandated regression tests (Task 2 assertion 8): the nav buttons start `disabled` (no scroll content yet in a fresh render), and React does not invoke a disabled `<button>`'s `onClick` handler at all — so the button's own `stopPropagation()` call never executes in that state, yet the native click event still bubbles to the container. This is a genuine correctness gap in the plan's literal approach for exactly the scenario T-47-07 exists to prevent (a bubbled nav-button click completing an unintended bench move), so it's an in-scope Rule 1 bug fix, not a deviation from intent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed workspace dependencies and built `packages/shared`**
- **Found during:** Task 1 verification
- **Issue:** This worktree had no `node_modules` anywhere in the tree (fresh worktree checkout, `pnpm install` never run against it), so `vitest`/`tsc` all failed with module-resolution errors.
- **Fix:** Ran `pnpm install` at the workspace root and `pnpm --filter @counter-attack/shared build` to produce `packages/shared/dist`.
- **Files modified:** none (gitignored `node_modules`/build output)
- **Committed in:** n/a

**2. [Rule 1 - Bug] Container-side propagation guard for the bench-area click target (see Decisions Made above)**
- **Found during:** Task 2 verification (the plan's own mandated nav-button propagation regression test)
- **Issue:** Child-side `stopPropagation()` alone (as literally specified in the plan's Task 1 action text) does not prevent a disabled nav button's click from bubbling to and completing the bench-area click target, because React skips invoking `onClick` on a disabled `<button>` entirely.
- **Fix:** Added a `event.target.closest('button')` / `closest('[data-roster-card]')` check in the container's own click handler as the actual guard, keeping the button/card-side `stopPropagation()` calls as defense-in-depth for the enabled case.
- **Files modified:** `packages/client/src/components/BenchCarousel.tsx`
- **Verification:** All 4 T-47-07 propagation-isolation tests pass (card-click, nav-button-click × 2, non-eligible no-op)
- **Committed in:** `ec36dde0` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 environment setup, 1 Rule 1 bug fix — both required for the plan's own explicit verification/acceptance criteria to pass)
**Impact on plan:** No scope creep — the dependency install is environment setup only; the propagation-guard fix stays entirely within `BenchCarousel.tsx` (already in `files_modified`) and directly serves the plan's own T-47-07 threat mitigation and Task 2 acceptance criteria, none of which were satisfiable with the literal child-stopPropagation-only approach.

## Issues Encountered

- Logged one pre-existing, out-of-scope test regression to `.planning/phases/47-select-based-roster-interaction/deferred-items.md`: `CardInjuryBadge.crossSurface.test.tsx` has one failing test (`bench badges are unaffected by an open substitution-confirm popup`) that simulates a drag via `fireEvent.dragStart` on a `[draggable]` element. This element has not existed since 47-01 removed the native `draggable` HTML attribute from `DraftCardBody`'s render output (replaced with `data-interactive`) — confirmed pre-existing by the fact that `BenchCarousel.tsx`'s pre-47-02 `draggable`/`onDragStart` props passed into `DraftCardBody` were already excess/dead props against the 47-01 `DraftCardBodyProps` type, independent of anything this plan changed. Out of scope for 47-02 (`files_modified` is `BenchCarousel.tsx`/`BenchCarousel.test.tsx` only; this test exercises `LineupAssignmentScreen.tsx`, which this plan's own `<verification>` section explicitly excludes as a gate). Recommended fix (converting its drag simulation to click, mirroring `BenchCarousel.test.tsx`'s new pattern) is noted for plan 47-03, which ports `LineupAssignmentScreen.tsx` itself.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `BenchCarousel`'s click-select contract (`onCardClick`/`onBenchAreaClick?`/`selectedCardId?`/`benchAreaEligible?`) is now available for `LineupAssignmentScreen.tsx` (plan 47-03) to consume for all four surfaces (mid-match substitution bench, draft-mode bench).
- **Known, plan-documented pre-existing typecheck break (unchanged from 47-01, now also touching `BenchCarousel`'s new prop names):** `pnpm --filter @counter-attack/client typecheck` fails at `LineupAssignmentScreen.tsx:1125/1291/1309/1399` because that file still passes the old `onCardDragStart`/`onDropToBench` props to `BenchCarousel`/`DraftPackCarousel`. Explicitly called out in this plan's own `<verification>` section as "EXPECTED TO FAIL after this plan and is not a gate here" — resolved when plan 47-03 ports `LineupAssignmentScreen.tsx`.
- **Known, newly-logged pre-existing test break (inherited from 47-01, not from this plan):** `CardInjuryBadge.crossSurface.test.tsx` has one failing test relying on a `[draggable]` DOM query that has returned nothing since 47-01. See Issues Encountered / `deferred-items.md` for full detail and the recommended fix for plan 47-03.

## Self-Check: PASSED

- FOUND: `.planning/phases/47-select-based-roster-interaction/47-02-SUMMARY.md`
- FOUND: `packages/client/src/components/BenchCarousel.tsx`
- FOUND: `packages/client/src/components/BenchCarousel.test.tsx`
- FOUND: `packages/client/src/components/DraftPackCarousel.tsx`
- FOUND: `.planning/phases/47-select-based-roster-interaction/deferred-items.md`
- FOUND commit `241ed98c` (Task 1)
- FOUND commit `ec36dde0` (Task 2)

---
*Phase: 47-select-based-roster-interaction*
*Completed: 2026-08-30*
