# Stack Research — Counter Attack Web

**Project:** Counter Attack POC — 2-player real-time browser multiplayer
**Researched:** 2026-05-27
**Research note:** External tool access (Bash, WebSearch, WebFetch) was unavailable in this environment. Findings are drawn from training knowledge (cutoff August 2025). Confidence levels reflect this. Core technologies (Socket.io, React, Vite, honeycomb-grid, AWS) are stable and well-documented; confidence is HIGH for these. Newer ecosystem nuances are flagged MEDIUM.

---

## Recommended Stack

### At a Glance

| Layer               | Choice                              | Version |
| ------------------- | ----------------------------------- | ------- |
| Backend runtime     | Node.js                             | 22 LTS  |
| Backend framework   | Express                             | 4.x     |
| WebSocket layer     | Socket.io (server)                  | 4.x     |
| WebSocket client    | socket.io-client                    | 4.x     |
| Frontend framework  | React                               | 18.x    |
| Frontend build tool | Vite                                | 5.x     |
| Hex grid math       | honeycomb-grid                      | 4.x     |
| Hex rendering       | SVG (inline React components)       | —       |
| Client state        | Zustand                             | 4.x     |
| TypeScript          | ts everywhere                       | 5.x     |
| Monorepo tooling    | pnpm workspaces                     | 9.x     |
| AWS deployment      | Elastic Beanstalk (single instance) | —       |

---

## Option Analysis

### 1. WebSocket Library

**Recommended: Socket.io v4 (server) + socket.io-client v4 (client)**

Socket.io is the correct choice here and aligns with the project constraint already recorded in PROJECT.md. Rationale specific to Counter Attack:

- **Room management built-in.** `socket.join(roomCode)` and `io.to(roomCode).emit(...)` map directly to the "room code lobby" pattern. No hand-rolling broadcast logic.
- **Reconnection with state recovery.** If a player drops briefly, Socket.io's built-in exponential-backoff reconnection restores the connection without losing the room association. The server can re-emit current game state on `reconnect` events. This matters for a game that can run 45+ actions per half.
- **Namespace support.** Not strictly needed for v1 (one game type), but allows future isolation of lobby vs. game traffic without spinning up new servers.
- **Fallback transports.** Socket.io starts with HTTP long-polling and upgrades to WebSocket. For a game, this is almost always irrelevant (WebSocket will succeed), but it eliminates a class of corporate-firewall failures in production at zero cost.
- **Event-oriented API** fits the game model: `move_piece`, `roll_dice`, `pass_ball`, `end_turn` are natural Socket.io events.

**Raw `ws` (npm package):** Lower overhead, no abstractions. For 2 concurrent players the overhead difference is unmeasurable. `ws` requires implementing rooms, reconnection, and heartbeats from scratch. Not justified here.

**uWebSockets.js:** Highest performance, used by Colyseus internally. Absolute overkill for 2-player turn-based gameplay. C++ bindings; harder to deploy on AWS Elastic Beanstalk. Avoid.

**Ably / Pusher / PartyKit (hosted WebSocket services):** Add a third-party dependency and monthly cost for what is a self-hosted hobby/POC project targeting AWS. Avoid.

---

### 2. Backend Framework

**Recommended: Express 4.x + Socket.io 4.x**

Express is the lowest-friction pairing with Socket.io. The canonical Socket.io setup (`const httpServer = createServer(app); const io = new Server(httpServer)`) is Express-first. Benefits:

- Zero adapter work — `http.Server` wraps Express directly.
- Middleware ecosystem (express-validator for any REST routes, cors, helmet) is mature.
- Elastic Beanstalk Node.js platform is Express-idiomatic; most EB examples are Express.
- Express 4.x is stable. Express 5 is RC but not needed here.

**Fastify:** Better performance and schema validation story than Express, but Socket.io integration requires `fastify-socket.io` plugin, adding an adapter layer for no real benefit at 2-player scale. Avoid for this project.

