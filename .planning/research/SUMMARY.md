# Research Summary — Counter Attack Web

**Project:** Counter Attack POC
**Domain:** Real-time 2-player multiplayer hex-grid turn-based board game
**Researched:** 2026-05-27
**Confidence:** HIGH (stack, architecture, pitfalls); LOW (exact board coordinates)

---

## Recommended Stack

| Layer             | Choice                                                  | Version    |
| ----------------- | ------------------------------------------------------- | ---------- |
| Runtime           | Node.js                                                 | 22 LTS     |
| Backend framework | Express                                                 | 4.x        |
| WebSocket         | Socket.io server + client                               | 4.x        |
| Frontend          | React + Vite                                            | 18.x + 5.x |
| Hex grid math     | honeycomb-grid                                          | 4.x        |
| Hex rendering     | React inline SVG components                             | —          |
| Client state      | Zustand                                                 | 4.x        |
| Language          | TypeScript                                              | 5.x        |
| Monorepo          | pnpm workspaces                                         | 9.x        |
| Deployment        | AWS Elastic Beanstalk (single instance) + S3/CloudFront | —          |

**Do not use:** Colyseus (Schema model fights event-driven domain logic), boardgame.io (slow maintenance, framework coupling not justified), Redux (boilerplate disproportionate to state complexity), Canvas/Phaser/Pixi (overkill for 22 pieces on a static grid), raw ws package (reimplements what Socket.io provides for free), Lambda+API Gateway WebSocket (stateless model wrong for in-memory room state).

---

## Critical Architectural Decisions

These must be locked in before or during Phase 1. Retrofitting any of them is expensive.

### 1. Server-Authoritative State (no optimistic updates)

The server owns the single canonical GameState. Clients send intent events (game:move, game:roll); the server validates, mutates state, and broadcasts a full snapshot to both players. Clients are read-only renderers. Full-snapshot broadcast is correct for this game (state is small, ~5KB). No JSON Patch or differential sync needed. Reconnection is trivial: resend current snapshot.

### 2. Axial Hex Coordinates Everywhere

Use axial (q, r) for all internal game logic. Convert to pixel only at render time in hexToPixel.ts. Offset coordinates produce irregular neighbor arithmetic and ZoI bugs at grid edges. Axial gives identical algorithmic power to cube (s = -q - r derived on demand). Commit to this before placing the first hex. Key functions live in packages/shared/src/hex.ts and are imported by both server and client.

### 3. pnpm Monorepo with packages/shared

Three packages: shared (TypeScript interfaces + pure hex math + socket event constants), server (Express + Socket.io + game engine), client (React + Vite). Socket.io typed events via generics on Socket<ServerToClientEvents, ClientToServerEvents> catch event name typos and payload mismatches at compile time.

### 4. Explicit Phase FSM (not if/else chains)

The game has 12+ distinct phases (KICKOFF, MOVEMENT_ATTACKER_1, MOVEMENT_DEFENDER, MOVEMENT_ATTACKER_2, ACTION_CHOICE, PASS_RESOLUTION, SHOT_RESOLUTION, HEADING_DUEL, LOOSE_BALL, GK_RESTART, HALF_TIME, FULL_TIME). Model as a plain object FSM: { [phase]: { validActions, onAction, onEnter, onExit } }. Every transition goes through a single transition(room, action, payload) function. Define this structure before implementing the second game phase.

### 5. Per-Room Processing Mutex

Each room holds isProcessing: boolean. Set to true when a handler starts, false after state broadcast. Reject any action arriving while flag is set. Add this before writing any game logic.

---

## Table Stakes Features

| Feature                                                         | Why Non-Negotiable                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| Room code create/join (6-char alphanumeric, no ambiguous chars) | This IS the product entry point                            |
| Copy-to-clipboard room code                                     | Players share over Discord; friction kills sessions        |
| Waiting for opponent screen showing code again                  | Clear feedback loop                                        |
| Session token in sessionStorage for reconnect identity          | Scoped to tab, not browser                                 |
| Reconnect grace period (90s) with opponent notified             | Any network hiccup otherwise kills the session permanently |
| Abandonment notice after timeout                                | Players must never see a frozen board with no explanation  |
| Whose-turn indicator with phase and actions remaining           | Largest persistent UI element after the board              |
| Valid move highlighting on piece selection                      | Without it the game is a rulebook memory test              |
| Last action feedback / action log (last 5 entries)              | Passive player needs narration                             |
| Click-to-roll dice with result displayed prominently            | Maximum tension moment; never auto-roll                    |
| Connection status indicator (green/yellow/red dot)              | Players must never wonder if connection is live            |
| Game over screen with Rematch and Back to Lobby options         | Without it players cannot tell if the game crashed         |

**Build in v1 (low effort, high value):**

- Rematch flow: reuse room, reset game state, swap sides
- Move log panel: nearly free once event sourcing exists for reconnect replay

