# Phase 29: Draft UI + Pick-and-Swap Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 29-Draft-UI-Pick-and-Swap-Flow
**Areas discussed:** Pack swap mechanics, Real-time pick coordination (merged into Bench & lineup interaction), Card visual design

---

## Pack Swap Mechanics

| Option               | Description                                                                           | Selected |
| -------------------- | ------------------------------------------------------------------------------------- | -------- |
| Yes, that's the flow | pick1+swap, pick2+swap, pick1(3 discarded), open new pack — matches PACKS_PER_MATCH=8 | ✓        |
| No cross-player swap | Each player only opens/picks their own packs                                          |          |
| Something else       | —                                                                                     |          |

**User's choice:** Confirmed the derived pick-swap-pick-swap-pick-open sequence.

| Option                    | Description                          | Selected |
| ------------------------- | ------------------------------------ | -------- |
| Discarded                 | 3 leftover cards never enter play    | ✓        |
| Returned to a shared pool | Leftovers feed back into a draw pool |          |
| Something else            | —                                    |          |

**User's choice:** Discarded.

| Option             | Description                              | Selected     |
| ------------------ | ---------------------------------------- | ------------ |
| Wait for both      | Mutual-wait gate, mirrors LINEUP_CONFIRM | ✓ (modified) |
| Independent pacing | No gate, each player proceeds freely     |              |
| Something else     | —                                        |              |

**User's choice:** "Making a pick should trigger ready whether its for pack swap or next pack. Dont have an additional manual ready trigger." — mutual-wait gate confirmed, but readiness is implicit in the pick action itself, no separate confirm.

| Option                         | Description                                                        | Selected     |
| ------------------------------ | ------------------------------------------------------------------ | ------------ |
| Yes, fixed pre-generated order | Packs already exist from settings-confirm, assigned in fixed order | ✓ (modified) |
| Something else                 | —                                                                  |              |

**User's choice:** Fixed pre-generated order confirmed, but packs must be **randomly assigned** to which player gets which pack (not a fixed packs[0-3]=home convention).

---

## Real-time Pick Coordination / Bench & Lineup Interaction

| Option                 | Description                            | Selected           |
| ---------------------- | -------------------------------------- | ------------------ |
| Yes, immediate lock-in | Click = committed pick, no undo        |                    |
| Select then confirm    | Highlight then separate confirm button |                    |
| Something else         | —                                      | ✓ (major redirect) |

**User's choice:** Redirected the entire interaction model: "Use the lineup view as a baseline. Add draft options in a carousel same as bench but over the lineup. Dragging a draftable player card to a position on the lineup or to the bench chooses that player. Players cannot be move from lineup or bench to the draft row. Replacing an existing player in the lineup moves that player to the bench. Player can move players around between the bench and lineup freely through the draft process."

**Notes:** This merges the draft-pick step and the lineup-placement step into one drag-and-drop interaction on `LineupAssignmentScreen`, rather than a separate pick screen followed by a separate lineup screen.

| Option                           | Description                                                        | Selected |
| -------------------------------- | ------------------------------------------------------------------ | -------- |
| Waiting indicator, pack disabled | Own drafted cards shown + waiting state, pack interaction disabled | ✓        |
| No visible change                | Pack doesn't refresh until both done                               |          |
| Something else                   | —                                                                  |          |

**User's choice:** Waiting indicator, pack disabled.

| Option              | Description                                                   | Selected |
| ------------------- | ------------------------------------------------------------- | -------- |
| Yes, resume exactly | Re-sync current pack/pick state on reconnect within 90s grace | ✓        |
| Something else      | —                                                             |          |

**User's choice:** Yes, resume exactly.

| Option               | Description                                                                                             | Selected |
| -------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| Yes, same convention | DRAFT_PICK client event, per-socket private state update, mirrors LINEUP_SWAP/LINEUP_ASSIGNMENT_UPDATED | ✓        |
| Something else       | —                                                                                                       |          |

**User's choice:** Yes, same convention.

**Follow-up 1 — Post-draft auto-position (reconciling DRAFT-10):**

| Option                         | Description                                                            | Selected     |
| ------------------------------ | ---------------------------------------------------------------------- | ------------ |
| Auto-fill unplaced only        | Auto-position fills only what's left unplaced, manual placement stands | ✓ (modified) |
| Full auto-position always runs | Overrides all manual placement                                         |              |
| Something else                 | —                                                                      |              |

**User's choice:** "Just auto-number, don't reposition. Bench players can be random (15-99)." — no repositioning at all (stronger than "auto-fill unplaced only"); only jersey numbering is automatic, and bench numbers are random 15-99, not sequential.

**Follow-up 2 — Formation-first:**

| Option                      | Description                                                                        | Selected     |
| --------------------------- | ---------------------------------------------------------------------------------- | ------------ |
| Yes, formation chosen first | Formation/team/jersey selected before draft screen, empty slots visible from start | ✓ (modified) |
| Something else              | —                                                                                  |              |

**User's choice:** "the current formation, team, and jersey selection happens before draft. team is for team colors/name only" — confirmed, with the clarification that "team" in Draft mode only supplies cosmetics (colors/name), not the player pool.

