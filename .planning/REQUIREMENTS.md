# Requirements — Counter Attack Web

## v1 Requirements

### Connection & Lobby

- [x] **CONN-01**: Player can create a game room and receive a 4-6 character room code to share
- [x] **CONN-02**: Player can join an existing game room by entering a valid room code
- [x] **CONN-03**: Game starts automatically once both players have joined the room
- [x] **CONN-04**: Server rejects join attempts for room codes that do not exist or are already in progress

### Pitch & Grid

- [x] **PITCH-01**: Hex grid pitch renders the Counter Attack board layout using axial (q, r) coordinates
- [x] **PITCH-02**: Pitch regions are encoded: final thirds, penalty areas, 6-yard boxes, centre circle, kickoff hex
- [x] **PITCH-03**: Difficult shooting angle hexes (dot-marked) are encoded and apply -1 dice penalty
- [x] **PITCH-04**: Player selects a piece by clicking it; valid destination hexes highlight immediately
- [x] **PITCH-05**: Ball position is visually distinct from player positions at all times

### Teams & Players

- [x] **TEAM-01**: Two hardcoded squads (11 players each) with full attribute sets: Pace, Shooting, Tackling, Dribbling, Heading, Saving, Handling, Resilience, Aerial Ability
- [x] **TEAM-02**: Player cards display name, position, and all attributes during their team's turn
- [x] **TEAM-03**: A referee card with a Leniency attribute is randomly assigned at match start

### Movement Phase

- [ ] **MOVE-01**: Movement Phase follows the 4-5-2 sequence: attacker moves 4 players → defender moves 5 players → attacker moves 2 new players (≤2 hexes each)
- [ ] **MOVE-02**: Each player's Pace attribute caps their total hex movement in a single Movement Phase
- [ ] **MOVE-03**: Players cannot move through or end movement on an occupied hex
- [ ] **MOVE-04**: When the ball-carrier enters a defender's Zone of Influence (adjacent hex), the defender must attempt a steal (roll 6 or combined 10+ with Tackling)
- [ ] **MOVE-05**: A successful steal ends the Movement Phase and transfers possession
- [ ] **MOVE-06**: After any action with the ball in one final third, all players in the opposite final third get a free 6-hex move (attacking team first)
- [ ] **MOVE-07**: Player in possession can take a snapshot during their movement if the ball is in the opponent's penalty area

### Passing

- [ ] **PASS-01**: Standard Pass travels up to 11 hexes along the ground; cannot pass through an opponent's hex; adjacent defenders may attempt interception (roll 6 or combined 10+)
- [ ] **PASS-02**: First-time Pass travels up to 6 hexes; each team moves 1 player 1 hex as the ball travels; interception rules apply
- [ ] **PASS-03**: High Pass travels up to 15 hexes; accuracy check required (combined High Pass attribute + dice ≥ 8); cannot be made if opponent is adjacent and in the path; each team moves 1 player up to 3 hexes during flight
- [ ] **PASS-04**: Long Pass travels to any position on the pitch; accuracy check required (9+ same third, 10+ across final thirds); cannot land within 5 hexes of own players or adjacent to an opponent
- [ ] **PASS-05**: Inaccurate passes trigger the Loose Ball procedure

### Heading

- [ ] **HEAD-01**: A header must follow a High Pass; players within 1 hex challenge normally; players within 2 hexes challenge with -1 dice penalty
- [ ] **HEAD-02**: An uncontested header is won automatically (no dice roll required)
- [x] **HEAD-03**: A headed attempt at goal must be declared before rolling; if attacker wins the duel, goalkeeper attempts a save; cannot be blocked by outfield defenders
- [ ] **HEAD-04**: A headed pass cannot be intercepted; two consecutive headed passes are not allowed
- [ ] **HEAD-05**: Players who challenged for a header cannot participate in the subsequent Movement Phase

### Shooting & Saving

