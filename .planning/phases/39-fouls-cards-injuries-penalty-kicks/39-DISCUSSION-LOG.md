# Phase 39: Fouls, Cards, Injuries & Penalty Kicks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-09
**Phase:** 39-Fouls, Cards, Injuries & Penalty Kicks
**Areas discussed:** Foul resolution & restart choice, Cards & injuries — visual indicators, GK dive-at-feet & penalty kick flow, Settings toggle UI

---

## Foul resolution & restart choice

| Option                         | Description                                                                                                         | Selected |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------- |
| New two-button panel           | Dedicated "Continue Play" / "Take the Free Kick" panel after injury/booking results, mirroring Phase 35 conventions | ✓        |
| Fold into existing ActionPanel | Add "Take Free Kick" as one more eligible-action option on the post-tackle/steal ActionPanel                        |          |
| Auto-restart, no choice        | Skip the choice entirely, always go to FREE_KICK_SETUP                                                              |          |

**User's choice:** New two-button panel (Recommended)

| Option                         | Description                                                                                | Selected   |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ---------- |
| Sequential banners, then panel | Foul banner → Injury banner → Booking banner → continue/restart panel, EventBanner pattern | (modified) |
| Single combined result panel   | One panel shows foul + injury + booking + choice buttons together                          |            |
| Action log only, no banner     | No transient banners, ActionLog entries only                                               |            |

**User's choice:** Mostly the recommended sequential-banner option, with a modification — logs (with die results) should exist for every roll regardless of outcome, but banners should only appear when there's an actual impact on play: banner on foul called, banner if there is an injury (not if the check fails), banner if there is a booking (not if no card issued), then the continue/restart panel.
**Notes:** Captured as D-02.

| Option                       | Description                                                              | Selected   |
| ---------------------------- | ------------------------------------------------------------------------ | ---------- |
| Distinct banner/label        | "Professional Foul!" banner/badge before the straight-red-vs-yellow roll | (modified) |
| Same UI, different roll math | No special visual treatment, just different underlying roll logic        |            |

**User's choice:** Keep the standard banner flow, but when a straight red results from the last-man/Professional Foul logic, the booking banner shows a "DOGSO" label plus a colored rectangle badge matching the card color — and that colored badge should be part of every booking banner generally (reflecting whichever card color is being assigned), not just the DOGSO case.
**Notes:** Captured as D-03.

**Side discussion — referee leniency roll:** User asked whether the referee's `leniency` roll (currently a single d6, also feeds added-time calc) should change to 2d6-take-highest. After being shown the added-time side effect, user reconsidered and confirmed to leave it unchanged. Captured as "Explicitly reconsidered, no change" in CONTEXT.md.

---

## Cards & injuries — visual indicators

| Option                      | Description                                                          | Selected   |
| --------------------------- | -------------------------------------------------------------------- | ---------- |
| Small badge on the piece    | Persistent colored badge on the piece SVG, matching the banner badge | (combined) |
| Roster/lineup panel only    | No on-board indicator, roster panel only                             |            |
| Both board badge and roster | Both                                                                 | ✓          |

**User's choice:** Both board badge and roster.

| Option                  | Description                                               | Selected   |
| ----------------------- | --------------------------------------------------------- | ---------- |
| Small icon on the piece | Distinct icon (e.g. cross/plus), separate from card badge | (combined) |
| No visual indicator     | Injury only affects underlying attributes, no visual cue  |            |

**User's choice:** Both board badge and roster, same as card.

**Follow-up (free text):** Icons on the board should be the same size as the soccer-ball possession indicator. Rectangle for yellow card, plus sign for injury. Positioned in the corner of the piece opposite the ball-possession dot. If a player is both injured and carded, the injury icon layers over the card icon.
**Notes:** Captured as D-04/D-05.

| Option                                  | Description                                                | Selected |
| --------------------------------------- | ---------------------------------------------------------- | -------- |
| Always fall back to degraded attributes | Phase 39 always takes the "no substitute available" branch | ✓        |
| Build a stub substitution hook now      | Add a placeholder hook Phase 40 later fills in             |          |

**User's choice:** Always fall back to degraded attributes (Recommended). Captured as D-06.

---

## GK dive-at-feet & penalty kick flow

| Option                                  | Description                                                   | Selected |
| --------------------------------------- | ------------------------------------------------------------- | -------- |
| Explicit prompt each qualifying step    | Panel pops up each time carrier ends a move in range/parallel | ✓        |
| Single toggle armed for the whole cycle | Armed once, auto-fires on first entry                         |          |

**User's choice:** Explicit prompt each qualifying step (Recommended). Captured as D-07.

