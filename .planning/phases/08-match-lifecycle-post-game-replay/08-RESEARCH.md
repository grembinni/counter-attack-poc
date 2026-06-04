# Phase 8: Match Lifecycle + Post-Game Replay - Research

**Researched:** 2026-06-04
**Domain:** Game FSM extension, action sequence validation, match lifecycle, post-game replay streaming
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Full-Time Resolution**

- D-01: Draw is valid — if scores are level at full time, the match ends. No extra time or penalty shootout in v1.
- D-02: Referee card `leniency` affects ONLY added time calculation: `addedTime = diceRoll + refereeCard.leniency`. No other effect in v1.

**Match Clock (Time-Based Action Counting)**

- D-03: `actionCount` tracks **minutes elapsed**, not a simple action tally. The half ends when `actionCount >= 45` (plus any added time). Time costs: Movement Phase +3, Standard/High/Long/GK-kick +1, First-time Pass/Shot/Header/Quick Throw/Snapshot/Loose Ball +0.
- D-04: The entire 4-5-2 Movement Phase = 1 action = 3 minutes. Clock increments when ATTACKER_2 ends. Steal that ends phase early still counts as full 3 minutes.
- D-05: When `actionCount >= 45`, server immediately rolls added time inline: `addedTime = crypto.randomInt(1, 7) + state.refereeCard.leniency`. Stored in `GameState.addedTime`. Play continues until `actionCount >= 45 + addedTime`, then HALF_TIME / FULL_TIME.
- D-06: New GameState fields: `addedTime: number | null`, `lastActionType: LastActionType | null`, `kickOffTeam: 'home' | 'away'`.

**Action Sequence Enforcement**

- D-07: Phase 8 enforces the full action eligibility table. Every server action handler validates proposed next action against the table. Invalid sequences return `{ ok: false, reason: 'INVALID_SEQUENCE' }`.
- D-08: Corrected action eligibility table — see CONTEXT.md for full matrix. Key rules: High pass MUST be followed by Header only. Shot can ONLY follow Movement phase. Long ball can lead to Movement or Header only.
- D-09: FSM restructured so attacking team chooses next action after each completed action, validated against the eligibility table.

**Per-Action Flow Validation (D-10 through D-21)**

- Each action type's complete FSM flow, validation rules, time increment, and lastActionType value are locked in CONTEXT.md D-10 through D-21.

**Snapshots**

- D-22: Snapshots (SNAP-01, SNAP-02, SNAP-03) are in scope for Phase 8. `applySnapshot` in gameEngine.ts. Snapshot applies -1 dice penalty; opponent moves 1 player up to 2 hexes before the shot. Snapshot = 0 minutes. No new FSM state — transitions directly to SHOT.

**Kick-Off Procedure**

- D-23: New `KICK_OFF_SETUP` phase. Both teams freely reposition before each kick-off. Attacking team: own half + centre circle. Defending team: own half, outside centre circle.
- D-24: Both teams click "Ready". Server transitions KICK_OFF_SETUP → KICK_OFF only when both confirmed. Server validates placement on "Ready".
- D-25: Attacking team must place exactly one player on centre hex `{q:18, r:13}`. Server rejects "Ready" if unoccupied.
- D-26: Second half kick-off by team that did NOT kick off in first half. `GameState.kickOffTeam` records this.
- D-27: First action after KICK_OFF_SETUP → KICK_OFF → MOVEMENT must be a Standard Pass from the centre hex (MATCH-03).

**Half-Time Flow**

- D-28: HALF_TIME phase when `actionCount >= 45 + addedTime` at first-half end. "Start 2nd Half" button enabled only for team that did NOT kick off first.
- D-29: `half` increments 1 → 2 when second half begins. `actionCount` resets to 0. `addedTime` resets to null.

**Post-Game Replay**

- D-30: After full time, server transitions to FULL_TIME (shows final score), then starts REPLAY phase automatically.
- D-31: Replay delivery: server reconstructs GameState for each event in event log (replaying from `buildInitialGameState`) and emits `game:state` at 1-second intervals via `setInterval`. `GameState.phase = 'REPLAY'`.
- D-32: Replay granularity: 1 second per individual event. SLOT_ADVANCE events skipped. MOVE, DICE_ROLL, STEAL_ATTEMPT, GOAL, KICK_OFF events shown 1 second each.
- D-33: Replay screen shows board state, final score (persistent), "Action N of N" counter. "Play Again" button returns to lobby.

### Claude's Discretion

- New `ActionEvent` subtypes for actions not yet in event log (High Pass, Long Ball, First-time Pass, Shot declaration, Snapshot). Claude defines discriminant shapes in types.ts.
- HALF_TIME and FULL_TIME screen layouts (within constraint: "shows score + action button").
- KICK_OFF_SETUP client UX — colour tinting for valid zones, "Ready" button constraint feedback.
- Replay setInterval management on the server — cleanup on room deletion or player disconnect.

### Deferred Ideas (OUT OF SCOPE)