- [x] **SHOT-01**: Shot declared in a direction; shooter rolls Shooting + dice vs goalkeeper's Saving + dice; attacker score higher = goal
- [ ] **SHOT-02**: Shots from outside the penalty area receive a -1 dice penalty; goalkeeper moves 1 hex before saving (ball entering area)
- [ ] **SHOT-03**: Rolling a 1 on a shot is an automatic miss regardless of attributes
- [x] **SHOT-04**: Goalkeeper may dive up to 3 hexes parallel to the goal line; diving to the 3rd hex incurs -1 Saving penalty; shots 4+ hexes away cannot be saved
- [x] **SHOT-05**: After the goalkeeper catches the ball, they choose: kick (High Pass accuracy check, 8+), quick throw (Standard Pass distance, uninterceptable), or start a Movement Phase
- [ ] **SHOT-06**: Handling check after a save: roll ≥ Handling attribute = ball spills (Loose Ball); roll < Handling = ball caught

### Snapshots

- [x] **SNAP-01**: Snapshot may be taken during a Movement Phase if the ball-carrier is in the opponent's penalty area, or immediately after any pass (inside or outside box)
- [x] **SNAP-02**: Snapshot applies -1 dice penalty to Shooting; before the shot, 1 opponent moves any player up to 2 hexes to attempt a deflection
- [ ] **SNAP-03**: All standard shooting rules apply to snapshots

### Dice & Resolution

- [x] **DICE-01**: All dice rolls are generated server-side using a cryptographically random source
- [x] **DICE-02**: Active player clicks a "Roll" button to trigger the roll; result is broadcast to both clients simultaneously
- [ ] **DICE-03**: Combined score = player attribute + dice result; used for all accuracy checks and duels
- [ ] **DICE-04**: Maximum cumulative dice penalty on any single roll is -2
- [ ] **DICE-05**: Loose Ball: server rolls direction (1-6 matching pitch deflection ruler) and distance (1-6 hexes) from the incident centre; result broadcast to both clients

### Match Structure

- [x] **MATCH-01**: Match consists of two 45-action halves; actions are: Movement Phase, Standard Pass, First-time Pass, High Pass, Long Pass, Header, Snapshot, Shot
- [x] **MATCH-02**: At the end of each half, added time = dice roll + referee Leniency attribute; play continues for exactly that many additional actions
- [x] **MATCH-03**: Kick off procedure: one player placed on the centre hex; attacking team may have players in the centre circle, defending team may not; game starts with a Standard Pass
- [x] **MATCH-04**: Second half kick off is taken by the team that did not kick off in the first half
- [x] **MATCH-05**: Score is tracked and displayed to both players throughout the match

### User Experience

- [x] **UX-01**: Turn indicator displays the active player/team and the current game phase at all times
- [x] **UX-02**: Valid destination hexes highlight when a player piece is selected; invalid moves are not clickable
- [x] **UX-03**: Server-side event log records every action as a structured object (actor, action type, from/to coordinates, dice results, outcome) in the order executed
- [x] **UX-04**: The event log is stored in server memory for the duration of the match and used for both reconnection state replay and post-game replay

### Undo

- [ ] **UNDO-01**: The active player may undo their own movement or action steps within their current turn, up to the point a dice roll has been committed
- [ ] **UNDO-02**: Undo is not available after a dice roll result has been broadcast (dice rolls are final)
- [ ] **UNDO-03**: The opposing player cannot block or veto an undo request
- [ ] **UNDO-04**: Undoing a movement step restores the piece to its previous hex and decrements the move counter

### Post-Game Replay

- [x] **REPLAY-01**: After full time, both players are shown a replay of the entire match
- [x] **REPLAY-02**: Replay advances one action per second, rendering each board state in sequence from the event log
- [x] **REPLAY-03**: Replay is driven by the server-side event log; no additional data capture required at game end

### Technical Architecture

- [x] **ARCH-01**: Game state is server-authoritative; clients send action intents and receive validated state broadcasts
- [x] **ARCH-02**: Project is structured as a pnpm monorepo with packages: `shared` (types, hex math, move validation), `server` (Express + Socket.io), `client` (React + Vite)
- [x] **ARCH-03**: All hex geometry uses axial (q, r) coordinates; cube coordinate conversion available in `shared` for distance arithmetic
- [x] **ARCH-04**: Server broadcasts full game state snapshot after every validated action (no differential patching)
- [ ] **ARCH-05**: Server is deployable to AWS Elastic Beanstalk (single instance) without architectural changes; Socket.io client configured for WebSocket-only transport (no polling fallback) to eliminate sticky session requirements
- [ ] **ARCH-06**: Static client build is deployable to S3 + CloudFront
- [x] **ARCH-07**: Move validation logic lives exclusively in `packages/shared` as pure functions with no Socket.io or Express imports; fully unit-testable in isolation

