---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 11
subsystem: api
tags: [typescript, socket.io, gameHandlers, vitest, integration-test, penalty-kick]

# Dependency graph
requires:
  - phase: 39-07
    provides: 'gameEngine.ts triggerPenaltyKick/computePenaltyKickEligibleIds/applyPenaltyKickReposition/applyPenaltyKickWindowEnd/applyPenaltyKickTaker/applyPenaltyKickDuel — the pure penalty-kick engine chain this plan wires over sockets'
provides:
  - 'gameHandlers.ts GAME_MOVE delegation branch for PENALTY_KICK_SETUP_ATTACKING/DEFENDING (unbudgeted single-hex reposition, mirrors the goal-kick branch)'
  - 'gameHandlers.ts GAME_END_TURN delegation branch for the same two phases (window handoff to PENALTY_KICK_TAKER_SELECT)'
  - 'gameHandlers.ts new GAME_PENALTY_KICK_TAKER handler (five-step mutex/guard shape copied from GAME_GK_DIVE)'
  - 'gameHandlers.ts GAME_ROLL PENALTY_KICK branch (two server-generated rollDice() calls, never client-supplied dice)'
  - 'packages/server/src/__tests__/penaltyKick.integration.test.ts — 14-test two-socket integration suite covering PEN-01/02/03 end to end'
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'PENALTY_KICK is resolved in GAME_ROLL via a phase-specific branch placed BEFORE the DICE_PHASES guard (PENALTY_KICK is deliberately excluded from DICE_PHASES since it is resolved by applyPenaltyKickDuel directly, not applyRoll)'
    - 'Reposition/window-end/taker-select handlers copy the exact three shapes already established by goal-kick/corner-kick/GK-dive siblings (per-room isProcessing mutex -> team-ownership guard + payload validation -> pure delegate + broadcastState -> finally release)'

key-files:
  created:
    - packages/server/src/__tests__/penaltyKick.integration.test.ts
  modified:
    - packages/server/src/gameHandlers.ts

key-decisions:
  - 'GAME_ROLL PENALTY_KICK branch runs as an early return inside the existing try block, before the DICE_PHASES.has(phase) guard — the cleanest way to add a non-DICE_PHASES-member phase to a handler built around that guard without restructuring it'
  - 'Integration-test seed fixtures explicitly set GameState.ballZone (e.g. "away" for a penalty at PENALTY_SPOT.away) rather than leaving it at whatever setupRoom() left behind — an unset/stale ballZone spuriously read as a fresh cross-third entry the instant the duel resolved (KICK_OFF_SETUP/GK_RESTART/LOOSE_BALL are not in ZONE_CHECK_EXEMPT_PHASES, unlike the four PENALTY_KICK* phases themselves), hijacking the resolution phase with an unrelated FREE_MOVE_ATTACK/DEFENSE overlay from the centralized MOVE-06 zone check in broadcastState'
  - 'PEN-03 tie-routing is proven via a direct, deterministic applyPenaltyKickDuel(state, 3, 3) call against hand-tuned taker.shooting=5/gk.saving=7 attributes (guaranteeing takerCombined === gkCombined === 8), with the socket-level GAME_ROLL emission kept as a separate real-RNG smoke check accepting any of the 3 legal outcomes — matches the plan Task 2 action text verbatim'

requirements-completed: [PEN-01, PEN-02, PEN-03]

# Metrics
duration: ~20min
completed: 2026-08-14
---

# Phase 39 Plan 11: Penalty-Kick Socket Wiring Summary

**Wired the Plan 39-07 penalty-kick engine chain onto GAME_MOVE/GAME_END_TURN/GAME_ROLL plus a new GAME_PENALTY_KICK_TAKER handler, proven end-to-end by a 14-test two-socket integration suite covering PEN-01/02/03.**

## Performance

