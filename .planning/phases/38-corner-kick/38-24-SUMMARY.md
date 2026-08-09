---
phase: 38-corner-kick
plan: 24
subsystem: verification
tags: [human-verify, checkpoint, rules-fidelity, gap-closure, ux-correction]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: 38-16..38-23 — the second gap-closure round (clear-out phase, exclusion zone, free reposition + activation, restart banners, D-GAP-02 direction-only correction) this checkpoint re-verified live
provides:
  - 'Live two-browser verification of 38-16 through 38-23, run against dev servers on the freshly-merged tree'
  - 'D-GAP-03 ruling: REJECTED as implemented — the verifier does not want unlimited single-click-anywhere movement with a per-player once-per-window lock; wants free-kick-style single-hex-selection movement within a bounded area, with activation marked only AFTER the move completes'
  - 'A new correction against the pre-kick 3-hex window: it should NOT mark a player activated at all'
  - "A new correction against the mandatory clear-out step (38-20/21/22): it should be automatic (straight-line move toward goal, like the existing goal-kick 'clear the box' mechanic), not an interactive click-to-select-destination flow"
  - 'A newly discovered runtime crash in ActionLog.tsx during corner-kick movement, not caught by any automated test'
affects: [38-corner-kick verification checkpoint (38-09/38-15/38-24), next gap-closure round]
requirements-completed: []
requirements-open: [OOB-03, CORNER-01, CORNER-02, CORNER-03, CORNER-04, CORNER-05, CORNER-06]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/38-corner-kick/38-24-SUMMARY.md
  modified: []

key-decisions:
  - 'D-GAP-03 (human ruling): REJECTED as implemented. The verifier does not want the 38-17/38-18 unlimited-distance, click-anywhere-in-one-click reposition mechanic during the 2-2-2 window at all — regardless of the once-per-player-per-window activation-lock framing this plan asked them to rule on. Instead: repositioning should be single-hex-selection, one hex at a time, within a bounded allowed area — the same interaction pattern as the existing free-kick reposition mechanic — and the piece should be marked "activated" only AFTER its move for that turn is complete, not immediately/eagerly.'
  - 'New correction (pre-kick 3-hex window): the CORNER_KICK_FINAL_SETUP move should NOT mark the moved player as activated at all. This is a fresh finding against how 38-17 applied the activation ledger uniformly across both windows — the verifier is drawing a distinction between the 2-2-2 window (which does need activation tracking, once corrected per D-GAP-03 above) and the pre-kick window (which does not need it).'
  - 'New correction (mandatory clear-out, defect 3 from 38-15): the clear-out step should be automatic, not an interactive click-a-destination flow. The verifier wants it to work like the existing goal-kick "move attackers out of the box" mechanic — the game moves the player itself in a straight line toward the goal until they are 3 hexes clear of the corner, with no manual destination selection.'
  - 'D-GAP-01 and D-GAP-02 were NOT re-tested this round — the verifier stopped at the bugs below (encountered during steps 2/6/7 and a crash) before reaching the corner-taker/pass-delivery/GK-spill portions of the walkthrough. Their 38-15 rulings stand unchallenged but unconfirmed this round.'
  - 'This checkpoint is NOT approved. Per the plan''s explicit instruction ("do not patch it here — record it and route to /gsd-plan-phase 38 --gaps"), no code was changed in this plan. All four reported bugs are deferred to a further (third) gap-closure round.'

patterns-established: []

# Metrics
duration: n/a (human verification checkpoint)
completed: 2026-08-09
---

# Phase 38 Plan 24: Two-Browser Re-Verification Checkpoint (Round 3) Summary

**Live two-browser walkthrough re-run against dev servers built from the fully-merged 38-16..38-23 gap-closure work. Verdict: CORRECTED — four new bugs found (three UX/interaction-model corrections plus one runtime crash), D-GAP-03 rejected as implemented in favor of a different interaction model. Phase 38 is NOT ready to be marked Complete.**

## Performance

- **Duration:** n/a (human verification checkpoint — dev-server prep, human walkthrough, and write-up spanned this session)
- **Completed:** 2026-08-09

## Checkpoint Outcome

**Verdict: CORRECTED (not approved).** The human verifier reported a numbered list of bugs rather than replying `approved`. Per this plan's explicit instruction, no code was patched in this checkpoint — every item below is deferred to a further (third) gap-closure round via `/gsd-plan-phase 38 --gaps`.

**Preparation performed before the human session:** stale/orphaned dev-server processes from earlier sessions and worktrees (dated 2026-08-03, 2026-08-05, and earlier the same day) were found squatting on ports 3001 and 5173-5175 and were killed. Fresh `pnpm --filter @counter-attack/server dev` and `pnpm --filter @counter-attack/client dev` instances were started from the current merged tree and confirmed live (server responding on port 3001 via a valid Socket.io handshake; client on `http://localhost:5173/`) before the checkpoint was handed to the human verifier, so the verdict below reflects the actual current code.

