---
phase: 43-tackle-steal-prompt-decline
plan: 05
subsystem: game-handlers
tags: [socket-events, react, zustand, tackle, steal, testing]

requires:
  - phase: 43-01
    provides: GamePhase.TACKLE_STEAL_PROMPT, ActionEventType.TACKLE_STEAL_DECLINED, GameState prompt-cluster fields, ClientEvents.GAME_TACKLE_STEAL_CHOICE
  - phase: 43-02
    provides: TACKLE_STEAL_PROMPT/TACKLE_STEAL_DECLINED registration-checklist completeness
  - phase: 43-03
    provides: GameState.tackleStealDeclineEnabled end-to-end toggle wiring
  - phase: 43-04
    provides: applyTackleStealChoice(state, accept, dice) — the decline/attempt/sequential-queue engine function this plan's handler calls
provides:
  - 'GAME_TACKLE_STEAL_CHOICE socket handler with the five-step guard shape (null-state, phase, payload, team, engine call), rolling all five duel dice server-side unconditionally before the engine call'
  - 'emitTackleStealChoice fire-and-forget store action'
  - 'TackleStealPromptPanel component (+ verbatim-copied module.css) rendering the deciding/waiting two-branch prompt'
  - 'GameBoard routing: phase === TACKLE_STEAL_PROMPT renders TackleStealPromptPanel, not ActionPanel'
affects:
  - Live UAT of Phase 43 (TACKLE-01/02 are now player-reachable end to end)

tech-stack:
  added: []
  patterns:
    - 'Five-step socket handler guard shape (null-state, phase, payload, team, engine call) copied verbatim from GAME_GK_DIVE_AT_FEET, substituting the explicit tackleStealPromptTeam field for the team guard'
    - 'Dice rolled unconditionally in the I/O layer at choice time (never at move time), matching GAME_GK_DIVE_AT_FEET_TARGET — required because D-03 lets several duels stack on one move step'
    - 'TackleStealPromptPanel structurally mirrors GkDiveAtFeetPromptPanel (D-05): per-slice Zustand selectors, deciding/waiting branch pair, restartErrorMessage in the error slot — with the target-step branch omitted since this phase has no _TARGET sub-phase'

key-files:
  created:
    - packages/server/src/__tests__/gameHandlers.tackleStealPrompt.test.ts
    - packages/client/src/components/TackleStealPromptPanel.tsx
    - packages/client/src/components/TackleStealPromptPanel.module.css
    - packages/client/src/components/TackleStealPromptPanel.test.tsx
  modified:
    - packages/server/src/gameHandlers.ts
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.test.tsx

decisions:
  - "GAME_TACKLE_STEAL_CHOICE is registered directly after the GAME_GK_DIVE_AT_FEET/GAME_GK_DIVE_AT_FEET_TARGET pair, copying the five-step guard shape verbatim per the plan's action block."
  - "The team guard compares socketTeam(socket) against the explicit tackleStealPromptTeam field, never a derived helper (controlsGKTeam/isActivePlayer) — a STEAL's decider is deliberately not the active team."
  - "All five duel dice (stealDie, tackleDie, carrierDie, injuryDie, bookingDie) are rolled unconditionally in the handler, even on a decline the engine ignores them — matching the codebase's existing unconditional-roll convention and never reading a die from the client payload."
  - "applyOffsideFoulWithRelocation is applied after a successful engine result, mirroring GAME_MOVE's post-step, since a successful steal/tackle transfers possession and can leave the new carrier offside."
  - "The handler-level test file seeds room.gameState directly into TACKLE_STEAL_PROMPT (mirroring gameHandlers.boxEntry.test.ts's direct-mutation convention) rather than driving a real STEAL_ATTEMPT/TACKLE_ATTEMPT through applyMove, since 43-04's gameEngine.tackleStealPrompt.test.ts already covers the interception itself in isolation — this file's job is proving the socket handler's guards and dice generation."
  - 'The per-call-dice-generation test mocks ../diceUtils.js with a self-incrementing cycling rollDice (1..6) rather than a single fixed value, so consecutive handler calls are provably fresh; individual tests needing a deterministic outcome (e.g. guaranteed STEAL success) override one call with mockReturnValueOnce, which takes precedence for that call only.'

