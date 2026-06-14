# Phase 17: Rule Bugs - Research

**Researched:** 2026-06-14
**Domain:** Game engine FSM, server-side socket handlers, React client UI
**Confidence:** HIGH

## Summary

Phase 17 fixes seven rule-correctness defects spread across the server game engine (`gameEngine.ts`), the socket event layer (`gameHandlers.ts`, `events.ts`), the shared type system (`types.ts`, `actionSequence.ts`), and the React client (`ActionPanel.tsx`, `HexGrid.tsx`). No new external packages are needed — all changes are within the existing codebase.

The fixes range from trivial one-liners (BUG-05: swap a position reference) to new phases with their own server handlers and client render branches (MOVE-06: `FREE_MOVE` phase), to multi-step flow extensions requiring careful state threading (PASS-02: attacker repositioning during First-time Pass flight). Three bugs touch `applyPass` in `applyRoll`. Two bugs extend existing handlers (`applyUndo`, `applyEndTurn`). One adds a new server event (`game:cancel_movement`). One adds a full new game phase with a new socket event (`game:free_move`).

The central design invariant of this codebase is server-authoritative state: every fix originates in a pure engine function, is wired into a socket handler, and is broadcast via `broadcastState`. Client changes are display / UX only. Every new socket event follows the established pattern: add to `ClientEvents` / `ClientToServerEvents` in `events.ts`, add a `socket.on` block in `gameHandlers.ts` guarded by `isProcessing`, `isActivePlayer`, and a phase guard, then call `broadcastState`.

**Primary recommendation:** Work through fixes in dependency order — shared types first (add `FREE_MOVE` phase, new `GameState` fields), then engine functions, then handlers, then client. BUG-01 through BUG-05 are independent; MOVE-06 and PASS-02 each add a new flow and should be treated as small features, not just patches.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**BUG-01:**

- D-01: Server-only fix. In `applyPass` (gameEngine.ts), skip the interception loop entirely when `state.lastActionType === 'HEADER'`. The client-side guard at HexGrid.tsx:322–325 is already in place.
- D-02: The HIGH_PASS contest itself is unchanged — only the FIRST_TIME_PASS following a HEADER win is unblockable.

**BUG-02:**

- D-03: Add a "Cancel" button visible only when `paceUsedByPieceId` is empty (no piece moved yet in the current slot).
- D-04: Pressing Cancel emits `game:cancel_movement`. Server reverts to PASS phase restoring full state. No movement slot consumed.
- D-05: This is the only new Back button needed. No other phases require one.

**BUG-03:**

- D-06: Extend `applyUndo` to also accept `phase === 'HIGH_PASS_MOVEMENT'`. Same slot-boundary + DICE_ROLL lock logic applies.
- D-07: The client `canUndo` computation in ActionPanel already reads from `eventLog` — show Undo button in HIGH_PASS_MOVEMENT with same disabled-when-no-moves logic.

**BUG-04:**

- D-08: After the interception loop in `applyPass`, before returning delivered-ball state, check if `targetHex` is occupied. If occupied: set `carrierId` to that piece's id and `ball.position` to that piece's position.
- D-09: If occupant belongs to defending team, also set `attackingTeam` and `activeTeam` to defender's team. Phase stays `PASS`.
- D-10: Applies to STANDARD_PASS, FIRST_TIME_PASS, LONG_BALL — not HIGH_PASS (already routes to HEADER).

**BUG-05:**

- D-11: In GK-save → LOOSE_BALL transition in gameEngine.ts: replace ball position with GK's current hex position (`state.pieces.find(p => p.id === gkId).position`), not the shot origin hex.

**MOVE-06:**

- D-12: Free move fires after MOVEMENT phase ends (End Turn). In `applyEndTurn`, when `state.pendingFreeMove != null`, transition to `FREE_MOVE` instead of `PASS`. Clear `pendingFreeMove` on entry.
- D-13: Eligible pieces are outfield players already in the opponent's final third when `FREE_MOVE` starts. Each gets up to 6 hexes independently.
- D-14: `FREE_MOVE` ends (→ PASS) when active team presses End Turn. ActionPanel shows "Free Move — move up to 6 hexes per player in the opponent's third" with End Turn button.
- D-15: `FREE_MOVE` inherits `attackingTeam`/`activeTeam` from the MOVEMENT phase that produced it.
- D-16: Add `'FREE_MOVE'` to `GamePhase` union in `packages/shared/src/types.ts`. Add `ELIGIBLE_NEXT_ACTIONS['FREE_MOVE_END']` (or equivalent) as needed.

**PASS-02:**

- D-17: After First-time Pass target chosen, before SNAP_DEFLECT: attacker moves 1 non-passer player up to 1 hex. End Turn to commit (or skip immediately).
- D-18: Reuse existing `SNAP_DEFLECT` phase for defender's move. `lastActionType === 'FIRST_TIME_PASS'` distinguishes from snapshot deflect — resolution at SNAP_DEFLECT end follows pass path (not shot path).
- D-19: Pass path highlighted throughout attacker repositioning step and SNAP_DEFLECT phase.
- D-20: Attacker's 1-hex repositioning is max 1 hex. Passer cannot be moved.

