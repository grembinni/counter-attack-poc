---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 05
subsystem: ui
tags: [zustand, react, typescript, socket.io, client-state]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: Phase 39 GamePhase/ActionEvent/GameState/PlayerPiece shared contract (Plan 39-01) — the GamePhase members, penaltyKick*/gkBoxEntry*/gkDiveAtFeet* GameState field clusters, and the 5 new ClientEvents this plan wires into the client store
provides:
  - Five Phase 39 client emitters on useGameStore (emitFoulChoice, emitGkDiveAtFeet, emitGkBoxEntryResponse, emitGkBoxEntryMove, emitPenaltyKickTaker) — fire-and-forget, no optimistic local state mutation
  - selectPiece branches for PENALTY_KICK_SETUP_ATTACKING/DEFENDING (unbudgeted full-squad reposition with penalty-area placement exemption), PENALTY_KICK_TAKER_SELECT (click-to-emit routing), and GK_BOX_ENTRY_MOVE (single-GK, up to 6 adjacent hexes)
  - computePenaltyKickValidHexes helper (unbudgeted neighbour derivation + penalty-area region exclusion with taker/GK exemption)
  - setGameState sticky-selection coverage for all three new multi-broadcast phases
  - Defense-in-depth no-selection guard for FOUL_CHOICE/GK_DIVE_AT_FEET_PROMPT/GK_BOX_ENTRY_PROMPT