---

## v2 Requirements

_Deferred — validate core gameplay loop before adding complexity._

- Fouls, yellow/red cards, booking checks
- Injuries and resilience checks
- Corner kicks, throw-ins, free kicks, penalty kicks
- Nutmeg, reckless tackle, last-man foul, professional foul
- Substitutions
- Offside enforcement
- Reconnection grace period (server holds room state for disconnected player)
- Rematch flow
- Chat

---

## Out of Scope

- AI / single-player mode — not planned
- Animations — static state transitions only
- Mobile layout — desktop-first only
- Spectator mode — not planned
- Turn timers / clock enforcement — not planned
- Custom team / card editor — hardcoded teams only in this milestone

---

## Traceability

| REQ-ID    | Phase   |
| --------- | ------- |
| ARCH-02   | Phase 1 |
| ARCH-03   | Phase 1 |
| ARCH-07   | Phase 1 |
| MOVE-01   | Phase 2 |
| MOVE-02   | Phase 2 |
| MOVE-03   | Phase 2 |
| MOVE-04   | Phase 2 |
| MOVE-05   | Phase 2 |
| MOVE-06   | Phase 2 |
| MOVE-07   | Phase 2 |
| PASS-01   | Phase 2 |
| PASS-02   | Phase 2 |
| PASS-03   | Phase 2 |
| PASS-04   | Phase 2 |
| PASS-05   | Phase 2 |
| HEAD-01   | Phase 2 |
| HEAD-02   | Phase 2 |
| HEAD-03   | Phase 2 |
| HEAD-04   | Phase 2 |
| HEAD-05   | Phase 2 |
| SNAP-01   | Phase 2 |
| SNAP-02   | Phase 2 |
| SNAP-03   | Phase 2 |
| SHOT-01   | Phase 2 |
| SHOT-02   | Phase 2 |
| SHOT-03   | Phase 2 |
| SHOT-04   | Phase 2 |
| SHOT-06   | Phase 2 |
| DICE-03   | Phase 2 |
| DICE-04   | Phase 2 |
| DICE-05   | Phase 2 |
| CONN-01   | Phase 3 |
| CONN-02   | Phase 3 |
| CONN-03   | Phase 3 |
| CONN-04   | Phase 3 |
| ARCH-01   | Phase 3 |
| ARCH-04   | Phase 3 |
| TEAM-01   | Phase 4 |
| TEAM-02   | Phase 4 |
| TEAM-03   | Phase 4 |
| PITCH-01  | Phase 4 |
| PITCH-02  | Phase 4 |
| PITCH-03  | Phase 4 |
| DICE-01   | Phase 5 |
| DICE-02   | Phase 5 |
| SHOT-05   | Phase 5 |
| PITCH-04  | Phase 6 |
| PITCH-05  | Phase 6 |
| UX-01     | Phase 6 |
| UX-02     | Phase 6 |
| UX-03     | Phase 6 |
| UX-04     | Phase 6 |
| UNDO-01   | Phase 7 |
| UNDO-02   | Phase 7 |
| UNDO-03   | Phase 7 |
| UNDO-04   | Phase 7 |
| MATCH-01  | Phase 8 |
| MATCH-02  | Phase 8 |
| MATCH-03  | Phase 8 |
| MATCH-04  | Phase 8 |
| MATCH-05  | Phase 8 |
| REPLAY-01 | Phase 8 |
| REPLAY-02 | Phase 8 |
| REPLAY-03 | Phase 8 |
| ARCH-05   | Phase 9 |
| ARCH-06   | Phase 9 |

---

## Definition of Done

A v1 requirement is done when:

1. The described behaviour works end-to-end in a local 2-player session
2. The server enforces the rule (not just the client)
3. Both players' screens show consistent state after the action
