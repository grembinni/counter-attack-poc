# Architecture Research — Counter Attack Web

**Researched:** 2026-05-27
**Confidence:** HIGH for hex coordinates, Socket.io patterns, state machine design; MEDIUM for AWS-specific deployment topology (verified against well-established patterns, no live doc access during this session)

---

## System Overview

```
Browser (Player 1)                    Browser (Player 2)
  React + Vite                          React + Vite
  Socket.io-client                      Socket.io-client
       |                                      |
       |  WebSocket (Socket.io)               |
       v                                      v
  ┌──────────────────────────────────────────────┐
  │           Node.js Game Server                │
  │                                              │
  │  ┌────────────┐   ┌──────────────────────┐  │
  │  │ RoomManager│   │  GameEngine          │  │
  │  │ create     │──▶│  GameState (auth.)   │  │
  │  │ join       │   │  MoveValidator       │  │
  │  │ disconnect │   │  DiceResolver        │  │
  │  └────────────┘   │  PhaseController     │  │
  │                   └──────────────────────┘  │
  │  ┌────────────────────────────────────────┐  │
  │  │         Socket.io EventRouter          │  │
  │  │  (maps inbound events → engine calls)  │  │
  │  └────────────────────────────────────────┘  │
  └──────────────────────────────────────────────┘
```

Data flows in one direction for authority: client sends *intent* (action request), server validates, mutates authoritative state, broadcasts new state snapshot to both clients. Clients never push state — only actions. Both clients always display the same state snapshot.

---

## Game State Model

### Hex Coordinate Representation

Use **axial coordinates (q, r)** for all internal storage and logic. This is the standard recommendation from the canonical hex grid reference (redblobgames.com/grids/hexagons) and is the cleanest system for a flat-top or pointy-top hex grid.

```typescript
// packages/shared/src/hex.ts
interface HexCoord {
  q: number;  // column axis
  r: number;  // row axis
  // s = -q - r  (cube third axis, derived on demand: s = -q - r)
}
```

Rationale for axial over alternatives:
- **Offset coordinates** are intuitive visually but produce irregular neighbor arithmetic (odd vs even row offsets differ), making ZoI and range calculations error-prone.
- **Cube coordinates** (q, r, s) are algorithmically perfect but carry a redundant third value; axial is cube with s implicit (`s = -q - r`), giving identical algorithmic power with less storage.
- Distance formula: `max(|q1-q2|, |r1-r2|, |s1-s2|)` (using cube conversion inline) — one expression, no edge cases.
- Range query (all hexes within N moves): flood-fill BFS from origin up to distance N — straightforward with axial.
- ZoI check: a hex is under ZoI if any opponent piece is within distance 1 — single distance call per candidate hex.

For the Counter Attack pitch specifically: the physical board likely uses a rectangular grid of hexes with flat-top orientation. Map the board's printed column/row labels to axial q/r during the initial coordinate calibration phase. Store the canonical mapping as a data file once the board photo is measured.

### Pitch Data Structure

