---
phase: 47-select-based-roster-interaction
plan: 04
subsystem: ui
tags: [react, testing, click-select, roster, draft-mode, mid-match, vitest]

# Dependency graph
requires:
  - phase: 47-03
    provides: "LineupAssignmentScreen.tsx fully ported to click-to-select across all four roster surfaces — zero native HTML5 drag-and-drop code remains"
provides:
  - "LineupAssignmentScreen.test.tsx fully rewritten from drag simulation to fireEvent.click simulation across all four roster surfaces (mid-match positioning, mid-match substitution, Standard pregame swap, draft pack/slot/bench), 107/107 tests green"
  - "First-ever explicit gesture-level test coverage for ROSTER-03 (deselect-on-second-click), ROSTER-05 (mode-crossing selection-clearing regression), the D-07/D-08 selection-switch asymmetry, and ROSTER-07 (Standard pregame click-to-swap)"
affects: ["47-05 (CardInjuryBadge.crossSurface.test.tsx conversion — untouched by this plan, explicitly out of scope) and 47-06 (knip + full-suite gate — this plan's file is the primary behavioural evidence source)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS Module class-name assertions in this Vitest config are NOT literal — `container.querySelector('.statCardEligible')` never matches because class names are hashed at runtime. Two safe patterns exist side by side in this file: `[class*=\"statCardEligible\"]` attribute-substring selectors for querySelector/querySelectorAll, and `.toMatch(/statCardEligible/)` regex assertions against an already-retrieved `className` string. Bare `.classname` CSS selectors must never be used in this codebase's component tests."
    - "Selectability/interactivity assertions replaced `getAttribute('draggable')==='false'` with two distinct DOM signals depending on which shared card component renders: `data-interactive` (set by `DraftCardBody`, used for all bench/pack/draft-slot cards) reflects post-unavailable/redCarded/disabled interactivity; `role !== 'button'` (LineupStatCard's non-interactive branch omits `role`/`tabIndex`/`onClick` entirely, mirroring `PieceOverlay.tsx`'s click-gating idiom) is used for on-pitch mid-match/pregame cards, which never carry `data-interactive` at all."
    - "Every render helper (`renderDraft`, `renderPregame`, `renderMidmatch`) follows the plan's existing convention: a typed `overrides` object with `??` defaults, so every existing call site stays unaffected by new optional fields."

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "Landed as three task commits matching the plan's own task boundaries (draft-mode conversion, Standard-pregame ROSTER-07 addition, mid-match conversion + new-behavior tests), rather than one combined commit — each intermediate commit is independently green in its own describe blocks with the remaining not-yet-converted blocks red exactly as each task's own acceptance criteria specify (verified by running the targeted test file after each edit, before committing)."
  - "Fixed a pre-existing false assumption carried from the plan's own acceptance-criteria grep patterns (e.g. `grep -c 'statCardEligible'`): those greps check the TEST FILE's source text, which is fine, but my own test assertions initially used bare `container.querySelector('.statCardEligible')` DOM selectors, which fail against this project's non-literal CSS Module class names. Caught via an actual failing test run after Task 1 (not by inspection) and fixed by switching every bare-class DOM query to `[class*=\"...\"]` substring selectors project-wide in this file; regex `.toMatch(/.../)" assertions against `className` strings (the pattern already used throughout the pre-existing file, e.g. `subCounterChipCapped`) were left as-is since they already tolerate hashed suffixes."
  - "Added a `BENCH_TWO_AVAILABLE` fixture (two `status: 'available'` bench entries) alongside the existing `BENCH_MIXED`/`BENCH_ONLY_UNAVAILABLE`/`BENCH_WITH_STATUS` fixtures — the D-07 bench-selection-switch test genuinely requires two selectable bench sources to prove the switch, which no existing fixture provided (all pre-existing bench fixtures have exactly one available entry)."

requirements-completed: [ROSTER-01, ROSTER-02, ROSTER-03, ROSTER-04, ROSTER-05, ROSTER-07, ROSTER-08]

# Metrics
duration: ~110min
completed: 2026-08-30
---

# Phase 47 Plan 04: LineupAssignmentScreen Click-Select Test Rewrite Summary

**Full rewrite of `LineupAssignmentScreen.test.tsx` (1577 lines / ~90 cases) from native HTML5 drag simulation to `fireEvent.click` simulation across all four roster surfaces, plus 20+ new tests proving behaviors the drag model had no equivalent for — deselect-on-second-click, mode-crossing selection-clearing, the D-07/D-08 selection-switch asymmetry, and explicit Standard-pregame swap coverage — landing at 107/107 green with zero remaining drag references.**

## Performance

- **Duration:** ~110 min
- **Tasks:** 3/3 completed
- **Files modified:** 1

## Accomplishments

- Draft-mode describe blocks (Task 1): renamed and converted the drag-to-pick and drag-state-wedge tests to click sequences; added 12 new tests covering pack-card select/deselect/switch, the five draft dispatch shapes (pick→slot, pick→bench, slot→slot, slot→bench, bench→slot), the bench→bench no-op, both GK-rule rejection messages (with the eligible-highlight-stays-visible-during-rejection assertion the plan explicitly calls out), and the `waitingForOpponent` gate
- Standard-mode pregame swap (Task 2): added a new `ROSTER-07: Standard pregame click-to-swap` describe block (6 tests) — this surface previously had zero gesture-level coverage. Covers select/eligible-highlight (GK slot excluded)/complete-via-`onSwap(source,target)`/deselect/GK no-op/`lineupConfirmed` gate
- Mid-match blocks (Task 3, the largest): converted all three describe blocks (`mid-match substitution mode`, `Phase 42 — midmatch positioning mode` incl. the nested `gap item 6` block, `Phase 42 — staged substitution with confirmation`) from drag to click, updating every helper-copy string assertion (`'Select a player, then click another to swap positions.'` / `'Select a bench card, then click an on-pitch card to substitute.'`). Added a new `Phase 47 — click-select gap coverage` describe block with: D-08 (positioning never switches selection) and D-07 (substitution bench-selection switches) as two independently-named dedicated tests; GK-as-target preservation (D-09's target-eligibility half); explicit SENT OFF eligibility assertions both ways (blue+clickable in positioning mode, never eligible/never-staging in substitution mode); and three mode-crossing regression tests (ROSTER-05, RESEARCH.md Pitfall 1) proving a stale selection from one mode is never reusable after a toggle, Cancel, or Confirm
- Rewrote the file's header doc comment to describe the Phase 47 click-to-select model and enumerate the full ROSTER requirement coverage map
- Fixed all bare CSS-class `querySelector`/`querySelectorAll` DOM selectors (introduced in this plan's own Task 1 commit, caught by an actual test run) to `[class*="..."]` substring-attribute selectors — this project's Vitest config does not stabilize CSS Module class names to literal source keys

## Task Commits

1. **Task 1: Convert draft-mode describe blocks to click simulation** — `7edb405e` (test)
2. **Task 2: Add ROSTER-07 Standard pregame click-to-swap coverage (+ selector fix)** — `f64d5d5d` (test)
3. **Task 3: Convert mid-match blocks + close all remaining gaps** — `f7bff8d1` (test)

_Note: no plan-metadata commit — worktree mode excludes STATE.md/ROADMAP.md updates; the orchestrator handles those centrally after merge._

## Files Created/Modified

- `packages/client/src/components/LineupAssignmentScreen.test.tsx` — full drag→click rewrite across all four surfaces; grew from ~90 to 107 test cases; zero case-insensitive `"drag"` occurrences remain (code, comments, or copy strings)

## Decisions Made

See frontmatter `key-decisions` for the three-commit landing rationale, the CSS-Module-selector fix, and the new `BENCH_TWO_AVAILABLE` fixture rationale.

## Deviations from Plan

**1. [Rule 1 - Bug] Bare CSS-class DOM selectors don't match this project's hashed CSS Module class names**
- **Found during:** Task 2 verification run (first full test run after adding `.statCardEligible`/`.statCardSelected` bare-class queries in Task 1's new draft-mode tests)
- **Issue:** `container.querySelector('.statCardEligible')` / `container.querySelectorAll('.statCardEligible')` returned zero matches even when the element visibly carried a class matching that name — this Vitest config does not configure `css.modules.classNameStrategy` to stabilize CSS Module class names to their literal source key, so the runtime class name is a hashed string (e.g. `statCardEligible_x7y8z`), and an exact-match CSS class selector (`.statCardEligible`) never matches a hashed token.
- **Fix:** Replaced every bare-class `querySelector`/`querySelectorAll` call with the `[class*="statCardEligible"]` / `[class*="statCardSelected"]` substring-attribute-selector idiom the pre-existing file already used elsewhere (e.g. `container.querySelector('[class*="formationColumns"]')`). Left every `.toMatch(/statCardSelected/)`-style regex assertion against an already-retrieved `className` string unchanged — those already tolerate a hashed suffix and are the pre-existing file's dominant pattern.
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- **Commit:** `f64d5d5d`

No other deviations — the remaining 20+ new tests and all converted tests match the plan's action text and acceptance criteria as written.

## Issues Encountered

None beyond the CSS-selector issue documented above (caught and fixed within the same task, before that task's commit).

## User Setup Required

None — no external service configuration required.

## Verification Evidence

- `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen` exits 0 with 107/107 tests passing.
- `grep -ci 'drag' packages/client/src/components/LineupAssignmentScreen.test.tsx` returns 0.
- `grep -c 'fireEvent.click'` → 162 (≥60 required); `grep -c 'data-roster-card'` → 98 (≥5 required); `grep -c 'Enter substitution mode'` → 35 (≥2 required).
- Named tests exist for both `D-07:` and `D-08:` (the plan's own grep-checkable requirement).
- A dedicated test asserts the SENT OFF placeholder carries no `statCardEligible` class in substitution mode.
- `grep -c 'Select a player, then click another to swap positions.'` → 7 (≥1 required).
- `pnpm --filter @counter-attack/client test` (full client suite) — 1282/1287 passing; the 5 remaining failures are entirely in `GameBoard.test.tsx` (3 tests) and `CardInjuryBadge.crossSurface.test.tsx` (1 test) plus one more `GameBoard.test.tsx` case, all still using the retired drag simulation against the click-only production component — this plan's own `<verification>` section explicitly names both files as out of scope, rewritten in the parallel plan 47-05. No collateral regressions were introduced by this plan's changes.
- `pnpm --filter @counter-attack/client exec eslint src/components/LineupAssignmentScreen.test.tsx` — clean, zero warnings/errors.
- `pnpm --filter @counter-attack/client exec tsc --noEmit` — zero errors attributable to `LineupAssignmentScreen.test.tsx`; the only typecheck errors present are the 3 pre-existing `CardInjuryBadge.crossSurface.test.tsx` errors (referencing the retired `BenchCarousel` `onCardDragStart`/`onDropToBench` props), explicitly out of scope per this plan.

## Next Phase Readiness

- `LineupAssignmentScreen.test.tsx` is fully click-select and green; this is the phase's primary behavioural gate — every ROSTER requirement except ROSTER-06 (static analysis, covered by `pnpm knip` in plan 06) is now proven here.
- Ready for the parallel plan 47-05 (`CardInjuryBadge.crossSurface.test.tsx` drag→click conversion) to land independently — no file overlap, confirmed by this plan's own worktree isolation.
- Ready for plan 47-06 (knip + full-suite gate) once 47-05 lands; at that point `pnpm --filter @counter-attack/client test` should be fully green across the whole client package.

## Self-Check: PASSED

- FOUND: `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- FOUND commit `7edb405e`
- FOUND commit `f64d5d5d`
- FOUND commit `f7bff8d1`
- FOUND: `.planning/phases/47-select-based-roster-interaction/47-04-SUMMARY.md`

---
*Phase: 47-select-based-roster-interaction*
*Completed: 2026-08-30*
