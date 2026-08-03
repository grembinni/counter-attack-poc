# Phase 36: Bug Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 36-Bug Fixes
**Areas discussed:** Game Settings Back button, Duplicate players in packs, Draft pool restriction, Undo boundary exact behavior, Loose-ball fix depth, Tier fallback cascade

---

## Game Settings Back button

| Option              | Description                                                             | Selected                                  |
| ------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| Landing screen      | Returns host all the way to landing (no meaningful intermediate screen) | ✓                                         |
| Cancel + leave room | Explicit teardown before returning                                      | (folded into teardown mechanism question) |

**User's choice:** Landing screen.
**Notes:** Confirmed via code trace that the room already exists server-side (`App.tsx` `onRoomJoined`) before `GameSettingsScreen` renders.

| Option                         | Description                                             | Selected |
| ------------------------------ | ------------------------------------------------------- | -------- |
| New LEAVE_ROOM event           | Explicit immediate teardown, no lingering window        | ✓        |
| Reuse disconnect + grace timer | Simpler client-side, but room stays joinable up to ~90s |          |

**User's choice:** New LEAVE_ROOM event.

**Scope clarification (free text):** "I just want this on the game setting page were speed and draft are set - not on the uniform or formation pages" — Back button scoped only to `GameSettingsScreen`, explicitly excluding Uniform Selection and Lineup/Formation screens.

| Option                       | Description                                   | Selected |
| ---------------------------- | --------------------------------------------- | -------- |
| Disable Back once away joins | Prevents yanking room from a connected player |          |
| Always allow Back            | Away player handles room-gone error           | ✓        |

**User's choice:** Always allow Back.
**Notes:** "always allow back because the code to allow the away player to join isnt given until the next screen" — user's reasoning is the away-joins-during-settings race is a non-issue in practice since the room code isn't shared with the away player until later.

---

## Duplicate players in packs

| Option                        | Description                           | Selected |
| ----------------------------- | ------------------------------------- | -------- |
| Yes, match-wide unique        | Overrides documented Phase 30 D-18    | ✓        |
| No, just confirm within-round | No behavior change, just verification |          |

**User's choice:** Match-wide unique (reverses D-18).
**Notes:** Flagged supply-exhaustion risk — round 1 needs 8 unique GKs but the pool only has 1 GK per real team (4 in 'original', 6 in MLS, 6 in International).

| Option                                  | Description                                           | Selected |
| --------------------------------------- | ----------------------------------------------------- | -------- |
| Let it throw                            | Keep existing fail-closed "insufficient supply" error |          |
| Fall back to other pools when exhausted | Allow D-11 chain to pull additional unique players    | ✓        |

**User's choice:** Fall back to other pools when exhausted.

---

## Draft pool restriction

| Option                         | Description                                                | Selected |
| ------------------------------ | ---------------------------------------------------------- | -------- |
| Audit + regression tests       | Confirm D-11 fallback only activates when genuinely needed | ✓        |
| Surface fallback to the player | Also show in UI/log when a card was backfilled             |          |

**User's choice:** Audit + regression tests.

---

## Undo boundary exact behavior

| Option                    | Description                                  | Selected |
| ------------------------- | -------------------------------------------- | -------- |
| Stop at the boundary      | Undo still works after the roll, stops at it | ✓        |
| Fully disabled after roll | Undo disabled for rest of move               |          |

**User's choice:** Stop at the boundary.

---

## Loose-ball fix depth

| Option                              | Description                         | Selected |
| ----------------------------------- | ----------------------------------- | -------- |
| Root-cause fix + targeted tests     | Fix the specific reported scenario  | ✓        |
| Broader block/deflection test sweep | Also cover other angle combinations |          |

**User's choice:** Root-cause fix + targeted tests.

---

## Tier fallback cascade (raised by user via free text)

**User's initial framing:** "player pool limits - if a player is not available for a tier in a pack pull from a lower tier."

| Option                            | Description                                     | Selected |
| --------------------------------- | ----------------------------------------------- | -------- |
| Cross-pool first, then lower-tier | Preserves D-11 order                            |          |
| Lower-tier first, then cross-pool | Prioritizes pool restriction over tier accuracy | ✓        |

**User's choice:** Lower-tier first, then cross-pool.

| Option                        | Description                                    | Selected              |
| ----------------------------- | ---------------------------------------------- | --------------------- |
| Cascade all the way to common | Maximizes avoiding duplicate/exhaustion errors | ✓ (with modification) |
| Drop exactly one tier level   | Simpler, falls through sooner                  |                       |

**User's choice (free text):** "cascade all the way to common. only pull common from cross-pool. dont pull in higher tier players" — cascades same-pool tier-by-tier down to common; cross-pool fallback restricted to common-tier cards only; never substitutes a higher tier than a slot originally required.

---

## Claude's Discretion

- Exact naming/payload shape of the new `LEAVE_ROOM` socket event.
- Exact data structure for threading the match-wide "already-used" player-id set through `generateDraftPacks`.
- Whether the pool-restriction audit surfaces any pre-existing gap beyond what D-08/D-09 redefine.

## Deferred Ideas

None raised this session beyond the two already-folded todos (loose-ball path origin, undo dice-roll boundary), which were folded at the start of discussion via the todo cross-reference step.
