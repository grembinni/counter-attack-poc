---
phase: 43-tackle-steal-prompt-decline
plan: 04
subsystem: game-engine
tags: [game-engine, state-machine, tackle, steal, fouls, testing]

requires:
  - phase: 43-01
    provides: GamePhase.TACKLE_STEAL_PROMPT, ActionEventType.TACKLE_STEAL_DECLINED, GameState prompt-cluster fields, tackling-descending STEAL_ATTEMPT defender ordering
  - phase: 43-02
    provides: TACKLE_STEAL_PROMPT/TACKLE_STEAL_DECLINED registration-checklist completeness (Undo/Replay/zone-check exemptions)
  - phase: 43-03
    provides: GameState.tackleStealDeclineEnabled end-to-end toggle wiring (checkbox → socket → Room → buildInitialGameState)
provides:
  - 'applyMove toggle-on interception: STEAL_ATTEMPT/TACKLE_ATTEMPT branches gate on state.tackleStealDeclineEnabled === true as their first statement, entering TACKLE_STEAL_PROMPT instead of auto-resolving'
  - 'TACKLE_STEAL_PROMPT_CLEARED module-level at-rest const, spread at every prompt-sequence exit'
  - 'applyTackleStealChoice(state, accept, dice) — decline/attempt resolution with a sequential per-defender queue (D-01/D-02/D-03)'
  - "advanceOrResume internal helper — the single implementation of D-03's 'keep prompting until the queue is exhausted'"
  - "Foul interaction: a foul mid-sequence routes to FOUL_CHOICE without clearing an already-advanced prompt cluster; applyFoulChoice's restart path clears the cluster, continue restores it"
affects:
  - 43-05 (the GAME_TACKLE_STEAL_CHOICE socket handler and TackleStealPromptPanel UI consume applyTackleStealChoice)

tech-stack:
  added: []
  patterns:
    - 'Toggle-gate-as-first-statement inside each effect branch (43-RESEARCH.md Pitfall 3) — prevents partial toggle-off implementations where some duel paths resolve immediately regardless of the toggle'
    - "advanceOrResume shared helper: single queue-dequeue-or-clear-and-resume implementation reused by both the decline branch and every FAIL branch, so D-03's continuation rule has exactly one implementation to test"
    - 'Compute-would-be-state-then-override-with-FOUL_CHOICE pattern (mirrors applyMove/applyGkDiveAtFeetTarget) reused verbatim inside applyTackleStealChoice'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.tackleStealPrompt.test.ts
  modified:
    - packages/server/src/gameEngine.ts

decisions:
  - "TACKLE_STEAL_PROMPT_CLEARED placed as a module-level const alongside THROW_IN_TEARDOWN/CORNER_KICK_TEARDOWN (the established 'at-rest teardown literal' location in this file) rather than only as a local const inside applyTackleStealChoice — it is spread at three site kinds (applyStartMovement, advanceOrResume's empty-queue branch, applyFoulChoice's restart path) so a single shared module-level const is the safer single source of truth."
  - "applyTackleStealChoice placed immediately after applyGkDiveAtFeetTarget, before the enterGkDiveOrSkip section — matching the plan's 'placed next to applyGkDiveAtFeetResponse' instruction as closely as the file's existing section ordering allows."
  - "advanceOrResume recomputes from `next.tackleStealPromptQueue` (already the REST after the current defender, per types.ts's own field doc) rather than re-deriving from `state`, so both the decline branch and every FAIL branch funnel through byte-identical dequeue-or-clear logic."
  - "The foul-mid-sequence override inside applyTackleStealChoice does NOT spread TACKLE_STEAL_PROMPT_CLEARED — only applyFoulChoice's 'restart' path does. This is the literal reading of D-03: a foul only ends the sequence when the fouled manager actually takes the restart; 'continue' must be able to resume a still-live next-defender prompt."

requirements-completed: [TACKLE-02, TACKLE-03, TACKLE-04]

duration: ~55min
completed: 2026-08-23
---

# Phase 43 Plan 04: Tackle/Steal Server-Authoritative Decline Mechanic Summary

