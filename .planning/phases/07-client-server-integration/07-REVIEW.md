---
phase: 07-client-server-integration
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - packages/client/src/App.tsx
  - packages/client/src/components/ActionPanel.module.css
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/ConnectionStatus.module.css
  - packages/client/src/components/ConnectionStatus.tsx
  - packages/client/src/components/DisconnectBanner.module.css
  - packages/client/src/components/DisconnectBanner.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/HexCell.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/LobbyScreen.module.css
  - packages/client/src/components/LobbyScreen.tsx
  - packages/client/src/socket.ts
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/client/vite.config.ts
  - packages/server/src/__tests__/game.integration.test.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/shared/src/events.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-05-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 7 wires the client UI to the server over Socket.io. The server-side mutex, authorization guards, and ARCH-04 broadcast discipline are all sound. The integration test suite is thorough and the shared event types are correctly consumed on both sides.

Two blockers were found. The most serious is a screen-routing bug in `App.tsx`: the joining player (slot 2) is never advanced past the `JOIN_ROOM` screen after `room:joined` is received, leaving them permanently stuck in the lobby UI while the game starts for the other player. The second is a `socketTeam` fallback defect in `gameHandlers.ts` that silently grants any unauthenticated socket the `away` identity, creating a potential authorization bypass.

Four warnings cover: a dead hover interaction on `HexCell`'s highlight overlay; an unguarded `GAME_SHOT` emit in `HexGrid` that bypasses the store and fires even when the player is not the active shooter; a `maxLength` mismatch on the join-room input; and a flawed SC-5 mutex test that cannot detect the race it claims to prevent.

---

## Critical Issues

### CR-01: Joining player stuck on JOIN_ROOM screen — game never starts for slot 2

**File:** `packages/client/src/App.tsx:35-36`

**Issue:** `onRoomJoined` only transitions to `'WAITING'` when `currentScreen === 'CREATE_ROOM'`. The player who joins via the `JOIN_ROOM` screen has `currentScreen === 'JOIN_ROOM'` at the moment `room:joined` arrives. The condition is false, so `setScreen` is never called. That player's UI remains on the `JOIN_ROOM` screen. When the game starts and `game:state` arrives, `onGameState` at line 26 only advances to `'GAME_BOARD'` from `'WAITING'` — so the joining player also misses that transition and is permanently stuck in the lobby.

```ts
// current (broken): only handles the room creator
if (currentScreen === 'CREATE_ROOM') setScreen('WAITING');

// fix: handle both the creator (→ WAITING) and the joiner (→ GAME_BOARD directly)
if (currentScreen === 'CREATE_ROOM') {
  setScreen('WAITING');
} else if (currentScreen === 'JOIN_ROOM') {
  // Slot 2 joins a room that is immediately 'playing'; go straight to GAME_BOARD
  // (game:state will follow immediately from the server after joinRoom sets status to 'playing')
  setScreen('GAME_BOARD');
}
```

---

### CR-02: `socketTeam` defaults unauthenticated sockets to `'away'` — authorization bypass

**File:** `packages/server/src/gameHandlers.ts:61-63`

**Issue:** `socketTeam` returns `'away'` whenever `socket.data.playerSlot` is not exactly `1`. This includes `undefined` (sockets that connected but never completed room join, or whose session middleware did not populate `playerSlot`). If a third party connects, guesses a room code, and emits `game:roll` or `game:move` when `away` is the active team, `isActivePlayer` will return `true` and the action will be processed as if it came from the legitimate away player.

`roomCode` is the first guard — an unauthenticated socket will not have `socket.data.roomCode` set, so it returns at line 127. However, for a reconnected socket whose session token matched a room but whose `playerSlot` was not re-assigned (session middleware path), this fallback is reached with a valid `roomCode` but wrong `playerSlot`. The defense-in-depth fix is to make `socketTeam` return `null` for `undefined` and short-circuit all guards.

