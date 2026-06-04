# Phase 7: Client-Server Integration - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 11 (3 new files + 6 modified files + 2 new CSS modules)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File                                            | Role                 | Data Flow        | Closest Analog                                                                                   | Match Quality   |
| ------------------------------------------------------------ | -------------------- | ---------------- | ------------------------------------------------------------------------------------------------ | --------------- |
| `packages/client/src/socket.ts`                              | utility (singleton)  | request-response | `packages/shared/src/pitch.ts` (module singleton export)                                         | role-match      |
| `packages/client/src/App.tsx`                                | provider / event hub | event-driven     | `packages/server/src/createServer.ts` (central connection + listener wiring)                     | data-flow match |
| `packages/client/src/store/useGameStore.ts`                  | store                | event-driven     | existing `useGameStore.ts` itself (additive extension)                                           | exact           |
| `packages/client/src/components/ConnectionStatus.tsx`        | component            | event-driven     | `packages/client/src/components/TurnIndicator.tsx` (reactive store-read display panel)           | role-match      |
| `packages/client/src/components/ConnectionStatus.module.css` | config               | —                | `packages/client/src/components/TurnIndicator.module.css`                                        | exact           |
| `packages/client/src/components/DisconnectBanner.tsx`        | component            | event-driven     | `packages/client/src/components/TurnIndicator.tsx` (conditional display panel)                   | role-match      |
| `packages/client/src/components/DisconnectBanner.module.css` | config               | —                | `packages/client/src/components/LobbyScreen.module.css` (button + panel tokens)                  | exact           |
| `packages/client/src/components/ActionPanel.tsx`             | component            | event-driven     | `packages/client/src/components/TurnIndicator.tsx` (multi-field store reads; phase-gated render) | role-match      |
| `packages/client/src/components/ActionPanel.module.css`      | config               | —                | `packages/client/src/components/LobbyScreen.module.css` (`.ctaButton`, disabled state)           | exact           |
| `packages/client/src/components/GameBoard.tsx`               | component            | request-response | existing `GameBoard.tsx` itself (layout shell, additive)                                         | exact           |
| `packages/client/src/components/HexGrid.tsx`                 | component            | event-driven     | existing `HexGrid.tsx` itself (click routing extension)                                          | exact           |
| `packages/client/src/components/HexCell.tsx`                 | component            | request-response | existing `HexCell.tsx` itself (highlight prop extension)                                         | exact           |
| `packages/client/src/components/LobbyScreen.tsx`             | component            | request-response | existing `LobbyScreen.tsx` itself (replace mock with socket emit)                                | exact           |
| `packages/client/vite.config.ts`                             | config               | —                | existing `vite.config.ts` itself (proxy addition)                                                | exact           |
| `packages/client/src/store/useGameStore.test.ts`             | test                 | —                | existing `useGameStore.test.ts` itself (extend test file)                                        | exact           |

---

## Pattern Assignments

### `packages/client/src/socket.ts` (utility, singleton export)

**Analog:** `packages/shared/src/pitch.ts` — module-level named constant export, no class, no factory function.

**Module singleton pattern** (pitch.ts reference — entire file is one export block):

```typescript
// packages/shared/src/pitch.ts — pattern: module-level constant, named export
export const PITCH_HEXES: readonly HexCoord[] = [ ... ];
export const PITCH_REGIONS: Record<PitchRegion, readonly HexCoord[]> = { ... };
```

**Apply to socket.ts** — follow same shape: one `export const socket = io(...)` at module level, no wrapper function, no class:

```typescript
// packages/client/src/socket.ts
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@counter-attack/shared';

// autoConnect: false — D-02: explicit connect in App.tsx useEffect only
// transports: ['websocket'] — STATE.md locked decision, no polling
// auth callback — reads localStorage on each connection attempt (handles reconnect token)
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  import.meta.env['VITE_SOCKET_URL'] ?? 'http://localhost:3001',
  {
    autoConnect: false,
    transports: ['websocket'],
    auth: (cb) => {
      const token = localStorage.getItem('ca_session_token');
      cb({ sessionToken: token ?? undefined });
    },
  },
);
```

