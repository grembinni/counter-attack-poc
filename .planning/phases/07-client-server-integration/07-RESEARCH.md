# Phase 7: Client-Server Integration - Research

**Researched:** 2026-05-31
**Domain:** Socket.io client wiring in React/TypeScript + Zustand state integration + undo architecture
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Socket connects on app load — created once when the React app mounts, before lobby interaction. One socket lifetime per session; no deferred connect.
- **D-02:** Socket instance lives in a module singleton: `packages/client/src/socket.ts`, created with `autoConnect: false`, exported. `socket.connect()` called in `App.tsx` `useEffect` on mount.
- **D-03:** All `server:*` socket event listeners (`game:state`, `room:joined`, `room:error`, `game:error`, `game:disconnect-warning`) registered in one central `useEffect` in `App.tsx`. Each `useEffect` that registers a listener MUST return `socket.off(event, handler)` cleanup.
- **D-04:** Zustand store gains `playerSlot: 1 | 2 | null` and `roomCode: string | null`, populated when `room:joined` is received.
- **D-05:** Passing — full flow wired (pass type selection before Roll button).
- **D-06:** Shooting — click goal hex. When `phase === 'SHOT'`, goal hexes become clickable. Client emits target coord; server transitions to saving duel.
- **D-07:** All action buttons wired in Phase 7: Roll, End Turn, Undo, GK restart, Start Movement.
- **D-08:** Undo button placed in action panel alongside End Turn.
- **D-09:** Undo disabled when `GameState.lastDiceRoll` is set (UNDO-02). No separate `undoAvailable` flag.
- **D-10:** Undo button conditionally rendered — does not appear in opposing player's tab (UNDO-03). Render only when `playerSlot === activePlayerSlot` during `MOVEMENT` phase.
- **D-11:** No board flip — both players see same orientation (home goal at left q=0, away goal at right q=36).
- **D-12 (Claude's discretion):** Connection status indicator: green/yellow/red driven by `connect`, `reconnect_attempt`, `disconnect` events.
- **D-13 (Claude's discretion):** Opponent-disconnect banner on `game:disconnect-warning`; auto-dismissed when next `game:state` arrives.
- **VITE_SOCKET_URL:** Server URL via `import.meta.env.VITE_SOCKET_URL`, default `http://localhost:3001`.
- **`autoConnect: false`:** Prevents connection before React renders.
- **Session token in `localStorage`:** `room:joined` delivers `sessionToken`; stored under key `ca_session_token`; used in `socket.handshake.auth.sessionToken` for reconnect.
- **`game:state` replaces all mock state:** Full-snapshot replace on every event; client never patches.
- **`transports: ['websocket']`:** No polling fallback (STATE.md locked decision).

### Claude's Discretion

- Pass type selector UI: Claude picks the control (buttons, dropdown, or toggle group) — accessible, does not block the board. (UI-SPEC resolves this: toggle button group.)
- Action panel layout: Claude organises Roll, End Turn, Undo, Start Movement, and GK restart controls.
- VITE_SOCKET_URL env var wiring.
- ConnectionStatus placement and styling.
- DisconnectBanner placement and styling.

### Deferred Ideas (OUT OF SCOPE)

- Heading duel click flow (header interaction)
- Snapshot interaction (click-to-snapshot in penalty area)
- GK quick-throw `targetHex` delivery full UI
- React Router / URL-based navigation
- Board flip for away player
- Match lifecycle (action counters, halves, added time) — Phase 8
- Post-game replay — Phase 8
- AWS deployment — Phase 9
- Animations — out of scope v1
- Mobile layout — out of scope v1

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                           | Research Support                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| UNDO-01 | Active player may undo movement/action steps within their turn, up to first dice roll | `applyUndo()` in `gameEngine.ts` already implemented; `game:undo` event wired in `gameHandlers.ts`; client emits `ClientEvents.GAME_UNDO` |
| UNDO-02 | Undo not available after a dice roll result has been broadcast                        | `GameState.lastDiceRoll` is the server-authoritative signal; button disabled via this field (D-09)                                        |
| UNDO-03 | Opposing player cannot block or veto an undo request                                  | Undo button conditionally rendered only for `playerSlot === activePlayerSlot` (D-10); other tab never sees it                             |
| UNDO-04 | Undoing a movement step restores piece to previous hex and decrements move counter    | `applyUndo()` reverses the last `MOVE` ActionEvent, restores `from` position, decrements `paceUsedByPieceId`                              |

</phase_requirements>

---

## Summary

Phase 7 is a wiring phase, not a greenfield build. The server-side infrastructure (room lifecycle, session tokens, game FSM, all event handlers including `game:undo`) is fully operational from Phases 3–5. The React UI shell (HexGrid, HexCell, PieceOverlay, BallMarker, TurnIndicator, ActionLog, LobbyScreen, GameBoard) is complete from Phase 6. This phase's job is to connect those two halves: create the `socket.ts` singleton, wire `App.tsx` as the central event hub, replace mock state with server-broadcast state, and add the four new components (ConnectionStatus, DisconnectBanner, ActionPanel, PassTypeSelector) specified in the UI-SPEC.

The `applyUndo()` engine function is implemented and tested. The `game:undo` handler in `gameHandlers.ts` is wired with all guards (WRONG_PHASE, WRONG_TEAM, isProcessing mutex). The client just needs to emit `ClientEvents.GAME_UNDO` and receive the full-snapshot response via `game:state`. The Undo button is a simple conditional render gated on `playerSlot === activePlayerSlot && phase === 'MOVEMENT' && !gameState.lastDiceRoll`.

One gap identified in the research: `GAME_SHOT` is referenced in `07-UI-SPEC.md`'s board click routing table (`socket.emit(GAME_SHOT, { targetHex: hex })`) but does not exist in `packages/shared/src/events.ts` or `gameHandlers.ts`. The `SHOT` phase resolution is triggered by `game:roll` on the server — `applyRoll()` handles `SHOT` phase. The click-to-goal-hex interaction from the UI-SPEC actually maps to the existing `game:roll` flow, not a new `game:shot` event. This needs confirmation before planning (see Open Questions).

**Primary recommendation:** Create `socket.ts` as the first task, then layer the Zustand store extensions, then App.tsx wiring, then UI components in dependency order: ConnectionStatus → DisconnectBanner → ActionPanel (with PassTypeSelector) → LobbyScreen wiring → HexGrid click routing upgrade.

---

## Architectural Responsibility Map

| Capability                  | Primary Tier      | Secondary Tier | Rationale                                                                                             |
| --------------------------- | ----------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| Socket lifecycle management | Frontend (client) | —              | `socket.ts` singleton; `App.tsx` `useEffect` controls connect/disconnect                              |
| Game state authority        | API / Backend     | —              | ARCH-01: server-authoritative; client only receives full snapshots                                    |
| Event listener registration | Frontend (client) | —              | Central `useEffect` in `App.tsx`; Zustand `setState` calls from handlers                              |
| Player identity (slot)      | API / Backend     | Frontend store | Server assigns slot in `room:joined`; client stores in Zustand `playerSlot`                           |
| Undo gating (UNDO-02)       | Both              | —              | Server enforces via `applyUndo()` guard; client disables button via `lastDiceRoll` field in GameState |
| Undo visibility (UNDO-03)   | Frontend (client) | —              | Conditional render based on `playerSlot === activePlayerSlot`; server is not involved in render logic |
| Connection status display   | Frontend (client) | —              | Socket.io client events (`connect`, `reconnect_attempt`, `disconnect`) drive local React state        |
| Opponent disconnect warning | API / Backend     | Frontend store | Server emits `game:disconnect-warning`; client stores `disconnectWarning` flag in Zustand             |
| Session token persistence   | Frontend (client) | —              | `localStorage` stores `ca_session_token`; sent in `socket.handshake.auth` on reconnect                |
| Pass type selection         | Frontend (client) | —              | UI-only state; passed as payload with `game:roll`; server validates allowed types by phase            |
| Shot target selection       | Frontend (client) | API / Backend  | Client highlights goal hexes during SHOT phase; click sends target coord; server validates            |

---

## Standard Stack

### Core (all already installed — no new packages needed for Phase 7)

| Library          | Version | Purpose                                         | Why Standard                                                              |
| ---------------- | ------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| socket.io-client | ^4.8.3  | WebSocket client connecting to Socket.io server | Already in `packages/client/package.json`; matches server socket.io 4.8.3 |
| zustand          | ^4.5.7  | Client state management                         | Already in client; store extension is additive                            |
| react            | ^18.3.1 | Component rendering                             | Project constraint; already installed                                     |
| vite             | ^5.4.21 | Dev server (with proxy config needed)           | Project constraint; already installed                                     |

### No New Packages Required

Phase 7 installs zero new dependencies. All required packages (socket.io-client, zustand, react, vite) are already present in `packages/client/package.json`. The Vite dev proxy is configured in `vite.config.ts` (config file change only, not a new package).

### Alternatives Considered

| Instead of              | Could Use            | Tradeoff                                                                             |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| Zustand direct setState | Redux Toolkit        | RTK adds action/dispatch ceremony with no benefit for this event-driven update model |
| Module singleton socket | React Context socket | Context causes re-renders on socket object change; singleton avoids this             |
| Vite proxy              | Hardcoded CORS URL   | Proxy avoids CORS config in dev; `VITE_SOCKET_URL` handles production targeting      |

---

## Package Legitimacy Audit

No new packages are installed in Phase 7. All dependencies already exist in the monorepo and were verified in earlier phases.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser Tab A (Player 1)                    Browser Tab B (Player 2)
┌──────────────────────────────┐            ┌──────────────────────────────┐
│  App.tsx                     │            │  App.tsx                     │
│  ├── socket.connect() on     │            │  ├── socket.connect() on     │
│  │   mount (useEffect)       │            │  │   mount (useEffect)       │
│  └── central listener        │            │  └── central listener        │
│      useEffect:              │            │      useEffect:              │
│      game:state → setGameState│            │      game:state → setGameState│
│      room:joined → setSlot   │            │      room:joined → setSlot   │
│      room:error → showError  │            │      game:disconnect-warning  │
│      game:error → showError  │            │        → disconnectWarning   │
└───────────┬──────────────────┘            └──────────────┬───────────────┘
            │ socket.emit(...)                             │ socket.emit(...)
            ▼                                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Socket.io Server (localhost:3001 / packages/server)                     │
│                                                                          │
│  sessionMiddleware → io.on('connection')                                 │
│  ├── reconnect path: restore slot, cancel grace timer, re-emit state     │
│  └── fresh path: registerRoomHandlers + registerGameHandlers             │
│                                                                          │
│  roomHandlers: room:create → ROOM_JOINED(code, 1, token)                 │
│               room:join   → ROOM_JOINED(code, 2, token) + broadcastState│
│               disconnect  → 90s grace timer + GAME_DISCONNECT_WARNING    │
│                                                                          │
│  gameHandlers: game:move → applyMove → broadcastState                   │
│               game:roll  → applyRoll (PASS/SHOT/HEADER/LOOSE_BALL)      │
│               game:end-turn → applyEndTurn → broadcastState             │
│               game:undo  → applyUndo → broadcastState                   │
│               game:gk-restart → applyGKRestart → broadcastState         │
│               game:start-movement → applyStartMovement → broadcastState  │
└──────────────────────────────────────────────────────────────────────────┘
                          │ io.to(roomCode).emit('game:state', fullSnapshot)
                          ▼ both tabs receive identical full GameState
```

### Recommended Project Structure (additions only)

```
packages/client/src/
├── socket.ts                    # NEW: module singleton (D-02)
├── App.tsx                      # MODIFIED: add useEffect for socket listeners
├── App.module.css               # unchanged
├── store/
│   └── useGameStore.ts          # MODIFIED: add playerSlot, roomCode, setGameState, emitters
├── components/
│   ├── ConnectionStatus.tsx     # NEW: dot + label (connect/reconnecting/disconnected)
│   ├── ConnectionStatus.module.css  # NEW
│   ├── DisconnectBanner.tsx     # NEW: full-width fixed banner
│   ├── DisconnectBanner.module.css  # NEW
│   ├── ActionPanel.tsx          # NEW: Roll, EndTurn, Undo, StartMovement, GKRestart, PassTypeSelector
│   ├── ActionPanel.module.css   # NEW
│   ├── GameBoard.tsx            # MODIFIED: add ConnectionStatus to header, ActionPanel to sidebar
│   ├── HexGrid.tsx              # MODIFIED: click routing by phase (SHOT goal hexes)
│   ├── HexCell.tsx              # MODIFIED: highlightColor prop for SHOT phase red highlight
│   └── LobbyScreen.tsx          # MODIFIED: replace MOCK42 with real socket events
├── mock/                        # unchanged (mock states remain for isolated component testing)
└── utils/
    └── hexToPixel.ts            # unchanged
```

### Pattern 1: Module Singleton Socket

**What:** Socket instance created once at module level, exported as a named constant. Follows the same pattern as `packages/shared/src/pitch.ts` exporting `PITCH_HEXES` as a module-level constant.

**When to use:** Any component or hook that needs to emit events imports the socket directly.

```typescript
// packages/client/src/socket.ts
// Source: Socket.io v4 docs — https://socket.io/docs/v4/client-initialization/
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@counter-attack/shared';

// autoConnect: false — prevents connection before App.tsx mount useEffect (D-02)
// transports: ['websocket'] — no polling; matches server config (STATE.md locked decision)
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

Note on TypeScript generics: `Socket<ServerToClientEvents, ClientToServerEvents>` — types are **reversed** from the server definition. The client receives `ServerToClientEvents` and sends `ClientToServerEvents`. [VERIFIED: socket.io TypeScript docs]

### Pattern 2: Central Listener useEffect in App.tsx

**What:** Single `useEffect` on mount registers all server-event listeners, returns cleanup function calling `socket.off(event, handler)` for every listener.

**When to use:** Only in `App.tsx`. No other component registers socket listeners — they read from Zustand.

```typescript
// packages/client/src/App.tsx
// Source: socket.io/docs/v4/client-socket-instance/
import { useEffect } from 'react';
import { socket } from './socket.js';
import { useGameStore } from './store/useGameStore.js';
import { ServerEvents } from '@counter-attack/shared';

export function App() {
  const setGameState = useGameStore((s) => s.setGameState);
  const setScreen = useGameStore((s) => s.setScreen);
  const setPlayerSlot = useGameStore((s) => s.setPlayerSlot);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setDisconnectWarning = useGameStore((s) => s.setDisconnectWarning);
  const setRoomError = useGameStore((s) => s.setRoomError);
  const setGameError = useGameStore((s) => s.setGameError);

  useEffect(() => {
    socket.connect(); // D-01: explicit connect on mount

    function onGameState(state: GameState) {
      setGameState(state);
      setDisconnectWarning(false); // auto-dismiss banner when state arrives (D-13)
      // If currently WAITING and game starts, advance to GAME_BOARD
      if (useGameStore.getState().screen === 'WAITING') {
        setScreen('GAME_BOARD');
      }
    }

    function onRoomJoined(code: string, slot: 1 | 2, token: string) {
      if (token) localStorage.setItem('ca_session_token', token);
      setRoomCode(code);
      setPlayerSlot(slot);
      const screen = useGameStore.getState().screen;
      if (screen === 'CREATE_ROOM') setScreen('WAITING');
      else if (screen === 'JOIN_ROOM') setScreen('GAME_BOARD');
    }

    function onRoomError(reason: string) {
      setRoomError(reason);
    }
    function onGameError(reason: string) {
      setGameError(reason);
    }
    function onDisconnectWarning() {
      setDisconnectWarning(true);
    }

    socket.on(ServerEvents.GAME_STATE, onGameState);
    socket.on(ServerEvents.ROOM_JOINED, onRoomJoined);
    socket.on(ServerEvents.ROOM_ERROR, onRoomError);
    socket.on(ServerEvents.GAME_ERROR, onGameError);
    socket.on(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);

    return () => {
      // CRITICAL: must use named handlers (not inline lambdas) to match remove
      socket.off(ServerEvents.GAME_STATE, onGameState);
      socket.off(ServerEvents.ROOM_JOINED, onRoomJoined);
      socket.off(ServerEvents.ROOM_ERROR, onRoomError);
      socket.off(ServerEvents.GAME_ERROR, onGameError);
      socket.off(ServerEvents.GAME_DISCONNECT_WARNING, onDisconnectWarning);
    };
  }, []); // empty deps: run once on mount

  // ... render
}
```

### Pattern 3: ConnectionStatus Component (socket.io.on for Manager events)

**What:** Connection status uses the `socket.io` Manager for `reconnect_attempt`, not `socket` directly.

**When to use:** Any component that needs to track reconnection attempts.

```typescript
// Source: socket.io/docs/v4/client-socket-instance/
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
  socket.io.on('reconnect_attempt', onReconnectAttempt); // Manager event, not socket event

  return () => {
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
    socket.io.off('reconnect_attempt', onReconnectAttempt);
  };
}, []);
```

### Pattern 4: Zustand Store Extension

**What:** Additive extensions to `useGameStore` — new fields `playerSlot`, `roomCode`, `disconnectWarning`, `roomError`, `gameError`; new actions `setGameState`, `setPlayerSlot`, `setRoomCode`, `setDisconnectWarning`, `setRoomError`, `setGameError`, `emitMove`, `emitRoll`, `emitEndTurn`, `emitUndo`, `emitGKRestart`, `emitStartMovement`. The existing `movePiece` (local mock mutation) is replaced by `emitMove` (server emit).

**When to use:** Store actions import `socket` directly from `socket.ts`. No socket access in React components except through store actions or the `App.tsx` listener `useEffect`.

### Pattern 5: Undo Button Gating

**What:** Three conditions must all be true to render the Undo button:

1. `playerSlot === (phase === 'MOVEMENT' && movementSlot === 'ATTACKER_4' || movementSlot === 'ATTACKER_2' ? attackingTeam-slot : defending-team-slot)` — simplified by using the `activePlayerSlot` selector
2. `gameState.phase === 'MOVEMENT'`
3. `!gameState.lastDiceRoll` — the authoritative UNDO-02 gate

The button is disabled (not hidden) when `gameState.lastDiceRoll` is set per D-09. However, since D-09 says disabled and D-10 says conditionally rendered, the implementation is: render only for the active player, disable when `lastDiceRoll` set.

```typescript
// In ActionPanel.tsx
const isActivePlayer =
  playerSlot !== null &&
  ((movementSlot !== 'DEFENDER_5' && playerSlot === 1 && attackingTeam === 'home') ||
    (movementSlot !== 'DEFENDER_5' && playerSlot === 2 && attackingTeam === 'away') ||
    (movementSlot === 'DEFENDER_5' && playerSlot === 1 && attackingTeam === 'away') ||
    (movementSlot === 'DEFENDER_5' && playerSlot === 2 && attackingTeam === 'home'));

// Simpler: compare playerSlot to the slot for the active team
// slot 1 = 'home', slot 2 = 'away'
const myTeam: 'home' | 'away' = playerSlot === 1 ? 'home' : 'away';
const actingTeam =
  movementSlot === 'DEFENDER_5' ? (attackingTeam === 'home' ? 'away' : 'home') : attackingTeam;
const isActivePlayer = myTeam === actingTeam;

// Undo is rendered only for active player in MOVEMENT; disabled if lastDiceRoll set
const showUndo = phase === 'MOVEMENT' && isActivePlayer;
const undoDisabled = !!lastDiceRoll; // UNDO-02
```

### Pattern 6: Vite Dev Proxy

**What:** Configure Vite dev server to proxy `/socket.io` requests to the Node server, avoiding CORS in development. The Socket.io client is configured with `VITE_SOCKET_URL` env var; for local dev the URL is `http://localhost:3001` (same as where the client dev server proxies to).

Note: With `transports: ['websocket']` on the client, the Socket.io client skips the HTTP polling upgrade and connects directly via WebSocket. This means the Vite proxy is **optional** (the client sets an explicit absolute URL to `localhost:3001`). The proxy is useful when `VITE_SOCKET_URL` is not set and the client defaults to same-origin, but since the client uses an explicit URL, CORS on the server (`cors: { origin: '*' }` in dev) already handles cross-origin. The proxy is still recommended as a belt-and-suspenders measure.

```typescript
// packages/client/vite.config.ts
// Source: vite.dev/config/server-options.html
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

### Anti-Patterns to Avoid

- **Inline lambdas in socket.on():** `socket.on('game:state', (state) => ...)` with an inline arrow cannot be removed by `socket.off('game:state', sameArrow)` because the references differ. Always use named handlers. [VERIFIED: socket.io docs]
- **Reading `socket.rooms` in disconnect handler:** `socket.rooms` may be async-emptied by the time the handler runs. Server already uses `socket.data.roomCode` — never change this. [VERIFIED: server code pattern]
- **`io.to(roomCode).emit` on server for targeted single-socket messages:** Use `socket.emit` to target one socket, `socket.to(roomCode).emit` to broadcast to others. The server already follows this pattern in `roomHandlers.ts`.
- **Calling `socket.connect()` more than once:** `socket.connect()` is idempotent when `autoConnect: false` but calling it inside event handlers or multiple `useEffect` calls creates duplicate connections. Only call it in `App.tsx` mount effect.
- **Registering socket listeners inside child components:** Every component mount/unmount creates a new listener. Only `App.tsx` registers server event listeners; components read from Zustand.
- **`movePiece` local mutation remaining after Phase 7:** The existing `movePiece` function in `useGameStore.ts` does local state mutation (mock path). Phase 7 replaces this with `emitMove` which calls `socket.emit(ClientEvents.GAME_MOVE, pieceId, to)`. The local mutation must be removed; state updates only come via `game:state` broadcasts.

---

## Don't Hand-Roll

| Problem                             | Don't Build                               | Use Instead                                                                               | Why                                                                                 |
| ----------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| WebSocket reconnection with backoff | Custom retry loop with setTimeout         | Socket.io built-in reconnection (enabled by default)                                      | Socket.io handles exponential backoff, max retries, jitter automatically            |
| Session token reconnect             | Custom handshake protocol                 | `socket.handshake.auth` (already wired in server)                                         | Server's `sessionMiddleware` already reads `auth.sessionToken`                      |
| Connection state tracking           | Polling `socket.connected` on an interval | Socket.io lifecycle events (`connect`, `disconnect`, `socket.io.on('reconnect_attempt')`) | Events are push-based; polling wastes cycles                                        |
| Full-snapshot state sync            | Differential patch / CRDT                 | `store.setGameState(state)` replacing entire gameState                                    | ARCH-04 is already full-snapshot; patching adds complexity with no benefit          |
| Undo stack                          | Client-side undo history                  | `game:undo` → server `applyUndo()` → `game:state` broadcast                               | Server already implements `applyUndo()` correctly; client undo adds divergence risk |

---

## Gap Analysis: GAME_SHOT Event

The `07-UI-SPEC.md` Board Click Routing Contract table specifies:

> `SHOT` phase + opponent goal hex → `socket.emit(GAME_SHOT, { targetHex: hex })`

However:

- `ClientEvents` in `packages/shared/src/events.ts` has NO `GAME_SHOT` constant.
- `gameHandlers.ts` has NO `game:shot` handler.
- `ClientToServerEvents` interface has NO `game:shot` signature.
- The `applyRoll()` engine function handles the `SHOT` phase when `game:roll` is received.

The `SHOT` phase in the current FSM means the player is rolling dice for a shot duel (attacker Shooting + dice vs GK Saving + dice). The target hex selection is an additional input that the engine does not currently consume.

**Two resolution paths:**

1. **`game:roll` carries the shot target** — extend `ClientToServerEvents['game:roll']` to accept an optional `targetHex?: HexCoord` parameter, and update `gameHandlers.ts` and `applyRoll()` to consume it for SHOT phase. Minimal server change.
2. **New `game:shot` event** — add `GAME_SHOT: 'game:shot'` to `ClientEvents`, add `ClientToServerEvents['game:shot']`, add handler in `gameHandlers.ts` that validates the target hex and transitions state before `game:roll`.

The UI-SPEC author assumed Path 2. The existing server implementation implies Path 1 is simpler (one handler, not two). This is an open question for the planner to resolve — see Open Questions.

---

## Runtime State Inventory

> Phase 7 is not a rename/refactor phase. No runtime state migration required. The mock states in `packages/client/src/mock/` remain as-is for isolated unit testing; they are not removed in Phase 7.

Skipped — greenfield wiring phase, not a rename/refactor.

---

## Common Pitfalls

### Pitfall 1: Inline Lambda Prevents socket.off Cleanup

**What goes wrong:** `socket.on('game:state', (s) => store.setGameState(s))` registers a new anonymous function reference. `socket.off('game:state', (s) => store.setGameState(s))` creates a different reference and removes nothing. Memory leak + duplicate handler accumulation on re-render.

**Why it happens:** Arrow functions declared inline create a new function object on every render.

**How to avoid:** Declare handlers as named `function` declarations inside the `useEffect` body. Named functions get captured by the cleanup closure with the same reference. [VERIFIED: socket.io docs cleanup pattern]

**Warning signs:** Action log entries appearing twice; state updates doubling on each game action.

### Pitfall 2: `socket.id` Used as Stable Player Identity

**What goes wrong:** After a disconnect/reconnect, `socket.id` is a new string. Using `socket.id` to track who is Player 1 vs Player 2 breaks across reconnects.

**Why it happens:** `socket.id` is generated fresh per WebSocket connection.

**How to avoid:** Use `sessionToken` stored in `localStorage` (`ca_session_token`). The server's `sessionMiddleware` already maps tokens to slots. Client reads its slot from `room:joined` response and stores in Zustand. [VERIFIED: server sessionMiddleware implementation]

**Warning signs:** After reconnect, player sees wrong team controls or opponent's action panel.

### Pitfall 3: Duplicate Handler Registration on Reconnect

**What goes wrong:** Socket.io fires the `connect` event on initial connection AND on every successful reconnect. If socket event handlers are registered inside a `connect` listener, they get registered N times for N reconnects.

**Why it happens:** `connect` re-fires after reconnection. Any `socket.on(event, handler)` inside a `connect` handler stacks duplicates.

**How to avoid:** Register all server event handlers once in the `App.tsx` mount `useEffect` with empty deps array. Do not register game event listeners inside the `connect` listener. [VERIFIED: socket.io docs — "connect event fires on initial connection and reconnection"]

**Warning signs:** State updates doubling after a reconnect cycle.

### Pitfall 4: `movePiece` Local Mutation Left in Store

**What goes wrong:** `HexGrid.tsx` currently calls `movePiece(hex)` on highlighted hex click, which mutates local mock state. After Phase 7, `movePiece` must be replaced by `emitMove(pieceId, hex)` which emits `game:move` to the server. If `movePiece` is not fully replaced, the piece appears to move locally but the server state never updates, and the next `game:state` broadcast snaps the piece back.

**Why it happens:** Phase 6 intentionally used local mutation. The replacement path is D-08.

**How to avoid:** Remove `movePiece` from the store type entirely (or rename it to `emitMove`). Update `HexGrid.tsx` to call `emitMove`. After emit, the piece will snap to server-confirmed position via `game:state`.

**Warning signs:** Piece appears to move, then jumps back after any server action.

### Pitfall 5: `isProcessing` Mutex — No Retry

**What goes wrong:** The server's `isProcessing` mutex silently drops duplicate events (the `if (!room || room.isProcessing) return` guard). If the client retries on no response (e.g., via setTimeout + re-emit), it may fire into a legitimate later action.

**Why it happens:** Developer adds client-side retry logic assuming the server lost the event.

**How to avoid:** Per UI-SPEC §ActionPanel: "No spinner or loading state required. The isProcessing mutex on the server drops duplicates silently. Do not implement client-side debounce or spinner for Phase 7." Do not add retry logic. [VERIFIED: server gameHandlers.ts isProcessing pattern, UI-SPEC spec]

**Warning signs:** Actions firing twice in the action log.

### Pitfall 6: `socket.io.on` vs `socket.on` for Reconnect Events

**What goes wrong:** `socket.on('reconnect_attempt', ...)` does NOT fire. The `reconnect_attempt` event lives on the Manager (`socket.io`), not on the Socket instance.

**Why it happens:** Confusing socket vs manager event namespaces in Socket.io v4.

**How to avoid:** Use `socket.io.on('reconnect_attempt', handler)` and `socket.io.off('reconnect_attempt', handler)` for Manager-level events. Use `socket.on('connect', ...)` and `socket.on('disconnect', ...)` for socket-level events. [VERIFIED: socket.io/docs/v4/client-socket-instance/]

**Warning signs:** Connection status indicator stuck on "Reconnecting…" forever after successful reconnect.

### Pitfall 7: WaitingScreen Auto-Dismiss via wrong event

**What goes wrong:** Player 1 is on `WAITING` screen. The auto-dismiss to `GAME_BOARD` must trigger when `game:state` arrives (not `room:joined`). If triggered by `room:joined`, it fires when Player 2 sends the join — but at that point the `game:state` broadcast hasn't yet completed. Race condition: screen switches before game state is populated.

**Why it happens:** `room:joined` is broadcast to Player 1 when Player 2 joins, but `broadcastState` fires immediately after in the same synchronous tick. The `game:state` event is the reliable signal.

**How to avoid:** In the `game:state` handler: `if (store.getState().screen === 'WAITING') setScreen('GAME_BOARD')`. [VERIFIED: roomHandlers.ts — `broadcastState(io, room)` called after `socket.to(normalizedCode).emit(ServerEvents.ROOM_JOINED, ...)`]

### Pitfall 8: `movedPieceIds` Not Used for Piece Clickability

**What goes wrong:** Developer gates piece clickability on `piece.teamId === activeTeam` (Phase 6 check). But in Phase 7 with real server state, a piece may have already moved in this slot (tracked in `movedPieceIds`). The server rejects attempts to move a piece that's already moved — but the client still shows it as clickable, creating a confusing "click does nothing" UX.

**Why it happens:** Phase 6 used mock state without `movedPieceIds` enforcement on the client.

**How to avoid:** When computing whether a piece is clickable in `HexGrid` during `MOVEMENT` phase, also check: `!gameState.movedPieceIds.includes(piece.id)`. The server still validates this but the client should not offer false clickability. [VERIFIED: GameState type — `movedPieceIds: readonly string[]`]

---

## Code Examples

### socket.ts — Module Singleton

```typescript
// packages/client/src/socket.ts
// Source: https://socket.io/docs/v4/client-initialization/ + https://socket.io/docs/v4/typescript/
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@counter-attack/shared';

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

### useGameStore.ts — Extended Store Shape

```typescript
// Additions to GameStore type in packages/client/src/store/useGameStore.ts
export type GameStore = {
  // --- existing fields ---
  gameState: GameState;
  screen: Screen;
  selectedPieceId: string | null;
  validMoveHexes: HexCoord[];
  // --- Phase 7 additions ---
  playerSlot: 1 | 2 | null; // D-04
  roomCode: string | null; // D-04
  disconnectWarning: boolean; // D-13
  roomError: string | null; // For inline lobby error display
  gameError: string | null; // For inline action panel error display
  // --- actions ---
  setScreen: (s: Screen) => void;
  selectPiece: (id: string) => void;
  // movePiece REMOVED — replaced by emitMove
  setGameState: (state: GameState) => void; // Called from game:state handler
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
};
```

### ActionPanel — Undo Gating

```typescript
// packages/client/src/components/ActionPanel.tsx
// Derives active-player status from playerSlot + GameState
function useIsActivePlayer(): boolean {
  const playerSlot = useGameStore((s) => s.playerSlot);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const movementSlot = useGameStore((s) => s.gameState.movementSlot);

  if (playerSlot === null) return false;
  const myTeam: 'home' | 'away' = playerSlot === 1 ? 'home' : 'away';
  const actingTeam: 'home' | 'away' =
    movementSlot === 'DEFENDER_5'
      ? attackingTeam === 'home' ? 'away' : 'home'
      : attackingTeam;
  return myTeam === actingTeam;
}

// Undo button — UNDO-01, UNDO-02, UNDO-03
const phase = useGameStore((s) => s.gameState.phase);
const lastDiceRoll = useGameStore((s) => s.gameState.lastDiceRoll);
const emitUndo = useGameStore((s) => s.emitUndo);
const isActive = useIsActivePlayer();

// Conditionally rendered (D-10): only for active player during MOVEMENT
// Disabled (D-09): when lastDiceRoll is set
{phase === 'MOVEMENT' && isActive && (
  <button
    className={styles.ctaButton}
    disabled={!!lastDiceRoll}
    onClick={emitUndo}
  >
    Undo Move
  </button>
)}
```

### LobbyScreen — Real Socket Wiring

```typescript
// packages/client/src/components/LobbyScreen.tsx
// CreateRoomScreen — replace MOCK42 with socket emit
function CreateRoomScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const roomCode = useGameStore((s) => s.roomCode);
  const { socket } = ...; // import from socket.ts

  useEffect(() => {
    socket.emit(ClientEvents.ROOM_CREATE);
    // room:joined handler in App.tsx will call setRoomCode + setScreen('WAITING')
  }, []);

  return (
    <>
      <h1>Create Room</h1>
      <div className={styles.roomCode}>
        {roomCode ?? <span style={{ color: '#a0a0a0', fontWeight: 400 }}>Generating…</span>}
      </div>
      {/* Copy button reads from store.roomCode, not MOCK42 */}
    </>
  );
}
```

---

## State of the Art

| Old Approach                              | Current Approach                               | When Changed | Impact                                                       |
| ----------------------------------------- | ---------------------------------------------- | ------------ | ------------------------------------------------------------ |
| `movePiece` local mock mutation           | `emitMove` → server → `game:state` broadcast   | Phase 7      | All state is server-authoritative (ARCH-01)                  |
| `MOCK42` hardcoded room code              | Real room code from `room:joined` event        | Phase 7      | Real two-player sessions                                     |
| `screen` changes via `setScreen` directly | `setScreen` called from socket event handlers  | Phase 7      | Screen routing driven by server events, not UI actions       |
| `gameState` initialized from mock         | `gameState` replaced by `game:state` broadcast | Phase 7      | Client never owns game state; always server-authoritative    |
| HexCell highlight: one color (gold)       | HexCell highlight: color prop (gold or red)    | Phase 7      | SHOT phase uses red for goal hex highlighting (UI-SPEC D-06) |

**Deprecated/outdated:**

- `mockMovementState` as initial Zustand state: The initial `gameState` in the store should remain `mockMovementState` for component isolation tests, but the socket `game:state` handler replaces it immediately upon joining a real session. This is not removed — it remains as the test default.
- `movePiece` action: Replaced by `emitMove`. The existing implementation in `useGameStore.ts` lines 59–70 must be removed and replaced.

---

## Assumptions Log

| #   | Claim                                                                                                                        | Section                     | Risk if Wrong                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `GAME_SHOT` event does not exist and the SHOT click-to-goal interaction should use `game:roll` (not a new `game:shot` event) | Gap Analysis, Code Examples | If a new `game:shot` event IS needed, planner must add it to `events.ts`, `ClientToServerEvents`, and `gameHandlers.ts` before wiring the client click handler                      |
| A2  | The Vite proxy is optional when `VITE_SOCKET_URL` is set explicitly and CORS is `*` in dev                                   | Pattern 6                   | If `rewriteWsOrigin` causes issues in some browsers, the proxy becomes required; but with `transports: ['websocket']` the Socket.io handshake never hits the Vite dev server at all |
| A3  | `socket.io.on('reconnect_attempt', ...)` is the correct Manager-level event in socket.io-client v4.8                         | Pitfall 6                   | Minor: if the event name changed, ConnectionStatus stays on "Reconnecting…" incorrectly                                                                                             |

---

## Open Questions (RESOLVED)

1. **`GAME_SHOT` event vs `game:roll` for SHOT phase click**
   - What we know: UI-SPEC specifies `socket.emit(GAME_SHOT, { targetHex: hex })`. But `GAME_SHOT` does not exist in `events.ts` or server handlers. The `SHOT` phase resolves via `game:roll` in `applyRoll()`.
   - What's unclear: Does the goal hex click need to set a `shotTarget` field on GameState first (before rolling), or can the roll proceed without a target and the target is cosmetic only for Phase 7?
   - **RESOLVED:** Shot target stored in local React state (`setShotTarget`) only — no new `GAME_SHOT` event created. The Roll button drives SHOT duel resolution via `game:roll` as usual. Target hex is cosmetic/UX-only for Phase 7; server does not consume it. Full server-side shot targeting deferred to Phase 8.

2. **`activeTeam` vs derived team in store — which field to use?**
   - What we know: `GameState` has both `activeTeam: 'home' | 'away'` and `attackingTeam: 'home' | 'away'` + `movementSlot`. The `isActivePlayer` logic in `gameHandlers.ts` derives the acting team from `attackingTeam + movementSlot`. The `activeTeam` field exists in `GameState` but is set in `buildInitialGameState` and updated in `advanceMovementSlot`.
   - What's unclear: Can the client use `gameState.activeTeam` directly (simpler) or must it re-derive from `attackingTeam + movementSlot`?
   - **RESOLVED:** Use `gameState.activeTeam` directly — the server maintains this field correctly across all state transitions (including `applyEndTurn` → PASS phase via `advanceMovementSlot`). No client-side re-derivation needed.

---

## Environment Availability

| Dependency             | Required By           | Available | Version            | Fallback |
| ---------------------- | --------------------- | --------- | ------------------ | -------- |
| Node.js                | Server dev server     | ✓         | 22 LTS             | —        |
| pnpm                   | Monorepo package mgmt | ✓         | 9.x                | —        |
| socket.io-client 4.8.3 | Client socket wiring  | ✓         | ^4.8.3 (installed) | —        |
| Vite 5.x               | Client dev + build    | ✓         | ^5.4.21            | —        |
| vitest                 | Unit test runner      | ✓         | ^2.1.9             | —        |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** none — all required tools already installed.

---

## Validation Architecture

### Test Framework

| Property           | Value                                            |
| ------------------ | ------------------------------------------------ |
| Framework          | Vitest 2.1.9                                     |
| Config file        | packages/client/vite.config.ts (vitest inferred) |
| Quick run command  | `pnpm --filter @counter-attack/client test`      |
| Full suite command | `pnpm -r test`                                   |

### Phase Requirements → Test Map

| Req ID  | Behavior                                              | Test Type     | Automated Command                                                                 | File Exists?                   |
| ------- | ----------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- | ------------------------------ |
| UNDO-01 | Active player can undo movement steps within turn     | unit          | `pnpm --filter @counter-attack/client test -- --testNamePattern="emitUndo"`       | ❌ Wave 0                      |
| UNDO-02 | Undo unavailable after dice roll (lastDiceRoll set)   | unit          | `pnpm --filter @counter-attack/client test -- --testNamePattern="undo.*disabled"` | ❌ Wave 0                      |
| UNDO-03 | Opposing player tab shows no Undo control             | unit          | `pnpm --filter @counter-attack/client test -- --testNamePattern="playerSlot"`     | ❌ Wave 0                      |
| UNDO-04 | Undo restores piece position, decrements move counter | unit (server) | `pnpm --filter @counter-attack/server test -- --testNamePattern="applyUndo"`      | ✅ exists (gameEngine.test.ts) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/client test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/client/src/store/useGameStore.test.ts` — extend existing test file with: `setGameState` action, `playerSlot`/`roomCode` setters, `emitMove` replaces `movePiece`, undo gating logic (UNDO-01, UNDO-02, UNDO-03)
- [ ] `packages/client/src/components/ActionPanel.test.tsx` — new file; tests for: Undo button visibility by playerSlot, Undo disabled when lastDiceRoll set, Roll button visibility by phase

_(If socket listener wiring is tested, use `vi.fn()` mocked socket — do not require a live server for unit tests.)_

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                  |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | No new auth in Phase 7; session token is server-generated, stored in localStorage                                                                 |
| V3 Session Management | yes     | Session token sent in `socket.handshake.auth`; server validates via `sessionMiddleware`; token never logged or included in `game:state` broadcast |
| V4 Access Control     | yes     | Server enforces WRONG_TEAM on all game events; client render gating is UX only, not security                                                      |
| V5 Input Validation   | yes     | `socket.emit` payloads: `pieceId` (string), `to` (HexCoord), `choice` (enum) — all validated server-side in existing handlers                     |
| V6 Cryptography       | no      | No new crypto; session tokens are `randomUUID()` (already implemented)                                                                            |

### Known Threat Patterns

| Pattern                             | STRIDE    | Standard Mitigation                                                                              |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| Client claims opponent's playerSlot | Spoofing  | Server assigns slot; client never sends slot claim; `socket.data.playerSlot` is server-set       |
| Emitting game events out of phase   | Tampering | Server WRONG_PHASE guard on all handlers; client guards are UX only                              |
| localStorage token theft (XSS)      | Elevation | No user input rendered as HTML; React JSX escapes all content; token has 90s grace value only    |
| Replaying captured sessionToken     | Elevation | Server uses `findPlayerByToken` which is a point-in-time lookup; deleted rooms invalidate tokens |

---

## Sources

### Primary (HIGH confidence)

- Socket.io v4 client initialization docs — `https://socket.io/docs/v4/client-initialization/` — autoConnect, transports, auth options
- Socket.io v4 TypeScript docs — `https://socket.io/docs/v4/typescript/` — `Socket<ServerToClientEvents, ClientToServerEvents>` generic order
- Socket.io v4 client socket instance docs — `https://socket.io/docs/v4/client-socket-instance/` — `connect`, `disconnect`, `socket.io.on('reconnect_attempt')` pattern
- Vite server proxy docs — `https://vite.dev/config/server-options.html` — `ws: true` proxy config
- Codebase: `packages/shared/src/events.ts` — all ClientEvents, ServerEvents, typed interfaces
- Codebase: `packages/shared/src/types.ts` — GameState shape including `lastDiceRoll`, `movedPieceIds`, `activeTeam`
- Codebase: `packages/server/src/gameEngine.ts` — `applyUndo()` implementation, lock conditions
- Codebase: `packages/server/src/gameHandlers.ts` — `game:undo` handler wired with all guards
- Codebase: `packages/server/src/roomHandlers.ts` — `room:joined` shape `(roomCode, slot, sessionToken)`, disconnect grace timer
- Codebase: `packages/server/src/createServer.ts` — reconnect path: session restore, `socket.join`, re-emit state
- Codebase: `packages/client/src/store/useGameStore.ts` — current store shape (to be extended)
- Codebase: `packages/client/src/components/*` — all existing Phase 6 components

### Secondary (MEDIUM confidence)

- Codebase gap analysis: `GAME_SHOT` event referenced in UI-SPEC but absent from `events.ts` and server handlers — confirmed by `grep` across all packages

### Tertiary (LOW confidence — none)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages already installed; no research needed for new packages
- Architecture: HIGH — server code fully verified by reading actual implementation; client wiring follows directly from server API shape
- Pitfalls: HIGH — most pitfalls derived from actual code review and socket.io docs; one [ASSUMED] on reconnect_attempt event name
- Undo architecture: HIGH — `applyUndo()` read in full; `game:undo` handler verified in `gameHandlers.ts`
- GAME_SHOT gap: MEDIUM — confirmed absence by grep, but resolution path needs planner decision

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (stable — socket.io v4 and Vite 5 are not fast-moving)
