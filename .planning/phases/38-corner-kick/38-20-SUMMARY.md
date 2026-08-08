---
phase: 38-corner-kick
plan: 20
subsystem: game-engine
tags: [corner-kick, gap-closure, restart-flow, exclusion-zone]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 15)
    provides: human-verifier-reported defect 3 (mandatory pre-corner clear-out; permanent no-defender-within-3-hexes rule) that this plan closes
  - phase: 38-corner-kick (plan 16)
    provides: CORNER_KICK_CLEAR_OUT GamePhase/CORNER_KICK_CLEAR_OUT_MOVE ActionEventType, cornerKickClearOutSlot GameState field, and the shared outOfBounds.ts helpers (CORNER_EXCLUSION_RADIUS, isWithinCornerExclusionZone, cornerClearOutGoalHex, isLegalClearOutStep) this plan consumes
  - phase: 38-corner-kick (plan 17)
    provides: the applyCornerKickReposition/applyCornerKickStageEnd shape this plan's exclusion guard and cornerKickClearOutSlot teardown discipline mirror
provides:
  - applyCornerKickClearOut(state, pieceId, to) and applyCornerKickClearOutEnd(state, team) — the two engine entry points for the mandatory pre-corner clear-out step
  - hasLegalClearOutMove(state, piece) — module-private deadlock-escape helper backing the confirm gate
  - triggerOutOfBoundsRestart's CORNER_KICK branch now enters CORNER_KICK_CLEAR_OUT (attacking slot active) instead of CORNER_KICK_GK_SETUP_ATTACKING directly
  - CORNER_EXCLUSION_ZONE rejection reason + guard on applyCornerKickGkPlace, applyCornerKickReposition, and applyCornerKickFinalMove — no defender may end a move inside the 3-hex zone at any point in the corner sequence
  - CORNER_KICK_CLEAR_OUT registered in ZONE_CHECK_EXEMPT_PHASES; CORNER_KICK_CLEAR_OUT_MOVE registered in buildReplayFrames' direct piece-position-tracking branch; cornerKickClearOutSlot registered in CORNER_KICK_TEARDOWN and the applyCornerKickFinalSetupEnd terminal PASS return
affects:
  [
    38-21 (socket wiring for CORNER_KICK_CLEAR_OUT — gameHandlers.ts is untouched by this plan,
    deliberately),
    38-22 (client destination-hex highlighting for the clear-out,
    consuming isLegalClearOutStep),
    38-24 (human verifier checkpoint — should confirm the clear-out UX once 38-21/38-22 land),
  ]
