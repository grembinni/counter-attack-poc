# Phase 27: Game Creation Settings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 27-Game Creation Settings
**Areas discussed:** Settings screen trigger & flow, Draft pool selection UI, Standard mode speed relocation, Draft mode settings summary

---

## Settings Screen Trigger & Flow

| Option                          | Description                                                                                                                           | Selected |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Host only, after Create Room    | Host lands on settings screen right after Create Room; joiner skips it and goes straight to waiting/team-selection once host confirms | ✓        |
| Both players see it, host edits | Both host and joiner land on a settings screen; joiner sees it read-only                                                              |          |
| After Join Room too             | Settings screen appears for host immediately, and again (read-only) for joiner once they join                                         |          |

**User's choice:** Host only, after Create Room.

| Option                            | Description                                                                                                       | Selected |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| Broadcast on room join            | Server sends current settings state as part of room/join payload, mirroring existing TEAM_SPEED_CHANGED broadcast | ✓        |
| New dedicated settings-sync event | Add a new socket event fired whenever host confirms/changes settings                                              |          |

**User's choice:** Broadcast on room join.

| Option                               | Description                                                                         | Selected |
| ------------------------------------ | ----------------------------------------------------------------------------------- | -------- |
| Locked once confirmed                | Settings final once host clicks confirm; no re-editing                              | ✓        |
| Editable until team selection starts | Host can return to settings and change them any time before both players pick teams |          |

**User's choice:** Locked once confirmed.

| Option                                      | Description                                                                              | Selected |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| Host configures solo, before joiner arrives | Host sees settings screen immediately on room creation, no dependency on joiner presence | ✓        |
| Wait for joiner first                       | Settings screen only appears once a second player has joined                             |          |

**User's choice:** Host configures solo, before joiner arrives.

**Notes:** None beyond selections — all recommended options accepted.

---

## Draft Pool Selection UI

| Option                 | Description                                                                                             | Selected |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| All 5 shown, 3 enabled | Original, MLS, International, Legends, Icons all listed; Legends/Icons disabled/greyed as "coming soon" | ✓        |
| Only 3 shown           | Just Original, MLS, International shown now                                                             |          |

**User's choice:** All 5 shown, 3 enabled.

| Option                         | Description                                                                 | Selected |
| ------------------------------ | --------------------------------------------------------------------------- | -------- |
| Disable Confirm button         | Confirm stays disabled until at least one of the 3 enabled pools is checked | ✓        |
| Allow click, show inline error | Confirm always clickable; error shown if none checked                       |          |

**User's choice:** Disable Confirm button.

| Option               | Description                                          | Selected |
| -------------------- | ---------------------------------------------------- | -------- |
| Original pre-checked | Original checked by default when Draft mode selected | ✓        |
| None pre-checked     | All checkboxes start unchecked                       |          |

**User's choice:** Original pre-checked.

---

## Standard Mode Speed Relocation

| Option                               | Description                                                                                      | Selected |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | -------- |
| Remove from both screens             | Speed set once on pre-step, never shown interactively again                                      |          |
| Remove from TeamSelectionScreen only | Keep on UniformSelectionScreen as secondary reminder                                             |          |
| (User's own answer)                  | It can remain in both but should be the same info subheader element, not an interactable element | ✓        |

**User's choice:** Custom — keep the speed element on both `TeamSelectionScreen.tsx` and `UniformSelectionScreen.tsx`, but convert it to a non-interactive read-only info subheader (same treatment used for the Draft-mode settings summary), rather than removing it outright.

| Option                          | Description                                                                                                | Selected |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| Fully hidden until gameplay     | No speed indicator shown again until the match starts                                                      |          |
| Small read-only label somewhere | Show a small non-interactive label reminding both players of the chosen speed                              | (base)   |
| (User's own answer)             | Small read-only label, and if it fits, a small mention on the scoreboard to remind players during gameplay | ✓        |

**User's choice:** Custom — small read-only label pre-game, plus (if it fits the layout) a small scoreboard mention during gameplay.

**Notes:** Both answers were free-text customizations of the presented options — the user wants speed visible as passive/read-only UI throughout, not just relocated to one screen and then hidden.

---

## Draft Mode Settings Summary

| Option                                      | Description                                                                           | Selected |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| Read-only info subheader                    | Same subheader treatment as relocated Standard-mode speed label; non-interactive text | ✓        |
| Read-only with 'Edit' link back to settings | Same subheader text, plus a link/button back to the settings pre-step                 |          |

**User's choice:** Read-only info subheader (consistent with settings being locked once confirmed).

---

## Claude's Discretion

- Exact subheader visual styling/placement within TeamSelectionScreen/UniformSelectionScreen layout.
- Technical feasibility of the scoreboard speed mention — acceptable to omit and flag as follow-up if it doesn't fit cleanly.
- Exact wording of the "coming soon" indicator for Legends/Icons pool checkboxes.

## Deferred Ideas

- Legends and Icons draft pools being selectable (tracked separately as DRAFT-11) — shown but disabled in this phase.
- Editing settings after confirmation (e.g., an edit-back link from the Draft summary) — explicitly decided against; settings lock once confirmed.
