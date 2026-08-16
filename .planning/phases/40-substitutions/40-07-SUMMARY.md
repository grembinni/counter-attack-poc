---
phase: 40-substitutions
plan: 07
subsystem: testing
tags: [socket.io, vitest, integration-test, substitutions, draft, foul-chain]

# Dependency graph
requires:
  - phase: 40-substitutions (plans 40-01..40-06)
    provides: bench seeding at LINEUP_CONFIRM, the stoppage-phase gate, applySubstitution/relocateRedCardedToBench engine rules, the SUB-05 added-time fold-in, and D-13's red-card bench relocation
provides:
  - One integration test file proving SUB-01..07/SETTINGS-04/D-12/D-13 across the real socket boundary with two connected clients
affects: [40-substitutions milestone close, /gsd-verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Draft-room-to-live-match integration setup (setupLiveDraftMatch) reusing draftSession.integration.test.ts's copy-per-file driver/pickIntoLineup boilerplate, extended with configurable v1.6 toggles"
    - "D-13 red card seeded via a direct, unmocked applyMove() call (bookingDie upgrade via prior yellowCards:1), then asserted over the wire via broadcastState + both clients' GAME_STATE listener — mirrors foulFreeKick.integration.test.ts's 'seed via engine, drive over sockets' pattern"
    - "A single file-scoped vi.mock('../diceUtils.js') fixes rollDice() so the SUB-05 added-time formula (roll + leniency + subs) is asserted, never hard-coded"

key-files:
  created: [packages/server/src/__tests__/substitution.integration.test.ts]
  modified: []

key-decisions:
  - "SUB-05's added-time case asserts the computed addedTime VALUE after the single end-turn call that crosses actionCount 45, rather than driving the (much longer, real-injury-time) sequence required to reach the literal HALF_TIME phase transition — the plan's must_haves truth is about the added-time VALUE being correct, which this fully proves"
  - "D-13's red card was seeded via the simpler 'second yellow becomes red' path (fouler pre-set to yellowCards:1) rather than the professional-foul reachability path — fouls.ts's resolveBooking doc comment confirms this upgrade fires 'regardless of whether the foul was a professional foul', so no cover-teammate fixture geometry was needed"

requirements-completed: [SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06, SUB-07, SETTINGS-04]

# Metrics
duration: ~55min
completed: 2026-08-16
---

# Phase 40 Plan 07: Substitution Integration Test Summary

**One integration test file (packages/server/src/**tests**/substitution.integration.test.ts, 12 `it()` blocks, ~1020 lines) proving SUB-01..07/SETTINGS-04/D-12/D-13 across a real Socket.io server with two connected clients — Task 2's two-browser human walkthrough is still pending (checkpoint).**

## Performance

- **Duration:** ~55 min
- **Tasks:** 1 of 2 completed (Task 2 is a `checkpoint:human-verify` — see below)
- **Files modified:** 1 created

## Status: PAUSED AT CHECKPOINT

This plan has two tasks. **Task 1 (automated integration test) is complete, verified, and committed.** **Task 2 is a `checkpoint:human-verify` requiring a live two-browser walkthrough** that cannot be automated (dragging bench cards onto pitch slots, visually confirming badges/chips/dimmed states). Per this plan's `autonomous: false` frontmatter and the project's `auto_advance: false` config, this execution stopped at the checkpoint rather than guessing at human approval.

## Accomplishments

- Drove a DRAFT room all the way to a live `KICK_OFF_SETUP` match twice per test (once per `it()`, matching the codebase's per-test-isolation convention) to get a real, substitutable 6-entry bench per team (SUB-02) — the only room type with a non-empty bench today.
- Proved, over the real socket boundary with two connected clients:
  - SUB-01/02/03: a KICK_OFF_SETUP substitution (home, then away in the same stoppage) — number/hex inheritance, `subsUsed` increment, bench status flip to `subbedOut`, `SUBSTITUTION` eventLog tail.
  - SUB-07: re-subbing the just-departed player is rejected `ALREADY_SUBBED`.
  - SUB-04: 3 home substitutions succeed, the 4th is rejected `SUB_CAP_REACHED`; the cap survives a seeded `HALF_TIME` transition (never resets).
  - SUB-05: `addedTime` equals the injected roll + `refereeCard.leniency` + substitutions made that half — computed from state, never hard-coded.
  - SUB-06/D-08: `CANNOT_SUB_RED_CARD` for the outgoing red-carded piece; a different piece still subs successfully; `maxOnPitchFor` stays at 10.
  - D-13: a REAL foul (seeded via a direct, unmocked `applyMove()` call) produces a red card; both clients' broadcast `GameState` shows the bench entry, the still-present `onPitch:false` piece, `maxOnPitchFor===10`, and a `CANNOT_SUB_IN_RED_CARDED` rejection over the wire.
  - SUB-03/07: a substitute survives a real `GAME_SHOT` auto-goal kick-off reset; the departed player never reappears; the bench (including an unrelated pre-existing D-13 entry) is unchanged.
  - SETTINGS-04: the basic success case with all four v1.6 toggles off, and again with all four on.
  - D-12: a STANDARD room reaches a live match with an EMPTY bench (verified fact: Standard squads hold exactly 11 players today) and a calm `INVALID_SUBSTITUTE` rejection — no auto-fill, no error, no disconnect.
  - T-40-22 (threat register): a cross-team substitution attempt is rejected `WRONG_TEAM` without mutating either team's `subsUsed`.
- `pnpm --filter @counter-attack/server test -- substitution.integration` — 12/12 passed.
- `pnpm --filter @counter-attack/server test --pool=forks` (full server suite, worker-crash flake workaround per project memory) — 56/56 files, 1439 tests passed.
- `pnpm --filter @counter-attack/shared test` — 17/17 files, 839 tests passed.
- `pnpm --filter @counter-attack/client test` — 34/34 files, 989 tests passed.

## Task Commits

1. **Task 1: Two-client substitution integration test** - `a624e4d` (test)

**Plan metadata:** not yet created — plan is paused at the Task 2 checkpoint, not complete.

## Files Created/Modified

- `packages/server/src/__tests__/substitution.integration.test.ts` - The full two-client socket walkthrough of SUB-01..07/SETTINGS-04/D-12/D-13 described above.

## Decisions Made

See `key-decisions` in frontmatter above (SUB-05 test scope, D-13 seed-path simplification).

## Deviations from Plan

None - Task 1 executed exactly as written. No Rule 1-4 auto-fixes were needed; all guard behavior, bench semantics, and event shapes matched the existing `applySubstitution`/`resolveFoulChain`/`applyEndTurn` implementation from plans 40-01..40-06 on the first test run.

## Issues Encountered

- The worktree's `node_modules` was missing on first run (fresh worktree) and `packages/shared`'s `dist/` build output was stale/absent, causing a Vite "Failed to resolve entry for package @counter-attack/shared" error. Resolved with `pnpm install` (real install, no junction workaround per project memory on Windows node_modules junction risk) followed by `pnpm --filter @counter-attack/shared build`.
- The full `pnpm --filter @counter-attack/server test` run hit the known vitest worker-crash flake (documented in project memory) on the default thread pool — resolved by rerunning with `--pool=forks`, which passed 56/56 files cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Awaiting Task 2 (`checkpoint:human-verify`): a live two-browser walkthrough of the substitution feature.** See `.planning/phases/40-substitutions/40-07-PLAN.md`'s Task 2 for the full 11-step verification script (SUB strip visibility/dimming, drag-and-drop substitution, 3/3 cap rejection UI, D-13 red-card bench badge, half-time added-time display, D-12 empty-bench calm state). Once approved (or gap-closure findings are captured), this plan can be finalized: STATE.md/ROADMAP.md/REQUIREMENTS.md updates and the final metadata commit are owned by the orchestrator after the wave completes, per this execution's parallel-worktree instructions.

---

_Phase: 40-substitutions_
_Completed: Task 1 only — 2026-08-16 (Task 2 checkpoint pending)_