## Bugs Reported (verbatim from the human verifier, not yet triaged into plans)

1. **[bug] Clear-out repositioning should be automatic, not prompted.** "repositioning on corner kick should be automatic and not prompted - like moving attackers out of the goal box on goal kick. move the player in a straight line toward the goal until they are 3 hexes away." This is a correction against 38-20/38-21/38-22's implementation of the mandatory pre-corner clear-out (38-15 defect 3): the verifier wants the existing goal-kick "move attackers out of the box" automatic mechanic (game moves the piece itself, straight line toward goal), not an interactive click-a-destination-then-Confirm flow.

2. **[bug] Unlimited repositioning should be single-hex selection within an allowed area, like free kick; activation marked AFTER the move.** "unlimited repositioning should be single hex selection within an allowed area like on a free kick. Player should be marked activated after the move." This is a correction against 38-17/38-18's uncapped-distance click-anywhere reposition mechanic (38-15 defects 1/2) — and effectively rules on D-GAP-03's interaction model: the verifier wants free-kick-style single-hex-at-a-time movement within a bounded area, not unlimited-distance single-click movement, with the "activated" marker applied only once the player's movement for that turn is complete (not immediately/eagerly).

3. **[bug] The pre-kick 3-hex move should NOT immediately mark a player activated.** "three step move immediately marks player as activated - is not needed for the movement." This is a correction against how 38-17 applied the activation ledger to the `CORNER_KICK_FINAL_SETUP` (pre-kick) window specifically — the verifier says activation tracking is not needed/wanted for that particular movement at all, distinct from bug 2's correction to the 2-2-2 window's activation timing.

4. **[bug] ActionLog crashes during corner-kick movement — genuine runtime error, not caught by any automated test.**

   ```
   ActionLog.tsx:1070
    Uncaught TypeError: Cannot destructure property 'prefix' of 'formatEvent(...)' as it is undefined.
       at ActionLog.tsx:1070:19
       at Array.map (<anonymous>)
       at ActionLog (ActionLog.tsx:1045:16

   react-dom.development.js:18704
    The above error occurred in the <ActionLog> component:

       at ActionLog (http://localhost:5173/src/components/ActionLog.tsx:1120:20)
       at div
       at SideLog (http://localhost:5173/src/components/GameBoard.tsx:117:27)
       at div
       at div
       at GameBoard (http://localhost:5173/src/components/GameBoard.tsx:185:17)
       at div
       at App (http://localhost:5173/src/App.tsx:32:18)

   Consider adding an error boundary to your tree to customize error handling behavior.
   Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
   react-dom.development.js:12056
    Uncaught TypeError: Cannot destructure property 'prefix' of 'formatEvent(...)' as it is undefined.
       at ActionLog.tsx:1070:19
       at Array.map (<anonymous>)
       at ActionLog (ActionLog.tsx:1045:16
   ```

   This crashes the entire `ActionLog` component (uncaught, no error boundary present) during corner-kick movement. Likely root cause: a new corner-kick-round-2 event type (from 38-16..38-23) not handled by `formatEvent`'s switch/lookup, so `formatEvent(...)` returns `undefined` for that event and the `{ prefix }` destructure at `ActionLog.tsx:1070` throws. Needs root-causing in the next round — this needs both a `formatEvent` fix for the missing event type AND, separately, an error-boundary hardening question (should `ActionLog` alone crash the whole board on a bad event, or should it fail soft?) is worth considering, though the verifier did not ask for the latter explicitly.

## D-GAP-03 Ruling

**REJECTED as implemented — this round's proposed interaction model is wrong, not just its edge-case framing.** This plan (38-24) asked the verifier to confirm or correct a specific narrow question: "is one-reposition-per-player-for-the-whole-2-2-2-window correct, given the uncapped/click-anywhere movement 38-17/38-18 shipped?" The verifier's answer goes further than that framing — they reject the underlying uncapped/click-anywhere movement mechanic itself (bug 2 above), independent of the once-per-player activation-lock question. The corrected reading is:

- Movement during the 2-2-2 window must be **single-hex-at-a-time selection within a bounded allowed area** — the same interaction pattern as the existing free-kick reposition mechanic — not an unlimited-distance single click to any legal hex.
- The **activated** marker should be applied only **after** a player's move for that turn is complete, not eagerly/immediately as currently implemented.

**Ambiguity flagged, not resolved by this report:** the verifier's bug 2 report does not explicitly re-state whether the "one distinct player may be repositioned per window (six distinct players total across three rounds)" framing from the original D-GAP-03 question survives this correction, or whether that too needs to change once the interaction model is fixed. This should be confirmed explicitly (not assumed either way) before or during the next gap-closure planning pass, since it materially affects the reposition-count budgeting logic (`cornerKickActivatedIds` and friends).

## D-GAP-02 and D-GAP-01 — NOT re-tested this round

