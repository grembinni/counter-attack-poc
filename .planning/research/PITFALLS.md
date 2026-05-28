# Pitfalls Research — Counter Attack Web

**Domain:** Real-time 2-player multiplayer hex-grid board game (Node.js + Socket.io + React)
**Researched:** 2026-05-27
**Overall confidence:** HIGH (patterns well-established in training data; external tool access unavailable for verification pass — flag any individual item marked MEDIUM/LOW before acting on it)

---

## Critical Pitfalls

These mistakes cause rewrites, data corruption, or an unplayable game if not addressed before the phase that introduces them.

---

### Pitfall C1: Duplicate Event Listener Accumulation (Socket.io)

**Confidence:** HIGH

**What goes wrong:** Every time a React component re-renders or re-mounts, it calls `socket.on('event', handler)` again without first removing the previous listener. After 10 re-renders, 10 handlers fire on every event — state is applied 10x, causing ghost moves, double dice rolls, and impossible scores.

**Why it happens:** React strict mode double-invokes effects in development; component navigation (lobby → game → lobby) re-mounts components; developers assume `socket.on` is idempotent.

**Warning signs:**

- Actions appear to fire twice or more in dev mode but not obviously in production
- Game state jumps by double the expected amount (score 2 instead of 1)
- Browser heap grows unboundedly during a session
- `socket.eventNames()` shows the same event registered 3+ times

**Prevention:**

```
// In every useEffect that registers socket listeners:
useEffect(() => {
  socket.on('game:state', handleState);
  return () => {
    socket.off('game:state', handleState);   // cleanup is mandatory
  };
}, []);
```

- Use a single socket instance module (not created per-component)
- Prefer `socket.once` for one-shot handshakes
- Add a dev-mode invariant: log a warning if the same event is registered more than twice

**Phase to address:** Socket infrastructure phase (before any game events are wired)

---

### Pitfall C2: Game State Lives on the Wrong Side

**Confidence:** HIGH

**What goes wrong:** Developers start with "the client knows what move is valid, so let's just trust it and update client state immediately, then tell the server." Over time, the server becomes a relay instead of an authority. Two clients develop diverging state that is never reconciled. One player sees a different board than the other.

**Why it happens:** It is faster to prototype with optimistic updates; server validation gets added "later" and never fully is.

**Warning signs:**

- The server's `gameState` object only stores the last action, not the full board
- Client has logic to compute next legal moves before the server response arrives
- Players occasionally see different positions for the same piece

**Prevention:**

- Server owns the single canonical `GameState` object from day one
- Server sends full state delta (or full state snapshot) after every action
- Client is read-only: it renders what the server sends, it sends what the player inputs
- Define the server state shape before writing a single socket handler

**Phase to address:** Project setup / architecture phase; do not defer

---

### Pitfall C3: Room Not Cleaned Up on Disconnect

**Confidence:** HIGH

**What goes wrong:** Player disconnects mid-game. The room stays in memory holding the full game state, the other player's socket, and both socket references. Over hours or days, a server accumulates hundreds of zombie rooms. Memory grows until the process crashes or the server is restarted, wiping all live games.

**Why it happens:** `socket.on('disconnect')` is often wired late, or only handles the "intentional leave" case, not the browser-close/network-drop case.

**Warning signs:**

- `rooms` Map size only grows, never shrinks
- Server memory climbs linearly with uptime
- After a crash, all in-progress games are lost (this is expected, but the climb should not be unbounded)

**Prevention:**

```
socket.on('disconnect', (reason) => {
  const room = findRoomBySocket(socket.id);
  if (!room) return;
  notifyOpponent(room, 'opponent_disconnected');
  // For a POC: destroy room immediately.
  // For production: hold room for N seconds to allow reconnect.
  destroyRoom(room.id);
});
```

- For POC scope: destroy room on any disconnect, notify remaining player
- Emit `room_destroyed` to the surviving player so the client shows a proper message, not an indefinitely waiting screen
- Add a periodic cleanup job (setInterval) that sweeps rooms older than X minutes as a safety net

**Phase to address:** Room/lobby phase — wire the disconnect handler in the same commit that creates rooms

---

### Pitfall C4: Turn Race Condition — Double Move

**Confidence:** HIGH

