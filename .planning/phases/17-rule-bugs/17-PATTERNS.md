# Phase 17: Rule Bugs - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 7 (5 modified, 2 new test files)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File                                          | Role       | Data Flow        | Closest Analog                                                                         | Match Quality |
| ---------------------------------------------------------- | ---------- | ---------------- | -------------------------------------------------------------------------------------- | ------------- |
| `packages/shared/src/types.ts`                             | model      | transform        | self (existing union extension)                                                        | exact         |
| `packages/shared/src/events.ts`                            | config     | request-response | self (existing event map extension)                                                    | exact         |
| `packages/shared/src/actionSequence.ts`                    | config     | transform        | self (existing table extension)                                                        | exact         |
| `packages/server/src/gameEngine.ts`                        | service    | event-driven     | self (7 targeted fix sites)                                                            | exact         |
| `packages/server/src/gameHandlers.ts`                      | middleware | request-response | `gameHandlers.ts` GAME_RESTART_MOVEMENT handler (lines 907–938)                        | exact         |
| `packages/client/src/components/ActionPanel.tsx`           | component  | request-response | ActionPanel MOVEMENT branch (lines 494–548), HIGH_PASS_MOVEMENT branch (lines 108–125) | exact         |
| `packages/server/src/__tests__/gameEngine.phase17.test.ts` | test       | batch            | `packages/server/src/__tests__/gameEngine.test.ts`                                     | role-match    |

---

## Pattern Assignments

### `packages/shared/src/types.ts` — add `FREE_MOVE` to `GamePhase` union; add new `GameState` fields

**Analog:** `types.ts` lines 277–297 (GamePhase union), lines 344–352 (GameState movement fields), lines 384–397 (optional GameState fields)

**GamePhase extension pattern** (lines 277–297):

```typescript
export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'MOVEMENT'
  | 'PASS'
  | 'SNAP_DEFLECT' // ← existing example of a phase added as a new string literal
  | 'HIGH_PASS_MOVEMENT'
  | 'GK_KICK_MOVEMENT'
  // Phase 17 MOVE-06: free 6-hex move for players in opponent's final third
  | 'FREE_MOVE'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'REPLAY';
```

**New optional GameState fields pattern** (following lines 384–450 style — optional with `?`, documented with JSDoc, typed with `| null`):

```typescript
  /**
   * PASS-02 (Phase 17): path of an in-flight First-time Pass.
   * Array of hex coords from passer to target, computed by hexLine().
   * null outside FIRST_TIME_PASS attacker-step sub-state.
   */
  firstTimePassPath?: readonly HexCoord[] | null;
  /**
   * PASS-02 (Phase 17): sub-step within First-time Pass flow.
   * 'ATTACKER' = attacker may reposition 1 non-passer player ≤1 hex.
   * null outside this sub-state.
   */
  firstTimePassStep?: 'ATTACKER' | null;
  /**
   * MOVE-06 (Phase 17): piece IDs eligible for free 6-hex move (outfield players in opponent's third).
   * Set when entering FREE_MOVE phase; null outside FREE_MOVE.
   */
  freeMoveEligibleIds?: readonly string[] | null;
  /**
   * MOVE-06 (Phase 17): cumulative hexes used per piece during FREE_MOVE phase.
   * Key = pieceId; value = hexes moved so far (max 6).
   * null outside FREE_MOVE phase.
   */
  freeMoveUsedPace?: Readonly<Record<string, number>> | null;
```

---

### `packages/shared/src/events.ts` — add `GAME_CANCEL_MOVEMENT` to `ClientEvents`

**Analog:** `events.ts` lines 8–52 (`ClientEvents` const object) and lines 70–122 (`ClientToServerEvents` interface)

**New event entry pattern** (lines 8–52 — add after `GAME_UNDO`):

```typescript
export const ClientEvents = {
  // ...existing entries...
  GAME_UNDO: 'game:undo',
  /** Phase 17 BUG-02: cancels MOVEMENT phase before any piece has moved. */
  GAME_CANCEL_MOVEMENT: 'game:cancel_movement',
  // ...
} as const;
```

**ClientToServerEvents extension pattern** (lines 70–122 — add zero-arg entry):

```typescript
export interface ClientToServerEvents {
  // ...existing entries...
  [ClientEvents.GAME_UNDO]: () => void;
  /** Phase 17 BUG-02: revert MOVEMENT phase → PASS. Guard: paceUsedByPieceId must be empty. */
  [ClientEvents.GAME_CANCEL_MOVEMENT]: () => void;
}
```

