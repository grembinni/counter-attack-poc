---
phase: 40-substitutions
plan: 03
subsystem: ui
tags: [react, drag-and-drop, css-modules, vitest, substitutions]

# Dependency graph
requires:
  - phase: 40-substitutions (plan 40-01)
    provides: BenchEntry/BenchEntryStatus/playerId shared types, SUBSTITUTION ActionEvent, STOPPAGE_PHASES
provides:
  - "LineupAssignmentScreen mode='pregame'|'midmatch' additive prop branch (mode/midmatchPieces/bench/subsUsed/maxOnPitch/onSubstitute)"
  - 'BenchCarousel unavailablePlayerIds/redCardedPlayerIds props -> OUT/RED CARD badges, dimmed + non-draggable'
  - 'DraftCardBody unavailable/redCarded props (redCarded takes precedence) shared by BenchCarousel'
  - 'LineupStatCard card/injury chip rendering (cardColor/injuryCount props) reused on sub-roster rows'
  - 'New CSS classes: .outBadge, .redCardBadge, .cardUnavailable, .cardChip, .injuryChip, .subCounterChip(Capped), .slotCapNote, .statCardSubTarget, .statCardSubBlocked'
affects: [40-04, 40-05, 40-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Structurally separate mid-match branch inside LineupStatCard (never merged with the pregame GK-lock boolean) — RESEARCH.md Pitfall 6'
    - 'Component-owned drag-state (midmatchDragPlayerId/midmatchDropTargetPieceId) resolves every mid-match drop — dataTransfer never read at drop time, mirroring the existing draft-mode dragState pattern'
    - 'RosterCardPlayer widened type (Omit<PoolPlayer,...> & Partial<Pick<PoolPlayer,...>>) lets a live PlayerPiece render through the same LineupStatCard used by pregame/draft PoolPlayer cards'

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/BenchCarousel.tsx
    - packages/client/src/components/DraftPackCarousel.tsx
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "mode defaults to 'pregame' (undefined) so App.tsx's existing call site needs zero changes"
  - 'On-pitch cards are draggable={false} unconditionally in mid-match mode — bench->pitch is the only substitution gesture; on-pitch<->on-pitch dragging (formation change) is out of scope per CONTEXT.md Deferred Ideas'
  - "OUT and RED CARD share one combined drag-suppression guard in BenchCarousel (both mean 'not a drag source'), but render mutually exclusive badges with redCarded taking visual precedence"
  - "'Substitute' surfaces as static instructional copy ('Drag a bench card onto an on-pitch card to Substitute.') rather than a clickable CTA button — each substitution completes atomically via the drag-drop gesture itself (D-04: 1-for-1 swaps), matching the UI-SPEC's 'no destructive confirmation, no success toast' convention"
  - "Empty-bench copy is a standalone paragraph rendered alongside BenchCarousel (not inside it), driven by benchList.length === 0 || no 'available' entry — this lets a bench containing ONLY subbedOut/redCarded entries show both the empty-state copy AND the still-visible badged cards (D-12/D-13)"

requirements-completed: [SUB-02, SUB-03, SUB-06, SUB-07]

# Metrics
duration: ~20min
completed: 2026-08-16
---

# Phase 40 Plan 03: Mid-Match Substitution Roster Screen Summary

**LineupAssignmentScreen gains an additive `mode='midmatch'` branch rendering the live XI (grouped GK/DEF/MID/FWD, ST->FWD), sub-counter chip, permanent-slot-cap note, and a bench with distinct OUT/RED CARD badge states wired to bench->pitch drag-and-drop substitution.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-16T13:03:00Z (approx.)
- **Completed:** 2026-08-16T13:10:15Z
- **Tasks:** 3
- **Files modified:** 4 (+ 1 test file)

## Accomplishments

- `LineupAssignmentScreen` now operates on live `GameState` mid-match via a new `mode`/`midmatchPieces`/`bench`/`subsUsed`/`maxOnPitch`/`onSubstitute` prop set, defaulting to `'pregame'` so every existing pre-match call site (`App.tsx`) is untouched
- Bench cards render three mutually-exclusive visual states — available (draggable), `OUT` (subbed-out, dimmed, non-draggable), and `RED CARD` (D-13, dimmed, non-draggable, visually distinct from OUT) — reusing `DraftCardBody`/`BenchCarousel`'s existing drag-source chrome
- On-pitch roster rows show the same card/injury chip language as the top-left `PlayerStatsPanel` (`cardColor`/`injuryCount` derivation duplicated per 40-PATTERNS.md, not refactored into a shared helper)
- A red-carded on-pitch card can never be a substitution target — the mid-match drop handler checks `piece.redCarded` before invoking `onSubstitute`
- D-12 empty-bench state (both "never had a bench" and "used up the bench") renders calmly with no error styling
- Full client test suite (978 tests) and full monorepo suite (shared 839 / server 1340+1 skipped+1 todo / client 978 = 3,157 tests) pass; typecheck and eslint clean on all touched files

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — extend LineupAssignmentScreen.test.tsx with the mid-match spec (RED)** - `fcaf791` (test)
2. **Task 2: Bench cards support the unavailable (OUT) and red-carded states** - `e349430` (feat)
3. **Task 3: Add the mid-match mode branch to LineupAssignmentScreen** - `c591d2b` (feat)

_TDD gate sequence confirmed: `test(40-03)` RED commit exists, followed by two `feat(40-03)` GREEN commits — the mid-match describe block's 19 tests went from all-red (missing prop/element) to all-green across Tasks 2-3 with zero existing-test regressions._

## Files Created/Modified

- `packages/client/src/components/LineupAssignmentScreen.tsx` - `mode` prop branch, `RosterCardPlayer` widened type, `renderMidmatchColumn`, mid-match return block, extended `rejectionMessage` effect with 6 new substitution error codes
- `packages/client/src/components/LineupAssignmentScreen.module.css` - `.outBadge`, `.redCardBadge`, `.cardUnavailable`, `.cardChip`, `.injuryChip`, `.subCounterChip`/`.subCounterChipCapped`, `.slotCapNote`, `.statCardSubTarget`, `.statCardSubBlocked` — all built from existing `tokens.css` values, zero new colour literals
- `packages/client/src/components/BenchCarousel.tsx` - `unavailablePlayerIds`/`redCardedPlayerIds` props, drag-start suppression for OUT/RED CARD cards
- `packages/client/src/components/DraftPackCarousel.tsx` - `DraftCardBody` gains `unavailable`/`redCarded` props (redCarded takes precedence), forces `draggable={false}` and renders the appropriate badge
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` - new `describe('mid-match substitution mode (SUB-02/03/06/07, D-12/D-13)')` block (19 tests)

## Decisions Made

- Every `it(...)` title in the new describe block is tagged with its requirement/decision id (SUB-02/03/06/07, D-12/D-13) per the plan's acceptance criteria
- `slotMeta` widened to optional on `StatCardProps` since mid-match cards have no `FormationSlot` — jersey number falls back to `player.number` (the live `PlayerPiece`'s own number) in mid-match mode only
- See `key-decisions` in frontmatter for the four substantive implementation calls (mode default, unconditional non-draggable on-pitch cards, combined bench drag-suppression guard, static "Substitute" copy over a clickable CTA, standalone empty-bench paragraph)

## Deviations from Plan

None — plan executed exactly as written. `App.tsx` was not modified (`git diff --name-only` for Task 3 confirms no App.tsx changes), matching the acceptance criteria.

## Issues Encountered

- The worktree's `node_modules` and `packages/shared/dist` were both missing/unbuilt at session start (fresh worktree, `@counter-attack/shared` package export unresolved). Resolved with `pnpm install` (full workspace, resolves from the shared pnpm store — no Windows junction workaround used) followed by `pnpm --filter @counter-attack/shared build`. Not a plan deviation — standard worktree bootstrap.
- Initial `LineupStatCard` `cardClass` typing regression: changed `let cardClass: string | undefined` to `string` while adding the mid-match branch, which broke `tsc --noEmit` (CSS Modules types resolve to `string | undefined` under this project's TS config). Reverted to the original `string | undefined` type — self-caught during the Task 3 typecheck verification step before commit, not left in the codebase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `LineupAssignmentScreen`'s mid-match branch is ready to be mounted by plan 40-06 inside the substitution modal (D-01/D-10's "modal vs in-place" discretion item, resolved by UI-SPEC.md as a modal overlay) behind the persistent SUB button
- `onSubstitute` is currently a bare callback prop with no wiring to a socket emit — plan 40-05's `GAME_SUBSTITUTION` handler and plan 40-06's `emitSubstitution` store action are the next integration points
- No blockers. The component's `bench`/`midmatchPieces` props are typed to accept exactly the shapes plan 40-01 already added to `GameState` (`BenchEntry[]`, `PlayerPiece[]`), so no further shared-type changes are anticipated for the mount-in-modal work

---

_Phase: 40-substitutions_
_Completed: 2026-08-16_

## Self-Check: PASSED

All 6 key files (5 modified components/tests + SUMMARY.md itself) confirmed present on disk. All 4 task/docs commit hashes (`fcaf791`, `e349430`, `c591d2b`, `5c53a21`) confirmed present in git log.