**What goes wrong:** Player A double-clicks a move button. Two `action:move` events arrive at the server within milliseconds. Server processes the first: it is valid, state advances. Server processes the second: the state check at the top of the handler passes (it still sees the first event's result before it has been fully written), and a second move is applied. The game is now in an illegal state.

**Why it happens:** JavaScript is single-threaded but async operations (even synchronous-looking Map lookups) interleave if any await is used inside a handler. Also, client sends multiple events before the acknowledgment arrives.

**Warning signs:**

- A player can move a piece twice in one turn
- Turn counter and action counter drift out of sync
- Intermittent "illegal state" bugs that are hard to reproduce

**Prevention:**

- Each room has an `isProcessing: boolean` mutex (simple flag for single-process Node.js)
- Set flag to true when handler starts, false when state is written and broadcast
- Reject any action event that arrives while `isProcessing === true` (return early with an error ack)
- On the client, disable all interactive elements immediately after an action is submitted, re-enable when server broadcasts the new state
- If using any async inside handlers: use a per-room async queue (e.g. a promise chain) not a bare flag

**Phase to address:** First game action handler written — add mutex before adding any game logic

---

### Pitfall C5: Hex Coordinate System Chosen Too Late (or Mixed)

**Confidence:** HIGH — this specific pattern is extremely well-documented in the hex grid community

**What goes wrong:** Developer starts with offset coordinates (col/row) because they look like a spreadsheet. A month later they need to compute ZoI ranges and shortest paths. These are O(1) in cube coordinates, O(n) hacks in offset. The conversion is added as a shim everywhere, creating subtle inconsistencies. Some functions use offset internally, others expect cube — the mismatch causes wrong highlight calculations and ZoI bugs.

**Why it happens:** Offset coordinates "feel" natural; cube coordinates look intimidating at first. The pain of offset only becomes apparent when implementing game mechanics.

**Warning signs:**

- Range calculation function has nested loops and special cases for grid edges
- Coordinate conversion functions appear in unexpected places (rendering, physics, rule logic)
- ZoI / adjacency calculations produce wrong results for the top or bottom rows of the hex grid

**Prevention:**

- Use axial/cube coordinates internally for all game logic from day one
- Only convert to pixel/screen coordinates at render time (one conversion function, called once)
- Counter Attack uses a fixed-size pitch — define all hex positions in cube coordinates at startup, never derive them from offset
- Reference: redblobgames.com/grids/hexagons is the canonical resource; bookmark it before writing any coordinate code

**Phase to address:** Hex grid rendering phase — choose coordinate system before placing the first hex

---

### Pitfall C6: Game Phase State Machine Implemented as Nested if/else

**Confidence:** HIGH

**What goes wrong:** The game has 10+ distinct phases (KickOff, MovementPhase, PassPhase, DuelPhase, LooseBallPhase, SavePhase, etc.). Developers implement phase transitions with `if (phase === 'movement' && action === 'pass') { ... }` chains. After 3 phases, the logic is unreadable. After all phases, it is impossible to test individual transitions and adding a new phase requires modifying every existing condition.

**Why it happens:** State machines feel like over-engineering when you have 2 phases. By the time you have 6, refactoring is expensive.

**Warning signs:**

- A single `handleAction` function is over 100 lines
- Phase-specific validation is scattered across multiple handlers
- A bug fix in DuelPhase accidentally breaks LooseBallPhase

**Prevention:**

- Model the game as an explicit finite state machine from the first phase
- Use a lightweight pattern: `{ [phase]: { validActions: [], onAction: fn, onEnter: fn, onExit: fn } }`
- XState is an option but adds learning overhead; a plain object-based FSM is sufficient for this game's complexity
- Every phase transition goes through a single `transition(room, action, payload)` function
- This structure makes unit testing trivial: call `transition()` directly, assert resulting phase

**Phase to address:** Game rules architecture phase — define the FSM structure before implementing the first rule

---

## Common Mistakes

Frequent errors that cause bugs or significant rework but are recoverable.

---

### Pitfall M1: Socket.io Namespace / Room Naming Collisions

**Confidence:** HIGH

**What goes wrong:** Room codes are short (4-6 chars). Two concurrent games share a room code because the generation function uses `Math.random()` without checking for existing rooms. Events meant for one game reach both games.

**Prevention:**

- Generate room codes with `crypto.randomUUID()` or at minimum check the rooms Map before issuing a code
- Prefix all game events with the room id: `game:${roomId}:state` — or use Socket.io rooms exclusively (not manual filtering) so Socket.io handles isolation
- Use `io.to(roomId).emit()` exclusively; never broadcast to the default namespace for game events

---

### Pitfall M2: Reconnection Leaves Client in Stale State

**Confidence:** HIGH

**What goes wrong:** Player's browser reconnects after a brief network drop. Socket.io reconnects automatically. But the client's React state still holds the pre-disconnect snapshot. The server has advanced two turns. The client shows the old board; the player makes a move from an invalid position; the server rejects it; the client shows nothing. Player thinks the game is frozen.

**Prevention:**

- On `connect` event (not just the first connection — Socket.io fires `connect` on every reconnect), always request a full state snapshot: `socket.emit('game:request-sync')`
- Server responds with complete current state; client replaces (not merges) its state
- Show a "Reconnecting..." overlay while the socket is disconnected (`socket.on('disconnect')` → show overlay; `socket.on('connect')` → hide overlay + request sync)

---

### Pitfall M3: Dice Roll Authoritative on Client

**Confidence:** HIGH — specific to this project's design

**What goes wrong:** Dice animation and "click to roll" interaction is implemented client-side. The result is generated client-side and sent to the server. One player modifies the client to always send `[6, 6]`. The game is exploitable.

**Prevention:**

- Server generates all dice results using `Math.random()` (or a seeded PRNG)
- Client sends "I clicked roll" — server rolls, broadcasts result to both players
- Client animates the result the server sent, not a locally generated one
- This is a POC so cheat-proofing is not the primary concern, but this pattern costs nothing extra and avoids a future rewrite

---

### Pitfall M4: SVG Rendering Performance Degrades With Piece Count

**Confidence:** MEDIUM (training data; no benchmark verified)

**What goes wrong:** The full Counter Attack pitch has 22 player pieces + the ball + highlighted cells. If every state update re-renders the entire SVG (each hex as a separate SVG element), React's reconciliation slows on low-end hardware. With animated state transitions (even simple CSS transitions), frame drops become noticeable.

**Warning signs:**

- React DevTools Profiler shows the entire SVG component re-rendering on every socket event
- Renders take >16ms on mid-range hardware

**Prevention:**

- Memoize individual hex cells with `React.memo`; only re-render hexes whose state actually changed
- Use a stable key per hex coordinate (not array index)
- Keep piece rendering as a separate component layer from the static pitch grid
- If performance is still poor: migrate rendering layer to Canvas (PixiJS), keeping React for UI chrome only — but do not optimize prematurely; validate the SVG approach first

---

### Pitfall M5: ZoI Rule Applied Inconsistently

**Confidence:** HIGH — specific to Counter Attack rule complexity

**What goes wrong:** Zone of Influence blocks passes and dribbles through opponent-controlled hexes. Developers implement ZoI checks for passing but forget to apply it to dribble paths, or apply it to movement but forget the "first-time pass bypasses ZoI" exception. The rule is tested manually and appears correct until a specific board configuration reveals the gap.

**Prevention:**

- Write the ZoI function once, with clear inputs: `isZoIBlocked(fromHex, toHex, boardState, ruleVariant)`
- The `ruleVariant` parameter encodes exceptions (e.g. `firstTimePass`, `highPass`)
- Cover this function with 10+ unit tests covering edge cases: adjacent opponent, path-crossing ZoI, corner hexes
- Make the ZoI function pure (no side effects, no socket.io references) so it can be imported directly into test files

---

### Pitfall M6: Half/Game Clock Managed on Client

**Confidence:** HIGH

**What goes wrong:** The "45 actions per half" counter is tracked in client state. On reconnect, it is reset. Players disagree on the action count. Added time calculation (dice + referee Leniency) is done differently on each client.

**Prevention:**

- Action counter, half number, added time, and score live exclusively in server `GameState`
- Broadcast the full counter state with every state update — clients never compute it independently

---

### Pitfall M7: "Just Add One More Small Feature" — Scope Creep Vectors

**Confidence:** HIGH — universal project management pattern

**What commonly balloons timeline:**

| Feature                           | Why It Seems Small                  | Why It Isn't                                                                                 |
| --------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Corner kicks                      | "One more game phase"               | Introduces new board positions, kick-off variant, heading duel integration                   |
| Throw-ins                         | "Just put the ball on the sideline" | Requires sideline detection, directional throw rules, ZoI interaction                        |
| Offside                           | "Just check a coordinate"           | Requires tracking all player positions at the moment of pass, correct timing relative to ZoI |
| Player attributes affecting rolls | "Just subtract from dice"           | Requires all attributes to be tested across all duel types                                   |
| Spectator mode                    | "Read-only socket join"             | Requires room capacity management, spectator-only events, preventing spectator actions       |
| Replay / undo                     | "Just store moves"                  | Requires full state history, deterministic replay, client seeking                            |
| Mobile layout                     | "Just media queries"                | Hex grid SVG layout requires complete responsive rewrite                                     |

**Prevention:**

- For each "small" feature request: estimate by mapping out every state transition it touches, not just the UI change
- Counter Attack has a defined rulebook; use it as a hard boundary — if it is not in the rulebook section you have scoped, it is out of scope

---

## AWS-Specific Pitfalls

---

### Pitfall A1: WebSocket Connections Dropped by Load Balancer Idle Timeout

**Confidence:** HIGH

**What goes wrong:** AWS Application Load Balancer (ALB) has a default idle timeout of 60 seconds. If the WebSocket connection carries no traffic for 60 seconds (player is thinking), the ALB drops the connection. Socket.io reconnects, but the server may not correctly re-associate the new socket with the existing game room.

**Prevention:**

- Set ALB idle timeout to 3600 seconds (1 hour) for the target group serving the game server
- Configure Socket.io server-side ping interval to be shorter than the ALB timeout: `pingInterval: 25000, pingTimeout: 20000`
- Socket.io's built-in heartbeat (ping/pong) keeps the connection alive — ensure it is not disabled

**AWS console path:** EC2 → Load Balancers → [ALB] → Attributes → Idle timeout

---

### Pitfall A2: Sticky Sessions Not Configured on ALB (If Scaling Beyond One Instance)

**Confidence:** HIGH

**What goes wrong:** If you run more than one EC2 instance (or ECS task), a player's HTTP polling fallback (Socket.io's long-polling) may hit a different instance than the one holding their game state. The player appears connected to Socket.io but their game events go to the wrong instance.

