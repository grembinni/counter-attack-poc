---
phase: 38-corner-kick
plan: 31
subsystem: game-engine
tags: [gameEngine, corner-kick, undo, regression-fix, gap-closure]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: 38-27 (bounded single-destination corner reposition placement model) — this plan's Undo-fix and multi-undo tests are proven against 38-27's model
  - phase: 38-corner-kick
    provides: 38-29 (client mirror of the placement model) — CornerKickSetupPanel.tsx's canUndoReposition/canUndoFinalSetup guards, unblocked by this plan's server-side fix
  - phase: 38-corner-kick
    provides: 38-30 (re-verification checkpoint) — reported the Undo regression (bug 2) this plan fixes and re-opened D-GAP-01
provides:
  - "GameState.lastDiceRoll cleared on entry to both corner-kick reversible-move windows (CORNER_KICK_REPOSITION via applyCornerKickTakerSelect, CORNER_KICK_FINAL_SETUP via applyCornerKickStageEnd's terminal branch), unblocking CornerKickSetupPanel.tsx's `if (lastDiceRoll) return false;` Undo-enablement guard"
  - "applyUndo's CORNER_KICK_REPOSITION arm doc comment now states the LIFO multi-undo contract explicitly (D-GAP-01)"
  - '5 new regression tests (4 engine, 1 socket-level integration) proving the fix, the LIFO multi-undo stack across two distinct pieces, and that the shared triggerOutOfBoundsRestart commonReset block was NOT touched (THROW_IN/GOAL_KICK unaffected)'
affects: [38-32 (bug-1 triage — offside ring reset), 38-33 (re-verification round 4)]
requirements-completed: [CORNER-03, CORNER-06]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
    - packages/server/src/__tests__/cornerKick.integration.test.ts

key-decisions:
  - "Root cause confirmed exactly as scoped: GameState.lastDiceRoll was never cleared anywhere in the corner-kick chain. triggerOutOfBoundsRestart's shared commonReset object (used by THROW_IN, GOAL_KICK, and CORNER_KICK restarts) does not include lastDiceRoll, and both applyRoll LOOSE_BALL call sites pass a freshly-populated lastDiceRoll (context: 'LOOSE_BALL') into it — so a corner award always entered its downstream phases carrying a stale non-null value, permanently blocking CornerKickSetupPanel.tsx's `if (lastDiceRoll) return false;` guard."
  - "Fix applied at the two corner-specific window-entry sites (BUG-18/Phase-18.3 pattern, mirroring applyFreeMoveZoneCheck's FREE_MOVE entry and the GK_KICK_MOVE/SNAPSHOT_DEFLECT entries) — NOT at the shared commonReset block. This deliberately keeps lastDiceRoll visible during CORNER_KICK_GK_SETUP_ATTACKING/_DEFENDING (neither of which has an Undo control) and leaves THROW_IN/GOAL_KICK dice-readout behavior, both shipped and human-verified in Phase 37, completely unchanged."
  - "applyUndo's CORNER_KICK_REPOSITION LIFO logic required NO code changes — read and proven correct via test (c) against the 38-27 bounded single-destination placement model. The regression was purely the permanently-false client-side Undo-enablement guard, not a broken undo stack; the verifier's three sub-findings (visual gap, single-undo, multi-step stack) were all downstream symptoms of the same one root cause."
  - "Confirmed by direct experiment (temporarily reverting Task 1's gameEngine.ts changes and re-running the suite) that tests (a), (b) and (e) fail without the fix and pass with it — required by the plan's acceptance criteria."

patterns-established:
  - '38-31 pattern for future restart-reversible-window fixes: when a client Undo-enablement guard reads `lastDiceRoll`, verify the corresponding server phase-entry return literal explicitly nulls it — do not assume a shared reset block covers it, since shared reset blocks are deliberately NOT the place to clear phase-specific stale dice state (would silently regress sibling restart families).'

# Metrics
duration: ~2h26m across two sessions (14:00-14:26 Task 1, session-limit interruption, resumed 16:33-16:37 Task 2); active edit/verify/commit time was substantially shorter than the wall-clock gap
completed: 2026-08-09
---

