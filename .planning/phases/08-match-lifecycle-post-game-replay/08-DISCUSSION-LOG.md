# Phase 8: Match Lifecycle + Post-Game Replay - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 08-match-lifecycle-post-game-replay
**Areas discussed:** Draw at full time, Action counting boundary, Kick-off procedure enforcement, Replay controls

---

## Draw at Full Time

| Option            | Description                                                                       | Selected |
| ----------------- | --------------------------------------------------------------------------------- | -------- |
| Draw is valid     | Match ends at full time with the current score. No extra time or penalties in v1. | ✓        |
| Tiebreaker needed | Tied matches go to extra time or penalties. Significant extra FSM states.         |          |

**User's choice:** Draw is valid
**Notes:** Resolves the STATE.md open question "Phase 8: Tiebreaker rule at full time, or is a draw valid?"

---

| Option            | Description                                                                      | Selected |
| ----------------- | -------------------------------------------------------------------------------- | -------- |
| Leniency only     | Referee card leniency used only for added time: addedTime = diceRoll + leniency. | ✓        |
| Other effects too | Referee also affects fouls, bookings (all deferred to v2).                       |          |

**User's choice:** Leniency only
**Notes:** Resolves the STATE.md open question "Phase 8: Does referee card affect anything beyond Leniency/added time?"

---

| Option               | Description                                                                 | Selected |
| -------------------- | --------------------------------------------------------------------------- | -------- |
| Pause + manual start | Both clients see HALF_TIME screen with score and "Start 2nd Half" button.   | ✓        |
| Automatic / no pause | Server immediately transitions to KICK_OFF for second half without waiting. |          |

**User's choice:** Pause + manual start

---

## Action Counting Boundary

| Option                           | Description                                                                | Selected |
| -------------------------------- | -------------------------------------------------------------------------- | -------- |
| Entire Movement Phase = 1 action | All 3 slots together = 3 minutes. Counter increments when ATTACKER_2 ends. | ✓        |
| Each slot = 1 action             | Each of the 3 slots counts separately.                                     |          |

**User's choice:** Entire Movement Phase = 1 action (= 3 minutes)

---

| Option                     | Description                                         | Selected |
| -------------------------- | --------------------------------------------------- | -------- |
| Time-based model confirmed | actionCount = minutes elapsed; half ends at 45 min. | ✓        |

**User's response:** Confirmed — and provided the full timing table from rulebook v1.4.1:

- Movement Phase: 3 minutes
- Standard Pass, High Pass, Long Ball, Goal Kick: 1 minute
- Set Pieces except Throw-In: 2 minutes
- Throw-In: 1 minute
- Shots, Headers, First-time Pass, Quick Throw: 0 minutes

---

| Option                       | Description                                                 | Selected |
| ---------------------------- | ----------------------------------------------------------- | -------- |
| Include snapshots in Phase 8 | Implement applySnapshot in gameEngine.ts, wire SNAP-01..03. | ✓        |
| Defer snapshots              | Skip snapshot FSM in Phase 8.                               |          |

**User's choice:** Include snapshots in Phase 8

---

| Option                 | Description                                          | Selected |
| ---------------------- | ---------------------------------------------------- | -------- |
| Loose Ball = 0 minutes | Sub-result of another action; no separate time cost. | ✓        |
| Loose Ball = 1 minute  | Every loose ball resolution costs 1 minute.          |          |

**User's choice:** 0 minutes

---

| Option                         | Description                                                    | Selected |
| ------------------------------ | -------------------------------------------------------------- | -------- |
| Inline server roll at 45       | Server rolls added time on the transition that crosses 45 min. | ✓        |
| Separate client-triggered roll | Added time requires a player to click Roll.                    |          |

**User's choice:** Inline server roll

---

| Option                       | Description                                                                  | Selected |
| ---------------------------- | ---------------------------------------------------------------------------- | -------- |
| Yes — enforce the full table | Add lastActionType; server validates every action against eligibility table. | ✓        |
| Partial — track only         | Add lastActionType for display but don't reject invalid sequences.           |          |