```typescript
// packages/shared/src/gameState.ts

type TeamId = 'home' | 'away';
type PieceRole = 'outfield' | 'goalkeeper';
type GamePhase =
  | 'SETUP'
  | 'KICKOFF'
  | 'MOVEMENT_ATTACKER_1'   // 4 players move (attacking team)
  | 'MOVEMENT_DEFENDER'     // 5 players move (defending team)
  | 'MOVEMENT_ATTACKER_2'   // up to 2 more attackers move ≤2 hexes
  | 'ACTION_CHOICE'         // ball carrier chooses: pass / shoot / dribble
  | 'PASS_RESOLUTION'       // pass accuracy dice
  | 'SHOT_RESOLUTION'       // shooting vs saving duel
  | 'HEADING_DUEL'          // heading dice
  | 'LOOSE_BALL'            // direction + distance dice
  | 'GK_RESTART'            // GK chooses kick/throw/movement
  | 'HALF_TIME'
  | 'FULL_TIME';

interface PlayerPiece {
  id: string;               // e.g. "home_7", "away_gk"
  team: TeamId;
  role: PieceRole;
  position: HexCoord;
  hasMoved: boolean;        // within current movement phase
  attributes: PlayerAttributes;
}

interface PlayerAttributes {
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  heading: number;
  saving: number;           // goalkeepers only (meaningful)
  handling: number;         // goalkeepers only
  resilience: number;
  aerialAbility: number;
}

interface BallState {
  position: HexCoord;
  carrier: string | null;   // piece id, or null if loose
  isLoose: boolean;
}

interface HalfState {
  halfNumber: 1 | 2;
  actionsRemaining: number; // 45 + added time
  addedTime: number;        // rolled at start of half
}

interface GameState {
  roomId: string;
  phase: GamePhase;
  attackingTeam: TeamId;
  possession: TeamId;
  pieces: Record<string, PlayerPiece>;  // keyed by piece id
  ball: BallState;
  half: HalfState;
  score: Record<TeamId, number>;
  referee: RefereeCard;
  actionHistory: GameAction[];          // append-only log
  lastDiceRoll: DiceResult | null;      // last resolved roll for display
  pendingAction: PendingAction | null;  // action awaiting dice roll
  moveSet: MoveSetRecord;               // tracks who has moved this phase
}

interface MoveSetRecord {
  attackerMovesUsed: number;    // 0–4 in phase 1, 0–2 in phase 2
  defenderMovesUsed: number;    // 0–5
  movedPieceIds: Set<string>;
}

interface RefereeCard {
  name: string;
  leniency: number;   // added time bonus
}

interface DiceResult {
  dice: number[];
  total: number;
  context: string;    // e.g. "PASS_ACCURACY" | "SHOT" | "SAVE" | "LOOSE_BALL_DIRECTION"
}

interface PendingAction {
  type: 'PASS' | 'SHOT' | 'HEADING' | 'LOOSE_BALL';
  actorId: string;
  targetHex?: HexCoord;
  targetPieceId?: string;
}
```

Key design decisions:
- `pieces` as a flat `Record<string, PlayerPiece>` (not a nested array) allows O(1) lookup by piece id, which is needed constantly during move validation.
- `actionHistory` is append-only. This provides a complete audit trail for dispute resolution and is the basis for any future replay feature.
- `pendingAction` captures the action that triggered a dice roll, so when the dice result arrives, the server knows how to resolve it without re-parsing event context.
- `lastDiceRoll` is included in every state broadcast so both clients always see the same roll result simultaneously.

---

## Communication Protocol

### Principle

Clients send **intent events** (what they want to do). Server sends **state events** (what the world now looks like). There are no client-to-client messages — everything routes through server.

### Client → Server Events

```typescript
// Room lifecycle
'room:create'    payload: { playerName: string }
                 response: { roomId: string, roomCode: string }

'room:join'      payload: { roomCode: string, playerName: string }
                 response: { ok: boolean, error?: string }

'room:ready'     payload: {}
                 // both players signal ready → server emits 'game:start'

// Game actions — all validated server-side before any state mutation
'game:move'      payload: { pieceId: string, destination: HexCoord }

'game:action'    payload: {
                   type: 'PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_PASS' | 'SHOOT' | 'SNAPSHOT',
                   targetHex: HexCoord
                 }

'game:roll'      payload: {}
                 // player clicks "Roll Dice" — server generates roll, broadcasts result

'game:gk-choice' payload: { choice: 'KICK' | 'QUICK_THROW' | 'MOVEMENT_PHASE' }
```

### Server → Client Events

```typescript
// Room
'room:joined'    payload: { roomCode: string, players: PlayerInfo[] }
'room:player-joined' payload: { player: PlayerInfo }
'room:error'     payload: { code: string, message: string }

// Game flow
'game:start'     payload: { state: GameState, yourTeam: TeamId }
                 // sent to each player individually with their team assignment

'game:state'     payload: { state: GameState }
                 // canonical broadcast after EVERY state mutation
                 // both players receive the same payload
                 // clients replace their local state entirely (no patch merging)

'game:valid-moves' payload: { pieceId: string, hexes: HexCoord[] }
                 // sent after a piece is selected — computed server-side
                 // avoids client needing to run validation logic

'game:error'     payload: { code: string, message: string }
                 // action rejected: piece not yours, not your turn, illegal move, etc.

'game:dice-result' payload: { result: DiceResult }
                 // included in game:state but also sent as standalone for animation triggers

'room:opponent-disconnected' payload: { playerName: string }
'room:opponent-reconnected'  payload: { playerName: string }
'room:abandoned'             payload: { reason: string }
```

