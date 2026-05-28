<!-- GSD:project-start source:PROJECT.md -->

## Project

**Counter Attack POC**

A 2-player real-time web implementation of Counter Attack, the hex-grid football strategy board game by Webstar Games. Two players connect via a shared room code and play a match through a browser — no installation required. The game models the physical board faithfully: hex movement, dice rolls, pass accuracy checks, Zone of Influence, and shooting duels, with a chess-like click-to-move interface.

**Core Value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

### Constraints

- **Tech — Backend**: Node.js + Socket.io; keeps the WebSocket layer portable to AWS (EC2, Elastic Beanstalk, ECS)
- **Tech — Frontend**: React (Vite); served as static files, can be hosted on S3+CloudFront later
- **Deployment target**: AWS — architecture decisions throughout must support straightforward AWS deployment as the final phase
- **Scope**: Core rules only in v1; full rulebook fidelity deferred to future milestones
- **Multiplayer**: Real-time only (no async/turn-timer mode); requires active WebSocket connection
- **Pitch layout**: Exact hex grid coordinates depend on user-provided board photo/measurements — treat as a blocking dependency for accurate hex rendering

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

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

## Option Analysis

### 1. WebSocket Library

- **Room management built-in.** `socket.join(roomCode)` and `io.to(roomCode).emit(...)` map directly to the "room code lobby" pattern. No hand-rolling broadcast logic.
- **Reconnection with state recovery.** If a player drops briefly, Socket.io's built-in exponential-backoff reconnection restores the connection without losing the room association. The server can re-emit current game state on `reconnect` events. This matters for a game that can run 45+ actions per half.
- **Namespace support.** Not strictly needed for v1 (one game type), but allows future isolation of lobby vs. game traffic without spinning up new servers.
- **Fallback transports.** Socket.io starts with HTTP long-polling and upgrades to WebSocket. For a game, this is almost always irrelevant (WebSocket will succeed), but it eliminates a class of corporate-firewall failures in production at zero cost.
- **Event-oriented API** fits the game model: `move_piece`, `roll_dice`, `pass_ball`, `end_turn` are natural Socket.io events.

### 2. Backend Framework

- Zero adapter work — `http.Server` wraps Express directly.
- Middleware ecosystem (express-validator for any REST routes, cors, helmet) is mature.
- Elastic Beanstalk Node.js platform is Express-idiomatic; most EB examples are Express.
- Express 4.x is stable. Express 5 is RC but not needed here.
- It's a full opinionated framework — you model game state as a Colyseus `Schema`, which is a serialization format as well as a state model. For a custom hex game with complex state (ZoI calculations, pass arcs, dice results), bending your domain model to fit Colyseus Schema is more friction than writing plain objects + Socket.io events.
- Colyseus targets action-games with continuous ticks. Counter Attack is event-driven (nothing happens between player actions). Colyseus's simulation loop is unnecessary.
- Colyseus Cloud is a separate paid hosting layer; self-hosting on AWS is documented but less common.
- **Use if:** you want automatic state delta broadcast with zero custom serialization. **Don't use if:** your state transitions are event-driven and you want full control over domain logic.
- Decision: **Skip Colyseus.** The EVENT-driven model of Counter Attack (player clicks → server validates → server emits result) is a natural Socket.io emit pattern that doesn't need Colyseus's continuous sync.
- Version 0.49.x; the project has seen slow recent activity on GitHub.
- boardgame.io wraps its own transport (Multiplayer client backed by Socket.io or a custom WebSocket), which means you're constrained to its transport abstraction.
- The framework's "phases" and "turns" model is powerful for standard card/board games but may fight the Counter Attack model: the 4-5-2 movement sequence and nested sub-phases (shoot → GK chooses → kick/throw/move) require fine-grained phase state that boardgame.io can model but with significant API surface area to learn.
- **Verdict: Skip.** boardgame.io is excellent for simpler turn-based games (chess, checkers, card games) but the added learning cost and framework coupling aren't justified for a complex custom ruleset that already needs custom validation logic.

### 3. Frontend Framework

- Static build output (`vite build`) produces `dist/` that S3+CloudFront can serve directly.
- Vite 5.x dev server with HMR is the fastest feedback loop for iterating on hex grid layout and game UI.
- React 18's concurrent features (Suspense, transitions) aren't needed for this game but don't hurt.
- TypeScript + Vite is first-class (`vite create` templates include TSX).

