---
phase: 29-draft-ui-pick-and-swap-flow
plan: 10
subsystem: api
tags: [draft-mode, socket.io, state-machine, gap-closure]

# Dependency graph
requires:
  - phase: 29-draft-ui-pick-and-swap-flow (plan 07/09)
    provides: post-draft lineup/bench rearrangement (applyRearrange, DRAFT_REARRANGE handler)
provides:
  - 'applyRearrange true two-way swap when both from and to are lineup slots (D-24)'
  - 'Unit + integration test coverage locking the swap and D-09 GK-slot enforcement on both ends'
  - 'D-07 narrowed, D-24 recorded across 29-CONTEXT.md/29-RESEARCH.md/29-UI-SPEC.md'
affects: [29-draft-ui-pick-and-swap-flow re-verification, phase-29-completion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'applyRearrange branches the displaced-occupant assignment on from.type: slot-origin returns the card to the just-vacated source slot (true swap), bench-origin appends to benchIds (D-07 bench-displacement)'

key-files:
  created: []
  modified:
    - packages/server/src/draftSession.ts
    - packages/server/src/draftSession.test.ts
    - packages/server/src/__tests__/draftSession.integration.test.ts
    - .planning/phases/29-draft-ui-pick-and-swap-flow/29-CONTEXT.md
    - .planning/phases/29-draft-ui-pick-and-swap-flow/29-RESEARCH.md
    - .planning/phases/29-draft-ui-pick-and-swap-flow/29-UI-SPEC.md

key-decisions:
  - "D-24: slot<->slot rearrangement is a true two-way swap — the displaced destination occupant returns to the dragged card's just-vacated source slot, never the bench."
  - 'D-07 narrowed: bench-displacement now applies only to moves whose source is the bench or the draft pack (applyPick occupied-slot branch, bench->slot rearrangement) — not lineup-slot-origin moves.'

patterns-established:
  - "Displacement-branch fix pattern: distinguish 'true swap' (both endpoints are the same kind of container) from 'bench displacement' (source has no return slot) by branching on from.type before writing the displaced value."

requirements-completed: [DRAFT-09, DRAFT-10]

# Metrics
duration: 8min
completed: 2026-07-21
---

# Phase 29 Plan 10: Lineup Slot-to-Slot Swap Semantics Summary

**Fixed `applyRearrange` to perform a true two-way swap for lineup-slot-to-lineup-slot drags instead of bumping the displaced occupant to the bench, closing 29-VERIFICATION.md Gap 1.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 3 completed
- **Files modified:** 6

## Accomplishments

- `applyRearrange` in `draftSession.ts` now branches the destination-slot displacement on the ORIGIN of the move: when `from.type === 'slot'`, the displaced occupant is written back into `lineupSlots[from.slotIndex]` (the slot the dragged card just vacated) — a genuine two-way swap. When `from.type === 'bench'`, the prior D-07 bench-displacement behavior is preserved unchanged (no source slot exists to return the occupant to).
- `applyPick`'s occupied-slot displacement-to-bench branch (used when drafting a fresh pack card) is completely untouched — verified by grep for `newBenchIds = [...current.benchIds, occupant]`.
- Added two new unit tests in `draftSession.test.ts` (`applyRearrange (D-08/D-10)` describe block): a true slot↔slot swap asserting both cards trade places and the bench is unaffected, and a slot→slot-onto-empty-destination case.
- Added a new integration test (`Phase 29 Plan 10 — slot<->slot swap GK-slot enforcement`) that drives a full draft to completion with filled lineups, then proves the existing destination-only GK-slot check (`roomHandlers.ts` DRAFT_REARRANGE handler) rejects illegal swaps in BOTH directions (non-GK into GK slot -> `GK_SLOT_REQUIRES_GK`; GK out into an outfield slot -> `NON_GK_SLOT_REJECTS_GK`) with no `DRAFT_STATE_UPDATED` fired, plus a positive control proving a legal outfield<->outfield swap applies and trades the two cards with neither landing on the bench.
- Narrowed `D-07` and added `D-24` in `29-CONTEXT.md`'s `<decisions>` block; cross-referenced the exception in the D-07 mirror sentences in `29-RESEARCH.md` and `29-UI-SPEC.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make applyRearrange perform a true slot↔slot swap** - `0591146` (feat)
2. **Task 2: Lock D-09 GK-slot enforcement on both ends of a slot↔slot swap (integration)** - `f5875ca` (test)
3. **Task 3: Narrow D-07 and record D-24 in the phase decision docs** - `9c80fd0` (docs)

_Note: worktree-mode execution — no separate plan-metadata commit; this SUMMARY.md is committed alongside REQUIREMENTS.md per the worktree convention (STATE.md/ROADMAP.md are updated centrally by the orchestrator after merge)._

## Files Created/Modified

- `packages/server/src/draftSession.ts` - `applyRearrange`'s `to.type === 'slot'` displacement branch now checks `from.type` to decide between a true swap (slot origin) and bench displacement (bench origin)
- `packages/server/src/draftSession.test.ts` - two new unit tests: true swap, slot-to-slot-onto-empty
- `packages/server/src/__tests__/draftSession.integration.test.ts` - new integration test locking D-09 GK-slot enforcement on both ends of a slot↔slot swap plus a legal-swap positive control
- `.planning/phases/29-draft-ui-pick-and-swap-flow/29-CONTEXT.md` - D-07 narrowed to non-slot-origin moves; new D-24 decision recorded
- `.planning/phases/29-draft-ui-pick-and-swap-flow/29-RESEARCH.md` - D-07 mirror sentence cross-referenced to D-24
- `.planning/phases/29-draft-ui-pick-and-swap-flow/29-UI-SPEC.md` - D-07 mirror sentence cross-referenced to D-24

## Decisions Made

- D-24 (new): slot↔slot rearrangement is a true two-way swap — the displaced destination occupant returns to the dragged card's just-vacated source slot, never the bench. Applies to `applyRearrange` only; `applyPick` is unaffected (a freshly drafted pack card has no vacated source slot).
- D-07 narrowed: bench-displacement now applies only when the move's source is the bench or the draft pack, not a lineup slot.

## Deviations from Plan

None - plan executed exactly as written. One environment-setup step was required but is not a plan deviation: the isolated worktree had no `node_modules` and `packages/shared` had no built `dist/`, both prerequisites for running `pnpm --filter @counter-attack/server test`/`typecheck`. Resolved via a plain `pnpm install --frozen-lockfile` (hardlinked from the existing pnpm content-addressable store — no directory junctions to the main repo's `node_modules` were created or touched, per the known Windows-junction-deletion risk) followed by `pnpm --filter @counter-attack/shared build`. Neither step touched any file tracked by this plan or committed to the worktree branch.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `applyRearrange` fix is unit- and integration-tested and the full server suite (608 tests, 33 files) passes, along with `typecheck` and `build`.
- Per the plan's `<success_criteria>`, the orchestrator must still re-run the two-browser walkthrough targeting lineup-slot ↔ lineup-slot drags (29-VERIFICATION.md "Human Verification Required" item 1) and confirm both cards trade places before Phase 29 can be marked complete. This plan does not perform that human walkthrough.

## Self-Check: PASSED

All files created/modified and all task commit hashes verified present on disk / in git log:

- `packages/server/src/draftSession.ts` — FOUND
- `packages/server/src/draftSession.test.ts` — FOUND
- `packages/server/src/__tests__/draftSession.integration.test.ts` — FOUND
- `.planning/phases/29-draft-ui-pick-and-swap-flow/29-CONTEXT.md` — FOUND
- `.planning/phases/29-draft-ui-pick-and-swap-flow/29-10-SUMMARY.md` — FOUND
- `0591146` (Task 1) — FOUND
- `f5875ca` (Task 2) — FOUND
- `9c80fd0` (Task 3) — FOUND
- `6f50f1a` (SUMMARY commit) — FOUND