- Replay pause/scrub controls — auto-play only in Phase 8.
- Persistent room for rematch — "Play Again" returns to lobby.
- GK quick-throw target hex delivery — deferred from Phase 7.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                                       | Research Support                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| MATCH-01  | Match consists of two 45-action halves; actions are: Movement Phase, Standard Pass, First-time Pass, High Pass, Long Pass, Header, Snapshot, Shot | D-03 time-cost table; `actionCount` field; `advanceMovementSlot` hook for +3 min               |
| MATCH-02  | At end of each half, added time = dice roll + referee Leniency; play continues for exactly that many additional actions                           | D-05: inline added-time roll at actionCount==45; `GameState.addedTime` field                   |
| MATCH-03  | Kick off procedure: one player on centre hex, attacking team in centre circle, defending team outside; game starts with Standard Pass             | D-23 to D-27; `PITCH_REGIONS.centreCircle` and `kickOffHex` already in pitch.ts                |
| MATCH-04  | Second half kick off by team that did not kick off in first half                                                                                  | D-26; `GameState.kickOffTeam` field                                                            |
| MATCH-05  | Score tracked and displayed to both players throughout the match                                                                                  | Already implemented in `GameBoard` header and `TurnIndicator`; Phase 8 adds added-time display |
| REPLAY-01 | After full time, both players shown replay of entire match                                                                                        | D-30 to D-33; `setInterval` on server; `broadcastState` as delivery mechanism                  |
| REPLAY-02 | Replay advances one action per second, rendering each board state from event log                                                                  | D-32 granularity rules; server reconstructs state by replaying transitions                     |
| REPLAY-03 | Replay driven by server-side event log; no additional data capture required                                                                       | Event log (UX-03/UX-04) already implemented; replay reads existing `GameState.eventLog`        |
| SNAP-01   | Snapshot during Movement Phase if ball-carrier in opponent's penalty area, or immediately after any pass                                          | D-22; `isInRegion` for penalty area check; `applySnapshot` new engine function                 |
| SNAP-02   | Snapshot applies -1 dice penalty to Shooting; 1 opponent moves up to 2 hexes before shot                                                          | D-22; penalty applied in `applyRoll` SHOT branch when preceded by snapshot                     |
| SNAP-03   | All standard shooting rules apply to snapshots                                                                                                    | D-22; snapshot transitions to SHOT; `applyRoll` SHOT branch handles it                         |

</phase_requirements>

---

## Summary

Phase 8 extends a fully-working client-server Counter Attack game (Phases 1–7.1) with the complete match lifecycle: action counting as minutes elapsed, action sequence enforcement from the rulebook eligibility table, kick-off setup with placement validation, half-time and full-time transitions, and an automatic post-game replay driven by the server event log.

The codebase is well-structured for these additions. The pure-function game engine (`gameEngine.ts`) already implements all six FSM transitions that Phase 8 extends (`applyEndTurn`, `applyRoll`, `applyGKRestart`, `buildInitialGameState`, `applyStartMovement`). The `GameState` type already includes `HALF_TIME`, `FULL_TIME`, and `REPLAY` as valid `GamePhase` values. The event log (UX-03/UX-04) is fully implemented and stores every action, making the replay mechanism a matter of replaying existing state transitions rather than capturing new data.

The most architecturally complex element is the action sequence enforcement (D-07/D-08). The current FSM uses a `PASS` phase that transitions to `SHOT` automatically, but the rulebook eligibility table requires restructuring: after each completed action the server must check `lastActionType` against a lookup table to determine what the attacking team is allowed to do next. This requires adding `lastActionType` to `GameState`, a new `actionSequence.ts` constant module in `packages/shared`, and updating every action handler to validate against it before proceeding. The per-action time cost increments (D-03/D-04) are straightforward hooks in `applyEndTurn` and `applyRoll`.

The post-game replay uses the established `broadcastState` pattern with a `setInterval` loop on the server, replaying the stored event log as `game:state` frames. The UI adds four new screens (`KICK_OFF_SETUP`, `HALF_TIME`, `FULL_TIME`, `REPLAY`) following the frozen CSS token/design-system patterns from Phases 6/7.

**Primary recommendation:** Implement in waves — (1) shared type/constant additions in `packages/shared`, (2) game engine functions (`applyEndTurn` clock hooks, `applySnapshot`, `applyKickOffReady`, `applyHalfTimeStart`, replay reconstruction), (3) server handlers, (4) client screens. Sequence enforcement and the kick-off setup flow are the highest-risk areas and should be well-tested first.

---

## Architectural Responsibility Map

| Capability                                              | Primary Tier                    | Secondary Tier             | Rationale                                                                          |
| ------------------------------------------------------- | ------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| Action sequence validation                              | API / Backend (gameEngine.ts)   | Frontend (disable buttons) | Server is authoritative; client disabling is UX reflection only, never enforcement |
| Action count / minute clock                             | API / Backend (gameEngine.ts)   | —                          | Pure-function state mutation; no client involvement                                |
| Added time roll                                         | API / Backend (gameEngine.ts)   | —                          | Server-side `crypto.randomInt`; client displays the result                         |
| Kick-off setup placement validation                     | API / Backend (gameHandlers.ts) | Frontend (zone tinting)    | Server enforces placement rules; client shows zones as UX hint                     |
| Half-time / full-time FSM transitions                   | API / Backend (gameEngine.ts)   | —                          | Pure-function state; triggered by `actionCount` threshold check                    |
| Replay frame streaming                                  | API / Backend (roomStore.ts)    | —                          | `setInterval` on server; `broadcastState` delivers each frame                      |
| KICK_OFF_SETUP / HALF_TIME / FULL_TIME / REPLAY screens | Browser / Client                | —                          | Pure UI rendering from server state; no client-side logic                          |
| Score display                                           | Browser / Client                | —                          | Already implemented; Phase 8 adds `addedTime` display extension                    |
| `lastActionType` button disabling                       | Browser / Client                | —                          | Reflects `GameState.lastActionType` from store; server is the truth                |

---

## Standard Stack

No new packages are introduced in Phase 8. All work uses the project's existing locked stack.

### Core (existing — no changes)

| Library            | Version | Purpose                                                              | Why Standard               |
| ------------------ | ------- | -------------------------------------------------------------------- | -------------------------- |
| Socket.io (server) | 4.8.3   | Replay frame streaming via `broadcastState`                          | CONTEXT.md locked decision |
| Vitest             | 2.1.9   | Unit tests for new engine functions                                  | Established test framework |
| TypeScript         | 5.x     | Shared type additions (`LastActionType`, new `ActionEvent` subtypes) | Project-wide               |

