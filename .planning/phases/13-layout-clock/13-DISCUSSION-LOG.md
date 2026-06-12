# Phase 13: Layout & Clock - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 13-layout-clock
**Areas discussed:** Top section structure, Clock mechanics, HALF/FULL TIME screen integration, Sidebar component fate

---

## Top Section Structure

| Option                         | Description                                   | Selected |
| ------------------------------ | --------------------------------------------- | -------- |
| Two stacked rows               | Scoreboard row then action/log row below      |          |
| Single combined row            | All content in one horizontal top band        | ✓        |
| Scoreboard + collapsible panel | Scoreboard always visible; action/log toggles |          |

**User's choice:** Single combined row — one wide top band with scoreboard at the edges and action content in the middle.

**Notes:** User provided a detailed ASCII layout sketch:

```
[home score] [time/connection/phase summary] [player card] [actions] [logs→] [away score]
```

- Home score on far left, away score on far right
- Center section: time (~40%), connection (~5%), phase/step summary (~55%)
- Player card compact skills grid to the right of the center
- Action buttons to the right of player card
- Log section on far right, collapsed by default (arrow indicates it expands rightward)
- Top band expanded by default; only the log section collapses by default
- "Counter Attack" title text removed; replaced by functional scoreboard content
- Sidebar removed entirely

---

## Sidebar / Component Fate

| Option                   | Description                                   | Selected |
| ------------------------ | --------------------------------------------- | -------- |
| Sidebar removed entirely | All content moves to top band                 | ✓        |
| Reduced sidebar          | Narrower sidebar retained for some components |          |

**User's choice:** Sidebar removed entirely. All components move to top band.

**Notes:**

- TurnIndicator retired; its data (active team, phase label, moves remaining) absorbed into center section of top band. Score dropped from TurnIndicator — already in scoreboard.
- PlayerStatsPanel replaced by compact inline player card in top band. Shows last-selected piece; persists last selection rather than going blank.
- KickOffSetupPanel and ReplayPanel slot into the action section (same phase-swap logic as before).
- Icons for buttons/logs noted but deferred to future polish phase.

---

## Clock Mechanics

| Option                     | Description                                                  | Selected |
| -------------------------- | ------------------------------------------------------------ | -------- |
| Client-side timer          | React useInterval counts real seconds between server updates |          |
| Event-driven only          | Clock updates on server broadcast only                       | ✓        |
| Server pushes time updates | Server emits periodic tick events                            |          |

**User's choice:** Event-driven only — clock updates on server GameState broadcast.

| Option                    | Description                          | Selected |
| ------------------------- | ------------------------------------ | -------- |
| 1 turn = 1 game minute    | Reuse existing actionCount semantics | ✓        |
| Decouple from actionCount | Separate real-time clock             |          |
| You decide                | Implementation detail                |          |

**User's choice:** Use existing actionCount / time weight. "There is existing time weight to actions - use that."

**Second half clock:**

| Option                | Description                                               | Selected |
| --------------------- | --------------------------------------------------------- | -------- |
| Carry forward from 45 | actionCount keeps incrementing; display follows naturally | ✓        |
| Reset to 0            | Second half starts at 0:00                                |          |
| You decide            |                                                           |          |

**User's choice:** Carry forward from 45.

**Notes:** Display format is MM:00 — actionCount as minutes, seconds always :00 since event-driven. Clock visible in every phase (no PLAY_PHASES filter).

---

## HALF/FULL TIME Screen Integration

| Option                               | Description                                      | Selected |
| ------------------------------------ | ------------------------------------------------ | -------- |
| Route through GameBoard              | Remove separate screen routing from App.tsx      | ✓        |
| Add shared Scoreboard to each screen | Keep separate routes, share Scoreboard component |          |

**User's choice:** Route through GameBoard for all screens (Recommended). HalfTimeScreen and FullTimeScreen become overlays inside GameBoard.

**Notes:**

- REPLAY already routes through GameBoard — clock shows automatically.
- CLOCK-02 satisfied: top band always visible regardless of phase.
- HalfTimeScreen/FullTimeScreen content rendered as centered overlay over the pitch when phase is HALF_TIME/FULL_TIME.

---

## Claude's Discretion

- Exact pixel dimensions of top band sections and proportional widths
- Visual design of the collapsed/expanded log section toggle
- Compact player card visual layout (label+value pairs, typography)
- Connection status indicator positioning within center section

## Deferred Ideas

- **Icon enhancements** — Simple Unicode/SVG icons on action buttons and log entry prefixes. User confirmed this belongs in a future visual polish phase.
