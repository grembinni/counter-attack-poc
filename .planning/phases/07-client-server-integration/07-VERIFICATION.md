---
phase: 07-client-server-integration
verified: 2026-05-31T22:00:00Z
signed_off: 2026-06-11T00:00:00Z
status: passed
score: 18/18 must-haves verified
overrides_applied: 0
human_verification_signoffs:
  - test: 'Two-tab room session (create + join)'
    disposition: accepted
    note: 'Phase 10 UAT ran all 10 tests across two connected browser sessions. Room create/join was the prerequisite for every test; all passed (commit 4a1ff80).'
  - test: 'Undo move re-clickability (movedPieceIds)'
    disposition: accepted
    note: "Code was fixed post-Phase 7. applyUndo at gameEngine.ts:785 now filters the piece from movedPieceIds unconditionally. Comment: 'Previously only removed when paceUsed reached 0 — the X marker persisted.' UNDO-04 fully satisfied."
  - test: 'Undo button absent outside MOVEMENT phase'
    disposition: accepted
    note: 'ActionPanel phase guard confirmed in code. Phase 10 UAT tested multi-phase flows without undo persistence issues.'
  - test: 'Disconnect banner lifecycle'
    disposition: accepted
    note: 'Code correctly wired: game:disconnect-warning sets flag, next game:state clears it. Network resilience testing out of v1.0 UAT scope; accepted as-is.'
  - test: 'ConnectionStatus visual states (green/amber/red)'
    disposition: accepted
    note: 'Code correctly wired: socket.io Manager events mapped to three colors. Visual network interruption test out of v1.0 UAT scope; accepted as-is.'
---

# Phase 7: Client-Server Integration Verification Report

