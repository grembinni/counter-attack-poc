---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 12
subsystem: ui
tags: [react, zustand, socket.io, throw-in, goal-kick, code-review-gap-closure]

# Dependency graph
requires:
  - phase: 37-out-of-bounds-detection-throw-in-goal-kick (plan 10)
    provides: ThrowInSetupPanel and GOAL_KICK_MOVE GAME_END_TURN branch built in earlier Phase 37 plans
provides:
  - Correct throw-in waiting-state side label (derived, not hardcoded)
  - Goal-kick KICKER travel slot no longer draws an unused die
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "actingSideLabel derivation (throwInTeam === attackingTeam ? 'Attacking' : 'Defending') mirrored from ActionPanel.tsx into a single-purpose panel"
    - 'Slot-gated rollDice() at the handler layer, inert 0 passed to a pure engine function to keep its signature total (ARCH-01)'

key-files:
  created: []
  modified:
    - packages/client/src/components/ThrowInSetupPanel.tsx
    - packages/client/src/components/ThrowInSetupPanel.test.tsx
    - packages/server/src/gameHandlers.ts

key-decisions:
  - "D-12-01: kept the locked '<Side> team is repositioning…' sentence shape; fixed only the label"
  - "D-12-02: derived actingSideLabel from attackingTeam rather than hardcoding 'Attacking'"
  - 'D-12-03: corrected the test fixture (attackingTeam/activeTeam = throwInTeam) rather than asserting its previously-wrong value'
  - "D-12-04: gated rollDice() at the handler layer with an inert 0 placeholder rather than changing applyGoalKickMoveEnd's signature"

patterns-established: []

requirements-completed: [THROWIN-02, GOALKICK-05]

# Metrics
duration: ~35min
completed: 2026-08-04
---

# Phase 37 Plan 12: WR-01/WR-02 Warning Closure Summary

**Fixed ThrowInSetupPanel's dead `isMyThrow` ternary (always rendered "Defending") by deriving `actingSideLabel` from `attackingTeam`, and gated the goal-kick `GOAL_KICK_MOVE` handler's `rollDice()` call to the `OPP` slot only, eliminating a wasted `crypto.randomInt` draw on the `KICKER` slot.**

## Performance

