# Phase 4: Game Engine + Phase FSM - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 4-game-engine-phase-fsm
**Areas discussed:** FSM slot transitions, Valid move computation + undo/replay, Match initialization, MOVE-06/MOVE-07 scope

---

## FSM Slot Transitions

| Option                                           | Description                                                              | Selected |
| ------------------------------------------------ | ------------------------------------------------------------------------ | -------- |
| Auto-advance when quota met                      | Server counts moves; automatically transitions slot when quota exhausted |          |
| Explicit end-turn event                          | Active player sends `game:end-turn`; server validates and advances       | ✓        |
| Hybrid — auto when quota met, optional early end | Auto when full, but also accepts early end-turn                          |          |

**User's choice:** Explicit end-turn event

| Option                       | Description                                                           | Selected |
| ---------------------------- | --------------------------------------------------------------------- | -------- |
| Yes — quotas always optional | Player can end turn having moved fewer pieces; unused moves forfeited | ✓        |
| No — quota mandatory         | Must exhaust full quota before end-turn accepted                      |          |

**User's choice:** Quotas always optional

| Option                                       | Description                                              | Selected |
| -------------------------------------------- | -------------------------------------------------------- | -------- |
| Auto-transition to PASS                      | After ATTACKER_2 ends, FSM automatically moves to PASS   | ✓        |
| Stay in MOVEMENT, await 'end-movement' event | movementSlot becomes null, explicit event needed to exit |          |

**User's choice:** Auto-transition to PASS after ATTACKER_2

| Option                                           | Description                                                   | Selected |
| ------------------------------------------------ | ------------------------------------------------------------- | -------- |
| One event 'game:end-turn'                        | Single event; server interprets based on current movementSlot | ✓        |
| Separate 'game:end-slot' and 'game:end-movement' | Two distinct events for intra-Movement and exit-Movement      |          |

**User's choice:** One `game:end-turn` event

**Notes:** Initially user said "stay in MOVEMENT until explicit end-movement event" but after re-clarifying the full 3-slot flow, confirmed auto-transition to PASS after ATTACKER_2.

---

## Valid Move Computation + Undo/Replay

| Option                                    | Description                                                         | Selected |
| ----------------------------------------- | ------------------------------------------------------------------- | -------- |
| Client-side using shared library          | Client calls validateMove() locally; no round-trip for highlighting | ✓        |
| Server precomputes in GameState           | validMoves[] included in every broadcasted state                    |          |
| Server on-demand via 'game:request-moves' | Client requests valid hexes; adds latency                           |          |

**User's choice:** Client-side using @counter-attack/shared

| Option                              | Description                                             | Selected |
| ----------------------------------- | ------------------------------------------------------- | -------- |
| Server emits GAME_ERROR with reason | Reject + typed error event + re-broadcast current state | ✓        |
| Server silently drops invalid moves | No response on invalid move                             |          |

**User's choice:** Server emits GAME_ERROR

**User freeform input (undo/replay):** "Design in a way to track game play for end of game replay, and single turn undo - all movement should be able to be undone until player hits end move or a dice is rolled for any decision"

| Option                          | Description                                                | Selected |
| ------------------------------- | ---------------------------------------------------------- | -------- |
| Full pre-turn snapshot          | Full GameState saved at slot start; undo restores snapshot |          |
| Action log with per-move deltas | Each move appended to log; undo pops last entry            | ✓        |

**User's choice:** Action log with per-move deltas

| Option                                | Description                 | Selected |
| ------------------------------------- | --------------------------- | -------- |
| pieceId + from + to + timestamp       | Minimum for replay + undo   |          |
| Full before/after GameState snapshots | Heavy memory use            |          |
| You decide                            | Claude picks minimal format | ✓        |

**User's choice:** Claude's discretion on delta shape

**Notes:** Undo boundary is first SLOT_ADVANCE or DICE_ROLL delta in the log for that slot.

---

## Match Initialization

| Option                         | Description                            | Selected |
| ------------------------------ | -------------------------------------- | -------- |
| Immediately on both-joined     | Full GameState built when slot 2 joins | ✓        |
| On explicit 'game:start' event | Stub LOBBY until explicit start        |          |

**User's choice:** Immediately on both-joined

| Option                             | Description                         | Selected |
| ---------------------------------- | ----------------------------------- | -------- |
| Room creator = home, joiner = away | Deterministic slot-based assignment |          |
| Random coin flip at match start    | Server randomly assigns home/away   | ✓        |

**User's choice:** Random coin flip

| Option                              | Description                                            | Selected |
| ----------------------------------- | ------------------------------------------------------ | -------- |
| 'game:start-kickoff' event required | Kick-off team sends explicit event                     |          |
| FSM auto-advances to KICK_OFF       | Server transitions automatically after GameState build | ✓        |

**User's choice:** Auto-advance LOBBY → KICK_OFF

---

## MOVE-06 / MOVE-07 Scope

| Option                       | Description                                                                | Selected |
| ---------------------------- | -------------------------------------------------------------------------- | -------- |
| Implement MOVE-06 in Phase 4 | Phase 4 encodes pitch regions anyway; MOVE-06 just needs final-third check | ✓        |
| Defer MOVE-06 to Phase 5     | Keep Phase 4 focused                                                       |          |

**User's choice:** Implement MOVE-06 in Phase 4

| Option                       | Description                                                                     | Selected |
| ---------------------------- | ------------------------------------------------------------------------------- | -------- |
| Implement MOVE-07 in Phase 4 | Penalty area check available; SNAPSHOT_AVAILABLE already named in moveValidator |          |
| Defer MOVE-07 to Phase 5     | Resolution dice logic belongs with other Phase 5 branches                       | ✓        |

**User's choice:** Defer MOVE-07 to Phase 5

---

## Claude's Discretion

- Action delta shape: `{ type: ActionEventType, pieceId?: string, from?: HexCoord, to?: HexCoord, slot: MovementSlot | null, timestamp: number }` with discriminated union
- Kick-off hex and starting piece positions: follow physical board convention
- Referee card Leniency attribute range: e.g., 1–10 matching other attributes
- Stub dice for steal attempts in Phase 4: deterministic placeholder pending Phase 5

## Deferred Ideas

- MOVE-07 (snapshot-during-movement resolution) → Phase 5
- Real pitch axial coordinates from physical board measurements → Phase 6 (HARD BLOCK dependency)