### New npm packages: None

The UI-SPEC §Registry Safety confirms: "No third-party component registries. All components are hand-rolled CSS Modules. No new dependencies required for Phase 8 UI." [VERIFIED: 08-UI-SPEC.md]

---

## Package Legitimacy Audit

No external packages are installed in Phase 8. This section is not applicable.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Client A / Client B
    |
    | socket.emit('game:ready')      -- KICK_OFF_SETUP placement confirm
    | socket.emit('game:start-movement') -- begins Movement Phase
    | socket.emit('game:end-turn')   -- closes ATTACKER_2, triggers clock
    | socket.emit('game:roll')       -- resolves PASS/SHOT/HEADER/LOOSE_BALL
    |
    v
gameHandlers.ts (new + modified handlers)
    |  validates lastActionType sequence (D-07)
    |  validates phase + team guards (existing pattern)
    |
    v
gameEngine.ts (pure functions)
    |  applyEndTurn  -->  +3 min, check actionCount >= 45 --> addedTime roll
    |  applyRoll     -->  +1 min (PASS/SHOT), lastActionType update
    |  applyKickOffReady  -->  placement validation, KICK_OFF_SETUP --> KICK_OFF
    |  applyHalfTimeStart -->  HALF_TIME --> KICK_OFF_SETUP (2nd half)
    |  applySnapshot  -->  penalty area check, -1 dice flag, --> SHOT
    |  buildReplayFrames --> replays eventLog transitions from buildInitialGameState
    |
    v
roomStore.ts
    |  broadcastState() --> io.to(room).emit('game:state', state)
    |  room.replayTimer (new field) --> setInterval(1000ms) during REPLAY phase
    |
    v
Client screens (App.tsx routing by phase)
    KICK_OFF       --> GameBoard + ActionPanel (existing)
    KICK_OFF_SETUP --> GameBoard + KickOffSetupPanel (new)
    HALF_TIME      --> HalfTimeScreen (new full-screen card)
    FULL_TIME      --> FullTimeScreen (new full-screen card, 3s then REPLAY)
    REPLAY         --> GameBoard + ReplayPanel (new, no interactivity)
```

### Recommended Project Structure (additions only)

```
packages/
├── shared/src/
│   ├── actionSequence.ts    # NEW: ELIGIBLE_NEXT_ACTIONS constant + LastActionType type
│   └── index.ts             # EXTENDED: export actionSequence.ts
├── server/src/
│   ├── gameEngine.ts        # EXTENDED: applySnapshot, applyKickOffReady, applyHalfTimeStart, buildReplayFrames, clock hooks
│   ├── gameHandlers.ts      # EXTENDED: game:ready handler; all handlers updated for sequence validation
│   └── roomStore.ts         # EXTENDED: Room.replayTimer field; deleteRoom clears it
└── client/src/
    ├── components/
    │   ├── KickOffSetupPanel.tsx   + .module.css  # NEW
    │   ├── HalfTimeScreen.tsx      + .module.css  # NEW
    │   ├── FullTimeScreen.tsx      + .module.css  # NEW
    │   └── ReplayPanel.tsx         + .module.css  # NEW
    ├── store/useGameStore.ts       # EXTENDED: Screen type + new emitters
    └── App.tsx                     # EXTENDED: screen routing for 4 new phases
```

### Pattern 1: Action Sequence Validation via Lookup Constant

**What:** A `Record<LastActionType, Set<NextActionType>>` constant in `packages/shared/src/actionSequence.ts` drives all sequence validation. The server imports it for enforcement; the client imports it for button disabling.

**When to use:** Every action handler that requires `lastActionType !== null` checks this before proceeding.

```typescript
// Source: 08-CONTEXT.md D-08 (canonical eligibility table)
// packages/shared/src/actionSequence.ts
export type NextActionType =
  | 'MOVEMENT'
  | 'STANDARD_PASS'
  | 'FIRST_TIME_PASS'
  | 'HIGH_PASS'
  | 'LONG_BALL'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'SHOT';