**Follow-up 3 — Role matching:**

| Option          | Description                              | Selected     |
| --------------- | ---------------------------------------- | ------------ |
| Role-restricted | Only compatible roles droppable per slot |              |
| Free placement  | Any player, any slot                     | ✓ (modified) |

**User's choice:** "only GK to GK, outside that restriction - free placement" — GK slot restricted to GK cards; every other slot is unrestricted.

**Follow-up 4 — Cycle gating vs. UI rearrangement:**

| Option           | Description                                                  | Selected |
| ---------------- | ------------------------------------------------------------ | -------- |
| Yes, independent | Cycle-advance logic unaffected by bench/lineup rearrangement | ✓        |
| Something else   | —                                                            |          |

**User's choice:** Yes, independent.

**Follow-up 5 — REQUIREMENTS.md conflict check (bench numbering):**

| Option                       | Description                                                               | Selected |
| ---------------------------- | ------------------------------------------------------------------------- | -------- |
| Yes, random 15-99 is correct | Overrides DRAFT-10's "sequential" text; flag for a REQUIREMENTS.md update | ✓        |
| Actually, sequential         | Revert to requirement text as written                                     |          |

**User's choice:** Yes, random 15-99 is correct.

---

## Card Visual Design

| Option               | Description                                                         | Selected |
| -------------------- | ------------------------------------------------------------------- | -------- |
| Confirm as specified | Gold/silver/bronze/blue/green for chase/rare/uncommon/common/keeper | ✓        |
| Different mapping    | —                                                                   |          |

**User's choice:** Confirmed as specified (matches Phase 28's forward-pointer).

| Option                          | Description                | Selected |
| ------------------------------- | -------------------------- | -------- |
| Name + role + tier + total stat | Compact card content       |          |
| Full 9-stat breakdown           | All individual stats shown |          |
| Something else                  | —                          | ✓        |

**User's choice:** "It should display the same content as the current card - just temporary badge to indicate rarity" — reuse existing `LineupStatCard` content unchanged, add a rarity indicator only.

| Option                           | Description         | Selected |
| -------------------------------- | ------------------- | -------- |
| Yes, separate /gsd-ui-phase pass | Defer visual polish |          |
| No, capture visual details now   | —                   | ✓        |

**User's choice:** Capture visual details now (led to the follow-up questions below).

| Option                            | Description                                     | Selected |
| --------------------------------- | ----------------------------------------------- | -------- |
| Disappears after completion       | Pack carousel row goes away once draft finishes | ✓        |
| Stays visible (collapsed/summary) | —                                               |          |
| Something else                    | —                                               |          |

**User's choice:** Disappears after completion.

**Follow-up 1 — Badge style:**

| Option               | Description              | Selected |
| -------------------- | ------------------------ | -------- |
| Colored border/frame | Full-card colored border | ✓        |
| Corner badge/icon    | Small corner overlay     |          |
| Something else       | —                        |          |

**User's choice:** Colored border/frame.

**Follow-up 2 — Carousel layout:**

| Option                | Description                       | Selected     |
| --------------------- | --------------------------------- | ------------ |
| All 7 visible at once | Flat horizontal row, no scrolling |              |
| Scrollable/paged      | Fewer at a time, navigate         | ✓ (modified) |
| Something else        | —                                 |              |

**User's choice:** "Standard left right carousel. Rarest should populate left, view should start from the left. Easily supports any changes in pack size." — scrollable/navigable carousel, sorted rarest-to-common left-to-right, starts scrolled left, must handle variable pack sizes (6-card keeper-safety pack).

**Follow-up 3 — Bench display:**

| Option                        | Description                                                       | Selected |
| ----------------------------- | ----------------------------------------------------------------- | -------- |
| Yes, same style, below lineup | Bench mirrors draft-pack card style, positioned below lineup grid | ✓        |
| Different treatment           | —                                                                 |          |
| Something else                | —                                                                 |          |

**User's choice:** Yes, same style, below lineup.

**Follow-up 4 — Empty slot appearance:**

| Option                     | Description                                      | Selected |
| -------------------------- | ------------------------------------------------ | -------- |
| Reuse existing placeholder | Existing LineupAssignmentScreen empty-slot style | ✓        |
| Something else             | —                                                |          |

**User's choice:** Reuse existing placeholder.

---

## Claude's Discretion

- Whether lineup/bench rearrangement is allowed while waiting on the opponent's pick — not explicitly restricted; leaning toward allowed since it's independent of cycle state.
- Whether the 4th-cycle auto-selected keeper (DRAFT-08) is auto-placed directly into the GK slot vs. dropped onto the bench — leaning toward auto-placing into the empty GK slot if unfilled.
- Exact module/component layout for the new draft-pack carousel (new file vs. extending `LineupAssignmentScreen.tsx`).
- Exact new Socket.io event names — follow `events.ts` naming conventions.

## Deferred Ideas

- Full auto-position-by-stat-weight for Draft mode (a literal DRAFT-10 reading) — decided against, not deferred to a future phase.
- REQUIREMENTS.md DRAFT-10 wording update (sequential → random 15-99) — should happen alongside or shortly after this phase ships; not a blocking dependency.