**Type generic order** (CRITICAL — reversed from server): Client socket is `Socket<ServerToClientEvents, ClientToServerEvents>`. Server socket is `Socket<ClientToServerEvents, ServerToClientEvents>`. Reference: `packages/server/src/roomHandlers.ts` line 38 for server direction.

---

### `packages/client/src/App.tsx` (provider, event-driven)

**Analog:** `packages/server/src/createServer.ts` lines 83–134 — central connection handler with one `io.on('connection', ...)` block that wires all listeners and cleans up.

**Current App.tsx** (lines 1–18) — no useEffect, no socket, just screen routing:

```typescript
// packages/client/src/App.tsx — current (lines 1–18)
import { useGameStore } from './store/useGameStore.js';
import { GameBoard } from './components/GameBoard.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import styles from './App.module.css';

export function App() {
  const screen = useGameStore((s) => s.screen);
  return (
    <div className={styles.app}>{screen === 'GAME_BOARD' ? <GameBoard /> : <LobbyScreen />}</div>
  );
}
```

**Central listener useEffect pattern** to add (D-03 — named handlers, not inline lambdas):

```typescript
// Analog: createServer.ts lines 83-131 wires all socket handlers in one block with cleanup
// Client mirror: one useEffect in App.tsx with ALL server event handlers

import { useEffect } from 'react';
import { socket } from './socket.js';
import { ServerEvents } from '@counter-attack/shared';
import type { GameState } from '@counter-attack/shared';

useEffect(() => {
  socket.connect(); // D-01: explicit connect on mount

  // CRITICAL: named function declarations — NOT inline arrows (Pitfall 1 in RESEARCH.md)
  // Inline arrows create a new reference on each render; socket.off cannot match them.
  function onGameState(state: GameState) { ... }
  function onRoomJoined(code: string, slot: 1 | 2, token: string) { ... }
  function onRoomError(reason: string) { ... }
  function onGameError(reason: string) { ... }
  function onDisconnectWarning() { ... }

  socket.on(ServerEvents.GAME_STATE, onGameState);
  socket.on(ServerEvents.ROOM_JOINED, onRoomJoined);
  socket.on(ServerEvents.ROOM_ERROR, onRoomError);
  socket.on(ServerEvents.GAME_ERROR, onGameError);
  socket.on(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);

  return () => {
    // Must use the SAME named references — this is the cleanup contract
    socket.off(ServerEvents.GAME_STATE, onGameState);
    socket.off(ServerEvents.ROOM_JOINED, onRoomJoined);
    socket.off(ServerEvents.ROOM_ERROR, onRoomError);
    socket.off(ServerEvents.GAME_ERROR, onGameError);
    socket.off(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);
  };
}, []); // empty deps: run once on mount only
```

**Screen advance logic inside `onGameState`** (Pitfall 7 from RESEARCH.md — use game:state not room:joined to advance WAITING → GAME_BOARD):

```typescript
function onGameState(state: GameState) {
  setGameState(state);
  setDisconnectWarning(false); // D-13: auto-dismiss banner
  // Advance from WAITING to GAME_BOARD when first state arrives (Pitfall 7)
  if (useGameStore.getState().screen === 'WAITING') {
    setScreen('GAME_BOARD');
  }
}
```

**Token storage inside `onRoomJoined`**:

```typescript
function onRoomJoined(code: string, slot: 1 | 2, token: string) {
  if (token) localStorage.setItem('ca_session_token', token);
  setRoomCode(code);
  setPlayerSlot(slot);
  const screen = useGameStore.getState().screen;
  if (screen === 'CREATE_ROOM') setScreen('WAITING');
  // JOIN_ROOM → GAME_BOARD advance is handled by onGameState (Pitfall 7)
}
```

---

### `packages/client/src/store/useGameStore.ts` (store, additive extension)

**Analog:** Itself — extend the existing store shape. The `create<GameStore>()((set, get) => ...)` curried form is already correct (line 36).

**Existing imports** (lines 1–4):

```typescript
import { create } from 'zustand';
import type { GameState, HexCoord } from '@counter-attack/shared';
import { validateMove, hexesInRange } from '@counter-attack/shared';
import { mockMovementState } from '../mock/index.js';
```