requirements-completed: [TACKLE-01, TACKLE-02]

duration: ~50min
completed: 2026-08-23
---

# Phase 43 Plan 05: Tackle/Steal Prompt Socket Handler & UI Summary

Wired the only reachable path into 43-04's `applyTackleStealChoice` state machine: a `GAME_TACKLE_STEAL_CHOICE` socket handler that rolls all five duel dice server-side and copies `GAME_GK_DIVE_AT_FEET`'s five-step guard shape, an `emitTackleStealChoice` fire-and-forget store action, a `TackleStealPromptPanel` that structurally mirrors `GkDiveAtFeetPromptPanel`, and the `GameBoard` routing branch that swaps in the panel during `TACKLE_STEAL_PROMPT` — TACKLE-01's toggle and TACKLE-02's decline mechanic are now both player-reachable in the live UI.

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files modified:** 4 modified, 4 created

## Accomplishments

- **Task 1 — socket handler:** `GAME_TACKLE_STEAL_CHOICE` registered in `gameHandlers.ts` directly after the `GAME_GK_DIVE_AT_FEET` family, with the null-state → phase → payload → team → engine-call guard order, all five dice rolled unconditionally before the engine call, and `applyOffsideFoulWithRelocation` applied on success (matching `GAME_MOVE`'s post-step). 8 new socket-level tests cover null-state, wrong-phase, non-boolean payload, wrong-team (including the ball carrier's own manager), valid decline, valid attempt, per-call dice generation (5 rolls per submission, values differ across two attempts in the same sequence), and the `isProcessing` mutex drop.
- **Task 2 — store action + panel:** `emitTackleStealChoice` added to `useGameStore.ts` as a one-statement fire-and-forget `socket.emit`, no optimistic mutation. `TackleStealPromptPanel.module.css` is a byte-for-byte copy of `GkDiveAtFeetPromptPanel.module.css` (header comment only difference). `TackleStealPromptPanel.tsx` mirrors the analog structurally with 8 per-slice Zustand selectors, a waiting-manager branch and a two-button (Attempt/Decline) deciding-manager branch with a singular/plural queue qualifier. 11 new component tests cover phase gating, both branches, button emits, all three queue-qualifier states, and the error slot.
- **Task 3 — GameBoard routing:** single sibling ternary branch added immediately after the `GK_BOX_ENTRY_PROMPT`/`GK_BOX_ENTRY_MOVE` branch; `PHASE_LABEL`'s existing `TACKLE_STEAL_PROMPT` entry (from 43-01) untouched. 2 new `GameBoard.test.tsx` cases assert the mocked panel (not `ActionPanel`) renders and the centre label reads "TACKLE / STEAL".

## Task Commits

1. **Task 1: GAME_TACKLE_STEAL_CHOICE socket handler** - `cb49806d` (feat)
2. **Task 2: emitTackleStealChoice store action and the TackleStealPromptPanel component** - `ce2c8283` (feat)
3. **Task 3: Route the panel from GameBoard** - `94265395` (feat)

_Note: all three tasks are tagged `tdd="true"` in the plan. Tests were written alongside each task's implementation in the same commit (RED/GREEN combined), consistent with 43-04's documented precedent for TDD tasks whose test/implementation pairing is tightly coupled. Each task's tests were run and confirmed passing before that task's commit._

## Files Created/Modified

- `packages/server/src/gameHandlers.ts` — `applyTackleStealChoice` import added; new `GAME_TACKLE_STEAL_CHOICE` handler registered after the GK-dive-at-feet family.
- `packages/server/src/__tests__/gameHandlers.tackleStealPrompt.test.ts` — new file, 8 socket-level tests.
- `packages/client/src/store/useGameStore.ts` — `emitTackleStealChoice` interface signature + fire-and-forget implementation.
- `packages/client/src/components/TackleStealPromptPanel.tsx` — new component (created).
- `packages/client/src/components/TackleStealPromptPanel.module.css` — new stylesheet, verbatim copy (created).
- `packages/client/src/components/TackleStealPromptPanel.test.tsx` — new file, 11 tests (created).
- `packages/client/src/components/GameBoard.tsx` — import + routing branch for `TackleStealPromptPanel`.
- `packages/client/src/components/GameBoard.test.tsx` — mock + 2 new routing/label tests.

