# Counter Attack POC

## What This Is

A 2-player real-time web implementation of Counter Attack, the hex-grid football strategy board game by Webstar Games. Two players connect via a shared room code and play a match through a browser — no installation required. The game models the physical board faithfully: hex movement, dice rolls, pass accuracy checks, Zone of Influence, and shooting duels, with a chess-like click-to-move interface.

## Core Value

Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## Requirements

### Validated

- ARCH-02: pnpm monorepo with three packages (shared, server, client) — all building via `pnpm -r build` (Validated in Phase 1: Monorepo Scaffold + Shared Types)
- ARCH-03: Pure axial hex math (hexDistance, hexNeighbors, hexesInRange, isUnderZoI) with 14 passing unit tests (Validated in Phase 1)
- ARCH-07: packages/shared has zero socket.io/express/honeycomb-grid imports — validation logic fully isolated (Validated in Phase 1)
- MOVE-01..05, PASS-01..05, HEAD-01..05, SNAP-01..03, SHOT-01..04, SHOT-06, DICE-03..05: All rule validators implemented as pure functions with 95 passing unit tests (Validated in Phase 2: Move Validator + Unit Tests, 2026-05-29)
- CONN-01, CONN-02, CONN-03, CONN-04, ARCH-01, ARCH-04: Room create/join, session middleware, reconnect with 90s grace timer, full-snapshot broadcast — live Socket.io server with 126 passing tests (Validated in Phase 3: Server Room Manager + Socket.io Scaffold, 2026-05-29)
- TEAM-01, TEAM-02, TEAM-03, PITCH-01, PITCH-02, PITCH-03: Hardcoded squads (11 players × 9 attributes each), pitch regions with O(1) Set lookups, 4-5-2 FSM over Socket.io with isProcessing mutex, undo, and KICK_OFF→MOVEMENT wire path — 187 passing tests (Validated in Phase 4: Game Engine + Phase FSM, 2026-05-30)

### Active

- [ ] Two players can create and join a match via a shared room code
- [ ] Hex-grid pitch renders the Counter Attack board layout accurately
- [ ] Each team has two hardcoded squads with player attributes (Pace, Shooting, Tackling, Dribbling, Heading, Saving, Handling, Resilience, Aerial Ability)
- [ ] Movement Phase follows the 4-5-2 sequence (Attacker 4 → Defender 5 → Attacker 2 new players ≤2 hexes)
- [ ] Players click to select and move pieces; valid hex destinations highlighted
- [ ] Zone of Influence enforced for passes and dribbling
- [ ] Standard Pass (11 hexes), First-time Pass (6 hexes), High Pass (15 hexes), Long Pass implemented
- [ ] Heading duels follow range rules (1 hex free, 2 hexes = -1 dice penalty)
- [ ] Shooting vs Saving duel resolves a shot on goal
- [ ] Snapshots available in the penalty box during movement or after a pass
- [ ] Dice rolls are player-triggered (click to roll) with result displayed
- [ ] Loose Ball direction and distance resolved by dice
- [ ] Score tracked across two 45-action halves with added time (dice roll + Leniency)
- [ ] Kick off procedure implemented
- [ ] After making a save: GK chooses kick, quick throw, or movement phase
- [ ] Game state is authoritative on the server; clients are display-only

### Out of Scope

- Fouls, bookings, yellow/red cards — defer to v2
- Injuries and resilience checks — defer to v2
- Corner kicks, throw-ins, free kicks, penalties — defer to v2
- Nutmeg, reckless tackle, last-man foul, professional foul — defer to v2
- Substitutions — defer to v2
- Offside enforcement — defer to v2
- AI / single-player mode — not planned
- Animations — static state updates only
- Mobile layout — desktop-first only

## Context

- Rules reference: Counter Attack Rules Reference Rulebook v1.4.1 (Giannis Tilias)
- Physical board uses a hex grid pitch; exact dimensions to be confirmed by user (photo/measurements pending)
- The 4-5-2 movement sequence and Zone of Influence are the mechanical heart of the game
- Added time per half = dice roll + referee Leniency attribute
- Referee Leniency is on a randomly drawn referee card (1 per game)
- Hardcoded teams should include realistic attribute ranges to make gameplay meaningful

## Constraints

- **Tech — Backend**: Node.js + Socket.io; keeps the WebSocket layer portable to AWS (EC2, Elastic Beanstalk, ECS)
- **Tech — Frontend**: React (Vite); served as static files, can be hosted on S3+CloudFront later
- **Deployment target**: AWS — architecture decisions throughout must support straightforward AWS deployment as the final phase
- **Scope**: Core rules only in v1; full rulebook fidelity deferred to future milestones
- **Multiplayer**: Real-time only (no async/turn-timer mode); requires active WebSocket connection
- **Pitch layout**: Exact hex grid coordinates depend on user-provided board photo/measurements — treat as a blocking dependency for accurate hex rendering

## Key Decisions

| Decision                           | Rationale                                                                                      | Outcome   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | --------- |
| Server-authoritative game state    | Prevents cheating, simplifies sync, maps cleanly to AWS stateful containers                    | — Pending |
| Socket.io over raw WebSockets      | Handles reconnection and room management out of the box; negligible overhead for this use case | — Pending |
| React + Vite frontend              | Fast dev loop, static build output suitable for S3+CloudFront                                  | — Pending |
| Hardcoded teams for v1             | Eliminates card editor scope; lets us validate gameplay loop first                             | — Pending |
| Core rules only for v1             | Fouls/injuries add significant state complexity; validate core loop before adding edge cases   | — Pending |
| Hex grid from user-provided layout | Counter Attack pitch has specific proportions; approximation risks rules mismatches            | — Pending |

## Current State

Phase 1 complete (2026-05-28) — pnpm monorepo scaffold with shared types and hex math done. Phase 2 (Move Validator + Unit Tests) is next.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-05-27 after initialization_