**Defer to v2:** turn timer, spectator mode, sound cues
**Never in v1:** accounts, matchmaking, animations, mobile layout, persistent replay, team selection UI, chat

---

## Build Order

Each phase unlocks the next. Phase 6 can run in parallel with Phases 4-5.

```
Phase 1: Repo scaffold + shared types
  - Monorepo (pnpm workspaces), TypeScript config, @ca/shared package
  - HexCoord, GameState, PlayerPiece, BallState, GamePhase types
  - Pure hex math: hexDistance, hexNeighbors, hexesInRange, isUnderZoI
  - Socket event name constants typed as const
  - PITCH_HEXES placeholder set (see Blocking Dependencies)

Phase 2: Move validator + unit tests  [needs Phase 1]
  - moveValidator.ts as pure functions, zero socket.io imports
  - ZoI enforcement, pass range per type, 4-5-2 movement tracking
  - 20+ unit tests: legal/illegal paths, ZoI edge cases
  - JSON board state fixtures for test scenarios

Phase 3: Room manager + Socket.io scaffold  [needs Phase 1]
  - roomManager.ts: create, join, disconnect, reconnect, cleanup timer
  - Socket event router (stub game engine, no rules yet)
  - Session token flow (sessionStorage to server identity map)
  - Disconnect timer (90s) + abandonment emit
  - /health endpoint for AWS ALB health check

Phase 4: Game engine + phase FSM (deterministic)  [needs Phases 2 + 3]
  - Explicit FSM object structure defined before first phase implemented
  - Movement phase: piece selection, destination validation, 4-5-2 tracking
  - Phase transitions: attacker 1 -> defender -> attacker 2 -> action choice
  - Per-room mutex before any action handler logic
  - Fixed dummy dice for resolution steps (non-determinism deferred)
  - Full game:state broadcast after every action

Phase 5: Dice resolver + all resolution branches  [needs Phase 4]
  - Server-side crypto.randomInt dice, never client-side
  - Pass accuracy, shot/save duel, heading duel, loose ball direction + distance
  - GK restart choice (kick/throw/movement phase)
  - Pending action + dice result captured in GameState for broadcast

Phase 6: Frontend hex renderer  [needs Phase 1; runs parallel to Phases 4-5]
  - React SVG pitch component fed by hardcoded mock GameState
  - axialToPixel conversion, pointy-top orientation
  - Piece overlay, ball marker, valid-move hex highlighting
  - Turn indicator, action log panel, dice display, scoreboard
  - Lobby UI (create/join/waiting screens)

Phase 7: Frontend socket integration  [needs Phases 4 + 6]
  - useGameSocket hook wires live game:state events to Zustand store
  - Click handlers emit game:move, game:action, game:roll
  - Reconnect banner, connection status indicator
  - Opponent disconnect and abandonment UI
  - Rematch flow

Phase 8: Half and match lifecycle  [needs Phase 7 stable]
  - Action counter (45 + added time per half)
  - Added time = dice roll + referee Leniency (random referee card)
  - Half-time transition, kick-off procedure, second half, full-time

Phase 9: AWS deployment  [needs Phase 8]
  - Elastic Beanstalk single-instance Node.js platform
  - S3 + CloudFront for React build (vite build -> dist/)
  - ALB idle timeout to 3600s; Socket.io pingInterval: 25000
  - transports: websocket-only on client (eliminates sticky session requirement)
  - Environment variables via eb setenv
```

---

## Top Pitfalls to Avoid

| #   | Pitfall                                                             | One-Line Prevention                                                                         |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Duplicate socket event listeners accumulate on re-render            | Always return socket.off(event, handler) from every useEffect that calls socket.on          |
| 2   | Client-side state authority; optimistic updates diverge from server | Define server GameState shape before writing the first socket handler; clients never mutate |
| 3   | Mixed hex coordinate systems mid-project                            | Axial (q, r) everywhere from day one; pixel conversion only in hexToPixel.ts                |
| 4   | Phase logic as if/else chains                                       | Define FSM object structure before implementing the second game phase                       |
| 5   | ALB idle timeout drops WebSocket connections (AWS default 60s)      | Set ALB idle timeout to 3600s and configure Socket.io pingInterval: 25000                   |

**Also dangerous:**

- Room not cleaned up on disconnect: wire disconnect handler in same commit as room creation
- Turn race condition from double-click: add per-room isProcessing boolean before any game logic
- Reconnect leaves client in stale state: request full state snapshot on every connect event
- Dice authoritative on client: server generates all dice with crypto.randomInt
- ZoI applied inconsistently: single pure function with ruleVariant parameter plus unit tests

---

## Blocking Dependencies

### HARD BLOCK: Physical Board Measurements

**Blocks:** Accurate PITCH_HEXES in Phase 1, accurate hex renderer in Phase 6, all boundary-dependent rule validation (goal detection, penalty box snapshots, pitch edge enforcement).

The Counter Attack pitch has specific hex positions, goal positions, and penalty box boundaries that must be measured from the physical board and encoded as axial (q, r) coordinates in packages/shared/src/pitch.ts.