**Phase 7 import addition** — add `ClientEvents` and `socket`:

```typescript
import { ClientEvents } from '@counter-attack/shared';
import { socket } from '../socket.js';
```

**Phase 7 type additions** to `GameStore` (after `validMoveHexes: HexCoord[]` on line 14):

```typescript
playerSlot: 1 | 2 | null;        // D-04
roomCode: string | null;          // D-04
disconnectWarning: boolean;       // D-13
roomError: string | null;
gameError: string | null;
// Actions
setGameState: (state: GameState) => void;
setPlayerSlot: (slot: 1 | 2) => void;
setRoomCode: (code: string) => void;
setDisconnectWarning: (v: boolean) => void;
setRoomError: (msg: string | null) => void;
setGameError: (msg: string | null) => void;
emitMove: (pieceId: string, to: HexCoord) => void;
emitRoll: () => void;
emitEndTurn: () => void;
emitUndo: () => void;
emitGKRestart: (choice: 'kick' | 'throw' | 'movement') => void;
emitStartMovement: () => void;
```

**`movePiece` → `emitMove` replacement** — delete lines 28–29 (type) and lines 59–70 (implementation); replace with:

```typescript
// emitMove replaces movePiece — D-08: server broadcast path, not local mutation
emitMove: (pieceId, to) => {
  socket.emit(ClientEvents.GAME_MOVE, pieceId, to);
  set({ selectedPieceId: null, validMoveHexes: [] }); // clear selection optimistically
},
```

**Emit action pattern** (copy for all emitters — reference gameHandlers.ts lines 124–153 for event names):

```typescript
emitRoll: () => { socket.emit(ClientEvents.GAME_ROLL); },
emitEndTurn: () => { socket.emit(ClientEvents.GAME_END_TURN); },
emitUndo: () => { socket.emit(ClientEvents.GAME_UNDO); },
emitGKRestart: (choice) => { socket.emit(ClientEvents.GAME_GK_RESTART, choice); },
emitStartMovement: () => { socket.emit(ClientEvents.GAME_START_MOVEMENT); },
```

**Selector pattern** to follow (copy from `TurnIndicator.tsx` lines 33–37 — one `useGameStore((s) => s.field)` per field, not destructured):

```typescript
// Good: one selector per slice — avoids whole-component re-render
const playerSlot = useGameStore((s) => s.playerSlot);
const phase = useGameStore((s) => s.gameState.phase);
// Bad: const { playerSlot, phase } = useGameStore((s) => s) — re-renders on any field change
```

---

### `packages/client/src/components/ConnectionStatus.tsx` (component, event-driven)

**Analog:** `packages/client/src/components/TurnIndicator.tsx` — reactive display component, reads from store or local state, no emitters, pure render.

**TurnIndicator pattern for local state + socket events** (lines 32–66 as structural template):

```typescript
// TurnIndicator.tsx — pattern: multiple granular useGameStore selectors; local derived values; pure render
export function TurnIndicator() {
  const phase = useGameStore((s) => s.gameState.phase);
  const activeTeam = useGameStore((s) => s.gameState.activeTeam);
  // ...derived values...
  return <div className={styles.panel}>...</div>;
}
```

**ConnectionStatus uses local React state** (not Zustand — connection status is ephemeral UI state):

```typescript
// packages/client/src/components/ConnectionStatus.tsx
import { useState, useEffect } from 'react';
import { socket } from '../socket.js';
import styles from './ConnectionStatus.module.css';

type Status = 'connected' | 'reconnecting' | 'disconnected';

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('disconnected');

  useEffect(() => {
    function onConnect() {
      setStatus('connected');
    }
    function onDisconnect() {
      setStatus('disconnected');
    }
    function onReconnectAttempt() {
      setStatus('reconnecting');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt); // Manager event — NOT socket event (Pitfall 6)

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt); // must use socket.io.off, not socket.off
    };
  }, []);

  // ...render dot + label based on status
}
```

**CSS pattern** — copy `.panel` from `TurnIndicator.module.css` lines 1–6 for container; use inline color for the status dot (green/yellow/red per D-12).

---

