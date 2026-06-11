# Phase 11: Rule Correctness - Research

**Researched:** 2026-06-11
**Domain:** Game engine FSM correctness — server-side sequencing and client-side highlight logic
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**RULE-01: High Pass Accuracy Result Display**

- D-01: Use a flag on the HEADER state rather than adding a new phase. Add a `headerAccuracyRollPending: boolean` (or equivalent) field to `GameState`. When a HIGH_PASS accuracy check resolves, the state enters HEADER with this flag `true`. The client shows the roll result and waits for the attacking team to acknowledge before revealing contestant selection UI. Once acknowledged, the flag clears and contestant selection proceeds.
- D-02: No new `GamePhase` union value is needed for RULE-01. The fix is state-flag driven, keeping the FSM minimal.

**RULE-02: Header Contestant Duel Sequencing**

- D-03: The duel fires automatically when the second team confirms their contestant (inside `GAME_HEADER_CONTESTANT` handler). No separate trigger event. The `GAME_HEADER_CONTESTANT` handler fires the duel as soon as both `headerConfirmed.home` and `headerConfirmed.away` are true.
- D-04: Duel result is broadcast with the winning contestant identified (`headerDuelWinner: 'home' | 'away'`). The winning contestant's position becomes the valid header range centre.
- D-05: After the duel resolves, the **winning team** (not the original attacking team) selects the target hex via `GAME_HEADER_TARGET`. The attacker-only guard in the current `GAME_HEADER_TARGET` handler must be replaced with a winner-team guard.
- D-06: `headerTargetHex` validation must check that the selected hex is within header range of the **winning contestant's position**, not the ball position or any attacker.

**RULE-03: Snapshot Shot-Path Clearing**

- D-07: Fix by auditing every shot and snapshot resolution branch in `gameHandlers.ts` and `gameEngine.ts`. Each branch must explicitly set `lastShotPath: null` before transitioning to the next phase. Do NOT add clearing to `applyStartMovement` — fix is targeted, not defensive.
- D-08: Branches to audit: GOAL paths, SAVE/GK_RESTART paths, LOOSE_BALL deflection paths from both regular shots and snapshots. Confirm all already set `lastShotPath: null` or add it where missing.

**RULE-04: SNAP_DEFLECT Highlight Suppression**

- D-09: Client-side fix. In the client highlight calculation, when `phase === 'SNAP_DEFLECT'` and `snapDeflectPaceUsed >= 2`, return an empty valid-move set. No server changes needed — `snapDeflectPaceUsed` is already broadcast in state.

**RULE-05: Post-Deflect Both-Teams Movement**

- D-10: The bug is client-side in the highlight calculation. After snapshot deflect → LOOSE_BALL → MOVEMENT via `applyStartMovement`, no pieces are shown as selectable for either team (observed in UAT). Root cause diagnosis is scoped to the planning/execution phase.
- D-11: The server FSM appears correct: `ELIGIBLE_NEXT_ACTIONS['DEFLECTION']` includes `'MOVEMENT'`, `applyStartMovement` accepts `LOOSE_BALL` phase, and the 4-5-2 slot sequence covers both teams. The planner should focus on client highlight logic — likely checking `activeTeam`, `movementSlot`, or `attackingTeam` assignment after the LOOSE_BALL → MOVEMENT transition.

### Claude's Discretion

- Exact field name for the accuracy-roll-pending flag in HEADER state (`headerAccuracyRollPending`, `headerAccuracyShown`, or similar) — match the existing naming convention in `types.ts`
- Exact field name for `headerDuelWinner` — follow the `headerConfirmed` / `headerContestants` naming pattern
- Whether the client's `GAME_HEADER_ACKNOWLEDGMENT` event (for clearing the accuracy-roll-pending flag) reuses an existing event or adds a new lightweight one

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                    | Research Support                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| RULE-01 | On a High Pass, the header contestant selection phase is triggered only after the accuracy check roll resolves | D-01/D-02: flag-on-HEADER-state pattern; `applyRoll` HIGH_PASS branch adds `headerAccuracyRollPending: true`; client gates contestant UI on flag     |
| RULE-02 | Correct sequence: accuracy check → contestant duel → target selection                                          | D-03/D-04/D-05/D-06: auto-fire duel in `GAME_HEADER_CONTESTANT` when both confirmed; `GAME_HEADER_TARGET` winner-guard replaces attacker-guard       |
| RULE-03 | After snapshot resolves, all shot-path highlight hexes are cleared before the next phase                       | D-07/D-08: audit all shot/snapshot resolution branches; `lastShotPath: null` also required in `applyRoll` LOOSE_BALL case                            |
| RULE-04 | During SNAP_DEFLECT, highlights are suppressed once max deflection pace (2 hexes) is reached                   | D-09: client `selectPiece` SNAP_DEFLECT branch already checks `paceRemaining <= 0`; HexGrid `canSelectSnapDeflect` needs the same guard              |
| RULE-05 | After shot deflects to Loose Ball, both teams enter a normal Movement Phase                                    | D-10/D-11: client-side diagnosis; key suspects are `isActivePlayer` false due to stale `activeTeam`, or `movementSlot: null` state entering MOVEMENT |

</phase_requirements>

---

## Summary

Phase 11 fixes five server-side FSM sequencing bugs and two client-side highlight bugs identified during v1.0 UAT. All bugs share a common root: transitions between game phases do not clean up intermediate state that the client uses to render highlights or gate UI interactions.

