# Phase 18: Design Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 18-design-polish
**Areas discussed:** Todo fold, Messaging style standard, Replay review scope, Dead/duplicate code risk tolerance, REPLAY-06 specifics, Bug bash addendum, New features addendum, Game speed semantics, Replay symptom follow-up, BUG-11 inclusion

---

## Todo Match: Stale Client Selection on FTP/HP Slot Hand-off

| Option             | Description                                                                                     | Selected |
| ------------------ | ----------------------------------------------------------------------------------------------- | -------- |
| Fold into Phase 18 | Fix as part of DESIGN-03, same class of bug as the unfixed HIGH_PASS_MOVE carrier-exclusion gap | ✓        |
| Leave deferred     | Keep as a standalone backlog todo                                                               |          |

**User's choice:** Fold into Phase 18.
**Notes:** Subsequently broadened: BUG-09 (gathered later in the same session) supersedes the original narrow scope of this todo. See CONTEXT.md Folded Todos.

---

## Gray Areas to Discuss (multiSelect)

| Option                             | Description                                                                                                 | Selected |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| Messaging style standard           | PHASE_LABEL mixes "...PHASE" suffix with bare labels; GK DIVING label stale after GK_DIVE rename            | ✓        |
| Replay review scope                | DESIGN-02 — known symptom or open-ended audit?                                                              | ✓        |
| Dead/duplicate code risk tolerance | Fix known behavioral bugs (HIGH_PASS_MOVE carrier defect, stale-selection todo) or stay to inert code only? | ✓        |
| REPLAY-06 specifics                | Specific repro or open investigation?                                                                       | ✓        |

**User's choice:** All four selected, plus two free-text additions: a "bug bash" list (5 bugs) and a detailed logging/messaging/UX spec ("scoreboard, help text, and logs context").
**Notes:** The free-text addition was large enough to require its own scope-classification round (see below) before it could be folded into CONTEXT.md.

---

## Scope Classification: Bug Bash (5 items)

| Option               | Description                                                                                  | Selected |
| -------------------- | -------------------------------------------------------------------------------------------- | -------- |
| Phase 18 addendum    | New requirement IDs (BUG-06..BUG-10), same pattern as the OFFSIDE-01/02 addendum to Phase 17 | ✓        |
| Defer to a new phase | Keep Phase 18 to its original 4 items; log bugs as backlog todos                             |          |

**User's choice:** Phase 18 addendum.
**Notes:** Formalized into REQUIREMENTS.md/ROADMAP.md as BUG-06 through BUG-11 (BUG-11 added later — see below).

---

## Scope Classification: New Features (8 "change" items)

| Option                 | Description                                                                 | Selected |
| ---------------------- | --------------------------------------------------------------------------- | -------- |
| Defer to a new phase   | New capabilities, not polish — out of Phase 18's roadmap goal               |          |
| Fold into Phase 18 now | Add all 8 to Phase 18 scope; accept the planner may recommend a phase split | ✓        |

**User's choice:** Fold into Phase 18 now.
**Notes:** User explicitly accepted the likely consequence (planner recommending `## PHASE SPLIT RECOMMENDED`) when this option was presented. Formalized as UX-07 through UX-14.

---

## Game Speed Selector Semantics

| Option                               | Description                                                                                                               | Selected |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| Minutes-per-MOVE-action on the clock | Speed sets clock-minute increment per MOVE action (slow=+1, normal=+2, fast=+3); reuses existing actionCount-driven clock | ✓        |
| Something else                       | User clarifies                                                                                                            |          |

**User's choice:** Minutes-per-MOVE-action on the clock.

---

## Replay Review (DESIGN-02) — Follow-up

| Option                    | Description                                                            | Selected |
| ------------------------- | ---------------------------------------------------------------------- | -------- |
| Open-ended audit          | No specific repro — clean-room pass over startReplayStream/ReplayPanel | ✓        |
| I have a specific symptom | User describes an observed issue                                       |          |

**User's choice:** Open-ended audit.

---

## BUG-11 Inclusion (HIGH_PASS_MOVE carrier-exclusion defect)

| Option                | Description                                                                               | Selected |
| --------------------- | ----------------------------------------------------------------------------------------- | -------- |
| Yes, include it       | Same root cause/fix pattern as the already-fixed FTP bug; cheap to fix while in this code | ✓        |
| No, leave it deferred | Keep Phase 18 to only the 5 originally-reported bugs                                      |          |

**User's choice:** Yes, include it (as BUG-11).

---

## Claude's Discretion

- Exact tooltip implementation (native `title` vs. custom component) for UX-12/UX-13.
- Exact CSS/animation treatment for the UX-14 event banner.
- Where the game-speed selection is persisted in `GameState` and threaded to the clock derivation.
- Extrapolating the DESIGN-01 naming convention to phases not given an explicit example.
- Exact wording/log-line shape for BUG-07's header-pass log entry.

## Deferred Ideas

None — both the bug-bash and UX-enhancement items raised mid-discussion were explicitly folded into Phase 18 rather than deferred elsewhere.