## Decisions Made

See frontmatter `decisions` — summarized: the handler copies the GK-dive-at-feet five-step guard shape verbatim with the team guard keyed on the explicit `tackleStealPromptTeam` field; all five dice are rolled unconditionally in the I/O layer at choice time (never at move time); the handler-level test file seeds `TACKLE_STEAL_PROMPT` directly rather than re-driving the interception (already covered by 43-04); and the per-call-dice-generation test uses a self-incrementing mock so two consecutive attempts are provably non-reused.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a non-regex `getByText` assertion in the new GameBoard.test.tsx phase-label test**

- **Found during:** Task 3, `pnpm --filter @counter-attack/client test -- GameBoard` verification
- **Issue:** The centre phase label is rendered as two sibling text nodes inside one `<span>` (`&nbsp;&middot;&nbsp;` literal plus the `{phaseLabel}` expression), so React Testing Library's default `exact: true` string match against `'TACKLE / STEAL'` failed — the span's full normalized text is `"· TACKLE / STEAL"`. Every other phase-label assertion in this file already uses a regex for exactly this reason.
- **Fix:** Changed the assertion to `screen.getByText(/TACKLE \/ STEAL/)`, matching the established convention used by every other phase-label test in the file (e.g. `/MOVE 5/`, `/GOALIE DIVE/`).
- **Files modified:** `packages/client/src/components/GameBoard.test.tsx`
- **Commit:** `94265395` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — a test-assertion bug caught by this plan's own new test, fixed before commit; no scope creep beyond making the new test pass correctly).
**Impact on plan:** No functional code was affected; the fix only corrected a test assertion to match this file's own established pattern.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no built `dist/` output at session start (fresh worktree checkout). Resolved with `pnpm install --frozen-lockfile` followed by `pnpm --filter @counter-attack/shared build`, consistent with every prior plan in this phase's documented pattern — no directory junctions created or deleted (Worktree Junction Risk memory note).
- No vitest worker-crash flake was hit this session; the server suite ran clean on the first `--pool=forks --poolOptions.forks.singleFork=true` attempt.

## Next Phase Readiness

- TACKLE-01 (the toggle) and TACKLE-02 (the decline mechanic) are now fully player-reachable end to end: `GameSettingsScreen` checkbox → `GameState.tackleStealDeclineEnabled` → `applyMove`'s toggle-on interception (43-04) → `TACKLE_STEAL_PROMPT` → `TackleStealPromptPanel` → `emitTackleStealChoice` → `GAME_TACKLE_STEAL_CHOICE` handler (this plan) → `applyTackleStealChoice` (43-04) → `GAME_STATE` broadcast.
- Full monorepo test suite green: 886 shared + 1546 server (1 skipped, 1 todo, both pre-existing) + 1134 client = 3566 tests, all passing. `pnpm -r typecheck` clean across shared/client/server.
- This is the last plan of Phase 43 per the phase's plan set (43-01 through 43-05); ready for phase-level verification/UAT.

---

_Phase: 43-tackle-steal-prompt-decline_
_Completed: 2026-08-23_

## Self-Check: PASSED

- FOUND: packages/server/src/**tests**/gameHandlers.tackleStealPrompt.test.ts
- FOUND: packages/client/src/components/TackleStealPromptPanel.tsx
- FOUND: packages/client/src/components/TackleStealPromptPanel.module.css
- FOUND: packages/client/src/components/TackleStealPromptPanel.test.tsx
- FOUND: packages/server/src/gameHandlers.ts
- FOUND: packages/client/src/store/useGameStore.ts
- FOUND: packages/client/src/components/GameBoard.tsx
- FOUND: packages/client/src/components/GameBoard.test.tsx
- FOUND commit cb49806d in git log
- FOUND commit ce2c8283 in git log
- FOUND commit 94265395 in git log