### Claude's Discretion

- BUG-03 slot-boundary logic: whether a HEADER_ACCURACY_ACK event counts as a slot boundary — use existing SLOT_ADVANCE / DICE_ROLL lock logic as written, no new boundary type needed.
- MOVE-06 test coverage for zero eligible players (empty final third) — FREE_MOVE phase should immediately return to PASS if no eligible players exist.

### Deferred Ideas (OUT OF SCOPE)

None.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                          | Research Support                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-01  | Header pass is not blockable — skip interception loop server-side when `lastActionType === 'HEADER'` | D-01/D-02: `applyPass` PASS case at line ~1051; guard already client-side at HexGrid.tsx:322-325                                      |
| BUG-02  | Cancel control in MOVEMENT phase when no piece has moved                                             | D-03/D-04/D-05: new `game:cancel_movement` event + `applyCancelMovement` engine function; ActionPanel MOVEMENT branch                 |
| BUG-03  | Undo works in HIGH_PASS_MOVEMENT phase                                                               | D-06/D-07: `applyUndo` phase guard at line 784; `gameHandlers.ts` GAME_UNDO handler at line 884                                       |
| BUG-04  | Pass to occupied hex → ball pickup by occupant                                                       | D-08/D-09/D-10: `applyPass` return path at line ~1151 (STANDARD/FIRST_TIME/LONG_BALL delivery)                                        |
| BUG-05  | Loose ball after save spawns at GK hex                                                               | D-11: SAVE → LOOSE_BALL branch in SHOT case at line ~1408; use `gkEffectivePos` (already computed)                                    |
| MOVE-06 | Free 6-hex move for players in opponent final third after crossing                                   | D-12 through D-16: `applyEndTurn` line ~639; add `FREE_MOVE` phase to shared types; new handler + client branch                       |
| PASS-02 | Mid-pass repositioning during First-time Pass flight                                                 | D-17 through D-20: `applyRoll` PASS case after interception loop (line ~1148 TODO); new attacker sub-step in PASS; reuse SNAP_DEFLECT |

</phase_requirements>

## Architectural Responsibility Map

| Capability                         | Primary Tier                  | Secondary Tier                 | Rationale                                                                 |
| ---------------------------------- | ----------------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| BUG-01: interception suppression   | Server (gameEngine)           | —                              | Pass validation is server-only; client guard already exists               |
| BUG-02: cancel movement event      | Server (gameEngine + handler) | Client (ActionPanel)           | Server owns FSM revert; client owns cancel button UI                      |
| BUG-03: undo in HIGH_PASS_MOVEMENT | Server (gameEngine + handler) | Client (ActionPanel)           | `applyUndo` is server-pure; handler guard must be relaxed                 |
| BUG-04: pass-to-occupied pickup    | Server (gameEngine)           | —                              | `applyRoll` PASS delivery path; no client changes needed                  |
| BUG-05: loose ball position        | Server (gameEngine)           | —                              | Single line in SHOT SAVE branch; `gkEffectivePos` already in scope        |
| MOVE-06: FREE_MOVE phase           | Server (gameEngine + handler) | Client (ActionPanel)           | New FSM phase; client needs render branch + End Turn wiring               |
| PASS-02: mid-pass repositioning    | Server (gameEngine + handler) | Client (ActionPanel + HexGrid) | New sub-step in PASS flow; client needs attacker-step UI + path highlight |

## Standard Stack

### Core (no new packages)

This phase adds no external dependencies. All changes are within existing packages:

| Package                  | Role                                         | Location                              |
| ------------------------ | -------------------------------------------- | ------------------------------------- |
| `@counter-attack/shared` | Shared types, socket events, action sequence | `packages/shared/src/`                |
| Server game engine       | FSM transitions (pure functions)             | `packages/server/src/gameEngine.ts`   |
| Server socket handlers   | Socket event wiring                          | `packages/server/src/gameHandlers.ts` |
| React client             | UI panels and board overlays                 | `packages/client/src/components/`     |

**Package Legitimacy Audit:** Not applicable — this phase installs no external packages.

## Architecture Patterns

### System Architecture Diagram

```
Client                       Server
  |                            |
  | game:cancel_movement -----> [applyCancelMovement]
  |                             → revert to PASS, broadcast
  |
  | game:move (MOVEMENT) -----> [applyMove]
  |                             → if carrier crosses thirds: pendingFreeMove set
  |
  | game:end-turn (MOVEMENT)    [applyEndTurn]
  |     ATTACKER_2 → null  ---> → if pendingFreeMove: transition FREE_MOVE
  |                             → else: transition PASS
  |
  | game:free_move_end -------> [applyFreeMoveEnd]
  |  (or game:end-turn          → transition to PASS, clear pendingFreeMove
  |   in FREE_MOVE phase)
  |
  | game:roll (FIRST_TIME_PASS) [applyRoll PASS case]
  |    pass target chosen  ---> → start attacker 1-hex step sub-state
  |                             → broadcast (attacker sees step prompt)
  |    End Turn            ---> → transition SNAP_DEFLECT
  |                             → defender moves 1 player; end-turn resolves pass
  |                               (lastActionType='FIRST_TIME_PASS' = pass path, not shot path)
```