Three of the five bugs (RULE-01, RULE-02, RULE-03) require server-side changes: new `GameState` fields and adjustments to `applyRoll`, `GAME_HEADER_CONTESTANT`, and `GAME_HEADER_TARGET` handlers. The other two (RULE-04, RULE-05) are client-only fixes in `useGameStore.selectPiece` and `HexGrid` piece selectability logic. RULE-05 additionally requires a diagnosis step because the exact client logic path has not been identified; the context points to `activeTeam` or `movementSlot` state after `LOOSE_BALL → MOVEMENT`.

There are no new packages, no new `GamePhase` union values, and no architectural changes. The entire phase is targeted surgical edits to existing files. The `isProcessing` mutex, `broadcastState` call, and TypeScript strict-mode conventions apply to every change.

**Primary recommendation:** Work in the order RULE-03 → RULE-04 → RULE-01 → RULE-02 → RULE-05. RULE-03 and RULE-04 are the most isolated changes; completing them first reduces test noise when debugging the more complex RULE-01/02/05 flows.

---

## Architectural Responsibility Map

| Capability                                          | Primary Tier                                     | Secondary Tier                                           | Rationale                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| High-pass accuracy roll sequencing (RULE-01)        | API / Backend (`applyRoll` engine)               | Frontend (client UI gate on `headerAccuracyRollPending`) | Server sets the flag; client reads it to gate contestant selection UI. Both tiers carry responsibility.      |
| Header contestant duel sequencing (RULE-02)         | API / Backend (`GAME_HEADER_CONTESTANT` handler) | API / Backend (`GAME_HEADER_TARGET` guard)               | Auto-fire duel logic and winner-guard validation are server-only. Client sends events; server controls flow. |
| Shot-path highlight clearing (RULE-03)              | API / Backend (`applyRoll` / `gameHandlers.ts`)  | —                                                        | `lastShotPath` is server state. Client renders whatever the server broadcasts. Fix is entirely server-side.  |
| SNAP_DEFLECT highlight suppression (RULE-04)        | Browser / Client (`useGameStore.selectPiece`)    | Browser / Client (`HexGrid.canSelectSnapDeflect`)        | `snapDeflectPaceUsed` is already broadcast; client must stop computing valid moves when pace is exhausted.   |
| Post-deflect Movement Phase selectability (RULE-05) | Browser / Client (highlight/selectability logic) | —                                                        | Server FSM is correct per D-11. Fix is in client `canSelect` or the `isActivePlayer` derivation.             |

---

## Standard Stack

No new packages. All changes use the existing stack. [ASSUMED — confirmed by CONTEXT.md scope: "server-only changes" and "client highlight logic".]

### Existing Stack (relevant files)

| File                                             | Role                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts`                   | `GameState` interface — add `headerAccuracyRollPending`, `headerDuelWinner` fields                                                                          |
| `packages/server/src/gameEngine.ts`              | `applyRoll` HIGH_PASS branch (RULE-01); HEADER branch (RULE-02 inherited); `applyStartMovement` (RULE-03 awareness)                                         |
| `packages/server/src/gameHandlers.ts`            | `GAME_HEADER_CONTESTANT` handler (RULE-02 duel trigger); `GAME_HEADER_TARGET` handler (RULE-02 winner guard); SNAP_DEFLECT resolution block (RULE-03 audit) |
| `packages/client/src/store/useGameStore.ts`      | `selectPiece` SNAP_DEFLECT branch (RULE-04); MOVEMENT phase highlight (RULE-05 investigation)                                                               |
| `packages/client/src/components/HexGrid.tsx`     | `canSelectSnapDeflect` (RULE-04); `canSelect` + `isActivePlayer` (RULE-05 investigation); `headerTargetStep` (RULE-02 winner guard)                         |
| `packages/client/src/components/ActionPanel.tsx` | HEADER phase UI — add accuracy-result acknowledgment gate (RULE-01)                                                                                         |
| `packages/shared/src/events.ts`                  | Add `GAME_HEADER_ACCURACY_ACK` (or reuse existing event) for RULE-01 acknowledgment                                                                         |

---

## Package Legitimacy Audit

No new packages are installed in this phase. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
HIGH_PASS accuracy roll (applyRoll)
  |
  +-- [accurate] --> HEADER phase
  |                    |
  |                    +-- headerAccuracyRollPending: true (NEW - RULE-01)
  |                    |
  |                    +-- Client: show roll result, await ACK from attacker
  |                    |
  |                    +-- GAME_HEADER_ACCURACY_ACK (or reuse event)
  |                    |        |
  |                    |        +-- Server: clear headerAccuracyRollPending
  |                    |        +-- broadcastState
  |                    |
  |                    +-- Client: both teams see contestant selection UI (no flag)
  |                    |
  |                    +-- GAME_HEADER_CONTESTANT (both teams confirm) (RULE-02)
  |                    |        |
  |                    |        +-- If both confirmed: auto-fire heading duel
  |                    |        +-- Set headerDuelWinner (NEW field)
  |                    |        +-- broadcastState
  |                    |
  |                    +-- GAME_HEADER_TARGET (winning team only, NOT attacker-only) (RULE-02)
  |                              |
  |                              +-- Validate hex within range of winner's position
  |                              +-- Auto-roll duel -> PASS / GK_DIVING
  |
  +-- [inaccurate] --> LOOSE_BALL
                         |
                         +-- scatter roll -> PASS
                                               |
                                               +-- emitStartMovement -> MOVEMENT (RULE-05 path)

SNAP_DEFLECT end-turn
  |
  +-- deflected --> LOOSE_BALL (lastShotPath: null CONFIRMED) (RULE-03 - already correct)
  +-- GK in range --> GK_DIVING (lastShotPath preserved until SHOT resolves)
  +-- auto-GOAL --> KICK_OFF_SETUP (lastShotPath: null CONFIRMED) (RULE-03 - already correct)

SHOT (applyRoll SHOT branch)
  |
  +-- GOAL --> KICK_OFF_SETUP (lastShotPath: null CONFIRMED)
  +-- SAVE (caught) --> GK_RESTART (lastShotPath: null CONFIRMED)
  +-- SAVE (dropped) --> LOOSE_BALL (lastShotPath: shotPath - NOT CLEARED - RULE-03 BUG)
  +-- LOOSE_BALL tie --> LOOSE_BALL (lastShotPath: shotPath - NOT CLEARED - RULE-03 BUG)

applyRoll LOOSE_BALL scatter
  |
  +-- -> PASS (lastShotPath NOT cleared in spread - RULE-03 BUG, inherited from prior LOOSE_BALL state)
```