The verifier stopped at the bugs above (encountered during the clear-out step, the 2-2-2 window, and the pre-kick window) and did not reach the corner-taker selection, High/Low Pass delivery, GK save-spill, visual/replay check, or restart-banner portions of the walkthrough. Their prior rulings from 38-15 (D-GAP-01: keep Undo's stage-cap-slot refund as implemented; D-GAP-02: option (b), direction-only corner award) were **neither contradicted nor re-confirmed** this round and should not be treated as re-verified.

## Penalty Kick banner deferral (38-19/defect 4, step 10) — NOT addressed this round

The verifier did not give an explicit binary answer on whether the Penalty Kick banner deferral to Phase 39 (recorded in 38-19-SUMMARY.md and restated in step 10 of this plan's `<how-to-verify>`) is acceptable. This is recorded as **not addressed this round**, not as approved or rejected, and needs an explicit answer in a future checkpoint.

## Steps From This Plan's 10-Step Walkthrough — Verdict Status

Per this plan's `<how-to-verify>` (steps 1-10):

| Step | Topic                                                                          | Verdict this round                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Award the corner (OOB-03)                                                      | **NOT TESTED** — verifier did not report on this step                                                                                                                                                                          |
| 2    | NEW — mandatory clear-out (defect 3)                                           | **CORRECTED** — bug 1 above; must be automatic, not interactive                                                                                                                                                                |
| 3    | NEW — permanent defender exclusion zone (defect 3)                             | **NOT TESTED** — verifier did not report on this step                                                                                                                                                                          |
| 4    | Goalkeepers and corner-taker (CORNER-01/02)                                    | **NOT TESTED**                                                                                                                                                                                                                 |
| 5    | Take the corner — A2 re-check (CORNER-04/05)                                   | **NOT TESTED**                                                                                                                                                                                                                 |
| 6    | NEW — free movement and activation in the 2-2-2 window (defects 1/2, D-GAP-03) | **CORRECTED** — bug 2 above; interaction model rejected wholesale                                                                                                                                                              |
| 7    | Pre-kick window and Undo (CORNER-06, D-GAP-01)                                 | **CORRECTED (partial)** — bug 3 above corrects the activation-marking behavior of the pre-kick move specifically; the Undo mechanics themselves (position revert, third-player release) were not exercised/reported this round |
| 8    | GK save-spill — D-GAP-02 as corrected                                          | **NOT TESTED**                                                                                                                                                                                                                 |
| 9    | Visual check and replay                                                        | **NOT TESTED**                                                                                                                                                                                                                 |
| 10   | NEW — restart banners (defect 4)                                               | **NOT TESTED** (Penalty Kick deferral: not addressed — see above)                                                                                                                                                              |

**Do not treat any "NOT TESTED" step as passing.** None of them were confirmed, contradicted, or otherwise reported on this round — the verifier's session ended at the bugs above (which occur early in the corner-kick sequence: the clear-out step, the 2-2-2 reposition window, and a crash during movement), before reaching corner-taker selection, pass delivery, GK spill, the visual/replay check, or the banner check.

## Is Phase 38 Ready to be Marked Complete?

**No.** Phase 38 is **not ready to be marked Complete.** Route to `/gsd-plan-phase 38 --gaps` for a **third** gap-closure round covering:

1. **Automatic straight-line clear-out movement** — replace the interactive click-to-select-destination clear-out flow (38-20/38-21/38-22) with an automatic straight-line-toward-goal move, mirroring the existing goal-kick "clear the box" mechanic, until each affected player is 3 hexes clear of the corner.
2. **Single-hex-per-step reposition UX within a bounded, free-kick-style area** — replace the uncapped/click-anywhere single-click movement mechanic (38-17/38-18) for the 2-2-2 window with free-kick-style single-hex-at-a-time selection within a bounded allowed area. This is the corrected reading of D-GAP-03; the open question of whether the "one distinct player per window, six total" budget framing survives this change should be explicitly re-confirmed with the verifier during planning, not assumed.
3. **Remove activation-marking from the pre-kick 3-hex move** — the `CORNER_KICK_FINAL_SETUP` window should not apply the "activated" ledger/marker to the moved player at all, distinct from (and in addition to) fixing the 2-2-2 window's activation _timing_ per item 2.
4. **Root-cause and fix the ActionLog crash** — `Cannot destructure property 'prefix' of 'formatEvent(...)' as it is undefined` at `ActionLog.tsx:1070`, triggered during corner-kick movement, uncaught and crashing the whole `ActionLog`/`SideLog` component tree with no error boundary. Almost certainly a new corner-kick-round-2 `ActionEventType` not handled by `formatEvent`'s switch/lookup table.
5. **Re-run the full ten-step walkthrough from 38-24-PLAN.md** once items 1-4 land, since 6 of the 10 steps (1, 3, 4, 5, 8, 9, plus the banner check in 10) were never reached this round and remain completely unverified, and step 7's Undo mechanics also still need direct exercise.

## User Setup Required

None — verification only, no external service configuration required.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-09_

## Self-Check: PASSED

- FOUND: .planning/phases/38-corner-kick/38-24-SUMMARY.md