### State Broadcast Strategy

After every validated action, the server broadcasts a full `GameState` snapshot to the room via `io.to(roomId).emit('game:state', { state })`. This "full snapshot" approach is deliberately chosen over differential patching (JSON Patch / operational transforms) because:
- Game state is small (22 pieces, ~30 hex positions, scalar counters) — full broadcast is under 5KB.
- No client-side merge logic needed — eliminates an entire class of desync bugs.
- Reconnecting clients get the current full state immediately without replaying history.
- Simpler debugging: log any state object and it's self-contained.

The `game:valid-moves` event is sent server-side in response to a piece-selection event (or immediately after phase transitions to precompute the first selectable piece). This keeps all rules logic on the server without requiring the client to replicate the validation engine.

### Error Response Contract

All rejected actions emit `game:error` with a structured code:
```
WRONG_TURN          — not your turn to act
WRONG_PHASE         — action not legal in current phase
PIECE_NOT_YOURS     — you don't control that piece
ILLEGAL_DESTINATION — hex not reachable (not in valid move set)
ZOI_BLOCKED         — pass/dribble blocked by ZoI
OUT_OF_RANGE        — pass type exceeds range limit
NOT_BALL_CARRIER    — action requires possession
MOVE_LIMIT_EXCEEDED — team has used all moves in this phase
```

Clients display the error message but do not mutate state. Server state remains authoritative.

---

## Hex Coordinate System

**Recommendation: Axial coordinates (q, r), pointy-top hex orientation.**

### Rationale

Counter Attack's physical board is a rectangular grid of hexes. Axial coordinates map naturally to rectangular bounds (`q` spans columns, `r` spans rows) without the odd/even row offset problem.

**Key algorithms (all work directly in axial space):**

```typescript
// Distance between two hexes
function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q)
        + Math.abs(a.q + a.r - b.q - b.r)
        + Math.abs(a.r - b.r)) / 2;
}

// All 6 neighbors of a hex
const AXIAL_DIRECTIONS: HexCoord[] = [
  { q: +1, r:  0 }, { q: +1, r: -1 }, { q:  0, r: -1 },
  { q: -1, r:  0 }, { q: -1, r: +1 }, { q:  0, r: +1 },
];
function hexNeighbors(h: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map(d => ({ q: h.q + d.q, r: h.r + d.r }));
}

// All hexes within range N (for movement / pass range highlighting)
function hexesInRange(center: HexCoord, range: number, pitchHexes: Set<string>): HexCoord[] {
  const results: HexCoord[] = [];
  for (let dq = -range; dq <= range; dq++) {
    for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr++) {
      const candidate = { q: center.q + dq, r: center.r + dr };
      const key = `${candidate.q},${candidate.r}`;
      if (pitchHexes.has(key)) results.push(candidate);
    }
  }
  return results;
}

// Zone of Influence: is hex H under ZoI of team T?
function isUnderZoI(hex: HexCoord, opponentPieces: PlayerPiece[]): boolean {
  return opponentPieces.some(p => hexDistance(p.position, hex) <= 1);
}

// Hex key for use in Sets/Maps (storage and lookup)
function hexKey(h: HexCoord): string {
  return `${h.q},${h.r}`;
}
```

### Pitch Coordinate Map

The physical Counter Attack pitch has specific hex coordinates that must be measured from the board photo/rulebook. Store the canonical pitch as:

```typescript
// packages/shared/src/pitch.ts
const PITCH_HEXES: Set<string> = new Set([
  // populated from board measurements
  // format: "q,r"
  "0,0", "1,0", "-1,0", /* ... all valid pitch hexes ... */
]);

const GOAL_HEXES: Record<TeamId, HexCoord[]> = {
  home: [{ q: 0, r: -8 }, { q: 1, r: -8 }],  // placeholder — measure from board
  away: [{ q: 0, r:  8 }, { q: 1, r:  8 }],
};

const KICKOFF_HEX: HexCoord = { q: 0, r: 0 };
```

This is a **blocking dependency**: until the board is measured, kickoff positions, goal positions, and pitch boundary enforcement are approximations. Flag this clearly in the roadmap.

### Screen Rendering Conversion

For the React canvas/SVG renderer, convert axial to pixel with:
```typescript
function axialToPixel(h: HexCoord, size: number): { x: number; y: number } {
  // Pointy-top hex
  return {
    x: size * (Math.sqrt(3) * h.q + Math.sqrt(3) / 2 * h.r),
    y: size * (3 / 2 * h.r),
  };
}
```
`size` is the hex "radius" (center to corner). This is pure presentation logic — lives only in the frontend.

---

## Module Boundaries

### Server-side Modules

```
server/
  src/
    index.ts              — Express + Socket.io bootstrap, port binding
    eventRouter.ts        — maps socket events to handler functions
    roomManager.ts        — room CRUD, player assignment, reconnection tracking
    gameEngine.ts         — orchestrates phase transitions, calls sub-modules
    moveValidator.ts      — pure functions: legal moves, ZoI, pass range
    diceResolver.ts       — crypto.randomInt-based dice rolls, result logging
    phaseController.ts    — enforces 4-5-2 sequence, action sequencing, half/time
    stateSerializer.ts    — builds the GameState object sent to clients
    teams/
      homeTeam.ts         — hardcoded squad attributes
      awayTeam.ts         — hardcoded squad attributes
    types.ts              — re-exports from shared package
```

**Module responsibilities:**

| Module | Does | Does Not |
|--------|------|----------|
| `roomManager` | Track rooms, map socket IDs to teams, handle disconnect/reconnect, generate room codes | Touch game state |
| `gameEngine` | Receive validated actions, call moveValidator, call diceResolver, update state, call phaseController, broadcast | Parse raw socket events |
| `moveValidator` | Compute legal hex destinations for a piece, check ZoI, check pass range, check phase legality | Mutate any state |
| `diceResolver` | Generate cryptographically-fair dice rolls (crypto.randomInt), format DiceResult | Apply roll outcomes (that's gameEngine's job) |
| `phaseController` | Determine what phase follows the current one, check phase completion conditions (all moves used, dice resolved) | Know about specific pieces |
| `eventRouter` | Parse socket events, authenticate sender is the correct player, call gameEngine | Contain any game logic |
| `stateSerializer` | Convert internal state to the wire format sent to clients | Run any logic |

**Boundary rule:** `moveValidator` and `phaseController` must be **pure functions** (input → output, no side effects). This makes them unit-testable without a running server and enables the shared code strategy below.

### Frontend Modules

```
client/
  src/
    components/
      Pitch.tsx            — SVG/canvas hex grid renderer
      Piece.tsx            — individual player piece
      ActionPanel.tsx      — pass/shoot/dribble choice UI
      DiceDisplay.tsx      — roll animation and result
      Scoreboard.tsx       — score, half, actions remaining
      RoomLobby.tsx        — create/join room UI
    hooks/
      useGameSocket.ts     — socket connection, event subscription, dispatch
      useGameState.ts      — local state store (read-only display)
    lib/
      hexToPixel.ts        — axial-to-screen conversion (ONLY presentation logic here)
      highlightEngine.ts   — maps server-provided valid-moves list to hex highlights
```

---

## Build Order

Build in this dependency order. Each step unlocks the next.

### Step 1: Shared Types Package (unlocks everything else)

Create `packages/shared` with:
- `HexCoord`, `GameState`, `PlayerPiece`, `BallState`, `GamePhase` TypeScript types
- `hexDistance`, `hexNeighbors`, `hexesInRange`, `isUnderZoI` pure functions
- Socket event name constants (string literals typed as const)

Reason: both server and client import from here. Nothing else can be typed correctly without it. Tests can be written immediately against pure hex math.

