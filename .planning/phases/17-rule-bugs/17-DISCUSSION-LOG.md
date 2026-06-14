# Phase 17: Rule Bugs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 17-rule-bugs
**Areas discussed:** MOVE-06 (Free 6-hex move flow), PASS-02 (Mid-pass movement), BUG-02 (Cancel/Back in MOVEMENT)

---

## MOVE-06: Free 6-hex move flow

### When does the free move fire?

| Option                                     | Description                                                                                        | Selected |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------- |
| After action ends — new FREE_MOVE phase    | After ball carrier crosses thirds and team ends MOVEMENT (End Turn), server enters FREE_MOVE phase | ✓        |
| Immediately mid-movement                   | Interrupts current slot as soon as carrier crosses                                                 |          |
| At start of next action (PASS phase entry) | pendingFreeMove stays dormant until next action                                                    |          |

**User's choice:** After action ends — new FREE_MOVE phase

---

### Who can move during FREE_MOVE?

| Option                                         | Description                                                              | Selected |
| ---------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| All outfield players IN opponent's final third | Only players physically in the opponent's final third at FREE_MOVE start | ✓        |
| All players on the crossing team               | Every outfield player gets 6 hexes regardless of position                |          |
| You decide                                     | Claude picks interpretation                                              |          |

**User's choice:** All outfield players already IN the opponent's final third

---

### Individual or shared pool?

| Option                                                 | Description                                                          | Selected |
| ------------------------------------------------------ | -------------------------------------------------------------------- | -------- |
| Each player independently gets up to 6 hexes           | Player A can move 6 AND Player B can move 6 — independent allowances | ✓        |
| Shared pool — 6 hexes split among all eligible players | Combined 6-hex budget shared across all eligible players             |          |

**User's choice:** Each eligible player independently gets up to 6 hexes

---

## PASS-02: Mid-pass movement during First-time Pass flight

### Phase structure

| Option                                                    | Description                                                    | Selected |
| --------------------------------------------------------- | -------------------------------------------------------------- | -------- |
| New FIRST_TIME_MOVEMENT phase, same as HIGH_PASS_MOVEMENT | Both teams take turns in a dedicated phase                     |          |
| No new phase — fold into existing MOVEMENT                | Fold into PASS phase, surface 1-hex opportunity in ActionPanel | ✓        |
| Simultaneous — both teams submit in parallel              | Both teams pick at same time, no turn order                    |          |

**User's choice:** "no new phase — fold it into the existing MOVEMENT phase"

---

### Defender's 1-hex move (since both teams need to move)

**User's response (freeform):** "quick pass chooses a target space like a shot, path is highlighted, attacker can move 1 player (not passer), defender can move 1 player, resolve deflect, resolve pass if not blocked"

**Interpretation:** The pass path is highlighted on the board. Attacker moves 1 non-passer player 1 hex (new PASS step), then defender gets SNAP_DEFLECT to move 1 player 1 hex onto the path. Deflect resolves as existing SNAP_DEFLECT logic.

---

### Does defender trying to step on pass path = deflect?

| Option                                              | Description                                                                       | Selected |
| --------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Yes — path shown, defender steps onto it to deflect | If defender ends on path after SNAP_DEFLECT → LOOSE_BALL; otherwise pass delivers | ✓        |
| Yes but simultaneous                                | Both teams move at same time, then deflect resolves                               |          |
| No deflect — just repositioning                     | Moves are purely positional, pass always delivers                                 |          |

**User's choice:** Yes — path shown, defender tries to step onto it to deflect

---

### Attacker's 1-hex move mechanism

| Option                                                                   | Description                                                                                | Selected |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------- |
| New PASS step: attacker moves 1 player, then End Turn fires SNAP_DEFLECT | After target chosen, attacker clicks player + destination (1 hex), End Turn → SNAP_DEFLECT | ✓        |
| Auto-skip attacker move — only defender gets SNAP_DEFLECT                | Skip attacker repositioning entirely                                                       |          |
| Attacker move simultaneous with SNAP_DEFLECT                             | Both teams move simultaneously                                                             |          |

**User's choice:** New PASS step — attacker moves 1 player, End Turn fires SNAP_DEFLECT

---

## BUG-02: Cancel/Back in MOVEMENT phase

### What 'Back' does in MOVEMENT before first piece moves

| Option                                               | Description                                                                                             | Selected |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| Cancel movement, return to PASS phase action chooser | If no piece has moved (paceUsedByPieceId empty), Cancel returns to PASS. Server releases movement slot. | ✓        |
| Just existing Undo button, no Cancel                 | Keep as-is — player uses Undo repeatedly to get to zero                                                 |          |
| Cancel at all times (even after moving)              | Undoes all moves at once and returns to PASS phase                                                      |          |

**User's choice:** Cancel movement, return to PASS phase action chooser (only when no piece has moved)

---

### Other phases needing a new Back button

| Option                  | Description                                                   | Selected |
| ----------------------- | ------------------------------------------------------------- | -------- |
| MOVEMENT only           | PASS step 2 already has ← Back; no other phases need new Back | ✓        |
| Also HIGH_PASS_MOVEMENT | Cancel before repositioning a player                          |          |
| Also GK phases          | Cancel before GK picks restart method                         |          |

**User's choice:** MOVEMENT only — the only gap

---

## Claude's Discretion

- BUG-03 (pre-header undo): identified from codebase — `applyUndo` returns `WRONG_PHASE` for `HIGH_PASS_MOVEMENT`; fix is to extend the phase guard. No user discussion needed.
- BUG-01, BUG-04, BUG-05: clear implementation from requirements; no design choices needed.
- MOVE-06 edge case: if no eligible players in final third when FREE_MOVE fires, immediately return to PASS (no empty UI panel).
- PASS-02 `lastActionType` discrimination: `lastActionType === 'FIRST_TIME_PASS'` in SNAP_DEFLECT determines resolution path (pass vs. snapshot).

## Deferred Ideas

None — discussion stayed within phase 17 scope.
