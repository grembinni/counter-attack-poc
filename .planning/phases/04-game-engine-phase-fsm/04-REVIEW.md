---
phase: 04-game-engine-phase-fsm
reviewed: 2026-05-30T03:35:25Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/server/src/createServer.ts
  - packages/shared/src/types.ts
  - packages/shared/src/events.ts
  - packages/shared/src/teams.ts
  - packages/shared/src/pitch.ts
  - packages/shared/src/index.ts
  - packages/server/src/__tests__/gameEngine.test.ts
  - packages/server/src/__tests__/game.integration.test.ts
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/__tests__/roomStore.test.ts
  - packages/shared/src/teams.test.ts
  - packages/shared/src/pitch.test.ts
  - packages/shared/src/moveValidator.test.ts
  - packages/shared/src/headingValidator.test.ts
  - packages/shared/src/passValidator.test.ts
  - packages/shared/src/shotValidator.test.ts
  - packages/shared/src/snapshotValidator.test.ts
  - packages/shared/src/hex.test.ts
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-30T03:35:25Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 4 delivered the core game engine FSM (buildInitialGameState, applyStartMovement, applyMove, applyEndTurn, applyUndo) and Socket.io handlers. The architecture is sound overall — immutable spread patterns are correctly applied, the isProcessing mutex is released in `finally` in all four handlers, and the server-authoritative from-coord invariant (T-4-03) is correctly implemented.

Four critical defects were found:

1. `applyMove` never populates `movedPieceIds`, so the ATTACKER_2 `ALREADY_MOVED_IN_ATTACKER4` guard (the only consumer of that field) is permanently dead — any piece can move in ATTACKER_2 even after moving in ATTACKER_4.
2. The GAME_UNDO handler permits undo in any phase, including PASS and SHOT, where the movement-slot machinery is absent and `applyUndo` operates on stale event-log state.
3. `applyUndo` never reverses the `pendingFreeMove` flag, meaning an undone ball-carrier crossing leaves a phantom free-move grant in state that cannot be retracted.
4. `isPitchHex` uses `Array.some()` linear scan rather than the O(1) Set lookup enforced everywhere else in `pitch.ts`, causing structural inconsistency and silently being 400× slower than all other boundary checks.

---

## Critical Issues

### CR-01: `applyMove` never appends to `movedPieceIds` — ATTACKER_2 double-move restriction is permanently disabled

**File:** `packages/server/src/gameEngine.ts:197-252`

**Issue:** The returned `state` spread at line 240 carries forward `state.movedPieceIds` unchanged. The field is only reset (to `[]`) in `applyEndTurn` (line 304). `validateMove` (moveValidator.ts:72) checks `state.movedPieceIds.includes(piece.id)` to enforce the ATTACKER*2 restriction that each piece may only act in ATTACKER_4 \_or* ATTACKER_2, not both. Because `applyMove` never adds `pieceId` to `movedPieceIds`, that array is always empty and the check never fires. Any piece can move freely in both ATTACKER_4 and ATTACKER_2, doubling its effective pace — a game-breaking rule violation.

**Fix:**

```typescript
// In applyMove, add movedPieceIds update to the returned state spread:
return {
  ok: true,
  state: {
    ...state,
    pieces: newPieces,
    paceUsedByPieceId: {
      ...state.paceUsedByPieceId,
      [pieceId]: (state.paceUsedByPieceId[pieceId] ?? 0) + 1,
    },
    movedPieceIds: state.movedPieceIds.includes(pieceId)
      ? state.movedPieceIds
      : [...state.movedPieceIds, pieceId],
    eventLog: newEventLog,
    pendingFreeMove,
  },
};
```

---

### CR-02: GAME_UNDO handler accepts undo in any game phase — engine operates on undefined slot state

**File:** `packages/server/src/gameHandlers.ts:198-225`

**Issue:** The GAME_MOVE and GAME_END_TURN handlers both assert `room.gameState.phase === 'MOVEMENT'` before delegating (lines 137, 172). The GAME_UNDO handler (line 206) only checks `room.gameState === null` — no phase guard. After the FSM transitions to PASS (or later SHOT, HEADER, etc.), a client can still emit `game:undo`. `applyUndo` calls `state.eventLog.reduce` looking for a `SLOT_ADVANCE` event. In PASS phase the log contains at least one `SLOT_ADVANCE` (from the ATTACKER_2→PASS transition), so `currentSlotEvents` will be the events after that final SLOT_ADVANCE. If any MOVE events exist from the PASS phase's future work, they would be silently reversed. More immediately, `isActivePlayer` calls `actingTeam(state)` which reads `state.movementSlot`; when `movementSlot` is `null` (PASS phase), `actingTeam` returns `state.attackingTeam` — meaning the attacking team can undo during PASS phase, which is incorrect. Both the phase-guard omission and the `actingTeam` fallback behaviour are defects.