# Phase 38 Plan 31: Fix Corner-Kick Undo Regression (lastDiceRoll never cleared) Summary

**Root-caused and fixed the Undo-enablement regression reported in `38-30-SUMMARY.md` bug 2: `GameState.lastDiceRoll` was never cleared on entry to either corner-kick reversible-move window, permanently blocking `CornerKickSetupPanel.tsx`'s `canUndoReposition`/`canUndoFinalSetup` guard — fixed with two targeted `lastDiceRoll: null` additions plus 5 new regression tests (4 engine, 1 socket-level) proving the fix, the LIFO multi-undo stack, and that the shared restart-reset block was untouched.**

## Performance

- **Duration:** ~2h26m wall-clock across two sessions (Task 1 committed 14:25:50, Task 2 committed 16:36:28), interrupted mid-plan by a session-limit reset between the two tasks; active edit/verify/commit time was well under an hour.
- **Completed:** 2026-08-09
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Confirmed the exact root cause described in the plan: `triggerOutOfBoundsRestart`'s shared `commonReset` object does not include `lastDiceRoll`, and both `applyRoll` LOOSE_BALL call sites pass a freshly-populated `lastDiceRoll` into it, so a corner award always carried a stale non-null value forward through `CORNER_KICK_GK_SETUP_ATTACKING/_DEFENDING` into `CORNER_KICK_TAKER_SELECT` and beyond.
- Added `lastDiceRoll: null` to `applyCornerKickTakerSelect`'s `ok: true` return literal (Site A) — the actual fix, since this is the transition into `CORNER_KICK_REPOSITION` where the Undo control lives.
- Added `lastDiceRoll: null` to `applyCornerKickStageEnd`'s terminal (`stageIndex === 5`) return literal (Site B) — defence-in-depth for `CORNER_KICK_FINAL_SETUP`'s Undo control, documented as protecting against a future dice-bearing step being inserted between the two windows.
- Left `triggerOutOfBoundsRestart`'s `commonReset` object completely untouched, and proved it stays untouched with a dedicated regression test (test d) — THROW_IN and GOAL_KICK dice-readout behavior (shipped/human-verified in Phase 37) is provably unchanged.
- Extended `applyUndo`'s `CORNER_KICK_REPOSITION` arm doc comment to state the LIFO multi-undo contract explicitly, per the plan's instruction — read the existing logic first and confirmed no code change was needed; it was already correct against the 38-27 bounded single-destination placement model.
- Added 5 new tests: (a) `applyCornerKickTakerSelect` clears `lastDiceRoll`, (b) `applyCornerKickStageEnd` at stage 5 clears `lastDiceRoll`, (c) a full three-`applyUndo` LIFO sequence across two DISTINCT pieces placed in one stage (the scenario the 38-27 model actually produces in live play, since same-piece re-touch is now `PIECE_LOCKED`), (d) the targeted-fix guard proving a `THROW_IN` restart still carries a non-null `lastDiceRoll` forward, and (e) a full socket-level walkthrough (real `game:roll` → both GK setup windows → `game:corner-kick-taker`) proving `lastDiceRoll` is non-null at `CORNER_KICK_GK_SETUP_ATTACKING` and null at `CORNER_KICK_REPOSITION`.
- Verified by direct experiment — temporarily reverting Task 1's `gameEngine.ts` changes to the pre-fix committed state and re-running the suite — that tests (a), (b), and (e) fail without the fix (with the exact stale-`lastDiceRoll` assertion failures the plan predicted) and all pass again once the fix is restored.

## Task Commits

Each task was committed atomically:

1. **Task 1: Clear lastDiceRoll on entry to both corner-kick reversible-move windows** - `a959d04` (fix)
2. **Task 2: Prove the Undo enablement fix and the LIFO multi-step stack with engine and socket tests** - `e1482f4` (test)

