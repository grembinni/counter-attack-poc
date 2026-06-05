---
phase: 08-match-lifecycle-post-game-replay
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - packages/client/src/App.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/FullTimeScreen.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/HalfTimeScreen.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/KickOffSetupPanel.tsx
  - packages/client/src/components/ReplayPanel.tsx
  - packages/client/src/components/TurnIndicator.tsx
  - packages/client/src/mock/mockMovementState.ts
  - packages/client/src/store/useGameStore.ts
  - packages/client/vite.config.ts
  - packages/server/src/__tests__/game.integration.test.ts
  - packages/server/src/__tests__/gameEngine.phase8.test.ts
  - packages/server/src/__tests__/gameEngine.test.ts
  - packages/server/src/__tests__/kickoffSetup.integration.test.ts
  - packages/server/src/__tests__/replay.integration.test.ts
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/__tests__/roomStore.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/roomHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/shared/src/actionSequence.ts
  - packages/shared/src/events.ts
  - packages/shared/src/index.ts
  - packages/shared/src/types.ts
findings:
  critical: 4
  warning: 5
  info: 2
  total: 11
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 8 adds match lifecycle (half-time, full-time, replay streaming), kick-off setup repositioning, and the snapshot/header shot mechanics. The shared types, client routing, and server room/replay infrastructure are well-structured. However the review found four critical defects: two socket event handlers are entirely missing, the GK spill path reuses biased shot dice for loose-ball direction/distance, and the client store fails to clear stale selection state on server-pushed updates. Five warnings cover eventLog gaps that make the replay incomplete, a reference-capture hazard in the replay timer, stale local UI state after kick-off resets, a React key anti-pattern, and a missing phase-narrowing guard in the SHOT handler.

---

## Critical Issues

### CR-01: `GAME_SNAPSHOT` handler is not registered — snapshot shots are silently dropped

**File:** `packages/server/src/gameHandlers.ts`
**Lines:** entire `registerGameHandlers` function (no `socket.on(ClientEvents.GAME_SNAPSHOT, ...)` present)

**Issue:** `ClientEvents.GAME_SNAPSHOT` is defined in the shared events contract and the client emits it via `emitSnapshot` when `phase === 'SNAPSHOT'`. The server-side engine function `applySnapshot` is implemented and tested. However `registerGameHandlers` never registers a listener for `GAME_SNAPSHOT`. The event is silently ignored: no state transition occurs, no `GAME_ERROR` is sent back, and the phase never advances. Snapshot shots are completely non-functional over the wire.

There is a secondary confusion: the engine's `applySnapshot` transitions the game to `phase: 'SHOT'`, not `phase: 'SNAPSHOT'`. The `SNAPSHOT` GamePhase value therefore never appears in a live game — the `ActionPanel` button guarded by `phase === 'SNAPSHOT'` is unreachable, so the client also has no working path to emit the event. Both ends of the flow are broken.

**Fix:** Register the handler in `registerGameHandlers`. The engine function already exists:

```typescript
socket.on(ClientEvents.GAME_SNAPSHOT, () => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return;

  room.isProcessing = true;
  try {
    if (room.gameState === null) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    if (!isActivePlayer(socket, room)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
      broadcastState(io, room);
      return;
    }
    const result = applySnapshot(room.gameState);
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

The `ActionPanel` snapshot button should be guarded by the conditions that allow a snapshot (ball carrier in penalty area during MOVEMENT, or immediately post-pass during PASS phase), not by `phase === 'SNAPSHOT'`, since that phase is never reached.

---

### CR-02: `GAME_HEADER` handler is not registered — header rolls are silently dropped

**File:** `packages/server/src/gameHandlers.ts`
**Lines:** entire `registerGameHandlers` function (no `socket.on(ClientEvents.GAME_HEADER, ...)` present)

**Issue:** `ClientEvents.GAME_HEADER` is defined and the client emits it via `emitHeader`. The server's `DICE_PHASES` set already includes `'HEADER'`, so when the phase transitions to HEADER after a HIGH_PASS, the game:roll handler correctly resolves the heading duel. However, the `GAME_HEADER` event the client emits via the "Header" button (see `ActionPanel.tsx:101-103`) is never received by the server. The client shows a "Header" button distinct from "Roll Dice", but no handler exists to process it — clicks are silently dropped. Whether this is an intentional design difference (header is triggered by the Roll button, not a separate event) or a missed handler is unclear, but the `GAME_HEADER` event in the events contract implies a handler should exist or the event should be removed.

**Fix:** Either register a handler that calls `applyRoll` for the HEADER phase (symmetric with how SHOT/PASS/LOOSE_BALL are resolved via game:roll), or remove `GAME_HEADER` from the events contract and have the client use `emitRoll` for HEADER resolutions. Given the current `DICE_PHASES` set already includes HEADER and `applyRoll` handles it, the simplest fix is:

```typescript
// Remove the separate HEADER button in ActionPanel; the existing Roll Dice
// button already covers the HEADER phase via DICE_PHASES.has(phase).
// Remove GAME_HEADER from ClientEvents and ClientToServerEvents.
// Remove emitHeader from the store.
```

Or if a separate event is desired, wire it through the same `applyRoll` path.

---

### CR-03: GK spill (save + dropped ball) reuses biased shot dice for loose-ball direction/distance

**File:** `packages/server/src/gameEngine.ts:710-713`

**Issue:** In the SHOT branch of `applyRoll`, when the GK saves but drops the ball (handling check fails), the code calls:

```typescript
const landing = computeLooseBall(
  gk.position,
  d1 as 1 | 2 | 3 | 4 | 5 | 6,
  d2 as 1 | 2 | 3 | 4 | 5 | 6,
);
```

Here `d1` is the shooter's dice and `d2` is the GK's dice — the same values already used for the shot duel resolution. `computeLooseBall` expects independent direction and distance dice. Reusing the duel dice produces a deterministic, non-uniform loose-ball landing position (e.g., a shooter who always rolls 6 and a GK who always rolls 3 will always land at the same hex after a spill). This is both a logic error and an unfair game mechanic. All other loose-ball paths (inaccurate pass, heading tie) correctly defer to a fresh roll.

The `applyRoll` signature accepts variadic `...dice` and destructures `[d1, d2, d3]` at the top of the function. Three dice are pre-generated by the caller for the SHOT duel (shooterDice=d1, gkDice=d2, handlingDice=d3). There are no additional dice available for the spill path.

**Fix:** The caller in `gameHandlers.ts` should pre-generate a fourth and fifth die when in SHOT phase, or the spill path should transition to `LOOSE_BALL` phase (as the PASS inaccurate path does) and defer landing to the next roll rather than computing it inline:

```typescript
// Preferred: transition to LOOSE_BALL phase; let a fresh roll compute landing
// (consistent with how inaccurate pass and heading tie are handled)
if (!handling.caught) {
  return {
    ok: true,
    state: {
      ...state,
      phase: 'LOOSE_BALL',
      ball: { position: gk.position, carrierId: null },
      lastDiceRoll: { rolls: [shooterDice, gkDice, handlingDice], context: 'SHOT_DUEL' },
      snapshotPenalty: false,
    },
  };
}
```

---

### CR-04: `setGameState` does not clear `selectedPieceId` / `validMoveHexes` — stale highlights persist

**File:** `packages/client/src/store/useGameStore.ts:161`

**Issue:** The store's `setGameState` action replaces `gameState` only:

```typescript
setGameState: (state) => set({ gameState: state }),
```

When the server broadcasts a new state (e.g., after a slot advance, phase change, or goal), the client's `selectedPieceId` and `validMoveHexes` are **not cleared**. The stale selection persists: the previously-selected piece ring remains on the board, and ghost valid-move highlights remain visible even when the phase has changed away from MOVEMENT or the piece no longer belongs to the active team. This is observable after every end-turn, goal, or half-time transition. It also means a KICK_OFF_SETUP repositioning move leaves the moved piece still appearing "selected" in the HexGrid until the user explicitly clicks elsewhere.

**Fix:**

```typescript
setGameState: (state) => set({
  gameState: state,
  selectedPieceId: null,
  validMoveHexes: [],
}),
```

---

## Warnings

### WR-01: `HALF_TIME` and `FULL_TIME` ActionEvents are never appended to `eventLog` — replay frames for these events are impossible

**File:** `packages/server/src/gameEngine.ts:358-374`

**Issue:** The `ActionEventType` union and `ActionEvent` union both define `HALF_TIME` and `FULL_TIME` event subtypes. `buildReplayFrames` includes them in `REPLAY_ELIGIBLE_TYPES`. However `applyEndTurn` — the only function that transitions to `HALF_TIME` or `FULL_TIME` — only appends the `slotAdvanceEvent` to the log when reaching either end-of-half phase. No `HALF_TIME` or `FULL_TIME` ActionEvent is ever created or pushed. The corresponding `ActionLog.tsx` `formatEvent` cases for these types are therefore dead code, and the replay will silently skip the half-time and full-time moments (no frame is emitted for them). Additionally, `buildReplayFrames` does not handle the half-boundary reset (piece positions, score carry-over to second half) because neither event is ever in the log to trigger that logic.

**Fix:** Append the appropriate event at the end-of-half branch in `applyEndTurn`:

```typescript
const endEvent: ActionEvent =
  endPhase === 'HALF_TIME'
    ? { type: 'HALF_TIME', half: 1, score: state.score, timestamp: Date.now() }
    : { type: 'FULL_TIME', score: state.score, timestamp: Date.now() };