- **Duration:** ~35 min (includes a one-time `pnpm install` + `packages/shared` build to restore the worktree's test environment)
- **Completed:** 2026-08-04T17:02:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- WR-01: The waiting manager in `THROW_IN_SETUP` now sees the correct side named — `Attacking team is repositioning…` in the real-shaped state (`attackingTeam === throwInTeam`), and `Defending team is repositioning…` if that invariant were ever violated — proven by a new test that overrides `attackingTeam` independently of `throwInTeam`.
- WR-02: The goal-kick `KICKER` travel slot no longer generates a die via `rollDice()`; only the `OPP` slot (the sole consumer of `kickDie` via `computeCombinedScore`) draws one. `applyGoalKickMoveEnd`'s pure, total signature is unchanged.
- Zero engine file changes — `git diff packages/server/src/gameEngine.ts` is empty, confirmed after both tasks.

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-01 — correct the throw-in waiting-state side label** - `66552ea` (fix)
2. **Task 2: WR-02 — generate the goal-kick travel die only for the slot that consumes it** - `bb6641d` (fix)

**Plan metadata:** committed separately per worktree convention (SUMMARY.md only; STATE.md/ROADMAP.md owned by orchestrator)

## Files Created/Modified

- `packages/client/src/components/ThrowInSetupPanel.tsx` - Added `attackingTeam` selector and `actingSideLabel` derivation (`throwInTeam === attackingTeam ? 'Attacking' : 'Defending'`); replaced the dead `isMyThrow` ternary in the waiting-branch JSX with `{actingSideLabel}`.
- `packages/client/src/components/ThrowInSetupPanel.test.tsx` - `throwInSetupState` fixture now seeds `attackingTeam`/`activeTeam` to the throwing team (matching `triggerOutOfBoundsRestart`'s `THROW_IN` branch); added two tests pinning the exact waiting-state string in both the real-shaped and overridden-`attackingTeam` cases.
- `packages/server/src/gameHandlers.ts` - `GOAL_KICK_MOVE` branch of `GAME_END_TURN`: `const kickDie = rollDice();` replaced with `const kickDie = room.gameState.goalKickMoveSlot === 'OPP' ? rollDice() : 0;`.

## Rendered Waiting-State Strings (per plan `<output>` spec)

- Real-shaped state (`attackingTeam === activeTeam === throwInTeam === 'away'`, viewer `home`, `playerSlot: 1`): `Attacking team is repositioning…`
- Overridden state (`throwInSetupState('away', { attackingTeam: 'home' })`, `playerSlot: 1`): `Defending team is repositioning…`

Both assertions use the literal U+2026 ellipsis character, matching `ActionPanel.test.tsx`'s existing style.

## Surviving `const kickDie = rollDice();` Line

One unconditional `const kickDie = rollDice();` remains at `packages/server/src/gameHandlers.ts:927`, inside the separate `GK_KICK_MOVE` branch (a different, pre-Phase-37 state machine — not touched by this plan, per the plan's explicit instruction to leave it alone).

## `git diff packages/server/src/gameEngine.ts`

Empty — confirmed via `git diff --stat packages/server/src/gameEngine.ts` after both tasks. No engine file, socket event, state field, or guard was modified by this plan.

## Decisions Made

- D-12-01/D-12-02/D-12-03/D-12-04 (locked in the plan) — implemented exactly as specified; no deviation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no `dist/` build output, so the client test suite initially failed with `Failed to resolve entry for package "@counter-attack/shared"`. Resolved by running `pnpm install --frozen-lockfile` (from the untouched global pnpm content-addressable store — no directory-junction workaround used, per the project's documented Windows worktree risk) and `pnpm --filter @counter-attack/shared build`. This is environment setup, not a plan deviation — no source files were affected.
- One server test run reported `Worker exited unexpectedly` (a tinypool/vitest worker-process flake) on a first pass, showing 35/36 test files. A second full run of `pnpm --filter @counter-attack/server test` immediately after showed 36/36 test files, 761 passed / 1 skipped / 1 todo, zero failures — confirmed as an infra flake, not a regression from this plan's changes.

## Verification Results

- `pnpm --filter @counter-attack/client test -- ThrowInSetupPanel` — 15/15 passed (13 pre-existing + 2 new)
- `pnpm --filter @counter-attack/client test` — 547/547 passed (27 test files), exceeding the 545-pass baseline
- `pnpm --filter @counter-attack/server test -- goalKick.integration` — 25/25 passed
- `pnpm --filter @counter-attack/server test` — 761 passed / 1 skipped / 1 todo (36 test files), zero failures (confirmed on retry after a one-time worker flake)
- `pnpm -r typecheck` — clean across `shared`, `client`, `server`
- `git diff packages/server/src/gameEngine.ts` — empty

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both WARNING-severity anti-patterns from `37-VERIFICATION.md`/`37-REVIEW.md` (WR-01, WR-02) are closed. No engine, socket event, or state-field changes were made, so this plan carries zero risk to sibling parallel plans (e.g., 37-11) or downstream Phase 38+ work. No blockers.

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Completed: 2026-08-04_

## Self-Check: PASSED

- FOUND: packages/client/src/components/ThrowInSetupPanel.tsx
- FOUND: packages/client/src/components/ThrowInSetupPanel.test.tsx
- FOUND: packages/server/src/gameHandlers.ts
- FOUND: .planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-12-SUMMARY.md
- FOUND: commit 66552ea (Task 1)
- FOUND: commit bb6641d (Task 2)
- FOUND: commit a92ea9d (SUMMARY.md)