requirements-completed: [OOB-03, CORNER-01, CORNER-02, CORNER-03, CORNER-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One phase value plus a slot field (cornerKickClearOutSlot: 'ATTACKER' | 'DEFENDER'), not a second _ATTACKING/_DEFENDING phase pair — mirrors cornerKickMoveSlot's shape, keeping the new GamePhase registration surface to one value"
    - "The completion gate and the move guard both read isLegalClearOutStep as the single source of truth (via hasLegalClearOutMove and the move guard's own inline check respectively) so they can never disagree about what 'still has a move' means — the deadlock-escape contract"
    - "Each of the three later exclusion guards derives 'defending side' from its own function's existing acting-side computation (side / actingTeam / cornerKickMoveSlot) — never from activeTeam (T-38-10 precedent)"

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
    - packages/server/src/__tests__/cornerKick.integration.test.ts

key-decisions:
  - "The clear-out is not undoable — CORNER_KICK_CLEAR_OUT is deliberately absent from validUndoPhases (gameHandlers.ts), joining CORNER_KICK_GK_SETUP_ATTACKING/DEFENDING/TAKER_SELECT. gameHandlers.ts was not modified by this plan, so this is a null action (the phase was never added there) that is nonetheless the correct design per the plan's own instruction — confirmed as a no-op finding in the STATE.md registration audit below."
  - "The exclusion zone is NOT enforced on intermediate clear-out steps — a piece starting inside the zone is, by definition, inside it on its first step too; enforcing the zone there would make the clear-out impossible. The zone is enforced only by applyCornerKickClearOutEnd's completion gate and the three later-phase guards (GK place, reposition, final move)."
  - "hasLegalClearOutMove is a module-private (non-exported) helper, matching the plan's 'module-level helper' framing — it is consumed only by applyCornerKickClearOutEnd; applyCornerKickClearOut's own step guard re-derives the same geometry inline against the caller's specific target rather than calling the helper, but both paths bottom out in the same shared isLegalClearOutStep call."
  - "Deadlock-escape test fixture: a piece at the literal grid corner of the pitch has 4 of 6 neighbors off-pitch by construction; the one remaining geometrically-legal neighbor is explicitly occupied by a second piece in the test, so the 'no legal step' condition is proven by both off-pitch exhaustion AND occupancy, not by geometry alone."

patterns-established: []

# Metrics
duration: ~40min
completed: 2026-08-08
---

# Phase 38 Plan 20: CORNER_KICK_CLEAR_OUT — mandatory pre-corner clear-out and permanent defender exclusion zone Summary

**Every corner now opens in a mandatory two-slot clear-out (`applyCornerKickClearOut`/`applyCornerKickClearOutEnd`) that walks in-zone pieces goal-ward before either goalkeeper is repositioned, and a permanent `CORNER_EXCLUSION_ZONE` guard now blocks a defender from ending a GK placement, reposition, or pre-kick move inside the 3-hex zone at any later point in the sequence — closing 38-15 defect 3, the largest-scope item of the four gap-closure defects.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-08
- **Tasks:** 3/3 completed
- **Files modified:** 4 (`gameEngine.ts` + 3 test files)

## Accomplishments

- `triggerOutOfBoundsRestart`'s `CORNER_KICK` branch now enters `CORNER_KICK_CLEAR_OUT` with `cornerKickClearOutSlot: 'ATTACKER'` instead of landing directly in `CORNER_KICK_GK_SETUP_ATTACKING` — the attacking manager clears out first, matching D-03's attacker-first convention.
- `applyCornerKickClearOut(state, pieceId, to)` moves an in-zone piece one hex per click, guarded (in order) by phase/context, piece lookup, team ownership, zone eligibility (`NOT_ELIGIBLE` once a piece has cleared the zone — this is what bounds the step and prevents free movement), adjacency, target legality, and finally the shared `isLegalClearOutStep` direction rule (`NOT_TOWARD_GOAL`). Appends its own `CORNER_KICK_CLEAR_OUT_MOVE` event, mirroring `applyCornerKickFinalMove` rather than `applyCornerKickReposition`.
- `applyCornerKickClearOutEnd(state, team)` gates confirmation on every in-zone piece of `team` having no legal step remaining (`hasLegalClearOutMove`) — a trapped piece does not block the confirm (the deadlock escape, T-38-68). The `'ATTACKER'` slot advances to `'DEFENDER'`; the `'DEFENDER'` slot hands off into `CORNER_KICK_GK_SETUP_ATTACKING` with the slot cleared, reproducing exactly the state `triggerOutOfBoundsRestart` used to produce directly before this plan.
- `CORNER_EXCLUSION_ZONE` added as a rejection reason and guard to all three of `applyCornerKickGkPlace`, `applyCornerKickReposition`, and `applyCornerKickFinalMove` — each derives "defending side" from its own existing acting-side computation (`side`, `actingTeam`, `cornerKickMoveSlot` respectively), never from `activeTeam` (T-38-10 precedent), and each guard sits immediately after the function's existing occupancy check so the more specific reason wins.
- `CORNER_KICK_CLEAR_OUT` registered in `ZONE_CHECK_EXEMPT_PHASES`; `CORNER_KICK_CLEAR_OUT_MOVE` registered in `buildReplayFrames`' direct piece-position-tracking branch (carries no `ballAfter`, deliberately excluded from `REPLAY_ELIGIBLE_TYPES`, matching `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE`); `cornerKickClearOutSlot: null` registered in `CORNER_KICK_TEARDOWN` and defensively re-asserted at `applyCornerKickFinalSetupEnd`'s terminal `PASS` return.
- 24 new engine tests added (`CORNER_KICK_CLEAR_OUT (38-15 defect 3)` describe block) covering the clear-out entry, the full `applyCornerKickClearOut` guard order, the completion gate and its deadlock escape, the slot handoff, and both the rejection and attacking-side-unrestricted mirror case for the exclusion zone across all three later corner movement surfaces.
- 12 pre-existing tests re-expected (not deleted) across three files to assert the new `CORNER_KICK_CLEAR_OUT` entry point instead of the old direct `CORNER_KICK_GK_SETUP_ATTACKING` landing, including the widely-reused `runCornerSequenceToPass` helper (now drives through both `applyCornerKickClearOutEnd` confirms) and the socket-level `driveLooseBallToCorner` helper (now stops at `CORNER_KICK_CLEAR_OUT`, since the socket handler for confirming it doesn't exist until 38-21).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the CORNER_KICK_CLEAR_OUT entry and its two engine transitions** - `21e3ebc` (feat)
2. **Task 2: Enforce the permanent defender exclusion zone and register the new phase and event** - `f52969d` (feat)
3. **Task 3: Engine tests for the clear-out sequence and the exclusion zone** - `f6307cc` (test)

_Note: SUMMARY.md is committed separately below (worktree parallel-executor mode — orchestrator owns STATE.md/ROADMAP.md updates after merge)._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — `triggerOutOfBoundsRestart`'s `CORNER_KICK` branch retargeted to `CORNER_KICK_CLEAR_OUT`; `hasLegalClearOutMove`, `applyCornerKickClearOut`, `applyCornerKickClearOutEnd` added; `CORNER_EXCLUSION_ZONE` guard added to `applyCornerKickGkPlace`/`applyCornerKickReposition`/`applyCornerKickFinalMove`; `ZONE_CHECK_EXEMPT_PHASES`, `buildReplayFrames`, `CORNER_KICK_TEARDOWN`, and `applyCornerKickFinalSetupEnd` updated for the new phase/event/field.
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` — new `CORNER_KICK_CLEAR_OUT (38-15 defect 3)` describe block (24 tests); `runCornerSequenceToPass` now drives through both clear-out confirms; two `triggerOutOfBoundsRestart` team-inversion tests and the spilled-save test re-expected to assert the clear-out entry.
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` — the OOB-03 wiring-guard test re-expected to assert `CORNER_KICK_CLEAR_OUT`.
- `packages/server/src/__tests__/cornerKick.integration.test.ts` — `driveLooseBallToCorner`'s loop condition and its dependent socket-level test re-expected to stop at `CORNER_KICK_CLEAR_OUT` (no socket handler for it exists yet — see Verification below).

## Decisions Made

See `key-decisions` in frontmatter above. All were dictated by the plan's explicit `<action>`/design-decision text; the STATE.md per-list registration audit below required independent verification of each named list against the actual codebase.

### STATE.md registration audit (Task 2, step 5 — explicit per-list verdict)

| List                                                              | Change needed?                     | Why                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ELIGIBLE_NEXT_ACTIONS` (`packages/shared/src/actionSequence.ts`) | No                                 | `CORNER_KICK_CLEAR_OUT_MOVE` is not a `lastActionType` that feeds next-action sequencing — mirrors the existing `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE` precedent, neither of which appears in this table. Only `CORNER_KICK_RESTART` (the terminal `lastActionType` set at the `PASS` handoff) is registered, and this plan does not touch that transition.                                       |
| `REPLAY_ELIGIBLE_TYPES`                                           | No (explicitly excluded, verified) | `CORNER_KICK_CLEAR_OUT_MOVE` carries no `ballAfter` (the ball is stationary at the corner flag during clear-out) — same exclusion rationale as `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE`.                                                                                                                                                                                                            |
| `buildReplayFrames`'s branches                                    | Yes — done                         | Added to the WR-01 direct piece-position-tracking branch (`current.pieces` mutated in place, no frame emitted) alongside `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE`, so a cleared-out piece does not snap back to its pre-clear-out hex later in the replay.                                                                                                                                          |
| `applyUndo`'s `moveTypeForPhase` scan                             | No                                 | The clear-out is explicitly not undoable (design decision, mirrors the GK setup windows and taker select). `moveTypeForPhase` is only consulted when `validUndoPhases` (below) has already gated the phase through — since `CORNER_KICK_CLEAR_OUT` is absent there, `applyUndo` can never be invoked with that phase over the socket, and no `CORNER_KICK_CLEAR_OUT` branch is needed in the switch. |
| `applyUndo`'s `isBoundary` scan                                   | No                                 | Same reasoning — Undo never runs during `CORNER_KICK_CLEAR_OUT`, so no boundary term is needed for its move event.                                                                                                                                                                                                                                                                                   |
| `validUndoPhases` (`gameHandlers.ts`)                             | No (verified absent)               | `gameHandlers.ts` is unmodified by this plan (explicit plan requirement). `CORNER_KICK_CLEAR_OUT` was never added to `validUndoPhases`, which is the correct end state — confirmed by inspection, not just by omission.                                                                                                                                                                              |
| `ZONE_CHECK_EXEMPT_PHASES`                                        | Yes — done                         | Added; a corner clear-out happens immediately next to a byline, always inside a final third, for the identical 38-05 reason the other five corner phases are already listed.                                                                                                                                                                                                                         |

## Deviations from Plan

None — plan executed as written. The three test-file edits beyond the plan's declared `files_modified` (`gameEngine.outOfBounds.test.ts`, `cornerKick.integration.test.ts`) are directly required by the plan's own verification gate ("run the full server suite and re-expect every pre-existing test that asserted the corner award landed directly in `CORNER_KICK_GK_SETUP_ATTACKING`"), which is not scoped to a single file — the same pattern 38-17 followed for an analogous test-breakage situation.

## Issues Encountered

None. The worktree needed a fresh `pnpm install --frozen-lockfile` plus `pnpm --filter @counter-attack/shared build` at session start (no `node_modules`/`dist` present) — a standard workspace-bootstrap step, not a package addition, and no `package.json` changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `applyCornerKickClearOut`/`applyCornerKickClearOutEnd` are fully proven at the engine level (24 new tests) and reachable by any caller that constructs the right `GameState`, but **`packages/server/src/gameHandlers.ts` is unchanged by this plan** — there is no `GAME_CORNER_KICK_CLEAR_OUT`/`GAME_CORNER_KICK_CLEAR_OUT_END` socket handler yet. A real corner award over the socket now stops at `CORNER_KICK_CLEAR_OUT` and cannot currently be advanced past it by a client. This is expected and is 38-21's scope (confirmed via `cornerKick.integration.test.ts`'s `driveLooseBallToCorner`, which now stops at the clear-out entry rather than looping to a phase it can never reach).
- `packages/shared` and every `packages/client` file are unchanged by this plan (verified via `git diff --stat` against the pre-plan commit) — the client destination-hex highlighting for the clear-out (38-22) can consume `isLegalClearOutStep` from `packages/shared/src/outOfBounds.ts` (added in 38-16) without any further shared-package changes from this plan.
- Full server suite: 1028 passed (up from 1004 pre-plan baseline), 1 skipped, 1 todo (1030 total) — no test deleted, no test case removed. `pnpm --filter @counter-attack/server typecheck` exits 0.
- No blockers for 38-21 (socket wiring) or 38-22 (client clear-out UI), both of which can now build directly on `applyCornerKickClearOut`/`applyCornerKickClearOutEnd` and the `CORNER_EXCLUSION_ZONE` reason.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.cornerKick.test.ts
- FOUND: packages/server/src/**tests**/gameEngine.outOfBounds.test.ts
- FOUND: packages/server/src/**tests**/cornerKick.integration.test.ts
- FOUND: .planning/phases/38-corner-kick/38-20-SUMMARY.md
- FOUND: 21e3ebc (Task 1 commit)
- FOUND: f52969d (Task 2 commit)
- FOUND: f6307cc (Task 3 commit)
- `pnpm --filter @counter-attack/server typecheck` exits 0
- `pnpm --filter @counter-attack/server test` — 39/39 files, 1028 passed, 1 skipped, 1 todo (1030 total; baseline before this plan's test additions was 1004)
