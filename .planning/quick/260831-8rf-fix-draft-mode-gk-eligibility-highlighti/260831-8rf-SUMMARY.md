---
phase: quick/260831-8rf
plan: 01
subsystem: ui
tags: [react, testing-library, vitest, draft-mode, roster]

# Dependency graph
requires:
  - phase: 47-select-based-roster-interaction
    provides: click-to-select draft-mode pack/slot/bench interaction model, violatesGKRule predicate
provides:
  - GK-rule-gated draft-mode eligibility highlight (isDraftSlotEligible now excludes GK-violating slots)
  - Removal of the unreachable client-side reject-with-message path (rejectForGKRule, showDraftRejection)
  - Six new draft-mode GK eligibility tests (11-16) covering GK-from-slot/pack/bench and non-GK-from-pack/bench/slot
affects: [48-permanent-jersey-numbers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Eligibility highlight predicates must reflect true legal-target status (no highlight-then-reject-on-click UX)"

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "isDraftSlotEligible now consults violatesGKRule directly as a third conjunct, replacing the design where every slot was highlighted and a client-side message rejected the click"
  - "rejectForGKRule and showDraftRejection deleted as unreachable dead code once the highlight itself excludes GK-violating slots; the server-authoritative gameError path (GK_SLOT_REQUIRES_GK / NON_GK_SLOT_REJECTS_GK) remains as the sole backstop message mechanism"
  - "Renumbered the pre-existing 'waitingForOpponent' test from 12 to 17 to keep the describe block's sequential numbering intact after inserting six new tests (11-16) in place of the single deleted test 11"

requirements-completed: [ROSTER-02, ROSTER-08]

# Metrics
duration: ~10min (excluding one-time pnpm install / shared package build needed to bootstrap the worktree)
completed: 2026-08-31
---

# Quick Task 260831-8rf: Fix Draft-Mode GK Eligibility Highlight Summary

**Reversed the Phase 47 highlight-everything-then-reject GK-slot UX: `isDraftSlotEligible` now excludes GK-violating slots directly, so the draft-mode eligible-target highlight always tells the truth about where a selected card can legally go.**

## Performance

- **Duration:** ~10 min of task execution (task 1 commit to task 2 commit); additional one-time setup (`pnpm install` + `pnpm --filter @counter-attack/shared build`) was required because the worktree had no `node_modules`
- **Tasks:** 3 (RED test rewrite, GREEN implementation, full verification gate)
- **Files modified:** 2

## Accomplishments
- `isDraftSlotEligible` in `LineupAssignmentScreen.tsx` now gates the eligible-target highlight on `violatesGKRule(slotIndex, selection.cardId)`, matching the four scenarios (GK-from-slot, GK-from-pack, GK-from-bench, non-GK-from-anywhere) specified in the plan's `must_haves.truths`
- Deleted the now-unreachable `rejectForGKRule` and `showDraftRejection` helpers and their sole call site in `handleDraftSlotClick`; clicking a GK-violating empty slot is a silent no-op (D-04) since the slot no longer receives `onClick`/`role="button"` at all, and a GK-violating filled slot's `onClick` short-circuits on the existing `isDraftSlotEligible` guard
- Rewrote the draft-mode test block: corrected test 2's eligible count (11 → 10, since slot 0 now drops out for a non-GK selection), replaced the old reversed-assertion test 11 with six new tests (11-16) proving the four eligibility scenarios plus the silent-no-op click, and renumbered the trailing `waitingForOpponent` test from 12 to 17

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite draft-mode GK eligibility tests (RED)** - `cbaa78e3` (test)
2. **Task 2: Gate isDraftSlotEligible on violatesGKRule and delete unreachable reject path (GREEN)** - `02810e69` (fix)
3. **Task 3: Full verification gate** - no code changes required; all five gate commands passed on the first run, so there is no separate commit for this task

## Files Created/Modified
- `packages/client/src/components/LineupAssignmentScreen.tsx` - `isDraftSlotEligible` gated on `violatesGKRule`; `rejectForGKRule`/`showDraftRejection` removed; stale doc comment on `violatesGKRule` (referencing the deleted function) corrected
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` - test 2 count corrected (11→10); old test 11 replaced with tests 11-16; trailing test renumbered 12→17; top-of-file doc comment updated to describe the highlight-gated GK rule

## Decisions Made
- Followed the plan's investigation findings verbatim: kept `rejectionMessage` state, the `gameError` useEffect, and all three `swapRejection` JSX renders untouched (still reachable via server-authoritative `gameError` codes as defence-in-depth)
- Renumbered the pre-existing test 12 (`waitingForOpponent`) to 17 to preserve sequential test numbering after inserting six new tests in place of the deleted test 11 — not explicitly called out in the plan's action steps, but necessary to avoid two tests both titled "12." in the same describe block; this is a test-title-only change with no behavioral effect (Rule 1, minor internal consistency fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale doc comment on `violatesGKRule` referencing the deleted `rejectForGKRule`**
- **Found during:** Task 2
- **Issue:** `violatesGKRule`'s doc comment said "pure predicate extracted from `rejectForGKRule` below" — after deleting `rejectForGKRule`, this comment referenced a function that no longer exists in the file
- **Fix:** Rewrote the comment to describe `violatesGKRule` on its own terms and note `isDraftSlotEligible` as its sole caller
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.tsx`
- **Verification:** `tsc --noEmit` and `pnpm lint` both exit 0; comment no longer references removed code
- **Committed in:** `02810e69` (part of Task 2 commit)

**2. [Rule 1 - Test correctness] Two new tests (15, 16) initially destructured an unused `container` from `renderDraft()`**
- **Found during:** Task 1 (writing tests)
- **Issue:** Tests 15 and 16 use `screen.getByText(...)` exclusively and never reference `container`, which would trip `noUnusedLocals`/ESLint `no-unused-vars`
- **Fix:** Dropped the destructure, calling `renderDraft()` for its side effect only
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- **Verification:** `tsc --noEmit` exits 0 with no unused-local errors
- **Committed in:** `cbaa78e3` (part of Task 1 commit)

**3. [Rule 1 - Test numbering] Renumbered trailing `waitingForOpponent` test from 12 to 17**
- **Found during:** Task 1
- **Issue:** The existing test titled "12. waitingForOpponent true..." sat immediately after the deleted test 11; inserting six new tests numbered 11-16 in its place would have left two tests both starting with "12." in the same describe block
- **Fix:** Renumbered the trailing test's title to "17."
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- **Verification:** Full test suite passes; test titles are now sequential 1-17 in this describe block
- **Committed in:** `cbaa78e3` (part of Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 1 test-numbering consistency fix)
**Impact on plan:** All three are minor correctness/consistency fixes discovered while implementing the plan's own instructions faithfully. No scope creep — no file outside the plan's declared `files_modified` was touched.

## Issues Encountered
- The worktree had no `node_modules` and no built `packages/shared/dist` output, causing the initial targeted test run to fail with `vitest not recognized` and then `Failed to resolve entry for package "@counter-attack/shared"`. Resolved by running `pnpm install` (one-time, ~4.5 min) and `pnpm --filter @counter-attack/shared build` before the RED test run. This is worktree bootstrap overhead, not a plan defect.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- No blockers. The draft-mode eligibility highlight now matches the mid-match positioning/substitution and Standard pregame swap surfaces' honesty-in-highlighting convention.
- Phase 48 (Permanent Jersey Numbers) depends on `applyRosterReposition` from Phase 47, which this quick task did not touch — no impact on Phase 48 readiness.

---
*Phase: quick/260831-8rf*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: packages/client/src/components/LineupAssignmentScreen.tsx
- FOUND: packages/client/src/components/LineupAssignmentScreen.test.tsx
- FOUND: .planning/quick/260831-8rf-fix-draft-mode-gk-eligibility-highlighti/260831-8rf-SUMMARY.md
- FOUND commit: cbaa78e3
- FOUND commit: 02810e69
- FOUND commit: 0ed8edca