---

### `packages/server/src/gameEngine.ts` — 7 fix sites + 1 new function

**Analog:** All patterns are within the same file.

#### BUG-01: Skip interception loop when `lastActionType === 'HEADER'`

**Fix site:** `applyRoll` PASS case, line 1051 (immediately before the `for` loop over interceptors).

**Pattern** — insert guard before the `for` loop (lines 1051–1087):

```typescript
// BUG-01 (Phase 17 D-01): header passes are unblockable — skip interception entirely.
const isHeaderPass = newLastActionType === 'HEADER';
if (!isHeaderPass) {
  for (let i = 0; i < interceptors.length; i++) {
    // ... existing interception loop unchanged (lines 1051–1087) ...
  }
}
```

#### BUG-04: Occupant check after interception loop

**Fix site:** After the interception loop (line 1089), before the teammate lookup and final return (lines 1091–1164). Replace the teammate-only lookup.

**Pattern** (from RESEARCH.md Code Examples, confirmed against lines 1089–1096):

```typescript
// BUG-04 (Phase 17 D-08/D-09): find ANY piece at targetHex (any team)
const occupant = state.pieces.find(
  (p) => p.position.q === targetHex.q && p.position.r === targetHex.r,
);
if (occupant) {
  const possessionChanges = occupant.teamId !== carrier.teamId; // D-09
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      ball: { position: occupant.position, carrierId: occupant.id },
      attackingTeam: possessionChanges ? occupant.teamId : state.attackingTeam,
      activeTeam: possessionChanges ? occupant.teamId : state.activeTeam,
      lastActionType: newLastActionType,
      actionCount: state.actionCount + passTimeCost,
      passTargetHex: null,
      preGeneratedInterceptionDice: [],
      eventLog: newEventLog,
    },
  };
}
// Existing no-occupant return follows (lines 1151–1164)
```

#### BUG-05: Loose ball spawns at GK hex

**Fix site:** `applyRoll` SHOT case, SAVE branch, `handling.caught === false` return at lines 1408–1422. `gkEffectivePos` is already in scope (computed at line ~1187). The catch branch (lines 1391–1406) already uses `gkEffectivePos` — the dropped-ball path at 1414 must match it.

**Verify:** `ball: { position: gkEffectivePos, carrierId: null }` — `gkEffectivePos` is already the correct variable; the bug is a reference to `state.ball.position` or the shooter position instead.

#### BUG-03: Extend `applyUndo` to accept `HIGH_PASS_MOVEMENT`

**Fix site:** `applyUndo` boundary scan at line 786. The function currently scans for `SLOT_ADVANCE` or `KICK_OFF` as boundaries. For `HIGH_PASS_MOVEMENT`, `HP_REPOSITION` is the slot boundary (D-06 / Pitfall 6).

**Pattern** (extend the `reduce` at line 786–788):

```typescript
export function applyUndo(state: GameState): ApplyUndoResult {
  // BUG-03 (Phase 17 D-06): also treat HP_REPOSITION as a slot boundary in HIGH_PASS_MOVEMENT
  const lastSlotAdvanceIdx = state.eventLog.reduce<number>((acc, evt, idx) => {
    const isBoundary =
      evt.type === 'SLOT_ADVANCE' ||
      evt.type === 'KICK_OFF' ||
      (state.phase === 'HIGH_PASS_MOVEMENT' && evt.type === 'HP_REPOSITION');
    return isBoundary ? idx : acc;
  }, -1);
  // ... rest of function unchanged (lines 790–839) ...
```

#### BUG-02: New `applyCancelMovement` function

**Pattern** (new export, follows return-type discriminated-union style used by all other `apply*` functions):