### Step 2: Move Validator + Unit Tests

Implement `moveValidator.ts` as pure functions using shared types. Write comprehensive tests for:
- Legal move computation per phase
- ZoI enforcement
- Pass range per pass type
- Movement limits (4-5-2 tracking)

Reason: this is the rules heart of the game. Getting it right before it's wired to sockets means bugs are caught in isolation. All subsequent steps depend on correct validation.

### Step 3: Room Manager + Socket Scaffold

Implement `roomManager.ts` and the Socket.io event router with stub game engine. Two browsers can connect, create/join a room, and see each other connected. No game logic yet.

Reason: establishes the network layer. Confirms Socket.io room mechanics work in the target environment. Unblocks parallel frontend work on lobby UI.

### Step 4: Game Engine + Phase Controller (no dice yet)

Wire `gameEngine` to the event router. Implement deterministic game actions: movement, phase transitions, possession changes. Use a fixed dummy dice result for any resolution step.

Reason: validates the state machine is correct for the common path (movement phase) before introducing non-determinism.

### Step 5: Dice Resolver

Replace dummy dice with `crypto.randomInt`-based rolls. Implement all resolution paths: pass accuracy, shot/save duel, heading, loose ball direction/distance.

Reason: dice touch every resolution branch; keeping them separate from the state machine lets Step 4 be tested deterministically.

### Step 6: Frontend Hex Renderer

React component that receives a `GameState` and renders the hex pitch with pieces and ball. No interaction yet — purely a state display. Feed it with hardcoded mock state.

Reason: hex rendering is independent of server logic and can be built in parallel with Steps 4–5. Validates the axial-to-pixel conversion and pitch layout before the board measurements arrive.

### Step 7: Frontend Socket Integration

Connect `useGameSocket` to the server. Replace mock state with live state from `game:state` events. Wire click handlers to emit `game:move` and `game:action` events.

Reason: integrates all previous steps into a playable loop.

### Step 8: Half/Match Lifecycle

Implement action counting, half-time transition, added time roll, full-time detection, kick-off procedure.

Reason: depends on the core game loop being stable. Easier to test after Steps 1–7 are verified.

---

## Shared Code Strategy

**Recommendation: npm workspaces monorepo with a `packages/shared` package.**

### Structure

```
counter-attack-poc/
  package.json              — workspaces: ["packages/*", "server", "client"]
  packages/
    shared/
      package.json          — name: "@ca/shared", no external deps
      src/
        types.ts            — all TypeScript interfaces
        hex.ts              — pure hex math functions
        events.ts           — socket event name constants
        validation.ts       — pure validation predicates (re-exported from moveValidator)
      tsconfig.json
  server/
    package.json            — dependencies: { "@ca/shared": "*" }
    tsconfig.json           — references: ["../packages/shared"]
  client/
    package.json            — dependencies: { "@ca/shared": "*" }
    vite.config.ts          — resolve alias for workspace package
```

### What Goes in Shared

| Item | Shared? | Rationale |
|------|---------|-----------|
| TypeScript interfaces (GameState, HexCoord, etc.) | YES | Single source of truth; compile-time mismatch detection |
| Hex math pure functions | YES | Used by server (validation) and client (rendering, highlighting) |
| Socket event name constants | YES | Prevents string typos diverging between emitter and listener |
| Move validation predicates | YES (pure only) | Client uses for pre-highlighting; server re-runs for authority |
| Dice resolution | NO — server only | Must be server-authoritative; client must not generate rolls |
| Game state mutation | NO — server only | Clients are display-only |
| React components | NO — client only | No server-side rendering needed |

### Move Validation in Shared vs Server

The pure predicates (is this hex reachable? is this pass legal?) should be in `shared/validation.ts`. The client uses them **only for pre-highlighting valid hexes** in the UI. The server **always re-runs them** before accepting any action — client-side validation is convenience only, never authority.

This avoids duplicating the rules logic while keeping the server authoritative. The risk of divergence is mitigated by having both import from the same source file.

### Why Not Separate Repos