### Recommended Project Structure

No structural changes. All edits are in-place within existing files.

---

## Detailed Bug Analysis (per requirement)

### RULE-01: High Pass Accuracy Roll Display Ordering

**Current behavior:** When `applyRoll` processes a HIGH_PASS accuracy check (in the PASS branch, ~line 1040–1084 of gameEngine.ts), the state transitions directly to `phase: 'HEADER'` with `headerContestants` and `headerConfirmed` initialized. The client, upon receiving the HEADER phase state, immediately renders the contestant selection UI without showing the accuracy roll result.

**Fix:** [VERIFIED: codebase grep]

In `applyRoll` HIGH_PASS → HEADER transition (gameEngine.ts ~line 1068-1084), add `headerAccuracyRollPending: true` to the state:

```typescript
// Source: packages/server/src/gameEngine.ts ~line 1068
return {
  ok: true,
  state: {
    ...state,
    phase: 'HEADER',
    ball: { position: targetHex, carrierId: null },
    lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
    lastActionType: newLastActionType,
    actionCount: state.actionCount + passTimeCost,
    passTargetHex: null,
    preGeneratedInterceptionDice: [],
    eventLog: newEventLog,
    headerContestants: { home: [] as string[], away: [] as string[] },
    headerConfirmed: { home: !homeEligible, away: !awayEligible },
    headerTargetHex: null,
    headerAccuracyRollPending: true, // NEW: gates contestant selection UI
  },
};
```

In `types.ts`, add:

```typescript
/**
 * RULE-01 (Phase 11): true when high-pass accuracy roll has resolved but the
 * attacker has not yet acknowledged the result. Contestant selection UI is
 * suppressed until this flag clears. null or absent outside HEADER phase.
 */
headerAccuracyRollPending?: boolean | null;
```

In `ActionPanel.tsx` HEADER block (around line 181): gate contestant selection on `!headerAccuracyRollPending`. Show "Accuracy roll result: [roll value] — click to continue" when the flag is true. On click, emit a new lightweight event (e.g., `GAME_HEADER_ACCURACY_ACK`) or reuse `GAME_ROLL` with a no-op.

In `events.ts` / `gameHandlers.ts`: add a handler for the acknowledgment event that clears `headerAccuracyRollPending` and broadcasts state.

**Field name convention:** Existing adjacent fields are `headerContestants`, `headerConfirmed`, `headerTargetHex`, `headerDuelWinner`. Use `headerAccuracyRollPending` (boolean). [ASSUMED — matches pattern from adjacent fields]

### RULE-02: Header Contestant Duel Sequencing

**Current behavior:** [VERIFIED: codebase grep]

`GAME_HEADER_CONTESTANT` handler (gameHandlers.ts ~line 1907-1924) currently:

1. Records contestant and sets `headerConfirmed[teamSlot]: true`
2. Calls `broadcastState` immediately
3. Does NOT fire the duel — duel fires separately in `GAME_HEADER_TARGET` via `applyRoll`

The current flow requires: GAME_HEADER_CONTESTANT × 2 → GAME_HEADER_TARGET → auto-roll → result.

The current `GAME_HEADER_TARGET` handler (gameHandlers.ts ~line 1827-1831) guards with `controlsAttackingTeam`. This is wrong after D-05 — the winning team, not necessarily the attacker, selects the target.

**Fix Part A — auto-fire duel when both teams confirm:**

In `GAME_HEADER_CONTESTANT` handler, after setting `headerConfirmed`, check if both are confirmed. If so:

- Pre-generate contestant dice (one per contestant)
- Call `applyRoll` with HEADER phase dice → fires the HEADER duel branch in `applyRoll` → returns new state with duel result
- The `applyRoll` HEADER branch already resolves the duel and sets `phase: 'PASS'` (or `phase: 'LOOSE_BALL'` on tie, or `phase: 'GK_DIVING'` on goal-line header)
- BUT: after D-05, we need a state where target hex selection still happens. The duel fires first, winner is recorded in `headerDuelWinner`, then target selection occurs.

**The actual sequencing (RULE-02 detailed):**

Current `applyRoll` HEADER branch fires the duel AND immediately resolves to PASS/LOOSE_BALL. For RULE-02, we need a two-stage approach:

1. Duel fires (auto-fire in `GAME_HEADER_CONTESTANT` handler) → state stays in HEADER with `headerDuelWinner` set
2. Winner's team submits `GAME_HEADER_TARGET` → auto-rolls the HEADER duel with pre-resolved winner

**Alternative (simpler):** The duel itself should only fire after the target hex is known (since the target hex is an input to the attacker-penalty calculation via `validateHeading`). So the correct sequence is:

```
1. Both teams confirm contestants
2. Winning team selects target hex (GAME_HEADER_TARGET)
3. Duel fires automatically in GAME_HEADER_TARGET handler (current behavior)
```

But the RULE-02 description says "duel resolves, THEN winner selects target." That means the ball goes to wherever the winner heads it TO — so the winner can only pick the target AFTER knowing they won. This is different.

**Resolution from CONTEXT.md D-03/D-04:**

- D-03: duel fires automatically when SECOND team confirms in `GAME_HEADER_CONTESTANT`
- D-04: `headerDuelWinner` field records who won
- D-05: AFTER duel resolves, winner's team selects target via `GAME_HEADER_TARGET`

So the `applyRoll` HEADER branch is the WRONG place to fire the duel for RULE-02. The duel must fire inside `GAME_HEADER_CONTESTANT` when both teams have confirmed. This means `applyRoll` HEADER case must be adjusted or bypassed. [ASSUMED — but consistent with CONTEXT.md D-03; needs verification during planning]

**New `headerDuelWinner` field in `GameState`:**

```typescript
/**
 * RULE-02 (Phase 11): winner of the heading duel.
 * Set in GAME_HEADER_CONTESTANT when both teams confirm and duel fires.
 * Used by GAME_HEADER_TARGET to validate the submitting team.
 * null or absent outside HEADER phase after duel resolves.
 */
headerDuelWinner?: 'home' | 'away' | null;
```

**GAME_HEADER_TARGET guard change:**

```typescript
// Before (line ~1827-1831):
if (!controlsAttackingTeam(socket, room)) { ... WRONG_TEAM }

// After:
const duelWinner = room.gameState.headerDuelWinner;
if (duelWinner === null || socketTeam(socket) !== duelWinner) { ... WRONG_TEAM }
```

**`headerTargetHex` validation change (D-06):**
The `applyDeclareHeaderTarget` function in `gameEngine.ts` currently validates hex against a range from the ball position. After RULE-02, it must validate against the winning contestant's position.

### RULE-03: Snapshot Shot-Path Clearing

**Audit results:** [VERIFIED: codebase grep]

Checking all `lastShotPath` assignments:

| Location                                        | Branch                               | Current value             | Status                                      |
| ----------------------------------------------- | ------------------------------------ | ------------------------- | ------------------------------------------- |
| gameEngine.ts ~1179                             | SHOT: GOAL (unsaveable)              | `lastShotPath: null`      | CORRECT                                     |
| gameEngine.ts ~1255                             | SHOT: GOAL (duel win)                | `lastShotPath: null`      | CORRECT                                     |
| gameEngine.ts ~1291                             | SHOT: LOOSE_BALL (tie)               | `lastShotPath: shotPath`  | BUG — not cleared on LOOSE_BALL             |
| gameEngine.ts ~1328                             | SHOT: SAVE (caught) → GK_RESTART     | `lastShotPath: null`      | CORRECT                                     |
| gameEngine.ts ~1343                             | SHOT: SAVE (dropped) → LOOSE_BALL    | `lastShotPath: shotPath`  | BUG — not cleared on LOOSE_BALL             |
| gameHandlers.ts ~763                            | SNAP_DEFLECT: deflected → LOOSE_BALL | `lastShotPath: null`      | CORRECT                                     |
| gameHandlers.ts ~816                            | SNAP_DEFLECT: auto-GOAL              | `lastShotPath: null`      | CORRECT                                     |
| gameHandlers.ts ~1278                           | GAME_SHOT: deflected → LOOSE_BALL    | `lastShotPath: null`      | CORRECT                                     |
| gameHandlers.ts ~1331                           | GAME_SHOT: auto-GOAL                 | `lastShotPath: null`      | CORRECT                                     |
| gameEngine.ts (applyRoll LOOSE_BALL ~1736-1748) | Scatter roll → PASS                  | NOT SET (spread inherits) | BUG — lastShotPath persists through scatter |

**Bugs confirmed:** Three branches set `lastShotPath: shotPath` and the path persists into subsequent phases:

1. `applyRoll` SHOT LOOSE_BALL (tie) branch: set `lastShotPath: null` (the path already landed somewhere; it's confusing to show it during the LOOSE_BALL scramble).
2. `applyRoll` SHOT SAVE (dropped) branch: set `lastShotPath: null`.
3. `applyRoll` LOOSE_BALL scatter branch: add `lastShotPath: null` to the return state spread.

Note on SAVE-dropped and LOOSE_BALL-tie: The CONTEXT.md D-07/D-08 says to set `lastShotPath: null` before transitioning. The current code intentionally keeps `lastShotPath: shotPath` so both clients see the shot trajectory in LOOSE_BALL. This is likely intentional UX. The D-08 instruction says "Confirm all already set `lastShotPath: null` or add it where missing." The key transition that causes stale paths is `applyRoll` LOOSE_BALL scatter → PASS, which inherits the non-null path. The minimal correct fix is: clear `lastShotPath` in the `applyRoll` LOOSE_BALL scatter result (lines 1736-1748), NOT in the SHOT→LOOSE_BALL transitions (those can keep showing the trajectory while the ball is still loose).

### RULE-04: SNAP_DEFLECT Highlight Suppression

**Current behavior:** [VERIFIED: codebase grep]

In `useGameStore.selectPiece` (SNAP_DEFLECT branch, ~line 408-423):

```typescript
const paceRemaining = 2 - (gameState.snapDeflectPaceUsed ?? 0);
if (paceRemaining <= 0) {
  set({ selectedPieceId: id, validMoveHexes: [] }); // RETURNS EMPTY — this is correct
  return;
}
```

The `selectPiece` logic correctly returns `validMoveHexes: []` when pace is exhausted. But the `canSelectSnapDeflect` flag in `HexGrid.tsx` (~line 570-575) still allows the piece to register as clickable (sets outline highlight) even when pace is 0:

```typescript
const canSelectSnapDeflect =
  phase === 'SNAP_DEFLECT' &&
  myTeam !== null &&
  myTeam === snapDefendingTeam &&
  piece.teamId === myTeam &&
  (snapDeflectMovedPieceId === null || snapDeflectMovedPieceId === piece.id);
// MISSING: && (gameState.snapDeflectPaceUsed ?? 0) < 2
```

When pace is exhausted, the piece still appears clickable (blue/selectable outline) and responds to click — it just shows no move hexes. The fix is to add `&& (snapDeflectPaceUsed ?? 0) < 2` to the `canSelectSnapDeflect` condition. [VERIFIED: codebase grep — confirmed HexGrid.tsx lines 570-575]

Note: `snapDeflectPaceUsed` is already subscribed from `useGameStore` in `HexGrid.tsx` (line 84 area — check during planning).

### RULE-05: Post-Deflect Both-Teams Movement

**Server FSM path confirmed correct:** [VERIFIED: codebase grep]

1. `SNAP_DEFLECT` → `LOOSE_BALL`: `baseSnapState` strips `snapDeflectMovedPieceId` and `snapDeflectPaceUsed` via destructure (gameHandlers.ts ~688-692). `attackingTeam` is inherited from the original attacker (the snapshot shooter's team).
2. `LOOSE_BALL` auto-scatter: `applyRoll` LOOSE_BALL branch → `PASS` phase. `newAttackingTeam = looseBallCarrier ? looseBallCarrier.teamId : state.attackingTeam`. `lastActionType: 'DEFLECTION'`.
3. `GAME_START_MOVEMENT` from PASS: guarded by `controlsAttackingTeam`. `applyStartMovement` from LOOSE_BALL sets `movementSlot: 'ATTACKER_4'`, `activeTeam: state.attackingTeam`.
4. `applyEndTurn` advances: `ATTACKER_4 → DEFENDER_5` sets `activeTeam = defender team`; `DEFENDER_5 → ATTACKER_2` returns it to attacker.

**Client issue suspects** (requires execution-time diagnosis per D-11):

**Suspect A (HIGH probability):** `isActivePlayer` in HexGrid.tsx is `myTeam === activeTeam` (line 98). After LOOSE_BALL scatter, `activeTeam = attackingTeam`. During ATTACKER_4 slot, this is correct for the attacker's client. BUT: `GAME_START_MOVEMENT` is gated by `controlsAttackingTeam`. If the ball scattered onto a defending piece (changing `attackingTeam` to the defender), then the PASS phase shows the defender as `activeTeam`. The defender can emit `GAME_START_MOVEMENT`. But then in MOVEMENT, `attackingTeam` is the defender's team, so ATTACKER_4 = defender's turn. Both slots (ATTACKER_4 = defender, DEFENDER_5 = attacker) should still show pieces for their respective active players. This path should work unless `movementSlot` is null.

**Suspect B (HIGH probability):** `snapDeflectPaceUsed` stale in the PASS state causes a HexGrid or store branch to short-circuit. The `baseSnapState` destructure (gameHandlers.ts ~688-692) does strip these fields from the LOOSE_BALL state. But it's a spread destructure — the resulting `baseSnapState` object loses those keys. This should be safe.

**Suspect C (MEDIUM probability):** The `contestedPieceIds` field. If the snapshot was preceded by a header (which sets `contestedPieceIds`), those IDs persist through the SNAP_DEFLECT → LOOSE_BALL → PASS chain unless cleared. `applyStartMovement` clears `contestedPieceIds: []` — so this should be fine.

**Suspect D (MEDIUM probability):** A stale `snapDeflectMovedPieceId` persisting on client Zustand store (`prev.gameState` holds old state when `setGameState` is called). The client `selectPiece` SNAP_DEFLECT branch checks `gameState.phase === 'SNAP_DEFLECT'` — this branch only triggers on SNAP_DEFLECT phase, so stale fields wouldn't matter for MOVEMENT phase logic.

**Suspect E (MEDIUM probability — most actionable):** The `canSelect` condition in HexGrid.tsx (line 553-558):

```typescript
const canSelect =
  isActivePlayer &&
  phase === 'MOVEMENT' &&
  piece.teamId === activeTeam &&
  !movedPieceIds.includes(piece.id) &&
  !slotFull;
```

`slotFull` is computed as `activatedCount >= slotQuota && !pieceAlreadyActivated` where `activatedCount = Object.keys(paceUsedByPieceId).length`. If `paceUsedByPieceId` contains stale entries from the SNAP_DEFLECT phase (it shouldn't — `applyStartMovement` resets it), `slotFull` could be `true` for all pieces. `applyStartMovement` does reset `paceUsedByPieceId: {}`. This should be safe. BUT: if the Zustand `setGameState` optimistic update path left stale `paceUsedByPieceId` from the previous phase... check `setGameState` in `useGameStore.ts`.

**Investigation instructions for planner:** Add a console.log in `HexGrid.tsx` `canSelect` computation to print `movementSlot`, `activeTeam`, `attackingTeam`, `isActivePlayer`, `paceUsedByPieceId`, and `movedPieceIds` immediately after `applyStartMovement` state arrives. This will pinpoint which condition is false.

---

## Don't Hand-Roll

| Problem                            | Don't Build                             | Use Instead                                             | Why                                                                                                                                |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Accuracy-roll acknowledgment UI    | Custom multi-step state machine         | Simple boolean flag on GameState + one new event        | The existing flag pattern (`headerConfirmed`, `kickOffActive`) is established; adding one more flag is zero architectural overhead |
| Header duel winner routing         | New GamePhase union value               | `headerDuelWinner` field on existing HEADER phase       | D-02 locks this — no new phase values                                                                                              |
| Shot path cleanup                  | Defensive clear in `applyStartMovement` | Targeted `lastShotPath: null` in each resolution branch | D-07 explicitly prohibits the defensive approach                                                                                   |
| Pace exhaustion highlight suppress | Custom animation or CSS                 | Guard condition in existing `canSelectSnapDeflect`      | One boolean expression addition; no new infrastructure                                                                             |

---

## Common Pitfalls

### Pitfall 1: Forgetting `broadcastState` After Each RULE-02 Stage

**What goes wrong:** Duel fires in `GAME_HEADER_CONTESTANT` but the second client never sees the updated state with `headerDuelWinner`.
**Why it happens:** The existing GAME_HEADER_CONTESTANT handler broadcasts once at the end — the duel result insertion must happen before that broadcast or trigger its own.
**How to avoid:** Duel result goes into `room.gameState` first, then single `broadcastState`. Never call `broadcastState` twice in one handler path (causes double-render flicker).

### Pitfall 2: `isProcessing` Mutex Not Released on Early Returns

**What goes wrong:** A validation check returns early without releasing `room.isProcessing = false`, locking out all subsequent game actions.
**Why it happens:** Any new early-return path in `GAME_HEADER_CONTESTANT` (for the duel branch) must be inside the existing `try...finally` block.
**How to avoid:** All code added to `GAME_HEADER_CONTESTANT` must stay within the existing `try { ... } finally { room.isProcessing = false; }` wrapper.

### Pitfall 3: `headerAccuracyRollPending` Flag Not Cleared on Both Sides

**What goes wrong:** Attacker acknowledges, flag clears on server, but the inaccurate path (where HIGH_PASS goes to LOOSE_BALL without entering HEADER) somehow leaves the flag set from a previous header.
**How to avoid:** `headerAccuracyRollPending` is part of `headerCleared` spread that already clears `headerContestants`, `headerConfirmed`, `headerTargetHex` at the end of `applyRoll` HEADER branch. Add it to that same `headerCleared` object.

### Pitfall 4: `applyRoll` HEADER Branch Conflict With RULE-02

**What goes wrong:** RULE-02 moves the duel trigger to `GAME_HEADER_CONTESTANT`. But `GAME_HEADER_TARGET` currently calls `applyRoll` on the HEADER phase state, which re-runs the HEADER duel from scratch (ignoring `headerDuelWinner`). If not updated, the duel fires twice.
**How to avoid:** After RULE-02 changes: `GAME_HEADER_TARGET` should NOT call `applyRoll` anymore (or `applyRoll` HEADER branch is unreachable). Instead, `GAME_HEADER_TARGET` validates range against winner's position and directly transitions state to PASS/GK_DIVING based on the pre-resolved `headerDuelWinner`. Alternatively, `applyRoll` HEADER branch reads `headerDuelWinner` from state instead of re-running the duel.

### Pitfall 5: RULE-03 Fix Too Broad

**What goes wrong:** Adding `lastShotPath: null` to `applyStartMovement` clears the path before the next Movement Phase but also hides the trajectory during LOOSE_BALL itself (while both players should see where the shot went).
**How to avoid:** Per D-07, fix is targeted to specific branches. Clear `lastShotPath` only in the `applyRoll` LOOSE_BALL scatter result (transitions to PASS), not in SHOT→LOOSE_BALL transitions.

### Pitfall 6: `snapDeflectPaceUsed` Not Subscribed in HexGrid

**What goes wrong:** `canSelectSnapDeflect` guard references `snapDeflectPaceUsed` but HexGrid doesn't subscribe to that field.
**How to avoid:** Check the HexGrid subscription block at the top of the component (~line 47-95). If `snapDeflectPaceUsed` is not already subscribed, add `const snapDeflectPaceUsed = useGameStore((s) => s.gameState.snapDeflectPaceUsed);` alongside the other subscriptions.

### Pitfall 7: TypeScript Strict Mode on New Optional Fields

**What goes wrong:** `headerAccuracyRollPending?: boolean | null` is optional; accessing it without a null guard causes TS errors.
**How to avoid:** Always use `??` or `?.[field]` pattern: `headerAccuracyRollPending ?? false`. Follow the existing pattern for `headerConfirmed` (`headerConfirmed?.home ?? false`).

---

## Code Examples

### Adding a Flag to an Existing Phase State (Pattern from `kickOffActive`)

```typescript
// Source: packages/server/src/gameEngine.ts (existing kickOffActive pattern)
// Pattern: boolean flag on GameState, set on phase entry, cleared on flag-specific event
room.gameState = { ...room.gameState, kickOffActive: true };
broadcastState(io, room);
// Later, on first standard pass from kickOffHex:
room.gameState = { ...room.gameState, kickOffActive: false };
```

### Duel Trigger in Handler (Pattern from `GAME_HEADER_TARGET` auto-roll, ~line 1841-1855)

```typescript
// Source: packages/server/src/gameHandlers.ts ~1841 (GAME_HEADER_TARGET auto-roll pattern)
const atkCount = room.gameState.headerContestants?.[atkTeam]?.length ?? 0;
const defCount = room.gameState.headerContestants?.[defTeam]?.length ?? 0;
const numDice = Math.max(atkCount + defCount, 2);
const diceArr = Array.from({ length: numDice }, () => rollDice());
const rollResult = applyRoll(room.gameState, ...diceArr);
if (!rollResult.ok) {
  socket.emit(ServerEvents.GAME_ERROR, rollResult.reason);
  broadcastState(io, room);
  return;
}
room.gameState = rollResult.state;
broadcastState(io, room);
```

### Header Cleared Object Pattern (prevents header fields persisting across phases)

```typescript
// Source: packages/server/src/gameEngine.ts ~line 1374
const headerCleared = {
  headerContestants: null,
  headerConfirmed: null,
  headerTargetHex: null,
  // RULE-01: add to this spread
  headerAccuracyRollPending: null,
  // RULE-02: add to this spread
  headerDuelWinner: null,
};
```

### `canSelectSnapDeflect` with Pace Guard (RULE-04 fix pattern)

```typescript
// Source: packages/client/src/components/HexGrid.tsx ~line 570 (current)
// Current (missing pace guard):
const canSelectSnapDeflect =
  phase === 'SNAP_DEFLECT' &&
  myTeam !== null &&
  myTeam === snapDefendingTeam &&
  piece.teamId === myTeam &&
  (snapDeflectMovedPieceId === null || snapDeflectMovedPieceId === piece.id);

// Fix (add pace guard):
const canSelectSnapDeflect =
  phase === 'SNAP_DEFLECT' &&
  myTeam !== null &&
  myTeam === snapDefendingTeam &&
  piece.teamId === myTeam &&
  (snapDeflectMovedPieceId === null || snapDeflectMovedPieceId === piece.id) &&
  (snapDeflectPaceUsed ?? 0) < 2; // suppress when pace exhausted (RULE-04)
```

---

## Runtime State Inventory

This is not a rename/refactor phase. Section omitted.

---

## Environment Availability

| Dependency | Required By            | Available | Version            | Fallback |
| ---------- | ---------------------- | --------- | ------------------ | -------- |
| Node.js    | Server build + tests   | ✓         | 22 LTS             | —        |
| pnpm       | Monorepo workspace     | ✓         | 9.x                | —        |
| vitest     | Unit/integration tests | ✓         | (see package.json) | —        |
| TypeScript | All packages           | ✓         | 5.x                | —        |

All dependencies are already installed. No new dependencies required for this phase.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| Framework          | vitest                                                                                                |
| Config file        | `packages/server/vitest.config.ts` (server); `packages/client/vite.config.ts` (client, vitest inline) |
| Quick run command  | `pnpm --filter @counter-attack/server test`                                                           |
| Full suite command | `pnpm -r test` (runs all packages)                                                                    |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                           | Test Type              | Automated Command                                                                                | File Exists? |
| ------- | ---------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ | ------------ |
| RULE-01 | HIGH_PASS → HEADER sets `headerAccuracyRollPending: true`                          | unit (engine)          | `pnpm --filter @counter-attack/server test -- --reporter=verbose -t "headerAccuracyRollPending"` | ❌ Wave 0    |
| RULE-01 | Acknowledgment event clears flag + broadcasts                                      | integration            | `pnpm --filter @counter-attack/server test -- -t "header accuracy ack"`                          | ❌ Wave 0    |
| RULE-02 | Both contestants confirmed → duel fires automatically                              | unit (handler)         | `pnpm --filter @counter-attack/server test -- -t "auto duel"`                                    | ❌ Wave 0    |
| RULE-02 | `GAME_HEADER_TARGET` accepts winner's team socket only                             | unit (handler)         | `pnpm --filter @counter-attack/server test -- -t "header target winner guard"`                   | ❌ Wave 0    |
| RULE-03 | `applyRoll` LOOSE_BALL scatter → PASS has `lastShotPath: null`                     | unit (engine)          | `pnpm --filter @counter-attack/server test -- -t "lastShotPath null after scatter"`              | ❌ Wave 0    |
| RULE-04 | `selectPiece` in SNAP_DEFLECT returns empty moves when pace = 2                    | unit (store/component) | `pnpm --filter @counter-attack/client test -- -t "snapDeflect pace exhausted"`                   | ❌ Wave 0    |
| RULE-05 | MOVEMENT after LOOSE_BALL: both teams' pieces are selectable in correct slot order | integration            | `pnpm --filter @counter-attack/server test -- -t "post deflect movement"`                        | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/server test && pnpm --filter @counter-attack/client test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/__tests__/gameEngine.rule11.test.ts` — unit tests for RULE-01, RULE-02, RULE-03 engine changes
- [ ] `packages/server/src/__tests__/gameHandlers.rule11.test.ts` — handler tests for RULE-01 ack, RULE-02 auto-duel, RULE-02 winner guard
- [ ] `packages/client/src/components/HexGrid.rule11.test.tsx` or `packages/client/src/store/useGameStore.rule11.test.ts` — RULE-04 and RULE-05 highlight tests

---

## Security Domain

This phase makes no changes to authentication, session management, access control, or cryptography. The only ASVS-relevant area is V4 (Access Control): the `GAME_HEADER_TARGET` handler guard changes from attacker-team to winner-team. This is a tightening of access control, not a relaxation.

| ASVS Category         | Applies | Standard Control                                                                                                               |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| V2 Authentication     | no      | —                                                                                                                              |
| V3 Session Management | no      | —                                                                                                                              |
| V4 Access Control     | yes     | Socket team ownership check (`socketTeam(socket) === headerDuelWinner`) replaces `controlsAttackingTeam`                       |
| V5 Input Validation   | yes     | `headerTargetHex` HexCoord shape validation already in handler; `headerDuelWinner` lookup uses existing piece array validation |
| V6 Cryptography       | no      | —                                                                                                                              |

---

## State of the Art

| Old Approach                                       | Current Approach                                                                         | When Changed | Impact                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `applyRoll` HEADER branch fires duel directly      | Auto-fire duel in `GAME_HEADER_CONTESTANT` when both confirm (RULE-02)                   | Phase 11     | Winner is known before target selection; `GAME_HEADER_TARGET` becomes winner-gated |
| HIGH_PASS → HEADER immediately shows contestant UI | HIGH_PASS → HEADER with `headerAccuracyRollPending: true`; contestant UI gated (RULE-01) | Phase 11     | Roll result visible to both players before contestant selection begins             |

---

## Assumptions Log

| #   | Claim                                                                                                                                                                                                         | Section                       | Risk if Wrong                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `applyRoll` HEADER branch needs to be restructured (not just the handler) so the duel fires in `GAME_HEADER_CONTESTANT` and `GAME_HEADER_TARGET` resolves from `headerDuelWinner` without re-running the duel | Detailed Bug Analysis RULE-02 | If wrong, the duel fires twice — once in GAME_HEADER_CONTESTANT and once in GAME_HEADER_TARGET via applyRoll. Planner must choose the correct integration point.                  |
| A2  | `snapDeflectPaceUsed` is not already subscribed in HexGrid.tsx                                                                                                                                                | Pitfall 6                     | Low risk — if it's already subscribed, the fix is a one-liner guard addition; if not, a one-liner subscription is added first. Execution confirms.                                |
| A3  | RULE-05 root cause is in `canSelect` / `isActivePlayer` / `paceUsedByPieceId` in HexGrid                                                                                                                      | Detailed Bug Analysis RULE-05 | Medium risk — CONTEXT.md explicitly says root cause is unknown; diagnosis step is in-scope. If the bug is in the server (e.g., `movementSlot` null), execution adds a server fix. |

---

## Open Questions

1. **RULE-02: applyRoll HEADER branch reachability after fix**
   - What we know: `GAME_HEADER_TARGET` currently calls `applyRoll` on HEADER phase, which fires the duel. If RULE-02 moves the duel to `GAME_HEADER_CONTESTANT`, `GAME_HEADER_TARGET` must no longer call `applyRoll` (or `applyRoll` HEADER must read `headerDuelWinner` to skip re-rolling).
   - What's unclear: Which approach is cleaner — remove `applyRoll` call from `GAME_HEADER_TARGET` entirely (and do the phase transition inline), or preserve it but have `applyRoll` HEADER read the pre-resolved winner?
   - Recommendation: Remove `applyRoll` call from `GAME_HEADER_TARGET`. Build a new `applyResolveHeaderTarget(state, targetHex)` engine function that reads `headerDuelWinner` and transitions to PASS/GK_DIVING/LOOSE_BALL without re-rolling dice. This keeps the engine pure and the handler thin.

2. **RULE-05: `activeTeam` after LOOSE_BALL scatter when ball lands on nobody**
   - What we know: `applyRoll` LOOSE_BALL keeps `attackingTeam` unchanged when ball lands on empty hex. `applyStartMovement` then sets `activeTeam = attackingTeam`. The attacker's player can start movement.
   - What's unclear: In the UAT scenario, was the ball landing on a piece (changing `attackingTeam`) or landing on empty? If changing teams, is the NEW attacker able to find and click the Start Movement button?
   - Recommendation: Add explicit console logging of `attackingTeam`, `activeTeam`, `movementSlot` in both the server LOOSE_BALL handler response and the client `setGameState` handler to capture the full state at the moment of transition.

---

## Sources

### Primary (HIGH confidence)

- `packages/server/src/gameEngine.ts` — direct codebase read; `applyRoll` SHOT/HEADER/LOOSE_BALL/HIGH_PASS branches; `applyStartMovement`; `advanceMovementSlot`; `applyEndTurn`
- `packages/server/src/gameHandlers.ts` — direct codebase read; `GAME_HEADER_CONTESTANT` handler; `GAME_HEADER_TARGET` handler; SNAP_DEFLECT resolution block
- `packages/client/src/store/useGameStore.ts` — direct codebase read; `selectPiece` SNAP_DEFLECT and MOVEMENT branches
- `packages/client/src/components/HexGrid.tsx` — direct codebase read; `canSelect`, `canSelectSnapDeflect`, `isActivePlayer`
- `packages/client/src/components/ActionPanel.tsx` — direct codebase read; HEADER phase UI, PASS phase buttons, `isActivePlayer` gate
- `packages/shared/src/types.ts` — direct codebase read; `GameState` interface, existing field naming conventions
- `packages/shared/src/events.ts` — direct codebase read; `ClientToServerEvents`, existing event names
- `packages/shared/src/actionSequence.ts` — direct codebase read; `ELIGIBLE_NEXT_ACTIONS['DEFLECTION']` confirmed includes `'MOVEMENT'`

### Secondary (MEDIUM confidence)

- `.planning/phases/11-rule-correctness/11-CONTEXT.md` — decisions D-01 through D-11 verified against codebase

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Bug identification (RULE-01, 02, 03, 04): HIGH — code read confirmed exact line locations
- Fix approach (RULE-01, 03, 04): HIGH — well-established patterns in existing codebase
- Fix approach (RULE-02): MEDIUM — duel refactor requires planner decision on applyRoll integration point (Open Question 1)
- Root cause (RULE-05): MEDIUM — server FSM confirmed correct; client root cause unconfirmed pending execution-time diagnosis

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stable codebase; no external dependencies)