export const ELIGIBLE_NEXT_ACTIONS: Record<LastActionType, Set<NextActionType>> = {
  MOVEMENT_PHASE: new Set([
    'MOVEMENT',
    'STANDARD_PASS',
    'HIGH_PASS',
    'LONG_BALL',
    'SNAPSHOT',
    'SHOT',
  ]),
  SUCCESSFUL_TACKLE: new Set(['MOVEMENT', 'STANDARD_PASS', 'HIGH_PASS', 'LONG_BALL', 'SNAPSHOT']),
  STANDARD_PASS: new Set(['MOVEMENT', 'FIRST_TIME_PASS', 'SNAPSHOT']),
  FIRST_TIME_PASS: new Set(['MOVEMENT', 'SNAPSHOT']),
  HIGH_PASS: new Set(['HEADER']), // ONLY valid next action
  LONG_BALL: new Set(['MOVEMENT', 'HEADER']),
  HEADER: new Set(['MOVEMENT', 'FIRST_TIME_PASS', 'SNAPSHOT']),
  DEFLECTION: new Set(['MOVEMENT', 'FIRST_TIME_PASS', 'LONG_BALL', 'SNAPSHOT']),
  SNAPSHOT: new Set([]), // N/A — snapshot always transitions to SHOT
  SHOT: new Set([]), // N/A — shot outcomes reset sequence
};
```

### Pattern 2: Action Clock Increment in applyEndTurn

**What:** The +3 minute clock increment (and added-time check) is applied in `applyEndTurn` at the ATTACKER_2→null transition.

```typescript
// Source: 08-CONTEXT.md D-04 + D-05
// In applyEndTurn, after computing nextSlot/nextPhase:
if (nextSlot === null) {
  // ATTACKER_2 → PASS transition: increment 3 minutes
  const newActionCount = state.actionCount + 3;
  let newAddedTime = state.addedTime;

  if (newActionCount >= 45 && state.addedTime === null && state.half === 1) {
    // Roll added time inline (D-05); crypto.randomInt is NOT pure — caller injects it
    newAddedTime = addedTimeRoll + state.refereeCard.leniency;
  }
  // ... check for half-time / full-time threshold ...
}
```

**Critical:** `applyEndTurn` is currently a pure function — adding `crypto.randomInt` would break purity. The added-time roll must be injected by the handler (same pattern as `applyGKRestart` receives `rollDie`).

### Pattern 3: Replay Frame Delivery via setInterval

**What:** Server reconstructs replay frames by re-running all event log transitions from `buildInitialGameState`, then streams them 1 per second via `setInterval`.

```typescript
// Source: 08-CONTEXT.md D-31 + D-32
// In gameHandlers.ts when phase transitions to FULL_TIME:
const frames = buildReplayFrames(room.gameState);
let idx = 0;
room.replayTimer = setInterval(() => {
  if (idx >= frames.length) {
    clearInterval(room.replayTimer!);
    room.replayTimer = null;
    return;
  }
  const frame = frames[idx++];
  io.to(room.roomCode).emit(ServerEvents.GAME_STATE, frame);
}, 1000);
```

**Cleanup:** `room.replayTimer` must be cleared in `deleteRoom` and on socket disconnect (D-Claude's Discretion).

### Pattern 4: Kick-Off Setup — Both Players Active

**What:** Both players are active during KICK_OFF_SETUP. Both can move pieces (to their own valid zone). Both must click "Ready". Server tracks per-player ready state separately.

```typescript
// roomStore.ts Room extension:
readyPlayers?: Set<1 | 2>;  // populated during KICK_OFF_SETUP

