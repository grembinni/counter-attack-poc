# Phase 7: Client-Server Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 7-client-server-integration
**Areas discussed:** Socket setup, Click interaction scope, Undo button, Board orientation

---

## Socket Setup

### Q1: When should the socket connect?

| Option                | Description                                       | Selected |
| --------------------- | ------------------------------------------------- | -------- |
| On app load           | Socket connects immediately when React app mounts | ✓        |
| On first lobby action | Socket connects when user clicks Create/Join Room |          |

**User's choice:** On app load
**Notes:** Simpler lifecycle — one socket, always connected. Lobby events fire over the already-established connection.

---

### Q2: Where should the socket instance live?

| Option              | Description                                                                 | Selected |
| ------------------- | --------------------------------------------------------------------------- | -------- |
| Module singleton    | `packages/client/src/socket.ts` with `autoConnect: false`, connect on mount | ✓        |
| Zustand store slice | Socket instance inside the Zustand store                                    |          |
| React context       | `SocketContext.Provider` wrapping the app                                   |          |

**User's choice:** Module singleton
**Notes:** Standard pattern for a single-page game with one socket lifetime. Avoids Zustand holding mutable non-serializable objects.

---

### Q3: How should socket event listeners be managed?

| Option                           | Description                                    | Selected |
| -------------------------------- | ---------------------------------------------- | -------- |
| One central useEffect in App.tsx | All server listeners registered once on mount  | ✓        |
| Distributed per-component        | Each component registers its own socket events |          |

**User's choice:** One central useEffect in App.tsx
**Notes:** Prevents double-registration across re-renders. Aligns with Phase 6 pitfall warning about `socket.off` cleanup.

---

## Click Interaction Scope

### Q1: How much click interaction for passing?

| Option                                        | Description                                             | Selected |
| --------------------------------------------- | ------------------------------------------------------- | -------- |
| Full pass flow: select pass type + target hex | Pass type buttons + destination hex click               | ✓        |
| Roll-only for passing                         | Pass type pre-selected, Roll button primary interaction |          |
| Defer full pass UI to Phase 8                 | Wire movement only in Phase 7                           |          |

**User's choice:** Full pass flow
**Notes:** Success criteria explicitly require passing to work end-to-end in Phase 7.

---

### Q2: How should the player declare a shot?

| Option                                    | Description                                   | Selected |
| ----------------------------------------- | --------------------------------------------- | -------- |
| Click a goal hex to declare shot target   | Goal hexes become clickable during SHOT phase | ✓        |
| Direction buttons (left / centre / right) | Three shot-direction buttons                  |          |

**User's choice:** Click a goal hex
**Notes:** Consistent with the click-to-move interaction model. Preserves coordinate precision for GK dive logic.

---

### Q3: What other actions need click wiring in Phase 7?

| Option                                                 | Selected |
| ------------------------------------------------------ | -------- |
| Roll button (DICE_PHASES: PASS/SHOT/HEADER/LOOSE_BALL) | ✓        |
| End Turn button (MOVEMENT)                             | ✓        |
| GK restart choice (kick/throw/movement)                | ✓        |
| Start Movement button (KICK_OFF)                       | ✓        |

**User's choice:** All four
**Notes:** All action buttons wired in Phase 7 to support the full game loop.

---

## Undo Button

### Q1: Where should the Undo button appear?

| Option                                 | Description                                              | Selected |
| -------------------------------------- | -------------------------------------------------------- | -------- |
| In the action panel alongside End Turn | Right-side control panel, grouped with movement controls | ✓        |
| On the TurnIndicator                   | Near current player's name                               |          |
| Floating overlay on the board          | Over the hex grid                                        |          |

**User's choice:** Action panel alongside End Turn
**Notes:** Both are movement-phase controls — grouping makes their relationship clear.

---

### Q2: How does Undo know when to disable?

| Option                                   | Description                                         | Selected |
| ---------------------------------------- | --------------------------------------------------- | -------- |
| Check `lastDiceRoll` in GameState        | `lastDiceRoll` set = dice committed = Undo disabled | ✓        |
| Separate `undoAvailable` flag in Zustand | Explicit boolean, set to false on dice result       |          |

**User's choice:** Check `lastDiceRoll` in GameState
**Notes:** `lastDiceRoll` already exists in GameState (Phase 5 D-11). No extra state to maintain.

---

### Q3: How to handle opponent's tab (UNDO-03)?

| Option                                   | Description                             | Selected |
| ---------------------------------------- | --------------------------------------- | -------- |
| Conditionally render based on playerSlot | Not shown at all for opponent           | ✓        |
| Render but disable for opponent          | Always visible, greyed out for opponent |          |

**User's choice:** Conditionally render based on playerSlot
**Notes:** UNDO-03 says "shows no Undo control" — not shown at all, not just disabled.

---

## Board Orientation

### Q1: Should the board flip for the away player?

| Option                                      | Description                                             | Selected |
| ------------------------------------------- | ------------------------------------------------------- | -------- |
| No flip — same orientation for both players | Both tabs: home goal left (q=0), away goal right (q=36) | ✓        |
| Yes — flip for away player                  | SVG mirrored horizontally for away tab                  |          |

**User's choice:** No flip
**Notes:** Simpler implementation. Players identify their side from the TurnIndicator.

---

## Claude's Discretion

- Pass type selector UI: Claude picks the control (buttons, dropdown, or toggle group)
- Action panel layout: Claude organises all action buttons so the current active action is obvious
- Connection status indicator: placement and styling (green/yellow/red) at Claude's discretion
- Opponent-disconnect banner: layout and auto-dismiss behaviour at Claude's discretion
- `VITE_SOCKET_URL` env var wiring: Claude chooses the default value and documents it

## Deferred Ideas

- Heading duel click flow — not in Phase 7 success criteria; follow-up if needed
- Snapshot interaction (MOVE-07/SNAP-01) — deferred to Phase 8
- GK quick-throw target hex selection (Phase 5 D-25 full intent) — flagged for Phase 8
- React Router / URL-based navigation — beyond Phase 7
- Board flip for away player — no-flip locked; future phases can add `scaleX(-1)` if desired
