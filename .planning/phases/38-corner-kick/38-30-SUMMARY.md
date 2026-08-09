---
phase: 38-corner-kick
plan: 30
subsystem: verification
tags: [human-verify, checkpoint, rules-fidelity, gap-closure, ux-correction, undo]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: 38-25..38-29 — the third gap-closure round (automatic clear-out, ActionLog crash fix, bounded single-destination reposition, client mirror, banner re-key) this checkpoint re-verified live
provides:
  - 'Live two-browser verification of 38-25 through 38-29, run against dev servers on the freshly-merged tree'
  - 'Confirmation of all three locked assumptions (A-AUTO-01, A-GAP3-BUDGET, A-GAP3-AREA) as implemented'
  - 'Confirmation of steps 1, 3, 4, 5, 8, 9, and the banner half of step 10, plus the Penalty Kick deferral acceptance — delivered via a single consolidated reply rather than itemized per-step confirmation'
  - 'A NEW defect: the offside ring is not cleared on the goal -> kickoff-reset transition (found during step 9/replay-adjacent testing; likely out of corner-kick scope)'
  - 'A regression in the 2-2-2 corner-kick reposition window: Undo does not visually enable after a placement, and does not support the normal-move-phase multi-step undo stack'
affects:
  [
    38-corner-kick verification checkpoint (38-09/38-15/38-24/38-30),
    next (fourth) gap-closure round,
  ]
requirements-completed: []
requirements-open: [OOB-03, CORNER-01, CORNER-02, CORNER-03, CORNER-04, CORNER-05, CORNER-06]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/38-corner-kick/38-30-SUMMARY.md
  modified: []

key-decisions:
  - 'A-AUTO-01 (human ruling): CONFIRMED as implemented. "3 hexes clear" means ending up strictly MORE than 3 hexes from the corner (4 or more).'
  - 'A-GAP3-BUDGET (human ruling): CONFIRMED as implemented. 2 distinct players per round, 3 rounds per side, 6 distinct players per side in total, unchanged from what shipped in 38-27.'
  - 'A-GAP3-AREA (human ruling): CONFIRMED as implemented. Attacking side may place on any unoccupied on-pitch hex; defending side may place on any unoccupied on-pitch hex outside the 3-hex corner exclusion zone — an exact mirror of free-kick behavior.'
  - 'Penalty Kick banner deferral to Phase 39: ACCEPTED.'
  - "This checkpoint is NOT approved. Per the plan's explicit instruction, no code was changed in this plan. Two bugs (one new/possibly-out-of-scope, one a direct regression in this round's scope) are deferred to a fourth gap-closure round via `/gsd-plan-phase 38 --gaps`."
  - 'Steps 1, 3, 4, 5, 8, 9, and the banner half of step 10 were confirmed via a single consolidated "rest of the changes seems fine" reply rather than an itemized step-by-step transcript. Recorded as CONFIRMED per the verifier''s explicit statement, but flagged here in case a future round wants finer-grained re-verification of any individual step.'

patterns-established: []

# Metrics
duration: n/a (human verification checkpoint)
completed: 2026-08-09
---

# Phase 38 Plan 30: Two-Browser Re-Verification Checkpoint (Round 4) Summary