### Key Source Files and Their Roles

```
packages/shared/src/
├── types.ts              # GamePhase union (add FREE_MOVE), GameState fields
│                         #   (firstTimePassPath, freeMoveEligibleIds, freeMoveUsed)
├── events.ts             # ClientEvents / ClientToServerEvents (add new events)
└── actionSequence.ts     # ELIGIBLE_NEXT_ACTIONS (add FREE_MOVE row if needed)

packages/server/src/
├── gameEngine.ts         # All pure FSM mutations — the 7 fix sites
└── gameHandlers.ts       # Socket event wiring — 2 new handlers + 2 handler extensions

packages/client/src/components/
├── ActionPanel.tsx        # UI for MOVEMENT cancel, HIGH_PASS_MOVEMENT undo display,
│                         #   PASS-02 attacker step, FREE_MOVE prompt
└── HexGrid.tsx           # Pass path highlighting for PASS-02 attacker step
```

### Pattern 1: Pure Engine Function + Handler Wiring

Every game state transition in this codebase follows the same pattern:

```typescript
// Source: packages/server/src/gameHandlers.ts (established pattern)

socket.on(ClientEvents.GAME_SOME_EVENT, () => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5 mutex

  room.isProcessing = true;
  try {
    if (room.gameState === null || room.gameState.phase !== 'EXPECTED_PHASE') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    if (!isActivePlayer(socket, room)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
      broadcastState(io, room);
      return;
    }
    const result = applyXxx(room.gameState);
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room);
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room);
  } finally {
    room.isProcessing = false;
  }
});
```

[ASSUMED] — distilled from reading gameHandlers.ts; this is the established project pattern.

### Pattern 2: applyUndo Phase Extension (BUG-03)

The current GAME_UNDO handler at line 884 has:

```typescript
// Source: packages/server/src/gameHandlers.ts:884
if (room.gameState === null || room.gameState.phase !== 'MOVEMENT') {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
```

BUG-03 (D-06) requires this to also accept `'HIGH_PASS_MOVEMENT'`. The guard must become:

```typescript
const validUndoPhases: GamePhase[] = ['MOVEMENT', 'HIGH_PASS_MOVEMENT'];
if (room.gameState === null || !validUndoPhases.includes(room.gameState.phase)) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
```

`applyUndo` itself needs the same extension — its current implicit phase assumption must be made explicit to reject non-MOVEMENT non-HIGH_PASS_MOVEMENT phases (or remain phase-agnostic and let the handler guard do the work). The engine can remain phase-agnostic since it only looks at `eventLog` for slot boundaries, not `state.phase` directly.

[VERIFIED: codebase grep] — confirmed by reading `applyUndo` at line 784 and the GAME_UNDO handler at line 884.

### Pattern 3: applyEndTurn FREE_MOVE Branching (MOVE-06)

The existing `applyEndTurn` at line 639 is only callable from `MOVEMENT` phase (guard at line 643). After ATTACKER_2 → null, it currently transitions to `PASS` or HALF_TIME/FULL_TIME. MOVE-06 adds a branch:

```typescript
// In applyEndTurn, after clock and half-end check, at ATTACKER_2→null:
if (nextSlot === null && state.pendingFreeMove !== null) {
  const eligibleIds = state.pieces
    .filter(p =>
      p.teamId === state.pendingFreeMove!.team &&
      p.role !== 'GK' &&
      isInRegion(p.position, state.attackingTeam === 'home' ? 'awayThird' : 'homeThird')
    )
    .map(p => p.id);

  if (eligibleIds.length === 0) {
    // D-13 discretion: no eligible players → skip FREE_MOVE, go straight to PASS
    return { ok: true, state: { ...state, phase: 'PASS', pendingFreeMove: null, ... } };
  }

  return {
    ok: true,
    state: {
      ...state,
      phase: 'FREE_MOVE',
      pendingFreeMove: null,
      freeMoveEligibleIds: eligibleIds,    // new GameState field
      freeMoveUsedPace: {},                 // new GameState field: Record<string, number>
      movementSlot: null,
      ...clockFields,
    },
  };
}
```

[ASSUMED] — derived from D-12/D-13 + reading `applyEndTurn` at line 639.

### Pattern 4: PASS-02 First-time Pass Sub-step

The TODO at line 1148 in `gameEngine.ts` marks where PASS-02 activates:

```typescript
// Current code at gameEngine.ts:1148
// TODO: FIRST_TIME_PLAYER_MOVES (PASS-02) deferred to Phase 8.3
// The FIRST_TIME_PASS effect (mid-pass player movement) would be handled here.
return { ok: true, state: { ...state, phase: 'PASS', ball: { ... }, ... } };
```

PASS-02 replaces this return with an intermediate state that keeps the ball in flight:

```typescript
// When lastActionType === 'FIRST_TIME_PASS' and interception loop passes:
if (newLastActionType === 'FIRST_TIME_PASS') {
  // Intermediate state: attacker moves 1 non-passer player (≤1 hex) before SNAP_DEFLECT
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',               // stays PASS — attacker sees "move 1 player" prompt
      ball: { position: targetHex, carrierId: teammate?.id ?? null },
      passTargetHex: targetHex,    // preserve for path highlight
      firstTimePassPath: hexLine(carrier.position, targetHex),  // new field
      firstTimePassStep: 'ATTACKER',  // new field: 'ATTACKER' | 'DONE'
      lastActionType: 'FIRST_TIME_PASS',
      ...
    },
  };
}
// Then: End Turn from attacker → transition to SNAP_DEFLECT (D-18)
// Then: SNAP_DEFLECT End Turn → resolve pass path (lastActionType='FIRST_TIME_PASS')
```

[ASSUMED] — derived from D-17 through D-20 + reading `applyRoll` PASS case.

### Anti-Patterns to Avoid

- **Adding phase checks inside `applyRoll`'s PASS case:** BUG-01 fix is a single `if (state.lastActionType === 'HEADER') { skip loop }` — don't restructure the surrounding code.
- **Resetting `pendingFreeMove` inside `applyMove`:** It is already set in `applyMove` correctly (line 564). Only clear it in `applyEndTurn` / `applyUndo` (already handled) / on entry to FREE_MOVE.
- **Adding `FREE_MOVE` to `ELIGIBLE_NEXT_ACTIONS` as a `LastActionType`:** `FREE_MOVE` is a phase, not a last-action-type. The `LastActionType` union is used for action sequencing from PASS; `FREE_MOVE` transitions directly to PASS without adding a row to the eligibility table.
- **Using `teammate?.id ?? null` for BUG-04:** After the interception loop, the occupant at `targetHex` may be a defender (BUG-04 D-09), not just a teammate. Find the piece at `targetHex` regardless of team, then determine possession.
- **Forgetting to `broadcastState` after Free Move step:** The `applyFreeMove` handler must broadcast after each individual move so both clients see piece repositioning.

## Don't Hand-Roll

| Problem                      | Don't Build           | Use Instead                                       | Why                                                                        |
| ---------------------------- | --------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| New socket event boilerplate | Custom event bus      | `ClientEvents` + `socket.on` pattern              | All events are already typed in `events.ts`; follow existing pattern       |
| Pass path calculation        | Custom line algorithm | `hexLine(from, to)` from `@counter-attack/shared` | Already used at line 701 in SNAP_DEFLECT; correct for axial coords         |
| Final third membership       | Custom q-column check | `isInRegion(pos, 'awayThird')` or `'homeThird'`   | Already used in `applyMove` (line 559–563) for `pendingFreeMove` detection |
| Hex distance validation      | Custom math           | `hexDistance(a, b)` from `@counter-attack/shared` | Used throughout engine; correct for axial coords                           |

## Common Pitfalls

### Pitfall 1: BUG-04 teammate vs. any-piece lookup

**What goes wrong:** The existing delivery code at line 1091 uses `state.pieces.find(p => p.teamId === carrier.teamId && p.position.q === targetHex.q ...)` — looking only for same-team pieces at `targetHex`. An opponent at `targetHex` would not be found, so `carrierId` would be `null` (ball loose) instead of the intercepting player.

**Why it happens:** The original code assumed a pass always lands on an empty hex or a teammate hex. BUG-04 adds the case where the target hex is occupied by an opponent.

**How to avoid:** After the interception loop, find any piece (any team) at `targetHex`. If found: set `carrierId` to that piece. If it's a defender, also flip `attackingTeam` and `activeTeam`. Only if no piece at `targetHex` does the ball land loose / with a teammate.

**Warning signs:** After a pass, `carrierId` is `null` when a piece visually stands on the target hex.

### Pitfall 2: BUG-05 using `state.ball.position` instead of GK effective position

