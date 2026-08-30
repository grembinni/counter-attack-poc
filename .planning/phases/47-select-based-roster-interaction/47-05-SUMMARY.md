---
phase: 47-select-based-roster-interaction
plan: 05
subsystem: ui-tests
tags: [react, click-select, testing, roster, vitest]

# Dependency graph
requires:
  - phase: 47-03
    provides: "LineupAssignmentScreen.tsx click-select prop contract (data-roster-card, isSelected/isEligibleTarget/onClick), consumed by both test files converted here"
  - phase: 47-02
    provides: "BenchCarousel click-select contract (onCardClick/onBenchAreaClick/selectedCardId/benchAreaEligible), consumed by CardInjuryBadge.crossSurface.test.tsx"
provides:
  - "GameBoard.test.tsx SUB-08/SUB-09 roster-reposition/action-pending-lockout coverage converted to click simulation against data-roster-card, proving the click path still reaches the real Zustand store emit"
  - "CardInjuryBadge.crossSurface.test.tsx converted to the click-select BenchCarousel prop contract (onCardClick, no onCardDragStart/onDropToBench), preserving the four-surface glyph-contract assertions"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test-side click simulation idiom for a click-completion pair: fireEvent.click(source) then fireEvent.click(target) on elements queried via .closest('[data-roster-card]'), replacing the retired fireEvent.dragStart/fireEvent.drop pair"
    - "Non-interactivity assertion for a locked card under actionPending: assert absence of role=\"button\" and tabIndex (not a draggable=\"false\" check), plus a document-wide absence of any element matching /statCardSelected/ after a no-op click — proves the click itself is blocked, not merely the emit"

key-files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.test.tsx
    - packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx

key-decisions:
  - "Fixed two additional pre-existing red assertions in GameBoard.test.tsx (stale 'Drag a player onto another to swap positions.' copy at two call sites) beyond the plan's named Task 1 scope (test 3/test 4 only). These are the same roster/substitution describe block's help-text assertions, broken by 47-03's click-select port of LineupAssignmentScreen's substitution helper copy (now 'Select a player, then click another to swap positions.'). The plan's own acceptance criteria (`grep -ci 'drag' … outputs 0`) and verification (`GameBoard` test file exits 0) are not satisfiable without this fix, and it stays within the plan's 'roster/substitution' scope boundary ('Do not touch any non-roster GameBoard test' — these are roster tests). Treated as Rule 1 (auto-fix bug), not a deviation requiring escalation."

requirements-completed: [ROSTER-01, ROSTER-04, ROSTER-06]

# Metrics
duration: ~30min
completed: 2026-08-30
---

# Phase 47 Plan 05: Collateral Test Conversion (GameBoard + CardInjuryBadge) Summary

**Converted the two collateral test files still exercising the retired native HTML5 drag-and-drop API — `GameBoard.test.tsx`'s SUB-08/SUB-09 roster-reposition/lockout tests and `CardInjuryBadge.crossSurface.test.tsx`'s four-surface glyph-contract and bench-badge-regression tests — to click simulation against the click-select contract landed in 47-02/47-03, with zero case-insensitive `drag` occurrences remaining in either file.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments

- `GameBoard.test.tsx` test 3 (SUB-08): renamed to "clicking one on-field card then another emits game:roster-reposition with {pieceIdA, pieceIdB}"; source/target now queried via `.closest('[data-roster-card]')` and driven by `fireEvent.click(source)` → `fireEvent.click(target)`; the `emitMock` payload assertion (`{ pieceIdA: 'home-1', pieceIdB: 'home-2' }`) kept byte-identical per T-47-16
- `GameBoard.test.tsx` test 4 (SUB-09): renamed to reference non-interactive cards/clicks; the old `draggable="false"` check replaced with two independent assertions (no `role="button"`, no `tabIndex`) plus a new third assertion — after clicking the source, no element in the document matches `/statCardSelected/` — proving `actionPending` blocks selection itself, not merely the emit (T-47-17)
- `CardInjuryBadge.crossSurface.test.tsx`: every `BenchCarousel` render call site (`onCardDragStart={noop}` → `onCardClick={noop}`; `onDropToBench={noop}` deleted, now-optional prop) updated at the two bench-glyph test sites (single-surface bench test and the ICON-02 four-surface parity test); no `selectedCardId`/`benchAreaEligible` added, since these tests assert glyph rendering, not selection state
- `CardInjuryBadge.crossSurface.test.tsx`'s "bench badges are unaffected by an open substitution-confirm popup" test converted from drag simulation to click simulation (`.closest('[draggable]')` → `.closest('[data-roster-card]')`, `dragStart`+`drop` → two `fireEvent.click` calls); the staged-substitution `getByRole('dialog')` assertion and `assertBenchBadges()` call preserved unchanged
- All glyph-contract vocabulary (`glyphContract`, `CLEAN`, `BOOKED_AND_INJURED`, the four-surface ICON-02 parity loop, `bench-red-card-badge`/`cardUnavailable` gap-item-1 test, the `actionPending` regression test) preserved verbatim — `CardInjuryBadge` itself untouched
- Two pre-existing, out-of-scope-per-Task-1-text but in-scope-per-acceptance-criteria red assertions in `GameBoard.test.tsx` fixed (stale drag-era help-text string) — see Decisions Made

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert GameBoard.test.tsx's SUB-08/SUB-09 roster tests to click simulation** — `e5906c77` (test)
2. **Task 2: Update CardInjuryBadge.crossSurface.test.tsx to the click-select carousel props** — `26ad54da` (test)