// applyKickOffReady: validates placement, sets ready flag, transitions when both ready
// Server transitions to KICK_OFF only when readyPlayers.size === 2
```

### Anti-Patterns to Avoid

- **Calling `crypto.randomInt` inside pure engine functions:** Added-time roll in `applyEndTurn` must be injected as a function parameter, same as `applyGKRestart` already does. Violating this breaks unit-testability.
- **Client-side sequence enforcement:** The `ELIGIBLE_NEXT_ACTIONS` lookup is used client-side to disable buttons only — never to skip server validation. The server always validates `lastActionType` independently.
- **Missing `setInterval` cleanup:** If `room.replayTimer` is not cleared in `deleteRoom`, the interval will attempt to emit to a non-existent room, causing a silent memory leak.
- **Advancing `actionCount` for kick-off itself:** Kick-off is not a counted action (D-10). Only actions in the ATTACKER_4/DEFENDER_5/ATTACKER_2 movement slots and ball actions increment `actionCount`. Setting `lastActionType = null` on kick-off reset is equally important.
- **Using `state.addedTime` before it is set:** `addedTime` is `null` until `actionCount` first reaches 45. Code that computes the half-end threshold must guard with `addedTime !== null` before adding it to 45.
- **Replaying `SLOT_ADVANCE` events as replay frames:** SLOT_ADVANCE events have no board-state change and must be skipped in `buildReplayFrames` (D-32). Only MOVE, DICE_ROLL, STEAL_ATTEMPT, GOAL, and KICK_OFF events produce frames.
- **Conflating `attackingTeam` and `activeTeam` during KICK_OFF_SETUP:** Both players move pieces during setup — `activeTeam` is not a useful gating mechanism here. The handler must derive "which team's pieces are being moved" from the socket's `playerSlot`, not from `state.activeTeam`.

---

## Don't Hand-Roll

| Problem                       | Don't Build                                              | Use Instead                                                                           | Why                                                                          |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Action sequence lookup        | Custom if/else chain per action handler                  | `ELIGIBLE_NEXT_ACTIONS` constant in actionSequence.ts                                 | One source of truth; testable in isolation; client can import same constant  |
| Replay state reconstruction   | Separate "capture state snapshot per event" at game time | Re-run `buildInitialGameState` + all event transitions                                | Event log already fully captured; dual-capture creates sync risk             |
| Kick-off zone membership test | Custom hex range calculation                             | Existing `isInRegion(hex, 'centreCircle')` and half-boundary `q` comparison           | `PITCH_REGIONS.centreCircle` already encodes hexDistance ≤ 3 from kickOffHex |
| Replay timer management       | Custom timer abstraction                                 | Node.js native `setInterval` + handle stored in `Room`                                | No dependency needed; cleanup is explicit and simple                         |
| Half boundary check           | Computing attacking team's "own half"                    | Comparing `hex.q <= 18` (home) / `hex.q >= 18` (away) vs `PITCH_REGIONS.kickOffHex.q` | kickOffHex.q = 18 is the locked half-boundary from Phase 6 CONTEXT.md        |

**Key insight:** The event log was designed from Phase 3 (UX-03/UX-04) explicitly to support post-game replay. Re-running transitions is architecturally sound and avoids any dual-capture sync problem. The replay reconstruction function is deterministic given the same event log.

---

## Runtime State Inventory

> Not applicable — Phase 8 is not a rename/refactor/migration phase. Omitted per instructions.

---

## Common Pitfalls

### Pitfall 1: applyEndTurn Purity Violation for Added-Time Roll

**What goes wrong:** Developer adds `randomInt(1, 7)` inside `applyEndTurn` directly to implement the D-05 added-time roll.
**Why it happens:** It seems natural — the roll happens "inside" the end-turn transition.
**How to avoid:** Follow the `applyGKRestart` pattern: add a `rollDie: () => number` parameter to `applyEndTurn`. The handler injects `rollDice` at call time. Engine stays deterministic for unit tests.
**Warning signs:** `import { randomInt } from 'crypto'` appears in `gameEngine.ts` for the first time (it's already imported for `buildInitialGameState` coin-flip — verify which functions use it).

### Pitfall 2: Missing KICK_OFF_SETUP Phase Guard in GAME_MOVE Handler

**What goes wrong:** The `game:move` handler only guards for `phase === 'MOVEMENT'`. During `KICK_OFF_SETUP`, players also move pieces. If the phase guard is not updated (or a separate `game:ready-move` event not added), move events during setup are rejected.
**Why it happens:** The existing `GAME_MOVE` handler hardcodes `phase !== 'MOVEMENT'` as the phase guard.
**How to avoid:** Either (a) extend the `game:move` handler to accept `KICK_OFF_SETUP` phase with different validation logic, or (b) introduce a distinct `game:kick-off-move` event with its own handler. Option (b) is cleaner — avoids conflating two different move semantics in one handler.
**Warning signs:** Players cannot reposition pieces during kick-off setup despite clicking valid-zone hexes.

### Pitfall 3: addedTime Re-roll if the Check Fires Twice

**What goes wrong:** `applyEndTurn` fires multiple times while `actionCount >= 45` (multiple movement phases in added time). The added-time roll fires again on each transition, changing `addedTime`.
**Why it happens:** The check `if (newActionCount >= 45)` is true on every subsequent call during added time.
**How to avoid:** The guard must be `if (newActionCount >= 45 && state.addedTime === null)`. Once `addedTime` is set, it is never re-rolled for the same half (D-05 explicitly states "set once").
**Warning signs:** `addedTime` changes on every action during added time; the half never ends.

### Pitfall 4: Replay Timer Leak on Room Deletion / Disconnect

**What goes wrong:** `deleteRoom` clears `disconnectTimers` but not `replayTimer`. The `setInterval` callback fires after the room is deleted, calling `io.to(roomCode).emit(...)` on a non-existent room.
**Why it happens:** `replayTimer` is a new field — existing `deleteRoom` does not know about it.
**How to avoid:** Add `if (room.replayTimer) clearInterval(room.replayTimer)` to `deleteRoom`, alongside the existing `disconnectTimers` cleanup. Also clear it on the `disconnect` event handler if the room enters `REPLAY` phase before both players disconnect.
**Warning signs:** Node.js process memory grows after replays; error logs show emit to closed rooms.

### Pitfall 5: Incorrect Half-Time vs Full-Time Branch

**What goes wrong:** Both first and second half trigger HALF_TIME instead of FULL_TIME at the second-half end.
**Why it happens:** The half-end check `if (actionCount >= 45 + addedTime)` fires identically for both halves.
**How to avoid:** Branch on `state.half`: `state.half === 1 → 'HALF_TIME'`; `state.half === 2 → 'FULL_TIME'`.
**Warning signs:** Match ends at half-time of the second half; no FULL_TIME or REPLAY screens appear.

### Pitfall 6: KICK_OFF_SETUP Pieces Reset Race

**What goes wrong:** `buildInitialGameState` places pieces at HOME_SQUAD / AWAY_SQUAD starting positions. When transitioning to KICK_OFF_SETUP, the pieces must be reset to these starting positions first. If the server resets but the client hasn't received the broadcast yet, the client shows stale positions during the brief window before the state arrives.
**Why it happens:** There is no extra client-side reset — the server broadcast is the source of truth. The race is cosmetic only (resolves when `game:state` arrives), but a visible piece teleport can be jarring.
**How to avoid:** The reset is server-authoritative and the broadcast delivers it atomically. No special handling needed — document that the brief cosmetic flash is acceptable.

### Pitfall 7: MOVEMENT Phase `isActivePlayer` Guard Breaks During KICK_OFF_SETUP

**What goes wrong:** The existing `isActivePlayer(socket, room)` guard in `game:move` checks `socketTeam(socket) === actingTeam(room.gameState)`. During KICK_OFF_SETUP, `actingTeam` is derived from `state.movementSlot` which is `null` — it returns `attackingTeam`. This means only the attacking team can move pieces during setup, even though BOTH teams must reposition.
**Why it happens:** `activeTeam` is a single-team concept; KICK_OFF_SETUP is a dual-team phase.
**How to avoid:** The KICK_OFF_SETUP move handler (whether separate or a branch in `game:move`) must NOT use `isActivePlayer`. Instead, it derives "which pieces can this socket move" from `socketTeam(socket)` and verifies the piece's `teamId` matches.

### Pitfall 8: Shot After Pass Branch in applyRoll Still Routes to SHOT

**What goes wrong:** The current `applyRoll` PASS branch transitions to `phase: 'SHOT'` on accurate pass. Per D-08/D-09 and D-19, Shot can ONLY follow a Movement Phase (or Snapshot). An accurate Standard Pass should return to action choice, NOT enter SHOT directly.
**Why it happens:** The current FSM was built before the full eligibility table was designed. The PASS → SHOT path was always a simplification.
**How to avoid:** The PASS branch in `applyRoll` must be restructured. On accurate pass: transition to a neutral "action choice" state (or stay in PASS with the ball at the new carrier) and update `lastActionType`. The SHOT phase is only reachable from `game:shot` (declaring a shot from MOVEMENT) or from `applySnapshot` → SHOT.
**Warning signs:** Players can shoot from any pass by clicking Roll Dice while in PASS phase.

---

## Code Examples

### Verified Existing Hook Points

```typescript
// Source: packages/server/src/gameEngine.ts:280 — applyEndTurn