**What goes wrong:** The SAVE → LOOSE_BALL branch currently places the loose ball at the shot origin hex (the shooter's position when the shot was declared). The GK's effective position is already computed as `gkEffectivePos` earlier in the SHOT case (line 1187). The loose ball must spawn at `gkEffectivePos`.

**Why it happens:** The LOOSE_BALL return at line 1413 uses `gkEffectivePos` for the GK catch path (`GK_RESTART`) but the dropped-ball path incorrectly references `state.ball.position`.

**How to avoid:** In the `handling.caught === false` LOOSE_BALL return: `ball: { position: gkEffectivePos, carrierId: null }`. The `gkEffectivePos` variable is already in scope.

**Warning signs:** After a save fumble, the ball appears on the opposite end of the pitch from the goalkeeper.

### Pitfall 3: applyEndTurn FREE_MOVE consuming pendingFreeMove too early

**What goes wrong:** `applyMove` (line 557–565) sets `pendingFreeMove` when the carrier crosses thirds. `applyEndTurn` must only consume (clear) `pendingFreeMove` at the ATTACKER_2→null transition — not at intermediate slot transitions (ATTACKER_4→DEFENDER_5 or DEFENDER_5→ATTACKER_2).

**Why it happens:** The non-ATTACKER_2 slot transition return at line 728 already propagates `pendingFreeMove: state.pendingFreeMove` (implicit spread), so intermediate transitions are safe. Only the `nextSlot === null` branch at line 666 needs the FREE_MOVE insertion.

**How to avoid:** Insert the `pendingFreeMove` check inside the `if (nextSlot === null)` block only. The HALF_TIME/FULL_TIME early return at line 681 must also be checked — if time ends while `pendingFreeMove` is set, discard it (no free move after half ends).

**Warning signs:** FREE_MOVE phase fires in the middle of a movement slot rather than after ATTACKER_2.

### Pitfall 4: PASS-02 SNAP_DEFLECT resolution following pass path vs shot path

**What goes wrong:** The existing SNAP_DEFLECT end-turn handler (gameHandlers.ts line 680) calls `computeShotPathDeflection` with `hexLine(snapShooter.position, snapTarget)` where `snapTarget = baseSnapState.shotTargetHex`. For PASS-02, the "path" is the pass path (`firstTimePassPath`), not a shot path. If `lastActionType === 'FIRST_TIME_PASS'` the resolution must use the pass path and deliver ball (not evaluate a shot duel).

**Why it happens:** SNAP_DEFLECT was designed for snapshots; reusing it for PASS-02 requires a discriminant check. The context variable is `lastActionType` on the state.

**How to avoid:** At the top of the SNAP_DEFLECT end-turn handler branch, check `lastActionType`. If `'FIRST_TIME_PASS'`: check defenders on `firstTimePassPath`; if deflected → LOOSE_BALL at deflector; if not deflected → deliver ball to `passTargetHex` (normal BUG-04 pickup logic). If not `'FIRST_TIME_PASS'`: follow existing snapshot resolution.

**Warning signs:** A First-time Pass after SNAP_DEFLECT resolves as a shot duel instead of delivering the ball.

### Pitfall 5: BUG-02 cancel guard using wrong emptiness check

**What goes wrong:** The Cancel button must only appear when no piece has moved in the current slot (`paceUsedByPieceId` is empty, equivalently no entries). Using `movedPieceIds.length === 0` is wrong — a piece with partial pace used (1 of 4 hexes) is not in `movedPieceIds` yet but has moved.

**Why it happens:** `movedPieceIds` tracks pieces that have fully exhausted their pace allowance, not pieces that have moved at all. `paceUsedByPieceId` tracks any partial movement.

**How to avoid:** Cancel is available when `Object.keys(paceUsedByPieceId).length === 0`. Apply this check in both the client (ActionPanel cancel button visibility) and the server `applyCancelMovement` function (pre-condition guard).

**Warning signs:** Cancel button appears after the first hex step of a piece, even though the move is irreversible.

### Pitfall 6: HIGH_PASS_MOVEMENT undo using HP_REPOSITION as boundary

**What goes wrong:** The HP_MOVE events (piece repositioning in HIGH_PASS_MOVEMENT) must be undoable. The `applyUndo` slot-boundary scan looks for `SLOT_ADVANCE` or `KICK_OFF` events. In HIGH_PASS_MOVEMENT, the most recent slot boundary is a `HP_REPOSITION` event (emitted when the slot transitions from ATTACKER to DEFENDER). If `applyUndo` doesn't recognize `HP_REPOSITION` as a slot boundary, it may attempt to undo moves from before the phase began.

**Why it happens:** `HP_REPOSITION` was not part of the original slot-boundary design (which pre-dates HIGH_PASS).

**How to avoid:** Confirm whether HIGH_PASS_MOVEMENT reuses the same eventLog structure or has its own. Reading the HIGH_PASS_MOVEMENT handler (gameHandlers.ts ~line 530): it does emit `HP_REPOSITION` as the slot boundary between ATTACKER and DEFENDER slots. `applyUndo` must treat `HP_REPOSITION` as a slot boundary when in HIGH_PASS_MOVEMENT phase, OR the handler can clear `HP_MOVE` events on slot transition (current behavior is to append). The simplest fix: in `applyUndo`, also treat `HP_REPOSITION` as a boundary event when `state.phase === 'HIGH_PASS_MOVEMENT'`. Per D-06 / Claude's Discretion: "use existing SLOT_ADVANCE / DICE_ROLL lock logic as written" — meaning no new boundary type. Undo should simply look for `HP_MOVE` events after the most recent `HP_REPOSITION` (or after the start of the log).

**Warning signs:** Undo in HIGH_PASS_MOVEMENT returns `UNDO_LOCKED` even when no piece has moved in the current slot, or undoes moves from the pre-HEADER repositioning.

### Pitfall 7: MOVE-06 final-third membership using wrong region for attackingTeam

**What goes wrong:** "Opponent's final third" is `awayThird` when `attackingTeam === 'home'` and `homeThird` when `attackingTeam === 'away'`. Using a fixed region name will give wrong results for away teams.

**Why it happens:** Pitch regions are named from the board's perspective (`homeThird` = q≤10, `awayThird` = q≥26), not from any team's perspective.

**How to avoid:** The region to check is already computed correctly in `applyMove` at line 559–561 (`fromInHomeThird`/`toInHomeThird`). For FREE_MOVE eligibility: use `const opponentThird = state.attackingTeam === 'home' ? 'awayThird' : 'homeThird'`.

## Code Examples

### BUG-01: Skip interception loop for header pass

```typescript
// Source: packages/server/src/gameEngine.ts, applyRoll PASS case, ~line 1051
// BEFORE: always runs interception loop
for (let i = 0; i < interceptors.length; i++) { ... }

// AFTER: skip for header pass (D-01)
// BUG-01: header passes are unblockable — skip interception entirely.
const isHeaderPass = newLastActionType === 'HEADER';
if (!isHeaderPass) {
  for (let i = 0; i < interceptors.length; i++) {
    // ... existing interception loop unchanged ...
  }
}
```

### BUG-04: Occupant check after interception loop

```typescript
// Source: packages/server/src/gameEngine.ts, ~line 1090 (after interception loop)
// After the interception loop: check if targetHex is occupied

// Find ANY piece (any team) at targetHex
const occupant = state.pieces.find(
  (p) => p.position.q === targetHex.q && p.position.r === targetHex.r,
);

if (occupant) {
  // BUG-04 (D-08): ball pickup by the piece at target hex
  const newOwnerTeam = occupant.teamId;
  const possessionChanges = newOwnerTeam !== carrier.teamId; // D-09
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      ball: { position: occupant.position, carrierId: occupant.id },
      attackingTeam: possessionChanges ? newOwnerTeam : state.attackingTeam,
      activeTeam: possessionChanges ? newOwnerTeam : state.activeTeam,
      lastActionType: newLastActionType,
      actionCount: state.actionCount + passTimeCost,
      passTargetHex: null,
      preGeneratedInterceptionDice: [],
      eventLog: newEventLog,
    },
  };
}

// Existing return for no-occupant case (teammate or empty hex)
const teammate = state.pieces.find(...);
return { ok: true, state: { ...state, ball: { carrierId: teammate?.id ?? null, ... }, ... } };
```

### BUG-05: Loose ball at GK position

```typescript
// Source: packages/server/src/gameEngine.ts, ~line 1408 (SHOT case, SAVE branch, handling.caught=false)
// BEFORE (bug):
ball: { position: gkEffectivePos, carrierId: null },  // Actually already correct in save catch path

// The bug is specifically in the LOOSE_BALL return when handling.caught === false:
// gkEffectivePos is already in scope at line 1187 — just ensure this variable is used.
// Verify: `ball: { position: gkEffectivePos, carrierId: null }` at the LOOSE_BALL return.
```

### BUG-02: applyCancelMovement engine function

```typescript
// Source: new function in packages/server/src/gameEngine.ts

export type ApplyCancelMovementResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'PIECES_ALREADY_MOVED' }
  | { ok: true; state: GameState };

export function applyCancelMovement(state: GameState): ApplyCancelMovementResult {
  if (state.phase !== 'MOVEMENT') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  // BUG-02 D-03: only cancellable when no piece has moved at all in the current slot
  if (Object.keys(state.paceUsedByPieceId).length > 0) {
    return { ok: false, reason: 'PIECES_ALREADY_MOVED' };
  }
  // Revert to PASS phase — as if applyStartMovement was never called (D-04)
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      movementSlot: null,
      movedPieceIds: [],
      paceUsedByPieceId: {},
    },
  };
}
```

### MOVE-06: FREE_MOVE phase transition in applyEndTurn

```typescript
// Source: packages/server/src/gameEngine.ts, applyEndTurn, inside `if (nextSlot === null)` block

// After clock and half-end checks, before the normal ATTACKER_2→PASS return:
if (state.pendingFreeMove !== null) {
  const freeTeam = state.pendingFreeMove.team;
  const opponentThird = freeTeam === 'home' ? 'awayThird' : 'homeThird';
  const eligibleIds = state.pieces
    .filter(
      (p) => p.teamId === freeTeam && p.role !== 'GK' && isInRegion(p.position, opponentThird),
    )
    .map((p) => p.id);

  const baseState = {
    ...state,
    phase: 'PASS' as GamePhase, // fallthrough if empty
    movementSlot: null as MovementSlot | null,
    activeTeam: nextActiveTeam,
    eventLog: [...state.eventLog, slotAdvanceEvent],
    movedPieceIds: [],
    paceUsedByPieceId: {},
    actionCount: newActionCount,
    addedTime: newAddedTime,
    lastActionType: 'MOVEMENT_PHASE' as LastActionType,
    pendingFreeMove: null,
  };

  if (eligibleIds.length === 0) {
    return { ok: true, state: baseState }; // no eligible players → skip FREE_MOVE
  }

  return {
    ok: true,
    state: {
      ...baseState,
      phase: 'FREE_MOVE',
      freeMoveEligibleIds: eligibleIds,
      freeMoveUsedPace: {},
    },
  };
}
```

## State of the Art

| Old Approach                           | Current Approach                     | When Changed     | Impact                                 |
| -------------------------------------- | ------------------------------------ | ---------------- | -------------------------------------- |
| Header pass could be blocked (bug)     | Header pass skips interception loop  | Phase 17 BUG-01  | Rulebook compliant                     |
| MOVEMENT phase had no cancel           | Cancel button when no moves made     | Phase 17 BUG-02  | Better UX, matches other Back buttons  |
| Undo only in MOVEMENT                  | Undo also in HIGH_PASS_MOVEMENT      | Phase 17 BUG-03  | Consistent undo across all move phases |
| Pass to occupied hex → ball loose      | Pass to occupied hex → ball pickup   | Phase 17 BUG-04  | Rulebook compliant                     |
| Loose ball after save at shot origin   | Loose ball after save at GK hex      | Phase 17 BUG-05  | Rulebook compliant                     |
| pendingFreeMove set but never consumed | FREE_MOVE phase fires after MOVEMENT | Phase 17 MOVE-06 | Scaffolded handler completed           |
| FIRST_TIME_PASS delivery immediate     | Attacker 1-hex step + SNAP_DEFLECT   | Phase 17 PASS-02 | Rulebook compliant                     |

## Assumptions Log

| #   | Claim                                                                                                                                        | Section                     | Risk if Wrong                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| A1  | `applyCancelMovement` engine function should check `paceUsedByPieceId` emptiness (not `movedPieceIds`) for the irreversibility guard         | Code Examples (BUG-02)      | Cancel becomes available at wrong time, or reverts partial moves                  |
| A2  | PASS-02 intermediate state stays in `PASS` phase with new flags (`firstTimePassPath`, `firstTimePassStep`) rather than a dedicated sub-phase | Code Examples (PASS-02)     | If a separate phase is cleaner, the state machine design changes                  |
| A3  | `HP_REPOSITION` should be treated as a slot boundary in `applyUndo` when phase is `HIGH_PASS_MOVEMENT`                                       | Common Pitfalls (Pitfall 6) | Undo either over-undoes (crosses slot) or under-undoes (locked when shouldn't be) |
| A4  | BUG-05 bug is specifically the SAVE → LOOSE_BALL path using wrong position — `gkEffectivePos` is correct and already in scope                | Code Examples (BUG-05)      | If the actual bug is elsewhere, the fix target is wrong                           |
| A5  | FREE_MOVE phase should use `game:end-turn` (existing event) rather than a new `game:free_move_end` event                                     | Architecture Patterns       | A new event adds boilerplate; reusing end-turn requires a phase guard             |

## Open Questions

1. **PASS-02 sub-state representation**
   - What we know: D-17 says attacker moves 1 non-passer player before SNAP_DEFLECT.
   - What's unclear: Whether this uses a new flag on `GameState` (e.g. `firstTimePassStep: 'ATTACKER' | null`) or a new lightweight phase.
   - Recommendation: Use a `firstTimePassStep` flag on GameState (stays in PASS phase) to avoid adding another entry to the `GamePhase` union. Simpler than a new phase.

2. **BUG-02 server event name**
   - What we know: D-04 specifies `game:cancel_movement`.
   - What's unclear: Whether `GAME_END_TURN` could be overloaded for cancel (phase === MOVEMENT, no moves made → implicit cancel). The CONTEXT.md explicitly names a new event.
   - Recommendation: Add new `game:cancel_movement` event as specified. Don't overload end-turn.

3. **MOVE-06 Free Move event name**
   - What we know: D-12/D-16 mention a `game:free_move` event and `FREE_MOVE_END` in `ELIGIBLE_NEXT_ACTIONS`.
   - What's unclear: Whether free move pieces are moved via the existing `game:move` event (simpler) or a separate `game:free_move` event.
   - Recommendation: Reuse `game:move` with a phase guard in the GAME_MOVE handler for FREE_MOVE phase. Use `game:end-turn` (existing) to end FREE_MOVE. Only add to `ClientEvents` if the semantics differ enough to warrant separation. This avoids two new events.

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/logic changes within an existing Node.js/React monorepo. No new external CLI tools, databases, or services are required.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest                                                                                                                                                  |
| Config file        | `packages/server/vitest.config.ts` (exists per test file pattern)                                                                                       |
| Quick run command  | `pnpm --filter @counter-attack/server test --run`                                                                                                       |
| Full suite command | `pnpm --filter @counter-attack/server test --run && pnpm --filter @counter-attack/client test --run && pnpm --filter @counter-attack/shared test --run` |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                    | Test Type   | Automated Command                                              | File Exists?            |
| ------- | ------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------- | ----------------------- |
| BUG-01  | `applyRoll` skips interception loop when `lastActionType === 'HEADER'`                      | unit        | `pnpm --filter @counter-attack/server test --run gameEngine`   | ✅ `gameEngine.test.ts` |
| BUG-02  | `applyCancelMovement` returns ok when no pieces moved; returns error when pieces moved      | unit        | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ Wave 0               |
| BUG-02  | `game:cancel_movement` socket handler reverts to PASS phase                                 | integration | `pnpm --filter @counter-attack/server test --run gameHandlers` | ❌ Wave 0               |
| BUG-03  | `applyUndo` works in HIGH_PASS_MOVEMENT phase                                               | unit        | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ Wave 0               |
| BUG-04  | Pass to defender hex transfers possession                                                   | unit        | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ Wave 0               |
| BUG-04  | Pass to teammate hex on occupied target → pickup                                            | unit        | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ Wave 0               |
| BUG-05  | Save → LOOSE_BALL spawns ball at GK position                                                | unit        | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ Wave 0               |
| MOVE-06 | `applyEndTurn` transitions to FREE_MOVE when pendingFreeMove set and eligible players exist | unit        | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ Wave 0               |
| MOVE-06 | `applyEndTurn` skips FREE_MOVE (→ PASS) when no eligible players                            | unit        | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ Wave 0               |
| PASS-02 | FIRST_TIME_PASS delivery enters attacker 1-hex step then SNAP_DEFLECT                       | unit        | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ Wave 0               |
| PASS-02 | SNAP_DEFLECT with `lastActionType='FIRST_TIME_PASS'` resolves as pass (not shot)            | unit        | `pnpm --filter @counter-attack/server test --run gameHandlers` | ❌ Wave 0               |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/server test --run`
- **Per wave merge:** Full suite (server + client + shared)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/__tests__/gameEngine.phase17.test.ts` — unit tests for all 7 engine fixes
- [ ] `packages/server/src/__tests__/gameHandlers.phase17.test.ts` — integration tests for new socket events (cancel, free move)

## Security Domain

ASVS V5 Input Validation applies. All new server handlers must:

1. Validate `socket.data.roomCode` is defined before any operation.
2. Check `room.isProcessing` mutex before any state mutation.
3. Reject with `WRONG_PHASE` for unexpected phase states.
4. Reject with `WRONG_TEAM` for incorrect team.
5. Never trust client-supplied piece positions — all position validation uses server-side piece array.

No new authentication, session management, cryptography, or access control patterns are introduced. The existing server-authoritative model (ARCH-01) is maintained throughout.

| ASVS Category         | Applies       | Standard Control                                     |
| --------------------- | ------------- | ---------------------------------------------------- |
| V2 Authentication     | No            | —                                                    |
| V3 Session Management | No            | —                                                    |
| V4 Access Control     | Yes (minimal) | `isActivePlayer` guard on all handlers               |
| V5 Input Validation   | Yes           | Phase guard + piece ownership check in every handler |
| V6 Cryptography       | No            | —                                                    |

## Sources

### Primary (HIGH confidence)

- `packages/server/src/gameEngine.ts` — direct code reading for all fix sites
- `packages/server/src/gameHandlers.ts` — direct code reading for handler patterns
- `packages/shared/src/types.ts` — GamePhase, GameState, ActionEvent types
- `packages/shared/src/events.ts` — ClientEvents, ClientToServerEvents
- `packages/shared/src/actionSequence.ts` — ELIGIBLE_NEXT_ACTIONS
- `packages/client/src/components/ActionPanel.tsx` — MOVEMENT render branch, pass flow, HIGH_PASS_MOVEMENT branch
- `packages/client/src/components/HexGrid.tsx` — isHeaderPass guard, SNAP_DEFLECT highlighting
- `.planning/phases/17-rule-bugs/17-CONTEXT.md` — locked decisions D-01 through D-20

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — established locked decisions from prior phases
- `packages/server/src/__tests__/gameEngine.test.ts` — test fixture patterns

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; changes are within established codebase patterns
- Architecture: HIGH — all fix sites read directly from source; no inference required
- Pitfalls: MEDIUM — derived from code reading + known game engine patterns; some assumptions about edge cases

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (codebase is stable; no upstream dependency changes anticipated)