**Phase Goal:** Client-server integration — two browser tabs can connect via Socket.io, create/join a room, and play a live game session with real socket events replacing all client-side mocks.
**Verified:** 2026-05-31T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                              | Status   | Evidence                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A single socket instance exists module-wide with autoConnect:false and transports:['websocket']                                                                    | VERIFIED | `packages/client/src/socket.ts` lines 17-28: `io(socketUrl, { autoConnect: false, transports: ['websocket'], auth: ... })`                                                                                                                        |
| 2   | The Zustand store exposes setGameState, setPlayerSlot, setRoomCode, setDisconnectWarning, setRoomError, setGameError                                               | VERIFIED | `packages/client/src/store/useGameStore.ts` lines 35-45: all six setters declared in type and implemented                                                                                                                                         |
| 3   | The Zustand store exposes emitMove, emitRoll, emitEndTurn, emitUndo, emitGKRestart, emitStartMovement that emit the correct ClientEvents                           | VERIFIED | `useGameStore.ts` lines 109-132: all six emitters call `socket.emit(ClientEvents.GAME_*)`                                                                                                                                                         |
| 4   | emitMove emits game:move with positional args (pieceId, hex) and clears selection                                                                                  | VERIFIED | `useGameStore.ts` lines 109-112: `socket.emit(ClientEvents.GAME_MOVE, pieceId, to); set({ selectedPieceId: null, validMoveHexes: [] })`                                                                                                           |
| 5   | The local-mutation movePiece action no longer exists on the store                                                                                                  | VERIFIED | Grep for `movePiece` in `packages/client/src` returns only a JSDoc comment (`Replaces the removed movePiece...`) — no type declaration or implementation                                                                                          |
| 6   | On app mount the socket connects exactly once via a single central useEffect                                                                                       | VERIFIED | `packages/client/src/App.tsx` line 21: `useEffect(() => { socket.connect(); ... }, [])` — empty deps array                                                                                                                                        |
| 7   | All five server events (game:state, room:joined, room:error, game:error, game:disconnect-warning) are registered with named handlers and cleaned up via socket.off | VERIFIED | `App.tsx` lines 23-63: five named `function on...` handlers; five `socket.on(ServerEvents.*)` registrations; five `socket.off(...)` in cleanup return                                                                                             |
| 8   | Receiving game:state while on WAITING advances to GAME_BOARD                                                                                                       | VERIFIED | `App.tsx` lines 26-28: `if (useGameStore.getState().screen === 'WAITING') setScreen('GAME_BOARD')` inside onGameState                                                                                                                             |
| 9   | room:joined stores the session token in localStorage and sets playerSlot + roomCode                                                                                | VERIFIED | `App.tsx` lines 32-36: `if (token) localStorage.setItem('ca_session_token', token); setRoomCode(code); setPlayerSlot(slot)`                                                                                                                       |
| 10  | Create Room emits room:create on mount and shows the real server code; Join Room emits room:join with the typed code and shows inline errors                       | VERIFIED | `LobbyScreen.tsx` lines 31-33: `socket.emit(ClientEvents.ROOM_CREATE)` in mount effect; line 60: `socket.emit(ClientEvents.ROOM_JOIN, input)`; lines 63-72: error mapping; no MOCK42 remaining                                                    |
| 11  | The Undo button appears only in the active player's tab during MOVEMENT and is hidden for the opposing player                                                      | VERIFIED | `ActionPanel.tsx` lines 31-33: `if (!isActivePlayer) return null`; lines 86-89: Undo button only when `phase === 'MOVEMENT'`                                                                                                                      |
| 12  | The Undo button is disabled when gameState.lastDiceRoll is set                                                                                                     | VERIFIED | `ActionPanel.tsx` line 87: `disabled={!!lastDiceRoll}`                                                                                                                                                                                            |
| 13  | Clicking Undo emits game:undo; server applyUndo reverses the last move                                                                                             | VERIFIED | Client: `useGameStore.ts` line 122-124: `socket.emit(ClientEvents.GAME_UNDO)`. Server: `gameHandlers.ts` lines 228-258: GAME_UNDO handler calls `applyUndo`; `gameEngine.ts` lines 334-401: restores piece position, decrements paceUsedByPieceId |
| 14  | Roll/EndTurn/StartMovement/GK restart buttons render per phase for the active player                                                                               | VERIFIED | `ActionPanel.tsx`: Roll for DICE_PHASES (lines 72-76), EndTurn for MOVEMENT (lines 93-96), StartMovement for KICK_OFF (lines 79-82), GK group for GK_RESTART (lines 100-113)                                                                      |
| 15  | A green/amber/red connection status indicator reflects live socket state                                                                                           | VERIFIED | `ConnectionStatus.tsx` lines 8-15: STATUS_COLOR map with `#22c55e`, `#eab308`, `#ef4444`; socket.io.on('reconnect_attempt') on Manager (Pitfall 6 correctly handled)                                                                              |
| 16  | A disconnect banner shows when game:disconnect-warning is received and dismisses on the next game:state                                                            | VERIFIED | `DisconnectBanner.tsx`: reads disconnectWarning from store, returns null when false. App.tsx onGameState calls `setDisconnectWarning(false)`                                                                                                      |
| 17  | During SHOT phase, opponent goal hexes are clickable and clicking emits game:shot with the target HexCoord                                                         | VERIFIED | `HexGrid.tsx` lines 72-73: `isGoalHex` computed for SHOT phase using `isInRegion`; lines 83-88: goal-hex click calls `socket.emit(ClientEvents.GAME_SHOT, hex)`                                                                                   |
| 18  | ClientEvents.GAME_SHOT exists; server game:shot handler records room.shotTarget without broadcasting and rejects WRONG_PHASE/WRONG_TEAM/INVALID_TARGET             | VERIFIED | `events.ts` line 13: `GAME_SHOT: 'game:shot'`; `gameHandlers.ts` lines 319-354: handler with all three guards, `room.shotTarget = {...}` on success, no broadcastState call                                                                       |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact                                                     | Expected                                                  | Status   | Details                                                                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `packages/client/src/socket.ts`                              | Module-singleton typed Socket with autoConnect:false      | VERIFIED | 29 lines; exports `socket: Socket<ServerToClientEvents, ClientToServerEvents>`; auth callback reads ca_session_token from localStorage                                                           |
| `packages/client/vite.config.ts`                             | Dev proxy for /socket.io                                  | VERIFIED | Lines 10-17: `/socket.io` proxy to `ws://localhost:3001` with `ws: true`                                                                                                                         |
| `packages/client/src/store/useGameStore.ts`                  | Extended store with Phase 7 fields and emitters           | VERIFIED | 134 lines; all six setters + six emitters; movePiece absent                                                                                                                                      |
| `packages/client/src/store/useGameStore.test.ts`             | Unit tests for setters and emit actions                   | VERIFIED | 131 lines; vi.mock('../socket.js'); setGameState/setPlayerSlot/setRoomCode/setDisconnectWarning/setRoomError tests; emitMove/emitRoll/emitEndTurn/emitUndo/emitGKRestart/emitStartMovement tests |
| `packages/client/src/App.tsx`                                | Central socket listener hub                               | VERIFIED | 69 lines; socket.connect() + 5 named handlers + 5 socket.off cleanups                                                                                                                            |
| `packages/client/src/components/LobbyScreen.tsx`             | Real room:create/room:join wiring                         | VERIFIED | No MOCK42; ClientEvents.ROOM_CREATE emitted; ClientEvents.ROOM_JOIN emitted; error mapping present                                                                                               |
| `packages/client/src/components/ActionPanel.tsx`             | Phase-gated controls + undo gating                        | VERIFIED | 119 lines; emitUndo called; `disabled={!!lastDiceRoll}`; returns null for non-active player                                                                                                      |
| `packages/client/src/components/ActionPanel.module.css`      | ctaButton + disabled styles                               | VERIFIED | `.ctaButton:disabled { opacity: 0.5; cursor: default }` present                                                                                                                                  |
| `packages/client/src/components/ActionPanel.test.tsx`        | Undo visibility/disabled tests                            | VERIFIED | 111 lines; 9 tests covering UNDO-01/02/03 + Roll + StartMovement                                                                                                                                 |
| `packages/client/src/components/ConnectionStatus.tsx`        | Three-state indicator                                     | VERIFIED | Uses socket.io.on('reconnect_attempt') on Manager; all three fills and labels present                                                                                                            |
| `packages/client/src/components/DisconnectBanner.tsx`        | Conditional disconnect banner                             | VERIFIED | reads disconnectWarning; returns null when false                                                                                                                                                 |
| `packages/client/src/components/DisconnectBanner.module.css` | Fixed-top banner styles                                   | VERIFIED | position: fixed; top: 0; z-index: 100                                                                                                                                                            |
| `packages/client/src/components/GameBoard.tsx`               | ConnectionStatus + DisconnectBanner + ActionPanel wired   | VERIFIED | Lines 5-7: imports all three; lines 26, 28, 35: rendered in correct positions                                                                                                                    |
| `packages/client/src/components/HexGrid.tsx`                 | emitMove + game:shot routing + movedPieceIds guard        | VERIFIED | emitMove replaces movePiece; socket.emit(ClientEvents.GAME_SHOT, hex) on goal-hex click; !movedPieceIds.includes(piece.id) guard                                                                 |
| `packages/client/src/components/HexCell.tsx`                 | highlightColor prop                                       | VERIFIED | `highlightColor?: string                                                                                                                                                                         | undefined`prop;`highlightColor ?? '#f5c518'` in highlight polygon |
| `packages/shared/src/events.ts`                              | GAME_SHOT event constant + ClientToServerEvents signature | VERIFIED | `GAME_SHOT: 'game:shot'`; `[ClientEvents.GAME_SHOT]: (targetHex: HexCoord) => void`                                                                                                              |
| `packages/server/src/roomStore.ts`                           | Room.shotTarget field                                     | VERIFIED | `shotTarget?: HexCoord                                                                                                                                                                           | null` in Room type; not in broadcastState                         |
| `packages/server/src/gameHandlers.ts`                        | game:shot handler                                         | VERIFIED | socket.on(ClientEvents.GAME_SHOT, ...); phase/team/payload guards; records shotTarget; no broadcastState                                                                                         |
| `packages/server/src/__tests__/game.integration.test.ts`     | game:shot describe block                                  | VERIFIED | Lines 523-600: describe('game:shot (D-06)') with WRONG_PHASE, recorded shotTarget, and INVALID_TARGET tests                                                                                      |