**Fix:**

```typescript
socket.on(ClientEvents.GAME_UNDO, () => {
  // ...
  room.isProcessing = true;
  try {
    if (room.gameState === null || room.gameState.phase !== 'MOVEMENT') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    // ... rest of handler unchanged
  } finally {
    room.isProcessing = false;
  }
});
```

---

### CR-03: `applyUndo` does not restore `pendingFreeMove` — undone crossing leaves phantom free-move

**File:** `packages/server/src/gameEngine.ts:327-388`

**Issue:** `applyMove` sets `pendingFreeMove = { team, hexesAllowed: 6 }` when the ball carrier crosses between final thirds (lines 228-237). `applyUndo` reverses the piece position and removes the MOVE event from the log, but the returned state spread (line 380) carries forward `state.pendingFreeMove` unchanged. After undo, the position is restored to before-cross but `pendingFreeMove` still reflects the crossed state. Phase 5's free-move enforcement will then grant an unearned 6-hex move to a team whose carrier never actually completed the crossing.

The correct fix requires knowing whether the undone MOVE was the one that set `pendingFreeMove`. The MOVE event already records `from` and `to` — compare those coordinates against the region boundary to determine whether to null out `pendingFreeMove` on undo.

**Fix:**

```typescript
// In applyUndo, after computing newPieces and newPaceUsed, add:
import { isInRegion } from '@counter-attack/shared';

// Determine if the undone move was the one that set pendingFreeMove
let newPendingFreeMove = state.pendingFreeMove ?? null;
if (newPendingFreeMove !== null && state.ball.carrierId === moveToUndo.pieceId) {
  const fromInHomeThird = isInRegion(moveToUndo.from, 'homeThird');
  const fromInAwayThird = isInRegion(moveToUndo.from, 'awayThird');
  const toInHomeThird = isInRegion(moveToUndo.to, 'homeThird');
  const toInAwayThird = isInRegion(moveToUndo.to, 'awayThird');
  if ((fromInHomeThird && toInAwayThird) || (fromInAwayThird && toInHomeThird)) {
    newPendingFreeMove = null;
  }
}

return {
  ok: true,
  state: {
    ...state,
    pieces: newPieces,
    paceUsedByPieceId: newPaceUsed,
    eventLog: newEventLog,
    pendingFreeMove: newPendingFreeMove,
  },
};
```

---

### CR-04: `isPitchHex` uses O(n) linear scan instead of the O(1) Set lookup mandated by PITCH-02

**File:** `packages/shared/src/pitch.ts:112-114`

**Issue:** Every other boundary function in `pitch.ts` uses the pre-built `ReadonlySet<string>` with `Set.has()` for O(1) structural-equality checking (PITCH-02 comment at line 30). `isPitchHex` at line 113 uses `PITCH_HEXES.some((h) => h.q === hex.q && h.r === hex.r)` — a full 400-element array scan on every call. This is also structurally inconsistent with `isInRegion` and `isDifficultAngle`. More critically, the `hexKey` helper and `buildRegion` factory exist precisely to avoid this pattern; the omission means any future caller relying on `isPitchHex` for hot-path boundary checks (e.g., loose-ball bounce in Phase 6) will silently use the slow path.

**Fix:**

```typescript
// Add a Set alongside PITCH_HEXES:
const PITCH_HEX_SET: ReadonlySet<string> = buildRegion([...PITCH_HEXES]);

export function isPitchHex(hex: HexCoord): boolean {
  return PITCH_HEX_SET.has(hexKey(hex));
}
```

Note: `buildRegion` is already defined as a module-private function at line 32, so no new dependency is needed.

---

## Warnings

### WR-01: `actingTeam()` in gameHandlers.ts returns `attackingTeam` when `movementSlot` is null — incorrect fallback for non-MOVEMENT phases

