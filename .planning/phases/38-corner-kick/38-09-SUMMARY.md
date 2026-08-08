---
phase: 38-corner-kick
plan: 09
subsystem: verification
tags: [human-verify, checkpoint, rules-fidelity, gap-closure]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: 38-01..38-08 — full Corner Kick implementation and integration coverage
affects: [38-gap-closure]
requirements-completed: []

# Metrics
duration: n/a (human verification checkpoint)
completed: 2026-08-07
---

# Phase 38 Plan 09: Human Verification Checkpoint Summary

**Checkpoint outcome: ISSUES FOUND — full two-browser walkthrough deferred by the human verifier until gap-closure lands.**

## Rulebook Assumption Verdicts

| Assumption                                                                      | Verdict                 | Detail                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** — uncapped goalkeeper reposition (CORNER-01)                             | **CONFIRMED**           | Matches implementation as shipped: the keeper may be placed on any legal empty hex, no cap.                                                                                                                                                                                                             |
| **A2** — corner passes are not interceptable                                    | **CORRECTED (partial)** | Low Pass corners **should be interceptable** — implementation currently treats both options as non-interceptable, which is wrong for Low Pass. High Pass corners are **confirmed non-interceptable**, resolved via the standard header contest — that half of the assumption is correct as implemented. |
| **A4** — corner-taker and both goalkeepers excluded from the reposition windows | **CONFIRMED**           | Matches implementation as shipped.                                                                                                                                                                                                                                                                      |

## Additional Issue Found (out of Phase 38's authored code, folded into this phase's gap closure by explicit user direction)

**GK save-spill does not produce a real Loose Ball / Corner Kick outcome.**

- **Where:** `packages/server/src/gameEngine.ts`, SAVE branch of the SHOT resolution (~lines 2751-2817), pre-existing since Phase 17.1 (D-07).
- **What's wrong:** `shotValidator.ts`'s `validateHandlingCheck` correctly implements the rulebook's handling-check comparison (`diceValue >= gk.handling` → not caught, `triggerLooseBall: true`; `diceValue < gk.handling` → caught). But `gameEngine.ts` never acts on `triggerLooseBall` — the `!caught` (spill) branch is treated identically to a clean catch: same `GK_RESTART` phase, same possession to the GK's team. A pre-existing comment marks this explicitly: `// D-07 (Phase 17.1): GK save spill → GK_RESTART (mirrors clean catch). pending out-of-bounds rules — spill treated as clean catch for now`.
- **Rulebook requirement (per user):** on a spilled save, run a real Loose Ball: if the scatter direction lands next to or behind the GK, it is a Corner Kick; if in front of the GK, roll for distance and continue play normally.
- **Why it's in scope now:** this dangling TODO predates both Out-of-Bounds (Phase 37) and Corner Kick (Phase 38) — the mechanics it needs to resolve into didn't exist yet when it was written. Corner Kick's OOB-03 byline-exit trigger path (this phase's actual scope) is unaffected and fully verified by automated tests — this is a _second_, currently-missing route into a corner kick.
- **User direction:** fold into this phase's gap-closure work rather than deferring to a separate phase.

## Deferred Verification

The human verifier gave the above verdicts from code review context but explicitly **deferred the live two-browser walkthrough** (steps 1, 3, 5, 6, 7, 8 of the plan's `<how-to-verify>` — corner award, taker selection, pre-kick window, High/Low resolution, visual check, Undo/Replay) until after gap-closure lands. These steps are NOT yet confirmed and must be re-run as part of closing this checkpoint once the gap-closure plan is executed.

## Gap-Closure Scope (for `/gsd-plan-phase 38 --gaps`)

1. Make Low Pass corners interceptable (A2 correction) — High Pass corners stay non-interceptable via the existing header-contest resolution.
2. Implement the real GK save-spill Loose Ball mechanic: scatter the ball on spill; if the landing direction is next to/behind the GK, route through `classifyOutOfBounds`/`triggerOutOfBoundsRestart` to award a Corner Kick; otherwise roll distance and continue play normally (replacing the current "spill treated as clean catch" placeholder).
3. **[38-REVIEW.md CR-01, BLOCKER]** `applyUndo`'s `moveTypeForPhase` has no case for `CORNER_KICK_FINAL_SETUP` — it falls through to the `'MOVE'` default and never finds the `CORNER_KICK_MOVE` event it actually needs to undo, so Undo is a complete no-op (always `NOTHING_TO_UNDO`/`UNDO_LOCKED`) in that phase despite being listed in `validUndoPhases`. Add the missing `moveTypeForPhase` case and a matching `lockReset` branch (see 38-REVIEW.md for the exact fix). Also strengthen the masking test (`gameHandlers.cornerKick.test.ts:978`) to assert the piece's position actually reverted and no `GAME_ERROR` fired, not just `state.phase`.
4. **[38-REVIEW.md CR-02, BLOCKER]** `applyUndo`'s `lockReset` has no branch for `CORNER_KICK_REPOSITION` — an undone move correctly reverts the piece's position but never refunds `cornerKickUsedPace`/`cornerKickStagePlacedIds`, silently and permanently burning part of that piece's 6-hex budget every time Undo is used. Add the missing `lockReset` branch (see 38-REVIEW.md for the exact fix), and decide whether an undone-to-zero piece should also be cleared from `cornerKickStagePlacedIds`.
5. **[38-REVIEW.md WR-01, WARNING]** `buildReplayFrames` never updates piece positions for `CORNER_KICK_GK_PLACE`/`CORNER_KICK_MOVE` events, so a keeper or player who moved during a corner kick appears at a stale position for the rest of the post-match replay.
6. **[38-REVIEW.md WR-02, WARNING]** `applyCornerKickReposition` hardcodes the per-stage 2-distinct-piece cap instead of reading `CORNER_KICK_STAGES[stageIndex].max` — will silently diverge from the client if that table's `max` is ever varied per stage.
7. Re-run the full two-browser walkthrough (plan 38-09's `<how-to-verify>` steps 1, 3, 5, 6, 7, 8) once 1-6 are fixed, including an explicit Undo check during both `CORNER_KICK_REPOSITION` and `CORNER_KICK_FINAL_SETUP`, and record a final CONFIRMED/CORRECTED verdict.

Full detail and suggested code for items 3-6: `.planning/phases/38-corner-kick/38-REVIEW.md`.

## Next Phase Readiness

Phase 38 is **not** ready to be marked complete. Route to `/gsd-plan-phase 38 --gaps` to create gap-closure plans for all items above, then `/gsd-execute-phase 38 --gaps-only` to execute them, then re-run this checkpoint's deferred verification steps.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-07_