**Colyseus:** A dedicated multiplayer game server framework with authoritative state sync via delta patches. It would handle rooms, reconnection, and serialization automatically. However:

- It's a full opinionated framework — you model game state as a Colyseus `Schema`, which is a serialization format as well as a state model. For a custom hex game with complex state (ZoI calculations, pass arcs, dice results), bending your domain model to fit Colyseus Schema is more friction than writing plain objects + Socket.io events.
- Colyseus targets action-games with continuous ticks. Counter Attack is event-driven (nothing happens between player actions). Colyseus's simulation loop is unnecessary.
- Colyseus Cloud is a separate paid hosting layer; self-hosting on AWS is documented but less common.
- **Use if:** you want automatic state delta broadcast with zero custom serialization. **Don't use if:** your state transitions are event-driven and you want full control over domain logic.
- Decision: **Skip Colyseus.** The EVENT-driven model of Counter Attack (player clicks → server validates → server emits result) is a natural Socket.io emit pattern that doesn't need Colyseus's continuous sync.

**boardgame.io:** A framework for turn-based games specifically: handles move validation, turn order, phases, and multiplayer transport. Strong conceptual fit for Counter Attack.

- Version 0.49.x; the project has seen slow recent activity on GitHub.
- boardgame.io wraps its own transport (Multiplayer client backed by Socket.io or a custom WebSocket), which means you're constrained to its transport abstraction.
- The framework's "phases" and "turns" model is powerful for standard card/board games but may fight the Counter Attack model: the 4-5-2 movement sequence and nested sub-phases (shoot → GK chooses → kick/throw/move) require fine-grained phase state that boardgame.io can model but with significant API surface area to learn.
- **Verdict: Skip.** boardgame.io is excellent for simpler turn-based games (chess, checkers, card games) but the added learning cost and framework coupling aren't justified for a complex custom ruleset that already needs custom validation logic.

---

### 3. Frontend Framework

**Recommended: React 18.x + Vite 5.x**

Locked in by project constraint (PROJECT.md). Rationale confirmed:

- Static build output (`vite build`) produces `dist/` that S3+CloudFront can serve directly.
- Vite 5.x dev server with HMR is the fastest feedback loop for iterating on hex grid layout and game UI.
- React 18's concurrent features (Suspense, transitions) aren't needed for this game but don't hurt.
- TypeScript + Vite is first-class (`vite create` templates include TSX).

**Svelte / SvelteKit:** Smaller bundle, simpler reactivity. Not worth switching from the stated constraint, and the React ecosystem's hex-grid visualization tooling (React wrappers for SVG) is more mature.

**Plain Canvas (no framework):** Canvas is appropriate for action games with many simultaneous moving objects. Counter Attack has a static grid with ~22 pieces that move one at a time. React + SVG is more maintainable, debuggable, and sufficient for this render load. Avoid raw canvas.

---

### 4. Hex Grid Rendering

**Recommended: honeycomb-grid 4.x for hex math + inline React SVG for rendering**

Two separate concerns:

**Hex coordinate math (honeycomb-grid 4.x):**

- Handles offset↔cube coordinate conversion, neighbor calculation, pathfinding distance, range rings — all the geometry needed for highlighting valid move destinations, ZoI calculation, and pass arc validation.
- Pure TypeScript, zero rendering opinions. Works on both client (valid move highlights) and server (game logic validation) — import the same lib in both places.
- v4 is a near-complete rewrite of v3 with better TypeScript support. Use v4.
- Install: `pnpm add honeycomb-grid`

**Rendering: inline React SVG components (not canvas, not a map library):**