- **Duration:** ~20 min (includes a one-time `pnpm install`/shared-package build for the fresh worktree)
- **Completed:** 2026-08-14
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `GAME_MOVE` now delegates to `applyPenaltyKickReposition` during `PENALTY_KICK_SETUP_ATTACKING`/`PENALTY_KICK_SETUP_DEFENDING`, placed immediately after the existing goal-kick branch, with a `socketTeam(socket) !== activeTeam` pre-check and pieceId/hex payload-shape validation before any engine call.
- `GAME_END_TURN` now delegates to `applyPenaltyKickWindowEnd` for the same two phases, with the same handler-level `WRONG_TEAM` pre-check ordering used by every other reposition-window sibling.
- New `GAME_PENALTY_KICK_TAKER` handler wraps `applyPenaltyKickTaker` in the canonical five-step shape (null-state guard, phase guard, payload validation, team guard, engine call), copied from `GAME_GK_DIVE`.
- `GAME_ROLL` resolves the `PENALTY_KICK` duel via `applyPenaltyKickDuel`, generating both dice with `rollDice()` (never reading a die value from the client), added as an early branch before the `DICE_PHASES` guard since `PENALTY_KICK` is deliberately not a `DICE_PHASES` member.
- `packages/server/src/__tests__/penaltyKick.integration.test.ts` — 14 tests over real Socket.io connections proving: full-squad eligibility with no third-of-pitch filter, the wrong-team snap-back, 8 successive unbudgeted single-hex moves on one piece, the `PENALTY_AREA_RESTRICTED` guard, the two-window `GAME_END_TURN` handoff, taker-selection guards (`WRONG_TEAM`, goalkeeper rejection, malformed payload, `isProcessing` double-emit mutex), and the duel's -2 GK penalty expressed as an arithmetic relationship against the event's own reported dice plus a deterministic tie-to-`LOOSE_BALL` proof.
- Full server suite (1095 tests) and full monorepo build green after each task.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route GAME_MOVE / GAME_END_TURN / GAME_ROLL through the penalty phases and add GAME_PENALTY_KICK_TAKER** - `2d49e79` (feat)
2. **Task 2: Two-socket integration suite for the penalty-kick flow** - `abb1840` (test)

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/server/src/gameHandlers.ts` - Imports for the five 39-07 engine functions; new `GAME_MOVE` branch for the two penalty reposition-window phases; new `GAME_END_TURN` branch for the window handoff; new `GAME_PENALTY_KICK_TAKER` socket handler; new `GAME_ROLL` branch for the `PENALTY_KICK` duel
- `packages/server/src/__tests__/penaltyKick.integration.test.ts` - 14-test Vitest suite (two real `socket.io-client` connections per test, no mocking) covering every bullet in the plan's Task 2 action list

## Decisions Made

- The `GAME_ROLL` `PENALTY_KICK` branch is inserted as an early return at the top of the handler's `try` block, before the existing `DICE_PHASES.has(room.gameState.phase)` guard — `PENALTY_KICK` is intentionally excluded from `DICE_PHASES` (the duel is resolved by `applyPenaltyKickDuel` directly, not `applyRoll`), so it needed its own guard ordering rather than being folded into the existing `DICE_PHASES`-driven dispatch.
- Integration-test seed fixtures for the `PENALTY_KICK` duel explicitly set `ballZone: 'away'` (matching where `PENALTY_SPOT.away` genuinely sits) instead of leaving the field at whatever `setupRoom()`'s default kickoff state left behind. Without this, the centralized MOVE-06 zone check in `broadcastState` — which runs after literally every action, and for which `KICK_OFF_SETUP`/`GK_RESTART`/`LOOSE_BALL` are NOT exempt (unlike the four `PENALTY_KICK*` phases themselves) — would occasionally read a stale `ballZone` as a fresh cross-third entry the instant the duel resolved to `GK_RESTART` or `LOOSE_BALL`, spuriously overlaying `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` onto the very phase the smoke-check test asserts on. Discovered via a real intermittent full-suite failure (isolated single-file runs passed every time; the flake only surfaced under the shared random dice + real roster attribute values used by the full-suite run) and fixed by correcting the seed rather than loosening the assertion.
- PEN-03's tie-to-`LOOSE_BALL` routing is proven via a direct `applyPenaltyKickDuel(state, 3, 3)` call against a fixture with `taker.shooting=5`/`gk.saving=7` (forcing `takerCombined === gkCombined === 8`), exactly matching the plan's explicit instruction to "implement this as a deterministic unit-style check" while keeping a separate real-RNG socket-level `GAME_ROLL` emission as a smoke assertion over the three legal outcomes.

## Deviations from Plan

None — plan executed exactly as written. The `ballZone` fix above is test-fixture correctness work needed to make the plan's own Task 2 acceptance criteria pass reliably, not a deviation from the plan's specified behavior.

## Issues Encountered

- Fresh worktree had no `node_modules` and the `@counter-attack/shared` package had no `dist/` build output, causing an initial `tsc --noEmit` failure in `packages/server` (`Cannot find module '@counter-attack/shared'`). Resolved by running `pnpm install --frozen-lockfile` once, then `pnpm --filter @counter-attack/shared build`, before any typecheck/test command — consistent with prior Phase 39 plans' worktree notes (see 39-07 SUMMARY).
- An intermittent full-server-suite-only test failure (`FREE_MOVE_DEFENSE` where `['KICK_OFF_SETUP','GK_RESTART','LOOSE_BALL']` was expected) surfaced once during the full `pnpm --filter @counter-attack/server test` run despite the isolated single-file run passing consistently across 5 repeated runs. Root-caused to the missing `ballZone` seed field (see Decisions Made above) and fixed; re-verified with 5 additional isolated runs plus 2 full-suite runs, all green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full penalty-kick sequence (award → attacking reposition → defending reposition → taker selection → duel resolution) is now reachable end-to-end over real sockets, with every access-control, validation, and double-submit path proven by the integration suite.
- No blockers. Full monorepo build/test all green (server 1095 tests; shared/client unaffected, both still build clean).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: `packages/server/src/gameHandlers.ts`
- FOUND: `packages/server/src/__tests__/penaltyKick.integration.test.ts`
- FOUND: commit `2d49e79` (feat: route penalty-kick phases through GAME_MOVE/END_TURN/ROLL)
- FOUND: commit `abb1840` (test: two-socket integration suite for the penalty-kick flow)