| Option                         | Description                                                             | Selected |
| ------------------------------ | ----------------------------------------------------------------------- | -------- |
| Turn-based, like Corner Kick   | Sequential attacker-then-defender window, same precedent as Corner Kick | ✓        |
| Free-drag, like Kick-Off setup | Unconstrained one-step placement                                        |          |

**User's choice:** Turn-based, like Corner Kick (Recommended). Captured as D-08.

**Follow-up (free text):** Dive-at-feet should only trigger once per movement round (4-5-2) — reaffirms GKDIVE-05. Diving for the ball (dive-at-feet) disables the keeper from diving to block a shot (existing `GK_DIVE` phase) during the same movement round. Additionally: the first time the ball comes into the penalty box from any pass, shot, move, or loose ball, the keeper can response-move 1 space.
**Notes:** Captured as D-09 (shared cap between dive-at-feet and shot-block dive) and D-10 (new box-entry response-move capability).

**Scope check — box-entry response move:** Confirmed with the user that this "ball enters box → GK 1-hex move" idea isn't covered by any locked GKDIVE requirement.

| Option                         | Description                                                      | Selected |
| ------------------------------ | ---------------------------------------------------------------- | -------- |
| Build it now, part of Phase 39 | Expand scope to include this new mechanic                        | ✓        |
| Defer to a future phase        | Note as a backlog idea, ship only the locked GKDIVE requirements |          |

**User's choice:** Build it now, part of Phase 39.

**Follow-up questions on the new mechanic:**

| Option                       | Description                                                      | Selected |
| ---------------------------- | ---------------------------------------------------------------- | -------- |
| Prompted choice              | Panel lets the defending manager choose to move 1 hex or decline | ✓        |
| Automatic best-position move | Engine auto-repositions, no manager choice                       |          |

**User's choice:** Prompted choice (Recommended).

| Option                                   | Description                                    | Selected |
| ---------------------------------------- | ---------------------------------------------- | -------- |
| Independent — its own once-per-cycle cap | Separate cap from dive-at-feet/shot-block dive | ✓        |
| Shares the same cap                      | All three GK actions draw from one allowance   |          |

**User's choice:** Independent — its own once-per-cycle cap (Recommended). Captured as D-11.

---

## Settings toggle UI

| Option                     | Description                                                      | Selected |
| -------------------------- | ---------------------------------------------------------------- | -------- |
| Grey out when Fouls is off | Booking/Injury checkboxes disabled, mirroring Draft Pool pattern | ✓        |
| Stay clickable, just inert | No visual coupling between toggles                               |          |

**User's choice:** Grey out when Fouls is off (Recommended). Captured as D-13.

| Option                              | Description                   | Selected   |
| ----------------------------------- | ----------------------------- | ---------- |
| Default off, matching Out-of-Bounds | 3 new toggles start unchecked | (modified) |
| Default on                          | 3 new toggles start checked   | (modified) |

**User's choice:** All 4 toggles (Out-of-Bounds, Fouls, Booking, Injury) should default on — not just the 3 new ones.
**Notes:** Follow-up question confirmed this explicitly includes flipping the existing Out-of-Bounds/Restarts default (Phase 37's `outOfBounds=false`) to on as well. User confirmed yes. Captured as D-14.

**Side discussion — 2 unrelated bugs raised by the user:**

1. Loose-ball log doesn't show direction/distance-die-roll — investigated: `LOOSE_BALL_LAND` event has no direction/roll fields at all today, only from/to coordinates. User confirmed the fix is to add those fields to the event and log. Captured as D-15.
2. Second-half-start button only actionable by one team, not both — investigated: `canStart = myTeam !== kickOffTeam` (D-28) means only the non-kickoff team can start. User confirmed this should become a mutual both-teams-confirm gate, mirroring the existing `LINEUP_CONFIRM` pattern. Captured as D-16.

**Scope check:** Confirmed with the user that these two bugs are unrelated to the fouls/cards/injuries/penalties domain. User chose to fix both now, inside Phase 39, rather than deferring to a backlog todo.

---

## Claude's Discretion

- Exact SVG/CSS implementation of the card-color badge and DOGSO label on banners.
- Exact `GamePhase`/`GameState` field naming for the new Foul/Booking/Injury/GK-Dive/Penalty-Kick chains (follow `GOAL_KICK_*`/`CORNER_KICK_*` convention).
- Internal code organization for the new box-entry response-move mechanic, so long as it's presented and capped independently as decided.

## Deferred Ideas

None — every scope-adjacent idea raised (box-entry GK response move, the two bug fixes) was explicitly pulled into this phase's scope by the user.

**Reviewed but not folded (generic keyword-match todos, not discussed):**

- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`
- `2026-08-09-bug-offside-ring-after-goal.md`
- `csv-consolidation-player-pool.md`