**Plan metadata:** committed as part of this summary's commit (docs)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - `applyCornerKickTakerSelect`'s `ok: true` return literal and `applyCornerKickStageEnd`'s terminal `stageIndex === 5` return literal both gain `lastDiceRoll: null`; `applyUndo`'s `CORNER_KICK_REPOSITION` refund-arm doc comment extended with the explicit LIFO multi-undo contract; `triggerOutOfBoundsRestart`'s `commonReset` block is unchanged (verified via `git diff` — exactly two new `lastDiceRoll: null` properties plus comment-only changes)
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` - 4 new tests: the two `lastDiceRoll` clears, the two-distinct-piece LIFO multi-undo stack (163 lines), and the `THROW_IN` targeted-fix guard
- `packages/server/src/__tests__/cornerKick.integration.test.ts` - 1 new socket-level test driving a real corner award through both GK setup windows into `CORNER_KICK_REPOSITION`, asserting `lastDiceRoll` visibility/clearing at each real-broadcast checkpoint

## Decisions Made

- Fixed at the two corner-specific window-entry sites rather than the shared `commonReset` block, exactly as the plan mandated — this keeps `lastDiceRoll` visible during the GK setup windows (deliberate, since neither has an Undo control) and leaves THROW_IN/GOAL_KICK unaffected.
- Did not touch `applyUndo`'s executable logic — read it first per the plan's `<read_first>` instruction, confirmed the LIFO stack already worked correctly against the 38-27 placement model, and proved it with test (c) instead of any code change. This confirms the regression was isolated entirely to the client-visible Undo-enablement guard being permanently blocked, not to any actual defect in the undo mechanics.
- Test (c) uses a genuinely two-DISTINCT-piece fixture rather than reusing the file's pre-existing `twoStageMovesRepositionState` (same piece, two moves) fixture, because the latter scenario is now unreachable in live play under the 38-27 `PIECE_LOCKED` guard — the plan explicitly flagged this as "the gap this task fills."
- Test (d)'s `THROW_IN` fixture uses a sideline exit hex (`{q:18, r:26}`, classified `SIDELINE` by `classifyExit`) rather than the byline coordinates used by this file's existing `CORNER_KICK`/`GOAL_KICK` fixtures, since `triggerOutOfBoundsRestart` requires a genuine `SIDELINE` classification to route into the `THROW_IN` branch being guarded.

## Deviations from Plan

None - plan executed exactly as written. Both edit sites, the doc-comment refresh, and all five test cases match the plan's `<action>` blocks and acceptance criteria precisely, including the explicit "do NOT touch `commonReset`" and "do NOT touch `applyUndo`'s executable statements" constraints.

## Issues Encountered

- The worktree had no `node_modules` installed (fresh worktree checkout) — ran `pnpm install` (~2m 41s) before any typecheck/test/lint command would run. Standard worktree setup, not a plan deviation.
- The session was interrupted by a usage-limit reset between Task 1's commit and the start of Task 2. On resume, `git log`/`git status` confirmed Task 1's commit (`a959d04`) was intact and the working tree was clean apart from in-progress Task 2 test edits already partially written; work continued from that exact point with no rework needed.
- No other issues — both tasks' automated verification commands passed on the first attempt after the fix/tests were written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Undo-enablement regression from `38-30-SUMMARY.md` bug 2 is fully fixed and regression-tested at both the engine level (LIFO multi-undo stack proven against the 38-27 placement model) and the socket level (real dice-driven corner award through to `CORNER_KICK_REPOSITION`).
- `CornerKickSetupPanel.tsx`'s existing `canUndoReposition`/`canUndoFinalSetup` client guards required no changes — they were correct all along; only the server-side state they read was ever wrong.
- Full server suite: 1034 passed / 1 skipped / 1 todo (up from 1029 pre-plan), 39 test files, no regressions. `pnpm --filter @counter-attack/server typecheck` clean. `pnpm --filter @counter-attack/shared build` clean.
- `38-32` (bug-1 triage — offside ring not reset after goal/kickoff-reset) and `38-33` (re-verification round 4) remain the next two plans in this gap-closure round per `7f5e07b`'s planning commit; this plan's fix should be included in the re-verification walkthrough's steps 6 and 7 (free-kick-style repositioning and pre-kick window/Undo).

---

_Phase: 38-corner-kick_
_Completed: 2026-08-09_

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.cornerKick.test.ts
- FOUND: packages/server/src/**tests**/cornerKick.integration.test.ts
- FOUND: .planning/phases/38-corner-kick/38-31-SUMMARY.md
- FOUND commit: a959d04
- FOUND commit: e1482f4