### Key Link Verification

| From                                                  | To                                          | Via                                                                 | Status | Details                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/store/useGameStore.ts`           | `packages/client/src/socket.ts`             | `import { socket }` + `socket.emit(ClientEvents.*)` in emit actions | WIRED  | Line 5: `import { socket } from '../socket.js'`; lines 110, 115, 119, 123, 127, 131: `socket.emit(ClientEvents.*)`                                      |
| `packages/client/src/App.tsx`                         | `packages/client/src/socket.ts`             | `socket.on(ServerEvents.*)` in mount useEffect                      | WIRED  | Line 6: `import { socket } from './socket.js'`; lines 51-55: five `socket.on(ServerEvents.*)` registrations                                             |
| `packages/client/src/components/LobbyScreen.tsx`      | `packages/client/src/socket.ts`             | `socket.emit(ClientEvents.ROOM_*)`                                  | WIRED  | Line 3: `import { socket } from '../socket.js'`; lines 32, 60: `socket.emit(ClientEvents.ROOM_CREATE)` and `socket.emit(ClientEvents.ROOM_JOIN, input)` |
| `packages/client/src/components/ActionPanel.tsx`      | `packages/client/src/store/useGameStore.ts` | `emitUndo/emitRoll/emitGKRestart` via store selectors               | WIRED  | Lines 21-25: selectors for all five emitters; lines 73, 87, 91, 103-110: called in onClick handlers                                                     |
| `packages/client/src/components/HexGrid.tsx`          | `packages/client/src/store/useGameStore.ts` | `emitMove` replaces `movePiece`                                     | WIRED  | Line 47: `const emitMove = useGameStore((s) => s.emitMove)`; line 82: `emitMove(selectedPieceId, hex)`                                                  |
| `packages/client/src/components/HexGrid.tsx`          | `packages/server/src/gameHandlers.ts`       | `socket.emit(ClientEvents.GAME_SHOT, hex)` on SHOT goal-hex click   | WIRED  | Line 87: `socket.emit(ClientEvents.GAME_SHOT, hex)`                                                                                                     |
| `packages/client/src/components/ConnectionStatus.tsx` | `packages/client/src/socket.ts`             | `socket.io.on('reconnect_attempt')`                                 | WIRED  | Lines 40-41: `socket.io.on('reconnect_attempt', onReconnectAttempt)` and `socket.io.off(...)`                                                           |

### Data-Flow Trace (Level 4)

| Artifact          | Data Variable                                   | Source                                                                                                       | Produces Real Data                                                              | Status               |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------- |
| `App.tsx`         | `gameState` (via setGameState)                  | `socket.on(ServerEvents.GAME_STATE, onGameState)` — server broadcasts after every validated action (ARCH-04) | Yes — server calls `broadcastState` after applyMove/applyUndo/applyRoll/etc.    | FLOWING              |
| `App.tsx`         | `roomCode`, `playerSlot`                        | `socket.on(ServerEvents.ROOM_JOINED, onRoomJoined)` — server emits on successful join                        | Yes — server generates UUID sessionToken and 5-char roomCode                    | FLOWING              |
| `LobbyScreen.tsx` | `roomCode` (CreateRoomScreen)                   | `useGameStore((s) => s.roomCode)` — populated by App.tsx onRoomJoined                                        | Yes — server-generated room code                                                | FLOWING              |
| `ActionPanel.tsx` | `gameState.phase`, `lastDiceRoll`, `activeTeam` | `useGameStore` selectors reading `gameState` — replaced by server broadcasts                                 | Yes — setGameState replaces mock with real server state once game starts        | FLOWING              |
| Initial store     | `gameState: mockMovementState`                  | Pre-game bootstrap state (Phase 6 mock)                                                                      | N/A — this is intentional initial state; replaced on first game:state broadcast | ACCEPTABLE BOOTSTRAP |

### Behavioral Spot-Checks

| Behavior                                                 | Command                                                                                                               | Result                                                                                                            | Status                             |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| ClientEvents.GAME_SHOT exists in compiled shared package | `node -e "const m = require('./packages/shared/dist/events.js'); console.log(m.ClientEvents.GAME_SHOT)"`              | `game:shot`                                                                                                       | PASS                               |
| All ClientEvents present including GAME_UNDO             | `node -e "const m = require('./packages/shared/dist/events.js'); console.log(Object.keys(m.ClientEvents).join(','))"` | `ROOM_CREATE,ROOM_JOIN,GAME_MOVE,GAME_ROLL,GAME_SHOT,GAME_GK_RESTART,GAME_END_TURN,GAME_UNDO,GAME_START_MOVEMENT` | PASS                               |
| Two-tab live game session                                | Requires running server + browser                                                                                     | N/A                                                                                                               | SKIP (human verification required) |

### Probe Execution

No probe scripts defined for this phase. Step 7c: SKIPPED (no `scripts/*/tests/probe-*.sh` files for Phase 7).

### Requirements Coverage

| Requirement | Source Plan                                | Description                                                                        | Status                                 | Evidence                                                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UNDO-01     | 07-01, 07-03                               | Active player may undo movement within current turn, up to a dice roll             | SATISFIED                              | `emitUndo()` in store → `socket.emit(ClientEvents.GAME_UNDO)`. Server GAME_UNDO handler → `applyUndo()`. ActionPanel renders Undo button for active player during MOVEMENT.                                                                                       |
| UNDO-02     | 07-01, 07-03                               | Undo not available after dice roll result broadcast                                | SATISFIED                              | `ActionPanel.tsx` line 87: `disabled={!!lastDiceRoll}`. Server `applyUndo` returns `UNDO_LOCKED` when DICE_ROLL event exists in current slot.                                                                                                                     |
| UNDO-03     | 07-02, 07-03                               | Opposing player cannot block or veto undo                                          | SATISFIED                              | `ActionPanel.tsx` lines 31-33: `if (!isActivePlayer) return null`. Server GAME_UNDO handler checks `isActivePlayer`.                                                                                                                                              |
| UNDO-04     | 07-01, 07-03                               | Undoing a movement step restores piece to previous hex and decrements move counter | SATISFIED (partial concern — see Note) | `gameEngine.ts` `applyUndo`: restores `piece.position` to `moveToUndo.from`; decrements `paceUsedByPieceId`. Note: `movedPieceIds` is NOT decremented — the undone piece remains in the already-moved list, affecting re-clickability. See Human Verification #2. |
| CONN-02     | 07-04 (additive; primary delivery Phase 3) | Player can join an existing game room by entering a valid room code                | SATISFIED                              | Server: `joinRoom()` in `roomStore.ts` (Phase 3). Client: `LobbyScreen.tsx` line 60: `socket.emit(ClientEvents.ROOM_JOIN, input)` (Phase 7 wiring). Integration tests in `room.integration.test.ts` pass.                                                         |

### Anti-Patterns Found

| File                                             | Line | Pattern                                                     | Severity | Impact                                                                                                               |
| ------------------------------------------------ | ---- | ----------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/components/ActionPanel.tsx` | 67   | Phase 8 extension comment: "passType is UI-only in Phase 7" | Info     | PassTypeSelector is UI-only local state; does not emit to server. This is intentional and documented. Not a blocker. |

No TBD, FIXME, or XXX markers found in any files modified by this phase.

### Human Verification — Signed Off (2026-06-11)

#### 1. Two-Tab Room Session — Accepted

Phase 10 UAT (commit `4a1ff80`) ran all 10 tests across two connected browser sessions. Room create/join was the prerequisite for every test. All 10 passed.

#### 2. Undo Move Re-Clickability — Accepted (code fix confirmed)

`applyUndo` at `gameEngine.ts:785` now filters the undone piece from `movedPieceIds`:

```ts
const newMovedPieceIds = state.movedPieceIds.filter((id) => id !== moveToUndo.pieceId);
```

Comment in code: _"Previously only removed when paceUsed reached 0 — the X marker persisted on exhausted pieces after undo. Now always removed."_ Phase 7 concern is resolved. UNDO-04 fully satisfied.

#### 3. Undo Button Absent Outside MOVEMENT — Accepted

`ActionPanel` renders Undo only when `phase === 'MOVEMENT'` (code confirmed). Multi-phase UAT flows showed no undo button bleed-through.

#### 4. Disconnect Banner Lifecycle — Accepted

Server emits `game:disconnect-warning` on socket disconnect; `App.tsx` clears the flag on next `game:state`. Code wiring confirmed. Deliberate network interruption test out of v1.0 scope; accepted as-is.

#### 5. ConnectionStatus Visual States — Accepted

Three-state indicator correctly maps `socket.io.on('reconnect_attempt')` → amber, `connect` → green, `disconnect` → red (confirmed in `ConnectionStatus.tsx`). Visual network interruption test out of v1.0 scope; accepted as-is.

### Gaps Summary

No hard blockers identified. All 18 must-haves are VERIFIED in the codebase. The phase goal — two browser tabs connecting via Socket.io, creating/joining a room, and playing a live game session — is structurally complete with all socket events, store emitters, UI components, and server handlers in place and correctly wired.

One behavioral concern requiring human verification: after undo, `movedPieceIds` in `applyUndo`'s returned state spreads `...state` without filtering out the undone piece's ID. This means the server broadcasts a `movedPieceIds` that still includes the undone piece, and HexGrid will keep it unclickable. UNDO-04 says "decrements the move counter" — the pace counter IS decremented, but the clickability guard is not restored. This may or may not be the intended game behavior, but it needs a human runtime test to confirm.

---

_Verified: 2026-05-31T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