// EXISTING: after advanceMovementSlot computes nextSlot/nextPhase
// Phase 8 adds: clock increment at ATTACKER_2→null transition
if (nextSlot === null) {
  // This is the ATTACKER_2→null (→PASS) transition — clock hook here (D-04)
  const newActionCount = state.actionCount + 3;
  // ... added-time check, half-time check ...
}
```

```typescript
// Source: packages/server/src/roomStore.ts:44 — Room type
// Phase 8 addition: replayTimer field
export type Room = {
  // ... existing fields ...
  replayTimer?: ReturnType<typeof setInterval> | null; // NEW: Phase 8 D-31
};
```

```typescript
// Source: packages/shared/src/types.ts:77 — GamePhase
// ALREADY INCLUDES: 'HALF_TIME' | 'FULL_TIME' | 'REPLAY' | 'KICK_OFF_SETUP' (need to add)
// 'KICK_OFF_SETUP' is NOT yet in the GamePhase union — must be added.
export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'KICK_OFF_SETUP' // KICK_OFF_SETUP is NEW
  | 'MOVEMENT'
  | 'PASS'
  | 'SHOT'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'LOOSE_BALL'
  | 'GK_RESTART'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'REPLAY';
```

```typescript
// Source: packages/client/src/App.tsx:22 — onGameState handler
// Phase 8: must route to new screens instead of always going to GAME_BOARD
function onGameState(state: GameState) {
  setGameState(state);
  setDisconnectWarning(false);
  // Phase 8: HALF_TIME/FULL_TIME/REPLAY screens; KICK_OFF_SETUP stays on GAME_BOARD
  if (state.phase === 'HALF_TIME') {
    setScreen('HALF_TIME');
  } else if (state.phase === 'FULL_TIME') {
    setScreen('FULL_TIME');
  } else if (state.phase === 'REPLAY') {
    setScreen('REPLAY');
  } else {
    setScreen('GAME_BOARD');
  } // covers KICK_OFF_SETUP — pitch stays visible
}
```

```typescript
// Source: packages/client/src/store/useGameStore.ts:8 — Screen type
// Phase 8: extend with new screen values
export type Screen =
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'WAITING'
  | 'GAME_BOARD' // existing
  | 'HALF_TIME' // NEW
  | 'FULL_TIME' // NEW
  | 'REPLAY'; // NEW
// Note: KICK_OFF_SETUP uses GAME_BOARD screen (pitch remains visible)
```

### New Events Required

```typescript
// Source: 08-CONTEXT.md D-24, plus Claude's Discretion for exact event names
// packages/shared/src/events.ts additions:

export const ClientEvents = {
  // ... existing ...
  GAME_READY: 'game:ready', // KICK_OFF_SETUP confirmation (D-24)
  GAME_HALF_TIME_START: 'game:half-time-start', // start 2nd half (D-28)
} as const;
```

### New ActionEvent Subtypes (Claude's Discretion)

The following new subtypes must be added to the `ActionEvent` discriminated union in `types.ts`. They enable complete event-log coverage for replay reconstruction.

```typescript
// Types to add to ActionEvent union in packages/shared/src/types.ts
| { type: 'HIGH_PASS';    from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
| { type: 'LONG_BALL';    from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
| { type: 'STANDARD_PASS'; from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
| { type: 'FIRST_TIME_PASS'; from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
| { type: 'SHOT_ATTEMPT'; shooterId: string; targetHex: HexCoord; outcome: 'GOAL' | 'MISS' | 'SAVE' | 'LOOSE_BALL'; timestamp: number }
| { type: 'SNAPSHOT';     shooterId: string; timestamp: number }
| { type: 'HALF_TIME';    half: 1; score: { home: number; away: number }; timestamp: number }
| { type: 'FULL_TIME';    score: { home: number; away: number }; timestamp: number }
```

Also update `ActionEventType`:

```typescript
export type ActionEventType =
  | 'MOVE'
  | 'SLOT_ADVANCE'
  | 'DICE_ROLL'
  | 'STEAL_ATTEMPT'
  | 'GOAL'
  | 'KICK_OFF'
  | 'HIGH_PASS'
  | 'LONG_BALL'
  | 'STANDARD_PASS'
  | 'FIRST_TIME_PASS'
  | 'SHOT_ATTEMPT'
  | 'SNAPSHOT'
  | 'HALF_TIME'
  | 'FULL_TIME';
```

---

## State of the Art

| Old Approach                         | Current Approach                                                     | When Changed             | Impact                                                             |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------ | ------------------------------------------ |
| Phase always transitions PASS → SHOT | Phase 8 restructures: pass accurate → action choice for ball carrier | Phase 8                  | Breaks the existing PASS branch in `applyRoll`                     |
| No `lastActionType` in GameState     | `lastActionType: LastActionType                                      | null` added to GameState | Phase 8                                                            | All action handlers must update this field |
| `actionCount` was a simple counter   | `actionCount` tracks minutes; costs vary per action type             | Phase 8                  | `applyEndTurn` and `applyRoll` must apply correct per-action costs |
| No `KICK_OFF_SETUP` phase            | New phase before each kick-off for piece repositioning               | Phase 8                  | New `GamePhase` value, new handler, new client screen              |

**Deprecated/outdated in Phase 8:**

- The PASS → SHOT direct path in `applyRoll`: after Phase 8, an accurate pass never enters SHOT. Shot is only reachable via `game:shot` from MOVEMENT or via `applySnapshot`.
- `GameState.phase === 'PASS'` as the trigger for the "Roll Dice" button entering SHOT: after Phase 8, PASS phase roll resolves pass accuracy only (ACCURATE → action choice, INACCURATE → LOOSE_BALL).

---

## Assumptions Log

| #   | Claim                                                                                                                                                                            | Section                           | Risk if Wrong                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `KICK_OFF_SETUP` is not yet in the `GamePhase` union in types.ts — must be added                                                                                                 | Standard Stack / Code Examples    | Low — easy to confirm by re-reading types.ts; verified by inspection above                                                                                                |
| A2  | The replay reconstruction correctly re-derives all game states by re-running transitions from `buildInitialGameState`; no hidden state outside `GameState` and `eventLog` exists | Architecture Patterns / Pattern 3 | Medium — if any state (e.g. `room.shotTarget`) affects game outcomes but is not in eventLog, replay will diverge. `shotTarget` is UX-only (T-07-13), so this is unlikely. |
| A3  | The "both players move during KICK_OFF_SETUP" pattern is best handled by a new `game:kick-off-move` event rather than extending `game:move` with a phase guard                   | Architecture Patterns             | Low — both approaches work; new event is cleaner but the planner can choose either                                                                                        |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

Current status: A1 is confirmed by reading `types.ts` (KICK_OFF_SETUP absent, verified above). A2 is ASSUMED — verify `room.shotTarget` does not affect game outcomes (documented in handler as UX-only, so risk is low). A3 is a design choice under Claude's Discretion.

---

## Open Questions

1. **`applyEndTurn` purity with added-time roll injection**
   - What we know: `applyGKRestart` already accepts `rollDie: () => number` as a parameter for the same reason. `applyEndTurn` currently takes no injected functions.
   - What's unclear: The simplest path is to add `rollDie: () => number` as an optional parameter (only called when `actionCount >= 45 && addedTime === null`). Alternatively the handler can roll before calling `applyEndTurn` and pass the result in.
   - Recommendation: Pass pre-rolled value as a parameter (e.g. `applyEndTurn(state, { addedTimeRoll?: number })`). Keeps the pattern consistent — caller (handler) always holds the dice; engine never calls `randomInt`.

2. **GAME_MOVE handler during KICK_OFF_SETUP: extend vs separate event**
   - What we know: The existing `game:move` handler hardcodes `phase === 'MOVEMENT'` as the required phase.
   - What's unclear: Whether to add a branch in `game:move` or add `game:kick-off-move`.
   - Recommendation: New `game:kick-off-move` event and handler. The semantics differ (no paceUsed tracking, no ZoI/steal, zone validation instead of move validation). Separate handler is cleaner.

3. **`buildReplayFrames` return type — should FULL_TIME be the final frame?**
   - What we know: D-32 says `SLOT_ADVANCE` events are skipped. The replay ends when all frames are exhausted.
   - What's unclear: Whether `FULL_TIME` is emitted as a frame before `REPLAY` frames, or if the FULL_TIME screen is already shown before replay starts.
   - Recommendation: FULL_TIME is a separate server state transition (D-30) that client receives as a `game:state` with `phase: 'FULL_TIME'`. The FULL_TIME screen shows for 3 seconds (server-driven: server waits ~3 seconds before starting the `setInterval`). The replay frames then flow. No FULL_TIME frame in the replay itself.

---

## Environment Availability

Phase 8 is a code/config-only change — no new external tools, services, or runtimes are required. All dependencies (Node.js, pnpm, Vitest, Socket.io) are already established and verified in prior phases.

This section is SKIPPED (no new external dependencies).

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9                                                                                |
| Config file        | No root-level config; each package has `vitest run` in scripts                              |
| Quick run command  | `pnpm --filter @counter-attack/shared test` and `pnpm --filter @counter-attack/server test` |
| Full suite command | `pnpm --recursive test`                                                                     |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                             | Test Type   | Automated Command                                                         | File Exists? |
| --------- | ------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------- | ------------ |
| MATCH-01  | `applyEndTurn` increments `actionCount` by 3 at ATTACKER_2 end                       | unit        | `pnpm --filter @counter-attack/server test -- --grep "actionCount"`       | ❌ Wave 0    |
| MATCH-01  | Shot/Header/First-time Pass actions cost 0 minutes                                   | unit        | same file                                                                 | ❌ Wave 0    |
| MATCH-02  | Added time rolls inline when `actionCount >= 45` and `addedTime === null`            | unit        | same file                                                                 | ❌ Wave 0    |
| MATCH-02  | `addedTime` is not re-rolled when already set                                        | unit        | same file                                                                 | ❌ Wave 0    |
| MATCH-03  | Server rejects `game:ready` if attacking team has no player on centre hex            | integration | `pnpm --filter @counter-attack/server test -- --grep "kick-off setup"`    | ❌ Wave 0    |
| MATCH-03  | Server rejects defending team placement inside centre circle                         | integration | same file                                                                 | ❌ Wave 0    |
| MATCH-04  | Second-half `attackingTeam` = opponent of `kickOffTeam`                              | unit        | same file                                                                 | ❌ Wave 0    |
| MATCH-05  | Score display updates after goal in both halves                                      | integration | existing game.integration.test.ts (GOAL path)                             | ✅ partial   |
| REPLAY-01 | Server emits `game:state` frames at 1-second intervals after FULL_TIME               | integration | new replay integration test                                               | ❌ Wave 0    |
| REPLAY-02 | Each frame corresponds to a MOVE/DICE_ROLL/GOAL/KICK_OFF event; SLOT_ADVANCE skipped | unit        | `pnpm --filter @counter-attack/server test -- --grep "buildReplayFrames"` | ❌ Wave 0    |
| REPLAY-03 | Replay uses existing `eventLog`; no new data capture                                 | unit        | same file                                                                 | ❌ Wave 0    |
| SNAP-01   | `applySnapshot` rejects when ball-carrier not in penalty area (mid-pass condition)   | unit        | `pnpm --filter @counter-attack/server test -- --grep "applySnapshot"`     | ❌ Wave 0    |
| SNAP-02   | Shot resolution from snapshot applies -1 dice penalty                                | unit        | same file                                                                 | ❌ Wave 0    |
| SNAP-03   | Standard shot rules (outside penalty area -1, auto-miss on 1) apply to snapshots     | unit        | same file                                                                 | ❌ Wave 0    |
| D-07/D-08 | `ELIGIBLE_NEXT_ACTIONS` constant: High Pass allows only Header                       | unit        | `pnpm --filter @counter-attack/shared test -- --grep "actionSequence"`    | ❌ Wave 0    |
| D-07/D-08 | Server rejects Standard Pass after Standard Pass                                     | integration | same file                                                                 | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/server test` (quick — ~2s for server unit tests)
- **Per wave merge:** `pnpm --recursive test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/__tests__/gameEngine.phase8.test.ts` — covers MATCH-01, MATCH-02, MATCH-04, SNAP-01, SNAP-02, SNAP-03, D-07/D-08 action sequence unit tests
- [ ] `packages/server/src/__tests__/replay.integration.test.ts` — covers REPLAY-01, REPLAY-02, REPLAY-03 (real Socket.io server, confirms frame delivery timing is correct)
- [ ] `packages/server/src/__tests__/kickoffSetup.integration.test.ts` — covers MATCH-03 placement validation over the wire
- [ ] `packages/shared/src/actionSequence.test.ts` — covers the ELIGIBLE_NEXT_ACTIONS constant shape and key rules

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                        |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | Not in scope                                                                                                                            |
| V3 Session Management | no      | Established in Phase 3/7 — no changes                                                                                                   |
| V4 Access Control     | yes     | `isActivePlayer`, `controlsAttackingTeam` guards on all new handlers; `game:ready` must reject if not the socket's own team's placement |
| V5 Input Validation   | yes     | `game:kick-off-move` and `game:ready` payloads must be validated: HexCoord shape, pieceId existence, team ownership                     |
| V6 Cryptography       | yes     | Added-time roll uses `crypto.randomInt` (server-side) per existing pattern; never client-generated                                      |

### Known Threat Patterns for Phase 8 Stack

| Pattern                                                          | STRIDE                 | Standard Mitigation                                                                                 |
| ---------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| Client claiming opponent pieces during KICK_OFF_SETUP            | Tampering              | `game:kick-off-move` handler validates `piece.teamId === socketTeam(socket)` before accepting       |
| Client emitting `game:ready` when placement constraints unmet    | Tampering              | `applyKickOffReady` validates all placement rules server-side before setting ready flag             |
| Client emitting `game:half-time-start` when it is not their turn | Tampering              | Handler validates `socketTeam(socket) !== kickOffTeam` (only the non-kick-off team starts 2nd half) |
| Replay spam — client emitting `game:ready` during REPLAY phase   | Tampering              | Phase guard on all new handlers: reject if `phase !== 'KICK_OFF_SETUP'`                             |
| Missing `isProcessing` mutex on new handlers                     | Elevation of Privilege | All new handlers MUST check and set `room.isProcessing` in try/finally (established pattern)        |

---

## Sources

### Primary (HIGH confidence)

- `packages/shared/src/types.ts` — `GameState`, `GamePhase`, `ActionEvent` union, `ActionEventType` — verified by file inspection
- `packages/server/src/gameEngine.ts` — `applyEndTurn`, `applyRoll`, `applyGKRestart`, `buildInitialGameState` — verified by file inspection
- `packages/server/src/roomStore.ts` — `Room` type, `broadcastState`, `deleteRoom` — verified by file inspection
- `packages/server/src/gameHandlers.ts` — handler patterns (isProcessing mutex, team guards, snap-back on error) — verified by file inspection
- `packages/shared/src/events.ts` — `ClientEvents`, `ServerEvents`, typed event maps — verified by file inspection
- `packages/shared/src/pitch.ts` — `PITCH_REGIONS.centreCircle`, `kickOffHex`, `isInRegion` — verified by file inspection
- `packages/client/src/App.tsx` — `onGameState` handler, screen routing — verified by file inspection
- `packages/client/src/store/useGameStore.ts` — `Screen` type, store shape — verified by file inspection
- `packages/client/src/components/ActionPanel.tsx` — existing button structure — verified by file inspection
- `.planning/phases/08-match-lifecycle-post-game-replay/08-CONTEXT.md` — all phase decisions (D-01 through D-33) — canonical source
- `.planning/phases/08-match-lifecycle-post-game-replay/08-UI-SPEC.md` — visual contract for all new screens — canonical source

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — accumulated project decisions, confirmed no `KICK_OFF_SETUP` in current GamePhase
- `.planning/REQUIREMENTS.md` — MATCH-01 through MATCH-05, REPLAY-01 through REPLAY-03, SNAP-01 through SNAP-03

### Tertiary (LOW confidence)

None — all findings verified from codebase or CONTEXT.md.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; existing stack verified by file inspection
- Architecture patterns: HIGH — all patterns derived from existing codebase idioms (applyGKRestart, broadcastState, isProcessing) verified by direct code reading
- Pitfalls: HIGH — most pitfalls derive directly from existing code paths (applyEndTurn, GAME_MOVE handler, applyRoll PASS→SHOT path) that are visibly incomplete for Phase 8 requirements
- Validation architecture: HIGH — Vitest framework confirmed from package.json; test structure confirmed from existing test files

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable codebase; no external API dependencies)