- The Counter Attack pitch is a fixed-size static grid (~20-30 cols × 15-20 rows). At a max of ~600 hexes, SVG is perfectly performant. Canvas is only needed when you're rendering thousands of animated entities at 60fps.
- SVG hexes are ordinary React components (`<polygon points="..."/>`) with click handlers, fill colors, and piece overlays. This is trivially inspectable in DevTools, easy to style with CSS classes, and trivial to animate (CSS transitions on fill for highlights).
- Each piece is an SVG `<circle>` or `<g>` group with a text label. No image assets needed for MVP.

**Why not react-hexgrid (npm package):** It's a thin SVG abstraction that generates hex grids in React. Usable, but adds a dependency that constrains layout control. For Counter Attack's specific pitch layout (with goal area shapes, penalty box markings, center circle), you'll need custom SVG elements anyway — better to own the SVG directly.

**Why not Phaser.js / PixiJS:** Game engines for canvas-rendered sprite-based games. Far beyond what a click-to-move board game needs. Their multiplayer integration paths are non-trivial. Avoid.

**Why not CSS hex grids:** CSS clip-path hex grids are a known pattern but hit-testing for clicks, overlaying pieces, and dynamic highlights all become painful. SVG handles all three naturally.

---

### 5. Client-Side State Management

**Recommended: Zustand 4.x**

The client state for Counter Attack is a mirror of server game state, with local UI overlays (selected piece, highlighted hexes, pending action). The state shape:

```
{
  gameState: GameState        // authoritative — received from server
  selectedPiece: PieceId | null   // local UI
  validMoves: HexCoord[]     // derived client-side or received from server
  diceResult: DiceRoll | null    // transient display
  phase: UIPhase              // mirrors server phase
}
```

Zustand fits because:

- Minimal boilerplate. One `create()` call, no reducers, no providers beyond the store itself.
- Socket.io event handlers call `store.setState(...)` directly — no Redux action/dispatch overhead.
- Zustand's selector subscriptions mean only components that read `selectedPiece` re-render when it changes, not the whole game board.

**Redux Toolkit:** The correct choice if you have a large team needing strict discipline, time-travel debugging, or complex side-effect management. For a 2-developer POC with straightforward state transitions, Redux's boilerplate is unwarranted overhead. Avoid.

**React Context + useReducer:** Viable for simple cases. Context re-renders all subscribers on any state change unless carefully split into many contexts. Given the board re-renders on every move update and that's expected, Context would be fine — but Zustand's ergonomics and performance ceiling are better for no extra cost.

**Jotai:** Atom-based. Works well but the atomic model is a worse fit than Zustand's single-store model for game state that arrives as a complete server snapshot. Avoid.

---

### 6. TypeScript and Shared Types

**Recommended: TypeScript 5.x across the monorepo, shared `packages/shared` for game types**

The most impactful architectural decision for DX is sharing types between client and server:

```
packages/
  shared/        ← GameState, PieceId, HexCoord, Move, DiceRoll, SocketEvents
  server/        ← imports from shared
  client/        ← imports from shared
```

Socket.io supports typed events natively:

```typescript
// packages/shared/src/socket-events.ts
export interface ServerToClientEvents {
  game_state_update: (state: GameState) => void;
  dice_result: (roll: DiceRoll) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  move_piece: (move: Move) => void;
  roll_dice: () => void;
  join_room: (roomCode: string) => void;
}
```

These interfaces are passed as generics to `Socket<...>` on both sides, eliminating a class of event name typos and payload mismatches.

---

### 7. Monorepo Structure

**Recommended: pnpm workspaces (no Turborepo/Nx needed for v1)**

```
counter-attack/
  packages/
    shared/          ← TypeScript types + game rule utilities (hex math wrappers)
    server/          ← Express + Socket.io + game engine
    client/          ← React + Vite
  pnpm-workspace.yaml
  package.json       ← root scripts
  tsconfig.base.json ← shared TS config
```

pnpm workspaces handle cross-package imports (`@ca/shared`) without build step overhead during development (tsconfig paths resolve directly). pnpm is faster than npm/yarn for monorepos, and workspace hoisting eliminates duplicate `node_modules`.