**Why it matters for this POC:** You are starting with a single instance, so this does not bite immediately. But if you add a second instance for redundancy without sticky sessions, you get silent failures.

**Prevention:**

- For a POC with one instance: no action needed
- For any multi-instance setup: enable ALB sticky sessions (duration-based, 1 hour) on the target group
- Better long-term: migrate to Redis-backed Socket.io adapter (`socket.io-redis` / `@socket.io/redis-adapter`) so any instance can serve any socket
- Strongly prefer WebSocket transport over polling from the start: `transports: ['websocket']` on the client — this eliminates the need for sticky sessions entirely (WebSockets are connection-affine by definition)

---

### Pitfall A3: ELB Health Check Fails WebSocket Endpoint

**Confidence:** HIGH

**What goes wrong:** The ALB health check pings `/` every 30 seconds. If the Node.js app only serves WebSocket connections and returns 404 on HTTP GET to `/`, the target group marks the instance unhealthy and deregisters it.

**Prevention:**

- Add a simple HTTP health check endpoint:
  ```
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  ```
- Set the ALB target group health check path to `/health`
- Return HTTP 200; the health check does not need to validate game state

---

### Pitfall A4: Process Crash Wipes All In-Flight Games

**Confidence:** HIGH

**What goes wrong:** A Node.js exception (unhandled promise rejection, OOM) kills the process. All game states held in memory are lost. Both players are disconnected with no recovery path.

