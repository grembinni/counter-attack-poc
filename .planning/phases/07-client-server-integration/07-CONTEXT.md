# Phase 7: Client-Server Integration - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the React client's Zustand store to the live Socket.io server, replacing all mock state with server-broadcast state. Deliverables: lobby flow via real socket events (room:create, room:join, room:joined), board driven by game:state broadcasts, full click interaction for movement + passing + shooting, all action buttons (Roll, End Turn, Undo, GK restart, Start Movement), connection status indicator, and opponent-disconnect banner. After this phase, two browser tabs can create/join a room, play piece movement, complete a pass, and execute a shot/save — without a server restart.

**Out of scope for Phase 7:**

- Match lifecycle: action counters, halves, added time, kick off procedure, final score (Phase 8)
- Post-game replay (Phase 8)
- AWS deployment (Phase 9)
- Animations — static state transitions only (out of scope for v1)
- Mobile layout — desktop-first only (out of scope for v1)

</domain>

<decisions>
## Implementation Decisions

### Socket Lifecycle

- **D-01:** Socket connects **on app load** — the socket is created once when the React app mounts, before any lobby interaction. One socket lifetime per session; no deferred connect.
- **D-02:** The socket instance lives in a **module singleton**: `packages/client/src/socket.ts` creates the socket with `autoConnect: false`, exports it, and `socket.connect()` is called inside App.tsx's `useEffect` on mount.
- **D-03:** All `server:*` socket event listeners (`game:state`, `room:joined`, `room:error`, `game:error`, `game:disconnect-warning`) are registered in **one central `useEffect` in `App.tsx`** on mount and cleaned up on unmount. Zustand `setState` is called from each handler. This prevents double-registration across re-renders (Phase 6 pitfall: always return `socket.off(event, handler)` from every useEffect that registers a socket listener).
- **D-04:** The Zustand store gains two new fields: `playerSlot: 1 | 2 | null` and `roomCode: string | null`. These are populated when `room:joined` is received and used to gate which controls render for this player.

### Click Interaction Scope

- **D-05:** **Passing — full flow wired:** Pass type selection (Standard, First-time, High, Long) is available as a UI control during the appropriate phase. Player then clicks a destination hex to set the pass target. Followed by a Roll button to trigger `game:roll` for accuracy resolution.
- **D-06 (confirmed implementation decision — revised 2026-05-31):** **Shooting — click goal hex emits `game:shot`.** When `GameState.phase === 'SHOT'`, opponent goal hexes become clickable (highlighted red). The player clicks their intended target hex within the goal area, and **the client emits `game:shot` (`ClientEvents.GAME_SHOT`) with the target `HexCoord`** to the server. The server's `game:shot` handler (added in plan 07-04) **records the target** on the room (`room.shotTarget`) for UX/broadcast purposes after guarding `phase === 'SHOT'`, active-player, and HexCoord payload shape. **Dice resolution is unchanged:** the SHOT duel still resolves shooter-vs-GK from dice only when the Roll button fires `game:roll` → `applyRoll`; the recorded target is never consumed by resolution. This supersedes the earlier RESEARCH Open Q1 "local-state-only" resolution, which stored the target in local React state and never emitted it — a context-compliance gap flagged by the checker. Full server-side shot-targeting (target consumed by resolution) remains deferred to Phase 8.
- **D-07:** **All action buttons wired in Phase 7:**
  - **Roll button** — visible during `PASS`, `SHOT`, `HEADER`, `LOOSE_BALL` phases; emits `game:roll`. Only rendered for the active player.
  - **End Turn button** — visible during `MOVEMENT` phase; emits `game:end-turn`. Only rendered for the active player.
  - **GK restart buttons** (kick / throw / movement) — visible during `GK_RESTART` phase; emit `game:gk-restart` with choice payload. Only rendered for the GK's team.
  - **Start Movement button** — visible during `KICK_OFF` phase; emits `game:start-movement`. Only rendered for the attacking team.

### Undo Button

- **D-08:** The Undo button is placed in the **action panel alongside End Turn** (right-side control panel). Both are movement-phase controls; grouping them makes their relationship clear.
- **D-09:** Undo is **disabled when `GameState.lastDiceRoll` is set** (UNDO-02). `lastDiceRoll` in `GameState` (Phase 5 D-11) is the authoritative signal that dice have been committed. No separate `undoAvailable` flag needed.
- **D-10:** The Undo button is **conditionally rendered** — it does not appear in the opposing player's tab at all (UNDO-03). Logic: render only when `playerSlot === activePlayerSlot` during `MOVEMENT` phase.

### Board Orientation

- **D-11:** **No board flip** — both players see the same orientation: home goal at left (q=0), away goal at right (q=36). No SVG transform or coordinate mirroring needed. Each player identifies their side via the TurnIndicator showing which team they control.

### Connection Status

