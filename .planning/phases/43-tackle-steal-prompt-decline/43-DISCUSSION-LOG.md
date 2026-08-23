# Phase 43: Tackle/Steal Prompt & Decline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 43-tackle-steal-prompt-decline
**Areas discussed:** Multiple eligible defenders, Declined-but-live ring styling, Prompt copy & framing

---

## Multiple Eligible Defenders

| Option                          | Description                                                                                                                         | Selected |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| One combined prompt             | Single Attempt/Decline prompt for the whole opportunity; accepting rolls against whichever defender existing resolution logic picks |          |
| Sequential per-defender prompts | Defending manager prompted once per eligible defender in turn                                                                       | ✓        |
| You decide                      | Leave to research/planning                                                                                                          |          |

**User's choice:** Sequential per-defender prompts.

**Follow-up 1 — does an accepted attempt end the sequence?**

| Option                                       | Description                                                                              | Selected    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| Accept ends the sequence                     | Once any defender attempts, the step is resolved; remaining defenders don't get prompted |             |
| Every eligible defender always gets prompted | Each eligible defender is asked in turn regardless of prior outcomes                     | (see notes) |
| You decide                                   | Leave to planning                                                                        |             |

**User's choice (free text):** "every eligible defender gets prompted as long as possession hasnt changed or a foul has not trigger a halt in play for a kick" — refined and confirmed as: a FAILED attempt does not end the sequence; only a possession change (successful steal/tackle) or a foul-triggered stoppage ends it.

**Follow-up 2 — prompt order:**

| Option                          | Description                                      | Selected |
| ------------------------------- | ------------------------------------------------ | -------- |
| By tackling stat, highest first | Prompt the defender most likely to succeed first | ✓        |
| By proximity/hex order          | Deterministic board-position order               |          |
| You decide                      | Leave to planning                                |          |

**User's choice:** By tackling stat, highest first.

**Notes:** This sequencing rule (fail doesn't end sequence; possession-change/foul-stoppage does) is the single most implementation-critical decision from this discussion — flagged as such in CONTEXT.md's `<specifics>` section.

---

## Declined-but-Live Ring Styling

| Option                                   | Description                                                                                    | Selected |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Same ring, no distinction                | Reuse existing amber `risk` ring unchanged for both never-offered and declined-but-live states | ✓        |
| Distinct treatment for declined-but-live | New visual cue (e.g. pulsing/dashed variant) to differentiate                                  |          |
| You decide                               | Leave to planning/implementation                                                               |          |

**User's choice:** Same ring, no distinction (v1).

**Notes:** Research (FEATURES.md) had flagged the distinct treatment as an optional "nice-to-have," not a requirement — explicitly deferred, not adopted, for this phase.

---

## Prompt Copy & Framing

| Option                          | Description                                                                             | Selected |
| ------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Claude's discretion             | Match existing prompt-panel family's copy conventions (GkDiveAtFeetPromptPanel) exactly | ✓        |
| I want to specify exact wording | User provides specific button labels/prompt text                                        |          |

**User's choice:** Claude's discretion.

---

## Claude's Discretion

- Exact `GameState` field shapes for the new prompt phase and sibling decline-exclusion fields (mirroring `gkDiveAtFeetTeam`/`gkDiveAtFeetResume`).
- The new `ActionEventType` for declines and its Undo/Replay/`isBoundary` registration.
- Whether declines are visibly logged in ActionLog — precedent (`GK_DIVE_AT_FEET_DECLINED` is logged) should be followed.
- The full reset-policy table across ~30 existing `stealAttemptedByIds`/`tackleAttemptedByIds` reset call sites.
- Exact button labels/prompt copy for `TackleStealPromptPanel`.

## Deferred Ideas

None — discussion stayed within phase scope. Two pre-existing rendering-bug todos (KICK_OFF_SETUP shot-path shading, offside-ring-after-goal) were reviewed via `todo.match-phase` but confirmed unrelated (weak keyword-only matches); both remain tagged to Phase 46 (Final Cleanup).
