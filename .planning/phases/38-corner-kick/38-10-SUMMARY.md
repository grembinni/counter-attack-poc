---
phase: 38-corner-kick
plan: 10
subsystem: api
tags: [undo, corner-kick, gap-closure, gameEngine, vitest]

# Dependency graph
requires:
  - phase: 38-corner-kick (plans 38-01..38-09)
    provides: CORNER_KICK_REPOSITION/CORNER_KICK_FINAL_SETUP phases, applyCornerKickReposition, applyCornerKickFinalMove, the CORNER_KICK_MOVE ActionEvent type, and validUndoPhases already listing both phases
provides:
  - applyUndo moveTypeForPhase resolves CORNER_KICK_FINAL_SETUP to CORNER_KICK_MOVE (was silently falling through to the 'MOVE' default and never matching)
  - lockReset arm for CORNER_KICK_FINAL_SETUP mirroring GOAL_KICK_MOVE's single-piece-lock/scalar-pace shape
  - lockReset arm for CORNER_KICK_REPOSITION refunding the per-piece running-total cornerKickUsedPace and releasing cornerKickStagePlacedIds membership independently of the pace value
  - D-GAP-01 design decision (recorded below)
  - Strengthened GAME_UNDO socket tests that fail if Undo silently no-ops
affects: [38-corner-kick verification/audit, any future phase touching applyUndo's lockReset chain]

tech-stack:
  added: []
  patterns:
    - 'applyUndo lockReset ternary chain: each phase-specific arm mirrors the GOAL_KICK_MOVE/goalKickUsedPace shape (Math.max(0, current - stepDistance), delete-key-at-zero) rather than introducing a new refund idiom'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
    - packages/server/src/__tests__/gameHandlers.cornerKick.test.ts

key-decisions:
  - 'D-GAP-01: an undone-to-zero CORNER_KICK_REPOSITION stage touch IS cleared from cornerKickStagePlacedIds, driven by counting remaining current-stage MOVE events for the piece — NOT by cornerKickUsedPace reaching 0, because cornerKickUsedPace is a running total across all 6 stages and would rarely reach exactly 0 on a later-stage undo. This keeps the 2-distinct-piece stage cap reflecting currently-placed pieces, not historically-ever-placed pieces (CORNER-03 per-stage-touch semantics).'

requirements-completed: [CORNER-03, CORNER-06]

# Metrics
duration: ~20min
completed: 2026-08-08
---

# Phase 38 Plan 10: Corner Kick Undo Gap Closure (CR-01/CR-02/WR-03) Summary

**Fixed two BLOCKER-severity `applyUndo` no-ops for corner-kick Undo (CORNER_KICK_FINAL_SETUP full no-op; CORNER_KICK_REPOSITION silent pace-budget leak) and strengthened the socket tests that had been masking both.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-08
- **Tasks:** 3
- **Files modified:** 3 (1 source, 2 test files)

## Accomplishments

- CR-01 closed: `applyUndo`'s `moveTypeForPhase` now resolves `CORNER_KICK_FINAL_SETUP` to `'CORNER_KICK_MOVE'` (the actual event type `applyCornerKickFinalMove` appends), and a matching `lockReset` arm refunds the scalar `cornerKickPaceUsed` and releases `cornerKickMovedPieceId` at zero, mirroring the existing `GOAL_KICK_MOVE` arm exactly. Undo in this phase previously returned `NOTHING_TO_UNDO` unconditionally.
- CR-02 closed: a new `lockReset` arm for `CORNER_KICK_REPOSITION` decrements the per-piece running-total `cornerKickUsedPace` (deleting the key at 0, mirroring `goalKickUsedPace`), and separately releases the piece from `cornerKickStagePlacedIds` based on remaining current-stage `MOVE` events — not on the pace value reaching 0, since that value accumulates across all 6 stages (D-GAP-01). Undo previously moved the piece back but left both ledgers stale, permanently burning part of the piece's 6-hex budget.
- WR-03 closed: the two `GAME_UNDO validUndoPhases coverage for Corner Kick` socket tests (`CORNER_KICK_REPOSITION accepts Undo after a move`, `CORNER_KICK_FINAL_SETUP accepts Undo after a move`) previously asserted only `state.phase`, which is identical on Undo success and failure — masking both defects from CI. Both now capture the pre-move position, register a persistent `GAME_ERROR` listener before emitting `GAME_UNDO`, and assert no error fired plus the piece's reverted position and the relevant ledger fields.
- 12 new engine-level tests added to `gameEngine.cornerKick.test.ts`'s existing `applyUndo — corner-kick Undo boundaries` describe block (3 for CORNER_KICK_FINAL_SETUP, 3 for CORNER_KICK_REPOSITION, covering the cross-stage prior-pace case explicitly).

## Task Commits

Each task was committed atomically:

1. **Task 1: CR-01 — make Undo find and reverse the CORNER_KICK_MOVE event during CORNER_KICK_FINAL_SETUP** - `cf2c85f` (fix)
2. **Task 2: CR-02 — refund cornerKickUsedPace and the stage cap when a CORNER_KICK_REPOSITION move is undone** - `0b0dbb1` (fix)
3. **Task 3: WR-03 — make the socket-level corner Undo tests assert Undo's actual effect** - `e46fb94` (test)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — `applyUndo`: `moveTypeForPhase` gains a `CORNER_KICK_FINAL_SETUP` arm; the `moveToUndo` `Extract<ActionEvent, ...>` cast widened with `'CORNER_KICK_MOVE'`; `lockReset` gains a `CORNER_KICK_FINAL_SETUP` arm and a `CORNER_KICK_REPOSITION` arm
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` — 6 new tests in the `applyUndo — corner-kick Undo boundaries` describe block, covering full/partial undo for both phases and the cross-stage prior-pace case
- `packages/server/src/__tests__/gameHandlers.cornerKick.test.ts` — the two `GAME_UNDO validUndoPhases coverage for Corner Kick` tests rewritten to assert Undo's effect (position, pace ledgers, `GAME_ERROR` absence) instead of only `state.phase`

## Decisions Made

- **D-GAP-01** (locked in the plan, implemented as specified): clear a piece's `cornerKickStagePlacedIds` entry when its only remaining current-stage `MOVE` event is undone, computed from remaining `MOVE` events in the boundary-bounded `currentSlotEvents` slice — never from the cumulative `cornerKickUsedPace` value. Rationale: `cornerKickUsedPace` is a running total across all 6 reposition stages (per `applyCornerKickReposition`'s own doc comment), so gating stage-cap release on "pace reaches 0" would almost never fire for a piece that carries pace from an earlier stage, leaving the 2-distinct-piece cap wrongly consumed for the rest of that stage.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' `<behavior>`, `<action>`, and `<acceptance_criteria>` sections were implemented as specified, including the exact `lockReset` shapes (mirroring `GOAL_KICK_MOVE`/`goalKickUsedPace`) called out in 38-REVIEW.md sections CR-01/CR-02.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no `dist/` build output at plan start (first execution in this worktree); resolved with `pnpm install` followed by `pnpm --filter @counter-attack/shared build` before typecheck/test would run. This is worktree bootstrap, not a plan deviation — no source changes resulted.
- One `pnpm --filter @counter-attack/server test` run hit a transient `Worker exited unexpectedly` (tinypool) error unrelated to this plan's changes; an immediate re-run completed cleanly with all 39 test files / 982 tests passing. Not reproduced on subsequent runs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both CR-01 and CR-02 BLOCKER defects from `38-REVIEW.md` are closed; `applyUndo` now has symmetric coverage for every phase listed in `gameHandlers.ts`'s `validUndoPhases`, including both corner-kick reposition windows.
- WR-03's masking test weakness is closed — the two corner-kick Undo socket tests will now fail if a future regression reintroduces a silent no-op.
- Full server suite (982 tests) and full-monorepo typecheck (shared/server/client) are green.
- Remaining 38-REVIEW.md gap-closure items (38-11 through 38-15, per `504fb46`) are unaffected by this plan and can proceed independently.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.cornerKick.test.ts
- FOUND: packages/server/src/**tests**/gameHandlers.cornerKick.test.ts
- FOUND commit: cf2c85f
- FOUND commit: 0b0dbb1
- FOUND commit: e46fb94