```ts
// current
function socketTeam(socket: AppSocket): 'home' | 'away' {
  return socket.data.playerSlot === 1 ? 'home' : 'away';
}

// fix: explicit null for unassigned sockets
function socketTeam(socket: AppSocket): 'home' | 'away' | null {
  if (socket.data.playerSlot === 1) return 'home';
  if (socket.data.playerSlot === 2) return 'away';
  return null;
}

// and in isActivePlayer / controlsAttackingTeam / controlsGKTeam:
function isActivePlayer(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null) return false;
  const team = socketTeam(socket);
  if (team === null) return false;
  return team === actingTeam(room.gameState);
}
```

---

## Warnings

### WR-01: `pointerEvents="none"` makes hover handlers on the highlight polygon dead code

**File:** `packages/client/src/components/HexCell.tsx:47-57`

**Issue:** The highlight overlay `<polygon>` has `pointerEvents="none"` to let clicks pass through to the base polygon below it. However, `onMouseEnter` and `onMouseLeave` are also attached to this same element. SVG `pointerEvents="none"` prevents all pointer events including mouse-enter/leave, so `setHovered(true/false)` is never called. The `hovered` state is permanently `false`, the `fillOpacity` is always `0.55`, and `strokeWidth` is always `1.5`. The hover visual effect is silently broken.

```tsx
// fix: attach hover handlers to the base polygon instead, where pointerEvents are active
<polygon
  points={points}
  fill={baseFill}
  stroke="#2d5227"
  strokeWidth={0.5}
  onClick={isHighlighted ? onClick : undefined}
  style={{ cursor: isHighlighted ? 'pointer' : 'default' }}
  aria-hidden="true"
  onMouseEnter={isHighlighted ? () => setHovered(true) : undefined}
  onMouseLeave={isHighlighted ? () => setHovered(false) : undefined}
/>;
{
  isHighlighted && (
    <polygon
      points={points}
      fill={highlightColor ?? '#f5c518'}
      fillOpacity={hovered ? 0.75 : 0.55}
      stroke={highlightColor ? '#cc2222' : '#d4a017'}
      strokeWidth={hovered ? 2 : 1.5}
      pointerEvents="none"
      style={{ cursor: 'pointer' }}
    />
  );
}
```

---

### WR-02: `game:shot` emitted directly from `HexGrid` bypasses active-player guard

**File:** `packages/client/src/components/HexGrid.tsx:83-88`

**Issue:** The `isGoalHex` click handler emits `ClientEvents.GAME_SHOT` via a raw `socket.emit` call imported directly from `socket.ts`, not through the Zustand store. This bypasses the `isActivePlayer` client-side guard entirely. Any player on the `SHOT`-phase board can click a goal hex and send a `game:shot` — the server will reject it with `WRONG_TEAM`, but this causes an unnecessary round-trip error and a visible flash of the shot-target highlight for the non-shooter.

Additionally, `emitShot` is not defined in the Zustand store (`GameStore` type), which means the `game:shot` emit path has no unit tests in `useGameStore.test.ts`. All other game actions are funneled through the store.

```tsx
// fix: add emitShot to GameStore and gate it in HexGrid behind an isActivePlayer check
// In useGameStore.ts:
emitShot: (targetHex: HexCoord) => {
  socket.emit(ClientEvents.GAME_SHOT, targetHex);
},

// In HexGrid.tsx — only create the click handler when the local player is active:
const playerSlot = useGameStore((s) => s.playerSlot);
const myTeam: 'home' | 'away' | null =
  playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
const isActiveShooter = myTeam !== null && myTeam === activeTeam && phase === 'SHOT';

// ...
} else if (isGoalHex && isActiveShooter) {
  onClick = () => {
    setShotTargetHighlight(hex);
    emitShot(hex);  // through the store
  };
}
```

---

### WR-03: `maxLength={6}` allows 6-character input; room codes are 5 characters

**File:** `packages/client/src/components/LobbyScreen.tsx:81`

**Issue:** `customAlphabet('...', 5)` in `roomStore.ts` generates exactly 5-character room codes. The `<input maxLength={6}>` allows the user to type a 6-character code without client-side feedback. The server will reject the extra-length code with `NOT_FOUND` (the Map will miss on a 6-char key), but the user gets no indication their input format is wrong. Should be `maxLength={5}`.