```typescript
export type ApplyCancelMovementResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'PIECES_ALREADY_MOVED' }
  | { ok: true; state: GameState };

export function applyCancelMovement(state: GameState): ApplyCancelMovementResult {
  if (state.phase !== 'MOVEMENT') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  // BUG-02 D-03: cancel only when no piece has started moving (Pitfall 5)
  if (Object.keys(state.paceUsedByPieceId).length > 0) {
    return { ok: false, reason: 'PIECES_ALREADY_MOVED' };
  }
  // D-04: revert to PASS — as if applyStartMovement was never called
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

#### MOVE-06: FREE_MOVE phase transition in `applyEndTurn`

**Fix site:** `applyEndTurn` lines 666–715 — inside the `if (nextSlot === null)` block (line 666), after the half-end check (lines 681–698) and before the normal PASS return (lines 700–715).

**Pattern** (from RESEARCH.md Code Examples, confirmed against lines 666–715):

```typescript
// MOVE-06 (Phase 17 D-12/D-13): insert before the normal ATTACKER_2→PASS return
if (state.pendingFreeMove !== null) {
  const freeTeam = state.pendingFreeMove.team;
  const opponentThird = freeTeam === 'home' ? 'awayThird' : 'homeThird'; // Pitfall 7
  const eligibleIds = state.pieces
    .filter(
      (p) => p.teamId === freeTeam && p.role !== 'GK' && isInRegion(p.position, opponentThird),
    )
    .map((p) => p.id);

  const baseState = {
    ...state,
    phase: 'PASS' as GamePhase,
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
    return { ok: true, state: baseState }; // D-13 discretion: no eligible players → skip
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
// existing normal PASS return follows
```

#### PASS-02: First-time Pass attacker repositioning sub-state

**Fix site:** Line 1148 (TODO comment) through end of PASS delivery return (line 1164). Replace the `return` with a branch that detects `FIRST_TIME_PASS` and sets intermediate state.

**Pattern** (from RESEARCH.md Code Examples):

```typescript
// PASS-02 (Phase 17 D-17): mid-pass repositioning for FIRST_TIME_PASS
// TODO replaced: FIRST_TIME_PLAYER_MOVES (PASS-02) now implemented
if (newLastActionType === 'FIRST_TIME_PASS') {
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS', // stays PASS — attacker sees the repositioning prompt
      ball: { position: targetHex, carrierId: null }, // ball in flight
      lastDiceRoll: { rolls: [d1], context: 'PASS_ACCURACY' },
      lastActionType: 'FIRST_TIME_PASS',
      actionCount: state.actionCount + passTimeCost,
      passTargetHex: targetHex, // preserved for path highlight
      firstTimePassPath: hexLine(carrier.position, targetHex), // new field
      firstTimePassStep: 'ATTACKER', // new field
      preGeneratedInterceptionDice: [],
      eventLog: newEventLog,
    },
  };
}
// Existing return for STANDARD_PASS / LONG_BALL follows (lines 1151–1164)
```

---

### `packages/server/src/gameHandlers.ts` — 2 new handlers + 2 handler extensions

**Analog:** `gameHandlers.ts` GAME_RESTART_MOVEMENT handler (lines 907–938) and GAME_UNDO handler (lines 875–905).

#### New handler pattern (BUG-02: `GAME_CANCEL_MOVEMENT`)

Copy GAME_RESTART_MOVEMENT (lines 907–938) exactly — same mutex, phase guard, isActivePlayer guard, broadcastState call:

```typescript
// Phase 17 BUG-02: cancel MOVEMENT before any piece has moved
socket.on(ClientEvents.GAME_CANCEL_MOVEMENT, () => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return;
  room.isProcessing = true;
  try {
    if (room.gameState === null || room.gameState.phase !== 'MOVEMENT') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    if (!isActivePlayer(socket, room)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
      broadcastState(io, room);
      return;
    }
    const result = applyCancelMovement(room.gameState);
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

#### Handler extension pattern (BUG-03: `GAME_UNDO` phase guard)

**Fix site:** `gameHandlers.ts` line 884 — the single-phase check:

```typescript
// BEFORE (line 884):
if (room.gameState === null || room.gameState.phase !== 'MOVEMENT') {

// AFTER (BUG-03 D-06):
const validUndoPhases: GamePhase[] = ['MOVEMENT', 'HIGH_PASS_MOVEMENT'];
if (room.gameState === null || !validUndoPhases.includes(room.gameState.phase)) {
```

#### MOVE-06: `FREE_MOVE` phase — reuse `GAME_MOVE` and `GAME_END_TURN`

Per RESEARCH.md Open Question 3: reuse `game:move` (existing `GAME_MOVE` handler) with a phase guard for `FREE_MOVE`, and reuse `game:end-turn` (`GAME_END_TURN`) to exit `FREE_MOVE`. Add a `FREE_MOVE` phase branch inside the existing `GAME_END_TURN` handler that calls a new `applyFreeMoveEnd(state)` function returning `{ phase: 'PASS', freeMoveEligibleIds: null, freeMoveUsedPace: null }`.

**Pattern for applyFreeMoveEnd** (follows same discriminated-union return style):

```typescript
export function applyFreeMoveEnd(state: GameState): { ok: true; state: GameState } {
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      freeMoveEligibleIds: null,
      freeMoveUsedPace: null,
    },
  };
}
```

#### PASS-02: `SNAP_DEFLECT` end-turn discriminant

**Fix site:** SNAP_DEFLECT end-turn handler (gameHandlers.ts ~line 680). Add discriminant check at the top of the SNAP_DEFLECT resolution block:

```typescript
// PASS-02 (Phase 17 D-18): SNAP_DEFLECT reused for First-time Pass defender move
if (room.gameState.lastActionType === 'FIRST_TIME_PASS') {
  // resolve against firstTimePassPath (pass path), not shot path
  const deflected =
    room.gameState.firstTimePassPath?.some((hex) =>
      room.gameState!.pieces.some(
        (p) =>
          p.teamId !== room.gameState!.attackingTeam &&
          p.position.q === hex.q &&
          p.position.r === hex.r,
      ),
    ) ?? false;
  // ... deliver ball or LOOSE_BALL at deflector ...
} else {
  // existing snapshot resolution unchanged
}
```

---

### `packages/client/src/components/ActionPanel.tsx` — 4 UI additions

**Analog:** ActionPanel MOVEMENT branch (lines 494–548) and HIGH_PASS_MOVEMENT branch (lines 108–125).

#### BUG-02: Cancel button in MOVEMENT phase

**Fix site:** MOVEMENT return block (lines 525–547). Add Cancel button below Undo/End Turn, visible only when `paceUsedByPieceId` is empty (Pitfall 5).

**Store additions needed:** `emitCancelMovement` action in `useGameStore`, `paceUsedByPieceId` already subscribed in ActionPanel.

**Pattern** (copy `← Back` button style from lines 482–484):

```tsx
// In MOVEMENT phase return block, after End Turn button:
{
  Object.keys(paceUsedByPieceId).length === 0 && (
    <button className={styles.backButton} onClick={emitCancelMovement}>
      ← Cancel
    </button>
  );
}
```

#### BUG-03: Undo button in HIGH_PASS_MOVEMENT phase

**Fix site:** HIGH_PASS_MOVEMENT branch (lines 108–125). Add an Undo button below End Turn, using the same `canUndo` logic already present in the MOVEMENT branch (lines 512–518). The `canUndo` computation from MOVEMENT branch can be extracted to a shared `const` above both phase branches.

**Pattern** (mirrors MOVEMENT canUndo at lines 512–518):

```tsx
// In HIGH_PASS_MOVEMENT branch, after End Turn button:
<button className={styles.ctaButton} disabled={!canUndo} onClick={emitUndo}>
  Undo
</button>
```

#### MOVE-06: FREE_MOVE phase branch

**Pattern** (follows HIGH_PASS_MOVEMENT and GK_KICK_MOVEMENT branch structure at lines 337–353):

```tsx
// Insert before the isActivePlayer guard (line 355)
if (phase === 'FREE_MOVE') {
  if (myTeam === null) return null;
  if (!isActivePlayer) return waitingPanel;
  return (
    <div className={styles.panel}>
      <div className={styles.helperBlock}>
        <span className={styles.helperLine1}>Free Move!</span>
        <span className={styles.helperLine2}>
          Move up to 6 hexes per player in the opponent&apos;s third.
        </span>
      </div>
      <button className={styles.ctaButton} onClick={emitEndTurn}>
        End Turn
      </button>
      {gameError && <span className={styles.errorText}>{gameError}</span>}
    </div>
  );
}
```

#### PASS-02: Attacker repositioning prompt in PASS phase

**Fix site:** Inside `phase === 'PASS'` branch (line 363+), detect `firstTimePassStep === 'ATTACKER'` and show repositioning panel before the normal 3-step flow.

**Store additions needed:** subscribe to `gameState.firstTimePassStep`.

**Pattern** (follows SNAP_DEFLECT branch style at lines 154–170):

```tsx
// At top of PASS phase block (after carrierId null check):
const firstTimePassStep = useGameStore((s) => s.gameState.firstTimePassStep);

if (phase === 'PASS' && firstTimePassStep === 'ATTACKER') {
  if (!isActivePlayer) return waitingPanel;
  return (
    <div className={styles.panel}>
      <span className={styles.phaseLabel}>
        Move 1 player up to 1 hex (not the passer), then End Turn.
      </span>
      <button className={styles.ctaButton} onClick={emitEndTurn}>
        End Turn
      </button>
      {gameError && <span className={styles.errorText}>{gameError}</span>}
    </div>
  );
}
```

---

### `packages/server/src/__tests__/gameEngine.phase17.test.ts` — new unit test file

**Analog:** `packages/server/src/__tests__/gameEngine.test.ts` (existing unit test file).

**Test file structure pattern** (read from existing test file — use same fixture helpers):

```typescript
import { describe, it, expect } from 'vitest';
import { applyXxx } from '../gameEngine.js';
import { buildGameState } from './helpers.js'; // or however existing fixtures work

describe('Phase 17 BUG-01', () => {
  it('skips interception loop when lastActionType is HEADER', () => {
    // arrange: state with lastActionType = 'HEADER', interceptors in ZoI
    // act: applyRoll(state, ...)
    // assert: result.state.ball.carrierId is the target-hex teammate, not the interceptor
  });
});
```

Run command: `pnpm --filter @counter-attack/server test --run gameEngine`

---

## Shared Patterns

### Socket Handler Mutex + Phase Guard + Active Player Guard

**Source:** `packages/server/src/gameHandlers.ts` lines 907–938 (GAME_RESTART_MOVEMENT)
**Apply to:** BUG-02 (`GAME_CANCEL_MOVEMENT` new handler)

```typescript
socket.on(ClientEvents.GAME_XXX, () => {
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

### Engine Function Discriminated Return Type

**Source:** `packages/server/src/gameEngine.ts` — every `apply*` function
**Apply to:** `applyCancelMovement` (BUG-02), `applyFreeMoveEnd` (MOVE-06)

```typescript
export type ApplyXxxResult =
  | { ok: false; reason: 'WRONG_PHASE' | 'SPECIFIC_REASON' }
  | { ok: true; state: GameState };

export function applyXxx(state: GameState): ApplyXxxResult {
  if (state.phase !== 'EXPECTED_PHASE') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  // ... logic ...
  return { ok: true, state: { ...state, phase: 'NEXT_PHASE', ... } };
}
```

### ActionPanel Phase Branch Structure

**Source:** `packages/client/src/components/ActionPanel.tsx` lines 108–125 (HIGH_PASS_MOVEMENT) and lines 337–353 (GK_KICK_MOVEMENT)
**Apply to:** MOVE-06 FREE_MOVE branch, PASS-02 attacker-step branch

```tsx
if (phase === 'SOME_PHASE') {
  if (myTeam === null) return null;
  if (!isActivePlayer) return waitingPanel;
  return (
    <div className={styles.panel}>
      <div className={styles.helperBlock}>
        <span className={styles.helperLine1}>...</span>
        <span className={styles.helperLine2}>...</span>
      </div>
      <button className={styles.ctaButton} onClick={emitEndTurn}>
        End Turn
      </button>
      {gameError && <span className={styles.errorText}>{gameError}</span>}
    </div>
  );
}
```

### Back/Cancel Button Style

**Source:** `packages/client/src/components/ActionPanel.tsx` lines 482–484 (`← Back` in PASS step 2)
**Apply to:** BUG-02 Cancel button in MOVEMENT phase

```tsx
<button className={styles.backButton} onClick={handler}>
  ← Cancel
</button>
```

### Optional GameState Fields Pattern

**Source:** `packages/shared/src/types.ts` lines 384–450
**Apply to:** All new `GameState` fields (`firstTimePassPath`, `firstTimePassStep`, `freeMoveEligibleIds`, `freeMoveUsedPace`)

- Use `?` optional with `| null` type
- Prefix with JSDoc comment citing the phase and decision that added the field
- Default to `null` outside the relevant phase; set in the entering `apply*` function; cleared in the exiting `apply*` function

---

## No Analog Found

None — all files being modified are well-established in the codebase with exact patterns to follow.

---

## Metadata

**Analog search scope:** `packages/server/src/`, `packages/shared/src/`, `packages/client/src/components/`
**Files scanned:** 7 source files (full reads), 2 targeted section reads
**Pattern extraction date:** 2026-06-14
