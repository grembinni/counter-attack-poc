# Phase 14: Kick Off Rules & Replay - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 14-kick-off-rules-replay
**Areas discussed:** Kick off column validation, Replay movement batching, Ball tracking in replay

---

## Kick off column validation (MATCH-06)

| Option                          | Description                                                                     | Selected |
| ------------------------------- | ------------------------------------------------------------------------------- | -------- |
| Real-time in GAME_KICK_OFF_MOVE | Reject moves immediately when a midfielder/back tries to land outside cols 6–20 |          |
| At GAME_READY only              | Allow free placement; block confirm if any piece is out of range                |          |
| Both — real-time + Ready-gate   | Belt-and-braces double validation                                               |          |

**User's choice (clarified):** Neither — this is a default start position requirement only, not a movement restriction. Pieces should _start_ in cols 6–20 from `buildInitialGameState`; players can reposition freely during KICK_OFF_SETUP.

**Notes:** User clarified that MATCH-06 is about initial placement before player adjustments, not a runtime constraint. The written REQUIREMENTS.md success criteria ("placing a midfielder or back outside hex columns 6–20 is rejected by the server") does not match the intended behaviour and should be corrected.

---

## MATCH-07 (bonus clarification, same area)

| Option                                             | Description                                                                          | Selected |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Only the direct KICK_OFF phase roll                | Guard in GAME_ROLL when phase === 'KICK_OFF': reject if passType !== 'STANDARD_PASS' | ✓        |
| Both paths — KICK_OFF phase AND kickOffActive flag | Add guard for both direct kick off and movement-first kick off                       |          |

**User's choice:** Only the direct KICK_OFF phase roll.
**Notes:** `kickOffActive` already handles the movement-first path; only the direct KICK_OFF roll path lacks a Standard Pass enforcement.

---

## Replay movement batching (REPLAY-05)

| Option                                                 | Description                                                    | Selected |
| ------------------------------------------------------ | -------------------------------------------------------------- | -------- |
| Server: batch all MOVE events per phase into one frame | Emit a single final-state snapshot per movement phase          |          |
| Server: emit MOVEMENT_PHASE_END event                  | New event type as explicit phase boundary                      |          |
| Client: render all MOVE frames with no delay           | Keep individual frames, remove client-side timing between them |          |

**User's choice:** Step-by-step simultaneous movement — all pieces take their Nth step in the same frame. K frames per movement phase where K = max steps taken by any single piece.

**Notes (free-text response from user):** "batch all moves but emit by step. i.e. if all possible 11 players moved then each player moves their first step at the same time, and then the second step at the same time, etc. Player stop when they have no more steps"

Phase boundaries via SLOT_ADVANCE + non-MOVE events (no schema change):

| Option                                      | Description                                                      | Selected |
| ------------------------------------------- | ---------------------------------------------------------------- | -------- |
| Use existing SLOT_ADVANCE + non-MOVE events | Natural boundaries, no schema change                             | ✓        |
| Add MOVEMENT_PHASE_START / END events       | Explicit brackets, cleaner data model but schema change required |          |

---

## Ball tracking in replay (REPLAY-06)

| Option                                        | Description                                                                                                | Selected |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| Pass events only — good enough                | Update ball.position from existing pass event `to` field; no schema change; shot save/loose-ball imprecise |          |
| Full precision — add ballAfter to every event | Add ballAfter: { position, carrierId } to all ActionEvent types; always exact                              | ✓        |

**User's choice:** Full precision — `ballAfter` required on all replay-eligible events.

Required vs optional:

| Option                                 | Description                                                 | Selected |
| -------------------------------------- | ----------------------------------------------------------- | -------- |
| Required on all replay-eligible events | TypeScript enforces it; no silent gaps                      | ✓        |
| Optional ballAfter                     | Lighter migration but allows gaps to sneak through silently |          |

---

## Claude's Discretion

- REPLAY-04 (double speed): trivial `1000` → `500` ms change in `startReplayStream` setInterval. No user input needed.
- Error code for MATCH-07 rejection: `'KICKOFF_STANDARD_PASS_ONLY'` (consistent with existing SCREAMING_SNAKE error code pattern).

## Deferred Ideas

None — discussion stayed within phase scope.