**Live two-browser walkthrough re-run against dev servers built from the fully-merged 38-25..38-29 third-round gap-closure work. Verdict: CORRECTED — two bugs found (one new defect outside likely corner-kick scope, one direct Undo regression in this round's bounded-reposition rewrite). All three locked assumptions (A-AUTO-01, A-GAP3-BUDGET, A-GAP3-AREA) and the remaining seven walkthrough steps were confirmed. Phase 38 is NOT ready to be marked Complete.**

## Performance

- **Duration:** n/a (human verification checkpoint — dev-server prep, human two-browser walkthrough, and write-up spanned this session)
- **Completed:** 2026-08-09

## Checkpoint Outcome

**Verdict: CORRECTED (not approved).** The human verifier reported two bugs rather than replying `approved`. Per this plan's explicit instruction, no code was patched in this checkpoint — both items below are deferred to a fourth gap-closure round via `/gsd-plan-phase 38 --gaps`.

**Preparation performed before the human session:** `node_modules` was already present (no install needed). `pnpm --filter @counter-attack/shared build` ran clean. `pnpm typecheck` was clean across all three packages. `pnpm test` was green everywhere: shared 702 passed (15 files), server 1029 passed / 1 skipped / 1 todo (39 files), client 772 passed (30 files). Two stale dev-server processes from an earlier session (a `tsx watch` server process on port 3001 and a `vite` client process on port 5173) were found squatting on the target ports and were killed; a transient `EADDRINUSE` race occurred on the first server restart attempt (a lingering child process took the port back momentarily) and was resolved by killing the specific lingering PID and starting cleanly a second time. Fresh `pnpm --filter @counter-attack/server dev` and `pnpm --filter @counter-attack/client dev` instances were started from the current merged tree and confirmed live (server responding on port 3001 — the "Transport unknown" response to an HTTP-polling handshake probe is expected given the project's websocket-only transport configuration; client on `http://localhost:5173/`, HTTP 200) before the checkpoint was handed to the human verifier, so the verdict below reflects the actual current code.

## Assumption Rulings

**A-AUTO-01 — CONFIRMED as implemented.** "3 hexes clear" is confirmed to mean ending up strictly MORE than 3 hexes from the corner (i.e., 4 or more hexes away), matching the existing rule that no defender may be within 3 hexes.

**A-GAP3-BUDGET — CONFIRMED as implemented.** The reposition budget is unchanged: 2 distinct players per round, 3 rounds per side, 6 distinct players per side in total.

**A-GAP3-AREA — CONFIRMED as implemented.** "Allowed area" is confirmed as implemented exactly like free kick: the attacking side may place a player on any unoccupied on-pitch hex; the defending side may place a player on any unoccupied on-pitch hex that is not within 3 hexes of the corner.

**Penalty Kick banner deferral to Phase 39 — ACCEPTED.** The verifier is content with the deferral; Penalty Kick banners remain out of scope until Phase 39 introduces the phase to attach one to.

## Steps From This Plan's 10-Step Walkthrough — Verdict Status

| Step | Topic                                                                      | Verdict this round                                                                                                                                                                                                                                               |
| ---- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Award the corner (OOB-03)                                                  | **CONFIRMED** — via consolidated "rest of the changes seems fine" reply                                                                                                                                                                                          |
| 2    | NEW — automatic clear-out (bug 1 from 38-24)                               | **CORRECTED** — see Bug 1 below (offside-ring, likely out of scope) and general step-9-adjacent findings; the automatic clear-out mechanic itself was not separately contradicted, but the session surfaced a related-area defect during this portion of testing |
| 3    | The permanent defender exclusion zone                                      | **CONFIRMED** — via consolidated reply                                                                                                                                                                                                                           |
| 4    | Goalkeepers and corner-taker (CORNER-01/02)                                | **CONFIRMED** — via consolidated reply                                                                                                                                                                                                                           |
| 5    | Take the corner — A2 re-check (CORNER-04/05)                               | **CONFIRMED** — via consolidated reply                                                                                                                                                                                                                           |
| 6    | NEW — free-kick-style repositioning in the 2-2-2 window (bug 2 from 38-24) | **CORRECTED** — see Bug 2 below (Undo regression)                                                                                                                                                                                                                |
| 7    | Pre-kick window and UNDO (CORNER-06, bug 3 from 38-24, D-GAP-01)           | **CORRECTED** — see Bug 2 below; Undo mechanics in the 2-2-2 window are broken, directly implicating this step's requirements                                                                                                                                    |
| 8    | GK save-spill — D-GAP-02 as corrected                                      | **CONFIRMED** — via consolidated reply                                                                                                                                                                                                                           |
| 9    | Visual check and replay                                                    | **CORRECTED (partial)** — visual/panel conventions confirmed via consolidated reply, but replay-adjacent testing during this step is where Bug 1 (offside ring) was found                                                                                        |
| 10   | Restart banners                                                            | **CONFIRMED** (banner behavior) — via consolidated reply; **Penalty Kick deferral ACCEPTED**                                                                                                                                                                     |

**Note on confirmation granularity:** Steps 1, 3, 4, 5, 8, 9 (visual/panel half), and 10 (banner half) were confirmed via a single consolidated reply — "Rest of the changes seems fine" — given in direct response to a consolidated question covering those steps plus the three assumption rulings and the Penalty Kick deferral, rather than an itemized step-by-step CONFIRMED/CORRECTED transcript. This is recorded as CONFIRMED per the verifier's explicit statement, but is flagged here in case a future round wants finer-grained, individually-itemized re-verification of any of these steps.

## Bugs Reported (verbatim from the human verifier)

### Bug 1 — Offside ring not reset after goal / kickoff reset (NEW defect, found during step 9/replay-adjacent testing)

**Verbatim:** "after goal is scored and player positions are reset for kick off players still showed offsides rings when they should be reset"

This is a **new defect**, not one of the four bugs reported in `38-24-SUMMARY.md`. It concerns the goal → kickoff-reset transition — the offside ring (`isOffside` piece overlay) is not cleared when player positions are reset for kickoff after a goal. This is **not** corner-kick reposition/clear-out logic; it more likely belongs to the goal-scoring/kickoff-reset code path (`applyKickOffSetup` / kickoff piece placement / offside-evaluation reset). **Flagged for triage**: when scoping the next gap-closure round, confirm whether this is in-scope for `/gsd-plan-phase 38 --gaps` (a Phase 38 gap, since it was found during this phase's UAT) or should be routed to a separate quick-task / different-phase defect, since the root cause is very likely outside the corner-kick reposition/clear-out surface this round's plans (38-25 through 38-29) touched.

### Bug 2 — Undo is broken in the 2-2-2 corner-kick reposition window (directly in this round's scope)

**Verbatim:** "In the 2-2-2 window the reset button does not light up to indicate it can be active. undo should undo the single move action. if both actions have been taken and you havent hit confirm you should be able to step through undoing both actions if desired - the same as a normal move phase."

Recorded precisely as three distinct sub-findings:

1. **Visual/enablement gap:** the Undo/Reset control does not visually enable ("light up") after a placement has been made in the 2-2-2 window, even though a move exists that could be undone.
2. **Single-undo semantics:** Undo should revert the single most recent placement action.
3. **Multi-step undo stack:** if two placements have been made this round and Confirm has not yet been pressed, Undo should be steppable — the first Undo reverts the second (most recent) placement, a second Undo reverts the first placement — matching the behavior of a normal Movement Phase's Undo stack.

This directly implicates **step 6** (free-kick-style repositioning) and **step 7** (pre-kick window and Undo, CORNER-06, D-GAP-01) from this plan's walkthrough. It appears to be a **regression introduced by 38-27's rewrite** of `applyCornerKickReposition` from the old one-hex-at-a-time adjacency-walk model to the new bounded single-destination placement model — the Undo wiring (both the client's enablement/visibility logic and the underlying undo-stack semantics) that worked under the old model likely was not carried over correctly to the new placement model. This needs root-causing against `applyUndo`'s `CORNER_KICK_REPOSITION` refund arm (`gameEngine.ts`) and the client's `canUndo`/Undo-button enablement logic (mirroring the equivalent Movement Phase Undo stack) in the next gap-closure round.

## Is Phase 38 Ready to be Marked Complete?

**No.** Phase 38 is **NOT ready to be marked Complete.** Route to `/gsd-plan-phase 38 --gaps` for a **fourth** gap-closure round covering:

1. **Fix the 2-2-2 corner-kick reposition window's Undo regression** (Bug 2) — restore Undo-button visual enablement after a placement, and restore full step-through multi-undo-stack semantics (undo most-recent-first, matching a normal Movement Phase) against the 38-27 bounded single-destination placement model. This is the highest-priority item, being both a direct regression from this round's own shipped work and a re-open of D-GAP-01 (which had previously been confirmed as correct under the old adjacency-walk model).
2. **Triage and, if in-scope, fix the offside-ring-not-cleared-after-goal defect** (Bug 1) — confirm whether this belongs to Phase 38 (corner-kick) or should be routed as a separate defect against the goal-scoring/kickoff-reset code path, since its root cause is very likely outside the files touched by 38-25 through 38-29.
3. **Re-run the full ten-step walkthrough from 38-30-PLAN.md** once items 1-2 land, with particular attention to steps 6 and 7 (the Undo fix) and step 9 (the offside-ring fix, if triaged as in-scope) — the consolidated "rest is fine" reply for the other steps should be treated as sufficient unless the next round's changes touch adjacent code, per the note on confirmation granularity above.

## User Setup Required

None — verification only, no external service configuration required.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-09_

## Self-Check: PASSED

- FOUND: .planning/phases/38-corner-kick/38-30-SUMMARY.md