_Note: no plan-metadata commit — worktree mode excludes STATE.md/ROADMAP.md updates; the orchestrator handles those centrally after merge._

## Files Created/Modified

- `packages/client/src/components/GameBoard.test.tsx` — SUB-08/SUB-09 roster tests converted to click simulation against `[data-roster-card]`; two stale drag-era help-text assertions fixed to match 47-03's click-select copy
- `packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx` — every `BenchCarousel` call site updated to `onCardClick`/no `onDropToBench`; the substitution-confirm-popup regression test converted from drag to click simulation

## Decisions Made

See frontmatter `key-decisions` for the rationale on fixing the two additional stale-copy assertions beyond the plan's literally-named Task 1 scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed two stale "Drag a player onto another to swap positions." assertions in GameBoard.test.tsx**
- **Found during:** Task 1 verification (`pnpm --filter @counter-attack/client test -- GameBoard`)
- **Issue:** Two tests in the same "Phase 42 — roster panel wiring and chrome" describe block (`clicking during a stoppage renders the substitution modal in its actionable (draggable) presentation` and `stays open across a phase transition that leaves the stoppage set...`) asserted the literal string `'Drag a player onto another to swap positions.'`. This copy was already changed to `'Select a player, then click another to swap positions.'` in `LineupAssignmentScreen.tsx` by 47-03's click-select port, leaving these two assertions red. The plan's own Task 1 action text names only tests 3/4 by number, but its acceptance criteria (`grep -ci 'drag' … outputs 0`) and verification (the whole `GameBoard` test file must exit 0) are unsatisfiable without also fixing these.
- **Fix:** Updated both assertions to the current copy string; renamed the first test's description from "(draggable)" to "(click-select)" for consistency.
- **Files modified:** `packages/client/src/components/GameBoard.test.tsx`
- **Commit:** `e5906c77`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug fix, required for the plan's own explicit acceptance criteria/verification to pass)
**Impact on plan:** No scope creep — both fixed assertions are in the same "roster/substitution" describe block Task 1 already targets, and the plan's own text explicitly permits touching "any roster GameBoard test" (only excludes "non-roster" tests).

## Issues Encountered

None beyond the item logged above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `pnpm --filter @counter-attack/client test -- GameBoard` exits 0 (96 tests, 2 files).
- `pnpm --filter @counter-attack/client test -- CardInjuryBadge` exits 0 (45 tests, 3 files, covers both `CardInjuryBadge.crossSurface.test.tsx` and `CardInjuryBadge.audit.test.ts`).
- Combined run (`vitest run "GameBoard" "CardInjuryBadge"`): 141/141 tests pass, 5 files.
- `LineupAssignmentScreen.test.tsx` intentionally left untouched per this plan's own `<verification>` — it is owned by the parallel plan 47-04 and may still be red pending that plan's completion; not a gate here.
- No production symbols created or modified by this plan — test-file conversion only.

## Self-Check: PASSED

- FOUND: `packages/client/src/components/GameBoard.test.tsx`
- FOUND: `packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx`
- FOUND: `.planning/phases/47-select-based-roster-interaction/47-05-SUMMARY.md`
- FOUND commit `e5906c77` (Task 1)
- FOUND commit `26ad54da` (Task 2)
- FOUND commit `86d4eca0` (SUMMARY.md)

---
*Phase: 47-select-based-roster-interaction*
*Completed: 2026-08-30*
