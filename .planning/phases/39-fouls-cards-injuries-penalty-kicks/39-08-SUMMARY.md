---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 08
subsystem: ui
tags: [react, typescript, css-modules, zustand]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: Phase 39 GamePhase/GameState penaltyKick* fields (Plan 39-01) and the store emitters/selectPiece wiring for the four penalty-kick phases (Plan 39-05) — emitEndTurn, emitPenaltyKickTaker, computePenaltyKickValidHexes, penaltyKickTeam/penaltyKickEligibleIds/penaltyKickUsedPace/penaltyKickTakerId state fields
provides:
  - PenaltyKickSetupPanel.tsx covering all four penalty-kick phases (PENALTY_KICK_SETUP_ATTACKING, PENALTY_KICK_SETUP_DEFENDING, PENALTY_KICK_TAKER_SELECT, PENALTY_KICK)
  - PenaltyKickSetupPanel.module.css (borderless panel-family CSS, verbatim class-set copy of GoalKickSetupPanel.module.css)
  - 20-case component test suite locking phase-gating, acting/waiting split, eligible-count derivation, soft end-turn dialog, and humanised gameError rendering
affects: [39-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PenaltyKickSetupPanel follows GoalKickSetupPanel's sequential-reposition-window structure exactly (withEndTurnGuard/pendingEndTurn soft-confirm dialog, per-slice selectors, single unchanging heading across sub-steps) but drops the goal-kick branch's `usedPace >= 6` hex-cap cutoff since PEN-02 is unbudgeted"

key-files:
  created:
    - packages/client/src/components/PenaltyKickSetupPanel.tsx
    - packages/client/src/components/PenaltyKickSetupPanel.module.css
    - packages/client/src/components/PenaltyKickSetupPanel.test.tsx
  modified: []

key-decisions:
  - "PENALTY_KICK (final duel) branch is gated on activeTeam rather than penaltyKickTeam — mirrors GoalKickSetupPanel's GOAL_KICK_MOVE travel-window branch, which is the only prior branch in the sibling panel that uses activeTeam instead of the restart-specific team field"
  - "PENALTY_KICK_TAKER_SELECT acting branch conditionally shows 'Placing your penalty taker…' when penaltyKickTakerId is already non-null (defensive against a broadcast landing between the taker click and the phase transition), falling back to the locked 'Choose your penalty taker.' copy otherwise"
  - "No new copy was invented for the PENALTY_KICK duel branch beyond what the plan's action text describes (kicking manager told to take the kick, defending manager told to wait) since UI-SPEC's Copywriting Contract has no locked string for this specific sub-step beyond the unchanging 'Penalty Kick' heading"

patterns-established: []

requirements-completed: [PEN-01, PEN-02]

# Metrics
duration: ~25min
completed: 2026-08-14
---

# Phase 39 Plan 8: Penalty Kick Setup Panel Summary

**`PenaltyKickSetupPanel.tsx` built as a direct structural copy of `GoalKickSetupPanel.tsx`'s reposition-window branch, covering all four penalty-kick phases with unbudgeted full-squad repositioning, the always-visible penalty-area restriction line, and the locked soft end-turn confirm dialog.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-14
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments

- `PenaltyKickSetupPanel.tsx` covers `PENALTY_KICK_SETUP_ATTACKING`, `PENALTY_KICK_SETUP_DEFENDING`, `PENALTY_KICK_TAKER_SELECT`, and `PENALTY_KICK` with a single unchanging `"Penalty Kick"` heading and the locked acting/waiting split (`"{Team} is repositioning…"` / `"Attacking is choosing a penalty taker…"` / `"Waiting for the penalty kick…"`).
- Reposition windows (`PENALTY_KICK_SETUP_ATTACKING`/`_DEFENDING`) derive `remaining` from `penaltyKickEligibleIds` minus `penaltyKickUsedPace`-nonzero and `movedPieceIds`-member pieces — no hex-distance cap, since PEN-02 is deliberately unbudgeted (unlike Goal/Corner Kick's capped windows).
- The always-visible penalty-area constraint row (`"Only the penalty taker and goalkeeper may stand in the penalty area."`) renders in both reposition windows, and the single `Confirm` CTA reuses `ctaColorClass`/`withEndTurnGuard`/`pendingEndTurn` verbatim from `GoalKickSetupPanel`, including the `"{N} players left to reposition, are you sure you want to end your turn?"` soft dialog with `Cancel`/`Yes, end turn`.
- `PenaltyKickSetupPanel.module.css` is a verbatim class-set copy of `GoalKickSetupPanel.module.css` — `.panel` defines only `background`/`border-radius`/`padding` with no `border` property (Phase 35 panel-family convention).
- 20 new component tests cover phase gating (null/undefined `penaltyKickTeam`, null `playerSlot`), both reposition windows' acting/waiting split and eligible-count math, the soft dialog's three paths (open-with-remaining, Cancel, Yes-end-turn, zero-remaining-immediate), `PENALTY_KICK_TAKER_SELECT`'s acting/waiting split, the `PENALTY_KICK` duel branch's acting/waiting split, and humanised `gameError` rendering in every acting branch. Full client suite: 852 tests green (832 → 852).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build PenaltyKickSetupPanel and its CSS module** - `678ac5b` (feat)
2. **Task 2: Component tests for PenaltyKickSetupPanel** - `2ab13d9` (test)

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/client/src/components/PenaltyKickSetupPanel.tsx` - New component covering all four penalty-kick phases; guard block mirrors GoalKickSetupPanel's D-04/Pitfall-4 null-team shape; per-slice `useGameStore` selectors for `phase`/`activeTeam`/`penaltyKickTeam`/`penaltyKickEligibleIds`/`penaltyKickUsedPace`/`penaltyKickTakerId`/`movedPieceIds`/`gameError`/`emitEndTurn`
- `packages/client/src/components/PenaltyKickSetupPanel.module.css` - New CSS module, verbatim class-set copy of `GoalKickSetupPanel.module.css` (borderless `.panel`, `xs` spacing scale, locked typography sizes)
- `packages/client/src/components/PenaltyKickSetupPanel.test.tsx` - New 20-case test suite mirroring `GoalKickSetupPanel.test.tsx`'s harness/mock-state pattern

## Decisions Made

- The `PENALTY_KICK` (final duel) branch is gated on `activeTeam` rather than `penaltyKickTeam`, matching `GoalKickSetupPanel`'s one precedent for this (the `GOAL_KICK_MOVE` travel window) — the duel-roll step is a "whose turn is it" concept, not a fixed restart-team concept, consistent with how `ActionPanel`'s `isActivePlayer` gates every other dice-roll-driven phase in the codebase.
- `penaltyKickTakerId` is used defensively in the `PENALTY_KICK_TAKER_SELECT` acting branch (shows `"Placing your penalty taker…"` if already non-null) rather than left unused — this mirrors the store's own defensive "already-chosen penalty taker" exemption comment in `computePenaltyKickValidHexes` and satisfies the plan's explicit selector list without altering any of the locked constraint-row/error copy strings.
- No new copy was invented beyond the plan's description for the `PENALTY_KICK` duel branch (`"Take your penalty kick."` / `"Waiting for the penalty kick…"`) since UI-SPEC's Copywriting Contract only locks the unchanging `"Penalty Kick"` heading for this branch, not manager-specific sub-copy.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Fresh worktree needed `pnpm install --frozen-lockfile` and a `packages/shared` build before `typecheck`/`test`/`stylelint` would resolve `@counter-attack/shared` — a one-time worktree-setup step, not a plan deviation (consistent with Plan 39-01/39-05's summaries noting the same).
- The first two `git commit` attempts for Task 1 were slow/interrupted by `lint-staged`'s `eslint --fix` step building type-aware lint info for the first time in this fresh worktree (one attempt exceeded a 2-minute tool timeout with no error, one hit a `git stash`-adjacent race under concurrent sibling-worktree lint-staged runs). Neither run corrupted the worktree — `git status`/`git diff --cached` were checked after each attempt to confirm the staged files were untouched, then the commit was retried (no `--no-verify`, no stash operations) and succeeded once eslint's type-info cache was warm.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `PenaltyKickSetupPanel` is built and tested but not yet wired into `GameBoard.tsx`'s phase dispatch — that integration is explicitly Plan 39-16's scope, as stated in this plan's `<objective>`.
- No blockers. `pnpm --filter @counter-attack/client typecheck`, `pnpm stylelint`, `pnpm --filter @counter-attack/client test` (852 tests), and full monorepo `pnpm build` (shared/client/server) all green.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: `packages/client/src/components/PenaltyKickSetupPanel.tsx`
- FOUND: `packages/client/src/components/PenaltyKickSetupPanel.module.css`
- FOUND: `packages/client/src/components/PenaltyKickSetupPanel.test.tsx`
- FOUND: `678ac5b` (Task 1 commit in `git log --oneline --all`)
- FOUND: `2ab13d9` (Task 2 commit in `git log --oneline --all`)