**Turborepo:** Useful when you have complex build pipelines with many packages. For 3 packages, pnpm workspace scripts are sufficient. Add Turborepo only if build times become painful.

**Separate repos:** Sharing TypeScript types between separate repos requires publishing to npm or using git submodules — both add operational overhead. Monorepo is clearly correct here.

---

## AWS Deployment Path

### Recommended: Elastic Beanstalk (Single Instance, Node.js platform)

**Why EB over alternatives for this project:**

The core constraint is that a Socket.io server maintains in-memory room state. A game room lives in the process. This rules out stateless multi-instance deployments without a Redis adapter.

| Option                              | Stateful WebSocket Support                                                 | Operational Complexity                                     | Cost (POC)             | Verdict          |
| ----------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------- | ---------------- |
| EC2 (direct)                        | Yes (single process)                                                       | High — manual AMI, security groups, SSH                    | Low                    | Over-operated    |
| Elastic Beanstalk (single instance) | Yes (single process)                                                       | Low — EB handles provisioning                              | Low (~$15/mo t3.micro) | **Recommended**  |
| ECS/Fargate                         | Yes with Redis adapter                                                     | High — task definitions, service mesh, ALB sticky sessions | Medium                 | Overkill for POC |
| App Runner                          | Limited — designed for HTTP; WebSocket support requires careful ALB config | Medium                                                     | Medium                 | Risky            |
| Lambda + API Gateway WebSocket      | Yes but stateless — requires DynamoDB for room state                       | High                                                       | Variable               | Wrong model      |

**Elastic Beanstalk for POC:**

- EB's Node.js platform deploys a ZIP or Git push. `eb deploy` is a one-command deploy.
- Single instance = in-memory room state works without Redis.
- EB handles: instance health checks, log streaming to CloudWatch, environment variable management.
- t3.micro (~$8-15/month) is adequate for a POC with 2 concurrent players.
- **Scale path:** When you need more capacity, add the Socket.io Redis adapter (`@socket.io/redis-adapter`), move to EB load-balanced tier, and point at ElastiCache Redis. No code changes to game logic — only Socket.io configuration changes.

**Frontend: S3 + CloudFront**