### 4. Hex Grid Rendering

- Handles offset↔cube coordinate conversion, neighbor calculation, pathfinding distance, range rings — all the geometry needed for highlighting valid move destinations, ZoI calculation, and pass arc validation.
- Pure TypeScript, zero rendering opinions. Works on both client (valid move highlights) and server (game logic validation) — import the same lib in both places.
- v4 is a near-complete rewrite of v3 with better TypeScript support. Use v4.
- Install: `pnpm add honeycomb-grid`
- The Counter Attack pitch is a fixed-size static grid (~20-30 cols × 15-20 rows). At a max of ~600 hexes, SVG is perfectly performant. Canvas is only needed when you're rendering thousands of animated entities at 60fps.
- SVG hexes are ordinary React components (`<polygon points="..."/>`) with click handlers, fill colors, and piece overlays. This is trivially inspectable in DevTools, easy to style with CSS classes, and trivial to animate (CSS transitions on fill for highlights).
- Each piece is an SVG `<circle>` or `<g>` group with a text label. No image assets needed for MVP.

### 5. Client-Side State Management

- Minimal boilerplate. One `create()` call, no reducers, no providers beyond the store itself.
- Socket.io event handlers call `store.setState(...)` directly — no Redux action/dispatch overhead.
- Zustand's selector subscriptions mean only components that read `selectedPiece` re-render when it changes, not the whole game board.

### 6. TypeScript and Shared Types

### 7. Monorepo Structure

## AWS Deployment Path

### Recommended: Elastic Beanstalk (Single Instance, Node.js platform)

| Option                              | Stateful WebSocket Support                                                 | Operational Complexity                                     | Cost (POC)             | Verdict          |
| ----------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------- | ---------------- |
| EC2 (direct)                        | Yes (single process)                                                       | High — manual AMI, security groups, SSH                    | Low                    | Over-operated    |
| Elastic Beanstalk (single instance) | Yes (single process)                                                       | Low — EB handles provisioning                              | Low (~$15/mo t3.micro) | **Recommended**  |
| ECS/Fargate                         | Yes with Redis adapter                                                     | High — task definitions, service mesh, ALB sticky sessions | Medium                 | Overkill for POC |
| App Runner                          | Limited — designed for HTTP; WebSocket support requires careful ALB config | Medium                                                     | Medium                 | Risky            |
| Lambda + API Gateway WebSocket      | Yes but stateless — requires DynamoDB for room state                       | High                                                       | Variable               | Wrong model      |

- EB's Node.js platform deploys a ZIP or Git push. `eb deploy` is a one-command deploy.
- Single instance = in-memory room state works without Redis.
- EB handles: instance health checks, log streaming to CloudWatch, environment variable management.
- t3.micro (~$8-15/month) is adequate for a POC with 2 concurrent players.
- **Scale path:** When you need more capacity, add the Socket.io Redis adapter (`@socket.io/redis-adapter`), move to EB load-balanced tier, and point at ElastiCache Redis. No code changes to game logic — only Socket.io configuration changes.
- `vite build` → `dist/` → `aws s3 sync dist/ s3://bucket`
- CloudFront distribution with the S3 bucket as origin.
- Socket.io server URL injected via `VITE_SOCKET_URL` env var at build time.
- CloudFront handles HTTPS termination for the frontend; EB handles HTTPS for the WebSocket server (via EB's ACM certificate integration).
- EB's load balancer (when used) must be configured with Application Load Balancer (ALB) + sticky sessions enabled, or the WebSocket upgrade will fail on multi-instance setups. For single-instance EB (POC), this is a non-issue — there's no LB in the path.
- Set via `eb setenv` or EB console. Never commit secrets.
- `NODE_ENV=production`, `PORT=8080` (EB expects 8080 by default).

## What NOT to Use

### Colyseus

### boardgame.io

### Redux Toolkit (on the client)

### Phaser.js / PixiJS / Three.js

### Raw WebSocket (`ws` npm package without Socket.io)

### Lambda + API Gateway WebSocket API

### Canvas (HTML5 Canvas API directly)

### Multiple Repos (separate client + server)

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

## Version Summary (Install Reference)

# Shared

# Server (packages/server)

# Client (packages/client)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.

<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