**Prevention:**

- Wrap all Socket.io event handlers in try/catch; emit an error event to the client on catch rather than letting the process crash
- Use a process manager (PM2 with `--no-autorestart` in prod is wrong; use `pm2 start --restart-delay=1000`)
- For a POC: accept that crashes lose games (document this); do not invest in persistence unless the POC validates the product
- Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers that log and optionally notify before exiting gracefully

---

### Pitfall A5: Static Files Served From Node.js Process

**Confidence:** MEDIUM — common pattern that wastes compute

**What goes wrong:** Developer runs `express.static()` to serve the React build from the same Node.js process that handles WebSockets. Under any meaningful load, static file serving competes with game logic for the same event loop. Not a problem for 2 concurrent players, but it adds risk of interference and is unnecessary.

**Prevention:**

- For the POC: acceptable to serve static files from Express while validating
- For deployment: serve the React Vite build from S3 + CloudFront; point the backend URL at the EC2/ECS WebSocket endpoint
- This separation also enables independent scaling and zero-downtime frontend deploys

---

## Phase-Specific Warnings

| Development Phase            | Most Likely Pitfall                              | Mitigation                                                          |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| Project setup / repo init    | State lives in the wrong place from day one (C2) | Define server GameState shape before any socket handler             |
| Room / lobby implementation  | Room not cleaned up on disconnect (C3)           | Wire `disconnect` handler in the same PR as room creation           |
| Socket.io event wiring       | Duplicate listener accumulation (C1)             | Enforce cleanup pattern in code review before merging first handler |
| Hex grid rendering           | Wrong coordinate system chosen (C5)              | Decide axial vs cube before first hex is drawn; document the choice |
| First game action (movement) | Turn race condition (C4)                         | Add per-room mutex before adding move validation                    |
| ZoI + passing rules          | ZoI applied inconsistently (M5)                  | Write ZoI unit tests before wiring it to socket events              |
| Dice roll mechanics          | Dice authoritative on client (M3)                | Server-side roll from the first implementation                      |
| Full game loop               | Phase FSM as if/else (C6)                        | Refactor to explicit FSM before adding DuelPhase                    |
| Half / added time            | Clock on client (M6)                             | Broadcast full counter state from server; client never computes it  |
| AWS deployment               | ALB idle timeout drops connections (A1)          | Set timeout + verify Socket.io ping before going live               |
| AWS deployment               | Health check fails (A3)                          | Add `/health` endpoint before deploying to ALB                      |
| Any phase                    | Scope creep (M7)                                 | Use rulebook section list as a hard feature gate                    |