- `vite build` → `dist/` → `aws s3 sync dist/ s3://bucket`
- CloudFront distribution with the S3 bucket as origin.
- Socket.io server URL injected via `VITE_SOCKET_URL` env var at build time.
- CloudFront handles HTTPS termination for the frontend; EB handles HTTPS for the WebSocket server (via EB's ACM certificate integration).

**EB WebSocket configuration note:**

- EB's load balancer (when used) must be configured with Application Load Balancer (ALB) + sticky sessions enabled, or the WebSocket upgrade will fail on multi-instance setups. For single-instance EB (POC), this is a non-issue — there's no LB in the path.

**Environment variables on EB:**

- Set via `eb setenv` or EB console. Never commit secrets.
- `NODE_ENV=production`, `PORT=8080` (EB expects 8080 by default).

---

## What NOT to Use

### Colyseus

Skip for Counter Attack. Its Schema serialization model and continuous simulation loop are the wrong primitives for an event-driven turn-based game. You'd spend time bending domain logic to fit the framework instead of implementing rules. The framework shines for real-time action games (shooters, racing) and simple board games; Counter Attack's nested rule interactions are better served by plain objects + Socket.io events.

### boardgame.io

Slow GitHub activity (potential maintenance risk). Adds framework coupling for a game with complex custom phases. The mental overhead of learning boardgame.io's phases/moves/turns API isn't justified when your entire backend can be ~500 lines of plain TypeScript + Socket.io event handlers.

### Redux Toolkit (on the client)

Boilerplate cost is disproportionate to the state complexity of mirroring game state from a single Socket.io source of truth. Zustand achieves the same result in fewer files.

### Phaser.js / PixiJS / Three.js

Game engines for rendering-heavy games. Counter Attack needs a static hex grid with piece markers. React + SVG is appropriate and fully sufficient. These engines add thousands of KB to the bundle and introduce a rendering abstraction that fights React's component model.

### Raw WebSocket (`ws` npm package without Socket.io)

You'd reimplement rooms, reconnection, heartbeats, and event serialization. Socket.io provides all of these with negligible overhead for 2 concurrent players. The "simpler" raw approach is actually more code to maintain.

### Lambda + API Gateway WebSocket API

Serverless WebSocket is architecturally mismatched with stateful game sessions. In-memory room state would be destroyed between Lambda invocations. Making it work requires DynamoDB for room state, SQS for broadcasting, and significantly more complex connection management. Use an always-on process (EB) instead.

### Canvas (HTML5 Canvas API directly)

Over-engineered for a static grid. Debugging canvas output requires custom tooling. Accessibility is zero. SVG components give you DevTools inspectability, CSS styling, and React event delegation for free.

### Multiple Repos (separate client + server)

Type sharing across repos requires either npm publishing or git submodules. Both add friction. A pnpm monorepo solves this cleanly.

---

## Confidence Levels

| Area                                | Confidence | Reasoning                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Socket.io v4 recommendation         | HIGH       | Socket.io is stable since 2020; v4 API is documented and unchanged in material ways. Project constraint already specifies it. Room/reconnection behavior is well-understood.                                                                                                                                      |
| Express 4.x + Socket.io pairing     | HIGH       | Canonical pairing. Every Socket.io tutorial uses Express. No meaningful alternatives for this scale.                                                                                                                                                                                                              |
| React 18 + Vite 5                   | HIGH       | Project constraint specifies React + Vite. Vite 5 released late 2023; stable. React 18 stable since 2022.                                                                                                                                                                                                         |
| honeycomb-grid 4.x for hex math     | HIGH       | Honeycomb is the dominant hex-grid math library in the JS ecosystem. v4 TypeScript support is well-documented.                                                                                                                                                                                                    |
| SVG over Canvas for rendering       | HIGH       | The tradeoff is well-understood. Grid size (≤600 hexes, 22 pieces) is well within SVG's comfortable performance range.                                                                                                                                                                                            |
| Zustand 4.x for client state        | HIGH       | Zustand is the widely-adopted minimal-boilerplate state library. v4 is stable. Alternatives are known and the tradeoffs are clear.                                                                                                                                                                                |
| TypeScript shared packages monorepo | HIGH       | pnpm workspaces + shared types is standard practice. Socket.io typed events are documented in Socket.io v4 docs.                                                                                                                                                                                                  |
| Elastic Beanstalk for deployment    | MEDIUM     | EB is a well-understood AWS service. The recommendation for single-instance (to avoid Redis dependency) is architecturally sound. Medium confidence because EB's Node.js platform version support and specific WebSocket behavior on ALB should be verified against current AWS docs before the deployment phase. |
| Skip Colyseus recommendation        | MEDIUM     | Assessment is based on understanding Colyseus's architecture from training data. Recommend re-evaluating current Colyseus docs at the server scaffolding phase to confirm the Schema model is as constraining as assessed.                                                                                        |
| Skip boardgame.io recommendation    | MEDIUM     | Based on GitHub activity assessment from training data (cutoff Aug 2025). Verify current repo activity before definitively ruling it out. If it has seen active maintenance, it becomes more viable.                                                                                                              |

---

## Version Summary (Install Reference)

```
# Shared
pnpm add honeycomb-grid@^4 typescript@^5

# Server (packages/server)
pnpm add express@^4 socket.io@^4
pnpm add -D @types/express @types/node ts-node nodemon

# Client (packages/client)
pnpm add react@^18 react-dom@^18 zustand@^4 socket.io-client@^4
pnpm add -D vite@^5 @vitejs/plugin-react typescript@^5 @types/react @types/react-dom
```