**File:** `packages/server/src/gameHandlers.ts:55-60`

**Issue:** `actingTeam` is used by `isActivePlayer` which gates all four game handlers. When `movementSlot` is `null` (PASS phase and beyond), the function falls through the `DEFENDER_5` branch and returns `state.attackingTeam`. This is only harmless today because GAME_MOVE, GAME_END_TURN all have separate `phase !== 'MOVEMENT'` guards that fire before `isActivePlayer` is called. However GAME_UNDO does not have that guard (CR-02), and Phase 5/6 handlers may call `isActivePlayer` for non-movement phases where the active team is determined differently. The function's contract is silently wrong outside MOVEMENT phase.

**Fix:** Either restrict the function to MOVEMENT-phase contexts with an assertion, or document its precondition clearly:

```typescript
function actingTeam(state: GameState): 'home' | 'away' {
  // Precondition: must only be called when phase === 'MOVEMENT' and movementSlot !== null
  if (state.movementSlot === null) {
    throw new Error(`actingTeam called with null movementSlot (phase=${state.phase})`);
  }
  if (state.movementSlot === 'DEFENDER_5') {
    return state.attackingTeam === 'home' ? 'away' : 'home';
  }
  return state.attackingTeam;
}
```

---

### WR-02: `applyUndo` has no guard for `movementSlot === null` — operates outside its valid state space

**File:** `packages/server/src/gameEngine.ts:327-355`

**Issue:** `applyUndo` begins directly by scanning `eventLog` for `SLOT_ADVANCE` events with no precondition check on `state.phase` or `state.movementSlot`. It is a pure function and the handler is supposed to guard phase (see CR-02), but as a defensive layer `applyUndo` itself should reject states where undo is nonsensical. The `applyMove` and `applyEndTurn` functions both check `state.phase !== 'MOVEMENT' || state.movementSlot === null` as their first guard. `applyUndo` provides no equivalent, creating an asymmetry across the engine API.

**Fix:**

```typescript
export function applyUndo(state: GameState): ApplyUndoResult {
  if (state.phase !== 'MOVEMENT' || state.movementSlot === null) {
    return { ok: false, reason: 'UNDO_LOCKED' };
  }
  // ... rest unchanged
}
```

---

### WR-03: `buildInitialGameState` sets `activeTeam = attackingTeam` but `activeTeam` remains unset after the KICK_OFF phase when `movementSlot === null`

**File:** `packages/server/src/gameEngine.ts:67-87`

**Issue:** `applyEndTurn` (line 287-294) computes `nextActiveTeam` but when `nextSlot === null` (ATTACKER_2 → PASS transition) it falls back to `state.activeTeam` with the comment "keep current activeTeam until handler sets it." No handler ever sets `activeTeam` after the PASS transition. Phase 5's PASS handler will inherit whatever team happened to be `activeTeam` last in the MOVEMENT phase (the attacking team, since ATTACKER_2 is always theirs). This is likely the intended value, but it is an implicit convention — not enforced or documented. If a Phase 5 handler assumes `activeTeam` is correct for PASS without re-deriving it, incorrect team-guarding will result. The reliance on passive inheritance is fragile.

**Fix:** Explicitly set `activeTeam` on the PASS transition rather than leaving it implicit:

```typescript
const nextActiveTeam: 'home' | 'away' =
  nextSlot === null
    ? state.attackingTeam // PASS phase: attacking team chooses who to pass to
    : nextSlot === 'DEFENDER_5'
      ? state.attackingTeam === 'home'
        ? 'away'
        : 'home'
      : state.attackingTeam;
```

---

### WR-04: SC-5 mutex test relies on a 500ms `setTimeout` wall-clock race — flaky under load

**File:** `packages/server/src/__tests__/game.integration.test.ts:299-328`

**Issue:** The SC-5 duplicate-action test (line 299) emits two `game:end-turn` events back-to-back, then waits 500ms (`setTimeout(resolve, 500)`) and asserts only one slot advance occurred. This is a time-based assertion: if the test machine is under CPU load and both events arrive at the server before `isProcessing` is released from the first handler, the mutex correctly drops the second. But if the two events arrive in separate event-loop ticks after the first mutex is released, _both_ slot advances will succeed, making `uniqueSlots.size` equal to 2 (DEFENDER_5 and ATTACKER_2) and `hasAttacker2` become `true`, causing a test failure. The test structure does not guarantee the two emits arrive concurrently at the server — network I/O can reorder them.