---

## Testing Strategy

How to test real-time multiplayer game logic without a running server.

---

### Strategy T1: Isolate Game Logic From Transport

**Confidence:** HIGH — this is the most important testing enabler

**What to do:** The game rules engine (phase FSM, move validation, ZoI, dice resolution, score tracking) must have zero imports from `socket.io` or `express`. It is a pure JavaScript module that takes state in and returns new state out.

```
// game/engine.ts
export function applyAction(state: GameState, action: Action): GameState { ... }
export function isValidMove(state: GameState, move: Move): boolean { ... }
export function computeZoI(boardState: BoardState, hex: Hex): HexSet { ... }
```

The Socket.io layer becomes a thin adapter:

```
socket.on('action:move', (payload) => {
  if (!isValidMove(room.state, payload)) return socket.emit('error', 'invalid');
  room.state = applyAction(room.state, payload);
  io.to(room.id).emit('game:state', room.state);
});
```

**Why it matters:** You can unit test 100% of game rules with plain `node --test` or Jest, no sockets involved. This is the single highest-leverage testing decision.

---

### Strategy T2: Unit Test the FSM Transitions

**Confidence:** HIGH

Use the pure engine module to assert every legal phase transition and every illegal one:

```javascript
// game.test.js
test('movement phase: valid move advances state', () => {
  const state = makeState({ phase: 'MovementPhase', actionsRemaining: 4 });
  const next = applyAction(state, { type: 'MOVE', pieceId: 'A1', to: { q: 2, r: 3 } });
  assert.equal(next.phase, 'MovementPhase');
  assert.equal(next.actionsRemaining, 3);
});

test('movement phase: move out of turn is rejected', () => {
  const state = makeState({ phase: 'MovementPhase', currentTeam: 'home' });
  const result = isValidMove(state, { type: 'MOVE', pieceId: 'B1', submittedBy: 'away' });
  assert.equal(result, false);
});
```

Target: every phase transition + every ZoI case + every duel resolution path covered before wiring to Socket.io.

---

### Strategy T3: Integration Test With Socket.io Test Client

**Confidence:** MEDIUM — Socket.io's own test client works; setup overhead is real