return {
  ok: true,
  state: {
    ...state,
    phase: endPhase,
    eventLog: [...state.eventLog, slotAdvanceEvent, endEvent],
    // ... other fields
  },
};
```

---

### WR-02: `startReplayStream` captures `room` by reference; the 3-second delay creates a use-after-delete window

**File:** `packages/server/src/gameHandlers.ts:136-161`

**Issue:** `startReplayStream` receives `room` by reference and captures it in a `setTimeout` closure that fires 3 seconds later. The comment acknowledges this: "If the room is deleted during the 3s hold, the interval will never start (room won't exist)." However this reasoning is incomplete. `room` is a direct object reference from the Map — if `deleteRoom` is called during the 3-second window (e.g., one player disconnects), the Map entry is removed but the `room` reference in the closure is still live. The `setTimeout` callback then calls `buildReplayFrames(room.gameState)` and sets `room.replayTimer = setInterval(...)` on the deleted room object. `io.to(room.roomCode).emit(...)` then emits to a Socket.io room that has had no members since disconnection.

While no crash results (the emit to an empty Socket.io room is a no-op), `room.replayTimer` is set on an object no longer in the store, so `deleteRoom`'s `clearInterval` call will never find it. The interval will run until completion or process exit, emitting events to a dead room on every tick.

**Fix:** Check whether the room still exists in the store at the start of the `setTimeout` callback:

```typescript
setTimeout(() => {
  // Re-fetch the room — it may have been deleted during the 3s hold
  const liveRoom = getRoom(room.roomCode);
  if (!liveRoom || liveRoom.gameState === null) return;

  let idx = 0;
  liveRoom.replayTimer = setInterval(() => {
    if (idx >= frames.length) {
      clearInterval(liveRoom.replayTimer!);
      liveRoom.replayTimer = null;
      return;
    }
    // ... emit frame
  }, 1000);
}, 3000);
```

---

### WR-03: `KickOffSetupPanel` `localReady` state is not reset between kick-offs — second kick-off shows "Waiting for opponent…" immediately

**File:** `packages/client/src/components/KickOffSetupPanel.tsx:22`

**Issue:** `localReady` is `useState(false)` scoped to the component's lifecycle. The component is unmounted when `phase` leaves `KICK_OFF_SETUP` and remounted when it returns (e.g., after a goal triggers a new kick-off setup). Because `useState` initialises fresh on mount, this is not a bug for the goal→new-setup path. However, if the same component instance is **not** unmounted between setups (e.g., a rapid state update during reconnect that briefly stays in `KICK_OFF_SETUP`), or if the component is conditionally rendered without unmounting, the stale `localReady = true` state would persist. More concretely: in `GameBoard.tsx`, the panel is swapped by phase but React may reuse the component instance when the parent does not remount. Consider using a key prop tied to `half` or a `kickOffCount` to force fresh mount:

```tsx
<KickOffSetupPanel key={`kickoff-${state.half}-${state.actionCount}`} />
```

Also note: there is currently no `phase === 'KICK_OFF_SETUP'` guard in `GameBoard`'s rendering path that would guarantee an unmount between the first and second kick-off setup phases, because `App.tsx` routes `KICK_OFF_SETUP` to `<GameBoard />` rather than a dedicated screen.

**Fix:** Add a `key` prop to `KickOffSetupPanel` that changes on each new kick-off setup:

```tsx
{phase === 'KICK_OFF_SETUP' ? (
  <KickOffSetupPanel key={`${gameState.half}-${gameState.kickOffTeam}`} />
```

---

### WR-04: `ActionLog` uses array index as React `key` — incorrect reconciliation when events are reversed

**File:** `packages/client/src/components/ActionLog.tsx:118`

**Issue:**

```tsx
recentEvents.map((event, index) => {
  // ...
  return (
    <div className={styles.entry} key={index}>
```

`recentEvents` is `[...eventLog].reverse().slice(0, 10)`. Using `index` as `key` means that as new events arrive (shifting earlier events down in the reversed list), React incorrectly reuses DOM nodes — event entries appear to "slide" rather than the newest entry appearing at the top. For the goal-highlight style (`isGoal`), this causes the wrong entry to flash the gold colour when a new event arrives after a goal.

**Fix:** Use a stable key. `ActionEvent` objects carry a `timestamp` field; combined with the event type and a counter, this makes a suitable key:

```tsx
recentEvents.map((event, index) => {
  // ...
  return (
    <div
      className={styles.entry}
      key={`${event.type}-${event.timestamp}-${index}`}
    >
```

---

### WR-05: SHOT sequence guard in `GAME_ROLL` handler only checks `lastActionType` when non-null — a `null` lastActionType bypasses the guard entirely

**File:** `packages/server/src/gameHandlers.ts:374-379`

**Issue:**

```typescript
if (room.gameState.phase === 'SHOT' && room.gameState.lastActionType !== null) {
  if (!ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('SHOT')) {
    socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
    ...
  }
}
```

The guard is skipped when `lastActionType === null`. After a GOAL resets `lastActionType` to `null`, the phase transitions to `KICK_OFF_SETUP` (not SHOT), so this specific null case cannot arise post-goal. However, at the very start of a match (`lastActionType === null`, `phase === 'KICK_OFF_SETUP'` or `KICK_OFF`), an adversarial client could manipulate state to reach SHOT with a null `lastActionType`, bypassing the sequence check. More practically: `applySnapshot` sets `lastActionType: 'SNAPSHOT'` before transitioning to SHOT, so a legitimate snapshot shot always has `lastActionType !== null`. But the guard logic is asymmetric with the PASS and HEADER guards (which also only fire when `lastActionType !== null`), creating a pattern where a null `lastActionType` is an implicit "allow-all" rather than an explicit policy decision.

**Fix:** Be explicit about the null case to express design intent:

```typescript
// SHOT is only reachable via MOVEMENT_PHASE → direct shot, or SNAPSHOT → shot.
// null lastActionType should not allow SHOT.
if (room.gameState.phase === 'SHOT') {
  if (
    room.gameState.lastActionType === null ||
    !ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('SHOT')
  ) {
    socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
    broadcastState(io, room);
    return;
  }
}
```

---

## Info

### IN-01: `mockMovementState.ts` is used as the production initial store value — development fixture data ships to users

**File:** `packages/client/src/store/useGameStore.ts:99`

**Issue:**

```typescript
gameState: mockMovementState,
```

The store initialises with `mockMovementState` (a hard-coded MOVEMENT-phase fixture with `roomCode: 'MOCK1'`, real-looking player positions, and `phase: 'MOVEMENT'`). A player who opens the client before a game starts sees the mock board state rather than a clean empty state or a loading indicator. While the server's `GAME_STATE` broadcast quickly overwrites this, the mock data is visible momentarily and its `roomCode: 'MOCK1'` could cause confusing error messages if a handler fires before the real state arrives.

**Fix:** Replace `mockMovementState` with a minimal blank initial state:

```typescript
gameState: {
  roomCode: '',
  phase: 'LOBBY',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [],
  ball: { position: { q: 18, r: 13 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 0 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: null,
  pendingFreeMove: null,
  addedTime: null,
  lastActionType: null,
  kickOffTeam: 'home',
  kickOffActive: false,
},
```

The mock file should be retained for Storybook/dev tooling only.

---

### IN-02: `HALF_TIME` and `FULL_TIME` ActionEvent `formatEvent` cases in `ActionLog.tsx` are dead code

**File:** `packages/client/src/components/ActionLog.tsx:85-97`

**Issue:** As documented in WR-01, `applyEndTurn` never appends `HALF_TIME` or `FULL_TIME` events to `eventLog`. The `formatEvent` switch cases for these types therefore never execute. TypeScript's exhaustive switch check passes because the types exist in the union, but the cases cannot be reached at runtime.

This is a direct consequence of WR-01: fixing WR-01 will make this dead code live.

**Fix:** Fix WR-01 (append the events in `applyEndTurn`). No change required in `ActionLog.tsx` itself.

---

_Reviewed: 2026-06-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