### `packages/client/src/components/DisconnectBanner.tsx` (component, event-driven)

**Analog:** `packages/client/src/components/TurnIndicator.tsx` for the read-from-store pattern. `packages/client/src/components/LobbyScreen.tsx` lines 79–93 (`WaitingScreen`) for the fixed-overlay visual pattern.

**Store read pattern** (one selector, conditional render — D-13):

```typescript
// packages/client/src/components/DisconnectBanner.tsx
import { useGameStore } from '../store/useGameStore.js';
import styles from './DisconnectBanner.module.css';

export function DisconnectBanner() {
  const disconnectWarning = useGameStore((s) => s.disconnectWarning);
  if (!disconnectWarning) return null; // conditional render — not display:none
  return (
    <div className={styles.banner}>
      Opponent disconnected. Waiting 90 seconds for reconnect...
    </div>
  );
}
```

**CSS banner pattern** — fixed/absolute full-width overlay; copy color tokens from `LobbyScreen.module.css` (background `#16213e`, border `#0f3460`, text `#e0e0e0`).

---

### `packages/client/src/components/ActionPanel.tsx` (component, event-driven + emitters)

**Analog:** `packages/client/src/components/TurnIndicator.tsx` for per-field Zustand selectors. `packages/client/src/components/LobbyScreen.tsx` lines 8–24 (`CopyButton`) for the button + disabled state pattern.

**Per-field selector pattern** (copy from TurnIndicator.tsx lines 33–38 exactly):

```typescript
// packages/client/src/components/TurnIndicator.tsx lines 33–38 — pattern to copy
const phase = useGameStore((s) => s.gameState.phase);
const activeTeam = useGameStore((s) => s.gameState.activeTeam);
const score = useGameStore((s) => s.gameState.score);
const movementSlot = useGameStore((s) => s.gameState.movementSlot);
const movedPieceIds = useGameStore((s) => s.gameState.movedPieceIds);
```

**Active player derivation** (copy from RESEARCH.md Pattern 5 — simplified with `gameState.activeTeam` per Open Question 2 resolution):

```typescript
// packages/client/src/components/ActionPanel.tsx
// Use gameState.activeTeam directly (server maintains this field across all transitions)
const playerSlot = useGameStore((s) => s.playerSlot);
const activeTeam = useGameStore((s) => s.gameState.activeTeam);
const myTeam: 'home' | 'away' | null = playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
const isActivePlayer = myTeam !== null && myTeam === activeTeam;
```

**Undo button gating** (D-09, D-10, UNDO-02, UNDO-03):

```typescript
// packages/client/src/components/ActionPanel.tsx
const phase = useGameStore((s) => s.gameState.phase);
const lastDiceRoll = useGameStore((s) => s.gameState.lastDiceRoll);
const emitUndo = useGameStore((s) => s.emitUndo);

// Conditionally RENDERED for active player only (D-10); DISABLED when lastDiceRoll set (D-09)
{phase === 'MOVEMENT' && isActivePlayer && (
  <button
    className={styles.ctaButton}
    disabled={!!lastDiceRoll}
    onClick={emitUndo}
  >
    Undo Move
  </button>
)}
```

**Button disabled pattern** (copy from `LobbyScreen.module.css` lines 44–63):

```css
/* LobbyScreen.module.css lines 44–53 — ctaButton + disabled state to copy */
.ctaButton {
  background: #0f3460;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.ctaButton:disabled {
  opacity: 0.5;
  cursor: default;
}
```

**Phase-gated button visibility table** (reference gameHandlers.ts for which phases accept which events):

- Roll button: visible when `phase` is `'PASS' | 'SHOT' | 'HEADER' | 'LOOSE_BALL'` AND `isActivePlayer` (gameHandlers.ts line 52: `DICE_PHASES`)
- End Turn button: visible when `phase === 'MOVEMENT'` AND `isActivePlayer`
- Undo button: visible when `phase === 'MOVEMENT'` AND `isActivePlayer`; disabled when `!!lastDiceRoll`
- Start Movement button: visible when `phase === 'KICK_OFF'` AND `isActivePlayer`
- GK restart buttons: visible when `phase === 'GK_RESTART'` AND the GK's team (derive from ball.carrierId + playerSlot)

