# Phase 11: Rule Correctness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 11-rule-correctness
**Areas discussed:** Header sequence refactor (RULE-01/02), Snapshot path clearing (RULE-03), SNAP_DEFLECT highlight bounds (RULE-04), Post-deflect both-teams movement (RULE-05)

---

## Header Sequence Refactor (RULE-01/02)

### RULE-01: Accuracy result display before contestant selection

| Option                     | Description                                                                                     | Selected |
| -------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| New HIGH_PASS_RESULT phase | FSM pauses in a new phase; both clients see the roll result; attacking team confirms to advance |          |
| Flag in HEADER state       | Add flag to existing HEADER phase; client shows roll result first, then contestant UI           | ✓        |
| You decide                 | Claude picks based on HIGH_PASS_MOVEMENT pattern                                                |          |

**User's choice:** Flag in HEADER state
**Notes:** User elaborated: "on accurate pass log then proceed to header contest log result aware possession to winner display header range from winning player and allow winning player to select target hex". This also implies the entire target-selection ownership model changes — winner owns it, not always the attacker.

---

### RULE-02: Header duel timing and target hex ownership

| Option                                   | Description                                                                           | Selected |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| Duel fires on second team's confirmation | Second GAME_HEADER_CONTESTANT triggers duel immediately; winner's team selects target | ✓        |
| Separate GAME_HEADER_DUEL event          | Explicit duel-trigger button/event after both teams confirm                           |          |
| You decide                               | Claude picks based on existing confirmation pattern                                   |          |

**User's choice:** Duel fires on second team's confirmation

---

### RULE-02 follow-up: Which team selects target hex

| Option                    | Description                                                             | Selected |
| ------------------------- | ----------------------------------------------------------------------- | -------- |
| Winning contestant's team | The team whose contestant won selects where the ball goes               | ✓        |
| Always the attacking team | Original attacking team always selects target regardless of duel result |          |
| You decide                | Follow Counter Attack rulebook interpretation                           |          |

**User's choice:** The winning contestant's team
**Notes:** This means defenders can head the ball away to a hex of their choice if they win the header duel.

---

## Snapshot Path Clearing (RULE-03)

| Option                         | Description                                | Selected |
| ------------------------------ | ------------------------------------------ | -------- |
| In applyStartMovement          | Single fix covers all MOVEMENT transitions |          |
| In each shot resolution branch | Audit and fix per-branch; targeted         | ✓        |
| Both                           | Belt-and-suspenders                        |          |

**User's choice:** In each shot resolution branch

---

## SNAP_DEFLECT Highlight Bounds (RULE-04)

| Option                                 | Description                                                               | Selected |
| -------------------------------------- | ------------------------------------------------------------------------- | -------- |
| Client-side: check snapDeflectPaceUsed | When paceUsed >= 2, return empty valid-move set in client highlight logic | ✓        |
| Server sends empty valid-moves hint    | Server sets validMoves: [] field when exhausted                           |          |
| You decide                             | Least invasive given existing highlight system                            |          |

**User's choice:** Client-side check on snapDeflectPaceUsed

---

## Post-Deflect Both-Teams Movement (RULE-05)

### Failure mode observed

| Option                                                    | Description                    | Selected |
| --------------------------------------------------------- | ------------------------------ | -------- |
| Start Movement button didn't appear                       | Game stuck in LOOSE_BALL       |          |
| Movement started but only one team's pieces highlightable | Slot-specific issue            |          |
| No pieces highlightable for either team                   | All slots blank for both teams | ✓        |

**User's choice:** "Movement started but no pieces were able to be highlighted for either team when progressing through the phase"
**Notes:** The DEFENDER_5 slot was also blank — not just ATTACKER_4. This rules out an attackingTeam identity bug and points to client-side highlight calculation.

---

### Fix approach

| Option                                          | Description                                           | Selected |
| ----------------------------------------------- | ----------------------------------------------------- | -------- |
| Diagnose client highlight logic during planning | Client-side investigation; server FSM appears correct | ✓        |
| Add server-side diagnostic logging first        | Confirm server state is correct, then fix client      |          |
| You decide                                      | Planner determines which layer                        |          |

**User's choice:** Diagnose client highlight logic during planning

---

## Claude's Discretion

- Exact field name for accuracy-roll-pending flag (`headerAccuracyRollPending` etc.) — follow `types.ts` naming
- Exact field name for header duel winner tracking — follow `headerConfirmed` / `headerContestants` pattern
- Whether accuracy acknowledgment uses a new event or reuses an existing one

## Deferred Ideas

None — discussion stayed within phase scope.