For testing the full socket layer (not just logic), use `socket.io-client` pointed at a test server spun up in `beforeAll`:

```javascript
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';

let server, ioServer, clientA, clientB;

beforeAll((done) => {
  server = createServer();
  ioServer = new Server(server);
  server.listen(() => {
    const port = server.address().port;
    clientA = Client(`http://localhost:${port}`);
    clientB = Client(`http://localhost:${port}`);
    clientB.on('connect', done);
  });
});

afterAll(() => {
  ioServer.close();
  clientA.close();
  clientB.close();
  server.close();
});
```

This covers: room creation, join, action dispatch, state broadcast to both clients, disconnect cleanup.

Limit integration tests to connection flows and broadcast correctness — do not re-test game rules here, that is Strategy T1's job.

---

### Strategy T4: Hex Coordinate Tests First

**Confidence:** HIGH

Before wiring the hex grid to the UI, test all coordinate math:

- Neighbors of a hex return exactly 6 hexes (or fewer at grid boundary — know which behavior you want)
- Range-N returns the correct count of hexes
- ZoI intersection: given a path from A to B, the function identifies the correct blocking hexes
- Coordinate round-trip: pixel → axial → pixel returns within 1px of origin

These are pure math functions. Zero sockets needed. Run them with any test runner.

---

### Strategy T5: Use Fixtures for Board States

**Confidence:** HIGH

For testing complex rule interactions (ZoI + pass range + duel), predefine JSON board fixtures representing specific game situations. This avoids rebuilding board state from scratch in every test and makes test intentions readable.

```javascript
// fixtures/zoi-blocked-pass.json
{
  "phase": "PassPhase",
  "ball": { "q": 0, "r": 0 },
  "pieces": [
    { "id": "A1", "team": "home", "hex": { "q": 0, "r": 0 } },
    { "id": "B1", "team": "away", "hex": { "q": 1, "r": 0 } },  // adjacent — creates ZoI
    { "id": "A2", "team": "home", "hex": { "q": 2, "r": 0 } }   // target of pass
  ]
}
```

Load fixtures with `JSON.parse(fs.readFileSync(...))` — no framework needed.

---

### Strategy T6: What NOT to Test (for POC scope)

Avoid over-investing in test infrastructure for a POC:

- Do not write Cypress/Playwright E2E tests for the full game loop — the game state space is too large, and rule changes will break tests constantly
- Do not mock Socket.io at the unit level — either test the pure engine (no Socket.io involved) or use a real test server (Strategy T3)
- Do not test rendering pixel-accuracy of the hex grid — verify coordinate math (T4) and treat visual output as manually verified

---

## Sources and Confidence Notes

All findings are drawn from training data (knowledge cutoff August 2025). External tool access (WebSearch, WebFetch, Bash/Context7 CLI) was unavailable during this research session.

| Area                                 | Confidence | Basis                                                                                             |
| ------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------- |
| Socket.io listener accumulation (C1) | HIGH       | Documented Socket.io pattern; extremely common community issue                                    |
| Server-authority model (C2)          | HIGH       | Standard game server architecture; no external verification needed                                |
| Room cleanup on disconnect (C3)      | HIGH       | Socket.io disconnect event is well-documented                                                     |
| Turn race condition (C4)             | HIGH       | Node.js concurrency model is deterministic; mutex pattern is standard                             |
| Hex coordinate system (C5)           | HIGH       | redblobgames.com is canonical; axial/cube vs offset distinction is settled                        |
| FSM over if/else (C6)                | HIGH       | Standard software engineering principle                                                           |
| Reconnection stale state (M2)        | HIGH       | Known Socket.io pattern                                                                           |
| SVG performance (M4)                 | MEDIUM     | General browser rendering knowledge; Counter Attack piece count is low enough this may not matter |
| ALB idle timeout (A1)                | HIGH       | AWS docs confirm 60s default; WebSocket heartbeat mitigation is standard                          |
| ALB sticky sessions (A2)             | HIGH       | AWS ALB documentation                                                                             |
| ELB health check (A3)                | HIGH       | AWS target group health check behavior is standard                                                |
| Process crash / persistence (A4)     | HIGH       | Node.js unhandled exception behavior                                                              |
| Testing strategy (T1-T6)             | HIGH       | Standard software engineering; Socket.io test client is documented                                |