Two separate repos (server-repo, client-repo) require a published npm package for the shared types or a git submodule — both add friction to the tight iteration loop of a POC. Workspaces give zero-overhead local imports with full TypeScript intellisense.

### TypeScript Configuration

```json
// packages/shared/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "strict": true
  }
}
```

Server uses `ts-node` or `tsx` for development. Client uses Vite which resolves workspace packages directly via the `resolve.alias` or workspace protocol without needing to build the shared package first.

---

## Room Lifecycle State Machine

```
WAITING_FOR_PLAYERS
  → player 1 creates room (roomCode issued)
  → player 2 joins by code
LOBBY (both connected)
  → both emit 'room:ready'
IN_GAME
  → phase state machine runs
  → on disconnect: emit 'room:opponent-disconnected', wait 60s
  → if reconnect within 60s: restore socket to room, resend full state → IN_GAME
  → if no reconnect: emit 'room:abandoned', clean up room → ABANDONED
COMPLETED
  → full_time phase reached, scores final
  → room kept in memory briefly (30s) for final state display
  → then cleaned up
ABANDONED
  → room deleted from memory
```

Room codes should be 6-character alphanumeric (e.g. "XK7M2P") generated with `crypto.randomBytes`. Room state lives in a `Map<roomCode, RoomState>` on the server process — no database needed for v1. This means room state is lost on server restart; acceptable for a POC.

### Disconnect Handling

```typescript
socket.on('disconnect', () => {
  const room = roomManager.getRoomBySocket(socket.id);
  if (!room || room.phase === 'COMPLETED') return;
  
  room.disconnectedPlayer = socket.id;
  room.disconnectTimer = setTimeout(() => {
    io.to(room.roomId).emit('room:abandoned', { reason: 'opponent_timeout' });
    roomManager.deleteRoom(room.roomId);
  }, 60_000);
  
  io.to(room.roomId).emit('room:opponent-disconnected', { 
    playerName: room.getPlayerName(socket.id) 
  });
});

socket.on('reconnect-room', ({ roomCode }) => {
  const room = roomManager.getRoom(roomCode);
  if (!room) { socket.emit('room:error', { code: 'ROOM_NOT_FOUND' }); return; }
  
  clearTimeout(room.disconnectTimer);
  room.disconnectedPlayer = null;
  socket.join(roomCode);
  roomManager.updateSocketId(room, socket.id);
  socket.emit('game:state', { state: room.gameState });
  io.to(roomCode).emit('room:opponent-reconnected', { playerName: room.getPlayerName(socket.id) });
});
```

---

## AWS Deployment Notes

Socket.io requires **sticky sessions** when scaled horizontally (multiple server instances) because WebSocket connections are stateful. For v1 POC, a single EC2 instance or ECS task eliminates this concern. When scaling:

- Single instance (v1): EC2 t3.micro or ECS Fargate task — no sticky session config needed.
- Multi-instance (future): Use Socket.io Redis Adapter (`@socket.io/redis-adapter`) so room state syncs across instances. ALB with sticky sessions (duration-based) for HTTP upgrade handshake.

In-memory `Map` for room state is intentional for v1. Migration path to Redis is additive: replace `Map` with Redis hash operations behind the same `RoomManager` interface.

---

## Confidence Notes

| Area | Confidence | Basis |
|------|------------|-------|
| Axial hex coordinate system | HIGH | Canonical reference (redblobgames) well-established; algorithms are mathematically stable |
| Socket.io v4 room/event API | HIGH | Stable API unchanged since v3; well-documented patterns |
| Full-snapshot broadcast strategy | HIGH | Industry-standard for small-state turn-based games; documented in multiple multiplayer game architecture guides |
| npm workspaces monorepo | HIGH | Standard Node.js toolchain feature since npm v7 |
| GameState data model | MEDIUM | Derived from PROJECT.md requirements; exact fields will need iteration once Counter Attack board measurements arrive |
| AWS sticky session approach | MEDIUM | Standard ALB configuration; specific ECS task sizing not verified against live docs this session |
| Exact pitch hex coordinates | LOW | Blocking dependency — requires physical board measurement (explicitly flagged in PROJECT.md) |
