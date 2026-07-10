# Phase 24: Auto-Assignment & Lineup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 24-auto-assignment-lineup
**Areas discussed:** Player info per slot, Lineup screen layout, Swap interaction, Lineup confirmation gate

---

## Player Info Per Slot

| Option                          | Description                                                                                   | Selected |
| ------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| Name + jersey number only       | Clean, uncluttered; auto-assignment already optimized so stats may encourage over-thinking    |          |
| Name + jersey number + key stat | Primary stat for the slot role (e.g., Shooting for ST). Helps players evaluate swap decisions |          |
| Full stat cards (all 9 stats)   | Full PlayerStatsPanel-style card per slot — complete picture for swap decisions               | ✓        |

**User's choice:** "Players should be represented by their stat cards" → full stat cards (all 9 attributes)
**Notes:** Follow-up clarification confirmed the user wants the full PlayerStatsPanel-equivalent (all 9 stats), not a compact variant. Layout must be scrollable given 11 full cards.

---

## Lineup Screen Layout

| Option                                 | Description                                                 | Selected |
| -------------------------------------- | ----------------------------------------------------------- | -------- |
| Flat list grouped by line              | Single scrollable column under GK / DEF / MID / FWD headers |          |
| Two columns                            | Two side-by-side columns; reduces scroll by half            |          |
| Mini-pitch diagram                     | Cards positioned spatially on a pitch background            |          |
| Horizontal pitch (GK left → FWD right) | Columns matching the actual board orientation               | ✓        |

**User's choice:** "Horizontal pitch — GK at left, FWD at right"
**Notes:** Full answer from user: "After players confirm teams it should transition to a new lineup page. The players should be placed in the selected formation by recommended stat values. Each player only views and interacts [with] their players — this should free up room on the display for spacing and size concerns. Players can drag cards over cards to swap player positions. In the future there will be a bench for substitutes, ensure the design supports players coming off the bench."

Key decisions extracted from this answer:

- New dedicated `LineupAssignmentScreen` (not extending UniformSelectionScreen)
- Each player sees only their own team's cards
- Drag-to-swap mechanic (answered the "Swap interaction" area simultaneously)
- Bench row at bottom for future substitutes (v1.4 forward-design)

---

## Swap Interaction

| Option                  | Description                                                               | Selected |
| ----------------------- | ------------------------------------------------------------------------- | -------- |
| Click-first-then-second | Consistent with board's click-to-move; click player A then click player B |          |
| Drag card over card     | HTML5 native drag-and-drop; drag card A onto card B to swap               | ✓        |

**User's choice:** Captured in the layout answer: "Players can drag cards over cards to swap player positions"
**Notes:** Drag-and-drop chosen. GK card is not draggable (ASSIGN-04 lock). Native HTML5 drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — no new library dependency. Server-authoritative: `LINEUP_SWAP` event emitted on drop, client updates from server response.

---

## Lineup Confirmation Gate

| Option                                                       | Description                                                | Selected |
| ------------------------------------------------------------ | ---------------------------------------------------------- | -------- |
| Lineup stays visible — read-only with 'Waiting...' indicator | Cards locked/greyed; player can still review while waiting | ✓        |
| Simple waiting screen                                        | Replaced by plain waiting message; no lineup visibility    |          |

**User's choice:** "Similar messaging to the team selections — indicate it's the player's action if they haven't confirmed yet, indicate waiting for opponent after confirming. Use similar syntax and presentation."
**Notes:** Match `UniformSelectionScreen` verbatim strings:

- Active: `"Make your selections now!"`
- Waiting: `` `Waiting for ${waitingForLabel} Player to Lock in their Selection.` ``
- Heading: `` `MATCH SETUP: STEP ${step} — ${currentPlayerLabel} PLAYER (${youOrOpponent})` ``

Also noted: both players act in parallel for lineup (unlike uniform selection's home-first gate). Server should accept `LINEUP_CONFIRM` from either player in any order.

---

## Claude's Discretion

- Exact event names (`LINEUP_ASSIGNMENT_READY`, `LINEUP_ASSIGNMENT_UPDATED`) — follow existing `ServerEvents` naming convention
- CSS grid layout approach for horizontal formation columns
- Card sizing within horizontal layout
- Whether to extend `PlayerStatsPanel` with a static-data prop variant or create a new `LineupStatCard` component (extending recommended)
- Drag-over visual feedback styling
- `'LINEUP_ASSIGNMENT'` as the Zustand screen type name

## Deferred Ideas

- **Bench substitutes** — User mentioned future substitutes coming off the bench; bench row is scaffolded in Phase 24's design (empty, non-functional) for v1.4 implementation
- **GK_KICK replay gap** (REPLAY-07) — Phase 25 scope
- **KO shading bug** (BUG-23) — Phase 25 scope
- **CSV consolidation** — Phase 25+ scope