**Fix:** Use `Promise.all` with two `oncePromise` calls to listen for exactly two state events, and assert only one unique slot transition occurred. Alternatively, use `socket.emitWithAck` and verify the second returns a `WRONG_PHASE` error, which would be deterministic.

---

### WR-05: `ROOM_JOINED` notification to existing player leaks the `slot` value as `2` even though the event signature promises `playerSlot: 1 | 2`

**File:** `packages/server/src/roomHandlers.ts:143`

**Issue:** When slot 2 joins, `socket.to(normalizedCode).emit(ServerEvents.ROOM_JOINED, normalizedCode, 2, '')` notifies the existing player (slot 1). The `2` here is the new _joiner's_ slot, not the existing player's slot. The client receiving this event — who is slot 1 — will interpret `playerSlot === 2` and may incorrectly believe its own slot has changed. The `ServerToClientEvents` interface declares this as `(roomCode: string, playerSlot: 1 | 2, sessionToken: string)`. No existing client code is shown in scope, but the semantic is clearly wrong: the notification should communicate which slot _joined_ without using the same field that the joining client uses to learn _its own_ slot assignment.

**Fix:** Either use a separate event type for the "partner joined" notification, or document in `ServerToClientEvents` that the `playerSlot` field of `ROOM_JOINED` means "the slot that was filled" when `sessionToken` is empty.

---

## Info

### IN-01: `TODO Phase 5: replace with crypto.randomInt(1, 7)` stub dice comment inconsistency

**File:** `packages/server/src/gameEngine.ts:33-36`

**Issue:** The comment on `stubDice()` at line 33 says `// TODO Phase 5: replace with crypto.randomInt(1, 7)`. The file header at line 15 already imports `randomInt` from `'crypto'` for use in `buildInitialGameState`. Phase 5 only needs to wire `randomInt(1, 7)` into `stubDice`, but a developer reading line 33 without checking line 15 might add a redundant import. The redundant import warning here is minor, but the `stubDice` function's existence as a permanent module-level export (not marked `@internal`) is also a code smell — it makes the stub surface area visible to all callers.

**Fix:** Mark `stubDice` with `@internal` JSDoc or replace the comment with `// Phase 5: replace with `randomInt(1, 7)`from the already-imported`crypto` module`.

---

### IN-02: `actionCount` field in `GameState` is initialised to `0` but never incremented by any engine function

**File:** `packages/server/src/gameEngine.ts:78` / `packages/shared/src/types.ts:87`

**Issue:** `GameState.actionCount` is declared in `types.ts` (line 88) and initialised to `0` in `buildInitialGameState` (line 78). None of `applyMove`, `applyEndTurn`, `applyStartMovement`, or `applyUndo` increment or update it. Its purpose is not documented in `types.ts`. If it is intended as a monotonic action counter for client-side optimistic UI validation, it must be incremented on every successful action. If it is not yet wired, it should carry a TODO comment explaining its intended Phase.

**Fix:** Add a JSDoc comment to `actionCount` in `types.ts` explaining its purpose and which phase wires it, or increment it in `applyMove` and `applyEndTurn` like:

```typescript
actionCount: state.actionCount + 1,
```

---

### IN-03: `isPitchHex` test coverage gap — `pitch.test.ts` has no negative test for negative coordinates

**File:** `packages/shared/src/pitch.test.ts:78-90`

**Issue:** The `isPitchHex` out-of-grid tests check `{ q: 99, r: 99 }`, `{ q: 25, r: 0 }`, and `{ q: 0, r: 16 }` — all out-of-bound in the positive direction. The grid is defined for `q ∈ [0,24]` and `r ∈ [0,15]`, so negative coordinates `{ q: -1, r: 0 }` and `{ q: 0, r: -1 }` are also out-of-grid. The current `Array.some` implementation (see CR-04) would correctly reject these, but if CR-04 is fixed to use a Set, the set only contains non-negative entries and negative-coord behaviour should be explicitly tested.

**Fix:** Add tests:

```typescript
it('returns false for negative-coordinate hexes', () => {
  expect(isPitchHex({ q: -1, r: 0 })).toBe(false);
  expect(isPitchHex({ q: 0, r: -1 })).toBe(false);
});
```

---

_Reviewed: 2026-05-30T03:35:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