**GK team derivation** (mirror server's `controlsGKTeam` in gameHandlers.ts lines 103–108):

```typescript
// gameHandlers.ts lines 103–108 — copy this logic to client for GK restart gating
const gkPiece = pieces.find((p) => p.id === ball.carrierId);
const gkTeam = gkPiece?.teamId ?? null;
const isGKTeam = myTeam !== null && myTeam === gkTeam;
```

---

### `packages/client/src/components/GameBoard.tsx` (component, additive modification)

**Analog:** Itself — the existing layout is correct; Phase 7 adds ConnectionStatus to header and ActionPanel to sidebar.

**Existing import block** (lines 1–5) — add ConnectionStatus, DisconnectBanner, ActionPanel:

```typescript
import { ConnectionStatus } from './ConnectionStatus.js'; // add
import { DisconnectBanner } from './DisconnectBanner.js'; // add
import { ActionPanel } from './ActionPanel.js'; // add
```

**Existing JSX structure** (lines 13–35) — insertion points:

```typescript
// Header: add ConnectionStatus after the score span (lines 17–23)
<header className={styles.header}>
  <span>Counter Attack</span>
  <span className={styles.headerScore}>...</span>
  <ConnectionStatus />  {/* add at end of header — D-12 */}
</header>

// After header, before main: add DisconnectBanner (D-13)
<DisconnectBanner />

// Sidebar: add ActionPanel after ActionLog (lines 28–30)
<aside className={styles.sidebar}>
  <TurnIndicator />
  <ActionLog />
  <ActionPanel />  {/* add at end of sidebar — D-07 */}
</aside>
```

---

### `packages/client/src/components/HexGrid.tsx` (component, click routing extension)

**Analog:** Itself — extend existing click routing. Two changes: (1) replace `movePiece` with `emitMove`, (2) add SHOT phase goal-hex click routing.

**Existing subscriptions** (lines 36–43) — add new fields:

```typescript
// Existing (lines 36–43):
const pieces = useGameStore((s) => s.gameState.pieces);
const ball = useGameStore((s) => s.gameState.ball);
const phase = useGameStore((s) => s.gameState.phase);
const activeTeam = useGameStore((s) => s.gameState.activeTeam);
const validMoveHexes = useGameStore((s) => s.validMoveHexes);
const selectedPieceId = useGameStore((s) => s.selectedPieceId);
const selectPiece = useGameStore((s) => s.selectPiece);
const movePiece = useGameStore((s) => s.movePiece); // REMOVE — replace with emitMove

// Add:
const emitMove = useGameStore((s) => s.emitMove);
const movedPieceIds = useGameStore((s) => s.gameState.movedPieceIds); // Pitfall 8
const playerSlot = useGameStore((s) => s.playerSlot);
```

**Hex click routing** (replace line 69 onClick on HexCell):

```typescript
// Current line 69 — local mutation (REMOVE):
onClick={isHighlighted ? () => movePiece(hex) : () => undefined}

// Phase 7 replacement — also add SHOT phase goal-hex routing:
const isGoalHex = phase === 'SHOT' && (isInRegion(hex, 'homeGoal') || isInRegion(hex, 'awayGoal'));
onClick={isHighlighted ? () => emitMove(selectedPieceId!, hex) : isGoalHex ? () => handleShotTarget(hex) : undefined}

// handleShotTarget: store the targetHex in local component state; Roll button reads it.
// Resolution of GAME_SHOT gap (RESEARCH.md Open Q1): store shot target locally in component,
// pass to emitRoll via store or component state — planner must decide path in plan.
```

**Piece clickability** (line 81 — add movedPieceIds check, Pitfall 8):

```typescript
// Current line 81:
isClickable={phase === 'MOVEMENT' && piece.teamId === activeTeam}

// Phase 7 replacement:
isClickable={
  phase === 'MOVEMENT' &&
  piece.teamId === activeTeam &&
  !movedPieceIds.includes(piece.id)  // Pitfall 8: don't offer false clickability
}
```

---

### `packages/client/src/components/HexCell.tsx` (component, prop extension)

**Analog:** Itself — add `highlightColor` prop to support SHOT phase red highlight (D-06).

**Existing Props type** (lines 7–10) — add `highlightColor`:

```typescript
// Current:
type Props = {
  hex: HexCoord;
  isHighlighted: boolean;
  onClick: () => void;
};

// Phase 7:
type Props = {
  hex: HexCoord;
  isHighlighted: boolean;
  highlightColor?: string; // D-06: undefined → gold (#f5c518); 'red' → '#e74c3c' for SHOT phase
  onClick: () => void;
};
```

**Highlight polygon** (lines 43–54) — use `highlightColor ?? '#f5c518'`:

```typescript
{isHighlighted && (
  <polygon
    points={points}
    fill={highlightColor ?? '#f5c518'}   // gold for moves, red for shot goal hexes
    fillOpacity={hovered ? 0.75 : 0.55}
    stroke={highlightColor ? '#c0392b' : '#d4a017'}
    strokeWidth={hovered ? 2 : 1.5}
    pointerEvents="none"
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    style={{ cursor: 'pointer' }}
  />
)}
```

---

### `packages/client/src/components/LobbyScreen.tsx` (component, mock → socket)

**Analog:** Itself — three targeted replacements; structure unchanged.

**Current mock constant** (line 5) — delete entirely:

```typescript
const MOCK_CODE = 'MOCK42'; // DELETE
```

**CreateRoomScreen replacement** — emit `room:create` on mount; read `roomCode` from store:

```typescript
// Current lines 27–44: setScreen('GAME_BOARD') mock button → DELETE
// Phase 7 CreateRoomScreen:
function CreateRoomScreen() {
  const roomCode = useGameStore((s) => s.roomCode); // D-04: from store, set by room:joined handler

  useEffect(() => {
    socket.emit(ClientEvents.ROOM_CREATE);
    // room:joined handler in App.tsx sets roomCode + navigates to WAITING
  }, []);

  // CopyButton reads roomCode from store (not MOCK_CODE)
  // Remove "View Game Board →" dev shortcut button
}
```

**JoinRoomScreen replacement** — emit `room:join` with user input; remove `setScreen('WAITING')`:

```typescript
// Current handleSubmit (lines 51–54): setScreen('WAITING') → REPLACE
function handleSubmit() {
  if (input.length === 0) return;
  socket.emit(ClientEvents.ROOM_JOIN, input); // server responds via room:joined or room:error
  // App.tsx room:joined handler navigates; room:error handler sets roomError for inline display
}
```

**WaitingScreen replacement** — replace `MOCK_CODE` with store `roomCode`:

```typescript
// Current line 85: {MOCK_CODE} → REPLACE
const roomCode = useGameStore((s) => s.roomCode);
// ...
<div className={styles.roomCode}>{roomCode ?? 'Loading…'}</div>
```

---

### `packages/client/vite.config.ts` (config, proxy addition)

**Analog:** Itself — add `server.proxy` to existing config.

**Current config** (lines 1–10):

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

**Phase 7 addition** — add `server.proxy` block:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

---

### `packages/client/src/store/useGameStore.test.ts` (test, extension)

**Analog:** Itself — existing `beforeEach` reset pattern (lines 5–11) and `describe`/`it` block structure must be preserved and extended.

**Existing test reset pattern** (lines 5–11) — extend to include Phase 7 fields:

```typescript
// Current lines 5–11 — extend setState to include new fields:
beforeEach(() => {
  useGameStore.setState({
    gameState: mockMovementState,
    screen: 'CREATE_ROOM', // add explicit reset
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: null, // add
    roomCode: null, // add
    disconnectWarning: false, // add
    roomError: null, // add
    gameError: null, // add
  });
});
```

**Test for `movePiece` → removed** (lines 44–68 describe block) — the `movePiece` describe block tests a function that will be deleted. These tests must be removed and replaced with `emitMove` tests using a `vi.fn()` mocked socket.

**Socket mock pattern** for unit tests (avoids live server dependency):

```typescript
// At top of test file — mock socket module
vi.mock('../socket.js', () => ({
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));
import { socket } from '../socket.js';

// In test:
it('emitMove calls socket.emit with GAME_MOVE', () => {
  useGameStore.getState().selectPiece('home-8');
  const targetHex = useGameStore.getState().validMoveHexes[0]!;
  useGameStore.getState().emitMove('home-8', targetHex);
  expect(socket.emit).toHaveBeenCalledWith('game:move', 'home-8', targetHex);
});
```

**UNDO gate tests** (UNDO-02, UNDO-03 — new describe blocks):

```typescript
// Test Undo disabled when lastDiceRoll set (UNDO-02)
// Test playerSlot conditional render gate (UNDO-03) — render ActionPanel with playerSlot=2, activeTeam='home'
// Use @testing-library/react render + screen.queryByRole('button', { name: /undo/i })
```

---

## Shared Patterns

### Named Socket Handler Pattern

**Source:** `packages/client/src/App.tsx` (to be written), derived from `packages/server/src/roomHandlers.ts` lines 69–189 (named `socket.on` + named handler references)
**Apply to:** `App.tsx`, `ConnectionStatus.tsx` — every `useEffect` that calls `socket.on` MUST declare named `function` handlers and return `socket.off` with those same references.

```typescript
// Anti-pattern (Pitfall 1 — NEVER DO THIS):
socket.on('connect', () => setStatus('connected')); // cannot be removed

// Correct pattern (from roomHandlers.ts disconnect handler structure):
function onConnect() {
  setStatus('connected');
}
socket.on('connect', onConnect);
return () => socket.off('connect', onConnect); // same reference
```

### Granular Zustand Selector Pattern

**Source:** `packages/client/src/components/TurnIndicator.tsx` lines 33–38, `packages/client/src/components/HexGrid.tsx` lines 36–43
**Apply to:** `ConnectionStatus.tsx`, `DisconnectBanner.tsx`, `ActionPanel.tsx`, modified `HexGrid.tsx`

```typescript
// One selector per field — prevents whole-component re-render when unrelated fields change
const phase = useGameStore((s) => s.gameState.phase);
const playerSlot = useGameStore((s) => s.playerSlot);
// NOT: const { phase, playerSlot } = useGameStore() — re-renders on any store change
```

### Named Export Pattern (no defaults)

**Source:** All existing client components — `packages/client/src/components/TurnIndicator.tsx` line 32, `packages/client/src/components/HexGrid.tsx` line 34, `packages/client/src/store/useGameStore.ts` line 36
**Apply to:** All new files — `socket.ts`, `ConnectionStatus.tsx`, `DisconnectBanner.tsx`, `ActionPanel.tsx`

```typescript
export function ComponentName() { ... }   // correct
export const socket = io(...);            // correct
export default function() { ... }         // NEVER — project convention
```

### CSS Module Token Palette

**Source:** `packages/client/src/components/LobbyScreen.module.css` and `packages/client/src/components/TurnIndicator.module.css`
**Apply to:** `ConnectionStatus.module.css`, `DisconnectBanner.module.css`, `ActionPanel.module.css`

Established color tokens to copy:

```css
/* Background: */ #1a1a2e (page bg) / #16213e (panel bg)
/* Border:     */ #0f3460
/* Text:       */ #e0e0e0 (primary) / #a0a0a0 (secondary)
/* Accent:     */ #f5c518 (gold/highlight)
/* Home:       */ #1a56b0
/* Away:       */ #c0392b
/* Button:     */ #0f3460 bg / #1a56b0 hover
```

### isProcessing No-Retry Pattern

**Source:** `packages/server/src/gameHandlers.ts` lines 128, 163, 200, 232, 272, 319 — `if (!room || room.isProcessing) return;`
**Apply to:** All action buttons in `ActionPanel.tsx` — do NOT add loading spinners, do NOT retry. Server drops duplicates silently. Buttons are fire-and-forget.

---

## No Analog Found

All Phase 7 files have analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively — RESEARCH.md patterns have been incorporated into the assignments above where the analog is the file's prior version.

---

## Metadata

**Analog search scope:** `packages/client/src/`, `packages/server/src/`, `packages/shared/src/`
**Files scanned:** 18 client files, 15 server files, 21 shared files = 54 total
**Pattern extraction date:** 2026-05-31
