---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 23
subsystem: ui
tags: [react, zustand, penalty-kick, gap-closure, confirm-pattern]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: PENALTY_KICK_TAKER_SELECT phase ordering and PENALTY_KICK duel resolution (Plans 39-16, 39-21, 39-22)
provides:
  - Selection-only PENALTY_KICK_TAKER_SELECT store branch (mirrors CORNER_KICK_TAKER_SELECT)
  - Confirm button on PenaltyKickSetupPanel for the taker-select step
  - Shoot-only CTA for the PENALTY_KICK duel phase (previously unreachable)
  - Client-side redCarded exclusion for penalty-taker selectability (closes 39-REVIEW IN-02)
affects: [penalty-kick, hex-grid-selection, action-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Select-then-Confirm taker pattern (CORNER_KICK_TAKER_SELECT shape) reused for PENALTY_KICK_TAKER_SELECT'

key-files:
  created: []
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx
    - packages/client/src/components/PenaltyKickSetupPanel.tsx
    - packages/client/src/components/PenaltyKickSetupPanel.test.tsx

key-decisions:
  - 'PENALTY_KICK_TAKER_SELECT click behavior changed from immediate emitPenaltyKickTaker to select-only, committed via a new Confirm button, byte-for-byte mirroring CORNER_KICK_TAKER_SELECT'
  - "redCarded === true added as a rejection term in both the store's selectPiece guard and HexGrid's canSelectPenaltyKickTaker predicate, matching applyPenaltyKickTaker's server-side TAKER_INVALID guard"
  - "PENALTY_KICK phase's acting-manager arm gets a single Shoot button calling emitRoll() with no payload — the phase previously had zero controls because GameBoard routes PENALTY_KICK to PenaltyKickSetupPanel, not ActionPanel"

patterns-established:
  - 'Any future taker-select restart phase should follow the select-then-Confirm shape (store selects only, panel Confirm button commits) rather than committing on the raw board click'

requirements-completed: [PEN-01, PEN-02]

# Metrics
duration: ~20min
completed: 2026-08-15
---

# Phase 39 Plan 23: Penalty Taker Confirm + Shoot CTA Summary

**Penalty-kick taker selection now requires an explicit Confirm click (mirroring corner-kick), rejects red-carded teammates client-side, and the PENALTY_KICK duel phase gained its first-ever reachable control — a single Shoot button.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Closed 39-UAT gap 6: a board click during `PENALTY_KICK_TAKER_SELECT` now only selects a candidate piece (highlighting it); the taker is committed only when the manager presses the panel's new Confirm button, which is disabled until a piece is selected and carries an explanatory title — exactly matching `CornerKickSetupPanel`'s `CORNER_KICK_TAKER_SELECT` step. Previously a misclick committed the taker irreversibly, since `PENALTY_KICK_TAKER_PLACED` is an Undo boundary.
- Closed 39-REVIEW IN-02: a sent-off (`redCarded === true`) teammate is no longer selectable on the client during taker selection — the rejection is applied in both `useGameStore.ts`'s `selectPiece` guard and `HexGrid.tsx`'s `canSelectPenaltyKickTaker` predicate, mirroring `applyPenaltyKickTaker`'s server-side `TAKER_INVALID` rejection instead of relying on a round-trip `GAME_ERROR`.
- Discovered and fixed a defect found while planning gap 6 (not separately reported in 39-UAT): the `PENALTY_KICK` phase rendered the text "Take your penalty kick." with **no button at all** for the kicking manager. The branch's own comment falsely claimed "the Roll Dice action lives in ActionPanel" — but `GameBoard` routes `PENALTY_KICK` to `PenaltyKickSetupPanel`, and `ActionPanel` is never rendered during that phase. Added a single `Shoot` CTA calling `emitRoll()`, satisfying 39-UAT test 5's "Shoot is the only option on restart."

## Task Commits

Each task was committed atomically:

1. **Task 1: Make penalty-taker clicks select rather than commit** - `4a1ed20` (feat)
2. **Task 2: Add the taker Confirm button and the shoot-only penalty CTA** - `537062a` (feat)

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` - `PENALTY_KICK_TAKER_SELECT` branch of `selectPiece` rewritten to select-only (mirrors `CORNER_KICK_TAKER_SELECT`), adds `piece.redCarded === true` to the rejection guard
- `packages/client/src/store/useGameStore.test.ts` - rewrote the two existing taker-select tests for the new selection-only shape; added red-carded and opponent-piece coverage
- `packages/client/src/components/HexGrid.tsx` - `canSelectPenaltyKickTaker` predicate adds `piece.redCarded !== true`, comment updated to describe the Confirm-driven flow
- `packages/client/src/components/HexGrid.test.tsx` - new describe block covering selectable/non-selectable rendering for healthy, red-carded, GK, and non-acting-manager cases
- `packages/client/src/components/PenaltyKickSetupPanel.tsx` - `PENALTY_KICK_TAKER_SELECT` branch gains a select-first error row and a Confirm button (`emitPenaltyKickTaker(selectedPieceId)`); `PENALTY_KICK` branch's acting-manager arm gains a single `Shoot` button (`emitRoll()`)
- `packages/client/src/components/PenaltyKickSetupPanel.test.tsx` - rewrote taker-select and duel-resolution tests for the new controls; added a cross-phase "no Pass/High/Long/Move label" regression test

## Decisions Made

- Reused the exact `CORNER_KICK_TAKER_SELECT` / `CornerKickSetupPanel` select-then-Confirm shape rather than inventing a new interaction pattern — the plan's `must_haves` explicitly required parity with the corner-kick taker step.
- The Shoot CTA calls `emitRoll()` with no `passType`/`targetHex` arguments, matching the server's `GAME_ROLL` `PENALTY_KICK` branch, which resolves the duel via `applyPenaltyKickDuel` and ignores any payload for this phase.

## Deviations from Plan

None - plan executed exactly as written. Both auto-discoveries described above (the PENALTY_KICK phase's missing control, and 39-REVIEW IN-02) were explicitly named as in-scope by the plan's objective and `read_first` notes, not unplanned deviations.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no build output, causing an initial `vitest` resolution failure (`Failed to resolve entry for package "@counter-attack/shared"`). Resolved by running `pnpm install` (safe — uses the shared pnpm content-addressable store, does not touch the main repo's `node_modules`) and `pnpm --filter @counter-attack/shared build`, both one-time setup steps unrelated to this plan's code changes.
- The whole-workspace `pnpm lint` command is documented tech debt (OOMs on a pre-existing `packages/shared` typescript-eslint config issue, per `STATE.md`). Verified lint cleanliness by running `eslint` scoped directly to the six files this plan touched (`node packages/../node_modules/eslint/bin/eslint.js <files>`) — zero errors. `pnpm stylelint` (workspace-wide, no OOM issue) passed with exit code 0. `pnpm typecheck` (all three packages) passed clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PEN-01/PEN-02 requirements fully covered by this gap-closure plan combined with prior Plans 39-16/39-21/39-22.
- Full client test suite (952 tests, 34 files) and server test suite (1327 passed / 1 skipped / 1 todo, 53 files) both green after this plan's changes.
- No known stubs or deferred work introduced by this plan.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-15_
