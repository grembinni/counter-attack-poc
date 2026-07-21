---
phase: 29-draft-ui-pick-and-swap-flow
plan: 08
subsystem: ui
tags: [react, drag-and-drop, css-modules, vitest, draft-mode]

# Dependency graph
requires:
  - phase: 29-draft-ui-pick-and-swap-flow (plans 03/05)
    provides: DraftPackCarousel carousel chrome pattern, BenchCarousel/LineupAssignmentScreen drag-state architecture
provides:
  - BenchCarousel reworked into a real left/right carousel (viewport/track/nav) matching DraftPackCarousel exactly
  - Widened .cardTier* card classes (260px -> 320px min-width) for stat-chip legibility, isolated from Standard-mode's .statCardBase
  - Container-level onDragEnd reset guaranteeing dragState never wedges across pack/bench/slot drags
  - Confirm button gated on all 11 lineup slots filled (client-side mirror of server LINEUP_INCOMPLETE)
  - gameError mapping for LINEUP_ALREADY_CONFIRMED / LINEUP_INCOMPLETE rejection messages
affects: [29-07-server-lifecycle-guards, 29-VERIFICATION, phase-29-human-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carousel viewport/track/nav chrome (carouselViewport + ref'd carouselTrack + two carouselNav buttons) reused verbatim across DraftPackCarousel and BenchCarousel"
    - 'Container-level dragend reset: a single onDragEnd on the draft-mode screen root catches the bubbling native dragend from any descendant draggable, avoiding per-child prop threading'

key-files:
  created:
    - packages/client/src/components/BenchCarousel.test.tsx
  modified:
    - packages/client/src/components/BenchCarousel.tsx
    - packages/client/src/components/DraftPackCarousel.tsx
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "Replicated DraftPackCarousel's scroll-state pattern directly in BenchCarousel rather than extracting a shared helper (plan left this to executor's judgement; replication kept both files' existing tests/behavior untouched)"
  - 'Widened only the five .cardTier* classes (not .statCardBase) to 320px min-width, preserving the Standard-mode 1260px 4-column lineup grid layout exactly'
  - "Used a single container-level onDragEnd (native dragend bubbling) instead of threading onDragEnd through DraftPackCarousel/BenchCarousel's DraftCardBody props, keeping Task 2 changes scoped to LineupAssignmentScreen.tsx only"
  - 'Confirm button gating and gameError mappings are additive/harmless client-only changes — they compile and test cleanly regardless of whether the parallel 29-07 server plan has merged, since gameError is a plain string comparison'

requirements-completed: [DRAFT-06, DRAFT-09]

patterns-established:
  - 'Carousel chrome parity: any future card-row component (draft-pack, bench) should reuse carouselViewport/carouselTrack/carouselNav + the updateScrollState/scrollByCard/SCROLL_STEP_PX trio rather than inventing new scroll UI'

# Metrics
duration: 38min
completed: 2026-07-21
---

# Phase 29 Plan 08: Bench Carousel Rework + Card Legibility + Drag-State Hardening Summary

**Reworked BenchCarousel into a real left/right carousel matching DraftPackCarousel's chrome, widened draft/bench card stat legibility via `.cardTier*` classes, and hardened client drag-state via a container-level `dragend` reset plus Confirm-gating on a complete 11-slot lineup.**

## Performance

- **Duration:** 38 min (includes ~3.5 min `pnpm install` for a fresh worktree with no `node_modules`)
- **Started:** 2026-07-21T18:21:00Z (approx, worktree base commit `cdfa23c`)
- **Completed:** 2026-07-21T18:59:41Z
- **Tasks:** 2 completed
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- `BenchCarousel` now renders the identical three-part carousel chrome as `DraftPackCarousel` (`carouselViewport` + `ref`'d `carouselTrack` + two `carouselNav` Previous/Next buttons with the same scroll-state/scroll-by-card model), replacing the previous `flex-wrap: wrap` static row (DRAFT-09/D-21).
- Widened the five `.cardTier*` card classes from 260px to 320px `min-width` so every role-filtered stat chip renders legibly, while leaving `.statCardBase` (shared by the Standard-mode fixed-grid lineup cards) completely untouched (DRAFT-06).
- Every drag gesture on a pack, bench, or lineup-slot card now guarantees `dragState` resets to `null` on completion — success, cancel, or drop on empty space — via a single container-level `onDragEnd` on the draft-mode screen root that catches the bubbling native `dragend` event.
- The draft Confirm button is now gated on `draftView.draftComplete && draftView.lineupSlots.every(id => id !== null)`, mirroring the server's `LINEUP_INCOMPLETE` guard client-side; shows "Fill all 11 lineup positions to confirm." helper copy when the draft is complete but the lineup isn't.
- `gameError` effect extended to map `LINEUP_ALREADY_CONFIRMED` and `LINEUP_INCOMPLETE` server reasons to visible rejection text (additive — harmless if the parallel 29-07 server plan hasn't merged yet).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rework BenchCarousel into a real carousel + widen cards for legibility** - `63f73df` (feat)
2. **Task 2: Harden client drag-state resets + gate Confirm on a complete lineup** - `b3431f6` (feat)

_No plan-metadata commit in this worktree — orchestrator handles STATE.md/ROADMAP.md updates centrally after merge (per worktree execution contract)._

## Files Created/Modified

- `packages/client/src/components/BenchCarousel.tsx` - Reworked into a carousel (viewport/track/nav), preserving the drag-source + drop-target contract and the D-22 empty-bench placeholder
- `packages/client/src/components/DraftPackCarousel.tsx` - `SCROLL_STEP_PX` updated from 268 to 328 to match the widened 320px card + 8px gap (kept in sync with BenchCarousel's identical constant)
- `packages/client/src/components/LineupAssignmentScreen.module.css` - `.benchCarousel` rule reworked from `flex-wrap: wrap` to a simple column wrapper around the shared carousel chrome; `min-width: 320px` added to the five `.cardTier*` classes
- `packages/client/src/components/LineupAssignmentScreen.tsx` - Container-level `onDragEnd` reset on the draft-mode screen root; `isLineupComplete` gating on the Confirm button + helper copy; `gameError` effect extended for two new draft-lifecycle reasons
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` - Rescoped the D-12 "Previous card" query to the draft-pack row (now ambiguous since BenchCarousel has its own nav buttons); updated the D-23 draft-complete test to pair `draftComplete: true` with a full 11-slot lineup; added Confirm-gating tests and a no-wedge drag/drop regression test
- `packages/client/src/components/BenchCarousel.test.tsx` (new) - Nav chrome, scroll-track structure, card count, drag-source/drop-target contract preservation, and D-22 empty-bench placeholder tests

## Decisions Made

- Replicated (rather than extracted) the carousel scroll-state logic in `BenchCarousel.tsx` — the plan explicitly left extraction to executor judgement, and replication kept `DraftPackCarousel.tsx`'s existing behavior/tests untouched with lower risk.
- Card-width increase applied only to `.cardTier*` classes, never `.statCardBase`, to protect the Standard-mode 1260px 4-column lineup grid from a layout regression.
- Drag-end reset implemented as a single container-level `onDragEnd` (native `dragend` bubbling) on the draft-mode screen root, rather than threading a new `onCardDragEnd` prop through `DraftPackCarousel`/`BenchCarousel` — this kept Task 2's changes scoped to `LineupAssignmentScreen.tsx` only, matching the plan's `<files>` list for that task, and requires no changes to either carousel component.
- Confirm-gating and the two new `gameError` mappings are purely additive client-side checks; they do not depend on the parallel 29-07 server plan having merged, since `gameError` is typed as `string | null` in the store (plain string comparison, no enum coupling).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ambiguous "Previous card" query in the pre-existing D-12 waiting-for-opponent test**

- **Found during:** Task 1 (full-suite verification after the BenchCarousel rework)
- **Issue:** `LineupAssignmentScreen.test.tsx`'s D-12 test used an unscoped `screen.getByLabelText('Previous card')`. Once `BenchCarousel` gained its own Previous/Next nav buttons with the same aria-labels (a direct, intended consequence of Task 1's carousel rework), this query became ambiguous and the test started failing with a "multiple elements found" error.
- **Fix:** Scoped the query to the draft-pack row specifically via `within(container.querySelector('[class*="draftPackRow"]')).getByLabelText('Previous card')`.
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- **Verification:** Full client suite (365 tests, then 368 after Task 2) green.
- **Committed in:** `63f73df` (Task 1 commit)

**2. [Rule 1 - Bug] Updated the D-23 draft-complete test fixture to pair `draftComplete: true` with a full lineup**

- **Found during:** Task 2 (Confirm-gating implementation)
- **Issue:** The plan's own acceptance criteria require gating the Confirm button on lineup completeness. The pre-existing D-23 test asserted a Confirm button appears whenever `draftComplete: true`, using the default `makeDraftView()` fixture which only fills 2 of 11 lineup slots — this fixture is now an intentionally-invalid combination once the gating lands, and the test would otherwise fail.
- **Fix:** Added a `FULL_LINEUP` (11 filled slot ids) fixture and updated the D-23 test to pass `lineupSlots: FULL_LINEUP` alongside `draftComplete: true`, matching the realistic paired state.
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- **Verification:** Test passes; new Confirm-gating tests (null-slot -> no button + helper text; full lineup -> button present and calls `onConfirm`) added alongside it.
- **Committed in:** `b3431f6` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both pre-existing tests that needed rescoping/updating as a direct and expected consequence of the plan's own required changes)
**Impact on plan:** Both fixes were necessary to keep the full client suite green after intentional, plan-mandated behavior changes (bench gaining its own nav buttons; Confirm gated on lineup completeness). No scope creep — no unrelated code touched.

## Issues Encountered

- The worktree had no `node_modules` at all (fresh worktree, prior attempt fully discarded per the task context). Ran `pnpm install --frozen-lockfile` at the repo root (safe, no Windows junction workarounds per the project's junction-risk memory) followed by `pnpm build` in `packages/shared` (its `dist/` output is required for the client's Vite/Vitest module resolution of `@counter-attack/shared`). Both completed cleanly with no side effects on the main repo's `node_modules`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Client-side gap closure for 29-08 is complete: bench carousel UX, card legibility, and drag-state robustness/Confirm-gating are all in place and verified (typecheck clean, 368/368 client tests green).
- This plan is one of two parallel gap-closure tracks (client-side here; server-side lifecycle guards in 29-07). The `gameError` mappings added here (`LINEUP_ALREADY_CONFIRMED`/`LINEUP_INCOMPLETE`) are wired defensively ahead of 29-07's server-side emission of those reasons — no further client work should be needed once 29-07 merges, but a live two-tab UAT pass covering both plans together is recommended before Phase 29's human-verification gate is re-run (per 29-VERIFICATION.md gap tracking).
- No blockers identified for merge.

---

_Phase: 29-draft-ui-pick-and-swap-flow_
_Completed: 2026-07-21_
