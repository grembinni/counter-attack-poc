---
phase: 38-corner-kick
plan: 15
subsystem: game-engine
tags: [corner-kick, human-verification, checkpoint, gap-closure, rulebook-correction]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: the six gap-closure fixes (38-10..38-14) this checkpoint re-verified live
provides:
  - 'Live two-browser verification of 38-10 through 38-14, run against dev servers on the freshly-merged tree'
  - "D-GAP-01 ruling: keep as implemented (Undo refunds a corner-reposition piece's stage-cap slot)"
  - "D-GAP-02 ruling: option (b), direction-only — corrects 38-14's scatter-walk implementation against the user's original rule text"
  - "Four new defects found live that were not caught by 38-09's code-review-derived verdicts or by any automated test: free (uncapped) reposition movement, missing piece-activation flagging, a missing pre-corner mandatory clear-out + no-defender-within-3-hexes rule, and a UX request for restart banners"
affects: [38-corner-kick verification checkpoint (38-09/38-15), next gap-closure round]
requirements-completed: []
requirements-open:
  [
    CORNER-01,
    CORNER-03,
    CORNER-04(partially — A2 not explicitly re-confirmed this round),
    CORNER-06,
    OOB-03,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/38-corner-kick/38-15-SUMMARY.md
  modified: []

key-decisions:
  - "D-GAP-01 (human ruling): keep as implemented. Undo during CORNER_KICK_REPOSITION continues to free a piece's slot in the round's 2-distinct-piece cap once its only move that round is undone. The user ruled this independent of bug #1 (the 6-hex cap bug) rather than deferring it."
  - 'D-GAP-02 (human ruling): option (b), direction-only — CORRECTS 38-14''s implementation. The user quoted the original rule text verbatim: "If your roll is equal to or higher than the goalkeeper''s Handling attribute, run a Loose ball: if Direction is next or behind the GK it is a Corner Kick. If the direction is in front of GK, roll for distance, and continue play normally." This means the corner award is decided by the ROLLED DIRECTION alone (next-to/behind the GK => immediate corner), not by whether the scatter walk actually reaches the pitch boundary. 38-14''s scatter-walk implementation must be replaced with a direction-only check in the next gap-closure round.'
  - 'This checkpoint is NOT approved. Per the plan''s explicit instruction ("do not patch it here — record it and route to /gsd-plan-phase 38 --gaps"), no code was changed in this plan. All four reported defects and the D-GAP-02 rule correction are deferred to a further gap-closure round.'

patterns-established: []

# Metrics
duration: ~15min
completed: 2026-08-08
---

# Phase 38 Plan 15: Two-Browser Re-Verification Checkpoint Summary

**Live two-browser walkthrough re-run against dev servers built from the fully-merged 38-10..38-14 gap-closure work. Verdict: CORRECTED — four new defects found, one of the two open design questions (D-GAP-02) is also a correction against 38-14's implementation. Phase 38 is NOT ready to be marked Complete.**

## Performance

- **Duration:** ~15 min (dev-server startup + human walkthrough + write-up)
- **Completed:** 2026-08-08

## Checkpoint Outcome

**Verdict: CORRECTED (not approved).** The human verifier reported a numbered list of issues rather than replying `approved`. Per this plan's own instruction, no code was patched in this checkpoint — every item below is deferred to a further gap-closure round via `/gsd-plan-phase 38 --gaps`.

### D-GAP-01 Ruling

**Keep as implemented.** Undo during `CORNER_KICK_REPOSITION` continues to refund a piece's slot in the round's 2-distinct-piece cap once its only move that round is undone (38-10's behavior is correct and unaffected by bug #1 below).

### D-GAP-02 Ruling

**Option (b) — direction-only. This CORRECTS 38-14's implementation**, which used a scatter-walk reading (a corner is only awarded if the scatter actually exits the pitch). The user supplied the original rule text verbatim:

> If a goalkeeper saves a shot, roll a dice. If your roll is equal to or higher than the goalkeeper's Handling attribute, run a "Loose ball": if Direction is next or behind the GK it is a Corner Kick. If the direction is in front of GK, roll for distance, and continue play normally.

The corner award must be decided by the **rolled direction alone** — "next to or behind the GK" awards an immediate corner regardless of the keeper's distance from their own byline. 38-14's `triggerOutOfBoundsRestart`-via-scatter-walk approach under-awards corners whenever the keeper is standing off the byline. This needs a direction-only check in `applyRoll`'s `LOOSE_BALL` case (or immediately after the spill transition) before the scatter walk runs, gated on the goalkeeper being the `lastTouchedBy` piece.

### Defects Reported (verbatim from the human verifier, not yet triaged into plans)

1. **[bug] Corner-kick reposition moves are free, not capped at 6 hexes.** The current implementation (38-10, and the original CORNER-03 build) enforces a 6-hex-per-piece movement budget during the alternating reposition window. The correct rule is that these repositions are unlimited/free movement, not budget-capped. This affects `applyCornerKickReposition`'s pace-tracking (`cornerKickUsedPace`), the client's remaining-budget display in `CornerKickSetupPanel.tsx`, and by extension D-10's pace-refund-on-Undo logic (which becomes moot if there is no budget to refund, though D-GAP-01 above rules Undo's stage-cap-slot refund should stay regardless).

2. **[bug] Players are not flagged as "activated" on corner-kick movement.** Expected: a piece should be flagged activated during the "2-2-2" free-move stages, and that activation should reset for the final pre-kick move of up to 3 hexes. The exact meaning of "activated" and the "2-2-2" stage structure (as opposed to the current `CORNER_KICK_STAGES` table) needs clarification against the codebase's existing "activated"/moved-piece conventions (e.g. `cornerKickStagePlacedIds`, ZoI-related flags) before this can be planned — flag for the next `/gsd-plan-phase 38 --gaps` round or a preceding `/gsd-discuss-phase`.

3. **[bug] Missing pre-corner mandatory clear-out and defender exclusion zone.** Before goalkeepers are positioned and the kicker is selected, any player within 3 hexes of the corner must be moved closer to goal. Additionally, no defender may reposition to within 3 hexes of the corner at any point. Neither rule exists in the current `CORNER_KICK_TAKER_SELECT` / `CORNER_KICK_GK_SETUP_*` / `CORNER_KICK_REPOSITION` sequence — this is a new required step and a new movement restriction, not a tweak to existing logic. Likely the largest-scope item of the four.

4. **[ux] Restart banners missing for Goal Kick, Corner Kick, Throw In, Penalty Kick, and Free Kick.** The game already shows a popup banner for turnovers (and similar transition events); the same treatment should extend to these five restart types for consistency. Non-blocking for rules correctness; a UX-only addition.

## Steps Not Individually Re-Confirmed

The human verifier's reply was a defect list plus the two D-GAP rulings, not a step-by-step CONFIRMED/CORRECTED transcript against each of 38-09-PLAN.md's steps 1, 3, 5, 6, 7, 8. The following can be inferred but were **not explicitly re-confirmed** and should not be treated as re-verified:

- Step 1 (OOB-03 corner award) — not contradicted, not explicitly re-confirmed.
- Step 4/A2 (Low Pass interceptable, High Pass not — 38-13's correction) — not contradicted, not explicitly re-confirmed.
- Step 5 (visual/panel conventions) — not contradicted, not explicitly re-confirmed.
- Step 7 (Undo revert + budget refund in both reposition phases) — the position-revert half is not contradicted; the "budget refund" half is superseded by bug #1 (there should be no budget to refund at all).
- Step 8 (GK spill correctly withholds possession, on-pitch scatter continues play) — the possession-withholding half is not contradicted; the corner-award condition is corrected by the D-GAP-02 ruling above.
- Step 9 (replay shows correct positions — 38-12's fix) — not contradicted, not explicitly re-confirmed.

Recommend these be explicitly re-walked in the checkpoint that follows the next gap-closure round, alongside the four new defects, rather than assumed passing.

## Is Phase 38 Ready to be Marked Complete?

**No.** Route to `/gsd-plan-phase 38 --gaps` for a further gap-closure round covering:

- Removing or correcting the 6-hex reposition cap (defect #1)
- Implementing "activated" piece flagging for the 2-2-2 free-move stages, reset on the final pre-kick move (defect #2 — recommend a `/gsd-discuss-phase` pass first to pin down the exact mechanic before planning)
- Adding the pre-corner mandatory clear-out and the defender no-reposition-within-3-hexes rule (defect #3 — largest scope item)
- Correcting 38-14's D-GAP-02 implementation from scatter-walk to direction-only (already ruled above)
- Adding restart banners for Goal Kick, Corner Kick, Throw In, Penalty Kick, Free Kick (defect #4, UX)
- Re-walking the full nine-step checklist once the above land, since several steps were not individually re-confirmed this round

## User Setup Required

None — verification only, no external service configuration required.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_

## Self-Check: PASSED

- FOUND: .planning/phases/38-corner-kick/38-15-SUMMARY.md
