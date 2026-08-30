---
phase: 47-select-based-roster-interaction
plan: 03
subsystem: ui
tags: [react, click-select, roster, draft-mode, mid-match, accessibility]

# Dependency graph
requires:
  - phase: 47-01
    provides: "LineupAssignmentScreen.module.css .statCardSelected/.statCardEligible classes, DraftCardBody/DraftPackCarousel click-select contract"
  - phase: 47-02
    provides: "BenchCarousel click-select contract (onCardClick/onBenchAreaClick/selectedCardId/benchAreaEligible)"
provides:
  - "LineupAssignmentScreen.tsx fully ported to click-to-select across all four surfaces (mid-match positioning, mid-match substitution, Standard pregame swap, draft pack/slot/bench) — zero native HTML5 drag-and-drop code remains"
  - "Four structurally separate eligibility computations (isRepositionEligible, isSubstituteEligible, isPregameSwapEligible, isDraftSlotEligible/isDraftBenchAreaEligible) — none takes a mode parameter"
  - "LineupStatCard's click-select prop contract (isSelected/isEligibleTarget/onClick/allowGKSelect/isSelectable) consumed by all three call sites (mid-match, pregame, draft)"
affects: ["47-04 (LineupAssignmentScreen.test.tsx rewrite — must exercise the new click handlers/props)", "47-05 (CardInjuryBadge.crossSurface.test.tsx — one pre-existing drag-simulation test to convert to click)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Positioning-mode selection uses strict pitch-style toggle (no switch-selection branch, D-08); substitution-mode bench selection allows switching without an explicit deselect step (D-07) — same 'three-branch selectPiece shape' pattern, two independently-reasoned implementations per Pitfall 5 HARD CONSTRAINT"
    - "GK-rule validation split into a pure predicate (violatesGKRule, safe for render-time eligibility) and a message-emitting wrapper (rejectForGKRule, called only from click-completion handlers) — the eligibility function must never have a message side effect"
    - "SENT OFF placeholder (a bespoke non-LineupStatCard div) computes its own eligibility inline and is positioning-mode-only, per D-05 — must be explicitly ported alongside LineupStatCard, not assumed covered by it"

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.tsx

key-decisions:
  - "Landed all three tasks (LineupStatCard + mid-match, pregame + draft, prose/cleanup sweep) as a single commit rather than three per-task commits. The plan's own objective text states the port 'must land atomically — a partially ported file does not compile': after Task 1 alone, the pregame/draft render branches still call LineupStatCard with the pre-Task-1 drag props (isDragSource/isDropTarget/onDragStart/etc.), which no longer exist on StatCardProps, so an intermediate Task-1-only commit would not type-check. Task 3's file-wide prose sweep (removing every 'drag' word from comments) also touches lines introduced by Task 1 and Task 2, making after-the-fact hunk-level splitting impractical. One commit accurately reflects the plan's own atomicity constraint."
  - "Kept violatesGKRule/rejectForGKRule split exactly as specified: violatesGKRule is a pure boolean predicate consulted by isDraftSlotEligible only implicitly (it is deliberately NOT called from isDraftSlotEligible — see next decision); rejectForGKRule wraps it with the message side effect and is called only from handleDraftSlotClick's completion branch."
  - "isDraftSlotEligible deliberately does NOT consult violatesGKRule when computing the blue eligible-target set — this reproduces the pre-Phase-47 handleDraftSlotDragOver's behavior of highlighting every other slot as a target regardless of the GK rule, so that clicking a GK-violating slot still reaches rejectForGKRule and surfaces its rejection message. Excluding GK-violating slots from the eligible set would make that message unreachable (explicitly called out in the plan's action text)."

requirements-completed: [ROSTER-01, ROSTER-02, ROSTER-03, ROSTER-04, ROSTER-05, ROSTER-06, ROSTER-07, ROSTER-08]

# Metrics
duration: ~70min
completed: 2026-08-30
---

# Phase 47 Plan 03: LineupAssignmentScreen Click-to-Select Port Summary

**Full production rewrite of `LineupAssignmentScreen.tsx` from native HTML5 drag-and-drop to the app's click-to-select model across all four roster surfaces — mid-match positioning/substitution, Standard pregame swap, and draft pack/slot/bench — with four structurally separate eligibility computations and zero remaining drag code.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3/3 completed
- **Files modified:** 1

## Accomplishments

- `LineupStatCard`/`StatCardProps`: `isDragSource`/`isDropTarget`/`onDragStart`/`onDragOver`/`onDragLeave`/`onDrop`/`onDragEnd`/`isSubTarget`/`midmatchDraggable`/`allowGKDrag` replaced with `isSelected`/`isEligibleTarget`/`onClick`/`isSelectable`/`allowGKSelect`; the card wrapper gains `data-roster-card` unconditionally and `role="button"`/`tabIndex={0}`/Enter+Space `onKeyDown` only when clickable, mirroring `PieceOverlay.tsx`'s click-gating idiom
- Mid-match positioning mode: `repositionSelectedPieceId` + `isRepositionSelectable`/`isRepositionEligible` + `handleRepositionCardClick` — strict select/deselect/complete with no switch-selection branch (D-08); the GK card is never selectable (D-09) but remains a valid target (server's `GK_SLOT_LOCKED` message preserved, RESEARCH.md's explicit warning honored)
- Mid-match substitution mode: `substituteSelectedPlayerId` + `isSubstituteEligible` + `handleSubstituteBenchClick` (bench-first, switches selection without an explicit deselect, D-07) + `handleSubstitutePitchClick` (D-06 bench-first-only, stages `pendingSub` via the unchanged confirm-popup flow)
- SENT OFF placeholder ported as its own inline eligibility computation (D-05, RESEARCH.md Pitfall 3) — blue/clickable in positioning mode only, never in substitution mode (a deliberate behavior change from the old unconditional drag-over target)
- Both new mid-match selections are cleared in all four transition points: Substitute-mode toggle, Cancel toggle, substitution-popup Cancel, substitution-popup Confirm (T-47-10 anti-pattern guard)
- Standard pregame swap: `pregameSelectedSlotIndex` + `isPregameSwapEligible` + `handlePregameCardClick` (GK slot index 0 never selectable/targetable)
- Draft mode: `DraftSelection` (renamed from `DragState`, byte-identical union) + `isDraftSlotEligible`/`isDraftBenchAreaEligible` + `handleDraftPackCardClick` (bench-first-pattern switch-selection, D-11) + `handleDraftSlotClick` (source-select/deselect/complete, dispatches `onDraftPick`/`onDraftRearrange` per origin) + `handleDraftBenchCardClick` + `handleDraftBenchAreaClick`; `violatesGKRule` extracted as a pure predicate, `rejectForGKRule` keeps the message side effect and is called only at completion time
- `BenchCarousel`/`DraftPackCarousel` call sites (mid-match, draft, pregame-inert) updated to the click-select contracts established in 47-01/47-02
- Full prose/comment sweep: zero case-insensitive `"drag"` occurrences remain anywhere in the file (code or comments) — module header, all prop docs (`onSwap`/`onDraftPick`/`onReposition`/`actionPending`/`readOnly`), and every internal rationale comment rewritten to describe the click-select mechanism

## Task Commits

All three tasks landed in a single commit (see Decisions Made — the plan's own text requires atomic landing since an intermediate Task-1-only state does not type-check, and Task 3's file-wide prose sweep touches lines from both prior tasks):

1. **Tasks 1–3: Port LineupAssignmentScreen to click-to-select interaction** — `435d58e2` (feat)

_Note: no plan-metadata commit — worktree mode excludes STATE.md/ROADMAP.md updates; the orchestrator handles those centrally after merge._

## Files Created/Modified

- `packages/client/src/components/LineupAssignmentScreen.tsx` — full click-to-select port across all four surfaces; `DragState`/`MidmatchDragState` types deleted, `DraftSelection` added; five drag-state `useState` pairs replaced with four selection scalars/unions; ~15 drag handler functions deleted, replaced by 4 eligibility functions + 6 click handlers; `LineupStatCard`'s drag prop contract fully replaced; zero drag code or drag prose remains

## Decisions Made

See frontmatter `key-decisions` for the single-commit rationale and the `violatesGKRule`/`isDraftSlotEligible` GK-rule split rationale.

## Deviations from Plan

None — plan executed exactly as written. The single-commit landing (rather than three per-task commits) follows the plan's own explicit atomicity constraint rather than deviating from it; documented above rather than under Deviations since it is process (commit granularity), not implementation behavior.

## Issues Encountered

- The plan's own Task 2 `<acceptance_criteria>` grep pattern `handleDraftSlot` (intended to catch the retired `handleDraftSlotDragStart`/`DragOver`/`DragLeave`/`Drop`/`DragEnd` handlers) has an inherent false-positive collision with the plan's own newly-specified function name `handleDraftSlotClick` (Task 2's action text explicitly requires adding `handleDraftSlotClick(slotIndex, cardIdAtSlot)`). A literal `grep -c 'handleDraftSlot' … outputs 0` cannot be satisfied without renaming the plan-mandated function, which would be an unrequested deviation. Verified by direct inspection that zero *old* handler names (`handleDraftSlotDragStart`/`DragOver`/`DragLeave`/`Drop`/`DragEnd`) remain — only the new, intentionally-named `handleDraftSlotClick` matches the substring pattern. All other acceptance-criteria greps in Tasks 1–3 pass exactly as specified, including the file-wide `grep -ci 'drag\|dataTransfer\|effectAllowed'` returning `0`.
- Fresh worktree had no `node_modules`/`packages/shared/dist` (same as 47-01/47-02) — ran `pnpm install` at the workspace root and `pnpm --filter @counter-attack/shared build` before any verification command could run. No source changes; gitignored output only.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `LineupAssignmentScreen.tsx` is fully click-select; `pnpm --filter @counter-attack/client build` (vite) exits 0; `pnpm knip` and `pnpm stylelint` are both clean.
- `pnpm --filter @counter-attack/client typecheck` (`tsc --noEmit`) has zero errors in `LineupAssignmentScreen.tsx` itself. The only remaining typecheck errors are 3 pre-existing errors in `CardInjuryBadge.crossSurface.test.tsx` (references the retired `BenchCarousel` `onCardDragStart`/`onDropToBench` props, inherited from 47-01/47-02) — this is explicitly out of scope per this plan's `<verification>` section ("Do not edit any `.test.tsx` file in this plan") and per this plan's own instruction not to gate on `typecheck`.
- `LineupAssignmentScreen.test.tsx`, `GameBoard.test.tsx`, and `CardInjuryBadge.crossSurface.test.tsx` are EXPECTED TO FAIL/not-yet-updated after this plan, as declared in the plan's own `<verification>` section — these are rewritten in plans 47-04 and 47-05.
- Ready for 47-04 (test rewrite for `LineupAssignmentScreen.test.tsx`, exercising the new click handlers/eligibility functions) and 47-05 (`CardInjuryBadge.crossSurface.test.tsx` drag-simulation-to-click conversion, first logged as deferred in 47-02's `deferred-items.md`).

## Self-Check: PASSED

- FOUND: `packages/client/src/components/LineupAssignmentScreen.tsx`
- FOUND commit `435d58e2`
- FOUND: `.planning/phases/47-select-based-roster-interaction/47-03-SUMMARY.md`

---
*Phase: 47-select-based-roster-interaction*
*Completed: 2026-08-30*