```tsx
// fix
<input maxLength={5} ... />
```

---

### WR-04: SC-5 mutex test cannot detect the race condition it claims to verify

**File:** `packages/server/src/__tests__/game.integration.test.ts:299-328`

**Issue:** The SC-5 test emits two `GAME_END_TURN` events back-to-back from the same client and then asserts only one slot advance occurred. The assertion `uniqueSlots.size === 1` passes not because `isProcessing` blocked the second event, but because Node.js is single-threaded: by the time the second Socket.io event is dequeued from the event loop and its handler runs, the first handler has already completed and released `isProcessing = false`. The `isProcessing` flag is released in `finally` synchronously before the event loop can process the next message. The mutex provides real protection only for handlers containing `await` (async I/O gaps); none of the current game handlers are async.

The test passes for the wrong reason and would not catch a regression where `isProcessing` is accidentally omitted. A correct SC-5 test would require either (a) injecting a slow async operation into the handler, or (b) verifying the mutex directly through the room store after each handler invocation.

**Fix:** Replace the timing-dependent wait-and-count approach with a direct assertion on `room.isProcessing` mid-handler, or document that the mutex is a future-proofing mechanism for when async I/O is introduced and remove the flawed test claim.

---

## Info

### IN-01: `gameError` cleared on every `game:state` broadcast — transient errors may be invisible

**File:** `packages/client/src/App.tsx:24-28`

**Issue:** `onGameState` unconditionally calls `setDisconnectWarning(false)`. It also implicitly relies on the next `game:state` to clear `gameError` (see the comment in `ActionPanel.tsx` line 115). However, there is no explicit `setGameError(null)` call in `onGameState`. Because the server emits a `game:error` and then also emits a `broadcastState` snap-back for most handlers, the error message will be overwritten as soon as the snap-back arrives and `setGameError` would need to be called before the next render. Depending on React's render batching, users may never see the error message. This is not a data-loss bug but the error display may be unreliable.

**Fix:** Call `setGameError(null)` explicitly in `onGameState` after updating game state, and verify error display duration in a browser test.

---

### IN-02: `CopyButton` does not guard `navigator.clipboard` availability

**File:** `packages/client/src/components/LobbyScreen.tsx:11-13`

**Issue:** `void navigator.clipboard.writeText(code ?? '')` will throw a `TypeError` on browsers where `navigator.clipboard` is `undefined` (HTTP contexts, some older browsers) or when the document is not focused. The `void` operator discards the rejection. The button will appear to work but the clipboard write silently fails with no user feedback.

**Fix:**

```ts
function handleClick() {
  if (!navigator.clipboard) return; // or show a manual-copy fallback
  navigator.clipboard.writeText(code ?? '').catch(() => {
    // optionally show a "Copy failed" message
  });
  setLabel('Copied!');
  setTimeout(() => setLabel('Copy Code'), 2000);
}
```

---

### IN-03: `CreateRoomScreen` emits `room:create` on every mount — re-mount creates orphaned rooms

**File:** `packages/client/src/components/LobbyScreen.tsx:31-33`

**Issue:** The `useEffect` in `CreateRoomScreen` fires `socket.emit(ClientEvents.ROOM_CREATE)` unconditionally on mount. In React 18 strict mode (development), effects run twice. More importantly, if the user navigates away and back (e.g., clicks "Or join an existing room" and then "Or create a new room"), a new `room:create` is emitted, creating a second room in the server store. The first room (slot 1 assigned to this socket) becomes orphaned since `socket.data.roomCode` is overwritten on the second join. The orphaned room will never be cleaned up unless the socket disconnects.

**Fix:** Check whether `roomCode` is already set in the store before emitting:

```ts
useEffect(() => {
  if (!useGameStore.getState().roomCode) {
    socket.emit(ClientEvents.ROOM_CREATE);
  }
}, []);
```

---

_Reviewed: 2026-05-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