**User's choice:** Yes, enforce the full table
**Notes:** User also provided the action eligibility table image from rulebook v1.4.1 (shared in session). Two corrections from my initial reading: Long ball → Header = ✓ (not ✗); Header → Header = ✗ (not ✓).

---

## Kick-Off Procedure Enforcement

| Option                  | Description                                                                        | Selected |
| ----------------------- | ---------------------------------------------------------------------------------- | -------- |
| Enforce placement rules | KICK_OFF_SETUP phase: free repositioning + Ready confirmation + server validation. | ✓        |
| Auto-position and go    | Server resets to 4-5-2 and immediately enters KICK_OFF.                            |          |

**User's choice:** Enforce placement rules
**User's response (free text):** "initiate kickoff setup with default positions. Allow repositioning in own half for both teams. Repositioning should allow movement to any eligible square. enforce placement rules. both teams check ready"

---

| Option                     | Description                                                    | Selected |
| -------------------------- | -------------------------------------------------------------- | -------- |
| Free drag-to-any-valid-hex | Each team places players freely in their zone, no pace limits. | ✓        |
| Limited moves per player   | Players can only move a few hexes from default.                |          |

**User's choice:** Free drag-to-any-valid-hex

---

| Option                                 | Description                                                                         | Selected |
| -------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Player selects who occupies centre hex | Attacking team manually places a player there; server rejects Ready until occupied. | ✓        |
| Auto-lock one player there             | First forward is automatically placed on centre hex and cannot be moved.            |          |

**User's choice:** Player selects who occupies the centre hex

---

## Replay Controls

| Option                | Description                                          | Selected |
| --------------------- | ---------------------------------------------------- | -------- |
| Auto-play only        | Replay runs at 1 event/second with no controls.      | ✓        |
| Pause / step controls | Replay shows Pause, Step Forward, Step Back buttons. |          |

**User's choice:** Auto-play only

---

| Option                          | Description                                                            | Selected |
| ------------------------------- | ---------------------------------------------------------------------- | -------- |
| Final score + return to lobby   | Replay shows score + position counter; ends with "Play Again" → lobby. | ✓        |
| Just the board, then disconnect | Replay shows board only; ends with disconnect.                         |          |

**User's choice:** Final score + return to lobby

---

| Option                              | Description                                                     | Selected |
| ----------------------------------- | --------------------------------------------------------------- | -------- |
| Server streams frames via Socket.io | Server emits game:state for each frame at 1-second intervals.   | ✓        |
| Client reconstructs from event log  | Server sends full event log once; client steps through locally. |          |

**User's choice:** Server streams frames via Socket.io

---

**User clarification on replay granularity (free text):** "replay should play all actions in the movement phase at the same time and take 1 sec per movement step"

| Option                             | Description                                                   | Selected |
| ---------------------------------- | ------------------------------------------------------------- | -------- |
| 1 second per individual piece move | Each MOVE event in the event log = 1 replay frame = 1 second. | ✓        |
| All moves animate simultaneously   | Full movement phase = 1 frame, all pieces jump at once.       |          |

**User's choice:** 1 second per individual piece move (each MOVE event = 1 second replay frame)

---

## Claude's Discretion

- New ActionEvent subtypes for actions not yet in the event log (High Pass, Long Ball, etc.)
- HALF_TIME and FULL_TIME screen layouts
- KICK_OFF_SETUP client UX: zone tinting, "Ready" button disabled state with constraint feedback
- Replay setInterval management on the server (cleanup on room deletion)

## Deferred Ideas

- Replay pause/scrub controls — auto-play only in Phase 8
- Persistent room reuse for rematch — "Play Again" returns to lobby in Phase 8
- GK quick-throw target hex delivery — deferred from Phase 7, still deferred beyond Phase 8