**Workaround while blocked:** Use a placeholder rectangular grid. Phases 2-5 (pure logic) are not blocked. Phases 6-8 will have inaccurate layouts until real coordinates arrive.

**Resolution path:** Provide a photo or measured dimensions of the physical board, encode as axial coordinate map, replace placeholder in pitch.ts.

### SOFT BLOCK: Referee Card Attributes

**Blocks:** Phase 8 added time calculation. Clarify whether Leniency is a fixed value per card or a range, and whether the card affects anything beyond added time. Hardcode one card for v1.

---

## Open Questions

| #   | Question                                                                          | Affects                                  | Action                                                                          |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Exact axial coordinates of every pitch hex, goal, penalty box, kickoff hex        | Phases 1, 4, 6                           | Hard block; requires physical board measurement                                 |
| 2   | Flat-top or pointy-top hex orientation?                                           | axialToPixel formula, SVG polygon points | Confirm against physical board before first render                              |
| 3   | Both hardcoded squad attribute values (all 9 attributes per player)?              | Phase 5 dice resolution                  | Define before Phase 5; use realistic attribute ranges                           |
| 4   | Does referee card affect anything beyond Leniency/added time?                     | Phase 8                                  | Clarify from rulebook v1.4.1; hardcode one card for v1                          |
| 5   | Are pass ranges (11/6/15 hex) hex ring distance or Manhattan distance?            | Phase 2 move validator                   | Verify from rulebook before implementing pass validation                        |
| 6   | Does ZoI block movement destinations or only passing/dribbling paths?             | Phase 2 move validator                   | Confirm from rulebook; research assumes ZoI blocks pass/dribble not movement    |
| 7   | Does penalty box snapshot trigger during movement AND after a pass, or only one?  | Phase 4 action choice                    | Confirm from rulebook; affects when ACTION_CHOICE phase is entered              |
| 8   | Is a draw a valid full-time outcome or is there a tiebreaker?                     | Phase 8 game over                        | Confirm from rulebook; default draw is valid for v1                             |
| 9   | Valid moves computed on piece selection or precomputed for all pieces post-state? | Phase 4, Phase 7 UX                      | Recommendation: compute on selection; server emits game:valid-moves in response |

---

## Confidence Assessment

| Area                    | Confidence | Notes                                                                                           |
| ----------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Stack choices           | HIGH       | All core technologies are stable major versions with well-documented APIs                       |
| Architecture patterns   | HIGH       | Server-authority, full-snapshot broadcast, axial coords, monorepo are well-established          |
| Feature set             | HIGH       | Lobby/reconnect/turn indicator/valid move highlighting are universal web board game conventions |
| Pitfalls                | HIGH       | All critical pitfalls are well-documented Socket.io/Node.js/hex-grid community patterns         |
| Exact board coordinates | LOW        | Blocking dependency; requires physical board; cannot be resolved from research alone            |
| Pass range rules        | MEDIUM     | Distances noted but distance type not confirmed against rulebook v1.4.1                         |
| Referee card behavior   | MEDIUM     | Added time formula understood; whether Leniency affects other rules is unconfirmed              |

**Overall confidence:** HIGH for all technical and architectural decisions. LOW only for domain-specific board geometry, which is an explicit constraint already acknowledged in PROJECT.md.

**Gaps to address before each phase:**

- Board measurements: use placeholder rectangular grid until resolved; flag explicitly in Phase 1
- Rulebook pass ranges: verify hex distance type before implementing Phase 2 move validator
- Team squad attributes: define all 9 attributes for both hardcoded squads before Phase 5
- ZoI scope: confirm whether it blocks movement destinations or only pass/dribble paths before Phase 2

---

## Sources

All research drawn from training knowledge (cutoff August 2025). External web access was unavailable during the research session.

**HIGH confidence:**

- Socket.io v4 documentation: rooms, typed events, reconnection, disconnect, ping/pong
- redblobgames.com/grids/hexagons: canonical hex coordinate reference; axial/cube/offset tradeoffs and all key algorithms
- honeycomb-grid v4 npm documentation: hex math library API
- Node.js crypto module: crypto.randomInt for server-side dice
- Lichess, Chess.com, BoardGameArena, Jackbox: UX conventions for web board games
- AWS ALB documentation: idle timeout defaults, sticky sessions, target group health checks

**MEDIUM confidence (verify before relevant phase):**

- Elastic Beanstalk Node.js platform WebSocket/ALB behavior: verify current EB docs before deployment phase
- honeycomb-grid v4 specific API details: confirm against npm readme at implementation time

**Validate from rulebook:**

- Counter Attack Rules Reference v1.4.1 (Giannis Tilias): pass ranges, ZoI scope, referee card rules, penalty box snapshot trigger conditions

---

_Research completed: 2026-05-27_
_Ready for roadmap: yes, pending board measurement for accurate pitch coordinates_