affects: [39-06, 39-08, 39-09, 39-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Fire-and-forget emitter idiom (no set() state mutation) extended to all 5 new Phase 39 client actions, matching every pre-existing emitter in the file'
    - 'computePenaltyKickValidHexes follows the established computeFreeMoveValidHexes/computeResponseMoveValidHexes helper-extraction pattern (SELECTOR-REVIEW.md fix #3 precedent) — shared by selectPiece and setGameState sticky-selection rather than duplicated inline'

key-files:
  created: []
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts

key-decisions:
  - 'PEN-02 penalty reposition windows are deliberately unbudgeted — no usedPace >= 6 cutoff was ported from the GOAL_KICK_SETUP_GK/_OPPONENT branch, matching UI-SPEC copy ("no hex-distance cap qualifier")'
  - 'Penalty-area placement restriction (kicker + defending GK only) implemented as a client-side convenience highlight filter only (T-39-05-01) — the server independently re-validates the same rule in a later plan; no client filter here is load-bearing'
  - 'GK_BOX_ENTRY_MOVE reuses computeFreeMoveValidHexes verbatim (identical single-step-adjacency/on-pitch/unoccupied shape) rather than introducing a parallel helper'
  - 'FOUL_CHOICE/GK_DIVE_AT_FEET_PROMPT/GK_BOX_ENTRY_PROMPT get an explicit defense-in-depth selectPiece no-op branch in addition to the pre-existing phaseChanged clear in setGameState — belt-and-suspenders since no HexGrid wiring calls selectPiece during these phases yet'

patterns-established: []

requirements-completed: [FOUL-03, GKDIVE-02, PEN-02]

# Metrics
duration: ~25min
completed: 2026-08-14
---

# Phase 39 Plan 5: Store Emitters & Selection Wiring Summary

**Five new Phase 39 socket emitters plus full selectPiece/setGameState wiring for both penalty-kick reposition windows, penalty-taker selection, and the GK box-entry response move — landed entirely inside `useGameStore.ts` so the three downstream panel plans (39-06, 39-08, 39-09) and the integration plan (39-16) can build UI against a stable, tested store contract with zero file conflicts.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added `emitFoulChoice`, `emitGkDiveAtFeet`, `emitGkBoxEntryResponse`, `emitGkBoxEntryMove`, `emitPenaltyKickTaker` to the store interface and emitter block, each a pure `socket.emit(ClientEvents.X, ...)` call with no optimistic local state mutation (matches every existing emitter's fire-and-forget shape) — zero new `socket.on` listeners added.
- Wired `selectPiece` for the four new interactive Phase 39 phases: `PENALTY_KICK_SETUP_ATTACKING`/`_DEFENDING` (unbudgeted single-step-adjacency reposition, penalty-area exclusion with kicker/defending-GK exemption), `PENALTY_KICK_TAKER_SELECT` (click routes straight to `emitPenaltyKickTaker`, no local selection), and `GK_BOX_ENTRY_MOVE` (only the responding team's GK selectable, up to 6 adjacent unoccupied on-pitch hexes).
- Added `computePenaltyKickValidHexes` alongside the existing `computeFreeMoveValidHexes`-family helpers, shared between `selectPiece` and `setGameState`'s sticky-selection block.
- Extended `setGameState`'s sticky-selection block so a locked piece survives same-window broadcasts for all three new multi-broadcast phases (`PENALTY_KICK_SETUP_ATTACKING`/`_DEFENDING`, `GK_BOX_ENTRY_MOVE`); the `ATTACKING` → `DEFENDING` handoff clears selection for free via the pre-existing `phaseChanged` detection (distinct `GamePhase` values, same mechanism as `GOAL_KICK_SETUP_GK` → `_OPPONENT`).
- Added a defense-in-depth no-selection guard for the three pure two-button prompt phases (`FOUL_CHOICE`, `GK_DIVE_AT_FEET_PROMPT`, `GK_BOX_ENTRY_PROMPT`).
- 20 new test cases (91 → 111 in `useGameStore.test.ts`); full client suite green (814 tests); full monorepo `pnpm build` green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the five Phase 39 emitters to useGameStore** - `3464d97` (feat)
2. **Task 2: Selection and valid-hex derivation for the penalty reposition windows, taker select, and box-entry move** - `bed05a9` (feat)
3. **Task 3: Store tests for the new emitters and phase branches** - `1b75d79` (test)

_No plan-metadata commit yet — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` - 5 new emitters; `computePenaltyKickValidHexes` helper; `selectPiece` branches for `PENALTY_KICK_SETUP_ATTACKING`/`_DEFENDING`/`PENALTY_KICK_TAKER_SELECT`/`GK_BOX_ENTRY_MOVE`/the 3-phase no-selection guard; `setGameState` sticky-selection block extension
- `packages/client/src/store/useGameStore.test.ts` - emitter assertions for all 5 new actions; selectPiece coverage for eligibility gating, unbudgeted neighbour derivation, penalty-area exclusion (real `isInRegion`-derived hex, not an invented coordinate), `movedPieceIds` exhaustion, the ATTACKING→DEFENDING handoff, taker-select routing, GK box-entry hex-count bounds, and the three prompt-phase no-op guards

## Decisions Made

- PEN-02 reposition windows are unbudgeted (no numeric hex cap) — verified via `grep` that no `>= 6`-style cutoff exists in the penalty branch.
- Penalty-area restriction is a client-side highlight convenience only; server-side enforcement is explicitly out of this plan's scope (later plans 39-11/39-13/39-15 per the threat model).
- `GK_BOX_ENTRY_MOVE` deliberately reuses `computeFreeMoveValidHexes` rather than a new near-identical helper — same single-step-adjacency/on-pitch/unoccupied shape.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Fresh worktree had no `node_modules` and no built `packages/shared/dist` — ran `pnpm install --frozen-lockfile` once (~5 min) and `pnpm build` once before any typecheck/test command would resolve `@counter-attack/shared` correctly. Neither is a plan deviation; both are one-time worktree setup steps noted in Plan 39-01's summary as well.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useGameStore.ts` now exposes every emitter and selection/valid-hex behavior the three downstream panel plans (39-06 `FoulChoicePanel`/`GkDiveAtFeetPromptPanel`, 39-08/39-09 `PenaltyKickSetupPanel`/box-entry prompt) need to build against — no further store changes should be required for those plans to wire up their UI.
- `HexGrid.tsx`'s phase-specific click-to-emit routing (e.g. `onClick = () => emitGkBoxEntryMove(hex)` for `GK_BOX_ENTRY_MOVE`) is explicitly NOT part of this plan's file scope (`useGameStore.ts`/`.test.ts` only) — confirmed by inspecting `HexGrid.tsx`'s existing routing pattern (`emitKickOffMove`, `emitCornerKickGkPlace`, etc., all dispatched from `HexGrid.tsx`, not the store). A later plan must add the analogous click handlers for the 3 new emit targets (`emitGkBoxEntryMove`, plus whatever panel plan needs `emitFoulChoice`/`emitGkDiveAtFeet`/`emitGkBoxEntryResponse`/`emitPenaltyKickTaker` wired to their buttons).
- No blockers. Full monorepo build/typecheck/test all green (shared/server untouched this plan; client 814 tests green).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: 3464d97, bed05a9, 1b75d79 (all task commits present in `git log --oneline --all`)
- FOUND: `packages/client/src/store/useGameStore.ts` contains `emitFoulChoice`
- FOUND: `packages/client/src/store/useGameStore.ts` contains `penaltyKickEligibleIds`
- FOUND: `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-05-SUMMARY.md`