- **D-12 (Claude's discretion):** Connection status indicator shows green (connected), yellow (reconnecting), red (disconnected). Driven by Socket.io `connect`, `reconnect_attempt`, and `disconnect` events. Placement and styling at Claude's discretion — must be visible without obstructing the board.
- **D-13 (Claude's discretion):** Opponent-disconnect banner displays when `game:disconnect-warning` is received. Dismissed automatically if the opponent reconnects (next `game:state` broadcast implicitly confirms reconnection). Banner stays visible during the 90-second grace period.

### Claude's Discretion

- Pass type selector UI: Claude picks the control (buttons, dropdown, or toggle group) as long as it's accessible and doesn't block the board.
- Action panel layout: Claude organises Roll, End Turn, Undo, Start Movement, and GK restart controls in a way that makes the current active action obvious.
- VITE_SOCKET_URL env var for server URL — Claude wires this from Vite's `import.meta.env` so the URL can be configured without code changes.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal and Requirements

- `.planning/ROADMAP.md` §Phase 7 — goal, success criteria (5 criteria), "UI hint: yes"
- `.planning/REQUIREMENTS.md` §Undo — UNDO-01, UNDO-02, UNDO-03, UNDO-04 (undo rules)
- `.planning/REQUIREMENTS.md` §Connection & Lobby — CONN-01..04 (room create/join/start/reject)
- `.planning/REQUIREMENTS.md` §Technical Architecture — ARCH-01, ARCH-04 (server-authoritative, full-snapshot broadcast)

### Prior Phase Decisions

- `.planning/phases/06-react-hex-grid-renderer/06-CONTEXT.md` — D-07 (validateMove client-side on click), D-08 (Phase 7 replaces local mutation with broadcast path), D-10 (Zustand holds GameState), D-12 (screen routing in Zustand store, no React Router)
- `.planning/phases/05-dice-resolver-all-resolution-branches/05-CONTEXT.md` — D-10/D-11 (lastDiceRoll shape in GameState, single broadcast model), D-22..D-26 (GK restart event and choices)

### Shared Types and Events

- `packages/shared/src/events.ts` — All `ClientEvents`, `ServerEvents`, `ClientToServerEvents`, `ServerToClientEvents` typed interfaces. Phase 7 emits all ClientEvents (including the new `GAME_SHOT`, D-06) and listens on all ServerEvents.
- `packages/shared/src/types.ts` — `GameState` (including `lastDiceRoll`, `phase`, `movementSlot`, `attackingTeam`), `PlayerPiece`, `GamePhase`. Phase 7 reads these to gate controls.

### Existing Client Code (Phase 7 extends these)

- `packages/client/src/store/useGameStore.ts` — Current Zustand store. Phase 7 adds `playerSlot`, `roomCode`, replaces `movePiece` local-mutation with server-broadcast path, and adds socket action emitters.
- `packages/client/src/components/LobbyScreen.tsx` — Contains mock room code (`MOCK42`). Phase 7 replaces with real `room:create` / `room:join` socket calls and wires `room:joined` response.
- `packages/client/src/App.tsx` — Entry point for the single central `useEffect` (D-03).

### Server Handlers (Phase 7 client must emit correctly)

- `packages/server/src/roomHandlers.ts` — `room:create`, `room:join` handlers; `room:joined(roomCode, slot, sessionToken)` response shape; `game:disconnect-warning` emit on disconnect.
- `packages/server/src/gameHandlers.ts` — All `game:*` handler guards (WRONG_PHASE, WRONG_TEAM errors); `game:state` broadcast shape via `broadcastState`. Phase 7 adds the `game:shot` handler here (plan 07-04, D-06).

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `useGameStore` (`packages/client/src/store/useGameStore.ts`) — Zustand store with `gameState`, `screen`, `selectedPieceId`, `validMoveHexes`. Phase 7 adds `playerSlot`, `roomCode`; replaces `movePiece` with server-emit path; adds `setGameState` for `game:state` handler.
- `LobbyScreen` (`packages/client/src/components/LobbyScreen.tsx`) — Create/Join/Waiting sub-screens fully built. Only `MOCK42` and `setScreen` calls need replacement with socket events and `room:joined` handler.
- `App.tsx` — Already imports `useGameStore` and routes by `screen`. Central `useEffect` for socket listeners goes here.
- `validateMove()` + `hexesInRange()` — Client-side valid-move highlighting already wired to `selectPiece` in the store. No changes needed for Phase 7 (D-08).
- `HexGrid` + `HexCell` — Click handler infrastructure already exists via `onHexClick`. Phase 7 adds conditional logic: during `SHOT` phase, only goal hexes are clickable and clicking one emits `game:shot` (D-06).

### Established Patterns

- **Module singleton exports** — `packages/shared/src/pitch.ts` exports `PITCH_HEXES`, `PITCH_REGIONS` as module-level constants. `socket.ts` follows the same singleton export pattern.
- **Zustand per-slice selectors** — Existing `HexGrid` uses `useGameStore((s) => s.selectedPieceId)` etc. to prevent whole-component re-renders (Phase 6 Pitfall 6). All new components must follow this.
- **Named exports, no defaults** — All shared modules and client components use named exports.
- **`transports: ['websocket']` only** — Socket.io client must be configured with `transports: ['websocket']` (from STATE.md). No polling fallback.
- **`socket.off(event, handler)` in cleanup** — Every `useEffect` that registers a socket listener must return a cleanup that calls `socket.off(event, handler)`. Phase 6 pitfall explicitly warns about this.
- **isProcessing mutex on server** — All server handlers drop duplicate events silently when `room.isProcessing` is true. Client should not retry on no-response; show a spinner instead.

### Integration Points

- `App.tsx` `useEffect` → `socket.connect()` on mount → registers all ServerEvents listeners → calls `store.setGameState`, `store.setScreen`, `store.setPlayerSlot` etc.
- `LobbyScreen` Create button → `socket.emit(ClientEvents.ROOM_CREATE)` → server emits `room:joined(code, 1, token)` → store saves `roomCode`, `playerSlot` → `setScreen('WAITING')`.
- `LobbyScreen` Join submit → `socket.emit(ClientEvents.ROOM_JOIN, code)` → server emits `room:joined(code, 2, token)` + `game:state` → store saves slot → `setScreen('GAME_BOARD')`.
- `HexCell` `onHexClick` → during MOVEMENT: `store.selectPiece()` or `store.emitMove()` → `socket.emit(ClientEvents.GAME_MOVE, pieceId, hex)`; during SHOT on a goal hex: `socket.emit(ClientEvents.GAME_SHOT, hex)` (D-06).
- Action panel → during MOVEMENT: End Turn button → `socket.emit(ClientEvents.GAME_END_TURN)`; Undo button (if active player + no lastDiceRoll) → `socket.emit(ClientEvents.GAME_UNDO)`.

</code_context>

<specifics>
## Specific Ideas

- **`VITE_SOCKET_URL` env var**: Server URL injected via `import.meta.env.VITE_SOCKET_URL` at build time. Default to `http://localhost:3000` for local dev. This is the ARCH-05/ARCH-06 preparation — no hardcoded URLs in the build artefact.
- **`autoConnect: false` on socket creation**: Prevents the socket from connecting before `socket.connect()` is explicitly called in the App.tsx mount `useEffect`. Avoids a race where the socket connects before React has rendered.
- **Session token in `localStorage`**: `room:joined` delivers a `sessionToken`. Store it in `localStorage` under a key like `ca_session_token` for reconnect via `socket.handshake.auth.sessionToken`. The server's session middleware already validates this.
- **`game:state` handler replaces all mock state**: On every `game:state` event, `store.setGameState(state)` replaces the entire `gameState` in the Zustand store — consistent with ARCH-04 full-snapshot broadcast. Client never patches state.
- **Pass type as a Phase 7 scope note**: Full pass flow (D-05) requires knowing which pass types are available in the current `GameState.phase`. The server's `gameEngine.ts` drives these transitions. Phase 7 only needs to wire the UI for whichever pass type the current phase allows — the server enforces which pass types are legal.
- **`game:shot` records target only (D-06)**: The new `game:shot` event/handler (plan 07-04) records the shooter's target hex on `room.shotTarget` for UX/broadcast. It deliberately does NOT change dice resolution — `applyRoll`'s SHOT branch is unchanged and never reads `room.shotTarget`. Full target-aware resolution is a Phase 8 extension.

</specifics>

<deferred>
## Deferred Ideas

- **Heading duel click flow**: Header interaction (player clicks a challenger after a High Pass) — deferred to a follow-up task if heading duels are needed for the Phase 7 success criteria. The success criteria mention movement + passing + shooting only.
- **Snapshot interaction**: Click-to-snapshot during movement phase in the penalty area — deferred to Phase 8 or a follow-up. MOVE-07 / SNAP-01 are separate from the Phase 7 success criteria.
- **GK quick-throw `targetHex` delivery (Phase 5 D-25 full intent)**: Full `throw` choice should deliver the ball up to 11 hexes away. Phase 5 deferred this to Phase 7 for the click-to-target UI. However, the Phase 7 success criteria do not explicitly require quick-throw target selection — Claude should implement the `throw` choice as a movement-phase start (consistent with Phase 5 D-25 deferred note) and flag for Phase 8 if full throw-target UI is needed.
- **Target-aware shot resolution**: `applyRoll` consuming `room.shotTarget` to bias/validate the SHOT duel (e.g. corner placement affecting save difficulty) — deferred to Phase 8. Phase 7 records the target (D-06) but resolves from dice only.
- **React Router / URL-based navigation**: Deferred beyond Phase 7. Component-state screen routing (D-12, Phase 6) continues.
- **Board flip for away player**: No-flip decision locked (D-11). If desired in future, apply `transform: scaleX(-1)` to the SVG and reverse pixel-to-hex mapping for click events.

</deferred>

---

_Phase: 7-client-server-integration_
_Context gathered: 2026-05-31_
_D-06 revised: 2026-05-31 (game:shot event added — supersedes RESEARCH Open Q1 local-state resolution)_