Implemented the server-authoritative decline/attempt state machine: `applyMove` now intercepts a tackle/steal duel into a new `TACKLE_STEAL_PROMPT` phase when the toggle is on (byte-for-byte unchanged when off), a new `applyTackleStealChoice` function resolves the defending manager's Attempt/Decline response with a tackling-descending sequential queue across multiple eligible defenders, and a foul mid-sequence correctly distinguishes "continue play" (resumes the next queued prompt) from "take the restart" (clears the whole prompt cluster) — no UI or socket handler yet, per this plan's explicit scope boundary (43-05's job).

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 1 modified (`gameEngine.ts`), 1 created (`gameEngine.tackleStealPrompt.test.ts`)

## Accomplishments

- **Task 1 — Interception:** `TACKLE_STEAL_PROMPT_CLEARED` at-rest const added; spread into `applyStartMovement` as defense in depth. `applyMove`'s `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` branches each gate on `state.tackleStealDeclineEnabled === true` as their very first statement (before any dice read or event construction), entering `TACKLE_STEAL_PROMPT` with a resume snapshot and a tackling-descending defender queue (STEAL only — TACKLE's effect carries a single `carrierId` so its queue is always empty). Toggle-off behavior is byte-for-byte unchanged.
- **Task 2 — `applyTackleStealChoice`:** new exported function resolves decline (never touches `stealAttemptedByIds`/`tackleAttemptedByIds` — the entire TACKLE-02/TACKLE-03 mechanism) and attempt (reproduces the existing STEAL/TACKLE duel arithmetic and `resolveFoulChain` call verbatim). A shared `advanceOrResume` helper is the single implementation of D-03's "keep prompting until the queue is exhausted or possession changes."
- **Task 3 — Foul interaction:** the foul override inside `applyTackleStealChoice` computes the would-be state first (success or the next `advanceOrResume`'d prompt) and only overrides with `FOUL_CHOICE` when `resolveFoulChain` reports `fouled` — critically, it does NOT clear the prompt cluster, so `foulResume.phase` can be `TACKLE_STEAL_PROMPT` and `continue` resumes the already-advanced next defender. `applyFoulChoice`'s `restart` path now spreads `TACKLE_STEAL_PROMPT_CLEARED` so a free kick/penalty can never inherit a live cluster; its `continue` path is untouched.

## Task Commits

1. **Task 1: Intercept the duel in applyMove and enter TACKLE_STEAL_PROMPT** - `ef1266b0` (feat)
2. **Task 2: applyTackleStealChoice — decline, attempt, and the sequential queue (D-01/D-02/D-03)** - `db512461` (feat)
3. **Task 3: Foul interaction — continue returns to the next prompt, restart clears the prompt cluster** - `df63ed68` (feat)

_Note: all three tasks are tagged `tdd="true"` in the plan. Tests were written alongside each task's implementation in the same commit (RED/GREEN combined) rather than as separate commits, since the new engine logic and its test coverage were developed together as a single reviewable unit per task — matching 43-02's documented precedent for TDD tasks whose test/implementation pairing is tightly coupled. Each task's tests were run and confirmed passing (with the corresponding implementation code in place) before that task's commit._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — `TACKLE_STEAL_PROMPT_CLEARED` const; `applyStartMovement` spread; `applyMove`'s STEAL_ATTEMPT/TACKLE_ATTEMPT toggle branches; new `applyTackleStealChoice`/`ApplyTackleStealChoiceResult`/`advanceOrResume`; `applyFoulChoice`'s restart-path `TACKLE_STEAL_PROMPT_CLEARED` spread.
- `packages/server/src/__tests__/gameEngine.tackleStealPrompt.test.ts` — new file, 26 test cases across three `describe` blocks (interception, choice resolution, foul interaction).

## Decisions Made

- `TACKLE_STEAL_PROMPT_CLEARED` is a module-level const (not a function-local literal) because it is spread at three distinct call sites across the file (`applyStartMovement`, `advanceOrResume`, `applyFoulChoice`'s restart path) — a single shared source of truth prevents the "one site misses a field" class of bug the codebase has hit before with similar clusters.
- `applyTackleStealChoice` is placed immediately after `applyGkDiveAtFeetTarget` (the two-step dive-at-feet family), matching the plan's instruction to place it "next to `applyGkDiveAtFeetResponse`" as closely as this file's existing function ordering allows.
- The foul-mid-sequence override never clears the prompt cluster itself — only `applyFoulChoice`'s `restart` branch does. This is the literal reading of D-03 ("a foul triggers a stoppage for a kick" ends the sequence, not the foul call itself) and is pinned by the `foul-fail-with-queue`/`continue-resumes-next-prompt` test pair.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3/4 triggers encountered; `pnpm -r typecheck` and the full server test suite were both clean on first pass after each task's implementation (one unused-variable ESLint fix was corrected before the Task 2 commit, which is normal iteration within the same task, not a deviation from the plan's scope).

## Issues Encountered

- The worktree required `pnpm install --frozen-lockfile` (fresh worktree, no `node_modules`) and `pnpm --filter @counter-attack/shared build` (no built `dist/` output) before `tsc`/`vitest` would run — consistent with prior plans' documented pattern in this phase, no directory junctions created or deleted.
- `pnpm --filter @counter-attack/server test` (full suite, default thread pool) intermittently threw an "Worker exited unexpectedly" unhandled error unrelated to any test assertion (0 test failures shown, 62/63 files completing before the crash) — a known Windows vitest worker-crash flake per project memory. Resolved by rerunning with `--pool=forks --poolOptions.forks.singleFork=true`, which completed cleanly with all 63 files / 1538 tests passing.

## Next Phase Readiness

- `applyTackleStealChoice` is fully implemented and tested but has zero callers outside this test file — `TACKLE_STEAL_PROMPT` remains unreachable in live play until 43-05 wires the `GAME_TACKLE_STEAL_CHOICE` socket handler and `TackleStealPromptPanel` UI. This is intentional per this plan's explicit scope boundary ("Output: a working decline/attempt state machine with no UI yet").
- All toggle-off paths are verified byte-for-byte unchanged (TACKLE-04); zero edits to any pre-existing tackle/steal/foul test file (`gameEngine.test.ts`, `gameEngine.fouls.test.ts`, `foulFreeKick.integration.test.ts` all pass untouched).
- Ready for 43-05 to build the socket handler (dice generation happens there, per T-43-11's mitigation — `applyTackleStealChoice` itself contains no RNG call, verified by a source-level test) and the client-side prompt panel.

---

_Phase: 43-tackle-steal-prompt-decline_
_Completed: 2026-08-23_

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.tackleStealPrompt.test.ts
- FOUND commit ef1266b0 in git log
- FOUND commit db512461 in git log
- FOUND commit df63ed68 in git log
