# Phase 40: Substitutions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-15
**Phase:** 40-Substitutions
**Areas discussed:** Todo folding, Roster screen/bench/badges, Added-time accumulation, SUB-06 permanent slot cap

---

## Todo Folding

| Item                       | Description                             | Selected              |
| -------------------------- | --------------------------------------- | --------------------- |
| SUB-06 permanent slot cap  | Strong direct match, resolves_phase: 40 | ✓ folded              |
| KICK_OFF_SETUP shading bug | Generic keyword overlap only            | not folded (reviewed) |
| Offside ring after goal    | Generic keyword overlap only            | not folded (reviewed) |
| CSV consolidation idea     | Generic keyword overlap only            | not folded (reviewed) |

**User's choice:** Folded SUB-06 only. Also provided freeform additional notes (see Scope Clarification below).

---

## Scope Clarification (freeform additions)

The user's todo-fold answer included five additional items in freeform text:

1. Hide game toggles under an advanced dropdown
2. Card/injury status on the player card between name and flag, on field and on sub roster
3. Ref leniency max 5 / min 2
4. Display ref leniency on the scoreboard
5. Allow formation change from sub screen

**Follow-up 1 — card/injury badge clarification:**

| Option                     | Description                                                                          | Selected |
| -------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Sub roster only            | Keep Phase 39's on-field badge design as-is; add indicator to sub-roster screen only |          |
| Change on-field design too | Rework existing on-field badge position                                              |          |

**User's choice:** Neither literally — clarified via free text: "I meant on the player card in the top left corner - should match the same style to be done on the sub-roster screen." Resolved as: add badge to the top-left `PlayerStatsPanel` player card (new) AND the sub-roster screen (new), both matching the same style; existing on-pitch piece badge (Phase 39) untouched.

**Follow-up 2 — scope of the other 4 items:**

| Option                   | Description                      | Selected |
| ------------------------ | -------------------------------- | -------- |
| Defer all 4              | Note as deferred backlog ideas   |          |
| Pull formation-change in | Explicitly expand Phase 40 scope |          |

**User's choice:** Initially parsed as "pull formation-change in" based on the free-text answer "defer - Allowing formation change from the sub screen - add the other 3". User corrected this later in the roster-screen area discussion: the intent was "defer [formation change], add the other 3 [to the deferred list]" — i.e., all 4 items are deferred, none pulled into scope. Corrected before CONTEXT.md was written.

**Notes:** This was a genuine misread on Claude's part, caught and corrected by the user mid-discussion.

---

## Roster Screen, Bench Pool & Badges

| Option                      | Description                                      | Selected |
| --------------------------- | ------------------------------------------------ | -------- |
| Full non-starting roster    | Every non-starter automatically available as sub |          |
| Pre-selected matchday squad | New pre-match squad-selection step               |          |

**User's choice:** Neither literally — free text: "this should be the same screen as setting up the lineup. subs should come from the bench." Resolved as D-01/D-02: reuse `LineupAssignmentScreen`'s existing lineup/bench split; no new pre-match step.

| Option            | Description                                                 | Selected |
| ----------------- | ----------------------------------------------------------- | -------- |
| Persistent button | Always-visible button, stoppage-gated, opens modal/overlay  | ✓        |
| Side panel swap   | Existing side panel switches to roster view during stoppage |          |

**User's choice:** Persistent button (research's suggestion).

| Option                          | Description                                                 | Selected |
| ------------------------------- | ----------------------------------------------------------- | -------- |
| Onto on-pitch player's card/row | Drag bench card onto on-pitch row in a list                 |          |
| Onto a lineup-slot grid         | Drag onto formation-shaped grid like LineupAssignmentScreen |          |

**User's choice:** Neither literally — free text: "same screen and process as confirming lineup post-draft/pre-game." Resolved as D-01/D-04: reuse `LineupAssignmentScreen`'s existing grid/drag-drop mechanics verbatim, constrained to single 1-for-1 swaps mid-match.

**Notes:** Confirmed "Next area" after this batch — no further roster-screen questions.

---

## Added-Time Accumulation

| Option               | Description                                                                  | Selected |
| -------------------- | ---------------------------------------------------------------------------- | -------- |
| Running accumulator  | New field incremented by 1 per completed sub, folded into the addedTime roll | ✓        |
| Only count late subs | Only subs after the roll fires increment addedTime directly                  |          |

**User's choice:** Running accumulator.

| Option                   | Description                             | Selected |
| ------------------------ | --------------------------------------- | -------- |
| Yes, per-half            | Accumulator resets to 0 at half-time    | ✓        |
| No, cumulative for match | Accumulator persists across both halves |          |

**User's choice:** Yes, per-half.

**Notes:** Confirmed "Next area" — no further added-time questions.

---

## SUB-06 Permanent Slot Cap

| Option                              | Description                                                       | Selected |
| ----------------------------------- | ----------------------------------------------------------------- | -------- |
| Red-card count reduces max directly | maxOnPitch = 11 - redCardCount, checked independently of subsUsed | ✓        |
| Separate blocked-slots counter      | Functionally similar, different field shape                       |          |

**User's choice:** Red-card count reduces max directly.

| Option                         | Description                                           | Selected |
| ------------------------------ | ----------------------------------------------------- | -------- |
| Gone immediately               | Slot unfillable the instant the red card is shown     | ✓        |
| One grace substitution allowed | Team gets one chance to fill the slot before it locks |          |

**User's choice:** Gone immediately.

**Notes:** Confirmed "Ready for context" after this batch.

---

## Claude's Discretion

- Exact `GameState`/`ActionEvent` field naming for `bench`, `subsUsed`, `addedTimeBonus`, `maxOnPitch`/`redCardCount`.
- Internal mechanics of adapting `LineupAssignmentScreen` for mid-match use (modal vs. in-place).
- Exact placement/sizing of the new top-left player-card badge, so long as it visually matches the sub-roster style.

## Deferred Ideas

- Hide game-creation toggles under an advanced dropdown (Game Settings UI reorganization)
- Referee leniency roll range change (max 5, min 2) — distinct from Phase 39's already-rejected 2d6-take-highest proposal
- Display referee leniency on the scoreboard (new UI feature)
- Allow formation change from the sub screen (new capability beyond SUB-02's single-player-swap wording)
